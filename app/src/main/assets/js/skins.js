/* 20 скинов: палитра из 6 цветов, стиль отрисовки соты, фон и цвет пустых клеток. */
(() => {
  'use strict';
  const HB = window.HB;
  const { TAU } = HB.util;

  const L = (id, name, price, style, colors, bg, empty, extra = {}) => Object.assign({ id, name, price, style, colors, bg, empty }, extra);
  const list = [
    L('classic', 'Классика', 0, 'gloss', ['#FF6B6B', '#FFC857', '#4ADE9C', '#4CC9F0', '#A78BFA', '#FF8FD1'], ['#221E4C', '#131130'], '#2A2656'),
    L('pastel', 'Пастель', 80, 'flat', ['#FFB3BA', '#FFDFBA', '#FFF5A5', '#BAFFC9', '#BAE1FF', '#E0BBFF'], ['#2B2640', '#1C1830'], '#38324F'),
    L('forest', 'Лес', 80, 'flat', ['#7BC96F', '#C9E265', '#4E9F3D', '#E8D59E', '#88B04B', '#F2A65A'], ['#1B2B22', '#0F1A14'], '#26382D'),
    L('mono', 'Монохром', 90, 'outline', ['#FFFFFF', '#D4D4D8', '#A1A1AA', '#E4E4E7', '#F4F4F5', '#BDBDC4'], ['#1C1C22', '#0E0E12'], '#2A2A33'),
    L('honey', 'Мёд', 100, 'gloss', ['#FFB300', '#FFCA28', '#F57F17', '#FFE082', '#FF8F00', '#FFD54F'], ['#3A2410', '#1E1208'], '#4A3018'),
    L('candy', 'Конфеты', 110, 'candy', ['#FF5C8A', '#FFB938', '#3DDC97', '#46B1FF', '#B57BFF', '#FF7F50'], ['#2A1840', '#170D26'], '#36214F'),
    L('choco', 'Шоколад', 110, 'gloss', ['#8D5524', '#C68642', '#E0AC69', '#6B3A1E', '#A0522D', '#F1C27D'], ['#2B1A12', '#160D08'], '#3A2519'),
    L('retro', 'Ретро 8-бит', 120, 'pixel', ['#E83B3B', '#F9C22B', '#3CA370', '#4D9BE6', '#8F4FC2', '#FB6B1D'], ['#1B1B2F', '#0F0F1E'], '#2B2B45'),
    L('neon', 'Неон', 130, 'neon', ['#FF2E88', '#FFE600', '#00FFA3', '#00D1FF', '#B84DFF', '#FF7A00'], ['#0D0A1F', '#05040E'], '#17132E'),
    L('ocean', 'Океан', 140, 'glass', ['#00B4D8', '#48CAE4', '#0077B6', '#90E0EF', '#00F5D4', '#4895EF'], ['#06283D', '#021320'], '#0E3A55'),
    L('sakura', 'Сакура', 140, 'bubble', ['#FFB7C5', '#FF8FAB', '#FB6F92', '#FFE5EC', '#F4ACB7', '#E5989B'], ['#3A1E2E', '#1F0F18'], '#4A2A3C'),
    L('jelly', 'Мармелад', 150, 'bubble', ['#FF3D3D', '#FFD000', '#2EE66B', '#1EA7FF', '#C04DFF', '#FF8A00'], ['#221A3D', '#120E22'], '#2F2652'),
    L('lava', 'Лава', 170, 'gem', ['#FF3D00', '#FF9100', '#FFC400', '#D50000', '#FF6D00', '#FFAB40'], ['#2A0A06', '#140402'], '#3D1510'),
    L('ice', 'Лёд', 170, 'glass', ['#E0F7FF', '#A5E9FF', '#7FD8FF', '#C7F0FF', '#58C4F6', '#BDEBFF'], ['#132F4C', '#0A1A2E'], '#1D4166'),
    L('sunset', 'Закат', 180, 'gloss', ['#FF6B6B', '#FFA36C', '#FFD166', '#C06C84', '#8E6BBF', '#F67280'], ['#2D1B3D', '#170D22'], '#3B2750'),
    L('toxic', 'Токсик', 190, 'neon', ['#B6FF00', '#39FF14', '#00FF9C', '#E4FF1A', '#7CFF00', '#00FFCC'], ['#0B1A0B', '#040A04'], '#152915'),
    L('gems', 'Самоцветы', 220, 'gem', ['#E0115F', '#FFC300', '#50C878', '#0F52BA', '#9966CC', '#FF7F50'], ['#1A1433', '#0C0A1C'], '#2A2250'),
    L('space', 'Космос', 240, 'neon', ['#A78BFA', '#F0ABFC', '#67E8F9', '#FDE68A', '#818CF8', '#F472B6'], ['#0B0820', '#000000'], '#16123A', { stars: true }),
    L('gold', 'Золото', 280, 'metal', ['#FFD700', '#FFC125', '#E6B800', '#FFDF5F', '#D4AF37', '#F9E076'], ['#231C0A', '#110D03'], '#342A10'),
    L('rainbow', 'Радуга', 400, 'rainbow', ['#FF6B6B', '#FFC857', '#4ADE9C', '#4CC9F0', '#A78BFA', '#FF8FD1'], ['#1E1B3A', '#0E0C1F'], '#2A2656')
  ];
  const tier = p => p === 0 ? 'Базовый' : p < 120 ? 'Обычный' : p < 200 ? 'Редкий' : p < 300 ? 'Эпический' : 'Легендарный';

  /* ---------- цвета ---------- */
  const mixCache = new Map();
  function mix(hex, to, k) {
    const key = hex + to + k;
    let v = mixCache.get(key);
    if (v) return v;
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = to === 'w' ? 255 : 0;
    v = `rgb(${Math.round(r + (t - r) * k)},${Math.round(g + (t - g) * k)},${Math.round(b + (t - b) * k)})`;
    mixCache.set(key, v);
    return v;
  }

  function hexPath(c, cx, cy, r, rot = 0) {
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 180 * (60 * i - 30) + rot;
      const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath();
  }

  let time = 0;
  /** Рисует одну соту радиуса R с центром (x, y) в стиле скина. */
  function tile(c, x, y, R, color, skin, o = {}) {
    const alpha = o.alpha == null ? 1 : o.alpha;
    if (R <= .3 || alpha <= .01) return;
    let style = skin.style;
    if (style === 'rainbow') {
      color = `hsl(${((time * 55 + x * .9 + y * .6) % 360 + 360) % 360} 88% 62%)`;
      style = 'gloss';
    }
    c.save();
    c.globalAlpha *= alpha;
    c.translate(x, y);
    if (o.rot) c.rotate(o.rot);
    switch (style) {
      case 'flat':
        hexPath(c, 0, 0, R); c.fillStyle = color; c.fill(); c.save(); c.clip();
        c.lineWidth = R * .2; c.strokeStyle = 'rgba(0,0,0,.14)'; c.stroke();
        c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(-R, -R, 2 * R, R * .35);
        c.restore(); break;
      case 'neon':
        hexPath(c, 0, 0, R * .84); c.fillStyle = color; c.globalAlpha *= .18; c.fill(); c.globalAlpha /= .18;
        c.lineJoin = 'round';
        c.lineWidth = R * .34; c.strokeStyle = color; c.globalAlpha *= .3; c.stroke(); c.globalAlpha /= .3;
        c.lineWidth = R * .13; c.stroke();
        c.lineWidth = R * .045; c.strokeStyle = 'rgba(255,255,255,.8)'; c.stroke();
        hexPath(c, 0, 0, R); break;
      case 'candy':
        hexPath(c, 0, 0, R); c.fillStyle = color; c.fill(); c.save(); c.clip();
        c.strokeStyle = 'rgba(255,255,255,.26)'; c.lineWidth = R * .22;
        c.beginPath();
        for (let k = -3; k <= 3; k++) { c.moveTo(k * R * .62 - R, R); c.lineTo(k * R * .62 + R, -R); }
        c.stroke();
        c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(-R, -R, 2 * R, R * .5);
        c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(-R, R * .5, 2 * R, R);
        c.restore(); break;
      case 'gem': {
        hexPath(c, 0, 0, R); c.fillStyle = color; c.fill();
        for (let i = 0; i < 6; i++) {
          const a0 = Math.PI / 180 * (60 * i - 30), a1 = a0 + Math.PI / 3;
          c.beginPath();
          c.moveTo(R * Math.cos(a0), R * Math.sin(a0)); c.lineTo(R * Math.cos(a1), R * Math.sin(a1));
          c.lineTo(R * .5 * Math.cos(a1), R * .5 * Math.sin(a1)); c.lineTo(R * .5 * Math.cos(a0), R * .5 * Math.sin(a0));
          c.closePath();
          c.fillStyle = [ 'rgba(255,255,255,.3)', 'rgba(255,255,255,.12)', 'rgba(0,0,0,.08)', 'rgba(0,0,0,.2)', 'rgba(0,0,0,.1)', 'rgba(255,255,255,.2)' ][i];
          c.fill();
        }
        hexPath(c, 0, 0, R * .5); c.fillStyle = mix(color.startsWith('#') ? color : '#888888', 'w', .3); c.fill();
        c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(-R * .18, -R * .2, R * .1, 0, TAU); c.fill();
        hexPath(c, 0, 0, R); break;
      }
      case 'glass':
        hexPath(c, 0, 0, R); c.fillStyle = color; c.globalAlpha *= .55; c.fill(); c.globalAlpha /= .55;
        c.save(); c.clip();
        c.fillStyle = 'rgba(255,255,255,.45)';
        c.beginPath(); c.ellipse(-R * .25, -R * .45, R * .55, R * .22, -.5, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(-R, R * .3, 2 * R, R);
        c.restore();
        hexPath(c, 0, 0, R * .95); c.lineWidth = R * .09; c.strokeStyle = 'rgba(255,255,255,.6)'; c.stroke();
        hexPath(c, 0, 0, R); break;
      case 'bubble':
        hexPath(c, 0, 0, R); c.fillStyle = color; c.fill(); c.save(); c.clip();
        c.fillStyle = 'rgba(0,0,0,.14)'; c.beginPath(); c.arc(R * .15, R * .25, R * .95, 0, TAU); c.arc(R * .15, R * 1.9, R * 1.6, 0, TAU, true); c.fill();
        c.fillStyle = 'rgba(255,255,255,.38)'; c.beginPath(); c.arc(-R * .3, -R * .32, R * .32, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(-R * .08, -R * .55, R * .1, 0, TAU); c.fill();
        c.restore(); break;
      case 'pixel': {
        hexPath(c, 0, 0, R); c.fillStyle = mix(color, 'k', .22); c.fill();
        hexPath(c, 0, 0, R * .78); c.fillStyle = color; c.fill();
        const p = R * .2;
        c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(-R * .45, -R * .5, p, p); c.fillRect(-R * .45 + p, -R * .5, p, p); c.fillRect(-R * .45, -R * .5 + p, p, p);
        c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(R * .25, R * .3, p, p);
        hexPath(c, 0, 0, R); break;
      }
      case 'metal': {
        const cache = c.__hbGrad || (c.__hbGrad = new Map());
        const key = color + '|' + Math.round(R * 2);
        let g = cache.get(key);
        if (!g) {
          g = c.createLinearGradient(0, -R, 0, R);
          g.addColorStop(0, mix(color, 'w', .6)); g.addColorStop(.42, color);
          g.addColorStop(.55, mix(color, 'k', .28)); g.addColorStop(1, mix(color, 'w', .15));
          cache.set(key, g);
        }
        hexPath(c, 0, 0, R); c.fillStyle = g; c.fill(); c.save(); c.clip();
        c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = R * .06;
        c.beginPath(); c.moveTo(-R, -R * .3); c.lineTo(R, -R * .5); c.stroke();
        c.restore();
        c.lineWidth = R * .07; c.strokeStyle = mix(color, 'k', .35); c.stroke();
        break;
      }
      case 'outline':
        hexPath(c, 0, 0, R * .86); c.fillStyle = skin.empty; c.fill();
        c.lineJoin = 'round'; c.lineWidth = R * .22; c.strokeStyle = color; c.stroke();
        hexPath(c, 0, 0, R * .36); c.fillStyle = color; c.fill();
        hexPath(c, 0, 0, R); break;
      default: // gloss
        hexPath(c, 0, 0, R); c.fillStyle = color; c.fill(); c.save(); c.clip();
        c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(-R, -R, 2 * R, R * .72);
        c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(-R, R * .45, 2 * R, R);
        c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(-R * .3, -R * .52, R * .2, R * .09, -.4, 0, TAU); c.fill();
        c.restore();
    }
    if (o.flash > 0) {
      hexPath(c, 0, 0, R);
      c.fillStyle = `rgba(255,255,255,${Math.min(1, o.flash)})`; c.fill();
    }
    c.restore();
  }

  function preview(canvas, skin) {
    const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, skin.bg[0]); g.addColorStop(1, skin.bg[1]);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    if (skin.stars) {
      for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(255,255,255,${.2 + (i % 5) * .12})`; c.fillRect((i * 97) % w, (i * 53) % h, 2, 2); }
    }
    const R = Math.min(w, h) * .17, cx = w / 2, cy = h / 2, S3 = Math.sqrt(3);
    const pos = [[0, 0], [1, 0], [-1, 0], [.5, -1], [-.5, -1], [.5, 1], [-.5, 1]];
    pos.forEach(([dx, dy], i) => {
      const x = cx + dx * S3 * R, y = cy + dy * 1.5 * R;
      tile(c, x, y, R * .95, skin.colors[i % 6], skin);
    });
  }

  HB.skins = {
    list, tier, tile, preview, hexPath, mix,
    get: id => list.find(s => s.id === id) || list[0],
    current: () => HB.skins.get(HB.profile.skin),
    tick(dt) { time += dt; }
  };
})();
