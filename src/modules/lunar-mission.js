// 嫦娥奔月 · 独立电影模块：文昌微缩城地面发射 → 平地→球面 → 地球轨道 → 地月转移 → 绕月 → 月面观察着陆
// 自成一体的 missionScene + 电影比例，主线渲染切换，复用相机/贴图/HUD/弹窗。
import * as THREE from 'three';
import { bus } from '../sim/bus.js';
import { textureStore } from '../scene/texture-store.js';

// —— 电影舞台比例（非 AU，自洽）——
const RE=1.0, RM=0.27, MD=15.0, PARK=1.35, LUNAR_R=0.6, LUNAR_ORBITS=2;
const ORDER=['COUNTDOWN','IGNITION','LIFTOFF','SPHERE','STAGE_SEP','EARTH_ORBIT','TRANSFER','LOI','LUNAR_ORBIT','LANDING','LANDED'];
const DUR={ COUNTDOWN:4.0, IGNITION:2.0, LIFTOFF:5.5, SPHERE:9, STAGE_SEP:2.2, EARTH_ORBIT:9, TRANSFER:18, LOI:3, LUNAR_ORBIT:8, LANDING:11 };
const PHASE_NAME={ COUNTDOWN:'发射倒计时', IGNITION:'点火', LIFTOFF:'升空', SPHERE:'俯瞰地球', STAGE_SEP:'分级脱离', EARTH_ORBIT:'地球轨道', TRANSFER:'地月转移', LOI:'月球制动', LUNAR_ORBIT:'绕月飞行', LANDING:'登月下降', LANDED:'着陆月球' };

function tex(cb){ const c=document.createElement('canvas'); c.width=128; c.height=64; cb(c.getContext('2d')); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
const ease=t=>t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
function softDot(){ const c=document.createElement('canvas'); c.width=c.height=32; const g=c.getContext('2d'); const gr=g.createRadialGradient(16,16,0,16,16,16); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.4,'rgba(255,255,255,.55)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(0,0,32,32); const t=new THREE.CanvasTexture(c); return t; }
function goldTex(){ return tex(g=>{ g.fillStyle='#8a6a1e'; g.fillRect(0,0,128,64); for(let y=0;y<64;y+=2){ const b=0.72+0.28*((y*31)%9)/9; g.fillStyle=`rgb(${Math.round(190*b)},${Math.round(140*b)},${Math.round(45*b)})`; g.fillRect(0,y,128,2); } }); }
function solarTex(){ return tex(g=>{ g.fillStyle='#06132e'; g.fillRect(0,0,128,64); for(let y=0;y<4;y++)for(let x=0;x<8;x++){ const b=0.26+0.16*((x*7+y*13)%9)/9; g.fillStyle=`rgb(${Math.round(18+b*50)},${Math.round(45+b*70)},${Math.round(110+b*95)})`; g.fillRect(x*16+1,y*16+1,14,14); } for(let x=0;x<=8;x++){ g.strokeStyle='rgba(210,230,255,.3)'; g.beginPath(); g.moveTo(x*16,0); g.lineTo(x*16,64); g.stroke(); } for(let y=0;y<=4;y++){ g.beginPath(); g.moveTo(0,y*16); g.lineTo(128,y*16); g.stroke(); } }); }

// —— 文昌微缩城 ——
function buildWenchang(){
  const g=new THREE.Group();
  const groundMat=new THREE.MeshStandardMaterial({color:0x7a6f52, roughness:.95});
  const roadMat=new THREE.MeshBasicMaterial({color:0x464c55});
  const bldMat=new THREE.MeshStandardMaterial({color:0xcfd4da, metalness:.3, roughness:.6});
  const steelMat=new THREE.MeshStandardMaterial({color:0x9aa2ae, metalness:.7, roughness:.5});
  const seaMat=new THREE.MeshStandardMaterial({color:0x2a6fa8, roughness:.4, metalness:.1});
  const ground=new THREE.Mesh(new THREE.CircleGeometry(0.15,40), groundMat); ground.rotation.x=-Math.PI/2; g.add(ground);
  const sea=new THREE.Mesh(new THREE.CircleGeometry(0.05,40), seaMat); sea.rotation.x=-Math.PI/2; sea.position.set(0.17,-0.004,0); g.add(sea);
  for(let i=-2;i<=2;i++){ const r=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.0015,0.006), roadMat); r.position.set(0,0.002,i*0.05); g.add(r);
    const r2=new THREE.Mesh(new THREE.BoxGeometry(0.006,0.0015,0.42), roadMat); r2.position.set(i*0.05,0.002,0); g.add(r2); }
  const pad=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.02,0.008,20), steelMat); g.add(pad);
  const tower=new THREE.Group(); const TH=0.10;
  [[-0.012,-0.008],[0.012,-0.008],[-0.012,0.008],[0.012,0.008]].forEach(([x,z])=>{ const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.0018,0.0018,TH,8), steelMat); leg.position.set(x,TH/2,z); tower.add(leg); });
  for(let i=1;i<7;i++){ const y=i/6*TH;
    const bx=new THREE.Mesh(new THREE.BoxGeometry(0.026,0.0018,0.0018), steelMat); bx.position.y=y; tower.add(bx);
    const bz=new THREE.Mesh(new THREE.BoxGeometry(0.0018,0.0018,0.018), steelMat); bz.position.y=y; tower.add(bz); }
  tower.position.set(-0.03,0,-0.02); g.add(tower);
  const vab=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.02,0.03), bldMat); vab.position.set(0.10,0.01,0.07); g.add(vab);
  const fuel=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.02,12), bldMat); fuel.position.set(-0.10,0.01,0.06); g.add(fuel);
  const ctl=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.015,0.02), bldMat); ctl.position.set(-0.09,0.008,-0.08); g.add(ctl);
  return g;
}
function buildRocket(){
  const g=new THREE.Group();
  const white=new THREE.MeshStandardMaterial({color:0xf0f1f3, metalness:.2, roughness:.5});
  const white2=new THREE.MeshStandardMaterial({color:0xd8dade, metalness:.3, roughness:.5});
  const gold=new THREE.MeshStandardMaterial({map:goldTex(), metalness:.7, roughness:.45});
  const core=new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.008,0.07,20), white); core.position.y=0.042; g.add(core);
  const up=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.038,20), white2); up.position.y=0.096; g.add(up);
  const fairing=new THREE.Mesh(new THREE.ConeGeometry(0.006,0.03,20), white); fairing.position.y=0.129; g.add(fairing);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(0.0083,0.0083,0.006,20), gold); band.position.y=0.076; g.add(band);
  const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(0.005,0.008,0.01,16), new THREE.MeshStandardMaterial({color:0x3a3d42, metalness:.8, roughness:.5})); nozzle.position.y=0.0; g.add(nozzle);
  for(let i=0;i<4;i++){ const fin=new THREE.Mesh(new THREE.BoxGeometry(0.0012,0.016,0.012), white2); fin.position.set(Math.cos(i*Math.PI/2)*0.010, 0.006, Math.sin(i*Math.PI/2)*0.010); g.add(fin); }
  const stand=new THREE.Mesh(new THREE.CylinderGeometry(0.011,0.013,0.007,20), white2); stand.position.y=-0.006; g.add(stand);
  g.userData.nozzle=nozzle; g.userData.stand=stand;
  return g;
}
function buildBoosters(){
  const g=new THREE.Group();
  const white=new THREE.MeshStandardMaterial({color:0xe8eaee, metalness:.25, roughness:.55});
  [[-1],[1]].forEach(([s])=>{
    const b=new THREE.Mesh(new THREE.CylinderGeometry(0.0045,0.0045,0.06,12), white); b.position.x=s*0.013; b.position.y=0.04; g.add(b);
    const tip=new THREE.Mesh(new THREE.ConeGeometry(0.0045,0.014,12), white); tip.position.x=s*0.013; tip.position.y=0.077; g.add(tip);
    const noz=new THREE.Mesh(new THREE.CylinderGeometry(0.0034,0.0046,0.008,10), new THREE.MeshStandardMaterial({color:0x3a3d42, metalness:.8, roughness:.5})); noz.position.x=s*0.013; noz.position.y=0.006; g.add(noz);
  });
  return g;
}
function buildChange(){
  const g=new THREE.Group();
  const gold=new THREE.MeshStandardMaterial({map:goldTex(), metalness:.7, roughness:.45});
  const metal=new THREE.MeshStandardMaterial({color:0xb9bec7, metalness:.85, roughness:.35});
  const solar=new THREE.MeshStandardMaterial({map:solarTex(), metalness:.35, roughness:.55, side:THREE.DoubleSide});
  const svc=new THREE.Mesh(new THREE.BoxGeometry(0.045,0.045,0.05), gold); svc.position.y=0.045; g.add(svc);
  const dish=new THREE.Mesh(new THREE.SphereGeometry(0.022,16,10,0,Math.PI*2,0,Math.PI*0.4), metal); dish.rotation.x=-Math.PI/2; dish.position.set(0,0.08,0); g.add(dish);
  [[-1],[1]].forEach(([s])=>{ const wing=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.005,0.03), solar); wing.position.x=s*0.062; wing.position.y=0.045; g.add(wing); });
  const lander=new THREE.Group(); lander.name='lander'; lander.position.y=-0.045;
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.042,0.034,0.042), metal); lander.add(body);
  const top=new THREE.Mesh(new THREE.ConeGeometry(0.022,0.028,10), gold); top.position.y=0.031; lander.add(top);
  for(let i=0;i<4;i++){ const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.004,0.045,8), metal);
    leg.position.set(Math.cos(i*Math.PI/2+Math.PI/4)*0.034, -0.04, Math.sin(i*Math.PI/2+Math.PI/4)*0.034); leg.rotation.z=Math.cos(i*Math.PI/2+Math.PI/4)*0.6; leg.rotation.x=Math.sin(i*Math.PI/2+Math.PI/4)*0.6; lander.add(leg); }
  g.add(lander);
  g.userData.lander=lander; g.userData.svc=svc;
  return g;
}
function buildPlume(){ const g=new THREE.Group();
  const outer=new THREE.Mesh(new THREE.ConeGeometry(0.014,0.07,16), new THREE.MeshBasicMaterial({color:0xff7d1e, transparent:true, opacity:0.75, blending:THREE.AdditiveBlending, depthWrite:false})); outer.rotation.x=Math.PI; outer.position.y=-0.045; g.add(outer);
  const inner=new THREE.Mesh(new THREE.ConeGeometry(0.007,0.06,16), new THREE.MeshBasicMaterial({color:0xfff7c8, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, depthWrite:false})); inner.rotation.x=Math.PI; inner.position.y=-0.042; g.add(inner);
  const base=new THREE.Mesh(new THREE.ConeGeometry(0.005,0.02,12), new THREE.MeshBasicMaterial({color:0x8fc6ff, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false})); base.rotation.x=Math.PI; base.position.y=-0.014; g.add(base);
  g.userData.cone=outer; g.visible=false; return g; }
function buildSteam(){ const N=220, geo=new THREE.BufferGeometry(), arr=new Float32Array(N*3); geo.setAttribute('position',new THREE.BufferAttribute(arr,3)); const mat=new THREE.PointsMaterial({color:0xe6eef6, size:0.014, map:softDot(), transparent:true, opacity:0, depthWrite:false, sizeAttenuation:true}); const pts=new THREE.Points(geo,mat); pts.visible=false; pts.userData={parts:[]}; return pts; }

export class LunarMission {
  constructor(ctx){
    this.ctx=ctx; this.active=false; this.phase='IDLE'; this.pt=0; this._built=false; this._scene=null;
    this._saved={ rate:-1, running:true, moonMode:null, controlsOn:true, labelsOn:true };
    this._cam={ pos:new THREE.Vector3(), tgt:new THREE.Vector3(), up:new THREE.Vector3(0,1,0) };
    this._closeup=true; this._inMoon=false;
    this._site=new THREE.Vector3(0,RE,0);   // 发射点(+Y 极)，月球在 +X
  }
  get scene(){ if(!this._scene) this._scene=new THREE.Scene(); return this._scene; }

  start(){ if(this.active) return; try{ this._doStart(); }catch(err){ console.error('mission start error', err); try{ this._teardown(); }catch(e){} } }
  _doStart(){
    const ctx=this.ctx;
    this.ctx.missionActive=true; document.body.classList.add('mission-active');
    this._saved.rate=ctx.clock.rateIndex; this._saved.running=ctx.clock.running; ctx.clock.running=false;
    this._saved.controlsOn=ctx.cameraRig.controls.enabled; ctx.cameraRig.controls.enabled=false;
    this._saved.labelsOn=ctx.orbitView.labelsVisible; if(this._saved.labelsOn) ctx.orbitView.toggleLabels();
    if(ctx.labelRenderer) this._labelDisp=ctx.labelRenderer.domElement.style.display, ctx.labelRenderer.domElement.style.display='none';
    ctx.camera.up.set(0,1,0);
    this.active=true;
    this._buildScene();
    this._buildUi();
    this._setPhase('COUNTDOWN');
    bus.emit('mission.start'); this._syncBtn();
  }

  _buildScene(){
    const sc=this.scene;
    sc.add(new THREE.AmbientLight(0x557, 0.9));
    const sun=new THREE.PointLight(0xffffff, 3.2, 0, 0); sun.position.set(30,22,12); sc.add(sun);
    this.landLight=new THREE.PointLight(0xffe6c0, 0, 8, 2); this.landLight.position.set(MD-RM*0.4, 1.5, 3); sc.add(this.landLight);
    this.moonFill=new THREE.PointLight(0xf0e6d6, 2.4, 10, 2); this.moonFill.position.set(MD-4, 1.5, 1); sc.add(this.moonFill);
    // 白天蓝天球（地面发射时为蓝天, 升空进太空后淡出为黑暗）
    this.skyMat=new THREE.ShaderMaterial({
      uniforms:{ uA:{value:1}, uTop:{value:new THREE.Color(0x3a7ad4)}, uHor:{value:new THREE.Color(0xcfe4f5)} },
      vertexShader:`varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader:`uniform float uA; uniform vec3 uTop; uniform vec3 uHor; varying vec3 vP;
        void main(){ float h=clamp(normalize(vP).y*0.5+0.5,0.0,1.0); vec3 c=mix(uHor,uTop, pow(h,1.4)); gl_FragColor=vec4(c, uA); }`,
      side:THREE.BackSide, transparent:true, depthWrite:false });
    const sky=new THREE.Mesh(new THREE.SphereGeometry(60,32,16), this.skyMat); sky.name='sky'; sc.add(sky);
    const earth=new THREE.Mesh(new THREE.SphereGeometry(RE, 72, 72), new THREE.MeshStandardMaterial({color:0x2f6fb0, roughness:.7})); earth.name='earth'; sc.add(earth);
    this._loadTex('earth_daymap', t=>{ if(t&&earth.material){ earth.material.map=t; earth.material.needsUpdate=true; } });
    const moon=new THREE.Mesh(new THREE.SphereGeometry(RM, 56, 56), new THREE.MeshStandardMaterial({color:0xb8b8b8, roughness:.9})); moon.name='moon'; moon.position.set(MD,0,0); sc.add(moon);
    this._loadTex('moon', t=>{ if(t&&moon.material){ moon.material.map=t; moon.material.needsUpdate=true; } });
    this.wenchang=buildWenchang(); this.wenchang.position.copy(this._site); sc.add(this.wenchang);
    const stars=new THREE.Points(new THREE.BufferGeometry().setFromPoints(this._stars(700).map(p=>new THREE.Vector3().fromArray(p))), new THREE.PointsMaterial({color:0xffffff, size:0.06, sizeAttenuation:false})); sc.add(stars);
    this.rocket=buildRocket(); this.boosters=buildBoosters(); this.change=buildChange(); this.plumeR=buildPlume(); this.plumeC=buildPlume(); this.steam=buildSteam();
    this.rocket.add(this.plumeR); this.change.add(this.plumeC); this.plumeC.scale.setScalar(3.2);
    [this.rocket,this.boosters,this.change,this.steam].forEach(o=>{ this.scene.add(o); });
    this.linePark=this._mkLine(k=>this._park(k*Math.PI*2), 0x7fd0ff);
    this.lineTransfer=this._mkLine(k=>this._transfer(k*Math.PI), 0xffd54a);
    this.lineLunar=this._mkLine(k=>this._lunar(k*Math.PI*2), 0x8fd0ff);
    // 地月转移"近快远慢"速度箭头（开普勒第二定律）
    this.speedArrows=new THREE.Group(); this.speedArrows.visible=false; this.scene.add(this.speedArrows);
    const a=(PARK+MD)/2;
    for(let i=0;i<7;i++){ const nu=Math.PI*i/6, r=this._transferR(nu);
      const p=this._transfer(nu);
      const dir=this._transfer(nu+0.03).sub(this._transfer(nu-0.03)).normalize();
      const sp=Math.sqrt(Math.max(0, 2/r - 1/a));
      this.speedArrows.add(new THREE.ArrowHelper(dir, p, 0.12+sp*0.42, 0xffb454, 0.045, 0.03));
    }
    this._built=true;
  }
  _loadTex(key, cb){ try{ textureStore.surface(key).then(cb).catch(()=>{}); }catch(e){} }
  _stars(n){ const a=[]; for(let i=0;i<n;i++) a.push([(Math.random()-.5)*70,(Math.random()-.5)*70,(Math.random()-.5)*70]); return a; }

  _park(th){ return new THREE.Vector3(PARK*Math.cos(th), PARK*Math.sin(th), 0); }
  _mdApo(){ return MD - LUNAR_R; }   // 转移远地点 = 月球停泊轨道近侧
  _transferR(nu){ const A=(PARK+this._mdApo())/2, e=(this._mdApo()-PARK)/(this._mdApo()+PARK); return A*(1-e*e)/(1+e*Math.cos(nu)); }
  _transfer(nu){ const r=this._transferR(nu); return new THREE.Vector3(-r*Math.cos(nu), -r*Math.sin(nu), 0); }  // 近日点(-X)→远日点(+X,月球停泊轨); Y 取负与停泊轨道方向一致
  _kepler(M,e){ let E=M; for(let i=0;i<12;i++){ const f=E-e*Math.sin(E)-M, fp=1-e*Math.cos(E); if(Math.abs(f)<1e-9) break; E-=f/fp; } return E; }
  _nuFromM(M){ const e=(this._mdApo()-PARK)/(this._mdApo()+PARK); const E=this._kepler(M,e); return 2*Math.atan2(Math.sqrt(1+e)*Math.sin(E/2), Math.sqrt(1-e)*Math.cos(E/2)); }
  _lunar(la){ return new THREE.Vector3(MD,0,0).add(new THREE.Vector3(LUNAR_R*Math.cos(la), LUNAR_R*Math.sin(la), 0)); }
  _tangentPark(th){ return new THREE.Vector3(-Math.sin(th), Math.cos(th), 0).normalize(); }
  _tangentLunar(la){ return new THREE.Vector3(-Math.sin(la), Math.cos(la), 0).normalize(); }
  _mkLine(fn,color){
    const pts=[]; for(let i=0;i<=200;i++) pts.push(fn(i/200));
    const geo=new THREE.BufferGeometry().setFromPoints(pts); geo.setDrawRange(0,0);
    const l=new THREE.Line(geo, new THREE.LineBasicMaterial({color, transparent:true, opacity:0.6}));
    l.visible=false; this.scene.add(l); return l;
  }
  _reveal(line, frac){ if(line&&line.geometry) line.geometry.setDrawRange(0, Math.max(1, Math.floor(frac*201))); }

  _setPhase(p){ this.phase=p; this.pt=0; this._enterPhase(p); }
  _enterPhase(p){
    if(p==='COUNTDOWN'){ this.rocket.visible=true; this.boosters.visible=true; this.change.visible=false; this.steam.visible=false; this.plumeR.visible=false; this.plumeC.visible=false;
      this.rocket.position.copy(this._site).add(new THREE.Vector3(0,0.006,0)); this._pointUp(this.rocket, new THREE.Vector3(0,1,0));
      this.boosters.position.copy(this.rocket.position); this.boosters.quaternion.copy(this.rocket.quaternion); this.boosters.userData.sep=null;
      this._hideLines(); }
    if(p==='IGNITION'){ this.plumeR.visible=true; this.steam.visible=true; this._spawnSteam(); }
    if(p==='LIFTOFF'){ this.plumeR.visible=true; }
    if(p==='SPHERE'){ this.plumeR.visible=false; }
    if(p==='STAGE_SEP'){ this.plumeR.visible=false; this.stageSepT=0; if(this.boosters) this.boosters.userData.sep={t:0}; }
    if(p==='EARTH_ORBIT'){ this.change.visible=false; this.rocket.visible=true; if(this.boosters) this.boosters.visible=false; this.linePark.visible=true; }
    if(p==='TRANSFER'){ this.change.visible=true; this.lineTransfer.visible=true; this._reveal(this.lineTransfer,0); if(this.speedArrows) this.speedArrows.visible=true; this._transSepT=0; }
    if(p==='LOI'){ this.plumeC.visible=true; this.lineLunar.visible=true; this._reveal(this.lineLunar,0); if(this.speedArrows) this.speedArrows.visible=false; }
    if(p==='LUNAR_ORBIT'){ this.plumeC.visible=false; this._lam=0; this._reveal(this.lineLunar,0); this.lineTransfer.visible=false; }
    if(p==='LANDING'){ this._detachLander(); this.plumeC.visible=true; if(this.plumeC) this.plumeC.scale.setScalar(0.8); if(this.landLight) this.landLight.intensity=2.2; }
    if(p==='LANDED'){ this.plumeC.visible=false; this._showSuccess(); }
  }
  _hideLines(){ [this.linePark,this.lineTransfer,this.lineLunar].forEach(l=>{ if(l){ l.visible=false; if(l.geometry) l.geometry.setDrawRange(0,0); } }); if(this.speedArrows) this.speedArrows.visible=false; }
  _fadeWenchang(a){ if(!this.wenchang) return; this.wenchang.traverse(o=>{ if(o.material){ o.material.transparent=true; o.material.opacity=Math.max(0,Math.min(1,a)); } }); }
  _syncBoosters(){ if(!this.boosters||!this.boosters.visible) return; const sep=this.boosters.userData&&this.boosters.userData.sep; if(sep) return; this.boosters.position.copy(this.rocket.position); this.boosters.quaternion.copy(this.rocket.quaternion); }

  _pointUp(obj,dir){ if(!obj||!dir||dir.lengthSq()<1e-10) return; obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize()); }
  _spawnSteam(){
    const pts=this.steam, N=220, arr=pts.geometry.attributes.position.array;
    pts.userData.parts=[];
    for(let i=0;i<N;i++){ const a=Math.random()*Math.PI*2, r=0.015+Math.random()*0.04;
      const x=this._site.x+Math.cos(a)*r, y=RE+0.005, z=this._site.z+Math.sin(a)*r;
      pts.userData.parts.push({x,y,z,vx:Math.cos(a)*0.05, vy:0.02+Math.random()*0.05, vz:Math.sin(a)*0.05, life:1, s:0.6+Math.random()*0.6}); }
    arr.forEach((v,i)=>{ /* 先填满 */ });
    pts.userData.parts.forEach((p,i)=>{ arr[i*3]=p.x; arr[i*3+1]=p.y; arr[i*3+2]=p.z; });
    pts.geometry.attributes.position.needsUpdate=true; pts.material.opacity=0.7;
  }
  _updateSteam(dt){
    const pts=this.steam, arr=pts.geometry.attributes.position.array;
    if(!pts.visible) return; let alive=0;
    pts.userData.parts.forEach((p,i)=>{ p.life-=dt*0.6; p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt; p.vy+=0.04*dt; p.vx*=0.99; p.vz*=0.99;
      if(p.life>0){ alive++; arr[i*3]=p.x; arr[i*3+1]=p.y; arr[i*3+2]=p.z; } else arr[i*3+1]=-999; });
    pts.geometry.attributes.position.needsUpdate=true; pts.material.opacity=Math.max(0, alive/220*0.7);
    if(alive===0) pts.visible=false;
  }
  _dust(pos){ if(!this._dustPts){ const n=60, g=new THREE.BufferGeometry(), a=new Float32Array(n*3); g.setAttribute('position',new THREE.BufferAttribute(a,3));
      this._dustPts=new THREE.Points(g, new THREE.PointsMaterial({color:0xccc4b0, size:0.014, map:softDot(), transparent:true, opacity:0.7, depthWrite:false, sizeAttenuation:true})); this.scene.add(this._dustPts); this._dustArr=a; this._dustN=n; }
    const a=this._dustArr; for(let i=0;i<this._dustN;i++){ a[i*3]=pos.x+(Math.random()-.5)*0.06; a[i*3+1]=pos.y+(Math.random())*0.04; a[i*3+2]=pos.z+(Math.random()-.5)*0.06; }
    this._dustPts.geometry.attributes.position.needsUpdate=true; }

  update(dt){
    if(!this.active) return;
    this.pt+=dt;
    const dur=DUR[this.phase]||1, k=Math.min(this.pt/dur,1);
    const ke=ease(k);
    const site=this._site, up=new THREE.Vector3(0,1,0);
    switch(this.phase){
      case 'COUNTDOWN': this._setCountdown(); this._syncBoosters(); break;
      case 'IGNITION': this.plumeR.userData.cone.scale.setScalar(1+0.4*Math.sin(this.pt*30)); this._updateSteam(dt); this._syncBoosters(); break;
      case 'LIFTOFF': {
        const p0=this._site.clone().add(new THREE.Vector3(0,0.006,0));
        const p1=new THREE.Vector3(0,PARK,0);
        this.rocket.position.copy(p0).lerp(p1, ke).add(new THREE.Vector3(Math.sin(Math.PI*k)*0.04,0,0));
        this._pointUp(this.rocket, up.clone().lerp(new THREE.Vector3(1,0,0),0.5*ke));
        this.plumeR.userData.cone.scale.setScalar(0.8+0.3*Math.sin(this.pt*25)); this._syncBoosters(); break; }
      case 'SPHERE': {
        this.rocket.position.copy(new THREE.Vector3(0,PARK,0)).add(new THREE.Vector3(Math.sin(Math.PI*k)*0.04,0,0));
        this._pointUp(this.rocket, new THREE.Vector3(1,0,0).multiplyScalar(ke).add(new THREE.Vector3(0,1,0).multiplyScalar(1-ke)).normalize());
        this._fadeWenchang(Math.max(0, 1 - Math.min(this.pt/DUR.SPHERE,1)*1.1));   // 升空隐藏平地,只留球面
        this._syncBoosters(); break; }
      case 'STAGE_SEP': {
        this.rocket.position.copy(new THREE.Vector3(0,PARK,0)); this._pointUp(this.rocket, new THREE.Vector3(1,0,0));
        // 助推器分离：向后下翻滚坠落淡出
        const sep=this.boosters&&this.boosters.userData?this.boosters.userData.sep:null;
        if(sep){ sep.t+=dt; const r=this.rocket.position;
          this.boosters.position.copy(r).add(new THREE.Vector3(-sep.t*0.03, -sep.t*0.06, 0));
          this.boosters.rotation.z=sep.t*1.6; this.boosters.rotation.x=sep.t*0.8;
          this.boosters.children.forEach(c=>{ if(c.material){ c.material=c.material.clone(); c.material.transparent=true; c.material.opacity=Math.max(0,1-sep.t*0.9); } });
          if(sep.t>1.2) this.boosters.visible=false;
        }
        break; }
      case 'EARTH_ORBIT': {
        // 火箭(含整流罩/嫦娥)绕地球一圈多(450°), 到 TLI 点(-X); 方向与转移一致
        const th=Math.PI/2 + k*(Math.PI/2 + Math.PI*2);
        this.rocket.position.copy(this._park(th));
        this._pointUp(this.rocket, this._tangentPark(th));
        this._reveal(this.linePark, k);
        break; }
      case 'TRANSFER': {
        // TLI 点(-X): 上面级分离, 嫦娥卫星出舱, 沿转移椭圆(凸-Y)飞向月球停泊轨近侧
        if(this._transSepT===undefined) this._transSepT=0;
        this._transSepT+=dt;
        const f=Math.max(0, 1-this._transSepT/1.4);   // 火箭(上面级)分离淡出
        this.rocket.children.forEach(c=>{ if(c.material){ c.material.transparent=true; c.material.opacity=f; } });
        if(f<=0) this.rocket.visible=false;
        this.rocket.position.copy(this._park(Math.PI));
        const nu=Math.PI*ke;
        this.change.position.copy(this._transfer(nu));
        const nuP=Math.max(nu-0.02,0.001);
        const vel=this._transfer(nu).sub(this._transfer(nuP)).normalize();
        this._pointUp(this.change, vel);
        this._reveal(this.lineTransfer, k);
        break; }
      case 'LOI': {
        // 到达月球停泊轨近侧: 反向制动(被月球"抓住"), 不重复转移运动
        this.change.position.copy(this._lunar(Math.PI));
        this._pointUp(this.change, this._tangentLunar(Math.PI));
        this.plumeC.userData.cone.scale.setScalar(1+0.3*Math.sin(this.pt*25));
        break; }
      case 'LUNAR_ORBIT': {
        this._lam=Math.PI + k*Math.PI*2*LUNAR_ORBITS; this.change.position.copy(this._lunar(this._lam));
        this._pointUp(this.change, this._tangentLunar(this._lam));
        this._reveal(this.lineLunar, k);
        break; }
      case 'LANDING': {
        this._lam+=dt*0.5; this.change.position.copy(this._lunar(this._lam));
        this._pointUp(this.change, this._tangentLunar(this._lam));
        const lander=this.change.userData.lander, to=new THREE.Vector3(MD-RM-0.045,0,0);   // 落点=月面+腿高, 腿不扎进月面
        lander.position.copy(this._landerStart).lerp(to, ke);
        this._pointUp(lander, to.clone().sub(new THREE.Vector3(MD,0,0)).normalize());
        if(this.pt%0.08<dt) this._dust(lander.position);
        this.plumeC.userData.cone.scale.setScalar(0.8+0.3*Math.sin(this.pt*20)); break; }
      case 'LANDED': {
        this._lam+=dt*0.4; this.change.position.copy(this._lunar(this._lam));
        this._pointUp(this.change, this._tangentLunar(this._lam));
        const lander=this.change.userData.lander;
        lander.position.copy(new THREE.Vector3(MD-RM-0.045,0,0)); this._pointUp(lander, new THREE.Vector3(-1,0,0)); break; }
    }
    const i=ORDER.indexOf(this.phase);
    if(k>=1 && i>=0 && i<ORDER.length-1) this._setPhase(ORDER[i+1]);
    // 天空: 地面发射=白天蓝天, 升空(SPHERE)渐入太空变黑
    if(this.skyMat){ let skyA=1;
      if(this.phase==='SPHERE') skyA=Math.max(0, 1-Math.min(this.pt/DUR.SPHERE,1)*1.15);
      else if(this.phase!=='COUNTDOWN'&&this.phase!=='IGNITION'&&this.phase!=='LIFTOFF') skyA=0;
      this.skyMat.uniforms.uA.value=skyA; }
    this._updateCamera(dt); this._updateHud();
  }

  // —— 分镜导演 ——
  _camDesired(){
    const site=this._site, up=new THREE.Vector3(0,1,0), pos=new THREE.Vector3(), tgt=new THREE.Vector3();
    const lander=this.change && this.change.userData ? this.change.userData.lander : this.change;
    const U=up;   // 统一地平线上方向 (+Y), 避免运镜翻滚
    switch(this.phase){
      case 'COUNTDOWN': case 'IGNITION': {
        // 低角度英雄镜头（换个没有建筑的机位）：从 -Z 侧仰视火箭+塔架
        pos.set(-0.05, RE+0.02, -0.15); tgt.copy(site).add(new THREE.Vector3(0,0.10,0)); U.set(0,1,0); break; }
      case 'LIFTOFF': {
        // 平视→仰视：相机留台边，随火箭升高而抬升视线
        pos.set(-0.05, RE+0.02, -0.17); tgt.copy(this.rocket.position); U.set(0,1,0); break; }
      case 'SPHERE': {
        // 敬畏段落：相机升高, 地面→球面; 后段(球面出现)停顿2~3秒
        const q=Math.min(this.pt/DUR.SPHERE,1), rq=ease(Math.min(q/0.72,1));
        const h=RE+0.25 + rq*4.2;
        pos.set(1.9, h, 2.3); tgt.set(0, RE*0.5, 0.35); U.set(0,1,0); break; }
      case 'STAGE_SEP': {
        pos.set(0.9, 2.0, 1.3); tgt.copy(this.rocket.position); U.set(0,1,0); break; }
      case 'EARTH_ORBIT': {
        pos.copy(this.rocket.position).add(new THREE.Vector3(1.1, 0.9, 1.5)); tgt.copy(this.rocket.position); U.set(0,1,0); break; }
      case 'TRANSFER': {
        // 长推近：开始广(带地球+月球+椭圆参照=空间线), 越近月球越逼近
        const k=Math.min(this.pt/DUR.TRANSFER,1);
        const r=3.4 - k*2.5;   // 广→近
        pos.copy(this.change.position).add(new THREE.Vector3(-0.2*r, 0.72*r, 0.55*r)); tgt.copy(this.change.position); U.set(0,1,0); break; }
      case 'LOI': {
        pos.copy(this.change.position).add(new THREE.Vector3(0.5, 0.9, 0.5)); tgt.copy(this.change.position); U.set(0,1,0); break; }
      case 'LUNAR_ORBIT': {
        // 缓慢环绕：相机沿月球轨道外侧缓慢跟拍, 镜头有"意味"
        pos.copy(this.change.position).add(new THREE.Vector3(0.6, 0.9, 0.7)); tgt.copy(this.change.position); U.set(0,1,0); break; }
      case 'LANDING': case 'LANDED': {
        // 月面水平观察视角(同发射前地面机位): 站在月面低角度仰视登月器缓缓降落
        const site2=new THREE.Vector3(MD-RM-0.045,0,0);
        pos.copy(site2).add(new THREE.Vector3(-0.02,0,0.15)); tgt.copy(lander.position); U.set(-1,0,0); break; }
      default: pos.set(0,2.4,2.0); tgt.set(0,0,0); U.set(0,1,0);
    }
    return {pos,tgt,up};
  }
  _updateCamera(dt){
    const d=this._camDesired(), cam=this.ctx.camera, s=Math.min(1, dt*5);
    this._cam.pos.lerp(d.pos,s); this._cam.tgt.lerp(d.tgt,s); this._cam.up.lerp(d.up,s);
    cam.position.copy(this._cam.pos); cam.up.copy(this._cam.up).normalize(); cam.lookAt(this._cam.tgt);
  }
  render(){ const ctx=this.ctx; const w=ctx.renderer.domElement.clientWidth, h=ctx.renderer.domElement.clientHeight; ctx.renderer.setViewport(0,0,w,h); ctx.renderer.setScissor(0,0,w,h); ctx.renderer.render(this.scene, ctx.camera); }

  _buildUi(){
    if(!document.getElementById('mission-hud')){
      const h=document.createElement('div'); h.id='mission-hud';
      h.innerHTML=`<div style="position:fixed;left:50%;top:56px;transform:translateX(-50%);z-index:60;background:var(--panel-solid,#0c1224);border:1px solid rgba(255,180,84,.35);border-radius:12px;padding:10px 18px;color:#e8ecf5;font-size:15px;text-align:center;pointer-events:auto;min-width:280px">
        <div id="mission-phase" style="font-weight:600;color:#ffb454">🚀 发射倒计时</div>
        <div id="mission-sub" style="font-size:12px;color:#9aa7bd;margin-top:3px;max-width:320px">—</div>
        <div id="mission-count" style="font-size:26px;font-weight:700;color:#ffd54a;margin-top:2px"></div>
        <div id="mission-prog-wrap" style="margin-top:7px">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#8fa0b8"><span>🌍 地球</span><span>🌕 月球</span></div>
          <div style="position:relative;height:6px;background:rgba(255,255,255,.12);border-radius:3px;margin:2px 0">
            <div id="mission-prog-fill" style="position:absolute;left:0;top:0;height:100%;width:0%;background:linear-gradient(90deg,#7fd0ff,#ffd54a);border-radius:3px"></div>
            <div id="mission-prog-dot" style="position:absolute;top:-3px;left:0%;width:12px;height:12px;border-radius:50%;background:#ffb454;border:2px solid #fff;transform:translateX(-50%)"></div>
          </div>
          <div id="mission-dist" style="font-size:10px;color:#9aa7bd">—</div>
        </div>
        <button id="mission-stop" style="margin-top:6px;padding:6px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#e8ecf5;cursor:pointer">⏹ 停止任务</button>
      </div>`;
      document.body.appendChild(h);
      document.getElementById('mission-stop').addEventListener('click',()=>this.cancel());
    }
    document.getElementById('mission-hud').style.display='block';
  }
  _setCountdown(){ const el=document.getElementById('mission-count'); if(!el) return; const r=Math.ceil(DUR.COUNTDOWN-this.pt); el.textContent=r>0?String(r):'点火!'; }
  _updateHud(){
    const p=document.getElementById('mission-phase'), s=document.getElementById('mission-sub'); if(!p) return;
    p.textContent=PHASE_NAME[this.phase]||this.phase; let sub='';
    const WHY={ COUNTDOWN:'一切就绪，等待点火', IGNITION:'火焰 + 导流槽水雾喷涌', LIFTOFF:'突破大气，逐渐摆脱地球引力',
      SPHERE:'升得更高——你看，地球原来是一个球', STAGE_SEP:'分级脱离：多级更省燃料', EARTH_ORBIT:'火箭绕地球一圈，获得入轨速度',
      TRANSFER:'上面级分离，嫦娥卫星出舱 · 为什么不是直线飞？沿椭圆最省燃料', LOI:'为什么必须制动？不减速会飞过月球', LUNAR_ORBIT:'嫦娥绕月探测，寻找落点',
      LANDING:'反推减速 → 缓缓降落', LANDED:'已在月球表面' };
    sub=WHY[this.phase]||'';
    if(this.phase==='TRANSFER'){ const k=Math.min(this.pt/DUR.TRANSFER,1); sub+=`（转移 ${Math.round(k*100)}%）`; }
    else if(this.phase==='LUNAR_ORBIT'){ sub+=`　绕月第 ${Math.floor(Math.min(this.pt/DUR.LUNAR_ORBIT,1)*LUNAR_ORBITS)+1}/${LUNAR_ORBITS} 圈`; }
    else if(this.phase==='LANDING'){ const k=Math.min(this.pt/DUR.LANDING,1); sub+=`（下降 ${Math.round(k*100)}%）`; }
    if(this.phase!=='COUNTDOWN'&&this.phase!=='IGNITION'){ const c=document.getElementById('mission-count'); if(c) c.textContent=''; }
    s.textContent=sub;
    this._updateProgress();
  }
  _updateProgress(){
    // 空间进度条：嫦娥在地球—月球之间的位置（+ 距离）
    const fill=document.getElementById('mission-prog-fill'), dot=document.getElementById('mission-prog-dot'), dist=document.getElementById('mission-dist');
    if(!fill||!dot) return;
    const ch=this.change, cx=ch?ch.position.x:0;
    const frac=Math.max(0, Math.min(1, (cx+PARK)/(MD+PARK)));  // 从地球近处(-PARK)到月球(MD)
    if(!this._inMoon){ if(this.phase==='LANDING'||this.phase==='LANDED'||this.phase==='LUNAR_ORBIT'||this.phase==='LOI') this._inMoon=true; }
    const shown=this._inMoon?1:frac;
    fill.style.width=Math.round(shown*100)+'%'; dot.style.left=Math.round(shown*100)+'%';
    if(dist){ const dM=Math.max(0, MD-cx); const dE=Math.abs(cx);
      if(this._inMoon) dist.textContent = this.phase==='LOI'?'正在月球制动':((this.phase==='LANDING'||this.phase==='LANDED')?'已抵达月球 · 正在着陆':'已抵达月球 · 绕月飞行');
      else dist.textContent=`距月球 ${(dM*3.844).toFixed(1)} 万公里　距地球 ${(dE*3.844).toFixed(1)} 万公里`; }
  }
  _detachLander(){ const ch=this.change, lander=ch.userData.lander; const wp=lander.getWorldPosition(new THREE.Vector3()); ch.remove(lander); this.scene.add(lander); lander.position.copy(wp); ch.remove(this.plumeC); lander.add(this.plumeC); this._landerStart=wp.clone(); }
  _showSuccess(){
    if(document.getElementById('mission-success')) return;
    const d=document.createElement('div'); d.id='mission-success';
    d.innerHTML=`<div style="position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:80;display:flex;align-items:center;justify-content:center">
      <div style="background:#0c1224;border:1px solid rgba(255,180,84,.4);border-radius:14px;padding:26px 30px;text-align:center;max-width:88vw">
        <div style="font-size:44px">🌕</div><h3 style="color:#ffb454;margin:10px 0 6px;font-size:20px">登录月球成功</h3>
        <p style="color:#9aa7bd;font-size:14px;margin-bottom:16px">嫦娥已安全着陆月球。</p>
        <button id="mission-ok" style="padding:10px 26px;border-radius:10px;border:none;background:#ffb454;color:#1a1208;font-size:15px;cursor:pointer;font-weight:600">确定</button>
      </div></div>`;
    document.body.appendChild(d);
    document.getElementById('mission-ok').addEventListener('click',()=>this.finish());
  }
  _syncBtn(){ const b=document.getElementById('vt-mission'); if(b) b.textContent=this.active?'⏹ 停止任务':'🚀 嫦娥奔月'; const mb=document.getElementById('m-mission'); if(mb) mb.textContent=this.active?'⏹':'🚀'; }

  finish(){ this._teardown(); bus.emit('toast',{text:'嫦娥奔月演示完成',level:'ok'}); }
  cancel(){ this._teardown(); }
  _teardown(){
    const ctx=this.ctx, wasActive=this.active;
    if(this._saved.rate>=0) ctx.clock.setRate(this._saved.rate);
    ctx.clock.running=this._saved.running;
    if(this._saved.labelsOn&&ctx.orbitView&&!ctx.orbitView.labelsVisible) ctx.orbitView.toggleLabels();
    if(ctx.labelRenderer) ctx.labelRenderer.domElement.style.display=this._labelDisp==='none'?'none':'';
    if(ctx.cameraRig&&ctx.cameraRig.controls) ctx.cameraRig.controls.enabled=this._saved.controlsOn!==false;
    ctx.camera.up.set(0,1,0);
    if(wasActive&&ctx.cameraRig&&ctx.cameraRig.reset) ctx.cameraRig.reset();
    if(this._scene){ this._scene.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{ if(m.map) m.map.dispose(); m.dispose(); }); } }); this._scene=null; }
    this.rocket=this.change=this.wenchang=this.linePark=this.lineTransfer=this.lineLunar=null;
    ['mission-hud','mission-success'].forEach(id=>{ const el=document.getElementById(id); if(el) el.remove(); });
    document.body.classList.remove('mission-active'); this.ctx.missionActive=false;
    this.active=false; this.phase='IDLE'; this.pt=0; this._built=false;
    this._syncBtn(); bus.emit('mission.end');
  }
}
