// 底部时间控制：播放/暂停、倍速、单步、日期跳转、回到今天
import { bus } from '../sim/bus.js';
import { RATES, RATE_LABELS } from '../sim/clock.js';
import { fmtJdLocal, jdToDate, dateToJd, MIN_JD, MAX_JD } from '../sim/timeutil.js';

export function initTimeControls(ctx){
  const c = ctx.clock;
  const join = (...ids)=> ids.map(id=>document.getElementById(id)).filter(Boolean);
  const playBtn = document.getElementById('btn-play');
  const sel = document.getElementById('rate-select');
  const dateInput = document.getElementById('date-input');
  const display = document.getElementById('clockDisplay');

  sel.innerHTML = RATE_LABELS.map((l,i)=>`<option value="${i}">${l}</option>`).join('');
  sel.value = c.rateIndex;

  join('btn-play').forEach(b=>b.addEventListener('click',()=>c.toggle()));
  document.getElementById('btn-rate-down')?.addEventListener('click',()=>c.rateDown());
  document.getElementById('btn-rate-up')?.addEventListener('click',()=>c.rateUp());
  document.getElementById('btn-stepback')?.addEventListener('click',()=>c.stepBack());
  document.getElementById('btn-stepfwd')?.addEventListener('click',()=>c.stepFwd());
  document.getElementById('btn-now')?.addEventListener('click',()=>c.backToNow());
  sel.addEventListener('change',()=>c.setRate(parseInt(sel.value,10)));
  dateInput.addEventListener('change',()=>{
    if(!dateInput.value) return;
    const d = new Date(dateInput.value+'T00:00:00');
    c.jump(dateToJd(d));
  });

  const off = bus.on('clock.changed', ()=>{
    const s = c.state();
    sel.value = s.rateIndex;
    playBtn.textContent = s.running ? '⏸' : '▶';
    const d = jdToDate(s.jd);
    display.textContent = fmtJdLocal(s.jd, -(new Date().getTimezoneOffset())/60);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if(dateInput.value !== iso) dateInput.value = iso;
  });
  bus.emit('clock.changed', {});
  return off;
}
