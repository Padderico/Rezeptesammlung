/* Kochbuddy – Koch-App zum Wochenplan. Daten: daten/wochen.json, daten/wochen/<kw>.json, daten/rezepte/<slug>.json
   (schreibt tools/build_pages.py jede Woche mit). Fortschritt und Timer bleiben lokal auf dem Gerät. */
"use strict";
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const DAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const DEV = { tm: "Thermomix TM31", ofen: "Ofen", hlf: "Heißluftfritteuse", herd: "Herd" };
  const DEV_SHORT = { tm: "TM31", ofen: "Ofen", hlf: "Heißluftfritteuse", herd: "Herd" };
  const CHECK = '<span class="box"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>';
  const CLOCK = '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg>';
  const CLOSE = '<svg class="ico" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICON_CART = '<svg class="ico" viewBox="0 0 24 24"><path d="M3 4h2.5l2.2 10.5h10.6L20.5 7H7"/><circle cx="9.5" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></svg>';
  const ICON_WAIT = '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
  const LIST = '<svg class="ico" viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>';
  const BACK = '<svg class="ico" viewBox="0 0 24 24"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg>';
  const ICON_FORK = '<svg class="fork" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2v8a2 2 0 0 0 2 2v10h2V12a2 2 0 0 0 2-2V2h-1.5v7h-1V2h-1v7h-1V2zM16 2c-1.7 1-2.5 3.5-2.5 6v5H16v9h2V2z"/></svg>';
  const NEXT = '<svg class="ico" viewBox="0 0 24 24"><path d="M9.5 5.5L16 12l-6.5 6.5"/></svg>';
  const PLAY = '<svg class="ico" viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
  const GRIP = '<svg class="ico" viewBox="0 0 24 24"><g fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></g></svg>';
  const ICON_KID = '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="9" r="5.5"/><path d="M10 8.5h.01M14 8.5h.01M10.2 11.2q1.8 1.4 3.6 0M12 3.5q1.5 0 1.5-1.5M6.5 21q.5-5 5.5-5.5 5 .5 5.5 5.5"/></svg>';
  const MONTHS = ["Jan", "Feb", "März", "Apr", "Mai", "Juni", "Juli", "Aug", "Sep", "Okt", "Nov", "Dez"];
  /* Fortschrittsring (Timer, Checkliste): Füllstand kommt aus der CSS-Variable --p (0 … 1) am Elternelement */
  const ring = (cls = "") => `<svg class="ring ${cls}" viewBox="0 0 48 48" aria-hidden="true"><circle class="trk" cx="24" cy="24" r="20"/><circle class="val" cx="24" cy="24" r="20" pathLength="100"/></svg>`;
  /* Kleine Bilder für Einführung, Laden, Fertig und Alarm – gezeichnet, keine Emojis */
  const ART = {
    pot: '<svg class="art" viewBox="0 0 96 96" aria-hidden="true"><path class="steam s1" d="M38 30q-5-6 0-12t0-12"/><path class="steam s2" d="M48 30q-5-6 0-12t0-12"/><path class="steam s3" d="M58 30q-5-6 0-12t0-12"/><g class="lid"><path d="M24 44q24-14 48 0z" class="fill-a"/><circle cx="48" cy="34" r="3.5" class="fill-a"/></g><path d="M22 48h52v18a14 14 0 0 1-14 14H36a14 14 0 0 1-14-14z" class="fill-a"/><path d="M14 54h8M74 54h8" class="st-a"/><circle cx="48" cy="63" r="8" class="fill-b"/><path d="M48 58v5l3 2" class="st-c"/></svg>',
    cal: '<svg class="art" viewBox="0 0 96 96" aria-hidden="true"><rect x="18" y="22" width="60" height="56" rx="12" class="fill-a"/><path d="M18 40h60" class="st-c"/><path d="M34 14v14M62 14v14" class="st-a"/><circle cx="58" cy="58" r="9" class="fill-b"/></svg>',
    timer: '<svg class="art" viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="54" r="28" class="fill-a"/><path d="M48 54L48 36" class="st-c"/><path d="M48 54l12 7" class="st-c"/><path d="M40 16h16M48 16v10" class="st-a"/><path d="M48 26a28 28 0 0 1 28 28H48z" class="fill-b op"/></svg>',
    swap: '<svg class="art" viewBox="0 0 96 96" aria-hidden="true"><rect x="14" y="20" width="44" height="28" rx="9" class="fill-a"/><rect x="38" y="52" width="44" height="28" rx="9" class="fill-b"/><path d="M68 22q12 4 12 18M74 36l6 6 5-7M28 76q-12-4-12-18M22 62l-6-6-5 7" class="st-a"/></svg>',
    cart: '<svg class="art" viewBox="0 0 96 96" aria-hidden="true"><path d="M12 20h10l8 38h40l8-28H28" class="st-a"/><path d="M30 34h44l-6 20H34z" class="fill-a"/><circle cx="36" cy="72" r="6" class="fill-b"/><circle cx="66" cy="72" r="6" class="fill-b"/></svg>',
    plate: '<svg class="art" viewBox="0 0 120 96" aria-hidden="true"><path class="steam s1" d="M48 34q-5-6 0-12t0-12"/><path class="steam s2" d="M60 34q-5-6 0-12t0-12"/><path class="steam s3" d="M72 34q-5-6 0-12t0-12"/><ellipse cx="60" cy="66" rx="50" ry="14" class="fill-c"/><path d="M26 62a34 22 0 0 1 68 0z" class="fill-a"/><circle cx="60" cy="38" r="5" class="fill-a"/><path d="M8 80h104" class="st-a"/></svg>',
    bell: '<svg class="art" viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="54" r="30" class="fill-w"/><path d="M48 54V34M48 54l13 8" class="st-o"/><path d="M38 14h20M48 14v10M18 26l10-8M78 26l-10-8" class="st-w"/></svg>',
  };
  const tone = (tags) => { const t = tags || []; return t.includes("Fleisch") ? "meat" : t.includes("Fisch") ? "fish" : t.includes("Vegetarisch") ? "veg" : ""; };

  /* ---------- Daten ---------- */
  const EMB = document.getElementById("embedded-data");
  const embedded = EMB ? JSON.parse(EMB.textContent) : null;
  const memo = {};
  async function getJSON(path, fresh) {
    if (embedded) {
      if (!(path in embedded.files)) throw new Error("nicht enthalten: " + path);
      return embedded.files[path];
    }
    if (memo[path] && !fresh) return memo[path];
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status + " " + path);
    return (memo[path] = await res.json());
  }
  let weeks = [], weekId = null, lastLoad = 0, weekManual = false, builtAt = null;
  const weekFile = (id) => `daten/wochen/${id}.json`;
  async function loadIndex(fresh) {
    const idx = await getJSON("daten/wochen.json", fresh);
    weeks = (idx.weeks || []).map((w) => ({ ...w, id: w.file.replace(/\.json$/, "") }));
    builtAt = idx.built || null;
    lastLoad = Date.now();
    if (!weekManual || !weekId || !weeks.some((w) => w.id === weekId)) { weekManual = false; weekId = (pickWeek(weeks) || {}).id || null; }
  }
  const week = (id = weekId) => getJSON(weekFile(id));
  async function getRecipe(ref) {
    const [kind, a, b] = ref.split(":");
    if (kind === "w") { const w = await week(a); const r = w.recipes[b]; if (!r) throw new Error("Rezept fehlt"); return r; }
    return getJSON(`daten/rezepte/${a}.json`);
  }

  /* ---------- Datum ---------- */
  const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => toIso(new Date());
  const addDays = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return toIso(new Date(y, m - 1, d + n)); };
  const hm = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  function pickWeek(list) {
    const t = today();
    // Eine Planwoche reicht vom Vorkoch-Sonntag davor bis Samstag.
    const cur = list.find((w) => addDays(w.start, -1) <= t && t <= addDays(w.start, 5));
    if (cur) return cur;
    const next = list.filter((w) => w.start > t).sort((a, b) => (a.start < b.start ? -1 : 1))[0];
    return next || list[0];
  }
  const shortLabel = (w) => (w.week ? w.week.label : w.label).replace(/\s\d{4}$/, "");

  /* ---------- Zustand (nur auf diesem Gerät) ---------- */
  const LS = "kochbuddy.v1";
  const defaults = () => ({
    portions: {}, ing: {}, steps: {}, prep: {}, cook: {}, timers: [], block: {}, check: {}, rem: {}, eat: {}, dealcheck: {}, swaps: {}, bringAck: {}, bringOpened: {},
    settings: { sound: true, vibrate: true, scale: 1, theme: "auto", eat: { Mittag: "12:00", Abend: "18:00" }, installHint: true },
  });
  let S = defaults();
  try {
    const raw = JSON.parse(localStorage.getItem(LS) || "{}");
    S = { ...defaults(), ...raw, settings: { ...defaults().settings, ...(raw.settings || {}) } };
  } catch (e) { /* frisch starten */ }
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { /* voll oder gesperrt */ } };
  const bag = (name, key) => { S[name] = S[name] || {}; return (S[name][key] = S[name][key] || {}); };
  /* ---------- Fehlerprotokoll ----------
     Fehler der App werden ohne persönliche Inhalte gesammelt (Meldung, Stelle im Code, Ansicht, App-Stand, System)
     und mit Schlüssel ins private Repo geschrieben (logs/app-fehler.json). Der Buddy prüft das stündlich und meldet Neues. */
  const NET_ERR = /Failed to fetch|NetworkError|Load failed|Gerade kein Netz|aborted|net::/i;
  function logError(kind, msg, stack) {
    try {
      msg = String(msg || "").replace(/github_pat_\w+|ghp_\w+/g, "[Schlüssel]").slice(0, 300);
      if (!msg || NET_ERR.test(msg)) return;
      const where = (String(stack || "").split("\n").find((l) => /app\.js|deals\.mjs/.test(l)) || "").replace(/^\s*at\s*/, "").replace(/https?:\/\/[^/]+/, "").trim().slice(0, 160);
      const key = `${kind}|${msg}|${where}`.slice(0, 400);
      let ver = ""; try { ver = codeTag || ""; } catch (e) { ver = ""; }
      S.errs = S.errs || {};
      const x = S.errs[key] || { kind, msg, where, n: 0, sent: 0, first: new Date().toISOString() };
      x.n++; x.last = new Date().toISOString(); x.route = (location.hash || "#/").split("/").slice(0, 2).join("/"); x.v = String(ver).slice(0, 40);
      x.sys = (navigator.userAgent.match(/Android [\d.]+|iPhone OS [\d_]+|iPad; CPU OS [\d_]+|Windows NT [\d.]+|Mac OS X [\d_]+/) || [""])[0];
      S.errs[key] = x;
      const keys = Object.keys(S.errs).sort((a, b) => (S.errs[a].last < S.errs[b].last ? 1 : -1));
      keys.slice(30).forEach((k) => delete S.errs[k]);
      save();
      if (typeof scheduleLogPush === "function") scheduleLogPush();
    } catch (e) { /* Protokoll darf nie selbst stören */ }
  }
  window.addEventListener("error", (e) => logError("Fehler", e.message, e.error && e.error.stack));
  window.addEventListener("unhandledrejection", (e) => logError("Promise", e.reason && (e.reason.message || e.reason), e.reason && e.reason.stack));
  function toggle(name, key, idx) { const b = bag(name, key); if (b[idx]) delete b[idx]; else b[idx] = 1; save(); return !!b[idx]; }

  /* ---------- Mengen ---------- */
  const FR = [[0, ""], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"], [1, ""]];
  function fmt(v) {
    let w = Math.floor(v + 1e-9), f = v - w, best = FR[0], bd = 1;
    for (const x of FR) { const d = Math.abs(f - x[0]); if (d < bd) { bd = d; best = x; } }
    if (bd < 0.04) { if (best[0] === 1) return String(w + 1); return (w ? String(w) : "") + best[1] || "0"; }
    return String(Math.round(v * 100) / 100).replace(".", ",");
  }
  function scaleVal(v, u, k) {
    if (k === 1) return v;
    let x = v * k;
    if (u === "g" || u === "ml") x = x >= 100 ? Math.round(x / 10) * 10 : x >= 20 ? Math.round(x / 5) * 5 : Math.max(1, Math.round(x));
    else if (u === "kg" || u === "l") x = Math.round(x * 20) / 20;
    else if (!u) x = x < 5 ? Math.max(0.5, Math.round(x * 2) / 2) : Math.round(x);
    else x = Math.max(0.25, Math.round(x * 4) / 4);
    return x;
  }
  function amount(i, k) {
    if (i.a == null) return "";
    let s = fmt(scaleVal(i.a, i.u, k));
    if (i.a2 != null) s += "–" + fmt(scaleVal(i.a2, i.u, k));
    return s + (i.u ? " " + i.u : "");
  }
  const portions = (ref, r) => S.portions[ref] || r.base || 3;

  /* ---------- Zeiten im Text erkennen ---------- */
  const UNIT = { Sek: 1, Min: 60, Std: 3600 };
  function durations(s) {
    const out = [], re = /(je\s+)?(\d+(?:,\d+)?)(?:\s*[–-]\s*(\d+(?:,\d+)?))?\s*(Sek|Min|Std)\.?/g;
    let m;
    while ((m = re.exec(s || ""))) {
      const mul = UNIT[m[4]], a = parseFloat(m[2].replace(",", ".")) * mul, b = m[3] ? parseFloat(m[3].replace(",", ".")) * mul : null;
      out.push({ min: a, max: b, start: m.index, end: m.index + m[0].length, text: m[0].replace(/^je\s+/, ""), each: !!m[1] });
    }
    return out;
  }
  function contextLabel(s, d) {
    const after = s.slice(d.end).replace(/^[\s.]+/, "");
    if (/^(länger|mehr|weniger|später|vorher|bevor|Kochzeit|Garzeit|Backzeit|Zeit)/i.test(after)) return null;
    if (/\bmit\s*$/i.test(s.slice(Math.max(0, d.start - 6), d.start))) return null;
    const before = s.slice(Math.max(0, d.start - 12), d.start);
    let lab = after.split(/[,.;:(]|\s(?:und|dann|bis|sonst|damit|dabei)\s/)[0].trim().split(/\s+/).slice(0, 4).join(" ");
    if (/nach\s*$/i.test(before) && lab) lab = "dann " + lab;
    return lab || "Timer";
  }
  const durText = (d) => d.text.replace(/\s+/g, " ");
  function stepTimers(st) {
    const list = [];
    for (const d of durations(st.set)) {
      if (d.min < 60) continue;
      list.push({ ...d, label: (DEV_SHORT[st.dev] || "") + (d.each ? " · je Seite" : ""), main: true });
      break;
    }
    for (const d of durations(st.t)) {
      if (d.min < 60 || list.some((x) => x.min === d.min && x.max === d.max)) continue;
      const lab = contextLabel(st.t, d);
      if (lab) list.push({ ...d, label: lab });
    }
    return list;
  }
  function noteTimers(note) {
    return durations(note).filter((d) => d.min >= 60).map((d) => ({ ...d, label: contextLabel(note, d) })).filter((d) => d.label);
  }
  const PHASE = /^((?:Am\s)?(?:Sonntag|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Vortag|Vorabend)(?:abend|mittag|morgen|früh|vormittag|nachmittag)?)\s*:\s*/i;
  const phaseOf = (t) => { const m = (t || "").match(PHASE); return m ? { phase: m[1], text: t.slice(m[0].length) } : { phase: null, text: t || "" }; };

  /* Zutaten, die in einem Schritt vorkommen (für "schon im Topf") */
  const ADJ = new Set("frisch frische frischer frisches braune braun rote rot gelbe gelb grüne grün kleine klein große groß vorwiegend festkochend mehligkochend festkochende edelsüß mittelscharf scharf salzarm gehackt gehackte tiefgekühlt tk getrocknet gemahlen gerieben geriebener natur griechischer weiche weich kalte kalt warme warm junge jung reife reif säuerlich säuerliche dünne dicke oder und für die der das zum zur mit von etwas nach geschmack bio optional dressing".split(" "));
  const HEADS = ["käse", "öl", "brühe", "stärke", "nudeln", "sahne", "milch", "mehl", "zucker", "essig", "saft", "mark", "pulver", "senf", "butter", "quark", "salz", "pfeffer", "tomaten", "reis", "salat", "fleisch"];
  function stems(ing) {
    const base = (ing.n || "").replace(/\(.*?\)/g, " ").split(",")[0];
    const out = new Set();
    const add = (w) => {
      w = (w || "").toLowerCase().replace(/[^a-zäöüß]/g, "");
      if (w.length < 3 || ADJ.has(w)) return;
      for (const h of HEADS) if (w.endsWith(h) && w !== h) out.add(h);
      let s = w;
      for (const suf of ["en", "n", "e", "s"]) if (s.length > 4 && s.endsWith(suf)) { s = s.slice(0, -suf.length); break; }
      out.add(s);
    };
    base.split(/[\s-]+/).forEach(add);
    if (ing.b) add(ing.b);
    return [...out];
  }
  /* Mengen direkt im Text: „Kartoffeln [1 kg] schälen“. Gesucht wird nach den Hauptwörtern der Zutat
     (großgeschrieben, z. B. Kartoffeln, Zitrone, Fleisch); Wortformen und Zusammensetzungen wie
     „Kartoffelscheiben“ oder „Orangensaft“ zählen mit, „Fleischprobe“ oder „Wasserbad“ nicht. */
  const STOP_N = new Set("haut schale saft dressing stück stücke form metzger sorte sorten scheiben glas dose packung mutti tube flasche".split(" "));
  const INFL = ["", "n", "e", "en", "s", "es", "er", "ern"];
  const FORMS = ["scheiben", "würfel", "würfeln", "stücke", "stücken", "streifen", "schale", "saft", "filet", "filets", "hälften", "ringe", "spalten", "blätter", "röschen", "zehe", "zehen", "stifte", "raspeln"];
  const nounMemo = new WeakMap(), derivedMemo = new WeakMap();
  function nounStems(ing) {
    if (nounMemo.has(ing)) return nounMemo.get(ing);
    const out = new Set(), derived = new Set();
    // Nur der eigentliche Name (vor Klammer und Komma) und der Bring-Name zählen. Klammern wie „(zum Garen der Kartoffeln)“
    // oder „(für die Bällchen)“ sagen nur, WOFÜR die Zutat ist – siehe qualStems.
    const src = (ing.n || "").replace(/\(.*?\)/g, " ").split(",")[0] + " " + (ing.b || "");
    for (const w0 of src.split(/[\s/]+/)) for (const w1 of w0.split("-")) {
      if (!/^[A-ZÄÖÜ]/.test(w1)) continue;
      let w = w1.toLowerCase().replace(/[^a-zäöüß]/g, "");
      if (w.length < 3 || STOP_N.has(w) || ADJ.has(w)) continue;
      for (const hd of HEADS) if (w.endsWith(hd) && w !== hd) { out.add(hd); derived.add(hd); }
      for (const suf of ["en", "n", "e", "s"]) if (w.length > 4 && w.endsWith(suf)) { w = w.slice(0, -suf.length); break; }
      out.add(w); derived.delete(w);
    }
    const res = [...out];
    nounMemo.set(ing, res);
    derivedMemo.set(ing, derived);
    return res;
  }
  /* Andere Namen derselben Zutat in der Klammer, z. B. „passierte Tomaten (Mutti Passata, Glasflasche)“ → Passata.
     Nur der erste Teil der Klammer und nie, wenn sie sagt, wofür die Zutat ist („für die Bällchen“, „zum Garen …“). */
  const aliasMemo = new WeakMap();
  function aliasStems(ing) {
    if (aliasMemo.has(ing)) return aliasMemo.get(ing);
    const out = [];
    const par = ((ing.n || "").match(/\(([^)]*)\)/) || ["", ""])[1].split(",")[0].trim();
    if (par && !/^(für|fürs|zum|zur|am|an|über|nur|aus|vom|von|je|ca|etwa|z\.|nach|ohne|mit)\b/i.test(par) && par.split(/\s+/).length <= 3) {
      for (const w1 of par.split(/[\s/-]+/)) {
        if (!/^[A-ZÄÖÜ][a-zäöüß]/.test(w1)) continue;
        let w = w1.toLowerCase().replace(/[^a-zäöüß]/g, "");
        if (w.length < 4 || STOP_N.has(w) || ADJ.has(w)) continue;
        for (const suf of ["en", "n", "e", "s"]) if (w.length > 4 && w.endsWith(suf)) { w = w.slice(0, -suf.length); break; }
        out.push(w);
      }
    }
    aliasMemo.set(ing, out);
    return out;
  }
  /* Wofür ist die Zutat? Wörter aus Klammer und nach dem Komma („fürs Püree“, „zum Garen der Kartoffeln“) */
  const QUAL_STOP = new Set("für fürs zum zur der die das den dem des und oder mit von vom im in am an auf aus bei nach etwa ca zum gut sehr plus extra".split(" "));
  const qualMemo = new WeakMap();
  function qualStems(ing) {
    if (qualMemo.has(ing)) return qualMemo.get(ing);
    const n0 = ing.n || "";
    const src = [...n0.matchAll(/\(([^)]*)\)/g)].map((x) => x[1]).join(" ") + " " + n0.replace(/\(.*?\)/g, " ").split(",").slice(1).join(" ");
    const out = new Set();
    for (const w0 of src.toLowerCase().split(/[^a-zäöüß]+/)) {
      if (w0.length < 4 || QUAL_STOP.has(w0) || ADJ.has(w0)) continue;
      let w = w0;
      for (const suf of ["en", "n", "e", "s"]) if (w.length > 5 && w.endsWith(suf)) { w = w.slice(0, -suf.length); break; }
      out.add(w);
    }
    const res = [...out];
    qualMemo.set(ing, res);
    return res;
  }
  /** Mehrere Zutaten mit demselben Namen (Wasser fürs Garen, Wasser für die Soße): die passende über den Schritttext wählen.
      Nicht eindeutig → -1 (lieber keine Menge als eine falsche). */
  function pickIng(r, cands, text) {
    if (cands.length === 1) return cands[0];
    const t = text.toLowerCase();
    const hit = cands.filter((i) => qualStems(r.ingredients[i]).some((q) => t.includes(q)));
    if (hit.length === 1) return hit[0];
    if (hit.length === 0) { const plain = cands.filter((i) => !qualStems(r.ingredients[i]).length); if (plain.length === 1) return plain[0]; }
    return -1;
  }
  function wordMatch(word, stem) {
    if (!word.startsWith(stem)) return false;
    const rest = word.slice(stem.length);
    if (INFL.includes(rest)) return true;
    const r2 = rest.replace(/^(en|n|e|s)(?=.)/, "");
    return FORMS.includes(rest) || FORMS.includes(r2);
  }
  /* Text mit Mengen-Etiketten. withIng: Etikett ist antippbar (Zutat abhaken). Gibt html und die gefundenen Zutaten zurück. */
  function annotate(r, text, k, withIng) {
    const ingBag = withIng ? bag("ing", withIng) : null;
    const used = new Set(), found = [];
    let out = "", last = 0, m;
    const re = /[A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)*/g;
    while ((m = re.exec(text))) {
      // Zutaten sind Hauptwörter: kleingeschriebene Wörter („garen“, „weich“) nie als Zutat lesen
      if (!/^[A-ZÄÖÜ]/.test(m[0])) continue;
      const parts = m[0].toLowerCase().split("-");
      let bestLen = 0, cands = [];
      const score = (stemsOf) => r.ingredients.forEach((ing, idx) => {
        if (ing.a == null) return;
        let sc = 0;
        const der = derivedMemo.get(ing) || new Set();
        for (const st of stemsOf(ing)) {
          // vorne passend (Kartoffel|scheiben) zählt voll; nur der Anfang der Zutat („Hähnchen“ → Hähnchenbrustfilet) schwächer;
          // „Zucker“ passt besser zu Zucker als zu Vanillezucker (dort nur abgeleitet)
          let v = parts.some((pt) => wordMatch(pt, st)) ? st.length : parts.some((pt) => pt.length >= 5 && st.startsWith(pt)) ? 1 : 0;
          if (v > 1 && der.has(st)) v -= 0.5;
          if (v > sc) sc = v;
        }
        if (sc > bestLen) { bestLen = sc; cands = [idx]; } else if (sc && sc === bestLen) cands.push(idx);
      });
      score(nounStems);
      if (!cands.length) score(aliasStems);
      if (!cands.length) continue;
      // „Wasser für die Kartoffeln“: hier nennen die Kartoffeln nur den Zweck – Etikett erst, wenn sie selbst in den Topf kommen
      if (/(?:wasser|milch|brühe|sahne|öl)\s+(?:für\s+die|für\s+den|fürs|zum|zur)\s+$/i.test(text.slice(Math.max(0, m.index - 24), m.index))) continue;
      // Schon in diesem Schritt erwähnt („1000 g Wasser … über Wasser garen“): gleiche Zutat, kein zweites Etikett
      if (cands.some((i) => used.has(i))) continue;
      const best = pickIng(r, cands, text);
      cands.forEach((i) => used.add(i));
      if (best < 0) continue;
      // Steht die Menge schon im Text („500 g Spätzle“) oder ist nur ein Teil gemeint („einen Schuss Wasser“, „den restlichen Käse“), nichts dazuschreiben
      const before = text.slice(Math.max(0, m.index - 22), m.index), after = text.slice(m.index + m[0].length, m.index + m[0].length + 24);
      if (/\d[\d,.½¼¾⅓⅔–-]*\s*(?:[a-zA-ZäöüÄÖÜß]{1,7}\.?\s+){0,2}$/.test(before.slice(-16))) continue;
      if (/(?:schuss|etwas|wenig|bisschen|spritzer|prise|rest\w*|übrige\w*|hälfte(?:\s+(?:der|des|vom))?)\s+(?:\w+\s+)?$/i.test(before)) continue;
      if (/(?:^|[\s.,:])(?:ein|eine|einen|einem)\s+(?:stück\s+)?$/i.test(before)) continue; // „eine Farfalle probieren“: nur ein Stück, nicht die ganze Menge
      if (/^wasser/i.test(m[0]) && /spül|wasch|einweich|abgieß|abschreck/i.test(after)) continue;
      found.push(best);
      const amt = qtyLabel(r.ingredients[best], m[0], amount(r.ingredients[best], k), scaleVal(r.ingredients[best].a, null, k));
      out += esc(text.slice(last, m.index)) + `<span class="iq${ingBag && ingBag[best] ? " on" : ""}"${withIng ? ` data-ing="${best}"` : ""}>${esc(m[0])}<b>${esc(amt)}</b></span>`;
      last = m.index + m[0].length;
    }
    return { html: out + esc(text.slice(last)), found };
  }
  /* Stückzahlen verständlich machen: „Knoblauch 1 Zehe“, „Orangensaft 1 Orange“, „Zwiebeln 3“ */
  function qtyLabel(ing, word, amt, num) {
    if (ing.u) return amt;
    const base = ((ing.n || "").replace(/\(.*?\)/g, " ").split(",")[0].match(/[A-ZÄÖÜ][a-zäöüß]+/) || [""])[0];
    if (!base) return amt;
    const lw = word.toLowerCase(), lb = base.toLowerCase();
    if (lb.startsWith(lw) && lb.length - lw.length >= 3) { let rest = base.slice(lw.length); rest = rest.charAt(0).toUpperCase() + rest.slice(1); if (num > 1 && rest.endsWith("e")) rest += "n"; return `${amt} ${rest}`; }
    const sb = lb.replace(/(en|n|e|s)$/, "");
    if (lw.startsWith(sb) && INFL.includes(lw.slice(sb.length))) return amt;
    return `${amt} ${base}`;
  }
  const shortIng = (ing) => (ing.n || "").replace(/\(.*?\)/g, "").split(",")[0].trim();
  const dayOf = (t) => { const ph = phaseOf(t).phase; const d = ph && ph.toLowerCase().match(/sonntag|montag|dienstag|mittwoch|donnerstag|freitag|samstag|vortag|vorabend/); return d ? d[0] : null; };
  /* Vorbereitungen gehören vor den ersten Schritt desselben Tages (z. B. „Montag: Feldsalat waschen“ vor „Montagabend: Ofen vorheizen“) */
  function prepForStep(r, i) {
    return (r.prep || []).map((x, n) => ({ x, n })).filter(({ x }) => {
      const d = dayOf(x);
      const j = d ? r.steps.findIndex((s) => dayOf(s.t) === d) : 0;
      return (j < 0 ? 0 : j) === i;
    });
  }
  /* Vorkoch-Zeitleiste: Welches Rezept ist gemeint? („Kartoffeln fürs Gratin …“, „für die Suppe …“)
     Gesucht wird über die Wörter im Rezepttitel, die keine Zutat sind (Gratin, Suppe, Auflauf …). */
  const TITLE_STOP = new Set("cremige cremiger mildes milde mildem frischem frischer frische selbst gemachte gemachtem".split(" "));
  function titleKeys(r) {
    const keys = new Set();
    for (const w0 of r.title.toLowerCase().split(/[\s&,]+/)) for (const w of [w0, ...w0.split("-")]) {
      const k = w.replace(/[^a-zäöüß]/g, "");
      if (k.length < 5 || TITLE_STOP.has(k)) continue;
      if (r.ingredients.some((ing) => nounStems(ing).some((st) => wordMatch(k, st)))) continue;
      keys.add(k);
    }
    return [...keys];
  }
  function recipeFor(text, w, prefer) {
    const words = (text.toLowerCase().match(/[a-zäöüß]+/g) || []).filter((x) => x.length >= 5);
    const hits = [];
    for (const [id, r] of Object.entries(w.recipes || {})) {
      const keys = titleKeys(r);
      // Zutatenwörter („Kartoffeln“) verraten das Rezept nicht – nur Gerichtwörter wie Gratin oder Suppe
      const isIng = (x) => r.ingredients.some((ing) => nounStems(ing).some((st) => wordMatch(x, st)));
      const pos = words.findIndex((x) => !isIng(x) && keys.some((k) => k === x || k.endsWith(x) || x.endsWith(k)));
      if (pos >= 0) hits.push({ id, r, pos, pri: prefer.includes(id) ? 0 : 1 });
    }
    hits.sort((a, b) => a.pos - b.pos || a.pri - b.pri);
    if (!hits.length || (hits[1] && hits[1].pos === hits[0].pos && hits[1].pri === hits[0].pri)) return null; // nicht eindeutig: lieber keine Mengen
    return hits[0];
  }
  function ingsForStep(r, text) {
    const t = " " + (text || "").toLowerCase() + " ";
    const hit = [];
    // Zutaten mit gleichem Namen (zweimal Wasser, zweimal Milch) nur über annotate (Kontext) zuordnen, nie beide
    const key = (ing) => (nounStems(ing)[0] || "");
    const count = {};
    r.ingredients.forEach((ing) => { const k0 = key(ing); if (k0) count[k0] = (count[k0] || 0) + 1; });
    r.ingredients.forEach((ing, i) => {
      if (count[key(ing)] > 1) return;
      const ss = stems(ing);
      if (ss.some((s) => (s === "öl" ? /[\s(]öl[\s,.)]/.test(t) : t.includes(s)))) hit.push(i);
    });
    return hit;
  }

  /* ---------- Darstellung: Bausteine ---------- */
  const tagClass = (t) => (t === "Fleisch" ? "meat" : t === "Fisch" ? "fish" : t === "Vegetarisch" ? "veg" : "");
  const tagChips = (tags, max = 4) => (tags || []).slice(0, max).map((t) => `<span class="chip ${tagClass(t)}">${esc(t)}</span>`).join("");
  function readout(st) {
    if (!st.dev && !st.set) return "";
    const segs = (st.set || "").split("·").map((x) => x.trim()).filter(Boolean)
      .map((x) => `<span class="seg-v${/\d\s*(Sek|Min|Std)/.test(x) ? " t" : ""}">${esc(x)}</span>`).join("");
    return `<div class="readout"><span class="dev">${esc(DEV[st.dev] || st.dev || "")}</span>${segs}</div>`;
  }
  const checkRow = (on, inner, attrs) => `<li class="check${on ? " on" : ""}" ${attrs}>${CHECK}<span class="txt">${inner}</span></li>`;
  function timerChip(t, ctx) {
    const run = S.timers.find((x) => x.ctx === ctx && x.state !== "gone");
    if (run) {
      const st = run.state === "pause" ? "pausiert" : run.state === "done" ? "fertig" : "läuft";
      return `<button class="timer-chip running${run.state === "pause" ? " paused" : ""}" data-timer-open="${run.id}" data-live="${run.id}" style="--p:${frac(run).toFixed(4)}">${ring()}<span>${clock(remaining(run))}</span><b>${esc(t.label || "Timer")} ${st}</b></button>`;
    }
    return `<button class="timer-chip" data-start='${esc(JSON.stringify(t))}'>${CLOCK}<em class="tc">${esc(durText(t))}</em>${t.label ? `<b>${esc(t.label)}</b>` : ""}<i>Timer starten</i></button>`;
  }
  const shortTitle = (title) => title.split(/\s(?:mit|aus|in|vom|&)\s/)[0];
  const excerpt = (s, n = 70) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + " …" : s);

  /* ---------- Router ---------- */
  let inCooking = false;
  async function route() {
    const h = decodeURIComponent(location.hash.slice(1) || "/");
    const parts = h.split("/").filter(Boolean);
    const view = $("#view");
    inCooking = parts[0] === "k";
    document.body.classList.toggle("cooking", inCooking);
    if (parts[0] === "verbinden") {
      if (validToken(parts[1])) { setGhToken(parts[1]); setTimeout(() => toast("Gerät verbunden – Tauschen ist eingerichtet"), 300); syncSwaps(true).then((ch) => { if (ch && !inCooking) rerenderSoft(); }); }
      navTo(parts[2] === "iphone" ? "#/iphone" : "#/", "replace"); return;
    }
    if (parts[0] && !["r", "k", "vorkochen", "checkliste", "angebote", "einkauf", "entdecken", "rezepte", "vorrat", "iphone"].includes(parts[0])) { navTo("#/", "replace"); return; }
    const nav = { "": "woche", r: "woche", vorkochen: "vorkochen", checkliste: "checkliste", angebote: "angebote", einkauf: "einkauf", entdecken: "entdecken", rezepte: "rezepte", vorrat: "rezepte" }[parts[0] || ""] ?? "";
    $$("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.nav === nav));
    try {
      if (!weeks.length) await loadIndex();
      if (weekId) { try { logMeals(withSwaps(await week())); } catch (e) { /* Woche fehlt */ } }
      await Promise.all([loadFotos(), loadRezIndex()]);
      if (!parts.length) await renderWeek(view);
      else if (parts[0] === "r") await renderRecipe(view, parts[1]);
      else if (parts[0] === "k") await renderCook(view, parts[1]);
      else if (parts[0] === "vorkochen") await renderPrep(view);
      else if (parts[0] === "checkliste") await renderChecklist(view);
      else if (parts[0] === "angebote") await renderDeals(view);
      else if (parts[0] === "einkauf") await renderEinkauf(view);
      else if (parts[0] === "rezepte") await renderAll(view);
      else if (parts[0] === "vorrat") await renderVorrat(view);
      else if (parts[0] === "entdecken") await renderDiscover(view);
      else if (parts[0] === "iphone") await renderIphone(view);
      else await renderWeek(view);
    } catch (e) {
      if (navigator.onLine !== false) logError("Laden", e.message, e.stack);
      view.innerHTML = `<div class="top"><h1>Kochbuddy</h1></div><div class="card"><h2>Gerade nicht ladbar</h2><p class="muted">Ohne Internet zeigt die App die zuletzt geöffneten Daten. Diese hier waren noch nicht gespeichert.</p><p class="small muted">${esc(e.message)}</p><button class="btn primary" data-act="reload">Nochmal versuchen</button></div>`;
    }
    updateWake();
    renderDock();
    if (!embedded) updateNavDot();
    maybeReview();
    if (!$("#newsbar")) setTimeout(maybeNews, 600);
  }
  window.addEventListener("hashchange", () => { trackNav(); route().then(() => { if (updateReady) applyUpdateIfIdle(); }); if (!inCooking) window.scrollTo(0, 0); });

  /* Verlauf innerhalb der App: "Zurück" (auch die Android-Zurücktaste) landet dort, wo man herkam.
     Tabs stapeln sich nicht: Woche -> Checkliste -> Vorkochen, dann Zurück = Woche, nochmal Zurück = App zu. */
  const TABS = ["#/", "#/checkliste", "#/vorkochen", "#/angebote", "#/einkauf", "#/entdecken", "#/rezepte", "#/vorrat"];
  const curHash = () => (location.hash && location.hash !== "#" ? location.hash : "#/");
  // Jeder Verlaufseintrag merkt sich seine Position (history.state.kb) – so passt die App-Liste immer zum echten Verlauf.
  const st0 = history.state && typeof history.state.kb === "number" ? history.state.kb : 0;
  const navStack = new Array(st0).fill(null).concat([curHash()]);
  history.replaceState({ ...(history.state || {}), kb: st0 }, "");
  let pendingNav = null;
  function trackNav() {
    const h = curHash(), st = history.state;
    if (pendingNav && pendingNav.type === "replace" && pendingNav.target === h) navStack[navStack.length - 1] = h;
    else if (st && typeof st.kb === "number") { navStack.length = st.kb + 1; navStack[st.kb] = h; } // Zurück/Vor
    else navStack.push(h); // neuer Eintrag
    history.replaceState({ kb: navStack.length - 1 }, "");
    if (pendingNav && pendingNav.ensure && pendingNav.target !== h) { const t = pendingNav.target; pendingNav = { type: "replace", target: t }; location.replace(t); return; }
    pendingNav = null;
  }
  function navTo(target, mode) {
    if (target === curHash()) return false;
    const i = navStack.lastIndexOf(target);
    if (mode !== "push" && i >= 0 && i < navStack.length - 1) { pendingNav = { type: "jump", target, ensure: true }; history.go(i - (navStack.length - 1)); return true; }
    if (mode === "replace") { pendingNav = { type: "replace", target }; location.replace(target); return true; }
    pendingNav = { type: "push", target }; location.hash = target; return true;
  }
  function goBack(fallback) {
    if (navStack.length > 1) { pendingNav = null; history.back(); }
    else navTo(fallback, "replace");
  }
  function tabTo(target) {
    const cur = curHash();
    if (target === cur) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (navStack.includes(target)) navTo(target, "jump");
    else navTo(target, TABS.includes(cur) && cur !== "#/" ? "replace" : "push");
  }

  /* ---------- Woche ---------- */
  const expanded = {};
  let noticeOpen = false;
  async function renderWeek(view) {
    if (!weekId) { view.innerHTML = `<div class="top"><h1>Kochbuddy</h1></div><p class="empty">Noch kein Wochenplan da.</p>`; return; }
    const w = withSwaps(await week());
    const ups = embedded ? [] : await bringUpdates();
    const t = today();
    const todayDay = w.days.find((d) => d.iso === t);
    const isPrepDay = addDays(w.week.start, -1) === t;
    let html = `<header class="top wk-top"><div><div class="eyebrow"><span class="kw">KW ${w.week.kw}</span>Euer Speiseplan</div><h1>${esc(shortLabel(w))}</h1></div>`;
    if (weeks.length > 1) {
      html += `<div class="seg wk-seg" role="group" aria-label="Woche wählen">${weeks.slice().reverse().map((x) =>
        `<button data-week="${x.id}" aria-pressed="${x.id === weekId}">KW ${x.kw}</button>`).join("")}</div>`;
    }
    html += `</header>`;
    html += weekStrip(w, t);
    html += syncBanner();
    html += planMissingBanner();
    html += actionBanners(ups, "todo");
    html += msgBanner();
    if (installEvt && S.settings.installHint && !standalone()) {
      html += `<div class="banner"><p>Als App auf dem Handy installieren?</p><button class="btn small" data-act="install">Installieren</button><button class="icon-btn" style="width:40px;height:40px;background:transparent;border:0;color:inherit" data-act="nohint" aria-label="Ausblenden">${CLOSE}</button></div>`;
    }
    if (embedded) html += `<div class="banner dark"><p style="font-weight:400">Vorschau im Claude-Fenster. Als installierte App auf dem Handy laufen Alarmton, Benachrichtigung und „Bildschirm bleibt an“ zuverlässig.</p></div>`;
    html += `<div class="wk-grid"><div class="wk-now">`;
    if (isPrepDay && w.prep && w.prep.timeline && prepDone(w)) {
      html += `<a class="card today prepcard done" href="#/vorkochen"><span class="kick"><i></i>Vorkochen erledigt</span><h2>${esc(w.prep.title || "Vorkoch-Block")}</h2><p>Alles fertig – hier steht, was wohin kommt.</p></a>`;
    } else if (isPrepDay && w.prep && w.prep.timeline) {
      html += `<a class="card today prepcard" href="#/vorkochen"><span class="kick"><i></i>Heute ist Vorkoch-Sonntag</span><h2>${esc(w.prep.title || "Vorkoch-Block")}</h2><p>${esc(w.prep.when || "")}</p><span class="btn light">${PLAY}Vorkochen starten</span></a>`;
    }
    const ordered = todayDay ? [todayDay, ...w.days.filter((d) => d !== todayDay && d.iso > t), ...w.days.filter((d) => d !== todayDay && d.iso < t)] : w.days;
    if (todayDay) html += dayCard(w, todayDay, true);
    const ev = currentEvening(w);
    if (ev && !todayDay && t >= addDays(w.week.start, -1) && t <= addDays(w.week.start, 5)) {
      const done = Object.keys(bag("check", `${weekId}:${ev.i}`)).length, n = ev.e.items.length, tIso = eveTarget(w, ev.e, ev.i), tFe = ironDays(w)(tIso);
      html += `<a class="card evening${done >= n ? " full" : ""}" href="#/checkliste" style="--p:${n ? (done / n).toFixed(3) : 0}"><span class="ev-ring">${ring()}<b>${done}/${n}</b></span><span class="ev-t"><small>Heute Abend vorbereiten</small><b>${esc(ev.e.for ? ev.e.for.charAt(0).toUpperCase() + ev.e.for.slice(1) : "Für morgen")}</b>${tFe ? `<span class="fe-chip">${FE}${esc(DAY_LONG(tIso))} ist Eisen-Tag</span>` : ev.e.tag ? `<span class="chip pump">${esc(ev.e.tag)}</span>` : ""}</span><span class="chev">${NEXT}</span></a>`;
    }
    html += rateCard();
    html += actionBanners(ups, "info");
    html += await discoverTeaser();
    html += msgCard();
    if (w.notice) html += `<div class="notice${noticeOpen ? "" : " clamp"}" data-act="notice"><b class="nt">Hinweis zum Plan</b><span>${esc(w.notice)}</span><i class="more">${noticeOpen ? "weniger" : "ganz lesen"}</i></div>`;
    html += `</div><div class="wk-rest">`;
    const rest = ordered.filter((d) => d !== todayDay);
    if (rest.length) html += `<h2 class="section-title">${todayDay ? "Weitere Tage" : "Die Woche"}</h2>` + rest.map((d) => dayCard(w, d, !!expanded[d.id], d.iso < t)).join("");
    if (w.extras && w.extras.length) {
      const canDrop = !embedded && w.days.some((d) => d.meals.some((m) => slotOpen(d.iso, m.slot)));
      html += `<h2 class="section-title">Ersatzgerichte</h2><section class="card extras">${w.extrasIntro ? `<p class="muted small" style="margin-top:0">${esc(w.extrasIntro)}</p>` : ""}`;
      if (canDrop) html += `<p class="how"><span class="grip-demo">${GRIP}</span><span><b>Tauschen:</b> Griff festhalten und auf einen Tag ziehen – oder „Tauschen“ antippen.</span></p>`;
      html += `<ul class="r-list x-list">${w.extras.map((id) => {
        const r = w.recipes[id];
        return r ? `<li class="xitem${tone(r.tags) ? " t-" + tone(r.tags) : ""}">${canDrop ? `<span class="grip" data-grip="${id}" role="button" aria-label="${esc(r.title)} auf einen Tag ziehen">${GRIP}</span>` : ""}<a href="#/r/w:${weekId}:${id}">${fotoThumb(r.slug)}<span class="xt"><b>${esc(r.title)}</b><span class="chips">${tagChips(r.tags, 2)}<span class="chip plain">${r.time.total} Min.</span>${lastChip(r.slug)}</span></span></a>${canDrop ? `<button class="btn small" data-swapopen="${id}">Tauschen</button>` : ""}</li>` : "";
      }).join("")}</ul>`;
      if (canDrop) html += `<p class="small muted" style="margin:14px 0 0">${ghToken() ? `Tauschen ist auf diesem Gerät eingerichtet. <a href="#" data-act="gh-qr">Weiteres Gerät verbinden</a>` : `<a href="#" data-act="gh-setup">Tauschen auf diesem Gerät einrichten</a>`}</p>`;
      html += `</section>`;
    }
    html += `</div></div>`;
    html += `<footer class="foot"><p class="small"><a href="#" data-act="help">So funktioniert der Kochbuddy</a> · <a href="#" data-act="news-open">Was ist neu?</a>${embedded ? "" : ` · <a href="#/iphone">Aufs iPhone: Widget & Siri</a>`}${embedded ? ` · <a href="#" data-act="review-demo">Wochen-Check zeigen</a>` : ""}</p><p class="small muted" id="stand">${standLine(w)}</p></footer>`;
    view.innerHTML = html;
    renderedDay = today();
  }
  /* Wochenleiste: alle Tage auf einen Blick, Tipp springt zum Tag. Punkte = Fleisch/Fisch/Vegetarisch je Mahlzeit. */
  function weekStrip(w, t) {
    const leg = new Set(), iron = ironDays(w);
    const days = w.days.map((d) => {
      const dots = d.meals.map((m) => { const r = w.recipes[m.recipe], c = r ? tone(r.tags) : ""; if (c) leg.add(c); return `<i class="${c}${m._swap ? " sw" : ""}"></i>`; }).join("");
      const fe = iron(d.iso); if (fe) leg.add("fe");
      return `<button class="wd${d.iso === t ? " now" : ""}${d.iso < t ? " past" : ""}${fe ? " iron" : ""}" data-jumpday="${d.id}" aria-label="${esc(d.name)} ${esc(d.date)}${fe ? ", Eisen-Tag" : ""}">${fe ? FE : ""}<small>${esc(d.name.slice(0, 2))}</small><b>${Number(d.iso.slice(8, 10))}</b><span class="dots">${dots}</span></button>`;
    }).join("");
    const names = { meat: "Fleisch", fish: "Fisch", veg: "Vegetarisch" };
    return `<nav class="wstrip" aria-label="Tage der Woche">${days}</nav><p class="legend">${["meat", "fish", "veg"].filter((c) => leg.has(c)).map((c) => `<span><i class="${c}"></i>${names[c]}</span>`).join("")}${leg.has("fe") ? `<span>${FE}Eisen-Tag fürs Kind</span>` : ""}<span class="lg-tip">Tag antippen springt hin</span></p>`;
  }
  function standLine(w) {
    if (embedded) return "Vorschau-Stand";
    const b = (w && w.built) || builtAt;
    const bt = b ? new Date(b) : null;
    const plan = bt && !isNaN(bt) ? `Plan vom ${DAYS[bt.getDay()].slice(0, 2)} ${pad(bt.getDate())}.${pad(bt.getMonth() + 1)}., ${hm(bt)}` : "Plan";
    return `${plan} · ${lastOnline ? `zuletzt geprüft ${hm(lastOnline)}` : "noch nicht online geprüft"} · <a href="#" data-act="reload">jetzt aktualisieren</a>`;
  }
  /* Eine Mahlzeit (Karte) – für die Tageskarten und den Tagesablauf von heute */
  function mealHtml(w, d, m, open, timeInfo) {
    const r = w.recipes[m.recipe];
    if (!r) return "";
    const ref = `w:${weekId}:${m.recipe}`;
    const prog = progress(ref, r), c = tone(r.tags);
    let h = `<div class="meal${c ? " t-" + c : ""}"${!embedded && slotOpen(d.iso, m.slot) ? ` data-drop="${d.iso}|${esc(m.slot)}"` : ""}><span class="slot">${esc(m.slot)}${m.kind === "haupt" ? "<em>Hauptmahlzeit</em>" : ""}</span>
        ${fotoThumb(r.slug, "meal-th")}<div class="mb"><a class="mt" href="#/r/${ref}"><b>${esc(r.title)}</b></a>
        <span class="chips">${timeInfo ? `<span class="chip pump">${CLOCK}${esc(timeInfo)}</span>` : ""}${m._swap ? `<span class="chip pump">${m._swap.status === "offen" ? "Getauscht · Übernahme 21 Uhr" : "Getauscht"}</span>${m._swap.status === "offen" ? `<button class="btn small ghost undo" data-unswap="${m._swap.id}">Rückgängig</button>` : ""}` : ""}${m.badge ? `<span class="chip pump">${esc(m.badge)}</span>` : ""}${m.mode === "aufwaermen" ? "" : `<span class="chip plain">${r.time.total} Min., davon ${r.time.active} aktiv</span>`}${prog ? `<span class="chip ok">${prog}</span>` : ""}</span>`;
    if (r.slug && eatenAt(d.iso, m.slot) <= Date.now()) h += `<div class="meal-rate">${starsHtml(r)}${babyBtn(r)}</div>`;
    if (open) {
      if (m.note) h += `<p class="note">${esc(m.note)}</p>`;
      const nts = m.mode === "aufwaermen" ? noteTimers(m.note) : [];
      h += `<div class="go">${nts.map((x, i) => timerChip({ min: x.min, max: x.max, text: x.text, label: x.label, title: shortTitle(r.title), sub: "Aufwärmen", ctx: `${ref}:n${i}` }, `${ref}:n${i}`)).join("")}
          <a class="btn${m.mode === "aufwaermen" ? " small" : " primary"}" href="#/${m.mode === "aufwaermen" ? "r" : "k"}/${ref}">${m.mode === "aufwaermen" ? "Rezept ansehen" : `${PLAY}${prog ? "Weiterkochen" : "Kochen"}`}</a></div>`;
    }
    return h + `</div></div>`;
  }
  function dayCard(w, d, open, past) {
    const isToday = d.iso === today();
    const [, mo, dd] = d.iso.split("-").map(Number), fe = ironDays(w)(d.iso);
    let h = `<section class="card day${isToday ? " today hero" : ""}${open ? " open" : " compact"}${past && !open ? " past" : ""}" id="day-${d.id}">`;
    if (isToday) h += `<div class="day-h" data-expand="${d.id}"><div class="hd"><span class="kick"><i></i>Heute${fe ? `<span class="kick-fe">${FE}Eisen-Tag fürs Kind</span>` : ""}</span><h2>${esc(d.name)}</h2></div><span class="date"><small>${MONTHS[mo - 1]}</small><b>${dd}</b></span></div>`;
    else h += `<div class="day-h" data-expand="${d.id}"><span class="date"><small>${MONTHS[mo - 1]}</small><b>${dd}</b></span><h2>${esc(d.name)}${fe ? ` <span class="fe-chip">${FE}Eisen-Tag</span>` : ""}</h2><span class="chev" aria-hidden="true">${NEXT}</span></div>`;
    if (isToday) return h + agendaHtml(w, d) + `</section>`;
    if (open && d.reminders && d.reminders.length) {
      h += `<ul class="plan-notes">${d.reminders.map((x) => planNote(esc(x))).join("")}</ul>`;
    }
    h += `<div class="meals">${d.meals.map((m) => mealHtml(w, d, m, open)).join("")}</div>`;
    return h + `</section>`;
  }

  /* ---------- Heute: Tagesablauf nach Zeitfenstern, danach „Für morgen vorbereiten“ ----------
     Erinnerungen werden nach Stichworten einsortiert (morgens, vormittags/einkaufen, mittags, nachmittags, abends);
     ohne Stichwort zum passenden Gericht, sonst unter „Heute“. Was abends schon für morgen ist, kommt in den Vorbereiten-Block. */
  const toMin = (hhmm) => { const [a, b] = String(hhmm || "0:0").split(":").map(Number); return a * 60 + (b || 0); };
  const fromMin = (m) => `${pad(Math.floor(((m % 1440) + 1440) % 1440 / 60))}:${pad(((m % 60) + 60) % 60)}`;
  function remWindow(t) {
    const s = t.toLowerCase();
    if (/nachmittag|vor dem essengehen/.test(s)) return "nachm";
    if (/^\s*abends?\b|\babends\b|heute abend/.test(s)) return "abend";
    if (/^\s*mittags?\b|\bmittags\b/.test(s)) return "mittag";
    if (/vormittag|einkauf|kaufen|ladenöffnung|wochenmarkt|\bmarkt\b/.test(s)) return "vorm";
    if (/morgens|\bfrüh\b|frühstück|gleich nach dem aufstehen/.test(s)) return "frueh";
    return "";
  }
  /* Tagesplan berechnen (für die Woche zum Nachschauen und für die Checkliste zum Abhaken) */
  function dayAgenda(w, d) {
    const eatM = toMin(S.settings.eat.Mittag || "12:00"), eatA = toMin(S.settings.eat.Abend || "18:00");
    const tmr = addDays(d.iso, 1), tmrName = DAY_LONG(tmr);
    const now = new Date(), nowM = now.getHours() * 60 + now.getMinutes();
    const win = {
      heute: { label: "Heute", time: "den ganzen Tag", end: 1440, items: [], meals: [] },
      frueh: { label: "Morgens", time: "bis 9 Uhr", end: 9 * 60, items: [], meals: [] },
      vorm: { label: "Vormittags", time: "9–12 Uhr", end: 12 * 60, items: [], meals: [] },
      mittag: { label: "Mittags", time: `Essen ${fromMin(eatM)} Uhr`, end: eatM + 90, items: [], meals: [] },
      nachm: { label: "Nachmittags", time: "14–17 Uhr", end: 17 * 60, items: [], meals: [] },
      abend: { label: "Abends", time: `Essen ${fromMin(eatA)} Uhr`, end: eatA + 90, items: [], meals: [] },
    };
    const prepRems = [];
    (d.reminders || []).forEach((x, i) => {
      let k = remWindow(x);
      const forTmr = new RegExp(`\\b${tmrName}\\b|für morgen`, "i").test(x);
      if (k === "abend" && forTmr && !/aufwärm|essen|backen|kochen/i.test(x.split(":")[0] || "")) { prepRems.push({ x, i }); return; }
      if (!k) { const m = recipeFor(x, w, d.meals.map((mm) => mm.recipe)); const meal = m && d.meals.find((mm) => mm.recipe === m.id); k = meal ? (/mittag/i.test(meal.slot) ? "mittag" : "abend") : "heute"; }
      win[k].items.push({ x, i, tag: forTmr ? `für ${tmrName.slice(0, 2)}` : "" });
    });
    for (const m of d.meals) {
      const r = w.recipes[m.recipe]; if (!r) continue;
      const k = /mittag/i.test(m.slot) ? "mittag" : "abend", eat = k === "mittag" ? eatM : eatA;
      // Vorgekochtes, nur noch heiß machen oder fertig backen: Dauer aus der Notiz statt der ganzen Rezeptzeit
      const quick = m.mode === "aufwaermen" || /nur noch|heiß machen|aufwärm|erhitzen|aufgetaut|direkt in den ofen|vorgekocht|vorbereitet/i.test(m.note || "");
      const mins = [...String(m.note || "").matchAll(/(\d+)(?:\s*[–-]\s*(\d+))?\s*Min/g)].map((x) => +(x[2] || x[1]));
      const dur = quick ? (mins.length ? Math.max(...mins) : 10) + 5 : Math.ceil((r.time.total || 30) / 5) * 5;
      const start = eat - dur;
      win[k].meals.push({ m, info: quick ? `ab ${fromMin(start)} heiß machen · essen ${fromMin(eat)}` : `anfangen ${fromMin(start)} · essen ${fromMin(eat)}` });
      if (!quick && start < 9 * 60 + 30 && k === "mittag") win.vorm.items.push({ x: `${shortTitle(r.title)} ansetzen (ca. ${r.time.total} Min.)`, i: null, tag: "" });
    }
    if (!win.mittag.meals.length) win.mittag.time = "12–14 Uhr";
    if (!win.abend.meals.length) win.abend.time = "ab 17 Uhr";
    const order = ["heute", "frueh", "vorm", "mittag", "nachm", "abend"];
    const curK = order.slice(1).find((k) => nowM < win[k].end) || "abend";
    // Für morgen vorbereiten: Abend-Checkliste (zielt auf morgen) + Erinnerungen von heute Abend für morgen
    const ev = d.iso === today() ? currentEvening(w) : null;
    const evItems = ev ? ev.e.items : [];
    // doppelte Punkte vermeiden: steht dasselbe Thema schon in der Abend-Checkliste, die Erinnerung weglassen
    const evText = evItems.join(" ").toLowerCase();
    for (let q = prepRems.length - 1; q >= 0; q--) { const words = (prepRems[q].x.toLowerCase().match(/[a-zäöüß]{5,}/g) || []).filter((x) => !["abends", "morgen", "heute"].includes(x)); if (words.length && words.filter((x) => evText.includes(x)).length / words.length >= 0.5) prepRems.splice(q, 1); }
    return { win, order, curK, nowM, prepRems, ev, evItems, tmr, tmrName, eatA };
  }
  /* Abhaken nur noch in der Checkliste: hier nur der Stand des Abends (Abend-Liste + Erinnerungen für morgen) */
  function prepCount(d, a) {
    const rem = bag("rem", `${weekId}:${d.id}`), ck = a.ev ? bag("check", `${weekId}:${a.ev.i}`) : {};
    return { done: Object.keys(ck).length + a.prepRems.filter((p) => rem[p.i]).length, n: a.evItems.length + a.prepRems.length };
  }
  const planNote = (inner, cls = "") => `<li class="pn${cls}"><span class="txt">${inner}</span></li>`;
  /* Heute in der Woche: rein zum Nachschauen – Tagesablauf mit Gerichten und Uhrzeiten, ohne Häkchen */
  function agendaHtml(w, d) {
    const a = dayAgenda(w, d), { win, curK, nowM } = a;
    let h = `<div class="agenda">`;
    for (const k of a.order) {
      const x = win[k];
      if (!x.items.length && !x.meals.length) continue;
      const past = k !== "heute" && nowM >= x.end, isNow = k === curK;
      h += `<section class="ag${past ? " ag-past" : ""}${isNow ? " ag-now" : ""}"><div class="ag-h"><b>${x.label}</b><small>${esc(x.time)}</small>${isNow ? `<span class="ag-badge">jetzt</span>` : ""}</div>`;
      if (x.items.length) h += `<ul class="plan-notes">${x.items.map((it) => planNote(esc(it.x) + (it.tag ? ` <span class="ag-tag">${esc(it.tag)}</span>` : ""), it.i == null ? " auto" : "")).join("")}</ul>`;
      if (x.meals.length) h += `<div class="meals">${x.meals.map((mm) => mealHtml(w, d, mm.m, true, mm.info)).join("")}</div>`;
      h += `</section>`;
    }
    h += `</div>`;
    if (a.evItems.length || a.prepRems.length) {
      const { done, n } = prepCount(d, a), tFe = ironDays(w)(a.tmr);
      const [, tm, td] = a.tmr.split("-").map(Number);
      h += `<a class="ag-prep agp-go${done >= n ? " full" : ""}" href="#/checkliste"><div class="agp-h"><div><span class="agp-k">Heute Abend · ab ca. ${fromMin(a.eatA + 90)} Uhr</span><b>Für morgen vorbereiten</b><small>${esc(a.tmrName)}, ${td}.${tm}.${tFe ? ` · <span class="fe-chip">${FE}Eisen-Tag</span>` : ""}</small></div><span class="ev-ring" style="--p:${n ? (done / n).toFixed(3) : 0}">${ring()}<b>${done}/${n}</b></span></div>`;
      h += `<span class="agp-link">${done >= n ? "Alles erledigt – in der Checkliste ansehen" : "In der Checkliste abhaken"}${NEXT}</span></a>`;
    }
    return h;
  }
  function progress(ref, r) {
    const n = Object.keys(S.steps[ref] || {}).length;
    if (!n) return "";
    return n >= r.steps.length ? "Gekocht ✓" : `Schritt ${n}/${r.steps.length}`;
  }
  /* Abend-Checkliste: Jeder Abend bereitet den FOLGETAG vor. Ziel-Datum aus „für Montag 16.11.“, sonst aus der Reihenfolge (So → Mo …). */
  const FE = '<span class="fe" aria-hidden="true">Fe</span>';
  function eveTarget(w, e, i) {
    const m = (e.for || "").match(/(\d{1,2})\.(\d{1,2})\./);
    if (m) {
      let y = w.week.year || Number(w.week.start.slice(0, 4));
      if (Number(m[2]) === 1 && w.week.start.slice(5, 7) === "12") y += 1;
      return `${y}-${pad(m[2])}-${pad(m[1])}`;
    }
    return addDays(w.week.start, i);
  }
  /* Eisen-Tage fürs Kind: jeden zweiten Tag. Maßgeblich ist der Plan (Abend mit tag „Eisen-Tag“ → Folgetag),
     außerhalb der Checkliste die feste Regel ab Dienstag 10.11.2026. */
  function ironDays(w) {
    const evs = (w.checklist && w.checklist.evenings) || [], set = new Set(), known = new Set();
    evs.forEach((e, i) => { const t = eveTarget(w, e, i); known.add(t); if (/eisen/i.test(e.tag || "")) set.add(t); });
    return (iso) => (known.has(iso) ? set.has(iso) : Math.round((new Date(iso + "T12:00") - new Date("2026-11-10T12:00")) / 86400000) % 2 === 0);
  }
  const DAY_LONG = (iso) => DAYS[new Date(iso + "T12:00").getDay()];
  function currentEvening(w) {
    const evs = (w.checklist && w.checklist.evenings) || [];
    const name = DAYS[new Date().getDay()];
    const i = evs.findIndex((e) => (e.day || "").startsWith(name));
    return i < 0 ? null : { i, e: evs[i] };
  }

  /* ---------- Rezept ---------- */
  async function renderRecipe(view, ref) {
    const r = await getRecipe(ref);
    const p = portions(ref, r), k = p / (r.base || 3);
    const ing = bag("ing", ref), pre = bag("prep", ref), steps = bag("steps", ref);
    const nDone = Object.keys(steps).length;
    const fromWeek = ref.startsWith("w:");
    const slot = fromWeek ? mealSlot(ref) : null;
    const eat = S.eat[ref] || (slot && S.settings.eat[slot]) || "";
    let h = `<div class="r-topbar"><a class="back" href="${fromWeek ? "#/" : "#/rezepte"}" data-act="back" data-fallback="${fromWeek ? "#/" : "#/rezepte"}">${BACK}Zurück</a>${embedded ? "" : `<button type="button" class="freeze-btn" data-freeze="${esc(ref)}" aria-label="Einfrieren: in den Vorrat und Etikett drucken" title="${esc(freezeName(r))} einfrieren">${SNOW}<span>Einfrieren</span></button>`}</div>`;
    if (canBT()) loadNiim().catch(() => {});
    const c = tone(r.tags), share = r.time.total ? Math.max(4, Math.min(100, Math.round((r.time.active / r.time.total) * 100))) : 100;
    h += fotoHero(r);
    h += `<div class="r-head${c ? " t-" + c : ""}${r.slug && rating(r.slug).kind ? " stamped" : ""}"><div class="chips">${tagChips(r.tags, 6)}</div><h1>${esc(r.title)}</h1>${stampHtml(r)}</div>`;
    h += `<div class="facts"><div class="fact"><b>${r.time.total}</b><span>Min. gesamt</span></div><div class="fact active"><b>${r.time.active}</b><span>Min. aktiv</span></div><div class="fact"><b>${r.steps.length}</b><span>Schritte</span></div>
      <div class="tbar" aria-hidden="true"><i style="width:${share}%"></i></div>${r.time.active < r.time.total ? `<p class="tlegend"><i></i>Aktiv am Herd: ${r.time.active} Min. – die übrige Zeit gart es von allein.</p>` : ""}</div>`;
    h += `<div class="r-cols"><div class="sticky">`;
    h += `<a class="btn primary big start" href="#/k/${ref}">${PLAY}${nDone && nDone < r.steps.length ? `Weiterkochen · Schritt ${nDone + 1}` : nDone ? "Nochmal kochen" : "Kochmodus starten"}</a>`;
    h += `<div class="card plan"><div class="line"><label for="eat-at"><b>Essen um</b></label><input id="eat-at" type="time" value="${esc(eat)}" data-eat="${esc(ref)}"></div><div class="line" id="plan-out">${planText(r, eat)}</div><p class="small muted" style="margin:0">Uhrzeit eintragen, dann rechnet die App aus, wann du anfangen musst.</p></div>`;
    h += `<div class="card"><div class="spread"><h3>Zutaten</h3><div class="stepper"><button data-portion="-1" aria-label="Weniger">−</button><output>${p} Port.</output><button data-portion="1" aria-label="Mehr">+</button></div></div>`;
    if (p !== (r.base || 3)) h += `<p class="small muted">Umgerechnet von ${r.base} Portionen. Garzeiten und die Füllmenge im Mixtopf (max. 2 l) im Blick behalten.</p>`;
    else if (r.servingsNote) h += `<p class="small muted">${esc(r.servingsNote)}</p>`;
    h += `<ul class="checks ing">${r.ingredients.map((i, n) => checkRow(ing[n], `<span class="q">${esc(amount(i, k))}</span><span>${esc(i.n)}</span>`, `data-ing="${n}"`)).join("")}</ul></div>`;
    h += `</div><div>`;
    h += notesTip(r.slug);
    if (r.prep && r.prep.length) h += `<div class="card"><h3>Vorbereiten</h3><ul class="checks">${r.prep.map((x, n) => { const ph = phaseOf(x); return checkRow(pre[n], `${ph.phase ? `<span class="phase">${esc(ph.phase)}</span> ` : ""}${annotate(r, ph.text, k).html}`, `data-prep="${n}"`); }).join("")}</ul></div>`;
    h += `<div class="card"><h3>Zubereitung</h3><ol class="steps-list">${r.steps.map((st, n) => {
      const ph = phaseOf(st.t);
      return `<li class="${steps[n] ? "done" : ""}" data-go="${n}">${ph.phase ? `<span class="phase">${esc(ph.phase)}</span><br>` : ""}<span class="stxt">${annotate(r, ph.text, k).html}</span>${readout(st)}${stepTimers(st).length ? `<div class="chips" style="margin-top:8px">${stepTimers(st).map((t) => `<span class="chip pump">${CLOCK}${esc(durText(t))}</span>`).join("")}</div>` : ""}</li>`;
    }).join("")}</ol></div>`;
    if (r.kid) h += `<div class="tip kid"><span class="tip-ico">${ICON_KID}</span><div><h3>Fürs Kind</h3><p style="margin:0">${esc(r.kid)}</p></div></div>`;
    if (r.store || !embedded) h += `<div class="card"><h3>Aufbewahren & Varianten</h3>${r.store ? `<p style="margin:6px 0 0">${esc(r.store)}</p>` : ""}${embedded ? "" : `<div class="freeze-line"><button type="button" class="btn small" data-freeze="${esc(ref)}">${SNOW} ${esc(freezeName(r))} einfrieren</button><span class="small muted">Etikett wird gedruckt · haltbar bis ${dmy(addMonthsIso(today(), freezeMonths(r)))} · ${vrCount(r.slug)}</span></div>`}</div>`;
    h += notesBox(r);
    h += rateBlock(r);
    h += verlaufCard(r);
    h += `<div class="links">${r.bring ? `<a class="btn small" href="${esc(r.bring)}">In Bring übernehmen</a>` : ""}${r.page ? `<a class="btn small ghost" href="${esc(r.page)}">Rezeptseite</a>` : ""}${nDone || Object.keys(ing).length || Object.keys(pre).length ? `<button class="btn small ghost" data-act="reset-recipe">Häkchen zurücksetzen</button>` : ""}</div>`;
    h += `</div></div>`;
    view.innerHTML = h;
    view.dataset.ref = ref;
  }
  function mealSlot(ref) {
    const [, wid, rid] = ref.split(":");
    const w = memo[weekFile(wid)] || (embedded && embedded.files[weekFile(wid)]);
    if (!w) return null;
    for (const d of w.days) for (const m of d.meals) if (m.recipe === rid && m.mode !== "aufwaermen") return m.slot;
    return null;
  }
  function planText(r, eat) {
    const now = Date.now(), total = r.time.total * 60000;
    if (eat) {
      const [H, M] = eat.split(":").map(Number);
      const d = new Date(); d.setHours(H, M, 0, 0);
      let start = d.getTime() - total, tomorrow = false;
      if (d.getTime() < now - 2 * 3600000) { start += 86400000; tomorrow = true; }
      if (start > now) return `<span>${tomorrow ? "Morgen spätestens" : "Spätestens"} anfangen um</span><span class="big-time">${hm(start)}</span>`;
      return `<span>Schon knapp: jetzt starten, fertig ca.</span><span class="big-time late">${hm(now + total)}</span>`;
    }
    return `<span>Jetzt starten, fertig ca.</span><span class="big-time">${hm(now + total)}</span>`;
  }

  /* ---------- Kochmodus ---------- */
  let cookRef = null, cookStep = 0, showList = false;
  async function renderCook(view, ref) {
    const r = await getRecipe(ref);
    if (cookRef !== ref) {
      cookRef = ref; showList = false;
      const done = bag("steps", ref);
      const c = S.cook[ref];
      cookStep = c && c.step != null ? c.step : r.steps.findIndex((_, i) => !done[i]);
      if (cookStep < 0) cookStep = 0;
    }
    const c0 = S.cook[ref];
    if (!c0 || !c0.start || Date.now() - (c0.touched || c0.start) > 6 * 3600000) { S.cook[ref] = { ...(c0 || {}), start: Date.now(), touched: Date.now(), step: cookStep }; save(); }
    drawCook(view, r, ref);
  }
  function drawCook(view, r, ref) {
    const steps = bag("steps", ref), ing = bag("ing", ref);
    const k = portions(ref, r) / (r.base || 3);
    const n = r.steps.length, i = Math.min(cookStep, n);
    const doneCount = Object.keys(steps).length;
    const c = S.cook[ref] || {};
    const dir = animDir; animDir = 0;
    let h = `<div class="cook-top"><a class="icon-btn" href="#/r/${esc(ref)}" data-act="back" data-fallback="#/r/${esc(ref)}" aria-label="Kochmodus beenden">${CLOSE}</a><div class="ttl"><b>${esc(r.title)}</b><span>${i < n ? `Schritt ${i + 1} von ${n}` : "Alles erledigt"} · ${doneCount} von ${n} abgehakt</span></div><button class="icon-btn note-btn" data-act="cook-note" aria-label="Notiz zum Rezept">${PEN}${notesOf(r.slug).length ? `<i>${notesOf(r.slug).length}</i>` : ""}</button><button class="icon-btn" data-act="cook-list" aria-label="Alle Schritte und Zutaten">${LIST}</button></div>`;
    h += `<div class="progress" role="progressbar" aria-label="Fortschritt" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${doneCount}">${r.steps.map((_, x) => `<i class="${steps[x] ? "d" : ""}${x === i ? " c" : ""}"></i>`).join("")}</div>`;
    if (showList) {
      h += `<div class="card"><h3>Alle Schritte</h3><ol class="steps-list">${r.steps.map((st, x) => `<li class="${steps[x] ? "done" : ""}" data-jump="${x}"><span class="stxt">${annotate(r, phaseOf(st.t).text, k).html}</span>${st.set ? `<div class="small muted">${esc(DEV_SHORT[st.dev] || "")} · ${esc(st.set)}</div>` : ""}</li>`).join("")}</ol></div>`;
      h += `<div class="card"><h3>Alle Zutaten</h3><ul class="checks ing">${r.ingredients.map((x, m) => checkRow(ing[m], `<span class="q">${esc(amount(x, k))}</span><span>${esc(x.n)}</span>`, `data-ing="${m}"`)).join("")}</ul></div>`;
      view.innerHTML = h + cookFoot(i, n, true);
      return;
    }
    if (i >= n) {
      h += `<div class="done-hero">${fotoOf(r.slug) ? `<span class="done-ph">${fotoImg(fotoOf(r.slug), 600)}</span>` : ART.plate}<h1>Fertig – guten Appetit!</h1><p class="muted">${c.start ? `Gekocht in ${Math.max(1, Math.round((Date.now() - c.start) / 60000))} Min.` : ""}</p></div>`;
      h += rateBlock(r, "Wie war's?");
      h += notesBox(r, { title: "Notiz fürs nächste Mal" });
      if (r.kid) h += `<div class="tip kid"><span class="tip-ico">${ICON_KID}</span><div><h3>Fürs Kind</h3><p style="margin:0">${esc(r.kid)}</p></div></div>`;
      if (r.store) h += `<div class="card"><h3>Aufbewahren</h3><p style="margin:6px 0 0">${esc(r.store)}</p></div>`;
      h += `<div class="links"><a class="btn primary" href="#/" data-act="home">Zur Woche</a><button class="btn ghost" data-act="cook-restart">Von vorn</button></div>`;
      view.innerHTML = h + cookFoot(i, n);
      return;
    }
    const st = r.steps[i], ph = phaseOf(st.t);
    const timers = stepTimers(st);
    const ann = annotate(r, ph.text, k, ref);
    const hits = [...new Set([...ann.found, ...ingsForStep(r, st.t)])];
    const preNow = prepForStep(r, i), pre = bag("prep", ref);
    h += cookHint();
    if (i === 0) h += notesTip(r.slug);
    h += `<div class="cook-cols"><div class="cook-step${dir ? (dir > 0 ? " in-fwd" : " in-back") : ""}">`;
    if (preNow.length) h += `<div class="card prep-now"><h3>${i === 0 ? "Zuerst vorbereiten" : "Jetzt vorbereiten"}</h3><ul class="checks">${preNow.map(({ x, n: pn }) => checkRow(pre[pn], annotate(r, phaseOf(x).text, k).html, `data-prep="${pn}"`)).join("")}</ul></div>`;
    h += `<div class="num"><b>${i + 1}</b><span>von ${n}</span>${steps[i] ? '<em class="chip ok">erledigt</em>' : ""}${ph.phase ? `<span class="phase">${esc(ph.phase)}</span>` : ""}</div>`;
    h += `<p class="stxt">${ann.html}</p>${readout(st)}`;
    if (timers.length) h += `<div class="cook-timers">${timers.map((t, x) => timerChip({ min: t.min, max: t.max, text: t.text, label: t.label, title: shortTitle(r.title), sub: `Schritt ${i + 1}: ${excerpt(t.main ? ph.text : t.label + " – " + ph.text)}`, ctx: `${ref}:${i}:${x}` }, `${ref}:${i}:${x}`)).join("")}</div>`;
    h += `</div><div>`;
    if (hits.length) {
      h += `<div class="card cook-ings"><h3>In diesem Schritt</h3><p class="small muted" style="margin:2px 0 4px">Abhaken, was schon drin ist – oder direkt die Menge im Text antippen.</p><ul class="checks ing">${hits.map((m) => checkRow(ing[m], `<span class="q">${esc(amount(r.ingredients[m], k))}</span><span>${esc(r.ingredients[m].n)}</span>`, `data-ing="${m}"`)).join("")}</ul></div>`;
    }
    const left = r.ingredients.length - Object.keys(ing).length;
    h += `<button class="btn ghost small all" data-act="cook-list">${LIST}Alle Zutaten & Schritte${left > 0 ? ` · ${left} Zutaten noch nicht abgehakt` : ""}</button>`;
    h += `<div class="cook-meta"><span>${c.start ? `Gestartet ${hm(c.start)} · geplant fertig ${hm(c.start + r.time.total * 60000)}` : ""}</span>${wakeLock ? '<span class="wake">Bildschirm bleibt an</span>' : ""}</div>`;
    h += `</div></div>`;
    view.innerHTML = h + cookFoot(i, n);
  }
  const cookFoot = (i, n, list) => `<div class="cook-foot"><div class="in">${list
    ? `<button class="btn big" data-act="cook-list" style="grid-column:1/-1">${BACK}Zurück zum Schritt</button>`
    : i >= n ? `<button class="btn big" data-act="cook-prev" style="grid-column:1/-1">${BACK}Letzter Schritt</button>`
    : `<button class="btn big" data-act="cook-prev" ${i === 0 ? "disabled" : ""}>${BACK}Zurück</button><button class="btn big primary" data-act="cook-next">${i === n - 1 ? "Erledigt, fertig" : `Erledigt, weiter${NEXT}`}</button>`}</div></div>`;
  let animDir = 0;
  async function cookGo(delta, markDone) {
    const r = await getRecipe(cookRef);
    if (markDone) { bag("steps", cookRef)[cookStep] = 1; }
    const before = cookStep;
    cookStep = Math.max(0, Math.min(r.steps.length, cookStep + delta));
    animDir = cookStep === before ? 0 : delta;
    S.cook[cookRef] = { ...(S.cook[cookRef] || { start: Date.now() }), step: cookStep, touched: Date.now() };
    save();
    drawCook($("#view"), r, cookRef);
    window.scrollTo(0, 0);
    if (navigator.vibrate && S.settings.vibrate) navigator.vibrate(15);
  }
  // Wischen im Kochmodus
  let touchX = null, touchY = null;
  document.addEventListener("touchstart", (e) => { if (inCooking && !showList) { touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; } }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX, dy = e.changedTouches[0].clientY - touchY;
    touchX = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && !e.target.closest(".dock,#dock,.sheet")) cookGo(dx < 0 ? 1 : -1, dx < 0);
  }, { passive: true });

  /* ---------- Vorkochen (Sonntag) ---------- */
  /* Vorkoch-Block fertig: alles abgehakt, „Fertig“ getippt oder der Vorkoch-Tag ist vorbei */
  function prepDone(w, wid = weekId) {
    const p = w.prep || {}, B = S.block[wid] || {}, n = (p.timeline || []).length;
    if (!n) return false;
    if (B.end) return true;
    if (Object.keys(B.done || {}).length >= n) return true;
    return today() >= w.week.start;
  }
  async function renderPrep(view) {
    const w = await week();
    const p = w.prep || {};
    const B = S.block[weekId] || {};
    const off = (t) => { const [a, b] = String(t).split(":").map(Number); return (a * 60 + b) * 60000; };
    const el = B.start ? Date.now() - B.start : null;
    let cur = -1;
    if (el != null) (p.timeline || []).forEach((x, i) => { if (off(x.t) <= el) cur = i; });
    const nextI = cur + 1 < (p.timeline || []).length ? cur + 1 : -1;
    let h = `<header class="top"><div><div class="eyebrow">KW ${w.week.kw} · ${esc(p.short === "So" ? "Sonntag" : p.short || "")}</div><h1>${esc(p.title || "Vorkochen")}</h1></div></header>`;
    if (!p.timeline) { view.innerHTML = h + `<p class="empty">Diese Woche gibt es keinen Vorkoch-Block.</p>`; return; }
    const prepText = (t) => {
      const m = recipeFor(t, w, p.recipes || []);
      if (!m) return esc(t);
      const k = portions(`w:${weekId}:${m.id}`, m.r) / (m.r.base || 3), ann = annotate(m.r, t, k);
      // „(Suppe, Schritte 1–3)“: was in diesen Schritten sonst noch reinkommt, mit Menge darunter
      const sm = t.match(/Schritte?\s+(\d+)(?:\s*[–-]\s*(\d+))?/);
      let extra = [];
      if (sm) {
        const a1 = +sm[1], a2 = +(sm[2] || sm[1]);
        for (let x = a1; x <= a2 && x <= m.r.steps.length; x++) for (const idx of annotate(m.r, phaseOf(m.r.steps[x - 1].t).text, k).found) if (!ann.found.includes(idx) && !extra.includes(idx)) extra.push(idx);
      }
      const ex = extra.map((idx) => `${esc(shortIng(m.r.ingredients[idx]))} <b>${esc(amount(m.r.ingredients[idx], k))}</b>`).join(" · ");
      return ann.html + (ex ? `<span class="tl-more">Dazu: ${ex}</span>` : "");
    };
    if (p.when) h += `<p class="muted" style="margin:0 0 6px;font-weight:700">${esc(p.when)}</p>`;
    const done = prepDone(w), n = p.timeline.length, nDone = Object.keys(B.done || {}).length;
    const storage = p.storage && p.storage.length ? `<div class="section-title">Was wohin kommt</div><div class="card"><table class="storage">${p.storage.map((s) => `<tr><td>${esc(s.what)}</td><td>${esc(s.where)}<div class="small muted">${esc(s.until || "")}</div></td></tr>`).join("")}</table></div>` : "";
    const tl = `<ul class="tl">${p.timeline.map((x, i) => `<li class="${!done && i === cur ? "now" : ""}${!done && i < cur ? " past" : ""}${B.done && B.done[i] ? " on" : ""}" data-tl="${i}"><span class="at">${B.start ? hm(B.start + off(x.t)) + `<small>+${esc(x.t)}</small>` : `${esc(x.t)}${i === 0 ? "<small>Start</small>" : ""}`}</span><span class="node">${CHECK}</span><span class="tx">${prepText(x.text)}</span></li>`).join("")}</ul>`;
    if (done) {
      // Fertig: oben die Bestätigung, gleich darunter „Was wohin kommt“, die Zeitleiste zugeklappt ganz unten
      const when = B.end ? `um ${hm(B.end)} Uhr` : B.start ? `gestartet um ${hm(B.start)} Uhr` : "";
      h += `<div class="card prep-done"><span class="pd-ico"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><div><b>Vorkochen erledigt</b><p>${nDone >= n ? `Alle ${n} Schritte abgehakt` : nDone ? `${nDone} von ${n} Schritten abgehakt` : "Der Vorkoch-Tag ist vorbei"}${when ? ` · ${esc(when)}` : ""}. Jetzt zählt nur noch, was wohin kommt.</p></div></div>`;
      h += storage;
    } else if (p.intro) h += `<p>${esc(p.intro)}</p>`;
    if (done) { /* kein Start- oder Live-Block mehr */ }
    else if (!B.start) h += `<div class="card prep-go"><button class="btn primary big" data-act="block-start">${PLAY}Jetzt mit dem Vorkochen starten</button><p class="small muted" style="margin:10px 0 0">Die Zeitleiste bekommt dann echte Uhrzeiten, der aktuelle Schritt wird markiert. Erledigtes antippen zum Abhaken.</p></div>`;
    else {
      const nx = nextI >= 0 ? B.start + off(p.timeline[nextI].t) : 0;
      h += `<div class="card today live"><div class="spread"><div><span class="kick"><i></i>Gestartet um ${hm(B.start)}</span><b class="nexttime">${nextI >= 0 ? `Als Nächstes um ${hm(nx)}` : "Letzter Schritt erreicht"}</b>${nextI >= 0 ? `<p>in ${Math.max(0, Math.ceil((nx - Date.now()) / 60000))} Min.: ${esc(excerpt(p.timeline[nextI].text, 80))}</p>` : ""}</div><button class="btn small light" data-act="block-reset">Neu starten</button></div>`;
      h += `<div class="set-row"><span>Bei jedem Zeitpunkt mit Ton erinnern</span><label class="switch"><input type="checkbox" data-act="block-beep" ${B.beep ? "checked" : ""}><span></span></label></div>`;
      h += `<button class="btn small" style="margin-top:10px" data-act="block-finish"><svg class="ico" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Vorkochen ist fertig</button></div>`;
    }
    if (!done) h += tl;
    // Auch Rezepte, die nur in der Zeitleiste vorkommen (z. B. „Kartoffeln fürs Gratin“), hier verlinken
    const blockIds = [...new Set([...(p.recipes || []), ...p.timeline.map((x) => (recipeFor(x.text, w, p.recipes || []) || {}).id).filter(Boolean)])];
    if (blockIds.length) {
      h += `<h2 class="section-title">Rezepte im Vorkoch-Block</h2><ul class="r-list">${blockIds.map((id) => {
        const r = w.recipes[id]; return r ? `<li class="${tone(r.tags) ? "t-" + tone(r.tags) : ""}"><a href="#/r/w:${weekId}:${id}"><b>${esc(r.title)}</b><span class="small muted">${(p.recipes || []).includes(id) ? esc(p.recipeNote || "") : "Rezept mit allen Mengen öffnen"}</span></a></li>` : "";
      }).join("")}</ul>`;
    }
    if (!done) h += storage;
    else {
      h += `<details class="card tl-fold"><summary><b>Zeitleiste ansehen</b><span class="small muted">${n} Schritte${nDone ? `, ${nDone} abgehakt` : ""}</span></summary>${p.intro ? `<p class="small muted">${esc(p.intro)}</p>` : ""}${tl}${B.start || B.end ? `<button class="btn small ghost" data-act="block-reset">Block neu starten</button>` : ""}</details>`;
    }
    view.innerHTML = h;
  }
  function blockTimers(beep) {
    const B = S.block[weekId];
    S.timers = S.timers.filter((t) => !(t.ctx || "").startsWith(`block:${weekId}:`));
    if (beep && B && B.start) {
      week().then((w) => {
        (w.prep.timeline || []).forEach((x, i) => {
          const [a, b] = x.t.split(":").map(Number), at = B.start + (a * 60 + b) * 60000;
          if (at > Date.now() + 5000) addTimer({ title: "Vorkochen", sub: x.text, label: `+${x.t}`, ctx: `block:${weekId}:${i}`, endAt: at, min: (at - Date.now()) / 1000 }, true);
        });
        save(); renderDock(); scheduleTimers();
      });
    }
    save(); renderDock();
  }

  /* ---------- Checkliste: hier wird alles abgehakt – erst was heute ansteht, dann die Abende ---------- */
  // Fertig abgehakte Listen klappen zu; ein Tipp auf den Kopf öffnet sie wieder (gemerkt, bis die Liste wieder offen ist)
  const clOpen = {};
  function clFold(key, n, all, done) {
    const full = all > 0 && n >= all;
    if (!full) { delete clOpen[key]; return { cls: "", attrs: "", extra: "" }; }
    const open = !!clOpen[key];
    return { cls: open ? " full" : " full folded", attrs: ` data-clfold="${key}" role="button" aria-expanded="${open}"`, extra: `<small class="cl-done">${done}</small>`, chev: `<span class="chev cl-chev" aria-hidden="true">${NEXT}</span>` };
  }
  async function renderChecklist(view) {
    const w = withSwaps(await week());
    const c = w.checklist || {};
    const cur = currentEvening(w), iron = ironDays(w), t = today();
    const todayDay = w.days.find((d) => d.iso === t);
    const ag = todayDay ? dayAgenda(w, todayDay) : null;
    const rem = todayDay ? bag("rem", `${weekId}:${todayDay.id}`) : {};
    // Erinnerungen von heute Abend für morgen kommen in die Abend-Karte; gibt es keine, bleiben sie bei „Heute“
    const extraEve = ag && cur ? ag.prepRems : [];
    let h = `<header class="top"><div><div class="eyebrow">KW ${w.week.kw}</div><h1>Checkliste</h1></div></header>`;
    if (ag) {
      const groups = ag.order.map((k) => ({ k, x: ag.win[k], items: ag.win[k].items.filter((it) => it.i != null) }));
      if (!cur) ag.prepRems.forEach((p) => groups[groups.length - 1].items.push({ x: p.x, i: p.i, tag: `für ${ag.tmrName.slice(0, 2)}` }));
      const all = groups.reduce((s, g) => s + g.items.length, 0);
      if (all) {
        const n = groups.reduce((s, g) => s + g.items.filter((it) => rem[it.i]).length, 0);
        const [, mo, dd] = t.split("-").map(Number), f = clFold(`d:${todayDay.id}`, n, all, "Alles erledigt ✓");
        h += `<section class="card cl cl-day today${f.cls}"><div class="cl-h"${f.attrs}><div><span class="kick"><i></i>Heute erledigen</span><h2>${esc(todayDay.name)}</h2>${f.extra}</div><span class="cl-r"><span class="ev-ring" style="--p:${(n / all).toFixed(3)}">${ring()}<b>${n}/${all}</b></span>${f.chev || ""}</span></div>
          <p class="small cl-sub">${dd}.${mo}. · Gerichte und Uhrzeiten stehen in der Woche</p>`;
        for (const g of groups) {
          if (!g.items.length) continue;
          h += `<div class="cl-when"><b>${esc(g.x.label)}</b><small>${esc(g.x.time)}</small></div><ul class="checks">${g.items.map((it) => checkRow(rem[it.i], esc(it.x) + (it.tag ? ` <span class="ag-tag">${esc(it.tag)}</span>` : ""), `data-rem="${todayDay.id}:${it.i}"`)).join("")}</ul>`;
        }
        h += `</section>`;
      }
    }
    h += `<h2 class="section-title">${esc(c.title || "Abend-Checkliste")}</h2>`;
    if (c.intro) h += `<p class="muted">${esc(c.intro)}</p>`;
    // Die Woche fürs Kind: Eisen-Tage auf einen Blick (Mo–So)
    const wk = [0, 1, 2, 3, 4, 5, 6].map((x) => addDays(w.week.start, x));
    h += `<section class="fe-week" aria-label="Eisen-Tage dieser Woche"><div class="fe-row">${wk.map((iso) => `<span class="fd${iron(iso) ? " iron" : ""}${iso === t ? " now" : ""}${iso < t ? " past" : ""}"><small>${DAYS[new Date(iso + "T12:00").getDay()].slice(0, 2)}</small><b>${Number(iso.slice(8, 10))}</b>${iron(iso) ? FE : "<i></i>"}</span>`).join("")}</div>
      <p>${FE}<span><b>Eisen-Tag fürs Kind</b> – jeden zweiten Tag. Vorbereitet wird immer <b>am Abend davor</b>: Apfelmark bereitstellen, Hirse bzw. Hafer einweichen.</span></p></section>`;
    const evs = (c.evenings || []).map((e, i) => ({ e, i }));
    if (cur) evs.sort((a, b) => (a.i === cur.i ? -1 : b.i === cur.i ? 1 : 0));
    h += evs.map(({ e, i }) => {
      const b = bag("check", `${weekId}:${i}`);
      const isCur = cur && cur.i === i, extra = isCur ? extraEve : [];
      const n = Object.keys(b).length + extra.filter((p) => rem[p.i]).length;
      const all = e.items.length + extra.length, tIso = eveTarget(w, e, i), fe = iron(tIso);
      const otherTag = e.tag && !/eisen/i.test(e.tag) ? `<span class="chip pump">${esc(e.tag)}</span>` : "";
      const f = clFold(`e:${i}`, n, all, `Alles erledigt · für ${esc(DAY_LONG(tIso))}, ${Number(tIso.slice(8, 10))}.${Number(tIso.slice(5, 7))}.`);
      const items = e.items.map((x, j) => {
        const ir = /^Eisen:\s*/i.test(x);
        return checkRow(b[j], ir ? `${FE}${esc(x.replace(/^Eisen:\s*/i, ""))}` : esc(x), `data-cl="${i}:${j}"${ir ? ' data-iron="1"' : ""}`);
      }).join("") + extra.map((p) => checkRow(rem[p.i], esc(p.x), `data-rem="${todayDay.id}:${p.i}"`)).join("");
      return `<section class="card cl${isCur ? " today" : ""}${f.cls}" style="--p:${all ? (n / all).toFixed(3) : 0}">
        <div class="cl-h"${f.attrs}><div>${isCur ? '<span class="kick"><i></i>Heute Abend erledigen</span>' : ""}<h2>${esc(e.day)}</h2>${f.extra}</div><span class="cl-r"><span class="ev-ring">${ring()}<b>${n}/${all}</b></span>${f.chev || ""}</span></div>
        <div class="cl-target${fe ? " iron" : ""}"><span class="arrow" aria-hidden="true">${NEXT}</span><span class="date"><small>${DAYS[new Date(tIso + "T12:00").getDay()].slice(0, 2)}</small><b>${Number(tIso.slice(8, 10))}</b></span>
          <span class="tg"><small>bereitet vor für</small><b>${esc(DAY_LONG(tIso))}, ${Number(tIso.slice(8, 10))}.${Number(tIso.slice(5, 7))}.</b></span>${fe ? `<span class="fe-chip">${FE}Eisen-Tag</span>` : ""}${otherTag}</div>
        <ul class="checks">${items}</ul>${e.note ? `<p class="small cl-note">${esc(e.note)}</p>` : ""}</section>`;
    }).join("");
    if (!evs.length) h += `<p class="empty">Keine Checkliste in diesem Plan.</p>`;
    view.innerHTML = h;
  }

  /* ---------- Sicherung: Hinweis, sobald etwas nur auf diesem Gerät liegt ---------- */
  function pendingInfo() {
    const ats = [];
    const add = (ops) => (ops || []).forEach((o) => { const a = o.at || (o.swap && o.swap.at); if (a) ats.push(new Date(a).getTime()); else ats.push(Date.now()); });
    add(stars().ops); add(notesSt().ops); add(taste().ops); add(ek().ops); add(vr().ops); add(msgSt().ops);
    for (const k of Object.keys(S.swaps || {})) add((S.swaps[k] || {}).ops);
    return { n: ats.length, since: ats.length ? Math.min(...ats) : 0 };
  }
  function syncBanner() {
    if (embedded) return "";
    const p = pendingInfo(), err = S.sync && S.sync.err, tok = !!ghToken();
    let k = "", title = "", text = "", btn = `<button class="btn primary" data-act="gh-setup">Speichern einrichten</button>`;
    if (!tok && (p.n || ablage.privat)) { k = "Bitte einrichten"; title = p.n ? `${p.n} ${p.n === 1 ? "Eintrag liegt" : "Einträge liegen"} nur auf diesem Gerät` : "Sterne und Notizen der anderen Geräte fehlen"; text = "Mit einem GitHub-Schlüssel wird alles sicher gespeichert und erscheint auf allen Geräten. Einmal einrichten, der Schlüssel läuft nie ab."; }
    else if (tok && err && err.code === "auth") { k = "Speichern klappt gerade nicht"; title = "Schlüssel ungültig oder abgelaufen"; text = `${esc(err.msg)}. Nichts geht verloren – alles wartet auf diesem Gerät${p.n ? ` (${p.n} ${p.n === 1 ? "Eintrag" : "Einträge"})` : ""}, bis ein neuer Schlüssel eingetragen ist.`; btn = `<button class="btn primary" data-act="gh-setup">Neuen Schlüssel eintragen</button>`; }
    else if (tok && ablage.privat && privOk === false) { k = "Einmal erneuern"; title = "Schlüssel braucht Zugriff auf die private Ablage"; text = `Die Daten liegen jetzt privat im Repo Einkaufsbuddy-Daten. Beim GitHub-Schlüssel dieses Repo zusätzlich auswählen (oder einen neuen Schlüssel ohne Ablauf anlegen). Bis dahin bleibt alles auf diesem Gerät${p.n ? ` (${p.n} ${p.n === 1 ? "Eintrag" : "Einträge"})` : ""}.`; btn = `<a class="btn primary" href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noopener">Schlüssel bei GitHub öffnen</a><button class="btn" data-act="gh-setup">Neuen eintragen</button>`; }
    else if (tok && p.n && Date.now() - p.since > 24 * 3600000) { k = "Nur zur Info"; title = "Seit über einem Tag nicht gespeichert"; text = `${p.n} ${p.n === 1 ? "Eintrag wartet" : "Einträge warten"} auf diesem Gerät. Sobald wieder Netz da ist, speichert die App von selbst.`; btn = `<button class="btn" data-act="sync-now">Jetzt speichern</button>`; }
    if (!k) return "";
    return `<section class="act"><div class="act-h"><span class="act-ico">${ICON_WAIT}</span><div><span class="act-k">${k}</span><b>${title}</b><div class="small">${text}</div></div></div><div class="act-btns">${btn}</div></section>`;
  }
  const LOG_PATH = "/contents/logs/app-fehler.json";
  let logTimer = null, logSyncing = null;
  function scheduleLogPush(ms = 15000) { if (embedded) return; clearTimeout(logTimer); logTimer = setTimeout(() => syncLog(), ms); }
  function syncLog() {
    if (embedded || !ablage.privat || !dataReady() || !ghToken()) return Promise.resolve(false);
    const E = S.errs || {}, todo = Object.entries(E).filter(([, x]) => x.n > (x.sent || 0));
    if (!todo.length || logSyncing) return logSyncing || Promise.resolve(false);
    logSyncing = (async () => {
      for (let k = 0; k < 3; k++) {
        const r = await dgh("GET", LOG_PATH);
        const data = r ? JSON.parse(b64d(r.content)) : { info: "Fehler aus dem Kochbuddy (ohne persönliche Inhalte). Der Buddy meldet neue Einträge per Push.", items: {} };
        data.items = data.items || {};
        for (const [key, x] of todo) {
          const it = data.items[key] || { kind: x.kind, msg: x.msg, where: x.where, n: 0, first: x.first };
          it.n += x.n - (x.sent || 0); it.last = x.last > (it.last || "") ? x.last : it.last; it.route = x.route; it.v = x.v; it.sys = x.sys;
          data.items[key] = it;
        }
        data.updated = new Date().toISOString();
        try {
          await dgh("PUT", LOG_PATH, { message: `Koch-App: ${todo.length === 1 ? "1 Fehler" : todo.length + " Fehler"} protokolliert`, content: b64e(JSON.stringify(data, null, 1) + "\n"), ...(r ? { sha: r.sha } : {}) });
          for (const [, x] of todo) x.sent = x.n;
          save(); return true;
        } catch (e) { if (e.code === 409 || e.code === 422) continue; return false; }
      }
      return false;
    })().catch(() => false).finally(() => { logSyncing = null; });
    return logSyncing;
  }

  /* ---------- Wächter: ab Donnerstag 8 Uhr muss der Plan für nächste Woche da sein ---------- */
  function planMissingBanner() {
    if (embedded || !weeks.length) return "";
    const now = new Date(), dow = now.getDay();
    if (!((dow === 4 && now.getHours() >= 8) || dow === 5 || dow === 6 || dow === 0)) return "";
    const nextMon = addDays(today(), (8 - dow) % 7 || 7);
    if (weeks.some((w) => w.start === nextMon)) return "";
    const [, m, d] = nextMon.split("-").map(Number);
    return `<section class="act"><div class="act-h"><span class="act-ico">${ICON_WAIT}</span><div><span class="act-k">Noch nicht da</span><b>Der Plan ab Montag, ${d}.${m}., fehlt</b><div class="small">Normalerweise kommt er donnerstags gegen 6 Uhr. Der Buddy prüft das stündlich, startet die Planung bei Bedarf neu und gibt Bescheid. <a href="#" data-act="reload">Jetzt nachsehen</a></div></div></div></section>`;
  }
  function syncAll(quiet) { return Promise.all([syncSwaps(quiet), syncTaste(quiet), syncStars(quiet), syncNotes(quiet), syncEinkauf(quiet), syncVorrat(quiet), syncMsgs(quiet)]).then((r) => r.some(Boolean)); }

  /* ---------- Hinweise: Was ist noch zu tun? (oben in der Woche, orange) ---------- */
  async function bringUpdates() {
    const ids = [...new Set([weeks[0] && weeks[0].id, weekId].filter(Boolean))];
    const out = [];
    for (const id of ids) {
      const path = `daten/bring/${id}.json`;
      let d = null;
      try { d = await getJSON(path); } catch (e) { memo[path] = { updates: [] }; }
      ((d && d.updates) || []).forEach((u) => out.push({ ...u, week: id, key: `${id}:${u.id}` }));
    }
    const fresh = Date.now() - 5 * 86400000;
    S.bringAck = S.bringAck || {};
    return out.filter((u) => !S.bringAck[u.key] && (!u.at || new Date(u.at).getTime() > fresh));
  }
  let shownUpdates = [];
  function whenText(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const dd = toIso(d) === today() ? "heute" : toIso(d) === addDays(today(), -1) ? "gestern" : `am ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
    return `${dd} um ${hm(d)} Uhr`;
  }
  function actionBanners(ups, part) {
    shownUpdates = ups;
    let h = "";
    if (part !== "info") for (const u of ups) {
      const adds = u.add || [], rem = u.remove || [];
      const opened = S.bringOpened && S.bringOpened[u.key];
      h += `<section class="act">
        <div class="act-h"><span class="act-ico">${ICON_CART}</span><div><span class="act-k">Bitte erledigen</span><b>Bring-Liste aktualisieren</b><div class="small">Der Wochenplan wurde ${esc(whenText(u.at))} geändert.</div></div></div>
        ${(u.changes || []).length ? `<ul class="act-list">${u.changes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}
        ${adds.length ? `<p class="small" style="margin:8px 0 2px"><b>Neu für Bring:</b> ${adds.map((x) => `${esc(x.n)}${x.q ? ` <span class="muted">(${esc(x.q)}${x.neu === false ? ", Menge geändert" : ""})</span>` : ""}`).join(", ")}</p>` : `<p class="small" style="margin:8px 0 2px">Es kommt nichts Neues dazu.</p>`}
        ${rem.length ? `<p class="small" style="margin:4px 0 0"><b>Wird nicht mehr gebraucht:</b> ${rem.map((x) => esc(x.n)).join(", ")}</p>` : ""}
        <div class="act-btns">
          ${u.bring ? `<a class="btn primary" href="${esc(u.bring)}" target="_blank" rel="noopener" data-bringopen="${esc(u.key)}">In Bring übernehmen</a><button class="btn" data-bringmail="${esc(u.key)}">Per Mail ans Handy</button>` : ""}
          <button class="btn ${opened || !u.bring ? "primary" : "ghost"}" data-bringdone="${esc(u.key)}">${opened ? "Erledigt – ist in Bring" : "Erledigt"}</button>
        </div>
        <p class="small muted" style="margin:10px 0 0">${u.bring ? "„In Bring übernehmen“ öffnet Bring mit genau diesen Zutaten, dort wählst du aus und bestätigst. Ist auf diesem Gerät kein Bring installiert, schick dir den Link per Mail aufs Handy. Der Link steht auch in der Mail von heute Abend." : "Hier musst du in Bring nichts tun. Einfach auf „Erledigt“ tippen."}</p>
      </section>`;
    }
    const open = part === "todo" ? [] : swapsFor(weekId).filter((s) => s.status === "offen");
    if (open.length) {
      const late = new Date().getHours() >= 23;
      h += `<section class="act info"><div class="act-h"><span class="act-ico">${ICON_WAIT}</span><div><span class="act-k">Nichts zu tun – nur zur Info</span><b>${open.length === 1 ? "1 Tausch" : open.length + " Tausche"} – wird ${late ? "morgen Abend" : "heute Abend"} übernommen</b>
        <div class="small">Gegen 21 Uhr passt der Buddy Plan, PDF und Einkaufsliste an und schickt eine kurze Mail. Bis dahin lässt sich der Tausch beim Gericht rückgängig machen.</div></div></div>
        <ul class="act-list">${open.map((s) => `<li><b>${esc(s.dayName)} ${esc(s.slot)}:</b> ${esc(shortTitle(s.toTitle))} statt ${esc(shortTitle(s.fromTitle))}</li>`).join("")}</ul></section>`;
    }
    return h;
  }
  async function updateNavDot() {
    let n = 0;
    try { n = (await bringUpdates()).length; } catch (e) { n = 0; }
    const a = $('#nav a[data-nav="woche"]'); if (a) a.classList.toggle("dot", n > 0);
  }
  function bringMailSheet(key) {
    const u = shownUpdates.find((x) => x.key === key);
    if (!u) return;
    openSheet(`<h2>Bring-Link per Mail</h2>
      <p class="small" style="margin:6px 0 10px">Schick dir den Link auf das Handy, auf dem Bring installiert ist. Dort in der Mail antippen – Bring öffnet sich mit den neuen Zutaten.</p>
      <label class="small" for="mailto"><b>An diese Adresse</b></label>
      <input class="field" id="mailto" type="email" inputmode="email" autocomplete="email" placeholder="name@beispiel.de" value="${esc(S.settings.mailTo || "")}" data-mailto>
      <p class="small muted" style="margin:6px 0 12px">Die Adresse bleibt nur auf diesem Gerät gespeichert.</p>
      <button class="btn primary big" data-act="bringmail-go">Mail-App öffnen</button>
      ${navigator.share ? `<button class="btn big" style="margin-top:8px" data-act="bringshare">Anders schicken, z. B. per WhatsApp</button>` : ""}
      <button class="btn ghost" style="margin-top:8px" data-act="bringcopy">Nur den Link kopieren</button>`, { bring: key });
  }
  /* Mail/Teilen/Kopieren: für den Hinweis in der Woche oder für die Einkaufsliste */
  function curBring() {
    const k = $("#sheet").dataset.bring;
    if (k === "ek") { const B = ek().bring; return B ? { subject: "Bring: Einkaufsliste", text: ekMailText(B), link: ekDeeplink(B.url) } : null; }
    const u = shownUpdates.find((x) => x.key === k);
    return u ? { subject: "Bring: neue Zutaten für den Wochenplan", text: bringText(u), link: u.bring } : null;
  }
  function bringText(u) {
    const lines = ["Hallo,", "", "nach der Änderung im Wochenplan kommen diese Zutaten dazu:", ...(u.add || []).map((x) => `- ${x.n}${x.q ? ` (${x.q})` : ""}`)];
    if ((u.remove || []).length) lines.push("", "Wird nicht mehr gebraucht: " + u.remove.map((x) => x.n).join(", "));
    lines.push("", "In Bring übernehmen (antippen):", u.bring, "", "Dein Kochbuddy");
    return lines.join("\n");
  }

  /* ---------- Einführung beim ersten Start und Hilfe ---------- */
  const TOUR = [
    { ico: "pot", t: "Willkommen beim Kochbuddy", x: "Hier siehst du jeden Tag, was gekocht wird – mit Rezept, Kochmodus und Timern. Plan, Rezepte und Angebote aktualisieren sich von selbst." },
    { ico: "cal", t: "Oben steht immer heute", x: "Die Karte „Heute“ zeigt beide Mahlzeiten mit Uhrzeit und was heute ansteht – zum Nachschauen. Abgehakt wird in der Checkliste, dem zweiten Reiter unten. Ein Tipp auf ein Gericht öffnet das Rezept." },
    { ico: "timer", t: "Kochen mit Timer", x: "„Kochen“ führt dich Schritt für Schritt durchs Rezept. Eine Zeitangabe antippen startet den Timer, der Bildschirm bleibt dabei an. Zutaten abhaken, sobald sie im Topf sind." },
    { ico: "swap", t: "Gericht tauschen", x: "Lust auf etwas anderes? Unter „Ersatzgerichte“ das Gericht am Griff (sechs Punkte) auf einen Tag ziehen oder „Tauschen“ antippen. Abends passt der Buddy Plan und Einkaufsliste an." },
    { ico: "cart", t: "Wenn etwas zu tun ist", x: "Muss etwas in die Bring-Liste, erscheint oben ein oranger Hinweis mit Knopf. Unter „Angebote“ stehen die besten Angebote der Woche samt Einkaufszettel zum Abhaken." },
    { ico: "cart", t: "Leer? Einfach scannen", x: "Unter „Einkauf“ sammelt die App, was nachgekauft werden muss – Strichcode der leeren Packung scannen (Scanner oder Kamera) oder dazuschreiben. Mit einem Tipp geht alles in Bring." },
  ];
  let tourStep = 0;
  function showTour(step = 0) {
    tourStep = step;
    const s = TOUR[step], last = step === TOUR.length - 1;
    openSheet(`<div class="tour"><div class="tour-ico">${ART[s.ico] || ""}</div><h2>${esc(s.t)}</h2><p>${esc(s.x)}</p>
      <div class="tour-dots">${TOUR.map((_, i) => `<i class="${i === step ? "on" : ""}"></i>`).join("")}</div>
      <div class="tour-btns">${step > 0 ? `<button class="btn" data-act="tour-back">Zurück</button>` : `<button class="btn ghost" data-act="tour-end">Überspringen</button>`}
      <button class="btn primary" data-act="${last ? "tour-end" : "tour-next"}">${last ? "Los geht's" : "Weiter"}</button></div></div>`, { tour: "1" });
  }
  function endTour() { S.settings.toured = 1; save(); closeSheet(); setTimeout(maybeReview, 250); }
  const cookHint = () => (S.settings.hintCook ? "" : `<div class="tip guide"><b>So geht's:</b> Schritt lesen. Steht eine Zeit dabei, startet ein Tipp darauf den Timer. Zutaten abhaken, sobald sie im Topf sind. Dann „Erledigt · weiter“ – oder nach links wischen. Der Bildschirm bleibt an.<div style="margin-top:8px"><button class="btn small" data-act="hint-cook">Verstanden</button></div></div>`);

  /* ---------- Tauschen: Ersatzgerichte per Ziehen auf einen Tag ----------
     Getauscht wird sofort in der App; gespeichert wird in tausch/<woche>.json im Rezept-Repo (nur Tage und Gerichtsnamen).
     Lesen geht ohne Schlüssel über GitHub Pages, Schreiben braucht einen Schlüssel mit Schreibrecht auf das Repo.
     Die stündliche Antwort-Aufgabe übernimmt offene Tausche abends gegen 21 Uhr in Plan, Bring-Liste und PDF. */
  const GH_REPO = "Padderico/Rezeptesammlung";
  const GH_KEY = "kochbuddy.gh";
  const TOKEN_URL = "https://github.com/settings/personal-access-tokens/new?name=Kochbuddy&description=Koch-App%3A%20Rezeptesammlung%20und%20Einkaufsbuddy-Daten&target_name=Padderico&expires_in=none&contents=write";
  const ghToken = () => { try { return JSON.parse(localStorage.getItem(GH_KEY) || "{}").token || ""; } catch (e) { return ""; } };
  const setGhToken = (t) => { try { if (t) localStorage.setItem(GH_KEY, JSON.stringify({ token: t, at: Date.now() })); else localStorage.removeItem(GH_KEY); } catch (e) { /* gesperrt */ } };
  const validToken = (t) => /^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(t || "");
  /* Private Ablage: Sobald app/daten/ablage.json {"privat": true} sagt, liegen Sterne, Notizen, Wischer und Tausche
     im privaten Repo Einkaufsbuddy-Daten. Der Schlüssel des Geräts braucht dann Zugriff auf beide Repos.
     Ohne Zugriff speichert die App nur auf dem Gerät weiter (nichts geht verloren) und zeigt oben einen Hinweis. */
  const DATA_REPO = "Padderico/Einkaufsbuddy-Daten";
  let ablage = { privat: false }, privOk = null, privAt = 0;
  async function loadAblage() {
    try { const a = await getJSON("daten/ablage.json", true); ablage = a && a.privat ? a : { privat: false }; } catch (e) { ablage = { privat: false }; }
    if (ablage.privat && ghToken() && (privOk !== true || Date.now() - privAt > 6 * 3600000)) { try { privOk = !!(await gh("GET", "", null, DATA_REPO)); privAt = Date.now(); } catch (e) { privOk = e.code === "offline" ? privOk : false; } }
    return ablage;
  }
  const dataReady = () => !ablage.privat || privOk === true;
  const dgh = (method, path, body) => gh(method, path, body, ablage.privat ? DATA_REPO : GH_REPO);
  /* Sicherungs-Stand: wann zuletzt gespeichert, letzter Fehler */
  function syncMark(ok, e) {
    S.sync = S.sync || {};
    if (ok) { S.sync.ok = Date.now(); delete S.sync.err; }
    else if (e && e.code !== "offline") S.sync.err = { code: e.code || "", msg: e.message || "", at: Date.now() };
    save();
  }
  async function gh(method, path, body, repo = GH_REPO) {
    const t = ghToken();
    if (!t) throw Object.assign(new Error("Kein Schlüssel auf diesem Gerät"), { code: "notoken" });
    let res;
    try {
      res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
        method, cache: "no-store",
        headers: { Authorization: `Bearer ${t}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) { throw Object.assign(new Error("Gerade kein Netz"), { code: "offline" }); }
    if (method === "GET" && res.status === 404) return null;
    if (res.status === 401) throw Object.assign(new Error("Schlüssel ungültig oder abgelaufen"), { code: "auth" });
    if (res.status === 403 || res.status === 404) throw Object.assign(new Error(repo === GH_REPO ? "Schlüssel darf die Rezeptesammlung nicht beschreiben" : "Schlüssel darf die private Ablage (Einkaufsbuddy-Daten) nicht beschreiben"), { code: "auth" });
    if (!res.ok) throw Object.assign(new Error("GitHub antwortet " + res.status), { code: res.status });
    return res.status === 204 ? null : res.json();
  }
  const b64e = (s) => { const b = new TextEncoder().encode(s); let x = ""; for (let i = 0; i < b.length; i += 0x8000) x += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(x); };
  const b64d = (s) => new TextDecoder().decode(Uint8Array.from(atob(String(s).replace(/\s/g, "")), (c) => c.charCodeAt(0)));
  const swapPath = (wid) => `/contents/tausch/${wid}.json`;
  function swapState(wid) { S.swaps = S.swaps || {}; return (S.swaps[wid] = S.swaps[wid] || { list: [], ops: [] }); }
  function applyOps(list, ops) {
    let l = list.slice();
    for (const o of ops) {
      if (o.op === "add") { l = l.filter((s) => !(s.iso === o.swap.iso && s.slot === o.swap.slot && s.status === "offen")); l.push(o.swap); }
      if (o.op === "remove") l = l.filter((s) => !(s.id === o.id && s.status === "offen"));
    }
    return l;
  }
  const swapsFor = (wid) => { const st = swapState(wid); return applyOps(st.list || [], st.ops || []); };
  async function pullSwaps(wid) {
    let list;
    if (ablage.privat && !dataReady()) return false;
    if (ghToken()) {
      const r = await dgh("GET", swapPath(wid));
      list = r ? JSON.parse(b64d(r.content)).swaps || [] : [];
    } else if (ablage.privat) return false;
    else {
      // ohne Schlüssel: dieselbe Datei über GitHub Pages lesen (wenige Minuten Verzögerung)
      let res;
      try { res = await fetch(`../tausch/${wid}.json`, { cache: "no-cache" }); } catch (e) { throw Object.assign(new Error("Gerade kein Netz"), { code: "offline" }); }
      if (res.status === 404) list = [];
      else if (!res.ok) throw Object.assign(new Error("Tausch-Datei nicht lesbar"), { code: res.status });
      else list = (await res.json()).swaps || [];
    }
    const st = swapState(wid), before = JSON.stringify(st.list);
    st.list = list; st.at = Date.now(); save();
    return before !== JSON.stringify(list);
  }
  async function pushSwaps(wid) {
    const st = swapState(wid);
    if (!st.ops.length || !dataReady()) return false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await dgh("GET", swapPath(wid));
      const data = r ? JSON.parse(b64d(r.content)) : { week: wid, swaps: [] };
      const ops = st.ops.slice();
      data.week = wid; data.swaps = applyOps(data.swaps || [], ops); data.updated = new Date().toISOString();
      const msg = ops.map((o) => (o.op === "add" ? `${o.swap.dayName} ${o.swap.slot}: ${o.swap.toTitle}` : "Tausch zurückgenommen")).join("; ");
      try {
        await dgh("PUT", swapPath(wid), { message: `Koch-App: ${msg}`.slice(0, 180), content: b64e(JSON.stringify(data, null, 1) + "\n"), ...(r ? { sha: r.sha } : {}) });
        st.list = data.swaps; st.ops = st.ops.slice(ops.length); st.at = Date.now(); save(); syncMark(true);
        return true;
      } catch (e) { if (e.code === 409 || e.code === 422) continue; throw e; }
    }
    throw Object.assign(new Error("Speichern kollidierte mehrfach"), { code: "conflict" });
  }
  let syncing = null;
  function syncSwaps(quiet) {
    if (embedded) return Promise.resolve(false);
    if (syncing) return syncing;
    syncing = (async () => {
      let changed = false;
      try {
        if (!weekId) await loadIndex();
        const wid = weekId;
        if (!wid) return false;
        if (ghToken() && (await pushSwaps(wid))) changed = true;
        if (await pullSwaps(wid)) changed = true;
      } catch (e) {
        syncMark(false, e);
        if (e.code === "auth" && !quiet) { toast(`Tausch nicht gespeichert: ${e.message}`); tokenSheet(e.message); }
        else if (e.code !== "offline" && !quiet) toast(`Tausch noch nicht gespeichert (${e.message}) – neuer Versuch folgt`);
      }
      return changed;
    })().finally(() => { syncing = null; });
    return syncing;
  }
  /** Woche mit den Tauschen aus der App anzeigen (noch nicht übernommene bzw. nur in der App gültige) */
  function withSwaps(w) {
    const list = swapsFor(weekId).filter((s) => s.status === "offen" || s.status === "nur-app");
    if (!list.length) return w;
    const days = w.days.map((d) => ({ ...d, meals: d.meals.map((m) => {
      const s = list.find((x) => x.iso === d.iso && x.slot === m.slot && x.from === m.recipe && w.recipes[x.to]);
      return s ? { ...m, recipe: s.to, mode: "kochen", badge: "", note: s.status === "offen" ? "In der App getauscht. Der Buddy übernimmt es heute gegen 21 Uhr in Plan, Bring-Liste und PDF." : "In der App getauscht.", _swap: s } : m;
    }) }));
    const used = new Set(days.flatMap((d) => d.meals.map((m) => m.recipe)));
    const extras = [...new Set([...(w.extras || []), ...list.map((s) => s.from)])].filter((id) => !used.has(id) && w.recipes[id]);
    return { ...w, days, extras };
  }
  let pendingSwap = null;
  async function performSwap(toId, iso, slot) {
    const w0 = await week(), w = withSwaps(w0);
    const d = w.days.find((x) => x.iso === iso), m = d && d.meals.find((x) => x.slot === slot);
    if (!m || !w0.recipes[toId]) return;
    const from = m._swap ? m._swap.from : m.recipe;
    if (from === toId) { if (m._swap) unswap(m._swap.id); return; }
    const swap = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), week: weekId, day: d.id, dayName: d.name, iso, slot, from, to: toId,
      fromTitle: (w0.recipes[from] || {}).title || from, toTitle: w0.recipes[toId].title, at: new Date().toISOString(), status: "offen" };
    if (!ghToken()) { pendingSwap = swap; tokenSheet(); return; }
    swapState(weekId).ops.push({ op: "add", swap }); save();
    const meatFrom = ((w0.recipes[from] || {}).tags || []).includes("Fleisch"), meatTo = (w0.recipes[toId].tags || []).includes("Fleisch");
    rerenderSoft();
    toast(`${d.name} ${slot}: ${shortTitle(swap.toTitle)}${meatFrom !== meatTo ? " – damit ändern sich die Fleischtage" : ""}. Übernahme heute gegen 21 Uhr.`);
    if (navigator.vibrate && S.settings.vibrate) navigator.vibrate(25);
    syncSwaps();
  }
  function unswap(id) {
    swapState(weekId).ops.push({ op: "remove", id }); save();
    rerenderSoft(); toast("Tausch zurückgenommen"); syncSwaps();
  }
  // Heute: Mittag bis 14 Uhr, Abend bis 21 Uhr tauschbar; künftige Tage immer.
  const slotOpen = (iso, slot) => { const t = today(); if (iso > t) return true; if (iso < t) return false; const hNow = new Date().getHours(); return /mittag/i.test(slot) ? hNow < 14 : hNow < 21; };
  function dropTargets(w, buttons) {
    const t = today();
    const tag = buttons ? "button" : "div";
    const days = w.days.filter((d) => d.iso >= t && d.meals.some((m) => slotOpen(d.iso, m.slot)));
    if (!days.length) return `<p class="empty">In dieser Woche sind keine Tage mehr übrig.</p>`;
    return days.map((d) => `<div class="dz-day"><div class="eyebrow">${esc(d.name)} ${esc(d.date)}</div><div class="dz-row">${d.meals.filter((m) => slotOpen(d.iso, m.slot)).map((m) => {
      const r = w.recipes[m.recipe];
      return `<${tag} class="dz" data-drop="${d.iso}|${esc(m.slot)}"${buttons ? ` data-swapto="${d.iso}|${esc(m.slot)}"` : ""}><small>${esc(m.slot)}${m._swap ? " · getauscht" : ""}</small><b>${esc(r ? shortTitle(r.title) : m.recipe)}</b></${tag}>`;
    }).join("")}</div></div>`).join("");
  }
  async function swapSheet(toId) {
    const w = withSwaps(await week()), r = w.recipes[toId];
    if (!r) return;
    openSheet(`<h2>${esc(r.title)}</h2><p class="small muted" style="margin:4px 0 8px">Wohin damit? Das bisherige Gericht wandert zu den Ersatzgerichten. Der Buddy übernimmt den Tausch heute gegen 21 Uhr in Plan, Bring-Liste und PDF und verschickt eine kurze Info-Mail.</p>${dropTargets(w, true)}`, { swap: toId });
  }
  function tokenSheet(problem) {
    openSheet(`<h2>Speichern für den Buddy einrichten</h2>
      ${problem ? `<p class="notice" style="margin:8px 0">${esc(problem)}</p>` : ""}
      <p class="small" style="margin:6px 0">Damit Sterne, Notizen, Wischer und Tausche sicher gespeichert werden und auf allen Geräten ankommen, legt die App sie auf GitHub ab. Dafür braucht dieses Gerät einmalig einen GitHub-Schlüssel – einer reicht für alle Geräte.</p>
      <ol class="small" style="padding-left:20px;margin:8px 0">
        <li>Knopf unten antippen und bei GitHub einloggen. Name, Rechte (<b>Contents: Read and write</b>) und Ablauf sind schon vorausgefüllt.</li>
        <li>Expiration: <b>No expiration</b> (kein Ablaufdatum) – dann läuft der Schlüssel nie ab.</li>
        <li>Repository access: <b>Only select repositories</b> → <b>Rezeptesammlung</b> und <b>Einkaufsbuddy-Daten</b>.</li>
        <li>„Generate token“, Schlüssel kopieren und hier einfügen. Andere Geräte danach per QR-Code verbinden.</li>
      </ol>
      <a class="btn small" href="${TOKEN_URL}" target="_blank" rel="noopener">GitHub öffnen</a>
      <input class="field" style="margin-top:12px" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…" data-ghtoken>
      <button class="btn primary big" style="margin-top:10px" data-act="gh-save">Prüfen und speichern</button>
      <p class="small muted" style="margin:10px 0 0">Schon auf einem anderen Gerät eingerichtet? Dort in der Woche unter den Ersatzgerichten „Weiteres Gerät verbinden“ antippen und den QR-Code mit diesem Gerät scannen.</p>`);
  }
  async function saveToken() {
    const inp = $("[data-ghtoken]"), t = ((inp && inp.value) || "").trim();
    if (!validToken(t)) { toast("Das sieht nicht nach einem GitHub-Schlüssel aus (beginnt mit github_pat_)"); return; }
    const old = ghToken();
    setGhToken(t);
    try {
      const repo = await gh("GET", "");
      if (!repo) throw Object.assign(new Error("Repo nicht gefunden – beim Schlüssel „Rezeptesammlung“ auswählen"), { code: "auth" });
    } catch (e) { setGhToken(old); toast(e.code === "offline" ? "Gerade kein Netz – bitte später nochmal" : e.message); return; }
    syncMark(true);
    await loadAblage();
    let priv = privOk;
    if (priv == null) { try { priv = !!(await gh("GET", "", null, DATA_REPO)); } catch (e) { priv = false; } }
    closeSheet();
    openSheet(`<h2>Schlüssel geprüft</h2><ul class="checks" style="margin:10px 0">
      <li class="check on">${CHECK}<span class="txt"><b>Rezeptesammlung</b> – Zugriff ok</span></li>
      <li class="check${priv ? " on" : ""}">${CHECK}<span class="txt"><b>Einkaufsbuddy-Daten</b> – ${priv ? "Zugriff ok" : "kein Zugriff: Repo fehlt noch oder ist beim Schlüssel nicht ausgewählt"}</span></li></ul>
      <p class="small muted">${priv ? "Alles bereit – Sterne, Notizen, Wischer und Tausche werden sicher gespeichert." : "Bis das private Repo erreichbar ist, speichert die App wie bisher in der Rezeptesammlung. Nichts geht verloren."}</p>
      <button class="btn primary big" data-act="sheet-close">Gut</button>`);
    syncStars(true); syncNotes(true);
    syncTaste(true).then(() => { if (location.hash.startsWith("#/entdecken")) rerenderSoft(); });
    if (pendingSwap) { const s = pendingSwap; pendingSwap = null; await performSwap(s.to, s.iso, s.slot); }
    else { await syncSwaps(true); rerenderSoft(); }
  }
  async function qrSheet() {
    const t = ghToken();
    if (!t) { tokenSheet(); return; }
    const url = `${location.origin}${location.pathname}#/verbinden/${t}`;
    let svg = "";
    try { const qr = (await import("./vendor/qrcode.mjs")).default(0, "M"); qr.addData(url); qr.make(); svg = qr.createSvgTag({ cellSize: 5, margin: 3, scalable: true }); } catch (e) { svg = ""; }
    openSheet(`<h2>Weiteres Gerät verbinden</h2><p class="small" style="margin:6px 0 10px">Mit der Kamera des anderen Geräts scannen. Danach speichert auch dieses Gerät Sterne, Notizen, Wischer und Tausche.</p>
      <div class="qrbox">${svg || "QR-Code konnte nicht erzeugt werden."}</div>
      <p class="small muted" style="margin:10px 0">Der Code enthält den Schlüssel – nur mit euren eigenen Geräten scannen.</p>
      <button class="btn small ghost" data-act="gh-remove">Schlüssel auf diesem Gerät entfernen</button>`);
  }
  // Ziehen: Griff festhalten, Ablagefläche mit allen restlichen Tagen erscheint oben; auf dem Tablet geht auch direkt die Tageskarte.
  let drag = null;
  document.addEventListener("pointerdown", (e) => {
    const g = e.target.closest("[data-grip]");
    if (!g || drag) return;
    e.preventDefault();
    drag = { id: g.dataset.grip, x0: e.clientX, y0: e.clientY, started: false, pid: e.pointerId };
    try { g.setPointerCapture(e.pointerId); } catch (er) { /* egal */ }
  });
  document.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.started) { if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return; startDrag(); }
    e.preventDefault();
    const gh0 = $("#ghost");
    if (gh0) { const half = gh0.offsetWidth / 2 + 8; gh0.style.left = Math.min(window.innerWidth - half, Math.max(half, e.clientX)) + "px"; gh0.style.top = e.clientY + "px"; }
    const hit = (document.elementFromPoint(e.clientX, e.clientY) || { closest: () => null }).closest("[data-drop]");
    $$(".hot").forEach((x) => x !== hit && x.classList.remove("hot"));
    if (hit) hit.classList.add("hot");
    drag.hit = hit;
  }, { passive: false });
  document.addEventListener("pointerup", (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag; endDrag();
    if (!d.started) { swapSheet(d.id); return; }
    if (d.hit) { const [iso, slot] = d.hit.dataset.drop.split("|"); performSwap(d.id, iso, slot); }
  });
  document.addEventListener("pointercancel", () => { if (drag) endDrag(); });
  async function startDrag() {
    drag.started = true;
    document.body.classList.add("dragging");
    const w = withSwaps(await week()), r = w.recipes[drag.id];
    if (!drag) return;
    const g = document.createElement("div"); g.id = "ghost"; g.textContent = r ? shortTitle(r.title) : "";
    g.style.left = drag.x0 + "px"; g.style.top = drag.y0 + "px"; document.body.appendChild(g);
    const p = document.createElement("div"); p.id = "droppanel";
    p.innerHTML = `<div class="spread"><b>Auf einen Tag ziehen</b><span class="small muted">loslassen zum Tauschen</span></div>${dropTargets(w, false)}`;
    document.body.appendChild(p);
    if (navigator.vibrate && S.settings.vibrate) navigator.vibrate(20);
  }
  function endDrag() {
    drag = null;
    document.body.classList.remove("dragging");
    ["#ghost", "#droppanel"].forEach((s) => { const el = $(s); if (el) el.remove(); });
    $$(".hot").forEach((x) => x.classList.remove("hot"));
  }

  /* ---------- Angebote: Schnäppchen-Seiten aus dem neuesten Wochen-PDF ---------- */
  const DEALS_KEY = "kochbuddy.deals";
  let dealFilter = "Alle";
  const pdfUrl = (w) => new URL(`../wochenplan/Speiseplan-KW${w.kw}-${w.year}.pdf`, location.href).href;
  const KEEP_CAPS = new Set(["EDEKA", "REWE", "ALDI", "SÜD", "dm", "E", "XXL"]);
  const niceShop = (s) => (s || "").split(/\s+/).map((x) => (/^[A-ZÄÖÜ]{3,}$/.test(x) && !KEEP_CAPS.has(x) ? x.charAt(0) + x.slice(1).toLowerCase() : x)).join(" ");
  const shopKey = (s) => niceShop(s).split(" ")[0];
  /* ---------- Prospekte der Läden (oben im Tab Angebote) ----------
     Mit Schlüssel aus dem privaten Repo: angebote/prospekte.json (Läden, Gültigkeit, Links; schreibt die Wochenaufgabe).
     Ohne Zugriff nur die allgemeinen Prospekt-Seiten der Händler (ohne Orte – das öffentliche Repo kennt keine Orte). */
  const PROS_PATH = "/contents/angebote/prospekte.json";
  const PROS_FALLBACK = [
    { shop: "Lidl", stufe: 1, title: "Aktuelle Prospekte", overview: "https://www.lidl.de/c/online-prospekte/s10005610" },
    { shop: "Kaufland", stufe: 1, title: "Aktuelle Prospekte", overview: "https://filiale.kaufland.de/prospekte.html" },
    { shop: "ALDI SÜD", stufe: 2, title: "Aktuelle Prospekte", overview: "https://www.aldi-sued.de/de/angebote/prospekte.html" },
  ];
  let prosCache = null, prosAt = 0, prosLoading = null;
  function loadPros() {
    if (prosLoading) return prosLoading;
    if (!(ablage.privat && dataReady() && ghToken())) return Promise.resolve(null);
    prosLoading = dgh("GET", PROS_PATH).then((r) => (r ? JSON.parse(b64d(r.content)) : null))
      .then((d) => { const ch = JSON.stringify(d) !== JSON.stringify(prosCache); prosCache = d; prosAt = Date.now(); S.prosCache = d; save(); return ch; })
      .catch(() => false).finally(() => { prosLoading = null; });
    return prosLoading;
  }
  const PROS_TONE = { lidl: "#0050AA", penny: "#CD1414", kaufland: "#E10915", edeka: "#1C4C9C", aldi: "#1E5AA8", rewe: "#CC071E" };
  const shortDate = (iso) => { const d = new Date(iso + "T12:00"); return `${DAYS[d.getDay()].slice(0, 2)} ${d.getDate()}.${d.getMonth() + 1}.`; };
  function prospekteHtml(dealItems) {
    if (!prosCache && S.prosCache) prosCache = S.prosCache;
    const list = (prosCache && prosCache.items) || PROS_FALLBACK, t = today();
    const STUFE = { 1: "Hauptladen", 2: "Zweite Wahl", 3: "Nur bei Top-Angeboten" };
    const cards = list.map((p) => {
      let cur = p.url ? { title: p.title, von: p.von, bis: p.bis, url: p.url } : null, nxt = p.next || null;
      if (cur && cur.bis && cur.bis < t) { cur = nxt && (!nxt.von || nxt.von <= t) ? nxt : null; nxt = null; }
      const href = (cur && cur.url) || p.overview || p.url;
      const key = (p.shop || "").toLowerCase().split(/\s+/)[0];
      const nDeals = (dealItems || []).filter((it) => shopKey(it.shop).toLowerCase() === key).length;
      const valid = cur && cur.bis ? `gültig bis ${shortDate(cur.bis)}` : cur ? "diese Woche" : "neuer Prospekt kommt";
      return `<div class="pro" style="--pc:${PROS_TONE[key] || "var(--accent)"}"><a class="pro-main" href="${esc(href)}" target="_blank" rel="noopener">
        <span class="pro-shop">${esc(p.shop)}</span><span class="pro-st">${esc(STUFE[p.stufe] || "")}${p.ort ? ` · ${esc(p.ort)}` : ""}</span>
        <b>${esc((cur && cur.title) || p.title || "Prospekt")}</b><small>${esc(valid)}</small>
        ${nDeals ? `<span class="pro-deal">${nDeals} ${nDeals === 1 ? "Top-Angebot" : "Top-Angebote"} unten</span>` : ""}
        <span class="pro-go">Blättern ↗</span></a>
        ${nxt && nxt.url ? `<a class="pro-next" href="${esc(nxt.url)}" target="_blank" rel="noopener">Nächste Woche${nxt.von ? ` ab ${esc(shortDate(nxt.von))}` : ""} ↗</a>` : ""}</div>`;
    }).join("");
    const note = prosCache ? (prosCache.stand ? `Stand ${shortDate(prosCache.stand)}` : "") : "Mit eingerichtetem Speichern stehen hier eure Läden mit Gültigkeit.";
    return `<section id="prospekte"><div class="section-title" style="margin-top:6px">Prospekte der Woche</div><div class="pro-row">${cards}</div>${note ? `<p class="small muted" style="margin:4px 0 0">${esc(note)} · Öffnet die Seite des Händlers.</p>` : ""}</section>`;
  }
  async function renderDeals(view) {
    const w0 = weeks[0];
    const head = (sub) => `<header class="top"><div><div class="eyebrow">${esc(sub)}</div><h1>Angebote</h1></div></header>` + prospekteHtml();
    if (!prosCache || Date.now() - prosAt > 30 * 60000) loadPros().then((ch) => { if (ch && location.hash.startsWith("#/angebote")) softIfIdle(); });
    if (!w0) { view.innerHTML = head("Angebote") + `<p class="empty">Noch kein Wochenplan da.</p>`; return; }
    const url = pdfUrl(w0);
    let cache = null;
    try { cache = JSON.parse(localStorage.getItem(DEALS_KEY) || "null"); } catch (e) { cache = null; }
    const fresh = cache && cache.url === url && cache.built === (w0.built || "");
    if (fresh) await drawDeals(view, w0, cache.data, url);
    else view.innerHTML = head(`KW ${w0.kw} · aus dem Wochen-PDF`) + `<div class="loading">${ART.pot}<span>Lese die Angebote aus dem Wochen-PDF …</span></div>`;
    if (fresh && Date.now() - (cache.at || 0) < 10 * 60000) return;
    try {
      const mod = await import("./deals.mjs");
      const res = await mod.loadDeals(url);
      const data = { ...res.data, pages: res.pages };
      try { localStorage.setItem(DEALS_KEY, JSON.stringify({ url, built: w0.built || "", at: Date.now(), data })); } catch (e) { /* voll */ }
      if (location.hash.startsWith("#/angebote") && (!fresh || JSON.stringify(data) !== JSON.stringify(cache.data))) drawDeals($("#view"), w0, data, url);
    } catch (e) {
      if (!fresh && location.hash.startsWith("#/angebote")) {
        $("#view").innerHTML = head(`KW ${w0.kw} · aus dem Wochen-PDF`) + `<div class="card"><h2>Gerade nicht lesbar</h2><p class="muted">${navigator.onLine === false ? "Ohne Netz – die Angebote waren auf diesem Gerät noch nicht gespeichert." : "Das Wochen-PDF ließ sich gerade nicht auslesen."}</p><a class="btn" href="${esc(url)}">PDF öffnen</a> <button class="btn ghost" data-act="deals-retry">Nochmal versuchen</button></div>`;
      }
    }
  }
  /* Welche Angebote passen zu den Zutaten der Planwoche? (gleiche Bring-Namen wie Einkaufsliste und Rezepte) */
  async function dealMatcher(w0) {
    let wk = null;
    try { wk = await week(w0.id); } catch (e) { return () => null; }
    const bn = await bringNames(), use = new Map();
    for (const rid of new Set(wk.days.flatMap((d) => d.meals.map((m) => m.recipe)))) {
      const r = wk.recipes[rid];
      for (const i of (r && r.ingredients) || []) { if (!i.b) continue; if (!use.has(i.b)) use.set(i.b, new Set()); use.get(i.b).add(shortTitle(r.title)); }
    }
    return (name) => { const a = textMatch(bn, name), u = a && use.get(a.n); return u ? [...u] : null; };
  }
  const PLAY_FORK = '<svg class="ico" viewBox="0 0 24 24"><path d="M7 3v7a2 2 0 0 0 2 2v9M11 3v7a2 2 0 0 1-2 2M9 3v6M16.5 21V3c-2 1.5-3 4-3 7v3h3"/></svg>';
  const isHot = (it) => it.save >= 45 || /Bestpreis|Schnäppchen|Black/i.test(it.rating || "");
  function dealCard(it, fits) {
    const fuer = it.fuer || (fits ? fits.slice(0, 3).join(", ") : "");
    return `<article class="deal${isHot(it) ? " hot" : ""}${fuer ? " fits" : ""}">
      <div class="deal-top"><div style="min-width:0"><div class="eyebrow">${it.rank ? `<span class="rank">${it.rank}</span>` : ""}${esc(niceShop(it.shop))}</div><b class="dn">${esc(it.name)}</b>${it.meta && it.meta.replace(/[·\s]|gültig/g, "") ? `<div class="small muted">${esc(it.meta.replace(/^\s*·\s*/, ""))}</div>` : ""}</div>
      <div class="dp"><b>${esc(it.price)}</b>${it.normal ? `<small>statt ${esc(it.normal)}</small>` : it.rank ? "" : `<small>Angebotspreis</small>`}</div></div>
      ${it.save != null ? `<div class="barrow"><span class="pct">−${it.save} %</span><span class="bar"><i style="width:${Math.max(3, Math.min(100, it.save))}%"></i></span>${it.rating ? `<span class="chip${/Bestpreis|Schnäppchen|Black/i.test(it.rating) ? " pump" : ""}">${esc(it.rating)}</span>` : ""}</div>` : ""}
      ${fuer ? `<p class="fits-for">${PLAY_FORK}Für ${esc(fuer)}</p>` : ""}
      ${it.maker ? `<p class="small" style="margin:4px 0"><b>Hersteller:</b> ${esc(it.maker)}</p>` : ""}${it.note ? `<p class="small muted" style="margin:4px 0 0">${esc(it.note)}</p>` : ""}</article>`;
  }
  async function drawDeals(view, w0, d, url) {
    const ck = bag("dealcheck", `kw${w0.kw}-${w0.year}`);
    const items = d.items || [], rez = d.rezept || [], all = [...items, ...rez];
    let h = `<header class="top"><div><div class="eyebrow">KW ${w0.kw} · aus dem Wochen-PDF</div><h1>Angebote</h1></div></header>` + prospekteHtml(all);
    if (!all.length && !d.title) {
      h += `<div class="card"><h2>Keine Angebotsseite</h2><p class="muted">In diesem Wochen-PDF gibt es diesmal keine Seite „Schnäppchen der Woche“.</p><a class="btn" href="${esc(url)}">PDF öffnen</a></div>`;
      if (d.pages && d.pages.length) h += `<button class="btn ghost" data-act="deals-render">Seite als Bild anzeigen</button><div id="dealpages"></div>`;
      view.innerHTML = h; view.dataset.pdf = url; view.dataset.pages = (d.pages || []).join(","); return;
    }
    const match = await dealMatcher(w0);
    if (d.subtitle) h += `<p class="muted small" style="margin:0 0 6px;font-weight:700">${esc(d.subtitle)}</p>`;
    if (!all.length && d.intro && d.intro.length) h += `<div class="tip"><p style="margin:0">${esc(d.intro[0])}</p></div>`;
    const shops = ["Alle", ...new Set(all.map((it) => shopKey(it.shop)))];
    if (shops.length > 2) h += `<div class="seg" style="margin-top:12px">${shops.map((s) => `<button data-shopfilter="${esc(s)}" aria-pressed="${dealFilter === s}">${esc(s)}</button>`).join("")}</div>`;
    const shown = (it) => dealFilter === "Alle" || shopKey(it.shop) === dealFilter;
    // 1) Absolute Top-Angebote
    h += `<div class="section-title deal-h" id="deals-top" style="margin-top:14px">Absolute Top-Angebote</div><p class="small muted deal-sub">Die stärksten Schnäppchen der Woche – auch für Vorrat und Alltag.</p>`;
    const topShown = items.filter(shown);
    h += topShown.length ? topShown.map((it) => dealCard(it, match(it.name))).join("") : `<p class="empty deal-empty">${items.length ? "Bei diesem Laden keine Top-Angebote." : "Diese Woche keine Top-Angebote."}</p>`;
    // 2) Passend zu euren Rezepten: vom Buddy gesucht, sonst die Top-Angebote, die zu Zutaten der Woche passen
    const derived = rez.length ? [] : items.map((it) => ({ it, fits: match(it.name) })).filter((x) => x.fits);
    h += `<div class="section-title deal-h" id="deals-rezept">Passend zu euren Rezepten</div><p class="small muted deal-sub">${rez.length ? "Angebote für Zutaten, die ihr in dieser Planwoche braucht." : derived.length ? "Diese Top-Angebote braucht ihr auch für die Rezepte der Woche." : "Angebote für Zutaten, die ihr in dieser Planwoche braucht."}</p>`;
    const rzShown = rez.length ? rez.filter(shown).map((it) => dealCard(it, match(it.name))) : derived.filter((x) => shown(x.it)).map((x) => dealCard(x.it, x.fits));
    h += rzShown.length ? rzShown.join("") : `<p class="empty deal-empty">${rez.length || derived.length ? "Bei diesem Laden nichts Passendes." : "Für die Zutaten dieser Woche gibt es gerade keine passenden Angebote."}</p>`;
    if (d.plan && d.plan.length) {
      h += `<div class="section-title">Einkaufszettel zum Abhaken</div>` + d.plan.map((s, i) => `<section class="card"><h3>${esc(s.shop)}</h3>${s.when ? `<p class="small muted" style="margin:2px 0 4px">${esc(s.when)}</p>` : ""}<ul class="checks">${s.items.map((x, j) => checkRow(ck[`${i}:${j}`], esc(x), `data-dealcheck="${i}:${j}"`)).join("")}</ul></section>`).join("");
    }
    if (d.tips && d.tips.length) h += `<div class="section-title">So kaufst du am besten ein</div><div class="card tipgrid">${d.tips.map((t) => `<div><b>${esc(t.label)}</b>${esc(t.text)}</div>`).join("")}</div>`;
    const intro = all.length ? d.intro || [] : (d.intro || []).slice(1);
    if (intro.length) h += `<div class="section-title">Hinweise</div>` + intro.map((p, i) => (i === 0 ? `<div class="tip"><p style="margin:0">${esc(p)}</p></div>` : `<p class="small muted">${esc(p)}</p>`)).join("");
    if (d.watch && d.watch.length) h += `<div class="section-title">Preiswecker – noch nicht kaufen</div><div class="card">${d.watch.map((x) => `<p class="small" style="margin:4px 0 8px">${x.name ? `<b>${esc(x.name)}:</b> ` : ""}${esc(x.text)}</p>`).join("")}</div>`;
    if (d.makers && d.makers.length) h += `<details class="card"><summary><b>Wer steckt hinter der Eigenmarke?</b></summary>${d.makers.map((x) => `<p class="small" style="margin:8px 0 0">${x.name ? `<b>${esc(x.name)}:</b> ` : ""}${esc(x.text)}</p>`).join("")}</details>`;
    h += `<p class="small muted" style="margin:18px 0 0">${esc(d.sources || "")}</p><div class="links"><a class="btn small" href="${esc(url)}">Ganzes Wochen-PDF öffnen</a></div>`;
    view.innerHTML = h;
  }
  async function renderDealPages() {
    const view = $("#view"), url = view.dataset.pdf, pages = (view.dataset.pages || "").split(",").filter(Boolean).map(Number);
    const box = $("#dealpages"); if (!box || !pages.length) return;
    const mod = await import("./deals.mjs");
    box.innerHTML = "";
    for (const n of pages) { const c = document.createElement("canvas"); c.style.cssText = "display:block;margin:12px 0;border-radius:8px;background:#fff"; box.appendChild(c); await mod.renderPage(url, n, c, Math.min(box.clientWidth || 380, 900)); }
  }

  /* ---------- Entdecken: Gerichte bewerten wie bei Tinder ----------
     Jeden Tag 20 Gerichte: rechts = lecker, links = lieber nicht, hoch = unbedingt bald (Stern).
     Die Stapel stellt der Buddy (Antwort-Aufgabe) in daten/ideen.json unter days zusammen – immer für den nächsten Tag,
     sobald heute geswiped wurde. Fehlt einer, mischt die App selbst aus dem Ideen-Pool und der Rezeptesammlung.
     Bewertungen gehen (ohne Namen) nach geschmack/bewertungen.json im Rezept-Repo; die Aufgaben lesen sie für künftige Pläne. */
  const TASTE_PATH = "/contents/geschmack/bewertungen.json";
  const TASTE_INFO = "Bewertungen aus dem Kochbuddy (Tab Entdecken). v: super = unbedingt bald einplanen, like = mag ich, nope = lieber nicht. Schlüssel: i:<id> = Idee aus app/daten/ideen.json, a:<slug> = Rezept aus rezepte/.";
  const SKIP_SLUGS = new Set(["frischkaese-gemuese-wraps", "kuerbissuppe-aus-dem-gefrierschrank", "spinat-kaese-frittata-aus-der-heissluftfritteuse"]);
  const HEART = '<svg class="ico" viewBox="0 0 24 24"><path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z" fill="currentColor"/></svg>';
  const STAR = '<svg class="ico" viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" fill="currentColor"/></svg>';
  const XMARK = '<svg class="ico" viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>';
  const UNDO = '<svg class="ico" viewBox="0 0 24 24"><path d="M8.5 6.5L4.5 10.5l4 4"/><path d="M4.5 10.5h9a5.5 5.5 0 0 1 0 11H11"/></svg>';
  const VERDICT = { like: "Lecker", super: "Unbedingt bald", nope: "Nein danke" };
  /* Bilder je Hauptzutat: Farbverlauf + gezeichnete Zutat (f = Fläche, s = Linie in Kartenfarbe, d = Punkt) */
  const PAL = {
    tomate: ["#C73A26", "#EC6A40"], kuerbis: ["#D9640F", "#F3973A"], kartoffel: ["#B5843A", "#DDB462"], nudel: ["#D29D1E", "#EEC758"], reis: ["#7E9567", "#AAC08F"],
    fisch: ["#2A6894", "#4C95C6"], huhn: ["#B86A22", "#DE9545"], rind: ["#862C28", "#B5473F"], wurst: ["#9C4234", "#C76650"], gemuese: ["#C8661E", "#EC9B48"],
    blatt: ["#2D7539", "#4F9F59"], kaese: ["#D6A928", "#F0D06A"], suppe: ["#A84F2B", "#D2794A"], auflauf: ["#92542A", "#C27C45"], brot: ["#9B6B36", "#C99758"],
    suess: ["#B84A6D", "#E07D9C"], pilz: ["#6E5E4E", "#9C8A74"], bohne: ["#5F7333", "#8CA552"],
  };
  const FOOD = {
    tomate: '<circle class="f" cx="60" cy="68" r="34"/><path class="s" d="M60 36l-9-8M60 36l9-8M60 36V24M60 36l-13 3M60 36l13 3"/><path class="s" d="M42 62q3-11 14-15"/>',
    kuerbis: '<ellipse class="f" cx="60" cy="70" rx="42" ry="31"/><path class="s" d="M60 40v60M43 43q-11 27 0 54M77 43q11 27 0 54"/><path class="s" d="M60 40q0-11 9-15"/>',
    kartoffel: '<path class="f" d="M28 66c0-21 19-33 37-31 17 2 28 15 26 31-2 19-19 29-37 27-17-2-26-13-26-27z"/><circle class="d" cx="50" cy="56" r="3.2"/><circle class="d" cx="72" cy="68" r="3.2"/><circle class="d" cx="56" cy="80" r="2.6"/>',
    nudel: '<path class="f" d="M20 42l34 18-34 18q-9-18 0-36zM100 42L66 60l34 18q9-18 0-36z"/><rect class="f" x="50" y="50" width="20" height="20" rx="7"/><path class="s" d="M28 49l7 4M28 71l7-4M92 49l-7 4M92 71l-7-4M55 60h10"/>',
    reis: '<path class="f" d="M30 58q30-34 60 0z"/><path class="f" d="M18 60h84a42 33 0 0 1-84 0z"/><path class="s" d="M18 60h84M46 49l4-2M60 43l4 2M72 51l4-1M54 54l3 2"/>',
    fisch: '<path class="f" d="M18 60q26-30 60-15l22-15v60L78 75q-34 15-60-15z"/><circle class="d" cx="38" cy="56" r="3.8"/><path class="s" d="M52 47q7 13 0 26M64 52v16"/>',
    huhn: '<ellipse class="f" cx="70" cy="48" rx="26" ry="21" transform="rotate(-35 70 48)"/><path class="fat" d="M54 62L36 82"/><circle class="f" cx="29" cy="85" r="8"/><circle class="f" cx="37" cy="94" r="8"/><path class="s" d="M62 40q8-6 16 0"/>',
    rind: '<path class="f" d="M24 54c4-17 26-26 47-21 20 5 30 20 24 37-7 17-28 23-47 19-15-3-28-17-24-35z"/><path class="s" d="M36 50q22-11 44 2"/><circle class="s" cx="72" cy="68" r="7"/>',
    wurst: '<path class="fat2" d="M26 70q34 26 68-10"/><path class="s" d="M40 72l4 5M58 78l2 6M76 70l4 5"/>',
    gemuese: '<path class="f" d="M88 32c-5-5-12-5-17 0L28 84c-3 5 0 7 5 5l49-37c7-6 9-14 6-20z"/><path class="s" d="M86 33l11-15M88 35l17-4M81 31l2-17M60 52l6 6M47 64l6 6"/>',
    blatt: '<path class="f" d="M24 94C24 52 50 26 98 24c0 47-26 70-74 70z"/><path class="s" d="M26 92L86 34M46 74h16M60 60V44M72 48h12"/>',
    kaese: '<path class="f" d="M18 64l68-32 16 32z"/><rect class="f" x="18" y="64" width="84" height="28" rx="4"/><path class="s" d="M18 64h84"/><circle class="d" cx="38" cy="78" r="5"/><circle class="d" cx="66" cy="82" r="4"/><circle class="d" cx="86" cy="74" r="3"/><circle class="d" cx="72" cy="54" r="3.5"/>',
    suppe: '<path class="steam2" d="M46 42q-6-8 0-16t0-16M60 42q-6-8 0-16t0-16M74 42q-6-8 0-16t0-16"/><path class="f" d="M16 56h88a44 35 0 0 1-88 0z"/><path class="s" d="M24 63h72"/>',
    auflauf: '<rect class="f" x="20" y="46" width="80" height="42" rx="11"/><path class="fat3" d="M12 60h10M98 60h10"/><path class="s" d="M28 58q8-7 16 0t16 0 16 0 16 0"/><circle class="d" cx="40" cy="73" r="3.4"/><circle class="d" cx="60" cy="78" r="3.4"/><circle class="d" cx="80" cy="71" r="3.4"/>',
    brot: '<path class="f" d="M20 74c0-21 17-36 40-36s40 15 40 36v14H20z"/><path class="s" d="M40 55l9 13M57 51l9 13M74 55l9 13"/>',
    suess: '<ellipse class="fs" cx="60" cy="86" rx="40" ry="10"/><ellipse class="fs" cx="60" cy="74" rx="38" ry="10"/><ellipse class="fs" cx="60" cy="62" rx="36" ry="10"/><circle class="d" cx="60" cy="47" r="7"/><path class="s2" d="M60 40q2-8 9-10"/>',
    pilz: '<path class="f" d="M18 62a42 32 0 0 1 84 0z"/><path class="f" d="M47 62h26l-4 32H51z"/><path class="s" d="M22 62h76M40 50q6-8 14-10"/>',
    bohne: '<ellipse class="f" cx="42" cy="54" rx="17" ry="11.5" transform="rotate(-20 42 54)"/><ellipse class="f" cx="76" cy="50" rx="17" ry="11.5" transform="rotate(25 76 50)"/><ellipse class="f" cx="60" cy="80" rx="17" ry="11.5" transform="rotate(-6 60 80)"/><path class="s" d="M36 52q6 5 13 2M70 47q6 6 13 6M53 80q7 3 14 0"/>',
  };
  const artFor = (title) => {
    const t = title.toLowerCase();
    const K = [["fisch", /lachs|fisch|seelachs|kabeljau|thunfisch|forelle/], ["huhn", /hähnchen|huhn|hühn|pute|chicken/], ["rind", /gulasch|rind|hack|frikadell|bolognese|braten|schnitzel/],
      ["kuerbis", /kürbis/], ["tomate", /tomate/], ["suppe", /suppe|eintopf/], ["suess", /pfannkuchen|grieß|milchreis|schmarrn/], ["auflauf", /auflauf|gratin|lasagne/],
      ["nudel", /nudel|pasta|fusilli|gnocchi|spätzle/], ["kartoffel", /kartoffel|puffer/], ["brot", /flammkuchen|vesper|brot/], ["blatt", /brokkoli|spinat|salat/], ["kaese", /käse|raclette/]];
    for (const [k, re] of K) if (re.test(t)) return k;
    return "gemuese";
  };
  const taste = () => { S.taste = S.taste || { r: {}, ops: [], hist: [] }; S.taste.r = S.taste.r || {}; S.taste.ops = S.taste.ops || []; S.taste.hist = S.taste.hist || []; return S.taste; };
  /* „Eingeplant“ (schreibt die Wochenaufgabe): im Speicher halten, im Hintergrund höchstens alle 10 Min. auffrischen –
     die Ansicht wartet nie aufs Netz */
  let einCache = null, einAt = 0, einLoading = null;
  function loadEingeplant() {
    if (einLoading) return einLoading;
    einLoading = (ablage.privat ? (dataReady() && ghToken() ? dgh("GET", "/contents/geschmack/eingeplant.json").then((r) => (r ? JSON.parse(b64d(r.content)) : {})) : Promise.resolve({})) : fetch("../geschmack/eingeplant.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : {})))
      .catch(() => einCache || {}).then((d) => { einCache = d || {}; einAt = Date.now(); S.einCache = einCache; save(); return einCache; }).finally(() => { einLoading = null; });
    return einLoading;
  }
  function eingeplant() {
    if (!einCache && S.einCache) einCache = S.einCache;
    if (embedded) return Promise.resolve({});
    if (!einCache) return loadEingeplant();
    if (Date.now() - einAt > 10 * 60000) loadEingeplant();
    return Promise.resolve(einCache);
  }
  async function tastePool() {
    const [idea, recs, plan] = await Promise.all([
      getJSON("daten/ideen.json").catch(() => ({ ideas: [], days: {} })),
      getJSON("../rezepte/rezepte.json").catch(() => (embedded && embedded.files["../rezepte/rezepte.json"]) || []),
      eingeplant(),
    ]);
    const ideas = (idea.ideas || []).filter((x) => x && x.id && x.t).map((x) => ({ id: "i:" + x.id, t: x.t, d: x.d || "", tags: x.tags || [], min: x.min, art: FOOD[x.art] ? x.art : artFor(x.t), src: "idee" }));
    const recipes = (recs || []).filter((r) => !SKIP_SLUGS.has(r.slug) && !(r.tags || []).includes("Vorrat")).map((r) => ({ id: "a:" + r.slug, t: r.title, d: r.last ? `Gab es bei euch zuletzt in ${r.last}. Wieder einplanen?` : "", tags: r.tags || [], min: r.total, art: artFor(r.title), src: "rezept", slug: r.slug }));
    const all = [...ideas, ...recipes];
    return { ideas, recipes, all, byId: new Map(all.map((x) => [x.id, x])), days: idea.days || {}, planned: (plan && plan.items) || {} };
  }
  function seeded(str) { let h = 2166136261 >>> 0; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; }; }
  const shuffled = (arr, rnd) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  /* Der Stapel für heute: 1. vom Buddy für heute, 2. ein älterer, noch nicht fertiger Buddy-Stapel, 3. selbst gemischt */
  function mainDeck(pool) {
    const T = taste(), day = today(), ok = (ids) => (ids || []).map((id) => (String(id).includes(":") ? String(id) : "i:" + id)).filter((id) => pool.byId.has(id));
    if (pool.days[day] && ok(pool.days[day]).length) return { ids: ok(pool.days[day]), by: "buddy", key: day };
    const older = Object.keys(pool.days).filter((k) => k < day).sort().reverse();
    for (const k of older) { const ids = ok(pool.days[k]); if (ids.length && ids.some((id) => !T.r[id])) return { ids, by: "buddy", key: k }; }
    if (T.deck && T.deck.day === day && !T.deck.extra) return { ids: ok(T.deck.ids), by: "app", key: day, reask: T.deck.reask || [] };
    const rnd = seeded("kochbuddy-" + day);
    const fresh = (x) => !T.r[x.id] || T.r[x.id].day === day; // heute Bewertetes bleibt drin, damit alle Geräte denselben Stapel haben
    const fi = shuffled(pool.ideas.filter(fresh), rnd), fr = shuffled(pool.recipes.filter(fresh), rnd);
    const nI = Math.min(fi.length, 20 - Math.min(4, fr.length)), nR = Math.min(fr.length, 20 - nI);
    let ids = shuffled([...fi.slice(0, nI), ...fr.slice(0, nR)], rnd).map((x) => x.id), reask = [];
    if (ids.length < 20) { // alles bewertet: lange zurückliegende „Lecker“/„Unbedingt“ nochmal fragen
      const old = pool.all.filter((x) => T.r[x.id] && T.r[x.id].v !== "nope" && Date.now() - new Date(T.r[x.id].at).getTime() > 21 * 86400000).sort((a, b) => (T.r[a.id].at < T.r[b.id].at ? -1 : 1)).slice(0, 20 - ids.length).map((x) => x.id);
      ids = ids.concat(old); reask = old;
    }
    T.deck = { day, ids, reask }; save();
    return { ids, by: "app", key: day, reask };
  }
  function extraDeck(pool, n = 10) {
    const T = taste(), day = today();
    const rnd = seeded("kochbuddy-extra-" + day + "-" + Object.keys(T.r).length);
    const ids = shuffled(pool.all.filter((x) => !T.r[x.id]), rnd).slice(0, n).map((x) => x.id);
    T.extra = { day, ids }; save();
    return ids;
  }
  const isDone = (id, deck) => { const r = taste().r[id]; return !!r && (!(deck.reask || []).includes(id) || r.day === today()); };
  function rate(item, v) {
    const T = taste(), at = new Date().toISOString(), prev = T.r[item.id] ? { ...T.r[item.id] } : null;
    T.r[item.id] = { v, at, day: today() };
    T.ops.push({ op: "set", id: item.id, v, at, t: item.t, tags: item.tags, src: item.src });
    T.hist.push({ id: item.id, prev, t: item.t, tags: item.tags, src: item.src }); T.hist = T.hist.slice(-40);
    S.settings.swiped = 1; save(); scheduleTastePush();
    if (navigator.vibrate && S.settings.vibrate) navigator.vibrate(v === "super" ? [12, 40, 12] : 12);
  }
  function undoRate() {
    const T = taste(), h = T.hist.pop();
    if (!h) return null;
    if (h.prev) { T.r[h.id] = h.prev; T.ops.push({ op: "set", id: h.id, v: h.prev.v, at: h.prev.at, t: h.t, tags: h.tags, src: h.src }); }
    else { delete T.r[h.id]; T.ops.push({ op: "del", id: h.id }); }
    save(); scheduleTastePush(); return h.id;
  }
  let tasteTimer = null, tasteSyncing = null;
  const scheduleTastePush = (ms = 8000) => { clearTimeout(tasteTimer); tasteTimer = setTimeout(() => syncTaste(true).then((ch) => { if (ch && location.hash.startsWith("#/entdecken") && !swAnim) rerenderSoft(); }), ms); };
  function mergeTaste(items) {
    const T = taste(); let ch = false;
    for (const [id, x] of Object.entries(items || {})) {
      if (!x || !x.v) continue;
      const loc = T.r[id];
      if ((!loc || x.at > loc.at) && !T.ops.some((o) => o.id === id)) { T.r[id] = { v: x.v, at: x.at, day: toIso(new Date(x.at)) }; ch = true; }
    }
    if (ch) save();
    return ch;
  }
  function syncTaste(quiet) {
    if (embedded) return Promise.resolve(false);
    if (tasteSyncing) return tasteSyncing;
    tasteSyncing = (async () => {
      const T = taste();
      if (!dataReady()) return false;
      try {
        if (ghToken() && T.ops.length) {
          for (let k = 0; k < 3; k++) {
            const r = await dgh("GET", TASTE_PATH);
            const data = r ? JSON.parse(b64d(r.content)) : {};
            data.info = TASTE_INFO; data.items = data.items || {};
            const ops = T.ops.slice();
            for (const o of ops) { if (o.op === "del") delete data.items[o.id]; else data.items[o.id] = { v: o.v, at: o.at, t: o.t, tags: o.tags, src: o.src }; }
            data.updated = new Date().toISOString();
            try {
              await dgh("PUT", TASTE_PATH, { message: `Koch-App: ${ops.length} ${ops.length === 1 ? "Bewertung" : "Bewertungen"} (Entdecken)`, content: b64e(JSON.stringify(data, null, 1) + "\n"), ...(r ? { sha: r.sha } : {}) });
              T.ops = T.ops.slice(ops.length); T.pushed = Date.now(); save(); syncMark(true);
              mergeTaste(data.items);
              return true;
            } catch (e) { if (e.code === 409 || e.code === 422) continue; throw e; }
          }
        } else if (!T.ops.length) {
          let items = null;
          if (ghToken()) { const r = await dgh("GET", TASTE_PATH); items = r ? JSON.parse(b64d(r.content)).items : null; }
          else if (!ablage.privat) { const res = await fetch("../geschmack/bewertungen.json", { cache: "no-cache" }); if (res.ok) items = (await res.json()).items; }
          return mergeTaste(items);
        }
      } catch (e) {
        syncMark(false, e);
        if (!quiet && e.code === "auth") { toast(`Bewertungen nicht gespeichert: ${e.message}`); tokenSheet(e.message); }
      }
      return false;
    })().finally(() => { tasteSyncing = null; });
    return tasteSyncing;
  }
  /* Woche: kleiner Hinweis, solange heute noch Gerichte warten */
  async function discoverTeaser() {
    if (embedded) return "";
    try {
      const pool = await tastePool(), deck = mainDeck(pool), left = deck.ids.filter((id) => !isDone(id, deck)).length;
      if (!left) return "";
      return `<a class="card teaser" href="#/entdecken"><span class="tz-stack" aria-hidden="true"><i></i><i></i><i>${HEART}</i></span><span class="ev-t"><small>Entdecken</small><b>${left === deck.ids.length ? `${left} Gerichte warten aufs Bewerten` : `Noch ${left} von ${deck.ids.length} Gerichten bewerten`}</b></span><span class="chev">${NEXT}</span></a>`;
    } catch (e) { return ""; }
  }
  let swState = null, swAnim = false;
  async function renderDiscover(view) {
    const head = (k, eb) => `<header class="top sw-top"><div><div class="eyebrow">${k}${eb}</div><h1>Entdecken</h1></div></header>`;
    let pool;
    try { pool = await tastePool(); } catch (e) { pool = null; }
    if (!pool || !pool.all.length) { view.innerHTML = head("", "Gerichte bewerten") + `<p class="empty">Die Gerichte ließen sich gerade nicht laden. Mit Internet nochmal öffnen.</p>`; return; }
    const T = taste(), main = mainDeck(pool);
    let deck = main, extra = false;
    if (!main.ids.some((id) => !isDone(id, main)) && T.extra && T.extra.day === today()) {
      const ex = { ids: T.extra.ids.filter((id) => pool.byId.has(id)), by: "app", key: "extra" };
      if (ex.ids.some((id) => !isDone(id, ex))) { deck = ex; extra = true; }
    }
    const left = deck.ids.filter((id) => !isDone(id, deck));
    const done = deck.ids.length - left.length;
    swState = { pool, deck, left: left.slice(), extra };
    if (!left.length) { view.innerHTML = swSummary(pool, main, head); return; }
    let h = head(`<span class="kw" id="swcount">${done + 1} / ${deck.ids.length}</span>`, extra ? "Zusatzrunde" : deck.key < today() ? "Von gestern übrig" : "Heute zum Bewerten");
    h += S.settings.swiped ? `<p class="sw-intro short"><b>Rechts</b> lecker · <b>links</b> nein danke · <b>oben</b> unbedingt bald</p>` : `<p class="sw-intro">Nach <b>rechts</b> wischen, was dir schmeckt, nach <b>links</b>, was nicht. Nach <b>oben</b>: unbedingt bald kochen – das plant der Buddy in den nächsten Wochen ein.</p>`;
    h += `<div class="deck" id="deck">${left.slice(0, 3).map((id, i) => swCard(pool.byId.get(id), i)).reverse().join("")}</div>`;
    h += `<div class="sw-btns">
      <button class="swb undo" data-swipe="undo" aria-label="Letzte Bewertung zurücknehmen" ${T.hist.length ? "" : "disabled"}>${UNDO}<small>Zurück</small></button>
      <button class="swb no" data-swipe="nope">${XMARK}<small>Nein danke</small></button>
      <button class="swb up" data-swipe="super">${STAR}<small>Unbedingt</small></button>
      <button class="swb yes" data-swipe="like">${HEART}<small>Lecker</small></button></div>`;
    h += `<p class="sw-sync">${tasteSyncLine()}</p>`;
    view.innerHTML = h;
    if (!S.settings.swiped) setTimeout(() => { const c = $(".sw-card.front"); if (c && !swAnim) c.classList.add("nudge"); }, 700);
  }
  const tasteSyncLine = () => (embedded ? "" : !ghToken() ? `Bewertungen bleiben erst einmal auf diesem Gerät. Damit der Buddy sie sieht: <a href="#" data-act="gh-setup">einmalig Speichern einrichten</a>` : taste().ops.length ? "Wird gleich für den Buddy gespeichert …" : "Für den Buddy gespeichert – er plant künftig danach.");
  function swCard(x, i) {
    const p = PAL[x.art] || PAL.gemuese, tags = (x.tags || []).filter((t) => !["Thermomix", "Varoma", "Meal-Prep", "Vorkochen", "Einfrieren", "Eisen"].includes(t));
    return `<article class="sw-card${i === 0 ? " front" : ""}" data-id="${esc(x.id)}" style="--c1:${p[0]};--c2:${p[1]};--i:${i}">
      <div class="sw-art${x.slug && fotoOf(x.slug) ? " has-ph" : ""}">${x.slug && fotoOf(x.slug) ? fotoImg(fotoOf(x.slug), 700, "sw-ph") : ""}<svg class="food" viewBox="0 0 120 120" aria-hidden="true">${FOOD[x.art] || FOOD.gemuese}</svg><span class="sw-src">${x.src === "rezept" ? "Aus eurer Sammlung" : "Neue Idee"}</span>${x.min ? `<span class="sw-min">${CLOCK}${x.min} Min.</span>` : ""}</div>
      <div class="sw-body"><div class="chips">${tagChips(tags, 3)}</div><h2>${esc(x.t)}</h2>${x.d ? `<p>${esc(x.d)}</p>` : ""}</div>
      <b class="stamp yes">Lecker</b><b class="stamp no">Nein danke</b><b class="stamp up">Unbedingt bald</b></article>`;
  }
  function swSummary(pool, main, head) {
    const T = taste(), todays = main.ids.map((id) => pool.byId.get(id)).filter((x) => x && T.r[x.id]);
    const by = (v) => todays.filter((x) => T.r[x.id].v === v);
    const total = Object.keys(T.r).length, more = pool.all.some((x) => !T.r[x.id]);
    let h = head("", "Heute erledigt");
    h += `<section class="card today sw-done">${ART.plate}<h2>Danke – für heute fertig!</h2><p>Morgen warten neue Gerichte. Der Buddy stellt sie nach deinen Bewertungen zusammen und plant, was dir schmeckt.</p>
      <div class="sw-stats"><span class="s-up">${STAR}<b>${by("super").length}</b>Unbedingt</span><span class="s-yes">${HEART}<b>${by("like").length}</b>Lecker</span><span class="s-no">${XMARK}<b>${by("nope").length}</b>Nein danke</span></div></section>`;
    if (!embedded && !ghToken()) h += `<section class="act"><div class="act-h"><span class="act-ico">${HEART}</span><div><span class="act-k">Bitte einmal einrichten</span><b>Bewertungen für den Buddy speichern</b><div class="small">Bisher liegen sie nur auf diesem Gerät. Mit dem GitHub-Schlüssel (derselbe wie fürs Tauschen) kommen sie beim Buddy an.</div></div></div><div class="act-btns"><button class="btn primary" data-act="gh-setup">Jetzt einrichten</button></div></section>`;
    else if (!embedded) h += `<p class="sw-sync">${tasteSyncLine()}</p>`;
    const list = (v, title) => { const xs = by(v); return xs.length ? `<h2 class="section-title">${title}</h2><ul class="sw-list">${xs.map((x) => swRow(x, pool)).join("")}</ul>` : ""; };
    h += list("super", "Unbedingt bald") + list("like", "Lecker") + list("nope", "Nein danke");
    h += `<p class="small muted sw-foot">Insgesamt ${total} Gerichte bewertet. Antippen ändert die Bewertung.</p>`;
    if (more) h += `<button class="btn big" data-act="sw-more">Noch 10 weitere Gerichte bewerten</button>`;
    return h;
  }
  function swRow(x, pool) {
    const v = taste().r[x.id].v, pl = pool.planned[x.id];
    return `<li class="sw-row"><span class="sw-dot" style="--c1:${(PAL[x.art] || PAL.gemuese)[0]}"></span><span class="sw-rt"><b>${esc(x.t)}</b>${pl ? `<span class="chip ok">Eingeplant: ${esc(pl.kw || "")}</span>` : ""}</span>
      <span class="sw-pick" role="group" aria-label="Bewertung ändern">${["nope", "like", "super"].map((k) => `<button class="${k}${v === k ? " on" : ""}" data-rerate="${esc(x.id)}|${k}" aria-label="${VERDICT[k]}" aria-pressed="${v === k}">${k === "nope" ? XMARK : k === "like" ? HEART : STAR}</button>`).join("")}</span></li>`;
  }
  /* Wischen: Karte folgt dem Finger, Stempel zeigen die Entscheidung, loslassen über der Schwelle entscheidet */
  let swDrag = null;
  document.addEventListener("pointerdown", (e) => {
    const c = e.target.closest(".sw-card.front");
    if (!c || swAnim || swDrag) return;
    c.classList.remove("nudge");
    swDrag = { el: c, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, pid: e.pointerId, moved: false };
    try { c.setPointerCapture(e.pointerId); } catch (er) { /* egal */ }
    c.classList.add("drag");
  });
  document.addEventListener("pointermove", (e) => {
    if (!swDrag || e.pointerId !== swDrag.pid) return;
    const d = swDrag; d.dx = e.clientX - d.x0; d.dy = e.clientY - d.y0;
    if (Math.hypot(d.dx, d.dy) > 4) d.moved = true;
    d.el.style.transform = `translate(${d.dx}px, ${d.dy}px) rotate(${d.dx * 0.06}deg)`;
    const up = d.dy < 0 && Math.abs(d.dy) > Math.abs(d.dx) ? Math.min(1, -d.dy / 110) : 0;
    d.el.style.setProperty("--yes", up ? 0 : Math.max(0, Math.min(1, d.dx / 100)));
    d.el.style.setProperty("--no", up ? 0 : Math.max(0, Math.min(1, -d.dx / 100)));
    d.el.style.setProperty("--up", up);
  }, { passive: true });
  const swEnd = (e) => {
    if (!swDrag || (e && e.pointerId !== swDrag.pid)) return;
    const d = swDrag; swDrag = null;
    d.el.classList.remove("drag");
    const v = d.dx > 110 ? "like" : d.dx < -110 ? "nope" : d.dy < -120 && Math.abs(d.dx) < Math.abs(d.dy) ? "super" : null;
    if (v) swDecide(v, d.el);
    else { d.el.style.transform = ""; ["--yes", "--no", "--up"].forEach((p) => d.el.style.setProperty(p, 0)); }
  };
  document.addEventListener("pointerup", swEnd);
  document.addEventListener("pointercancel", swEnd);
  document.addEventListener("keydown", (e) => {
    if (!location.hash.startsWith("#/entdecken") || !$("#sheet").hidden || /INPUT|TEXTAREA/.test((e.target || {}).tagName || "")) return;
    const v = { ArrowRight: "like", ArrowLeft: "nope", ArrowUp: "super" }[e.key];
    if (v && $(".sw-card.front")) { e.preventDefault(); swDecide(v); }
  });
  function swDecide(v, el) {
    if (swAnim || !swState) return;
    const card = el || $(".sw-card.front");
    if (!card) return;
    const item = swState.pool.byId.get(card.dataset.id);
    if (!item) return;
    swAnim = true;
    rate(item, v);
    const W = window.innerWidth;
    card.classList.add("fly");
    card.style.setProperty(v === "like" ? "--yes" : v === "nope" ? "--no" : "--up", 1);
    card.style.transform = v === "super" ? `translate(0, -${window.innerHeight}px) rotate(0deg)` : `translate(${v === "like" ? W * 1.3 : -W * 1.3}px, 40px) rotate(${v === "like" ? 24 : -24}deg)`;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => {
      card.remove();
      swState.left = swState.left.filter((id) => id !== item.id);
      const deckEl = $("#deck");
      if (!swState.left.length || !deckEl) { swAnim = false; syncTaste(true); rerenderSoft(); return; }
      const cards = $$(".sw-card", deckEl).reverse(); // oben zuerst
      cards.forEach((c, i) => { c.style.setProperty("--i", i); c.classList.toggle("front", i === 0); });
      const next = swState.left[cards.length];
      if (next && cards.length < 3) deckEl.insertAdjacentHTML("afterbegin", swCard(swState.pool.byId.get(next), cards.length).replace('class="sw-card', 'class="sw-card enter'));
      const cnt = $("#swcount"); if (cnt) cnt.textContent = `${swState.deck.ids.length - swState.left.length + 1} / ${swState.deck.ids.length}`;
      const u = $("[data-swipe='undo']"); if (u) u.disabled = false;
      const sy = $(".sw-sync"); if (sy) sy.innerHTML = tasteSyncLine();
      swAnim = false;
    }, reduce ? 10 : 320);
  }

  /* ---------- Sterne & Kinder-Stempel: Bewertung jedes Gerichts ----------
     1–5 Sterne pro Rezept (Schlüssel = Rezept-Slug), jederzeit änderbar. Dazu der Stempel „Für <Kind> geeignet“ (Name nur auf dem Gerät).
     Was auf dem Plan stand, merkt sich die App im Essens-Log (die Wochendaten verschwinden, sobald der nächste Plan da ist).
     Ab dem Samstag nach einer Planwoche fragt die App die Gerichte ohne Sterne ab, bevor es weitergeht.
     Gespeichert wird auf dem Gerät und – mit dem GitHub-Schlüssel – in geschmack/sterne.json im Rezept-Repo. */
  const STARS_PATH = "/contents/geschmack/sterne.json";
  const STARS_INFO = "Sterne aus dem Kochbuddy. Schlüssel = Rezept-Slug aus rezepte/. s: 1–5 Sterne, kind: true = fürs Kind geeignet, t: Titel, at: Zeitpunkt.";
  const STAR5 = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.75 5.6 6.15.9-4.45 4.33 1.05 6.12L12 16.87l-5.5 2.88 1.05-6.12L3.1 9.3l6.15-.9z"/></svg>';
  const BABY = '<svg class="ico baby" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.2" r="7.6"/><path d="M12 5.6c-.4-1.9.9-3.2 2.4-2.7"/><path d="M8.6 12.6q1 1 2 0M13.4 12.6q1 1 2 0"/><path d="M10.6 16.2q1.4 1.1 2.8 0"/><circle cx="7.9" cy="15" r="1.1" class="ck"/><circle cx="16.1" cy="15" r="1.1" class="ck"/></svg>';
  const RATE_WORD = ["", "Nicht so", "Geht so", "Gut", "Sehr gut", "Lieblingsgericht"];
  let stampN = 0, justStamped = null, lastDeleted = null;
  /* Der Stempel: Babygesicht im runden Gummistempel mit Schrift im Kreis */
  function stampSvg(cls = "") {
    const id = "st" + ++stampN;
    return `<svg class="astamp ${cls}" viewBox="0 0 140 140" role="img" aria-label="Stempel: Für ${esc(kidFor())} geeignet">
      <defs><path id="${id}t" d="M22 70a48 48 0 0 1 96 0"/><path id="${id}b" d="M14 70a56 56 0 0 0 112 0"/>
      <mask id="${id}m"><rect width="140" height="140" fill="#fff"/>${[[30, 34, 1.6], [104, 30, 1.2], [118, 84, 1.8], [40, 112, 1.4], [86, 118, 1.1], [62, 22, 1], [22, 92, 1.2], [96, 64, 1.3], [52, 78, .9]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#000"/>`).join("")}<path d="M18 50q30-6 50 2" stroke="#000" stroke-width=".8" fill="none" opacity=".7"/></mask></defs>
      <g mask="url(#${id}m)">
        <circle cx="70" cy="70" r="64" class="ring1"/><circle cx="70" cy="70" r="57" class="ring2"/>
        <text class="arc"><textPath href="#${id}t" startOffset="50%" text-anchor="middle">${esc(kidName() && kidName().length <= 9 ? "FÜR " + kidName().toUpperCase() : "FÜRS KIND")}</textPath></text>
        <text class="arc lo"><textPath href="#${id}b" startOffset="50%" text-anchor="middle">GEEIGNET</textPath></text>
        <path class="hrt" d="M17 70.5c-1.6-1.4-3.4-2.7-3.4-4.4a1.9 1.9 0 0 1 3.4-1.1 1.9 1.9 0 0 1 3.4 1.1c0 1.7-1.8 3-3.4 4.4zM123 70.5c-1.6-1.4-3.4-2.7-3.4-4.4a1.9 1.9 0 0 1 3.4-1.1 1.9 1.9 0 0 1 3.4 1.1c0 1.7-1.8 3-3.4 4.4z"/>
        <g class="face"><circle cx="70" cy="74" r="25" class="head"/><path d="M45.5 72a5 5 0 0 0 0 9M94.5 72a5 5 0 0 1 0 9" class="ln"/>
          <path d="M70 49c-2.5-6 2-10.5 7-8.5 3 1.3 2.6 5.2-.4 5.3" class="ln"/>
          <path d="M58 71q4 4 8 0M74 71q4 4 8 0" class="ln"/><circle cx="56" cy="80.5" r="4" class="ck"/><circle cx="84" cy="80.5" r="4" class="ck"/>
          <path d="M64 84q6 6 12 0" class="ln"/></g>
      </g></svg>`;
  }
  const stars = () => { const T = (S.stars = S.stars || {}); T.r = T.r || {}; T.ops = T.ops || []; T.log = T.log || {}; T.skip = T.skip || {}; return T; };
  { const T = stars(), old = "an" + "ton"; for (const x of [...Object.values(T.r), ...T.ops]) if (x && old in x) { if (x[old]) x.kind = true; delete x[old]; } }
  const starMeta = {};
  const slugOf = (ref, r) => (r && r.slug) || (ref && ref.startsWith("a:") ? ref.slice(2) : "");
  const rating = (slug) => stars().r[slug] || {};
  /* Sterne-Leiste: tippen setzt, nochmal tippen auf einen anderen Stern ändert */
  function starsHtml(r, size = "") {
    if (!r || !r.slug) return "";
    starMeta[r.slug] = { t: r.title, tags: r.tags || [] };
    const s = rating(r.slug).s || 0;
    return `<span class="stars ${size}${s ? " set" : ""}" role="radiogroup" aria-label="Sterne für ${esc(r.title)}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="${n === s}" aria-label="${n} ${n === 1 ? "Stern" : "Sterne"}" data-star="${esc(r.slug)}|${n}" class="${n <= s ? "on" : ""}">${STAR5}</button>`).join("")}</span>`;
  }
  const babyBtn = (r, label) => { const on = !!rating(r.slug).kind; return `<button type="button" class="baby-btn${on ? " on" : ""}${label ? " lbl" : ""}" data-kid="${esc(r.slug)}" aria-pressed="${on}" aria-label="Für ${esc(kidFor())} geeignet">${BABY}${label ? `<span>${on ? (kidName() ? esc(kidName()) + "-geeignet" : "Kindgerecht") : `Für ${esc(kidFor())} geeignet?`}</span>` : ""}</button>`; };
  function setStar(slug, patch) {
    const T = stars(), cur = { ...(T.r[slug] || {}) }, at = new Date().toISOString(), m = starMeta[slug] || {};
    Object.assign(cur, patch, { at });
    if (!cur.kind) delete cur.kind;
    T.r[slug] = cur;
    T.ops.push({ slug, s: cur.s || 0, kind: !!cur.kind, at, t: m.t || cur.t || "", tags: m.tags || [] });
    if (m.t) cur.t = m.t;
    save(); scheduleStarsPush();
    if (navigator.vibrate && S.settings.vibrate) navigator.vibrate(patch.kind ? [10, 40, 10] : 10);
  }
  /* Essens-Log: was wann auf dem Plan stand (Schlüssel Tag|Mahlzeit) */
  function logMeals(w) {
    const T = stars(); let ch = false;
    for (const d of w.days) for (const m of d.meals) {
      const r = w.recipes[m.recipe]; if (!r || !r.slug) continue;
      const k = `${d.iso}|${m.slot}`, prev = T.log[k];
      if (!prev || prev.slug !== r.slug) { T.log[k] = { slug: r.slug, t: r.title, tags: r.tags || [], wk: weekId }; ch = true; }
      starMeta[r.slug] = { t: r.title, tags: r.tags || [] };
    }
    const old = addDays(today(), -70);
    for (const k of Object.keys(T.log)) if (k < old) { delete T.log[k]; ch = true; }
    if (ch) save();
  }
  const slotRank = (x) => (/mittag/i.test(x) ? 0 : 1);
  const logKeys = (T) => Object.keys(T.log).sort((a, b) => { const [ia, sa] = a.split("|"), [ib, sb] = b.split("|"); return ia < ib ? -1 : ia > ib ? 1 : slotRank(sa) - slotRank(sb); });
  const eatenAt = (iso, slot) => { const [H, M] = (S.settings.eat[slot] || (/mittag/i.test(slot) ? "12:00" : "18:00")).split(":").map(Number); const d = new Date(iso + "T00:00"); d.setHours(H, M + 30, 0, 0); return d.getTime(); };
  const fridayOf = (iso) => { const dow = new Date(iso + "T12:00").getDay(); return addDays(iso, ((5 - dow) + 7) % 7); };
  /* Gegessene Gerichte ohne Sterne; due = nur die, deren Planwoche schon vorbei ist (ab Samstag) */
  function unrated(due) {
    const T = stars(), now = Date.now(), t = today(), seen = new Map();
    for (const k of logKeys(T)) {
      const [iso, slot] = k.split("|"), x = T.log[k];
      if (eatenAt(iso, slot) > now) continue;
      if (due && fridayOf(iso) >= t) continue;
      if ((T.r[x.slug] || {}).s || T.skip[x.slug + "|" + x.wk] || seen.has(x.slug)) continue;
      starMeta[x.slug] = starMeta[x.slug] || { t: x.t, tags: x.tags };
      seen.set(x.slug, { slug: x.slug, title: x.t, tags: x.tags, iso, slot, wk: x.wk });
    }
    return [...seen.values()];
  }
  const dayShort = (iso) => `${DAYS[new Date(iso + "T12:00").getDay()].slice(0, 2)} ${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`;
  /* Woche: kleine Karte „Wie hat's geschmeckt?“ für gegessene Gerichte ohne Sterne */
  function rateCard() {
    const t = today(), list = unrated(false).filter((x) => fridayOf(x.iso) >= t).slice(0, 6);
    if (!list.length) return "";
    return `<section class="card rate-card"><div class="rc-h"><span class="rc-ico">${STAR5}</span><div><b>Wie hat's geschmeckt?</b><div class="small muted">${list.length === 1 ? "1 Gericht" : list.length + " Gerichte"} noch ohne Sterne – direkt hier antippen.</div></div></div>
      <ul class="rate-rows">${list.map((x) => rateRow(x)).join("")}</ul></section>`;
  }
  const rateRow = (x, skip) => { const r = { slug: x.slug, title: x.title, tags: x.tags }, done = !!rating(x.slug).s;
    return `<li class="rrow${done ? " done" : ""}"><div class="rr-t"><b>${esc(x.title)}</b><small>${esc(dayShort(x.iso))} · ${esc(x.slot)}</small></div><div class="rr-a">${starsHtml(r)}${babyBtn(r)}${skip && !done ? `<button type="button" class="btn small ghost skip" data-starskip="${esc(x.slug)}|${esc(x.wk || "")}">Gab's nicht</button>` : ""}</div></li>`; };
  /* Wochen-Check: ab Samstag nach der Planwoche, bevor es weitergeht */
  let reviewList = null, starsReady = false;
  function reviewDue() {
    if (embedded && !S.settings.reviewDemo) return [];
    return unrated(true);
  }
  function maybeReview() {
    if (inCooking || !$("#alarm").hidden || (!$("#sheet").hidden && !$("#sheet").dataset.review) || (S.block[weekId] && S.block[weekId].start && !S.block[weekId].end && location.hash.startsWith("#/vorkochen"))) return;
    if (!S.settings.toured && !embedded) return;
    if (!starsReady && !embedded) return;
    const list = reviewDue();
    if (!list.length) { if ($("#sheet").dataset.review) closeSheet(); reviewList = null; return; }
    if (!reviewList) reviewList = list;
    else for (const x of list) if (!reviewList.some((y) => y.slug === x.slug)) reviewList.push(x);
    drawReview();
  }
  function drawReview() {
    const T = stars(), left = reviewList.filter((x) => !(T.r[x.slug] || {}).s && !T.skip[x.slug + "|" + x.wk]).length;
    openSheet(`<div class="review"><div class="rv-art">${ART.plate}</div><span class="eyebrow">Wochen-Check</span><h2>Wie hat's euch geschmeckt?</h2>
      <p class="muted" style="margin:6px 0 4px">Bevor es weitergeht: kurz Sterne für die Gerichte der letzten Woche vergeben. Das Baby antippen, wenn es auch für ${esc(kidFor())} gepasst hat.</p>
      <ul class="rate-rows">${reviewList.map((x) => rateRow(x, true)).join("")}</ul>
      <button class="btn primary big" data-act="review-done"${left ? " disabled" : ""}>${left ? `Noch ${left} ${left === 1 ? "Gericht" : "Gerichte"} offen` : "Fertig – weiter geht's"}</button>
      ${starsSyncLine() ? `<p class="small muted" style="margin:12px 0 0">${starsSyncLine()}</p>` : ""}</div>`, { review: 1 });
  }
  let starsTimer = null, starsSyncing = null;
  const scheduleStarsPush = (ms = 6000) => { clearTimeout(starsTimer); starsTimer = setTimeout(() => syncStars(true), ms); };
  const starsSyncLine = () => (embedded ? "" : !ghToken() ? `Die Sterne bleiben erst einmal auf diesem Gerät. Damit der Buddy sie sieht: <a href="#" data-act="gh-setup">einmalig Speichern einrichten</a>` : "");
  function mergeStars(items) {
    const T = stars(); let ch = false;
    for (const [slug, x] of Object.entries(items || {})) {
      if (!x) continue;
      const loc = T.r[slug];
      if ((!loc || (x.at || "") > (loc.at || "")) && !T.ops.some((o) => o.slug === slug)) { T.r[slug] = { s: x.s || 0, at: x.at, t: x.t, ...(x.kind || x["an" + "ton"] ? { kind: true } : {}) }; ch = true; }
    }
    if (ch) save();
    return ch;
  }
  function syncStars(quiet) {
    if (embedded) return Promise.resolve(false);
    if (starsSyncing) return starsSyncing;
    starsSyncing = (async () => {
      const T = stars();
      if (!dataReady()) return false;
      try {
        if (ghToken() && T.ops.length) {
          for (let k = 0; k < 3; k++) {
            const r = await dgh("GET", STARS_PATH);
            const data = r ? JSON.parse(b64d(r.content)) : {};
            data.info = STARS_INFO; data.items = data.items || {};
            const ops = T.ops.slice();
            for (const o of ops) {
              const it = { ...(data.items[o.slug] || {}), s: o.s, at: o.at, t: o.t || (data.items[o.slug] || {}).t || "", tags: o.tags && o.tags.length ? o.tags : (data.items[o.slug] || {}).tags || [] };
              if (o.kind) it.kind = true; else delete it.kind;
              delete it["an" + "ton"];
              data.items[o.slug] = it;
            }
            data.updated = new Date().toISOString();
            const names = [...new Set(ops.map((o) => shortTitle(o.t || o.slug)))];
            try {
              await dgh("PUT", STARS_PATH, { message: `Koch-App: Sterne für ${names.slice(0, 3).join(", ")}${names.length > 3 ? " …" : ""}`.slice(0, 180), content: b64e(JSON.stringify(data, null, 1) + "\n"), ...(r ? { sha: r.sha } : {}) });
              T.ops = T.ops.slice(ops.length); T.pushed = Date.now(); save(); syncMark(true);
              mergeStars(data.items);
              return true;
            } catch (e) { if (e.code === 409 || e.code === 422) continue; throw e; }
          }
        } else if (!T.ops.length) {
          let items = null;
          if (ghToken()) { const r = await dgh("GET", STARS_PATH); items = r ? JSON.parse(b64d(r.content)).items : null; }
          else if (!ablage.privat) { const res = await fetch("../geschmack/sterne.json", { cache: "no-cache" }); if (res.ok) items = (await res.json()).items; }
          return mergeStars(items);
        }
      } catch (e) {
        syncMark(false, e);
        if (!quiet && e.code === "auth") { toast(`Sterne nicht gespeichert: ${e.message}`); tokenSheet(e.message); }
      }
      return false;
    })().finally(() => { starsSyncing = null; });
    return starsSyncing;
  }
  /* Rezeptseite und Kochmodus-Ende: große Sterne, Baby-Knopf */
  function rateBlock(r, title = "Eure Bewertung") {
    if (!r.slug) return "";
    const x = rating(r.slug);
    return `<div class="card rate-big"><div class="spread"><h3>${esc(title)}</h3>${x.s ? `<span class="rate-word">${RATE_WORD[x.s]}</span>` : ""}</div>${starsHtml(r, "big")}
      <p class="small muted" style="margin:6px 0 10px">${x.s ? "Jederzeit änderbar – einfach einen anderen Stern antippen." : "Nach dem Essen antippen. Der Buddy plant künftig danach."}</p>${babyBtn(r, true)}${x.kind && !embedded ? ` <a href="#" class="small" data-act="kidname">${kidName() ? "Name ändern" : "Namen auf den Stempel"}</a>` : ""}</div>`;
  }
  const stampHtml = (r) => (r.slug && rating(r.slug).kind ? `<div class="astamp-wrap${justStamped === r.slug ? " fresh" : ""}">${stampSvg()}</div>` : "");
  const miniRating = (slug) => { const x = rating(slug); return x.s || x.kind ? `<span class="mini-rate">${x.s ? `<span class="ms" aria-label="${x.s} Sterne">${"★".repeat(x.s)}<i>${"★".repeat(5 - x.s)}</i></span>` : ""}${x.kind ? `<span class="mb-baby" title="Für ${esc(kidFor())} geeignet">${BABY}</span>` : ""}</span>` : ""; };

  /* ---------- Name des Kindes: nur auf dem Gerät ----------
     Das Repo ist öffentlich, deshalb steht der Name nirgends im Code. Beim ersten Stempeln fragt die App einmal danach. */
  const kidName = () => { const n = (S.settings.kidName || "").trim(); return n === "-" ? "" : n; };
  const kidFor = () => kidName() || "das Kind";
  let pendingKid = null;
  function kidNameSheet(slug) {
    pendingKid = slug || null;
    openSheet(`<h2>Wer isst mit?</h2><p class="muted" style="margin:6px 0 12px">Der Name kommt auf den Stempel „Für … geeignet“. Er bleibt nur auf diesem Gerät und landet nicht im Rezept-Repo.</p>
      <input class="txt-in" data-kidname type="text" maxlength="14" autocomplete="off" placeholder="Vorname" value="${esc(kidName())}">
      <div class="act-btns" style="margin-top:14px"><button class="btn primary" data-act="kidname-save">Speichern</button><button class="btn ghost" data-act="kidname-skip">Ohne Namen</button></div>`);
    setTimeout(() => { const i = $("[data-kidname]"); if (i) i.focus(); }, 250);
  }
  function kidNameDone(name) {
    S.settings.kidName = name || "-"; save();
    const slug = pendingKid; pendingKid = null;
    if (slug && !rating(slug).kind) { setStar(slug, { kind: true }); justStamped = slug; setTimeout(() => { justStamped = null; }, 900); toast(`Gestempelt: für ${kidFor()} geeignet`); }
    if (reviewList) drawReview(); else { closeSheet(); rerenderSoft(); }
  }

  /* ---------- Notizen am Rezept ----------
     Freitext fürs nächste Mal („Beim nächsten Mal Paprika dazu“) – auf der Rezeptseite und mitten im Kochmodus.
     Notizen stehen danach oben im Rezept und im Kochmodus, auf allen Geräten. Mit GitHub-Schlüssel gespeichert in
     geschmack/notizen.json; die Aufgaben können sie beim nächsten Einplanen ins Rezept übernehmen.
     Das Repo ist öffentlich: der Name des Kindes wird beim Speichern durch „das Kind“ ersetzt. */
  const NOTES_PATH = "/contents/geschmack/notizen.json";
  const NOTES_INFO = "Notizen aus dem Kochbuddy zu Rezepten (Freitext für das nächste Mal). Schlüssel = Rezept-Slug aus rezepte/. notes: [{id, text, at}].";
  const PEN = '<svg class="ico" viewBox="0 0 24 24"><path d="M4.5 19.5h4l10.2-10.2a2.1 2.1 0 0 0-4-4L4.5 15.5z"/><path d="M13.3 6.7l4 4"/></svg>';
  const notesSt = () => { const N = (S.notes = S.notes || {}); N.r = N.r || {}; N.ops = N.ops || []; return N; };
  const notesOf = (slug) => notesSt().r[slug] || [];
  const noteDraft = {}, noteEdit = {};
  const noteDate = (at) => { const d = new Date(at); return isNaN(d) ? "" : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`; };
  const anonKid = (t) => { const n = kidName(); return n ? t.replace(new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`, "gi"), "das Kind") : t; };
  function putNote(slug, id, text) {
    const N = notesSt(), at = new Date().toISOString(), list = (N.r[slug] = N.r[slug] || []), m = starMeta[slug] || {};
    if (!text) { N.r[slug] = list.filter((n) => n.id !== id); N.ops.push({ op: "del", slug, id }); }
    else {
      const n = list.find((x) => x.id === id);
      if (n) { n.text = text; n.at = at; } else list.push({ id, text, at });
      N.ops.push({ op: "set", slug, id, text, at, t: m.t || "" });
    }
    if (!N.r[slug].length) delete N.r[slug];
    save(); scheduleNotesPush();
  }
  /* Kasten zum Lesen und Schreiben – auf der Rezeptseite, am Kochende und in der Schublade im Kochmodus */
  function notesBox(r, opts = {}) {
    if (!r.slug) return "";
    starMeta[r.slug] = starMeta[r.slug] || { t: r.title, tags: r.tags || [] };
    const list = notesOf(r.slug), ed = noteEdit[r.slug];
    const val = noteDraft[r.slug] != null ? noteDraft[r.slug] : ed ? (list.find((n) => n.id === ed) || {}).text || "" : "";
    let h = `<div class="notes-box${opts.card === false ? "" : " card"}">`;
    if (opts.title !== false) h += `<h3 class="nb-h">${PEN}${esc(opts.title || "Eure Notizen")}</h3>`;
    if (list.length) h += `<ul class="note-list">${list.map((n) => `<li class="${ed === n.id ? "editing" : ""}"><p>${esc(n.text)}</p><div class="nl-f"><small>${noteDate(n.at)}</small><button type="button" class="lnk" data-noteedit="${esc(r.slug)}|${n.id}">Ändern</button><button type="button" class="lnk del" data-notedel="${esc(r.slug)}|${n.id}">Löschen</button></div></li>`).join("")}</ul>`;
    else if (opts.empty !== false) h += `<p class="small muted" style="margin:4px 0 8px">Was soll beim nächsten Mal anders sein? Zum Beispiel „Paprika dazu“ oder „10 Min. länger schmoren“.</p>`;
    h += `<textarea class="note-in" rows="${opts.rows || 2}" data-notein="${esc(r.slug)}" placeholder="${ed ? "Notiz ändern" : "Neue Notiz, z. B. Beim nächsten Mal Paprika dazu"}">${esc(val)}</textarea>
      <div class="nb-btns"><button type="button" class="btn small primary" data-notesave="${esc(r.slug)}">${ed ? "Änderung speichern" : "Notiz speichern"}</button>${ed ? `<button type="button" class="btn small ghost" data-noteedit="${esc(r.slug)}|">Abbrechen</button>` : ""}</div>`;
    const line = notesSyncLine(); if (line) h += `<p class="small muted" style="margin:10px 0 0">${line}</p>`;
    return h + `</div>`;
  }
  /* oben im Rezept bzw. im ersten Kochschritt: was beim letzten Mal notiert wurde */
  const notesTip = (slug) => { const list = notesOf(slug); return list.length ? `<div class="tip note-tip"><span class="tip-ico">${PEN}</span><div><h3>Vom letzten Mal</h3>${list.map((n) => `<p>${esc(n.text)}</p>`).join("")}</div></div>` : ""; };
  function cookNoteSheet(r) { openSheet(`<h2>Notiz zum Rezept</h2><p class="muted small" style="margin:4px 0 10px">${esc(r.title)} – steht danach im Rezept, auf allen Geräten.</p>${notesBox(r, { card: false, title: false, empty: false, rows: 4 })}`, { note: r.slug }); setTimeout(() => { const t = $("#sheet [data-notein]"); if (t) t.focus(); }, 280); }
  function saveNote(btn) {
    const slug = btn.dataset.notesave, box = btn.closest(".notes-box"), ta = box && box.querySelector("[data-notein]");
    const text = ((ta && ta.value) || "").trim().slice(0, 600);
    if (!text) { toast("Erst etwas eintippen"); if (ta) ta.focus(); return; }
    const id = noteEdit[slug] || Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    putNote(slug, id, text);
    delete noteDraft[slug]; delete noteEdit[slug];
    if (navigator.vibrate && S.settings.vibrate) navigator.vibrate(10);
    toast("Notiz gespeichert – steht jetzt im Rezept");
    if ($("#sheet").dataset.note) closeSheet();
    rerenderSoft();
  }
  let notesTimer = null, notesSyncing = null;
  const scheduleNotesPush = (ms = 3000) => { clearTimeout(notesTimer); notesTimer = setTimeout(() => syncNotes(true).then((ch) => { if (ch) softIfIdle(); }), ms); };
  const notesSyncLine = () => (embedded ? "" : !ghToken() ? `Notizen bleiben erst einmal auf diesem Gerät. Damit sie überall und beim Buddy ankommen: <a href="#" data-act="gh-setup">einmalig Speichern einrichten</a>` : notesSt().ops.length ? "Wird gleich gespeichert …" : "");
  function setNotesFrom(items) {
    const N = notesSt(), next = {};
    for (const [slug, x] of Object.entries(items || {})) if (x && x.notes && x.notes.length) next[slug] = x.notes.map((n) => ({ id: n.id, text: n.text, at: n.at }));
    const ch = JSON.stringify(next) !== JSON.stringify(N.r);
    if (ch) { N.r = next; save(); }
    return ch;
  }
  function syncNotes(quiet) {
    if (embedded) return Promise.resolve(false);
    if (notesSyncing) return notesSyncing;
    notesSyncing = (async () => {
      const N = notesSt();
      if (!dataReady()) return false;
      try {
        if (ghToken() && N.ops.length) {
          for (let k = 0; k < 3; k++) {
            const r = await dgh("GET", NOTES_PATH);
            const data = r ? JSON.parse(b64d(r.content)) : {};
            data.info = NOTES_INFO; data.items = data.items || {};
            const ops = N.ops.slice();
            for (const o of ops) {
              const it = (data.items[o.slug] = data.items[o.slug] || { t: "", notes: [] });
              it.notes = (it.notes || []).filter((n) => n.id !== o.id);
              if (o.op === "set") { it.notes.push({ id: o.id, text: anonKid(o.text), at: o.at }); if (o.t) it.t = o.t; }
              it.notes.sort((a, b) => (a.at < b.at ? -1 : 1));
              if (!it.notes.length) delete data.items[o.slug];
            }
            data.updated = new Date().toISOString();
            const names = [...new Set(ops.map((o) => shortTitle((data.items[o.slug] || {}).t || o.t || o.slug)))];
            try {
              await dgh("PUT", NOTES_PATH, { message: `Koch-App: Notiz zu ${names.slice(0, 3).join(", ")}`.slice(0, 180), content: b64e(JSON.stringify(data, null, 1) + "\n"), ...(r ? { sha: r.sha } : {}) });
              N.ops = N.ops.slice(ops.length); save(); syncMark(true);
              if (!N.ops.length) setNotesFrom(data.items);
              return true;
            } catch (e) { if (e.code === 409 || e.code === 422) continue; throw e; }
          }
        } else if (!N.ops.length) {
          let items = null;
          if (ghToken()) { const r = await dgh("GET", NOTES_PATH); items = r ? JSON.parse(b64d(r.content)).items : null; }
          else if (!ablage.privat) { const res = await fetch("../geschmack/notizen.json", { cache: "no-cache" }); if (res.ok) items = (await res.json()).items; else if (res.status === 404) items = null; }
          return items ? setNotesFrom(items) : false;
        }
      } catch (e) {
        syncMark(false, e);
        if (!quiet && e.code === "auth") { toast(`Notiz nicht gespeichert: ${e.message}`); tokenSheet(e.message); }
      }
      return false;
    })().finally(() => { notesSyncing = null; });
    return notesSyncing;
  }
  /* ---------- Nachricht an den Buddy ----------
     Wünsche und Fragen direkt aus der App statt per Mail-Antwort (Outlook hat Antworten als Spam blockiert).
     Gespeichert im privaten Datenrepo unter nachrichten/buddy.json. Die stündliche Buddy-Aufgabe (7–22 Uhr)
     beantwortet neue Nachrichten per Mail und schreibt eine kurze Antwort zurück, die hier erscheint. */
  const MSG_PATH = "/contents/nachrichten/buddy.json";
  const MSG_INFO = "Nachrichten aus dem Kochbuddy an den Koch- und Einkaufsbuddy. items[id] = {text, at, status: neu|erledigt, antwort?: {text, at}}. Neue Einträge beantwortet die Antwort-Aufgabe.";
  const CHAT = '<svg class="ico" viewBox="0 0 24 24"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M8 10h8M8 13h5"/></svg>';
  const msgSt = () => { const M = (S.msgs = S.msgs || {}); M.items = M.items || {}; M.ops = M.ops || []; M.seen = M.seen || {}; return M; };
  let msgDraft = "";
  const msgList = () => Object.entries(msgSt().items).map(([id, m]) => ({ id, ...m })).sort((a, b) => (a.at < b.at ? 1 : -1));
  const msgUnread = () => msgList().filter((m) => m.antwort && !msgSt().seen[m.id]);
  function msgItem(m) {
    const pending = msgSt().ops.some((o) => o.id === m.id), isNew = m.antwort && !msgSt().seen[m.id];
    const st = pending ? (ghToken() ? "wird gesendet …" : "noch auf diesem Gerät") : m.antwort ? "beantwortet" : "beim Buddy, Antwort folgt";
    return `<li class="${isNew ? "new" : ""}"><p class="mq">${esc(m.text)}</p><div class="msg-meta"><small>${noteDate(m.at)} · ${st}</small>${isNew ? `<span class="chip pump">Neue Antwort</span>` : ""}</div>${m.antwort ? `<div class="ma"><b>Dein Buddy</b><p>${esc(m.antwort.text)}</p></div>` : ""}</li>`;
  }
  function msgCard() {
    const list = msgList(), shown = list.slice(0, 2);
    let h = `<section class="card notes-box msg-card" id="msg-card"><h3 class="nb-h">${CHAT}Nachricht an den Buddy</h3>`;
    h += `<p class="small muted" style="margin:4px 0 8px">Wünsche, Fragen oder Änderungen am Plan – der Buddy antwortet meist innerhalb einer Stunde (7–22 Uhr), hier und per Mail.</p>`;
    if (shown.length) h += `<ul class="msg-list">${shown.map(msgItem).join("")}</ul>`;
    h += `<textarea class="note-in" rows="2" data-msgin placeholder="z. B. Mittwochabend sind wir auswärts essen">${esc(msgDraft)}</textarea>`;
    h += `<div class="nb-btns"><button type="button" class="btn small primary" data-act="msg-send">Senden</button>${list.length > 2 ? `<button type="button" class="btn small ghost" data-act="msg-all">Alle ${list.length} Nachrichten</button>` : ""}</div>`;
    const line = embedded ? "In der Vorschau wird nichts gesendet." : !ghToken() ? `Damit Nachrichten beim Buddy ankommen: <a href="#" data-act="gh-setup">einmalig Speichern einrichten</a>` : "";
    if (line) h += `<p class="small muted" style="margin:10px 0 0">${line}</p>`;
    return h + `</section>`;
  }
  const msgBanner = () => { const n = msgUnread().length; return n ? `<div class="banner msg-ban"><p>${CHAT}Der Buddy hat auf ${n === 1 ? "deine Nachricht" : `${n} Nachrichten`} geantwortet.</p><button class="btn small" data-act="msg-show">Lesen</button></div>` : ""; };
  function msgMarkSeen() { const M = msgSt(); let ch = false; for (const m of msgList()) if (m.antwort && !M.seen[m.id]) { M.seen[m.id] = 1; ch = true; } if (ch) save(); return ch; }
  function msgAllSheet() { openSheet(`<h2>Nachrichten an den Buddy</h2><ul class="msg-list sheet-msgs">${msgList().map(msgItem).join("")}</ul>`); msgMarkSeen(); }
  function sendMsg() {
    const ta = $("[data-msgin]"), text = ((ta && ta.value) || msgDraft || "").trim().slice(0, 1500);
    if (!text) { toast("Erst etwas eintippen"); if (ta) ta.focus(); return; }
    if (embedded) { toast("In der Vorschau wird nichts gesendet"); return; }
    const M = msgSt(), id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at = new Date().toISOString();
    M.ops.push({ op: "add", id, text, at }); M.items[id] = { text, at, status: "neu" };
    msgDraft = ""; msgMarkSeen(); save();
    if (navigator.vibrate && S.settings.vibrate) navigator.vibrate(10);
    toast(ghToken() ? "Gesendet – der Buddy antwortet meist innerhalb einer Stunde" : "Gespeichert – zum Senden einmalig Speichern einrichten");
    rerenderSoft(); scheduleMsgPush(300);
  }
  let msgTimer = null, msgSyncing = null;
  const scheduleMsgPush = (ms = 800) => { clearTimeout(msgTimer); msgTimer = setTimeout(() => syncMsgs(true).then((ch) => { if (ch) softIfIdle(); }), ms); };
  function setMsgsFrom(items) {
    const M = msgSt(), next = {};
    for (const [id, m] of Object.entries(items || {})) if (m && m.text) next[id] = { text: m.text, at: m.at, status: m.status || "neu", ...(m.antwort && m.antwort.text ? { antwort: { text: m.antwort.text, at: m.antwort.at } } : {}) };
    for (const o of M.ops) if (!next[o.id]) next[o.id] = { text: o.text, at: o.at, status: "neu" };
    if (JSON.stringify(next) === JSON.stringify(M.items)) return false;
    M.items = next; save(); return true;
  }
  function syncMsgs(quiet) {
    if (embedded) return Promise.resolve(false);
    if (msgSyncing) return msgSyncing;
    msgSyncing = (async () => {
      const M = msgSt();
      if (!dataReady() || !ghToken()) return false;
      try {
        for (let k = 0; k < 3; k++) {
          const r = await dgh("GET", MSG_PATH);
          const data = r ? JSON.parse(b64d(r.content)) : {};
          data.info = MSG_INFO; data.items = data.items || {};
          const ops = M.ops.slice();
          if (!ops.length) return setMsgsFrom(data.items);
          for (const o of ops) if (!data.items[o.id]) data.items[o.id] = { text: o.text, at: o.at, status: "neu" };
          data.updated = new Date().toISOString();
          try {
            await dgh("PUT", MSG_PATH, { message: "Koch-App: Nachricht an den Buddy", content: b64e(JSON.stringify(data, null, 1) + "\n"), ...(r ? { sha: r.sha } : {}) });
            M.ops = M.ops.slice(ops.length); save(); syncMark(true);
            setMsgsFrom(data.items);
            return true;
          } catch (e) { if (e.code === 409 || e.code === 422) continue; throw e; }
        }
      } catch (e) {
        syncMark(false, e);
        if (!quiet && e.code === "auth") { toast(`Nachricht nicht gesendet: ${e.message}`); tokenSheet(e.message); }
      }
      return false;
    })().finally(() => { msgSyncing = null; });
    return msgSyncing;
  }

  /* neu zeichnen nur, wenn gerade niemand tippt oder eine Schublade offen hat */
  // Mehrere Abgleiche kurz hintereinander → nur ein Neuaufbau, und nie während getippt, gewischt oder gekocht wird
  let softT = null, lastTouch = 0;
  ["pointerdown", "keydown", "scroll"].forEach((ev) => window.addEventListener(ev, () => { lastTouch = Date.now(); }, { passive: true }));
  function softIfIdle() {
    clearTimeout(softT);
    softT = setTimeout(() => {
      const a = document.activeElement;
      if (inCooking || !$("#sheet").hidden || (a && /TEXTAREA|INPUT/.test(a.tagName)) || swDrag || drag) return;
      if (Date.now() - lastTouch < 1500) { softIfIdle(); return; }
      rerenderSoft();
    }, 900);
  }

  /* ---------- Beispielfotos (Unsplash, freie Lizenz) ----------
     app/daten/fotos.json: items[slug] = {id, by, page}. Lädt das Bild nicht, bleibt die Illustration bzw. nichts. */
  let fotos = null;
  async function loadFotos() { if (fotos) return fotos; try { fotos = (await getJSON("daten/fotos.json")).items || {}; } catch (e) { fotos = {}; } return fotos; }
  const fotoOf = (slug) => (fotos && slug && fotos[slug]) || null;
  // Feste Bildbreiten (immer dieselben Adressen → einmal geladen, dann aus dem Speicher): Vorschau 160 px, groß 800 px
  const fotoUrl = (f, w) => `https://images.unsplash.com/${encodeURIComponent(f.id)}?w=${w}&q=${w > 300 ? 62 : 55}&auto=format&fit=crop`;
  const fotoImg = (f, w, cls = "") => { const big = w > 300, ww = big ? 800 : 160; return `<img class="ph ${cls}" src="${fotoUrl(f, ww)}" width="${ww}" height="${big ? 500 : ww}" alt="" loading="${big ? "eager" : "lazy"}" fetchpriority="${big ? "high" : "low"}" decoding="async" onerror="this.parentNode.classList.add('noimg')">`; };
  function fotoHero(r) {
    const f = fotoOf(r.slug); if (!f) return "";
    return `<figure class="r-photo">${fotoImg(f, 900)}<figcaption>Beispielfoto · <a href="${esc(f.page)}?utm_source=kochbuddy&amp;utm_medium=referral" target="_blank" rel="noopener">${esc(f.by)}</a> / <a href="https://unsplash.com/?utm_source=kochbuddy&amp;utm_medium=referral" target="_blank" rel="noopener">Unsplash</a></figcaption></figure>`;
  }
  const fotoThumb = (slug, cls = "") => { const f = fotoOf(slug); return f ? `<span class="thumb ${cls}">${fotoImg(f, 160)}</span>` : ""; };

  /* ---------- Verlauf: wann gab es welches Gericht? ----------
     Quelle: Essens-Log der App (was auf dem Plan stand und gegessen wurde, ohne „Gab's nicht“) – mit Schlüssel im
     privaten Repo geschmack/verlauf.json für alle Geräte zusammengeführt. Dazu die Plan-Wochen aus rezepte.json. */
  const VERLAUF_PATH = "/contents/geschmack/verlauf.json";
  let rezIndex = null;
  async function loadRezIndex() { if (rezIndex) return rezIndex; try { rezIndex = await getJSON("../rezepte/rezepte.json"); } catch (e) { rezIndex = (embedded && embedded.files["../rezepte/rezepte.json"]) || []; } return rezIndex; }
  function eatenEntries() {
    const T = stars(), now = Date.now(), all = { ...(S.verlauf || {}) };
    for (const [k, x] of Object.entries(T.log)) if (!all[k]) all[k] = x;
    const out = [];
    for (const [k, x] of Object.entries(all)) {
      const [iso, slot] = k.split("|");
      if (!x || !x.slug || x.skip || T.skip[x.slug + "|" + x.wk] || eatenAt(iso, slot) > now) continue;
      out.push({ k, iso, slot, slug: x.slug, t: x.t, wk: x.wk });
    }
    return out;
  }
  function verlaufOf(slug) {
    const es = eatenEntries().filter((e) => e.slug === slug).sort((a, b) => (a.iso < b.iso ? 1 : -1));
    const times = new Set(es.map((e) => e.wk || e.iso.slice(0, 7))).size;
    const meta = (rezIndex || []).find((r) => r.slug === slug) || {};
    const kw = (x) => String(x || "").replace(/\/(\d{4})$/, (m, y) => (y === today().slice(0, 4) ? "" : " " + y));
    return { list: es, times, last: es[0] || null, first: kw(meta.first), lastKw: meta.extra ? "" : kw(meta.last) };
  }
  function agoText(iso) {
    const d = Math.round((new Date(today() + "T12:00") - new Date(iso + "T12:00")) / 86400000);
    if (d <= 0) return "heute"; if (d === 1) return "gestern"; if (d < 14) return `vor ${d} Tagen`;
    if (d < 60) return `vor ${Math.round(d / 7)} Wochen`; return `vor ${Math.round(d / 30)} Monaten`;
  }
  /* kurzer Hinweis für Listen: „zuletzt vor 3 Wochen“ */
  function lastChip(slug) {
    const v = verlaufOf(slug);
    if (v.last) return `<span class="chip plain hist">zuletzt ${esc(agoText(v.last.iso))}</span>`;
    return v.lastKw ? `<span class="chip plain hist">zuletzt ${esc(v.lastKw)}</span>` : `<span class="chip plain hist">noch nicht gekocht</span>`;
  }
  function verlaufCard(r) {
    if (!r.slug) return "";
    const v = verlaufOf(r.slug), rt = rating(r.slug);
    let h = `<div class="card verlauf"><h3>Verlauf</h3>`;
    if (v.last) {
      h += `<div class="vl-top"><div><b>${esc(agoText(v.last.iso))}</b><span>zuletzt gegessen</span></div><div><b>${v.times}×</b><span>${v.times === 1 ? "auf dem Plan" : "auf dem Plan"}</span></div>${rt.s ? `<div><b class="vl-st">${"★".repeat(rt.s)}</b><span>${RATE_WORD[rt.s]}</span></div>` : ""}</div>`;
      h += `<ol class="vl-list">${v.list.slice(0, 8).map((e) => `<li><i></i><span>${esc(DAYS[new Date(e.iso + "T12:00").getDay()])}, ${Number(e.iso.slice(8, 10))}.${Number(e.iso.slice(5, 7))}.${e.iso.slice(0, 4) !== today().slice(0, 4) ? e.iso.slice(0, 4) : ""} · ${esc(e.slot)}</span></li>`).join("")}</ol>`;
      if (v.first) h += `<p class="small muted" style="margin:6px 0 0">Zum ersten Mal im Plan: ${esc(v.first)}</p>`;
    } else if (v.lastKw) {
      h += `<p style="margin:6px 0 0">Zuletzt im Plan: <b>${esc(v.lastKw)}</b>${v.first && v.first !== v.lastKw ? ` · zum ersten Mal ${esc(v.first)}` : ""}</p><p class="small muted" style="margin:4px 0 0">Ab jetzt merkt sich die App jedes Mal, wann es das Gericht gab.</p>`;
    } else h += `<p class="muted" style="margin:6px 0 0">Gab es bei euch noch nie – wird Zeit?</p>`;
    return h + `</div>`;
  }
  /* mit dem privaten Repo abgleichen: nur ergänzen, nie löschen */
  let verlaufSyncing = null;
  function syncVerlauf() {
    if (embedded || !ablage.privat || !dataReady() || !ghToken()) return Promise.resolve(false);
    if (verlaufSyncing) return verlaufSyncing;
    verlaufSyncing = (async () => {
      const T = stars(), mine = {};
      for (const [k, x] of Object.entries(T.log)) { const [iso, slot] = k.split("|"); if (x.slug && eatenAt(iso, slot) <= Date.now()) mine[k] = { slug: x.slug, t: x.t, wk: x.wk, ...(T.skip[x.slug + "|" + x.wk] ? { skip: true } : {}) }; }
      for (let n = 0; n < 3; n++) {
        const r = await dgh("GET", VERLAUF_PATH);
        const data = r ? JSON.parse(b64d(r.content)) : { info: "Wann welches Gericht gegessen wurde (aus der Koch-App). Schlüssel JJJJ-MM-TT|Mahlzeit. skip = gab es doch nicht.", items: {} };
        data.items = data.items || {};
        let add = 0;
        for (const [k, x] of Object.entries(mine)) { const cur = data.items[k]; if (!cur || cur.slug !== x.slug || !!cur.skip !== !!x.skip) { data.items[k] = x; add++; } }
        const before = JSON.stringify(S.verlauf || {});
        S.verlauf = data.items; save();
        if (!add) return before !== JSON.stringify(S.verlauf);
        data.updated = new Date().toISOString();
        try {
          await dgh("PUT", VERLAUF_PATH, { message: `Koch-App: Verlauf (${add} ${add === 1 ? "Mahlzeit" : "Mahlzeiten"})`, content: b64e(JSON.stringify(data, null, 1) + "\n"), ...(r ? { sha: r.sha } : {}) });
          syncMark(true); return true;
        } catch (e) { if (e.code === 409 || e.code === 422) continue; return false; }
      }
      return false;
    })().catch(() => false).finally(() => { verlaufSyncing = null; });
    return verlaufSyncing;
  }

  /* ---------- Was ist neu? Kurze Tour nach Updates ----------
     app/daten/neu.json: neuester Eintrag erscheint einmal pro Gerät (nach Einführung und Wochen-Check).
     „Zeigen“ springt an die Stelle in der App, unten bleibt eine kleine Leiste „Weiter“ stehen. */
  let news = null, newsStep = 0, newsItem = null;
  async function loadNews() { if (news) return news; try { news = (await getJSON("daten/neu.json")).items || []; } catch (e) { news = []; } return news; }
  const newsSeen = () => (S.settings.newsSeen = S.settings.newsSeen || []);
  const newsKey = (it) => (it ? `${it.id}#${(it.schritte || []).length}` : ""); // wächst ein Eintrag am selben Tag, zeigt die App ihn noch einmal
  async function maybeNews() {
    if (inCooking || !$("#sheet").hidden || !$("#alarm").hidden || !S.settings.toured || embedded) return;
    const list = await loadNews(), top = list[0];
    if (!top || newsSeen().includes(newsKey(top)) || $("#newsbar")) return;
    showNews(0, top);
  }
  const newsText = (t) => esc(String(t || "").replace(/\{kind\}/g, kidName() || "das Kind"));
  function showNews(step = 0, item) {
    newsItem = item || newsItem; if (!newsItem) return;
    const st = newsItem.schritte || []; newsStep = Math.max(0, Math.min(step, st.length - 1));
    const s = st[newsStep], last = newsStep === st.length - 1;
    $("#newsbar") && $("#newsbar").remove();
    openSheet(`<div class="tour news"><span class="eyebrow">${esc(newsItem.titel || "Neu")} · seit ${esc(newsItem.datum || "")} · ${newsStep + 1} von ${st.length}</span><div class="tour-ico">${ART[s.ico] || ART.pot}</div><h2>${newsText(s.t)}</h2><p>${newsText(s.x)}</p>
      <div class="tour-dots">${st.map((_, i) => `<i class="${i === newsStep ? "on" : ""}"></i>`).join("")}</div>
      ${s.ziel ? `<button class="btn big news-show" data-act="news-show">Zeig's mir</button>` : ""}
      <div class="tour-btns">${newsStep > 0 ? `<button class="btn" data-act="news-back">Zurück</button>` : `<button class="btn ghost" data-act="news-end">Später</button>`}
      <button class="btn primary" data-act="${last ? "news-done" : "news-next"}">${last ? "Fertig" : "Weiter"}</button></div></div>`, { news: "1" });
  }
  function newsTarget(s) {
    if (s.ziel !== "@rezept") return s.ziel;
    const w = memo[weekFile(weekId)]; if (!w) return "#/rezepte";
    const d = w.days.find((x) => x.iso === today()) || w.days[0];
    const m = (d.meals.find((x) => x.kind === "haupt") || d.meals[0] || {});
    return m.recipe ? `#/r/w:${weekId}:${m.recipe}` : "#/rezepte";
  }
  async function newsShow() {
    const s = (newsItem.schritte || [])[newsStep]; if (!s) return;
    closeSheet();
    const target = newsTarget(s);
    if (curHash() !== target) { navTo(target, "push"); await new Promise((r) => setTimeout(r, 500)); }
    const el = s.zeige && $(s.zeige);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("news-flash"); setTimeout(() => el.classList.remove("news-flash"), 2600); }
    const st = newsItem.schritte || [], last = newsStep === st.length - 1;
    const bar = document.createElement("div");
    bar.id = "newsbar"; bar.className = "newsbar";
    bar.innerHTML = `<span><b>Neu ${newsStep + 1}/${st.length}:</b> ${newsText(s.t)}</span><button class="btn small primary" data-act="${last ? "news-done" : "news-next"}">${last ? "Fertig" : "Weiter"}</button><button class="icon-btn" data-act="news-end" aria-label="Tour beenden">${CLOSE}</button>`;
    document.body.appendChild(bar);
  }
  function newsEnd(done) {
    $("#newsbar") && $("#newsbar").remove();
    if ($("#sheet").dataset.news) closeSheet();
    if (done && newsItem && !newsSeen().includes(newsKey(newsItem))) { newsSeen().push(newsKey(newsItem)); save(); toast("Viel Spaß mit den Neuerungen!"); }
    else if (!done && newsItem && !newsSeen().includes(newsKey(newsItem))) { newsSeen().push(newsKey(newsItem)); save(); toast("Die Tour findest du unten in der Woche unter „Was ist neu?“"); }
  }

  /* ---------- Alle Rezepte ---------- */
  let filter = { q: "", tag: "Alle" };
  async function renderAll(view) {
    let list;
    try { list = await getJSON("../rezepte/rezepte.json"); } catch (e) { list = embedded ? embedded.files["../rezepte/rezepte.json"] || [] : []; }
    const tags = ["Alle", "Fleisch", "Fisch", "Vegetarisch", "Suppe", "Pasta", "Kartoffel", "One-Pot", "Ofen", "Varoma", "Vorkochen"];
    let h = `<header class="top"><div><div class="eyebrow">${list.length} Rezepte</div><h1>Alle Rezepte</h1></div></header>${recSwitch("rezepte")}`;
    h += `<label class="searchbox"><svg class="ico" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg><input class="search" type="search" aria-label="Rezepte durchsuchen" placeholder="Suchen, z. B. Suppe, Lachs, Gnocchi" value="${esc(filter.q)}" data-search></label>`;
    h += `<div class="seg" style="margin-top:10px">${tags.map((t) => `<button data-tag="${t}" aria-pressed="${filter.tag === t}">${t}</button>`).join("")}</div>`;
    h += `<ul class="r-list" id="rlist"></ul>`;
    view.innerHTML = h;
    view._list = list;
    drawList(view);
  }
  function drawList(view) {
    const q = filter.q.toLowerCase().trim();
    const items = (view._list || []).filter((m) => (filter.tag === "Alle" || (m.tags || []).includes(filter.tag)) &&
      (!q || m.title.toLowerCase().includes(q) || (m.tags || []).join(" ").toLowerCase().includes(q)));
    $("#rlist", view).innerHTML = items.map((m) => `<li class="${tone(m.tags) ? "t-" + tone(m.tags) : ""}"><a href="#/r/a:${esc(m.slug)}"${fotoOf(m.slug) ? ' class="has-ph"' : ""}>${fotoThumb(m.slug)}<span class="xt"><b>${esc(m.title)}</b><span class="chips">${miniRating(m.slug)}${m.current ? '<span class="chip pump">diese Woche</span>' : ""}${tagChips(m.tags, 3)}<span class="chip plain">${m.total} Min.</span>${lastChip(m.slug)}</span></span></a></li>`).join("") ||
      `<li class="empty">Nichts gefunden.</li>`;
  }

  /* ---------- Einkaufsliste mit Strichcode-Scanner ----------
     Ein Bluetooth-Handscanner meldet sich am Tablet wie eine Tastatur und „tippt“ den Strichcode samt Enter. Die App hört
     in jedem Reiter mit – ohne Eingabefeld. Alternativ Kamera (BarcodeDetector) oder Code bzw. Artikel eintippen.
     Produktnamen kommen aus Open Food Facts (danach Open Beauty/Products/Pet Food Facts). Beim ersten Scan eines Codes
     schlägt die App die passende Bring-Kachel vor (Namen aus tools/bring_namen.json); einmal bestätigt, gilt das auf allen
     Geräten. Gespeichert wird nur im privaten Repo: einkauf/liste.json {items, katalog}.
     Für Bring legt die App eine versteckte Importseite liste/<zufall>.html im Rezept-Repo an (nur Artikelnamen und Marken,
     keine Namen, keine Preise; nicht unter b/, das räumt bring.py auf) und löscht sie nach „Erledigt“ wieder. */
  const EK_PATH = "/contents/einkauf/liste.json";
  const EK_INFO = "Einkaufsliste aus dem Kochbuddy (Strichcode-Scanner, Kamera oder von Hand). items: id → {n: Bring-Kachel wie in der App, key: Name für den Bring-Import, d: Details wie Marke und Größe, c: Anzahl, ean: Strichcode, at}. katalog: Strichcode → {key, n, d, ok: vom Menschen bestätigt, at} – gilt auf allen Geräten. Die Datei gehört der App: nicht von Hand ändern.";
  const SITE_URL = "https://padderico.github.io/Rezeptesammlung/";
  const BARCODE = '<svg class="ico" viewBox="0 0 24 24"><path d="M3.5 8V5.5a2 2 0 0 1 2-2H8M16 3.5h2.5a2 2 0 0 1 2 2V8M20.5 16v2.5a2 2 0 0 1-2 2H16M8 20.5H5.5a2 2 0 0 1-2-2V16"/><path d="M7.5 8v8M10.5 8v8M13 8v8M16.5 8v8"/></svg>';
  const CAMERA = '<svg class="ico" viewBox="0 0 24 24"><path d="M4 8.5h3l1.8-2.5h6.4L17 8.5h3v10.5H4z"/><circle cx="12" cy="13.5" r="3.4"/></svg>';
  const FAM = new RegExp("\\b(" + ["An" + "ton", "An" + "ja", "Pad" + "de"].join("|") + ")\\b", "gi");
  const ekClean = (s) => String(s || "").replace(FAM, "").replace(/[()[\]{}<>"]/g, " ").replace(/\s+/g, " ").trim();
  const buzz = (p) => { if (navigator.vibrate && S.settings.vibrate) navigator.vibrate(p); };
  const ek = () => { const E = (S.einkauf = S.einkauf || {}); E.items = E.items || {}; E.kat = E.kat || {}; E.ops = E.ops || []; return E; };
  /* Änderungen als Schritte (wie bei den Sternen): mehrere Geräte zählen sauber zusammen */
  function ekApply(items, kat, ops) {
    const I = {}, K = { ...(kat || {}) };
    for (const [k, v] of Object.entries(items || {})) I[k] = { ...v };
    for (const o of ops) {
      const cur = I[o.id];
      if (o.op === "inc") { const it = cur || { ...(o.it || {}), c: 0 }; it.c = (it.c || 0) + o.by; it.at = o.at; if (it.c > 0) I[o.id] = it; else delete I[o.id]; }
      else if (o.op === "set" && cur) Object.assign(cur, o.it);
      else if (o.op === "del") delete I[o.id];
      else if (o.op === "take" && cur) { cur.c -= o.c; if (cur.c <= 0) delete I[o.id]; }
      else if (o.op === "kat") K[o.ean] = { ...o.k, at: o.at };
    }
    return { items: I, kat: K };
  }
  const ekView = () => { const E = ek(); return ekApply(E.items, E.kat, E.ops); };
  function ekOp(o) { o.at = o.at || new Date().toISOString(); ek().ops.push(o); save(); scheduleEkPush(); }
  let ekTimer = null, ekSyncing = null;
  function scheduleEkPush(ms = 4000) { if (embedded) return; clearTimeout(ekTimer); ekTimer = setTimeout(() => syncEinkauf(true).then((ch) => { if (ch) ekRefresh(); }), ms); }
  function syncEinkauf(quiet) {
    if (embedded) return Promise.resolve(false);
    if (ekSyncing) return ekSyncing;
    ekSyncing = (async () => {
      const E = ek();
      if (!ablage.privat || !dataReady() || !ghToken()) return false; // die Liste kommt nie ins öffentliche Repo
      try {
        for (let k = 0; k < 3; k++) {
          const r = await gh("GET", EK_PATH, null, DATA_REPO);
          const data = r ? JSON.parse(b64d(r.content)) : {};
          const ops = E.ops.slice();
          if (!ops.length) {
            const before = JSON.stringify([E.items, E.kat]);
            E.items = data.items || {}; E.kat = data.katalog || {}; E.pulled = Date.now(); save();
            return before !== JSON.stringify([E.items, E.kat]);
          }
          const res = ekApply(data.items, data.katalog, ops);
          const names = [...new Set(ops.filter((o) => o.it && o.it.n).map((o) => o.it.n))];
          const out = { info: EK_INFO, items: res.items, katalog: res.kat, updated: new Date().toISOString() };
          try {
            await gh("PUT", EK_PATH, { message: `Koch-App: Einkaufsliste${names.length ? " – " + names.slice(0, 4).join(", ") + (names.length > 4 ? " …" : "") : ""}`.slice(0, 180), content: b64e(JSON.stringify(out, null, 1) + "\n"), ...(r ? { sha: r.sha } : {}) }, DATA_REPO);
            E.ops = E.ops.slice(ops.length); E.items = res.items; E.kat = res.kat; E.pulled = Date.now(); save(); syncMark(true);
            return true;
          } catch (e) { if (e.code === 409 || e.code === 422) continue; throw e; }
        }
      } catch (e) {
        syncMark(false, e);
        if (!quiet && e.code === "auth") { toast(`Einkaufsliste nicht gespeichert: ${e.message}`); tokenSheet(e.message); }
      }
      return false;
    })().finally(() => { ekSyncing = null; });
    return ekSyncing;
  }

  /* Bring-Namen: dieselbe Liste wie für die Rezepte (ein Produkt = eine Kachel) */
  let bnP = null;
  function bringNames() {
    if (!bnP) bnP = getJSON("../tools/bring_namen.json").then((cfg) => {
      const arts = (cfg.artikel || []).map((a) => ({ key: a.key, n: a.anzeige, vs: [...new Set([a.key, a.anzeige, ...(a.varianten || [])].map((x) => x.toLowerCase()))] }));
      const any = new Map();
      for (const a of arts) for (const v of a.vs) if (!any.has(v)) any.set(v, a);
      return { arts, any, byKey: new Map(arts.map((a) => [a.key, a])) };
    }).catch(() => { bnP = null; return { arts: [], any: new Map(), byKey: new Map() }; });
    return bnP;
  }
  /* Kategorien von Open Food Facts → Bring-Kachel (nur eindeutige; der Rest geht über den Produktnamen) */
  const OFF_CAT = {
    "en:milks": "Milch", "en:uht-milks": "Milch", "en:whole-milks": "Milch", "en:semi-skimmed-milks": "Milch", "en:skimmed-milks": "Milch",
    "en:butters": "Butter", "en:eggs": "Eier", "en:chicken-eggs": "Eier", "en:yogurts": "Joghurt", "en:plain-yogurts": "Joghurt",
    "en:cream-cheeses": "Frischkäse", "en:creams": "Rahm", "en:whipping-creams": "Rahm", "en:cooking-creams": "Rahm", "en:sour-creams": "Sauerrahm",
    "en:creme-fraiche": "Creme fraiche", "en:quark": "Quark", "en:mozzarella": "Mozzarella", "en:feta": "Feta", "en:parmigiano-reggiano": "Parmesan",
    "en:grated-cheeses": "Reibkäse", "en:mascarpone": "Mascarpone", "en:ricotta": "Ricotta", "en:cheeses": "Käse",
    "en:peeled-tomatoes": "Pelati", "en:canned-tomatoes": "Pelati", "en:chopped-tomatoes": "Pelati", "en:tomato-pastes": "Tomatenmark",
    "en:pastas": "Nudeln", "en:dry-pastas": "Nudeln", "en:spaghetti": "Spaghetti", "en:gnocchi": "Gnocchi", "en:rices": "Reis", "en:basmati-rices": "Basmatireis",
    "en:wheat-flours": "Mehl", "en:flours": "Mehl", "en:sugars": "Zucker", "en:white-sugars": "Zucker", "en:salts": "Salz", "en:table-salts": "Salz",
    "en:extra-virgin-olive-oils": "Olivenöl", "en:olive-oils": "Olivenöl", "en:rapeseed-oils": "Öl", "en:sunflower-oils": "Öl", "en:vegetable-oils": "Öl",
    "en:vinegars": "Essig", "en:honeys": "Honig", "en:mustards": "Senf", "en:soy-sauces": "Sojasauce", "en:breads": "Brot", "en:baguettes": "Baguette",
    "en:tortillas": "Wraps", "en:coconut-milks": "Kokosmilch", "en:hams": "Schinken", "en:cooked-hams": "Schinken", "en:bacons": "Speck",
    "en:salmons": "Lachs", "en:fish-sticks": "Fischstäbli", "en:lentils": "Linsen", "en:rolled-oats": "Haferflocken", "en:oat-flakes": "Haferflocken",
    "en:baking-powders": "Backpulver", "en:corn-starches": "Speisestärke", "en:breadcrumbs": "Paniermehl", "en:semolinas": "Griess", "en:millets": "Hirse",
    "en:applesauces": "Apfelmus", "en:apple-compotes": "Apfelmus", "en:pickled-cucumbers": "Essiggurken", "en:gherkins": "Essiggurken",
  };
  function textMatch(bn, text) {
    const s = " " + String(text || "").toLowerCase().replace(/[^a-zäöüß0-9-]+/g, " ") + " ", words = s.trim().split(/\s+/);
    let best = null, bl = 0;
    for (const a of bn.arts) for (const v of a.vs) {
      if (v.length < 3 || v.length <= bl) continue;
      if (s.includes(" " + v + " ") || (v.length >= 5 && !v.includes(" ") && words.some((w) => w.length > v.length && w.endsWith(v)))) { best = a; bl = v.length; }
    }
    return best;
  }
  const offInfo = (p) => ({ name: ekClean(p.product_name_de || p.product_name || p.generic_name_de || p.generic_name || ""), brand: ekClean((p.brands || "").split(",")[0]), qty: ekClean(p.quantity || ""), gen: ekClean(p.generic_name_de || ""), cats: p.categories_hierarchy || [] });
  function detailOf(info, withName) {
    let t = withName ? info.name : "";
    if (info.brand && !t.toLowerCase().includes(info.brand.toLowerCase())) t = (info.brand + " " + t).trim();
    return [t, info.qty].filter(Boolean).join(", ").slice(0, 70);
  }
  async function suggestFor(p) {
    const bn = await bringNames(), info = offInfo(p);
    let a = null;
    for (const c of [...info.cats].reverse()) { const k = OFF_CAT[c]; if (k && bn.byKey.has(k)) { a = bn.byKey.get(k); break; } }
    if (!a) a = textMatch(bn, `${info.name} ${info.gen}`);
    if (a) return { key: a.key, n: a.n, d: detailOf(info, true) };
    const nm = (info.name || info.brand).slice(0, 40);
    return nm ? { key: nm, n: nm, d: detailOf(info, false) } : null;
  }
  async function resolveName(txt) {
    const bn = await bringNames(), t = ekClean(txt).slice(0, 40), a = bn.any.get(t.toLowerCase());
    return a ? { key: a.key, n: a.n } : { key: t, n: t };
  }
  /* Strichcode prüfen: EAN-13, EAN-8, UPC-A (12 Stellen → mit 0 vorne), GTIN-14 mit führender 0 */
  function normCode(raw) {
    let c = String(raw || "").replace(/\D/g, "");
    if (c.length === 12) c = "0" + c;
    if (c.length === 14 && c[0] === "0") c = c.slice(1);
    if (c.length !== 8 && c.length !== 13) return "";
    const d = c.split("").map(Number), chk = d.pop();
    let s = 0;
    for (let i = d.length - 1, w = 3; i >= 0; i--, w = 4 - w) s += d[i] * w;
    return (10 - (s % 10)) % 10 === chk ? c : "";
  }
  const OFF_HOSTS = ["world.openfoodfacts.org", "world.openbeautyfacts.org", "world.openproductsfacts.org", "world.openpetfoodfacts.org"];
  /* undefined = kein Netz, null = unbekannt, sonst das Produkt */
  async function offFetch(host, code) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 7000);
    try {
      const res = await fetch(`https://${host}/api/v2/product/${code}.json?lc=de&fields=product_name,product_name_de,generic_name,generic_name_de,brands,quantity,categories_hierarchy`, { signal: ctl.signal, cache: "no-store" });
      if (!res.ok) return null;
      const j = await res.json();
      return j && j.status === 1 && j.product ? j.product : null;
    } catch (e) { return undefined; } finally { clearTimeout(t); }
  }
  async function offLookup(code) {
    const first = await offFetch(OFF_HOSTS[0], code);
    const has = (p) => p && (offInfo(p).name || offInfo(p).brand);
    if (has(first)) return { p: first, net: true };
    const rest = await Promise.all(OFF_HOSTS.slice(1).map((h) => offFetch(h, code)));
    const p = rest.find(has);
    return { p: p || null, net: first !== undefined || rest.some((x) => x !== undefined) };
  }

  /* Ein Scan: bekannter Code → sofort +1; neuer Code → nachschlagen, gleich auf die Liste, einmal bestätigen */
  let scanQ = Promise.resolve();
  function onScan(raw, how) { scanQ = scanQ.then(() => handleScan(raw, how)).catch((e) => logError("Scan", e.message, e.stack)); }
  const ekCanAsk = () => !inCooking && $("#alarm").hidden && ($("#sheet").hidden || ["cam", "neu", "code"].includes($("#sheet").dataset.ek));
  async function handleScan(raw, how) {
    const code = normCode(raw);
    if (!code) { toast("Code nicht erkannt – bitte nochmal scannen"); buzz([30, 60, 30]); return; }
    if ($("#sheet").dataset.ek === "neu") await ekConfirm();
    if ($("#sheet").dataset.ek === "code") closeSheet();
    const id = "e:" + code, k = ekView().kat[code];
    if (k && k.n) {
      ekOp({ op: "inc", id, by: 1, it: { n: k.n, key: k.key || k.n, d: k.d || "", ean: code } });
      const c = (ekView().items[id] || {}).c || 1;
      buzz(15); toast(`${k.n} auf der Liste${c > 1 ? ` (jetzt ${c}×)` : ""}`); ekRefresh(true);
      return;
    }
    toast("Neuer Artikel – suche den Namen …");
    const { p, net } = await offLookup(code);
    const sug = p ? await suggestFor(p) : null;
    ekOp({ op: "inc", id, by: 1, it: sug ? { n: sug.n, key: sug.key, d: sug.d, ean: code } : { n: "", key: "", d: "", ean: code } });
    if (sug) ekOp({ op: "kat", ean: code, k: { key: sug.key, n: sug.n, d: sug.d, ok: false } });
    buzz(sug ? 15 : [20, 50, 20]);
    ekRefresh(true);
    if (ekCanAsk()) await ekNewSheet(code, p ? offInfo(p) : null, sug, net);
    else toast(sug ? `${sug.n} auf der Liste` : "Unbekannter Artikel – bitte in der Einkaufsliste benennen");
  }
  async function ekNames() {
    const bn = await bringNames(), V = ekView();
    const set = new Set([...bn.arts.map((a) => a.n), ...Object.values(V.kat).map((k) => k.n), ...Object.values(V.items).map((i) => i.n)].filter(Boolean));
    return `<datalist id="ek-names">${[...set].sort((a, b) => a.localeCompare(b, "de")).map((n) => `<option value="${esc(n)}">`).join("")}</datalist>`;
  }
  const ekFields = (n, d) => `<label class="small" for="ekn"><b>In Bring als</b></label>
      <input class="field" id="ekn" list="ek-names" autocomplete="off" enterkeyhint="done" value="${esc(n)}" placeholder="z. B. Dosentomaten" data-ekname>
      <label class="small" for="ekd" style="display:block;margin-top:10px"><b>Details</b> <span class="muted">(Marke, Größe – steht in Bring dabei)</span></label>
      <input class="field" id="ekd" autocomplete="off" enterkeyhint="done" value="${esc(d)}" placeholder="z. B. Mutti, 400 g" data-ekdetail>`;
  async function ekNewSheet(code, info, sug, net) {
    const names = await ekNames();
    const what = info ? [info.brand, info.name, info.qty].filter(Boolean).join(" · ") : net ? "Dieser Code steht in keiner offenen Produktdatenbank – einmal benennen, dann kennt die App ihn." : "Gerade kein Netz – der Name lässt sich nicht nachschlagen. Einfach selbst eintragen.";
    openSheet(`<h2>${sug ? "Neu gescannt" : "Was ist das?"}</h2>
      <p class="small muted" style="margin:4px 0 12px">${esc(what)} <span class="ek-code">${esc(code)}</span></p>
      ${ekFields(sug ? sug.n : "", sug ? sug.d : "")}${names}
      <button class="btn primary big" style="margin-top:14px" data-act="ek-ok">${sug ? "Passt – merken" : "Speichern und merken"}</button>
      <p class="small muted" style="margin:10px 0 0">Steht schon auf der Liste. Ab jetzt landet dieser Code direkt drauf – auf allen Geräten.</p>`, { ek: "neu", ekid: code });
    if (!sug) setTimeout(() => { const i = $("#ekn"); if (i) i.focus(); }, 250);
  }
  async function ekConfirm() {
    const s = $("#sheet"), code = s.dataset.ekid;
    const nm = ekClean(($("[data-ekname]") || {}).value), det = ekClean(($("[data-ekdetail]") || {}).value).slice(0, 70);
    closeSheet();
    if (!code) return;
    if (!nm) { toast("Ohne Namen – steht als „Name fehlt“ auf der Liste"); return; }
    const r = await resolveName(nm);
    ekOp({ op: "set", id: "e:" + code, it: { n: r.n, key: r.key, d: det } });
    ekOp({ op: "kat", ean: code, k: { key: r.key, n: r.n, d: det, ok: true } });
    ekRefresh(); toast(`Gemerkt: ${r.n}`);
  }
  async function ekEditSheet(id) {
    const it = ekView().items[id];
    if (!it) return;
    openSheet(`<h2>${esc(it.n || "Name fehlt")}</h2>
      <p class="small muted" style="margin:4px 0 12px">${it.ean ? `Strichcode <span class="ek-code">${esc(it.ean)}</span> · ` : ""}${it.c}× auf der Liste</p>
      ${ekFields(it.n, it.d || "")}${await ekNames()}
      <div class="act-btns"><button class="btn primary" data-act="ek-save">Speichern</button><button class="btn ghost" data-act="ek-del">Von der Liste nehmen</button></div>
      ${it.ean ? `<p class="small muted" style="margin:10px 0 0">Name und Details gelten ab jetzt für diesen Strichcode – auf allen Geräten.</p>` : ""}`, { ek: "edit", ekid: id });
    if (!it.n) setTimeout(() => { const i = $("#ekn"); if (i) i.focus(); }, 250);
  }
  async function ekSave() {
    const id = $("#sheet").dataset.ekid, it = ekView().items[id];
    const nm = ekClean(($("[data-ekname]") || {}).value), det = ekClean(($("[data-ekdetail]") || {}).value).slice(0, 70);
    closeSheet();
    if (!it) return;
    if (!nm) { toast("Bitte einen Namen eintragen"); return; }
    const r = await resolveName(nm);
    ekOp({ op: "set", id, it: { n: r.n, key: r.key, d: det } });
    if (it.ean) ekOp({ op: "kat", ean: it.ean, k: { key: r.key, n: r.n, d: det, ok: true } });
    ekRefresh(); toast("Gespeichert");
  }
  async function ekAddText(txt) {
    const t = ekClean(txt);
    if (!t) return;
    if (/^\d[\d ]{6,16}$/.test(t)) { onScan(t, "hand"); return; }
    const m = t.match(/^(\d{1,2})\s*[x×]?\s+(.+)$/), c = m ? Math.max(1, +m[1]) : 1;
    const r = await resolveName(m ? m[2] : t);
    if (!r.key) return;
    ekOp({ op: "inc", id: "h:" + r.key.toLowerCase(), by: c, it: { n: r.n, key: r.key, d: "" } });
    buzz(10); ekRefresh(true); toast(`${r.n} auf der Liste`);
  }
  function ekCodeSheet(msg) {
    openSheet(`<h2>Code eintippen</h2><p class="small muted" style="margin:4px 0 12px">${esc(msg || "Die Ziffern unter dem Strichcode, meist 13 Stück.")}</p>
      <form data-ekcode autocomplete="off"><input class="field" type="text" inputmode="numeric" pattern="[0-9 ]*" enterkeyhint="done" placeholder="z. B. 4008400401621" data-ekcodein>
      <button class="btn primary big" style="margin-top:12px">Auf die Liste</button></form>`, { ek: "code" });
    setTimeout(() => { const i = $("[data-ekcodein]"); if (i) i.focus(); }, 250);
  }

  /* Kamera: nur wo der Browser Strichcodes lesen kann (Chrome auf Android); bleibt offen für mehrere Scans */
  let cam = null;
  function stopCam() { if (!cam) return; clearTimeout(cam.t); try { cam.stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* schon aus */ } cam = null; }
  async function ekCamSheet() {
    let det = null;
    try {
      const fm = await window.BarcodeDetector.getSupportedFormats();
      const want = ["ean_13", "ean_8", "upc_a", "upc_e"].filter((f) => fm.includes(f));
      if (want.length && navigator.mediaDevices) det = new window.BarcodeDetector({ formats: want });
    } catch (e) { det = null; }
    if (!det) { ekCodeSheet("Die Kamera kann in diesem Browser keine Strichcodes lesen – die Ziffern einfach eintippen."); return; }
    openSheet(`<h2>Mit der Kamera scannen</h2><p class="small muted" style="margin:4px 0 10px">Strichcode ruhig ins Bild halten – die App erkennt ihn von selbst. Mehrere nacheinander gehen auch.</p>
      <div class="ek-cam"><video playsinline muted autoplay></video><i></i></div>
      <div class="act-btns"><button class="btn" data-act="ek-code">Code eintippen</button><button class="btn primary" data-act="sheet-close">Fertig</button></div>`, { ek: "cam" });
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }); }
    catch (e) { closeSheet(); ekCodeSheet("Die Kamera ist nicht freigegeben – die Ziffern einfach eintippen."); return; }
    if ($("#sheet").dataset.ek !== "cam") { stream.getTracks().forEach((t) => t.stop()); return; }
    const v = $(".ek-cam video");
    v.srcObject = stream; v.play().catch(() => {});
    cam = { stream, last: "", at: 0, t: null };
    const loop = async () => {
      if (!cam || $("#sheet").dataset.ek !== "cam") { stopCam(); return; }
      try {
        const hit = (await det.detect(v))[0], code = hit && normCode(hit.rawValue);
        if (code && !(code === cam.last && Date.now() - cam.at < 3000)) { cam.last = code; cam.at = Date.now(); onScan(code, "kamera"); }
      } catch (e) { /* Bild noch nicht bereit */ }
      if (cam) cam.t = setTimeout(loop, 220);
    };
    loop();
  }

  /* Der Scanner tippt sehr schnell (wenige Millisekunden je Ziffer) und schließt mit Enter oder Tab ab.
     So unterscheidet die App ihn von einer echten Tastatur – egal, welcher Reiter offen ist. */
  let scanBuf = "", scanT0 = 0, scanLast = 0;
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey || embedded) return;
    const now = performance.now();
    if (now - scanLast > 150) scanBuf = "";
    scanLast = now;
    if (e.key === "Enter" || e.key === "Tab") {
      const buf = scanBuf; scanBuf = "";
      if (/^\d{8,14}$/.test(buf) && now - scanT0 < buf.length * 55 + 80) {
        e.preventDefault(); e.stopPropagation();
        const t = e.target;
        if (t && /INPUT|TEXTAREA/.test(t.tagName) && typeof t.value === "string" && t.value.endsWith(buf)) { t.value = t.value.slice(0, -buf.length); t.dispatchEvent(new Event("input", { bubbles: true })); }
        onScan(buf, "scanner");
      }
      return;
    }
    if (/^\d$/.test(e.key)) { if (!scanBuf) scanT0 = now; scanBuf += e.key; }
    else if (e.key.length === 1) scanBuf = "";
  }, true);

  /* Bring: versteckte Importseite anlegen, warten bis sie online ist, dann per Deeplink öffnen */
  function ekLines(items) {
    const g = new Map();
    for (const it of items) { const k = ekClean(it.key || it.n); if (!k) continue; if (!g.has(k)) g.set(k, []); g.get(k).push(it); }
    return [...g].map(([k, list]) => {
      const spec = list.map((it) => [it.c > 1 ? `${it.c}×` : "", ekClean(it.d)].filter(Boolean).join(" ")).filter(Boolean).join(" + ");
      return k + (spec ? ` (${spec})` : "");
    });
  }
  function ekPage(lines, title, url) {
    const ld = { "@context": "https://schema.org/", "@type": "Recipe", name: title, author: { "@type": "Organization", name: "Rezeptesammlung" }, inLanguage: "de", url,
      recipeYield: "1", recipeIngredient: lines, recipeInstructions: [{ "@type": "HowToStep", text: "Einkaufsliste aus dem Kochbuddy." }] };
    return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<script type="application/ld+json">
${JSON.stringify(ld, null, 1).replace(/<\//g, "<\\/")}
</script>
<link rel="stylesheet" href="../rezepte/style.css">
</head>
<body>
<main>
<h1>${esc(title)}</h1>
<p class="meta">${lines.length} Artikel für den Bring-Import</p>
<ul class="ing">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
</main>
</body>
</html>
`;
  }
  const ekDeeplink = (url) => `https://api.getbring.com/rest/bringrecipes/deeplink?url=${encodeURIComponent(url)}&source=web&baseQuantity=1&requestedQuantity=1`;
  async function ekBringStart(btn) {
    if (!ghToken()) { tokenSheet("Für den Bring-Import braucht dieses Gerät einmalig den GitHub-Schlüssel."); return; }
    const V = ekView(), ids = Object.keys(V.items).filter((id) => V.items[id].n);
    if (!ids.length) return;
    const lines = ekLines(ids.map((id) => V.items[id]));
    const rid = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");
    const path = `liste/${rid}.html`, url = SITE_URL + path, d = new Date();
    if (btn) btn.disabled = true;
    try {
      const r = await gh("PUT", `/contents/${path}`, { message: `Einkaufsliste für Bring (${lines.length} Artikel)`, content: b64e(ekPage(lines, `Einkaufsliste ${pad(d.getDate())}.${pad(d.getMonth() + 1)}. ${hm(d)}`, url)) });
      ek().bring = { path, url, sha: r && r.content ? r.content.sha : "", at: Date.now(), status: "wait", n: lines.length, snap: Object.fromEntries(ids.map((id) => [id, V.items[id].c])) };
      save(); ekRefresh(); setTimeout(ekPoll, 20000);
    } catch (e) {
      if (btn) btn.disabled = false;
      if (e.code === "auth") tokenSheet(e.message); else toast(e.code === "offline" ? "Gerade kein Netz – bitte gleich nochmal" : `Hat nicht geklappt: ${e.message}`);
    }
  }
  let ekPollT = null;
  async function ekPoll() {
    clearTimeout(ekPollT);
    const B = ek().bring;
    if (!B || B.status !== "wait") return;
    let ok = false;
    try { ok = (await fetch(new URL(`../${B.path}?t=${Date.now()}`, location.href), { method: "HEAD", cache: "no-store" })).ok; } catch (e) { ok = false; }
    const B2 = ek().bring;
    if (!B2 || B2.path !== B.path || B2.status !== "wait") return;
    if (ok) { B2.status = "ready"; save(); ekRefresh(); buzz([15, 60, 15]); toast("Die Liste ist bereit für Bring"); return; }
    if (Date.now() - B2.at > 8 * 60000) { B2.status = "slow"; save(); ekRefresh(); return; }
    ekPollT = setTimeout(ekPoll, 8000);
  }
  function ekDropPage(B) { if (B && B.path && B.sha && ghToken()) gh("DELETE", `/contents/${B.path}`, { message: "Einkaufsliste: Importseite entfernt", sha: B.sha }).catch(() => {}); }
  function ekDone() {
    const E = ek(), B = E.bring;
    if (!B) return;
    for (const [id, c] of Object.entries(B.snap || {})) ekOp({ op: "take", id, c });
    E.bring = null; save(); ekDropPage(B); ekRefresh();
    toast(Object.keys(ekView().items).length ? "Prima – der Rest bleibt fürs nächste Mal auf der Liste" : "Prima – die Liste ist wieder leer");
  }
  function ekCancel() { const E = ek(), B = E.bring; E.bring = null; save(); ekDropPage(B); ekRefresh(); toast("Abgebrochen – die Liste bleibt, wie sie ist"); }
  function ekMailText(B) {
    const V = ekView(), lines = Object.entries(B.snap || {}).map(([id, c]) => V.items[id] && `- ${V.items[id].n}${c > 1 ? ` (${c}×)` : ""}`).filter(Boolean);
    return ["Hallo,", "", "das steht auf der Einkaufsliste:", ...lines, "", "In Bring übernehmen (antippen):", ekDeeplink(B.url), "", "Dein Kochbuddy"].join("\n");
  }
  function ekBringHtml(V) {
    const B = ek().bring, ids = Object.keys(V.items), named = ids.filter((id) => V.items[id].n).length, miss = ids.length - named;
    if (B && (B.status === "ready" || B.status === "slow")) {
      const extra = ids.filter((id) => !(B.snap || {})[id] || V.items[id].c > B.snap[id]).length;
      return `<section class="act"><div class="act-h"><span class="act-ico">${ICON_CART}</span><div><span class="act-k">${B.status === "slow" ? "Dauert länger als sonst" : "Bereit"}</span><b>${B.n} ${B.n === 1 ? "Artikel" : "Artikel"} für Bring</b>
        <div class="small">${B.status === "slow" ? "Die Importseite ist noch nicht erreichbar. Meist klappt es trotzdem – sonst kurz warten und nochmal prüfen." : "„In Bring öffnen“ zeigt genau diese Artikel. Dort auswählen und bestätigen, dann hier auf „Erledigt“."}</div></div></div>
        <div class="act-btns"><a class="btn primary" href="${esc(ekDeeplink(B.url))}" target="_blank" rel="noopener" data-ekopen>In Bring öffnen</a><button class="btn" data-act="ek-mail">Per Mail ans Handy</button>
        ${B.status === "slow" ? `<button class="btn" data-act="ek-recheck">Nochmal prüfen</button>` : ""}<button class="btn ${B.opened ? "primary" : "ghost"}" data-act="ek-done">${B.opened ? "Erledigt – ist in Bring" : "Erledigt"}</button></div>
        <p class="small muted" style="margin:10px 0 0">Nach „Erledigt“ verschwinden diese Artikel von der Liste${extra ? `, was seitdem dazukam, bleibt stehen` : ""}. <a href="#" data-act="ek-cancel">Abbrechen</a></p></section>`;
    }
    if (B && B.status === "wait") {
      return `<section class="act info"><div class="act-h"><span class="act-ico">${ICON_WAIT}</span><div><span class="act-k">Einen Moment</span><b>Die Liste wird für Bring vorbereitet</b>
        <div class="small">Meist 1–2 Minuten. Du kannst solange weiterscannen – was jetzt dazukommt, bleibt fürs nächste Mal auf der Liste.</div></div></div>
        <p class="small muted" style="margin:10px 0 0"><a href="#" data-act="ek-cancel">Abbrechen</a></p></section>`;
    }
    if (!named) return "";
    return `<button class="btn primary big" data-act="ek-bring">${ICON_CART} In Bring übernehmen</button>
      <p class="small muted" style="margin:8px 2px 0">Die App legt dafür kurz eine versteckte Importseite an – nur Artikel und Marken, sonst nichts. Das dauert 1–2 Minuten.${miss ? ` ${miss === 1 ? "Ein Artikel ohne Namen bleibt" : `${miss} Artikel ohne Namen bleiben`} auf der Liste.` : ""}</p>`;
  }
  function ekRow(id, it, fresh) {
    return `<li class="ek-row${it.n ? "" : " miss"}${fresh ? " fresh" : ""}">
      <button type="button" class="ek-main" data-ekedit="${esc(id)}"><b>${esc(it.n || "Name fehlt")}</b>${it.d ? `<small>${esc(it.d)}</small>` : it.n ? "" : `<small>Strichcode ${esc(it.ean || "")} – antippen und benennen</small>`}</button>
      <div class="ek-cnt"><button type="button" data-ekinc="${esc(id)}|-1" aria-label="Eins weniger">−</button><b aria-label="Anzahl">${it.c}</b><button type="button" data-ekinc="${esc(id)}|1" aria-label="Eins mehr">+</button></div></li>`;
  }
  let ekFresh = null;
  function drawEk(view) {
    const V = ekView(), list = Object.entries(V.items).sort((a, b) => ((a[1].at || "") < (b[1].at || "") ? 1 : -1));
    const n = list.reduce((s, [, it]) => s + it.c, 0), top = list[0] && list[0][0];
    const cnt = $("#ek-count", view); if (cnt) cnt.textContent = n ? `${n} ${n === 1 ? "Artikel" : "Artikel"}` : "Leer";
    const ul = $("#ek-list", view);
    if (ul) ul.innerHTML = list.map(([id, it]) => ekRow(id, it, ekFresh && id === top)).join("") || `<li class="empty">Noch leer. Leere Packung scannen oder oben etwas dazuschreiben.</li>`;
    const b = $("#ek-bring", view); if (b) b.innerHTML = ekBringHtml(V);
    ekFresh = null;
  }
  function ekRefresh(fresh) { if (location.hash.startsWith("#/einkauf")) { ekFresh = !!fresh; drawEk($("#view")); } }
  async function renderEinkauf(view) {
    const names = await ekNames();
    view.innerHTML = `<header class="top"><div><div class="eyebrow" id="ek-count"></div><h1>Einkaufsliste</h1></div></header>
      ${syncBanner()}
      <section class="card ek-scan" id="ek-scan"><div class="ek-scan-h"><span class="ek-ico">${BARCODE}</span><div><b>Einfach scannen</b>
        <div class="small muted">Scanner an und den Strichcode der leeren Packung scannen – egal, welcher Reiter offen ist. Nochmal scannen zählt hoch.</div></div></div>
        <div class="act-btns"><button class="btn" data-act="ek-cam">${CAMERA} Mit Kamera</button><button class="btn ghost" data-act="ek-code">Code eintippen</button></div></section>
      <form class="ek-add" data-ekform autocomplete="off"><input class="search" type="text" list="ek-names" enterkeyhint="done" aria-label="Artikel dazuschreiben" placeholder="Dazuschreiben, z. B. 2 Milch" data-ekadd><button class="btn primary" aria-label="Auf die Liste">+</button></form>
      ${names}
      <ul class="ek-list" id="ek-list"></ul>
      <div id="ek-bring" class="ek-bring"></div>
      <details class="ek-help"><summary>Scanner einrichten und Tipps</summary><ul class="small">
        <li>Den Bluetooth-Scanner im <b>HID- bzw. Tastaturmodus</b> mit dem Tablet koppeln – wie das geht, steht in seiner Anleitung (meist einen Code aus dem Heft scannen). Am Ende jedes Scans sendet er Enter, das ist Standard.</li>
        <li>Neue Produkte erkennt die App über offene Produktdatenbanken und schlägt die passende Bring-Kachel vor. Einmal bestätigt, kennt sie den Code auf allen Geräten.</li>
        <li>Solange der Scanner verbunden ist, blendet Android oft die Bildschirmtastatur aus. Dann in den Android-Einstellungen bei der physischen Tastatur „Bildschirmtastatur anzeigen“ einschalten.</li>
        <li>Theke, Waage und loses Obst haben keinen festen Code – einfach oben dazuschreiben.</li>
        <li>Die Liste wird privat gespeichert und ist auf allen Geräten gleich.</li></ul></details>`;
    drawEk(view);
    const B = ek().bring; if (B && B.status === "wait" && !ekPollT) ekPoll();
  }
  document.addEventListener("submit", (e) => {
    const f = e.target;
    if (f.matches("[data-ekform]")) { e.preventDefault(); const i = $("[data-ekadd]", f), v = i.value; i.value = ""; ekAddText(v); }
    else if (f.matches("[data-ekcode]")) { e.preventDefault(); const v = ($("[data-ekcodein]", f) || {}).value || ""; if (!normCode(v)) { toast("Die Ziffern passen nicht zu einem Strichcode – bitte prüfen"); return; } closeSheet(); onScan(v, "hand"); }
  });

  /* ---------- Vorrat: was im Gefrierschrank liegt ----------
     Schneeflocke am Rezept: Gericht kommt mit Datum in den Vorrat und ein Etikett (50 × 30 mm) wird gedruckt.
     Haltbarkeit: was das Rezept nennt („eingefroren 3 Monate“), höchstens 3 Monate – die Faustregel für selbst
     gekochte Gerichte (BZfE, Verbraucherzentrale). Entnommenes wird im Reiter Rezepte → Vorrat ausgetragen.
     Gespeichert nur im privaten Repo: vorrat/gefrierschrank.json. */
  const VR_PATH = "/contents/vorrat/gefrierschrank.json";
  const VR_INFO = "Gefrierschrank aus dem Kochbuddy: items: id → {t: Gericht, slug: Rezept (leer bei Eigenem), am: eingefroren (JJJJ-MM-TT), bis: verbrauchen bis, m: Monate, at}. Schreibt die App (Schneeflocke am Rezept, „Entnommen“ im Vorrat) – nicht von Hand ändern und nicht für Einkaufslisten verwenden.";
  const SNOW = '<svg class="ico" viewBox="0 0 24 24"><path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5"/><path d="M9.3 4.2L12 6.4l2.7-2.2M9.3 19.8l2.7-2.2 2.7 2.2M4.4 10.6l3.2-.9-1-3.2M19.6 13.4l-3.2.9 1 3.2M4.4 13.4l3.2.9-1 3.2M19.6 10.6l-3.2-.9 1-3.2"/></svg>';
  const vr = () => { const V = (S.vorrat = S.vorrat || {}); V.items = V.items || {}; V.ops = V.ops || []; return V; };
  function vrApply(items, ops) {
    const I = {};
    for (const [k, v] of Object.entries(items || {})) I[k] = { ...v };
    for (const o of ops) { if (o.op === "add") I[o.id] = { ...o.it, at: o.at }; else if (o.op === "del") delete I[o.id]; else if (o.op === "set" && I[o.id]) Object.assign(I[o.id], o.it); }
    return I;
  }
  const vrItems = () => { const V = vr(); return vrApply(V.items, V.ops); };
  let vrTimer = null, vrSyncing = null;
  function vrOp(o) { o.at = o.at || new Date().toISOString(); vr().ops.push(o); save(); if (!embedded) { clearTimeout(vrTimer); vrTimer = setTimeout(() => syncVorrat(true).then((ch) => { if (ch) vrRefresh(); }), 3000); } }
  function syncVorrat(quiet) {
    if (embedded) return Promise.resolve(false);
    if (vrSyncing) return vrSyncing;
    vrSyncing = (async () => {
      const V = vr();
      if (!ablage.privat || !dataReady() || !ghToken()) return false;
      try {
        for (let k = 0; k < 3; k++) {
          const r = await gh("GET", VR_PATH, null, DATA_REPO);
          const data = r ? JSON.parse(b64d(r.content)) : {};
          const ops = V.ops.slice();
          if (!ops.length) { const before = JSON.stringify(V.items); V.items = data.items || {}; save(); return before !== JSON.stringify(V.items); }
          const items = vrApply(data.items, ops);
          const msg = ops.map((o) => (o.op === "add" ? `eingefroren: ${o.it.t}` : o.op === "del" ? `entnommen: ${(o.it && o.it.t) || "Gericht"}` : "geändert")).join("; ");
          try {
            await gh("PUT", VR_PATH, { message: `Koch-App: Vorrat – ${msg}`.slice(0, 180), content: b64e(JSON.stringify({ info: VR_INFO, items, updated: new Date().toISOString() }, null, 1) + "\n"), ...(r ? { sha: r.sha } : {}) }, DATA_REPO);
            V.ops = V.ops.slice(ops.length); V.items = items; save(); syncMark(true);
            return true;
          } catch (e) { if (e.code === 409 || e.code === 422) continue; throw e; }
        }
      } catch (e) {
        syncMark(false, e);
        if (!quiet && e.code === "auth") { toast(`Vorrat nicht gespeichert: ${e.message}`); tokenSheet(e.message); }
      }
      return false;
    })().finally(() => { vrSyncing = null; });
    return vrSyncing;
  }
  /* Haltbarkeit aus dem Rezepttext, sonst 3 Monate; nie länger als 3 Monate */
  function freezeMonths(r) {
    const fz = r && r.einfrieren;
    if (fz && +fz.monate > 0) return Math.max(1, Math.min(3, Math.round(+fz.monate)));
    const txt = [r && r.store, r && r.servingsNote].filter(Boolean).join(" ");
    const m = txt.match(/(?:eingefroren|einfrieren|gefrierschrank|gefrierfach|tiefkühl\w*)[^.]{0,30}?(\d+)\s*(Monat|Woche)/i) || txt.match(/(\d+)\s*(Monat|Woche)\w*\s+(?:im\s+|in\s+der\s+)?(?:Gefrier|Tiefkühl|eingefroren)/i);
    let n = 3;
    if (m) n = /woche/i.test(m[2]) ? Math.max(1, Math.round(+m[1] / 4)) : +m[1];
    return Math.max(1, Math.min(3, n || 3));
  }
  /* Eingefroren wird nur der Hauptteil, frische Beilagen nicht: „Rindergulasch mit Karotten & Spätzle“ → „Rindergulasch“,
     Suppen und Aufläufe ganz. Steht im Rezept einfrieren.name (schreibt der Buddy), gilt das. */
  function freezeName(r) {
    if (r && r.einfrieren && r.einfrieren.name) return String(r.einfrieren.name).trim().slice(0, 60);
    let t = String((r && r.title) || "").trim();
    if (!/one-pot/i.test(t)) t = t.split(/\s+mit\s+/i)[0]; // One-Pot: alles ist zusammen gekocht
    t = t.replace(/\s+(aus der Heißluftfritteuse|aus dem Varoma|aus dem Ofen|vom Blech|aus dem Gefrierschrank)$/i, "");
    return t.trim().slice(0, 60) || String((r && r.title) || "").slice(0, 60);
  }
  function addMonthsIso(iso, n) {
    const [y, mo, d] = iso.split("-").map(Number), last = new Date(y, mo - 1 + n + 1, 0).getDate();
    return toIso(new Date(y, mo - 1 + n, Math.min(d, last)));
  }
  const vrCount = (slug) => { const n = slug ? Object.values(vrItems()).filter((x) => x.slug === slug).length : 0; return n ? `${n} im Vorrat` : "noch nichts im Vorrat"; };
  const dmy = (iso, short) => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${short ? y.slice(2) : y}`; };
  const daysLeft = (iso) => Math.round((new Date(iso + "T12:00") - new Date(today() + "T12:00")) / 86400000);

  /* Etikett zeichnen: 48 × 30 mm Druckbereich (B1: 384 × 240 Punkte bei 203 dpi), schwarz auf weiß */
  function labelSize(meta) {
    const dpmm = ((meta && meta.dpi) || 203) / 25.4;
    return { w: Math.min((meta && meta.printheadPixels) || 384, Math.round(48 * dpmm)), h: Math.round(30 * dpmm) };
  }
  async function labelCanvas(it, meta) {
    const { w, h } = labelSize(meta), s = w / 384;
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const g = cv.getContext("2d");
    try { await Promise.all([document.fonts.load(`800 ${30 * s}px "Bricolage Grotesque"`), document.fonts.load(`700 ${20 * s}px "Atkinson Hyperlegible"`)]); } catch (e) { /* Systemschrift */ }
    const HEAD = '"Bricolage Grotesque", "Segoe UI", sans-serif', BODY = '"Atkinson Hyperlegible", "Segoe UI", sans-serif';
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = "#000"; g.strokeStyle = "#000"; g.textBaseline = "alphabetic";
    const pad = 14 * s;
    if (it.nur === "datum") {
      // nur das Tagesdatum, so groß wie es aufs Etikett passt, mittig
      const txt = dmy(it.am), maxW = w - 2 * pad, maxH = h - 2 * pad;
      let size = 160 * s, m;
      for (; size > 20 * s; size -= 2 * s) {
        g.font = `800 ${size}px ${HEAD}`; m = g.measureText(txt);
        if (m.width <= maxW && (m.actualBoundingBoxAscent || size * 0.72) + (m.actualBoundingBoxDescent || 0) <= maxH) break;
      }
      const asc = m.actualBoundingBoxAscent || size * 0.72, desc = m.actualBoundingBoxDescent || 0;
      g.textAlign = "center"; g.fillText(txt, w / 2, h / 2 + (asc - desc) / 2); g.textAlign = "left";
    } else {
    // Kopfzeile: Schneeflocke, „EINGEFROREN“, Datum
    const sx = pad + 11 * s, sy = pad + 11 * s, sr = 10 * s;
    g.lineWidth = 2.6 * s; g.lineCap = "round";
    for (let a = 0; a < 6; a++) {
      const an = (a * Math.PI) / 3 + Math.PI / 2, ux = Math.cos(an), uy = Math.sin(an), bx = sx + ux * sr * 0.62, by = sy + uy * sr * 0.62, br = sr * 0.36;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + ux * sr, sy + uy * sr); g.stroke();
      for (const k of [-1, 1]) { const ak = an + k * 0.75; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(ak) * br, by + Math.sin(ak) * br); g.stroke(); }
    }
    g.font = `700 ${17 * s}px ${BODY}`;
    g.fillText("EINGEFROREN", pad + 28 * s, pad + 17 * s);
    g.font = `800 ${21 * s}px ${BODY}`; g.textAlign = "right";
    g.fillText(dmy(it.am), w - pad, pad + 18 * s); g.textAlign = "left";
    // Gericht: so groß wie möglich, höchstens 3 Zeilen
    const title = String(it.t || "").trim(), top = pad + 32 * s, bottom = h - 68 * s, maxW = w - 2 * pad;
    let size = 40 * s, lines = [];
    const wrap = (sz) => {
      g.font = `800 ${sz}px ${HEAD}`;
      const out = []; let cur = "";
      for (const word of title.split(/\s+/)) {
        const t = cur ? cur + " " + word : word;
        if (g.measureText(t).width <= maxW || !cur) cur = t; else { out.push(cur); cur = word; }
      }
      if (cur) out.push(cur);
      return out;
    };
    for (; size >= 18 * s; size -= 2 * s) { lines = wrap(size); if (lines.length * size * 1.02 <= bottom - top && lines.length <= 3 && lines.every((l) => g.measureText(l).width <= maxW)) break; }
    if (lines.length > 3) { lines = lines.slice(0, 3); lines[2] = lines[2].replace(/\s*\S*$/, "") + " …"; }
    g.font = `800 ${size}px ${HEAD}`;
    const blockH = lines.length * size * 1.02, y0 = top + (bottom - top - blockH) / 2 + size * 0.86;
    lines.forEach((l, i) => g.fillText(l, pad, y0 + i * size * 1.02, maxW));
    // Fuß: Linie, „VERBRAUCHEN BIS“, großes Datum
    g.lineWidth = 2.5 * s; g.beginPath(); g.moveTo(pad, h - 60 * s); g.lineTo(w - pad, h - 60 * s); g.stroke();
    g.font = `700 ${16 * s}px ${BODY}`; g.fillText("VERBRAUCHEN BIS", pad, h - 34 * s);
    g.fillText(`${it.m || 3} ${(it.m || 3) === 1 ? "MONAT" : "MONATE"}`, pad, h - 14 * s);
    g.font = `800 ${38 * s}px ${HEAD}`; g.textAlign = "right"; g.fillText(dmy(it.bis), w - pad, h - 16 * s); g.textAlign = "left";
    }
    // reines Schwarz-Weiß wie beim Thermodruck
    const img = g.getImageData(0, 0, w, h), px = img.data;
    for (let i = 0; i < px.length; i += 4) { const v = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11 < 150 ? 0 : 255; px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    return cv;
  }

  /* Niimbot-Drucker über Web Bluetooth (Chrome auf Android). Bibliothek: niimbluelib (MIT), wird erst bei Bedarf geladen. */
  let niimP = null, prn = null, prnName = "", printQ = Promise.resolve();
  const canBT = () => !embedded && !!navigator.bluetooth;
  function loadNiim() {
    if (window.niimbluelib) return Promise.resolve(window.niimbluelib);
    if (!niimP) niimP = new Promise((res, rej) => {
      const sc = document.createElement("script"); sc.src = "vendor/niimbluelib.min.js";
      sc.onload = () => (window.niimbluelib ? res(window.niimbluelib) : rej(new Error("Druck-Baustein fehlt")));
      sc.onerror = () => { niimP = null; rej(new Error("Druck-Baustein nicht ladbar – Internet da?")); };
      document.head.appendChild(sc);
    });
    return niimP;
  }
  const prnOn = () => !!(prn && prn.isConnected());
  async function printerConnect(pick) {
    const lib = await loadNiim();
    if (prnOn() && !pick) return prn;
    if (!prn) { prn = lib.instantiateClient("bluetooth"); prn.on("disconnect", () => vrRefresh()); }
    let dev = null;
    if (!pick && navigator.bluetooth.getDevices) {
      try { const list = await navigator.bluetooth.getDevices(); dev = list.find((d) => d.name && d.name === S.settings.printer) || list.find((d) => /^B1/i.test(d.name || "")) || null; } catch (e) { dev = null; }
    }
    let info;
    if (dev) { try { info = await prn.connect({ authorizedDevice: dev }); } catch (e) { dev = null; } }
    if (!dev) info = await prn.connect(); // Chrome zeigt einmal die Auswahl „B1-…“
    prnName = (info && info.deviceName) || "";
    if (prnName) { S.settings.printer = prnName; save(); }
    vrRefresh();
    return prn;
  }
  function printLabel(it, pick) {
    const job = printQ.then(async () => {
      const lib = await loadNiim(), c = await printerConnect(pick);
      const meta = c.getModelMetadata(), cv = await labelCanvas(it, meta);
      const color = lib.PageColorType.SingleColor;
      const task = c.protocol.newPrintTask(c.getPrintTaskType() || "B1", { totalPages: 1, statusPollIntervalMs: 100, statusTimeoutMs: 8000, pageColor: color,
        density: S.settings.printDensity || (meta && meta.densityDefault) || 3, labelType: lib.LabelType.WithGaps });
      try {
        await task.printInit();
        await task.printPage(lib.ImageEncoder.encodeCanvas(cv, color, (meta && meta.printDirection) || "top"), 1);
        await task.waitForPageFinished();
        await task.waitForFinished();
      } finally { try { await task.printEnd(); } catch (e) { /* schon fertig */ } }
    });
    printQ = job.catch(() => {});
    return job;
  }
  function printErrText(e) {
    const n = (e && e.name) || "", m = String((e && e.message) || e || "");
    if (n === "NotFoundError" || /cancel/i.test(m)) return "Kein Drucker ausgewählt.";
    if (n === "SecurityError" || /gesture|activation/i.test(m)) return "Chrome braucht dafür einen frischen Tipp – bitte nochmal antippen.";
    if (n === "NotSupportedError") return "Dieses Gerät kann sich nicht per Bluetooth mit dem Drucker verbinden.";
    return `Der Drucker antwortet nicht. Ist er eingeschaltet, nah genug und die Niimbot-App geschlossen? (${m.slice(0, 80)})`;
  }
  function printFailSheet(e, id) {
    openSheet(`<h2>Etikett nicht gedruckt</h2><p style="margin:6px 0 10px">${esc(printErrText(e))}</p>
      <p class="small muted" style="margin:0 0 12px">Das Gericht steht trotzdem im Vorrat.</p>
      <div class="act-btns"><button class="btn primary" data-vprint="${esc(id)}">Nochmal drucken</button><button class="btn" data-vprint="${esc(id)}|pick">Anderen Drucker wählen</button><button class="btn ghost" data-act="sheet-close">Ohne Etikett</button></div>`, { ek: "vprint" });
  }
  async function doPrint(id, pick) {
    const it = vrItems()[id];
    if (!it) return;
    if (!canBT()) { toast("Drucken geht nur in Chrome auf dem Android-Tablet – das Gericht steht im Vorrat"); return; }
    try { await printLabel(it, pick); buzz(15); toast(`Etikett gedruckt – verbrauchen bis ${dmy(it.bis)}`); }
    catch (e) { printFailSheet(e, id); }
  }
  /* Schneeflocke: in den Vorrat legen und gleich das Etikett drucken (ein Tipp = eine Dose) */
  async function freezeRecipe(ref) {
    const r = await getRecipe(ref);
    const m = freezeMonths(r), am = today();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    vrOp({ op: "add", id, it: { t: freezeName(r), rt: r.title, slug: r.slug || "", am, bis: addMonthsIso(am, m), m } });
    $$(".freeze-line .muted").forEach((x) => (x.textContent = `Etikett wird gedruckt · haltbar bis ${dmy(addMonthsIso(am, m))} · ${vrCount(r.slug)}`));
    if (/nicht\s+(?:zum\s+)?einfrieren|nicht\s+einfrierbar/i.test(r.store || "")) toast("Hinweis: Laut Rezept eignet es sich nicht gut zum Einfrieren");
    else if (!canBT()) toast(`${freezeName(r)} ist im Vorrat (bis ${dmy(addMonthsIso(am, m))})`);
    else toast("Im Vorrat – Etikett wird gedruckt …");
    buzz(10);
    await doPrint(id);
  }
  async function freezeOwn(name) {
    const t = String(name || "").trim().slice(0, 60);
    if (!t) return;
    const am = today(), id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    vrOp({ op: "add", id, it: { t, slug: "", am, bis: addMonthsIso(am, 3), m: 3 } });
    vrRefresh(); toast(canBT() ? "Im Vorrat – Etikett wird gedruckt …" : `${t} ist im Vorrat`);
    await doPrint(id);
  }
  function vrTake(id) {
    const it = vrItems()[id];
    if (!it) return;
    vrOp({ op: "del", id, it: { t: it.t } });
    S.vrUndo = { id, it, at: Date.now() }; save();
    vrRefresh(); toast(`${shortTitle(it.t)} entnommen`);
  }
  function vrUndo() { const u = S.vrUndo; if (!u) return; vrOp({ op: "add", id: u.id, it: u.it }); S.vrUndo = null; save(); vrRefresh(); toast("Zurückgelegt"); }
  async function vrSheet(id) {
    const it = vrItems()[id];
    if (!it) return;
    const cv = await labelCanvas(it, null), left = daysLeft(it.bis);
    openSheet(`<h2>${esc(it.t)}</h2><p class="small muted" style="margin:4px 0 12px">Eingefroren am ${dmy(it.am)} · verbrauchen bis ${dmy(it.bis)}${left < 0 ? " – abgelaufen" : left <= 14 ? ` – noch ${left} ${left === 1 ? "Tag" : "Tage"}` : ""}</p>
      <div class="label-prev"><img alt="Etikett" src="${cv.toDataURL()}"></div>
      <div class="act-btns"><button class="btn primary" data-vtake="${esc(id)}">Entnommen</button><button class="btn" data-vprint="${esc(id)}">${SNOW} Etikett nochmal drucken</button></div>
      <form class="vr-rename" data-vrename="${esc(id)}" autocomplete="off"><label class="small" for="vrn"><b>Was ist in der Dose?</b></label>
        <div class="ek-add" style="margin:6px 0 0"><input class="field" id="vrn" enterkeyhint="done" value="${esc(it.t)}" data-vrname><button class="btn">Ändern</button></div></form>
      ${it.slug ? `<p class="small" style="margin:12px 0 0">${it.rt && it.rt !== it.t ? `Aus dem Rezept „${esc(it.rt)}“ · ` : ""}<a href="#/r/a:${esc(it.slug)}" data-act="sheet-close">Zum Rezept</a></p>` : ""}`, { ek: "vorrat", ekid: id });
  }
  const recSwitch = (on) => {
    const n = Object.keys(vrItems()).length;
    return `<div class="seg rec-switch" role="tablist"><a href="#/rezepte" role="tab" aria-selected="${on === "rezepte"}" class="${on === "rezepte" ? "on" : ""}">Rezepte</a><a href="#/vorrat" role="tab" aria-selected="${on === "vorrat"}" class="${on === "vorrat" ? "on" : ""}">${SNOW}Vorrat${n ? ` <b>${n}</b>` : ""}</a></div>`;
  };
  function vrRow(id, it) {
    const left = daysLeft(it.bis), st = left < 0 ? "over" : left <= 14 ? "soon" : "";
    return `<li class="vr-row ${st}"><button type="button" class="vr-main" data-vopen="${esc(id)}"><b>${esc(it.t)}</b>
      <small>eingefroren ${dmy(it.am, true)} · <span class="vr-bis">${left < 0 ? "abgelaufen seit" : "bis"} ${dmy(it.bis, true)}</span>${st === "soon" ? ` · noch ${left} ${left === 1 ? "Tag" : "Tage"}` : ""}</small></button>
      <button type="button" class="btn small" data-vtake="${esc(id)}">Entnommen</button></li>`;
  }
  function drawVorrat(view) {
    const items = Object.entries(vrItems()).sort((a, b) => (a[1].bis < b[1].bis ? -1 : a[1].bis > b[1].bis ? 1 : a[1].t < b[1].t ? -1 : 1));
    const ul = $("#vorrat-list", view);
    if (ul) ul.innerHTML = items.map(([id, it]) => vrRow(id, it)).join("") || `<li class="empty">Noch nichts im Gefrierschrank. Beim Einfrieren im Rezept auf die Schneeflocke tippen – das druckt das Etikett und trägt das Gericht hier ein.</li>`;
    const cnt = $("#vr-count", view); if (cnt) cnt.textContent = items.length ? `${items.length} ${items.length === 1 ? "Dose" : "Dosen"} im Gefrierschrank` : "Gefrierschrank";
    const pr = $("#vr-printer", view); if (pr) pr.innerHTML = printerCard();
    const u = S.vrUndo, ub = $("#vr-undo", view);
    if (ub) ub.innerHTML = u && Date.now() - u.at < 120000 ? `<button class="btn small ghost" data-act="vr-undo">„${esc(shortTitle(u.it.t))}“ zurücklegen</button>` : "";
    const sw = $(".rec-switch", view); if (sw) sw.outerHTML = recSwitch("vorrat");
  }
  function printerCard() {
    if (!canBT()) return `<p class="small muted" style="margin:0">Etiketten druckt die App in Chrome auf dem Android-Tablet mit dem Niimbot B1 (50 × 30 mm). Auf diesem Gerät geht das nicht – der Vorrat funktioniert trotzdem.</p>`;
    const on = prnOn(), dens = S.settings.printDensity || 3;
    return `<div class="spread"><div><b>Etikettendrucker</b><div class="small muted">${on ? `Verbunden${prnName ? ` · ${esc(prnName)}` : ""}` : S.settings.printer ? `${esc(S.settings.printer)} · verbindet sich beim Drucken` : "Niimbot B1 · noch nicht verbunden"}</div></div><span class="prn-dot${on ? " on" : ""}" aria-hidden="true"></span></div>
      <div class="act-btns"><button class="btn small" data-act="prn-connect">${on ? "Neu verbinden" : "Drucker verbinden"}</button><button class="btn small" data-act="prn-test">Testetikett</button><button class="btn small" data-act="prn-date">Datum drucken</button></div>
      <details class="prn-more"><summary class="small">Druckstärke: ${dens}</summary><div class="seg" style="margin-top:8px">${[1, 2, 3, 4, 5].map((n) => `<button data-density="${n}" aria-pressed="${n === dens}">${n}</button>`).join("")}</div>
      <p class="small muted" style="margin:6px 0 0">Zu blass: höher. Verschmiert: niedriger. Normal ist 3.</p></details>`;
  }
  function vrRefresh() { if (location.hash.startsWith("#/vorrat")) drawVorrat($("#view")); }
  /* ---------- iPhone: Widget & Siri (Scriptable) ---------- */
  const IP_LOADER = `// Kochbuddy – was gibt's heute? Widget und Siri.
// Holt sich den aktuellen Kochbuddy-Code selbst. Diesen Text nicht ändern.
const QUELLE = "https://padderico.github.io/Rezeptesammlung/app/iphone/heute.js";
const fm = FileManager.local();
const datei = fm.joinPath(fm.libraryDirectory(), "kochbuddy-heute.js");
let code = "";
try {
  const r = new Request(QUELLE + "?t=" + Math.floor(Date.now() / 600000));
  r.timeoutInterval = 10;
  const neu = await r.loadString();
  if (r.response.statusCode === 200 && neu.startsWith("// KOCHBUDDY-HEUTE")) { code = neu; fm.writeString(datei, neu); }
} catch (e) {}
if (!code && fm.fileExists(datei)) code = fm.readString(datei);
if (!code) throw new Error("Kochbuddy nicht erreichbar – bitte mit Internet nochmal starten.");
await new Function("return (async () => {\\n" + code + "\\n})()")();
`;
  const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  async function copyLoader() {
    try { await navigator.clipboard.writeText(IP_LOADER); toast("Code kopiert – jetzt Scriptable öffnen"); }
    catch (e) {
      const ta = $("#ip-code"); if (ta) { ta.closest("details").open = true; ta.focus(); ta.select(); }
      toast("Bitte den markierten Code kopieren");
    }
  }
  /** Vorschau mit dem echten Plan: so sieht das mittlere Widget gerade aus (gleiche Regeln wie im Skript) */
  async function iphonePreview() {
    const now = new Date(), h = now.getHours() + now.getMinutes() / 60;
    const iso = h >= 21 ? addDays(today(), 1) : today(), word = h >= 21 ? "Morgen" : "Heute";
    const cur = h >= 21 ? "" : h < 14 ? "Mittag" : "Abend", past = h >= 14 && h < 21 ? "Mittag" : "";
    let w = null, d = null;
    for (const wk of weeks) { try { const x = withSwaps(await week(wk.id)); const y = x.days.find((z) => z.iso === iso); if (y) { w = x; d = y; break; } } catch (e) { /* Woche fehlt */ } }
    const dt = new Date(iso + "T12:00");
    const head = `<div class="ipw-h">${ICON_FORK}<b>${word} · ${DAYS[dt.getDay()]}, ${dt.getDate()}.${dt.getMonth() + 1}.</b></div>`;
    if (!d) return `<div class="ipw">${head}<div class="ipw-row"><div class="ipw-p now"><i class="bar" style="--c:var(--pumpkin-hi)"></i><div><small class="k">Kein Plan</small><b>${word} plant ihr selbst</b><span>Der Buddy plant Montag bis Freitag</span></div></div></div></div>`;
    const plates = ["Mittag", "Abend"].map((slot) => {
      const m = d.meals.find((x) => x.slot === slot), r = m && w.recipes[m.recipe];
      const away = !m && /auswärts/i.test(d.main || "") && String(d.main).toLowerCase().startsWith(slot.toLowerCase());
      const [t1, t2] = r ? (r.title.match(/^(.+?)\s((?:mit|aus|in|vom|&)\s.+)$/) || [0, r.title, ""]).slice(1) : [away ? "Auswärts essen" : "Nichts geplant", away ? "Heute wird nicht gekocht" : ""];
      const how = !m ? "" : m.mode === "aufwaermen" ? `${m.badge || "Vorgekocht"}, aufwärmen` : `Frisch kochen${r && r.time ? `, ${r.time.total} Min.` : ""}`;
      const c = r ? { meat: "#EE8B83", fish: "#86BFE8", veg: "#97D18A" }[tone(r.tags)] || "#A9C7B9" : "#A9C7B9";
      return `<div class="ipw-p${cur === slot ? " now" : ""}${past === slot ? " past" : ""}"><i class="bar" style="--c:${c}"></i><div><small class="k">${cur === slot ? `<i class="dot"></i>${slot} · jetzt` : slot}</small><b>${esc(t1)}</b>${t2 ? `<span>${esc(t2)}</span>` : ""}${how ? `<span>${esc(how)}</span>` : ""}</div></div>`;
    }).join("");
    return `<div class="ipw">${head}<div class="ipw-row">${plates}</div></div>`;
  }
  async function renderIphone(view) {
    if (!weeks.length) await loadIndex();
    const ios = isIOS(), t = ghToken();
    const here = `${location.origin}${location.pathname}${t ? `#/verbinden/${t}/iphone` : "#/iphone"}`;
    view.innerHTML = `<div class="r-topbar"><a class="back" href="#/" data-act="back" data-fallback="#/">${BACK}Zurück</a></div>
      <header class="top"><div><div class="eyebrow">Fürs iPhone</div><h1>Was gibt's heute?</h1></div></header>
      <section class="card ip-hero"><div id="ip-prev"></div>
        <p>Ein Widget auf dem Home- und Sperrbildschirm zeigt, was es heute mittags und abends gibt. Siri beantwortet „Was gibt's zu essen?“. Beides aktualisiert sich von selbst, wenn der Buddy den Plan ändert.</p></section>
      ${ios ? "" : `<section class="card ip-qr"><h2>Auf dem iPhone weitermachen</h2><p class="small">Die Einrichtung passiert am iPhone. Diesen Code mit der iPhone-Kamera scannen, dann öffnet sich diese Seite dort${t ? " – und das iPhone ist gleich mit den Tauschen verbunden" : ""}.</p><div class="qrbox" id="ip-qrbox"></div>${t ? `<p class="small muted">Der Code enthält den Schlüssel – nur mit euren eigenen iPhones scannen.</p>` : ""}</section>`}
      <ol class="ip-steps" id="ip-steps">
        <li><h3>Scriptable laden</h3><p>Scriptable ist eine kostenlose App ohne Werbung und ohne Konto. Sie zeigt das Kochbuddy-Widget an.</p>
          <div class="ip-btns"><a class="btn small" href="https://apps.apple.com/de/app/scriptable/id1405459188" target="_blank" rel="noopener">Im App Store öffnen</a></div></li>
        <li><h3>Kochbuddy-Skript anlegen</h3><p>„Code kopieren“ antippen, dann „Scriptable öffnen“. Es öffnet sich ein leeres Skript: lange ins Feld tippen und „Einfügen“ wählen. Oben auf „Untitled Script“ tippen, <b>Kochbuddy</b> eintragen, dann „Done“.</p>
          <div class="ip-btns"><button class="btn primary small" data-act="ip-copy">Code kopieren</button><a class="btn small" href="scriptable:///add">Scriptable öffnen</a></div>
          <details class="ip-code"><summary>Code ansehen</summary><textarea id="ip-code" readonly rows="9" spellcheck="false">${esc(IP_LOADER)}</textarea><p class="small muted">Diese paar Zeilen holen sich den eigentlichen Kochbuddy-Code. Verbesserungen kommen so von selbst aufs iPhone.</p></details></li>
        <li><h3>Widget auf den Home-Bildschirm</h3><p>Auf dem Home-Bildschirm eine freie Stelle lange drücken, „Bearbeiten“ und dann „Widget hinzufügen“. Scriptable suchen, die mittlere Größe wählen und hinzufügen. Danach das neue Widget lange drücken, „Widget bearbeiten“ und bei „Script“ <b>Kochbuddy</b> auswählen.</p>
          <p class="small muted">Für den Sperrbildschirm: Sperrbildschirm lange drücken, „Anpassen“, „Sperrbildschirm“, ins Widget-Feld tippen und Scriptable in der breiten Form wählen. Antippen und wieder <b>Kochbuddy</b> auswählen.</p></li>
        <li><h3>Siri fragen</h3><p>In der App „Kurzbefehle“ auf „+“ tippen, „Aktion hinzufügen“ und Scriptable wählen. Dort „Run Script“ nehmen und bei „Script“ <b>Kochbuddy</b> auswählen. Oben den Namen auf <b>Was gibt's zu essen</b> ändern und „Fertig“ tippen.</p>
          <p class="small muted">Ab dann reicht: „Hey Siri, was gibt's zu essen?“ Siri liest Mittag und Abend vor. Ab 14 Uhr sagt sie das Abendessen und schon den Mittag von morgen.</p></li>
        <li><h3>Tausche sofort anzeigen</h3>${t
          ? `<p>Ein Tipp verbindet das Widget mit den Tauschen aus der App. Dann stimmt es auch, wenn heute noch getauscht wird. Der Schlüssel bleibt im Schlüsselbund dieses iPhones.</p><div class="ip-btns"><a class="btn primary small" href="scriptable:///run/Kochbuddy?verbinden=${encodeURIComponent(t)}">Mit Tauschen verbinden</a></div>`
          : `<p>Damit ein Tausch von heute sofort im Widget steht, braucht dieses iPhone den Schlüssel der App. Am Tablet diese Seite öffnen (Woche, ganz unten „Aufs iPhone: Widget & Siri“) und den Code dort mit der iPhone-Kamera scannen. Dann steht hier der Knopf zum Verbinden.</p>`}
          <p class="small muted">Ohne diesen Schritt zeigt das Widget den Plan. Ein Tausch erscheint dann, sobald der Buddy ihn um 21 Uhr übernimmt.</p></li>
      </ol>
      <p class="small muted" style="margin:6px 2px 24px">Auf beiden iPhones einrichten, dann muss niemand mehr fragen. Das Widget aktualisiert sich etwa alle 30 Minuten und um 14 und 21 Uhr. Antippen öffnet den Kochbuddy, ein Tipp auf ein Gericht gleich das Rezept.</p>`;
    $("#ip-prev", view).innerHTML = await iphonePreview();
    if (!ios) { try { const qr = (await import("./vendor/qrcode.mjs")).default(0, "M"); qr.addData(here); qr.make(); $("#ip-qrbox", view).innerHTML = qr.createSvgTag({ cellSize: 5, margin: 3, scalable: true }); } catch (e) { $("#ip-qrbox", view).textContent = here; } }
  }

  async function renderVorrat(view) {
    view.innerHTML = `<header class="top"><div><div class="eyebrow" id="vr-count"></div><h1>Vorrat</h1></div></header>
      ${recSwitch("vorrat")}
      ${syncBanner()}
      <ul class="vr-list" id="vorrat-list"></ul><div id="vr-undo"></div>
      <form class="ek-add vr-add" data-vrform autocomplete="off"><input class="search" type="text" enterkeyhint="done" aria-label="Etwas anderes einfrieren" placeholder="Anderes einfrieren, z. B. Brot" data-vradd><button class="btn primary" aria-label="Einfrieren und Etikett drucken">${SNOW}</button></form>
      <p class="small muted" style="margin:2px 2px 0">Rezepte friert ihr am besten über die Schneeflocke im Rezept ein. Haltbarkeit: was das Rezept sagt, höchstens 3 Monate.</p>
      <section class="card prn-card" id="vr-printer"></section>`;
    drawVorrat(view);
    if (canBT()) loadNiim().catch(() => {});
  }
  document.addEventListener("submit", (e) => {
    const f = e.target;
    if (f.matches("[data-vrform]")) { e.preventDefault(); const i = $("[data-vradd]", f), v = i.value; i.value = ""; freezeOwn(v); }
    else if (f.matches("[data-vrename]")) {
      e.preventDefault();
      const id = f.dataset.vrename, it = vrItems()[id], t = (($("[data-vrname]", f) || {}).value || "").trim().slice(0, 60);
      if (!it || !t || t === it.t) return;
      vrOp({ op: "set", id, it: { t } }); vrRefresh(); vrSheet(id).then(() => toast("Geändert – „Etikett nochmal drucken“ druckt den neuen Namen"));
    }
  });

  /* ---------- Timer ---------- */
  const clock = (sec) => { sec = Math.max(0, Math.ceil(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`; };
  const remaining = (t) => (t.state === "pause" ? t.rem : t.state === "done" ? 0 : Math.max(0, (t.end - Date.now()) / 1000));
  const frac = (t) => { const r = remaining(t); return t.state === "done" ? 0 : Math.min(1, r / Math.max(t.total || 0, r, 1)); };
  function addTimer(o, quiet) {
    const t = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: o.title || "Timer", sub: o.sub || "", label: o.label || "", ctx: o.ctx || "",
      total: o.min, extra: o.max ? o.max - o.min : 0, end: o.endAt || Date.now() + o.min * 1000, state: "run" };
    S.timers.push(t);
    if (!quiet) { save(); scheduleTimers(); renderDock(); refreshLive(); updateWake(); }
    return t;
  }
  function startFromChip(data) {
    unlockAudio(); askNotify();
    addTimer(data);
    toast(`Timer läuft: ${durText(data)}`);
    rerenderSoft();
  }
  let tickHandle = null, timeouts = [];
  function scheduleTimers() {
    timeouts.forEach(clearTimeout); timeouts = [];
    for (const t of S.timers) if (t.state === "run") timeouts.push(setTimeout(tick, Math.max(0, t.end - Date.now()) + 30));
    if (!tickHandle) tickHandle = setInterval(tick, 500);
  }
  function tick() {
    let fired = false;
    for (const t of S.timers) if (t.state === "run" && Date.now() >= t.end) { t.state = "done"; t.firedAt = Date.now(); fired = true; }
    if (fired) { save(); showAlarm(); renderDock(); rerenderSoft(); updateWake(); }
    refreshLive();
    if (!S.timers.length && tickHandle) { clearInterval(tickHandle); tickHandle = null; }
  }
  function refreshLive() {
    for (const t of S.timers) {
      const p = frac(t).toFixed(4);
      $$(`[data-live="${t.id}"]`).forEach((el) => { el.style.setProperty("--p", p); $$("span", el).forEach((s) => (s.textContent = clock(remaining(t)))); });
      const pill = $(`#dock [data-timer-open="${t.id}"]`);
      if (pill) { pill.style.setProperty("--p", p); const tt = $(".tt", pill); if (tt) tt.textContent = t.state === "done" ? "Fertig" : clock(remaining(t)); }
    }
  }
  function renderDock() {
    const dock = $("#dock");
    const list = S.timers.filter((t) => t.state !== "gone");
    if (!list.length && !inCooking) { dock.hidden = true; document.documentElement.style.setProperty("--dock-h", "0px"); return; }
    dock.hidden = false;
    list.sort((a, b) => (a.state === "done" ? -1 : b.state === "done" ? 1 : remaining(a) - remaining(b)));
    dock.innerHTML = list.map((t) => `<button class="tpill ${t.state === "done" ? "done" : t.state === "pause" ? "paused" : ""}" data-timer-open="${t.id}" style="--p:${frac(t).toFixed(4)}">${ring("mini")}<span class="tt">${t.state === "done" ? "Fertig" : clock(remaining(t))}</span><span class="tl2">${esc(t.title)}<br>${esc(t.label || t.sub)}</span></button>`).join("") +
      `<button class="tpill add" data-act="new-timer">${CLOCK.replace("<svg", '<svg class="ico"')}<span>Eigener Timer</span></button>`;
    document.documentElement.style.setProperty("--dock-h", "62px");
  }
  function timerSheet(id) {
    const t = S.timers.find((x) => x.id === id);
    if (!t) return;
    openSheet(`<h2>${esc(t.title)}</h2><p class="muted" style="margin:4px 0 0">${esc(t.sub || t.label)}</p>
      <div class="dial${t.state === "pause" ? " paused" : ""}" data-live="${t.id}" style="--p:${frac(t).toFixed(4)}">${ring("big")}<span>${t.state === "done" ? "00:00" : clock(remaining(t))}</span><small>${t.state === "pause" ? "pausiert" : t.state === "done" ? "fertig" : "läuft"}</small></div>
      <p class="small muted presets-l">Minuten abziehen oder dazugeben</p><div class="presets"><button class="btn" data-tadd="-60">−1</button><button class="btn" data-tadd="60">+1</button><button class="btn" data-tadd="300">+5</button><button class="btn" data-tadd="600">+10</button></div>
      <div class="row" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${t.state === "run" ? '<button class="btn big" data-tact="pause">Pause</button>' : t.state === "pause" ? '<button class="btn big primary" data-tact="resume">Weiter</button>' : '<button class="btn big primary" data-tadd="60">+1 Min.</button>'}<button class="btn big pump" data-tact="stop">Stopp</button></div>`, { timer: id });
  }
  function adjustTimer(id, sec) {
    const t = S.timers.find((x) => x.id === id); if (!t) return;
    if (t.state === "pause") t.rem = Math.max(1, t.rem + sec);
    else if (t.state === "done") { t.state = "run"; t.end = Date.now() + Math.max(1, sec) * 1000; }
    else t.end = Math.max(Date.now() + 1000, t.end + sec * 1000);
    save(); scheduleTimers(); renderDock(); refreshLive(); dismissAlarmIfNone();
  }
  function timerAct(id, act) {
    const t = S.timers.find((x) => x.id === id); if (!t) return;
    if (act === "pause" && t.state === "run") { t.rem = remaining(t); t.state = "pause"; }
    else if (act === "resume" && t.state === "pause") { t.end = Date.now() + t.rem * 1000; t.state = "run"; }
    else if (act === "stop") S.timers = S.timers.filter((x) => x.id !== id);
    save(); scheduleTimers(); renderDock(); rerenderSoft(); updateWake(); dismissAlarmIfNone();
  }
  function newTimerSheet() {
    openSheet(`<h2>Eigener Timer</h2><p class="small muted presets-l">Minuten antippen – der Timer startet sofort</p><div class="presets">${[1, 3, 5, 8, 10, 12, 15, 20, 25, 30, 45, 60].map((m) => `<button class="btn" data-quick="${m}">${m}</button>`).join("")}</div>
      <div class="row"><input class="field" style="flex:1" type="number" inputmode="numeric" min="1" max="600" placeholder="Minuten" data-qmin><input class="field" style="flex:2" type="text" placeholder="Wofür? z. B. Nudeln" data-qlabel></div>
      <button class="btn primary big" style="margin-top:12px" data-act="quick-go">${PLAY}Starten</button><p class="small muted" style="margin:8px 0 0">Oder oben eine eigene Minutenzahl und wofür eintragen.</p>`);
  }

  /* ---------- Alarm ---------- */
  let audio = null, ringHandle = null, ringStarted = 0;
  function unlockAudio() {
    if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; } }
    if (audio && audio.state === "suspended") audio.resume();
  }
  function beep(times = 3) {
    if (!audio || !S.settings.sound) return;
    const t0 = audio.currentTime;
    for (let i = 0; i < times; i++) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = "square"; o.frequency.value = i % 2 ? 988 : 880;
      g.gain.setValueAtTime(0.0001, t0 + i * 0.22); g.gain.exponentialRampToValueAtTime(0.35, t0 + i * 0.22 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.22 + 0.17);
      o.connect(g).connect(audio.destination); o.start(t0 + i * 0.22); o.stop(t0 + i * 0.22 + 0.2);
    }
  }
  function showAlarm() {
    const due = S.timers.filter((t) => t.state === "done");
    const box = $("#alarm");
    if (!due.length) { box.hidden = true; stopRing(); return; }
    const t = due[0];
    const ago = Math.round((Date.now() - (t.firedAt || t.end)) / 60000);
    const late = Math.round((t.firedAt - t.end) / 60000);
    box.innerHTML = `<div class="alarm-art"><i></i><i></i>${ART.bell}</div><div class="eyebrow">${esc(t.title)}${t.label && t.sub ? " · " + esc(t.label) : ""}</div><h2>Zeit ist um</h2><p>${esc(t.sub || t.label)}</p>
      ${t.extra ? `<p style="font-weight:700">Jetzt prüfen – bei Bedarf noch bis zu ${Math.round(t.extra / 60)} Min.</p>` : ""}
      ${late > 1 ? `<p class="small">Abgelaufen um ${hm(t.end)} (vor ${Math.max(late, ago)} Min.)</p>` : ""}
      ${due.length > 1 ? `<p class="small">Noch ${due.length - 1} weitere(r) Timer fertig</p>` : ""}
      <div class="acts">${t.extra ? `<button class="btn" data-alarm="extra">+${Math.round(t.extra / 60)} Min.</button>` : `<button class="btn" data-alarm="1">+1 Min.</button>`}${t.extra && Math.round(t.extra / 60) !== 1 ? `<button class="btn" data-alarm="1">+1 Min.</button>` : `<button class="btn" data-alarm="5">+5 Min.</button>`}<button class="btn stop" data-alarm="off">Aus</button></div>`;
    box.dataset.id = t.id;
    box.hidden = false;
    startRing();
    if (document.visibilityState !== "visible") notify(t);
  }
  function startRing() {
    if (ringHandle) return;
    ringStarted = Date.now();
    const ring = () => {
      if (Date.now() - ringStarted > 180000) { stopRing(); return; } // nach 3 Min. still, Anzeige bleibt
      beep(3);
      if (S.settings.vibrate && navigator.vibrate) navigator.vibrate([400, 150, 400]);
    };
    ring(); ringHandle = setInterval(ring, 1600);
  }
  function stopRing() { if (ringHandle) { clearInterval(ringHandle); ringHandle = null; } if (navigator.vibrate) navigator.vibrate(0); }
  function dismissAlarmIfNone() { if (!S.timers.some((t) => t.state === "done")) { $("#alarm").hidden = true; stopRing(); } else showAlarm(); }
  async function notify(t) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const opts = { body: t.sub || t.label || "", tag: "timer-" + t.id, renotify: true, requireInteraction: true, vibrate: [500, 200, 500, 200, 800], icon: "icons/icon-192.png", badge: "icons/badge-96.png" };
    try { const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration()); if (reg) reg.showNotification(`⏰ ${t.title}: Zeit ist um`, opts); else new Notification(`⏰ ${t.title}: Zeit ist um`, opts); } catch (e) { /* egal */ }
  }
  function askNotify() { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {}); }

  /* ---------- Bildschirm an lassen ---------- */
  let wakeLock = null;
  async function updateWake() {
    const B = S.block[weekId];
    const want = inCooking || S.timers.some((t) => t.state === "run" || t.state === "done") || (B && B.start && !B.end && Date.now() - B.start < 4 * 3600000 && location.hash.startsWith("#/vorkochen"));
    if (want && !wakeLock && "wakeLock" in navigator && document.visibilityState === "visible") {
      try {
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock.addEventListener("release", () => { wakeLock = null; });
        const m = $(".cook-meta"); if (m && !m.querySelector(".wake")) m.insertAdjacentHTML("beforeend", '<span class="wake">Bildschirm bleibt an</span>');
      } catch (e) { wakeLock = null; }
    } else if (!want && wakeLock) { try { await wakeLock.release(); } catch (e) { /* schon weg */ } wakeLock = null; }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    tick(); updateWake();
    if (Date.now() - lastCheck > 60000) checkUpdates();
  });

  /* ---------- Schublade, Toast ---------- */
  function openSheet(html, data = {}) {
    const s = $("#sheet");
    s.innerHTML = `<div class="panel"><div class="grab"></div>${html}</div>`;
    s.dataset.timer = data.timer || "";
    s.dataset.swap = data.swap || "";
    s.dataset.tour = data.tour || "";
    s.dataset.bring = data.bring || "";
    s.dataset.review = data.review || "";
    s.dataset.note = data.note || "";
    s.dataset.news = data.news || "";
    s.dataset.ek = data.ek || "";
    s.dataset.ekid = data.ekid || "";
    stopCam();
    s.hidden = false;
  }
  const closeSheet = () => { stopCam(); $("#sheet").hidden = true; $("#sheet").innerHTML = ""; $("#sheet").dataset.review = ""; $("#sheet").dataset.note = ""; $("#sheet").dataset.news = ""; $("#sheet").dataset.ek = ""; $("#sheet").dataset.ekid = ""; };
  let toastT = null;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2200); }
  function rerenderSoft() { const y = window.scrollY; route().then(() => window.scrollTo(0, y)); }
  /* Checkliste: nach dem letzten Haken kurz das Häkchen zeigen, dann klappt die Liste zu */
  function clDone(el) {
    const card = el.closest(".card.cl");
    const full = card && [...card.querySelectorAll(".check")].every((x) => x.classList.contains("on"));
    if (full && !card.classList.contains("full")) { toast("Alles erledigt – Liste zugeklappt"); setTimeout(rerenderSoft, 450); }
    else rerenderSoft();
  }

  /* ---------- Klicks ---------- */
  document.addEventListener("click", async (e) => {
    unlockAudio();
    const tab = e.target.closest("#nav a");
    if (tab) { e.preventDefault(); tabTo(tab.getAttribute("href")); return; }
    let el = e.target.closest("[data-act],[data-start],[data-timer-open],[data-ing],[data-prep],[data-rem],[data-cl],[data-clfold],[data-tl],[data-go],[data-jump],[data-expand],[data-jumpday],[data-week],[data-portion],[data-tag],[data-alarm],[data-tadd],[data-tact],[data-quick],[data-swapopen],[data-swapto],[data-unswap],[data-dealcheck],[data-shopfilter],[data-bringopen],[data-bringmail],[data-bringdone],[data-swipe],[data-rerate],[data-star],[data-kid],[data-starskip],[data-notesave],[data-noteedit],[data-notedel],[data-ekedit],[data-ekinc],[data-ekopen],[data-freeze],[data-vprint],[data-vtake],[data-vopen],[data-density]");
    if (el && !el.closest("#view, #dock, #sheet, #alarm, #upd, #newsbar")) el = null; // nie den Seitenrahmen als Knopf werten
    if (!el) { if (e.target.id === "sheet") { if ($("#sheet").dataset.tour) endTour(); else if ($("#sheet").dataset.review) toast("Erst noch die Sterne vergeben – oder „Gab's nicht“ antippen"); else if ($("#sheet").dataset.news) newsEnd(false); else if (reviewList) drawReview(); else closeSheet(); } return; }
    const d = el.dataset, view = $("#view");
    if (d.start) { e.preventDefault(); startFromChip(JSON.parse(d.start)); return; }
    if (d.timerOpen) { e.preventDefault(); timerSheet(d.timerOpen); return; }
    if (d.ing != null) {
      const ref = view.dataset.ref || cookRef;
      const on = toggle("ing", inCooking ? cookRef : ref, d.ing);
      $$(`[data-ing="${d.ing}"]`).forEach((x) => x.classList.toggle("on", on));
      if (on && navigator.vibrate && S.settings.vibrate) navigator.vibrate(10);
      return;
    }
    if (d.prep != null) { el.classList.toggle("on", toggle("prep", inCooking ? cookRef : view.dataset.ref, d.prep)); return; }
    if (d.rem) { const [day, i] = d.rem.split(":"); el.classList.toggle("on", toggle("rem", `${weekId}:${day}`, i)); if (el.closest(".card.cl")) clDone(el); return; }
    if (d.cl) { const [i, j] = d.cl.split(":"); el.classList.toggle("on", toggle("check", `${weekId}:${i}`, j)); clDone(el); return; }
    if (d.clfold) { const open = el.closest(".card.cl").classList.toggle("folded") === false; clOpen[d.clfold] = open ? 1 : 0; el.setAttribute("aria-expanded", open); return; }
    if (d.tl != null) {
      const B = (S.block[weekId] = S.block[weekId] || {}); B.done = B.done || {}; if (B.done[d.tl]) delete B.done[d.tl]; else B.done[d.tl] = 1; save(); el.classList.toggle("on");
      const w = await week();
      if (!B.end && w.prep && Object.keys(B.done).length >= (w.prep.timeline || []).length) { B.end = Date.now(); blockTimers(false); save(); updateWake(); toast("Vorkochen fertig – super!"); window.scrollTo(0, 0); rerenderSoft(); }
      return;
    }
    if (d.go != null) { const ref = view.dataset.ref; S.cook[ref] = { ...(S.cook[ref] || { start: Date.now() }), step: +d.go }; cookRef = null; save(); navTo(`#/k/${ref}`, "push"); return; }
    if (d.jump != null) { cookStep = +d.jump; showList = false; S.cook[cookRef].step = cookStep; save(); drawCook(view, await getRecipe(cookRef), cookRef); window.scrollTo(0, 0); return; }
    if (d.expand) { if (!view.querySelector(`.today [data-expand="${d.expand}"]`)) { expanded[d.expand] = !expanded[d.expand]; rerenderSoft(); } return; }
    if (d.jumpday) {
      const id = d.jumpday, isToday = !!view.querySelector(`.today [data-expand="${id}"]`);
      if (!isToday) expanded[id] = true;
      const y = window.scrollY;
      await route(); window.scrollTo(0, y);
      const card = $(`#day-${id}`);
      if (card) { card.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); card.classList.add("flash"); setTimeout(() => card.classList.remove("flash"), 1200); }
      return;
    }
    if (d.week) { weekId = d.week; weekManual = d.week !== (pickWeek(weeks) || {}).id; rerenderSoft(); return; }
    if (d.portion) {
      const ref = view.dataset.ref, r = await getRecipe(ref);
      S.portions[ref] = Math.max(1, Math.min(12, portions(ref, r) + +d.portion)); save(); rerenderSoft(); return;
    }
    if (d.tag) { filter.tag = d.tag; $$("[data-tag]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tag === d.tag)); drawList(view); return; }
    if (d.alarm) {
      const id = $("#alarm").dataset.id, t = S.timers.find((x) => x.id === id);
      if (t) {
        if (d.alarm === "off") S.timers = S.timers.filter((x) => x.id !== id);
        else { const sec = d.alarm === "extra" ? t.extra : +d.alarm * 60; t.state = "run"; t.end = Date.now() + sec * 1000; t.extra = 0; }
        save(); scheduleTimers();
      }
      stopRing(); dismissAlarmIfNone(); renderDock(); rerenderSoft(); updateWake();
      return;
    }
    if (d.bringopen) { S.bringOpened = S.bringOpened || {}; S.bringOpened[d.bringopen] = 1; save(); setTimeout(rerenderSoft, 1200); return; }
    if (d.bringmail) { bringMailSheet(d.bringmail); return; }
    if (d.bringdone) { S.bringAck = S.bringAck || {}; S.bringAck[d.bringdone] = 1; save(); rerenderSoft(); updateNavDot(); toast("Prima – die Bring-Liste ist auf dem neuen Stand"); return; }
    if (d.swipe) { if (d.swipe === "undo") { if (swAnim) return; const id = undoRate(); if (id) { rerenderSoft(); toast("Zurückgenommen – nochmal bewerten"); } } else swDecide(d.swipe); return; }
    if (d.rerate) { const [id, v] = d.rerate.split("|"), pool = await tastePool(), it = pool.byId.get(id); if (it) { rate(it, v); rerenderSoft(); toast(`Geändert: ${VERDICT[v]}`); } return; }
    if (d.star) {
      const [slug, n] = d.star.split("|"), was = rating(slug).s;
      setStar(slug, { s: +n });
      if (!was) toast(`${n} ${+n === 1 ? "Stern" : "Sterne"} – danke!`);
      if ($("#sheet").dataset.review) drawReview(); else rerenderSoft();
      return;
    }
    if (d.kid) {
      if (!rating(d.kid).kind && S.settings.kidName == null && !embedded) { kidNameSheet(d.kid); return; }
      const on = !rating(d.kid).kind;
      setStar(d.kid, { kind: on }); justStamped = on ? d.kid : null;
      if (on) toast(`Gestempelt: für ${kidFor()} geeignet`);
      if ($("#sheet").dataset.review) drawReview(); else rerenderSoft();
      setTimeout(() => { justStamped = null; }, 900);
      return;
    }
    if (d.freeze) { e.preventDefault(); freezeRecipe(d.freeze); return; }
    if (d.vprint) { const [id, pick] = d.vprint.split("|"); if ($("#sheet").dataset.ek === "vprint") closeSheet(); doPrint(id, !!pick); return; }
    if (d.vtake) { if ($("#sheet").dataset.ek === "vorrat") closeSheet(); vrTake(d.vtake); return; }
    if (d.vopen) { vrSheet(d.vopen); return; }
    if (d.density) { S.settings.printDensity = +d.density; save(); vrRefresh(); toast(`Druckstärke ${d.density}`); return; }
    if (d.ekedit) { ekEditSheet(d.ekedit); return; }
    if (d.ekinc) { const [id, by] = d.ekinc.split("|"), it = ekView().items[id]; if (it) { ekOp({ op: "inc", id, by: +by, it: { n: it.n, key: it.key, d: it.d, ean: it.ean } }); buzz(8); ekRefresh(); if (+by < 0 && it.c <= 1) toast(`${it.n || "Artikel"} von der Liste genommen`); } return; }
    if (d.ekopen != null) { const B = ek().bring; if (B) { B.opened = 1; save(); setTimeout(ekRefresh, 1200); } return; }
    if (d.notesave) { saveNote(el); return; }
    if (d.noteedit != null) { const [slug, id] = d.noteedit.split("|"); delete noteDraft[slug]; if (id) noteEdit[slug] = id; else delete noteEdit[slug]; if ($("#sheet").dataset.note) cookNoteSheet(await getRecipe(cookRef)); else rerenderSoft(); setTimeout(() => { const t = $(`[data-notein="${slug}"]`); if (t && id) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }, 60); return; }
    if (d.notedel) { const [slug, id] = d.notedel.split("|"); const n = notesOf(slug).find((x) => x.id === id); putNote(slug, id, ""); lastDeleted = n ? { slug, n } : null; toast("Notiz gelöscht"); if ($("#sheet").dataset.note) cookNoteSheet(await getRecipe(cookRef)); else rerenderSoft(); return; }
    if (d.starskip) { const T = stars(); T.skip[d.starskip] = 1; save(); drawReview(); return; }
    if (d.swapopen) { swapSheet(d.swapopen); return; }
    if (d.swapto) { const id = $("#sheet").dataset.swap; closeSheet(); const [iso, slot] = d.swapto.split("|"); performSwap(id, iso, slot); return; }
    if (d.unswap) { unswap(d.unswap); return; }
    if (d.dealcheck) { const w0 = weeks[0]; el.classList.toggle("on", toggle("dealcheck", `kw${w0.kw}-${w0.year}`, d.dealcheck)); return; }
    if (d.shopfilter) { dealFilter = d.shopfilter; rerenderSoft(); return; }
    if (d.tadd) { adjustTimer($("#sheet").dataset.timer, +d.tadd); return; }
    if (d.tact) { timerAct($("#sheet").dataset.timer, d.tact); closeSheet(); return; }
    if (d.quick) { askNotify(); addTimer({ min: +d.quick * 60, title: "Timer", label: `${d.quick} Min.`, sub: $("[data-qlabel]") ? $("[data-qlabel]").value : "" }); closeSheet(); toast(`Timer ${d.quick} Min. läuft`); return; }
    switch (d.act) {
      case "back": e.preventDefault(); goBack(d.fallback || "#/"); break;
      case "gh-setup": e.preventDefault(); tokenSheet(); break;
      case "help": e.preventDefault(); showTour(0); break;
      case "tour-next": showTour(Math.min(TOUR.length - 1, tourStep + 1)); break;
      case "tour-back": showTour(Math.max(0, tourStep - 1)); break;
      case "tour-end": endTour(); break;
      case "hint-cook": S.settings.hintCook = 1; save(); drawCook(view, await getRecipe(cookRef), cookRef); break;
      case "bringmail-go": {
        const u = curBring(), addr = (($("[data-mailto]") || {}).value || "").trim();
        if (!u) break;
        if (addr) { S.settings.mailTo = addr; save(); }
        location.href = `mailto:${encodeURIComponent(addr).replace(/%40/g, "@")}?subject=${encodeURIComponent(u.subject)}&body=${encodeURIComponent(u.text)}`;
        closeSheet(); toast("Mail-App geöffnet – Mail abschicken, dann auf dem Handy den Link antippen"); break;
      }
      case "bringshare": { const u = curBring(); if (u && navigator.share) navigator.share({ title: u.subject, text: u.text }).catch(() => {}); break; }
      case "bringcopy": { const u = curBring(); if (u) { try { await navigator.clipboard.writeText(u.link); toast("Link kopiert"); } catch (er) { toast("Kopieren ging nicht – bitte „Mail-App öffnen“ nutzen"); } } break; }
      case "ek-cam": ekCamSheet(); break;
      case "vr-undo": vrUndo(); break;
      case "prn-connect": try { if (!canBT()) break; await printerConnect(true); toast(`Drucker verbunden${prnName ? ": " + prnName : ""}`); } catch (er) { toast(printErrText(er)); } break;
      case "prn-date": {
        if (!canBT()) break;
        const am = today();
        try { await printLabel({ nur: "datum", am }); toast(`Etikett mit ${dmy(am)} gedruckt`); } catch (er) { toast(printErrText(er)); }
        break;
      }
      case "prn-test": {
        if (!canBT()) break;
        const am = today(), it = { t: "Testetikett Rindergulasch", am, bis: addMonthsIso(am, 3), m: 3 };
        try { await printLabel(it); toast("Testetikett gedruckt"); } catch (er) { toast(printErrText(er)); }
        break;
      }
      case "ek-code": ekCodeSheet(); break;
      case "ek-ok": ekConfirm(); break;
      case "ek-save": ekSave(); break;
      case "ek-del": { const id = $("#sheet").dataset.ekid, it = ekView().items[id]; closeSheet(); if (it) { ekOp({ op: "del", id }); ekRefresh(); toast(`${it.n || "Artikel"} von der Liste genommen`); } break; }
      case "ek-bring": ekBringStart(el); break;
      case "ek-done": ekDone(); break;
      case "ek-cancel": e.preventDefault(); ekCancel(); break;
      case "ek-recheck": { const B = ek().bring; if (B) { B.status = "wait"; B.at = Date.now(); save(); ekRefresh(); ekPoll(); } break; }
      case "ek-mail": {
        const B = ek().bring; if (!B) break;
        openSheet(`<h2>Bring-Link per Mail</h2>
          <p class="small" style="margin:6px 0 10px">Schick dir den Link auf das Handy, auf dem Bring installiert ist. Dort in der Mail antippen – Bring öffnet sich mit der Einkaufsliste.</p>
          <label class="small" for="mailto"><b>An diese Adresse</b></label>
          <input class="field" id="mailto" type="email" inputmode="email" autocomplete="email" placeholder="name@beispiel.de" value="${esc(S.settings.mailTo || "")}" data-mailto>
          <p class="small muted" style="margin:6px 0 12px">Die Adresse bleibt nur auf diesem Gerät gespeichert.</p>
          <button class="btn primary big" data-act="bringmail-go">Mail-App öffnen</button>
          ${navigator.share ? `<button class="btn big" style="margin-top:8px" data-act="bringshare">Anders schicken, z. B. per WhatsApp</button>` : ""}
          <button class="btn ghost" style="margin-top:8px" data-act="bringcopy">Nur den Link kopieren</button>`, { bring: "ek" });
        break;
      }
      case "gh-save": saveToken(); break;
      case "gh-qr": e.preventDefault(); qrSheet(); break;
      case "ip-copy": copyLoader(); break;
      case "gh-remove": setGhToken(""); closeSheet(); rerenderSoft(); toast("Schlüssel entfernt – Tauschen ist hier aus"); break;
      case "sw-more": { const pool = await tastePool(); extraDeck(pool); rerenderSoft(); window.scrollTo(0, 0); break; }
      case "deals-retry": localStorage.removeItem(DEALS_KEY); rerenderSoft(); break;
      case "deals-render": el.disabled = true; renderDealPages().catch(() => toast("PDF-Seite ließ sich nicht anzeigen")); break;
      case "home": e.preventDefault(); navTo("#/", "jump"); break;
      case "cook-next": cookGo(1, true); break;
      case "cook-prev": cookGo(-1, false); break;
      case "cook-list": showList = !showList; drawCook(view, await getRecipe(cookRef), cookRef); window.scrollTo(0, 0); break;
      case "cook-restart": delete S.steps[cookRef]; delete S.ing[cookRef]; S.cook[cookRef] = { start: Date.now(), step: 0 }; cookStep = 0; save(); drawCook(view, await getRecipe(cookRef), cookRef); break;
      case "reset-recipe": { const ref = view.dataset.ref; ["steps", "ing", "prep", "cook"].forEach((k) => delete S[k][ref]); if (cookRef === ref) cookRef = null; save(); rerenderSoft(); toast("Zurückgesetzt"); break; }
      case "block-start": S.block[weekId] = { start: Date.now(), done: {}, beep: false }; save(); updateWake(); rerenderSoft(); break;
      case "block-finish": { const B = (S.block[weekId] = S.block[weekId] || {}); B.end = Date.now(); blockTimers(false); save(); updateWake(); toast("Vorkochen fertig – super!"); window.scrollTo(0, 0); rerenderSoft(); break; }
      case "block-reset": blockTimers(false); delete S.block[weekId]; save(); rerenderSoft(); break;
      case "new-timer": newTimerSheet(); break;
      case "quick-go": { const m = parseFloat(($("[data-qmin]") || {}).value); if (m > 0) { askNotify(); addTimer({ min: m * 60, title: ($("[data-qlabel]").value || "Timer").trim(), label: `${fmt(m)} Min.` }); closeSheet(); } break; }
      case "install": if (installEvt) { installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; rerenderSoft(); } break;
      case "notice": noticeOpen = !noticeOpen; el.classList.toggle("clamp", !noticeOpen); break;
      case "nohint": S.settings.installHint = false; save(); rerenderSoft(); break;
      case "reload": e.preventDefault(); { const r = await checkUpdates(true); toast(r === "offline" ? "Gerade kein Netz – du siehst den letzten Stand" : r === "changed" ? "Plan aktualisiert" : "Alles aktuell"); rerenderSoft(); } break;
      case "apply-update": location.reload(); break;
      case "cook-note": cookNoteSheet(await getRecipe(cookRef)); break;
      case "kidname": e.preventDefault(); kidNameSheet(null); break;
      case "kidname-save": kidNameDone((($("[data-kidname]") || {}).value || "").trim().slice(0, 14)); break;
      case "kidname-skip": kidNameDone(""); break;
      case "sync-now": { await loadAblage(); const ch = await syncAll(false); toast(pendingInfo().n ? "Noch nicht alles gespeichert – neuer Versuch folgt" : "Alles gespeichert"); if (ch || true) rerenderSoft(); break; }
      case "sheet-close": closeSheet(); break;
      case "news-next": showNews(newsStep + 1); break;
      case "news-back": showNews(newsStep - 1); break;
      case "news-show": newsShow(); break;
      case "news-done": newsEnd(true); break;
      case "news-end": newsEnd(false); break;
      case "msg-send": e.preventDefault(); sendMsg(); break;
      case "msg-all": e.preventDefault(); msgAllSheet(); break;
      case "msg-show": e.preventDefault(); { const c = $("#msg-card"); if (c) c.scrollIntoView({ behavior: "smooth", block: "start" }); msgMarkSeen(); const b = $(".msg-ban"); if (b) b.remove(); } break;
      case "news-open": e.preventDefault(); { const l = await loadNews(); if (l[0]) showNews(0, l[0]); } break;
      case "review-done": closeSheet(); reviewList = null; toast("Danke! Der Buddy plant künftig danach."); setTimeout(maybeNews, 900); break;
      case "review-demo": {
        e.preventDefault();
        const T = stars(), seen = new Map();
        for (const k of logKeys(T)) { const x = T.log[k], [iso, slot] = k.split("|"); if (x.wk === weekId && !seen.has(x.slug)) seen.set(x.slug, { slug: x.slug, title: x.t, tags: x.tags, iso, slot, wk: x.wk }); }
        reviewList = [...seen.values()]; if (reviewList.length) drawReview(); break;
      }
    }
  });

  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.eat) { S.eat[el.dataset.eat] = el.value; save(); getRecipe(el.dataset.eat).then((r) => ($("#plan-out").innerHTML = planText(r, el.value))); }
    if (el.dataset.act === "block-beep") { S.block[weekId].beep = el.checked; save(); unlockAudio(); askNotify(); blockTimers(el.checked); }
  });
  document.addEventListener("input", (e) => { if (e.target.dataset.search != null) { filter.q = e.target.value; drawList($("#view")); } if (e.target.dataset.notein) noteDraft[e.target.dataset.notein] = e.target.value; if (e.target.dataset.msgin != null) msgDraft = e.target.value; });

  /* ---------- Einstellungen anwenden, Installation ---------- */
  function applySettings() {
    const st = S.settings, dark = st.theme === "dark" || (st.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.scheme = dark ? "dark" : "light";
    document.documentElement.style.setProperty("--scale", st.scale);
    const meta = $('meta[name="theme-color"]'); if (meta) meta.content = dark ? "#0A1411" : "#EEF2EC";
  }
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applySettings);
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  let installEvt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; if (!location.hash || location.hash === "#/") rerenderSoft(); });
  window.addEventListener("appinstalled", () => { installEvt = null; toast("Installiert – du findest den Kochbuddy jetzt bei deinen Apps"); });

  /* ---------- Immer aktuell: Plan, Rezepte und App-Code vom GitHub-Repo ---------- */
  let lastCheck = 0, codeTag = null, updateReady = false, swReg = null, renderedDay = null, checking = null, lastOnline = 0;
  function online(v) { if (v) { lastOnline = Date.now(); const el = $("#stand"); if (el) week().then((w) => (el.innerHTML = standLine(w))).catch(() => {}); } return v; }
  async function codeVersion() {
    if (embedded) return null;
    try {
      const tags = await Promise.all(["app.js", "app.css", "index.html", "deals.mjs"].map((f) =>
        fetch(f, { method: "HEAD", cache: "no-cache" }).then((r) => (r.ok ? r.headers.get("etag") || r.headers.get("last-modified") || "" : ""))));
      return tags.join("|");
    } catch (e) { return null; }
  }
  const idle = () => !inCooking && $("#alarm").hidden && $("#sheet").hidden && !S.timers.some((t) => t.state !== "gone") && !location.hash.startsWith("#/vorkochen");
  function markUpdate() { updateReady = true; applyUpdateIfIdle(); }
  function applyUpdateIfIdle() {
    if (!updateReady) return;
    // Läuft gerade etwas (Timer, Kochmodus, Vorkochen), wird nicht ungefragt neu geladen – der Ton braucht nach einem Neuladen erst wieder einen Tipp.
    if (idle()) { location.reload(); return; }
    if (!$("#upd")) {
      const b = document.createElement("div");
      b.id = "upd"; b.className = "toast"; b.style.cursor = "pointer"; b.dataset.act = "apply-update";
      b.textContent = "Neue App-Version bereit – hier tippen zum Neuladen";
      document.body.appendChild(b);
    }
  }
  async function refreshData() {
    const key = weekId ? weekFile(weekId) : null;
    const before = JSON.stringify([weeks, key && memo[key]]);
    const old = { ...memo };
    Object.keys(memo).forEach((k) => delete memo[k]);
    try {
      await loadIndex(true);
      if (weekId) await week();
    } catch (e) { Object.assign(memo, old); throw e; }
    return before !== JSON.stringify([weeks, weekId && memo[weekFile(weekId)]]);
  }
  function checkUpdates(manual) {
    if (embedded) return Promise.resolve("same");
    if (checking) return checking;
    lastCheck = Date.now();
    checking = (async () => {
      let result = "same";
      const v = online(await codeVersion()); // geht direkt ans Netz – schlägt fehl, wenn das Handy offline ist
      try { if (await refreshData()) result = "changed"; } catch (e) { result = "offline"; }
      if (v) await loadAblage();
      if (v && (await syncSwaps(true))) result = "changed";
      if (v) syncTaste(true);
      if (v) syncStars(true).then((ch) => { if (ch && $("#sheet").dataset.review) { reviewList = null; maybeReview(); } });
      if (v) syncNotes(true);
      if (v) syncMsgs(true).then((ch) => { if (ch) softIfIdle(); });
      if (v) syncEinkauf(true).then((ch) => { if (ch) ekRefresh(); });
      if (v) syncVorrat(true).then((ch) => { if (ch) vrRefresh(); });
      if (v) syncLog();
      if (v) syncVerlauf();
      if (!v) result = result === "changed" ? "changed" : "offline";
      if (swReg && v) swReg.update().catch(() => {});
      if (v && codeTag && v !== codeTag) markUpdate();
      if (v && !codeTag) codeTag = v;
      const dayChanged = renderedDay && renderedDay !== today();
      if ((result === "changed" || dayChanged) && !manual) {
        if (!inCooking && $("#sheet").hidden && !(document.activeElement && /TEXTAREA|INPUT/.test(document.activeElement.tagName))) { rerenderSoft(); if (result === "changed") toast("Neuer Stand vom Speiseplan geladen"); }
      }
      return result;
    })().finally(() => { checking = null; });
    return checking;
  }

  /* ---------- Start ---------- */
  applySettings();
  if ("serviceWorker" in navigator && !embedded && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((r) => (swReg = r)).catch(() => {});
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController) markUpdate(); hadController = true; });
  }
  codeVersion().then((v) => { codeTag = v; online(v); });
  setInterval(() => { if (document.visibilityState === "visible") checkUpdates(); }, 10 * 60000);
  for (const t of S.timers) if (t.state === "run" && Date.now() >= t.end) { t.state = "done"; t.firedAt = Date.now(); }
  save();
  const ablageP = loadAblage();
  ablageP.then(() => syncSwaps(true)).then((ch) => { if (ch) softIfIdle(); });
  ablageP.then(() => syncTaste(true)).then((ch) => { if (ch && location.hash.startsWith("#/entdecken") && !swAnim) rerenderSoft(); });
  const starsFirst = () => { if (starsReady) return; starsReady = true; reviewList = null; maybeReview(); };
  ablageP.then(() => syncStars(true)).then((ch) => { if (ch) softIfIdle(); starsFirst(); }, starsFirst);
  setTimeout(starsFirst, 6000);
  ablageP.then(() => syncNotes(true)).then((ch) => { if (ch) softIfIdle(); });
  ablageP.then(() => syncEinkauf(true)).then((ch) => { if (ch) ekRefresh(); });
  ablageP.then(() => syncVorrat(true)).then((ch) => { if (ch) vrRefresh(); });
  if (S.einkauf && S.einkauf.bring && S.einkauf.bring.status === "wait") setTimeout(ekPoll, 3000);
  ablageP.then(() => setTimeout(syncLog, 5000));
  ablageP.then(() => syncVerlauf()).then((ch) => { if (ch) softIfIdle(); });
  ablageP.then(() => { if (ablage.privat) softIfIdle(); });
  route().then(() => {
    if (!S.settings.toured && !embedded && $("#alarm").hidden) setTimeout(() => { if ($("#sheet").hidden) showTour(0); }, 500); if (S.timers.length) { scheduleTimers(); if (S.timers.some((t) => t.state === "done")) showAlarm(); } });
  // Live-Anzeige im Vorkoch-Block jede halbe Minute auffrischen
  setInterval(() => { if (location.hash.startsWith("#/vorkochen") && S.block[weekId] && !S.block[weekId].end && !$("details.tl-fold") && $("#sheet").hidden) rerenderSoft(); }, 30000);
})();
