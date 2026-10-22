// Spore haze: neon smoke (WebGL2 stable fluids) + glowing spore specks (2D canvas)
// that the cursor stirs. Colours and behaviour come from --haze-* custom properties on <body>
// (defaults in global.css :root, per-game overrides in src/data/games.ts).
// Reduced motion => both canvases removed and the static CSS backdrop shows. No WebGL2 (or a lost
// context) => only the smoke canvas is removed; the 2D spores keep drifting over the CSS backdrop.

const fluidCanvas = document.querySelector<HTMLCanvasElement>('.haze-fluid');
const sporeCanvas = document.querySelector<HTMLCanvasElement>('.haze-spores');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

type RGB = [number, number, number];

const hex = (v: string): RGB => {
  const h = v.trim().replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;
};

function readTheme() {
  const cs = getComputedStyle(document.body);
  const n = (name: string, fallback: number) => {
    const v = parseFloat(cs.getPropertyValue(`--haze-${name}`));
    return Number.isFinite(v) ? v : fallback;
  };
  return {
    palette: [1, 2, 3, 4].map((i) => hex(cs.getPropertyValue(`--haze-${i}`) || '#ffffff')),
    bg: hex(cs.getPropertyValue('--bg') || '#0d0b12'),
    strength: n('strength', 1),
    curl: n('curl', 22), // swirliness
    fade: n('fade', 0.35), // how fast smoke disappears
    radius: n('radius', 0.3), // splat size
    mouseDye: n('mouse-dye', 0.12), // smoke the cursor adds (0 = cursor only pushes)
    mouseForce: n('mouse-force', 3000),
    ambientEvery: n('ambient-every', 2200), // ms between self-made puffs
    ambientDye: n('ambient-dye', 0.5),
    ambientForce: n('ambient-force', 350),
    ambientRadius: n('ambient-radius', 0.3),
    seed: n('seed', 6), // puffs on load
    flashlight: n('flashlight', 0), // 0..1, darkens everything outside a light around the cursor
    sporeCount: n('spore-count', 1),
    sporeGravity: n('spore-gravity', -0.12), // px/frame, negative rises
    sporeSize: n('spore-size', 1),
  };
}

const pointer = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, moved: false, seen: false, cx: -9999, cy: -9999 };
addEventListener('pointermove', (e) => {
  pointer.x = e.clientX / innerWidth;
  pointer.y = 1 - e.clientY / innerHeight;
  if (!pointer.seen) { pointer.seen = true; pointer.px = pointer.x; pointer.py = pointer.y; }
  pointer.cx = e.clientX;
  pointer.cy = e.clientY;
  pointer.moved = true;
});
const forget = () => { pointer.cx = pointer.cy = -9999; };
// Touch: stop repelling spores once the finger lifts. Mouse: once it leaves the window.
addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') forget(); });
addEventListener('pointercancel', forget);
document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) forget(); });

if (fluidCanvas && sporeCanvas) {
  if (reduce) {
    fluidCanvas.remove();
    sporeCanvas.remove();
  } else {
    const theme = readTheme();
    if (!startFluid(fluidCanvas, theme)) fluidCanvas.remove();
    startSpores(sporeCanvas, theme);
  }
}

/* ---------------- Smoke ---------------- */

function startFluid(canvas: HTMLCanvasElement, theme: ReturnType<typeof readTheme>): boolean {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return false;

  const small = innerWidth < 700;
  const SIM_RES = small ? 96 : 128;
  const DYE_RES = small ? 384 : 768;
  const PRESSURE_ITERS = 20;
  const VEL_DISS = 0.35;

  const vs = `#version 300 es
in vec2 aPos;
uniform vec2 texel;
out vec2 vUv, vL, vR, vT, vB;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(texel.x, 0.0); vR = vUv + vec2(texel.x, 0.0);
  vT = vUv + vec2(0.0, texel.y); vB = vUv - vec2(0.0, texel.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;
  const head = `#version 300 es
precision highp float; precision highp sampler2D;
in vec2 vUv, vL, vR, vT, vB; out vec4 o;
`;
  const shaders = {
    splat: `uniform sampler2D uTarget; uniform float aspect, radius; uniform vec3 color; uniform vec2 point;
void main() { vec2 p = vUv - point; p.x *= aspect; o = vec4(texture(uTarget, vUv).rgb + exp(-dot(p, p) / radius) * color, 1.0); }`,
    advect: `uniform sampler2D uVelocity, uSource; uniform vec2 texel; uniform float dt, dissipation;
void main() { vec2 c = vUv - dt * texture(uVelocity, vUv).xy * texel; o = vec4(texture(uSource, c).rgb / (1.0 + dissipation * dt), 1.0); }`,
    divergence: `uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).x, R = texture(uVelocity, vR).x, T = texture(uVelocity, vT).y, B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x; if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
  o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,
    curl: `uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).y, R = texture(uVelocity, vR).y, T = texture(uVelocity, vT).x, B = texture(uVelocity, vB).x;
  o = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`,
    vorticity: `uniform sampler2D uVelocity, uCurl; uniform float curl, dt;
void main() {
  float L = texture(uCurl, vL).x, R = texture(uCurl, vR).x, T = texture(uCurl, vT).x, B = texture(uCurl, vB).x, C = texture(uCurl, vUv).x;
  vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  f = f / (length(f) + 0.0001) * curl * C; f.y *= -1.0;
  o = vec4(clamp(texture(uVelocity, vUv).xy + f * dt, -1000.0, 1000.0), 0.0, 1.0);
}`,
    clear: `uniform sampler2D uTexture; uniform float value;
void main() { o = value * texture(uTexture, vUv); }`,
    pressure: `uniform sampler2D uPressure, uDivergence;
void main() {
  float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x, T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;
  o = vec4((L + R + B + T - texture(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0);
}`,
    gradient: `uniform sampler2D uPressure, uVelocity;
void main() {
  float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x, T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;
  o = vec4(texture(uVelocity, vUv).xy - vec2(R - L, T - B), 0.0, 1.0);
}`,
    display: `uniform sampler2D uTexture; uniform vec3 bg; uniform vec2 light; uniform float flashlight, aspect;
void main() {
  vec3 c = texture(uTexture, vUv).rgb; c = 1.0 - exp(-c * 2.4);
  vec3 col = bg * (1.0 - c) + c;
  float d = length((vUv - light) * vec2(aspect, 1.0));
  float lit = smoothstep(0.42, 0.04, d);
  col *= mix(1.0 - 0.8 * flashlight, 1.0 + 0.25 * flashlight, lit);
  o = vec4(col, 1.0);
}`,
  };

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  };
  const vert = compile(gl.VERTEX_SHADER, vs);
  type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation> };
  const program = (fs: string): Prog => {
    const p = gl.createProgram()!;
    gl.attachShader(p, vert);
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, head + fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
    const u: Prog['u'] = {};
    for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) {
      const name = gl.getActiveUniform(p, i)!.name;
      u[name] = gl.getUniformLocation(p, name)!;
    }
    return { p, u };
  };

  let P: Record<keyof typeof shaders, Prog>;
  try {
    P = Object.fromEntries(Object.entries(shaders).map(([k, s]) => [k, program(s)])) as typeof P;
  } catch {
    return false;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  type FBO = { tex: WebGLTexture; fb: WebGLFramebuffer; w: number; h: number };
  const fbo = (w: number, h: number): FBO => {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fb, w, h };
  };
  const pair = (w: number, h: number) => {
    let a = fbo(w, h), b = fbo(w, h);
    return { get read() { return a; }, get write() { return b; }, swap() { [a, b] = [b, a]; }, w, h };
  };
  const res = (r: number) => {
    const aspect = canvas.width / canvas.height;
    const big = Math.round(r * (aspect < 1 ? 1 / aspect : aspect));
    return aspect >= 1 ? [big, r] : [r, big];
  };

  let vel: ReturnType<typeof pair>, dye: ReturnType<typeof pair>, pressure: ReturnType<typeof pair>, div: FBO, curl: FBO;
  const free = (f: FBO) => { gl.deleteTexture(f.tex); gl.deleteFramebuffer(f.fb); };
  let simW = 0, simH = 0;
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    // Mobile URL bars change the height constantly; only rebuild the sim for real size changes.
    if (simW && innerWidth === simW && Math.abs(innerHeight - simH) < 160) return false;
    simW = innerWidth;
    simH = innerHeight;
    if (vel) [vel.read, vel.write, pressure.read, pressure.write, dye.read, dye.write, div, curl].forEach(free);
    const [sw, sh] = res(SIM_RES);
    const [dw, dh] = res(DYE_RES);
    vel = pair(sw, sh);
    pressure = pair(sw, sh);
    dye = pair(dw, dh);
    div = fbo(sw, sh);
    curl = fbo(sw, sh);
    return true;
  };
  resize();
  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => { if (resize()) seed(4); }, 200);
  });

  // A lost context (e.g. phone tab backgrounded) can't be drawn to again: fall back to the CSS backdrop.
  let alive = true;
  canvas.addEventListener('webglcontextlost', () => { alive = false; canvas.remove(); });

  const use = (prog: Prog, texel: number[]) => {
    gl.useProgram(prog.p);
    if (prog.u.texel) gl.uniform2f(prog.u.texel, texel[0], texel[1]);
    return prog.u;
  };
  const tex = (unit: number, t: WebGLTexture) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    return unit;
  };
  const blit = (target: FBO | null) => {
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
      gl.viewport(0, 0, target.w, target.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  };

  const splat = (x: number, y: number, dx: number, dy: number, c: RGB, size = theme.radius) => {
    const aspect = canvas.width / canvas.height;
    const r = size / 100;
    const u = use(P.splat, [1 / vel.w, 1 / vel.h]);
    gl.uniform1f(u.aspect, aspect);
    gl.uniform2f(u.point, x, y);
    gl.uniform1f(u.radius, aspect > 1 ? r * aspect : r);
    gl.uniform1i(u.uTarget, tex(0, vel.read.tex));
    gl.uniform3f(u.color, dx, dy, 0);
    blit(vel.write);
    vel.swap();
    gl.uniform1i(u.uTarget, tex(0, dye.read.tex));
    gl.uniform3f(u.color, c[0], c[1], c[2]);
    blit(dye.write);
    dye.swap();
  };

  const tint = (i: number, k: number): RGB => {
    const c = theme.palette[i % theme.palette.length];
    return [c[0] * k * theme.strength, c[1] * k * theme.strength, c[2] * k * theme.strength];
  };
  const seed = (n: number) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      splat(Math.random(), Math.random(), Math.cos(a) * theme.ambientForce, Math.sin(a) * theme.ambientForce, tint(i, theme.ambientDye * 1.4), theme.ambientRadius);
    }
  };

  const step = (dt: number) => {
    const t = [1 / vel.w, 1 / vel.h];
    let u = use(P.curl, t);
    gl.uniform1i(u.uVelocity, tex(0, vel.read.tex));
    blit(curl);

    u = use(P.vorticity, t);
    gl.uniform1i(u.uVelocity, tex(0, vel.read.tex));
    gl.uniform1i(u.uCurl, tex(1, curl.tex));
    gl.uniform1f(u.curl, theme.curl);
    gl.uniform1f(u.dt, dt);
    blit(vel.write);
    vel.swap();

    u = use(P.divergence, t);
    gl.uniform1i(u.uVelocity, tex(0, vel.read.tex));
    blit(div);

    u = use(P.clear, t);
    gl.uniform1i(u.uTexture, tex(0, pressure.read.tex));
    gl.uniform1f(u.value, 0.8);
    blit(pressure.write);
    pressure.swap();

    u = use(P.pressure, t);
    gl.uniform1i(u.uDivergence, tex(0, div.tex));
    for (let i = 0; i < PRESSURE_ITERS; i++) {
      gl.uniform1i(u.uPressure, tex(1, pressure.read.tex));
      blit(pressure.write);
      pressure.swap();
    }

    u = use(P.gradient, t);
    gl.uniform1i(u.uPressure, tex(0, pressure.read.tex));
    gl.uniform1i(u.uVelocity, tex(1, vel.read.tex));
    blit(vel.write);
    vel.swap();

    u = use(P.advect, t);
    gl.uniform1f(u.dt, dt);
    gl.uniform1i(u.uVelocity, tex(0, vel.read.tex));
    gl.uniform1i(u.uSource, 0);
    gl.uniform1f(u.dissipation, VEL_DISS);
    blit(vel.write);
    vel.swap();

    gl.uniform1i(u.uVelocity, tex(0, vel.read.tex));
    gl.uniform1i(u.uSource, tex(1, dye.read.tex));
    gl.uniform1f(u.dissipation, theme.fade);
    blit(dye.write);
    dye.swap();

    u = use(P.display, t);
    gl.uniform1i(u.uTexture, tex(0, dye.read.tex));
    gl.uniform3f(u.bg, theme.bg[0], theme.bg[1], theme.bg[2]);
    gl.uniform1f(u.flashlight, theme.flashlight);
    gl.uniform1f(u.aspect, canvas.width / canvas.height);
    gl.uniform2f(u.light, pointer.seen ? pointer.x : 0.5, pointer.seen ? pointer.y : 0.45);
    blit(null);
  };

  seed(theme.seed);
  let last = performance.now();
  let nextAmbient = 0;
  let colorIndex = 0;
  let colorTimer = 0;
  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 1 / 60);
    last = now;
    colorTimer += dt;
    if (colorTimer > 0.7) { colorTimer = 0; colorIndex++; }

    if (pointer.moved) {
      pointer.moved = false;
      const aspect = canvas.width / canvas.height;
      let dx = (pointer.x - pointer.px) * theme.mouseForce;
      let dy = (pointer.y - pointer.py) * theme.mouseForce;
      if (aspect < 1) dx *= aspect; else dy /= aspect;
      if (Math.abs(dx) + Math.abs(dy) > 1) splat(pointer.x, pointer.y, dx, dy, tint(colorIndex, theme.mouseDye));
    }
    pointer.px = pointer.x;
    pointer.py = pointer.y;

    if (now > nextAmbient) {
      nextAmbient = now + theme.ambientEvery * (0.6 + Math.random() * 0.8);
      const a = Math.random() * Math.PI * 2;
      const f = theme.ambientForce;
      splat(Math.random(), Math.random(), Math.cos(a) * f, Math.sin(a) * f, tint(Math.floor(Math.random() * 4), theme.ambientDye), theme.ambientRadius);
    }

    step(dt);
    if (alive) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return true;
}

/* ---------------- Spores ---------------- */

function startSpores(canvas: HTMLCanvasElement, theme: ReturnType<typeof readTheme>) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const colors = theme.palette.map((c) => c.map((v) => Math.round(v * 255)).join(','));
  const count = Math.round((innerWidth < 700 ? 120 : 300) * theme.sporeCount);
  const R = 130;

  const resize = () => {
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);

  const spores = Array.from({ length: count }, () => {
    const bx = (Math.random() - 0.5) * 0.25;
    const by = theme.sporeGravity * (0.4 + Math.random() * 1.2);
    return {
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      vx: bx, vy: by, bx, by,
      r: (0.6 + Math.random() * 1.8) * theme.sporeSize,
      c: colors[Math.floor(Math.random() * colors.length)],
      ph: Math.random() * Math.PI * 2,
    };
  });

  const frame = (now: number) => {
    const t = now / 1000;
    const w = innerWidth, h = innerHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (const s of spores) {
      const dx = s.x - pointer.cx, dy = s.y - pointer.cy;
      const d = Math.hypot(dx, dy);
      if (d < R && d > 0.1) {
        const f = (1 - d / R) * 1.4;
        s.vx += (dx / d) * f;
        s.vy += (dy / d) * f;
      }
      s.vx = s.bx + (s.vx - s.bx) * 0.94 + Math.sin(t * 0.7 + s.ph) * 0.01;
      s.vy = s.by + (s.vy - s.by) * 0.94;
      s.x += s.vx;
      s.y += s.vy;
      if (s.x < -10) s.x = w + 10; else if (s.x > w + 10) s.x = -10;
      if (s.y < -10) s.y = h + 10; else if (s.y > h + 10) s.y = -10;

      const a = 0.45 + 0.4 * Math.sin(t * 1.6 + s.ph);
      ctx.fillStyle = `rgba(${s.c},${a * 0.18})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${s.c},${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
