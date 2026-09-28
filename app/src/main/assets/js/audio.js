/*
 * Звуковой движок на WebAudio: всё синтезируется на лету, без файлов.
 * Колокольчики (FM), щипки, мягкие удары и шумовые «вжухи» идут через общий
 * компрессор и лёгкую реверберацию. Ноты берутся из пентатоники, поэтому любые
 * сочетания звучат приятно, а каскад очистки звучит как ксилофон вверх по гамме.
 */
(() => {
  'use strict';
  const HB = window.HB;
  let lp = null, held = false, echo = null, musicBus = null, voices = [];
  let ac = null, master = null, verb = null, noise = null, brown = null;

  function init() {
    if (ac) return ac;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 4;
    comp.attack.value = .003; comp.release.value = .25;
    master = ac.createGain();
    master.gain.value = volume();
    lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(20000, ac.sampleRate * .45); lp.Q.value = .5;
    // Страховочный лимитер на выходе: при самых громких взрывах звук сжимается, а не хрипит.
    const lim = ac.createDynamicsCompressor();
    lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .001; lim.release.value = .12;
    master.connect(lp); lp.connect(comp); comp.connect(lim); lim.connect(ac.destination);
    // Общее пинг-понг эхо: колокольчики отправляют в него сигнал, а не синтезируют эхо заново.
    echo = ac.createGain(); echo.gain.value = 1;
    const dl = ac.createDelay(1), dr = ac.createDelay(1), fb = ac.createGain(), pl = ac.createStereoPanner(), pr = ac.createStereoPanner(), ef = ac.createBiquadFilter();
    dl.delayTime.value = .19; dr.delayTime.value = .19; fb.gain.value = .42; pl.pan.value = -.7; pr.pan.value = .7;
    ef.type = 'lowpass'; ef.frequency.value = 5200;
    echo.connect(ef); ef.connect(dl); dl.connect(pl); pl.connect(master); dl.connect(dr); dr.connect(pr); pr.connect(master); dr.connect(fb); fb.connect(dl);
    const ev = ac.createGain(); ev.gain.value = .25; dl.connect(ev); echo._ev = ev;


    const conv = ac.createConvolver();
    const len = Math.floor(ac.sampleRate * 2.2), ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    conv.buffer = ir;
    verb = ac.createGain(); verb.gain.value = .9;
    const wet = ac.createGain(); wet.gain.value = .28;
    verb.connect(conv); conv.connect(wet); wet.connect(master);
    if (echo && echo._ev) echo._ev.connect(verb);

    // Коричневый шум: глубокий раскатистый рокот для грома.
    brown = ac.createBuffer(2, ac.sampleRate * 5, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = brown.getChannelData(ch); let last = 0;
      for (let i = 0; i < d.length; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    }
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return ac;
  }
  const volume = () => HB.settings.sound ? Math.pow(HB.settings.volume, 1.5) * .9 : 0;
  function ready() {
    if (!HB.settings.sound || !init() || ac.state === 'closed') return false;
    // Android может сам приостановить звук (другое приложение, звонок, сворачивание). Возвращаем его.
    if (ac.state !== 'running' && !held) { try { ac.resume(); } catch (e) {} }
    return true;
  }
  /**
   * Бюджет голосов: телефон захлёбывается, если одновременно звучат сотни осцилляторов,
   * и звук начинает рваться. Тихие голоса отбрасываются первыми, громкие — только при перегрузе.
   */
  const MAXV = 60;
  function voice(t, dur, vol = .1, cost = 1) {
    const n0 = ac.currentTime;
    if (voices.length > 40) voices = voices.filter(e => e > n0);
    let load = 0; for (const e of voices) if (e > t) load++;
    if (load + cost > MAXV) return false;
    if (load > MAXV * .6 && vol < .045) return false;
    for (let i = 0; i < cost; i++) voices.push(t + dur);
    return true;
  }
  const now = (when = 0) => ac.currentTime + .005 + when;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const PENTA = [0, 2, 4, 7, 9];
  const penta = (i, base = 72) => base + 12 * Math.floor(i / 5) + PENTA[((i % 5) + 5) % 5];

  function out(node, pan = 0, rev = .3) {
    let n = node;
    if (!isFinite(pan)) pan = 0;
    if (ac.createStereoPanner && pan) { const p = ac.createStereoPanner(); p.pan.value = pan; n.connect(p); n = p; }
    n.connect(master);
    if (rev > 0) { const s = ac.createGain(); s.gain.value = rev; n.connect(s); s.connect(verb); }
  }
  function envGain(t, attack, peak, decay) {
    const g = ac.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, .0002), t + attack);
    g.gain.exponentialRampToValueAtTime(.0001, t + attack + decay);
    return g;
  }

  /** Стеклянный колокольчик: синус, промодулированный синусом с затухающим индексом. */
  function bell(freq, t, { vol = .16, dur = 1.1, pan = 0, rev = .45, ratio = 3.5, index = 2.2, send = 0 } = {}) {
    if (!voice(t, dur, vol)) return;
    const car = ac.createOscillator(), mod = ac.createOscillator(), mg = ac.createGain();
    car.frequency.value = freq; mod.frequency.value = freq * ratio;
    mg.gain.setValueAtTime(freq * index, t);
    mg.gain.exponentialRampToValueAtTime(freq * .01 + .01, t + dur * .6);
    mod.connect(mg); mg.connect(car.frequency);
    const g = envGain(t, .004, vol, dur);
    car.connect(g);
    const sh = ac.createOscillator(), sg = envGain(t, .002, vol * .25, dur * .35);
    sh.frequency.value = freq * 2.01; sh.connect(sg);
    out(g, pan, rev); out(sg, pan, rev);
    if (send && echo) { const s = ac.createGain(); s.gain.value = send; g.connect(s); s.connect(echo); }
    [car, mod, sh].forEach(o => { o.start(t); o.stop(t + dur + .05); });
  }
  /** Сочный щипок: треугольник + пила через закрывающийся фильтр. */
  function pluck(freq, t, { vol = .14, dur = .4, pan = 0, rev = .3, bright = 5000 } = {}) {
    if (!voice(t, dur, vol)) return;
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter();
    o1.type = 'triangle'; o2.type = 'sawtooth';
    o1.frequency.value = freq; o2.frequency.value = freq * 1.003;
    f.type = 'lowpass'; f.Q.value = 4;
    f.frequency.setValueAtTime(bright, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.2, 200), t + dur * .7);
    const g = envGain(t, .003, vol, dur), g2 = ac.createGain(); g2.gain.value = .35;
    o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g);
    out(g, pan, rev);
    [o1, o2].forEach(o => { o.start(t); o.stop(t + dur + .05); });
  }
  /** Пузырёк: синус, быстро взлетающий по высоте. */
  function bubble(t, f0 = 480, { vol = .16, rise = 2.3, dur = .12, pan = 0 } = {}) {
    const o = ac.createOscillator();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * rise, t + dur * .8);
    const g = envGain(t, .004, vol, dur);
    o.connect(g); out(g, pan, .2);
    o.start(t); o.stop(t + dur + .05);
  }
  /** Мягкий удар «в подушку»: падающий синус и щелчок шума. */
  function thud(t, { vol = .5, from = 170, to = 48, dur = .2 } = {}) {
    const o = ac.createOscillator();
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = envGain(t, .003, vol, dur);
    o.connect(g); out(g, 0, .08);
    noiseHit(t, { vol: vol * .35, dur: .045, freq: 1400, type: 'lowpass' });
    o.start(t); o.stop(t + dur + .05);
  }
  function noiseHit(t, { vol = .2, dur = .2, freq = 2000, to = 0, type = 'lowpass', q = 1, pan = 0, rev = .15, attack = .003 } = {}) {
    const s = ac.createBufferSource(); s.buffer = noise; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = envGain(t, attack, vol, dur);
    s.connect(f); f.connect(g); out(g, pan, rev);
    s.start(t); s.stop(t + attack + dur + .05);
  }
  /**
   * Хруст льда и снега: один шумовой поток, громкость которого рвано прыгает каждые 6–25 мс,
   * а полоса фильтра блуждает. Получается зернистый живой хруст, а не щелчки.
   */
  function crunch(t, dur, { vol = .3, lo = 900, hi = 3200, dens = 1, pan = 0, rise = 0 } = {}) {
    const s = ac.createBufferSource(); s.buffer = noise; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.3;
    const f2 = ac.createBiquadFilter(); f2.type = 'highshelf'; f2.frequency.value = 3500; f2.gain.value = -6;
    const g = ac.createGain(); g.gain.setValueAtTime(0, t);
    let tt = t;
    while (tt < t + dur) {
      const k = (tt - t) / dur, env = Math.sin(Math.PI * Math.min(1, k * 1.2 + .05));
      const on = Math.random() < .55 * dens;
      g.gain.setTargetAtTime(on ? vol * env * (.35 + Math.random() * .65) : vol * env * .03, tt, .003);
      f.frequency.setValueAtTime(lo + Math.random() * (hi - lo) * (1 + rise * k), tt);
      tt += .006 + Math.random() * .019 / dens;
    }
    g.gain.setTargetAtTime(0, t + dur, .01);
    s.connect(f); f.connect(f2); f2.connect(g); out(g, pan, .25);
    s.start(t); s.stop(t + dur + .1);
  }
  /** Звонкий «пиу» трещины во льду: короткий падающий тон, как на замёрзшем озере. */
  function icePing(t, { vol = .05, from = 2600, to = 500, dur = .09, pan = 0 } = {}) {
    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = envGain(t, .002, vol, dur * 1.4); o.connect(g); out(g, pan, .5); o.start(t); o.stop(t + dur * 1.6);
  }
  /** Мягкое насыщение (tanh): делает взрыв «рваным» и плотным, но без цифрового хрипа. */
  let shaperCurve = null;
  function shaper(k = 6) {
    if (!shaperCurve) {
      const n = 2048; shaperCurve = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; shaperCurve[i] = Math.tanh(k * x) / Math.tanh(k); }
    }
    const w = ac.createWaveShaper(); w.curve = shaperCurve; w.oversample = '2x';
    return w;
  }
  /** Раскатистый рокот коричневого шума: основа грома. */
  function rumble(t, len, peak) {
    const s = ac.createBufferSource(); s.buffer = brown;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = .7;
    f.frequency.setValueAtTime(1100, t); f.frequency.exponentialRampToValueAtTime(65, t + len);
    const g = ac.createGain();
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + .08);
    let tt = t + .08, lvl = peak;
    while (tt < t + len * .88) {
      tt += .1 + Math.random() * .28;
      lvl *= .74 + Math.random() * .3;
      g.gain.exponentialRampToValueAtTime(Math.max(.0003, lvl * (.45 + Math.random() * .75)), tt);
    }
    g.gain.exponentialRampToValueAtTime(.0001, t + len);
    s.connect(f); f.connect(g); out(g, 0, 1);
    s.start(t); s.stop(t + len + .1);
  }
  function pad(freqs, t, { vol = .06, attack = .08, dur = 1.2 } = {}) {
    freqs.forEach((fr, i) => {
      const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
      o.detune.value = (i % 2 ? 7 : -7);
      const g = envGain(t, attack, vol, dur);
      o.connect(g); out(g, (i - 1) * .3, .6);
      o.start(t); o.stop(t + attack + dur + .05);
    });
  }

  /* ---------- инструменты для наборов звуков ---------- */
  let pulseWave = null;
  function pulse() {
    if (pulseWave) return pulseWave;
    const n = 32, re = new Float32Array(n), im = new Float32Array(n), d = .25;
    for (let i = 1; i < n; i++) { re[i] = 2 / (i * Math.PI) * Math.sin(2 * Math.PI * i * d); im[i] = 2 / (i * Math.PI) * (1 - Math.cos(2 * Math.PI * i * d)); }
    pulseWave = ac.createPeriodicWave(re, im);
    return pulseWave;
  }
  /** Квадратная 25%-волна старых приставок; blip — короткий скачок на октаву в атаке. */
  function chip(freq, t, { vol = .06, dur = .14, pan = 0, blip = true, tri = false } = {}) {
    if (!voice(t, dur, vol)) return;
    const o = ac.createOscillator();
    if (tri) o.type = 'triangle'; else o.setPeriodicWave(pulse());
    o.frequency.setValueAtTime(blip ? freq * 2 : freq, t);
    if (blip) o.frequency.setValueAtTime(freq, t + .018);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol * .7, t + dur * .5); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); out(g, pan, .08);
    o.start(t); o.stop(t + dur + .02);
  }
  /** Рояль: обертоны с лёгкой негармоничностью струны, фильтр закрывается, стук молоточка. */
  function piano(freq, t, { vol = .1, dur = 1.8, pan = 0 } = {}) {
    if (!voice(t, dur, vol, 2)) return;
    const f = ac.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(Math.min(9000, freq * 10), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 2.2), t + .6);
    const bus = ac.createGain(); f.connect(bus); out(bus, pan, .35);
    [1, 2, 3, 4, 5, 6].forEach((n, i) => {
      const o = ac.createOscillator();
      o.frequency.value = freq * n * Math.sqrt(1 + .0004 * n * n); o.detune.value = i % 2 ? 3 : -3;
      const d = dur / Math.pow(n, .6), g = envGain(t, .003, vol * [1, .5, .28, .14, .08, .04][i], d);
      o.connect(g); g.connect(f);
      o.start(t); o.stop(t + d + .05);
    });
    noiseHit(t, { vol: vol * .25, dur: .02, freq: 2500, type: 'bandpass', q: 1, rev: .1, attack: .001, pan });
  }
  /**
   * Войлочное пианино: мягкий молоточек, тёплый приглушённый тембр, длинный хвост в реверберации.
   * Тихое и чуть «пыльное», как в спокойных играх-песочницах.
   */
  function felt(freq, t, { vol = .09, dur = 3, pan = 0, dest = null, rev = .75, budget = true, bright = 5, attack = .012 } = {}) {
    if (budget && !voice(t, Math.min(dur, 2.5), vol)) return;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = .3;
    f.frequency.setValueAtTime(Math.min(5000, freq * bright), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(300, freq * 1.3), t + dur * .5);
    const g = ac.createGain();
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setTargetAtTime(vol * .45, t + .02, .25); g.gain.setTargetAtTime(.0001, t + .5, dur * .32);
    f.connect(g);
    [[1, 'triangle', 0, 1], [1, 'sine', 5, .6], [2, 'sine', -4, .22], [3, 'sine', 3, .06]].forEach(([m, type, det, a]) => {
      const o = ac.createOscillator(), og = ac.createGain(); o.type = type; o.frequency.value = freq * m; o.detune.value = det; og.gain.value = a;
      o.connect(og); og.connect(f); o.start(t); o.stop(t + dur + .6);
    });
    if (dest) { let n = g; if (pan) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); n = p; } n.connect(dest); const s = ac.createGain(); s.gain.value = rev; n.connect(s); s.connect(verb); }
    else out(g, pan, rev);
  }
  /** Хрустальный колокольчик с негармоничным спектром и пинг-понг эхом. */
  function glassBell(freq, t, { vol = .06, dur = 2.4, pan = 0 } = {}) {
    // Один удар + общее эхо-шина: звучит так же, а нагрузка в шесть раз меньше.
    bell(freq, t, { vol, dur, pan, rev: .6, ratio: 2.756, index: .9, send: .55 });
    bell(freq * 2, t + .002, { vol: vol * .3, dur: dur * .5, pan, rev: .6, ratio: 5.4, index: .5, send: .4 });
  }
  /** Калимба: металлический язычок — чистый тон, короткий звон атаки и мягкий обертон. */
  function kalimba(freq, t, { vol = .13, pan = 0, dur = 1.5 } = {}) {
    if (!voice(t, dur, vol)) return;
    const o = ac.createOscillator();
    o.frequency.setValueAtTime(freq * 1.012, t); o.frequency.exponentialRampToValueAtTime(freq, t + .03);
    const g = envGain(t, .002, vol, dur); o.connect(g); out(g, pan, .45);
    const o2 = ac.createOscillator(); o2.frequency.value = freq * 5.4;
    const g2 = envGain(t, .001, vol * .3, .06); o2.connect(g2); out(g2, pan, .2);
    const o3 = ac.createOscillator(); o3.frequency.value = freq * 2.97;
    const g3 = envGain(t, .002, vol * .16, .4); o3.connect(g3); out(g3, pan, .35);
    [[o, dur], [o2, .1], [o3, .45]].forEach(([x, d]) => { x.start(t); x.stop(t + d + .05); });
  }
  /** Арфа: физическая модель щипка струны (Карплус–Стронг). Буферы кэшируются по высоте ноты. */
  const ksCache = new Map();
  function ksBuffer(freq) {
    const key = Math.round(freq * 4);
    let b = ksCache.get(key);
    if (b) return b;
    const sr = ac.sampleRate, len = Math.floor(sr * 2.4), N = Math.max(2, Math.round(sr / freq));
    b = ac.createBuffer(1, len, sr);
    const d = b.getChannelData(0), ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    for (let i = 1; i < N; i++) ring[i] = (ring[i] + ring[i - 1]) * .5;
    const damp = .997 - Math.min(.01, freq / 80000);
    let idx = 0;
    for (let i = 0; i < len; i++) { const nx = (idx + 1) % N, v = ring[idx]; d[i] = v; ring[idx] = damp * .5 * (v + ring[nx]); idx = nx; }
    if (ksCache.size > 80) ksCache.clear();
    ksCache.set(key, b);
    return b;
  }
  function harp(freq, t, { vol = .24, pan = 0 } = {}) {
    if (!voice(t, 1.5, vol * .4)) return;
    const s = ac.createBufferSource(); s.buffer = ksBuffer(freq);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.min(7000, freq * 7);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + 2); g.gain.linearRampToValueAtTime(0, t + 2.35);
    s.connect(f); f.connect(g); out(g, pan, .5);
    s.start(t); s.stop(t + 2.4);
  }
  /** Родес: FM-электропиано с «колокольчиком» атаки, тремоло и тёплым фильтром. */
  function rhodes(freq, t, { vol = .09, pan = 0, dur = 1.8, soft = 0 } = {}) {
    if (!voice(t, dur, vol)) return;
    const car = ac.createOscillator(), mod = ac.createOscillator(), mg = ac.createGain();
    car.frequency.value = freq; mod.frequency.value = freq;
    mg.gain.setValueAtTime(freq * (soft ? .55 : 1.3), t); mg.gain.exponentialRampToValueAtTime(freq * (soft ? .06 : .12), t + .5);
    mod.connect(mg); mg.connect(car.frequency);
    const tine = ac.createOscillator(), tg = envGain(t, soft ? .004 : .001, vol * (soft ? .05 : .22), .12); tine.frequency.value = freq * 14; tine.connect(tg);
    const trem = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = soft ? 3.2 : 4.8; lg.gain.value = soft ? .1 : .16; trem.gain.value = soft ? .9 : .84; lfo.connect(lg); lg.connect(trem.gain);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = soft ? 1300 : 2600;
    const g = envGain(t, soft ? .02 : .004, vol, dur);
    car.connect(g); g.connect(trem); trem.connect(f); out(f, pan, .35); out(tg, pan, .1);
    [car, mod, tine, lfo].forEach(o => { o.start(t); o.stop(t + dur + .1); });
  }
  /** Глубокий синт: две расстроенные пилы через резонансный фильтр, с эхом отдельными отражениями. */
  function synthPluck(freq, t, { vol = .07, pan = 0, dur = .7, cutoff = 2600, echo = true } = {}) {
    if (!voice(t, dur, vol)) return;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 5;
    f.frequency.setValueAtTime(250, t); f.frequency.exponentialRampToValueAtTime(cutoff, t + .015);
    f.frequency.exponentialRampToValueAtTime(Math.max(300, freq * 1.5), t + dur * .8);
    const g = envGain(t, .004, vol, dur); f.connect(g); out(g, pan, .55);
    [-9, 9].forEach(dt => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = dt; o.connect(f); o.start(t); o.stop(t + dur + .05); });
    if (echo) {
      synthPluck(freq, t + .24, { vol: vol * .35, pan: -pan * .8 || .4, dur, cutoff: cutoff * .6, echo: false });
    }
  }
  function synthPad(freqs, t, { vol = .045, attack = .12, dur = 1.8 } = {}) {
    const f = ac.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1900, t + attack + .3); f.frequency.exponentialRampToValueAtTime(450, t + attack + dur);
    const g = envGain(t, attack, vol, dur); f.connect(g); out(g, 0, .75);
    freqs.forEach((fr, i) => [-12, 0, 12].forEach(dt => {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = dt + (i % 2 ? 3 : -3);
      o.connect(f); o.start(t); o.stop(t + attack + dur + .1);
    }));
  }
  /** Ханг: глубокий стальной купол — долгий основной тон с «биениями», мягкий суб и сияющие обертоны. */
  function handpan(freq, t, { vol = .12, pan = 0, dur = 4.5 } = {}) {
    if (!voice(t, Math.min(dur, 2.5), vol)) return;
    [[1, 1, dur, 0], [1, .5, dur * .9, 1.3], [2.002, .28, dur * .75, -.9], [2.99, .09, dur * .45, .6], [.5, .18, dur * .8, 0]].forEach(([r, a, d, beat], i) => {
      const o = ac.createOscillator();
      o.frequency.setValueAtTime(freq * r * (i ? 1 : 1.004) + beat, t);
      if (!i) o.frequency.exponentialRampToValueAtTime(freq, t + .1);
      const g = envGain(t, .008, vol * a, d); o.connect(g); out(g, pan + (i === 1 ? .3 : i === 2 ? -.3 : 0), .8);
      o.start(t); o.stop(t + d + .05);
    });
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq * 2; f.Q.value = 9;
    const s = ac.createBufferSource(); s.buffer = noise; s.loop = true;
    const g2 = envGain(t, .01, vol * .5, dur * .5); s.connect(f); f.connect(g2); out(g2, pan, .9); s.start(t); s.stop(t + dur * .5 + .05);
    noiseHit(t, { vol: vol * .1, dur: .03, freq: 700, type: 'bandpass', q: 2, rev: .3, attack: .002, pan });
  }
  /** Маримба: тёплый тон + обертон 4× (свойство бруска) + мягкий стук колотушки. */
  function marimba(freq, t, { vol = .13, pan = 0, dur = 1.1 } = {}) {
    if (!voice(t, dur, vol)) return;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.min(6000, freq * 6);
    const bus = ac.createGain(); f.connect(bus); out(bus, pan, .35);
    [[1, 1, dur], [3.93, .28, dur * .18], [9.2, .06, .05]].forEach(([r, a, d]) => {
      const o = ac.createOscillator(); o.frequency.value = freq * r;
      const g = envGain(t, .002, vol * a, d); o.connect(g); g.connect(f);
      o.start(t); o.stop(t + d + .05);
    });
    noiseHit(t, { vol: vol * .15, dur: .012, freq: 1200, type: 'bandpass', q: 1.2, rev: .1, attack: .001, pan });
  }
  /** Суббас: глубокий синус, опционально с проседанием высоты. */
  function sub(t, from, to, vol = .4, dur = .8) {
    const o = ac.createOscillator();
    o.frequency.setValueAtTime(from, t); if (to !== from) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = envGain(t, .012, vol, dur); o.connect(g); out(g, 0, .05);
    o.start(t); o.stop(t + dur + .05);
  }

  /* Наборы: каждый умеет сыграть ноту каскада, аккорд очистки, постановку, комбо и т. д. */
  const PACKS = {
    xylo: {
      note(m, t, pan, k) { (k % 2 ? bell : pluck)(mtof(m), t, k % 2 ? { vol: .07, dur: .5, pan, rev: .4 } : { vol: .09, dur: .3, pan, bright: 6000 }); },
      chord(root, t, lines) {
        pad([mtof(root), mtof(root + 4), mtof(root + 7), mtof(root + 12)], t, { vol: .045 + lines * .012, dur: .9 + lines * .2 });
        bell(mtof(root + 24), t + .05, { vol: .08, dur: 1.4 });
        if (lines > 1) { thud(t, { vol: .45, from: 120, to: 36, dur: .35 }); [28, 31, 36].forEach((st, i) => bell(mtof(root + st), t + .25 + i * .07, { vol: .06, dur: 1.2, pan: (i - 1) * .5 })); }
        noiseHit(t, { vol: .06 + lines * .02, dur: .5, freq: 9000, to: 1500, type: 'bandpass', q: .8, rev: .4 });
      },
      place(n, pan, t) { thud(t, { vol: .55 }); pluck(mtof(penta(n + 2, 60)), t + .01, { vol: .09, dur: .25, pan, bright: 2400 }); pluck(mtof(penta(n + 4, 72)), t + .05, { vol: .05, dur: .2, pan, bright: 3000 }); },
      combo(n, t) { for (let i = 0; i < Math.min(n + 1, 7); i++) bell(mtof(penta(i + n * 2, 76)), t + i * .045, { vol: .06, dur: .6, pan: (i % 2 ? .4 : -.4) }); },
      refill(t) { [0, 2, 4].forEach((k, i) => bell(mtof(penta(k + 5, 72)), t + i * .06, { vol: .045, dur: .5, pan: (i - 1) * .5 })); },
      record(t) { [72, 76, 79, 84, 88, 91, 96].forEach((m, i) => bell(mtof(m), t + i * .075, { vol: .09, dur: 1.2, pan: (i - 3) * .2 })); pad([mtof(60), mtof(64), mtof(67), mtof(72)], t + .45, { vol: .07, dur: 1.6 }); },
      over(t) { [79, 74, 71, 67, 62].forEach((m, i) => pluck(mtof(m), t + i * .16, { vol: .09, dur: .5, bright: 2400 })); pad([mtof(55), mtof(59), mtof(62)], t + .3, { vol: .05, attack: .3, dur: 2 }); }
    },
    glass: {
      note(m, t, pan) { glassBell(mtof(m + 12), t, { vol: .05, dur: 1.8, pan }); },
      chord(root, t, lines) {
        [0, 4, 7, 11, 14].forEach((st, i) => glassBell(mtof(root + 12 + st), t + i * .04, { vol: .034, dur: 2.6, pan: (i - 2) * .25 }));
        if (lines > 1) pad([mtof(root), mtof(root + 7), mtof(root + 12)], t, { vol: .04, attack: .25, dur: 2.2 });
        noiseHit(t, { vol: .05, dur: 1.2, freq: 9000, to: 14000, type: 'highpass', rev: .7 });
      },
      place(n, pan, t) { thud(t, { vol: .3, from: 140, to: 60, dur: .15 }); glassBell(mtof(penta(n + 5, 72)), t, { vol: .04, dur: 1, pan }); },
      combo(n, t) { for (let i = 0; i < Math.min(n + 2, 8); i++) glassBell(mtof(penta(i + n * 2, 79)), t + i * .06, { vol: .033, dur: 1.2, pan: (i % 2 ? .5 : -.5) }); },
      refill(t) { [0, 2, 4].forEach((k, i) => glassBell(mtof(penta(k + 7, 79)), t + i * .07, { vol: .028, dur: 1 })); },
      record(t) { [84, 88, 91, 96, 100, 103].forEach((m, i) => glassBell(mtof(m), t + i * .08, { vol: .05, dur: 2 })); pad([mtof(60), mtof(67), mtof(76)], t + .4, { vol: .05, dur: 2 }); },
      over(t) { [91, 86, 83, 79, 74].forEach((m, i) => glassBell(mtof(m), t + i * .2, { vol: .04, dur: 1.8 })); }
    },
    chip: {
      note(m, t, pan) { chip(mtof(m + 12), t, { vol: .05, dur: .1, pan }); },
      chord(root, t, lines) {
        const r = root + 12;
        [0, 4, 7, 12, 16, 19, 24].forEach((st, i) => chip(mtof(r + st), t + .05 + i * .035, { vol: .045, dur: .07, blip: false }));
        chip(mtof(root - 12), t, { vol: .09, dur: .3, tri: true, blip: false });
        if (lines > 1) [0, 7, 12].forEach((st, i) => chip(mtof(r + 12 + st), t + .35 + i * .06, { vol: .045, dur: .12 }));
      },
      place(n, pan, t) {
        const o = ac.createOscillator(); o.type = 'triangle';
        o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(55, t + .09);
        const g = ac.createGain(); g.gain.setValueAtTime(.35, t); g.gain.linearRampToValueAtTime(0, t + .12);
        o.connect(g); out(g, pan, 0); o.start(t); o.stop(t + .14);
        noiseHit(t, { vol: .08, dur: .03, freq: 4000, type: 'highpass', rev: 0, attack: .001 });
      },
      combo(n, t) { for (let i = 0; i < Math.min(n + 2, 8); i++) chip(mtof(penta(i + n * 2, 84)), t + i * .045, { vol: .045, dur: .06, pan: (i % 2 ? .5 : -.5) }); },
      refill(t) { [72, 79, 84].forEach((m, i) => chip(mtof(m), t + i * .05, { vol: .04, dur: .06 })); },
      record(t) { [72, 76, 79, 84, 79, 84, 88, 91, 96].forEach((m, i) => chip(mtof(m), t + i * .07, { vol: .05, dur: .09 })); [48, 55, 60].forEach((m, i) => chip(mtof(m), t + i * .21, { vol: .09, dur: .2, tri: true, blip: false })); },
      over(t) { [72, 67, 64, 60, 55, 52, 48].forEach((m, i) => chip(mtof(m), t + i * .1, { vol: .05, dur: .12, blip: false })); }
    },
    piano: {
      note(m, t, pan) { piano(mtof(m), t, { vol: .07, dur: 1.2, pan }); },
      chord(root, t, lines) {
        [0, 4, 7, 11, 14].forEach((st, i) => piano(mtof(root - 12 + st), t + i * .018, { vol: .06, dur: 2.4 }));
        piano(mtof(root - 24), t, { vol: .08, dur: 2.6 });
        if (lines > 1) [19, 23, 26].forEach((st, i) => piano(mtof(root + st), t + .3 + i * .1, { vol: .05, dur: 1.6 }));
      },
      place(n, pan, t) { thud(t, { vol: .3, from: 130, to: 55, dur: .15 }); piano(mtof(penta(n, 55)), t, { vol: .05, dur: .6, pan }); },
      combo(n, t) { for (let i = 0; i < Math.min(n + 1, 7); i++) piano(mtof(penta(i + n * 2, 72)), t + i * .07, { vol: .05, dur: .9, pan: (i % 2 ? .4 : -.4) }); },
      refill(t) { [0, 2, 4].forEach((k, i) => piano(mtof(penta(k + 5, 72)), t + i * .08, { vol: .03, dur: .6 })); },
      record(t) { [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => piano(mtof(m), t + i * .09, { vol: .06, dur: 2 })); [36, 43, 48].forEach(m => piano(mtof(m), t + .63, { vol: .06, dur: 3 })); },
      over(t) { [72, 67, 63, 60].forEach((m, i) => piano(mtof(m), t + i * .25, { vol: .06, dur: 1.6 })); piano(mtof(48), t + 1, { vol: .06, dur: 3 }); piano(mtof(51), t + 1, { vol: .05, dur: 3 }); }
    },
    kalimba: {
      note(m, t, pan) { kalimba(mtof(m), t, { vol: .12, pan }); },
      chord(root, t, lines) {
        [0, 4, 7, 12, 16].forEach((st, i) => kalimba(mtof(root + st), t + i * .07, { vol: .085, pan: (i - 2) * .25 }));
        sub(t, mtof(root - 24), mtof(root - 24), .22, 1.3);
        if (lines > 1) [19, 24, 28].forEach((st, i) => kalimba(mtof(root + st), t + .4 + i * .08, { vol: .07, dur: 1.2 }));
      },
      place(n, pan, t) { thud(t, { vol: .28, from: 140, to: 60, dur: .14 }); kalimba(mtof(penta(n, 55)), t, { vol: .11, pan, dur: 1 }); },
      combo(n, t) { for (let i = 0; i < Math.min(n + 3, 9); i++) kalimba(mtof(penta(i + n * 2, 72)), t + i * .05, { vol: .07, dur: .9, pan: (i % 2 ? .45 : -.45) }); },
      refill(t) { [0, 2, 4].forEach((k, i) => kalimba(mtof(penta(k + 5, 72)), t + i * .07, { vol: .05, dur: .7 })); },
      record(t) { [60, 64, 67, 72, 76, 79, 84, 88].forEach((m, i) => kalimba(mtof(m), t + i * .08, { vol: .09, dur: 1.6, pan: (i - 3.5) * .15 })); sub(t + .6, mtof(36), mtof(36), .3, 1.8); },
      over(t) { [79, 74, 71, 67, 62].forEach((m, i) => kalimba(mtof(m), t + i * .22, { vol: .08, dur: 1.4 })); sub(t + .8, mtof(38), mtof(31), .25, 1.6); }
    },
    harp: {
      note(m, t, pan) { harp(mtof(m), t, { vol: .2, pan }); },
      chord(root, t, lines) {
        for (let i = 0; i < 8; i++) harp(mtof(penta(i, root)), t + i * .03, { vol: .13, pan: (i - 3.5) * .15 });
        harp(mtof(root - 12), t, { vol: .22 });
        sub(t, mtof(root - 24), mtof(root - 24), .18, 1.4);
        if (lines > 1) for (let i = 0; i < 8; i++) harp(mtof(penta(i + 5, root)), t + .35 + i * .03, { vol: .1, pan: (i - 3.5) * .2 });
      },
      place(n, pan, t) { thud(t, { vol: .22, from: 120, to: 55, dur: .12 }); harp(mtof(penta(n, 48)), t, { vol: .24, pan }); },
      combo(n, t) { for (let i = 0; i < Math.min(n + 4, 12); i++) harp(mtof(penta(i + n, 67)), t + i * .035, { vol: .12, pan: (i % 2 ? .4 : -.4) }); },
      refill(t) { [0, 2, 4].forEach((k, i) => harp(mtof(penta(k + 5, 72)), t + i * .07, { vol: .08 })); },
      record(t) { for (let i = 0; i < 14; i++) harp(mtof(penta(i, 60)), t + i * .045, { vol: .14, pan: (i - 7) * .1 }); harp(mtof(36), t + .65, { vol: .25 }); },
      over(t) { for (let i = 9; i >= 0; i--) harp(mtof(penta(i, 55)), t + (9 - i) * .09, { vol: .13 }); }
    },
    rhodes: {
      // Лоу-фай: мягкий Родес, приглушённый фильтром, медленное тремоло, мало нот и много воздуха.
      maxNotes: 6,
      note(m, t, pan, k) { rhodes(mtof(m - 5), t + k * .05, { vol: .032, pan, dur: 1.6, soft: 1 }); },
      chord(root, t, lines) {
        [0, 4, 7, 11, 14].forEach((st, i) => rhodes(mtof(root - 12 + st), t + .05 + i * .06, { vol: .026, dur: 3, pan: (i - 2) * .2, soft: 1 }));
        rhodes(mtof(root - 24), t, { vol: .035, dur: 3.2, soft: 1 });
        noiseHit(t, { vol: .012, dur: 1.4, freq: 900, type: 'lowpass', rev: .2, attack: .3 });
        if (lines > 1) [19, 21, 26].forEach((st, i) => rhodes(mtof(root + st - 12), t + .5 + i * .2, { vol: .022, dur: 2, soft: 1 }));
      },
      place(n, pan, t) { rhodes(mtof(penta(n, 48)), t, { vol: .03, pan, dur: 1, soft: 1 }); },
      combo(n, t) { for (let i = 0; i < Math.min(n + 1, 4); i++) rhodes(mtof(penta(i + n * 2, 67)), t + .2 + i * .16, { vol: .022, dur: 1.4, pan: (i % 2 ? .35 : -.35), soft: 1 }); },
      refill(t) { rhodes(mtof(79), t, { vol: .015, dur: .8, soft: 1 }); },
      record(t) { [60, 64, 67, 71, 74, 79].forEach((m, i) => rhodes(mtof(m), t + i * .18, { vol: .032, dur: 2.4, soft: 1 })); rhodes(mtof(36), t + .9, { vol: .04, dur: 3.5, soft: 1 }); },
      over(t) { [72, 67, 63, 58].forEach((m, i) => rhodes(mtof(m), t + i * .38, { vol: .03, dur: 2.2, soft: 1 })); rhodes(mtof(44), t + 1.4, { vol: .035, dur: 3.5, soft: 1 }); }
    },
    handpan: {
      note(m, t, pan) { handpan(mtof(m - 24), t, { vol: .085, pan, dur: 3 }); },
      chord(root, t, lines) {
        [0, 7, 12, 16].forEach((st, i) => handpan(mtof(root - 24 + st), t + i * .1, { vol: .08, dur: 4.5, pan: (i - 1.5) * .3 }));
        handpan(mtof(root - 36), t, { vol: .12, dur: 5 });
        if (lines > 1) [19, 24].forEach((st, i) => handpan(mtof(root + st - 12), t + .45 + i * .15, { vol: .06, dur: 2.4 }));
      },
      place(n, pan, t) { thud(t, { vol: .22, from: 110, to: 50, dur: .14 }); handpan(mtof(penta(n, 48)), t, { vol: .09, pan, dur: 1.8 }); },
      combo(n, t) { for (let i = 0; i < Math.min(n + 2, 8); i++) handpan(mtof(penta(i + n * 2, 60)), t + i * .09, { vol: .06, dur: 1.8, pan: (i % 2 ? .45 : -.45) }); },
      refill(t) { [0, 2, 4].forEach((k, i) => handpan(mtof(penta(k + 5, 60)), t + i * .09, { vol: .04, dur: 1.4 })); },
      record(t) { [48, 55, 60, 64, 67, 72, 76].forEach((m, i) => handpan(mtof(m), t + i * .12, { vol: .08, dur: 3 })); },
      over(t) { [67, 62, 60, 55, 50].forEach((m, i) => handpan(mtof(m), t + i * .3, { vol: .07, dur: 2.6 })); }
    },
    marimba: {
      note(m, t, pan) { marimba(mtof(m - 12), t, { vol: .12, pan }); },
      chord(root, t, lines) {
        [0, 4, 7, 12].forEach((st, i) => marimba(mtof(root - 12 + st), t + i * .05, { vol: .1, pan: (i - 1.5) * .3, dur: 1.4 }));
        marimba(mtof(root - 24), t, { vol: .14, dur: 1.8 });
        sub(t, mtof(root - 24), mtof(root - 24), .15, 1.2);
        if (lines > 1) for (let i = 0; i < 6; i++) marimba(mtof(penta(i + 5, root - 12)), t + .3 + i * .05, { vol: .08 });
      },
      place(n, pan, t) { thud(t, { vol: .25, from: 120, to: 55, dur: .12 }); marimba(mtof(penta(n, 43)), t, { vol: .13, pan, dur: 1.2 }); },
      combo(n, t) { for (let i = 0; i < Math.min(n + 3, 10); i++) marimba(mtof(penta(i + n * 2, 60)), t + i * .055, { vol: .08, pan: (i % 2 ? .45 : -.45) }); },
      refill(t) { [0, 2, 4].forEach((k, i) => marimba(mtof(penta(k + 5, 60)), t + i * .07, { vol: .06 })); },
      record(t) { for (let i = 0; i < 10; i++) marimba(mtof(penta(i, 55)), t + i * .07, { vol: .1 }); marimba(mtof(36), t + .7, { vol: .15, dur: 2 }); },
      over(t) { [67, 62, 59, 55, 50].forEach((m, i) => marimba(mtof(m), t + i * .2, { vol: .1, dur: 1.4 })); }
    },
    synth: {
      note(m, t, pan) { synthPluck(mtof(m), t, { vol: .055, pan }); },
      chord(root, t, lines) {
        synthPad([mtof(root - 12), mtof(root - 5), mtof(root + 4), mtof(root + 11)], t, { vol: .04 + lines * .01, dur: 1.6 + lines * .3 });
        sub(t, mtof(root - 12), mtof(root - 24), .5, .9);
        if (lines > 1) { noiseHit(t, { vol: .08, dur: .8, freq: 300, to: 6000, type: 'bandpass', q: 3, rev: .6, attack: .3 }); [12, 16, 19, 24].forEach((st, i) => synthPluck(mtof(root + st), t + .3 + i * .09, { vol: .04, cutoff: 4000 })); }
      },
      place(n, pan, t) { sub(t, 110, 42, .45, .32); synthPluck(mtof(penta(n, 48)), t, { vol: .05, pan, cutoff: 900, echo: false }); },
      combo(n, t) { for (let i = 0; i < Math.min(n + 3, 10); i++) synthPluck(mtof(penta(i + n * 2, 72)), t + i * .06, { vol: .035, cutoff: 1500 + i * 400, pan: (i % 2 ? .5 : -.5), echo: i === Math.min(n + 3, 10) - 1 }); },
      refill(t) { [0, 2, 4].forEach((k, i) => synthPluck(mtof(penta(k + 5, 72)), t + i * .07, { vol: .025, echo: false })); },
      record(t) { synthPad([mtof(48), mtof(55), mtof(64), mtof(71)], t, { vol: .06, attack: .3, dur: 2.5 }); [72, 76, 79, 83, 84, 88, 91, 96].forEach((m, i) => synthPluck(mtof(m), t + .2 + i * .08, { vol: .04, cutoff: 5000, echo: false })); sub(t, 110, 36, .5, 1.5); },
      over(t) { synthPad([mtof(45), mtof(52), mtof(60)], t, { vol: .05, attack: .4, dur: 2.5 }); sub(t + .2, 90, 30, .4, 2); }
    }
  };
  /**
   * Спокойные наборы в духе тихих песочниц: вместо каскада нот каждая очистка продолжает
   * свою медленную мелодию на несколько нот, под ней мягкий аккорд. Всё очень тихо и тепло.
   */
  function calmPack(mel, chords, { bright = 3, attack = .03, gap = .26, vol = .03, low = 0 } = {}) {
    let pos = 0, ci = 0;
    const take = n => { const out = []; for (let i = 0; i < n; i++) out.push(mel[(pos + i) % mel.length]); pos = (pos + n) % mel.length; return out; };
    const tone = (m, t, v, d, pan = 0) => felt(mtof(m + low), t, { vol: v, dur: d, pan, rev: .95, bright, attack });
    const chordAt = (t, v) => { const [root, iv] = chords[ci++ % chords.length]; tone(root - 12, t, v * 1.1, 4.5); iv.slice(1).forEach((st, i) => tone(root + st, t + .15 + i * .12, v * .6, 4, (i - 1) * .3)); };
    return {
      maxNotes: 0,
      note() {},
      clear(t, lines, combo) {
        const n = Math.min(3 + lines + Math.min(combo - 1, 2), 7);
        // Фраза с живым ритмом: иногда нота задерживается, как у пианиста, который не спешит.
        let tt = t + .05;
        take(n).forEach((m, i) => { tone(m, tt, vol, 3, i % 2 ? .22 : -.22); tt += gap * (i % 3 === 2 ? 1.7 : 1); });
        chordAt(t, vol * .7);
      },
      chord() {},
      place(n, pan, t) { const [root, iv] = chords[ci % chords.length]; tone(root + 12 + iv[n % iv.length], t, vol * .55, 1.8, pan); },
      combo(n, t) { take(Math.min(n, 3)).forEach((m, i) => tone(m + 12, t + .5 + i * gap, vol * .5, 2.2, i % 2 ? .35 : -.35)); },
      refill(t) { tone(mel[pos] + 12, t, vol * .35, 1.5); },
      record(t) { mel.slice(0, 8).forEach((m, i) => tone(m, t + i * gap * 1.2, vol * 1.2, 3.5, (i - 3.5) * .15)); ci = 0; chordAt(t, vol); },
      over(t) { mel.slice(-5).reverse().forEach((m, i) => tone(m, t + i * .4, vol, 3)); chordAt(t + .3, vol * .8); }
    };
  }
  // Мелодии оригинальные: медленные, с долгими нотами и тёплыми септаккордами.
  PACKS.felt = calmPack(
    [74, 76, 78, 81, 78, 76, 74, 71, 69, 71, 74, 76, 74, 71, 69, 66, 67, 71, 74, 79, 78, 74, 71, 69, 71, 74, 73, 69, 66, 69, 71, 74],
    [[50, [0, 7, 11, 16]], [47, [0, 7, 10, 15]], [43, [0, 7, 11, 16]], [45, [0, 5, 7, 14]]],
    { bright: 3, gap: .28, vol: .03 });
  PACKS.moss = calmPack(
    [72, 76, 79, 77, 76, 72, 74, 71, 69, 72, 76, 74, 72, 69, 67, 69, 72, 74, 76, 79, 81, 79, 76, 74, 72, 71, 69, 67, 69, 72, 74, 72],
    [[41, [0, 7, 11, 16]], [43, [0, 7, 11, 14]], [40, [0, 7, 10, 15]], [45, [0, 7, 10, 15]]],
    { bright: 2.6, gap: .32, vol: .028, attack: .045 });
  PACKS.dusk = calmPack(
    [67, 72, 76, 74, 72, 67, 69, 72, 71, 67, 64, 67, 69, 72, 74, 72, 76, 79, 77, 76, 72, 74, 72, 68, 67, 65, 67, 72, 71, 67, 65, 64],
    [[48, [0, 7, 14, 16]], [52, [0, 7, 10, 15]], [41, [0, 7, 11, 16]], [41, [0, 7, 8, 15]]],
    { bright: 2.3, gap: .36, vol: .03, attack: .05, low: -5 });
  /* ---------- Рок: перегруженная гитара, бочка, малый и тарелки ---------- */
  let gtrCurve = null;
  function gtrShaper() {
    if (!gtrCurve) { const n = 2048; gtrCurve = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; gtrCurve[i] = Math.tanh(18 * x) / Math.tanh(18); } }
    const w = ac.createWaveShaper(); w.curve = gtrCurve; w.oversample = '4x'; return w;
  }
  /** Гитара: пилы через жёсткий перегруз и «кабинет». power — квинтаккорд, mute — глушение ладонью. */
  function guitar(freq, t, { vol = .05, dur = .4, pan = 0, power = true, mute = false, lead = false, bend = 0 } = {}) {
    if (!voice(t, dur, vol, 2)) return;
    const pre = ac.createGain(); pre.gain.value = lead ? 2.2 : 3.5;
    const sh = gtrShaper();
    const cab = ac.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = mute ? 1300 : lead ? 3800 : 3000; cab.Q.value = .8;
    const mid = ac.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 800; mid.gain.value = lead ? 4 : -3; mid.Q.value = .9;
    const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + .004);
    g.gain.setTargetAtTime(vol * (mute ? .15 : .6), t + .02, mute ? .03 : .25); g.gain.setTargetAtTime(.0001, t + dur, .05);
    pre.connect(sh); sh.connect(mid); mid.connect(cab); cab.connect(g); out(g, pan, lead ? .35 : .15);
    const notes = power ? [1, 1.4983, 2] : [1];
    notes.forEach((m, i) => {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(freq * m, t); o.detune.value = (i % 2 ? 6 : -5);
      if (bend) o.frequency.exponentialRampToValueAtTime(freq * m * Math.pow(2, bend / 12), t + dur * .8);
      if (lead) { const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 5.5; lg.gain.value = freq * .012; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t + .12); lfo.stop(t + dur + .2); }
      const og = ac.createGain(); og.gain.value = i === 2 ? .5 : 1;
      o.connect(og); og.connect(pre); o.start(t); o.stop(t + dur + .25);
    });
  }
  function kick(t, v = .6) { thud(t, { vol: v, from: 150, to: 45, dur: .16 }); noiseHit(t, { vol: v * .08, dur: .012, freq: 3000, type: 'bandpass', q: 1 }); }
  function snare(t, v = .2) { noiseHit(t, { vol: v, dur: .14, freq: 1900, type: 'bandpass', q: .7, rev: .35, attack: .001 }); thud(t, { vol: v * .8, from: 240, to: 170, dur: .08 }); }
  function crash(t, v = .05) { noiseHit(t, { vol: v, dur: 1.3, freq: 6500, to: 4500, type: 'bandpass', q: .6, rev: .5, attack: .003 }); }
  function hat(t, v = .018) { noiseHit(t, { vol: v, dur: .035, freq: 7000, type: 'bandpass', q: 1.5, rev: .05, attack: .001 }); }
  // Рифф из 30 нот: продолжается с каждой очисткой, как будто играет живая группа.
  const RIFF = [40, 40, 43, 45, 40, 40, 46, 45, 43, 40, 47, 45, 43, 45, 40, 40, 43, 45, 48, 47, 45, 43, 45, 47, 50, 48, 47, 45, 43, 40];
  const ROCK_CH = [40, 36, 38, 45];
  let riffPos = 0, rockCh = 0;
  const riffTake = n => { const o = []; for (let i = 0; i < n; i++) o.push(RIFF[(riffPos + i) % RIFF.length]); riffPos = (riffPos + n) % RIFF.length; return o; };
  PACKS.rock = {
    note() {},
    clear(t, lines, combo) {
      const n = Math.min(4 + lines * 2 + Math.min(combo - 1, 3), 12), step = .12;
      riffTake(n).forEach((m, i) => {
        const tt = t + i * step, strong = i % 4 === 0;
        guitar(mtof(m), tt, { vol: strong ? .05 : .04, dur: strong ? .22 : .11, power: true, mute: !strong, pan: (i % 2 ? .25 : -.25) });
        if (i % 4 === 0) kick(tt, .5); else if (i % 4 === 2) snare(tt, .16); else hat(tt);
      });
      const tt = t + n * step, root = ROCK_CH[rockCh++ % ROCK_CH.length];
      guitar(mtof(root), tt, { vol: .06, dur: 1.2 + lines * .2, power: true });
      kick(tt, .7); snare(tt, .22); crash(tt, .045 + lines * .01);
    },
    chord() {},
    place(n, pan, t) { guitar(mtof(40), t, { vol: .04, dur: .1, mute: true, pan }); kick(t, .35); },
    combo(n, t) { const sc = [64, 67, 69, 71, 74, 76, 79]; for (let i = 0; i < Math.min(n + 1, 6); i++) guitar(mtof(sc[i % sc.length] + (i >= 7 ? 12 : 0)), t + .9 + i * .09, { vol: .035, dur: i === Math.min(n + 1, 6) - 1 ? .7 : .12, power: false, lead: true, bend: i === Math.min(n + 1, 6) - 1 ? 2 : 0 }); },
    refill(t) { guitar(mtof(40), t, { vol: .03, dur: .08, mute: true }); guitar(mtof(40), t + .12, { vol: .03, dur: .08, mute: true }); },
    record(t) { riffTake(8).forEach((m, i) => { guitar(mtof(m), t + i * .1, { vol: .05, dur: .1, mute: i % 2 === 1 }); if (i % 2 === 0) kick(t + i * .1, .5); }); guitar(mtof(40), t + .85, { vol: .065, dur: 2.2 }); crash(t + .85, .07); snare(t + .85, .25); [76, 79, 81, 83, 88].forEach((m, i) => guitar(mtof(m), t + 1 + i * .1, { vol: .03, dur: i === 4 ? 1.2 : .12, power: false, lead: true, bend: i === 4 ? 2 : 0 })); },
    over(t) { guitar(mtof(45), t, { vol: .055, dur: 1.4, bend: -12 }); crash(t, .04); kick(t, .6); }
  };

  /* ---------- Укулеле: весёлые переборы и солнечная мелодия ---------- */
  function uke(freq, t, { vol = .16, pan = 0, dur = 1.1 } = {}) {
    if (!voice(t, dur, vol * .4)) return;
    const s = ac.createBufferSource(); s.buffer = ksBuffer(freq);
    const body = ac.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 480; body.gain.value = 6; body.Q.value = 1.2;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.min(6000, freq * 9);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.setTargetAtTime(.0001, t + .05, dur * .35);
    s.connect(body); body.connect(f); f.connect(g); out(g, pan, .35); s.start(t); s.stop(t + dur + .3);
  }
  const UKE_CH = [[60, 64, 67, 72], [59, 62, 67, 71], [57, 60, 64, 69], [57, 60, 65, 69]];
  const UKE_MEL = [72, 74, 76, 79, 76, 74, 72, 74, 76, 76, 77, 76, 74, 72, 71, 72, 74, 76, 79, 81, 79, 77, 76, 74, 72, 76, 79, 84, 79, 72];
  let ukePos = 0, ukeCh = 0;
  const strum = (ch, t, vol = .13, down = true) => (down ? ch : ch.slice().reverse()).forEach((m, i) => uke(mtof(m), t + i * .022, { vol, pan: (i - 1.5) * .2, dur: .9 }));
  const shaker = (t, v = .02) => noiseHit(t, { vol: v, dur: .05, freq: 6000, type: 'highpass', q: .7, rev: .05, attack: .01 });
  PACKS.uke = {
    note() {},
    clear(t, lines, combo) {
      const ch = UKE_CH[ukeCh++ % UKE_CH.length];
      strum(ch, t, .12); strum(ch, t + .26, .09, false); shaker(t + .13); shaker(t + .39);
      const n = Math.min(3 + lines + Math.min(combo - 1, 3), 8);
      for (let i = 0; i < n; i++) { const m = UKE_MEL[(ukePos + i) % UKE_MEL.length]; uke(mtof(m), t + .5 + i * (i % 2 ? .12 : .16), { vol: .17, pan: i % 2 ? .3 : -.3, dur: .8 }); if (i % 2) shaker(t + .5 + i * .14, .014); }
      ukePos = (ukePos + n) % UKE_MEL.length;
      if (lines > 1) strum(UKE_CH[0].map(m => m + 12), t + .5 + n * .14, .1);
    },
    chord() {},
    place(n, pan, t) { uke(mtof(UKE_CH[ukeCh % 4][n % 4]), t, { vol: .14, pan, dur: .6 }); shaker(t + .06, .012); },
    combo(n, t) { for (let i = 0; i < Math.min(n + 2, 8); i++) uke(mtof(UKE_MEL[(ukePos + i * 2) % UKE_MEL.length] + 12), t + .9 + i * .07, { vol: .1, pan: i % 2 ? .4 : -.4, dur: .5 }); },
    refill(t) { strum(UKE_CH[ukeCh % 4], t, .06); },
    record(t) { UKE_MEL.slice(0, 10).forEach((m, i) => uke(mtof(m), t + i * .12, { vol: .16, dur: .7 })); strum(UKE_CH[0], t + 1.25, .14); strum(UKE_CH[0].map(m => m + 12), t + 1.5, .12); },
    over(t) { [79, 76, 72, 67].forEach((m, i) => uke(mtof(m), t + i * .22, { vol: .15, dur: .8 })); strum(UKE_CH[3], t + .9, .1); }
  };

  const pack = id => PACKS[id || (HB.profile && HB.profile.sound)] || PACKS.xylo;

  const sfx = {
    unlock() { if (HB.settings.sound && !held) { init(); if (ac && ac.state !== 'running') ac.resume(); } },
    /** Пауза просмотра: весь звук замирает вместе с картинкой. */
    hold(on) { held = on; if (!ac) return; if (on) ac.suspend(); else if (HB.settings.sound) ac.resume(); },
    /** Замедление: звук уходит «под воду», а вход в замедление слышен как тянущаяся плёнка. */
    slowTape(on) {
      if (!ready() || !lp) return; const t = ac.currentTime;
      lp.frequency.cancelScheduledValues(t); lp.frequency.setValueAtTime(lp.frequency.value, t);
      lp.frequency.exponentialRampToValueAtTime(on ? 650 : 20000, t + (on ? .35 : .25));
      if (on) { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(55, t + .5); const g = envGain(t, .02, .12, .5); o.connect(g); out(g, 0, .4); o.start(t); o.stop(t + .6); }
    },
    setVolume() { if (master) master.gain.setTargetAtTime(volume(), ac.currentTime, .05); },
    // Взятие фигуры намеренно беззвучно: «капля» раздражала, хватает вибро-щелчка.
    pick() {},
    stash(back) {
      if (!ready()) return; const t = now();
      const a = back ? [79, 84] : [84, 79];
      pluck(mtof(a[0]), t, { vol: .08, dur: .22, bright: 4000 });
      bell(mtof(a[1]), t + .07, { vol: .06, dur: .6 });
    },
    place(n = 3, x = 0) { if (ready()) pack().place(n, x * .6, now()); },
    invalid() {
      if (!ready()) return; const t = now();
      pluck(220, t, { vol: .08, dur: .15, bright: 900 });
      pluck(196, t + .08, { vol: .07, dur: .18, bright: 800 });
    },
    /** Каскад: по ноте на каждую сгоревшую соту, в такт волне очистки. Тембр — из выбранного набора. */
    clear(delays, lines, combo, xs, packId) {
      if (!ready()) return; const t = now(), P = pack(packId);
      if (P.clear) { P.clear(t, lines, combo); return; }
      const shift = Math.min(combo - 1, 8) * 2;
      const order = delays.map((d, i) => [d, xs[i] || 0]).sort((a, b) => a[0] - b[0]);
      const step = Math.max(1, Math.ceil(order.length / (P.maxNotes || 16)));
      order.forEach(([d, x], i) => {
        if (i % step) return;
        const k = Math.floor(i / step);
        P.note(penta(k + shift, 67), t + d, x * .8, k);
      });
      P.chord(60 + shift, t, lines);
    },
    combo(n) { if (ready()) pack().combo(n, now(.12)); },
    /** Демо набора для магазина: постановка, каскад, аккорд и комбо. */
    demo(id) {
      if (!ready()) return; const P = pack(id), t = now();
      P.place(3, 0, t);
      if (P.clear) { P.clear(t + .35, 1, 1); P.combo(2, t + 1.6); return; }
      for (let k = 0; k < 8; k++) P.note(penta(k, 67), t + .35 + k * .05, (k - 3.5) * .15, k);
      P.chord(60, t + .35, 1);
      P.combo(3, t + 1.2);
    },
    popper() {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .35, dur: .12, freq: 1800, type: 'bandpass', q: .7, rev: .2, attack: .001 });
      thud(t, { vol: .22, from: 320, to: 120, dur: .08 });
      for (let i = 0; i < 7; i++) bell(mtof(96 + i * 2), t + .06 + i * .04 + Math.random() * .03, { vol: .02, dur: .35, pan: Math.random() * 1.4 - .7 });
    },
    pixelBurst() {
      if (!ready()) return; const t = now();
      [84, 79, 76, 72, 67].forEach((m, i) => chip(mtof(m), t + i * .04, { vol: .04, dur: .05 }));
      noiseHit(t, { vol: .08, dur: .12, freq: 2000, type: 'highpass', rev: .05, attack: .001 });
    },
    paint() {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .22, dur: .2, freq: 900, to: 250, type: 'lowpass', q: 1.5, rev: .2, attack: .004 });
      thud(t, { vol: .22, from: 110, to: 70, dur: .12 });
    },
    /** Выстрел мортиры: глухой «пум» и тихое шипение хвоста ракеты, без пронзительного свиста. */
    launch(n = 1) {
      if (!ready()) return;
      for (let i = 0; i < n; i++) {
        const t = now(i * .18), pan = Math.random() * .8 - .4;
        thud(t, { vol: .32, from: 140, to: 55, dur: .18 });
        noiseHit(t, { vol: .05, dur: .12, freq: 700, type: 'lowpass', rev: .2, attack: .003, pan });
        noiseHit(t + .05, { vol: .035, dur: .5, freq: 1800, to: 2600, type: 'bandpass', q: 1.2, rev: .3, attack: .12, pan });
      }
    },
    /**
     * Разрыв салюта издалека: мягкий гулкий удар с эхом, а следом — потрескивание
     * горящих звёздочек. Хлопки с «телом» (20–50 мс, низко-средние частоты) идут
     * плотными пачками и редеют, под ними низкое шипение — без писка и щелчков.
     */
    firework(x = 180, n = 1) {
      if (!ready()) return; const t = now(), pan = Math.max(-.7, Math.min(.7, (x - 180) / 180 * .7));
      const lv = 1 / Math.sqrt(Math.max(1, n));
      noiseHit(t, { vol: .34 * lv, dur: 1.2, freq: 600, to: 80, type: 'lowpass', q: .5, rev: .9, attack: .006, pan });
      thud(t, { vol: .45 * lv, from: 72, to: 30, dur: .9 });
      const groups = 7 + Math.floor(Math.random() * 5);
      for (let g = 0; g < groups; g++) {
        const k = Math.pow(Math.random(), 1.3), gt = t + .38 + k * 1.5, gpan = Math.max(-1, Math.min(1, pan + Math.random() * 1.2 - .6));
        const size = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < size; i++) {
          noiseHit(gt + i * (.018 + Math.random() * .035), {
            vol: (.03 + Math.random() * .04) * (1 - k * .55) * lv, dur: .02 + Math.random() * .03,
            freq: 380 + Math.random() * 850, type: 'bandpass', q: .9, rev: .55, attack: .002, pan: gpan
          });
        }
      }
      noiseHit(t + .32, { vol: .03 * lv, dur: 1.6, freq: 900, to: 500, type: 'bandpass', q: .7, rev: .7, attack: .3, pan });
    },
    /** Цветение: мягкий взлёт воздуха и три стеклянных колокольчика. */
    bloom() {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .06, dur: .5, freq: 500, to: 2500, type: 'bandpass', q: 1.5, rev: .5, attack: .15 });
      [0, 2, 4].forEach((k, i) => bell(mtof(penta(k + 7, 72)), t + .12 + i * .07, { vol: .035, dur: 1.2, ratio: 2, index: .8, pan: (i - 1) * .4 }));
    },
    /** Ромашка распустилась: тихое восходящее арпеджио. */
    daisyPlace() { if (!ready()) return; const t = now(); [72, 76, 79, 84].forEach((m, i) => felt(mtof(m), t + i * .07, { vol: .045, dur: 1.8, pan: (i - 1.5) * .3 })); bell(mtof(96), t + .3, { vol: .02, dur: 1.2 }); },
    /** Оторванный лепесток: чем дальше, тем выше и светлее. */
    petal(n = 1) {
      if (!ready()) return; const t = now(), base = [0, 72, 74, 76, 79, 84][n] || 72;
      noiseHit(t, { vol: .04, dur: .25, freq: 3000, to: 6000, type: 'bandpass', q: 2, rev: .5, attack: .03 });
      [0, 4, 7, 12].slice(0, 1 + Math.min(3, n)).forEach((st, i) => felt(mtof(base + st), t + i * .08, { vol: .05, dur: 2.2, pan: (i - 1.5) * .35 }));
      glassBell(mtof(base + 24), t + .1, { vol: .018 + n * .004, dur: 1.4 });
    },
    /** Ромашку уносит ветер: лёгкий порыв и два светлых звоночка вверх, как одуванчик. */
    daisyWilt() {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .05, dur: 1.2, freq: 700, to: 2600, type: 'bandpass', q: 1.1, rev: .6, attack: .4 });
      [79, 84].forEach((m, i) => felt(mtof(m), t + .25 + i * .2, { vol: .03, dur: 1.8, pan: i ? .4 : -.4 }));
      bell(mtof(96), t + .5, { vol: .012, dur: 1, pan: .5 });
    },
    /** Опыление: тёплый шорох пыльцы и россыпь светлых нот по всему полю. */
    pollen() {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .06, dur: .9, freq: 1800, to: 4200, type: 'bandpass', q: 2, rev: .6, attack: .25 });
      [72, 76, 79, 83, 86, 88, 91].forEach((m, i) => felt(mtof(m), t + .25 + i * .07, { vol: .035, dur: 2, pan: (i - 3) * .25 }));
    },
    whirl() { if (!ready()) return; const t = now(); noiseHit(t, { vol: .12, dur: 1.1, freq: 400, to: 3500, type: 'bandpass', q: 1.2, rev: .6, attack: .3 }); [79, 83, 86, 91].forEach((m, i) => felt(mtof(m), t + .2 + i * .08, { vol: .04, dur: 1.8 })); },
    /** Вознесение: хор, светлый аккорд, звенящий каскад и глубокий подъём. */
    ascend() {
      if (!ready()) return; const t = now();
      [48, 55, 60, 64, 67, 71, 74].forEach((m, i) => {
        const o = ac.createOscillator(), f1 = ac.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = (i % 2 ? 6 : -6);
        f1.type = 'bandpass'; f1.frequency.value = 800 + i * 60; f1.Q.value = 1.4;
        const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.035, t + 1.2); g.gain.setTargetAtTime(.0001, t + 2.6, .7);
        o.connect(f1); f1.connect(g); out(g, (i - 3) * .2, 1); o.start(t); o.stop(t + 5.5);
      });
      const o = ac.createOscillator(); o.frequency.setValueAtTime(40, t); o.frequency.exponentialRampToValueAtTime(80, t + 1.6);
      const g = envGain(t + .1, 1.2, .3, 2.2); o.connect(g); out(g, 0, .3); o.start(t); o.stop(t + 4);
      [84, 88, 91, 96, 100, 103, 108].forEach((m, i) => glassBell(mtof(m), t + 1.5 + i * .07, { vol: .03, dur: 2.4, pan: (i - 3) * .25 }));
      [36, 43, 52, 60, 64, 67].forEach((m, i) => felt(mtof(m), t + 1.55 + i * .05, { vol: .06, dur: 4.5, budget: false }));
      // Небесный звон: медленно поднимающиеся колокольчики до вспышки и светлая россыпь после неё.
      [72, 76, 79, 84, 88, 91].forEach((m, i) => bell(mtof(m), t + .2 + i * .2, { vol: .02, dur: 2, ratio: 2.756, index: .6, pan: (i % 2 ? .5 : -.5), send: .4 }));
      noiseHit(t + 1.45, { vol: .1, dur: 2.5, freq: 6000, to: 2500, type: 'bandpass', q: .7, rev: 1, attack: .15 });
      for (let i = 0; i < 14; i++) bell(mtof([96, 100, 103, 108][i % 4]), t + 1.7 + i * .09 + Math.random() * .05, { vol: .012, dur: 1.4, pan: Math.random() * 1.6 - .8, send: .3 });
    },
    /** Ураган: воющий ветер, свист и низкий гул. */
    hurricane() {
      if (!ready()) return; const t = now();
      const s = ac.createBufferSource(); s.buffer = brown; s.loop = true;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
      f.frequency.setValueAtTime(250, t); f.frequency.linearRampToValueAtTime(900, t + 1); f.frequency.linearRampToValueAtTime(420, t + 2.6);
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 1.6; lg.gain.value = 260; lfo.connect(lg); lg.connect(f.frequency);
      const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.9, t + .5); g.gain.setTargetAtTime(.0001, t + 2.2, .35);
      s.connect(f); f.connect(g); out(g, 0, .5); s.start(t); s.stop(t + 3.4); lfo.start(t); lfo.stop(t + 3.4);
      for (let i = 0; i < 3; i++) { const o = ac.createOscillator(); o.type = 'sine'; const tt = t + .3 + i * .6; o.frequency.setValueAtTime(700 + i * 140, tt); o.frequency.linearRampToValueAtTime(1100 + i * 90, tt + .5); o.frequency.linearRampToValueAtTime(650, tt + 1); const e = envGain(tt, .25, .02, .9); o.connect(e); out(e, i % 2 ? .6 : -.6, .6); o.start(tt); o.stop(tt + 1.3); }
      rumble(t, 2.8, .7);
    },
    /** Небесный огонь: частые лазерные «вжик» сверху и нарастающий гул. */
    skyfire() {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .12, dur: 2.2, freq: 1200, to: 500, type: 'lowpass', q: .6, rev: .6, attack: .4 });
      thud(t + .1, { vol: .5, from: 90, to: 30, dur: 1.2 });
      rumble(t, 2.2, .9);
    },
    /** Луч проходит поле: густое гудение, шипение прожига и горячий треск. */
    sunSweep(pan = 0) {
      if (!ready()) return; const t = now();
      [110, 165, 220.5].forEach((f, i) => {
        const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (i - 1) * 8;
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1600, t + .35); lp.frequency.linearRampToValueAtTime(600, t + .8);
        const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.05, t + .08); g.gain.setTargetAtTime(.0001, t + .7, .12);
        o.connect(lp); lp.connect(g); out(g, pan * (i - 1), .4); o.start(t); o.stop(t + 1.2);
      });
      noiseHit(t + .02, { vol: .09, dur: .75, freq: 2400, to: 3600, type: 'bandpass', q: .9, rev: .3, attack: .05, pan });
      crunch(t + .05, .6, { vol: .08, lo: 500, hi: 1400, dens: .7, pan });
    },
    /** Солнечные зайчики рассыпаются: светлый звон. */
    bunnies() { if (!ready()) return; const t = now(); [84, 88, 91, 96].forEach((m, i) => bell(mtof(m), t + i * .05, { vol: .03, dur: .8, pan: (i - 1.5) * .4 })); },
    bunnyHop(h = 1) { if (!ready()) return; const t = now(); bell(mtof([79, 83, 86, 91][Math.min(3, h)] + Math.floor(Math.random() * 2) * 2), t, { vol: .035, dur: .45, pan: Math.random() * 1.2 - .6, ratio: 2, index: .8 }); noiseHit(t, { vol: .03, dur: .06, freq: 2500, type: 'bandpass', q: 2 }); },
    /** Начало цветения: светлое восходящее арпеджио и тёплый аккорд. */
    bloomStart() {
      if (!ready()) return; const t = now() + .8;
      [67, 72, 76, 79, 84, 88].forEach((m, i) => felt(mtof(m), t + i * .09, { vol: .045, dur: 2.6, pan: (i - 2.5) * .25 }));
      glassBell(mtof(96), t + .6, { vol: .025, dur: 2 });
    },
    /** Пузыри: светлое стеклянное мерцание и воздушный выдох, без «бульков». */
    bubbles() {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .05, dur: .6, freq: 1800, to: 900, type: 'bandpass', q: .8, rev: .6, attack: .08 });
      [0, 2, 4, 7].forEach((k, i) => bell(mtof(penta(k + 10, 72)), t + .05 + i * .06, { vol: .022, dur: 1, ratio: 3.01, index: .4, pan: (i - 1.5) * .5 }));
    },
    /** Лопнувший пузырь: крошечный мягкий «пф» в середине диапазона. */
    bubblePop(x = 180) {
      if (!ready()) return; const t = now(Math.random() * .03);
      noiseHit(t, { vol: .035, dur: .05, freq: 1300 + Math.random() * 500, type: 'bandpass', q: 2.5, pan: (x - 180) / 220, rev: .3, attack: .004 });
    },
    /** Кристаллизация: нарастающий хруст инея и звонкий стеклянный рассып. */
    crystal() {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .06, dur: .5, freq: 3000, to: 6000, type: 'bandpass', q: 3, rev: .3, attack: .35 });
      for (let i = 0; i < 6; i++) noiseHit(t + .1 + i * .06, { vol: .025, dur: .03, freq: 2400 + i * 250, type: 'bandpass', q: 4, pan: (Math.random() - .5), rev: .2 });
      thud(t + .55, { vol: .25, from: 140, to: 50, dur: .25 });
      noiseHit(t + .55, { vol: .09, dur: .5, freq: 5000, to: 1800, type: 'bandpass', q: 1.2, rev: .6 });
      [96, 99, 103, 106, 110].forEach((m, i) => glassBell(mtof(m), t + .57 + i * .045, { vol: .02, dur: 1.4, pan: (i - 2) * .35 }));
    },
    /** Глитч: заикание цифрового сигнала, приглушённое и низкое, чтобы не резало уши. */
    glitch() {
      if (!ready()) return; const t = now();
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600; f.Q.value = .7;
      const g = ac.createGain(); g.gain.value = 1; f.connect(g); out(g, 0, .15);
      const seq = [0, .05, .08, .15, .17, .19, .27, .33];
      seq.forEach((d, i) => {
        const o = ac.createOscillator(); o.type = i % 3 ? 'square' : 'sawtooth';
        const fr = [110, 220, 165, 330, 110, 440, 82, 165][i];
        o.frequency.setValueAtTime(fr, t + d); o.frequency.exponentialRampToValueAtTime(fr * (i % 2 ? .5 : 1.5), t + d + .045);
        const e = envGain(t + d, .003, .05, .05); o.connect(e); e.connect(f); o.start(t + d); o.stop(t + d + .07);
      });
      thud(t, { vol: .22, from: 90, to: 40, dur: .18 });
      noiseHit(t + .1, { vol: .05, dur: .25, freq: 1200, type: 'bandpass', q: 1, rev: .1 });
    },
    /** Сверхновая: плавная глубокая волна снизу и мерцание сверху, без треска. */
    supernova() {
      if (!ready()) return; const t = now();
      const o = ac.createOscillator(); o.frequency.setValueAtTime(58, t); o.frequency.exponentialRampToValueAtTime(34, t + 1.6);
      const g = envGain(t, .12, .55, 1.5); o.connect(g); out(g, 0, .3); o.start(t); o.stop(t + 1.8);
      noiseHit(t, { vol: .12, dur: 1.4, freq: 250, to: 900, type: 'lowpass', q: .7, rev: .8, attack: .2 });
      [96, 100, 103, 108].forEach((m, i) => bell(mtof(m), t + .15 + i * .09, { vol: .018, dur: 1.4, ratio: 2.756, index: .6, pan: (i - 1.5) * .4 }));
    },
    blackhole() {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .35, dur: 1.1, freq: 3500, to: 90, type: 'bandpass', q: 2.5, rev: .6, attack: .25 });
      const o = ac.createOscillator();
      o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.1);
      const g = envGain(t, .3, .5, .9); o.connect(g); out(g, 0, .4); o.start(t); o.stop(t + 1.3);
      bell(mtof(40), t + .9, { vol: .06, dur: 1.5, ratio: 1.41, index: 3 });
    },
    /**
     * Бомба: треск искры в запале, глухой толчок давления изнутри — и порох рвёт корпус:
     * суббас, плотный насыщенный взрыв, стук обломков и долгий гул.
     */
    bomb() {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .07, dur: .05, freq: 6500, type: 'highpass', attack: .001, rev: .1 });
      thud(t + .025, { vol: .5, from: 62, to: 44, dur: .05 });
      const t2 = t + .075;
      thud(t2, { vol: 1.15, from: 96, to: 20, dur: 1.3 });
      const s = ac.createBufferSource(); s.buffer = brown;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = .6;
      f.frequency.setValueAtTime(5200, t2); f.frequency.exponentialRampToValueAtTime(110, t2 + 1.2);
      const pre = ac.createGain(); pre.gain.value = 3.2;
      const g = envGain(t2, .002, .6, 1.4), ws = shaper(5);
      s.connect(f); f.connect(pre); pre.connect(ws); ws.connect(g); out(g, 0, .75);
      s.start(t2); s.stop(t2 + 1.6);
      noiseHit(t2, { vol: .35, dur: .12, freq: 2600, to: 700, type: 'bandpass', q: .7, rev: .4, attack: .001 });
      for (let i = 0; i < 10; i++) noiseHit(t2 + .18 + Math.random() * .9, { vol: .03 + Math.random() * .05, dur: .02 + Math.random() * .02, freq: 400 + Math.random() * 900, type: 'lowpass', q: 1, rev: .3, attack: .001, pan: Math.random() * 1.6 - .8 });
      rumble(t2 + .05, 2.6, 1);
    },
    /** Удар молнии: треск разряда, хлёсткий раскол и долгий раскатистый гром. */
    thunder() {
      if (!ready()) return; const t = now();
      for (let i = 0; i < 18; i++) noiseHit(t + Math.random() * .2, { vol: .2 + Math.random() * .3, dur: .01 + Math.random() * .025, freq: 2500 + Math.random() * 6000, type: 'highpass', pan: Math.random() * 1.6 - .8, rev: .35, attack: .001 });
      noiseHit(t + .05, { vol: 1, dur: .4, freq: 9000, to: 350, type: 'lowpass', q: .5, rev: .9, attack: .002 });
      noiseHit(t + .07, { vol: .5, dur: .25, freq: 1800, to: 600, type: 'bandpass', q: 1.2, rev: .6, attack: .002 });
      const s = ac.createBufferSource(); s.buffer = brown;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = .7;
      f.frequency.setValueAtTime(1100, t + .05); f.frequency.exponentialRampToValueAtTime(70, t + 4);
      const g = ac.createGain();
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(1.6, t + .09);
      let tt = t + .09, lvl = 1.6;
      while (tt < t + 3.6) {
        tt += .1 + Math.random() * .28;
        lvl *= .74 + Math.random() * .3;
        g.gain.exponentialRampToValueAtTime(Math.max(.0003, lvl * (.45 + Math.random() * .75)), tt);
      }
      g.gain.exponentialRampToValueAtTime(.0001, t + 4.3);
      s.connect(f); f.connect(g); out(g, 0, 1);
      s.start(t); s.stop(t + 4.4);
      thud(t + .05, { vol: 1, from: 95, to: 24, dur: 1.4 });
      thud(t + .9 + Math.random() * .4, { vol: .5, from: 60, to: 22, dur: 1.2 });
    },
    /** Второй удар молнии по кольцу: сухой треск со всех сторон и новый раскат. */
    ringZap() {
      if (!ready()) return; const t = now();
      for (let i = 0; i < 14; i++) noiseHit(t + Math.random() * .15, { vol: .25 + Math.random() * .3, dur: .01 + Math.random() * .02, freq: 3000 + Math.random() * 6000, type: 'highpass', pan: Math.cos(i / 14 * Math.PI * 2) * .9, rev: .4, attack: .001 });
      noiseHit(t + .03, { vol: .8, dur: .35, freq: 8000, to: 400, type: 'lowpass', q: .5, rev: .9, attack: .002 });
      thud(t + .03, { vol: .8, from: 85, to: 24, dur: 1.1 });
      rumble(t + .05, 2.2, 1.2);
    },
    /** Молния + бомба: взрыв, хлёсткий разряд и самый глубокий, долгий раскат. */
    thunderBomb() {
      if (!ready()) return; const t = now();
      sfx.bomb();
      for (let i = 0; i < 16; i++) noiseHit(t + Math.random() * .12, { vol: .2 + Math.random() * .3, dur: .012 + Math.random() * .02, freq: 3000 + Math.random() * 6000, type: 'highpass', pan: Math.random() * 1.8 - .9, rev: .4, attack: .001 });
      noiseHit(t + .02, { vol: 1, dur: .45, freq: 9000, to: 300, type: 'lowpass', q: .5, rev: 1, attack: .002 });
      thud(t, { vol: 1, from: 70, to: 18, dur: 2 });
      thud(t + .5 + Math.random() * .3, { vol: .6, from: 55, to: 20, dur: 1.4 });
      rumble(t + .04, 3.6, 1.9);
    },
    /** Треск дров: короткие сухие щелчки с «телом», иногда сочный хлопок сучка. */
    crackle() {
      if (!ready()) return; const t = now();
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const tt = t + Math.random() * .12, pan = Math.random() * 1.2 - .6;
        noiseHit(tt, { vol: .025 + Math.random() * .035, dur: .004 + Math.random() * .007, freq: 900 + Math.random() * 1800, type: 'bandpass', q: 1.8, rev: .15, attack: .001, pan });
        if (Math.random() < .25) { noiseHit(tt, { vol: .05, dur: .02, freq: 1300, type: 'lowpass', q: .8, rev: .2, attack: .001, pan }); thud(tt, { vol: .06, from: 320, to: 180, dur: .03 }); }
      }
    },
    /** Поджиг: вздох пламени, который разгорается, и первые щелчки. */
    ignite() {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .16, dur: .55, freq: 180, to: 1600, type: 'lowpass', q: .9, rev: .35, attack: .1 });
      thud(t, { vol: .2, from: 110, to: 60, dur: .2 });
      for (let i = 0; i < 5; i++) setTimeout(() => sfx.crackle(), 80 + i * 90 + Math.random() * 60);
    },
    /** Язык пламени перескакивает на соту: мягкое «фшш». */
    flameLick(x = 0) {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .025, dur: .22, freq: 600, to: 1500, type: 'bandpass', q: 1.1, rev: .3, attack: .03, pan: Math.max(-.8, Math.min(.8, x * .8)) });
    },
    /** Костёр разрушен: вспышка пламени, низкий рёв огня, стук брёвен и россыпь треска. */
    bonfire(storm = false) {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .32, dur: .9, freq: 200, to: 2200, type: 'lowpass', q: .8, rev: .6, attack: .06 });
      const s = ac.createBufferSource(); s.buffer = brown;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 360; f.Q.value = .7;
      const g = envGain(t, .12, storm ? 1.4 : .9, storm ? 2.4 : 1.7);
      s.connect(f); f.connect(g); out(g, 0, .6); s.start(t); s.stop(t + 2.8);
      thud(t + .05, { vol: .55, from: 95, to: 35, dur: .6 });
      thud(t + .22, { vol: .25, from: 200, to: 90, dur: .1 });
      for (let i = 0; i < (storm ? 60 : 36); i++) {
        const k = Math.pow(Math.random(), 1.4), tt = t + .1 + k * 1.6, pan = Math.random() * 1.6 - .8;
        noiseHit(tt, { vol: .02 + Math.random() * .04 * (1 - k * .5), dur: .004 + Math.random() * .008, freq: 900 + Math.random() * 2000, type: 'bandpass', q: 1.6, rev: .3, attack: .001, pan });
      }
      if (storm) { rumble(t + .05, 2.4, 1.1); noiseHit(t + .3, { vol: .22, dur: .9, freq: 300, to: 2400, type: 'lowpass', q: .8, rev: .7, attack: .1 }); }
    },
    /**
     * Бегущий огонь: турбулентный шум пламени с рваной огибающей, низкое тело огня,
     * «фухи» вспыхивающих языков и треск по ходу — как настоящий пожар.
     */
    fireRun(dur = 1.4, big = false) {
      if (!ready()) return; const t = now();
      const s = ac.createBufferSource(); s.buffer = noise; s.loop = true;
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700; lp.Q.value = .5;
      const g = ac.createGain(); g.gain.value = 0;
      const N = Math.ceil(dur * 30), curve = new Float32Array(N); let v = 0;
      for (let i = 0; i < N; i++) { const k = i / (N - 1), env = Math.min(1, k * 6) * Math.pow(1 - k, .7); v = v * .6 + Math.random() * .4; curve[i] = (big ? .5 : .33) * env * (.55 + .9 * v); }
      g.gain.setValueCurveAtTime(curve, t, dur);
      s.connect(hp); hp.connect(lp); lp.connect(g); out(g, 0, .45);
      s.start(t); s.stop(t + dur + .05);
      const b = ac.createBufferSource(); b.buffer = brown;
      const bl = ac.createBiquadFilter(); bl.type = 'lowpass'; bl.frequency.value = 260;
      const bg = envGain(t, .15, big ? 1 : .7, dur); b.connect(bl); bl.connect(bg); out(bg, 0, .3);
      b.start(t); b.stop(t + dur + .25);
      for (let i = 0; i < Math.round(dur * 5); i++) noiseHit(t + Math.random() * dur * .9, { vol: .05 + Math.random() * .05, dur: .25, freq: 400, to: 1400 + Math.random() * 800, type: 'bandpass', q: .8, rev: .3, attack: .06, pan: Math.random() * 1.4 - .7 });
      for (let i = 0; i < Math.round(dur * 22); i++) noiseHit(t + Math.random() * dur, { vol: .02 + Math.random() * .04, dur: .004 + Math.random() * .008, freq: 900 + Math.random() * 2000, type: 'bandpass', q: 1.8, rev: .2, attack: .001, pan: Math.random() * 1.6 - .8 });
    },
    /** Солнце на поле: светлый вздох и тёплый гул. */
    sunPlace() {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .08, dur: .7, freq: 300, to: 3000, type: 'bandpass', q: 1.2, rev: .6, attack: .25 });
      const o = ac.createOscillator(); o.frequency.setValueAtTime(55, t); o.frequency.exponentialRampToValueAtTime(82, t + .6);
      const g = envGain(t, .25, .3, .8); o.connect(g); out(g, 0, .4); o.start(t); o.stop(t + 1.1);
      [84, 88, 91].forEach((m, i) => bell(mtof(m), t + .25 + i * .08, { vol: .025, dur: 1.4, ratio: 2, index: .6, pan: (i - 1) * .4 }));
    },
    /** Солнце растёт: всё более глубокий «вумм» и сияние. */
    sunGrow(stage = 1) {
      if (!ready()) return; const t = now();
      const o = ac.createOscillator(); o.frequency.setValueAtTime(48 + stage * 6, t); o.frequency.exponentialRampToValueAtTime(70 + stage * 10, t + .5);
      const g = envGain(t, .18, .3 + stage * .1, .9); o.connect(g); out(g, 0, .4); o.start(t); o.stop(t + 1.2);
      noiseHit(t, { vol: .06 + stage * .03, dur: .8, freq: 150, to: 900 + stage * 400, type: 'lowpass', q: .8, rev: .6, attack: .3 });
      bell(mtof(79 + stage * 5), t + .2, { vol: .03, dur: 1.6, ratio: 2.756, index: .5 });
    },
    /**
     * Солнечный луч: вдох, глубочайший удар, суббас уходит до 27 Гц, насыщенный рёв плазмы,
     * сияющий аккорд, шипение плазмы и долгий раскат.
     */
    sunBeam(R = 1, mode = 'beam') {
      if (!ready()) return; const t = now(), hit = t + .12, big = 1 + (R - 1) * .22;
      noiseHit(t, { vol: .13, dur: .14, freq: 200, to: 4000, type: 'bandpass', q: 2, rev: .5, attack: .12 });
      thud(hit, { vol: 1.2, from: 64, to: 16, dur: 3.2 });
      const o = ac.createOscillator(); o.frequency.setValueAtTime(54, hit); o.frequency.exponentialRampToValueAtTime(27, hit + 3);
      const og = envGain(hit, .05, .75 * big, 3); o.connect(og); out(og, 0, .2); o.start(hit); o.stop(hit + 3.2);
      const s = ac.createBufferSource(); s.buffer = brown;
      const f = ac.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(160, hit); f.frequency.exponentialRampToValueAtTime(1400, hit + .25); f.frequency.exponentialRampToValueAtTime(140, hit + 3);
      const pre = ac.createGain(); pre.gain.value = 2.5; const ws = shaper(3), g = envGain(hit, .06, .55 * big, 3.2);
      s.connect(f); f.connect(pre); pre.connect(ws); ws.connect(g); out(g, 0, .8); s.start(hit); s.stop(hit + 3.4);
      [45, 52, 57, 61, 64, 69].forEach((m, i) => {
        const oo = ac.createOscillator(); oo.type = i < 2 ? 'sine' : 'triangle'; oo.frequency.value = mtof(m); oo.detune.value = i % 2 ? 6 : -6;
        const gg = envGain(hit + .05, .4, .045, 2.8); oo.connect(gg); out(gg, (i - 2.5) * .25, 1); oo.start(hit); oo.stop(hit + 3.5);
      });
      noiseHit(hit, { vol: .08, dur: 1.6, freq: 5500, type: 'highpass', rev: .5, attack: .05 });
      for (let i = 0; i < 10; i++) bell(mtof(96 + Math.random() * 10), hit + .2 + Math.random() * 1.2, { vol: .014, dur: 1.4, ratio: 2.756, index: .5, pan: Math.random() * 1.6 - .8 });
      rumble(hit + .03, 3.8, 1.3 * big);
      if (mode === 'storm') sfx.thunder();
      if (mode === 'nuke') sfx.bomb();
      if (mode === 'prism') [84, 88, 91, 96, 100, 103].forEach((m, i) => glassBell(mtof(m), hit + .3 + i * .07, { vol: .03, dur: 2, pan: (i - 2.5) * .3 }));
      if (mode === 'flare') sfx.fireRun(1.6, true);
    },
    /** Стихийный хаос: глубочайший удар, сияющий хор и россыпь стеклянного звона. */
    chaos(apo = false) {
      if (!ready()) return; const t = now();
      thud(t, { vol: 1.2, from: 60, to: 15, dur: 3 });
      [40, 47, 52, 56, 59, 64, 71].forEach((m, i) => { const o = ac.createOscillator(); o.type = i < 3 ? 'sine' : 'triangle'; o.frequency.value = mtof(m); o.detune.value = i % 2 ? 7 : -7; const g = envGain(t, .3, .05, 3); o.connect(g); out(g, (i - 3) * .25, 1); o.start(t); o.stop(t + 3.4); });
      for (let i = 0; i < (apo ? 30 : 18); i++) glassBell(mtof(84 + Math.random() * 20), t + .2 + Math.random() * 1.6, { vol: .02, dur: 1.6, pan: Math.random() * 1.6 - .8 });
      rumble(t + .05, apo ? 4.5 : 3.5, apo ? 1.5 : 1.2);
    },
    /** Напалм: взрыв бомбы, который тут же вспыхивает рёвом пламени. */
    napalm() {
      if (!ready()) return;
      sfx.bomb(); sfx.bonfire(false);
      const t = now(); thud(t, { vol: .8, from: 70, to: 22, dur: 1.4 }); rumble(t + .05, 2.2, 1.1);
    },
    /** Замерзание: иней с хрустом расползается снежинкой, лёд поскрипывает и тихо звенит. */
    freeze() {
      if (!ready()) return; const t = now();
      crunch(t, .35, { vol: .32, lo: 1000, hi: 2800, dens: 1.2 });
      crunch(t + .25, .45, { vol: .26, lo: 1300, hi: 3400, dens: .9, pan: -.35, rise: .3 });
      crunch(t + .5, .45, { vol: .22, lo: 1500, hi: 3800, dens: .8, pan: .35, rise: .4 });
      [.12, .4, .7].forEach((d, i) => icePing(t + d, { vol: .03, from: 2200 + i * 500, to: 600, pan: (i - 1) * .5 }));
      noiseHit(t + .15, { vol: .05, dur: .5, freq: 700, to: 420, type: 'bandpass', q: 14, rev: .3, attack: .05 });
      const o = ac.createOscillator(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(70, t + .9);
      const g = envGain(t, .12, .1, .8); o.connect(g); out(g, 0, .3); o.start(t); o.stop(t + 1);
      bell(mtof(98), t + .6, { vol: .015, dur: 1.4, ratio: 2.756, index: .6, pan: .3 });
    },
    /** Треск одной замёрзшей соты: короткий хруст и ледяной «пиу». */
    iceCrack(x = 0) {
      if (!ready()) return; const t = now(), pan = Math.max(-.8, Math.min(.8, x));
      crunch(t, .12, { vol: .3, lo: 1200, hi: 3400, dens: 1.4, pan });
      icePing(t + .01, { vol: .04, from: 2400 + Math.random() * 900, to: 520, pan });
      bell(mtof(90 + Math.random() * 12), t + .03, { vol: .012, dur: .4, ratio: 2.756, index: .8, pan });
    },
    /** Раскол льда: сухой треск, плотный хруст, звенящие осколки и глухой удар. */
    iceBurst(x = 0) {
      if (!ready()) return; const t = now(), pan = Math.max(-.7, Math.min(.7, x));
      noiseHit(t, { vol: .3, dur: .05, freq: 2600, type: 'highpass', q: .7, rev: .3, attack: .001, pan });
      thud(t, { vol: .5, from: 95, to: 32, dur: .5 });
      crunch(t + .01, .5, { vol: .38, lo: 900, hi: 3600, dens: 1.5, pan });
      crunch(t + .15, .45, { vol: .2, lo: 1800, hi: 4200, dens: 1, pan: -pan });
      for (let i = 0; i < 4; i++) icePing(t + .03 + Math.random() * .3, { vol: .035, from: 2000 + Math.random() * 1600, to: 450, pan: Math.random() * 1.2 - .6 });
      for (let i = 0; i < 9; i++) { const k = Math.pow(Math.random(), 1.4); bell(mtof(88 + Math.random() * 18), t + .05 + k * .6, { vol: .012 + Math.random() * .014, dur: .35 + Math.random() * .5, ratio: 2.756 + Math.random() * .5, index: .8, pan: Math.max(-1, Math.min(1, pan + Math.random() * 1.2 - .6)) }); }
    },
    /** Ледяной веер: хруст бегущего льда в сторону удара и мощный раскол. */
    iceFan(x = 0) {
      if (!ready()) return; const t = now();
      for (let i = 0; i < 18; i++) noiseHit(t + i * .02, { vol: .025, dur: .006, freq: 3000 + Math.random() * 4000, type: 'bandpass', q: 3, rev: .3, attack: .001, pan: Math.max(-1, Math.min(1, x + i / 18 * .6)) });
      setTimeout(() => sfx.iceBurst(x), 330);
      thud(t + .33, { vol: .8, from: 70, to: 22, dur: 1.2 });
      rumble(t + .35, 1.8, .9);
    },
    /** Иней ползёт по линиям: нарастающий хруст, скрип и напряжение. */
    iceCrawl() {
      if (!ready()) return; const t = now(), D = 1.1;
      for (let i = 0; i < 70; i++) { const k = i / 70; noiseHit(t + k * D, { vol: .015 + .045 * k, dur: .006 + Math.random() * .015, freq: 700 + Math.random() * (1500 + k * 3000), type: 'bandpass', q: 1.6, rev: .35, attack: .001, pan: Math.sin(i * 1.7) * .8 }); }
      [.2, .5, .8, 1].forEach(d => { noiseHit(t + d, { vol: .12, dur: .03, freq: 2600, type: 'lowpass', q: .7, rev: .35, attack: .001 }); thud(t + d, { vol: .1, from: 240, to: 130, dur: .05 }); });
      noiseHit(t, { vol: .2, dur: D, freq: 200, to: 3800, type: 'bandpass', q: 2.5, rev: .6, attack: D * .9 });
      noiseHit(t + .1, { vol: .07, dur: .7, freq: 800, to: 360, type: 'bandpass', q: 14, rev: .4, attack: .1 });
      const o = ac.createOscillator(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(110, t + D);
      const g = envGain(t, D * .8, .18, .4); o.connect(g); out(g, 0, .3); o.start(t); o.stop(t + D + .5);
    },
    /** Раскол: глубокий удар и каскад звенящих осколков, плывущий по стерео, с хрустальным аккордом. */
    iceStormHit() {
      if (!ready()) return; const hit = now();
      thud(hit, { vol: 1.2, from: 72, to: 17, dur: 2.6 });
      noiseHit(hit, { vol: .5, dur: .45, freq: 4200, to: 900, type: 'bandpass', q: .8, rev: .9, attack: .001 });
      for (let i = 0; i < 40; i++) noiseHit(hit + Math.random() * .25, { vol: .03 + Math.random() * .05, dur: .01 + Math.random() * .02, freq: 800 + Math.random() * 1600, type: 'bandpass', q: 1.4, rev: .4, attack: .001, pan: Math.random() * 1.8 - .9 });
      for (let i = 0; i < 52; i++) { const k = Math.pow(Math.random(), 1.4); bell(mtof(82 + Math.random() * 28), hit + .03 + k * 2.2, { vol: .014 + Math.random() * .022, dur: .6 + Math.random() * 1.1, ratio: 2.756 + Math.random() * .5, index: .8, pan: Math.cos(k * 9 + i) * .95 }); }
      [36, 43, 48, 55, 63].forEach((m, i) => bell(mtof(m + 24), hit + .1 + i * .08, { vol: .032, dur: 3.8, ratio: 2.756, index: .5, pan: (i - 2) * .35 }));
      pad([mtof(48), mtof(55), mtof(63)], hit + .05, { vol: .05, attack: .25, dur: 3.2 });
      rumble(hit + .02, 3.8, 1.3);
    },
    /** Паровой взрыв: лёд вскипает — шипение, хлопок и бурлящий пар. */
    steam() {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .3, dur: 1.3, freq: 3500, type: 'highpass', rev: .5, attack: .02 });
      noiseHit(t, { vol: .2, dur: .9, freq: 600, to: 2400, type: 'bandpass', q: 1.2, rev: .6, attack: .05 });
      thud(t, { vol: .6, from: 90, to: 32, dur: .6 });
      for (let i = 0; i < 18; i++) noiseHit(t + .1 + Math.random() * 1, { vol: .03 + Math.random() * .03, dur: .015, freq: 500 + Math.random() * 700, type: 'bandpass', q: 4, rev: .3, attack: .003, pan: Math.random() * 1.4 - .7 });
    },
    fuse() {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .08, dur: .35, freq: 6000, to: 9000, type: 'highpass', rev: .1 });
    },
    refill() { if (ready()) pack().refill(now(.08)); },
    record() {
      if (!ready()) return; const t = now();
      pack().record(t);
      noiseHit(t + .4, { vol: .06, dur: 1, freq: 8000, to: 14000, type: 'highpass', rev: .6 });
    },
    over() { if (ready()) pack().over(now()); },
    click() {
      if (!ready()) return; const t = now();
      pluck(mtof(84), t, { vol: .06, dur: .12, bright: 5000, rev: .1 });
    },
    toggle(on) {
      if (!ready()) return; const t = now();
      pluck(mtof(on ? 79 : 72), t, { vol: .07, dur: .16, bright: 3500, rev: .15 });
    },
    coin(i = 0) {
      if (!ready()) return; const t = now();
      bell(mtof(88 + (i % 5)), t, { vol: .045, dur: .35, ratio: 2, index: 1.2 });
      bell(mtof(93 + (i % 5)), t + .05, { vol: .04, dur: .45, ratio: 2, index: 1.2 });
    },
    buy() {
      if (!ready()) return; const t = now();
      [84, 88, 91, 96, 100].forEach((m, i) => bell(mtof(m), t + i * .06, { vol: .08, dur: .9, ratio: 2 }));
      thud(t, { vol: .3, from: 200, to: 80, dur: .2 });
    },
    streak() {
      if (!ready()) return; const t = now();
      pad([mtof(60), mtof(64), mtof(67), mtof(71)], t, { vol: .06, dur: 1.4 });
      [76, 79, 83, 88].forEach((m, i) => bell(mtof(m), t + .1 + i * .09, { vol: .07, dur: 1 }));
    },
    undo() {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .12, dur: .35, freq: 400, to: 5000, type: 'bandpass', q: 2, attack: .2 });
      [84, 79, 76, 72].forEach((m, i) => bell(mtof(m), t + .1 + i * .06, { vol: .06, dur: .6 }));
    },
    whoosh() {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .09, dur: .3, freq: 800, to: 6000, type: 'bandpass', q: 1.5, attack: .08 });
    },
    open() {
      if (!ready()) return; const t = now();
      pluck(mtof(67), t, { vol: .05, dur: .18, bright: 2500, rev: .2 });
    }
  };
  HB.sfx = sfx;
})();
