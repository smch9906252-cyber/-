// 여러 파일에서 함께 쓰는 작은 도구 함수 모음
const Utils = {
  // 숫자를 min~max 사이로 제한
  clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  },

  // 두 점 사이 거리
  dist(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  },

  // 방향을 길이 1로 맞춤 (대각선으로 갈 때 더 빨라지지 않게)
  normalize(x, y) {
    const len = Math.hypot(x, y);
    return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  },

  // a에서 b 쪽으로 t(0~1)만큼 간 값
  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  // 각도(도) → 라디안
  rad(deg) {
    return (deg * Math.PI) / 180;
  },

  // 부드럽게 출발해서 부드럽게 멈추는 곡선 (0~1 → 0~1)
  smooth(t) {
    t = Utils.clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  },

  // seed가 같으면 항상 같은 순서로 나오는 난수 (숲 모양이 매번 똑같게)
  rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  // 정수 좌표 → 0~1 난수 (같은 좌표는 항상 같은 값)
  hash2(x, y) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  },

  // 부드럽게 이어지는 난수 (언덕·얼룩무늬용, 0~1)
  noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = this.hash2(xi, yi), b = this.hash2(xi + 1, yi);
    const c = this.hash2(xi, yi + 1), d = this.hash2(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  },

  // 큰 무늬 + 작은 무늬를 겹친 자연스러운 난수 (0~1)
  fbm2(x, y, octaves = 4) {
    let sum = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise2(x * freq + i * 17.3, y * freq - i * 9.1);
      freq *= 2;
      amp *= 0.5;
    }
    return sum / (1 - Math.pow(0.5, octaves));
  },

  // '#4c8a3a' 같은 색 → 조명 계산용 숫자 [r, g, b, 반짝임]
  // (모니터 색은 밝기가 휘어 있어서 2.2제곱으로 펴 줌)
  color(hex, shine = 0) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.pow(v / 255, 2.2);
    return [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255), shine];
  },

  // 화면에 보이지 않는 그림판(캔버스) 만들기
  makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  },

  // 두 색을 t(0~1)만큼 섞기
  mixColor(a, b, t) {
    return a.map((v, i) => v + (b[i] - v) * t);
  },
};
