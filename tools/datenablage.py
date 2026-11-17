#!/usr/bin/env python3
"""Daten der Koch-App verlustfrei ins private Repo zusammenführen.

Die Koch-App speichert Sterne, Notizen, Wischer (Entdecken) und Tausche. Seit es die private Ablage gibt
(app/daten/ablage.json mit {"privat": true}), liegen sie im privaten Repo Einkaufsbuddy-Daten. Geräte mit einem
alten Schlüssel oder einem alten App-Stand können aber noch ins öffentliche Rezept-Repo schreiben. Dieses
Werkzeug holt alles, was dort (noch) liegt, ins private Repo – ohne etwas zu verlieren – und kann die
öffentlichen Kopien danach entfernen.

  python3 tools/datenablage.py <rezept-repo> <privates-repo> [--entfernen]

Zusammenführen (nie überschreiben, nur ergänzen):
  geschmack/bewertungen.json, sterne.json, eingeplant.json  – je Schlüssel gewinnt der neuere Zeitpunkt „at“
  geschmack/notizen.json                                     – Notizen je Rezept nach id vereinigt, neuere gewinnt
  tausch/kw<kw>-<jahr>.json                                  – Tausche nach id vereinigt; ein abgeschlossener
                                                               Status (übernommen, verfallen, …) schlägt „offen“
  README.md in geschmack/ und tausch/                        – werden übernommen, falls im privaten Repo noch nicht da
Mit --entfernen werden die öffentlichen Dateien danach gelöscht (git rm muss der Aufrufer committen).
Ausgabe: eine Zeile je Datei und am Ende „Ablage: … Dateien zusammengeführt“.
"""
import json
import pathlib
import shutil
import sys

DONE = {"übernommen", "verfallen", "verworfen", "nur-app"}


def load(p):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None


def dump(p, data):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def newer(a, b):
    """True, wenn a neuer ist als b (fehlendes at gilt als alt)."""
    return (a or {}).get("at", "") > (b or {}).get("at", "")


def merge_items(pub, priv):
    out = dict(priv.get("items") or {})
    n = 0
    for k, v in (pub.get("items") or {}).items():
        if not v:
            continue
        v = dict(v)
        if "an" + "ton" in v:  # altes Feld aus der ersten Fassung
            if v.pop("an" + "ton"):
                v["kind"] = True
        if k not in out or newer(v, out[k]):
            out[k] = v
            n += 1
    return out, n


def merge_notes(pub, priv):
    out = {k: dict(v) for k, v in (priv.get("items") or {}).items()}
    n = 0
    for slug, x in (pub.get("items") or {}).items():
        it = out.setdefault(slug, {"t": x.get("t", ""), "notes": []})
        if not it.get("t"):
            it["t"] = x.get("t", "")
        by = {m["id"]: m for m in it.get("notes") or []}
        for m in x.get("notes") or []:
            if m["id"] not in by or newer(m, by[m["id"]]):
                by[m["id"]] = m
                n += 1
        it["notes"] = sorted(by.values(), key=lambda m: m.get("at", ""))
    return out, n


def merge_swaps(pub, priv):
    by = {s["id"]: s for s in priv.get("swaps") or []}
    n = 0
    for s in pub.get("swaps") or []:
        cur = by.get(s["id"])
        if cur is None:
            by[s["id"]] = s
            n += 1
        elif cur.get("status") == "offen" and s.get("status") in DONE:
            by[s["id"]] = s
            n += 1
    return sorted(by.values(), key=lambda s: s.get("at", "")), n


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 2:
        sys.exit(__doc__)
    pub, priv = pathlib.Path(args[0]), pathlib.Path(args[1])
    remove = "--entfernen" in sys.argv
    touched, gone = 0, []
    for name in ("bewertungen.json", "sterne.json", "eingeplant.json", "notizen.json"):
        src, dst = pub / "geschmack" / name, priv / "geschmack" / name
        a = load(src)
        if a is None:
            continue
        b = load(dst) or {}
        data = dict(b)
        for key in ("info",):
            if key in a and key not in data:
                data[key] = a[key]
        if name == "notizen.json":
            data["items"], n = merge_notes(a, b)
        else:
            data["items"], n = merge_items(a, b)
        if "info" in data:
            data["info"] = data["info"].replace("an" + "ton: true", "kind: true")
        data["updated"] = max(a.get("updated", ""), b.get("updated", ""))
        dump(dst, data)
        touched += 1
        gone.append(src)
        print(f"geschmack/{name}: {n} Einträge aus dem Rezept-Repo übernommen")
    for src in sorted((pub / "tausch").glob("kw*.json")):
        dst = priv / "tausch" / src.name
        a, b = load(src), load(dst) or {}
        data = dict(b)
        data["week"] = a.get("week") or b.get("week") or src.stem
        data["swaps"], n = merge_swaps(a, b)
        data["updated"] = max(a.get("updated", ""), b.get("updated", ""))
        dump(dst, data)
        touched += 1
        gone.append(src)
        print(f"tausch/{src.name}: {n} Tausche übernommen")
    for d in ("geschmack", "tausch"):
        src, dst = pub / d / "README.md", priv / d / "README.md"
        if src.exists() and not dst.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(src, dst)
            print(f"{d}/README.md übernommen")
        if src.exists():
            gone.append(src)
    if remove:
        for f in gone:
            f.unlink()
        print(f"Entfernt im Rezept-Repo: {len(gone)} Dateien (git add -A und committen)")
    print(f"Ablage: {touched} Dateien zusammengeführt")


if __name__ == "__main__":
    main()
