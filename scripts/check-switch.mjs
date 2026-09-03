// 复现+验证：从月相实验室切回全景后，视口应恢复整屏（无黑边、无变形）
import puppeteer from 'puppeteer-core';
import http from 'http'; import { readFile } from 'fs/promises'; import { extname, join } from 'path';
const ROOT='dist-offline', OUT=process.argv[2]||'/tmp/switch-back.png';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.json':'application/json'};
const s=http.createServer(async(req,res)=>{let p=(req.url||'/').split('?')[0]; if(p==='/')p='/index.html'; try{const d=await readFile(join(ROOT,p));res.setHeader('Content-Type',MIME[extname(p)]||'application/octet-stream');res.end(d);}catch(e){res.statusCode=404;res.end('nf');}});
s.listen(0);
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'],defaultViewport:{width:1100,height:600}});
const p=await b.newPage();
try{ await page.evaluateOnNewDocument(()=>{ try{ localStorage.setItem('ss-guide-done','1'); }catch(e){} }); }catch(e){}
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(`http://localhost:${s.address().port}/index.html`,{waitUntil:'load',timeout:30000});
await new Promise(r=>setTimeout(r,4500));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await p.evaluate(()=>{ document.querySelector('#tabs .tab[data-mod="moon-phases"]')?.click(); }); await sleep(800);
await p.evaluate(()=>{ document.querySelector('#tabs .tab[data-mod="orbit-view"]')?.click(); }); await sleep(800);
const info=await p.evaluate(()=>{
  const r=window.__SS.renderer; const c=window.__SS.currentId;
  return { current:c, calls:r.info.render.calls, tri:r.info.render.triangles, width:r.domElement.clientWidth, height:r.domElement.clientHeight };
});
console.log('info', JSON.stringify(info), 'errors', errs.join(';')||'(none)');
await p.screenshot({path:OUT});
await b.close(); s.close(); console.log('SAVED', OUT);
