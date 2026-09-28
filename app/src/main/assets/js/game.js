/* Игровое поле Hex Blast: логика, анимации и отрисовка на canvas. Меню и окна — в ui.js. */
(() => {
  'use strict';
  const HB = window.HB, U = HB.util;
  const { TAU, clamp, lerp, eo, eio, eob, rand, rnd } = U;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const W = 360, R3 = Math.sqrt(3), S = 21, TS = .56, HX = 46;
  const GREY = '#4A4680';
  const FD = '"HB Display", "Baloo 2", "Trebuchet MS", sans-serif';
  const FB = '"HB Body", "Nunito Sans", "Segoe UI", sans-serif';
  const AMBER = '#FFC857', CORAL = '#FF6B6B', MINT = '#4ADE9C', SKY = '#4CC9F0', PINK = '#FF8FD1', BOLTC = '#9FD8FF';
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
  const DIRC = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];   // по кругу, для поворотов огня
  const FIREC = '#FF9A3C', ICEC = '#BDEBFF', SUNC = '#FFD36B';
  let H = 640, TY = 548, CY = 320, TOP = 0, BOT = 0, insetTop = 0, insetBottom = 0;
  const skin = () => HB.skins.current();
  const colorOf = ci => skin().colors[ci] || '#888888';
  const tile = (c, x, y, R, color, o) => HB.skins.tile(c, x, y, R, color, skin(), o);
  const hexPath = (...a) => HB.skins.hexPath(...a);
  const holdOn = () => !!HB.settings.hold;
  const sx = i => i === 3 ? HX : (holdOn() ? [138, 228, 318] : [64, 180, 296])[i];

  /* ---------- поле ---------- */
  const key = (q, r) => q + ',' + r;
  const cells = [], map = new Map();
  for (let q = -4; q <= 4; q++) for (let r = -4; r <= 4; r++) {
    if (Math.abs(q + r) > 4) continue;
    const cl = { idx: cells.length, q, r, x: 0, y: 0, ci: -1, v: 0, daisy: false, dPet: 0, dT: 0, dAsc: false, born: 0, bomb: false, fire: false, ice: false, frozen: false, frzT: 0, frzAng: 0, sun: false, sunStage: 0, sunGrowT: -9, pt: 9, fx: null, gt: -1 };
    cells.push(cl); map.set(key(q, r), cl);
  }
  const lines = [];
  for (let v = -4; v <= 4; v++) lines.push(cells.filter(c => c.q === v), cells.filter(c => c.r === v), cells.filter(c => -c.q - c.r === v));
  const cdist = (a, b) => HB.hexDist([a.q, a.r], [b.q, b.r]);
  const SH = [
    [[0, 0]],
    [[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [-1, 1]],
    [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [-1, 1], [-2, 2]],
    [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [-1, 1], [-2, 2], [-3, 3]],
    [[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [1, -1]],
    [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [-1, 1], [0, 1]],
    [[0, 0], [1, 0], [1, 1]], [[0, 0], [1, 0], [2, -1]], [[0, 0], [0, 1], [1, 1], [1, 2]]
  ];

  /* ---------- состояние ---------- */
  let tray = [null, null, null], hold = null, drag = null, ghost = null, preview = null, boltPreview = null;
  let score = 0, shown = 0, bump = 0, best = HB.best(), bestAtStart = 0, recordShown = false, isRecord = false;
  let combo = 0, miss = 0, stat = { lines: 0, maxCombo: 0, clears: 0 };
  let paidChances = 0, bloomT = 0;
  const BLOOM_T = 30;
  let pending = [], charge = 0, undoCharges = 0, snap = null, lastAward = 0, holdHint = false;
  let mode = 'idle', inputOn = false, endT = 0, time = 0;
  let slowmo = 0, freeze = 0, punch = 0, shake = 0, bgFlash = 0, bgFlashColor = '#A78BFA', whiteFlash = 0, idleT = 0, trailT = 0;
  let snowflakes = [], hurricanes = [], bunnies = [], skyfires = [];
  let parts = [], rings = [], floats = [], banners = [], splats = [], booms = [], strikes = [], hudFx = [], flames = [], crackT = 1, sunBeams = [], sunsOn = [], ripple = null, hudAcc = 0, flashTint = '255,245,230';
  const bgHex = Array.from({ length: 12 }, () => ({ x: rnd(0, W), y: rnd(0, 900), r: rnd(18, 60), s: rnd(4, 12), a: rnd(0, TAU), va: rnd(-.15, .15) }));
  const stars = Array.from({ length: 70 }, () => ({ x: rnd(0, W), y: rnd(0, 900), s: rnd(.8, 2), p: rnd(0, TAU) }));

  const pieceAt = i => i === 3 ? hold : tray[i];
  function makePiece(i, delay, shape, ci, bomb = -1, vs = null, bolt = -1, fire = -1, ice = -1, sun = -1, daisy = -1) {
    const offs = shape.map(([dq, dr]) => [S * R3 * (dq + dr / 2), S * 1.5 * dr]);
    const mx = offs.reduce((a, o) => a + o[0], 0) / offs.length, my = offs.reduce((a, o) => a + o[1], 0) / offs.length;
    const xs = offs.map(o => o[0]), ys = offs.map(o => o[1]);
    return {
      shape, ci, bomb, bolt, fire, ice, sun, daisy, vs: vs || shape.map(() => rand(10)), seed: rand(997),
      offs: offs.map(o => [o[0] - mx, o[1] - my]),
      w: Math.max(...xs) - Math.min(...xs) + S * R3, h: Math.max(...ys) - Math.min(...ys) + S * 2,
      x: sx(i), y: TY + 40, sc: 0, scV: 0, rot: 0, delay, fits: true, fa: 1
    };
  }
  const restScale = (p, i) => i === 3 ? Math.min(.46, 60 / p.w, 92 / p.h) : Math.min(TS, (holdOn() ? 86 : 108) / p.w, 104 / p.h);
  function randomShape() {
    const custom = HB.settings.customOn ? HB.profile.custom.filter(c => c.on && c.cells && c.cells.length) : [];
    const w = { rare: .35, normal: 1.2, often: 3.5 }[HB.settings.customFreq] || 1.2;
    const r = Math.random() * (SH.length + custom.length * w);
    if (r < SH.length) return SH[Math.floor(r)];
    return custom[Math.min(custom.length - 1, Math.floor((r - SH.length) / w))].cells;
  }
  const fits = (p, aq, ar) => p.shape.every(([dq, dr]) => { const cl = map.get(key(aq + dq, ar + dr)); return cl && cl.ci < 0; });
  const fitsAnywhere = p => cells.some(cl => fits(p, cl.q - p.shape[0][0], cl.r - p.shape[0][1]));
  const updateFits = () => { tray.forEach(p => { if (p) p.fits = fitsAnywhere(p); }); if (hold) hold.fits = fitsAnywhere(hold); };
  /** Ходов нет: ни одна фигура не встаёт, и запас не спасает. */
  function stuck() {
    const pcs = tray.filter(Boolean);
    if (pcs.some(p => p.fits)) return false;
    if (holdOn() && hold && hold.fits) return false;
    if (holdOn() && !hold && pcs.length === 1) return false;
    return true;
  }
  /** Какая особая сота придёт следующей: зависит от выбора в настройках. */
  const specials = () => (HB.settings.specials && HB.settings.specials.length ? HB.settings.specials : ['bomb']);
  // Бомба, молния, костёр и лёд приходят часто, солнце редко, ромашка совсем редко (примерно одна из двадцати).
  const SPECIAL_W = { bomb: 1, bolt: 1, fire: 1, ice: 1, sun: .6, daisy: .25 };
  function nextSpecial() {
    const sp = specials(), sum = sp.reduce((a, k) => a + (SPECIAL_W[k] || 1), 0);
    let r = Math.random() * sum;
    for (const k of sp) { r -= SPECIAL_W[k] || 1; if (r <= 0) return k; }
    return sp[sp.length - 1];
  }
  function earnSpecial() {
    const t = nextSpecial();
    pending.push(t);
    showBanner(t === 'daisy' ? 'РОМАШКА РАСЦВЕЛА' : t === 'bolt' ? 'МОЛНИЯ ЗАРЯЖЕНА' : t === 'fire' ? 'КОСТЁР ГОТОВ' : t === 'ice' ? 'ЛЁД ГОТОВ' : t === 'sun' ? 'СОЛНЦЕ ГОТОВО' : 'БОМБА ЗАРЯЖЕНА', t === 'bolt' ? BOLTC : t === 'fire' ? FIREC : t === 'ice' ? ICEC : t === 'sun' ? SUNC : CORAL);
  }
  /** Путь огня от костра: случайно прямо, змейкой или зигзагом по занятым сотам. */
  function firePath(start, n) {
    const path = [], seen = new Set([start]);
    let cur = start, dir = rand(6), hops = 0;
    while (path.length < n && hops < 40) {
      hops++;
      const r0 = Math.random();
      const pref = r0 < .45 ? [0, 1, -1, 2, -2, 3] : r0 < .72 ? [1, 0, -1, 2, -2, 3] : [-1, 0, 1, -2, 2, 3];
      let next = null, nd = dir, hop = null, hd = dir;
      for (const tt of pref) {
        const d = (dir + tt + 6) % 6, c = map.get(key(cur.q + DIRC[d][0], cur.r + DIRC[d][1]));
        if (!c || seen.has(c)) continue;
        if (c.ci >= 0) { next = c; nd = d; break; }
        if (!hop) { hop = c; hd = d; }
      }
      if (!next && !hop) break;
      cur = next || hop; dir = next ? nd : hd; seen.add(cur);
      if (next) path.push(cur);
    }
    return path;
  }
  /** Линия через соту-молнию, в которой больше всего занятых клеток. */
  function strikeLineFor(cell, extra) {
    const filled = l => l.filter(c => c.ci >= 0 || (extra && extra.has(c))).length;
    return lines.filter(l => l.includes(cell)).reduce((a, b) => filled(b) > filled(a) ? b : a);
  }
  const ringOf = cell => DIRS.map(([dq, dr]) => map.get(key(cell.q + dq, cell.r + dr))).filter(Boolean);
  function groupOf(start) {
    const seen = new Set(start), st = [...start];
    while (st.length) {
      const c = st.pop();
      for (const [dq, dr] of DIRS) { const n = map.get(key(c.q + dq, c.r + dr)); if (n && n.ci >= 0 && !seen.has(n)) { seen.add(n); st.push(n); } }
    }
    return [...seen];
  }
  function refill() {
    let ps;
    for (let n = 0; n < 10; n++) {
      ps = [0, 1, 2].map(i => makePiece(i, i * .08, randomShape(), rand(6)));
      if (ps.some(fitsAnywhere)) break;
    }
    if (HB.settings.bomb) {
      const give = (p, type) => { p[type] = rand(p.shape.length); };
      if (HB.settings.bombSource === 'random') ps.forEach(p => { if (Math.random() < .08) give(p, nextSpecial()); });
      while (pending.length) {
        const free = ps.filter(p => p.bomb < 0 && p.bolt < 0 && p.fire < 0 && p.ice < 0 && p.sun < 0 && p.daisy < 0);
        if (!free.length) break;
        give(free[rand(free.length)], pending.shift());
      }
      if (ps.some(p => p.bomb >= 0)) setTimeout(() => HB.sfx.fuse(), 260);
    }
    tray = ps;
  }

  /* ---------- сохранение ---------- */
  const serPiece = p => p ? { shape: p.shape, ci: p.ci, bomb: p.bomb, bolt: p.bolt, fire: p.fire, ice: p.ice, sun: p.sun, daisy: p.daisy, vs: p.vs } : null;
  function snapshot() {
    return {
      cells: cells.map(c => [c.ci, c.bomb ? 1 : 0, c.v, c.fire ? 1 : 0, c.ice ? 1 : 0, c.frozen ? 1 : 0, c.sun ? 1 : 0, c.sunStage, c.daisy ? c.dPet : 0, c.daisy ? Math.round(c.dT * 10) / 10 : 0]), tray: tray.map(serPiece), hold: serPiece(hold),
      score, combo, miss, stat: Object.assign({}, stat), pending: pending.slice(), charge, recordShown
    };
  }
  function restore(s) {
    cells.forEach((c, i) => { c.ci = s.cells[i][0]; c.bomb = !!s.cells[i][1]; c.fire = !!s.cells[i][3]; c.ice = !!s.cells[i][4]; c.frozen = !!s.cells[i][5]; c.frzT = -9; c.sun = !!s.cells[i][6]; c.sunStage = s.cells[i][7] || 0; c.sunGrowT = -9; c.dPet = s.cells[i][8] || 0; c.daisy = c.dPet > 0; c.dT = s.cells[i][9] || 30; c.dAsc = false; c.v = s.cells[i][2] || (i * 7) % 10; c.born = time; c.pt = 9; c.fx = null; c.gt = -1; });
    tray = s.tray.map((p, i) => p ? makePiece(i, i * .06, p.shape, p.ci, p.bomb, p.vs, p.bolt == null ? -1 : p.bolt, p.fire == null ? -1 : p.fire, p.ice == null ? -1 : p.ice, p.sun == null ? -1 : p.sun, p.daisy == null ? -1 : p.daisy) : null);
    hold = s.hold ? makePiece(3, .1, s.hold.shape, s.hold.ci, s.hold.bomb, s.hold.vs, s.hold.bolt == null ? -1 : s.hold.bolt, s.hold.fire == null ? -1 : s.hold.fire, s.hold.ice == null ? -1 : s.hold.ice, s.hold.sun == null ? -1 : s.hold.sun, s.hold.daisy == null ? -1 : s.hold.daisy) : null;
    score = s.score; combo = s.combo; miss = s.miss; stat = Object.assign({ lines: 0, maxCombo: 0, clears: 0 }, s.stat);
    pending = Array.isArray(s.pending) ? s.pending.slice() : Array(s.pendingBomb || 0).fill('bomb'); charge = s.charge || 0; recordShown = !!s.recordShown;
    drag = ghost = preview = null;
    updateFits();
  }
  function save() {
    if (mode !== 'play') { if (mode !== 'idle') HB.store.del('hb.save2'); return; }
    HB.store.set('hb.save2', { v: 2, s: snapshot(), undoCharges, snap, bestAtStart, paidChances, bloomT: Math.round(bloomT) });
  }
  function load() {
    let d = HB.store.get('hb.save2', null);
    if (!d) {
      // Партия из версии 1.0: цвета совпадают с индексами, фигуры — с номерами SH.
      const old = HB.store.get('hb.save', null);
      if (old && old.v === 1 && Array.isArray(old.cells) && old.cells.length === cells.length) {
        d = { v: 2, bestAtStart: old.bestAtStart || 0, undoCharges: 0, snap: null, s: {
          cells: old.cells.map(ci => [ci, 0]),
          tray: old.tray.map(p => p ? { shape: SH[p.si] || SH[0], ci: p.ci, bomb: -1 } : null),
          score: old.score || 0, combo: old.combo || 0, miss: old.miss || 0, stat: old.stat || {}, pendingBomb: 0, charge: 0,
          recordShown: false
        } };
      }
      HB.store.del('hb.save');
    }
    if (!d || d.v !== 2 || !d.s || !Array.isArray(d.s.cells) || d.s.cells.length !== cells.length) return false;
    restore(d.s);
    if (tray.every(t => !t)) refill();
    updateFits();
    if (stuck()) { HB.store.del('hb.save2'); cells.forEach(c => { c.ci = -1; c.bomb = false; }); tray = [null, null, null]; hold = null; return false; }
    shown = score; paidChances = d.paidChances || 0; bloomT = d.bloomT || 0; undoCharges = d.undoCharges || 0; snap = d.snap || null; bestAtStart = d.bestAtStart || 0;
    return true;
  }

  /* ---------- эффекты ---------- */
  function sparks(x, y, color, n, spd) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = spd * rnd(.35, 1.1);
      parts.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 520, t: 0, life: rnd(.4, .75), color, r: rnd(2, 4.2) });
    }
  }
  function shards(x, y, color, n, spd = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = rnd(80, 220) * spd;
      parts.push({ k: 'shard', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, g: 700, t: 0, life: rnd(.55, .9), color, r: rnd(4, 7), rot: rnd(0, TAU), vr: rnd(-9, 9) });
    }
  }
  function drops(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + rnd(-1.3, 1.3), v = rnd(120, 300);
      parts.push({ k: 'drop', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 1100, t: 0, life: rnd(.7, 1.2), color, r: rnd(3, 5.5) });
    }
  }
  function splat(x, y, color, life = 2.6, scale = 1) {
    const blobs = Array.from({ length: 5 }, () => [rnd(-14, 14) * scale, rnd(-10, 16) * scale, rnd(4, 10) * scale]);
    blobs.push([0, 0, rnd(10, 14) * scale]);
    splats.push({ x, y, color, t: 0, life, blobs });
    if (splats.length > 40) splats.shift();
  }
  const fxApi = { push: p => parts.push(p), splat };
  function dust(x, y) {
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * TAU;
      parts.push({ k: 'spark', x, y, vx: Math.cos(a) * 50, vy: Math.sin(a) * 50, g: 0, t: 0, life: .35, color: 'rgba(255,255,255,.75)', r: 2.2 });
    }
  }
  function confetti(n = 80) {
    const cols = skin().colors;
    for (let i = 0; i < n; i++) {
      parts.push({ k: 'conf', x: rnd(0, W), y: rnd(-80, -10), vx: rnd(-50, 50), vy: rnd(80, 220), g: 120, t: 0, life: rnd(2.2, 3.2), color: cols[rand(6)], r: rnd(4, 7), rot: rnd(0, TAU), vr: rnd(-8, 8) });
    }
  }
  const boardTop = () => CY - 4 * 1.5 * S - S, boardBot = () => CY + 4 * 1.5 * S + S;
  function floatText(str, x, y, size, color = AMBER) {
    x = clamp(x, 70, W - 70); y = clamp(y, boardTop() + 20, boardBot() - 10);
    for (const f of floats) if (f.t < .6 && Math.abs(f.y - y) < 36 && Math.abs(f.x - x) < 140) y = f.y - 38;
    floats.push({ str, x, y, size, color, t: 0, life: 1.15 });
  }
  let bannerLog = '';
  function showBanner(str, color) { banners.push({ str, color, t: 0, life: 1.5 }); bannerLog += str + '|'; HB.sfx.whoosh(); }
  const comboColor = c => c >= 6 ? PINK : c >= 4 ? CORAL : c >= 3 ? AMBER : MINT;

  /* ---------- ввод ---------- */
  const BTN = { pause: () => [30, 46 + TOP], undo: () => [76, 46 + TOP] };
  const hitBtn = (p, [x, y]) => Math.hypot(p.x - x, p.y - y) < 23;
  const canUndo = () => HB.settings.undo && undoCharges > 0;
  function down(p) {
    if (!inputOn) return;
    HB.sfx.unlock();
    if (hitBtn(p, BTN.pause())) { HB.sfx.click(); HB.haptic('tick'); HB.ui.pause(); return; }
    if (mode !== 'play') return;
    const order = holdOn() ? [3, 0, 1, 2] : [0, 1, 2];
    for (const i of order) {
      const pc = pieceAt(i);
      const half = i === 3 ? 38 : holdOn() ? 45 : 58;
      if (pc && pc.delay <= 0 && Math.abs(p.x - sx(i)) < half && Math.abs(p.y - TY) < 64) {
        drag = { i, px: p.x, py: p.y, lift: p.touch ? 78 : 18, dx: 0, vs: 0 };
        idleT = 0; HB.sfx.pick(); HB.haptic('pick');
        move(p); return;
      }
    }
  }
  function move(p) {
    if (!drag) return;
    drag.dx += p.x - drag.px;
    drag.px = p.x; drag.py = p.y;
    const pc = pieceAt(drag.i), cx = p.x, cy = p.y - drag.lift;
    const [q, r] = toHex(cx + pc.offs[0][0], cy + pc.offs[0][1]);
    const aq = q - pc.shape[0][0], ar = r - pc.shape[0][1];
    if (fits(pc, aq, ar)) {
      if (!ghost || ghost.aq !== aq || ghost.ar !== ar) HB.haptic('tick', 5);
      ghost = { aq, ar };
      const set = new Set(pc.shape.map(([dq, dr]) => map.get(key(aq + dq, ar + dr))));
      preview = new Set();
      for (const l of lines) if (l.every(cl => cl.ci >= 0 || set.has(cl))) l.forEach(cl => preview.add(cl));
      if (!preview.size) preview = null;
      boltPreview = null;
      if (pc.bolt >= 0) {
        const bc = map.get(key(aq + pc.shape[pc.bolt][0], ar + pc.shape[pc.bolt][1]));
        boltPreview = strikeLineFor(bc, set).filter(c => c.ci >= 0 || set.has(c));
        if (lines.some(l => l.includes(bc) && l.every(c => c.ci >= 0 || set.has(c)))) boltPreview = boltPreview.concat(ringOf(bc).filter(c => c.ci >= 0 || set.has(c)));
      }
    } else { ghost = null; preview = null; boltPreview = null; }
  }
  const nearHold = (x, y) => Math.abs(x - HX) < 46 && y > TY - 80 && y < TY + 70;
  function up() {
    if (!drag) return;
    if (ghost) place();
    else if (holdOn() && drag.i < 3 && (nearHold(drag.px, drag.py - drag.lift) || nearHold(drag.px, drag.py))) stash(drag.i);
    else if (drag.py - drag.lift < TY - 70) { HB.sfx.invalid(); HB.haptic('invalid'); }
    drag = ghost = preview = boltPreview = null;
  }
  function toHex(x, y) {
    const px = x - 180, py = y - CY;
    const fq = (R3 / 3 * px - py / 3) / S, fr = (2 / 3 * py) / S, fs = -fq - fr;
    let q = Math.round(fq), r = Math.round(fr); const s = Math.round(fs);
    const dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s - fs);
    if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
    return [q, r];
  }

  /* ---------- ход ---------- */
  function afterMove() {
    if (mode === 'demo' || gifting) return;
    if (tray.every(t => !t)) { refill(); HB.sfx.refill(); }
    updateFits();
    if (stuck()) startEnding();
    else if (holdOn() && !tray.some(p => p && p.fits) && !(hold && hold.fits) && !holdHint) {
      holdHint = true; showBanner('УБЕРИ ФИГУРУ В ЗАПАС', SKY);
    }
    save();
  }
  function stash(i) {
    const p = tray[i];
    if (!p) return;
    if (hold) { tray[i] = hold; hold = p; } else { hold = p; tray[i] = null; }
    HB.sfx.stash(); HB.haptic('pick');
    afterMove();
  }
  function place() {
    snap = snapshot();
    holdHint = false;
    const pc = pieceAt(drag.i), placed = [];
    pc.shape.forEach(([dq, dr], k) => {
      const cl = map.get(key(ghost.aq + dq, ghost.ar + dr));
      cl.ci = pc.ci; cl.bomb = k === pc.bomb; cl.fire = k === pc.fire; cl.ice = k === pc.ice; cl.sun = k === pc.sun; if (cl.sun) { cl.sunStage = 0; cl.sunGrowT = time; } cl.daisy = k === pc.daisy; if (cl.daisy) { cl.dPet = 5; cl.dT = 30; cl.dAsc = false; } cl.v = pc.vs[k] | 0; cl.born = time; cl.pt = 0; placed.push(cl);
    });
    if (drag.i === 3) hold = null; else tray[drag.i] = null;
    score += pc.shape.length;
    const ox = placed.reduce((a, c) => a + c.x, 0) / placed.length, oy = placed.reduce((a, c) => a + c.y, 0) / placed.length;
    placed.forEach(cl => dust(cl.x, cl.y));
    ripple = { x: ox, y: oy, t: 0 };
    shake = Math.max(shake, 3);
    HB.sfx.place(placed.length, (ox - 180) / 180); HB.haptic('place');
    if (pc.ice >= 0) {
      const ic = placed[pc.ice];
      ringOf(ic).filter(c => c.ci >= 0 && !c.frozen).forEach((c, i) => {
        c.frozen = true; c.frzT = time + .05 + i * .06; c.frzAng = Math.atan2(ic.y - c.y, ic.x - c.x);
      });
      HB.sfx.freeze(); HB.haptic('freeze');
      for (let i = 0; i < 14; i++) parts.push({ k: 'glow', soft: true, x: ic.x + rnd(-18, 18), y: ic.y + rnd(-18, 18), vx: rnd(-20, 20), vy: rnd(-10, 25), g: 0, t: 0, life: rnd(.8, 1.3), color: 'rgba(200,240,255,.9)', r: rnd(1, 2) });
    }
    if (pc.fire >= 0) { setTimeout(() => { HB.sfx.ignite(); HB.haptic('ignite'); }, 60); const fc = placed[pc.fire]; for (let i = 0; i < 12; i++) parts.push({ k: 'ember', soft: true, x: fc.x, y: fc.y, vx: rnd(-50, 50), vy: rnd(-150, -60), g: -20, t: 0, life: rnd(.6, 1.1), color: '#FFB347', r: rnd(1.2, 2.2) }); }

    if (pc.sun >= 0) { HB.sfx.sunPlace(); HB.haptic('sungrow'); }
    if (pc.daisy >= 0) { const dc = placed[pc.daisy]; HB.sfx.daisyPlace(); HB.haptic('streak'); for (let i = 0; i < 10; i++) parts.push({ k: 'petal', x: dc.x, y: dc.y, vx: 0, vy: rnd(-70, -20), g: 40, t: 0, life: rnd(.8, 1.3), color: '#FFFFFF', r: rnd(2.5, 4), rot: rnd(0, TAU), vr: rnd(-3, 3), soft: true }); }
    const autoSuns = [];
    let grew = 0;
    if (!gifting) cells.forEach(c => {
      if (!c.sun || c.ci < 0 || placed.includes(c)) return;
      if (c.sunStage >= 3) autoSuns.push(c);
      else { c.sunStage++; c.sunGrowT = time; grew = Math.max(grew, c.sunStage); }
    });
    if (grew) { HB.sfx.sunGrow(grew); HB.haptic('sungrow'); if (grew >= 3) showBanner('СОЛНЦЕ НА ПРЕДЕЛЕ', SUNC); }
    const full = lines.filter(l => l.every(cl => cl.ci >= 0));
    const boltCell = pc.bolt >= 0 ? placed[pc.bolt] : null;
    const strike = boltCell ? strikeLineFor(boltCell, null) : null;
    if (full.length || strike || autoSuns.length) {
      combo++; miss = 0;
      stat.lines += full.length; stat.maxCombo = Math.max(stat.maxCombo, combo);
      const u = new Set(), delay = new Map();
      full.forEach(l => l.forEach(cl => { u.add(cl); delay.set(cl, Math.hypot(cl.x - ox, cl.y - oy) / 520); }));
      const lineCells = u.size;
      autoSuns.forEach(c => { if (!u.has(c)) { u.add(c); delay.set(c, .05); } });
      let strikeCells = 0, bombPts = 0, ringList = [], charged = false;
      const zapped = new Set();
      if (strike) {
        strike.forEach(cl => {
          if (cl.ci < 0) return;
          zapped.add(cl);
          const d = .12 + Math.hypot(cl.x - boltCell.x, cl.y - boltCell.y) / 1300;
          if (u.has(cl)) delay.set(cl, Math.min(delay.get(cl), d)); else { u.add(cl); delay.set(cl, d); strikeCells++; }
        });
        // Молния замкнула свой ряд — вторым ударом бьёт по кольцу соседей.
        if (full.some(l => l.includes(boltCell))) {
          ringList = ringOf(boltCell).filter(c => c.ci >= 0);
          ringList.forEach(cl => {
            zapped.add(cl);
            const d = .4 + Math.random() * .05;
            if (u.has(cl)) delay.set(cl, Math.min(delay.get(cl), d)); else { u.add(cl); delay.set(cl, d); strikeCells++; }
          });
        }
        strikeFx(boltCell, strike, ringList);
      }
      // Цепочка особых сот: бомбы и костры поджигают друг друга, молния заряжает и тех и других.
      const power = HB.settings.bombPower === 2 ? 2 : 1;
      const queue = [...u].filter(c => c.bomb || c.fire || c.ice || c.sun), done = new Set(), sunburnt = new Set(), sunFrom = new Map(), prismCol = new Map(), burnt = new Set(), blasted = new Set(), blastFrom = new Map(), frostAt = new Map(), iced = new Set(), iceFrom = new Map(), types = new Set();
      if (strike) types.add('bolt');
      const whirled = new Set();
      let nBombs = 0, cryo = false, thermo = false, fireSteam = false, fireSun = false;
      let ices = 0, iceMode = '', suns = 0, sunMode = '';
      let fires = 0, napalm = false, storm = false, fireBlast = false;
      const addCell = (c, d) => {
        if (!u.has(c)) { if (c.ci < 0) return; u.add(c); delay.set(c, d); }
        else delay.set(c, Math.min(delay.get(c), d));
        if ((c.bomb || c.fire || c.ice || c.sun) && !done.has(c)) queue.push(c);
      };
      while (queue.length) {
        const b = queue.shift();
        if (done.has(b)) continue;
        done.add(b);
        types.add(b.bomb ? 'bomb' : b.fire ? 'fire' : b.ice ? 'ice' : 'sun');
        const at = delay.get(b), mult = Math.pow(2, done.size - 1);
        if (b.bomb) {
          const zap = zapped.has(b), nap = burnt.has(b) && !zap;
          const cr = !zap && !nap && (iced.has(b) || b.frozen), th = !zap && !nap && !cr && sunburnt.has(b);
          const boosted = zap || nap || cr || th, pw = power + (boosted ? 1 : 0);
          const bp = 75 * mult * (boosted ? 2 : 1);
          if (zap) charged = true;
          if (nap) napalm = true;
          nBombs++;
          if (cr) cryo = true;
          if (th) thermo = true;
          bombPts += bp;
          booms.push({ x: b.x, y: b.y, t: -at, fired: false, power: pw, pts: bp, charged: zap, napalm: nap, cryo: cr, thermo: th });
          for (const c of cells) if (c !== b && c.ci >= 0 && cdist(b, c) <= pw) {
            blasted.add(c); if (!blastFrom.has(c)) blastFrom.set(c, b);
            if (cr) { frostAt.set(c, at - .3); iced.add(c); if (c.ice && !iceFrom.has(c)) iceFrom.set(c, b); }
            addCell(c, at + .12 + cdist(b, c) * .07);
          }
        }
        if (b.sun) {
          suns++;
          const zap = zapped.has(b), hot = burnt.has(b), boom = blasted.has(b), from = sunFrom.get(b);
          let R = Math.max(1, b.sunStage) + (hot || boom ? 1 : 0);
          if (zap) R = Math.max(R, 3);
          const zone = cells.filter(c => c !== b && c.ci >= 0 && cdist(b, c) <= R);
          const prism = zone.some(c => c.ice || c.frozen);
          const mode = zap ? 'hurricane' : prism ? 'prism' : boom ? 'nuke' : hot ? 'flare' : from ? 'binary' : autoSuns.includes(b) ? 'beam' : 'bunny';
          if (!sunMode || mode !== 'beam') sunMode = mode;
          const bp = 100 * Math.max(1, b.sunStage) * mult * (boom ? 3 : mode === 'beam' ? 1 : 2);
          bombPts += bp;
          const t0 = at + .45, extra = { lines: [], rays: [] };
          delay.set(b, Math.max(delay.get(b), t0));
          zone.forEach(c => { sunburnt.add(c); if (c.sun && !sunFrom.has(c)) sunFrom.set(c, b); addCell(c, t0 + cdist(b, c) * .22); });
          if (zap) {
            // Ураган: вихрь вокруг поля уносит по кругу 5–6 самых заполненных рядов.
            const n = 5 + (Math.random() < .5 ? 1 : 0);
            const pick = lines.slice().sort((l1, l2) => l2.filter(c => c.ci >= 0).length - l1.filter(c => c.ci >= 0).length + (Math.random() - .5) * .5).slice(0, n);
            pick.forEach((l, i) => l.forEach(c => { if (c !== b && c.ci >= 0) { whirled.add(c); addCell(c, t0 + .6 + i * .22 + Math.random() * .15); } }));
            hurricanes.push({ t: -t0, life: 2.8 });
          }
          if (mode === 'bunny') {
            // Солнце разбил сам игрок: оно рассыпается солнечными зайчиками, и каждый прыгает по полю, выжигая соты.
            const nb = 3 + Math.max(0, b.sunStage);
            for (let k2 = 0; k2 < nb; k2++) {
              const pts = [[b.x, b.y]]; let cur = b;
              for (let h = 0; h < 3; h++) {
                const cand = cells.filter(c => c.ci >= 0 && !u.has(c) && c !== cur && cdist(c, cur) >= 1 && cdist(c, cur) <= 3);
                if (!cand.length) break;
                cur = cand[rand(cand.length)];
                pts.push([cur.x, cur.y]); sunburnt.add(cur); addCell(cur, t0 + .45 + k2 * .12 + (h + 1) * .3);
              }
              if (pts.length > 1) bunnies.push({ pts, t: -(t0 + .45 + k2 * .12), hop: .3, h: 0 });
            }
          }
          if (prism) for (let d = 0; d < 6; d++) {
            let q = b.q, r = b.r, end = null;
            for (let s = 1; s <= R + 4; s++) {
              q += DIRC[d][0]; r += DIRC[d][1];
              const c = map.get(key(q, r)); if (!c) break;
              end = c;
              if (s > R && c.ci >= 0) { prismCol.set(c, d); sunburnt.add(c); addCell(c, t0 + .3 + s * .06); }
            }
            if (end) extra.rays.push([end.x, end.y, d]);
          }
          booms.push({ x: b.x, y: b.y, t: -at, fired: false, sun: true, mode, R, pts: bp, lines: extra.lines, rays: extra.rays, from: from ? [from.x, from.y] : null });
        }
        if (b.ice) {
          ices++;
          const zap = zapped.has(b), fromBomb = blastFrom.get(b), hot = burnt.has(b) || sunburnt.has(b), gl = iceFrom.has(b);
          const mode = zap ? 'storm' : hot ? 'steam' : gl ? 'glacier' : fromBomb ? 'fan' : 'burst';
          const chill = c => { iced.add(c); if (c.ice && c !== b && !iceFrom.has(c)) iceFrom.set(c, b); };
          if (!iceMode || mode !== 'burst') iceMode = mode;
          const bp = 80 * mult * (mode === 'burst' ? 1 : 2);
          bombPts += bp;
          let dir = null;
          if (mode === 'storm') {
            // Лёд ползёт по всем трём линиям через соту и потом разом лопается.
            lines.filter(l => l.includes(b)).forEach(l => l.forEach(c => {
              if (c === b || c.ci < 0) return;
              const dd = Math.hypot(c.x - b.x, c.y - b.y) / (S * R3);
              chill(c); frostAt.set(c, at + dd * .15); addCell(c, at + 1.15 + dd * .03);
            }));
          } else if (mode === 'fan') {
            // Взрыв бомбы гонит лёд от себя: веер шириной в 5 линий по направлению удара.
            const L0 = Math.hypot(b.x - fromBomb.x, b.y - fromBomb.y) || 1, dx = (b.x - fromBomb.x) / L0, dy = (b.y - fromBomb.y) / L0, step = S * R3;
            dir = Math.atan2(dy, dx);
            cells.forEach(c => {
              if (c === b || c.ci < 0) return;
              const vx = c.x - b.x, vy = c.y - b.y, proj = (vx * dx + vy * dy) / step, perp = Math.abs(vx * dy - vy * dx) / step;
              if (proj > .3 && proj <= 5.2 && perp <= 2.1) { chill(c); frostAt.set(c, at + proj * .13); addCell(c, at + .6 + proj * .08); }
            });
          } else if (mode === 'steam') {
            cells.forEach(c => { if (c !== b && c.ci >= 0 && cdist(b, c) <= 2) addCell(c, at + .1 + cdist(b, c) * .06); });
          } else if (mode === 'glacier') {
            // Лёд разбудил лёд: иней расходится на два кольца.
            cells.forEach(c => { if (c !== b && c.ci >= 0 && cdist(b, c) <= 2) { chill(c); frostAt.set(c, at + cdist(b, c) * .16); addCell(c, at + .6 + cdist(b, c) * .06); } });
          } else {
            // Снежинка: кольцо вокруг и шесть лучей на три соты.
            ringOf(b).forEach(c => { if (c.ci >= 0) { chill(c); frostAt.set(c, at); addCell(c, at + .38); } });
            for (let d = 0; d < 6; d++) {
              let q = b.q, r = b.r;
              for (let s = 1; s <= 3; s++) {
                q += DIRC[d][0]; r += DIRC[d][1];
                const c = map.get(key(q, r)); if (!c) break;
                if (s > 1 && c.ci >= 0) { chill(c); frostAt.set(c, at + s * .09); addCell(c, at + .4 + s * .11); }
              }
            }
          }
          booms.push({ x: b.x, y: b.y, t: -at, fired: false, ice: true, mode, dir, pts: bp });
          if (mode === 'storm') booms.push({ x: b.x, y: b.y, t: -(at + 1.15), fired: false, ice: true, mode: 'stormhit', pts: 0 });
        }
        if (b.fire) {
          fires++;
          const zap = zapped.has(b), boom = blasted.has(b), wet = !zap && (iced.has(b) || b.frozen), sunny = !zap && sunburnt.has(b);
          if (wet) {
            // Лёд тушит костёр: вместо бега огня — паровой взрыв.
            fireSteam = true;
            const bp = 90 * mult * 2; bombPts += bp;
            booms.push({ x: b.x, y: b.y, t: -at, fired: false, ice: true, mode: 'steam', pts: bp });
            cells.forEach(c => { if (c !== b && c.ci >= 0 && cdist(b, c) <= 2) addCell(c, at + .1 + cdist(b, c) * .06); });
            continue;
          }
          if (zap) storm = true;
          if (boom) fireBlast = true;
          if (sunny) fireSun = true;
          const walks = zap ? 3 : boom || sunny ? 2 : 1, bp = 90 * mult * (zap || sunny ? 2 : 1);
          bombPts += bp;
          booms.push({ x: b.x, y: b.y, t: -at, fired: false, fire: true, pts: bp, storm: zap });
          for (let w = 0; w < walks; w++) {
            const len = (walks === 1 ? 6 + rand(3) : walks === 2 ? 5 + rand(3) : 4 + rand(2)) + (sunny ? 2 : 0);
            firePath(b, len).forEach((c, i) => {
              const d = at + .18 + w * .06 + i * .09;
              burnt.add(c); addCell(c, d);
              flames.push({ x: c.x, y: c.y, t: -d });
            });
          }
        }
      }
      if (suns >= 2) {
        // Два солнца в одной цепочке: с неба бьют частые лучи и выжигают всё поле.
        sunMode = 'sky';
        const t0 = Math.max(...[...done].filter(c => c.sun).map(c => delay.get(c))) + .55;
        const top = Math.min(...cells.map(c => c.y));
        let n = 0;
        cells.forEach(c => { if (c.ci < 0 || u.has(c)) return; u.add(c); sunburnt.add(c); delay.set(c, t0 + (c.y - top) / 480 + Math.random() * .2); n++; });
        bombPts += n * 20;
        skyfires.push({ t: -t0, life: 1.9 });
      }
      [...u].filter(c => c.daisy).forEach(c => { u.delete(c); tearPetals(c, Math.max(1, full.filter(l => l.includes(c)).length)); });
      const delays = [], xs = [];
      let frozenHit = 0;
      u.forEach(c => {
        if (c.frozen) frozenHit++;
        c.fx = { orbit: whirled.has(c), ci: c.ci, v: c.v, bomb: c.bomb, fire: c.fire, ice: c.ice, sun: c.sun, sunStage: c.sunStage, sunburn: sunburnt.has(c), prism: prismCol.has(c) ? prismCol.get(c) : null, frozen: c.frozen, frost: frostAt.has(c) ? frostAt.get(c) : null, frzAng: c.frzAng, burning: burnt.has(c), charged: c.bomb && zapped.has(c), age: time - c.born, delay: delay.get(c), t: 0, burst: false, hole: { cx: ox, cy: oy } };
        delays.push(c.fx.delay); xs.push((c.x - 180) / 180);
        c.ci = -1; c.bomb = false; c.fire = false; c.ice = false; c.frozen = false; c.sun = false; c.daisy = false;
      });
      const BC = HB.fx.bursts[HB.profile.burst];
      if (BC) BC.clear(fxApi, ox, oy, { lines: full.length || 1 });
      let pts = Math.round(lineCells * 10 * full.length * (1 + (combo - 1) * .5)) + (u.size - lineCells - strikeCells) * 15 + strikeCells * 12 + bombPts;
      const bits = [];
      if (strike) bits.push(ringList.length ? 'КОЛЬЦО МОЛНИЙ' : 'МОЛНИЯ!');
      const nb = nBombs;
      if (charged) bits.push('ГРОМОВОЙ ВЗРЫВ');
      else if (napalm) bits.push('НАПАЛМ');
      else if (nb) bits.push(nb > 1 ? 'БАБАХ ×' + nb : 'БАБАХ!');
      if (suns) bits.unshift({ hurricane: 'УРАГАН', sky: 'НЕБЕСНЫЙ ОГОНЬ', bunny: 'СОЛНЕЧНЫЕ ЗАЙЧИКИ', prism: 'ПРИЗМА', nuke: 'ТЕРМОЯД', flare: 'ПРОТУБЕРАНЕЦ', binary: 'ДВОЙНАЯ ЗВЕЗДА', beam: 'СОЛНЕЧНАЯ ВСПЫШКА' }[sunMode] || 'СОЛНЦЕ!');
      if (ices) bits.push({ storm: 'ЛЕДЯНОЙ РАЗРЯД', fan: 'ЛЕДЯНОЙ ВЕЕР', steam: 'ПАРОВОЙ ВЗРЫВ', glacier: 'ЛЕДНИКОВЫЙ ПЕРИОД', burst: 'ЛЕДЯНОЙ ВЗРЫВ' }[iceMode] || 'ЛЁД!');
      else if (frozenHit >= 3) bits.push('ЗВОН ЛЬДА');
      pts += frozenHit * 20;
      if (fires) bits.push(storm ? 'ОГНЕННАЯ БУРЯ' : fires > 1 ? 'ЛЕСНОЙ ПОЖАР ×' + fires : fireBlast ? 'ОГНЕННЫЙ ВЗРЫВ' : fireSteam ? 'ПАРОВОЙ ВЗРЫВ' : fireSun ? 'ПРОТУБЕРАНЕЦ' : 'КОСТЁР!');
      if (cryo) bits.push('КРИОБОМБА');
      if (thermo) bits.push('ТЕРМОЯД');
      if (fireSteam) bits.push('ПАРОВОЙ ВЗРЫВ');
      if (fireSun) bits.push('ПРОТУБЕРАНЕЦ');
      if (types.size >= 3) {
        const apo = types.size >= 4;
        pts *= apo ? 3 : 2;
        bits.unshift(apo ? 'АПОКАЛИПСИС ×3' : 'СТИХИЙНЫЙ ХАОС ×2');
        chaosFx(ox, oy, apo);
      }
      if (full.length > 1) bits.push(full.length + ' ' + U.plural(full.length, 'ЛИНИЯ', 'ЛИНИИ', 'ЛИНИЙ'));
      if (combo > 1) bits.push('КОМБО ×' + combo);
      if (cells.every(c => c.ci < 0)) { pts += 300; stat.clears++; bits.push('ЧИСТОЕ ПОЛЕ'); confetti(); }
      if (bloomT > 0) { pts *= 3; bits.push('ЦВЕТЕНИЕ ×3'); }
      score += pts;
      floatText('+' + U.fmt(pts), ox, oy, 30 + Math.min(full.length, 4) * 5);
      if (bits.length) showBanner([...new Set(bits)].join(' · '), types.size >= 3 ? '#FF8FD1' : suns ? SUNC : charged ? '#C9E8FF' : ices ? ICEC : fires ? FIREC : nb ? CORAL : strike ? BOLTC : comboColor(combo));
      rings.push({ x: ox, y: oy, t: 0, color: colorOf(pc.ci), big: false });
      shake = Math.max(shake, 5 + full.length * 3 + Math.min(combo, 6));
      bgFlash = 1; bgFlashColor = colorOf(pc.ci);
      freeze = Math.max(freeze, full.length >= 2 ? .075 : .035);
      punch = Math.min(.07, .018 + .014 * full.length + .005 * combo);
      HB.sfx.clear(delays, full.length, combo, xs);
      if (combo > 1) HB.sfx.combo(combo);
      HB.haptic('clear', u.size, full.length | (combo << 8));
      if (HB.settings.bomb) {
        if (HB.settings.bombSource === 'combo' && combo % 3 === 0) earnSpecial();
        if (HB.settings.bombSource === 'charge') {
          charge += Math.max(1, full.length);
          while (charge >= 6) { charge -= 6; earnSpecial(); }
        }
      }
    } else if (++miss >= 3) combo = 0;
    const remain = placed.filter(c => c.ci >= 0);
    if (remain.length) {
      const cx = remain.reduce((a, c) => a + c.x, 0) / remain.length, cy = remain.reduce((a, c) => a + c.y, 0) / remain.length;
      HB.skins.onPlace(remain.map(c => [c.x, c.y]), groupOf(remain).map(c => [c.x, c.y]), { x: cx, y: cy });
    }
    bump = 1;
    if (mode !== 'demo' && score > best) {
      best = score; HB.setBest(best);
      if (bestAtStart > 0 && !recordShown) {
        recordShown = true;
        let s = 'НОВЫЙ РЕКОРД!';
        if (HB.settings.undo) { undoCharges = 1; s += ' · ВТОРОЙ ШАНС'; }
        showBanner(s, AMBER); confetti(60);
        setTimeout(() => { HB.sfx.record(); HB.haptic('record'); }, 280);
      }
    }
    afterMove();
  }
  function strikeFx(cell, line, ring = []) {
    const pts = line.slice().sort((a, b) => a.x - b.x).map(c => [c.x, c.y]);
    strikes.push({ x: cell.x, y: cell.y, line: pts, t: 0, sx: cell.x + rnd(-40, 40), life: ring.length ? .85 : .6, ring: ring.map(c => [c.x, c.y]) });
    if (ring.length) setTimeout(() => {
      HB.sfx.ringZap(); HB.haptic('thunder');
      flashTint = '205,230,255'; whiteFlash = Math.max(whiteFlash, .9);
      shake = Math.max(shake, 22); punch = Math.max(punch, .07);
      rings.push({ x: cell.x, y: cell.y, t: 0, color: BOLTC, big: true });
      ring.forEach(c => { for (let i = 0; i < 3; i++) parts.push({ k: 'bolt', x: c.x, y: c.y, vx: rnd(-180, 180), vy: rnd(-180, 180), g: 0, t: 0, life: rnd(.25, .45), color: BOLTC, r: rnd(8, 14) }); });
    }, 380);
    HB.sfx.thunder(); HB.haptic('thunder');
    flashTint = '205,230,255'; whiteFlash = 1.25;
    shake = Math.max(shake, 18); freeze = Math.max(freeze, .12); punch = Math.max(punch, .06);
    line.forEach(c => { for (let i = 0; i < 2; i++) parts.push({ k: 'bolt', x: c.x, y: c.y, vx: rnd(-160, 160), vy: rnd(-160, 160), g: 0, t: 0, life: rnd(.25, .45), color: BOLTC, r: rnd(8, 14) }); });
    sparks(cell.x, cell.y, '#FFFFFF', 16, 280);
  }
  /* ---------- ромашка ---------- */
  let gifts = [], ascend = null, gifting = false;
  const DAISY_T = 30;
  const PETAL_NAMES = ['', 'ЛЕПЕСТОК · ПОДАРОК-СОТА', 'ЛЕПЕСТОК · УСИЛЕНИЕ', 'ЛЕПЕСТОК · ФИГУРЫ ДЛЯ РОМАШКИ', 'ОПЫЛЕНИЕ', 'ВОЗНЕСЕНИЕ'];
  let tears = 0;
  function tearPetals(c, n) {
    tears += n;
    for (let k = 0; k < n && c.dPet > 0; k++) {
      c.dPet--;
      const num = 5 - c.dPet;
      c.dT = Math.min(DAISY_T, c.dT + 6);
      if (num === 5) c.dAsc = true;
      for (let i = 0; i < 6; i++) parts.push({ k: 'petal', x: c.x, y: c.y, vx: rnd(-60, 60), vy: rnd(-120, -40), g: 60, t: -k * .15, life: rnd(.7, 1.1), color: '#FFFFFF', r: rnd(2, 3.5), rot: rnd(0, TAU), vr: rnd(-6, 6), soft: true });
      setTimeout(() => { HB.sfx.petal(num); HB.haptic(num >= 4 ? 'record' : 'streak'); }, 120 + k * 260);
      gifts.push({ n: num, cell: c, t: .75 + k * .95 });
    }
  }
  const pieceHasSpecial = p => p.bomb >= 0 || p.bolt >= 0 || p.fire >= 0 || p.ice >= 0 || p.sun >= 0 || p.daisy >= 0;
  function flyTo(from, x, y, col, n = 8) {
    for (let i = 0; i < n; i++) { const d = .35 + i * .03; parts.push({ k: 'star4', soft: true, x: from.x, y: from.y - 24, vx: (x - from.x) / d, vy: (y - from.y + 24) / d, g: 0, t: -i * .025, life: d, color: i % 2 ? '#FFFFFF' : col, r: rnd(2.5, 4) }); }
  }
  /** Сота-подарок: встаёт туда, где закончит ряд (лучше всего через ромашку). */
  function giftTarget(dc) {
    let best = null;
    for (const e of cells) {
      if (e.ci >= 0) continue;
      let sc = 0;
      for (const l of lines) {
        if (!l.includes(e)) continue;
        const miss = l.filter(x => x.ci < 0).length, through = l.includes(dc);
        if (miss === 1) sc = Math.max(sc, through ? 100 : 60);
        else sc = Math.max(sc, (1 - miss / l.length) * 30 + (through ? 8 : 0));
      }
      sc += Math.random();
      if (!best || sc > best.sc) best = { sc, e };
    }
    return best && best.e;
  }
  function giftPlace(cell) {
    if (!cell || cell.ci >= 0) return;
    const keep = { hold, drag, ghost, preview, boltPreview };
    hold = makePiece(3, 0, [[0, 0]], rand(6));
    drag = { i: 3, px: cell.x, py: cell.y, lift: 0, dx: 0, vs: 0 }; ghost = { aq: cell.q, ar: cell.r };
    gifting = true;
    try { place(); } finally { gifting = false; }
    hold = keep.hold; drag = keep.drag; ghost = keep.ghost; preview = keep.preview; boltPreview = keep.boltPreview;
    afterMove();
  }
  /** Мягко смести список сот: без цепочек, с очками за каждую. */
  let sweepBfly = false;
  function sweep(list, ox, oy, per, speed = 520) {
    list.forEach(c => {
      if (c.ci < 0) return;
      c.fx = { bfly: !!sweepBfly, ci: c.ci, v: c.v, age: time - c.born, delay: Math.hypot(c.x - ox, c.y - oy) / speed, t: 0, burst: false, hole: { cx: ox, cy: oy } };
      c.ci = -1; c.bomb = c.fire = c.ice = c.frozen = c.sun = c.daisy = false;
    });
    const pts = list.length * per;
    score += pts; bump = 1;
    if (pts) floatText('+' + U.fmt(pts), ox, oy - 30, 30);
    updateFits();
  }
  function doGift(g) {
    const dc = g.cell;
    if (g.n === 1) {
      const e = giftTarget(dc); if (!e) return;
      flyTo(dc, e.x, e.y, '#FFF3B0', 6);
      gifts.push({ drop: e, t: .38 });
      showBanner(PETAL_NAMES[1], '#FFF3B0');
    } else if (g.n === 2) {
      const types = ['bomb', 'bolt', 'fire', 'ice', 'sun'], type = types[rand(types.length)];
      const cand = [...tray, hold].filter(p => p && !pieceHasSpecial(p));
      if (cand.length) { const p = cand[rand(cand.length)]; p[type] = rand(p.shape.length); flyTo(dc, p.x, p.y, '#FFE45C', 10); p.sc *= 1.25; }
      else pending.push(type);
      showBanner(PETAL_NAMES[2], '#FFE45C');
    } else if (g.n === 3) {
      swapTray(rescuePieces(dc), .2);
      updateFits(); HB.sfx.refill();
      flyTo(dc, 180, TY, '#BFF1FF', 14);
      showBanner(PETAL_NAMES[3], '#BFF1FF');
    } else if (g.n === 4) {
      // Опыление: пыльца разлетается ко всем сотам самого частого цвета, они расцветают и исчезают.
      const cnt = {}; cells.forEach(c => { if (c.ci >= 0 && c !== dc && !c.bomb && !c.fire && !c.ice && !c.sun && !c.daisy) cnt[c.ci] = (cnt[c.ci] || 0) + 1; });
      const ci = +Object.keys(cnt).sort((x, y) => cnt[y] - cnt[x])[0];
      const zone = cells.filter(c => c !== dc && c.ci === ci && !c.bomb && !c.fire && !c.ice && !c.sun && !c.daisy);
      const col = colorOf(ci);
      zone.forEach((c, i) => {
        const d = .35 + Math.hypot(c.x - dc.x, c.y - dc.y) / 700;
        parts.push({ k: 'glow', soft: true, x: dc.x, y: dc.y - 20, vx: (c.x - dc.x) / d, vy: (c.y - dc.y + 20) / d, g: 0, t: 0, life: d, color: 'rgba(255,225,120,.9)', r: 2.5 });
        parts.push({ k: 'bloom', x: c.x, y: c.y, vx: 0, vy: 0, g: 0, t: -d, life: 1, color: col, r: 16, rot: rnd(0, TAU) });
        for (let j = 0; j < 3; j++) parts.push({ k: 'petal', x: c.x, y: c.y, vx: 0, vy: rnd(-70, -20), g: 70, t: -d - .45, life: rnd(1, 1.5), color: j % 2 ? col : '#FFFFFF', r: rnd(2.5, 4), rot: rnd(0, TAU), vr: rnd(-3, 3), soft: true });
      });
      sweep(zone, dc.x, dc.y, 20, 700);
      zone.forEach(c => { if (c.fx) c.fx.delay += .35; });
      HB.sfx.pollen(); HB.haptic('combo');
      showBanner(PETAL_NAMES[4] + ' · ' + zone.length, '#FFE45C');
    } else if (g.n === 5) {
      ascend = { x: dc.x, y: dc.y, t: 0, cell: dc, swept: false };
      dc.daisy = false; dc.dAsc = false; dc.ci = -1;
      slowmo = Math.max(slowmo, 1.2);
      HB.sfx.ascend(); HB.haptic('record');
      showBanner('ВОЗНЕСЕНИЕ', '#FFFFFF');
    }
    if (mode !== 'demo') save();
  }
  function updateDaisies(dt) {
    const live = mode === 'play' || mode === 'demo';
    if (bloomT > 0 && (mode === 'demo' || (mode === 'play' && inputOn))) {
      bloomT = Math.max(0, bloomT - dt);
      if (bloomT === 0) { HB.sfx.daisyWilt(); showBanner('ЦВЕТЕНИЕ ЗАКОНЧИЛОСЬ', '#FFB3D9'); }
      else if (Math.random() < dt * 2.5) parts.push({ k: 'petal', x: rnd(10, 350), y: -10, vx: rnd(10, 40), vy: rnd(30, 60), g: 10, t: 0, life: rnd(4, 6), color: pick(['#FFFFFF', '#FFD1E8', '#FFF3B0']), r: rnd(2.5, 4), rot: rnd(0, TAU), vr: rnd(-3, 3), soft: true });
    }
    if (live && (inputOn || mode === 'demo')) cells.forEach(c => {
      if (!c.daisy || c.dAsc) return;
      c.dT -= dt;
      if (c.dT <= 0) {
        // Завяла: лепестки буреют и опадают, сота остаётся обычной.
        c.daisy = false;
        for (let i = 0; i < c.dPet; i++) parts.push({ k: 'petal', x: c.x + rnd(-6, 6), y: c.y, vx: rnd(40, 90), vy: rnd(-70, -30), g: -10, t: -i * .12, life: rnd(1.6, 2.2), color: '#FFFBEA', r: rnd(2.5, 3.5), rot: rnd(0, TAU), vr: rnd(-4, 4), soft: true });
        for (let i = 0; i < 6; i++) parts.push({ k: 'glow', soft: true, x: c.x, y: c.y, vx: rnd(20, 70), vy: rnd(-60, -10), g: 0, t: -rnd(0, .3), life: rnd(1, 1.6), color: 'rgba(255,245,200,.8)', r: rnd(1, 1.8) });
        HB.sfx.daisyWilt();
      }
    });
    if (live) for (let i = gifts.length - 1; i >= 0; i--) {
      const g = gifts[i]; g.t -= dt;
      if (g.t > 0) continue;
      gifts.splice(i, 1);
      if (g.drop) giftPlace(g.drop); else if (g.cell && (g.cell.daisy || g.n === 5)) doGift(g);
    }
    if (ascend) {
      const a = ascend; a.t += dt;
      if (a.t > .9 && !a.beam) { a.beam = true; sunBeams.push({ kind: 'sky', x: a.x, y: a.y - 60, t: 0, life: 2.4, w: 18 }); }
      // Со всего поля к цветку поднимаются искры света.
      if (!a.swept && Math.random() < dt * 40) { const c0 = cells[rand(cells.length)]; parts.push({ k: 'star4', soft: true, x: c0.x, y: c0.y, vx: (a.x - c0.x) * .5, vy: (a.y - 80 - c0.y) * .5, g: 0, t: 0, life: rnd(1, 1.5), color: Math.random() < .5 ? '#FFFFFF' : '#FFE9A0', r: rnd(1.5, 3) }); }
      if (a.swept && a.t < 3.6 && Math.random() < dt * 30) parts.push({ k: 'star4', soft: true, x: rnd(10, 350), y: -10, vx: rnd(-10, 10), vy: rnd(40, 90), g: 0, t: 0, life: rnd(2, 3), color: '#FFE9A0', r: rnd(1.5, 3) });
      if (a.t > 1.55 && !a.swept) {
        a.swept = true;
        whiteFlash = 1.8; flashTint = '255,252,235';
        [0, .12, .26, .42].forEach((d, i) => rings.push({ x: a.x, y: a.y - 70, t: -d, color: i % 2 ? '#FFE9A0' : '#FFFFFF', big: true, huge: true }));
        const all = cells.filter(c => c.ci >= 0);
        sweepBfly = true; sweep(all, a.x, a.y, 0, 420); sweepBfly = false;
        bloomT = BLOOM_T; HB.sfx.bloomStart();
        setTimeout(() => showBanner('ЦВЕТУЩЕЕ ПОЛЕ · ОЧКИ ×3 НА 30 СЕКУНД', '#FFB3D9'), 900);
        score += 2000; stat.clears++; bump = 1;
        floatText('+2000', 180, CY - 60, 46, '#FFF3B0');
        confetti(70);
        for (let i = 0; i < 40; i++) { const an = rnd(0, TAU), v = rnd(80, 320); parts.push({ k: 'petal', x: a.x, y: a.y - 70, vx: Math.cos(an) * v, vy: Math.sin(an) * v, g: 50, t: 0, life: rnd(1.4, 2.4), color: i % 4 ? '#FFFFFF' : '#FFF3B0', r: rnd(2.5, 4.5), rot: rnd(0, TAU), vr: rnd(-6, 6), soft: true }); }
        showBanner('ПОЛЕ ОЧИЩЕНО', '#FFF3B0');
        if (mode !== 'demo') { if (score > best) { best = score; HB.setBest(best); } save(); }
      }
      if (a.t > 4) ascend = null;
    }
  }
  /** Ромашка на соте: пять лепестков по кругу, жёлтая серединка, кольцо таймера. */
  function drawDaisy(c, x, y, R, t, pet = 5, left = DAISY_T, board = false) {
    const wilt = board ? clamp(1 - left / 6) : 0;
    c.save(); c.translate(x, y); c.rotate(Math.sin(t * 1.5) * .07);
    c.save(); c.globalCompositeOperation = 'lighter';
    const gl = c.createRadialGradient(0, 0, 0, 0, 0, R * 1.1); gl.addColorStop(0, `rgba(255,255,240,${.35 * (1 - wilt)})`); gl.addColorStop(1, 'rgba(255,255,240,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(0, 0, R * 1.1, 0, TAU); c.fill(); c.restore();
    const pc = wilt > 0 ? HB.skins.lerpHex('#FFFFFF', '#CDB892', wilt) : '#FFFFFF';
    for (let i = 0; i < 5; i++) {
      if (i >= pet) continue;
      const a = -Math.PI / 2 + i * TAU / 5 + Math.sin(t * 2 + i) * .04;
      const d = R * .42, px = Math.cos(a) * d, py = Math.sin(a) * d + wilt * R * .18;
      c.save(); c.translate(px, py); c.rotate(a + wilt * .5 * Math.sign(Math.cos(a) || 1));
      c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(R * .03, R * .04, R * .36 * (1 - wilt * .2), R * .15, 0, 0, TAU); c.fill();
      c.fillStyle = pc; c.beginPath(); c.ellipse(0, 0, R * .36 * (1 - wilt * .2), R * .15, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(200,200,215,.6)'; c.lineWidth = .7; c.beginPath(); c.moveTo(-R * .18, 0); c.lineTo(R * .2, 0); c.stroke();
      c.restore();
    }
    const cg = c.createRadialGradient(-R * .05, -R * .06, 0, 0, 0, R * .2);
    cg.addColorStop(0, '#FFF27A'); cg.addColorStop(.7, '#F5B800'); cg.addColorStop(1, '#C98A00');
    c.fillStyle = cg; c.beginPath(); c.arc(0, 0, R * .22, 0, TAU); c.fill();
    c.fillStyle = 'rgba(150,90,0,.45)'; for (let i = 0; i < 7; i++) { const a = i * 2.4; c.beginPath(); c.arc(Math.cos(a) * R * .1, Math.sin(a) * R * .1, R * .025, 0, TAU); c.fill(); }
    c.restore();
    if (board) {
      const k = clamp(left / DAISY_T), hue = 30 + 90 * k;
      c.save(); c.lineWidth = 2.2; c.lineCap = 'round';
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(x, y, R * .98, 0, TAU); c.stroke();
      c.strokeStyle = `hsla(${hue},85%,65%,${left < 6 ? .6 + .4 * Math.sin(t * 10) : .85})`;
      c.beginPath(); c.arc(x, y, R * .98, -Math.PI / 2, -Math.PI / 2 + TAU * k); c.stroke(); c.restore();
    }
  }
  /** Оторванные лепестки висят над ромашкой и мягко покачиваются. */
  function drawTorn(c, cl, t) {
    const n = 5 - cl.dPet;
    for (let j = 0; j < n; j++) {
      const x = cl.x + (j - (n - 1) / 2) * 11, y = cl.y - S * 1.35 + Math.sin(t * 2.2 + j * 1.3) * 3;
      c.save(); c.translate(x, y); c.rotate(Math.sin(t * 1.4 + j) * .5 + j);
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 10); g.addColorStop(0, 'rgba(255,250,210,.45)'); g.addColorStop(1, 'rgba(255,250,210,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, 10, 0, TAU); c.fill(); c.restore();
      c.fillStyle = '#FFFFFF'; c.beginPath(); c.ellipse(0, 0, 6, 2.6, 0, 0, TAU); c.fill();
      c.restore();
    }
  }
  function drawAscend(c) {
    const a = ascend; if (!a) return;
    const k = clamp(a.t / 1.6), rise = eo(k) * 80, y = a.y - rise, fade = clamp((a.t - 1.3) / .5), after = clamp((a.t - 1.6) / 2.4);
    const lightA = a.t < 1.6 ? k : 1 - after;
    // Мир затихает: поле темнеет перед вспышкой.
    if (a.t < 1.7) { c.fillStyle = `rgba(6,4,20,${.5 * k * (1 - fade)})`; c.fillRect(0, 0, 360, H); }
    c.save(); c.globalCompositeOperation = 'lighter';
    // Божественные лучи: медленно вращаются от цветка во все стороны.
    c.save(); c.translate(a.x, y); c.rotate(a.t * .35);
    for (let i = 0; i < 18; i++) {
      const an = i * TAU / 18, len = 420 * (.5 + .5 * k), w = i % 2 ? .06 : .1;
      const g = c.createLinearGradient(0, 0, Math.cos(an) * len, Math.sin(an) * len);
      g.addColorStop(0, `rgba(255,${i % 2 ? 236 : 250},${i % 2 ? 170 : 230},${.32 * lightA})`); g.addColorStop(1, 'rgba(255,240,200,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(an - w) * len, Math.sin(an - w) * len); c.lineTo(Math.cos(an + w) * len, Math.sin(an + w) * len); c.closePath(); c.fill();
    }
    c.restore();
    const halo = c.createRadialGradient(a.x, y, 0, a.x, y, 90 + 50 * k);
    halo.addColorStop(0, `rgba(255,255,240,${.8 * lightA})`); halo.addColorStop(.4, `rgba(255,236,170,${.35 * lightA})`); halo.addColorStop(1, 'rgba(255,236,170,0)');
    c.fillStyle = halo; c.beginPath(); c.arc(a.x, y, 140, 0, TAU); c.fill();
    c.restore();
    // Нимб над цветком.
    if (fade < 1) {
      c.save(); c.globalAlpha = k * (1 - fade); c.strokeStyle = '#FFE9A0'; c.lineWidth = 2.5; c.shadowColor = '#FFE9A0'; c.shadowBlur = 12;
      c.beginPath(); c.ellipse(a.x, y - S * 1.3 - Math.sin(a.t * 3) * 2, S * .75, S * .22, 0, 0, TAU); c.stroke(); c.restore();
    }
    // Лепестки поднимаются спиралью в свет.
    for (let j = 0; j < 10; j++) {
      const an = a.t * (3 + a.t * 3) + j * TAU / 10, r = (26 + 12 * Math.sin(a.t * 3 + j)) * (1 - fade * .3) + fade * 90, py = y + Math.sin(an) * r * .4 - fade * 60 - (j % 2) * 12;
      c.save(); c.globalAlpha = (1 - fade * .85) * (j < 5 ? 1 : .6); c.translate(a.x + Math.cos(an) * r, py); c.rotate(an); c.fillStyle = j % 3 ? '#FFFFFF' : '#FFF3C4'; c.beginPath(); c.ellipse(0, 0, 7, 3, 0, 0, TAU); c.fill(); c.restore();
    }
    if (fade < 1) { c.save(); c.globalAlpha = 1 - fade; drawDaisy(c, a.x, y, S * (1 + .6 * k), time, 0, DAISY_T, false); c.restore(); }
    if (fade > 0 && after < 1) { c.save(); c.globalCompositeOperation = 'lighter'; const w = c.createRadialGradient(a.x, y, 0, a.x, y, 60 * fade + 20); w.addColorStop(0, `rgba(255,255,255,${1 - after})`); w.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = w; c.beginPath(); c.arc(a.x, y, 90, 0, TAU); c.fill(); c.restore(); }
  }
  function startEnding() {
    mode = 'ending'; endT = 0;
    cells.forEach(cl => { if (cl.ci >= 0) cl.gt = .35 + Math.hypot(cl.x - 180, cl.y - CY) / 500; });
    isRecord = score > bestAtStart && score > 0;
    setTimeout(() => { HB.sfx.over(); HB.haptic('over'); }, 300);
  }
  function finish() {
    mode = 'over';
    HB.store.del('hb.save2');
    lastAward = Math.floor(score / 40) + stat.lines * 2 + stat.clears * 10;
    HB.profile.honey += lastAward;
    HB.profile.games++; HB.profile.totalLines += stat.lines;
    HB.saveProfile();
    if (isRecord) { confetti(90); HB.sfx.record(); HB.haptic('record'); }
    HB.ui.showOver({ score, best, isRecord, lines: stat.lines, maxCombo: stat.maxCombo, honey: lastAward, canUndo: canUndo(), price: chancePrice(), afford: HB.profile.honey - lastAward >= chancePrice() });
  }
  /**
   * Три фигуры, которые точно встают одна за другой. Каждая следующая подбирается на поле,
   * где предыдущая уже стоит (с очисткой собранных линий), и лучше всего та, что собирает линии.
   */
  function rescuePieces(focus = null) {
    const occ = new Set(cells.filter(c => c.ci >= 0).map(c => c.idx));
    // Ромашки не сгорают, поэтому в прогнозе остаются на месте после очистки ряда.
    const keep = new Set(cells.filter(c => c.ci >= 0 && c.daisy).map(c => c.idx));
    const fl = focus ? lines.filter(l => l.includes(focus)) : [];
    const free = (q, r) => { const c = map.get(key(q, r)); return c && !occ.has(c.idx); };
    const out = [], used = new Set();
    for (let n = 0; n < 3; n++) {
      let best = null;
      SH.forEach((shape, si) => {
        if (used.has(si)) return;
        for (const cl of cells) {
          const aq = cl.q - shape[0][0], ar = cl.r - shape[0][1];
          if (!shape.every(([dq, dr]) => free(aq + dq, ar + dr))) continue;
          const put = new Set(shape.map(([dq, dr]) => map.get(key(aq + dq, ar + dr)).idx));
          const done = lines.filter(l => l.every(c => occ.has(c.idx) || put.has(c.idx)));
          // Больше линий — лучше, крупные фигуры чуть ценнее, немного случайности для разнообразия.
          let sc = done.length * 10 + shape.length * .6 + Math.random() * 2.5;
          if (focus) {
            // Для ромашки: главное — закрыть ряд через неё, а если не выходит, то приблизить его.
            sc += done.filter(l => fl.includes(l)).length * 60;
            for (const l of fl) sc += l.filter(c => put.has(c.idx)).length * 4 * (1 + l.filter(c => occ.has(c.idx)).length / l.length);
          }
          if (!best || sc > best.sc) best = { sc, si, shape, put, done };
        }
      });
      if (!best) break;
      used.add(best.si);
      best.put.forEach(i => occ.add(i));
      best.done.forEach(l => l.forEach(c => { if (!keep.has(c.idx)) occ.delete(c.idx); }));
      out.push(best.shape);
    }
    while (out.length < 3) out.push([[0, 0]]);
    return out;
  }
  /**
   * Новый лоток вместо старого: особые соты со старых фигур переезжают на новые,
   * каждая на фигуру в том же слоте (или на ближайшую свободную), ничего не теряется.
   */
  const SPEC = ['bomb', 'bolt', 'fire', 'ice', 'sun', 'daisy'];
  function swapTray(shapes, delay0) {
    const carry = [];
    tray.forEach((p, i) => { if (p) SPEC.forEach(k => { if (p[k] >= 0) carry.push({ k, slot: i }); }); });
    const next = shapes.map((sh, i) => makePiece(i, delay0 + i * .12, sh, rand(6)));
    const busy = p => SPEC.filter(k => p[k] >= 0).map(k => p[k]);
    carry.forEach(({ k, slot }) => {
      const order = [slot, 0, 1, 2].filter((v, j, a) => a.indexOf(v) === j);
      const p = order.map(i => next[i]).find(p => p && p[k] < 0 && busy(p).length < p.shape.length) || null;
      if (!p) { if (k !== 'daisy') pending.push(k); return; }
      const freeIdx = p.shape.map((_, j) => j).filter(j => !busy(p).includes(j));
      p[k] = freeIdx[rand(freeIdx.length)];
    });
    tray = next;
    if (carry.length) parts.push({ k: 'flash', x: 180, y: TY, vx: 0, vy: 0, t: 0, life: .35, color: '#FFFFFF', r: 60, soft: true });
  }
  /** Второй шанс за мёд: 1000, потом 2000, 3000… в пределах одной партии. */
  const chancePrice = () => 1000 * (paidChances + 1);
  function buyChance() {
    if (mode !== 'over') return false;
    const price = chancePrice();
    if (HB.profile.honey - lastAward < price) return false;
    if (!undo(true)) return false;
    HB.profile.honey -= price; paidChances++; HB.saveProfile(); save();
    HB.sfx.buy(); HB.haptic('buy');
    return true;
  }
  /** Второй шанс: вместо конца игры фигуры в лотке меняются на подходящие. */
  function undo(paid) {
    if ((!paid && !canUndo()) || (mode !== 'over' && mode !== 'ending')) return false;
    if (mode === 'over') { HB.profile.honey = Math.max(0, HB.profile.honey - lastAward); HB.profile.games--; HB.saveProfile(); }
    if (!paid) undoCharges--; snap = null;
    mode = 'play'; endT = 0; inputOn = true;
    cells.forEach(c => { c.gt = -1; });
    swapTray(rescuePieces(), .15);
    updateFits();
    HB.sfx.undo(); HB.sfx.refill(); HB.haptic('undo');
    showBanner('ВТОРОЙ ШАНС!', SKY);
    rings.push({ x: 180, y: TY, t: 0, color: SKY, big: true });
    for (let i = 0; i < 24; i++) { const a = rnd(0, TAU), v = rnd(60, 200); parts.push({ k: 'star4', soft: true, x: 180 + rnd(-120, 120), y: TY + rnd(-20, 20), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 40, t: -rnd(0, .3), life: rnd(.6, 1.1), color: i % 2 ? '#FFFFFF' : SKY, r: rnd(2.5, 4.5) }); }
    save();
    return true;
  }
  function newGame() {
    cells.forEach(c => { c.ci = -1; c.bomb = false; c.fire = false; c.ice = false; c.frozen = false; c.sun = false; c.daisy = false; c.pt = 9; c.fx = null; c.gt = -1; });
    gifts = []; ascend = null;
    score = shown = 0; combo = miss = 0; stat = { lines: 0, maxCombo: 0, clears: 0 };
    pending = []; charge = 0; undoCharges = 0; snap = null; lastAward = 0; hold = null; holdHint = false; paidChances = 0; bloomT = 0;
    best = HB.best(); bestAtStart = best; recordShown = false; isRecord = false;
    parts = []; snowflakes = []; hurricanes = []; bunnies = []; skyfires = []; rings = []; floats = []; banners = []; splats = []; booms = []; strikes = []; hudFx = []; flames = []; sunBeams = [];
    drag = ghost = preview = null; idleT = 0;
    refill(); updateFits();
    mode = 'play';
    save();
  }

  /* ---------- живые показы комбо ---------- */
  // Каждый показ собирает на поле ситуацию и сам ставит соту в (0,0) (или в target).
  // seed фиксирует случайность в момент постановки, чтобы огонь бежал именно туда, куда нужно.
  const COMBOS = [
    { id: 'bomb', g: ['bomb'], need: ['bomb'], name: 'Бомба', desc: 'Сгорает в линии и взрывает всех соседей.', set: s => { s.row(); s.put(2, 0, 'bomb'); s.fill(12); } },
    { id: 'chain', g: ['bomb'], need: ['bomb'], name: 'Цепная реакция', desc: 'Бомба поджигает бомбу, каждая следующая даёт вдвое больше очков.', set: s => { s.row(); s.put(2, 0, 'bomb'); s.put(3, -1, 'bomb'); s.put(4, -2, 'bomb'); s.fill(12); } },
    { id: 'thunderbomb', g: ['bomb', 'bolt'], need: ['bomb', 'bolt'], name: 'Громовой взрыв', desc: 'Молния заряжает бомбу: взрыв на кольцо шире, очки ×2.', piece: 'bolt', set: s => { s.row(); s.put(2, 0, 'bomb'); s.fill(12); } },
    { id: 'napalm', g: ['bomb', 'fire'], need: ['bomb', 'fire'], name: 'Напалм', desc: 'Огонь добежал до бомбы: огненный взрыв шире, очки ×2.', seed: 0, set: s => { s.row(); s.put(-2, 0, 'fire'); [[-2, -1], [-1, -1], [-3, 1], [-2, 1]].forEach(([q, r]) => s.put(q, r, 'bomb')); s.fill(8); } },
    { id: 'fireblast', g: ['bomb', 'fire'], need: ['bomb', 'fire'], name: 'Огненный взрыв', desc: 'Бомба разносит костёр: огонь бежит двумя языками.', set: s => { s.row(); s.put(2, 0, 'bomb'); s.put(3, -1, 'fire'); s.fill(16); } },
    { id: 'icefan', g: ['bomb', 'ice'], need: ['bomb', 'ice'], name: 'Ледяной веер', desc: 'Взрыв гонит лёд от бомбы веером на 5 линий.', set: s => { s.row(); s.put(1, 0, 'bomb'); s.put(1, -1, 'ice'); s.region((q, r) => r < -1 && q !== 1 && q + r !== 0, 24); } },
    { id: 'cryo', g: ['bomb', 'ice'], need: ['bomb', 'ice'], name: 'Криобомба', desc: 'Лёд замораживает бомбу, и она лопается ледяным взрывом.', set: s => { s.row(); s.put(2, 0, 'ice'); s.put(2, -1, 'bomb'); s.fill(14); } },
    { id: 'thermo', g: ['bomb', 'sun'], need: ['bomb', 'sun'], name: 'Термояд', desc: 'Бомба и солнце задели друг друга: удар шире, очки ×3.', set: s => { s.row(); s.put(2, 0, 'bomb'); s.put(3, -1, 'sun', 1); s.fill(14); } },
    { id: 'bolt', g: ['bolt'], need: ['bolt'], name: 'Молния', desc: 'Бьёт по всей линии через себя, даже если она неполная.', piece: 'bolt', set: s => { s.row([0, 3]); s.fill(10); } },
    { id: 'boltring', g: ['bolt'], need: ['bolt'], name: 'Кольцо молний', desc: 'Молния замкнула свой ряд и вторым ударом бьёт по соседям.', piece: 'bolt', set: s => { s.row(); s.ring(0, 0); s.fill(8); } },
    { id: 'firestorm', g: ['bolt', 'fire'], need: ['bolt', 'fire'], name: 'Огненная буря', desc: 'Молния раздувает костёр: сразу три языка пламени.', piece: 'bolt', set: s => { s.row(); s.put(-2, 0, 'fire'); s.fill(18); } },
    { id: 'icestorm', g: ['bolt', 'ice'], need: ['bolt', 'ice'], name: 'Ледяной разряд', desc: 'Иней ползёт по трём линиям и всё разом лопается.', piece: 'bolt', set: s => { s.row(); s.put(-2, 0, 'ice'); s.region((q, r) => q === -2 || q + r === -2, 20); s.fill(6); } },
    { id: 'sunstorm', g: ['bolt', 'sun'], need: ['bolt', 'sun'], len: 5, name: 'Ураган', desc: 'Молния задела солнце: вокруг поля поднимается вихрь, кружит соты и уносит 5–6 рядов.', piece: 'bolt', set: s => { s.row(); s.put(-3, 0, 'sun', 2); s.fill(16); } },
    { id: 'fire', g: ['fire'], need: ['fire'], name: 'Костёр', desc: 'Огонь бежит по 6–8 случайным сотам: прямо или зигзагом.', set: s => { s.row(); s.put(-2, 0, 'fire'); s.fill(18); } },
    { id: 'forest', g: ['fire'], need: ['fire'], name: 'Лесной пожар', desc: 'Огонь добежал до другого костра, и тот тоже вспыхивает.', seed: 0, set: s => { s.row(); s.put(-2, 0, 'fire'); [[-2, -1], [-1, -1], [-3, 1], [-2, 1]].forEach(([q, r]) => s.put(q, r, 'fire')); s.fill(12); } },
    { id: 'steam', g: ['fire', 'ice'], need: ['fire', 'ice'], name: 'Паровой взрыв', desc: 'Лёд и огонь встретились: облако пара обжигает всё вокруг.', set: s => { s.row(); s.put(-2, 0, 'ice'); s.put(-2, -1, 'fire'); s.fill(14); } },
    { id: 'flare', g: ['fire', 'sun'], need: ['fire', 'sun'], name: 'Протуберанец', desc: 'Солнце и огонь подпитали друг друга: огонь бежит двумя длинными языками.', set: s => { s.row(); s.put(-3, 0, 'sun', 1); s.put(-3, -1, 'fire'); s.fill(18); } },
    { id: 'freeze', g: ['ice'], need: ['ice'], name: 'Заморозка', desc: 'Поставленный лёд замораживает соседей, они потом звонко лопаются.', piece: 'ice', target: [0, -1], set: s => { s.ring(0, -1); s.fill(10); } },
    { id: 'iceburst', g: ['ice'], need: ['ice'], name: 'Ледяной взрыв', desc: 'Лёд сгорел в линии и раскрывается снежинкой: кольцо вокруг и шесть лучей на три соты.', set: s => { s.row(); s.put(-2, 0, 'ice'); s.ring(-2, 0); s.fill(8); } },
    { id: 'glacier', g: ['ice'], need: ['ice'], name: 'Ледниковый период', desc: 'Лёд разбудил лёд: иней расходится на два кольца.', set: s => { s.row(); s.put(-2, 0, 'ice'); s.put(-2, -1, 'ice'); s.fill(18); } },
    { id: 'prism', g: ['ice', 'sun'], need: ['ice', 'sun'], name: 'Призма', desc: 'Лёд в зоне солнца раскладывает луч на шесть радужных лучей.', set: s => { s.row(); s.put(-3, 0, 'sun', 2); s.put(-3, -1, 'ice'); s.fill(22); } },
    { id: 'sun', g: ['sun'], need: ['sun'], len: 4.6, name: 'Солнечные зайчики', desc: 'Разбил солнце сам: луч бьёт по его зоне, а солнце рассыпается зайчиками, которые прыгают по полю и выжигают соты.', set: s => { s.row(); s.put(-3, 0, 'sun', 2); s.fill(18); } },
    { id: 'twosun', g: ['sun'], need: ['sun'], len: 5, name: 'Небесный огонь', desc: 'Два солнца в одной цепочке: с неба быстро бьют лучи и выжигают всё поле.', set: s => { s.row(); s.put(-3, 0, 'sun', 2); s.put(3, 0, 'sun', 1); s.fill(26); } },
    { id: 'sunauto', g: ['sun'], need: ['sun'], name: 'Луч бьёт сам', desc: 'Солнце на пределе: на следующий ход луч ударит без твоей помощи.', set: s => { s.put(-2, -1, 'sun', 3); s.fill(22); } },
    { id: 'binary', g: ['sun'], need: ['sun'], name: 'Двойная звезда', desc: 'Луч задел другое солнце: между ними вспыхивает мост света, а с неба обрушивается небесный огонь.', set: s => { s.row(); s.put(-3, 0, 'sun', 2); s.put(-2, -2, 'sun', 1); s.fill(14); } },
    { id: 'daisy1', g: ['daisy'], need: ['daisy'], len: 4.6, name: 'Ромашка: 1-й лепесток', desc: 'Ряд сгорел, а ромашка осталась. Лепесток отрывается, и цветок дарит соту, которая закроет ряд.', set: s => { s.row(); s.put(2, 0, 'daisy', 5); [-3, -2, -1, 0, 1, 3, 4].forEach(q => s.put(q, -1, 'ci')); s.region((q, r) => r >= 2, 12); } },
    { id: 'daisy2', g: ['daisy'], need: ['daisy'], len: 4.2, name: 'Ромашка: 2-й лепесток', desc: 'Второй лепесток превращает одну из твоих фигур в особую.', piece2: true, set: s => { s.row(); s.put(2, 0, 'daisy', 4); s.fill(14); } },
    { id: 'daisy3', g: ['daisy'], need: ['daisy'], len: 4.6, piece2: true, spec2: 'bomb', name: 'Ромашка: 3-й лепесток', desc: 'Третий лепесток меняет фигуры на те, что помогут ромашке расцвести: они закрывают ряды через неё. Особые соты со старых фигур переезжают на новые.', set: s => { s.row(); s.put(2, 0, 'daisy', 3); s.fill(18); } },
    { id: 'daisy4', g: ['daisy'], need: ['daisy'], len: 4.4, name: 'Ромашка: опыление', desc: 'Четвёртый лепесток: пыльца летит ко всем сотам самого частого цвета, они расцветают и исчезают.', set: s => { s.row(); s.put(2, 0, 'daisy', 2); s.fill(28); } },
    { id: 'daisy5', g: ['daisy'], need: ['daisy'], len: 5.6, name: 'Ромашка: вознесение', desc: 'Пятый лепесток: цветок возносится в столбе света, всё поле очищается (+2000), из сот вылетают бабочки, и начинается Цветущее поле: 30 секунд очки ×3.', set: s => { s.row(); s.put(2, 0, 'daisy', 1); s.fill(30); } },
    { id: 'chaos', g: ['multi'], need: ['bolt', 'bomb', 'ice'], len: 5.2, name: 'Стихийный хаос', desc: 'Три разные стихии в одной цепочке: очки ×2, радужные волны и замедление.', piece: 'bolt', set: s => { s.row(); s.put(2, 0, 'bomb'); s.put(-2, 0, 'ice'); s.fill(14); } },
    { id: 'frostsun', g: ['multi'], need: ['ice', 'sun', 'bomb'], len: 5.4, name: 'Мороз + солнце + бомба', desc: 'Призма, термояд и хаос разом: радужные лучи и ядерная вспышка.', set: s => { s.row(); s.put(-3, 0, 'sun', 2); s.put(-3, -1, 'ice'); s.put(-2, -1, 'bomb'); s.fill(18); } },
    { id: 'apocalypse', g: ['multi'], need: ['bolt', 'bomb', 'ice', 'fire', 'sun'], len: 5.8, name: 'Апокалипсис', desc: 'Четыре и больше стихий в одной цепочке: очки ×3 и всё, что есть в игре.', piece: 'bolt', set: s => { s.row(); s.put(2, 0, 'bomb'); s.put(-2, 0, 'ice'); s.put(3, 0, 'fire'); s.put(-4, 0, 'sun', 2); s.fill(18); } }
  ];
  function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function setupCombo(cb) {
    cells.forEach(c => { c.ci = -1; c.bomb = c.fire = c.ice = c.frozen = c.sun = c.daisy = false; c.sunStage = 0; gifts = []; ascend = null; c.fx = null; c.gt = -1; c.pt = 9; c.born = time; });
    const rn = HB.skins.srng(cb.id.length * 131 + 7), taken = new Set();
    const s = {
      row(except = [0]) { cells.forEach(c => { if (c.r === 0 && !except.includes(c.q)) { c.ci = (c.q + 9) % 6; } }); },
      put(q, r, kind, stage = 0) { const c = map.get(key(q, r)); if (!c) return; c.ci = c.ci >= 0 ? c.ci : Math.floor(rn() * 6); if (kind === 'ci') return; c[kind] = true; if (kind === 'sun') c.sunStage = stage; if (kind === 'daisy') { c.dPet = stage || 5; c.dT = 30; c.dAsc = false; } taken.add(c); },
      ring(q, r) { const c0 = map.get(key(q, r)); ringOf(c0).forEach(c => { if (c.ci < 0) c.ci = Math.floor(rn() * 6); }); },
      region(f, n) { cells.filter(c => c.ci < 0 && f(c.q, c.r) && !(c.q === 0 && c.r === 0)).slice(0, n).forEach(c => { c.ci = Math.floor(rn() * 6); }); },
      fill(n) {
        const free = cells.filter(c => c.ci < 0 && c.r !== 0 && !(cb.target && c.q === cb.target[0] && c.r === cb.target[1]));
        for (let i = 0; i < n && free.length; i++) { const k = Math.floor(rn() * free.length); free.splice(k, 1)[0].ci = Math.floor(rn() * 6); }
      }
    };
    cb.set(s);
    const sp = cb.piece;
    tray = [makePiece(0, 0, [[0, 0]], 3, sp === 'bomb' ? 0 : -1, null, sp === 'bolt' ? 0 : -1, sp === 'fire' ? 0 : -1, sp === 'ice' ? 0 : -1, sp === 'sun' ? 0 : -1), null, null];
    tray[0].delay = 0; hold = null;
    if (cb.piece2) { tray[1] = makePiece(1, 0, [[0, 0], [1, 0], [0, 1]], 1); tray[2] = makePiece(2, 0, [[0, 0], [1, 0]], 4); }
    if (cb.spec2) tray[2][cb.spec2] = 0;
    score = 0; shown = 0; combo = 0; miss = 0; pending = [];
    updateFits();
  }
  let demo = null, lastShake = 0;
  const clearFx = () => { bloomT = 0; gifts = []; ascend = null; parts = []; snowflakes = []; hurricanes = []; bunnies = []; skyfires = []; rings = []; floats = []; banners = []; splats = []; booms = []; strikes = []; flames = []; sunBeams = []; hudFx = []; slowmo = freeze = shake = punch = whiteFlash = 0; };
  /** Открыть показ комбо id. Если показ уже идёт, партия уже отложена: просто переключаем ролик. */
  function startDemo(id, onEnd, onDone) {
    const cb = COMBOS.find(c => c.id === id); if (!cb) return;
    const saved = demo ? demo.saved : { s: snapshot(), mode, undoCharges, snap, bestAtStart, recordShown, rnd: Math.random, onEnd, bloomT };
    clearFx();
    drag = ghost = preview = boltPreview = null;
    Math.random = saved.rnd;
    setupCombo(cb);
    mode = 'demo'; inputOn = false;
    const tq = cb.target || [0, 0], tc = map.get(key(tq[0], tq[1]));
    const keep = demo || {};
    demo = { cb, saved, t: 0, placed: false, pt: 0, tx: tc.x, ty: tc.y, tq, paused: !!keep.paused, slow: !!keep.slow, ts: keep.paused ? 0 : 1, fade: 1, onDone: onDone || keep.onDone };
  }
  function demoCtl(o) { if (!demo) return null; if ('paused' in o) demo.paused = o.paused; if ('slow' in o) demo.slow = o.slow; return { paused: demo.paused, slow: demo.slow }; }
  const demoProgress = () => demo ? clamp(demo.placed ? .3 + .7 * (demo.t - demo.pt) / (demo.cb.len || 4.2) : .3 * demo.t / 1.45) : 0;
  function endDemo() {
    if (!demo) return;
    const sv = demo.saved;
    Math.random = sv.rnd;
    clearFx();
    drag = ghost = preview = boltPreview = null;
    restore(sv.s);
    bloomT = sv.bloomT || 0;
    mode = sv.mode; undoCharges = sv.undoCharges; snap = sv.snap; bestAtStart = sv.bestAtStart; recordShown = sv.recordShown;
    shown = score; best = HB.best();
    demo = null;
    if (sv.onEnd) sv.onEnd();
  }
  function demoPlace() {
    const cb = demo.cb, pc = tray[0];
    Math.random = mulberry(cb.seed == null ? 11 : cb.seed);
    drag = { i: 0, px: demo.tx, py: demo.ty, lift: 0, dx: 0, vs: 0 };
    ghost = { aq: demo.tq[0] - pc.shape[0][0], ar: demo.tq[1] - pc.shape[0][1] };
    place();
    drag = ghost = preview = boltPreview = null;
  }
  function updateDemo(dt) {
    demo.t += dt;
    if (!demo.placed) {
      const k = clamp((demo.t - .4) / .95), e = eio(k);
      if (demo.t > .4) {
        if (!drag) drag = { i: 0, px: sx(0), py: TY, lift: 0, dx: 0, vs: 0 };
        move({ x: lerp(sx(0), demo.tx, e), y: lerp(TY, demo.ty, e) - Math.sin(Math.PI * e) * 50, touch: false });
      }
      if (demo.t >= 1.45) { demo.placed = true; demo.pt = demo.t; demoPlace(); }
    } else if (demo.t - demo.pt > (demo.cb.len || 4.2) && !demo.doneSent) { demo.doneSent = true; if (demo.onDone) demo.onDone(); else endDemo(); }
  }
  /** Для автотеста и подбора сида: разыграть комбо мгновенно и вернуть текст баннеров. */
  function probeCombo(id, seed) {
    const cb = COMBOS.find(c => c.id === id);
    const saved = { s: snapshot(), mode, rnd: Math.random, bloomT };
    setupCombo(cb);
    mode = 'demo';
    const tq = cb.target || [0, 0], tc = map.get(key(tq[0], tq[1]));
    demo = { cb, t: 0, tx: tc.x, ty: tc.y, tq };
    bannerLog = '';
    const keep = cb.seed; if (seed != null) cb.seed = seed;
    demoPlace();
    cb.seed = keep;
    const out = bannerLog;
    Math.random = saved.rnd; demo = null; gifts = []; ascend = null;
    parts = []; rings = []; floats = []; banners = []; splats = []; booms = []; strikes = []; flames = []; sunBeams = [];
    restore(saved.s); mode = saved.mode; bloomT = saved.bloomT;
    return out;
  }
  function drawDemo(c) {
    if (!demo) return;
    if (demo.fade > 0) { c.fillStyle = `rgba(8,6,20,${demo.fade})`; c.fillRect(0, 0, W, H); }
  }

  /* ---------- обновление ---------- */
  function spring(o, k, target, dt, K = 380, D = 17) {
    const v = o[k + 'V'] || 0;
    o[k + 'V'] = v + (K * (target - o[k]) - D * v) * dt;
    o[k] += o[k + 'V'] * dt;
  }
  function igniteFx(b) {
    HB.sfx.bonfire(b.storm); HB.sfx.fireRun(b.storm ? 1.9 : 1.4, b.storm); HB.haptic('fire');
    if (b.pts) floatText('+' + U.fmt(b.pts), b.x, b.y - 20, 26, FIREC);
    shake = Math.max(shake, b.storm ? 24 : 13); whiteFlash = Math.max(whiteFlash, b.storm ? 1.1 : .55); flashTint = '255,190,120';
    freeze = Math.max(freeze, .08); punch = Math.max(punch, .06);
    bgFlash = 1; bgFlashColor = '#FF7A1A';
    rings.push({ x: b.x, y: b.y, t: 0, color: FIREC, big: true });
    for (let i = 0; i < 26; i++) parts.push({ k: 'flamep', x: b.x + rnd(-10, 10), y: b.y + rnd(-6, 8), vx: rnd(-60, 60), vy: rnd(-200, -60), g: -40, t: 0, life: rnd(.4, .8), color: '#FF8A00', r: rnd(10, 18) });
    for (let i = 0; i < 26; i++) parts.push({ k: 'ember', soft: true, x: b.x, y: b.y, vx: rnd(-160, 160), vy: rnd(-300, -80), g: 60, t: 0, life: rnd(.8, 1.5), color: i % 3 ? '#FFB347' : '#FFE08A', r: rnd(1.2, 2.6) });
    for (let i = 0; i < 5; i++) parts.push({ k: 'crumb', x: b.x, y: b.y, vx: rnd(-150, 150), vy: rnd(-250, -100), g: 800, t: 0, life: rnd(.7, 1), color: i % 2 ? '#6B3F1F' : '#2A1608', r: rnd(4, 7), rot: rnd(0, TAU), vr: rnd(-10, 10) });
    for (let i = 0; i < 6; i++) parts.push({ k: 'smoke', x: b.x + rnd(-8, 8), y: b.y, vx: rnd(-40, 40), vy: rnd(-90, -40), g: -20, t: 0, life: rnd(1, 1.6), color: 'rgba(50,35,30,.5)', r: rnd(10, 18) });
  }
  function iceShards(x, y, col, k = 1) {
    for (let i = 0; i < 5 * k; i++) parts.push({ k: 'tri', x, y, vx: rnd(-170, 170), vy: rnd(-260, -40), g: 800, t: 0, life: rnd(.6, 1), color: i % 2 ? '#E8FAFF' : HB.skins.mix(col, 'w', .55), r: rnd(3, 7), rot: rnd(0, TAU), vr: rnd(-14, 14) });
    for (let i = 0; i < 4 * k; i++) parts.push({ k: 'glass', x, y, vx: rnd(-200, 200), vy: rnd(-260, -40), g: 800, t: 0, life: rnd(.5, .9), color: 'rgba(230,248,255,.95)', r: rnd(3, 7), rot: rnd(0, TAU), vr: rnd(-14, 14) });
    for (let i = 0; i < 2 * k; i++) parts.push({ k: 'star4', soft: true, x: x + rnd(-10, 10), y: y + rnd(-10, 10), vx: 0, vy: rnd(-30, 10), g: 0, t: 0, life: .7, color: '#FFFFFF', r: rnd(3, 6) });
    parts.push({ k: 'glow', soft: true, x, y, vx: rnd(-10, 10), vy: rnd(-20, 5), g: 0, t: 0, life: 1, color: 'rgba(200,240,255,.7)', r: 5 });
  }
  function iceFx(b) {
    const pan = (b.x - 180) / 180;
    if (b.pts) floatText('+' + U.fmt(b.pts), b.x, b.y - 20, 26, ICEC);
    flashTint = '210,240,255';
    if (b.mode === 'storm') {
      HB.sfx.iceCrawl(); HB.haptic('freeze');
      whiteFlash = Math.max(whiteFlash, .5); shake = Math.max(shake, 8);
      for (let i = 0; i < 20; i++) parts.push({ k: 'glow', soft: true, x: b.x + rnd(-30, 30), y: b.y + rnd(-30, 30), vx: rnd(-40, 40), vy: rnd(-30, 30), g: 0, t: 0, life: rnd(1, 1.6), color: 'rgba(210,245,255,.9)', r: rnd(1, 2.2) });
    } else if (b.mode === 'stormhit') {
      HB.sfx.iceStormHit(); HB.haptic('icestorm');
      whiteFlash = 1.6; shake = Math.max(shake, 32); freeze = Math.max(freeze, .08); slowmo = Math.max(slowmo, .75); punch = Math.max(punch, .12);
      rings.push({ x: b.x, y: b.y, t: 0, color: ICEC, big: true, huge: true });
      rings.push({ x: b.x, y: b.y, t: -.07, color: '#FFFFFF', big: true, huge: true });
      rings.push({ x: b.x, y: b.y, t: -.16, color: '#9FD8FF', big: true, huge: true });
      iceShards(b.x, b.y, '#BDEBFF', 6);
    } else if (b.mode === 'glacier') {
      HB.sfx.iceCrawl(); setTimeout(() => HB.sfx.iceBurst(pan), 520); HB.haptic('icestorm');
      whiteFlash = Math.max(whiteFlash, 1); shake = Math.max(shake, 22); slowmo = Math.max(slowmo, .5);
      rings.push({ x: b.x, y: b.y, t: -.5, color: ICEC, big: true, huge: true });
      rings.push({ x: b.x, y: b.y, t: -.6, color: '#FFFFFF', big: true });
      iceShards(b.x, b.y, '#BDEBFF', 4);
    } else if (b.mode === 'fan') {
      HB.sfx.iceFan(pan); HB.haptic('shatter');
      whiteFlash = Math.max(whiteFlash, .9); shake = Math.max(shake, 20); freeze = Math.max(freeze, .1);
      rings.push({ x: b.x, y: b.y, t: 0, color: ICEC, big: true });
      for (let i = 0; i < 26; i++) { const a = b.dir + rnd(-.6, .6), v = rnd(180, 420); parts.push({ k: 'tri', x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 300, t: 0, life: rnd(.5, .9), color: i % 2 ? '#E8FAFF' : '#9FD8FF', r: rnd(3, 7), rot: rnd(0, TAU), vr: rnd(-14, 14) }); }
    } else if (b.mode === 'steam') {
      HB.sfx.steam(); HB.haptic('fire');
      whiteFlash = Math.max(whiteFlash, .7); flashTint = '240,245,250'; shake = Math.max(shake, 16);
      for (let i = 0; i < 26; i++) parts.push({ k: 'puff', x: b.x + rnd(-20, 20), y: b.y + rnd(-15, 15), vx: rnd(-90, 90), vy: rnd(-120, -30), g: -30, t: 0, life: rnd(1, 1.7), color: 'rgba(240,245,250,.85)', r: rnd(8, 16) });
      drops(b.x, b.y, '#DDF4FF', 8);
    } else {
      HB.sfx.iceBurst(pan); HB.haptic('shatter');
      whiteFlash = Math.max(whiteFlash, .7); shake = Math.max(shake, 16); slowmo = Math.max(slowmo, .35);
      snowflakes.push({ x: b.x, y: b.y, t: 0, life: 1.3, rot: rnd(-.2, .2) });
      rings.push({ x: b.x, y: b.y, t: -.3, color: ICEC, big: true });
      iceShards(b.x, b.y, '#BDEBFF', 3);
    }
  }
  /** Стихийный хаос: радужные волны, долгое замедление и самый глубокий удар. */
  function chaosFx(x, y, apo) {
    slowmo = Math.max(slowmo, apo ? 1.3 : .95); whiteFlash = Math.max(whiteFlash, 1.2); flashTint = '255,220,245';
    HB.fx.RAINBOW.forEach((col, i) => rings.push({ x, y, t: -.15 - i * .09, color: col, big: true, huge: true }));
    for (let i = 0; i < (apo ? 60 : 36); i++) { const a = rnd(0, TAU), v = rnd(120, 320); parts.push({ k: 'star4', soft: true, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, t: -rnd(0, .3), life: rnd(.9, 1.5), color: HB.fx.RAINBOW[i % 6], r: rnd(3, 6) }); }
    HB.sfx.chaos(apo); HB.haptic('icestorm');
  }
  function sunVapor(x, y, prism) {
    const col = prism != null ? HB.fx.RAINBOW[prism % 6] : 'rgba(255,241,192,.95)';
    for (let i = 0; i < 8; i++) parts.push({ k: 'glow', soft: true, x: x + rnd(-10, 10), y: y + rnd(-10, 10), vx: rnd(-30, 30), vy: rnd(-110, -40), g: -20, t: 0, life: rnd(.9, 1.5), color: i % 2 ? col : 'rgba(255,255,240,.95)', r: rnd(1.4, 2.6) });
    for (let i = 0; i < 3; i++) parts.push({ k: 'star4', soft: true, x: x + rnd(-8, 8), y: y + rnd(-8, 8), vx: 0, vy: rnd(-40, -10), g: 0, t: 0, life: rnd(.7, 1.1), color: prism != null ? col : '#FFFFFF', r: rnd(3, 6) });
    parts.push({ k: 'flash', x, y, vx: 0, vy: 0, t: 0, life: .4, color: '#FFFFFF', r: 28, soft: true });
  }
  function sunFx(b) {
    HB.sfx.sunBeam(b.R, b.mode); HB.haptic('sun');
    if (b.pts) floatText('+' + U.fmt(b.pts), b.x, b.y - 26, 32, SUNC);
    const w = 13 + b.R * 5;
    sunBeams.push({ kind: 'sky', x: b.x, y: b.y, t: 0, life: 1.7, w });
    flashTint = '255,242,215'; whiteFlash = 1.7; shake = Math.max(shake, 26 + b.R * 3); punch = Math.max(punch, .12); slowmo = Math.max(slowmo, .9);
    bgFlash = 1; bgFlashColor = '#FFD36B';
    for (let d = 0; d <= b.R; d++) rings.push({ x: b.x, y: b.y, t: -(.42 + d * .22), color: d % 2 ? '#FFB347' : '#FFF1C0', big: true, huge: d >= 2 });
    for (let i = 0; i < 46; i++) parts.push({ k: 'glow', soft: true, x: b.x + rnd(-w, w), y: rnd(-20, b.y), vx: rnd(-8, 8), vy: rnd(15, 50), g: 0, t: -rnd(0, .5), life: rnd(1.1, 1.8), color: 'rgba(255,245,210,.9)', r: rnd(.8, 1.8) });
    (b.lines || []).forEach(([x1, y1, x2, y2], i) => sunBeams.push({ kind: 'line', x: x1, y: y1, x2, y2, t: -.3 - i * .06, life: 1.3, w: w * .8, over: 40 }));
    (b.rays || []).forEach(([x2, y2, d], i) => sunBeams.push({ kind: 'line', x: b.x, y: b.y, x2, y2, t: -.3 - i * .05, life: 1.45, w: w * .6, over: 90, col: ['255,94,126', '255,184,77', '255,228,92', '94,224,138', '77,195,255', '154,123,255'][d % 6] }));
    if (b.from) sunBeams.push({ kind: 'line', x: b.from[0], y: b.from[1], x2: b.x, y2: b.y, t: 0, life: 1.2, w: w * .7, col: '255,190,110' });
    if (b.mode === 'nuke') { blast(b.x, b.y, 1.8); whiteFlash = 2.2; }
    if (b.mode === 'hurricane') { HB.sfx.hurricane(); HB.haptic('icestorm'); slowmo = Math.max(slowmo, 1.1); }
    if (b.mode === 'bunny') setTimeout(() => HB.sfx.bunnies(), 250);
    if (b.mode === 'flare') for (let i = 0; i < 34; i++) { const a = rnd(0, TAU), v = rnd(80, 220); parts.push({ k: 'flamep', x: b.x + Math.cos(a) * 14, y: b.y + Math.sin(a) * 14, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: -30, t: -rnd(.3, .6), life: rnd(.5, .9), color: '#FF8A00', r: rnd(10, 18) }); }
  }
  function explode(b) {
    if (b.sun) { sunFx(b); return; }
    if (b.ice) { iceFx(b); return; }
    if (b.fire) { igniteFx(b); return; }
    if (b.cryo) {
      HB.sfx.bomb(); HB.sfx.iceBurst((b.x - 180) / 180); HB.haptic('shatter');
      if (b.pts) floatText('+' + U.fmt(b.pts), b.x, b.y - 20, 28, ICEC);
      shake = Math.max(shake, 24); whiteFlash = 1.3; flashTint = '210,240,255'; freeze = Math.max(freeze, .1); slowmo = Math.max(slowmo, .45); punch = Math.max(punch, .1);
      rings.push({ x: b.x, y: b.y, t: 0, color: ICEC, big: true, huge: true });
      rings.push({ x: b.x, y: b.y, t: -.07, color: '#FFFFFF', big: true });
      iceShards(b.x, b.y, '#BDEBFF', 6);
      blast(b.x, b.y, 1.1);
      return;
    }
    if (b.napalm) {
      HB.sfx.napalm(); HB.haptic('bomb');
      if (b.pts) floatText('+' + U.fmt(b.pts), b.x, b.y - 20, 28, FIREC);
      shake = Math.max(shake, 24); whiteFlash = 1.2; flashTint = '255,170,90'; freeze = Math.max(freeze, .12); punch = Math.max(punch, .09);
      rings.push({ x: b.x, y: b.y, t: 0, color: '#FF5A1A', big: true, huge: true });
      rings.push({ x: b.x, y: b.y, t: -.08, color: AMBER, big: true });
      for (let i = 0; i < 40; i++) parts.push({ k: 'flamep', x: b.x + rnd(-14, 14), y: b.y + rnd(-10, 10), vx: rnd(-160, 160), vy: rnd(-240, -40), g: -30, t: 0, life: rnd(.4, .9), color: '#FF8A00', r: rnd(10, 22) });
      sparks(b.x, b.y, AMBER, 26, 340);
      shards(b.x, b.y, '#2A1608', 10, 1.7);
      blast(b.x, b.y, 1.25);
      for (let i = 0; i < 12; i++) parts.push({ k: 'smoke', x: b.x + rnd(-12, 12), y: b.y + rnd(-12, 12), vx: rnd(-80, 80), vy: rnd(-110, -20), g: -20, t: 0, life: rnd(1, 1.6), color: 'rgba(60,35,25,.55)', r: rnd(12, 24) });
      return;
    }
    if (b.charged) {
      HB.sfx.thunderBomb(); HB.haptic('thunderbomb');
      if (b.pts) floatText('+' + U.fmt(b.pts), b.x, b.y - 20, 28 + Math.min(12, Math.log2(b.pts / 75) * 4), '#C9E8FF');
      shake = Math.max(shake, 28); whiteFlash = 1.5; flashTint = '205,230,255'; freeze = Math.max(freeze, .16); punch = Math.max(punch, .11);
      rings.push({ x: b.x, y: b.y, t: 0, color: BOLTC, big: true, huge: true });
      rings.push({ x: b.x, y: b.y, t: -.06, color: '#FFFFFF', big: true, huge: true });
      rings.push({ x: b.x, y: b.y, t: -.14, color: CORAL, big: true });
      sparks(b.x, b.y, BOLTC, 34, 400); sparks(b.x, b.y, '#FFFFFF', 18, 320);
      for (let i = 0; i < 12; i++) parts.push({ k: 'bolt', x: b.x, y: b.y, vx: rnd(-260, 260), vy: rnd(-260, 260), g: 0, t: 0, life: rnd(.3, .5), color: BOLTC, r: rnd(12, 20) });
      shards(b.x, b.y, '#2A2250', 12, 1.9);
      blast(b.x, b.y, 1.3);
      for (let i = 0; i < 12; i++) parts.push({ k: 'smoke', x: b.x + rnd(-12, 12), y: b.y + rnd(-12, 12), vx: rnd(-80, 80), vy: rnd(-110, -20), g: -20, t: 0, life: rnd(.9, 1.4), color: 'rgba(40,40,90,.5)', r: rnd(12, 24) });
      return;
    }
    HB.sfx.bomb(); HB.haptic('bomb');
    if (b.thermo) { whiteFlash = 1.6; flashTint = '255,240,200'; sunVapor(b.x, b.y, null); slowmo = Math.max(slowmo, .4); }
    if (b.pts) floatText('+' + U.fmt(b.pts), b.x, b.y - 20, 24 + Math.min(12, Math.log2(b.pts / 75) * 4), b.thermo ? SUNC : CORAL);
    shake = Math.max(shake, 16 + b.power * 4); whiteFlash = 1; flashTint = '255,235,200'; freeze = Math.max(freeze, .1); punch = Math.max(punch, .08);
    blast(b.x, b.y, 1 + (b.power - 1) * .4);
  }
  /** Реалистичный взрыв: огненный шар темнеет в дым, раскалённые обломки, ударная волна и выжженное пятно. */
  function blast(x, y, k = 1) {
    setTimeout(() => {
      parts.push({ k: 'fireball', x, y, vx: 0, vy: -20, g: 0, t: 0, life: .65, color: '#FF7A1A', r: 44 * k });
      rings.push({ x, y, t: 0, color: '#FFFFFF', big: false });
      rings.push({ x, y, t: -.05, color: '#FF9A3C', big: true });
      for (let i = 0; i < 18; i++) { const a = rnd(0, TAU), v = rnd(200, 460) * k; parts.push({ k: 'trailspark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, g: 500, t: 0, life: rnd(.4, .8), color: pick(['#FFD27A', '#FF9A3C', '#FFF1C0']), r: rnd(1.2, 2) }); }
      for (let i = 0; i < 12; i++) { const a = rnd(0, TAU), v = rnd(140, 320) * k; parts.push({ k: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, g: 900, t: 0, life: rnd(.8, 1.3), color: pick(['#2B1D18', '#3A2A22', '#1C1410']), r: rnd(3, 6.5), rot: rnd(0, TAU), vr: rnd(-16, 16) }); }
      for (let i = 0; i < 14; i++) parts.push({ k: 'smoke2', x: x + rnd(-14, 14), y: y + rnd(-10, 10), vx: rnd(-50, 50) * k, vy: rnd(-70, -15), g: -12, t: -rnd(.08, .35), life: rnd(1.6, 2.6), color: pick(['78,76,82', '62,60,66', '96,93,100']), r: rnd(9, 15) * k });
      splat(x, y, 'rgb(22,14,12)', 5, 1.5 * k);
    }, 70);
  }
  function update(dt) {
    if (demo) {
      // Пауза и замедление просмотра: плавно, как у видео.
      const target = demo.paused ? 0 : demo.slow ? .2 : 1;
      demo.ts += (target - demo.ts) * Math.min(1, dt * 9);
      if (Math.abs(target - demo.ts) < .01) demo.ts = target;
      demo.fade = Math.max(0, demo.fade - dt * 3);
      dt *= demo.ts;
    }
    time += dt;
    if (demo) updateDemo(dt);
    updateDaisies(dt);
    HB.skins.tick(dt);
    if (shake > lastShake + 4) HB.skins.stir(Math.min(1.4, shake / 22), 180, CY);
    lastShake = shake;
    let tinkles = 0;
    for (const cl of cells) {
      if (cl.pt < 9) cl.pt += dt;
      const fx = cl.fx;
      if (fx) {
        fx.t += dt;
        if (!fx.burst && fx.t >= fx.delay) {
          fx.burst = true;
          const col = colorOf(fx.ci), B = HB.fx.bursts[HB.profile.burst];
          if (bloomT > 0 || fx.bfly) parts.push({ k: 'butterfly', soft: true, x: cl.x, y: cl.y, vx: rnd(-50, 50), vy: rnd(-90, -40), g: 0, t: 0, life: rnd(1.8, 2.8), color: Math.random() < .5 ? col : pick(['#FF7AA2', '#FFD23F', '#7AD7FF', '#B388EB', '#FF9F4A', '#6EE7B7']), r: rnd(7, 10), rot: rnd(0, TAU) });
          if (fx.orbit) { parts.push({ k: 'orbit', cx: 180, cy: CY, ang: Math.atan2(cl.y - CY, cl.x - 180), rad: Math.hypot(cl.x - 180, cl.y - CY), rad1: 178 + rnd(-14, 14), w: rnd(3.5, 5), t: 0, life: rnd(1.3, 1.7), color: col, r: S * .8, tile: true, rot: 0 }); }
          else if (fx.sunburn || fx.sun) sunVapor(cl.x, cl.y, fx.prism);
          else if (fx.frozen || fx.ice || fx.frost != null) { iceShards(cl.x, cl.y, col); if (tinkles++ < 3) HB.sfx.iceCrack((cl.x - 180) / 180); }
          else if (B) B.cell(fxApi, cl.x, cl.y, col, fx.hole || { cx: cl.x, cy: cl.y });
          else if (!HB.skins.breakFx(fxApi, cl.x, cl.y, col, fx.v)) {
            shards(cl.x, cl.y, col, 3); sparks(cl.x, cl.y, col, 4, 160); drops(cl.x, cl.y, col, 2);
            splat(cl.x, cl.y, col);
          }
        }
        if (fx.t > fx.delay + .34) cl.fx = null;
      }
    }
    for (const b of booms) { b.t += dt; if (!b.fired && b.t >= 0) { b.fired = true; explode(b); } }
    booms = booms.filter(b => !b.fired);
    if (ripple && (ripple.t += dt) > 1.4) ripple = null;
    let licks = 0;
    for (const f of flames) {
      f.t += dt;
      if (f.t >= 0 && !f.done) {
        f.done = true;
        for (let i = 0; i < 8; i++) parts.push({ k: 'flamep', x: f.x + rnd(-8, 8), y: f.y + rnd(-4, 8), vx: rnd(-25, 25), vy: rnd(-150, -60), g: -40, t: 0, life: rnd(.35, .7), color: '#FF8A00', r: rnd(8, 14) });
        for (let i = 0; i < 6; i++) parts.push({ k: 'ember', soft: true, x: f.x, y: f.y, vx: rnd(-90, 90), vy: rnd(-200, -60), g: 40, t: 0, life: rnd(.6, 1.1), color: '#FFB347', r: rnd(1, 2) });
        parts.push({ k: 'smoke', x: f.x, y: f.y, vx: rnd(-20, 20), vy: rnd(-70, -30), g: -15, t: 0, life: 1.1, color: 'rgba(45,30,25,.45)', r: rnd(8, 12) });
        if (licks++ < 2) HB.sfx.flameLick((f.x - 180) / 180);
      }
    }
    flames = flames.filter(f => !f.done);
    const lit = cells.filter(c => c.ci >= 0 && c.fire);
    if (lit.length && mode !== 'over') {
      if ((crackT -= dt) <= 0) { HB.sfx.crackle(); crackT = rnd(.25, 1) / Math.min(2, lit.length); }
      lit.forEach(c => { if (Math.random() < dt * 4) parts.push({ k: 'ember', soft: true, x: c.x + rnd(-5, 5), y: c.y - 6, vx: rnd(-15, 15), vy: rnd(-70, -35), g: -10, t: 0, life: rnd(.7, 1.2), color: '#FFB347', r: rnd(.8, 1.6) }); });
    }
    for (const s of strikes) s.t += dt;
    strikes = strikes.filter(s => s.t < (s.life || .6));
    for (const s of sunBeams) {
      s.t += dt;
      // Луч долетел до конца зоны: вспышка искр и кольцо в точке удара.
      if (s.kind === 'line' && !s.hit && !s.noHit && s.t >= .2) {
        s.hit = true;
        const col = `rgb(${s.col || '255,215,130'})`, ang = Math.atan2(s.y2 - s.y, s.x2 - s.x);
        rings.push({ x: s.x2, y: s.y2, t: 0, color: col });
        for (let i = 0; i < 9; i++) { const a = ang + rnd(-1.1, 1.1), v = rnd(90, 260); parts.push({ k: 'star4', soft: true, x: s.x2, y: s.y2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 60, t: 0, life: rnd(.4, .8), color: i % 3 ? col : '#FFFFFF', r: rnd(2, 4) }); }
      }
    }
    sunBeams = sunBeams.filter(s => s.t < s.life);
    for (const f of snowflakes) f.t += dt;
    snowflakes = snowflakes.filter(f => f.t < f.life);
    for (const h of hurricanes) {
      h.t += dt;
      if (h.t < 0) continue;
      if (!h.started) { h.started = true; shake = Math.max(shake, 14); }
      // Песчинки и пыль кружат по краю поля.
      const k = h.t / h.life, n = Math.round(dt * 260 * (1 - k * .6));
      for (let i = 0; i < n; i++) parts.push({ k: 'orbit', cx: 180, cy: CY, ang: rnd(0, TAU), rad: rnd(140, 205), rad1: rnd(150, 215), w: rnd(4, 6.5), t: 0, life: rnd(.6, 1.2), color: pick(['rgba(235,205,150,.9)', 'rgba(210,180,130,.8)', 'rgba(255,240,200,.9)']), r: rnd(.8, 2), soft: true });
      if (Math.random() < dt * 8) HB.haptic('tick');
    }
    hurricanes = hurricanes.filter(h => h.t < h.life);
    for (const s of skyfires) {
      s.t += dt;
      if (s.t < 0) continue;
      if (!s.started) { s.started = true; HB.sfx.skyfire(); HB.haptic('sun'); whiteFlash = Math.max(whiteFlash, 1.4); flashTint = '255,236,190'; slowmo = Math.max(slowmo, 1.2); }
      // С неба, из-под камеры телефона, быстро мелькают лучи по всему полю.
      const n = Math.round(dt * 70);
      for (let i = 0; i < n; i++) {
        const c0 = cells[rand(cells.length)];
        sunBeams.push({ kind: 'line', x: 180 + rnd(-50, 50), y: -30, x2: c0.x + rnd(-6, 6), y2: c0.y + rnd(-6, 6), t: 0, life: rnd(.22, .38), w: rnd(3.5, 7), over: 14, col: pick(['255,236,170', '255,250,225', '255,200,120']), noHit: Math.random() < .8 });
      }
      shake = Math.max(shake, 10);
    }
    skyfires = skyfires.filter(s => s.t < s.life);
    for (const b of bunnies) {
      b.t += dt;
      if (b.t < 0) continue;
      const h = Math.floor(b.t / b.hop);
      if (h > b.h && h < b.pts.length) { b.h = h; const [x, y] = b.pts[h]; HB.sfx.bunnyHop(h); for (let i = 0; i < 6; i++) parts.push({ k: 'star4', soft: true, x, y, vx: rnd(-80, 80), vy: rnd(-90, 20), g: 60, t: 0, life: rnd(.4, .7), color: i % 2 ? '#FFFFFF' : '#FFE08A', r: rnd(2, 3.5) }); rings.push({ x, y, t: 0, color: '#FFE9A0' }); }
    }
    bunnies = bunnies.filter(b => b.t < (b.pts.length - 1) * b.hop + .25);
    if (combo >= 2 && mode === 'play') {
      hudAcc += dt * (10 + Math.min(combo, 8) * 5) * (1 - miss * .25);
      while (hudAcc > 1) {
        hudAcc--;
        hudFx.push({ x: 180 + rnd(-52, 52), y: 70 + TOP, vx: rnd(-12, 12), vy: -rnd(40, 95), t: 0, life: rnd(.45, .9), r: rnd(2.5, 5.5) });
      }
    }
    for (const f of hudFx) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vx += rnd(-120, 120) * dt; }
    hudFx = hudFx.filter(f => f.t < f.life);
    if (drag) {
      drag.vs += (drag.dx - drag.vs) * .35;
      const pc = pieceAt(drag.i);
      if (pc) {
        const tr = HB.fx.trails[HB.profile.trail] || HB.fx.trails.sparks;
        const spd = Math.abs(drag.dx) / Math.max(dt, .001);
        tr.spawn(p => parts.push(p), pc.x, pc.y, Math.min(34, pc.w * pc.sc * .4), spd, dt, colorOf(pc.ci), drag.trail || (drag.trail = {}));
        (drag.hist || (drag.hist = [])).push({ x: pc.x, y: pc.y, t: time });
        while (drag.hist.length && time - drag.hist[0].t > (tr.keep || .32)) drag.hist.shift();
      }
      drag.dx = 0;
    }
    const wiggle = mode === 'play' && inputOn && !drag && idleT > 6 && (idleT % 1.6) < .5;
    let wiggled = false;
    [0, 1, 2, 3].forEach(i => {
      const pc = pieceAt(i);
      if (!pc || (i === 3 && !holdOn())) return;
      if (pc.delay > 0) { pc.delay -= dt; return; }
      const held = drag && drag.i === i;
      const tx = held ? drag.px : sx(i), ty = held ? drag.py - drag.lift : TY + Math.sin(time * 2.2 + i * 1.3) * 1.6;
      const f = 1 - Math.exp(-dt * (held ? 45 : 15));
      pc.x += (tx - pc.x) * f; pc.y += (ty - pc.y) * f;
      spring(pc, 'sc', held ? 1 : restScale(pc, i), dt);
      let rt = held ? clamp(drag.vs * .018, -.28, .28) : 0;
      if (wiggle && !wiggled && pc.fits) { rt = Math.sin(time * 26) * .14; wiggled = true; }
      if (mode === 'ending' && !pc.fits) rt = Math.sin(time * 40) * .08 * clamp(1 - endT);
      pc.rot += (rt - pc.rot) * Math.min(1, dt * 16);
      pc.fa += ((pc.fits ? 1 : .28) - pc.fa) * Math.min(1, dt * 8);
    });
    if (mode === 'play' && inputOn && !drag) idleT += dt;
    shown += (score - shown) * Math.min(1, dt * 9);
    if (Math.abs(score - shown) < .5) shown = score;
    bump = Math.max(0, bump - dt * 3.5);
    shake *= Math.exp(-dt * 11); if (shake < .1) shake = 0;
    punch *= Math.exp(-dt * 9);
    bgFlash = Math.max(0, bgFlash - dt * 2.2);
    whiteFlash = Math.max(0, whiteFlash - dt * 4);
    parts = HB.fx.update(parts, dt, H);
    for (const s of splats) s.t += dt;
    splats = splats.filter(s => s.t < s.life);
    for (const r of rings) r.t += dt;
    rings = rings.filter(r => r.t < (r.big ? .7 : .55));
    for (const f of floats) f.t += dt;
    floats = floats.filter(f => f.t < f.life);
    if (banners.length) {
      banners[0].t += dt;
      if (banners[0].t > banners[0].life || (banners.length > 1 && banners[0].t > .9)) banners.shift();
    }
    for (const b of bgHex) { b.y -= b.s * dt; b.a += b.va * dt; if (b.y < -80) { b.y = H + 80; b.x = rnd(0, W); } }
    if (mode === 'ending' && (endT += dt) > 1.5) finish();
  }

  /* ---------- отрисовка ---------- */
  const cv = document.getElementById('game'), ctx = cv.getContext('2d');
  let scale = 1, dpr = 1;
  function text(c, str, x, y, font, color, align = 'center') {
    c.font = font; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle';
    c.fillText(str, x, y);
  }
  function rr(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function drawBg(c) {
    const sk = skin();
    if (!HB.skins.drawBg(c, W, H, { cy: CY, cells, R: S * .93, ty: TY })) {
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, sk.bg[0]); g.addColorStop(1, sk.bg[1]);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      if (sk.stars) {
        for (const s of stars) {
          c.fillStyle = `rgba(255,255,255,${.25 + .45 * (.5 + .5 * Math.sin(time * 2 + s.p))})`;
          c.fillRect(s.x, s.y % H, s.s, s.s);
        }
      } else {
        c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.035)';
        for (const b of bgHex) { hexPath(c, b.x, b.y, b.r, b.a); c.stroke(); }
      }
    }
    if (bgFlash > 0) {
      const rg = c.createRadialGradient(180, CY, 20, 180, CY, 380);
      rg.addColorStop(0, bgFlashColor); rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = .25 * bgFlash; c.fillStyle = rg; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
    }
  }
  function rippleK(cl) {
    if (!ripple) return 1;
    const lt = ripple.t - Math.hypot(cl.x - ripple.x, cl.y - ripple.y) / 650;
    return lt > 0 && lt < 1 ? 1 + .085 * Math.exp(-5 * lt) * Math.sin(lt * 24) : 1;
  }
  function drawBomb(c, x, y, R, t) {
    c.beginPath(); c.arc(x, y + R * .06, R * .44, 0, TAU); c.fillStyle = '#1A1430'; c.fill();
    c.lineWidth = R * .07; c.strokeStyle = 'rgba(255,255,255,.35)'; c.stroke();
    c.beginPath(); c.arc(x - R * .14, y - R * .1, R * .12, 0, TAU); c.fillStyle = 'rgba(255,255,255,.45)'; c.fill();
    c.beginPath(); c.moveTo(x + R * .22, y - R * .3); c.quadraticCurveTo(x + R * .42, y - R * .62, x + R * .56, y - R * .5);
    c.lineWidth = R * .09; c.strokeStyle = '#C9A46A'; c.stroke();
    const fl = .5 + .5 * Math.sin(t * 34) * Math.sin(t * 13);
    c.beginPath(); c.arc(x + R * .58, y - R * .52, R * (.12 + .08 * fl), 0, TAU); c.fillStyle = AMBER; c.fill();
    c.beginPath(); c.arc(x + R * .58, y - R * .52, R * .06, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill();
  }
  function jag(c, x0, y0, x1, y1, n, amp) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    c.moveTo(x0, y0);
    for (let i = 1; i < n; i++) { const k = i / n, o = rnd(-amp, amp); c.lineTo(x0 + dx * k + nx * o, y0 + dy * k + ny * o); }
    c.lineTo(x1, y1);
  }
  function drawStrikes(c) {
    for (const s of strikes) {
      const k = s.t / (s.life || .6), a = (s.t < .08 ? 1 : Math.random() < .3 ? .35 : 1) * (1 - k);
      c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      jag(c, s.sx, -30, s.x, s.y, 12, 16);
      for (let b = 0; b < 3; b++) {
        const t0 = rnd(.25, .8), bx = lerp(s.sx, s.x, t0), by = lerp(-30, s.y, t0);
        jag(c, bx, by, bx + rnd(-60, 60), by + rnd(20, 70), 4, 8);
      }
      for (let i = 1; i < s.line.length; i++) jag(c, s.line[i - 1][0], s.line[i - 1][1], s.line[i][0], s.line[i][1], 3, 7);
      if (s.ring && s.ring.length && s.t > .36) s.ring.forEach(([tx, ty]) => { jag(c, s.x, s.y, tx, ty, 4, 6); jag(c, tx, ty, tx + rnd(-16, 16), ty + rnd(-16, 16), 3, 4); });
      c.strokeStyle = `rgba(110,170,255,${.2 * a})`; c.lineWidth = 18; c.stroke();
      c.strokeStyle = `rgba(160,210,255,${.55 * a})`; c.lineWidth = 7; c.stroke();
      c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = 2.4; c.stroke();
      const gl = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, 70);
      gl.addColorStop(0, `rgba(220,240,255,${.7 * a})`); gl.addColorStop(1, 'rgba(120,180,255,0)');
      c.fillStyle = gl; c.fillRect(s.x - 70, s.y - 70, 140, 140);
      c.restore();
    }
  }
  function drawBolt(c, x, y, R, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const p = .6 + .4 * Math.sin(t * 17) * Math.sin(t * 5);
    const g = c.createRadialGradient(x, y, 0, x, y, R * .8);
    g.addColorStop(0, `rgba(160,210,255,${.55 * p})`); g.addColorStop(1, 'rgba(120,180,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, R * .8, 0, TAU); c.fill();
    c.restore();
    const P = [[.12, -.62], [-.3, .08], [-.02, .08], [-.16, .64], [.32, -.12], [.04, -.12], [.2, -.62]];
    c.beginPath(); P.forEach(([px, py], i) => i ? c.lineTo(x + px * R, y + py * R) : c.moveTo(x + px * R, y + py * R)); c.closePath();
    c.fillStyle = '#FFE45C'; c.fill(); c.lineWidth = R * .07; c.strokeStyle = '#FFFFFF'; c.lineJoin = 'round'; c.stroke();
    if (Math.sin(t * 23) > .6) { c.strokeStyle = 'rgba(200,230,255,.9)'; c.lineWidth = 1.2; c.beginPath(); jag(c, x + R * .3, y - R * .4, x + R * .6, y - R * .7, 3, 3); c.stroke(); }
  }
  function flameTongue(c, x, base, h, w, sway) {
    [[1, 'rgba(255,80,20,.8)'], [.68, 'rgba(255,170,40,.9)'], [.38, 'rgba(255,245,200,.95)']].forEach(([k, col]) => {
      const hh = h * k, ww = w * k, sx = sway * k;
      c.fillStyle = col; c.beginPath(); c.moveTo(x - ww, base);
      c.bezierCurveTo(x - ww, base - hh * .45, x + sx - ww * .25, base - hh * .78, x + sx, base - hh);
      c.bezierCurveTo(x + sx + ww * .25, base - hh * .78, x + ww, base - hh * .45, x + ww, base);
      c.closePath(); c.fill();
    });
  }
  /** Солнце: корона, лучи, протуберанцы, диск с потемнением к краю и белым ядром, грануляция, марево. */
  function drawSun(c, x, y, R, t, stage, grow = 9) {
    const pulse = 1 + .06 * Math.sin(t * 2.4) + .03 * Math.sin(t * 5.1);
    const gk = grow < 1.5 ? 1 + .35 * Math.exp(-4 * grow) : 1;
    const disc = R * (.56 + stage * .08) * pulse * gk;
    c.save(); c.globalCompositeOperation = 'lighter';
    const cr = disc * (3 + stage * .9);
    const cg = c.createRadialGradient(x, y, disc * .8, x, y, cr);
    cg.addColorStop(0, 'rgba(255,245,210,.6)'); cg.addColorStop(.3, 'rgba(255,200,110,.24)'); cg.addColorStop(1, 'rgba(255,140,40,0)');
    c.fillStyle = cg; c.beginPath(); c.arc(x, y, cr, 0, TAU); c.fill();
    c.translate(x, y); c.rotate(t * .12);
    for (let i = 0; i < 12; i++) {
      c.rotate(TAU / 12);
      const L = disc * (1.7 + .5 * Math.sin(t * 3 + i * 1.7)) * (1 + stage * .25);
      const g = c.createLinearGradient(0, 0, L, 0); g.addColorStop(0, 'rgba(255,240,200,.5)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(0, -disc * .12); c.lineTo(L, 0); c.lineTo(0, disc * .12); c.closePath(); c.fill();
    }
    c.rotate(-t * .12 - TAU);
    for (let layer = 0; layer < 2; layer++) {
      c.beginPath();
      for (let i = 0; i <= 60; i++) {
        const a = i / 60 * TAU, n = .06 * Math.sin(a * 7 + t * 1.3 + layer) + .04 * Math.sin(a * 13 - t * 2.3) + .03 * Math.sin(a * 23 + t * 3.1);
        const rr = disc * (1.02 + layer * .04 + Math.max(0, n) * (1.6 - layer * .6));
        i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.closePath(); c.fillStyle = layer ? 'rgba(255,110,40,.35)' : 'rgba(255,170,70,.5)'; c.fill();
    }
    c.restore();
    const dg = c.createRadialGradient(x - disc * .08, y - disc * .1, 0, x, y, disc);
    dg.addColorStop(0, '#FFFFFF'); dg.addColorStop(.36, '#FFFCEE'); dg.addColorStop(.66, '#FFE08A'); dg.addColorStop(.88, '#FFA640'); dg.addColorStop(1, '#EE6A1E');
    c.fillStyle = dg; c.beginPath(); c.arc(x, y, disc, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.arc(x, y, disc, 0, TAU); c.clip(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 10; i++) { const a = i * 2.4 + t * .25, d = disc * (.2 + (i % 4) * .18); c.fillStyle = `rgba(255,255,230,${.1 + .06 * Math.sin(t * 3 + i)})`; c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, disc * .16, 0, TAU); c.fill(); }
    const core = c.createRadialGradient(x, y, 0, x, y, disc * .5); core.addColorStop(0, 'rgba(255,255,255,.9)'); core.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = core; c.fillRect(x - disc, y - disc, disc * 2, disc * 2);
    c.restore();
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {
      c.strokeStyle = `rgba(255,235,200,${.08 + .04 * Math.sin(t * 2 + i)})`;
      c.beginPath();
      for (let k = 0; k <= 12; k++) { const yy = y - disc * 1.2 - k * disc * .22, xx = x + (i - 1) * disc * .5 + Math.sin(t * 5 + k * .9 + i * 2) * disc * .18; k ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }
      c.stroke();
    }
    if (stage >= 1) {
      c.setLineDash([4, 6]); c.lineDashOffset = -t * 20;
      c.strokeStyle = `rgba(255,210,120,${.28 + .12 * Math.sin(t * 3)})`; c.lineWidth = 2;
      c.beginPath(); c.arc(x, y, (stage + .5) * S * R3, 0, TAU); c.stroke(); c.setLineDash([]);
    }
    c.restore();
    for (let i = 0; i < 3; i++) { c.fillStyle = i < stage ? '#FFE08A' : 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(x - 8 + i * 8, y + R * .78, 2.4, 0, TAU); c.fill(); }
  }
  function sunLight(c, s) {
    const r = (Math.max(1, s.sunStage) + 1.2) * S * R3, fl = .85 + .15 * Math.sin(time * 2.4 + s.q);
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(s.x, s.y, 6, s.x, s.y, r);
    g.addColorStop(0, `rgba(255,236,190,${.4 * fl})`); g.addColorStop(.5, `rgba(255,200,120,${.14 * fl})`); g.addColorStop(1, 'rgba(255,170,80,0)');
    c.fillStyle = g; c.fillRect(s.x - r, s.y - r, r * 2, r * 2);
    c.restore();
  }
  /** Марево: соты в зоне жара чуть колышутся, как воздух над огнём. */
  function haze(cl) {
    let dx = 0, dy = 0;
    for (const s of sunsOn) {
      if (s === cl) continue;
      const d = cdist(s, cl), R0 = Math.max(1, s.sunStage) + .5;
      if (d > R0) continue;
      const a = 1.9 * (1 - d / (R0 + .5));
      dx += Math.sin(time * 9 + cl.y * .35 + cl.x * .12) * a;
      dy += Math.cos(time * 7.3 + cl.x * .3) * a * .6;
    }
    return [dx, dy];
  }
  /** Проработанный луч: широкое тёплое свечение, яркая середина, белое ядро и бегущие по лучу прожилки. */
  /**
   * Луч-выстрел: голова летит от солнца с замедлением, за ней тянется сужающийся луч,
   * в конце жизни хвост догоняет голову и луч улетает, а не обрывается.
   */
  function shotBeam(c, s, a) {
    const L = Math.hypot(s.x2 - s.x, s.y2 - s.y) || 1, ang = Math.atan2(s.y2 - s.y, s.x2 - s.x);
    const k = s.t / s.life, over = s.over == null ? 60 : s.over;
    const head = (L + over) * eo(clamp(s.t / .26)), tail = (L + over) * Math.pow(clamp((k - .5) / .5), 1.6);
    const len = head - tail; if (len < 2) return;
    const col = s.col || '255,215,130', w = s.w * (1 + .1 * Math.sin(s.t * 47 + s.x)) * (1 - .35 * clamp((k - .6) / .4));
    c.save(); c.translate(s.x, s.y); c.rotate(ang); c.globalCompositeOperation = 'lighter';
    // Поперечные слои, у головы луч заострён, дальше поля он гаснет по длине.
    const fadeA = x => x <= L ? 1 : clamp(1 - (x - L) / over);
    const layer = (ww, al, cc) => {
      const tipL = Math.min(len * .45, ww * 5);
      const g = c.createLinearGradient(tail, 0, head, 0);
      const st = (x, v) => g.addColorStop(clamp((x - tail) / len), `rgba(${cc},${al * v * fadeA(x)})`);
      st(tail, 0); st(tail + Math.min(len * .25, 30), 1);
      if (L > tail && L < head) st(L, 1);
      st(head - tipL, 1); st(head, .15);
      c.fillStyle = g;
      c.beginPath(); c.moveTo(tail, -ww * .6); c.lineTo(head - tipL, -ww); c.quadraticCurveTo(head, -ww * .2, head + ww * .4, 0); c.quadraticCurveTo(head, ww * .2, head - tipL, ww); c.lineTo(tail, ww * .6); c.closePath(); c.fill();
    };
    layer(w * 3.2, .18 * a, col); layer(w * 1.4, .5 * a, col); layer(w * .55, .85 * a, '255,248,230'); layer(w * .18, a, '255,255,255');
    // Бегущие блики внутри луча.
    for (let i = 0; i < 6; i++) { const off = tail + ((s.t * 2.2 + i * .17) % 1) * len; c.fillStyle = `rgba(255,255,255,${.35 * a * fadeA(off)})`; c.fillRect(off, (i - 2.5) * w * .12, len * .06, 1.2); }
    // Голова-комета, пока луч летит.
    if (s.t < .5) {
      const hk = 1 - clamp(s.t / .5), hx = Math.min(head, L + over * .4);
      const g = c.createRadialGradient(hx, 0, 0, hx, 0, w * 4.5);
      g.addColorStop(0, `rgba(255,255,255,${hk * a})`); g.addColorStop(.3, `rgba(${col},${.6 * hk * a})`); g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g; c.beginPath(); c.arc(hx, 0, w * 4.5, 0, TAU); c.fill();
    }
    c.restore();
  }
  function beam(c, x1, y1, x2, y2, w, a, col, t) {
    const L = Math.hypot(x2 - x1, y2 - y1) || 1, ang = Math.atan2(y2 - y1, x2 - x1);
    c.save(); c.translate(x1, y1); c.rotate(ang); c.globalCompositeOperation = 'lighter';
    const layer = (ww, al, cc) => {
      const g = c.createLinearGradient(0, -ww, 0, ww);
      g.addColorStop(0, `rgba(${cc},0)`); g.addColorStop(.5, `rgba(${cc},${al})`); g.addColorStop(1, `rgba(${cc},0)`);
      c.fillStyle = g; c.fillRect(0, -ww, L, ww * 2);
    };
    layer(w * 3.4, .2 * a, col); layer(w * 1.5, .5 * a, col); layer(w * .6, .85 * a, '255,248,230'); layer(w * .2, a, '255,255,255');
    for (let i = 0; i < 7; i++) { const off = ((t * 1.8 + i * .17) % 1) * L; c.fillStyle = `rgba(255,255,255,${.3 * a})`; c.fillRect(off, (i - 3) * w * .12, L * .07, 1.3); }
    c.restore();
  }
  function lensFlare(c, x, y, a, w) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y, 0, x, y, w * 4.2);
    g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(.25, `rgba(255,235,180,${.6 * a})`); g.addColorStop(1, 'rgba(255,180,80,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, w * 4.2, 0, TAU); c.fill();
    c.save(); c.translate(x, y); c.scale(1, .05);
    const g2 = c.createRadialGradient(0, 0, 0, 0, 0, 280); g2.addColorStop(0, `rgba(255,245,220,${.85 * a})`); g2.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = g2; c.beginPath(); c.arc(0, 0, 280, 0, TAU); c.fill();
    c.restore();
    const vx = 180 - x, vy = CY - y;
    [.5, .9, 1.35].forEach((m, i) => { c.fillStyle = `rgba(${['255,200,120', '180,220,255', '255,160,200'][i]},${.14 * a})`; hexPath(c, x + vx * m, y + vy * m, 10 + i * 9); c.fill(); });
    c.restore();
  }
  /** Снежинка из взрыва льда: шесть лучей с веточками вырастают и тают. */
  function drawSnowflakes(c) {
    for (const f of snowflakes) {
      const k = f.t / f.life, grow = eo(clamp(f.t / .4)), a = 1 - clamp((k - .55) / .45), L = S * R3 * 3.2 * grow;
      c.save(); c.translate(f.x, f.y); c.rotate(f.rot + f.t * .4); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      const arm = (w, col) => {
        c.strokeStyle = col; c.lineWidth = w; c.beginPath();
        for (let i = 0; i < 6; i++) {
          const an = i * TAU / 6, ca = Math.cos(an), sa = Math.sin(an);
          c.moveTo(0, 0); c.lineTo(ca * L, sa * L);
          [[.42, .3], [.7, .22]].forEach(([p, bl]) => {
            const bx = ca * L * p, by = sa * L * p;
            [-1, 1].forEach(sd => { const b2 = an + sd * Math.PI / 3; c.moveTo(bx, by); c.lineTo(bx + Math.cos(b2) * L * bl, by + Math.sin(b2) * L * bl); });
          });
        }
        c.stroke();
      };
      arm(9, `rgba(120,200,255,${.25 * a})`); arm(4, `rgba(190,235,255,${.6 * a})`); arm(1.6, `rgba(255,255,255,${a})`);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 22); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(200,240,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, 22, 0, TAU); c.fill();
      c.restore();
    }
  }
  /** Ураган: полупрозрачные струи ветра по кругу вокруг поля. */
  function drawHurricanes(c) {
    for (const h of hurricanes) {
      if (h.t < 0) continue;
      const k = h.t / h.life, a = Math.min(1, h.t / .3) * (1 - clamp((k - .7) / .3));
      c.save(); c.translate(180, CY); c.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        const r = 140 + (i % 7) * 11, st = h.t * (4.5 + (i % 3)) + i * 1.9, len = .7 + (i % 4) * .25;
        c.strokeStyle = `rgba(235,215,175,${(.1 + (i % 3) * .06) * a})`; c.lineWidth = 2 + (i % 3) * 2;
        c.beginPath(); c.arc(0, 0, r, st, st + len); c.stroke();
      }
      const g = c.createRadialGradient(0, 0, 120, 0, 0, 230); g.addColorStop(0, 'rgba(120,100,70,0)'); g.addColorStop(.7, `rgba(150,125,90,${.18 * a})`); g.addColorStop(1, 'rgba(120,100,70,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, 230, 0, TAU); c.fill();
      c.restore();
    }
  }
  /** Солнечные зайчики: яркие пятна света прыгают по дугам с соты на соту. */
  function drawBunnies(c) {
    for (const b of bunnies) {
      if (b.t < 0) continue;
      const h = Math.min(b.pts.length - 2, Math.floor(b.t / b.hop)), f = clamp((b.t - h * b.hop) / b.hop);
      const [x0, y0] = b.pts[h], [x1, y1] = b.pts[h + 1];
      const x = lerp(x0, x1, f), y = lerp(y0, y1, f) - Math.sin(Math.PI * f) * 28;
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(x, y, 0, x, y, 22); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,236,160,.8)'); g.addColorStop(1, 'rgba(255,200,90,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, 22, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,245,210,.25)'; c.beginPath(); c.ellipse(x, lerp(y0, y1, f) + 4, 12 * (1 - Math.sin(Math.PI * f) * .5), 4, 0, 0, TAU); c.fill();
      c.restore();
    }
  }
  function drawSunBeams(c) {
    for (const s of sunBeams) {
      if (s.t < 0) continue;
      const k = s.t / s.life, a = Math.min(1, s.t / .1) * (1 - Math.pow(k, 2.2)) * (.9 + .1 * Math.sin(s.t * 60));
      if (s.kind === 'sky') {
        c.save(); c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 6; i++) {
          const sp = (i - 2.5) * 34, g = c.createLinearGradient(s.x, -60, s.x, s.y);
          g.addColorStop(0, `rgba(255,230,170,${.1 * a})`); g.addColorStop(1, 'rgba(255,230,170,0)');
          c.fillStyle = g; c.beginPath(); c.moveTo(s.x - 4, -60); c.lineTo(s.x + 4, -60); c.lineTo(s.x + sp + 10, s.y); c.lineTo(s.x + sp - 10, s.y); c.closePath(); c.fill();
        }
        c.restore();
        beam(c, s.x, -60, s.x, s.y, s.w * (1 + .3 * (1 - k)), a, '255,215,130', s.t);
        lensFlare(c, s.x, s.y, a, s.w);
      } else shotBeam(c, s, Math.min(1, s.t / .06) * (.92 + .08 * Math.sin(s.t * 60)));
    }
  }
  /** Морозный узор: полупрозрачная корка, ветвистые кристаллы и ледяная кромка. */
  function paintFrost(g, R, seed) {
    g.save(); HB.skins.hexPath(g, 0, 0, R); g.clip();
    const fg = g.createLinearGradient(0, -R, 0, R); fg.addColorStop(0, 'rgba(235,250,255,.55)'); fg.addColorStop(1, 'rgba(170,220,245,.38)');
    g.fillStyle = fg; g.fillRect(-R, -R, 2 * R, 2 * R);
    const rn = HB.skins.srng(seed * 13 + 5);
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineCap = 'round';
    const branch = (x, y, a, l, d) => {
      if (d > 3 || l < R * .06) return;
      const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l;
      g.lineWidth = R * (.05 - d * .01); g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      branch(x2, y2, a + .55 + rn() * .2, l * .55, d + 1); branch(x2, y2, a - .55 - rn() * .2, l * .55, d + 1);
      branch(x2, y2, a + (rn() - .5) * .3, l * .7, d + 1);
    };
    for (let i = 0; i < 5; i++) { const a = rn() * TAU; branch(Math.cos(a) * R * .9, Math.sin(a) * R * .9, a + Math.PI + (rn() - .5) * .6, R * (.3 + rn() * .2), 0); }
    g.fillStyle = 'rgba(255,255,255,.9)';
    for (let i = 0; i < 10; i++) { g.beginPath(); g.arc((rn() - .5) * 1.6 * R, (rn() - .5) * 1.6 * R, R * (.015 + rn() * .025), 0, TAU); g.fill(); }
    g.restore();
    HB.skins.hexPath(g, 0, 0, R * .96); g.lineWidth = R * .08; g.strokeStyle = 'rgba(225,248,255,.85)'; g.stroke();
  }
  function drawFrost(c, x, y, R, p, ang, seed) {
    if (p <= 0) return;
    c.save(); c.translate(x, y);
    if (p < 1) { c.beginPath(); c.arc(Math.cos(ang) * R, Math.sin(ang) * R, p * R * 2.4, 0, TAU); c.clip(); }
    HB.skins.blit(c, HB.skins.sprite('frost' + (seed % 6), R, (g, R) => paintFrost(g, R, seed % 6)), R);
    c.restore();
  }
  /** Ледяной кристалл на соте: гранёный кубик, блики и холодное свечение. */
  function drawIce(c, x, y, R, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const p = .7 + .3 * Math.sin(t * 1.6);
    const g = c.createRadialGradient(x, y, 0, x, y, R * .9); g.addColorStop(0, `rgba(180,235,255,${.45 * p})`); g.addColorStop(1, 'rgba(150,220,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, R * .9, 0, TAU); c.fill();
    c.restore();
    const r = R * .5;
    HB.skins.hexPath(c, x, y, r, Math.PI / 6);
    const cg = c.createLinearGradient(x - r, y - r, x + r, y + r); cg.addColorStop(0, '#F2FCFF'); cg.addColorStop(.5, '#A9E3F8'); cg.addColorStop(1, '#6CC3EC');
    c.fillStyle = cg; c.fill();
    c.lineWidth = R * .05; c.strokeStyle = 'rgba(255,255,255,.9)'; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = R * .03;
    c.beginPath(); c.moveTo(x, y - r); c.lineTo(x, y + r); c.moveTo(x - r * .87, y - r * .5); c.lineTo(x + r * .87, y + r * .5); c.moveTo(x + r * .87, y - r * .5); c.lineTo(x - r * .87, y + r * .5); c.stroke();
    const gl = Math.max(0, Math.sin(t * 2.3) - .8) * 5;
    if (gl > 0) { c.fillStyle = `rgba(255,255,255,${Math.min(1, gl)})`; HB.skins.star4(c, x - r * .35, y - r * .4, R * .35 * gl); c.fill(); }
  }
  function iceLight(c, x, y, t) {
    const fl = .8 + .2 * Math.sin(t * 1.4 + x);
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y, 4, x, y, S * 2.8);
    g.addColorStop(0, `rgba(170,230,255,${.24 * fl})`); g.addColorStop(1, 'rgba(150,210,255,0)');
    c.fillStyle = g; c.fillRect(x - S * 2.8, y - S * 2.8, S * 5.6, S * 5.6);
    c.restore();
  }
  /** Костёр на соте: два бревна крест-накрест и три живых языка пламени. */
  function drawBonfire(c, x, y, R, t, flare = 1) {
    c.save(); c.translate(x, y + R * .3);
    [.45, -.45].forEach(rot => {
      c.save(); c.rotate(rot);
      c.fillStyle = '#6B3F1F'; c.beginPath(); c.ellipse(0, 0, R * .5, R * .12, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(-R * .45, -R * .1, R * .9, R * .04);
      c.fillStyle = '#C08A55'; c.beginPath(); c.ellipse(R * .47, 0, R * .07, R * .11, 0, 0, TAU); c.fill();
      c.restore();
    });
    c.save(); c.globalCompositeOperation = 'lighter';
    const eg = c.createRadialGradient(0, 0, 0, 0, 0, R * .5); eg.addColorStop(0, 'rgba(255,140,40,.8)'); eg.addColorStop(1, 'rgba(255,80,0,0)');
    c.fillStyle = eg; c.beginPath(); c.arc(0, 0, R * .5, 0, TAU); c.fill();
    c.restore(); c.restore();
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const sd = i * 2.1 + x * .013, n = .75 + .18 * Math.sin(t * 9 + sd) + .12 * Math.sin(t * 15.3 + sd * 2) + .08 * Math.sin(t * 27 + sd);
      flameTongue(c, x + (i - 1) * R * .2, y + R * .32, R * (i === 1 ? 1.4 : .95) * n * flare, R * (i === 1 ? .3 : .2), Math.sin(t * 4 + sd) * R * .1);
    }
    c.restore();
  }
  /** Тёплый живой свет костра на соседних сотах: мерцает на нескольких частотах сразу. */
  function fireLight(c, x, y, t, k = 1) {
    const fl = .72 + .14 * Math.sin(t * 9.3 + x) + .09 * Math.sin(t * 23.7 + y) + .05 * Math.sin(t * 41);
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y, 4, x, y, S * 3.4);
    g.addColorStop(0, `rgba(255,170,80,${.46 * fl * k})`); g.addColorStop(.45, `rgba(255,120,40,${.2 * fl * k})`); g.addColorStop(1, 'rgba(255,90,20,0)');
    c.fillStyle = g; c.fillRect(x - S * 3.4, y - S * 3.4, S * 6.8, S * 6.8);
    c.restore();
  }
  function drawBoard(c) {
    const sk = skin();
    sunsOn = cells.filter(q => q.ci >= 0 && q.sun);
    for (const cl of cells) HB.skins.empty(c, cl.x, cl.y, S * .93, sk);
    for (const s of splats) {
      const a = .32 * (1 - s.t / s.life) * clamp(s.t * 8);
      if (a <= 0) continue;
      c.globalAlpha = a; c.fillStyle = s.color;
      for (const [dx, dy, r] of s.blobs) { c.beginPath(); c.arc(s.x + dx, s.y + dy + s.t * 6, r * (1 + s.t * .15), 0, TAU); c.fill(); }
    }
    c.globalAlpha = 1;
    if (ghost && drag) {
      const pc = pieceAt(drag.i), pulse = .5 + .5 * Math.sin(time * 10);
      pc.shape.forEach(([dq, dr]) => {
        const cl = map.get(key(ghost.aq + dq, ghost.ar + dr));
        hexPath(c, cl.x, cl.y, S * .93);
        c.globalAlpha = .42; c.fillStyle = colorOf(pc.ci); c.fill();
        c.globalAlpha = .35 + .35 * pulse; c.lineWidth = 2; c.strokeStyle = '#FFFFFF'; c.stroke();
        c.globalAlpha = 1;
      });
    }
    for (const cl of cells) {
      if (cl.ci < 0) continue;
      const grey = cl.gt >= 0 && endT > cl.gt;
      const rk = rippleK(cl);
      const sc = (cl.pt < 1 ? 1 + .24 * Math.exp(-7 * cl.pt) * Math.cos(18 * cl.pt) : 1) * rk;
      const flash = cl.gt >= 0 ? clamp(1 - Math.abs(endT - cl.gt) * 8) * .5 : 0;
      const hz = sunsOn.length ? haze(cl) : [0, 0];
      tile(c, cl.x + hz[0], cl.y + hz[1], S * .93 * sc, colorOf(cl.ci), { flash, grey, v: cl.v, age: time - cl.born, board: true, rip: rk - 1, seed: cl.idx * 7 + cl.v });
      if (cl.bomb) drawBomb(c, cl.x, cl.y, S * sc, time + cl.q);
      if (cl.frozen) drawFrost(c, cl.x, cl.y, S * .93 * sc, clamp((time - cl.frzT) / .8), cl.frzAng, cl.idx);
      if (cl.ice) drawIce(c, cl.x, cl.y, S * sc, time + cl.q);
      if (cl.daisy) drawDaisy(c, cl.x, cl.y, S * sc, time + cl.q, cl.dPet, cl.dT, true);
    }
    cells.forEach(cl => { if (cl.daisy && cl.dPet < 5) drawTorn(c, cl, time); });
    drawAscend(c);
    cells.forEach(cl => { if (cl.ci >= 0 && cl.ice) iceLight(c, cl.x, cl.y, time); });
    const lit = cells.filter(cl => cl.ci >= 0 && cl.fire);
    lit.forEach(cl => fireLight(c, cl.x, cl.y, time));
    lit.forEach(cl => { const age = time - cl.born; drawBonfire(c, cl.x, cl.y, S, time + cl.q, 1 + (age < 1 ? 1.4 * Math.exp(-4 * age) : 0)); });
    sunsOn.forEach(s => sunLight(c, s));
    sunsOn.forEach(s => drawSun(c, s.x, s.y, S, time + s.q, s.sunStage, time - s.sunGrowT));
    HB.skins.drawOver(c, { cx: 180, cy: CY, R: S * .93 });
    if (boltPreview && drag) {
      const fl = .5 + .5 * Math.sin(time * 30) * Math.sin(time * 11);
      boltPreview.forEach(cl => {
        hexPath(c, cl.x, cl.y, S * .93);
        c.globalAlpha = .25 + .25 * fl; c.fillStyle = BOLTC; c.fill();
        c.globalAlpha = .6; c.lineWidth = 2; c.strokeStyle = '#FFFFFF'; c.stroke();
        c.globalAlpha = 1;
      });
    }
    if (preview && drag) {
      const pc = pieceAt(drag.i), s = .5 + .5 * Math.sin(time * 12);
      preview.forEach(cl => {
        hexPath(c, cl.x, cl.y, S * .93);
        c.globalAlpha = .28 + .22 * s; c.fillStyle = colorOf(pc.ci); c.fill();
        c.globalAlpha = .18 + .14 * s; c.fillStyle = '#FFFFFF'; c.fill();
        c.globalAlpha = 1;
      });
    }
    const hideBurstTile = !!(HB.fx.bursts[HB.profile.burst] || {}).hideTile;
    for (const cl of cells) {
      const fx = cl.fx; if (!fx) continue;
      const lt = fx.t - fx.delay, col = colorOf(fx.ci);
      const o = { v: fx.v, age: fx.age + fx.t, board: true, seed: cl.idx * 7 + fx.v };
      if (lt < 0) {
        o.flash = .25 + .25 * Math.sin(fx.t * 30);
        tile(c, cl.x, cl.y, S * .93, col, o);
        if (fx.bomb) drawBomb(c, cl.x, cl.y, S, time * 3);
        if (fx.fire) { fireLight(c, cl.x, cl.y, time, 1.5); drawBonfire(c, cl.x, cl.y, S, time * 1.6, 1.6); }
        if (fx.frozen) drawFrost(c, cl.x, cl.y, S * .93, 1, fx.frzAng, cl.idx);
        else if (fx.frost != null && fx.t >= fx.frost) { const fp = clamp((fx.t - fx.frost) / .45); drawFrost(c, cl.x, cl.y, S * .93, fp, Math.atan2(-1, 0), cl.idx); if (fp >= 1) { c.save(); c.globalCompositeOperation = 'lighter'; hexPath(c, cl.x, cl.y, S * .93); c.fillStyle = `rgba(200,240,255,${.18 + .14 * Math.sin(time * 14 + cl.idx)})`; c.fill(); c.restore(); } }
        if (fx.ice) { iceLight(c, cl.x, cl.y, time); drawIce(c, cl.x, cl.y, S, time * 2); }
        if (fx.sun) drawSun(c, cl.x, cl.y, S, time, fx.sunStage, .15);
        if (fx.sunburn) {
          const hk = clamp(1 - (-lt) / .7);
          c.save(); c.globalCompositeOperation = 'lighter'; hexPath(c, cl.x, cl.y, S * .93);
          c.fillStyle = fx.prism != null ? `rgba(${['255,94,126', '255,184,77', '255,228,92', '94,224,138', '77,195,255', '154,123,255'][fx.prism % 6]},${.7 * hk})` : `rgba(255,236,190,${.85 * hk})`;
          c.fill(); c.restore();
        }
        if (fx.charged) {
          c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
          c.beginPath(); for (let i = 0; i < 3; i++) jag(c, cl.x, cl.y, cl.x + rnd(-20, 20), cl.y + rnd(-20, 20), 3, 4);
          c.strokeStyle = 'rgba(160,215,255,.9)'; c.lineWidth = 1.6; c.stroke();
          c.restore();
        }
        continue;
      }
      if (hideBurstTile) continue;
      const p = lt / .34;
      const sc = p < .22 ? 1 + .3 * eo(p / .22) : 1.3 * (1 - eio((p - .22) / .78));
      o.rot = p * 1.4; o.flash = (1 - p) * .9;
      tile(c, cl.x, cl.y, S * .93 * sc, col, o);
    }
    drawStrikes(c);
    drawHurricanes(c);
    drawSunBeams(c);
    drawSnowflakes(c);
    drawBunnies(c);
    for (const r of rings) {
      if (r.t < 0) continue;
      const life = r.big ? .7 : .55, p = r.t / life, maxR = r.huge ? 320 : r.big ? 230 : 150;
      c.globalAlpha = 1 - p; c.lineWidth = (r.big ? 12 : 7) * (1 - p) + 1; c.strokeStyle = r.color;
      hexPath(c, r.x, r.y, 18 + eo(p) * maxR, p * .6); c.stroke();
      c.globalAlpha = (1 - p) * .6; c.strokeStyle = '#FFFFFF'; c.lineWidth = 2;
      hexPath(c, r.x, r.y, 10 + eo(p) * maxR * .72, -p * .4); c.stroke();
      c.globalAlpha = 1;
    }
  }
  function drawPiece(c, p, x, y, sc, alpha, rot) {
    const cs = Math.cos(rot), sn = Math.sin(rot), col = colorOf(p.ci);
    p.offs.forEach(([ox, oy], k) => {
      const px = x + (ox * cs - oy * sn) * sc, py = y + (ox * sn + oy * cs) * sc;
      tile(c, px, py, S * .93 * sc, col, { alpha, rot, v: p.vs[k], seed: p.seed + k * 7 });
      if (k === p.bomb) { c.globalAlpha = alpha; drawBomb(c, px, py, S * sc, time); c.globalAlpha = 1; }
      if (k === p.bolt) { c.globalAlpha = alpha; drawBolt(c, px, py, S * sc, time + k); c.globalAlpha = 1; }
      if (k === p.fire) { c.globalAlpha = alpha; drawBonfire(c, px, py, S * sc, time + k, .85); c.globalAlpha = 1; }
      if (k === p.ice) { c.globalAlpha = alpha; drawIce(c, px, py, S * sc, time + k); c.globalAlpha = 1; }
      if (k === p.sun) { c.globalAlpha = alpha; drawSun(c, px, py, S * sc, time + k, 0); c.globalAlpha = 1; }
      if (k === p.daisy) { c.globalAlpha = alpha; drawDaisy(c, px, py, S * sc, time + k); c.globalAlpha = 1; }
    });
  }
  function drawTray(c) {
    if (holdOn()) {
      rr(c, 12, TY - 64, 70, 128, 22); c.fillStyle = 'rgba(76,201,240,.08)'; c.fill();
      c.setLineDash([5, 5]); c.lineWidth = 1.5; c.strokeStyle = hold ? 'rgba(76,201,240,.35)' : 'rgba(76,201,240,.55)'; c.stroke(); c.setLineDash([]);
      text(c, 'ЗАПАС', HX, TY - 50, `800 10px ${FB}`, 'rgba(190,240,255,.7)');
      if (!hold && drag && drag.i < 3 && (nearHold(drag.px, drag.py - drag.lift) || nearHold(drag.px, drag.py))) {
        rr(c, 12, TY - 64, 70, 128, 22); c.fillStyle = `rgba(76,201,240,${.18 + .1 * Math.sin(time * 12)})`; c.fill();
      }
      rr(c, 90, TY - 64, W - 106, 128, 24); c.fillStyle = 'rgba(255,255,255,.045)'; c.fill();
    } else {
      rr(c, 16, TY - 64, W - 32, 128, 24); c.fillStyle = 'rgba(255,255,255,.045)'; c.fill();
    }
    [0, 1, 2, 3].forEach(i => {
      const pc = pieceAt(i);
      if (!pc || pc.delay > 0 || (drag && drag.i === i) || (i === 3 && !holdOn())) return;
      drawPiece(c, pc, pc.x, pc.y, Math.max(0, pc.sc), pc.fa, pc.rot);
    });
  }
  const star4 = (c, x, y, r) => HB.skins.star4(c, x, y, r);
  function drawParts(c) {
    HB.fx.draw(c, parts, time);
    for (const f of floats) {
      const p = f.t / f.life;
      c.save();
      c.globalAlpha = p < .08 ? p / .08 : 1 - clamp((p - .6) / .4);
      const s = p < .25 ? eob(p / .25) : 1;
      c.translate(f.x, f.y - eo(p) * 44); c.scale(s, s);
      c.font = `800 ${f.size}px ${FD}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 7; c.lineJoin = 'round'; c.strokeStyle = '#141230'; c.strokeText(f.str, 0, 0);
      c.fillStyle = f.color; c.fillText(f.str, 0, 0);
      c.restore();
    }
  }
  function drawDragged(c) {
    if (!drag) return;
    const pc = pieceAt(drag.i); if (!pc) return;
    const tr = HB.fx.trails[HB.profile.trail];
    if (tr && tr.draw && drag.hist) tr.draw(c, drag.hist, time, colorOf(pc.ci));
    const sc = Math.max(0, pc.sc), cs = Math.cos(pc.rot), sn = Math.sin(pc.rot);
    c.fillStyle = 'rgba(0,0,0,.28)';
    for (const [ox, oy] of pc.offs) { hexPath(c, pc.x + (ox * cs - oy * sn) * sc + 5, pc.y + (ox * sn + oy * cs) * sc + 12, S * sc * .93, pc.rot); c.fill(); }
    drawPiece(c, pc, pc.x, pc.y, sc, 1, pc.rot);
  }
  function drawHud(c) {
    if (mode === 'idle' && !inputOn) return;
    const [px, py] = BTN.pause();
    c.beginPath(); c.arc(px, py, 19, 0, TAU); c.fillStyle = 'rgba(255,255,255,.09)'; c.fill();
    c.fillStyle = '#E4E0FF'; rr(c, px - 7, py - 8, 5, 16, 2); c.fill(); rr(c, px + 2, py - 8, 5, 16, 2); c.fill();
    if (false) {
      const [ux, uy] = BTN.undo(), pulse = 1 + .06 * Math.sin(time * 5);
      c.save(); c.translate(ux, uy); c.scale(pulse, pulse);
      c.beginPath(); c.arc(0, 0, 19, 0, TAU); c.fillStyle = 'rgba(76,201,240,.22)'; c.fill();
      c.lineWidth = 2.4; c.strokeStyle = '#BFF1FF'; c.lineCap = 'round';
      const a0 = Math.PI * 1.15, a1 = a0 + 4.6;
      c.beginPath(); c.arc(0, 0, 8, a0, a1); c.stroke();
      const ex = Math.cos(a0) * 8, ey = Math.sin(a0) * 8, tx = Math.sin(a0), ty = -Math.cos(a0), nx = Math.cos(a0), ny = Math.sin(a0);
      c.fillStyle = '#BFF1FF'; c.beginPath();
      c.moveTo(ex + tx * 5, ey + ty * 5); c.lineTo(ex + nx * 4.5 - tx * 1.5, ey + ny * 4.5 - ty * 1.5); c.lineTo(ex - nx * 4.5 - tx * 1.5, ey - ny * 4.5 - ty * 1.5);
      c.closePath(); c.fill(); c.lineCap = 'butt';
      c.restore();
    }
    const fire = combo >= 2 && mode === 'play';
    if (hudFx.length) {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const f of hudFx) {
        const k = f.t / f.life;
        c.fillStyle = `rgba(255,${Math.round(220 - 170 * k)},${Math.round(80 - 70 * k)},${(1 - k) * .75})`;
        c.beginPath(); c.arc(f.x, f.y, f.r * (1 - k * .5), 0, TAU); c.fill();
      }
      c.restore();
    }
    text(c, fire ? 'СЧЁТ ГОРИТ' : 'СЧЁТ', 180, 26 + TOP, `800 11px ${FB}`, fire ? '#FFB347' : '#9B95C9');
    c.save();
    const fl = fire ? 1 + .03 * Math.sin(time * 23) * Math.sin(time * 7) : 1;
    c.translate(180, 58 + TOP); const s = (1 + .28 * eo(bump)) * fl; c.scale(s, s);
    const ss = HB.profile.scoreStyle;
    if (ss && ss !== 'classic' && HB.scoreStyles && HB.scoreStyles.has(ss)) {
      if (fire) {
        // Комбо поверх стиля: живое оранжевое зарево за цифрами.
        c.save(); c.globalCompositeOperation = 'lighter';
        const gl = c.createRadialGradient(0, 0, 4, 0, 0, 70); gl.addColorStop(0, `rgba(255,120,20,${.45 + .15 * Math.sin(time * 17)})`); gl.addColorStop(1, 'rgba(255,60,0,0)');
        c.fillStyle = gl; c.beginPath(); c.ellipse(0, 0, 80, 34, 0, 0, TAU); c.fill(); c.restore();
      }
      HB.scoreStyles.draw(c, U.fmt(shown), 0, 0, 38, time, ss);
    } else if (fire) {
      const g = c.createLinearGradient(0, -20, 0, 18);
      g.addColorStop(0, '#FFF6B0'); g.addColorStop(.45, '#FFB21E'); g.addColorStop(1, '#FF3D1A');
      c.shadowColor = '#FF5A00'; c.shadowBlur = 12 + 6 * Math.sin(time * 17);
      text(c, U.fmt(shown), 0, 0, `800 38px ${FD}`, g);
      c.shadowBlur = 0;
    } else text(c, U.fmt(shown), 0, 0, `800 38px ${FD}`, bump > .35 ? AMBER : '#F4F1FF');
    c.restore();
    if (fire) {
      const label = 'КОМБО ×' + combo;
      c.font = `900 12px ${FB}`;
      const w = c.measureText(label).width + 22, pulse = 1 + .05 * Math.sin(time * 8);
      c.save(); c.translate(180, 90 + TOP); c.scale(pulse, pulse);
      rr(c, -w / 2, -10, w, 20, 10); c.fillStyle = 'rgba(255,80,20,.22)'; c.fill();
      c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,150,60,.8)'; c.stroke();
      text(c, label, 0, 1, `900 12px ${FB}`, '#FFD07A');
      c.restore();
    }
    if (bloomT > 0 && !fire) {
      // Плашка цветения: время тает по кольцу вокруг ромашки.
      const label = '×3 ЦВЕТЕНИЕ ' + Math.ceil(bloomT);
      c.font = `900 12px ${FB}`;
      const w = c.measureText(label).width + 40, pulse = 1 + .04 * Math.sin(time * 4);
      c.save(); c.translate(180, 90 + TOP); c.scale(pulse, pulse);
      rr(c, -w / 2, -11, w, 22, 11); c.fillStyle = 'rgba(255,120,190,.2)'; c.fill();
      c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,180,220,.85)'; c.stroke();
      drawDaisy(c, -w / 2 + 13, 0, 8, time);
      c.strokeStyle = '#FFE9A0'; c.lineWidth = 1.6; c.beginPath(); c.arc(-w / 2 + 13, 0, 9.5, -Math.PI / 2, -Math.PI / 2 + TAU * bloomT / BLOOM_T); c.stroke();
      text(c, label, 8, 1, `900 12px ${FB}`, '#FFE0F0');
      c.restore();
    }
    text(c, 'ЛУЧШИЙ', 340, 30 + TOP, `800 10px ${FB}`, '#6F69A0', 'right');
    text(c, U.fmt(best), 340, 51 + TOP, `800 19px ${FD}`, '#A39DD0', 'right');
    if (HB.settings.bomb && HB.settings.bombSource !== 'random') {
      const need = HB.settings.bombSource === 'combo' ? 3 : 6;
      const have = HB.settings.bombSource === 'combo' ? combo % 3 : charge;
      const bx = 340 - need * 9 - 12, by = 76 + TOP;
      const sp = specials();
      sp.forEach((k2, i) => {
        const ix = bx - (sp.length - 1 - i) * 12;
        if (k2 === 'bolt') drawBolt(c, ix, by, 11, time);
        else if (k2 === 'fire') drawBonfire(c, ix, by - 3, 10, time, .8);
        else if (k2 === 'ice') drawIce(c, ix, by, 12, time);
        else if (k2 === 'sun') drawSun(c, ix, by, 11, time, 0);
        else if (k2 === 'daisy') drawDaisy(c, ix, by, 11, time);
        else drawBomb(c, ix, by, 11, time);
      });
      for (let i = 0; i < need; i++) {
        c.beginPath(); c.arc(bx + 16 + i * 9, by + 1, 3.2, 0, TAU);
        c.fillStyle = i < have ? CORAL : 'rgba(255,255,255,.15)'; c.fill();
      }
      if (pending.length) text(c, '×' + pending.length, bx - 16 - (specials().length - 1) * 12, by + 1, `800 12px ${FB}`, pending[0] === 'bolt' ? BOLTC : pending[0] === 'fire' ? FIREC : pending[0] === 'ice' ? ICEC : pending[0] === 'sun' ? SUNC : CORAL, 'right');
    }
  }
  function drawBanner(c) {
    const b = banners[0]; if (!b) return;
    const p = b.t;
    const a = p < .12 ? p / .12 : 1 - clamp((p - (b.life - .35)) / .35);
    const s = p < .3 ? lerp(1.5, 1, eob(p / .3)) : 1;
    c.save();
    c.globalAlpha = clamp(a);
    c.font = `800 26px ${FD}`;
    const w = c.measureText(b.str).width, fit = Math.min(1, (W - 40) / w);
    c.translate(180, 124 + TOP); c.scale(s * fit, s * fit);
    c.rotate(Math.sin(p * 20) * .03 * clamp(1 - p * 2));
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = b.color; c.shadowBlur = 18;
    c.lineWidth = 8; c.lineJoin = 'round'; c.strokeStyle = '#141230'; c.strokeText(b.str, 0, 0);
    c.shadowBlur = 0;
    c.fillStyle = b.color; c.fillText(b.str, 0, 0);
    c.restore();
  }
  function draw() {
    const c = ctx, k = scale * dpr;
    c.setTransform(k, 0, 0, k, 0, 0);
    c.globalAlpha = 1;
    drawBg(c);
    c.save();
    if (shake > 0 && HB.settings.shake) c.translate(rnd(-1, 1) * shake, rnd(-1, 1) * shake);
    if (punch > .001) { c.translate(180, CY); c.scale(1 + punch, 1 + punch); c.translate(-180, -CY); }
    drawBoard(c);
    drawTray(c);
    drawParts(c);
    drawDragged(c);
    c.restore();
    if (!demo) drawHud(c);
    drawBanner(c);
    drawDemo(c);
    if (whiteFlash > 0) { c.fillStyle = `rgba(${flashTint},${Math.min(1, whiteFlash) * .5})`; c.fillRect(0, 0, W, H); }
  }

  /* ---------- запуск ---------- */
  function layout() {
    TY = H - 92 - BOT;
    CY = Math.round((172 + TOP + TY - 80) / 2);
    for (const cl of cells) { cl.x = 180 + S * R3 * (cl.q + cl.r / 2); cl.y = CY + S * 1.5 * cl.r; }
    HB.skins.layout = { top: boardTop(), bottom: TY + 60 };
  }
  function resize() {
    const vw = window.innerWidth || 360, vh = window.innerHeight || 640;
    H = Math.round(clamp(W * vh / vw, 640, 900));
    scale = Math.min(vw / W, vh / H);
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    cv.style.width = Math.round(W * scale) + 'px';
    cv.style.height = Math.round(H * scale) + 'px';
    cv.width = Math.round(W * scale * dpr);
    cv.height = Math.round(H * scale * dpr);
    HB.skins.pxScale = scale * dpr;
    TOP = insetTop / scale; BOT = insetBottom / scale;
    layout();
    [0, 1, 2, 3].forEach(i => { const pc = pieceAt(i); if (pc) { pc.x = sx(i); pc.y = TY; } });
  }
  function pt(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H, touch: e.pointerType !== 'mouse' };
  }
  cv.addEventListener('pointerdown', e => { e.preventDefault(); if (demo) return; try { cv.setPointerCapture(e.pointerId); } catch (err) {} down(pt(e)); });
  cv.addEventListener('pointermove', e => { if (drag) move(pt(e)); });
  cv.addEventListener('pointerup', () => up());
  cv.addEventListener('pointercancel', () => up());
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { up(); save(); } });

  window.hbInsets = (top, bottom) => {
    insetTop = top || 0; insetBottom = bottom || 0;
    document.documentElement.style.setProperty('--inset-top', insetTop + 'px');
    document.documentElement.style.setProperty('--inset-bottom', insetBottom + 'px');
    resize();
  };
  try { if (window.HexAndroid) window.hbInsets(window.HexAndroid.insetTop(), window.HexAndroid.insetBottom()); } catch (e) {}
  if (document.fonts && document.fonts.load) { document.fonts.load(`800 20px ${FD}`); document.fonts.load(`800 12px ${FB}`); }

  resize();
  const hasSave = load();
  let last = performance.now();
  // Следующий кадр заказывается первым: даже если в этом кадре что-то сломается,
  // игра продолжит рисоваться, а не застынет с пустым полем.
  const errLog = e => { try { const l = HB.store.get('hb.errors', []); l.push({ t: Date.now(), v: HB.appVersion ? HB.appVersion() : '', m: String(e && e.message || e), s: String(e && e.stack || '').slice(0, 600) }); HB.store.set('hb.errors', l.slice(-8)); } catch (x) {} };
  let errCount = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    if (freeze > 0) { freeze -= dt; dt *= .08; }
    else if (slowmo > 0) { slowmo -= dt; dt *= .38; }
    try { update(dt); } catch (e) { if (errCount++ < 20) errLog(e); }
    try { draw(); } catch (e) {
      if (errCount++ < 20) errLog(e);
      // Сбрасываем незакрытые save()/clip после ошибки посреди кадра.
      try { if (ctx.reset) ctx.reset(); else { ctx.restore(); ctx.restore(); ctx.restore(); } } catch (x) {}
    }
  }
  requestAnimationFrame(frame);

  HB.game = {
    hasSave: () => hasSave && mode === 'idle' && tray.some(Boolean),
    resume() { mode = 'play'; },
    newGame,
    undo, canUndo, buyChance,
    setInput(on) { inputOn = on; if (!on) up(); },
    mode: () => mode,
    confetti,
    save,
    refreshSkin() { HB.store.set('hb.profile', HB.profile); },
    refreshSettings() {
      updateFits();
      if (mode === 'play' && stuck()) startEnding();
    },
    /** Для автотеста: один кадр вручную (headless-браузер почти не крутит requestAnimationFrame). */
    _step(dt) { update(dt); draw(); },
    /** Для автотеста: ставит первую подходящую фигуру (или кладёт в запас, если иначе никак). */
    _auto() {
      if (mode !== 'play') return false;
      for (const i of [0, 1, 2, 3]) {
        const pc = pieceAt(i);
        if (!pc || !pc.fits || pc.delay > 0 || (i === 3 && !holdOn())) continue;
        for (const cl of cells) {
          const aq = cl.q - pc.shape[0][0], ar = cl.r - pc.shape[0][1];
          if (!fits(pc, aq, ar)) continue;
          drag = { i, px: cl.x, py: cl.y, lift: 0, dx: 0, vs: 0 }; ghost = { aq, ar };
          place();
          drag = ghost = preview = null;
          return true;
        }
      }
      const i = tray.findIndex(Boolean);
      if (holdOn() && i >= 0) { stash(i); return true; }
      return false;
    },
    _stash(i) { if (tray[i]) stash(i); },
    /** Для автотеста: ряд r=0 без центра, бомба рядом, в лотке одиночная молния. */
    _scenario() {
      newGame();
      cells.forEach(c => { if (c.r === 0 && c.q !== 0) c.ci = 1; });
      const b = map.get(key(1, -1)); b.ci = 2; b.bomb = true;
      if (HB.settings._fireTest) { const f = map.get(key(2, 0)); f.fire = true; }
      if (HB.settings._iceTest) { const f = map.get(key(-2, 0)); f.ice = true; }
      if (HB.settings._sunTest) { const f = map.get(key(-3, 0)); f.sun = true; f.sunStage = HB.settings._sunTest; }
      map.get(key(0, 1)).ci = 4; map.get(key(-1, 1)).ci = 5;
      tray[0] = HB.settings._icePiece ? makePiece(0, 0, [[0, 0]], 3, -1, null, -1, -1, 0) : makePiece(0, 0, [[0, 0]], 3, -1, null, 0); tray[0].delay = 0;
      updateFits();
    },
    _placeAt(i, q, r) {
      const pc = pieceAt(i);
      drag = { i, px: 0, py: 0, lift: 0, dx: 0, vs: 0 }; ghost = { aq: q - pc.shape[0][0], ar: r - pc.shape[0][1] };
      place();
      drag = ghost = preview = boltPreview = null;
    },
    _score: () => score,
    _tears: () => tears, _tray: () => tray,
    COMBOS, startDemo, endDemo, demoCtl, demoProgress, _probe: probeCombo
  };
  window.hbSave = save;
})();
