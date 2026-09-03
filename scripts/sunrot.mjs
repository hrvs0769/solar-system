import puppeteer from 'puppeteer-core';
import http from 'http'; import { readFile } from 'fs/promises'; import { extname, join } from 'path';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.json':'application/json'};
const s=http.createServer(async(req,res)=>{let p=(req.url||'/').split('?')[0]; if(p==='/')p='/index.html'; try{const d=await readFile(join('dist-offline',p));res.setHeader('Content-Type',MIME[extname(p)]||'application/octet-stream');res.end(d);}catch(e){res.statusCode=404;res.end('nf');}});
s.listen(0);
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'],defaultViewport:{width:700,height:500}});
const p=await b.newPage();
try{ await page.evaluateOnNewDocument(()=>{ try{ localStorage.setItem('ss-guide-done','1'); }catch(e){} }); }catch(e){}

await p.goto(`http://localhost:${s.address().port}/index.html`,{waitUntil:'load',timeout:30000});
await new Promise(r=>setTimeout(r,4500));
const getRot=()=>p.evaluate(()=>{ const ss=window.__SS; if(!ss||!ss.scene) return null; let sun=null; ss.scene.traverse(o=>{ if(o.userData && o.userData.body && o.userData.body.id==='sun') sun=o; }); return sun? +sun.rotation.y.toFixed(3) : null; });
const r0=await getRot();
await p.evaluate(()=>{ window.__SS.clock.jump(window.__SS.clock.jd + 12.7); });
await new Promise(r=>setTimeout(r,400));
const r1=await getRot();
const rotated = (r0!==null && r1!==null && Math.abs(r1-r0)>0.2);
console.log('sun rotation.y  @t0=',r0,' @t0+12.7天=',r1,' => 太阳自转:', rotated?'✅ 正常(随模拟时间转动)':'❌ 未转动');
await b.close(); s.close();
