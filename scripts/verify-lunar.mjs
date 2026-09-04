// 嫦娥奔月任务验收：点击按钮 → 阶段序列完整 → 成功弹窗 → 确定后自动关闭并恢复
import puppeteer from 'puppeteer-core';
import http from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';

const ROOT = process.env.DIST || 'dist-offline';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.jpg':'image/jpeg', '.png':'image/png', '.json':'application/json' };
const s=http.createServer(async(req,res)=>{ let p=(req.url||'/').split('?')[0]; if(p==='/') p='/index.html';
  try{ const d=await readFile(join(ROOT,p)); res.setHeader('Content-Type', MIME[extname(p)]||'application/octet-stream'); res.end(d); }
  catch(e){ res.statusCode=404; res.end('nf'); } });
s.listen(0);
const base=`http://localhost:${s.address().port}/index.html`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(n,c,i='')=>console.log((c?'  ok  ':'  FAIL')+' '+n+(i?'  ['+i+']':''));

const b=await puppeteer.launch({ executablePath:CHROME, headless:'new', args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'], defaultViewport:{width:1280,height:800} });
const p=await b.newPage();
try{ await p.evaluateOnNewDocument(()=>{ try{ localStorage.setItem('ss-guide-done','1'); }catch(e){} }); }catch(e){}
const perr=[]; p.on('pageerror',e=>perr.push(e.message));
await p.goto(base,{waitUntil:'load',timeout:30000}); await sleep(4000);

ok('有「嫦娥奔月」按钮', await p.evaluate(()=>!!document.getElementById('vt-mission')));
await p.click('#vt-mission'); await sleep(600);
ok('点击后任务激活', await p.evaluate(()=>window.__SS?.lunarMission?.active===true));
ok('任务期时钟冻结', await p.evaluate(()=>window.__SS?.clock?.running===false));

const seq=[];
let okModal=false;
for(let i=0;i<70;i++){
  const ph=await p.evaluate(()=>window.__SS?.lunarMission?.phase);
  if(seq[seq.length-1]!==ph) seq.push(ph);
  okModal=await p.evaluate(()=>!!document.getElementById('mission-success'));
  if(okModal) break;
  await sleep(1200);
}
const expect=['LAUNCH','ASCENT','STAGE_SEP','EARTH_ORBIT','TLI','TRANSFER','LOI','LUNAR_ORBIT','DESCENT','LANDED'];
ok('阶段序列完整且顺序正确', expect.every(x=>seq.includes(x)) && seq[0]==='LAUNCH' && seq[seq.length-1]==='LANDED', JSON.stringify(seq));
ok('着陆后弹出成功提示', okModal);
ok('无页面报错', perr.length===0, perr.join('; '));

const hasOk=await p.evaluate(()=>!!document.getElementById('mission-ok'));
ok('成功提示有「确定」按钮', hasOk);
if(hasOk){ await p.click('#mission-ok'); await sleep(500); }
const after=await p.evaluate(()=>({ active:window.__SS?.lunarMission?.active, phase:window.__SS?.lunarMission?.phase,
  hud:!!document.getElementById('mission-hud'), modal:!!document.getElementById('mission-success'),
  clockRun:window.__SS?.clock?.running, moonMode:window.__SS?.orbitView?.moonMode }));
ok('点确定后模式自动关闭', after.active===false && after.phase==='IDLE' && !after.hud && !after.modal, JSON.stringify(after));
ok('任务结束恢复时钟运行', after.clockRun===true);
ok('任务结束恢复月球模式', after.moonMode==='schematic');

await b.close(); s.close();
console.log('\n✅ 嫦娥奔月验收完成');
