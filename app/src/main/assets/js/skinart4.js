/*
 * Скины «Снежный шар» и «Ночной город».
 * Снежный шар: поле внутри стеклянного шара, соты из матового стекла размывают то, что за ними,
 * а снег лежит на дне и взлетает от комбо, взрывов и встряхивания телефона.
 * Ночной город: соты — окна домов, приглушённый свет, дождь и мокрые капли на стекле.
 */
(() => {
  'use strict';
  const HB = window.HB, K = HB.skins, A = K.art;
  const { hexPath, mix, srng, sprite, blit, star4 } = K;
  const TAU = Math.PI * 2, R3 = Math.sqrt(3);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rgbaHex = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const rrect = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };

  /** Заполненные клетки поля по координате: сетка восстанавливается из радиуса соты. */
  function boardLookup(info) {
    const S = info.R / .93, m = new Map();
    for (const cl of info.cells) if (cl.ci >= 0) m.set(cl.q + ',' + cl.r, cl);
    return (x, y) => {
      const px = x - 180, py = y - info.cy;
      const fq = (R3 / 3 * px - py / 3) / S, fr = (2 / 3 * py) / S, fs = -fq - fr;
      let q = Math.round(fq), r = Math.round(fr); const s = Math.round(fs);
      const dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s - fs);
      if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
      return m.get(q + ',' + r);
    };
  }
  function cacheBy(store, key, make) {
    let v = store.get(key);
    if (!v) { if (store.size > 3) store.clear(); v = make(); store.set(key, v); }
    return v;
  }
  function softDot(r, col) {
    const cv = document.createElement('canvas'), s = Math.ceil(r * 2 + 2); cv.width = cv.height = s;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, r);
    gr.addColorStop(0, `rgba(${col},1)`); gr.addColorStop(.35, `rgba(${col},.75)`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    return cv;
  }

  /* ======================= СНЕЖНЫЙ ШАР ======================= */
  const SG = { flakes: [], sw: 0, geo: null, statics: new Map(), dot: null, blob: null, glint: null, lastShakeAt: 0 };
  function sgGeo(w, h, cy) {
    const R = Math.min(212, h * .34);
    return { cx: w / 2, cy, R, floor: cy + R * .8 };
  }
  const floorAt = (g, x) => Math.min(g.floor, g.cy + Math.sqrt(Math.max(0, g.R * g.R - (x - g.cx) * (x - g.cx))) - 4);
  function pileAt(g, x) { const d = (x - g.cx) / g.R; return 7 * Math.exp(-d * d * 3) + 3 * Math.sin(x * .09) + 3; }
  function initFlakes(g) {
    SG.flakes = [];
    for (let i = 0; i < 300; i++) {
      const glitter = i < 16, x = g.cx + rnd(-.93, .93) * g.R * Math.sqrt(Math.random());
      const f = { x, y: 0, vx: 0, vy: 0, r: glitter ? rnd(1, 1.7) : rnd(.9, 2.6), glitter, rest: !glitter, ph: rnd(0, TAU), sp: rnd(.6, 1.4) };
      f.y = glitter ? g.cy + rnd(-.7, .7) * g.R : floorAt(g, x) - Math.random() * pileAt(g, x);
      SG.flakes.push(f);
    }
    SG.sw = .35;
    // Первые секунды снег ещё оседает, как будто шар только что поставили.
    for (let i = 0; i < 40; i++) { const f = SG.flakes[16 + i]; f.rest = false; f.y = g.cy + rnd(-.8, .5) * g.R; }
  }
  function sgStir(k, x0, y0) {
    const g = SG.geo; if (!g) return;
    k = Math.min(1.5, k);
    SG.sw = Math.max(-2.2, Math.min(2.2, SG.sw + k * (Math.random() < .5 ? -1 : 1) * 1.1));
    for (const f of SG.flakes) {
      if (f.rest && Math.random() > Math.min(.95, k * .8)) continue;
      const near = x0 == null ? 1 : Math.max(.35, 1 - Math.hypot(f.x - x0, f.y - (y0 || g.cy)) / (g.R * 2));
      f.rest = false;
      f.vy -= rnd(260, 620) * k * near;
      f.vx += rnd(-1, 1) * 220 * k * near;
      f.kick = .5 + Math.random() * .4;
    }
  }
  function sgTick(dt) {
    const g = SG.geo; if (!g) return;
    SG.sw *= Math.exp(-dt * .45);
    for (const f of SG.flakes) {
      if (f.rest) continue;
      // Сразу после встряски снежинка летит по инерции, потом вязкая вода её тормозит.
      if (f.kick > 0) f.kick -= dt;
      const d = 1 - Math.exp(-dt * (f.kick > 0 ? .5 : 1.6));
      const rx = f.x - g.cx, ry = f.y - g.cy, dist = Math.hypot(rx, ry) || 1;
      // Вихрь внутри шара: снег кружит вдоль стекла и медленно оседает.
      const vt = SG.sw * 120 * (dist / g.R);
      const tx = -ry / dist * vt + Math.sin(K.time() * f.sp + f.ph) * 9, ty = rx / dist * vt + (f.glitter ? Math.sin(K.time() * .5 + f.ph) * 6 : 11 + f.r * 7);
      f.vx += (tx - f.vx) * d; f.vy += (ty - f.vy) * d;
      f.x += f.vx * dt; f.y += f.vy * dt;
      const nd = Math.hypot(f.x - g.cx, f.y - g.cy);
      if (nd > g.R - 5) { const k = (g.R - 5) / nd; f.x = g.cx + (f.x - g.cx) * k; f.y = g.cy + (f.y - g.cy) * k; f.vx *= -.3; f.vy *= -.3; }
      if (f.glitter) { if (f.y > g.floor - 12) f.vy -= 40 * dt * 10; continue; }
      const fy = floorAt(g, f.x) - Math.random() * pileAt(g, f.x) * .9;
      if (f.y >= fy && f.vy > 0) { f.y = fy; f.rest = true; f.vx = f.vy = 0; }
    }
  }
  function sgStatic(w, h, cy, preview) {
    const g = preview ? { cx: w / 2, cy: h * .52, R: Math.min(w, h) * .48, floor: h * .52 + Math.min(w, h) * .48 * .8 } : sgGeo(w, h, cy);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    // Комната: тёплый полумрак и гирлянда вдали.
    const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#16132E'); bg.addColorStop(.6, '#1E1631'); bg.addColorStop(1, '#120D1C');
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    const rn = srng(41);
    for (let i = 0; i < 26; i++) {
      const x = rn() * w, y = rn() * h * .9, r = 10 + rn() * 26, col = ['255,190,110', '255,140,160', '140,190,255', '255,230,150'][i % 4];
      const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${col},${.05 + rn() * .08})`); gr.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    // Подставка под шаром: тёмное дерево с золотым пояском.
    if (!preview) {
      const by = g.cy + g.R * .86, bw = g.R * 1.25;
      c.beginPath(); c.moveTo(g.cx - bw * .78, by); c.lineTo(g.cx + bw * .78, by); c.lineTo(g.cx + bw, h + 10); c.lineTo(g.cx - bw, h + 10); c.closePath();
      const wd = c.createLinearGradient(0, by, 0, h); wd.addColorStop(0, '#4A2A1C'); wd.addColorStop(.3, '#2E1810'); wd.addColorStop(1, '#170B07');
      c.fillStyle = wd; c.fill();
      c.globalAlpha = .08; c.strokeStyle = '#000'; c.lineWidth = 1;
      for (let i = 0; i < 18; i++) { c.beginPath(); const yy = by + 6 + i * 7; c.moveTo(g.cx - bw, yy); c.bezierCurveTo(g.cx - 40, yy + 3, g.cx + 40, yy - 3, g.cx + bw, yy + 1); c.stroke(); }
      c.globalAlpha = 1;
      const gy = by + 12, gb = c.createLinearGradient(0, gy - 5, 0, gy + 5);
      gb.addColorStop(0, '#FFE7A3'); gb.addColorStop(.5, '#C8923A'); gb.addColorStop(1, '#6E4A16');
      c.fillStyle = gb; c.fillRect(g.cx - bw * .83, gy - 4, bw * 1.66, 8);
    }
    // Внутри шара: ночное небо, звёзды, заснеженные холмы, домики и ёлки.
    c.save(); c.beginPath(); c.arc(g.cx, g.cy, g.R, 0, TAU); c.clip();
    const sky = c.createRadialGradient(g.cx, g.cy - g.R * .3, g.R * .1, g.cx, g.cy, g.R);
    sky.addColorStop(0, '#2B3F7A'); sky.addColorStop(.6, '#1A2654'); sky.addColorStop(1, '#0E1433');
    c.fillStyle = sky; c.fillRect(g.cx - g.R, g.cy - g.R, g.R * 2, g.R * 2);
    for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(255,255,255,${.15 + rn() * .45})`; c.beginPath(); c.arc(g.cx + (rn() - .5) * 2 * g.R, g.cy - g.R + rn() * g.R * 1.2, rn() * 1.1 + .3, 0, TAU); c.fill(); }
    const moon = [g.cx + g.R * .45, g.cy - g.R * .55];
    const mg = c.createRadialGradient(moon[0], moon[1], 2, moon[0], moon[1], g.R * .3); mg.addColorStop(0, 'rgba(230,240,255,.35)'); mg.addColorStop(1, 'rgba(230,240,255,0)');
    c.fillStyle = mg; c.fillRect(0, 0, w, h);
    c.fillStyle = '#F2F5FF'; c.beginPath(); c.arc(moon[0], moon[1], g.R * .07, 0, TAU); c.fill();
    c.fillStyle = '#1A2654'; c.beginPath(); c.arc(moon[0] + g.R * .03, moon[1] - g.R * .02, g.R * .062, 0, TAU); c.fill();
    const fl = g.floor;
    const hill = (y0, amp, col, ph) => { c.beginPath(); c.moveTo(g.cx - g.R, g.cy + g.R); for (let x = -g.R; x <= g.R; x += 6) c.lineTo(g.cx + x, y0 - amp * (Math.sin(x * .018 + ph) * .5 + .5)); c.lineTo(g.cx + g.R, g.cy + g.R); c.closePath(); c.fillStyle = col; c.fill(); };
    hill(fl - 26, 22, '#34467E', 1.3);
    // Деревня на дальнем холме: тёплые окна.
    const house = (x, y, s, roof) => {
      c.fillStyle = '#26315C'; c.fillRect(x - s, y - s * 1.2, s * 2, s * 1.2);
      c.fillStyle = '#E8EEFF'; c.beginPath(); c.moveTo(x - s * 1.3, y - s * 1.1); c.lineTo(x, y - s * (roof || 2.1)); c.lineTo(x + s * 1.3, y - s * 1.1); c.closePath(); c.fill();
      c.fillStyle = '#FFC46B'; c.fillRect(x - s * .55, y - s * .8, s * .4, s * .4); c.fillRect(x + s * .15, y - s * .8, s * .4, s * .4);
      const wg = c.createRadialGradient(x, y - s * .6, 0, x, y - s * .6, s * 2.6); wg.addColorStop(0, 'rgba(255,190,100,.28)'); wg.addColorStop(1, 'rgba(255,190,100,0)');
      c.fillStyle = wg; c.beginPath(); c.arc(x, y - s * .6, s * 2.6, 0, TAU); c.fill();
    };
    const tree = (x, y, s) => {
      for (let i = 0; i < 3; i++) {
        const yy = y - i * s * .7;
        c.fillStyle = '#1C3A4A'; c.beginPath(); c.moveTo(x - s * (1 - i * .22), yy); c.lineTo(x, yy - s * 1.1); c.lineTo(x + s * (1 - i * .22), yy); c.closePath(); c.fill();
        c.fillStyle = 'rgba(235,242,255,.9)'; c.beginPath(); c.moveTo(x - s * (.5 - i * .1), yy - s * .6); c.lineTo(x, yy - s * 1.1); c.lineTo(x + s * (.5 - i * .1), yy - s * .6); c.closePath(); c.fill();
      }
    };
    [[-.62, 9], [-.35, 11], [.3, 10], [.58, 8]].forEach(([k, s], i) => house(g.cx + k * g.R, fl - 16 - (i % 2) * 5, s, i === 1 ? 3.2 : 2.1));
    [[-.8, 10], [-.48, 14], [-.12, 12], [.14, 15], [.45, 12], [.75, 11]].forEach(([k, s]) => tree(g.cx + k * g.R, fl - 6, s));
    const snow = c.createLinearGradient(0, fl - 12, 0, g.cy + g.R);
    snow.addColorStop(0, '#E9F0FF'); snow.addColorStop(.4, '#B8C8EE'); snow.addColorStop(1, '#6E80B8');
    hill(fl + 4, 10, snow, 0);
    const vg = c.createRadialGradient(g.cx, g.cy, g.R * .7, g.cx, g.cy, g.R);
    vg.addColorStop(0, 'rgba(10,14,40,0)'); vg.addColorStop(1, 'rgba(10,14,40,.45)');
    c.fillStyle = vg; c.fillRect(0, 0, w, h);
    c.restore();
    // Стекло шара: тонкий обод с бликом.
    c.beginPath(); c.arc(g.cx, g.cy, g.R, 0, TAU);
    const rim = c.createLinearGradient(g.cx - g.R, g.cy - g.R, g.cx + g.R, g.cy + g.R);
    rim.addColorStop(0, 'rgba(255,255,255,.7)'); rim.addColorStop(.5, 'rgba(255,255,255,.12)'); rim.addColorStop(1, 'rgba(255,255,255,.45)');
    c.lineWidth = 2.5; c.strokeStyle = rim; c.stroke();
    const blur = document.createElement('canvas'); blur.width = w; blur.height = h;
    const b = blur.getContext('2d');
    b.filter = 'blur(7px)'; b.drawImage(cv, 0, 0); b.filter = 'none';
    b.fillStyle = 'rgba(255,255,255,.07)'; b.fillRect(0, 0, w, h);
    return { cv, blur, g };
  }
  function sgGlint(g) {
    // Блик на передней стороне стекла: рисуется поверх поля, очень прозрачно.
    const s = Math.ceil(g.R * 2 + 8), cv = document.createElement('canvas'); cv.width = cv.height = s;
    const c = cv.getContext('2d'), o = s / 2;
    c.lineCap = 'round';
    const gr = c.createLinearGradient(0, 0, s * .5, s * .5); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.strokeStyle = gr; c.lineWidth = g.R * .07;
    c.beginPath(); c.arc(o, o, g.R * .9, Math.PI * 1.08, Math.PI * 1.42); c.stroke();
    c.lineWidth = g.R * .025; c.beginPath(); c.arc(o, o, g.R * .9, Math.PI * 1.47, Math.PI * 1.53); c.stroke();
    const g2 = c.createLinearGradient(s, s, s * .5, s * .5); g2.addColorStop(0, 'rgba(200,220,255,.3)'); g2.addColorStop(1, 'rgba(200,220,255,0)');
    c.strokeStyle = g2; c.lineWidth = g.R * .04; c.beginPath(); c.arc(o, o, g.R * .92, Math.PI * .12, Math.PI * .38); c.stroke();
    return cv;
  }
  // Матовое стекло в стиле новых иконок iOS: прозрачное тело, иней, яркий кант и выгравированный узор.
  function frostTile(g, R, color, v) {
    hexPath(g, R * .04, R * .1, R * .98); g.fillStyle = 'rgba(0,0,30,.22)'; g.fill();
    hexPath(g, 0, 0, R);
    const body = g.createLinearGradient(-R, -R, R, R);
    body.addColorStop(0, rgbaHex(color, .5)); body.addColorStop(1, rgbaHex(color, .22));
    g.fillStyle = body; g.fill();
    g.fillStyle = 'rgba(235,242,255,.1)'; g.fill();
    g.save(); hexPath(g, 0, 0, R); g.clip();
    const sh = g.createLinearGradient(0, -R, 0, -R * .1);
    sh.addColorStop(0, 'rgba(255,255,255,.55)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sh; g.beginPath(); g.ellipse(-R * .05, -R * .68, R * .8, R * .4, 0, 0, TAU); g.fill();
    const ca = g.createRadialGradient(R * .1, R * .8, 0, R * .1, R * .8, R * .65);
    ca.addColorStop(0, rgbaHex(mix(color, 'w', .3).replace(/rgb\((\d+),(\d+),(\d+)\)/, (m, r, gg, b) => '#' + [r, gg, b].map(n => (+n).toString(16).padStart(2, '0')).join('')), .85));
    ca.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = ca; g.beginPath(); g.ellipse(R * .1, R * .82, R * .62, R * .3, 0, 0, TAU); g.fill();
    // Гравировка: белый иней с тёмной тенью, как узор на стекле.
    const etch = (draw, lw) => {
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.save(); g.translate(R * .02, R * .03); g.strokeStyle = g.fillStyle = 'rgba(10,20,60,.22)'; g.lineWidth = lw; draw(); g.restore();
      g.strokeStyle = g.fillStyle = 'rgba(255,255,255,.62)'; g.lineWidth = lw; draw();
    };
    const lw = R * .065, s = R * .42;
    const line = pts => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s)); g.stroke(); };
    if (v === 0) etch(() => { for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; line([[-Math.cos(a), -Math.sin(a)], [Math.cos(a), Math.sin(a)]]); [-1, 1].forEach(sd => { const bx = Math.cos(a) * .55 * sd, by = Math.sin(a) * .55 * sd; line([[bx + Math.cos(a + 2.4 * sd) * .3, by + Math.sin(a + 2.4 * sd) * .3], [bx, by], [bx + Math.cos(a - 2.4 * sd) * .3, by + Math.sin(a - 2.4 * sd) * .3]]); }); } }, lw);
    else if (v === 1) etch(() => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * .42 : s; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.stroke(); }, lw);
    else if (v === 2) etch(() => { line([[-.7, .75], [0, -1], [.7, .75], [-.7, .75]]); line([[-.45, .2], [.45, .2]]); line([[0, .75], [0, 1]]); }, lw);
    else if (v === 3) etch(() => { g.beginPath(); g.arc(0, s * .45, s * .5, 0, TAU); g.moveTo(s * .33, -s * .35); g.arc(0, -s * .35, s * .33, 0, TAU); g.stroke(); g.beginPath(); g.arc(-s * .12, -s * .4, s * .05, 0, TAU); g.arc(s * .12, -s * .4, s * .05, 0, TAU); g.fill(); }, lw);
    else if (v === 4) etch(() => { g.beginPath(); g.moveTo(-s * .45, s * .9); g.lineTo(-s * .45, -s * .3); g.quadraticCurveTo(-s * .45, -s * .9, s * .05, -s * .9); g.quadraticCurveTo(s * .5, -s * .9, s * .5, -s * .3); g.lineTo(s * .5, s * .9); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(-s * .45, -s * .1); g.lineTo(-s * .85, -s * .45); g.stroke(); line([[-.5, .55], [.55, .55]]); }, lw);
    else if (v === 5) etch(() => { g.beginPath(); g.moveTo(-s * .75, s * .55); g.quadraticCurveTo(-s * .55, -s * .85, 0, -s * .85); g.quadraticCurveTo(s * .55, -s * .85, s * .75, s * .55); g.closePath(); g.stroke(); g.beginPath(); g.arc(0, s * .7, s * .16, 0, TAU); g.fill(); }, lw);
    else if (v === 6) etch(() => { g.beginPath(); g.rect(-s * .75, -s * .35, s * 1.5, s * 1.15); g.moveTo(0, -s * .35); g.lineTo(0, s * .8); g.stroke(); g.beginPath(); g.ellipse(-s * .3, -s * .6, s * .3, s * .18, .5, 0, TAU); g.ellipse(s * .3, -s * .6, s * .3, s * .18, -.5, 0, TAU); g.stroke(); }, lw);
    else if (v === 7) etch(() => { g.beginPath(); g.arc(0, 0, s * .85, Math.PI * .3, Math.PI * 1.7); g.arc(s * .35, 0, s * .68, Math.PI * 1.6, Math.PI * .4, true); g.closePath(); g.fill(); }, lw);
    else if (v === 8) etch(() => { g.beginPath(); g.moveTo(0, s * .85); g.bezierCurveTo(-s * 1.2, 0, -s * .6, -s * .95, 0, -s * .35); g.bezierCurveTo(s * .6, -s * .95, s * 1.2, 0, 0, s * .85); g.fill(); }, lw);
    else etch(() => { g.beginPath(); g.moveTo(s * .15, s * .95); g.lineTo(s * .15, -s * .35); g.arc(-s * .2, -s * .35, s * .35, 0, Math.PI, true); g.stroke(); }, lw * 1.25);
    g.restore();
    hexPath(g, 0, 0, R * .975);
    const rim = g.createLinearGradient(-R * .7, -R, R * .7, R);
    rim.addColorStop(0, 'rgba(255,255,255,.95)'); rim.addColorStop(.45, 'rgba(255,255,255,.18)'); rim.addColorStop(.75, 'rgba(255,255,255,.1)'); rim.addColorStop(1, 'rgba(255,255,255,.6)');
    g.lineWidth = R * .065; g.lineJoin = 'round'; g.strokeStyle = rim; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.ellipse(-R * .46, -R * .4, R * .1, R * .04, -.85, 0, TAU); g.fill();
  }
  A.snowglobe = {
    empty(c, R) { hexPath(c, 0, 0, R * .93); c.fillStyle = 'rgba(255,255,255,.035)'; c.fill(); c.lineWidth = 1; c.strokeStyle = 'rgba(220,235,255,.14)'; c.stroke(); },
    tile(c, R, color, o) {
      blit(c, sprite('sg' + color + o.v, R, (g, R) => frostTile(g, R, color, o.v)), R);
      const a = o.board ? o.age : 99;
      if (a < .6) { c.save(); hexPath(c, 0, 0, R); c.clip(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(230,240,255,${.45 * (1 - a / .6)})`; c.fillRect(-R, -R, 2 * R, 2 * R); c.restore(); }
      const sp = Math.sin(o.t * 1.3 + o.seed * 2.1);
      if (sp > .94) { const k = (sp - .94) / .06; c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,255,255,${k})`; star4(c, -R * .42, -R * .38, R * .32 * k); c.fill(); c.restore(); }
    },
    bg(c, w, h, info) {
      if (info.preview) { c.drawImage(cacheBy(SG.statics, 'p' + w + 'x' + h, () => sgStatic(w, h, 0, true)).cv, 0, 0); return true; }
      const st = cacheBy(SG.statics, w + 'x' + h + 'x' + info.cy, () => sgStatic(w, h, info.cy, false));
      if (!SG.geo || SG.geo.cy !== st.g.cy || SG.geo.R !== st.g.R) { const had = SG.geo; SG.geo = st.g; if (!had) initFlakes(st.g); else SG.flakes.forEach(f => { f.y += st.g.cy - had.cy; }); SG.glint = sgGlint(st.g); }
      c.drawImage(st.cv, 0, 0);
      const at = info.cells ? boardLookup(info) : null;
      // Размытие за сотами: одна общая маска из всех занятых клеток.
      if (info.cells) {
        c.save(); c.beginPath();
        let any = false;
        for (const cl of info.cells) if (cl.ci >= 0) { any = true; for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30), px = cl.x + info.R * Math.cos(a), py = cl.y + info.R * Math.sin(a); i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); }
        if (any) { c.clip(); c.drawImage(st.blur, 0, 0); }
        c.restore();
      }
      if (!SG.dot) { SG.dot = softDot(3, '255,255,255'); SG.blob = softDot(9, '235,242,255'); SG.gold = softDot(3, '255,225,150'); }
      const t = K.time();
      for (const f of SG.flakes) {
        const behind = at && at(f.x, f.y);
        const tw = f.glitter ? .45 + .55 * Math.max(0, Math.sin(t * 4 * f.sp + f.ph)) : 1;
        if (behind) {
          // За матовым стеклом снежинка видна мягким пятном.
          const s = f.r * 3.4;
          c.globalAlpha = .35 * tw; c.drawImage(f.glitter ? SG.gold : SG.blob, f.x - s, f.y - s, s * 2, s * 2);
        } else {
          const s = f.r * 1.6;
          c.globalAlpha = (f.rest ? .92 : .85) * tw; c.drawImage(f.glitter ? SG.gold : SG.dot, f.x - s, f.y - s, s * 2, s * 2);
        }
      }
      c.globalAlpha = 1;
      return true;
    },
    over(c) { if (SG.glint && SG.geo) { const g = SG.geo, s = SG.glint.width; c.globalAlpha = .55; c.drawImage(SG.glint, g.cx - s / 2, g.cy - s / 2); c.globalAlpha = 1; } },
    tick: sgTick,
    stir: sgStir,
    place(points, group, center) { if (center) sgStir(.12, center.x, center.y); },
    breakFx(api, x, y, color) {
      for (let i = 0; i < 6; i++) api.push({ k: 'glass', x, y, vx: rnd(-190, 190), vy: rnd(-260, -40), g: 800, t: 0, life: rnd(.6, .95), color: 'rgba(255,255,255,.85)', r: rnd(3, 7), rot: rnd(0, TAU), vr: rnd(-14, 14) });
      for (let i = 0; i < 4; i++) api.push({ k: 'tri', x, y, vx: rnd(-150, 150), vy: rnd(-220, -60), g: 700, t: 0, life: rnd(.6, .9), color: mix(color, 'w', .45), r: rnd(3, 6), rot: rnd(0, TAU), vr: rnd(-12, 12) });
      for (let i = 0; i < 5; i++) api.push({ k: 'flake', x: x + rnd(-8, 8), y: y + rnd(-8, 8), vx: 0, vy: rnd(-90, -20), g: 60, t: 0, life: rnd(1.1, 1.7), color: 'rgba(240,246,255,.95)', r: rnd(3, 5), rot: rnd(0, TAU) });
      return true;
    }
  };
  // Встряхнул телефон — в шаре поднимается метель.
  window.addEventListener('devicemotion', e => {
    if (HB.profile.skin !== 'snowglobe' || !SG.geo) return;
    const a = e.acceleration, ag = e.accelerationIncludingGravity;
    let m = 0;
    if (a && a.x != null) m = Math.hypot(a.x, a.y, a.z);
    else if (ag && ag.x != null) m = Math.abs(Math.hypot(ag.x, ag.y, ag.z) - 9.8);
    const now = performance.now();
    if (m > 11 && now - SG.lastShakeAt > 180) {
      SG.lastShakeAt = now;
      sgStir(Math.min(1.3, (m - 8) / 12));
      if (a && a.x) SG.sw = Math.max(-2.2, Math.min(2.2, SG.sw + Math.sign(a.x) * .6));
    }
  });

  /* ======================= НОЧНОЙ ГОРОД ======================= */
  const NC = { statics: new Map(), rain: [], init: false, splashes: [] };
  function ncStatic(w, h, preview) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'), rn = srng(97);
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#07080F'); sky.addColorStop(.45, '#10121F'); sky.addColorStop(.72, '#1C1827'); sky.addColorStop(1, '#0A0A10');
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    // Зарево города в облаках.
    const glow = c.createRadialGradient(w * .5, h * .7, 0, w * .5, h * .7, h * .6);
    glow.addColorStop(0, 'rgba(120,80,110,.22)'); glow.addColorStop(1, 'rgba(120,80,110,0)');
    c.fillStyle = glow; c.fillRect(0, 0, w, h);
    const hz = preview ? h * .95 : h * .8;
    const skyline = (base, minH, maxH, col, winA, step) => {
      let x = -10;
      while (x < w + 10) {
        const bw = step * (.6 + rn() * .9), bh = minH + rn() * (maxH - minH);
        c.fillStyle = col; c.fillRect(x, base - bh, bw, bh + 4);
        if (rn() < .3) { c.fillRect(x + bw * .45, base - bh - 14 * rn() - 6, 1.5, 20); }
        if (rn() < .25) { c.fillRect(x + bw * .15, base - bh - 6, bw * .3, 6); }
        const ws = 5 + (step > 40 ? 2 : 0);
        for (let yy = base - bh + 6; yy < base - 4; yy += ws + 3) for (let xx = x + 4; xx < x + bw - 4; xx += ws + 2) {
          const r = rn(); if (r > .28) continue;
          const warm = rn() < .75;
          c.fillStyle = warm ? `rgba(255,${180 + rn() * 40 | 0},${100 + rn() * 50 | 0},${winA * (.4 + rn() * .6)})` : `rgba(150,190,255,${winA * (.4 + rn() * .5)})`;
          c.fillRect(xx, yy, ws * .8, ws * .7);
        }
        x += bw + rn() * 4;
      }
    };
    skyline(hz, h * .18, h * .42, '#12131F', .28, 26);
    // Далёкие вывески: мягкие неоновые пятна, без резкого света.
    [[.18, .42, '255,60,140'], [.78, .36, '60,220,220'], [.55, .5, '255,160,60']].forEach(([x, y, col]) => {
      const gr = c.createRadialGradient(x * w, y * h, 0, x * w, y * h, 70); gr.addColorStop(0, `rgba(${col},.16)`); gr.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    });
    skyline(hz + 10, h * .12, h * .3, '#0B0B14', .45, 44);
    // Туман у земли и мокрый асфальт с отражениями огней.
    const fog = c.createLinearGradient(0, hz - 80, 0, hz + 20);
    fog.addColorStop(0, 'rgba(60,55,80,0)'); fog.addColorStop(1, 'rgba(60,55,80,.35)');
    c.fillStyle = fog; c.fillRect(0, hz - 80, w, 100);
    const ground = c.createLinearGradient(0, hz + 10, 0, h);
    ground.addColorStop(0, '#0E0D16'); ground.addColorStop(1, '#050508');
    c.fillStyle = ground; c.fillRect(0, hz + 10, w, h - hz);
    for (let i = 0; i < 26; i++) {
      const x = rn() * w, col = ['255,170,90', '255,70,140', '80,200,230', '255,220,150'][i % 4], len = 30 + rn() * 80;
      const gr = c.createLinearGradient(0, hz + 12, 0, hz + 12 + len); gr.addColorStop(0, `rgba(${col},${.1 + rn() * .12})`); gr.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = gr; c.fillRect(x, hz + 12, 2 + rn() * 5, len);
    }
    return { cv, hz };
  }
  function ncInit(w, h) {
    NC.rain = Array.from({ length: 110 }, (_, i) => ({ x: Math.random() * (w + 80), y: Math.random() * h, z: i < 70 ? rnd(.35, .65) : rnd(.75, 1), s: rnd(.85, 1.15) }));
    NC.w = w; NC.h = h; NC.init = true;
  }
  function ncRain(c, near) {
    const t = K.time(), w = NC.w, h = NC.h;
    c.lineCap = 'round';
    c.beginPath();
    for (const d of NC.rain) {
      if ((d.z > .7) !== near) continue;
      const sp = 620 + 420 * d.z, len = 10 + 16 * d.z;
      const y = (d.y + t * sp * d.s) % (h + 40) - 20, x = (d.x - (y + 20) * .18) % (w + 80) - 40;
      c.moveTo(x, y); c.lineTo(x + len * .18, y - len);
    }
    c.strokeStyle = near ? 'rgba(190,205,235,.2)' : 'rgba(170,185,220,.13)'; c.lineWidth = near ? 1.2 : .8; c.stroke();
  }
  function windowTile(g, R, color, v) {
    const lit = k => mix(color, 'w', k), dark = k => mix(color, 'k', k);
    // Бетонная рама.
    hexPath(g, 0, 0, R); g.fillStyle = '#1B1C27'; g.fill();
    hexPath(g, 0, 0, R * .98); g.lineWidth = R * .04; g.strokeStyle = 'rgba(255,255,255,.08)'; g.stroke();
    const Ri = R * .8;
    g.save(); hexPath(g, 0, 0, Ri); g.clip();
    // Свет комнаты: приглушённый, в цвете соты.
    const room = g.createRadialGradient(0, -Ri * .15, 0, 0, 0, Ri * 1.2);
    room.addColorStop(0, lit(.12)); room.addColorStop(.55, dark(.25)); room.addColorStop(1, dark(.62));
    g.fillStyle = room; g.fillRect(-R, -R, 2 * R, 2 * R);
    const sil = dark(.72);
    g.fillStyle = sil; g.strokeStyle = sil;
    if (v === 0) {
      // Шторы и лампа.
      g.beginPath(); g.moveTo(-Ri, -Ri); g.quadraticCurveTo(-Ri * .45, 0, -Ri * .75, Ri); g.lineTo(-Ri, Ri); g.fill();
      g.beginPath(); g.moveTo(Ri, -Ri); g.quadraticCurveTo(Ri * .45, 0, Ri * .75, Ri); g.lineTo(Ri, Ri); g.fill();
      g.fillStyle = lit(.45); g.beginPath(); g.moveTo(-Ri * .16, -Ri * .15); g.lineTo(Ri * .16, -Ri * .15); g.lineTo(Ri * .1, -Ri * .38); g.lineTo(-Ri * .1, -Ri * .38); g.fill();
      g.fillStyle = sil; g.fillRect(-Ri * .02, -Ri * .15, Ri * .04, Ri * .5);
    } else if (v === 1) {
      for (let y = -Ri; y < Ri; y += Ri * .17) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-Ri, y, 2 * Ri, Ri * .07); }
    } else if (v === 2) {
      g.fillRect(-Ri, Ri * .45, 2 * Ri, Ri * .1);
      g.beginPath(); g.moveTo(-Ri * .22, Ri * .45); g.lineTo(-Ri * .16, Ri * .2); g.lineTo(Ri * .16, Ri * .2); g.lineTo(Ri * .22, Ri * .45); g.fill();
      for (let i = -3; i <= 3; i++) { g.beginPath(); g.ellipse(i * Ri * .09, Ri * .05 - Math.abs(i) * Ri * .02, Ri * .07, Ri * .22, i * .3, 0, TAU); g.fill(); }
    } else if (v === 3) {
      g.beginPath(); g.arc(Ri * .1, -Ri * .05, Ri * .2, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-Ri * .3, Ri); g.quadraticCurveTo(-Ri * .25, Ri * .2, Ri * .1, Ri * .18); g.quadraticCurveTo(Ri * .5, Ri * .2, Ri * .5, Ri); g.fill();
    } else if (v === 4) {
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(-Ri, -Ri, 2 * Ri, 2 * Ri);
      g.fillStyle = sil; g.fillRect(-Ri * .55, Ri * .25, Ri * 1.1, Ri * .6);
    } else if (v === 5) {
      g.lineWidth = Ri * .09; g.strokeStyle = '#1B1C27';
      g.beginPath(); g.moveTo(0, -Ri); g.lineTo(0, Ri); g.moveTo(-Ri, -Ri * .05); g.lineTo(Ri, -Ri * .05); g.stroke();
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, -Ri, Ri, Ri * .95);
    } else if (v === 6) {
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(-Ri, -Ri, 2 * Ri, 2 * Ri);
    } else if (v === 7) {
      g.fillRect(-Ri, Ri * .42, 2 * Ri, Ri * .12);
      g.beginPath(); g.ellipse(Ri * .05, Ri * .28, Ri * .22, Ri * .16, 0, 0, TAU); g.fill();
      g.beginPath(); g.arc(-Ri * .2, Ri * .06, Ri * .12, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-Ri * .3, -Ri * .02); g.lineTo(-Ri * .27, Ri * .1); g.lineTo(-Ri * .2, Ri * .04); g.fill();
      g.beginPath(); g.moveTo(-Ri * .1, -Ri * .02); g.lineTo(-Ri * .13, Ri * .1); g.lineTo(-Ri * .2, Ri * .04); g.fill();
      g.lineWidth = Ri * .06; g.lineCap = 'round'; g.beginPath(); g.moveTo(Ri * .25, Ri * .35); g.quadraticCurveTo(Ri * .55, Ri * .4, Ri * .45, Ri * .1); g.stroke();
    } else if (v === 8) {
      g.lineWidth = Ri * .025; g.beginPath(); g.moveTo(-Ri, -Ri * .55); g.quadraticCurveTo(0, -Ri * .15, Ri, -Ri * .55); g.stroke();
    } else if (v === 9) {
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(-Ri, -Ri, 2 * Ri, 2 * Ri);
    }
    // Стекло: отражение и мелкие капли.
    g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(-Ri, -Ri * .2); g.lineTo(-Ri * .2, -Ri); g.lineTo(Ri * .15, -Ri); g.lineTo(-Ri, Ri * .15); g.fill();
    const rn = srng(v * 17 + 3);
    for (let i = 0; i < 9; i++) { const x = (rn() - .5) * 1.7 * Ri, y = (rn() - .5) * 1.7 * Ri, r = Ri * (.02 + rn() * .035); g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(x, y + r * .4, r, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.arc(x - r * .3, y - r * .3, r * .45, 0, TAU); g.fill(); }
    g.restore();
    hexPath(g, 0, 0, Ri); g.lineWidth = R * .06; g.strokeStyle = '#0D0E16'; g.stroke();
    // Отлив снизу.
    g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(-R * .5, R * .74, R, R * .06);
  }
  function glowIn(c, r, col, a) {
    if (a <= .01) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, rgbaHex(col, a)); g.addColorStop(1, rgbaHex(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.restore();
  }
  A.city = {
    empty(c, R) { hexPath(c, 0, 0, R * .93); c.fillStyle = 'rgba(14,14,24,.72)'; c.fill(); c.lineWidth = 1; c.strokeStyle = 'rgba(170,180,220,.15)'; c.stroke(); },
    tile(c, R, color, o) {
      blit(c, sprite('nc' + color + o.v, R, (g, R) => windowTile(g, R, color, o.v)), R);
      const t = o.t, v = o.v, Ri = R * .8, a = o.board ? o.age : 99;
      c.save(); hexPath(c, 0, 0, Ri); c.clip();
      if (v === 4) {
        // Телевизор: голубые отсветы то ярче, то тусклее.
        const f = .5 + .5 * Math.sin(t * 7 + o.seed) * Math.sin(t * 2.3 + o.seed * 3);
        c.fillStyle = `rgba(120,170,255,${.08 + .16 * f})`; c.fillRect(-R, -R, 2 * R, 2 * R);
      } else if (v === 6) {
        // Неоновая вывеска в окне: иногда подмигивает.
        const fl = Math.sin(t * .9 + o.seed) > .96 && Math.sin(t * 40) > 0 ? .25 : 1;
        c.lineCap = 'round'; c.lineJoin = 'round';
        // Неоновый бокал с вишенкой.
        c.beginPath(); c.moveTo(-Ri * .42, -Ri * .38); c.lineTo(Ri * .42, -Ri * .38); c.lineTo(0, Ri * .05); c.closePath();
        c.moveTo(0, Ri * .05); c.lineTo(0, Ri * .42); c.moveTo(-Ri * .22, Ri * .42); c.lineTo(Ri * .22, Ri * .42);
        c.moveTo(Ri * .22, -Ri * .38); c.lineTo(Ri * .38, -Ri * .62);
        c.strokeStyle = rgbaHex(color, .35 * fl); c.lineWidth = Ri * .22; c.stroke();
        c.strokeStyle = mix(color, 'w', .35); c.globalAlpha *= fl; c.lineWidth = Ri * .07; c.stroke(); c.globalAlpha /= fl;
      } else if (v === 8) {
        for (let i = 0; i < 6; i++) {
          const x = -Ri * .8 + i * Ri * .32, y = -Ri * .55 + Ri * .4 * (1 - Math.pow((x / Ri), 2)) * .95;
          const p = .55 + .45 * Math.sin(t * 2 + i * 1.3 + o.seed);
          c.fillStyle = `rgba(255,${200 + i * 8},140,${.5 + .5 * p})`; c.beginPath(); c.arc(x, y + Ri * .04, Ri * .05, 0, TAU); c.fill();
        }
      } else if (v === 0 || v === 3) {
        c.save(); c.translate(0, -Ri * .25); glowIn(c, Ri * .7, mix(color, 'w', .3).replace(/rgb\((\d+),(\d+),(\d+)\)/, (m, r, gg, b) => '#' + [r, gg, b].map(n => (+n).toString(16).padStart(2, '0')).join('')), .12 + .03 * Math.sin(t * 1.5 + o.seed)); c.restore();
      }
      // Капля медленно сползает по стеклу.
      const sp = .18 + (o.seed % 7) * .02, ph = ((t * sp + o.seed * .137) % 1.6);
      if (ph < 1) {
        const x = ((o.seed * 37) % 13 - 6) / 6 * Ri * .6, y = -Ri * .9 + ph * Ri * 1.8, r = Ri * .055;
        c.strokeStyle = 'rgba(255,255,255,.1)'; c.lineWidth = r * .9; c.beginPath(); c.moveTo(x, y - Ri * .35 * Math.min(1, ph * 3)); c.lineTo(x, y); c.stroke();
        c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.arc(x, y + r * .3, r, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.arc(x - r * .3, y - r * .3, r * .45, 0, TAU); c.fill();
      }
      // Свет включается с тихим морганием, как старая лампа.
      if (a < .55) {
        const on = a > .38 ? 1 : a > .3 ? .25 : a > .2 ? .85 : a > .12 ? .2 : 0;
        c.fillStyle = `rgba(4,4,10,${.85 * (1 - on)})`; c.fillRect(-R, -R, 2 * R, 2 * R);
      }
      c.restore();
    },
    bg(c, w, h, info) {
      const st = cacheBy(NC.statics, (info.preview ? 'p' : '') + w + 'x' + h, () => ncStatic(w, h, info.preview));
      c.drawImage(st.cv, 0, 0);
      if (info.preview) return true;
      if (!NC.init || NC.w !== w || NC.h !== h) ncInit(w, h);
      const t = K.time();
      // Красные огоньки на крышах мигают медленно.
      const bl = Math.max(0, Math.sin(t * 2.2));
      if (bl > .2) [[.12, .52], [.66, .47], [.9, .58]].forEach(([x, y]) => { c.fillStyle = `rgba(255,60,60,${.55 * bl})`; c.beginPath(); c.arc(x * w, y * st.hz * 1.02, 1.8, 0, TAU); c.fill(); });
      ncRain(c, false);
      return true;
    },
    over(c, info) {
      ncRain(c, true);
      // Брызги капель на окнах.
      const dt = 1 / 60;
      if (Math.random() < .12 && info) NC.splashes.push({ x: info.cx + rnd(-150, 150), y: info.cy + rnd(-130, 130), t: 0 });
      for (let i = NC.splashes.length - 1; i >= 0; i--) {
        const s = NC.splashes[i]; s.t += dt;
        if (s.t > .35) { NC.splashes.splice(i, 1); continue; }
        const k = s.t / .35;
        c.strokeStyle = `rgba(200,215,245,${.35 * (1 - k)})`; c.lineWidth = 1;
        c.beginPath(); c.ellipse(s.x, s.y, 2 + 7 * k, 1 + 3 * k, 0, 0, TAU); c.stroke();
      }
    },
    breakFx(api, x, y, color) {
      for (let i = 0; i < 7; i++) api.push({ k: 'glass', x, y, vx: rnd(-180, 180), vy: rnd(-240, -30), g: 850, t: 0, life: rnd(.55, .9), color: 'rgba(220,230,255,.8)', r: rnd(3, 7), rot: rnd(0, TAU), vr: rnd(-14, 14) });
      api.push({ k: 'glow', x, y, vx: 0, vy: -10, g: 0, t: 0, life: .5, color: rgbaHex(color, .45), r: 9 });
      for (let i = 0; i < 5; i++) api.push({ k: 'drop', x, y, vx: rnd(-110, 110), vy: rnd(-200, -60), g: 700, t: 0, life: rnd(.5, .8), color: 'rgba(170,195,235,.7)', r: rnd(1.5, 2.6) });
      return true;
    }
  };
})();
