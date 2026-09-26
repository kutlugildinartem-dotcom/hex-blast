/*
 * Звуковой движок на WebAudio: всё синтезируется на лету, без файлов.
 * Колокольчики (FM), щипки, мягкие удары и шумовые «вжухи» идут через общий
 * компрессор и лёгкую реверберацию. Ноты берутся из пентатоники, поэтому любые
 * сочетания звучат приятно, а каскад очистки звучит как ксилофон вверх по гамме.
 */
(() => {
  'use strict';
  const HB = window.HB;
  let ac = null, master = null, verb = null, noise = null;

  function init() {
    if (ac) return ac;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 4;
    comp.attack.value = .003; comp.release.value = .25;
    master = ac.createGain();
    master.gain.value = volume();
    master.connect(comp); comp.connect(ac.destination);

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

    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return ac;
  }
  const volume = () => HB.settings.sound ? Math.pow(HB.settings.volume, 1.5) * .9 : 0;
  const ready = () => HB.settings.sound && init() && ac.state !== 'closed';
  const now = (when = 0) => ac.currentTime + .005 + when;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const PENTA = [0, 2, 4, 7, 9];
  const penta = (i, base = 72) => base + 12 * Math.floor(i / 5) + PENTA[((i % 5) + 5) % 5];

  function out(node, pan = 0, rev = .3) {
    let n = node;
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
  function bell(freq, t, { vol = .16, dur = 1.1, pan = 0, rev = .45, ratio = 3.5, index = 2.2 } = {}) {
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
    [car, mod, sh].forEach(o => { o.start(t); o.stop(t + dur + .05); });
  }
  /** Сочный щипок: треугольник + пила через закрывающийся фильтр. */
  function pluck(freq, t, { vol = .14, dur = .4, pan = 0, rev = .3, bright = 5000 } = {}) {
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
  function pad(freqs, t, { vol = .06, attack = .08, dur = 1.2 } = {}) {
    freqs.forEach((fr, i) => {
      const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
      o.detune.value = (i % 2 ? 7 : -7);
      const g = envGain(t, attack, vol, dur);
      o.connect(g); out(g, (i - 1) * .3, .6);
      o.start(t); o.stop(t + attack + dur + .05);
    });
  }

  const sfx = {
    unlock() { if (HB.settings.sound) { init(); if (ac && ac.state === 'suspended') ac.resume(); } },
    setVolume() { if (master) master.gain.setTargetAtTime(volume(), ac.currentTime, .05); },
    pick() {
      if (!ready()) return; const t = now();
      bubble(t, 440, { vol: .14 });
      bell(mtof(96), t + .02, { vol: .035, dur: .3 });
    },
    place(n = 3, x = 0) {
      if (!ready()) return; const t = now(), pan = x * .6;
      thud(t, { vol: .55 });
      pluck(mtof(penta(n + 2, 60)), t + .01, { vol: .09, dur: .25, pan, bright: 2400 });
      pluck(mtof(penta(n + 4, 72)), t + .05, { vol: .05, dur: .2, pan, bright: 3000 });
    },
    invalid() {
      if (!ready()) return; const t = now();
      pluck(220, t, { vol: .08, dur: .15, bright: 900 });
      pluck(196, t + .08, { vol: .07, dur: .18, bright: 800 });
    },
    /** Каскад: по ноте на каждую сгоревшую соту, в такт волне очистки. */
    clear(delays, lines, combo, xs) {
      if (!ready()) return; const t = now();
      const shift = Math.min(combo - 1, 8) * 2;
      const order = delays.map((d, i) => [d, xs[i] || 0]).sort((a, b) => a[0] - b[0]);
      const step = Math.max(1, Math.floor(order.length / 16));
      order.forEach(([d, x], i) => {
        if (i % step) return;
        const k = Math.floor(i / step);
        const freq = mtof(penta(k + shift, 67));
        (k % 2 ? bell : pluck)(freq, t + d, k % 2
          ? { vol: .07, dur: .5, pan: x * .8, rev: .4 }
          : { vol: .09, dur: .3, pan: x * .8, bright: 6000 });
      });
      const root = 60 + shift;
      pad([mtof(root), mtof(root + 4), mtof(root + 7), mtof(root + 12)], t, { vol: .045 + lines * .012, dur: .9 + lines * .2 });
      bell(mtof(root + 24), t + .05, { vol: .08, dur: 1.4 });
      if (lines > 1) {
        thud(t, { vol: .45, from: 120, to: 36, dur: .35 });
        [28, 31, 36].forEach((st, i) => bell(mtof(root + st), t + .25 + i * .07, { vol: .06, dur: 1.2, pan: (i - 1) * .5 }));
      }
      noiseHit(t, { vol: .06 + lines * .02, dur: .5, freq: 9000, to: 1500, type: 'bandpass', q: .8, rev: .4 });
    },
    combo(n) {
      if (!ready()) return; const t = now(.12);
      for (let i = 0; i < Math.min(n + 1, 7); i++) bell(mtof(penta(i + n * 2, 76)), t + i * .045, { vol: .06, dur: .6, pan: (i % 2 ? .4 : -.4) });
    },
    bomb() {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .7, dur: .9, freq: 4200, to: 60, type: 'lowpass', q: .7, rev: .5 });
      thud(t, { vol: .9, from: 110, to: 28, dur: .7 });
      for (let i = 0; i < 6; i++) noiseHit(t + .08 + Math.random() * .4, { vol: .12, dur: .05, freq: 3000 + Math.random() * 4000, type: 'highpass', pan: Math.random() * 1.6 - .8 });
      bell(mtof(48), t + .02, { vol: .08, dur: 1.6, ratio: 1.41, index: 4 });
    },
    fuse() {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .08, dur: .35, freq: 6000, to: 9000, type: 'highpass', rev: .1 });
    },
    refill() {
      if (!ready()) return; const t = now(.08);
      [0, 2, 4].forEach((k, i) => bubble(t + i * .06, mtof(penta(k + 5, 67)), { vol: .07, rise: 1.5, dur: .1, pan: (i - 1) * .5 }));
    },
    record() {
      if (!ready()) return; const t = now();
      [72, 76, 79, 84, 88, 91, 96].forEach((m, i) => bell(mtof(m), t + i * .075, { vol: .09, dur: 1.2, pan: (i - 3) * .2 }));
      pad([mtof(60), mtof(64), mtof(67), mtof(72)], t + .45, { vol: .07, dur: 1.6 });
      noiseHit(t + .4, { vol: .06, dur: 1, freq: 8000, to: 14000, type: 'highpass', rev: .6 });
    },
    over() {
      if (!ready()) return; const t = now();
      [79, 74, 71, 67, 62].forEach((m, i) => pluck(mtof(m), t + i * .16, { vol: .09, dur: .5, bright: 2400 }));
      pad([mtof(55), mtof(59), mtof(62)], t + .3, { vol: .05, attack: .3, dur: 2 });
    },
    click() {
      if (!ready()) return; const t = now();
      pluck(mtof(84), t, { vol: .06, dur: .12, bright: 5000, rev: .1 });
    },
    toggle(on) {
      if (!ready()) return; const t = now();
      bubble(t, on ? 520 : 700, { vol: .09, rise: on ? 1.8 : .6, dur: .1 });
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
      bubble(t, 360, { vol: .08, rise: 1.9, dur: .14 });
    }
  };
  HB.sfx = sfx;
})();
