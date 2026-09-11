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
let fogOk=null;   // 回归保护：雾 near 必须小于 far（曾因 near>far 让整幅画面被雾色糊掉）
for(let i=0;i<420;i++){
  const ph=await p.evaluate(()=>window.__SS?.lunarMission?.phase);
  if(seq[seq.length-1]!==ph) seq.push(ph);
  if(ph==='SPHERE'&&fogOk===null) fogOk=await p.evaluate(()=>{ const f=window.__SS?.lunarMission?.scene?.fog;
    return f? (f.near<f.far) : true; });
  okModal=await p.evaluate(()=>!!document.getElementById('mission-success'));
  if(okModal) break;
  await sleep(700);
}
const expect=['COUNTDOWN','IGNITION','LIFTOFF','SPHERE','STAGE_SEP','EARTH_ORBIT','DEPLOY','TRANSFER','LOI','LUNAR_ORBIT','LANDING','LANDED'];
ok('阶段序列完整且顺序正确', expect.every(x=>seq.includes(x)) && seq[0]==='COUNTDOWN' && seq[seq.length-1]==='LANDED', JSON.stringify(seq));
ok('着陆后弹出成功提示', okModal);
ok('无页面报错', perr.length===0, perr.join('; '));
ok('升空段雾参数合法(near<far)', fogOk!==false, String(fogOk));

const hasOk=await p.evaluate(()=>!!document.getElementById('mission-ok'));
ok('成功提示有「继续看月面」按钮', hasOk);
ok('成功提示有「退出演示」按钮', await p.evaluate(()=>!!document.getElementById('mission-exit')));
// 主按钮只关弹窗：任务保持激活、留在月面、开放自由观察
if(hasOk){ await p.click('#mission-ok'); await sleep(600); }
const stayed=await p.evaluate(()=>({ active:window.__SS?.lunarMission?.active, phase:window.__SS?.lunarMission?.phase,
  modal:!!document.getElementById('mission-success'), free:!!window.__SS?.lunarMission?._freeCam,
  hud:!!document.getElementById('mission-hud') }));
ok('点「继续看月面」后弹窗关闭但任务留在月面', stayed.active===true && stayed.phase==='LANDED' && !stayed.modal && stayed.free===true && stayed.hud===true, JSON.stringify(stayed));
// 再点 HUD 上的「退出演示」才真正结束并还原
await p.evaluate(()=>document.getElementById('mission-stop').click()); await sleep(600);
const after=await p.evaluate(()=>({ active:window.__SS?.lunarMission?.active, phase:window.__SS?.lunarMission?.phase,
  hud:!!document.getElementById('mission-hud'), modal:!!document.getElementById('mission-success'),
  clockRun:window.__SS?.clock?.running, moonMode:window.__SS?.orbitView?.moonMode }));
ok('点「退出演示」后模式自动关闭', after.active===false && after.phase==='IDLE' && !after.hud && !after.modal, JSON.stringify(after));
ok('任务结束恢复时钟运行', after.clockRun===true);
const gfx=await p.evaluate(()=>({ tm:window.__SS?.renderer?.toneMapping, shadow:window.__SS?.renderer?.shadowMap?.enabled,
  fog:!!window.__SS?.lunarMission?._scene }));
ok('任务结束还原色调映射/阴影等全局渲染设置', gfx.tm===0 && gfx.shadow===false, JSON.stringify(gfx));
ok('任务结束恢复月球模式', after.moonMode==='schematic');

await b.close(); s.close();
console.log('\n✅ 嫦娥奔月验收完成');
