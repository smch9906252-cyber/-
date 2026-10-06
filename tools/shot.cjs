// 개발용: 헤드리스 크롬으로 게임을 열어 스크린샷을 찍습니다 (게임에는 필요 없음).
//   NODE_PATH=$(npm root -g) node tools/shot.cjs [옵션]
//   --url=http://localhost:8000/index.html  --out=.claude/shots/a.png  --w=1280 --h=720
//   --wait=4000            찍기 전 기다리는 시간(ms)
//   --touch                휴대폰처럼 (터치 화면, 기기 픽셀 배율 2)
//   --eval="JS 코드"        페이지가 뜬 뒤 실행 (여러 번 써도 됨, 각각 뒤에 --wait 만큼 기다림)
//   --low                  그림자·SSAO·반사 끄고 풀 줄임 (글자·버튼 확인용, 훨씬 빠름)
//   --config='{"fov":60}'  CONFIG.graphics에 덮어쓸 값
//   --noshot               스크린샷 없이 --eval 결과만 (게임 동작 확인용)
// 소프트웨어 그래픽이라 한 장면이 느리므로, 게임이 한 프레임을 그린 직후 3D 화면과 글자 화면을 합쳐서 저장합니다.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const opts = { url: 'http://localhost:8000/index.html', out: '.claude/shots/shot.png', w: 1280, h: 720, wait: 4000, touch: false, evals: [] };
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([a-z]+)(?:=(.*))?$/s);
  if (!m) continue;
  if (m[1] === 'eval') opts.evals.push(m[2]);
  else if (['touch', 'low', 'noshot'].includes(m[1])) opts[m[1]] = true;
  else opts[m[1]] = /^\d+$/.test(m[2]) ? +m[2] : m[2];
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: opts.w, height: opts.h }, deviceScaleFactor: opts.touch ? 2 : 1, hasTouch: opts.touch, isMobile: opts.touch });
  const page = await ctx.newPage();
  const over = Object.assign(opts.low ? { shadows: false, ssao: false, reflections: false, grassDensity: 3 } : {}, opts.config ? JSON.parse(opts.config) : {});
  await page.route('**/js/config.js', async (route) => {   // 게임 파일은 그대로 두고 받아 올 때만 값을 덮어씀
    const r = await route.fetch();
    route.fulfill({ response: r, body: (await r.text()) + `\nObject.assign(CONFIG.graphics, ${JSON.stringify(over)});` });
  });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(opts.url);
  await page.waitForTimeout(opts.wait);
  for (const code of opts.evals) {
    const r = await page.evaluate(code);
    if (r !== undefined) console.log('eval →', JSON.stringify(r));
    await page.waitForTimeout(opts.wait);
  }
  if (opts.noshot) {
    if (errors.length) console.log(errors.join('\n'));
    await browser.close();
    return;
  }
  const url = await page.evaluate(() => new Promise((resolve) => {
    const draw = Game.draw.bind(Game);
    Game.draw = function () {
      draw();
      Game.draw = draw;
      const v = document.getElementById('view'), h = document.getElementById('hud');
      const c = document.createElement('canvas');
      c.width = h.width; c.height = h.height;
      const g = c.getContext('2d');
      g.drawImage(v, 0, 0, c.width, c.height);
      g.drawImage(h, 0, 0);
      resolve(c.toDataURL('image/png'));
    };
  }));
  fs.mkdirSync(path.dirname(opts.out), { recursive: true });
  fs.writeFileSync(opts.out, Buffer.from(url.split(',')[1], 'base64'));
  const info = await page.evaluate(() => ({ fps: Math.round(1000 / AutoQuality.avg), scale: AutoQuality.scale }));
  console.log('saved', opts.out, JSON.stringify(info));
  if (errors.length) console.log(errors.join('\n'));
  await browser.close();
})();
