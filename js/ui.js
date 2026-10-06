// 화면 위 글자와 상태 표시(HUD): 3D 화면 위에 겹친 2D 캔버스에 그림
const UI = {
  canvas: null,
  g: null,
  s: 1,            // 글자·막대 크기 배율 (화면 크기에 맞춤)
  sBase: 1,        // 키보드·마우스일 때 배율
  sTouch: 1,       // 터치 화면일 때 배율 (손가락으로 누르기 좋게 더 큼)
  vignette: null,

  init(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
  },

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.sBase = Math.min(w / 1280, h / 720);
    const dpr = w / Math.max(1, window.innerWidth), css = Math.min(window.innerWidth, window.innerHeight);
    this.sTouch = Math.max(this.sBase, dpr * Utils.clamp(css / 400, 0.75, 1.15) * 0.82);   // 휴대폰에서도 글자가 읽히고 버튼이 손가락만 하게
    this.s = TouchControls.active ? this.sTouch : this.sBase;
    this.vignette = null;
    TouchControls.layout(w, h, this.sTouch);
  },

  font(px) {
    return `bold ${Math.round(px * this.s)}px "Malgun Gothic", "맑은 고딕", sans-serif`;
  },

  // 그림자가 있는 글자
  text(str, x, y, px, color, align = 'left', alpha = 1) {
    const g = this.g;
    g.save();
    g.globalAlpha = alpha;
    g.font = this.font(px);
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0, 0, 0, 0.85)';
    g.shadowBlur = 6 * this.s;
    g.shadowOffsetY = 2 * this.s;
    g.fillStyle = color;
    g.fillText(str, x, y);
    g.restore();
  },

  roundRect(x, y, w, h, r) {
    const g = this.g;
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  },

  draw(player, levelTime, level) {
    this.s = TouchControls.active ? this.sTouch : this.sBase;
    const g = this.g, W = this.canvas.width, H = this.canvas.height, s = this.s;
    g.clearRect(0, 0, W, H);

    this.drawDamageOverlay(player);
    this.drawSpeedLines(player);
    this.drawUltCutIn();
    this.drawEnemyMarks(player);
    this.drawPopups();
    this.drawBossBar();
    if (Camera.cine < 0.4) {   // 궁극기 연출 중에는 상태 표시를 숨겨 화면을 넓게
      this.drawExitMarker(player);
      const left = Enemies.remaining, leftText = left > 0 ? `남은 적 ${left}` : '출구가 열렸다!', leftColor = left > 0 ? '#ffffff' : '#ffe08a';
      if (TouchControls.active) {   // 터치: 상태 표시는 위쪽에 모으고 아래는 조이스틱·버튼 자리로
        const R = 50 * s, mx = 18 * s + R, panelX = mx + R + 16 * s;
        this.drawMinimap(player, R, mx, mx);
        this.drawHealth(player, panelX + 58 * s, 52 * s, 190 * s);
        this.drawWeapon(player, panelX, 92 * s, true);
        this.drawTouch(player);
        if (W > H) this.text(leftText, W - (TouchControls.button('fullscreen') ? 160 : 112) * s, 32 * s, 17, leftColor, 'right');
        else this.text(leftText, W - 16 * s, 76 * s, 17, leftColor, 'right');   // 세로 화면: 위 오른쪽 버튼 아래 (체력 판과 겹치지 않게)
      } else {
        this.drawMinimap(player);
        this.drawHealth(player, 92 * s, H - 70 * s);
        this.drawWeapon(player, 34 * s, H - 150 * s);
        this.drawSkills(player);
        this.text(leftText, W - 32 * s, 34 * s, 19, leftColor, 'right');
      }
    }

    if (Camera.isFirst) {   // 조준점 (1인칭만)
      g.fillStyle = 'rgba(255, 255, 255, 0.75)';
      g.beginPath();
      g.arc(W / 2, H / 2, 2.5 * s, 0, Math.PI * 2);
      g.fill();
    }

    this.drawTitle(level, levelTime);
    this.drawRestart(levelTime);
    this.drawHints(levelTime);
    this.drawMessage();

    // 잠깐 떴다 사라지는 알림 (예: 시점 전환)
    const age = performance.now() / 1000 - this.toastTime;
    if (age < 1.5) this.text(this.toastText, W / 2, H * 0.62, 22, '#ffffff', 'center', Math.min(1, (1.5 - age) * 3));

    if (player.dead) {   // 쓰러짐
      g.fillStyle = 'rgba(0, 0, 0, 0.45)';
      g.fillRect(0, 0, W, H);
      this.text('쓰러졌다…', W / 2, H * 0.44, 46, '#ff8a7a', 'center');
      this.text('잠시 후 이 구역을 처음부터 다시 시작합니다', W / 2, H * 0.44 + 52 * s, 18, '#ffffff', 'center', 0.85);
    }
    if (Game.fade > 0) {   // 구역을 옮길 때 어두워졌다 밝아짐
      g.fillStyle = `rgba(0, 0, 0, ${Game.fade})`;
      g.fillRect(0, 0, W, H);
    }
    if (TouchControls.active && H > W && !TouchControls.portraitOK) this.drawRotateHint();
  },

  // 3D 위치 → 화면 좌표 (카메라 뒤쪽이면 null)
  project(x, y, z) {
    const m = Renderer.vp;
    if (!m) return null;
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw < 0.05) return null;
    return [(cx / cw * 0.5 + 0.5) * this.canvas.width, (0.5 - (cy / cw) * 0.5) * this.canvas.height];
  },

  // 맞은 직후 화면 가장자리가 붉게, 체력이 적으면 붉게 두근두근
  drawDamageOverlay(player) {
    const g = this.g, W = this.canvas.width, H = this.canvas.height, c = CONFIG.player;
    const fresh = Utils.clamp((player.hurtTimer - (c.hurtInvincible - 0.35)) / 0.35, 0, 1);
    const low = player.hp / player.maxHp < 0.3 && !player.dead ? 0.22 + 0.13 * Math.sin(performance.now() / 200) : 0;
    const a = Math.max(fresh * 0.65, low);
    if (a <= 0.01) return;
    const grad = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    grad.addColorStop(0, 'rgba(190, 0, 0, 0)');
    grad.addColorStop(1, `rgba(190, 0, 0, ${a})`);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
  },

  // 섬광 돌진: 화면 가장자리에서 가운데로 모이는 집중선 (애니메이션의 속도감)
  drawSpeedLines(player) {
    const k = player.dashTimer > 0 ? 1 : Utils.clamp((player.dashAfter - 0.3) / 0.2, 0, 1);
    if (k <= 0) return;
    const g = this.g, W = this.canvas.width, H = this.canvas.height, cx = W / 2, cy = H / 2;
    const diag = Math.hypot(W, H) / 2;
    g.save();
    g.fillStyle = `rgba(255, 255, 255, ${0.45 * k})`;
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, r0 = diag * (0.42 + Math.random() * 0.3), w = (0.004 + Math.random() * 0.01);
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      g.lineTo(cx + Math.cos(a - w) * diag * 1.1, cy + Math.sin(a - w) * diag * 1.1);
      g.lineTo(cx + Math.cos(a + w) * diag * 1.1, cy + Math.sin(a + w) * diag * 1.1);
      g.closePath();
      g.fill();
    }
    g.restore();
  },

  // 궁극기 컷인: 위아래 검은 띠(영화 화면처럼) + 비스듬한 띠 위로 궁극기 이름이 미끄러져 들어옴
  drawUltCutIn() {
    const k = Utils.smooth(Camera.cine);
    if (k <= 0.01) return;
    const g = this.g, W = this.canvas.width, H = this.canvas.height, s = this.s;
    const u = Skills.ult, w = u ? u.pal : Weapons.cur;
    g.save();
    g.fillStyle = '#000';
    const bar = H * 0.1 * k;
    g.fillRect(0, 0, W, bar);
    g.fillRect(0, H - bar, W, bar);
    if (u && !u.fired) {
      const t = u.t, inK = Utils.smooth(t / 0.3), outK = Utils.clamp((CONFIG.skills.ultimate.castTime - t) / 0.15, 0, 1);
      const a = inK * outK, cy = H * 0.7, bh = 74 * s;
      g.globalAlpha = a;
      g.translate(0, cy);
      g.transform(1, -0.06, 0, 1, 0, 0);   // 살짝 비스듬히
      const grad = g.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.25, 'rgba(8, 6, 12, 0.78)');
      grad.addColorStop(0.75, 'rgba(8, 6, 12, 0.78)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = grad;
      g.fillRect(0, -bh / 2, W, bh);
      g.fillStyle = w.ui;   // 띠 위아래 속성 색 선
      g.fillRect(W * 0.12, -bh / 2, W * 0.76, 2 * s);
      g.fillRect(W * 0.12, bh / 2 - 2 * s, W * 0.76, 2 * s);
      g.globalAlpha = a * 0.35;   // 띠 안을 흐르는 가는 속도선
      for (let i = 0; i < 14; i++) {
        const y = (((i * 37) % 70) / 70 - 0.5) * bh * 0.8, x = ((t * 1800 * s + i * 211 * s) % (W * 1.2)) - W * 0.1;
        g.fillRect(x, y, 90 * s, 1.5 * s);
      }
      g.globalAlpha = a;
      const slide = (1 - inK) * -W * 0.25;   // 왼쪽에서 미끄러져 들어옴
      g.font = this.font(14);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = 'rgba(255, 240, 210, 0.85)';
      g.fillText(`궁극기 · ${w.name}`, W / 2 + slide * 0.6, -bh * 0.27);
      g.font = this.font(40);
      g.shadowColor = w.ui;
      g.shadowBlur = 18 * s;
      g.fillStyle = '#ffffff';
      g.fillText(w.ult, W / 2 + slide, bh * 0.12);
      g.shadowBlur = 0;
    }
    g.restore();
  },

  // 적 머리 위: 알아챘을 때 '!', 다쳤으면 체력 막대
  drawEnemyMarks(player) {
    const g = this.g, s = this.s;
    for (const e of Enemies.list) {
      if (e.dead || e.boss) continue;   // 보스는 화면 위 큰 체력 막대로
      const sp = this.project(e.x, e.groundY + e.markHeight, e.z);
      if (!sp) continue;
      if (e.alert > 0) {
        const pop = 1 + Math.max(0, e.alert - 0.6) * 3;
        this.text('!', sp[0], sp[1] - 24 * s, 34 * pop, '#ffd23a', 'center', Math.min(1, e.alert * 3));
      }
      const d = Math.hypot(e.x - player.x, e.z - player.z);
      if ((e.hpShow > 0 || e.hp < e.maxHp) && d < 30) {
        const w = 64 * s, h = 7 * s, x = sp[0] - w / 2, y = sp[1];
        g.fillStyle = 'rgba(10, 8, 6, 0.7)';
        this.roundRect(x - 2 * s, y - 2 * s, w + 4 * s, h + 4 * s, 3 * s);
        g.fill();
        g.fillStyle = '#e8452e';
        g.fillRect(x, y, w * Utils.clamp(e.hp / e.maxHp, 0, 1), h);
      }
    }
  },

  // 보스 체력 막대: 깨어난 뒤 화면 위 가운데 (터치 화면은 아래 가운데). 깎인 만큼 하얀 잔상이 천천히 따라 줄어듦
  drawBossBar() {
    const b = Enemies.boss;
    if (!b || b.state === 'sleep' || Camera.cine >= 0.4) return;
    const g = this.g, s = this.s, W = this.canvas.width, H = this.canvas.height;
    const fade = b.dead ? Utils.clamp(b.deathTimer / 0.7, 0, 1) : 1;
    if (fade <= 0) return;
    const w = Math.min(520 * s, W * (TouchControls.active ? 0.42 : 0.5)), h = 14 * s;
    const x = W / 2 - w / 2, y = TouchControls.active ? H - 62 * s : 78 * s;
    g.save();
    g.globalAlpha = fade;
    this.panel(x - 12 * s, y - 30 * s, w + 24 * s, h + 42 * s, 10 * s);
    this.text(b.phase === 2 ? '바위 골렘 · 분노' : '바위 골렘', W / 2, y - 14 * s, 15, b.phase === 2 ? '#ff9a7a' : '#f3e3c3', 'center', fade);
    g.fillStyle = 'rgba(40, 10, 10, 0.9)';
    this.roundRect(x, y, w, h, h / 2);
    g.fill();
    const lag = Utils.clamp(b.hpLag / b.maxHp, 0, 1), hp = Utils.clamp(b.hp / b.maxHp, 0, 1);
    g.fillStyle = 'rgba(255, 240, 220, 0.85)';
    if (lag > 0) {
      this.roundRect(x, y, Math.max(h, w * lag), h, h / 2);
      g.fill();
    }
    if (hp > 0) {
      const grad = g.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, b.phase === 2 ? '#ff9a50' : '#ff7a5a');
      grad.addColorStop(1, b.phase === 2 ? '#b8300c' : '#a3161a');
      g.fillStyle = grad;
      this.roundRect(x, y, Math.max(h, w * hp), h, h / 2);
      g.fill();
    }
    g.fillStyle = 'rgba(255, 255, 255, 0.6)';   // 절반 눈금 (분노하는 지점)
    g.fillRect(x + w / 2 - 1 * s, y + 2 * s, 2 * s, h - 4 * s);
    g.restore();
  },

  // 피해 숫자: 맞은 자리에서 위로 떠오르며 사라짐 (color를 주면 작은 색 숫자: 불탐·번개 튐)
  popups: [],
  damage(x, y, z, amount, color) {
    const ox = color ? (Math.random() - 0.5) * 0.6 : 0;   // 작은 숫자는 겹치지 않게 살짝 옆으로
    this.popups.push({ x: x + ox, y, z, text: String(amount), color, born: performance.now() / 1000 });
  },
  drawPopups() {
    const now = performance.now() / 1000;
    this.popups = this.popups.filter((p) => now - p.born < 0.9);
    for (const p of this.popups) {
      const t = now - p.born;
      const sp = this.project(p.x, p.y + t * 1.2, p.z);
      if (!sp) continue;
      const size = (p.color ? 20 : 28) * (t < 0.1 ? 1 + (0.1 - t) * 6 : 1);
      this.text(p.text, sp[0], sp[1], size, p.color || '#ffe25a', 'center', Math.min(1, (0.9 - t) * 3));
    }
  },

  // 출구가 열리면 위치 표시 (화면 밖이면 가장자리에 화살표)
  drawExitMarker(player) {
    if (!World.gateOpen || !World.gate) return;
    const g = this.g, W = this.canvas.width, H = this.canvas.height, s = this.s, gt = World.gate;
    const ang = Math.atan2(gt.z - player.z, gt.x - player.x);
    const diff = Math.atan2(Math.sin(ang - player.yaw), Math.cos(ang - player.yaw));
    let sp = Math.abs(diff) < Utils.rad(CONFIG.graphics.fov * 0.6) ? this.project(gt.x, gt.y + 4.4, gt.z) : null;
    const m = 50 * s;
    let edge = false;
    if (!sp) {
      sp = [diff < 0 ? m : W - m, H * 0.45];
      edge = true;
    }
    sp = [Utils.clamp(sp[0], m, W - m), Utils.clamp(sp[1], m, H - m)];
    const pulse = 1 + Math.sin(performance.now() / 250) * 0.12;
    g.save();
    g.translate(sp[0], sp[1]);
    g.shadowColor = 'rgba(255, 200, 80, 0.9)';
    g.shadowBlur = 14 * s;
    g.fillStyle = '#ffd56a';
    g.beginPath();
    if (edge) {   // 옆 화살표
      const dir = diff < 0 ? -1 : 1;
      g.moveTo(dir * 16 * s * pulse, 0);
      g.lineTo(-dir * 8 * s, -12 * s);
      g.lineTo(-dir * 8 * s, 12 * s);
    } else {      // 마름모
      const r = 11 * s * pulse;
      g.moveTo(0, -r); g.lineTo(r, 0); g.lineTo(0, r); g.lineTo(-r, 0);
    }
    g.closePath();
    g.fill();
    g.restore();
    this.text(`출구 ${Math.round(Math.hypot(gt.x - player.x, gt.z - player.z))}m`, sp[0], sp[1] + 26 * s, 15, '#ffe9b0', 'center');
  },

  // 화면 가운데 큰 알림 (예: 적을 모두 물리침)
  msg: null,
  message(title, sub) {
    this.msg = { title, sub, born: performance.now() / 1000 };
  },
  drawMessage() {
    if (!this.msg) return;
    const t = performance.now() / 1000 - this.msg.born;
    if (t > 4) {
      this.msg = null;
      return;
    }
    const a = Math.min(1, t * 3, (4 - t) * 1.5);
    const W = this.canvas.width, H = this.canvas.height, s = this.s;
    this.text(this.msg.title, W / 2, H * 0.36, 36, '#ffe08a', 'center', a);
    if (this.msg.sub) this.text(this.msg.sub, W / 2, H * 0.36 + 44 * s, 20, '#ffffff', 'center', a);
  },

  toastText: '',
  toastTime: -10,
  toast(msg) {
    this.toastText = msg;
    this.toastTime = performance.now() / 1000;
  },

  // 금테 두른 반투명 판
  panel(x, y, w, h, r) {
    const g = this.g, s = this.s;
    const grad = g.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, 'rgba(30, 26, 22, 0.72)');
    grad.addColorStop(1, 'rgba(10, 8, 6, 0.72)');
    g.fillStyle = grad;
    this.roundRect(x, y, w, h, r);
    g.fill();
    g.strokeStyle = 'rgba(232, 196, 120, 0.85)';
    g.lineWidth = 1.5 * s;
    g.stroke();
  },

  // 하트 모양
  heart(cx, cy, r, color) {
    const g = this.g;
    g.beginPath();
    g.moveTo(cx, cy + r * 0.9);
    g.bezierCurveTo(cx - r * 1.35, cy + r * 0.05, cx - r * 0.9, cy - r * 1.05, cx, cy - r * 0.38);
    g.bezierCurveTo(cx + r * 0.9, cy - r * 1.05, cx + r * 1.35, cy + r * 0.05, cx, cy + r * 0.9);
    g.closePath();
    g.fillStyle = color;
    g.fill();
    g.strokeStyle = '#f5d08a';
    g.lineWidth = 2 * this.s;
    g.stroke();
  },

  // 왼쪽 아래: 하트 + 체력 막대
  drawHealth(player, x, y, w = 290 * this.s) {
    const g = this.g, s = this.s, h = 16 * s;
    const ratio = Utils.clamp(player.hp / player.maxHp, 0, 1);
    this.panel(x - 58 * s, y - 34 * s, w + 76 * s, h + 50 * s, 10 * s);
    const beat = ratio < 0.3 ? 1 + Math.max(0, Math.sin(performance.now() / 160)) * 0.15 : 1;
    this.heart(x - 30 * s, y + h / 2 - 2 * s, 15 * s * beat, ratio < 0.3 ? '#ff3b30' : '#e8392e');
    this.text('체력', x, y - 16 * s, 14, '#f3e3c3');
    this.text(`${Math.ceil(player.hp)} / ${player.maxHp}`, x + w, y - 16 * s, 14, '#ffffff', 'right');
    g.fillStyle = 'rgba(60, 10, 10, 0.9)';
    this.roundRect(x, y, w, h, h / 2);
    g.fill();
    if (ratio > 0) {
      const grad = g.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, '#ff8a70');
      grad.addColorStop(0.5, '#e8392e');
      grad.addColorStop(1, '#a3161a');
      g.fillStyle = grad;
      this.roundRect(x, y, Math.max(h, w * ratio), h, h / 2);
      g.fill();
      g.fillStyle = 'rgba(255, 255, 255, 0.3)';
      g.fillRect(x + h / 2, y + 3 * s, Math.max(0, w * ratio - h), 3 * s);
    }
    g.strokeStyle = 'rgba(0, 0, 0, 0.35)';   // 10칸 눈금
    g.lineWidth = 1 * s;
    for (let i = 1; i < 10; i++) {
      g.beginPath();
      g.moveTo(x + (w * i) / 10, y + 2 * s);
      g.lineTo(x + (w * i) / 10, y + h - 2 * s);
      g.stroke();
    }
  },

  // 작은 무기 그림 (가운데 cx, cy / k: 크기 배율). 비스듬히 눕힌 검
  weaponIcon(id, cx, cy, k) {
    const g = this.g;
    g.save();
    g.translate(cx, cy);
    g.rotate(-0.78);
    g.scale(k, k);
    const glowDot = (x, y, r, color) => {
      g.save();
      g.fillStyle = color;
      g.shadowColor = color;
      g.shadowBlur = 6 * k;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.restore();
    };
    if (id === 'laevateinn') {   // 물결치는 검은 칼날 + 달궈진 주황 테두리 + 위로 휜 금 뿔
      g.beginPath();
      g.moveTo(-3.2, -4);
      for (let i = 1; i <= 6; i++) g.lineTo(-3.2 + i * 0.25 + (i % 2 ? 0.9 : -0.4), -4 - i * 2.3);
      g.lineTo(0, -20);
      for (let i = 6; i >= 1; i--) g.lineTo(3.2 - i * 0.25 + (i % 2 ? 0.9 : -0.4), -4 - i * 2.3);
      g.lineTo(3.2, -4);
      g.closePath();
      g.fillStyle = '#3a2a2e';
      g.shadowColor = '#ff6a1a';
      g.shadowBlur = 7 * k;
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = '#ff7a2a';
      g.lineWidth = 1.1;
      g.stroke();
      g.strokeStyle = '#ffc050';
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, -5); g.lineTo(0, -16); g.stroke();
      g.fillStyle = '#e0b040';
      g.fillRect(-7, -4.5, 14, 3);
      g.beginPath(); g.moveTo(-7, -4.5); g.lineTo(-8, -9); g.lineTo(-5.5, -4.5); g.fill();
      g.beginPath(); g.moveTo(7, -4.5); g.lineTo(8, -9); g.lineTo(5.5, -4.5); g.fill();
      g.fillStyle = '#5a1810';
      g.fillRect(-1.5, -1.5, 3, 8);
      glowDot(0, -3, 2, '#ff4a1a');
    } else if (id === 'astrape') {   // 가는 은빛 칼날 + 보라 지그재그 번개 + 초승달 날밑
      g.fillStyle = '#ecebfa';
      g.beginPath();
      g.moveTo(-2, -5); g.lineTo(2, -5); g.lineTo(1.6, -16); g.lineTo(0, -19.5); g.lineTo(-1.6, -16);
      g.closePath();
      g.fill();
      g.strokeStyle = '#b878ff';
      g.shadowColor = '#b878ff';
      g.shadowBlur = 5 * k;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, -5.5);
      for (let i = 1; i <= 5; i++) g.lineTo((i % 2 ? 1 : -1) * 0.9, -5.5 - i * 2.1);
      g.stroke();
      g.shadowBlur = 0;
      g.strokeStyle = '#d4d0ea';
      g.lineWidth = 1.8;
      g.beginPath(); g.arc(0, -7, 6, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
      g.fillStyle = '#251838';
      g.fillRect(-1.3, -1, 2.6, 7.5);
      glowDot(-5.3, -4.5, 1.4, '#c080ff');
      glowDot(5.3, -4.5, 1.4, '#c080ff');
      glowDot(0, -1.5, 1.8, '#b46cff');
    } else {   // 발뭉: 은빛 칼날, 금 날밑, 푸른 보석
      g.fillStyle = '#dfe9f5';
      g.beginPath();
      g.moveTo(-2.5, -4); g.lineTo(2.5, -4); g.lineTo(2, -15); g.lineTo(0, -18); g.lineTo(-2, -15);
      g.closePath();
      g.fill();
      g.fillStyle = '#e0b040';
      g.fillRect(-7, -4.5, 14, 3);
      g.fillStyle = '#3a5a90';
      g.fillRect(-1.5, -1.5, 3, 8);
      glowDot(0, -3, 2, '#5fc4ff');
    }
    g.restore();
  },

  // 체력 위: 들고 있는 무기 + 무기 칸 3개 (1·2·3 키로 바꿈). 바꾼 직후 속성 색으로 빛남
  // touch: 터치 화면 (칸이 더 크고, 칸이나 판을 눌러 바꿈 → 누를 자리를 TouchControls.weaponHit에 알려 줌)
  drawWeapon(player, x, y, touch) {
    const g = this.g, s = this.s, w = Weapons.cur;
    const flash = Utils.clamp(1 - Weapons.switchAge / 0.6, 0, 1);
    const pw = (touch ? 276 : 290) * s, ph = 42 * s;
    const slot0 = (touch ? 182 : 210) * s, gap = (touch ? 33 : 27) * s, sr = (touch ? 14 : 12) * s;
    g.save();
    if (flash > 0) {
      g.shadowColor = w.ui;
      g.shadowBlur = 22 * s * flash;
    }
    this.panel(x, y, pw, ph, 8 * s);
    g.restore();
    if (touch) TouchControls.weaponHit = { x, y, w: pw, h: ph, slots: WEAPONS.map((o, i) => ({ x: x + slot0 + i * gap, y: y + 21 * s, r: sr })) };
    const pop = 1 + flash * 0.35;
    this.weaponIcon(w.id, x + 22 * s, y + 21 * s, s * pop);
    this.text(w.name, x + 44 * s, y + 14 * s, 15, w.ui);
    this.text(`${w.title} · 공격력 ${player.attackPower}`, x + 44 * s, y + 30 * s, 11, '#e8dcc0');
    WEAPONS.forEach((o, i) => {   // 무기 칸: 지금 든 것은 속성 색 테두리
      const cx = x + slot0 + i * gap, cy = y + 21 * s, r = sr, on = i === Weapons.index;
      g.fillStyle = on ? 'rgba(60, 60, 70, 0.9)' : 'rgba(20, 18, 16, 0.75)';
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = on ? o.ui : 'rgba(150, 140, 120, 0.5)';
      g.lineWidth = (on ? 2 : 1) * s;
      g.stroke();
      g.save();
      g.globalAlpha = on ? 1 : 0.45;
      this.weaponIcon(o.id, cx, cy + 1 * s, r * 0.052);
      g.restore();
      if (!touch) this.text(String(i + 1), cx + r * 0.75, cy + r * 0.8, 10, on ? '#ffffff' : '#a09a90', 'center');
    });
  },

  // 스킬 칸 내용 (Q 회전베기, E 검기, F 섬광 돌진, R 궁극기 — 궁극기 이름·그림은 무기마다)
  skillSlots(player) {
    const S = CONFIG.skills, wp = Weapons.cur;
    return {
      spin: { key: 'Q', name: '회전베기', icon: 'spin', cool: player.cool.spin, max: S.spin.cooldown, r: 28 },
      wave: { key: 'E', name: '검기', icon: 'wave', cool: player.cool.wave, max: S.wave.cooldown, r: 28 },
      dash: { key: 'F', name: '섬광 돌진', icon: 'dash', cool: player.cool.dash, max: S.dash.cooldown, r: 28 },
      ult: { key: 'R', name: wp.ult, icon: wp.ultIcon, charge: player.ult / 100, r: 38 },
    };
  },

  // 오른쪽 아래: 스킬 칸 4개를 한 줄로
  drawSkills(player) {
    const s = this.s, W = this.canvas.width, H = this.canvas.height, all = this.skillSlots(player);
    const slots = [all.spin, all.wave, all.dash, all.ult];
    let x = W - 64 * s;
    const y = H - 74 * s;
    for (let i = slots.length - 1; i >= 0; i--) {
      this.skillSlot(slots[i], x, y, slots[i].r * s, true);
      x -= (slots[i].r + (slots[i - 1] ? slots[i - 1].r : 0) + 22) * s;
    }
  },

  // 스킬 칸 하나: 둥근 판 + 그림 + 남은 시간(또는 궁극기 게이지). labels: 키·이름 표시 (터치 버튼은 그림만), pressed: 누르는 중
  skillSlot(sl, x, y, r, labels, pressed) {
    const g = this.g, s = this.s, wp = Weapons.cur;
    const ready = sl.charge !== undefined ? sl.charge >= 1 : sl.cool <= 0;
    const now = performance.now() / 1000;
    if (pressed) r *= 0.92;
    g.save();
    if (ready && sl.charge !== undefined) {   // 궁극기 준비: 무기 속성 색으로 일렁임
      g.shadowColor = wp.ui;
      g.shadowBlur = (14 + Math.sin(now * 6) * 6) * s;
    }
    const grad = g.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, pressed ? 'rgba(110, 130, 160, 0.95)' : ready ? 'rgba(70, 90, 120, 0.9)' : 'rgba(40, 40, 46, 0.85)');
    grad.addColorStop(1, 'rgba(12, 12, 16, 0.9)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.restore();
    this.skillIcon(sl.icon, x, y, r * 0.55, ready ? '#ffffff' : 'rgba(255, 255, 255, 0.45)');
    if (sl.charge !== undefined) {   // 궁극기 게이지 고리
      g.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      g.lineWidth = 4 * s;
      g.beginPath();
      g.arc(x, y, r - 2 * s, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = ready ? '#ffd56a' : wp.ui;
      g.beginPath();
      g.arc(x, y, r - 2 * s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Utils.clamp(sl.charge, 0, 1));
      g.stroke();
      if (!ready) this.text(`${Math.floor(sl.charge * 100)}%`, x, y + r * 0.62, 11, '#cfe3ff', 'center');
    } else {
      g.strokeStyle = ready ? 'rgba(232, 196, 120, 0.9)' : 'rgba(150, 140, 120, 0.6)';
      g.lineWidth = 2 * s;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.stroke();
      if (!ready) {   // 남은 시간만큼 어둡게 덮고 숫자
        g.fillStyle = 'rgba(0, 0, 0, 0.55)';
        g.beginPath();
        g.moveTo(x, y);
        g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (sl.cool / sl.max));
        g.closePath();
        g.fill();
        this.text(String(Math.ceil(sl.cool)), x, y, 18, '#ffffff', 'center');
      }
    }
    if (!labels) return;
    // 키 표시와 이름
    g.fillStyle = ready ? '#e8c478' : '#8a8070';
    this.roundRect(x - 11 * s, y - r - 9 * s, 22 * s, 18 * s, 4 * s);
    g.fill();
    this.text(sl.key, x, y - r, 12, '#1a140c', 'center');
    this.text(sl.name, x, y + r + 13 * s, 12, ready ? '#ffffff' : '#bbbbbb', 'center');
  },

  // 터치 화면: 이동 조이스틱 + 공격·구르기·스킬 버튼 + 시점·전체 화면 버튼
  drawTouch(player) {
    const g = this.g, s = this.s, T = TouchControls, wp = Weapons.cur;
    // 조이스틱: 누르고 있으면 손가락 자리에, 아니면 기본 자리에 흐리게
    const st = T.stick, R = T.stickR;
    const [ox, oy] = st ? [st.ox, st.oy] : T.stickHome;
    const kx = st ? ox + Utils.clamp(st.x - ox, -R, R) : ox, ky = st ? oy + Utils.clamp(st.y - oy, -R, R) : oy;
    g.save();
    g.globalAlpha = st ? 0.9 : 0.4;
    g.fillStyle = 'rgba(10, 10, 14, 0.35)';
    g.strokeStyle = 'rgba(232, 196, 120, 0.8)';
    g.lineWidth = 2 * s;
    g.beginPath();
    g.arc(ox, oy, R, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = 'rgba(232, 196, 120, 0.6)';   // 네 방향 눈금
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2, tx = ox + Math.cos(a) * R * 0.8, ty = oy + Math.sin(a) * R * 0.8;
      g.beginPath();
      g.moveTo(tx + Math.cos(a) * 6 * s, ty + Math.sin(a) * 6 * s);
      g.lineTo(tx + Math.cos(a + 2.2) * 5 * s, ty + Math.sin(a + 2.2) * 5 * s);
      g.lineTo(tx + Math.cos(a - 2.2) * 5 * s, ty + Math.sin(a - 2.2) * 5 * s);
      g.closePath();
      g.fill();
    }
    const kg = g.createRadialGradient(kx, ky - 6 * s, 2 * s, kx, ky, 26 * s);
    kg.addColorStop(0, 'rgba(255, 245, 225, 0.95)');
    kg.addColorStop(1, 'rgba(180, 160, 120, 0.85)');
    g.fillStyle = kg;
    g.beginPath();
    g.arc(kx, ky, 25 * s, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // 공격 버튼: 들고 있는 무기 그림, 속성 색 테두리
    const atk = T.button('attack'), down = !!T.held.attack, ar = atk.r * (down ? 0.93 : 1);
    g.save();
    g.shadowColor = wp.ui;
    g.shadowBlur = (down ? 24 : 10) * s;
    const ag = g.createRadialGradient(atk.x, atk.y - ar * 0.35, ar * 0.1, atk.x, atk.y, ar);
    ag.addColorStop(0, down ? 'rgba(120, 120, 140, 0.95)' : 'rgba(70, 72, 86, 0.9)');
    ag.addColorStop(1, 'rgba(14, 14, 18, 0.92)');
    g.fillStyle = ag;
    g.beginPath();
    g.arc(atk.x, atk.y, ar, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.strokeStyle = wp.ui;
    g.lineWidth = 3 * s;
    g.beginPath();
    g.arc(atk.x, atk.y, ar - 1.5 * s, 0, Math.PI * 2);
    g.stroke();
    const ik = ar * 0.062;   // 비스듬한 검 그림의 가운데가 버튼 가운데에 오게 (그림의 기준점은 손잡이)
    this.weaponIcon(wp.id, atk.x + 5.6 * ik, atk.y + 5.7 * ik, ik);

    // 구르기·스킬·궁극기
    const all = this.skillSlots(player), c = CONFIG.player;
    const dodge = T.button('dodge');
    this.skillSlot({ icon: 'roll', cool: player.dodgeCooldown, max: c.dodgeCooldown }, dodge.x, dodge.y, dodge.r, false, !!T.held.dodge);
    for (const id of ['spin', 'wave', 'dash', 'ult']) {
      const b = T.button(id);
      this.skillSlot(all[id], b.x, b.y, b.r, false, !!T.held[id]);
    }

    // 위 오른쪽 작은 버튼: 시점 전환(눈), 전체 화면
    for (const id of ['view', 'sound', 'fullscreen']) {
      const b = T.button(id);
      if (!b) continue;
      g.fillStyle = T.held[id] ? 'rgba(90, 90, 110, 0.9)' : 'rgba(14, 14, 18, 0.7)';
      g.strokeStyle = 'rgba(232, 196, 120, 0.85)';
      g.lineWidth = 1.5 * s;
      g.beginPath();
      g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      const icon = id === 'view' ? (Camera.isFirst ? 'eye' : 'person') : id === 'sound' ? (Sound.muted ? 'mute' : 'speaker') : 'fullscreen';
      this.skillIcon(icon, b.x, b.y, b.r * 0.55, '#ffffff');
    }
  },

  // 세로로 든 휴대폰: 가로로 돌려 달라는 안내 (누르면 닫힘)
  drawRotateHint() {
    const g = this.g, W = this.canvas.width, H = this.canvas.height, s = this.s;
    g.fillStyle = 'rgba(0, 0, 0, 0.72)';
    g.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.42, t = performance.now() / 1000;
    const a = -Utils.smooth((t % 2.4) / 1.2) * Math.PI / 2 * (t % 2.4 < 1.8 ? 1 : 0);   // 휴대폰 그림이 옆으로 눕는 움직임
    g.save();
    g.translate(cx, cy);
    g.rotate(a);
    g.strokeStyle = '#ffe08a';
    g.lineWidth = 4 * s;
    this.roundRect(-24 * s, -42 * s, 48 * s, 84 * s, 8 * s);
    g.stroke();
    g.fillStyle = '#ffe08a';
    g.fillRect(-8 * s, 32 * s, 16 * s, 3 * s);
    g.restore();
    this.text('휴대폰을 가로로 돌려 주세요', cx, cy + 86 * s, 22, '#ffffff', 'center');
    this.text('화면을 누르면 이대로 할 수 있어요', cx, cy + 118 * s, 14, '#ffe7a8', 'center', 0.85);
  },

  // 스킬 그림
  skillIcon(kind, x, y, r, color) {
    const g = this.g, s = this.s;
    g.save();
    g.strokeStyle = g.fillStyle = color;
    g.lineWidth = 3 * s;
    g.lineCap = 'round';
    if (kind === 'spin') {   // 빙글 도는 화살표
      g.beginPath();
      g.arc(x, y, r * 0.8, -0.3, Math.PI * 1.55);
      g.stroke();
      const a = Math.PI * 1.55, ex = x + Math.cos(a) * r * 0.8, ey = y + Math.sin(a) * r * 0.8;
      g.beginPath();
      g.moveTo(ex + r * 0.35, ey - r * 0.05);
      g.lineTo(ex - r * 0.1, ey - r * 0.35);
      g.lineTo(ex - r * 0.05, ey + r * 0.25);
      g.closePath();
      g.fill();
    } else if (kind === 'wave') {   // 초승달 칼날
      g.beginPath();
      g.arc(x - r * 0.25, y, r, -1.1, 1.1);
      g.arc(x - r * 0.65, y, r * 0.85, 1.0, -1.0, true);
      g.closePath();
      g.fill();
    } else if (kind === 'dash') {   // 앞으로 쏘아지는 화살촉 + 속도선
      g.beginPath();
      g.moveTo(x + r * 0.9, y);
      g.lineTo(x + r * 0.1, y - r * 0.55);
      g.lineTo(x + r * 0.3, y);
      g.lineTo(x + r * 0.1, y + r * 0.55);
      g.closePath();
      g.fill();
      for (const [dy, l] of [[-0.35, 0.8], [0, 1.1], [0.35, 0.8]]) {
        g.beginPath();
        g.moveTo(x - r * 0.05, y + dy * r);
        g.lineTo(x - r * l, y + dy * r);
        g.stroke();
      }
    } else if (kind === 'sword') {   // 아래로 내리꽂히는 검
      g.beginPath();
      g.moveTo(x, y + r);
      g.lineTo(x - r * 0.22, y + r * 0.55);
      g.lineTo(x - r * 0.22, y - r * 0.35);
      g.lineTo(x + r * 0.22, y - r * 0.35);
      g.lineTo(x + r * 0.22, y + r * 0.55);
      g.closePath();
      g.fill();
      g.fillRect(x - r * 0.65, y - r * 0.5, r * 1.3, r * 0.18);
      g.fillRect(x - r * 0.1, y - r * 0.95, r * 0.2, r * 0.45);
    } else if (kind === 'meteor') {   // 꼬리를 끌며 떨어지는 유성
      g.beginPath();
      g.arc(x + r * 0.3, y + r * 0.3, r * 0.42, 0, Math.PI * 2);
      g.fill();
      for (const [ox, oy, l] of [[-0.25, 0.15, 0.9], [0.1, -0.15, 1.1], [0.35, -0.3, 0.7]]) {
        g.beginPath();
        g.moveTo(x + r * ox, y + r * oy);
        g.lineTo(x + r * (ox - l * 0.7), y + r * (oy - l * 0.7));
        g.stroke();
      }
    } else if (kind === 'roll') {   // 구르기: 둥글게 감기는 화살표 + 바람 줄
      g.beginPath();
      g.arc(x + r * 0.1, y, r * 0.62, Math.PI * 0.85, Math.PI * 2.25);
      g.stroke();
      const ea = Math.PI * 2.25, ex = x + r * 0.1 + Math.cos(ea) * r * 0.62, ey = y + Math.sin(ea) * r * 0.62;
      g.beginPath();
      g.moveTo(ex + r * 0.3, ey - r * 0.12);
      g.lineTo(ex - r * 0.2, ey + r * 0.32);
      g.lineTo(ex - r * 0.22, ey - r * 0.3);
      g.closePath();
      g.fill();
      for (const dy of [-0.3, 0.1]) {
        g.beginPath();
        g.moveTo(x - r * 0.75, y + dy * r);
        g.lineTo(x - r * 1.05, y + dy * r);
        g.stroke();
      }
    } else if (kind === 'eye') {   // 눈 (지금 1인칭)
      g.lineWidth = 2.5 * s;
      g.beginPath();
      g.moveTo(x - r, y);
      g.quadraticCurveTo(x, y - r * 0.95, x + r, y);
      g.quadraticCurveTo(x, y + r * 0.95, x - r, y);
      g.stroke();
      g.beginPath();
      g.arc(x, y, r * 0.32, 0, Math.PI * 2);
      g.fill();
    } else if (kind === 'person') {   // 사람 (지금 3인칭)
      g.beginPath();
      g.arc(x, y - r * 0.45, r * 0.32, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(x - r * 0.62, y + r * 0.85);
      g.quadraticCurveTo(x - r * 0.6, y - r * 0.05, x, y - r * 0.05);
      g.quadraticCurveTo(x + r * 0.6, y - r * 0.05, x + r * 0.62, y + r * 0.85);
      g.closePath();
      g.fill();
    } else if (kind === 'speaker' || kind === 'mute') {   // 스피커 (끄면 X)
      g.beginPath();
      g.moveTo(x - r * 0.85, y - r * 0.3);
      g.lineTo(x - r * 0.4, y - r * 0.3);
      g.lineTo(x + r * 0.1, y - r * 0.8);
      g.lineTo(x + r * 0.1, y + r * 0.8);
      g.lineTo(x - r * 0.4, y + r * 0.3);
      g.lineTo(x - r * 0.85, y + r * 0.3);
      g.closePath();
      g.fill();
      g.lineWidth = 2.2 * s;
      if (kind === 'speaker') {
        for (const k of [0.45, 0.8]) {
          g.beginPath();
          g.arc(x + r * 0.1, y, r * k, -0.8, 0.8);
          g.stroke();
        }
      } else {
        g.beginPath();
        g.moveTo(x + r * 0.35, y - r * 0.35); g.lineTo(x + r * 0.95, y + r * 0.35);
        g.moveTo(x + r * 0.95, y - r * 0.35); g.lineTo(x + r * 0.35, y + r * 0.35);
        g.stroke();
      }
    } else if (kind === 'fullscreen') {   // 네 귀퉁이 꺾쇠
      g.lineWidth = 2.5 * s;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        g.beginPath();
        g.moveTo(x + sx * r * 0.85, y + sy * r * 0.3);
        g.lineTo(x + sx * r * 0.85, y + sy * r * 0.85);
        g.lineTo(x + sx * r * 0.3, y + sy * r * 0.85);
        g.stroke();
      }
    } else {   // 번개
      g.beginPath();
      g.moveTo(x + r * 0.25, y - r);
      g.lineTo(x - r * 0.45, y + r * 0.1);
      g.lineTo(x - r * 0.02, y + r * 0.1);
      g.lineTo(x - r * 0.3, y + r);
      g.lineTo(x + r * 0.5, y - r * 0.2);
      g.lineTo(x + r * 0.05, y - r * 0.2);
      g.closePath();
      g.fill();
    }
    g.restore();
  },

  // 미니맵용 지도 그림 (구역을 불러올 때 한 번)
  buildMinimap() {
    const ppm = 4;   // 1m당 픽셀
    const c = Utils.makeCanvas(World.cols * CELL * ppm, World.rows * CELL * ppm);
    const g = c.getContext('2d');
    // 칸 색 (동굴은 바위색 바닥, 벽은 짙은 갈색)
    const colors = World.cave
      ? { '#': '#221e1b', ':': '#8a7a5e', '~': '#2f7f9a', 'E': '#8a8a8a', 'o': '#b8ac88' }
      : { '#': '#1f3a22', 'f': '#6f9a48', ':': '#a88a5a', '~': '#3f86b8', 'E': '#8a8a8a' };
    const floor = World.cave ? '#5e574f' : '#5c8a3e';
    const dots = World.cave ? { C: '#7fe8ff', t: '#ffb040', S: '#a49d94', R: '#8d9096', X: '#a8a49a' } : { T: '#2c5a2c', R: '#8d9096', b: '#2f6a2a', X: '#a8a49a' };
    const k = CELL * ppm;
    for (let z = 0; z < World.rows; z++) {
      for (let x = 0; x < World.cols; x++) {
        const ch = World.data[z][x];
        g.fillStyle = colors[ch] || floor;
        g.fillRect(x * k, z * k, k + 0.5, k + 0.5);
        const dot = dots[ch];
        if (dot) {
          g.fillStyle = dot;
          g.beginPath();
          g.arc((x + 0.5) * k, (z + 0.5) * k, k * 0.32, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    this.mini = { canvas: c, ppm };
  },

  // 왼쪽 위: 둥근 미니맵 (내가 보는 쪽이 위). 빨간 점 = 적, 금색 = 열린 출구
  drawMinimap(player, R = 74 * this.s, cx = 30 * this.s + R, cy = cx) {
    if (!this.mini) return;
    const g = this.g, s = this.s;
    const scale = (3 * s) / this.mini.ppm;   // 화면에서 1m = 3px
    g.save();
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fillStyle = 'rgba(15, 25, 15, 0.8)';
    g.fill();
    g.clip();
    g.translate(cx, cy);
    g.rotate(-player.yaw - Math.PI / 2);
    g.scale(scale, scale);
    const ppm = this.mini.ppm;
    g.globalAlpha = 0.92;
    g.drawImage(this.mini.canvas, -player.x * ppm, -player.z * ppm);
    g.globalAlpha = 1;
    const dot = (x, z, r, color) => {
      g.fillStyle = color;
      g.beginPath();
      g.arc((x - player.x) * ppm, (z - player.z) * ppm, r / scale, 0, Math.PI * 2);
      g.fill();
    };
    for (const e of Enemies.list) if (!e.dead) dot(e.x, e.z, (e.boss ? 8 : 4) * s, e.boss ? '#ff8a3a' : '#ff4a3a');
    if (World.gate) dot(World.gate.x, World.gate.z, 6 * s, World.gateOpen ? '#ffd56a' : '#6fd8ff');
    g.restore();
    // 테두리와 가운데 화살표(나)
    g.strokeStyle = 'rgba(232, 196, 120, 0.9)';
    g.lineWidth = 3 * s;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(cx, cy - 9 * s);
    g.lineTo(cx + 6 * s, cy + 6 * s);
    g.lineTo(cx, cy + 3 * s);
    g.lineTo(cx - 6 * s, cy + 6 * s);
    g.closePath();
    g.fill();
    const na = -player.yaw - Math.PI / 2 - Math.PI / 2;   // 북쪽(-z) 표시
    this.text('N', cx + Math.cos(na) * (R - 10 * s), cy + Math.sin(na) * (R - 10 * s), 12, '#ffe08a', 'center');
  },

  // 이어 하기로 시작했을 때: 처음 10초 동안 '처음부터' 버튼 (누르면 제1장부터)
  restartBox: null,
  drawRestart(t) {
    this.restartBox = null;
    if (!Game.resumed || Game.levelIndex === 0) return;
    const a = Utils.clamp((10 - t) / 1.5, 0, 1);
    if (a <= 0) {
      Game.resumed = false;
      return;
    }
    const g = this.g, s = this.s, W = this.canvas.width, H = this.canvas.height;
    const msg = '↺ 처음부터 하기';
    g.font = this.font(15);
    const w = g.measureText(msg).width + 36 * s, h = 34 * s, x = W / 2 - w / 2, y = H * 0.28 + 64 * s;
    g.save();
    g.globalAlpha = a;
    this.panel(x, y, w, h, h / 2);
    g.restore();
    this.text(msg, W / 2, y + h / 2, 15, '#ffe7a8', 'center', a);
    this.text('저장된 구역부터 이어 합니다', W / 2, y + h + 16 * s, 12, '#ffffff', 'center', a * 0.8);
    this.restartBox = { x, y, w, h };
  },

  // (x, y)가 '처음부터' 버튼 위인지 (HUD 캔버스 픽셀)
  restartAt(x, y) {
    const b = this.restartBox;
    return !!b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  },

  // 지역 이름: 처음 몇 초 동안 떠올랐다 사라짐
  drawTitle(level, t) {
    const a = t < 0.8 ? t / 0.8 : t < 3.5 ? 1 : Math.max(0, 1 - (t - 3.5));
    if (a <= 0) return;
    const g = this.g, W = this.canvas.width, H = this.canvas.height, s = this.s;
    this.text(level.chapter, W / 2, H * 0.28 - 36 * s, 20, '#e8c478', 'center', a);
    this.text(level.name, W / 2, H * 0.28 + 6 * s, 46, '#ffffff', 'center', a);
    g.save();
    g.globalAlpha = a * 0.8;
    g.fillStyle = '#e8c478';
    g.fillRect(W / 2 - 200 * s, H * 0.28 + 42 * s, 400 * s, 2 * s);
    g.restore();
  },

  // 키 모양 그림 + 설명. 그린 너비를 돌려줌
  keyHint(key, label, x, y, measureOnly) {
    const g = this.g, s = this.s;
    g.font = this.font(13);
    const kw = g.measureText(key).width + 14 * s;
    const lw = g.measureText(label).width;
    if (!measureOnly) {
      g.fillStyle = 'rgba(245, 235, 210, 0.92)';
      this.roundRect(x, y - 11 * s, kw, 22 * s, 5 * s);
      g.fill();
      g.fillStyle = 'rgba(0, 0, 0, 0.25)';
      g.fillRect(x + 2 * s, y + 8 * s, kw - 4 * s, 3 * s);
      this.text(key, x + kw / 2, y, 13, '#2a2016', 'center');
      this.text(label, x + kw + 6 * s, y, 13, '#ffffff');
    }
    return kw + 6 * s + lw + 18 * s;
  },

  // 조작 안내: 처음 20초쯤 보이다 사라짐. 마우스가 잠기지 않았으면 클릭 안내
  drawHints(t) {
    const g = this.g, W = this.canvas.width, H = this.canvas.height, s = this.s;
    const a = Utils.clamp((20 - t) / 2, 0, 1);
    if (a > 0) {
      const items = TouchControls.active
        ? [['왼쪽 화면', '이동'], ['오른쪽 끌기', '시점'], ['공격 꾹', '연속 공격'], ['무기 판', '무기 바꾸기']]
        : [['WASD', '이동'], ['마우스', '시점'], ['클릭', '공격'], ['Shift', '구르기'], ['Q', '회전베기'], ['E', '검기'], ['F', '돌진'], ['R', '궁극기'], ['1·2·3', '무기'], ['V', '1·3인칭'], ['M', '소리']];
      // 화면보다 길면 두 줄로 나눔 (세로로 든 휴대폰)
      const width = (list) => list.reduce((sum, [k, l]) => sum + this.keyHint(k, l, 0, 0, true), 0);
      const rows = width(items) > W - 30 * s ? [items.slice(0, Math.ceil(items.length / 2)), items.slice(Math.ceil(items.length / 2))] : [items];
      g.save();
      g.globalAlpha = a;
      rows.forEach((row, i) => {
        const total = width(row);
        let x = W / 2 - total / 2;
        // 키보드: 화면 맨 위 가운데 (용사·체력 막대를 가리지 않게), 터치: 아래 가운데 (조이스틱과 버튼 사이, 두 줄이면 위로 쌓음)
        const y = TouchControls.active ? H - 24 * s - (rows.length - 1 - i) * 40 * s : 26 * s + i * 40 * s;
        this.panel(x - 14 * s, y - 17 * s, total + 10 * s, 34 * s, 17 * s);   // 밝은 하늘 위에서도 잘 보이게 어두운 바탕
        for (const [k, l] of row) x += this.keyHint(k, l, x, y);
      });
      g.restore();
    }
    if (!Input.locked && !TouchControls.active && Camera.cine < 0.4) {   // 마우스 잠금 안내 (알약 모양)
      const msg = Input.lockFailed ? '오른쪽 버튼을 누른 채 끌면 둘러볼 수 있어요  ·  왼쪽 클릭 = 공격' : '화면을 클릭하면 마우스로 둘러볼 수 있어요  (Esc로 해제)';
      g.font = this.font(15);
      const w = g.measureText(msg).width + 40 * s;
      g.save();
      g.globalAlpha = 0.8 + 0.2 * Math.sin(t * 3);
      this.panel(W / 2 - w / 2, H - 96 * s, w, 30 * s, 15 * s);
      g.restore();
      this.text(msg, W / 2, H - 81 * s, 15, '#ffe7a8', 'center');
    }
  },
};
