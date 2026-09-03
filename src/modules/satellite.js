// 卫星模块：一个绕地球公转的卫星（太阳翼 + 天线 + 对地相机等），可拉近看细节
import * as THREE from 'three';
import { ModuleBase } from './module-base.js';
import { textureStore } from '../scene/texture-store.js';

const R_EARTH = 0.16;      // 地球视觉半径
const R_ORBIT = 0.42;      // 卫星轨道半径（示意）
const INCL = 51.6 * Math.PI/180;   // 轨道倾角（ISS 约 51.6°）
const ORBIT_PERIOD = 90;   // 一圈 ≈ 90 分钟（演示时不严格对应真实时长，仅教学）

// 太阳能翼板格点贴图（程序生成，逼真电池片阵列）
function makeSolarTex(){
  const c=document.createElement('canvas'); c.width=256; c.height=128;
  const g=c.getContext('2d');
  g.fillStyle='#06132e'; g.fillRect(0,0,256,128);
  const cols=14, rows=6, cw=256/cols, ch=128/rows;
  for(let y=0;y<rows;y++) for(let x=0;x<cols;x++){
    const b=0.26+0.16*((x*7+y*13)%9)/9;   // 轻微亮度差异
    g.fillStyle=`rgb(${Math.round(18+b*50)},${Math.round(45+b*70)},${Math.round(110+b*95)})`;
    g.fillRect(x*cw+1.5, y*ch+1.5, cw-3, ch-3);
  }
  g.strokeStyle='rgba(210,230,255,.28)'; g.lineWidth=1.2;
  for(let x=0;x<=cols;x++){ g.beginPath(); g.moveTo(x*cw,0); g.lineTo(x*cw,128); g.stroke(); }
  for(let y=0;y<=rows;y++){ g.beginPath(); g.moveTo(0,y*ch); g.lineTo(256,y*ch); g.stroke(); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}

// 构建一个细节逼真的卫星模型（单位尺寸，调用方按需缩放/朝向）
export function buildSatelliteModel(){
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color:0xc4c9d1, metalness:0.85, roughness:0.35 });
  const metalDk = new THREE.MeshStandardMaterial({ color:0x8a8f98, metalness:0.8, roughness:0.5 });
  const gold = new THREE.MeshStandardMaterial({ color:0xd8b06a, metalness:0.9, roughness:0.35 });

  // —— 主体（bus）——
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.20,0.18,0.24), metal);
  g.add(body);
  // 主体上一些小面板/细节
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.02,0.20), gold); p1.position.y=0.10; p1.position.z=0.01; g.add(p1);
  const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.16,0.02), metalDk); g.add(p2); // 一侧面板

  // —— 太阳能翼（左右各一，双翼×2 通过桅杆连接主体）——
  const wingMat = new THREE.MeshStandardMaterial({ map:makeSolarTex(), metalness:0.35, roughness:0.55, side:THREE.DoubleSide });
  const wingGeo = new THREE.BoxGeometry(0.34, 0.005, 0.16);
  const mastMat = metalDk;
  [[-1],[1]].forEach(([s])=>{
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.008,0.12,8), mastMat);
    mast.rotation.z = Math.PI/2; mast.position.x = s*0.14; g.add(mast);
    const wing = new THREE.Mesh(wingGeo, wingMat); wing.position.x = s*0.33; g.add(wing);
    const wing2 = new THREE.Mesh(new THREE.BoxGeometry(0.30,0.005,0.16), wingMat); wing2.position.x = s*0.64; g.add(wing2);
  });

  // —— 天线碟（抛物面，通信）——
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16, 0, Math.PI*2, 0, Math.PI*0.42), metal);
  dish.rotation.x = -Math.PI/2;   // 开口朝上（+Z 定义见朝向）
  dish.position.y = 0.16; dish.position.z = 0.02; g.add(dish);
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.06,8), metalDk);
  feed.position.y = 0.22; g.add(feed);
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.02,0.04,10), metalDk);
  horn.position.y = 0.25; g.add(horn);

  // —— 对地相机/多光谱传感器（圆柱，位于 -Z，将朝向地球）——
  const camMat = new THREE.MeshStandardMaterial({ color:0x2b2f36, metalness:0.6, roughness:0.5 });
  const cam = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.055,0.06,20), camMat);
  cam.rotation.x = Math.PI/2; cam.position.z = -0.15; cam.position.y = -0.02; g.add(cam);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.036,0.036,0.012,20), new THREE.MeshStandardMaterial({color:0x0a2a5a, metalness:0.3, roughness:0.2}));
  lens.rotation.x = Math.PI/2; lens.position.z = -0.19; g.add(lens);

  // —— 散热器（白色面板）——
  const rad = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.06,0.005), new THREE.MeshStandardMaterial({color:0xf2f3f5, metalness:0.1, roughness:0.6}));
  rad.position.x = 0.0; rad.rotation.z = Math.PI/2; rad.position.z = 0.0; g.add(rad);

  // —— 姿态推力器（小喷口）——
  [[0.08,0.05,0.1],[-0.08,0.05,0.1],[0.0,-0.08,0.12]].forEach(([x,y,z])=>{
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.016,0.03,10), metalDk);
    noz.position.set(x,y,z); g.add(noz);
  });

  g.scale.setScalar(0.4);   // 整体缩放（细节视图靠相机拉近看清）
  return g;
}

export class Satellite extends ModuleBase {
  constructor(ctx){ super(ctx); this.mode='overview'; this._orbitA=0; }

  enter(){
    this.ctx.clock.setRate(2); // 1秒=1小时（卫星公转可见）
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x050810);
    this.cam = new THREE.PerspectiveCamera(50,1,0.001,50);

    // 地球（亮色贴图 + 光照明暗，更真实）
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH, 64, 64), new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.85}));
    this.scene.add(this.earth);
    textureStore.surface('earth').then(t=>{ if(t){ this.earth.material.map=t; this.earth.material.needsUpdate=true; } });

    // 光照：太阳方向光 + 环境光（让金属卫星有明显高光）
    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.6);
    this.sunLight.position.set(3,1,2); this.scene.add(this.sunLight); this.scene.add(this.sunLight.target);
    this.amb = new THREE.AmbientLight(0x445566, 0.8); this.scene.add(this.amb);
    this.rim = new THREE.PointLight(0x88aaff, 0.6, 4); this.rim.position.set(-2,-1.5,2); this.scene.add(this.rim);

    // 星场（少量亮星点缀）
    this._addStars();

    // 卫星轨道线（倾斜）
    this.orbitLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color:0x5aa0ff, transparent:true, opacity:0.55 }));
    this.scene.add(this.orbitLine);
    const pts=[]; for(let i=0;i<=128;i++){ const th=i/128*Math.PI*2; pts.push(this._orbitPos(th)); }
    this.orbitLine.geometry.setFromPoints(pts);

    // 卫星（细节模型）
    this.sat = buildSatelliteModel();
    this.scene.add(this.sat);

    this._buildOverlay();
  }

  _orbitPos(th){
    // 倾角 INCL 绕 X 轴倾斜的圆轨道
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
      <div class="viewlabel top-left">对地观测卫星 · 绕地球公转（拉近可看细节）</div>
      <div style="position:absolute;top:96px;left:14px;background:var(--panel-solid);border-radius:var(--radius);max-width:250px;overflow:hidden">
        <button id="sat-why-toggle" style="display:block;width:100%;text-align:left;background:none;border:none;color:var(--accent);font-size:13px;padding:8px 10px;cursor:pointer">▸ 这颗卫星是什么？</button>
        <div id="sat-why-body" style="display:none;padding:0 10px 10px;font-size:12.5px;line-height:1.6;color:var(--text)">
          这是一颗<b style="color:#5aa0ff">对地观测卫星</b>：<b>太阳能翼</b>把阳光变成电，<b>对地相机/传感器</b>盯着下方地球拍照、做环境与气象观测，<b>天线碟</b>把数据传回地面站。<br>
          <span style="color:var(--muted)">近地轨道约 400-800 公里，一圈约 90 分钟；轨道倾角 51.6°（类国际空间站）。</span>
        </div>
      </div>
      <div style="position:absolute;bottom:64px;left:14px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="tc-btn" id="sat-detail">🔍 看卫星细节</button>
        <button class="tc-btn" id="sat-overview">🌍 看全貌</button>
        <button class="tc-btn" id="sat-back">返回全景</button>
      </div>
      <div class="viewlabel" id="sat-status" style="position:absolute;bottom:64px;right:14px;border-left-color:var(--accent2);font-size:12.5px">轨道高度 550 km · 倾角 51.6°</div>
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
  exit(){ this.disposeScene(this.scene); }
  setMode(m){ this.mode=m; const d=document.getElementById('sat-detail'), o=document.getElementById('sat-overview');
    if(d) d.style.background=m==='detail'?'var(--ok)':''; if(o) o.style.background=m==='overview'?'var(--ok)':''; }

  update(dt){
    // 卫星公转：固定角速度，保证演示可见（约 25 秒一圈；一个近地轨道约 90 分钟，演示中压缩）
    this._orbitA += dt * 0.25;
    const satPos = this._orbitPos(this._orbitA);
    this.sat.position.copy(satPos);
    // 卫星姿态：-Z(对地相机)指向地球(径向向内)，+Y 沿轨道法向 → 对地定向
    const earthDir = satPos.clone().multiplyScalar(-1).normalize();   // 卫星→地球
    const up = this._orbitNormal();
    const fwd = earthDir.clone().negate();       // +Z 方向 = 背离地球（天线朝上）
    const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
    const upN = new THREE.Vector3().crossVectors(fwd, right).normalize();
    const m = new THREE.Matrix4().makeBasis(right, upN, fwd);
    this.sat.quaternion.setFromRotationMatrix(m);
    // 相机按模式取景
    this._frameCam(satPos, up);
    // 状态提示
    const st=document.getElementById('sat-status');
    if(st) st.textContent = this.mode==='detail' ? '卫星细节 · 太阳能翼 + 对地相机 + 天线碟' : '轨道高度 550 km · 倾角 51.6°';
  }

  _frameCam(satPos, up){
    const aspect = this.camBufferAspect() || 1;
    if(this.mode==='detail'){
      // 拉到卫星跟前，卫星居中，缓慢露出不同侧面（随轨道略有变化）
      const viewDir = new THREE.Vector3(0.9,0.5,1.2).normalize();
      const d = 0.5;   // 与卫星距离（近，看清细节）
      this.cam.position.copy(satPos.clone().add(viewDir.multiplyScalar(d)));
      this.cam.lookAt(satPos);
    } else {
      // 全貌：看地球 + 卫星轨道
      const dir=new THREE.Vector3(0.9,0.55,1.1).normalize();
      const d=1.35;
      this.cam.position.copy(dir.multiplyScalar(d));
      this.cam.lookAt(0,0,0);
    }
    this.cam.aspect = aspect; this.cam.updateProjectionMatrix();
  }
  camBufferAspect(){
    const r=this.ctx.renderer, w=r.domElement.clientWidth, h=r.domElement.clientHeight;
    return w/h;
  }

  render(){
    const r=this.ctx.renderer, w=r.domElement.clientWidth, h=r.domElement.clientHeight;
    this.cam.aspect=w/h; this.cam.updateProjectionMatrix();
    r.setViewport(0,0,w,h); r.setScissorTest(false); r.autoClear=true;
    r.render(this.scene,this.cam);
  }
}
