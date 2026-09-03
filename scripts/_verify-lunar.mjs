import puppeteer from 'puppeteer-core';
import http from 'http';
import { readFile } from 'fs/promises';
import { extname } from 'path';

const ROOT = '/Users/liuhuirong/Desktop/我的电脑/dsh/prototype-lunar-orbit/dist';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer(async (req, res) => {
  let p = (req.url || '/').split('?')[0];
  if (p === '/') p = '/index.html';
  try {
    const d = await readFile(ROOT + p);
    res.setHeader('Content-Type', MIME[extname(p)] || 'application/octet-stream');
    res.end(d);
  } catch (e) { res.statusCode = 404; res.end('nf'); }
});
srv.listen(0);
const base = `http://localhost:${srv.address().port}/index.html`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto(base, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 1500));

// 1) 默认圆轨道
await new Promise(r => setTimeout(r, 2500));
const s1 = await page.evaluate(() => window.__lunar.getState());
await page.screenshot({ path: '/tmp/lunar-1-circular.png' });
console.log('1 圆轨道:', JSON.stringify(s1));

// 2) 椭圆：先 reset，再 1.2× 切向加速
await page.evaluate(() => window.__lunar.reset());
await new Promise(r => setTimeout(r, 200));
await page.evaluate(() => window.__lunar.burn(1.2));
await new Promise(r => setTimeout(r, 3500));
const s2 = await page.evaluate(() => window.__lunar.getState());
await page.screenshot({ path: '/tmp/lunar-2-elliptical.png' });
console.log('2 椭圆:', JSON.stringify(s2));

// 3) 逃逸：reset，再 √2× 切向加速
await page.evaluate(() => window.__lunar.reset());
await new Promise(r => setTimeout(r, 200));
await page.evaluate(() => window.__lunar.burn(Math.SQRT2));
await new Promise(r => setTimeout(r, 4000));
const s3 = await page.evaluate(() => window.__lunar.getState());
await page.screenshot({ path: '/tmp/lunar-3-escape.png' });
console.log('3 逃逸:', JSON.stringify(s3));

console.log('errors:', errors.length ? errors : '无');
await browser.close();
srv.close();