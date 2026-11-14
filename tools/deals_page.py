import argparse, asyncio, html, json, os, pathlib, tempfile
from pypdf import PdfReader, PdfWriter
e = html.escape
CSS = """@page { size: A4; margin: 12mm 14mm 10mm; }
:root { --ink:#16302A; --muted:#566A63; --line:#D5DDD6; --accent:#0D6657; --soft:#DFEEE8; --psoft:#FBE8D6; --paper:#F2F5F0; --pumpkin:#D8691A; }
body { font-family: Inter, "DejaVu Sans", sans-serif; color:var(--ink); font-size:9.3pt; line-height:1.4; margin:0; }
h2 { font-size:15pt; margin:0 0 1.5mm; padding-bottom:2mm; border-bottom:2px solid var(--ink); }
h4 { font-size:7.5pt; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin:0 0 1.5mm; }
.sub { color:var(--muted); font-size:8.5pt; margin:0 0 3mm; }
.intro { background:var(--paper); border-radius:3mm; padding:2.5mm 4mm; margin:0 0 3mm; }
.skip { color:var(--muted); font-size:8.2pt; margin:-1.5mm 0 3mm; }
.tips { display:grid; grid-template-columns:1fr 1fr; gap:2mm 5mm; background:var(--soft); border-radius:3mm; padding:3mm 4mm; margin:0 0 4mm; break-inside:avoid; }
.tips h4 { grid-column:1 / -1; margin:0; color:var(--accent); }
.tip b { display:block; font-size:7.5pt; text-transform:uppercase; letter-spacing:.06em; color:var(--accent); }
.tip { font-size:8.6pt; }
.items { display:grid; grid-template-columns:1fr 1fr; gap:2.4mm 3mm; }
.item { border:1px solid var(--line); border-radius:3mm; padding:2.2mm 3mm; break-inside:avoid; font-size:8.2pt; }
.item.l3 { border-left:5px solid var(--accent); } .item.l2 { border-left:5px solid #5CA88F; } .item.l1 { border-left:5px solid var(--pumpkin); }
.top { display:flex; justify-content:space-between; gap:4mm; align-items:baseline; }
.rank { font-size:7.5pt; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; }
.name { font-weight:700; font-size:9.3pt; line-height:1.25; }
.price { font-weight:800; font-size:12pt; color:var(--accent); white-space:nowrap; text-align:right; }
.price small { display:block; font-size:7.5pt; font-weight:400; color:var(--muted); }
.meta { color:var(--muted); font-size:7.6pt; margin:.4mm 0 1mm; }
.barrow { display:flex; align-items:center; gap:3mm; margin:.8mm 0 1.2mm; }
.bar { flex:1; height:3.6mm; background:var(--paper); border-radius:2mm; overflow:hidden; }
.bar span { display:block; height:100%; background:var(--accent); border-radius:2mm; }
.l1 .bar span { background:var(--pumpkin); } .l2 .bar span { background:#5CA88F; }
.pct { font-weight:700; width:11mm; font-size:8pt; }
.tag { display:inline-block; font-size:7.5pt; font-weight:700; border-radius:2mm; padding:.4mm 2mm; background:var(--soft); color:var(--accent); }
.l1 .tag { background:var(--psoft); color:#8F430B; }
.maker { font-size:7.8pt; margin:0 0 .8mm; color:var(--ink); }
.maker b { color:var(--accent); }
.note { font-size:7.9pt; margin:0; line-height:1.35; }
.plan { border:1.5px solid var(--ink); border-radius:3mm; padding:3mm 4mm; margin:4mm 0 3mm; break-inside:avoid; }
.shops { display:grid; grid-template-columns:1fr 1fr; gap:3mm 6mm; }
.shop { break-inside:avoid; }
.shop .sn { font-weight:700; font-size:9.5pt; }
.shop .sw { color:var(--muted); font-size:7.8pt; margin-bottom:1mm; }
.shop ul { list-style:none; padding:0; margin:0; }
.shop li { font-size:8.6pt; padding:.6mm 0 .6mm 6mm; position:relative; }
.shop li:before { content:""; position:absolute; left:0; top:1.3mm; width:3.2mm; height:3.2mm; border:1.3px solid var(--ink); border-radius:.8mm; }
.watch { background:var(--psoft); border-radius:3mm; padding:2.5mm 4mm; margin:3mm 0; break-inside:avoid; }
.watch p, .makers p { margin:0 0 1mm; font-size:8.5pt; }
.makers { background:var(--paper); border-radius:3mm; padding:2.5mm 4mm; margin:3mm 0; break-inside:avoid; }
.src { color:var(--muted); font-size:7.2pt; margin-top:3mm; }"""

def page_html(d):
    rows = []
    for i, it in enumerate(d["items"], 1):
        lv = int(it.get("level", 2))
        maker = f'<p class="maker"><b>Hersteller:</b> {e(it["maker"])}</p>' if it.get("maker") else ""
        rows.append(f"""<div class="item l{lv}"><div class="top"><div><div class="rank">Platz {i} · {e(it['shop'])}</div>
<div class="name">{e(it['name'])}</div><div class="meta">{e(it.get('size',''))} · gültig {e(it.get('valid',''))}</div></div>
<div class="price">{e(it['price'])}<small>statt {e(it['normal'])}</small></div></div>
<div class="barrow"><div class="pct">−{int(it['save'])} %</div><div class="bar"><span style="width:{max(3, min(100, int(it['save'])))}%"></span></div><span class="tag">{e(it['rating'])}</span></div>
{maker}<p class="note">{e(it.get('note',''))}</p></div>""")
    tips = "".join(f'<div class="tip"><b>{e(t["label"])}</b>{e(t["text"])}</div>' for t in d.get("tips", []))
    plan = "".join(f"""<div class="shop"><div class="sn">{e(s['shop'])}</div><div class="sw">{e(s.get('when',''))}</div>
<ul>{''.join(f'<li>{e(x)}</li>' for x in s.get('items', []))}</ul></div>""" for s in d.get("plan", []))
    watch = "".join(f"<p><b>{e(w['name'])}:</b> {e(w['text'])}</p>" for w in d.get("watch", []))
    makers = "".join(f"<p><b>{e(m['name'])}:</b> {e(m['text'])}</p>" for m in d.get("makers", []))
    return f"""<!doctype html><html lang="de"><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<h2>{e(d['title'])}</h2><p class="sub">{e(d.get('subtitle',''))}</p><div class="intro">{e(d.get('intro',''))}</div>
{f'<p class="skip">{e(d["skipped"])}</p>' if d.get('skipped') else ''}
{f'<div class="tips"><h4>So kaufst du am besten ein</h4>{tips}</div>' if tips else ''}
<h4>Ersparnis gegenüber Normalpreis</h4><div class="items">{''.join(rows)}</div>
{f'<div class="plan"><h4>Dein Einkaufszettel für die Schnäppchen – zum Abhaken</h4><div class="shops">{plan}</div></div>' if plan else ''}
{f'<div class="watch"><h4>Preiswecker – noch nicht kaufen</h4>{watch}</div>' if watch else ''}
{f'<div class="makers"><h4>Wer steckt hinter der Eigenmarke?</h4>{makers}</div>' if makers else ''}
<p class="src">{e(d.get('sources',''))}</p></body></html>"""

async def render(htmltext, out):
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        kw = {"executable_path": "/usr/bin/google-chrome"} if os.path.exists("/usr/bin/google-chrome") else {}
        b = await pw.chromium.launch(**kw)
        p = await b.new_page()
        await p.set_content(htmltext, wait_until="load")
        await p.pdf(path=out, format="A4", print_background=True, prefer_css_page_size=True)
        await b.close()

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("deals"); ap.add_argument("week_pdf"); ap.add_argument("out")
    ap.add_argument("--after", type=int, default=0)
    a = ap.parse_args()
    d = json.loads(pathlib.Path(a.deals).read_text(encoding="utf-8"))
    tmp = tempfile.mktemp(suffix=".pdf")
    asyncio.run(render(page_html(d), tmp))
    week, extra = PdfReader(a.week_pdf), PdfReader(tmp)
    pos = a.after
    if not pos:  # automatisch: vor die Seite mit "Vorkoch-Block", sonst ans Ende
        hit = [i for i, pg in enumerate(week.pages) if i >= 2 and "Vorkoch-Block" in (pg.extract_text() or "")]
        pos = hit[0] if hit else len(week.pages)
    w = PdfWriter()
    for i, pg in enumerate(week.pages):
        w.add_page(pg)
        if i + 1 == pos:
            for x in extra.pages: w.add_page(x)
    with open(a.out, "wb") as f: w.write(f)
    os.remove(tmp)
    print(f"Schnäppchen-Seite(n): {len(extra.pages)} eingefügt nach Seite {pos} -> {a.out} ({len(w.pages)} Seiten)")

if __name__ == "__main__":
    main()
