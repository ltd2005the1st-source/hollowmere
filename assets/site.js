/* Hollowmere: page behaviour below the hero.
   Theme, menu, the month picker, scroll-driven motion, and the Daybook scroll engine
   (smooth wheel, section jumps, scroll spy). No libraries. */
(() => {
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  let active = "top", jumping = null, jraf = 0, stopJump = null, jumpEnded = 0;
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  /* ---------------- theme ---------------- */
  const themeBtn = document.getElementById("themeBtn");
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
  const menu = document.getElementById("menu");
  const menuBtn = document.getElementById("menuBtn");
  const menuClose = document.getElementById("menuClose");
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
      const f = [...menu.querySelectorAll("a, button")];
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });

  /* ---------------- months ---------------- */
  const MONTHS = [
    ["JAN", "Witch hazel and hellebores", "East gate", "witch hazel in frost by the east gate"],
    ["FEB", "Snowdrops and winter aconite", "Moss Hollow", "snowdrops under the oaks in Moss Hollow"],
    ["MAR", "Daffodils and wood anemone", "Long Meadow", "daffodils along the top of Long Meadow"],
    ["APR", "Bluebells and cherry blossom", "Beech wood", "bluebells under the beeches"],
    ["MAY", "Wisteria and alliums", "Walled Garden", "wisteria on the Walled Garden's south wall"],
    ["JUN", "Old roses and foxgloves", "Walled Garden", "foxgloves at the edge of the wood"],
    ["JUL", "Lavender and meadow grasses", "Long Meadow", "lavender walk at midday"],
    ["AUG", "Hydrangeas and water lilies", "Lily Ponds", "water lilies open on the middle pond"],
    ["SEP", "Asters and sedum", "Walled Garden", "asters with bees, Walled Garden borders"],
    ["OCT", "Maple colour and cyclamen", "Fern Gully", "red maples over Fern Gully"],
    ["NOV", "Mosses and holly berries", "North wall", "moss on the north wall after rain"],
    ["DEC", "Frosted seedheads and winter box", "Long Meadow", "frosted seedheads at sunrise"],
  ];
  const monthsEl = document.getElementById("months");
  const caption = document.getElementById("monthCaption");
  const monthPh = document.querySelector(".month-ph .ph-img");
  const now = new Date().getMonth();
  MONTHS.forEach(([m, what, where], i) => {
    const li = document.createElement("li");
    li.style.transitionDelay = Math.min(i * 40, 400) + "ms";
    li.innerHTML = `<button type="button" aria-pressed="${i === now}"><span class="data">${m}</span><span class="what">${what}</span><span class="where">${where}</span></button>`;
    monthsEl.appendChild(li);
  });
  function pickMonth(i) {
    monthsEl.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-pressed", String(i === j)));
    caption.textContent = "Image: " + MONTHS[i][3];
    // shift the placeholder light so the swap is visible until real photos arrive
    monthPh.style.setProperty("--x1", 20 + (i * 37) % 60 + "%");
    monthPh.style.setProperty("--y1", 25 + (i * 23) % 50 + "%");
  }
  monthsEl.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    pickMonth([...monthsEl.querySelectorAll("button")].indexOf(b));
  });
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    monthsEl.addEventListener("pointerover", e => {
      const b = e.target.closest("button"); if (!b) return;
      pickMonth([...monthsEl.querySelectorAll("button")].indexOf(b));
    });
  }
  pickMonth(now);

  /* ---------------- newsletter ---------------- */
  const form = document.getElementById("signup");
  form.addEventListener("submit", e => {
    e.preventDefault();
    const input = form.querySelector("input"), out = document.getElementById("signupMsg");
    if (!input.value.trim() || !input.checkValidity()) {
      out.textContent = "Enter an email address like name@example.com.";
      input.focus(); return;
    }
    out.textContent = "Subscribed. The first letter arrives at the start of next month.";
    input.value = "";
  });

  /* ---------------- text lines that fall into place ---------------- */
  // Wraps each rendered line of a heading so it can drop in from above its own mask.
  function splitLines(el) {
    if (!el.dataset.src) el.dataset.src = el.innerHTML;
    el.innerHTML = el.dataset.src;
    const words = [];
    const walk = (node, wrapTag) => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach(p => {
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
    // group words by line
    const lines = [];
    let top = null;
    words.forEach(w => {
      const t = Math.round(w.getBoundingClientRect().top);
      if (top === null || Math.abs(t - top) > 4) { lines.push([]); top = t; }
      lines[lines.length - 1].push(w);
    });
    // rebuild: each line keeps its inline wrappers (such as <em>) around its words
    const rebuilt = lines.map((ws, i) => {
      const html = ws.map(w => {
        let out = w.outerHTML, p = w.parentElement;
        while (p && p !== el) { out = `<${p.tagName.toLowerCase()}>${out}</${p.tagName.toLowerCase()}>`; p = p.parentElement; }
        return out;
      }).join(" ");
      return `<span class="ln"><span class="ln-i" style="--i:${i}">${html}</span></span>`;
    }).join("");
    el.innerHTML = rebuilt;
  }
  const lineEls = [...document.querySelectorAll("[data-lines]")];
  const splitAll = () => lineEls.forEach(splitLines);
  (document.fonts?.ready || Promise.resolve()).then(() => {
    splitAll(); root.classList.add("ready");
    requestAnimationFrame(() => requestAnimationFrame(playHero));
  });
  let lastW = innerWidth, rsT = 0;
  addEventListener("resize", () => {
    if (innerWidth === lastW) return; lastW = innerWidth;
    clearTimeout(rsT); rsT = setTimeout(splitAll, 180);
  });

  /* ---------------- font pairing preview ---------------- */
  const FONTS = window.HM_FONTS || {};
  const NAMES = {
    "": "Cormorant + Hanken Grotesk",
    "fraunces-inter": "Fraunces + Inter",
    "garamond-work": "Cormorant Garamond + Work Sans",
    "dmserif-dmsans": "DM Serif Display + DM Sans",
    "newsreader-instrument": "Newsreader + Instrument Sans",
    "bricolage-sourceserif": "Bricolage Grotesque + Source Serif 4",
  };
  const ORDER = Object.keys(NAMES);
  const fontBtn = document.getElementById("fontBtn");
  const fontPanel = document.getElementById("fontPanel");
  const fontLabel = document.getElementById("fontBtnLabel");
  const ensureFont = key => {
    if (!key || document.getElementById("font-" + key)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.id = "font-" + key;
    l.href = "https://fonts.googleapis.com/css2?" + FONTS[key] + "&display=swap";
    document.head.appendChild(l);
  };
  const currentFonts = () => root.getAttribute("data-fonts") || "";
  function syncFontUI() {
    const k = currentFonts();
    fontLabel.textContent = NAMES[k];
    fontPanel.querySelectorAll("button[data-f]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.f === k)));
  }
  function setFonts(key) {
    ensureFont(key);
    if (key) root.setAttribute("data-fonts", key); else root.removeAttribute("data-fonts");
    try { key ? localStorage.setItem("hm-fonts", key) : localStorage.removeItem("hm-fonts"); } catch (e) {}
    syncFontUI();
    // headings were split into lines with the old metrics: split again once the new faces arrive
    (document.fonts?.ready || Promise.resolve()).then(() => setTimeout(splitAll, 60));
    setTimeout(splitAll, 700);
  }
  function toggleFontPanel(open = fontPanel.hidden) {
    fontPanel.hidden = !open;
    fontBtn.setAttribute("aria-expanded", String(open));
    if (open) ORDER.forEach(ensureFont); // so each option can show itself in its own faces
  }
  fontBtn.addEventListener("click", () => toggleFontPanel());
  fontPanel.addEventListener("click", e => { const b = e.target.closest("button[data-f]"); if (b) setFonts(b.dataset.f); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !fontPanel.hidden) { toggleFontPanel(false); fontBtn.focus(); }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
    if ((e.key === "f" || e.key === "F") && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
      setFonts(ORDER[(ORDER.indexOf(currentFonts()) + 1) % ORDER.length]);
    }
  });
  document.addEventListener("pointerdown", e => { if (!fontPanel.hidden && !e.target.closest("#fontpick")) toggleFontPanel(false); });
  syncFontUI();

  /* ---------------- reveal on entry ---------------- */
  // A clipped element has no visible area, so pictures are watched through their parent.
  const watched = new Map();
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      (watched.get(e.target) || []).forEach(el => el.classList.add("in"));
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0 });
  const watch = (el, via = el) => { if (!watched.has(via)) watched.set(via, []); watched.get(via).push(el); io.observe(via); };
  const hero = document.getElementById("top");
  document.querySelectorAll("[data-lines], [data-reveal], [data-stagger], [data-clip], .areas").forEach(el => {
    if (hero.contains(el)) return; // the hero plays in as soon as the page is ready
    watch(el, el.hasAttribute("data-clip") ? el.parentElement : el);
  });
  const playHero = () => hero.querySelectorAll("[data-lines], [data-reveal]").forEach(el => el.classList.add("in"));

  /* ---------------- scroll-linked motion ---------------- */
  const nav = document.getElementById("siteNav");
  const heroTop = document.getElementById("heroTop");
  const heroBottom = document.getElementById("heroBottom");
  const growEls = [...document.querySelectorAll("[data-grow]")].map(el => ({ el, inner: el.querySelector("[data-inner]"), par: parseFloat(el.dataset.parallax || 0) }));
  const interlude = document.querySelector(".interlude");
  const interPh = document.getElementById("interludePh");
  const interInner = interPh.querySelector("[data-inner]");
  let lastY = scrollY, navAway = false;

  function onFrame() {
    ticking = false;
    const y = scrollY, vh = innerHeight;

    // nav: transparent over the hero, solid after; hides while reading down, returns on the way up
    nav.classList.toggle("solid", y > vh * 0.6);
    const goingDown = y > lastY + 2, goingUp = y < lastY - 2;
    if (!jumping && performance.now() - jumpEnded > 400 && !menu.classList.contains("open")) {
      if (goingDown && y > vh * 0.9 && !navAway) { nav.classList.add("away"); navAway = true; }
      else if ((goingUp || y < vh * 0.9) && navAway) { nav.classList.remove("away"); navAway = false; }
    }
    lastY = y;
    if (reduce) return;

    // hero copy drifts up and thins out as the page lifts away from it
    if (y < vh * 1.2) {
      const k = clamp(y / (vh * 0.85));
      heroTop.style.transform = `translate3d(0, ${-y * 0.28}px, 0)`;
      heroTop.style.opacity = 1 - k;
      heroBottom.style.transform = `translate3d(0, ${-y * 0.12}px, 0)`;
      heroBottom.style.opacity = 1 - clamp(k * 1.4);
    }

    // pictures grow into place, then keep settling while they cross the screen
    growEls.forEach(({ el, inner, par }) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      const p = clamp((vh - r.top) / (vh + r.height));
      const g = easeOut(clamp(p * 2.4));
      el.style.transform = `translate3d(0, ${par ? (p - 0.5) * par : 0}px, 0) scale(${0.86 + 0.14 * g})`;
      if (inner) inner.style.transform = `translate3d(0, ${(p - 0.5) * -4}%, 0) scale(${1.26 - 0.2 * p})`;
    });

    // interlude: the photo opens from a small window to the full screen
    const ir = interlude.getBoundingClientRect();
    if (ir.bottom > 0 && ir.top < vh) {
      const q = clamp(-ir.top / Math.max(1, ir.height - vh) / 0.65);
      const k = easeOut(q);
      const iy = (1 - k) * 22, ix = (1 - k) * 26, rad = (1 - k) * 18;
      interPh.style.clipPath = `inset(${iy}% ${ix}% ${iy}% ${ix}% round ${rad}px)`;
      interInner.style.transform = `scale(${1.35 - 0.35 * k})`;
    }
  }
  let ticking = false;
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(onFrame); } };
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", request);
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
