// 전사 (1인칭 3D): 이동, 시점, 검 공격, 회피

// 검 자세 (카메라 기준). x 오른쪽, y 위, z 뒤쪽(앞은 -)
// yaw: 좌우로 돌림, pitch: 앞으로 눕힘, roll: 옆으로 기울임 (라디안)
const POSE_IDLE = { x: 0.36, y: -0.36, z: -0.7, yaw: 0.1, pitch: -0.6, roll: -0.15 };      // 평소 (오른쪽에 세워 듦)
const POSE_READY = { x: 0.45, y: -0.25, z: -0.5, yaw: -1.15, pitch: -1.25, roll: 0 };     // 휘두르기 직전 (오른쪽으로 젖힘)
const POSE_END = { x: -0.18, y: -0.36, z: -0.6, yaw: 0.85, pitch: -1.7, roll: 0 };        // 휘두른 뒤 (왼쪽 아래)
// 콤보 동작별 [시작, 끝]: 1 오른쪽→왼쪽 베기, 2 왼쪽→오른쪽 되베기, 3 머리 위에서 내려찍기
const POSE_COMBO = [
  [POSE_READY, POSE_END],
  [{ x: -0.22, y: -0.32, z: -0.55, yaw: 1.0, pitch: -1.35, roll: 0 }, { x: 0.45, y: -0.22, z: -0.55, yaw: -1.1, pitch: -1.45, roll: 0 }],
  [{ x: 0.2, y: 0.05, z: -0.45, yaw: 0.05, pitch: 0.45, roll: 0 }, { x: 0.05, y: -0.45, z: -0.6, yaw: 0, pitch: -1.95, roll: 0 }],
];
const SHOULDER = [0.35, -0.6, 0.05];   // 오른쪽 어깨 위치 (카메라 기준)

function mixPose(a, b, t) {
  const o = {};
  for (const k in a) o[k] = Utils.lerp(a[k], b[k], t);
  return o;
}

class Player {
  constructor(x, z, yaw) {
    const c = CONFIG.player;
    this.x = x;
    this.z = z;
    this.yaw = yaw;          // 시점의 좌우 방향 (0 = 동쪽, 커지면 오른쪽으로 돎)
    this.pitch = 0;          // 시점의 위아래 방향 (+ 위)
    this.facing = yaw;       // 몸이 바라보는 방향 (3인칭에서는 시점과 따로 움직임)
    this.radius = c.radius;
    this.maxHp = c.maxHp;
    this.hp = c.maxHp;
    this.attackPower = Weapons.stats.attack;   // 들고 있는 무기의 공격력

    this.vx = 0;             // 속도
    this.vz = 0;
    this.groundY = World.groundHeight(x, z);
    this.bobPhase = 0;       // 걸을 때 화면이 오르내리는 주기
    this.bobAmount = 0;
    this.roll = 0;           // 회피할 때 화면 기울기
    this.fovKick = 0;        // 회피할 때 시야가 살짝 넓어지는 양
    this.lagX = 0;           // 시점을 돌릴 때 검이 늦게 따라오는 양
    this.lagY = 0;
    this.attackTimer = 0;    // 0보다 크면 검을 휘두르는 중
    this.attackCooldown = 0;
    this.attackBuffer = 0;   // 공격 키를 살짝 일찍 눌러도 기억해 둠
    this.dodgeTimer = 0;     // 0보다 크면 회피 중
    this.dodgeCooldown = 0;
    this.dodgeDir = { x: 0, y: 0 };
    this.trail = [];         // 검 자취 기록
    this.swingId = 0;        // 몇 번째 칼질인지 (적이 한 칼질에 한 번만 맞게)
    this.hurtTimer = 0;      // 0보다 크면 맞은 직후 무적 (몸이 깜빡임)
    this.dead = false;
    this.cool = { spin: 0, wave: 0, dash: 0 };   // 스킬 다시 쓰기까지 남은 시간
    this.dashTimer = 0;      // F 섬광 돌진 중이면 0보다 큼 (무적)
    this.dashAfter = 0;      // 돌진이 끝난 뒤 칼을 뻗은 마무리 자세 시간
    this.dashFrom = null;    // 돌진을 시작한 자리
    this.dashHit = new Set();   // 돌진하며 지나친 적 (한 박자 뒤에 베임)
    this.ult = 0;            // 궁극기 게이지 (0~100)
    this.spinTimer = 0;      // 회전베기 중이면 0보다 큼
    this.spinId = 0;
    this.castTimer = 0;      // 궁극기 시전 중이면 0보다 큼 (검을 하늘로)
    this.combo = 0;          // 지금 콤보 동작 (0 베기, 1 되베기, 2 내려찍기)
    this.comboTimer = 0;     // 0보다 크면 다음 공격이 콤보로 이어짐
    this.impactDone = false; // 내려찍기가 땅에 닿았는지
  }

  get isAttacking() { return this.attackTimer > 0; }
  get isDodging() { return this.dodgeTimer > 0; }
  get isInvincible() { return this.isDodging || this.hurtTimer > 0 || this.castTimer > 0 || this.dashTimer > 0 || this.dead; }   // 구르는 중·맞은 직후·궁극기·돌진 중엔 무적

  // 적에게 피해를 주면 궁극기 게이지가 참
  chargeUlt(amount) {
    const before = this.ult;
    this.ult = Math.min(100, this.ult + amount * CONFIG.skills.ultimate.chargePerDamage);
    if (before < 100 && this.ult >= 100) UI.toast('궁극기 준비 완료!  R 키');
  }
  get bob() { return Math.sin(this.bobPhase * 2) * 0.04 * this.bobAmount; }

  eye() {
    return [this.x, this.groundY + (this.dead ? 0.6 : CONFIG.player.eyeHeight) + this.bob, this.z];
  }

  // 적에게 맞음: 피해를 입으면 true. (fromX, fromZ) 반대쪽으로 push만큼 밀려남
  hurt(damage, fromX, fromZ, push = 7) {
    if (this.isInvincible) return false;
    this.hp = Math.max(0, this.hp - damage);
    this.hurtTimer = CONFIG.player.hurtInvincible;
    const d = Utils.normalize(this.x - fromX, this.z - fromZ);
    this.vx = d.x * push;
    this.vz = d.y * push;
    this.attackTimer = 0;
    this.trail = [];
    if (this.hp <= 0) this.dead = true;
    return true;
  }

  forward() {
    const cp = Math.cos(this.pitch);
    return [Math.cos(this.yaw) * cp, Math.sin(this.pitch), Math.sin(this.yaw) * cp];
  }

  update(dt, time) {
    const c = CONFIG.player;
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.attackBuffer = Math.max(0, this.attackBuffer - dt);
    this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.cool.spin = Math.max(0, this.cool.spin - dt);
    this.cool.wave = Math.max(0, this.cool.wave - dt);
    this.cool.dash = Math.max(0, this.cool.dash - dt);
    this.dashAfter = Math.max(0, this.dashAfter - dt);
    this.spinTimer = Math.max(0, this.spinTimer - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.ult < 100) this.chargeUlt((CONFIG.skills.ultimate.chargePerSecond * dt) / CONFIG.skills.ultimate.chargePerDamage);

    if (this.dead) {   // 쓰러짐: 미끄러지다 멈춤
      this.vx *= 0.9;
      this.vz *= 0.9;
      World.moveEntity(this, this.vx * dt, this.vz * dt);
      this.attackTimer = this.dodgeTimer = 0;
      this.bobAmount = this.roll = this.fovKick = 0;
      this.trail = [];
      return;
    }

    // 시점: 마우스 또는 방향키 ←/→
    let turn = 0;
    if (Input.isDown('ArrowLeft')) turn -= 1;
    if (Input.isDown('ArrowRight')) turn += 1;
    const dYaw = Utils.rad(turn * c.turnSpeed * dt + Input.mouseDX * c.mouseSensitivity);
    const dPitch = -Utils.rad(Input.mouseDY * c.mouseSensitivity);
    this.yaw += dYaw;
    this.pitch = Utils.clamp(this.pitch + dPitch, Camera.isFirst ? -1.2 : -0.9, Camera.isFirst ? 1.2 : 0.6);
    const lagK = Math.min(1, dt * 10), safeDt = Math.max(dt, 0.001);
    this.lagX += (Utils.clamp((-dYaw / safeDt) * 0.012, -0.05, 0.05) - this.lagX) * lagK;
    this.lagY += (Utils.clamp((-dPitch / safeDt) * 0.012, -0.05, 0.05) - this.lagY) * lagK;

    // 이동 입력: 앞뒤(fwd)와 옆걸음(side)
    let fwd = 0, side = 0;
    if (Input.isDown('KeyW', 'ArrowUp')) fwd += 1;
    if (Input.isDown('KeyS', 'ArrowDown')) fwd -= 1;
    if (Input.isDown('KeyD')) side += 1;
    if (Input.isDown('KeyA')) side -= 1;
    const cos = Math.cos(this.yaw), sin = Math.sin(this.yaw);
    const dir = Utils.normalize(cos * fwd - sin * side, sin * fwd + cos * side);

    // 궁극기 시전 중: 제자리에 서서 검을 하늘로 (움직일 수 없음)
    if (this.castTimer > 0) {
      this.castTimer -= dt;
      this.vx *= 0.85;
      this.vz *= 0.85;
      World.moveEntity(this, this.vx * dt, this.vz * dt);
      this.bobAmount = 0;
      this.updateTrail(time);
      return;
    }

    // F 섬광 돌진 중: 바라보는 쪽으로 쏘아져 나가며 지나치는 적을 기록 (한 박자 뒤에 베임)
    const S = CONFIG.skills;
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      const sp = S.dash.distance / S.dash.time, bx = this.x, bz = this.z;
      this.vx = Math.cos(this.facing) * sp;
      this.vz = Math.sin(this.facing) * sp;
      World.moveEntity(this, this.vx * dt, this.vz * dt);
      this.groundY += (World.groundHeight(this.x, this.z) - this.groundY) * Math.min(1, dt * 20);
      Skills.dashSweep(this, bx, bz);
      if (this.dashTimer <= 0) {   // 도착: 칼을 옆으로 뻗고 멈춤 → 잠시 뒤 지나온 길이 베임
        this.dashTimer = 0;
        this.dashAfter = 0.5;
        this.vx *= 0.12;
        this.vz *= 0.12;
        Skills.dashEnd(this);
      }
      this.bobAmount = 0;
      this.fovKick += (16 - this.fovKick) * Math.min(1, dt * 20);
      this.updateTrail(time);
      return;
    }

    // 무기 바꾸기: 1 발뭉, 2 레바테인, 3 아스트라페
    for (let i = 0; i < WEAPONS.length; i++) {
      if (Input.wasPressed('Digit' + (i + 1), 'Numpad' + (i + 1)) && !this.isDodging) Weapons.equip(i, this);
    }

    // 스킬: R 궁극기, Q 회전베기, E 검기, F 섬광 돌진
    if (Input.wasPressed('KeyF') && this.cool.dash <= 0 && !this.isDodging) {
      this.cool.dash = S.dash.cooldown;
      if (!Camera.isFirst) this.facing = this.yaw;
      this.dashTimer = S.dash.time;
      this.dashFrom = { x: this.x, z: this.z, y: this.groundY };
      this.dashHit = new Set();
      this.attackTimer = this.spinTimer = 0;
      this.trail = [];
      Particles.dust(this.x, this.groundY, this.z, 8, 0.6);   // 땅을 박차는 흙먼지
      Camera.shake = Math.max(Camera.shake, 0.15);
      return;
    }
    if (Input.wasPressed('KeyR') && this.ult >= 100 && !this.isDodging) {
      this.ult = 0;
      this.castTimer = S.ultimate.castTime + 0.9;
      this.attackTimer = this.spinTimer = 0;
      this.trail = [];
      Skills.castUltimate(this);
      return;
    }
    if (Input.wasPressed('KeyQ') && this.cool.spin <= 0 && !this.isDodging) {
      this.cool.spin = S.spin.cooldown;
      this.spinTimer = S.spin.time;
      this.spinId++;
      this.attackTimer = 0;
      for (let i = 0; i < 12; i++) {   // 발밑에서 둥글게 일어나는 흙먼지
        const a = (i / 12) * Math.PI * 2;
        Particles.dust(this.x + Math.cos(a) * 1.3, this.groundY, this.z + Math.sin(a) * 1.3, 1, 0.3);
      }
    }
    if (Input.wasPressed('KeyE') && this.cool.wave <= 0 && !this.isDodging) {
      this.cool.wave = S.wave.cooldown;
      if (!Camera.isFirst) this.facing = this.yaw;
      Skills.castWave(this);
      this.attackTimer = c.attackTime;   // 검을 휘두르는 동작과 함께
      this.attackCooldown = c.attackCooldown;
      this.swingId++;
      this.combo = 0;
      this.comboTimer = 0;
    }
    if (this.spinTimer > 0) Enemies.hitRadius(this, S.spin.radius, S.spin.damage, this.spinId);

    if (Input.wasPressed('Space', 'Mouse0')) this.attackBuffer = 0.3;   // 휘두르는 중에 미리 눌러도 다음 콤보로 이어짐

    // 회피 시작 (Shift): 누르고 있는 방향으로, 방향키를 안 누르면 뒤로
    if (Input.wasPressed('ShiftLeft', 'ShiftRight') && this.dodgeCooldown <= 0 && !this.isDodging) {
      this.dodgeDir = fwd || side ? dir : { x: -cos, y: -sin };
      this.dodgeTimer = c.dodgeTime;
      this.dodgeCooldown = c.dodgeCooldown;
      this.attackTimer = 0;
      this.trail = [];
    }

    // 공격 시작 (클릭 또는 스페이스)
    if (!this.isDodging && this.attackBuffer > 0 && this.attackCooldown <= 0) {
      this.attackBuffer = 0;
      this.attackTimer = c.attackTime;
      this.attackCooldown = c.attackCooldown;
      this.swingId++;
      this.combo = this.comboTimer > 0 ? (this.combo + 1) % 3 : 0;   // 이어서 누르면 다음 콤보 동작
      this.comboTimer = c.attackCooldown + c.comboWindow;
      this.impactDone = false;
      if (!Camera.isFirst) this.facing = this.yaw;   // 3인칭: 카메라가 보는 쪽으로 바로 돌아서서 벰
      const step = this.combo === 2 ? 7 : 4;          // 벨 때 한 걸음 내디딤 (내려찍기는 크게)
      this.vx += Math.cos(this.facing) * step;
      this.vz += Math.sin(this.facing) * step;
    }
    // 칼날이 지나가는 순간에 닿은 적은 맞음
    if (this.isAttacking) {
      const t = 1 - this.attackTimer / c.attackTime;
      if (t > 0.25 && t < 0.8) Enemies.hitArc(this, this.swingId);
      // 내려찍기가 땅에 닿는 순간: 흙먼지 + 불꽃 + 화면 흔들림 + 무기 속성 폭발 (빛의 기둥 / 불기둥 / 낙뢰)
      if (this.combo === 2 && t > 0.7 && !this.impactDone) {
        this.impactDone = true;
        const fx = this.x + Math.cos(this.facing - 0.3) * 1.5, fz = this.z + Math.sin(this.facing - 0.3) * 1.5, gy = World.groundHeight(fx, fz);
        Particles.dust(fx, gy, fz, 10, 0.8);
        Particles.sparks(fx, gy + 0.1, fz, 14, Weapons.cur.spark);
        Camera.shake = Math.max(Camera.shake, 0.3);
        const bx = fx + Math.cos(this.facing) * 0.6, bz = fz + Math.sin(this.facing) * 0.6;   // 폭발은 조금 더 앞에서 (뒤에서 볼 때 몸에 가려지지 않게)
        Skills.burst(bx, World.groundHeight(bx, bz), bz, this);
      }
    }

    // 속도: 회피 중엔 회피 방향으로 빠르게, 아니면 입력 방향으로 부드럽게 가속·감속
    if (this.isDodging) {
      this.vx = this.dodgeDir.x * c.dodgeSpeed;
      this.vz = this.dodgeDir.y * c.dodgeSpeed;
    } else {
      const spd = c.moveSpeed * (this.isAttacking ? 0.5 : this.spinTimer > 0 ? 0.6 : 1);
      const a = Math.min(1, dt * 12);
      this.vx += (dir.x * spd - this.vx) * a;
      this.vz += (dir.y * spd - this.vz) * a;
    }
    World.moveEntity(this, this.vx * dt, this.vz * dt);
    this.groundY += (World.groundHeight(this.x, this.z) - this.groundY) * Math.min(1, dt * 12);

    // 걸음에 따른 흔들림
    const speed = Math.hypot(this.vx, this.vz);
    if (!this.isDodging) this.bobPhase += speed * dt * 1.4;
    this.bobAmount += ((speed > 0.5 && !this.isDodging ? 1 : 0) - this.bobAmount) * Math.min(1, dt * 8);

    // 회피 연출: 피하는 쪽으로 화면 기울임 + 시야 살짝 넓어짐
    let rollTarget = 0, fovTarget = 0;
    if (this.isDodging) {
      const p = Math.sin((1 - this.dodgeTimer / c.dodgeTime) * Math.PI);
      rollTarget = (-this.dodgeDir.x * sin + this.dodgeDir.y * cos) * 0.06 * p;
      fovTarget = 8 * p;
    }
    if (!Camera.isFirst) fovTarget += Math.min(1, speed / c.moveSpeed) * 4;   // 3인칭: 달리면 시야가 살짝 넓어져 속도감
    this.roll += (rollTarget - this.roll) * Math.min(1, dt * 20);
    this.fovKick += (fovTarget - this.fovKick) * Math.min(1, dt * 15);

    // 몸이 바라보는 방향: 1인칭은 시점과 같고, 3인칭은 움직이는 쪽 (공격할 땐 카메라가 보는 쪽)
    if (Camera.isFirst) {
      this.facing = this.yaw;
    } else {
      let target = null;
      if (this.isDodging) target = Math.atan2(this.dodgeDir.y, this.dodgeDir.x);
      else if (this.isAttacking) target = this.yaw;
      else if (fwd || side) target = Math.atan2(dir.y, dir.x);
      if (target !== null) {
        const diff = Math.atan2(Math.sin(target - this.facing), Math.cos(target - this.facing));
        this.facing += diff * Math.min(1, dt * (this.isDodging || this.isAttacking ? 25 : 10));
      }
    }

    this.updateTrail(time);
  }

  // 지금 검 자세 (평소 → 뒤로 젖힘 → 빠르게 벰 → 천천히 제자리)
  swordPose() {
    const c = CONFIG.player;
    const recover = c.attackCooldown - c.attackTime;
    if (this.castTimer > 0) return { x: 0.12, y: -0.25, z: -0.6, yaw: 0, pitch: 0.15, roll: 0 };   // 궁극기: 검을 곧게 세워 하늘로
    const [ready, end] = POSE_COMBO[this.combo];
    if (this.attackTimer > 0) {
      const p = 1 - this.attackTimer / c.attackTime;
      if (p < 0.25) return mixPose(POSE_IDLE, ready, Utils.smooth(p / 0.25));
      return mixPose(ready, end, 1 - Math.pow(1 - (p - 0.25) / 0.75, 2));
    }
    if (this.attackCooldown > 0 && recover > 0) {
      return mixPose(POSE_IDLE, end, Utils.smooth(this.attackCooldown / recover));
    }
    return POSE_IDLE;
  }

  // 검의 위치·방향 행렬 (카메라 기준)
  swordMatrix() {
    const p = this.swordPose();
    const sway = Math.sin(this.bobPhase) * 0.012 * this.bobAmount;
    const bobY = Math.abs(Math.cos(this.bobPhase)) * 0.015 * this.bobAmount;
    const drop = this.isDodging ? 0.08 : 0;
    return M4.chain(
      M4.translation(p.x + sway + this.lagX, p.y - bobY - drop + this.lagY, p.z),
      M4.rotationY(p.yaw), M4.rotationX(p.pitch), M4.rotationZ(p.roll));
  }

  // 팔 행렬: 손목에서 어깨까지 팔 모델을 늘여서 이음 (카메라 기준)
  armMatrix(swordM) {
    const wrist = M4.transformPoint(swordM, [0, -0.06, 0.05]);
    const d = V3.sub(SHOULDER, wrist);
    const len = Math.hypot(d[0], d[1], d[2]);
    const y = V3.scale(d, 1 / len);
    const z = V3.normalize(V3.cross([1, 0, 0], y));
    const x = V3.cross(y, z);
    return new Float32Array([x[0], x[1], x[2], 0, y[0] * len, y[1] * len, y[2] * len, 0, z[0], z[1], z[2], 0, wrist[0], wrist[1], wrist[2], 1]);
  }

  // 휘두르는 동안 칼날 위치를 기록 → 자취로 그림
  updateTrail(time) {
    this.trail = this.trail.filter((s) => time - s.t < 0.1);
    if (this.attackTimer > 0 && 1 - this.attackTimer / CONFIG.player.attackTime > 0.22) {
      const m = this.swordMatrix();
      this.trail.push({ t: time, base: M4.transformPoint(m, [0, 0.3, 0]), tip: M4.transformPoint(m, [0, Weapons.cur.length, 0]) });
    }
  }
}
