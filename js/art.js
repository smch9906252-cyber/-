// 3D 모델 만들기: 나무·바위·풀·꽃·물가 식물·먼 산·검·팔을 코드로 조립합니다.
// 나뭇잎은 '잎 무늬 그림(텍스처)'을 붙인 작은 판을 잔뜩 꽂아 풍성하게 만듭니다.

// 색의 네 번째 값 = 재질. 0~1은 금속 반짝임, 음수는 아래 재질 번호 (셰이더가 질감을 다르게 그림)
const MAT = { LEAF: -1, CARD: -2, BARK: -3, ROCK: -4, CLOTH: -5, GLOW: -6, SKIN: -7, HAIR: -8 };
const rgb = (hex, m = 0) => Utils.color(hex, m);

const COLORS = {
  bark: rgb('#5b3c25', MAT.BARK),
  pine: [rgb('#1f5a30', MAT.LEAF), rgb('#256836', MAT.LEAF), rgb('#2c753c', MAT.LEAF), rgb('#368244', MAT.LEAF)],
  pineUnder: rgb('#173f24', MAT.LEAF),
  leaf: [rgb('#3f8a2e', MAT.LEAF), rgb('#4c9a35', MAT.LEAF), rgb('#5aa83c', MAT.LEAF), rgb('#377a2a', MAT.LEAF)],
  bushLeaf: [rgb('#2f742c', MAT.LEAF), rgb('#3c8432', MAT.LEAF), rgb('#2a6226', MAT.LEAF)],
  birch: rgb('#e4e0d4', MAT.BARK),
  birchDark: rgb('#2b2a28', MAT.BARK),
  birchLeaf: [rgb('#86b23e', MAT.LEAF), rgb('#97bf4a', MAT.LEAF), rgb('#76a536', MAT.LEAF)],
  fern: rgb('#3d8030', MAT.LEAF),
  reed: rgb('#557f33', MAT.LEAF),
  cattail: rgb('#5a3a20'),
  lily: rgb('#3f8a3a', MAT.LEAF),
  berry: rgb('#c8282c'),
  rock: rgb('#8a8d93', MAT.ROCK),
  woodCut: rgb('#b08a5a'),
  mushroomCap: rgb('#c0302a'),
  mushroomStem: rgb('#ece4d0'),
  grassBase: rgb('#2f6222', MAT.LEAF),
  grassTip: rgb('#7fb346', MAT.LEAF),
  petal: rgb('#f4f0e8'),
  flowerCenter: rgb('#f2b630'),
  steel: rgb('#dfe5ec', 1),
  steelEdge: rgb('#a3adb8', 1),
  steelDark: rgb('#5c636d', 0.5),
  gold: rgb('#d9a93a', 0.7),
  leather: rgb('#4a2c1a'),
  leatherDark: rgb('#2a180d'),
  gauntlet: rgb('#3b434e', 0.75),      // 용사 갑옷과 같은 짙은 건메탈
  cloth: rgb('#1d2330', MAT.CLOTH),
  runeGlow: rgb('#3fd8ff', MAT.GLOW),
  balmung: rgb('#eaf1f9', 1),          // 발뭉 칼날 (푸른 기가 도는 은빛)
  balmungEdge: rgb('#a8bad0', 1),
  balmungFuller: rgb('#5d7290', 0.8),
  rune: rgb('#58c8ff', MAT.GLOW),
  gem: rgb('#2f8cff', MAT.GLOW),
  blueLeather: rgb('#1f3358'),
  snow: rgb('#f2f5fa'),
  cliff: rgb('#7d838e'),
  farForest: rgb('#2c5a3c'),
};

// 색을 조금씩 다르게 (재질 번호는 그대로)
function vary(c, amount, rnd) {
  const k = 1 + (rnd() - 0.5) * amount;
  return [c[0] * k, c[1] * k, c[2] * k, c[3]];
}

const NO_UV = [0, 0];

// 삼각형을 모아 모델을 만드는 도구
class MeshBuilder {
  constructor() {
    this.pos = [];   // 정점 위치
    this.nrm = [];   // 법선: 면이 향하는 방향 (빛 계산용)
    this.col = [];   // 색 (r, g, b, 재질)
    this.wind = [];  // 바람에 흔들리는 정도 (m)
    this.uv = [];    // 무늬 그림 좌표 (잎 판만 사용)
  }

  vert(p, n, color, wind = 0, uv = NO_UV) {
    this.pos.push(p[0], p[1], p[2]);
    this.nrm.push(n[0], n[1], n[2]);
    this.col.push(color[0], color[1], color[2], color[3] || 0);
    this.wind.push(wind);
    this.uv.push(uv[0], uv[1]);
  }

  // 각진 삼각형 (면 하나에 법선 하나). center를 주면 면이 center 바깥쪽을 향하게 맞춤
  tri(a, b, c, color, center) {
    let n = V3.normalize(V3.cross(V3.sub(b, a), V3.sub(c, a)));
    if (center && V3.dot(n, V3.sub(V3.scale(V3.add(V3.add(a, b), c), 1 / 3), center)) < 0) {
      [b, c] = [c, b];
      n = V3.scale(n, -1);
    }
    this.vert(a, n, color);
    this.vert(b, n, color);
    this.vert(c, n, color);
  }

  // 매끈한 삼각형 (정점마다 법선). colors를 주면 정점마다 색도 따로
  triN(a, b, c, na, nb, nc, color, center, colors) {
    let [ca, cb, cc] = colors || [color, color, color];
    const n = V3.cross(V3.sub(b, a), V3.sub(c, a));
    if (center && V3.dot(n, V3.sub(V3.scale(V3.add(V3.add(a, b), c), 1 / 3), center)) < 0) {
      [b, c] = [c, b];
      [nb, nc] = [nc, nb];
      [cb, cc] = [cc, cb];
    }
    this.vert(a, na, ca);
    this.vert(b, nb, cb);
    this.vert(c, nc, cc);
  }

  // 위를 향하는 각진 삼각형 (먼 산처럼 높이로 만든 면)
  triUp(a, b, c, color) {
    let n = V3.normalize(V3.cross(V3.sub(b, a), V3.sub(c, a)));
    if (n[1] < 0) {
      [b, c] = [c, b];
      n = V3.scale(n, -1);
    }
    this.vert(a, n, color);
    this.vert(b, n, color);
    this.vert(c, n, color);
  }

  // from번째 정점부터 끝까지 법선을 dir 쪽으로 amount만큼 기울임
  // (얼굴은 법선을 앞쪽으로 모아 두면 빛이 고르게 들어 애니메이션처럼 깔끔해짐)
  bendNormals(from, dir, amount) {
    const d = V3.normalize(dir);
    for (let i = from * 3; i < this.nrm.length; i += 3) {
      const n = V3.normalize([
        Utils.lerp(this.nrm[i], d[0], amount), Utils.lerp(this.nrm[i + 1], d[1], amount), Utils.lerp(this.nrm[i + 2], d[2], amount)]);
      this.nrm[i] = n[0];
      this.nrm[i + 1] = n[1];
      this.nrm[i + 2] = n[2];
    }
  }

  // 정점마다 바람 흔들림을 (x, y, z) 위치로 정함
  setWind(fn) {
    for (let i = 0; i < this.wind.length; i++) {
      this.wind[i] = fn(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
    }
  }
}

// 정이십면체를 잘게 나눈 공 모양 (detail 0 = 20면, 1 = 80면, 2 = 320면)
function icoGeometry(detail) {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(V3.normalize);
  let faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6],
    [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let d = 0; d < detail; d++) {
    const cache = {};
    const mid = (a, b) => {
      const key = a < b ? a + '_' + b : b + '_' + a;
      if (cache[key] === undefined) {
        cache[key] = verts.length;
        verts.push(V3.normalize(V3.scale(V3.add(verts[a], verts[b]), 0.5)));
      }
      return cache[key];
    };
    const next = [];
    for (const [a, b, c] of faces) {
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  return { verts, faces };
}

// 기본 도형 (m: 위치·회전·크기 행렬, colorFn: 면마다 색을 돌려주는 함수)
// opts.smooth: 매끈하게(정점 법선), opts.rnd: 난수, opts.jitter: 울퉁불퉁한 정도
const Shapes = {
  // 원기둥(r1 > 0) 또는 원뿔(r1 = 0). 아래 반지름 r0, 위 반지름 r1, 높이 h, 옆면 n개
  // opts: top(윗면, 기본 true), bottom(아랫면), topColor, bottomColor
  cylinder(b, m, r0, r1, h, n, colorFn, opts = {}) {
    const rnd = opts.rnd || Math.random;
    const jit = opts.jitter || 0;
    const ring = (r, y) => {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = r * (1 + (rnd() - 0.5) * jit);
        pts.push(M4.transformPoint(m, [Math.cos(a) * rr, y, Math.sin(a) * rr]));
      }
      return pts;
    };
    const sideN = (a) => V3.normalize(M4.transformDir(m, [Math.cos(a) * h, r0 - r1, Math.sin(a) * h]));
    const lo = ring(r0, 0);
    const hi = r1 > 0 ? ring(r1, h) : null;
    const tip = M4.transformPoint(m, [0, h, 0]);
    const bottomC = M4.transformPoint(m, [0, 0, 0]);
    const center = M4.transformPoint(m, [0, h * 0.4, 0]);
    // opts.gradient = [아래 배율, 위 배율]: 아래쪽과 위쪽 밝기를 다르게 (예: 솔잎 끝은 밝고 안쪽은 어둡게)
    const [gLo, gHi] = opts.gradient || [1, 1];
    const tint = (c, k) => [c[0] * k, c[1] * k, c[2] * k, c[3]];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const c = colorFn();
      if (opts.smooth) {
        const na = sideN((i / n) * Math.PI * 2), nb = sideN(((i + 1) / n) * Math.PI * 2);
        const cl = tint(c, gLo), ch = tint(c, gHi);
        if (hi) {
          b.triN(lo[i], lo[j], hi[j], na, nb, nb, c, center, [cl, cl, ch]);
          b.triN(lo[i], hi[j], hi[i], na, nb, na, c, center, [cl, ch, ch]);
        } else {
          b.triN(lo[i], lo[j], tip, na, nb, sideN(((i + 0.5) / n) * Math.PI * 2), c, center, [cl, cl, ch]);
        }
      } else if (hi) {
        b.tri(lo[i], lo[j], hi[j], c, center);
        b.tri(lo[i], hi[j], hi[i], c, center);
      } else {
        b.tri(lo[i], lo[j], tip, c, center);
      }
      if (hi && opts.top !== false) b.tri(hi[i], hi[j], tip, opts.topColor ? opts.topColor() : colorFn(), center);
      if (opts.bottom) b.tri(lo[i], lo[j], bottomC, opts.bottomColor ? opts.bottomColor() : c, center);
    }
  },

  // 공. opts.normalCenter를 주면 법선을 그 점에서 바깥으로 → 여러 덩어리가 한 덩어리처럼 부드럽게 보임
  icosphere(b, m, detail, colorFn, opts = {}) {
    const rnd = opts.rnd || Math.random;
    const jit = opts.jitter || 0;
    const { verts, faces } = icoGeometry(detail);
    const pts = verts.map((v) => M4.transformPoint(m, V3.scale(v, 1 + (rnd() - 0.5) * jit)));
    const center = M4.transformPoint(m, [0, 0, 0]);
    const nc = opts.normalCenter || center;
    const nrm = pts.map((p) => V3.normalize(V3.sub(p, nc)));
    for (const [i, j, k] of faces) {
      if (opts.smooth) b.triN(pts[i], pts[j], pts[k], nrm[i], nrm[j], nrm[k], colorFn(), center);
      else b.tri(pts[i], pts[j], pts[k], colorFn(), center);
    }
  },

  // p0에서 p1까지 잇는 막대 (뼈·활 같은 가는 부분). 굵기 r0 → r1
  segment(b, p0, p1, r0, r1, n, colorFn, opts = {}) {
    const d = V3.sub(p1, p0), len = Math.hypot(d[0], d[1], d[2]);
    const y = V3.scale(d, 1 / len);
    const x = V3.normalize(V3.cross(Math.abs(y[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], y));
    const z = V3.cross(x, y);
    const m = new Float32Array([x[0], x[1], x[2], 0, y[0] * len, y[1] * len, y[2] * len, 0, z[0], z[1], z[2], 0, p0[0], p0[1], p0[2], 1]);
    Shapes.cylinder(b, m, r0, r1, 1, n, colorFn, opts);
  },

  // 상자 (크기 1, 가운데가 원점 → m으로 크기 조절)
  box(b, m, colorFn) {
    const p = [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
      [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]].map((v) => M4.transformPoint(m, v));
    const center = M4.transformPoint(m, [0, 0, 0]);
    const quads = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]];
    for (const [a, c1, d, e] of quads) {
      const col = colorFn();
      b.tri(p[a], p[c1], p[d], col, center);
      b.tri(p[a], p[d], p[e], col, center);
    }
  },
};

// ---------- 잎 무늬 그림 (텍스처) ----------
// 512x256: 왼쪽 절반 = 넓은 잎 덩어리, 오른쪽 절반 = 솔잎 덩어리. 흰빛 계열로 그리고 색은 모델에서 입힘
function drawLeafShape(g, x, y, len, wid, rot) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.quadraticCurveTo(0, -wid, len / 2, 0);
  g.quadraticCurveTo(0, wid, -len / 2, 0);
  g.fill();
  g.restore();
}

function buildLeafTexture() {
  const W = 512, H = 256;
  const color = Utils.makeCanvas(W, H), mask = Utils.makeCanvas(W, H);
  const cg = color.getContext('2d'), mg = mask.getContext('2d');
  cg.fillStyle = '#b4c09e';   // 잎 사이 빈 곳 색 (멀리서 흐려질 때 테두리가 검게 번지지 않게)
  cg.fillRect(0, 0, W, H);
  mg.fillStyle = '#000';
  mg.fillRect(0, 0, W, H);
  mg.fillStyle = '#fff';
  const rnd = Utils.rng(31);

  // 넓은 잎: 가운데는 빽빽, 가장자리는 듬성듬성
  for (let i = 0; i < 150; i++) {
    const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.65) * 104;
    const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r;
    const len = 22 + rnd() * 16, wid = len * 0.42, rot = a + (rnd() - 0.5) * 1.6;
    const v = Utils.clamp(160 + rnd() * 95 - r * 0.35, 120, 255);
    cg.fillStyle = `rgb(${(v * 0.92) | 0},${v | 0},${(v * 0.8) | 0})`;
    drawLeafShape(cg, x, y, len, wid, rot);
    drawLeafShape(mg, x, y, len, wid, rot);
    cg.strokeStyle = 'rgba(40, 60, 20, 0.35)';   // 잎맥
    cg.lineWidth = 1.2;
    cg.beginPath();
    cg.moveTo(x - (Math.cos(rot) * len) / 2.4, y - (Math.sin(rot) * len) / 2.4);
    cg.lineTo(x + (Math.cos(rot) * len) / 2.4, y + (Math.sin(rot) * len) / 2.4);
    cg.stroke();
  }

  // 솔잎: 가지에서 바깥으로 뻗은 가는 잎 다발
  cg.lineCap = mg.lineCap = 'round';
  for (let i = 0; i < 55; i++) {
    const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.7) * 80;
    const bx = 384 + Math.cos(a) * r, by = 128 + Math.sin(a) * r;
    const v = Utils.clamp(150 + rnd() * 100 - r * 0.3, 110, 250);
    for (let k = 0; k < 9; k++) {
      const d = a + (rnd() - 0.5) * 1.4, len = 14 + rnd() * 16;
      const ex = bx + Math.cos(d) * len, ey = by + Math.sin(d) * len;
      cg.strokeStyle = `rgb(${(v * 0.85) | 0},${v | 0},${(v * 0.8) | 0})`;
      mg.strokeStyle = '#fff';
      cg.lineWidth = mg.lineWidth = 3;
      for (const g of [cg, mg]) {
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(ex, ey);
        g.stroke();
      }
    }
  }

  const cd = cg.getImageData(0, 0, W, H).data, md = mg.getImageData(0, 0, W, H).data;
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    data[i * 4] = cd[i * 4];
    data[i * 4 + 1] = cd[i * 4 + 1];
    data[i * 4 + 2] = cd[i * 4 + 2];
    data[i * 4 + 3] = md[i * 4];
  }
  return { width: W, height: H, data };
}

// 잎 판 하나: 위치 p, 크기 size, 법선은 nc(잎 전체의 중심)에서 바깥으로 → 덩어리 전체가 부드럽게 빛을 받음
function leafCard(b, rnd, p, size, color, nc, needle) {
  const ax = V3.normalize([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]);
  const ay = V3.normalize(V3.cross(ax, V3.normalize([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5])));
  const k = size * (0.75 + rnd() * 0.5);
  const corner = (x, y) => V3.add(p, V3.add(V3.scale(ax, x * k), V3.scale(ay, y * k)));
  const q = [corner(-0.5, -0.5), corner(0.5, -0.5), corner(0.5, 0.5), corner(-0.5, 0.5)];
  const u0 = needle ? 0.5 : 0;
  const uv = [[u0, 1], [u0 + 0.5, 1], [u0 + 0.5, 0], [u0, 0]];
  const n = q.map((pt) => V3.normalize(V3.sub(pt, nc)));
  const col = [color[0], color[1], color[2], MAT.CARD];
  for (const [i0, i1, i2] of [[0, 1, 2], [0, 2, 3], [0, 2, 1], [0, 3, 2]]) {   // 앞면 + 뒷면
    b.vert(q[i0], n[i0], col, 0, uv[i0]);
    b.vert(q[i1], n[i1], col, 0, uv[i1]);
    b.vert(q[i2], n[i2], col, 0, uv[i2]);
  }
}

// 잎 덩어리(중심 c, 가로 반지름 rx, 세로 반지름 ry) 겉면 근처에 잎 판 count장
function leafCards(b, rnd, c, rx, ry, count, colors, size, nc, needle) {
  for (let i = 0; i < count; i++) {
    const z = rnd() * 2 - 1, th = rnd() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    const d = 0.75 + rnd() * 0.35;
    const p = [c[0] + s * Math.cos(th) * rx * d, c[1] + z * ry * d, c[2] + s * Math.sin(th) * rx * d];
    leafCard(b, rnd, p, size, vary(colors[(rnd() * colors.length) | 0], 0.2, rnd), nc, needle);
  }
}

// ---------- 나무 ----------

// 소나무 한 층: 가장자리가 아래로 축 처진 원뿔 + 오목한 아랫면 (갓 모양이 아니라 가지가 늘어진 모양)
function pineTier(b, rnd, y, r, h, green) {
  const n = 14, rim = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.2;
    const rr = r * (0.85 + rnd() * 0.3);
    rim.push({ a, p: [Math.cos(a) * rr, y - h * (0.1 + rnd() * 0.18), Math.sin(a) * rr] });
  }
  const tip = [0, y + h, 0], inner = [0, y + h * 0.12, 0], center = [0, y + h * 0.35, 0];
  const side = (a) => V3.normalize([Math.cos(a) * h, r * 0.8, Math.sin(a) * h]);
  const base = vary(green, 0.08, rnd);
  const cRim = [base[0] * 1.25, base[1] * 1.25, base[2] * 1.25, base[3]];
  const cTip = [base[0] * 0.6, base[1] * 0.6, base[2] * 0.6, base[3]];
  const under = vary(COLORS.pineUnder, 0.15, rnd), down = [0, -1, 0];
  for (let i = 0; i < n; i++) {
    const A = rim[i], B = rim[(i + 1) % n];
    const nA = side(A.a), nB = side(B.a), nT = V3.normalize(V3.add(V3.add(nA, nB), [0, 1.5, 0]));
    b.triN(A.p, B.p, tip, nA, nB, nT, cRim, center, [cRim, cRim, cTip]);
    b.triN(A.p, inner, B.p, down, down, down, under, center);
  }
  return rim;
}

// 소나무: 늘어진 가지 층 4단 + 가장자리 솔잎 판 (높이 약 7m, tall이면 더 큼)
function buildPine(rnd, tall) {
  const b = new MeshBuilder();
  const H = tall ? 1.3 : 1;
  Shapes.cylinder(b, M4.scaling(1, H, 1), 0.24, 0.1, 3.2, 7, () => vary(COLORS.bark, 0.2, rnd), { rnd, top: false, smooth: true });
  let y = 1.2 * H, r = 2.1, h = 2.8 * H;
  for (let i = 0; i < 4; i++) {
    const green = COLORS.pine[i];
    const rim = pineTier(b, rnd, y, r, h, green);
    const nc = [0, y - h * 0.4, 0];
    // 솔잎 판: 처진 가장자리를 따라 빽빽하게 + 겉면 군데군데 (윤곽이 보송보송하게)
    for (let k = 0; k < 24; k++) {
      const q = rim[k % rim.length].p, t = k % 2 === 0 ? 0.2 + rnd() * 0.5 : 0;
      const p = [q[0] * (1 - t), q[1] + h * t * 1.1 + 0.05, q[2] * (1 - t)];
      leafCard(b, rnd, p, 1.0 + (1 - t) * 0.35, vary(green, 0.15, rnd), nc, true);
    }
    y += h * 0.5;
    r *= 0.74;
    h *= 0.86;
  }
  b.setWind((x, yy) => Math.max(0, yy - 2) * 0.012);
  return b;
}

// 활엽수: 굵은 줄기 + 가지 + 둥근 잎 덩어리 + 잎 판
function buildOak(rnd) {
  const b = new MeshBuilder();
  const bark = () => vary(COLORS.bark, 0.2, rnd);
  Shapes.cylinder(b, M4.identity(), 0.34, 0.2, 3.4, 9, bark, { rnd, jitter: 0.12, top: false, smooth: true });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * 6.28 + rnd();
    Shapes.cylinder(b, M4.chain(M4.translation(0, 2.3 + rnd() * 0.6, 0), M4.rotationY(a), M4.rotationZ(-0.85)),
      0.13, 0.05, 1.6, 6, bark, { rnd, top: false, smooth: true });
  }
  const nc = [0, 4.3, 0];   // 잎 전체의 중심
  const blobs = [[0, 4.7, 0, 2.0], [1.3, 4.0, 0.4, 1.45], [-1.2, 4.1, -0.5, 1.55], [0.2, 4.2, 1.3, 1.35], [-0.3, 4.3, -1.3, 1.3], [0.1, 5.7, 0.1, 1.3]];
  for (const [x, y, z, r] of blobs) {
    const green = COLORS.leaf[(rnd() * 4) | 0];
    const cx = x + (rnd() - 0.5) * 0.4, cz = z + (rnd() - 0.5) * 0.4;
    Shapes.icosphere(b, M4.chain(M4.translation(cx, y, cz), M4.scaling(r * 0.88, r * 0.75, r * 0.88)), 1,
      () => vary(green, 0.1, rnd), { rnd, jitter: 0.16, smooth: true, normalCenter: nc });
    leafCards(b, rnd, [cx, y, cz], r, r * 0.85, 17, COLORS.leaf, 1.15, nc, false);
  }
  b.setWind((x, y) => Math.max(0, y - 2.5) * 0.018);
  return b;
}

// 자작나무: 흰 줄기에 검은 무늬, 연둣빛 잎
function buildBirch(rnd) {
  const b = new MeshBuilder();
  const segs = 6, H = 4.4;
  for (let i = 0; i < segs; i++) {
    const r0 = 0.16 - i * 0.014, r1 = 0.16 - (i + 1) * 0.014;
    Shapes.cylinder(b, M4.translation((rnd() - 0.5) * 0.04, (i / segs) * H, 0), r0, r1, H / segs, 7,
      () => (rnd() < 0.22 ? vary(COLORS.birchDark, 0.3, rnd) : vary(COLORS.birch, 0.1, rnd)), { rnd, top: false, smooth: true });
  }
  const nc = [0, 4.5, 0];
  const blobs = [[0, 4.8, 0, 1.3], [0.7, 4.2, 0.3, 1.0], [-0.6, 4.4, -0.4, 1.05], [0.1, 5.5, -0.1, 0.95], [-0.2, 3.9, 0.7, 0.9]];
  for (const [x, y, z, r] of blobs) {
    const green = COLORS.birchLeaf[(rnd() * 3) | 0];
    Shapes.icosphere(b, M4.chain(M4.translation(x, y, z), M4.scaling(r * 0.85, r * 0.8, r * 0.85)), 1,
      () => vary(green, 0.1, rnd), { rnd, jitter: 0.2, smooth: true, normalCenter: nc });
    leafCards(b, rnd, [x, y, z], r, r * 0.9, 14, COLORS.birchLeaf, 0.9, nc, false);
  }
  b.setWind((x, y) => Math.max(0, y - 2.5) * 0.022);
  return b;
}

// 덤불: 잎 덩어리 + 잎 판 + 빨간 열매
function buildBush(rnd) {
  const b = new MeshBuilder();
  const nc = [0, 0.1, 0];
  const blobs = [[0, 0.45, 0, 0.6], [0.45, 0.35, 0.15, 0.45], [-0.4, 0.35, -0.1, 0.48], [0.05, 0.35, 0.45, 0.42], [-0.1, 0.4, -0.45, 0.42]];
  for (const [x, y, z, r] of blobs) {
    Shapes.icosphere(b, M4.chain(M4.translation(x, y, z), M4.scaling(r, r * 0.85, r)), 1,
      () => vary(COLORS.bushLeaf[(rnd() * 3) | 0], 0.12, rnd), { rnd, jitter: 0.3, smooth: true, normalCenter: nc });
    leafCards(b, rnd, [x, y, z], r, r * 0.85, 5, COLORS.bushLeaf, 0.55, nc, false);
  }
  for (let i = 0; i < 7; i++) {
    const a = rnd() * 6.28, h = 0.3 + rnd() * 0.4;
    Shapes.icosphere(b, M4.chain(M4.translation(Math.cos(a) * 0.62, h, Math.sin(a) * 0.62), M4.scaling(0.06, 0.06, 0.06)),
      0, () => COLORS.berry, { smooth: true });
  }
  b.setWind((x, y) => y * 0.03);
  return b;
}

// 바위 (질감과 이끼는 셰이더가 그림)
function buildRock(rnd) {
  const b = new MeshBuilder();
  Shapes.icosphere(b, M4.chain(M4.translation(0, 0.3, 0), M4.scaling(1.1, 0.72, 0.95)), 1,
    () => vary(COLORS.rock, 0.12, rnd), { rnd, jitter: 0.5 });
  return b;
}

// ---------- 풀·꽃·물가 식물 ----------

// 풀잎 하나 (뿌리는 어둡고 끝은 밝게, 끝으로 갈수록 바람에 흔들림)
function grassBlade(b, rnd, bx, bz, h, w, baseC, tipC, windScale) {
  const up = [0, 1, 0];   // 풀은 모두 위를 향한 것처럼 빛을 받게 (부드러워 보임)
  const lean = rnd() * Math.PI * 2, bend = 0.06 + rnd() * 0.16;
  const lx = Math.cos(lean), lz = Math.sin(lean);
  const sx = -lz * w, sz = lx * w;
  const midC = Utils.mixColor(baseC, tipC, 0.5);
  const mh = h * 0.55, mb = bend * 0.35;
  const p0 = [bx - sx, 0, bz - sz], p1 = [bx + sx, 0, bz + sz];
  const m0 = [bx - sx * 0.7 + lx * mb, mh, bz - sz * 0.7 + lz * mb];
  const m1 = [bx + sx * 0.7 + lx * mb, mh, bz + sz * 0.7 + lz * mb];
  const tip = [bx + lx * bend, h, bz + lz * bend];
  const wm = mh * 0.12 * windScale, wt = h * 0.22 * windScale;
  b.vert(p0, up, baseC, 0); b.vert(p1, up, baseC, 0); b.vert(m1, up, midC, wm);
  b.vert(p0, up, baseC, 0); b.vert(m1, up, midC, wm); b.vert(m0, up, midC, wm);
  b.vert(m0, up, midC, wm); b.vert(m1, up, midC, wm); b.vert(tip, up, tipC, wt);
}

function buildGrassTuft(rnd) {
  const b = new MeshBuilder();
  for (let i = 0; i < 8; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 0.13;
    grassBlade(b, rnd, Math.cos(a) * r, Math.sin(a) * r, 0.25 + rnd() * 0.38, 0.03 + rnd() * 0.02,
      vary(COLORS.grassBase, 0.2, rnd), vary(COLORS.grassTip, 0.25, rnd), 1);
  }
  return b;
}

// 들꽃: 줄기 + 꽃잎 5장 (꽃 색은 배치할 때 정함)
function buildFlower() {
  const b = new MeshBuilder();
  const up = [0, 1, 0], h = 0.3, stem = COLORS.grassBase;
  b.vert([-0.012, 0, 0], up, stem); b.vert([0.012, 0, 0], up, stem); b.vert([0, h, 0], up, stem, 0.05);
  b.vert([0, 0, -0.012], up, stem); b.vert([0, 0, 0.012], up, stem); b.vert([0, h, 0], up, stem, 0.05);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p1 = [Math.cos(a - 0.4) * 0.075, h + 0.025, Math.sin(a - 0.4) * 0.075];
    const p2 = [Math.cos(a + 0.4) * 0.075, h + 0.025, Math.sin(a + 0.4) * 0.075];
    b.vert([0, h, 0], up, COLORS.petal, 0.05); b.vert(p1, up, COLORS.petal, 0.05); b.vert(p2, up, COLORS.petal, 0.05);
  }
  const cc = COLORS.flowerCenter;
  b.vert([-0.02, h + 0.03, -0.015], up, cc, 0.05); b.vert([0.02, h + 0.03, -0.015], up, cc, 0.05); b.vert([0, h + 0.03, 0.022], up, cc, 0.05);
  return b;
}

// 고사리: 바깥으로 휘어 늘어지는 잎 7장
function buildFern(rnd) {
  const b = new MeshBuilder();
  const up = [0, 1, 0];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rnd() * 0.4;
    const len = 0.55 + rnd() * 0.25, rise = 0.35 + rnd() * 0.15;
    const dx = Math.cos(a), dz = Math.sin(a), sx = -dz, sz = dx;
    const green = vary(COLORS.fern, 0.25, rnd);
    const light = Utils.mixColor(green, COLORS.grassTip, 0.45);
    let pl = [0, 0.02, 0], pr = [0, 0.02, 0];
    for (let k = 1; k <= 4; k++) {
      const t = k / 4;
      const d = len * t, h = rise * Math.sin(t * Math.PI * 0.8);
      const w = 0.09 * Math.sin(t * Math.PI) + 0.01;
      const L = [dx * d + sx * w, h, dz * d + sz * w], R = [dx * d - sx * w, h, dz * d - sz * w];
      const col = Utils.mixColor(green, light, t), w0 = (t - 0.25) * 0.06, w1 = t * 0.06;
      b.vert(pl, up, col, w0); b.vert(pr, up, col, w0); b.vert(R, up, col, w1);
      b.vert(pl, up, col, w0); b.vert(R, up, col, w1); b.vert(L, up, col, w1);
      pl = L;
      pr = R;
    }
  }
  return b;
}

// 갈대·부들: 키 큰 잎 + 갈색 이삭
function buildReeds(rnd) {
  const b = new MeshBuilder();
  for (let i = 0; i < 10; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 0.2;
    grassBlade(b, rnd, Math.cos(a) * r, Math.sin(a) * r, 0.8 + rnd() * 0.6, 0.025 + rnd() * 0.015,
      vary(COLORS.grassBase, 0.2, rnd), vary(COLORS.reed, 0.2, rnd), 0.6);
  }
  for (let i = 0; i < 3; i++) {
    const x = (rnd() - 0.5) * 0.25, z = (rnd() - 0.5) * 0.25, h = 1.0 + rnd() * 0.35;
    Shapes.cylinder(b, M4.translation(x, 0, z), 0.008, 0.006, h, 4, () => COLORS.reed);
    Shapes.cylinder(b, M4.translation(x, h, z), 0.024, 0.02, 0.14, 7, () => vary(COLORS.cattail, 0.15, rnd), { smooth: true });
  }
  return b;
}

// 연잎: 한쪽이 갈라진 둥근 잎
function buildLily(rnd) {
  const b = new MeshBuilder();
  const up = [0, 1, 0], n = 14, r = 0.32;
  for (let i = 1; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    const c = vary(COLORS.lily, 0.12, rnd);
    b.vert([0, 0.01, 0], up, c);
    b.vert([Math.cos(a1) * r, 0, Math.sin(a1) * r], up, c);
    b.vert([Math.cos(a0) * r, 0, Math.sin(a0) * r], up, c);
  }
  return b;
}

// 빨간 독버섯 무리
function buildMushrooms(rnd) {
  const b = new MeshBuilder();
  for (const [x, z, s] of [[0, 0, 1], [0.13, 0.06, 0.7], [-0.09, 0.11, 0.55]]) {
    const at = (px, py, pz) => M4.chain(M4.translation(x + px * s, py * s, z + pz * s), M4.scaling(s, s, s));
    Shapes.cylinder(b, at(0, 0, 0), 0.025, 0.02, 0.12, 7, () => COLORS.mushroomStem, { smooth: true });
    Shapes.cylinder(b, at(0, 0.11, 0), 0.085, 0, 0.065, 10, () => vary(COLORS.mushroomCap, 0.1, rnd),
      { bottom: true, smooth: true, bottomColor: () => COLORS.mushroomStem });
    for (let i = 0; i < 3; i++) {
      const a = rnd() * 6.28;
      Shapes.box(b, M4.chain(at(Math.cos(a) * 0.045, 0.145, Math.sin(a) * 0.045), M4.scaling(0.018, 0.012, 0.018)), () => COLORS.mushroomStem);
    }
  }
  return b;
}

// 쓰러진 통나무
function buildLog(rnd) {
  const b = new MeshBuilder();
  Shapes.cylinder(b, M4.chain(M4.translation(-1.4, 0.25, 0), M4.rotationZ(-Math.PI / 2)), 0.27, 0.24, 2.8, 10,
    () => vary(COLORS.bark, 0.2, rnd),
    { rnd, jitter: 0.08, smooth: true, bottom: true, bottomColor: () => COLORS.woodCut, topColor: () => COLORS.woodCut });
  return b;
}

// 흙길 자갈: 작은 납작한 돌 몇 개
function buildPebbles(rnd) {
  const b = new MeshBuilder();
  for (let i = 0; i < 6; i++) {
    const a = rnd() * 6.28, d = rnd() * 0.35, s = 0.04 + rnd() * 0.06;
    Shapes.icosphere(b, M4.chain(M4.translation(Math.cos(a) * d, s * 0.25, Math.sin(a) * d), M4.scaling(s * 1.3, s * 0.6, s)), 0,
      () => vary(COLORS.rock, 0.3, rnd), { rnd, jitter: 0.3 });
  }
  return b;
}

// 바닥에 떨어진 잎: 잎 무늬 판을 땅에 눕혀 놓음 (갈색·노란빛)
function buildLitter(rnd) {
  const b = new MeshBuilder();
  const up = [0, 1, 0];
  const tones = [rgb('#8a6a2a'), rgb('#a8862e'), rgb('#6f5a2a'), rgb('#7d8a32')];
  for (let i = 0; i < 4; i++) {
    const a = rnd() * 6.28, d = rnd() * 0.3, k = 0.35 + rnd() * 0.2, r = rnd() * 6.28;
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d, y = 0.012 + i * 0.004;
    const corner = (x, z) => [cx + (Math.cos(r) * x - Math.sin(r) * z) * k, y, cz + (Math.sin(r) * x + Math.cos(r) * z) * k];
    const q = [corner(-0.5, -0.5), corner(0.5, -0.5), corner(0.5, 0.5), corner(-0.5, 0.5)];
    const uv = [[0, 1], [0.5, 1], [0.5, 0], [0, 0]];
    const c = vary(tones[(rnd() * 4) | 0], 0.2, rnd);
    c[3] = MAT.CARD;
    for (const idx of [0, 1, 2, 0, 2, 3]) b.vert(q[idx], up, c, 0, uv[idx]);
  }
  return b;
}

// 무너진 돌기둥: 비뚤게 쌓인 돌덩이 + 옆에 굴러떨어진 돌 (이끼는 셰이더가 그림)
function buildRuin(rnd) {
  const b = new MeshBuilder();
  const stone = () => vary(COLORS.rock, 0.12, rnd);
  let y = 0;
  for (let i = 0; i < 4; i++) {
    const h = 0.55 + rnd() * 0.2, w = 0.75 - i * 0.05;
    Shapes.box(b, M4.chain(M4.translation((rnd() - 0.5) * 0.08, y + h / 2, (rnd() - 0.5) * 0.08), M4.rotationY((rnd() - 0.5) * 0.3),
      M4.rotationZ((rnd() - 0.5) * 0.06), M4.scaling(w, h, w)), stone);
    y += h;
  }
  Shapes.box(b, M4.chain(M4.translation(0.85, 0.22, 0.3), M4.rotationY(0.6), M4.rotationZ(0.25), M4.scaling(0.6, 0.45, 0.55)), stone);
  Shapes.box(b, M4.chain(M4.translation(-0.6, 0.12, -0.55), M4.rotationY(-0.4), M4.scaling(0.4, 0.25, 0.35)), stone);
  return b;
}

// 출구 돌 아치: 기둥 두 개 + 윗돌, 빛나는 룬 (통로는 z 방향)
function buildGate(rnd) {
  const b = new MeshBuilder();
  const stone = () => vary(COLORS.rock, 0.12, rnd);
  const rune = () => COLORS.runeGlow;
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const w = 0.72 - i * 0.04;
      Shapes.box(b, M4.chain(M4.translation(sx * 1.45 + (rnd() - 0.5) * 0.05, 0.4 + i * 0.8, (rnd() - 0.5) * 0.05),
        M4.rotationY((rnd() - 0.5) * 0.12), M4.scaling(w, 0.78, w)), stone);
    }
    for (let i = 0; i < 3; i++) {
      for (const fz of [-1, 1]) {
        Shapes.box(b, M4.chain(M4.translation(sx * 1.45, 0.75 + i * 0.8, fz * 0.37), M4.rotationZ(0.785), M4.scaling(0.16, 0.16, 0.03)), rune);
      }
    }
  }
  Shapes.box(b, M4.chain(M4.translation(0, 3.45, 0), M4.scaling(3.95, 0.55, 0.82)), stone);
  Shapes.box(b, M4.chain(M4.translation(0, 3.88, 0), M4.scaling(3.2, 0.32, 0.62)), stone);
  for (const fz of [-1, 1]) Shapes.box(b, M4.chain(M4.translation(0, 3.45, fz * 0.42), M4.scaling(0.5, 0.26, 0.03)), rune);
  return b;
}

// 고리 모양 지형(먼 산·언덕) 만들기 도우미: 반지름 목록 x 각도 N개 격자, 높이 함수 heightAt(x, z, j), 색 함수 colorAt(p, n)
// 정점마다 법선을 이웃 점으로 구해 매끈하게
function ringTerrain(cx, cz, radii, N, heightAt, colorAt) {
  const b = new MeshBuilder();
  const P = radii.map((R, j) => {
    const row = [];
    for (let i = 0; i <= N; i++) {
      const a = ((i % N) / N) * Math.PI * 2, x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
      row.push([x, heightAt(x, z, j), z]);
    }
    return row;
  });
  const last = radii.length - 1;
  const NRM = P.map((row, j) => row.map((p, i) => {
    const l = P[j][(i - 1 + N) % N], r = P[j][(i + 1) % N];
    const d = P[Math.max(0, j - 1)][i], u = P[Math.min(last, j + 1)][i];
    const n = V3.normalize(V3.cross(V3.sub(u, d), V3.sub(r, l)));
    return n[1] < 0 ? V3.scale(n, -1) : n;
  }));
  const C = P.map((row, j) => row.map((p, i) => colorAt(p, NRM[j][i])));
  const emit = (A, B, D) => {   // 위를 향하도록 순서를 맞춰 넣음
    const [pa, pb, pd] = [A, B, D].map(([j, i]) => P[j][i]);
    let order = [A, B, D];
    if (V3.cross(V3.sub(pb, pa), V3.sub(pd, pa))[1] < 0) order = [A, D, B];
    for (const [j, i] of order) b.vert(P[j][i], NRM[j][i], C[j][i]);
  };
  for (let j = 0; j < last; j++) {
    for (let i = 0; i < N; i++) {
      emit([j, i], [j, i + 1], [j + 1, i + 1]);
      emit([j, i], [j + 1, i + 1], [j + 1, i]);
    }
  }
  return b;
}

// 먼 산맥: 맵 중심(cx, cz)을 크게 둘러싼 고리. 부드러운 능선, 아래는 푸른 숲 → 바위 → 눈
function buildMountains(cx, cz) {
  const radii = [180, 210, 245, 285, 330, 380, 440, 500];
  const env = [0, 0.3, 0.65, 0.9, 1, 0.9, 0.7, 0.45];
  const height = (x, z, j) => {
    const a = Math.atan2(z - cz, x - cx), R = radii[j], u = Math.cos(a), v = Math.sin(a);
    const n = Utils.fbm2(u * 2.2 + R * 0.003 + 10, v * 2.2 + R * 0.003 - 4, 5);
    return -6 + (Math.pow(1 - Math.abs(n * 2 - 1), 1.6) * 230 + n * 50) * env[j];
  };
  const color = (p, n) => {
    const snowLine = 120 + (Utils.noise2(p[0] * 0.02, p[2] * 0.02) - 0.5) * 50;
    const steep = 1 - n[1];
    const c = Utils.mixColor(COLORS.farForest, COLORS.cliff, Utils.smooth((p[1] - 25) / 40 + steep * 1.2));
    return Utils.mixColor(c, COLORS.snow, Utils.smooth((p[1] - snowLine) / 25) * (1 - Utils.smooth((steep - 0.5) * 3)));
  };
  return ringTerrain(cx, cz, radii, 220, height, color);
}

// 숲과 산 사이의 완만한 언덕 높이 (맵 중심에서 60m부터 솟아오름, 그 안쪽은 땅 밑에 숨음)
function hillHeight(x, z, cx, cz) {
  const d = Math.hypot(x - cx, z - cz);
  const env = Utils.smooth((d - 60) / 60) * (1 - Utils.smooth((d - 195) / 30));
  return -3 + env * Utils.fbm2(x * 0.012 + 3, z * 0.012 - 7, 4) * 55;
}

function buildHills(cx, cz) {
  const radii = [];
  for (let R = 58; R <= 230; R += 8) radii.push(R);
  const green = rgb('#3f6f34'), top = rgb('#6f9a45');
  return ringTerrain(cx, cz, radii, 160, (x, z) => hillHeight(x, z, cx, cz),
    (p, n) => Utils.mixColor(COLORS.farForest, Utils.mixColor(green, top, Utils.smooth((p[1] - 10) / 25)), Utils.smooth(n[1] * 2 - 1)));
}

// 멀리 보이는 숲의 나무 (안개 속 실루엣이라 단순하게)
function buildFarTree(rnd) {
  const b = new MeshBuilder();
  Shapes.cylinder(b, M4.identity(), 0.3, 0.2, 2.5, 5, () => COLORS.bark, { top: false });
  Shapes.cylinder(b, M4.translation(0, 1.5, 0), 2.2, 0, 4.5, 8, () => vary(COLORS.pine[1], 0.1, rnd), { smooth: true, bottom: true, gradient: [1.15, 0.7] });
  Shapes.cylinder(b, M4.translation(0, 4.2, 0), 1.5, 0, 3.6, 8, () => vary(COLORS.pine[2], 0.1, rnd), { smooth: true, bottom: true, gradient: [1.15, 0.7] });
  return b;
}

// ---------- 검과 팔 (1인칭) ----------

// 전설의 검 '발뭉' + 철 장갑 낀 주먹 (손 = 원점, 칼날은 +y 방향)
// 길고 넓은 은빛 칼날, 가운데 능선을 따라 푸르게 빛나는 룬, 넓은 금 날밑 한가운데 커다란 푸른 보석
const BALMUNG_LENGTH = 1.24;   // 손에서 칼끝까지 (m)
function buildSword() {
  const b = new MeshBuilder();
  const rnd = Utils.rng(8);
  const sm = { smooth: true };
  const T = M4.translation, S = M4.scaling, ch = M4.chain;
  // 칼날: 마름모 단면 (면마다 밝기를 달리해 금속 느낌), 끝으로 갈수록 살짝 좁아짐
  const ht = 0.012, y0 = 0.12, y1 = 1.08, tipY = BALMUNG_LENGTH;
  const ring = (y, hw, t) => [[-hw, y, 0], [0, y, t], [hw, y, 0], [0, y, -t]];
  const r0 = ring(y0, 0.05, ht), r1 = ring(y1, 0.036, ht * 0.85), tip = [0, tipY, 0];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const col = i % 2 ? COLORS.balmung : COLORS.balmungEdge;
    b.tri(r0[i], r0[j], r1[j], col);
    b.tri(r0[i], r1[j], r1[i], col);
    b.tri(r1[i], r1[j], tip, col);
  }
  for (const fz of [-1, 1]) {   // 가운데 홈 + 빛나는 룬
    Shapes.box(b, ch(T(0, 0.6, fz * 0.0112), S(0.012, 0.86, 0.004)), () => COLORS.balmungFuller);
    for (let i = 0; i < 8; i++) {
      Shapes.box(b, ch(T(0, 0.2 + i * 0.105, fz * 0.0135), M4.rotationZ(0.785), S(0.016, 0.016, 0.004)), () => COLORS.rune);
    }
  }
  const gold = () => vary(COLORS.gold, 0.06, rnd);
  Shapes.box(b, ch(T(0, 0.095, 0), S(0.3, 0.035, 0.05)), gold);                                   // 날밑
  for (const sx of [-1, 1]) {
    Shapes.box(b, ch(T(sx * 0.17, 0.112, 0), M4.rotationZ(sx * 0.6), S(0.08, 0.03, 0.045)), gold);   // 칼끝 쪽으로 휜 날밑 끝
    Shapes.icosphere(b, ch(T(sx * 0.2, 0.145, 0), S(0.022, 0.022, 0.022)), 1, gold, sm);
  }
  Shapes.icosphere(b, ch(T(0, 0.1, 0), S(0.055, 0.06, 0.036)), 1, gold, sm);                       // 보석 받침
  for (const fz of [-1, 1]) Shapes.icosphere(b, ch(T(0, 0.1, fz * 0.03), S(0.03, 0.036, 0.012)), 1, () => COLORS.gem);   // 푸른 보석
  Shapes.cylinder(b, T(0, -0.14, 0), 0.018, 0.019, 0.22, 10, () => COLORS.blueLeather, sm);         // 손잡이 (푸른 가죽)
  for (let i = 0; i < 3; i++) Shapes.cylinder(b, T(0, -0.12 + i * 0.08, 0), 0.0205, 0.0205, 0.012, 10, gold, sm);
  Shapes.icosphere(b, ch(T(0, -0.165, 0), S(0.034, 0.034, 0.034)), 1, gold, sm);                    // 손잡이 끝 장식
  Shapes.icosphere(b, ch(T(0, -0.165, 0), S(0.016, 0.016, 0.04)), 1, () => COLORS.gem);
  const gt = () => vary(COLORS.gauntlet, 0.08, rnd);
  Shapes.box(b, M4.chain(M4.translation(0, -0.03, 0.012), M4.scaling(0.07, 0.1, 0.075)), gt);          // 주먹
  Shapes.box(b, M4.chain(M4.translation(0, -0.03, -0.03), M4.scaling(0.075, 0.095, 0.022)), () => COLORS.steelDark); // 손가락 마디
  return b;
}

// 팔: 손목(y=0) → 어깨(y=1). 그릴 때 길이에 맞춰 늘림
function buildArm() {
  const b = new MeshBuilder();
  const rnd = Utils.rng(9);
  const gt = () => vary(COLORS.gauntlet, 0.08, rnd);
  const sm = { rnd, smooth: true };
  Shapes.cylinder(b, M4.identity(), 0.042, 0.055, 0.42, 10, gt, sm);                                   // 팔뚝 갑옷
  Shapes.cylinder(b, M4.translation(0, 0.05, 0), 0.05, 0.05, 0.06, 10, () => COLORS.steelDark, sm);    // 손목 띠
  Shapes.icosphere(b, M4.chain(M4.translation(0, 0.45, 0), M4.scaling(0.07, 0.06, 0.07)), 1, gt, sm);   // 팔꿈치
  Shapes.cylinder(b, M4.translation(0, 0.45, 0), 0.06, 0.075, 0.6, 10, () => vary(COLORS.cloth, 0.1, rnd), sm);   // 소매
  return b;
}

// 게임에서 쓰는 모델 모음 (시작할 때 한 번 만듦)
const Models = {
  build() {
    this.leafTexture = buildLeafTexture();
    this.pineA = buildPine(Utils.rng(11), false);
    this.pineB = buildPine(Utils.rng(12), true);
    this.oakA = buildOak(Utils.rng(13));
    this.oakB = buildOak(Utils.rng(14));
    this.birch = buildBirch(Utils.rng(19));
    this.bush = buildBush(Utils.rng(15));
    this.rock = buildRock(Utils.rng(16));
    this.grass = buildGrassTuft(Utils.rng(17));
    this.flower = buildFlower();
    this.fern = buildFern(Utils.rng(20));
    this.reeds = buildReeds(Utils.rng(24));
    this.lily = buildLily(Utils.rng(25));
    this.mushroom = buildMushrooms(Utils.rng(22));
    this.log = buildLog(Utils.rng(23));
    this.pebbles = buildPebbles(Utils.rng(26));
    this.litter = buildLitter(Utils.rng(27));
    this.ruin = buildRuin(Utils.rng(28));
    this.farTree = buildFarTree(Utils.rng(30));
    this.gate = buildGate(Utils.rng(29));
    this.sword = buildSword();
    this.arm = buildArm();
  },
};
