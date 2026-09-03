// 首次打开引导（一次性，localStorage 记住）
import { openModal } from './help.js';

const KEY='ss-guide-done';
const STEPS=[
  ['欢迎使用「璀璨太阳系」','这是面向课堂的 3D 太阳系教学演示。默认看到的是太阳与八大行星的实时运转。'],
  ['旋转与缩放','鼠标左键拖动=旋转视角；滚轮/底部滑块/双指捏合=缩放；右键拖动=平移。'],
  ['点一下任意星球','镜头会自动对准它，右侧弹出它的科普资料；按 0-8 或 M 快速跳转。'],
  ['教学模块与快捷键','顶栏可切换 月相实验室/潮汐/日月食。空格=暂停，H=隐藏界面（投屏更干净），F1=帮助。'],
];
export function maybeShowGuide(){
  if(localStorage.getItem(KEY)) return;
  let i=0;
  const show=()=>{
    const s=STEPS[i];
    openModal('guide', `
      <h2>${s[0]} <small style="color:var(--muted)">（${i+1}/${STEPS.length}）</small></h2>
      <p style="line-height:1.7">${s[1]}</p>
      <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">
        <button class="tc-btn" id="g-skip">跳过</button>
        <button class="tc-btn" id="g-next" style="background:var(--accent);color:#1a1208">${i<STEPS.length-1?'下一步':'开始使用'}</button>
      </div>`);
    document.getElementById('g-skip')?.addEventListener('click',done);
    document.getElementById('g-next')?.addEventListener('click',()=>{ if(i<STEPS.length-1){ i++; show(); } else done(); });
  };
  const done=()=>{ localStorage.setItem(KEY,'1'); document.getElementById('module-overlay').innerHTML=''; };
  show();
}
