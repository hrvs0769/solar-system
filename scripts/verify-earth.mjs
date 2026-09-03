// 验证地球昼面颜色（把镜头放到地球朝向太阳一侧近拍）
import puppeteer from 'puppeteer-core';
import http from 'http'; import { readFile } from 'fs/promises'; import { extname, join } from 'path';
const ROOT='dist-offline', OUT=process.argv[2]||'/tmp/earth-day.png';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.json':'application/json'};
const s=http.createServer(async(req,res)=>{let p=(req.url||'/').split('?')[0]; if(p==='/')p='/index.html'; try{const d=await readFile(join(ROOT,p));res.setHeader('Content-Type',MIME[extname(p)]||'application/octet-stream');res.end(d);}catch(e){res.statusCode=404;res.end('nf');}});
s.listen(0);
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'],defaultViewport:{width:900,height:700}});
const p=await b.newPage();
try{ await page.evaluateOnNewDocument(()=>{ try{ localStorage.setItem('ss-guide-done','1'); }catch(e){} }); }catch(e){}
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(`http://localhost:${s.address().port}/index.html`,{waitUntil:'load',timeout:30000});
await new Promise(r=>setTimeout(r,5000));
await p.evaluate(()=>{
  const SS=window.__SS; const rig=SS.cameraRig, cam=SS.camera, ov=SS.orbitView;
  const pos=ov.getPos('earth');
  const d=Math.hypot(pos.x,pos.y,pos.z)||1; const sx=-pos.x/d, sy=-pos.y/d, sz=-pos.z/d; // 指向太阳
  const dist=0.5;
  rig.controls.target.set(pos.x,pos.y,pos.z);
  cam.position.set(pos.x+sx*dist, pos.y+sy*dist+0.12, pos.z+sz*dist);
  rig.controls.update();
});
await new Promise(r=>setTimeout(r,400));
await p.screenshot({path:OUT});
await b.close(); s.close();
console.log('SAVED', OUT, errs.join('; ')||'(no errors)');
