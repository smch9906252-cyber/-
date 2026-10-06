// WebGL(그래픽 카드로 3D를 그리는 브라우저 기능)을 쓰기 쉽게 감싼 도우미
// 모델의 정점 데이터 번호: 0 위치, 1 법선(면이 향하는 방향), 2 색, 3 바람 흔들림, 4·5 인스턴스(배치) 정보, 6 무늬 좌표
const GL = {
  gl: null,

  init(canvas) {
    // 계단 현상 방지는 post.js에서 직접 하므로 여기선 끔
    this.gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    return !!this.gl;
  },

  // 셰이더(그래픽 카드에서 돌아가는 작은 프로그램) 만들기
  // 돌려주는 값: { prog, u } — u는 셰이더 변수(uniform) 이름 → 위치
  program(vsSource, fsSource) {
    const gl = this.gl;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('셰이더 오류: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSource));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('셰이더 연결 오류: ' + gl.getProgramInfoLog(prog));
    const u = {};
    const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const name = gl.getActiveUniform(prog, i).name;
      u[name.replace('[0]', '')] = gl.getUniformLocation(prog, name);
    }
    return { prog, u };
  },

  // 모델(MeshBuilder)을 그래픽 카드로 보냄
  // instances를 주면 같은 모델을 여러 곳에 한 번에 그림: 한 개당 숫자 8개 [x, y, z, 회전, 크기, 색r, 색g, 색b]
  // groups를 주면 인스턴스를 구역별로 나눠 둠 [{ start, count, box }] → 화면 밖 구역은 건너뛰고 그릴 수 있음
  createMesh(b, instances, groups) {
    const gl = this.gl;
    const buffers = [];
    const upload = (data) => {
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      buffers.push(buf);
      return buf;
    };
    const geo = [[0, upload(b.pos), 3], [1, upload(b.nrm), 3], [2, upload(b.col), 4], [3, upload(b.wind), 1], [6, upload(b.uv), 2]];
    const instBuf = instances ? upload(instances) : null;
    // 정점 데이터 연결 묶음(VAO). 구역마다 인스턴스 시작 위치만 다르게
    const makeVao = (firstInstance) => {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      for (const [loc, buf, size] of geo) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      }
      if (instBuf) {
        gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
        for (let i = 0; i < 2; i++) {
          gl.enableVertexAttribArray(4 + i);
          gl.vertexAttribPointer(4 + i, 4, gl.FLOAT, false, 32, firstInstance * 32 + i * 16);
          gl.vertexAttribDivisor(4 + i, 1);
        }
      }
      gl.bindVertexArray(null);
      return vao;
    };
    const count = b.pos.length / 3;
    if (!instances) return { vao: makeVao(0), buffers, count, instanced: false, parts: [] };
    const list = groups || [{ start: 0, count: instances.length / 8, box: null }];
    const parts = list.map((g) => ({ vao: makeVao(g.start), count: g.count, box: g.box }));
    return { buffers, count, instanced: true, parts };
  },

  // test(box)가 false인 구역은 건너뜀 (화면 밖이거나 너무 멂)
  // tint: 인스턴스 없이 그릴 때 [크기, 색r, 색g, 색b] (예: 슬라임 색 바꾸기)
  drawMesh(m, test, tint) {
    const gl = this.gl;
    if (!m.instanced) {
      gl.bindVertexArray(m.vao);
      gl.vertexAttrib4f(4, 0, 0, 0, 0);   // 배치 정보 없음 = 제자리, 크기 1, 색 그대로
      if (tint) gl.vertexAttrib4f(5, tint[0], tint[1], tint[2], tint[3]);
      else gl.vertexAttrib4f(5, 1, 1, 1, 1);
      gl.drawArrays(gl.TRIANGLES, 0, m.count);
      return;
    }
    for (const part of m.parts) {
      if (test && part.box && !test(part.box)) continue;
      gl.bindVertexArray(part.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, m.count, part.count);
    }
  },

  // 무늬 그림(텍스처) 올리기. img = { width, height, data(RGBA 바이트) }
  createTexture(img) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, img.width, img.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, img.data);
    gl.generateMipmap(gl.TEXTURE_2D);   // 멀리서 볼 때 쓸 작은 그림들
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    return tex;
  },

  deleteMesh(m) {
    if (m.vao) this.gl.deleteVertexArray(m.vao);
    m.parts.forEach((p) => this.gl.deleteVertexArray(p.vao));
    m.buffers.forEach((b) => this.gl.deleteBuffer(b));
  },
};
