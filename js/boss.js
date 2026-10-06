// 보스: 바위 골렘 (동굴 깊은 곳)
// 바위 덩어리 몸에 가슴의 수정 심장이 빛나는 거인. 느리지만 한 방이 크고, 공격 전에 땅에 붉은 원으로 예고함.
//   내려찍기: 두 주먹을 치켜들었다가 앞을 내리침 → 주먹이 땅에 박혀 잠깐 못 움직임 (반격 기회)
//   바위 던지기: 멀리 있으면 바위를 집어 던짐 (떨어질 자리에 붉은 원)
//   큰 피해가 쌓이면 무릎을 꿇고 휘청임. 체력이 절반 아래로 내려가면 분노: 더 빨라지고 두 번 연달아 내리치며 박쥐를 부름
// 능력치는 config.js의 enemies.golem

const GOLEM_COLORS = {
  rock: Utils.color('#717a86', MAT.ROCK),   // 동굴 벽(따뜻한 갈색)과 구별되게 푸른 잿빛
  dark: Utils.color('#474d57', MAT.ROCK),
  crystal: Utils.color('#86e6ff', MAT.CRYSTAL),
  eye: Utils.color('#9ff6ff', MAT.GLOW),
};
const GOLEM_PAL = { core: [1.7, 1.6, 1.4], mid: [0.9, 0.65, 0.35] };   // 땅을 내리친 섬광 색 (흙먼지 빛)
const WARN_COLOR = [1.0, 0.16, 0.08];                                   // 공격 예고 원 색
const GOLEM_DEATH = 2.8;                                                 // 쓰러진 뒤 사라질 때까지 (초)
const GOLEM_SCALE = 1.35;                                                // 모델 크기 배율 (키 약 4.3m)

function buildGolemParts() {
  const T = M4.translation, S = M4.scaling, ch = M4.chain, R = Utils.rng(77);
  const rock = () => vary(GOLEM_COLORS.rock, 0.16, R), dark = () => vary(GOLEM_COLORS.dark, 0.12, R);
  const crystal = () => GOLEM_COLORS.crystal, eye = () => GOLEM_COLORS.eye;
  const lump = (b, m, c = rock, detail = 1) => Shapes.icosphere(b, m, detail, c, { rnd: R, jitter: 0.3 });
  const spike = (b, p0, dir, r, len) => {   // 수정 가시 (육각 기둥 + 뾰족한 끝)
    const d = V3.normalize(dir), p1 = V3.add(p0, V3.scale(d, len));
    Shapes.segment(b, p0, p1, r, r * 0.85, 6, crystal, { top: false });
    Shapes.segment(b, p1, V3.add(p1, V3.scale(d, r * 1.8)), r * 0.85, 0, 6, crystal);
  };
  return {
    glPelvis: makePart((b) => lump(b, ch(T(0, -0.05, 0), S(0.58, 0.34, 0.44)), dark)),
    glTorso: makePart((b) => {
      lump(b, ch(T(0, 0.62, 0.05), S(0.9, 0.74, 0.64)), rock, 2);   // 넓은 가슴
      lump(b, ch(T(0, 0.15, 0), S(0.62, 0.36, 0.5)), dark);         // 배
      lump(b, ch(T(0.36, 0.98, 0.26), S(0.42, 0.32, 0.36)));        // 등의 혹
      lump(b, ch(T(-0.4, 0.92, 0.22), S(0.36, 0.3, 0.34)));
      Shapes.icosphere(b, ch(T(0, 0.7, -0.52), S(0.21, 0.27, 0.14)), 1, crystal);   // 가슴의 수정 심장
      for (const [x, y, z, r, len] of [[0.13, 0.6, -0.5, 0.06, 0.18], [-0.14, 0.76, -0.48, 0.05, 0.15], [0.02, 0.94, -0.45, 0.05, 0.14]]) {
        spike(b, [x, y, z], [x * 2, 0.3, -1], r, len);
      }
      for (let i = 0; i < 7; i++) {   // 등에 솟은 수정 가시
        const x = ((i % 4) - 1.5) * 0.24 + (R() - 0.5) * 0.08, y = 0.75 + Math.floor(i / 4) * 0.38;
        spike(b, [x, y, 0.5], [x * 0.8, 0.9, 0.6], 0.07 + R() * 0.04, 0.25 + R() * 0.3);
      }
    }),
    glHead: makePart((b) => {
      lump(b, ch(T(0, 0.2, 0), S(0.36, 0.3, 0.34)), rock, 1);
      lump(b, ch(T(0, 0.07, -0.18), S(0.3, 0.14, 0.2)), dark);                         // 턱
      Shapes.box(b, ch(T(0, 0.28, -0.27), M4.rotationX(0.25), S(0.52, 0.1, 0.13)), dark);   // 툭 튀어나온 이마
      for (const sx of [-1, 1]) Shapes.icosphere(b, ch(T(sx * 0.12, 0.2, -0.31), S(0.08, 0.055, 0.035)), 1, eye);
      spike(b, [0.12, 0.38, 0.05], [0.4, 1, 0.2], 0.05, 0.16);
      spike(b, [-0.15, 0.36, 0.08], [-0.5, 1, 0.3], 0.045, 0.12);
    }),
    glArm: makePart((b) => {
      lump(b, ch(T(0, 0.05, 0), S(0.48, 0.44, 0.48)), rock, 2);   // 어깨 바위
      lump(b, ch(T(0, -0.48, 0), S(0.28, 0.42, 0.28)), dark);
      spike(b, [0.05, 0.38, 0.05], [0.5, 1, 0.3], 0.07, 0.22);     // 어깨에 솟은 수정
      spike(b, [-0.12, 0.35, 0.12], [-0.2, 1, 0.6], 0.055, 0.16);
      spike(b, [0.2, 0.25, -0.1], [1, 0.7, -0.2], 0.05, 0.14);
    }),
    glForearm: makePart((b) => {
      lump(b, ch(T(0, -0.42, 0), S(0.32, 0.5, 0.32)));
      spike(b, [0.2, -0.35, 0.05], [1, 0.2, 0.3], 0.05, 0.12);     // 팔뚝의 수정 결정
      spike(b, [0.17, -0.55, -0.1], [1, -0.1, -0.4], 0.04, 0.1);
    }),
    glFist: makePart((b) => {
      lump(b, ch(T(0, -0.25, 0), S(0.45, 0.39, 0.45)), rock, 2);
      for (let i = 0; i < 3; i++) lump(b, ch(T((i - 1) * 0.17, -0.47, -0.22), S(0.12, 0.12, 0.13)), dark, 0);   // 손가락 마디
    }),
    glThigh: makePart((b) => lump(b, ch(T(0, -0.32, 0), S(0.33, 0.42, 0.33)), dark)),
    glShin: makePart((b) => {
      lump(b, ch(T(0, -0.28, 0), S(0.35, 0.38, 0.37)));
      lump(b, ch(T(0, -0.56, -0.1), S(0.42, 0.17, 0.52)), dark);   // 발
    }),
    glRock: makePart((b) => lump(b, S(0.5, 0.45, 0.5), rock, 1)),   // 던지는 바위
  };
}

const GOLEM_RIG = [
  ['hips', null, [0, 1.3, 0], 'glPelvis'],
  ['spine', 'hips', [0, 0.2, 0], 'glTorso'],
  ['head', 'spine', [0, 1.15, -0.34], 'glHead'],
  ['shoulderR', 'spine', [0.9, 0.98, 0], 'glArm'],
  ['elbowR', 'shoulderR', [0, -0.85, 0], 'glForearm'],
  ['handR', 'elbowR', [0, -0.85, 0], 'glFist'],
  ['shoulderL', 'spine', [-0.9, 0.98, 0], 'glArm'],
  ['elbowL', 'shoulderL', [0, -0.85, 0], 'glForearm'],
  ['handL', 'elbowL', [0, -0.85, 0], 'glFist'],
  ['hipR', 'hips', [0.38, -0.1, 0], 'glThigh'],
  ['kneeR', 'hipR', [0, -0.6, 0], 'glShin'],
  ['hipL', 'hips', [-0.38, -0.1, 0], 'glThigh'],
  ['kneeL', 'hipL', [0, -0.6, 0], 'glShin'],
];

// 상태별 자세 (s: 왼쪽·오른쪽 대칭으로 쓰는 값)
const GOLEM_POSES = {
  sleep: { hips: 0.8, spine: J(-0.85), head: J(-0.45), shoulderR: J(0.7, 0, 0.25), elbowR: J(0.9), shoulderL: J(0.7, 0, -0.25), elbowL: J(0.9),
    hipR: J(1.3), kneeR: J(-2.0), hipL: J(1.3), kneeL: J(-2.0) },
  roar: { hips: 1.25, spine: J(0.3), head: J(0.55), shoulderR: J(0.5, 0, 1.3), elbowR: J(0.7), shoulderL: J(0.5, 0, -1.3), elbowL: J(0.7),
    hipR: J(0.3, 0, 0.1), kneeR: J(-0.5), hipL: J(0.3, 0, -0.1), kneeL: J(-0.5) },
  slamWind: { hips: 1.22, spine: J(0.3), head: J(0.35), shoulderR: J(2.95, 0, 0.3), elbowR: J(0.55), shoulderL: J(2.95, 0, -0.3), elbowL: J(0.55),
    hipR: J(0.35), kneeR: J(-0.6), hipL: J(0.35), kneeL: J(-0.6) },
  slam: { hips: 1.05, spine: J(-0.75), head: J(0.25), shoulderR: J(1.05, 0, 0.2), elbowR: J(0.1), shoulderL: J(1.05, 0, -0.2), elbowL: J(0.1),
    hipR: J(0.7), kneeR: J(-1.0), hipL: J(0.7), kneeL: J(-1.0) },
  throwWind: { hips: 1.25, spine: J(0.15, 0.55), head: J(0.1, -0.4), shoulderR: J(-2.3, 0, 0.35), elbowR: J(0.7), shoulderL: J(1.0, 0, -0.35), elbowL: J(0.2),
    hipR: J(0.15), kneeR: J(-0.45), hipL: J(0.45), kneeL: J(-0.6) },
  throw: { hips: 1.2, spine: J(-0.35, -0.45), head: J(0.15), shoulderR: J(1.9, 0, 0.1), elbowR: J(0.1), shoulderL: J(0.3, 0, -0.5), elbowL: J(0.4),
    hipR: J(0.5), kneeR: J(-0.7), hipL: J(0.1), kneeL: J(-0.4) },
  stagger: { hips: 0.95, spine: J(-0.6, 0.2), head: J(-0.35), shoulderR: J(0.55, 0, 0.35), elbowR: J(0.3), shoulderL: J(0.55, 0, -0.35), elbowL: J(0.3),
    hipR: J(1.25), kneeR: J(-1.9), hipL: J(0.3), kneeL: J(-1.2) },
  dead: { hips: 0.7, spine: J(-1.1), head: J(-0.6), shoulderR: J(0.9, 0, 0.6), elbowR: J(0.2), shoulderL: J(0.9, 0, -0.6), elbowL: J(0.2),
    hipR: J(1.4), kneeR: J(-2.1), hipL: J(1.4), kneeL: J(-2.1) },
};

const Golem = {
  build: buildGolemParts,

  // 땅에 닿는 원 (가장자리로 갈수록 투명) — 공격 예고·충격파
  disc(x, z, r, color, aIn, aEdge, segs = 36) {
    const y = (px, pz) => World.groundHeight(px, pz) + 0.14;
    const c = [x, y(x, z), z];
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
      const p0 = [x + Math.cos(a0) * r, 0, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, 0, z + Math.sin(a1) * r];
      p0[1] = y(p0[0], p0[2]);
      p1[1] = y(p1[0], p1[2]);
      Glow.vert(c, rgba(color, aIn)); Glow.vert(p0, rgba(color, aEdge)); Glow.vert(p1, rgba(color, aEdge));
    }
  },
  // 땅 위 고리 (안쪽 반지름 r0 → 바깥 r1, 가운데가 가장 진함)
  ring(x, z, r0, r1, color, alpha, segs = 48) {
    const y = (px, pz) => World.groundHeight(px, pz) + 0.15;
    const at = (a, r) => {
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      return [px, y(px, pz), pz];
    };
    const rm = (r0 + r1) / 2, on = rgba(color, alpha), off = rgba(color, 0);
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
      Glow.quad(at(a0, r0), at(a0, rm), at(a1, rm), at(a1, r0), off, on, on, off);
      Glow.quad(at(a0, rm), at(a0, r1), at(a1, r1), at(a1, rm), on, off, off, on);
    }
  },

  // 공격 예고 원·충격파 고리·날아가는 바위의 떨어질 자리 (Skills.buildGlow가 부름)
  glow(eye, time) {
    const pulse = 0.75 + 0.25 * Math.sin(time * 18);
    for (const e of Enemies.list) {
      if (e.type !== 'golem') continue;
      const s = CONFIG.enemies.golem;
      if ((e.state === 'slamWind' || e.state === 'slam') && e.slamAt) {   // 내려칠 자리: 테두리 + 안쪽이 차오름 (가득 차면 내리침)
        const k = e.state === 'slam' ? 1 : 1 - e.timer / e.windTime;
        this.disc(e.slamAt.x, e.slamAt.z, s.slamRadius, WARN_COLOR, 0.08 * pulse, 0.2 * pulse);
        this.ring(e.slamAt.x, e.slamAt.z, s.slamRadius - 0.25, s.slamRadius + 0.05, WARN_COLOR, 0.8 * pulse);
        this.disc(e.slamAt.x, e.slamAt.z, s.slamRadius * Utils.smooth(k), WARN_COLOR, 0.05, 0.35);
      }
      if ((e.state === 'throwWind' || e.state === 'throw') && e.throwAt) {
        this.ring(e.throwAt.x, e.throwAt.z, s.throwRadius - 0.2, s.throwRadius + 0.05, WARN_COLOR, 0.6 * pulse);
      }
      for (const w of e.waves) {   // 내리친 자리에서 퍼지는 충격파
        const k = w.age / 0.5, r = w.r * (0.3 + k * 1.1);
        this.ring(w.x, w.z, r - 0.5, r + 0.3, [1.0, 0.75, 0.45], 0.9 * (1 - k));
      }
    }
    for (const b of Boulders.list) {   // 날아오는 바위가 떨어질 자리 (가까워질수록 진하게)
      const k = Utils.clamp(b.t / b.T, 0, 1);
      this.disc(b.to.x, b.to.z, b.radius, WARN_COLOR, 0.06 + 0.12 * k, 0.15 + 0.25 * k);
      this.ring(b.to.x, b.to.z, b.radius - 0.2, b.radius + 0.05, WARN_COLOR, (0.5 + 0.4 * k) * pulse);
      this.disc(b.to.x, b.to.z, b.radius * k, WARN_COLOR, 0.04, 0.25);
    }
  },

  // 깨어남
  wake(e) {
    if (e.state !== 'sleep') return;
    e.state = 'wake';
    e.timer = 2.2;
    Camera.shake = Math.max(Camera.shake, 0.3);
    UI.message('바위 골렘이 깨어났다!', '붉은 원이 보이면 피하세요');
  },

  // 맞음: 밀려나지 않고, 피해가 쌓이면(poise) 무릎을 꿇음
  hit(e, damage) {
    if (e.dead) return;
    const s = CONFIG.enemies.golem;
    e.hp -= damage;
    e.flash = 0.12;
    e.hpShow = 4;
    this.wake(e);
    e.poise -= damage;
    if (e.poise <= 0 && ['chase', 'stuck', 'slamWind', 'throwWind'].includes(e.state)) {
      e.poise = s.poise;
      e.state = 'stagger';
      e.timer = s.staggerTime;
      e.second = false;
      Camera.shake = Math.max(Camera.shake, 0.35);
      Particles.dust(e.x, e.groundY, e.z, 10, 1.4);
    }
    if (e.hp <= 0) {   // 쓰러짐: 느린 화면 → 무릎 꿇고 앞으로 쓰러진 뒤 부서져 흩어짐
      e.hp = 0;
      e.dead = true;
      e.state = 'dead';
      e.deathTimer = GOLEM_DEATH;
      e.deathKind = Weapons.cur.id;
      e.deathFx = false;
      Game.hitStop = Math.max(Game.hitStop, 0.35);
      Camera.shake = Math.max(Camera.shake, 0.5);
      Particles.sparks(e.x, e.groundY + 2.5, e.z, 30, GOLEM_COLORS.crystal.slice(0, 3).map((v) => Math.min(1, v * 1.4)));
      Boulders.list = [];
    }
  },

  // 바닥을 내리친 순간 (내려찍기·떨어진 바위): 흙먼지 고리 + 섬광 + 충격파, 원 안에 있으면 피해
  impact(e, x, z, r, damage, p, big) {
    const y = World.groundHeight(x, z);
    Camera.shake = Math.max(Camera.shake, big ? 0.7 : 0.4);
    if (big) Sound.play('slam');
    else Sound.play('boom', { size: 0.8, x, z, range: 50 });
    if (big) Game.hitStop = Math.max(Game.hitStop, 0.05);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      Particles.dust(x + Math.cos(a) * r * 0.7, y, z + Math.sin(a) * r * 0.7, 1, 0.6);
    }
    Particles.dust(x, y, z, 12, 1.2);
    Particles.smoke(x, y + 0.3, z, 6, [0.32, 0.29, 0.26]);
    Particles.sparks(x, y + 0.2, z, 16, [1, 0.8, 0.5]);
    Skills.impact(x, y + 0.4, z, big ? 1.8 : 1.2, GOLEM_PAL);
    if (e) e.waves.push({ x, z, r, age: 0 });
    if (!p.dead && Math.hypot(p.x - x, p.z - z) < r + p.radius) p.hurt(damage, x, z, 12);
  },

  update(e, dt, p, s, d, dx, dz, time) {
    const ang = Math.atan2(dz, dx), fast = e.phase === 2 ? s.rageSpeed : 1;
    e.throwCool = Math.max(0, e.throwCool - dt);
    for (const w of e.waves) w.age += dt;
    e.waves = e.waves.filter((w) => w.age < 0.5);
    // 체력이 절반 아래 → 분노: 포효하며 박쥐를 부르고 붉게 달아오름
    if (e.phase === 1 && e.hp < e.maxHp * 0.5 && ['chase', 'stuck', 'stagger'].includes(e.state)) {
      e.phase = 2;
      e.state = 'roar';
      e.timer = 1.8;
      e.tint = [1.35, 0.85, 0.75];
      Camera.shake = Math.max(Camera.shake, 0.8);
      Sound.play('roar');
      UI.message('바위 골렘이 분노했다!', '더 빠르게, 두 번 연달아 내리칩니다');
      for (let i = 0; i < s.rageBats; i++) {
        const a = Math.random() * Math.PI * 2;
        const bat = new Enemy('bat', e.x + Math.cos(a) * 3, e.z + Math.sin(a) * 3, Math.random);
        bat.state = 'chase';
        bat.alert = 0.8;
        Enemies.list.push(bat);
      }
    }
    switch (e.state) {
      case 'sleep':   // 웅크린 채 잠듦 (가까이 오거나 맞으면 깨어남)
        e.stop(dt);
        if (d < s.detect && !p.dead) this.wake(e);
        break;
      case 'wake':    // 일어나 포효
        e.stop(dt);
        e.face(ang, dt * 3);
        if (e.timer < 1.1 && !e.roared) {
          e.roared = true;
          Camera.shake = Math.max(Camera.shake, 0.7);
          Sound.play('roar');
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            Particles.dust(e.x + Math.cos(a) * 2, e.groundY, e.z + Math.sin(a) * 2, 1, 0.5);
          }
        }
        if (e.timer <= 0) {
          e.state = 'chase';
          e.cool = 0.8;
        }
        break;
      case 'chase': {
        if (p.dead) {
          e.stop(dt);
          break;
        }
        e.steer(p.x, p.z, s.speed * fast, dt);
        const step = Math.floor(e.walk * 0.55 / Math.PI);   // 쿵쿵 발걸음: 흙먼지, 가까우면 화면이 흔들림
        if (step !== e.step) {
          e.step = step;
          Particles.dust(e.x, e.groundY, e.z, 3, 1.2);
          Sound.play('stomp', { x: e.x, z: e.z });
          if (d < 14) Camera.shake = Math.max(Camera.shake, 0.12 * (1 - d / 14));
        }
        if (d < s.slamRange && e.cool <= 0) this.startSlam(e, s.slamWind / fast);
        else if (d > s.slamRange + 3 && e.throwCool <= 0) {
          e.state = 'throwWind';
          e.timer = e.windTime = s.throwWind / fast;
        }
        break;
      }
      case 'slamWind':   // 두 주먹을 치켜듦 (처음엔 전사를 따라 돌다가 마지막엔 멈춤)
        e.stop(dt);
        if (e.timer > e.windTime * 0.35) e.face(ang, dt * 4);
        e.slamAt = { x: e.x + Math.cos(e.facing) * 2.7, z: e.z + Math.sin(e.facing) * 2.7 };   // 주먹이 닿는 자리 (몸 앞)
        if (e.timer <= 0) {
          e.state = 'slam';
          e.timer = 0.16;
        }
        break;
      case 'slam':
        e.stop(dt);
        if (e.timer <= 0) {
          this.impact(e, e.slamAt.x, e.slamAt.z, s.slamRadius, s.slamDamage, p, true);
          if (e.phase === 2 && !e.second) {   // 분노: 한 번 더
            e.second = true;
            this.startSlam(e, s.slamWind * 0.55);
          } else {
            e.second = false;
            e.state = 'stuck';
            e.timer = s.stuckTime / fast;
          }
        }
        break;
      case 'stuck':   // 주먹이 땅에 박혀 못 움직임 (반격 기회)
        e.stop(dt);
        if (e.timer <= 0) {
          e.state = 'chase';
          e.cool = s.slamCooldown / fast;
        }
        break;
      case 'throwWind':   // 바위를 집어 들고 겨눔
        e.stop(dt);
        e.face(ang, dt * 5);
        e.throwAt = { x: p.x + p.vx * 0.5, z: p.z + p.vz * 0.5 };
        if (e.timer <= 0) {
          e.state = 'throw';
          e.timer = 0.22;
        }
        break;
      case 'throw':
        e.stop(dt);
        if (e.timer <= 0) {
          const from = e.handR || [e.x, e.groundY + 3, e.z];
          Boulders.spawn(from, e.throwAt, s.throwDamage, s.throwRadius);
          e.state = 'chase';
          e.throwCool = s.throwCooldown / fast;
          e.cool = Math.max(e.cool, 0.8);
        }
        break;
      case 'stagger':   // 무릎 꿇고 휘청
      case 'roar':      // 분노의 포효
        e.stop(dt);
        if (e.timer <= 0) e.state = 'chase';
        break;
    }
  },

  startSlam(e, wind) {
    e.state = 'slamWind';
    e.timer = e.windTime = wind;
  },

  // 쓰러진 뒤: 무릎 꿇고 앞으로 엎어졌다가 부서져 흩어짐
  updateDeath(e, dt) {
    e.deathTimer -= dt;
    for (const w of e.waves) w.age += dt;
    e.waves = e.waves.filter((w) => w.age < 0.5);
    if (e.deathTimer <= 0.7 && !e.deathFx) {
      e.deathFx = true;
      const y = e.groundY + 1.6;
      Camera.shake = Math.max(Camera.shake, 0.9);
      Particles.smoke(e.x, y, e.z, 30, [0.3, 0.28, 0.26]);
      Particles.dust(e.x, e.groundY, e.z, 24, 3);
      Particles.sparks(e.x, y + 0.5, e.z, 40, [0.6, 0.95, 1]);
      for (let i = 0; i < 20; i++) Particles.glitter(e.x + (Math.random() - 0.5) * 2, e.groundY + Math.random() * 2, e.z + (Math.random() - 0.5) * 2);
      if (e.deathKind === 'laevateinn') Particles.flameBurst(e.x, e.groundY + 0.2, e.z, 20, 1.5, 2, 0.45);
      Skills.impact(e.x, y, e.z, 2.6, GOLEM_PAL);
      Skills.flash = Math.max(Skills.flash, 0.35);
      Sound.play('slam');
      Sound.play('chime');
      UI.message('바위 골렘을 쓰러뜨렸다!', '동굴 깊은 곳의 봉인이 풀린다');
    }
  },

  // 그리기용 부분 목록에 골렘을 더함 (자세는 상태가 바뀔 때 부드럽게 넘어감)
  parts(e, root, time, flash, tint, out) {
    const P = GOLEM_POSES, s = CONFIG.enemies.golem;
    const amt = Utils.clamp(Math.hypot(e.vx, e.vz) / s.speed, 0, 1);
    const w = Math.sin(e.walk * 0.55), co = Math.cos(e.walk * 0.55), breath = Math.sin(time * 1.6) * 0.03;
    let target = {   // 걷기·숨쉬기
      hips: 1.24 + Math.abs(co) * 0.07 * amt,
      spine: J(-0.25 + breath, -w * 0.12 * amt, w * 0.04 * amt),
      head: J(0.15, Math.sin(time * 0.7) * 0.15 * (1 - amt)),
      shoulderR: J(0.15 - w * 0.45 * amt, 0, 0.14), elbowR: J(0.25),
      shoulderL: J(0.15 + w * 0.45 * amt, 0, -0.14), elbowL: J(0.25),
      hipR: J(0.25 + w * 0.55 * amt), kneeR: J(-0.4 - Math.max(0, co) * 0.7 * amt),
      hipL: J(0.25 - w * 0.55 * amt), kneeL: J(-0.4 - Math.max(0, -co) * 0.7 * amt),
    };
    const st = e.state;
    if (st === 'sleep') target = P.sleep;
    else if (st === 'wake') target = e.timer > 1.3 ? P.sleep : P.roar;
    else if (st === 'roar' || st === 'slamWind' || st === 'slam' || st === 'stagger' || st === 'throwWind' || st === 'throw' || st === 'dead') target = P[st];
    else if (st === 'stuck') target = P.slam;
    // 부드럽게 넘어감 (내리칠 땐 빠르게)
    const rate = st === 'slam' || st === 'throw' ? 35 : st === 'dead' ? 3 : 8;
    const k = e.poseT === undefined ? 1 : Utils.clamp((time - e.poseT) * rate, 0, 1);
    e.poseT = time;
    if (!e.sp) e.sp = { hips: target.hips };
    e.sp.hips = Utils.lerp(e.sp.hips, target.hips, k);
    const pose = {};
    for (const name in target) {
      if (name === 'hips') continue;
      if (!e.sp[name]) e.sp[name] = J();
      blendPose(e.sp, { [name]: target[name] }, k);
      pose[name] = { ...e.sp[name] };
    }
    if (st === 'slamWind' && e.timer < 0.3) pose.spine.z += Math.sin(time * 45) * 0.03;   // 내리치기 직전 부들부들
    if (st === 'stuck') pose.spine.z += Math.sin(time * 30) * 0.02;
    if (st === 'roar' || (st === 'wake' && e.timer < 1.3)) pose.head.y = Math.sin(time * 25) * 0.05;
    let sc = GOLEM_SCALE;
    if (e.dead) sc *= Utils.clamp(e.deathTimer / 0.7, 0, 1);   // 마지막 0.7초: 작아지며 부서져 사라짐
    const m = M4.multiply(root, M4.scaling(sc, sc, sc));
    const { out: rig, W } = rigMatrices(GOLEM_RIG, m, pose, { hips: e.sp.hips });
    for (const part of rig) out.push({ mesh: part.mesh, m: part.m, flash, tint });
    e.handR = M4.transformPoint(W.handR, [0, -0.3, 0]);   // 바위를 던지는 자리
    if (st === 'throwWind') out.push({ mesh: 'glRock', m: M4.multiply(W.handR, M4.translation(0, -0.55, 0)), flash, tint });
  },
};

// 골렘이 던진 바위: 포물선으로 날아가 떨어진 자리 둘레에 피해
const Boulders = {
  list: [],

  spawn(from, to, damage, radius) {
    const T = 1.05, G = 14, ty = World.groundHeight(to.x, to.z);
    this.list.push({ x: from[0], y: from[1], z: from[2], vx: (to.x - from[0]) / T, vz: (to.z - from[2]) / T,
      vy: (ty - from[1] + 0.5 * G * T * T) / T, t: 0, T, G, to, damage, radius, spin: 0 });
  },

  update(dt, p) {
    for (const b of this.list) {
      b.t += dt;
      b.vy -= b.G * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.spin += dt * 6;
      if (b.t >= b.T || b.y < World.groundHeight(b.x, b.z)) {
        b.done = true;
        Golem.impact(null, b.x, b.z, b.radius, b.damage, p, false);
      }
    }
    this.list = this.list.filter((b) => !b.done);
  },

  matrix(b) {
    return M4.chain(M4.translation(b.x, b.y, b.z), M4.rotationX(b.spin), M4.rotationZ(b.spin * 0.7), M4.scaling(1.1, 1.1, 1.1));
  },
};
