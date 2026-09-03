// 近期天象：今晚真实月相 + 下个朔/望 + 近期日食月食（均可一键跳转模拟时间）
import { bus } from '../sim/bus.js';
import { openModal } from './help.js';
import { dateToJd, fmtJdDate } from '../sim/timeutil.js';
import { getPhase, phaseName, searchPhase, searchEclipses } from '../sim/astro.js';

const KIND={ annular:'日环食', total:'全食', partial:'偏食', penumbral:'半影月食' };

export function openAlmanacModal(ctx){
  const nowJd = dateToJd(new Date());
  const {fraction,angle}=getPhase(nowJd);
  const nextNew=searchPhase(0, nowJd+0.5), nextFull=searchPhase(180, nowJd+0.5);
  const evs=searchEclipses(nowJd-30, nowJd+900).slice(0,3);
  openModal('almanac', `
    <h2>🌌 近期天象</h2>
    <p style="margin-bottom:10px">今晚（真实时间）：<b style="color:var(--accent)">${phaseName(fraction,angle)} · 照亮 ${(fraction*100).toFixed(0)}%</b></p>
    <table style="width:100%;font-size:14px">
      <tr><td style="padding:6px 0">下个新月（朔）</td><td>${fmtJdDate(nextNew)}</td><td><button class="tc-btn" data-jump="${nextNew}">跳转</button></td></tr>
      <tr><td style="padding:6px 0">下个满月（望）</td><td>${fmtJdDate(nextFull)}</td><td><button class="tc-btn" data-jump="${nextFull}">跳转</button></td></tr>
    </table>
    <p style="margin-top:12px;color:var(--muted)">近期日食月食（UTC）：</p>
    ${evs.map(ev=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0">
        <span>${ev.type==='solar'?'☀️':'🌕'} ${KIND[ev.kind]||ev.kind} · ${ev.date.toISOString().slice(0,10)}</span>
        <button class="tc-btn" data-jump="${ev.jd}">跳转</button></div>`).join('')||'<p style="color:var(--muted)">—</p>'}
    <button class="close-btn" data-close style="margin-top:12px">关闭</button>`);
  setTimeout(()=>{
    document.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>{
      ctx.clock.jump(+b.getAttribute('data-jump'));
      bus.emit('toast',{text:'已跳转到该天象时刻（可在月相/日月食模块查看）',level:'info'});
    }));
  },30);
}
