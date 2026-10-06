// 스킬과 궁극기 (효과 색은 들고 있는 무기의 속성을 따름: 빛 = 푸름, 불 = 주황, 번개 = 보라)
//   Q 회전베기: 한 바퀴 돌며 주변 적을 모두 벰
//   E 검기: 앞으로 날아가 적을 꿰뚫는 빛의 칼날
//   F 섬광 돌진: 순식간에 앞으로 베고 지나감 → 한 박자 뒤에 지나온 길이 베임
//   R 궁극기: 맵의 모든 적에게 (발뭉 = 하늘에서 거대한 빛의 검, 레바테인 = 불타는 유성, 아스트라페 = 번개)
//   콤보 마무리(내려찍기): 무기 속성 폭발 (빛의 기둥 / 불기둥 / 낙뢰)
// 수치는 config.js의 skills·weapons. 빛나는 효과는 Glow에 모아서 그림

// 빛나는 띠·면 모음: 매 프레임 비우고 다시 채움. 점마다 [x, y, z, r, g, b, 투명도]
const Glow = {
  data: [],
  top: 0,        // data 맨 앞에서 이만큼은 다른 물체에 가려지지 않게 그림 (타격 섬광)
  clear() {
    this.data.length = 0;
    this.top = 0;
  },
  vert(p, c) {
    this.data.push(p[0], p[1], p[2], c[0], c[1], c[2], c[3]);
  },
  quad(a, b, c, d, ca, cb, cc, cd) {
    this.vert(a, ca); this.vert(b, cb); this.vert(c, cc);
    this.vert(a, ca); this.vert(c, cc); this.vert(d, cd);
  },
  // 카메라를 향하는 띠 (가운데는 진하고 가장자리는 투명하게)
  ribbon(pts, width, color, eye) {
    this.strip(pts, () => width, () => color, eye);
  },
  // 굵기·색이 위치마다 바뀌는 띠: wFn(t) 굵기, cFn(t) 색 [r, g, b, 투명도]. t = 0(처음) ~ 1(끝)
  strip(pts, wFn, cFn, eye) {
    const n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      const a = pts[i], b = pts[i + 1], t = V3.sub(b, a);
      const ta = i / (n - 1), tb = (i + 1) / (n - 1);
      const sa = V3.scale(V3.normalize(V3.cross(t, V3.sub(eye, a))), wFn(ta) / 2);
      const sb = V3.scale(V3.normalize(V3.cross(t, V3.sub(eye, b))), wFn(tb) / 2);
      const ca = cFn(ta), cb = cFn(tb), ea = [ca[0], ca[1], ca[2], 0], eb = [cb[0], cb[1], cb[2], 0];
      this.quad(V3.sub(a, sa), a, b, V3.sub(b, sb), ea, ca, cb, eb);
      this.quad(a, V3.add(a, sa), V3.add(b, sb), b, ca, ea, eb, cb);
    }
  },
};

const rgba = (c, a) => [c[0], c[1], c[2], a];

// a에서 b까지 n조각으로 나눈 점들
function linePts(a, b, n) {
  const out = [];
  for (let i = 0; i <= n; i++) out.push(V3.add(a, V3.scale(V3.sub(b, a), i / n)));
  return out;
}

// 번개 모양: 위에서 아래로 지그재그 (중간점을 옆으로 흔드는 것을 반복)
function boltPoints(top, bottom, depth, spread) {
  let pts = [top, bottom];
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const m = V3.scale(V3.add(a, b), 0.5);
      next.push([m[0] + (Math.random() - 0.5) * len * spread, m[1], m[2] + (Math.random() - 0.5) * len * spread], b);
    }
    pts = next;
  }
  return pts;
}

// 어느 방향이든 두 점 사이의 번개 줄기 (가운데 점들을 사방으로 흔듦)
function zigzag(a, b, depth, spread) {
  let pts = [a, b];
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1], len = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) * spread;
      const m = V3.scale(V3.add(p, q), 0.5);
      next.push([m[0] + (Math.random() - 0.5) * len, m[1] + (Math.random() - 0.5) * len, m[2] + (Math.random() - 0.5) * len], q);
    }
    pts = next;
  }
  return pts;
}

// 번개 줄기에서 갈라져 나가는 잔가지 n개 (줄기 위 아무 데서나 옆·아래로 짧게)
function boltBranches(pts, n, reach) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[1 + Math.floor(Math.random() * (pts.length - 2))];
    const ang = Math.random() * 6.283, len = reach * (0.4 + Math.random() * 0.6);
    out.push(zigzag(a, [a[0] + Math.cos(ang) * len, a[1] - len * (0.4 + Math.random() * 0.8), a[2] + Math.sin(ang) * len], 3, 0.4));
  }
  return out;
}

// 번개 줄기 그리기: 가운데 하얀 줄기 + 넓게 번지는 속성 색
function drawBolt(pts, eye, pal, a, w = 1) {
  Glow.ribbon(pts, 0.07 * w, rgba(pal.core, a), eye);
  Glow.ribbon(pts, 0.45 * w, rgba(pal.mid, 0.35 * a), eye);
}

const IMPACT_LIFE = 0.2;   // 타격 섬광이 보이는 시간(초)

// 카메라를 향한 별 모양 빛: rays개의 빛살(긴 것·짧은 것 번갈아) + 가운데 둥근 빛
// len: 빛살 길이, wK: 빛살 굵기 비율, discK: 둥근 빛 반지름 비율, pull: 가려지지 않게 카메라 쪽으로 당기는 거리
function glowStar(eye, pos, len, rays, alpha, rot, wK, discK, pull, pal = Weapons.cur) {
  const f = V3.normalize(V3.sub(pos, eye)), r = V3.normalize(V3.cross(f, [0, 1, 0])), u = V3.cross(r, f);
  const c = V3.sub(pos, V3.scale(f, pull));
  const dirAt = (ang) => V3.add(V3.scale(r, Math.cos(ang)), V3.scale(u, Math.sin(ang)));
  const core = rgba(V3.scale(pal.core, 1.1), alpha), clear = rgba(pal.mid, 0);
  for (let i = 0; i < rays; i++) {
    const ang = rot + (i / rays) * Math.PI * 2, l = len * (i % 2 ? 0.5 : 1), w = len * wK;
    const d = dirAt(ang), s = V3.scale(dirAt(ang + Math.PI / 2), w), tip = V3.add(c, V3.scale(d, l));
    Glow.vert(V3.sub(c, s), clear); Glow.vert(c, core); Glow.vert(tip, clear);
    Glow.vert(c, core); Glow.vert(V3.add(c, s), clear); Glow.vert(tip, clear);
  }
  const rad = len * discK, disc = rgba(V3.scale(V3.add(pal.core, pal.mid), 0.5), alpha * 0.9);
  for (let i = 0; i < 12; i++) {
    Glow.vert(c, disc);
    Glow.vert(V3.add(c, V3.scale(dirAt((i / 12) * Math.PI * 2), rad)), clear);
    Glow.vert(V3.add(c, V3.scale(dirAt(((i + 1) / 12) * Math.PI * 2), rad)), clear);
  }
}

// 초승달 모양 칼 궤적: pt(각도, 반지름) → 위치. start(꼬리) → cur(칼끝) 사이를 N 조각으로
// 가운데가 가장 두껍고 양 끝이 뾰족함. 바깥 가장자리는 하얀 칼날 선, 안쪽은 속성 색으로 흐려지고, 바깥은 살짝 번짐
function glowCrescent(pt, start, cur, R, W0, fade, N, pal = Weapons.cur) {
  const core = pal.core, blue = pal.mid;
  for (let i = 0; i < N; i++) {
    const s0 = i / N, s1 = (i + 1) / N;
    const a0 = start + (cur - start) * s0, a1 = start + (cur - start) * s1;
    const w0 = W0 * Math.pow(Math.sin(Math.PI * Math.pow(s0, 1.4)), 0.8), w1 = W0 * Math.pow(Math.sin(Math.PI * Math.pow(s1, 1.4)), 0.8);
    const b0 = (0.3 + 0.7 * s0) * fade, b1 = (0.3 + 0.7 * s1) * fade;
    Glow.quad(pt(a0, R - w0), pt(a0, R - w0 * 0.15), pt(a1, R - w1 * 0.15), pt(a1, R - w1),
      rgba(blue, 0), rgba(blue, b0 * 0.75), rgba(blue, b1 * 0.75), rgba(blue, 0));
    Glow.quad(pt(a0, R - w0 * 0.15), pt(a0, R), pt(a1, R), pt(a1, R - w1 * 0.15),
      rgba(core, b0 * 0.6), rgba(core, b0), rgba(core, b1), rgba(core, b1 * 0.6));
    Glow.quad(pt(a0, R), pt(a0, R + 0.06 + w0 * 0.25), pt(a1, R + 0.06 + w1 * 0.25), pt(a1, R),
      rgba(blue, b0 * 0.6), rgba(blue, 0), rgba(blue, 0), rgba(blue, b1 * 0.6));
  }
}

// 땅 위의 빛나는 고리 (가운데 선이 진하고 안팎은 투명)
function glowRing(x, y, z, R, w, color, alpha, seg = 40) {
  const c = rgba(color, alpha), e = rgba(color, 0);
  const at = (i, r) => [x + Math.cos((i / seg) * 6.283) * r, y, z + Math.sin((i / seg) * 6.283) * r];
  for (let i = 0; i < seg; i++) {
    Glow.quad(at(i, R - w), at(i, R), at(i + 1, R), at(i + 1, R - w), e, c, c, e);
    Glow.quad(at(i, R), at(i, R + w), at(i + 1, R + w), at(i + 1, R), c, e, e, c);
  }
}

// 땅에 번지는 둥근 빛 (가운데가 밝고 바깥으로 투명)
function glowDisc(x, y, z, R, color, alpha, seg = 24) {
  const c = rgba(color, alpha), e = rgba(color, 0);
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * 6.283, a1 = ((i + 1) / seg) * 6.283;
    Glow.quad([x, y, z], [x + Math.cos(a0) * R, y, z + Math.sin(a0) * R], [x + Math.cos(a1) * R, y, z + Math.sin(a1) * R], [x, y, z], c, e, e, c);
  }
}

// 하늘에서 내리꽂히는 거대한 빛의 검 (카메라 쪽을 보는 판). tip = 칼끝, len = 칼날 길이
function glowGiantSword(eye, tip, len, alpha, pal) {
  const to = V3.sub(eye, tip);
  const r = V3.normalize([to[2], 0, -to[0]]);   // 카메라에서 볼 때 가로 방향
  const at = (h, s) => [tip[0] + r[0] * s, tip[1] + h, tip[2] + r[2] * s];
  const core = rgba(pal.core, alpha * 0.45), mid = rgba(pal.mid, alpha * 0.6), clear = rgba(pal.mid, 0);
  const bw = len * 0.07;
  // 칼날: 가운데 하얀 능선 → 날 끝은 속성 색 → 바깥으로 번짐. 칼끝은 뾰족 (너무 밝으면 하얗게 날아가서 은은하게)
  const N = 8;
  for (let i = 0; i < N; i++) {
    const h0 = (i / N) * len, h1 = ((i + 1) / N) * len;
    const w0 = bw * Math.min(1, (i / N) / 0.2), w1 = bw * Math.min(1, ((i + 1) / N) / 0.2);
    for (const sd of [-1, 1]) {
      Glow.quad(at(h0, 0), at(h0, sd * w0 * 0.35), at(h1, sd * w1 * 0.35), at(h1, 0), core, core, core, core);   // 가운데 하얀 능선
      Glow.quad(at(h0, sd * w0 * 0.35), at(h0, sd * w0), at(h1, sd * w1), at(h1, sd * w1 * 0.35), core, mid, mid, core);
      Glow.quad(at(h0, sd * w0), at(h0, sd * w0 * 1.9), at(h1, sd * w1 * 1.9), at(h1, sd * w1), mid, clear, clear, mid);
    }
  }
  // 날밑: 가로로 넓은 빛의 막대, 손잡이, 둥근 손잡이 끝
  const gw = len * 0.27, gt = len * 0.035;
  Glow.quad(at(len - gt, -gw), at(len - gt, gw), at(len, gw), at(len, -gw), clear, clear, core, core);
  Glow.quad(at(len, -gw), at(len, gw), at(len + gt, gw), at(len + gt, -gw), core, core, clear, clear);
  for (const sd of [-1, 1]) {
    Glow.quad(at(len, 0), at(len, sd * bw * 0.5), at(len * 1.17, sd * bw * 0.5), at(len * 1.17, 0), core, mid, mid, core);
    Glow.quad(at(len, sd * bw * 0.5), at(len, sd * bw * 1.6), at(len * 1.17, sd * bw * 1.6), at(len * 1.17, sd * bw * 0.5), mid, clear, clear, mid);
  }
  glowStar(eye, at(len * 1.2, 0), len * 0.12, 6, alpha, 0, 0.1, 0.5, 0, pal);
}

// 카메라를 향한 날카로운 칼선 (가운데가 가장 굵고 양 끝이 뾰족). a → b
function glowCut(eye, a, b, width, pal, alpha) {
  const pts = linePts(a, b, 10);
  const prof = (t) => Math.pow(Math.sin(Math.PI * t), 0.7);
  Glow.strip(pts, (t) => width * 0.25 * prof(t), () => rgba(pal.core, alpha), eye);
  Glow.strip(pts, (t) => width * prof(t), () => rgba(pal.mid, alpha * 0.45), eye);
}

const STRIKE_FALL = { balmung: 0.28, laevateinn: 0.55, astrape: 0 };    // 궁극기: 하늘에서 떨어지는 데 걸리는 시간
const STRIKE_LIFE = { balmung: 0.75, laevateinn: 0.6, astrape: 0.45 };  // 떨어진 뒤 효과가 남는 시간
const BURST_LIFE = 0.6;     // 콤보 마무리 속성 폭발이 보이는 시간
const SUMMON_LIFE = 0.8;    // 무기를 바꿀 때 빛이 감아 오르는 시간

const Skills = {
  waves: [],     // 날아가는 검기
  strikes: [],   // 궁극기: 적마다 떨어지는 빛의 검·유성·번개
  ult: null,     // 궁극기 진행 상태
  flash: 0,      // 화면 번쩍임 (0~1)
  darken: 0,     // 화면 어둡게 (0~0.75)
  get dim() { return Math.min(1, this.darken * 1.3); },   // 세상·하늘을 물들이는 정도 (셰이더용, 0~1)
  impacts: [],   // 타격 순간의 별 모양 섬광 { x, y, z, age, size, rot, pal }
  bursts: [],    // 콤보 마무리 속성 폭발
  chains: [],    // 번개가 다음 적에게 튈 차례
  arcs: [],      // 적과 적 사이를 잇는 번개 줄기
  slashes: [],   // 섬광 돌진이 지나간 길 (한 박자 뒤에 베임)
  summons: [],   // 무기를 바꿀 때의 빛

  reset() {
    this.waves = [];
    this.strikes = [];
    this.impacts = [];
    this.bursts = [];
    this.chains = [];
    this.arcs = [];
    this.slashes = [];
    this.summons = [];
    this.ult = null;
    this.flash = 0;
    this.darken = 0;
  },

  castWave(p) {
    Sound.play('wave');
    const fx = Math.cos(p.facing), fz = Math.sin(p.facing);
    this.waves.push({ x: p.x + fx * 0.8, z: p.z + fz * 0.8, y: p.groundY + 1.0, dx: fx, dz: fz, dist: 0, hit: new Set(), age: 0, pal: Weapons.cur });
    Camera.shake = Math.max(Camera.shake, 0.12);
  },

  // 타격 섬광 하나 추가 (size: 빛살 길이 m)
  impact(x, y, z, size, pal = Weapons.cur) {
    this.impacts.push({ x, y, z, age: 0, size, rot: Math.random() * Math.PI, pal });
  },

  castUltimate(p) {
    const w = Weapons.cur;
    Sound.play('charge');
    this.ult = { t: 0, fired: false, kind: w.id, pal: w };
    Camera.shake = Math.max(Camera.shake, 0.2);
  },

  // 무기를 바꿀 때: 발밑에서 속성 색 빛이 감아 오르며 새 무기가 나타남
  summon(p) {
    const w = Weapons.cur;
    this.summons = [{ age: 0, pal: w }];
    Particles.sparks(p.x, p.groundY + 1.0, p.z, 26, w.spark);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * 6.283;
      Particles.mote(p.x + Math.cos(a) * 1.0, p.groundY + 0.1, p.z + Math.sin(a) * 1.0, w.spark);
    }
    if (w.id === 'laevateinn') Particles.flameBurst(p.x, p.groundY + 0.05, p.z, 18, 0.9, 1.6, 0.35);
    Camera.shake = Math.max(Camera.shake, 0.12);
    this.flash = Math.max(this.flash, 0.12);
    Sound.play('switch');
  },

  // 콤보 마무리 속성 폭발: 내려찍은 자리 주변 적에게 피해 + 빛의 기둥 / 불기둥 / 낙뢰
  burst(x, y, z, p) {
    const w = Weapons.cur, cfg = Weapons.stats;
    this.bursts.push({ x, y, z, age: 0, kind: w.id, pal: w, R: cfg.burstRadius });
    Sound.play('boom', { size: 0.8 });
    for (const e of Enemies.list) {
      if (e.dead || Math.hypot(e.x - x, e.z - z) > cfg.burstRadius + e.radius) continue;
      Enemies.damage(e, cfg.burst, x, z, p);
      if (w.id === 'laevateinn') Weapons.onHit(e, p, false);
    }
    if (w.id === 'laevateinn') {   // 불기둥: 가운데서 높이 솟는 큰 불꽃 + 사방으로 터지는 불꽃 + 불씨
      for (let i = 0; i < 16; i++) Particles.flame(x + (Math.random() - 0.5) * 0.6, y + 0.1 + Math.random() * 0.4, z + (Math.random() - 0.5) * 0.6, 0.55 + Math.random() * 0.35, undefined, 0.6, 0, 4.5, 0);
      Particles.flameBurst(x, y + 0.05, z, 24, 0.9, 3.2, 0.45);
      for (let i = 0; i < 14; i++) Particles.ember(x + (Math.random() - 0.5), y + 0.3, z + (Math.random() - 0.5));
    } else if (w.id === 'balmung') {
      for (let i = 0; i < 14; i++) Particles.glitter(x, y, z);
      Particles.sparks(x, y + 0.3, z, 16, w.spark);
    } else {
      Particles.sparks(x, y + 0.2, z, 24, w.spark);
    }
    this.flash = Math.max(this.flash, 0.25);
  },

  // 아스트라페: 맞은 적에게서 가까운 다른 적에게 번개가 튐
  chain(e, p) {
    this.chainNext(e, CONFIG.weapons.astrape.chain, new Set([e]), p);
  },
  chainNext(src, left, hit, p) {
    if (left <= 0) return;
    let best = null, bd = CONFIG.weapons.astrape.chainRange;
    for (const o of Enemies.list) {
      if (o.dead || hit.has(o)) continue;
      const d = Math.hypot(o.x - src.x, o.z - src.z);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    if (!best) return;
    hit.add(best);
    this.chains.push({ src: [src.x, src.groundY + src.hitHeight, src.z], e: best, delay: 0.08, left: left - 1, hit, p });
  },

  // 섬광 돌진 중: 이번 프레임에 지나간 선분(bx, bz → 지금 위치) 가까이 있는 적을 기록
  dashSweep(p, bx, bz) {
    const S = CONFIG.skills.dash, w = Weapons.cur;
    const dx = p.x - bx, dz = p.z - bz, len2 = dx * dx + dz * dz;
    for (const e of Enemies.list) {
      if (e.dead || p.dashHit.has(e)) continue;
      const t = len2 > 0 ? Utils.clamp(((e.x - bx) * dx + (e.z - bz) * dz) / len2, 0, 1) : 0;
      if (Math.hypot(e.x - (bx + dx * t), e.z - (bz + dz * t)) < S.width / 2 + e.radius) {
        p.dashHit.add(e);
        Particles.sparks(e.x, e.groundY + e.hitHeight, e.z, 6, w.spark);
      }
    }
    // 지나간 자리에 흩날리는 불꽃 / 빛 알갱이
    if (w.id === 'laevateinn') Particles.flame(bx, p.groundY + 0.5 + Math.random() * 0.6, bz, 0.3, undefined, 0.4);
    else for (let i = 0; i < 2; i++) Particles.mote(bx + (Math.random() - 0.5) * 0.4, p.groundY + 0.4 + Math.random() * 1.0, bz + (Math.random() - 0.5) * 0.4, w.spark);
  },

  dashEnd(p) {
    const f = p.dashFrom;
    this.slashes.push({ ax: f.x, az: f.z, ay: f.y, bx: p.x, bz: p.z, by: p.groundY, age: 0, fired: false, targets: [...p.dashHit], cuts: [], pal: Weapons.cur, p });
  },

  update(dt, p) {
    const S = CONFIG.skills;
    // 검기: 앞으로 날아가며 닿는 적마다 한 번씩 피해
    for (const w of this.waves) {
      const step = S.wave.speed * dt;
      w.x += w.dx * step;
      w.z += w.dz * step;
      w.dist += step;
      w.age += dt;
      w.y += (World.groundHeight(w.x, w.z) + 1.0 - w.y) * Math.min(1, dt * 10);
      for (const e of Enemies.list) {
        if (e.dead || w.hit.has(e)) continue;
        if (Math.hypot(e.x - w.x, e.z - w.z) < S.wave.width / 2 + e.radius) {
          w.hit.add(e);
          Enemies.damage(e, S.wave.damage, w.x - w.dx, w.z - w.dz, p, w.pal.spark);
          Weapons.onHit(e, p, false);
        }
      }
      if (w.pal.id === 'laevateinn') {   // 불의 검기: 지나간 자리에 불꽃이 남음
        const rx = -w.dz, rz = w.dx, s = (Math.random() - 0.5) * 2.2;
        Particles.flame(w.x - w.dx * 0.8 + rx * s, w.y - 0.6 + Math.random() * 0.8, w.z - w.dz * 0.8 + rz * s, 0.35, undefined, 0.45);
      } else if (Math.random() < 0.7) {
        Particles.sparks(w.x, w.y, w.z, 1, w.pal.spark);
      }
      if (World.blocked(w.x, w.z, 0.1, true)) {   // 숲에 부딪혀 흩어짐
        Particles.sparks(w.x, w.y, w.z, 14, w.pal.spark);
        w.dist = Infinity;
      }
    }
    this.waves = this.waves.filter((w) => w.dist < S.wave.range);

    // 회전베기 중: 칼끝에서 불꽃 / 빛 알갱이가 흩날림
    if (p.spinTimer > 0 && !Camera.isFirst && Character.swordM) {
      const tip = M4.transformPoint(Character.swordM, [0, Weapons.cur.length * (0.6 + Math.random() * 0.4), 0]);
      if (Weapons.cur.id === 'laevateinn') for (let i = 0; i < 2; i++) Particles.flame(tip[0], tip[1], tip[2], 0.3, undefined, 0.4);
      else Particles.mote(tip[0], tip[1], tip[2], Weapons.cur.spark);
    }

    // 궁극기: 모으는 동안 어두워지고, 모이면 모든 적에게 차례로 떨어짐
    const u = this.ult;
    if (u) {
      u.t += dt;
      this.darken = Math.min(1, u.t / 0.8) * 0.75;
      if (u.t < S.ultimate.castTime && Math.random() < dt * 50) {   // 발밑에서 피어오르는 빛 / 불꽃
        const a = Math.random() * 6.28, r = 0.6 + Math.random() * 1.2, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
        if (u.kind === 'laevateinn') Particles.flame(x, p.groundY + 0.05, z, 0.3, undefined, 0.6);
        else if (u.kind === 'astrape') Particles.mote(x, p.groundY + 0.1, z, u.pal.spark);
        else Particles.glitter(x, p.groundY, z);
      }
      if (!u.fired && u.t >= S.ultimate.castTime) {
        u.fired = true;
        Sound.play('boom', { size: 1.2 });
        this.flash = 1;
        Camera.shake = Math.max(Camera.shake, 0.5);
        const targets = Enemies.list.filter((e) => !e.dead).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
        const fall = STRIKE_FALL[u.kind], ang = p.facing + (Math.random() - 0.5) * 1.2;   // 유성은 모두 용사가 바라보는 쪽 하늘에서 날아옴 (카메라에 잘 보이게)
        targets.forEach((e, i) => this.strikes.push({ e, kind: u.kind, pal: u.pal, delay: fall + 0.1 + i * 0.14, fall,
          life: STRIKE_LIFE[u.kind], max: STRIKE_LIFE[u.kind], done: false, x: e.x, y: e.groundY, z: e.z, dir: [Math.cos(ang), Math.sin(ang)] }));
      }
      if (u.fired && this.strikes.length === 0 && u.t > S.ultimate.castTime + 0.6) this.ult = null;
    } else {
      this.darken = Math.max(0, this.darken - dt * 1.5);
    }
    for (const s of this.strikes) {
      if (s.delay > 0) {   // 떨어지는 중: 적을 따라감
        s.delay -= dt;
        if (!s.e.dead) {
          s.x = s.e.x;
          s.z = s.e.z;
          s.y = s.e.groundY;
        }
        if (s.kind === 'laevateinn' && s.delay < s.fall) {   // 유성 꼬리에서 떨어지는 불꽃
          const m = this.meteorPos(s);
          Particles.flame(m[0], m[1], m[2], 0.7, undefined, 0.3, 0, 0.2, 0);
          if (Math.random() < 0.5) Particles.ember(m[0], m[1], m[2]);
        }
        continue;
      }
      if (!s.done) {
        s.done = true;
        this.strikeHit(s);
      }
      if (s.kind === 'astrape' && (!s.bolt || Math.random() < dt * 25)) {   // 번쩍번쩍 모양이 바뀜 (잔가지 포함)
        s.bolt = boltPoints(s.top, [s.x, s.y, s.z], 5, 0.35);
        s.branches = boltBranches(s.bolt, 4, 9);
      }
      s.life -= dt;
    }
    this.strikes = this.strikes.filter((s) => s.life > 0);

    // 콤보 마무리 폭발
    for (const b of this.bursts) {
      b.age += dt;
      if (b.kind === 'laevateinn' && b.age < 0.35) {   // 퍼져 나가는 고리를 따라 불꽃이 솟음 (불의 고리)
        const R = 0.4 + b.R * Utils.smooth(Math.min(1, (b.age / BURST_LIFE) * 2));
        for (let i = 0; i < 5; i++) {
          const a = Math.random() * 6.283;
          Particles.flame(b.x + Math.cos(a) * R, b.y + 0.05, b.z + Math.sin(a) * R, 0.3 + Math.random() * 0.2, undefined, 0.45, 0, 2.2, 0);
        }
      }
      if (b.kind === 'astrape' && (!b.bolt || Math.random() < dt * 25)) {
        b.bolt = boltPoints([b.x + (Math.random() - 0.5) * 4, b.y + 30, b.z + (Math.random() - 0.5) * 4], [b.x, b.y, b.z], 5, 0.35);
        b.branches = boltBranches(b.bolt, 3, 5);
      }
    }
    this.bursts = this.bursts.filter((b) => b.age < BURST_LIFE);

    // 번개 튐: 잠깐 뒤에 다음 적에게 번개 줄기가 이어지며 피해
    const astrape = WEAPONS[2];
    for (const c of this.chains) {
      c.delay -= dt;
      if (c.delay > 0 || c.used) continue;
      c.used = true;
      const e = c.e, to = [e.x, e.groundY + e.hitHeight, e.z];
      this.arcs.push({ a: c.src, b: to, life: 0.22, max: 0.22 });
      if (e.dead) continue;
      Enemies.dot(e, CONFIG.weapons.astrape.chainDamage, c.p, '#e0c4ff');
      e.flash = Math.max(e.flash, 0.08);
      Particles.sparks(to[0], to[1], to[2], 10, astrape.spark);
      this.impact(to[0], to[1], to[2], 0.5, astrape);
      this.chainNext(e, c.left, c.hit, c.p);
    }
    this.chains = this.chains.filter((c) => !c.used);
    for (const a of this.arcs) a.life -= dt;
    this.arcs = this.arcs.filter((a) => a.life > 0);

    // 섬광 돌진이 지나간 길: 한 박자 뒤에 베인 적들이 한꺼번에 터짐
    for (const s of this.slashes) {
      s.age += dt;
      if (s.fired || s.age < S.dash.delay) continue;
      s.fired = true;
      if (s.targets.length) Sound.play('slash');
      const d = Utils.normalize(s.bx - s.ax, s.bz - s.az);
      for (const e of s.targets) {
        if (e.dead) continue;
        const y = e.groundY + e.hitHeight;
        Enemies.damage(e, S.dash.damage, e.x - d.x, e.z - d.y, s.p, s.pal.spark);
        Weapons.onHit(e, s.p, true);
        this.impact(e.x, y, e.z, 1.3, s.pal);
        s.cuts.push({ x: e.x, y, z: e.z, rot: Math.random() * 0.6 });
      }
      for (let i = 0; i <= 6; i++) {   // 지나온 길을 따라 흙먼지
        const x = Utils.lerp(s.ax, s.bx, i / 6), z = Utils.lerp(s.az, s.bz, i / 6);
        Particles.dust(x, World.groundHeight(x, z), z, 1, 0.5);
      }
      if (s.targets.length) {
        Game.hitStop = Math.max(Game.hitStop, 0.14);
        Camera.shake = Math.max(Camera.shake, 0.45);
        this.flash = Math.max(this.flash, 0.3);
      } else {
        Camera.shake = Math.max(Camera.shake, 0.15);
      }
    }
    this.slashes = this.slashes.filter((s) => s.age < S.dash.delay + 0.6);

    for (const sm of this.summons) sm.age += dt;
    this.summons = this.summons.filter((sm) => sm.age < SUMMON_LIFE);
    this.flash = Math.max(0, this.flash - dt * 3);
    for (const h of this.impacts) h.age += dt;
    this.impacts = this.impacts.filter((h) => h.age < IMPACT_LIFE);
  },

  // 유성의 지금 위치 (하늘 높은 곳에서 비스듬히 적에게로)
  meteorFrom(s) {
    return [s.x + s.dir[0] * 22, s.y + 38, s.z + s.dir[1] * 22];
  },
  meteorPos(s) {
    const k = Utils.clamp(1 - s.delay / s.fall, 0, 1);
    return V3.add(this.meteorFrom(s), V3.scale(V3.sub([s.x, s.y + 0.3, s.z], this.meteorFrom(s)), k));
  },

  // 궁극기가 적에게 닿는 순간
  strikeHit(s) {
    const pal = s.pal;
    if (!s.e.dead) Enemies.damage(s.e, CONFIG.skills.ultimate.damage, s.x + 0.01, s.z, null, pal.spark);
    Sound.play('boom', { size: 0.9, x: s.x, z: s.z, range: 60 });
    Particles.sparks(s.x, s.y + 0.5, s.z, 30, pal.spark);
    Particles.dust(s.x, s.y, s.z, 8, 1.4);
    Camera.shake = Math.max(Camera.shake, 0.45);
    this.flash = Math.max(this.flash, 0.7);
    if (s.kind === 'astrape') {
      s.top = [s.x + (Math.random() - 0.5) * 12, s.y + 60, s.z + (Math.random() - 0.5) * 12];
      Particles.smoke(s.x, s.y + 0.3, s.z, 6);
    } else if (s.kind === 'laevateinn') {   // 유성 폭발: 사방으로 솟는 불꽃 + 검은 연기 + 불씨
      Particles.flameBurst(s.x, s.y + 0.1, s.z, 34, 1.2, 4.5, 0.6);
      Particles.smoke(s.x, s.y + 0.5, s.z, 10, [0.16, 0.12, 0.11]);
      for (let i = 0; i < 12; i++) Particles.ember(s.x + (Math.random() - 0.5) * 2, s.y + 0.5, s.z + (Math.random() - 0.5) * 2);
      if (!s.e.dead) {
        s.e.burn = CONFIG.weapons.laevateinn.burnTime;
        s.e.burnTick = 0.5;
      }
    } else {   // 빛의 검이 꽂힘: 금빛 반짝이가 피어오름
      for (let i = 0; i < 14; i++) Particles.glitter(s.x, s.y, s.z);
      Particles.smoke(s.x, s.y + 0.3, s.z, 4);
    }
  },

  // 이번 프레임의 빛나는 효과를 Glow에 채움
  buildGlow(eye, time, p) {
    Glow.clear();
    const S = CONFIG.skills, W = Weapons.cur;
    // 타격 섬광: 카메라를 향한 별 모양 빛살 + 가운데 둥근 빛 (애니메이션의 '팍!' 하는 순간)
    for (const h of this.impacts) {
      const k = h.age / IMPACT_LIFE, grow = 1 - Math.pow(1 - Math.min(1, k * 4), 2);
      glowStar(eye, [h.x, h.y, h.z], h.size * (0.5 + 0.7 * grow), 8, 1 - k, h.rot, 0.08 * (1 - 0.6 * k), 0.32 * (0.4 + 0.6 * grow), 0.6, h.pal);
    }
    Glow.top = Glow.data.length;
    Golem.glow(eye, time);   // 보스 공격 예고 원·충격파 (땅에 그려지므로 다른 물체에 가려짐)
    const showSword = !Camera.isFirst && Character.swordM && !p.dead;
    // 칼날을 따라 가끔 반짝 지나가는 빛 (애니메이션의 칼 번뜩임)
    const gp = (time % 3.2) / 0.45;
    if (showSword && gp < 1) {
      const pos = M4.transformPoint(Character.swordM, [0, 0.2 + gp * (W.length - 0.25), 0]);
      glowStar(eye, pos, 0.28, 4, Math.sin(gp * Math.PI), time * 2, 0.06, 0.12, 0.05);
    }
    if (showSword && W.id === 'laevateinn') {   // 레바테인: 칼날 둘레가 열기로 일렁이며 빛남
      const pts = linePts(M4.transformPoint(Character.swordM, [0, 0.15, 0]), M4.transformPoint(Character.swordM, [0, W.length, 0]), 6);
      const pulse = 0.22 + 0.06 * Math.sin(time * 9);
      Glow.strip(pts, (t) => 0.3 * (1 - t * 0.6), (t) => rgba(W.mid, pulse * (1 - t * 0.5)), eye);
    }
    if (showSword && W.id === 'astrape') {   // 아스트라페: 칼날에서 튀는 작은 번개 불꽃
      const busy = p.isAttacking || p.spinTimer > 0 || p.dashTimer > 0;
      for (let n = 0; n < (busy ? 3 : 1); n++) {
        if (Math.random() > (busy ? 0.8 : 0.4)) continue;
        const y0 = 0.25 + Math.random() * (W.length - 0.4), reach = busy ? 0.6 : 0.3;
        const a = M4.transformPoint(Character.swordM, [0, y0, 0]);
        const b = M4.transformPoint(Character.swordM, [(Math.random() - 0.5) * reach, y0 + 0.1 + Math.random() * reach, (Math.random() - 0.5) * reach]);
        drawBolt(zigzag(a, b, 3, 0.45), eye, W, 0.9, 0.35);
      }
    }
    // 무기를 바꿀 때: 발밑 고리가 퍼지고 나선 빛 세 가닥이 몸을 감아 오름
    for (const sm of this.summons) {
      const k = sm.age / SUMMON_LIFE, a = 1 - k, y = p.groundY + 0.08, pal = sm.pal;
      glowRing(p.x, y, p.z, 0.4 + 2.2 * Utils.smooth(Math.min(1, k * 1.6)), 0.2 * a + 0.03, pal.mid, a);
      glowDisc(p.x, y, p.z, 1.4, pal.mid, 0.5 * a);
      const top = 2.6 * Math.min(1, k * 2.2);
      for (let s = 0; s < 3; s++) {
        const pts = [];
        for (let i = 0; i <= 16; i++) {
          const h = (i / 16) * top, ang = s * 2.094 + h * 2.6 + sm.age * 7, r = 0.85 * (1 - h / 4);
          pts.push([p.x + Math.cos(ang) * r, y + h, p.z + Math.sin(ang) * r]);
        }
        Glow.strip(pts, (t) => 0.12 * Math.sin(Math.PI * t) + 0.02, (t) => rgba(pal.core, a * (0.3 + 0.7 * t)), eye);
      }
      if (showSword && k < 0.5) glowStar(eye, M4.transformPoint(Character.swordM, [0, Weapons.cur.length, 0]), 0.7 * (1 - k * 2), 6, 1 - k * 2, time * 3, 0.07, 0.25, 0.05, pal);
    }
    // 검기: 세로로 선 초승달 모양의 빛 칼날 (뒤로 잔상 2개)
    for (const w of this.waves) {
      const f = [w.dx, 0, w.dz], r = [-w.dz, 0, w.dx], pal = w.pal;
      const fade = Math.min(1, w.age * 8) * Math.min(1, (S.wave.range - w.dist) / 3);
      for (let echo = 0; echo < 3; echo++) {
        const back = echo * 0.7, a0 = fade * (1 - echo * 0.35);
        const c = [w.x - w.dx * (1.0 + back), w.y, w.z - w.dz * (1.0 + back)];
        const pts = [];
        for (let i = 0; i <= 12; i++) {
          const th = -1.1 + (i / 12) * 2.2;
          const R = 1.4 - echo * 0.15;
          pts.push({ p: V3.add(c, V3.add(V3.scale(f, Math.cos(th) * R), V3.scale(r, Math.sin(th) * R))), k: Math.cos(th * 1.3) });
        }
        for (let i = 0; i < 12; i++) {
          const A = pts[i], B = pts[i + 1];
          const ha = 0.15 + 0.45 * Math.max(0, A.k), hb = 0.15 + 0.45 * Math.max(0, B.k);
          const tint = echo === 0 ? V3.scale(pal.core, 0.92) : V3.scale(pal.mid, 1.1);   // 맨 앞 칼날은 하얗게, 잔상은 속성 색
          const ca = rgba(tint, a0 * Math.max(0, A.k)), cb = rgba(tint, a0 * Math.max(0, B.k));
          const ea = rgba(pal.mid, 0), eb = ea;
          const up = (q, h) => [q[0], q[1] + h, q[2]];
          Glow.quad(up(A.p, -ha), A.p, B.p, up(B.p, -hb), ea, ca, cb, eb);
          Glow.quad(A.p, up(A.p, ha), up(B.p, hb), B.p, ca, ea, eb, cb);
        }
      }
      if (pal.id === 'astrape' && Math.random() < 0.7) {   // 번개의 검기: 칼날 끝에서 번개가 튐
        const s = (Math.random() - 0.5) * 2.4, c = [w.x + r[0] * s, w.y + (Math.random() - 0.5) * 0.8, w.z + r[2] * s];
        drawBolt(zigzag(c, V3.add(c, [(Math.random() - 0.5) * 1.6, (Math.random() - 0.3) * 1.2, (Math.random() - 0.5) * 1.6]), 3, 0.5), eye, pal, 0.9, 0.5);
      }
    }
    // 3인칭 칼질: 칼이 지나간 자리에 초승달 모양 빛 (오른쪽 위 → 왼쪽 아래로 비스듬히)
    // 바깥 가장자리는 하얗게 빛나는 칼날 선, 안쪽으로 갈수록 속성 색으로 흐려짐. 다 벤 뒤 잠깐 남았다가 가늘어지며 사라짐
    const c = CONFIG.player, recover = c.attackCooldown - c.attackTime;
    const sw = p.attackTimer > 0 ? 1 - p.attackTimer / c.attackTime : p.attackCooldown > 0 ? 1 + (recover - p.attackCooldown) / c.attackTime : 9;
    if (!Camera.isFirst && !p.spinTimer && !p.isDodging && sw > 0.15 && sw < 1.6) {
      const k = 1 - Math.pow(1 - Math.min(1, (sw - 0.15) / 0.75), 3);   // 칼끝이 지나간 정도 (빠르게 나갔다가 멈춤)
      const fade = sw < 1 ? 1 : 1 - (sw - 1) / 0.6;
      // 콤보 동작마다 다른 궤적: 0 오른쪽 위 → 왼쪽 아래, 1 왼쪽 아래 → 오른쪽 위, 2 머리 위 → 앞쪽 땅 (내려찍기)
      const combo = p.combo || 0;
      let start, end, R, pt;
      if (combo < 2) {
        // 기울어진 면: 오른쪽은 높고 왼쪽은 낮게 + 앞쪽을 들어 올려 뒤(카메라)에서도 초승달 면이 보이게
        const back = combo === 1, base = back ? 1.1 : 0.95, slope = back ? 0.24 : 0.36;
        start = p.facing + (back ? -1.35 : 1.3);
        end = p.facing + (back ? 1.4 : -1.45);
        R = 1.95 * (W.length / 1.24);   // 긴 칼일수록 궤적도 크게
        pt = (a, rad) => {
          const fwd = Math.cos(a - p.facing) * rad, side = Math.sin(a - p.facing) * rad;
          return [p.x + Math.cos(a) * rad, p.groundY + base + fwd * 0.45 + side * slope, p.z + Math.sin(a) * rad];
        };
      } else {
        // 세로 면을 왼쪽으로 돌리고 위쪽을 오른쪽으로 기울임 → 오른쪽 위에서 왼쪽 앞 땅으로 내리치는 사선 (뒤에서 봐도 초승달이 보임)
        start = 2.0; end = -0.55; R = 1.8 * (W.length / 1.24);
        const dx = Math.cos(p.facing - 0.45), dz = Math.sin(p.facing - 0.45), rx = -Math.sin(p.facing), rz = Math.cos(p.facing);
        const tu = Math.cos(0.5), tr = Math.sin(0.5);
        pt = (a, rad) => {
          const f = Math.cos(a) * rad + 0.2, u = Math.sin(a) * rad, r = 0.2 + u * tr;
          return [p.x + dx * f + rx * r, p.groundY + 1.3 + u * tu, p.z + dz * f + rz * r];
        };
      }
      glowCrescent(pt, start, start + (end - start) * k, R, (combo === 2 ? 1.0 : 0.85) * fade, fade, 26);
    }
    // 회전베기: 칼날 뒤를 따라 도는 큰 초승달 + 아래쪽에 한 겹 더 (회오리처럼)
    if (p.spinTimer > 0 && !Camera.isFirst) {
      const k = 1 - p.spinTimer / S.spin.time;
      const fade = Math.min(1, k * 6) * Math.min(1, (1 - k) * 4);
      const cur = p.facing + Utils.smooth(k) * Math.PI * 2;
      const ring = (y, wob) => (a, rad) => [p.x + Math.cos(a) * rad, p.groundY + y + Math.sin(a * 2 + k * 3) * wob, p.z + Math.sin(a) * rad];
      glowCrescent(ring(1.0, 0.12), cur - 3.4, cur, S.spin.radius * 0.85, 1.3 * fade, fade, 30);
      glowCrescent(ring(0.5, 0.06), cur - 2.6, cur - 0.4, S.spin.radius * 0.7, 0.8 * fade, fade * 0.5, 20);
      if (W.id === 'astrape' && Math.random() < 0.8) {   // 번개 회오리: 원을 따라 번개가 튐
        const a = cur - Math.random() * 3, R = S.spin.radius * (0.6 + Math.random() * 0.35);
        const q = [p.x + Math.cos(a) * R, p.groundY + 0.4 + Math.random() * 0.9, p.z + Math.sin(a) * R];
        drawBolt(zigzag(q, [q[0] + (Math.random() - 0.5) * 1.2, q[1] + (Math.random() - 0.5) * 0.8, q[2] + (Math.random() - 0.5) * 1.2], 3, 0.5), eye, W, 0.9, 0.5);
      }
    }
    // 섬광 돌진: 지나가는 동안 가는 빛줄기, 한 박자 뒤 굵게 번쩍이며 베임 + 맞은 적마다 X자 칼선
    if (p.dashTimer > 0 && p.dashFrom) {
      const a = [p.dashFrom.x, p.dashFrom.y + 1.0, p.dashFrom.z], b = [p.x, p.groundY + 1.0, p.z];
      glowCut(eye, a, b, 0.35, W, 1);
    }
    for (const s of this.slashes) {
      const a = [s.ax, s.ay + 1.0, s.az], b = [s.bx, s.by + 1.0, s.bz];
      if (!s.fired) {
        glowCut(eye, a, b, 0.3, s.pal, 0.9);
        continue;
      }
      const k = (s.age - S.dash.delay) / 0.6, al = 1 - k;
      glowCut(eye, a, b, 0.3 + 2.4 * (1 - k) * (1 - k), s.pal, al);
      // 땅에 남은 빛나는 칼자국 (지나온 길을 따라 가늘고 길게)
      const g0 = [s.ax, s.ay + 0.06, s.az], g1 = [s.bx, s.by + 0.06, s.bz], gd = V3.normalize(V3.sub(g1, g0)), gs = [-gd[2], 0, gd[0]];
      const gw = 0.35 * (1 - k * 0.5), gc = rgba(s.pal.core, al * 0.8), ge = rgba(s.pal.mid, 0);
      Glow.quad(V3.sub(g0, V3.scale(gs, gw * 0.3)), g0, g1, V3.sub(g1, V3.scale(gs, gw)), ge, gc, gc, ge);
      Glow.quad(g0, V3.add(g0, V3.scale(gs, gw * 0.3)), V3.add(g1, V3.scale(gs, gw)), g1, gc, ge, ge, gc);
      for (const ct of s.cuts) {   // X자 칼선: 카메라에서 볼 때 비스듬히 교차 (적 몸에 묻히지 않게 카메라 쪽으로 당겨 그림)
        const f = V3.normalize(V3.sub([ct.x, ct.y, ct.z], eye)), r = V3.normalize(V3.cross(f, [0, 1, 0])), u = V3.cross(r, f);
        const len = 2.1 * (0.5 + 0.5 * Math.min(1, k * 8));
        const m = V3.sub([ct.x, ct.y, ct.z], V3.scale(f, 0.9));
        for (const ang of [0.7 + ct.rot, -0.7 + ct.rot]) {
          const d = V3.add(V3.scale(r, Math.cos(ang) * len), V3.scale(u, Math.sin(ang) * len));
          glowCut(eye, V3.sub(m, d), V3.add(m, d), 0.7 * (1 - k * 0.6), s.pal, Math.min(1, al * 1.4));
        }
      }
    }
    // 궁극기 모으기: 검 끝에서 하늘로 솟는 빛기둥 + 발밑의 마법진
    if (this.ult && !this.ult.fired) {
      const pal = this.ult.pal;
      const k = Math.min(1, this.ult.t / S.ultimate.castTime);
      const base = !Camera.isFirst && Character.swordM ? M4.transformPoint(Character.swordM, [0, W.length, 0]) : [p.x, p.groundY + 2.4, p.z];   // 검 끝에서 솟음
      const sky = [base[0], base[1] + 60 * k, base[2]];
      Glow.ribbon([base, sky], 0.35, rgba(V3.scale(pal.core, 0.85), 0.9 * k), eye);
      Glow.ribbon([base, sky], 1.6, rgba(pal.mid, 0.35 * k), eye);
      glowStar(eye, base, 0.9 + 0.3 * Math.sin(time * 20), 8, Math.min(1, k * 2), time * 2, 0.06, 0.3, 0.1, pal);   // 검 끝에 모이는 빛
      // 발밑의 마법진: 겹 고리 + 서로 반대로 도는 두 삼각형(육망성) + 고리 사이를 도는 룬 눈금
      const y = p.groundY + 0.14, grow = Utils.smooth(Math.min(1, this.ult.t * 2.5)), a = grow;   // 풀 위로 살짝 띄움
      const at = (ang, rad) => [p.x + Math.cos(ang) * rad * grow, y, p.z + Math.sin(ang) * rad * grow];
      const cc = rgba(V3.scale(pal.core, 0.8), a), e = rgba(pal.mid, 0);
      const line = (P, Q, w) => {   // 땅 위의 빛나는 선 (가운데 진하고 양옆은 투명)
        const d = V3.normalize(V3.sub(Q, P)), s = [-d[2] * w, 0, d[0] * w];
        Glow.quad(V3.sub(P, s), P, Q, V3.sub(Q, s), e, cc, cc, e);
        Glow.quad(P, V3.add(P, s), V3.add(Q, s), Q, cc, e, e, cc);
      };
      const ring = (R, w) => {
        for (let i = 0; i < 48; i++) line(at((i / 48) * 6.283, R), at(((i + 1) / 48) * 6.283, R), w);
      };
      ring(2.4, 0.11);
      ring(2.0, 0.08);
      ring(0.9, 0.08);
      for (const [dir, off] of [[1, 0], [-1, Math.PI / 3]]) {
        const r0 = time * 0.7 * dir + off;
        for (let i = 0; i < 3; i++) line(at(r0 + (i / 3) * 6.283, 2.0), at(r0 + ((i + 1) / 3) * 6.283, 2.0), 0.08);
      }
      for (let i = 0; i < 24; i++) {   // 룬 눈금
        const ang = (i / 24) * 6.283 - time * 1.2;
        line(at(ang, 2.07), at(ang, i % 3 ? 2.2 : 2.33), 0.05);
      }
    }
    // 궁극기가 떨어짐: 무기마다 다른 모습
    for (const s of this.strikes) {
      const pal = s.pal;
      if (s.kind === 'astrape') {   // 번개: 가운데 하얀 줄기 + 넓은 빛 + 땅에 번지는 빛
        if (!s.done || !s.bolt) continue;
        const a = Math.min(1, s.life / 0.3);
        Glow.ribbon(s.bolt, 0.28, rgba(pal.core, a), eye);
        Glow.ribbon(s.bolt, 1.8, rgba(pal.mid, 0.35 * a), eye);
        for (const br of s.branches || []) {
          Glow.ribbon(br, 0.1, rgba(pal.core, 0.8 * a), eye);
          Glow.ribbon(br, 0.7, rgba(pal.mid, 0.25 * a), eye);
        }
        glowDisc(s.x, s.y + 0.06, s.z, 2.5 * (1 - s.life / s.max) + 0.5, V3.scale(V3.add(pal.core, pal.mid), 0.4), 0.8 * a);
      } else if (s.kind === 'balmung') {   // 하늘에서 거대한 빛의 검이 내리꽂힘 → 땅에 박힌 채 빛나다 사라짐
        if (!s.done) {
          if (s.delay >= s.fall) continue;
          const k = 1 - s.delay / s.fall, tipY = s.y + 30 * (1 - k * k);
          glowGiantSword(eye, [s.x, tipY, s.z], 6.5, Math.min(1, k * 3), pal);
          Glow.strip(linePts([s.x, tipY + 7.5, s.z], [s.x, tipY + 22, s.z], 4), (t) => 0.9 * (1 - t), (t) => rgba(pal.mid, 0.4 * (1 - t)), eye);   // 떨어지는 빛 꼬리
        } else {
          const a = s.life / s.max, k = 1 - a;
          glowGiantSword(eye, [s.x, s.y - 1.3, s.z], 6.5, Math.min(1, a * 1.6), pal);
          glowRing(s.x, s.y + 0.08, s.z, 0.5 + 4.2 * Utils.smooth(Math.min(1, k * 2)), 0.35 * a + 0.05, pal.mid, a);
          glowDisc(s.x, s.y + 0.06, s.z, 2.6, pal.mid, 0.7 * a);
        }
      } else {   // 불타는 유성: 꼬리를 끌며 비스듬히 떨어짐 → 폭발 고리
        if (!s.done) {
          if (s.delay >= s.fall) continue;
          const m = this.meteorPos(s), back = V3.normalize(V3.sub(this.meteorFrom(s), m));
          const tail = linePts(m, V3.add(m, V3.scale(back, 9)), 8);
          Glow.strip(tail, (t) => 1.6 * (1 - t), (t) => rgba(pal.mid, 0.55 * (1 - t)), eye);
          Glow.strip(tail, (t) => 0.5 * (1 - t), (t) => rgba(pal.core, 0.9 * (1 - t)), eye);
          glowStar(eye, m, 1.4, 8, 1, time * 4, 0.1, 0.5, 0.3, pal);
        } else {
          const a = s.life / s.max, k = 1 - a;
          glowRing(s.x, s.y + 0.08, s.z, 0.6 + 5 * Utils.smooth(Math.min(1, k * 1.8)), 0.5 * a + 0.05, pal.mid, a);
          glowDisc(s.x, s.y + 0.06, s.z, 3.2, pal.mid, 0.9 * a);
          if (k < 0.35) glowStar(eye, [s.x, s.y + 0.8, s.z], 2.6 * (1 - k * 2), 10, 1 - k / 0.35, s.x, 0.09, 0.45, 0.5, pal);
        }
      }
    }
    // 콤보 마무리 폭발: 퍼지는 고리 + 빛의 기둥 / 열기 기둥 / 낙뢰
    for (const b of this.bursts) {
      const k = b.age / BURST_LIFE, a = 1 - k, pal = b.pal, y = b.y + 0.08;
      glowRing(b.x, y, b.z, 0.4 + b.R * Utils.smooth(Math.min(1, k * 2)), 0.28 * a + 0.03, pal.mid, a);
      glowDisc(b.x, y - 0.02, b.z, b.R * 0.8, pal.mid, 0.6 * a);
      if (b.kind === 'balmung') {
        const h = 9 * Math.min(1, k * 5), al = Math.pow(a, 1.5);
        Glow.strip(linePts([b.x, b.y, b.z], [b.x, b.y + h, b.z], 4), (t) => 0.5 * (1 - t * 0.5), (t) => rgba(pal.core, al * (1 - t)), eye);
        Glow.strip(linePts([b.x, b.y, b.z], [b.x, b.y + h, b.z], 4), (t) => 2.4 * (1 - t * 0.3), (t) => rgba(pal.mid, 0.35 * al * (1 - t)), eye);
        if (k < 0.4) glowStar(eye, [b.x, b.y + 0.4, b.z], 1.2 * (1 - k * 2), 8, 1 - k / 0.4, 0.3, 0.08, 0.35, 0.3, pal);
      } else if (b.kind === 'laevateinn') {
        Glow.strip(linePts([b.x, b.y, b.z], [b.x, b.y + 3.5, b.z], 4), (t) => 1.8 * (1 - t * 0.4), (t) => rgba(pal.mid, 0.3 * a * (1 - t)), eye);
      } else if (b.bolt && b.age < 0.3) {
        const al = 1 - b.age / 0.3;
        Glow.ribbon(b.bolt, 0.22, rgba(pal.core, al), eye);
        Glow.ribbon(b.bolt, 1.4, rgba(pal.mid, 0.35 * al), eye);
        for (const br of b.branches || []) drawBolt(br, eye, pal, 0.8 * al, 1);
      }
    }
    // 번개 튐: 적과 적 사이를 잇는 번개 줄기 (매 프레임 모양이 바뀜)
    for (const e of Enemies.list) {   // 감전되어 쓰러지는 적: 몸 둘레에 번개가 튐
      if (!e.dead || e.deathKind !== 'astrape' || e.deathTimer < 0.3) continue;
      for (let n = 0; n < 2; n++) {
        const y = e.groundY + e.dy + e.hitHeight * 0.7, r = e.radius + 0.25;
        const rp = () => [e.x + (Math.random() - 0.5) * r * 2, y + (Math.random() - 0.5) * e.hitHeight * 1.2, e.z + (Math.random() - 0.5) * r * 2];
        drawBolt(zigzag(rp(), rp(), 3, 0.5), eye, WEAPONS[2], 0.9, 0.6);
      }
    }
    for (const ar of this.arcs) {
      const pts = zigzag(ar.a, ar.b, 4, 0.25), al = ar.life / ar.max;
      drawBolt(pts, eye, WEAPONS[2], al, 1.7);
      for (const br of boltBranches(pts, 2, 0.8)) drawBolt(br, eye, WEAPONS[2], al * 0.8, 0.8);
    }
  },
};
