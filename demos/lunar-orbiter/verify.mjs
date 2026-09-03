// 环月飞行器 demo 自检：物理正确性 + 渲染 + 交互
// 用法：先起服务器（python3 -m http.server 8123），再 node demos/lunar-orbiter/verify.mjs
import puppeteer from 'puppeteer-core';

const URL  = process.env.URL || 'http://127.0.0.1:8123/demos/lunar-orbiter/index.html';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const R_MOON = 1737.4, GM = 4902.8;

const results = [];
const check = (name, cond, info='') => {
  results.push({ name, pass: !!cond });
  console.log((cond ? '  ok  ' : '  FAIL') + ' ' + name + (info ? '  [' + info + ']' : ''));
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const near = (a, b, t) => Math.abs(a - b) < t;

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();

const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await sleep(2500);

// ---- 1. 启动与渲染 ----
const boot = await page.evaluate(() => ({
  hasLO: !!window.__LO,
  canvas: !!document.querySelector('#app canvas'),
  w: document.querySelector('#app canvas')?.width || 0,
  hud: document.getElementById('d-v')?.textContent || '',
}));
check('页面无脚本错误', errors.length === 0, errors.slice(0, 2).join(' | '));
check('canvas 已创建且有尺寸', boot.canvas && boot.w > 0, boot.w + 'px');
check('仿真接口已暴露', boot.hasLO);
check('HUD 已填充数据', boot.hud.includes('km/s'), boot.hud.trim());

// 画面非纯黑（说明确实渲染出了东西）
const shot = await page.screenshot({ encoding: 'base64' });
check('截图非空', shot.length > 20000, (shot.length/1024|0) + 'KB');

// ---- 2. 圆轨道物理：200km 高度，圆轨道速度 ----
async function setAndLaunch(alt, spd) {
  await page.evaluate((alt, spd) => {
    const a = document.getElementById('s-alt'), s = document.getElementById('s-spd');
    a.value = alt; a.dispatchEvent(new Event('input'));
    s.value = spd; s.dispatchEvent(new Event('input'));
    document.getElementById('btn-launch').click();
  }, alt, spd);
  await sleep(300);
  // 注意：JSON 序列化会把 Infinity 变成 null，所以布尔判断必须在页面内完成
  return await page.evaluate(() => {
    const e = window.__LO.elements;
    return { ...e, Tinf: !isFinite(e.T) };
  });
}

const r200 = R_MOON + 200;
const vc = Math.sqrt(GM / r200);            // 圆轨道速度 ≈ 1.589
let e = await setAndLaunch(200, +vc.toFixed(2));
// 滑块步进 0.01 km/s，必然带来微小偏心，e<0.01 即视为圆轨道
check('圆轨道：偏心率 e ≈ 0', e.e < 0.01, 'e=' + e.e.toFixed(4));
check('圆轨道：近远月点高度一致', Math.abs(e.rp - e.ra) < 10,
      `rp=${(e.rp-R_MOON).toFixed(0)}km ra=${(e.ra-R_MOON).toFixed(0)}km`);
const T_expected = 2 * Math.PI * Math.sqrt(Math.pow(R_MOON+200, 3) / GM);
check('圆轨道：周期与开普勒第三定律一致',
      Math.abs(e.T - T_expected) / T_expected < 0.005,
      `${(e.T/3600).toFixed(3)}h vs ${(T_expected/3600).toFixed(3)}h`);

// ---- 3. 积分器稳定性：模拟一段时间，高度漂移应极小 ----
const altBefore = (await page.evaluate(() => window.__LO.elements)).r - R_MOON;
await sleep(4000);                            // 倍速 ×100 → 约模拟 400 秒
const after = await page.evaluate(() => window.__LO.elements);
const altAfter = after.r - R_MOON;
check('积分器稳定：圆轨道高度无明显漂移', Math.abs(altAfter - altBefore) < 12,
      `${altBefore.toFixed(0)}km → ${altAfter.toFixed(0)}km`);

// ---- 4. 逃逸轨道 ----
e = await setAndLaunch(200, 2.6);
check('高速：判定为逃逸(e>=1)', e.e >= 1, 'e=' + e.e.toFixed(3));
check('逃逸：周期显示为无穷', e.Tinf);

// ---- 5. 撞月轨道 ----
e = await setAndLaunch(200, 0.9);
check('低速：近月点低于月面(判定撞月)', e.rp <= R_MOON, 'rp=' + (e.rp - R_MOON).toFixed(0) + 'km');

// ---- 6. 近月制动挑战 ----
await page.evaluate(() => document.querySelector('[data-mode="brake"]').click());
await sleep(400);
const brakeMode = await page.evaluate(() => ({
  fireShown: document.getElementById('fire').classList.contains('on'),
  flags: window.__LO.flags,
  note: document.getElementById('note').textContent.slice(0, 12),
}));
check('制动模式：点火面板出现', brakeMode.fireShown);
check('制动模式：说明卡已切换', brakeMode.note.includes('近月制动'));
check('制动模式：初始为未被捕获状态', brakeMode.flags.captured === false);

// 模拟一个"会抓时机"的学生：飞到最近点附近时点火
let fired = false, minAlt = 1e9, toPeriAtFire = 1e9;
for (let i = 0; i < 140; i++) {
  const st = await page.evaluate(() => {
    const e = window.__LO.elements, s = window.__LO.state;
    const vr = (s.p.x*s.v.x + s.p.y*s.v.y + s.p.z*s.v.z) / e.r;
    return { r: e.r, rp: e.rp, closing: vr < 0, flags: window.__LO.flags };
  });
  if (st.flags.crashed || st.flags.escaped) break;
  const alt = st.r - R_MOON;
  if (alt < minAlt) minAlt = alt;
  const toPeri = alt - (st.rp - R_MOON);
  if (toPeri < 260 && st.closing && !fired) {
    toPeriAtFire = toPeri;
    const b4 = await page.evaluate(() => ({ e: window.__LO.elements, f: window.__LO.flags }));
    await page.evaluate(() => document.getElementById('btn-fire').click());
    await sleep(150);
    const af = await page.evaluate(() => ({ e: window.__LO.elements, f: window.__LO.flags }));
    console.log(`  点火前 r=${b4.e.r.toFixed(0)}km v=${b4.e.v.toFixed(3)}km/s e=${b4.e.e.toFixed(3)}`);
    console.log(`  点火后 v=${af.e.v.toFixed(3)}km/s e=${af.e.e.toFixed(3)} 近月点=${(af.e.rp-R_MOON).toFixed(0)}km captured=${af.f.captured}`);
    fired = true;
    await sleep(400);
    break;
  }
  await sleep(150);
}
check('制动挑战：已飞抵近月点附近', minAlt < 1200, '最近高度 ' + minAlt.toFixed(0) + 'km');
check('制动挑战：已在最佳窗口点火', fired);
const afterFire = await page.evaluate(() => ({ el: window.__LO.elements, flags: window.__LO.flags }));
check('制动后：轨道被月球捕获', afterFire.flags.captured && afterFire.el.e < 1,
      'e=' + afterFire.el.e.toFixed(3));

// ---- 7. 截图留存 ----
await page.evaluate(() => { document.querySelector('[data-mode="free"]').click(); });
await sleep(200);
await setAndLaunch(200, +(Math.sqrt(GM / (R_MOON + 200))).toFixed(2));
await sleep(1800);
await page.screenshot({ path: 'demos/lunar-orbiter/preview-free.png' });

await page.evaluate(() => document.querySelector('[data-mode="brake"]').click());
await sleep(2500);
await page.screenshot({ path: 'demos/lunar-orbiter/preview-brake.png' });

check('运行全程无新增脚本错误', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();

const pass = results.filter(r => r.pass).length;
console.log(`\n通过 ${pass}/${results.length}`);
if (errors.length) console.log('错误明细:\n' + errors.join('\n'));
process.exit(pass === results.length ? 0 : 1);
