#!/usr/bin/env python3
"""Erzeugt öffentliche Rezeptseiten (schema.org/Recipe für den Bring!-Import) aus einem Wochenplan-JSON.

Aufruf:  python3 tools/build_pages.py pfad/zum/plan.json [--hide VORNAME]

- schreibt rezepte/<slug>.html für jedes Rezept im Plan (Wochengerichte + Ersatzgerichte)
- pflegt rezepte/rezepte.json (Verzeichnis aller Rezepte) und baut daraus index.html
- per --hide übergebene Vornamen werden ersetzt; die Seiten sind öffentlich
"""
import html
import json
import pathlib
import copy
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import bring  # noqa: E402  (einheitliche Bring-Namen, tools/bring_namen.json)

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "rezepte"
SITE = "https://padderico.github.io/Rezeptesammlung/"
DEV = {"tm": "Thermomix TM31", "ofen": "Ofen", "hlf": "Heißluftfritteuse", "herd": "Herd"}


def slugify(t):
    t = t.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss").replace("&", " und ")
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


HIDE = []
UNKNOWN = set()


def anonym(t):
    """Ersetzt per --hide übergebene Vornamen durch neutrale Formulierungen."""
    if not t:
        return t
    for name in HIDE:
        for a, b in [("+ " + name, "+ Kind"), (name + "s Portion", "Kinderportion"), (name + "s Teller", "Kinderteller"),
                     ("Für " + name, "Fürs Kind"), ("für " + name, "fürs Kind"), (name, "das Kind")]:
            t = t.replace(a, b)
    return t


def num_display(v):
    w = int(v)
    f = round(v - w, 2)
    frac = {0.5: "½", 0.25: "¼", 0.75: "¾"}.get(f)
    if f and not frac:
        return str(round(v, 2)).replace(".", ",")
    return (str(w) if w else "") + (frac or "") or "0"


def num_ld(v):
    w = int(v)
    f = round(v - w, 2)
    frac = {0.5: "1/2", 0.25: "1/4", 0.75: "3/4"}.get(f)
    if f and not frac:
        return str(round(v, 2)).replace(".", ",")
    if not frac:
        return str(w)
    return f"{w} {frac}" if w else frac


def qty(i, fmt):
    if i.get("a") is None:
        return ""
    s = fmt(i["a"])
    if i.get("a2") is not None:
        s += "–" + fmt(i["a2"]) if fmt is num_display else "-" + fmt(i["a2"])
    return s + (" " + i["u"] if i.get("u") else "")


def clean_name(n):
    n = re.sub(r"\s*\([^)]*\)", "", n)
    return n.split(",")[0].strip()


def ld_ingredients(r):
    """Zutaten für den Bring-Import: einheitliche Kachelnamen aus tools/bring_namen.json, ohne Vorrat."""
    return [anonym(x) for x in bring.recipe_lines(r["ingredients"], UNKNOWN)]


def page(rid, r, week_label):
    slug = slugify(r["title"])
    url = SITE + "rezepte/" + slug + ".html"
    steps = []
    for s in r["steps"]:
        t = anonym(s["t"])
        if s.get("dev"):
            t += f" ({DEV.get(s['dev'], s['dev'])}: {s['set']})"
        steps.append({"@type": "HowToStep", "text": t})
    ld = {
        "@context": "https://schema.org/",
        "@type": "Recipe",
        "name": r["title"],
        "author": {"@type": "Organization", "name": "Rezeptesammlung"},
        "inLanguage": "de",
        "url": url,
        "recipeYield": str(r["base"]),
        "totalTime": f"PT{r['time']['total']}M",
        "keywords": ", ".join(r.get("tags", [])),
        "recipeIngredient": ld_ingredients(r),
        "recipeInstructions": steps,
    }
    bring = ("https://api.getbring.com/rest/bringrecipes/deeplink?url=" + url.replace(":", "%3A").replace("/", "%2F")
             + f"&source=web&baseQuantity={r['base']}&requestedQuantity={r['base']}")
    e = html.escape
    ing = "".join(
        f'<li><span class="q">{e(qty(i, num_display))}</span><span>{e(i["n"])}{" <small>Vorrat</small>" if i.get("v") else ""}</span></li>'
        for i in r["ingredients"])
    prep = "".join(f"<li>{e(anonym(p))}</li>" for p in r.get("prep", []))
    st = "".join(
        f'<li>{e(anonym(s["t"]))}' + (f'<br><span class="set"><b>{e(DEV.get(s["dev"], s["dev"]))}</b> {e(s["set"])}</span>' if s.get("dev") else "") + "</li>"
        for s in r["steps"])
    kid = f'<section class="box"><h2>Fürs Kleinkind</h2><p>{e(anonym(r["anton"]))}</p></section>' if r.get("anton") else ""
    store = f'<section class="box"><h2>Aufbewahren &amp; Varianten</h2><p>{e(anonym(r["store"]))}</p></section>' if r.get("store") else ""
    ld_json = json.dumps(ld, ensure_ascii=False, indent=1).replace("</", "<\\/")
    return slug, f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(r['title'])}</title>
<script type="application/ld+json">
{ld_json}
</script>
<link rel="stylesheet" href="style.css">
</head>
<body>
<main>
<p class="back"><a href="../index.html">Alle Rezepte</a></p>
<h1>{e(r['title'])}</h1>
<p class="meta">{r['base']} Portionen · gesamt {r['time']['total']} Min. · aktiv {r['time']['active']} Min. · {e(', '.join(r.get('tags', [])))}</p>
<p><a class="bring" href="{e(bring)}">In Bring übernehmen</a></p>
<div class="cols">
<section><h2>Zutaten</h2><ul class="ing">{ing}</ul></section>
<section>{'<h2>Vorbereiten</h2><ul>' + prep + '</ul>' if prep else ''}<h2>Zubereitung</h2><ol>{st}</ol></section>
</div>
{kid}{store}
<p class="foot">Thermomix-Angaben für den TM31 · aus dem Wochenplan {e(week_label)}</p>
</main>
</body>
</html>
"""


STYLE = """:root{--bg:#F2F5F0;--card:#fff;--ink:#16302A;--muted:#566A63;--line:#D5DDD6;--accent:#0D6657;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#0E1715;--card:#15221E;--ink:#E4EEE9;--muted:#9BB0A8;--line:#2A3C36;--accent:#62C6B1}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.55 system-ui,"Segoe UI",sans-serif}
main{max-width:980px;margin:0 auto;padding:24px 20px 60px}h1{font-size:1.9rem;line-height:1.15;margin:.2em 0}
h2{font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:1.4em 0 .5em}
a{color:var(--accent)}.meta,.foot,.back{color:var(--muted)}.foot{font-size:.85rem;margin-top:2em}
.bring{display:inline-block;background:var(--accent);color:var(--card);padding:10px 16px;border-radius:10px;font-weight:700;text-decoration:none}
.cols{display:grid;grid-template-columns:minmax(240px,320px) 1fr;gap:28px}@media(max-width:760px){.cols{grid-template-columns:1fr}}
.ing{list-style:none;padding:0;margin:0}.ing li{display:grid;grid-template-columns:5.5em 1fr;gap:10px;padding:5px 0;border-bottom:1px dashed var(--line)}
.ing .q{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}small{color:var(--muted)}
ol li,ul li{margin-bottom:.5em}.set{display:inline-block;margin-top:4px;font:600 .9rem ui-monospace,Menlo,monospace;background:var(--ink);color:var(--bg);padding:2px 8px;border-radius:6px}
.box{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:4px 16px 12px;margin-top:16px}
.list{list-style:none;padding:0;display:grid;gap:8px}.list a{display:block;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;text-decoration:none;color:var(--ink)}
.list small{display:block}
"""


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("plan")
    ap.add_argument("--hide", action="append", default=[], help="Vorname, der auf den öffentlichen Seiten ersetzt wird")
    ap.add_argument("--strict", action="store_true", help="Abbruch, wenn eine Zutat nicht in tools/bring_namen.json steht")
    args = ap.parse_args()
    HIDE.extend(args.hide)
    plan = json.loads(pathlib.Path(args.plan).read_text(encoding="utf-8"))
    OUT.mkdir(exist_ok=True)
    (OUT / "style.css").write_text(STYLE, encoding="utf-8")
    manifest_path = OUT / "rezepte.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else []
    by_slug = {m["slug"]: m for m in manifest}
    week = plan["week"]
    week_label = f"KW {week['kw']}/{week['year']}"
    used = []
    for d in plan.get("days", []):
        for m in d["meals"]:
            if m["recipe"] not in used:
                used.append(m["recipe"])
    used += [x for x in plan.get("prep", {}).get("recipes", []) + plan.get("extras", []) if x not in used]
    for m in by_slug.values():
        m["current"] = False
    for rid in used:
        r = plan["recipes"][rid]
        slug, content = page(rid, r, week_label)
        (OUT / f"{slug}.html").write_text(content, encoding="utf-8")
        entry = by_slug.get(slug, {"slug": slug, "first": week_label})
        entry.update({"title": r["title"], "tags": r.get("tags", []), "total": r["time"]["total"], "last": week_label,
                      "extra": rid in plan.get("extras", []), "current": True})
        by_slug[slug] = entry
    manifest = sorted(by_slug.values(), key=lambda m: m["title"].lower())
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")

    e = html.escape
    current = [m for m in manifest if m.get("current")]
    items = lambda ms: "".join(
        f'<li><a href="rezepte/{e(m["slug"])}.html"><b>{e(m["title"])}</b><small>{m["total"]} Min. · {e(", ".join(m["tags"]))}</small></a></li>' for m in ms)
    index = f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rezeptesammlung</title>
<link rel="stylesheet" href="rezepte/style.css">
</head>
<body>
<main>
<h1>Rezeptesammlung</h1>
<p class="meta">Bodenständige Familienrezepte, überwiegend für den Thermomix TM31. Jede Rezeptseite lässt sich direkt in Bring übernehmen.</p>
<h2>Aktuelle Woche ({e(week_label)})</h2>
<ul class="list">{items([m for m in current if not m.get('extra')])}</ul>
<h2>Ersatzgerichte dieser Woche</h2>
<ul class="list">{items([m for m in current if m.get('extra')])}</ul>
<h2>Einkaufsliste dieser Woche</h2>
<ul class="list"><li><a href="einkauf/{e(bring.einkauf_urls(plan)['super'].rsplit('/', 1)[1])}"><b>Supermarkt</b><small>ganze Liste auf einmal in Bring</small></a></li><li><a href="einkauf/{e(bring.einkauf_urls(plan)['metzger'].rsplit('/', 1)[1])}"><b>Metzger</b><small>ganze Liste auf einmal in Bring</small></a></li></ul>
<h2>Alle Rezepte ({len(manifest)})</h2>
<ul class="list">{items(manifest)}</ul>
<h2>Weitere</h2>
<ul class="list"><li><a href="Gurkensalat.html"><b>Gurkensalat mit Joghurt</b></a></li><li><a href="bolognese.html"><b>Bolognese (Test)</b></a></li></ul>
</main>
</body>
</html>
"""
    (ROOT / "index.html").write_text(index, encoding="utf-8")
    print(f"{len(used)} Rezeptseiten geschrieben, {len(manifest)} im Verzeichnis")
    einkauf_pages(plan)
    rc = bring._report(UNKNOWN)
    if args.strict and rc:
        sys.exit(1)


def einkauf_pages(plan):
    """Ganze Wocheneinkaufsliste als importierbare Seite (Supermarkt und Metzger getrennt)."""
    e = html.escape
    shop = bring.normalize_shopping(copy.deepcopy(plan["shopping"]), UNKNOWN)
    urls = bring.einkauf_urls(plan)
    w = plan["week"]
    out = ROOT / "einkauf"
    out.mkdir(exist_ok=True)
    parts = {"super": ("Supermarkt", [it for g in shop["groups"] for it in g["items"]]),
             "metzger": ("Metzger", shop["metzger"]["items"])}
    for k, (label, items) in parts.items():
        lines = [anonym(x) for x in bring.shopping_lines(items)]
        title = f"Einkauf KW {w['kw']} – {label}"
        ld = {"@context": "https://schema.org/", "@type": "Recipe", "name": title,
              "author": {"@type": "Organization", "name": "Rezeptesammlung"}, "inLanguage": "de", "url": urls[k],
              "recipeYield": "1", "recipeIngredient": lines,
              "recipeInstructions": [{"@type": "HowToStep", "text": f"Einkaufsliste {label} für die Woche {w['label']}."}]}
        ld_json = json.dumps(ld, ensure_ascii=False, indent=1).replace("</", "<\\/")
        lis = "".join(f'<li><span class="q">{e(anonym(_q(it)))}</span><span>{e(it["n"])}</span></li>' for it in items if not it.get("have"))
        page_html = f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>{e(title)}</title>
<script type="application/ld+json">
{ld_json}
</script>
<link rel="stylesheet" href="../rezepte/style.css">
</head>
<body>
<main>
<p class="back"><a href="../index.html">Alle Rezepte</a></p>
<h1>{e(title)}</h1>
<p class="meta">{e(w['label'])} · {len(lines)} Artikel, jeder auf seiner festen Bring-Kachel</p>
<p><a class="bring" href="{e(bring.deeplink(urls[k]))}">Ganze Liste in Bring übernehmen</a></p>
<ul class="ing">{lis}</ul>
</main>
</body>
</html>
"""
        (out / urls[k].rsplit("/", 1)[1]).write_text(page_html, encoding="utf-8")
    print(f"Einkaufslisten geschrieben: {urls['super']} · {urls['metzger']}")


def _q(it):
    return bring._flat(it.get("q")) or ""


if __name__ == "__main__":
    main()
