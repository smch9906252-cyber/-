// 셰이더: 그래픽 카드에서 돌아가는 작은 프로그램 (GLSL 언어)
// 정점 셰이더(VS)는 점의 위치를, 조각 셰이더(FS)는 픽셀의 색을 계산합니다.
// 그림체: 만화처럼 또렷한 명암(툰 셰이딩) + 붓으로 칠한 듯한 질감 + 맑은 공기 원근감

// 3D 모델 공통: 입력 데이터, 인스턴스 배치(위치·회전·크기), 바람 흔들림
const GLSL_MODEL = `
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec4 aColor;
layout(location = 3) in float aWind;
layout(location = 4) in vec4 aInst0;
layout(location = 5) in vec4 aInst1;
layout(location = 6) in vec2 aUV;
uniform mat4 uModel;
uniform float uTime;
uniform float uGrass;       // 1이면 풀: 바람 물결에 눕고, 전사 주변에서 밀려남
uniform vec3 uPlayerPos;
float gGust;                // 지금 이 자리를 지나는 바람 물결의 세기 (0~1)

vec3 instRot(vec3 p) {
  float c = cos(aInst0.w), s = sin(aInst0.w);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

vec4 worldPos() {
  vec4 w = uModel * vec4(instRot(aPos * aInst1.x) + aInst0.xyz, 1.0);
  float ph = uTime * 1.7 + w.x * 0.31 + w.z * 0.23;
  float wave = sin(dot(w.xz, vec2(0.11, 0.06)) - uTime * 1.4) * 0.5 + 0.5;
  gGust = wave * wave * wave;
  vec2 sway = vec2(sin(ph) + 0.35 * sin(ph * 2.7), 0.6 * cos(ph * 0.83)) * (0.6 + 0.4 * gGust);
  if (uGrass > 0.5) {
    sway = sway * 0.45 + vec2(0.85, 0.5) * (0.4 + gGust * 1.6);   // 바람 부는 쪽으로 눕힘
    vec2 d = w.xz - uPlayerPos.xz;
    float dl = length(d);
    sway += d / max(dl, 0.001) * smoothstep(1.2, 0.2, dl) * 3.5;   // 전사가 지나가면 밀려남
  }
  vec2 off = aWind * sway;
  w.xz += off;
  w.y -= length(off) * 0.35;
  return w;
}
`;

// 부드러운 난수 무늬 (질감, 구름, 물결)
const GLSL_NOISE = `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
`;

// 마지막 색 보정 + 해 쪽 안개
const GLSL_FINISH = `
vec3 finish(vec3 c) {
  c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);
  return pow(c, vec3(1.0 / 2.2));
}
vec3 sunFog(vec3 fogColor, vec3 viewDir, vec3 sunDir) {
  return mix(fogColor, fogColor * vec3(1.4, 1.15, 0.82), pow(max(dot(viewDir, sunDir), 0.0), 6.0));
}
`;

// 그림자: 두 겹 (전사 주변 18m는 촘촘한 그림자 지도, 그 바깥 76m는 넓은 그림자 지도)
// 주변 12곳을 섞어 가장자리를 부드럽게
const GLSL_SHADOW = `
uniform mat4 uLightVP;
uniform mat4 uLightVPNear;
uniform highp sampler2DShadow uShadowMap;
uniform highp sampler2DShadow uShadowNear;
uniform float uShadowOutside;   // 그림자 지도 바깥의 밝기 (숲 1 = 햇빛, 동굴 0 = 천장에 가려 어두움)
const vec2 POISSON[12] = vec2[12](
  vec2(-0.326, -0.406), vec2(-0.840, -0.074), vec2(-0.696, 0.457), vec2(-0.203, 0.621),
  vec2(0.962, -0.195), vec2(0.473, -0.480), vec2(0.519, 0.767), vec2(0.185, -0.893),
  vec2(0.507, 0.064), vec2(0.896, 0.412), vec2(-0.322, -0.933), vec2(-0.792, -0.598));
float pcf(sampler2DShadow sm, vec3 p, float radius, float bias) {
  vec2 t = radius / vec2(textureSize(sm, 0));
  float s = 0.0;
  for (int i = 0; i < 12; i++) s += texture(sm, vec3(p.xy + POISSON[i] * t, p.z - bias));
  return s / 12.0;
}
float shadowAt(vec3 w) {
  vec4 cf = uLightVP * vec4(w, 1.0);
  vec3 pf = cf.xyz / cf.w * 0.5 + 0.5;
  float edgeF = max(abs(pf.x - 0.5), abs(pf.y - 0.5)) * 2.0;
  float sf = uShadowOutside;
  if (edgeF < 1.0 && pf.z < 1.0) sf = mix(pcf(uShadowMap, pf, 1.6, 0.0004), uShadowOutside, smoothstep(0.85, 1.0, edgeF));
  vec4 cn = uLightVPNear * vec4(w, 1.0);
  vec3 pn = cn.xyz / cn.w * 0.5 + 0.5;
  float edgeN = max(abs(pn.x - 0.5), abs(pn.y - 0.5)) * 2.0;
  if (edgeN < 1.0 && pn.z < 1.0) return mix(pcf(uShadowNear, pn, 2.5, 0.0008), sf, smoothstep(0.75, 1.0, edgeN));
  return sf;
}
`;

// 자연 효과 (uTime이 먼저 선언되어 있어야 함)
const GLSL_ENV = `
// 구름 그림자: 땅 위를 천천히 흘러감 (1 = 햇빛, 0.5 = 그늘). uClouds가 0이면 없음 (동굴)
uniform float uClouds;
float cloudShadow(vec3 w) {
  if (uClouds < 0.5) return 1.0;
  vec2 p = w.xz * 0.015 + uTime * vec2(0.02, 0.008);
  float c = vnoise(p) * 0.55 + vnoise(p * 2.1 + 7.3) * 0.3 + vnoise(p * 4.3 - 2.1) * 0.15;
  return 1.0 - smoothstep(0.5, 0.68, c) * 0.5;
}
// 물속 바닥에 일렁이는 빛 그물 무늬
float caustic(vec2 p) {
  vec2 q = p * 2.2;
  float a = vnoise(q + uTime * vec2(0.35, 0.2));
  float b = vnoise(q * 1.6 - uTime * vec2(0.25, 0.3) + 3.1);
  return pow(1.0 - abs(a - b), 10.0);
}
`;

// 화면 전체를 덮는 삼각형 하나 (하늘·후처리용)
const FULLSCREEN_VS = `#version 300 es
out vec2 vUv;
out vec2 vNdc;
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  vNdc = p;
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const SHADERS = {
  // 땅·나무·풀·전사·검
  worldVS: `#version 300 es
${GLSL_MODEL}
uniform mat4 uProj;
uniform mat4 uView;
uniform float uAOHeight;   // 0보다 크면 아래쪽일수록 어둡게 (나무 밑동 등)
out vec3 vWorld;
out vec3 vNormal;
out vec4 vColor;
out float vAO;
out vec2 vUV;
out float vGust;
out float vWind;
void main() {
  vec4 w = worldPos();
  vWorld = w.xyz;
  vNormal = mat3(uModel) * instRot(aNormal);
  vColor = vec4(aColor.rgb * aInst1.yzw, aColor.a);
  vAO = uAOHeight > 0.0 ? clamp(0.4 + aPos.y / uAOHeight * 0.6, 0.4, 1.0) : 1.0;
  vUV = aUV;
  vGust = gGust;
  vWind = aWind;
  gl_Position = uProj * uView * w;
}`,

  worldFS: `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vWorld;
in vec3 vNormal;
in vec4 vColor;
in float vAO;
in vec2 vUV;
in float vGust;
in float vWind;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uFogColor;
uniform vec3 uCamPos;
uniform float uFogDensity;
uniform float uShadowOn;
uniform float uGroundDetail;
uniform float uGrass;
uniform float uRim;
uniform float uCamFade;    // 1이면 카메라 바로 앞 물체를 점점이 지워 시야를 가리지 않게
uniform vec3 uPlayerPos;   // 용사 위치 (y = 가슴 높이): 카메라와 용사 사이를 가리는 잎을 비울 때
uniform float uTime;
uniform float uWaterLevel; // 연못 수면 높이 (물속 바닥에 빛 무늬)
uniform float uMistBase;   // 이 높이 근처 낮은 곳에 옅은 물안개
uniform vec4 uHaze;        // 공기 원근감: rgb 먼 언덕·산이 잠기는 푸른 공기 색, w 짙기 (0이면 끔: 노을·동굴)
uniform float uAlphaOut;   // 출력 알파: 0 = 세상 물체, 0.25 = 1인칭 손·검 (후처리에서 구분)
uniform float uFlash;      // 맞았을 때 하얗게 번쩍 (0~1)
uniform float uTwoSided;   // 1이면 뒷면도 제대로 (망토 안쪽은 안감 색)
uniform vec3 uLining;      // 망토 안감 색
uniform float uCel;        // 1이면 애니메이션풍 캐릭터 명암 (또렷한 두 단계 + 색이 있는 그림자)
uniform float uClipY;      // 이 높이보다 낮은 부분은 그리지 않음 (물에 비친 모습을 그릴 때)
uniform float uDim;        // 궁극기 때 세상을 어둡게 물들임 (0~1). 나중에 더하는 빛 효과는 밝은 그대로 남아 돋보임
uniform vec3 uDimTint;
uniform vec4 uGlowSwap;    // w가 1이면 스스로 빛나는 부분을 이 색으로 (용사 갑옷 빛줄기가 무기 속성 색을 따라감)
uniform vec3 uRuneColor;   // 망토 문장의 칼날 실 색
uniform float uCelAmbient; // 캐릭터 그늘 밝기 (숲 1, 어두운 동굴은 낮게)
uniform vec4 uLights[12];      // 주변을 비추는 빛 (횃불·수정·검): xyz 위치, w 닿는 거리(m)
uniform vec3 uLightColors[12];
uniform int uLightCount;
uniform sampler2D uLeafTex;
uniform float uTerm;       // 빛과 그늘 경계의 너비 (기본 0.22, 숲은 넓게 잡아 부드럽게)
uniform float uShadeDesat; // 그늘의 색을 빼는 정도 (0이면 예전 그대로)
uniform float uLeafGlow;   // 그늘진 잎으로 비쳐 드는 햇빛 세기 (0이면 없음)
uniform vec3 uMoss;        // 바위 윗면 이끼 색
out vec4 outColor;
${GLSL_NOISE}
${GLSL_FINISH}
${GLSL_SHADOW}
${GLSL_ENV}

// 땅: 붓으로 칠한 듯한 얼룩과 붓 자국, 흙길엔 자갈
vec3 groundTexture(vec3 base, vec2 p) {
  float big = fbm(p * 0.22);
  float mid = vnoise(p * 1.3);
  vec2 q = mat2(0.8, -0.6, 0.6, 0.8) * p;
  float stroke = vnoise(q * vec2(2.0, 9.0)) * 0.6 + vnoise(q * vec2(5.0, 19.0)) * 0.4;
  float dirt = smoothstep(-0.01, 0.04, base.r - base.g * 0.85);
  vec3 c = base * (0.8 + 0.3 * big + 0.14 * mid) * (0.88 + 0.24 * stroke);
  c = mix(c, c * vec3(1.2, 1.14, 0.84), smoothstep(0.55, 0.8, big) * (1.0 - dirt) * 0.6);   // 노란 풀빛 얼룩 (파스텔: 파란빛을 덜 빼서 탁한 형광 노랑이 되지 않게)
  float peb = vnoise(p * 9.0);
  c = mix(c, c * 1.35, dirt * smoothstep(0.74, 0.8, peb));            // 밝은 자갈
  c = mix(c, c * 0.7, dirt * smoothstep(0.76, 0.84, vnoise(p * 9.0 + 3.7)));
  return c;
}

// 나무껍질: 세로 결과 갈라진 틈
vec3 barkTexture(vec3 base, vec3 w) {
  float s = vnoise(vec2((w.x + w.z) * 7.0, w.y * 0.9)) * 0.6 + vnoise(vec2((w.x - w.z) * 15.0, w.y * 2.0)) * 0.4;
  float crack = smoothstep(0.55, 0.75, vnoise(vec2((w.x + w.z) * 12.0, w.y * 1.5)));
  return base * (0.75 + 0.5 * s) * (1.0 - crack * 0.35);
}

// 바위: 세 방향에서 입힌 얼룩 + 금 + 윗면 이끼
vec3 rockTexture(vec3 base, vec3 w, vec3 n) {
  vec3 an = abs(n);
  float t = (vnoise(w.yz * 2.2) * an.x + vnoise(w.xz * 2.2) * an.y + vnoise(w.xy * 2.2) * an.z) / (an.x + an.y + an.z);
  float fine = vnoise(w.xz * 9.0 + w.y * 3.0);
  float crack = 1.0 - abs(vnoise(w.xz * 3.0 + w.y * 2.0) * 2.0 - 1.0);
  vec3 c = base * (0.7 + 0.45 * t + 0.15 * fine);
  c *= 1.0 - smoothstep(0.9, 0.97, crack) * 0.45;
  float moss = smoothstep(0.45, 0.75, n.y + (t - 0.5) * 0.5);
  return mix(c, uMoss * (0.8 + 0.4 * fine), moss);   // 이끼 색은 테마별 (숲은 옅은 올리브)
}

// 4x4 규칙 무늬 문턱값 (0~1): 무작위 점보다 고르게 비워져 지글거리는 얼룩이 생기지 않음
float bayer4(vec2 p) {
  const float B[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  ivec2 i = ivec2(mod(p, 4.0));
  return (B[i.x + i.y * 4] + 0.5) / 16.0;
}

// 횃불·수정 같은 점 빛을 모두 더함 (거리에 따라 부드럽게 약해짐, wrap: 빛이 뒤쪽까지 감기는 정도)
vec3 pointLights(vec3 w, vec3 n, float wrap) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    if (i >= uLightCount) break;
    vec3 d = uLights[i].xyz - w;
    float dist = length(d);
    float att = 1.0 - clamp(dist / uLights[i].w, 0.0, 1.0);
    float ndl = (dot(n, d / max(dist, 0.001)) + wrap) / (1.0 + wrap);
    sum += uLightColors[i] * att * att * smoothstep(0.0, 0.35, ndl);
  }
  return sum;
}

void main() {
  if (vWorld.y < uClipY) discard;
  if (uCamFade > 0.5) {
    // 카메라 바로 앞, 그리고 카메라와 용사 사이를 가리는 잎·덤불은 점점이 비워서 용사가 보이게
    vec3 seg = uPlayerPos - uCamPos;
    float t = clamp(dot(vWorld - uCamPos, seg) / max(dot(seg, seg), 0.001), 0.0, 1.0);
    float line = smoothstep(0.5, 1.0, length(vWorld - (uCamPos + seg * t))) + step(0.88, t);
    float keep = min(smoothstep(0.6, 2.2, length(vWorld - uCamPos)), 0.12 + line);
    if (bayer4(gl_FragCoord.xy) > keep) discard;
  }
  int mat = vColor.a < -0.5 ? int(-vColor.a + 0.5) : 0;   // 1 잎, 2 잎 판, 3 나무껍질, 4 바위, 5 천, 6 빛남, 7 피부, 8 머리카락, 9 수정
  float shine = max(vColor.a, 0.0);
  vec3 base = vColor.rgb;
  if (mat == 2) {   // 잎 판: 잎 무늬 그림에서 잎이 없는 곳은 뚫음
    vec4 t = texture(uLeafTex, vUV);
    float lod = max(0.0, log2(max(fwidth(vUV.x) * 512.0, fwidth(vUV.y) * 256.0)));
    if (t.a * (1.0 + lod * 0.3) < 0.5) discard;
    base *= t.rgb * 1.25;
  }
  vec3 n = normalize(vNormal);
  float uvAA = fwidth(vUV.y) * 1.2 + 0.002;
  if (uTwoSided > 0.5 && !gl_FrontFacing) {
    n = -n;
    base = uLining;
  } else if (uTwoSided > 0.5) {   // 망토 등판의 금실 문장: 둥근 고리 + 아래를 향한 검, 칼날 가운데는 푸른 실
    vec2 q = vec2((vUV.x - 0.5) * 0.62, (vUV.y - 0.36) * 1.1);
    float aa = uvAA * 1.1;
    float ring = abs(length(q) - 0.15) - 0.008;
    float bladeW = 0.02 * clamp((0.22 - q.y) / 0.12, 0.0, 1.0);
    float blade = max(abs(q.x) - bladeW, max(-0.11 - q.y, q.y - 0.22));
    float guard = max(abs(q.x) - 0.075, abs(q.y + 0.11) - 0.01);
    float grip = max(abs(q.x) - 0.009, abs(q.y + 0.155) - 0.04);
    float pommel = length(q - vec2(0.0, -0.205)) - 0.017;
    float d = min(min(ring, blade), min(min(guard, grip), pommel));
    base = mix(base, vec3(0.69, 0.4, 0.042), 1.0 - smoothstep(-aa, aa, d));
    float rune = max(abs(q.x) - 0.0045, max(-0.09 - q.y, q.y - 0.17));
    base = mix(base, uRuneColor, 1.0 - smoothstep(-aa, aa, rune));
  }
  vec3 v = normalize(uCamPos - vWorld);
  if (uGroundDetail > 0.5) base = groundTexture(base, vWorld.xz);
  if (mat == 3) base = barkTexture(base, vWorld);
  if (mat == 1) {   // 잎 덩어리 겉면: 붓으로 찍은 듯한 잎 뭉치 무늬 (밝은 잎끝 + 사이사이 어두운 틈)
    vec3 q = vWorld * 1.8;
    float clump = (vnoise(q.xz + q.y * 0.7) + vnoise(q.zy * 1.3 + 5.1) + vnoise(q.xy * 1.1 + 9.7)) / 3.0;
    float fine = vnoise(vWorld.xz * 7.0 + vWorld.y * 4.0);
    base *= 0.8 + 0.4 * smoothstep(0.38, 0.72, clump) + 0.1 * fine;   // 틈을 덜 어둡게 → 큰 붓으로 찍은 듯 부드러운 잎 덩어리
    base = mix(base, base * vec3(1.18, 1.14, 0.82), smoothstep(0.58, 0.8, clump) * 0.6);   // 볕 받은 잎끝은 노르스름하게
  }
  if (mat == 4) base = rockTexture(base, vWorld, n);
  bool leafy = mat == 1 || mat == 2;
  bool skin = mat == 7, hairMat = mat == 8;
  if (uGrass > 0.5) base = mix(base, base * 1.15 + vec3(0.03, 0.035, 0.025), vGust * smoothstep(0.0, 0.08, vWind));   // 바람 물결이 지나가면 풀끝이 은빛으로 옅게 반짝 (야숨 풀밭처럼)

  float cloud = cloudShadow(vWorld);
  float sh = (uShadowOn > 0.5 ? shadowAt(vWorld) : uShadowOutside) * cloud;
  float under = uGroundDetail > 0.5 ? clamp(uWaterLevel - vWorld.y, 0.0, 3.0) : 0.0;   // 물속 깊이
  if (under > 0.0) base = mix(base, base * vec3(0.5, 0.78, 0.8), smoothstep(0.0, 0.5, under));
  float wrap = leafy ? 0.5 : skin ? 0.35 : 0.05;
  float ndl = (dot(n, uSunDir) + wrap) / (1.0 + wrap);
  float light = smoothstep(0.0, max(uTerm, 0.01), ndl) * sh;    // 명암 경계 (숲은 넓게 잡아 붓으로 문지른 듯 부드럽게)
  vec3 ambient = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5) * vAO;
  // 그늘은 물감을 덜 진하게: 색을 조금 빼서 짙은 초록 대신 차분한 회녹색 (uShadeDesat이 0이면 예전과 같음)
  vec3 shadeBase = mix(base, vec3(dot(base, vec3(0.2126, 0.7152, 0.0722))), uShadeDesat * (1.0 - light));
  vec3 col = shadeBase * ambient + base * uSunColor * light * mix(1.0, vAO, 0.4);
  col += shadeBase * uSkyColor * 0.25 * (1.0 - light);           // 그늘은 하늘빛을 받아 살짝 푸르게
  if (leafy) col += base * uSunColor * uLeafGlow * (1.0 - light) * cloud;   // 그늘진 잎도 햇빛이 비쳐 들어 은은한 연둣빛
  if (uCel > 0.5) {
    // 애니메이션풍: 밝은 면과 그늘 두 단계로 또렷하게. 그늘은 어둡게만 하지 않고 색을 입힘 (피부는 분홍, 옷·갑옷은 보랏빛 파랑)
    float hl = dot(n, uSunDir) * 0.5 + 0.5;
    float ramp = smoothstep(0.44, 0.5, hl * mix(0.45, 1.0, sh));
    vec3 tint = skin ? vec3(1.0, 0.72, 0.7) : hairMat ? vec3(0.6, 0.62, 0.85) : vec3(0.66, 0.68, 0.88);
    vec3 warm = uSunColor / max(uSunColor.r, 0.001);
    float litK = shine > 0.0 ? 1.7 : 2.0;   // 금속은 조금 덜 밝게 (반짝임이 돋보이게)
    col = base * mix(tint * 0.95 * uCelAmbient, mix(vec3(1.0), warm, 0.45) * litK, ramp);
    col += base * uSunColor * 0.45 * smoothstep(0.62, 0.82, 1.0 - max(dot(n, v), 0.0)) * (0.35 * uCelAmbient + 0.65 * ramp);   // 윤곽을 따라 밝은 테두리 빛
    if (shine > 0.0) {   // 애니메이션풍 금속: 하늘이 비치는 쪽은 밝게, 땅이 비치는 쪽은 어둡게 또렷이 나뉨
      vec3 r = reflect(-v, n);
      float skyR = smoothstep(-0.06, 0.06, r.y);
      col *= mix(1.0, mix(0.5, 1.25, skyR), shine);
      col += uSkyColor * skyR * shine * 0.12;
    }
  }
  if (leafy) col += base * uSunColor * pow(max(dot(-v, uSunDir), 0.0), 4.0) * 0.55 * (0.3 + 0.7 * sh);   // 역광에 비치는 잎
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  col += uSunColor * uRim * 0.2 * smoothstep(0.35, 0.6, rim) * (0.4 + 0.6 * light);   // 윤곽 빛
  if (mat == 5) col += base * 0.35 * rim;                         // 천의 부드러운 광택
  if (skin && uCel < 0.5) col += base * vec3(0.35, 0.1, 0.06) * (1.0 - light) * 0.8;   // 그늘진 피부는 붉은 기운 (피부 속으로 스민 빛)
  if (hairMat) {   // 검은 머리의 윤기 띠
    vec3 hh = normalize(uSunDir + v);
    float band = smoothstep(0.5, 0.6, pow(max(dot(n, hh), 0.0), 6.0));
    col += vec3(0.32, 0.38, 0.55) * band * (0.35 + 0.65 * sh) + uSkyColor * 0.25 * rim;
  }
  if (shine > 0.0) {
    vec3 h = normalize(uSunDir + v);
    float spec = smoothstep(0.6, 0.7, pow(max(dot(n, h), 0.0), 40.0));   // 또렷한 반짝임
    col += (uSunColor * spec * sh * 0.9 + uSkyColor * rim * 0.9) * shine;
  }
  if (under > 0.0) col += uSunColor * caustic(vWorld.xz) * 0.5 * sh * smoothstep(0.0, 0.15, under) * exp(-under * 1.2);
  if (uLightCount > 0) col += base * pointLights(vWorld, n, leafy ? 0.5 : 0.15) * (uCel > 0.5 ? 1.5 : 1.0);
  if (mat == 9) {   // 수정: 속에서 은은히 빛나고, 비스듬히 보이는 면은 더 밝게 반짝임
    float fres = pow(1.0 - max(dot(n, v), 0.0), 2.0);
    col = col * 0.5 + base * (0.9 + 0.25 * sin(uTime * 1.7 + vWorld.x * 2.0 + vWorld.z)) + base * fres * 1.6;
  }
  if (mat == 6) col = (uGlowSwap.w > 0.5 ? uGlowSwap.rgb : base) * (2.6 + 0.6 * sin(uTime * 2.6 + vWorld.y * 3.0));   // 스스로 빛나는 부분 (룬, 괴물 눈): 숨 쉬듯 은은하게 밝아졌다 어두워짐
  col = mix(col, vec3(2.4), uFlash);
  float dist = length(vWorld - uCamPos);
  float fog = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
  vec3 fogC = sunFog(uFogColor, -v, uSunDir);
  if (uHaze.w > 0.0) {
    // 공기 원근감: 멀수록 색이 바래고 대비가 줄다가, 먼 언덕·산은 푸른 공기 색에 잠김
    // 높은 곳은 공기가 옅어 덜 흐려짐 → 산등성이가 겹겹이 보임
    float farK = smoothstep(25.0, 260.0, dist);
    float air = 1.0 - exp(-max(dist - 20.0, 0.0) * uHaze.w * exp(-max(vWorld.y, 0.0) * 0.003));
    col = mix(col, vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), air * 0.55);
    col = mix(col, uHaze.rgb, air * farK);
    fogC = mix(vec3(dot(fogC, vec3(0.2126, 0.7152, 0.0722))), fogC, 0.15 + 0.85 * farK);   // 가까운 안개는 무채색에 가깝게 (초록 숲이 청록으로 물들지 않게)
  }
  col = mix(col, fogC, fog);
  float mist = (1.0 - exp(-dist * 0.04)) * exp(-max(vWorld.y - uMistBase, 0.0) * 1.6) * 0.3;
  col = mix(col, (uHaze.w > 0.0 ? fogC : uFogColor) * 1.1, mist);   // 물안개 (공기 원근감이 있으면 희뿌옇게)
  if (mat != 6) col = mix(col, col * pow(uDimTint, vec3(2.2)) * 0.6, uDim);   // (물들일 색은 화면 밝기 기준이라 빛 계산용으로 바꿔서 곱함)
  outColor = vec4(finish(col), uAlphaOut);   // 알파: 0 = 물체, 1 = 하늘 (빛줄기 계산에 사용)
}`,

  // 그림자 지도: 해 쪽에서 본 깊이만 기록 (잎 판은 잎 모양대로 그림자가 짐)
  shadowVS: `#version 300 es
${GLSL_MODEL}
uniform mat4 uLightVP;
out vec2 vUV;
out float vMat;
void main() {
  vUV = aUV;
  vMat = -aColor.a;
  gl_Position = uLightVP * worldPos();
}`,

  shadowFS: `#version 300 es
precision mediump float;
in vec2 vUV;
in float vMat;
uniform sampler2D uLeafTex;
void main() {
  if (vMat > 1.5 && vMat < 2.5 && texture(uLeafTex, vUV).a < 0.5) discard;
}`,

  // 캐릭터 외곽선: 조금 부풀린 몸의 뒷면을 어둡게 그림
  outlineVS: `#version 300 es
${GLSL_MODEL}
uniform mat4 uProj;
uniform mat4 uView;
out vec3 vBase;
void main() {
  vBase = aColor.rgb;
  gl_Position = uProj * uView * worldPos();
}`,

  // 외곽선: 새까맣지 않고 그 부분 색을 어둡게 한 색 (피부는 갈색, 금은 짙은 황토, 갑옷은 짙은 청회색 → 부드럽고 고급스럽게)
  outlineFS: `#version 300 es
precision mediump float;
in vec3 vBase;
uniform vec3 uColor;
out vec4 outColor;
void main() {
  outColor = vec4(mix(uColor, pow(vBase, vec3(1.0 / 2.2)) * 0.3, 0.8), 0.0);
}`,

  // 잔상: 테두리일수록 진한 푸른 빛 (더하기로 겹쳐 그림)
  ghostVS: `#version 300 es
${GLSL_MODEL}
uniform mat4 uProj;
uniform mat4 uView;
out vec3 vN;
out vec3 vWorld;
void main() {
  vec4 w = worldPos();
  vWorld = w.xyz;
  vN = mat3(uModel) * aNormal;
  gl_Position = uProj * uView * w;
}`,

  ghostFS: `#version 300 es
precision mediump float;
in vec3 vN;
in vec3 vWorld;
uniform vec3 uColor;
uniform vec3 uCamPos;
out vec4 outColor;
void main() {
  float f = 1.0 - abs(dot(normalize(vN), normalize(uCamPos - vWorld)));
  outColor = vec4(uColor * (0.12 + 1.6 * f * f), 0.0);
}`,

  // 물: 얕은 곳은 맑은 청록, 깊은 곳은 짙은 파랑 + 하늘 반사 + 반짝임 + 물가 거품
  waterVS: `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 3) in float aDepth;
uniform mat4 uProj;
uniform mat4 uView;
uniform float uTime;
out vec3 vWorld;
out float vDepth;
void main() {
  vec3 p = aPos;
  p.y += sin(p.x * 1.3 + uTime * 1.5) * 0.012 + cos(p.z * 1.1 + uTime * 1.2) * 0.012;
  vWorld = p;
  vDepth = aDepth;
  gl_Position = uProj * uView * vec4(p, 1.0);
}`,

  waterFS: `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vWorld;
in float vDepth;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uFogColor;
uniform vec3 uZenith;
uniform float uFogDensity;
uniform float uTime;
uniform sampler2D uRefl;    // 물에 비친 모습 (거꾸로 그린 장면)
uniform float uHasRefl;
uniform vec2 uScreen;       // 화면 크기 (픽셀)
uniform float uDim;         // 궁극기 때 어둡게 물들임
uniform vec3 uDimTint;
out vec4 outColor;
${GLSL_NOISE}
${GLSL_FINISH}
${GLSL_SHADOW}
${GLSL_ENV}
float waveH(vec2 p) {
  return vnoise(p * 1.6 + uTime * vec2(0.35, 0.22)) * 0.6 + vnoise(p * 4.2 - uTime * vec2(0.25, 0.4)) * 0.3;
}
void main() {
  vec2 p = vWorld.xz;
  float e = 0.04;
  float h0 = waveH(p);
  vec3 n = normalize(vec3((h0 - waveH(p + vec2(e, 0.0))) / e * 0.12, 1.0, (h0 - waveH(p + vec2(0.0, e))) / e * 0.12));
  vec3 v = normalize(uCamPos - vWorld);
  float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  vec3 r = reflect(-v, n);
  vec3 horizon = sunFog(uFogColor, r, uSunDir);
  vec3 sky = mix(horizon, uZenith, smoothstep(0.0, 0.5, r.y));
  float sh = shadowAt(vWorld) * cloudShadow(vWorld);
  float depth = max(vDepth, 0.0);
  vec3 body = mix(vec3(0.1, 0.42, 0.38), vec3(0.01, 0.07, 0.13), smoothstep(0.0, 1.4, depth));
  body *= 0.55 + 0.45 * sh;
  // 비친 모습: 거꾸로 그린 장면을 물결만큼 일렁이게 (없으면 하늘색만)
  vec3 refl = finish(sky);
  if (uHasRefl > 0.5) refl = texture(uRefl, gl_FragCoord.xy / uScreen + n.xz * 0.035).rgb;
  float k = clamp(0.12 + fres * 0.88, 0.0, 1.0);
  vec3 col = mix(finish(body), refl, k);   // (이 아래는 화면 밝기 기준으로 계산)
  vec3 h = normalize(uSunDir + v);
  col += vec3(1.0, 0.95, 0.82) * smoothstep(0.988, 0.996, dot(n, h)) * sh;   // 반짝이는 햇살
  float foam = smoothstep(0.22, 0.02, depth + (vnoise(p * 7.0 + uTime * 0.6) - 0.5) * 0.12);
  foam *= 0.6 + 0.4 * sin(depth * 40.0 - uTime * 3.0);
  col = mix(col, vec3(0.97), clamp(foam, 0.0, 1.0) * 0.85);
  float alpha = clamp(0.35 + k * 0.6 + smoothstep(0.0, 1.0, depth) * 0.45 + foam, 0.0, 1.0);   // 얕은 곳은 바닥이 비침
  float dist = length(vWorld - uCamPos);
  col = mix(col, finish(sunFog(uFogColor, -v, uSunDir)), 1.0 - exp(-pow(dist * uFogDensity, 2.0)));
  col = mix(col, col * uDimTint * 0.78, uDim);   // (여기 색은 이미 화면 밝기 기준)
  outColor = vec4(col, alpha);
}`,

  // 하늘: 바라보는 방향의 하늘색 + 해 + 뭉게구름
  skyVS: `#version 300 es
out vec2 vNdc;
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  vNdc = p;
  gl_Position = vec4(p, 1.0, 1.0);   // 가장 먼 깊이(1)에 그림 → 물체 뒤에 가려진 하늘은 계산을 건너뜀
}`,

  skyFS: `#version 300 es
precision highp float;
in vec2 vNdc;
uniform mat4 uInvVP;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uFogColor;
uniform vec3 uZenith;
uniform float uTime;
uniform float uDim;        // 궁극기 때 하늘을 어둡게 물들임 (0~1) → 하늘에서 떨어지는 빛·유성이 또렷이 보이게
uniform vec3 uDimTint;
uniform vec3 uCloudLit;    // 구름의 볕 받은 쪽 / 그늘 색 (낮: 흰색·푸른 회색, 노을: 주황·보라)
uniform vec3 uCloudShade;
out vec4 outColor;
${GLSL_NOISE}
${GLSL_FINISH}
void main() {
  vec4 p = uInvVP * vec4(vNdc, 1.0, 1.0);
  vec3 dir = normalize(p.xyz / p.w);
  float y = dir.y;
  vec3 horizon = sunFog(uFogColor, dir, uSunDir);
  vec3 col = mix(horizon, uZenith, pow(smoothstep(-0.02, 0.6, y), 0.8));
  float sd = max(dot(dir, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 1500.0) * 40.0 + pow(sd, 60.0) * 0.4 + pow(sd, 6.0) * 0.07);
  if (y > 0.0) {
    // 뭉게구름: 무늬를 비틀어 몽실몽실하게, 해 쪽으로 살짝 옮겨 본 값과 비교해 아래는 그늘지게
    vec2 uv = dir.xz / (y + 0.12) * 0.9 + uTime * vec2(0.01, 0.004);
    vec2 q = vec2(fbm(uv), fbm(uv + 5.2));
    float c = fbm(uv + q * 0.8);
    float cover = smoothstep(0.5, 0.72, c) * smoothstep(0.0, 0.2, y);
    float lit = clamp((c - fbm(uv + q * 0.8 + uSunDir.xz * 0.12)) * 5.0 + 0.55, 0.0, 1.0);
    vec3 cloud = mix(uCloudShade, uCloudLit, lit);
    cloud += uSunColor * pow(sd, 6.0) * 0.5 * (1.0 - smoothstep(0.5, 0.9, c));   // 해 근처 금빛 테두리
    col = mix(col, cloud, cover);
  }
  col = mix(col, horizon, smoothstep(0.06, -0.02, y));
  col = mix(col, col * pow(uDimTint, vec3(2.2)) * 0.4, uDim);
  outColor = vec4(finish(col), 1.0);   // 알파 1 = 하늘
}`,

  // 떠다니는 꽃가루 (카메라 주변을 반복해서 채움)
  particleVS: `#version 300 es
layout(location = 0) in vec3 aSeed;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uCam;
uniform float uTime;
uniform float uScale;
out float vAlpha;
void main() {
  vec3 p = aSeed * vec3(36.0, 3.5, 36.0);
  p.x += sin(uTime * 0.3 + aSeed.y * 20.0) * 1.5 + uTime * 0.35;
  p.z += cos(uTime * 0.25 + aSeed.x * 17.0) * 1.5;
  p.y += sin(uTime * 0.7 + aSeed.z * 30.0) * 0.35;
  vec3 w = vec3(uCam.x + mod(p.x - uCam.x + 18.0, 36.0) - 18.0,
                uCam.y - 1.4 + p.y,
                uCam.z + mod(p.z - uCam.z + 18.0, 36.0) - 18.0);
  vec4 v = uView * vec4(w, 1.0);
  gl_Position = uProj * v;
  float d = max(-v.z, 0.3);
  gl_PointSize = min(uScale * 0.06 / d, 24.0);
  vAlpha = (0.55 + 0.45 * sin(uTime * 2.3 + aSeed.x * 40.0)) * clamp(1.0 - d / 18.0, 0.0, 1.0);
}`,

  particleFS: `#version 300 es
precision mediump float;
in float vAlpha;
uniform vec3 uColor;   // 꽃가루(금빛) / 반딧불(연둣빛)
out vec4 outColor;
void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  float a = smoothstep(0.5, 0.0, r) * vAlpha * 0.8;
  outColor = vec4(uColor * a, a);
}`,

  // 출구의 마법 장벽(uMode 0)과 열린 뒤의 빛기둥(uMode 1): 빛을 더하는 반투명 효과
  barrierVS: `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 6) in vec2 aUV;
uniform mat4 uProj;
uniform mat4 uView;
out vec2 vUV;
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vUV = aUV;
  vWorld = aPos;
  vNormal = aNormal;
  gl_Position = uProj * uView * vec4(aPos, 1.0);
}`,

  barrierFS: `#version 300 es
precision highp float;
in vec2 vUV;
in vec3 vWorld;
in vec3 vNormal;
uniform float uTime;
uniform float uAmount;   // 진하기 (0이면 안 보임)
uniform float uMode;
uniform float uBaseY;
uniform float uHeight;   // 빛줄기 높이 (모드 2)
uniform vec3 uColor;     // 빛줄기 색 (모드 2)
uniform vec3 uCamPos;
out vec4 outColor;
${GLSL_NOISE}
void main() {
  vec3 col;
  float a;
  if (uMode > 1.5) {   // 동굴 천장 구멍으로 쏟아지는 빛줄기: 가장자리는 부드럽게, 위가 진하고 바닥 쪽은 옅게, 먼지가 천천히 흐름
    vec3 v = normalize(uCamPos - vWorld);
    float soft = pow(abs(dot(normalize(vNormal), v)), 1.5);
    float h = clamp((vWorld.y - uBaseY) / uHeight, 0.0, 1.0);
    float dust = 0.7 + 0.3 * vnoise(vec2(vWorld.x * 1.3 + vWorld.z, vWorld.y * 0.8 - uTime * 0.3) * 1.5);
    a = soft * smoothstep(0.0, 0.3, h) * (0.3 + 0.7 * h) * smoothstep(1.0, 0.8, h) * dust * 0.38;
    col = uColor;
  } else if (uMode < 0.5) {
    float n = vnoise(vUV * vec2(6.0, 8.0) + vec2(0.0, -uTime * 0.8));
    float stripes = 0.5 + 0.5 * sin(vUV.y * 40.0 - uTime * 4.0);
    float edge = smoothstep(0.12, 0.0, min(min(vUV.x, 1.0 - vUV.x), 1.0 - vUV.y));
    a = (0.12 + 0.35 * n * stripes + edge * 0.6) * smoothstep(0.0, 0.08, vUV.y);
    col = vec3(0.35, 0.9, 1.1);
  } else {
    vec3 v = normalize(uCamPos - vWorld);
    float soft = pow(abs(dot(normalize(vNormal), v)), 2.0);
    float h = clamp((vWorld.y - uBaseY) / 9.0, 0.0, 1.0);
    a = soft * (1.0 - h) * (0.28 + 0.1 * sin(uTime * 3.0 + vWorld.y * 2.0));
    col = vec3(1.2, 0.95, 0.5);
  }
  a *= uAmount;
  outColor = vec4(col * a, 0.0);
}`,

  // 스킬의 빛 (검기·회전베기 궤적·번개): 정점마다 색과 투명도, 빛을 더하는 방식
  glowVS: `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec4 aColor;
uniform mat4 uProj;
uniform mat4 uView;
out vec4 vColor;
void main() {
  vColor = aColor;
  gl_Position = uProj * uView * vec4(aPos, 1.0);
}`,

  glowFS: `#version 300 es
precision mediump float;
in vec4 vColor;
out vec4 outColor;
void main() {
  outColor = vec4(vColor.rgb * vColor.a, 0.0);
}`,

  // 검을 휘두른 자취 (카메라 기준 좌표)
  trailVS: `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in float aAlpha;
uniform mat4 uProj;
out float vAlpha;
void main() {
  vAlpha = aAlpha;
  gl_Position = uProj * vec4(aPos, 1.0);
}`,

  trailFS: `#version 300 es
precision mediump float;
in float vAlpha;
uniform vec3 uColor;
out vec4 outColor;
void main() {
  outColor = vec4(uColor * vAlpha, vAlpha);   // 무기 속성 색의 빛 자취
}`,

  // ---------- 후처리 (화면을 다 그린 뒤 한 번 더 손보기) ----------

  // 밝은 부분만 골라내기 (빛 번짐의 재료)
  brightFS: `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
out vec4 outColor;
void main() {
  vec3 c = vec3(0.0);
  for (int x = -1; x <= 1; x++)
    for (int y = -1; y <= 1; y++) c += texture(uTex, vUv + vec2(x, y) * uTexel).rgb;
  c /= 9.0;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  outColor = vec4(c * smoothstep(0.7, 1.0, l), 1.0);
}`,

  // 한 방향으로 흐리게 (가로 한 번, 세로 한 번)
  blurFS: `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir;
out vec4 outColor;
const float W[5] = float[5](0.227, 0.1945, 0.1216, 0.054, 0.0162);
void main() {
  vec3 c = texture(uTex, vUv).rgb * W[0];
  for (int i = 1; i < 5; i++) {
    c += texture(uTex, vUv + uDir * float(i)).rgb * W[i];
    c += texture(uTex, vUv - uDir * float(i)).rgb * W[i];
  }
  outColor = vec4(c, 1.0);
}`,

  // 빛줄기: 각 픽셀에서 해 쪽으로 걸어가며 '밝은 하늘'이 얼마나 보이는지 모음
  raysFS: `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uScene;
uniform vec2 uSun;
out vec4 outColor;
void main() {
  vec2 uv = vUv;
  vec2 delta = (uv - uSun) / 48.0;
  float sum = 0.0, decay = 1.0;
  for (int i = 0; i < 48; i++) {
    uv -= delta;
    vec4 s = texture(uScene, uv);
    sum += step(0.9, s.a) * max(dot(s.rgb, vec3(0.333)) - 0.55, 0.0) * decay;
    decay *= 0.97;
  }
  outColor = vec4(vec3(sum / 48.0 * 3.0), 1.0);
}`,

  // 주변 가림(SSAO): 각 픽셀 주변에 점을 뿌려 보고, 다른 물체 뒤에 숨는 점이 많을수록 구석이라 어둡게
  ssaoFS: `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uDepth;
uniform vec2 uProjXY;    // 원근 투영의 가로·세로 배율
uniform vec2 uNearFar;
uniform float uRadius;   // 살펴보는 범위 (m)
out vec4 outColor;
float linZ(float d) {
  float z = d * 2.0 - 1.0;
  return 2.0 * uNearFar.x * uNearFar.y / (uNearFar.y + uNearFar.x - z * (uNearFar.y - uNearFar.x));
}
vec3 viewPos(vec2 uv) {
  float z = linZ(texture(uDepth, uv).r);
  return vec3((uv * 2.0 - 1.0) / uProjXY * z, -z);
}
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
const vec3 K[12] = vec3[12](
  vec3(0.25, 0.1, 0.2), vec3(-0.3, 0.25, 0.15), vec3(0.1, -0.35, 0.3), vec3(-0.15, -0.2, 0.45),
  vec3(0.5, 0.3, 0.25), vec3(-0.45, 0.1, 0.5), vec3(0.2, 0.6, 0.35), vec3(-0.25, -0.55, 0.4),
  vec3(0.7, -0.2, 0.45), vec3(-0.6, 0.5, 0.5), vec3(0.35, 0.35, 0.8), vec3(-0.1, -0.75, 0.6));
void main() {
  vec3 p = viewPos(vUv);
  if (-p.z > 120.0) { outColor = vec4(1.0); return; }
  vec3 n = normalize(cross(dFdx(p), dFdy(p)));
  if (dot(n, p) > 0.0) n = -n;
  float ang = hash(gl_FragCoord.xy) * 6.2832;
  vec3 rv = normalize(vec3(cos(ang), sin(ang), hash(gl_FragCoord.yx) - 0.5));
  float occ = 0.0;
  for (int i = 0; i < 12; i++) {
    vec3 s = reflect(K[i], rv);
    if (dot(s, n) < 0.0) s = -s;
    vec3 q = p + s * uRadius;
    vec2 quv = q.xy / -q.z * uProjXY * 0.5 + 0.5;
    float diff = -q.z - linZ(texture(uDepth, quv).r);
    occ += step(0.03, diff) * smoothstep(1.0, 0.0, diff / (uRadius * 2.0));
  }
  outColor = vec4(vec3(1.0 - occ / 12.0), 1.0);
}`,

  // 주변 가림 흐리기 (거리 차이가 큰 곳은 섞지 않아 물체 테두리가 번지지 않게)
  aoBlurFS: `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform sampler2D uDepth;
uniform vec2 uDir;
uniform vec2 uNearFar;
out vec4 outColor;
float linZ(float d) {
  float z = d * 2.0 - 1.0;
  return 2.0 * uNearFar.x * uNearFar.y / (uNearFar.y + uNearFar.x - z * (uNearFar.y - uNearFar.x));
}
void main() {
  float d0 = linZ(texture(uDepth, vUv).r);
  float sum = 0.0, wsum = 0.0;
  for (int i = -3; i <= 3; i++) {
    vec2 uv = vUv + uDir * float(i);
    float d = linZ(texture(uDepth, uv).r);
    float w = exp(-abs(d - d0) / (d0 * 0.05 + 0.05)) * (1.0 - abs(float(i)) / 4.0);
    sum += texture(uTex, uv).r * w;
    wsum += w;
  }
  outColor = vec4(vec3(sum / max(wsum, 0.0001)), 1.0);
}`,

  // 나비·새·낙엽·먼지 (점 하나에 모양을 그려 넣음)
  fxVS: `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec4 aInfo;    // 크기(m), 종류, 무작위 값, 투명도
layout(location = 2) in vec3 aColor;
uniform mat4 uProj;
uniform mat4 uView;
uniform float uScale;
out float vType;
out float vSeed;
out float vAlpha;
out vec3 vColor;
void main() {
  vec4 v = uView * vec4(aPos, 1.0);
  gl_Position = uProj * v;
  gl_PointSize = clamp(aInfo.x * uScale / max(-v.z, 0.1), 1.0, 256.0);
  vType = aInfo.y;
  vSeed = aInfo.z;
  vAlpha = aInfo.w;
  vColor = aColor;
}`,

  fxFS: `#version 300 es
precision mediump float;
in float vType;
in float vSeed;
in float vAlpha;
in vec3 vColor;
uniform float uTime;
out vec4 outColor;
mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  int t = int(vType + 0.5);
  float a = 0.0;
  vec3 col = vColor;
  if (t == 0) {            // 먼지: 부드러운 뭉치
    a = smoothstep(1.0, 0.1, length(p)) * 0.6;
  } else if (t == 1) {     // 낙엽: 빙글빙글 돌며 떨어짐
    vec2 q = rot(uTime * (1.5 + vSeed * 2.0) + vSeed * 20.0) * p;
    q.x *= 1.0 + 1.5 * abs(sin(uTime * 3.0 + vSeed * 9.0));
    a = step(length(q * vec2(1.0, 2.2)), 0.9);
    col *= 0.85 + 0.3 * step(0.0, q.y);
  } else if (t == 2) {     // 나비: 두 날개가 파닥파닥
    float flap = 0.2 + 0.8 * abs(sin(uTime * 16.0 + vSeed * 30.0));
    vec2 q = vec2(abs(p.x) / flap, p.y);
    float wing = max(step(length((q - vec2(0.5, -0.2)) * vec2(1.0, 1.25)), 0.5),
                     step(length((q - vec2(0.4, 0.42)) * vec2(1.2, 1.5)), 0.36));
    float body = step(abs(p.x), 0.07) * step(abs(p.y), 0.5);
    a = max(wing, body);
    col = body > 0.5 ? vec3(0.1) : col * (0.8 + 0.4 * (1.0 - length(q - vec2(0.5, 0.0))));
  } else if (t == 3) {     // 새: V자로 날갯짓
    float flap = sin(uTime * 7.0 + vSeed * 20.0) * 0.4;
    float y = abs(p.x) * (0.45 + flap) - 0.1;
    a = step(abs(p.y + y), 0.13) * step(abs(p.x), 0.95);
  } else if (t == 4) {     // 불똥·반짝이: 밝게 빛나는 점
    a = smoothstep(1.0, 0.0, length(p));
    col *= 1.6;
  } else if (t == 6) {     // 불꽃: 아래는 둥글고 위로 뾰족하게 일렁임. 가운데는 노랗게 달아오르고, 수명이 다할수록 붉고 어둡게
    vec2 q = vec2(p.x, -p.y);
    q.x += sin(uTime * 13.0 + vSeed * 40.0 + q.y * 4.0) * 0.1 * (q.y + 1.0);
    float d = q.y < -0.3 ? length(vec2(q.x, q.y + 0.3)) / 0.62 : abs(q.x) / max(0.62 * (1.0 - (q.y + 0.3) / 1.25), 0.001);
    float body = smoothstep(1.0, 0.35, d) * step(q.y, 0.95);
    float heat = vAlpha;
    vec3 outer = mix(vec3(0.5, 0.06, 0.02), vColor, smoothstep(0.0, 0.45, heat));        // 꺼져 갈수록 검붉게
    vec3 fc = mix(outer, vec3(1.0, 0.72, 0.22), smoothstep(0.7, 0.15, d) * heat);         // 안쪽은 노랗게
    fc = mix(fc, vec3(1.0, 0.95, 0.75), smoothstep(0.3, 0.0, d) * heat * heat);           // 한가운데만 하얗게
    float fa = body * min(1.0, heat * 2.5);
    if (fa < 0.02) discard;
    outColor = vec4(fc * fa * 1.15, fa * 0.45);   // 빛을 더하되 뒤를 조금 가려서 밝은 풀밭 위에서도 색이 진하게
    return;
  } else {                 // 연기
    a = smoothstep(1.0, 0.15, length(p)) * 0.8;
  }
  a *= vAlpha;
  if (a < 0.02) discard;
  outColor = vec4(col * a, a);
}`,

  // 합치기: 장면 + 주변 가림 + 빛 번짐 + 빛줄기 + 렌즈 플레어 + 색 보정 + 가장자리 어둡게
  compositeFS: `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform sampler2D uRays;
uniform sampler2D uAO;
uniform float uBloomStrength;
uniform float uAOStrength;
uniform vec3 uRayColor;
uniform vec2 uSun;        // 화면 속 해 위치
uniform float uFlare;     // 렌즈 플레어 세기
uniform float uAspect;
uniform vec3 uFlashAdd;   // 번개가 칠 때 화면 전체에 더하는 빛
uniform vec3 uGrade;      // 구역 분위기 색 보정 (낮: 그대로, 노을: 주홍빛)
uniform float uSat;       // 채도 배율 (기본 1.22)
uniform float uContrast;  // 대비 배율 (기본 1.05)
uniform float uSplit;     // 그늘은 푸르게·밝은 곳은 따뜻하게 나누는 정도 (기본 1)
uniform vec3 uLift;       // 어두운 곳을 살짝 띄우는 색 (기본 0)
out vec4 outColor;
const float GHOST_T[4] = float[4](0.7, 1.15, 1.5, 2.1);
const float GHOST_R[4] = float[4](0.05, 0.12, 0.035, 0.09);
const vec3 GHOST_C[4] = vec3[4](vec3(1.0, 0.6, 0.3), vec3(0.4, 1.0, 0.6), vec3(0.6, 0.5, 1.0), vec3(1.0, 0.9, 0.5));
void main() {
  vec4 sc = texture(uScene, vUv);
  vec3 c = sc.rgb;
  float aoMask = (sc.a > 0.2 && sc.a < 0.3) ? 0.0 : 1.0;   // 1인칭 손·검에는 주변 가림을 넣지 않음
  c *= mix(1.0, texture(uAO, vUv).r, uAOStrength * aoMask);
  c += texture(uBloom, vUv).rgb * uBloomStrength;
  c += texture(uRays, vUv).rgb * uRayColor;
  if (uFlare > 0.0) {
    // 해가 가려졌는지: 해 주변 몇 곳이 하늘(알파 1)인지 확인
    float vis = 0.0;
    for (int i = 0; i < 5; i++) {
      vec2 o = vec2(float(i - 2), float((i * 3) % 5 - 2)) * 0.006;
      vis += step(0.9, texture(uScene, uSun + o).a);
    }
    vis *= 0.2 * step(0.0, uSun.x) * step(uSun.x, 1.0) * step(0.0, uSun.y) * step(uSun.y, 1.0);
    vec2 d = (vUv - uSun) * vec2(uAspect, 1.0);
    vec3 fl = vec3(1.0, 0.85, 0.6) * (exp(-length(d) * 7.0) * 0.14 + exp(-length(d) * 30.0) * 0.3);
    vec2 axis = vec2(0.5) - uSun;
    for (int k = 0; k < 4; k++) {
      vec2 g = (vUv - (uSun + axis * GHOST_T[k])) * vec2(uAspect, 1.0);
      fl += GHOST_C[k] * smoothstep(GHOST_R[k], GHOST_R[k] * 0.55, length(g)) * 0.06;
    }
    c += fl * vis * uFlare;
  }
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);                                   // 채도 (기본 1.22, 숲은 낮춰 부드러운 파스텔 색)
  c = (c - 0.5) * uContrast + 0.5;                             // 대비 (숲은 살짝 낮춰 공기처럼 맑게)
  c = mix(c * mix(vec3(1.0), vec3(0.94, 1.0, 1.08), uSplit), c * mix(vec3(1.0), vec3(1.05, 1.0, 0.92), uSplit), smoothstep(0.2, 0.8, l));   // 그늘은 푸르게, 밝은 곳은 따뜻하게
  c *= uGrade;
  c = c * (1.0 - uLift) + uLift;                               // 어두운 곳을 하늘빛으로 살짝 띄움 (흐린 물감 느낌)
  c += uFlashAdd;
  vec2 d = vUv - 0.5;
  c *= 1.0 - dot(d, d) * 0.55;                                 // 가장자리 살짝 어둡게
  c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;   // 색 띠 방지
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`,
};
SHADERS.postVS = FULLSCREEN_VS;
