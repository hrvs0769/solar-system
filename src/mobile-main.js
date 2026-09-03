// 手机端主控：复用同一天文/场景/教学核心，重做为触屏 + 竖屏交互
import * as THREE from 'three';
import './mobile/mobile.css';
import { bus } from './sim/bus.js';
import { Clock, RATES, RATE_LABELS } from './sim/clock.js';
import { CameraRig } from './sim/camera.js';
import { Quality, TIERS } from './sim/quality.js';
import { textureStore } from './scene/texture-store.js';
import * as astro from './sim/astro.js';
import { BODIES, FOCUS_INDEX, LUNA, bodyColor } from './config.js';
import { buildSystem } from './scene/build-system.js';
import { createLabelRenderer } from './scene/labels.js';
import { OrbitView } from './modules/orbit-view.js';
import { MoonPhases } from './modules/moon-phases.js';
import { Tides } from './modules/tides.js';
import { Eclipse } from './modules/eclipse.js';
import { Seasons } from './modules/seasons.js';
import { fmtJdLocal, jdToDate, dateToJd } from './sim/timeutil.js';
import { FACTS } from './data/planet-facts.js';
import { listBookmarks, saveCurrentBookmark, applyBookmark } from './ui/bookmarks.js';
import { KEYS } from './config.js';

const q = id => document.getElementById(id);

function webgl2(){ try{ const c=document.createElement('canvas'); return !!c.getContext('webgl2'); }catch(e){ return false; } }

async function boot(){
  if(!webgl2()){ document.body.innerHTML='<div style="padding:60px;text-align:center;color:#e8ecf5;font-family:sans-serif"><h2>无法启动 3D 场景</h2><p style="margin-top:12px;color:#9aa7bd">请使用支持 WebGL2 的较新手机浏览器（Chrome/Safari）。</p></div>'; return; }

  const renderer = new THREE.WebGLRenderer({ antialias:true, logarithmicDepthBuffer:true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  document.getElementById('app').appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, 0.0001, 1200);
  const clock = new Clock();
  const quality = new Quality(renderer, (t)=>{ textureStore.setTier(t.id); });
  try{
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)||'') : '';
    if(/swiftshader|llvmpipe|software|basic render/i.test(gpu)){ quality.setTier(2, true); }
  }catch(e){}
  const labelRenderer = createLabelRenderer();

  const system = {};
  await buildSystem(system, labelRenderer, quality.tier);

  const cameraRig = new CameraRig(camera, renderer.domElement, {
    presets: {
      overview:{ pos:[2.3,3.5,2.3], target:[0,0,0] },
      ecliptic:{ pos:[0.001,8,0], target:[0,0,0] },
      earthMoon:{ pos:[-0.2,0.1,0.2], target:[1,0,0] },
      sunLine:{ pos:[3,0.6,0.001], target:[0,0,0] },
    },
    bodyPosFn: ()=>0,
  });
  cameraRig.setPreset('overview');

  const ctx = { renderer, camera, cameraRig, clock, quality, bus, astro, system, labelRenderer, hiddenUI:false, switchModule:null };
  ctx.orbitView = null;

  const orbitView = new OrbitView(ctx);
  const moonPhases = new MoonPhases(ctx);
  const tides = new Tides(ctx);
  const eclipse = new Eclipse(ctx);
  const seasons = new Seasons(ctx);
  const modules = { 'orbit-view':orbitView, 'moon-phases':moonPhases, 'tides':tides, 'eclipse':eclipse, 'seasons':seasons };
  ctx.mod = { moonPhases, tides, eclipse, seasons };
  let current = orbitView, currentId='orbit-view';
  cameraRig.bodyPosFn = id => orbitView.getPos(id) || {x:0,y:0,z:0};
  ctx.orbitView = orbitView;

  function switchModule(id){
    if(id===currentId) return;
    current.exit();
    const ov = document.getElementById('module-overlay'); if(ov) ov.innerHTML='';
    q('m-info').classList.remove('open');
    current = modules[id]; currentId = id;
    current.enter();
    // 全景专属角标（比例/今晚月相）只在全景显示，避免遮挡教学模块内容
    q('scale-badge') && (q('scale-badge').style.display = id==='orbit-view' ? '' : 'none');
    q('moon-badge') && (q('moon-badge').style.display = id==='orbit-view' ? '' : 'none');
    bus.emit('module.activated', { moduleId:id });
  }
  ctx.switchModule = switchModule;
  bus.on('module.switch', ({ moduleId }) => switchModule(moduleId));

  // —— 渲染循环（异常兜底 + 空闲省电）——
  let last=performance.now();
  let lastCamStr=""; let lastInteract=performance.now();
  ["pointerdown","touchstart","wheel","keydown"].forEach(ev=>window.addEventListener(ev, ()=>{ lastInteract=performance.now(); }, {passive:true}));
  const onLoopError=(err)=>{ console.error("loop",err); try{ renderer.setAnimationLoop(null); }catch(e){} };
  quality.startAutoSelect();
  let bootHidden=false;
  const hideBoot=()=>{ const b=document.getElementById("boot-screen"); if(b) b.style.display="none"; };
  renderer.setAnimationLoop((now)=>{
    try{
      const dt=Math.min((now-last)/1000,0.1); last=now;
      clock.tick(dt); astro.beginFrame(clock.jd);
      current.update(dt); cameraRig.update(dt); quality.sample(dt);
      const camStr = camera.matrixWorld.elements.join(",")+"|"+cameraRig.controls.target.toArray().join(",");
      const idle = !clock.running && currentId==="orbit-view" && camStr===lastCamStr && (now-lastInteract>600);
      lastCamStr = camStr;
      if(!idle) current.render();
      if(!bootHidden && renderer.info.render.calls>0){ bootHidden=true; hideBoot(); }
    }catch(err){ onLoopError(err); }
  });

  // —— 今晚真实月相角标（每分钟刷新）——
  const updateMoonBadge=()=>{ const b=document.getElementById("moon-badge"); if(!b) return;
    const ph=astro.getPhase((new Date()).getTime()/86400000+2440587.5);
    b.textContent="今晚月相："+astro.phaseName(ph.fraction,ph.angle)+" · 照亮"+(ph.fraction*100).toFixed(0)+"%"; };
  updateMoonBadge(); setInterval(updateMoonBadge, 60000);

  // —— UI 装配 ——
  buildPlanetChips(orbitView, cameraRig);
  buildTabs();
  buildTime(clock);
  buildCtx(ctx);             // module.activated → 渲染模块控制（经 ctx.mod 注入）
  buildInfo();                // body.select → 抽屉
  buildModals(ctx);           // about/help/截图/书签/引导
  buildToast();
  bus.emit('module.activated', { moduleId:'orbit-view' });

  window.addEventListener('resize', ()=>{ camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth,window.innerHeight); labelRenderer.setSize(window.innerWidth,window.innerHeight); });

  window.__SS = { renderer, get scene(){return system.scene;}, get camera(){return camera;}, cameraRig, clock, quality, bus, get orbitView(){return orbitView;}, get currentId(){return currentId;} };
}

// —— 行星横滑条 ——
function buildPlanetChips(orbitView, cameraRig){
  const box = q('m-planets');
  const defs = BODIES.map(b=>({ id:b.id, zh:b.name_zh, color:b.color })).concat([{ id:'moon', zh:'月球', color:LUNA.color }]);
  box.innerHTML = defs.map(d=>`<div class="chip" data-id="${d.id}"><span class="dot" style="background:${d.color}"></span>${d.zh}</div>`).join('');
  box.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{ cameraRig.focus(c.getAttribute('data-id')); bus.emit('body.select',{bodyId:c.getAttribute('data-id')}); }));
}

// —— 底部 Tab ——
function buildTabs(){
  q('m-tabs').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>bus.emit('module.switch',{moduleId:b.getAttribute('data-mod')})));
  bus.on('module.activated', ({moduleId})=>{ q('m-tabs').querySelectorAll('button').forEach(b=>b.classList.toggle('active', b.getAttribute('data-mod')===moduleId)); });
}

// —— 时间条 ——
function buildTime(clock){
  const play=q('m-play'), now=q('m-now'), date=q('m-date'), rate=q('m-rate');
  play.addEventListener('click',()=>clock.toggle());
  now.addEventListener('click',()=>clock.backToNow());
  rate.addEventListener('click',()=>clock.setRate((clock.rateIndex+1)%RATES.length));
  bus.on('clock.changed', ()=>{
    const s=clock.state();
    play.textContent = s.running?'⏸':'▶';
    date.textContent = fmtJdLocal(s.jd, -(new Date().getTimezoneOffset())/60);
    rate.textContent = RATE_LABELS[s.rateIndex];
  });
  bus.emit('clock.changed',{});
}

// —— 模块专属控制 ——
function buildCtx(ctx){
  const mod = ctx.mod || {};
  const box=q('m-module-ctx');
  bus.on('module.activated', ({moduleId})=>{
    box.innerHTML='';
    q('m-planets').classList.toggle('hidden', moduleId!=='orbit-view');
    if(moduleId==='moon-phases') moonCtx(box, mod.moonPhases, ctx.clock);
    else if(moduleId==='tides') tidesCtx(box, mod.tides);
    else if(moduleId==='eclipse') eclipseCtx(box, mod.eclipse, ctx.clock);
    else if(moduleId==='seasons') seasonsCtx(box, mod.seasons, ctx.clock);
  });
}
function helpRow(){ return `<button class="m-btn" data-act="module:back">返回全景</button>`; }
function wireModuleBack(root){
  root.querySelectorAll('[data-act="module:back"]').forEach(b=>b.addEventListener('click',()=>bus.emit('module.switch',{moduleId:'orbit-view'})));
}
function moonCtx(box, mp, clock){
  box.innerHTML = `<div class="row"><div class="m-title" id="m-phase">相位：—</div></div>
      <div class="row">
      <button class="m-btn" data-preset="0">朔</button><button class="m-btn" data-preset="90">上弦</button>
      <button class="m-btn" data-preset="180">望</button><button class="m-btn" data-preset="270">下弦</button>
      <button class="m-btn" id="mp-ff">一个月快放</button>
    </div><div class="row">
      <button class="m-btn" id="mp-ray">光线</button><button class="m-btn" id="mp-shadow">地球影子</button>
      <button class="m-btn" id="mp-quiz">猜一猜</button>
      ${helpRow()}</div>`;
  // 实时相位读数（随模拟时间变化；桌面版的相位标签在隐藏的 overlay 里，手机端单独给）
  const renderPhase=()=>{ const e=box.querySelector('#m-phase'); if(!e) return;
    const p=astro.getPhase(clock.jd); e.textContent=`相位：${astro.phaseName(p.fraction,p.angle)} · 照亮${(p.fraction*100).toFixed(1)}% · 夹角${Math.round(p.angle)}°`; };
  renderPhase();
  if(moonCtx._off) moonCtx._off();
  moonCtx._off = bus.on('clock.changed', renderPhase);
  const getMP = ()=> mp;
  box.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>getMP()?.goPreset(+b.getAttribute('data-preset'))));
  box.querySelector('#mp-ff')?.addEventListener('click',()=>getMP()?.fastForward());
  box.querySelector('#mp-ray')?.addEventListener('click',e=>{ getMP()?.toggleRays(e.target); });
  box.querySelector('#mp-shadow')?.addEventListener('click',e=>{ getMP()?.toggleShadow(e.target); });
  box.querySelector('#mp-quiz')?.addEventListener('click',()=>mobileQuiz(box, clock));
  wireModuleBack(box);
}
// 手机端猜一猜：随机跳到一个关键相位，从地球视角作答
function mobileQuiz(box, clock){
  const targets=[0,90,180,270];
  const angle=targets[Math.floor(Math.random()*4)];
  const jd=astro.searchPhase(angle, clock.jd);
  clock.jump(jd);
  const names={0:'朔（新月）',90:'上弦月',180:'望（满月）',270:'下弦月'};
  box.innerHTML = `<div class="row" style="color:var(--text);font-size:15px">从地球看（右/下视图），现在是哪个相位？</div>
    <div class="row">${['朔（新月）','上弦月','望（满月）','下弦月'].map(n=>`<button class="m-btn" data-n="${n}">${n}</button>`).join('')}</div>
    <div class="row" id="mq-result" style="color:var(--muted);font-size:14px"></div>
    <div class="row">${helpRow()}</div>`;
  box.querySelectorAll('[data-n]').forEach(b=>b.addEventListener('click',()=>{
    const ok = b.getAttribute('data-n')===names[angle];
    b.style.background = ok?'var(--ok)':'var(--err)';
    const r=box.querySelector('#mq-result');
    if(r) r.textContent = ok?'回答正确！太阳照亮半球的朝向与我们的视线角度决定了月相。':'再想想：太阳光从哪个方向照亮月球？';
  }));
  wireModuleBack(box);
}
function tidesCtx(box, td){
  box.innerHTML = `<div class="row"><button class="m-btn" id="tide-spring">朔望大潮</button><button class="m-btn" id="tide-neap">上下弦小潮</button>${helpRow()}</div>`;
  box.querySelector('#tide-spring')?.addEventListener('click',()=>td?.preset('spring'));
  box.querySelector('#tide-neap')?.addEventListener('click',()=>td?.preset('neap'));
  wireModuleBack(box);
}
function eclipseCtx(box, ec){
  const evs = (ec && ec.events) || [];
  box.innerHTML = `<div class="evt-list" style="max-height:26vh"><div class="m-title" style="padding:0 2px 6px">近期日月食（点某条跳到该次）</div>${evs.map((ev,i)=>`<div class="evt" data-i="${i}"><div class="kind">${ev.type==='solar'?'☀️':'🌕'} ${(ev.kind==='annular'?'日环食':ev.kind==='total'?(ev.type==='solar'?'日全食':'月全食'):ev.kind==='partial'?'偏食':'半影月食')}</div><div>${ev.date.toLocaleDateString('zh-CN')}</div></div>`).join('')}
      <div style="margin-top:6px">${helpRow()}</div></div>`;
  box.querySelectorAll('.evt').forEach(el=>el.addEventListener('click',()=>ec?.selectEvent(+el.getAttribute('data-i'))));
  wireModuleBack(box);
}

function seasonsCtx(box, se, clock){
  box.innerHTML = `<div class="row">
      <button class="m-btn" data-se="6-21">夏至</button><button class="m-btn" data-se="9-23">秋分</button>
      <button class="m-btn" data-se="12-21">冬至</button><button class="m-btn" data-se="3-20">春分</button>
      ${helpRow()}</div>`;
  box.querySelectorAll('[data-se]').forEach(b=>b.addEventListener('click',()=>{
    const [m,d]=b.getAttribute('data-se').split('-').map(Number);
    const y=new Date().getUTCFullYear();
    clock.jump((Date.UTC(y,m-1,d,12))/86400000+2440587.5);
    bus.emit('toast',{text:`已跳到${b.textContent}（${y}年）`,level:'info'});
  }));
  wireModuleBack(box);
}

// —— 信息抽屉 ——
function buildInfo(){
  const panel=q('m-info'), body=q('m-info-body');
  q('m-info-close').addEventListener('click',()=>panel.classList.remove('open'));
  bus.on('body.select', ({bodyId})=>{
    const f=FACTS[bodyId]; if(!f) return;
    body.innerHTML = `<h2>${f.emoji} ${f.zh} <small style="color:var(--muted);font-size:.7em">${f.en}</small></h2>
      <div class="sub">类型：${f.type}</div>
      <table>
        <tr><td>距太阳</td><td>${f.distanceAU>0 ? f.distanceAU.toFixed(3)+' AU' : '—'}</td></tr>
        <tr><td>公转周期</td><td>${typeof f.periodDays==='number'?Math.round(f.periodDays)+' 天':'—'}</td></tr>
        <tr><td>直径</td><td>${f.diameterKm.toLocaleString()} km</td></tr>
        <tr><td>平均温度</td><td>${f.tempC} ℃</td></tr>
        <tr><td>卫星数</td><td>${f.moons}</td></tr>
        <tr><td>轴倾角</td><td>${f.obliquityDeg}°</td></tr>
      </table>
      <p class="desc">${f.description}</p>
      ${f.faq?`<div style="margin-top:8px;padding:8px 10px;border-radius:10px;background:rgba(90,160,255,.08)">${f.faq.map(x=>`<p style="margin-bottom:6px;font-size:14px"><b style="color:var(--accent2)">❓ ${x.q}</b><br><span style="color:var(--muted)">${x.a}</span></p>`).join('')}</div>`:''}
      ${f.reviewStatus==='pending'?'<p class="review">⚠️ 科普文案待老师审校</p>':''}`;
    panel.classList.add('open');
  });
}

// —— 模态（关于/帮助）——
function openModal(title, html){
  const m=q('m-modal'); m.classList.add('open');
  m.innerHTML = `<div class="card"><h2>${title}</h2>${html}<button class="close" data-close>关闭</button></div>`;
  m.querySelector('[data-close]').addEventListener('click',()=>m.classList.remove('open'));
  m.addEventListener('click',e=>{ if(e.target===m) m.classList.remove('open'); });
}
function buildModals(ctx){
  const HELP = [['空格/点按 ⏸','暂停'],['点按今','回到今天'],['点按 1秒=..','调速'],['单指拖动','旋转视角'],['双指捏合','缩放'],['点行星','查看资料'],['H 键盘','隐藏界面']];
  q('m-help').addEventListener('click',()=>openModal('操作说明', `<table>${HELP.map(([k,d])=>`<tr><td>${k}</td><td>${d}</td></tr>`).join('')}</table>`));
  q('m-about').addEventListener('click',()=>openModal('关于 · 素材来源', `<p style="color:var(--muted);margin-bottom:10px">数据与素材：astronomy-engine(MIT) · NASA/JPL 行星概况表(PD) · Solar System Scope 贴图(CC BY 4.0，需署名)。</p><p style="color:var(--warn)">科普文案待物理老师审校。</p>`));
  q('m-fs').addEventListener('click',()=>{ if(document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); });
  q('m-prop')?.addEventListener('click',()=>{ const ov=ctx.orbitView || window.__SS?.orbitView; ov?.toggleProportion(); });
  q('m-label')?.addEventListener('click',()=>{ const ov=ctx.orbitView || window.__SS?.orbitView; if(!ov) return; ov.toggleLabels(); const e=q('m-label'); if(e){ e.textContent = ov.labelsVisible?'标签':'标签·关'; e.classList.toggle('off', !ov.labelsVisible); } });
  // 截图分享
  q('m-shot')?.addEventListener('click',()=>{
    let url=null; try{ url=ctx.renderer.domElement.toDataURL('image/png'); }catch(e){}
    openModal('📷 保存画面', url
      ? `<img src="${url}" style="width:100%;border-radius:10px;display:block"/><a class="m-btn" download="solar.png" href="${url}" style="margin-top:12px;text-decoration:none">下载图片</a>`
      : '<p style="color:var(--warn)">截图失败</p>');
  });
  // 教学书签
  q('m-bm')?.addEventListener('click',()=>{
    const l=listBookmarks();
    const items=l.map((b,i)=>`<div style="display:flex;gap:8px;margin-bottom:8px"><button class="m-btn" data-mbm="${i}" style="flex:1;justify-content:flex-start">🔖 ${b.name}</button><button class="m-btn" data-mdel="${i}">✕</button></div>`).join('')||'<p style="color:var(--muted)">还没有书签。</p>';
    openModal('🔖 教学书签', items+`<button class="m-btn" id="m-bm-save" style="margin-top:10px">＋ 保存当前位置</button>`);
    document.getElementById('m-bm-save')?.addEventListener('click',()=>{ saveCurrentBookmark(ctx); q('m-modal').classList.remove('open'); bus.emit('toast',{text:'已保存书签',level:'ok'}); });
    document.querySelectorAll('[data-mbm]').forEach(b=>b.addEventListener('click',()=>{ applyBookmark(ctx, listBookmarks()[+b.getAttribute('data-mbm')]); q('m-modal').classList.remove('open'); }));
    document.querySelectorAll('[data-mdel]').forEach(b=>b.addEventListener('click',()=>{ const ll=listBookmarks(); ll.splice(+b.getAttribute('data-mdel'),1); localStorage.setItem('ss-bookmarks', JSON.stringify(ll)); q('m-bm').click(); }));
  });
  maybeShowMobileGuide();
}
const GUIDE_KEY='ss-guide-done';
function maybeShowMobileGuide(){
  if(localStorage.getItem(GUIDE_KEY)) return;
  const steps=[['欢迎使用','这是手机版 3D 太阳系教学演示：单指旋转、双指捏合缩放、点行星看资料。'],['底部 Tab','切换 全景/月相/潮汐/日月食；月相模块竖屏上下分屏。'],['时间条','⏸ 暂停 · 今 回到今天 · 1秒=… 调速。']];
  let i=0;
  const show=()=>{
    const s=steps[i];
    openModal(`${s[0]} <small style="color:var(--muted)">（${i+1}/${steps.length}）</small>`, `<p style="line-height:1.7">${s[1]}</p>
      <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">
        <button class="m-btn" id="mg-skip">跳过</button>
        <button class="m-btn" id="mg-next" style="background:var(--accent);color:#1a1208">${i<steps.length-1?'下一步':'开始使用'}</button></div>`);
    document.getElementById('mg-skip')?.addEventListener('click',done);
    document.getElementById('mg-next')?.addEventListener('click',()=>{ if(i<steps.length-1){ i++; show(); } else done(); });
  };
  const done=()=>{ localStorage.setItem(GUIDE_KEY,'1'); q('m-modal').classList.remove('open'); };
  show();
}

// —— toast ——
function buildToast(){
  bus.on('toast', ({text,level='info'})=>{ const el=document.createElement('div'); el.className='toast '+(level==='warn'?'warn':level==='err'?'err':''); el.textContent=text; q('m-toast').appendChild(el); setTimeout(()=>el.remove(),3000); });
}

boot().catch(err=>{ console.error('mobile boot', err); document.body.innerHTML='<div style="padding:60px;text-align:center;color:#e8ecf5">启动出错：'+String(err&&err.message||err)+'</div>'; });
