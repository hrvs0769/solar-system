// 画质档：pixelRatio / 星场数量 / 细节开关；启动自动选档 + 运行时降档
import { bus } from './bus.js';

export const TIERS = [
  { id:'high', label:'高', pixelRatio:2, stars:15000, clouds:true, atmosphere:true, shadows:false, starsVisible:true },
  { id:'mid',  label:'中', pixelRatio:1.5, stars:10000, clouds:true, atmosphere:true, shadows:false, starsVisible:true },
  { id:'low',  label:'低', pixelRatio:1,   stars:5000,  clouds:false, atmosphere:true, shadows:false, starsVisible:true },
];

export class Quality {
  constructor(renderer, onApply){
    this.renderer = renderer;
    this.onApply = onApply || (()=>{});
    this.tierIndex = 0;
    this._samples = []; this._watchWindow = [];
    this._watchAcc = 0; this._watchCount = 0; this._watchSince = 0;
  }
  get tier(){ return TIERS[this.tierIndex]; }
  setTier(i, silent){
    this.tierIndex = Math.min(Math.max(0, i|0), TIERS.length-1);
    const t = this.tier;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, t.pixelRatio));
    this.onApply(t);
    if(!silent) bus.emit('quality.changed', { tier:t });
  }
  // 启动自动选档：采样 3 秒帧率
  startAutoSelect(fps){
    this._selectSamples = []; this._selectIdx = 0; this._selectTarget = 3*60;
    this._selectFps = fps;
  }
  // 每帧调用；启动期采样选档，其后 watchdog 降档
  sample(dt){
    const fps = dt>0 ? 1/dt : 60;
    // 启动 3 秒自动选档
    if(this._selectSamples && this._selectSamples.length < this._selectTarget){
      this._selectSamples.push(fps);
      if(this._selectSamples.length === this._selectTarget){
        const avg = this._selectSamples.reduce((a,b)=>a+b,0)/this._selectSamples.length;
        if(avg < 30) this.setTier(2, true);
        else if(avg < 45) this.setTier(1, true);
        this._selectSamples = null;
        bus.emit('toast', { text:`已自动选择「${this.tier.label}」画质`, level:'info' });
      }
      return;
    }
    // 运行时 watchdog：<30fps 持续 2 窗降档
    this._watchAcc += fps; this._watchCount++;
    if(this._watchCount >= 60){ // 约每秒
      const avgFps = this._watchAcc/this._watchCount;
      this._watchAcc = 0; this._watchCount = 0;
      if(avgFps < 30){ this._watchWindow.push(1); } else { this._watchWindow.shift(); this._watchWindow.push(0); }
      if(this._watchWindow.filter(Boolean).length >= 2 && this.tierIndex>0){
        this.setTier(this.tierIndex-1);
        this._watchWindow = [];
        bus.emit('toast', { text:`检测到降帧，已自动降为「${this.tier.label}」画质`, level:'info' });
      }
    }
  }
}
