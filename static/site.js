(() => {
  const NOW = () => (window.SITE && window.SITE.now ? new Date(window.SITE.now) : new Date());
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ───── Theme + menu ─────
  const root = document.documentElement;
  $(".theme-btn")?.addEventListener("click", () => {
    const dark = root.dataset.theme
      ? root.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
  });
  const menu = $(".menu-btn");
  menu?.addEventListener("click", () => {
    const open = $(".site-nav").classList.toggle("open");
    menu.setAttribute("aria-expanded", open);
  });

  // ───── Time helpers ─────
  const MIN = 6e4, HOUR = 36e5, DAY = 864e5;
  function rel(ms) {
    const a = Math.abs(ms);
    if (a < HOUR) return `${Math.max(1, Math.round(a / MIN))} min`;
    if (a < DAY) return `${Math.round(a / HOUR)} h`;
    const d = Math.floor(a / DAY), h = Math.round((a % DAY) / HOUR);
    return d < 3 && h ? `${d}d ${h}h` : `${Math.round(a / DAY)} days`;
  }
  const fmt = (d, opts) => d.toLocaleString("en-US", { timeZone: "America/Detroit", ...opts });
  const fmtDay = (d) => fmt(d, { weekday: "short", month: "short", day: "numeric" });
  const fmtTime = (d) => fmt(d, { hour: "numeric", minute: "2-digit" });
  const localISODate = (d) => fmt(d, { year: "numeric", month: "2-digit", day: "2-digit" })
    .replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");

  // ───── Live status pills & countdowns ─────
  function tick() {
    const now = NOW();
    $$("[data-countdown]").forEach((el) => {
      const t = new Date(el.dataset.countdown), diff = t - now;
      el.textContent = diff > 0
        ? `Will be posted ${fmtDay(t)}, ${fmtTime(t)}`
        : "Will be posted shortly.";
    });
    $$(".pill[data-due]").forEach((el) => {
      const t = new Date(el.dataset.due), diff = t - now;
      el.classList.toggle("is-soon", diff > 0 && diff < 3 * DAY);
      el.classList.toggle("is-closed", diff <= 0);
      el.textContent = diff > 0 ? `Due in ${rel(diff)}` : `Was due ${fmtDay(t)}`;
    });
    $$("[data-due-rel]").forEach((el) => {
      const t = new Date(el.dataset.dueRel), diff = t - now;
      el.innerHTML = `${fmtDay(t)}, ${fmtTime(t)}${diff > 0 ? "" : `<br><span class="muted tiny">Deadline passed</span>`}`;
    });
  }
  tick();
  setInterval(tick, 30000);

  // ───── Schedule: mark past / this week / today ─────
  const today = localISODate(NOW());
  let current = null;
  $$(".week").forEach((w) => {
    if (w.dataset.end < today) w.classList.add("is-past");
    else if (w.dataset.start <= today && !current) { w.classList.add("is-current"); current = w; }
  });
  if (!current) current = $$(".week").find((w) => w.dataset.start > today);
  $$(".session").forEach((s) => { if (s.dataset.date === today) s.classList.add("is-today"); });
  $$(".cal-day").forEach((d) => { if (d.dataset.date === today) d.classList.add("is-today"); });
  const jump = $("#jump-today");
  if (jump) {
    if (!current) jump.hidden = true;
    jump.addEventListener("click", () => {
      if (current) scrollTo({ top: current.getBoundingClientRect().top + scrollY - 80, behavior: "smooth" });
    });
  }

  // ───── Home: next class & upcoming ─────
  if (window.FEED) {
    const now = NOW();
    const nc = $("#next-class");
    const next = FEED.sessions.find((s) => s.kind !== "holiday" && new Date(s.end) > now);
    if (nc) {
      if (next) {
        const d = new Date(next.start);
        const isToday = next.date === today;
        nc.innerHTML = `<p class="kicker">${isToday ? "Today" : "Next class"}</p>
          <h3>${next.title}</h3>
          <div class="when">${fmtDay(d)}</div>
          ${next.blurb ? `<p>${next.blurb}</p>` : ""}`;
      } else {
        nc.innerHTML = `<p class="kicker">Next class</p><p class="muted">Classes have ended for the semester.</p>`;
      }
    }
    const nd = $("#next-due");
    if (nd) {
      const evs = [];
      FEED.items.forEach((i) => {
        if (i.due) evs.push({ at: new Date(i.due), verb: "Due", i });
        if (!i.url) evs.push({ at: new Date(i.release), verb: "Out", i });
      });
      const up = evs.filter((e) => e.at > now).sort((a, b) => a.at - b.at).slice(0, 4);
      nd.innerHTML = `<p class="kicker">Coming up</p>` + (up.length
        ? `<ul class="due-list">${up.map((e) => {
            const name = `<b>${e.i.short}</b> ${e.i.title.split(": ").slice(-1)[0]}`;
            const tag = `<span class="ev-type" style="background:color-mix(in srgb, var(--${e.verb === "Due" ? "coral" : "teal"}) 18%, transparent);color:var(--${e.verb === "Due" ? "coral" : "teal"})">${e.verb}</span>`;
            const label = e.i.url && e.verb === "Due" ? `<a href="${e.i.url}">${name}</a>` : `<span class="t">${name}</span>`;
            return `<li>${tag}${label}<span class="rel">${fmtDay(e.at)}</span></li>`;
          }).join("")}</ul>`
        : `<p class="muted">No upcoming deadlines.</p>`);
    }
  }

  // ───── Hero: one network, and a story that plays out in it ─────
  // People talk; a divisive story spreads; they take sides, argue, cut ties,
  // split into two camps that stop hearing each other; then someone reaches
  // across and the network slowly comes back together. Then it repeats.
  const cv = $("#net");
  if (cv) {
    const ctx = cv.getContext("2d");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SKIN = ["#F3D2B3", "#E2B48C", "#C78C5F", "#9A6440", "#6B4329", "#F6C9A4"];
    const HAIR = ["#2B1D14", "#5A3825", "#B98A5E", "#16161A", "#7C7C84", "#8A2F1F"];
    const ACTS = [
      { at: 0 },   // people talk, joke, and share
      { at: 8 },   // a divisive news story spreads
      { at: 13 },  // people take sides; arguments break out
      { at: 19 },  // ties across the divide are cut
      { at: 23 },  // each side clusters with people who agree
      { at: 31 },  // the two groups stop hearing from each other
      { at: 37 },  // someone reaches across
      { at: 42 },  // the network slowly comes back together
    ];
    const LOOP = 52;
    const pick = (a) => a[(Math.random() * a.length) | 0];
    const hex = (c) => { c = c.trim().replace("#", ""); if (c.length === 3) c = [...c].map((x) => x + x).join("");
      const n = parseInt(c, 16); return isNaN(n) ? [120, 120, 120] : [n >> 16, (n >> 8) & 255, n & 255]; };
    const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
    let W, H, DPR, people = [], ties = [], bits = [], mouse = null, colors, clock = 0, last = null, act = -1, news = null, bridger = null;

    const readColors = () => {
      const cs = getComputedStyle(root), v = (n) => cs.getPropertyValue(n).trim();
      colors = { neutral: [v("--teal"), v("--violet"), v("--maize"), v("--muted")].map(hex),
        A: hex(v("--c-individual")), B: hex(v("--coral")), coral: v("--coral"), maize: v("--maize"),
        ink: v("--ink"), surface: v("--surface") };
    };
    const geo = () => {
      const wide = W > 760;
      return wide
        ? { c: [0.74 * W, 0.5 * H], R: Math.min(W * 0.2, H * 0.36), A: [0.635 * W, 0.5 * H], B: [0.875 * W, 0.5 * H], r2: Math.min(W * 0.075, H * 0.28) }
        : { c: [0.6 * W, 0.55 * H], R: Math.min(W * 0.36, H * 0.3), A: [0.32 * W, 0.62 * H], B: [0.86 * W, 0.4 * H], r2: W * 0.15 };
    };
    const tieKey = (a, b) => (a < b ? a + "-" + b : b + "-" + a);
    const hasTie = (a, b) => ties.some((t) => !t.cut && tieKey(t.a, t.b) === tieKey(a, b));
    const addTie = (a, b, now) => { if (a !== b && !hasTie(a, b)) ties.push({ a, b, born: now, cut: null }); };

    function seed() {
      const r = cv.getBoundingClientRect();
      DPR = Math.min(2, devicePixelRatio || 1);
      W = r.width; H = r.height;
      cv.width = W * DPR; cv.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const g = geo(), count = Math.round(Math.min(40, Math.max(22, (W * H) / 26000)));
      people = Array.from({ length: count }, (_, i) => {
        const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * g.R;
        const x = g.c[0] + Math.cos(a) * d, y = g.c[1] + Math.sin(a) * d * 0.85;
        return { i, x, y, vx: 0, vy: 0, ox: x - g.c[0], oy: y - g.c[1], hx: x, hy: y,
          s: 4.6 + Math.random() * 2.6, ph: Math.random() * 6.283, skin: pick(SKIN), hair: pick(HAIR),
          style: (Math.random() * 4) | 0, shirt: pick(colors.neutral), side: 0, op: 0, heard: false, mood: null, act: 0 };
      });
      buildTies();
      // ?story=25 starts the story 25 seconds in (handy for checking a particular scene)
      clock = Math.max(0, Math.min(LOOP - 1, +new URLSearchParams(location.search).get("story") || 0)); act = -1;
    }
    function buildTies() {   // everyone starts tied to a few people near them
      ties = [];
      people.forEach((p) => {
        people.filter((q) => q !== p)
          .sort((q1, q2) => (q1.ox - p.ox) ** 2 + (q1.oy - p.oy) ** 2 - ((q2.ox - p.ox) ** 2 + (q2.oy - p.oy) ** 2))
          .slice(0, 2 + (Math.random() < 0.4)).forEach((q) => addTie(p.i, q.i, -99));
      });
      // join any separate pieces so it's one network: link each piece to its nearest neighbour
      const root_ = people.map((_, i) => i), find = (i) => (root_[i] === i ? i : (root_[i] = find(root_[i])));
      ties.forEach((t) => { root_[find(t.a)] = find(t.b); });
      for (;;) {
        const r0 = find(0), inA = people.filter((p) => find(p.i) === r0), out = people.filter((p) => find(p.i) !== r0);
        if (!out.length) break;
        let best = null, bd = Infinity;
        inA.forEach((a) => out.forEach((b) => { const d = (a.ox - b.ox) ** 2 + (a.oy - b.oy) ** 2; if (d < bd) { bd = d; best = [a.i, b.i]; } }));
        addTie(best[0], best[1], -99); root_[find(best[1])] = r0;
      }
    }
    const say = (p, mood, k = 1) => { p.mood = mood; p.act = k; };

    // ── what happens when each act begins ──
    function enterAct(n) {
      const g = geo();
      if (n === 0) {
        people.forEach((p) => { p.side = 0; p.heard = false; p.hx = g.c[0] + p.ox; p.hy = g.c[1] + p.oy; });
        bridger = null; news = null;
      }
      if (n === 1) {
        // sides follow where people sit, with some noise: neighbours tend to agree
        people.forEach((p) => { p.side = (g.A[0] === g.B[0] ? p.oy : p.ox) + (Math.random() - 0.5) * g.R * 0.8 < 0 ? -1 : 1; });
        const first = people.reduce((m, p) => (Math.abs(p.ox) + Math.abs(p.oy) < Math.abs(m.ox) + Math.abs(m.oy) ? p : m));
        news = { x: W + 40, y: first.y - 80, tx: first.x + 18, ty: first.y - 46, who: first, t: clock };
      }
      if (n === 3) {
        let k = 0;
        ties.forEach((t) => { if (!t.cut && people[t.a].side !== people[t.b].side) t.cut = clock + 0.3 + Math.min(3.2, 0.22 * k++); });
      }
      if (n === 4) {
        people.forEach((p) => {
          const c = p.side < 0 ? g.A : g.B;
          p.hx = c[0] + p.ox * (g.r2 / g.R); p.hy = c[1] + p.oy * (g.r2 / g.R);
        });
        // echo chambers: new ties among people who agree
        people.forEach((p) => {
          const same = people.filter((q) => q.side === p.side && q !== p);
          if (Math.random() < 0.7) addTie(p.i, pick(same).i, clock + Math.random() * 3);
        });
      }
      if (n === 6) {
        const g2 = geo();
        const As = people.filter((p) => p.side < 0);
        bridger = As.reduce((m, p) => (p.hx > m.hx ? p : m), As[0]);
        if (bridger) { bridger.hx = (g2.A[0] + g2.B[0]) / 2; bridger.hy = (g2.A[1] + g2.B[1]) / 2; say(bridger, "👋"); }
      }
      if (n === 7) {
        people.forEach((p) => { p.hx = g.c[0] + p.ox; p.hy = g.c[1] + p.oy; });
        if (bridger) {
          const Bs = people.filter((p) => p.side > 0).sort(() => Math.random() - 0.5);
          Bs.slice(0, 2).forEach((q, k) => addTie(bridger.i, q.i, clock + k * 0.6));
        }
        // ties across the old divide slowly re-form
        const As = people.filter((p) => p.side < 0), Bs = people.filter((p) => p.side > 0);
        for (let k = 0; k < Math.min(As.length, Bs.length); k++) addTie(pick(As).i, pick(Bs).i, clock + 1.5 + k * 0.35);
      }
    }

    function step(dt) {
      clock += dt;
      if (clock >= LOOP) { clock -= LOOP; act = -1; buildTies(); }
      const n = ACTS.reduce((m, a, i) => (clock >= a.at ? i : m), 0);
      // run every act we passed, in order, so jumping ahead leaves the story consistent
      if (n !== act) { for (let k = act + 1; k <= n; k++) { act = k; enterAct(k); } }

      // opinions: strengthen while divided, fade once people reconnect
      people.forEach((p) => {
        const target = p.heard && act >= 1 && act <= 6 ? p.side : 0;
        p.op += (target - p.op) * (act === 7 ? 0.012 : 0.03);
      });

      // the story spreads person to person along ties
      if (news) {
        const k = Math.min(1, (clock - news.t) / 1.2);
        news.x += (news.tx - news.x) * 0.08; news.y += (news.ty - news.y) * 0.08;
        if (k >= 1 && !news.who.heard) { news.who.heard = true; say(news.who, "📰"); }
        if (act >= 1 && act <= 2 && Math.random() < 0.25) {
          const t = pick(ties);
          if (t && !t.cut) {
            const a = people[t.a], b = people[t.b];
            if (a.heard && !b.heard) { b.heard = true; say(b, "📰", 0.9); }
            else if (b.heard && !a.heard) { a.heard = true; say(a, "📰", 0.9); }
          }
        }
        if (act >= 2) news = null;
      }
      if (act >= 2 && act <= 5) people.forEach((p) => { p.heard = true; });

      // chatter appropriate to the moment
      const chance = [0.04, 0.0, 0.07, 0.05, 0.05, 0.008, 0.01, 0.04][act];
      if (Math.random() < chance) {
        if (act === 2 || act === 3) {
          const cross = ties.filter((t) => !t.cut && people[t.a].side !== people[t.b].side);
          if (cross.length) { const t = pick(cross); say(people[pick([t.a, t.b])], pick(["😠", "🙄", "⚡", "❗"])); }
        } else if (act === 4 || act === 5) say(pick(people), pick(["👍", "💯", "📢", "🙌"]));
        else if (act === 7) say(pick(people), pick(["🤝", "💬", "🙂", "❤️"]));
        else say(pick(people), pick(["💬", "😂", "❤️", "👍", "👀"]));
      }
      if (act === 6 && bridger && Math.random() < 0.02) say(bridger, pick(["👋", "🤝", "💬"]));

      for (const p of people) {
        p.vx += (p.hx - p.x) * 0.0016 + Math.cos(clock * 0.6 + p.ph) * 0.012;
        p.vy += (p.hy - p.y) * 0.0016 + Math.sin(clock * 0.7 + p.ph) * 0.012;
        if (mouse) {
          const dx = mouse.x - p.x, dy = mouse.y - p.y, d2 = dx * dx + dy * dy;
          if (d2 < 140 * 140) { p.vx += dx * 0.0004; p.vy += dy * 0.0004; }
          if (d2 < 40 * 40 && p.act < 0.4) say(p, "👋");
        }
        for (const q of people) if (q !== p) {
          const dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy, m = (p.s + q.s) * 3.4;
          if (d2 < m * m && d2 > 0.01) { const f = (m - Math.sqrt(d2)) * 0.003; p.vx += dx * f; p.vy += dy * f; }
        }
        p.vx *= 0.9; p.vy *= 0.9; p.x += p.vx; p.y += p.vy;
        p.act *= 0.985; if (p.act < 0.05) p.mood = null;
      }
      // a tie whose time has come blows apart
      ties.forEach((t) => { if (t.cut && !t.blown && clock >= t.cut) { t.blown = true; explode(t); } });
      ties = ties.filter((t) => !t.blown);
      bits.forEach((b) => { b.x += b.vx; b.y += b.vy; b.vy += 0.12; b.vx *= 0.97; b.rot += b.spin; b.life -= dt; });
      bits = bits.filter((b) => b.life > 0);
    }

    function drawTie(t) {
      const a = people[t.a], b = people[t.b];
      const ax = a.x, ay = a.y + a.s * 1.6, bx = b.x, by = b.y + b.s * 1.6;
      if (clock < t.born) return;
      const grow = Math.min(1, (clock - t.born) / 0.8);
      const tense = (act === 2 || act === 3) && a.side !== b.side;
      if (t.blown) return;
      if (tense) {
        ctx.strokeStyle = colors.coral; ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.45 + 0.4 * Math.sin(clock * 9 + t.a);
        ctx.setLineDash([4, 3]);
      } else {
        const fresh = clock - t.born < 2.5 && t.born > 0;
        ctx.strokeStyle = fresh ? colors.maize : colors.ink; ctx.lineWidth = fresh ? 1.8 : 1.1;
        ctx.globalAlpha = fresh ? 0.85 : 0.22;
      }
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + (bx - ax) * grow, ay + (by - ay) * grow); ctx.stroke();
      ctx.setLineDash([]);
    }

    function explode(t) {
      const a = people[t.a], b = people[t.b];
      const ax = a.x, ay = a.y + a.s * 1.6, bx = b.x, by = b.y + b.s * 1.6, mx = (ax + bx) / 2, my = (ay + by) / 2;
      const len = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax), n = Math.max(4, Math.round(len / 14));
      // the tie shatters into pieces that fly off
      for (let k = 0; k < n; k++) {
        const f = (k + 0.5) / n, x = ax + (bx - ax) * f, y = ay + (by - ay) * f, out = Math.atan2(y - my, x - mx) || Math.random() * 6.283;
        const v = 1.5 + Math.random() * 3;
        bits.push({ kind: "shard", x, y, vx: Math.cos(out) * v + (Math.random() - 0.5) * 2, vy: Math.sin(out) * v - 2 - Math.random() * 2,
          rot: ang, spin: (Math.random() - 0.5) * 0.4, len: len / n * 0.85, life: 1.1 + Math.random() * 0.4, max: 1.5 });
      }
      // sparks and a flash where it broke
      for (let k = 0; k < 16; k++) {
        const o = Math.random() * 6.283, v = 2 + Math.random() * 4.5;
        bits.push({ kind: "spark", x: mx, y: my, vx: Math.cos(o) * v, vy: Math.sin(o) * v - 1.5, rot: 0, spin: 0,
          r: 1 + Math.random() * 1.8, hot: Math.random() < 0.5, life: 0.5 + Math.random() * 0.6, max: 1.1 });
      }
      bits.push({ kind: "flash", x: mx, y: my, vx: 0, vy: -0.12, rot: 0, spin: 0, life: 0.45, max: 0.45 });
      // the two people recoil from each other
      const ux = (bx - ax) / (len || 1), uy = (by - ay) / (len || 1);
      a.vx -= ux * 5; a.vy -= uy * 5; b.vx += ux * 5; b.vy += uy * 5;
      say(a, pick(["😠", "😤", "💔"])); say(b, pick(["😠", "😤", "💔"]));
    }

    function drawBits() {
      for (const b of bits) {
        const k = Math.max(0, b.life / b.max);
        if (b.kind === "shard") {
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
          ctx.strokeStyle = colors.coral; ctx.globalAlpha = Math.min(1, k * 1.4); ctx.lineWidth = 2.2; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(-b.len / 2, 0); ctx.lineTo(b.len / 2, 0); ctx.stroke(); ctx.restore();
        } else if (b.kind === "spark") {
          ctx.fillStyle = b.hot ? colors.maize : colors.coral; ctx.globalAlpha = k;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.5 + k), 0, 6.283); ctx.fill();
        } else {
          const r = 6 + (1 - k) * 26;
          ctx.globalAlpha = k * 0.55; ctx.fillStyle = colors.maize;
          ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 6.283); ctx.fill();
          ctx.globalAlpha = k; ctx.strokeStyle = colors.coral; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(b.x, b.y, r * 0.8, 0, 6.283); ctx.stroke();
          ctx.font = `${Math.round(18 + (1 - k) * 8)}px system-ui, 'Apple Color Emoji', sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("💥", b.x, b.y);
        }
      }
      ctx.lineCap = "butt";
    }

    function drawPerson(p) {
      const { x, y, s } = p, w = 2.05 * s, top = y + 1.45 * s, bot = y + 3.4 * s;
      const side = p.op < 0 ? colors.A : colors.B;
      ctx.globalAlpha = act === 5 ? 0.8 : 0.96;
      ctx.fillStyle = mix(p.shirt, side, Math.min(1, Math.abs(p.op)) * 0.9);
      ctx.beginPath(); ctx.moveTo(x - w, bot); ctx.lineTo(x - w, top + s);
      ctx.quadraticCurveTo(x - w, top, x, top); ctx.quadraticCurveTo(x + w, top, x + w, top + s);
      ctx.lineTo(x + w, bot); ctx.closePath(); ctx.fill();
      if (p.style === 2) { ctx.fillStyle = p.hair; ctx.beginPath(); ctx.roundRect?.(x - s * 1.12, y - s * 0.3, s * 2.24, s * 1.25, s * 0.3); ctx.fill(); }
      ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(x, y, s, 0, 6.283); ctx.fill();
      if (p.style < 3) {
        ctx.fillStyle = p.hair; ctx.beginPath();
        ctx.moveTo(x - s, y + s * 0.05); ctx.arc(x, y + s * 0.05, s, Math.PI, 0);
        ctx.quadraticCurveTo(x + s * 0.2, y - s * 0.55, x - s, y + s * 0.05); ctx.fill();
        if (p.style === 1) { ctx.beginPath(); ctx.arc(x + s * 0.15, y - s * 1.05, s * 0.42, 0, 6.283); ctx.fill(); }
      }
    }

    function drawBubble(p) {
      const a = Math.min(1, p.act * 1.6), r = 13, bx = p.x + p.s * 1.6, by = p.y - p.s * 2.6 - r;
      ctx.globalAlpha = a;
      ctx.fillStyle = colors.surface; ctx.strokeStyle = colors.ink; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(bx, by, r, 0, 6.283); ctx.fill();
      ctx.globalAlpha = a * 0.25; ctx.stroke(); ctx.globalAlpha = a;
      ctx.beginPath(); ctx.moveTo(bx - 8, by + 8); ctx.lineTo(p.x + p.s * 0.6, p.y - p.s * 1.3); ctx.lineTo(bx - 2, by + 12); ctx.fill();
      ctx.font = "15px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(p.mood, bx, by + 1);
    }

    function drawNews() {
      if (!news) return;
      const { x, y } = news, w = 54, h = 36;
      ctx.globalAlpha = 0.97;
      ctx.fillStyle = colors.surface; ctx.strokeStyle = colors.ink; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect?.(x - w / 2, y - h / 2, w, h, 4); ctx.fill(); ctx.globalAlpha = 0.4; ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = colors.coral; ctx.fillRect(x - w / 2 + 5, y - h / 2 + 5, w - 10, 6);
      ctx.fillStyle = colors.ink; ctx.globalAlpha = 0.35;
      [0, 1, 2].forEach((k) => ctx.fillRect(x - w / 2 + 5, y - h / 2 + 15 + k * 5.5, (w - 10) * (k === 2 ? 0.6 : 1), 2.4));
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ties.forEach(drawTie);
      ctx.lineWidth = 1;
      [...people].sort((a, b) => a.y - b.y).forEach(drawPerson);
      drawBits();
      for (const p of people) if (p.mood && p.act > 0.08) drawBubble(p);
      drawNews();
      ctx.globalAlpha = 1;
    }

    let raf, visible = true;
    const loop = (t) => {
      const dt = last == null ? 0 : Math.min(0.05, (t - last) / 1000);
      last = t; step(dt); draw(); raf = requestAnimationFrame(loop);
    };
    const start = () => {
      cancelAnimationFrame(raf); last = null;
      if (reduce) {   // a single still: the network in one piece, people talking
        step(0); for (let i = 0; i < 3; i++) say(pick(people), pick(["💬", "😂", "❤️"]));
        draw();
      } else if (visible) raf = requestAnimationFrame(loop);
    };
    readColors(); seed(); start();
    // testing aid: with ?story in the URL, window.storyAdvance(sec) runs the simulation forward
    if (location.search.includes("story")) window.storyAdvance = (sec) => { for (let i = 0; i < sec * 60; i++) step(1 / 60); draw(); return act; };
    const recolor = () => { readColors(); if (reduce) draw(); };
    new MutationObserver(recolor).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", recolor);
    let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { seed(); start(); }, 150); });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : cancelAnimationFrame(raf); }).observe(cv);
    const hero = cv.parentElement;
    hero.addEventListener("pointermove", (e) => { const r = cv.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; });
    hero.addEventListener("pointerleave", () => { mouse = null; });
  }
})();
