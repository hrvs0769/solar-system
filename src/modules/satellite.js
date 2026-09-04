// 卫星模块：一颗细节较精致的对地观测卫星绕地球公转；支持自由缩放/旋转（双手捏合），可拉远看整体、拉近看细节
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ModuleBase } from './module-base.js';
import { textureStore } from '../scene/texture-store.js';

const R_EARTH = 0.16;
const R_ORBIT = 0.42;
const INCL = 51.6 * Math.PI/180;

// —— 太阳能翼板格点贴图（逼真电池片阵列）——
function makeSolarTex(){
  const c=document.createElement('canvas'); c.width=256; c.height=128;
  const g=c.getContext('2d');
  g.fillStyle='#06132e'; g.fillRect(0,0,256,128);
  const cols=16, rows=7, cw=256/cols, ch=128/rows;
  for(let y=0;y<rows;y++) for(let x=0;x<cols;x++){
    const b=0.26+0.16*((x*7+y*13)%9)/9;
    g.fillStyle=`rgb(${Math.round(18+b*50)},${Math.round(45+b*70)},${Math.round(110+b*95)})`;
    g.fillRect(x*cw+1.5, y*ch+1.5, cw-3, ch-3);
  }
  g.strokeStyle='rgba(210,230,255,.28)'; g.lineWidth=1.2;
  for(let x=0;x<=cols;x++){ g.beginPath(); g.moveTo(x*cw,0); g.lineTo(x*cw,128); g.stroke(); }
  for(let y=0;y<=rows;y++){ g.beginPath(); g.moveTo(0,y*ch); g.lineTo(256,y*ch); g.stroke(); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}
// —— 金箔 MLI 热控贴图（褶皱金箔）——
function makeGoldTex(){
  const c=document.createElement('canvas'); c.width=128; c.height=128;
  const g=c.getContext('2d');
  g.fillStyle='#8a6a1e'; g.fillRect(0,0,128,128);
  for(let y=0;y<128;y+=2){
    const b=0.72+0.28*((y*31)%9)/9;
    g.fillStyle=`rgb(${Math.round(190*b)},${Math.round(140*b)},${Math.round(45*b)})`;
    g.fillRect(0,y,128,2);
  }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=4; return t;
}

// 构建一个细节较精致的卫星（约 0.13 视觉长，调用方按需缩放/朝向）
export function buildSatelliteModel(){
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ map:makeGoldTex(), metalness:0.7, roughness:0.45 });
  const metal = new THREE.MeshStandardMaterial({ color:0xb9bec7, metalness:0.85, roughness:0.35 });
  const metalDk = new THREE.MeshStandardMaterial({ color:0x6f747d, metalness:0.8, roughness:0.5 });
  const white = new THREE.MeshStandardMaterial({ color:0xf0f1f3, metalness:0.1, roughness:0.6 });
  const black = new THREE.MeshStandardMaterial({ color:0x14161a, metalness:0.4, roughness:0.5 });

  // —— 主体（bus：金箔热控，多面板）——
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.20,0.17,0.25), gold);
  g.add(body);
  const topPanel = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.01,0.22), metalDk); topPanel.position.y=0.09; g.add(topPanel);
  const sidePanel = new THREE.Mesh(new THREE.BoxGeometry(0.02,0.15,0.20), metal); sidePanel.position.x=0.10; g.add(sidePanel);

  // —— 太阳能翼（左右各一，每翼两段，通过桅杆连接）——
  const wingMat = new THREE.MeshStandardMaterial({ map:makeSolarTex(), metalness:0.35, roughness:0.55, side:THREE.DoubleSide });
  const mastMat = metalDk;
  [[-1],[1]].forEach(([s])=>{
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.10,10), mastMat);
    mast.rotation.z=Math.PI/2; mast.position.x=s*0.13; g.add(mast);
    const seg1 = new THREE.Mesh(new THREE.BoxGeometry(0.20,0.004,0.14), wingMat); seg1.position.x=s*0.25; g.add(seg1);
    const seg2 = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.004,0.14), wingMat); seg2.position.x=s*0.42; g.add(seg2);
  });

  // —— 通信天线碟（抛物面，金色，在短桅杆上）——
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16, 0, Math.PI*2, 0, Math.PI*0.4), new THREE.MeshStandardMaterial({ color:0xe8d9a0, metalness:0.9, roughness:0.35, side:THREE.DoubleSide }));
  dish.rotation.x=-Math.PI/2; dish.position.set(0,0.13,0.06); g.add(dish);
  const dishMast = new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.06,8), metalDk); dishMast.position.set(0,0.06,0.06); g.add(dishMast);
  const feed = new THREE.Mesh(new THREE.ConeGeometry(0.012,0.03,10), metalDk); feed.position.set(0,0.17,0.06); g.add(feed);

  // —— 对地相机/多光谱传感器（圆柱 + 深色镜头，位于 -Z 将朝向地球）——
  const sensor = new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.05,0.05,18), black);
  sensor.rotation.x=Math.PI/2; sensor.position.set(0,0.0,-0.14); g.add(sensor);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.032,0.012,16), new THREE.MeshStandardMaterial({color:0x0a2450, metalness:0.2, roughness:0.15}));
  lens.rotation.x=Math.PI/2; lens.position.set(0,0.0,-0.175); g.add(lens);

  // —— 散热器（白色面板，朝外）——
  const rad = new THREE.Mesh(new THREE.BoxGeometry(0.02,0.12,0.03), white); rad.position.set(-0.12,0.02,0); g.add(rad);

  // —— 姿态推力器（四角小喷口）——
  [[0.09,0.06,0.12],[-0.09,0.06,0.12],[0.09,-0.06,0.12],[-0.09,-0.06,0.12]].forEach(([x,y,z])=>{
    const noz=new THREE.Mesh(new THREE.CylinderGeometry(0.01,0.014,0.03,10), metalDk); noz.position.set(x,y,z); g.add(noz);
  });
  // 星敏感器（小圆柱）
  const starTrack=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.02,10), black); starTrack.position.set(0.06,0.11,-0.04); starTrack.rotation.z=Math.PI/2; g.add(starTrack);

  g.scale.setScalar(0.4);
  return g;
}

export class Satellite extends ModuleBase {
  constructor(ctx){ super(ctx); this.mode='overview'; this._orbitA=0; this._userControlled=false; }

  enter(){
    this.mode='overview';
    this.ctx.clock.setRate(2);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x050810);
    this.cam = new THREE.PerspectiveCamera(50,1,0.001,60);

    this.earth = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH, 64, 64), new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.85}));
    this.scene.add(this.earth);
    textureStore.surface('earth').then(t=>{ if(t){ this.earth.material.map=t; this.earth.material.needsUpdate=true; } });

    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.8);
    this.sunLight.position.set(3,1,2); this.scene.add(this.sunLight); this.scene.add(this.sunLight.target);
    this.amb = new THREE.AmbientLight(0x445566, 0.85); this.scene.add(this.amb);
    this.rim = new THREE.PointLight(0x88aaff, 0.6, 4); this.rim.position.set(-2,-1.5,2); this.scene.add(this.rim);

    this._addStars();

    // 轨道线
    const pts=[]; for(let i=0;i<=160;i++){ const th=i/160*Math.PI*2; pts.push(this._orbitPos(th)); }
    this.orbitLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color:0x5aa0ff, transparent:true, opacity:0.5 }));
    this.scene.add(this.orbitLine);

    // 卫星
    this.sat = buildSatelliteModel(); this.sat.name='satellite'; this.scene.add(this.sat);

    // —— 自由相机（OrbitControls：拖拽旋转 + 双手捏合缩放）——
    const dom = this.ctx.renderer.domElement;
    this.controls = new OrbitControls(this.cam, dom);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 0.28;   // 最近（能看清卫星细节）
    this.controls.maxDistance = 3.2;    // 最远（能看到整条轨道）
    this.controls.addEventListener('start', ()=>{ this._userControlled=true; }); // 用户一交互就停止自动跟随
    // 禁用主全景的控制，避免冲突
    if(this.ctx.cameraRig && this.ctx.cameraRig.controls) this.ctx.cameraRig.controls.enabled=false;
    this._frameOverview(true);

    this._buildOverlay();
  }

  _orbitPos(th){
    return new THREE.Vector3(Math.cos(th)*R_ORBIT, -Math.sin(th)*Math.sin(INCL)*R_ORBIT, Math.sin(th)*Math.cos(INCL)*R_ORBIT);
  }
  _orbitNormal(){ return new THREE.Vector3(0, Math.cos(INCL), Math.sin(INCL)).normalize(); }

  _addStars(){
    const n=700, g=new THREE.BufferGeometry(), p=new Float32Array(n*3);
    for(let i=0;i<n;i++){ const v=new THREE.Vector3().randomDirection().multiplyScalar(12+Math.random()*20); p[i*3]=v.x; p[i*3+1]=v.y; p[i*3+2]=v.z; }
    g.setAttribute('position', new THREE.BufferAttribute(p,3));
    this.scene.add(new THREE.Points(g, new THREE.PointsMaterial({color:0xffffff, size:0.03, sizeAttenuation:true, transparent:true, opacity:0.9})));
  }

  _buildOverlay(){
    const host=document.getElementById('module-overlay');
    host.innerHTML=`<div class="module-ctx open">
      <div class="viewlabel top-left">对地观测卫星 · 绕地球公转（单指转 / 双指捏合缩放）</div>
      <div style="position:absolute;top:96px;left:14px;background:var(--panel-solid);border-radius:var(--radius);max-width:250px;overflow:hidden">
        <button id="sat-why-toggle" style="display:block;width:100%;text-align:left;background:none;border:none;color:var(--accent);font-size:13px;padding:8px 10px;cursor:pointer">▸ 这颗卫星是什么？</button>
        <div id="sat-why-body" style="display:none;padding:0 10px 10px;font-size:12.5px;line-height:1.6;color:var(--text)">
          这是一颗<b style="color:#5aa0ff">对地观测卫星</b>：<b>太阳能翼</b>把阳光变成电，<b>对地相机/传感器</b>盯着下方地球拍照，<b>天线碟</b>把数据传回地面站。<br>
          <span style="color:var(--muted)">近地轨道约 400-800 公里，一圈约 90 分钟；轨道倾角 51.6°（类国际空间站）。用双指捏合可拉远看整体、拉近看细节。</span>
        </div>
      </div>
      <div style="position:absolute;bottom:64px;left:14px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="tc-btn" id="sat-detail">🔍 看卫星细节</button>
        <button class="tc-btn" id="sat-overview">🌍 看全貌</button>
        <button class="tc-btn" id="sat-back">返回全景</button>
      </div>
      <div class="viewlabel" id="sat-status" style="position:absolute;bottom:64px;right:14px;border-left-color:var(--accent2);font-size:12.5px">单指转 · 双指捏合缩放</div>
    </div>`;
    host.querySelector('#sat-detail')?.addEventListener('click',()=>this.setMode('detail'));
    host.querySelector('#sat-overview')?.addEventListener('click',()=>this.setMode('overview'));
    host.querySelector('#sat-back')?.addEventListener('click',()=>this.ctx.bus.emit('module.switch',{moduleId:'orbit-view'}));
    host.querySelector('#sat-why-toggle')?.addEventListener('click',()=>{
      const b=host.querySelector('#sat-why-body'), open=b.style.display!=='block';
      b.style.display=open?'block':'none';
      host.querySelector('#sat-why-toggle').textContent=(open?'▾':'▸')+' 这颗卫星是什么？';
    });
  }
  exit(){ this.disposeScene(this.scene);
    if(this.controls){ this.controls.dispose(); this.controls=null; }
    if(this.ctx.cameraRig && this.ctx.cameraRig.controls) this.ctx.cameraRig.controls.enabled=true;
  }

  setMode(m){
    this.mode=m; this._userControlled=false;
    const d=document.getElementById('sat-detail'), o=document.getElementById('sat-overview');
    if(d) d.style.background=m==='detail'?'var(--ok)':''; if(o) o.style.background=m==='overview'?'var(--ok)':'';
    if(m==='detail'){ this._frameDetail(true); }
    else { this._frameOverview(true); }
    this.controls && this.controls.update();
  }

  _frameOverview(instant){
    // 对准地球中心，拉远看 地球+轨道+卫星
    const dir=new THREE.Vector3(0.9,0.5,1.05).normalize();
    this.controls.target.set(0,0,0);
    this.cam.position.copy(dir.multiplyScalar(1.55));
    this.cam.lookAt(0,0,0);
  }
  _frameDetail(instant){
    // 对准卫星当前位置，拉近看细节
    const p=this.sat.position;
    this.controls.target.copy(p);
    const viewDir=new THREE.Vector3(0.7,0.55,0.9).normalize();
    this.cam.position.copy(p.clone().add(viewDir.multiplyScalar(0.48)));
    this.cam.lookAt(p);
  }

  update(dt){
    this._orbitA += dt * 0.25;
    const satPos = this._orbitPos(this._orbitA);
    this.sat.position.copy(satPos);
    // 卫星姿态：-Z(对地)指向地球，+Y 沿轨道法向
    const earthDir = satPos.clone().multiplyScalar(-1).normalize();
    const up = this._orbitNormal();
    const fwd = earthDir.clone().negate();
    const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
    const upN = new THREE.Vector3().crossVectors(fwd, right).normalize();
    this.sat.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, upN, fwd));

    // 细节模式自动跟随卫星（直到用户手动交互才停止）
    if(this.mode==='detail' && this.controls && !this._userControlled){
      this.controls.target.copy(this.sat.position);
    }
    // 光照的太阳目标
    if(this.sunLight) this.sunLight.position.set(3,1,2);
    this.controls && this.controls.update();
  }

  render(){
    const r=this.ctx.renderer, w=r.domElement.clientWidth, h=r.domElement.clientHeight;
    // 屏幕高宽比变化时更新投影
    if(Math.abs((w/h)-this.cam.aspect)>0.001){ this.cam.aspect=w/h; this.cam.updateProjectionMatrix(); }
    r.setViewport(0,0,w,h); r.setScissorTest(false); r.autoClear=true;
    r.render(this.scene,this.cam);
  }
}
