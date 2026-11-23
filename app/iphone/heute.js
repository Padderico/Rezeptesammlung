// KOCHBUDDY-HEUTE v1
// Was gibt's heute? Widget (Home- und Sperrbildschirm) und Siri-Antwort für Scriptable auf dem iPhone.
// Wird vom kleinen Lader-Skript „Kochbuddy“ in Scriptable geladen, damit Verbesserungen ohne Neu-Einrichten ankommen.
// Liest den Wochenplan öffentlich über GitHub Pages. Mit Schlüssel (optional, nur im Schlüsselbund des iPhones)
// zusätzlich die Tausche aus der App, damit ein heute getauschtes Gericht sofort stimmt.
// Keine Namen, keine Schlüssel in dieser Datei.

const BASE = "https://padderico.github.io/rezeptesammlung/app/";
const DATA_REPO = "Padderico/Einkaufsbuddy-Daten";
const KEY = "kochbuddy.gh";
const SCRIPT_NAME = "Kochbuddy";

const C = {
  bg: new Color("#0F3D30"),
  plate: new Color("#FFFFFF", 0.085),
  plateNow: new Color("#FFFFFF", 0.15),
  ink: new Color("#EEF6F1"),
  dim: new Color("#A9C7B9"),
  pump: new Color("#FF8F3A"),
  ring: new Color("#FFFFFF", 0.055),
  tone: { meat: new Color("#EE8B83"), fish: new Color("#86BFE8"), veg: new Color("#97D18A"), "": new Color("#A9C7B9", 0.6) },
};
const F = {
  kick: (s) => Font.semiboldSystemFont(s),
  head: (s) => Font.boldSystemFont(s),
  body: (s) => Font.regularSystemFont(s),
  med: (s) => Font.mediumSystemFont(s),
};

const DAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const pad = (n) => String(n).padStart(2, "0");
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (iso) => new Date(`${iso}T12:00:00`);
const addDays = (iso, n) => { const d = dateOf(iso); d.setDate(d.getDate() + n); return isoOf(d); };
const dm = (iso) => { const d = dateOf(iso); return `${d.getDate()}.${d.getMonth() + 1}.`; };
const dayName = (iso) => DAYS[dateOf(iso).getDay()];
const tone = (tags) => { const t = tags || []; return t.includes("Fleisch") ? "meat" : t.includes("Fisch") ? "fish" : t.includes("Vegetarisch") ? "veg" : ""; };
function splitTitle(title) {
  const m = String(title).match(/^(.+?)\s((?:mit|aus|in|vom|&)\s.+)$/);
  return m ? [m[1], m[2]] : [String(title), ""];
}

/* ---------- Daten ---------- */
const fm = FileManager.local();
const cacheFile = fm.joinPath(fm.cacheDirectory(), "kochbuddy-heute.json");
async function text(url, headers) {
  const r = new Request(url);
  r.timeoutInterval = 12;
  if (headers) r.headers = headers;
  const body = await r.loadString();
  return { status: (r.response && r.response.statusCode) || 0, body };
}
async function json(url) {
  const { status, body } = await text(url);
  if (status !== 200) throw new Error(`Kochbuddy antwortet ${status}`);
  return JSON.parse(body);
}
function token() { try { return Keychain.contains(KEY) ? Keychain.get(KEY) : ""; } catch (e) { return ""; } }
async function pullSwaps(id, tok) {
  const { status, body } = await text(`https://api.github.com/repos/${DATA_REPO}/contents/tausch/${id}.json`, {
    Authorization: `Bearer ${tok}`, Accept: "application/vnd.github.raw+json", "X-GitHub-Api-Version": "2022-11-28",
  });
  if (status === 404) return [];
  if (status === 401) throw Object.assign(new Error("Schlüssel ungültig"), { code: "auth" });
  if (status !== 200) throw new Error(`GitHub antwortet ${status}`);
  return JSON.parse(body).swaps || [];
}
function readCache() { try { return fm.fileExists(cacheFile) ? JSON.parse(fm.readString(cacheFile)) : null; } catch (e) { return null; } }

async function load(now) {
  const t = isoOf(now), bust = `?t=${Math.floor(now.getTime() / 300000)}`;
  const old = readCache();
  try {
    const idx = await json(`${BASE}daten/wochen.json${bust}`);
    const list = (idx.weeks || []).map((w) => ({ id: w.file.replace(/\.json$/, ""), start: w.start, file: w.file }))
      .filter((w) => addDays(w.start, 6) >= t);
    const weeks = await Promise.all(list.map(async (w) => ({ id: w.id, start: w.start, data: await json(`${BASE}daten/wochen/${w.file}${bust}`) })));
    const swaps = {}, tok = token();
    let keyState = tok ? "ok" : "none";
    if (tok) {
      for (const w of weeks) {
        try { swaps[w.id] = await pullSwaps(w.id, tok); }
        catch (e) { if (e.code === "auth") keyState = "bad"; swaps[w.id] = (old && old.swaps && old.swaps[w.id]) || []; }
      }
    }
    const D = { at: now.getTime(), weeks, swaps, keyState };
    try { fm.writeString(cacheFile, JSON.stringify(D)); } catch (e) { /* egal */ }
    return { ...D, fresh: true };
  } catch (e) {
    if (old) return { ...old, fresh: false };
    throw e;
  }
}

/* ---------- Was gibt's wann? ---------- */
function prepOn(iso, D) {
  const key = dm(iso).replace(/^(\d)\./, "0$1.").replace(/\.(\d)\.$/, ".0$1.");
  for (const w of D.weeks) {
    const p = w.data.prep;
    if (p && p.when && (p.when.includes(key) || p.when.includes(dm(iso)))) return { title: p.title || "Vorkoch-Block", dur: (p.when.split("·")[1] || "").trim() };
  }
  return null;
}
function dayModel(iso, D) {
  for (const w of D.weeks) {
    const day = (w.data.days || []).find((d) => d.iso === iso);
    if (!day) continue;
    const swaps = ((D.swaps || {})[w.id] || []).filter((s) => s.status === "offen" || s.status === "nur-app");
    const main = String(day.main || "");
    const slots = ["Mittag", "Abend"].map((slot) => {
      const m = (day.meals || []).find((x) => x.slot === slot);
      if (!m) {
        const away = /auswärts/i.test(main) && main.toLowerCase().startsWith(slot.toLowerCase());
        return { slot, empty: true, away, head: away ? "Auswärts essen" : "Nichts geplant", rest: away ? "Heute wird nicht gekocht" : "" };
      }
      const s = swaps.find((x) => x.iso === iso && x.slot === slot && x.from === m.recipe && w.data.recipes[x.to]);
      const rid = s ? s.to : m.recipe, mode = s ? "kochen" : m.mode;
      const r = w.data.recipes[rid] || { title: rid, tags: [] };
      const [head, rest] = splitTitle(r.title);
      const badge = s ? "" : m.badge || "";
      const how = mode === "aufwaermen" ? `${badge || "Vorgekocht"}, aufwärmen` : `Frisch kochen${r.time && r.time.total ? `, ${r.time.total} Min.` : ""}`;
      return { slot, title: r.title, head, rest, how: s ? `Getauscht · ${how}` : how, warm: mode === "aufwaermen", badge, tone: tone(r.tags),
        url: `${BASE}#/r/${encodeURIComponent(`w:${w.id}:${rid}`)}` };
    });
    return { iso, plan: true, slots };
  }
  return { iso, plan: false, prep: prepOn(iso, D), slots: [] };
}
/** Bis 14 Uhr zählt das Mittagessen, bis 21 Uhr das Abendessen, danach der nächste Tag. */
function moment(now) {
  const h = now.getHours() + now.getMinutes() / 60, t = isoOf(now);
  if (h >= 21) return { iso: addDays(t, 1), word: "Morgen", now: null, past: null };
  return { iso: t, word: "Heute", now: h < 14 ? "Mittag" : "Abend", past: h < 14 ? null : "Mittag" };
}
function nextPlanned(iso, D, max = 4) {
  for (let i = 1; i <= max; i++) { const m = dayModel(addDays(iso, i), D); if (m.plan) return m; }
  return null;
}
const rel = (iso, base) => { const n = Math.round((dateOf(iso) - dateOf(base)) / 864e5); return n === 0 ? "Heute" : n === 1 ? "Morgen" : dayName(iso); };

/* ---------- Siri ---------- */
const spoken = (s) => String(s).replace(/\s&\s/g, " und ").replace(/\s+/g, " ").trim();
function sayMeal(m, when) {
  if (m.empty) return m.away ? `${when} esst ihr auswärts.` : `${when} ist nichts geplant.`;
  const extra = m.warm ? (m.badge === "Reste" ? ", die Reste zum Aufwärmen" : ", schon vorgekocht") : "";
  return `${when} gibt's ${spoken(m.title)}${extra}.`;
}
function speech(now, D) {
  const mo = moment(now), t = isoOf(now), day = dayModel(mo.iso, D), w = mo.word;
  const out = [];
  if (!day.plan) {
    out.push(day.prep ? `${w} ist Vorkoch-Tag${day.prep.dur ? `, ${day.prep.dur}` : ""}.` : `${w} hat der Buddy nichts eingeplant.`);
    const n = nextPlanned(mo.iso, D);
    if (n) out.push(sayMeal(n.slots[0], `${rel(n.iso, t)} Mittag`));
    return out.join(" ");
  }
  const [mit, abe] = day.slots;
  if (mo.past === "Mittag") {
    out.push(sayMeal(abe, `${w} Abend`));
    const tm = dayModel(addDays(t, 1), D);
    if (tm.plan) out.push(sayMeal(tm.slots[0], "Morgen Mittag"));
  } else {
    out.push(sayMeal(mit, `${w} Mittag`));
    out.push(sayMeal(abe, `${w} Abend`));
  }
  return out.join(" ");
}

/* ---------- Widget ---------- */
function rings(size) {
  const dc = new DrawContext();
  dc.size = size; dc.opaque = true; dc.respectScreenScale = true;
  dc.setFillColor(C.bg); dc.fillRect(new Rect(0, 0, size.width, size.height));
  dc.setStrokeColor(C.ring); dc.setLineWidth(2.4);
  const cx = size.width - 34, cy = 18;
  for (let r = 22; r <= 140; r += 23) dc.strokeEllipse(new Rect(cx - r, cy - r, r * 2, r * 2));
  return dc.getImage();
}
function txt(st, s, font, color, lines = 1, scale = 0.8) {
  const t = st.addText(String(s));
  t.font = font; t.textColor = color; t.lineLimit = lines; t.minimumScaleFactor = scale;
  return t;
}
function header(w, mo, D, size, short) {
  const h = w.addStack();
  h.centerAlignContent(); h.spacing = 5;
  const sym = SFSymbol.named("fork.knife");
  if (sym) { sym.applyFont(Font.semiboldSystemFont(size)); const im = h.addImage(sym.image); im.tintColor = C.pump; im.imageSize = new Size(size + 1, size + 1); }
  txt(h, short ? `${mo.word} · ${dayName(mo.iso).slice(0, 2)} ${dm(mo.iso)}` : `${mo.word} · ${dayName(mo.iso)}, ${dm(mo.iso)}`, F.kick(size), C.ink);
  h.addSpacer();
  if (!D.fresh) txt(h, "offline", F.body(size - 2), C.dim);
}
function label(st, m, mo, size) {
  const l = st.addStack();
  l.centerAlignContent(); l.spacing = 5;
  const isNow = mo.now === m.slot;
  if (isNow) { const dot = l.addStack(); dot.size = new Size(7, 7); dot.cornerRadius = 3.5; dot.backgroundColor = C.pump; }
  txt(l, isNow ? `${m.slot} · jetzt` : m.slot, F.kick(size), isNow ? C.pump : C.dim);
}
/** Teller: abgerundete Fläche mit Farbleiste (Fleisch/Fisch/Vegetarisch) links. fill = füllt den Platz (gleich große Teller nebeneinander). */
function shell(parent, opt, bg, toneColor, url) {
  const p = parent.addStack();
  p.layoutHorizontally(); p.topAlignContent(); p.spacing = 7; p.cornerRadius = 14; p.setPadding(9, 10, 9, 10);
  p.backgroundColor = bg;
  if (url) p.url = url;
  const bar = p.addStack(); bar.size = new Size(3, opt.bar); bar.cornerRadius = 1.5; bar.backgroundColor = toneColor;
  const col = p.addStack(); col.layoutVertically(); col.spacing = 2;
  p.addSpacer();
  return col;
}
function plate(parent, m, mo, opt) {
  const col = shell(parent, opt, mo.now === m.slot ? C.plateNow : C.plate, m.empty ? C.tone[""] : C.tone[m.tone || ""], m.url);
  label(col, m, mo, opt.k);
  const hd = txt(col, m.head, F.head(opt.h), C.ink, opt.hLines, 0.7);
  if (m.rest && opt.rest) txt(col, m.rest, F.body(opt.k), C.dim, opt.restLines, 0.85);
  if (!m.empty && opt.how) txt(col, m.how, F.med(opt.k - 0.5), C.dim, 1, 0.8);
  if (mo.past === m.slot) hd.textOpacity = 0.55;
  if (opt.fill) col.addSpacer();
}
function infoPlate(parent, day, mo, opt) {
  const col = shell(parent, opt, C.plateNow, C.pump, `${BASE}#/vorkochen`);
  txt(col, day.prep ? "Vorkoch-Tag" : "Kein Plan", F.kick(opt.k), C.pump);
  txt(col, day.prep ? day.prep.title : `${mo.word} plant ihr selbst`, F.head(opt.h), C.ink, 2, 0.7);
  txt(col, day.prep ? day.prep.dur || "Alles im Kochbuddy" : "Der Buddy plant Montag bis Freitag", F.body(opt.k), C.dim, 2, 0.85);
  if (opt.fill) col.addSpacer();
}

function buildHome(family, now, D) {
  const mo = moment(now), day = dayModel(mo.iso, D);
  const dims = { small: new Size(340, 340), medium: new Size(720, 338), large: new Size(720, 756), extraLarge: new Size(1440, 680) };
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.backgroundImage = rings(dims[family] || dims.medium);
  w.url = `${BASE}#/`;
  w.setPadding(14, 14, 14, 14);
  const next = !day.plan ? nextPlanned(mo.iso, D) : null;

  if (family === "small") {
    header(w, mo, D, 11, true);
    w.addSpacer(8);
    if (!day.plan) {
      txt(w, day.prep ? "Vorkoch-Tag" : "Kein Plan", F.kick(11), C.pump);
      txt(w, day.prep ? day.prep.title : "Heute plant ihr selbst", F.head(15), C.ink, 2, 0.7);
      if (next) { w.addSpacer(6); txt(w, `${rel(next.iso, isoOf(now))} Mittag`, F.kick(11), C.dim); txt(w, next.slots[0].head, F.head(14), C.ink, 2, 0.7); }
    } else {
      day.slots.forEach((m, i) => {
        if (i) w.addSpacer(6);
        const isNow = mo.now === m.slot;
        txt(w, isNow ? `${m.slot} · jetzt` : m.slot, F.kick(11), isNow ? C.pump : C.dim);
        const t = txt(w, m.head, F.head(15), C.ink, 2, 0.65);
        if (mo.past === m.slot) t.textOpacity = 0.55;
      });
    }
    w.addSpacer();
    return w;
  }

  header(w, mo, D, family === "large" ? 13 : 12);
  w.addSpacer(family === "large" ? 12 : 9);
  if (family === "medium" || family === "extraLarge") {
    const row = w.addStack(); row.layoutHorizontally(); row.spacing = 8;
    const opt = { k: 11, h: 15, hLines: 2, rest: true, restLines: 1, how: true, bar: 58, fill: true };
    if (!day.plan) {
      infoPlate(row, day, mo, opt);
      if (next) plate(row, { ...next.slots[0], slot: `${rel(next.iso, isoOf(now))} Mittag` }, { now: null, past: null }, opt);
    } else day.slots.forEach((m) => plate(row, m, mo, opt));
    return w;
  }
  // large: heute groß, darunter der nächste Tag kompakt
  const opt = { k: 12, h: 18, hLines: 2, rest: true, restLines: 2, how: true, bar: 70, fill: false };
  if (!day.plan) infoPlate(w, day, mo, opt);
  else day.slots.forEach((m, i) => { if (i) w.addSpacer(8); plate(w, m, mo, opt); });
  const n2 = day.plan ? dayModel(addDays(mo.iso, 1), D) : next;
  if (n2 && n2.plan) {
    w.addSpacer(14);
    txt(w, `${rel(n2.iso, isoOf(now))} · ${dayName(n2.iso)}, ${dm(n2.iso)}`, F.kick(12), C.dim);
    w.addSpacer(6);
    n2.slots.forEach((m) => {
      const r = w.addStack(); r.centerAlignContent(); r.spacing = 8; if (m.url) r.url = m.url;
      const b = r.addStack(); b.size = new Size(3, 16); b.cornerRadius = 1.5; b.backgroundColor = C.tone[m.tone || ""];
      const s = r.addStack(); s.size = new Size(52, 0); txt(s, m.slot, F.kick(12), C.dim);
      txt(r, m.head, F.head(14), C.ink, 1, 0.75);
      r.addSpacer();
      w.addSpacer(5);
    });
  }
  w.addSpacer();
  return w;
}

function buildAccessory(family, now, D) {
  const mo = moment(now), day = dayModel(mo.iso, D);
  const w = new ListWidget();
  w.url = `${BASE}#/`;
  const focus = day.plan ? day.slots.find((m) => m.slot === (mo.now || "Mittag")) : null;
  if (family === "accessoryInline") {
    w.addText(focus ? `${mo.now ? "" : "Morgen "}${focus.slot}: ${focus.head}` : day.prep ? "Heute Vorkoch-Tag" : "Heute kein Plan");
    return w;
  }
  if (family === "accessoryCircular") {
    w.addAccessoryWidgetBackground = true;
    const sym = SFSymbol.named("fork.knife");
    if (sym) { const im = w.addImage(sym.image); im.imageSize = new Size(22, 22); im.centerAlignImage(); }
    return w;
  }
  // accessoryRectangular
  const top = w.addStack(); top.spacing = 4; top.centerAlignContent();
  const sym = SFSymbol.named("fork.knife");
  if (sym) { const im = top.addImage(sym.image); im.imageSize = new Size(11, 11); }
  txt(top, `${mo.word}${focus ? ` ${focus.slot}` : ""}`, Font.boldSystemFont(12), Color.white());
  if (!day.plan) { txt(w, day.prep ? day.prep.title : "Kein Plan vom Buddy", Font.semiboldSystemFont(14), Color.white(), 2, 0.7); return w; }
  txt(w, focus.head, Font.semiboldSystemFont(15), Color.white(), 2, 0.7);
  const other = day.slots.find((m) => m !== focus && m.slot === "Abend" && mo.now !== "Abend");
  if (other) txt(w, `Abend: ${other.head}`, Font.regularSystemFont(12), Color.white(), 1, 0.7).textOpacity = 0.75;
  else if (focus.rest) txt(w, focus.rest, Font.regularSystemFont(12), Color.white(), 1, 0.7).textOpacity = 0.75;
  return w;
}

function nextRefresh(now) {
  const d = new Date(now), h = now.getHours();
  const at = (hh, mm, plus = 0) => { const x = new Date(d); x.setDate(x.getDate() + plus); x.setHours(hh, mm, 0, 0); return x; };
  const edge = h < 14 ? at(14, 0) : h < 21 ? at(21, 0) : at(0, 5, 1);
  const soon = new Date(now.getTime() + 30 * 60000);
  return edge < soon ? edge : soon;
}

function errorWidget(msg) {
  const w = new ListWidget();
  w.backgroundColor = C.bg; w.url = `${BASE}#/`; w.setPadding(14, 14, 14, 14);
  txt(w, "Kochbuddy", F.kick(12), C.pump);
  w.addSpacer(4);
  txt(w, "Gerade nicht erreichbar", F.head(15), C.ink, 2);
  txt(w, msg, F.body(11), C.dim, 3);
  w.refreshAfterDate = new Date(Date.now() + 15 * 60000);
  return w;
}

/* ---------- Einrichtung in der App ---------- */
async function note(title, message) { const a = new Alert(); a.title = title; a.message = message; a.addAction("Gut"); await a.presentAlert(); }
async function inApp(now, D) {
  const q = args.queryParameters || {};
  if (q.verbinden) {
    if (/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(q.verbinden)) {
      Keychain.set(KEY, q.verbinden);
      await note("Verbunden", "Tausche aus dem Kochbuddy erscheinen jetzt sofort im Widget und bei Siri. Der Schlüssel liegt nur im Schlüsselbund dieses iPhones.");
      return;
    }
    await note("Das hat nicht geklappt", "Der Schlüssel war unvollständig. Im Kochbuddy auf der iPhone-Seite nochmal „Mit Tauschen verbinden“ antippen.");
    return;
  }
  if (Script.name() !== SCRIPT_NAME) {
    await note(`Bitte „${SCRIPT_NAME}“ nennen`, `Dieses Skript heißt gerade „${Script.name()}“. Oben im Editor auf den Namen tippen und „${SCRIPT_NAME}“ eintragen – sonst findet der Kochbuddy es nicht.`);
  }
  const tok = token();
  const a = new Alert();
  a.title = "Kochbuddy · Heute";
  a.message = speech(now, D) + (D.keyState === "bad" ? "\n\nDer gespeicherte Schlüssel gilt nicht mehr. Im Kochbuddy auf der iPhone-Seite neu verbinden." : tok ? "\n\nTausche aus der App: verbunden." : "\n\nTausche aus der App: noch nicht verbunden (optional).");
  const acts = [["Widget mittel ansehen", () => buildHome("medium", now, D).presentMedium()], ["Widget klein ansehen", () => buildHome("small", now, D).presentSmall()], ["Widget groß ansehen", () => buildHome("large", now, D).presentLarge()], ["Vorlesen", () => Speech.speak(speech(now, D))], ["Kochbuddy öffnen", () => Safari.open(`${BASE}#/`)]];
  if (tok) acts.push(["Verbindung zu Tauschen entfernen", () => { Keychain.remove(KEY); return note("Entfernt", "Das Widget zeigt jetzt nur noch den Plan."); }]);
  acts.forEach(([t]) => a.addAction(t));
  a.addCancelAction("Fertig");
  const i = await a.presentSheet();
  if (i >= 0) await acts[i][1]();
}

/* ---------- Start ---------- */
const NOW = new Date();
let DATA = null, failure = "";
try { DATA = await load(NOW); } catch (e) { failure = e.message || String(e); }

if (config.runsInWidget || config.runsInAccessoryWidget) {
  const fam = config.widgetFamily || "medium";
  const w = !DATA ? errorWidget(failure) : fam.startsWith("accessory") ? buildAccessory(fam, NOW, DATA) : buildHome(fam, NOW, DATA);
  if (DATA) w.refreshAfterDate = nextRefresh(NOW);
  Script.setWidget(w);
} else if (config.runsWithSiri) {
  const say = DATA ? speech(NOW, DATA) : "Der Kochbuddy ist gerade nicht erreichbar.";
  Speech.speak(say);
  Script.setShortcutOutput(say);
  if (DATA) await buildHome("medium", NOW, DATA).presentMedium();
} else if (config.runsInApp) {
  if (!DATA) await note("Kochbuddy gerade nicht erreichbar", `${failure}\n\nMit Internet nochmal starten.`);
  else await inApp(NOW, DATA);
} else {
  // z. B. aus Kurzbefehlen ohne Siri: Text weitergeben
  Script.setShortcutOutput(DATA ? speech(NOW, DATA) : "Der Kochbuddy ist gerade nicht erreichbar.");
}
Script.complete();
