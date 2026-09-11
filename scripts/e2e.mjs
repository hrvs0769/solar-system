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
const click = async (sel)=>{
  const el = await page.$(sel);
  if(!el){ check(`点击 ${sel}`, false, '元素不存在'); return false; }
  try{ await el.click(); }catch(e){ check(`点击 ${sel}`, false, '元素不可点击'); return false; }
  await sleep(250); return true;
};

console.log('\n===== 1. 启动与基础 =====');
const boot = await ev(()=>({ hasSS:!!window.__SS, currentId:window.__SS?.currentId, drawCalls: window.__SS?.renderer?.info?.render?.calls }));
check('应用启动成功(__SS可见)', boot.hasSS, JSON.stringify(boot));
check('默认模块为全景', boot.currentId==='orbit-view', boot.currentId);
check('场景有绘制(drawCalls>0)', boot.drawCalls>0, boot.drawCalls);
check('无页面 JS 报错', pageErrors.length===0, pageErrors.join('; '));

console.log('\n===== 2. 模块切换(顶栏) =====');
for(const [id,sel] of [['moon-phases','月相实验室'],['eclipse','日月食'],['satellite','卫星'],['orbit-view','全景']]){
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
// 渲染 2 秒后几何体数不应增长（旧实现每帧新建 7 组几何体/材质）
const geoBefore = await ev(()=>window.__SS.renderer.info.memory.geometries);
await sleep(2000);
const geoAfter = await ev(()=>window.__SS.renderer.info.memory.geometries);
check('月相模块渲染2秒后几何体不增长', geoAfter <= geoBefore + 2, `${geoBefore}→${geoAfter}`);
// 猜一猜
await click('#moon-quiz'); await sleep(300);
const quizOpen = await ev(()=> document.getElementById('quiz-box') && getComputedStyle(document.getElementById('quiz-box')).display!=='none');
check('点「猜一猜」弹问题框', !!quizOpen);
const quizLeak = await ev(()=>document.getElementById('phaseLabel')?.textContent||'');
check('出题后不泄露答案', !/朔|上弦|望|下弦|照亮/.test(quizLeak), quizLeak);
const quizIcons = await ev(()=>{
  const opts=[...document.querySelectorAll('#quiz-opts [data-a]')];
  return { n:opts.length, svg:opts.filter(o=>o.querySelector('svg')).length };
});
check('测验选项为月相图形（不识字也能答）', quizIcons.n===4 && quizIcons.svg===4, JSON.stringify(quizIcons));
// 儿童模式：说明卡切儿童版、专业按钮收起
await click('#btn-kid'); await sleep(500);
const kidMoon = await ev(()=>({
  kidShown: getComputedStyle(document.getElementById('mp-why-kid')).display !== 'none',
  adultHidden: getComputedStyle(document.getElementById('mp-why-adult')).display === 'none',
  rayHidden: getComputedStyle(document.getElementById('moon-ray')).display === 'none',
  speakBtn: !!document.querySelector('#moon-ctx .speak-btn'),
}));
check('儿童模式显示儿童版月相说明', kidMoon.kidShown && kidMoon.adultHidden, JSON.stringify(kidMoon));
check('儿童模式收起「光线/地球影子」', kidMoon.rayHidden);
check('月相说明有语音朗读按钮', kidMoon.speakBtn);
await click('#btn-kid'); await sleep(400);
// 光线/影子开关应能点击且不报错
await click('#moon-ray'); await click('#moon-shadow');
check('点「光线」「地球影子」无异常', pageErrors.length===0, pageErrors.join('; '));
// 模块内按 F1：帮助弹层不得复用模块挂载点（旧实现直接改 #module-overlay，会连模块按钮条一起清空）
await page.keyboard.press('F1'); await sleep(350);
const helpInMod = await ev(()=>({ modal:!!document.getElementById('modal-help'), ctx:!!document.getElementById('moon-ctx'), quiz:!!document.getElementById('moon-quiz') }));
check('模块内按 F1 弹出帮助', helpInMod.modal);
check('F1 帮助不抹掉模块 UI', helpInMod.ctx && helpInMod.quiz, JSON.stringify(helpInMod));
await page.keyboard.press('Escape'); await sleep(250);
check('关闭帮助后模块 UI 仍在', await ev(()=>!!document.getElementById('moon-ctx')));
// 返回全景按钮
await click('#moon-back'); await sleep(300);
check('月相「返回全景」→ orbit-view', (await ev(()=>window.__SS.currentId))==='orbit-view');

console.log('\n===== 3.5 日月食 模块按钮 =====');
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
// 档位须真正作用到场景（旧实现只改 pixelRatio，云层/星场纹丝不动）
await ev(()=>window.__SS.quality.setTier(0)); await sleep(600);
const starHigh = await ev(()=>window.__SS.starfield.geometry.attributes.position.count);
const callsHigh = await ev(()=>window.__SS.renderer.info.render.calls);
await ev(()=>window.__SS.quality.setTier(2)); await sleep(600);
const starLow = await ev(()=>window.__SS.starfield.geometry.attributes.position.count);
const callsLow = await ev(()=>window.__SS.renderer.info.render.calls);
check('降档后星场重建(点数减少)', starLow < starHigh, `${starHigh}→${starLow}`);
check('降档后绘制调用减少(云层关闭)', callsLow < callsHigh, `${callsHigh}→${callsLow}`);
await click('#btn-reset'); await sleep(300);
const tgt = await ev(()=>({x:window.__SS.cameraRig.controls.target.x, y:window.__SS.cameraRig.controls.target.y, z:window.__SS.cameraRig.controls.target.z}));
check('点「复位」→ 相机目标归原点', near(tgt.x,0)&&near(tgt.y,0)&&near(tgt.z,0), JSON.stringify(tgt));

console.log('\n===== 4.5 新功能（书签/天象/拍照/比例/面积/今晚月相） =====');
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
await click('#tabs .tab[data-mod="orbit-view"]'); await sleep(400);
check('切回全景', (await ev(()=>window.__SS.currentId))==='orbit-view');
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

console.log('\n===== 9. 儿童模式 / 语音 / 背景音乐 =====');
await click('#tabs .tab[data-mod="orbit-view"]'); await sleep(300);
const kidOff = await ev(()=>({ has:!!document.getElementById('btn-kid'), on:document.body.classList.contains('kid-mode') }));
check('顶栏有儿童模式开关', kidOff.has);
check('默认非儿童模式', !kidOff.on);
await click('#btn-kid'); await sleep(400);
const kidOn = await ev(()=>({
  on: document.body.classList.contains('kid-mode'),
  qualityHidden: getComputedStyle(document.getElementById('btn-quality')).display==='none',
  satHidden: getComputedStyle(document.querySelector('.tab[data-mod="satellite"]')).display==='none',
  rateHidden: getComputedStyle(document.getElementById('rate-select')).display==='none',
  fontSize: parseFloat(getComputedStyle(document.getElementById('ui')).fontSize),
}));
check('可开启儿童模式', kidOn.on);
check('儿童模式隐藏画质等专业控件', kidOn.qualityHidden, JSON.stringify(kidOn));
check('儿童模式隐藏卫星 Tab', kidOn.satHidden);
check('儿童模式隐藏倍速选择', kidOn.rateHidden);
check('儿童模式字号放大', kidOn.fontSize > 20, String(kidOn.fontSize));
const ttsOk = await ev(()=>('speechSynthesis' in window) && !!document.getElementById('btn-voice'));
check('顶栏有语音朗读开关且浏览器支持', ttsOk);
await click('#btn-music'); await sleep(500);
const musicOn = await ev(()=>window.__SS.music.isOn());
check('背景音乐可开启', musicOn);
await click('#btn-music'); await sleep(300);
check('背景音乐可关闭', !(await ev(()=>window.__SS.music.isOn())));
await click('#btn-kid'); await sleep(400);
check('可退出儿童模式', !(await ev(()=>document.body.classList.contains('kid-mode'))));

console.log('\n===== 10. 儿童模式：模块内文案 =====');
await click('#tabs .tab[data-mod="eclipse"]'); await sleep(700);
await click('#btn-kid'); await sleep(500);
const evtKid = await ev(()=>{
  const k=document.querySelector('#evt-explain .kid-only'), a=document.querySelector('#evt-explain .adult-only');
  return { kid: k?getComputedStyle(k).display!=='none':false, adult: a?getComputedStyle(a).display!=='none':true, txt: k?.textContent||'' };
});
check('日月食详情切换儿童版文案', evtKid.kid && !evtKid.adult, JSON.stringify(evtKid));
check('日月食儿童版文案不含「黄道交点」术语', !/黄道|交点|朔|望/.test(evtKid.txt), evtKid.txt.slice(0,30));
const evtFont = await ev(()=>parseFloat(getComputedStyle(document.getElementById('evt-explain')).fontSize));
check('日月食儿童版字号放大', evtFont > 20, String(evtFont));
// 示意图 canvas 是定位元素且挂载在 #ui 之后，历史实现会盖住顶栏左侧页签
const layering = await ev(()=>{
  const ui=getComputedStyle(document.getElementById('ui'));
  const cv=document.getElementById('ev-schematic');
  return { uiZ:ui.zIndex, cvPos:cv?getComputedStyle(cv).position:null, cvZ:cv?getComputedStyle(cv).zIndex:null };
});
check('顶栏 UI 层在示意图之上（不被盖住）', +layering.uiZ>0 && layering.cvZ==='auto', JSON.stringify(layering));
const backHit = await ev(()=>{
  const b=document.getElementById('evt-back'); const r=b.getBoundingClientRect();
  const el=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
  return { ok: el===b||b.contains(el), got: el?.id||el?.tagName };
});
check('日月食「返回全景」未被底部栏遮挡', backHit.ok, JSON.stringify(backHit));
await click('#tabs .tab[data-mod="orbit-view"]'); await sleep(400);
await ev(()=>document.getElementById('info-close')?.click()); await sleep(300);
await click('#vt-mission'); await sleep(900);
const hudKid = await ev(()=>({ phase:document.getElementById('mission-phase')?.textContent||'', sub:document.getElementById('mission-sub')?.textContent||'' }));
check('奔月任务 HUD 切儿童版阶段名', hudKid.phase==='倒计时', hudKid.phase);
check('奔月任务 HUD 切儿童版解说', hudKid.sub==='数到零，火箭就出发', hudKid.sub);
await click('#mission-stop'); await sleep(400);
check('停止奔月任务无残留 HUD', !(await ev(()=>!!document.getElementById('mission-hud'))));
await click('#btn-kid'); await sleep(300);

console.log('\n===== 11. 稳健性（老投影 / 长时运行 / 上下文丢失） =====');
await page.setViewport({ width:1024, height:768 }); await sleep(700);
const lowRes = await ev(()=>{
  const btns=[...document.querySelectorAll('#topbar .icon-btn')];
  const overflow=btns.filter(b=>{ const r=b.getBoundingClientRect(); return r.right>window.innerWidth+1||r.left<-1; }).length;
  const bar=document.getElementById('topbar').getBoundingClientRect();
  const play=document.getElementById('btn-play').getBoundingClientRect();
  return { n:btns.length, overflow, barH:Math.round(bar.height), playVisible:play.width>0&&play.bottom<=window.innerHeight+1 };
});
check('1024×768 顶栏按钮不溢出视口', lowRes.overflow===0, JSON.stringify(lowRes));
check('1024×768 顶栏换行后不遮挡过多画面', lowRes.barH<140, String(lowRes.barH));
check('1024×768 底部播放按钮可见', lowRes.playVisible);
const errBefore = pageErrors.length;
await click('#btn-play'); await sleep(300);
check('1024×768 下按钮可点且无报错', pageErrors.length===errBefore, pageErrors.slice(errBefore).join('; '));
await page.setViewport({ width:1280, height:800 }); await sleep(700);
const m1 = await ev(()=>({ g:window.__SS.renderer.info.memory.geometries, t:window.__SS.renderer.info.memory.textures }));
await sleep(6000);
const m2 = await ev(()=>({ g:window.__SS.renderer.info.memory.geometries, t:window.__SS.renderer.info.memory.textures }));
check('持续渲染 6 秒几何体不增长', m2.g <= m1.g+2, `${m1.g}→${m2.g}`);
check('持续渲染 6 秒贴图不增长', m2.t <= m1.t+2, `${m1.t}→${m2.t}`);
await ev(()=>{ try{ sessionStorage.setItem('ss-gl-reloads','2'); }catch(e){} });
await ev(()=>window.__SS.renderer.domElement.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
await sleep(400);
const glLost = await ev(()=>{
  const el=document.getElementById('gl-lost');
  return { has:!!el, btn:!!document.getElementById('gl-reload'), txt:el?.textContent||'' };
});
check('WebGL 上下文丢失时弹出恢复提示', glLost.has && glLost.btn, JSON.stringify(glLost));
check('恢复提示含「重新开始」按钮文案', /重新开始/.test(glLost.txt));
await ev(()=>document.getElementById('gl-lost')?.remove());
// 老师漏拷 textures 文件夹（离线版最常见的部署失误）：贴图全 404 也必须能跑
const page2 = await browser.newPage();
try{
  await page2.evaluateOnNewDocument(()=>{ try{ localStorage.setItem('ss-guide-done','1'); }catch(e){} });
  await page2.setRequestInterception(true);
  page2.on('request', r=>{ /textures\//.test(r.url()) ? r.abort() : r.continue(); });
  const err2=[]; page2.on('pageerror', e=>err2.push(e.message));
  await page2.goto(base, {waitUntil:'load', timeout:30000});
  await sleep(6000);
  const noTex = await page2.evaluate(()=>({ has:!!window.__SS, calls:window.__SS?.renderer?.info?.render?.calls||0 }));
  check('贴图全部缺失时仍能启动（漏拷 textures 兜底）', noTex.has && noTex.calls>0, JSON.stringify(noTex));
  check('贴图缺失时无 JS 报错', err2.length===0, err2.join('; '));
} finally { await page2.close(); }

console.log('\n===== 汇总 =====');
const pass = results.filter(r=>r.pass).length;
console.log(`\nPASS ${pass}/${results.length}${pageErrors.length?`  | pageErrors: ${pageErrors.join('; ')}`:''}`);
await browser.close(); server.close();
if(pass!==results.length || pageErrors.length){ process.exit(1); }
console.log('✅ 全部测试通过');
