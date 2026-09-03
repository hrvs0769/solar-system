// 关于 / 署名页：素材来源（CC BY 4.0 / NASA PD）与数据来源
import { openModal } from './help.js';

const CREDITS = [
  { what:'行星表面贴图（地球/月球/木星/土星/火星/水星/金星/天王星/海王星/太阳）', source:'Solar System Scope · textures', license:'CC BY 4.0（需署名）', note:'https://www.solarsystemscope.com/textures' },
  { what:'行星位置、月球位置、月相、日月食计算', source:'astronomy-engine（VSOP87 系）', license:'MIT', note:'github.com/cosinekitty/astronomy' },
  { what:'行星物理数据（直径/周期/温度等）', source:'NASA / JPL 行星概况表', license:'公有领域（Public Domain）', note:'nssdc.gsfc.nasa.gov/planetary/factsheet' },
  { what:'3D 渲染引擎', source:'Three.js', license:'MIT', note:'threejs.org' },
];

export function initAbout(){
  document.getElementById('btn-about')?.addEventListener('click', ()=>{
    openModal('about', `
      <h2>关于 · 素材与数据来源</h2>
      <p style="color:var(--muted);margin-bottom:12px">本软件为课堂 3D 太阳系教学演示，科学数据与天体外观均来自以下公开资源。</p>
      <table>${CREDITS.map(c=>`<tr><td><b>${c.what}</b><br><span style="color:var(--muted)">${c.note}</span></td><td style="width:120px">${c.license}</td></tr>`).join('')}</table>
      <p style="margin-top:12px;color:var(--muted)">Solar System Scope 贴图依据 <b>CC BY 4.0</b> 协议使用并署名；NASA 内容为公有领域。
      <p style="color:var(--warn);margin-top:6px">⚠️ 全部科普文案为 AI 起草，须经物理老师审校后方可进入课堂。</p>
      <button class="close-btn" data-close>我已知晓</button>`);
  });
}
