// 整片连拍：不干预地跑完整场任务，每隔一段时间抓一帧，拼成一张总览"胶片"。
// 用途：① 一眼看完整个片子 ② 检查阶段切换有没有跳变 ③ 记录各阶段真实耗时与帧时间
//   node scripts/full-run.mjs [间隔毫秒]
import puppeteer from 'puppeteer-core';
import http from 'http';
import { readFile, mkdir, writeFile } from 'fs/promises';
import { extname, join, resolve } from 'path';

const ROOT = process.env.DIST || 'dist-offline';
const OUT = process.env.OUT || 'shots';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = +(process.env.SHOT_W || 640), H = +(process.env.SHOT_H || 360);
const EVERY = +(process.argv[2] || 800);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.jpg':'image/jpeg', '.png':'image/png', '.json':'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const server = http.createServer(async (req, res) => {
  let p = (req.url || '/').split('?')[0]; if (p === '/') p = '/index.html';
  try { const d = await readFile(join(ROOT, p)); res.setHeader('Content-Type', MIME[extname(p)] || 'application/octet-stream'); res.end(d); }
  catch { res.statusCode = 404; res.end('nf'); }
});
server.listen(0);
const base = `http://localhost:${server.address().port}/index.html`;
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
for (let i = 0; i < 120; i++) {
  const pr = await page.evaluate(() => { try { return window.__SS?.textureProgress?.() || null; } catch { return null; } });
  if (pr && pr.loaded >= pr.total) break;
  await sleep(500);
}
await sleep(1200);

const frames = [];
const phaseTimes = [];
let lastPhase = null;
const t0 = Date.now();
await page.evaluate(() => window.__SS.lunarMission.start());
while (Date.now() - t0 < 240000) {
  const st = await page.evaluate(() => ({
    phase: window.__SS?.lunarMission?.phase,
    active: window.__SS?.lunarMission?.active,
    modal: !!document.getElementById('mission-success'),
  }));
  if (st.phase !== lastPhase) { phaseTimes.push({ phase: st.phase, t: +((Date.now() - t0) / 1000).toFixed(1) }); lastPhase = st.phase; }
  const file = join(OUT, `run_${String(frames.length).padStart(3, '0')}.png`);
  const b64 = await page.screenshot({ path: file, encoding: 'base64' });
  // 与上一帧做灰度差分：任务全程没有剪辑，任何"跳变"都会表现为异常大的帧间差
  const diff = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const w = 64, h = 36, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, cur = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) cur[i] = 0.2126 * d[i*4] + 0.7152 * d[i*4+1] + 0.0722 * d[i*4+2];
    let md = null;
    if (window.__frPrev) { let sum = 0; for (let i = 0; i < cur.length; i++) sum += Math.abs(cur[i] - window.__frPrev[i]); md = sum / cur.length; }
    window.__frPrev = cur; return md;
  }, b64);
  frames.push({ file, t: +((Date.now() - t0) / 1000).toFixed(1), phase: st.phase, diff: diff === null ? null : +diff.toFixed(2) });
  if (st.modal) break;
  await sleep(Math.max(0, EVERY - 250));
}
const total = +((Date.now() - t0) / 1000).toFixed(1);

// 阶段真实耗时
const durs = phaseTimes.map((p, i) => ({ phase: p.phase, dur: +(((phaseTimes[i + 1]?.t ?? total) - p.t)).toFixed(1) }));
console.log(`整片耗时 ${total}s（采样间隔 ${EVERY}ms，共 ${frames.length} 帧）`);
console.log('阶段耗时：' + durs.map(d => `${d.phase} ${d.dur}s`).join('  '));

// 阶段边界跳变检查：全程无剪辑，帧间差应平滑；超过中位数 2.5 倍即标记出来人工复核
const diffs = frames.filter(f => f.diff !== null).map(f => f.diff).sort((a, b) => a - b);
const med = diffs[Math.floor(diffs.length / 2)];
const jumps = frames.filter(f => f.diff !== null && f.diff > Math.max(1.5, med * 2.5));
console.log(`帧间差中位数 ${med.toFixed(2)}；可疑跳变 ${jumps.length} 处` + (jumps.length ? '：' + jumps.map(f => `${f.t}s(${f.phase}) Δ${f.diff}`).join('  ') : ''));

const cols = 6, rows = Math.ceil(frames.length / cols);
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#05070d;font:11px/1.35 -apple-system,sans-serif;color:#cfd8e6">
<div style="padding:8px 12px;font-size:14px;color:#ffb454">嫦娥奔月 · 整片连拍（每 ${EVERY}ms 一帧，共 ${frames.length} 帧 / ${total}s）</div>
<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:3px;padding:0 6px 10px">
${frames.map(f => `<div><img src="${resolve(f.file)}" style="width:100%;display:block;border:1px solid #1d2634;border-radius:3px">
<div style="padding:1px 3px;color:#8fa0b8">${f.t}s · ${f.phase}</div></div>`).join('')}
</div></body>`;
const sheet = join(OUT, 'fullrun.html');
await writeFile(sheet, html);
const sp = await browser.newPage();
await sp.setViewport({ width: 1700, height: 900 });
await sp.goto('file://' + resolve(sheet), { waitUntil: 'load' });
await sleep(500);
await sp.screenshot({ path: join(OUT, 'fullrun.png'), fullPage: true });

await writeFile(join(OUT, 'fullrun.json'), JSON.stringify({ total, every: EVERY, frames, phaseTimes, durs }, null, 1));
await browser.close(); server.close();
console.log(`总览 → ${OUT}/fullrun.png`);
if (errors.length) console.log('页面报错：\n' + errors.join('\n'));
