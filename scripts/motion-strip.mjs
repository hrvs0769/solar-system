// 分镜节奏自检：把某个阶段按时间等分采样，拼成一条"胶片"，用来判断运镜与节奏（静止截图看不出快慢）
//   node scripts/motion-strip.mjs TRANSFER [帧数]
import puppeteer from 'puppeteer-core';
import http from 'http';
import { readFile, mkdir, writeFile } from 'fs/promises';
import { extname, join, resolve } from 'path';

const ROOT = process.env.DIST || 'dist-offline';
const OUT = process.env.OUT || 'shots';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = +(process.env.SHOT_W || 960), H = +(process.env.SHOT_H || 540);
const PHASE = process.argv[2] || 'TRANSFER';
const N = Math.max(4, Math.min(24, +(process.argv[3] || 12)));
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

const files = [];
for (let i = 0; i < N; i++) {
  const frac = i / (N - 1) * 0.995;
  await page.evaluate(({ PHASE, frac }) => { window.__SS.lunarMission.qaGoto(PHASE, frac); window.__SS.lunarMission.render(); }, { PHASE, frac });
  await sleep(260);
  await page.evaluate(() => window.__SS.lunarMission.render());
  await sleep(160);
  const f = join(OUT, `strip_${PHASE}_${String(i).padStart(2, '0')}.png`);
  await page.screenshot({ path: f });
  files.push({ f, frac, t: frac * (await page.evaluate(p => window.__SS.lunarMission.constructor ? 1 : 1, PHASE)) });
}
const dur = await page.evaluate(p => { const m = window.__SS.lunarMission; return m ? (m.ctx ? null : null) : null; }, PHASE);

const cols = 3, rows = Math.ceil(files.length / cols);
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#05070d;font:12px/1.4 -apple-system,sans-serif;color:#cfd8e6">
<div style="padding:10px 14px;font-size:15px;color:#ffb454">${PHASE} · 分镜胶片（按时间等分 ${N} 帧）</div>
<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px;padding:0 8px 10px">
${files.map((x, i) => `<div><img src="${resolve(x.f)}" style="width:100%;display:block;border:1px solid #1d2634;border-radius:3px"><div style="padding:2px 3px">第 ${i + 1} 帧 · 进度 ${(x.frac * 100).toFixed(0)}%</div></div>`).join('')}
</div></body>`;
const sheet = join(OUT, `strip_${PHASE}.html`);
await writeFile(sheet, html);
const sp = await browser.newPage();
await sp.setViewport({ width: 1500, height: 900 });
await sp.goto('file://' + resolve(sheet), { waitUntil: 'load' });
await sleep(400);
await sp.screenshot({ path: join(OUT, `strip_${PHASE}.png`), fullPage: true });

await browser.close(); server.close();
console.log(`胶片输出 → ${OUT}/strip_${PHASE}.png（${N} 帧）`);
if (errors.length) console.log('页面报错：\n' + errors.join('\n'));
