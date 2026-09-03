// 帮助浮层（快捷键表）
import { bus } from '../sim/bus.js';

const KEYS = [
  ['空格','暂停 / 播放'], ['+ / −','升速 / 降速'], ['0-8','跳转太阳 / 水星…海王星'], ['M','跳转月球'],
  ['L','显示 / 隐藏标签'], ['H','演示净化模式（隐藏界面）'], ['F1','打开本帮助'], ['R','复位视角'],
  ['F11','全屏'], ['Esc','退出全屏 / 关闭面板'],
];

export function setHelpHandler(ctx){
  const showHelp = ()=>{
    openModal('help', `
      <h2>操作说明</h2>
      <table>${KEYS.map(([k,d])=>`<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join('')}</table>
      <p style="margin-top:12px;color:var(--muted)">鼠标左键旋转 · 滚轮缩放 · 右键平移 · 触屏双指捏合缩放。
      点击任意星球可查看资料并自动对准；点击画面空白处取消选择。</p>
      <button class="close-btn" data-close>关闭</button>`);
  };
  document.getElementById('btn-help')?.addEventListener('click', showHelp);
  return showHelp;
}

export function openModal(id, html){
  const host = document.getElementById('module-overlay');
  host.innerHTML = `<div class="modal" id="modal-${id}"><div class="card">${html}</div></div>`;
  host.querySelector(`#modal-${id}`).addEventListener('click', e=>{
    if(e.target.classList.contains('modal') || e.target.hasAttribute('data-close')) closeModal();
  });
}
export function closeModal(){ document.getElementById('module-overlay').innerHTML=''; }
