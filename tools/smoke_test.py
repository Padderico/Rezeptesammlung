#!/usr/bin/env python3
"""Prüfung vor dem Livegang: läuft bei jedem Push (GitHub Actions, .github/workflows/pruefen.yml).
Nur wenn alles grün ist, geht die Seite live; sonst bleibt die letzte funktionierende Fassung stehen.

  python3 tools/smoke_test.py [repo-pfad]

1. Daten: alle JSON-Dateien unter app/daten/ und rezepte/rezepte.json lassen sich lesen und haben die nötigen Felder.
2. Datenschutz: keine Vornamen der Familie in öffentlichen Daten und Seiten.
3. App im Testbrowser (Playwright, Chromium): Woche, jedes Rezept der Woche, Kochmodus, Vorkochen, Checkliste,
   Entdecken und Alle Rezepte öffnen – ohne JavaScript-Fehler und ohne „Gerade nicht ladbar“.
Ausgabe: je Prüfung eine Zeile, am Ende „ALLES GRÜN“ oder die Fehlerliste (Exit-Code 1).
"""
import functools
import os
import http.server
import json
import pathlib
import re
import socketserver
import sys
import threading

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
errors = []


def fail(msg):
    errors.append(msg)
    print("FEHLER:", msg)


def ok(msg):
    print("ok:", msg)


def check_data():
    files = sorted((ROOT / "app" / "daten").rglob("*.json")) + [ROOT / "rezepte" / "rezepte.json"]
    bad = 0
    for f in files:
        try:
            json.loads(f.read_text(encoding="utf-8"))
        except Exception as e:  # noqa: BLE001
            bad += 1
            fail(f"{f.relative_to(ROOT)} ist kein gültiges JSON: {e}")
    idx = json.loads((ROOT / "app/daten/wochen.json").read_text(encoding="utf-8"))
    if not idx.get("weeks"):
        fail("app/daten/wochen.json enthält keine Woche")
    for w in idx.get("weeks", []):
        p = ROOT / "app/daten/wochen" / w["file"]
        if not p.exists():
            fail(f"Woche {w['file']} fehlt")
            continue
        wk = json.loads(p.read_text(encoding="utf-8"))
        for key in ("week", "days", "recipes"):
            if key not in wk:
                fail(f"{w['file']}: Feld {key} fehlt")
        for d in wk.get("days", []):
            for m in d.get("meals", []):
                r = wk.get("recipes", {}).get(m.get("recipe"))
                if not r:
                    fail(f"{w['file']} {d.get('iso')} {m.get('slot')}: Rezept {m.get('recipe')} fehlt")
                elif not r.get("steps") or not r.get("ingredients") or not r.get("slug"):
                    fail(f"{w['file']}: Rezept {m.get('recipe')} ohne Schritte, Zutaten oder slug")
    for r in json.loads((ROOT / "rezepte/rezepte.json").read_text(encoding="utf-8")):
        if not (ROOT / "app/daten/rezepte" / f"{r['slug']}.json").exists():
            fail(f"rezepte.json nennt {r['slug']}, aber app/daten/rezepte/{r['slug']}.json fehlt")
    if not bad:
        ok(f"{len(files)} JSON-Dateien lesbar, Wochen und Rezepte vollständig")


def check_photos():
    """Beispielfotos: Datei gültig, Rezepte vorhanden; Bilder erreichbar (nur Hinweis, blockiert den Livegang nicht)."""
    import urllib.request
    p = ROOT / "app/daten/fotos.json"
    if not p.exists():
        return
    items = json.loads(p.read_text(encoding="utf-8")).get("items", {})
    slugs = {r["slug"] for r in json.loads((ROOT / "rezepte/rezepte.json").read_text(encoding="utf-8"))}
    for slug, f in items.items():
        if slug not in slugs:
            fail(f"fotos.json: unbekanntes Rezept {slug}")
        if not re.fullmatch(r"photo-[0-9]+-[0-9a-f]+", f.get("id", "")) or not f.get("by") or not f.get("page", "").startswith("https://unsplash.com/photos/"):
            fail(f"fotos.json: Eintrag {slug} unvollständig")
    bad = []
    if os.environ.get("CHECK_PHOTO_URLS"):
        for slug, f in items.items():
            url = f"https://images.unsplash.com/{f['id']}?w=64&q=50&auto=format"
            try:
                with urllib.request.urlopen(urllib.request.Request(url, method="HEAD", headers={"User-Agent": "kochbuddy-check"}), timeout=15) as r:
                    if r.status != 200:
                        bad.append(f"{slug} ({r.status})")
            except Exception as e:  # noqa: BLE001
                bad.append(f"{slug} ({e})")
        for b in bad:
            print("HINWEIS: Foto nicht erreichbar:", b)
    ok(f"{len(items)} Beispielfotos eingetragen" + (f", {len(items) - len(bad)} erreichbar" if os.environ.get("CHECK_PHOTO_URLS") else ""))


def check_privacy():
    names = re.compile(r"\b(" + "|".join(["An" + "ton", "An" + "ja", "Pad" + "de"]) + r")\b")
    hits = 0
    for sub in ("app/daten", "rezepte", "b", "einkauf"):
        for f in (ROOT / sub).rglob("*"):
            if f.suffix in (".json", ".html", ".md", ".txt") and names.search(f.read_text(encoding="utf-8", errors="ignore")):
                hits += 1
                fail(f"Vorname in öffentlicher Datei: {f.relative_to(ROOT)}")
    for f in (ROOT / "app").glob("*.*"):
        if f.suffix in (".js", ".mjs", ".css", ".html") and names.search(f.read_text(encoding="utf-8", errors="ignore")):
            hits += 1
            fail(f"Vorname im App-Code: {f.relative_to(ROOT)}")
    if not hits:
        ok("keine Vornamen in öffentlichen Dateien")


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def check_app():
    from playwright.sync_api import sync_playwright

    handler = functools.partial(Quiet, directory=str(ROOT))
    srv = socketserver.TCPServer(("127.0.0.1", 0), handler)
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{port}/app/"
    idx = json.loads((ROOT / "app/daten/wochen.json").read_text(encoding="utf-8"))
    wid = idx["weeks"][0]["file"].replace(".json", "")
    wk = json.loads((ROOT / "app/daten/wochen" / f"{wid}.json").read_text(encoding="utf-8"))
    n_all = len(json.loads((ROOT / "rezepte/rezepte.json").read_text(encoding="utf-8")))
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"], executable_path=os.environ.get("CHROME_PATH") or None)
        ctx = b.new_context(viewport={"width": 412, "height": 900}, service_workers="block")
        ctx.add_init_script("try{localStorage.setItem('kochbuddy.v1', JSON.stringify({settings:{toured:1, kidName:'-'}}))}catch(e){}")
        ctx.route("https://api.github.com/**", lambda r: r.abort())
        pg = ctx.new_page()
        js_errors = []
        pg.on("pageerror", lambda e: js_errors.append(str(e)))

        def visit(hash_, must, label):
            before = len(js_errors)
            pg.goto(base + hash_)
            pg.wait_for_timeout(700)
            txt = pg.inner_text("#view")
            if "Gerade nicht ladbar" in txt:
                fail(f"{label}: „Gerade nicht ladbar“ – {txt[:160]!r}")
            elif must and not pg.query_selector(must):
                fail(f"{label}: erwartetes Element {must} fehlt")
            elif len(js_errors) > before:
                fail(f"{label}: JavaScript-Fehler {js_errors[before:]}")
            else:
                return True
            return False

        good = 0
        good += visit("#/", ".wstrip", "Woche")
        refs = []
        for d in wk["days"]:
            for m in d["meals"]:
                ref = f"w:{wid}:{m['recipe']}"
                if ref not in refs:
                    refs.append(ref)
        refs += [f"w:{wid}:{x}" for x in wk.get("extras", [])]
        for ref in refs:
            good += visit(f"#/r/{ref}", ".r-head h1", f"Rezept {ref}")
        good += visit(f"#/k/{refs[0]}", ".cook-top", "Kochmodus")
        good += visit("#/vorkochen", "#view h1", "Vorkochen")
        good += visit("#/checkliste", "#view h1", "Checkliste")
        good += visit("#/entdecken", "#view h1", "Entdecken")
        if visit("#/rezepte", "#rlist", "Alle Rezepte"):
            rows = len(pg.query_selector_all("#rlist > li a"))
            if rows != n_all:
                fail(f"Alle Rezepte: {rows} statt {n_all} Einträge")
            else:
                good += 1
        b.close()
    srv.shutdown()
    ok(f"App im Testbrowser: {good} Ansichten fehlerfrei") if not js_errors else None


if __name__ == "__main__":
    check_data()
    check_privacy()
    check_photos()
    try:
        check_app()
    except Exception as e:  # noqa: BLE001
        fail(f"Testbrowser lief nicht: {e}")
    if errors:
        print(f"\n{len(errors)} FEHLER – die Seite geht so nicht live.")
        sys.exit(1)
    print("\nALLES GRÜN")
