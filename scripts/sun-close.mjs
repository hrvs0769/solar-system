// 近拍太阳复现"左侧遮罩"问题：把镜头放到离太阳很近处看
import puppeteer from 'puppeteer-core';
import http from 'http'; import { readFile } from 'fs/promises'; import { extname, join } from 'path';
const ROOT='dist-offline', OUT=process.argv[2]||'/tmp/sun-close.png', DIST=parseFloat(process.argv[3]||'0.5');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.json':'application/json'};
const s=http.createServer(async(req,res)=>{let p=(req.url||'/').split('?')[0]; if(p==='/')p='/index.html'; try{const d=await readFile(join(ROOT,p));res.setHeader('Content-Type',MIME[extname(p)]||'application/octet-stream');res.end(d);}catch(e){res.statusCode=404;res.end('nf');}});
s.listen(0);
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'],defaultViewport:{width:900,height:700}});
const p=await b.newPage();
try{ await page.evaluateOnNewDocument(()=>{ try{ localStorage.setItem('ss-guide-done','1'); }catch(e){} }); }catch(e){}
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(`http://localhost:${s.address().port}/index.html`,{waitUntil:'load',timeout:30000});
await new Promise(r=>setTimeout(r,5000));
await p.evaluate((dist)=>{
  const SS=window.__SS, rig=SS.cameraRig, cam=SS.camera, ov=SS.orbitView;
  const pos=ov.getPos('sun');
  const len=Math.hypot(0.6,0.35,0.72); const dx=0.6/len,dy=0.35/len,dz=0.72/len;
  rig.controls.target.set(pos.x,pos.y,pos.z);
  cam.position.set(pos.x+dx*dist, pos.y+dy*dist, pos.z+dz*dist);
  rig.controls.update();
}, DIST);
await new Promise(r=>setTimeout(r,300));
await p.screenshot({path:OUT});
await b.close(); s.close(); console.log('SAVED',OUT,'dist',DIST, errs.join('; ')||'(no errors)');
