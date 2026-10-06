// 터치 조작 (휴대폰·태블릿)
// 왼쪽 화면을 누른 채 움직이면 이동 조이스틱, 오른쪽 화면을 끌면 시점, 오른쪽 아래 버튼으로 공격·구르기·스킬.
// 손가락 입력을 키보드·마우스 입력(Input)으로 바꿔 넣기 때문에 나머지 코드는 키보드로 할 때와 똑같이 동작합니다.

// 버튼 → 대신 눌러 줄 키
const TOUCH_KEYS = { attack: 'Mouse0', dodge: 'ShiftLeft', spin: 'KeyQ', wave: 'KeyE', dash: 'KeyF', ult: 'KeyR', view: 'KeyV', sound: 'KeyM' };

const TouchControls = {
  active: false,     // 터치 화면 모드: 화면을 처음 만지면 켜지고, 키보드를 쓰면 꺼짐
  stick: null,       // 이동 조이스틱 { id(손가락 번호), ox, oy(조이스틱 가운데), x, y(지금 손가락) } — HUD 캔버스 픽셀
  look: null,        // 시점 끌기 { id, x, y }
  held: {},          // 누르고 있는 버튼 이름 → 손가락 번호
  buttons: [],       // 버튼 배치 [{ id, x, y, r }] (layout에서 계산)
  stickHome: [0, 0], // 손을 뗐을 때 조이스틱이 흐리게 보이는 자리
  stickR: 60,        // 조이스틱을 끝까지 기울이는 거리
  weaponHit: null,   // 무기 판 자리 (UI.drawWeapon이 그리면서 알려 줌) { x, y, w, h, slots: [{ x, y, r }] }
  portraitOK: false, // 세로 화면 안내를 닫았는지
  k: 1,              // 화면(CSS) 1픽셀 = HUD 캔버스 몇 픽셀

  init(canvas) {
    this.canvas = canvas;
    const opt = { passive: false };   // 기본 동작(스크롤·확대·마우스 흉내)을 막으려면 passive가 아니어야 함
    canvas.addEventListener('touchstart', (e) => this.onStart(e), opt);
    canvas.addEventListener('touchmove', (e) => this.onMove(e), opt);
    canvas.addEventListener('touchend', (e) => this.onEnd(e), opt);
    canvas.addEventListener('touchcancel', (e) => this.onEnd(e), opt);
    window.addEventListener('keydown', () => { this.active = false; });   // 키보드를 쓰면 원래 화면으로
    window.addEventListener('blur', () => this.release());
  },

  // 버튼 배치 (s: 화면 크기 배율). 공격 버튼을 오른손 엄지 자리에 두고 나머지를 그 둘레에 부채꼴로
  layout(W, H, s) {
    const ax = W - 92 * s, ay = H - 88 * s;
    const ring = (id, deg, dist, r) => ({ id, x: ax + Math.cos(Utils.rad(deg)) * dist * s, y: ay + Math.sin(Utils.rad(deg)) * dist * s, r: r * s });
    this.buttons = [
      { id: 'attack', x: ax, y: ay, r: 46 * s },
      ring('dodge', 172, 100, 27),
      ring('spin', 212, 100, 27),
      ring('wave', 250, 100, 27),
      ring('dash', 288, 100, 27),
      ring('ult', 236, 176, 33),
      { id: 'view', x: W - 32 * s, y: 32 * s, r: 19 * s },
      { id: 'sound', x: W - 80 * s, y: 32 * s, r: 19 * s },
    ];
    if (document.fullscreenEnabled) this.buttons.push({ id: 'fullscreen', x: W - 128 * s, y: 32 * s, r: 19 * s });
    this.stickHome = [112 * s, H - 104 * s];
    this.stickR = 58 * s;
  },

  button(id) {
    return this.buttons.find((b) => b.id === id);
  },

  // 화면 좌표 → HUD 캔버스 픽셀
  pos(t) {
    const r = this.canvas.getBoundingClientRect();
    this.k = this.canvas.width / r.width;
    return [(t.clientX - r.left) * this.k, (t.clientY - r.top) * this.k];
  },

  // (x, y)에 있는 버튼 (손가락이 조금 빗나가도 눌리게 1.25배 넓게, 겹치면 가까운 것)
  buttonAt(x, y) {
    let best = null, bestD = Infinity;
    for (const b of this.buttons) {
      const d = Math.hypot(x - b.x, y - b.y) / b.r;
      if (d < 1.25 && d < bestD) { best = b; bestD = d; }
    }
    return best;
  },

  // 무기 판을 누르면: 칸을 정확히 누르면 그 무기, 판의 다른 곳이면 다음 무기
  weaponAt(x, y) {
    const w = this.weaponHit;
    if (!w || x < w.x || x > w.x + w.w || y < w.y || y > w.y + w.h) return -1;
    const i = w.slots.findIndex((sl) => Math.hypot(x - sl.x, y - sl.y) < sl.r * 1.5);
    return i >= 0 ? i : (Weapons.index + 1) % WEAPONS.length;
  },

  onStart(e) {
    e.preventDefault();
    this.active = true;
    const W = this.canvas.width, H = this.canvas.height;
    for (const t of e.changedTouches) {
      const [x, y] = this.pos(t), id = t.identifier;
      if (H > W && !this.portraitOK) {   // 세로 화면 안내: 아무 데나 누르면 닫힘
        this.portraitOK = true;
        continue;
      }
      const b = this.buttonAt(x, y);
      if (b) {
        this.held[b.id] = { id, x, y, sx: x, sy: y, drag: false };
        if (b.id === 'fullscreen') this.toggleFullscreen();
        else Input.pressed[TOUCH_KEYS[b.id]] = true;
        if (b.id === 'attack') Input.down.TouchAttack = true;   // 누르고 있으면 연속 공격 (player.js)
        continue;
      }
      const wi = this.weaponAt(x, y);
      if (wi >= 0) {
        Input.pressed['Digit' + (wi + 1)] = true;
        continue;
      }
      if (!this.stick && x < W * 0.45) {
        this.stick = { id, ox: x, oy: y, x, y };
      } else if (!this.look) {
        this.look = { id, x, y };
      }
    }
    this.updateStick();
  },

  onMove(e) {
    e.preventDefault();
    const turn = CONFIG.player.touchSensitivity / CONFIG.player.mouseSensitivity;
    for (const t of e.changedTouches) {
      const [x, y] = this.pos(t), id = t.identifier;
      if (this.stick && this.stick.id === id) {
        this.stick.x = x;
        this.stick.y = y;
      } else if (this.look && this.look.id === id) {
        Input.mouseDX += ((x - this.look.x) / this.k) * turn;
        Input.mouseDY += ((y - this.look.y) / this.k) * turn;
        this.look.x = x;
        this.look.y = y;
      } else {
        // 공격 버튼을 누른 채 손가락을 밀면 베면서 시점도 돌림
        const h = this.held.attack;
        if (h && h.id === id) {
          if (!h.drag && Math.hypot(x - h.sx, y - h.sy) > 14 * this.k) h.drag = true;
          if (h.drag) {
            Input.mouseDX += ((x - h.x) / this.k) * turn;
            Input.mouseDY += ((y - h.y) / this.k) * turn;
          }
          h.x = x;
          h.y = y;
        }
      }
    }
    this.updateStick();
  },

  onEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const id = t.identifier;
      if (this.stick && this.stick.id === id) this.stick = null;
      if (this.look && this.look.id === id) this.look = null;
      for (const name in this.held) {
        if (this.held[name].id !== id) continue;
        delete this.held[name];
        if (name === 'attack') Input.down.TouchAttack = false;
      }
    }
    this.updateStick();
  },

  // 창을 벗어나면 모두 뗀 것으로
  release() {
    this.stick = this.look = null;
    this.held = {};
    Input.down.TouchAttack = false;
    this.updateStick();
  },

  // 조이스틱 기울기 → Input.stickX(오른쪽 +), Input.stickY(앞 +)
  updateStick() {
    const s = this.stick;
    if (!s) {
      Input.stickX = Input.stickY = 0;
      return;
    }
    let dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy);
    const R = this.stickR;
    if (d > R) {   // 손가락이 멀리 가면 조이스틱 가운데가 따라옴 (되돌릴 때 바로 반응하게)
      s.ox = s.x - (dx / d) * R;
      s.oy = s.y - (dy / d) * R;
      dx = s.x - s.ox;
      dy = s.y - s.oy;
      d = R;
    }
    const dead = 0.12;   // 살짝 닿은 정도는 무시
    const m = Utils.clamp((d / R - dead) / (1 - dead), 0, 1);
    Input.stickX = d > 0 ? (dx / d) * m : 0;
    Input.stickY = d > 0 ? (-dy / d) * m : 0;
  },

  toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    const el = document.documentElement;
    if (!el.requestFullscreen) return;
    el.requestFullscreen({ navigationUI: 'hide' }).then(() => {
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});   // 가로로 고정 (되는 기기만)
    }).catch(() => {});
  },

  // 조준 보조 (터치 + 3인칭): 카메라가 보는 쪽 ±coneDeg 안, range m 안에서 가장 가까운 적 쪽 각도. 없으면 null
  // 손가락으로 정확히 겨누기 어려우니 칼질·검기·돌진이 가까운 적을 향하게 함
  aim(p, range, coneDeg) {
    if (!this.active || Camera.isFirst) return null;
    let best = null, bestScore = Infinity;
    for (const e of Enemies.list) {
      if (e.dead) continue;
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
      if (d > range + e.radius) continue;
      const a = Math.atan2(dz, dx), diff = Math.abs(Math.atan2(Math.sin(a - p.yaw), Math.cos(a - p.yaw)));
      if (diff > Utils.rad(coneDeg)) continue;
      const score = d + diff * 2;   // 가깝고 정면에 가까울수록
      if (score < bestScore) {
        bestScore = score;
        best = a;
      }
    }
    return best;
  },
};
