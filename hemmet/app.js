// ============================================================================
// HEMMET: allt byggs från DATA (scripts/build_hemmet.py bakar in den).
//
// Två sorters data:
//   nuläget   level, gear, HP, HKs, porträtt …  → topplistor, armory, gruppsök, jämför
//   resan     en level per dag + händelser       → tavlan, bedrifter, statistiken, kurvorna
// Resan är den riktiga historiken: en snapshot per dag som fetch_hemmet.py sparat.
// ============================================================================
const CLS = { warrior: "#C69B6D", paladin: "#F48CBA", hunter: "#AAD372", rogue: "#FFF468", priest: "#FFFFFF", shaman: "#0070DD", mage: "#3FC7EB", warlock: "#8788EE", druid: "#FF7C0A" };
const CLS_NAME = { warrior: "Warrior", paladin: "Paladin", hunter: "Hunter", rogue: "Rogue", priest: "Priest", shaman: "Shaman", mage: "Mage", warlock: "Warlock", druid: "Druid" };
const RACE = { 1: "Human", 2: "Orc", 3: "Dwarf", 4: "Night Elf", 5: "Undead", 6: "Tauren", 7: "Gnome", 8: "Troll", 10: "Blood Elf", 11: "Draenei" };
const SLOT = { 0: "Huvud", 1: "Hals", 2: "Axlar", 3: "Skjorta", 4: "Bröst", 5: "Midja", 6: "Ben", 7: "Fötter", 8: "Handleder", 9: "Händer", 10: "Ring", 11: "Ring", 12: "Trinket", 13: "Trinket", 14: "Rygg", 15: "Main hand", 16: "Off hand", 17: "Avstånd", 18: "Tabard" };
const Q = { 0: "#9d9d9d", 1: "#ffffff", 2: "#1eff00", 3: "#0070dd", 4: "#a335ee", 5: "#ff8000" };
const ORDER = Object.keys(CLS);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const nf = (n) => (n == null ? "–" : Number(n).toLocaleString("sv-SE"));
const $ = (id) => document.getElementById(id);
// Förhandsvisningen (scripts/build_demo.py) har påhittad historik: "nu" är då datans tidpunkt, inte dagens datum
const DEMO_MODE = !!DATA.demo, NOW = () => (DEMO_MODE ? DATA.demo.now : Date.now());
const RECRUIT = !!DATA.recruit;   // rekryteringssidan: hero, FAQ och Flytta in; demon i en overlay
const NUM = (x) => `<i class="n">${x}</i>`;   // siffra inne i en Marcellus-etikett: sätts i Open Sans (Marcellus nolla ser ut som ett O)
const RMAX = DATA.max;                  // högsta level i spelet just nu (riktig data)
const RELEASE = new Date(Date.UTC(2026, 10, 4, 23, 0));   // 4 nov 15:00 PST = 5 nov 00:00 svensk tid
const fmtDate = (d) => d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" }).replace(/\.$/, "");
const hhmm = (ts) => new Date(ts).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
const ago = (ts) => {
  if (!ts) return "okänt";
  const min = Math.max(1, Math.round((NOW() - ts) / 6e4));
  return min < 60 ? `${min} min` : min < 1440 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} d`;
};
const dur = (ms) => { const h = Math.floor(ms / 36e5), mi = Math.round((ms % 36e5) / 6e4); return h ? `${h} h ${String(mi).padStart(2, "0")} min` : `${mi} min`; };
document.documentElement.style.setProperty("--avc", DATA.av.cols);
document.documentElement.style.setProperty("--icc", DATA.ic.cols);

const ZONES_ALL = [
  ["elwynn", "Elwynn", 1, 10], ["westfall", "Westfall", 11, 16], ["redridge", "Redridge", 17, 21], ["duskwood", "Duskwood", 22, 27],
  ["hillsbrad", "Hillsbrad", 28, 31], ["stv", "Stranglethorn", 32, 37], ["dustwallow", "Dustwallow", 38, 42], ["tanaris", "Tanaris", 43, 47],
  ["hinterlands", "Hinterlands", 48, 50], ["ungoro", "Un'Goro", 51, 54], ["steppes", "Steppes", 55, 56], ["wpl", "Plaguel.", 57, 58], ["winterspring", "Wintersp.", 59, 60],
].map(([id, n, a, b]) => ({ id, n, a, b }));
// Tavlans zoner: tio levels var så att alla får lika mycket plats och namnen syns
const BOARD_ZONES = [["elwynn", "Elwynn Forest", 1, 10], ["westfall", "Westfall", 11, 20], ["duskwood", "Duskwood", 21, 30], ["stv", "Stranglethorn", 31, 40],
  ["tanaris", "Tanaris", 41, 50], ["winterspring", "Winterspring", 51, 60]].map(([id, n, a, b]) => ({ id, n, a, b }));
const zoneOf = (L) => ZONES_ALL.find((z) => L >= z.a && L <= z.b) || ZONES_ALL[0];

// ---------- medlemmar (nuläget) ----------
const members = DATA.members.map((d, i) => ({
  i, name: d.n, cls: d.c, race: d.r, gender: d.g, level: Math.min(RMAX, d.l), rank: d.rk, last: d.ll, ilvl: d.il, hp: d.hp, hk: d.hk, pvpRank: d.pr,
  title: d.t, ap: d.ap, sp: d.sp, crit: d.cr, av: d.a, gear: d.gear, hist: d.h.map((x) => (x == null ? x : Math.min(RMAX, x))), spec: d.spec, role: d.role, heal: d.hl, render: d.rd,
}));
const byIdx = [...members];
members.sort((a, b) => b.level - a.level || (b.ilvl ?? 0) - (a.ilvl ?? 0));
const byName = Object.fromEntries(members.map((m) => [m.name.toLowerCase(), m]));
$("names").innerHTML = members.map((m) => `<option value="${esc(m.name)}">`).join("");
$("footData").textContent = DEMO_MODE
  ? "Förhandsvisning med exempeldata. När Forever öppnar hämtas allt från Blizzards API."
  : `Data från Blizzards API för <${DATA.guild}> på ${DATA.realm}, hämtad ${DATA.generated}.`;
if (DEMO_MODE) {
  // "vad som kommer"-texter, den säljande inledningen och märkningen
  document.body.classList.add("is-demo");
  $("demoBadge").hidden = false;
  $("playHint").hidden = false;   // pilen mot spelknappen tills man provat
  $("resanTitle").innerHTML = "Följ hela guilden, <span>dag för dag</span>";
  $("resanLede").textContent = "När World of Warcraft: Forever släpps kommer du att kunna följa guildens resa från Goldshire till Onyxia’s Lair. Här finns hela guilden, var och en på sin level. Se oss ta oss dit tillsammans, en ding i taget. Vem hinner först? Vilka formar Förstafemman?";
  $("resanLede").insertAdjacentHTML("afterend", `<div class="resan-more"><p class="lede">I Hemmet tävlar vi om kronorna, samarbetar för gemensamma achievements och får det lätt att hitta folk att spela med i vår inbyggda dungeon finder. Kom som du är och ta med dig dina vänner till the guild of guilds. Välkommen hem!</p>
    <div class="btn-row"><a class="btn btn--ghost" href="#faq">FAQ</a><a class="btn btn--primary" href="#join">Flytta in</a></div></div>`);
}

// porträtt: Blizzards avatar ur spriten, annars en siluett i klassfärg
const pf = (m) => {
  const img = m.av >= 0 ? ` img" style="--c:${CLS[m.cls]};--ax:${m.av % DATA.av.cols};--ay:${Math.floor(m.av / DATA.av.cols)}` : `" style="--c:${CLS[m.cls]}`;
  return `<span class="pf${img}" data-n="${esc(m.name)}" aria-label="${esc(m.name)}"></span>`;
};
let ME = null;
try { ME = byName[(localStorage.getItem("hemmet.me") || "").toLowerCase()] || null; } catch (e) {}

// ============================================================================
// RESAN: den sparade historiken
// ============================================================================
function realJourney() {
  const last = DATA.dates.length - 1;
  return {
    max: RMAX, dates: DATA.dates.map((s) => new Date(`${s}T00:00`)),
    lv: new Map(members.map((m) => [m, m.hist.map((x, i) => (i === last ? m.level : x))])),
    events: DATA.events.map(([t, i, k, v, xp]) => ({ t, m: byIdx[i], k: ["level", "login", "logout", "hk", "rep"][k], v, xp })),
  };
}
const REAL = realJourney();
let J, LAST, T, lastT;
const L_ = (m) => J.lv.get(m) || [];
// Level vid tidpunkt t (i dagar: t = slutet av dag t, -1 = releasen när mätningen börjar där).
// Exakt ur händelserna när det finns dings (varje ding på den hämtning som såg den), annars ur dagens ögonblicksbild.
let DINGS = new Map(), SEEN = new Map();
function indexEvents() {
  DINGS = new Map(); SEEN = new Map();
  for (const e of J.events) {
    if (!J.lv.has(e.m)) continue;
    if (!SEEN.has(e.m)) SEEN.set(e.m, e.t);
    if (e.k === "level") (DINGS.get(e.m) || DINGS.set(e.m, []).get(e.m)).push([e.t, e.v]);
  }
}
function lvSnap(m, t) {
  const arr = L_(m);
  if (t < 0) return arr[0] != null ? 1 : null;
  const d0 = Math.floor(t), d1 = Math.min(LAST, d0 + 1), f = t - d0, a = arr[d0], b = arr[d1];
  if (a == null) return f > .5 && b != null ? b : null;
  return Math.floor(a + ((b ?? a) - a) * f);
}
function lvAt(m, t) {
  if (t < 0) return L_(m)[0] != null ? 1 : null;   // releasen: alla som är med första dagen står på level 1
  const dg = DINGS.get(m);
  if (!dg) return lvSnap(m, t);
  const ts = cutAt(t);
  if (ts < dg[0][0]) {   // före första dingen: en level under den, om personen var med då
    const here = FROM_START ? ts >= SEEN.get(m) || (t < 0 ? false : L_(m)[Math.max(0, Math.floor(t))] != null) : lvSnap(m, t) != null;
    return here ? dg[0][1] - 1 : null;
  }
  let lo = 0, hi = dg.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (dg[mid][0] <= ts) lo = mid; else hi = mid - 1; }
  return dg[lo][1];
}
const T_MIN = () => (FROM_START ? -1 : 0);
const jm = () => members.filter((m) => J.lv.has(m));
const inAt = (t) => jm().filter((m) => lvAt(m, t) != null);
const cnt = (t, L) => jm().filter((m) => (lvAt(m, t) ?? 0) >= L).length;
const maxL = (t) => Math.max(0, ...jm().map((m) => lvAt(m, t) ?? 0));
const median = (t) => { const a = inAt(t).map((m) => lvAt(m, t)).sort((x, y) => x - y); return a[Math.floor(a.length / 2)] ?? 0; };
const joinOf = (m) => L_(m).findIndex((x) => x != null);
const dLbl = (i) => fmtDate(J.dates[Math.max(0, Math.min(LAST, Math.round(i)))]);
// levels tagna per dag. Första snapshoten är normalt utgångsläget (vi vet inte hur länge någon levlat innan vi
// började spara). Börjar mätningen på releasedagen startade alla på level 1, och då räknas första dagen från 1.
const FROM_START = DATA.dates[0] === `${RELEASE.getFullYear()}-${String(RELEASE.getMonth() + 1).padStart(2, "0")}-${String(RELEASE.getDate()).padStart(2, "0")}`;
const gainOn = (m, d) => {
  const arr = L_(m);
  if (arr[d] == null) return 0;
  if (d > 0) return arr[d - 1] != null ? arr[d] - arr[d - 1] : 0;   // dagen någon går med räknas inte: de kan ha levlat innan
  return FROM_START ? arr[0] - 1 : 0;
};
const gainedWeek = (m) => { let s = 0; for (let d = Math.max(0, LAST - 6); d <= LAST; d++) s += gainOn(m, d); return s; };

// ============================================================================
// HERO
// ============================================================================
if (DATA.hero) $("hero").classList.add("has-photo");   // en riktig Elwynn-bild i stället för kartan
const title = $("title");
title.innerHTML = [...title.textContent].map((c, i) => `<span class="ch" style="--i:${i}">${c}</span>`).join("");
function countdown() {
  const ms = RELEASE - Date.now(), el = $("count");
  if (ms <= 0) { el.innerHTML = `<div><b>${Math.floor(-ms / 864e5) + 1}</b><span>dag</span></div>`; $("countLbl").textContent = "sedan release"; return; }
  const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, mi = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
  el.innerHTML = [[d, "dagar"], [h, "tim"], [mi, "min"], [s, "sek"]].map(([v, l]) => `<div><b>${String(v).padStart(2, "0")}</b><span>${l}</span></div>`).join("");
}
countdown(); setInterval(countdown, 1000);
// Glöd i luften. "drift": heron, glöd som svävar upp över hela bilden.
// "fire": Flytta in, gnistor från en lägereld precis under kanten: heta och vitgula nertill, orange och röda när de slocknar.
function embers(c, mode) {
  if (!c || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const x = c.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1), fire = mode === "fire";
  let W, H, on = false;
  const size = () => { W = c.width = c.offsetWidth * dpr; H = c.height = c.offsetHeight * dpr; };
  size(); addEventListener("resize", size);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;   // tätast i mitten
  const spawn = (y) => fire
    ? { x: W / 2 + gauss() * W * .16, y: y ?? H + Math.random() * 20, r: (Math.random() * 1.8 + .6) * dpr, vy: (Math.random() * 1.3 + .6) * dpr, vx: gauss() * .5 * dpr,
        life: .45 + Math.random() * .5, p: Math.random() * 6 }
    : { x: Math.random() * W, y: y ?? H + 10, r: (Math.random() * 1.6 + .5) * dpr, vy: (Math.random() * .5 + .2) * dpr, vx: (Math.random() - .5) * .3, a: Math.random() * .6 + .3, p: Math.random() * 6 };
  const ps = Array.from({ length: fire ? 120 : 70 }, () => spawn(fire ? H - Math.random() * H * .8 : Math.random() * H));
  // bara när den syns: ingen animation i onödan
  new IntersectionObserver(([e]) => { const was = on; on = e.isIntersecting; if (on && !was) requestAnimationFrame(tick); }).observe(c);
  function tick() {
    if (!on) return;
    x.clearRect(0, 0, W, H);
    for (const p of ps) {
      p.y -= p.vy; p.x += p.vx + Math.sin((p.y + p.p * 100) / (fire ? 60 : 90)) * (fire ? .5 : .3);
      if (fire) {
        const k = Math.max(0, 1 - (H - p.y) / (H * p.life));   // 1 vid elden, 0 när gnistan slocknat
        if (k <= 0) { Object.assign(p, spawn()); continue; }
        // vitgul → orange → djupröd på vägen upp
        const g = Math.round(90 + 150 * k * k), b = Math.round(40 + 120 * Math.max(0, k - .6));
        x.shadowColor = `rgba(255,${g - 40},30,.9)`; x.shadowBlur = (6 + 8 * k) * dpr;
        x.beginPath(); x.arc(p.x, p.y, p.r * (.5 + .7 * k), 0, 6.3); x.fillStyle = `rgba(255,${g},${b},${Math.min(1, k * 1.4)})`; x.fill();
      } else {
        x.shadowColor = "rgba(240,180,80,.9)"; x.shadowBlur = 8 * dpr;
        x.beginPath(); x.arc(p.x, p.y, p.r, 0, 6.3); x.fillStyle = `rgba(240,196,110,${p.a * Math.min(1, p.y / (H * .5))})`; x.fill();
        if (p.y < -10) Object.assign(p, spawn());
      }
    }
    requestAnimationFrame(tick);
  }
}
embers($("embers"), "drift");
embers($("fireEmbers"), "fire");
new IntersectionObserver(([e]) => $("topbar").classList.toggle("is-visible", !e.isIntersecting), { threshold: .15 }).observe($("hero"));
// remsan: resans roligaste siffror (följer läget), sedan riktiga dings och inloggningar
// Rekryteringssidan: remsan visar Discord i stället för (påhittade) dings. Siffrorna kommer från inbjudningslänken,
// som Discord svarar på utan inloggning, och uppdateras var femte minut.
let DISCORD = null;
async function fetchDiscord() {
  try {
    const j = await (await fetch("https://discord.com/api/v10/invites/NhhGAZaVk?with_counts=true")).json();
    if (j.approximate_member_count) DISCORD = { members: j.approximate_member_count, online: j.approximate_presence_count };
  } catch (e) {}
  drawTicker();
}
function drawDiscordTicker() {
  const items = DISCORD
    ? [`<em>${nf(DISCORD.members)}</em> medlemmar i vår Discord`, `<em>${nf(DISCORD.online)}</em> online just nu`, "WoW Forever öppnar <em>5 nov</em>", "Kom som du är, och ta med dina vänner"]
    : ["A Guild of Guilds", "Många gamla gäng, ett hem", "WoW Forever öppnar <em>5 nov</em>", "Kom som du är, och ta med dina vänner"];
  const row = items.map((x, i) => `<span class="${i < 2 ? "mile" : ""}">${x}</span>`).join('<span class="dot">◆</span>') + '<span class="dot">◆</span>';
  $("ticker").innerHTML = row.repeat(8);   // två identiska halvor: remsan rullar ett halvt varv och börjar om
}
function drawTicker() {
  if (RECRUIT) return drawDiscordTicker();
  const people = jm(), items = [];
  const it = (html, cls = "") => items.push(`<span class="${cls}">${html}</span>`);
  const nm = (m) => `<b style="color:${CLS[m.cls]}">${esc(m.name)}</b>`;
  const perDay = J.dates.map((_, d) => people.reduce((s, m) => s + gainOn(m, d), 0));
  if (perDay.some((v) => v)) {
    const best = perDay.indexOf(Math.max(...perDay));
    it(`Senaste dagen: <em>+${nf(perDay[LAST])}</em> levels`, "mile");
    it(`Bästa dagen: <em>${dLbl(best)}</em>, +${nf(perDay[best])} levels`);
    it(`Totalt <em>${nf(perDay.reduce((x, y) => x + y, 0))}</em> levels sedan start`);
  }
  const lead = [...people].sort((x, y) => (L_(y)[LAST] ?? 0) - (L_(x)[LAST] ?? 0))[0];
  if (lead) it(`Täten: ${nm(lead)} på level <em>${L_(lead)[LAST]}</em>`, "mile");
  for (let L = 10; L <= J.max; L += 10) { const f = firstTo[L]; if (f) it(`Först till ${L}: ${nm(f.m)}`, "mile"); }
  const week = people.map((m) => [m, gainedWeek(m)]).sort((x, y) => y[1] - x[1])[0];
  if (week && week[1]) it(`Veckans raket: ${nm(week[0])} <em>+${week[1]}</em>`);
  const night = new Map(); J.events.forEach((e) => { if (e.k === "level" && new Date(e.t).getHours() < 5) night.set(e.m, (night.get(e.m) || 0) + 1); });
  const owl = [...night].sort((x, y) => y[1] - x[1])[0];
  if (owl) it(`Nattugglan: ${nm(owl[0])}, <em>${owl[1]}</em> dings efter midnatt`);
  const med = median(LAST); if (med) it(`Guildens mitt: level <em>${med}</em>`);
  J.events.filter((e) => e.k === "rep" && J.lv.has(e.m)).slice(-5).reverse().forEach((e) => it(`${nm(e.m)} <span class="arr">⯈</span> <em>Exalted</em> med ${esc(e.v)}`, "mile"));
  J.events.filter((e) => e.k === "level" && J.lv.has(e.m)).slice(-10).reverse().forEach((e) => it(`${nm(e.m)} <span class="arr">⯈</span> <em>${e.v}</em>`, e.v % 10 === 0 ? "mile" : ""));
  [...members].filter((m) => m.last).sort((x, y) => y.last - x.last).slice(0, 8).forEach((m) => it(`${nm(m)} inloggad för <em>${ago(m.last)}</em> sedan`));
  const row = items.join('<span class="dot">◆</span>');
  $("ticker").innerHTML = row + '<span class="dot">◆</span>' + row;
}

// ============================================================================
// TAVLAN
// ============================================================================
const board = $("board"), CAP = 12;
let toks = [];
function buildBoard() {
  const MAX = J.max, zones = BOARD_ZONES.filter((z) => z.a <= MAX).map((z) => ({ ...z, b: Math.min(z.b, MAX) }));
  board.innerHTML = zones.map((z) => `<div class="zseg" data-a="${z.a}" style="--art:url('ach/zone-${z.id}.webp');left:${((z.a - 1) / MAX) * 100}%;width:${((z.b - z.a + 1) / MAX) * 100}%"><span><i class="zbadge" style="background-image:url('ach/zone-${z.id}.webp')"></i>${z.n}<small>${z.a}–${z.b}</small></span></div>`).join("")
    + `<div class="axis">${[1, 10, 20, 30, 40, 50, 60].filter((l) => l <= MAX).map((l) => `<span style="left:${((l - .5) / MAX) * 100}%">${l}</span>`).join("")}</div>`
    + jm().map((m) => pf(m).replace('class="pf', `class="tok pf out`).replace("<span ", `<span data-i="${m.i}" `)).join("")
    + `<div class="leadflag" id="leadflag"></div><div id="moreChips"></div>`;
  toks = [...board.querySelectorAll(".tok")];
}
function drawBoard() {
  // Tavlan fyller alltid bredden: porträtten skalar med kolumnbredden i stället för att sidan ska scrolla
  const MAX = J.max, cols = {}, colW = board.clientWidth / MAX;
  const ts = Math.max(11, Math.min(24, colW * 1.3)), step = ts * .82;
  board.style.setProperty("--ts", `${ts.toFixed(1)}px`);
  [...jm()].sort((a, b) => (b === ME) - (a === ME) || ORDER.indexOf(a.cls) - ORDER.indexOf(b.cls) || a.name.localeCompare(b.name))
    .forEach((m) => { const L = lvAt(m, T); if (L != null) (cols[L] ||= []).push(m); });
  let lead = 0;
  toks.forEach((el) => {
    const m = byIdx[+el.dataset.i], L = lvAt(m, T), k = L == null ? -1 : cols[L].indexOf(m);
    el.classList.toggle("out", L == null || k >= CAP); el.classList.toggle("me", m === ME);
    if (L == null) return;
    lead = Math.max(lead, L);
    el.style.left = `${((L - .5) / MAX) * 100}%`; el.style.bottom = `${46 + Math.min(k, CAP - 1) * step}px`;
  });
  const medal = medalsAt(cutAt(T));
  toks.forEach((el) => { const r = medal.get(byIdx[+el.dataset.i]); el.classList.toggle("cr1", r === 1); el.classList.toggle("cr2", r === 2); el.classList.toggle("cr3", r === 3); });
  drawCrowns();
  $("moreChips").innerHTML = Object.entries(cols).filter(([, c]) => c.length > CAP)
    .map(([L, c]) => `<span class="more-chip" style="left:${((L - .5) / MAX) * 100}%;bottom:${46 + CAP * step + 6}px">+${c.length - CAP}</span>`).join("");
  board.querySelectorAll(".zseg").forEach((z) => z.classList.toggle("fog", +z.dataset.a > lead));
  const lf = $("leadflag"), ld = cols[lead] || [];
  lf.style.left = `${((lead - .5) / MAX) * 100}%`; lf.style.bottom = `${46 + Math.min(ld.length, CAP) * step + (ld.length > CAP ? 32 : 10)}px`;
  lf.innerHTML = ld.length === 1 ? esc(ld[0].name) : ld.length ? `${NUM(ld.length)} på ${NUM(lead)}` : "";
  lf.classList.toggle("end", lead / MAX > .9); lf.classList.toggle("start", lead / MAX < .1);
  board.style.height = `${Math.round(46 + CAP * step + 90)}px`;
  const inn = inAt(T), d = Math.round(T);
  let today = 0; inn.forEach((m) => (today += gainOn(m, d)));
  $("kpis").innerHTML = `<div class="kpi"><b>${inn.length}</b><span>på resan</span></div><div class="kpi"><b>${cnt(T, MAX)}</b><span>på level ${NUM(MAX)}</span></div>
    <div class="kpi"><b>${median(T)}</b><span>medianlevel</span></div><div class="kpi"><b>+${nf(today)}</b><span>levels ${d === LAST ? "senaste dagen" : "den dagen"}</span></div>`;
  if (T < 0) {   // releasen: alla står i Elwynn
    $("dayline").innerHTML = `<b>${fmtDate(RELEASE)} kl 00:00</b> <span>Forever öppnar. <em>${inn.length}</em> står redo i Elwynn Forest, alla på level 1.</span>`;
  } else if (LAST === 0) {
    $("dayline").innerHTML = `<b>Idag</b> <span><em>${cnt(T, MAX)}</em> på max level och <em>${inn.length - cnt(T, MAX)}</em> på väg dit.</span>`;
  } else {
    const ev = [];
    for (const [L, f] of Object.entries(firstTo)) if (+L % 10 === 0 && Math.round(f.d) === d && f.d <= T) ev.push(`<em>${esc(f.m.name)}</em> först till ${L}`);
    const j = jm().filter((m) => joinOf(m) === d && d > 0).length;
    if (j) ev.push(`${j} ny${j > 1 ? "a" : ""} i guilden`);
    // inga rekord den dagen: visa vad guilden gjorde ändå
    if (!ev.length && today > 0) ev.push(`<em>${nf(today)}</em> levels tagna`);
    $("dayline").innerHTML = `<b>${dLbl(d)}</b> <span>${ev.length ? ev.join(" · ") : "En lugn dag på vägen."}</span>`;
  }
}
// ---------- vem nådde varje level först, och när ----------
// reach: medlem → (level → { t: tidpunkt, x: exakt klockslag? })
// Händelser ger exakt tid. Levels som bara syns i en snapshot får dagens början,
// och levels som fanns redan när mätningen startade hamnar "före mätningen".
let reach = new Map(), firstTo = {};
const base = () => J.dates[0].getTime();
const cutAt = (t) => base() + (t + 1) * 864e5;
const dayOf = (ts) => Math.max(0, (ts - base()) / 864e5 - 1);
function computeFirsts() {
  reach = new Map();
  for (const e of J.events) {
    if (e.k !== "level" || !J.lv.has(e.m)) continue;
    let r = reach.get(e.m); if (!r) reach.set(e.m, (r = new Map()));
    if (!r.has(e.v)) r.set(e.v, { t: e.t, x: true, xp: e.xp });
  }
  for (const m of jm()) {
    let r = reach.get(m); if (!r) reach.set(m, (r = new Map()));
    L_(m).forEach((L, d) => {
      if (L == null) return;
      for (let l = 2; l <= L; l++) if (!r.has(l)) r.set(l, { t: d === 0 ? base() - 1 : base() + d * 864e5, x: false });
    });
  }
  firstTo = {};
  for (let L = 2; L <= J.max; L++) { const p = podium(L, Infinity); if (p[0]) firstTo[L] = { m: p[0].m, d: dayOf(p[0].t), t: p[0].t }; }
}
function podium(L, cut) {
  const out = [];
  for (const m of jm()) { const r = reach.get(m)?.get(L); if (r && r.t >= base() && r.t <= cut) out.push({ m, ...r }); }   // före mätningen ger ingen krona
  // samma tidpunkt (samma hämtning): mest XP in i nivån dingade troligen först
  return out.sort((x, y) => x.t - y.t || (y.xp ?? 0) - (x.xp ?? 0) || x.m.name.localeCompare(y.m.name)).slice(0, 3);
}
// Kronor bara från 40 och uppåt: de låga nivåerna tas de första timmarna, när alla dingar samtidigt
// Kortens färg: föremålskvaliteterna från spelet
const TIER = { 40: ["#0070dd", "Rare"], 50: ["#a335ee", "Epic"], 60: ["#ff8000", "Legendary"] };
const crownLevels = () => [40, 50, 60].filter((L) => L <= J.max);
function medalsAt(cut) {
  const best = new Map();
  for (const L of crownLevels()) podium(L, cut).forEach((p, i) => { if (!best.has(p.m) || best.get(p.m) > i + 1) best.set(p.m, i + 1); });
  return best;
}
const CROWN = (c) => `<svg class="crown" viewBox="0 0 24 18" aria-hidden="true"><path d="M2 15h20v3H2zM1 4l5.5 5L12 0l5.5 9L23 4l-2 10H3z" fill="${c}"/></svg>`;
const MEDAL = { 1: ["#f0d27a", "Guld"], 2: ["#d9dde3", "Silver"], 3: ["#cd8a4e", "Brons"] };
const when = (p) => (p.t < base() ? "före mätningen" : `${fmtDate(new Date(p.t))}${p.x ? ` ${hhmm(p.t)}` : ""}`);
function drawCrowns() {
  const cut = cutAt(T), cards = [];
  for (const L of crownLevels()) {
    const p = podium(L, cut);
    const [qc] = TIER[L] || TIER[40];
    const head = `<h4>Level ${L}</h4>`;
    // tomt kort: en rad med de tre kronorna i stället för tre "ledig plats"
    const body = !p.length
      ? `<div class="crown-card__empty"><span class="crown-row">${[1, 2, 3].map((i) => CROWN(MEDAL[i][0])).join("")}</span>Ingen har nått level ${L} än</div>`
      : `<ol>${[0, 1, 2].map((i) => p[i]
        ? `<li data-n="${esc(p[i].m.name)}">${CROWN(MEDAL[i + 1][0])}${pf(p[i].m)}<span class="who" style="color:${CLS[p[i].m.cls]}">${esc(p[i].m.name)}<small>${when(p[i])}</small></span></li>`
        : `<li class="open">${CROWN(MEDAL[i + 1][0])}<span class="who">${MEDAL[i + 1][1]}kronan väntar</span></li>`).join("")}</ol>`;
    // samma kort som achievements: spelets level-ikon i ram, grå tills någon tagit guldet
    cards.push(`<div class="ach crown-card${p.length ? " done" : ""}" style="--q:${qc}"><div class="ach__ico">${ico(`achievement_level_${L}`)}</div><div class="ach__body">${head}${body}</div></div>`);
  }
  $("crowns").innerHTML = cards.join("");
  // Förstafemman: platserna fylls när någon når max level; tomma platser visar de närmast på tur.
  // De som redan var på max när mätningen startade kan inte ta en plats och visas inte som kandidater.
  const five = fiveAt(cut), inFive = new Set(five.map((p) => p.m));
  const early = jm().filter((m) => { const r = reach.get(m)?.get(J.max); return r && r.t < base(); });
  const earlySet = new Set(early);
  const next = inAt(T).filter((m) => !inFive.has(m) && !earlySet.has(m) && lvAt(m, T) < J.max).sort((x, y) => lvAt(y, T) - lvAt(x, T)).slice(0, 5 - five.length);
  $("five").innerHTML = [0, 1, 2, 3, 4].map((i) => {
    const p = five[i];
    if (p) return `<div class="five__slot five__slot--in" data-n="${esc(p.m.name)}"><span class="five__n">${i + 1}</span>${pf(p.m)}<b style="color:${CLS[p.m.cls]}">${esc(p.m.name)}</b><small>${when(p)}</small></div>`;
    const m = next[i - five.length];
    return m ? `<div class="five__slot" data-n="${esc(m.name)}"><span class="five__n">${i + 1}</span>${pf(m)}<b style="color:${CLS[m.cls]}">${esc(m.name)}</b><small>på väg · level ${lvAt(m, T)}, ${J.max - lvAt(m, T)} kvar</small></div>`
      : `<div class="five__slot"><span class="five__n">${i + 1}</span><span class="pf"></span><b>Ledig plats</b><small>vem blir det?</small></div>`;
  }).join("");
  $("fiveLbl").textContent = `${five.length} / 5`;
  $("fiveLbl").title = early.length ? `${nf(early.length)} var redan på level ${J.max} när vi började räkna och kan inte ta en plats.` : "";
}

// ============================================================================
// ACHIEVEMENTS: först till varje tiotal, Förstafemman, gemensamma mål och PvP.
// Ikonerna är spelets egna (wow.export → ach/icons.webp).
// ============================================================================
let ACH = [];
const achEl = $("achs");
const ico = (name) => {
  if (name.startsWith("file:")) return `<i class="ai ai--img" style="background-image:url('${name.slice(5)}')"></i>`;   // egen bild i stället för spriten
  const i = DATA.achIcons[name] ?? 0; return `<i class="ai" style="--ax:${i % 8};--ay:${Math.floor(i / 8)}"></i>`;
};
// Först med en honorable kill: första hk-händelsen under mätningen
const firstHK = (cut) => { const e = J.events.find((e) => e.k === "hk" && J.lv.has(e.m) && e.t >= base() && e.t <= cut); return e ? { m: e.m, t: e.t, x: true } : null; };
// Först till Exalted: första rep-händelsen under mätningen (rykten som fanns redan vid starten räknas inte, som levels)
const firstExalted = (cut) => { const e = J.events.find((e) => e.k === "rep" && J.lv.has(e.m) && e.t >= base() && e.t <= cut); return e ? { m: e.m, t: e.t, x: true, what: e.v } : null; };
const nightDings = (t) => J.events.filter((e) => e.k === "level" && J.lv.has(e.m) && e.t <= cutAt(t) && new Date(e.t).getHours() < 5).length;
const bestDayGain = (t) => Math.max(0, ...jm().map((m) => Math.max(0, ...J.dates.map((_, d) => (d <= t && !(d === joinOf(m) && d > 0) ? gainOn(m, d) : 0)))));
function buildAch() {
  const MAX = J.max, hkTotal = members.reduce((s, m) => s + (m.hk || 0), 0);
  const firsts = [];
  for (let L = 30; L <= MAX; L += 10) firsts.push({ cat: "first", icon: `achievement_level_${Math.min(L, 60)}`, n: `Först till ${L}`, d: `Den första i guilden som når level ${L}.`, pts: 10, L });
  ACH = [
    ...firsts,
    { cat: "first", icon: "achievement_pvp_a_01", n: "Först med en honorable kill", d: "Den första i guilden som tar en honorable kill.", pts: 10, first: firstHK },
    { cat: "first", icon: "achievement_reputation_08", n: "Först till Exalted", d: "Den första i guilden som når Exalted med en faktion.", pts: 10, first: firstExalted },
    { cat: "goal", icon: "achievement_zone_elwynnforest", n: "Första steget", d: "10 medlemmar når level 10.", goal: 10, v: (t) => cnt(t, 10), pts: 10 },
    { cat: "goal", icon: "achievement_zone_ironforge", n: "Fullt hus", d: "100 medlemmar i guilden.", goal: 100, v: (t) => inAt(t).length, pts: 10 },
    { cat: "goal", icon: "achievement_zone_westfall_01", n: "Deadmines-gänget", d: "25 medlemmar når level 18.", goal: 25, v: (t) => cnt(t, 18), pts: 10 },
    { cat: "goal", icon: "achievement_zone_stranglethorn_01", n: "Halvvägs", d: "Någon i guilden når level 30.", goal: 30, v: maxL, pts: 10 },
    { cat: "goal", icon: "achievement_zone_dunmorogh", n: "Mount-klubben", d: "10 medlemmar når level 40.", goal: 10, v: (t) => cnt(t, 40), pts: 25 },
    { cat: "goal", icon: "achievement_zone_blackrock_01", n: "Blackrock kallar", d: "10 medlemmar på level 55 eller högre.", goal: 10, v: (t) => cnt(t, 55), pts: 25 },
    { cat: "goal", icon: "achievement_level_60", n: "Hem på riktigt", d: `Första i guilden når level ${MAX}.`, goal: MAX, v: maxL, pts: 50 },
    { cat: "goal", icon: "achievement_zulgurub_jindo", n: "Redo för raiding", d: `20 medlemmar på level ${MAX}. Nog för en 20-manna.`, goal: 20, v: (t) => cnt(t, MAX), pts: 50 },
    { cat: "goal", icon: "onyxia", n: "Redo för Onyxia", d: `40 medlemmar på level ${MAX}. Då väntar draken.`, goal: 40, v: (t) => cnt(t, MAX), pts: 50 },
    { cat: "goal", icon: "achievement_quests_completed_07", n: "Tusen levels", d: "Guilden har tagit 1 000 levels tillsammans.", goal: 1000, v: (t) => inAt(t).reduce((s, m) => s + lvAt(m, t) - 1, 0), pts: 25 },
    { cat: "goal", icon: "achievement_zone_duskwood", n: "Nattskiftet", d: "50 dings mellan midnatt och fem på morgonen.", goal: 50, v: nightDings, pts: 10 },
    { cat: "goal", icon: "achievement_zone_tanaris_01", n: "Maraton", d: "Någon tar 15 levels på en och samma dag.", goal: 15, v: bestDayGain, pts: 10 },
    // PvP-trappan: guildens honorable kills tillsammans, tio gånger fler för varje steg
    { cat: "pvp", icon: "achievement_pvp_a_03", n: "First Blood", d: "Guilden har tagit 100 honorable kills tillsammans.", goal: 100, v: () => hkTotal, pts: 10, real: true },
    { cat: "pvp", icon: "achievement_pvp_a_07", n: "Tarren Mills blodbad", d: "1 000 honorable kills tillsammans.", goal: 1000, v: () => hkTotal, pts: 10, real: true },
    { cat: "pvp", icon: "achievement_pvp_a_10", n: "Slakthuset", d: "10 000 honorable kills tillsammans.", goal: 10000, v: () => hkTotal, pts: 25, real: true },
    { cat: "pvp", icon: "achievement_pvp_a_14", n: "Massmördarna", d: "100 000 honorable kills tillsammans.", goal: 100000, v: () => hkTotal, pts: 50, real: true },
  ];
  for (const x of ACH) {
    if (x.L) { const f = firstTo[x.L]; x.at = f ? dayOf(f.t) : null; continue; }
    if (x.first) { const f = x.first(Infinity); x.at = f ? dayOf(f.t) : null; continue; }
    if (x.five) { const p = fiveAt(Infinity); x.at = p.length === 5 ? dayOf(p[4].t) : null; continue; }
    x.at = null; for (let t = T_MIN(); t <= LAST; t += .25) if (x.v(t) >= x.goal) { x.at = t; break; }
  }
  const head = { first: "Först till", goal: "Gemensamma mål", pvp: "PvP" };
  let html = "", cat = "";
  for (const [k, x] of ACH.entries()) {
    if (x.cat !== cat) { cat = x.cat; html += `<h3 class="ach-cat">${head[cat]}</h3>`; }
    html += `<div class="ach" data-k="${k}"><div class="ach__ico">${ico(x.icon)}</div><div class="ach__body"><h4>${x.n}</h4><p>${x.d}</p><div class="ach__who"></div><div class="ach__bar"><i></i><span></span></div></div><div class="ach__pts"><b>${x.pts}</b><small></small></div></div>`;
  }
  achEl.innerHTML = html;
}
function fiveAt(cut) {
  const out = [];
  for (const m of jm()) { const r = reach.get(m)?.get(J.max); if (r && r.t >= base() && r.t <= cut) out.push({ m, ...r }); }
  return out.sort((x, y) => x.t - y.t).slice(0, 5);
}
function drawAch(announce) {
  const cut = cutAt(T);
  ACH.forEach((x, k) => {
    const el = achEl.querySelector(`[data-k="${k}"]`); if (!el) return;
    let v, goal, who = [], stamp = null;
    if (x.L) { const p = podium(x.L, cut); who = p.slice(0, 1).map((q) => q.m); v = p.length ? 1 : 0; goal = 1; stamp = p[0]; }
    else if (x.first) { const f = x.first(cut); who = f ? [f.m] : []; v = f ? 1 : 0; goal = 1; stamp = f; el.querySelector("p").textContent = f?.what ? `${x.d.split(".")[0]}: ${f.what}.` : x.d; }
    else if (x.five) { const p = fiveAt(cut); who = p.map((q) => q.m); v = p.length; goal = 5; stamp = p[4]; }
    else { v = x.v(T); goal = x.goal; }
    const ok = x.real ? v >= goal : x.at != null && x.at <= T;
    el.classList.toggle("done", ok);
    el.querySelector(".ach__bar").hidden = !!x.L || !!x.first || ok;
    el.querySelector(".ach__bar i").style.width = `${Math.min(1, v / goal) * 100}%`;
    el.querySelector(".ach__bar span").textContent = `${nf(Math.min(v, goal))} / ${nf(goal)}`;
    el.querySelector(".ach__who").innerHTML = who.map((m) => `<span class="ach__p" data-n="${esc(m.name)}">${pf(m)}<b style="color:${CLS[m.cls]}">${esc(m.name)}</b></span>`).join("");
    el.querySelector(".ach__pts small").textContent = !ok ? "" : stamp ? when(stamp) : !x.real && LAST > 0 ? dLbl(x.at) : "klar";
    if (announce && ok && !x.real && x.at > lastT) toast(x);
  });
  const done = ACH.filter((x, k) => achEl.querySelector(`[data-k="${k}"]`)?.classList.contains("done"));
  $("achSum").innerHTML = `<b>${done.reduce((s, x) => s + x.pts, 0)}</b> poäng · ${done.length} av ${ACH.length} klara`;
}
const toastEl = $("toast"); let toastTO;
function toast(x) {
  toastEl.innerHTML = `<div class="toast__ico">${ico(x.icon)}</div><div><small>Achievement klar</small><strong>${x.n}</strong></div><b class="toast__pts">${x.pts}</b>`;
  toastEl.classList.add("show"); clearTimeout(toastTO); toastTO = setTimeout(() => toastEl.classList.remove("show"), 2600);
}

// ============================================================================
// STATISTIK: levels per dag, klockan, och de lite konstiga utmärkelserna
// ============================================================================
function drawStats() {
  const people = jm(), days = J.dates.length;
  // Båda diagrammen har samma mått och rityta, så att de ligger i linje bredvid varandra
  const W = 880, X0 = 40, X1 = W - 26, Y0 = 200, YT = 44;   // YT: plats ovanför kurvan för etiketter
  const NUM = `font-family="Open Sans, sans-serif" font-size="11"`;
  // mjuk kurva utan att skjuta över: kontrollpunkterna ligger mitt emellan i x-led
  const curve = (pts) => pts.map(([x, yy], i) => (i ? `C${((pts[i - 1][0] + x) / 2).toFixed(1)} ${pts[i - 1][1].toFixed(1)} ${((pts[i - 1][0] + x) / 2).toFixed(1)} ${yy.toFixed(1)} ${x.toFixed(1)} ${yy.toFixed(1)}` : `M${x.toFixed(1)} ${yy.toFixed(1)}`)).join(" ");
  const grad = (id) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9a93f" stop-opacity=".4"/><stop offset="1" stop-color="#d9a93f" stop-opacity="0"/></linearGradient></defs>`;
  const dot = (x, yy, hot, title, stroke = "#d9a93f") => hot
    ? `<circle cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="5.5" fill="#f4ede4" stroke="#f0d27a" stroke-width="2.5"><title>${title}</title></circle>`
    : `<circle cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="2" fill="${stroke}"/><circle cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="10" fill="transparent"><title>${title}</title></circle>`;

  // levels per dag
  const perDay = J.dates.map((_, d) => people.reduce((s, m) => s + gainOn(m, d), 0));
  const best = perDay.indexOf(Math.max(...perDay)), top = Math.max(1, ...perDay);
  const px = (d) => (days > 1 ? X0 + (d / (days - 1)) * (X1 - X0) : (X0 + X1) / 2), y = (v) => Y0 - (v / top) * (Y0 - YT);
  let s = grad("gDay");
  for (const g of [0, .5, 1]) { const v = Math.round(top * g); s += `<line x1="${X0}" x2="${X1}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(244,237,228,.08)"/><text x="${X0 - 8}" y="${y(v) + 4}" text-anchor="end" fill="#6f655d" ${NUM}>${v}</text>`; }
  const dp = perDay.map((v, d) => [px(d), y(v)]);
  if (dp.length > 1) s += `<path d="${curve(dp)} L${dp.at(-1)[0]} ${Y0} L${dp[0][0]} ${Y0}Z" fill="url(#gDay)"/><path d="${curve(dp)}" fill="none" stroke="#d9a93f" stroke-width="2.5"/>`;
  perDay.forEach((v, d) => {
    const hot = d === best && v > 0;
    s += dot(px(d), y(v), hot, `${dLbl(d)}: +${v} levels`);
    if (days <= 16 || d % Math.ceil(days / 14) === 0) s += `<text x="${px(d).toFixed(1)}" y="${Y0 + 22}" text-anchor="middle" fill="${hot ? "#f0d27a" : "#6f655d"}" ${NUM}>${dLbl(d)}</text>`;
    if (hot) s += `<text x="${px(d).toFixed(1)}" y="${(y(v) - 12).toFixed(1)}" text-anchor="${d === 0 ? "start" : d === days - 1 ? "end" : "middle"}" fill="#f0d27a" font-family="Open Sans, sans-serif" font-size="13" font-weight="600">+${v}</text>`;
  });
  $("perDay").innerHTML = s;
  $("perDayRead").innerHTML = perDay.some((v) => v > 0)
    ? `<b>${dLbl(best)}</b> drog mest: <b>+${nf(perDay[best])}</b> levels. Snitt ${nf(Math.round(perDay.reduce((a, b) => a + b, 0) / days))} per dag.`
    : "Kurvan växer för varje dag vi spelar.";

  // när på dygnet vi dingar, med dygnsrytmen: sova 23–06, jobba 06–17, ledig tid 17–23
  const dings = J.events.filter((e) => e.k === "level" && J.lv.has(e.m));
  const hours = Array(24).fill(0); dings.forEach((e) => hours[new Date(e.t).getHours()]++);
  const hm = Math.max(1, ...hours), peak = hours.indexOf(hm);
  const hx = (t) => X0 + ((t + .5) / 24) * (X1 - X0), hy = (v) => Y0 - (v / hm) * (Y0 - YT);   // timme t sitter mitt i sin ruta
  const PHASES = [
    { n: "Sova", from: 23, to: 6, c: "122,134,214" },   // bannerns blå, ljusare
    { n: "Jobba", from: 6, to: 17, c: "163,151,140" },
    { n: "Ledig tid", from: 17, to: 23, c: "240,210,122" },
  ];
  const inPhase = (p, h) => (p.from < p.to ? h >= p.from && h < p.to : h >= p.from || h < p.to);
  const band = (a, b, c) => `<rect x="${hx(a - .5).toFixed(1)}" y="${YT - 30}" width="${(hx(b - .5) - hx(a - .5)).toFixed(1)}" height="${Y0 - YT + 30}" fill="rgba(${c},.07)"/>`;
  let hsv = grad("gHour");
  for (const p of PHASES) {
    hsv += p.from < p.to ? band(p.from, p.to, p.c) : band(p.from, 24, p.c) + band(0, p.to, p.c);
    const mid = p.from < p.to ? (p.from + p.to) / 2 - .5 : 2.5;   // sömnetiketten hamnar över natten
    hsv += `<text x="${hx(mid).toFixed(1)}" y="${YT - 14}" text-anchor="middle" fill="rgb(${p.c})" font-family="Marcellus, Georgia, serif" font-size="13" font-weight="600" letter-spacing="2"><title>${String(p.from).padStart(2, "0")}–${String(p.to).padStart(2, "0")}</title>${p.n.toUpperCase()}</text>`;
  }
  const hp = hours.map((v, h) => [hx(h), hy(v)]);
  hsv += `<path d="${curve(hp)} L${hx(23)} ${Y0} L${hx(0)} ${Y0}Z" fill="url(#gHour)"/><path d="${curve(hp)}" fill="none" stroke="#d9a93f" stroke-width="2.5"/>`;
  hours.forEach((v, h) => {
    const hot = h === peak && v > 0;
    hsv += dot(hx(h), hy(v), hot, `${String(h).padStart(2, "0")}:00: ${v} dings`);
    if (h % 3 === 0) hsv += `<text x="${hx(h).toFixed(1)}" y="${Y0 + 22}" text-anchor="middle" fill="#6f655d" ${NUM}>${String(h).padStart(2, "0")}</text>`;
    // bredvid punkten, inte ovanför: toppen når taket där fasrubrikerna (SOVA/JOBBA/LEDIG TID) sitter
    if (hot) hsv += `<text x="${(hx(h) + (h > 20 ? -12 : 12)).toFixed(1)}" y="${(hy(v) + 4).toFixed(1)}" text-anchor="${h > 20 ? "end" : "start"}" fill="#f0d27a" font-family="Open Sans, sans-serif" font-size="13" font-weight="600">kl ${String(h).padStart(2, "0")}</text>`;
  });
  $("hours").innerHTML = hsv;
  const share = PHASES.map((p) => Math.round((hours.reduce((s, v, h) => s + (inPhase(p, h) ? v : 0), 0) / Math.max(1, dings.length)) * 100));
  $("hoursRead").innerHTML = dings.length
    ? `<b>${share[0]} %</b> av dingarna togs när man borde sova, <b>${share[1]} %</b> på arbetstid och <b>${share[2]} %</b> på ledig tid. Flest kl <b>${String(peak).padStart(2, "0")}–${String((peak + 1) % 24).padStart(2, "0")}</b>.`
    : "Här syns snart när på dygnet vi dingar.";

  // utmärkelserna
  const top1 = (list, v) => list.map((m) => [m, v(m)]).filter(([, x]) => x != null && x > 0).sort((a, b) => b[1] - a[1])[0];
  const byM = new Map(); dings.forEach((e) => (byM.get(e.m) || byM.set(e.m, []).get(e.m)).push(e));
  const sessions = J.events.filter((e) => e.k === "logout" && e.v && J.lv.has(e.m)).map((e) => ({ m: e.m, len: e.t - e.v, start: e.v }));
  const streak = (m, hot) => {
    const arr = L_(m), j = joinOf(m); let best = 0, run = 0, cur = 0;
    for (let d = j; d <= LAST; d++) { const on = gainOn(m, d) > 0; run = on === hot ? run + 1 : 0; best = Math.max(best, run); if (d === LAST) cur = run; }
    return { best, cur, maxed: arr[LAST] >= J.max };
  };
  const cards = [];
  const add = (key, lbl, hit, val, sub) => cards.push({ key, lbl, m: hit && hit[0], val: hit ? val(hit[1]) : null, sub: hit ? sub(hit[0], hit[1]) : "" });
  add("rocket", "Raketen", top1(people, (m) => J.dates.reduce((s, _, d) => s + gainOn(m, d), 0)), (v) => `+${v}`, (m) => `levels sedan start, nu ${L_(m)[LAST]}`);
  add("week", "Veckans raket", top1(people, gainedWeek), (v) => `+${v}`, () => "levels senaste 7 dagarna");
  // (dagen någon gick med räknas inte: de kan ha levlat innan de kom hem)
  const dayGain = (m, d) => (d === joinOf(m) && d > 0 ? 0 : gainOn(m, d));
  const mara = top1(people, (m) => Math.max(0, ...J.dates.map((_, d) => dayGain(m, d))));
  add("marathon", "Maratondagen", mara, (v) => `+${v}`, (m, v) => `levels på en dag, ${dLbl(J.dates.findIndex((_, d) => dayGain(m, d) === v))}`);
  add("hot", "Het streak", top1(people, (m) => streak(m, true).best), (v) => `${v} d`, (m) => `i rad med minst en ding${streak(m, true).cur === streak(m, true).best ? ", pågår" : ""}`);
  add("cold", "Kall streak", top1(people.filter((m) => !streak(m, false).maxed && gainOn(m, joinOf(m)) >= 0 && L_(m)[LAST] > 1), (m) => streak(m, false).cur), (v) => `${v} d`, () => "utan ding, och räknar");
  const longS = sessions.reduce((a, s) => (!a || s.len > a.len ? s : a), null);
  cards.push({ key: "session", lbl: "Längsta passet", m: longS && longS.m, val: longS ? dur(longS.len) : null, sub: longS ? `${dLbl(J.dates.findIndex((d) => d.toDateString() === new Date(longS.start).toDateString()))}, från kl ${hhmm(longS.start)} · uppskattat` : "" });
  add("owl", "Nattugglan", top1(people, (m) => (byM.get(m) || []).filter((e) => new Date(e.t).getHours() < 5).length), (v) => `${v}`, () => "dings mellan 00 och 05");
  add("early", "Morgonpigg", top1(people, (m) => (byM.get(m) || []).filter((e) => { const h = new Date(e.t).getHours(); return h >= 5 && h < 9; }).length), (v) => `${v}`, () => "dings före kl 09");
  const fast = []; byM.forEach((list, m) => { for (let k = 1; k < list.length; k++) { const g = list[k].t - list[k - 1].t; if (g > 5 * 60e3 && list[k].v === list[k - 1].v + 1) fast.push({ m, g, v: list[k].v }); } });
  const f1 = fast.sort((a, b) => a.g - b.g)[0];
  cards.push({ key: "flash", lbl: "Blixten", m: f1 && f1.m, val: f1 ? dur(f1.g) : null, sub: f1 ? `från ${f1.v - 1} till ${f1.v}` : "" });
  add("comeback", "Comebacken", top1(people, (m) => { let run = 0, best = 0; for (let d = joinOf(m) + 1; d <= LAST; d++) { if (gainOn(m, d) > 0) { best = Math.max(best, run); run = 0; } else run++; } return best; }), (v) => `${v} d`, () => "borta, och sedan tillbaka med en ding");
  const nSess = new Map(); J.events.filter((e) => e.k === "login" && J.lv.has(e.m)).forEach((e) => nSess.set(e.m, (nSess.get(e.m) || 0) + 1));
  add("sessions", "Stammisen", top1(people, (m) => nSess.get(m)), (v) => `${v}`, () => "inloggningar");
  const total = sessions.reduce((a, s) => a + s.len, 0);
  cards.push({ key: "total", lbl: "Guildens speltid", m: null, val: total ? `${nf(Math.round(total / 36e5))} h` : null, sub: total ? `på ${nf(sessions.length)} pass · uppskattat` : "" });

  $("quirks").innerHTML = cards.map((c) => `<div class="qk${c.m ? "" : " qk--guild"}${c.val != null ? " done" : ""}"${c.m ? ` data-n="${esc(c.m.name)}"` : ""}>
      <span class="qk__lbl">${c.lbl}</span>
      ${c.m ? `<div class="qk__who">${pf(c.m)}<b style="color:${CLS[c.m.cls]}">${esc(c.m.name)}</b></div>` : c.key === "total" ? `<div class="qk__who"><svg class="qk__sig"><use href="#sigil"/></svg><b>Hela guilden</b></div>` : ""}
      <strong class="qk__val">${c.val ?? "–"}</strong><span class="qk__sub">${c.val != null ? esc(c.sub) : "avgörs om några dagar"}</span></div>`).join("");
}

// ============================================================================
// TIDSLINJEN
// ============================================================================
const tIn = $("t"), playBtn = $("play"), playIco = $("playIco");
function useJourney(j) {
  stop();
  J = j; LAST = J.dates.length - 1; T = LAST; lastT = T;
  $("resanEyebrow").innerHTML = `<span>${DEMO_MODE ? "Följ resan" : "Resan"} till ${NUM(J.max)}</span>`;
  // bara hur färsk datan är; datumet syns först när det inte är idag
  const gen = new Date(DATA.generated.replace(" ", "T"));
  $("srcRoster").textContent = DEMO_MODE ? "Förhandsvisning · exempeldata" : `Uppdaterad ${gen.toDateString() === new Date().toDateString() ? "" : `${fmtDate(gen)} `}${hhmm(gen)}`;
  $("player").hidden = LAST === 0;
  tIn.min = T_MIN(); tIn.max = LAST; tIn.step = 1 / 48;   // en halvtimme
  indexEvents(); computeFirsts(); buildBoard(); buildAch(); drawStats(); drawTicker();
  setT(LAST);
  drawChart();
  drawNewbies();
  buildDung();
}
function setT(t, announce = false) {
  T = Math.max(T_MIN(), Math.min(LAST, t));
  tIn.value = T; tIn.style.setProperty("--p", `${LAST - T_MIN() ? ((T - T_MIN()) / (LAST - T_MIN())) * 100 : 100}%`);
  const at = new Date(Math.min(cutAt(T), NOW()));
  $("dayLbl").innerHTML = T >= LAST ? `<b>${dLbl(LAST)}</b><span>idag</span>` : `<b>${fmtDate(at)}</b><span>kl ${hhmm(at)}</span>`;
  drawBoard(); drawAch(announce); lastT = T;
}
tIn.addEventListener("input", () => setT(+tIn.value, +tIn.value > lastT));
let timer = null;
const PLAY = `<path d="M7 4l13 8-13 8z"/>`, PAUSE = `<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>`;
function stop() { clearInterval(timer); timer = null; playIco.innerHTML = PLAY; playBtn.setAttribute("aria-label", "Spela upp"); }
playBtn.addEventListener("click", () => {
  $("playHint").hidden = true;
  if (timer) return stop();
  if (T >= LAST) setT(T_MIN());
  playIco.innerHTML = PAUSE; playBtn.setAttribute("aria-label", "Pausa");
  timer = setInterval(() => { if (T >= LAST) return stop(); setT(T + Math.max(1 / 48, (LAST - T_MIN()) / 60), true); }, 400);
});
// ============================================================================
// TOPPLISTOR (nuläget)
// ============================================================================
const BOARDS = [
  { n: "Item level", ic: "inv_chest_plate03", v: (m) => m.ilvl, f: nf },
  { n: "Honorable kills", ic: "achievement_pvp_a_01", v: (m) => m.hk, f: nf },
  { n: "PvP-rank", ic: "achievement_pvp_a_14", v: (m) => m.pvpRank, f: (v) => `Rank ${v}` },
  { n: "Attack power", ic: "inv_sword_04", v: (m) => m.ap, f: nf },
  { n: "Spell power", ic: "inv_wand_07", v: (m) => m.sp, f: nf },
  { n: "Healing power", ic: "inv_jewelry_talisman_07", v: (m) => (m.role === "healer" ? m.heal : null), f: nf },   // ur utrustningen, bara healers
  { n: "Mest HP", ic: "inv_shield_05", v: (m) => m.hp, f: nf },
];
const BOARD = (n) => BOARDS.find((b) => b.n === n);
const RENDERS = "renders/";   // bygget byter mappen för testsidor (--name)
let lbI = 0, lbC = null;
$("lbTabs").innerHTML = BOARDS.map((b, i) => `<button class="btn btn--ghost btn--sm" type="button" data-b="${i}" aria-pressed="${i === 0}">${b.n}</button>`).join("");
$("lbCls").innerHTML = `<button type="button" class="all" data-c="" aria-pressed="true">Alla klasser</button>` + ORDER.filter((c) => members.some((m) => m.cls === c)).map((c) => `<button type="button" data-c="${c}" style="background:${CLS[c]}" aria-pressed="false" aria-label="${CLS_NAME[c]}" title="${CLS_NAME[c]}"></button>`).join("");
$("lbTabs").addEventListener("click", (e) => { const b = e.target.closest("[data-b]"); if (!b) return; lbI = +b.dataset.b; document.querySelectorAll("#lbTabs [data-b]").forEach((x) => x.setAttribute("aria-pressed", x === b)); drawLb(); });
$("lbCls").addEventListener("click", (e) => { const b = e.target.closest("[data-c]"); if (!b) return; lbC = b.dataset.c || null; document.querySelectorAll("#lbCls [data-c]").forEach((x) => x.setAttribute("aria-pressed", x === b)); drawLb(); });
const rankIn = (B, m) => members.filter((x) => B.v(x) != null).sort((a, b) => B.v(b) - B.v(a)).indexOf(m) + 1;
function drawLb() {
  const B = BOARDS[lbI];
  const list = members.filter((m) => (!lbC || m.cls === lbC) && B.v(m) != null && B.v(m) > 0).sort((a, b) => B.v(b) - B.v(a));
  const top = list.slice(0, 3), rest = list.slice(3, 15), max = (list.length && B.v(list[0])) || 1;
  // Pallen i föremålskvaliteternas färger, som kronkorten: 1 Legendary, 2 Epic, 3 Rare
  const PODQ = { 1: ["#ff8000", "Legendary"], 2: ["#a335ee", "Epic"], 3: ["#0070dd", "Rare"] };
  // helkroppsbilden (Blizzards rendering i riktig utrustning) står på lådorna; saknas den visas porträttet
  const CRATES = { 1: 2, 2: 1, 3: 1 };   // ettan står på två staplade lådor
  const pod = (m, place) => m ? `<div class="pod pod--${place}${m.render ? " has-fig" : ""}" data-n="${esc(m.name)}" style="--q:${PODQ[place][0]}"><span class="pod__stand">${m.render
    ? `<img class="pod__fig" src="${RENDERS}${m.render}.webp" alt="">` : pf(m)}</span><div class="crates">${"<i></i>".repeat(CRATES[place])}</div><div class="pod__info"><span>${place}</span><b style="color:${CLS[m.cls]}">${esc(m.name)}</b><i class="v">${B.f(B.v(m))}</i></div></div>` : `<div></div>`;
  $("podium").innerHTML = pod(top[1], 2) + pod(top[0], 1) + pod(top[2], 3);
  // rubriken för vald lista, med din egen plats om du sagt vem du är
  const mine = ME ? list.indexOf(ME) : -1;
  $("lbTitle").innerHTML = `<div class="ach__ico">${ico(B.ic)}</div><div><h3>${B.n}</h3><p>${!list.length ? "Ingen på listan än"
    : mine >= 0 ? `Du ligger på plats <b>${nf(mine + 1)}</b> av ${nf(list.length)}` : `${nf(list.length)} på listan${lbC ? ` · ${CLS_NAME[lbC]}` : ""}`}</p></div>`;
  const row = (m, n, sub) => `<div class="lb-row${m === ME ? " me" : ""}" data-n="${esc(m.name)}" style="--c:${CLS[m.cls]}"><span class="n">${n}</span>${pf(m)}<span class="who" style="color:${CLS[m.cls]}">${esc(m.name)}<small>${sub}</small></span><span class="bar"><i style="width:${(B.v(m) / max) * 100}%"></i></span><span class="v">${B.f(B.v(m))}</span></div>`;
  let rows = rest.map((m, i) => row(m, i + 4, `level ${m.level} ${CLS_NAME[m.cls]}`)).join("");
  if (ME && list.includes(ME)) { const r = list.indexOf(ME); if (r >= 15) rows += row(ME, r + 1, "du"); }
  $("lbList").innerHTML = rows || `<p class="lfg__empty">Ingen data för den här listan.</p>`;
}

// ============================================================================
// GRUPPSÖK: vem kan köra vilken dungeon, med föreslagen grupp (tank, healer, 3 dps).
// ============================================================================
// [namn, från, till, ny i Forever, var]. De nya dungeons har nivåerna från Forevers dungeonlista (uppdaterad 29 sep)
const DUNG_ALL = [
  ["Ragefire Chasm", 13, 18], ["Hall of Thanes", 13, 18, true, "under Ironforge"], ["Ruins of Lordaeron", 15, 20, true, "Tirisfal Glades"],
  ["Wailing Caverns", 17, 24], ["Deadmines", 17, 26], ["Shadowfang Keep", 22, 30], ["Blackfathom Deeps", 24, 32], ["Stockade", 24, 32],
  ["Excavation Site", 24, 29, true, "Wetlands"], ["City of Dalaran", 28, 30, true, "Alterac Mountains"],
  ["Gnomeregan", 29, 38], ["Razorfen Kraul", 29, 38], ["Scarlet Monastery", 30, 45], ["The Drowned City", 35, 50, true, "Stranglethorn Vale"],
  ["Razorfen Downs", 37, 46], ["Krol'dok Stronghold", 40, 55, true, "Riverglades"], ["Uldaman", 41, 51], ["Zul'Farrak", 44, 54], ["Maraudon", 46, 55],
  ["Alcaz Island Prison", 48, 53, true, "Alcaz Island"], ["Sunken Temple", 50, 60], ["Blackrock Depths", 52, 60],
  ["Blackmaw Hold", 55, 60, true, "Azshara"], ["Dire Maul", 55, 60], ["Lower Blackrock", 55, 60],
  ["Shaper's Terrace", 58, 60, true, "Un'Goro Crater"], ["Scholomance", 58, 60], ["Stratholme", 58, 60], ["Upper Blackrock", 58, 60]];
let dungF = "new";   // nya i Forever (standard), alla eller bara klassiska
const ROLE_NAME = { tank: "Tank", healer: "Healer", dps: "DPS" };
const ROLE_ICO = {
  tank: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1l6 2v5c0 3.5-2.6 6-6 7-3.4-1-6-3.5-6-7V3z" fill="currentColor"/></svg>`,
  healer: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 1h4v5h5v4h-5v5H6v-5H1V6h5z" fill="currentColor"/></svg>`,
  dps: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 1H15v1.5L7 10.5 5.5 9zM4 9.5l2.5 2.5-1 1 -1-.5L3 14l-1-1 1.5-1.5-.5-1z" fill="currentColor"/></svg>`,
};
const role = (m) => m.role || "dps";
const lfgLvl = (m) => m.level;
let DUNG = [], dung = 0, roleF = null, shuffle = 0;
function buildDung() {
  DUNG = DUNG_ALL.filter(([, a, , isNew]) => a <= J.max && (dungF === "all" || (dungF === "new") === !!isNew));
  const counts = DUNG.map(([, a, b]) => members.filter((m) => { const L = lfgLvl(m); return L != null && L >= a && L <= b; }).length);
  const mine = ME && lfgLvl(ME) != null ? DUNG.findIndex(([, a, b]) => lfgLvl(ME) >= a && lfgLvl(ME) <= b) : -1;
  dung = mine >= 0 ? mine : counts.indexOf(Math.max(...counts));
  $("chips").innerHTML = DUNG.map(([n, , , isNew], i) => `<button class="btn btn--ghost btn--sm${isNew ? " is-new" : ""}" type="button" data-d="${i}" aria-pressed="${i === dung}">${isNew ? '<i class="new-tag">Ny</i>' : ""}${n} <small class="chip-n">${counts[i]}</small></button>`).join("");
  document.querySelectorAll("#dungF [data-f]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.f === dungF));
  roleF = null; shuffle = 0;
  drawLfg();
}
$("chips").addEventListener("click", (e) => { const b = e.target.closest("[data-d]"); if (b) pickDung(+b.dataset.d); });
$("dungF").addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (b) { dungF = b.dataset.f; buildDung(); } });
function pickDung(i) { dung = i; roleF = null; shuffle = 0; document.querySelectorAll("#chips [data-d]").forEach((x) => x.setAttribute("aria-pressed", +x.dataset.d === i)); drawLfg(); }
function drawLfg() {
  const [n, a, b] = DUNG[dung];
  $("lfgLede").innerHTML = `<span>– Mamma, kan vi köra ${esc(n)}?</span><span>– Vi har ${esc(n)} hemma.</span>`;
  const all = members.filter((m) => { const L = lfgLvl(m); return L != null && L >= a && L <= b; }).sort((x, y) => (y.last || 0) - (x.last || 0));
  const count = { tank: 0, healer: 0, dps: 0 }; all.forEach((m) => count[role(m)]++);

  // föreslagen grupp: du själv först om du passar, sedan de som var inloggade senast
  const used = new Set(), slots = [];
  const pickFrom = (r) => {
    let pool = all.filter((m) => role(m) === r && !used.has(m));
    if (ME && pool.includes(ME)) return ME;
    if (!pool.length) return null;
    return pool[shuffle % pool.length];
  };
  for (const r of ["tank", "healer", "dps", "dps", "dps"]) { const m = pickFrom(r); if (m) used.add(m); slots.push([r, m]); }
  const missing = slots.filter(([, m]) => !m).map(([r]) => ROLE_NAME[r].toLowerCase());
  const [, , , isNew, where] = DUNG[dung];
  $("party").innerHTML = `<div class="party__head"><b>${esc(n)} hemma:</b><span>level ${a}–${b}</span>${isNew ? `<em class="new-line"><i class="new-tag">Ny i Forever</i>${esc(where)}</em>` : ""}</div>`
    + slots.map(([r, m]) => m
      ? `<div class="party__slot"><span class="role role--${r}" title="${ROLE_NAME[r]}">${ROLE_ICO[r]}</span>${pf(m)}<span class="who" data-n="${esc(m.name)}" style="color:${CLS[m.cls]}">${esc(m.name)}${m === ME ? " (du)" : ""}<small>${lfgLvl(m)} ${esc(m.spec || CLS_NAME[m.cls])}</small></span><span class="seen">${ago(m.last)}</span></div>`
      : `<div class="party__slot party__slot--empty"><span class="role role--${r}">${ROLE_ICO[r]}</span><span class="who">Ingen ${ROLE_NAME[r].toLowerCase()} på rätt level<small>fråga i Discord eller ta med en kompis</small></span></div>`).join("")
    + `<div class="party__foot"><button class="btn btn--ghost btn--sm" type="button" id="reroll">Ny grupp</button><button class="btn btn--primary btn--sm" type="button" id="invite"${slots.some(([, m]) => m && m !== ME) ? "" : " disabled"}>Kopiera /inv</button></div>`
    + (missing.length ? `<p class="party__miss">Saknas: ${missing.join(", ")}</p>` : "");

  // listan är "fler": de som redan står i gruppförslaget visas inte två gånger
  const rest = all.filter((m) => !used.has(m));
  const rc = { tank: 0, healer: 0, dps: 0 }; rest.forEach((m) => rc[role(m)]++);
  const list = rest.filter((m) => !roleF || role(m) === roleF).slice(0, 12);
  $("lfg").innerHTML = `<div class="lfg__head"><b>Fler i HEMMET som kan köra ${esc(n)}</b><span>level ${a}${b > a ? `–${b}` : ""} · ${all.length} i guilden</span>
      <div class="rolef">${[["", "Alla", rest.length], ...["tank", "healer", "dps"].map((r) => [r, ROLE_NAME[r], rc[r]])].map(([r, l, c]) => `<button type="button" data-r="${r}" aria-pressed="${(roleF || "") === r}">${r ? ROLE_ICO[r] : ""}${l} <small>${c}</small></button>`).join("")}</div></div>`
    + (list.length
      ? list.map((m) => `<div class="lfg__row"><span class="role role--${role(m)}" title="${ROLE_NAME[role(m)]}">${ROLE_ICO[role(m)]}</span>${pf(m)}<span class="who" data-n="${esc(m.name)}">${esc(m.name)}<small>${lfgLvl(m)} ${esc(m.spec || "")} ${CLS_NAME[m.cls]}</small></span><span class="seen">${ago(m.last)} sedan</span><button class="btn btn--ghost btn--sm" type="button" data-w="${esc(m.name)}">/w</button></div>`).join("")
      : `<p class="lfg__empty">${all.length ? "Alla som kan står redan i gruppen ovan." : `Ingen i guilden har rätt level för ${esc(n)} just nu.`}</p>`);
  $("party").dataset.names = slots.filter(([, m]) => m && m !== ME).map(([, m]) => m.name).join(",");
}
async function copyTo(btn, text, label) {
  try { await navigator.clipboard.writeText(text); btn.textContent = "Kopierat"; } catch (err) { btn.textContent = text.replace(/\n/g, " · "); }
  setTimeout(() => (btn.textContent = label), 1800);
}
$("lfg").addEventListener("click", (e) => {
  const r = e.target.closest("[data-r]"); if (r) { roleF = r.dataset.r || null; return drawLfg(); }
  const b = e.target.closest("[data-w]"); if (b) copyTo(b, `/w ${b.dataset.w} Hej! Sugen på ${DUNG[dung][0]}?`, "/w");
});
$("party").addEventListener("click", (e) => {
  if (e.target.closest("#reroll")) { shuffle++; return drawLfg(); }
  const inv = e.target.closest("#invite");
  if (inv) copyTo(inv, $("party").dataset.names.split(",").filter(Boolean).map((n) => `/inv ${n}`).join("\n"), "Kopiera /inv");
});

// ============================================================================
// JÄMFÖR: stats (nuläget) + levelkurvor (resan)
// ============================================================================
const cmpA = $("cmpA"), cmpB = $("cmpB"), chart = $("chart");
function drawCompare() {
  const A = byName[cmpA.value.trim().toLowerCase()], B = byName[cmpB.value.trim().toLowerCase()];
  if (!A || !B) { $("vs").innerHTML = `<p class="lfg__empty">Skriv två namn från guilden.</p>`; return; }
  const rows = [["Level", (m) => m.level], ["Item level", (m) => m.ilvl], ["HP", (m) => m.hp], ["Honorable kills", (m) => m.hk], ["PvP-rank", (m) => m.pvpRank],
    ["Attack power", (m) => m.ap], ["Spell power", (m) => m.sp], ["Crit %", (m) => m.crit]];
  let wa = 0, wb = 0;
  const body = rows.map(([n, f]) => {
    const a = f(A), b = f(B), x = a != null && b != null && a > b, y = a != null && b != null && b > a;
    wa += x; wb += y;
    const show = (v) => (n === "Crit %" && v != null ? v.toFixed(1) : nf(v));
    return `<div class="vs__row"><b class="${x ? "win" : ""}">${show(a)}</b><span>${n}</span><b class="${y ? "win" : ""}">${show(b)}</b></div>`;
  }).join("");
  $("vs").innerHTML = `<div class="vs__head"><div>${pf(A)}<span style="color:${CLS[A.cls]}">${esc(A.name)}</span></div><span></span><div>${pf(B)}<span style="color:${CLS[B.cls]}">${esc(B.name)}</span></div></div>${body}`;
  $("cmpRead").innerHTML = `<div><b>${wa === wb ? "Oavgjort" : esc(wa > wb ? A.name : B.name)}</b> ${wa === wb ? `${wa}–${wb}` : `vinner ${Math.max(wa, wb)}–${Math.min(wa, wb)}`}</div>`
    + `<div>${esc(A.name)}: inloggad för ${ago(A.last)} sedan</div><div>${esc(B.name)}: inloggad för ${ago(B.last)} sedan</div>`;
  drawChart();
}
function drawChart() {
  const A = byName[cmpA.value.trim().toLowerCase()], B = byName[cmpB.value.trim().toLowerCase()];
  $("chartBox").hidden = LAST === 0 || !A || !B;
  if ($("chartBox").hidden) return;
  const MAX = J.max, X0 = 44, X1 = 690, Y0 = 300, Y1 = 16, x = (d) => X0 + (d / LAST) * (X1 - X0), y = (L) => Y0 - (L / MAX) * (Y0 - Y1);
  const F = `font-family="Open Sans, sans-serif" font-size="11"`;
  let s = "";
  for (let L = 0; L <= MAX; L += 10) s += `<line x1="${X0}" x2="${X1}" y1="${y(L)}" y2="${y(L)}" stroke="rgba(244,237,228,.08)"/><text x="${X0 - 10}" y="${y(L) + 4}" text-anchor="end" fill="#6f655d" ${F}>${L}</text>`;
  const step = Math.max(1, Math.ceil(J.dates.length / 12));
  for (let d = 0; d <= LAST; d += step) s += `<text x="${x(d)}" y="${Y0 + 22}" text-anchor="middle" fill="#6f655d" ${F}>${dLbl(d)}</text>`;
  s += `<text x="${(X0 + X1) / 2}" y="${Y0 + 44}" text-anchor="middle" fill="#6f655d" font-family="Marcellus, Georgia, serif" font-size="11" letter-spacing="3">LEVEL PER DAG</text>`;
  const pts = (p) => p.map(([d, L]) => `${x(d).toFixed(1)},${y(L).toFixed(1)}`).join(" ");
  const series = (m) => L_(m).map((L, d) => (L == null ? null : [d, L])).filter(Boolean);
  const labels = [], medPts = [];
  for (let d = 0; d <= LAST; d++) medPts.push([d, median(d)]);
  s += `<polyline points="${pts(medPts)}" fill="none" stroke="#6f655d" stroke-width="1.5" stroke-dasharray="5 6"/>`; labels.push([medPts.at(-1)[1], "Guildens mitt", "#a3978c"]);
  for (const [m, col] of [[B, "#d9a93f"], [A, "#f4ede4"]]) {
    const p = series(m); if (!p.length) continue;
    s += `<polyline points="${pts(p)}" fill="none" stroke="${col}" stroke-width="3" stroke-linejoin="round"/><circle cx="${x(p.at(-1)[0])}" cy="${y(p.at(-1)[1])}" r="5" fill="${col}" stroke="#140d04" stroke-width="2"/>`;
    labels.push([p.at(-1)[1], `${m.name} · ${p.at(-1)[1]}`, col]);
  }
  labels.sort((a, b) => b[0] - a[0]); let prev = -99;
  for (const [L, t, col] of labels) { const yy = Math.max(y(L) + 4, prev + 18); prev = yy; s += `<text x="${X1 + 12}" y="${yy}" fill="${col}" font-family="Marcellus, Georgia, serif" font-size="17">${esc(t).replace(/ · (\d+)$/, ' · <tspan font-family="Open Sans, sans-serif" font-weight="600" font-size="15">$1</tspan>')}</text>`; }
  chart.innerHTML = s;
}
cmpA.addEventListener("change", drawCompare); cmpB.addEventListener("change", drawCompare);

// ============================================================================
// NYA HEMMA (resan)
// ============================================================================
function drawNewbies() {
  const fresh = LAST > 0 ? jm().filter((m) => joinOf(m) > 0 && joinOf(m) >= LAST - 6).sort((a, b) => joinOf(b) - joinOf(a)) : [];
  const n = J.dates.map((_, d) => jm().filter((m) => L_(m)[d] != null).length);
  let spark = "";
  if (LAST > 0) {
    const W = 260, H = 70, xs = (i) => (i / LAST) * W, lo = Math.min(...n) * .95, hi = Math.max(...n), ys = (v) => H - ((v - lo) / Math.max(1, hi - lo)) * (H - 6);
    spark = `<svg viewBox="0 -4 ${W} ${H + 8}" width="${W}" style="max-width:100%;height:auto" aria-label="Antal medlemmar per dag"><polyline points="${n.map((v, i) => `${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(" ")}" fill="none" stroke="#f0d27a" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
  }
  $("growth").innerHTML = `<div class="growth__n">${n.at(-1)}</div><div class="growth__l">hemma idag${LAST > 0 ? `<small><b>+${fresh.length}</b> senaste veckan</small>` : ""}</div>${spark}`;
  $("newbies").innerHTML = fresh.length
    ? fresh.map((m) => `<div class="newbie">${pf(m)}<b style="color:${CLS[m.cls]}">${esc(m.name)}</b><span>kom hem ${dLbl(joinOf(m))} · level ${L_(m)[LAST]} ${CLS_NAME[m.cls]}</span><button class="btn btn--primary btn--sm" type="button" data-w="${esc(m.name)}">Säg hej</button></div>`).join("")
    : `<p class="lfg__empty">${LAST > 0 ? "Inga nya medlemmar den senaste veckan." : "Nya medlemmar syns här när rostern har jämförts över några dagar."}</p>`;
}
$("newbies").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-w]"); if (!b) return;
  try { await navigator.clipboard.writeText(`/w ${b.dataset.w} Välkommen hem!`); b.textContent = "Kopierat"; } catch (err) { b.textContent = `/w ${b.dataset.w} Välkommen hem!`; }
  setTimeout(() => (b.textContent = "Säg hej"), 1800);
});

// ============================================================================
// SOFTRES-DEMO (i FAQ:n)
// ============================================================================
{
  const box = $("sr");
  const who = members.filter((m) => m.level === RMAX).slice(3, 7);
  box.innerHTML = `<div class="sr-item"><div class="sr-item__ico"></div><div><h4>Swift Razzashi Raptor</h4><small>Zul'Gurub · Bloodlord Mandokir · ${who.length} har reserverat</small></div></div>
    <div class="sr-rolls">${who.map((m) => `<div class="sr-roll"><span style="color:${CLS[m.cls]}">${esc(m.name)}</span><div class="sr-roll__bar"><i></i></div><b>–</b></div>`).join("")}</div>
    <div class="sr-foot"><p id="srMsg">Föremålet föll. De som reserverat rullar.</p><button class="btn btn--primary btn--sm" type="button" id="srRoll">Rulla</button></div>`;
  $("srRoll").addEventListener("click", () => {
    const rolls = who.map(() => 1 + Math.floor(Math.random() * 100)), best = Math.max(...rolls), win = rolls.indexOf(best);
    box.querySelectorAll(".sr-roll").forEach((el, i) => {
      el.classList.remove("win"); el.querySelector("i").style.width = "0";
      const b = el.querySelector("b"), t0 = performance.now();
      const step = (t) => { const p = Math.min(1, (t - t0) / 900); b.textContent = Math.max(1, Math.round(rolls[i] * p)); if (p < 1) requestAnimationFrame(step); else if (i === win) el.classList.add("win"); };
      requestAnimationFrame(step);
      setTimeout(() => (el.querySelector("i").style.width = `${rolls[i]}%`), 20);
    });
    setTimeout(() => ($("srMsg").innerHTML = `<b style="color:${CLS[who[win].cls]}">${esc(who[win].name)}</b> vinner med ${best}.`), 950);
  });
}

// ============================================================================
// ARMORY (nuläget)
// ============================================================================
const armory = $("armory");
function openArmory(m) {
  if (!m) return;
  tip.hidden = true;
  const z = zoneOf(m.level), half = Math.ceil(m.gear.length / 2);
  const gear = ([slot, name, q, il, ic]) => `<div class="gear" style="--q:${Q[q] || "#fff"}"><i class="${ic >= 0 ? "img" : ""}" style="--ix:${ic % DATA.ic.cols};--iy:${Math.floor(ic / DATA.ic.cols)}"></i><b>${esc(name)}</b><small>${SLOT[slot] || ""}${il ? ` · ilvl ${il}` : ""}</small></div>`;
  const stat = (v, label, B) => `<div><b>${v}</b><span>${label}${B && B.v(m) ? ` · #${rankIn(B, m)}` : ""}</span></div>`;
  armory.innerHTML = `<div class="arm-head" style="--c:${CLS[m.cls]};--art:url('zones/${z.id}.webp')">${pf(m)}
      <div><h3 style="color:${CLS[m.cls]}">${esc(m.name)}</h3><p>${m.title ? `${esc(m.title.replace("{name}", m.name))} · ` : ""}Level ${m.level} ${RACE[m.race] || ""} ${CLS_NAME[m.cls]} · &lt;${esc(DATA.guild)}&gt;</p><p><span>●</span> Inloggad för ${ago(m.last)} sedan</p></div>
      <button class="arm-x" type="button" aria-label="Stäng">✕</button></div>
    <div class="arm-stats">${stat(nf(m.ilvl), "item level", BOARD("Item level"))}${stat(nf(m.hp), "HP", BOARD("Mest HP"))}${stat(nf(m.hk), "honorable kills", BOARD("Honorable kills"))}${stat(m.pvpRank ? `Rank ${m.pvpRank}` : "–", "PvP")}${stat(nf(Math.max(m.ap || 0, m.sp || 0)), (m.sp || 0) > (m.ap || 0) ? "spell power" : "attack power")}</div>
    ${m.gear.length ? `<div class="arm-body"><div>${m.gear.slice(0, half).map(gear).join("")}</div><div>${m.gear.slice(half).map(gear).join("")}</div></div>` : `<p class="lfg__empty" style="margin:0">Ingen profil hos Blizzard. Karaktären har troligen inte loggat in på länge.</p>`}
    <div class="arm-foot"><span class="src">Blizzards API · profil, utrustning, statistik och PvP</span><button class="btn btn--ghost btn--sm" type="button" id="armCmp">Jämför med ${ME && ME !== m ? esc(ME.name) : "mig"}</button></div>`;
  armory.querySelector(".arm-x").addEventListener("click", () => armory.close());
  $("armCmp").addEventListener("click", () => {
    armory.close(); cmpB.value = m.name; if (ME && ME !== m) cmpA.value = ME.name; drawCompare();
    $("jamfor").scrollIntoView({ behavior: "smooth" });
  });
  armory.showModal();
}
armory.addEventListener("click", (e) => { if (e.target === armory) armory.close(); });
document.addEventListener("click", (e) => {
  if (e.target.closest("dialog.armory, button, input, a")) return;
  const el = e.target.closest("[data-n]"); if (el) openArmory(byName[el.dataset.n.toLowerCase()]);
});

// ============================================================================
// "DET ÄR JAG" OCH TOOLTIP
// ============================================================================
const msg = $("finderMsg");
function setMe(name, quiet = false) {
  const m = byName[(name || "").trim().toLowerCase()];
  if (!m) { if (!quiet) msg.textContent = name ? `Hittar ingen ${name} i guilden. Stavat rätt?` : "Skriv ditt namn först."; return; }
  ME = m; try { localStorage.setItem("hemmet.me", m.name); } catch (e) {}
  const ahead = members.filter((x) => x.level > m.level).sort((a, b) => a.level - b.level)[0];
  msg.innerHTML = `<b style="color:${CLS[m.cls]}">${esc(m.name)}</b>, level ${m.level}, item level ${nf(m.ilvl)}. Plats ${members.indexOf(m) + 1} av ${members.length}${ahead ? `. Närmast före: <b>${esc(ahead.name)}</b> (${ahead.level})` : ""}.`;
  cmpA.value = m.name; if (!cmpB.value || cmpB.value === m.name) cmpB.value = (ahead || members.find((x) => x !== m)).name;
  drawBoard(); drawCompare(); drawLb();
  buildDung();
}
$("finder").addEventListener("submit", (e) => { e.preventDefault(); setMe($("who").value); });
const tip = $("tip");
document.addEventListener("pointerover", (e) => {
  if (e.pointerType === "touch") return;
  const el = e.target.closest(".tok"); if (!el) return;
  const m = byIdx[+el.dataset.i], L = lvAt(m, T);
  tip.innerHTML = `<b style="color:${CLS[m.cls]}">${esc(m.name)}</b>Level ${L} ${CLS_NAME[m.cls]}<br><span>ilvl ${nf(m.ilvl)} · ${nf(m.hk)} HKs · klicka för armory</span>`; tip.hidden = false;
});
document.addEventListener("pointermove", (e) => { if (tip.hidden) return; tip.style.left = `${Math.min(e.clientX + 16, innerWidth - tip.offsetWidth - 8)}px`; tip.style.top = `${Math.min(e.clientY + 16, innerHeight - tip.offsetHeight - 8)}px`; });
document.addEventListener("pointerout", (e) => { if (e.target.closest(".tok") && !e.relatedTarget?.closest?.(".tok")) tip.hidden = true; });
addEventListener("scroll", () => { tip.hidden = true; }, { passive: true });
let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(drawBoard, 120); });

// ============================================================================
// START
// ============================================================================
cmpA.value = members[0].name; cmpB.value = members[1].name;
useJourney(REAL);
drawCompare(); drawLb();
if (ME) { $("who").value = ME.name; setMe(ME.name, true); }

// ============================================================================
// REKRYTERINGSSIDAN: demons sektioner öppnas i en overlay från heron och menyn
// ============================================================================
if (RECRUIT) {
  document.body.classList.add("is-recruit");
  fetchDiscord(); setInterval(fetchDiscord, 5 * 60e3);
  document.title = "HEMMET · A Guild of Guilds";
  const second = $("heroSecond");
  second.textContent = "Se vad som väntar"; second.classList.replace("btn--ghost", "btn--primary");
  const discord = document.querySelector("#hero .btn-row > a.btn--primary"); if (discord) discord.classList.replace("btn--primary", "btn--ghost");
  $("heroArrow").hidden = false;
  document.querySelector(".topbar nav").innerHTML = `<a href="#resan">Se vad som väntar</a><a href="#faq">FAQ</a><a href="#join">Flytta in</a>`;
  const showcase = $("showcase");
  const openCase = () => { document.body.classList.add("show-case"); showcase.scrollTop = 0; requestAnimationFrame(() => { drawBoard(); dispatchEvent(new Event("resize")); }); };
  const closeCase = () => { document.body.classList.remove("show-case"); stop(); };
  $("showcaseClose").addEventListener("click", closeCase);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("show-case")) closeCase(); });
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href^='#']"); if (!a) return;
    const id = a.getAttribute("href").slice(1);
    if (["resan", "bedrifter", "statistik", "topp", "grupp", "jamfor", "nya"].includes(id) && !showcase.contains(a)) { e.preventDefault(); openCase(); return; }
    if (showcase.contains(a) && (id === "faq" || id === "join")) { e.preventDefault(); closeCase(); $(id).scrollIntoView({ behavior: "smooth" }); }
  }, true);
}
