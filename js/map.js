// 구역(맵)을 읽어 3D 세계로 만들기: 지형·나무·연못·출구, 충돌 판정
// 맵 데이터는 levels.js에 있습니다.

const CELL = 2;     // 맵 한 칸의 크기 (m)
const MARGIN = 5;   // 맵 바깥에 둘러 심는 숲의 두께 (칸)

// 땅 색 (선형 RGB)
const GROUND = {
  grass: Utils.color('#62864a'),     // 볕 받으면 파스텔 연두가 되는 풀밭
  grassDry: Utils.color('#7a8d4e'),  // 마른 풀 얼룩 (노르스름한 올리브)
  forest: Utils.color('#4f5a34'),    // 숲 바닥 (검지 않은 짙은 올리브, 먼 들판도 이 색)
  dirt: Utils.color('#7d6e55'),      // 흙길 (볕 받으면 밝은 베이지빛)
  mud: Utils.color('#4a4236'),
};
// 동굴 바닥 색 (위와 같은 이름: 바닥·마른 바닥·벽 밑·길·젖은 곳)
const CAVE_GROUND = {
  grass: Utils.color('#5e5850'),
  grassDry: Utils.color('#6f675a'),
  forest: Utils.color('#2a2623'),
  dirt: Utils.color('#7d6c52'),
  mud: Utils.color('#34302b'),
};
const CRYSTAL_TINTS = [[0.45, 0.95, 1.25], [0.95, 0.55, 1.3]];   // 수정 색: 하늘빛 / 보랏빛 (빛 색도 같음)
const TORCH_LIGHT = [2.6, 1.2, 0.42];                           // 횃불 빛 (주황)
const FLOWER_COLORS = [[1, 1, 1], [1, 0.8, 0.15], [1, 0.4, 0.6], [0.65, 0.45, 1], [0.45, 0.65, 1]];

// 모델별 그리기 설정
//   thin: 얇은 잎(양면, 그림자 없음)  grass: 바람 물결·전사 주변에서 눕기  ao: 밑동을 어둡게 할 높이(m)  rim: 윤곽 빛
//   dist: 이보다 먼 구역은 그리지 않음(m, 작은 것들은 멀면 어차피 안 보임)
const PROP_STYLE = {
  pineA: { ao: 2.5, rim: 0.4 }, pineB: { ao: 2.5, rim: 0.4 }, oakA: { ao: 2.5, rim: 0.4 }, oakB: { ao: 2.5, rim: 0.4 },
  birch: { ao: 2.5, rim: 0.4 }, bush: { ao: 1, rim: 0.3 }, rock: { ao: 1.2, rim: 0.3 }, log: { rim: 0.2, dist: 60 },
  mushroom: { rim: 0.3, dist: 35 }, grass: { thin: true, grass: true, dist: 50 }, flower: { thin: true, grass: true, dist: 40 },
  fern: { thin: true, grass: true, dist: 50 }, reeds: { thin: true, grass: true, dist: 60 }, lily: { thin: true, dist: 60 },
  pebbles: { rim: 0.2, dist: 30 }, litter: { thin: true, dist: 40 }, ruin: { ao: 2, rim: 0.3 }, gate: { rim: 0.3 },
  cliffRock: { ao: 4, rim: 0.15 }, stalagmite: { ao: 1.5, rim: 0.2 }, stalactite: { rim: 0.1 }, crystal: { rim: 0.3 },
  torch: { rim: 0.2 }, glowShroom: { dist: 40 }, vines: { thin: true, dist: 60 },
};
const CHUNK = 12;   // 화면 밖 건너뛰기를 위한 구역 크기 (m)

// 모델이 차지하는 범위: 가로 반지름, 아래·위 높이
function extentOf(b) {
  let r = 0, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < b.pos.length; i += 3) {
    r = Math.max(r, Math.hypot(b.pos[i], b.pos[i + 2]));
    y0 = Math.min(y0, b.pos[i + 1]);
    y1 = Math.max(y1, b.pos[i + 1]);
  }
  return { r, y0, y1 };
}

// 인스턴스를 구역별로 묶고, 구역마다 감싸는 상자를 계산
function groupByChunk(arr, ext) {
  const groups = new Map();
  for (let i = 0; i < arr.length; i += 8) {
    const key = Math.floor(arr[i] / CHUNK) + ',' + Math.floor(arr[i + 2] / CHUNK);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  }
  const sorted = [], parts = [];
  for (const idxs of groups.values()) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    const start = sorted.length / 8;
    for (const i of idxs) {
      for (let k = 0; k < 8; k++) sorted.push(arr[i + k]);
      const s = arr[i + 4], r = ext.r * s + 0.5;
      min[0] = Math.min(min[0], arr[i] - r); max[0] = Math.max(max[0], arr[i] + r);
      min[2] = Math.min(min[2], arr[i + 2] - r); max[2] = Math.max(max[2], arr[i + 2] + r);
      min[1] = Math.min(min[1], arr[i + 1] + ext.y0 * s - 0.5); max[1] = Math.max(max[1], arr[i + 1] + ext.y1 * s + 0.5);
    }
    parts.push({ start, count: idxs.length, box: { min, max } });
  }
  return { sorted, parts };
}

const World = {
  level: null,
  data: [],
  cols: 0,
  rows: 0,
  waterLevel: null,  // 연못 수면 높이 (연못이 없으면 null)
  colliders: {},     // '칸x,칸z' → 둥근 장애물 [{ x, z, r }]
  meshes: [],        // 그래픽 카드에 올린 모델 [{ mesh, cull, shadow, ground, ao, grass, rim, fog }]
  water: null,       // 연못 물 모델
  trees: [],         // 나무 잎 위치 [x, 높이, z, 반지름] (낙엽이 떨어지는 곳)
  flowerSpots: [],   // 꽃 위치 [x, y, z] (나비가 노는 곳)
  gate: null,        // 출구 { x, y, z, dx, dz(통로 방향), px, pz(기둥 방향) }
  gateOpen: false,   // 적을 모두 물리치면 true
  barrierFade: 1,    // 마법 장벽의 진하기 (1 → 0으로 사라짐)
  barrier: null,     // 장벽 모델
  pillar: null,      // 열린 출구의 빛기둥 모델
  start: { x: 0, z: 0, angle: 0 },
  cave: false,       // 동굴 구역인지 (바위 벽·천장, 횃불·수정 빛)
  pal: GROUND,       // 땅 색 (숲 / 동굴)
  lights: [],        // 주변을 비추는 빛 [{ x, y, z, r(닿는 거리), color, flicker }] (횃불·수정)
  torches: [],       // 불꽃이 피어오르는 자리 [x, y, z]
  holes: [],         // 동굴 천장 구멍 [x, z, 바닥 x, 바닥 z] (햇빛이 비스듬히 들어와 바닥에 닿는 자리)
  shafts: null,      // 천장 구멍으로 쏟아지는 빛줄기 모델
  bossSpot: null,    // 보스가 잠들어 있는 자리 (지도의 B)

  load(level) {
    this.meshes.forEach((m) => GL.deleteMesh(m.mesh));
    for (const m of [this.water, this.barrier, this.pillar, this.shafts]) if (m) GL.deleteMesh(m);
    this.water = this.barrier = this.pillar = this.gate = this.shafts = null;
    this.gateOpen = false;
    this.barrierFade = 1;
    this.level = level;
    this.cave = level.theme === 'cave';
    this.pal = this.cave ? CAVE_GROUND : GROUND;
    this.data = level.data;
    this.rows = this.data.length;
    this.cols = this.data[0].length;
    this.colliders = {};
    this.bossSpot = null;
    this.start = { x: (this.cols * CELL) / 2, z: (this.rows * CELL) / 2, angle: Utils.rad(level.startAngle || 0) };
    this.data.forEach((row, z) => {
      if (row.length !== this.cols) console.warn(`맵 ${z}번째 줄의 길이가 다릅니다.`);
      const x = row.indexOf('P');
      if (x >= 0) this.start = { x: (x + 0.5) * CELL, z: (z + 0.5) * CELL, angle: this.start.angle };
      const b = row.indexOf('B');
      if (b >= 0) this.bossSpot = { x: (b + 0.5) * CELL, z: (z + 0.5) * CELL };
    });
    // 수면 높이: 연못 칸들의 땅 높이 중 가장 낮은 곳보다 살짝 아래
    this.waterLevel = null;
    let low = Infinity;
    for (let cz = 0; cz < this.rows; cz++) {
      for (let cx = 0; cx < this.cols; cx++) {
        if (this.data[cz][cx] !== '~') continue;
        for (const [ox, oz] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5]]) low = Math.min(low, this.baseHeight((cx + ox) * CELL, (cz + oz) * CELL));
      }
    }
    if (low < Infinity) this.waterLevel = low - 0.12;
    this.build();
  },

  // 칸의 문자 (맵 밖은 숲)
  cell(cx, cz) {
    if (cx < 0 || cz < 0 || cx >= this.cols || cz >= this.rows) return '#';
    return this.data[cz][cx] || '#';
  },

  // 주변 8칸 중 지나갈 수 있는 칸이 있는지 (숲의 가장자리인지)
  nearOpen(cx, cz) {
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) if (this.cell(cx + i, cz + j) !== '#') return true;
    }
    return false;
  },

  // 원래 땅 높이 (m): 완만한 언덕
  baseHeight(x, z) {
    return (Utils.fbm2(x * 0.05, z * 0.05, 3) - 0.5) * 2.4;
  },

  // 실제 땅 높이: 연못 자리는 움푹 파임
  groundHeight(x, z) {
    const h = this.baseHeight(x, z);
    if (this.waterLevel === null) return h;
    const w = this.blend(x, z, (c) => c === '~');
    if (w <= 0.5) return h;
    return Utils.lerp(h, this.waterLevel - 0.9, Utils.smooth((w - 0.5) * 2.2));
  },

  // 주변 칸을 부드럽게 섞어서, (x, z)가 조건에 맞는 정도 (0~1)
  blend(x, z, test) {
    const gx = x / CELL - 0.5, gz = z / CELL - 0.5;
    const i = Math.floor(gx), j = Math.floor(gz);
    const fx = gx - i, fz = gz - j;
    const v = (a, b) => (test(this.cell(a, b)) ? 1 : 0);
    return Utils.lerp(Utils.lerp(v(i, j), v(i + 1, j), fx), Utils.lerp(v(i, j + 1), v(i + 1, j + 1), fx), fz);
  },

  // 흙길인 정도 (가장자리가 자연스럽게 들쭉날쭉)
  dirtAmount(x, z) {
    const d = this.blend(x, z, (c) => c === ':');
    return Utils.clamp((d - 0.3) * 2.5 + (Utils.noise2(x * 0.9, z * 0.9) - 0.5) * 0.7, 0, 1);
  },

  // 근처(주변 1칸 안)에 연못이 있는지
  pondNear(x, z) {
    if (this.waterLevel === null) return false;
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) if (this.cell(cx + i, cz + j) === '~') return true;
    }
    return false;
  },

  // 물에 잠겼거나 물가 진흙인지
  isWet(x, z) {
    return this.pondNear(x, z) && this.groundHeight(x, z) < this.waterLevel + 0.08;
  },

  groundColor(x, z) {
    const G = this.pal;
    const forest = this.blend(x, z, (c) => c === '#');
    const n = Utils.fbm2(x * 0.15, z * 0.15, 3);
    let col = Utils.mixColor(G.grass, G.grassDry, Utils.smooth((n - 0.45) * 3));
    col = Utils.mixColor(col, G.forest, forest * 0.85);
    col = Utils.mixColor(col, G.dirt, this.dirtAmount(x, z));
    if (this.pondNear(x, z)) {   // 물가: 젖은 진흙
      const wet = Utils.smooth((this.waterLevel + 0.25 - this.groundHeight(x, z)) / 0.3);
      col = Utils.mixColor(col, G.mud, wet);
    }
    return col;
  },

  // 동굴 천장 높이 (m). 넓은 곳 가운데는 높고 벽 쪽으로 낮아짐. 동굴이 아니면 무한히 높음
  ceilAt(x, z) {
    if (!this.cave) return Infinity;
    const wall = (c) => c === '#';
    const near = this.blend(x, z, wall) * 0.4 + (this.blend(x - 3, z, wall) + this.blend(x + 3, z, wall) + this.blend(x, z - 3, wall) + this.blend(x, z + 3, wall)) * 0.15;
    return 8.2 + Utils.fbm2(x * 0.09 + 5, z * 0.09 - 3, 3) * 2.6 - near * 4.2;
  },

  // (x, z) 위 천장이 뚫려 있는지 (hole: 구멍 반지름에 더할 여유)
  inHole(x, z, pad = 0) {
    for (const h of this.holes) {
      const r = 2.1 + pad + (Utils.noise2(x * 0.9, z * 0.9) - 0.5) * 0.8;   // 들쭉날쭉한 구멍 가장자리
      if (Math.hypot(x - h[0], z - h[1]) < r) return true;
    }
    return false;
  },

  addCollider(x, z, r) {
    const key = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    (this.colliders[key] = this.colliders[key] || []).push({ x, z, r });
  },

  // 반지름 r인 몸이 (x, z)에 있을 때 막히는지 (camera가 true면 물은 막지 않음)
  blocked(x, z, r, camera) {
    const solid = (px, pz) => {
      const c = this.cell(Math.floor(px / CELL), Math.floor(pz / CELL));
      return c === '#' || (!camera && (c === '~' || (c === 'E' && !this.gateOpen)));
    };
    if (solid(x - r, z - r) || solid(x + r, z - r) || solid(x - r, z + r) || solid(x + r, z + r)) return true;
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let j = cz - 1; j <= cz + 1; j++) {
      for (let i = cx - 1; i <= cx + 1; i++) {
        const list = this.colliders[`${i},${j}`];
        if (!list) continue;
        for (const c of list) {
          const dx = x - c.x, dz = z - c.z, rr = r + c.r;
          if (dx * dx + dz * dz < rr * rr) return true;
        }
      }
    }
    return false;
  },

  // 적이 나타날 수 있는 빈 칸들 (시작 위치·연못·출구에서 떨어진 풀밭)
  spawnCells() {
    const cells = [];
    for (let cz = 0; cz < this.rows; cz++) {
      for (let cx = 0; cx < this.cols; cx++) {
        if (!'.:fo'.includes(this.data[cz][cx])) continue;
        const x = (cx + 0.5) * CELL, z = (cz + 0.5) * CELL;
        if (Math.hypot(x - this.start.x, z - this.start.z) < 14 || this.pondNear(x, z) || this.blocked(x, z, 0.5)) continue;
        if (this.gate && Math.hypot(x - this.gate.x, z - this.gate.z) < 5) continue;
        if (this.bossSpot && Math.hypot(x - this.bossSpot.x, z - this.bossSpot.z) < 5) continue;
        cells.push({ x, z });
      }
    }
    return cells;
  },

  // 물체(x, z, radius)를 (dx, dz)만큼 움직이되 막힌 곳은 통과하지 못하게 (0.1m씩 나눠 이동)
  moveEntity(e, dx, dz) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.1));
    const sx = dx / steps, sz = dz / steps;
    let hit = false;
    for (let i = 0; i < steps; i++) {
      e.x += sx;
      if (this.blocked(e.x, e.z, e.radius)) { e.x -= sx; hit = true; }
      e.z += sz;
      if (this.blocked(e.x, e.z, e.radius)) { e.z -= sz; hit = true; }
    }
    return hit;
  },

  // 맵 문자를 보고 나무·바위·풀 등을 배치해 3D 모델로 만듦
  build() {
    const rnd = Utils.rng(7);
    const inst = {};
    for (const name in PROP_STYLE) inst[name] = [];
    const shadeAt = [];   // 땅에 드리우는 은은한 그늘 [x, z, 반지름, 세기]
    this.trees = [];
    this.flowerSpots = [];
    this.lights = [];
    this.torches = [];
    this.holes = [];
    const cave = this.cave;
    // 천장 구멍: 햇빛이 비스듬히 들어와 'o' 칸 바닥에 닿도록, 구멍은 해 쪽으로 비켜서 뚫음
    if (cave) {
      const sun = LIGHTING.cave.sunDir;
      this.data.forEach((row, cz) => [...row].forEach((ch, cx) => {
        if (ch !== 'o') return;
        const fx = (cx + 0.5) * CELL, fz = (cz + 0.5) * CELL, rise = this.ceilAt(fx, fz) - this.groundHeight(fx, fz);
        this.holes.push([fx + (sun[0] / sun[1]) * rise, fz + (sun[2] / sun[1]) * rise, fx, fz]);
      }));
    }
    const put = (name, x, z, scale, tint, sink = 0.05, y = null, rot) => {
      inst[name].push(x, y === null ? this.groundHeight(x, z) - sink : y, z, rot === undefined ? rnd() * Math.PI * 2 : rot, scale, tint[0], tint[1], tint[2]);
    };
    const shade = (amt) => {
      const k = 1 + (rnd() - 0.5) * amt;
      return [k * (1 + (rnd() - 0.5) * amt * 0.6), k, k * (1 + (rnd() - 0.5) * amt * 0.6)];
    };
    const tree = (x, z) => {
      const r = rnd();
      const name = r < 0.3 ? 'pineA' : r < 0.5 ? 'pineB' : r < 0.68 ? 'oakA' : r < 0.82 ? 'oakB' : 'birch';
      const s = 0.8 + rnd() * 0.5;
      put(name, x, z, s, shade(0.25), 0.1);
      shadeAt.push([x, z, 2.6 * s, 0.5]);
      this.trees.push([x, this.groundHeight(x, z) + 4.2 * s, z, 1.6 * s]);
      return name;
    };
    const tufts = Math.round(CONFIG.graphics.grassDensity * CELL * CELL);
    const wl = this.waterLevel;

    for (let cz = -MARGIN; cz < this.rows + MARGIN; cz++) {
      for (let cx = -MARGIN; cx < this.cols + MARGIN; cx++) {
        const ch = this.cell(cx, cz);
        const x0 = cx * CELL, z0 = cz * CELL;
        const rx = () => x0 + 0.15 + rnd() * (CELL - 0.3);
        const rz = () => z0 + 0.15 + rnd() * (CELL - 0.3);

        if (ch === '#' && cave) {   // 동굴 벽: 가장자리는 큰 바위 둘, 한 칸 안쪽은 하나 (그 너머는 보이지 않으므로 비움)
          const edge = this.nearOpen(cx, cz);
          let near2 = edge;
          for (let j = -2; j <= 2 && !near2; j++) for (let i = -2; i <= 2 && !near2; i++) near2 = this.cell(cx + i, cz + j) !== '#';
          const n = edge ? 2 : near2 ? 1 : 0;
          for (let k = 0; k < n; k++) put('cliffRock', rx(), rz(), 0.8 + rnd() * 0.45, shade(0.25), 0.4);
          continue;
        }
        if (ch === '#') {   // 숲: 가장자리는 빽빽하게(덤불·고사리·버섯·통나무), 안쪽은 듬성듬성
          const edge = this.nearOpen(cx, cz);
          const n = edge ? 2 : rnd() < 0.75 ? 1 : 0;
          for (let k = 0; k < n; k++) tree(rx(), rz());
          if (!edge) continue;
          for (let k = 0; k < 2; k++) {
            const x = rx(), z = rz(), s = 0.8 + rnd() * 0.6;
            put('bush', x, z, s, shade(0.3));
            shadeAt.push([x, z, 1.2 * s, 0.35]);
          }
          for (let k = 0; k < 3; k++) put('fern', rx(), rz(), 0.8 + rnd() * 0.6, shade(0.3), 0.02);
          if (rnd() < 0.3) put('mushroom', rx(), rz(), 0.8 + rnd() * 0.6, shade(0.2), 0);
          if (rnd() < 0.1) {
            put('log', x0 + CELL / 2, z0 + CELL / 2, 0.8 + rnd() * 0.3, shade(0.2), 0.12);
            shadeAt.push([x0 + CELL / 2, z0 + CELL / 2, 1.6, 0.3]);
          }
          continue;
        }

        // 물가: 갈대 (얕은 물가 띠에만), 연못 안: 연잎과 수련
        if (cave && ch === '~') continue;
        if (!cave && wl !== null && this.pondNear(x0 + 1, z0 + 1)) {
          for (let k = 0; k < 6; k++) {
            const x = rx(), z = rz(), h = this.groundHeight(x, z);
            if (h > wl - 0.35 && h < wl + 0.25 && rnd() < 0.45) put('reeds', x, z, 0.8 + rnd() * 0.5, shade(0.25), 0.05);
          }
          if (ch === '~') {
            for (let k = 0; k < 3; k++) {
              const x = rx(), z = rz();
              if (this.groundHeight(x, z) > wl - 0.5) continue;
              put('lily', x, z, 0.8 + rnd() * 0.6, shade(0.2), 0, wl + 0.01);
              if (rnd() < 0.35) put('flower', x + 0.08, z + 0.05, 0.6, [1, 0.55, 0.75], 0, wl - 0.13);
            }
            continue;
          }
        }

        if (ch === 'E') {   // 출구: 돌 아치. 뒤쪽 숲(#) 방향이 통로
          const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([i, j]) => this.cell(cx + i, cz + j) === '#') || [1, 0];
          const gx = x0 + CELL / 2, gz = z0 + CELL / 2, gy = this.groundHeight(gx, gz);
          put('gate', gx, gz, 1, [1, 1, 1], 0.05, null, Math.atan2(nb[0], nb[1]));
          const px = nb[1], pz = -nb[0];   // 기둥이 놓이는 방향 (통로와 수직)
          this.addCollider(gx + px * 1.45, gz + pz * 1.45, 0.5);
          this.addCollider(gx - px * 1.45, gz - pz * 1.45, 0.5);
          this.gate = { x: gx, y: gy, z: gz, dx: nb[0], dz: nb[1], px, pz };
          shadeAt.push([gx, gz, 2.5, 0.3]);
          continue;
        }

        const mx = x0 + CELL / 2 + (rnd() - 0.5) * 0.6, mz = z0 + CELL / 2 + (rnd() - 0.5) * 0.6;
        if (cave) {
          this.buildCaveCell(ch, cx, cz, mx, mz, rx, rz, put, shade, shadeAt, rnd);
          continue;
        }
        if (ch === 'X') {   // 무너진 돌기둥
          const s = 0.9 + rnd() * 0.3;
          put('ruin', mx, mz, s, shade(0.15), 0.1);
          this.addCollider(mx, mz, 0.65 * s);
          shadeAt.push([mx, mz, 1.8 * s, 0.45]);
        }
        if (ch === 'T') {
          const name = tree(mx, mz);
          this.addCollider(mx, mz, name.startsWith('oak') ? 0.5 : 0.4);
          if (rnd() < 0.5) put('mushroom', mx + 0.5, mz + 0.3, 0.8, shade(0.2), 0);
          for (let k = 0; k < 3; k++) {   // 나무 밑 낙엽
            const a = rnd() * 6.28, d = 0.6 + rnd() * 1.2;
            put('litter', mx + Math.cos(a) * d, mz + Math.sin(a) * d, 0.8 + rnd() * 0.5, shade(0.3), -0.01);
          }
        }
        if (ch === 'R') {
          const s = 0.9 + rnd() * 0.5;
          put('rock', mx, mz, s, shade(0.2), 0.1);
          this.addCollider(mx, mz, 0.85 * s);
          shadeAt.push([mx, mz, 1.4 * s, 0.45]);
          for (let k = 0; k < 2; k++) put('rock', rx(), rz(), 0.25 + rnd() * 0.2, shade(0.2));
        }
        if (ch === 'b') {
          const s = 1 + rnd() * 0.4;
          put('bush', mx, mz, s, shade(0.3));
          this.addCollider(mx, mz, 0.7 * s);
          shadeAt.push([mx, mz, 1.2 * s, 0.35]);
        }
        // 숲 바로 옆 풀밭엔 고사리가 자람
        const besideForest = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([i, j]) => this.cell(cx + i, cz + j) === '#');
        if (besideForest && rnd() < 0.5) put('fern', rx(), rz(), 0.7 + rnd() * 0.5, shade(0.3), 0.02);
        if (besideForest && rnd() < 0.5) put('litter', rx(), rz(), 0.8 + rnd() * 0.5, shade(0.3), -0.01);
        for (let k = 0; k < 2; k++) {   // 흙길 위 자갈
          const x = rx(), z = rz();
          if (this.dirtAmount(x, z) > 0.55) put('pebbles', x, z, 0.6 + rnd() * 0.6, shade(0.2), 0.02);
        }
        if (ch === 'f') this.flowerSpots.push([x0 + CELL / 2, this.groundHeight(x0 + CELL / 2, z0 + CELL / 2), z0 + CELL / 2]);
        const flowers = ch === 'f' ? 16 : rnd() < 0.15 ? 1 : 0;
        for (let k = 0; k < flowers; k++) {
          const x = rx(), z = rz();
          if (this.dirtAmount(x, z) < 0.3 && !this.isWet(x, z)) put('flower', x, z, 0.8 + rnd() * 0.5, FLOWER_COLORS[(rnd() * FLOWER_COLORS.length) | 0], 0);
        }
        for (let k = 0; k < tufts; k++) {
          const x = x0 + rnd() * CELL, z = z0 + rnd() * CELL;
          if (this.dirtAmount(x, z) < 0.35 + rnd() * 0.2 && !this.isWet(x, z)) put('grass', x, z, 0.7 + rnd() * 0.7, shade(0.35), 0.02);
        }
      }
    }

    // 천장 구멍 가장자리를 따라 늘어진 덩굴 (구멍으로 들어온 햇빛을 받아 반짝임)
    if (cave) {
      for (const [hx, hz] of this.holes) {
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * Math.PI * 2 + rnd() * 0.5, r = 2.0 + rnd() * 0.5, x = hx + Math.cos(a) * r, z = hz + Math.sin(a) * r;
          inst.vines.push(x, this.ceilAt(x, z) + 0.1, z, rnd() * Math.PI * 2, 0.8 + rnd() * 0.5, 1, 1, 1);
        }
      }
    }
    this.meshes = [{ mesh: GL.createMesh(this.buildGround(shadeAt)), cull: true, ground: true }];
    if (cave) this.meshes.push({ mesh: GL.createMesh(this.buildCeiling()), cull: false, shadow: true, ao: 0 });
    else this.meshes.push({ mesh: GL.createMesh(buildMountains((this.cols * CELL) / 2, (this.rows * CELL) / 2, LIGHTING[this.level.theme].mountainScale || 1)), cull: false, fog: 0.0019 });   // 산 높이는 테마별 (숲은 지평선 위로 낮게)
    for (const name in inst) {
      if (!inst[name].length) continue;
      const st = PROP_STYLE[name];
      const { sorted, parts } = groupByChunk(inst[name], extentOf(Models[name]));
      this.meshes.push({ mesh: GL.createMesh(Models[name], sorted, parts), cull: !st.thin, shadow: !st.thin,
        ao: st.ao || 0, grass: !!st.grass, rim: st.rim || 0, dist: st.dist || 0 });
    }

    if (cave) this.shafts = this.holes.length ? GL.createMesh(this.buildShafts()) : null;
    // 숲 너머: 완만한 언덕과 그 위를 덮은 먼 숲 (안개 속에 겹겹이 보임)
    const cxm = (this.cols * CELL) / 2, czm = (this.rows * CELL) / 2;
    const halfW = cxm + MARGIN * CELL, halfH = czm + MARGIN * CELL;
    const far = [];
    for (let k = 0; k < (cave ? 0 : 1800); k++) {
      const a = rnd() * Math.PI * 2, d = 40 + rnd() * 150;
      const x = cxm + Math.cos(a) * d, z = czm + Math.sin(a) * d;
      if (Math.abs(x - cxm) < halfW + 2 && Math.abs(z - czm) < halfH + 2) continue;   // 가까운 숲은 이미 있음
      const skirt = -2.5 * Utils.clamp((d - 45) / 195, 0, 1);   // 바깥 들판 높이 (대략)
      const t = shade(0.3);
      far.push(x, Math.max(hillHeight(x, z, cxm, czm), skirt) - 0.3, z, rnd() * 6.28, 0.8 + rnd() * 0.9, t[0], t[1], t[2]);
    }
    if (!cave) {
      const farGroups = groupByChunk(far, extentOf(Models.farTree));
      this.meshes.push({ mesh: GL.createMesh(Models.farTree, farGroups.sorted, farGroups.parts), cull: true, fog: 0.006 });
      this.meshes.push({ mesh: GL.createMesh(buildHills(cxm, czm)), cull: false, fog: 0.006 });
    }
    this.water = wl === null ? null : GL.createMesh(this.buildWater());

    // 출구의 마법 장벽(아치 사이 판)과 열린 뒤의 빛기둥
    if (this.gate) {
      const g = this.gate, b = new MeshBuilder(), n = [g.dx, 0, g.dz];
      const corner = (side, up) => [g.x + g.px * 1.1 * side, g.y - 0.1 + up * 3.2, g.z + g.pz * 1.1 * side];
      const q = [corner(-1, 0), corner(1, 0), corner(1, 1), corner(-1, 1)];
      const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
      for (const k of [0, 1, 2, 0, 2, 3]) b.vert(q[k], n, [1, 1, 1, 0], 0, uv[k]);
      this.barrier = GL.createMesh(b);
      const pb = new MeshBuilder();
      Shapes.cylinder(pb, M4.translation(g.x, g.y - 0.2, g.z), 1.1, 0.8, 9, 18, () => [1, 1, 1, 0], { smooth: true, top: false });
      this.pillar = GL.createMesh(pb);
    }
  },

  // 동굴의 빈 칸 하나: 수정(C)·횃불(t)·석순(S)·바위(R)·돌기둥(X)·천장 구멍(o) + 벽가의 빛나는 버섯, 자갈, 종유석
  buildCaveCell(ch, cx, cz, mx, mz, rx, rz, put, shade, shadeAt, rnd) {
    const gy = this.groundHeight(mx, mz);
    if (ch === 'C') {
      const s = 0.85 + rnd() * 0.35, tint = CRYSTAL_TINTS[(rnd() * 2) | 0];
      put('crystal', mx, mz, s, tint, 0.05);
      this.addCollider(mx, mz, 0.7 * s);
      this.lights.push({ x: mx, y: gy + 1.3 * s, z: mz, r: 8, color: tint.map((v) => v * 1.5), flicker: 0 });
      for (let k = 0; k < 2; k++) put('crystal', rx(), rz(), 0.25 + rnd() * 0.2, tint, 0.03);   // 둘레의 작은 수정
    }
    if (ch === 't') {
      put('torch', mx, mz, 1, [1, 1, 1], 0.02);
      this.addCollider(mx, mz, 0.35);
      this.torches.push([mx, gy + 1.72, mz]);
      this.lights.push({ x: mx, y: gy + 2.1, z: mz, r: 10, color: TORCH_LIGHT, flicker: 1 + rnd() * 10 });
    }
    if (ch === 'S') {
      const s = 0.8 + rnd() * 0.5;
      put('stalagmite', mx, mz, s, shade(0.2), 0.05);
      this.addCollider(mx, mz, 0.5 * s);
      shadeAt.push([mx, mz, 1.2 * s, 0.4]);
    }
    if (ch === 'R') {
      const s = 0.9 + rnd() * 0.5;
      put('rock', mx, mz, s, [0.75, 0.72, 0.68], 0.1);
      this.addCollider(mx, mz, 0.85 * s);
      shadeAt.push([mx, mz, 1.4 * s, 0.45]);
    }
    if (ch === 'X') {
      const s = 0.9 + rnd() * 0.3;
      put('ruin', mx, mz, s, [0.8, 0.78, 0.75], 0.1);
      this.addCollider(mx, mz, 0.65 * s);
      shadeAt.push([mx, mz, 1.8 * s, 0.45]);
    }
    // 벽 바로 옆: 빛나는 버섯, 굴러떨어진 돌
    const besideWall = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([i, j]) => this.cell(cx + i, cz + j) === '#');
    if (besideWall && rnd() < 0.35) put('glowShroom', rx(), rz(), 0.8 + rnd() * 0.6, [1, 1, 1], 0);
    if (besideWall && rnd() < 0.5) put('rock', rx(), rz(), 0.3 + rnd() * 0.3, [0.7, 0.68, 0.64]);
    for (let k = 0; k < 2; k++) {   // 길 위 자갈
      const x = rx(), z = rz();
      if (this.dirtAmount(x, z) > 0.55) put('pebbles', x, z, 0.6 + rnd() * 0.6, [0.8, 0.78, 0.74], 0.02);
    }
    if (rnd() < 0.25) put('pebbles', rx(), rz(), 0.5 + rnd() * 0.5, [0.75, 0.73, 0.7], 0.02);
    // 천장에 매달린 종유석 (구멍 근처는 빼고)
    if (rnd() < 0.3) {
      const x = rx(), z = rz();
      if (!this.inHole(x, z, 1.2)) put('stalactite', x, z, 0.7 + rnd() * 0.7, shade(0.2), 0, this.ceilAt(x, z) + 0.15);
    }
  },

  // 동굴 천장: 1m 격자, 아래를 향한 면. 구멍 자리는 비움 (햇빛이 들어와 그림자 지도로 바닥에 빛 웅덩이가 생김)
  buildCeiling() {
    const b = new MeshBuilder();
    const pad = MARGIN * CELL + 6;
    const x0 = -pad, z0 = -pad, nx = Math.round(this.cols * CELL + pad * 2), nz = Math.round(this.rows * CELL + pad * 2);
    const rnd = Utils.rng(5);
    const pt = (x, z) => {
      const e = 0.5, h = this.ceilAt(x, z);
      const n = V3.normalize([this.ceilAt(x + e, z) - this.ceilAt(x - e, z), -2 * e, this.ceilAt(x, z + e) - this.ceilAt(x, z - e)]);
      return { p: [x, h, z], n };
    };
    const P = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) P.push(pt(x0 + i, z0 + j));
    const at = (i, j) => P[j * (nx + 1) + i];
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        if (this.inHole(x0 + i + 0.5, z0 + j + 0.5)) continue;
        const c = vary(COLORS.caveCeil, 0.1, rnd);
        for (const [a, bb] of [[0, 0], [1, 1], [1, 0], [0, 0], [0, 1], [1, 1]]) {
          const q = at(i + a, j + bb);
          b.vert(q.p, q.n, c);
        }
      }
    }
    return b;
  },

  // 천장 구멍마다 비스듬한 빛기둥 (구멍 → 바닥, 빛을 더해 그림)
  buildShafts() {
    const b = new MeshBuilder();
    for (const [hx, hz, fx, fz] of this.holes) {
      const top = [hx, this.ceilAt(hx, hz) + 0.5, hz], bottom = [fx, this.groundHeight(fx, fz) - 0.3, fz];
      Shapes.segment(b, bottom, top, 2.0, 1.8, 20, () => [1, 1, 1, 0], { smooth: true, top: false });
    }
    return b;
  },

  // 땅: 1m 간격 격자. 높이는 언덕, 색은 풀밭·흙길·숲 바닥을 섞고 나무 밑은 어둡게. 바깥은 멀리까지 넓게 깔기
  buildGround(shadeAt) {
    const b = new MeshBuilder();
    const pad = MARGIN * CELL + 20;
    const x0 = -pad, z0 = -pad;
    const nx = Math.round(this.cols * CELL + pad * 2), nz = Math.round(this.rows * CELL + pad * 2);
    const idx = (i, j) => j * (nx + 1) + i;

    // 나무·바위 밑 그늘 모으기
    const occ = new Float32Array((nx + 1) * (nz + 1));
    for (const [ox, oz, r, k] of shadeAt) {
      const i0 = Math.max(0, Math.floor(ox - r - x0)), i1 = Math.min(nx, Math.ceil(ox + r - x0));
      const j0 = Math.max(0, Math.floor(oz - r - z0)), j1 = Math.min(nz, Math.ceil(oz + r - z0));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const d = Math.hypot(x0 + i - ox, z0 + j - oz);
          if (d < r) occ[idx(i, j)] += (1 - d / r) * (1 - d / r) * k;
        }
      }
    }

    const P = [], N = [], C = [];
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const x = x0 + i, z = z0 + j, e = 0.5;
        P.push([x, this.groundHeight(x, z), z]);
        N.push(V3.normalize([
          this.groundHeight(x - e, z) - this.groundHeight(x + e, z), 2 * e,
          this.groundHeight(x, z - e) - this.groundHeight(x, z + e)]));
        const dark = 1 - Math.min(0.6, occ[idx(i, j)]);
        C.push(this.groundColor(x, z).map((v, n) => (n < 3 ? v * dark : v)));
      }
    }
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        for (const k of [idx(i, j), idx(i, j + 1), idx(i + 1, j + 1), idx(i, j), idx(i + 1, j + 1), idx(i + 1, j)]) {
          b.vert(P[k], N[k], C[k]);
        }
      }
    }

    // 바깥 들판: 격자 테두리에서 멀리 산 밑까지 (안개에 묻힘)
    const far = 240, cxm = (this.cols * CELL) / 2, czm = (this.rows * CELL) / 2;
    const up = [0, 1, 0], fc = this.pal.forest;
    const inner = [[x0, z0], [x0 + nx, z0], [x0 + nx, z0 + nz], [x0, z0 + nz]];
    const outer = [[cxm - far, czm - far], [cxm + far, czm - far], [cxm + far, czm + far], [cxm - far, czm + far]];
    for (let s = 0; s < 4; s++) {
      const t = (s + 1) % 4;
      const a = [inner[s][0], this.groundHeight(inner[s][0], inner[s][1]), inner[s][1]];
      const bb = [inner[t][0], this.groundHeight(inner[t][0], inner[t][1]), inner[t][1]];
      const c = [outer[t][0], -2.5, outer[t][1]], d = [outer[s][0], -2.5, outer[s][1]];
      b.vert(a, up, fc); b.vert(c, up, fc); b.vert(d, up, fc);
      b.vert(a, up, fc); b.vert(bb, up, fc); b.vert(c, up, fc);
    }
    return b;
  },

  // 연못 수면: 0.5m 간격 격자. 정점마다 '물 깊이'를 담아 두면 셰이더가 물가 거품과 색을 그림
  buildWater() {
    const b = new MeshBuilder();
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let cz = 0; cz < this.rows; cz++) {
      for (let cx = 0; cx < this.cols; cx++) {
        if (this.data[cz][cx] !== '~') continue;
        minX = Math.min(minX, cx - 1); maxX = Math.max(maxX, cx + 2);
        minZ = Math.min(minZ, cz - 1); maxZ = Math.max(maxZ, cz + 2);
      }
    }
    const step = 0.5, up = [0, 1, 0], wl = this.waterLevel;
    this.waterBox = { min: [minX * CELL, wl - 0.2, minZ * CELL], max: [maxX * CELL, wl + 0.2, maxZ * CELL] };   // 화면에 보이는지 확인용
    const nx = Math.round(((maxX - minX) * CELL) / step), nz = Math.round(((maxZ - minZ) * CELL) / step);
    const pt = (i, j) => {
      const x = minX * CELL + i * step, z = minZ * CELL + j * step;
      return { p: [x, wl, z], d: wl - this.groundHeight(x, z) };
    };
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const q = [pt(i, j), pt(i, j + 1), pt(i + 1, j + 1), pt(i + 1, j)];
        if (q.every((v) => v.d < -0.3)) continue;   // 완전히 땅 위인 곳은 생략
        for (const k of [0, 1, 2, 0, 2, 3]) b.vert(q[k].p, up, [0, 0, 0, 0], q[k].d);
      }
    }
    return b;
  },
};
