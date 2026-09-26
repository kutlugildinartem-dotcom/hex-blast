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

  /* ---------- магазин: скины, звуки, следы, взрывы ---------- */
  const CATS = {
    skins: { list: () => HB.skins.list, owned: 'owned', cur: 'skin', hint: 'Мёд дают за каждую партию: чем больше счёт и линий, тем больше мёда.' },
    sounds: { list: () => HB.fx.SOUNDS, owned: 'ownedSounds', cur: 'sound', hint: 'Набор меняет все музыкальные звуки игры. Нажми «Послушать», чтобы оценить до покупки.' },
    trails: { list: () => HB.fx.TRAILS, owned: 'ownedTrails', cur: 'trail', hint: 'След тянется за фигурой, пока ты её держишь.' },
    bursts: { list: () => HB.fx.BURSTS, owned: 'ownedBursts', cur: 'burst', hint: 'Так сгорают линии. «Как у скина» оставляет родной эффект выбранного скина.' }
  };
  let shopTab = 'skins';
  const pending = { id: null, tm: 0 };
  $$('#shop-tabs button').forEach(b => tap(b, () => {
    if (shopTab === b.dataset.tab) return;
    shopTab = b.dataset.tab; pending.id = null;
    HB.sfx.click(); HB.haptic('tick');
    renders.shop();
    $('#shop').scrollTop = 0;
  }));
  renders.shop = () => {
    const cat = CATS[shopTab], p = HB.profile;
    $$('#shop-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === shopTab));
    $('#s-honey').textContent = U.fmt(p.honey);
    $('#shop-hint').textContent = cat.hint;
    const grid = $('#skin-grid');
    grid.innerHTML = cat.list().map(s => {
      const owned = (p[cat.owned] || []).includes(s.id), cur = p[cat.cur] === s.id;
      const label = cur ? 'Выбрано' : owned ? 'Выбрать' : pending.id === s.id ? `Купить за ${s.price}?` : `${s.price} <i class="honey"></i>`;
      const sub = shopTab === 'skins' ? `<small class="tier t-${HB.skins.tier(s.price).length}">${HB.skins.tier(s.price)}</small>` : `<small class="desc">${s.desc}</small>`;
      return `<div class="skin ${cur ? 'current' : ''} ${owned ? 'owned' : ''}" data-id="${s.id}">
        <canvas width="240" height="150"></canvas>
        <div class="skin-meta"><b>${s.name}</b>${sub}</div>
        ${shopTab === 'sounds' ? '<button class="listen" type="button">▶ Послушать</button>' : ''}
        <button class="skin-btn ${cur ? 'cur' : owned ? 'own' : pending.id === s.id ? 'confirm' : 'buy'}" type="button">${label}</button>
      </div>`;
    }).join('');
    grid.querySelectorAll('.skin').forEach(el => {
      const id = el.dataset.id, cv = el.querySelector('canvas');
      if (shopTab === 'skins') HB.skins.preview(cv, HB.skins.get(id));
      if (shopTab === 'sounds') soundIcon(cv, id);
      const ls = el.querySelector('.listen');
      if (ls) tap(ls, () => {
        HB.sfx.demo(id); HB.haptic('tick');
        ls.classList.add('playing'); setTimeout(() => ls.classList.remove('playing'), 1600);
      });
      tap(el.querySelector('.skin-btn'), () => buy(id, el));
    });
    startPreviews();
  };
  function buy(id, el) {
    const cat = CATS[shopTab], p = HB.profile, item = cat.list().find(s => s.id === id);
    if (!item || p[cat.cur] === id) return;
    p[cat.owned] = p[cat.owned] || [];
    if (p[cat.owned].includes(id)) {
      p[cat.cur] = id; HB.saveProfile(); HB.sfx.toggle(true); HB.haptic('tick');
      if (shopTab === 'sounds') HB.sfx.demo(id);
      renders.shop(); bounce(document.querySelector(`.skin[data-id="${id}"]`));
      return;
    }
    if (p.honey < item.price) {
      const need = item.price - p.honey;
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
    p.honey -= item.price; p[cat.owned].push(id); p[cat.cur] = id; HB.saveProfile();
    HB.sfx.buy(); HB.haptic('buy'); HB.game.confetti(90);
    toast(`«${item.name}» теперь твоё!`);
    renders.shop(); bounce(document.querySelector(`.skin[data-id="${id}"]`));
  }

  /* Иконки звуковых наборов */
  function soundIcon(cv, id) {
    const c = cv.getContext('2d'), w = cv.width, h = cv.height, cx = w / 2, cy = h / 2;
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#231E52'); g.addColorStop(1, '#141033');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (id === 'xylo') {
      ['#FF6B6B', '#FFB84D', '#FFE45C', '#5EE08A', '#4DC3FF', '#9A7BFF'].forEach((col, i) => {
        const x = cx - 75 + i * 30, hh = 90 - i * 9;
        c.fillStyle = col; c.beginPath(); c.roundRect ? c.roundRect(x - 11, cy - hh / 2, 22, hh, 6) : c.rect(x - 11, cy - hh / 2, 22, hh); c.fill();
        c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x - 7, cy - hh / 2 + 5, 4, hh - 10);
        c.fillStyle = '#E8E0FF'; c.beginPath(); c.arc(x, cy - hh / 2 + 10, 2.5, 0, Math.PI * 2); c.arc(x, cy + hh / 2 - 10, 2.5, 0, Math.PI * 2); c.fill();
      });
    } else if (id === 'glass') {
      [[-45, 0, 30], [10, -12, 38], [60, 8, 26]].forEach(([dx, dy, r], i) => {
        const x = cx + dx, y = cy + dy;
        c.strokeStyle = 'rgba(220,240,255,.5)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, y - r); c.stroke();
        const bg = c.createLinearGradient(x - r, y - r, x + r, y + r); bg.addColorStop(0, 'rgba(200,235,255,.8)'); bg.addColorStop(1, 'rgba(160,140,255,.35)');
        c.fillStyle = bg; c.beginPath(); c.moveTo(x - r * .55, y - r * .6); c.quadraticCurveTo(x - r * .6, y + r * .5, x - r, y + r * .6); c.lineTo(x + r, y + r * .6); c.quadraticCurveTo(x + r * .6, y + r * .5, x + r * .55, y - r * .6); c.quadraticCurveTo(x, y - r * 1.1, x - r * .55, y - r * .6); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2; c.stroke();
        c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(x - r * .25, y - r * .2, r * .1, r * .35, .2, 0, Math.PI * 2); c.fill();
      });
    } else if (id === 'chip') {
      const P = ['..kkkk..', '..k..k..', '..k..k..', '..k..k..', 'kkk.kkk.', 'kkk.kkk.', '........'];
      const s = 12, ox = cx - 4 * s, oy = cy - 3.5 * s;
      P.forEach((row, r) => [...row].forEach((ch, k) => { if (ch === 'k') { c.fillStyle = r % 2 ? '#4DC3FF' : '#5EE08A'; c.fillRect(ox + k * s, oy + r * s, s - 1, s - 1); } }));
      c.fillStyle = 'rgba(255,255,255,.08)'; for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
    } else if (id === 'piano') {
      const kw = 22, n = 9, x0 = cx - n * kw / 2, y0 = cy - 45;
      for (let i = 0; i < n; i++) { c.fillStyle = '#F7F4EE'; c.fillRect(x0 + i * kw, y0, kw - 2, 90); c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(x0 + i * kw, y0 + 82, kw - 2, 8); }
      [0, 1, 3, 4, 5, 7].forEach(i => { c.fillStyle = '#1C1830'; c.fillRect(x0 + i * kw + kw * .65, y0, kw * .7, 55); c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(x0 + i * kw + kw * .7, y0, 2, 50); });
    } else if (id === 'kalimba') {
      c.fillStyle = '#B07A4A'; c.beginPath(); c.roundRect ? c.roundRect(cx - 70, cy - 42, 140, 92, 18) : c.rect(cx - 70, cy - 42, 140, 92); c.fill();
      c.fillStyle = '#5A3A22'; c.beginPath(); c.arc(cx, cy + 22, 14, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#8C5E36'; c.fillRect(cx - 60, cy - 30, 120, 8);
      [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].forEach(i => { const L = 60 - Math.abs(i) * 7; const g = c.createLinearGradient(0, cy - 34, 0, cy - 34 + L); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#A9B4C8'); c.fillStyle = g; c.fillRect(cx + i * 10 - 3, cy - 34, 6, L); });
    } else if (id === 'harp') {
      c.strokeStyle = '#E3B04B'; c.lineWidth = 7;
      c.beginPath(); c.moveTo(cx - 50, cy + 50); c.lineTo(cx - 50, cy - 50); c.quadraticCurveTo(cx + 10, cy - 70, cx + 55, cy - 20); c.lineTo(cx - 50, cy + 50); c.stroke();
      c.strokeStyle = 'rgba(255,245,220,.85)'; c.lineWidth = 1.4;
      for (let i = 1; i <= 8; i++) { const x = cx - 50 + i * 11.5, top = cy - 50 - Math.sin(i / 9 * Math.PI) * 12 + i * 3.5; c.beginPath(); c.moveTo(x, top); c.lineTo(x, cy + 50 - i * 8.8); c.stroke(); }
    } else if (id === 'rhodes') {
      c.fillStyle = '#1B1B1B'; c.beginPath(); c.arc(cx, cy, 55, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1; for (let r = 20; r < 54; r += 4) { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke(); }
      c.fillStyle = '#E8734A'; c.beginPath(); c.arc(cx, cy, 18, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#231E52'; c.beginPath(); c.arc(cx, cy, 3, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.15)'; c.beginPath(); c.ellipse(cx - 20, cy - 25, 22, 8, -.6, 0, Math.PI * 2); c.fill();
    } else {
      c.save(); c.globalCompositeOperation = 'lighter'; c.lineWidth = 3;
      [['120,90,255', 0], ['80,200,255', 1.3], ['255,100,200', 2.6]].forEach(([col, ph], k) => {
        c.strokeStyle = `rgba(${col},.85)`; c.beginPath();
        for (let x = 0; x <= w; x += 4) { const y = cy + Math.sin(x * .05 + ph) * (26 - k * 6) * Math.sin(x / w * Math.PI); x ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.stroke();
      });
      c.restore();
    }
  }

  /* Живые превью следов и взрывов */
  const live = [];
  let liveRaf = 0, liveLast = 0;
  function startPreviews() {
    cancelAnimationFrame(liveRaf); live.length = 0;
    if (shopTab !== 'trails' && shopTab !== 'bursts') return;
    document.querySelectorAll('#skin-grid .skin').forEach((el, i) => {
      const cv = el.querySelector('canvas');
      live.push({ id: el.dataset.id, cv, c: cv.getContext('2d'), parts: [], splats: [], t: i * .37, st: {}, hist: [], fired: false });
    });
    liveLast = performance.now();
    liveRaf = requestAnimationFrame(tickPreviews);
  }
  function previewBg(c, w, h) {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#221D52'); g.addColorStop(1, '#120F2C');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }
  function tickPreviews(now) {
    if ($('#shop').hidden) return;
    const dt = Math.min(.05, (now - liveLast) / 1000); liveLast = now;
    HB.skins.tick(0);
    live.forEach(L => (shopTab === 'trails' ? trailPreview : burstPreview)(L, dt));
    liveRaf = requestAnimationFrame(tickPreviews);
  }
  function trailPreview(L, dt) {
    const c = L.c, w = L.cv.width, h = L.cv.height, sk = HB.skins.current(), col = sk.colors[3];
    L.t += dt;
    const x = w / 2 + Math.cos(L.t * 1.5) * w * .32, y = h / 2 + Math.sin(L.t * 3) * h * .22;
    const spd = L.px == null ? 0 : Math.hypot(x - L.px, y - L.py) / Math.max(dt, .001);
    L.px = x; L.py = y;
    const tr = HB.fx.trails[L.id] || HB.fx.trails.sparks;
    tr.spawn(p => L.parts.push(p), x, y, 12, spd, dt, col, L.st);
    L.hist.push({ x, y, t: L.t }); while (L.hist.length && L.t - L.hist[0].t > (tr.keep || .32)) L.hist.shift();
    L.parts = HB.fx.update(L.parts, dt, h);
    previewBg(c, w, h);
    HB.fx.draw(c, L.parts, L.t);
    if (tr.draw) tr.draw(c, L.hist, L.t, col);
    const R = 11, S3 = Math.sqrt(3);
    [-1, 0, 1].forEach((k, i) => HB.skins.tile(c, x + k * R * S3, y, R * .93, sk.colors[(i + 2) % 6], sk, { v: i * 3 }));
  }
  function burstPreview(L, dt) {
    const c = L.c, w = L.cv.width, h = L.cv.height, sk = HB.skins.current(), cycle = 2.4;
    L.t += dt;
    const ph = L.t % cycle, cx = w / 2, cy = h * .58, R = 15, S3 = Math.sqrt(3);
    const cells = [-2, -1, 0, 1, 2].map(k => [cx + k * R * S3, cy]);
    if (ph < .6) L.fired = false;
    if (ph >= .6 && !L.fired) {
      L.fired = true;
      const api = {
        push: p => { if (p.k === 'rocket') { p.vy *= .45; p.sm = .42; p.boom = false; } else { p.vx *= .6; p.vy *= .6; p.g = (p.g || 0) * .6; } L.parts.push(p); },
        splat: (x, y, color, life = 2.6, scale = 1) => L.splats.push({ x, y, color, t: 0, life: Math.min(life, 2), r: 10 * scale })
      };
      const B = HB.fx.bursts[L.id];
      cells.forEach(([x, y], i) => {
        const col = sk.colors[i % 6];
        if (B) B.cell(api, x, y, col, { cx, cy });
        else if (!HB.skins.breakFx(api, x, y, col, i * 2)) {
          for (let n = 0; n < 4; n++) api.push({ k: 'shard', x, y, vx: (Math.random() - .5) * 300, vy: -Math.random() * 300, g: 700, t: 0, life: .8, color: col, r: 5, rot: 0, vr: 6 });
        }
      });
      if (B) B.clear(api, cx, cy, { lines: 1, silent: true });
    }
    L.parts = HB.fx.update(L.parts, dt, h);
    L.splats.forEach(s => s.t += dt); L.splats = L.splats.filter(s => s.t < s.life);
    previewBg(c, w, h);
    L.splats.forEach(s => { c.globalAlpha = .45 * (1 - s.t / s.life); c.fillStyle = s.color; c.beginPath(); c.arc(s.x, s.y, s.r, 0, Math.PI * 2); c.fill(); });
    c.globalAlpha = 1;
    if (ph < .6) {
      const pop = Math.min(1, ph / .2);
      cells.forEach(([x, y], i) => HB.skins.tile(c, x, y, R * .93 * (.6 + .4 * pop), sk.colors[i % 6], sk, { v: i * 2, flash: ph > .45 ? (ph - .45) * 4 : 0 }));
    }
    HB.fx.draw(c, L.parts, L.t);
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
  // Барабаны убраны из игры: у купивших возвращаем мёд.
  if ((HB.profile.ownedSounds || []).includes('drums')) {
    HB.profile.ownedSounds = HB.profile.ownedSounds.filter(x => x !== 'drums');
    HB.profile.honey += 200;
    if (HB.profile.sound === 'drums') HB.profile.sound = 'xylo';
    HB.saveProfile();
    setTimeout(() => toast('Набор «Барабаны» убран, 200 мёда вернули'), 1200);
  }
  if (!HB.fx.SOUNDS.some(s => s.id === HB.profile.sound)) HB.profile.sound = 'xylo';
  open('home');
  const reward = HB.touchStreak();
  if (reward > 0) setTimeout(() => open('streak'), 450);
  if (HB.isAndroid) setTimeout(() => { try { window.HexAndroid.checkUpdate(false); } catch (e) {} }, 1500);
  document.addEventListener('contextmenu', e => e.preventDefault());
})();
