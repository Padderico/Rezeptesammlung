#!/usr/bin/env python3
"""Baut den Mailtext (HTML + Text) zum Wochenplan oder zu Ersatzvorschlägen, mit Bring- und Rezept-Links.

Wochenmail:   python3 tools/build_mail.py plan.json --greeting "Hallo X," --signature "Y" --out mail
Vorschläge:   python3 tools/build_mail.py plan.json --mode vorschlaege --ids id1,id2 --intro "..." --greeting ... --signature ... --out antwort
Schreibt <out>.html und <out>.txt
"""
import argparse
import html
import json
import pathlib
import re
import urllib.parse

e = html.escape
FOOT = "Diese Mail wurde automatisch vom Speiseplan-Assistenten erstellt."


def slugify(t):
    t = t.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss").replace("&", " und ")
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("plan")
    ap.add_argument("--mode", default="woche", choices=["woche", "vorschlaege"])
    ap.add_argument("--ids", default="")
    ap.add_argument("--intro", default="")
    ap.add_argument("--greeting", required=True)
    ap.add_argument("--signature", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    plan = json.loads(pathlib.Path(a.plan).read_text(encoding="utf-8"))
    base = plan["bring"]["publicBase"]
    site = base.rsplit("rezepte/", 1)[0]
    w = plan["week"]
    pdf = f"{site}wochenplan/Speiseplan-KW{w['kw']}-{w['year']}.pdf"

    def links(rid):
        r = plan["recipes"][rid]
        page = base + slugify(r["title"]) + ".html"
        bring = ("https://api.getbring.com/rest/bringrecipes/deeplink?url=" + urllib.parse.quote(r.get("bringUrl") or page, safe="")
                 + f"&source=web&baseQuantity={r['base']}&requestedQuantity={r['base']}")
        return r, page, bring

    def li(rid, prefix="", extra=""):
        r, page, bring = links(rid)
        return (f'<li>{e(prefix)}<b>{e(r["title"])}</b>{e(extra)}<br><a href="{e(bring)}">In Bring übernehmen</a> · '
                f'<a href="{e(page)}">Rezept online</a></li>')

    ul = '<ul style="margin:0;padding-left:18px">'
    txt = [a.greeting, ""]
    if a.mode == "woche":
        h = [f"<p>{e(a.greeting)}</p>",
             f'<p>hier ist unser Speiseplan für die Woche vom {e(w["label"])}. Einkaufsliste, Vorkoch-Plan und alle Rezepte mit Kochanleitung gibt es zusammen als PDF: <a href="{e(pdf)}"><b>Speiseplan als PDF öffnen</b></a>. Die Thermomix-Einstellungen passen für unseren TM31.</p>',
             "<p><b>So funktioniert's:</b> Bei jedem Rezept öffnet „In Bring übernehmen“ die Bring-App mit allen Zutaten, die Portionen kannst du dort anpassen. „Rezept online“ zeigt das Rezept im Browser.</p>",
             "<p><b>Gefällt dir etwas nicht?</b> Antworte einfach auf diese Mail und schreib kurz, was nicht passt. Dann kommen automatisch 4–6 neue Vorschläge. Schreibst du, welches Gericht du gegen welches tauschen möchtest, wird der Plan samt Einkaufsliste angepasst.</p>"]
        txt += [f"hier ist unser Speiseplan für die Woche vom {w['label']}. Alles als PDF: {pdf}", ""]
        ek = plan.get("bring", {}).get("einkauf")
        if ek:
            dl = lambda u: ("https://api.getbring.com/rest/bringrecipes/deeplink?url=" + urllib.parse.quote(u, safe="")
                            + "&source=web&baseQuantity=1&requestedQuantity=1")
            h.append(f'<p><b>Einkauf auf einmal:</b> <a href="{e(dl(ek["super"]))}">Supermarkt-Liste in Bring übernehmen</a> · '
                     f'<a href="{e(dl(ek["metzger"]))}">Metzger-Liste in Bring übernehmen</a>. Jeder Artikel landet auf seiner festen Kachel, '
                     'im Bring-Dialog kannst du abwählen, was wir schon haben.</p>')
            txt += [f"Einkauf auf einmal (Bring): Supermarkt {dl(ek['super'])}", f"Metzger {dl(ek['metzger'])}", ""]
        prep_ids = plan.get("prep", {}).get("recipes", [])
        prep_day = plan.get("prep", {}).get("short", "")
        if prep_ids:
            h.append(f'<p style="margin:14px 0 4px"><b>Vorkochen ({e(plan["prep"].get("when", ""))})</b></p>{ul}' + "".join(li(r) for r in prep_ids) + "</ul>")
        for d in plan["days"]:
            items = ""
            line = []
            for m in d["meals"]:
                r = plan["recipes"][m["recipe"]]
                label = m["slot"] + (" (Hauptmahlzeit)" if m["kind"] == "haupt" else "")
                if m.get("mode") == "aufwaermen":
                    how = "Reste" if m.get("badge") == "Reste" else "vorgekocht, nur aufwärmen"
                    items += f'<li>{e(label)}: {e(r["title"])} ({how})</li>'
                else:
                    items += li(m["recipe"], label + ": ")
                line.append(f"{m['slot']}: {r['title']}")
            h.append(f'<p style="margin:14px 0 4px"><b>{e(d["name"])}, {e(d["date"])}</b></p>{ul}{items}</ul>')
            txt.append(f"{d['name']}: " + " · ".join(line))
        if plan.get("extras"):
            h.append(f'<p style="margin:18px 0 4px"><b>Ersatzgerichte</b>, falls dir etwas nicht zusagt:</p>{ul}' + "".join(li(r) for r in plan["extras"]) + "</ul>")
        h.append(f'<p>Alle Rezepte gibt es auch hier: <a href="{e(site)}">{e(site.replace("https://", "").rstrip("/"))}</a></p>')
        txt += ["", "Bring-Links stehen im PDF und in der HTML-Ansicht dieser Mail.", "Gefällt dir etwas nicht? Einfach auf diese Mail antworten."]
    else:
        ids = [x for x in a.ids.split(",") if x]
        h = [f"<p>{e(a.greeting)}</p>", f"<p>{e(a.intro)}</p>", ul]
        for rid in ids:
            r = plan["recipes"][rid]
            extra = f" · {r['time']['total']} Min."
            h.append(li(rid, "", extra).replace("</li>", (f'<br><span style="color:#566A63">{e(r["swap"])}</span>' if r.get("swap") else "") + "</li>"))
            txt.append(f"- {r['title']}: {links(rid)[1]}")
        h.append("</ul>")
        h.append("<p>Schreib einfach zurück, welches Gericht du gegen welches tauschen möchtest. Dann wird der Plan samt Einkaufsliste angepasst.</p>")
        txt.insert(2, a.intro)
    h.append(f"<p>Liebe Grüße<br>{e(a.signature)}</p>")
    h.append(f'<p style="color:#566A63;font-size:12px">{FOOT}</p>')
    txt += ["", "Liebe Grüße", a.signature, "", FOOT]
    pathlib.Path(a.out + ".html").write_text("\n".join(h), encoding="utf-8")
    pathlib.Path(a.out + ".txt").write_text("\n".join(txt), encoding="utf-8")
    print("geschrieben:", a.out + ".html", a.out + ".txt")


if __name__ == "__main__":
    main()
