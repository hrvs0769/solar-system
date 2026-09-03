// 手机端自检：手机竖屏视口加载 mobile.html，截图 + 点击 Tab 验证模块切换
import puppeteer from 'puppeteer-core';
import http from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';

const ROOT = process.env.DIST || 'dist';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = process.argv[2] || '/tmp/mobile.png';
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.jpg':'image/jpeg', '.png':'image/png', '.json':'application/json' };

const srv = http.createServer(async (req,res)=>{
  let p=(req.url||'/').split('?')[0];
  if(p==='/') p='/mobile.html';
  try{ const d=await readFile(join(ROOT,p)); res.setHeader('Content-Type', MIME[extname(p)]||'application/octet-stream'); res.end(d); }
  catch(e){ res.statusCode=404; res.end('nf'); }
});
srv.listen(0); const base=`http://localhost:${srv.address().port}/mobile.html`;

const browser = await puppeteer.launch({ executablePath:CHROME, headless:'new', args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'], defaultViewport:{ width:390, height:844, isMobile:true, hasTouch:true } });
const page = await browser.newPage();
try{ await page.evaluateOnNewDocument(()=>{ try{ localStorage.setItem('ss-guide-done','1'); }catch(e){} }); }catch(e){}

const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.goto(base,{waitUntil:'load',timeout:30000});
await new Promise(r=>setTimeout(r,5000));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const check=(n,c,i='')=>console.log((c?'  ok  ':'  FAIL')+' '+n+(i?'  ['+i+']':''));

const boot=await page.evaluate(()=>({ has:!!window.__SS, id:window.__SS?.currentId, tabs:document.querySelectorAll('#m-tabs button').length }));
check('手机版启动(__SS)', boot.has, JSON.stringify(boot));
check('底部有6个Tab(含四季/卫星)', boot.tabs===6, boot.tabs);

// 点 Tab 切模块
for(const [id,sel] of [['moon-phases','月相'],['tides','潮汐'],['eclipse','日月食'],['seasons','四季'],['satellite','卫星'],['orbit-view','全景']]){
  await page.evaluate(m=>{ const b=document.querySelector(`#m-tabs button[data-mod="${m}"]`); b&&b.click(); }, id); await sleep(600);
  const cur=await page.evaluate(()=>window.__SS?.currentId);
  check(`切到「${sel}」`, cur===id, cur);
}
// 月相预设
await page.evaluate(()=>{ const b=document.querySelector('#m-tabs button[data-mod="moon-phases"]'); b&&b.click(); }); await sleep(500);
await page.evaluate(()=>{ const b=document.querySelector('[data-preset="180"]'); b&&b.click(); }); await sleep(500);
const isOpen=await page.evaluate(()=>window.__SS?.currentId==='moon-phases');
check('月相模块进入', isOpen);
console.log('--- pageerrors ---', errs.join('; ')||'(none)');
await page.screenshot({path:OUT});
console.log('SCREENSHOT_SAVED', OUT);
await browser.close(); srv.close();
