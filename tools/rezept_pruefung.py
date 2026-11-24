#!/usr/bin/env python3
"""Rezept-Prüfung vor der Freigabe: findet typische Fehler, bevor ein Rezept in Plan, App und PDF landet.

Aufruf:
  python3 tools/rezept_pruefung.py plan.json                 # alle Rezepte eines Wochenplans (recipes)
  python3 tools/rezept_pruefung.py app/daten/rezepte/*.json  # einzelne Rezeptdateien der Sammlung
  python3 tools/rezept_pruefung.py --etiketten app/daten/wochen/kw48-2026.json
      # Sichtprüfung: zeigt jeden Schritt so, wie der Kochmodus der App ihn mit Mengen-Etiketten anzeigt
      # (braucht playwright + chromium wie tools/smoke_test.py)

Geprüft wird (FEHLER = nicht freigeben, WARNUNG = ansehen und beheben oder bewusst so lassen):
  - Zutaten mit gleichem Namen (z. B. zweimal Wasser, zweimal Milch) brauchen in Klammern, wofür sie sind,
    und die Schritte müssen das auch sagen („Wasser für die Soße“) – sonst landet die falsche Menge im Topf
  - Zutaten mit Menge, die in keinem Schritt vorkommen; Mengen im Schritttext, die nicht zur Zutatenliste passen
  - TM31-Grenzen: nur 37–100 °C oder Varoma (kein 120 °C, keine TM6-Modi wie Anbraten), höchstens 60 Min.
    am Stück, Rühraufsatz höchstens Stufe 4, Mixtopf höchstens 2 l
  - Dampfgaren (Varoma, Garkörbchen) mit weniger als 500 g Flüssigkeit im Mixtopf
  - Nudeln/Reis, die mit kalter Flüssigkeit starten und nur ihre Packungszeit bekommen (bleiben hart)
  - Kartoffeln: Garzeit zu knapp oder keine Gabelprobe
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

STUECK_G = {  # grobe Gewichte für Stückzutaten (für die Füllmenge im Mixtopf)
    "zwiebel": 80, "knoblauch": 5, "lauch": 200, "porree": 200, "karotte": 80, "möhre": 80, "apfel": 150,
    "äpfel": 150, "tomate": 80, "paprika": 150, "zucchini": 250, "frühlingszwiebel": 20, "ei": 55, "eier": 55,
    "kartoffel": 100, "zitrone": 0, "gurke": 0,
}
FLUESSIG = re.compile(r"wasser|brühe|milch|sahne|passata|passierte|tomaten|pelati|polpa|wein|saft", re.I)
PASTA = re.compile(r"nudeln|pasta|penne|farfalle|spaghetti|fusilli|makkaroni|tagliatelle|spätzle|reis\b|risotto|orzo|tortellini|gnocchi", re.I)
QUAL_STOP = set("für fürs zum zur der die das den dem des und oder mit von vom im in am an auf aus bei nach etwa ca gut sehr".split())
TM6_MODI = re.compile(r"anbraten|dampfgaren|sous.?vide|fermentieren|langsamgaren|hochtemperatur|turbo-?modus|\b(105|110|115|120|130|140|150|160)\s*°", re.I)


def steps_of(r):
    return [(i + 1, s.get("t", ""), s.get("dev", ""), s.get("set", "")) for i, s in enumerate(r.get("steps", []))]


def head_noun(n):
    """Eigentlicher Zutatenname: erstes großgeschriebenes Wort vor Klammer und Komma (Wasser, Milch, Kartoffeln)."""
    base = re.sub(r"\(.*?\)", " ", n or "").split(",")[0]
    words = [w for w in re.split(r"[\s/]+", base) if w]
    caps = [w for w in words if re.match(r"^[A-ZÄÖÜ]", w)]
    w = (caps[-1] if caps else (words[-1] if words else "")).lower()
    w = re.sub(r"[^a-zäöüß-]", "", w).split("-")[-1]
    for suf in ("en", "n", "e", "s"):
        if len(w) > 4 and w.endswith(suf):
            return w[: -len(suf)]
    return w


def quals(n):
    par = " ".join(re.findall(r"\(([^)]*)\)", n or ""))
    out = set()
    for w in re.split(r"[^a-zäöüß]+", par.lower()):
        if len(w) >= 4 and w not in QUAL_STOP:
            out.add(w[:-1] if len(w) > 5 and w[-1] in "ens" else w)
    return out


def grams(ing):
    a, u = ing.get("a"), (ing.get("u") or "")
    if a is None:
        return 0
    if u in ("g", "ml"):
        return a
    if u in ("kg", "l"):
        return a * 1000
    if u == "EL":
        return a * 15
    if u == "TL":
        return a * 5
    if u == "Stange":
        return a * 200
    if not u:
        hn = head_noun(ing.get("n", ""))
        for k, g in STUECK_G.items():
            if hn.startswith(k[:5]):
                return a * g
        return a * 50
    return 0


HEADS = ["öl", "brühe", "stärke", "nudeln", "sahne", "milch", "mehl", "zucker", "essig", "saft", "mark", "pulver", "senf",
         "butter", "quark", "salz", "pfeffer", "tomaten", "reis", "salat", "fleisch", "streusel", "filet", "brust", "käse", "lende"]


ADJ_STOP = set("oder bunte bunt frische frisch gemischt kleine klein kleines kleiner große groß großes festkochende festkochend mehligkochend mehligkochende vorwiegend junge jung rote rot gelbe gelb grüne grün braune braun weiße weiß dünn dünne geschnitten gehackt gemahlen getrocknet gerieben tk natur mild milde salzarm".split())


def name_words(ing):
    base = re.sub(r"\(.*?\)", " ", ing.get("n", "") or "").split(",")[0] + " " + (ing.get("b") or "")
    out = set()
    for w0 in re.split(r"[\s/]+", base):
        for w in w0.split("-"):
            w = re.sub(r"[^a-zäöüß]", "", w.lower())
            if not w or w in QUAL_STOP or w in ADJ_STOP:
                continue
            out.add(w[:-1] if len(w) > 4 and w[-1] in "ens" else w)
            for h in HEADS:
                if w.endswith(h) and w != h:
                    out.add(h)
            if len(w) >= 8:
                out.add(w[:6])  # Hähnchenbrust → hähnch, Lorbeerblätter → lorbee
    return out


def mentions(text, ing, strict=False):
    t = " " + text.lower() + " "
    words = name_words(ing)
    if strict:  # nur der eigene Name, keine abgeleiteten Wortteile (sonst wäre „Käse“ auch der Raclettekäse)
        base = re.sub(r"\(.*?\)", " ", ing.get("n", "") or "").split(",")[0]
        own = {re.sub(r"[^a-zäöüß]", "", w.lower()) for w in re.split(r"[\s/-]+", base)}
        words = {w for w in words if any(o.startswith(w) and len(w) >= len(o) - 2 for o in own if o)}
    for w in words:
        if len(w) <= 2:
            if re.search(r"[\s(,]" + re.escape(w) + r"[\s,.)]", t):
                return True
        elif re.search(r"(?<![a-zäöüß])" + re.escape(w), t):  # am Wortanfang: „klein“ steckt nicht in „zerkleinern“
            return True
    if "metzger" in (ing.get("n") or "").lower() and "fleisch" in t:
        return True
    return False


def pick(ings, cand, text):
    """wie die App: bei gleichnamigen Zutaten die mit passendem Zweck, sonst die ohne Zweck"""
    if len(cand) == 1:
        return cand[0]
    low = text.lower()
    hit = [i for i in cand if quals(ings[i]["n"]) and any(q in low for q in quals(ings[i]["n"]))]
    if len(hit) == 1:
        return hit[0]
    plain = [i for i in cand if not quals(ings[i]["n"])]
    return plain[0] if len(plain) == 1 else None


def check(rid, r):
    errs, warns = [], []
    ings = r.get("ingredients", [])
    steps = steps_of(r)
    alltext = " ".join(r.get("prep", []) or []) + " " + " ".join(t for _, t, _, _ in steps)

    # 1) gleiche Zutat mehrfach
    groups = {}
    for i, ing in enumerate(ings):
        if ing.get("a") is None:
            continue
        groups.setdefault(head_noun(ing["n"]), []).append(i)
    for hn, idx in groups.items():
        if len(idx) < 2 or not hn:
            continue
        names = [ings[i]["n"] for i in idx]
        qs = [quals(ings[i]["n"]) for i in idx]
        unq = [n for n, q in zip(names, qs) if not q]
        if len(unq) > 1:
            (errs if any(ings[i].get("u") in ("g", "ml", "kg", "l") for i in idx) else warns).append(f"{len(idx)}× „{hn}“ in der Zutatenliste, davon {len(unq)} ohne Zweck in Klammern: {names}. "
                        "Jede Zutat bekommt „(für …)“ und die Schritte nennen den Zweck mit.")
        for n, t, _, _ in steps:
            low = t.lower()
            for m in re.finditer(r"\b" + re.escape(hn) + r"\w*", low):
                before = low[max(0, m.start() - 18):m.start()]
                if re.search(r"\d[\d,.½¼¾–-]*\s*(?:g|ml|el|tl|kg|l)?\s*(?:\w+\s+)?$", before) or re.search(r"schuss|etwas|wenig|rest|spritzer|prise", before):
                    continue
                hit = [i for i, q in zip(idx, qs) if q and any(w in low for w in q)]
                if len(hit) != 1 and not (len(unq) == 1 and not any(any(w in low for w in q) for q in qs if q)):
                    warns.append(f"Schritt {n}: „{hn}“ ist mehrdeutig ({names}). Zweck dazuschreiben, z. B. „{hn.capitalize()} für die Soße“.")
                break

    # 2) unbenutzte Zutaten
    for ing in ings:
        if ing.get("a") is not None and not mentions(alltext, ing):
            warns.append(f"Zutat „{ing['n']}“ ({ing.get('a')} {ing.get('u') or ''}) kommt in keinem Schritt vor.")

    # 3) Mengen im Text gegen die Liste
    for n, t, _, _ in steps:
        for m in re.finditer(r"(\d+)\s*(g|ml)\s+([A-ZÄÖÜ][a-zäöüß]+)", t):
            num, word = int(m.group(1)), m.group(3).lower()
            cand = [ing for ing in ings if head_noun(ing.get("n", "")) and word.startswith(head_noun(ing["n"])[:5]) and ing.get("u") in ("g", "ml")]
            if cand and all(abs(c["a"] - num) > 0.5 for c in cand):
                pre = t[max(0, m.start() - 30):m.start()].lower()
                if not re.search(r"zu dick|zu dünn|mehr|heißes|weitere|nachgießen|bei bedarf", pre + t[m.end():m.end() + 20].lower()):
                    warns.append(f"Schritt {n}: „{m.group(0)}“ passt nicht zur Zutatenliste ({', '.join(str(c['a']) + ' ' + c['u'] + ' ' + c['n'] for c in cand)}).")

    # 4) TM31-Grenzen, Füllmenge, Dampfgaren, Nudeln, Kartoffeln
    fill, liquid, potato_ok, added = 0.0, 0.0, False, set()
    done_dish = None  # ein fertiges Teilgericht (abgeschmeckt) liegt noch im Mixtopf
    has_potato = any("kartoffel" in ing.get("n", "").lower() for ing in ings)
    for n, t, dev, st in steps:
        low = t.lower()
        if dev == "tm":
            if TM6_MODI.search(st) or re.search(r"\b(98|120)\s*°", st):
                errs.append(f"Schritt {n}: „{st}“ geht am TM31 nicht (nur 37–100 °C oder Varoma, keine TM6-Modi).")
            for mm in re.finditer(r"(\d+)\s*Min", st):
                if int(mm.group(1)) > 60:
                    errs.append(f"Schritt {n}: {mm.group(1)} Min. am Stück – der TM31 kann höchstens 60 Min., in zwei Schritte teilen.")
            if "rühraufsatz" in low and re.search(r"Stufe\s*([5-9]|10)", st):
                errs.append(f"Schritt {n}: Rühraufsatz mit „{st}“ – höchstens Stufe 4.")
        if re.search(r"umfüllen|abgießen|abschütten|ausspülen|herausheben|mixtopf leeren|ausleeren", low):
            done_dish = None
        elif done_dish and dev == "tm" and re.search(r"wasser", low) and re.search(r"varoma|garkörbchen|in den mixtopf", low):
            errs.append(f"Schritt {n}: Wasser in den Mixtopf, aber dort ist noch das Ergebnis aus Schritt {done_dish} – vorher umfüllen und Mixtopf ausspülen.")
            done_dish = None
        if dev == "tm" and re.search(r"abschmecken|portion fürs kind abnehmen", low) and not re.search(r"umfüllen|servieren", low):
            done_dish = n
        counts = dev == "tm" or (not dev and "mixtopf" in low)
        if counts or re.search(r"umfüllen|abgießen|abschütten|ausspülen|herausheben|mixtopf leeren|ausleeren", low):
            parts = re.split(r"(?<=[.!?])\s+(?=[A-ZÄÖÜ])", t)
            for part in parts:
                pl = part.lower()
                rs = list(re.finditer(r"umfüllen|abgießen|abschütten|ausspülen|herausheben|mixtopf leeren|ausleeren", pl))
                if rs:
                    # Mixtopf wird geleert: zählt nur, was im selben Satz danach hineinkommt („ausspülen, 500 g Wasser einfüllen“)
                    fill, liquid, added = 0.0, 0.0, set()
                    rest = part[rs[-1].end():]
                    if not re.search(r"einfüllen|zugeben|in den mixtopf|einwiegen", rest.lower()):
                        continue
                    part, pl = rest, rest.lower()
                if not counts or re.search(r"probier|prüf|gabel", pl):
                    continue
                groups_here = {}
                for i, ing in enumerate(ings):
                    if ing.get("a") is not None and mentions(part, ing, strict=True):
                        groups_here.setdefault(head_noun(ing["n"]), []).append(i)
                for hn, cand in groups_here.items():
                    # „Wasser für die Kartoffeln“: hier sind die Kartoffeln nur der Zweck, nicht die Zutat
                    occ = [m.start() for m in re.finditer(re.escape(hn), pl)] if hn else []
                    if occ and all(re.search(r"(für die|für den|fürs|zum|zur|der|die|den)\s+$", pl[max(0, o - 12):o]) and re.search(r"(wasser|milch|brühe)\s+(für|zum)", pl[max(0, o - 30):o]) for o in occ):
                        continue
                    i = pick(ings, cand, part)
                    if i is None or i in added:
                        continue
                    ing = ings[i]
                    after = pl.split(hn, 1)[-1][:70] if hn in pl else ""
                    before_ = pl.split(hn, 1)[0][-45:] if hn in pl else ""
                    if not FLUESSIG.search(ing["n"]) and (re.search(r"varoma|einlegeboden|garkörbchen", after.split(",")[0])
                                                          or re.search(r"(garkörbchen|varoma-behälter|einlegeboden)[^,]*$", before_)):
                        continue
                    if re.search(r"(?:\d+)\s*(?:g|ml)?\s*$", pl.split(hn, 1)[0][-12:] if hn in pl else ""):
                        pass
                    added.add(i)
                    fill += grams(ing)
                    if FLUESSIG.search(ing["n"]):
                        liquid += grams(ing)
        if dev == "tm":
            steamed = re.search(r"varoma-behälter|einlegeboden|garkörbchen|varoma aufsetzen|varoma mit", low)
            if fill > 2000:
                errs.append(f"Schritt {n}: Mixtopf ca. {fill/1000:.1f} kg – der TM31 fasst höchstens 2 l. Menge verringern oder teilen.")
                fill = -1e9  # nur einmal melden
            elif fill > 1850:
                warns.append(f"Schritt {n}: Mixtopf ca. {fill/1000:.2f} kg – knapp an der 2-l-Grenze des TM31, beim Pürieren vorsichtig.")
            if steamed and "varoma" in st.lower() and 0 <= liquid < 500:
                errs.append(f"Schritt {n}: Dampfgaren mit nur ca. {int(liquid)} g Flüssigkeit im Mixtopf – der TM31 braucht mindestens 500 g, sonst kocht er trocken.")
            if PASTA.search(t) and re.search(r"wasser|brühe|passata|milch", low) and re.search(r"zugeben|in den mixtopf|geben", low):
                mins = [int(x) for x in re.findall(r"(\d+)\s*Min", st)]
                pre_boil = re.search(r"aufkochen|zum kochen|kocht bereits|sprudelnd", " ".join(tt.lower() for nn, tt, _, _ in steps if nn < n))
                if mins and max(mins) <= 16 and not pre_boil:
                    warns.append(f"Schritt {n}: Nudeln/Reis starten mit kalter Flüssigkeit und bekommen nur {max(mins)} Min. – "
                                 "der TM31 braucht ca. 5–7 Min. bis zum Kochen. Erst aufkochen, dann Packungszeit + 1 Min.")
        if has_potato and "kartoffel" in low:
            if re.search(r"gabelprobe|gabel|probieren|ganz weich|weich sein", low):
                potato_ok = True
            mins = [int(x) for x in re.findall(r"(\d+)\s*Min", st)]
            adds_potato = re.search(r"kartoffel\w*[^.]{0,60}(zugeben|in den mixtopf|garkörbchen|einhängen)|(zugeben|in den mixtopf)[^.]{0,40}kartoffel", low)
            if dev == "tm" and mins and adds_potato and not re.search(r"probier|gabel|prüf", low.split(".")[0]):
                if "garkörbchen" in low and max(mins) < 20:
                    errs.append(f"Schritt {n}: Kartoffeln im Garkörbchen nur {max(mins)} Min. – am TM31 20–30 Min. (je nach Menge und Stückgröße).")
                elif max(mins) < 15 and not re.search(r"vorgegart|gekocht", low):
                    errs.append(f"Schritt {n}: Kartoffeln nur {max(mins)} Min. – roh brauchen sie in Stücken mindestens 15–20 Min.")
    if has_potato and not potato_ok and any("kartoffel" in t.lower() for _, t, _, _ in steps):
        warns.append("Kartoffeln ohne Gabelprobe – einen Satz wie „Gabelprobe: … sonst 5 Min. weiter“ ergänzen.")
    return errs, warns


def load(paths):
    out = []
    for p in paths:
        d = json.loads(pathlib.Path(p).read_text(encoding="utf-8"))
        if "recipes" in d:
            rec = d["recipes"]
            items = rec.items() if isinstance(rec, dict) else ((r.get("id"), r) for r in rec)
            out += [(f"{pathlib.Path(p).name}:{k}", r) for k, r in items]
        else:
            out.append((pathlib.Path(p).stem, d))
    return out


def etiketten(week_file):
    """Zeigt die Schritte wie der Kochmodus der App, mit [Wort → Menge] an jeder Mengen-Stelle."""
    import functools
    import http.server
    import threading
    from playwright.sync_api import sync_playwright
    wf = pathlib.Path(week_file).resolve()
    wid = wf.stem
    w = json.loads(wf.read_text(encoding="utf-8"))
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    handler.log_message = lambda *a: None
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}/app/"
    js = """()=>[...document.querySelectorAll('.steps-list .stxt, .card .checks li[data-prep] .txt')].map(el=>{const c=el.cloneNode(true);
      c.querySelectorAll('.iq').forEach(q=>{q.replaceWith('['+q.childNodes[0].textContent+' → '+q.querySelector('b').textContent+']')});return c.textContent.trim()})"""
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"])
        ctx = b.new_context(locale="de-DE", timezone_id="Europe/Berlin")
        ctx.add_init_script("try{localStorage.setItem('kochbuddy.v1',JSON.stringify({settings:{toured:1,hintCook:1,newsSeen:[]}}))}catch(e){}")
        ctx.route("https://api.github.com/**", lambda r: r.abort())
        pg = ctx.new_page()
        for rid, r in w["recipes"].items():
            pg.goto(base + f"#/r/w:{wid}:{rid}")
            pg.wait_for_selector(".r-head")
            pg.wait_for_timeout(250)
            print(f"\n== {r['title']}")
            print("   Zutaten: " + "; ".join(f"{i.get('a') or ''} {i.get('u') or ''} {i['n']}".strip() for i in r["ingredients"]))
            for line in pg.evaluate(js):
                print("   - " + line)
        b.close()
    srv.shutdown()
    print("\nSichtprüfung: Jede [Wort → Menge] muss genau die Menge sein, die in diesem Schritt in den Topf kommt.")


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 2
    if args[0] == "--etiketten":
        etiketten(args[1])
        return 0
    total_e = total_w = 0
    for name, r in load(args):
        e, w = check(name, r)
        total_e += len(e)
        total_w += len(w)
        if e or w:
            print(f"\n{name} – {r.get('title', '')}")
            for x in e:
                print("  FEHLER   " + x)
            for x in w:
                print("  WARNUNG  " + x)
    print(f"\n{total_e} Fehler, {total_w} Warnungen.")
    print("FREIGABE: nein – Fehler beheben." if total_e else "FREIGABE möglich, wenn jede Warnung angesehen ist.")
    return 1 if total_e else 0


if __name__ == "__main__":
    sys.exit(main())
