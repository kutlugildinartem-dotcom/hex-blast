/* Общие утилиты, настройки, прогресс игрока (мёд, скины, серия дней, свои фигуры). */
(() => {
  'use strict';
  const HB = window.HB = window.HB || {};

  HB.util = {
    TAU: Math.PI * 2,
    clamp: (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)),
    lerp: (a, b, t) => a + (b - a) * t,
    eo: x => 1 - Math.pow(1 - x, 3),
    eio: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
    eob: x => { const k = 1.9; return 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2); },
    rand: n => Math.floor(Math.random() * n),
    rnd: (a, b) => a + Math.random() * (b - a),
    plural(n, one, few, many) {
      const m10 = n % 10, m100 = n % 100;
      if (m10 === 1 && m100 !== 11) return one;
      if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
      return many;
    },
    fmt: n => Math.round(n).toLocaleString('ru-RU')
  };

  const store = HB.store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  /* ---------- настройки ---------- */
  const SETTINGS_DEFAULT = {
    sound: true, volume: .85,
    haptics: 2,            // 0 выкл, 1 мягко, 2 сочно, 3 космос
    shake: true,
    bomb: true,            // особые соты вкл/выкл
    special: 'bomb',       // bomb | bolt | both
    bombSource: 'combo',   // combo | charge | random
    bombPower: 1,          // 1 или 2 кольца
    undo: true,
    hold: true,            // запасная ячейка слева от лотка
    customOn: true,
    customFreq: 'normal'   // rare | normal | often
  };
  HB.settings = Object.assign({}, SETTINGS_DEFAULT, store.get('hb.settings', {}));
  if (store.get('hb.muted', false) === true && !store.get('hb.settings', null)) HB.settings.sound = false;
  if (!Array.isArray(HB.settings.specials)) {
    const m = HB.settings.special;
    HB.settings.specials = m === 'both' ? ['bomb', 'bolt'] : m === 'bolt' ? ['bolt'] : ['bomb'];
  }
  HB.saveSettings = () => store.set('hb.settings', HB.settings);

  /* ---------- профиль ---------- */
  const PROFILE_DEFAULT = {
    honey: 0, owned: ['classic'], skin: 'classic',
    ownedSounds: ['xylo'], sound: 'xylo', ownedTrails: ['sparks'], trail: 'sparks', ownedBursts: ['classic'], burst: 'classic', ownedScores: ['classic'], scoreStyle: 'classic',
    games: 0, totalLines: 0,
    streak: { count: 0, last: '', claimed: '' },
    custom: []            // [{ id, cells: [[q, r], ...], on }]
  };
  HB.profile = Object.assign({}, PROFILE_DEFAULT, store.get('hb.profile', {}));
  HB.profile.streak = Object.assign({}, PROFILE_DEFAULT.streak, HB.profile.streak);
  if (!HB.profile.owned.includes('classic')) HB.profile.owned.unshift('classic');
  HB.saveProfile = () => store.set('hb.profile', HB.profile);

  HB.best = () => store.get('hb.best', 0);
  HB.setBest = v => store.set('hb.best', v);

  /* ---------- серия дней ---------- */
  const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  HB.streakReward = count => {
    const day = ((count - 1) % 7) + 1;
    return day * 10 + (day === 7 ? 50 : 0);
  };
  /** Отмечает сегодняшний заход. Возвращает награду, если её ещё не забирали сегодня. */
  HB.touchStreak = () => {
    const s = HB.profile.streak, now = new Date();
    const today = dayKey(now), y = new Date(now); y.setDate(now.getDate() - 1);
    if (s.last !== today) {
      s.count = s.last === dayKey(y) ? s.count + 1 : 1;
      s.last = today;
      HB.saveProfile();
    }
    return s.claimed === today ? 0 : HB.streakReward(s.count);
  };
  HB.claimStreak = () => {
    const s = HB.profile.streak, today = dayKey(new Date());
    if (s.claimed === today) return 0;
    const r = HB.streakReward(s.count);
    s.claimed = today;
    HB.profile.honey += r;
    HB.saveProfile();
    return r;
  };

  /* ---------- вибрация ---------- */
  const WEB_PATTERNS = {
    tick: [8], pick: [12], place: [22, 16, 12], invalid: [14, 45, 14],
    clear: [14, 16, 14, 16, 14, 16, 70], bomb: [110, 20, 40, 15, 40, 15, 40, 15, 40],
    record: [40, 55, 40, 55, 40, 55, 190], over: [130, 90, 130, 90, 280], coin: [10],
    buy: [30, 45, 30, 45, 140], streak: [40, 60, 40, 60, 110], undo: [35, 30, 35, 30, 45], combo: [28, 26, 28, 26, 28],
    sungrow: [60, 30, 140, 20, 60],
    sun: [14, 30, 14, 30, 14, 30, 380, 25, 60, 15, 60, 15, 80, 20, 100],
    freeze: [8, 40, 8, 40, 10, 40, 10, 40, 8, 40, 8],
    shatter: [70, 25, 15, 30, 12, 30, 15],
    icestorm: [10, 30, 10, 25, 12, 20, 160, 25, 60, 20, 30, 20, 40, 30, 60],
    ignite: [30, 20, 60, 20, 40],
    fire: [90, 20, 20, 40, 15, 30, 25, 50, 15, 30, 20, 60, 15],
    thunderbomb: [140, 20, 60, 25, 70, 20, 60, 30, 80, 20, 50, 40, 100, 30, 70, 60, 160],
    thunder: [45, 25, 25, 40, 60, 20, 50, 30, 70, 20, 40, 40, 90, 30, 50, 60, 120]
  };
  HB.haptic = (type, a = 0, b = 0) => {
    const level = HB.settings.haptics;
    if (!level) return;
    try {
      if (window.HexAndroid && window.HexAndroid.haptic) window.HexAndroid.haptic(type, a | 0, b | 0, level);
      else if (navigator.vibrate) navigator.vibrate(WEB_PATTERNS[type] || [10]);
    } catch (e) {}
  };

  HB.isAndroid = !!(window.HexAndroid && window.HexAndroid.haptic);
  HB.appVersion = () => { try { return window.HexAndroid ? window.HexAndroid.appVersion() : 'веб'; } catch (e) { return '?'; } };

  /* ---------- свои фигуры ---------- */
  HB.hexDist = (a, b) => (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[0] + a[1] - b[0] - b[1])) / 2;
  HB.isConnected = cells => {
    if (!cells.length) return false;
    const seen = new Set([0]), st = [0];
    while (st.length) {
      const i = st.pop();
      cells.forEach((c, j) => { if (!seen.has(j) && HB.hexDist(cells[i], c) === 1) { seen.add(j); st.push(j); } });
    }
    return seen.size === cells.length;
  };
})();
