// 소리: 소리 파일 없이 브라우저가 그 자리에서 만들어 내는 효과음 (Web Audio)
// 칼바람·타격·적이 쓰러지는 소리·스킬·보스, 구역마다 은은한 배경 소리 (숲: 바람과 새, 동굴: 물방울),
// 그리고 잔잔한 배경 음악 (숲: 따뜻한 화음과 뜯는 소리, 동굴: 낮은 울림과 수정 종소리, 보스: 북소리).
// 브라우저는 사용자가 화면을 누르거나 키를 누르기 전엔 소리를 막으므로 첫 입력 때 켭니다. M 키(터치: 스피커 버튼)로 끄고 켬.
const Sound = {
  ctx: null,
  master: null,
  noise: null,       // 1초짜리 흰 소음 (바람·타격 재료)
  muted: false,
  volume: 0.7,
  ambientTimer: 0,
  wind: null,        // 숲의 바람 소리 (계속 재생)
  music: null,       // 배경 음악 버스 (음량 조절용)
  musicVolume: 0.5,
  beat: 0,           // 다음 음악 박자까지 남은 시간
  bar: 0,            // 지금 몇 번째 마디인지 (화음 진행)
  drone: null,       // 동굴의 낮은 울림 (계속 재생)

  init() {
    try {
      this.muted = localStorage.getItem('warrior-muted') === '1';   // 이 브라우저에서 마지막으로 정한 값
    } catch (e) { /* 저장이 막힌 곳: 기본값 */ }
    const start = () => this.start();
    for (const ev of ['pointerdown', 'touchstart', 'keydown']) window.addEventListener(ev, start, { passive: true });
  },

  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    const comp = ctx.createDynamicsCompressor();   // 여러 소리가 겹쳐도 찢어지지 않게
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(comp);
    this.music = ctx.createGain();
    this.music.gain.value = this.musicVolume;
    // 음악에 넓은 울림 (짧은 소음으로 만든 잔향)
    const verb = ctx.createConvolver(), irLen = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3);
    }
    verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    this.music.connect(this.master);
    this.music.connect(verb).connect(wet).connect(this.master);
    const len = ctx.sampleRate, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    this.setAmbient();
  },

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem('warrior-muted', this.muted ? '1' : '0');
    } catch (e) { /* 저장이 막힌 곳 */ }
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    UI.toast(this.muted ? '소리 끔' : '소리 켬');
  },

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  },

  // ---------- 재료 ----------

  // 음량 봉투: 0에서 peak까지 a초 동안 올라갔다가 d초 동안 사라짐
  env(gain, t, peak, a, d) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  },

  // 거른 소음 한 번 (type: 'bandpass' | 'lowpass' | 'highpass', f0 → f1 Hz로 미끄러짐)
  noiseHit(t, dur, type, f0, f1, peak, q = 1, attack = 0.005, out = this.master) {
    const ctx = this.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise;
    src.loop = true;
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, peak, attack, dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + attack + dur + 0.05);
  },

  // 음 하나 (wave: 'sine' | 'triangle' | 'square' | 'sawtooth', f0 → f1 Hz)
  tone(t, dur, wave, f0, f1, peak, attack = 0.005, out = this.master, lowpass = 0) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + attack + dur);
    this.env(g, t, peak, attack, dur);
    let node = o;
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      node = o.connect(f);
    }
    node.connect(g).connect(out);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  },

  // 거리에 따라 작아지게 (x, z: 소리 난 곳)
  near(x, z, range = 30) {
    const p = Game.player;
    if (!p || x === undefined) return 1;
    return Utils.clamp(1 - Math.hypot(x - p.x, z - p.z) / range, 0, 1);
  },

  // ---------- 효과음 ----------

  play(name, opt = {}) {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime + 0.005, v = opt.x !== undefined ? this.near(opt.x, opt.z, opt.range) : 1;
    if (v <= 0.01) return;
    const el = opt.element || (Weapons.cur && Weapons.cur.id);
    switch (name) {
      case 'swing': {   // 칼바람: 소음이 높은 쪽으로 휙 (내려찍기는 낮고 묵직하게)
        const heavy = opt.heavy ? 0.7 : 1;
        this.noiseHit(t, 0.17, 'bandpass', 500 * heavy, 2600 * heavy, 0.32 * v, 1.4, 0.02);
        if (el === 'laevateinn') this.noiseHit(t, 0.25, 'lowpass', 900, 300, 0.18 * v, 0.7, 0.01);   // 불: 화르륵
        if (el === 'astrape') this.tone(t, 0.1, 'square', 2400, 900, 0.035 * v);                   // 번개: 찌직
        if (el === 'balmung') this.tone(t + 0.02, 0.18, 'sine', 1800, 2400, 0.03 * v);               // 빛: 맑은 울림
        break;
      }
      case 'hit': {     // 벤 소리: 퍽 + 짧은 쇳소리
        const k = Utils.clamp(opt.power || 0.5, 0.2, 1.5);
        this.tone(t, 0.12, 'sine', 170, 55, 0.5 * k * v);
        this.noiseHit(t, 0.07, 'highpass', 2500, 1200, 0.25 * k * v, 0.8);
        this.tone(t, 0.09, 'triangle', 1500 + Math.random() * 400, 1100, 0.05 * v);
        if (el === 'laevateinn') this.noiseHit(t, 0.3, 'lowpass', 1400, 400, 0.14 * v, 0.7);
        if (el === 'astrape') this.noiseHit(t, 0.12, 'bandpass', 4000, 2500, 0.12 * v, 3);
        break;
      }
      case 'die': {     // 적이 쓰러짐 (종류마다)
        const type = opt.type;
        if (type === 'slime') this.tone(t, 0.25, 'sine', 520, 110, 0.3 * v, 0.01, this.master, 1200);       // 뽀옹
        else if (type === 'goblin') this.tone(t, 0.32, 'sawtooth', 210, 80, 0.16 * v, 0.02, this.master, 900);   // 끄억
        else if (type === 'bat') this.tone(t, 0.16, 'sine', 3200, 1500, 0.08 * v);                              // 끽
        else for (let i = 0; i < 5; i++) this.noiseHit(t + i * 0.05 + Math.random() * 0.02, 0.04, 'bandpass', 2200, 1800, 0.16 * v, 6);   // 해골: 달그락
        this.noiseHit(t + 0.05, 0.35, 'lowpass', 800, 200, 0.12 * v, 0.7, 0.02);
        break;
      }
      case 'hurt':      // 전사가 맞음: 둔탁한 쿵
        this.tone(t, 0.2, 'sine', 120, 45, 0.55);
        this.noiseHit(t, 0.12, 'lowpass', 1200, 300, 0.3, 0.7);
        this.tone(t, 0.16, 'sawtooth', 260, 140, 0.06, 0.01, this.master, 700);
        break;
      case 'dodge':     // 구르기: 낮은 바람
        this.noiseHit(t, 0.28, 'bandpass', 300, 900, 0.22, 0.9, 0.05);
        break;
      case 'spin':      // 회전베기: 길게 도는 바람
        this.noiseHit(t, 0.5, 'bandpass', 400, 2200, 0.3, 1.2, 0.08);
        this.noiseHit(t + 0.18, 0.35, 'bandpass', 900, 1600, 0.16, 1.2, 0.05);
        break;
      case 'wave':      // 검기: 날카로운 바람 + 맑은 울림
        this.noiseHit(t, 0.3, 'highpass', 1200, 4000, 0.22, 0.8, 0.02);
        this.tone(t, 0.45, 'sine', 900, 1400, 0.06, 0.02);
        break;
      case 'dash':      // 섬광 돌진: 휙!
        this.noiseHit(t, 0.16, 'bandpass', 800, 4500, 0.35, 1.0, 0.01);
        break;
      case 'slash':     // 돌진 뒤 지나온 길이 베임: 쨍
        this.tone(t, 0.3, 'triangle', 2200, 1400, 0.09);
        this.noiseHit(t, 0.25, 'highpass', 3000, 1500, 0.25, 0.8);
        break;
      case 'boom':      // 속성 폭발·궁극기 한 방·유성: 쿵 (opt.size 0~1.5)
        this.boom(t, opt.size || 1, v);
        break;
      case 'charge':    // 궁극기 모으기: 낮게 웅웅 올라감
        this.tone(t, 1.1, 'sawtooth', 70, 160, 0.08, 0.3, this.master, 500);
        this.noiseHit(t, 1.1, 'bandpass', 300, 2000, 0.12, 2, 0.4);
        break;
      case 'switch':    // 무기 바꾸기: 반짝 올라가는 소리
        this.tone(t, 0.25, 'sine', 600, 1500, 0.08, 0.01);
        this.tone(t + 0.06, 0.3, 'sine', 1200, 2400, 0.05, 0.01);
        if (el === 'laevateinn') this.noiseHit(t, 0.4, 'lowpass', 1500, 300, 0.2, 0.7, 0.03);
        break;
      case 'shoot':     // 화살 쏘기: 시위 퉁
        this.tone(t, 0.12, 'triangle', 320, 180, 0.15 * v);
        this.noiseHit(t, 0.08, 'highpass', 2000, 4000, 0.1 * v, 0.8);
        break;
      case 'screech':   // 박쥐 예고: 끼익
        this.tone(t, 0.3, 'sine', 3400, 2600, 0.05 * v, 0.03);
        this.tone(t + 0.04, 0.25, 'sine', 3900, 3000, 0.03 * v, 0.03);
        break;
      case 'stomp':     // 골렘 발걸음: 쿵
        this.tone(t, 0.25, 'sine', 70, 35, 0.4 * v);
        this.noiseHit(t, 0.2, 'lowpass', 300, 80, 0.2 * v, 0.7);
        break;
      case 'slam':      // 골렘 내려찍기: 아주 깊은 쿵 + 바위 우르르
        this.boom(t, 1.5, v);
        this.noiseHit(t + 0.05, 1.0, 'lowpass', 500, 60, 0.3 * v, 0.7, 0.02);
        break;
      case 'roar':      // 골렘 포효: 낮은 으르렁
        for (const [f, k] of [[65, 1], [98, 0.6], [131, 0.35]]) this.tone(t, 1.4, 'sawtooth', f, f * 0.8, 0.12 * k * v, 0.25, this.master, 600);
        this.noiseHit(t, 1.4, 'lowpass', 700, 200, 0.2 * v, 0.6, 0.25);
        break;
      case 'chime':     // 출구가 열림·보스 쓰러뜨림: 맑은 화음
        [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.09, 0.9, 'sine', f, f, 0.08, 0.01));
        break;
      case 'step':      // 전사 발걸음 (동굴은 조금 더 또렷하게)
        this.noiseHit(t, 0.06, 'lowpass', World.cave ? 1400 : 900, 300, World.cave ? 0.07 : 0.045, 0.7);
        break;
    }
  },

  boom(t, size, v = 1) {
    this.tone(t, 0.35 + size * 0.35, 'sine', 110, 32, 0.6 * Math.min(1.2, size) * v, 0.005);
    this.noiseHit(t, 0.3 + size * 0.4, 'lowpass', 1800, 120, 0.4 * Math.min(1.2, size) * v, 0.7, 0.005);
  },

  // ---------- 배경 소리 ----------

  // 구역을 불러올 때: 숲은 바람 소리를 깔고, 동굴은 끔. 음악도 구역에 맞게
  setAmbient() {
    if (!this.ctx || !World.level) return;
    this.bar = 0;
    this.beat = 0.5;
    if (this.drone) {
      const dr = this.drone;
      dr.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.6);
      setTimeout(() => dr.oscs.forEach((o) => o.stop()), 2500);
      this.drone = null;
    }
    if (World.cave) {   // 동굴: 낮은 A와 E가 살짝 어긋나 일렁이는 울림
      const ctx = this.ctx, g = ctx.createGain(), f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 380;
      g.gain.value = 0.0001;
      g.gain.setTargetAtTime(0.05, ctx.currentTime, 2);
      const oscs = [55, 55.4, 82.4, 110.3].map((hz) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz;
        o.connect(f);
        o.start();
        return o;
      });
      f.connect(g).connect(this.music);
      this.drone = { gain: g, oscs };
    }
    if (this.wind) {
      const w = this.wind;
      w.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4);
      setTimeout(() => w.src.stop(), 1500);
      this.wind = null;
    }
    if (World.cave) return;
    const ctx = this.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    src.buffer = this.noise;
    src.loop = true;
    f.type = 'lowpass';
    f.frequency.value = 420;
    lfo.frequency.value = 0.09;   // 바람이 천천히 세졌다 약해짐
    lg.gain.value = 220;
    lfo.connect(lg).connect(f.frequency);
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(0.045, ctx.currentTime, 1.5);
    src.connect(f).connect(g).connect(this.master);
    src.start();
    lfo.start();
    this.wind = { src, gain: g };
  },

  // 음악 박자 (0.5초마다): 마디마다 화음, 사이사이 뜯는 소리 / 종소리, 보스전엔 북
  musicStep(dt) {
    this.beat -= dt;
    if (this.beat > 0) return;
    const theme = World.level.theme, boss = Enemies.boss, fight = boss && !boss.dead && boss.state !== 'sleep';
    const step = fight ? 0.42 : theme === 'dusk' ? 0.62 : 0.5;
    this.beat += step;
    const t = this.ctx.currentTime + 0.02, n = this.bar++, out = this.music;
    const hz = (semi) => 220 * Math.pow(2, semi / 12);   // A3 기준 반음
    if (fight) {   // 보스전: 쿵·쿵 북 + 낮은 단조 화음, 4마디마다 높은 음
      this.tone(t, 0.3, 'sine', 90, 40, n % 2 ? 0.25 : 0.4, 0.004, out);
      if (n % 2) this.noiseHit(t, 0.08, 'bandpass', 1500, 900, 0.06, 1.5, 0.003, out);
      if (n % 8 === 0) for (const s of [-12, -9, -5]) this.tone(t, step * 7, 'sawtooth', hz(s + (n % 16 ? 0 : -2)), hz(s + (n % 16 ? 0 : -2)), 0.03, 0.5, out, 600);
      if (n % 4 === 2) this.tone(t, 0.5, 'triangle', hz(7 + (n % 16 > 8 ? 3 : 0)), hz(7), 0.04, 0.01, out);
      return;
    }
    if (World.cave) {   // 동굴: 가끔 높은 수정 종소리 (단조 음계)
      if (Math.random() < 0.3) {
        const scale = [0, 3, 5, 7, 10, 12, 15], s = scale[(Math.random() * scale.length) | 0] + 12;
        this.tone(t, 2.2, 'sine', hz(s), hz(s), 0.035, 0.005, out);
        this.tone(t, 1.2, 'sine', hz(s) * 2.01, hz(s) * 2.01, 0.01, 0.005, out);
      }
      return;
    }
    // 숲: 8박자마다 화음이 바뀜 (낮: C–Am–F–G, 노을: Am–F–C–G), 사이사이 오음계 뜯는 소리
    const prog = theme === 'dusk' ? [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]] : [[3, 7, 10], [0, 3, 7], [-4, 0, 3], [-2, 2, 5]];
    const chord = prog[Math.floor(n / 8) % 4];
    if (n % 8 === 0) for (const s of chord) this.tone(t, step * 8, 'triangle', hz(s - 12), hz(s - 12), 0.025, 0.8, out, 900);
    if (Math.random() < (theme === 'dusk' ? 0.35 : 0.5)) {
      const s = chord[(Math.random() * 3) | 0] + (Math.random() < 0.5 ? 12 : 0);
      this.tone(t, 0.6, 'triangle', hz(s), hz(s), 0.035, 0.004, out);
    }
  },

  // 매 프레임: 가끔 새소리(숲) / 물방울 소리(동굴), 횃불 타닥, 배경 음악
  update(dt) {
    if (!this.ready || this.muted) return;
    this.musicStep(dt);
    this.ambientTimer -= dt;
    if (this.ambientTimer > 0) return;
    const t = this.ctx.currentTime + 0.01;
    if (World.cave) {   // 동굴: 물방울이 똑 (울림이 남도록 두 번)
      this.ambientTimer = 0.8 + Math.random() * 2.2;
      const f = 1300 + Math.random() * 900;
      this.tone(t, 0.12, 'sine', f, f * 0.55, 0.05, 0.002);
      this.tone(t + 0.16, 0.12, 'sine', f, f * 0.55, 0.015, 0.002);
      for (const [x, , z] of World.torches) {   // 가까운 횃불이 타닥
        const v = this.near(x, z, 12);
        if (v > 0 && Math.random() < 0.6) this.noiseHit(t + Math.random() * 0.3, 0.03, 'highpass', 3000, 2000, 0.07 * v, 0.8);
      }
    } else {   // 숲: 짹짹 (짧게 빠르게 오르내리는 음 두세 번)
      this.ambientTimer = 1.5 + Math.random() * 3.5;
      const base = 2600 + Math.random() * 1600, n = 2 + ((Math.random() * 3) | 0), dusk = World.level.theme === 'dusk';
      for (let i = 0; i < n; i++) this.tone(t + i * 0.11, 0.07, 'sine', base * (dusk ? 0.7 : 1), base * (dusk ? 0.55 : 1.3), 0.025, 0.01);
    }
  },
};
