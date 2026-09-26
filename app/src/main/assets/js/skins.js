/*
 * Скины: список, базовые стили отрисовки и общий движок. Тематические скины
 * (лес, мёд, шоколад, неон, океан…) рисуются своими отрисовщиками из skinart.js:
 * у каждого 10 видов сот, свои анимации и свой эффект разрушения.
 */
(() => {
  'use strict';
  const HB = window.HB;
  const TAU = Math.PI * 2;

  const L = (id, name, price, style, colors, bg, empty, extra = {}) => Object.assign({ id, name, price, style, colors, bg, empty }, extra);
  const list = [
    L('classic', 'Классика', 0, 'gloss', ['#FF6B6B', '#FFC857', '#4ADE9C', '#4CC9F0', '#A78BFA', '#FF8FD1'], ['#221E4C', '#131130'], '#2A2656'),
    L('pastel', 'Пастель', 80, 'flat', ['#FFB3BA', '#FFDFBA', '#FFF5A5', '#BAFFC9', '#BAE1FF', '#E0BBFF'], ['#2B2640', '#1C1830'], '#38324F'),
    L('forest', 'Лес', 80, 'flat', ['#6DBB5A', '#8CCB4F', '#4E9F3D', '#7FB24A', '#5DA94E', '#94C45E'], ['#1B2B22', '#0F1A14'], '#2B2218'),
    L('mono', 'Монохром', 90, 'outline', ['#FFFFFF', '#D4D4D8', '#A1A1AA', '#E4E4E7', '#F4F4F5', '#BDBDC4'], ['#1C1C22', '#0E0E12'], '#2A2A33'),
    L('honey', 'Мёд', 100, 'gloss', ['#FFB300', '#FFA000', '#F59300', '#FFC02E', '#FF9A00', '#FFB81C'], ['#3A2410', '#1E1208'], '#4A3018'),
    L('candy', 'Конфеты', 110, 'candy', ['#FF5C8A', '#FFB938', '#3DDC97', '#46B1FF', '#B57BFF', '#FF7F50'], ['#2A1840', '#170D26'], '#36214F'),
    L('choco', 'Шоколад', 110, 'gloss', ['#7B4520', '#A0612F', '#5C3317', '#8D5524', '#6B3A1E', '#B87942'], ['#2B1A12', '#160D08'], '#3A2519'),
    L('retro', 'Ретро 8-бит', 120, 'pixel', ['#E83B3B', '#F9C22B', '#3CA370', '#4D9BE6', '#8F4FC2', '#FB6B1D'], ['#1B1B2F', '#0F0F1E'], '#2B2B45'),
    L('neon', 'Неон', 130, 'neon', ['#FF2E88', '#FFE600', '#00FFA3', '#00D1FF', '#B84DFF', '#FF7A00'], ['#0D0A1F', '#05040E'], '#120F26'),
    L('ocean', 'Океан', 140, 'glass', ['#00B4D8', '#48CAE4', '#0096C7', '#6FD3EA', '#00C2B8', '#4895EF'], ['#06283D', '#021320'], '#0B3350'),
    L('sakura', 'Сакура', 140, 'bubble', ['#FFB7C5', '#FF8FAB', '#FB6F92', '#FFE5EC', '#F4ACB7', '#E5989B'], ['#3A1E2E', '#1F0F18'], '#4A2A3C'),
    L('jelly', 'Мармелад', 150, 'bubble', ['#FF1F4B', '#FFC400', '#19E55C', '#1E9BFF', '#B530FF', '#FF7A00'], ['#221A3D', '#120E22'], '#2F2652'),
    L('lava', 'Магма', 170, 'gem', ['#FF3D00', '#FF9100', '#FFC400', '#FF1A00', '#FF6D00', '#FFAB40'], ['#2A0A06', '#140402'], '#1E0E0A'),
    L('ice', 'Стекло', 170, 'glass', ['#FF7AA8', '#7AA2FF', '#5EF0D2', '#FFD36B', '#C38BFF', '#FF9F6B'], ['#141A3A', '#0B0F24'], '#1D2447'),
    L('sunset', 'Закат', 180, 'gloss', ['#FF4D6D', '#D6275F', '#8E1F5C', '#FF6A5C', '#B0245E', '#E8385F'], ['#2D1B3D', '#170D22'], '#2A1438'),
    L('toxic', 'Токсик', 190, 'neonlite', ['#B6FF00', '#39FF14', '#00FF9C', '#E4FF1A', '#7CFF00', '#00FFCC'], ['#0B1A0B', '#040A04'], '#152915'),
    L('gems', 'Самоцветы', 220, 'gem', ['#E0115F', '#FFC300', '#50C878', '#1560D8', '#9966CC', '#FF7F50'], ['#1A1433', '#0C0A1C'], '#2A2250'),
    L('space', 'Космос', 240, 'neonlite', ['#A78BFA', '#F0ABFC', '#67E8F9', '#FDE68A', '#818CF8', '#F472B6'], ['#0B0820', '#000000'], '#16123A', { stars: true }),
    L('gold', 'Золото', 280, 'metal', ['#FFD700', '#FFC125', '#E6B800', '#FFDF5F', '#D4AF37', '#F9E076'], ['#231C0A', '#110D03'], '#342A10'),
    L('clouds', 'Облака', 200, 'art', ['#7EC8FF', '#9FB6FF', '#86E0EE', '#FFB8CF', '#FFD38F', '#B8A8FF'], ['#2F7BE0', '#BFE3FF'], '#A9CDF0'),
    L('fireflies', 'Светлячки', 240, 'art', ['#2E6B4F', '#3F7F5A', '#27594A', '#4A8A5F', '#35705A', '#2B6258'], ['#0B1426', '#0E2A22'], '#10231C'),
    L('vitrage', 'Витраж', 280, 'art', ['#D7263D', '#1B98E0', '#F4D35E', '#2EC4B6', '#8E44AD', '#F46036'], ['#1A1512', '#0D0A08'], '#1E1814'),
    L('aurora', 'Северное сияние', 300, 'art', ['#5CFFB0', '#48D6FF', '#9B7BFF', '#FF7BD5', '#7FFFE0', '#6AA8FF'], ['#040B1E', '#0A1E33'], '#0B1830'),
    L('cyber', 'Киберпанк', 320, 'art', ['#FF2A6D', '#05D9E8', '#D1F7FF', '#FF6C11', '#B967FF', '#01FFC3'], ['#0A0014', '#1A0030'], '#140828'),
    L('flame', 'Пламя', 350, 'art', ['#FF4E1A', '#FF8A00', '#FFB300', '#FF2D2D', '#FF6A00', '#FFC940'], ['#120604', '#2A0A04'], '#1A0C08'),
    L('rainbow', 'Радуга', 400, 'rainbow', ['#FF6B6B', '#FFC857', '#4ADE9C', '#4CC9F0', '#A78BFA', '#FF8FD1'], ['#1E1B3A', '#0E0C1F'], '#2A2656')
  ];
  const tier = p => p === 0 ? 'Базовый' : p < 120 ? 'Обычный' : p < 200 ? 'Редкий' : p < 300 ? 'Эпический' : 'Легендарный';

  /* ---------- утилиты ---------- */
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const mixCache = new Map();
  function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(hex, to, k) {
    const key = hex + to + k;
    let v = mixCache.get(key);
    if (v) return v;
    const [r, g, b] = rgb(hex), t = to === 'w' ? 255 : 0;
    v = `rgb(${Math.round(r + (t - r) * k)},${Math.round(g + (t - g) * k)},${Math.round(b + (t - b) * k)})`;
    if (mixCache.size > 4000) mixCache.clear();
    mixCache.set(key, v);
    return v;
  }
  function lerpHex(a, b, k) {
    const x = rgb(a), y = rgb(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
  }
  function ramp(stops, k) {
    k = clamp(k);
    for (let i = 1; i < stops.length; i++) {
      if (k <= stops[i][0]) {
        const [k0, c0] = stops[i - 1], [k1, c1] = stops[i];
        return lerpHex(c0, c1, (k - k0) / (k1 - k0 || 1));
      }
    }
    return stops[stops.length - 1][1];
  }
  function srng(seed) {
    let s = (Math.imul(seed | 0, 2654435761) ^ 0x9E3779B9) >>> 0;
    if (!s) s = 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  const hash01 = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  function hexPath(c, cx, cy, r, rot = 0) {
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 180 * (60 * i - 30) + rot;
      const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath();
  }
  const inHex = (x, y, R) => Math.abs(x) <= R * .866 && Math.abs(y) <= R - .577 * Math.abs(x);
  const vert = (i, R) => { const a = Math.PI / 180 * (60 * (((i % 6) + 6) % 6) - 30); return [R * Math.cos(a), R * Math.sin(a)]; };
  function star4(c, x, y, r) {
    c.beginPath();
    c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r);
    c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.closePath();
  }

  /* ---------- кэш спрайтов: статичная часть соты рисуется один раз ---------- */
  const cache = new Map();
  const PX = () => HB.skins.pxScale || 2;
  function sprite(key, R, draw) {
    const k = PX(), Rk = Math.max(4, Math.round(R / 2) * 2), size = Math.ceil(Rk * 2.8 * k);
    const ck = key + '|' + size;
    let cv = cache.get(ck);
    if (!cv) {
      if (cache.size > 900) cache.clear();
      cv = document.createElement('canvas');
      cv.width = cv.height = size;
      const g = cv.getContext('2d');
      g.translate(size / 2, size / 2); g.scale(k, k);
      draw(g, Rk);
      cv._r = Rk;
      cache.set(ck, cv);
    }
    return cv;
  }
  function blit(c, cv, R) {
    const s = cv.width / PX() * (R / cv._r);
    c.drawImage(cv, -s / 2, -s / 2, s, s);
  }

  /* ---------- волны (для Океана): одно кольцо, только по связанным сотам ---------- */
  const waves = [];
  const WAVE_SPEED = 120;
  const pkey = (x, y) => Math.round(x) + ',' + Math.round(y);
  function waveAt(x, y) {
    let h = 0;
    for (const w of waves) {
      if (!w.keys.has(pkey(x, y))) continue;
      const bd = w.a * WAVE_SPEED - Math.hypot(x - w.x, y - w.y);
      h += Math.exp(-(bd / 13) * (bd / 13)) * Math.exp(-w.a * 1.1) * w.s;
    }
    return clamp(h, -1.6, 1.6);
  }

  /* ---------- базовые стили для скинов без своего отрисовщика ---------- */
  let time = 0;
  function styleTile(c, R, color, skin, o) {
    let style = skin.style;
    if (style === 'rainbow') {
      color = `hsl(${((time * 55 + o.wx * .9 + o.wy * .6) % 360 + 360) % 360} 88% 62%)`;
      style = 'gloss';
    }
    switch (style) {
      case 'flat':
        hexPath(c, 0, 0, R); c.fillStyle = color; c.fill(); c.save(); c.clip();
        c.lineWidth = R * .2; c.strokeStyle = 'rgba(0,0,0,.14)'; c.stroke();
        c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(-R, -R, 2 * R, R * .35);
        c.restore(); break;
      case 'neonlite':
        hexPath(c, 0, 0, R * .84); c.fillStyle = color; c.globalAlpha *= .18; c.fill(); c.globalAlpha /= .18;
        c.lineJoin = 'round';
        c.lineWidth = R * .34; c.strokeStyle = color; c.globalAlpha *= .3; c.stroke(); c.globalAlpha /= .3;
        c.lineWidth = R * .13; c.stroke();
        c.lineWidth = R * .045; c.strokeStyle = 'rgba(255,255,255,.8)'; c.stroke();
        break;
      case 'candy':
        hexPath(c, 0, 0, R); c.fillStyle = color; c.fill(); c.save(); c.clip();
        c.strokeStyle = 'rgba(255,255,255,.26)'; c.lineWidth = R * .22;
        c.beginPath();
        for (let k = -3; k <= 3; k++) { c.moveTo(k * R * .62 - R, R); c.lineTo(k * R * .62 + R, -R); }
        c.stroke();
        c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(-R, -R, 2 * R, R * .5);
        c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(-R, R * .5, 2 * R, R);
        c.restore(); break;
      case 'glass':
        hexPath(c, 0, 0, R); c.fillStyle = color; c.globalAlpha *= .55; c.fill(); c.globalAlpha /= .55;
        c.save(); c.clip();
        c.fillStyle = 'rgba(255,255,255,.45)';
        c.beginPath(); c.ellipse(-R * .25, -R * .45, R * .55, R * .22, -.5, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(-R, R * .3, 2 * R, R);
        c.restore();
        hexPath(c, 0, 0, R * .95); c.lineWidth = R * .09; c.strokeStyle = 'rgba(255,255,255,.6)'; c.stroke();
        break;
      case 'bubble':
        hexPath(c, 0, 0, R); c.fillStyle = color; c.fill(); c.save(); c.clip();
        c.fillStyle = 'rgba(0,0,0,.14)'; c.beginPath(); c.arc(R * .15, R * .25, R * .95, 0, TAU); c.arc(R * .15, R * 1.9, R * 1.6, 0, TAU, true); c.fill();
        c.fillStyle = 'rgba(255,255,255,.38)'; c.beginPath(); c.arc(-R * .3, -R * .32, R * .32, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(-R * .08, -R * .55, R * .1, 0, TAU); c.fill();
        c.restore(); break;
      case 'outline':
        hexPath(c, 0, 0, R * .86); c.fillStyle = skin.empty; c.fill();
        c.lineJoin = 'round'; c.lineWidth = R * .22; c.strokeStyle = color; c.stroke();
        hexPath(c, 0, 0, R * .36); c.fillStyle = color; c.fill();
        break;
      default:
        hexPath(c, 0, 0, R); c.fillStyle = color; c.fill(); c.save(); c.clip();
        c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(-R, -R, 2 * R, R * .72);
        c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(-R, R * .45, 2 * R, R);
        c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(-R * .3, -R * .52, R * .2, R * .09, -.4, 0, TAU); c.fill();
        c.restore();
    }
  }

  /**
   * Рисует соту радиуса R с центром (x, y).
   * o: v — вид соты 0..9, age — секунд с момента постановки, board — стоит ли на поле,
   * rip — волна от соседней постановки, wx/wy — позиция в мире, seed — стабильный сид.
   */
  function tile(c, x, y, R, color, skin, o = {}) {
    const alpha = o.alpha == null ? 1 : o.alpha;
    if (R <= .3 || alpha <= .01) return;
    const oo = {
      v: (o.v | 0) % 10, age: o.age == null ? 99 : o.age, board: !!o.board, rip: o.rip || 0,
      wx: o.wx == null ? x : o.wx, wy: o.wy == null ? y : o.wy,
      seed: o.seed == null ? ((o.v | 0) * 13 + 1) : o.seed, sk: o.sk, t: time
    };
    c.save();
    c.globalAlpha *= alpha;
    c.translate(x, y);
    if (o.rot) c.rotate(o.rot);
    const art = HB.skins.art[skin.id];
    if (o.grey) styleTile(c, R, '#4A4680', { style: 'gloss' }, oo);
    else if (art) art.tile(c, R, color, oo, skin);
    else styleTile(c, R, color, skin, oo);
    if (o.flash > 0) {
      hexPath(c, 0, 0, R);
      c.fillStyle = `rgba(255,255,255,${Math.min(1, o.flash)})`; c.fill();
    }
    c.restore();
  }
  function empty(c, x, y, R, skin) {
    const art = HB.skins.art[skin.id];
    if (art && art.empty) { c.save(); c.translate(x, y); art.empty(c, R, skin, x, y); c.restore(); return; }
    hexPath(c, x, y, R); c.fillStyle = skin.empty; c.fill();
  }

  function preview(canvas, skin) {
    const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    const art = HB.skins.art[skin.id];
    if (!(art && art.bg && art.bg(c, w, h, { cy: h / 2, preview: true }))) {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, skin.bg[0]); g.addColorStop(1, skin.bg[1]);
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      if (skin.stars) for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(255,255,255,${.2 + (i % 5) * .12})`; c.fillRect((i * 97) % w, (i * 53) % h, 2, 2); }
    }
    const R = Math.min(w, h) * .17, cx = w / 2, cy = h / 2, S3 = Math.sqrt(3);
    const pos = [[0, 0], [1, 0], [-1, 0], [.5, -1], [-.5, -1], [.5, 1], [-.5, 1]];
    pos.forEach(([dx, dy], i) => {
      const x = cx + dx * S3 * R, y = cy + dy * 1.5 * R;
      tile(c, x, y, R * .95, skin.colors[i % 6], skin, { v: [0, 2, 3, 5, 6, 8, 9][i], sk: .25 + (dy + 1) * .35, seed: i * 7 + 3 });
    });
  }

  HB.skins = {
    list, tier, tile, empty, preview, hexPath, mix, lerpHex, ramp, srng, hash01, inHex, vert, star4, sprite, blit, clamp,
    art: {}, waves, waveAt, pxScale: 2, layout: { top: 150, bottom: 600 },
    get: id => list.find(s => s.id === id) || list[0],
    current: () => HB.skins.get(HB.profile.skin),
    time: () => time,
    tick(dt) {
      time += dt;
      for (const w of waves) w.a += dt;
      for (let i = waves.length - 1; i >= 0; i--) if (waves[i].a * WAVE_SPEED > waves[i].reach + 30 || waves[i].a > 3) waves.splice(i, 1);
      const art = HB.skins.art[HB.skins.current().id];
      if (art && art.tick) art.tick(dt);
    },
    /** Хуки для игры: фон, слой поверх поля, постановка и разрушение соты. */
    drawBg(c, w, h, info) { const a = HB.skins.art[HB.skins.current().id]; return !!(a && a.bg && a.bg(c, w, h, info)); },
    drawOver(c, info) { const a = HB.skins.art[HB.skins.current().id]; if (a && a.over) a.over(c, info); },
    onPlace(points, group, center) { const a = HB.skins.art[HB.skins.current().id]; if (a && a.place) a.place(points, group, center); },
    breakFx(api, x, y, color, v) { const a = HB.skins.art[HB.skins.current().id]; return !!(a && a.breakFx && a.breakFx(api, x, y, color, v)); },
    addWave(x, y, s, cells) {
      const reach = Math.max(0, ...cells.map(([cx, cy]) => Math.hypot(cx - x, cy - y)));
      waves.push({ x, y, a: 0, s, cells, reach, keys: new Set(cells.map(([cx, cy]) => pkey(cx, cy))) });
      if (waves.length > 6) waves.shift();
    },
    WAVE_SPEED
  };
})();
