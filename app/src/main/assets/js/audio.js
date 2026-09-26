/*
 * Звуковой движок на WebAudio: всё синтезируется на лету, без файлов.
 * Колокольчики (FM), щипки, мягкие удары и шумовые «вжухи» идут через общий
 * компрессор и лёгкую реверберацию. Ноты берутся из пентатоники, поэтому любые
 * сочетания звучат приятно, а каскад очистки звучит как ксилофон вверх по гамме.
 */
(() => {
  'use strict';
  const HB = window.HB;
  let ac = null, master = null, verb = null, noise = null, brown = null;

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
  /** Хрустальный колокольчик с негармоничным спектром и пинг-понг эхом. */
  function glassBell(freq, t, { vol = .06, dur = 2.4, pan = 0 } = {}) {
    [0, .19, .38].forEach((d, i) => {
      const k = [1, .45, .2][i], p = i === 0 ? pan : (i % 2 ? -.7 : .7);
      bell(freq, t + d, { vol: vol * k, dur: dur * (1 - i * .2), pan: p, rev: .6, ratio: 2.756, index: .9 });
      bell(freq * 2, t + d + .002, { vol: vol * k * .3, dur: dur * .5, pan: p, rev: .6, ratio: 5.4, index: .5 });
    });
  }
  function kick(t, vol = .9) { thud(t, { vol, from: 150, to: 42, dur: .32 }); noiseHit(t, { vol: vol * .25, dur: .02, freq: 3000, type: 'highpass', rev: .02, attack: .001 }); }
  function tom(freq, t, vol = .6, pan = 0) {
    const o = ac.createOscillator();
    o.frequency.setValueAtTime(freq * 1.7, t); o.frequency.exponentialRampToValueAtTime(freq, t + .07);
    const g = envGain(t, .002, vol, .38); o.connect(g); out(g, pan, .25);
    o.start(t); o.stop(t + .45);
    noiseHit(t, { vol: vol * .25, dur: .06, freq: 1500, type: 'bandpass', q: 1.5, rev: .15, attack: .001, pan });
  }
  function snare(t, vol = .5, pan = 0) {
    noiseHit(t, { vol, dur: .18, freq: 2200, type: 'bandpass', q: .8, rev: .25, attack: .001, pan });
    const o = ac.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(170, t + .08);
    const g = envGain(t, .001, vol * .45, .12); o.connect(g); out(g, pan, .2);
    o.start(t); o.stop(t + .15);
  }
  const hat = (t, vol = .18, open = false, pan = 0) => noiseHit(t, { vol, dur: open ? .35 : .05, freq: 8000, type: 'highpass', rev: .1, attack: .001, pan });
  function crash(t, vol = .35) {
    noiseHit(t, { vol, dur: 1.8, freq: 5000, type: 'highpass', rev: .5, attack: .002 });
    noiseHit(t, { vol: vol * .5, dur: 1.2, freq: 3200, type: 'bandpass', q: 3, rev: .5, attack: .002 });
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
    drums: {
      note(m, t, pan, k) { if (k % 3 === 2) snare(t, .28, pan); else tom(70 + (m - 60) * 7, t, .45, pan); hat(t + .03, .07, false, -pan); },
      chord(root, t, lines) { kick(t, .9); crash(t + .02, .25 + lines * .08); if (lines > 1) { kick(t + .22, .7); snare(t + .33, .45); kick(t + .44, .8); } },
      place(n, pan, t) { kick(t, .75); hat(t + .01, .08, false, pan); },
      combo(n, t) { const c = Math.min(4 + n * 2, 14); for (let i = 0; i < c; i++) snare(t + i * .045, .12 + i * .025, i % 2 ? .3 : -.3); crash(t + c * .045, .25); },
      refill(t) { hat(t, .1); hat(t + .08, .1); hat(t + .16, .14, true); },
      record(t) { for (let i = 0; i < 8; i++) tom(200 - i * 18, t + i * .06, .5, (i - 3.5) * .15); kick(t + .5, 1); crash(t + .5, .45); },
      over(t) { [140, 110, 85, 65].forEach((f, i) => tom(f, t + i * .18, .5)); crash(t + .75, .2); }
    }
  };
  const pack = id => PACKS[id || (HB.profile && HB.profile.sound)] || PACKS.xylo;

  const sfx = {
    unlock() { if (HB.settings.sound) { init(); if (ac && ac.state === 'suspended') ac.resume(); } },
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
      const shift = Math.min(combo - 1, 8) * 2;
      const order = delays.map((d, i) => [d, xs[i] || 0]).sort((a, b) => a[0] - b[0]);
      const step = Math.max(1, Math.floor(order.length / 16));
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
    launch(n = 1) {
      if (!ready()) return;
      for (let i = 0; i < n; i++) {
        const t = now(i * .18), o = ac.createOscillator();
        o.frequency.setValueAtTime(600 + Math.random() * 200, t); o.frequency.exponentialRampToValueAtTime(2000 + Math.random() * 600, t + .55);
        const g = envGain(t, .05, .035, .55); o.connect(g); out(g, Math.random() * .8 - .4, .3);
        o.start(t); o.stop(t + .65);
        noiseHit(t, { vol: .07, dur: .5, freq: 3000, to: 6000, type: 'bandpass', q: 2, rev: .2, attack: .05 });
      }
    },
    firework(x = 180) {
      if (!ready()) return; const t = now(), pan = Math.max(-.8, Math.min(.8, (x - 180) / 180 * .8));
      noiseHit(t, { vol: .55, dur: .7, freq: 2500, to: 150, type: 'lowpass', q: .6, rev: .7, attack: .002, pan });
      thud(t, { vol: .45, from: 90, to: 35, dur: .5 });
      for (let i = 0; i < 16; i++) noiseHit(t + .15 + Math.random() * .7, { vol: .07 + Math.random() * .08, dur: .012, freq: 4000 + Math.random() * 4000, type: 'highpass', rev: .3, attack: .001, pan: Math.max(-1, Math.min(1, pan + Math.random() * .6 - .3)) });
    },
    blackhole() {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .35, dur: 1.1, freq: 3500, to: 90, type: 'bandpass', q: 2.5, rev: .6, attack: .25 });
      const o = ac.createOscillator();
      o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.1);
      const g = envGain(t, .3, .5, .9); o.connect(g); out(g, 0, .4); o.start(t); o.stop(t + 1.3);
      bell(mtof(40), t + .9, { vol: .06, dur: 1.5, ratio: 1.41, index: 3 });
    },
    bomb() {
      if (!ready()) return; const t = now();
      noiseHit(t, { vol: .7, dur: .9, freq: 4200, to: 60, type: 'lowpass', q: .7, rev: .5 });
      thud(t, { vol: .9, from: 110, to: 28, dur: .7 });
      for (let i = 0; i < 6; i++) noiseHit(t + .08 + Math.random() * .4, { vol: .12, dur: .05, freq: 3000 + Math.random() * 4000, type: 'highpass', pan: Math.random() * 1.6 - .8 });
      bell(mtof(48), t + .02, { vol: .08, dur: 1.6, ratio: 1.41, index: 4 });
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
