// 후처리: 장면을 화면 밖 그림에 먼저 그린 뒤, 계단 현상 없애기·빛 번짐·빛줄기·색 보정을 더해 화면에 옮김
const Post = {
  w: 0,
  h: 0,
  p: {},

  init() {
    const gl = GL.gl;
    for (const name of ['bright', 'blur', 'rays', 'composite', 'ssao', 'aoBlur']) {
      this.p[name] = GL.program(SHADERS.postVS, SHADERS[name + 'FS']);
    }
    this.vao = gl.createVertexArray();
  },

  // 그림을 그릴 수 있는 텍스처 + 프레임버퍼
  makeTarget(w, h) {
    const gl = GL.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fbo, w, h };
  },

  freeTarget(t) {
    if (!t) return;
    GL.gl.deleteTexture(t.tex);
    GL.gl.deleteFramebuffer(t.fbo);
  },

  resize(w, h) {
    const gl = GL.gl;
    this.w = w;
    this.h = h;
    if (this.msaa) {
      gl.deleteFramebuffer(this.msaa);
      gl.deleteRenderbuffer(this.msaaColor);
      gl.deleteRenderbuffer(this.msaaDepth);
    }
    [this.scene, this.bloomA, this.bloomB, this.rays, this.ao, this.aoTmp, this.refl].forEach((t) => this.freeTarget(t));
    if (this.reflDepth) gl.deleteRenderbuffer(this.reflDepth);
    if (this.depthTex) {
      gl.deleteTexture(this.depthTex);
      gl.deleteFramebuffer(this.depthFbo);
    }

    // 계단 현상 방지(MSAA): 픽셀마다 4번 계산해서 가장자리를 매끄럽게
    const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
    this.msaaColor = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.msaaColor);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h);
    this.msaaDepth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.msaaDepth);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
    this.msaa = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaa);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.msaaColor);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.msaaDepth);

    const qw = Math.max(1, w >> 2), qh = Math.max(1, h >> 2);
    this.scene = this.makeTarget(w, h);
    this.bloomA = this.makeTarget(qw, qh);
    this.bloomB = this.makeTarget(qw, qh);
    this.rays = this.makeTarget(Math.max(1, w >> 1), Math.max(1, h >> 1));
    this.ao = this.makeTarget(Math.max(1, w >> 1), Math.max(1, h >> 1));
    this.aoTmp = this.makeTarget(Math.max(1, w >> 1), Math.max(1, h >> 1));

    // 물에 비친 모습을 그릴 그림 (반 크기 + 깊이)
    this.refl = this.makeTarget(Math.max(1, w >> 1), Math.max(1, h >> 1));
    this.reflDepth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.reflDepth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, this.refl.w, this.refl.h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.refl.fbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.reflDepth);

    // 깊이(카메라에서 얼마나 먼지) 사본: 주변 가림 계산에 사용
    this.depthTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.depthTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.depthFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.depthFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.depthTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  },

  // 지금까지 그린 장면의 깊이를 복사해 둠 (1인칭 손을 그리기 전에 호출)
  captureDepth() {
    const gl = GL.gl, w = this.w, h = this.h;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msaa);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.depthFbo);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaa);
  },

  // 장면 그리기 시작 (화면 대신 MSAA 그림에 그림)
  begin(w, h) {
    const gl = GL.gl;
    if (w !== this.w || h !== this.h) this.resize(w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaa);
    gl.viewport(0, 0, w, h);
  },

  // 셰이더 하나로 target 그림 전체를 칠함
  pass(P, target, textures, uniforms) {
    const gl = GL.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, target ? target.w : this.w, target ? target.h : this.h);
    gl.useProgram(P.prog);
    let unit = 0;
    for (const name in textures) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, textures[name]);
      gl.uniform1i(P.u[name], unit++);
    }
    for (const name in uniforms) {
      const v = uniforms[name];
      if (typeof v === 'number') gl.uniform1f(P.u[name], v);
      else if (v.length === 2) gl.uniform2fv(P.u[name], v);
      else gl.uniform3fv(P.u[name], v);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  },

  // opts: sunUV(화면 속 해 위치), rayStrength(빛줄기 세기), rayColor, proj(원근 행렬), near, far
  end(opts) {
    const gl = GL.gl, w = this.w, h = this.h;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msaa);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.scene.fbo);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.vao);

    // 빛 번짐: 밝은 부분만 골라 작게 줄인 뒤 흐리게
    this.pass(this.p.bright, this.bloomA, { uTex: this.scene.tex }, { uTexel: [2 / w, 2 / h] });
    this.pass(this.p.blur, this.bloomB, { uTex: this.bloomA.tex }, { uDir: [1.5 / this.bloomA.w, 0] });
    this.pass(this.p.blur, this.bloomA, { uTex: this.bloomB.tex }, { uDir: [0, 1.5 / this.bloomA.h] });
    this.pass(this.p.blur, this.bloomB, { uTex: this.bloomA.tex }, { uDir: [3.5 / this.bloomA.w, 0] });   // 한 번 더 넓게 → 부드럽게 퍼지는 빛
    this.pass(this.p.blur, this.bloomA, { uTex: this.bloomB.tex }, { uDir: [0, 3.5 / this.bloomA.h] });

    // 빛줄기 (해가 화면 쪽에 있을 때만)
    const rays = opts.rayStrength > 0.01;
    if (rays) this.pass(this.p.rays, this.rays, { uScene: this.scene.tex }, { uSun: opts.sunUV });

    // 주변 가림 (반 크기로 계산 → 가로·세로로 흐리게)
    const ssao = CONFIG.graphics.ssao;
    if (ssao) {
      const nf = [opts.near, opts.far];
      this.pass(this.p.ssao, this.ao, { uDepth: this.depthTex },
        { uProjXY: [opts.proj[0], opts.proj[5]], uNearFar: nf, uRadius: 0.55 });
      this.pass(this.p.aoBlur, this.aoTmp, { uTex: this.ao.tex, uDepth: this.depthTex }, { uDir: [2 / w, 0], uNearFar: nf });
      this.pass(this.p.aoBlur, this.ao, { uTex: this.aoTmp.tex, uDepth: this.depthTex }, { uDir: [0, 2 / h], uNearFar: nf });
    }

    this.pass(this.p.composite, null,
      { uScene: this.scene.tex, uBloom: this.bloomA.tex, uRays: this.rays.tex, uAO: this.ao.tex },
      {
        uBloomStrength: CONFIG.graphics.bloom,
        uAOStrength: ssao ? (opts.ao ?? 0.85) : 0,   // 숲은 약하게 (풀밭이 얼룩지지 않게)
        uSat: opts.sat ?? 1.22,                       // 테마별 색 보정 (값이 없으면 예전 그대로)
        uContrast: opts.contrast ?? 1.05,
        uSplit: opts.split ?? 1,
        uLift: opts.lift || [0, 0, 0],
        uRayColor: rays ? V3.scale(opts.rayColor, opts.rayStrength) : [0, 0, 0],
        uSun: opts.sunUV,
        uFlare: CONFIG.graphics.lensFlare ? opts.rayStrength : 0,
        uAspect: w / h,
        uFlashAdd: V3.scale(opts.flashColor || [0.55, 0.65, 0.9], (opts.flash || 0) * 0.55),
        uGrade: opts.grade || [1, 1, 1],
      });

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
  },
};
