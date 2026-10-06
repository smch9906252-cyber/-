// 3인칭에서 보이는 전사(기사) 모델과 움직임(애니메이션)
// 몸은 관절로 이어져 있어서, 관절을 돌리면 그 아래 부분이 함께 움직입니다.

// 용사 색 (야숨풍): 밝은 청회색 강철 + 부드러운 금 + 발뭉과 같은 푸른 빛줄기, 차분한 남청 코트, 물 빠진 진홍 망토
// (아주 어둡거나 새빨간 색은 파스텔 세상에서 혼자 검게 떠 보여서, 밝기를 올리고 채도를 조금 낮춤)
// (네 번째 값: 0~1 금속 반짝임, MAT.CLOTH 천, MAT.GLOW 스스로 빛남)
const KNIGHT = {
  armor: Utils.color('#5b6676', 0.75),
  armorLight: Utils.color('#8490a0', 0.85),
  gold: Utils.color('#d8b45e', 0.8),
  glow: Utils.color('#58c8ff', MAT.GLOW),
  suit: Utils.color('#343d4f', MAT.CLOTH),
  coat: Utils.color('#2d4273', MAT.CLOTH),
  leather: Utils.color('#6a4a30'),
  cape: Utils.color('#a3363c', MAT.CLOTH),
  skin: Utils.color('#f0c4a0', MAT.SKIN),
  hair: Utils.color('#2a2a35', MAT.HAIR),     // 검은 머리 (새까맣지 않게 살짝 띄움 → 윤기 띠·윤곽 빛이 보임)
  eyeWhite: Utils.color('#f4f1ec'),
  iris: Utils.color('#2f6fd0'),               // 푸른 눈
  brow: Utils.color('#141418'),
  lip: Utils.color('#a8604c'),
};

// 머리카락: 뾰족뾰족한 검은 머리 (rnd로 가닥마다 길이·굵기를 조금씩 다르게)
function addHair(b, rnd) {
  const hair = () => KNIGHT.hair, sm = { smooth: true };
  const center = [0, 0.2, 0.025];
  Shapes.icosphere(b, M4.chain(M4.translation(center[0], center[1], center[2]), M4.scaling(0.118, 0.11, 0.122)), 2, hair, sm);   // 머리 전체를 덮는 부분
  const lock = (base, dir, len, r) => Shapes.segment(b, base, V3.add(base, V3.scale(V3.normalize(dir), len)), r, 0.002, 7, hair, sm);
  // 정수리·뒤통수: 위와 뒤로 뻗친 가닥
  for (let i = 0; i < 11; i++) {
    const th = 0.35 + rnd() * 1.0, ph = Math.PI * 0.15 + (i / 11) * Math.PI * 0.7 + (rnd() - 0.5) * 0.2;   // 뒤쪽 반구
    const d = [Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)];
    const base = [center[0] + d[0] * 0.1, center[1] + d[1] * 0.09, center[2] + d[2] * 0.1];
    lock(base, V3.add(d, [0, 0.4, 0.5]), 0.12 + rnd() * 0.08, 0.042 + rnd() * 0.014);
  }
  // 옆머리: 귀 위로 내려오는 가닥
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 2; i++) lock([sx * 0.105, 0.21 - i * 0.03, -0.02 + i * 0.05], [sx * 0.4, -1, 0.15], 0.085, 0.032);
  }
}

// 앞머리: 이마 위로 내려오는 가닥 (따로 움직임: 달리면 뒤로 젖혀짐). 원점 = 이마 위 (머리 기준 [0, 0.255, -0.075])
function addBangs(b, rnd) {
  const sm = { smooth: true };
  for (let i = 0; i < 5; i++) {
    const x = -0.07 + i * 0.035;
    const dir = V3.normalize([x * 2.5 + (rnd() - 0.5) * 0.3, -0.9, -0.55]), len = 0.075 + rnd() * 0.025;
    Shapes.segment(b, [x, 0, 0], V3.add([x, 0, 0], V3.scale(dir, len)), 0.03, 0.002, 7, () => KNIGHT.hair, sm);
  }
}

// 얼굴: 피부, 귀, 눈(흰자·눈동자·반짝임), 눈썹, 코, 입
function addFace(b) {
  const T = M4.translation, S = M4.scaling, ch = M4.chain, sm = { smooth: true };
  const c = (name) => () => KNIGHT[name];
  Shapes.cylinder(b, T(0, -0.03, 0), 0.046, 0.044, 0.12, 10, c('skin'), sm);                       // 목
  const faceStart = b.pos.length / 3;
  Shapes.icosphere(b, ch(T(0, 0.15, 0), S(0.102, 0.13, 0.113)), 3, c('skin'), sm);                 // 머리
  Shapes.icosphere(b, ch(T(0, 0.085, -0.03), S(0.075, 0.07, 0.08)), 2, c('skin'), sm);             // 턱
  // 턱선을 V자로: 아래로 갈수록 좁히고 턱끝을 살짝 앞으로
  for (let i = faceStart * 3; i < b.pos.length; i += 3) {
    const y = b.pos[i + 1], k = Utils.clamp((0.15 - y) / 0.14, 0, 1);
    b.pos[i] *= 1 - k * k * 0.5;
    if (b.pos[i + 2] < 0) b.pos[i + 2] -= k * k * 0.012;
  }
  for (const sx of [-1, 1]) {
    Shapes.icosphere(b, ch(T(sx * 0.1, 0.14, 0.01), S(0.018, 0.034, 0.024)), 1, c('skin'), sm);    // 귀
  }
  b.bendNormals(faceStart, [0, 0.3, -1], 0.6);   // 얼굴에 빛이 고르게 (얼룩진 그늘 없이)
}

// 눈·눈썹·코·입 (외곽선 없이 따로 그리는 부분 → 코 둘레에 검은 테가 생기지 않게)
function addFeatures(b) {
  const T = M4.translation, S = M4.scaling, ch = M4.chain, sm = { smooth: true };
  const c = (name) => () => KNIGHT[name];
  for (const sx of [-1, 1]) {
    // 눈: 가로로 긴 아몬드 흰자 + 크고 진한 눈동자(위쪽은 속눈썹에 살짝 가려짐) + 동공 + 반짝임 두 개
    Shapes.icosphere(b, ch(T(sx * 0.04, 0.146, -0.094), M4.rotationZ(sx * 0.1), S(0.027, 0.02, 0.012)), 2, c('eyeWhite'), sm);
    Shapes.icosphere(b, ch(T(sx * 0.037, 0.144, -0.102), S(0.0155, 0.02, 0.006)), 2, c('iris'), sm);
    Shapes.icosphere(b, ch(T(sx * 0.037, 0.146, -0.106), S(0.007, 0.0095, 0.003)), 1, c('brow'), sm);           // 동공
    Shapes.icosphere(b, ch(T(sx * 0.032, 0.153, -0.109), S(0.0055, 0.0055, 0.002)), 0, c('eyeWhite'), sm);      // 반짝임
    Shapes.icosphere(b, ch(T(sx * 0.042, 0.137, -0.108), S(0.003, 0.003, 0.0015)), 0, c('eyeWhite'), sm);
    Shapes.box(b, ch(T(sx * 0.041, 0.1665, -0.103), M4.rotationZ(sx * 0.14), S(0.062, 0.0075, 0.012)), c('brow'));  // 윗속눈썹 선
    Shapes.box(b, ch(T(sx * 0.072, 0.161, -0.097), M4.rotationZ(-sx * 0.55), S(0.015, 0.006, 0.008)), c('brow'));   // 눈꼬리
    Shapes.box(b, ch(T(sx * 0.044, 0.189, -0.104), M4.rotationZ(sx * 0.14), S(0.048, 0.0095, 0.01)), c('brow'));    // 눈썹 (안쪽이 조금 내려간 굳센 인상)
  }
  Shapes.icosphere(b, ch(T(0, 0.122, -0.108), S(0.006, 0.013, 0.008)), 1, c('skin'), sm);           // 코 (작게)
  Shapes.box(b, ch(T(0, 0.09, -0.098), S(0.022, 0.0035, 0.004)), c('lip'));                         // 입
  // 눈 테두리: 흰자 아래쪽에 가는 선 (외곽선 대신)
  for (const sx of [-1, 1]) {
    Shapes.box(b, ch(T(sx * 0.042, 0.128, -0.099), M4.rotationZ(-sx * 0.1), S(0.04, 0.003, 0.006)), c('brow'));
  }
  b.bendNormals(0, [0, 0.3, -1], 0.6);
}

// 몸 부분 모델 (각 관절 위치가 원점, 팔다리는 아래(-y)로 뻗음, 앞쪽은 -z). 둥근 부분은 매끈하게
function buildKnightParts() {
  const c = (name) => () => KNIGHT[name];
  const T = M4.translation, S = M4.scaling, ch = M4.chain;
  const sm = { smooth: true };
  const make = (fn) => {
    const b = new MeshBuilder();
    fn(b);
    return b;
  };
  // 위에서 매달린 판 (코트 자락·허벅지 판금): m 기준점에서 아래로 h만큼, 아래 끝엔 금 테두리
  const panel = (b, m, w, h, color, trim = true) => {
    Shapes.box(b, ch(m, T(0, -h / 2, 0), S(w, h, 0.016)), c(color));
    if (trim) Shapes.box(b, ch(m, T(0, -h + 0.012, 0), S(w + 0.004, 0.024, 0.022)), c('gold'));
  };
  // 겹겹이 쌓인 어깨 갑옷 (sx = 1 오른쪽, -1 왼쪽: 바깥쪽으로 처지게)
  const upperArm = (sx) => make((b) => {
    Shapes.cylinder(b, T(0, -0.3, 0), 0.05, 0.06, 0.3, 10, c('suit'), sm);                             // 소매
    for (let i = 0; i < 3; i++) {
      const k = 1 - i * 0.15;
      Shapes.icosphere(b, ch(T(sx * (0.03 + i * 0.02), 0.04 - i * 0.06, 0), M4.rotationZ(-sx * (0.3 + i * 0.16)), S(0.155 * k, 0.065, 0.14 * k)),
        2, c(i === 0 ? 'armorLight' : 'armor'), sm);
    }
    Shapes.cylinder(b, ch(T(sx * 0.03, 0.035, 0), M4.rotationZ(-sx * 0.3), S(1, 1, 0.92)), 0.155, 0.155, 0.014, 18, c('gold'), sm);   // 금 테
    Shapes.cylinder(b, ch(T(sx * 0.08, 0.08, 0), M4.rotationZ(-sx * 0.55)), 0.034, 0, 0.13, 6, c('gold'), sm);                   // 위로 솟은 날개 장식
    Shapes.icosphere(b, ch(T(0, -0.3, 0.01), S(0.065, 0.065, 0.065)), 1, c('armor'), sm);                                         // 팔꿈치
  });
  // 허벅지: 짙은 천 + 바깥 앞쪽 판금
  const thigh = (sx) => make((b) => {
    Shapes.cylinder(b, T(0, -0.48, 0), 0.07, 0.09, 0.48, 12, c('suit'), sm);
    panel(b, ch(T(sx * 0.05, -0.02, -0.06), M4.rotationY(-sx * 0.5), M4.rotationZ(sx * 0.12), M4.rotationX(0.1)), 0.12, 0.22, 'armorLight');
  });
  return {
    pelvis: make((b) => {
      Shapes.cylinder(b, ch(T(0, -0.1, 0), S(1, 1, 0.72)), 0.14, 0.15, 0.2, 14, c('suit'), sm);           // 엉덩이
      Shapes.cylinder(b, ch(T(0, 0.04, 0), S(1, 1, 0.74)), 0.155, 0.155, 0.06, 14, c('leather'), sm);     // 넓은 허리띠
      Shapes.box(b, ch(T(0, 0.07, -0.118), S(0.07, 0.055, 0.02)), c('gold'));                              // 버클
      Shapes.icosphere(b, ch(T(0, 0.07, -0.13), S(0.016, 0.018, 0.008)), 1, c('glow'));                     // 버클의 푸른 보석
    }),
    // 코트 자락 (따로 움직임: 다리에 밀리고 달리면 뒤로 날림). 앞은 짧게 양옆으로 갈라지고, 뒤는 길게 두 갈래
    coatFrontR: make((b) => panel(b, ch(M4.rotationZ(0.12), M4.rotationX(0.12)), 0.13, 0.26, 'coat')),
    coatFrontL: make((b) => panel(b, ch(M4.rotationZ(-0.12), M4.rotationX(0.12)), 0.13, 0.26, 'coat')),
    coatBackR: make((b) => panel(b, ch(M4.rotationZ(0.1), M4.rotationX(-0.15)), 0.15, 0.52, 'coat')),
    coatBackL: make((b) => panel(b, ch(M4.rotationZ(-0.1), M4.rotationX(-0.15)), 0.15, 0.52, 'coat')),
    // 눈꺼풀: 깜빡일 때만 위에서 아래로 내려옴 (Character.matrices에서 크기 조절)
    lids: make((b) => {
      for (const sx of [-1, 1]) {
        Shapes.icosphere(b, ch(T(sx * 0.04, 0.147, -0.096), M4.rotationZ(sx * 0.1), S(0.03, 0.023, 0.016)), 2, c('skin'), sm);
      }
    }),
    chest: make((b) => {
      Shapes.cylinder(b, ch(T(0, -0.02, 0), S(1, 1, 0.7)), 0.13, 0.17, 0.24, 14, c('suit'), sm);           // 허리 (가늘게)
      for (let i = 0; i < 3; i++) {   // 배 갑옷: 띠 3겹
        Shapes.cylinder(b, ch(T(0, 0.02 + i * 0.065, 0), S(1, 1, 0.68)), 0.15 + i * 0.012, 0.16 + i * 0.012, 0.05, 14, c('armor'), sm);
      }
      Shapes.cylinder(b, ch(T(0, 0.2, 0), S(1, 1, 0.6)), 0.19, 0.25, 0.3, 16, c('armor'), sm);              // 가슴 (어깨 쪽이 넓은 역삼각형)
      for (const sx of [-1, 1]) {   // 가슴 근육처럼 불룩한 두 장의 가슴판 + 아래로 흐르는 푸른 빛줄기
        Shapes.icosphere(b, ch(T(sx * 0.085, 0.355, -0.085), M4.rotationZ(sx * 0.25), S(0.115, 0.085, 0.07)), 2, c('armorLight'), sm);
        Shapes.box(b, ch(T(sx * 0.095, 0.25, -0.113), M4.rotationZ(sx * 0.55), M4.rotationX(-0.25), S(0.008, 0.1, 0.008)), c('glow'));
        Shapes.box(b, ch(T(sx * 0.11, 0.432, -0.1), M4.rotationZ(-sx * 0.12), S(0.15, 0.016, 0.06)), c('gold'));   // 쇄골 쪽 금 테
      }
      Shapes.box(b, ch(T(0, 0.3, -0.135), S(0.018, 0.2, 0.03)), c('gold'));                               // 가운데 능선
      Shapes.box(b, ch(T(0, 0.36, -0.148), M4.rotationZ(0.785), S(0.06, 0.06, 0.02)), c('gold'));         // 가운데 문장
      Shapes.box(b, ch(T(0, 0.36, -0.159), M4.rotationZ(0.785), S(0.034, 0.034, 0.012)), c('glow'));
      Shapes.box(b, ch(T(0, 0.33, 0.11), M4.rotationX(0.1), S(0.3, 0.26, 0.03)), c('armor'));              // 등판
      Shapes.cylinder(b, ch(T(0, 0.47, 0.01), S(1, 1, 0.9)), 0.1, 0.125, 0.11, 14, c('armor'), { smooth: true, top: false });   // 높은 깃
      Shapes.cylinder(b, ch(T(0, 0.575, 0.01), S(1, 1, 0.9)), 0.127, 0.127, 0.012, 14, c('gold'), sm);
      for (const sx of [-1, 1]) {   // 망토를 거는 금 고리
        Shapes.icosphere(b, ch(T(sx * 0.16, 0.47, 0.13), S(0.035, 0.035, 0.02)), 1, c('gold'), sm);
      }
    }),
    head: make((b) => {   // 투구 없이 얼굴과 검은 머리
      addFace(b);
      addHair(b, Utils.rng(41));
    }),
    face: make(addFeatures),
    bangs: make((b) => addBangs(b, Utils.rng(43))),
    hairBack: make((b) => {   // 뒷머리 가닥 (뛰면 뒤로 날림)
      const rnd = Utils.rng(42);
      for (let i = 0; i < 5; i++) {
        const x = -0.07 + i * 0.035;
        Shapes.segment(b, [x, 0.02, -0.02], [x * 1.4 + (rnd() - 0.5) * 0.02, -0.13 - rnd() * 0.04, 0.04], 0.035, 0.002, 7, () => KNIGHT.hair, sm);
      }
    }),
    upperArmR: upperArm(1),
    upperArmL: upperArm(-1),
    forearm: make((b) => {   // 팔목 갑옷: 금 고리 두 개, 앞쪽에 푸른 빛줄기, 손목 쪽이 넓어지는 덮개
      Shapes.cylinder(b, T(0, -0.27, 0), 0.044, 0.06, 0.27, 12, c('armor'), sm);
      Shapes.cylinder(b, T(0, -0.066, 0), 0.059, 0.059, 0.012, 12, c('gold'), sm);
      Shapes.cylinder(b, T(0, -0.206, 0), 0.051, 0.051, 0.012, 12, c('gold'), sm);
      Shapes.box(b, ch(T(0, -0.135, -0.055), S(0.012, 0.15, 0.008)), c('glow'));
      Shapes.cylinder(b, T(0, -0.295, 0), 0.068, 0.05, 0.055, 12, c('armorLight'), sm);
    }),
    hand: make((b) => Shapes.box(b, ch(T(0, -0.05, 0), S(0.065, 0.095, 0.075)), c('leather'))),
    thighR: thigh(1),
    thighL: thigh(-1),
    shin: make((b) => {   // 정강이 갑옷: 앞으로 뾰족한 무릎 보호대, 금 줄
      Shapes.cylinder(b, T(0, -0.44, 0), 0.055, 0.072, 0.44, 12, c('armor'), sm);
      Shapes.icosphere(b, ch(T(0, 0, -0.04), S(0.08, 0.085, 0.075)), 2, c('armorLight'), sm);
      Shapes.cylinder(b, ch(T(0, 0, -0.09), M4.rotationX(-Math.PI / 2)), 0.035, 0, 0.06, 8, c('gold'), sm);
      Shapes.box(b, ch(T(0, -0.23, -0.07), S(0.012, 0.3, 0.008)), c('gold'));
    }),
    foot: make((b) => {   // 갑옷 장화: 금 코끝
      Shapes.cylinder(b, T(0, -0.02, 0), 0.064, 0.06, 0.1, 10, c('armor'), sm);
      Shapes.box(b, ch(T(0, 0.0, -0.045), S(0.11, 0.075, 0.24)), c('armor'));
      Shapes.box(b, ch(T(0, 0.0, -0.155), S(0.1, 0.06, 0.05)), c('gold'));
    }),
  };   // 망토는 cape.js에서 천처럼 따로 움직임
}

// 관절: [이름, 부모 관절, 부모 기준 위치, 붙는 모델]  (키 약 1.85m, 다리가 길고 어깨가 넓은 체형)
const RIG = [
  ['hips', null, [0, 0.98, 0], 'pelvis'],
  ['spine', 'hips', [0, 0.1, 0], 'chest'],
  ['neck', 'spine', [0, 0.56, 0], 'head'],
  ['hairBack', 'neck', [0, 0.17, 0.1], 'hairBack'],
  ['face', 'neck', [0, 0, 0], 'face'],
  ['bangs', 'neck', [0, 0.255, -0.075], 'bangs'],
  ['lids', 'neck', [0, 0, 0], 'lids'],
  ['coatFR', 'hips', [0.075, 0, -0.105], 'coatFrontR'],
  ['coatFL', 'hips', [-0.075, 0, -0.105], 'coatFrontL'],
  ['coatBR', 'hips', [0.075, 0, 0.11], 'coatBackR'],
  ['coatBL', 'hips', [-0.075, 0, 0.11], 'coatBackL'],
  ['shoulderR', 'spine', [0.27, 0.45, 0], 'upperArmR'],
  ['elbowR', 'shoulderR', [0, -0.3, 0], 'forearm'],
  ['handR', 'elbowR', [0, -0.28, 0], null],   // 오른손에는 발뭉(장갑 포함)이 붙음
  ['shoulderL', 'spine', [-0.27, 0.45, 0], 'upperArmL'],
  ['elbowL', 'shoulderL', [0, -0.3, 0], 'forearm'],
  ['handL', 'elbowL', [0, -0.28, 0], 'hand'],
  ['hipR', 'hips', [0.1, -0.03, 0], 'thighR'],
  ['kneeR', 'hipR', [0, -0.48, 0], 'shin'],
  ['footR', 'kneeR', [0, -0.44, 0], 'foot'],
  ['hipL', 'hips', [-0.1, -0.03, 0], 'thighL'],
  ['kneeL', 'hipL', [0, -0.48, 0], 'shin'],
  ['footL', 'kneeL', [0, -0.44, 0], 'foot'],
];

// 관절 회전 (x: 앞뒤로 젖힘(+는 팔다리가 앞으로), y: 좌우로 비틂(+는 왼쪽), z: 옆으로 벌림(+는 오른쪽))
const J = (x = 0, y = 0, z = 0) => ({ x, y, z });
// (손목을 꺾어 칼날이 팔과 같은 방향으로 눕도록 → 옆으로 베는 모양)
const ATTACK_READY = { spine: J(-0.05, -0.6), hips: J(0, -0.2), shoulderR: J(0.9, 0, 1.35), elbowR: J(1.3), handR: J(-0.4, 0, 0.3) };
const ATTACK_END = { spine: J(-0.18, 0.75), hips: J(0, 0.25), shoulderR: J(1.35, 0, -0.55), elbowR: J(0.15), handR: J(-1.2, 0, -0.3) };
// 콤보 동작별 [시작 자세, 끝 자세]
const COMBO_POSES = [
  [ATTACK_READY, ATTACK_END],
  // 되베기: 왼쪽 아래에서 오른쪽 위로 걷어 올림
  [{ spine: J(-0.15, 0.7), hips: J(0, 0.3), shoulderR: J(1.0, 0, -0.6), elbowR: J(1.1), handR: J(-0.9, 0, -0.4), shoulderL: J(0.3, 0, -0.5), elbowL: J(0.8) },
   { spine: J(-0.05, -0.75), hips: J(0, -0.3), shoulderR: J(1.6, 0, 1.25), elbowR: J(0.1), handR: J(-1.1, 0, 0.5), shoulderL: J(-0.3, 0, -0.6), elbowL: J(0.5) }],
  // 내려찍기: 두 손으로 머리 위까지 들었다가 앞으로 크게 내려침 (왼발을 내디디며 몸을 숙임)
  [{ spine: J(0.2, 0.1), neck: J(-0.1), shoulderR: J(2.8, 0, 0.25), elbowR: J(1.0), handR: J(-0.5), shoulderL: J(2.6, 0, -0.35), elbowL: J(1.2),
     hipR: J(-0.25, 0, 0.1), kneeR: J(-0.2), hipL: J(0.35, 0, -0.1), kneeL: J(-0.4) },
   { spine: J(-0.55, 0.4), neck: J(0.45, -0.3), hips: J(0, 0.15), shoulderR: J(1.0, 0, -0.5), elbowR: J(0.05), handR: J(-1.35, 0, -0.2), shoulderL: J(0.8, 0, -0.3), elbowL: J(0.5),
     hipR: J(-0.55, 0, 0.1), kneeR: J(-0.35), hipL: J(1.0, 0, -0.1), kneeL: J(-1.1) }],
];
const ROLL_TUCK = {
  spine: J(-0.9), neck: J(-0.4), hipR: J(1.7), kneeR: J(-2.1), hipL: J(1.5), kneeL: J(-2.0),
  shoulderR: J(1.0, 0, 0.2), elbowR: J(1.4), shoulderL: J(1.1, 0, -0.2), elbowL: J(1.4),
};

// F 섬광 돌진: 몸을 낮게 숙이고 칼을 뒤로 눕혀 쥔 채 앞으로 쏘아져 나감 (앞발을 크게 내디딤)
const DASH_POSE = {
  spine: J(-0.7, 0.3), neck: J(0.45, -0.2), hips: J(0, -0.25),
  shoulderR: J(-1.05, 0, 0.45), elbowR: J(0.15), handR: J(-1.9, 0, 0.2),
  shoulderL: J(0.55, 0, -0.3), elbowL: J(0.5),
  hipR: J(-0.75, 0, 0.05), kneeR: J(-0.35), hipL: J(1.05, 0, -0.05), kneeL: J(-0.75),
};
// 돌진 마무리: 지나간 뒤 칼을 옆으로 쭉 뻗고 낮게 멈춘 자세 (뒤에서 베인 자리가 터짐)
const DASH_FINISH = {
  spine: J(-0.35, -0.35), neck: J(0.2, 0.3), hips: J(0, 0.3),
  shoulderR: J(-0.1, 0, 1.25), elbowR: J(0.05), handR: J(-1.5, 0, -0.15),
  shoulderL: J(0.4, 0, -0.5), elbowL: J(1.0),
  hipR: J(-0.45, 0, 0.2), kneeR: J(-0.25), hipL: J(0.75, 0, -0.15), kneeL: J(-1.0),
};

const KNOCKED_DOWN = {   // 쓰러졌을 때: 무릎 꿇고 고개 숙임
  hipR: J(1.6), kneeR: J(-2.2), hipL: J(1.4), kneeL: J(-2.2), spine: J(-0.8), neck: J(-0.6),
  shoulderR: J(0.2, 0, 0.3), elbowR: J(0.3), shoulderL: J(0.2, 0, -0.3), elbowL: J(0.3),
};

// 관절 트리(rig)와 포즈로 각 부분의 세상 행렬 계산. ys: 관절 높이 바꾸기 { 관절 이름: 높이 }
function rigMatrices(rig, root, pose, ys = {}) {
  const out = [], W = {};
  for (const [name, parent, off, mesh] of rig) {
    const r = pose[name] || J();
    const y = ys[name] !== undefined ? ys[name] : off[1];
    const local = M4.chain(M4.translation(off[0], y, off[2]), M4.rotationY(r.y), M4.rotationX(r.x), M4.rotationZ(r.z));
    W[name] = M4.multiply(parent ? W[parent] : root, local);
    if (mesh) out.push({ mesh, m: W[name] });
  }
  return { out, W };
}

// pose의 관절들을 target 쪽으로 w만큼 섞기
function blendPose(pose, target, w) {
  for (const k in target) {
    const a = pose[k] || J(), b = target[k];
    pose[k] = J(Utils.lerp(a.x, b.x, w), Utils.lerp(a.y, b.y, w), Utils.lerp(a.z, b.z, w));
  }
}

const GHOST_LIFE = 0.3;   // 잔상이 남아 있는 시간(초)

const Character = {
  parts: null,     // 몸 부분 모델들
  pose: {},        // 관절 이름 → 회전
  hipsY: 0.95,     // 엉덩이 높이
  roll: 0,         // 구르기 회전 각도
  spin: 0,         // 회전베기 회전 각도
  walkPhase: 0,
  hair: 0,         // 뒷머리가 뒤로 날리는 정도
  hairVel: 0,
  W: null,         // 마지막으로 계산한 관절 행렬들
  ghosts: [],      // 잔상들 [{ age, parts }]
  ghostTimer: 0,
  coat: 0,         // 뒷자락이 뒤로 날리는 정도
  coatVel: 0,
  blink: 0,        // 눈 감은 정도 (0~1)
  blinkTimer: 2,
  lean: 0,         // 돌 때 옆으로 기운 각도
  lastFacing: 0,
  idleTime: 0,     // 가만히 서 있은 시간 (길어지면 검을 어깨에 걸침)

  build() {
    this.parts = buildKnightParts();
  },

  // 구르기·회전베기 잔상: 아주 짧은 간격으로 몸 자세를 찍어 두고 서서히 사라지게
  updateGhosts(p, dt, body) {
    for (const g of this.ghosts) g.age += dt;
    this.ghosts = this.ghosts.filter((g) => g.age < GHOST_LIFE);
    this.ghostTimer -= dt;
    if ((p.isDodging || p.spinTimer > 0 || p.dashTimer > 0) && !Camera.isFirst && this.ghostTimer <= 0) {
      this.ghostTimer = p.dashTimer > 0 ? 0.018 : 0.035;   // 돌진은 촘촘하게 (빠르게 지나간 자리에 잔상이 줄지어)
      this.ghosts.push({ age: 0, parts: body });
    }
  },

  update(p, dt, time) {
    const c = CONFIG.player;
    const speed = Math.hypot(p.vx, p.vz);
    const amt = p.isDodging ? 0 : Utils.clamp(speed / c.moveSpeed, 0, 1);   // 걷는 정도 0~1
    this.walkPhase += speed * dt * 1.9;
    const s = Math.sin(this.walkPhase), co = Math.cos(this.walkPhase);
    const breathe = Math.sin(time * 2.2) * 0.02;

    // 걷기·뛰기: 다리를 번갈아 내딛고 팔은 반대로 흔듦
    // 서 있을 때(idle): 다리를 어깨너비로 벌리고 무게를 한쪽에 실은 당당한 자세
    const idle = 1 - amt;
    const pose = {
      hips: J(0, s * 0.12 * amt - 0.12 * idle, 0.04 * idle),
      spine: J(-0.12 * amt + breathe + 0.04 * idle, -s * 0.15 * amt + 0.16 * idle, -0.05 * idle),
      neck: J(0.1 * amt - breathe, s * 0.05 * amt, 0.02 * idle),
      hipR: J(s * 0.7 * amt + 0.05 * idle, 0, 0.03 + 0.09 * idle),
      kneeR: J(-(0.06 + Math.max(0, co) * 1.1 * amt)),
      footR: J(0.15 * s * amt, 0, -0.1 * idle),
      hipL: J(-s * 0.7 * amt - 0.08 * idle, 0, -0.03 - 0.07 * idle),
      kneeL: J(-(0.06 + Math.max(0, -co) * 1.1 * amt + 0.14 * idle)),
      footL: J(-0.15 * s * amt + 0.08 * idle, 0, 0.08 * idle),
      shoulderR: J(0.12 - s * 0.25 * amt, 0, 0.22),  // 발뭉은 옆에서 앞으로 비스듬히 낮춰 듦 (얼굴을 가리지 않게)
      elbowR: J(0.35 + 0.15 * amt),
      handR: J(-0.8),
      shoulderL: J(s * 0.55 * amt + 0.05, 0, -0.15 - 0.12 * idle),
      elbowL: J(0.3 + 0.35 * amt + 0.15 * idle),
      handL: J(),
    };
    let hipsY = 0.98 - 0.05 * amt + Math.abs(co) * 0.06 * amt - 0.025 * idle;

    // 가만히 몇 초 서 있으면 발뭉을 땅에 꽂듯 세우고 두 손을 칼자루에 얹음 (기사의 휴식 자세)
    const busy = amt > 0.05 || p.attackTimer > 0 || p.attackCooldown > 0 || p.isDodging || p.spinTimer > 0 || p.castTimer > 0 || p.dashTimer > 0 || p.dashAfter > 0 || p.dead;
    this.idleTime = busy ? 0 : this.idleTime + dt;
    const rest = Utils.smooth((this.idleTime - 3) / 0.7);
    if (rest > 0) {
      blendPose(pose, { shoulderR: J(0.45, 0, -0.35), elbowR: J(1.0), handR: J(-2.95, 0.28, 0), shoulderL: J(0.45, 0, 0.35), elbowL: J(1.0),
        spine: J(0.03, 0, 0), hips: J(0, 0, 0), neck: J(0.05), hipR: J(0, 0, 0.1), hipL: J(0, 0, -0.1), kneeL: J(-0.06), footR: J(0, 0, -0.1), footL: J(0, 0, 0.1) }, rest);
    }

    // 달리기: 몸을 앞으로 숙이고, 발뭉은 뒤로 비스듬히 끌듯이 듦 (애니메이션풍 달리기)
    const run = amt * amt;
    if (run > 0.01) {
      blendPose(pose, {
        spine: J(-0.3 + breathe, -s * 0.18, 0), neck: J(0.25, s * 0.06),
        shoulderR: J(-0.75 - s * 0.12, 0, 0.32), elbowR: J(0.3), handR: J(-1.85, 0, 0.15),
        shoulderL: J(s * 0.8 + 0.1, 0, -0.12), elbowL: J(0.9 + 0.3 * Math.max(0, s)),
      }, run * 0.9);
    }

    // 공격: 오른쪽 뒤로 젖혔다가 왼쪽으로 크게 벰 (1인칭과 같은 타이밍)
    // (콤보 동작마다 다른 자세. 3번째 내려찍기는 앞으로 내디디며 몸이 낮아짐)
    const recover = c.attackCooldown - c.attackTime;
    const [ready, end] = COMBO_POSES[p.combo || 0];
    let lunge = 0;
    if (p.attackTimer > 0) {
      const t = 1 - p.attackTimer / c.attackTime;
      if (t < 0.25) {
        blendPose(pose, ready, Utils.smooth(t / 0.25));
      } else {
        const mid = {}, k = 1 - Math.pow(1 - (t - 0.25) / 0.75, 3);
        blendPose(mid, ready, 1);
        blendPose(mid, end, k);
        blendPose(pose, mid, 1);
        lunge = k;
      }
    } else if (p.attackCooldown > 0 && recover > 0) {
      lunge = Utils.smooth(p.attackCooldown / recover);
      blendPose(pose, end, lunge);
    }
    if (p.combo === 2) hipsY -= 0.16 * lunge;

    // 구르기: 몸을 웅크리고 앞으로 한 바퀴
    this.roll = 0;
    if (p.isDodging) {
      const t = 1 - p.dodgeTimer / c.dodgeTime;
      const w = Math.sin(t * Math.PI);
      blendPose(pose, ROLL_TUCK, Math.min(1, w * 1.6));
      hipsY = Utils.lerp(hipsY, 0.6, w);
      if (!Camera.isFirst) this.roll = Utils.smooth(t) * Math.PI * 2;
    }

    // 뒷머리: 달리거나 구르면 뒤로 날리고, 용수철처럼 출렁임
    const hairTarget = amt * 0.7 + (p.isDodging ? 0.6 : 0) + Math.sin(time * 2.6) * 0.06;
    this.hairVel += ((hairTarget - this.hair) * 70 - this.hairVel * 9) * dt;
    this.hair += this.hairVel * dt;
    pose.hairBack = J(-this.hair, 0, Math.sin(time * 1.9) * 0.05);
    pose.bangs = J(-this.hair * 0.45 + Math.sin(time * 2.3) * 0.03, 0, Math.sin(time * 1.7) * 0.04);

    // Q 회전베기: 팔을 옆으로 뻗고 칼날을 바깥으로 눕힌 채 몸 전체가 한 바퀴
    this.spin = 0;
    if (p.spinTimer > 0) {
      const t = 1 - p.spinTimer / CONFIG.skills.spin.time;
      this.spin = Utils.smooth(t) * Math.PI * 2;
      blendPose(pose, { shoulderR: J(0.2, 0, 1.45), elbowR: J(0.1), handR: J(-1.5, 0, 0), shoulderL: J(0.5, 0, -0.4), elbowL: J(1.2),
        spine: J(-0.15), hipR: J(0.3, 0, 0.15), kneeR: J(-0.5), hipL: J(-0.1, 0, -0.15), kneeL: J(-0.4) }, Math.min(1, Math.sin(t * Math.PI) * 3));
      hipsY -= 0.08;
    }

    // F 섬광 돌진 → 마무리 자세 (끝날 때 부드럽게 풀림)
    if (p.dashTimer > 0) {
      blendPose(pose, DASH_POSE, 1);
      hipsY -= 0.24;
    } else if (p.dashAfter > 0) {
      const k = Utils.smooth(p.dashAfter / 0.2);
      blendPose(pose, DASH_FINISH, k);
      hipsY -= 0.2 * k;
    }

    // R 궁극기: 다리를 벌리고 서서 검을 하늘 높이 치켜듦
    if (p.castTimer > 0) {
      const k = Math.min(1, (CONFIG.skills.ultimate.castTime + 0.9 - p.castTimer) * 4);
      blendPose(pose, { shoulderR: J(2.9, 0, 0.15), elbowR: J(0), handR: J(-1.57), shoulderL: J(0.3, 0, -0.5), elbowL: J(0.8),
        spine: J(0.15), neck: J(0.5), hipR: J(0, 0, 0.25), hipL: J(0, 0, -0.25), kneeR: J(-0.15), kneeL: J(-0.15) }, k);
    }

    // 맞았을 때: 상체가 뒤로 젖혀지며 움찔 (맞은 직후 0.35초)
    const hurtK = p.dead ? 0 : Utils.clamp((p.hurtTimer - (c.hurtInvincible - 0.35)) / 0.35, 0, 1);
    if (hurtK > 0) {
      blendPose(pose, { spine: J(0.35, 0.25), neck: J(-0.35), shoulderL: J(0.4, 0, -0.7), elbowL: J(1.2),
        hipR: J(-0.25), kneeR: J(-0.35), hipL: J(0.35), kneeL: J(-0.55) }, Math.sin(hurtK * Math.PI * 0.5));
      hipsY -= 0.05 * hurtK;
    }

    if (p.dead) {   // 쓰러짐: 무릎이 꺾이며 천천히 주저앉음
      const k = Utils.smooth(Game.deathTimer / 0.5);
      blendPose(pose, KNOCKED_DOWN, k);
      hipsY = Utils.lerp(hipsY, 0.42, k);
    }

    // 코트 자락: 앞자락은 허벅지에 밀려 올라가고, 뒷자락은 달리면 뒤로 날리며 펄럭임 (용수철처럼)
    const coatTarget = amt * 0.55 + (p.isDodging ? 0.5 : 0) + (p.spinTimer > 0 ? 0.9 : 0);
    this.coatVel += ((coatTarget - this.coat) * 60 - this.coatVel * 8) * dt;
    this.coat += this.coatVel * dt;
    const flap = Math.sin(time * 11) * 0.08 * (amt + (p.spinTimer > 0 ? 1 : 0));
    const hr = pose.hipR.x, hl = pose.hipL.x;
    pose.coatFR = J(Math.max(0, hr) * 0.95 + 0.05 * amt);
    pose.coatFL = J(Math.max(0, hl) * 0.95 + 0.05 * amt);
    pose.coatBR = J(Math.min(0, hr) * 0.9 - this.coat + flap, 0, 0.1 * this.coat);
    pose.coatBL = J(Math.min(0, hl) * 0.9 - this.coat - flap, 0, -0.1 * this.coat);

    // 눈 깜빡임: 몇 초마다 한 번
    this.blinkTimer -= dt;
    if (this.blinkTimer < -0.14) this.blinkTimer = 2 + Math.random() * 3.5;
    this.blink = this.blinkTimer < 0 ? Math.sin((-this.blinkTimer / 0.14) * Math.PI) : 0;

    // 돌 때 몸을 안쪽으로 기울임
    const turn = Math.atan2(Math.sin(p.facing - this.lastFacing), Math.cos(p.facing - this.lastFacing)) / Math.max(dt, 1e-4);
    this.lastFacing = p.facing;
    const leanTarget = p.isDodging || p.spinTimer > 0 ? 0 : Utils.clamp(-turn * 0.03 * amt, -0.25, 0.25);
    this.lean += (leanTarget - this.lean) * Math.min(1, dt * 8);

    // 3인칭: 머리를 카메라가 보는 쪽으로 살짝 돌림
    if (!Camera.isFirst && !p.isDodging && !p.dead) {
      const look = Utils.clamp(Math.atan2(Math.sin(p.yaw - p.facing), Math.cos(p.yaw - p.facing)), -0.8, 0.8);
      pose.neck = J(pose.neck.x + p.pitch * 0.4, pose.neck.y - look * 0.75, pose.neck.z);
      pose.spine = J(pose.spine.x, pose.spine.y - look * 0.15, pose.spine.z);
    }

    this.pose = pose;
    this.hipsY = hipsY;
  },

  // 각 몸 부분의 세상 좌표 행렬 [{ mesh: 모델 이름, m: 행렬 }]
  // (관절 행렬은 this.W에 남겨 둠 → 망토가 어깨·몸 위치를 알 수 있게)
  matrices(p) {
    let root = M4.chain(M4.translation(p.x, p.groundY, p.z), M4.rotationY(-(p.facing + (this.spin || 0)) - Math.PI / 2), M4.rotationZ(this.lean));
    if (this.roll) root = M4.chain(root, M4.translation(0, 0.55, 0), M4.rotationX(-this.roll), M4.translation(0, -0.55, 0));
    let { out, W } = rigMatrices(RIG, root, this.pose, { hips: this.hipsY });
    // 눈꺼풀: 깜빡일 때만 위(눈 윗선)에서 아래로 늘어나며 덮음
    out = out.filter((o) => o.mesh !== 'lids' || this.blink > 0.05);
    for (const o of out) {
      if (o.mesh === 'lids') o.m = M4.chain(o.m, M4.translation(0, 0.17, 0), M4.scaling(1, this.blink, 1), M4.translation(0, -0.17, 0));
    }
    for (const o of out) o.knight = true;   // 갑옷 빛줄기를 무기 속성 색으로 그릴 부분
    this.swordM = M4.chain(W.handR, M4.translation(0, -0.06, 0), M4.rotationX(-Math.PI / 2));
    out.push({ mesh: Weapons.meshName, m: this.swordM });
    this.W = W;
    return out;
  },
};
