// 缩放滑块：与滚轮/捏合并行；滑块/按钮始终可用，且滚轮缩放时反向同步滑块位置
import { zoomV } from '../sim/camera.js';
export function initZoomSlider(ctx){
  const slider = document.getElementById('zoom');
  const out = document.getElementById('zoom-out');
  const inn = document.getElementById('zoom-in');
  const val = document.getElementById('zoom-val');
  const MIN = 0.002, MAX = 55;
  let updating = false;   // 程序回写时不再触发 apply

  function apply(v){
    v = Math.max(0, Math.min(1, v));
    ctx.cameraRig.setZoom(v, MIN, MAX);
    if(val) val.textContent = distLabel(ctx.cameraRig.distToTarget());
  }
  slider.addEventListener('input', ()=>{ if(!updating) apply(parseInt(slider.value,10)/100); });
  out.addEventListener('click', ()=>{ slider.value = Math.max(0, parseInt(slider.value,10)-10); apply(parseInt(slider.value,10)/100); });
  inn.addEventListener('click', ()=>{ slider.value = Math.min(100, parseInt(slider.value,10)+10); apply(parseInt(slider.value,10)/100); });
  // 滚轮/双指缩放时，把距离反写回滑块（保持两者一致）
  ctx.cameraRig.controls.addEventListener('change', ()=>{
    if(updating) return;
    const d = ctx.cameraRig.distToTarget();
    const v = zoomV(d, MIN, MAX);
    updating = true;
    slider.value = Math.round(v*100);
    updating = false;
    if(val) val.textContent = distLabel(d);
  });
  apply(parseInt(slider.value,10)/100);
}
function distLabel(d){ if(d>=1) return d.toFixed(1)+' AU'; return (d*149600000/10000).toFixed(0)+' 万公里'; }
