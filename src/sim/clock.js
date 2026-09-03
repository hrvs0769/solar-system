// 模拟历书时钟：JD（UTC 基准），暂停/倍速/单步/跳转/回到今天
import { bus } from './bus.js';
import { dateToJd, jdToDate, MIN_JD, MAX_JD } from './timeutil.js';

// 倍速档（天/秒）：0 暂停, 10分钟, 1小时, 6小时, 12小时, 1天（课堂合理范围）
export const RATES = [0, 10/1440, 1/24, 0.25, 0.5, 1];
export const RATE_LABELS = ['暂停','1秒=10分钟','1秒=1小时','1秒=6小时','1秒=12小时','1秒=1天'];

export class Clock {
  constructor(){
    this.jd = dateToJd(new Date());
    this.rateIndex = 3;        // 默认 1 秒=1 天
    this.running = true;
    this._stepDays = 1;        // 单步默认 1 天
  }
  get rate(){ return RATES[this.rateIndex]; }
  tick(dt){
    if(!this.running) return;
    this.jd += this.rate * dt;
    this._clamp();
  }
  _clamp(){
    const c = Math.min(Math.max(this.jd, MIN_JD), MAX_JD);
    if(c !== this.jd){ this.jd = c; bus.emit('toast',{text:'日期已超出支持范围（1900–2100）',level:'warn'}); }
  }
  toggle(){ this.running = !this.running; bus.emit('clock.changed', this.state()); }
  setRate(i){ this.rateIndex = Math.min(Math.max(0, i|0), RATES.length-1); bus.emit('clock.changed', this.state()); }
  rateUp(){ this.setRate(this.rateIndex+1); }
  rateDown(){ this.setRate(this.rateIndex-1); }
  step(days){ this.jd += days; this._clamp(); bus.emit('clock.changed', this.state()); }
  stepBack(){ this.step(-this._stepDays); }
  stepFwd(){ this.step(this._stepDays); }
  jump(jd){ this.jd = jd; this._clamp(); bus.emit('clock.changed', this.state()); }
  jumpToDate(date){ this.jump(dateToJd(date)); }
  backToNow(){ this.jump(dateToJd(new Date())); }
  state(){ return { jd:this.jd, rateIndex:this.rateIndex, running:this.running }; }
}
