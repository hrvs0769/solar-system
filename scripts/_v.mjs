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
await page.goto(base, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 1500));

console.log('A:', JSON.stringify(await page.evaluate(() => window.__lunar.getState())));
await page.evaluate(() => window.__lunar.reset());
console.log('B after reset:', JSON.stringify(await page.evaluate(() => window.__lunar.getState())));
await page.evaluate(() => window.__lunar.burn(1.2));
console.log('C after burn 1.2:', JSON.stringify(await page.evaluate(() => window.__lunar.getState())));
await new Promise(r => setTimeout(r, 500));
console.log('D after 500ms:', JSON.stringify(await page.evaluate(() => window.__lunar.getState())));

await browser.close();
srv.close();