// 教学书签：保存/恢复「视角+模拟时间+模块」到 localStorage
import { bus } from '../sim/bus.js';
import { openModal, closeModal } from './help.js';
import { fmtJdLocal, dateToJd } from '../sim/timeutil.js';
import { getPhase, phaseName } from '../sim/astro.js';

const KEY = 'ss-bookmarks';
export function listBookmarks(){ try{ return JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(e){ return []; } }
function saveAll(l){ localStorage.setItem(KEY, JSON.stringify(l)); }

export function saveCurrentBookmark(ctx){
  const cam=ctx.camera, t=ctx.cameraRig.controls.target;
  const {fraction,angle}=getPhase(dateToJd(new Date()));
  const l=listBookmarks();
  l.unshift({
    id:Date.now(), jd:ctx.clock.jd, rateIndex:ctx.clock.rateIndex, moduleId:ctx.currentId||'orbit-view',
    cam:{x:cam.position.x,y:cam.position.y,z:cam.position.z}, tgt:{x:t.x,y:t.y,z:t.z},
    name:`${fmtJdLocal(ctx.clock.jd,-(new Date().getTimezoneOffset())/60)} · ${phaseName(fraction,angle)}`,
  });
  saveAll(l.slice(0,6));
}
export function applyBookmark(ctx, bm){
  if(bm.moduleId) ctx.switchModule(bm.moduleId);
  if(typeof bm.rateIndex==='number') ctx.clock.setRate(bm.rateIndex);
  ctx.clock.jump(bm.jd);
  if(bm.cam){ ctx.camera.position.set(bm.cam.x,bm.cam.y,bm.cam.z); ctx.cameraRig.controls.target.set(bm.tgt.x,bm.tgt.y,bm.tgt.z); }
  ctx.cameraRig.controls.update();
  bus.emit('toast',{text:'已恢复书签「'+bm.name+'」',level:'ok'});
}
export function openBookmarksModal(ctx){
  const l=listBookmarks();
  const items = l.map((b,i)=>`<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <button class="tc-btn" data-bm="${i}" style="flex:1;text-align:left;justify-content:flex-start">🔖 ${b.name}</button>
      <button class="tc-btn" data-del="${i}" title="删除">✕</button></div>`).join('')
    || '<p style="color:var(--muted)">还没有书签。点「保存当前位置」创建。</p>';
  openModal('bookmarks', `
    <h2>🔖 教学书签</h2>
    <p style="color:var(--muted);margin-bottom:10px">一键保存/恢复「当前视角 + 模拟时间 + 模块」，课堂"上次讲到这"随时回来。</p>
    ${items}
    <div style="margin-top:10px;display:flex;gap:8px">
      <button class="tc-btn" id="bm-save">＋ 保存当前位置</button>
      <button class="close-btn" data-close>关闭</button>
    </div>`);
  setTimeout(()=>{
    document.getElementById('bm-save')?.addEventListener('click',()=>{ saveCurrentBookmark(ctx); closeModal(); bus.emit('toast',{text:'已保存书签',level:'ok'}); });
    document.querySelectorAll('[data-bm]').forEach(b=>b.addEventListener('click',()=>{ applyBookmark(ctx, listBookmarks()[+b.getAttribute('data-bm')]); closeModal(); }));
    document.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{
      const ll=listBookmarks(); ll.splice(+b.getAttribute('data-del'),1); saveAll(ll); openBookmarksModal(ctx);
    }));
  }, 30);
}
