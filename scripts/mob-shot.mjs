// 手机端默认视图截图
import puppeteer from 'puppeteer-core';
import http from 'http'; import { readFile } from 'fs/promises'; import { extname, join } from 'path';
const ROOT = process.env.DIST||'dist', URLP = process.env.PAGE||'/mobile.html', OUT=process.argv[2]||'/tmp/mobile-ov.png';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.json':'application/json'};
const s=http.createServer(async(req,res)=>{let p=(req.url||'/').split('?')[0]; if(p==='/')p=URLP; try{const d=await readFile(join(ROOT,p));res.setHeader('Content-Type',MIME[extname(p)]||'application/octet-stream');res.end(d);}catch(e){res.statusCode=404;res.end('nf');}});
s.listen(0);
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'],defaultViewport:{width:390,height:844,isMobile:true,hasTouch:true}});
const p=await b.newPage();
try{ await page.evaluateOnNewDocument(()=>{ try{ localStorage.setItem('ss-guide-done','1'); }catch(e){} }); }catch(e){}
 await p.goto(`http://localhost:${s.address().port}${URLP}`,{waitUntil:'load',timeout:30000}); await new Promise(r=>setTimeout(r,6000)); await p.screenshot({path:OUT}); await b.close(); s.close(); console.log('SAVED', OUT);
