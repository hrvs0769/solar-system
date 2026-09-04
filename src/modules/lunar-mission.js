// 嫦娥奔月任务（镜头叙事版）：地面发射台倒计时点火 → 平视仰视升空 → 高空俯视 → 太空俯瞰地球 →
// 地月转移 → 绕月多圈 → 月球地表视角观测登月器着陆。两体开普勒弹道（拼接圆锥）。
import * as THREE from 'three';
import { bus } from '../sim/bus.js';

const R_E = 0.0511, R_MOON = 0.02, D_EM = 0.16, R_PARK = 0.064, R_LUNAR = 0.028;
const A = 0.112, ECC = 0.429;
const LUNAR_ORBITS = 3;
// 阶段时长
const DUR = { COUNTDOWN:3.2, IGNITION:1.6, LIFTOFF:6, AERIAL:3.2, STAGE_SEP:2, EARTH_ORBIT:6, TRANSFER:10, LOI:2, LUNAR_ORBIT:10, LANDING:7 };
const PHASE_NAME = { COUNTDOWN:'发射倒计时', IGNITION:'点火', LIFTOFF:'升空', AERIAL:'火箭升空',
  STAGE_SEP:'分级脱离', EARTH_ORBIT:'进入太空轨道', TRANSFER:'地月转移', LOI:'月球制动', LUNAR_ORBIT:'绕月飞行', LANDING:'登月下降', LANDED:'着陆月球' };

// —— 纹理 ——
function texSolar(){ const c=document.createElement('canvas'); c.width=128; c.height=64; const g=c.getContext('2d');
  g.fillStyle='#06132e'; g.fillRect(0,0,128,64);
  for(let y=0;y<4;y++) for(let x=0;x<8;x++){ const b=0.26+0.16*((x*7+y*13)%9)/9;
    g.fillStyle=`rgb(${Math.round(18+b*50)},${Math.round(45+b*70)},${Math.round(110+b*95)})`; g.fillRect(x*16+1,y*16+1,14,14); }
  g.strokeStyle='rgba(210,230,255,.3)'; g.lineWidth=1;
  for(let x=0;x<=8;x++){ g.beginPath(); g.moveTo(x*16,0); g.lineTo(x*16,64); g.stroke(); }
  for(let y=0;y<=4;y++){ g.beginPath(); g.moveTo(0,y*16); g.lineTo(128,y*16); g.stroke(); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
function texGold(){ const c=document.createElement('canvas'); c.width=64; c.height=64; const g=c.getContext('2d');
  g.fillStyle='#8a6a1e'; g.fillRect(0,0,64,64);
  for(let y=0;y<64;y+=2){ const b=0.72+0.28*((y*31)%9)/9;
    g.fillStyle=`rgb(${Math.round(190*b)},${Math.round(140*b)},${Math.round(45*b)})`; g.fillRect(0,y,64,2); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; return t; }

// —— 模型 ——
function buildRocket(){
  const g=new THREE.Group();
  const white=new THREE.MeshStandardMaterial({color:0xf0f1f3, metalness:.2, roughness:.5});
  const white2=new THREE.MeshStandardMaterial({color:0xd8dade, metalness:.3, roughness:.5});
  const gold=new THREE.MeshStandardMaterial({map:texGold(), metalness:.7, roughness:.45});
  const core=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.055,20), white); core.position.y=0.02; g.add(core);
  const up=new THREE.Mesh(new THREE.CylinderGeometry(0.005,0.005,0.03,20), white2); up.position.y=0.062; g.add(up);
  const fairing=new THREE.Mesh(new THREE.ConeGeometry(0.005,0.025,20), white); fairing.position.y=0.093; g.add(fairing);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(0.0062,0.0062,0.005,20), gold); band.position.y=0.048; g.add(band);
  const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.006,0.008,16), new THREE.MeshStandardMaterial({color:0x3a3d42, metalness:.8, roughness:.5})); nozzle.position.y=-0.014; g.add(nozzle);
  for(let i=0;i<4;i++){ const fin=new THREE.Mesh(new THREE.BoxGeometry(0.001,0.012,0.01), white2);
    fin.position.set(Math.cos(i*Math.PI/2)*0.0075, -0.008, Math.sin(i*Math.PI/2)*0.0075); g.add(fin); }
  // 支撑架（发射台）
  const stand=new THREE.Mesh(new THREE.CylinderGeometry(0.0085,0.010,0.006,20), white2); stand.position.y=-0.019; g.add(stand);
  return g;
}
function buildBoosters(){
  const g=new THREE.Group();
  const white=new THREE.MeshStandardMaterial({color:0xe8eaee, metalness:.25, roughness:.5});
  [[-1],[1]].forEach(([s])=>{
    const b=new THREE.Mesh(new THREE.CylinderGeometry(0.0035,0.0035,0.045,14), white); b.position.x=s*0.008; b.position.y=0.014; g.add(b);
    const tip=new THREE.Mesh(new THREE.ConeGeometry(0.0035,0.012,14), white); tip.position.x=s*0.008; tip.position.y=0.042; g.add(tip);
    const noz=new THREE.Mesh(new THREE.CylinderGeometry(0.0026,0.0036,0.006,12), new THREE.MeshStandardMaterial({color:0x3a3d42, metalness:.8, roughness:.5})); noz.position.x=s*0.008; noz.position.y=-0.004; g.add(noz);
  });
  return g;
}
function buildChange(){
  const g=new THREE.Group();
  const gold=new THREE.MeshStandardMaterial({map:texGold(), metalness:.7, roughness:.45});
  const metal=new THREE.MeshStandardMaterial({color:0xb9bec7, metalness:.85, roughness:.35});
  const solar=new THREE.MeshStandardMaterial({map:texSolar(), metalness:.35, roughness:.55, side:THREE.DoubleSide});
  const svc=new THREE.Mesh(new THREE.BoxGeometry(0.012,0.012,0.014), gold); svc.position.y=0.012; g.add(svc);
  const dish=new THREE.Mesh(new THREE.SphereGeometry(0.006,16,10,0,Math.PI*2,0,Math.PI*0.4), metal); dish.rotation.x=-Math.PI/2; dish.position.set(0,0.022,0); g.add(dish);
  [[-1],[1]].forEach(([s])=>{ const wing=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.0015,0.008), solar); wing.position.x=s*0.016; wing.position.y=0.012; g.add(wing); });
  const lander=new THREE.Group(); lander.name='lander'; lander.position.y=-0.012;
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.011,0.009,0.011), metal); lander.add(body);
  const top=new THREE.Mesh(new THREE.ConeGeometry(0.006,0.008,10), gold); top.position.y=0.008; lander.add(top);
  for(let i=0;i<4;i++){ const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.001,0.001,0.012,8), metal);
    leg.position.set(Math.cos(i*Math.PI/2+Math.PI/4)*0.009, -0.01, Math.sin(i*Math.PI/2+Math.PI/4)*0.009); leg.rotation.z=Math.cos(i*Math.PI/2+Math.PI/4)*0.6; leg.rotation.x=Math.sin(i*Math.PI/2+Math.PI/4)*0.6; lander.add(leg); }
  g.add(lander);
  g.userData.lander=lander; g.userData.svc=svc;
  return g;
}
// 发射塔架（龙门/勤务塔：双柱+横梁）
function buildTower(){
  const g=new THREE.Group();
  const m=new THREE.MeshStandardMaterial({color:0x9aa2ae, metalness:.7, roughness:.5});
  const H=0.115;
  [[-0.009,-0.006],[0.009,-0.006],[-0.009,0.006],[0.009,0.006]].forEach(([x,z])=>{
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.0018,0.0018,H,8), m); leg.position.set(x,H/2,z); g.add(leg);
  });
  for(let i=1;i<7;i++){ const y=i/6*H;
    const barX=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.0015,0.0015), m); barX.position.y=y; g.add(barX);
    const barZ=new THREE.Mesh(new THREE.BoxGeometry(0.0015,0.0015,0.013), m); barZ.position.y=y; g.add(barZ); }
  return g;
}
// 发射台底座 + 平面地面（让发射看起来在平地）
function buildPad(){
  const g=new THREE.Group();
  const m=new THREE.MeshStandardMaterial({color:0x707a86, metalness:.6, roughness:.6});
  const base=new THREE.Mesh(new THREE.CylinderGeometry(0.011,0.014,0.005,20), m); g.add(base);
  const ground=new THREE.Mesh(new THREE.CircleGeometry(0.10, 40), new THREE.MeshStandardMaterial({color:0x8a7f6a, roughness:.95, metalness:0}));
  ground.rotation.x=-Math.PI/2; ground.position.y=-0.0028; g.add(ground);
  g.userData.ground=ground;
  return g;
}
// 尾焰（加色锥）
function buildPlume(){
  const g=new THREE.Group();
  const cone=new THREE.Mesh(new THREE.ConeGeometry(0.004,0.016,16),
    new THREE.MeshBasicMaterial({color:0xffa64d, transparent:true, opacity:0.85, blending:THREE.AdditiveBlending, depthWrite:false}));
  cone.rotation.x=Math.PI; cone.position.y=-0.018; g.add(cone);
  g.userData.cone=cone; g.visible=false; return g;
}
// 点火盐雾（白色水雾粒子，从导流槽喷出）
function buildSteam(){
  const N=140, geo=new THREE.BufferGeometry(), pos=new Float32Array(N*3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const mat=new THREE.PointsMaterial({color:0xdfe8f2, size:0.006, transparent:true, opacity:0, depthWrite:false, sizeAttenuation:true});
  const pts=new THREE.Points(geo, mat); pts.visible=false; pts.userData={ parts:[] };
  return pts;
}

export class LunarMission {
  constructor(ctx){
    this.ctx=ctx; this.active=false; this.phase='IDLE'; this.pt=0; this._built=false;
    this._saved={ rate:-1, running:true, moonMode:null, controlsOn:true, labelsOn:true };
    this._cam={ pos:new THREE.Vector3(), tgt:new THREE.Vector3(), up:new THREE.Vector3(0,1,0) };
  }
  get earthPos(){ const p=this.ctx.orbitView&&this.ctx.orbitView.pos?this.ctx.orbitView.pos.earth:null; return p?new THREE.Vector3(p.x,p.y,p.z):new THREE.Vector3(); }

  start(){ if(this.active) return; try{ this._doStart(); }catch(err){ console.error('mission start error', err); try{ this._teardown(); }catch(e){} } }
  _doStart(){
    const ctx=this.ctx;
    this.ctx.missionActive=true; document.body.classList.add('mission-active');
    this._saved.rate=ctx.clock.rateIndex; this._saved.running=ctx.clock.running; ctx.clock.running=false;
    this._saved.moonMode=ctx.orbitView.moonMode; ctx.orbitView.setMoonMode('schematic');
    // 隐藏行星标签（特写时"海王星/土星"标签碍眼），结束恢复
    this._saved.labelsOn=ctx.orbitView.labelsVisible; if(this._saved.labelsOn) ctx.orbitView.toggleLabels();
    this._saved.controlsOn=ctx.cameraRig.controls.enabled; ctx.cameraRig.controls.enabled=false;
    const g=ctx.astro.moonGeoScene(ctx.clock.jd); const len=Math.hypot(g.x,g.y,g.z)||1;
    this._u=new THREE.Vector3(g.x/len,g.y/len,g.z/len).normalize();
    this._v=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), this._u); if(this._v.lengthSq()<1e-8) this._v.set(0,0,1); this._v.normalize();
    this._w=new THREE.Vector3().crossVectors(this._u, this._v).normalize();
    this._E=this.earthPos; this._M=this._E.clone().addScaledVector(this._u, D_EM);
    ctx.camera.up.copy(this._w);
    this.active=true; this.ctx.missionActive=true;
    this._build(); this._buildUi(); this._setPhase('COUNTDOWN');
    bus.emit('mission.start'); this._syncBtn();
  }

  _build(){
    const scene=this.ctx.system.scene;
    this.rocket=buildRocket(); this.boosters=buildBoosters(); this.change=buildChange();
    this.tower=buildTower(); this.pad=buildPad(); this.steam=buildSteam();
    this.plumeR=buildPlume(); this.plumeC=buildPlume();
    this.rocket.add(this.plumeR); this.change.add(this.plumeC);
    [this.rocket,this.boosters,this.change,this.tower,this.pad,this.steam].forEach(o=>{ o.visible=false; scene.add(o); });
    const mkLine=(fn,c)=>{ const pts=[]; for(let i=0;i<=180;i++) pts.push(fn(i/180)); const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color:c,transparent:true,opacity:0.55})); l.visible=false; scene.add(l); return l; };
    this.linePark=mkLine(k=>this._parkPos(k*Math.PI*2),0x7fd0ff);
    this.lineTransfer=mkLine(k=>this._transferPos(k*Math.PI),0xffd54a);
    this.lineLunar=mkLine(k=>this._lunarPos(k*Math.PI*2),0x8fd0ff);
    this._built=true;
    this._padPosC=this._E.clone().addScaledVector(this._u,-R_E); // 发射点（地球表面）
    this._upPad=this._u.clone().negate();
  }

  // —— 轨道位置 ——
  _parkPos(ph){ return this._E.clone().addScaledVector(this._u,-R_PARK*Math.cos(ph)).addScaledVector(this._v,R_PARK*Math.sin(ph)); }
  _transferR(nu){ return A*(1-ECC*ECC)/(1+ECC*Math.cos(nu)); }
  _transferPos(nu){ const r=this._transferR(nu); return this._E.clone().addScaledVector(this._u,-r*Math.cos(nu)).addScaledVector(this._v,r*Math.sin(nu)); }
  _lunarPos(la){ return this._M.clone().addScaledVector(this._u,-R_LUNAR*Math.cos(la)).addScaledVector(this._v,R_LUNAR*Math.sin(la)); }
  _kepler(M,e){ let E=M; for(let i=0;i<10;i++){ const f=E-e*Math.sin(E)-M, fp=1-e*Math.cos(E); if(Math.abs(f)<1e-9) break; E-=f/fp; } return E; }
  _nuFromM(M){ const E=this._kepler(M,ECC); return 2*Math.atan2(Math.sqrt(1+ECC)*Math.sin(E/2), Math.sqrt(1-ECC)*Math.cos(E/2)); }

  _setPhase(p){ this.phase=p; this.pt=0; this._enterPhase(p); }
  _enterPhase(p){
    const scene=this.ctx.system.scene;
    if(p==='COUNTDOWN'){ [this.rocket,this.boosters,this.tower,this.pad].forEach(o=>o.visible=true); this.change.visible=false;
      const pad=this._padPosC, up=this._upPad;
      this.rocket.position.copy(pad).addScaledVector(up,0.0); this.rocket.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), up);
      this.boosters.position.copy(this.rocket.position); this.boosters.quaternion.copy(this.rocket.quaternion);
      this.tower.position.copy(pad).addScaledVector(this._v,0.02); this.pad.position.copy(pad);
      this.plumeR.visible=false; this.steam.visible=false;
    }
    if(p==='IGNITION'){ this.plumeR.visible=true; this.steam.visible=true; this._spawnSteam(); }
    if(p==='LIFTOFF'){ this.plumeR.visible=true; this.tower.visible=false; }
    if(p==='AERIAL'){ this.boosters.visible=true; }
    if(p==='STAGE_SEP'){ this.boosters.userData.fly={ t:0 }; this.plumeR.visible=false; }
    if(p==='EARTH_ORBIT'){ this.boosters.visible=false; this.tower.visible=false; this.pad.visible=false;
      this.linePark.visible=true; this.lineTransfer.visible=false; this.lineLunar.visible=false; }
    if(p==='TRANSFER'){ this.change.visible=true; this.rocket.visible=false; this.boosters.visible=false;
      this.change.position.copy(this._transferPos(0)); this.change.userData.svc.visible=true; this.change.userData.lander.visible=true;
      this.change.userData.lander.position.set(0,-0.012,0);
      this.lineTransfer.visible=true; this.linePark.visible=false; }
    if(p==='LOI'){ this.plumeC.visible=true; this.lineTransfer.visible=true; this.lineLunar.visible=true; }
    if(p==='LUNAR_ORBIT'){ this.plumeC.visible=false; this._lam=0; this.lineLunar.visible=true; this.lineTransfer.visible=false; }
    if(p==='LANDING'){
      const ch=this.change, lander=ch.userData.lander;
      const wp=lander.getWorldPosition(new THREE.Vector3());
      ch.remove(lander); scene.add(lander); lander.position.copy(wp); lander.quaternion.copy(ch.quaternion);
      ch.remove(this.plumeC); lander.add(this.plumeC);
      this._landerStart=wp.clone(); this.plumeC.visible=true;
    }
    if(p==='LANDED'){ this.plumeC.visible=false; this._showSuccess(); }
  }
  _spawnSteam(){
    const pts=this.steam, N=140, arr=pts.geometry.attributes.position.array;
    pts.userData.parts=[];
    for(let i=0;i<N;i++){ const a=Math.random()*Math.PI*2, r=0.004+Math.random()*0.012;
      const x=this._padPosC.x + Math.cos(a)*r*this._v.x + Math.sin(a)*r*this._u.x;
      const y=this._padPosC.y + Math.cos(a)*r*this._v.y + Math.sin(a)*r*this._u.y;
      const z=this._padPosC.z + Math.cos(a)*r*this._v.z + Math.sin(a)*r*this._u.z;
      pts.userData.parts.push({ x,y,z, vx:(Math.random()-0.5)*0.02, vy:0.01+Math.random()*0.03, vz:(Math.random()-0.5)*0.02, life:1 });
      arr[i*3]=x; arr[i*3+1]=y; arr[i*3+2]=z; }
    pts.geometry.attributes.position.needsUpdate=true; pts.material.opacity=0.8;
  }
  _updateSteam(dt){
    const pts=this.steam, arr=pts.geometry.attributes.position.array;
    if(!pts.visible) return;
    let alive=0;
    pts.userData.parts.forEach((p,i)=>{ p.life-=dt*0.8; p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt; p.vy+=0.01*dt; p.vx*=0.98; p.vz*=0.98;
      if(p.life>0){ alive++; arr[i*3]=p.x; arr[i*3+1]=p.y; arr[i*3+2]=p.z; } else { arr[i*3+1]=-999; } });
    pts.geometry.attributes.position.needsUpdate=true;
    pts.material.opacity=Math.max(0, alive/140*0.8);
    if(alive===0) pts.visible=false;
  }

  update(dt){
    if(!this.active) return;
    this.pt+=dt;
    const dur=DUR[this.phase]||1; const k=Math.min(this.pt/dur,1);
    const ease=t=>t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2; const ke=ease(k);
    const pad=this._padPosC, up=this._upPad, u=this._u, v=this._v;
    switch(this.phase){
      case 'COUNTDOWN': {
        this.rocket.position.copy(pad).addScaledVector(up,0.0);
        const shake=Math.sin(this.pt*30)*0.0002; this.rocket.position.addScaledVector(v,shake);
        this.boosters.position.copy(this.rocket.position); this.boosters.quaternion.copy(this.rocket.quaternion);
        this._setCountdown();
        break; }
      case 'IGNITION': {
        this.rocket.position.copy(pad).addScaledVector(up,0.0);
        this.boosters.position.copy(this.rocket.position); this.boosters.quaternion.copy(this.rocket.quaternion);
        this.plumeR.userData.cone.scale.setScalar(1+0.4*Math.sin(this.pt*30));
        this._updateSteam(dt);
        break; }
      case 'LIFTOFF': {
        // 火箭从发射台上缓慢升空（径向 -u + 轻微向 v 的弧）
        const target=pad.clone().addScaledVector(up,0.0).lerp(this._parkPos(0), ke*0.55);
        this.rocket.position.copy(target).addScaledVector(v, Math.sin(Math.PI*k)*0.02);
        this._pointUp(this.rocket, up.clone().lerp(v,0.35*ke));
        this.boosters.position.copy(this.rocket.position); this.boosters.quaternion.copy(this.rocket.quaternion);
        this.plumeR.userData.cone.scale.setScalar(0.8+0.3*Math.sin(this.pt*25));
        break; }
      case 'AERIAL': {
        const target=pad.clone().addScaledVector(up,0.0).lerp(this._parkPos(0), 0.55+ke*0.45);
        this.rocket.position.copy(target).addScaledVector(v,Math.sin(Math.PI*k)*0.02);
        this._pointUp(this.rocket, up.clone().lerp(v,0.5*ke));
        this.boosters.position.copy(this.rocket.position); this.boosters.quaternion.copy(this.rocket.quaternion);
        this.plumeR.userData.cone.scale.setScalar(0.8);
        break; }
      case 'STAGE_SEP': {
        this.rocket.position.copy(this._parkPos(0));
        this._pointUp(this.rocket, v);
        const fb=this.boosters.userData.fly;
        if(fb){ fb.t+=dt; const drop=this.rocket.position.clone();
          this.boosters.position.copy(drop).addScaledVector(v,-fb.t*0.03*(1+fb.t*2)).addScaledVector(this._w,-fb.t*0.012);
          this.boosters.rotation.z=fb.t*1.4;
          this.boosters.children.forEach(c=>{ c.material=c.material.clone(); c.material.transparent=true; c.material.opacity=Math.max(0,1-fb.t); }); }
        break; }
      case 'EARTH_ORBIT': {
        this.rocket.position.copy(this._parkPos(k*Math.PI*2));
        this._pointUp(this.rocket, this._tangentPark(k*Math.PI*2));
        break; }
      case 'TRANSFER': {
        const M=Math.PI*ke, nu=this._nuFromM(M);
        this.change.position.copy(this._transferPos(nu));
        const vel=this._transferPos(nu).clone().sub(this._transferPos(Math.max(nu-0.02,0.001))).normalize();
        this._pointUp(this.change, vel);
        break; }
      case 'LOI': {
        this.change.position.copy(this._M).lerp(this._lunarPos(0), ke);
        this._pointUp(this.change, v);
        this.plumeC.userData.cone.scale.setScalar(1+0.3*Math.sin(this.pt*25));
        break; }
      case 'LUNAR_ORBIT': {
        this._lam=k*Math.PI*2*LUNAR_ORBITS;
        this.change.position.copy(this._lunarPos(this._lam));
        this._pointUp(this.change, this._tangentLunar(this._lam));
        break; }
      case 'LANDING': {
        this._lam+=dt*0.5;
        this.change.position.copy(this._lunarPos(this._lam));
        this._pointUp(this.change, this._tangentLunar(this._lam));
        const lander=this.change.userData.lander;
        const to=this._M.clone().addScaledVector(this._u,-R_MOON*0.95);
        lander.position.copy(this._landerStart).lerp(to, ke);
        const upMoon=this._M.clone().sub(to).normalize();   // 月球表面"上"
        this._pointUp(lander, upMoon);
        this.plumeC.userData.cone.scale.setScalar(0.8+0.3*Math.sin(this.pt*20));
        break; }
      case 'LANDED': {
        this._lam+=dt*0.4; this.change.position.copy(this._lunarPos(this._lam));
        this._pointUp(this.change, this._tangentLunar(this._lam));
        const lander=this.change.userData.lander;
        lander.position.copy(this._M.clone().addScaledVector(this._u,-R_MOON*0.95));
        this._pointUp(lander, this._M.clone().sub(lander.position).normalize());
        break; }
    }
    const order=['COUNTDOWN','IGNITION','LIFTOFF','AERIAL','STAGE_SEP','EARTH_ORBIT','TRANSFER','LOI','LUNAR_ORBIT','LANDING','LANDED'];
    if(k>=1 && this.phase!=='LANDED'){ const i=order.indexOf(this.phase); if(i>=0 && i<order.length-1) this._setPhase(order[i+1]); }
    this._updateCamera(dt);
    this._updateHud();
  }

  _tangentPark(ph){ return this._v.clone().multiplyScalar(Math.cos(ph)).addScaledVector(this._u,Math.sin(ph)).normalize(); }
  _tangentLunar(la){ return this._v.clone().multiplyScalar(Math.cos(la)).addScaledVector(this._u,Math.sin(la)).normalize(); }
  _pointUp(obj,dir){ if(!obj||!dir||dir.lengthSq()<1e-10) return; obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize()); }

  // —— 镜头叙事：每阶段一个"机位"，平滑过渡 ——
  _camDesired(){
    const E=this._E, u=this._u, v=this._v, w=this._w, pad=this._padPosC, upPad=this._upPad;
    let pos, tgt, up=w;
    const rocket=this.rocket?this.rocket.position:pad.clone();
    switch(this.phase){
      case 'COUNTDOWN': case 'IGNITION': {
        // 地面人类视角：很近，从发射台侧看火箭（仰视）
        pos=pad.clone().addScaledVector(v,0.15).addScaledVector(upPad,0.012).addScaledVector(u,-0.02);
        tgt=pad.clone().addScaledVector(upPad,0.082);
        up=upPad; break; }
      case 'LIFTOFF': {
        // 平视→仰视：相机在台边，随火箭升高而视线抬升
        pos=pad.clone().addScaledVector(v,0.165).addScaledVector(upPad,0.018).addScaledVector(u,-0.035);
        tgt=rocket.clone(); up=upPad; break; }
      case 'AERIAL': case 'STAGE_SEP': {
        // 高空俯视：在台上方，俯视火箭与地面
        pos=pad.clone().addScaledVector(upPad,0.20).addScaledVector(v,0.045).addScaledVector(u,-0.02);
        tgt=rocket.clone(); up=upPad; break; }
      case 'EARTH_ORBIT': {
        // 太空俯瞰地球（回到"全景"视角），舱体绕地球
        pos=E.clone().addScaledVector(w,0.26).addScaledVector(v,0.09).addScaledVector(u,0.03);
        tgt=E.clone(); up=w; break; }
      case 'TRANSFER': {
        const off=w.clone().multiplyScalar(0.7).addScaledVector(v,0.35).addScaledVector(u,0.25).normalize();
        pos=this.change.position.clone().addScaledVector(off,0.24); tgt=this.change.position; up=w; break; }
      case 'LOI': case 'LUNAR_ORBIT': {
        const off=w.clone().multiplyScalar(0.85).addScaledVector(v,0.35).addScaledVector(u,0.2).normalize();
        pos=this.change.position.clone().addScaledVector(off,0.08); tgt=this.change.position; up=w; break; }
      case 'LANDING': case 'LANDED': {
        // 月球地表观察视角：站在月面旁，仰视登月器缓缓降落
        const lander=this.change&&this.change.userData&&this.change.userData.lander?this.change.userData.lander:this.change;
        const site=this._M.clone().addScaledVector(u,-R_MOON*0.95);
        const upMoon=u.clone().negate();
        pos=site.clone().addScaledVector(v,0.038).addScaledVector(upMoon,0.008).addScaledVector(u,-0.006);
        tgt=lander.position.clone(); up=upMoon; break; }
      default: pos=E.clone().addScaledVector(w,0.3); tgt=E.clone(); up=w;
    }
    return {pos,tgt,up};
  }
  _updateCamera(dt){
    const d=this._camDesired(), cam=this.ctx.camera;
    const s=Math.min(1, dt*2.6);   // 平滑过渡（丝滑）
    this._cam.pos.lerp(d.pos, s); this._cam.tgt.lerp(d.tgt, s); this._cam.up.lerp(d.up, s);
    cam.position.copy(this._cam.pos); cam.up.copy(this._cam.up).normalize(); cam.lookAt(this._cam.tgt);
  }

  // —— UI：HUD + 倒计时 + 成功弹窗 ——
  _buildUi(){
    if(!document.getElementById('mission-hud')){
      const h=document.createElement('div'); h.id='mission-hud';
      h.innerHTML=`<div style="position:fixed;left:50%;top:60px;transform:translateX(-50%);z-index:60;background:var(--panel-solid,#0c1224);border:1px solid rgba(255,180,84,.35);border-radius:12px;padding:10px 18px;color:#e8ecf5;font-size:15px;text-align:center;pointer-events:auto">
        <div id="mission-phase" style="font-weight:600;color:#ffb454">🚀 发射倒计时</div>
        <div id="mission-sub" style="font-size:12px;color:#9aa7bd;margin-top:3px">—</div>
        <div id="mission-count" style="font-size:26px;font-weight:700;color:#ffd54a;margin-top:4px"></div>
        <button id="mission-stop" style="margin-top:8px;padding:6px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#e8ecf5;cursor:pointer">⏹ 停止任务</button>
      </div>`;
      document.body.appendChild(h);
      document.getElementById('mission-stop').addEventListener('click',()=>this.cancel());
    }
    document.getElementById('mission-hud').style.display='block';
  }
  _setCountdown(){
    const el=document.getElementById('mission-count'); if(!el) return;
    const remain=Math.ceil(DUR.COUNTDOWN-this.pt);
    el.textContent = remain>0 ? String(remain) : '点火!';
  }
  _updateHud(){
    const p=document.getElementById('mission-phase'), s=document.getElementById('mission-sub');
    if(!p) return; p.textContent=PHASE_NAME[this.phase]||this.phase;
    let sub='';
    if(this.phase==='TRANSFER'){ const k=Math.min(this.pt/DUR.TRANSFER,1); sub=`地月转移 ${Math.round(k*100)}% · 距月球 ${(D_EM*(1-k)).toFixed(2)} AU`; }
    else if(this.phase==='LUNAR_ORBIT'){ sub=`绕月第 ${Math.floor(Math.min(this.pt/DUR.LUNAR_ORBIT,1)*LUNAR_ORBITS)+1}/${LUNAR_ORBITS} 圈`; }
    else if(this.phase==='LANDING'){ const k=Math.min(this.pt/DUR.LANDING,1); sub=`登月器下降 ${Math.round(k*100)}%`; }
    else if(this.phase==='LANDED'){ sub='已在月球表面'; }
    else if(this.phase==='EARTH_ORBIT'){ sub='围绕地球飞行'; }
    if(this.phase!=='COUNTDOWN'&&this.phase!=='IGNITION'){ const c=document.getElementById('mission-count'); if(c) c.textContent=''; }
    s.textContent=sub;
  }
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
    if(this._saved.moonMode&&ctx.orbitView) ctx.orbitView.setMoonMode(this._saved.moonMode);
    if(this._saved.labelsOn&&ctx.orbitView&&!ctx.orbitView.labelsVisible) ctx.orbitView.toggleLabels();
    if(ctx.cameraRig&&ctx.cameraRig.controls) ctx.cameraRig.controls.enabled=this._saved.controlsOn!==false;
    ctx.camera.up.set(0,1,0);
    if(wasActive&&ctx.cameraRig&&ctx.cameraRig.reset) ctx.cameraRig.reset();   // 复位到全景机位（避免太阳被放大）
    const scene=this.ctx.system.scene;
    const lander=this.change&&this.change.userData?this.change.userData.lander:null;
    [this.rocket,this.boosters,this.change,lander,this.tower,this.pad,this.steam,this.linePark,this.lineTransfer,this.lineLunar].forEach(o=>{ if(o) scene.remove(o); });
    this.rocket=this.boosters=this.change=this.tower=this.pad=this.steam=this.linePark=this.lineTransfer=this.lineLunar=null;
    this._built=false;
    ['mission-hud','mission-success'].forEach(id=>{ const el=document.getElementById(id); if(el) el.remove(); });
    document.body.classList.remove('mission-active'); this.ctx.missionActive=false;
    this.active=false; this.phase='IDLE'; this.pt=0;
    this._syncBtn(); bus.emit('mission.end');
  }
}
