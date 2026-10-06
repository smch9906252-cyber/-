// 무기 3종: 게임 중 1·2·3 키로 바꿔 듦
//   1 발뭉(빛): 균형 잡힌 성검. 콤보 마무리에 빛의 기둥
//   2 레바테인(불): 묵직한 화염 대검. 맞은 적이 잠깐 불탐
//   3 아스트라페(번개): 벨 때마다 번개가 근처 적에게 튐
// 능력치는 config.js의 weapons. 무기를 바꾸면 칼질 궤적·스킬·궁극기·갑옷 빛줄기 색까지 함께 바뀜

// 효과 색 (빛을 더하는 효과라 1보다 커도 됨)
//   core: 빛의 가운데(하얗게 빛나는 칼날 선), mid: 바깥으로 번지는 색, spark: 불똥, ghost: 잔상
//   glow: 갑옷 빛줄기·망토 문장 색, ui: 화면 글자 색, flash: 화면 번쩍임 색, dark: 궁극기 때 화면을 물들이는 색
const WEAPONS = [
  {
    id: 'balmung', name: '발뭉', title: '전설의 성검', element: '빛', length: 1.24,
    core: [1.5, 1.75, 2.2], mid: [0.35, 0.75, 1.6], spark: [0.6, 0.95, 1], ghost: [0.18, 0.45, 1.0],
    glow: '#58c8ff', ui: '#7fd0ff', flash: [0.55, 0.65, 0.9], dark: [0.4, 0.46, 0.72],
    ult: '성검 강림', ultIcon: 'sword',
  },
  {
    id: 'laevateinn', name: '레바테인', title: '멸망의 화염검', element: '불', length: 1.4,
    core: [2.3, 1.5, 0.65], mid: [1.75, 0.4, 0.05], spark: [1, 0.62, 0.2], ghost: [1.0, 0.3, 0.03],
    glow: '#ff6a1a', ui: '#ffa060', flash: [1.0, 0.55, 0.22], dark: [0.8, 0.42, 0.36],
    ult: '겁화의 유성우', ultIcon: 'meteor',
  },
  {
    id: 'astrape', name: '아스트라페', title: '뇌신의 검', element: '번개', length: 1.3,
    core: [1.85, 1.6, 2.5], mid: [0.8, 0.3, 1.8], spark: [0.85, 0.65, 1], ghost: [0.5, 0.16, 1.0],
    glow: '#b46cff', ui: '#cfa2ff', flash: [0.75, 0.6, 1.0], dark: [0.42, 0.36, 0.7],
    ult: '천벌의 낙뢰', ultIcon: 'bolt',
  },
];

// 철 장갑 낀 주먹 (모든 무기 공통, 손 = 원점)
function addGauntletFist(b, rnd) {
  const gt = () => vary(COLORS.gauntlet, 0.08, rnd);
  Shapes.box(b, M4.chain(M4.translation(0, -0.03, 0.012), M4.scaling(0.07, 0.1, 0.075)), gt);
  Shapes.box(b, M4.chain(M4.translation(0, -0.03, -0.03), M4.scaling(0.075, 0.095, 0.022)), () => COLORS.steelDark);
}

// 두 점 사이에 놓인 얇은 상자 (지그재그 번개 무늬·금 간 무늬용). z = 칼날 면 높이
function addStrip(b, p0, p1, w, z, colorFn) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy);
  const m = M4.chain(M4.translation((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, z), M4.rotationZ(Math.atan2(-dx, dy)), M4.scaling(w, len + w * 0.6, 0.004));
  Shapes.box(b, m, colorFn);
}

// 화염검 '레바테인': 불꽃처럼 물결치는 검은 칼날, 시뻘겋게 달궈진 날 + 가운데 용암 홈과 갈라진 틈,
// 위로 휜 뿔 모양 날밑, 붉은 보석
function buildLaevateinn() {
  const b = new MeshBuilder();
  const rnd = Utils.rng(81);
  const sm = { smooth: true };
  const T = M4.translation, S = M4.scaling, ch = M4.chain;
  const L = WEAPONS[1].length;
  const face = rgb('#22131a', 0.35), faceLight = rgb('#3a1e24', 0.45);   // 검붉은 흑요석 (하늘이 덜 비치게 반짝임을 낮춤)
  const hot = rgb('#ff4a0c', MAT.GLOW), lava = () => rgb('#ffa424', MAT.GLOW);
  // 칼날: 단면은 8각(가운데 능선 + 양쪽 날 경사면). 날 경사면이 빛나서 칼날 테두리가 달궈진 쇠처럼 보임
  const y0 = 0.13, y1 = L - 0.17, N = 18, t = 0.016;
  const off = (y) => 0.013 * Math.sin(((y - y0) / (y1 - y0)) * Math.PI * 6);   // 칼날 전체가 불꽃처럼 물결침
  const hw = (y) => 0.088 - 0.034 * ((y - y0) / (y1 - y0));
  const ring = (y) => {
    const o = off(y), w = hw(y);
    return [[-w + o, y, 0], [-w * 0.74 + o, y, t * 0.5], [o, y, t], [w * 0.74 + o, y, t * 0.5],
      [w + o, y, 0], [w * 0.74 + o, y, -t * 0.5], [o, y, -t], [-w * 0.74 + o, y, -t * 0.5]];
  };
  const faceColor = [hot, face, faceLight, hot, hot, faceLight, face, hot];
  let prev = ring(y0);
  for (let s = 1; s <= N; s++) {
    const cur = ring(y0 + ((y1 - y0) * s) / N);
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      b.tri(prev[i], prev[j], cur[j], faceColor[i]);
      b.tri(prev[i], cur[j], cur[i], faceColor[i]);
    }
    prev = cur;
  }
  const tip = [off(y1) * 0.5, L, 0];
  for (let i = 0; i < 8; i++) b.tri(prev[i], prev[(i + 1) % 8], tip, faceColor[i]);
  // 가운데 용암 홈 + 옆으로 갈라진 틈 (양면)
  for (const fz of [-1, 1]) {
    const z = fz * (t + 0.0015);
    for (let s = 0; s < N - 1; s++) {
      const ya = y0 + 0.04 + ((y1 - y0 - 0.1) * s) / (N - 1), yb = y0 + 0.04 + ((y1 - y0 - 0.1) * (s + 1)) / (N - 1);
      addStrip(b, [off(ya), ya], [off(yb), yb], 0.011, z, lava);
      if (s % 3 === 1) {   // 갈라진 틈: 가운데에서 비스듬히 위쪽 바깥으로
        const sx = s % 6 === 1 ? 1 : -1, len = 0.03 + rnd() * 0.025;
        addStrip(b, [off(ya), ya], [off(ya) + sx * len, ya + len * 0.8], 0.006, z * 0.93, lava);
      }
    }
  }
  // 날밑: 검은 쇠 + 금 테, 양쪽으로 위로 휜 뿔, 아래로 짧은 가시
  const iron = () => vary(rgb('#2a2428', 0.8), 0.06, rnd), gold = () => vary(COLORS.gold, 0.06, rnd);
  Shapes.box(b, ch(T(0, 0.095, 0), S(0.24, 0.05, 0.06)), iron);
  Shapes.box(b, ch(T(0, 0.124, 0), S(0.25, 0.012, 0.064)), gold);
  for (const sx of [-1, 1]) {
    Shapes.segment(b, [sx * 0.1, 0.1, 0], [sx * 0.19, 0.17, 0], 0.026, 0.016, 7, gold, sm);
    Shapes.segment(b, [sx * 0.19, 0.17, 0], [sx * 0.2, 0.29, 0], 0.016, 0.002, 7, gold, sm);   // 위로 솟은 뿔
    Shapes.segment(b, [sx * 0.07, 0.075, 0], [sx * 0.12, 0.0, 0], 0.016, 0.002, 6, iron, sm);  // 아래 가시
  }
  Shapes.icosphere(b, ch(T(0, 0.098, 0), S(0.05, 0.055, 0.04)), 1, gold, sm);                 // 보석 받침
  for (const fz of [-1, 1]) Shapes.icosphere(b, ch(T(0, 0.098, fz * 0.032), S(0.028, 0.034, 0.012)), 1, () => rgb('#ff2a0a', MAT.GLOW));
  // 손잡이: 검붉은 가죽 + 금 고리, 끝에는 가시와 불씨 보석
  Shapes.cylinder(b, T(0, -0.15, 0), 0.02, 0.021, 0.23, 10, () => rgb('#4a140e'), sm);
  for (let i = 0; i < 3; i++) Shapes.cylinder(b, T(0, -0.13 + i * 0.08, 0), 0.0225, 0.0225, 0.012, 10, gold, sm);
  Shapes.icosphere(b, ch(T(0, -0.175, 0), S(0.036, 0.036, 0.036)), 1, iron, sm);
  Shapes.cylinder(b, ch(T(0, -0.19, 0), M4.rotationX(Math.PI)), 0.02, 0, 0.07, 6, gold, sm);
  Shapes.icosphere(b, ch(T(0, -0.175, 0), S(0.016, 0.016, 0.04)), 1, () => rgb('#ff6a12', MAT.GLOW));
  addGauntletFist(b, rnd);
  return b;
}

// 뇌신검 '아스트라페': 가늘고 곧은 은보랏빛 칼날 + 가운데를 달리는 지그재그 번개 무늬,
// 칼날 밑동을 감싸는 초승달 날밑과 보라 보석, 고리 모양 손잡이 끝
function buildAstrape() {
  const b = new MeshBuilder();
  const rnd = Utils.rng(82);
  const sm = { smooth: true };
  const T = M4.translation, S = M4.scaling, ch = M4.chain;
  const L = WEAPONS[2].length;
  const silver = rgb('#f0eefc', 1), silverDim = rgb('#b4acd8', 1);
  const dark = rgb('#241c3a', 0.5), darkLight = rgb('#342a52', 0.6);
  const bolt = () => rgb('#b878ff', MAT.GLOW), boltHot = () => rgb('#e2c8ff', MAT.GLOW);
  // 칼날: 8각 단면. 양쪽 날 경사면은 은빛, 가운데 넓은 면은 짙은 보랏빛 강철 → 그 위의 번개 무늬가 또렷하게
  const t = 0.012, y0 = 0.15, y1 = L - 0.15;
  const hw = (y) => 0.046 - 0.014 * ((y - y0) / (y1 - y0));
  const ring = (y) => {
    const w = hw(y);
    return [[-w, y, 0], [-w * 0.62, y, t * 0.55], [0, y, t], [w * 0.62, y, t * 0.55],
      [w, y, 0], [w * 0.62, y, -t * 0.55], [0, y, -t], [-w * 0.62, y, -t * 0.55]];
  };
  const faceColor = [silver, dark, darkLight, silverDim, silver, darkLight, dark, silverDim];
  const r0 = ring(y0), r1 = ring(y1), tip = [0, L, 0];
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    b.tri(r0[i], r0[j], r1[j], faceColor[i]);
    b.tri(r0[i], r1[j], r1[i], faceColor[i]);
    b.tri(r1[i], r1[j], tip, faceColor[i]);
  }
  // 지그재그 번개 무늬 (양면): 굵은 보라 줄기 + 가운데 하얀 심 + 꺾이는 곳마다 작은 갈래
  const rnd2 = Utils.rng(83);
  for (const fz of [-1, 1]) {
    let p = [0, y0 + 0.02];
    for (let i = 0; i < 10; i++) {
      const y = y0 + 0.02 + ((y1 - y0 - 0.04) * (i + 1)) / 10;
      const q = [(i % 2 ? -1 : 1) * 0.014 * (1 - i * 0.05), y];
      addStrip(b, p, q, 0.011, fz * (t + 0.0015), bolt);
      addStrip(b, p, q, 0.004, fz * (t + 0.0025), boltHot);
      if (i % 2 === 1 && i < 9) {
        const len = 0.025 + rnd2() * 0.02, sx = q[0] > 0 ? 1 : -1;
        addStrip(b, q, [q[0] + sx * len * 0.6, q[1] + len], 0.005, fz * (t * 0.85 + 0.0015), bolt);
      }
      p = q;
    }
  }
  // 초승달 날밑: 칼날 밑동 아래를 받치듯 둥글게 휜 은빛 테 + 양 끝 보석
  const steel = () => vary(rgb('#cfcce2', 1), 0.05, rnd), darkSteel = () => vary(rgb('#2e2648', 0.6), 0.05, rnd);
  const cy = 0.18, R = 0.135, a0 = Math.PI + 0.4, a1 = Math.PI * 2 - 0.4, n = 12;
  const arc = (a, r, z = 0) => [Math.cos(a) * r, cy + Math.sin(a) * r, z];
  for (let i = 0; i < n; i++) {
    const ta = a0 + ((a1 - a0) * i) / n, tb = a0 + ((a1 - a0) * (i + 1)) / n;
    const mid = Math.sin(Math.PI * (i + 0.5) / n);   // 가운데가 두툼
    Shapes.segment(b, arc(ta, R), arc(tb, R), 0.012 + mid * 0.016, 0.012 + mid * 0.016, 7, steel, sm);           // 은빛 바깥 테
    Shapes.segment(b, arc(ta, R - 0.03 * mid - 0.008), arc(tb, R - 0.03 * mid - 0.008), 0.008 + mid * 0.01, 0.008 + mid * 0.01, 6, darkSteel, sm);   // 안쪽 짙은 테
    for (const fz of [-1, 1]) Shapes.segment(b, arc(ta, R - 0.006, fz * (0.016 + mid * 0.012)), arc(tb, R - 0.006, fz * (0.016 + mid * 0.012)), 0.004, 0.004, 4, bolt);   // 테를 따라 흐르는 보라 빛줄기
  }
  for (const sx of [-1, 1]) {
    const ex = sx * Math.cos(0.4) * R, ey = cy - Math.sin(0.4) * R;
    Shapes.segment(b, [ex, ey, 0], [sx * 0.15, 0.25, 0], 0.01, 0.002, 6, steel, sm);           // 위로 뻗은 끝
    Shapes.icosphere(b, ch(T(ex, ey, 0), S(0.017, 0.017, 0.017)), 1, bolt, sm);
  }
  Shapes.icosphere(b, ch(T(0, 0.06, 0), S(0.04, 0.04, 0.03)), 1, steel, sm);
  for (const fz of [-1, 1]) Shapes.icosphere(b, ch(T(0, 0.06, fz * 0.024), S(0.024, 0.028, 0.01)), 1, bolt);
  // 손잡이: 검보라 끈 + 은 고리, 끝은 둥근 고리
  Shapes.cylinder(b, T(0, -0.15, 0), 0.018, 0.019, 0.2, 10, () => rgb('#251838'), sm);
  for (let i = 0; i < 3; i++) Shapes.cylinder(b, T(0, -0.13 + i * 0.075, 0), 0.0205, 0.0205, 0.01, 10, steel, sm);
  for (let i = 0; i < 10; i++) {
    const ta = (i / 10) * Math.PI * 2, tb = ((i + 1) / 10) * Math.PI * 2;
    Shapes.segment(b, [Math.sin(ta) * 0.03, -0.2 - Math.cos(ta) * 0.03, 0], [Math.sin(tb) * 0.03, -0.2 - Math.cos(tb) * 0.03, 0], 0.007, 0.007, 5, steel, sm);
  }
  Shapes.icosphere(b, ch(T(0, -0.2, 0), S(0.014, 0.014, 0.014)), 1, bolt);
  addGauntletFist(b, rnd);
  return b;
}

const Weapons = {
  index: 0,
  models: [],
  tint: [0.1, 0.58, 1],   // 지금 갑옷 빛줄기 색 (바꾸면 부드럽게 바뀜)
  switchAge: 9,           // 무기를 바꾼 뒤 지난 시간 (HUD 연출)

  get cur() { return WEAPONS[this.index]; },
  get stats() { return CONFIG.weapons[this.cur.id]; },
  get meshName() { return 'weapon' + this.index; },

  build() {
    this.models = [Models.sword, buildLaevateinn(), buildAstrape()];
    this.tint = Utils.color(this.cur.glow).slice(0, 3);
  },

  // 무기 바꾸기: 손에 빛이 모이며 새 무기가 나타남
  equip(i, p) {
    if (i === this.index || i < 0 || i >= WEAPONS.length) return;
    this.index = i;
    this.switchAge = 0;
    p.attackPower = this.stats.attack;
    Skills.summon(p);
    UI.toast(`${this.cur.name}  —  ${this.cur.title} (${this.cur.element})`);
  },

  update(dt, p) {
    this.switchAge += dt;
    const target = Utils.color(this.cur.glow);
    for (let k = 0; k < 3; k++) this.tint[k] += (target[k] - this.tint[k]) * Math.min(1, dt * 6);
    // 불타는 적: 불꽃이 피어오르고 0.5초마다 작은 피해
    const fire = CONFIG.weapons.laevateinn;
    for (const e of Enemies.list) {
      if (!(e.burn > 0) || e.dead) continue;
      e.burn -= dt;
      e.burnTick -= dt;
      if (Math.random() < dt * 26) {
        const a = Math.random() * 6.283, r = Math.random() * e.radius;
        Particles.flame(e.x + Math.cos(a) * r, e.groundY + 0.1 + Math.random() * e.hitHeight * 1.4, e.z + Math.sin(a) * r, 0.22 + Math.random() * 0.12);
      }
      if (e.burnTick <= 0) {
        e.burnTick = 0.5;
        Enemies.dot(e, fire.burn, p, '#ffa060');
      }
    }
  },

  // 적을 벤 순간의 속성 효과. chain: 번개가 튀는 공격인지 (일반 칼질·돌진)
  onHit(e, p, chain) {
    const id = this.cur.id;
    if (id === 'laevateinn') {
      if (!(e.burn > 0)) e.burnTick = 0.5;
      e.burn = CONFIG.weapons.laevateinn.burnTime;
      Particles.flameBurst(e.x, e.groundY + e.hitHeight, e.z, 6, 0.3, 1.5);
    } else if (id === 'astrape' && chain) {
      Skills.chain(e, p);
    }
  },

  // 3인칭: 칼날에서 피어오르는 기운 (빛 알갱이 / 불꽃 / 보랏빛 알갱이. 번개 불꽃은 Skills.buildGlow에서)
  aura(dt, p) {
    const w = this.cur, busy = p.isAttacking || p.spinTimer > 0 || p.dashTimer > 0;
    const along = () => M4.transformPoint(Character.swordM, [0, 0.2 + Math.random() * (w.length - 0.25), 0]);
    if (w.id === 'laevateinn') {
      if (Math.random() < dt * (busy ? 80 : 30)) {
        const q = along();
        Particles.flame(q[0], q[1], q[2], 0.12 + Math.random() * 0.1, undefined, 0.4);
      }
      if (Math.random() < dt * 8) {
        const q = along();
        Particles.ember(q[0], q[1], q[2]);
      }
    } else if (Math.random() < dt * (busy ? 40 : 10)) {
      const q = along();
      Particles.mote(q[0], q[1], q[2], w.spark);
    }
  },
};
