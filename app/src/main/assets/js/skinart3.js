/* Скины «Пончики» и «Пруд кои»: 10 видов сот, живые детали, свой фон и эффект разрушения. */
(() => {
  'use strict';
  const HB = window.HB, K = HB.skins, A = K.art;
  const { hexPath, mix, srng, sprite, blit, star4 } = K;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const SPRINKLES = ['#FF5C8A', '#FFD23F', '#4ADE9C', '#4CC9F0', '#FFFFFF', '#B57BFF'];

  /* ================= ПОНЧИКИ ================= */
  function sprinkles(g, R, rn, n, rx, ry, oy = 0) {
    for (let i = 0; i < n; i++) {
      const a = rn() * TAU, d = Math.sqrt(rn());
      g.save(); g.translate(Math.cos(a) * d * rx, Math.sin(a) * d * ry + oy); g.rotate(rn() * 3);
      g.fillStyle = SPRINKLES[Math.floor(rn() * SPRINKLES.length)];
      g.fillRect(-R * .06, -R * .018, R * .12, R * .036);
      g.restore();
    }
  }
  function dessert(g, R, color, color2, v) {
    const rn = srng(v * 31 + 7);
    hexPath(g, 0, 0, R); const bg = g.createLinearGradient(0, -R, 0, R);
    bg.addColorStop(0, mix(color, 'w', .35)); bg.addColorStop(1, color);
    g.fillStyle = bg; g.fill();
    g.save(); hexPath(g, 0, 0, R); g.clip();
    g.fillStyle = 'rgba(255,255,255,.28)';
    for (let i = 0; i < 9; i++) { g.beginPath(); g.arc((rn() - .5) * 1.8 * R, (rn() - .5) * 1.8 * R, R * .05, 0, TAU); g.fill(); }
    g.restore();
    if (v <= 3) {
      const dough = g.createRadialGradient(-R * .15, -R * .2, R * .1, 0, 0, R * .7);
      dough.addColorStop(0, '#F3C58A'); dough.addColorStop(1, '#C98646');
      g.fillStyle = dough; g.beginPath(); g.arc(0, R * .04, R * .62, 0, TAU); g.fill();
      const glaze = [color2, '#6B3A1E', '#FFF4F8', mix(color2, 'w', .3)][v];
      g.fillStyle = glaze; g.beginPath();
      for (let i = 0; i <= 24; i++) { const a = i / 24 * TAU, r = R * (.54 + .05 * Math.sin(i * 2.7 + v)); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-R * .22, -R * .3, R * .18, R * .07, -.5, 0, TAU); g.fill();
      if (v !== 1) sprinkles(g, R, rn, 14, R * .45, R * .45);
      else { g.strokeStyle = '#FFF4F8'; g.lineWidth = R * .05; g.beginPath(); for (let i = 0; i < 7; i++) { const x = -R * .4 + i * R * .13; g.lineTo(x, (i % 2 ? -.2 : .2) * R); } g.stroke(); }
      g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(0, R * .04, R * .18, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over';
      g.fillStyle = mix(color, 'k', .15); g.beginPath(); g.arc(0, R * .04, R * .18, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(120,60,20,.35)'; g.lineWidth = R * .03; g.stroke();
    } else if (v === 4) {
      [[-.22, '#FFB3C7'], [.12, '#FFB3C7']].forEach(([y, c], i) => {
        const sg = g.createLinearGradient(0, y * R - R * .2, 0, y * R + R * .2); sg.addColorStop(0, mix(color2, 'w', .35)); sg.addColorStop(1, color2);
        g.fillStyle = sg; g.beginPath(); g.ellipse(0, y * R, R * .5, R * .2, 0, 0, TAU); g.fill();
        g.fillStyle = mix(color2, 'k', .12); g.fillRect(-R * .47, y * R + R * (i ? -.04 : .06), R * .94, R * .05);
      });
      g.fillStyle = '#FFF6EA'; g.beginPath(); g.ellipse(0, -R * .05, R * .46, R * .08, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(-R * .2, -R * .3, R * .15, R * .05, -.2, 0, TAU); g.fill();
    } else if (v === 5) {
      g.fillStyle = '#E8B84A'; g.beginPath(); g.moveTo(-R * .38, R * .02); g.lineTo(R * .38, R * .02); g.lineTo(R * .28, R * .58); g.lineTo(-R * .28, R * .58); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(160,110,30,.5)'; g.lineWidth = R * .03; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * R * .1, R * .04); g.lineTo(i * R * .08, R * .56); g.stroke(); }
      [[0, -.02, .42], [0, -.2, .33], [0, -.36, .2]].forEach(([x, y, r]) => { g.fillStyle = mix(color2, 'w', .2); g.beginPath(); g.ellipse(x, y * R, r * R, r * R * .45, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(-r * R * .3, y * R - r * R * .12, r * R * .35, r * R * .12, 0, 0, TAU); g.fill(); });
      sprinkles(g, R, rn, 8, R * .35, R * .14, -R * .1);
    } else if (v === 6) {
      g.fillStyle = '#FFF1DC'; g.beginPath(); g.moveTo(-R * .5, R * .35); g.lineTo(R * .5, R * .35); g.lineTo(R * .4, -R * .35); g.closePath(); g.fill();
      g.fillStyle = color2; g.fillRect(-R * .45, R * .02, R * .9, R * .08);
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.moveTo(-R * .5, R * .35); g.lineTo(R * .4, -R * .35); g.lineTo(R * .52, -R * .3); g.closePath(); g.fill();
      g.fillStyle = '#E63946'; g.beginPath(); g.arc(R * .42, -R * .42, R * .1, 0, TAU); g.fill();
    } else if (v === 7) {
      const cg = g.createRadialGradient(-R * .1, -R * .1, 0, 0, 0, R * .55); cg.addColorStop(0, '#E6B070'); cg.addColorStop(1, '#B77A3C');
      g.fillStyle = cg; g.beginPath(); g.arc(0, 0, R * .52, 0, TAU); g.fill();
      g.fillStyle = '#4A2A14'; for (let i = 0; i < 8; i++) { const a = rn() * TAU, d = rn() * R * .38; g.beginPath(); g.ellipse(Math.cos(a) * d, Math.sin(a) * d, R * .07, R * .05, rn() * 3, 0, TAU); g.fill(); }
    } else if (v === 8) {
      g.fillStyle = '#E3A857'; g.beginPath(); g.moveTo(-R * .25, R * .05); g.lineTo(R * .25, R * .05); g.lineTo(0, R * .75); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(150,90,30,.5)'; g.lineWidth = R * .025; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * R * .1 - R * .1, R * .08); g.lineTo(i * R * .05 + R * .1, R * .6); g.stroke(); }
      const ig = g.createRadialGradient(-R * .1, -R * .2, 0, 0, -R * .1, R * .35); ig.addColorStop(0, mix(color2, 'w', .45)); ig.addColorStop(1, color2);
      g.fillStyle = ig; g.beginPath(); g.arc(0, -R * .1, R * .32, 0, TAU); g.fill();
      g.beginPath(); for (let i = 0; i <= 8; i++) { const x = -R * .32 + i * R * .08; g.lineTo(x, R * .08 + (i % 2) * R * .07); } g.fill();
    } else {
      g.strokeStyle = '#FFFFFF'; g.lineWidth = R * .07; g.beginPath(); g.moveTo(0, R * .2); g.lineTo(0, R * .8); g.stroke();
      g.fillStyle = color2; g.beginPath(); g.arc(0, -R * .1, R * .4, 0, TAU); g.fill();
      g.strokeStyle = '#FFFFFF'; g.lineWidth = R * .09; g.beginPath(); for (let i = 0; i < 40; i++) { const a = i * .32, r = i * R * .0095; i ? g.lineTo(Math.cos(a) * r, -R * .1 + Math.sin(a) * r) : g.moveTo(0, -R * .1); } g.stroke();
    }
    hexPath(g, 0, 0, R * .965); g.lineWidth = R * .06; g.strokeStyle = 'rgba(255,255,255,.7)'; g.stroke();
  }
  const polka = { cv: null, w: 0, h: 0 };
  A.donut = {
    empty(c, R) { hexPath(c, 0, 0, R * .93); c.fillStyle = 'rgba(255,255,255,.08)'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = 'rgba(255,200,225,.2)'; c.stroke(); },
    tile(c, R, color, o, skin) {
      const a = o.board ? o.age : 99, t = o.t;
      const j = (a < 1.8 ? .2 * Math.exp(-5 * a) * Math.sin(a * 22) : 0) + o.rip * 2.2;
      c.translate(0, R * .8); c.scale(1 + j, 1 - j); c.translate(0, -R * .8);
      const idx = Math.max(0, skin.colors.indexOf(color)), color2 = skin.colors[(idx + 3) % 6];
      blit(c, sprite('dn' + color + o.v, R, (g, R) => dessert(g, R, color, color2, o.v)), R);
      const sp = Math.sin(t * 1.3 + o.seed * 5);
      if (sp > .94) { const k = (sp - .94) / .06; c.fillStyle = `rgba(255,255,255,${k})`; star4(c, R * .28, -R * .3, R * .2 * k); c.fill(); }
    },
    bg(c, w, h, info) {
      if (!polka.cv || polka.w !== w || polka.h !== h) {
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#5A2342'); gr.addColorStop(1, '#2E1024');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(255,190,220,.07)';
        for (let y = 0; y < h; y += 26) for (let x = (y / 26 % 2) * 13; x < w; x += 26) { g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill(); }
        polka.cv = cv; polka.w = w; polka.h = h;
      }
      c.drawImage(polka.cv, 0, 0);
      return true;
    },
    breakFx(api, x, y, color) {
      for (let i = 0; i < 10; i++) api.push({ k: 'conf', x, y, vx: rnd(-160, 160), vy: rnd(-320, -120), g: 600, t: 0, life: rnd(.9, 1.3), color: pick(SPRINKLES), r: rnd(3, 5), rot: rnd(0, TAU), vr: rnd(-14, 14) });
      for (let i = 0; i < 5; i++) api.push({ k: 'crumb', x, y, vx: rnd(-120, 120), vy: rnd(-220, -60), g: 800, t: 0, life: rnd(.6, .9), color: pick(['#E6B070', '#C98646', '#F3C58A']), r: rnd(2.5, 4.5), rot: rnd(0, TAU), vr: rnd(-10, 10) });
      for (let i = 0; i < 3; i++) api.push({ k: 'blob', x, y, vx: rnd(-90, 90), vy: rnd(-200, -80), g: 700, t: 0, life: .8, color: mix(color, 'w', .3), r: rnd(4, 6) });
      return true;
    }
  };

  /* ================= ПРУД КОИ ================= */
  const KOI = [
    ['#FFFFFF', '#FF5A1F'], ['#FF7A1A', '#FFFFFF'], ['#F5F1E8', '#1A1A1A'], ['#FFD24A', '#FFE9A0']
  ];
  function koiFish(c, x, y, s, ang, t, pat, seed) {
    c.save(); c.translate(x, y); c.rotate(ang);
    const wig = Math.sin(t * 9 + seed) * .35;
    c.fillStyle = pat[0];
    c.beginPath(); c.moveTo(-s * .45, 0);
    c.quadraticCurveTo(-s * .8, -s * .22 + wig * s * .2, -s * .95, -s * .18 + wig * s * .35);
    c.quadraticCurveTo(-s * .78, wig * s * .2, -s * .95, s * .18 + wig * s * .35);
    c.quadraticCurveTo(-s * .8, s * .22 + wig * s * .2, -s * .45, 0); c.fill();
    c.beginPath(); c.ellipse(0, 0, s * .52, s * .2, 0, 0, TAU); c.fill();
    c.globalAlpha *= .85;
    c.beginPath(); c.ellipse(-s * .05, -s * .17, s * .14, s * .07, -.6 + wig * .3, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(-s * .05, s * .17, s * .14, s * .07, .6 - wig * .3, 0, TAU); c.fill();
    c.globalAlpha /= .85;
    c.fillStyle = pat[1];
    c.beginPath(); c.ellipse(s * .12, -s * .02, s * .16, s * .11, .3, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(-s * .2, s * .04, s * .12, s * .09, -.2, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(s * .05, -s * .08, s * .3, s * .05, 0, 0, TAU); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(s * .38, -s * .07, s * .03, 0, TAU); c.arc(s * .38, s * .07, s * .03, 0, TAU); c.fill();
    c.restore();
  }
  function lily(c, x, y, r, flower, t, seed) {
    c.save(); c.translate(x, y); c.rotate(Math.sin(t * .4 + seed) * .08);
    c.fillStyle = '#3E8E41'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, .35, TAU - .05); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(20,70,25,.5)'; c.lineWidth = r * .05; for (let i = 0; i < 6; i++) { const a = .5 + i * .95; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * r * .9, Math.sin(a) * r * .9); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.ellipse(-r * .3, -r * .35, r * .35, r * .12, -.5, 0, TAU); c.fill();
    if (flower) {
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; c.fillStyle = i % 2 ? '#FFB6D2' : '#FF8FB8'; c.beginPath(); c.ellipse(Math.cos(a) * r * .3, Math.sin(a) * r * .3 - r * .1, r * .32, r * .14, a, 0, TAU); c.fill(); }
      c.fillStyle = '#FFE066'; c.beginPath(); c.arc(0, -r * .1, r * .14, 0, TAU); c.fill();
    }
    c.restore();
  }
  const pads = Array.from({ length: 9 }, () => ({ x: Math.random() * 360, y: Math.random() * 900, r: rnd(14, 26), s: rnd(2, 5), f: Math.random() < .4 }));
  A.koi = {
    empty(c, R) { hexPath(c, 0, 0, R * .93); c.fillStyle = 'rgba(8,40,44,.8)'; c.fill(); c.lineWidth = 1; c.strokeStyle = 'rgba(140,230,220,.1)'; c.stroke(); },
    tile(c, R, color, o) {
      const t = o.t, v = o.v, a = o.board ? o.age : 99, sf = (o.seed * .618) % 1;
      blit(c, sprite('ko' + color, R, (g, R) => {
        hexPath(g, 0, 0, R);
        const gr = g.createRadialGradient(-R * .2, -R * .3, R * .1, 0, 0, R * 1.1);
        gr.addColorStop(0, mix(color, 'w', .25)); gr.addColorStop(1, mix(color, 'k', .45));
        g.fillStyle = gr; g.fill();
        hexPath(g, 0, 0, R * .96); g.lineWidth = R * .06; g.strokeStyle = 'rgba(190,250,240,.35)'; g.stroke();
      }), R);
      c.save(); hexPath(c, 0, 0, R * .96); c.clip();
      c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(200,255,245,.1)'; c.lineWidth = R * .05;
      for (let j = 0; j < 2; j++) { c.beginPath(); for (let i = 0; i <= 8; i++) { const x = -R + i * R * .25, y = -R * .3 + j * R * .6 + Math.sin(x / R * 3 + t * 1.2 + j + o.seed) * R * .07; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
      c.globalCompositeOperation = 'source-over';
      if (v <= 3 || v === 9) {
        const sp = .35 + (o.seed % 3) * .08, ang = t * sp * (o.seed % 2 ? 1 : -1) + o.seed;
        const rr = R * .42, x = Math.cos(ang) * rr, y = Math.sin(ang) * rr * .8;
        const dir = ang + (o.seed % 2 ? Math.PI / 2 : -Math.PI / 2);
        c.fillStyle = 'rgba(0,20,25,.3)'; c.beginPath(); c.ellipse(x + R * .06, y + R * .1, R * .3, R * .1, dir, 0, TAU); c.fill();
        koiFish(c, x, y, R * .62, dir, t, v === 9 ? KOI[3] : KOI[v % 3], o.seed);
        if (v === 9) { const s = Math.sin(t * 2 + o.seed); if (s > .8) { c.fillStyle = `rgba(255,255,220,${(s - .8) * 5})`; star4(c, x, y - R * .1, R * .18); c.fill(); } }
      } else if (v === 4 || v === 5) lily(c, R * .05, R * .05, R * .5, v === 4, t, o.seed);
      else if (v === 6) {
        for (let i = 0; i < 2; i++) { const ang = t * .5 * (i ? 1 : -1) + i * 3 + o.seed; koiFish(c, Math.cos(ang) * R * .35, Math.sin(ang) * R * .3, R * .42, ang + (i ? Math.PI / 2 : -Math.PI / 2), t, KOI[i], o.seed + i); }
      } else if (v === 7) {
        for (let i = 0; i < 2; i++) { const ph = (t * .4 + i * .5 + sf) % 1; c.strokeStyle = `rgba(210,255,250,${.5 * (1 - ph)})`; c.lineWidth = R * .04; c.beginPath(); c.ellipse(0, 0, R * ph * .8, R * ph * .6, 0, 0, TAU); c.stroke(); }
        lily(c, -R * .3, R * .35, R * .25, false, t, o.seed);
      } else {
        lily(c, -R * .25, R * .25, R * .32, false, t, o.seed);
        c.fillStyle = '#FF8FB8'; c.beginPath(); c.ellipse(R * .2, -R * .15, R * .13, R * .24, .2 + Math.sin(t + o.seed) * .1, 0, TAU); c.fill();
        c.strokeStyle = '#3E8E41'; c.lineWidth = R * .04; c.beginPath(); c.moveTo(R * .22, R * .08); c.lineTo(R * .26, R * .5); c.stroke();
      }
      if (a < 1.2) { const p = a / 1.2; c.strokeStyle = `rgba(230,255,250,${.7 * (1 - p)})`; c.lineWidth = R * .05; c.beginPath(); c.ellipse(0, 0, R * (.2 + p * .8), R * (.15 + p * .6), 0, 0, TAU); c.stroke(); }
      c.restore();
    },
    bg(c, w, h, info) {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0E3338'); g.addColorStop(1, '#061A1D');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      const t = info.preview ? 0 : K.time();
      for (const p of pads) {
        if (p.y > h + 30) continue;
        c.globalAlpha = .45;
        lily(c, (p.x + t * p.s) % (w + 60) - 30, p.y, p.r, p.f, t, p.r);
      }
      c.globalAlpha = 1;
      return true;
    },
    breakFx(api, x, y, color) {
      for (let i = 0; i < 6; i++) api.push({ k: 'drop', x, y, vx: rnd(-110, 110), vy: rnd(-300, -130), g: 900, t: 0, life: rnd(.6, .9), color: i % 2 ? '#DFFBF7' : mix(color, 'w', .4), r: rnd(2.5, 4) });
      for (let i = 0; i < 5; i++) api.push({ k: 'petal', x, y, vx: 0, vy: rnd(-120, -40), g: 120, t: 0, life: rnd(1.2, 1.8), color: pick(['#FFB6D2', '#FF8FB8', '#FFE0EC']), r: rnd(3.5, 5.5), rot: rnd(0, TAU), vr: rnd(-4, 4) });
      api.push({ k: 'ripple', x, y, vx: 0, vy: 0, g: 0, t: 0, life: .9, color: '#DFFBF7', r: 26 });
      return true;
    }
  };

  /* ================= САКУРА ================= */
  const PINKS = ['#FFC4D6', '#FFB0C8', '#FF9EBB', '#FFD7E4', '#FFA6C1', '#FFBCD0'];
  /** Цветок сакуры: 5 лепестков с надрезом на кончике, градиент к центру, тычинки. */
  function blossom(c, x, y, r, rot, col, open = 1) {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(open, open);
    for (let i = 0; i < 5; i++) {
      c.save(); c.rotate(i * TAU / 5);
      const g = c.createLinearGradient(0, 0, 0, -r); g.addColorStop(0, '#FFF3F7'); g.addColorStop(1, col);
      c.fillStyle = g;
      c.beginPath(); c.moveTo(0, 0);
      c.bezierCurveTo(r * .55, -r * .25, r * .6, -r * .85, r * .18, -r);
      c.lineTo(0, -r * .86); c.lineTo(-r * .18, -r);
      c.bezierCurveTo(-r * .6, -r * .85, -r * .55, -r * .25, 0, 0); c.fill();
      c.strokeStyle = 'rgba(220,90,130,.25)'; c.lineWidth = r * .04; c.beginPath(); c.moveTo(0, -r * .15); c.lineTo(0, -r * .7); c.stroke();
      c.restore();
    }
    c.strokeStyle = '#E86A92'; c.lineWidth = r * .05;
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * TAU + .3;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * r * .38, Math.sin(a) * r * .38); c.stroke();
      c.fillStyle = '#FFE066'; c.beginPath(); c.arc(Math.cos(a) * r * .4, Math.sin(a) * r * .4, r * .06, 0, TAU); c.fill();
    }
    c.fillStyle = '#F7C948'; c.beginPath(); c.arc(0, 0, r * .12, 0, TAU); c.fill();
    c.restore();
  }
  function bud(c, x, y, r, rot) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.fillStyle = '#FF8FB0'; c.beginPath(); c.ellipse(0, -r * .4, r * .32, r * .5, 0, 0, TAU); c.fill();
    c.fillStyle = '#6FA35A'; c.beginPath(); c.moveTo(-r * .3, 0); c.quadraticCurveTo(0, -r * .3, r * .3, 0); c.quadraticCurveTo(0, r * .15, -r * .3, 0); c.fill();
    c.restore();
  }
  function twig(c, pts, w) {
    c.strokeStyle = '#6B3F3A'; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = w;
    c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
  }
  function petalShape(c, r) {
    c.beginPath(); c.moveTo(0, -r); c.bezierCurveTo(r, -r * .6, r * .7, r * .8, 0, r); c.bezierCurveTo(-r * .7, r * .8, -r, -r * .6, 0, -r); c.fill();
  }
  const skyPetals = Array.from({ length: 26 }, () => ({ x: Math.random() * 360, y: Math.random() * 900, s: rnd(12, 30), r: rnd(3, 6), p: rnd(0, TAU), c: pick(PINKS) }));
  A.sakura = {
    empty(c, R) { hexPath(c, 0, 0, R * .93); c.fillStyle = 'rgba(255,220,235,.08)'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = 'rgba(255,190,215,.18)'; c.stroke(); },
    tile(c, R, color, o) {
      const t = o.t, v = o.v, a = o.board ? o.age : 99, sf = (o.seed * .618) % 1;
      const pop = a < 1 ? 1 + .25 * Math.exp(-5 * a) * Math.sin(a * 16) : 1;
      const sw = Math.sin(t * 1.3 + o.seed) * .05 + o.rip * 5;
      blit(c, sprite('sk' + color, R, (g, R) => {
        hexPath(g, 0, 0, R);
        const gr = g.createLinearGradient(0, -R, 0, R); gr.addColorStop(0, mix(color, 'w', .45)); gr.addColorStop(1, color);
        g.fillStyle = gr; g.fill();
        g.save(); hexPath(g, 0, 0, R); g.clip();
        const rg = g.createRadialGradient(-R * .3, -R * .4, 0, -R * .3, -R * .4, R); rg.addColorStop(0, 'rgba(255,255,255,.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rg; g.fillRect(-R, -R, 2 * R, 2 * R);
        g.restore();
        hexPath(g, 0, 0, R * .96); g.lineWidth = R * .06; g.strokeStyle = 'rgba(255,255,255,.75)'; g.stroke();
      }), R);
      c.save(); hexPath(c, 0, 0, R * .96); c.clip();
      if (v === 0) blossom(c, 0, 0, R * .55 * pop, sw + o.seed, '#FF8FB0');
      else if (v === 1) {
        blossom(c, -R * .3, -R * .15, R * .32, sw, '#FFA3BF'); blossom(c, R * .28, -R * .25, R * .28, sw + 1, '#FF8FB0');
        blossom(c, 0, R * .3, R * .34 * pop, sw + 2, '#FFB6CB');
      } else if (v === 2) {
        c.save(); c.rotate(sw);
        twig(c, [[-R, R * .5], [-R * .3, R * .1], [R * .2, -R * .1], [R * .9, -R * .5]], R * .09);
        twig(c, [[-R * .3, R * .1], [-R * .2, -R * .35]], R * .05);
        blossom(c, R * .15, -R * .3, R * .26 * pop, 0, '#FF9EBB'); blossom(c, -R * .45, R * .35, R * .22, 1, '#FFB0C8');
        bud(c, -R * .2, -R * .4, R * .25, -.3); bud(c, R * .6, -R * .5, R * .22, .5);
        c.restore();
      } else if (v === 3) {
        for (let i = 0; i < 5; i++) {
          const ph = (t * .28 + i / 5 + sf) % 1, px = (i - 2) * R * .3 + Math.sin(t * 2 + i) * R * .15, py = -R + ph * 2 * R;
          c.save(); c.translate(px, py); c.rotate(t * 2 + i); c.scale(1, .4 + .6 * Math.abs(Math.cos(t * 3 + i)));
          c.fillStyle = PINKS[i % 6]; petalShape(c, R * .12);
          c.restore();
        }
      } else if (v === 4) {
        twig(c, [[0, R], [0, R * .2]], R * .06);
        bud(c, -R * .15, R * .1, R * .4 * pop, -.4 + sw); bud(c, R * .2, -R * .05, R * .45 * pop, .3 + sw);
      } else if (v === 5) {
        blossom(c, -R * .15, R * .15, R * .4, sw, '#FF9EBB');
        const bx = R * .35 + Math.sin(t * 1.4 + o.seed) * R * .12, by = -R * .35 + Math.cos(t * 1.9) * R * .08, flap = .3 + .7 * Math.abs(Math.sin(t * 12));
        c.save(); c.translate(bx, by);
        [-1, 1].forEach(sn => {
          c.save(); c.scale(sn * flap, 1);
          c.fillStyle = '#FFFFFF'; c.beginPath(); c.ellipse(R * .12, -R * .06, R * .14, R * .1, -.4, 0, TAU); c.fill();
          c.fillStyle = '#C9B8FF'; c.beginPath(); c.ellipse(R * .1, R * .06, R * .09, R * .07, .4, 0, TAU); c.fill();
          c.restore();
        });
        c.fillStyle = '#4A2A3A'; c.fillRect(-R * .015, -R * .12, R * .03, R * .22);
        c.restore();
      } else if (v === 6) {
        for (let i = 0; i < 10; i++) {
          const k = i / 10 * TAU, hx = 16 * Math.pow(Math.sin(k), 3), hy = -(13 * Math.cos(k) - 5 * Math.cos(2 * k) - 2 * Math.cos(3 * k));
          blossom(c, hx * R * .028, hy * R * .028, R * .13 * pop, k + t * .2, PINKS[i % 6]);
        }
      } else if (v === 7) {
        c.fillStyle = 'rgba(255,248,230,.9)'; c.beginPath(); c.arc(R * .25, -R * .25, R * .3, 0, TAU); c.fill();
        const mg = c.createRadialGradient(R * .25, -R * .25, R * .28, R * .25, -R * .25, R * .6);
        mg.addColorStop(0, 'rgba(255,248,230,.4)'); mg.addColorStop(1, 'rgba(255,248,230,0)');
        c.fillStyle = mg; c.beginPath(); c.arc(R * .25, -R * .25, R * .6, 0, TAU); c.fill();
        c.save(); c.rotate(sw * .5);
        twig(c, [[-R, R * .1], [-R * .2, R * .15], [R * .5, R * .5]], R * .06);
        blossom(c, -R * .35, R * .1, R * .2, 1, '#FF8FB0'); blossom(c, R * .15, R * .35, R * .18, 2, '#FFA6C1');
        c.restore();
      } else if (v === 8) {
        const swing = Math.sin(t * 1.5 + o.seed) * .12;
        c.save(); c.translate(0, -R * .75); c.rotate(swing);
        c.strokeStyle = '#4A2A3A'; c.lineWidth = R * .03; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, R * .3); c.stroke();
        c.save(); c.globalCompositeOperation = 'lighter';
        const lg = c.createRadialGradient(0, R * .72, 0, 0, R * .72, R * .7); lg.addColorStop(0, 'rgba(255,170,200,.6)'); lg.addColorStop(1, 'rgba(255,150,190,0)');
        c.fillStyle = lg; c.beginPath(); c.arc(0, R * .72, R * .7, 0, TAU); c.fill();
        c.restore();
        c.fillStyle = '#FF6F9A'; c.beginPath(); c.ellipse(0, R * .72, R * .3, R * .38, 0, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(160,30,70,.4)'; c.lineWidth = R * .02;
        [.4, .75].forEach(k => { c.beginPath(); c.ellipse(0, R * .72, R * .3 * k, R * .38, 0, 0, TAU); c.stroke(); });
        c.fillStyle = '#3A1E2E'; c.fillRect(-R * .12, R * .32, R * .24, R * .05); c.fillRect(-R * .12, R * 1.08, R * .24, R * .05);
        c.restore();
      } else {
        blossom(c, 0, 0, R * .42 * pop, sw * 2 + t * .1, '#FF9EBB');
        for (let i = 0; i < 3; i++) {
          const sp = Math.sin(t * 2.2 + i * 2.1 + o.seed);
          if (sp > .6) { c.fillStyle = `rgba(255,255,255,${(sp - .6) * 2.5})`; star4(c, Math.cos(i * 2.1) * R * .55, Math.sin(i * 2.1) * R * .5, R * .12); c.fill(); }
        }
      }
      c.restore();
    },
    bg(c, w, h, info) {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5B2A4E'); g.addColorStop(.6, '#3A1A36'); g.addColorStop(1, '#241022');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      const t = info.preview ? 1 : K.time();
      const mg = c.createRadialGradient(w * .78, h * .12, 0, w * .78, h * .12, w * .5);
      mg.addColorStop(0, 'rgba(255,190,215,.35)'); mg.addColorStop(1, 'rgba(255,190,215,0)');
      c.fillStyle = mg; c.fillRect(0, 0, w, h);
      if (!info.preview) {
        c.save(); c.globalAlpha = .55;
        twig(c, [[w + 10, h * .02], [w * .75, h * .08], [w * .55, h * .06], [w * .4, h * .12]], 7);
        twig(c, [[w * .75, h * .08], [w * .68, h * .16]], 4);
        [[w * .72, h * .06, 9], [w * .58, h * .05, 8], [w * .45, h * .11, 7], [w * .67, h * .16, 8], [w * .85, h * .04, 7]].forEach(([x, y, r], i) => blossom(c, x, y, r, i + Math.sin(t + i) * .1, PINKS[i]));
        c.restore();
        for (const p of skyPetals) {
          if (p.y > h + 20) continue;
          const y = ((p.y + t * p.s) % (h + 40)) - 20, x = (p.x + Math.sin(t * .8 + p.p) * 30 + t * 8) % (w + 20) - 10;
          c.save(); c.translate(x, y); c.rotate(t * 1.5 + p.p); c.scale(1, .35 + .65 * Math.abs(Math.cos(t * 2 + p.p))); c.globalAlpha = .7;
          c.fillStyle = p.c; petalShape(c, p.r);
          c.restore();
        }
      }
      return true;
    },
    breakFx(api, x, y) {
      for (let i = 0; i < 10; i++) api.push({ k: 'petal', soft: true, x, y, vx: 0, vy: rnd(-160, -40), g: 110, t: 0, life: rnd(1.3, 2), color: pick(PINKS), r: rnd(3.5, 6), rot: rnd(0, TAU), vr: rnd(-4, 4) });
      for (let i = 0; i < 4; i++) api.push({ k: 'star4', soft: true, x: x + rnd(-10, 10), y: y + rnd(-10, 10), vx: rnd(-30, 30), vy: rnd(-50, 0), g: 0, t: 0, life: .8, color: '#FFFFFF', r: rnd(3, 5) });
      return true;
    }
  };
})();
