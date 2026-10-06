// 살아 있는 풍경: 나비·새·떨어지는 나뭇잎·발걸음 먼지 (점 하나에 모양을 그려 넣어 가볍게 그림)
const FX = { DUST: 0, LEAF: 1, BUTTERFLY: 2, BIRD: 3, SPARK: 4, SMOKE: 5, FLAME: 6 };
const FLAME_COLOR = [1, 0.3, 0.03];    // 불꽃 바깥 색 (가운데는 노랗게 달아오름)
const BUTTERFLY_COLORS = [[1, 1, 0.95], [1, 0.85, 0.2], [0.4, 0.65, 1], [1, 0.55, 0.2]];
const FALLING_LEAF_COLORS = [[0.55, 0.75, 0.25], [0.85, 0.75, 0.25], [0.82, 0.48, 0.16], [0.45, 0.66, 0.2]];

const Particles = {
  list: [],
  max: 1000,
  stepIndex: 0,    // 발걸음 수 (바뀔 때 먼지)
  leafTimer: 0,

  // 맵을 불러올 때: 꽃 근처에 나비, 하늘 높이 새
  reset() {
    this.list = [];
    if (!CONFIG.graphics.life) return;
    const spots = World.flowerSpots;
    for (let i = 0; i < (spots.length ? 12 : 0); i++) {
      const [x, y, z] = spots[(Math.random() * spots.length) | 0];
      this.list.push({ type: FX.BUTTERFLY, x, y: y + 0.6, z, hx: x, hz: z, vx: 0, vy: 0, vz: 0, lift: 0,
        life: Infinity, size: 0.16, seed: Math.random(), color: BUTTERFLY_COLORS[i % 4], alpha: 1 });
    }
    const cx = (World.cols * CELL) / 2, cz = (World.rows * CELL) / 2;
    for (let i = 0; i < (World.cave ? 0 : 7); i++) {   // 새 (동굴엔 없음)
      this.list.push({ type: FX.BIRD, cx: cx + (Math.random() - 0.5) * 20, cz: cz + (Math.random() - 0.5) * 10,
        angle: Math.random() * 6.28, radius: 18 + Math.random() * 18, height: 32 + Math.random() * 14, speed: 0.1 + Math.random() * 0.06,
        x: 0, y: 0, z: 0, life: Infinity, size: 0.9, seed: Math.random(), color: [0.16, 0.16, 0.2], alpha: 1 });
    }
  },

  spawn(p) {
    if (this.list.length < this.max) this.list.push(p);
  },

  // 먼지 뭉치 n개
  dust(x, y, z, n, spread) {
    for (let i = 0; i < n; i++) {
      const life = 0.6 + Math.random() * 0.4;
      this.spawn({ type: FX.DUST, x: x + (Math.random() - 0.5) * spread, y: y + 0.08, z: z + (Math.random() - 0.5) * spread,
        vx: (Math.random() - 0.5) * 0.8, vy: 0.35 + Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.8,
        life, maxLife: life, size: 0.22, seed: Math.random(), color: [0.8, 0.74, 0.62], alpha: 0.5 });
    }
  },

  // 칼에 맞은 자리에서 튀는 불똥
  sparks(x, y, z, n, color = [1, 0.88, 0.45]) {
    for (let i = 0; i < n; i++) {
      const d = V3.normalize([Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5]), sp = 2 + Math.random() * 4;
      const life = 0.25 + Math.random() * 0.2;
      this.spawn({ type: FX.SPARK, x, y, z, vx: d[0] * sp, vy: d[1] * sp, vz: d[2] * sp, g: 9,
        life, maxLife: life, size: 0.07, seed: Math.random(), color, alpha: 1 });
    }
  },

  // 적이 쓰러질 때 피어오르는 보랏빛 연기 (color로 다른 색 연기도)
  smoke(x, y, z, n, color = [0.3, 0.18, 0.38]) {
    for (let i = 0; i < n; i++) {
      const life = 0.7 + Math.random() * 0.4;
      this.spawn({ type: FX.SMOKE, x: x + (Math.random() - 0.5) * 0.5, y: y + (Math.random() - 0.5) * 0.5, z: z + (Math.random() - 0.5) * 0.5,
        vx: (Math.random() - 0.5) * 1.5, vy: 0.6 + Math.random() * 0.9, vz: (Math.random() - 0.5) * 1.5,
        life, maxLife: life, size: 0.35, seed: Math.random(), color, alpha: 0.8 });
    }
  },

  // 열린 출구에서 천천히 올라가는 금빛 반짝이
  glitter(x, y, z) {
    const life = 1.5 + Math.random();
    this.spawn({ type: FX.SPARK, x: x + (Math.random() - 0.5) * 2, y: y + Math.random() * 0.5, z: z + (Math.random() - 0.5) * 2,
      vx: 0, vy: 0.5 + Math.random() * 0.6, vz: 0, g: 0, life, maxLife: life, size: 0.06, seed: Math.random(), color: [1, 0.85, 0.4], alpha: 1 });
  },

  // 칼날에서 피어오르는 빛 알갱이 (무기 속성 색)
  mote(x, y, z, color = [0.45, 0.8, 1]) {
    const life = 0.6 + Math.random() * 0.5;
    this.spawn({ type: FX.SPARK, x, y, z, vx: (Math.random() - 0.5) * 0.2, vy: 0.25 + Math.random() * 0.3, vz: (Math.random() - 0.5) * 0.2, g: 0,
      life, maxLife: life, size: 0.035, seed: Math.random(), color, alpha: 1 });
  },

  // 일렁이며 솟아오르다 작아지는 불꽃 하나 (size: 크기 m, life: 대략의 수명 초)
  flame(x, y, z, size, color = FLAME_COLOR, life = 0.5, vx = 0, vy = 0.9, vz = 0) {
    const l = life * (0.7 + Math.random() * 0.6);
    this.spawn({ type: FX.FLAME, x, y, z, vx: vx + (Math.random() - 0.5) * 0.4, vy: vy * (0.6 + Math.random() * 0.7), vz: vz + (Math.random() - 0.5) * 0.4,
      life: l, maxLife: l, size, seed: Math.random(), color, alpha: 1 });
  },

  // 사방으로 퍼지며 솟는 불꽃 n개 (spread: 퍼지는 반경, power: 퍼지는 빠르기)
  flameBurst(x, y, z, n, spread, power, size = 0.32) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, r = Math.random() * spread, sp = power * (0.4 + Math.random() * 0.6);
      this.flame(x + Math.cos(a) * r, y, z + Math.sin(a) * r, size * (0.7 + Math.random() * 0.6), FLAME_COLOR, 0.55,
        Math.cos(a) * sp, 1.2 + Math.random() * power * 0.6, Math.sin(a) * sp);
    }
  },

  // 불씨: 작은 주황 빛 알갱이가 흔들리며 위로 날아오름
  ember(x, y, z) {
    const life = 0.7 + Math.random() * 0.6;
    this.spawn({ type: FX.SPARK, x, y, z, vx: (Math.random() - 0.5) * 0.8, vy: 0.6 + Math.random() * 0.8, vz: (Math.random() - 0.5) * 0.8, g: -0.6,
      life, maxLife: life, size: 0.03, seed: Math.random(), color: [1, 0.55, 0.15], alpha: 1 });
  },

  update(dt, time, player) {
    // 3인칭: 칼날에서 피어오르는 무기의 기운 (빛 알갱이 / 불꽃)
    if (!Camera.isFirst && Character.swordM && !player.dead) Weapons.aura(dt, player);
    if (!CONFIG.graphics.life) {
      this.list = this.list.filter((p) => p.type === FX.SPARK || p.type === FX.SMOKE || p.type === FX.FLAME);
    }
    const life = CONFIG.graphics.life;
    // 발걸음·구르기 먼지
    const speed = life ? Math.hypot(player.vx, player.vz) : 0;
    const step = Math.floor(player.bobPhase / Math.PI);
    if (step !== this.stepIndex) {
      this.stepIndex = step;
      if (speed > 2) {
        this.dust(player.x, player.groundY, player.z, 2, 0.3);
        Sound.play('step');
      }
    }
    if (life && player.isDodging && Math.random() < 0.6) this.dust(player.x, player.groundY, player.z, 1, 0.5);

    // 횃불: 화로에서 불꽃과 불씨가 계속 피어오름 (가까운 것만)
    for (const [tx, ty, tz] of World.torches) {
      if (Math.abs(tx - player.x) > 28 || Math.abs(tz - player.z) > 28) continue;
      if (Math.random() < dt * 22) this.flame(tx + (Math.random() - 0.5) * 0.3, ty, tz + (Math.random() - 0.5) * 0.3, 0.28 + Math.random() * 0.12, FLAME_COLOR, 0.55);
      if (Math.random() < dt * 3) this.ember(tx, ty + 0.3, tz);
    }

    // 낙엽: 가까운 나무에서 가끔 한 장씩
    this.leafTimer -= dt;
    if (life && this.leafTimer <= 0) {
      this.leafTimer = 0.2;
      const near = World.trees.filter((t) => Math.abs(t[0] - player.x) < 18 && Math.abs(t[2] - player.z) < 18);
      if (near.length) {
        const t = near[(Math.random() * near.length) | 0];
        this.spawn({ type: FX.LEAF, x: t[0] + (Math.random() - 0.5) * t[3] * 1.6, y: t[1] + Math.random(), z: t[2] + (Math.random() - 0.5) * t[3] * 1.6,
          vx: 0.35, vy: -0.55 - Math.random() * 0.3, vz: 0.15, life: 10, maxLife: 10, size: 0.12, seed: Math.random(),
          color: FALLING_LEAF_COLORS[(Math.random() * 4) | 0], alpha: 1 });
      }
    }

    for (const p of this.list) {
      if (p.type === FX.DUST || p.type === FX.SMOKE) {
        p.life -= dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vy *= 0.95;
        p.size += (p.type === FX.SMOKE ? 1.2 : 0.8) * dt;
        p.alpha = (p.type === FX.SMOKE ? 0.8 : 0.5) * (p.life / p.maxLife);
      } else if (p.type === FX.SPARK) {
        p.life -= dt;
        p.vy -= p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.alpha = Math.min(1, (p.life / p.maxLife) * 2);
      } else if (p.type === FX.FLAME) {   // 불꽃: 점점 빨리 솟으며 작아짐 (alpha = 남은 생명 비율 → 셰이더가 색을 노랑 → 빨강으로)
        p.life -= dt;
        const drag = Math.max(0, 1 - dt * 3);
        p.vx *= drag; p.vz *= drag;
        p.vy += 1.5 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.size *= Math.max(0, 1 - dt * 1.4);
        p.alpha = Math.max(0, p.life / p.maxLife);
      } else if (p.type === FX.LEAF) {
        p.life -= dt;
        const ground = World.groundHeight(p.x, p.z) + 0.03;
        if (p.y > ground) {   // 흔들흔들 떨어짐
          p.x += (p.vx + Math.sin(time * 2 + p.seed * 10) * 0.6) * dt;
          p.y = Math.max(ground, p.y + p.vy * dt);
          p.z += (p.vz + Math.cos(time * 1.7 + p.seed * 7) * 0.4) * dt;
        }
        p.alpha = Math.min(1, p.life);
      } else if (p.type === FX.BUTTERFLY) {
        // 집(꽃) 주변을 이리저리 날다가 전사가 다가오면 달아남
        const dx = p.x - player.x, dz = p.z - player.z, d = Math.hypot(dx, dz) || 1;
        p.vx += (Math.sin(time * 2.1 + p.seed * 13) * 2.5 + (p.hx - p.x) * 0.6) * dt;
        p.vz += (Math.cos(time * 1.7 + p.seed * 7) * 2.5 + (p.hz - p.z) * 0.6) * dt;
        if (d < 2.5) {
          p.vx += (dx / d) * 8 * dt;
          p.vz += (dz / d) * 8 * dt;
        }
        p.vx *= 0.97;
        p.vz *= 0.97;
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        p.lift += ((d < 2.5 ? 1 : 0) - p.lift) * Math.min(1, dt * 2);
        p.y = World.groundHeight(p.x, p.z) + 0.45 + Math.sin(time * 2.3 + p.seed * 9) * 0.25 + p.lift * 1.2;
      } else {   // 새: 하늘 높이 원을 그리며
        p.angle += p.speed * dt;
        p.x = p.cx + Math.cos(p.angle) * p.radius;
        p.z = p.cz + Math.sin(p.angle) * p.radius;
        p.y = p.height + Math.sin(time * 0.5 + p.seed * 6) * 2;
      }
    }
    this.list = this.list.filter((p) => p.life > 0);
  },

  // 그리기용 숫자: 점마다 [x, y, z, 크기, 종류, 무작위 값, 투명도, r, g, b]
  data() {
    const out = new Float32Array(this.list.length * 10);
    this.list.forEach((p, i) => {
      out.set([p.x, p.y, p.z, p.size, p.type, p.seed, p.alpha, p.color[0], p.color[1], p.color[2]], i * 10);
    });
    return out;
  },
};
