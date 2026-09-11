const KEY='ss-gl-reloads';
let shown=false;

function reloadCount(){ try{ return +(sessionStorage.getItem(KEY)||0); }catch(e){ return 0; } }
function bumpReload(){ try{ sessionStorage.setItem(KEY, String(reloadCount()+1)); }catch(e){} }

export function guardWebGL(renderer){
  const cv=renderer&&renderer.domElement; if(!cv||cv.__glGuard) return; cv.__glGuard=true;
  cv.addEventListener('webglcontextlost', (e)=>{
    e.preventDefault();
    if(shown) return; shown=true;
    const auto = reloadCount() < 2;
    if(auto) bumpReload();
    const el=document.createElement('div'); el.id='gl-lost';
    el.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(6,9,18,.97);display:flex;align-items:center;justify-content:center;font-family:"PingFang SC","Microsoft YaHei",sans-serif;color:#e8ecf5';
    el.innerHTML=`<div style="text-align:center;max-width:86vw">
      <div style="font-size:40px">🌌</div>
      <h2 style="color:#ffb454;margin:12px 0 8px;font-size:20px">画面中断了</h2>
      <p style="color:#9aa7bd;font-size:14px;line-height:1.7;margin-bottom:18px">${auto?'正在自动恢复…':'自动恢复没有成功，请点下面的按钮。'}<br>如果反复出现，重启浏览器即可。</p>
      <button id="gl-reload" style="padding:14px 34px;border-radius:10px;border:none;background:#ffb454;color:#1a1208;font-size:17px;font-weight:600;cursor:pointer">重新开始</button>
    </div>`;
    document.body.appendChild(el);
    document.getElementById('gl-reload')?.addEventListener('click',()=>location.reload());
    if(auto) setTimeout(()=>location.reload(), 1800);
  }, false);
}
