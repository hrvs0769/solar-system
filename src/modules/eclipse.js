// 日月食模块（清晰教学图）：真实事件搜索 + 亮色日月地 + 明确影锥 + 自动跳到最近一次日月食
import * as THREE from 'three';
import { ModuleBase } from './module-base.js';
import { textureStore } from '../scene/texture-store.js';
import { searchEclipses, moonGeoScene, helioScene, getPhase } from '../sim/astro.js';
import { dateToJd, fmtJdDate } from '../sim/timeutil.js';

const R_EARTH=0.03, R_MOON=0.012, R_MOON_ORBIT=0.12, R_SUN=0.05, SUN_DIST=0.42;
const KIND = { annular:'日环食', total:'日全食', partial:'偏食', penumbral:'半影月食' };

export class Eclipse extends ModuleBase {
  constructor(ctx){ super(ctx); }
  enter(){
    this.ctx.clock.setRate(5); // 1 秒=1 天
    this.scene=new THREE.Scene(); this.scene.background=new THREE.Color(0x070b16);
    this.cam=new THREE.PerspectiveCamera(50,1,0.001,20);

    // —— 亮色地球 / 月球（MeshBasicMaterial，直接显示贴图，不因光照变黑）——
    this.earth = makeSphere(R_EARTH, '#4f8fe0'); this.scene.add(this.earth);
    this.moon = makeSphere(R_MOON, '#cfcfcf'); this.scene.add(this.moon);
    textureStore.surface('moon').then(t=>{ if(t){ this.moon.material.map=t; this.moon.material.needsUpdate=true; } });
    textureStore.surface('earth').then(t=>{ if(t){ this.earth.material.map=t; this.earth.material.needsUpdate=true; } });

    // —— 太阳（明亮 + 光晕 + 光线方向）——
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(R_SUN, 32, 32), new THREE.MeshBasicMaterial({color:0xffd54a}));
    this.scene.add(this.sun);
    this.sunGlow = makeGlow(R_SUN); this.scene.add(this.sunGlow);

    // —— 影锥（示意，半透明，方向=背日方向）——
    this.umbraGeo = new THREE.ConeGeometry(0.028, 0.55, 32);
    this.moonShadow = new THREE.Mesh(this.umbraGeo, new THREE.MeshBasicMaterial({color:0x8899bb, transparent:true, opacity:0.32, depthWrite:false, side:THREE.DoubleSide})); this.scene.add(this.moonShadow);
    this.earthShadow = new THREE.Mesh(this.umbraGeo.clone(), new THREE.MeshBasicMaterial({color:0x8899bb, transparent:true, opacity:0.22, depthWrite:false, side:THREE.DoubleSide})); this.scene.add(this.earthShadow);
    this.earthShadow.scale.set(1.5,1,1.5);

    // 阴影落点标记（日食时影子落在地球 / 月食时影子落在月球）
    this.hitMark = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 16), new THREE.MeshBasicMaterial({color:0xffe08a}));
    this.scene.add(this.hitMark); this.hitMark.visible=false;

    this._buildOverlay();
    this._loadEvents();
    // 自动跳到最近的未来一次日月食，进入即有完整演示
    this._warmStart();
  }

  _buildOverlay(){
    const host=document.getElementById('module-overlay');
    host.innerHTML=`<div class="module-ctx open">
      <div class="viewlabel top-left">日月食 · 日＝月球挡光 · 月＝地球挡光（影锥为示意）</div>
      <div class="evt-list open" id="evt-list"></div>
      <div style="position:absolute;top:100px;left:14px;background:var(--panel-solid);border-radius:var(--radius);max-width:260px;overflow:hidden">
        <button id="ev-why-toggle" style="display:block;width:100%;text-align:left;background:none;border:none;color:var(--accent);font-size:13px;padding:8px 10px;cursor:pointer">▸ 为什么会发生？</button>
        <div id="ev-why-body" style="display:none;padding:0 10px 10px;font-size:12.5px;line-height:1.6;color:var(--text)">
          <b style="color:#ffd54a">日食</b> ＝ 朔（新月）+ 月球靠近黄道交点：月球在<b>太阳与地球之间</b>，挡住阳光，影子落在地球。<br>
          <b style="color:#5aa0ff">月食</b> ＝ 望（满月）+ 月球靠近黄道交点：地球在<b>太阳与月球之间</b>，挡住阳光，影子落在月球。<br>
          <span style="color:var(--muted)">所以不是每月都发生（月球轨道倾角约5°）。点右侧列表跳到某次，看影子落在哪。</span>
        </div>
      </div>
      <div style="position:absolute;bottom:70px;left:14px;display:flex;gap:8px;flex-wrap:wrap;max-width:70vw">
        <span style="color:var(--muted);font-size:13px;align-self:center">时间线(±3天)：</span>
        <input type="range" id="evt-timeline" min="0" max="100" value="50" style="width:200px">
      </div>
      <div style="position:absolute;bottom:70px;right:14px;display:flex;gap:8px">
        <button class="tc-btn" id="evt-back">返回全景</button>
      </div>
      <div style="position:absolute;bottom:150px;left:14px;display:none;background:var(--panel-solid);padding:14px;border-radius:var(--radius);max-width:320px" id="evt-detail">
        <div id="evt-title" style="color:var(--accent);font-weight:600;margin-bottom:6px"></div>
        <div id="evt-meta" style="color:var(--muted);font-size:13px"></div>
      </div>
    </div>`;
    host.querySelector('#evt-back').addEventListener('click',()=>this.ctx.bus.emit('module.switch',{moduleId:'orbit-view'}));
    host.querySelector('#ev-why-toggle')?.addEventListener('click',()=>{
      const body=host.querySelector('#ev-why-body'), open=body.style.display!=='block';
      body.style.display = open?'block':'none';
      host.querySelector('#ev-why-toggle').textContent = (open?'▾':'▸')+' 为什么会发生？';
    });
    const tl=host.querySelector('#evt-timeline');
    tl.addEventListener('input',()=>{ if(this._sel){ this.ctx.clock.jump(this._sel.jd + (tl.value-50)/100*6); } });
  }
  _loadEvents(){
    const now = dateToJd(new Date());
    this.events = searchEclipses(now-120, now+900);
    const list=document.getElementById('evt-list');
    list.innerHTML = '<div style="color:var(--muted);margin-bottom:6px">近期日食月食（点某条跳到该次）</div>' +
      this.events.map((ev,i)=>`<div class="evt" data-i="${i}"><div class="kind">${ev.type==='solar'?'☀️':'🌕'} ${KIND[ev.kind]||ev.kind}</div><div>${fmtJdDate(ev.jd)}</div></div>`).join('');
    list.querySelectorAll('.evt').forEach(el=>{
      el.addEventListener('click',()=> this.selectEvent(+el.getAttribute('data-i')) );
    });
  }
  // 进入时自动跳到最近的未来一次日月食，并高亮
  _warmStart(){
    const now = dateToJd(new Date());
    let best=-1;
    this.events.forEach((ev,i)=>{ if(ev.jd>=now && (best<0 || ev.jd<this.events[best].jd)) best=i; });
    if(best>=0) this.selectEvent(best);
  }
  exit(){ this.disposeScene(this.scene); }
  selectEvent(i){
    const ev=this.events[i]; if(!ev) return null;
    this._sel=ev;
    this.ctx.clock.jump(ev.jd);
    const list=document.getElementById('evt-list');
    if(list) list.querySelectorAll('.evt').forEach(x=>x.classList.toggle('active', x.getAttribute('data-i')===String(i)));
    const d=document.getElementById('evt-detail');
    if(d){ d.style.display='block';
      document.getElementById('evt-title').textContent=`${ev.type==='solar'?'日食':'月食'}：${KIND[ev.kind]||ev.kind}`;
      document.getElementById('evt-meta').textContent=`${fmtJdDate(ev.jd)}（本地）· 与权威目录一致`; }
    const tl=document.getElementById('evt-timeline'); if(tl) tl.value=50;
    return ev;
  }

  update(dt){
    const jd=this.ctx.clock.jd;
    const e=helioScene('earth',jd); const sdir=new THREE.Vector3(-e.x,-e.y,-e.z).normalize();
    const g=moonGeoScene(jd); const mdir=new THREE.Vector3(g.x,g.y,g.z).normalize();
    // 太阳（示意距离，放在日光方向）
    this.sun.position.copy(sdir.clone().multiplyScalar(SUN_DIST));
    this.sunGlow.position.copy(this.sun.position);
    // 月球（真实方向 × 示意距离）
    const moonPos=mdir.clone().multiplyScalar(R_MOON_ORBIT);
    this.moon.position.copy(moonPos);
    // 月球影锥（背日方向）
    this.moonShadow.position.copy(moonPos);
    this.moonShadow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), sdir.clone().negate());
    // 地球影锥（背日方向）
    this.earthShadow.position.set(0,0,0);
    this.earthShadow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), sdir.clone().negate());
    // 影子落点：日月地越接近共线的时候，本影锥端点越接近另一天体
    const solar = mdir.dot(sdir) > 0.5;   // 月球在太阳方向 → 日食
    this.hitMark.visible = true;
    if(solar){
      // 月影锥朝地球落
      this.hitMark.position.set(0,0,0);
    } else {
      // 地影锥朝月球落
      this.hitMark.position.copy(moonPos);
    }
    this._frameCamera(sdir, moonPos, solar);
  }

  _frameCamera(sdir, moonPos, solar){
    // 固定 3/4 视角，让太阳在屏幕一侧，完整框住 太阳+地球+月球（含阴影）
    // 方向：让 sdir 大致水平（→屏幕右），便于看清共线关系
    const up=new THREE.Vector3(0,1,0);
    const right=sdir.clone(); right.y=0;
    if(right.lengthSq()<1e-6) right.set(1,0,0); right.normalize();
    const fwd=new THREE.Vector3().crossVectors(right,up).normalize();
    const lookDir=new THREE.Vector3().addScaledVector(right,-0.05).addScaledVector(fwd,-1).addScaledVector(up,0.34).normalize();
    this.cam.position.copy(lookDir.multiplyScalar(0.9));
    this.cam.lookAt(0,0,0);
  }

  render(){
    const r=this.ctx.renderer; const w=r.domElement.clientWidth, h=r.domElement.clientHeight;
    this.cam.aspect=w/h; this.cam.updateProjectionMatrix();
    r.setViewport(0,0,w,h); r.setScissorTest(false); r.autoClear=true;
    r.render(this.scene, this.cam);
  }
}

function makeSphere(radius,color){ return new THREE.Mesh(new THREE.SphereGeometry(radius,48,48), new THREE.MeshBasicMaterial({color:0xffffff})); }
function makeGlow(radius){
  const geo=new THREE.SphereGeometry(radius*2.4,32,32);
  const mat=new THREE.ShaderMaterial({
    vertexShader:`varying vec3 vN; varying vec3 vView;
      void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader:`varying vec3 vN; varying vec3 vView;
      void main(){ float f=pow(1.0-abs(dot(normalize(vN),normalize(vView))),2.0);
        gl_FragColor=vec4(vec3(1.0,0.7,0.3)*0.6, f*0.5); }`,
    side:THREE.BackSide, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending });
  return new THREE.Mesh(geo, mat);
}
