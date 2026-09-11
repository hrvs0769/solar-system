// 儿童模式：放大字号、隐藏专业控件、切换为儿童版文案（样式驱动，模块无需重建）
import { bus } from '../sim/bus.js';

const KEY = 'ss-kid-mode';
let on = false;
let ctxRef = null;

export function isKidMode(){ return on; }

export function initKidMode(ctx){
  ctxRef = ctx;
  try{ on = localStorage.getItem(KEY)==='1'; }catch(e){}
  apply();
  document.getElementById('btn-kid')?.addEventListener('click', ()=>setKidMode(!on));
}

export function setKidMode(v){
  const next = !!v;
  if(next === on) return;
  on = next;
  try{ localStorage.setItem(KEY, on?'1':'0'); }catch(e){}
  apply();
  if(on && ctxRef && ctxRef.currentId === 'satellite') ctxRef.switchModule('orbit-view');
  bus.emit('kidmode.changed', { on });
  bus.emit('toast', { text: on?'儿童模式已开启：字更大、按钮更少':'已退出儿童模式', level:'info' });
}

function apply(){
  document.body.classList.toggle('kid-mode', on);
  document.getElementById('btn-kid')?.classList.toggle('off', !on);
}
