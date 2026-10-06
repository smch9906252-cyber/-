// 망토: 진짜 천처럼 흔들리는 물리
// 점들을 막대로 이은 그물을 매 프레임 계산합니다 (관성·중력·바람, 몸과 땅은 뚫지 않음). 맨 윗줄은 어깨에 고정.
const CAPE_COLS = 9, CAPE_ROWS = 11;

const Cape = {
  pts: null,     // 점들 { x, y, z, px, py, pz(이전 위치) } — 줄 순서대로
  links: [],     // [점 i, 점 j, 원래 거리]
  mesh: null,
  count: 0,

  // 등 쪽 원래 모양 (척추 관절 기준, 뒤쪽은 +z). 맨 아래 줄은 금색 테두리라 바로 위 줄과 가깝게
  // 아랫단 가운데가 파여 제비꼬리처럼 두 갈래로 갈라짐
  local(r, c) {
    const u = (c / (CAPE_COLS - 1)) * 2 - 1;
    const v = r < CAPE_ROWS - 1 ? (r / (CAPE_ROWS - 2)) * 0.95 : 1;
    const half = 0.25 + v * 0.2;
    const len = 1.14 * (1 - 0.2 * (1 - Math.abs(u)) * v * v);
    const pleat = Math.sin(u * Math.PI * 2.5) * 0.035 * v;   // 세로 주름
    return [u * half, 0.47 - v * len, 0.17 + (1 - u * u) * 0.05 + v * 0.06 + pleat];
  },

  init() {
    const idx = (r, c) => r * CAPE_COLS + c;
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    this.links = [];
    for (let r = 0; r < CAPE_ROWS; r++) {
      for (let c = 0; c < CAPE_COLS; c++) {
        // 가로·세로·대각선 이웃, 한 칸 건너 이웃(구김 방지)
        for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1], [2, 0], [0, 2]]) {
          const r2 = r + dr, c2 = c + dc;
          if (r2 >= CAPE_ROWS || c2 < 0 || c2 >= CAPE_COLS) continue;
          this.links.push([idx(r, c), idx(r2, c2), dist(this.local(r, c), this.local(r2, c2))]);
        }
      }
    }
    // 그래픽 카드 버퍼 (위치·법선·색은 매 프레임 새로 채움)
    const gl = GL.gl;
    this.count = (CAPE_ROWS - 1) * (CAPE_COLS - 1) * 6;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = (loc, size, data, usage) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, usage);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      return b;
    };
    this.posBuf = buf(0, 3, this.count * 12, gl.DYNAMIC_DRAW);
    this.nrmBuf = buf(1, 3, this.count * 12, gl.DYNAMIC_DRAW);
    this.colBuf = buf(2, 4, this.count * 16, gl.DYNAMIC_DRAW);
    buf(3, 1, new Float32Array(this.count), gl.STATIC_DRAW);
    // 천 위의 위치 (가로 0~1, 세로 0~1) → 셰이더가 등판에 금실 문장을 그림. upload()의 점 순서와 같게
    const uv = [];
    const at = (r, c) => uv.push(c / (CAPE_COLS - 1), r / (CAPE_ROWS - 1));
    for (let r = 0; r < CAPE_ROWS - 1; r++) {
      for (let c = 0; c < CAPE_COLS - 1; c++) {
        at(r, c); at(r + 1, c); at(r, c + 1);
        at(r, c + 1); at(r + 1, c); at(r + 1, c + 1);
      }
    }
    buf(6, 2, new Float32Array(uv), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.mesh = { vao, count: this.count, instanced: false, parts: [], buffers: [] };
  },

  // 순간이동했을 때 (구역 시작 등): 다음 프레임에 새로 펼침
  reset() {
    this.pts = null;
  },

  // W: 기사 관절 행렬들 (Character.W)
  update(dt, W, groundY, time) {
    if (!this.mesh) this.init();
    if (!this.pts) {
      this.pts = [];
      for (let r = 0; r < CAPE_ROWS; r++) {
        for (let c = 0; c < CAPE_COLS; c++) {
          const p = M4.transformPoint(W.spine, this.local(r, c));
          this.pts.push({ x: p[0], y: p[1], z: p[2], px: p[0], py: p[1], pz: p[2] });
        }
      }
    }
    // 몸을 공 몇 개로 단순하게 (망토가 몸 안으로 들어가지 않게)
    const body = [
      [M4.transformPoint(W.spine, [0, 0.36, -0.08]), 0.22],
      [M4.transformPoint(W.spine, [0, 0.12, -0.06]), 0.2],
      [M4.transformPoint(W.hips, [0, -0.06, -0.05]), 0.19],
      [M4.transformPoint(W.hips, [0, -0.32, -0.02]), 0.2],   // 뒤로 늘어진 코트 자락
      [M4.transformPoint(W.hipR, [0, -0.25, 0]), 0.11],
      [M4.transformPoint(W.hipL, [0, -0.25, 0]), 0.11],
      [M4.transformPoint(W.kneeR, [0, -0.15, 0]), 0.09],
      [M4.transformPoint(W.kneeL, [0, -0.15, 0]), 0.09],
    ];
    const anchors = [];
    for (let c = 0; c < CAPE_COLS; c++) anchors.push(M4.transformPoint(W.spine, this.local(0, c)));
    const steps = Utils.clamp(Math.round(dt * 120), 1, 4), h = dt / steps;
    const gust = 0.5 + 0.5 * Math.sin(time * 1.3) * Math.sin(time * 0.37);
    const wx = 1.4 * gust, wz = 0.7 * gust;
    const P = this.pts;
    for (let s = 0; s < steps; s++) {
      for (let c = 0; c < CAPE_COLS; c++) {
        const p = P[c], a = anchors[c];
        p.x = p.px = a[0];
        p.y = p.py = a[1];
        p.z = p.pz = a[2];
      }
      for (let i = CAPE_COLS; i < P.length; i++) {   // 관성 + 중력 + 바람
        const p = P[i];
        const vx = (p.x - p.px) * 0.97, vy = (p.y - p.py) * 0.97, vz = (p.z - p.pz) * 0.97;
        p.px = p.x; p.py = p.y; p.pz = p.z;
        p.x += vx + wx * h * h;
        p.y += vy - 9.8 * h * h;
        p.z += vz + wz * h * h;
      }
      for (let it = 0; it < 6; it++) {   // 막대 길이 되돌리기 (여러 번 반복할수록 천이 덜 늘어남)
        for (const [i, j, len] of this.links) {
          if (j < CAPE_COLS) continue;
          const a = P[i], b = P[j];
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
          const diff = (Math.hypot(dx, dy, dz) - len) / (Math.hypot(dx, dy, dz) || 1e-6);
          if (i < CAPE_COLS) {
            b.x -= dx * diff; b.y -= dy * diff; b.z -= dz * diff;
          } else {
            const k = diff * 0.5;
            a.x += dx * k; a.y += dy * k; a.z += dz * k;
            b.x -= dx * k; b.y -= dy * k; b.z -= dz * k;
          }
        }
      }
      for (let i = CAPE_COLS; i < P.length; i++) {   // 몸·땅 밖으로 밀어냄
        const p = P[i];
        for (const [c, r] of body) {
          const dx = p.x - c[0], dy = p.y - c[1], dz = p.z - c[2], d = Math.hypot(dx, dy, dz);
          if (d < r && d > 1e-6) {
            p.x = c[0] + (dx * r) / d;
            p.y = c[1] + (dy * r) / d;
            p.z = c[2] + (dz * r) / d;
          }
        }
        if (p.y < groundY + 0.03) p.y = groundY + 0.03;
      }
    }
    this.upload();
  },

  // 점 그물 → 삼각형 (바깥면이 앞면). 맨 아랫단은 금색 테두리
  upload() {
    const P = this.pts, C = CAPE_COLS, R = CAPE_ROWS;
    const at = (r, c) => P[r * C + c];
    const nrm = [];
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        const l = at(r, Math.max(c - 1, 0)), rr = at(r, Math.min(c + 1, C - 1));
        const u = at(Math.max(r - 1, 0), c), d = at(Math.min(r + 1, R - 1), c);
        nrm.push(V3.normalize(V3.cross([d.x - u.x, d.y - u.y, d.z - u.z], [rr.x - l.x, rr.y - l.y, rr.z - l.z])));
      }
    }
    const pos = new Float32Array(this.count * 3), n3 = new Float32Array(this.count * 3), col = new Float32Array(this.count * 4);
    let k = 0;
    const put = (r, c, color) => {
      const p = at(r, c);
      pos.set([p.x, p.y, p.z], k * 3);
      n3.set(nrm[r * C + c], k * 3);
      col.set(color, k * 4);
      k++;
    };
    for (let r = 0; r < R - 1; r++) {   // 어깨 쪽은 짙고 아래로 갈수록 밝은 진홍, 맨 아랫단은 금
      const k = 0.82 + 0.18 * (r / (R - 2));   // 어깨 쪽을 너무 짙게 하지 않음 (명암은 셰이더가 부드럽게 맡음)
      const color = r === R - 2 ? KNIGHT.gold : [KNIGHT.cape[0] * k, KNIGHT.cape[1] * k, KNIGHT.cape[2] * k, KNIGHT.cape[3]];
      for (let c = 0; c < C - 1; c++) {
        put(r, c, color); put(r + 1, c, color); put(r, c + 1, color);
        put(r, c + 1, color); put(r + 1, c, color); put(r + 1, c + 1, color);
      }
    }
    const gl = GL.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nrmBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, n3);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, col);
  },
};
