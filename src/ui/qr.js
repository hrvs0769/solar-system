// 手机扫码直达：为手机版(mobile.html)生成二维码；支持填写局域网地址，实时更新
import QRCode from 'qrcode';
import { openModal } from './help.js';

function isLocal(){ return /localhost|127\.0\.0\.1|:8080|:4173|:5173|:8000/.test(location.host); }

export function openQRModal(){
  const local = isLocal();
  const origin = (location.origin && location.origin!=='null') ? location.origin : '';
  const initial = local ? '192.168.1.10:8000' : origin.replace(/^https?:\/\//,'').replace(/\/$/,'');

  openModal('qr', `
    <h2>📱 手机扫码访问</h2>
    <p style="color:var(--text);margin:0 0 8px 0;font-size:14px;line-height:1.6">
      让手机与电脑连到<b style="color:var(--accent)">同一 WiFi</b>，然后：<br>
      ① 在电脑运行 <b>npm run serve</b>（会列出本机局域网地址）<br>
      ② 手机打开 <b>http://局域网IP:8000/mobile.html</b>，或扫码。
    </p>
    <div style="color:var(--muted);font-size:13px;margin-top:8px">局域网地址（形如 192.168.x.x:8000）</div>
    <input id="qr-host" placeholder="192.168.x.x:8000" style="width:100%;margin-top:6px;padding:10px;border-radius:8px;background:#0c1224;color:#fff;border:1px solid rgba(255,255,255,.15);font-size:14px" value="${initial}" />
    <div style="display:flex;justify-content:center;margin-top:12px"><canvas id="qr-canvas" style="background:#fff;border-radius:8px;padding:6px"></canvas></div>
    <p id="qr-url" style="text-align:center;word-break:break-all;color:var(--accent);margin-top:8px"></p>
    ${local?'<p style="color:var(--warn);font-size:13px;margin-top:6px">当前页面是 localhost 打开，手机连不上「localhost」。请按上面步骤用局域网地址重新打开，或把这里的地址改成 npm run serve 显示的那个。</p>':''}
    <button class="close-btn" data-close>关闭</button>`);

  const hostEl = document.getElementById('qr-host'), urlEl = document.getElementById('qr-url');
  const draw = ()=>{
    if(!hostEl) return;
    let host = (hostEl.value||'').trim().replace(/^https?:\/\//,'').replace(/\/$/,'');
    const url = host ? `http://${host}/mobile.html` : '';
    if(urlEl) urlEl.textContent = url;
    const c = document.getElementById('qr-canvas');
    if(c && url) QRCode.toCanvas(c, url, { width: 200, margin: 2, color:{ dark:'#000000', light:'#ffffff' } }).catch(()=>{});
  };
  hostEl.addEventListener('input', draw);
  setTimeout(draw, 40);
}
