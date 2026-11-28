/* Hollowmere: page behaviour below the hero.
   Intro, theme, menu, text and photo reveals, the month picker, the grounds map, section-break stems,
   the flower marquee, live opening hours, the ticket counter, the member card, the footer curtain,
   and the Daybook scroll engine (smooth wheel, section jumps, scroll spy). No libraries. */
(() => {
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  let active = "top", jumping = null, jraf = 0, stopJump = null, jumpEnded = 0;

  /* ---------------- photos ----------------
     Every picture slot names the photo it is waiting for (data-photo). Until that file is in assets/photos/,
     the slot shows a stand-in cut from the hero photography. When a photo arrives, add its file name here. */
  const PHOTOS = [
    "month-01.jpg", "month-02.jpg", "month-03.jpg", "month-04.jpg", "month-05.jpg", "month-06.jpg",
    "month-07.jpg", "month-08.jpg", "month-09.jpg", "month-10.jpg", "month-11.jpg", "month-12.jpg",
    "grounds-map.jpg", "north-wall.jpg", "visit-gate.jpg", "member-meadow.jpg", "member-card.jpg",
    "journal-hands-moss.jpg", "journal-snowdrops.jpg", "journal-ice-lilies.jpg",
  ];
  const photoUrl = name => (name && PHOTOS.includes(name) ? "assets/photos/" + name : null);
  $$("img[data-photo]").forEach(img => {
    const url = photoUrl(img.dataset.photo);
    if (!url) return;
    img.src = url; img.classList.remove("stand");
    img.closest("figure")?.classList.add("has-photo");
  });
  const mapEl = $("#map");
  if (photoUrl(mapEl.dataset.photo)) {
    $("#mapPhoto").innerHTML = `<img src="${photoUrl(mapEl.dataset.photo)}" alt="" style="transform:none">`;
    mapEl.classList.add("has-photo");
    // the walking routes follow the paths drawn in the illustration instead of the sketch
    mapEl.querySelectorAll(".route").forEach(r => r.setAttribute("d", r.dataset.pd));
  }
  // ?chips shows every slot's label at once, for whoever is generating the photos
  if (/[?&]chips\b/.test(location.search)) root.classList.add("show-chips");

  /* ---------------- film grain ---------------- */
  try {
    const c = document.createElement("canvas"); c.width = c.height = 160;
    const x = c.getContext("2d"), d = x.createImageData(160, 160);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    root.style.setProperty("--grain", `url(${c.toDataURL()})`);
  } catch (e) {}

  /* ---------------- theme ---------------- */
  const themeBtn = $("#themeBtn");
  const darkMQ = matchMedia("(prefers-color-scheme: dark)");
  const isDark = () => { const t = root.getAttribute("data-theme"); return t ? t === "dark" : darkMQ.matches; };
  function syncThemeBtn() {
    const d = isDark();
    themeBtn.classList.toggle("is-dark", d);
    themeBtn.setAttribute("aria-label", d ? "Switch to light mode" : "Switch to dark mode");
  }
  themeBtn.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("hm-theme", next); } catch (e) {}
    syncThemeBtn();
  });
  darkMQ.addEventListener?.("change", syncThemeBtn);
  new MutationObserver(syncThemeBtn).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  syncThemeBtn();

  /* ---------------- menu ---------------- */
  const menu = $("#menu");
  const menuBtn = $("#menuBtn");
  const menuClose = $("#menuClose");
  function openMenu() {
    const r = menuBtn.getBoundingClientRect();
    menu.style.setProperty("--mx", r.left + r.width / 2 + "px");
    menu.style.setProperty("--my", r.top + r.height / 2 + "px");
    menu.classList.add("open");
    menuBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    setTimeout(() => menu.querySelector("nav a")?.focus({ preventScroll: true }), 80);
  }
  function closeMenu(returnFocus = true) {
    if (!menu.classList.contains("open")) return;
    menu.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    if (returnFocus) menuBtn.focus({ preventScroll: true });
  }
  menuBtn.addEventListener("click", openMenu);
  menuClose.addEventListener("click", () => closeMenu());
  menu.addEventListener("keydown", e => {
    if (e.key === "Escape") closeMenu();
    if (e.key === "Tab") { // keep focus inside the open menu
      const f = $$("a, button", menu);
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });

  /* ---------------- nav pill: slides under the hovered or current link ---------------- */
  const linksEl = $("#links"), pill = $("#pill");
  let hoveringLinks = false;
  function pillTo(a) {
    if (!a || !a.offsetWidth) { pill.style.opacity = 0; return; }
    const lr = linksEl.getBoundingClientRect(), r = a.getBoundingClientRect();
    pill.style.width = r.width + "px";
    pill.style.transform = `translateX(${r.left - lr.left}px)`;
    pill.style.opacity = 1;
  }
  const currentLink = () => $(`.links a[href="#${active}"]`);
  const syncPill = () => { if (!hoveringLinks) pillTo(currentLink()); };
  linksEl.addEventListener("pointerover", e => { const a = e.target.closest("a"); if (a) { hoveringLinks = true; pillTo(a); } });
  linksEl.addEventListener("pointerleave", () => { hoveringLinks = false; syncPill(); });

  /* ---------------- text splitting ---------------- */
  // Headings: wrap each rendered line so it can rise out of its own mask.
  function splitLines(el) {
    if (!el.dataset.src) el.dataset.src = el.innerHTML;
    el.innerHTML = el.dataset.src;
    const words = [];
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span"); w.className = "w"; w.textContent = p;
            words.push(w); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && !n.classList.contains("data")) walk(n);
      });
    };
    walk(el);
    const lines = [];
    let top = null;
    words.forEach(w => {
      const t = Math.round(w.getBoundingClientRect().top);
      if (top === null || Math.abs(t - top) > 4) { lines.push([]); top = t; }
      lines[lines.length - 1].push(w);
    });
    // rebuild: each line keeps its inline wrappers (such as <em>) around its words
    el.innerHTML = lines.map((ws, i) => {
      const html = ws.map(w => {
        let out = w.outerHTML, p = w.parentElement;
        while (p && p !== el) {
          const tag = p.tagName.toLowerCase(), cls = p.className ? ` class="${p.className}"` : "";
          out = `<${tag}${cls}>${out}</${tag}>`; p = p.parentElement;
        }
        return out;
      }).join(" ");
      return `<span class="ln"><span class="ln-i" style="--i:${i}">${html}</span></span>`;
    }).join("");
    if (el.hasAttribute("data-chars")) {
      let c = 0;
      $$(".w", el).forEach(w => {
        const t = w.textContent; w.textContent = "";
        [...t].forEach(ch => { const s = document.createElement("span"); s.className = "ch"; s.textContent = ch; s.style.setProperty("--c", c++); w.appendChild(s); });
      });
    }
  }
  // Paragraphs and statements: wrap each word once (they reflow on their own).
  function splitWords(el, cls) {
    const out = [];
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            const w = document.createElement("span"); w.className = cls; w.textContent = p;
            w.style.setProperty("--k", out.length); out.push(w); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.classList.contains("inlay")) out.push(n);
        else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    return out;
  }
  const lineEls = $$("[data-lines], [data-chars]");
  $$("[data-words]").forEach(el => splitWords(el, "wd"));
  const fills = $$("[data-fill]").map(el => ({ el, items: splitWords(el, "fw"), scrub: el.dataset.fill === "scrub" }));
  const splitAll = () => lineEls.forEach(splitLines);
  $("#top h1").style.setProperty("--d", "250ms");

  /* ---------------- intro: the curtain lifts once the hero pictures are ready ---------------- */
  const intro = $("#intro");
  const hero = $("#top");
  const playHero = () => $$("[data-chars], [data-words], [data-reveal]", hero).forEach(el => el.classList.add("in"));
  let seen = false;
  try { seen = sessionStorage.getItem("hm-intro") === "1"; } catch (e) {}
  const t0 = performance.now(), minShow = seen ? 450 : 1350;
  let fontsOk = false, picsOk = false, lifted = false;
  const bar = $(".intro-bar b");
  const setLoad = v => bar && bar.style.setProperty("--load", v);
  setLoad(0.25);
  function lift() {
    if (lifted) return; lifted = true;
    const go = () => {
      setLoad(1);
      intro.classList.add("done");
      playHero();
      setTimeout(() => intro.classList.add("gone"), 1300);
      try { sessionStorage.setItem("hm-intro", "1"); } catch (e) {}
    };
    setTimeout(go, Math.max(0, minShow - (performance.now() - t0)));
  }
  const tryLift = () => { setLoad(0.25 + (fontsOk ? 0.35 : 0) + (picsOk ? 0.4 : 0)); if (fontsOk && picsOk) lift(); };
  const garden = $("#garden");
  if (garden.classList.contains("ready")) picsOk = true;
  else new MutationObserver(() => { if (garden.classList.contains("ready")) { picsOk = true; tryLift(); } }).observe(garden, { attributes: true, attributeFilter: ["class"] });
  setTimeout(() => { picsOk = true; tryLift(); }, 2600); // never hold the page for slow pictures
  (document.fonts?.ready || Promise.resolve()).then(() => {
    splitAll(); root.classList.add("ready");
    fontsOk = true;
    if (reduce) { intro.classList.add("gone"); playHero(); } else tryLift();
    layoutAll();
  });
  let lastW = innerWidth, rsT = 0;
  addEventListener("resize", () => {
    clearTimeout(rsT);
    rsT = setTimeout(() => { if (innerWidth !== lastW) { lastW = innerWidth; splitAll(); } layoutAll(); }, 160);
  });

  /* ---------------- scrambled data labels ---------------- */
  const GLYPHS = "ABCDEFGHKLMNOPRSTUVWXYZ0123456789";
  function scramble(el) {
    if (reduce || el.dataset.done) return;
    el.dataset.done = "1";
    const final = el.textContent, n = final.length, frames = 26;
    el.setAttribute("aria-label", final);
    let f = 0;
    const tick = () => {
      f++;
      const solved = Math.floor((f / frames) * n);
      el.textContent = [...final].map((c, i) => (i < solved || /[\s·:,.]/.test(c) ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join("");
      if (f < frames) requestAnimationFrame(tick); else { el.textContent = final; el.removeAttribute("aria-label"); }
    };
    requestAnimationFrame(tick);
  }

  /* ---------------- count up the visit figures ---------------- */
  function countUp(el) {
    if (reduce || el.dataset.done) return;
    el.dataset.done = "1";
    const final = el.textContent;
    const parts = final.split(/(\d+)/);
    const start = performance.now(), dur = 1500;
    const tick = t => {
      const k = easeOut(clamp((t - start) / dur));
      el.textContent = parts.map(p => (/^\d+$/.test(p) ? String(Math.round(+p * k)).padStart(p.length > 1 && p[0] === "0" ? p.length : 1, "0") : p)).join("");
      if (k < 1) requestAnimationFrame(tick); else el.textContent = final;
    };
    requestAnimationFrame(tick);
  }

  /* ---------------- reveal on entry ---------------- */
  const onIn = new Map();
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.classList.add("in");
      $$(".rise", el).forEach(r => r.classList.add("in"));
      (onIn.get(el) || []).forEach(fn => fn());
      io.unobserve(el);
    });
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0 });
  const when = (el, fn) => { if (!onIn.has(el)) onIn.set(el, []); onIn.get(el).push(fn); };
  $$("[data-stagger]").forEach(list => [...list.children].forEach((c, i) => { c.style.transitionDelay = Math.min(i * 70, 640) + "ms"; }));
  $$("[data-lines], [data-words], [data-reveal], [data-stagger], [data-watch], [data-scramble], .map, #visitStage").forEach(el => {
    if (hero.contains(el)) return; // the hero plays in when the curtain lifts
    io.observe(el);
  });
  $$("[data-scramble]").forEach(el => when(el, () => scramble(el)));
  const visitStage = $("#visitStage");
  when(visitStage, () => $$("[data-count]", visitStage).forEach(countUp));

  /* ---------------- months ---------------- */
  // [month, what, where, the photo it needs, stand-in, stand-in tint, file]
  const MONTHS = [
    ["JAN", "Witch hazel and hellebores", "East gate", "witch hazel in frost by the east gate", "p-bare.jpg", "saturate(.45) brightness(1.06) hue-rotate(-6deg)"],
    ["FEB", "Snowdrops and winter aconite", "Moss Hollow", "snowdrops under the oaks in Moss Hollow", "p-twig.jpg", "saturate(.5) brightness(1.08)"],
    ["MAR", "Daffodils and wood anemone", "Long Meadow", "daffodils along the top of Long Meadow", "p-flowers.jpg", "saturate(.95) brightness(1.02)"],
    ["APR", "Bluebells and cherry blossom", "Beech wood", "bluebells under the beeches", "p-end.jpg", "hue-rotate(8deg) saturate(.95)"],
    ["MAY", "Wisteria and alliums", "Walled Garden", "wisteria on the Walled Garden's south wall", "p-fork.jpg", "none"],
    ["JUN", "Old roses and foxgloves", "Walled Garden", "foxgloves at the edge of the wood", "s-macro.jpg", "saturate(1.05)"],
    ["JUL", "Lavender and meadow grasses", "Long Meadow", "lavender walk at midday", "s-left.jpg", "saturate(1.1) brightness(1.04) sepia(.1)"],
    ["AUG", "Hydrangeas and water lilies", "Lily Ponds", "water lilies open on the middle pond", "p-end.jpg", "hue-rotate(-10deg) saturate(1.05) brightness(.98)"],
    ["SEP", "Asters and sedum", "Walled Garden", "asters with bees, Walled Garden borders", "p-flowers.jpg", "sepia(.25) saturate(1.1)"],
    ["OCT", "Maple colour and cyclamen", "Fern Gully", "red maples over Fern Gully", "p-fork.jpg", "sepia(.5) hue-rotate(-22deg) saturate(1.35)"],
    ["NOV", "Mosses and holly berries", "North wall", "moss on the north wall after rain", "p-night.jpg", "brightness(1.12) saturate(.9)"],
    ["DEC", "Frosted seedheads and winter box", "Long Meadow", "frosted seedheads at sunrise", "p-bare.jpg", "saturate(.25) brightness(1.12) hue-rotate(12deg)"],
  ].map((m, i) => [...m, `month-${String(i + 1).padStart(2, "0")}.jpg`]);
  const monthsEl = $("#months");
  const layers = $("#seasonLayers"), seasonFrame = $("#seasonFrame"), seasonCap = $("#seasonCap"), seasonChip = $("#seasonChip span");
  const now = new Date().getMonth();
  const arrow = `<svg class="arr" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 8h11M9 3.5 13.5 8 9 12.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  MONTHS.forEach(([m, what, where], i) => {
    const li = document.createElement("li");
    li.innerHTML = `<button type="button" aria-pressed="${i === now}"><span class="data">${m}</span><span class="what">${what}</span><span class="where">${where}</span>${arrow}</button>`;
    monthsEl.appendChild(li);
  });
  [...monthsEl.children].forEach((c, i) => { c.style.transitionDelay = Math.min(i * 50, 600) + "ms"; });
  const monthBtns = $$("button", monthsEl);
  let month = -1;
  function pickMonth(i, instant) {
    if (i === month) return;
    month = i;
    const [m, what, where, need, stand, tone, file] = MONTHS[i];
    monthBtns.forEach((b, j) => b.setAttribute("aria-pressed", String(i === j)));
    const real = photoUrl(file);
    const layer = document.createElement("div");
    layer.className = "layer" + (instant || reduce ? "" : " enter");
    const img = document.createElement("img");
    img.alt = (real ? "" : "Photo to come: ") + need.charAt(0).toUpperCase() + need.slice(1);
    img.src = real || "assets/stand/" + stand;
    if (!real) { img.className = "stand"; img.style.setProperty("--tone", tone); }
    layer.appendChild(img);
    layers.appendChild(layer);
    const old = [...layers.children].slice(0, -1);
    if (instant || reduce) old.forEach(o => o.remove());
    else setTimeout(() => old.forEach(o => o.remove()), 1050);
    seasonFrame.classList.toggle("has-photo", !!real);
    seasonChip.textContent = `Stand-in photo · ${file} · ${need}`;
    // caption slides in with the new picture
    seasonCap.classList.add("swap");
    $("#seasonM").textContent = m; $("#seasonWhat").textContent = what; $("#seasonWhere").textContent = where;
    void seasonCap.offsetWidth;
    requestAnimationFrame(() => seasonCap.classList.remove("swap"));
  }
  monthsEl.addEventListener("click", e => { const b = e.target.closest("button"); if (b) pickMonth(monthBtns.indexOf(b)); });
  if (fine) {
    let hoverT = 0;
    monthsEl.addEventListener("pointerover", e => {
      const b = e.target.closest("button"); if (!b) return;
      clearTimeout(hoverT); hoverT = setTimeout(() => pickMonth(monthBtns.indexOf(b)), 110);
    });
  }
  pickMonth(now, true);

  /* ---------------- grounds map ---------------- */
  const routes = $$(".route", mapEl), areaGs = $$(".area", mapEl), areaBtns = $$(".area-btn");
  const walker = $("#walker");
  const pins = [...document.querySelectorAll("#mapPins .pin[data-area]")];
  $$(".draw", mapEl).forEach(p => p.style.setProperty("--len", Math.ceil(p.getTotalLength()) + 1));
  let area = -1, wraf = 0;
  function walk(i) {
    cancelAnimationFrame(wraf);
    const r = routes[i]; if (!r) return;
    const len = r.getTotalLength(), start = performance.now(), dur = reduce ? 1 : 1200;
    walker.classList.add("on");
    const fr = t => {
      const k = easeInOut(clamp((t - start) / dur));
      const p = r.getPointAtLength(len * k);
      walker.setAttribute("cx", p.x.toFixed(1)); walker.setAttribute("cy", p.y.toFixed(1));
      if (k < 1) wraf = requestAnimationFrame(fr);
    };
    wraf = requestAnimationFrame(fr);
  }
  function setArea(i) {
    if (i === area) return;
    area = i;
    areaBtns.forEach((b, j) => b.setAttribute("aria-pressed", String(i === j)));
    areaGs.forEach(g => g.classList.toggle("on", +g.dataset.area === i));
    routes.forEach(r => r.classList.toggle("on", +r.dataset.route === i));
    pins.forEach(p => p.classList.toggle("on", +p.dataset.area === i));
    walk(i);
  }
  areaBtns.forEach((b, i) => {
    b.addEventListener("click", () => setArea(i));
    b.addEventListener("focus", () => setArea(i));
    if (fine) b.addEventListener("pointerenter", () => setArea(i));
  });
  areaGs.forEach(g => g.addEventListener("click", () => setArea(+g.dataset.area)));
  pins.forEach(p => p.addEventListener("click", () => setArea(+p.dataset.area)));
  when(mapEl, () => setTimeout(() => { if (area < 0) setArea(0); }, reduce ? 0 : 1500));

  /* ---------------- section-break stems ---------------- */
  const stems = $$("[data-stem] svg").map(svg => ({ svg, path: null, len: 0, leaves: [], buds: [], W: 0 }));
  const NS = "http://www.w3.org/2000/svg";
  function buildStem(s) {
    const W = Math.max(320, Math.round(s.svg.getBoundingClientRect().width)), H = 110, mid = 55;
    if (W === s.W) return;
    s.W = W;
    s.svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    s.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    s.svg.innerHTML = "";
    const amp = Math.min(16, W / 60);
    const yAt = x => mid + Math.sin((x / 210) * Math.PI) * amp + Math.sin(x / 47) * 2.5;
    let d = `M0 ${yAt(0).toFixed(1)}`;
    for (let x = 8; x <= W; x += 8) d += ` L${x} ${yAt(x).toFixed(1)}`;
    const path = document.createElementNS(NS, "path");
    path.setAttribute("class", "vine"); path.setAttribute("d", d);
    s.svg.appendChild(path);
    s.path = path; s.len = path.getTotalLength();
    path.style.strokeDasharray = `${s.len} ${s.len}`;
    s.leaves = []; s.buds = [];
    const step = W < 600 ? 64 : 92;
    let side = 1;
    for (let x = 48; x < W - 30; x += step) {
      if (Math.abs(x - W / 2) < step * 0.6) continue; // the bud sits in the middle
      const y = yAt(x), slope = Math.atan2(yAt(x + 2) - yAt(x - 2), 4) * 180 / Math.PI;
      const g = document.createElementNS(NS, "g");
      g.setAttribute("transform", `translate(${x} ${y.toFixed(1)}) rotate(${(slope - side * 42).toFixed(1)})`);
      const leaf = document.createElementNS(NS, "path");
      const L = 15 + ((x * 7) % 9);
      leaf.setAttribute("d", `M0 0 C${L * 0.25} ${-L * 0.32} ${L * 0.72} ${-L * 0.3} ${L} 0 C${L * 0.72} ${L * 0.3} ${L * 0.25} ${L * 0.32} 0 0Z`);
      leaf.setAttribute("class", "leaf");
      leaf.style.transformOrigin = "0 50%";
      g.appendChild(leaf); s.svg.appendChild(g);
      s.leaves.push({ el: leaf, f: x / W });
      side = -side;
    }
    const bx = W / 2, by = yAt(bx);
    const g = document.createElementNS(NS, "g");
    g.setAttribute("transform", `translate(${bx} ${by.toFixed(1)})`);
    const bud = document.createElementNS(NS, "g"); bud.setAttribute("class", "bud");
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2, c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", (Math.cos(a) * 5.5).toFixed(2)); c.setAttribute("cy", (Math.sin(a) * 5.5).toFixed(2)); c.setAttribute("r", "4.2");
      bud.appendChild(c);
    }
    const core = document.createElementNS(NS, "circle"); core.setAttribute("r", "2.4"); core.setAttribute("style", "fill:var(--moss)");
    bud.appendChild(core);
    g.appendChild(bud); s.svg.appendChild(g);
    s.buds.push({ el: bud, f: 0.5 });
  }

  /* ---------------- visit: hairlines from each figure to the gate ---------------- */
  const linksSvg = $("#linksSvg");
  function buildLinks() {
    if (getComputedStyle(linksSvg).display === "none") return;
    const sr = visitStage.getBoundingClientRect();
    const gate = $(".gate-wrap .frame", visitStage).getBoundingClientRect();
    linksSvg.setAttribute("viewBox", `0 0 ${sr.width} ${sr.height}`);
    linksSvg.innerHTML = $$(".vfact", visitStage).map((f, i) => {
      const fr = f.getBoundingClientRect(), num = $("b", f).getBoundingClientRect();
      const left = i % 2 === 0;
      const y = num.top + num.height * 0.55 - sr.top;
      const x0 = (left ? fr.right + 18 : fr.left - 18) - sr.left;
      const x1 = (left ? gate.left - 22 : gate.right + 22) - sr.left;
      const d = `M${x0.toFixed(1)} ${y.toFixed(1)} H${x1.toFixed(1)}`;
      const len = Math.abs(x1 - x0) + 1, dd = 250 + i * 140;
      return `<path d="${d}" style="--len:${len};--dd:${dd}ms"/><circle cx="${x1.toFixed(1)}" cy="${y.toFixed(1)}" r="3" style="--dd:${dd + 900}ms"/>`;
    }).join("");
  }

  /* ---------------- opening hours, in UK time ---------------- */
  const pad = n => String(n).padStart(2, "0");
  const fmt = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  function ukNow() {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", month: "numeric", hourCycle: "h23" }).formatToParts(new Date());
      const get = t => +parts.find(p => p.type === t).value;
      return { min: get("hour") * 60 + get("minute"), month: get("month") };
    } catch (e) { const d = new Date(); return { min: d.getHours() * 60 + d.getMinutes(), month: d.getMonth() + 1 }; }
  }
  function hours() {
    const { min, month: mo } = ukNow();
    const summer = mo >= 3 && mo <= 10;
    const open = 9 * 60, close = summer ? 18 * 60 : 16 * 60 + 30, last = close - 60;
    const isOpen = min >= open && min < close;
    let headline, sub;
    if (min < open) { headline = "Closed"; sub = "opens at 09:00"; }
    else if (min < last) { headline = "Open now"; sub = `last entry ${fmt(last)}`; }
    else if (min < close) { headline = "Open now"; sub = `closes at ${fmt(close)}, last entry has passed`; }
    else { headline = "Closed"; sub = "opens tomorrow at 09:00"; }
    $("#statusText").innerHTML = `<b>${headline}</b> · ${sub}`;
    $$("[data-live-dot]").forEach(d => d.classList.toggle("closed", !isOpen));
    $$("[data-open-word]").forEach(e => { e.textContent = isOpen ? "Open now" : "Open today"; });
    $$("[data-open-hours]").forEach(e => { e.textContent = `09:00–${fmt(close)}`; });
    $$("[data-last-entry]").forEach(e => { e.textContent = `Last entry ${fmt(last)}`; });
    $$("#hoursList [data-season]").forEach(e => e.classList.toggle("cur", (e.dataset.season === "summer") === summer));
    const span = [6 * 60, 21 * 60], at = m => ((m - span[0]) / (span[1] - span[0])) * 100;
    const track = $("#dayTrack"), nowEl = $("#dayNow");
    track.style.setProperty("--o0", at(open) + "%"); track.style.setProperty("--o1", at(close) + "%");
    const p = at(min);
    nowEl.hidden = p < 0 || p > 100;
    nowEl.style.setProperty("--now", clamp(p, 0, 100) + "%");
    nowEl.dataset.t = "Now " + fmt(min);
    nowEl.classList.toggle("flip", p > 72);
  }
  hours(); setInterval(hours, 60000);

  /* ---------------- tickets ---------------- */
  const tix = $$("#tix li").map(li => ({ li, price: +li.dataset.price, out: $("output", li), n: +$("output", li).textContent }));
  const totalEl = $("#tixTotal"), countEl = $("#tixCount"), bookBtn = $("#bookBtn"), bookMsg = $("#bookMsg");
  let shown = 0, traf = 0;
  const money = v => "£" + v.toFixed(2);
  function renderTix(animate) {
    const total = tix.reduce((s, t) => s + t.n * t.price, 0), people = tix.reduce((s, t) => s + t.n, 0);
    tix.forEach(t => { t.out.textContent = t.n; $('[data-d="-1"]', t.li).disabled = t.n === 0; $('[data-d="1"]', t.li).disabled = t.n >= 12; });
    countEl.textContent = people;
    countEl.parentElement.firstChild.textContent = "TOTAL FOR ";
    countEl.nextSibling.textContent = people === 1 ? " PERSON" : " PEOPLE";
    bookBtn.disabled = people === 0;
    bookMsg.textContent = "";
    cancelAnimationFrame(traf);
    if (!animate || reduce) { shown = total; totalEl.textContent = money(total); return; }
    const from = shown, start = performance.now();
    const fr = t => {
      const k = easeOut(clamp((t - start) / 500));
      shown = from + (total - from) * k;
      totalEl.textContent = money(Math.round(shown));
      if (k < 1) traf = requestAnimationFrame(fr); else { shown = total; totalEl.textContent = money(total); }
    };
    traf = requestAnimationFrame(fr);
  }
  $("#tix").addEventListener("click", e => {
    const b = e.target.closest("button[data-d]"); if (!b) return;
    const t = tix.find(x => x.li.contains(b));
    t.n = clamp(t.n + +b.dataset.d, 0, 12);
    renderTix(true);
  });
  bookBtn.addEventListener("click", () => {
    const NAMES = { 14: ["adult", "adults"], 6: ["child", "children"], 0: ["under-five", "under-fives"] };
    const list = tix.filter(t => t.n).map(t => `${t.n} ${NAMES[t.price][t.n === 1 ? 0 : 1]}`).join(", ");
    bookMsg.textContent = `Booking isn't open in this preview yet. You picked ${list}, ${totalEl.textContent} in all.`;
  });
  renderTix(false);

  /* ---------------- member card: tilts toward the pointer, light slides across it ---------------- */
  const card = $("#mcard");
  if (fine && !reduce) {
    card.addEventListener("pointermove", e => {
      const r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.classList.add("live");
      card.style.setProperty("--ry", ((px - 0.5) * 16).toFixed(2) + "deg");
      card.style.setProperty("--rx", ((0.5 - py) * 12).toFixed(2) + "deg");
      card.style.setProperty("--px", (px * 100).toFixed(1) + "%");
      card.style.setProperty("--py", (py * 100).toFixed(1) + "%");
      card.style.setProperty("--so", "1");
    });
    card.addEventListener("pointerleave", () => {
      card.classList.remove("live");
      ["--rx", "--ry", "--px", "--py", "--so"].forEach(p => card.style.removeProperty(p));
    });
  }

  /* ---------------- journal: a Read tag follows the pointer over the lead story ---------------- */
  const tag = $("#cursorTag"), leadFig = $("#leadPost .frame");
  if (fine && !reduce) {
    leadFig.addEventListener("pointerenter", e => { tag.style.transition = "none"; tag.style.setProperty("--cx", e.clientX + "px"); tag.style.setProperty("--cy", e.clientY + "px"); void tag.offsetWidth; tag.style.transition = ""; tag.style.setProperty("--cs", 1); });
    leadFig.addEventListener("pointermove", e => { tag.style.setProperty("--cx", e.clientX + "px"); tag.style.setProperty("--cy", e.clientY + "px"); });
    leadFig.addEventListener("pointerleave", () => tag.style.setProperty("--cs", 0));
    addEventListener("scroll", () => tag.style.setProperty("--cs", 0), { passive: true });
  }

  /* ---------------- newsletter ---------------- */
  const form = $("#signup");
  form.addEventListener("submit", e => {
    e.preventDefault();
    const input = $("input", form), out = $("#signupMsg");
    if (!input.value.trim() || !input.checkValidity()) {
      out.textContent = "Enter an email address like name@example.com.";
      input.focus(); return;
    }
    out.textContent = "Subscribed. The first letter arrives at the start of next month.";
    input.value = "";
  });

  /* ---------------- marquee: drifts on its own, speeds up and leans with the scroll ---------------- */
  const mq = $(".mq"), mqTrack = $("#mqTrack");
  {
    const ul = $("ul", mqTrack), copy = ul.cloneNode(true);
    copy.setAttribute("aria-hidden", "true");
    mqTrack.appendChild(copy);
    const d = new Date(), j = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = j.getUTCDay() || 7; j.setUTCDate(j.getUTCDate() + 4 - day);
    const wk = Math.ceil(((j - Date.UTC(j.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
    const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const M = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    $("#mqWeek").textContent = `WEEK ${wk} · ${mon.getDate()} ${M[mon.getMonth()]} – ${sun.getDate()} ${M[sun.getMonth()]}`;
  }
  let mqOn = false, mqX = 0, mqV = 0, mqDir = 1, mqPrev = performance.now(), mqY = scrollY;
  new IntersectionObserver(([e]) => { mqOn = e.isIntersecting; if (mqOn && !reduce) { mqPrev = performance.now(); requestAnimationFrame(mqFrame); } }).observe(mq);
  function mqFrame(t) {
    if (!mqOn) return;
    const dt = Math.min(0.05, (t - mqPrev) / 1000); mqPrev = t;
    const dy = scrollY - mqY; mqY = scrollY;
    if (Math.abs(dy) > 0.5) mqDir = dy > 0 ? 1 : -1;
    mqV += (dy / Math.max(dt, 0.001) - mqV) * 0.12;
    const w = mqTrack.firstElementChild.offsetWidth || 1;
    mqX -= (42 + Math.min(900, Math.abs(mqV) * 0.5)) * dt * mqDir;
    mqX = ((mqX % w) - w) % w;
    mqTrack.style.transform = `translate3d(${mqX.toFixed(1)}px,0,0)`;
    mqTrack.style.setProperty("--skew", clamp(-mqV * 0.004, -7, 7).toFixed(2) + "deg");
    requestAnimationFrame(mqFrame);
  }

  /* ---------------- footer curtain ---------------- */
  const footer = $("#footer"), mainEl = $("#main");
  const giantLetters = $$("#giant span");
  function footerMode() {
    document.body.classList.toggle("curtain", !reduce && innerWidth > 700 && footer.offsetHeight < innerHeight - 24);
  }

  // the footer wordmark is sized to run exactly edge to edge of the text column
  const giant = $("#giant");
  function fitGiant() {
    giant.style.fontSize = "";
    const cs = getComputedStyle(giant);
    const avail = giant.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const used = giantLetters.reduce((s, l) => s + l.getBoundingClientRect().width, 0) || 1;
    giant.style.fontSize = (parseFloat(cs.fontSize) * avail / used * 0.995).toFixed(1) + "px";
  }

  function layoutAll() {
    fitGiant();
    stems.forEach(buildStem);
    buildLinks();
    footerMode();
    syncPill();
    request();
  }

  /* ---------------- scroll-linked motion ---------------- */
  const nav = $("#siteNav");
  const heroTop = $("#heroTop"), heroBottom = $("#heroBottom"), heroVeil = $("#heroVeil");
  const parImgs = $$("img[data-par]").map(img => ({ img, box: img.closest(".frame"), par: +img.dataset.par }));
  const parFigs = $$("[data-parallax]").map(el => ({ el, par: +el.dataset.parallax }));
  const interlude = $(".interlude"), interPh = $("#interludePh"), interImg = $("img", interPh);
  const dome = $("#dome"), membership = $("#membership");
  let lastY = scrollY, navAway = false;

  function setFill(f, p) {
    const n = f.items.length;
    f.items.forEach((w, i) => {
      const x = clamp((p * (n + 5) - i) / 5);
      if (w.classList.contains("inlay")) w.style.setProperty("--inlay", (0.2 + 0.8 * x).toFixed(3));
      else w.style.setProperty("--o", (0.16 + 0.84 * x).toFixed(3));
    });
  }

  function onFrame() {
    ticking = false;
    const y = scrollY, vh = innerHeight;

    // nav: transparent over the hero, a floating capsule after; hides while reading down, returns on the way up
    nav.classList.toggle("solid", y > vh * 0.6);
    const goingDown = y > lastY + 2, goingUp = y < lastY - 2;
    if (!jumping && performance.now() - jumpEnded > 400 && !menu.classList.contains("open")) {
      if (goingDown && y > vh * 1.1 && !navAway) { nav.classList.add("away"); navAway = true; }
      else if ((goingUp || y < vh * 1.1) && navAway) { nav.classList.remove("away"); navAway = false; }
    }
    lastY = y;
    if (reduce) { fills.forEach(f => setFill(f, 1)); dome.style.setProperty("--dome", 0); return; }

    // hero sinks and darkens while the reading sheet slides over it
    if (y < vh * 1.4) {
      const k = clamp(y / (vh * 0.9));
      hero.style.transform = `translate3d(0, ${(y * 0.42).toFixed(1)}px, 0)`;
      heroVeil.style.opacity = (k * 0.65).toFixed(3);
      heroTop.style.transform = `translate3d(0, ${(-y * 0.12).toFixed(1)}px, 0)`;
      heroTop.style.opacity = 1 - clamp(k * 1.1);
      heroBottom.style.opacity = 1 - clamp(k * 1.5);
    }

    // pictures drift inside their frames
    parImgs.forEach(({ img, box, par }) => {
      const r = box.getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50) return;
      const p = clamp((vh - r.top) / (vh + r.height));
      img.style.transform = `translate3d(0, ${((p - 0.5) * par).toFixed(1)}px, 0) scale(1.14)`;
    });
    parFigs.forEach(({ el, par }) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50) return;
      const p = clamp((vh - r.top) / (vh + r.height));
      el.style.transform = `translate3d(0, ${((p - 0.5) * par).toFixed(1)}px, 0)`;
    });

    // statements light up word by word
    fills.forEach(f => {
      if (f.scrub) return;
      const r = f.el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      setFill(f, clamp((vh * 0.88 - r.top) / (r.height + vh * 0.32)));
    });

    // interlude: the photo opens from a small window to the full screen, then the quote lights up
    const ir = interlude.getBoundingClientRect();
    if (ir.bottom > 0 && ir.top < vh) {
      const q = clamp(-ir.top / Math.max(1, ir.height - vh));
      const k = easeOut(clamp(q / 0.55));
      const iy = (1 - k) * 24, ix = (1 - k) * 30, rad = (1 - k) * 220;
      interPh.style.clipPath = `inset(${iy}% ${ix}% ${iy}% ${ix}% round ${rad}px ${rad}px 8px 8px)`;
      interImg.style.transform = `scale(${(1.3 - 0.3 * k).toFixed(4)})`;
      fills.forEach(f => { if (f.scrub) setFill(f, clamp((q - 0.12) / 0.5)); });
    }

    // section-break stems draw themselves as they cross the screen
    stems.forEach(s => {
      if (!s.path) return;
      const r = s.svg.getBoundingClientRect();
      if (r.bottom < -40 || r.top > vh + 40) return;
      const p = clamp((vh * 0.96 - r.top) / (vh * 0.62));
      s.path.style.strokeDashoffset = (s.len * (1 - p)).toFixed(1);
      s.leaves.forEach(l => l.el.style.setProperty("--s", easeOut(clamp((p - l.f) / 0.07)).toFixed(3)));
      s.buds.forEach(b => b.el.style.setProperty("--b", easeOut(clamp((p - b.f) / 0.12)).toFixed(3)));
    });

    // membership: the dark band rises with a dome that flattens as it arrives
    const mr = membership.getBoundingClientRect();
    if (mr.top < vh * 1.2 && mr.bottom > 0) dome.style.setProperty("--dome", clamp(1 - (vh - mr.top) / (vh * 0.75)).toFixed(3));

    // member card leans a little with the scroll on touch screens
    if (!fine) {
      const cr = card.getBoundingClientRect();
      if (cr.bottom > 0 && cr.top < vh) card.style.setProperty("--rx", ((cr.top / vh - 0.5) * 10).toFixed(2) + "deg");
    }

    // footer: the giant wordmark stands up letter by letter as the page lifts away
    const mb = mainEl.getBoundingClientRect().bottom;
    if (mb < vh + 50) {
      const p = clamp((vh - mb) / Math.max(1, footer.offsetHeight));
      giantLetters.forEach((l, i) => l.style.setProperty("--gy", ((1 - easeOut(clamp(p * 1.7 - 0.45 - i * 0.045))) * 105).toFixed(1) + "%"));
    }
  }
  let ticking = false;
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(onFrame); } };
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", request);
  stems.forEach(buildStem);
  onFrame();

  /* ================= Daybook scroll engine (vanilla port) ================= */
  const SPEED = 1.5;
  const ms = m => Math.round(m / SPEED);
  const NAV = ["top", "seasons", "grounds", "visit", "membership", "journal"];

  // 1. smooth wheel: mouse-wheel notches glide; trackpads and touch stay native
  const LERP = 0.15;
  function isWheelNotch(e) {
    if (e.deltaMode !== 0) return true;
    return Math.abs(e.deltaY) >= 40 && Number.isInteger(e.deltaY) && e.deltaX === 0;
  }
  function canScroll(el, dir) {
    const isRoot = el === document.scrollingElement;
    if (!isRoot) {
      const oy = getComputedStyle(el).overflowY;
      if (oy !== "auto" && oy !== "scroll" && oy !== "overlay") return false;
    } else if (getComputedStyle(root).overflowY === "hidden" || getComputedStyle(document.body).overflowY === "hidden") return false;
    if (el.scrollHeight <= el.clientHeight + 1) return false;
    return dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0;
  }
  const CONTAINED = "contained";
  function scrollerFor(target, dir) {
    let el = target instanceof Element ? target : null;
    while (el && el !== document.body && el !== root) {
      if (canScroll(el, dir)) return el;
      if (el.hasAttribute("data-scroll-contain")) return CONTAINED;
      el = el.parentElement;
    }
    const s = document.scrollingElement;
    return s && canScroll(s, dir) ? s : null;
  }
  if (!reduce) {
    let el = null, pos = 0, to = 0, last = 0, lastPos = 0, raf = 0, lastWheel = 0, moved = false;
    const stop = () => { cancelAnimationFrame(raf); raf = 0; el = null; };
    const frame = t => {
      raf = 0;
      if (!el || !el.isConnected) return stop();
      if (Math.abs(el.scrollTop - lastPos) > 2) return stop();
      const dt = Math.min(0.1, Math.max(0, (t - last) / 1000)); last = t;
      pos += (to - pos) * (1 - Math.exp(-60 * LERP * dt));
      const done = Math.abs(to - pos) < 0.5;
      if (done) pos = to;
      el.scrollTo({ top: pos, behavior: "instant" });
      lastPos = el.scrollTop;
      if (done) stop(); else raf = requestAnimationFrame(frame);
    };
    addEventListener("wheel", e => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (!isWheelNotch(e)) {
        if (e.deltaY && scrollerFor(e.target, Math.sign(e.deltaY)) === CONTAINED) e.preventDefault();
        return;
      }
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
      const dir = Math.sign(delta), t = performance.now();
      const found = scrollerFor(e.target, dir);
      if (found === CONTAINED) { e.preventDefault(); return; }
      let target = found;
      if (!moved && el && raf && t - lastWheel < 300 && Math.sign(to - pos) === dir && canScroll(el, dir)) target = el;
      lastWheel = t; moved = false;
      if (!target) return;
      e.preventDefault();
      const max = target.scrollHeight - target.clientHeight;
      if (el !== target || !raf) {
        cancelAnimationFrame(raf); raf = 0;
        el = target; pos = to = target.scrollTop;
        last = performance.now() - 1000 / 60;
      }
      to = Math.max(0, Math.min(max, to + delta));
      lastPos = target.scrollTop;
      if (!raf) raf = requestAnimationFrame(frame);
    }, { passive: false });
    const cancel = () => el && stop();
    let mx = -1, my = -1;
    addEventListener("pointerdown", cancel, true);
    addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse") return;
      if (Math.abs(e.clientX - mx) + Math.abs(e.clientY - my) > 3) moved = true;
      mx = e.clientX; my = e.clientY;
    }, { passive: true, capture: true });
    addEventListener("touchstart", cancel, { passive: true, capture: true });
    addEventListener("keydown", cancel, true);
  }

  // 2. section jump on the app's one curve, cubic-bezier(0.65, 0, 0.35, 1)
  const navLinks = [...document.querySelectorAll(".links a")];
  function setActive(id) {
    if (id === active) return;
    active = id;
    syncPill();
    navLinks.forEach(a => { if (a.getAttribute("href") === "#" + id) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
  }
  function topbarHeight() { return nav.getBoundingClientRect().height; }
  function sectionTop(id) {
    const el = document.getElementById(id);
    const max = root.scrollHeight - innerHeight;
    if (!el || id === NAV[0]) return 0;
    return Math.max(0, Math.min(max, scrollY + el.getBoundingClientRect().top - topbarHeight() + 1));
  }
  function ease(x) {
    const [x1, y1, x2, y2] = [0.65, 0, 0.35, 1];
    const bx = t => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
    const by = t => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 24; i++) { t = (lo + hi) / 2; if (bx(t) < x) lo = t; else hi = t; }
    return by(t);
  }
  function scrollToSection(id, opts = {}) {
    stopJump?.();
    setActive(id);
    const from = scrollY;
    if (opts.instant || reduce || Math.abs(sectionTop(id) - from) < 2) { scrollTo({ top: sectionTop(id), behavior: "instant" }); return; }
    const dist = Math.abs(sectionTop(id) - from);
    const dur = ms(Math.min(800, 450 + dist * 0.05));
    const start = performance.now();
    jumping = id;
    nav.classList.remove("away"); navAway = false;
    const end = () => {
      cancelAnimationFrame(jraf); jumping = null; stopJump = null; jumpEnded = performance.now();
      removeEventListener("wheel", end); removeEventListener("touchstart", end); removeEventListener("keydown", end);
      dispatchEvent(new Event("hm:jumped"));
    };
    stopJump = end;
    addEventListener("wheel", end, { passive: true });
    addEventListener("touchstart", end, { passive: true });
    addEventListener("keydown", end);
    const fr = t => {
      const p = Math.min(1, (t - start) / dur);
      scrollTo({ top: from + (sectionTop(id) - from) * ease(p), behavior: "instant" });
      if (p < 1) jraf = requestAnimationFrame(fr); else end();
    };
    jraf = requestAnimationFrame(fr);
  }
  const sectionOf = href => {
    if (!href || !href.startsWith("#")) return null;
    const id = href.slice(1) || "top";
    return NAV.includes(id) ? id : null;
  };

  // 3. scroll spy: the menu highlight and the address follow the section on screen
  let hash = location.hash.replace(/^#/, "");
  let sraf = 0;
  const spy = () => {
    sraf = 0;
    if (jumping) return;
    const top = topbarHeight();
    const line = top + (innerHeight - top) * 0.35;
    const atEnd = scrollY + innerHeight >= root.scrollHeight - 2;
    let id = NAV[0];
    for (const n of NAV) { const el = document.getElementById(n); if (el && el.getBoundingClientRect().top <= line) id = n; }
    if (scrollY < 4) id = NAV[0];
    else if (atEnd) id = NAV[NAV.length - 1];
    setActive(id);
    const want = id === NAV[0] ? "" : id;
    if (want !== hash) {
      hash = want;
      try { history.replaceState(history.state, "", want ? "#" + want : location.pathname + location.search); } catch (e) {}
    }
  };
  const onSpy = () => { if (!sraf) sraf = requestAnimationFrame(spy); };
  new ResizeObserver(onSpy).observe(document.body);
  addEventListener("scroll", onSpy, { passive: true });
  addEventListener("resize", onSpy);
  addEventListener("hm:jumped", onSpy);

  // any link to a section glides there; links inside the menu close it first
  document.addEventListener("click", e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.("a[href]");
    if (!a || a.getAttribute("target")) return;
    const id = sectionOf(a.getAttribute("href"));
    if (!id) return;
    e.preventDefault(); e.stopPropagation();
    const fromMenu = menu.contains(a);
    if (fromMenu) closeMenu(false);
    a.blur();
    scrollToSection(id);
    // move keyboard focus to the section, without a second scroll
    const target = document.getElementById(id === "top" ? "top" : id);
    if (target) { target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: true }); }
  }, true);

  // opening at #section lands there instantly; a typed #section glides there
  const landId = sectionOf(location.hash);
  if (landId && landId !== "top") { scrollToSection(landId, { instant: true }); requestAnimationFrame(() => scrollToSection(landId, { instant: true })); }
  addEventListener("hashchange", () => { const id = sectionOf(location.hash); if (id && id !== active) scrollToSection(id); });
  spy();
})();
