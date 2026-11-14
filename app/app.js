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
  const HEADS = ["käse", "öl", "brühe", "nudeln", "sahne", "milch", "mehl", "zucker", "essig", "saft", "mark", "pulver", "senf", "butter", "quark", "salz", "pfeffer", "tomaten", "reis", "salat"];
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
  function ingsForStep(r, text) {
    const t = " " + (text || "").toLowerCase() + " ";
    const hit = [];
    r.ingredients.forEach((ing, i) => {
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
    if (run) return `<button class="timer-chip running" data-timer-open="${run.id}" data-live="${run.id}">${CLOCK}<span>${clock(remaining(run))}</span></button>`;
    return `<button class="timer-chip" data-start='${esc(JSON.stringify(t))}'>${CLOCK}<span>${esc(durText(t))}${t.label ? " · " + esc(t.label) : ""}</span></button>`;
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
      navTo("#/", "replace"); return;
    }
    if (parts[0] && !["r", "k", "vorkochen", "checkliste", "angebote", "rezepte"].includes(parts[0])) { navTo("#/", "replace"); return; }
    const nav = { "": "woche", r: "woche", vorkochen: "vorkochen", checkliste: "checkliste", angebote: "angebote", rezepte: "rezepte" }[parts[0] || ""] ?? "";
    $$("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.nav === nav));
    try {
      if (!weeks.length) await loadIndex();
      if (!parts.length) await renderWeek(view);
      else if (parts[0] === "r") await renderRecipe(view, parts[1]);
      else if (parts[0] === "k") await renderCook(view, parts[1]);
      else if (parts[0] === "vorkochen") await renderPrep(view);
      else if (parts[0] === "checkliste") await renderChecklist(view);
      else if (parts[0] === "angebote") await renderDeals(view);
      else if (parts[0] === "rezepte") await renderAll(view);
      else await renderWeek(view);
    } catch (e) {
      view.innerHTML = `<div class="top"><h1>Kochbuddy</h1></div><div class="card"><h2>Gerade nicht ladbar</h2><p class="muted">Ohne Internet zeigt die App die zuletzt geöffneten Daten. Diese hier waren noch nicht gespeichert.</p><p class="small muted">${esc(e.message)}</p><button class="btn primary" data-act="reload">Nochmal versuchen</button></div>`;
    }
    updateWake();
    renderDock();
    if (!embedded) updateNavDot();
  }
  window.addEventListener("hashchange", () => { trackNav(); route().then(() => { if (updateReady) applyUpdateIfIdle(); }); if (!inCooking) window.scrollTo(0, 0); });

  /* Verlauf innerhalb der App: "Zurück" (auch die Android-Zurücktaste) landet dort, wo man herkam.
     Tabs stapeln sich nicht: Woche -> Vorkochen -> Checkliste, dann Zurück = Woche, nochmal Zurück = App zu. */
  const TABS = ["#/", "#/vorkochen", "#/checkliste", "#/angebote", "#/rezepte"];
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
    let html = `<header class="top"><div><div class="eyebrow">KW ${w.week.kw} · Speiseplan</div><h1>${esc(shortLabel(w))}</h1></div></header>`;
    if (weeks.length > 1) {
      html += `<div class="seg" role="group" aria-label="Woche wählen">${weeks.slice().reverse().map((x) =>
        `<button data-week="${x.id}" aria-pressed="${x.id === weekId}">KW ${x.kw}</button>`).join("")}</div>`;
    }
    html += actionBanners(ups);
    if (installEvt && S.settings.installHint && !standalone()) {
      html += `<div class="banner"><p>Als App auf dem Handy installieren?</p><button class="btn small" data-act="install">Installieren</button><button class="icon-btn" style="width:40px;height:40px;background:transparent;border:0;color:inherit" data-act="nohint" aria-label="Ausblenden">${CLOSE}</button></div>`;
    }
    if (embedded) html += `<div class="banner" style="background:var(--readout);color:var(--readout-ink)"><p style="font-weight:400">Vorschau im Claude-Fenster. Als installierte App auf dem Handy laufen Alarmton, Benachrichtigung und „Bildschirm bleibt an“ zuverlässig.</p></div>`;
    if (w.notice) html += `<div class="notice${noticeOpen ? "" : " clamp"}" data-act="notice"><span>${esc(w.notice)}</span></div>`;
    if (isPrepDay && w.prep && w.prep.timeline) {
      html += `<a class="card today" style="display:block;text-decoration:none;color:inherit" href="#/vorkochen"><div class="eyebrow">Heute · Sonntag</div><h2>${esc(w.prep.title || "Vorkoch-Block")}</h2><p class="muted">${esc(w.prep.when || "")}</p><span class="btn primary" style="margin-top:6px">Vorkochen starten</span></a>`;
    }
    const ordered = todayDay ? [todayDay, ...w.days.filter((d) => d !== todayDay && d.iso > t), ...w.days.filter((d) => d !== todayDay && d.iso < t)] : w.days;
    if (todayDay) html += dayCard(w, todayDay, true);
    const ev = currentEvening(w);
    if (ev && t >= addDays(w.week.start, -1) && t <= addDays(w.week.start, 5)) {
      const done = Object.keys(bag("check", `${weekId}:${ev.i}`)).length;
      html += `<a class="card" style="display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit" href="#/checkliste"><div style="flex:1"><div class="eyebrow">Heute Abend ${esc(ev.e.for || "")}</div><b>${done}/${ev.e.items.length} vorbereitet</b>${ev.e.tag ? ` <span class="chip pump">${esc(ev.e.tag)}</span>` : ""}</div><span class="muted">›</span></a>`;
    }
    const rest = ordered.filter((d) => d !== todayDay);
    if (rest.length) html += `<div class="section-title">${todayDay ? "Weitere Tage" : "Die Woche"}</div>` + rest.map((d) => dayCard(w, d, !!expanded[d.id], d.iso < t)).join("");
    if (w.extras && w.extras.length) {
      const canDrop = !embedded && w.days.some((d) => d.meals.some((m) => slotOpen(d.iso, m.slot)));
      html += `<div class="section-title">Ersatzgerichte</div><div class="card">${w.extrasIntro ? `<p class="muted small" style="margin-top:0">${esc(w.extrasIntro)}</p>` : ""}`;
      if (canDrop) html += `<p class="small" style="margin:0 0 10px"><b>Tauschen:</b> Griff <span aria-hidden="true">⠿</span> festhalten und auf einen Tag ziehen – oder „Tauschen“ antippen.</p>`;
      html += `<ul class="r-list" style="margin:0">${w.extras.map((id) => {
        const r = w.recipes[id];
        return r ? `<li class="xitem">${canDrop ? `<span class="grip" data-grip="${id}" role="button" aria-label="${esc(r.title)} auf einen Tag ziehen">⠿</span>` : ""}<a href="#/r/w:${weekId}:${id}"><b>${esc(r.title)}</b><span class="chips">${tagChips(r.tags, 2)}<span class="chip plain">${r.time.total} Min.</span></span></a>${canDrop ? `<button class="btn small" data-swapopen="${id}">Tauschen</button>` : ""}</li>` : "";
      }).join("")}</ul>`;
      if (canDrop) html += `<p class="small muted" style="margin:12px 0 0">${ghToken() ? `Tauschen ist eingerichtet · <a href="#" data-act="gh-qr">Weiteres Gerät verbinden</a>` : `<a href="#" data-act="gh-setup">Tauschen auf diesem Gerät einrichten</a>`}</p>`;
      html += `</div>`;
    }
    html += `<p class="small muted" id="stand" style="text-align:center;margin:22px 0 0">${standLine(w)}</p>`;
    html += `<p class="small" style="text-align:center;margin:8px 0 0"><a href="#" data-act="help">So funktioniert der Kochbuddy</a></p>`;
    view.innerHTML = html;
    renderedDay = today();
  }
  function standLine(w) {
    if (embedded) return "Vorschau-Stand";
    const b = (w && w.built) || builtAt;
    const bt = b ? new Date(b) : null;
    const plan = bt && !isNaN(bt) ? `Plan vom ${DAYS[bt.getDay()].slice(0, 2)} ${pad(bt.getDate())}.${pad(bt.getMonth() + 1)}., ${hm(bt)}` : "Plan";
    return `${plan} · ${lastOnline ? `zuletzt geprüft ${hm(lastOnline)}` : "noch nicht online geprüft"} · <a href="#" data-act="reload">jetzt aktualisieren</a>`;
  }
  function dayCard(w, d, open, past) {
    const isToday = d.iso === today();
    const rem = bag("rem", `${weekId}:${d.id}`);
    let h = `<section class="card${isToday ? " today" : ""}${open ? "" : " compact"}" ${past && !open ? 'style="opacity:.62"' : ""}>`;
    h += `<div class="day-h" data-expand="${d.id}"><h2>${esc(d.name)}${isToday ? ' <span class="chip">Heute</span>' : ""}</h2><span class="date">${esc(d.date)}${isToday ? "" : open ? " ▴" : " ▾"}</span></div>`;
    if (open && d.reminders && d.reminders.length) {
      h += `<ul class="checks small" style="margin:6px 0 4px">${d.reminders.map((x, i) => checkRow(rem[i], esc(x), `data-rem="${d.id}:${i}"`)).join("")}</ul>`;
    }
    for (const m of d.meals) {
      const r = w.recipes[m.recipe];
      if (!r) continue;
      const ref = `w:${weekId}:${m.recipe}`;
      const prog = progress(ref, r);
      h += `<div class="meal"${!embedded && slotOpen(d.iso, m.slot) ? ` data-drop="${d.iso}|${esc(m.slot)}"` : ""}><span class="slot">${esc(m.slot)}${m.kind === "haupt" ? " · Hauptmahlzeit" : ""}</span>
        <a href="#/r/${ref}" style="color:inherit;text-decoration:none"><b>${esc(r.title)}</b></a>
        <span class="chips">${m._swap ? `<span class="chip pump">${m._swap.status === "offen" ? "Getauscht · Übernahme 21 Uhr" : "Getauscht"}</span>${m._swap.status === "offen" ? `<button class="btn small ghost" style="min-height:30px" data-unswap="${m._swap.id}">Rückgängig</button>` : ""}` : ""}${m.badge ? `<span class="chip pump">${esc(m.badge)}</span>` : ""}${m.mode === "aufwaermen" ? "" : `<span class="chip plain">${r.time.total} Min. · aktiv ${r.time.active}</span>`}${prog ? `<span class="chip">${prog}</span>` : ""}</span>`;
      if (open) {
        if (m.note) h += `<p class="note">${esc(m.note)}</p>`;
        const nts = m.mode === "aufwaermen" ? noteTimers(m.note) : [];
        h += `<div class="go">${nts.map((x, i) => timerChip({ min: x.min, max: x.max, text: x.text, label: x.label, title: shortTitle(r.title), sub: "Aufwärmen", ctx: `${ref}:n${i}` }, `${ref}:n${i}`)).join("")}
          <a class="btn small${m.mode === "aufwaermen" ? "" : " primary"}" href="#/${m.mode === "aufwaermen" ? "r" : "k"}/${ref}">${m.mode === "aufwaermen" ? "Rezept" : prog ? "Weiterkochen" : "Kochen"}</a></div>`;
      }
      h += `</div>`;
    }
    return h + `</section>`;
  }
  function progress(ref, r) {
    const n = Object.keys(S.steps[ref] || {}).length;
    if (!n) return "";
    return n >= r.steps.length ? "Gekocht ✓" : `Schritt ${n}/${r.steps.length}`;
  }
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
    let h = `<a class="back" href="${fromWeek ? "#/" : "#/rezepte"}" data-act="back" data-fallback="${fromWeek ? "#/" : "#/rezepte"}">‹ Zurück</a>`;
    h += `<div class="r-head"><h1>${esc(r.title)}</h1><div class="chips">${tagChips(r.tags, 6)}</div></div>`;
    h += `<div class="facts"><div class="fact"><b>${r.time.total}</b><span>Min. gesamt</span></div><div class="fact"><b>${r.time.active}</b><span>Min. aktiv</span></div><div class="fact"><b>${r.steps.length}</b><span>Schritte</span></div></div>`;
    h += `<div class="r-cols"><div class="sticky">`;
    h += `<a class="btn primary big" href="#/k/${ref}">${nDone && nDone < r.steps.length ? `Weiterkochen · Schritt ${nDone + 1}` : nDone ? "Nochmal kochen" : "Kochmodus starten"}</a>`;
    h += `<div class="card plan"><div class="line"><span><b>Essen um</b></span><input type="time" value="${esc(eat)}" data-eat="${esc(ref)}"></div><div class="line" id="plan-out">${planText(r, eat)}</div><p class="small muted" style="margin:0">Uhrzeit eintragen, dann rechnet die App aus, wann du anfangen musst.</p></div>`;
    h += `<div class="card"><div class="spread"><h3>Zutaten</h3><div class="stepper"><button data-portion="-1" aria-label="Weniger">−</button><output>${p} Port.</output><button data-portion="1" aria-label="Mehr">+</button></div></div>`;
    if (p !== (r.base || 3)) h += `<p class="small muted">Umgerechnet von ${r.base} Portionen. Garzeiten und die Füllmenge im Mixtopf (max. 2 l) im Blick behalten.</p>`;
    else if (r.servingsNote) h += `<p class="small muted">${esc(r.servingsNote)}</p>`;
    h += `<ul class="checks ing">${r.ingredients.map((i, n) => checkRow(ing[n], `<span class="q">${esc(amount(i, k))}</span><span>${esc(i.n)}</span>`, `data-ing="${n}"`)).join("")}</ul></div>`;
    h += `</div><div>`;
    if (r.prep && r.prep.length) h += `<div class="card"><h3>Vorbereiten</h3><ul class="checks">${r.prep.map((x, n) => checkRow(pre[n], esc(x), `data-prep="${n}"`)).join("")}</ul></div>`;
    h += `<div class="card"><h3>Zubereitung</h3><ol class="steps-list">${r.steps.map((st, n) => {
      const ph = phaseOf(st.t);
      return `<li class="${steps[n] ? "done" : ""}" data-go="${n}">${ph.phase ? `<span class="phase">${esc(ph.phase)}</span><br>` : ""}<span class="stxt">${esc(ph.text)}</span>${readout(st)}${stepTimers(st).length ? `<div class="chips" style="margin-top:8px">${stepTimers(st).map((t) => `<span class="chip pump">⏱ ${esc(durText(t))}</span>`).join("")}</div>` : ""}</li>`;
    }).join("")}</ol></div>`;
    if (r.kid) h += `<div class="tip"><h3>Fürs Kind</h3><p style="margin:0">${esc(r.kid)}</p></div>`;
    if (r.store) h += `<div class="card"><h3>Aufbewahren & Varianten</h3><p style="margin:6px 0 0">${esc(r.store)}</p></div>`;
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
      return `<span>Schon knapp: jetzt starten, fertig ca.</span><span class="big-time">${hm(now + total)}</span>`;
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
    let h = `<div class="cook-top"><a class="icon-btn" href="#/r/${esc(ref)}" data-act="back" data-fallback="#/r/${esc(ref)}" aria-label="Kochmodus beenden">${CLOSE}</a><div class="ttl"><b>${esc(r.title)}</b><span>${i < n ? `Schritt ${i + 1} von ${n}` : "Fertig"} · ${doneCount}/${n} erledigt</span></div><button class="icon-btn" data-act="cook-list" aria-label="Alle Schritte">${LIST}</button></div>`;
    h += `<div class="progress"><i style="width:${(doneCount / n) * 100}%"></i></div>`;
    if (showList) {
      h += `<div class="card"><h3>Alle Schritte</h3><ol class="steps-list">${r.steps.map((st, x) => `<li class="${steps[x] ? "done" : ""}" data-jump="${x}"><span class="stxt">${esc(phaseOf(st.t).text)}</span>${st.set ? `<div class="small muted">${esc(DEV_SHORT[st.dev] || "")} · ${esc(st.set)}</div>` : ""}</li>`).join("")}</ol></div>`;
      h += `<div class="card"><h3>Alle Zutaten</h3><ul class="checks ing">${r.ingredients.map((x, m) => checkRow(ing[m], `<span class="q">${esc(amount(x, k))}</span><span>${esc(x.n)}</span>`, `data-ing="${m}"`)).join("")}</ul></div>`;
      view.innerHTML = h + cookFoot(i, n, true);
      return;
    }
    if (i >= n) {
      h += `<div class="done-hero"><div class="big">🍽</div><h1>Fertig – guten Appetit!</h1><p class="muted">${c.start ? `Gekocht in ${Math.max(1, Math.round((Date.now() - c.start) / 60000))} Min.` : ""}</p></div>`;
      if (r.kid) h += `<div class="tip"><h3>Fürs Kind</h3><p style="margin:0">${esc(r.kid)}</p></div>`;
      if (r.store) h += `<div class="card"><h3>Aufbewahren</h3><p style="margin:6px 0 0">${esc(r.store)}</p></div>`;
      h += `<div class="links"><a class="btn primary" href="#/" data-act="home">Zur Woche</a><button class="btn ghost" data-act="cook-restart">Von vorn</button></div>`;
      view.innerHTML = h + cookFoot(i, n);
      return;
    }
    const st = r.steps[i], ph = phaseOf(st.t);
    const timers = stepTimers(st);
    const hits = ingsForStep(r, st.t);
    h += cookHint();
    h += `<div class="cook-cols"><div class="cook-step">`;
    h += `<div class="num">SCHRITT ${i + 1}${steps[i] ? " · ERLEDIGT" : ""}</div>${ph.phase ? `<span class="phase" style="margin-top:8px">${esc(ph.phase)}</span>` : ""}`;
    h += `<p class="stxt">${esc(ph.text)}</p>${readout(st)}`;
    if (timers.length) h += `<div class="cook-timers">${timers.map((t, x) => timerChip({ min: t.min, max: t.max, text: t.text, label: t.label, title: shortTitle(r.title), sub: `Schritt ${i + 1}: ${excerpt(t.main ? ph.text : t.label + " – " + ph.text)}`, ctx: `${ref}:${i}:${x}` }, `${ref}:${i}:${x}`)).join("")}</div>`;
    h += `</div><div>`;
    if (hits.length) {
      h += `<div class="card cook-ings"><h3>In diesem Schritt</h3><p class="small muted" style="margin:2px 0 4px">Abhaken, was schon drin ist.</p><ul class="checks ing">${hits.map((m) => checkRow(ing[m], `<span class="q">${esc(amount(r.ingredients[m], k))}</span><span>${esc(r.ingredients[m].n)}</span>`, `data-ing="${m}"`)).join("")}</ul></div>`;
    }
    const left = r.ingredients.length - Object.keys(ing).length;
    h += `<button class="btn ghost small" data-act="cook-list" style="margin-top:4px">Alle Zutaten & Schritte${left > 0 ? ` · ${left} Zutaten offen` : ""}</button>`;
    h += `<div class="cook-meta"><span>${c.start ? `Gestartet ${hm(c.start)} · geplant fertig ${hm(c.start + r.time.total * 60000)}` : ""}</span>${wakeLock ? '<span class="wake">Bildschirm bleibt an</span>' : ""}</div>`;
    h += `</div></div>`;
    view.innerHTML = h + cookFoot(i, n);
  }
  const cookFoot = (i, n, list) => `<div class="cook-foot"><div class="in">${list
    ? `<button class="btn big" data-act="cook-list" style="grid-column:1/-1">Zurück zum Schritt</button>`
    : i >= n ? `<button class="btn big" data-act="cook-prev" style="grid-column:1/-1">‹ Letzter Schritt</button>`
    : `<button class="btn big" data-act="cook-prev" ${i === 0 ? "disabled" : ""}>‹ Zurück</button><button class="btn big primary" data-act="cook-next">${i === n - 1 ? "Erledigt · fertig" : "Erledigt · weiter ›"}</button>`}</div></div>`;
  async function cookGo(delta, markDone) {
    const r = await getRecipe(cookRef);
    if (markDone) { bag("steps", cookRef)[cookStep] = 1; }
    cookStep = Math.max(0, Math.min(r.steps.length, cookStep + delta));
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
    if (p.when) h += `<p class="muted" style="margin:0 0 6px;font-weight:700">${esc(p.when)}</p>`;
    if (p.intro) h += `<p>${esc(p.intro)}</p>`;
    h += `<div class="card">`;
    if (!B.start) h += `<button class="btn primary big" data-act="block-start">Jetzt mit dem Vorkochen starten</button><p class="small muted" style="margin:8px 0 0">Die Zeitleiste bekommt dann echte Uhrzeiten, der aktuelle Schritt wird markiert.</p>`;
    else {
      h += `<div class="spread"><div><div class="eyebrow">Gestartet ${hm(B.start)}</div><b>${nextI >= 0 ? `Als Nächstes um ${hm(B.start + off(p.timeline[nextI].t))} (in ${Math.max(0, Math.ceil((B.start + off(p.timeline[nextI].t) - Date.now()) / 60000))} Min.)` : "Letzter Schritt erreicht"}</b></div><button class="btn small ghost" data-act="block-reset">Neu starten</button></div>`;
      h += `<div class="set-row"><span>Bei jedem Zeitpunkt erinnern</span><label class="switch"><input type="checkbox" data-act="block-beep" ${B.beep ? "checked" : ""}><span></span></label></div>`;
    }
    h += `<ul class="tl" style="margin-top:8px">${p.timeline.map((x, i) => `<li class="${i === cur ? "now" : ""}${B.done && B.done[i] ? " on" : ""}" data-tl="${i}"><span class="at">${B.start ? hm(B.start + off(x.t)) + `<small>+${esc(x.t)}</small>` : esc(x.t)}</span><span class="tx">${esc(x.text)}</span></li>`).join("")}</ul></div>`;
    if (p.recipes && p.recipes.length) {
      h += `<div class="section-title">Rezepte im Vorkoch-Block</div><ul class="r-list">${p.recipes.map((id) => {
        const r = w.recipes[id]; return r ? `<li><a href="#/r/w:${weekId}:${id}"><b>${esc(r.title)}</b><span class="small muted">${esc(p.recipeNote || "")}</span></a></li>` : "";
      }).join("")}</ul>`;
    }
    if (p.storage && p.storage.length) {
      h += `<div class="section-title">Was wohin kommt</div><div class="card"><table class="storage">${p.storage.map((s) => `<tr><td>${esc(s.what)}</td><td>${esc(s.where)}<div class="small muted">${esc(s.until || "")}</div></td></tr>`).join("")}</table></div>`;
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

  /* ---------- Abend-Checkliste ---------- */
  async function renderChecklist(view) {
    const w = await week();
    const c = w.checklist || {};
    const cur = currentEvening(w);
    let h = `<header class="top"><div><div class="eyebrow">KW ${w.week.kw}</div><h1>${esc(c.title || "Abend-Checkliste")}</h1></div></header>`;
    if (c.intro) h += `<p class="muted">${esc(c.intro)}</p>`;
    const evs = (c.evenings || []).map((e, i) => ({ e, i }));
    if (cur) evs.sort((a, b) => (a.i === cur.i ? -1 : b.i === cur.i ? 1 : 0));
    h += evs.map(({ e, i }) => {
      const b = bag("check", `${weekId}:${i}`);
      const n = Object.keys(b).length;
      return `<section class="card${cur && cur.i === i ? " today" : ""}"><div class="spread"><div><h2>${esc(e.day)}${cur && cur.i === i ? ' <span class="chip">Heute</span>' : ""}</h2><div class="muted small" style="font-weight:700">${esc(e.for || "")} · ${n}/${e.items.length}</div></div>${e.tag ? `<span class="chip pump">${esc(e.tag)}</span>` : ""}</div>
        <ul class="checks" style="margin-top:6px">${e.items.map((x, j) => checkRow(b[j], esc(x), `data-cl="${i}:${j}"`)).join("")}</ul>${e.note ? `<p class="small muted" style="margin:6px 0 0">${esc(e.note)}</p>` : ""}</section>`;
    }).join("");
    if (!evs.length) h += `<p class="empty">Keine Checkliste in diesem Plan.</p>`;
    view.innerHTML = h;
  }

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
  function actionBanners(ups) {
    shownUpdates = ups;
    let h = "";
    for (const u of ups) {
      const adds = u.add || [], rem = u.remove || [];
      const opened = S.bringOpened && S.bringOpened[u.key];
      h += `<section class="act">
        <div class="act-h"><span class="act-ico">${ICON_CART}</span><div><b>Bring-Liste aktualisieren</b><div class="small">Der Wochenplan wurde ${esc(whenText(u.at))} geändert.</div></div></div>
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
    const open = swapsFor(weekId).filter((s) => s.status === "offen");
    if (open.length) {
      const late = new Date().getHours() >= 23;
      h += `<section class="act info"><div class="act-h"><span class="act-ico">${ICON_WAIT}</span><div><b>${open.length === 1 ? "1 Tausch" : open.length + " Tausche"} – wird ${late ? "morgen Abend" : "heute Abend"} übernommen</b>
        <div class="small">Gegen 21 Uhr passt der Buddy Plan, PDF und Einkaufsliste an und schickt eine kurze Mail. Danach steht hier, was neu in Bring muss. Bis dahin kannst du den Tausch beim Gericht rückgängig machen.</div></div></div>
        ${open.map((s) => `<div class="small" style="margin-top:4px">· ${esc(s.dayName)} ${esc(s.slot)}: ${esc(shortTitle(s.toTitle))} statt ${esc(shortTitle(s.fromTitle))}</div>`).join("")}</section>`;
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
  function bringText(u) {
    const lines = ["Hallo,", "", "nach der Änderung im Wochenplan kommen diese Zutaten dazu:", ...(u.add || []).map((x) => `- ${x.n}${x.q ? ` (${x.q})` : ""}`)];
    if ((u.remove || []).length) lines.push("", "Wird nicht mehr gebraucht: " + u.remove.map((x) => x.n).join(", "));
    lines.push("", "In Bring übernehmen (antippen):", u.bring, "", "Dein Kochbuddy");
    return lines.join("\n");
  }

  /* ---------- Einführung beim ersten Start und Hilfe ---------- */
  const TOUR = [
    { ico: "👋", t: "Willkommen beim Kochbuddy", x: "Hier siehst du jeden Tag, was gekocht wird – mit Rezept, Kochmodus und Timern. Plan, Rezepte und Angebote aktualisieren sich von selbst." },
    { ico: "📅", t: "Oben steht immer heute", x: "Die Karte „Heute“ zeigt beide Mahlzeiten und was heute zu tun ist. Erledigtes abhaken. Ein Tipp auf ein Gericht öffnet das Rezept." },
    { ico: "⏱️", t: "Kochen mit Timer", x: "„Kochen“ führt dich Schritt für Schritt durchs Rezept. Eine Zeitangabe antippen startet den Timer, der Bildschirm bleibt dabei an. Zutaten abhaken, sobald sie im Topf sind." },
    { ico: "🔄", t: "Gericht tauschen", x: "Lust auf etwas anderes? Unter „Ersatzgerichte“ das Gericht am Griff ⠿ auf einen Tag ziehen oder „Tauschen“ antippen. Abends passt der Buddy Plan und Einkaufsliste an." },
    { ico: "🛒", t: "Wenn etwas zu tun ist", x: "Muss etwas in die Bring-Liste, erscheint oben ein oranger Hinweis mit Knopf. Unter „Angebote“ stehen die besten Angebote der Woche samt Einkaufszettel zum Abhaken." },
  ];
  let tourStep = 0;
  function showTour(step = 0) {
    tourStep = step;
    const s = TOUR[step], last = step === TOUR.length - 1;
    openSheet(`<div class="tour"><div class="tour-ico" aria-hidden="true">${s.ico}</div><h2>${esc(s.t)}</h2><p>${esc(s.x)}</p>
      <div class="tour-dots">${TOUR.map((_, i) => `<i class="${i === step ? "on" : ""}"></i>`).join("")}</div>
      <div class="tour-btns">${step > 0 ? `<button class="btn" data-act="tour-back">Zurück</button>` : `<button class="btn ghost" data-act="tour-end">Überspringen</button>`}
      <button class="btn primary" data-act="${last ? "tour-end" : "tour-next"}">${last ? "Los geht's" : "Weiter"}</button></div></div>`, { tour: "1" });
  }
  function endTour() { S.settings.toured = 1; save(); closeSheet(); }
  const cookHint = () => (S.settings.hintCook ? "" : `<div class="tip guide"><b>So geht's:</b> Schritt lesen. Steht eine Zeit dabei, startet ein Tipp darauf den Timer. Zutaten abhaken, sobald sie im Topf sind. Dann „Erledigt · weiter“ – oder nach links wischen. Der Bildschirm bleibt an.<div style="margin-top:8px"><button class="btn small" data-act="hint-cook">Verstanden</button></div></div>`);

  /* ---------- Tauschen: Ersatzgerichte per Ziehen auf einen Tag ----------
     Getauscht wird sofort in der App; gespeichert wird in tausch/<woche>.json im Rezept-Repo (nur Tage und Gerichtsnamen).
     Lesen geht ohne Schlüssel über GitHub Pages, Schreiben braucht einen Schlüssel mit Schreibrecht auf das Repo.
     Die stündliche Antwort-Aufgabe übernimmt offene Tausche abends gegen 21 Uhr in Plan, Bring-Liste und PDF. */
  const GH_REPO = "Padderico/Rezeptesammlung";
  const GH_KEY = "kochbuddy.gh";
  const ghToken = () => { try { return JSON.parse(localStorage.getItem(GH_KEY) || "{}").token || ""; } catch (e) { return ""; } };
  const setGhToken = (t) => { try { if (t) localStorage.setItem(GH_KEY, JSON.stringify({ token: t, at: Date.now() })); else localStorage.removeItem(GH_KEY); } catch (e) { /* gesperrt */ } };
  const validToken = (t) => /^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(t || "");
  async function gh(method, path, body) {
    const t = ghToken();
    if (!t) throw Object.assign(new Error("Kein Schlüssel auf diesem Gerät"), { code: "notoken" });
    let res;
    try {
      res = await fetch(`https://api.github.com/repos/${GH_REPO}${path}`, {
        method, cache: "no-store",
        headers: { Authorization: `Bearer ${t}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) { throw Object.assign(new Error("Gerade kein Netz"), { code: "offline" }); }
    if (method === "GET" && res.status === 404) return null;
    if (res.status === 401) throw Object.assign(new Error("Schlüssel ungültig oder abgelaufen"), { code: "auth" });
    if (res.status === 403 || res.status === 404) throw Object.assign(new Error("Schlüssel darf die Rezeptesammlung nicht beschreiben"), { code: "auth" });
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
    if (ghToken()) {
      const r = await gh("GET", swapPath(wid));
      list = r ? JSON.parse(b64d(r.content)).swaps || [] : [];
    } else {
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
    if (!st.ops.length) return false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await gh("GET", swapPath(wid));
      const data = r ? JSON.parse(b64d(r.content)) : { week: wid, swaps: [] };
      const ops = st.ops.slice();
      data.week = wid; data.swaps = applyOps(data.swaps || [], ops); data.updated = new Date().toISOString();
      const msg = ops.map((o) => (o.op === "add" ? `${o.swap.dayName} ${o.swap.slot}: ${o.swap.toTitle}` : "Tausch zurückgenommen")).join("; ");
      try {
        await gh("PUT", swapPath(wid), { message: `Koch-App: ${msg}`.slice(0, 180), content: b64e(JSON.stringify(data, null, 1) + "\n"), ...(r ? { sha: r.sha } : {}) });
        st.list = data.swaps; st.ops = st.ops.slice(ops.length); st.at = Date.now(); save();
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
    openSheet(`<h2>Tauschen einrichten</h2>
      ${problem ? `<p class="notice" style="margin:8px 0">${esc(problem)}</p>` : ""}
      <p class="small" style="margin:6px 0">Damit der Buddy deinen Tausch abends übernimmt, legt die App ihn in der Rezeptesammlung auf GitHub ab. Dafür braucht dieses Gerät einmalig einen GitHub-Schlüssel.</p>
      <ol class="small" style="padding-left:20px;margin:8px 0">
        <li>Auf github.com einloggen und „Fine-grained token“ erstellen (Knopf unten).</li>
        <li>Name „Kochbuddy“, Ablaufdatum so spät wie möglich.</li>
        <li>Repository access: <b>Only select repositories</b> → <b>Rezeptesammlung</b>.</li>
        <li>Permissions → Repository permissions → <b>Contents: Read and write</b>.</li>
        <li>„Generate token“, Schlüssel kopieren und hier einfügen.</li>
      </ol>
      <a class="btn small" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub öffnen</a>
      <input class="field" style="margin-top:12px" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…" data-ghtoken>
      <button class="btn primary big" style="margin-top:10px" data-act="gh-save">Prüfen und speichern</button>
      <p class="small muted" style="margin:10px 0 0">Schon auf einem anderen Gerät eingerichtet? Dort bei den Ersatzgerichten „Weiteres Gerät verbinden“ antippen und den QR-Code mit diesem Gerät scannen.</p>`);
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
    closeSheet(); toast("Tauschen ist auf diesem Gerät eingerichtet");
    if (pendingSwap) { const s = pendingSwap; pendingSwap = null; await performSwap(s.to, s.iso, s.slot); }
    else { await syncSwaps(true); rerenderSoft(); }
  }
  async function qrSheet() {
    const t = ghToken();
    if (!t) { tokenSheet(); return; }
    const url = `${location.origin}${location.pathname}#/verbinden/${t}`;
    let svg = "";
    try { const qr = (await import("./vendor/qrcode.mjs")).default(0, "M"); qr.addData(url); qr.make(); svg = qr.createSvgTag({ cellSize: 5, margin: 3, scalable: true }); } catch (e) { svg = ""; }
    openSheet(`<h2>Weiteres Gerät verbinden</h2><p class="small" style="margin:6px 0 10px">Mit der Kamera des anderen Geräts scannen. Danach kann auch dort getauscht werden.</p>
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
  async function renderDeals(view) {
    const w0 = weeks[0];
    const head = (sub) => `<header class="top"><div><div class="eyebrow">${esc(sub)}</div><h1>Angebote</h1></div></header>`;
    if (!w0) { view.innerHTML = head("Angebote") + `<p class="empty">Noch kein Wochenplan da.</p>`; return; }
    const url = pdfUrl(w0);
    let cache = null;
    try { cache = JSON.parse(localStorage.getItem(DEALS_KEY) || "null"); } catch (e) { cache = null; }
    const fresh = cache && cache.url === url && cache.built === (w0.built || "");
    if (fresh) drawDeals(view, w0, cache.data, url);
    else view.innerHTML = head(`KW ${w0.kw} · aus dem Wochen-PDF`) + `<p class="loading">Lese die Angebote aus dem Wochen-PDF …</p>`;
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
  function drawDeals(view, w0, d, url) {
    const ck = bag("dealcheck", `kw${w0.kw}-${w0.year}`);
    let h = `<header class="top"><div><div class="eyebrow">KW ${w0.kw} · aus dem Wochen-PDF</div><h1>Angebote</h1></div></header>`;
    if (!d.items || !d.items.length) {
      h += `<div class="card"><h2>Keine Angebotsseite</h2><p class="muted">In diesem Wochen-PDF gibt es diesmal keine Seite „Schnäppchen der Woche“.</p><a class="btn" href="${esc(url)}">PDF öffnen</a></div>`;
      if (d.pages && d.pages.length) h += `<button class="btn ghost" data-act="deals-render">Seite als Bild anzeigen</button><div id="dealpages"></div>`;
      view.innerHTML = h; view.dataset.pdf = url; view.dataset.pages = (d.pages || []).join(","); return;
    }
    if (d.subtitle) h += `<p class="muted small" style="margin:0 0 6px;font-weight:700">${esc(d.subtitle)}</p>`;
    const shops = ["Alle", ...new Set(d.items.map((it) => shopKey(it.shop)))];
    h += `<div class="section-title" style="margin-top:14px">Die stärksten Angebote</div>`;
    if (shops.length > 2) h += `<div class="seg">${shops.map((s) => `<button data-shopfilter="${esc(s)}" aria-pressed="${dealFilter === s}">${esc(s)}</button>`).join("")}</div>`;
    h += d.items.filter((it) => dealFilter === "Alle" || shopKey(it.shop) === dealFilter).map((it) => `<article class="deal${it.save >= 45 || /Bestpreis|Schnäppchen|Black/i.test(it.rating) ? " hot" : ""}">
      <div class="deal-top"><div style="min-width:0"><div class="eyebrow"><span class="rank">${it.rank}</span>${esc(niceShop(it.shop))}</div><b class="dn">${esc(it.name)}</b>${it.meta ? `<div class="small muted">${esc(it.meta)}</div>` : ""}</div>
      <div class="dp"><b>${esc(it.price)}</b>${it.normal ? `<small>statt ${esc(it.normal)}</small>` : ""}</div></div>
      ${it.save != null ? `<div class="barrow"><span class="pct">−${it.save} %</span><span class="bar"><i style="width:${Math.max(3, Math.min(100, it.save))}%"></i></span>${it.rating ? `<span class="chip${/Bestpreis|Schnäppchen|Black/i.test(it.rating) ? " pump" : ""}">${esc(it.rating)}</span>` : ""}</div>` : ""}
      ${it.maker ? `<p class="small" style="margin:4px 0"><b>Hersteller:</b> ${esc(it.maker)}</p>` : ""}${it.note ? `<p class="small muted" style="margin:4px 0 0">${esc(it.note)}</p>` : ""}</article>`).join("");
    if (d.plan && d.plan.length) {
      h += `<div class="section-title">Einkaufszettel zum Abhaken</div>` + d.plan.map((s, i) => `<section class="card"><h3>${esc(s.shop)}</h3>${s.when ? `<p class="small muted" style="margin:2px 0 4px">${esc(s.when)}</p>` : ""}<ul class="checks">${s.items.map((x, j) => checkRow(ck[`${i}:${j}`], esc(x), `data-dealcheck="${i}:${j}"`)).join("")}</ul></section>`).join("");
    }
    if (d.tips && d.tips.length) h += `<div class="section-title">So kaufst du am besten ein</div><div class="card tipgrid">${d.tips.map((t) => `<div><b>${esc(t.label)}</b>${esc(t.text)}</div>`).join("")}</div>`;
    if (d.intro && d.intro.length) h += `<div class="section-title">Hinweise</div>` + d.intro.map((p, i) => (i === 0 ? `<div class="tip"><p style="margin:0">${esc(p)}</p></div>` : `<p class="small muted">${esc(p)}</p>`)).join("");
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

  /* ---------- Alle Rezepte ---------- */
  let filter = { q: "", tag: "Alle" };
  async function renderAll(view) {
    let list;
    try { list = await getJSON("../rezepte/rezepte.json"); } catch (e) { list = embedded ? embedded.files["../rezepte/rezepte.json"] || [] : []; }
    const tags = ["Alle", "Fleisch", "Fisch", "Vegetarisch", "Suppe", "Pasta", "Kartoffel", "One-Pot", "Ofen", "Varoma", "Vorkochen"];
    let h = `<header class="top"><div><div class="eyebrow">${list.length} Rezepte</div><h1>Alle Rezepte</h1></div></header>`;
    h += `<input class="search" type="search" placeholder="Suchen, z. B. Suppe, Lachs, Gnocchi" value="${esc(filter.q)}" data-search>`;
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
    $("#rlist", view).innerHTML = items.map((m) => `<li><a href="#/r/a:${esc(m.slug)}"><b>${esc(m.title)}</b><span class="chips">${m.current ? '<span class="chip pump">diese Woche</span>' : ""}${tagChips(m.tags, 3)}<span class="chip plain">${m.total} Min.</span></span></a></li>`).join("") ||
      `<li class="empty">Nichts gefunden.</li>`;
  }

  /* ---------- Timer ---------- */
  const clock = (sec) => { sec = Math.max(0, Math.ceil(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`; };
  const remaining = (t) => (t.state === "pause" ? t.rem : t.state === "done" ? 0 : Math.max(0, (t.end - Date.now()) / 1000));
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
      $$(`[data-live="${t.id}"] span`).forEach((el) => (el.textContent = clock(remaining(t))));
      const pill = $(`#dock [data-timer-open="${t.id}"] .tt`); if (pill) pill.textContent = t.state === "done" ? "Fertig" : clock(remaining(t));
    }
  }
  function renderDock() {
    const dock = $("#dock");
    const list = S.timers.filter((t) => t.state !== "gone");
    if (!list.length && !inCooking) { dock.hidden = true; document.documentElement.style.setProperty("--dock-h", "0px"); return; }
    dock.hidden = false;
    list.sort((a, b) => (a.state === "done" ? -1 : b.state === "done" ? 1 : remaining(a) - remaining(b)));
    dock.innerHTML = list.map((t) => `<button class="tpill ${t.state === "done" ? "done" : t.state === "pause" ? "paused" : ""}" data-timer-open="${t.id}"><span class="tt">${t.state === "done" ? "Fertig" : clock(remaining(t))}</span><span class="tl2">${esc(t.title)}<br>${esc(t.label || t.sub)}</span></button>`).join("") +
      `<button class="tpill add" data-act="new-timer">${CLOCK.replace("<svg", '<svg class="ico"')} Timer</button>`;
    document.documentElement.style.setProperty("--dock-h", "62px");
  }
  function timerSheet(id) {
    const t = S.timers.find((x) => x.id === id);
    if (!t) return;
    openSheet(`<h2>${esc(t.title)}</h2><p class="muted" style="margin:4px 0 0">${esc(t.sub || t.label)}</p>
      <div style="font:600 3rem/1.1 var(--font-mono);text-align:center;margin:18px 0" data-live="${t.id}"><span>${t.state === "done" ? "00:00" : clock(remaining(t))}</span></div>
      <div class="presets"><button class="btn" data-tadd="-60">−1</button><button class="btn" data-tadd="60">+1</button><button class="btn" data-tadd="300">+5</button><button class="btn" data-tadd="600">+10</button></div>
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
    openSheet(`<h2>Eigener Timer</h2><div class="presets">${[1, 3, 5, 8, 10, 12, 15, 20, 25, 30, 45, 60].map((m) => `<button class="btn" data-quick="${m}">${m}</button>`).join("")}</div>
      <div class="row"><input class="field" style="flex:1" type="number" inputmode="numeric" min="1" max="600" placeholder="Minuten" data-qmin><input class="field" style="flex:2" type="text" placeholder="Wofür? z. B. Nudeln" data-qlabel></div>
      <button class="btn primary big" style="margin-top:12px" data-act="quick-go">Starten</button><p class="small muted" style="margin:8px 0 0">Zahl antippen startet sofort (Minuten).</p>`);
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
    box.innerHTML = `<div class="ring">⏰</div><div class="eyebrow" style="color:#fff;opacity:.85">${esc(t.title)}${t.label && t.sub ? " · " + esc(t.label) : ""}</div><h2>Zeit ist um</h2><p>${esc(t.sub || t.label)}</p>
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
    const want = inCooking || S.timers.some((t) => t.state === "run" || t.state === "done") || (B && B.start && Date.now() - B.start < 4 * 3600000 && location.hash.startsWith("#/vorkochen"));
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
    s.hidden = false;
  }
  const closeSheet = () => { $("#sheet").hidden = true; $("#sheet").innerHTML = ""; };
  let toastT = null;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2200); }
  function rerenderSoft() { const y = window.scrollY; route().then(() => window.scrollTo(0, y)); }

  /* ---------- Klicks ---------- */
  document.addEventListener("click", async (e) => {
    unlockAudio();
    const tab = e.target.closest("#nav a");
    if (tab) { e.preventDefault(); tabTo(tab.getAttribute("href")); return; }
    let el = e.target.closest("[data-act],[data-start],[data-timer-open],[data-ing],[data-prep],[data-rem],[data-cl],[data-tl],[data-go],[data-jump],[data-expand],[data-week],[data-portion],[data-tag],[data-alarm],[data-tadd],[data-tact],[data-quick],[data-swapopen],[data-swapto],[data-unswap],[data-dealcheck],[data-shopfilter],[data-bringopen],[data-bringmail],[data-bringdone]");
    if (el && !el.closest("#view, #dock, #sheet, #alarm, #upd")) el = null; // nie den Seitenrahmen als Knopf werten
    if (!el) { if (e.target.id === "sheet") { if ($("#sheet").dataset.tour) endTour(); else closeSheet(); } return; }
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
    if (d.prep != null) { el.classList.toggle("on", toggle("prep", view.dataset.ref, d.prep)); return; }
    if (d.rem) { const [day, i] = d.rem.split(":"); el.classList.toggle("on", toggle("rem", `${weekId}:${day}`, i)); return; }
    if (d.cl) { const [i, j] = d.cl.split(":"); toggle("check", `${weekId}:${i}`, j); rerenderSoft(); return; }
    if (d.tl != null) { const B = (S.block[weekId] = S.block[weekId] || {}); B.done = B.done || {}; if (B.done[d.tl]) delete B.done[d.tl]; else B.done[d.tl] = 1; save(); el.classList.toggle("on"); return; }
    if (d.go != null) { const ref = view.dataset.ref; S.cook[ref] = { ...(S.cook[ref] || { start: Date.now() }), step: +d.go }; cookRef = null; save(); navTo(`#/k/${ref}`, "push"); return; }
    if (d.jump != null) { cookStep = +d.jump; showList = false; S.cook[cookRef].step = cookStep; save(); drawCook(view, await getRecipe(cookRef), cookRef); window.scrollTo(0, 0); return; }
    if (d.expand) { if (!view.querySelector(`.today [data-expand="${d.expand}"]`)) { expanded[d.expand] = !expanded[d.expand]; rerenderSoft(); } return; }
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
        const u = shownUpdates.find((x) => x.key === $("#sheet").dataset.bring), addr = (($("[data-mailto]") || {}).value || "").trim();
        if (!u) break;
        if (addr) { S.settings.mailTo = addr; save(); }
        location.href = `mailto:${encodeURIComponent(addr).replace(/%40/g, "@")}?subject=${encodeURIComponent("Bring: neue Zutaten für den Wochenplan")}&body=${encodeURIComponent(bringText(u))}`;
        closeSheet(); toast("Mail-App geöffnet – Mail abschicken, dann auf dem Handy den Link antippen"); break;
      }
      case "bringshare": { const u = shownUpdates.find((x) => x.key === $("#sheet").dataset.bring); if (u && navigator.share) navigator.share({ title: "Bring: neue Zutaten", text: bringText(u) }).catch(() => {}); break; }
      case "bringcopy": { const u = shownUpdates.find((x) => x.key === $("#sheet").dataset.bring); if (u) { try { await navigator.clipboard.writeText(u.bring); toast("Link kopiert"); } catch (er) { toast("Kopieren ging nicht – bitte „Mail-App öffnen“ nutzen"); } } break; }
      case "gh-save": saveToken(); break;
      case "gh-qr": e.preventDefault(); qrSheet(); break;
      case "gh-remove": setGhToken(""); closeSheet(); rerenderSoft(); toast("Schlüssel entfernt – Tauschen ist hier aus"); break;
      case "deals-retry": localStorage.removeItem(DEALS_KEY); rerenderSoft(); break;
      case "deals-render": el.disabled = true; renderDealPages().catch(() => toast("PDF-Seite ließ sich nicht anzeigen")); break;
      case "home": e.preventDefault(); navTo("#/", "jump"); break;
      case "cook-next": cookGo(1, true); break;
      case "cook-prev": cookGo(-1, false); break;
      case "cook-list": showList = !showList; drawCook(view, await getRecipe(cookRef), cookRef); window.scrollTo(0, 0); break;
      case "cook-restart": delete S.steps[cookRef]; delete S.ing[cookRef]; S.cook[cookRef] = { start: Date.now(), step: 0 }; cookStep = 0; save(); drawCook(view, await getRecipe(cookRef), cookRef); break;
      case "reset-recipe": { const ref = view.dataset.ref; ["steps", "ing", "prep", "cook"].forEach((k) => delete S[k][ref]); if (cookRef === ref) cookRef = null; save(); rerenderSoft(); toast("Zurückgesetzt"); break; }
      case "block-start": S.block[weekId] = { start: Date.now(), done: {}, beep: false }; save(); updateWake(); rerenderSoft(); break;
      case "block-reset": blockTimers(false); delete S.block[weekId]; save(); rerenderSoft(); break;
      case "new-timer": newTimerSheet(); break;
      case "quick-go": { const m = parseFloat(($("[data-qmin]") || {}).value); if (m > 0) { askNotify(); addTimer({ min: m * 60, title: ($("[data-qlabel]").value || "Timer").trim(), label: `${fmt(m)} Min.` }); closeSheet(); } break; }
      case "install": if (installEvt) { installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; rerenderSoft(); } break;
      case "notice": noticeOpen = !noticeOpen; el.classList.toggle("clamp", !noticeOpen); break;
      case "nohint": S.settings.installHint = false; save(); rerenderSoft(); break;
      case "reload": e.preventDefault(); { const r = await checkUpdates(true); toast(r === "offline" ? "Gerade kein Netz – du siehst den letzten Stand" : r === "changed" ? "Plan aktualisiert" : "Alles aktuell"); rerenderSoft(); } break;
      case "apply-update": location.reload(); break;
    }
  });

  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.eat) { S.eat[el.dataset.eat] = el.value; save(); getRecipe(el.dataset.eat).then((r) => ($("#plan-out").innerHTML = planText(r, el.value))); }
    if (el.dataset.act === "block-beep") { S.block[weekId].beep = el.checked; save(); unlockAudio(); askNotify(); blockTimers(el.checked); }
  });
  document.addEventListener("input", (e) => { if (e.target.dataset.search != null) { filter.q = e.target.value; drawList($("#view")); } });

  /* ---------- Einstellungen anwenden, Installation ---------- */
  function applySettings() {
    const st = S.settings, dark = st.theme === "dark" || (st.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.scheme = dark ? "dark" : "light";
    document.documentElement.style.setProperty("--scale", st.scale);
    const meta = $('meta[name="theme-color"]'); if (meta) meta.content = dark ? "#0E1715" : "#0D6657";
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
      if (v && (await syncSwaps(true))) result = "changed";
      if (!v) result = result === "changed" ? "changed" : "offline";
      if (swReg && v) swReg.update().catch(() => {});
      if (v && codeTag && v !== codeTag) markUpdate();
      if (v && !codeTag) codeTag = v;
      const dayChanged = renderedDay && renderedDay !== today();
      if ((result === "changed" || dayChanged) && !manual) {
        if (!inCooking && $("#sheet").hidden) { rerenderSoft(); if (result === "changed") toast("Neuer Stand vom Speiseplan geladen"); }
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
  syncSwaps(true).then((ch) => { if (ch && !inCooking) rerenderSoft(); });
  route().then(() => {
    if (!S.settings.toured && !embedded && $("#alarm").hidden) setTimeout(() => { if ($("#sheet").hidden) showTour(0); }, 500); if (S.timers.length) { scheduleTimers(); if (S.timers.some((t) => t.state === "done")) showAlarm(); } });
  // Live-Anzeige im Vorkoch-Block jede halbe Minute auffrischen
  setInterval(() => { if (location.hash.startsWith("#/vorkochen") && S.block[weekId] && $("#sheet").hidden) rerenderSoft(); }, 30000);
})();
