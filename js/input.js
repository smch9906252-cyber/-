// 키보드 입력 처리
// e.code(키보드 위치 기준 이름)를 써서 한글 입력 상태에서도 WASD가 동작합니다.
const Input = {
  down: {},     // 지금 누르고 있는 키
  pressed: {},  // 이번 프레임에 새로 누른 키 (마우스 왼쪽 클릭은 'Mouse0')
  mouseDX: 0,   // 이번 프레임에 마우스가 좌우로 움직인 양
  mouseDY: 0,   // 이번 프레임에 마우스가 위아래로 움직인 양
  locked: false,// 마우스가 게임 화면에 고정되어 있는지
  lockFailed: false, // 마우스 고정이 막힌 환경(일부 앱·웹 창 안): 오른쪽 버튼을 누른 채 끌어서 둘러봄
  dragging: false,
  stickX: 0,    // 터치 조이스틱 기울기 (-1 ~ 1, 오른쪽 +) — touch.js가 채움
  stickY: 0,    // (-1 ~ 1, 앞 +)

  init(canvas) {
    const blockKeys = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    window.addEventListener('keydown', (e) => {
      if (blockKeys.includes(e.code)) e.preventDefault(); // 페이지 스크롤 방지
      if (!this.down[e.code]) this.pressed[e.code] = true;
      this.down[e.code] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.down[e.code] = false;
    });
    // 창을 벗어나면 키가 눌린 채로 남지 않게 초기화
    window.addEventListener('blur', () => {
      this.down = {};
      this.pressed = {};
      this.dragging = false;
    });

    // 화면을 클릭하면 마우스를 고정해서 시점 회전에 사용 (Esc로 해제)
    // 고정이 안 되는 곳에서는 오른쪽 버튼을 누른 채 끌어서 둘러보고, 왼쪽 클릭으로 공격
    canvas.addEventListener('click', (e) => {
      const r = canvas.getBoundingClientRect(), k = canvas.width / r.width;
      if (!this.locked && UI.restartAt((e.clientX - r.left) * k, (e.clientY - r.top) * k)) {   // '처음부터' 버튼
        Game.restart();
        return;
      }
      if (this.locked || this.lockFailed) return;
      try {
        const r = canvas.requestPointerLock();
        if (r && r.catch) r.catch(() => { this.lockFailed = true; });
      } catch (e) {
        this.lockFailed = true;
      }
    });
    document.addEventListener('pointerlockerror', () => { this.lockFailed = true; });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked && !this.dragging) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    canvas.addEventListener('mousedown', (e) => {
      const r = canvas.getBoundingClientRect(), k = canvas.width / r.width;
      if (UI.restartAt((e.clientX - r.left) * k, (e.clientY - r.top) * k)) return;   // 버튼을 누른 것은 공격이 아님
      if (e.button === 0 && (this.locked || this.lockFailed)) this.pressed.Mouse0 = true;
      if (e.button === 2 && !this.locked) this.dragging = true;
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 2) this.dragging = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());   // 오른쪽 버튼 메뉴가 뜨지 않게
  },

  // 주어진 키 중 하나라도 누르고 있으면 true
  isDown(...codes) {
    return codes.some((c) => this.down[c]);
  },

  // 주어진 키 중 하나라도 이번 프레임에 새로 눌렀으면 true
  wasPressed(...codes) {
    return codes.some((c) => this.pressed[c]);
  },

  // 프레임 끝에 호출: '새로 누름'과 마우스 이동 기록을 지움
  endFrame() {
    this.pressed = {};
    this.mouseDX = 0;
    this.mouseDY = 0;
  },
};
