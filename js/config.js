// ============================================================
// ★ 밸런스·그래픽 수치 모음
// 숫자를 바꾸고 저장한 뒤 브라우저에서 새로고침(F5)하면 바로 적용됩니다.
// 단위: 거리 = m(미터, 맵 한 칸 = 2m), 시간 = 초, 속도 = 초당 m, 각도 = 도
// ============================================================
const CONFIG = {
  // 그래픽 품질 (게임이 끊기면 숫자를 낮추거나 그림자를 꺼 보세요)
  graphics: {
    renderScale: 1,      // 화면 해상도 배율 (0.5 ~ 1, 낮을수록 빠름)
    autoQuality: true,   // 끊기면 해상도를 자동으로 조금 낮춤
    shadows: true,       // 그림자 켜기(true) / 끄기(false)
    shadowSize: 2048,    // 그림자 선명도 (1024 / 2048 / 4096)
    grassDensity: 10,    // 1㎡당 풀 포기 수 (한 포기 = 풀잎 14장)
    grassDist: 50,       // 풀을 그리는 거리 (m). 끝에서는 풀이 땅으로 스르르 줄어듦
    grassLod: 20,        // 이보다 먼 풀은 큰 풀잎 절반만 그림 (0이면 끔)
    fov: 75,             // 시야각
    fogDensity: 0.013,   // 안개 짙기 (클수록 가까운 곳부터 흐려짐)
    outline: 0.012,      // 3인칭 전사 외곽선 두께(m, 0이면 끔)
    bloom: 0.45,         // 밝은 곳 빛 번짐 세기 (0이면 끔)
    godRays: true,       // 나무 사이로 비치는 빛줄기
    ssao: true,          // 구석·풀뿌리·덤불 밑을 은은하게 어둡게 (느리면 false)
    lensFlare: true,     // 해를 볼 때 렌즈 빛 번짐
    reflections: true,   // 연못에 주변이 비침 (느리면 false)
    softFocus: true,     // 먼 숲·산을 물감처럼 부드럽게 흐림 (느리면 false)
    life: true,          // 나비·새·떨어지는 잎·발걸음 먼지
    maxPixels: 2.6e6,    // 화면 해상도 상한 (화소 수)
    maxLights: 12,       // 동굴에서 한 번에 비추는 횃불·수정 빛 수 (1 ~ 12, 적을수록 빠름)
  },

  // 휴대폰·태블릿(터치 화면만 있는 기기)에서 시작할 때 위 graphics 대신 쓸 값 (그래픽 칩이 약해서 무거운 효과를 줄임)
  mobileGraphics: {
    renderScale: 0.8,
    shadowSize: 1024,
    grassDensity: 4,
    grassDist: 32,
    grassLod: 12,
    ssao: false,
    reflections: false,
    softFocus: false,
    maxPixels: 1.1e6,
    maxLights: 6,
  },

  // 카메라 (게임 중 V 키로 1인칭 ↔ 3인칭 전환)
  camera: {
    startView: 'third',  // 시작 시점: 'first'(1인칭) 또는 'third'(3인칭)
    distance: 3.6,       // 3인칭 카메라와 전사 사이 거리
    height: 1.8,         // 3인칭 카메라가 바라보는 높이 (높을수록 어깨 너머로 앞이 잘 보임)
    shoulder: 0.6,       // 3인칭 카메라를 오른쪽으로 비키는 정도 (어깨 너머 시점)
  },

  // 전사
  player: {
    maxHp: 100,          // 최대 체력 (공격력·검이 닿는 거리는 아래 weapons에서 무기마다)
    moveSpeed: 4.5,      // 걷는 속도
    turnSpeed: 120,      // 방향키(←/→)로 도는 속도 (초당 각도)
    mouseSensitivity: 0.12, // 마우스 감도 (마우스 1픽셀당 각도)
    touchSensitivity: 0.3,  // 터치 화면에서 손가락으로 끌 때 감도 (1픽셀당 각도)
    eyeHeight: 1.6,      // 눈높이
    radius: 0.35,        // 몸 크기 (나무·바위에 부딪히는 판정)

    attackTime: 0.25,    // 검을 휘두르는 시간
    attackCooldown: 0.5, // 다음 공격까지 기다리는 시간 (휘두르는 시간 포함)
    attackAngle: 80,     // 검이 휩쓰는 앞쪽 각도 폭
    comboWindow: 0.4,    // 휘두른 뒤 이 시간 안에 또 공격하면 다음 콤보 동작 (베기 → 되베기 → 내려찍기)
    finisherBonus: 1.5,  // 콤보 3번째 내려찍기의 피해 배율

    dodgeSpeed: 10,      // 회피(구르기) 속도
    dodgeTime: 0.35,     // 회피 시간 (이 동안 무적)
    dodgeCooldown: 0.7,  // 다음 회피까지 기다리는 시간
    hurtInvincible: 0.8, // 맞은 뒤 무적 시간 (몸이 깜빡임)
  },

  // 무기 (게임 중 1·2·3 키로 바꿈)
  // attack: 공격력, range: 검이 닿는 거리, burst: 콤보 마무리(내려찍기)의 속성 폭발 피해, burstRadius: 폭발 범위
  weapons: {
    balmung: { attack: 10, range: 2.2, burst: 12, burstRadius: 2.8 },        // 1 발뭉(빛): 균형 잡힌 성검. 내려찍으면 빛의 기둥
    laevateinn: { attack: 13, range: 2.4, burst: 8, burstRadius: 2.6,        // 2 레바테인(불): 한 방이 묵직함
      burn: 3, burnTime: 2 },                                                 //   맞은 적이 burnTime초 동안 0.5초마다 burn 피해
    astrape: { attack: 8, range: 2.2, burst: 8, burstRadius: 2.6,            // 3 아스트라페(번개): 벨 때마다
      chain: 2, chainDamage: 6, chainRange: 6 },                              //   번개가 chainRange m 안의 다른 적 chain마리에게 튐
  },

  // 스킬 (Q·E·F)과 궁극기 (R). 효과 색은 들고 있는 무기의 속성을 따름
  skills: {
    spin: { damage: 18, radius: 3.2, time: 0.5, cooldown: 4 },               // Q 회전베기: 한 바퀴 돌며 주변 적을 모두 벰
    wave: { damage: 22, speed: 18, range: 16, width: 1.8, cooldown: 6 },      // E 검기: 앞으로 날아가 적을 꿰뚫는 빛의 칼날
    dash: { damage: 28, distance: 7.5, time: 0.16, width: 2.0, delay: 0.3, cooldown: 5 },   // F 섬광 돌진: 순식간에 앞으로 베고 지나감 (delay초 뒤에 베인 자리가 터짐, 돌진 중 무적)
    // R 궁극기 (게이지 100 필요): 맵의 모든 적에게. 발뭉 = 하늘에서 빛의 검, 레바테인 = 불타는 유성, 아스트라페 = 번개
    ultimate: { damage: 90, castTime: 1.2, chargePerDamage: 1.2, chargePerSecond: 0.5 },
  },

  // 적 능력치 (체력, 공격력, 이동 속도, 전사를 알아채는 거리 등)
  enemies: {
    slime: { hp: 30, damage: 8, speed: 1.6, detect: 9, radius: 0.5 },
    goblin: { hp: 50, damage: 15, speed: 2.4, chargeSpeed: 10, chargeRange: 7, chargeCooldown: 2.5, detect: 12, radius: 0.45 },
    archer: { hp: 35, damage: 10, speed: 2.0, detect: 18, keepAway: 7, drawTime: 0.9, shootCooldown: 2.4, arrowSpeed: 15, radius: 0.4 },
    // 박쥐: 머리 위(flyHeight m)를 orbit m 거리로 돌다가 swoopSpeed로 덮침
    bat: { hp: 20, damage: 8, speed: 4.5, detect: 14, flyHeight: 2.7, orbit: 4.5, swoopSpeed: 11, swoopCooldown: 2.6, radius: 0.4 },
    // 보스 바위 골렘: slamRange m 안이면 내려찍기(slamWind초 예고, 반경 slamRadius, 그 뒤 stuckTime초 못 움직임),
    // 멀면 바위 던지기. poise만큼 피해가 쌓이면 staggerTime초 무릎 꿇음. 체력 절반 아래면 분노 (rageSpeed배 빨라짐, 박쥐 rageBats마리)
    golem: { hp: 650, speed: 1.8, detect: 13, radius: 1.6, slamRange: 4.2, slamWind: 1.05, slamRadius: 3.4, slamDamage: 24, stuckTime: 1.5,
      slamCooldown: 1.6, throwWind: 1.0, throwRadius: 2.4, throwDamage: 16, throwCooldown: 5, poise: 120, staggerTime: 1.8, rageSpeed: 1.35, rageBats: 2 },
  },

  // 구역별 적의 수
  levels: {
    forest1: { slime: 4, goblin: 2, archer: 1 },   // 고요한 숲
    forest2: { slime: 3, goblin: 3, archer: 3 },   // 숲 깊은 곳
    cave1: { slime: 3, goblin: 2, archer: 2, bat: 5 },   // 수정 동굴
    cave2: { bat: 2, golem: 1 },                         // 동굴 깊은 곳 (보스)
  },
};
