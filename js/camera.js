// 카메라: 1인칭(전사의 눈) / 3인칭(전사 뒤 어깨 너머). V 키로 전환
const Camera = {
  mode: 'third',       // 'first' 또는 'third'
  eye: [0, 0, 0],      // 카메라 위치
  look: [0, 0, 1],     // 바라보는 점
  dist: 0,             // 3인칭에서 지금 카메라 거리 (벽에 막히면 줄어듦)
  shake: 0,            // 화면 흔들림 세기 (번개·검기 등, 시간이 지나면 줄어듦)
  cine: 0,             // 궁극기 연출 카메라로 옮겨 간 정도 (0~1)

  init() {
    this.mode = CONFIG.camera.startView === 'first' ? 'first' : 'third';
    this.dist = CONFIG.camera.distance;
  },

  toggle() {
    this.mode = this.mode === 'first' ? 'third' : 'first';
    this.dist = CONFIG.camera.distance;
  },

  get isFirst() { return this.mode === 'first'; },

  update(player, dt) {
    this.place(player, dt);
    // 궁극기를 모으는 동안: 용사 앞쪽 낮은 곳에서 올려다보는 연출 카메라 → 발사하면 원래 자리로 돌아옴 (3인칭만)
    const u = Skills.ult, casting = u && !u.fired && !this.isFirst && !player.dead;
    this.cine = Utils.clamp(this.cine + (casting ? dt * 3.5 : -dt * 2.2), 0, 1);
    if (this.cine > 0) {
      const k = Utils.smooth(this.cine), a = player.facing + 0.8, r = 2.9 - 0.4 * (u ? Math.min(1, u.t / 1.2) : 1);   // 모을수록 살짝 다가감
      const eye = [player.x + Math.cos(a) * r, player.groundY + 0.75, player.z + Math.sin(a) * r];
      const look = [player.x - Math.cos(a) * 0.3, player.groundY + 1.75, player.z - Math.sin(a) * 0.3];
      this.eye = this.eye.map((v, i) => Utils.lerp(v, eye[i], k));
      this.look = this.look.map((v, i) => Utils.lerp(v, look[i], k));
    }
    if (this.shake > 0) {   // 흔들림: 카메라 위치를 조금씩 무작위로 옮김
      const k = this.shake * 0.25;
      const o = [(Math.random() - 0.5) * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k];
      this.eye = V3.add(this.eye, o);
      this.look = V3.add(this.look, o);
      this.shake = Math.max(0, this.shake - dt * 1.6);
    }
  },

  place(player, dt) {
    const f = player.forward();
    if (this.isFirst) {
      this.eye = player.eye();
      this.look = V3.add(this.eye, f);
      return;
    }
    const c = CONFIG.camera;
    const right = [-Math.sin(player.yaw), 0, Math.cos(player.yaw)];
    const pivot = [player.x + right[0] * c.shoulder, player.groundY + c.height, player.z + right[2] * c.shoulder];
    // 카메라를 뒤로 조금씩 물려 보다가 나무·숲·땅(동굴에선 천장)에 막히면 그 앞에서 멈춤
    let d = 0;
    while (d < c.distance) {
      const nd = d + 0.1;
      const px = pivot[0] - f[0] * nd, py = pivot[1] - f[1] * nd, pz = pivot[2] - f[2] * nd;
      if (World.blocked(px, pz, 0.25, true) || py < World.groundHeight(px, pz) + 0.3 || py > World.ceilAt(px, pz) - 0.6) break;
      d = nd;
    }
    // 가까워질 땐 바로, 멀어질 땐 천천히 (덜컹거리지 않게)
    this.dist = d < this.dist ? d : this.dist + (d - this.dist) * Math.min(1, dt * 4);
    this.eye = V3.sub(pivot, V3.scale(f, this.dist));
    this.look = V3.add(this.eye, f);
  },
};
