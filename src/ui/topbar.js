// 顶栏：模块切换 + 复位/画质/全屏
import { bus } from '../sim/bus.js';
import { TIERS } from '../sim/quality.js';

const MODULES = [
  { id:'orbit-view', label:'全景' },
  { id:'moon-phases', label:'月相实验室' },
  { id:'tides', label:'潮汐' },
  { id:'eclipse', label:'日月食' },
  { id:'seasons', label:'四季' },
  { id:'satellite', label:'卫星' },
];

export function initTopbar(ctx){
  const tabs = document.getElementById('tabs');
  tabs.innerHTML = MODULES.map(m=>`<button class="tab" data-mod="${m.id}">${m.label}</button>`).join('');
  tabs.querySelectorAll('.tab').forEach(b=>{
    b.addEventListener('click', ()=>bus.emit('module.switch',{ moduleId:b.getAttribute('data-mod') }));
  });

  document.getElementById('btn-reset')?.addEventListener('click', ()=>ctx.cameraRig.reset());
  document.getElementById('btn-fullscreen')?.addEventListener('click', ()=>{
    if(document.fullscreenElement){ document.exitFullscreen(); } else { document.documentElement.requestFullscreen?.(); }
  });
  document.getElementById('btn-quality')?.addEventListener('click', ()=>{
    const idx = (ctx.quality.tierIndex+1) % TIERS.length;
    ctx.quality.setTier(idx);
    bus.emit('toast',{text:`画质：${TIERS[idx].label}`,level:'info'});
  });

  setHelpHandler?.(ctx);
  const showTab = id => tabs.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.getAttribute('data-mod')===id));
  const off = bus.on('module.activated', ({moduleId})=>showTab(moduleId));
  showTab('orbit-view');
  return off;
}
function setHelpHandler(){} // 帮助按钮由 main.js 统一注册，避免重复

