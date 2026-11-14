/* Kochbuddy – liest die Seiten „Schnäppchen der Woche“ direkt aus dem öffentlichen Wochen-PDF.
   Es werden keine Angebotsdaten im Repo abgelegt: die App wertet nur das PDF aus, das ohnehin veröffentlicht ist. */

// Die eingebettete Schrift (Inter) gibt einige Zeichen als Privatzeichen aus – hier die feste Übersetzung.
const PUA = { "": "–", "": "(", "": ")", "": "=", "": "-", "": "+", "": "×", "": ":", "": "−" };
const fixText = (s) => s.replace(/[-]/g, (c) => PUA[c] ?? "");

let pdfjsP = null;
async function pdfjs() {
  if (!pdfjsP) {
    pdfjsP = import("./vendor/pdf.min.mjs").then((m) => {
      m.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.worker.min.mjs", import.meta.url).href;
      return m;
    });
  }
  return pdfjsP;
}

/** Textelemente einer Seite zu Zeilen zusammenfassen: {s, x, y, h, page} */
export function toLines(items, page) {
  const lines = [];
  let cur = null;
  const push = () => { if (cur) { cur.s = fixText(cur.s).replace(/\s+/g, " ").trim(); if (cur.s) lines.push(cur); } cur = null; };
  for (const it of items) {
    if (typeof it.str !== "string") continue;
    const x = it.transform[4], y = it.transform[5];
    if (!cur || Math.abs(y - cur.y) > 1.5) { push(); cur = { s: "", x, y, h: 0, page }; }
    cur.s += it.str;
    if (it.height > cur.h) cur.h = it.height;
    if (it.hasEOL) push();
  }
  push();
  return lines;
}

const near = (a, b, tol = 0.06) => Math.abs(a - b) <= tol;
const join = (ls) => ls.reduce((acc, l) => (acc && /\S-$/.test(acc) ? acc + l.s : acc ? acc + " " + l.s : l.s), "");
const HEADS = [
  ["tips", /^SO KAUFST DU/],
  ["items", /^ERSPARNIS/],
  ["plan", /^DEIN EINKAUFSZETTEL/],
  ["watch", /^PREISWECKER/],
  ["makers", /^WER STECKT/],
];

/** Absätze nach Zeilenabstand trennen */
function paragraphs(lines, factor = 1.12) {
  const out = [];
  let cur = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], p = lines[i - 1];
    if (p && (p.page !== l.page || p.y - l.y > p.h * 1.4 * factor || !near(p.h, l.h, 0.3))) { out.push(cur); cur = []; }
    cur.push(l);
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Zeilen der Schnäppchen-Seiten in eine Struktur übersetzen */
export function parseDeals(lines) {
  const d = { title: "", subtitle: "", intro: [], tips: [], items: [], plan: [], watch: [], makers: [], sources: "" };
  if (!lines.length) return d;
  d.title = lines[0].s;
  // Abschnitte bestimmen
  const sec = [{ key: "head", start: 1 }];
  lines.forEach((l, i) => { const h = HEADS.find(([, re]) => re.test(l.s)); if (h && i > 0) sec.push({ key: h[0], start: i + 1, at: i }); });
  const srcIdx = lines.findIndex((l, i) => i > 0 && near(l.h, 7.2, 0.15) && /Angebote laut|Ohne Gewähr|Quellen|Prüfung/.test(l.s));
  const body = (k) => {
    const i = sec.findIndex((x) => x.key === k);
    if (i < 0) return [];
    const end = i + 1 < sec.length ? sec[i + 1].at : srcIdx > sec[i].start ? srcIdx : lines.length;
    return lines.slice(sec[i].start, end);
  };
  // Kopf: Untertitel, Einleitung, Hinweis
  const head = body("head");
  if (head.length) {
    const subH = head[0].h;
    const sub = []; let i = 0;
    while (i < head.length && near(head[i].h, subH, 0.15)) sub.push(head[i++]);
    d.subtitle = join(sub);
    d.intro = paragraphs(head.slice(i)).map((p) => join(p));
  }
  // Einkaufs-Tipps: kurze Großbuchstaben-Zeile = Überschrift, danach Text
  let tip = null;
  for (const l of body("tips")) {
    if (/^[A-ZÄÖÜ ]{2,24}$/.test(l.s) && l.h < 8.2) { tip = { label: l.s, text: [] }; d.tips.push(tip); }
    else if (tip) tip.text.push(l);
  }
  d.tips = d.tips.map((t) => ({ label: t.label, text: join(t.text) }));
  // Angebote
  let card = null;
  const cards = [];
  for (const l of body("items")) {
    const m = l.s.match(/^PLATZ (\d+) · (.+)$/i);
    if (m) { card = { rank: +m[1], shop: m[2], lines: [] }; cards.push(card); continue; }
    if (card) card.lines.push(l);
  }
  for (const c of cards) {
    const L = c.lines;
    const si = L.findIndex((l) => /^statt\b/i.test(l.s));
    const it = { rank: c.rank, shop: c.shop, name: "", meta: "", price: "", normal: "", save: null, rating: "", maker: "", note: "" };
    if (si > 0) {
      it.price = L[si - 1].s;
      it.normal = L[si].s.replace(/^statt\s*/i, "");
      const top = L.slice(0, si - 1);
      const nameH = top.length ? Math.max(...top.map((l) => l.h)) : 0;
      it.name = join(top.filter((l) => near(l.h, nameH, 0.2)));
      it.meta = join(top.filter((l) => !near(l.h, nameH, 0.2)));
      const rest = L.slice(si + 1);
      const pi = rest.findIndex((l) => /^[−-]?\s*\d+\s*%/.test(l.s));
      if (pi >= 0) {
        const pm = rest[pi].s.match(/^[−-]?\s*(\d+)\s*%\s*(.*)$/);
        it.save = +pm[1]; it.rating = pm[2] || "";
        const tail = rest.slice(pi + 1);
        const mk = [], nt = [];
        let inMaker = tail.length && /^Hersteller:/.test(tail[0].s);
        for (let k = 0; k < tail.length; k++) {
          const l = tail[k], p = tail[k - 1];
          if (inMaker && k > 0 && (!near(l.h, p.h, 0.04) || p.y - l.y > p.h * 1.4 * 1.15)) inMaker = false;
          (inMaker ? mk : nt).push(l);
        }
        it.maker = join(mk).replace(/^Hersteller:\s*/, "");
        it.note = join(nt);
      } else it.note = join(rest);
    } else it.note = join(L);
    d.items.push(it);
  }
  // Einkaufszettel: Laden (größte Schrift), Wann, Punkte (Punkte stehen im PDF teils am Ende, daher nach Position zuordnen)
  const planLines = body("plan");
  const shopH = planLines.length ? Math.max(...planLines.map((l) => l.h)) : 0;
  const shops = [];
  for (const l of planLines) {
    if (near(l.h, shopH, 0.15)) shops.push({ shop: l.s, when: "", x: l.x, y: l.y, page: l.page, items: [] });
    else if (shops.length && !shops[shops.length - 1].when && l.h < shopH - 1 && l.h < 8.2) shops[shops.length - 1].when = l.s;
  }
  const itemLines = lines.filter((l) => near(l.h, 8.6, 0.15) && shops.some((s) => s.page === l.page && l.x > s.x + 5 && l.x < s.x + 40 && l.y < s.y));
  for (const l of itemLines) {
    const cands = shops.filter((s) => s.page === l.page && l.x > s.x + 5 && l.x < s.x + 40 && l.y < s.y);
    const s = cands.sort((a, b) => a.y - b.y)[0]; // der nächste Laden darüber
    if (!s) continue;
    const last = s._last;
    if (last && last.y - l.y < l.h * 1.4 * 1.12) s.items[s.items.length - 1] += (s.items[s.items.length - 1].endsWith("-") ? "" : " ") + l.s;
    else s.items.push(l.s);
    s._last = l;
  }
  d.plan = shops.map(({ shop, when, items }) => ({ shop, when, items }));
  // Preiswecker und Eigenmarken: Absätze „Name: Text“
  const named = (ls) => paragraphs(ls.filter((l) => !itemLines.includes(l))).map((p) => {
    const t = join(p), i = t.indexOf(":");
    return i > 0 && i < 70 ? { name: t.slice(0, i), text: t.slice(i + 1).trim() } : { name: "", text: t };
  });
  d.watch = named(body("watch"));
  d.makers = named(body("makers"));
  if (srcIdx > 0) d.sources = join(lines.slice(srcIdx).filter((l) => near(l.h, lines[srcIdx].h, 0.15) && !itemLines.includes(l)));
  return d;
}

/** PDF laden, Schnäppchen-Seiten finden und auswerten */
export async function loadDeals(url) {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ url, isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
  const pages = [];
  let started = false;
  for (let n = 1; n <= doc.numPages; n++) {
    const tc = await (await doc.getPage(n)).getTextContent();
    const ls = toLines(tc.items, n);
    if (!started) { if (ls.some((l) => /^Schnäppchen der Woche/.test(l.s))) { started = true; const i = ls.findIndex((l) => /^Schnäppchen der Woche/.test(l.s)); pages.push({ n, lines: ls.slice(i) }); } continue; }
    if (ls.some((l) => /Speiseplan KW \d+ · Seite/.test(l.s))) break; // zurück im normalen Wochenplan
    pages.push({ n, lines: ls });
  }
  const data = parseDeals(pages.flatMap((p) => p.lines));
  return { data, pages: pages.map((p) => p.n), doc };
}

/** Rückfall: eine PDF-Seite als Bild zeichnen */
export async function renderPage(url, n, canvas, cssWidth) {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ url, isEvalSupported: false, verbosity: 0 }).promise;
  const page = await doc.getPage(n);
  const vp1 = page.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const vp = page.getViewport({ scale: (cssWidth / vp1.width) * dpr });
  canvas.width = vp.width; canvas.height = vp.height;
  canvas.style.width = cssWidth + "px"; canvas.style.height = vp.height / dpr + "px";
  await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
}
