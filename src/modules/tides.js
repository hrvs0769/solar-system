// 潮汐成因（清晰教学图）：亮色地球 + 可辨的双隆起水壳 + 月球引力方向 + 观测点随自转扫过隆起 + 水位曲线
import * as THREE from 'three';
import { ModuleBase } from './module-base.js';
import { textureStore } from '../scene/texture-store.js';
import { moonGeoScene, helioScene, searchPhase } from '../sim/astro.js';

const R_EARTH = 0.05, R_MOON = 0.02, R_ORBIT = 0.2;

// 水壳顶点：沿地月线成"两个隆起"的蛋形（向月 + 背月各一个），亮度/夸张可调
const VERT = `
  uniform vec3 uMoonDir; uniform vec3 uSunDir; uniform float uExag; uniform vec2 uW;
  varying vec3 vN; varying vec3 vPos;
  float P2(float c){ return 0.5*(3.0*c*c-1.0); }
  void main(){
    vec3 n = normalize(position);
    float cM = dot(n, uMoonDir);
    float cS = dot(n, uSunDir);
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
    // 高光让"隆起"更立体、更易读；整体亮蓝、半透明，但始终可见
    float d = max(dot(n, normalize(uLight)),0.0)*0.5 + 0.55;
    float rim = pow(1.0-abs(dot(n, vec3(0.,0.,1.))), 2.0)*0.25;
    vec3 col = uSea*(d+rim);
    gl_FragColor = vec4(col, 0.62);
  }`;

export class Tides extends ModuleBase {
  constructor(ctx){ super(ctx); }

  enter(){
    // 默认慢速，让观测点自转扫过隆起、水位曲线可读
    this.ctx.clock.setRate(2); // 1 秒=1 小时
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x070b16);
    this.cam = new THREE.PerspectiveCamera(50,1,0.001,10);

    // —— 实心地球（亮色：用 MeshBasicMaterial 直接显示贴图，不再受光照变黑）——
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH*0.94, 64, 64),
      new THREE.MeshBasicMaterial({ color:0xffffff }));
    this.scene.add(this.earth);
    textureStore.surface('earth').then(t=>{ if(t){ this.earth.material.map=t; this.earth.material.needsUpdate=true; } });

    // —— 海水壳（明亮、双隆起，蛋形）——
    this.waterMat = new THREE.ShaderMaterial({ vertexShader:VERT, fragmentShader:FRAG,
      uniforms:{ uMoonDir:{value:new THREE.Vector3(0,0,-1)}, uSunDir:{value:new THREE.Vector3(1,0,0)}, uExag:{value:0.012}, uW:{value:new THREE.Vector2(2.2,1.0)}, uSea:{value:new THREE.Color(0x3fa2ff)}, uLight:{value:new THREE.Vector3(0.5,0.8,1)} },
      transparent:true, depthWrite:false, side:THREE.DoubleSide });
    this.water = new THREE.Mesh(new THREE.IcosahedronGeometry(R_EARTH*1.02, 64), this.waterMat);
    this.scene.add(this.water);

    // —— 月球（亮色）——
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(R_MOON, 48, 48), new THREE.MeshBasicMaterial({color:0xcfcfcf}));
    this.scene.add(this.moon); textureStore.surface('moon').then(t=>{ if(t){ this.moon.material.map=t; this.moon.material.needsUpdate=true; } });

    // 月球轨道圈（淡）
    this.moonOrbit = new THREE.Mesh(new THREE.RingGeometry(R_ORBIT-0.0005, R_ORBIT, 128), new THREE.MeshBasicMaterial({color:0x3a5b86, side:THREE.DoubleSide, transparent:true, opacity:0.5}));
    this.moonOrbit.rotation.x = Math.PI/2; this.scene.add(this.moonOrbit);

    // —— 地月连线（潮汐方向） + 双向箭头 ——
    this.axisMat = new THREE.LineBasicMaterial({color:0xffe08a, transparent:true, opacity:0.95});
    this.axisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.axis = new THREE.Line(this.axisGeo, this.axisMat); this.scene.add(this.axis);
    // 箭头（锥体）标出"月球引力方向"
    this.arrowNear = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.02, 12), new THREE.MeshBasicMaterial({color:0xffe08a, transparent:true, opacity:0.9}));
    this.arrowFar = this.arrowNear.clone(); this.scene.add(this.arrowNear); this.scene.add(this.arrowFar);

    // —— 隆起端点小标（鲜亮）——
    this.bulgeMarkNear = new THREE.Mesh(new THREE.SphereGeometry(0.006,16,16), new THREE.MeshBasicMaterial({color:0xfff2b0}));
    this.bulgeMarkFar = this.bulgeMarkNear.clone(); this.scene.add(this.bulgeMarkNear); this.scene.add(this.bulgeMarkFar);

    // —— 观测点（随地球自转扫过隆起；水位高时更亮更大）——
    this.obsPoint = new THREE.Mesh(new THREE.SphereGeometry(0.008,16,16), new THREE.MeshBasicMaterial({color:0xffd54a}));
    this.scene.add(this.obsPoint);
    // 观测点轨迹（自转一圈的完整路径）
    this.obsPath = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({color:0x4a8fd0, transparent:true, opacity:0.5}));
    this.scene.add(this.obsPath);
    this._obsPathPts = [];

    this._buildOverlay(); this._buildChart();
  }

  _buildOverlay(){
    const host=document.getElementById('module-overlay');
    host.innerHTML=`<div class="module-ctx open" id="tide-ctx">
      <div class="viewlabel top-left">潮汐成因 · 月球引力把海水拉成两个隆起</div>
      <div style="position:absolute;top:100px;left:14px;background:var(--panel-solid);border-radius:var(--radius);max-width:250px;overflow:hidden">
        <button id="tide-why-toggle" style="display:block;width:100%;text-align:left;background:none;border:none;color:var(--accent);font-size:13px;padding:8px 10px;cursor:pointer">▸ 怎么看这个图？</button>
        <div id="tide-why-body" style="display:none;padding:0 10px 10px;font-size:12.5px;line-height:1.6;color:var(--text)">
          月球引力把海水拉成沿地月线（黄色箭头）的<b style="color:#ffe08a">两个隆起</b>——朝月球一个、背月球一个。<br>
          黄色点=某个<b>观测点</b>，随<b>地球自转</b>一天扫过两次隆起 → 每天约<b style="color:#ffd54a">两次涨潮、两次落潮</b>（一个太阴日≈24h50m）。<br>
          <span style="color:var(--muted)">再叠加太阳引潮力：<b>朔/望</b>时日月地近似共线（大潮），<b>上弦/下弦</b>时垂直（小潮）。</span>
        </div>
      </div>
      <div style="position:absolute;top:100px;right:14px;background:var(--panel);padding:10px;border-radius:var(--radius);width:250px">
        <div style="color:var(--muted);font-size:12px;margin-bottom:6px">观测点水位曲线（两峰 = 一天两次涨潮）</div>
        <canvas id="tide-chart" width="230" height="96"></canvas>
      </div>
      <div style="position:absolute;bottom:64px;left:14px;display:flex;gap:8px">
        <button class="tc-btn" id="tide-spring">朔望大潮（日月同向）</button>
        <button class="tc-btn" id="tide-neap">上下弦小潮（日月垂直）</button>
      </div>
      <div style="position:absolute;bottom:64px;right:14px;display:flex;gap:8px">
        <button class="tc-btn" id="tide-back">返回全景</button>
      </div>
    </div>`;
    host.querySelector('#tide-spring').addEventListener('click',()=>this.preset('spring'));
    host.querySelector('#tide-neap').addEventListener('click',()=>this.preset('neap'));
    host.querySelector('#tide-back').addEventListener('click',()=>this.ctx.bus.emit('module.switch',{moduleId:'orbit-view'}));
    host.querySelector('#tide-why-toggle')?.addEventListener('click',()=>{
      const body=host.querySelector('#tide-why-body'), open=body.style.display!=='block';
      body.style.display = open?'block':'none';
      host.querySelector('#tide-why-toggle').textContent = (open?'▾':'▸')+' 怎么看这个图？';
    });
  }
  _buildChart(){ this.chart = document.getElementById('tide-chart'); this.ctx2d = this.chart?.getContext('2d'); }
  exit(){ this.disposeScene(this.scene); }

  preset(kind){
    // 跳到真实的日月相对位形：大潮=朔/望（日月同位），小潮=上弦/下弦（日月垂直）
    const jd=this.ctx.clock.jd;
    const t = kind==='spring' ? searchPhase(0, jd) : searchPhase(90, jd);
    if(t!=null) this.ctx.clock.jump(t);
    this.ctx.bus.emit('toast',{text: kind==='spring'
      ? '朔望大潮：日-地-月近似一条线，太阳+月球引潮力叠加 → 隆起更大'
      : '上下弦小潮：日月方向垂直，太阳与月球引潮力部分相消 → 隆起更小', level:'info'});
  }

  _frameCamera(){
    // 固定 3/4 抬高视角（稳定不晃），完整框住地球 + 月球轨道 + 两隆起
    this.cam.position.set(0.46, 0.34, 0.44);
    this.cam.lookAt(0,0,0);
  }

  update(dt){
    this._t = (this._t||0) + dt;
    const jd=this.ctx.clock.jd;
    const g=moonGeoScene(jd); const mdir=new THREE.Vector3(g.x,g.y,g.z).normalize(); this._mdir=mdir;
    const mp=mdir.clone().multiplyScalar(R_ORBIT); this.moon.position.copy(mp);
    const e=helioScene('earth',jd); const sdir=new THREE.Vector3(-e.x,-e.y,-e.z).normalize();
    this.waterMat.uniforms.uMoonDir.value.copy(mdir);
    this.waterMat.uniforms.uSunDir.value.copy(sdir);
    this.waterMat.uniforms.uLight.value.copy(sdir);
    // 海水轻微起伏（"被推着走"），隆起更明显
    this.waterMat.uniforms.uExag.value = 0.012 + 0.003*(0.5+0.5*Math.sin(this._t*1.4));

    // 地月连线 + 方向箭头
    const anti = mdir.clone().multiplyScalar(-R_ORBIT);
    const posAttr = this.axis.geometry.attributes.position; posAttr.setXYZ(0, mp.x,mp.y,mp.z); posAttr.setXYZ(1, anti.x,anti.y,anti.z); posAttr.needsUpdate=true;
    this.arrowNear.position.copy(mdir.clone().multiplyScalar(R_EARTH*1.6)); this.arrowNear.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), mdir.clone().normalize());
    this.arrowFar.position.copy(mdir.clone().multiplyScalar(-R_EARTH*1.6)); this.arrowFar.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), mdir.clone().negate());

    // 隆起端点（向月 + 背月）
    const bulgeR = this.waterMat.uniforms.uExag.value*2.2;
    this.bulgeMarkNear.position.copy(mdir.clone().multiplyScalar(R_EARTH*1.02 + bulgeR));
    this.bulgeMarkFar.position.copy(mdir.clone().multiplyScalar(-(R_EARTH*1.02 + bulgeR)));

    // 观测点随自转扫过隆起
    const spin = jd; const obsDir = new THREE.Vector3(Math.cos((spin%1)*Math.PI*2), 0.0, Math.sin((spin%1)*Math.PI*2)).normalize();
    this.obsPoint.position.copy(obsDir.clone().multiplyScalar(R_EARTH*1.22));
    const P2=c=>0.5*(3*c*c-1);
    const lvl = 2.2*P2(obsDir.dot(mdir)) + 1.0*P2(obsDir.dot(sdir));
    const norm = Math.max(0, Math.min(1, (lvl+1.6)/4.8));
    this.obsPoint.material.color.setHSL(0.13*(1-norm), 1.0, 0.55+0.40*norm);
    this.obsPoint.scale.setScalar(1 + 1.9*norm);

    // 观测点轨迹（自转一整圈的路径）
    const N=64; const pts=[];
    for(let i=0;i<=N;i++){ const a=(i/N)*Math.PI*2; pts.push(new THREE.Vector3(Math.cos(a)*R_EARTH*1.22, 0, Math.sin(a)*R_EARTH*1.22)); }
    this.obsPath.geometry.dispose(); this.obsPath.geometry=new THREE.BufferGeometry().setFromPoints(pts);

    this._frameCamera();
    this._drawChart(obsDir, mdir, sdir);
  }

  _drawChart(obsDir, mdir, sdir){
    if(!this.ctx2d) return;
    const g=this.ctx2d,w=this.chart.width,h=this.chart.height;
    g.clearRect(0,0,w,h); g.fillStyle='#0a0e1a'; g.fillRect(0,0,w,h);
    g.beginPath(); g.lineWidth=2.5; g.strokeStyle='#6fc0ff';
    const P2=c=>0.5*(3*c*c-1); const N=w;
    for(let x=0;x<N;x++){
      const t=(x/N)*26; const ang=(t*Math.PI/12);
      const sun = new THREE.Vector3(Math.cos(ang),0,Math.sin(ang));
      let v=0.5+0.5*(2.2*P2(sun.dot(mdir))+1.0*P2(sun.dot(sdir)))/3;
      const y=h-((v-0.35)/0.7)*(h-8)-4; if(x===0)g.moveTo(x,y); else g.lineTo(x,y);
    }
    g.stroke();
    // 标注双峰
    g.fillStyle='rgba(255,255,255,.55)'; g.font='10px sans-serif';
    g.fillText('高', 40, 16); g.fillText('高', w-56, 16); g.fillText('低', w/2-6, 16);
    g.strokeStyle='rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(0,h*0.72); g.lineTo(w,h*0.72); g.stroke();
  }

  render(){
    const r=this.ctx.renderer; const w=r.domElement.clientWidth, h=r.domElement.clientHeight;
    this.cam.aspect=w/h; this.cam.updateProjectionMatrix();
    r.setViewport(0,0,w,h); r.setScissorTest(false); r.autoClear=true;
    r.render(this.scene, this.cam);
  }
}
