/*
 * Стили счёта: цифры рисуются в отдельный холст, а поверх букв (source-atop) ложатся
 * переливы, блики и фактуры. Так эффекты не вылезают за контур цифр.
 */
(() => {
  'use strict';
  const HB = window.HB, TAU = Math.PI * 2;
  const FD = '"HB Display", "Baloo 2", "Trebuchet MS", sans-serif';
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  const LIST = [
    { id: 'classic', name: 'Обычный', price: 0, desc: 'Чистые светлые цифры' },
    { id: 'gold', name: 'Золото', price: 150, desc: 'Литое золото с объёмом, бегущим бликом и искрами' },
    { id: 'chrome', name: 'Хром', price: 170, desc: 'Зеркальный металл с отражением неба и холодным бликом' },
    { id: 'neon', name: 'Неон', price: 160, desc: 'Стеклянные трубки, свет плавно перетекает из розового в голубой' },
    { id: 'ice', name: 'Лёд', price: 180, desc: 'Прозрачный лёд с морозным узором и холодным сиянием' },
    { id: 'honey', name: 'Мёд', price: 190, desc: 'Густой янтарный мёд: блестит и медленно стекает каплями' },
    { id: 'emerald', name: 'Изумруд', price: 220, desc: 'Гранёный камень: грани играют светом, вспыхивают искры' },
    { id: 'lava', name: 'Лава', price: 240, desc: 'Тёмная корка, под которой течёт раскалённая магма' },
    { id: 'opal', name: 'Опал', price: 260, desc: 'Жемчужные цифры, по которым плывут пастельные переливы' },
    { id: 'holo', name: 'Голограмма', price: 280, desc: 'Радужная голограмма с развёрткой и цветным двоением' },
    { id: 'galaxy', name: 'Галактика', price: 320, desc: 'Внутри цифр туманности и мерцающие звёзды' }
  ];

  const off = document.createElement('canvas'), g = off.getContext('2d');
  // Контекст одного кадра: размеры, границы букв, время.
  let S = 0, W = 0, H = 0, CX = 0, CY = 0, TW = 0, T = 0, STR = '', CH = [];
  const vgrad = stops => { const gr = g.createLinearGradient(0, CY - S * .55, 0, CY + S * .5); stops.forEach(([k, c]) => gr.addColorStop(k, c)); return gr; };
  const fill = (style, dx = 0, dy = 0) => { g.fillStyle = style; g.fillText(STR, CX + dx, CY + dy); };
  const stroke = (style, lw, dx = 0, dy = 0) => { g.lineJoin = 'round'; g.lineWidth = lw; g.strokeStyle = style; g.strokeText(STR, CX + dx, CY + dy); };
  const extrude = (col, n) => { for (let i = n; i >= 1; i--) fill(col, 0, i * S * .025); };
  const atop = fn => { g.save(); g.globalCompositeOperation = 'source-atop'; fn(); g.restore(); };
  const glow = (col, blur, fn) => { g.save(); g.shadowColor = col; g.shadowBlur = blur; fn(); g.restore(); };
  /** Косой блик, пробегающий по цифрам. */
  function glint(speed, width, col, phase = 0) {
    const p = (((T * speed + phase) % 1.8) - .4) * (TW + S * 2) + CX - TW / 2 - S;
    g.save(); g.translate(p, CY); g.rotate(.45);
    const gr = g.createLinearGradient(-width, 0, width, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, col); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(-width, -S * 2, width * 2, S * 4); g.restore();
  }
  function blob(x, y, r, col) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  function star(x, y, r, col) {
    g.fillStyle = col; g.beginPath();
    g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill();
  }
  /** Искры на буквах: вспыхивают по очереди и гаснут. */
  function sparkles(n, speed, col, size = .22) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const ph = T * speed + i * 1.7, k = Math.max(0, Math.sin(ph)); if (k < .6) continue;
      const cyc = Math.floor(ph / TAU), ch = CH[Math.floor(hash(i * 13 + cyc) * CH.length)] || CX;
      const a = (k - .6) / .4, x = ch + (hash(i + cyc * 7) - .5) * S * .4, y = CY + (hash(i * 3 + cyc) - .5) * S * .7;
      star(x, y, S * size * a, col); blob(x, y, S * .25 * a, 'rgba(255,255,255,.35)');
    }
    g.restore();
  }

  const STY = {
    gold() {
      glow('rgba(255,190,60,.45)', S * .35, () => extrude('#4A2E04', 4));
      stroke('#3A2203', S * .09);
      fill(vgrad([[0, '#FFFBE6'], [.28, '#FFE27A'], [.49, '#E8A92A'], [.51, '#B8761A'], [.74, '#FFD256'], [1, '#8A5710']]));
      atop(() => { g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(0, CY - S * .6, W, S * .5); glint(.32, S * .35, 'rgba(255,255,240,.95)'); });
      stroke('rgba(255,244,200,.35)', S * .02, 0, -S * .015);
      sparkles(3, 2.2, '#FFFBE0');
    },
    chrome() {
      extrude('#161A24', 4);
      stroke('#0B0E15', S * .09);
      fill(vgrad([[0, '#FFFFFF'], [.3, '#DDE4EF'], [.47, '#6E7A92'], [.5, '#1D2230'], [.6, '#8193B3'], [.84, '#EEF3FA'], [1, '#98A4BA']]));
      atop(() => {
        glint(.28, S * .22, 'rgba(210,235,255,.95)');
        glint(.28, S * .06, 'rgba(255,255,255,.9)', .12);
        g.fillStyle = 'rgba(120,190,255,.14)'; g.fillRect(0, CY + S * .05, W, S * .08);
      });
      sparkles(2, 1.8, '#FFFFFF', .18);
    },
    neon() {
      const hue = 320 - 130 * (.5 + .5 * Math.sin(T * .6)), pulse = .88 + .12 * Math.sin(T * 2.2);
      const gr = g.createLinearGradient(CX - TW / 2, 0, CX + TW / 2, 0);
      gr.addColorStop(0, `hsl(${hue},100%,62%)`); gr.addColorStop(1, `hsl(${(hue + 60) % 360},100%,62%)`);
      fill('rgba(20,5,30,.55)');
      g.globalAlpha = pulse;
      glow(`hsl(${hue},100%,60%)`, S * .6, () => stroke(gr, S * .11));
      glow(`hsl(${(hue + 40) % 360},100%,70%)`, S * .25, () => stroke(gr, S * .07));
      g.globalAlpha = 1;
      stroke('rgba(255,255,255,.92)', S * .025);
    },
    ice() {
      glow('rgba(140,220,255,.65)', S * .4, () => extrude('#16486E', 3));
      stroke('rgba(235,250,255,.95)', S * .075);
      fill(vgrad([[0, '#FFFFFF'], [.3, '#C8F2FF'], [.65, '#6BC3EE'], [1, '#2A78B8']]));
      atop(() => {
        // Морозный узор: тонкие ветвящиеся кристаллы.
        g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = S * .018; g.lineCap = 'round';
        for (let i = 0; i < CH.length * 2; i++) {
          const x = CH[i % CH.length] + (hash(i * 5) - .5) * S * .5, y = CY + (hash(i * 9) - .5) * S * .8, a = hash(i * 3) * TAU, L = S * (.12 + hash(i) * .15);
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L);
          g.moveTo(x + Math.cos(a) * L * .5, y + Math.sin(a) * L * .5); g.lineTo(x + Math.cos(a + .7) * L * .8, y + Math.sin(a + .7) * L * .8); g.stroke();
        }
        g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, CY - S * .6, W, S * .35);
        glint(.22, S * .3, 'rgba(255,255,255,.85)');
      });
      sparkles(4, 2.6, '#FFFFFF', .2);
    },
    honey() {
      // Капли стекают с нижнего края цифр и срываются вниз.
      g.save();
      CH.forEach((x0, i) => {
        if (hash(i * 7 + 1) < .35) return;
        const p = (T * .11 + hash(i * 3)) % 1, x = x0 + (hash(i) - .5) * S * .3, y0 = CY + S * .32;
        const col = g.createLinearGradient(0, y0, 0, y0 + S * .6); col.addColorStop(0, '#E89400'); col.addColorStop(1, '#B85E00');
        g.fillStyle = col;
        if (p < .78) {
          const L = (p / .78) * S * .42, r = S * (.05 + .05 * p);
          g.beginPath(); g.moveTo(x - S * .06, y0 - S * .05); g.quadraticCurveTo(x - r * .6, y0 + L * .6, x - r, y0 + L); g.arc(x, y0 + L, r, Math.PI, 0, true); g.quadraticCurveTo(x + r * .6, y0 + L * .6, x + S * .06, y0 - S * .05); g.fill();
          g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(x - r * .35, y0 + L - r * .2, r * .3, 0, TAU); g.fill();
        } else {
          const q = (p - .78) / .22, y = y0 + S * .42 + q * q * S * 1.2, r = S * .09 * (1 - q * .4);
          g.globalAlpha = 1 - q; g.beginPath(); g.ellipse(x, y, r * .85, r * 1.1, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
        }
      });
      g.restore();
      glow('rgba(255,170,30,.45)', S * .3, () => extrude('#6E3700', 3));
      stroke('#5A2C00', S * .075);
      fill(vgrad([[0, '#FFF3C2'], [.3, '#FFC940'], [.68, '#F29600'], [1, '#B35A00']]));
      atop(() => {
        g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(CX, CY - S * .32, TW * .55, S * .18, 0, 0, TAU); g.fill();
        glint(.18, S * .28, 'rgba(255,250,220,.7)');
        blob(CX + Math.sin(T * .7) * TW * .3, CY + S * .15, S * .5, 'rgba(255,120,0,.25)');
      });
    },
    emerald() {
      glow('rgba(40,230,140,.4)', S * .3, () => extrude('#04301A', 4));
      stroke('#021A0E', S * .085);
      fill(vgrad([[0, '#C8FFE0'], [.32, '#3FE092'], [.6, '#0E9C57'], [1, '#05562F']]));
      atop(() => {
        // Грани камня: косые полосы света и тени, медленно сдвигаются.
        g.save(); g.translate(CX, CY); g.rotate(-.7);
        const step = S * .22, sh = (T * S * .08) % (step * 2);
        for (let x = -W; x < W; x += step * 2) { g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x + sh, -S * 2, step, S * 4); g.fillStyle = 'rgba(0,50,25,.18)'; g.fillRect(x + sh + step, -S * 2, step * .5, S * 4); }
        g.restore();
        glint(.3, S * .2, 'rgba(230,255,240,.95)');
      });
      sparkles(4, 3, '#FFFFFF', .22);
    },
    lava() {
      glow('rgba(255,80,0,.9)', S * .55, () => fill('#5A1204'));
      atop(() => {
        // Магма течёт под коркой: горячие пятна медленно ползут вбок.
        g.fillStyle = vgrad([[0, 'rgba(255,90,0,.55)'], [1, 'rgba(160,20,0,.5)']]); g.fillRect(0, 0, W, H);
        for (let i = 0; i < 10; i++) {
          const x = CX - TW / 2 + (((hash(i) + T * (.05 + hash(i * 3) * .05)) % 1.3) - .15) * TW, y = CY + Math.sin(T * .8 + i * 2) * S * .25;
          blob(x, y, S * (.45 + hash(i * 5) * .35), i % 3 ? 'rgba(255,140,10,1)' : 'rgba(255,235,110,1)');
        }
        // Трещины тёмной корки.
        g.strokeStyle = 'rgba(40,8,0,.8)'; g.lineWidth = S * .035; g.lineCap = 'round';
        for (let i = 0; i < CH.length * 1.5; i++) {
          let x = CH[i % CH.length] + (hash(i * 11) - .5) * S * .5, y = CY - S * .5 + hash(i * 13) * S;
          g.beginPath(); g.moveTo(x, y);
          for (let j = 0; j < 3; j++) { x += (hash(i * 17 + j) - .5) * S * .35; y += S * .15; g.lineTo(x, y); }
          g.stroke();
        }
        g.fillStyle = 'rgba(255,240,180,.12)'; g.fillRect(0, CY - S * .6, W, S * .3);
      });
      stroke('rgba(255,140,40,.55)', S * .025);
      // Искорки поднимаются над цифрами.
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) { const p = (T * .5 + hash(i * 9)) % 1, x = CX + (hash(i) - .5) * TW, y = CY - S * .4 - p * S * .6; g.globalAlpha = 1 - p; blob(x, y, S * .08, 'rgba(255,170,60,1)'); }
      g.restore();
    },
    opal() {
      glow('rgba(255,255,255,.55)', S * .35, () => extrude('#8F87AC', 2));
      stroke('rgba(120,110,150,.6)', S * .06);
      fill(vgrad([[0, '#FFFFFF'], [.6, '#EFEAF7'], [1, '#D6CFE6']]));
      atop(() => {
        const cols = ['rgba(255,150,210,.7)', 'rgba(140,255,215,.7)', 'rgba(190,150,255,.7)', 'rgba(140,210,255,.7)', 'rgba(255,225,140,.7)'];
        cols.forEach((c0, i) => blob(CX + Math.sin(T * (.4 + i * .07) + i * 1.3) * TW * .45, CY + Math.cos(T * (.5 + i * .05) + i) * S * .3, S * .55, c0));
        g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, CY - S * .6, W, S * .3);
        glint(.2, S * .3, 'rgba(255,255,255,.8)');
      });
      stroke('rgba(255,255,255,.9)', S * .018, 0, -S * .01);
      sparkles(2, 1.6, '#FFFFFF', .16);
    },
    holo() {
      const h0 = (T * 50) % 360;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .55;
      fill('rgb(0,220,255)', -S * .035, 0); fill('rgb(255,0,170)', S * .035, 0);
      g.restore();
      const gr = g.createLinearGradient(CX - TW / 2, CY - S * .4, CX + TW / 2, CY + S * .4);
      for (let i = 0; i <= 5; i++) gr.addColorStop(i / 5, `hsl(${(h0 + i * 60) % 360},95%,76%)`);
      fill(gr);
      atop(() => {
        g.fillStyle = 'rgba(20,0,40,.14)';
        for (let y = CY - S; y < CY + S; y += Math.max(2, S * .07)) g.fillRect(0, y + (T * S * .3) % 3, W, S * .025);
        glint(.35, S * .35, 'rgba(255,255,255,.75)');
      });
      stroke('rgba(255,255,255,.55)', S * .02);
    },
    galaxy() {
      glow('rgba(150,100,255,.8)', S * .45, () => fill('#2A0F5C'));
      atop(() => {
        blob(CX + Math.sin(T * .3) * TW * .3, CY - S * .1, S * .9, 'rgba(255,80,210,.9)');
        blob(CX - Math.cos(T * .25) * TW * .35, CY + S * .15, S * .9, 'rgba(70,140,255,.95)');
        blob(CX + Math.cos(T * .35 + 2) * TW * .4, CY, S * .7, 'rgba(170,100,255,.85)');
        blob(CX - Math.sin(T * .2 + 1) * TW * .45, CY - S * .2, S * .5, 'rgba(90,230,255,.6)');
        CH.forEach((x, i) => blob(x + Math.sin(T * .5 + i) * S * .15, CY + Math.cos(T * .4 + i * 2) * S * .2, S * .42, ['rgba(255,90,220,.55)', 'rgba(80,150,255,.6)', 'rgba(180,110,255,.55)'][i % 3]));
        for (let i = 0; i < 40; i++) {
          const x = CX - TW / 2 + hash(i * 3) * TW, y = CY - S * .5 + hash(i * 7) * S, tw = .4 + .6 * Math.max(0, Math.sin(T * (1 + hash(i) * 3) + i));
          g.fillStyle = `rgba(255,255,255,${tw})`; g.beginPath(); g.arc(x, y, S * (.015 + hash(i * 11) * .025), 0, TAU); g.fill();
        }
      });
      stroke('rgba(220,200,255,.85)', S * .03);
      sparkles(2, 1.4, '#E8DCFF', .18);
    }
  };

  /** Нарисовать счёт стилем id с центром в (x, y). Вернёт false для обычного стиля. */
  function draw(c, str, x, y, size, t, id, k) {
    const st = STY[id]; if (!st) return false;
    k = k || (HB.skins.pxScale || 2) * 1.3;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.font = `800 ${size}px ${FD}`;
    TW = g.measureText(str).width; S = size; T = t; STR = str;
    W = TW + size * 1.6; H = size * 2.4; CX = W / 2; CY = H * .45;
    const pw = Math.ceil(W * k), ph = Math.ceil(H * k);
    if (off.width !== pw || off.height !== ph) { off.width = pw; off.height = ph; } else g.clearRect(0, 0, pw, ph);
    g.setTransform(k, 0, 0, k, 0, 0);
    g.font = `800 ${size}px ${FD}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    CH = []; let acc = 0;
    for (const ch of str) { const w = g.measureText(ch).width; if (ch.trim()) CH.push(CX - TW / 2 + acc + w / 2); acc += w; }
    st();
    c.drawImage(off, x - CX, y - CY, W, H);
    return true;
  }
  HB.scoreStyles = { list: LIST, draw, has: id => !!STY[id] };
})();
