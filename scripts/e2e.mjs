// e2e 端到端测试：真实浏览器逐点击验证交互。用法：npm run build:offline && node scripts/e2e.mjs
import puppeteer from 'puppeteer-core';
import http from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';

const ROOT = process.env.DIST || 'dist-offline';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.jpg':'image/jpeg', '.png':'image/png', '.json':'application/json' };

function serve(root){
  const s = http.createServer(async (req,res)=>{
    let p = (req.url||'/').split('?')[0]; if(p==='/') p='/index.html';
    try { const d = await readFile(join(root, p)); res.setHeader('Content-Type', MIME[extname(p)]||'application/octet-stream'); res.end(d); }
    catch(e){ res.statusCode=404; res.end('nf'); }
  });
  s.listen(0); return s;
}

// —— 断言收集 ——
const results=[]; const log=[];
function check(name, cond, info=''){ results.push({name, pass:!!cond}); console.log((cond?'  ok  ':'  FAIL')+' '+name+(info?'  ['+info+']':'')); }
const near=(a,b,t=0.15)=>Math.abs(a-b)<t;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const server = serve(ROOT);
const base = `http://localhost:${server.address().port}/index.html`;
const browser = await puppeteer.launch({ executablePath:CHROME, headless:'new', args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'], defaultViewport:{width:1280,height:800} });
const page = await browser.newPage();
try{ await page.evaluateOnNewDocument(()=>{ try{ localStorage.setItem('ss-guide-done','1'); }catch(e){} }); }catch(e){}

const pageErrors=[];
page.on('pageerror', e=>pageErrors.push(e.message));
await page.goto(base, {waitUntil:'load', timeout:30000});
await sleep(4500);

const ev = fn => page.evaluate(fn);
const click = async (sel)=>{ await page.click(sel); await sleep(250); };

console.log('\n===== 1. 启动与基础 =====');
const boot = await ev(()=>({ hasSS:!!window.__SS, currentId:window.__SS?.currentId, drawCalls: window.__SS?.renderer?.info?.render?.calls }));
check('应用启动成功(__SS可见)', boot.hasSS, JSON.stringify(boot));
check('默认模块为全景', boot.currentId==='orbit-view', boot.currentId);
check('场景有绘制(drawCalls>0)', boot.drawCalls>0, boot.drawCalls);
check('无页面 JS 报错', pageErrors.length===0, pageErrors.join('; '));

console.log('\n===== 2. 模块切换(顶栏) =====');
for(const [id,sel] of [['moon-phases','月相实验室'],['tides','潮汐'],['eclipse','日月食'],['satellite','卫星'],['orbit-view','全景']]){
  await click(`#tabs .tab[data-mod="${id}"]`);
  const cur = await ev(()=>window.__SS.currentId);
  check(`切换到「${sel}」`, cur===id, cur);
}

console.log('\n===== 3. 模块内按钮可点(pointer-events 修复) =====');
await click('#tabs .tab[data-mod="moon-phases"]');
const mpOk = await ev(()=>({ ctx: !!document.getElementById('moon-ctx'), phase: document.getElementById('phaseLabel')?.textContent || '' }));
check('月相模块浮层出现', mpOk.ctx, JSON.stringify(mpOk));
// 预设：点「朔」应跳到朔（相位名含"朔"）
await click('[data-preset="0"]');
await sleep(400);
const phaseTxt = await ev(()=>document.getElementById('phaseLabel')?.textContent||'');
check('点「朔」预设 → 相位名含朔', /朔/.test(phaseTxt), phaseTxt);
// 猜一猜
await click('#moon-quiz'); await sleep(300);
const quizOpen = await ev(()=> document.getElementById('quiz-box') && getComputedStyle(document.getElementById('quiz-box')).display!=='none');
check('点「猜一猜」弹问题框', !!quizOpen);
// 光线/影子开关应能点击且不报错
await click('#moon-ray'); await click('#moon-shadow');
check('点「光线」「地球影子」无异常', pageErrors.length===0, pageErrors.join('; '));
// 返回全景按钮
await click('#moon-back'); await sleep(300);
check('月相「返回全景」→ orbit-view', (await ev(()=>window.__SS.currentId))==='orbit-view');

console.log('\n===== 3.5 潮汐 / 日月食 模块按钮 =====');
await click('#tabs .tab[data-mod="tides"]'); await sleep(400);
const tideChart = await ev(()=>!!document.getElementById('tide-schematic'));
check('潮汐模块有示意图画布', tideChart);
await click('#tide-spring'); await click('#tide-neap'); await sleep(150);
check('点「朔望大潮/上下弦小潮」无异常', pageErrors.length===0, pageErrors.join('; '));
await click('#tide-back'); await sleep(300);
check('潮汐「返回全景」→ orbit-view', (await ev(()=>window.__SS.currentId))==='orbit-view');
await click('#tabs .tab[data-mod="eclipse"]'); await sleep(500);
await click('#evt-back'); await sleep(300);
check('日月食「返回全景」→ orbit-view', (await ev(()=>window.__SS.currentId))==='orbit-view');

console.log('\n===== 4. 顶栏按钮 =====');
await click('#btn-about'); await sleep(300);
check('点「关于」弹署名框', await ev(()=>!!document.getElementById('modal-about')));
await page.keyboard.press('Escape'); await sleep(150);
await click('#btn-help'); await sleep(300);
check('点「帮助」弹快捷键框', await ev(()=>!!document.getElementById('modal-help')));
await page.keyboard.press('Escape'); await sleep(150);
await click('#btn-qr'); await sleep(500);
check('点「手机扫码」弹二维码框', await ev(()=>!!document.getElementById('modal-qr')));
const qrCanvas = await ev(()=>{ const c=document.getElementById('qr-canvas'); return c?{w:c.width,h:c.height}:null; });
check('二维码已绘制(非空白)', !!qrCanvas && qrCanvas.w>0, JSON.stringify(qrCanvas));
await page.keyboard.press('Escape'); await sleep(150);
const q0 = await ev(()=>window.__SS.quality.tierIndex);
await click('#btn-quality'); await sleep(300);
const q1 = await ev(()=>window.__SS.quality.tierIndex);
check('点「画质」切换档位', q1!==q0, `${q0}→${q1}`);
await click('#btn-reset'); await sleep(300);
const tgt = await ev(()=>({x:window.__SS.cameraRig.controls.target.x, y:window.__SS.cameraRig.controls.target.y, z:window.__SS.cameraRig.controls.target.z}));
check('点「复位」→ 相机目标归原点', near(tgt.x,0)&&near(tgt.y,0)&&near(tgt.z,0), JSON.stringify(tgt));

console.log('\n===== 4.5 新功能（书签/天象/拍照/四季/比例/面积/今晚月相） =====');
await click('#btn-bm'); await sleep(400);
check('点「书签」弹窗', await ev(()=>!!document.getElementById('modal-bookmarks')));
await click('#bm-save'); await sleep(200);
await click('#btn-bm'); await sleep(400);
const bmCount = await ev(()=> document.querySelectorAll('[data-bm]').length);
check('保存书签后列表非空', bmCount>0, 'count='+bmCount);
await page.keyboard.press('Escape'); await sleep(200);
await click('#btn-almanac'); await sleep(400);
check('点「天象」弹窗', await ev(()=>!!document.getElementById('modal-almanac')));
await page.keyboard.press('Escape'); await sleep(200);
await click('#btn-shot'); await sleep(500);
check('点「拍照」弹窗', await ev(()=>!!document.getElementById('modal-shot')));
await page.keyboard.press('Escape'); await sleep(200);
const moonBadge = await ev(()=>document.getElementById('moon-badge')?.textContent||'');
check('今晚月相角标有内容', /今晚月相/.test(moonBadge), moonBadge);
await click('#vt-prop'); await sleep(300);
const badgeTxt = await ev(()=>document.getElementById('scale-badge')?.textContent||'');
check('「比例」切换到真实距离比例', /真实距离比例/.test(badgeTxt), badgeTxt.slice(0,20));
await click('#vt-prop'); await sleep(200);
await click('#vt-kepler'); await sleep(300);
const keplerOn = await ev(()=>window.__SS.orbitView.kepler===true);
check('「面积定律」开关打开', keplerOn);
await click('#tabs .tab[data-mod="seasons"]'); await sleep(600);
check('切换到「四季」模块', (await ev(()=>window.__SS.currentId))==='seasons');
await click('[data-se="12-21"]'); await sleep(300);
const jdAfter = await ev(()=>window.__SS.clock.jd);
const decJd = Date.UTC(new Date().getUTCFullYear(),11,21,12)/86400000+2440587.5;
check('四季「冬至」跳到12月', Math.abs(jdAfter-decJd)<2, jdAfter.toFixed(2));
await click('#se-back'); await sleep(300);
check('四季「返回全景」', (await ev(()=>window.__SS.currentId))==='orbit-view');
await ev(()=>{ window.__SS.clock.running=false; window.__SS.clock.setRate(3); });

console.log('\n===== 5. 时间控制 =====');
await ev(()=>{ window.__SS.clock.running=false; window.__SS.clock.setRate(3); });   // 暂停+归一到已知倍速
const c0 = await ev(()=>({jd:window.__SS.clock.jd, running:window.__SS.clock.running, rate:window.__SS.clock.rateIndex}));
await click('#btn-rate-up'); await sleep(150);
const c2 = await ev(()=>window.__SS.clock.rateIndex);
check('点「＋」升速', c2===Math.min(c0.rate+1,6), `${c0.rate}→${c2}`);
await click('#btn-rate-down'); await sleep(150);
await click('#btn-stepfwd'); await sleep(150);
const c3 = await ev(()=>window.__SS.clock.jd);
check('点「单步+1天」日期前进1天', near(c3, c0.jd+1, 0.03), `${c0.jd.toFixed(2)}→${c3.toFixed(2)}`);
await click('#btn-stepback'); await sleep(150);
const c3b = await ev(()=>window.__SS.clock.jd);
check('点「单步-1天」日期回退1天', near(c3b, c0.jd, 0.03), `${c0.jd.toFixed(2)}→${c3b.toFixed(2)}`);
await click('#btn-now'); await sleep(150);
const c4 = await ev(()=>window.__SS.clock.jd);
const nowJd = Date.now()/86400000+2440587.5;
check('点「回到今天」≈当前日期', near(c4, nowJd, 0.02), c4.toFixed(3));
const r0 = await ev(()=>window.__SS.clock.running);
await click('#btn-play'); await sleep(150);
const r1 = await ev(()=>window.__SS.clock.running);
check('点「播放/暂停」切换运行状态', r1!==r0, `${r0}→${r1}`);

console.log('\n===== 6. 缩放(滑块+按钮) =====');
const d0 = await ev(()=>window.__SS.cameraRig.distToTarget());
await click('#zoom-in'); await sleep(250);
const d1 = await ev(()=>window.__SS.cameraRig.distToTarget());
check('点「＋」放大(距离减小)', d1 < d0, `${d0.toFixed(3)}→${d1.toFixed(3)}`);
await click('#zoom-out'); await sleep(250);
const d2 = await ev(()=>window.__SS.cameraRig.distToTarget());
check('点「−」缩小(距离增大)', d2 > d1, `${d1.toFixed(3)}→${d2.toFixed(3)}`);
await page.evaluate(()=>{ const z=document.getElementById('zoom'); z.value=100; z.dispatchEvent(new Event('input')); }); await sleep(250);
const d3 = await ev(()=>window.__SS.cameraRig.distToTarget());
check('拖动滑块到最右(近端)→距离减小', d3 < d2, `${d2.toFixed(3)}→${d3.toFixed(3)}`);
await page.evaluate(()=>{ const z=document.getElementById('zoom'); z.value=0; z.dispatchEvent(new Event('input')); }); await sleep(250);
const d4 = await ev(()=>window.__SS.cameraRig.distToTarget());
check('拖动滑块到最左(远端)→距离增大', d4 > d3, `${d3.toFixed(3)}→${d4.toFixed(3)}`);

console.log('\n===== 7. 行星菜单与信息面板 =====');
await click('.pm-item[data-id="earth"]'); await sleep(400);
const info = await ev(()=>({ open: document.getElementById('info-panel')?.classList.contains('open'), title: document.getElementById('info-body')?.textContent||'' }));
check('点「地球」→ 信息面板打开', info.open, '');
check('信息面板含"地球"', /地球/.test(info.title), info.title.slice(0,40));

console.log('\n===== 8. 日月食事件 =====');
await click('#tabs .tab[data-mod="eclipse"]'); await sleep(500);
const evCount = await ev(()=>document.querySelectorAll('#evt-list .evt').length);
check('日月食事件列表非空', evCount>0, 'events='+evCount);
const evBefore = await ev(()=>window.__SS.clock.jd);
// 点"最后一条"事件（进入时已自动跳到最近未来一次，点不同的能确认日期确实跳转）
await click('#evt-list .evt:last-child'); await sleep(400);
const evAfter = await ev(()=>window.__SS.clock.jd);
const detailShown = await ev(()=> document.getElementById('evt-detail') && getComputedStyle(document.getElementById('evt-detail')).display!=='none');
check('点事件→时间跳转', evAfter!==evBefore, `${evBefore.toFixed(3)}→${evAfter.toFixed(3)}`);
check('点事件→详情面板显示', !!detailShown);

console.log('\n===== 汇总 =====');
const pass = results.filter(r=>r.pass).length;
console.log(`\nPASS ${pass}/${results.length}${pageErrors.length?`  | pageErrors: ${pageErrors.join('; ')}`:''}`);
await browser.close(); server.close();
if(pass!==results.length || pageErrors.length){ process.exit(1); }
console.log('✅ 全部测试通过');
