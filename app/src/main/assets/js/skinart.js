/*
 * Тематические скины. Каждый отрисовщик получает контекст, уже сдвинутый в центр
 * соты, радиус R, цвет из палитры и параметры o (вид v 0..9, возраст, волна, сид).
 * Статичные части кэшируются спрайтами, живое (трава, капли, искры) рисуется каждый кадр.
 */
(() => {
  'use strict';
  const HB = window.HB, K = HB.skins, A = K.art;
  const { hexPath, mix, srng, hash01, sprite, blit, clamp, vert, star4, ramp } = K;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const edgeY = (x, R) => R - .577 * Math.abs(x);   // нижняя кромка соты

  function gloss(c, R, a = .5) {
    c.fillStyle = `rgba(255,255,255,${a})`;
    c.beginPath(); c.ellipse(-R * .3, -R * .5, R * .26, R * .1, -.45, 0, TAU); c.fill();
  }
  /** Тягучая капля, свисающая с нижней кромки: растёт, отрывается и падает. */
  function drip(c, x, R, len, t, seed, color, glow) {
    const y0 = edgeY(x, R) - R * .06, ph = (t * .16 + seed * .37 + x * .01) % 1;
    const grow = ph < .8 ? .35 + .65 * (ph / .8) : 1 - (ph - .8) / .2 * .55;
    const L = len * grow, w = R * .1, br = R * (.075 + .05 * Math.min(1, ph / .8));
    if (glow) c.globalCompositeOperation = 'lighter';
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x - w, y0);
    c.quadraticCurveTo(x - w * .25, y0 + L * .55, x - br * .6, y0 + L);
    c.lineTo(x + br * .6, y0 + L);
    c.quadraticCurveTo(x + w * .25, y0 + L * .55, x + w, y0);
    c.closePath(); c.fill();
    c.beginPath(); c.arc(x, y0 + L, br, 0, TAU); c.fill();
    if (ph > .8) {
      const f = (ph - .8) / .2;
      c.globalAlpha *= 1 - f;
      c.beginPath(); c.ellipse(x, y0 + L + br + f * R * 1.3, br * .9, br * (1.1 + f * .4), 0, 0, TAU); c.fill();
      c.globalAlpha /= Math.max(.001, 1 - f);
    }
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = 'rgba(255,255,255,.55)';
    c.beginPath(); c.ellipse(x - br * .35, y0 + L - br * .3, br * .3, br * .2, -.5, 0, TAU); c.fill();
  }

  /* ================= ЛЕС ================= */
  const FL = ['#E63946', '#FFD23F', '#B388EB', '#FF8C42', '#3A86FF'];
  function blade(c, x, y, h, lean, w, col) {
    c.beginPath(); c.moveTo(x - w / 2, y);
    c.quadraticCurveTo(x + lean * h * .4, y - h * .55, x + lean * h, y - h);
    c.quadraticCurveTo(x + lean * h * .4 + w * .15, y - h * .5, x + w / 2, y);
    c.closePath(); c.fillStyle = col; c.fill();
  }
  function flower(c, x, y, r, col, rot) {
    for (let i = 0; i < 5; i++) {
      const a = rot + i * TAU / 5;
      c.beginPath(); c.ellipse(x + Math.cos(a) * r * .85, y + Math.sin(a) * r * .85, r * .72, r * .46, a, 0, TAU);
      c.fillStyle = col; c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,.35)';
    c.beginPath(); c.ellipse(x + Math.cos(rot) * r * .9, y + Math.sin(rot) * r * .9 - r * .1, r * .3, r * .15, rot, 0, TAU); c.fill();
    c.beginPath(); c.arc(x, y, r * .5, 0, TAU); c.fillStyle = col === FL[1] ? '#8B4A1C' : '#FFE9A8'; c.fill();
  }
  A.forest = {
    empty(c, R) {
      blit(c, sprite('fe', R, (g, R) => {
        hexPath(g, 0, 0, R * .93); g.fillStyle = '#2B2218'; g.fill(); g.save(); g.clip();
        const rn = srng(5);
        for (let i = 0; i < 14; i++) { g.fillStyle = rn() < .5 ? 'rgba(90,65,40,.5)' : 'rgba(15,10,5,.4)'; g.beginPath(); g.arc((rn() - .5) * 1.8 * R, (rn() - .5) * 1.8 * R, R * (.03 + rn() * .05), 0, TAU); g.fill(); }
        g.restore();
      }), R);
    },
    tile(c, R, color, o) {
      blit(c, sprite('fb' + color + o.v, R, (g, R) => {
        hexPath(g, 0, 0, R); const gr = g.createLinearGradient(0, -R, 0, R);
        gr.addColorStop(0, mix(color, 'w', .2)); gr.addColorStop(1, mix(color, 'k', .28));
        g.fillStyle = gr; g.fill(); g.save(); g.clip();
        const rn = srng(o.v * 31 + 7);
        for (let i = 0; i < 20; i++) {
          g.fillStyle = rn() < .55 ? 'rgba(20,60,10,.2)' : 'rgba(255,255,210,.13)';
          g.beginPath(); g.ellipse((rn() - .5) * 1.8 * R, (rn() - .5) * 1.8 * R, R * .07, R * .025, rn() * 3, 0, TAU); g.fill();
        }
        g.fillStyle = 'rgba(70,40,15,.45)'; g.fillRect(-R, R * .66, 2 * R, R);
        g.restore();
      }), R);
      const t = o.t, a = o.age;
      const sw = Math.sin(t * 1.6 + o.seed) * .07 + o.rip * 7 + (o.board && a < 1.6 ? .45 * Math.exp(-3.2 * a) * Math.sin(a * 15) : 0);
      const G = R * .64, v = o.v;
      const tufts = xs => xs.forEach(([x, h], i) => {
        for (let j = -1; j <= 1; j++) blade(c, x * R + j * R * .07, G, h * R * (1 - Math.abs(j) * .22), sw * (1.1 - i * .1) + j * .28, R * .1, j ? '#5FAE42' : '#86D05C');
      });
      if (v === 0) tufts([[-.45, .5], [-.08, .62], [.32, .55], [.6, .36]]);
      else if (v === 1) {
        c.save(); c.translate(0, G); c.rotate(sw * .45);
        [[-.3, -.25, .27], [.27, -.27, .29], [0, -.5, .31], [-.02, -.2, .3]].forEach(([x, y, r]) => { c.fillStyle = '#2E7A2C'; c.beginPath(); c.arc(x * R, y * R, r * R, 0, TAU); c.fill(); });
        [[-.36, -.35, .12], [.2, -.38, .13], [-.06, -.62, .14]].forEach(([x, y, r]) => { c.fillStyle = '#4FA646'; c.beginPath(); c.arc(x * R, y * R, r * R, 0, TAU); c.fill(); });
        if (o.seed % 2) [[.1, -.18], [-.25, -.12], [.32, -.2]].forEach(([x, y]) => { c.fillStyle = '#D7263D'; c.beginPath(); c.arc(x * R, y * R, R * .055, 0, TAU); c.fill(); });
        c.restore();
      } else if (v >= 2 && v <= 6) {
        tufts([[-.55, .3], [.52, .28]]);
        const hx = sw * R * .95, hy = -R * .12;
        c.strokeStyle = '#3F8F3A'; c.lineWidth = R * .075; c.lineCap = 'round';
        c.beginPath(); c.moveTo(0, G); c.quadraticCurveTo(sw * R * .25, R * .2, hx, hy); c.stroke();
        c.fillStyle = '#4FA646';
        c.beginPath(); c.ellipse(sw * R * .2 + R * .13, R * .32, R * .15, R * .06, -.6, 0, TAU); c.fill();
        c.beginPath(); c.ellipse(sw * R * .15 - R * .12, R * .42, R * .13, R * .05, .6, 0, TAU); c.fill();
        flower(c, hx, hy, R * .2, FL[v - 2], t * .15 + o.seed);
      } else if (v === 7) {
        for (let i = -2; i <= 2; i++) blade(c, i * R * .09, G, R * (1.05 - Math.abs(i) * .13), sw * 1.25 + i * .3, R * .1, i % 2 ? '#5DAE45' : '#7CC85A');
      } else if (v === 8) {
        tufts([[-.5, .32], [.55, .3]]);
        c.save(); c.translate(R * .05, G); c.rotate(sw * .35);
        c.fillStyle = '#F3E9D2'; c.fillRect(-R * .09, -R * .42, R * .18, R * .42);
        c.beginPath(); c.ellipse(0, -R * .4, R * .34, R * .26, 0, Math.PI, 0); c.fillStyle = '#D7263D'; c.fill();
        c.fillStyle = '#FFF'; [[-.15, -.5, .06], [.1, -.56, .05], [.2, -.45, .04]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x * R, y * R, r * R, 0, TAU); c.fill(); });
        c.restore();
      } else {
        tufts([[-.1, .35], [.45, .3]]);
        [[-.4, .38], [-.26, .42], [-.33, .28]].forEach(([x, y]) => { c.fillStyle = '#3E9A3A'; c.beginPath(); c.arc(x * R + sw * R * .1, y * R, R * .1, 0, TAU); c.fill(); });
        const c1 = FL[o.seed % 5], c2 = FL[(o.seed + 2) % 5];
        c.strokeStyle = '#3F8F3A'; c.lineWidth = R * .05;
        c.beginPath(); c.moveTo(R * .2, G); c.lineTo(R * .2 + sw * R * .5, R * .05); c.stroke();
        c.beginPath(); c.moveTo(R * .45, G); c.lineTo(R * .42 + sw * R * .4, R * .25); c.stroke();
        flower(c, R * .2 + sw * R * .5, R * .05, R * .12, c1, t * .2);
        flower(c, R * .42 + sw * R * .4, R * .25, R * .1, c2, -t * .2);
      }
    },
    breakFx(api, x, y, color, v) {
      for (let i = 0; i < 5; i++) api.push({ k: 'leaf', x, y, vx: rnd(-90, 90), vy: rnd(-230, -90), g: 240, t: 0, life: rnd(1.1, 1.7), color: pick(['#4FA646', '#6FBF4A', '#2E7A2C', '#86D05C']), r: rnd(4, 7), rot: rnd(0, TAU), vr: rnd(-6, 6) });
      if (v >= 2 && v <= 6) for (let i = 0; i < 6; i++) api.push({ k: 'leaf', x, y, vx: rnd(-110, 110), vy: rnd(-260, -100), g: 180, t: 0, life: rnd(1.2, 1.8), color: FL[v - 2], r: rnd(3, 4.5), rot: rnd(0, TAU), vr: rnd(-8, 8) });
      for (let i = 0; i < 4; i++) api.push({ k: 'crumb', x, y, vx: rnd(-80, 80), vy: rnd(-150, -40), g: 700, t: 0, life: .6, color: '#5A3D22', r: rnd(2, 3.5), rot: rnd(0, TAU), vr: rnd(-8, 8) });
      return true;
    }
  };

  /* ================= МЁД ================= */
  const HONEY_DRIPS = { 0: [[.38, .35]], 4: [[.1, 1.05]], 5: [[-.25, .55]], 7: [[-.08, .5]], 9: [[-.3, .7], [.28, .95]] };
  A.honey = {
    tile(c, R, color, o) {
      const a = o.board ? o.age : 99, t = o.t;
      const j = a < 3.5 ? .14 * Math.exp(-2 * a) * Math.sin(a * 7) : 0;
      c.save();
      c.translate(0, R); c.scale(1 + j, 1 - j); c.translate(0, -R);
      blit(c, sprite('hb' + color + o.v, R, (g, R) => {
        hexPath(g, 0, 0, R); g.fillStyle = '#A8650F'; g.fill();
        hexPath(g, 0, 0, R * .96); g.lineWidth = R * .08; g.strokeStyle = '#E3A53C'; g.stroke();
        const v = o.v, cap = v === 1 || v === 8, half = v === 2 || v === 8;
        hexPath(g, 0, 0, R * .8); g.save(); g.clip();
        if (half) { g.fillStyle = '#5C3508'; g.fillRect(-R, -R, 2 * R, 2 * R); }
        const hg = g.createRadialGradient(-R * .2, -R * .25, R * .05, 0, 0, R);
        hg.addColorStop(0, mix(color, 'w', .55)); hg.addColorStop(.5, color); hg.addColorStop(1, mix(color, 'k', .35));
        g.fillStyle = hg;
        if (half) { g.beginPath(); g.moveTo(-R, R * .05); g.quadraticCurveTo(0, -R * .08, R, R * .05); g.lineTo(R, R); g.lineTo(-R, R); g.fill(); }
        else g.fillRect(-R, -R, 2 * R, 2 * R);
        if (cap) {
          g.fillStyle = '#F4D88A';
          if (v === 8) { g.beginPath(); g.rect(-R, -R, 2 * R, R * .95); g.fill(); } else g.fillRect(-R, -R, 2 * R, 2 * R);
          g.strokeStyle = 'rgba(160,110,30,.35)'; g.lineWidth = R * .03;
          for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) { hexPath(g, x * R * .36 + (y % 2) * R * .18, y * R * .32 - (v === 8 ? R * .35 : 0), R * .18); g.stroke(); }
          g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-R, -R, 2 * R, R * .3);
        }
        if (v === 3) {
          g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = R * .03;
          [[-.2, .2, .09], [.18, -.05, .06], [.05, .35, .05]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x * R, y * R, r * R, 0, TAU); g.stroke(); });
        }
        if (v === 7) { g.strokeStyle = 'rgba(255,245,200,.4)'; g.lineWidth = R * .05; g.beginPath(); g.arc(0, 0, R * .35, .5, 4.2); g.stroke(); g.beginPath(); g.arc(0, 0, R * .18, 3, 6.5); g.stroke(); }
        g.restore();
        if (!cap || v === 8) gloss(g, R, .5);
      }), R);
      const shine = Math.sin(t * .7 + o.seed) * R * .25;
      c.fillStyle = 'rgba(255,250,220,.35)';
      c.beginPath(); c.ellipse(shine, -R * .52, R * .16, R * .05, 0, 0, TAU); c.fill();
      (HONEY_DRIPS[o.v] || []).forEach(([x, L], i) => drip(c, x * R, R, L * R, t, o.seed + i, mix(color, 'k', .08), false));
      c.restore();
      if (o.v === 6) {
        const bx = R * (.3 + Math.sin(t * 2.6 + o.seed) * .12), by = -R * (.35 + Math.cos(t * 3.4) * .08);
        const flap = .45 + .55 * Math.abs(Math.sin(t * 38));
        c.fillStyle = 'rgba(255,255,255,.7)';
        c.beginPath(); c.ellipse(bx - R * .05, by - R * .12, R * .09, R * .12 * flap, -.4, 0, TAU); c.fill();
        c.beginPath(); c.ellipse(bx + R * .07, by - R * .12, R * .08, R * .11 * flap, .4, 0, TAU); c.fill();
        c.fillStyle = '#FFCD1F'; c.beginPath(); c.ellipse(bx, by, R * .15, R * .1, 0, 0, TAU); c.fill();
        c.fillStyle = '#2A1A0A'; c.fillRect(bx - R * .04, by - R * .1, R * .05, R * .2); c.fillRect(bx + R * .06, by - R * .09, R * .04, R * .18);
        c.beginPath(); c.arc(bx - R * .15, by, R * .04, 0, TAU); c.fill();
      }
    },
    breakFx(api, x, y, color) {
      for (let i = 0; i < 6; i++) api.push({ k: 'drop', x, y, vx: rnd(-110, 110), vy: rnd(-260, -60), g: 520, t: 0, life: rnd(.9, 1.4), color: mix(color, 'k', .05), r: rnd(4, 7) });
      api.push({ k: 'blob', x, y, vx: rnd(-30, 30), vy: -60, g: 380, t: 0, life: 1.2, color, r: 7 });
      api.splat(x, y, color, 3.5);
      return true;
    }
  };

  /* ================= ШОКОЛАД ================= */
  A.choco = {
    tile(c, R, color, o) {
      const m = o.board ? clamp((o.age - 2.5) / 30) : 0, t = o.t;
      c.save();
      c.translate(0, m * R * .07); c.scale(1 + m * .03, 1 + m * .05);
      blit(c, sprite('cb' + color + o.v, R, (g, R) => {
        const v = o.v, dark = mix(color, 'k', .32), milk = mix(color, 'w', .38);
        hexPath(g, 0, 0, R); g.fillStyle = dark; g.fill();
        for (let i = 0; i < 6; i++) {
          const [x0, y0] = vert(i, R), [x1, y1] = vert(i + 1, R), [x2, y2] = vert(i + 1, R * .76), [x3, y3] = vert(i, R * .76);
          g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.closePath();
          g.fillStyle = ['rgba(255,255,255,.14)', 'rgba(0,0,0,.05)', 'rgba(0,0,0,.2)', 'rgba(0,0,0,.26)', 'rgba(0,0,0,.08)', 'rgba(255,255,255,.2)'][i]; g.fill();
        }
        hexPath(g, 0, 0, R * .76);
        const gr = g.createLinearGradient(0, -R, 0, R); gr.addColorStop(0, mix(color, 'w', .16)); gr.addColorStop(1, mix(color, 'k', .12));
        g.fillStyle = gr; g.fill(); g.save(); g.clip();
        const rn = srng(v * 17 + 3);
        if (v === 1) { g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = R * .05; for (let i = 0; i < 3; i++) { g.save(); g.rotate(i * Math.PI / 3); g.beginPath(); g.moveTo(-R, 0); g.lineTo(R, 0); g.stroke(); g.restore(); } }
        if (v === 2) { g.strokeStyle = '#F5E6D3'; g.lineWidth = R * .07; g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i <= 8; i++) { const x = -R * .8 + i * R * .2, y = (i % 2 ? -.25 : .25) * R + (i - 4) * R * .04; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
        if (v === 3) [[-.25, -.15], [.2, .05], [-.05, .32]].forEach(([x, y]) => { g.fillStyle = '#C58F52'; g.beginPath(); g.ellipse(x * R, y * R, R * .15, R * .11, rn() * 3, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(x * R - R * .04, y * R - R * .03, R * .06, R * .03, 0, 0, TAU); g.fill(); });
        if (v === 4) for (let i = 0; i < 16; i++) { g.save(); g.translate((rn() - .5) * 1.3 * R, (rn() - .5) * 1.3 * R); g.rotate(rn() * 3); g.fillStyle = pick(['#FF5C8A', '#FFD23F', '#4ADE9C', '#4CC9F0', '#FFFFFF']); g.fillRect(-R * .07, -R * .02, R * .14, R * .04); g.restore(); }
        if (v === 5) { const cg = g.createRadialGradient(-R * .08, -R * .08, 0, 0, 0, R * .35); cg.addColorStop(0, '#FFD27A'); cg.addColorStop(1, '#C97A1E'); g.fillStyle = cg; g.beginPath(); g.ellipse(0, R * .05, R * .34, R * .28, 0, 0, TAU); g.fill(); }
        if (v === 6) for (let i = 0; i < 50; i++) { g.fillStyle = 'rgba(40,20,10,.35)'; g.fillRect((rn() - .5) * 1.5 * R, (rn() - .5) * 1.5 * R, R * .03, R * .03); }
        if (v === 7) { g.save(); g.scale(R * .03, R * .03); const hp = () => { g.beginPath(); g.moveTo(0, 8); g.bezierCurveTo(-14, -2, -8, -12, 0, -5); g.bezierCurveTo(8, -12, 14, -2, 0, 8); }; g.translate(.5, .5); hp(); g.fillStyle = 'rgba(255,255,255,.15)'; g.fill(); g.translate(-1, -1); hp(); g.fillStyle = 'rgba(0,0,0,.28)'; g.fill(); g.restore(); }
        if (v === 9) { g.fillStyle = milk; g.beginPath(); g.moveTo(-R, R * .4); g.lineTo(R, -R * .3); g.lineTo(R, R); g.lineTo(-R, R); g.fill(); }
        g.restore();
        if (v === 8) {
          g.globalCompositeOperation = 'destination-out';
          [[.55, -.5, .32], [.3, -.7, .22], [.78, -.2, .2]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x * R, y * R, r * R, 0, TAU); g.fill(); });
          g.globalCompositeOperation = 'source-atop';
          g.strokeStyle = mix(color, 'w', .25); g.lineWidth = R * .07;
          [[.55, -.5, .32], [.3, -.7, .22], [.78, -.2, .2]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x * R, y * R, r * R + R * .02, 0, TAU); g.stroke(); });
          g.globalCompositeOperation = 'source-over';
        }
        gloss(g, R, .22);
      }), R);
      c.restore();
      if (m > .02) {
        const rn = srng(o.seed * 3 + 1), n = 2 + (o.seed % 2), dc = mix(color, 'k', .1);
        c.fillStyle = `rgba(255,255,255,${.08 + .22 * m})`;
        c.beginPath(); c.ellipse(-R * .1, -R * .45 + m * R * .1, R * (.3 + m * .2), R * .08, -.2, 0, TAU); c.fill();
        for (let i = 0; i < n; i++) {
          const xf = (rn() - .5) * 1.1, L = (.25 + rn() * .55) * R * m * (1 + .06 * Math.sin(t * .8 + i));
          const x = xf * R, y0 = edgeY(x, R) + m * R * .06 - R * .08, w = R * .1;
          c.fillStyle = dc;
          c.beginPath(); c.moveTo(x - w, y0); c.quadraticCurveTo(x - w * .3, y0 + L * .6, x - w * .55, y0 + L); c.arc(x, y0 + L, w * .55, Math.PI, 0, true); c.quadraticCurveTo(x + w * .3, y0 + L * .6, x + w, y0); c.closePath(); c.fill();
          c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(x - w * .45, y0 + L * .2, w * .22, L * .6);
        }
      }
    },
    breakFx(api, x, y, color) {
      for (let i = 0; i < 9; i++) api.push({ k: 'crumb', x, y, vx: rnd(-150, 150), vy: rnd(-260, -60), g: 800, t: 0, life: rnd(.6, 1), color: pick([color, mix(color, 'k', .3), mix(color, 'w', .3)]), r: rnd(2.5, 5), rot: rnd(0, TAU), vr: rnd(-12, 12) });
      for (let i = 0; i < 6; i++) api.push({ k: 'spark', x, y, vx: rnd(-60, 60), vy: rnd(-80, 20), g: 60, t: 0, life: rnd(.6, 1), color: 'rgba(90,50,25,.6)', r: rnd(1.5, 3) });
      api.splat(x, y, color, 2.5);
      return true;
    }
  };

  /* ================= РЕТРО 8-БИТ ================= */
  const ICONS = [
    ['.ww.ww.', 'wwwwwww', 'wwwwwww', '.wwwww.', '..www..', '...w...', '.......'],
    ['...w...', '..www..', 'wwwwwww', '.wwwww.', '..www..', '.ww.ww.', 'w.....w'],
    ['..kkk..', '.kyyyk.', 'kyykyyk', 'kyykyyk', 'kyykyyk', '.kyyyk.', '..kkk..'],
    ['..www..', '.wkwkw.', 'wwwwwww', '..kwk..', '..www..', '..www..', '.......'],
    ['..www..', '.wwwww.', 'wkwwkww', 'wwwwwww', 'wwwwwww', 'wwwwwww', 'w.w.w.w'],
    ['......w', '.....w.', '....w..', 'k..w...', '.kw....', '.kk....', 'k..k...'],
    ['.www...', 'w...w..', 'w...w..', '.www...', '..w....', '..ww...', '..w....'],
    ['.wwwww.', 'wwkwkww', '.wwwww.', '..www..', '...w...', '.......', '.......'],
    ['..w.w..', '.wwwww.', 'ww.w.ww', 'wwwwwww', 'w.www.w', 'w.....w', '.ww.ww.'],
    ['...w...', '..www..', '.wwwww.', '...w...', '...w...', '...w...', '.......']
  ];
  A.retro = {
    tile(c, R, color, o) {
      if (o.board && o.age < .56 && Math.floor(o.age / .08) % 2 === 1) return;
      c.imageSmoothingEnabled = false;
      blit(c, sprite('rb' + color + o.v, R, (g, R) => {
        const p = R / 4.2, n = Math.ceil(R / p) + 1, light = mix(color, 'w', .38), dark = mix(color, 'k', .32);
        for (let iy = -n; iy < n; iy++) for (let ix = -n; ix < n; ix++) {
          const x = ix * p, y = iy * p, cx = x + p / 2, cy = y + p / 2;
          if (!K.inHex(cx, cy, R * .98)) continue;
          const up = !K.inHex(cx, cy - p, R * .98) || !K.inHex(cx - p, cy, R * .98);
          const dn = !K.inHex(cx, cy + p, R * .98) || !K.inHex(cx + p, cy, R * .98);
          g.fillStyle = up ? light : dn ? dark : color;
          g.fillRect(x, y, p + .4, p + .4);
        }
        const ip = R * .165, icon = ICONS[o.v];
        icon.forEach((row, r) => [...row].forEach((ch, k) => {
          if (ch === '.') return;
          g.fillStyle = ch === 'w' ? 'rgba(255,255,255,.92)' : ch === 'y' ? '#FFE066' : mix(color, 'k', .55);
          g.fillRect(-3.5 * ip + k * ip, -3.5 * ip + r * ip, ip + .3, ip + .3);
        }));
      }), R);
    },
    breakFx(api, x, y, color) {
      for (let i = 0; i < 12; i++) api.push({ k: 'pixel', x, y, vx: rnd(-170, 170), vy: rnd(-300, -60), g: 800, t: 0, life: rnd(.5, .9), color: i % 3 ? color : '#FFFFFF', r: pick([3, 4, 5]) });
      return true;
    }
  };

  /* ================= НЕОН ================= */
  function neonPower(o, t) {
    if (o.board && o.age < .65) { const f = Math.floor(o.age * 26); return hash01(f * 13 + o.seed) > (o.age < .35 ? .55 : .22) ? 1 : .06; }
    const ph = (t * .085 + (o.seed * .618) % 1) % 1;
    if (ph < .028) return Math.sin(t * 90 + o.seed * 7) > -.1 ? 1 : .06;
    if (ph > .5 && ph < .515) return .5;
    return .92 + .08 * Math.sin(t * 50 + o.seed);
  }
  function neonStroke(c, build, color, p, w) {
    c.lineJoin = 'round'; c.lineCap = 'round';
    const ga = c.globalAlpha;
    build(); c.strokeStyle = color;
    if (p < .2) { c.globalAlpha = ga * .28; c.lineWidth = w; c.stroke(); c.globalAlpha = ga; return; }
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = ga * .1 * p; c.lineWidth = w * 5.5; c.stroke();
    c.globalAlpha = ga * .22 * p; c.lineWidth = w * 2.8; c.stroke();
    c.globalAlpha = ga * .95 * p; c.lineWidth = w; c.stroke();
    c.strokeStyle = '#FFFFFF'; c.globalAlpha = ga * .8 * p; c.lineWidth = w * .35; c.stroke();
    c.globalAlpha = ga; c.globalCompositeOperation = 'source-over';
  }
  const NEON_SYM = [
    (c, s) => { c.beginPath(); c.arc(0, 0, s, 0, TAU); },
    (c, s) => { c.beginPath(); c.moveTo(0, -s); c.lineTo(s * .9, s * .6); c.lineTo(-s * .9, s * .6); c.closePath(); },
    (c, s) => { c.beginPath(); c.moveTo(s * .3, -s); c.lineTo(-s * .35, s * .1); c.lineTo(s * .2, s * .1); c.lineTo(-s * .3, s); },
    (c, s) => { c.beginPath(); c.moveTo(0, s * .8); c.bezierCurveTo(-s * 1.3, -s * .1, -s * .6, -s * 1.1, 0, -s * .4); c.bezierCurveTo(s * .6, -s * 1.1, s * 1.3, -s * .1, 0, s * .8); },
    (c, s) => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * .45 : s; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); },
    (c, s) => hexPath(c, 0, 0, s, Math.PI / 6),
    (c, s) => { c.beginPath(); c.moveTo(-s, 0); c.lineTo(s, 0); c.moveTo(0, -s); c.lineTo(0, s); },
    (c, s) => { c.beginPath(); for (let i = 0; i <= 16; i++) { const x = -s + i * s / 8, y = Math.sin(i / 16 * TAU * 1.5) * s * .45; i ? c.lineTo(x, y) : c.moveTo(x, y); } },
    (c, s) => { c.beginPath(); c.moveTo(0, -s); c.lineTo(s * .75, 0); c.lineTo(0, s); c.lineTo(-s * .75, 0); c.closePath(); },
    (c, s) => { c.beginPath(); c.arc(0, 0, s, 0, TAU); c.moveTo(s * .25, 0); c.arc(0, 0, s * .25, 0, TAU); }
  ];
  A.neon = {
    empty(c, R) {
      hexPath(c, 0, 0, R * .93); c.fillStyle = '#120F26'; c.fill();
      c.lineWidth = 1; c.strokeStyle = 'rgba(120,100,255,.1)'; c.stroke();
    },
    tile(c, R, color, o) {
      const p = neonPower(o, o.t);
      hexPath(c, 0, 0, R * .94); c.fillStyle = 'rgba(8,5,22,.94)'; c.fill();
      if (p > .2) { hexPath(c, 0, 0, R * .8); c.fillStyle = color; c.globalAlpha *= .09 * p; c.fill(); c.globalAlpha /= (.09 * p); }
      neonStroke(c, () => hexPath(c, 0, 0, R * .78), color, p, R * .1);
      const sp = neonPower({ board: o.board, age: o.age + .17, seed: o.seed + 5 }, o.t + .3);
      neonStroke(c, () => NEON_SYM[o.v](c, R * .32), color, Math.min(p, sp), R * .075);
    },
    breakFx(api, x, y, color) {
      for (let i = 0; i < 6; i++) api.push({ k: 'bolt', x, y, vx: rnd(-160, 160), vy: rnd(-160, 160), g: 0, t: 0, life: rnd(.25, .45), color, r: rnd(9, 16) });
      for (let i = 0; i < 7; i++) api.push({ k: 'glass', x, y, vx: rnd(-180, 180), vy: rnd(-260, -40), g: 750, t: 0, life: rnd(.5, .9), color: 'rgba(210,225,255,.85)', r: rnd(3, 7), rot: rnd(0, TAU), vr: rnd(-14, 14) });
      for (let i = 0; i < 6; i++) api.push({ k: 'ember', x, y, vx: rnd(-220, 220), vy: rnd(-220, 120), g: 300, t: 0, life: rnd(.2, .45), color: '#FFFFFF', r: rnd(1.2, 2.2) });
      return true;
    }
  };

  /* ================= ОКЕАН ================= */
  A.ocean = {
    empty(c, R) {
      hexPath(c, 0, 0, R * .93); c.fillStyle = '#0B3350'; c.fill();
      c.lineWidth = 1; c.strokeStyle = 'rgba(140,220,255,.1)'; c.stroke();
    },
    tile(c, R, color, o) {
      const t = o.t, h = K.waveAt(o.wx, o.wy);
      c.translate(0, -h * 2.6);
      if (h) c.scale(1 + h * .025, 1 + h * .025);
      blit(c, sprite('ob' + color, R, (g, R) => {
        hexPath(g, 0, 0, R);
        const gr = g.createLinearGradient(0, -R, 0, R);
        gr.addColorStop(0, mix(color, 'w', .32)); gr.addColorStop(.55, color); gr.addColorStop(1, mix(color, 'k', .38));
        g.fillStyle = gr; g.fill();
        hexPath(g, 0, 0, R * .94); g.lineWidth = R * .06; g.strokeStyle = 'rgba(255,255,255,.35)'; g.stroke();
      }), R);
      c.save(); hexPath(c, 0, 0, R * .96); c.clip();
      const v = o.v, sf = (o.seed * .618) % 1;
      if (v === 1) { c.save(); c.translate(R * .22, R * .5); c.fillStyle = '#F9D5C0'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R * .3, Math.PI * 1.1, Math.PI * 1.9); c.closePath(); c.fill(); c.strokeStyle = 'rgba(180,120,100,.6)'; c.lineWidth = R * .025; for (let i = 0; i < 5; i++) { const a = Math.PI * (1.15 + i * .17); c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * R * .28, Math.sin(a) * R * .28); c.stroke(); } c.restore(); }
      if (v === 2) { c.save(); c.translate(-R * .2, R * .42); c.rotate(.3); c.fillStyle = '#FF8A5B'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * .1 : R * .27; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.fillStyle = '#FFD0B5'; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; c.beginPath(); c.arc(Math.cos(a) * R * .13, Math.sin(a) * R * .13, R * .025, 0, TAU); c.fill(); } c.restore(); }
      if (v === 3) { const fx = ((t * .22 + sf) % 1) * 2.8 * R - 1.4 * R, fy = -R * .1 + Math.sin(t * 2 + o.seed) * R * .08; c.fillStyle = '#FFB703'; c.beginPath(); c.ellipse(fx, fy, R * .22, R * .11, 0, 0, TAU); c.fill(); c.beginPath(); c.moveTo(fx - R * .18, fy); c.lineTo(fx - R * .36, fy - R * .12); c.lineTo(fx - R * .36, fy + R * .12); c.closePath(); c.fill(); c.fillStyle = '#1B1B1B'; c.beginPath(); c.arc(fx + R * .12, fy - R * .02, R * .03, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(fx - R * .02, fy - R * .1, R * .04, R * .2); }
      if (v === 4 || v === 0) { const n = v === 4 ? 4 : 1; c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = R * .025; for (let i = 0; i < n; i++) { const ph = (t * .32 + i / n + sf) % 1; const bx = (i - 1.5) * R * .22 + Math.sin(t * 3 + i) * R * .05, by = R * .75 - ph * 1.7 * R, r = R * (.04 + i % 2 * .03); c.globalAlpha *= 1 - ph * .6; c.beginPath(); c.arc(bx, by, r, 0, TAU); c.stroke(); c.globalAlpha /= (1 - ph * .6); } }
      if (v === 5) { c.strokeStyle = '#2A9D8F'; c.lineWidth = R * .1; c.lineCap = 'round'; for (let s = 0; s < 2; s++) { c.beginPath(); for (let i = 0; i <= 8; i++) { const y = R * .9 - i * R * .16, x = (s ? .25 : -.2) * R + Math.sin(t * 1.4 + i * .6 + s) * R * .1 * (i / 8) + o.rip * R * 3 * (i / 8); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); } }
      if (v === 6) { c.fillStyle = '#B9A2DB'; c.beginPath(); c.ellipse(0, R * .45, R * .38, R * .2, 0, Math.PI, 0); c.fill(); const pg = c.createRadialGradient(-R * .05, R * .22, 0, 0, R * .27, R * .14); pg.addColorStop(0, '#FFFFFF'); pg.addColorStop(1, '#D8D0E8'); c.fillStyle = pg; c.beginPath(); c.arc(0, R * .27, R * .13, 0, TAU); c.fill(); const gl = Math.max(0, Math.sin(t * 1.7 + o.seed) - .85) * 6; if (gl > 0) { c.fillStyle = `rgba(255,255,255,${gl})`; star4(c, -R * .05, R * .2, R * .15 * gl); c.fill(); } }
      if (v === 7) { c.strokeStyle = '#FF6F91'; c.lineWidth = R * .08; c.lineCap = 'round'; const br = (x, y, a, l, d) => { if (d > 3) return; const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); br(x2, y2, a - .45, l * .7, d + 1); br(x2, y2, a + .5, l * .65, d + 1); }; br(0, R * .9, -Math.PI / 2 + Math.sin(t) * .05, R * .35, 0); }
      if (v === 8) { c.fillStyle = '#E9C98B'; c.beginPath(); c.moveTo(-R, R * .45); for (let i = 0; i <= 10; i++) c.lineTo(-R + i * R * .2, R * .42 + Math.sin(i * 1.3) * R * .04); c.lineTo(R, R); c.lineTo(-R, R); c.fill(); c.strokeStyle = 'rgba(160,120,60,.5)'; c.lineWidth = R * .03; for (let k = 0; k < 2; k++) { c.beginPath(); for (let i = 0; i <= 10; i++) c.lineTo(-R + i * R * .2, R * (.6 + k * .15) + Math.sin(i * 1.3 + k) * R * .03); c.stroke(); } c.fillStyle = '#8D99AE'; c.beginPath(); c.ellipse(R * .3, R * .55, R * .12, R * .08, 0, 0, TAU); c.fill(); }
      if (v === 9) { const jy = -R * .12 + Math.sin(t * 1.8 + o.seed) * R * .1; c.fillStyle = 'rgba(255,170,220,.65)'; c.beginPath(); c.ellipse(0, jy, R * .26, R * .2, 0, Math.PI, 0); c.fill(); c.strokeStyle = 'rgba(255,190,230,.7)'; c.lineWidth = R * .03; for (let i = 0; i < 4; i++) { c.beginPath(); const x0 = -R * .18 + i * R * .12; c.moveTo(x0, jy); for (let k = 1; k <= 5; k++) c.lineTo(x0 + Math.sin(t * 3 + k + i) * R * .04, jy + k * R * .08); c.stroke(); } }
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = R * .06;
      for (let j = 0; j < 3; j++) {
        c.beginPath();
        for (let i = 0; i <= 10; i++) { const x = -R + i * R * .2, y = -R * .55 + j * R * .48 + Math.sin(x / R * 2.4 + t * 1.8 + j * 1.7 + o.seed) * R * .09; i ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.stroke();
      }
      c.globalCompositeOperation = 'source-over';
      if (h > 0) { c.fillStyle = `rgba(255,255,255,${h * .2})`; c.fillRect(-R, -R, 2 * R, 2 * R); }
      else if (h < 0) { c.fillStyle = `rgba(0,30,60,${-h * .18})`; c.fillRect(-R, -R, 2 * R, 2 * R); }
      c.restore();
      gloss(c, R, .4);
    },
    place(points, group, center) { if (group && group.length) K.addWave(center.x, center.y, 1, group); },
    over(c, info) {
      for (const w of K.waves) {
        const r = w.a * K.WAVE_SPEED, amp = Math.exp(-w.a * 1.1) * w.s;
        if (r < 2 || amp < .04) continue;
        c.save();
        c.beginPath();
        for (const [x, y] of w.cells) {
          for (let i = 0; i < 6; i++) { const [vx, vy] = vert(i, info.R); i ? c.lineTo(x + vx, y + vy) : c.moveTo(x + vx, y + vy); }
          c.closePath();
        }
        c.clip();
        c.lineWidth = 9; c.strokeStyle = `rgba(200,245,255,${.16 * amp})`;
        c.beginPath(); c.arc(w.x, w.y, r, 0, TAU); c.stroke();
        c.lineWidth = 2.6; c.strokeStyle = `rgba(255,255,255,${.85 * amp})`;
        c.beginPath(); c.arc(w.x, w.y, r, 0, TAU); c.stroke();
        c.restore();
      }
    },
    breakFx(api, x, y, color) {
      for (let i = 0; i < 7; i++) api.push({ k: 'drop', x, y, vx: rnd(-120, 120), vy: rnd(-320, -140), g: 900, t: 0, life: rnd(.6, 1), color: i % 2 ? '#E0F7FF' : color, r: rnd(2.5, 4.5) });
      for (let i = 0; i < 3; i++) api.push({ k: 'bubble', x: x + rnd(-8, 8), y, vx: rnd(-15, 15), vy: rnd(-70, -30), g: -30, t: 0, life: rnd(.9, 1.4), color: 'rgba(255,255,255,.7)', r: rnd(2.5, 5) });
      return true;
    }
  };

  /* ================= МАРМЕЛАД ================= */
  function jellyBody(g, R, color, color2, v) {
    const body = () => { hexPath(g, 0, 0, R * .84); };
    const gr = g.createRadialGradient(-R * .3, -R * .38, R * .05, 0, 0, R * 1.15);
    gr.addColorStop(0, mix(color, 'w', .62)); gr.addColorStop(.3, mix(color, 'w', .18)); gr.addColorStop(.75, color); gr.addColorStop(1, mix(color, 'k', .22));
    body(); g.fillStyle = gr; g.fill(); g.lineJoin = 'round'; g.lineWidth = R * .26; g.strokeStyle = gr; g.stroke();
    g.save(); hexPath(g, 0, 0, R * .97); g.clip();
    const rn = srng(v * 41 + 9);
    if (v === 1) { const g2 = g.createLinearGradient(0, 0, 0, R); g2.addColorStop(0, mix(color2, 'w', .15)); g2.addColorStop(1, mix(color2, 'k', .2)); g.fillStyle = g2; g.beginPath(); g.moveTo(-R, R * .1); for (let i = 0; i <= 8; i++) g.lineTo(-R + i * R * .25, R * .08 + Math.sin(i * 1.4) * R * .05); g.lineTo(R, R); g.lineTo(-R, R); g.fill(); }
    if (v === 2) { g.fillStyle = mix(color, 'k', .38); g.beginPath(); g.arc(0, 0, R * .26, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = R * .05; g.beginPath(); g.arc(0, 0, R * .22, Math.PI * .2, Math.PI * .8); g.stroke(); }
    if (v === 4) { g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.arc(0, -R * .25, R * .2, 0, TAU); g.arc(-R * .16, -R * .42, R * .08, 0, TAU); g.arc(R * .16, -R * .42, R * .08, 0, TAU); g.fill(); g.beginPath(); g.ellipse(0, R * .18, R * .24, R * .3, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(-R * .3, R * .05, R * .08, 0, TAU); g.arc(R * .3, R * .05, R * .08, 0, TAU); g.fill(); }
    if (v === 5) { g.fillStyle = color2; g.globalAlpha = .9; for (let i = -2; i <= 2; i++) { g.save(); g.rotate(-.7); g.fillRect(i * R * .38 - R * .08, -R * 1.5, R * .16, R * 3); g.restore(); } g.globalAlpha = 1; }
    if (v === 6) { g.save(); g.scale(R * .032, R * .032); g.beginPath(); g.moveTo(0, 8); g.bezierCurveTo(-14, -2, -8, -12, 0, -5); g.bezierCurveTo(8, -12, 14, -2, 0, 8); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill(); g.restore(); }
    if (v === 7) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * .16 : R * .36; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fillStyle = 'rgba(255,255,255,.32)'; g.fill(); }
    if (v === 8) [[0, 0], [-.3, -.1], [.3, -.1], [-.15, .25], [.15, .25], [-.15, -.35], [.15, -.35]].forEach(([x, y]) => { const bg = g.createRadialGradient(x * R - R * .05, y * R - R * .05, 0, x * R, y * R, R * .17); bg.addColorStop(0, mix(color, 'w', .55)); bg.addColorStop(1, mix(color, 'k', .15)); g.fillStyle = bg; g.beginPath(); g.arc(x * R, y * R, R * .16, 0, TAU); g.fill(); });
    if (v === 9) { g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = R * .06; g.beginPath(); for (let i = 0; i < 40; i++) { const a = i * .35, r = R * .03 + i * R * .011; i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(0, 0); } g.stroke(); }
    const ig = g.createRadialGradient(R * .15, R * .28, 0, R * .15, R * .28, R * .55);
    ig.addColorStop(0, 'rgba(255,255,255,.28)'); ig.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = ig; g.fillRect(-R, -R, 2 * R, 2 * R);
    const n = v === 3 ? 55 : 16;
    for (let i = 0; i < n; i++) { g.fillStyle = `rgba(255,255,255,${.45 + rn() * .5})`; g.beginPath(); g.arc((rn() - .5) * 1.7 * R, (rn() - .5) * 1.7 * R, R * (.022 + rn() * (v === 3 ? .045 : .03)), 0, TAU); g.fill(); }
    g.restore();
    g.fillStyle = 'rgba(255,255,255,.82)'; g.beginPath(); g.ellipse(-R * .3, -R * .45, R * .3, R * .12, -.5, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(R * .05, -R * .6, R * .055, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = R * .05; g.beginPath(); g.arc(0, 0, R * .78, .2, 1.2); g.stroke();
  }
  A.jelly = {
    tile(c, R, color, o, skin) {
      const a = o.board ? o.age : 99, t = o.t;
      const j = (a < 2 ? .24 * Math.exp(-5 * a) * Math.sin(a * 24) : 0) + o.rip * 2.6 + .014 * Math.sin(t * 2.6 + o.seed);
      c.translate(0, R * .8); c.scale(1 + j, 1 - j * 1.15); c.translate(0, -R * .8);
      const idx = Math.max(0, skin.colors.indexOf(color)), color2 = skin.colors[(idx + 2) % 6];
      blit(c, sprite('jb' + color + o.v, R, (g, R) => jellyBody(g, R, color, color2, o.v)), R);
      const sp = Math.sin(t * 1.1 + o.seed * 5);
      if (sp > .94) { const k = (sp - .94) / .06; c.fillStyle = `rgba(255,255,255,${k})`; star4(c, R * .25, -R * .2, R * .22 * k); c.fill(); }
    },
    breakFx(api, x, y, color) {
      for (let i = 0; i < 6; i++) api.push({ k: 'blob', x, y, vx: rnd(-160, 160), vy: rnd(-320, -120), g: 900, t: 0, life: rnd(.7, 1.1), color, r: rnd(4.5, 8) });
      for (let i = 0; i < 7; i++) api.push({ k: 'star4', x: x + rnd(-10, 10), y: y + rnd(-10, 10), vx: rnd(-60, 60), vy: rnd(-90, -20), g: 60, t: 0, life: rnd(.5, .8), color: '#FFFFFF', r: rnd(3, 6) });
      api.splat(x, y, color, 1.2);
      return true;
    }
  };

  /* ================= МАГМА ================= */
  const CRACKS = Array.from({ length: 10 }, (_, v) => {
    const rn = srng(v * 97 + 5), out = [], n = 3 + v % 3;
    for (let i = 0; i < n; i++) {
      const a = rn() * TAU;
      let x = Math.cos(a) * .95, y = Math.sin(a) * .95;
      const pts = [[x, y]];
      for (let s = 0; s < 4; s++) {
        const dx = -x, dy = -y, l = Math.hypot(dx, dy) || 1;
        x += dx / l * .24 + (rn() - .5) * .25; y += dy / l * .24 + (rn() - .5) * .25;
        pts.push([x, y]);
        if (s === 1 && rn() < .5) out.push([[x, y], [x + (rn() - .5) * .6, y + (rn() - .5) * .6]]);
      }
      out.push(pts);
    }
    return out;
  });
  const embers = Array.from({ length: 26 }, () => ({ x: Math.random() * 360, y: Math.random() * 900, s: rnd(15, 45), r: rnd(1, 2.4), p: rnd(0, TAU) }));
  A.lava = {
    empty(c, R) { hexPath(c, 0, 0, R * .93); c.fillStyle = '#1E0E0A'; c.fill(); c.lineWidth = 1; c.strokeStyle = 'rgba(255,80,20,.08)'; c.stroke(); },
    tile(c, R, color, o) {
      const t = o.t, p = .62 + .38 * Math.sin(t * 2.4 + o.seed);
      blit(c, sprite('mb' + o.v, R, (g, R) => {
        hexPath(g, 0, 0, R);
        const gr = g.createLinearGradient(0, -R, 0, R); gr.addColorStop(0, '#46302A'); gr.addColorStop(1, '#1B0F0B');
        g.fillStyle = gr; g.fill(); g.save(); g.clip();
        const rn = srng(o.v * 7 + 1);
        for (let i = 0; i < 9; i++) {
          g.fillStyle = rn() < .5 ? 'rgba(80,58,50,.55)' : 'rgba(10,5,3,.45)';
          g.beginPath(); const cx = (rn() - .5) * 1.6 * R, cy = (rn() - .5) * 1.6 * R, rr = R * (.12 + rn() * .2);
          for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + rn() * .5; g.lineTo(cx + Math.cos(a) * rr * (.7 + rn() * .4), cy + Math.sin(a) * rr * (.7 + rn() * .4)); }
          g.closePath(); g.fill();
        }
        g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(-R, -R, 2 * R, R * .5);
        g.restore();
      }), R);
      c.save(); hexPath(c, 0, 0, R); c.clip();
      if (o.v === 2 || o.v === 7) {
        const pg = c.createRadialGradient(0, R * .05, 0, 0, R * .05, R * .5);
        pg.addColorStop(0, '#FFF3B0'); pg.addColorStop(.35, color); pg.addColorStop(1, 'rgba(255,60,0,0)');
        c.globalCompositeOperation = 'lighter'; c.globalAlpha *= .6 + .4 * p; c.fillStyle = pg;
        c.beginPath(); c.ellipse(0, R * .05, R * .45, R * .35, Math.sin(t * .3) * .2, 0, TAU); c.fill();
        c.globalAlpha /= (.6 + .4 * p); c.globalCompositeOperation = 'source-over';
        c.fillStyle = 'rgba(40,20,15,.8)'; c.beginPath(); c.ellipse(Math.sin(t * .4 + o.seed) * R * .12, R * .05, R * .1, R * .06, t * .2, 0, TAU); c.fill();
      }
      const paths = CRACKS[o.v];
      const stroke = (w, col, a) => { c.lineWidth = w; c.strokeStyle = col; c.globalAlpha *= a; paths.forEach(pts => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x * R, y * R) : c.moveTo(x * R, y * R)); c.stroke(); }); c.globalAlpha /= a; };
      c.lineJoin = 'round'; c.lineCap = 'round';
      c.globalCompositeOperation = 'lighter';
      stroke(R * .26, color, .28 * p);
      stroke(R * .1, color, .95);
      stroke(R * .035, '#FFF2B0', .85 * p);
      if (o.v === 5) { const ph = (t * .6 + o.seed * .3) % 1; c.strokeStyle = '#FFB347'; c.lineWidth = R * .04; c.globalAlpha *= 1 - ph; c.beginPath(); c.arc(-R * .2, R * .2, ph * R * .2, 0, TAU); c.stroke(); c.globalAlpha /= Math.max(.001, 1 - ph); }
      c.globalCompositeOperation = 'source-over';
      c.restore();
      hexPath(c, 0, 0, R * .98); c.globalCompositeOperation = 'lighter'; c.lineWidth = R * .07; c.strokeStyle = color; c.globalAlpha *= .25 * p; c.stroke(); c.globalAlpha /= (.25 * p); c.globalCompositeOperation = 'source-over';
      if (o.v % 2 === 1) drip(c, ((o.seed % 5) - 2) * R * .15, R, R * (.4 + (o.seed % 3) * .15), t * 1.3, o.seed, color, true);
    },
    bg(c, w, h, info) {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1A0604'); g.addColorStop(1, '#2E0B04');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      if (info.preview) return true;
      const t = K.time(), p = .75 + .25 * Math.sin(t * 1.3);
      const rg = c.createRadialGradient(w / 2, h + 40, 20, w / 2, h + 40, h * .8);
      rg.addColorStop(0, `rgba(255,90,20,${.35 * p})`); rg.addColorStop(1, 'rgba(255,40,0,0)');
      c.fillStyle = rg; c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'lighter';
      for (const e of embers) {
        const y = ((e.y - t * e.s) % h + h) % h, x = e.x + Math.sin(t + e.p) * 8;
        c.fillStyle = `rgba(255,${120 + Math.round(80 * Math.sin(t * 3 + e.p))},40,${.35 + .3 * Math.sin(t * 4 + e.p)})`;
        c.beginPath(); c.arc(x, y, e.r, 0, TAU); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
      return true;
    },
    breakFx(api, x, y, color) {
      for (let i = 0; i < 9; i++) api.push({ k: 'ember', x, y, vx: rnd(-90, 90), vy: rnd(-220, -80), g: -30, t: 0, life: rnd(.8, 1.5), color: pick(['#FFB347', color, '#FFE08A']), r: rnd(1.8, 3.5) });
      for (let i = 0; i < 4; i++) api.push({ k: 'drop', x, y, vx: rnd(-120, 120), vy: rnd(-250, -80), g: 800, t: 0, life: rnd(.6, .9), color, r: rnd(3, 5), glow: true });
      for (let i = 0; i < 4; i++) api.push({ k: 'shard', x, y, vx: rnd(-150, 150), vy: rnd(-240, -60), g: 800, t: 0, life: rnd(.6, .9), color: '#2B1B17', r: rnd(4, 7), rot: rnd(0, TAU), vr: rnd(-9, 9) });
      return true;
    }
  };

  /* ================= ЗАКАТ ================= */
  const SUN = [[0, '#5B3491'], [.3, '#8A3FA3'], [.58, '#C8468A'], [.82, '#F25A7E'], [1, '#FF8A7E']];
  /** Солнце у горизонта: тёплая корона, сдержанные протуберанцы, диск с потемнением к краю и море с дорожкой. */
  function realSun(c, x, y, r, t) {
    const cg = c.createRadialGradient(x, y, r * .8, x, y, r * 3.4);
    cg.addColorStop(0, 'rgba(255,196,120,.6)'); cg.addColorStop(.35, 'rgba(255,120,90,.22)'); cg.addColorStop(1, 'rgba(255,80,110,0)');
    c.fillStyle = cg; c.fillRect(x - r * 3.4, y - r * 3.4, r * 6.8, r * 6.8);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let layer = 0; layer < 2; layer++) {
      c.beginPath();
      for (let i = 0; i <= 90; i++) {
        const a = i / 90 * TAU;
        const n = .05 * Math.sin(a * 7 + t * 1.1 + layer) + .035 * Math.sin(a * 13 - t * 1.9) + .025 * Math.sin(a * 29 + t * 3.1 + layer * 2);
        const rr = r * (1.03 + layer * .03 + Math.max(0, n) * (1.4 - layer * .5));
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        i ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.closePath();
      c.fillStyle = layer ? 'rgba(255,110,60,.28)' : 'rgba(255,170,80,.45)'; c.fill();
    }
    c.restore();
    const dg = c.createRadialGradient(x - r * .12, y - r * .15, r * .05, x, y, r);
    dg.addColorStop(0, '#FFFCEB'); dg.addColorStop(.45, '#FFE59A'); dg.addColorStop(.82, '#FFB257'); dg.addColorStop(1, '#FF8740');
    c.fillStyle = dg; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    const sea = y + r * .35;
    const sgr = c.createLinearGradient(0, sea, 0, sea + r * 2);
    sgr.addColorStop(0, '#7A2455'); sgr.addColorStop(1, '#2A0F33');
    c.fillStyle = sgr; c.fillRect(0, sea, x * 2, r * 3);
    c.fillStyle = 'rgba(255,200,150,.35)'; c.fillRect(0, sea, x * 2, 1.5);
    for (let i = 0; i < 9; i++) {
      const yy = sea + 4 + i * 5, ww = r * (1.1 - i * .09) * (1 + .15 * Math.sin(t * 2 + i * 1.7));
      c.fillStyle = `rgba(255,${200 - i * 8},${140 - i * 6},${.55 - i * .05})`;
      c.fillRect(x - ww / 2 + Math.sin(t * 1.3 + i) * 4, yy, ww, 2);
    }
  }
  const sunK = o => o.sk != null ? o.sk : clamp((o.wy - K.layout.top) / (K.layout.bottom - K.layout.top));
  A.sunset = {
    tile(c, R, color, o) {
      const k = sunK(o), col = ramp(SUN, k), t = o.t;
      hexPath(c, 0, 0, R); c.fillStyle = col; c.fill();
      c.save(); c.clip();
      const gr = c.createLinearGradient(0, -R, 0, R); gr.addColorStop(0, 'rgba(255,255,255,.14)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(255,170,120,${.12 + .2 * k})`);
      c.fillStyle = gr; c.fillRect(-R, -R, 2 * R, 2 * R);
      const v = o.v % 5;
      if (v === 1 && k > .25) { c.strokeStyle = `rgba(255,200,220,${.14 + .12 * k})`; c.lineWidth = R * .09; c.lineCap = 'round'; c.beginPath(); c.moveTo(-R * .6, -R * .1); c.lineTo(R * .3, -R * .1); c.moveTo(-R * .2, R * .15); c.lineTo(R * .6, R * .15); c.stroke(); }
      if (v === 2 && k < .78) { const fl = Math.sin(t * 6 + o.seed) * R * .05; c.strokeStyle = 'rgba(15,4,25,.65)'; c.lineWidth = R * .05; c.lineCap = 'round'; [[-.15, -.1, .18], [.25, .1, .12]].forEach(([x, y, s]) => { c.beginPath(); c.moveTo(x * R - s * R, y * R - fl); c.quadraticCurveTo(x * R - s * R * .4, y * R - fl * .5, x * R, y * R + R * .03); c.quadraticCurveTo(x * R + s * R * .4, y * R - fl * .5, x * R + s * R, y * R - fl); c.stroke(); }); }
      if (v === 3 && k < .5) { const tw = .5 + .5 * Math.sin(t * 2.3 + o.seed * 3); c.fillStyle = `rgba(255,240,220,${.4 + .5 * tw})`; star4(c, R * .15, -R * .25, R * (.08 + .07 * tw)); c.fill(); c.beginPath(); c.arc(-R * .3, R * .2, R * .03, 0, TAU); c.fill(); }
      if (v === 4) { c.strokeStyle = `rgba(255,210,170,${.12 + .3 * k})`; c.lineWidth = R * .05; c.beginPath(); c.moveTo(-R * .45, R * .45); c.lineTo(R * .45, R * .45); c.moveTo(-R * .25, R * .6); c.lineTo(R * .25, R * .6); c.stroke(); }
      c.restore();
      gloss(c, R, .45);
      hexPath(c, 0, 0, R * .96); c.lineWidth = R * .06; c.strokeStyle = 'rgba(255,225,235,.55)'; c.stroke();
    },
    bg(c, w, h, info) {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#0B0520'); g.addColorStop(.45, '#2A0F45'); g.addColorStop(.78, '#8E1F5C'); g.addColorStop(1, '#FF6A5C');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      const t = K.time();
      const sg = c.createRadialGradient(w / 2, h + 10, 10, w / 2, h + 10, h * .6);
      sg.addColorStop(0, 'rgba(255,200,130,.75)'); sg.addColorStop(.3, 'rgba(255,120,90,.35)'); sg.addColorStop(1, 'rgba(255,80,100,0)');
      c.fillStyle = sg; c.fillRect(0, 0, w, h);
      realSun(c, w / 2, info.preview ? h * .9 : h * .87, w * .15, t);
      if (!info.preview) {
        for (let i = 0; i < 26; i++) { const a = .25 + .35 * Math.sin(t * 1.5 + i * 2.1); c.fillStyle = `rgba(255,255,255,${a * (1 - i / 40)})`; c.fillRect((i * 137) % w, (i * 71) % (h * .35), 1.6, 1.6); }
        c.strokeStyle = 'rgba(255,210,170,.25)'; c.lineWidth = 2;
        for (let i = 0; i < 5; i++) { const y = h - 8 - i * 7, x = w / 2 + Math.sin(t * 1.2 + i) * 12, l = 70 - i * 10; c.beginPath(); c.moveTo(x - l, y); c.lineTo(x + l, y); c.stroke(); }
      }
      return true;
    },
    breakFx(api, x, y) {
      const col = ramp(SUN, sunK({ wy: y }));
      for (let i = 0; i < 4; i++) api.push({ k: 'shard', x, y, vx: rnd(-160, 160), vy: rnd(-240, -60), g: 700, t: 0, life: rnd(.6, .9), color: col, r: rnd(4, 7), rot: rnd(0, TAU), vr: rnd(-9, 9) });
      for (let i = 0; i < 6; i++) api.push({ k: 'ember', x, y, vx: rnd(-120, 120), vy: rnd(-160, -40), g: 120, t: 0, life: rnd(.5, .9), color: '#FFC3A0', r: rnd(1.5, 2.8) });
      api.splat(x, y, col, 1);
      return true;
    }
  };

  /* ================= САМОЦВЕТЫ ================= */
  function gemCut(g, R, color, v) {
    const L = k => mix(color, 'w', k), D = k => mix(color, 'k', k), V = (i, r = R) => vert(i, r);
    const poly = (pts, fill) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fillStyle = fill; g.fill(); };
    hexPath(g, 0, 0, R); g.fillStyle = color; g.fill();
    if (v === 0) {
      for (let i = 0; i < 6; i++) poly([V(i), V(i + 1), V(i + 1, R * .5), V(i, R * .5)], [L(.35), L(.15), D(.08), D(.25), D(.12), L(.25)][i]);
      hexPath(g, 0, 0, R * .5); g.fillStyle = L(.3); g.fill();
    } else if (v === 1) {
      for (let i = 0; i < 6; i++) poly([[0, 0], V(i), V(i + 1)], i % 2 ? D(.2) : L(.25));
      g.beginPath(); for (let i = 0; i < 12; i++) { const [x, y] = V(i / 2, i % 2 ? R * .25 : R * .5); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.fillStyle = L(.45); g.fill();
    } else if (v === 2) {
      const gr = g.createRadialGradient(-R * .3, -R * .35, R * .05, 0, 0, R); gr.addColorStop(0, L(.7)); gr.addColorStop(.4, L(.1)); gr.addColorStop(1, D(.35));
      hexPath(g, 0, 0, R); g.fillStyle = gr; g.fill();
    } else if (v === 3) {
      [[R * .78, L(.15)], [R * .56, D(.1)], [R * .36, L(.3)], [R * .18, L(.55)]].forEach(([r, f]) => { hexPath(g, 0, 0, r); g.fillStyle = f; g.fill(); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = R * .02; g.stroke(); });
    } else if (v === 4) {
      poly([V(4), V(5), V(0), [0, 0]], L(.35)); poly([[0, 0], V(0), V(1), V(2)], D(.1)); poly([V(2), V(3), V(4), [0, 0]], D(.3));
    } else if (v === 5) {
      for (let i = 0; i < 12; i++) { const a0 = V(i / 2, i % 2 ? R : R * .55), a1 = V((i + 1) / 2, (i + 1) % 2 ? R : R * .55); poly([[0, 0], a0, a1], i % 3 === 0 ? L(.35) : i % 3 === 1 ? D(.15) : L(.1)); }
    } else if (v === 6) {
      for (let i = 0; i < 6; i++) poly([[0, 0], V(i), V(i + 1)], i < 3 ? L(.2) : D(.18));
      hexPath(g, 0, 0, R * .45); g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = R * .03; g.stroke();
    } else if (v === 7) {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, R); gr.addColorStop(0, L(.5)); gr.addColorStop(1, D(.25));
      hexPath(g, 0, 0, R); g.fillStyle = gr; g.fill();
      g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = R * .025; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * R, Math.sin(a) * R); g.stroke(); }
    } else if (v === 8) {
      for (let i = 0; i < 6; i++) poly([V(i), V(i + 1), V(i + 1, R * .6), V(i, R * .6)], i % 2 ? D(.18) : L(.12));
      g.fillStyle = L(.45); g.beginPath(); g.moveTo(0, -R * .45); g.quadraticCurveTo(R * .35, R * .1, 0, R * .35); g.quadraticCurveTo(-R * .35, R * .1, 0, -R * .45); g.fill();
    } else {
      g.save(); hexPath(g, 0, 0, R); g.clip();
      const s = R * .34;
      for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { poly([[x * s, y * s - s / 2], [x * s + s / 2, y * s], [x * s, y * s + s / 2], [x * s - s / 2, y * s]], (x + y) % 2 ? L(.3) : D(.15)); }
      g.restore();
    }
    hexPath(g, 0, 0, R * .98); g.strokeStyle = L(.55); g.lineWidth = R * .045; g.stroke();
  }
  function sweep(c, R, o, speed, width, color) {
    const pos = ((o.t * speed) % 1000) - 250, u = o.wx * .8 + o.wy * .6, d = pos - u;
    if (Math.abs(d) > R * 2.4) return;
    c.save(); hexPath(c, 0, 0, R); c.clip();
    c.globalCompositeOperation = 'lighter';
    c.rotate(Math.atan2(.6, .8));
    const gr = c.createLinearGradient(d - width, 0, d + width, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, color); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(d - width, -R * 2, width * 2, R * 4);
    c.restore();
  }
  function twinkle(c, R, o, freq, size) {
    const sp = Math.sin(o.t * freq + o.seed * 3.7);
    if (sp < .9) return;
    const k = (sp - .9) / .1, rn = srng(o.seed + Math.floor(o.t * freq / TAU));
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(255,255,255,${k})`;
    star4(c, (rn() - .5) * R, (rn() - .5) * R, R * size * k); c.fill();
    c.restore();
  }
  A.gems = {
    tile(c, R, color, o) {
      blit(c, sprite('gm' + color + o.v, R, (g, R) => gemCut(g, R, color, o.v)), R);
      sweep(c, R, o, 190, 14, 'rgba(255,255,255,.75)');
      twinkle(c, R, o, 1.3, .38);
    },
    breakFx(api, x, y, color) {
      for (let i = 0; i < 8; i++) api.push({ k: 'tri', x, y, vx: rnd(-190, 190), vy: rnd(-280, -60), g: 750, t: 0, life: rnd(.6, 1), color: i % 2 ? color : mix(color, 'w', .4), r: rnd(4, 8), rot: rnd(0, TAU), vr: rnd(-12, 12) });
      for (let i = 0; i < 5; i++) api.push({ k: 'star4', x: x + rnd(-12, 12), y: y + rnd(-12, 12), vx: rnd(-40, 40), vy: rnd(-60, -10), g: 0, t: 0, life: rnd(.5, .8), color: '#FFFFFF', r: rnd(4, 8) });
      return true;
    }
  };

  /* ================= КОСМОС ================= */
  const space = {
    stars: Array.from({ length: 130 }, () => ({ x: Math.random() * 360, y: Math.random() * 900, s: rnd(.6, 2.1), p: rnd(0, TAU), c: pick(['255,255,255', '200,220,255', '255,240,200', '255,210,240']) })),
    neb: null, nebH: 0, shoot: null, next: 3
  };
  function nebula(w, h) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    [[.2, .25, .55, '120,70,255'], [.8, .45, .5, '255,80,200'], [.4, .75, .6, '40,200,255'], [.75, .9, .4, '140,90,255'], [.15, .6, .35, '255,120,180']].forEach(([x, y, r, col]) => {
      const gr = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w);
      gr.addColorStop(0, `rgba(${col},.22)`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    return cv;
  }
  function planet(g, R, color, v, rn) {
    const pr = R * .36, body = (fill) => { g.beginPath(); g.arc(0, 0, pr, 0, TAU); g.fillStyle = fill; g.fill(); };
    const shade = () => { const sg = g.createRadialGradient(-pr * .4, -pr * .4, pr * .1, 0, 0, pr * 1.1); sg.addColorStop(0, 'rgba(255,255,255,.15)'); sg.addColorStop(.6, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,10,.65)'); body(sg); };
    if (v === 0) {
      g.save(); g.rotate(-.35);
      g.strokeStyle = mix(color, 'w', .45); g.lineWidth = R * .07;
      g.beginPath(); g.ellipse(0, 0, R * .66, R * .18, 0, Math.PI, TAU); g.stroke();
      const bg = g.createLinearGradient(0, -pr, 0, pr); bg.addColorStop(0, mix(color, 'w', .35)); bg.addColorStop(1, mix(color, 'k', .3)); body(bg);
      g.save(); g.beginPath(); g.arc(0, 0, pr, 0, TAU); g.clip(); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(-pr, -pr * .3, 2 * pr, pr * .18); g.fillRect(-pr, pr * .15, 2 * pr, pr * .12); g.restore();
      shade();
      g.strokeStyle = mix(color, 'w', .6); g.beginPath(); g.ellipse(0, 0, R * .66, R * .18, 0, 0, Math.PI); g.stroke();
      g.restore();
    } else if (v === 1) {
      body(mix(color, 'w', .55));
      for (let i = 0; i < 6; i++) { const x = (rn() - .5) * pr * 1.3, y = (rn() - .5) * pr * 1.3, r = pr * (.1 + rn() * .15); g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = pr * .04; g.beginPath(); g.arc(x - r * .1, y - r * .1, r, Math.PI, Math.PI * 1.6); g.stroke(); }
      shade();
    } else if (v === 2) {
      body('#2A6BD1');
      g.save(); g.beginPath(); g.arc(0, 0, pr, 0, TAU); g.clip();
      for (let i = 0; i < 5; i++) { g.fillStyle = rn() < .7 ? '#3FA34D' : '#C9B26B'; g.beginPath(); g.ellipse((rn() - .5) * pr * 1.6, (rn() - .5) * pr * 1.6, pr * (.2 + rn() * .3), pr * (.12 + rn() * .2), rn() * 3, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse((rn() - .5) * pr * 1.6, (rn() - .5) * pr * 1.6, pr * .3, pr * .06, rn(), 0, TAU); g.fill(); }
      g.restore(); shade();
      g.strokeStyle = 'rgba(127,200,255,.55)'; g.lineWidth = pr * .12; g.beginPath(); g.arc(0, 0, pr * 1.05, 0, TAU); g.stroke();
    } else if (v === 3) {
      body(color);
      g.save(); g.beginPath(); g.arc(0, 0, pr * 1.1, 0, TAU); g.clip();
      for (let i = -5; i <= 5; i++) { g.fillStyle = i % 2 ? mix(color, 'w', .3 + rn() * .2) : mix(color, 'k', .15 + rn() * .2); g.fillRect(-pr * 1.2, i * pr * .2 - pr * .1, pr * 2.4, pr * (.12 + rn() * .1)); }
      g.fillStyle = mix(color, 'k', .35); g.beginPath(); g.ellipse(pr * .3, pr * .25, pr * .22, pr * .12, 0, 0, TAU); g.fill();
      g.restore(); shade();
    }
  }
  A.space = {
    empty(c, R) { hexPath(c, 0, 0, R * .93); c.fillStyle = 'rgba(18,14,48,.8)'; c.fill(); c.lineWidth = 1; c.strokeStyle = 'rgba(160,150,255,.14)'; c.stroke(); },
    tile(c, R, color, o) {
      const t = o.t, v = o.v;
      blit(c, sprite('sp' + color + (v <= 3 ? v : 'x'), R, (g, R) => {
        hexPath(g, 0, 0, R * .97); g.fillStyle = '#0A0822'; g.fill(); g.save(); g.clip();
        const ng = g.createRadialGradient(R * .3, R * .3, 0, 0, 0, R * 1.2); ng.addColorStop(0, mix(color, 'k', .45)); ng.addColorStop(1, 'rgba(10,8,34,0)');
        g.fillStyle = ng; g.globalAlpha = .6; g.fillRect(-R, -R, 2 * R, 2 * R); g.globalAlpha = 1;
        const rn = srng(v * 13 + 5);
        for (let i = 0; i < 8; i++) { g.fillStyle = `rgba(255,255,255,${.3 + rn() * .5})`; g.fillRect((rn() - .5) * 1.8 * R, (rn() - .5) * 1.8 * R, R * .04, R * .04); }
        if (v <= 3) planet(g, R, color, v, srng(v * 7 + 11));
        g.restore();
      }), R);
      c.save(); hexPath(c, 0, 0, R * .97); c.clip();
      c.globalCompositeOperation = 'lighter';
      if (v === 4) {
        const p = .85 + .15 * Math.sin(t * 3 + o.seed);
        const sg = c.createRadialGradient(0, 0, 0, 0, 0, R * .6); sg.addColorStop(0, '#FFFFFF'); sg.addColorStop(.25, mix(color, 'w', .5)); sg.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = sg; c.globalAlpha *= p; c.beginPath(); c.arc(0, 0, R * .6, 0, TAU); c.fill(); c.globalAlpha /= p;
        c.save(); c.rotate(t * .3); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = R * .03;
        for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 4); c.beginPath(); c.moveTo(-R * .7 * p, 0); c.lineTo(R * .7 * p, 0); c.stroke(); }
        c.restore();
      } else if (v === 5) {
        c.save(); c.rotate(t * .25 + o.seed); c.scale(1, .6);
        for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 36; i++) {
          const a = i * .2 + arm * Math.PI, r = R * (.05 + i * .018);
          c.fillStyle = `rgba(${i < 10 ? '255,240,220' : '190,170,255'},${.9 - i / 45})`;
          c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r, R * (.055 - i * .0012), 0, TAU); c.fill();
        }
        const cg = c.createRadialGradient(0, 0, 0, 0, 0, R * .22); cg.addColorStop(0, '#FFFFFF'); cg.addColorStop(1, 'rgba(255,220,180,0)');
        c.fillStyle = cg; c.beginPath(); c.arc(0, 0, R * .22, 0, TAU); c.fill();
        c.restore();
      } else if (v === 6) {
        [[-.2, -.1, color], [.2, .15, mix(color, 'w', .3)], [0, .3, '#67E8F9']].forEach(([x, y, col], i) => {
          const r = R * (.45 + .05 * Math.sin(t * .8 + i + o.seed));
          const ng = c.createRadialGradient(x * R, y * R, 0, x * R, y * R, r); ng.addColorStop(0, col); ng.addColorStop(1, 'rgba(0,0,0,0)');
          c.globalAlpha *= .45; c.fillStyle = ng; c.fillRect(-R, -R, 2 * R, 2 * R); c.globalAlpha /= .45;
        });
      } else if (v === 7) {
        c.save(); c.scale(1, .45); c.rotate(t * .8 + o.seed);
        for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; c.strokeStyle = `rgba(255,${150 + Math.round(90 * Math.sin(a * 3))},80,${.35 + .35 * Math.sin(a * 2)})`; c.lineWidth = R * .12; c.beginPath(); c.arc(0, 0, R * .48, a, a + .3); c.stroke(); }
        c.restore();
        c.globalCompositeOperation = 'source-over';
        c.fillStyle = '#000'; c.beginPath(); c.arc(0, 0, R * .2, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,230,200,.8)'; c.lineWidth = R * .025; c.beginPath(); c.arc(0, 0, R * .23, 0, TAU); c.stroke();
      } else if (v === 8) {
        const w = Math.sin(t * 2 + o.seed) * .04;
        const tg = c.createLinearGradient(R * .2, -R * .2, -R * .8, R * .7); tg.addColorStop(0, mix(color, 'w', .6)); tg.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = tg; c.beginPath(); c.moveTo(R * .2, -R * .32); c.quadraticCurveTo(-R * .2, R * (.1 + w), -R * .85, R * .75); c.quadraticCurveTo(-R * .1, R * (.2 - w), R * .32, -R * .1); c.fill();
        const hg = c.createRadialGradient(R * .25, -R * .22, 0, R * .25, -R * .22, R * .2); hg.addColorStop(0, '#FFFFFF'); hg.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = hg; c.beginPath(); c.arc(R * .25, -R * .22, R * .2, 0, TAU); c.fill();
      } else if (v === 9) {
        const rn = srng(o.seed * 5 + 2);
        for (let i = 0; i < 8; i++) { const x = (rn() - .5) * 1.3 * R, y = (rn() - .5) * 1.3 * R, tw = .5 + .5 * Math.sin(t * (2 + rn() * 2) + i); c.fillStyle = `rgba(255,255,255,${.4 + .6 * tw})`; star4(c, x, y, R * (.05 + .1 * tw * rn())); c.fill(); }
      }
      c.restore();
      hexPath(c, 0, 0, R * .95);
      c.lineWidth = R * .07; c.strokeStyle = color; c.globalAlpha *= .75; c.stroke(); c.globalAlpha /= .75;
      c.globalCompositeOperation = 'lighter'; c.lineWidth = R * .22; c.globalAlpha *= .18; c.stroke(); c.globalAlpha /= .18; c.globalCompositeOperation = 'source-over';
    },
    bg(c, w, h, info) {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#05030F'); g.addColorStop(1, '#0C0728');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      if (!space.neb || space.nebH !== h || space.nebW !== w) { space.neb = nebula(w, h); space.nebH = h; space.nebW = w; }
      const t = K.time();
      c.drawImage(space.neb, Math.sin(t * .05) * 10, Math.cos(t * .04) * 8);
      for (const s of space.stars) {
        if (s.x > w || s.y > h) continue;
        c.fillStyle = `rgba(${s.c},${.25 + .6 * (.5 + .5 * Math.sin(t * (1 + s.s) + s.p))})`;
        c.fillRect(s.x, s.y, s.s, s.s);
      }
      if (!info.preview) {
        if (!space.shoot && (space.next -= 1 / 60) < 0) space.shoot = { x: rnd(40, w), y: rnd(20, h * .5), t: 0 };
        if (space.shoot) {
          const s = space.shoot; s.t += 1 / 60;
          const x = s.x - s.t * 420, y = s.y + s.t * 190, a = 1 - s.t / .7;
          if (a <= 0) { space.shoot = null; space.next = rnd(3, 8); }
          else { const sg = c.createLinearGradient(x, y, x + 70, y - 32); sg.addColorStop(0, `rgba(255,255,255,${a})`); sg.addColorStop(1, 'rgba(255,255,255,0)'); c.strokeStyle = sg; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 70, y - 32); c.stroke(); }
        }
      }
      return true;
    },
    breakFx(api, x, y, color) {
      for (let i = 0; i < 8; i++) api.push({ k: 'star4', x, y, vx: rnd(-130, 130), vy: rnd(-130, 130), g: 0, t: 0, life: rnd(.6, 1.1), color: i % 2 ? '#FFFFFF' : color, r: rnd(3, 6) });
      for (let i = 0; i < 10; i++) api.push({ k: 'ember', x, y, vx: rnd(-90, 90), vy: rnd(-90, 90), g: 0, t: 0, life: rnd(.5, 1), color: mix(color, 'w', .4), r: rnd(1, 2) });
      return true;
    }
  };

  /* ================= СТЕКЛО ================= */
  // Жидкое стекло как в iOS: тонированное полупрозрачное тело, толщина по краю,
  // светлая кромка сверху-слева, линза-блик и каустика снизу. Всё статичное — в спрайте,
  // вживую только редкий пробегающий блик, поэтому скин лёгкий.
  function rgbaHex(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
  function liquidGlass(g, R, color) {
    hexPath(g, R * .05, R * .12, R * .97); g.fillStyle = 'rgba(0,0,25,.3)'; g.fill();
    hexPath(g, 0, 0, R);
    const body = g.createLinearGradient(-R, -R, R, R);
    body.addColorStop(0, rgbaHex(color, .5)); body.addColorStop(1, rgbaHex(color, .24));
    g.fillStyle = body; g.fill();
    g.fillStyle = 'rgba(255,255,255,.07)'; g.fill();
    g.save(); hexPath(g, 0, 0, R); g.clip();
    for (let i = 0; i < 6; i++) { hexPath(g, 0, 0, R * (1 - i * .035)); g.lineWidth = R * .05; g.strokeStyle = `rgba(255,255,255,${.14 - i * .022})`; g.stroke(); }
    const sh = g.createLinearGradient(0, -R, 0, -R * .05);
    sh.addColorStop(0, 'rgba(255,255,255,.6)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sh; g.beginPath(); g.ellipse(-R * .05, -R * .66, R * .78, R * .4, 0, 0, TAU); g.fill();
    const ca = g.createRadialGradient(R * .12, R * .78, 0, R * .12, R * .78, R * .6);
    ca.addColorStop(0, rgbaHex(color, .9)); ca.addColorStop(.35, 'rgba(255,255,255,.35)'); ca.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = ca; g.beginPath(); g.ellipse(R * .12, R * .8, R * .6, R * .28, 0, 0, TAU); g.fill();
    g.restore();
    hexPath(g, 0, 0, R * .975);
    const rim = g.createLinearGradient(-R * .7, -R, R * .7, R);
    rim.addColorStop(0, 'rgba(255,255,255,.95)'); rim.addColorStop(.42, 'rgba(255,255,255,.2)'); rim.addColorStop(.72, 'rgba(255,255,255,.1)'); rim.addColorStop(1, 'rgba(255,255,255,.65)');
    g.lineWidth = R * .065; g.lineJoin = 'round'; g.strokeStyle = rim; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.ellipse(-R * .44, -R * .4, R * .11, R * .045, -.85, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(-R * .26, -R * .56, R * .03, 0, TAU); g.fill();
  }
  const glassBg = { cv: null, w: 0, h: 0 };
  function paintGlassBg(w, h) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1A1F48'); g.addColorStop(1, '#0B0F24');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    [[.2, .2, '255,110,160'], [.85, .35, '100,140,255'], [.3, .7, '70,230,200'], [.8, .85, '190,120,255']].forEach(([x, y, col]) => {
      const rg = c.createRadialGradient(x * w, y * h, 0, x * w, y * h, w * .55);
      rg.addColorStop(0, `rgba(${col},.35)`); rg.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = rg; c.fillRect(0, 0, w, h);
    });
    return cv;
  }
  A.ice = {
    empty(c, R) {
      hexPath(c, 0, 0, R * .93); c.fillStyle = 'rgba(255,255,255,.05)'; c.fill();
      c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,.13)'; c.stroke();
    },
    tile(c, R, color, o) {
      blit(c, sprite('lg' + color, R, (g, R) => liquidGlass(g, R, color)), R);
      const a = o.board ? o.age : 99;
      if (a < .6) { c.save(); hexPath(c, 0, 0, R); c.clip(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,255,255,${.5 * (1 - a / .6)})`; c.fillRect(-R, -R, 2 * R, 2 * R); c.restore(); }
      sweep(c, R, o, 160, 12, 'rgba(255,255,255,.55)');
    },
    bg(c, w, h, info) {
      if (info.preview) { c.drawImage(paintGlassBg(w, h), 0, 0); return true; }
      if (!glassBg.cv || glassBg.w !== w || glassBg.h !== h) { glassBg.cv = paintGlassBg(w, h); glassBg.w = w; glassBg.h = h; }
      c.drawImage(glassBg.cv, 0, 0);
      return true;
    },
    breakFx(api, x, y, color) {
      for (let i = 0; i < 8; i++) api.push({ k: 'glass', x, y, vx: rnd(-200, 200), vy: rnd(-280, -40), g: 800, t: 0, life: rnd(.6, 1), color: 'rgba(255,255,255,.9)', r: rnd(3, 8), rot: rnd(0, TAU), vr: rnd(-14, 14) });
      for (let i = 0; i < 5; i++) api.push({ k: 'tri', x, y, vx: rnd(-160, 160), vy: rnd(-240, -60), g: 750, t: 0, life: rnd(.6, .9), color: mix(color, 'w', .35), r: rnd(4, 7), rot: rnd(0, TAU), vr: rnd(-12, 12) });
      for (let i = 0; i < 4; i++) api.push({ k: 'star4', x: x + rnd(-10, 10), y: y + rnd(-10, 10), vx: rnd(-40, 40), vy: rnd(-60, 0), g: 0, t: 0, life: .6, color: '#FFFFFF', r: rnd(4, 7) });
      return true;
    }
  };

  /* ================= ЗОЛОТО ================= */
  function goldBase(g, R, color, v) {
    const L = k => mix(color, 'w', k), D = k => mix(color, 'k', k);
    const lg = (a, b) => { const gr = g.createLinearGradient(0, -R, 0, R); gr.addColorStop(0, a); gr.addColorStop(.45, color); gr.addColorStop(.55, D(.28)); gr.addColorStop(1, b); return gr; };
    hexPath(g, 0, 0, R); g.fillStyle = lg(L(.65), L(.15)); g.fill();
    hexPath(g, 0, 0, R * .8); g.fillStyle = lg(D(.15), L(.45)); g.fill();
    hexPath(g, 0, 0, R * .74); g.fillStyle = lg(L(.5), D(.1)); g.fill();
    const emboss = (build, mode = 'fill') => {
      g.save(); g.translate(R * .025, R * .035); build(); g[mode === 'fill' ? 'fillStyle' : 'strokeStyle'] = 'rgba(70,45,0,.5)'; g[mode](); g.restore();
      g.save(); g.translate(-R * .02, -R * .025); build(); g[mode === 'fill' ? 'fillStyle' : 'strokeStyle'] = 'rgba(255,250,215,.65)'; g[mode](); g.restore();
      build(); g[mode === 'fill' ? 'fillStyle' : 'strokeStyle'] = color; g[mode]();
    };
    g.lineWidth = R * .05; g.lineCap = 'round';
    if (v === 1) { emboss(() => { g.beginPath(); g.arc(0, 0, R * .42, 0, TAU); }, 'stroke'); emboss(() => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * .12 : R * .28; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); }); }
    if (v === 2) emboss(() => { g.beginPath(); g.moveTo(-R * .42, R * .22); g.lineTo(R * .42, R * .22); g.lineTo(R * .28, -R * .2); g.lineTo(-R * .28, -R * .2); g.closePath(); });
    if (v === 3) emboss(() => { g.beginPath(); g.arc(-R * .18, 0, R * .2, -Math.PI * .2, Math.PI * 1.3); g.moveTo(R * .38, 0); g.arc(R * .18, 0, R * .2, 0, Math.PI * 1.5); g.moveTo(0, -R * .35); g.lineTo(0, R * .35); }, 'stroke');
    if (v === 4) emboss(() => { g.beginPath(); g.moveTo(-R * .38, R * .22); g.lineTo(-R * .42, -R * .22); g.lineTo(-R * .2, -R * .02); g.lineTo(0, -R * .32); g.lineTo(R * .2, -R * .02); g.lineTo(R * .42, -R * .22); g.lineTo(R * .38, R * .22); g.closePath(); });
    if (v === 5) { const rn = srng(55); for (let i = 0; i < 26; i++) { const x = (rn() - .5) * 1.3 * R, y = (rn() - .5) * 1.3 * R; g.fillStyle = 'rgba(80,50,0,.28)'; g.beginPath(); g.arc(x + R * .02, y + R * .02, R * .06, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,250,210,.4)'; g.beginPath(); g.arc(x - R * .01, y - R * .01, R * .045, 0, TAU); g.fill(); } }
    if (v === 6) { hexPath(g, 0, 0, R * .3); g.fillStyle = '#E8F4FF'; g.fill(); for (let i = 0; i < 6; i++) { const [x0, y0] = vert(i, R * .3), [x1, y1] = vert(i + 1, R * .3); g.beginPath(); g.moveTo(0, 0); g.lineTo(x0, y0); g.lineTo(x1, y1); g.closePath(); g.fillStyle = i % 2 ? 'rgba(120,170,230,.35)' : 'rgba(255,255,255,.55)'; g.fill(); } hexPath(g, 0, 0, R * .32); g.strokeStyle = D(.3); g.lineWidth = R * .04; g.stroke(); }
    if (v === 7) emboss(() => { g.beginPath(); g.arc(0, R * .05, R * .38, Math.PI * .75, Math.PI * 1.45); g.moveTo(R * .38 * Math.cos(Math.PI * .25), R * .05 + R * .38 * Math.sin(Math.PI * .25)); g.arc(0, R * .05, R * .38, Math.PI * .25, -Math.PI * .45, true); }, 'stroke');
    if (v === 8) [.55, .38, .2].forEach(r => emboss(() => hexPath(g, 0, 0, R * r), 'stroke'));
    if (v === 9) { g.save(); hexPath(g, 0, 0, R * .74); g.clip(); for (let i = -12; i <= 12; i++) { g.strokeStyle = i % 2 ? 'rgba(255,250,220,.22)' : 'rgba(90,60,0,.18)'; g.lineWidth = R * .02; g.beginPath(); g.moveTo(-R, i * R * .07); g.lineTo(R, i * R * .07); g.stroke(); } g.restore(); }
    hexPath(g, 0, 0, R); g.strokeStyle = D(.4); g.lineWidth = R * .05; g.stroke();
  }
  A.gold = {
    tile(c, R, color, o) {
      blit(c, sprite('gd' + color + o.v, R, (g, R) => goldBase(g, R, color, o.v)), R);
      sweep(c, R, o, 260, 20, 'rgba(255,250,215,.85)');
      twinkle(c, R, o, 1.7, .42);
    },
    breakFx(api, x, y, color) {
      for (let i = 0; i < 5; i++) api.push({ k: 'coin', x, y, vx: rnd(-150, 150), vy: rnd(-330, -150), g: 900, t: 0, life: rnd(.8, 1.2), color: '#FFD54A', r: rnd(5, 7), rot: rnd(0, TAU) });
      for (let i = 0; i < 6; i++) api.push({ k: 'star4', x: x + rnd(-12, 12), y: y + rnd(-12, 12), vx: rnd(-50, 50), vy: rnd(-80, -10), g: 0, t: 0, life: rnd(.5, .8), color: '#FFF6C8', r: rnd(4, 8) });
      return true;
    }
  };
})();
