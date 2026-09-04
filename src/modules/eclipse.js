// 日月食 · 双视图：左=清晰成因示意（月球轨道倾角→只有近交点才食），右=真实感模拟（亮色日月地+影锥+自动跳到真实日月食）
import * as THREE from 'three';
import { ModuleBase } from './module-base.js';
import { textureStore } from '../scene/texture-store.js';
import { searchEclipses, moonGeoScene, helioScene, getPhase } from '../sim/astro.js';
import { dateToJd, fmtJdDate } from '../sim/timeutil.js';

const R_EARTH=0.03, R_MOON=0.012, R_MOON_ORBIT=0.12, R_SUN=0.05, SUN_DIST=0.42;
const KIND = { annular:'日环食', total:'日全食', partial:'偏食', penumbral:'半影月食' };
const MOON_INCL = 5.14 * Math.PI/180;   // 月球轨道相对黄道倾角约5.14°

export class Eclipse extends ModuleBase {
  constructor(ctx){ super(ctx); }
  enter(){
    this.ctx.clock.setRate(5);
    this.scene=new THREE.Scene(); this.scene.background=new THREE.Color(0x070b16);
    this.cam=new THREE.PerspectiveCamera(50,1,0.001,20);
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH,48,48), new THREE.MeshBasicMaterial({color:0x4f8fe0})); this.scene.add(this.earth);
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(R_MOON,48,48), new THREE.MeshBasicMaterial({color:0xcfcfcf})); this.scene.add(this.moon);
    textureStore.surface('moon').then(t=>{ if(t){ this.moon.material.map=t; this.moon.material.needsUpdate=true; } });
    textureStore.surface('earth').then(t=>{ if(t){ this.earth.material.map=t; this.earth.material.needsUpdate=true; } });
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(R_SUN,32,32), new THREE.MeshBasicMaterial({color:0xffd54a})); this.scene.add(this.sun);
    this.sunGlow = makeGlow(R_SUN); this.scene.add(this.sunGlow);
    this.umbraGeo = new THREE.ConeGeometry(0.028,0.55,32);
    this.moonShadow = new THREE.Mesh(this.umbraGeo, new THREE.MeshBasicMaterial({color:0x8899bb,transparent:true,opacity:0.32,depthWrite:false,side:THREE.DoubleSide})); this.scene.add(this.moonShadow);
    this.earthShadow = new THREE.Mesh(this.umbraGeo.clone(), new THREE.MeshBasicMaterial({color:0x8899bb,transparent:true,opacity:0.22,depthWrite:false,side:THREE.DoubleSide})); this.scene.add(this.earthShadow);
    this.earthShadow.scale.set(1.5,1,1.5);
    this.hitMark = new THREE.Mesh(new THREE.SphereGeometry(0.012,16,16), new THREE.MeshBasicMaterial({color:0xffe08a})); this.scene.add(this.hitMark); this.hitMark.visible=false;

    this._buildOverlay();
    this._buildSchematic();
    this._loadEvents();
    this._warmStart();
  }

  _buildSchematic(){
    const host=document.getElementById('module-overlay');
    const cv=document.createElement('canvas'); cv.id='ev-schematic'; cv.style.pointerEvents='none';
    this.sc=cv; host.insertBefore(cv, host.firstChild); this.sctx=cv.getContext('2d');
  }

  _buildOverlay(){
    const host=document.getElementById('module-overlay');
    host.innerHTML=`<div class="module-ctx open">
      <div class="evt-list open" id="evt-list" style="max-height:38vh;width:230px;top:60px;right:12px"></div>
      <div style="position:absolute;bottom:64px;left:14px;display:flex;gap:8px;flex-wrap:wrap">
        <span style="color:var(--muted);font-size:13px;align-self:center">时间线(±3天)：</span>
        <input type="range" id="evt-timeline" min="0" max="100" value="50" style="width:180px">
        <button class="tc-btn" id="evt-back">返回全景</button>
      </div>
      <div style="position:absolute;bottom:120px;left:14px;display:none;background:var(--panel-solid);padding:12px 14px;border-radius:var(--radius);max-width:320px;z-index:3" id="evt-detail">
        <div id="evt-title" style="color:var(--accent);font-weight:600;margin-bottom:6px"></div>
        <div id="evt-meta" style="color:var(--muted);font-size:13px"></div>
        <div style="margin-top:8px;font-size:13px;line-height:1.6" id="evt-explain"></div>
      </div>
    </div>`;
    host.querySelector('#evt-back').addEventListener('click',()=>this.ctx.bus.emit('module.switch',{moduleId:'orbit-view'}));
    const tl=host.querySelector('#evt-timeline');
    tl.addEventListener('input',()=>{ if(this._sel){ this.ctx.clock.jump(this._sel.jd + (tl.value-50)/100*6); } });
  }
  _loadEvents(){
    const now=dateToJd(new Date());
    this.events=searchEclipses(now-120, now+900);
    const list=document.getElementById('evt-list');
    list.innerHTML='<div style="color:var(--muted);margin-bottom:6px">近期日食月食（点某条跳到该次）</div>'+this.events.map((ev,i)=>`<div class="evt" data-i="${i}"><div class="kind">${ev.type==='solar'?'☀️':'🌕'} ${KIND[ev.kind]||ev.kind}</div><div>${fmtJdDate(ev.jd)}</div></div>`).join('');
    list.querySelectorAll('.evt').forEach(el=>el.addEventListener('click',()=>this.selectEvent(+el.getAttribute('data-i'))));
  }
  _warmStart(){ const now=dateToJd(new Date()); let best=-1; this.events.forEach((ev,i)=>{ if(ev.jd>=now && (best<0||ev.jd<this.events[best].jd)) best=i; }); if(best>=0) this.selectEvent(best); }
  exit(){ this.disposeScene(this.scene); if(this.sc&&this.sc.parentNode) this.sc.parentNode.removeChild(this.sc); }
  selectEvent(i){
    const ev=this.events[i]; if(!ev) return null;
    this._sel=ev; this.ctx.clock.jump(ev.jd);
    const list=document.getElementById('evt-list');
    if(list) list.querySelectorAll('.evt').forEach(x=>x.classList.toggle('active',x.getAttribute('data-i')===String(i)));
    const d=document.getElementById('evt-detail');
    if(d){ d.style.display='block';
      document.getElementById('evt-title').textContent=`${ev.type==='solar'?'日食':'月食'}：${KIND[ev.kind]||ev.kind}`;
      document.getElementById('evt-meta').textContent=`${fmtJdDate(ev.jd)}（本地）· 与权威目录一致`;
      document.getElementById('evt-explain').innerHTML = ev.type==='solar'
        ? '月球在地球与太阳之间，挡住阳光，影子落在地球上（朔 + 靠近黄道交点）。'
        : '地球在太阳与月球之间，挡住阳光，影子落在月球上（望 + 靠近黄道交点）。'; }
    const tl=document.getElementById('evt-timeline'); if(tl) tl.value=50;
    return ev;
  }

  update(dt){
    const jd=this.ctx.clock.jd;
    const e=helioScene('earth',jd); const sdir=new THREE.Vector3(-e.x,-e.y,-e.z).normalize(); this._sdir=sdir;
    const g=moonGeoScene(jd); const mdir=new THREE.Vector3(g.x,g.y,g.z).normalize();
    this.sun.position.copy(sdir.clone().multiplyScalar(SUN_DIST)); this.sunGlow.position.copy(this.sun.position);
    const moonPos=mdir.clone().multiplyScalar(R_MOON_ORBIT); this.moon.position.copy(moonPos);
    this.moonShadow.position.copy(moonPos); this.moonShadow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), sdir.clone().negate());
    this.earthShadow.position.set(0,0,0); this.earthShadow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), sdir.clone().negate());
    const solar = mdir.dot(sdir) > 0.5;
    this.hitMark.visible=true; this.hitMark.position.copy(solar? new THREE.Vector3(0,0,0) : moonPos);
    this._drawSchematic(sdir, mdir, solar);
  }

  _drawSchematic(sdir, mdir, solar){
    if(!this.sctx) return;
    if(typeof document!=='undefined' && document.body && document.body.classList.contains('mobile')) return; // 手机端不画桌面示意图
    const cv=this.sc, w=cv.width, h=cv.height, g=this.sctx;
    g.clearRect(0,0,w,h); const bg=g.createLinearGradient(0,0,0,h); bg.addColorStop(0,'#0d1526'); bg.addColorStop(1,'#05080f'); g.fillStyle=bg; g.fillRect(0,0,w,h); g.fillStyle='#10182c'; g.fillRect(20,20,w-40,h-40);
    const cx=w*0.45, cy=h*0.6, R=Math.min(w,h)*0.10;
    g.fillStyle='#c8d2e2'; g.font='14px sans-serif'; g.textAlign='left'; g.fillText('成因示意 · 为什么不是每月都发生日月食', 30, 42);
    g.save(); g.translate(cx,cy);
    const sunX=R*3.3, mOrbitR=R*1.8;
    // 黄道面
    g.setLineDash([6,5]); g.strokeStyle='rgba(255,213,74,.5)'; g.lineWidth=1.5;
    g.beginPath(); g.moveTo(-R*2.9,0); g.lineTo(sunX-R*0.6,0); g.stroke(); g.setLineDash([]);
    g.fillStyle='rgba(255,213,74,.7)'; g.font='12px sans-serif'; g.textAlign='center'; g.fillText('黄道面', -R*2.4, 16);
    // 太阳（带光晕）
    const sg=g.createRadialGradient(sunX,0,R*0.1, sunX,0,R*1.6); sg.addColorStop(0,'rgba(255,213,74,.9)'); sg.addColorStop(1,'rgba(255,213,74,0)');
    g.fillStyle=sg; g.beginPath(); g.arc(sunX,0,R*1.6,0,Math.PI*2); g.fill();
    g.beginPath(); g.arc(sunX,0,R*0.7,0,Math.PI*2); g.fillStyle='#ffd54a'; g.fill();
    g.fillStyle='#e8ecf5'; g.font='12px sans-serif'; g.fillText('太阳', sunX, R*0.95);
    // 月球轨道（倾斜≈5°）
    g.beginPath(); g.ellipse(0,0, mOrbitR, mOrbitR*Math.sin(MOON_INCL)+R*0.7, 0, 0, Math.PI*2);
    g.strokeStyle='rgba(150,170,200,.55)'; g.lineWidth=1.5; g.stroke();
    g.fillStyle='rgba(150,170,200,.6)'; g.font='12px sans-serif'; g.fillText('月球轨道（倾角≈5°）', mOrbitR*0.35, -mOrbitR*Math.sin(MOON_INCL)-R*0.8);
    // 两节点
    g.fillStyle='#ff7b7b'; g.beginPath(); g.arc(mOrbitR,0,4,0,Math.PI*2); g.fill();
    g.beginPath(); g.arc(-mOrbitR,0,4,0,Math.PI*2); g.fill();
    g.fillStyle='#ff7b7b'; g.font='12px sans-serif'; g.fillText('交点(节点)', mOrbitR+6, -8);
    // 地球
    g.beginPath(); g.arc(0,0,R,0,Math.PI*2); g.fillStyle='#3a7bc0'; g.fill(); g.lineWidth=2; g.strokeStyle='#7fb2ff'; g.stroke();
    g.fillStyle='#e8ecf5'; g.font='12px sans-serif'; g.fillText('地球', 0, R+18);
    // 月球
    const moonAng=Math.atan2(mdir.z, mdir.x);
    const mx0=Math.cos(moonAng)*mOrbitR, mz0=Math.sin(moonAng)*mOrbitR;
    const moonScreenY=mz0*0.9 + mdir.y*R*5;
    g.beginPath(); g.arc(mx0, moonScreenY, R*0.3, 0, Math.PI*2); g.fillStyle='#cfcfcf'; g.fill(); g.lineWidth=1.5; g.strokeStyle='#efefef'; g.stroke();
    g.fillStyle='#e8ecf5'; g.font='12px sans-serif'; g.fillText('月球', mx0, moonScreenY-R*0.45);
    // 说明
    g.fillStyle='#9aa7bd'; g.font='13px sans-serif'; g.textAlign='left';
    g.fillText('……只有当月球飞到黄道面附近（两个节点处）且正逢朔（新月）', -R*2.9, -R*2.2);
    g.fillText('或望（满月）时，日月地才近似成线，才有日/月食。', -R*2.9, -R*1.75);
    g.fillStyle=solar?'#ffd54a':'#5aa0ff'; g.font='14px sans-serif';
    g.fillText(solar?'此刻：月球在地球与太阳之间 → 日食':'此刻：地球在太阳与月球之间 → 月食', -R*2.9, -R*1.2);
    g.restore();
  }

  render(){
    const r=this.ctx.renderer, w=r.domElement.clientWidth, h=r.domElement.clientHeight;
    const portrait = h > w*1.05;
    const isMobile = typeof document!=='undefined' && document.body && document.body.classList.contains('mobile');
    if(isMobile){
      this.cam.aspect=w/h; this.cam.updateProjectionMatrix();
      const sdir=this._sdir||new THREE.Vector3(1,0,0);
      const up=new THREE.Vector3(0,1,0), right=sdir.clone(); right.y=0; if(right.lengthSq()<1e-6) right.set(1,0,0); right.normalize();
      const fwd=new THREE.Vector3().crossVectors(right,up).normalize();
      const lookDir=new THREE.Vector3().addScaledVector(right,-0.05).addScaledVector(fwd,-1).addScaledVector(up,0.34).normalize();
      const vHalf=(this.cam.fov*Math.PI)/360, hHalf=Math.atan(Math.tan(vHalf)*Math.max(w/h,0.2));
      const dist=Math.max(0.9, (SUN_DIST+R_MOON_ORBIT)*1.15/Math.tan(hHalf), (SUN_DIST+R_MOON_ORBIT)*1.15/Math.tan(vHalf));
      this.cam.position.copy(lookDir.multiplyScalar(dist)); this.cam.lookAt(0,0,0);
      r.setViewport(0,0,w,h); r.setScissorTest(false); r.autoClear=true; r.render(this.scene,this.cam);
      return;
    }
    if(this.sc && this.sctx){ const newW=portrait?w:Math.floor(w*0.5), newH=portrait?Math.floor(h*0.5):h;
      this.sc.style.position='absolute'; this.sc.style.left='0'; this.sc.style.top='0'; this.sc.style.width=newW+'px'; this.sc.style.height=newH+'px';
      if(this.sc.width!==newW||this.sc.height!==newH){ this.sc.width=newW; this.sc.height=newH; } }
    r.setScissorTest(true);
    const vpAspect = portrait?w/(h*0.5):(w*0.5)/h;
    this.cam.aspect=vpAspect; this.cam.updateProjectionMatrix();
    const vHalf=(this.cam.fov*Math.PI)/360, hHalf=Math.atan(Math.tan(vHalf)*Math.max(vpAspect,0.2));
    const dist=Math.max(0.9, (SUN_DIST+R_MOON_ORBIT)*1.15/Math.tan(hHalf), (SUN_DIST+R_MOON_ORBIT)*1.15/Math.tan(vHalf));
    const sdir=this._sdir||new THREE.Vector3(1,0,0);
    const up=new THREE.Vector3(0,1,0), right=sdir.clone(); right.y=0; if(right.lengthSq()<1e-6) right.set(1,0,0); right.normalize();
    const fwd=new THREE.Vector3().crossVectors(right,up).normalize();
    const lookDir=new THREE.Vector3().addScaledVector(right,-0.05).addScaledVector(fwd,-1).addScaledVector(up,0.34).normalize();
    this.cam.position.copy(lookDir.multiplyScalar(dist)); this.cam.lookAt(0,0,0);
    if(portrait){ r.setViewport(0,0,w,h*0.5); r.setScissor(0,0,w,h*0.5); r.render(this.scene,this.cam); }
    else { r.setViewport(w*0.5,0,w*0.5,h); r.setScissor(w*0.5,0,w*0.5,h); r.render(this.scene,this.cam); }
    r.setScissorTest(false);
  }
}

function makeGlow(radius){
  const geo=new THREE.SphereGeometry(radius*2.4,32,32);
  const mat=new THREE.ShaderMaterial({
    vertexShader:`varying vec3 vN; varying vec3 vView; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader:`varying vec3 vN; varying vec3 vView; void main(){ float f=pow(1.0-abs(dot(normalize(vN),normalize(vView))),2.0); gl_FragColor=vec4(vec3(1.0,0.7,0.3)*0.6, f*0.5); }`,
    side:THREE.BackSide, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending });
  return new THREE.Mesh(geo,mat);
}
