/*
 * Новые анимированные скины: Облака, Светлячки, Витраж, Северное сияние, Киберпанк, Пламя.
 * Устроены так же, как в skinart.js: 10 видов сот, живые детали, свой фон и свой эффект разрушения.
 */
(() => {
  'use strict';
  const HB = window.HB, K = HB.skins, A = K.art;
  const { hexPath, mix, srng, sprite, blit, vert, star4 } = K;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);

  function sweepL(c, R, o, speed, width, color) {
    const pos = ((o.t * speed) % 1000) - 250, d = pos - (o.wx * .8 + o.wy * .6);
    if (Math.abs(d) > R * 2.4) return;
    c.save(); hexPath(c, 0, 0, R); c.clip();
    c.globalCompositeOperation = 'lighter';
    c.rotate(Math.atan2(.6, .8));
    const gr = c.createLinearGradient(d - width, 0, d + width, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, color); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(d - width, -R * 2, width * 2, R * 4);
    c.restore();
  }
  function twinkleL(c, R, o, freq, size) {
    const sp = Math.sin(o.t * freq + o.seed * 3.7);
    if (sp < .9) return;
    const k = (sp - .9) / .1, rn = srng(o.seed + Math.floor(o.t * freq / TAU));
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(255,255,255,${k})`;
    star4(c, (rn() - .5) * R, (rn() - .5) * R, R * size * k); c.fill();
    c.restore();
  }
  function glowDot(c, x, y, r, col, a) {
    if (a <= .01) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 4, 0, TAU); c.fill();
    c.fillStyle = `rgba(255,255,230,${a})`; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.restore();
  }

  /* ================= ОБЛАКА ================= */
  function puffCloud(c, x, y, s, shade = 'rgba(175,195,235,.95)', white = '#FFFFFF') {
    const P = [[-.5, .1, .33], [-.18, -.14, .42], [.22, -.06, .38], [.52, .12, .28], [0, .14, .38]];
    c.fillStyle = shade; P.forEach(([px, py, r]) => { c.beginPath(); c.arc(x + px * s, y + py * s + s * .08, r * s, 0, TAU); c.fill(); });
    c.fillStyle = white; P.forEach(([px, py, r]) => { c.beginPath(); c.arc(x + px * s, y + py * s, r * s * .96, 0, TAU); c.fill(); });
  }
  const skyClouds = Array.from({ length: 7 }, (_, i) => ({ x: Math.random() * 400, y: 40 + i * 110 + Math.random() * 40, s: rnd(30, 70), v: rnd(4, 12), a: rnd(.35, .8) }));
  A.clouds = {
    empty(c, R) { hexPath(c, 0, 0, R * .93); c.fillStyle = 'rgba(255,255,255,.2)'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = 'rgba(255,255,255,.4)'; c.stroke(); },
    tile(c, R, color, o) {
      const t = o.t, a = o.board ? o.age : 99, v = o.v, sf = (o.seed * .618) % 1;
      const j = a < 1.5 ? .2 * Math.exp(-4.5 * a) * Math.sin(a * 16) : 0;
      hexPath(c, 0, 0, R);
      const g = c.createLinearGradient(0, -R, 0, R);
      g.addColorStop(0, mix(color, 'k', v === 7 ? .45 : .05)); g.addColorStop(1, mix(color, 'w', v === 7 ? .1 : .5));
      c.fillStyle = g; c.fill();
      c.save(); hexPath(c, 0, 0, R); c.clip();
      const dx = Math.sin(t * .45 + o.seed) * R * .1;
      c.save(); c.translate(0, R * .1); c.scale(1 + j, 1 - j); c.translate(0, -R * .1);
      if (v === 0) puffCloud(c, dx, R * .12, R * .62);
      else if (v === 1) { puffCloud(c, -R * .3 + dx, -R * .25, R * .35); puffCloud(c, R * .25 - dx, R * .3, R * .42); }
      else if (v === 2) {
        c.save(); c.translate(R * .25, -R * .25); c.rotate(t * .3); c.strokeStyle = 'rgba(255,220,90,.9)'; c.lineWidth = R * .05;
        for (let i = 0; i < 8; i++) { c.rotate(TAU / 8); c.beginPath(); c.moveTo(R * .26, 0); c.lineTo(R * .38, 0); c.stroke(); }
        c.restore();
        c.fillStyle = '#FFD84D'; c.beginPath(); c.arc(R * .25, -R * .25, R * .22, 0, TAU); c.fill();
        puffCloud(c, -R * .1 + dx, R * .2, R * .48);
      } else if (v === 3) {
        puffCloud(c, dx, -R * .12, R * .55, 'rgba(90,100,130,.95)', '#B7C0D6');
        c.strokeStyle = 'rgba(120,190,255,.9)'; c.lineWidth = R * .04; c.lineCap = 'round';
        for (let i = 0; i < 6; i++) { const ph = (t * 1.4 + i / 6 + sf) % 1, x = (i - 2.5) * R * .16 + dx, y = R * .15 + ph * R * .8; c.beginPath(); c.moveTo(x, y); c.lineTo(x - R * .04, y + R * .12); c.stroke(); }
      } else if (v === 4) {
        c.lineWidth = R * .08;
        ['#FF5E5E', '#FFB84D', '#FFE34D', '#5EE07A', '#4DB8FF', '#9A7BFF'].forEach((col, i) => { c.strokeStyle = col; c.beginPath(); c.arc(0, R * .55, R * (.7 - i * .08), Math.PI, TAU); c.stroke(); });
        puffCloud(c, -R * .45 + dx * .5, R * .4, R * .26); puffCloud(c, R * .5 - dx * .5, R * .42, R * .24);
      } else if (v === 5) {
        puffCloud(c, dx, R * .35, R * .4);
        const fl = Math.sin(t * 8 + o.seed) * R * .05;
        c.strokeStyle = '#2A3550'; c.lineWidth = R * .045; c.lineCap = 'round';
        [[-.2, -.3, .13], [.15, -.45, .1]].forEach(([x, y, s]) => {
          const bx = x * R + Math.sin(t * .8 + o.seed) * R * .1;
          c.beginPath(); c.moveTo(bx - s * R, y * R - fl); c.quadraticCurveTo(bx - s * R * .4, y * R - fl * .3, bx, y * R + R * .03);
          c.quadraticCurveTo(bx + s * R * .4, y * R - fl * .3, bx + s * R, y * R - fl); c.stroke();
        });
      } else if (v === 6) {
        const by = Math.sin(t * 1.2 + o.seed) * R * .08;
        c.fillStyle = '#FF6B6B'; c.beginPath(); c.arc(0, -R * .2 + by, R * .3, 0, TAU); c.fill();
        c.fillStyle = '#FFD84D'; c.beginPath(); c.ellipse(0, -R * .2 + by, R * .12, R * .3, 0, 0, TAU); c.fill();
        c.strokeStyle = '#6B4B2A'; c.lineWidth = R * .02;
        c.beginPath(); c.moveTo(-R * .2, -R * .02 + by); c.lineTo(-R * .08, R * .2 + by); c.moveTo(R * .2, -R * .02 + by); c.lineTo(R * .08, R * .2 + by); c.stroke();
        c.fillStyle = '#8B5A2B'; c.fillRect(-R * .09, R * .2 + by, R * .18, R * .12);
        puffCloud(c, R * .35 - dx, R * .5, R * .25);
      } else if (v === 7) {
        c.fillStyle = '#FFF6D5'; c.beginPath(); c.arc(-R * .15, -R * .2, R * .28, 0, TAU); c.fill();
        c.fillStyle = mix(color, 'k', .45); c.beginPath(); c.arc(-R * .02, -R * .28, R * .24, 0, TAU); c.fill();
        for (let i = 0; i < 4; i++) { const tw = .5 + .5 * Math.sin(t * 2 + i * 2); c.fillStyle = `rgba(255,255,255,${.4 + .6 * tw})`; star4(c, (i * .3 - .2) * R, (i % 2 ? .1 : -.5) * R + R * .1, R * .06 * tw + R * .02); c.fill(); }
        puffCloud(c, R * .2 + dx, R * .4, R * .32, 'rgba(120,130,170,.9)', '#DDE3F5');
      } else if (v === 8) {
        const sw = Math.sin(t * 2 + o.seed);
        c.save(); c.translate(R * .15, -R * .2); c.rotate(.3 + sw * .1);
        c.fillStyle = '#FF5E9A'; c.beginPath(); c.moveTo(0, -R * .25); c.lineTo(R * .18, 0); c.lineTo(0, R * .25); c.lineTo(-R * .18, 0); c.closePath(); c.fill();
        c.strokeStyle = '#FFE34D'; c.lineWidth = R * .02; c.beginPath(); c.moveTo(0, -R * .25); c.lineTo(0, R * .25); c.moveTo(-R * .18, 0); c.lineTo(R * .18, 0); c.stroke();
        c.restore();
        c.strokeStyle = '#FFFFFF'; c.lineWidth = R * .025; c.beginPath(); c.moveTo(R * .1, R * .02);
        for (let i = 1; i <= 6; i++) c.lineTo(R * .1 - i * R * .08, R * .02 + i * R * .08 + Math.sin(t * 5 + i) * R * .04);
        c.stroke();
        puffCloud(c, -R * .3 + dx, R * .45, R * .25);
      } else {
        puffCloud(c, dx, -R * .12, R * .52, 'rgba(160,175,210,.95)', '#EEF3FF');
        c.fillStyle = '#FFFFFF';
        for (let i = 0; i < 6; i++) { const ph = (t * .5 + i / 6 + sf) % 1, x = (i - 2.5) * R * .17 + Math.sin(t * 2 + i) * R * .05; c.beginPath(); c.arc(x, R * .15 + ph * R * .75, R * .04, 0, TAU); c.fill(); }
      }
      c.restore();
      c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-R, -R, 2 * R, R * .35);
      c.restore();
      hexPath(c, 0, 0, R * .96); c.lineWidth = R * .07; c.strokeStyle = 'rgba(255,255,255,.75)'; c.stroke();
    },
    bg(c, w, h, info) {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2F7BE0'); g.addColorStop(.6, '#79B8F5'); g.addColorStop(1, '#CDE8FF');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      const t = info.preview ? 0 : K.time();
      const sg = c.createRadialGradient(w * .85, h * .08, 0, w * .85, h * .08, w * .6);
      sg.addColorStop(0, 'rgba(255,250,210,.8)'); sg.addColorStop(1, 'rgba(255,250,210,0)');
      c.fillStyle = sg; c.fillRect(0, 0, w, h);
      for (const cl of skyClouds) {
        if (cl.y > h) continue;
        c.globalAlpha = cl.a * .6;
        puffCloud(c, ((cl.x + t * cl.v) % (w + 160)) - 80, cl.y, cl.s, 'rgba(200,220,245,1)', '#FFFFFF');
      }
      c.globalAlpha = 1;
      return true;
    },
    breakFx(api, x, y) {
      for (let i = 0; i < 7; i++) api.push({ k: 'puff', x: x + rnd(-8, 8), y: y + rnd(-8, 8), vx: rnd(-70, 70), vy: rnd(-80, 20), g: -10, t: 0, life: rnd(.6, 1), color: '#FFFFFF', r: rnd(5, 9) });
      for (let i = 0; i < 4; i++) api.push({ k: 'drop', x, y, vx: rnd(-60, 60), vy: rnd(-120, 0), g: 700, t: 0, life: .8, color: '#9FD2FF', r: rnd(2, 3) });
      return true;
    }
  };

  /* ================= СВЕТЛЯЧКИ ================= */
  const flies = Array.from({ length: 34 }, () => ({ x: Math.random() * 360, y: Math.random() * 800, p: rnd(0, TAU), sp: rnd(.3, .8) }));
  const YEL = '255,230,120', CYA = '110,250,255';
  A.fireflies = {
    empty(c, R) { hexPath(c, 0, 0, R * .93); c.fillStyle = '#10231C'; c.fill(); c.lineWidth = 1; c.strokeStyle = 'rgba(180,255,200,.07)'; c.stroke(); },
    tile(c, R, color, o) {
      const t = o.t, v = o.v, a = o.board ? o.age : 99, boost = a < 1 ? 1 + 1.5 * Math.exp(-4 * a) : 1, sf = (o.seed * .618) % 1;
      blit(c, sprite('ff' + color, R, (g, R) => {
        hexPath(g, 0, 0, R);
        const gr = g.createLinearGradient(0, -R, 0, R); gr.addColorStop(0, mix(color, 'w', .08)); gr.addColorStop(1, mix(color, 'k', .55));
        g.fillStyle = gr; g.fill(); g.save(); g.clip();
        const rn = srng(3);
        for (let i = 0; i < 10; i++) { g.fillStyle = rn() < .5 ? 'rgba(120,200,110,.35)' : 'rgba(0,0,0,.18)'; g.beginPath(); g.arc((rn() - .5) * 1.8 * R, -R * .7 + rn() * R * .35, R * (.08 + rn() * .1), 0, TAU); g.fill(); }
        g.restore();
        hexPath(g, 0, 0, R * .97); g.lineWidth = R * .05; g.strokeStyle = 'rgba(160,230,170,.25)'; g.stroke();
      }), R);
      if (v === 0) {
        c.strokeStyle = 'rgba(220,240,255,.55)'; c.lineWidth = R * .05;
        c.beginPath(); c.moveTo(-R * .25, -R * .3); c.lineTo(-R * .28, R * .45); c.quadraticCurveTo(0, R * .55, R * .28, R * .45); c.lineTo(R * .25, -R * .3); c.stroke();
        c.fillStyle = '#8B6A3E'; c.fillRect(-R * .28, -R * .42, R * .56, R * .12);
        glowDot(c, Math.sin(t * 2.3 + o.seed) * R * .12, Math.cos(t * 3.1 + o.seed) * R * .18 + R * .05, R * .06, YEL, (.6 + .4 * Math.sin(t * 6 + o.seed)) * Math.min(1, .7 * boost));
      } else if (v === 1) {
        [[-.25, .3, .18], [.15, .15, .22], [.35, .4, .12]].forEach(([x, y, s], i) => {
          const p = (.6 + .4 * Math.sin(t * 1.8 + i + o.seed)) * Math.min(1.4, boost);
          c.fillStyle = '#D8F3F0'; c.fillRect(x * R - R * .03, y * R, R * .06, R * .3);
          c.save(); c.globalCompositeOperation = 'lighter';
          const g = c.createRadialGradient(x * R, y * R, 0, x * R, y * R, s * R * 2.2);
          g.addColorStop(0, `rgba(${CYA},${.5 * p})`); g.addColorStop(1, `rgba(${CYA},0)`);
          c.fillStyle = g; c.beginPath(); c.arc(x * R, y * R, s * R * 2.2, 0, TAU); c.fill();
          c.restore();
          c.fillStyle = `rgba(120,255,255,${.7 + .2 * p})`; c.beginPath(); c.ellipse(x * R, y * R, s * R, s * R * .6, 0, Math.PI, TAU); c.fill();
        });
      } else if (v === 2) {
        c.strokeStyle = '#4FA85A'; c.lineWidth = R * .05;
        for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(0, R * .6); c.quadraticCurveTo(i * R * .15, R * .1, i * R * .3 + Math.sin(t + i) * R * .03 + o.rip * R * 3, -R * .2); c.stroke(); }
        for (let i = 0; i < 2; i++) { const a2 = t * 1.3 + i * Math.PI + o.seed; glowDot(c, Math.cos(a2) * R * .4, Math.sin(a2) * R * .25 - R * .1, R * .05, YEL, .5 + .5 * Math.sin(t * 7 + i)); }
      } else if (v === 3) {
        [[-.3, -.2, .08], [.1, -.35, .06], [.3, .05, .09], [-.1, .25, .07]].forEach(([x, y, s], i) => {
          c.fillStyle = 'rgba(200,240,255,.35)'; c.beginPath(); c.arc(x * R, y * R, s * R, 0, TAU); c.fill();
          const gl = Math.max(0, Math.sin(t * 1.5 + i * 1.9 + o.seed) - .7) * 3;
          c.fillStyle = `rgba(255,255,255,${.5 + gl * .5})`; c.beginPath(); c.arc(x * R - s * R * .3, y * R - s * R * .3, s * R * .35, 0, TAU); c.fill();
          if (gl > 0) { c.fillStyle = `rgba(255,255,255,${Math.min(1, gl)})`; star4(c, x * R, y * R, s * R * 2 * gl); c.fill(); }
        });
      } else if (v === 4) {
        c.fillStyle = '#08130E'; c.beginPath(); c.ellipse(0, 0, R * .45, R * .38, 0, 0, TAU); c.fill();
        if (((t * .4 + sf) % 1) >= .05) {
          [-1, 1].forEach(s => { glowDot(c, s * R * .16, -R * .02, R * .09, YEL, .9); c.fillStyle = '#1A1000'; c.beginPath(); c.arc(s * R * .16 + Math.sin(t * .7) * R * .03, -R * .02, R * .04, 0, TAU); c.fill(); });
        } else {
          c.strokeStyle = '#E8C860'; c.lineWidth = R * .03;
          [-1, 1].forEach(s => { c.beginPath(); c.moveTo(s * R * .16 - R * .08, -R * .02); c.lineTo(s * R * .16 + R * .08, -R * .02); c.stroke(); });
        }
      } else if (v === 5) {
        const p = .7 + .3 * Math.sin(t * 1.2 + o.seed);
        c.save(); c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(0, 0, 0, 0, 0, R * .6); g.addColorStop(0, `rgba(230,240,255,${Math.min(.9, .45 * p * boost)})`); g.addColorStop(1, 'rgba(230,240,255,0)');
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, R * .6, 0, TAU); c.fill();
        c.restore();
        for (let i = 0; i < 6; i++) { const a2 = i * TAU / 6 + t * .1; c.fillStyle = 'rgba(245,248,255,.92)'; c.beginPath(); c.ellipse(Math.cos(a2) * R * .18, Math.sin(a2) * R * .18, R * .17, R * .08, a2, 0, TAU); c.fill(); }
        c.fillStyle = '#FFE27A'; c.beginPath(); c.arc(0, 0, R * .08, 0, TAU); c.fill();
      } else if (v === 6) {
        c.save(); c.translate(0, -R * .55); c.rotate(Math.sin(t * 1.6 + o.seed) * .15);
        c.strokeStyle = '#2A1A10'; c.lineWidth = R * .03; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, R * .3); c.stroke();
        c.save(); c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(0, R * .6, 0, 0, R * .6, R * .6); g.addColorStop(0, `rgba(255,140,60,${Math.min(.8, .5 * boost)})`); g.addColorStop(1, 'rgba(255,100,40,0)');
        c.fillStyle = g; c.beginPath(); c.arc(0, R * .6, R * .6, 0, TAU); c.fill();
        c.restore();
        c.fillStyle = '#E0482E'; c.beginPath(); c.ellipse(0, R * .6, R * .24, R * .3, 0, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(120,20,10,.5)'; c.lineWidth = R * .02;
        [.3, .7].forEach(k => { c.beginPath(); c.ellipse(0, R * .6, R * .24 * k, R * .3, 0, 0, TAU); c.stroke(); });
        c.fillStyle = 'rgba(255,210,122,.6)'; c.beginPath(); c.ellipse(0, R * .6, R * .1, R * .18, 0, 0, TAU); c.fill();
        c.restore();
      } else if (v === 7) {
        const p = (.5 + .5 * Math.sin(t * 2 + o.seed)) * Math.min(1.4, boost), rn = srng(o.v * 11 + o.seed);
        c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
        c.beginPath(); let x = (rn() - .5) * R * .4, y = -R * .35; c.moveTo(x, y);
        for (let i = 0; i < 4; i++) { x += (rn() - .5) * R * .5; y += R * .18; c.lineTo(x, y); }
        c.moveTo(-R * .2, 0); c.lineTo(R * .2, 0);
        c.strokeStyle = `rgba(${CYA},${.12 * p})`; c.lineWidth = R * .16; c.stroke();
        c.strokeStyle = `rgba(${CYA},${Math.min(1, .3 + .5 * p)})`; c.lineWidth = R * .06; c.stroke();
        c.restore();
      } else if (v === 8) {
        for (let i = 0; i < 4; i++) { const a2 = t * (.8 + i * .2) + i * 1.6 + o.seed; glowDot(c, Math.cos(a2) * R * .35, Math.sin(a2 * 1.3) * R * .3, R * .045, YEL, .5 + .5 * Math.sin(t * 8 + i * 2)); }
      } else {
        c.fillStyle = '#F2E6C8'; c.fillRect(-R * .08, -R * .05, R * .16, R * .45);
        const fl = Math.sin(t * 14 + o.seed) * .15;
        c.save(); c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(0, -R * .2, 0, 0, -R * .2, R * .55); g.addColorStop(0, `rgba(255,200,100,${Math.min(.8, .55 * boost)})`); g.addColorStop(1, 'rgba(255,160,60,0)');
        c.fillStyle = g; c.beginPath(); c.arc(0, -R * .2, R * .55, 0, TAU); c.fill();
        c.fillStyle = '#FFD36B'; c.beginPath(); c.ellipse(fl * R * .1, -R * .2, R * .07, R * .14 * (1 + fl), 0, 0, TAU); c.fill();
        c.fillStyle = '#FFFFFF'; c.beginPath(); c.ellipse(fl * R * .05, -R * .17, R * .03, R * .06, 0, 0, TAU); c.fill();
        c.restore();
      }
    },
    bg(c, w, h, info) {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0A1226'); g.addColorStop(1, '#0E2A22');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      const t = info.preview ? 1 : K.time();
      const mx = w * .8, my = h * .1, mr = Math.min(w, h) * .07;
      const mg = c.createRadialGradient(mx, my, mr * .5, mx, my, mr * 4); mg.addColorStop(0, 'rgba(220,235,255,.35)'); mg.addColorStop(1, 'rgba(220,235,255,0)');
      c.fillStyle = mg; c.fillRect(0, 0, w, h);
      c.fillStyle = '#EEF3FF'; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill();
      c.fillStyle = '#07100C';
      for (let i = 0; i < 9; i++) { const x = (i * 47) % w, s = h * (.18 + (i % 3) * .05); c.beginPath(); c.moveTo(x - s * .25, h); c.lineTo(x, h - s); c.lineTo(x + s * .25, h); c.fill(); }
      for (const f of flies) {
        if (f.y > h) continue;
        const a = Math.max(0, Math.sin(t * 2 * f.sp + f.p * 3));
        glowDot(c, (f.x + Math.sin(t * f.sp + f.p) * 30) % w, f.y + Math.cos(t * f.sp * .8 + f.p) * 25, 1.6, '230,255,120', a * .9);
      }
      return true;
    },
    breakFx(api, x, y) {
      for (let i = 0; i < 9; i++) api.push({ k: 'firefly', x, y, vx: rnd(-120, 120), vy: rnd(-160, -20), g: 0, t: 0, life: rnd(1, 1.8), color: 'rgba(230,255,130,1)', r: rnd(1.5, 2.6) });
      for (let i = 0; i < 3; i++) api.push({ k: 'leaf', x, y, vx: rnd(-80, 80), vy: rnd(-160, -60), g: 220, t: 0, life: 1.2, color: '#3E8A4A', r: rnd(3, 5), rot: rnd(0, TAU), vr: rnd(-6, 6) });
      return true;
    }
  };

  /* ================= ВИТРАЖ ================= */
  function vitrageCut(g, R, c1, c2, c3, v) {
    const segs = [], V = (i, r = R * .9) => vert(i, r);
    const poly = pts => () => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
    const circ = (x, y, r) => () => { g.beginPath(); g.arc(x, y, r, 0, TAU); };
    const base = col => segs.push([() => hexPath(g, 0, 0, R * .9), col]);
    if (v === 0) for (let i = 0; i < 6; i++) segs.push([poly([[0, 0], V(i), V(i + 1)]), i % 2 ? c2 : c1]);
    else if (v === 1) { base(c3); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; segs.push([circ(Math.cos(a) * R * .42, Math.sin(a) * R * .42, R * .26), c1]); } segs.push([circ(0, 0, R * .22), c2]); }
    else if (v === 2) { base(c1); segs.push([poly([[-R * .14, -R * .9], [R * .14, -R * .9], [R * .14, R * .9], [-R * .14, R * .9]]), c2]); segs.push([poly([[-R * .8, -R * .14], [R * .8, -R * .14], [R * .8, R * .14], [-R * .8, R * .14]]), c2]); segs.push([circ(0, 0, R * .2), c3]); }
    else if (v === 3) { const s = R * .34; for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) segs.push([poly([[x * s, y * s - s / 2], [x * s + s / 2, y * s], [x * s, y * s + s / 2], [x * s - s / 2, y * s]]), (x + y) % 2 ? c1 : c2]); }
    else if (v === 4) [[.9, c1], [.62, c2], [.36, c3], [.14, c1]].forEach(([k, col]) => segs.push([() => hexPath(g, 0, 0, R * k), col]));
    else if (v === 5) { base(c2); for (let i = 0; i < 12; i++) { const a0 = i * TAU / 12, a1 = a0 + TAU / 24; segs.push([poly([[Math.cos(a0) * R * .25, Math.sin(a0) * R * .25], [Math.cos(a0 + TAU / 48) * R * .95, Math.sin(a0 + TAU / 48) * R * .95], [Math.cos(a1) * R * .25, Math.sin(a1) * R * .25]]), c3]); } segs.push([circ(0, 0, R * .25), c1]); }
    else if (v === 6) { base(c3); [0, 1, 2].forEach(i => { const a = -Math.PI / 2 + i * TAU / 3; segs.push([() => { g.beginPath(); g.ellipse(Math.cos(a) * R * .3, Math.sin(a) * R * .3, R * .34, R * .16, a, 0, TAU); }, i === 0 ? c1 : c2]); }); segs.push([circ(0, 0, R * .12), c1]); }
    else if (v === 7) { segs.push([poly([V(5), V(0), V(1), V(2)]), c1]); segs.push([poly([V(2), V(3), V(4), V(5)]), c2]); segs.push([circ(R * .1, -R * .1, R * .24), c3]); }
    else if (v === 8) { base(c2); segs.push([() => { g.beginPath(); for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + i * Math.PI / 6, r = i % 2 ? R * .3 : R * .72; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); }, c1]); segs.push([circ(0, 0, R * .16), c3]); }
    else { const rn = srng(77), cx = (rn() - .5) * R * .4, cy = (rn() - .5) * R * .4, cols = [c1, c2, c3]; for (let i = 0; i < 6; i++) segs.push([poly([[cx, cy], V(i), V(i + 1)]), cols[i % 3]]); }
    g.save(); hexPath(g, 0, 0, R * .9); g.clip();
    segs.forEach(([p, col]) => {
      p();
      const gr = g.createRadialGradient(-R * .2, -R * .25, 0, 0, 0, R * 1.1);
      gr.addColorStop(0, mix(col, 'w', .45)); gr.addColorStop(.6, col); gr.addColorStop(1, mix(col, 'k', .35));
      g.fillStyle = gr; g.fill();
      g.lineWidth = R * .07; g.strokeStyle = '#1A1A1A'; g.stroke();
    });
    const rn = srng(v + 5);
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(255,255,255,${.05 + rn() * .08})`; g.beginPath(); g.ellipse((rn() - .5) * 1.6 * R, (rn() - .5) * 1.6 * R, R * .12, R * .04, rn() * 3, 0, TAU); g.fill(); }
    g.restore();
    hexPath(g, 0, 0, R * .95); g.lineWidth = R * .12; g.strokeStyle = '#2A2522'; g.stroke();
    g.lineWidth = R * .03; g.strokeStyle = 'rgba(255,230,180,.25)'; g.stroke();
  }
  const vit = { stone: null, w: 0, h: 0, motes: Array.from({ length: 40 }, () => ({ x: Math.random() * 360, y: Math.random() * 800, s: rnd(3, 8), p: rnd(0, TAU) })) };
  function stoneWall(w, h) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#241C17'); gr.addColorStop(1, '#0E0A08');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2;
    const bh = 26;
    for (let y = 0; y < h; y += bh) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
      for (let x = ((y / bh) % 2) * 30; x < w; x += 60) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + bh); g.stroke(); }
    }
    g.fillStyle = 'rgba(255,255,255,.03)';
    for (let i = 0; i < 300; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    return cv;
  }
  A.vitrage = {
    empty(c, R) { hexPath(c, 0, 0, R * .93); c.fillStyle = '#1E1814'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = 'rgba(0,0,0,.5)'; c.stroke(); },
    tile(c, R, color, o, skin) {
      const idx = Math.max(0, skin.colors.indexOf(color)), c2 = skin.colors[(idx + 2) % 6], c3 = skin.colors[(idx + 4) % 6];
      blit(c, sprite('vt' + color + o.v, R, (g, R) => vitrageCut(g, R, color, c2, c3, o.v)), R);
      const light = .5 + .5 * Math.sin(o.t * .35 - o.wx * .012 + o.wy * .004);
      c.save(); hexPath(c, 0, 0, R * .9); c.clip(); c.globalCompositeOperation = 'lighter';
      c.fillStyle = color; c.globalAlpha *= .22 * light; c.fillRect(-R, -R, 2 * R, 2 * R);
      c.restore();
      sweepL(c, R, o, 150, 16, 'rgba(255,240,200,.6)');
    },
    bg(c, w, h, info) {
      if (!vit.stone || vit.w !== w || vit.h !== h) { vit.stone = stoneWall(w, h); vit.w = w; vit.h = h; }
      c.drawImage(vit.stone, 0, 0);
      const t = info.preview ? 2 : K.time();
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const x0 = w * (.15 + i * .3) + Math.sin(t * .2 + i) * 20, a = .1 + .05 * Math.sin(t * .5 + i * 2);
        const gr = c.createLinearGradient(x0, 0, x0 + w * .35, h);
        gr.addColorStop(0, `rgba(255,230,170,${a})`); gr.addColorStop(1, 'rgba(255,230,170,0)');
        c.fillStyle = gr;
        c.beginPath(); c.moveTo(x0 - 20, 0); c.lineTo(x0 + 40, 0); c.lineTo(x0 + w * .45, h); c.lineTo(x0 + w * .2, h); c.closePath(); c.fill();
      }
      if (!info.preview) for (const m of vit.motes) {
        const y = ((m.y - t * m.s) % h + h) % h, x = m.x + Math.sin(t * .5 + m.p) * 10;
        c.fillStyle = `rgba(255,235,190,${.25 + .25 * Math.sin(t + m.p)})`; c.fillRect(x, y, 1.5, 1.5);
      }
      c.restore();
      return true;
    },
    breakFx(api, x, y, color) {
      for (let i = 0; i < 9; i++) api.push({ k: 'tri', x, y, vx: rnd(-190, 190), vy: rnd(-280, -60), g: 800, t: 0, life: rnd(.6, 1), color: i % 3 ? color : mix(color, 'w', .4), r: rnd(4, 8), rot: rnd(0, TAU), vr: rnd(-12, 12) });
      for (let i = 0; i < 4; i++) api.push({ k: 'glass', x, y, vx: rnd(-150, 150), vy: rnd(-220, -40), g: 750, t: 0, life: .8, color: 'rgba(30,30,30,.9)', r: rnd(4, 7), rot: rnd(0, TAU), vr: rnd(-10, 10) });
      for (let i = 0; i < 4; i++) api.push({ k: 'star4', x: x + rnd(-10, 10), y: y + rnd(-10, 10), vx: rnd(-40, 40), vy: rnd(-60, 0), g: 0, t: 0, life: .6, color: '#FFF3D0', r: rnd(4, 7) });
      return true;
    }
  };

  /* ================= СЕВЕРНОЕ СИЯНИЕ ================= */
  const aurStars = Array.from({ length: 90 }, () => ({ x: Math.random() * 360, y: Math.random() * 520, s: rnd(.6, 1.8), p: rnd(0, TAU) }));
  function snowflake(g, r, v) {
    const rn = srng(v * 19 + 3), branches = 1 + (v % 3), blen = .25 + rn() * .2, bpos = [.35, .55, .75].slice(0, branches);
    g.strokeStyle = 'rgba(235,250,255,.9)'; g.lineWidth = r * .09; g.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      g.save(); g.rotate(i * Math.PI / 3);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -r);
      bpos.forEach(p => { const l = r * blen * (1 - p * .4); g.moveTo(0, -r * p); g.lineTo(l * .7, -r * p - l * .7); g.moveTo(0, -r * p); g.lineTo(-l * .7, -r * p - l * .7); });
      g.stroke();
      if (v >= 5) { g.beginPath(); g.arc(0, -r, r * .08, 0, TAU); g.stroke(); }
      g.restore();
    }
    if (v % 2) { g.beginPath(); for (let i = 0; i < 6; i++) { const [x, y] = vert(i, r * .3); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke(); }
  }
  function ribbons(c, w, h, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    [['92,255,176', 0], ['72,214,255', 2.1], ['155,123,255', 4.2]].forEach(([col, ph], k) => {
      const hh = h * .28, gr = c.createLinearGradient(0, 0, 0, hh);
      gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(.55, `rgba(${col},.28)`); gr.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = gr;
      for (let x = 0; x < w; x += 5) {
        const y = h * (.06 + k * .07) + Math.sin(x * .013 + t * .35 + ph) * h * .05 + Math.sin(x * .031 - t * .6 + ph) * h * .02;
        c.globalAlpha = .6 + .4 * Math.sin(x * .02 + t * .8 + ph);
        c.save(); c.translate(x, y); c.fillRect(0, 0, 5.5, hh); c.restore();
      }
    });
    c.restore(); c.globalAlpha = 1;
  }
  A.aurora = {
    empty(c, R) { hexPath(c, 0, 0, R * .93); c.fillStyle = '#0B1830'; c.fill(); c.lineWidth = 1; c.strokeStyle = 'rgba(140,255,220,.1)'; c.stroke(); },
    tile(c, R, color, o) {
      const t = o.t, a = o.board ? o.age : 99, flash = a < 1 ? 1.8 * Math.exp(-4 * a) : 0;
      blit(c, sprite('au' + color + o.v, R, (g, R) => {
        hexPath(g, 0, 0, R);
        const gr = g.createLinearGradient(0, -R, 0, R); gr.addColorStop(0, mix(color, 'k', .55)); gr.addColorStop(1, mix(color, 'k', .82));
        g.fillStyle = gr; g.fill();
        snowflake(g, R * .45, o.v);
        hexPath(g, 0, 0, R * .96); g.lineWidth = R * .05; g.strokeStyle = mix(color, 'w', .3); g.stroke();
      }), R);
      c.save(); hexPath(c, 0, 0, R * .96); c.clip(); c.globalCompositeOperation = 'lighter';
      const off = Math.sin(t * .6 + o.wx * .02) * R * .45;
      const band = c.createLinearGradient(0, -R + off, 0, R + off);
      band.addColorStop(0, 'rgba(0,0,0,0)'); band.addColorStop(.5, color); band.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha *= Math.min(1, .35 + .25 * Math.sin(t * .9 + o.wx * .03) + flash * .3);
      c.fillStyle = band; c.fillRect(-R, -R, 2 * R, 2 * R);
      c.restore();
      twinkleL(c, R, o, 1.1, .3);
    },
    bg(c, w, h, info) {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#040B1E'); g.addColorStop(1, '#0A1E33');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      const t = info.preview ? 3 : K.time();
      for (const s of aurStars) { if (s.y > h) continue; c.fillStyle = `rgba(255,255,255,${.25 + .5 * (.5 + .5 * Math.sin(t * 1.5 + s.p))})`; c.fillRect(s.x % w, s.y, s.s, s.s); }
      ribbons(c, w, h, t);
      c.fillStyle = '#050B18';
      c.beginPath(); c.moveTo(0, h);
      [[0, .82], [.15, .72], [.28, .8], [.45, .66], [.6, .78], [.75, .7], [.9, .8], [1, .74], [1, 1]].forEach(([x, y]) => c.lineTo(x * w, y * h));
      c.closePath(); c.fill();
      c.fillStyle = 'rgba(220,240,255,.18)';
      [[.15, .72], [.45, .66], [.75, .7]].forEach(([x, y]) => { c.beginPath(); c.moveTo(x * w, y * h); c.lineTo(x * w - w * .05, y * h + h * .04); c.lineTo(x * w + w * .05, y * h + h * .04); c.closePath(); c.fill(); });
      return true;
    },
    breakFx(api, x, y, color) {
      for (let i = 0; i < 8; i++) api.push({ k: 'flake', x, y, vx: rnd(-60, 60), vy: rnd(-160, -40), g: 160, t: 0, life: rnd(1, 1.6), color: '#FFFFFF', r: rnd(3, 5), rot: rnd(0, TAU), vr: rnd(-3, 3) });
      for (let i = 0; i < 4; i++) api.push({ k: 'tri', x, y, vx: rnd(-150, 150), vy: rnd(-220, -60), g: 700, t: 0, life: .8, color: mix(color, 'w', .5), r: rnd(3, 6), rot: rnd(0, TAU), vr: rnd(-10, 10) });
      return true;
    }
  };

  /* ================= КИБЕРПАНК ================= */
  const CIRC = Array.from({ length: 10 }, (_, v) => {
    const rn = srng(v * 53 + 7), paths = [], n = 2 + v % 3;
    for (let i = 0; i < n; i++) {
      const a = Math.floor(rn() * 6) * Math.PI / 3 + Math.PI / 6;
      let x = Math.cos(a) * .82, y = Math.sin(a) * .82;
      const pts = [[x, y]];
      for (let s = 0; s < 3; s++) {
        let best = 0, bd = -9;
        for (let k = 0; k < 6; k++) { const d = k * Math.PI / 3, sc = Math.cos(d) * -x + Math.sin(d) * -y + (rn() - .5) * .8; if (sc > bd) { bd = sc; best = d; } }
        const l = .2 + rn() * .2; x += Math.cos(best) * l; y += Math.sin(best) * l;
        pts.push([x, y]);
      }
      paths.push(pts);
    }
    return paths;
  });
  const cyb = { city: null, w: 0, h: 0 };
  function skyline(w, h) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'), base = h * .66, rn = srng(9);
    for (let x = -10; x < w;) {
      const bw = 18 + rn() * 30, bh = h * (.1 + rn() * .25);
      g.fillStyle = '#12051F'; g.fillRect(x, base - bh, bw, bh);
      for (let wy = base - bh + 6; wy < base - 4; wy += 7) for (let wx = x + 4; wx < x + bw - 4; wx += 6) {
        if (rn() < .35) { g.fillStyle = ['rgba(255,42,109,.7)', 'rgba(5,217,232,.7)', 'rgba(255,230,109,.6)'][Math.floor(rn() * 3)]; g.fillRect(wx, wy, 3, 3); }
      }
      x += bw + 2;
    }
    return cv;
  }
  A.cyber = {
    empty(c, R) { hexPath(c, 0, 0, R * .93); c.fillStyle = '#140828'; c.fill(); c.lineWidth = 1; c.strokeStyle = 'rgba(5,217,232,.15)'; c.stroke(); },
    tile(c, R, color, o) {
      const t = o.t, sf = (o.seed * .618) % 1;
      const spr = sprite('cy' + color + o.v, R, (g, R) => {
        hexPath(g, 0, 0, R); g.fillStyle = '#0D0620'; g.fill();
        g.save(); hexPath(g, 0, 0, R); g.clip();
        g.fillStyle = 'rgba(255,255,255,.05)';
        for (let y = -R; y < R; y += R * .2) for (let x = -R; x < R; x += R * .2) g.fillRect(x, y, R * .03, R * .03);
        g.lineCap = 'round'; g.lineJoin = 'round';
        CIRC[o.v].forEach(pts => {
          g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x * R, y * R) : g.moveTo(x * R, y * R));
          g.strokeStyle = color; g.globalAlpha = .85; g.lineWidth = R * .06; g.stroke(); g.globalAlpha = 1;
          const [ex, ey] = pts[pts.length - 1];
          g.fillStyle = color; g.beginPath(); g.arc(ex * R, ey * R, R * .07, 0, TAU); g.fill();
          g.fillStyle = '#0D0620'; g.beginPath(); g.arc(ex * R, ey * R, R * .03, 0, TAU); g.fill();
        });
        if (o.v % 4 === 0) {
          g.fillStyle = '#1D0E38'; g.fillRect(-R * .2, -R * .2, R * .4, R * .4);
          g.strokeStyle = color; g.lineWidth = R * .03; g.strokeRect(-R * .2, -R * .2, R * .4, R * .4);
          for (let i = 0; i < 3; i++) { g.fillRect(-R * .28, -R * .13 + i * R * .12, R * .08, R * .03); g.fillRect(R * .2, -R * .13 + i * R * .12, R * .08, R * .03); }
        }
        g.restore();
        hexPath(g, 0, 0, R * .9); g.lineWidth = R * .03; g.strokeStyle = color; g.globalAlpha = .4; g.stroke(); g.globalAlpha = 1;
      });
      const ph = (t * .21 + sf) % 1, glitch = ph < .035;
      if (glitch) {
        c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= .5;
        c.save(); c.translate(-R * .1, 0); blit(c, spr, R); c.restore();
        c.save(); c.translate(R * .1, R * .02); blit(c, spr, R); c.restore();
        c.restore();
        c.save(); c.translate(rnd(-3, 3), 0); blit(c, spr, R); c.restore();
        c.fillStyle = color; c.globalAlpha *= .5;
        for (let i = 0; i < 3; i++) c.fillRect(-R + rnd(-5, 5), rnd(-R, R), 2 * R, rnd(1, 3));
        c.globalAlpha /= .5;
      } else blit(c, spr, R);
      const path = CIRC[o.v][0], p = ((t * .9 + sf) % 1) * (path.length - 1), i = Math.floor(p), k = p - i;
      const [x0, y0] = path[i], [x1, y1] = path[Math.min(i + 1, path.length - 1)];
      glowDot(c, (x0 + (x1 - x0) * k) * R, (y0 + (y1 - y0) * k) * R, R * .045, '220,255,255', .9);
      c.save(); c.globalCompositeOperation = 'lighter';
      hexPath(c, 0, 0, R * .96); c.strokeStyle = color;
      c.globalAlpha *= .25; c.lineWidth = R * .22; c.stroke(); c.globalAlpha /= .25;
      c.lineWidth = R * .06; c.stroke();
      c.restore();
    },
    bg(c, w, h, info) {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0A0014'); g.addColorStop(.62, '#3A0050'); g.addColorStop(.67, '#0A0014');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      const t = info.preview ? 0 : K.time(), sx = w / 2, sy = h * .6, sr = w * .22;
      const sg = c.createLinearGradient(0, sy - sr, 0, sy + sr); sg.addColorStop(0, '#FFD319'); sg.addColorStop(1, '#FF2A6D');
      c.save(); c.beginPath(); c.arc(sx, sy, sr, 0, TAU); c.clip();
      c.fillStyle = sg; c.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
      c.fillStyle = '#2A0040';
      for (let i = 0; i < 7; i++) { const y = sy + i * sr * .14, hh = 1 + i * 1.2; c.fillRect(sx - sr, y, sr * 2, hh); }
      c.restore();
      if (!cyb.city || cyb.w !== w || cyb.h !== h) { cyb.city = skyline(w, h); cyb.w = w; cyb.h = h; }
      c.drawImage(cyb.city, 0, 0);
      const y0 = h * .66;
      c.fillStyle = '#0A0014'; c.fillRect(0, y0, w, h - y0);
      c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(255,42,109,.55)'; c.lineWidth = 1.2;
      for (let i = 0; i < 12; i++) { const k = ((i + (t * .8) % 1) / 12), y = y0 + (h - y0) * k * k; c.globalAlpha = k; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      c.globalAlpha = 1;
      for (let i = -8; i <= 8; i++) { c.beginPath(); c.moveTo(w / 2 + i * 6, y0); c.lineTo(w / 2 + i * w * .16, h); c.stroke(); }
      c.restore();
      c.fillStyle = 'rgba(0,0,0,.12)';
      for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
      return true;
    },
    breakFx(api, x, y, color) {
      for (let i = 0; i < 12; i++) api.push({ k: 'pixel', x, y, vx: rnd(-200, 200), vy: rnd(-260, 40), g: 400, t: 0, life: rnd(.4, .8), color: i % 2 ? color : '#05D9E8', r: rnd(2, 5) });
      for (let i = 0; i < 3; i++) api.push({ k: 'bolt', x, y, vx: rnd(-140, 140), vy: rnd(-140, 140), g: 0, t: 0, life: .3, color, r: rnd(8, 12) });
      return true;
    }
  };

  /* ================= ПЛАМЯ ================= */
  const flameEmbers = Array.from({ length: 30 }, () => ({ x: Math.random() * 360, y: Math.random() * 900, s: rnd(20, 60), r: rnd(1, 2.5), p: rnd(0, TAU) }));
  function tongue(c, ga, x, base, h, w, sway, cols) {
    [[1, cols[0], .75], [.66, cols[1], .85], [.36, cols[2], .95]].forEach(([k, col, a]) => {
      const hh = h * k, ww = w * k, sx = sway * k;
      c.globalAlpha = ga * a; c.fillStyle = col;
      c.beginPath(); c.moveTo(x - ww, base);
      c.bezierCurveTo(x - ww, base - hh * .45, x + sx - ww * .25, base - hh * .78, x + sx, base - hh);
      c.bezierCurveTo(x + sx + ww * .25, base - hh * .78, x + ww, base - hh * .45, x + ww, base);
      c.closePath(); c.fill();
    });
    c.globalAlpha = ga;
  }
  A.flame = {
    empty(c, R) { hexPath(c, 0, 0, R * .93); c.fillStyle = '#1A0C08'; c.fill(); c.lineWidth = 1; c.strokeStyle = 'rgba(255,120,40,.08)'; c.stroke(); },
    tile(c, R, color, o) {
      const t = o.t, v = o.v, a = o.board ? o.age : 99, flare = 1 + (a < 2 ? 1.1 * Math.exp(-3 * a) : 0);
      blit(c, sprite('fl' + v, R, (g, R) => {
        hexPath(g, 0, 0, R);
        const gr = g.createLinearGradient(0, -R, 0, R); gr.addColorStop(0, '#3A231A'); gr.addColorStop(1, '#120906');
        g.fillStyle = gr; g.fill(); g.save(); g.clip();
        const rn = srng(v * 5 + 2);
        for (let i = 0; i < 7; i++) { g.fillStyle = rn() < .5 ? 'rgba(255,90,20,.25)' : 'rgba(0,0,0,.35)'; g.beginPath(); g.arc((rn() - .5) * 1.6 * R, R * .3 + rn() * R * .5, R * (.1 + rn() * .15), 0, TAU); g.fill(); }
        g.restore();
      }), R);
      const p = .6 + .4 * Math.sin(t * 3 + o.seed);
      c.save(); hexPath(c, 0, 0, R); c.clip(); c.globalCompositeOperation = 'lighter';
      const eg = c.createRadialGradient(0, R * .55, 0, 0, R * .55, R * .9);
      eg.addColorStop(0, `rgba(255,120,30,${.45 * p})`); eg.addColorStop(1, 'rgba(255,60,0,0)');
      c.fillStyle = eg; c.fillRect(-R, -R, 2 * R, 2 * R);
      c.restore();
      const cols = v === 7 ? ['rgb(40,120,255)', 'rgb(90,200,255)', 'rgb(230,250,255)']
        : v === 9 ? ['rgb(170,70,255)', 'rgb(230,120,255)', 'rgb(255,230,255)']
        : [mix(color, 'k', .05), 'rgb(255,170,40)', 'rgb(255,245,200)'];
      const N = [3, 2, 4, 1, 3, 2, 5, 3, 2, 4][v], rn = srng(o.seed * 3 + 1);
      c.save(); c.globalCompositeOperation = 'lighter';
      const ga = c.globalAlpha;
      for (let i = 0; i < N; i++) {
        const x = (N === 1 ? 0 : (i / (N - 1) - .5)) * R * .9 + (rn() - .5) * R * .1, sd = o.seed + i * 1.7;
        const n = .7 + .2 * Math.sin(t * 9 + sd) + .15 * Math.sin(t * 14.3 + sd * 2) + .1 * Math.sin(t * 23 + sd);
        const h = R * (.8 + rn() * .5) * n * flare * (N === 1 ? 1.3 : 1);
        tongue(c, ga, x, R * .58, h, R * (.2 + rn() * .08) * (N > 3 ? .8 : 1), Math.sin(t * 4 + sd) * R * .12 + o.rip * R * 4, cols);
      }
      c.restore();
    },
    bg(c, w, h, info) {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#120604'); g.addColorStop(1, '#2A0A04');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      const t = info.preview ? 0 : K.time(), p = .75 + .25 * Math.sin(t * 1.7);
      const rg = c.createRadialGradient(w / 2, h + 60, 20, w / 2, h + 60, h * .9);
      rg.addColorStop(0, `rgba(255,110,20,${.4 * p})`); rg.addColorStop(1, 'rgba(255,40,0,0)');
      c.fillStyle = rg; c.fillRect(0, 0, w, h);
      if (!info.preview) {
        c.save(); c.globalCompositeOperation = 'lighter';
        for (const e of flameEmbers) {
          const y = ((e.y - t * e.s) % h + h) % h, x = e.x + Math.sin(t * 1.3 + e.p) * 10;
          c.fillStyle = `rgba(255,${140 + Math.round(70 * Math.sin(t * 4 + e.p))},50,${.4 + .3 * Math.sin(t * 5 + e.p)})`;
          c.beginPath(); c.arc(x % w, y, e.r, 0, TAU); c.fill();
        }
        c.restore();
      }
      return true;
    },
    breakFx(api, x, y, color) {
      for (let i = 0; i < 12; i++) api.push({ k: 'ember', x, y, vx: rnd(-100, 100), vy: rnd(-240, -80), g: -40, t: 0, life: rnd(.7, 1.4), color: i % 3 ? '#FFB347' : color, r: rnd(1.8, 3.5) });
      for (let i = 0; i < 3; i++) api.push({ k: 'smoke', x: x + rnd(-6, 6), y, vx: rnd(-30, 30), vy: rnd(-70, -30), g: -20, t: 0, life: rnd(.9, 1.3), color: 'rgba(60,40,40,.5)', r: rnd(7, 12) });
      for (let i = 0; i < 2; i++) api.push({ k: 'drop', x, y, vx: rnd(-90, 90), vy: rnd(-200, -80), g: 700, t: 0, life: .8, color: '#FF8A00', r: rnd(2.5, 4), glow: true });
      return true;
    }
  };
})();
