// 적: 슬라임·고블린·해골 궁수·박쥐의 모습(3D 모델)과 행동(AI), 그리고 화살
// 능력치는 config.js의 enemies, 구역별 마릿수는 config.js의 levels에서 정합니다.

// 적 색 (네 번째 값: 0~1 반짝임, MAT.GLOW는 스스로 빛남, MAT.CLOTH는 천)
const MON = {
  slime: Utils.color('#46b4e0', 0.7),
  dark: Utils.color('#0c1016'),
  white: Utils.color('#ffffff'),
  // (야숨풍: 아주 어두운 보라·갈색을 한 단계 밝혀 밝은 숲에서 검은 덩어리로 보이지 않게)
  skin: Utils.color('#c85a46'),
  skinLight: Utils.color('#e8a286'),
  tusk: Utils.color('#efe6cc'),
  gobEye: Utils.color('#ffd23a', MAT.GLOW),
  loin: Utils.color('#74502f', MAT.CLOTH),
  wood: Utils.color('#7a5230', MAT.BARK),
  spike: Utils.color('#cfc6b0'),
  bone: Utils.color('#e8e1c8'),
  boneDark: Utils.color('#a39b80'),
  redGlow: Utils.color('#ff3a24', MAT.GLOW),
  rust: Utils.color('#6e5a4a', 0.3),
  rag: Utils.color('#56466a', MAT.CLOTH),
  bow: Utils.color('#5e3c22'),
  string: Utils.color('#e8e0d0'),
  shaft: Utils.color('#8a6a42'),
  steel: Utils.color('#c8d0d8', 0.9),
  fletch: Utils.color('#c0302a'),
  leather: Utils.color('#5a4030'),
  leatherLight: Utils.color('#86603c'),
  iron: Utils.color('#6a7078', 0.6),
  hood: Utils.color('#44385a', MAT.CLOTH),
  shine: Utils.color('#ffffff', MAT.GLOW),
  batFur: Utils.color('#4a3858', MAT.CLOTH),
  batWing: Utils.color('#382a48', MAT.CLOTH),
  batBone: Utils.color('#1c1424'),
  batEar: Utils.color('#8a5274'),
  batEye: Utils.color('#ff5a2a', MAT.GLOW),
};
const SLIME_TINTS = [[1, 1, 1], [0.6, 1.2, 0.55], [1.3, 0.7, 1.15]];   // 파랑·초록·보라 슬라임

const col = (k) => () => MON[k];
const SM = { smooth: true };
function makePart(fn) {
  const b = new MeshBuilder();
  fn(b);
  return b;
}

// ---------- 모델 ----------

// 슬라임: 말랑한 젤리 몸 + 반짝이는 눈 (앞쪽은 -z)
function buildSlime() {
  return makePart((b) => {
    Shapes.icosphere(b, M4.chain(M4.translation(0, 0.42, 0), M4.scaling(0.55, 0.45, 0.55)), 3, col('slime'), SM);
    for (const sx of [-1, 1]) {
      Shapes.icosphere(b, M4.chain(M4.translation(sx * 0.16, 0.52, -0.5), M4.scaling(0.07, 0.1, 0.05)), 1, col('dark'), SM);
      Shapes.icosphere(b, M4.chain(M4.translation(sx * 0.16 + 0.025, 0.56, -0.545), M4.scaling(0.025, 0.03, 0.012)), 1, col('white'), SM);
    }
    Shapes.icosphere(b, M4.chain(M4.translation(0, 0.4, -0.52), M4.scaling(0.05, 0.035, 0.03)), 1, col('dark'), SM);              // 동그랗게 벌린 입
    Shapes.icosphere(b, M4.chain(M4.translation(-0.22, 0.7, -0.3), M4.rotationZ(0.6), M4.scaling(0.11, 0.05, 0.05)), 1, col('shine'), SM);   // 젤리 윤기
    Shapes.icosphere(b, M4.chain(M4.translation(-0.1, 0.78, -0.24), M4.scaling(0.035, 0.03, 0.03)), 1, col('shine'), SM);
  });
}

// 고블린: 큰 머리, 뾰족한 귀, 송곳니, 가시 박힌 몽둥이
function buildGoblinParts() {
  const T = M4.translation, S = M4.scaling, ch = M4.chain;
  return {
    gPelvis: makePart((b) => {
      Shapes.cylinder(b, ch(T(0, -0.08, 0), S(1, 1, 0.8)), 0.15, 0.16, 0.14, 10, col('loin'), SM);
      Shapes.box(b, ch(T(0, -0.16, -0.12), S(0.16, 0.2, 0.02)), col('loin'));
      Shapes.cylinder(b, ch(T(0, -0.01, 0), S(1, 1, 0.82)), 0.165, 0.165, 0.05, 12, col('leather'), SM);   // 허리띠
      Shapes.icosphere(b, ch(T(0, 0.015, -0.135), S(0.045, 0.045, 0.02)), 1, col('bone'), SM);              // 해골 버클
    }),
    gTorso: makePart((b) => {   // 구부정하고 어깨가 넓은 몸 + 가죽 띠 + 오른쪽 가시 어깨받이 + 이빨 목걸이
      Shapes.cylinder(b, S(1, 1, 0.85), 0.16, 0.2, 0.38, 12, col('skin'), SM);
      Shapes.icosphere(b, ch(T(0, 0.14, -0.09), S(0.12, 0.13, 0.08)), 1, col('skinLight'), SM);   // 배
      Shapes.box(b, ch(T(0, 0.2, 0), M4.rotationZ(0.75), S(0.05, 0.56, 0.36)), col('leather'));    // 어깨에서 허리로 걸친 띠
      Shapes.icosphere(b, ch(T(0.19, 0.36, 0), M4.rotationZ(-0.4), S(0.13, 0.08, 0.13)), 2, col('leatherLight'), SM);   // 어깨받이
      for (let i = 0; i < 3; i++) {
        Shapes.cylinder(b, ch(T(0.17 + i * 0.04, 0.42 - i * 0.02, -0.04 + i * 0.04), M4.rotationZ(-0.5)), 0.022, 0, 0.1, 6, col('spike'), SM);
      }
      for (let i = 0; i < 7; i++) {   // 이빨 목걸이
        const a = -1.1 + (i / 6) * 2.2;
        Shapes.cylinder(b, ch(T(Math.sin(a) * 0.13, 0.31 - Math.cos(a) * 0.04, -Math.cos(a) * 0.12), M4.rotationX(Math.PI)), 0.014, 0, 0.05, 5, col('tusk'), SM);
      }
    }),
    gHead: makePart((b) => {
      Shapes.icosphere(b, ch(T(0, 0.17, 0), S(0.21, 0.19, 0.2)), 2, col('skin'), SM);
      Shapes.icosphere(b, ch(T(0, 0.12, -0.19), S(0.07, 0.06, 0.08)), 1, col('skinLight'), SM);   // 매부리코
      Shapes.icosphere(b, ch(T(0, 0.04, -0.12), S(0.15, 0.065, 0.1)), 1, col('skin'), SM);        // 턱
      Shapes.box(b, ch(T(0, 0.055, -0.205), S(0.13, 0.018, 0.02)), col('dark'));                   // 다문 입
      for (const sx of [-1, 1]) {
        Shapes.cylinder(b, T(sx * 0.065, 0.045, -0.2), 0.022, 0, 0.09, 6, col('tusk'), SM);           // 아래에서 솟은 송곳니
        Shapes.icosphere(b, ch(T(sx * 0.08, 0.215, -0.17), S(0.045, 0.04, 0.03)), 1, col('gobEye'), SM);
        Shapes.icosphere(b, ch(T(sx * 0.08, 0.215, -0.197), S(0.012, 0.028, 0.01)), 0, col('dark'), SM);   // 세로로 찢어진 눈동자
        Shapes.box(b, ch(T(sx * 0.085, 0.27, -0.185), M4.rotationZ(sx * 0.45), S(0.11, 0.03, 0.04)), col('skin'));   // 찌푸린 눈썹 뼈
        Shapes.cylinder(b, ch(T(sx * 0.19, 0.2, 0.02), M4.rotationZ(-sx * 1.3), M4.rotationX(0.25)), 0.06, 0, 0.32, 8, col('skin'), SM);   // 귀
      }
      // 가죽 투구 + 휘어진 뿔 두 개
      Shapes.icosphere(b, ch(T(0, 0.27, 0.01), S(0.225, 0.13, 0.215)), 2, col('leather'), SM);
      Shapes.cylinder(b, ch(T(0, 0.255, 0.01), S(1, 1, 0.96)), 0.222, 0.222, 0.03, 16, col('iron'), SM);
      for (const sx of [-1, 1]) {
        const pts = [[sx * 0.14, 0.32, 0], [sx * 0.24, 0.4, 0.02], [sx * 0.29, 0.52, 0.04], [sx * 0.27, 0.62, 0.02]], rad = [0.05, 0.036, 0.022, 0.003];
        for (let i = 0; i < 3; i++) Shapes.segment(b, pts[i], pts[i + 1], rad[i], rad[i + 1], 7, col('tusk'), SM);
      }
    }),
    gArm: makePart((b) => Shapes.cylinder(b, T(0, -0.22, 0), 0.042, 0.05, 0.22, 8, col('skin'), SM)),
    gForearm: makePart((b) => {
      Shapes.cylinder(b, T(0, -0.2, 0), 0.038, 0.044, 0.2, 8, col('skin'), SM);
      Shapes.icosphere(b, ch(T(0, -0.22, 0), S(0.055, 0.06, 0.055)), 1, col('skin'), SM);   // 주먹
    }),
    gLeg: makePart((b) => Shapes.cylinder(b, T(0, -0.26, 0), 0.055, 0.07, 0.26, 8, col('skin'), SM)),
    gShin: makePart((b) => {
      Shapes.cylinder(b, T(0, -0.26, 0), 0.045, 0.055, 0.26, 8, col('skin'), SM);
      Shapes.box(b, ch(T(0, -0.27, -0.04), S(0.09, 0.05, 0.17)), col('skin'));
    }),
    gClub: makePart((b) => {   // 손에서 앞(-z)으로 뻗은 몽둥이
      const fwd = M4.rotationX(-Math.PI / 2);
      Shapes.cylinder(b, ch(fwd, T(0, -0.08, 0)), 0.028, 0.03, 0.3, 7, col('wood'), SM);
      Shapes.cylinder(b, ch(fwd, T(0, 0.2, 0)), 0.05, 0.085, 0.42, 9, col('wood'), SM);
      for (const y of [0.28, 0.5]) Shapes.cylinder(b, ch(fwd, T(0, y, 0)), 0.075 + (y - 0.2) * 0.04, 0.078 + (y - 0.2) * 0.04, 0.03, 9, col('iron'), SM);   // 쇠테
      for (let i = 0; i < 6; i++) {
        const a = i * 2.1, y = 0.3 + (i % 3) * 0.1;
        Shapes.cylinder(b, ch(fwd, T(Math.cos(a) * 0.07, y, Math.sin(a) * 0.07), M4.rotationY(-a), M4.rotationZ(-Math.PI / 2)), 0.018, 0, 0.07, 5, col('spike'));
      }
    }),
  };
}

// 해골 궁수: 뼈대, 붉게 빛나는 눈, 녹슨 투구, 누더기, 활
function buildSkeletonParts() {
  const T = M4.translation, S = M4.scaling, ch = M4.chain;
  return {
    sPelvis: makePart((b) => {
      Shapes.icosphere(b, ch(T(0, -0.02, 0), S(0.15, 0.08, 0.1)), 1, col('bone'), SM);
      Shapes.box(b, ch(T(0, -0.12, -0.06), M4.rotationX(0.2), S(0.22, 0.16, 0.03)), col('rag'));
    }),
    sTorso: makePart((b) => {
      Shapes.cylinder(b, M4.identity(), 0.025, 0.025, 0.52, 6, col('boneDark'), SM);   // 등뼈
      for (let i = 0; i < 4; i++) {                                                     // 갈비뼈
        const r = 0.14 - i * 0.008;
        Shapes.cylinder(b, ch(T(0, 0.2 + i * 0.075, 0), S(1, 1, 0.72)), r, r - 0.01, 0.025, 12, col('bone'), { smooth: true, top: false });
      }
      Shapes.box(b, ch(T(0, 0.48, 0), S(0.34, 0.035, 0.06)), col('bone'));               // 쇄골
      Shapes.box(b, ch(T(0.03, 0.3, 0.02), M4.rotationZ(0.5), S(0.06, 0.55, 0.26)), col('rag'));   // 어깨에 걸친 누더기
      // 등에 멘 화살통 (빨간 깃이 삐죽)
      const q = ch(T(-0.06, 0.32, 0.1), M4.rotationZ(-0.45));
      Shapes.cylinder(b, ch(q, T(0, -0.2, 0)), 0.05, 0.055, 0.4, 8, col('leatherLight'), SM);
      for (let i = 0; i < 4; i++) {
        const ox = (i % 2 - 0.5) * 0.04, oz = (i < 2 ? -0.5 : 0.5) * 0.04;
        Shapes.cylinder(b, ch(q, T(ox, 0.2, oz)), 0.006, 0.006, 0.08, 4, col('shaft'));
        Shapes.box(b, ch(q, T(ox, 0.25, oz), S(0.008, 0.06, 0.03)), col('fletch'));
      }
      // 등 뒤로 늘어진 찢어진 망토 자락
      for (let i = 0; i < 3; i++) Shapes.box(b, ch(T(-0.1 + i * 0.1, 0.12 - (i % 2) * 0.05, 0.11), M4.rotationX(0.12), S(0.1, 0.6 - (i % 2) * 0.12, 0.012)), col('hood'));
    }),
    sSkull: makePart((b) => {   // 해골 + 붉게 타는 눈 + 뒤로 뾰족한 두건
      Shapes.icosphere(b, ch(T(0, 0.14, 0.01), S(0.12, 0.13, 0.14)), 2, col('bone'), SM);
      Shapes.box(b, ch(T(0, 0.04, -0.06), S(0.1, 0.05, 0.09)), col('boneDark'));         // 턱
      for (let i = 0; i < 5; i++) Shapes.box(b, ch(T(-0.04 + i * 0.02, 0.07, -0.106), S(0.012, 0.022, 0.01)), col('bone'));   // 이빨
      for (const sx of [-1, 1]) {
        Shapes.icosphere(b, ch(T(sx * 0.045, 0.14, -0.11), S(0.038, 0.04, 0.03)), 1, col('dark'), SM);
        Shapes.icosphere(b, ch(T(sx * 0.045, 0.14, -0.128), S(0.019, 0.019, 0.012)), 1, col('redGlow'), SM);
      }
      Shapes.icosphere(b, ch(T(0, 0.17, 0.06), S(0.165, 0.18, 0.16)), 2, col('hood'), SM);           // 두건 (얼굴은 앞으로 드러남)
      Shapes.segment(b, [0, 0.27, 0.12], [0, 0.22, 0.34], 0.07, 0.005, 7, col('hood'), SM);           // 두건 끝
    }),
    sBone: makePart((b) => {
      Shapes.cylinder(b, T(0, -0.28, 0), 0.02, 0.025, 0.28, 6, col('bone'), SM);
      Shapes.icosphere(b, S(0.035, 0.035, 0.035), 0, col('bone'), SM);
    }),
    sBone2: makePart((b) => {
      Shapes.cylinder(b, T(0, -0.26, 0), 0.018, 0.022, 0.26, 6, col('bone'), SM);
      Shapes.icosphere(b, S(0.03, 0.03, 0.03), 0, col('boneDark'), SM);
      Shapes.box(b, ch(T(0, -0.29, 0), S(0.05, 0.07, 0.03)), col('bone'));   // 손
    }),
    sThigh: makePart((b) => Shapes.cylinder(b, T(0, -0.45, 0), 0.024, 0.03, 0.45, 6, col('bone'), SM)),
    sShin: makePart((b) => {
      Shapes.icosphere(b, S(0.035, 0.035, 0.035), 0, col('boneDark'), SM);
      Shapes.cylinder(b, T(0, -0.45, 0), 0.02, 0.026, 0.45, 6, col('bone'), SM);
      Shapes.box(b, ch(T(0, -0.46, -0.04), S(0.07, 0.03, 0.14)), col('bone'));   // 발
    }),
    sBow: makePart((b) => {   // 활: 겨눌 때 세로로 서도록 (손 기준 z 방향으로 뻗음)
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const a = -1.2 + (i / 8) * 2.4;
        pts.push([0, -0.04 + (1 - Math.cos(a)) * 0.28, Math.sin(a) * 0.55]);
      }
      for (let i = 0; i < 8; i++) Shapes.segment(b, pts[i], pts[i + 1], 0.02, 0.02, 6, col('bow'), SM);
      Shapes.segment(b, pts[0], pts[8], 0.005, 0.005, 4, col('string'));
    }),
  };
}

// 박쥐: 동그란 털북숭이 몸, 큰 귀, 빛나는 눈, 송곳니. 날개는 따로 (펄럭이도록)
function buildBatParts() {
  const T = M4.translation, S = M4.scaling, ch = M4.chain;
  // 날개 하나: 몸 쪽 뿌리가 원점, 바깥(side 쪽 x)으로 뻗은 팔뼈와 손가락뼈 사이에 얇은 막 (앞뒤 양면)
  const wing = (side) => makePart((b) => {
    const root = [0, 0, 0], elbow = [side * 0.2, 0.05, -0.05], wrist = [side * 0.4, 0.03, -0.03];
    const tips = [[side * 0.66, -0.01, 0.02], [side * 0.6, -0.08, 0.15], [side * 0.42, -0.1, 0.24], [side * 0.18, -0.05, 0.2]];
    const membrane = [[root, elbow, tips[3]], [elbow, wrist, tips[3]], [wrist, tips[2], tips[3]], [wrist, tips[1], tips[2]], [wrist, tips[0], tips[1]]];
    for (const [a, c, d] of membrane) {
      b.tri(a, c, d, MON.batWing);
      b.tri(a, d, c, MON.batWing);
    }
    Shapes.segment(b, root, elbow, 0.022, 0.018, 5, col('batBone'));
    Shapes.segment(b, elbow, wrist, 0.018, 0.014, 5, col('batBone'));
    for (const t of tips.slice(0, 3)) Shapes.segment(b, wrist, t, 0.01, 0.004, 4, col('batBone'));
    Shapes.segment(b, wrist, V3.add(wrist, [side * 0.02, 0.06, -0.03]), 0.012, 0.002, 4, col('batBone'));   // 날개 끝 갈고리
  });
  return {
    batBody: makePart((b) => {
      Shapes.icosphere(b, S(0.15, 0.13, 0.19), 2, col('batFur'), SM);
      Shapes.icosphere(b, ch(T(0, 0.06, -0.17), S(0.11, 0.1, 0.1)), 2, col('batFur'), SM);        // 머리
      Shapes.icosphere(b, ch(T(0, 0.03, -0.26), S(0.045, 0.035, 0.04)), 1, col('batEar'), SM);     // 들창코
      for (const sx of [-1, 1]) {
        Shapes.segment(b, [sx * 0.05, 0.12, -0.17], [sx * 0.11, 0.3, -0.13], 0.05, 0.005, 6, col('batFur'), SM);   // 큰 귀
        Shapes.segment(b, [sx * 0.055, 0.13, -0.185], [sx * 0.1, 0.26, -0.15], 0.028, 0.004, 5, col('batEar'), SM);
        Shapes.icosphere(b, ch(T(sx * 0.045, 0.08, -0.255), S(0.024, 0.026, 0.015)), 1, col('batEye'), SM);
        Shapes.segment(b, [sx * 0.02, 0.0, -0.25], [sx * 0.02, -0.05, -0.245], 0.009, 0.0, 4, col('white'));       // 송곳니
        Shapes.segment(b, [sx * 0.05, -0.08, 0.1], [sx * 0.05, -0.16, 0.18], 0.015, 0.01, 4, col('batBone'));      // 늘어진 다리
      }
    }),
    batWingR: wing(1),
    batWingL: wing(-1),
  };
}

// 화살 (앞쪽은 -z)
function buildArrow() {
  return makePart((b) => {
    Shapes.segment(b, [0, 0, 0.38], [0, 0, -0.34], 0.011, 0.011, 5, col('shaft'));
    Shapes.segment(b, [0, 0, -0.34], [0, 0, -0.46], 0.028, 0.001, 6, col('steel'));
    for (let i = 0; i < 3; i++) {
      const a = i * 2.094;
      Shapes.box(b, M4.chain(M4.translation(Math.cos(a) * 0.025, Math.sin(a) * 0.025, 0.3), M4.rotationZ(a), M4.scaling(0.045, 0.004, 0.12)), col('fletch'));
    }
  });
}

// 관절: [이름, 부모 관절, 부모 기준 위치, 붙는 모델]
const GOBLIN_RIG = [
  ['hips', null, [0, 0.55, 0], 'gPelvis'],
  ['spine', 'hips', [0, 0.04, 0], 'gTorso'],
  ['head', 'spine', [0, 0.38, 0], 'gHead'],
  ['shoulderR', 'spine', [0.19, 0.3, 0], 'gArm'],
  ['elbowR', 'shoulderR', [0, -0.22, 0], 'gForearm'],
  ['handR', 'elbowR', [0, -0.22, 0], 'gClub'],
  ['shoulderL', 'spine', [-0.19, 0.3, 0], 'gArm'],
  ['elbowL', 'shoulderL', [0, -0.22, 0], 'gForearm'],
  ['hipR', 'hips', [0.09, -0.03, 0], 'gLeg'],
  ['kneeR', 'hipR', [0, -0.26, 0], 'gShin'],
  ['hipL', 'hips', [-0.09, -0.03, 0], 'gLeg'],
  ['kneeL', 'hipL', [0, -0.26, 0], 'gShin'],
];

const SKELETON_RIG = [
  ['hips', null, [0, 0.93, 0], 'sPelvis'],
  ['spine', 'hips', [0, 0.04, 0], 'sTorso'],
  ['head', 'spine', [0, 0.53, 0], 'sSkull'],
  ['shoulderR', 'spine', [0.18, 0.46, 0], 'sBone'],
  ['elbowR', 'shoulderR', [0, -0.28, 0], 'sBone2'],
  ['shoulderL', 'spine', [-0.18, 0.46, 0], 'sBone'],
  ['elbowL', 'shoulderL', [0, -0.28, 0], 'sBone2'],
  ['handL', 'elbowL', [0, -0.29, 0], 'sBow'],
  ['hipR', 'hips', [0.09, -0.03, 0], 'sThigh'],
  ['kneeR', 'hipR', [0, -0.45, 0], 'sShin'],
  ['hipL', 'hips', [-0.09, -0.03, 0], 'sThigh'],
  ['kneeL', 'hipL', [0, -0.45, 0], 'sShin'],
];

const BAT_RIG = [
  ['body', null, [0, 0, 0], 'batBody'],
  ['wingR', 'body', [0.1, 0.04, -0.02], 'batWingR'],
  ['wingL', 'body', [-0.1, 0.04, -0.02], 'batWingL'],
];

// ---------- 움직임(포즈) ----------

function poseGoblin(e, time) {
  const amt = Utils.clamp(Math.hypot(e.vx, e.vz) / 3, 0, 1);
  const s = Math.sin(e.walk), co = Math.cos(e.walk);
  const pose = {
    hips: J(0, s * 0.15 * amt),
    spine: J(-0.15 - 0.15 * amt, 0),
    head: J(0.1 + Math.sin(time * 3 + e.seed * 9) * 0.05, Math.sin(time * 1.3 + e.seed * 5) * 0.25 * (1 - amt)),
    hipR: J(s * 0.8 * amt, 0, 0.06), kneeR: J(-(0.1 + Math.max(0, co) * 1.2 * amt)),
    hipL: J(-s * 0.8 * amt, 0, -0.06), kneeL: J(-(0.1 + Math.max(0, -co) * 1.2 * amt)),
    shoulderR: J(0.5 - s * 0.3 * amt, 0, 0.25), elbowR: J(0.9),
    shoulderL: J(s * 0.6 * amt, 0, -0.3), elbowL: J(0.5),
  };
  let hips = 0.55 - 0.03 * amt + Math.abs(co) * 0.05 * amt;
  hitReact(e, pose);
  if (e.dead) {   // 쓰러짐: 팔다리가 축 늘어짐
    blendPose(pose, { spine: J(0.35), head: J(-0.5), shoulderR: J(0.3, 0, 1.2), elbowR: J(0.3), shoulderL: J(0.3, 0, -1.2), elbowL: J(0.3),
      hipR: J(0.7), kneeR: J(-0.6), hipL: J(0.3), kneeL: J(-0.9) }, Utils.smooth((DEATH_TIME - e.deathTimer) / 0.25));
  } else if (e.state === 'windup') {   // 웅크리고 몽둥이를 치켜듦 (부들부들)
    blendPose(pose, { spine: J(0.15, 0.3), head: J(-0.15), shoulderR: J(-0.7, 0, 0.6), elbowR: J(1.6), shoulderL: J(0.4, 0, -0.5),
      hipR: J(0.6), kneeR: J(-1.0), hipL: J(-0.3), kneeL: J(-0.7) }, 1);
    pose.spine.z = Math.sin(time * 40) * 0.04;
    hips -= 0.1;
  } else if (e.state === 'charge') {   // 몸을 숙이고 몽둥이를 내밀며 돌진
    const r = Math.sin(e.walk * 2);
    blendPose(pose, { spine: J(-0.7), head: J(0.5), shoulderR: J(1.4, 0, 0.3), elbowR: J(0.2), shoulderL: J(-0.8, 0, -0.4),
      hipR: J(r * 1.0), kneeR: J(-0.4 - Math.max(0, r) * 1.2), hipL: J(-r * 1.0), kneeL: J(-0.4 - Math.max(0, -r) * 1.2) }, 1);
  } else if (e.state === 'stun') {   // 비틀비틀
    pose.head = J(0.25, Math.sin(time * 12) * 0.4);
    pose.spine = J(-0.35, 0, Math.sin(time * 9) * 0.15);
    pose.shoulderR = J(0.1, 0, 0.5);
  }
  return { pose, ys: { hips } };
}

function poseSkeleton(e, time) {
  const amt = Utils.clamp(Math.hypot(e.vx, e.vz) / 2, 0, 1);
  const s = Math.sin(e.walk), co = Math.cos(e.walk);
  const pose = {
    spine: J(-0.05, -s * 0.1 * amt),
    head: J(Math.sin(time * 1.7 + e.seed * 4) * 0.06, Math.sin(time * 0.9 + e.seed * 7) * 0.3, Math.sin(time * 2 + e.seed) * 0.05),
    hipR: J(s * 0.6 * amt), kneeR: J(-(0.05 + Math.max(0, co) * 0.9 * amt)),
    hipL: J(-s * 0.6 * amt), kneeL: J(-(0.05 + Math.max(0, -co) * 0.9 * amt)),
    shoulderL: J(0.3 + s * 0.3 * amt, 0, -0.1), elbowL: J(0.3),
    shoulderR: J(-s * 0.4 * amt, 0, 0.1), elbowR: J(0.3),
  };
  hitReact(e, pose);
  if (e.dead) {   // 쓰러짐: 뼈마디가 흐느적
    blendPose(pose, { spine: J(0.4), head: J(-0.6, 0.4), shoulderR: J(0.2, 0, 1.3), elbowR: J(0.6), shoulderL: J(0.2, 0, -1.3), elbowL: J(0.6),
      hipR: J(0.8), kneeR: J(-0.7), hipL: J(0.4), kneeL: J(-1.0) }, Utils.smooth((DEATH_TIME - e.deathTimer) / 0.25));
  } else if (e.state === 'draw') {   // 활을 들어 겨누고 시위를 당김
    const k = Utils.smooth((CONFIG.enemies.archer.drawTime - e.timer) / 0.3);
    blendPose(pose, { head: J(0, 0), shoulderL: J(1.55, 0, 0), elbowL: J(0), shoulderR: J(1.45, 0, 0.35), elbowR: J(1.9) }, k);
  }
  return { pose, ys: {} };
}

// 박쥐: 쉬지 않고 날갯짓 (예고 때는 더 빠르게, 덮칠 때는 날개를 접고 머리부터 내리꽂음)
function poseBat(e, time) {
  const fast = e.state === 'windup' ? 2.2 : 1;
  const f = Math.sin(time * 15 * fast + e.seed * 20);
  let flap = 0.25 + f * 0.85, pitch = 0;
  if (e.state === 'swoop') {
    flap = -0.6 + f * 0.1;   // 날개를 뒤로 접음
    pitch = -0.6;
  } else if (e.state === 'windup') pitch = 0.3;   // 몸을 젖히고 노려봄
  if (e.flinch > 0) pitch += 0.6 * Math.sin((e.flinch / FLINCH_TIME) * Math.PI * 0.5);
  if (e.dead) {   // 쓰러짐: 날개가 축 늘어져 파닥거림
    flap = -0.9 + Math.sin(time * 30) * 0.15 * Utils.clamp(e.deathTimer - 0.4, 0, 1);
    pitch = 0;
  }
  return { pose: { body: J(pitch, 0, Math.sin(time * 3 + e.seed * 7) * 0.15), wingR: J(0, 0, flap), wingL: J(0, 0, -flap) }, ys: {} };
}

// 맞은 순간 움찔: 상체가 뒤로 젖혀지고 팔이 들림 (금방 돌아옴)
const FLINCH_TIME = 0.28;
function hitReact(e, pose) {
  if (!(e.flinch > 0) || e.dead) return;
  const k = Math.sin((e.flinch / FLINCH_TIME) * Math.PI * 0.5);   // 맞자마자 크게 → 서서히 돌아옴
  blendPose(pose, { spine: J(0.45, (e.seed - 0.5) * 0.6), head: J(-0.45), shoulderR: J(-0.2, 0, 0.8), shoulderL: J(-0.2, 0, -0.8), elbowR: J(0.4), elbowL: J(0.4) }, k);
}

const DEATH_TIME = 1.0;   // 쓰러진 뒤 사라질 때까지 (마지막 0.3초 동안 무기 속성대로 흩어짐)

// ---------- 적 하나 ----------

class Enemy {
  constructor(type, x, z, rnd) {
    const s = CONFIG.enemies[type];
    this.type = type;
    this.x = x;
    this.z = z;
    this.homeX = x;             // 처음 자리 (돌아다니는 중심)
    this.homeZ = z;
    this.radius = s.radius;
    this.maxHp = s.hp;
    this.hp = s.hp;
    this.facing = rnd() * Math.PI * 2;
    this.vx = 0;                // 걷는 속도
    this.vz = 0;
    this.kx = 0;                // 맞고 밀려나는 속도
    this.kz = 0;
    this.state = 'idle';        // idle 돌아다님 / chase 쫓아감 / 그 밖의 종류별 상태
    this.timer = rnd() * 2;
    this.cool = 0;              // 다음 공격까지 남은 시간
    this.flash = 0;             // 맞았을 때 하얗게 번쩍
    this.alert = 0;             // 전사를 알아챘을 때 머리 위 '!'
    this.hpShow = 0;            // 체력 막대를 보여 줄 시간
    this.dead = false;
    this.deathTimer = 0;
    this.walk = 0;
    this.seed = rnd();
    this.groundY = World.groundHeight(x, z);
    this.lastSwing = -1;        // 같은 칼질에 두 번 맞지 않게
    this.hop = 0;               // 슬라임: 공중에 떠 있는 남은 시간
    this.hopTime = 0;
    this.hopDir = { x: 0, y: 0 };
    this.hopSpeed = 0;
    this.squash = 0;
    this.chargeDir = { x: 0, y: 0 };
    this.tint = type === 'slime' ? SLIME_TINTS[(rnd() * SLIME_TINTS.length) | 0] : [1, 1, 1];
    this.flinch = 0;            // 맞고 움찔하는 남은 시간
    this.dy = 0;                // 쓰러질 때 공중으로 뜬 높이와 속도
    this.dvy = 0;
    this.tumble = 0;            // 뒤로 넘어간 각도
    this.deathKind = null;      // 쓰러뜨린 무기 속성 (흩어지는 모습이 다름)
    this.deathFx = false;
    this.landed = false;
    this.fly = type === 'bat' ? s.flyHeight : 0;   // 박쥐: 땅에서 떠 있는 높이
    this.target = null;                              // 박쥐: 덮칠 자리
    if (type === 'golem') {   // 보스 (boss.js)
      this.boss = true;
      this.state = 'sleep';
      this.facing = Math.PI;      // 들어오는 쪽(서쪽)을 바라보며 잠듦
      this.poise = s.poise;       // 이만큼 피해가 쌓이면 무릎 꿇음
      this.phase = 1;             // 2 = 분노
      this.throwCool = 3;
      this.waves = [];            // 내리친 자리의 충격파
      this.hpLag = s.hp;          // 체력 막대의 하얀 잔상
    }
  }

  // 맞는 부위 높이 (불똥·숫자가 뜨는 곳)
  get hitHeight() {
    if (this.type === 'bat') return this.fly + 0.12;
    if (this.type === 'golem') return 2.5;
    return { slime: 0.45, goblin: 0.9, archer: 1.25 }[this.type];
  }

  // 머리 위 표시('!'·체력 막대)를 띄울 높이
  get markHeight() {
    return this.type === 'bat' ? this.fly + 0.5 : this.hitHeight * 1.5 + 0.35;
  }

  get hopY() {
    if (this.hop <= 0) return 0;
    return Math.sin((1 - this.hop / this.hopTime) * Math.PI) * (this.hopTime > 0.5 ? 0.75 : 0.4);
  }

  hit(damage, fromX, fromZ) {
    if (this.dead) return;
    if (this.boss) {
      Golem.hit(this, damage);
      return;
    }
    this.hp -= damage;
    this.flash = 0.15;
    this.hpShow = 4;
    this.flinch = FLINCH_TIME;
    if (this.type === 'slime') this.squash = -0.3;   // 슬라임은 맞으면 납작
    const d = Utils.normalize(this.x - fromX, this.z - fromZ);
    const push = this.type === 'goblin' ? 4 : this.type === 'slime' ? 7 : 5;
    this.kx = d.x * push;
    this.kz = d.y * push;
    if (this.state === 'idle') {
      this.state = 'chase';
      this.alert = 0.8;
    }
    if (this.type === 'goblin' && (this.state === 'windup' || this.state === 'charge')) {   // 돌진을 끊음
      this.state = 'stun';
      this.timer = 0.5;
    }
    if (this.type === 'archer' && this.state === 'draw') {   // 겨누기를 끊음
      this.state = 'chase';
      this.cool = 1;
    }
    if (this.type === 'bat' && (this.state === 'windup' || this.state === 'swoop')) {   // 덮치기를 끊고 휘청이며 떠오름
      this.state = 'recover';
      this.timer = 1.0;
      this.cool = CONFIG.enemies.bat.swoopCooldown;
    }
    if (this.hp <= 0) {   // 쓰러짐: 맞은 반대쪽으로 날아가며 뒤로 넘어짐 → 땅에 떨어진 뒤 무기 속성대로 흩어짐
      this.dead = true;
      this.deathTimer = DEATH_TIME;
      this.deathKind = Weapons.cur.id;
      this.facing = Math.atan2(fromZ - this.z, fromX - this.x);   // 때린 쪽을 보게 → 뒤로 넘어감
      if (this.type === 'bat') {   // 날던 높이에서 떨어짐
        this.dy = this.fly;
        this.fly = 0;
      }
      const heavy = Math.min(1, damage / 30);   // 센 공격일수록 높이·멀리
      this.dvy = 3 + heavy * 3.5;
      this.kx *= 1.5 + heavy;
      this.kz *= 1.5 + heavy;
      Particles.sparks(this.x, this.groundY + this.hitHeight, this.z, 14, Weapons.cur.spark);
      Sound.play('die', { type: this.type, x: this.x, z: this.z, range: 40 });
    }
  }

  // 쓰러진 뒤: 날아갔다 떨어지고, 무기 속성대로 타오르거나(불) 감전되거나(번개) 빛나다가(빛) 흩어짐
  updateDeath(dt) {
    this.deathTimer -= dt;
    this.dvy -= 16 * dt;
    this.dy += this.dvy * dt;
    if (this.dy < 0) {   // 땅에 떨어짐: 흙먼지 + 작게 튕김
      this.dy = 0;
      if (!this.landed) {
        this.landed = true;
        Particles.dust(this.x, this.groundY, this.z, 6, 0.8);
        this.dvy = 1.6;
      } else this.dvy = 0;
      if (this.type === 'slime') this.squash = -0.4;
    }
    if (this.type !== 'slime') this.tumble += (1.5 - this.tumble) * Math.min(1, dt * 9);
    World.moveEntity(this, this.kx * dt, this.kz * dt);
    const kd = Math.max(0, 1 - dt * 4);
    this.kx *= kd;
    this.kz *= kd;
    this.groundY += (World.groundHeight(this.x, this.z) - this.groundY) * Math.min(1, dt * 12);
    const x = this.x, z = this.z, h = this.hitHeight, y = this.groundY + this.dy;
    const rand = () => [x + (Math.random() - 0.5) * this.radius * 2, y + Math.random() * h * 1.3, z + (Math.random() - 0.5) * this.radius * 2];
    if (this.deathKind === 'laevateinn' && Math.random() < dt * 45) {   // 온몸이 불타오름
      const q = rand();
      Particles.flame(q[0], q[1], q[2], 0.3 + Math.random() * 0.2, undefined, 0.5);
    } else if (this.deathKind === 'balmung' && Math.random() < dt * 30) {   // 빛 알갱이가 피어오름
      const q = rand();
      Particles.mote(q[0], q[1], q[2], WEAPONS[0].spark);
    }
    if (this.deathTimer <= 0.3 && !this.deathFx) {   // 마지막: 흩어짐
      this.deathFx = true;
      const cy = y + h * 0.6;
      if (this.deathKind === 'laevateinn') {   // 재가 되어 무너짐: 검은 재 연기 + 불씨
        Particles.smoke(x, cy, z, 14, [0.12, 0.1, 0.1]);
        Particles.flameBurst(x, y + 0.1, z, 10, this.radius, 1.5, 0.35);
        for (let i = 0; i < 14; i++) Particles.ember(x + (Math.random() - 0.5) * 0.8, cy, z + (Math.random() - 0.5) * 0.8);
      } else if (this.deathKind === 'astrape') {   // 번쩍 하고 보랏빛 불똥으로 터짐
        Particles.sparks(x, cy, z, 30, WEAPONS[2].spark);
        Particles.smoke(x, cy, z, 8);
        Skills.impact(x, cy, z, 1.0, WEAPONS[2]);
      } else {   // 보라 연기 + 빛 알갱이로 흩어짐
        Particles.smoke(x, cy, z, 14);
        Particles.sparks(x, cy, z, 16, [0.85, 0.7, 1]);
        for (let i = 0; i < 14; i++) Particles.glitter(x, y + Math.random() * h * 1.5, z);
        Skills.impact(x, cy, z, 0.8, WEAPONS[0]);
      }
    }
  }

  face(angle, k) {
    const diff = Math.atan2(Math.sin(angle - this.facing), Math.cos(angle - this.facing));
    this.facing += diff * Math.min(1, k);
  }

  // 목표 쪽으로 걸음 (faceMove면 걷는 쪽을 바라봄)
  steer(tx, tz, speed, dt, faceMove = true) {
    const d = Utils.normalize(tx - this.x, tz - this.z);
    const a = Math.min(1, dt * 8);
    this.vx += (d.x * speed - this.vx) * a;
    this.vz += (d.y * speed - this.vz) * a;
    if (faceMove && speed > 0.1) this.face(Math.atan2(d.y, d.x), dt * 8);
  }

  stop(dt) {
    const a = Math.min(1, dt * 8);
    this.vx -= this.vx * a;
    this.vz -= this.vz * a;
  }

  // 처음 자리 근처를 어슬렁거림
  wander(dt, speed) {
    if (this.timer <= 0) {
      this.timer = 2 + Math.random() * 3;
      this.wx = this.homeX + (Math.random() - 0.5) * 6;
      this.wz = this.homeZ + (Math.random() - 0.5) * 6;
    }
    if (this.wx !== undefined && Math.hypot(this.wx - this.x, this.wz - this.z) > 0.5) this.steer(this.wx, this.wz, speed, dt);
    else this.stop(dt);
  }

  update(dt, p, time) {
    if (this.dead) {
      if (this.boss) Golem.updateDeath(this, dt);
      else this.updateDeath(dt);
      return;
    }
    this.flash = Math.max(0, this.flash - dt);
    this.flinch = Math.max(0, this.flinch - dt);
    this.alert = Math.max(0, this.alert - dt);
    this.hpShow = Math.max(0, this.hpShow - dt);
    this.cool = Math.max(0, this.cool - dt);
    this.timer -= dt;
    const s = CONFIG.enemies[this.type];
    const dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz);
    if (this.boss) this.hpLag = Math.max(this.hp, this.hpLag - this.maxHp * 0.25 * dt);   // 하얀 잔상이 천천히 줄어듦
    if (!this.boss && this.state === 'idle' && d < s.detect && !p.dead) {
      this.state = 'chase';
      this.alert = 0.8;
    }
    if (p.dead && !this.boss) this.state = 'idle';

    if (this.boss) Golem.update(this, dt, p, s, d, dx, dz, time);
    else if (this.type === 'slime') this.updateSlime(dt, p, s, d);
    else if (this.type === 'goblin') this.updateGoblin(dt, p, s, d, dx, dz);
    else if (this.type === 'bat') this.updateBat(dt, p, s, d, dx, dz, time);
    else this.updateArcher(dt, p, s, d, dx, dz);

    const bumped = World.moveEntity(this, (this.vx + this.kx) * dt, (this.vz + this.kz) * dt);
    if (this.state === 'charge' && bumped) {   // 돌진하다 나무·바위에 쾅
      this.state = 'stun';
      this.timer = 1.0;
      this.cool = s.chargeCooldown;
      Particles.dust(this.x, this.groundY + 0.5, this.z, 5, 0.6);
    }
    const kd = Math.max(0, 1 - dt * 6);
    this.kx *= kd;
    this.kz *= kd;
    this.groundY += (World.groundHeight(this.x, this.z) - this.groundY) * Math.min(1, dt * 12);
    this.walk += Math.hypot(this.vx, this.vz) * dt * 3;
  }

  // 슬라임: 통통 튀며 천천히 다가오고, 가까우면 크게 뛰어들어 부딪힘
  updateSlime(dt, p, s, d) {
    this.squash += (0 - this.squash) * Math.min(1, dt * 8);
    if (this.hop > 0) {
      this.hop -= dt;
      this.vx = this.hopDir.x * this.hopSpeed;
      this.vz = this.hopDir.y * this.hopSpeed;
      if (this.hop <= 0) {   // 착지: 납작
        this.squash = -0.35;
        this.vx = this.vz = 0;
        Particles.dust(this.x, this.groundY, this.z, 2, 0.4);
      }
    } else {
      this.vx = this.vz = 0;
      if (this.timer <= 0) {
        let tx, tz, speed = s.speed, time = 0.45;
        if (this.state === 'chase') {
          tx = p.x;
          tz = p.z;
          if (d < 3.2) {   // 덮치기
            speed *= 2.6;
            time = 0.55;
          }
        } else {
          tx = this.homeX + (Math.random() - 0.5) * 6;
          tz = this.homeZ + (Math.random() - 0.5) * 6;
          speed *= 0.6;
        }
        this.hopDir = Utils.normalize(tx - this.x, tz - this.z);
        this.facing = Math.atan2(this.hopDir.y, this.hopDir.x);
        this.hopSpeed = speed * 1.6;
        this.hop = this.hopTime = time;
        this.squash = 0.25;   // 뛰어오를 때 쭉
        this.timer = this.state === 'chase' ? 0.35 + Math.random() * 0.3 : 1.5 + Math.random() * 2;
      }
    }
    if (this.state === 'chase' && d < this.radius + p.radius + 0.15 && this.cool <= 0 && p.hurt(s.damage, this.x, this.z)) this.cool = 1;
  }

  // 고블린: 다가와서 웅크렸다가(예고) 빠르게 돌진. 돌진 뒤엔 잠깐 비틀거림(반격 기회)
  updateGoblin(dt, p, s, d, dx, dz) {
    switch (this.state) {
      case 'idle':
        this.wander(dt, s.speed * 0.4);
        break;
      case 'chase':
        this.steer(p.x, p.z, s.speed, dt);
        if (d < s.chargeRange && this.cool <= 0) {
          this.state = 'windup';
          this.timer = 0.65;
        }
        break;
      case 'windup':
        this.stop(dt);
        this.face(Math.atan2(dz, dx), dt * 10);
        if (this.timer > 0.15) this.chargeDir = Utils.normalize(dx, dz);
        if (this.timer <= 0) {
          this.state = 'charge';
          this.timer = 0.7;
          this.hitDone = false;
        }
        break;
      case 'charge':
        this.vx = this.chargeDir.x * s.chargeSpeed;
        this.vz = this.chargeDir.y * s.chargeSpeed;
        if (!this.hitDone && d < this.radius + p.radius + 0.4 && p.hurt(s.damage, this.x, this.z, 11)) this.hitDone = true;
        if (Math.random() < 0.5) Particles.dust(this.x, this.groundY, this.z, 1, 0.3);
        if (this.timer <= 0) {
          this.state = 'stun';
          this.timer = 0.6;
          this.cool = s.chargeCooldown;
        }
        break;
      case 'stun':
        this.stop(dt);
        if (this.timer <= 0) {
          this.state = 'chase';
          this.cool = Math.max(this.cool, s.chargeCooldown * 0.5);
        }
        break;
    }
  }

  // 박쥐: 전사 머리 위를 빙빙 돌다가, 멈춰서 날갯짓을 빠르게 하면(예고) 비스듬히 내리꽂으며 덮침.
  // 덮친 뒤엔 낮게 날며 천천히 다시 떠오름 (이때가 벨 기회)
  updateBat(dt, p, s, d, dx, dz, time) {
    let alt = s.flyHeight + Math.sin(time * 2.3 + this.seed * 9) * 0.25;   // 가고 싶은 높이
    switch (this.state) {
      case 'idle': {   // 처음 자리 위를 맴돎
        const a = time * 0.9 + this.seed * 6.28;
        this.steer(this.homeX + Math.cos(a) * 2.2, this.homeZ + Math.sin(a) * 2.2, s.speed * 0.5, dt);
        break;
      }
      case 'chase': {   // 전사 둘레를 돌며 기회를 엿봄
        const a = Math.atan2(-dz, -dx) + (this.seed > 0.5 ? 1 : -1) * 0.9;
        this.steer(p.x + Math.cos(a) * s.orbit, p.z + Math.sin(a) * s.orbit, s.speed, dt, false);
        this.face(Math.atan2(dz, dx), dt * 6);
        if (this.cool <= 0 && d < s.orbit + 3) {
          this.state = 'windup';
          this.timer = 0.55;
          Sound.play('screech', { x: this.x, z: this.z });
        }
        break;
      }
      case 'windup':   // 공중에 멈춰 날갯짓을 빠르게 (덮칠 자리를 정함)
        this.stop(dt);
        this.face(Math.atan2(dz, dx), dt * 10);
        alt = s.flyHeight + 0.5;
        this.target = { x: p.x + p.vx * 0.3, z: p.z + p.vz * 0.3 };
        if (this.timer <= 0) {
          this.state = 'swoop';
          this.timer = 0.9;
          this.hitDone = false;
          const dir = Utils.normalize(this.target.x - this.x, this.target.z - this.z);
          this.swoopDir = dir;
        }
        break;
      case 'swoop': {   // 덮칠 자리를 향해 비스듬히 내리꽂음 (지나쳐도 그 방향으로 계속)
        this.vx = this.swoopDir.x * s.swoopSpeed;
        this.vz = this.swoopDir.y * s.swoopSpeed;
        const left = Math.hypot(this.target.x - this.x, this.target.z - this.z);
        alt = Math.max(0.9, Math.min(this.fly, 0.9 + left * 0.35));
        if (!this.hitDone && d < this.radius + p.radius + 0.35 && this.fly < 1.9 && p.hurt(s.damage, this.x, this.z, 6)) this.hitDone = true;
        if (this.timer <= 0) {
          this.state = 'recover';
          this.timer = 1.1;
          this.cool = s.swoopCooldown;
        }
        break;
      }
      case 'recover':   // 낮게 날며 천천히 떠오름
        this.vx *= Math.max(0, 1 - dt * 2.5);
        this.vz *= Math.max(0, 1 - dt * 2.5);
        alt = 1.2 + (1 - Utils.clamp(this.timer / 1.1, 0, 1)) * (s.flyHeight - 1.2);
        if (this.timer <= 0) this.state = 'chase';
        break;
    }
    const rate = this.state === 'swoop' ? 9 : 2.5;
    this.fly += (alt - this.fly) * Math.min(1, dt * rate);
  }

  // 해골 궁수: 거리를 유지하며 활을 당겼다가(예고) 쏨. 가까이 오면 뒷걸음질
  updateArcher(dt, p, s, d, dx, dz) {
    const toP = Math.atan2(dz, dx);
    if (this.state === 'idle') {
      this.wander(dt, s.speed * 0.3);
      return;
    }
    if (this.state === 'draw') {
      this.stop(dt);
      this.face(toP, dt * 10);
      if (this.timer <= 0) {   // 전사가 움직이는 쪽을 살짝 앞서 겨눔
        const sx = this.x + Math.cos(this.facing) * 0.5, sz = this.z + Math.sin(this.facing) * 0.5;
        Arrows.spawn(sx, this.groundY + 1.35, sz, p.x + p.vx * 0.25, p.groundY + 1.0, p.z + p.vz * 0.25, s.arrowSpeed, s.damage);
        this.state = 'chase';
        this.cool = s.shootCooldown;
      }
      return;
    }
    if (d < s.keepAway) this.steer(this.x - dx, this.z - dz, s.speed, dt, false);
    else if (d > s.detect * 0.75) this.steer(p.x, p.z, s.speed, dt, false);
    else {
      const side = this.seed > 0.5 ? 1 : -1;
      this.steer(this.x - dz * side, this.z + dx * side, s.speed * 0.35, dt, false);
    }
    this.face(toP, dt * 6);
    if (this.cool <= 0 && d < s.detect) {
      this.state = 'draw';
      this.timer = s.drawTime;
    }
  }
}

// ---------- 화살 ----------

const Arrows = {
  list: [],

  spawn(x, y, z, tx, ty, tz, speed, damage) {
    const d = V3.normalize([tx - x, ty - y, tz - z]);
    this.list.push({ x, y, z, vx: d[0] * speed, vy: d[1] * speed + 0.6, vz: d[2] * speed, life: 3, stuck: false, damage });
    Sound.play('shoot', { x, z });
  },

  update(dt, p) {
    for (const a of this.list) {
      a.life -= dt;
      if (a.stuck) continue;
      a.vy -= 3 * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.z += a.vz * dt;
      const near = Math.hypot(a.x - p.x, a.z - p.z) < p.radius + 0.25 && Math.abs(a.y - (p.groundY + 1.0)) < 0.9;
      if (near && !p.dead && p.hurt(a.damage, a.x - a.vx, a.z - a.vz, 4)) {
        a.life = 0;
        Particles.sparks(a.x, a.y, a.z, 6);
        continue;
      }
      if (a.y < World.groundHeight(a.x, a.z) + 0.05 || World.blocked(a.x, a.z, 0.05, true)) {   // 땅·나무에 꽂힘
        a.stuck = true;
        a.life = 4;
      }
    }
    this.list = this.list.filter((a) => a.life > 0);
  },

  // 날아가는 방향을 바라보는 행렬
  matrix(a) {
    const z = V3.normalize([-a.vx, -a.vy, -a.vz]);
    const x = V3.normalize(V3.cross([0, 1, 0], z));
    const y = V3.cross(z, x);
    return new Float32Array([x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, a.x, a.y, a.z, 1]);
  },
};

// ---------- 적 전체 관리 ----------

const Enemies = {
  list: [],
  models: null,   // 이름 → 모델

  build() {
    this.models = Object.assign({ slime: buildSlime(), arrow: buildArrow() }, buildGoblinParts(), buildSkeletonParts(), buildBatParts(), Golem.build());
  },

  // 구역에 적 배치 (마릿수는 config.js의 levels)
  spawn(level, index) {
    this.list = [];
    Arrows.list = [];
    Boulders.list = [];
    const counts = CONFIG.levels[level.id] || {};
    const rnd = Utils.rng(100 + index * 17);
    const cells = World.spawnCells();
    for (let i = cells.length - 1; i > 0; i--) {   // 칸 순서 섞기
      const j = (rnd() * (i + 1)) | 0;
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    let k = 0;
    for (const type of ['slime', 'goblin', 'archer', 'bat']) {
      for (let i = 0; i < (counts[type] || 0) && k < cells.length; i++, k++) {
        const c = cells[k];
        this.list.push(new Enemy(type, c.x + (rnd() - 0.5) * 0.8, c.z + (rnd() - 0.5) * 0.8, rnd));
      }
    }
    if (counts.golem && World.bossSpot) this.list.push(new Enemy('golem', World.bossSpot.x, World.bossSpot.z, rnd));   // 보스는 지도의 B 자리
  },

  get remaining() {
    return this.list.filter((e) => !e.dead).length;
  },

  // 살아 있는 보스 (없으면 null)
  get boss() {
    return this.list.find((e) => e.boss) || null;
  },

  update(dt, player, time) {
    for (const e of this.list) e.update(dt, player, time);
    // 서로 겹치지 않게 밀어냄
    for (let i = 0; i < this.list.length; i++) {
      for (let j = i + 1; j < this.list.length; j++) {
        const a = this.list[i], b = this.list[j];
        if (a.dead || b.dead) continue;
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.radius + b.radius;
        if (d > 0.001 && d < min) {
          const push = (min - d) / 2 / d;
          World.moveEntity(a, -dx * push, -dz * push);
          World.moveEntity(b, dx * push, dz * push);
        }
      }
    }
    // 큰 몸(보스)은 전사가 뚫고 지나가지 못하게 밀어냄
    for (const e of this.list) {
      if (!e.boss || e.dead) continue;
      const dx = player.x - e.x, dz = player.z - e.z, d = Math.hypot(dx, dz), min = e.radius + player.radius;
      if (d < min && d > 0.001) World.moveEntity(player, (dx / d) * (min - d), (dz / d) * (min - d));
    }
    this.list = this.list.filter((e) => !e.dead || e.deathTimer > 0);
    Arrows.update(dt, player);
    Boulders.update(dt, player);
  },

  // 적 하나에게 피해 + 불똥·숫자. p(전사)를 주면 궁극기 게이지가 참
  damage(e, amount, fromX, fromZ, p, sparkColor) {
    e.hit(amount, fromX, fromZ);
    const hy = e.groundY + e.hitHeight;
    Particles.sparks(e.x, hy, e.z, 12, sparkColor || Weapons.cur.spark);   // 불똥 색은 들고 있는 무기의 속성 색
    const d = Utils.normalize(fromX - e.x, fromZ - e.z);   // 섬광은 적의 몸 겉면 (때린 쪽)
    Skills.impact(e.x + d.x * e.radius * 0.8, hy, e.z + d.y * e.radius * 0.8, 0.55 + Math.min(1, amount / 40) * 0.6);
    UI.damage(e.x, hy + 0.3, e.z, amount);
    if (p) p.chargeUlt(amount);
    Sound.play('hit', { power: 0.4 + amount / 40, x: e.x, z: e.z, range: 40 });
    // 타격감: 맞는 순간 아주 짧게 멈칫 + 화면 흔들림 (쓰러뜨리면 조금 더 길게)
    Game.hitStop = Math.max(Game.hitStop, e.dead ? 0.09 : 0.055);
    Camera.shake = Math.max(Camera.shake, e.dead ? 0.22 : 0.12);
  },

  // 불탐·번개처럼 작은 지속 피해: 멈칫·밀려남 없이 숫자만 (color: 숫자 색)
  dot(e, amount, p, color) {
    if (e.dead) return;
    if (e.hp <= amount) e.hit(amount, e.x - Math.cos(e.facing) * 0.1, e.z - Math.sin(e.facing) * 0.1);   // 마지막 한 방은 제대로 쓰러짐
    else {
      e.hp -= amount;
      e.hpShow = 4;
    }
    UI.damage(e.x, e.groundY + e.hitHeight + 0.3, e.z, amount, color);
    if (p) p.chargeUlt(amount);
  },

  // 전사의 검이 닿는 적에게 피해 (한 번 휘두를 때 적마다 한 번씩)
  hitArc(p, swingId) {
    const c = CONFIG.player;
    const fx = Math.cos(p.facing), fz = Math.sin(p.facing);
    const half = Utils.rad(c.attackAngle / 2);
    for (const e of this.list) {
      if (e.dead || e.lastSwing === swingId) continue;
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
      if (d > Weapons.stats.range + e.radius) continue;
      const ang = Math.acos(Utils.clamp((dx * fx + dz * fz) / (d || 1), -1, 1));
      if (d > e.radius + 0.3 && ang > half) continue;   // 아주 가까우면 방향 상관없이 맞음
      e.lastSwing = swingId;
      const finisher = p.combo === 2;   // 콤보 마지막 내려찍기: 더 아프고 더 묵직하게
      this.damage(e, Math.round(p.attackPower * (finisher ? c.finisherBonus : 1)), p.x, p.z, p);
      Weapons.onHit(e, p, true);   // 무기 속성: 불탐 / 번개가 튐
      if (finisher) {
        Game.hitStop = Math.max(Game.hitStop, 0.11);
        Camera.shake = Math.max(Camera.shake, 0.35);
      }
    }
  },

  // 전사 주변 반지름 r 안의 모든 적에게 피해 (회전베기, 한 번 돌 때 적마다 한 번씩)
  hitRadius(p, r, amount, spinId) {
    for (const e of this.list) {
      if (e.dead || e.lastSpin === spinId) continue;
      if (Math.hypot(e.x - p.x, e.z - p.z) > r + e.radius) continue;
      e.lastSpin = spinId;
      this.damage(e, amount, p.x, p.z, p);
      Weapons.onHit(e, p, false);
    }
  },

  // 그리기용 목록 [{ mesh, m, flash, tint }]
  parts(time) {
    const out = [];
    for (const e of this.list) {
      let root = M4.chain(M4.translation(e.x, e.groundY + e.dy + e.fly, e.z), M4.rotationY(-e.facing - Math.PI / 2));
      let flash = e.flash > 0 ? 0.85 : 0, tint = [1, e.tint[0], e.tint[1], e.tint[2]];
      if (e.dead) {   // 뒤로 넘어간 채(엉덩이 높이를 축으로) 마지막 0.3초 동안 작아지며 사라짐
        const piv = e.hitHeight * 0.9, k = Utils.clamp(e.deathTimer / 0.3, 0, 1), age = DEATH_TIME - e.deathTimer;
        root = M4.chain(root, M4.translation(0, piv, 0), M4.rotationX(e.tumble), M4.translation(0, -piv, 0), M4.scaling(k, k, k));
        if (e.deathKind === 'laevateinn') {   // 불: 처음엔 번쩍, 점점 숯처럼 검게 탐
          const c = Utils.smooth(age / 0.5);
          tint = [1, Utils.lerp(e.tint[0], 0.08, c), Utils.lerp(e.tint[1], 0.05, c), Utils.lerp(e.tint[2], 0.04, c)];
          flash = age < 0.1 ? 0.8 : 0;
        } else if (e.deathKind === 'astrape') {   // 번개: 보랏빛으로 물든 채 감전되어 하얗게 깜빡깜빡
          flash = Math.random() < 0.3 ? 0.85 : 0;
          tint = [1, e.tint[0] * 0.55, e.tint[1] * 0.4, Math.min(1.6, e.tint[2] * 1.5)];
        } else {   // 빛: 점점 하얗게 빛나며 사라짐
          flash = 0.3 + 0.7 * Utils.smooth(age / 0.7);
        }
      }
      if (e.boss) {
        Golem.parts(e, M4.chain(M4.translation(e.x, e.groundY, e.z), M4.rotationY(-e.facing - Math.PI / 2)), time, e.flash > 0 ? 0.6 : 0, tint, out);
        continue;
      }
      if (e.type === 'slime') {
        const sy = 1 + e.squash + (e.hop > 0 ? 0.12 : 0) + Math.sin(time * 4 + e.seed * 10) * 0.03;
        const sxz = 1 / Math.sqrt(Math.max(0.3, sy));
        out.push({ mesh: 'slime', m: M4.chain(root, M4.translation(0, e.hopY, 0), M4.scaling(sxz, sy, sxz)), flash, tint });
      } else {
        const { pose, ys } = e.type === 'goblin' ? poseGoblin(e, time) : e.type === 'bat' ? poseBat(e, time) : poseSkeleton(e, time);
        const rig = e.type === 'goblin' ? GOBLIN_RIG : e.type === 'bat' ? BAT_RIG : SKELETON_RIG;
        for (const part of rigMatrices(rig, root, pose, ys).out) out.push({ mesh: part.mesh, m: part.m, flash, tint });
      }
    }
    for (const a of Arrows.list) out.push({ mesh: 'arrow', m: Arrows.matrix(a), flash: 0 });
    for (const b of Boulders.list) out.push({ mesh: 'glRock', m: Boulders.matrix(b), flash: 0 });
    return out;
  },
};
