// 3D 화면 그리기: 그림자 지도 → 하늘 → 땅·나무·풀·먼 산 → 전사(외곽선) → 물 → 꽃가루 → (1인칭) 손과 검 → 후처리

// 테마별 빛과 하늘 (밝기 숫자는 1보다 커도 됨: 마지막에 화면에 맞게 눌러 줌)
const LIGHTING = {
  forest: {
    sunDir: V3.normalize([-0.6, 0.55, 0.58]),   // 해가 있는 방향 (서남쪽, 늦은 오후)
    sunColor: [2.15, 1.8, 1.36],                // 햇빛 (따뜻한 금빛)
    skyColor: [0.4, 0.55, 0.8],                 // 위에서 오는 하늘빛
    groundColor: [0.2, 0.18, 0.1],              // 아래에서 반사되는 땅빛
    fogColor: [0.56, 0.71, 0.9],                // 안개 = 지평선 하늘 색 (맑은 푸른빛)
    zenith: [0.1, 0.3, 0.85],                   // 머리 위 하늘 색 (짙고 맑은 파랑)
    cloudLit: [1.3, 1.24, 1.15],                // 구름의 볕 받은 쪽 색
    cloudShade: [0.58, 0.64, 0.78],             // 구름 그늘 색
    rays: 1,                                    // 빛줄기 세기
    particles: true,                            // 떠다니는 빛 알갱이
    particleColor: [1.0, 0.93, 0.65],           // 꽃가루 (금빛)
  },
  // 노을 진 저녁 숲: 낮게 깔린 주황빛 해, 보랏빛 하늘, 분홍빛 구름, 반딧불
  dusk: {
    sunDir: V3.normalize([0.75, 0.2, -0.55]),   // 출구 쪽(동북쪽) 지평선 가까이 낮은 해 → 길게 늘어진 그림자, 역광
    sunColor: [2.3, 0.92, 0.34],
    skyColor: [0.22, 0.19, 0.42],
    groundColor: [0.16, 0.09, 0.07],
    fogColor: [0.95, 0.58, 0.45],
    zenith: [0.12, 0.13, 0.42],
    cloudLit: [1.5, 0.9, 0.6],
    cloudShade: [0.44, 0.34, 0.56],
    rays: 1.5,
    particles: true,
    particleColor: [0.8, 1.0, 0.35],            // 반딧불 (연둣빛)
    grade: [1.1, 0.86, 0.84],                   // 화면 전체를 주홍빛 저녁 색으로
  },
};

const IDENTITY = M4.identity();

// 카메라가 보는 범위(시야 사각뿔)의 6면. 행렬 m = 투영 x 카메라
function frustumPlanes(m) {
  const row = (i) => [m[i], m[i + 4], m[i + 8], m[i + 12]];
  const r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3);
  const comb = (a, s) => r3.map((v, i) => v + s * a[i]);
  return [comb(r0, 1), comb(r0, -1), comb(r1, 1), comb(r1, -1), comb(r2, 1), comb(r2, -1)];
}

// 상자가 시야 안에 조금이라도 걸치는지
function boxVisible(planes, box) {
  for (const [a, b, c, d] of planes) {
    const x = a > 0 ? box.max[0] : box.min[0];
    const y = b > 0 ? box.max[1] : box.min[1];
    const z = c > 0 ? box.max[2] : box.min[2];
    if (a * x + b * y + c * z + d < 0) return false;
  }
  return true;
}

// 점에서 상자까지 가장 가까운 거리
function boxDistance(box, p) {
  let s = 0;
  for (let k = 0; k < 3; k++) {
    const d = Math.max(box.min[k] - p[k], 0, p[k] - box.max[k]);
    s += d * d;
  }
  return Math.sqrt(s);
}

// 모델이 차지하는 상자 (외곽선 두께를 맞출 때 사용)
function boundsOf(b) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < b.pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      mn[k] = Math.min(mn[k], b.pos[i + k]);
      mx[k] = Math.max(mx[k], b.pos[i + k]);
    }
  }
  return { c: mn.map((v, k) => (v + mx[k]) / 2), s: mn.map((v, k) => Math.max(mx[k] - v, 0.01)) };
}

const Renderer = {
  p: {},           // 셰이더 프로그램들
  shadow: null,    // 그림자 지도
  particles: null,
  partMesh: {},    // 관절로 움직이는 몸 부분 모델 (기사·적·화살)
  partBox: {},     // 부분별 크기 (외곽선 두께 맞추기용)
  vp: null,        // 마지막 화면의 '투영 x 카메라' 행렬 (글자를 3D 위치에 띄울 때 사용)

  init() {
    const gl = GL.gl;
    for (const name of ['world', 'shadow', 'sky', 'particle', 'trail', 'outline', 'water', 'fx', 'barrier', 'glow', 'ghost']) {
      this.p[name] = GL.program(SHADERS[name + 'VS'], SHADERS[name + 'FS']);
    }
    this.skyVao = gl.createVertexArray();   // 하늘은 정점 데이터 없이 셰이더에서 만듦
    this.leafTex = GL.createTexture(Models.leafTexture);
    this.armMesh = GL.createMesh(Models.arm);
    const register = (name, b) => {
      this.partMesh[name] = GL.createMesh(b);
      this.partBox[name] = boundsOf(b);
    };
    for (const name in Character.parts) register(name, Character.parts[name]);
    for (const name in Enemies.models) register(name, Enemies.models[name]);
    Weapons.models.forEach((b, i) => register('weapon' + i, b));   // 무기 3종 ('weapon0' 발뭉, 'weapon1' 레바테인, 'weapon2' 아스트라페)
    this.initShadow();
    this.initParticles();
    this.initTrail();
    this.initFX();
    Post.init();
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
  },

  // 그림자 지도 두 장: 넓은 것(멀리까지) + 촘촘한 것(전사 주변만, 그림자가 또렷함)
  initShadow() {
    this.shadow = this.makeShadow(CONFIG.graphics.shadowSize);
    this.shadowNear = this.makeShadow(2048);
  },

  // 그림자 지도: 해 쪽에서 본 '가장 가까운 물체까지 거리'를 그리는 그림
  makeShadow(size) {
    const gl = GL.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
    gl.clear(gl.DEPTH_BUFFER_BIT);   // 그림자를 꺼도 '그림자 없음' 상태가 되도록
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo, size };
  },

  initParticles() {
    const gl = GL.gl, n = 280, rnd = Utils.rng(3);
    const data = new Float32Array(n * 3).map(() => rnd());
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.particles = { vao, n };
  },

  // 나비·새·낙엽·먼지용 버퍼 (매 프레임 새로 채움). 점마다 숫자 10개
  initFX() {
    const gl = GL.gl;
    this.fxVao = gl.createVertexArray();
    gl.bindVertexArray(this.fxVao);
    this.fxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fxBuf);
    gl.bufferData(gl.ARRAY_BUFFER, 40 * 512, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 40, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 40, 28);
    gl.bindVertexArray(null);
  },

  // 스킬의 빛 (Glow에 모인 삼각형): 빛을 더하는 방식
  drawGlow(proj, view) {
    const data = Glow.data;
    if (!data.length) return;
    const gl = GL.gl, P = this.p.glow;
    if (!this.glowVao) {
      this.glowVao = gl.createVertexArray();
      gl.bindVertexArray(this.glowVao);
      this.glowBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.glowBuf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
    }
    gl.bindVertexArray(this.glowVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glowBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);
    gl.useProgram(P.prog);
    gl.uniformMatrix4fv(P.u.uProj, false, proj);
    gl.uniformMatrix4fv(P.u.uView, false, view);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(false);
    const top = Glow.top / 7;   // 앞쪽 일부(타격 섬광)는 무엇에도 가려지지 않게
    if (top > 0) {
      gl.disable(gl.DEPTH_TEST);
      gl.drawArrays(gl.TRIANGLES, 0, top);
      gl.enable(gl.DEPTH_TEST);
    }
    if (data.length / 7 > top) gl.drawArrays(gl.TRIANGLES, top, data.length / 7 - top);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
  },

  drawFX(proj, view, time, H) {
    if (!Particles.list.length) return;
    const gl = GL.gl, P = this.p.fx;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fxBuf);
    gl.bufferData(gl.ARRAY_BUFFER, Particles.data(), gl.DYNAMIC_DRAW);
    gl.useProgram(P.prog);
    gl.uniformMatrix4fv(P.u.uProj, false, proj);
    gl.uniformMatrix4fv(P.u.uView, false, view);
    gl.uniform1f(P.u.uScale, (H * proj[5]) / 2);
    gl.uniform1f(P.u.uTime, time);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    gl.depthMask(false);
    gl.bindVertexArray(this.fxVao);
    gl.drawArrays(gl.POINTS, 0, Particles.list.length);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  },

  initTrail() {
    const gl = GL.gl;
    this.trailVao = gl.createVertexArray();
    gl.bindVertexArray(this.trailVao);
    this.trailBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.trailBuf);
    gl.bufferData(gl.ARRAY_BUFFER, 16 * 64, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12);
    gl.bindVertexArray(null);
  },

  draw(player, time) {
    const gl = GL.gl;
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const L = LIGHTING[World.level.theme];
    const eye = Camera.eye;
    const near = 0.05, far = 1000;
    const proj = M4.perspective(Utils.rad(CONFIG.graphics.fov + player.fovKick), W / H, near, far);
    let view = M4.lookAt(eye, Camera.look, [0, 1, 0]);
    if (Camera.isFirst) view = M4.multiply(M4.rotationZ(player.roll), view);
    const lightVP = this.lightMatrix(player, L, 38, 14, 120, this.shadow.size);
    this.lightVP = lightVP;
    this.lightVPNear = this.lightMatrix(player, L, 9, 2, 40, this.shadowNear.size);
    const body = Character.matrices(player);
    const foes = Enemies.parts(time);
    this.vp = M4.multiply(proj, view);

    if (CONFIG.graphics.shadows) {
      this.drawShadowMap(lightVP, this.shadow, time, body.concat(foes), player);
      this.drawShadowMap(this.lightVPNear, this.shadowNear, time, body.concat(foes), player);
    }

    // 연못이 화면에 보이면 물에 비친 모습을 먼저 그려 둠
    if (W !== Post.w || H !== Post.h) Post.resize(W, H);
    this.hasRefl = !!(World.water && CONFIG.graphics.reflections && boxVisible(frustumPlanes(this.vp), World.waterBox));
    if (this.hasRefl) this.drawReflection(proj, view, eye, L, time, player, Camera.isFirst ? foes : body.concat(foes));

    Post.begin(W, H);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const skyVP = this.drawSky(proj, view, L, time);
    const u = this.drawWorld(proj, view, lightVP, eye, L, time, player);
    const blink = player.hurtTimer > 0 && Math.floor(time * 16) % 2 === 0;   // 맞은 직후 깜빡임
    const showBody = !Camera.isFirst && !blink;
    this.drawParts(u, showBody ? body.concat(foes) : foes, proj, view, time);
    if (showBody && Cape.mesh) this.drawCape(u);
    if (!Camera.isFirst && Character.ghosts.length) this.drawGhosts(proj, view, eye, time);
    if (World.water) this.drawWater(proj, view, lightVP, eye, L, time);
    if (World.gate) this.drawGateFX(proj, view, eye, time);
    this.drawFX(proj, view, time, H);
    Skills.buildGlow(eye, time, player);
    this.drawGlow(proj, view);
    if (L.particles) this.drawParticles(proj, view, eye, time, H);
    Post.captureDepth();

    if (Camera.isFirst) {   // 손과 검은 다른 물체에 파묻히지 않게 깊이를 지우고 맨 앞에 그림
      gl.clear(gl.DEPTH_BUFFER_BIT);
      this.drawViewModel(M4.perspective(Utils.rad(60), W / H, 0.01, 10), view, lightVP, eye, L, time, player);
    }

    // 화면 속 해의 위치 → 빛줄기
    const s = L.sunDir;
    const cx = skyVP[0] * s[0] + skyVP[4] * s[1] + skyVP[8] * s[2];
    const cy = skyVP[1] * s[0] + skyVP[5] * s[1] + skyVP[9] * s[2];
    const cw = skyVP[3] * s[0] + skyVP[7] * s[1] + skyVP[11] * s[2];
    const facing = V3.dot(V3.normalize(V3.sub(Camera.look, eye)), s);
    const rayStrength = cw > 0 && CONFIG.graphics.godRays ? L.rays * Utils.smooth((facing - 0.1) / 0.6) : 0;
    const pal = Skills.ult ? Skills.ult.pal : Weapons.cur;   // 번쩍임 색은 궁극기를 쓴 무기의 속성 색 (어둡게 물드는 것은 세상·하늘을 그릴 때 이미 처리)
    Post.end({ sunUV: [(cx / cw) * 0.5 + 0.5, (cy / cw) * 0.5 + 0.5], rayStrength: rayStrength * (1 - Skills.darken), rayColor: V3.scale(L.sunColor, 0.18), proj, near, far,
      flash: Skills.flash, flashColor: pal.flash, grade: L.grade });
  },

  // 해 쪽에서 내려다보는 카메라: 전사 앞쪽 ahead(m) 지점을 중심으로 가로세로 2R(m), 깊이 ±depth(m)
  lightMatrix(player, L, R, ahead, depth, size) {
    const f = player.forward();
    const cx = player.x + f[0] * ahead, cz = player.z + f[2] * ahead;
    const lv = M4.lookAt(L.sunDir, [0, 0, 0], [0, 1, 0]);
    const c = M4.transformPoint(lv, [cx, World.groundHeight(cx, cz), cz]);
    const t = (2 * R) / size;   // 그림자 한 칸 단위로 맞춰 움직여야 그림자 테두리가 떨리지 않음
    const sx = Math.round(c[0] / t) * t, sy = Math.round(c[1] / t) * t;
    return M4.multiply(M4.ortho(sx - R, sx + R, sy - R, sy + R, -c[2] - depth, -c[2] + depth), lv);
  },

  drawShadowMap(lightVP, target, time, parts, player) {
    const gl = GL.gl, P = this.p.shadow;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, target.size, target.size);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2, 4);   // 표면에 얼룩 그림자가 생기지 않게 살짝 밀어 줌
    gl.useProgram(P.prog);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.leafTex);
    gl.uniform1i(P.u.uLeafTex, 1);   // 잎 판은 잎 모양대로 그림자 (0번은 지금 그리는 그림자 지도라 쓰면 안 됨)
    gl.uniformMatrix4fv(P.u.uLightVP, false, lightVP);
    gl.uniformMatrix4fv(P.u.uModel, false, IDENTITY);
    gl.uniform1f(P.u.uTime, time);
    gl.uniform1f(P.u.uGrass, 0);
    gl.uniform3fv(P.u.uPlayerPos, [player.x, 0, player.z]);
    gl.disable(gl.CULL_FACE);   // 잎 판·얇은 면도 그림자를 드리우게
    const planes = frustumPlanes(lightVP);
    const inLight = (box) => boxVisible(planes, box);
    for (const m of World.meshes) if (m.shadow) GL.drawMesh(m.mesh, inLight);
    for (const part of parts) {   // 전사(1인칭에서도)·적·화살의 그림자
      gl.uniformMatrix4fv(P.u.uModel, false, part.m);
      GL.drawMesh(this.partMesh[part.mesh]);
    }
    if (Cape.mesh && Cape.pts) {   // 망토 그림자
      gl.uniformMatrix4fv(P.u.uModel, false, IDENTITY);
      GL.drawMesh(Cape.mesh);
    }
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.POLYGON_OFFSET_FILL);
  },

  // 하늘을 그리고, 해 위치 계산에 쓸 '방향만 있는 카메라 행렬'을 돌려줌
  drawSky(proj, view, L, time) {
    const gl = GL.gl, P = this.p.sky;
    const rot = new Float32Array(view);
    rot[12] = rot[13] = rot[14] = 0;   // 하늘은 무한히 멀어서 위치는 무시하고 방향만
    const vp = M4.multiply(proj, rot);
    gl.useProgram(P.prog);
    gl.uniformMatrix4fv(P.u.uInvVP, false, M4.invert(vp));
    gl.uniform3fv(P.u.uSunDir, L.sunDir);
    gl.uniform3fv(P.u.uSunColor, L.sunColor);
    gl.uniform3fv(P.u.uFogColor, L.fogColor);
    gl.uniform3fv(P.u.uZenith, L.zenith);
    gl.uniform1f(P.u.uTime, time);
    gl.uniform1f(P.u.uDim, Skills.dim);
    gl.uniform3fv(P.u.uDimTint, (Skills.ult ? Skills.ult.pal : Weapons.cur).dark);
    gl.uniform3fv(P.u.uCloudLit, L.cloudLit);
    gl.uniform3fv(P.u.uCloudShade, L.cloudShade);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.bindVertexArray(this.skyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
    return vp;
  },

  // 그림자 지도 두 장과 행렬을 셰이더에 연결 (0번: 넓은 것, 2번: 촘촘한 것)
  bindShadows(u) {
    const gl = GL.gl;
    gl.uniformMatrix4fv(u.uLightVP, false, this.lightVP);
    gl.uniformMatrix4fv(u.uLightVPNear, false, this.lightVPNear);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.shadow.tex);
    gl.uniform1i(u.uShadowMap, 0);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowNear.tex);
    gl.uniform1i(u.uShadowNear, 2);
  },

  // 3D 모델용 셰이더 준비 (빛·안개·그림자 값 넘기기)
  useWorld(proj, view, lightVP, eye, L, time, player) {
    const gl = GL.gl, P = this.p.world, u = P.u;
    gl.useProgram(P.prog);
    gl.uniformMatrix4fv(u.uProj, false, proj);
    gl.uniformMatrix4fv(u.uView, false, view);
    this.bindShadows(u);
    gl.uniformMatrix4fv(u.uModel, false, IDENTITY);
    gl.uniform3fv(u.uSunDir, L.sunDir);
    gl.uniform3fv(u.uSunColor, L.sunColor);
    gl.uniform3fv(u.uSkyColor, L.skyColor);
    gl.uniform3fv(u.uGroundColor, L.groundColor);
    gl.uniform3fv(u.uFogColor, L.fogColor);
    gl.uniform3fv(u.uCamPos, eye);
    gl.uniform3fv(u.uPlayerPos, [player.x, player.groundY + 1.1, player.z]);   // (풀은 x·z만 씀)
    gl.uniform1f(u.uFogDensity, CONFIG.graphics.fogDensity);
    gl.uniform1f(u.uShadowOn, CONFIG.graphics.shadows ? 1 : 0);
    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uGroundDetail, 0);
    gl.uniform1f(u.uAOHeight, 0);
    gl.uniform1f(u.uGrass, 0);
    gl.uniform1f(u.uRim, 0);
    gl.uniform1f(u.uCamFade, 0);
    gl.uniform1f(u.uAlphaOut, 0);
    gl.uniform1f(u.uFlash, 0);
    gl.uniform1f(u.uTwoSided, 0);
    gl.uniform1f(u.uCel, 0);
    gl.uniform1f(u.uClipY, -1000);
    gl.uniform4fv(u.uGlowSwap, [0, 0, 0, 0]);
    gl.uniform3fv(u.uRuneColor, Weapons.tint);
    gl.uniform1f(u.uDim, Skills.dim);
    gl.uniform3fv(u.uDimTint, (Skills.ult ? Skills.ult.pal : Weapons.cur).dark);
    gl.uniform1f(u.uWaterLevel, World.waterLevel === null ? -100 : World.waterLevel);
    gl.uniform1f(u.uMistBase, World.waterLevel === null ? -0.8 : World.waterLevel);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.leafTex);
    gl.uniform1i(u.uLeafTex, 1);
    return u;
  },

  drawWorld(proj, view, lightVP, eye, L, time, player) {
    const gl = GL.gl;
    const u = this.useWorld(proj, view, lightVP, eye, L, time, player);
    const planes = frustumPlanes(M4.multiply(proj, view));
    for (const m of World.meshes) {
      const test = (box) => boxVisible(planes, box) && (!m.dist || boxDistance(box, eye) < m.dist);
      if (m.cull) gl.enable(gl.CULL_FACE); else gl.disable(gl.CULL_FACE);
      gl.uniform1f(u.uGroundDetail, m.ground ? 1 : 0);
      gl.uniform1f(u.uAOHeight, m.ao || 0);
      gl.uniform1f(u.uGrass, m.grass ? 1 : 0);
      gl.uniform1f(u.uRim, m.rim || 0);
      gl.uniform1f(u.uFogDensity, m.fog || CONFIG.graphics.fogDensity);
      gl.uniform1f(u.uCamFade, !Camera.isFirst && !m.ground ? 1 : 0);
      GL.drawMesh(m.mesh, test);
    }
    gl.uniform1f(u.uCamFade, 0);
    gl.enable(gl.CULL_FACE);
    gl.uniform1f(u.uGroundDetail, 0);
    gl.uniform1f(u.uAOHeight, 0);
    gl.uniform1f(u.uGrass, 0);
    gl.uniform1f(u.uFogDensity, CONFIG.graphics.fogDensity);
    return u;
  },

  // 관절로 움직이는 것들(기사·적·화살). 먼저 살짝 부풀린 뒷면을 어둡게 그려 외곽선을 만들고, 그 위에 그림
  drawParts(u, parts, proj, view, time) {
    const gl = GL.gl, w = CONFIG.graphics.outline;
    if (w > 0) {
      const O = this.p.outline;
      gl.useProgram(O.prog);
      gl.uniformMatrix4fv(O.u.uProj, false, proj);
      gl.uniformMatrix4fv(O.u.uView, false, view);
      gl.uniform1f(O.u.uTime, time);
      gl.uniform1f(O.u.uGrass, 0);
      gl.uniform3fv(O.u.uColor, [0.05, 0.04, 0.06]);
      gl.cullFace(gl.FRONT);
      for (const part of parts) {
        if (part.mesh === 'face' || part.mesh === 'lids') continue;   // 눈·코·입은 외곽선 없이
        const box = this.partBox[part.mesh];
        const grow = M4.chain(M4.translation(box.c[0], box.c[1], box.c[2]),
          M4.scaling(1 + (2 * w) / box.s[0], 1 + (2 * w) / box.s[1], 1 + (2 * w) / box.s[2]),
          M4.translation(-box.c[0], -box.c[1], -box.c[2]));
        gl.uniformMatrix4fv(O.u.uModel, false, M4.multiply(part.m, grow));
        GL.drawMesh(this.partMesh[part.mesh]);
      }
      gl.cullFace(gl.BACK);
      gl.useProgram(this.p.world.prog);
    }
    gl.uniform1f(u.uRim, 1);
    gl.uniform1f(u.uCel, 1);   // 캐릭터는 애니메이션풍 명암
    const swap = [Weapons.tint[0], Weapons.tint[1], Weapons.tint[2], 1], noSwap = [0, 0, 0, 0];
    for (const part of parts) {
      gl.uniformMatrix4fv(u.uModel, false, part.m);
      gl.uniform1f(u.uFlash, part.flash || 0);
      gl.uniform4fv(u.uGlowSwap, part.knight ? swap : noSwap);   // 용사 갑옷의 빛줄기는 무기 속성 색
      GL.drawMesh(this.partMesh[part.mesh], null, part.tint);
    }
    gl.uniform4fv(u.uGlowSwap, noSwap);
    gl.uniform1f(u.uFlash, 0);
    gl.uniform1f(u.uCel, 0);
    gl.uniform1f(u.uRim, 0);
    gl.uniformMatrix4fv(u.uModel, false, IDENTITY);
  },

  // 구르기·회전베기·돌진 잔상: 지난 자세들을 무기 속성 색 빛으로 더해 그림 (오래된 것일수록 흐리게)
  drawGhosts(proj, view, eye, time) {
    const gl = GL.gl, P = this.p.ghost;
    gl.useProgram(P.prog);
    gl.uniformMatrix4fv(P.u.uProj, false, proj);
    gl.uniformMatrix4fv(P.u.uView, false, view);
    gl.uniform3fv(P.u.uCamPos, eye);
    gl.uniform1f(P.u.uTime, time);
    gl.uniform1f(P.u.uGrass, 0);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
    gl.depthMask(false);
    const gc = Weapons.cur.ghost;
    for (const g of Character.ghosts) {
      const k = 1 - g.age / GHOST_LIFE;
      gl.uniform3fv(P.u.uColor, V3.scale(gc, k * k));
      for (const part of g.parts) {
        gl.uniformMatrix4fv(P.u.uModel, false, part.m);
        GL.drawMesh(this.partMesh[part.mesh]);
      }
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.useProgram(this.p.world.prog);
  },

  // 천 망토: 양면 (안쪽은 어둡게)
  drawCape(u) {
    if (!Cape.pts) return;
    const gl = GL.gl;
    gl.disable(gl.CULL_FACE);
    gl.uniform1f(u.uTwoSided, 1);
    gl.uniform3fv(u.uLining, KNIGHT.coat.slice(0, 3));   // 진홍 겉감 + 남색 안감
    gl.uniform1f(u.uRim, 0.6);
    gl.uniform1f(u.uCel, 1);
    gl.uniformMatrix4fv(u.uModel, false, IDENTITY);
    GL.drawMesh(Cape.mesh);
    gl.uniform1f(u.uTwoSided, 0);
    gl.uniform1f(u.uRim, 0);
    gl.uniform1f(u.uCel, 0);
    gl.enable(gl.CULL_FACE);
  },

  // 물에 비친 모습: 수면을 거울삼아 장면을 위아래로 뒤집어 반 크기로 한 번 더 그림 (작은 풀·소품은 생략)
  drawReflection(proj, view, eye, L, time, player, parts) {
    const gl = GL.gl, wl = World.waterLevel, t = Post.refl;
    const mirror = M4.identity();
    mirror[5] = -1;
    mirror[13] = 2 * wl;
    const rview = M4.multiply(view, mirror);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.viewport(0, 0, t.w, t.h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.frontFace(gl.CW);   // 뒤집힌 세상은 앞면·뒷면도 반대
    this.drawSky(proj, rview, L, time);
    const u = this.useWorld(proj, rview, null, [eye[0], 2 * wl - eye[1], eye[2]], L, time, player);
    gl.uniform1f(u.uClipY, wl - 0.05);   // 물 아래 부분은 비치지 않음
    const planes = frustumPlanes(M4.multiply(proj, rview));
    const test = (box) => boxVisible(planes, box);
    for (const m of World.meshes) {
      if (m.grass || (m.dist && m.dist < 45)) continue;
      if (m.cull) gl.enable(gl.CULL_FACE); else gl.disable(gl.CULL_FACE);
      gl.uniform1f(u.uGroundDetail, m.ground ? 1 : 0);
      gl.uniform1f(u.uAOHeight, m.ao || 0);
      gl.uniform1f(u.uRim, m.rim || 0);
      gl.uniform1f(u.uFogDensity, m.fog || CONFIG.graphics.fogDensity);
      GL.drawMesh(m.mesh, test);
    }
    gl.enable(gl.CULL_FACE);
    gl.uniform1f(u.uGroundDetail, 0);
    gl.uniform1f(u.uAOHeight, 0);
    gl.uniform1f(u.uFogDensity, CONFIG.graphics.fogDensity);
    this.drawParts(u, parts, proj, rview, time);
    gl.uniform1f(u.uClipY, -1000);
    gl.frontFace(gl.CCW);
  },

  // 출구: 닫혀 있으면 푸른 마법 장벽, 열리면 금빛 빛기둥
  drawGateFX(proj, view, eye, time) {
    const gl = GL.gl, P = this.p.barrier, g = World.gate;
    gl.useProgram(P.prog);
    gl.uniformMatrix4fv(P.u.uProj, false, proj);
    gl.uniformMatrix4fv(P.u.uView, false, view);
    gl.uniform1f(P.u.uTime, time);
    gl.uniform3fv(P.u.uCamPos, eye);
    gl.uniform1f(P.u.uBaseY, g.y);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(false);
    if (World.barrierFade > 0.01) {
      gl.uniform1f(P.u.uMode, 0);
      gl.uniform1f(P.u.uAmount, World.barrierFade);
      GL.drawMesh(World.barrier);
    }
    if (World.barrierFade < 0.99) {
      gl.uniform1f(P.u.uMode, 1);
      gl.uniform1f(P.u.uAmount, 1 - World.barrierFade);
      GL.drawMesh(World.pillar);
    }
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
  },

  // 연못 물 (반투명, 뒤에 있는 물속 땅이 비쳐 보임)
  drawWater(proj, view, lightVP, eye, L, time) {
    const gl = GL.gl, P = this.p.water, u = P.u;
    gl.useProgram(P.prog);
    gl.uniformMatrix4fv(u.uProj, false, proj);
    gl.uniformMatrix4fv(u.uView, false, view);
    this.bindShadows(u);
    gl.uniform3fv(u.uCamPos, eye);
    gl.uniform3fv(u.uSunDir, L.sunDir);
    gl.uniform3fv(u.uSunColor, L.sunColor);
    gl.uniform3fv(u.uFogColor, L.fogColor);
    gl.uniform3fv(u.uZenith, L.zenith);
    gl.uniform1f(u.uFogDensity, CONFIG.graphics.fogDensity);
    gl.uniform1f(u.uTime, time);
    gl.activeTexture(gl.TEXTURE3);   // 물에 비친 모습
    gl.bindTexture(gl.TEXTURE_2D, Post.refl.tex);
    gl.uniform1i(u.uRefl, 3);
    gl.uniform1f(u.uHasRefl, this.hasRefl ? 1 : 0);
    gl.uniform2fv(u.uScreen, [gl.drawingBufferWidth, gl.drawingBufferHeight]);
    gl.uniform1f(u.uDim, Skills.dim);
    gl.uniform3fv(u.uDimTint, (Skills.ult ? Skills.ult.pal : Weapons.cur).dark);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);   // 하늘 표시(알파)는 그대로
    gl.disable(gl.CULL_FACE);
    gl.depthMask(false);
    GL.drawMesh(World.water);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
  },

  drawParticles(proj, view, eye, time, H) {
    const gl = GL.gl, P = this.p.particle;
    gl.useProgram(P.prog);
    gl.uniformMatrix4fv(P.u.uProj, false, proj);
    gl.uniformMatrix4fv(P.u.uView, false, view);
    gl.uniform3fv(P.u.uCam, eye);
    gl.uniform1f(P.u.uTime, time);
    gl.uniform1f(P.u.uScale, (H * proj[5]) / 2);
    const L = LIGHTING[World.level.theme];
    gl.uniform3fv(P.u.uColor, World.level.theme === 'dusk' ? L.particleColor.map((v) => v * 1.6) : L.particleColor);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);   // 빛나는 느낌 (색을 더함, 하늘 표시는 그대로)
    gl.depthMask(false);
    gl.bindVertexArray(this.particles.vao);
    gl.drawArrays(gl.POINTS, 0, this.particles.n);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  },

  // 1인칭: 손에 든 검과 팔 (세상 좌표로 옮겨 그려서 햇빛·그림자를 똑같이 받음)
  drawViewModel(vproj, view, lightVP, eye, L, time, player) {
    const gl = GL.gl;
    const u = this.useWorld(vproj, view, lightVP, eye, L, time, player);
    gl.uniform1f(u.uFogDensity, 0);
    gl.uniform1f(u.uMistBase, -100);
    gl.uniform1f(u.uRim, 0.6);
    gl.uniform1f(u.uAlphaOut, 0.25);   // 후처리에서 손·검을 알아보게
    const camWorld = M4.invert(view);
    const sword = player.swordMatrix();
    gl.uniformMatrix4fv(u.uModel, false, M4.multiply(camWorld, sword));
    GL.drawMesh(this.partMesh[Weapons.meshName]);
    gl.uniformMatrix4fv(u.uModel, false, M4.multiply(camWorld, player.armMatrix(sword)));
    GL.drawMesh(this.armMesh);
    this.drawTrail(vproj, player, time);
  },

  drawTrail(vproj, player, time) {
    const s = player.trail;
    if (s.length < 2) return;
    const gl = GL.gl, P = this.p.trail;
    const data = new Float32Array(s.length * 8);
    s.forEach((p, i) => {
      const a = Utils.clamp(1 - (time - p.t) / 0.1, 0, 1) * 0.55;
      data.set([p.base[0], p.base[1], p.base[2], 0, p.tip[0], p.tip[1], p.tip[2], a], i * 8);
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.trailBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.useProgram(P.prog);
    gl.uniformMatrix4fv(P.u.uProj, false, vproj);
    gl.uniform3fv(P.u.uColor, V3.scale(V3.add(Weapons.cur.core, Weapons.cur.mid), 0.33));
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(false);
    gl.bindVertexArray(this.trailVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, s.length * 2);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
  },
};
