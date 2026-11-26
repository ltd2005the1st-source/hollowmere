(() => {
  const hero = document.getElementById("top");
  const canvas = document.getElementById("garden");
  const bareImg = document.getElementById("bareImg");
  const hint = document.getElementById("hint") || document.createElement("p");
  const hintText = document.getElementById("hintText") || document.createElement("span");

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = matchMedia("(hover: none), (pointer: coarse)").matches;
  if (coarse) hintText.textContent = "Touch the branch";

  const IW = 2048, IH = 998;              // source picture size
  const GW = 220, GH = 108;               // growth field, laid over the picture
  const grow = new Float32Array(GW * GH);
  const growBytes = new Uint8Array(GW * GH);

  // where the branch runs in the picture (image uv, 0..1), used by the touch-screen wanderer
  const branchV = u => 0.655 - 0.035 * u;

  let W = 0, H = 0, dpr = 1, panX = 0.5, cover = { ox: 0, oy: 0, dw: 1, dh: 1 };
  function layout() {
    const r = hero.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    canvas.width = W; canvas.height = H;
    // portrait screens see a narrow slice; lean it toward the long run of branch with the fork in view
    panX = r.width / r.height < 0.9 ? 0.55 : 0.5;
    const panY = 0.45;
    hero.style.setProperty("--pan-x", panX * 100 + "%");
    const s = Math.max(W / IW, H / IH);
    const dw = IW * s, dh = IH * s;
    cover = { ox: (W - dw) * panX, oy: (H - dh) * panY, dw, dh };
    if (gl) gl.viewport(0, 0, W, H);
  }

  // ---------- pointer → a point in picture space ----------
  let pointer = null;           // {u, v} in picture uv, or null when the cursor is away
  let lastInput = -1e9;
  let interacted = false;
  function toPicture(clientX, clientY) {
    const r = hero.getBoundingClientRect();
    return {
      u: ((clientX - r.left) * dpr - cover.ox) / cover.dw,
      v: ((clientY - r.top) * dpr - cover.oy) / cover.dh,
    };
  }
  function seen() {
    lastInput = performance.now();
    if (!interacted) { interacted = true; setTimeout(() => hint.classList.add("gone"), 2400); }
  }
  if (!reduce) {
    hero.addEventListener("pointermove", e => {
      if (e.pointerType === "mouse" && e.movementX === 0 && e.movementY === 0 && !pointer) return; // synthetic
      pointer = toPicture(e.clientX, e.clientY); seen();
    }, { passive: true });
    hero.addEventListener("pointerdown", e => { pointer = toPicture(e.clientX, e.clientY); seen(); });
    hero.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") pointer = null; });
    const lift = e => { if (e.pointerType !== "mouse") { pointer = null; lastInput = performance.now(); } };
    hero.addEventListener("pointerup", lift);
    hero.addEventListener("pointercancel", lift);
  }

  // ---------- growth field ----------
  // Each cell eases toward 1 near the cursor and back to 0 away from it. Moss shows where the field
  // passes a noisy threshold, so the edge creeps along the bark instead of sliding as a hard circle.
  function radiusPx() { return Math.min(377, Math.max(170, 0.234 * W / dpr)) * dpr; }
  let prevC = null;
  function stepField(dt, c) {
    const R = radiusPx(), inner = R * 0.12;
    const rise = 1 - Math.exp(-dt / 0.115), fall = 1 - Math.exp(-dt / 0.32);
    // stamp along the whole path the cursor took since the last frame, so fast sweeps leave no gaps
    const cx = c ? c.u * cover.dw : 0, cy = c ? c.v * cover.dh : 0;
    const px = c && prevC ? prevC.u * cover.dw : cx, py = c && prevC ? prevC.v * cover.dh : cy;
    const sgx = cx - px, sgy = cy - py, sl = sgx * sgx + sgy * sgy || 1;
    prevC = c;
    const sx = cover.dw / GW, sy = cover.dh / GH;
    for (let j = 0; j < GH; j++) {
        for (let i = 0; i < GW; i++) {
        const k = j * GW + i;
        let t = 0;
        if (c) {
          const qx = (i + 0.5) * sx, qy = (j + 0.5) * sy;
          const h = Math.min(1, Math.max(0, ((qx - px) * sgx + (qy - py) * sgy) / sl));
          const dx = qx - (px + sgx * h), ey = qy - (py + sgy * h);
          const d = Math.sqrt(dx * dx + ey * ey);
          if (d < R) { const x = Math.min(1, Math.max(0, (d - inner) / (R - inner))); t = Math.pow(1 - x, 1.6); }
        }
        const g = grow[k];
        grow[k] = g + (t - g) * (t > g ? rise : fall);
        growBytes[k] = grow[k] * 255;
      }
    }
  }
  function settleField(c) { for (let n = 0; n < 60; n++) stepField(0.1, c); }

  // the touch-screen wanderer: when nobody is touching, an invisible hand drifts along the branch
  function wanderer(now) {
    const u0 = -cover.ox / cover.dw, u1 = (W - cover.ox) / cover.dw;
    const span = u1 - u0, mid = (u0 + u1) / 2;
    const t = now / 1000;
    const u = mid + span * 0.34 * Math.sin(t * 0.32) + span * 0.04 * Math.sin(t * 0.9);
    return { u, v: branchV(u) - 0.05 + 0.04 * Math.sin(t * 0.55) };
  }

  // ---------- WebGL2 renderer ----------
  let gl = null, prog, texGrow, texSet = [], uni = {};
  // swap the picture pair in place (day and night share the same framing)
  function uploadSet(bareI, mossI, maskI) {
    [bareI, mossI, maskI].forEach((img, i) => {
      gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, texSet[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      if (i < 2) gl.generateMipmap(gl.TEXTURE_2D);
    });
  }
  const VS = `#version 300 es
  in vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }`;
  const FS = `#version 300 es
  precision highp float;
  uniform sampler2D uBare, uMoss, uMask, uGrow;
  uniform vec2 uRes, uOff, uSize; uniform float uTime;
  out vec4 o;
  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float s = 0., a = .5; for (int k = 0; k < 4; k++){ s += a * noise(p); p *= 2.03; a *= .5; } return s / .9375; }
  void main(){
    vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    vec2 uv = (p - uOff) / uSize;
    vec3 bare = texture(uBare, uv).rgb;
    vec3 moss = texture(uMoss, uv).rgb;
    vec2 mk = texture(uMask, uv).rg;           // r: where the picture changes (moss), g: flower heads
    float g = texture(uGrow, uv).r;
    // two scales of noise: broad patches plus fine tufts, so the front frays like real moss
    float n = .5 * fbm(uv * vec2(16., 7.8) + vec2(uTime * .01, 0.)) + .5 * fbm(uv * vec2(130., 63.));
    // moss takes hold first where it is thickest, then creeps out to the fronds
    float th = -.05 + .95 * n - .2 * mk.r;
    float m = smoothstep(th, th + .08, g);
    // flowers open only once the moss around them is established
    float bt = th + .26;
    float bl = smoothstep(bt, bt + .14, g);
    vec3 bud = textureLod(uMoss, uv, 4.5).rgb * vec3(.78, .9, .52);
    vec3 col = mix(moss, mix(bud, moss, bl), mk.g);
    col += mk.g * bl * (1. - bl) * .55;        // a small flash as each flower opens
    vec3 outc = mix(bare, col, m);
    // a soft band of sunlight just along the growing front, flickering slightly like dew
    float edge = smoothstep(th - .16, th, g) * (1. - smoothstep(th + .02, th + .16, g));
    float dew = .75 + .25 * sin(uTime * 3. + n * 40.);
    float lum = dot(outc, vec3(.3, .59, .11));
    outc += edge * dew * smoothstep(.1, .5, mk.r) * vec3(1., .94, .7) * (.2 + .32 * lum);
    o = vec4(outc, 1.);
  }`;
  function initGL(bareI, mossI, maskI) {
    gl = canvas.getContext("webgl2", { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) return false;
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x);
      if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = (unit, img, mip) => {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      if (img) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); if (mip) gl.generateMipmap(gl.TEXTURE_2D); }
      return t;
    };
    texSet = [tex(0, bareI, true), tex(1, mossI, true), tex(2, maskI, false)];
    texGrow = tex(3, null, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    ["uBare","uMoss","uMask","uGrow","uRes","uOff","uSize","uTime"].forEach(n => uni[n] = gl.getUniformLocation(prog, n));
    gl.uniform1i(uni.uBare, 0); gl.uniform1i(uni.uMoss, 1); gl.uniform1i(uni.uMask, 2); gl.uniform1i(uni.uGrow, 3);
    return true;
  }
  function drawGL(now) {
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, texGrow);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, GW, GH, 0, gl.RED, gl.UNSIGNED_BYTE, growBytes);
    gl.uniform2f(uni.uRes, W, H); gl.uniform2f(uni.uOff, cover.ox, cover.oy); gl.uniform2f(uni.uSize, cover.dw, cover.dh);
    gl.uniform1f(uni.uTime, now / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---------- 2D fallback: a soft round window onto the mossy picture ----------
  let ctx = null, mossImg2d = null, fade = 0, last2d = null;
  function draw2D(dt, c) {
    fade += ((c ? 1 : 0) - fade) * (1 - Math.exp(-dt / 0.4));
    if (c) last2d = c;
    ctx.clearRect(0, 0, W, H);
    if (!last2d || fade < 0.01) return;
    const x = cover.ox + last2d.u * cover.dw, y = cover.oy + last2d.v * cover.dh, R = radiusPx() * fade;
    ctx.save();
    ctx.drawImage(mossImg2d, cover.ox, cover.oy, cover.dw, cover.dh);
    ctx.globalCompositeOperation = "destination-in";
    const gr = ctx.createRadialGradient(x, y, R * 0.2, x, y, R);
    gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ---------- boot ----------
  const load = src => new Promise((res, rej) => { const i = new Image(); i.decoding = "async"; i.onload = () => res(i); i.onerror = rej; i.src = src; });
  // day pictures in light mode, night pictures in dark mode
  const SETS = {
    day: ["assets/bare.jpg", "assets/mossy.jpg", "assets/mask.png"],
    night: ["assets/night-bare.jpg", "assets/night-mossy.jpg", "assets/night-mask.png"],
  };
  const darkMQ = matchMedia("(prefers-color-scheme: dark)");
  const isDark = () => {
    const t = document.documentElement.getAttribute("data-theme");
    return t ? t === "dark" : darkMQ.matches;
  };
  const cache = {};
  const loadSet = name => cache[name] || (cache[name] = Promise.all(SETS[name].map(load)));
  let current = isDark() ? "night" : "day";
  bareImg.src = SETS[current][0];
  loadSet(current).then(([b, m, k]) => {
    let useGL = false;
    try { gl = null; useGL = initGL(b, m, k); } catch (err) { console.warn(err); gl = null; useGL = false; }
    if (!useGL) { ctx = canvas.getContext("2d"); mossImg2d = m; }
    layout();
    new ResizeObserver(() => { layout(); if (reduce) still(); }).observe(hero);

    // reduced motion: no growing and no following; one still patch of moss on the fork of the branch
    function still() {
      const spot = { u: 0.72, v: 0.6 };
      if (useGL) { grow.fill(0); settleField(spot); drawGL(0); } else { fade = 1; last2d = spot; draw2D(1, spot); }
    }
    canvas.classList.add("ready");

    // follow the theme: swap both the still picture and the textures when it changes
    function applyTheme() {
      const want = isDark() ? "night" : "day";
      if (want === current) return;
      current = want;
      loadSet(want).then(([nb, nm, nk]) => {
        if (current !== want) return;
        bareImg.src = SETS[want][0];
        if (useGL) uploadSet(nb, nm, nk); else mossImg2d = nm;
        if (reduce) still();
      }).catch(() => {});
    }
    darkMQ.addEventListener?.("change", applyTheme);
    new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    if (reduce) { hint.hidden = true; still(); return; }

    // stop drawing while the hero is scrolled out of view
    let onScreen = true;
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(hero);
    let prev = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      if (!onScreen) { requestAnimationFrame(frame); return; }
      let c = pointer;
      if (!c && coarse && now - lastInput > 2500) c = wanderer(now);
      if (useGL) { stepField(dt, c); drawGL(now); } else draw2D(dt, c);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }).catch(() => { /* pictures failed to load: the bare branch stays as a still background */ });
})();
