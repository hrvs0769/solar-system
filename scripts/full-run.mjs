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
  await page.screenshot({ path: file });
  frames.push({ file, t: +((Date.now() - t0) / 1000).toFixed(1), phase: st.phase });
  if (st.modal) break;
  await sleep(Math.max(0, EVERY - 250));
}
const total = +((Date.now() - t0) / 1000).toFixed(1);

// 阶段真实耗时
const durs = phaseTimes.map((p, i) => ({ phase: p.phase, dur: +(((phaseTimes[i + 1]?.t ?? total) - p.t)).toFixed(1) }));
console.log(`整片耗时 ${total}s（采样间隔 ${EVERY}ms，共 ${frames.length} 帧）`);
console.log('阶段耗时：' + durs.map(d => `${d.phase} ${d.dur}s`).join('  '));

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
