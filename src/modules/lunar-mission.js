// 嫦娥奔月任务：全景下"火箭发射→分级→地球停泊→霍曼转移→绕月多圈→登月"叙事演示
// 物理：两体开普勒（停泊圆 + 霍曼转移椭圆(开普勒方程数值解) + 月球停泊圆 + 缓动下降），拼接圆锥。
import * as THREE from 'three';
import { bus } from '../sim/bus.js';

const R_E = 0.0511;      // 地球视觉半径(AU)
const R_MOON = 0.02;     // 月球视觉半径(AU)
const D_EM = 0.16;       // 地月示意距离(AU)，= 现有 MOON_ORBIT_SCHEMATIC
const R_PARK = 0.064;    // 地球停泊轨道半径
const R_LUNAR = 0.028;   // 月球停泊轨道半径
const A = 0.112;         // 转移椭圆半长轴
const ECC = 0.429;       // 转移椭圆离心率
const LUNAR_ORBITS = 3;  // 绕月圈数
const DUR = { LAUNCH:1.4, ASCENT:4.5, STAGE_SEP:1.6, EARTH_ORBIT:5, TLI:1.6, TRANSFER:11, LOI:1.6, LUNAR_ORBIT:11, DESCENT:5.5 };

const PHASE_NAME = { LAUNCH:'🚀 点火', ASCENT:'升空', STAGE_SEP:'分级脱离', EARTH_ORBIT:'进入地球轨道', TLI:'点火奔月', TRANSFER:'地月转移', LOI:'月球制动', LUNAR_ORBIT:'绕月飞行', DESCENT:'动力下降', LANDED:'着陆月球' };

// —— 金属/金箔/太阳能纹理（与卫星模块一致风格）——
function texSolar(){
  const c=document.createElement('canvas'); c.width=128; c.height=64; const g=c.getContext('2d');
  g.fillStyle='#06132e'; g.fillRect(0,0,128,64);
  for(let y=0;y<4;y++) for(let x=0;x<8;x++){ const b=0.26+0.16*((x*7+y*13)%9)/9;
    g.fillStyle=`rgb(${Math.round(18+b*50)},${Math.round(45+b*70)},${Math.round(110+b*95)})`; g.fillRect(x*16+1,y*16+1,14,14); }
  g.strokeStyle='rgba(210,230,255,.3)'; g.lineWidth=1;
  for(let x=0;x<=8;x++){ g.beginPath(); g.moveTo(x*16,0); g.lineTo(x*16,64); g.stroke(); }
  for(let y=0;y<=4;y++){ g.beginPath(); g.moveTo(0,y*16); g.lineTo(128,y*16); g.stroke(); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
function texGold(){
  const c=document.createElement('canvas'); c.width=64; c.height=64; const g=c.getContext('2d');
  g.fillStyle='#8a6a1e'; g.fillRect(0,0,64,64);
  for(let y=0;y<64;y+=2){ const b=0.72+0.28*((y*31)%9)/9;
    g.fillStyle=`rgb(${Math.round(190*b)},${Math.round(140*b)},${Math.round(45*b)})`; g.fillRect(0,y,64,2); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}

// —— 模型：运载火箭（芯级+上面级+整流罩，+Y=箭尖）——
function buildRocket(){
  const g=new THREE.Group();
  const white=new THREE.MeshStandardMaterial({color:0xf0f1f3, metalness:.2, roughness:.5});
  const white2=new THREE.MeshStandardMaterial({color:0xd8dade, metalness:.3, roughness:.5});
  const gold=new THREE.MeshStandardMaterial({map:texGold(), metalness:.7, roughness:.45});
  // 芯级
  const core=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.055,20), white); core.position.y=0.02; g.add(core);
  // 上面级
  const up=new THREE.Mesh(new THREE.CylinderGeometry(0.005,0.005,0.03,20), white2); up.position.y=0.062; g.add(up);
  // 整流罩（锥）
  const fairing=new THREE.Mesh(new THREE.ConeGeometry(0.005,0.025,20), white); fairing.position.y=0.09; g.add(fairing);
  // 金色环带
  const band=new THREE.Mesh(new THREE.CylinderGeometry(0.0062,0.0062,0.005,20), gold); band.position.y=0.048; g.add(band);
  // 尾喷口
  const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.006,0.008,16), new THREE.MeshStandardMaterial({color:0x3a3d42, metalness:.8, roughness:.5})); nozzle.position.y=-0.015; g.add(nozzle);
  // 尾翼
  for(let i=0;i<4;i++){ const fin=new THREE.Mesh(new THREE.BoxGeometry(0.001,0.012,0.01), white2);
    fin.position.set(Math.cos(i*Math.PI/2)*0.0075, -0.008, Math.sin(i*Math.PI/2)*0.0075); g.add(fin); }
  return g;
}
// —— 助推器（两组，左右对称）——
function buildBoosters(){
  const g=new THREE.Group();
  const white=new THREE.MeshStandardMaterial({color:0xe8eaee, metalness:.25, roughness:.5});
  [[-1],[1]].forEach(([s])=>{
    const b=new THREE.Mesh(new THREE.CylinderGeometry(0.0035,0.0035,0.045,14), white); b.position.x=s*0.008; b.position.y=0.015; g.add(b);
    const tip=new THREE.Mesh(new THREE.ConeGeometry(0.0035,0.012,14), white); tip.position.x=s*0.008; tip.position.y=0.042; g.add(tip);
    const noz=new THREE.Mesh(new THREE.CylinderGeometry(0.0026,0.0036,0.006,12), new THREE.MeshStandardMaterial({color:0x3a3d42, metalness:.8, roughness:.5})); noz.position.x=s*0.008; noz.position.y=-0.004; g.add(noz);
  });
  return g;
}
// —— 嫦娥探测器（服务舱 + 着陆器；着陆器可分离）——
function buildChange(){
  const g=new THREE.Group();
  const gold=new THREE.MeshStandardMaterial({map:texGold(), metalness:.7, roughness:.45});
  const metal=new THREE.MeshStandardMaterial({color:0xb9bec7, metalness:.85, roughness:.35});
  const solar=new THREE.MeshStandardMaterial({map:texSolar(), metalness:.35, roughness:.55, side:THREE.DoubleSide});
  // 服务舱
  const svc=new THREE.Mesh(new THREE.BoxGeometry(0.012,0.012,0.014), gold); svc.position.y=0.012; g.add(svc);
  const dish=new THREE.Mesh(new THREE.SphereGeometry(0.006,16,10,0,Math.PI*2,0,Math.PI*0.4), metal); dish.rotation.x=-Math.PI/2; dish.position.set(0,0.02,0); g.add(dish);
  [[-1],[1]].forEach(([s])=>{ const wing=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.0015,0.008), solar); wing.position.x=s*0.016; wing.position.y=0.012; g.add(wing); });
  // 着陆器（四腿，可分离）
  const lander=new THREE.Group(); lander.name='lander'; lander.position.y=-0.012;
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.011,0.009,0.011), metal); lander.add(body);
  const top=new THREE.Mesh(new THREE.ConeGeometry(0.006,0.008,10), gold); top.position.y=0.008; lander.add(top);
  for(let i=0;i<4;i++){ const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.001,0.001,0.012,8), metal);
    leg.position.set(Math.cos(i*Math.PI/2+Math.PI/4)*0.009, -0.01, Math.sin(i*Math.PI/2+Math.PI/4)*0.009); leg.rotation.z=Math.cos(i*Math.PI/2+Math.PI/4)*0.6; leg.rotation.x=Math.sin(i*Math.PI/2+Math.PI/4)*0.6; lander.add(leg); }
  g.add(lander);
  g.userData.lander=lander; g.userData.svc=svc;
  return g;
}
// —— 发动机羽流（加色锥 + 粒子）——
function buildPlume(){
  const g=new THREE.Group();
  const cone=new THREE.Mesh(new THREE.ConeGeometry(0.004,0.016,16),
    new THREE.MeshBasicMaterial({color:0xffa64d, transparent:true, opacity:0.85, blending:THREE.AdditiveBlending, depthWrite:false}));
  cone.rotation.x=Math.PI; cone.position.y=-0.018; g.add(cone);
  g.userData.cone=cone; g.visible=false;
  return g;
}

export class LunarMission {
  constructor(ctx){
    this.ctx=ctx; this.active=false; this.phase='IDLE'; this.pt=0; this._built=false;
    this._saved={ rate:-1, running:true, moonMode:null, controlsOn:true };
    this._camera={ pos:new THREE.Vector3(), tgt:new THREE.Vector3() };
  }

  get earthPos(){ const p=this.ctx.orbitView && this.ctx.orbitView.pos ? this.ctx.orbitView.pos.earth : null; return p ? new THREE.Vector3(p.x,p.y,p.z) : new THREE.Vector3(); }

  start(){
    if(this.active) return;
    try{
      this._doStart();
    }catch(err){
      console.error('mission start error', err);
      try{ this._teardown(); }catch(e){}
    }
  }
  _doStart(){
    const ctx=this.ctx;
    this.ctx.missionActive=true; document.body.classList.add('mission-active'); // 先标记任务期，屏蔽无关 toast
    this._saved.rate=ctx.clock.rateIndex; this._saved.running=ctx.clock.running;
    ctx.clock.running=false;                                   // 冻结模拟时钟
    this._saved.moonMode=ctx.orbitView.moonMode; ctx.orbitView.setMoonMode('schematic'); // 强制月球示意
    this._saved.controlsOn=ctx.cameraRig.controls.enabled; ctx.cameraRig.controls.enabled=false;
    // 任务坐标系（月地方向冻结）
    const g=ctx.astro.moonGeoScene(ctx.clock.jd); const len=Math.hypot(g.x,g.y,g.z)||1;
    this._u=new THREE.Vector3(g.x/len, g.y/len, g.z/len).normalize();
    this._v=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), this._u); if(this._v.lengthSq()<1e-8) this._v.set(0,0,1); this._v.normalize();
    this._w=new THREE.Vector3().crossVectors(this._u, this._v).normalize();
    this._E=this.earthPos; this._M=this._E.clone().addScaledVector(this._u, D_EM);
    // 相机初始
    this._camera.pos.copy(this._E).addScaledVector(this._w, 0.10).addScaledVector(this._u, -0.05);
    this._camera.tgt.copy(this._E);
    this.ctx.camera.position.copy(this._camera.pos); this.ctx.camera.up.copy(this._w); this.ctx.camera.lookAt(this._camera.tgt);
    this.active=true;
    this.ctx.missionActive=true;
    this._build();
    this._setPhase('LAUNCH');
    this._buildUi();
    document.body.classList.add('mission-active');
    bus.emit('mission.start');
    this._syncBtn();
  }

  // —— 构建 3D 对象 ——
  _build(){
    const scene=this.ctx.system.scene;
    this.rocket=buildRocket(); this.boosters=buildBoosters(); this.change=buildChange();
    this.plumeR=buildPlume(); this.plumeC=buildPlume();
    this.rocket.add(this.plumeR); this.change.add(this.plumeC);
    this.rocket.visible=false; this.boosters.visible=false; this.change.visible=false;
    scene.add(this.rocket); scene.add(this.boosters); scene.add(this.change);
    // 轨迹线
    const mkLine=(fn,color)=>{ const pts=[]; for(let i=0;i<=180;i++) pts.push(fn(i/180)); const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color,transparent:true,opacity:0.55})); l.visible=false; scene.add(l); return l; };
    this.linePark=mkLine(k=>this._parkPos(k*Math.PI*2), 0x7fd0ff);
    this.lineTransfer=mkLine(k=>this._transferPos(k*Math.PI), 0xffd54a);
    this.lineLunar=mkLine(k=>this._lunarPos(k*Math.PI*2), 0x8fd0ff);
    this._built=true;
  }

  // —— 任务坐标系内的轨道位置 ——
  _parkPos(phi){ return this._E.clone().addScaledVector(this._u,-R_PARK*Math.cos(phi)).addScaledVector(this._v, R_PARK*Math.sin(phi)); }
  _transferR(nu){ return A*(1-ECC*ECC)/(1+ECC*Math.cos(nu)); }
  _transferPos(nu){ const r=this._transferR(nu); return this._E.clone().addScaledVector(this._u,-r*Math.cos(nu)).addScaledVector(this._v, r*Math.sin(nu)); }
  _lunarPos(lam){ return this._M.clone().addScaledVector(this._u,-R_LUNAR*Math.cos(lam)).addScaledVector(this._v, R_LUNAR*Math.sin(lam)); }
  _kepler(M,e){ let E=M; for(let i=0;i<10;i++){ const f=E-e*Math.sin(E)-M, fp=1-e*Math.cos(E); if(Math.abs(f)<1e-9) break; E-=f/fp; } return E; }
  _nuFromM(M){ const E=this._kepler(M,ECC); return 2*Math.atan2(Math.sqrt(1+ECC)*Math.sin(E/2), Math.sqrt(1-ECC)*Math.cos(E/2)); }

  // —— 阶段切换 ——
  _setPhase(p){ this.phase=p; this.pt=0; this._enterPhase(p); }
  _enterPhase(p){
    if(p==='LAUNCH'){ this.rocket.visible=true; this.boosters.visible=true; this.change.visible=false; this.rocket.position.copy(this._padPos()); this.boosters.position.copy(this.rocket.position); this.boosters.quaternion.copy(this.rocket.quaternion); this.plumeR.visible=false; this.boosters.userData.fly=null; }
    if(p==='ASCENT'){ this.plumeR.visible=true; }
    if(p==='STAGE_SEP'){ this.boosters.userData.fly={ t:0, dirs:[[-0.35,-0.06,0.12],[0.35,-0.06,-0.12]] }; }
    if(p==='EARTH_ORBIT'){ this.boosters.visible=false; this.rocket.visible=true; }
    if(p==='TLI'){ this.plumeR.visible=true; }
    if(p==='TRANSFER'){ this.rocket.visible=false; this.change.visible=true; this.plumeC.visible=false; this.change.position.copy(this._transferPos(0)); this.change.userData.svc.visible=true; this.change.userData.lander.visible=true; this.change.userData.lander.position.set(0,-0.012,0); }
    if(p==='LOI'){ this.plumeC.visible=true; }
    if(p==='LUNAR_ORBIT'){ this.plumeC.visible=false; this._lam=0; }
    if(p==='DESCENT'){
      // 着陆器与轨道器分离：轨道器继续绕月，着陆器下降
      const ch=this.change; const lander=ch.userData.lander;
      const wp=lander.getWorldPosition(new THREE.Vector3());
      ch.remove(lander); this.ctx.system.scene.add(lander);
      lander.position.copy(wp); lander.quaternion.copy(ch.quaternion);
      ch.remove(this.plumeC); lander.add(this.plumeC);
      this._landerStart=wp.clone();
      this.plumeC.visible=true;
    }
    if(p==='LANDED'){ this.plumeC.visible=false; this._showSuccess(); }
    // 轨迹线显隐
    this.linePark.visible = ['ASCENT','STAGE_SEP','EARTH_ORBIT','TLI'].includes(p);
    this.lineTransfer.visible = ['TLI','TRANSFER','LOI'].includes(p);
    this.lineLunar.visible = ['LOI','LUNAR_ORBIT','DESCENT'].includes(p);
  }
  _padPos(){ return this._E.clone().addScaledVector(this._u, -R_E); }

  // —— 每帧推进 ——
  update(dt){
    if(!this.active) return;
    this.pt += dt;
    const dur = DUR[this.phase];
    let k = dur>0 ? Math.min(this.pt/dur, 1) : 1;
    const ease = t=>t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
    const ke = ease(k);
    switch(this.phase){
      case 'LAUNCH': {
        // 点火：羽流渐显 + 轻微颤动
        this.rocket.position.copy(this._padPos());
        const shake=Math.sin(this.pt*40)*0.0004*k; this.rocket.position.addScaledVector(this._v, shake);
        this._pointY(this.rocket, this._u.clone().negate());
        this.boosters.position.copy(this.rocket.position); this.boosters.quaternion.copy(this.rocket.quaternion);
        this.plumeR.visible=false; this.plumeR.userData.cone.scale.setScalar(0.3+0.7*k);
        break; }
      case 'ASCENT': {
        // 升空：地表 → 停泊轨道（反月点），轻微向 v 弧
        const p0=this._padPos(), p1=this._parkPos(0);
        const arc=new THREE.Vector3().addScaledVector(this._u, 0).addScaledVector(this._v, Math.sin(Math.PI*k)*0.015);
        this.rocket.position.copy(p0).lerp(p1, ke).add(arc);
        this._pointY(this.rocket, this._u.clone().negate().lerp(this._v, 0.6*k).normalize());
        this.boosters.position.copy(this.rocket.position); this.boosters.quaternion.copy(this.rocket.quaternion);
        this.plumeR.visible=true; this.plumeR.userData.cone.scale.setScalar(0.7+0.5*Math.sin(this.pt*30));
        break; }
      case 'STAGE_SEP': {
        // 分级：助推器分离翻滚坠落淡出，芯级继续
        this.rocket.position.copy(this._parkPos(0));
        this._pointY(this.rocket, this._v);
        const fb=this.boosters.userData.fly;
        if(fb){ fb.t+=dt;
          const drop=this.rocket.position.clone();
          const b1=drop.clone().addScaledVector(this._v, -fb.t*0.02*(1+fb.t*3)).addScaledVector(this._w, -fb.t*0.01).addScaledVector(this._u, -fb.t*0.004);
          this.boosters.position.copy(b1); this.boosters.rotation.x=fb.t*1.2; this.boosters.rotation.z=fb.t*0.7;
          this.boosters.children.forEach(c=>{ if(c.material&&c.material.transparent===false){ c.material=c.material.clone(); c.material.transparent=true; } c.material&&(c.material.opacity=Math.max(0,1-fb.t*1.2)); });
        }
        this.plumeR.visible=true; this.plumeR.userData.cone.scale.setScalar(0.9);
        break; }
      case 'EARTH_ORBIT': {
        // 地球停泊一圈（φ: 0→2π）
        this.rocket.position.copy(this._parkPos(k*Math.PI*2));
        this._pointY(this.rocket, this._tangentPark(k*Math.PI*2));
        this.plumeR.visible=false;
        break; }
      case 'TLI': {
        // 近地点点火（位置保持反月点）
        this.rocket.position.copy(this._parkPos(0));
        this._pointY(this.rocket, this._v);
        this.plumeR.visible=true; this.plumeR.userData.cone.scale.setScalar(1+0.4*Math.sin(this.pt*25));
        break; }
      case 'TRANSFER': {
        // 霍曼转移：M 线性 0→π，解开普勒得真近点角（近日快、远日慢）
        const M=Math.PI*ke; const nu=this._nuFromM(M);
        this.change.position.copy(this._transferPos(nu));
        const nuPrev=Math.max(nu-0.02, 0.001);
        const vel=this._transferPos(nu).clone().sub(this._transferPos(nuPrev)).normalize();
        this._pointY(this.change, vel);
        break; }
      case 'LOI': {
        // 月球制动：从月球中心退入停泊轨道入口
        this.change.position.copy(this._M).lerp(this._lunarPos(0), ke);
        this._pointY(this.change, this._v.clone());
        this.plumeC.visible=true; this.plumeC.userData.cone.scale.setScalar(1+0.3*Math.sin(this.pt*25));
        break; }
      case 'LUNAR_ORBIT': {
        this._lam = k*Math.PI*2*LUNAR_ORBITS;
        this.change.position.copy(this._lunarPos(this._lam));
        this._pointY(this.change, this._tangentLunar(this._lam));
        break; }
      case 'DESCENT': {
        // 轨道器继续绕月；着陆器从停泊轨道缓动下降到月面近侧
        this._lam += dt*0.55;
        this.change.position.copy(this._lunarPos(this._lam));
        this._pointY(this.change, this._tangentLunar(this._lam));
        const lander=this.change.userData.lander;
        const to=this._M.clone().addScaledVector(this._u, -R_MOON*0.95);
        lander.position.copy(this._landerStart).lerp(to, ke);
        this._pointY(lander, this._u.clone().negate());   // 着陆器竖直（腿朝月球）
        this.plumeC.visible=true; this.plumeC.userData.cone.scale.setScalar(0.8+0.3*Math.sin(this.pt*20));
        break; }
      case 'LANDED': {
        this._lam += dt*0.55;
        this.change.position.copy(this._lunarPos(this._lam));
        this._pointY(this.change, this._tangentLunar(this._lam));
        const lander=this.change.userData.lander;
        lander.position.copy(this._M.clone().addScaledVector(this._u, -R_MOON*0.95));
        this._pointY(lander, this._u.clone().negate());
        break; }
    }
    // 阶段推进
    if(k>=1 && this.phase!=='LANDED' && this.phase!=='IDLE'){
      const order=['LAUNCH','ASCENT','STAGE_SEP','EARTH_ORBIT','TLI','TRANSFER','LOI','LUNAR_ORBIT','DESCENT','LANDED'];
      const i=order.indexOf(this.phase); if(i>=0 && i<order.length-1) this._setPhase(order[i+1]);
    }
    this._updateCamera(dt);
    this._updateHud();
  }

  _tangentPark(phi){ return this._v.clone().multiplyScalar(Math.cos(phi)).addScaledVector(this._u, Math.sin(phi)).normalize(); }
  _tangentLunar(lam){ return this._v.clone().multiplyScalar(Math.cos(lam)).addScaledVector(this._u, Math.sin(lam)).normalize(); }
  // 让模型 +Y 对准方向 dir
  _pointY(obj, dir){ if(!obj||!dir||dir.lengthSq()<1e-10) return; obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize()); }

  // —— 相机（跟随，平滑）——
  _updateCamera(dt){
    const cam=this.ctx.camera;
    let tgt, d, dir=this._w.clone().multiplyScalar(0.85).addScaledVector(this._v,0.35).addScaledVector(this._u,0.25).normalize();
    switch(this.phase){
      case 'LAUNCH': case 'ASCENT': case 'STAGE_SEP': tgt=this.rocket.position.clone(); d=0.17; break;
      case 'EARTH_ORBIT': case 'TLI': tgt=this.rocket.position.clone(); d=0.24; break;
      case 'TRANSFER': tgt=this.change.position.clone(); d=0.30; break;
      case 'LOI': case 'LUNAR_ORBIT': tgt=this.change.position.clone(); d=0.10; break;
      case 'DESCENT': case 'LANDED': { const ln=this.change&&this.change.userData?this.change.userData.lander:null; tgt=ln?ln.position.clone():this.change.position.clone(); d=0.06; break; }
      default: tgt=this._E.clone(); d=0.14;
    }
    const wantPos=tgt.clone().addScaledVector(dir, d);
    const s=Math.min(1, dt*3.5);
    this._camera.pos.lerp(wantPos, s); this._camera.tgt.lerp(tgt, s);
    cam.position.copy(this._camera.pos); cam.up.copy(this._w); cam.lookAt(this._camera.tgt);
  }

  // —— HUD + 成功弹窗 ——
  _buildUi(){
    if(!document.getElementById('mission-hud')){
      const h=document.createElement('div'); h.id='mission-hud';
      h.innerHTML=`<div style="position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:60;background:var(--panel-solid,#0c1224);border:1px solid rgba(255,180,84,.35);border-radius:12px;padding:10px 18px;color:#e8ecf5;font-size:15px;text-align:center;pointer-events:auto">
        <div id="mission-phase" style="font-weight:600;color:#ffb454">🚀 点火</div>
        <div id="mission-sub" style="font-size:12px;color:#9aa7bd;margin-top:3px">—</div>
        <button id="mission-stop" style="margin-top:8px;padding:6px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#e8ecf5;cursor:pointer">⏹ 停止任务</button>
      </div>`;
      document.body.appendChild(h);
      document.getElementById('mission-stop').addEventListener('click',()=>this.cancel());
    }
    document.getElementById('mission-hud').style.display='block';
  }
  _updateHud(){
    const p=document.getElementById('mission-phase'), s=document.getElementById('mission-sub');
    if(!p) return;
    p.textContent=PHASE_NAME[this.phase]||this.phase;
    let sub='';
    if(this.phase==='TRANSFER'){ const k=Math.min(this.pt/DUR.TRANSFER,1); sub=`地月转移 ${Math.round(k*100)}% · 距离月球 ${(D_EM*(1-k)).toFixed(2)} AU`; }
    else if(this.phase==='LUNAR_ORBIT'){ const laps=Math.floor(Math.min(this.pt/DUR.LUNAR_ORBIT,1)*LUNAR_ORBITS)+1; sub=`绕月第 ${laps}/${LUNAR_ORBITS} 圈`; }
    else if(this.phase==='EARTH_ORBIT'){ sub='地球停泊轨道'; }
    else if(this.phase==='DESCENT'){ const k=Math.min(this.pt/DUR.DESCENT,1); sub=`下降中 ${Math.round(k*100)}%`; }
    else if(this.phase==='LANDED'){ sub='已在月球表面'; }
    s.textContent=sub;
  }
  _showSuccess(){
    if(document.getElementById('mission-success')) return;
    const d=document.createElement('div'); d.id='mission-success';
    d.innerHTML=`<div style="position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:80;display:flex;align-items:center;justify-content:center">
      <div style="background:#0c1224;border:1px solid rgba(255,180,84,.4);border-radius:14px;padding:26px 30px;text-align:center;max-width:88vw">
        <div style="font-size:44px">🌕</div>
        <h3 style="color:#ffb454;margin:10px 0 6px;font-size:20px">登录月球成功</h3>
        <p style="color:#9aa7bd;font-size:14px;margin-bottom:16px">嫦娥已安全着陆月球。</p>
        <button id="mission-ok" style="padding:10px 26px;border-radius:10px;border:none;background:#ffb454;color:#1a1208;font-size:15px;cursor:pointer;font-weight:600">确定</button>
      </div></div>`;
    document.body.appendChild(d);
    document.getElementById('mission-ok').addEventListener('click',()=>this.finish());
  }

  _syncBtn(){ const b=document.getElementById('vt-mission'); if(b){ b.textContent=this.active?'⏹ 停止任务':'🚀 嫦娥奔月'; } const mb=document.getElementById('m-mission'); if(mb) mb.textContent=this.active?'⏹':'🚀'; }

  // —— 结束/取消 ——
  finish(){ this._teardown(); bus.emit('toast',{text:'嫦娥奔月演示完成',level:'ok'}); }
  cancel(){ this._teardown(); }
  _teardown(){
    const ctx=this.ctx; const wasActive=this.active;
    // 恢复全局状态（无条件：start 可能中途失败也要恢复）
    if(this._saved.rate>=0) ctx.clock.setRate(this._saved.rate);
    ctx.clock.running=this._saved.running;
    if(this._saved.moonMode && ctx.orbitView) ctx.orbitView.setMoonMode(this._saved.moonMode);
    if(ctx.cameraRig && ctx.cameraRig.controls) ctx.cameraRig.controls.enabled = this._saved.controlsOn!==false;
    ctx.camera.up.set(0,1,0);
    // 相机复位到"地月"机位（演示后自然停留）
    if(wasActive && ctx.cameraRig && ctx.cameraRig.setPreset) ctx.cameraRig.setPreset('earthMoon');
    // 移除 3D 对象（含分离后的着陆器）
    const scene=this.ctx.system.scene;
    const lander = this.change && this.change.userData ? this.change.userData.lander : null;
    [this.rocket,this.boosters,this.change,lander,this.linePark,this.lineTransfer,this.lineLunar].forEach(o=>{ if(o) scene.remove(o); });
    this.rocket=this.boosters=this.change=this.linePark=this.lineTransfer=this.lineLunar=null;
    this._built=false;
    // 移除 UI
    ['mission-hud','mission-success'].forEach(id=>{ const el=document.getElementById(id); if(el) el.remove(); });
    document.body.classList.remove('mission-active');
    this.ctx.missionActive=false;
    this.active=false; this.phase='IDLE'; this.pt=0;
    this._syncBtn();
    bus.emit('mission.end');
  }
}
