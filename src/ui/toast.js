// 顶部 toast 提示
import { bus } from '../sim/bus.js';
export function initToast(){
  const wrap = document.getElementById('toast');
  return bus.on('toast', ({ text, level='info' })=>{
    const el = document.createElement('div');
    el.className = 'toast '+(level==='warn'?'warn':level==='err'?'err':level==='ok'?'ok':'');
    el.textContent = text;
    wrap.appendChild(el);
    setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .4s'; }, 2600);
    setTimeout(()=>{ el.remove(); }, 3100);
  });
}
