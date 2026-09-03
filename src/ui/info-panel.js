// 右侧行星信息面板（数据来自 data/planet-facts.js）
import { bus } from '../sim/bus.js';
import { FACTS } from '../data/planet-facts.js';

const fmtAU = au => au>0 ? `${au.toFixed(3)} AU（约 ${(au*149600000/10000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')} 万公里）` : '—';
const fmtTemp = t => t===0?'—':`${t} ℃`;
const fmtPer = p => typeof p==='number' ? `${Math.round(p)} 天` : p;

export function initInfoPanel(ctx){
  const panel = document.getElementById('info-panel');
  const body = document.getElementById('info-body');
  const close = document.getElementById('info-close');
  close.addEventListener('click', ()=>{ panel.classList.remove('open'); document.body.classList.remove('info-open'); });

  const off = bus.on('body.select', ({bodyId})=>{
    const f = FACTS[bodyId]; if(!f) return;
    document.body.classList.add('info-open');   // 隐藏右列角标/工具按钮，避免与面板叠盖
    const review = f.reviewStatus==='pending'
      ? `<p class="review">⚠️ 科普文案待老师审校，暂不建议直接用于课堂。</p>`
      : `<p class="review" style="color:var(--ok)">✅ 已审校（${f.reviewer||'老师'}）</p>`;
    body.innerHTML = `
      <h2>${f.emoji} ${f.zh} <small style="color:var(--muted);font-size:.7em">${f.en}</small></h2>
      <div class="sub">类型：${f.type}</div>
      <table>
        <tr><td>距太阳</td><td>${fmtAU(f.distanceAU)}</td></tr>
        <tr><td>公转周期</td><td>${fmtPer(f.periodDays)}</td></tr>
        <tr><td>自转周期</td><td>${typeof f.rotationDays==='number'?(f.rotationDays<0?'逆行 ':'')+Math.abs(f.rotationDays).toFixed(2)+' 天':'—'}</td></tr>
        <tr><td>直径</td><td>${f.diameterKm.toLocaleString()} km</td></tr>
        <tr><td>平均温度</td><td>${fmtTemp(f.tempC)}</td></tr>
        <tr><td>卫星数</td><td>${f.moons}</td></tr>
        <tr><td>轴倾角</td><td>${f.obliquityDeg}°</td></tr>
        <tr><td>轨道根数</td><td>a=${f.elements.a_au} AU · e=${f.elements.e} · i=${f.elements.i_deg}°</td></tr>
      </table>
      <p class="desc">${f.description}</p>
      ${f.faq?`<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(90,160,255,.08)">${f.faq.map(x=>`<p style="margin-bottom:6px;font-size:13px"><b style="color:var(--accent2)">❓ ${x.q}</b><br><span style="color:var(--muted)">${x.a}</span></p>`).join('')}</div>`:''}
      ${review}
      <div class="sub" style="margin-top:8px">数据：NASA/JPL 行星概况表</div>`;
    panel.classList.add('open');
  });
  return off;
}
