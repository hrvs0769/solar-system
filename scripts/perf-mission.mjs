// 奔月模块性能测量：各阶段帧时间 + draw call / 三角形数（默认走真实 GPU，失败则回退软件渲染）
import puppeteer from 'puppeteer-core';
import http from 'http'; import { readFile } from 'fs/promises'; import { extname, join } from 'path';
const ROOT=process.env.DIST||'dist-offline';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.json':'application/json'};
const s=http.createServer(async(rq,rs)=>{let p=(rq.url||'/').split('?')[0]; if(p==='/')p='/index.html';
 try{const d=await readFile(join(ROOT,p)); rs.setHeader('Content-Type',MIME[extname(p)]||'application/octet-stream'); rs.end(d);}catch{rs.statusCode=404;rs.end('nf');}});
s.listen(0); const base=`http://localhost:${s.address().port}/index.html`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const HW=process.env.SW!=='1';
const args=['--no-sandbox','--hide-scrollbars'];
if(!HW) args.push('--enable-unsafe-swiftshader','--use-angle=swiftshader');
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args,defaultViewport:{width:1280,height:720}});
const p=await b.newPage();
await p.evaluateOnNewDocument(()=>{try{localStorage.setItem('ss-guide-done','1')}catch{}});
await p.goto(base,{waitUntil:'load',timeout:60000});
for(let i=0;i<60;i++){ const pr=await p.evaluate(()=>window.__SS&&window.__SS.textureProgress?window.__SS.textureProgress():null); if(pr&&pr.loaded>=pr.total)break; await sleep(500); }
console.log('后端:', await p.evaluate(()=>{ const gl=window.__SS.renderer.getContext(); const d=gl.getExtension('WEBGL_debug_renderer_info');
  return d?String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)):'unknown'; }));
const startMs=await p.evaluate(()=>{ const t=performance.now(); window.__SS.lunarMission.start(); return +(performance.now()-t).toFixed(0); });
console.log('任务启动耗时:', startMs+' ms（构建场景+贴图，含程序化兜底的话会明显更长）');
const phases=['COUNTDOWN','IGNITION','LIFTOFF','SPHERE','STAGE_SEP','EARTH_ORBIT','TRANSFER','LOI','LUNAR_ORBIT','LANDING','LANDED'];
for(const ph of phases){
  const r=await p.evaluate(async (ph)=>{ const m=window.__SS.lunarMission;
    m.qaGoto(ph,0.5);
    // 连续渲染 60 帧测帧时间
    const t0=performance.now(); let n=0;
    await new Promise(res=>{ const step=()=>{ m.render(); if(++n>=60) return res(); requestAnimationFrame(step); }; requestAnimationFrame(step); });
    const ms=(performance.now()-t0)/n;
    const info=m.ctx.renderer.info.render;
    return { ms:+ms.toFixed(2), calls:info.calls, tris:info.triangles };
  }, ph);
  console.log(ph.padEnd(12), (r.ms+' ms/帧').padEnd(12), ('~'+Math.round(1000/r.ms)+' fps').padEnd(9), 'draws', String(r.calls).padEnd(5), 'tris', r.tris);
}
await p.evaluate(()=>window.__SS.lunarMission.cancel());
await b.close(); s.close();
