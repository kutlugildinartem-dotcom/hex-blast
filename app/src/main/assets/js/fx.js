/*
 * Частицы, следы за фигурой и эффекты взрыва линий. Всё здесь работает на обычных
 * списках частиц, поэтому одни и те же эффекты крутятся и в игре, и в превью магазина.
 */
(() => {
  'use strict';
  const HB = window.HB, TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const eo = x => 1 - Math.pow(1 - x, 3);
  const hexPath = (...a) => HB.skins.hexPath(...a);
  const star4 = (...a) => HB.skins.star4(...a);
  const RAINBOW = ['#FF5E7E', '#FFB84D', '#FFE45C', '#5EE08A', '#4DC3FF', '#9A7BFF'];

  /* ---------- каталог для магазина ---------- */
  const SOUNDS = [
    { id: 'xylo', name: 'Ксилофон', price: 0, desc: 'Звонкие деревянные ноты и колокольчики' },
    { id: 'glass', name: 'Стеклянные колокольчики', price: 150, desc: 'Хрустальный звон с эхом, как музыкальная шкатулка' },
    { id: 'chip', name: '8-бит', price: 120, desc: 'Чиптюн из старых приставок: квадратные волны и арпеджио' },
    { id: 'kalimba', name: 'Калимба', price: 130, desc: 'Тёплые металлические язычки и мягкий суббас' },
    { id: 'harp', name: 'Арфа', price: 190, desc: 'Живые струны и глиссандо на каждую очистку' },
    { id: 'piano', name: 'Пианино', price: 180, desc: 'Мягкий рояль: аккорды на каждую очистку' },
    { id: 'rhodes', name: 'Лоу-фай Родес', price: 210, desc: 'Бархатное электропиано с тремоло и джазовыми аккордами' },
    { id: 'handpan', name: 'Ханг', price: 200, desc: 'Глубокий металлический купол: долгие медитативные ноты' },
    { id: 'marimba', name: 'Маримба', price: 160, desc: 'Тёплое бархатное дерево с гулким резонатором' },
    { id: 'synth', name: 'Глубокий синт', price: 240, desc: 'Плотный пад, суббас и щипки с эхом. Космическая атмосфера' },
    { id: 'felt', name: 'Тихий мир', price: 170, desc: 'Нежное войлочное пианино с долгим эхом, как в уютных песочницах' }
  ];
  const TRAILS = [
    { id: 'sparks', name: 'Искры', price: 0, desc: 'Мягкие светящиеся искорки цвета фигуры' },
    { id: 'comet', name: 'Комета', price: 80, desc: 'Светящийся хвост, который плавно тает' },
    { id: 'stardust', name: 'Звёздная пыль', price: 90, desc: 'Мерцающие звёздочки медленно оседают' },
    { id: 'snow', name: 'Снег', price: 90, desc: 'Снежинки кружатся и тают' },
    { id: 'hearts', name: 'Сердечки', price: 100, desc: 'Сердечки всплывают и покачиваются' },
    { id: 'petals', name: 'Лепестки', price: 110, desc: 'Лепестки сакуры кружатся и падают' },
    { id: 'bubbles', name: 'Мыльные пузыри', price: 120, desc: 'Переливаются и лопаются' },
    { id: 'notes', name: 'Ноты', price: 130, desc: 'Музыка тянется за фигурой' },
    { id: 'fireflies', name: 'Светлячки', price: 140, desc: 'Тёплые огоньки разлетаются и мерцают' },
    { id: 'fire', name: 'Огонь', price: 150, desc: 'Фигура оставляет пламенный хвост' },
    { id: 'ink', name: 'Чернила', price: 160, desc: 'Цветной дым расплывается, как акварель в воде' },
    { id: 'dandelion', name: 'Одуванчик', price: 120, desc: 'Пушистые семена улетают по ветру' },
    { id: 'butterflies', name: 'Бабочки', price: 170, desc: 'Разноцветные бабочки порхают за фигурой' },
    { id: 'rainbow', name: 'Радуга', price: 190, desc: 'Светящаяся радужная лента' },
    { id: 'aurora', name: 'Северное сияние', price: 210, desc: 'Переливающаяся лента из зелёного, бирюзового и фиолетового' },
    { id: 'electric', name: 'Электричество', price: 220, desc: 'Живой разряд плавно извивается за фигурой' }
  ];
  const BURSTS = [
    { id: 'classic', name: 'Как у скина', price: 0, desc: 'Родной эффект выбранного скина' },
    { id: 'confetti', name: 'Конфетти', price: 100, desc: 'Хлопушка на каждую сгоревшую соту' },
    { id: 'pixel', name: 'Пиксели', price: 130, desc: 'Соты рассыпаются на пиксели' },
    { id: 'paint', name: 'Краска', price: 160, desc: 'Брызги краски, которые стекают по полю' },
    { id: 'bloom', name: 'Цветение', price: 180, desc: 'Каждая сота распускается цветком и рассыпается лепестками' },
    { id: 'fireworks', name: 'Фейерверк', price: 200, desc: 'Ракеты взлетают и взрываются салютом' },
    { id: 'supernova', name: 'Сверхновая', price: 240, desc: 'Соты вспыхивают звёздами и расходятся кольцами света' },
    { id: 'blackhole', name: 'Чёрная дыра', price: 260, desc: 'Соты затягивает в воронку' },
    { id: 'bubbles', name: 'Мыльные пузыри', price: 170, desc: 'Соты становятся переливающимися пузырями, всплывают и лопаются' },
    { id: 'crystal', name: 'Кристаллизация', price: 230, desc: 'Соты промерзают в кристалл и рассыпаются алмазной пылью' },
    { id: 'glitch', name: 'Глитч', price: 210, desc: 'Цифровой сбой: соты рвутся на полосы, двоятся цветом и исчезают' }
  ];

  /* ---------- физика ---------- */
  function update(parts, dt, H = 1000) {
    const out = [];
    for (const p of parts) {
      p.t += dt;
      if (p.t < 0) { out.push(p); continue; }
      if (p.k === 'vortex') {
        const sp = 1 + p.t * 2.5;
        p.ang += p.w * dt * sp;
        p.rad = Math.max(0, p.rad - p.sp * dt * sp);
        p.x = p.cx + Math.cos(p.ang) * p.rad; p.y = p.cy + Math.sin(p.ang) * p.rad;
      } else if (p.k === 'paintdrip') {
        p.y += p.vy * dt; p.vy *= Math.exp(-dt * .5);
      } else if (p.k !== 'hole') {
        p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      }
      if (p.rot != null) p.rot += (p.vr || 0) * dt;
      switch (p.k) {
        case 'conf': p.vx *= Math.exp(-dt * 1.5); if (p.air && p.vy > 150) p.vy = 150; break;
        case 'leaf': p.vx *= Math.exp(-dt * 1.4); if (p.vy > 70) p.vy = 70; break;
        case 'bubble': p.vx = Math.sin(p.t * 7 + p.r) * 18; break;
        case 'firefly': p.vx += rnd(-400, 400) * dt; p.vy += rnd(-400, 400) * dt; p.vx *= .97; p.vy *= .97; break;
        case 'flake': p.vx = Math.sin(p.t * 3 + p.rot) * 25; if (p.vy > 60) p.vy = 60; break;
        case 'petal': p.vx = Math.sin(p.t * 3.2 + p.rot) * 38; if (p.vy > 55) p.vy = 55; break;
        case 'soap': p.vx = Math.sin(p.t * 2.4 + p.r) * 16; break;
        case 'heart': case 'note': p.vx = Math.sin(p.t * 2.6 + p.rot) * 22; break;
        case 'butterfly': p.vx += rnd(-260, 260) * dt; p.vy += rnd(-220, 200) * dt; p.vx *= .98; p.vy *= .98; break;
        case 'seed': p.vx = Math.sin(p.t * 1.8 + p.rot) * 26 + 12; break;
        case 'ink': p.vx *= Math.exp(-dt * 2); p.vy *= Math.exp(-dt * 2); break;
        case 'glow': p.vx *= Math.exp(-dt * 1.5); p.vy *= Math.exp(-dt * 1.5); break;
        case 'trailspark': case 'rocket': case 'zap':
          (p.hx || (p.hx = [])).push(p.x, p.y);
          if (p.hx.length > (p.k === 'rocket' ? 18 : 10)) p.hx.splice(0, 2);
          if (p.k === 'trailspark') { p.vx *= Math.exp(-dt * 1.1); p.vy *= Math.exp(-dt * .6); }
          break;
      }
      if (p.k === 'bub2') { p.vx = Math.sin(p.t * 2.2 + p.ph) * 22; p.vy += (-46 - p.vy) * Math.min(1, dt * 2); }
      if (p.k === 'bub2' && p.t >= p.life) {
        for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + rnd(-.2, .2), v = rnd(70, 150); out.push({ k: 'spark', x: p.x + Math.cos(a) * p.r, y: p.y + Math.sin(a) * p.r, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 260, t: 0, life: rnd(.25, .45), color: RAINBOW[i % 6], r: rnd(.9, 1.5) }); }
        out.push({ k: 'popring', x: p.x, y: p.y, vx: 0, vy: 0, g: 0, t: 0, life: .22, color: '#FFFFFF', r: p.r });
        if (p.snd && HB.sfx.bubblePop) HB.sfx.bubblePop(p.x);
        continue;
      }
      if (p.k === 'crys' && p.t >= p.life) {
        const cols = ['#FFFFFF', '#DDF6FF', p.color];
        for (let i = 0; i < 7; i++) { const a = rnd(0, TAU), v = rnd(80, 230); out.push({ k: 'tri', x: p.x + Math.cos(a) * 5, y: p.y + Math.sin(a) * 5, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90, g: 720, t: 0, life: rnd(.55, .9), color: cols[i % 3], r: rnd(3, 6), rot: rnd(0, TAU), vr: rnd(-14, 14) }); }
        for (let i = 0; i < 8; i++) { const a = rnd(0, TAU), v = rnd(20, 90); out.push({ k: 'star4', soft: true, x: p.x + rnd(-10, 10), y: p.y + rnd(-10, 10), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, g: 30, t: 0, life: rnd(.6, 1.2), color: i % 2 ? '#FFFFFF' : '#BFEFFF', r: rnd(1.5, 3.5) }); }
        continue;
      }
      if (p.k === 'rocket' && p.t >= p.life) {
        const n = 44;
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + rnd(-.06, .06), v = rnd(130, 230) * (p.sm || 1);
          out.push({ k: 'trailspark', x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 170, t: 0, life: rnd(1, 1.5), color: p.cols[i % p.cols.length], r: rnd(1.5, 2.4) });
        }
        for (let i = 0; i < 12; i++) out.push({ k: 'star4', x: p.x + rnd(-40, 40) * (p.sm || 1), y: p.y + rnd(-40, 40) * (p.sm || 1), vx: 0, vy: 30, g: 0, t: -rnd(.25, .7), life: .45, color: p.cols[i % p.cols.length], r: rnd(3, 6) });
        out.push({ k: 'flash', x: p.x, y: p.y, vx: 0, vy: 0, t: 0, life: .3, color: p.cols[0], r: 55 * (p.sm || 1), soft: true });
        if (p.boom && HB.sfx.firework) HB.sfx.firework(p.x, p.salvo || 1);
        continue;
      }
      if (p.t < p.life && p.y < H + 60) out.push(p);
    }
    return out;
  }

  /* ---------- отрисовка ---------- */
  function polyTrail(c, hx) {
    c.beginPath(); c.moveTo(hx[0], hx[1]);
    for (let i = 2; i < hx.length; i += 2) c.lineTo(hx[i], hx[i + 1]);
  }
  // Плавно появиться за первые 15% жизни и мягко погаснуть в последние 45%.
  const smooth = x => x * x * (3 - 2 * x);
  const softEnv = k => Math.min(1, k / .15) * (1 - smooth(clamp((k - .55) / .45)));
  function heartPath(c, x, y, r) {
    c.beginPath(); c.moveTo(x, y + r * .8);
    c.bezierCurveTo(x - r * 1.3, y - r * .1, x - r * .6, y - r * 1.1, x, y - r * .4);
    c.bezierCurveTo(x + r * .6, y - r * 1.1, x + r * 1.3, y - r * .1, x, y + r * .8);
  }
  function draw(c, parts, time) {
    for (const p of parts) {
      if (p.t < 0) continue;
      const k = clamp(p.t / p.life);
      c.globalAlpha = p.soft ? softEnv(k) * (p.a || 1) : p.k === 'conf' ? clamp((1 - k) * 3) : p.k === 'smoke' ? .6 * (1 - k) : 1 - k;
      c.fillStyle = p.color;
      switch (p.k) {
        case 'spark': c.beginPath(); c.arc(p.x, p.y, p.r * (1 - k * .6), 0, TAU); c.fill(); break;
        case 'shard': hexPath(c, p.x, p.y, p.r * (1 - k * .5), p.rot); c.fill(); break;
        case 'drop': {
          const sp = Math.hypot(p.vx, p.vy), a = Math.atan2(p.vy, p.vx);
          c.save(); c.translate(p.x, p.y); c.rotate(a);
          if (p.glow) c.globalCompositeOperation = 'lighter';
          c.beginPath(); c.ellipse(0, 0, p.r * (1 + sp / 260), p.r * (1 - k * .3), 0, 0, TAU); c.fill();
          c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(p.r * .3, -p.r * .3, p.r * .4, p.r * .22, 0, 0, TAU); c.fill();
          c.restore(); break;
        }
        case 'smoke': c.beginPath(); c.arc(p.x, p.y, p.r * (1 + k * 1.2), 0, TAU); c.fill(); break;
        case 'leaf': {
          c.save(); c.translate(p.x + Math.sin(p.t * 7 + p.rot) * 6, p.y); c.rotate(p.rot);
          c.beginPath(); c.ellipse(0, 0, p.r, p.r * .45, 0, 0, TAU); c.fill();
          c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = .8; c.beginPath(); c.moveTo(-p.r, 0); c.lineTo(p.r, 0); c.stroke();
          c.restore(); break;
        }
        case 'crumb': c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.r / 2, -p.r * .35, p.r, p.r * .7); c.restore(); break;
        case 'pixel': c.fillRect(Math.round(p.x / 3) * 3, Math.round(p.y / 3) * 3, p.r, p.r); break;
        case 'pix': c.globalAlpha = 1 - clamp((k - .55) / .45); c.fillRect(Math.round(p.x / 2) * 2, Math.round(p.y / 2) * 2, p.r, p.r); break;
        case 'bolt': {
          c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = p.color; c.lineWidth = 2.2; c.lineCap = 'round';
          const a = Math.atan2(p.vy, p.vx), L = p.r * 2.2;
          c.beginPath(); c.moveTo(p.x, p.y);
          for (let i = 1; i <= 4; i++) c.lineTo(p.x - Math.cos(a) * L * i / 4 + rnd(-4, 4), p.y - Math.sin(a) * L * i / 4 + rnd(-4, 4));
          c.stroke(); c.strokeStyle = '#FFFFFF'; c.lineWidth = .8; c.stroke();
          c.restore(); break;
        }
        case 'glass': c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.strokeStyle = p.color; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-p.r, 0); c.lineTo(p.r, p.r * .3); c.stroke(); c.restore(); break;
        case 'ember': {
          c.save(); c.globalCompositeOperation = 'lighter';
          c.globalAlpha *= p.soft ? .75 + .25 * Math.sin(p.t * 7 + p.r * 9) : .6 + .4 * Math.sin(p.t * 30 + p.r * 9);
          c.beginPath(); c.arc(p.x, p.y, p.r * 2.4, 0, TAU); c.globalAlpha *= .3; c.fill(); c.globalAlpha /= .3;
          c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill();
          c.restore(); break;
        }
        case 'blob': {
          const st = clamp(Math.abs(p.vy) / 700, 0, .5);
          c.beginPath(); c.ellipse(p.x, p.y, p.r * (1 - st * .4), p.r * (1 + st), 0, 0, TAU); c.fill();
          c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(p.x - p.r * .3, p.y - p.r * .35, p.r * .28, 0, TAU); c.fill();
          break;
        }
        case 'star4': {
          const tw = p.soft ? .85 + .15 * Math.sin(p.t * 6 + p.r * 3) : .7 + .3 * Math.sin(p.t * 20);
          c.save(); c.globalCompositeOperation = 'lighter'; star4(c, p.x, p.y, p.r * (p.soft ? 1 - k * .35 : 1 - k * .7) * tw); c.fill(); c.restore(); break;
        }
        case 'glow': {
          c.save(); c.globalCompositeOperation = 'lighter';
          const r = p.r * (1 - k * .3), g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
          g.addColorStop(0, p.color); g.addColorStop(.25, p.color); g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r * 3, 0, TAU); c.fill();
          c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(p.x, p.y, r * .45, 0, TAU); c.fill();
          c.restore(); break;
        }
        case 'heart': {
          const s = p.r * (p.t < .2 ? .5 + 2.5 * p.t : 1);
          c.save(); c.translate(p.x, p.y); c.rotate(Math.sin(p.t * 3 + p.rot) * .25);
          heartPath(c, 0, 0, s); c.fill();
          c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(-s * .35, -s * .3, s * .22, s * .13, -.6, 0, TAU); c.fill();
          c.restore(); break;
        }
        case 'note': {
          c.save(); c.translate(p.x, p.y); c.rotate(Math.sin(p.t * 2.5 + p.rot) * .2);
          const s = p.r;
          c.beginPath(); c.ellipse(0, 0, s * .6, s * .45, -.4, 0, TAU); c.fill();
          c.fillRect(s * .42, -s * 2.2, s * .18, s * 2.2);
          if (p.rot > 3) c.fillRect(s * .42 - s * 1.35, -s * 2.2, s * 1.53, s * .3);
          else { c.beginPath(); c.moveTo(s * .6, -s * 2.2); c.quadraticCurveTo(s * 1.4, -s * 1.7, s * 1, -s * 1.1); c.lineTo(s * .6, -s * 1.6); c.fill(); }
          if (p.rot > 3) { c.beginPath(); c.ellipse(-s * 1.1, s * .1, s * .6, s * .45, -.4, 0, TAU); c.fill(); c.fillRect(-s * .68, -s * 2.1, s * .18, s * 2.2); }
          c.restore(); break;
        }
        case 'butterfly': {
          const flap = .25 + .75 * Math.abs(Math.sin(p.t * 13 + p.rot));
          c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx) * .25 + Math.sin(p.t * 3) * .2);
          const r = p.r;
          [-1, 1].forEach(s => {
            c.save(); c.scale(s * flap, 1);
            c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(r * .9, -r * 1.2, r * 1.5, -r * .2, r * .2, r * .1); c.fill();
            c.globalAlpha *= .85; c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(r * .9, r * .2, r * .9, r * 1, r * .1, r * .4); c.fill(); c.globalAlpha /= .85;
            c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.arc(r * .55, -r * .5, r * .16, 0, TAU); c.fill();
            c.restore(); c.fillStyle = p.color;
          });
          c.fillStyle = '#2A1A30'; c.fillRect(-r * .06, -r * .45, r * .12, r * .9);
          c.restore(); break;
        }
        case 'seed': {
          c.save(); c.translate(p.x, p.y); c.rotate(Math.sin(p.t * 1.6 + p.rot) * .3);
          c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = .8;
          c.beginPath(); c.moveTo(0, 0); c.lineTo(0, p.r * 1.6); c.stroke();
          c.fillStyle = '#C9B28A'; c.beginPath(); c.ellipse(0, p.r * 1.7, p.r * .12, p.r * .28, 0, 0, TAU); c.fill();
          c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = .6; c.beginPath();
          for (let i = 0; i < 10; i++) { const a = -Math.PI + i / 9 * Math.PI; c.moveTo(0, 0); c.lineTo(Math.cos(a) * p.r, Math.sin(a) * p.r * .8); }
          c.stroke();
          c.restore(); break;
        }
        case 'bloom': {
          const open = eo(clamp(p.t / .35)), fade = 1 - clamp((p.t - .6) / .4);
          c.globalAlpha = fade;
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot + open * .6);
          for (let i = 0; i < 6; i++) {
            const a = i * TAU / 6;
            c.fillStyle = i % 2 ? p.color : HB.skins.mix(p.color, 'w', .35);
            c.beginPath(); c.ellipse(Math.cos(a) * p.r * .45 * open, Math.sin(a) * p.r * .45 * open, p.r * .55 * open + .5, p.r * .28 * open + .5, a, 0, TAU); c.fill();
          }
          c.fillStyle = '#FFE066'; c.beginPath(); c.arc(0, 0, p.r * .22 * open + .5, 0, TAU); c.fill();
          c.restore(); break;
        }
        case 'nova': {
          c.save(); c.globalCompositeOperation = 'lighter';
          const rr = p.r * (.3 + eo(k) * 2.4);
          c.globalAlpha = 1 - k; c.strokeStyle = p.color; c.lineWidth = 3 * (1 - k) + .5;
          c.beginPath(); c.arc(p.x, p.y, rr, 0, TAU); c.stroke();
          const cg = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.6);
          cg.addColorStop(0, `rgba(255,255,255,${Math.max(0, 1 - k * 2.2)})`); cg.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = cg; c.beginPath(); c.arc(p.x, p.y, p.r * 1.6, 0, TAU); c.fill();
          c.strokeStyle = `rgba(255,255,255,${.7 * (1 - k)})`; c.lineWidth = 1.2;
          for (let i = 0; i < 4; i++) { const a = p.rot + i * Math.PI / 2 + k; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + Math.cos(a) * rr * 1.2, p.y + Math.sin(a) * rr * 1.2); c.stroke(); }
          c.restore(); break;
        }
        case 'ripple': {
          c.strokeStyle = p.color; c.lineWidth = 2 * (1 - k) + .5;
          c.beginPath(); c.ellipse(p.x, p.y, p.r * (.3 + k), p.r * (.22 + k * .75), 0, 0, TAU); c.stroke();
          break;
        }
        case 'fireball': {
          const R0 = p.r * (.45 + eo(k) * 1.1);
          c.save(); c.globalAlpha = 1;
          if (k < .55) {
            c.globalCompositeOperation = 'lighter';
            const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, R0);
            const hot = 1 - k / .55;
            g.addColorStop(0, `rgba(255,250,220,${hot})`); g.addColorStop(.3, `rgba(255,200,90,${.9 * hot + .1})`);
            g.addColorStop(.65, `rgba(255,110,30,${.7 * hot})`); g.addColorStop(1, 'rgba(120,30,10,0)');
            c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, R0, 0, TAU); c.fill();
          }
          const sa = clamp((k - .25) / .4) * (1 - clamp((k - .7) / .3));
          if (sa > 0) {
            c.globalCompositeOperation = 'source-over';
            const g2 = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, R0 * 1.1);
            g2.addColorStop(0, `rgba(45,32,28,${.75 * sa})`); g2.addColorStop(1, 'rgba(45,32,28,0)');
            c.fillStyle = g2; c.beginPath(); c.arc(p.x, p.y, R0 * 1.1, 0, TAU); c.fill();
          }
          c.restore(); break;
        }
        case 'smoke2': {
          const R0 = p.r * (1 + eo(k) * 1.8), a = .55 * Math.min(1, p.t * 4) * (1 - k);
          const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, R0);
          g.addColorStop(0, `rgba(${p.color},${a})`); g.addColorStop(1, `rgba(${p.color},0)`);
          c.globalAlpha = 1; c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, R0, 0, TAU); c.fill();
          break;
        }
        case 'debris': {
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
          c.beginPath(); c.moveTo(-p.r, -p.r * .4); c.lineTo(-p.r * .2, -p.r * .8); c.lineTo(p.r, -p.r * .2); c.lineTo(p.r * .5, p.r * .7); c.lineTo(-p.r * .6, p.r * .5); c.closePath(); c.fill();
          const hot = 1 - clamp(p.t / .5);
          if (hot > 0) { c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(255,140,40,${hot})`; c.lineWidth = 1.4; c.stroke(); }
          c.restore(); break;
        }
        case 'ink': {
          const r = p.r * (.35 + eo(k) * 1.4), g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          g.addColorStop(0, p.color); g.addColorStop(1, 'rgba(0,0,0,0)');
          c.globalAlpha *= .45; c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
          break;
        }
        case 'coin': {
          const w = Math.abs(Math.cos(p.t * 11 + p.rot));
          c.beginPath(); c.ellipse(p.x, p.y, Math.max(.5, p.r * w), p.r, 0, 0, TAU); c.fill();
          c.lineWidth = 1.2; c.strokeStyle = '#B8860B'; c.stroke();
          if (w > .4) { c.fillStyle = 'rgba(255,255,230,.7)'; c.beginPath(); c.ellipse(p.x - p.r * .25 * w, p.y - p.r * .3, p.r * .25 * w, p.r * .2, 0, 0, TAU); c.fill(); }
          break;
        }
        case 'tri': c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.beginPath(); c.moveTo(0, -p.r); c.lineTo(p.r * .87, p.r * .5); c.lineTo(-p.r * .87, p.r * .5); c.closePath(); c.fill(); c.restore(); break;
        case 'bubble': c.strokeStyle = p.color; c.lineWidth = 1.3; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.stroke(); break;
        case 'puff': c.globalAlpha = .85 * (1 - k); c.beginPath(); c.arc(p.x, p.y, p.r * (1 + k * 1.6), 0, TAU); c.fill(); break;
        case 'firefly': {
          c.save(); c.globalCompositeOperation = 'lighter';
          const bl = p.soft ? .55 + .45 * Math.sin(p.t * 3.5 + p.r * 5) : .4 + .6 * Math.abs(Math.sin(p.t * 9 + p.r * 5));
          const fa = p.soft ? softEnv(k) : 1 - k;
          c.globalAlpha = fa * bl * .35; c.beginPath(); c.arc(p.x, p.y, p.r * 3, 0, TAU); c.fill();
          c.globalAlpha = fa * bl; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill();
          c.restore(); break;
        }
        case 'flake': {
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.strokeStyle = p.color; c.lineWidth = 1.3; c.lineCap = 'round';
          c.beginPath(); for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; c.moveTo(-Math.cos(a) * p.r, -Math.sin(a) * p.r); c.lineTo(Math.cos(a) * p.r, Math.sin(a) * p.r); } c.stroke();
          c.restore(); break;
        }
        case 'petal': {
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(1, .35 + .65 * Math.abs(Math.cos(p.t * 4 + p.r)));
          const r = p.r;
          c.beginPath(); c.moveTo(0, -r); c.bezierCurveTo(r * .95, -r * .55, r * .65, r * .7, 0, r); c.bezierCurveTo(-r * .65, r * .7, -r * .95, -r * .55, 0, -r); c.fill();
          c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(-r * .2, -r * .2, r * .25, r * .5, .3, 0, TAU); c.fill();
          c.restore(); break;
        }
        case 'bub2': {
          // Плёнка пузыря: переливы цвета бегут по кругу, форма чуть дышит.
          c.globalAlpha = Math.min(1, p.t * 5);
          const r = p.r * Math.min(1, .35 + p.t * 3), wob = Math.sin(p.t * 8 + p.ph) * .06;
          c.save(); c.translate(p.x, p.y); c.scale(1 + wob, 1 - wob);
          const hue = (p.t * 90 + p.ph * 60) % 360;
          const g = c.createRadialGradient(-r * .2, -r * .25, r * .1, 0, 0, r);
          g.addColorStop(0, 'rgba(255,255,255,.04)'); g.addColorStop(.72, p.tint); g.addColorStop(.9, `hsla(${hue},90%,70%,.45)`); g.addColorStop(1, `hsla(${(hue + 120) % 360},90%,75%,.7)`);
          c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
          c.lineWidth = 1.1; c.strokeStyle = `hsla(${(hue + 200) % 360},90%,80%,.55)`; c.stroke();
          c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.ellipse(-r * .4, -r * .42, r * .24, r * .12, -.7, 0, TAU); c.fill();
          c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(r * .38, r * .36, r * .07, 0, TAU); c.fill();
          c.restore(); break;
        }
        case 'popring': c.globalAlpha = 1 - k; c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.2 * (1 - k) + .3; c.beginPath(); c.arc(p.x, p.y, p.r * (1 + k * .7), 0, TAU); c.stroke(); break;
        case 'crys': {
          // Промерзание: сота стекленеет от краёв к центру, по ней бегут грани и блики.
          c.globalAlpha = 1;
          const R = p.r, fz = clamp(k / .7);
          c.save(); c.translate(p.x, p.y);
          hexPath(c, 0, 0, R); c.fillStyle = p.color; c.fill();
          c.save(); hexPath(c, 0, 0, R); c.clip();
          c.fillStyle = `rgba(215,245,255,${.85 * fz})`; hexPath(c, 0, 0, R); c.fill();
          c.fillStyle = p.color; c.globalAlpha = 1 - fz; hexPath(c, 0, 0, R * (1 - fz)); c.fill(); c.globalAlpha = 1;
          for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + p.rot, [x0, y0] = [Math.cos(a) * R, Math.sin(a) * R]; c.fillStyle = i % 2 ? `rgba(255,255,255,${.35 * fz})` : `rgba(120,190,230,${.3 * fz})`; c.beginPath(); c.moveTo(0, 0); c.lineTo(x0, y0); c.lineTo(Math.cos(a + TAU / 6) * R, Math.sin(a + TAU / 6) * R); c.closePath(); c.fill(); }
          c.strokeStyle = `rgba(255,255,255,${.9 * fz})`; c.lineWidth = 1;
          c.beginPath(); for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3 + p.rot; c.moveTo(-Math.cos(a) * R * fz, -Math.sin(a) * R * fz); c.lineTo(Math.cos(a) * R * fz, Math.sin(a) * R * fz); } c.stroke();
          const sw = ((k * 1.6) % 1) * R * 3 - R * 1.5; c.fillStyle = 'rgba(255,255,255,.45)'; c.rotate(.6); c.fillRect(sw, -R, R * .25, R * 2);
          c.restore();
          hexPath(c, 0, 0, R); c.lineWidth = 1.6; c.strokeStyle = `rgba(230,250,255,${.4 + .6 * fz})`; c.stroke();
          if (k > .8) { const q = (k - .8) / .2; c.strokeStyle = `rgba(255,255,255,${q})`; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-R * .7, -R * .2); c.lineTo(-R * .1, R * .1); c.lineTo(R * .3, -R * .5); c.moveTo(-R * .1, R * .1); c.lineTo(R * .2, R * .7); c.stroke(); }
          c.restore(); break;
        }
        case 'glitch': {
          // Сбой меняется ступеньками 20 раз в секунду, а не каждый кадр: рвано, но не мельтешит.
          const st = Math.floor(p.t * 20), h = n => { const x = Math.sin((st * 13.1 + n * 7.7 + p.seed) * 91.7) * 43758.5; return x - Math.floor(x); };
          const R = p.r, alive = k < .75 || h(9) > (k - .75) * 4;
          if (!alive) break;
          c.globalAlpha = 1;
          const bands = 6, bh = R * 2 / bands;
          for (let b = 0; b < bands; b++) {
            if (k > .35 && h(b + 20) < (k - .35) * 1.3) continue;
            const off = (h(b) - .5) * R * (.4 + k * 1.6), y = -R + b * bh;
            // Полоса самой соты: сдвинута вбок и раздвоена по цветам.
            c.save(); c.beginPath(); c.rect(p.x - R * 3, p.y + y, R * 6, bh - .4); c.clip();
            [['255,40,120', -2.4], ['40,230,255', 2.4]].forEach(([col, dx]) => { c.fillStyle = `rgba(${col},.6)`; hexPath(c, p.x + off + dx, p.y, R); c.fill(); });
            c.fillStyle = p.color; hexPath(c, p.x + off, p.y, R); c.fill();
            c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(p.x - R + off, p.y - R, R * 2, R * .6);
            c.restore();
          }
          if (h(40) > .55) { c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(p.x - R * 1.4 + h(41) * R, p.y + (h(42) - .5) * R * 2, R * (1 + h(43) * 1.5), 1.5); }
          for (let i = 0; i < 3; i++) if (h(50 + i) > .5) { c.fillStyle = i % 2 ? '#FFFFFF' : p.color; const s = 3 + h(60 + i) * 3; c.fillRect(Math.round((p.x + (h(70 + i) - .5) * R * 3) / 3) * 3, Math.round((p.y + (h(80 + i) - .5) * R * 3) / 3) * 3, s, s); }
          break;
        }
        case 'scan': {
          // Полоса помех через всё поле при очистке.
          const st = Math.floor(p.t * 20), h = n => { const x = Math.sin((st * 17.3 + n * 5.1 + p.seed) * 57.3) * 43758.5; return x - Math.floor(x); };
          c.globalAlpha = (1 - k) * .8;
          for (let i = 0; i < 4; i++) {
            if (h(i) < .45) continue;
            const y = p.y + (h(i + 10) - .5) * 260, hh = 2 + h(i + 20) * 7;
            c.fillStyle = 'rgba(255,40,120,.35)'; c.fillRect(-4 + (h(i + 30) - .5) * 20, y - 1.5, 370, hh);
            c.fillStyle = 'rgba(40,230,255,.35)'; c.fillRect(4 + (h(i + 30) - .5) * 20, y + 1.5, 370, hh);
            c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(0, y, 360, 1);
          }
          break;
        }
        case 'soap': {
          const r = p.r * (1 + .06 * Math.sin(p.t * 9));
          if (k > .88) {
            const q = (k - .88) / .12;
            c.globalAlpha = 1 - q; c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1;
            c.beginPath(); c.arc(p.x, p.y, r * (1 + q * .8), 0, TAU); c.stroke();
            for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.fillStyle = RAINBOW[i]; c.beginPath(); c.arc(p.x + Math.cos(a) * r * (1 + q), p.y + Math.sin(a) * r * (1 + q), 1, 0, TAU); c.fill(); }
            break;
          }
          c.globalAlpha = Math.min(1, p.t * 6);
          const gr = c.createLinearGradient(p.x - r, p.y - r, p.x + r, p.y + r);
          gr.addColorStop(0, 'rgba(255,120,200,.8)'); gr.addColorStop(.35, 'rgba(120,230,255,.75)'); gr.addColorStop(.65, 'rgba(255,240,120,.75)'); gr.addColorStop(1, 'rgba(170,120,255,.8)');
          c.fillStyle = 'rgba(255,255,255,.07)'; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
          c.strokeStyle = gr; c.lineWidth = 1.4; c.stroke();
          c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(p.x - r * .4, p.y - r * .45, r * .22, r * .12, -.7, 0, TAU); c.fill();
          break;
        }
        case 'flamep': {
          c.save(); c.globalCompositeOperation = 'lighter';
          const r = p.r * (k < .3 ? .6 + k * 1.4 : 1.02 - (k - .3) * 1.2);
          const col = k < .25 ? '255,240,170' : k < .55 ? '255,170,50' : '255,70,20';
          const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(.5, r));
          g.addColorStop(0, `rgba(${col},${Math.min(1, 1.1 * (1 - k))})`); g.addColorStop(.5, `rgba(${col},${.45 * (1 - k)})`); g.addColorStop(1, `rgba(${col},0)`);
          c.globalAlpha = 1; c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, Math.max(.5, r), 0, TAU); c.fill();
          c.restore(); break;
        }
        case 'trailspark': case 'rocket': {
          if (!p.hx || p.hx.length < 4) break;
          c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
          polyTrail(c, p.hx);
          c.strokeStyle = p.k === 'rocket' ? 'rgba(255,200,120,.75)' : p.color;
          c.globalAlpha *= .75; c.lineWidth = p.r; c.stroke(); c.globalAlpha /= .75;
          c.fillStyle = p.k === 'rocket' ? '#FFE9B0' : p.color;
          c.beginPath(); c.arc(p.x, p.y, p.r * (p.k === 'rocket' ? 1.8 : 1.3), 0, TAU); c.fill();
          c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(p.x, p.y, p.r * .45, 0, TAU); c.fill();
          if (p.k === 'trailspark' && Math.random() < .25) { c.fillStyle = p.color; star4(c, p.x, p.y, p.r * 3.2); c.fill(); }
          c.restore(); break;
        }
        case 'flash': {
          c.save(); c.globalCompositeOperation = 'lighter';
          const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * (.5 + k));
          g.addColorStop(0, `rgba(255,255,255,${(p.soft ? .35 : .8) * (1 - k)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
          c.globalAlpha = 1; c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r * (.5 + k), 0, TAU); c.fill();
          c.restore(); break;
        }
        case 'vortex': {
          const s = Math.max(.05, p.rad / p.rad0);
          c.globalAlpha = Math.min(1, s * 2);
          hexPath(c, p.x, p.y, p.r * (.25 + .75 * s), p.ang * 1.5); c.fill();
          c.lineWidth = 1.2; c.strokeStyle = 'rgba(255,255,255,.6)'; c.stroke();
          break;
        }
        case 'hole': {
          const grow = eo(clamp(p.t / .25)), shrink = 1 - clamp((p.t - p.life + .3) / .3), R = p.r * grow * shrink;
          if (R < 1) break;
          c.globalAlpha = 1;
          c.save(); c.translate(p.x, p.y);
          c.globalCompositeOperation = 'lighter';
          c.save(); c.scale(1, .42); c.rotate(p.t * 5);
          for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; c.strokeStyle = `rgba(${i % 2 ? '255,170,90' : '190,120,255'},${.3 + .35 * Math.sin(a * 3 + p.t * 8)})`; c.lineWidth = R * .22; c.beginPath(); c.arc(0, 0, R * 1.25, a, a + .22); c.stroke(); }
          c.restore();
          for (let i = 0; i < 3; i++) { c.strokeStyle = `rgba(200,170,255,${.25 - i * .07})`; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, R * (1.5 + i * .35) , p.t * 3 + i, p.t * 3 + i + 2.2); c.stroke(); }
          c.globalCompositeOperation = 'source-over';
          const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
          g.addColorStop(0, '#000000'); g.addColorStop(.75, '#05010D'); g.addColorStop(1, 'rgba(5,1,13,0)');
          c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
          c.strokeStyle = 'rgba(255,235,210,.9)'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, R * .72, 0, TAU); c.stroke();
          c.restore(); break;
        }
        case 'paintdrip': {
          c.globalAlpha = k > .7 ? (1 - k) / .3 : 1;
          const w = p.r * (1 - k * .25);
          c.strokeStyle = p.color; c.lineWidth = w; c.lineCap = 'round';
          c.beginPath(); c.moveTo(p.x, p.y0); c.lineTo(p.x, p.y); c.stroke();
          c.beginPath(); c.arc(p.x, p.y + w * .2, w * .75, 0, TAU); c.fill();
          c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(p.x - w * .3, p.y0, w * .18, Math.max(0, p.y - p.y0));
          break;
        }
        case 'zap': {
          if (!p.hx || p.hx.length < 4) break;
          c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
          c.beginPath(); c.moveTo(p.hx[0], p.hx[1]);
          for (let i = 2; i < p.hx.length; i += 2) c.lineTo(p.hx[i] + rnd(-3, 3), p.hx[i + 1] + rnd(-3, 3));
          c.strokeStyle = p.color; c.lineWidth = 2; c.stroke(); c.strokeStyle = '#FFFFFF'; c.lineWidth = .8; c.stroke();
          c.restore(); break;
        }
        default: c.save(); c.translate(p.x, p.y); c.rotate(p.rot || 0); c.scale(1, Math.cos(p.t * 9)); c.fillRect(-p.r / 2, -p.r / 3, p.r, p.r / 1.5); c.restore();
      }
    }
    c.globalAlpha = 1;
  }

  /* ---------- следы за фигурой ---------- */
  // spawn(emit, x, y, spread, speed, dt, color, st): st — состояние конкретного перетаскивания.
  const every = (st, dt, rate, fn) => { st.acc = (st.acc || 0) + dt * rate; while (st.acc > 1) { st.acc--; fn(); } };
  const trails = {
    sparks: {
      spawn(emit, x, y, sp, spd, dt, color, st) {
        every(st, dt, 20 + spd * .08, () => emit({ k: 'glow', soft: true, x: x + rnd(-sp, sp), y: y + rnd(-sp * .7, sp * .7), vx: rnd(-18, 18), vy: rnd(8, 30), g: 0, t: 0, life: rnd(.45, .7), color, r: rnd(1.4, 2.4) }));
      }
    },
    comet: {
      ribbon: true, keep: .45,
      spawn(emit, x, y, sp, spd, dt, color, st) {
        every(st, dt, 8, () => emit({ k: 'star4', soft: true, x: x + rnd(-sp * .6, sp * .6), y: y + rnd(-sp * .4, sp * .4), vx: 0, vy: 12, g: 0, t: 0, life: .8, color: '#FFFFFF', r: rnd(2, 3.5) }));
      },
      draw(c, hist, time, color) {
        if (hist.length < 2) return;
        c.save(); c.globalCompositeOperation = 'lighter';
        const n = hist.length;
        for (let i = 0; i < n; i++) {
          const k = (i + 1) / n, h = hist[i], r = 18 * k;
          const g = c.createRadialGradient(h.x, h.y, 0, h.x, h.y, r);
          g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
          c.globalAlpha = .34 * k; c.fillStyle = g; c.beginPath(); c.arc(h.x, h.y, r, 0, TAU); c.fill();
          c.globalAlpha = .6 * k; c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(h.x, h.y, 3 * k, 0, TAU); c.fill();
        }
        c.restore(); c.globalAlpha = 1;
      }
    },
    stardust: {
      spawn(emit, x, y, sp, spd, dt, color, st) {
        every(st, dt, 14 + spd * .08, () => emit({ k: 'star4', soft: true, x: x + rnd(-sp, sp), y: y + rnd(-sp * .7, sp * .7), vx: rnd(-8, 8), vy: rnd(12, 35), g: 0, t: 0, life: rnd(.9, 1.4), color: pick(['#FFFFFF', '#FFF3B0', '#FFD86B', '#DDEBFF']), r: rnd(2.5, 5) }));
        every(st.b || (st.b = {}), dt, 24, () => emit({ k: 'glow', soft: true, x: x + rnd(-sp, sp), y: y + rnd(-sp * .6, sp * .6), vx: rnd(-6, 6), vy: rnd(15, 40), g: 0, t: 0, life: rnd(.8, 1.2), color: 'rgba(255,240,200,.9)', r: rnd(.7, 1.2) }));
      }
    },
    snow: {
      spawn(emit, x, y, sp, spd, dt, color, st) {
        every(st, dt, 11 + spd * .05, () => emit({ k: 'flake', soft: true, x: x + rnd(-sp, sp), y: y + rnd(-sp * .5, sp * .5), vx: 0, vy: rnd(15, 40), g: 20, t: 0, life: rnd(1.3, 2), color: 'rgba(255,255,255,.95)', r: rnd(2.5, 4.5), rot: rnd(0, TAU), vr: rnd(-1.5, 1.5) }));
        every(st.b || (st.b = {}), dt, 14, () => emit({ k: 'glow', soft: true, x: x + rnd(-sp, sp), y: y + rnd(-sp * .5, sp * .5), vx: rnd(-6, 6), vy: rnd(20, 40), g: 0, t: 0, life: 1, color: 'rgba(210,235,255,.8)', r: rnd(.8, 1.3) }));
      }
    },
    hearts: {
      spawn(emit, x, y, sp, spd, dt, color, st) {
        every(st, dt, 7 + spd * .04, () => emit({ k: 'heart', soft: true, x: x + rnd(-sp, sp), y: y + rnd(-sp * .4, sp * .4), vx: 0, vy: rnd(-55, -25), g: -10, t: 0, life: rnd(1.1, 1.6), color: pick(['#FF4D7A', '#FF7AA2', '#FF9EC0', '#E0306A']), r: rnd(4, 7), rot: rnd(0, TAU) }));
      }
    },
    petals: {
      spawn(emit, x, y, sp, spd, dt, color, st) {
        every(st, dt, 9 + spd * .05, () => emit({ k: 'petal', soft: true, x: x + rnd(-sp, sp), y: y + rnd(-sp * .5, sp * .5), vx: 0, vy: rnd(10, 35), g: 50, t: 0, life: rnd(1.5, 2.2), color: pick(['#FFB7C5', '#FF8FAB', '#FFD1DC', '#FFE8EE', '#F7A1B8']), r: rnd(3.5, 6), rot: rnd(0, TAU), vr: rnd(-2.5, 2.5) }));
      }
    },
    bubbles: {
      spawn(emit, x, y, sp, spd, dt, color, st) {
        every(st, dt, 6 + spd * .035, () => emit({ k: 'soap', x: x + rnd(-sp, sp), y: y + rnd(-sp * .5, sp * .5), vx: 0, vy: rnd(-45, -15), g: -8, t: 0, life: rnd(1.2, 2), color: '#FFFFFF', r: rnd(4, 9) }));
      }
    },
    notes: {
      spawn(emit, x, y, sp, spd, dt, color, st) {
        every(st, dt, 5 + spd * .035, () => emit({ k: 'note', soft: true, x: x + rnd(-sp, sp), y: y + rnd(-sp * .4, sp * .4), vx: 0, vy: rnd(-50, -25), g: -8, t: 0, life: rnd(1.1, 1.6), color: pick(['#FFFFFF', '#FFE45C', '#9FD8FF', color]), r: rnd(3.2, 4.6), rot: rnd(0, 6) }));
      }
    },
    fireflies: {
      spawn(emit, x, y, sp, spd, dt, color, st) {
        every(st, dt, 7 + spd * .03, () => emit({ k: 'firefly', soft: true, x: x + rnd(-sp, sp), y: y + rnd(-sp * .5, sp * .5), vx: rnd(-40, 40), vy: rnd(-40, 10), g: 0, t: 0, life: rnd(1.4, 2.2), color: '#FFD84A', r: rnd(1.8, 2.8) }));
      }
    },
    fire: {
      spawn(emit, x, y, sp, spd, dt, color, st) {
        every(st, dt, 70 + spd * .25, () => emit({ k: 'flamep', x: x + rnd(-sp, sp), y: y + rnd(-sp * .4, sp * .6), vx: rnd(-15, 15), vy: rnd(-110, -50), g: -60, t: 0, life: rnd(.4, .7), color: '#FF8A00', r: rnd(8, 15) }));
        every(st.b || (st.b = {}), dt, 10, () => emit({ k: 'ember', soft: true, x: x + rnd(-sp, sp), y: y + rnd(-sp * .5, sp * .5), vx: rnd(-25, 25), vy: rnd(-110, -50), g: -20, t: 0, life: rnd(.7, 1.1), color: '#FFB347', r: rnd(1, 1.7) }));
      }
    },
    ink: {
      spawn(emit, x, y, sp, spd, dt, color, st) {
        every(st, dt, 26 + spd * .06, () => emit({ k: 'ink', soft: true, x: x + rnd(-sp * .6, sp * .6), y: y + rnd(-sp * .4, sp * .4), vx: rnd(-30, 30), vy: rnd(-10, 30), g: 0, t: 0, life: rnd(.9, 1.4), color: pick([color, HB.skins.mix(color, 'w', .3), HB.skins.mix(color, 'k', .2)]), r: rnd(10, 18) }));
      }
    },
    dandelion: {
      spawn(emit, x, y, sp, spd, dt, color, st) {
        every(st, dt, 6 + spd * .03, () => emit({ k: 'seed', soft: true, x: x + rnd(-sp, sp), y: y + rnd(-sp * .4, sp * .4), vx: 0, vy: rnd(-40, -15), g: -6, t: 0, life: rnd(1.6, 2.4), color: '#FFFFFF', r: rnd(4, 6), rot: rnd(0, TAU) }));
      }
    },
    butterflies: {
      spawn(emit, x, y, sp, spd, dt, color, st) {
        every(st, dt, 3 + spd * .018, () => emit({ k: 'butterfly', soft: true, x: x + rnd(-sp, sp), y: y + rnd(-sp * .4, sp * .4), vx: rnd(-40, 40), vy: rnd(-60, -20), g: 0, t: 0, life: rnd(1.4, 2.2), color: pick(['#FF7AA2', '#FFD23F', '#7AD7FF', '#B388EB', '#FF9F4A', '#6EE7B7']), r: rnd(6.5, 9.5), rot: rnd(0, TAU) }));
      }
    },
    rainbow: {
      ribbon: true, keep: .5,
      spawn(emit, x, y, sp, spd, dt, color, st) {
        every(st, dt, 8, () => emit({ k: 'star4', soft: true, x: x + rnd(-sp, sp), y: y + rnd(-sp * .5, sp * .5), vx: 0, vy: 18, g: 0, t: 0, life: .8, color: pick(RAINBOW), r: rnd(2, 3.5) }));
      },
      draw(c, hist) {
        if (hist.length < 3) return;
        c.save(); c.lineCap = 'butt'; c.lineJoin = 'round';
        const n = hist.length;
        for (let band = 0; band < RAINBOW.length; band++) {
          c.strokeStyle = RAINBOW[band];
          const off = (band - 2.5) * 4;
          for (let i = 1; i < n; i++) {
            const a = hist[i - 1], b = hist[i], k = i / n;
            const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
            c.globalAlpha = smooth(k) * .85; c.lineWidth = 4.2;
            c.beginPath(); c.moveTo(a.x + nx * off * k, a.y + ny * off * k); c.lineTo(b.x + nx * off * k, b.y + ny * off * k); c.stroke();
          }
        }
        c.restore(); c.globalAlpha = 1;
      }
    },
    aurora: {
      ribbon: true, keep: .6,
      spawn(emit, x, y, sp, spd, dt, color, st) {
        every(st, dt, 10, () => emit({ k: 'glow', soft: true, x: x + rnd(-sp, sp), y: y + rnd(-sp * .5, sp * .5), vx: 0, vy: rnd(-20, 5), g: 0, t: 0, life: 1, color: pick(['rgba(92,255,176,.9)', 'rgba(72,214,255,.9)', 'rgba(170,130,255,.9)']), r: rnd(1, 1.8) }));
      },
      draw(c, hist, time) {
        if (hist.length < 3) return;
        c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
        [['92,255,176', 0, 11], ['72,214,255', 1.7, 8], ['170,130,255', 3.4, 6]].forEach(([col, ph, w]) => {
          const n = hist.length;
          for (let i = 1; i < n; i++) {
            const a = hist[i - 1], b = hist[i], k = i / n;
            const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
            const wa = Math.sin(time * 3 + i * .45 + ph) * 7 * k, wb = Math.sin(time * 3 + (i + 1) * .45 + ph) * 7 * k;
            c.strokeStyle = `rgba(${col},${.55 * smooth(k)})`; c.lineWidth = w * k * 1.3 + 1.5;
            c.beginPath(); c.moveTo(a.x + nx * wa, a.y + ny * wa); c.lineTo(b.x + nx * wb, b.y + ny * wb); c.stroke();
          }
        });
        c.restore();
      }
    },
    electric: {
      ribbon: true, keep: .42,
      spawn(emit, x, y, sp, spd, dt, color, st) {
        every(st, dt, 14, () => emit({ k: 'glow', soft: true, x: x + rnd(-sp, sp), y: y + rnd(-sp * .5, sp * .5), vx: rnd(-40, 40), vy: rnd(-40, 40), g: 0, t: 0, life: rnd(.3, .5), color: 'rgba(160,215,255,.95)', r: rnd(1, 1.8) }));
      },
      draw(c, hist, time) {
        if (hist.length < 3) return;
        c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
        const n = hist.length;
        for (let pass = 0; pass < 2; pass++) {
          c.beginPath();
          for (let i = 0; i < n; i++) {
            const k = i / n, h = hist[i];
            const o = (Math.sin(i * 1.7 + time * 19 + pass * 2) * Math.sin(i * .9 - time * 13)) * 7 * k;
            const nx = i ? -(h.y - hist[i - 1].y) : 0, ny = i ? h.x - hist[i - 1].x : 0, L = Math.hypot(nx, ny) || 1;
            i ? c.lineTo(h.x + nx / L * o, h.y + ny / L * o) : c.moveTo(h.x, h.y);
          }
          c.strokeStyle = 'rgba(110,180,255,.28)'; c.lineWidth = 14; c.stroke();
          c.strokeStyle = 'rgba(170,220,255,.75)'; c.lineWidth = 4.5; c.stroke();
          c.strokeStyle = '#FFFFFF'; c.lineWidth = 1.6; c.stroke();
        }
        c.restore();
      }
    }
  };

  /* ---------- взрывы линий ---------- */
  // cell(api, x, y, color, info) — на каждую сгоревшую соту; clear(api, cx, cy, info) — один раз на очистку.
  const bursts = {
    confetti: {
      cell(api, x, y, color) {
        for (let i = 0; i < 7; i++) api.push({ k: 'conf', x, y, vx: rnd(-170, 170), vy: rnd(-420, -180), g: 560, t: 0, life: rnd(1.3, 1.9), color: i < 2 ? color : pick(RAINBOW), r: rnd(4, 7), rot: rnd(0, TAU), vr: rnd(-12, 12), air: true });
      },
      clear(api, cx, cy, info) { if (!info.silent) HB.sfx.popper(); api.push({ k: 'flash', x: cx, y: cy, vx: 0, vy: 0, t: 0, life: .3, color: '#FFFFFF', r: 70 }); }
    },
    pixel: {
      hideTile: true,
      cell(api, x, y, color) {
        const s = 6, cols = [color, HB.skins.mix(color, 'w', .35), HB.skins.mix(color, 'k', .25)];
        for (let gy = -2; gy < 2; gy++) for (let gx = -2; gx < 2; gx++) {
          if (Math.abs(gx + .5) + Math.abs(gy + .5) > 3.2) continue;
          api.push({ k: 'pix', x: x + gx * s, y: y + gy * s, vx: (gx + .5) * rnd(20, 60), vy: (gy + .5) * rnd(10, 40) - rnd(60, 160), g: 620, t: -Math.random() * .12, life: rnd(.8, 1.2), color: pick(cols), r: s });
        }
      },
      clear(api, cx, cy, info) { if (!info.silent) HB.sfx.pixelBurst(); }
    },
    paint: {
      cell(api, x, y, color) {
        api.splat(x, y, color, 5, 1.7);
        for (let i = 0; i < 2; i++) { const px = x + rnd(-9, 9), py = y + rnd(0, 10); api.push({ k: 'paintdrip', x: px, y0: py, y: py, vx: 0, vy: rnd(18, 45), g: 0, t: 0, life: rnd(2.5, 4), color, r: rnd(3, 5) }); }
        for (let i = 0; i < 4; i++) api.push({ k: 'blob', x, y, vx: rnd(-200, 200), vy: rnd(-260, -80), g: 900, t: 0, life: rnd(.5, .8), color, r: rnd(3, 5.5) });
      },
      clear(api, cx, cy, info) { if (!info.silent) HB.sfx.paint(); }
    },
    bloom: {
      hideTile: true,
      cell(api, x, y, color) {
        api.push({ k: 'bloom', x, y, vx: 0, vy: 0, g: 0, t: 0, life: 1, color, r: 17, rot: rnd(0, TAU) });
        for (let i = 0; i < 6; i++) api.push({ k: 'petal', x, y, vx: 0, vy: rnd(-90, -30), g: 90, t: -rnd(.45, .6), life: rnd(1.3, 1.9), color: i % 2 ? color : HB.skins.mix(color, 'w', .4), r: rnd(3.5, 5.5), rot: rnd(0, TAU), vr: rnd(-3, 3), soft: true });
      },
      clear(api, cx, cy, info) { if (!info.silent) HB.sfx.bloom(); }
    },
    supernova: {
      cell(api, x, y, color) {
        api.push({ k: 'nova', x, y, vx: 0, vy: 0, g: 0, t: 0, life: .9, color, r: 16, rot: rnd(0, TAU) });
        for (let i = 0; i < 6; i++) { const a = rnd(0, TAU), v = rnd(40, 110); api.push({ k: 'star4', soft: true, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, t: 0, life: rnd(.7, 1.1), color: i % 2 ? '#FFFFFF' : color, r: rnd(2.5, 4.5) }); }
      },
      clear(api, cx, cy, info) {
        api.push({ k: 'flash', x: cx, y: cy, vx: 0, vy: 0, t: 0, life: .5, color: '#FFFFFF', r: 110, soft: true });
        if (!info.silent) HB.sfx.supernova();
      }
    },
    fireworks: {
      cell(api, x, y, color) {
        for (let i = 0; i < 5; i++) { const a = rnd(0, TAU), v = rnd(60, 150); api.push({ k: 'trailspark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 200, t: 0, life: rnd(.5, .8), color, r: rnd(1.3, 2) }); }
      },
      clear(api, cx, cy, info) {
        const L = info.lines || 1;
        const n = L >= 2 ? Math.min(5, 4 + (L >= 3 || Math.random() < .4 ? 1 : 0)) : (Math.random() < .4 ? 3 : 2);
        for (let i = 0; i < n; i++) {
          const c0 = Math.floor(Math.random() * RAINBOW.length), cols = [RAINBOW[c0], RAINBOW[(c0 + 2) % RAINBOW.length], RAINBOW[(c0 + 4) % RAINBOW.length]];
          api.push({ k: 'rocket', x: cx + rnd(-50, 50), y: cy + 20, vx: rnd(-50, 50), vy: -rnd(420, 560), g: 320, t: -i * .18, life: rnd(.55, .75), cols, r: 2.2, boom: !info.silent, salvo: n });
        }
        if (!info.silent) HB.sfx.launch(n);
      }
    },
    blackhole: {
      hideTile: true,
      cell(api, x, y, color, info) {
        const hx = info.cx, hy = info.cy, d = Math.hypot(x - hx, y - hy) || 1;
        api.push({ k: 'vortex', cx: hx, cy: hy, x, y, ang: Math.atan2(y - hy, x - hx), rad: d, rad0: d, w: 4 + Math.random() * 2, sp: d * 1.05, vx: 0, vy: 0, t: 0, life: 1, color, r: 18 });
      },
      clear(api, cx, cy, info) { if (!info.silent) HB.sfx.blackhole(); api.push({ k: 'hole', x: cx, y: cy, vx: 0, vy: 0, t: 0, life: 1.3, color: '#000', r: 30 }); }
    }
  };

  bursts.bubbles = {
    hideTile: true,
    cell(api, x, y, color) {
      const n = parseInt(color.slice(1), 16), tint = `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},.22)`;
      api.push({ k: 'bub2', x, y, vx: 0, vy: rnd(-40, -10), g: 0, t: 0, life: rnd(.9, 1.6), color, tint, r: rnd(13, 18), ph: rnd(0, TAU), snd: Math.random() < .35 });
      for (let i = 0; i < 2; i++) api.push({ k: 'bub2', x: x + rnd(-8, 8), y: y + rnd(-8, 8), vx: 0, vy: rnd(-70, -30), g: 0, t: -rnd(0, .15), life: rnd(.6, 1.1), color, tint, r: rnd(4, 7), ph: rnd(0, TAU) });
    },
    clear(api, cx, cy, info) { if (!info.silent) HB.sfx.bubbles(); }
  };
  bursts.crystal = {
    hideTile: true,
    cell(api, x, y, color, info) {
      const d = info && info.cx != null ? Math.hypot(x - info.cx, y - info.cy) : 0;
      api.push({ k: 'crys', x, y, vx: 0, vy: 0, g: 0, t: -Math.min(.25, d / 900), life: .62, color, r: 19, rot: rnd(0, TAU) });
    },
    clear(api, cx, cy, info) { if (!info.silent) HB.sfx.crystal(); api.push({ k: 'flash', x: cx, y: cy, vx: 0, vy: 0, t: -.55, life: .35, color: '#E6F8FF', r: 90, soft: true }); }
  };
  bursts.glitch = {
    hideTile: true,
    cell(api, x, y, color) { api.push({ k: 'glitch', x, y, vx: 0, vy: 0, g: 0, t: 0, life: rnd(.55, .8), color, r: 19, seed: rnd(0, 1000) }); },
    clear(api, cx, cy, info) { if (!info.silent) HB.sfx.glitch(); api.push({ k: 'scan', x: 0, y: cy, vx: 0, vy: 0, g: 0, t: 0, life: .5, color: '#FFFFFF', r: 1, seed: rnd(0, 1000) }); }
  };

  HB.fx = { update, draw, trails, bursts, SOUNDS, TRAILS, BURSTS, RAINBOW };
})();
