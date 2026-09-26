/* Игровое поле Hex Blast: логика, анимации и отрисовка на canvas. Меню и окна — в ui.js. */
(() => {
  'use strict';
  const HB = window.HB, U = HB.util;
  const { TAU, clamp, lerp, eo, eio, eob, rand, rnd } = U;
  const W = 360, R3 = Math.sqrt(3), S = 21, TS = .56, HX = 46;
  const GREY = '#4A4680';
  const FD = '"HB Display", "Baloo 2", "Trebuchet MS", sans-serif';
  const FB = '"HB Body", "Nunito Sans", "Segoe UI", sans-serif';
  const AMBER = '#FFC857', CORAL = '#FF6B6B', MINT = '#4ADE9C', SKY = '#4CC9F0', PINK = '#FF8FD1', BOLTC = '#9FD8FF';
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
  const DIRC = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];   // по кругу, для поворотов огня
  const FIREC = '#FF9A3C';
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
    const cl = { idx: cells.length, q, r, x: 0, y: 0, ci: -1, v: 0, born: 0, bomb: false, fire: false, pt: 9, fx: null, gt: -1 };
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
  let pending = [], charge = 0, undoCharges = 0, snap = null, lastAward = 0, holdHint = false;
  let mode = 'idle', inputOn = false, endT = 0, time = 0;
  let freeze = 0, punch = 0, shake = 0, bgFlash = 0, bgFlashColor = '#A78BFA', whiteFlash = 0, idleT = 0, trailT = 0;
  let parts = [], rings = [], floats = [], banners = [], splats = [], booms = [], strikes = [], hudFx = [], flames = [], crackT = 1, ripple = null, hudAcc = 0, flashTint = '255,245,230';
  const bgHex = Array.from({ length: 12 }, () => ({ x: rnd(0, W), y: rnd(0, 900), r: rnd(18, 60), s: rnd(4, 12), a: rnd(0, TAU), va: rnd(-.15, .15) }));
  const stars = Array.from({ length: 70 }, () => ({ x: rnd(0, W), y: rnd(0, 900), s: rnd(.8, 2), p: rnd(0, TAU) }));

  const pieceAt = i => i === 3 ? hold : tray[i];
  function makePiece(i, delay, shape, ci, bomb = -1, vs = null, bolt = -1, fire = -1) {
    const offs = shape.map(([dq, dr]) => [S * R3 * (dq + dr / 2), S * 1.5 * dr]);
    const mx = offs.reduce((a, o) => a + o[0], 0) / offs.length, my = offs.reduce((a, o) => a + o[1], 0) / offs.length;
    const xs = offs.map(o => o[0]), ys = offs.map(o => o[1]);
    return {
      shape, ci, bomb, bolt, fire, vs: vs || shape.map(() => rand(10)), seed: rand(997),
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
  function nextSpecial() { const sp = specials(); return sp[rand(sp.length)]; }
  function earnSpecial() {
    const t = nextSpecial();
    pending.push(t);
    showBanner(t === 'bolt' ? 'МОЛНИЯ ЗАРЯЖЕНА' : t === 'fire' ? 'КОСТЁР ГОТОВ' : 'БОМБА ЗАРЯЖЕНА', t === 'bolt' ? BOLTC : t === 'fire' ? FIREC : CORAL);
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
        const free = ps.filter(p => p.bomb < 0 && p.bolt < 0 && p.fire < 0);
        if (!free.length) break;
        give(free[rand(free.length)], pending.shift());
      }
      if (ps.some(p => p.bomb >= 0)) setTimeout(() => HB.sfx.fuse(), 260);
    }
    tray = ps;
  }

  /* ---------- сохранение ---------- */
  const serPiece = p => p ? { shape: p.shape, ci: p.ci, bomb: p.bomb, bolt: p.bolt, fire: p.fire, vs: p.vs } : null;
  function snapshot() {
    return {
      cells: cells.map(c => [c.ci, c.bomb ? 1 : 0, c.v, c.fire ? 1 : 0]), tray: tray.map(serPiece), hold: serPiece(hold),
      score, combo, miss, stat: Object.assign({}, stat), pending: pending.slice(), charge, recordShown
    };
  }
  function restore(s) {
    cells.forEach((c, i) => { c.ci = s.cells[i][0]; c.bomb = !!s.cells[i][1]; c.fire = !!s.cells[i][3]; c.v = s.cells[i][2] || (i * 7) % 10; c.born = time; c.pt = 9; c.fx = null; c.gt = -1; });
    tray = s.tray.map((p, i) => p ? makePiece(i, i * .06, p.shape, p.ci, p.bomb, p.vs, p.bolt == null ? -1 : p.bolt, p.fire == null ? -1 : p.fire) : null);
    hold = s.hold ? makePiece(3, .1, s.hold.shape, s.hold.ci, s.hold.bomb, s.hold.vs, s.hold.bolt == null ? -1 : s.hold.bolt, s.hold.fire == null ? -1 : s.hold.fire) : null;
    score = s.score; combo = s.combo; miss = s.miss; stat = Object.assign({ lines: 0, maxCombo: 0, clears: 0 }, s.stat);
    pending = Array.isArray(s.pending) ? s.pending.slice() : Array(s.pendingBomb || 0).fill('bomb'); charge = s.charge || 0; recordShown = !!s.recordShown;
    drag = ghost = preview = null;
    updateFits();
  }
  function save() {
    if (mode !== 'play') { if (mode !== 'idle') HB.store.del('hb.save2'); return; }
    HB.store.set('hb.save2', { v: 2, s: snapshot(), undoCharges, snap, bestAtStart });
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
    shown = score; undoCharges = d.undoCharges || 0; snap = d.snap || null; bestAtStart = d.bestAtStart || 0;
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
  function showBanner(str, color) { banners.push({ str, color, t: 0, life: 1.5 }); HB.sfx.whoosh(); }
  const comboColor = c => c >= 6 ? PINK : c >= 4 ? CORAL : c >= 3 ? AMBER : MINT;

  /* ---------- ввод ---------- */
  const BTN = { pause: () => [30, 46 + TOP], undo: () => [76, 46 + TOP] };
  const hitBtn = (p, [x, y]) => Math.hypot(p.x - x, p.y - y) < 23;
  const canUndo = () => HB.settings.undo && undoCharges > 0 && !!snap;
  function down(p) {
    if (!inputOn) return;
    HB.sfx.unlock();
    if (hitBtn(p, BTN.pause())) { HB.sfx.click(); HB.haptic('tick'); HB.ui.pause(); return; }
    if (canUndo() && hitBtn(p, BTN.undo()) && mode === 'play') { undo(); return; }
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
      cl.ci = pc.ci; cl.bomb = k === pc.bomb; cl.fire = k === pc.fire; cl.v = pc.vs[k] | 0; cl.born = time; cl.pt = 0; placed.push(cl);
    });
    if (drag.i === 3) hold = null; else tray[drag.i] = null;
    score += pc.shape.length;
    const ox = placed.reduce((a, c) => a + c.x, 0) / placed.length, oy = placed.reduce((a, c) => a + c.y, 0) / placed.length;
    placed.forEach(cl => dust(cl.x, cl.y));
    ripple = { x: ox, y: oy, t: 0 };
    shake = Math.max(shake, 3);
    HB.sfx.place(placed.length, (ox - 180) / 180); HB.haptic('place');
    if (pc.fire >= 0) { setTimeout(() => { HB.sfx.ignite(); HB.haptic('ignite'); }, 60); const fc = placed[pc.fire]; for (let i = 0; i < 12; i++) parts.push({ k: 'ember', soft: true, x: fc.x, y: fc.y, vx: rnd(-50, 50), vy: rnd(-150, -60), g: -20, t: 0, life: rnd(.6, 1.1), color: '#FFB347', r: rnd(1.2, 2.2) }); }

    const full = lines.filter(l => l.every(cl => cl.ci >= 0));
    const boltCell = pc.bolt >= 0 ? placed[pc.bolt] : null;
    const strike = boltCell ? strikeLineFor(boltCell, null) : null;
    if (full.length || strike) {
      combo++; miss = 0;
      stat.lines += full.length; stat.maxCombo = Math.max(stat.maxCombo, combo);
      const u = new Set(), delay = new Map();
      full.forEach(l => l.forEach(cl => { u.add(cl); delay.set(cl, Math.hypot(cl.x - ox, cl.y - oy) / 520); }));
      const lineCells = u.size;
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
      const queue = [...u].filter(c => c.bomb || c.fire), done = new Set(), burnt = new Set(), blasted = new Set();
      let fires = 0, napalm = false, storm = false, fireBlast = false;
      const addCell = (c, d) => {
        if (!u.has(c)) { if (c.ci < 0) return; u.add(c); delay.set(c, d); }
        else delay.set(c, Math.min(delay.get(c), d));
        if ((c.bomb || c.fire) && !done.has(c)) queue.push(c);
      };
      while (queue.length) {
        const b = queue.shift();
        if (done.has(b)) continue;
        done.add(b);
        const at = delay.get(b), mult = Math.pow(2, done.size - 1);
        if (b.bomb) {
          const zap = zapped.has(b), nap = burnt.has(b) && !zap, pw = power + (zap || nap ? 1 : 0);
          const bp = 75 * mult * (zap || nap ? 2 : 1);
          if (zap) charged = true;
          if (nap) napalm = true;
          bombPts += bp;
          booms.push({ x: b.x, y: b.y, t: -at, fired: false, power: pw, pts: bp, charged: zap, napalm: nap });
          for (const c of cells) if (c !== b && c.ci >= 0 && cdist(b, c) <= pw) { blasted.add(c); addCell(c, at + .12 + cdist(b, c) * .07); }
        }
        if (b.fire) {
          fires++;
          const zap = zapped.has(b), boom = blasted.has(b);
          if (zap) storm = true;
          if (boom) fireBlast = true;
          const walks = zap ? 3 : boom ? 2 : 1, bp = 90 * mult * (zap ? 2 : 1);
          bombPts += bp;
          booms.push({ x: b.x, y: b.y, t: -at, fired: false, fire: true, pts: bp, storm: zap });
          for (let w = 0; w < walks; w++) {
            const len = walks === 1 ? 6 + rand(3) : walks === 2 ? 5 + rand(3) : 4 + rand(2);
            firePath(b, len).forEach((c, i) => {
              const d = at + .18 + w * .06 + i * .09;
              burnt.add(c); addCell(c, d);
              flames.push({ x: c.x, y: c.y, t: -d });
            });
          }
        }
      }
      const delays = [], xs = [];
      u.forEach(c => {
        c.fx = { ci: c.ci, v: c.v, bomb: c.bomb, fire: c.fire, burning: burnt.has(c), charged: c.bomb && zapped.has(c), age: time - c.born, delay: delay.get(c), t: 0, burst: false, hole: { cx: ox, cy: oy } };
        delays.push(c.fx.delay); xs.push((c.x - 180) / 180);
        c.ci = -1; c.bomb = false; c.fire = false;
      });
      const BC = HB.fx.bursts[HB.profile.burst];
      if (BC) BC.clear(fxApi, ox, oy, { lines: full.length || 1 });
      let pts = Math.round(lineCells * 10 * full.length * (1 + (combo - 1) * .5)) + (u.size - lineCells - strikeCells) * 15 + strikeCells * 12 + bombPts;
      const bits = [];
      if (strike) bits.push(ringList.length ? 'КОЛЬЦО МОЛНИЙ' : 'МОЛНИЯ!');
      const nb = [...done].filter(c => c.bomb).length;
      if (charged) bits.push('ГРОМОВОЙ ВЗРЫВ');
      else if (napalm) bits.push('НАПАЛМ');
      else if (nb) bits.push(nb > 1 ? 'БАБАХ ×' + nb : 'БАБАХ!');
      if (fires) bits.push(storm ? 'ОГНЕННАЯ БУРЯ' : fires > 1 ? 'ЛЕСНОЙ ПОЖАР ×' + fires : fireBlast ? 'ОГНЕННЫЙ ВЗРЫВ' : 'КОСТЁР!');
      if (full.length > 1) bits.push(full.length + ' ' + U.plural(full.length, 'ЛИНИЯ', 'ЛИНИИ', 'ЛИНИЙ'));
      if (combo > 1) bits.push('КОМБО ×' + combo);
      if (cells.every(c => c.ci < 0)) { pts += 300; stat.clears++; bits.push('ЧИСТОЕ ПОЛЕ'); confetti(); }
      score += pts;
      floatText('+' + U.fmt(pts), ox, oy, 30 + Math.min(full.length, 4) * 5);
      if (bits.length) showBanner(bits.join(' · '), charged ? '#C9E8FF' : fires ? FIREC : nb ? CORAL : strike ? BOLTC : comboColor(combo));
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
    if (score > best) {
      best = score; HB.setBest(best);
      if (bestAtStart > 0 && !recordShown) {
        recordShown = true;
        let s = 'НОВЫЙ РЕКОРД!';
        if (HB.settings.undo) { undoCharges = 1; s += ' +1 ОТМЕНА'; }
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
    HB.ui.showOver({ score, best, isRecord, lines: stat.lines, maxCombo: stat.maxCombo, honey: lastAward, canUndo: canUndo() });
  }
  function undo() {
    if (!canUndo()) return false;
    if (mode === 'over') { HB.profile.honey = Math.max(0, HB.profile.honey - lastAward); HB.profile.games--; HB.saveProfile(); }
    restore(snap);
    snap = null; undoCharges--;
    shown = score; mode = 'play'; endT = 0;
    cells.forEach(c => { if (c.ci >= 0) c.pt = .3; });
    HB.sfx.undo(); HB.haptic('undo');
    showBanner('ХОД ОТМЕНЁН', SKY);
    save();
    return true;
  }
  function newGame() {
    cells.forEach(c => { c.ci = -1; c.bomb = false; c.fire = false; c.pt = 9; c.fx = null; c.gt = -1; });
    score = shown = 0; combo = miss = 0; stat = { lines: 0, maxCombo: 0, clears: 0 };
    pending = []; charge = 0; undoCharges = 0; snap = null; lastAward = 0; hold = null; holdHint = false;
    best = HB.best(); bestAtStart = best; recordShown = false; isRecord = false;
    parts = []; rings = []; floats = []; banners = []; splats = []; booms = []; strikes = []; hudFx = []; flames = [];
    drag = ghost = preview = null; idleT = 0;
    refill(); updateFits();
    mode = 'play';
    save();
  }

  /* ---------- обновление ---------- */
  function spring(o, k, target, dt, K = 380, D = 17) {
    const v = o[k + 'V'] || 0;
    o[k + 'V'] = v + (K * (target - o[k]) - D * v) * dt;
    o[k] += o[k + 'V'] * dt;
  }
  function igniteFx(b) {
    HB.sfx.bonfire(b.storm); HB.haptic('fire');
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
  function explode(b) {
    if (b.fire) { igniteFx(b); return; }
    if (b.napalm) {
      HB.sfx.napalm(); HB.haptic('bomb');
      if (b.pts) floatText('+' + U.fmt(b.pts), b.x, b.y - 20, 28, FIREC);
      shake = Math.max(shake, 24); whiteFlash = 1.2; flashTint = '255,170,90'; freeze = Math.max(freeze, .12); punch = Math.max(punch, .09);
      rings.push({ x: b.x, y: b.y, t: 0, color: '#FF5A1A', big: true, huge: true });
      rings.push({ x: b.x, y: b.y, t: -.08, color: AMBER, big: true });
      for (let i = 0; i < 40; i++) parts.push({ k: 'flamep', x: b.x + rnd(-14, 14), y: b.y + rnd(-10, 10), vx: rnd(-160, 160), vy: rnd(-240, -40), g: -30, t: 0, life: rnd(.4, .9), color: '#FF8A00', r: rnd(10, 22) });
      sparks(b.x, b.y, AMBER, 26, 340);
      shards(b.x, b.y, '#2A1608', 10, 1.7);
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
      for (let i = 0; i < 12; i++) parts.push({ k: 'smoke', x: b.x + rnd(-12, 12), y: b.y + rnd(-12, 12), vx: rnd(-80, 80), vy: rnd(-110, -20), g: -20, t: 0, life: rnd(.9, 1.4), color: 'rgba(40,40,90,.5)', r: rnd(12, 24) });
      return;
    }
    HB.sfx.bomb(); HB.haptic('bomb');
    if (b.pts) floatText('+' + U.fmt(b.pts), b.x, b.y - 20, 24 + Math.min(12, Math.log2(b.pts / 75) * 4), CORAL);
    shake = Math.max(shake, 16 + b.power * 4); whiteFlash = 1; flashTint = '255,245,230'; freeze = Math.max(freeze, .1); punch = Math.max(punch, .08);
    rings.push({ x: b.x, y: b.y, t: 0, color: CORAL, big: true });
    rings.push({ x: b.x, y: b.y, t: -.08, color: AMBER, big: true });
    sparks(b.x, b.y, AMBER, 26, 320); sparks(b.x, b.y, '#FFFFFF', 12, 260);
    shards(b.x, b.y, '#2A2250', 10, 1.6);
    for (let i = 0; i < 10; i++) parts.push({ k: 'smoke', x: b.x + rnd(-10, 10), y: b.y + rnd(-10, 10), vx: rnd(-60, 60), vy: rnd(-90, -20), g: -20, t: 0, life: rnd(.8, 1.3), color: 'rgba(40,30,70,.5)', r: rnd(10, 20) });
  }
  function update(dt) {
    time += dt;
    HB.skins.tick(dt);
    for (const cl of cells) {
      if (cl.pt < 9) cl.pt += dt;
      const fx = cl.fx;
      if (fx) {
        fx.t += dt;
        if (!fx.burst && fx.t >= fx.delay) {
          fx.burst = true;
          const col = colorOf(fx.ci), B = HB.fx.bursts[HB.profile.burst];
          if (B) B.cell(fxApi, cl.x, cl.y, col, fx.hole || { cx: cl.x, cy: cl.y });
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
    if (!HB.skins.drawBg(c, W, H, { cy: CY })) {
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
      tile(c, cl.x, cl.y, S * .93 * sc, colorOf(cl.ci), { flash, grey, v: cl.v, age: time - cl.born, board: true, rip: rk - 1, seed: cl.idx * 7 + cl.v });
      if (cl.bomb) drawBomb(c, cl.x, cl.y, S * sc, time + cl.q);
    }
    const lit = cells.filter(cl => cl.ci >= 0 && cl.fire);
    lit.forEach(cl => fireLight(c, cl.x, cl.y, time));
    lit.forEach(cl => { const age = time - cl.born; drawBonfire(c, cl.x, cl.y, S, time + cl.q, 1 + (age < 1 ? 1.4 * Math.exp(-4 * age) : 0)); });
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
    if (canUndo() && mode === 'play') {
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
    if (fire) {
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
        else drawBomb(c, ix, by, 11, time);
      });
      for (let i = 0; i < need; i++) {
        c.beginPath(); c.arc(bx + 16 + i * 9, by + 1, 3.2, 0, TAU);
        c.fillStyle = i < have ? CORAL : 'rgba(255,255,255,.15)'; c.fill();
      }
      if (pending.length) text(c, '×' + pending.length, bx - 16 - (specials().length - 1) * 12, by + 1, `800 12px ${FB}`, pending[0] === 'bolt' ? BOLTC : pending[0] === 'fire' ? FIREC : CORAL, 'right');
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
    drawHud(c);
    drawBanner(c);
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
  cv.addEventListener('pointerdown', e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (err) {} down(pt(e)); });
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
  function frame(now) {
    let dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    if (freeze > 0) { freeze -= dt; dt *= .08; }
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  HB.game = {
    hasSave: () => hasSave && mode === 'idle' && tray.some(Boolean),
    resume() { mode = 'play'; },
    newGame,
    undo, canUndo,
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
      map.get(key(0, 1)).ci = 4; map.get(key(-1, 1)).ci = 5;
      tray[0] = makePiece(0, 0, [[0, 0]], 3, -1, null, 0); tray[0].delay = 0;
      updateFits();
    },
    _placeAt(i, q, r) {
      const pc = pieceAt(i);
      drag = { i, px: 0, py: 0, lift: 0, dx: 0, vs: 0 }; ghost = { aq: q - pc.shape[0][0], ar: r - pc.shape[0][1] };
      place();
      drag = ghost = preview = boltPreview = null;
    },
    _score: () => score
  };
  window.hbSave = save;
})();
