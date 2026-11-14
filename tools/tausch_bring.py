#!/usr/bin/env python3
"""Bring-Nachkauf nach einem Tausch aus der Koch-App.

Aufruf:  python3 tools/tausch_bring.py VORHER.json NACHHER.json [--hide VORNAME]

- vergleicht die Einkaufslisten (Supermarkt und Metzger) des Plans vor und nach dem Tausch
- schreibt eine Bring-Importseite nur mit den neuen bzw. in der Menge geänderten Artikeln:
  einkauf/kw<kw>-<jahr>-nachkauf-<MMTT>-<HHMM>.html (öffentlich, wie die anderen Einkaufsseiten: keine Preise, keine Läden)
- trägt den Nachkauf in app/daten/bring/kw<kw>-<jahr>.json ein; die Koch-App zeigt daraus den Hinweis „Bring-Liste aktualisieren“
- gibt Adresse, Bring-Link, neue und entfallene Artikel aus (für die Mail)
"""
import copy
import html
import json
import pathlib
import subprocess
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import bring  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://padderico.github.io/Rezeptesammlung/"


def items_of(plan, hide):
    shop = bring.normalize_shopping(copy.deepcopy(plan["shopping"]), set())
    out = {}
    for g in shop["groups"] + [dict(shop["metzger"], name="Metzger")]:
        for it in g["items"]:
            if it.get("have"):
                continue
            key = it.get("b") or bring.parse_name(it["n"])["key"]
            q = bring._flat(it.get("q")) or ""
            for name in hide:
                q = q.replace(name, "das Kind")
            out[key] = {"n": it["n"], "b": key, "q": q, "g": g.get("name") or g.get("title") or ""}
    return out


def meal_changes(old, new):
    titles = lambda p, rid: (p["recipes"].get(rid) or {}).get("title", rid)
    res = []
    for d_new in new.get("days", []):
        d_old = next((d for d in old.get("days", []) if d.get("iso") == d_new.get("iso")), None)
        if not d_old:
            continue
        for m in d_new.get("meals", []):
            mo = next((x for x in d_old.get("meals", []) if x.get("slot") == m.get("slot")), None)
            if mo and mo.get("recipe") != m.get("recipe"):
                res.append(f"{d_new['name']} {m['slot']}: {titles(new, m['recipe'])} statt {titles(old, mo['recipe'])}")
    return res


def main():
    args = sys.argv[1:]
    hide = []
    if "--hide" in args:
        i = args.index("--hide"); hide.append(args[i + 1]); del args[i:i + 2]
    if len(args) != 2:
        print(__doc__); return 2
    old = json.loads(pathlib.Path(args[0]).read_text(encoding="utf-8"))
    new = json.loads(pathlib.Path(args[1]).read_text(encoding="utf-8"))
    a, b = items_of(old, hide), items_of(new, hide)
    add = [dict(v, neu=k not in a) for k, v in b.items() if k not in a or a[k]["q"] != v["q"]]
    remove = [v for k, v in a.items() if k not in b]
    changes = meal_changes(old, new)
    now = datetime.now(ZoneInfo("Europe/Berlin"))
    w = new["week"]
    wid = f"kw{int(w['kw']):02d}-{w['year']}"
    upd = {"id": now.strftime("%m%d-%H%M"), "at": now.isoformat(timespec="minutes"), "changes": changes,
           "add": [{"n": x["n"], "q": x["q"], "neu": x["neu"]} for x in add],
           "remove": [{"n": x["n"], "q": x["q"]} for x in remove], "url": "", "bring": ""}
    if add:
        fname = f"kw{int(w['kw']):02d}-{w['year']}-nachkauf-{upd['id']}.html"
        url = SITE + "einkauf/" + fname
        lines = bring.shopping_lines([{"n": x["n"], "b": x["b"], "q": x["q"]} for x in add])
        title = f"Nachkauf KW {w['kw']} – {now.strftime('%d.%m.')}"
        ld = {"@context": "https://schema.org/", "@type": "Recipe", "name": title,
              "author": {"@type": "Organization", "name": "Rezeptesammlung"}, "inLanguage": "de", "url": url,
              "recipeYield": "1", "recipeIngredient": lines,
              "recipeInstructions": [{"@type": "HowToStep", "text": "Zusätzliche Zutaten nach einem Tausch im Wochenplan."}]}
        e = html.escape
        ld_json = json.dumps(ld, ensure_ascii=False, indent=1).replace("</", "<\\/")
        lis = "".join(f'<li><span class="q">{e(x["q"])}</span><span>{e(x["n"])}</span></li>' for x in add)
        page = f"""<!DOCTYPE html>
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
<p class="meta">{e(w['label'])} · {len(lines)} Artikel, die nach dem Tausch dazukommen</p>
<p><a class="bring" href="{e(bring.deeplink(url))}">Nur diese Zutaten in Bring übernehmen</a></p>
<ul class="ing">{lis}</ul>
</main>
</body>
</html>
"""
        (ROOT / "einkauf").mkdir(exist_ok=True)
        (ROOT / "einkauf" / fname).write_text(page, encoding="utf-8")
        upd["url"], upd["bring"] = url, bring.deeplink(url)
    path = ROOT / "app" / "daten" / "bring" / f"{wid}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"week": wid, "updates": []}
    data["updates"] = [u for u in data["updates"] if u.get("id") != upd["id"]] + [upd]
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    if (ROOT / ".git").exists():
        subprocess.run(["git", "add", "app/daten/bring", "einkauf"], cwd=ROOT, capture_output=True)
    print("Geändert:", "; ".join(changes) or "–")
    print("Neu für Bring:", ", ".join(f"{x['n']} ({x['q']})" if x["q"] else x["n"] for x in add) or "nichts")
    print("Entfällt:", ", ".join(f"{x['n']} ({x['q']})" if x["q"] else x["n"] for x in remove) or "nichts")
    print("Importseite:", upd["url"] or "– (nichts nachzukaufen)")
    print("Bring-Link:", upd["bring"] or "–")
    print(f"App-Hinweis: app/daten/bring/{wid}.json (Nachkauf {upd['id']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
