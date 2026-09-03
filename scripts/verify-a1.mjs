// A-1 验收：月相几何成因可视化（DOM 断言 + 截图像素扫描）
import puppeteer from 'puppeteer-core';
import http from 'http'; import { readFile } from 'fs/promises'; import { extname, join } from 'path';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.json':'application/json'};
const s=http.createServer(async(req,res)=>{
  let p=(req.url||'/').split('?')[0]; if(p==='/')p='/index.html';
  const file = p.startsWith('/tmp/') ? join('/', p) : join('dist-offline', p);
  try{ const d=await readFile(file); res.setHeader('Content-Type', MIME[extname(file)]||'application/octet-stream'); res.end(d); }
  catch(e){ res.statusCode=404; res.end('nf'); }
});
s.listen(0); const base=`http://localhost:${s.address().port}`;
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'],defaultViewport:{width:1200,height:700}});
const p=await b.newPage();
try{ await page.evaluateOnNewDocument(()=>{ try{ localStorage.setItem('ss-guide-done','1'); }catch(e){} }); }catch(e){}
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const ok=(n,c,i='')=>console.log((c?'  ok  ':'  FAIL')+' '+n+(i?'  ['+i+']':''));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await p.goto(base+'/index.html',{waitUntil:'load',timeout:30000}); await sleep(4000);
await p.evaluate(()=>{ document.querySelector('#tabs .tab[data-mod="moon-phases"]')?.click(); }); await sleep(900);

const dom=await p.evaluate(()=>({
  label: document.getElementById('phaseLabel')?.textContent||'',
  note: (document.getElementById('moon-ctx')?.textContent||''),
}));
ok('相位标签含「夹角」', /夹角/.test(dom.label), dom.label);
ok('相位标签含「照亮%」', /照亮/.test(dom.label));
ok('说明含「公转」', /公转/.test(dom.note));
ok('说明含「自转与公转同步」', /自转与公转同步/.test(dom.note));
ok('说明含「0°=朔…」', /0°=朔/.test(dom.note));
ok('说明含「月相不是地球影子」', /不是地球影子/.test(dom.note));
ok('右视图注明「沿…视线」', /视线/.test(dom.note));

await p.screenshot({path:'/tmp/a1-shot.png'});
const page2=await b.newPage();
await page2.goto(base+'/tmp/a1-shot.png',{waitUntil:'load'});
const scan=await page2.evaluate(async()=>{
  const img=document.querySelector('img')||document.images[0];
  const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight;
  document.body.appendChild(c);
  const g=c.getContext('2d'); g.drawImage(img,0,0);
  const W=c.width, H=c.height;
  const d=g.getImageData(0,0,W,H).data;
  let sun=0, blue=0, moon=0, darkL=0, darkR=0, brightL=0, brightR=0;
  for(let y=0;y<H;y+=2)for(let x=0;x<W;x+=2){
    const i=(y*W+x)*4, r=d[i], gg=d[i+1], bb=d[i+2];
    if(r>190 && gg>110 && bb<130) sun++;
    if(bb>r+25 && bb>60) blue++;
    if(Math.abs(r-gg)<22 && Math.abs(gg-bb)<22 && r>70 && r<235) moon++;
    const lum=r+gg+bb;
    if(x<W/2){ if(lum<24) darkL++; if(lum>90) brightL++; }
    else { if(lum<24) darkR++; if(lum>90) brightR++; }
  }
  return {sun, blue, moon, darkL, darkR, brightL, brightR};
});
ok('左视口有太阳(橙黄像素)', scan.sun>80, 'sun='+scan.sun);
ok('左视口有地球(蓝色像素)', scan.blue>20, 'blue='+scan.blue);
ok('右视口有月球(灰白像素)', scan.moon>150, 'moon='+scan.moon);
ok('左视口非黑(无遮罩)', scan.brightL>800, 'brightL='+scan.brightL);
ok('右视口非黑(无遮罩)', scan.brightR>800, 'brightR='+scan.brightR);
console.log('pageerrors:', errs.join('; ')||'(none)');
await b.close(); s.close();
