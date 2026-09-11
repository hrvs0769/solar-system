// 背景音乐：Web Audio 程序化生成（五声音阶 + 长音垫），不引入任何音频文件
const SCALE = [0,2,4,7,9,12,14,16,19];
const BASE = 196;
const PAD = [98, 147, 196, 294];

let ac = null, master = null, timer = null, playing = false, padBuilt = false;

export function isOn(){ return playing; }

export function initMusic(){
  document.getElementById('btn-music')?.addEventListener('click', ()=>{
    if(playing) stop(); else start();
    apply();
  });
  apply();
}

function apply(){
  document.getElementById('btn-music')?.classList.toggle('off', !playing);
}

function freq(semi){ return BASE * Math.pow(2, semi/12); }

function start(){
  const AC = window.AudioContext || window.webkitAudioContext;
  if(!AC) return;
  if(!ac){
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
  }
  if(ac.state === 'suspended') ac.resume();
  if(!padBuilt){ buildPad(); padBuilt = true; }
  const now = ac.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(0.5, now + 2.5);
  playing = true;
  schedule();
}

function stop(){
  playing = false;
  if(timer){ clearTimeout(timer); timer = null; }
  if(ac && master){
    const now = ac.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 1.2);
  }
}

function buildPad(){
  const g = ac.createGain(); g.gain.value = 0.10;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 0.6;
  f.connect(g); g.connect(master);
  PAD.forEach(fr=>{
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
    const lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.05 + Math.random()*0.08;
    const lg = ac.createGain(); lg.gain.value = fr*0.004;
    lfo.connect(lg); lg.connect(o.frequency);
    o.connect(f); o.start(); lfo.start();
  });
}

function schedule(){
  if(!playing) return;
  const semi = SCALE[Math.floor(Math.random()*SCALE.length)];
  note(freq(semi) * (Math.random() < 0.35 ? 2 : 1), ac.currentTime + 0.05, 3.2, 0.16);
  timer = setTimeout(schedule, 1800 + Math.random()*2600);
}

function note(f, t, dur, peak){
  const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
  const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = f*2;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const g2 = ac.createGain(); g2.gain.value = 0.25;
  o.connect(g); o2.connect(g2); g2.connect(g); g.connect(master);
  o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}
