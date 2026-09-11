// 语音朗读：走浏览器内置 speechSynthesis，不需要任何外部音频文件
const KEY = 'ss-voice-on';
let enabled = true;
let voice = null;

export function ttsSupported(){ return typeof window !== 'undefined' && 'speechSynthesis' in window; }
export function isVoiceOn(){ return enabled; }

export function initVoice(){
  try{ const v = localStorage.getItem(KEY); if(v != null) enabled = v === '1'; }catch(e){}
  apply();
  document.getElementById('btn-voice')?.addEventListener('click', ()=>{
    enabled = !enabled;
    try{ localStorage.setItem(KEY, enabled?'1':'0'); }catch(e){}
    if(!enabled) stopSpeak();
    apply();
    if(enabled) speak('语音朗读已打开');
  });
  if(ttsSupported()){
    const load = ()=>{
      const vs = speechSynthesis.getVoices() || [];
      voice = vs.find(v=>/^zh[-_]CN/i.test(v.lang)) || vs.find(v=>/^zh/i.test(v.lang)) || null;
    };
    load();
    speechSynthesis.addEventListener?.('voiceschanged', load);
  }
  document.addEventListener('click', e=>{
    const b = e.target.closest?.('[data-speak]');
    if(!b) return;
    const src = document.querySelector(b.getAttribute('data-speak'));
    if(src) speak(src.textContent);
  });
}

export function speak(text){
  if(!enabled || !text || !ttsSupported()) return;
  try{
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).trim());
    u.lang = 'zh-CN'; u.rate = 0.92; u.pitch = 1.05;
    if(voice) u.voice = voice;
    speechSynthesis.speak(u);
  }catch(e){}
}

export function stopSpeak(){ if(ttsSupported()) try{ speechSynthesis.cancel(); }catch(e){} }

function apply(){
  document.getElementById('btn-voice')?.classList.toggle('off', !enabled);
}
