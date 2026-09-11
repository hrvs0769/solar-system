// 视觉自检台：把「嫦娥奔月」每个阶段定格，用多机位环绕拍摄（每 60° 一机位 + 导演机位），
// 输出 PNG 到 shots/ 并生成每阶段接触表（contact sheet），同时统计像素指标供客观比对。
//
// 用法：
//   node scripts/vision-audit.mjs                # 全部阶段
//   node scripts/vision-audit.mjs LANDING LOI    # 只拍指定阶段
//   PHASES=LIFTOFF node scripts/vision-audit.mjs
import puppeteer from 'puppeteer-core';
import http from 'http';
import { readFile, mkdir, writeFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, join, resolve } from 'path';

const ROOT = process.env.DIST || 'dist-offline';
const OUT = process.env.OUT || 'shots';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = +(process.env.SHOT_W || 1280), H = +(process.env.SHOT_H || 720);
const AZ = [0, 60, 120, 180, 240, 300];      // 环绕方位角
const EL = +(process.env.SHOT_EL || 12);     // 仰角
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.jpg':'image/jpeg', '.png':'image/png', '.json':'application/json' };

// 阶段 → 拍摄对象 + 机位半径（电影单位）
const PLAN = {
  COUNTDOWN:   { subject:'rocket',  dist:0.52, el:26, up:[0,1,0],  frac:0.55 },
  IGNITION:    { subject:'rocket',  dist:0.54, el:26, up:[0,1,0],  frac:0.9 },
  LIFTOFF:     { subject:'rocket',  dist:0.62, el:22,  up:[0,1,0],  frac:0.6 },
  SPHERE:      { subject:'rocket',  dist:1.0,  el:16, up:[0,1,0],  frac:0.8 },
  STAGE_SEP:   { subject:'rocket',  dist:0.50, el:12, up:[0,1,0],  frac:0.6 },
  EARTH_ORBIT: { subject:'rocket',  dist:0.80, el:30, up:[0,1,0],  frac:0.55 },
  DEPLOY:      { subject:'change',  dist:0.46, el:18, up:[0,1,0],  frac:0.6 },
  TRANSFER:    { subject:'change',  dist:0.36, el:16, up:[0,1,0],  frac:0.6 },
  LOI:         { subject:'change',  dist:0.30, el:14, up:[0,1,0],  frac:0.7 },
  LUNAR_ORBIT: { subject:'change',  dist:0.36, el:14, up:[0,1,0],  frac:0.5 },
  LANDING:     { subject:'lander',  dist:0.30, el:8, up:[-1,0,0], frac:0.55 },
  LANDED:      { subject:'lander',  dist:0.26, el:8,  up:[-1,0,0], frac:0.8 },
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

const server = http.createServer(async (req, res) => {
  let p = (req.url || '/').split('?')[0]; if (p === '/') p = '/index.html';
  try { const d = await readFile(join(ROOT, p)); res.setHeader('Content-Type', MIME[extname(p)] || 'application/octet-stream'); res.end(d); }
  catch { res.statusCode = 404; res.end('nf'); }
});
server.listen(0);
const base = `http://localhost:${server.address().port}/index.html`;

const want = process.argv.slice(2).filter(a => !a.startsWith('-'));
const phases = (want.length ? want : (process.env.PHASES ? process.env.PHASES.split(',') : Object.keys(PLAN))).filter(p => PLAN[p]);

await mkdir(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--hide-scrollbars'],
  defaultViewport: { width: W, height: H },
});
const page = await browser.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.evaluateOnNewDocument(() => { try { localStorage.setItem('ss-guide-done', '1'); } catch {} });
await page.goto(base, { waitUntil: 'load', timeout: 60000 });
// 等贴图仓库全部就绪（否则地球/月球还是无贴图的纯色球，会把加载时序误判成画质问题）
for (let i = 0; i < 120; i++) {
  const done = await page.evaluate(() => { try { const p = window.__SS?.lunarMission?.ctx ? null : null; return null; } catch { return null; } });
  const pr = await page.evaluate(() => { try { return window.__SS && window.__SS.textureProgress ? window.__SS.textureProgress() : null; } catch { return null; } });
  if (pr && pr.loaded >= pr.total) break;
  await sleep(500);
}
await sleep(1500);

// —— 页内拍摄原语 ——
await page.evaluate(() => {
  const m = window.__SS.lunarMission, THREE = window.__SS.THREE;
  window.__QA = {
    subj(name) {
      if (name === 'lander') return m.change.userData.lander;
      if (name === 'change') return m.change;
      if (name === 'booster') return m.boosters;
      return m.rocket;
    },
    goto(phase, frac) { return m.qaGoto(phase, frac); },
    cam(subject, az, el, dist, up) {
      const T = this.subj(subject); const c = T.position.clone();
      const upV = new THREE.Vector3(up[0], up[1], up[2]).normalize();
      const helper = Math.abs(upV.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const e1 = new THREE.Vector3().crossVectors(helper, upV).normalize();
      const e2 = new THREE.Vector3().crossVectors(upV, e1).normalize();
      const a = az * Math.PI / 180, r = el * Math.PI / 180;
      const pos = c.clone()
        .addScaledVector(e1, Math.cos(a) * Math.cos(r) * dist)
        .addScaledVector(e2, Math.sin(a) * Math.cos(r) * dist)
        .addScaledVector(upV, Math.sin(r) * dist);
      m.qaCam(pos.toArray(), c.toArray(), upV.toArray());
      return { pos: pos.toArray(), tgt: c.toArray() };
    },
    hero() { const d = m._camDesired(); m.qaCam(d.pos.toArray(), d.tgt.toArray(), d.up.toArray()); },
    frames(n) { return new Promise(res => { let i = 0; const step = () => (++i >= n ? res(true) : requestAnimationFrame(step)); requestAnimationFrame(step); }); },
    // 渲染一帧后立刻取像素统计（同任务内 drawImage 才能读到缓冲）
    stats() {
      m.render();
      const src = m.ctx.renderer.domElement;
      const cw = 320, ch = 180;
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      const c2 = cv.getContext('2d', { willReadFrequently: true });
      c2.drawImage(src, 0, 0, cw, ch);
      const d = c2.getImageData(0, 0, cw, ch).data;
      let sum = 0, sum2 = 0, dark = 0, bright = 0, n = cw * ch;
      for (let i = 0; i < n; i++) {
        const l = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
        sum += l; sum2 += l * l; if (l < 12) dark++; if (l > 246) bright++;
      }
      return { mean: +(sum / n).toFixed(1), std: +Math.sqrt(Math.max(0, sum2 / n - (sum / n) ** 2)).toFixed(1), dark: +(dark / n * 100).toFixed(1), clipped: +(bright / n * 100).toFixed(1) };
    },
    hud(on) { const h = document.getElementById('mission-hud'); if (h) h.style.display = on ? 'block' : 'none';
      const m2 = document.getElementById('mission-success'); if (m2) m2.style.display = 'none'; },
  };
});

const report = [];
for (const phase of phases) {
  const cfg = PLAN[phase];
  const shots = [];
  for (const cam of ['hero', ...AZ.map(a => `az${a}`)]) {
    await page.evaluate(({ phase, cfg, cam }) => {
      window.__QA.goto(phase, cfg.frac);
      window.__QA.hud(cam === 'hero');
      if (cam === 'hero') window.__QA.hero();
      else window.__QA.cam(cfg.subject, +cam.slice(2), cfg.el ?? 12, cfg.dist, cfg.up);
    }, { phase, cfg, cam });
    await page.evaluate(() => window.__QA.frames(3));
    const file = join(OUT, `${phase}_${cam}.png`);
    await page.screenshot({ path: file });
    const st = await page.evaluate(() => window.__QA.stats());
    shots.push({ cam, file, ...st });
  }
  report.push({ phase, shots });
  const mean = (shots.reduce((a, s) => a + s.mean, 0) / shots.length).toFixed(1);
  console.log(`${phase.padEnd(12)} ${shots.length} 机位  平均亮度 ${mean}  最暗 ${Math.min(...shots.map(s => s.mean))}  最亮 ${Math.max(...shots.map(s => s.mean))}`);
}

// —— 接触表：每阶段一张（4 列），另加一张「导演机位总览」——
const sheet = (title, items, cols) => `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#05070d;font:12px/1.4 -apple-system,sans-serif;color:#cfd8e6">
<div style="padding:10px 14px;font-size:15px;color:#ffb454">${title}</div>
<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;padding:0 8px 10px">
${items.map(it => `<div><img src="${it.src}" style="width:100%;display:block;border:1px solid #1d2634;border-radius:4px">
<div style="padding:2px 3px">${it.label}</div></div>`).join('')}
</div></body>`;

const sheets = [];
for (const r of report) {
  const items = r.shots.map(s => ({ src: resolve(s.file), label: `${r.phase} · ${s.cam} · 亮度${s.mean}/暗${s.dark}%/曝${s.clipped}%` }));
  const f = join(OUT, `sheet_${r.phase}.html`);
  await writeFile(f, sheet(`嫦娥奔月 · ${r.phase} · 多机位`, items, 4));
  sheets.push({ phase: r.phase, file: f });
}
{
  const items = report.map(r => { const h = r.shots[0]; return { src: resolve(h.file), label: `${r.phase} · 导演机位 · 亮度${h.mean}` }; });
  const f = join(OUT, `sheet_ALL.html`);
  await writeFile(f, sheet('嫦娥奔月 · 阶段导演机位总览', items, 4));
  sheets.push({ phase: 'ALL', file: f });
}

// 渲染接触表截图
const sheetPage = await browser.newPage();
for (const s of sheets) {
  await sheetPage.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
  await sheetPage.goto('file://' + resolve(s.file), { waitUntil: 'load' });
  await sleep(400);
  await sheetPage.screenshot({ path: join(OUT, `sheet_${s.phase}.png`), fullPage: true });
}
await writeFile(join(OUT, 'report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), errors, report }, null, 1));

await browser.close(); server.close();
console.log(`\n拍摄完成 → ${OUT}/  阶段 ${report.length}，单帧 ${report.reduce((a, r) => a + r.shots.length, 0)} 张`);
console.log('接触表：' + sheets.map(s => `sheet_${s.phase}.png`).join(', '));
if (errors.length) console.log('页面报错：\n' + errors.join('\n'));
