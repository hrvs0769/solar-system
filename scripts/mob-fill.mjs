// 手机默认视图内容填充度检查：返回亮内容的包围盒（占画面比例）
import puppeteer from 'puppeteer-core';
import http from 'http'; import { readFile } from 'fs/promises'; import { extname, join } from 'path';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.json':'application/json'};
const s=http.createServer(async(req,res)=>{let p=(req.url||'/').split('?')[0]; if(p==='/')p='/mobile.html'; const file=p.startsWith('/tmp/')?join('/',p):join('dist',p); try{const d=await readFile(file);res.setHeader('Content-Type',MIME[extname(file)]||'application/octet-stream');res.end(d);}catch(e){res.statusCode=404;res.end('nf');}});
s.listen(0); const base=`http://localhost:${s.address().port}`;
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'],defaultViewport:{width:390,height:844,isMobile:true,hasTouch:true}});
const p=await b.newPage();
try{ await page.evaluateOnNewDocument(()=>{ try{ localStorage.setItem('ss-guide-done','1'); }catch(e){} }); }catch(e){}
 await p.goto(base+'/mobile.html',{waitUntil:'load',timeout:30000}); await new Promise(r=>setTimeout(r,5500));
await p.screenshot({path:'/tmp/mob-check.png'});
const p2=await b.newPage(); await p2.goto(base+'/tmp/mob-check.png',{waitUntil:'load'});
const box=await p2.evaluate(()=>{
  const img=document.images[0]; const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight;
  const g=c.getContext('2d'); g.drawImage(img,0,0); const d=g.getImageData(0,0,c.width,c.height).data;
  let minY=1e9,maxY=-1,minX=1e9,maxX=-1,cnt=0;
  for(let y=0;y<c.height;y+=3)for(let x=0;x<c.width;x+=3){
    const i=(y*c.width+x)*4, lum=d[i]+d[i+1]+d[i+2];
    if(lum>150){ cnt++; if(y<minY)minY=y; if(y>maxY)maxY=y; if(x<minX)minX=x; if(x>maxX)maxX=x; }
  }
  return {W:c.width,H:c.height,minY,maxY,minX,maxX,cnt};
});
console.log('内容包围盒:', JSON.stringify(box), '→ 垂直覆盖', ((box.maxY-box.minY)/box.H*100).toFixed(0)+'%', '顶部留白', (box.minY/box.H*100).toFixed(0)+'%', '底部留白', ((box.H-box.maxY)/box.H*100).toFixed(0)+'%');
await b.close(); s.close();
