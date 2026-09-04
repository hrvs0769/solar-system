// 主控：启动、系统场景构建、模块切换、渲染循环、全局交互
import * as THREE from 'three';
import './ui/ui.css';
import { bus } from './sim/bus.js';
import { Clock } from './sim/clock.js';
import { CameraRig } from './sim/camera.js';
import { Quality, TIERS } from './sim/quality.js';
import * as astro from './sim/astro.js';
import { BODIES, KEYS, FOCUS_INDEX, bodyColor } from './config.js';
import { buildSystem } from './scene/build-system.js';
import { createLabelRenderer } from './scene/labels.js';
import { textureStore } from './scene/texture-store.js';
import { OrbitView } from './modules/orbit-view.js';
import { MoonPhases } from './modules/moon-phases.js';
import { Tides } from './modules/tides.js';
import { Eclipse } from './modules/eclipse.js';
import { Seasons } from './modules/seasons.js';
import { Satellite } from './modules/satellite.js';
import { LunarMission } from './modules/lunar-mission.js';
import { initTopbar } from './ui/topbar.js';
import { initTimeControls } from './ui/time-controls.js';
import { initZoomSlider } from './ui/zoom-slider.js';
import { initPlanetMenu } from './ui/planet-menu.js';
import { initInfoPanel } from './ui/info-panel.js';
import { initAbout } from './ui/about-credits.js';
import { initToast } from './ui/toast.js';
import { setHelpHandler, closeModal } from './ui/help.js';
import { openQRModal } from './ui/qr.js';
import { openBookmarksModal, saveCurrentBookmark, applyBookmark } from './ui/bookmarks.js';
import { openAlmanacModal } from './ui/almanac.js';
import { captureScreenshot } from './ui/screenshot.js';
import { maybeShowGuide } from './ui/guide.js';
import { getPhase, phaseName } from './sim/astro.js';
import { dateToJd } from './sim/timeutil.js';

function webgl2(){
  try{ const c=document.createElement('canvas'); return !!c.getContext('webgl2'); }catch(e){ return false; }
}

async function boot(){
  if(!webgl2()){
    document.body.innerHTML = '<div style="padding:60px;text-align:center;color:#e8ecf5;font-family:sans-serif">'+
      '<h2>无法启动 3D 场景</h2><p style="margin-top:12px;color:#9aa7bd">您的浏览器或显卡不支持 WebGL2。<br>请使用较新版本的 Chrome / Edge 浏览器打开。</p></div>';
    return;
  }

  const renderer = new THREE.WebGLRenderer({ antialias:true, logarithmicDepthBuffer:true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  document.getElementById('app').appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, 0.0001, 1200);
  const clock = new Clock();
  const quality = new Quality(renderer, (t)=>{ textureStore.setTier(t.id); });
  // 软件渲染（无独显）→ 直接低档（贴图降采样到约1K）
  try{
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)||'') : '';
    if(/swiftshader|llvmpipe|software|basic render/i.test(gpu)){ quality.setTier(2, true); }
  }catch(e){}
  const labelRenderer = createLabelRenderer();

  // —— 系统（全景）场景 ——
  const system = {};
  await buildSystem(system, labelRenderer, quality.tier);

  const cameraRig = new CameraRig(camera, renderer.domElement, {
    presets: {
      overview:{ pos:[3.2,2.6,3.2], target:[0,0,0] },
      ecliptic:{ pos:[0.001,8,0], target:[0,0,0] },
      earthMoon:{ pos:[-0.2,0.1,0.2], target:[1,0,0] },
      sunLine:{ pos:[3,0.6,0.001], target:[0,0,0] },
    },
    bodyPosFn: ()=>0,
  });
  cameraRig.setPreset('overview');   // 初始英雄机位（太阳+内行星+轨道线）

  // —— 上下文（供模块/UI 共用）——
  const ctx = { renderer, camera, cameraRig, clock, quality, bus, astro, system, labelRenderer, hiddenUI:false, switchModule:null };
  cameraRig.bodyPosFn = id => (orbitView && orbitView.getPos(id)) || {x:0,y:0,z:0};

  const orbitView = new OrbitView(ctx);
  ctx.orbitView = orbitView;
  const moonPhases = new MoonPhases(ctx);
  const tides = new Tides(ctx);
  const eclipse = new Eclipse(ctx);
  const seasons = new Seasons(ctx);
  const satellite = new Satellite(ctx);
  const modules = { 'orbit-view':orbitView, 'moon-phases':moonPhases, 'tides':tides, 'eclipse':eclipse, 'seasons':seasons, 'satellite':satellite };
  const lunarMission = new LunarMission(ctx);
  ctx.lunarMission = lunarMission;
  let current = modules['orbit-view'];
  let currentId = 'orbit-view';

  let preModuleRate = clock.rateIndex;   // 进入教学模块前记住倍速，离开时恢复
  // 全景专属 UI（行星菜单/视图工具/比例角标/今晚月相角标）只在全景显示，
  // 否则会遮挡教学模块的图示（遮挡太阳、覆盖日月食事件列表等）
  function setOverviewUI(on){
    ['planet-menu','view-tools','scale-badge','moon-badge'].forEach(id=>{
      const el = document.getElementById(id); if(el) el.style.display = on ? '' : 'none';
    });
  }
  function switchModule(id){
    if(id===currentId) return;
    if(lunarMission && lunarMission.active) lunarMission.cancel();   // 切模块自动取消奔月任务
    if(currentId !== 'orbit-view') clock.setRate(preModuleRate);   // 离开模块恢复原倍速
    if(id !== 'orbit-view') preModuleRate = clock.rateIndex;       // 进入模块前记住
    current.exit();
    const ov = document.getElementById('module-overlay'); if(ov) ov.innerHTML='';
    document.getElementById('info-panel')?.classList.remove('open');
    document.body.classList.remove('info-open');
    current = modules[id]; currentId = id;
    ctx.currentId = id;
    current.enter();
    setOverviewUI(id==='orbit-view');
    bus.emit('module.activated', { moduleId:id });   // 通知顶栏高亮
  }
  setOverviewUI(true);
  ctx.currentId = 'orbit-view';
  ctx.switchModule = switchModule;
  // 顶栏标签与模块内“返回全景”等按钮统一通过该事件触发切换
  bus.on('module.switch', ({ moduleId }) => switchModule(moduleId));

  // —— UI ——
  initToast(); initTimeControls(ctx); initZoomSlider(ctx); initPlanetMenu(ctx); initInfoPanel(ctx); initAbout(); initTopbar(ctx);
  const showHelp = setHelpHandler(ctx);
  document.getElementById('btn-qr')?.addEventListener('click', ()=>openQRModal());
  document.getElementById('btn-bm')?.addEventListener('click', ()=>openBookmarksModal(ctx));
  document.getElementById('btn-almanac')?.addEventListener('click', ()=>openAlmanacModal(ctx));
  document.getElementById('btn-shot')?.addEventListener('click', ()=>captureScreenshot(renderer, ()=>current.render()));
  document.getElementById('vt-prop')?.addEventListener('click', ()=>orbitView.toggleProportion());
  document.getElementById('vt-moon')?.addEventListener('click', ()=>orbitView.cycleMoonMode());
  document.getElementById('vt-kepler')?.addEventListener('click', ()=>orbitView.toggleKepler());
  document.getElementById('vt-label')?.addEventListener('click', ()=>orbitView.toggleLabels());
  document.getElementById('vt-mission')?.addEventListener('click', ()=> lunarMission.active ? lunarMission.cancel() : lunarMission.start());
  // 今晚真实月相角标（每分钟刷新）
  const updateMoonBadge=()=>{ const b=document.getElementById('moon-badge'); if(!b) return;
    const {fraction,angle}=getPhase(dateToJd(new Date())); b.textContent=`今晚月相：${phaseName(fraction,angle)} · 照亮${(fraction*100).toFixed(0)}%`; };
  updateMoonBadge(); setInterval(updateMoonBadge, 60000);

  // —— 键盘 ——
  window.addEventListener('keydown', (e)=>{
    const tag = e.target.tagName;
    if(tag==='INPUT'||tag==='SELECT'){ if(e.code==='Escape') e.target.blur(); return; }
    switch(e.code){
      case 'Space': e.preventDefault(); clock.toggle(); break;
      case 'Minus': clock.rateDown(); break;
      case 'Equal': clock.rateUp(); break;
      case 'BracketLeft': clock.stepBack(); break;
      case 'BracketRight': clock.stepFwd(); break;
      case 'KeyH':
        ctx.hiddenUI = !ctx.hiddenUI;
        document.body.classList.toggle('hidden-ui', ctx.hiddenUI);
        if(currentId==='orbit-view') orbitView._updateLabels();
        break;
      case 'KeyL': if(currentId==='orbit-view') orbitView.toggleLabels(); break;
      case 'KeyR': cameraRig.reset(); break;
      case 'F1': e.preventDefault(); showHelp(); break;
      case 'Escape':
        if(document.fullscreenElement) document.exitFullscreen();
        else if(document.querySelector('#module-overlay .modal')) closeModal();
        break;
      default:
        if(e.code.startsWith('Digit')){ const i=+e.code.slice(5); if(i<FOCUS_INDEX.length){ if(currentId!=='orbit-view') switchModule('orbit-view'); cameraRig.focus(FOCUS_INDEX[i]); bus.emit('body.select',{bodyId:FOCUS_INDEX[i]}); } }
        else if(e.code==='KeyM'){ if(currentId!=='orbit-view') switchModule('orbit-view'); cameraRig.focus('moon'); bus.emit('body.select',{bodyId:'moon'}); }
    }
  });

  window.addEventListener('resize', ()=>{
    camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
  });

  // —— 渲染循环（含异常兜底与空闲省电）——
  let last=performance.now(); let timeElapsed=0;
  let lastCamStr=''; let lastInteract=performance.now();
  ['pointerdown','touchstart','wheel','keydown'].forEach(ev=>window.addEventListener(ev, ()=>{ lastInteract=performance.now(); }, {passive:true}));
  let errorShown=false;
  const onLoopError=(err)=>{
    if(errorShown) return; errorShown=true;
    renderer.setAnimationLoop(null);
    console.error('render loop error', err);
    const el=document.createElement('div');
    el.id='err-banner';
    el.innerHTML=`<div style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#1a0f0f;border:1px solid #ff6b6b;border-radius:12px;padding:22px;max-width:86vw;z-index:99;color:#ffe9e9">
      <h3 style="color:#ff6b6b;margin-bottom:10px">画面出现了异常</h3>
      <p style="margin-bottom:10px;word-break:break-all;font-size:14px">${String(err&&err.message||err)}</p>
      <div style="display:flex;gap:8px">
        <button id="err-copy" style="padding:8px 14px;border-radius:8px;border:none;cursor:pointer">复制诊断信息</button>
        <button id="err-reload" style="padding:8px 14px;border-radius:8px;border:none;background:#ff6b6b;color:#fff;cursor:pointer">重新加载</button>
      </div></div>`;
    document.body.appendChild(el);
    document.getElementById('err-copy')?.addEventListener('click',()=>{ navigator.clipboard?.writeText(String(err&&(err.stack||err.message)||err)); });
    document.getElementById('err-reload')?.addEventListener('click',()=>location.reload());
  };
  const loopBody=(now)=>{
    const dt = Math.min((now-last)/1000, 0.1); last=now; timeElapsed+=dt;
    clock.tick(dt);
    astro.beginFrame(clock.jd);
    current.update(dt);
    cameraRig.update(dt);
    if(lunarMission && lunarMission.active) lunarMission.update(dt);   // 奔月任务（控制相机/对象）
    quality.sample(dt);
    // 空闲省电：暂停 + 全景 + 相机静止 + 最近无交互 → 跳过渲染
    const camStr = camera.matrixWorld.elements.join(',') + '|' + cameraRig.controls.target.toArray().join(',');
    const idle = !clock.running && currentId==='orbit-view' && !(lunarMission&&lunarMission.active) && camStr===lastCamStr && (now-lastInteract>600);
    lastCamStr = camStr;
    if(!idle) current.render();
    // 第一帧绘制后隐藏启动画面
    if(!bootHidden && renderer.info.render.calls>0){ bootHidden=true; hideBoot(); }
  };
  quality.startAutoSelect();
  const hideBoot=()=>{ const b=document.getElementById('boot-screen'); if(b) b.style.display='none'; };
  let bootHidden=false;
  renderer.setAnimationLoop((now)=>{ try{ loopBody(now); }catch(err){ onLoopError(err); } });

  bus.on('camera.reset', ()=>{ /* modules may react */ });
  bus.emit('toast', { text:'欢迎！点击星球可查看资料；空格暂停；H 隐藏界面', level:'info' });
  setTimeout(()=>maybeShowGuide(), 1200);   // 首次打开引导

  /* 调试暴露（供截图自检读取渲染/场景状态） */
  window.__SS = { renderer, get scene(){ return system.scene; }, get camera(){ return camera; }, get starfield(){ return system.starfield; }, cameraRig, clock, quality, bus, get orbitView(){ return orbitView; }, moonPhases, tides, eclipse, seasons, satellite, lunarMission, get currentId(){ return currentId; } };
}

boot().catch(err=>{
  console.error('boot error', err);
  const msg = String(err&&err.message||err);
  document.body.innerHTML = '<div style="padding:60px;text-align:center;color:#e8ecf5;font-family:sans-serif"><h2>启动出错</h2><p style="color:#9aa7bd;margin-top:12px">'+msg+'</p></div>';
});
