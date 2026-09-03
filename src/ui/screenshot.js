// 截图分享：把当前画面保存为图片（讲义配图/分享）
import { openModal } from './help.js';

export function captureScreenshot(renderer, renderFn){
  try{ renderFn && renderFn(); }catch(e){}
  let url=null;
  try{ url = renderer.domElement.toDataURL('image/png'); }catch(e){}
  openModal('shot', `
    <h2>📷 保存当前画面</h2>
    ${url
      ? `<img src="${url}" style="width:100%;border-radius:8px;display:block" />
         <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
           <a class="close-btn" download="solar-system.png" href="${url}" style="text-decoration:none;display:inline-block">下载图片</a>
           <button class="close-btn" data-close>关闭</button>
         </div>`
      : '<p style="color:var(--warn)">截图失败（当前浏览器不支持画布导出）。</p><button class="close-btn" data-close>关闭</button>'}
  `);
}
