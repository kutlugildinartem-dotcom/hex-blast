/* Экраны поверх игры: меню, пауза, итоги, настройки, скины, свои соты, серия дней, обновления. */
(() => {
  'use strict';
  const HB = window.HB, U = HB.util;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const stack = [];

  /* ---------- навигация ---------- */
  function open(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (stack.includes(id)) stack.splice(stack.indexOf(id), 1);
    stack.push(id);
    el.hidden = false;
    el.classList.remove('leaving');
    void el.offsetWidth;
    el.classList.add('entering');
    el.style.zIndex = 10 + stack.length;
    HB.game.setInput(false);
    const r = renders[id]; if (r) r();
  }
  function close(id, then) {
    const el = document.getElementById(id);
    const i = stack.indexOf(id);
    if (i >= 0) stack.splice(i, 1);
    if (!el || el.hidden) { settle(); if (then) then(); return; }
    el.classList.remove('entering');
    el.classList.add('leaving');
    setTimeout(() => { el.hidden = true; el.classList.remove('leaving'); }, 170);
    settle();
    if (then) then();
  }
  function settle() { HB.game.setInput(stack.length === 0 && HB.game.mode() === 'play'); }
  const top = () => stack[stack.length - 1];
  const PAGES = ['settings', 'shop', 'editor'];

  window.hbBack = () => {
    const t = top();
    if (!t) { if (HB.game.mode() === 'play') { openPause(); return true; } return false; }
    if (t === 'home') return false;
    if (t === 'over') { toMenu(); return true; }
    close(t);
    HB.sfx.click();
    return true;
  };

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    clearTimeout(toast.tm);
    toast.tm = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function bounce(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  function shakeEl(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
  function tap(el, fn) {
    el.addEventListener('click', e => { HB.sfx.unlock(); fn(e); });
  }

  /* ---------- главное меню ---------- */
  const renders = {};
  renders.home = () => {
    $('#h-honey').textContent = U.fmt(HB.profile.honey);
    $('#h-best').textContent = U.fmt(HB.best());
    $('#h-streak b').textContent = HB.profile.streak.count || 1;
    const inGame = HB.game.mode() === 'play' || HB.game.hasSave();
    $('#h-play').textContent = inGame ? 'Продолжить' : 'Играть';
    $('#h-new').hidden = !inGame;
  };
  tap($('#h-play'), () => {
    HB.sfx.click(); HB.haptic('place');
    if (HB.game.mode() !== 'play') {
      if (HB.game.hasSave()) HB.game.resume(); else HB.game.newGame();
    }
    close('home');
  });
  tap($('#h-new'), () => { HB.sfx.click(); HB.haptic('tick'); HB.game.newGame(); close('home'); });
  tap($('#h-streak'), () => { HB.sfx.click(); open('streak'); });
  $$('[data-open]').forEach(b => tap(b, () => { HB.sfx.click(); HB.haptic('tick'); open(b.dataset.open); }));
  $$('[data-back]').forEach(b => tap(b, () => { HB.sfx.click(); close(b.closest('.screen').id); }));

  /* ---------- пауза ---------- */
  function openPause() { open('pause'); }
  HB.ui = { pause: openPause };
  renders.pause = () => { const b = $('#p-restart'); b.textContent = 'Начать заново'; b.classList.remove('danger'); };
  tap($('#p-resume'), () => { HB.sfx.click(); close('pause'); });
  tap($('#p-restart'), e => {
    const b = e.currentTarget;
    if (!b.classList.contains('danger')) { b.classList.add('danger'); b.textContent = 'Точно? Партия пропадёт'; HB.haptic('tick'); return; }
    HB.sfx.click(); HB.haptic('place');
    HB.game.newGame(); close('pause');
  });
  tap($('#p-menu'), () => { HB.sfx.click(); HB.game.save(); close('pause'); open('home'); });
  function toMenu() { close('over'); open('home'); }

  /* ---------- итоги ---------- */
  let overData = null;
  HB.ui.showOver = d => {
    overData = d;
    open('over');
    const sc = $('#o-score'), hn = $('#o-honey');
    $('#o-record').hidden = !d.isRecord;
    $('#o-best').hidden = d.isRecord;
    $('#o-best b').textContent = U.fmt(d.best);
    $('#o-stats').textContent = `Линий: ${d.lines} · макс. комбо ×${d.maxCombo}`;
    $('#o-undo').hidden = !d.canUndo;
    sc.textContent = '0'; hn.textContent = '0';
    const t0 = performance.now();
    let coinStep = 0;
    const tick = now => {
      if (!overData || overData !== d) return;
      const k = U.clamp((now - t0 - 250) / 900);
      sc.textContent = U.fmt(d.score * U.eo(k));
      const hk = U.clamp((now - t0 - 1100) / 800);
      const hv = Math.round(d.honey * U.eo(hk));
      hn.textContent = U.fmt(hv);
      const step = Math.floor(hv / Math.max(1, Math.ceil(d.honey / 12)));
      if (hk > 0 && step > coinStep) { coinStep = step; HB.sfx.coin(step); HB.haptic('coin'); }
      if (hk < 1) requestAnimationFrame(tick);
      else bounce($('#o-honey-wrap'));
    };
    requestAnimationFrame(tick);
  };
  tap($('#o-again'), () => { HB.sfx.click(); HB.haptic('place'); overData = null; close('over'); HB.game.newGame(); });
  tap($('#o-menu'), () => { HB.sfx.click(); overData = null; toMenu(); });
  tap($('#o-undo'), () => { overData = null; close('over'); HB.game.undo(); settle(); });

  /* ---------- серия дней ---------- */
  renders.streak = () => {
    const s = HB.profile.streak, n = Math.max(1, s.count);
    const today = new Date(), claimed = s.claimed === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    $('#st-count').textContent = n;
    $('#st-days').textContent = U.plural(n, 'день подряд', 'дня подряд', 'дней подряд');
    const day = ((n - 1) % 7) + 1;
    $('#st-week').innerHTML = Array.from({ length: 7 }, (_, i) => {
      const d = i + 1, cls = d < day || (d === day && claimed) ? 'done' : d === day ? 'now' : '';
      return `<div class="day ${cls}"><span>День ${d}</span><b>${HB.streakReward(d)}</b><i class="honey"></i></div>`;
    }).join('');
    const btn = $('#st-claim');
    btn.disabled = claimed;
    btn.innerHTML = claimed ? 'Награда получена, до завтра!' : `Забрать +${HB.streakReward(n)} <i class="honey"></i>`;
  };
  tap($('#st-claim'), () => {
    const r = HB.claimStreak();
    if (!r) return;
    HB.sfx.streak(); HB.haptic('streak'); HB.game.confetti(70);
    toast(`+${r} мёда! Приходи завтра за новой наградой`);
    renders.streak(); renders.home();
    bounce($('#h-honey').parentElement);
  });

  /* ---------- настройки ---------- */
  const BOMB_DESC = {
    combo: 'Каждое комбо ×3 заряжает особую соту. Она придёт со следующей тройкой фигур.',
    charge: 'Каждые 6 сожжённых линий заряжают особую соту. Прогресс виден под рекордом.',
    random: 'Любая новая фигура может прийти с особой сотой, примерно одна из двенадцати.'
  };
  const SPECIAL_DESC = {
    bomb: 'Сота с фитилём. Сгорает в линии и взрывает соседей. Каждый следующий взрыв в цепочке даёт вдвое больше очков.',
    bolt: 'Сота-молния. Как только ставишь её на поле, бьёт молния и сжигает всю линию через неё, даже неполную.',
    both: 'Приходят и бомбы, и молнии. Молния может задеть бомбу, и тогда рванёт целая цепочка.'
  };
  const HAP_DESC = ['Вибрация выключена.', 'Лёгкие щелчки на каждое действие.', 'Плотные удары: ставишь, сжигаешь, взрываешь и всё чувствуешь.', 'На полную: длинные раскаты, взрывы и салюты. Держи телефон крепче.'];
  function syncSettings() {
    const s = HB.settings;
    $$('input[data-set]').forEach(i => { i.checked = !!s[i.dataset.set]; });
    $$('[data-seg]').forEach(seg => {
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', String(s[seg.dataset.seg]) === b.dataset.v));
    });
    $$('[data-show]').forEach(el => { el.hidden = !s[el.dataset.show]; });
    $('#vol').value = Math.round(s.volume * 100);
    $('#bomb-desc').textContent = BOMB_DESC[s.bombSource];
    $('#special-desc').textContent = SPECIAL_DESC[s.special] || SPECIAL_DESC.bomb;
    $('#power-row').hidden = s.special === 'bolt';
    $('#hap-desc').textContent = HAP_DESC[s.haptics];
    const n = HB.profile.custom.length, on = HB.profile.custom.filter(c => c.on).length;
    $('#custom-summary').textContent = n ? `${n} ${U.plural(n, 'фигура', 'фигуры', 'фигур')}, в игре ${on}` : 'Нарисуй фигуру и добавь её в игру';
    $('#app-ver').textContent = 'Hex Blast ' + HB.appVersion();
    $('#check-upd').hidden = !HB.isAndroid;
    if (!HB.isAndroid) $('#upd-status').textContent = 'Обновления приходят в приложении на Android.';
  }
  renders.settings = syncSettings;
  $$('input[data-set]').forEach(i => i.addEventListener('change', () => {
    HB.settings[i.dataset.set] = i.checked;
    HB.saveSettings();
    if (i.dataset.set === 'sound') { HB.sfx.setVolume(); HB.sfx.unlock(); }
    HB.sfx.toggle(i.checked); HB.haptic('tick');
    HB.game.refreshSettings();
    syncSettings();
  }));
  $$('[data-seg]').forEach(seg => seg.querySelectorAll('button').forEach(b => tap(b, () => {
    const k = seg.dataset.seg, v = /^\d+$/.test(b.dataset.v) ? +b.dataset.v : b.dataset.v;
    HB.settings[k] = v;
    HB.saveSettings();
    syncSettings();
    HB.sfx.click();
    if (k === 'haptics') HB.haptic(v >= 3 ? 'bomb' : 'clear', 8, 1 | (2 << 8));
    else if (k === 'special' && v !== 'bomb') { HB.sfx.thunder(); HB.haptic('thunder'); }
    else HB.haptic('tick');
  })));
  let volTick = 0;
  $('#vol').addEventListener('input', e => {
    HB.settings.volume = e.target.value / 100;
    HB.saveSettings(); HB.sfx.setVolume();
    const now = performance.now();
    if (now - volTick > 90) { volTick = now; HB.sfx.coin(Math.round(e.target.value / 20)); }
  });
  tap($('#check-upd'), () => {
    $('#upd-status').textContent = 'Проверяю…';
    try { window.HexAndroid.checkUpdate(true); } catch (e) { $('#upd-status').textContent = 'Проверка доступна только в приложении.'; }
  });

  /* ---------- скины ---------- */
  const pending = { id: null, tm: 0 };
  renders.shop = () => {
    $('#s-honey').textContent = U.fmt(HB.profile.honey);
    const grid = $('#skin-grid');
    grid.innerHTML = HB.skins.list.map(s => {
      const owned = HB.profile.owned.includes(s.id), cur = HB.profile.skin === s.id;
      const label = cur ? 'Выбран' : owned ? 'Выбрать' : pending.id === s.id ? `Купить за ${s.price}?` : `${s.price} <i class="honey"></i>`;
      return `<div class="skin ${cur ? 'current' : ''} ${owned ? 'owned' : ''}" data-id="${s.id}">
        <canvas width="240" height="150"></canvas>
        <div class="skin-meta"><b>${s.name}</b><small class="tier t-${HB.skins.tier(s.price).length}">${HB.skins.tier(s.price)}</small></div>
        <button class="skin-btn ${cur ? 'cur' : owned ? 'own' : pending.id === s.id ? 'confirm' : 'buy'}">${label}</button>
      </div>`;
    }).join('');
    grid.querySelectorAll('.skin').forEach(el => {
      HB.skins.preview(el.querySelector('canvas'), HB.skins.get(el.dataset.id));
      tap(el.querySelector('.skin-btn'), () => skinAction(el.dataset.id, el));
    });
  };
  function skinAction(id, el) {
    const s = HB.skins.get(id), p = HB.profile;
    if (p.skin === id) return;
    if (p.owned.includes(id)) {
      p.skin = id; HB.saveProfile(); HB.sfx.toggle(true); HB.haptic('tick');
      renders.shop(); bounce(document.querySelector(`.skin[data-id="${id}"]`));
      return;
    }
    if (p.honey < s.price) {
      const need = s.price - p.honey;
      shakeEl(el); HB.sfx.invalid(); HB.haptic('invalid');
      toast(`Нужно ещё ${need} мёда. Это примерно ${need > 60 ? 'пара партий' : 'одна партия'}`);
      return;
    }
    if (pending.id !== id) {
      pending.id = id; clearTimeout(pending.tm);
      pending.tm = setTimeout(() => { pending.id = null; if (!$('#shop').hidden) renders.shop(); }, 3000);
      HB.sfx.click(); HB.haptic('tick'); renders.shop();
      return;
    }
    pending.id = null;
    p.honey -= s.price; p.owned.push(id); p.skin = id; HB.saveProfile();
    HB.sfx.buy(); HB.haptic('buy'); HB.game.confetti(90);
    toast(`Скин «${s.name}» твой!`);
    renders.shop(); bounce(document.querySelector(`.skin[data-id="${id}"]`));
  }

  /* ---------- свои соты ---------- */
  const ED_R = 2, MAX_CELLS = 7;
  let edCells = [];
  const ed = $('#ed-canvas');
  function edGeom() {
    const w = ed.clientWidth || 300, h = w * .8;
    const s = Math.min(w / ((2 * ED_R + 1) * Math.sqrt(3) + .6), h / ((2 * ED_R) * 1.5 + 2.2));
    return { w, h, s, cx: w / 2, cy: h / 2 };
  }
  function edDraw() {
    const dpr = Math.min(2.5, window.devicePixelRatio || 1), g = edGeom();
    ed.width = Math.round(g.w * dpr); ed.height = Math.round(g.h * dpr);
    const c = ed.getContext('2d'), sk = HB.skins.current();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, g.w, g.h);
    for (let q = -ED_R; q <= ED_R; q++) for (let r = -ED_R; r <= ED_R; r++) {
      if (Math.abs(q + r) > ED_R) continue;
      const x = g.cx + g.s * Math.sqrt(3) * (q + r / 2), y = g.cy + g.s * 1.5 * r;
      const on = edCells.some(([a, b]) => a === q && b === r);
      if (on) HB.skins.tile(c, x, y, g.s * .93, sk.colors[3], sk);
      else { HB.skins.hexPath(c, x, y, g.s * .93); c.fillStyle = sk.empty; c.fill(); c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.08)'; c.stroke(); }
    }
    const n = edCells.length, ok = n > 0 && HB.isConnected(edCells);
    $('#ed-count').textContent = `${n} / ${MAX_CELLS}`;
    $('#ed-hint').textContent = !n ? 'Нажимай на соты, чтобы собрать фигуру.' : ok ? 'Отлично, фигуру можно сохранить.' : 'Все соты должны касаться друг друга.';
    $('#ed-hint').classList.toggle('warn', n > 0 && !ok);
    $('#ed-save').disabled = !ok;
  }
  ed.addEventListener('pointerdown', e => {
    HB.sfx.unlock();
    const rect = ed.getBoundingClientRect(), g = edGeom();
    const px = (e.clientX - rect.left) / rect.width * g.w - g.cx, py = (e.clientY - rect.top) / rect.height * g.h - g.cy;
    const fq = (Math.sqrt(3) / 3 * px - py / 3) / g.s, fr = (2 / 3 * py) / g.s, fs = -fq - fr;
    let q = Math.round(fq), r = Math.round(fr); const s = Math.round(fs);
    const dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s - fs);
    if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
    if (Math.abs(q) > ED_R || Math.abs(r) > ED_R || Math.abs(q + r) > ED_R) return;
    const i = edCells.findIndex(([a, b]) => a === q && b === r);
    if (i >= 0) { edCells.splice(i, 1); HB.sfx.toggle(false); }
    else if (edCells.length >= MAX_CELLS) { HB.sfx.invalid(); HB.haptic('invalid'); toast(`Не больше ${MAX_CELLS} сот в одной фигуре`); return; }
    else { edCells.push([q, r]); HB.sfx.toggle(true); }
    HB.haptic('tick');
    edDraw();
  });
  tap($('#ed-clear'), () => { edCells = []; HB.sfx.click(); edDraw(); });
  tap($('#ed-save'), () => {
    if (!edCells.length || !HB.isConnected(edCells)) return;
    if (HB.profile.custom.length >= 12) { toast('Максимум 12 своих фигур. Удали какую-нибудь из старых.'); return; }
    const minQ = Math.min(...edCells.map(c => c[0])), minR = Math.min(...edCells.map(c => c[1]));
    const cells = edCells.map(([q, r]) => [q - minQ, r - minR]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    HB.profile.custom.push({ id: Date.now(), cells, on: true });
    HB.saveProfile();
    edCells = [];
    HB.sfx.buy(); HB.haptic('buy');
    toast('Фигура добавлена в игру!');
    renders.editor();
  });
  function drawShape(canvas, cells, color) {
    const dpr = Math.min(2.5, window.devicePixelRatio || 1), w = 96, h = 72;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const c = canvas.getContext('2d'), sk = HB.skins.current();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pts = cells.map(([q, r]) => [Math.sqrt(3) * (q + r / 2), 1.5 * r]);
    const minX = Math.min(...pts.map(p => p[0])) - 1, maxX = Math.max(...pts.map(p => p[0])) + 1;
    const minY = Math.min(...pts.map(p => p[1])) - 1.1, maxY = Math.max(...pts.map(p => p[1])) + 1.1;
    const s = Math.min((w - 8) / (maxX - minX), (h - 8) / (maxY - minY), 14);
    const ox = w / 2 - (minX + maxX) / 2 * s, oy = h / 2 - (minY + maxY) / 2 * s;
    pts.forEach(([x, y]) => HB.skins.tile(c, ox + x * s, oy + y * s, s * .93, color, sk));
  }
  renders.editor = () => {
    edDraw();
    const list = $('#ed-list'), sk = HB.skins.current();
    $('#ed-empty').hidden = HB.profile.custom.length > 0;
    list.innerHTML = HB.profile.custom.map((f, i) => `
      <div class="shape-item" data-i="${i}">
        <canvas></canvas>
        <div class="shape-info"><b>Фигура ${i + 1}</b><small>${f.cells.length} ${U.plural(f.cells.length, 'сота', 'соты', 'сот')}</small></div>
        <label class="mini-toggle"><input type="checkbox" class="switch" ${f.on ? 'checked' : ''}><span>${f.on ? 'В игре' : 'Выкл'}</span></label>
        <button class="del" aria-label="Удалить фигуру">✕</button>
      </div>`).join('');
    list.querySelectorAll('.shape-item').forEach(el => {
      const i = +el.dataset.i, f = HB.profile.custom[i];
      drawShape(el.querySelector('canvas'), f.cells, sk.colors[i % 6]);
      el.querySelector('input').addEventListener('change', e => {
        f.on = e.target.checked; HB.saveProfile(); HB.sfx.toggle(f.on); HB.haptic('tick');
        el.querySelector('.mini-toggle span').textContent = f.on ? 'В игре' : 'Выкл';
      });
      tap(el.querySelector('.del'), e => {
        const b = e.currentTarget;
        if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'Удалить?'; HB.haptic('tick'); return; }
        HB.profile.custom.splice(i, 1); HB.saveProfile(); HB.sfx.invalid(); renders.editor();
      });
    });
    $('#ed-on').checked = HB.settings.customOn;
  };
  $('#ed-on').addEventListener('change', e => {
    HB.settings.customOn = e.target.checked; HB.saveSettings(); HB.sfx.toggle(e.target.checked); HB.haptic('tick');
  });

  /* ---------- обновления ---------- */
  let upVer = null;
  window.hbUpdate = {
    available(ver, notes, size, manual) {
      upVer = ver;
      $('#up-ver').textContent = ver;
      $('#up-notes').textContent = notes || 'Новые фишки и исправления.';
      $('#up-size').textContent = size ? `${(size / 1048576).toFixed(1)} МБ` : '';
      $('#up-progress').hidden = true; $('#up-status').textContent = '';
      $('#up-go').disabled = false; $('#up-go').textContent = 'Обновить';
      $('#h-update').hidden = false; $('#h-update b').textContent = ver;
      $('#upd-status').textContent = `Доступна версия ${ver}`;
      if (manual || top() === 'home') open('update');
    },
    upToDate() { $('#upd-status').textContent = 'У тебя последняя версия.'; },
    failed(msg) {
      $('#upd-status').textContent = msg;
      $('#up-status').textContent = msg; $('#up-go').disabled = false; $('#up-go').textContent = 'Попробовать ещё раз';
    },
    progress(p) { $('#up-progress').hidden = false; $('#up-bar').style.width = p + '%'; $('#up-status').textContent = `Скачиваю… ${p}%`; },
    installing() { $('#up-status').textContent = 'Подтверди установку в окне Android.'; },
    needPermission() {
      $('#up-status').textContent = 'Разреши установку из Hex Blast в открывшихся настройках, вернись и нажми «Обновить» ещё раз.';
      $('#up-go').disabled = false;
    },
    cancelled() { $('#up-status').textContent = 'Установку отменили. Можно попробовать позже.'; $('#up-go').disabled = false; }
  };
  tap($('#up-go'), () => {
    HB.sfx.click();
    $('#up-go').disabled = true; $('#up-status').textContent = 'Начинаю загрузку…';
    try { window.HexAndroid.startUpdate(); } catch (e) { window.hbUpdate.failed('Обновление работает только в приложении.'); }
  });
  tap($('#up-later'), () => { HB.sfx.click(); close('update'); });
  tap($('#h-update'), () => { HB.sfx.click(); if (upVer) open('update'); });

  /* ---------- старт ---------- */
  open('home');
  const reward = HB.touchStreak();
  if (reward > 0) setTimeout(() => open('streak'), 450);
  if (HB.isAndroid) setTimeout(() => { try { window.HexAndroid.checkUpdate(false); } catch (e) {} }, 1500);
  document.addEventListener('contextmenu', e => e.preventDefault());
})();
