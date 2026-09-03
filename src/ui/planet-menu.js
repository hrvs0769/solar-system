// 左下行星快捷菜单（0-8/M）
import { bus } from '../sim/bus.js';
import { BODIES, LUNA, FOCUS_INDEX, bodyColor } from '../config.js';

export function initPlanetMenu(ctx){
  const menu = document.getElementById('planet-menu');
  const defs = BODIES.map((b,i)=>({ id:b.id, zh:b.name_zh, en:b.name_en, color:b.color, key:i===0?'0':String(i) }))
    .concat([{ id:'moon', zh:'月球', en:'Moon', color:LUNA.color, key:'M' }]);
  defs.forEach(d=>{
    const it = document.createElement('div');
    it.className='pm-item'; it.setAttribute('data-id', d.id);
    it.innerHTML = `<span class="dot" style="background:${d.color}"></span><span>${d.zh}</span><span class="key">${d.key}</span>`;
    it.addEventListener('click', ()=>{ ctx.cameraRig.focus(d.id); bus.emit('body.select',{bodyId:d.id}); });
    menu.appendChild(it);
  });
  const off = bus.on('body.select', ({bodyId})=>{
    menu.querySelectorAll('.pm-item').forEach(el=>el.classList.toggle('active', el.getAttribute('data-id')===bodyId));
  });
  return off;
}
