// 潮汐 · 双视图（对标月相实验室）：左=干净的因果示意图(2D截面)，右=真实感模拟(贴图地球+水体隆起)
import * as THREE from 'three';
import { ModuleBase } from './module-base.js';
import { textureStore } from '../scene/texture-store.js';
import { moonGeoScene, helioScene, searchPhase } from '../sim/astro.js';

// —— 3D 真实感场景参数 ——
const R_EARTH = 0.05, R_MOON = 0.02, R_ORBIT = 0.2;

// 水壳顶点：沿地月线成"两个隆起"的蛋形
const VERT = `
  uniform vec3 uMoonDir; uniform vec3 uSunDir; uniform float uExag; uniform vec2 uW;
  varying vec3 vN; varying vec3 vPos;
  float P2(float c){ return 0.5*(3.0*c*c-1.0); }
  void main(){
    vec3 n = normalize(position);
    float cM = dot(n, uMoonDir); float cS = dot(n, uSunDir);
    float bulge = uExag*(uW.x*P2(cM) + uW.y*P2(cS));
    vec3 p = position + normal*bulge;
    vN = normalize(normalMatrix*normal); vPos = p;
    gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);
  }`;
const FRAG = `
  uniform vec3 uSea; uniform vec3 uLight;
  varying vec3 vN; varying vec3 vPos;
  void main(){
    vec3 n=normalize(vN);
    float d = max(dot(n, normalize(uLight)),0.0)*0.55 + 0.6;
    float rim = pow(1.0-abs(dot(n, vec3(0.,0.,1.))), 2.0)*0.2;
    gl_FragColor = vec4(uSea*(d+rim), 0.66);
  }`;

export class Tides extends ModuleBase {
  constructor(ctx){ super(ctx); }

  enter(){
    this.ctx.clock.setRate(2); // 1 秒=1 小时
    // —— 真实感场景（右/下）——
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x070b16);
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH*0.94, 64, 64), new THREE.MeshBasicMaterial({color:0xffffff}));
    this.scene.add(this.earth);
    textureStore.surface('earth').then(t=>{ if(t){ this.earth.material.map=t; this.earth.material.needsUpdate=true; } });
    this.waterMat = new THREE.ShaderMaterial({ vertexShader:VERT, fragmentShader:FRAG,
      uniforms:{ uMoonDir:{value:new THREE.Vector3(0,0,-1)}, uSunDir:{value:new THREE.Vector3(1,0,0)}, uExag:{value:0.014}, uW:{value:new THREE.Vector2(2.2,1.0)}, uSea:{value:new THREE.Color(0x3fa2ff)}, uLight:{value:new THREE.Vector3(0.5,0.8,1)} },
      transparent:true, depthWrite:false, side:THREE.DoubleSide });
    this.water = new THREE.Mesh(new THREE.IcosahedronGeometry(R_EARTH*1.03, 64), this.waterMat);
    this.scene.add(this.water);
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(R_MOON, 48, 48), new THREE.MeshBasicMaterial({color:0xcfcfcf}));
    this.scene.add(this.moon); textureStore.surface('moon').then(t=>{ if(t){ this.moon.material.map=t; this.moon.material.needsUpdate=true; } });
    // 地月连线（潮汐方向）
    this.axisMat = new THREE.LineBasicMaterial({color:0xffe08a, transparent:true, opacity:0.95});
    this.axis = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), this.axisMat);
    this.scene.add(this.axis);

    // —— 示意图场景（左/上）：2D 截面，用 HTML canvas 画 ——
    this._buildOverlay();
    this._buildSchematic();
    this._allocCam();
  }

  _allocCam(){
    this.cam = new THREE.PerspectiveCamera(50,1,0.001,10);
  }

  _buildSchematic(){
    // 示意图 canvas（2D 截面，干净）；由 update 每帧绘制
    const host=document.getElementById('module-overlay');
    const cv=document.createElement('canvas'); cv.id='tide-schematic';
    cv.style.pointerEvents='none';    // 不能拦截点击（否则盖住顶栏页签/按钮）
    this.sc = cv; host.insertBefore(cv, host.firstChild);   // 放在模块控制层之下
    this.sctx = cv.getContext('2d');
  }

  _buildOverlay(){
    const host=document.getElementById('module-overlay');
    host.innerHTML=`<div class="module-ctx open" id="tide-ctx">
      <div class="viewlabel" id="tide-cap" style="top:52px;left:50%;transform:translateX(-50%);font-size:15px;padding:8px 16px;border-left-color:var(--accent2)">—</div>
      <div style="position:absolute;top:60px;left:14px;background:var(--panel-solid);border-radius:var(--radius);max-width:250px;overflow:hidden">
        <button id="tide-why-toggle" style="display:block;width:100%;text-align:left;background:none;border:none;color:var(--accent);font-size:13px;padding:8px 10px;cursor:pointer">▸ 怎么看？</button>
        <div id="tide-why-body" style="display:none;padding:0 10px 10px;font-size:12.5px;line-height:1.6;color:var(--text)">
          <b style="color:#ffe08a">月球引力</b>把海水拉成沿地月线的<b style="color:#6fc0ff">两个隆起</b>——朝月球一个、背月球一个（引力差/惯性）。<br>
          黄色点=某个<b>观测点</b>，随<b>地球自转</b>一天扫过两个隆起 → 一天约<b style="color:#ffd54a">两次涨潮、两次落潮</b>。<br>
          <span style="color:var(--muted)">再叠加太阳引潮力：朔/望（日月同向）大潮，上/下弦（垂直）小潮。</span>
        </div>
      </div>
      <div style="position:absolute;bottom:64px;left:14px;display:flex;gap:8px;flex-wrap:wrap;max-width:70vw">
        <button class="tc-btn" id="tide-spring">朔望大潮（日月同向）</button>
        <button class="tc-btn" id="tide-neap">上下弦小潮（日月垂直）</button>
        <button class="tc-btn" id="tide-back">返回全景</button>
      </div>
    </div>`;
    host.querySelector('#tide-spring').addEventListener('click',()=>this.preset('spring'));
    host.querySelector('#tide-neap').addEventListener('click',()=>this.preset('neap'));
    host.querySelector('#tide-back').addEventListener('click',()=>this.ctx.bus.emit('module.switch',{moduleId:'orbit-view'}));
    host.querySelector('#tide-why-toggle')?.addEventListener('click',()=>{
      const body=host.querySelector('#tide-why-body'), open=body.style.display!=='block';
      body.style.display = open?'block':'none';
      host.querySelector('#tide-why-toggle').textContent = (open?'▾':'▸')+' 怎么看？';
    });
  }

  exit(){
    this.disposeScene(this.scene);
    if(this.sc && this.sc.parentNode) this.sc.parentNode.removeChild(this.sc);
  }

  preset(kind){
    const jd=this.ctx.clock.jd;
    const t = kind==='spring' ? searchPhase(0, jd) : searchPhase(90, jd);
    if(t!=null) this.ctx.clock.jump(t);
    this.ctx.bus.emit('toast',{text: kind==='spring'
      ? '朔望大潮：日-地-月近似一条线，引力叠加 → 隆起更大'
      : '上下弦小潮：日月方向垂直，引力部分相消 → 隆起更小', level:'info'});
  }

  update(dt){
    this._t=(this._t||0)+dt;
    const jd=this.ctx.clock.jd;
    const g=moonGeoScene(jd); const mdir=new THREE.Vector3(g.x,g.y,g.z).normalize();
    if(!isFinite(mdir.x+mdir.y+mdir.z)) mdir.set(1,0,0);
    const e=helioScene('earth',jd); const sdir=new THREE.Vector3(-e.x,-e.y,-e.z).normalize();
    if(!isFinite(sdir.x+sdir.y+sdir.z)) sdir.set(1,0,0);
    // 真实感场景
    const mp=mdir.clone().multiplyScalar(R_ORBIT); this.moon.position.copy(mp);
    this.waterMat.uniforms.uMoonDir.value.copy(mdir);
    this.waterMat.uniforms.uSunDir.value.copy(sdir);
    this.waterMat.uniforms.uLight.value.copy(sdir);
    this.waterMat.uniforms.uExag.value = 0.014 + 0.003*(0.5+0.5*Math.sin(this._t*1.4));
    const anti=mdir.clone().multiplyScalar(-R_ORBIT);
    const posAttr=this.axis.geometry.attributes.position; posAttr.setXYZ(0, mp.x,mp.y,mp.z); posAttr.setXYZ(1, anti.x,anti.y,anti.z); posAttr.needsUpdate=true;
    // 观测点
    const spin=jd; const obsDir=new THREE.Vector3(Math.cos((spin%1)*Math.PI*2),0,Math.sin((spin%1)*Math.PI*2)).normalize();
    const P2=c=>0.5*(3*c*c-1);
    const lvl = 2.2*P2(obsDir.dot(mdir)) + 1.0*P2(obsDir.dot(sdir));
    const norm = Math.max(0, Math.min(1, (lvl+1.6)/4.8));
    this._norm = norm;
    this._drawSchematic(mdir, sdir, obsDir, norm);
    // 顶部说明
    const cap=document.getElementById('tide-cap');
    if(cap) cap.textContent = norm>0.6 ? `观测点正处隆起：涨潮` : (norm<0.4 ? `观测点处低谷：落潮` : `过渡`);
  }

  _drawSchematic(mdir, sdir, obsDir, norm){
    if(!this.sctx) return;
    const cv=this.sc, w=cv.width, h=cv.height, g=this.sctx;
    g.clearRect(0,0,w,h);
    // 深色背景
    g.fillStyle='#0a0f1c'; g.fillRect(0,0,w,h);
    g.fillStyle='#10182c'; g.fillRect(20,20,w-40,h-40);
    const cx=w*0.5, cy=h*0.5;
    const ang=Math.atan2(mdir.z,mdir.x), sunAng=Math.atan2(sdir.z,sdir.x), sunRel=sunAng-ang;
    // 标题
    g.fillStyle='#c8d2e2'; g.font='14px sans-serif'; g.textAlign='left';
    g.fillText('示意图 · 赤道截面（月球在右侧）', 30, 42);
    const R=Math.min(w,h)*0.15, moonR=R*0.30, moonDist=R*2.9;
    g.save(); g.translate(cx,cy);
    // 地月连线（虚线参考）
    g.strokeStyle='rgba(255,224,138,.4)'; g.setLineDash([5,5]); g.lineWidth=1;
    g.beginPath(); g.moveTo(-R*3.2,0); g.lineTo(R*3.2,0); g.stroke(); g.setLineDash([]);
    // —— 海水带（外圈随角度加宽 → 两个隆起）——
    const N=160;
    const outerPts=[]; for(let i=0;i<=N;i++){ const a=i/N*Math.PI*2; const cm=Math.cos(a), cs=Math.cos(a-sunRel);
      const depth=R*(0.05 + 0.20*Math.max(0,P2_h(cm))) + R*0.06*Math.max(0,P2_h(cs));
      const rr=R+depth; outerPts.push([Math.cos(a)*rr, Math.sin(a)*rr]); }
    g.beginPath(); outerPts.forEach((p,i)=> i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.closePath();
    g.fillStyle='rgba(111,192,255,.30)'; g.fill();
    g.lineWidth=2.5; g.strokeStyle='#8fd0ff'; g.stroke();
    // 地球圆盘
    g.beginPath(); g.arc(0,0,R,0,Math.PI*2); g.fillStyle='#2f6fb0'; g.fill();
    g.lineWidth=2; g.strokeStyle='#7fb2ff'; g.stroke();
    // 两个隆起端部小标注 + 箭头
    g.fillStyle='#6fc0ff'; g.font='13px sans-serif'; g.textAlign='center';
    g.fillText('朝月球隆起', R*2.1, -R*0.35);
    g.fillText('背月球隆起', -R*2.1, -R*0.35);
    // 月球
    g.beginPath(); g.arc(moonDist,0,moonR,0,Math.PI*2); g.fillStyle='#cfcfcf'; g.fill(); g.lineWidth=1.5; g.strokeStyle='#efefef'; g.stroke();
    g.fillStyle='#e8ecf5'; g.font='13px sans-serif'; g.fillText('月球', moonDist, -moonR-12);
    // 月球引力箭头
    g.strokeStyle='#ffe08a'; g.fillStyle='#ffe08a'; g.lineWidth=2.5;
    g.beginPath(); g.moveTo(moonDist-moonR,0); g.lineTo(R*1.3,0); g.stroke();
    arrowHead(g, moonDist-moonR,0, R*1.3,0);
    g.font='12px sans-serif'; g.fillText('月球引力 →', (moonDist+R*1.3)/2, 24);
    // 观测点（相对月球方向角）
    const rel=Math.atan2(obsDir.z,obsDir.x)-ang;
    const px=R*0.86*Math.cos(rel), py=R*0.86*Math.sin(rel);
    g.beginPath(); g.arc(px,py, 7+7*norm, 0,Math.PI*2);
    g.fillStyle=`hsl(${46-46*norm},100%,${58+16*norm}%)`; g.fill();
    g.lineWidth=2; g.strokeStyle='#fff'; g.stroke();
    // 观测点 → 水位条（覆盖在图上，靠右下）
    g.font='12px sans-serif'; g.fillStyle='#9aa7bd'; g.textAlign='left';
    g.fillText('观测点水位（此刻涨/落潮）', -R*2.6, h*0.5-46);
    const bw=190, bh=13, bx=-R*2.6, by=h*0.5-36;
    g.strokeStyle='rgba(255,255,255,.2)'; g.lineWidth=1; g.strokeRect(bx,by,bw,bh);
    g.fillStyle='#6fc0ff'; g.fillRect(bx,by,bw*Math.max(0,Math.min(1,norm)),bh);
    g.restore();
    // —— 一天水位曲线（两峰 = 两次涨潮）——
    const cx2=w*0.05, cyy=h*0.82, pw=w*0.42, ph=h*0.14;
    g.fillStyle='rgba(16,24,44,.92)'; g.fillRect(cx2-8, cyy-ph-10, pw+16, ph+30);
    g.strokeStyle='#8fd0ff'; g.lineWidth=2.5; g.beginPath();
    for(let x=0;x<=pw;x++){ const t=x/pw; const angd=(t*26)*Math.PI/12; const sun=new THREE.Vector3(Math.cos(angd),0,Math.sin(angd));
      const v=0.5+0.5*(2.2*P2_h(sun.dot(mdir))+1.0*P2_h(sun.dot(sdir)))/3; const y=cyy+ph-(v-0.35)/0.7*(ph-4); if(x===0)g.moveTo(cx2+x,y);else g.lineTo(cx2+x,y); }
    g.stroke();
    g.fillStyle='#9aa7bd'; g.font='11px sans-serif'; g.textAlign='left';
    g.fillText('一天水位曲线（两峰=两次涨潮）', cx2, cyy-ph-12);
  }

  render(){
    const r=this.ctx.renderer, w=r.domElement.clientWidth, h=r.domElement.clientHeight;
    const portrait = h > w*1.05;
    // 示意图 canvas（2D 截面）：横屏占左半、竖屏占上半（DOM，叠在 WebGL 画布之上）
    if(this.sc && this.sctx){
      const newW = portrait ? w : Math.floor(w*0.5);
      const newH = portrait ? Math.floor(h*0.5) : h;
      this.sc.style.position='absolute'; this.sc.style.left='0'; this.sc.style.top='0';
      this.sc.style.width = newW+'px'; this.sc.style.height = newH+'px';
      // 重要：设置 canvas.width 会清空画布，只在尺寸变化时才设置
      if(this.sc.width !== newW || this.sc.height !== newH){ this.sc.width = newW; this.sc.height = newH; }
    }
    // 3D 真实感场景画在另一半（WebGL）；相机取景随分割宽高比自适应
    r.setScissorTest(true);
    const vpAspect = portrait ? w/(h*0.5) : (w*0.5)/h;
    this.cam.aspect = vpAspect; this.cam.updateProjectionMatrix();
    const dir=new THREE.Vector3(0.44,0.32,0.44).normalize();
    const baseDist=new THREE.Vector3(0.44,0.32,0.44).length();
    const vHalf=(this.cam.fov*Math.PI)/360, hHalf=Math.atan(Math.tan(vHalf)*Math.max(vpAspect,0.2));
    const fit=(R_ORBIT+R_MOON+R_EARTH)*1.25;
    const dist=Math.max(baseDist, fit/Math.tan(hHalf), fit/Math.tan(vHalf));
    this.cam.position.copy(dir.multiplyScalar(dist)); this.cam.lookAt(0,0,0);
    if(portrait){ r.setViewport(0,0,w,h*0.5); r.setScissor(0,0,w,h*0.5); r.render(this.scene,this.cam); }
    else { r.setViewport(w*0.5,0,w*0.5,h); r.setScissor(w*0.5,0,w*0.5,h); r.render(this.scene,this.cam); }
    r.setScissorTest(false);
  }
}

function P2_h(c){ return 0.5*(3*c*c-1); }
function arrowHead(g, x0,y0,x1,y1){
  const a=Math.atan2(y1-y0,x1-x0), L=9;
  g.beginPath(); g.moveTo(x1,y1); g.lineTo(x1-L*Math.cos(a-0.5), y1-L*Math.sin(a-0.5)); g.moveTo(x1,y1); g.lineTo(x1-L*Math.cos(a+0.5), y1-L*Math.sin(a+0.5)); g.stroke();
}
