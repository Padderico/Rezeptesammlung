#!/usr/bin/env python3
"""Einheitliche Bring-Namen: ein Produkt = eine Kachel.

Die Zuordnung steht in tools/bring_namen.json. Der Bring-Rezeptimport übernimmt den Zutatennamen als Kachel;
nur der genaue Katalogname (z. B. „Rahm“ für Sahne, „Peperoni“ für Paprika) landet auf der vorhandenen Kachel.
Mengen und Hinweise wandern in die Mengenangabe der Kachel („300 g, rot“).

Aufrufe:
  python3 tools/bring.py plan plan.json [--write]   Plan prüfen und vereinheitlichen (Einkaufsliste, Kopiernamen,
                                                    Links für den Listen-Import); ohne --write nur prüfen
  python3 tools/bring.py seiten [--fix]             alle Rezeptseiten im Repo prüfen; mit --fix korrigieren
  python3 tools/bring.py zeile "2 Knoblauchzehen"   eine Zeile testen
Rückgabewert 1, wenn Zutaten fehlen, die noch nicht in bring_namen.json stehen.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CFG = json.loads((ROOT / "tools" / "bring_namen.json").read_text(encoding="utf-8"))
SITE = "https://padderico.github.io/Rezeptesammlung/"
UNITS = set(CFG["einheiten_bring"])
SKIP = [s.lower() for s in CFG["nicht_einkaufen"]]
DROP = set(s.lower() for s in CFG["hinweise_weglassen"])
ADJ = {v.lower(): k for k, vs in CFG["adjektive"].items() for v in vs}
PLURAL = {"Zehe": "Zehen", "Knolle": "Knollen", "Stange": "Stangen", "Filet": "Filets", "Kugel": "Kugeln", "Dose": "Dosen",
          "Packung": "Packungen", "Glas": "Gläser", "Scheibe": "Scheiben", "Blatt": "Blätter", "Tube": "Tuben", "Becher": "Becher",
          "Stück": "Stück", "Bund": "Bund"}

INDEX = {}
KEYS = {}
for art in CFG["artikel"]:
    KEYS[art["key"]] = art
    for v in [art["key"], art["anzeige"]] + art.get("varianten", []):
        INDEX.setdefault(v.lower(), (art, v))


def num(v):
    w = int(v)
    f = round(v - w, 2)
    frac = {0.5: "1/2", 0.25: "1/4", 0.75: "3/4"}.get(f)
    if f and not frac:
        return str(round(v, 2)).replace(".", ",")
    if not frac:
        return str(w)
    return f"{w} {frac}" if w else frac


def _hit(phrase):
    h = INDEX.get(phrase.lower().strip())
    if not h:
        return None
    art, var = h
    extra = []
    z = art.get("zusatz", {}).get(var)
    if z:
        extra.append(z)
    return art, var, extra


def _resolve(head):
    """Sucht den Artikel für eine Bezeichnung ohne Klammern; liefert (artikel, variante, zusätze) oder None."""
    h = _hit(head)
    if h:
        return h
    toks = head.split()
    pre = []
    while toks:
        t = toks[0].lower()
        if t in ADJ:
            pre.append(ADJ[t])
            toks = toks[1:]
        elif t.startswith("tk-") and len(t) > 3:
            pre.append("TK")
            toks = [toks[0][3:]] + toks[1:]
        elif t.startswith("bio-") and len(t) > 4:
            pre.append("Bio")
            toks = [toks[0][4:]] + toks[1:]
        else:
            break
        h = _hit(" ".join(toks))
        if h:
            return h[0], h[1], h[2] + pre
    for k in range(len(toks) - 1, 0, -1):
        h = _hit(" ".join(toks[:k]))
        if h:
            rest = " ".join(toks[k:])
            return h[0], h[1], h[2] + pre + ([rest] if rest.lower() not in DROP else [])
    return None


def parse_name(n):
    """Zutatenname → {key, anzeige, zusatz, stueck, skip, known}."""
    orig = (n or "").strip()
    low = orig.lower()
    parens = [p.strip() for p in re.findall(r"\(([^)]*)\)", orig)]
    skip = any(p.lower() in SKIP or p.lower().startswith("vorhanden") for p in parens) or "aus dem gefrierschrank" in low
    base = re.sub(r"\s*\([^)]*\)", "", orig).strip()
    tail = []
    res = _hit(base)
    if not res and ", " in base:
        head, rest = base.split(", ", 1)
        tail = [t.strip() for t in rest.split(", ") if t.strip()]
        res = _resolve(head)
    elif not res:
        res = _resolve(base)
    extra = []
    for p in parens:
        extra += [x.strip() for x in p.split(", ") if x.strip()]
    if not res:
        return {"key": base, "anzeige": base, "zusatz": [], "stueck": None, "skip": skip, "known": False}
    art, var, z = res
    zus = []
    for x in z + tail + extra:
        xl = x.lower()
        if xl in DROP or xl in SKIP or xl in (art["key"].lower(), art["anzeige"].lower()):
            continue
        if xl not in [y.lower() for y in zus]:
            zus.append(x)
    return {"key": art["key"], "anzeige": art["anzeige"], "zusatz": zus, "stueck": art.get("stueck", {}).get(var),
            "skip": skip, "known": True}


def _spec(a, a2, unit):
    q = "" if a is None else num(a) + ("" if a2 is None else "-" + num(a2))
    return " ".join(x for x in [q, unit or ""] if x)


def _line(key, entries, zus):
    """entries: Liste (a, a2, unit) für denselben Artikel."""
    if len(entries) == 1:
        a, a2, unit = entries[0]
        if a2 is None and (unit is None or unit in UNITS):
            head = " ".join(x for x in [None if a is None else num(a), unit, key] if x)
            return head + (", " + ", ".join(zus) if zus else "")
        spec = _spec(a, a2, unit)
        parts = ([spec] if spec else []) + zus
        return key + (" (" + ", ".join(parts) + ")" if parts else "")
    parts = [" + ".join(s for s in (_spec(*e) for e in entries) if s)] + zus
    parts = [p for p in parts if p]
    return key + (" (" + ", ".join(parts) + ")" if parts else "")


def recipe_lines(ingredients, unknown=None):
    """Zutaten eines Rezepts → Zeilen für schema.org recipeIngredient (Vorrat ausgelassen, gleiche Artikel zusammengefasst)."""
    groups, order = {}, []
    for i in ingredients:
        if i.get("v"):
            continue
        info = parse_name(i["n"])
        if info["skip"]:
            continue
        if not info["known"] and unknown is not None:
            unknown.add(i["n"])
        unit = i.get("u")
        if unit is None and info["stueck"] and i.get("a") is not None:
            unit = info["stueck"] if i["a"] <= 1 and i.get("a2") is None else PLURAL.get(info["stueck"], info["stueck"])
        k = info["key"]
        if k not in groups:
            groups[k] = {"entries": [], "zus": []}
            order.append(k)
        g = groups[k]
        same = [e for e in g["entries"] if e[2] == unit and e[1] is None and e[0] is not None]
        if same and i.get("a") is not None and i.get("a2") is None:
            e = same[0]
            g["entries"][g["entries"].index(e)] = (e[0] + i["a"], None, unit)
        elif i.get("a") is not None or not g["entries"]:
            g["entries"].append((i.get("a"), i.get("a2"), unit))
        for z in info["zusatz"]:
            if z.lower() not in [y.lower() for y in g["zus"]]:
                g["zus"].append(z)
    out = []
    for k in order:
        ents = [e for e in groups[k]["entries"] if e[0] is not None] or groups[k]["entries"][:1]
        out.append(_line(k, ents, groups[k]["zus"]))
    return out


NUM = r"(?:\d+(?:[.,]\d+)?(?:\s+\d/\d)?|\d/\d|½|¼|¾)"
LUNITS = r"g|kg|ml|l|EL|TL|Bund|cm|Stange|Stangen|Prise|Prisen|Becher|Dose|Dosen|Zehe|Zehen|Blatt|Blätter|Scheibe|Scheiben|Stück|Kugel|Kugeln|Packung|Packungen|Pck\.|Glas|Gläser|Tube|Knolle|Knollen|Filet|Filets"
LINE = re.compile(rf"^\s*(?P<a>{NUM})(?:\s*[-–]\s*(?P<a2>{NUM}))?\s+(?:(?P<adj>kleine|große|kleiner|großer)\s+)?(?:(?P<u>{LUNITS})\s+)?(?P<n>.+)$")


def _f(s):
    s = s.replace("½", "1/2").replace("¼", "1/4").replace("¾", "3/4")
    if " " in s:
        w, fr = s.split()
        return float(w) + _f(fr)
    if "/" in s:
        x, y = s.split("/")
        return int(x) / int(y)
    return float(s.replace(",", "."))


def fix_line(s, unknown=None):
    """Bestehende recipeIngredient-Zeile → einheitliche Zeile (idempotent)."""
    m = re.match(r"^(?P<k>[^(,]+?) \((?P<spec>.+)\)$", s)
    if m and m.group("k") in KEYS:
        return s
    m = LINE.match(s)
    if m:
        a = _f(m.group("a"))
        a2 = _f(m.group("a2")) if m.group("a2") else None
        unit = m.group("u")
        if m.group("adj") and unit:
            unit = m.group("adj") + " " + unit
        name = m.group("n")
    else:
        a = a2 = unit = None
        name = s
    if parse_name(name)["skip"]:
        return None
    lines = recipe_lines([{"a": a, "a2": a2, "u": unit, "n": name}], unknown)
    return lines[0] if lines else s


def _flat(q):
    q = re.sub(r"\s*\(\s*", ", ", q or "").replace(")", "")
    q = re.sub(r"\s+,", ",", re.sub(r"\s+", " ", q))
    return re.sub(r",(\s*,)+", ",", q).strip(" ,")


def normalize_shopping(shopping, unknown=None):
    """Einkaufsliste: Namen wie die Bring-Kachel, Hinweise in die Menge, gleiche Artikel je Gruppe zusammenfassen."""
    for g in shopping["groups"] + [shopping["metzger"]]:
        merged, order = {}, []
        for it in g["items"]:
            info = parse_name(it["n"])
            if not info["known"]:
                if not it.get("have") and unknown is not None:
                    unknown.add(it["n"])
                key = it["n"]
                new = dict(it)
            else:
                key = info["key"]
                q = ", ".join(x for x in [_flat(it.get("q"))] + info["zusatz"] if x)
                new = dict(it, n=info["anzeige"], b=info["key"])
                if q:
                    new["q"] = q
            k = (key, bool(it.get("have")))
            if k in merged:
                m = merged[k]
                if new.get("q"):
                    m["q"] = (m["q"] + " + " if m.get("q") else "") + new["q"]
                if new.get("for"):
                    days = [d.strip() for d in (m.get("for", "") + " · " + new["for"]).split("·") if d.strip()]
                    m["for"] = " · ".join(dict.fromkeys(days))
            else:
                merged[k] = new
                order.append(k)
        g["items"] = [merged[k] for k in order]
    return shopping


def shopping_lines(items):
    out = []
    for it in items:
        if it.get("have"):
            continue
        key = it.get("b") or parse_name(it["n"])["key"]
        q = _flat(it.get("q"))
        out.append(key + (f" ({q})" if q else ""))
    return out


def slugify(t):
    t = t.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss").replace("&", " und ")
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def short_url(title):
    """Kurze Import-Adresse: Bring lehnt Rezeptadressen ab etwa 100 Zeichen ab (getestet 8.11.2026)."""
    import hashlib
    s = slugify(title)
    head = s[:24]
    if len(s) > 24 and "-" in head:
        head = head.rsplit("-", 1)[0]
    return f"{SITE}b/{head}-{hashlib.sha1(s.encode()).hexdigest()[:4]}.html"


def write_aliases():
    """Legt für jede Rezeptseite unter b/ eine kurze Import-Seite an und setzt den Bring-Knopf der Rezeptseite darauf."""
    import html as _h
    out = ROOT / "b"
    out.mkdir(exist_ok=True)
    keep = set()
    for f in sorted((ROOT / "rezepte").glob("*.html")):
        h = f.read_text(encoding="utf-8")
        m = re.search(r'<script type="application/ld\+json">(.*?)</script>', h, re.S)
        if not m:
            continue
        ld = json.loads(m.group(1))
        if ld.get("@type") != "Recipe":
            continue
        su = short_url(ld["name"])
        name = su.rsplit("/", 1)[1]
        keep.add(name)
        try:
            base = int(re.match(r"\d+", str(ld.get("recipeYield", "1"))).group(0))
        except Exception:
            base = 1
        page = SITE + "rezepte/" + f.name
        ld_json = json.dumps(ld, ensure_ascii=False, indent=1).replace("</", "<\\/")
        (out / name).write_text(f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>{_h.escape(ld["name"])}</title>
<script type="application/ld+json">
{ld_json}
</script>
<link rel="stylesheet" href="../rezepte/style.css">
</head>
<body>
<main>
<h1>{_h.escape(ld["name"])}</h1>
<p class="meta">Kurzadresse für den Bring-Import.</p>
<p><a class="bring" href="../rezepte/{f.name}">Zum Rezept</a></p>
</main>
</body>
</html>
""", encoding="utf-8")
        new_h = re.sub(r'(<a class="bring" href=")[^"]*(")', lambda mm: mm.group(1) + _h.escape(deeplink(su, base)) + mm.group(2), h, count=1)
        if new_h != h:
            f.write_text(new_h, encoding="utf-8")
    for old in out.glob("*.html"):
        if old.name not in keep:
            old.unlink()
    return len(keep)


def einkauf_urls(plan):
    w = plan["week"]
    base = f"{SITE}einkauf/kw{w['kw']}-{w['year']}"
    return {"super": base + "-supermarkt.html", "metzger": base + "-metzger.html"}


def deeplink(url, base=1, req=None):
    import urllib.parse
    return ("https://api.getbring.com/rest/bringrecipes/deeplink?url=" + urllib.parse.quote(url, safe="")
            + f"&source=web&baseQuantity={base}&requestedQuantity={req or base}")


def annotate_plan(plan, unknown):
    for r in plan["recipes"].values():
        for i in r["ingredients"]:
            if i.get("v"):
                continue
            info = parse_name(i["n"])
            if info["skip"]:
                i["v"] = True
                continue
            if not info["known"]:
                unknown.add(i["n"])
            i["b"] = info["anzeige"]
    normalize_shopping(plan["shopping"], unknown)
    for r in plan["recipes"].values():
        r["bringUrl"] = short_url(r["title"])
    plan.setdefault("bring", {})["einkauf"] = einkauf_urls(plan)
    return plan


def _report(unknown):
    if unknown:
        print("FEHLT IN tools/bring_namen.json (bitte eintragen, Bring-Katalogname verwenden):")
        for u in sorted(unknown):
            print("  -", u)
        return 1
    print("Bring-Namen: alles eindeutig.")
    return 0


def main(argv):
    if len(argv) >= 2 and argv[0] == "zeile":
        u = set()
        print(fix_line(argv[1], u), "  (unbekannt)" if u else "")
        return 0
    if len(argv) >= 2 and argv[0] == "plan":
        p = pathlib.Path(argv[1])
        plan = json.loads(p.read_text(encoding="utf-8"))
        unknown = set()
        annotate_plan(plan, unknown)
        if "--write" in argv:
            p.write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding="utf-8")
            print("Plan aktualisiert:", p)
        return _report(unknown)
    if argv and argv[0] == "seiten":
        fix = "--fix" in argv
        unknown, changed = set(), 0
        files = sorted(ROOT.glob("*.html")) + sorted((ROOT / "rezepte").glob("*.html")) + sorted((ROOT / "einkauf").glob("*.html"))
        for f in files:
            h = f.read_text(encoding="utf-8")
            new_h = h
            for m in re.finditer(r'(<script type="application/ld\+json">)(.*?)(</script>)', h, re.S):
                raw = m.group(2)
                try:
                    d = json.loads(raw)
                except Exception:
                    continue
                recs = d if isinstance(d, list) else [d]
                hit = False
                for rec in recs:
                    if rec.get("@type") != "Recipe" or "recipeIngredient" not in rec:
                        continue
                    new = [fix_line(s, unknown) for s in rec["recipeIngredient"]]
                    for a, b in zip(rec["recipeIngredient"], new):
                        if b is None:
                            print(f"{f.relative_to(ROOT)}: {a!r} entfernt (Vorrat)")
                    new = list(dict.fromkeys(x for x in new if x))
                    if new != rec["recipeIngredient"]:
                        for a in rec["recipeIngredient"]:
                            b = fix_line(a)
                            if b and a != b:
                                print(f"{f.relative_to(ROOT)}: {a!r} → {b!r}")
                        rec["recipeIngredient"] = new
                        hit = True
                if hit:
                    changed += 1
                    lead = raw[:len(raw) - len(raw.lstrip())]
                    trail = raw[len(raw.rstrip()):]
                    dumped = json.dumps(d, ensure_ascii=False, indent=2) if "\n" in raw.strip() else json.dumps(d, ensure_ascii=False)
                    if "\n" in raw.strip():
                        ind = re.match(r"\n?([ \t]*)", raw).group(1)
                        dumped = "\n".join(ind + l for l in dumped.split("\n"))
                        dumped = dumped.lstrip()
                    new_h = new_h.replace(m.group(0), m.group(1) + lead + dumped + trail + m.group(3), 1)
            if fix and new_h != h:
                f.write_text(new_h, encoding="utf-8")
        print(f"{changed} Seite(n) {'korrigiert' if fix else 'mit Abweichungen'}.")
        if fix:
            print(f"{write_aliases()} kurze Import-Adressen unter b/ aktualisiert.")
        return _report(unknown)
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
