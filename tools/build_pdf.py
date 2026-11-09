#!/usr/bin/env python3
"""Druckfassung eines Wochenplans als PDF (HTML -> PDF über Chrome/Playwright).

Aufruf:  python3 tools/build_pdf.py plan.json ausgabe.pdf [--hide VORNAME]
Benötigt: playwright (pip) und Google Chrome oder Playwright-Chromium.
"""
import argparse
import asyncio
import html
import json
import os
import pathlib
import re
import urllib.parse

DEV = {"tm": "TM31", "ofen": "Ofen", "hlf": "Heißluftfritteuse", "herd": "Herd"}
e = html.escape


def slugify(t):
    t = t.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss").replace("&", " und ")
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def num(v):
    w = int(v)
    f = round(v - w, 2)
    frac = {0.5: "½", 0.25: "¼", 0.75: "¾"}.get(f)
    if f and not frac:
        return str(round(v, 2)).replace(".", ",")
    return (str(w) if w else "") + (frac or "") or "0"


def qty(i):
    if i.get("a") is None:
        return ""
    s = num(i["a"])
    if i.get("a2") is not None:
        s += "–" + num(i["a2"])
    return s + (" " + i["u"] if i.get("u") else "")


def abend_checkliste(plan):
    """Abend-Checkliste zum Abhaken: was für den nächsten Tag aufgetaut, eingeweicht oder bereitgestellt werden muss.

    Inhalt aus plan["checklist"] = {"title", "intro", "evenings": [{"day", "for", "tag"?, "items": [...], "note"?}]}.
    Fehlt der Block, werden die „Abends: …“-Erinnerungen der Tage verwendet.
    """
    c = plan.get("checklist")
    if not c:
        days = plan.get("days", [])
        nxt = {i: days[i + 1]["name"] for i in range(len(days) - 1)}
        ev = []
        for i, d in enumerate(days):
            items = [re.sub(r"^Abends(\s+[^:]*)?:\s*", "", x) for x in d.get("reminders", []) if x.startswith("Abends")]
            if items:
                ev.append({"day": d["name"] + "abend", "for": "für " + nxt.get(i, "morgen"), "items": items})
        if not ev:
            return ""
        c = {"title": "Abend-Checkliste", "intro": "Jeden Abend kurz abhaken, ob für morgen alles vorbereitet ist.", "evenings": ev}
    cards = ""
    for ev in c["evenings"]:
        tag = ev.get("tag", "")
        items = "".join(f'<li><span class="cb"></span><span>{e(x)}</span></li>' for x in ev["items"])
        note = f'<p class="small" style="margin-top:1.5mm">{e(ev["note"])}</p>' if ev.get("note") else ""
        cards += (f'<div class="eve {"iron" if "Eisen" in tag else ""}"><h3><span>{e(ev["day"])} <span class="for">{e(ev.get("for", ""))}</span></span>'
                  f'{f"<span class=tag>{e(tag)}</span>" if tag else ""}</h3><ul class="tick">{items}</ul>{note}</div>')
    return (f'<div class="page"><h2>{e(c.get("title", "Abend-Checkliste"))}</h2>'
            f'<p class="lead">{e(c.get("intro", ""))}</p><div class="checks">{cards}</div></div>')


def build_html(plan):
    base = plan["bring"]["publicBase"]
    site = base.rsplit("rezepte/", 1)[0]

    def links(r):
        page = base + slugify(r["title"]) + ".html"
        bring = ("https://api.getbring.com/rest/bringrecipes/deeplink?url=" + urllib.parse.quote(r.get("bringUrl") or page, safe="")
                 + f"&source=web&baseQuantity={r['base']}&requestedQuantity={r['base']}")
        return page, bring

    def recipe(rid, label, note=""):
        r = plan["recipes"][rid]
        page, bring = links(r)
        ing = "".join(f'<tr><td class="q">{e(qty(i))}</td><td>{e(i["n"])}{" <span class=v>Vorrat</span>" if i.get("v") else ""}</td></tr>' for i in r["ingredients"])
        prep = "".join(f"<li>{e(p)}</li>" for p in r.get("prep", []))
        steps = "".join(
            f'<li><span>{e(s["t"])}</span>' + (f'<span class="set"><b>{e(DEV.get(s["dev"], s["dev"]))}</b>{e(s["set"])}</span>' if s.get("dev") else "") + "</li>"
            for s in r["steps"])
        kind = "haupt" if "Haupt" in label else ""
        return f"""
<section class="recipe {kind}">
  <p class="slot">{e(label)}</p>
  <h3>{e(r['title'])}</h3>
  <p class="meta">{r['base']} Portionen · gesamt {r['time']['total']} Min. · aktiv {r['time']['active']} Min. · {e(' · '.join(r.get('tags', [])))}</p>
  {f'<p class="note">{e(note)}</p>' if note else ''}
  {f'<p class="note">{e(r["swap"])}</p>' if r.get("swap") else ''}
  <p class="links"><a class="bring" href="{e(bring)}">In Bring übernehmen</a><a class="web" href="{e(page)}">Rezept online öffnen</a></p>
  <div class="cols">
    <div><h4>Zutaten</h4><table class="ing">{ing}</table><p class="small">{e(r.get('servingsNote', ''))}</p></div>
    <div>{'<h4>Vorbereiten &amp; Schnippeln</h4><ul>' + prep + '</ul>' if prep else ''}<h4>Zubereitung</h4><ol class="steps">{steps}</ol></div>
  </div>
  <div class="boxes">
    {f'<div class="box kid"><h4>Fürs Kind</h4><p>{e(r["anton"])}</p></div>' if r.get('anton') else ''}
    {f'<div class="box"><h4>Aufbewahren &amp; Varianten</h4><p>{e(r["store"])}</p></div>' if r.get('store') else ''}
  </div>
</section>"""

    w = plan["week"]
    rows = ""
    order = []
    for d in plan["days"]:
        cells = {}
        for m in d["meals"]:
            r = plan["recipes"][m["recipe"]]
            if m["recipe"] not in order:
                order.append(m["recipe"])
            t = e(r["title"]) + (" <span class='small'>(Reste)</span>" if m.get("mode") == "aufwaermen" and m.get("badge") == "Reste" else "")
            cells[m["slot"]] = f"<b>{t}</b>" if m["kind"] == "haupt" else t
        tags = [t for m in d["meals"] for t in plan["recipes"][m["recipe"]].get("tags", [])]
        kind = "Fleisch" if "Fleisch" in tags else ("Fisch" if "Fisch" in tags else "vegetarisch")
        rows += f"<tr><td><b>{e(d['name'])}</b><br><span class='small'>{e(d['date'])} · {e(d['place'])}</span></td><td>{cells.get('Mittag', '')}</td><td>{cells.get('Abend', '')}</td><td>{kind}</td></tr>"
    for rid in plan.get("prep", {}).get("recipes", []) + plan.get("extras", []):
        if rid not in order:
            order.append(rid)
    _ek = plan.get("bring", {}).get("einkauf")
    _dl = lambda u: "https://api.getbring.com/rest/bringrecipes/deeplink?url=" + urllib.parse.quote(u, safe="") + "&source=web&baseQuantity=1&requestedQuantity=1"
    ek_links = (f' <b>Ganze Liste in Bring:</b> <a href="{e(_dl(_ek["super"]))}">Supermarkt</a> · <a href="{e(_dl(_ek["metzger"]))}">Metzger</a> – jeder Artikel auf seiner festen Kachel.') if _ek else ""
    link_rows = ""
    for rid in order:
        r = plan["recipes"][rid]
        page, bring = links(r)
        tag = " <span class=v>Ersatz</span>" if rid in plan.get("extras", []) else ""
        link_rows += f'<tr><td>{e(r["title"])}{tag}</td><td><a href="{e(bring)}">Bring</a></td><td><a href="{e(page)}">online</a></td></tr>'

    shop = ""
    for g in [plan["shopping"]["metzger"]] + plan["shopping"]["groups"]:
        items = "".join(f'<li><span class="cb"></span><span class="n">{e(i["n"])}</span><span class="q">{e(i.get("q") or "")}</span></li>' for i in g["items"])
        note = ""
        if g["name"] == "Metzger" and g.get("note"):
            note = f"<p class=small>{e(g['note'])}</p>"
        elif g["name"].startswith("Vorrat"):
            note = "<p class=small>Kurz prüfen, ob noch genug da ist.</p>"
        shop += f'<div class="group {"metzger" if g["name"] == "Metzger" else ""}"><h4>{e(g["name"])}</h4>{note}<ul class="shop">{items}</ul></div>'

    p = plan["prep"]
    timeline = "".join(f"<tr><td class='t'>{e(t['t'])}</td><td>{e(t['text'])}</td></tr>" for t in p["timeline"])
    storage = "".join(f"<tr><td>{e(s['what'])}</td><td>{e(s['where'])}</td><td>{e(s['until'])}</td></tr>" for s in p["storage"])

    days_html = ""
    for d in plan["days"]:
        rem = "".join(f"<li>{e(x)}</li>" for x in d.get("reminders", []))
        body = ""
        for m in d["meals"]:
            label = f"{m['slot']} · {'Hauptmahlzeit' if m['kind'] == 'haupt' else 'leichte Mahlzeit'}"
            if m.get("mode") == "aufwaermen":
                r = plan["recipes"][m["recipe"]]
                body += f'<section class="recipe compact"><p class="slot">{e(label)}</p><h3>{e(r["title"])}</h3><p class="note">{e(m.get("note", ""))}</p></section>'
            else:
                body += recipe(m["recipe"], label, m.get("note", ""))
        days_html += f'<div class="day"><h2>{e(d["name"])}, {e(d["date"])} <span class="small">· {e(d["place"])} · Hauptmahlzeit: {e(d["main"])}</span></h2>{f"<div class=rem><h4>Nicht vergessen</h4><ul>{rem}</ul></div>" if rem else ""}{body}</div>'

    checklist_html = abend_checkliste(plan)
    extras_html = "".join(recipe(rid, "Ersatzgericht") for rid in plan.get("extras", []))
    infos = "".join(f'<div class="panel"><h4>{e(i["title"])}</h4><ul>{"".join(f"<li>{e(x)}</li>" for x in i["items"])}</ul></div>' for i in plan.get("infos", []))
    notice = f'<div class="panel p"><b>Diese Woche:</b> {e(plan["notice"])}</div>' if plan.get("notice") else ""

    return f"""<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Speiseplan KW {w['kw']}</title>
<style>
@page {{ size: A4; }}
:root {{ --ink:#16302A; --muted:#566A63; --line:#D5DDD6; --accent:#0D6657; --soft:#DFEEE8; --psoft:#FBE8D6; --paper:#F2F5F0; --pumpkin:#D8691A; }}
* {{ box-sizing:border-box; }}
body {{ font-family: Inter, "DejaVu Sans", sans-serif; color:var(--ink); font-size:9.6pt; line-height:1.42; margin:0; }}
h1 {{ font-size:24pt; margin:0 0 2mm; }}
h2 {{ font-size:15pt; margin:0 0 3mm; padding-bottom:2mm; border-bottom:2px solid var(--ink); }}
h3 {{ font-size:13pt; margin:0 0 1mm; }}
h4 {{ font-size:7.5pt; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin:3mm 0 1.5mm; }}
a {{ color:var(--accent); }}
.small {{ font-size:8pt; color:var(--muted); font-weight:400; }}
.kw {{ color:var(--muted); font-size:10pt; margin:0 0 5mm; }}
.lead {{ max-width:170mm; margin:0 0 4mm; }}
table {{ border-collapse:collapse; width:100%; }}
.week td, .week th, .tl td, .st td, .st th, .lk td, .lk th {{ border-bottom:1px solid var(--line); padding:2mm; text-align:left; vertical-align:top; }}
th {{ font-size:7.5pt; text-transform:uppercase; letter-spacing:.07em; color:var(--muted); }}
.panel {{ background:var(--paper); border-radius:3mm; padding:3mm 4mm; margin:4mm 0; break-inside:avoid; }}
.panel.p {{ background:var(--psoft); }}
.two {{ display:grid; grid-template-columns:1fr 1fr; gap:4mm; }}
ul, ol {{ margin:0; padding-left:5mm; }} li {{ margin-bottom:1mm; }}
.page, .day {{ break-before:page; }}
.rem {{ border:1px dashed var(--pumpkin); border-radius:3mm; padding:1mm 4mm 2mm; margin-bottom:4mm; }}
.recipe {{ border:1px solid var(--line); border-radius:3mm; padding:4mm 5mm; margin-bottom:5mm; }}
.recipe.haupt {{ border-top:4px solid var(--pumpkin); }}
.recipe.compact {{ break-inside:avoid; }}
.slot {{ font-size:7.5pt; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin:0 0 1mm; }}
.recipe.haupt .slot {{ color:#8F430B; }}
.meta {{ color:var(--muted); font-size:8.5pt; margin:0 0 2mm; }}
.note {{ background:var(--soft); border-radius:2mm; padding:1.5mm 3mm; font-weight:600; margin:0 0 2mm; }}
.links {{ margin:2mm 0 1mm; display:flex; gap:3mm; }}
.links a {{ display:inline-block; padding:1.8mm 4mm; border-radius:2mm; font-weight:700; text-decoration:none; }}
.links .bring {{ background:var(--accent); color:#fff; }} .links .web {{ border:1px solid var(--accent); }}
.cols {{ display:grid; grid-template-columns:62mm 1fr; gap:6mm; }}
.ing td {{ padding:1mm 0; border-bottom:1px dashed var(--line); vertical-align:top; }}
.ing .q {{ text-align:right; font-weight:700; white-space:nowrap; padding-right:3mm; width:19mm; }}
.v {{ font-size:7pt; color:var(--muted); border:1px solid var(--line); border-radius:2mm; padding:0 1.5mm; margin-left:1mm; }}
.steps li {{ margin-bottom:2mm; break-inside:avoid; }} .steps li span:first-child {{ display:block; }}
.set {{ display:inline-block; margin-top:1mm; background:#17261F; color:#EAF5EF; border-radius:1.5mm; font-family:"DejaVu Sans Mono", monospace; font-size:8pt; padding:.6mm 2mm; }}
.set b {{ color:#5CC2AE; margin-right:2mm; }}
.boxes {{ display:grid; grid-template-columns:1fr 1fr; gap:3mm; margin-top:3mm; break-inside:avoid; }}
.box {{ background:var(--paper); border-radius:2mm; padding:1mm 3mm 2mm; }} .box.kid {{ background:var(--soft); }}
.box h4 {{ margin-top:1.5mm; }} .box p {{ margin:0; }}
.shopwrap {{ columns:2; column-gap:6mm; }} .group {{ break-inside:avoid; margin-bottom:4mm; }}
.group.metzger h4 {{ color:#9E3632; }}
.shop {{ list-style:none; padding:0; }}
.shop li {{ display:grid; grid-template-columns:4mm 1fr auto; gap:2mm; align-items:center; border-bottom:1px dashed var(--line); padding:.8mm 0; margin:0; }}
.cb {{ width:3mm; height:3mm; border:1px solid var(--muted); border-radius:.6mm; }}
.shop .q {{ color:var(--muted); white-space:nowrap; }}
.tl .t {{ font-family:"DejaVu Sans Mono", monospace; color:#8F430B; white-space:nowrap; width:18mm; }}
.lk td:nth-child(2), .lk td:nth-child(3) {{ width:18mm; white-space:nowrap; }}
.checks {{ display:grid; grid-template-columns:1fr 1fr; gap:4mm; }}
.eve {{ border:1px solid var(--line); border-radius:3mm; padding:3mm 4mm; break-inside:avoid; }}
.eve.iron {{ border:1.5px solid var(--pumpkin); }}
.eve h3 {{ font-size:12pt; display:flex; justify-content:space-between; align-items:baseline; gap:2mm; }}
.eve .for {{ font-size:8.5pt; color:var(--muted); font-weight:400; }}
.eve .tag {{ font-size:7pt; font-weight:700; text-transform:uppercase; letter-spacing:.06em; background:var(--soft); color:var(--accent); border-radius:2mm; padding:.4mm 2mm; white-space:nowrap; }}
.eve.iron .tag {{ background:var(--psoft); color:#8F430B; }}
.tick {{ list-style:none; padding:0; margin:2mm 0 0; }}
.tick li {{ display:grid; grid-template-columns:6mm 1fr; gap:2mm; align-items:start; padding:1.6mm 0; border-bottom:1px dashed var(--line); margin:0; }}
.tick li:last-child {{ border-bottom:0; }}
.tick .cb {{ width:4.2mm; height:4.2mm; border:1.3px solid var(--ink); border-radius:.8mm; margin-top:.2mm; }}
</style></head><body>
<h1>Speiseplan KW {w['kw']}</h1>
<p class="kw">{e(w['label'])} · Thermomix-Angaben für den TM31</p>
<p class="lead">Jedes Rezept hat zwei Links: <b>In Bring übernehmen</b> öffnet die Bring-App mit allen Zutaten. Die Portionszahl lässt sich dort anpassen, Vorratsartikel wie Salz und Öl sind nicht dabei. <b>Rezept online öffnen</b> zeigt das Rezept im Browser.</p>
<table class="week"><thead><tr><th>Tag</th><th>Mittag</th><th>Abend</th><th></th></tr></thead><tbody>{rows}</tbody></table>
<p class="small">Fett = Hauptmahlzeit des Tages.</p>
{notice}
<div class="two">{infos}</div>
{checklist_html}
<div class="page"><h2>Alle Links auf einen Blick</h2><p class="lead">Rezeptsammlung im Browser: <a href="{e(site)}">{e(site)}</a></p>
<table class="lk"><thead><tr><th>Rezept</th><th>Bring</th><th>Online</th></tr></thead><tbody>{link_rows}</tbody></table></div>
<div class="page"><h2>Einkaufsliste</h2><p class="lead">Alle Mengen der Woche, schon zusammengerechnet. Die Zutaten der Ersatzgerichte stehen nicht auf dieser Liste. Fleisch kommt vom Metzger.{ek_links}</p><div class="shopwrap">{shop}</div></div>
<div class="page"><h2>{e(p['title'])} <span class="small">· {e(p['when'])}</span></h2><p class="lead">{e(p['intro'])}</p>
<table class="tl">{timeline}</table><h4>Was hält wie lange</h4>
<table class="st"><thead><tr><th>Was</th><th>Wo</th><th>Haltbar / Auftauen</th></tr></thead><tbody>{storage}</tbody></table>
<div style="margin-top:5mm">{''.join(recipe(rid, 'Vorkochen', p.get('recipeNote', '')) for rid in p.get('recipes', []))}</div></div>
{days_html}
<div class="day"><h2>Ersatzgerichte</h2><p class="lead">{e(plan.get('extrasIntro', ''))}</p>{extras_html}</div>
</body></html>"""


def anonymize(doc, names):
    for name in names:
        for a, b in [("+ " + name, "+ Kind"), (name + "s Portion", "Kinderportion"), (name + "s Teller", "Kinderteller"),
                     ("Für " + name, "Fürs Kind"), ("für " + name, "fürs Kind"), (name, "das Kind")]:
            doc = doc.replace(a, b)
        assert name not in doc
    return doc


async def render(html_path, out, kw):
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        kwargs = {"args": ["--no-sandbox"]}
        if os.path.exists("/usr/bin/google-chrome"):
            kwargs["executable_path"] = "/usr/bin/google-chrome"
        b = await pw.chromium.launch(**kwargs)
        pg = await b.new_page()
        await pg.goto(html_path.as_uri())
        await pg.pdf(path=str(out), format="A4", print_background=True, display_header_footer=True,
                     header_template="<span></span>",
                     footer_template=f'<div style="font-size:7pt;color:#566A63;width:100%;text-align:center;font-family:Inter,sans-serif">Speiseplan KW {kw} · Seite <span class="pageNumber"></span> von <span class="totalPages"></span></div>',
                     margin={"top": "14mm", "bottom": "16mm", "left": "13mm", "right": "13mm"})
        await b.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("plan")
    ap.add_argument("out")
    ap.add_argument("--hide", action="append", default=[])
    a = ap.parse_args()
    plan = json.loads(pathlib.Path(a.plan).read_text(encoding="utf-8"))
    doc = anonymize(build_html(plan), a.hide)
    out = pathlib.Path(a.out).resolve()
    html_path = out.with_suffix(".html")
    html_path.write_text(doc, encoding="utf-8")
    asyncio.run(render(html_path, out, plan["week"]["kw"]))
    html_path.unlink()
    print("PDF geschrieben:", out)


if __name__ == "__main__":
    main()
