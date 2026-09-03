// 月相实验室（A-1 几何成因版）：
// 左俯视图 = 明显太阳 + 平行光 + 地球→月球视线箭头 + 太阳-地球-月球夹角弧 + 轨道上朔/上弦/望/下弦四打点
// 右视图 = 从地球看月球的真实月相；两视图共享时钟实时联动
import * as THREE from 'three';
import { ModuleBase } from './module-base.js';
import { textureStore } from '../scene/texture-store.js';
import { getPhase, phaseName, moonGeoScene, helioScene, searchPhase } from '../sim/astro.js';

// 俯视图几何（场景单位=AU）
const R_ORBIT = 0.07;      // 月球轨道半径
const R_MOON = 0.016;      // 俯视月球半径
const R_EARTH = 0.02;      // 俯视地球半径
const SUN_DIST = 0.105;    // 太阳距地球（图示）
const SUN_R = 0.015;       // 俯视太阳半径
const R_MOON_EV = 0.05;    // 地球视角月球半径（更大，看得清月相）

export class MoonPhases extends ModuleBase {
  constructor(ctx){ super(ctx); this.quizState=null; }
  enter(){
    this.sceneTop = new THREE.Scene(); this.sceneTop.background = new THREE.Color(0x05070d);
    this.sceneEarth = new THREE.Scene(); this.sceneEarth.background = new THREE.Color(0x05070d);

    this.camTop = new THREE.PerspectiveCamera(50, 1, 0.001, 10); this.camTop.position.set(0,0.26,0); this.camTop.up.set(0,0,-1); this.camTop.lookAt(0,0,0);
    this.camEarth = new THREE.PerspectiveCamera(45, 1, 0.001, 10);

    // —— 俯视图：地球 + 月球 + 轨道 + 太阳 + 平行光 + 视线箭头 + 夹角弧 + 相位打点 ——
    this.earthMesh = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH, 32, 32), new THREE.MeshBasicMaterial({ color:0xffffff }));
    this.sceneTop.add(this.earthMesh);
    this.moonMesh = makeLitMoon(R_MOON); this.sceneTop.add(this.moonMesh);
    const orbit = new THREE.Mesh(new THREE.RingGeometry(R_ORBIT-0.0004, R_ORBIT, 128), new THREE.MeshBasicMaterial({color:0x334,side:THREE.DoubleSide,transparent:true,opacity:0.3}));
    orbit.rotation.x = Math.PI/2; this.sceneTop.add(orbit);

    // 太阳（明显的一颗 + 光晕）
    this.sunMesh = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 32, 32), new THREE.MeshBasicMaterial({ color:0xffffff }));
    this.sceneTop.add(this.sunMesh);
    this.sunGlow = makeSunGlow(SUN_R);
    this.sceneTop.add(this.sunGlow);

    // 平行光（一组沿太阳方向的细线）
    this.rays = new THREE.Group(); this.sceneTop.add(this.rays);

    // 地球→月球视线箭头（虚线 + 箭头锥）
    this.sight = new THREE.Group(); this.sceneTop.add(this.sight);
    this.sightLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1,0,0)]),
      new THREE.LineDashedMaterial({ color:0xffffff, dashSize:0.006, gapSize:0.004, transparent:true, opacity:0.7 }));
    this.sight.add(this.sightLine);
    this.sightArrow = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.012, 12), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.85 }));
    this.sight.add(this.sightArrow);

    // 夹角弧（太阳方向 → 月球方向）
    this.arcLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color:0xffd54a, transparent:true, opacity:0.9 }));
    this.sceneTop.add(this.arcLine);

    // 轨道上四个关键相位打点（朔/上弦/望/下弦）
    this.ticks = new THREE.Group(); this.sceneTop.add(this.ticks);
    this.tickDots = [];
    for(let i=0;i<4;i++){
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 12, 12), new THREE.MeshBasicMaterial({ color:0x66aaff, transparent:true, opacity:0.8 }));
      this.ticks.add(d); this.tickDots.push(d);
    }

    // 地球影子开关（示意锥）
    this.shadowCone = makeShadowCone(); this.shadowCone.visible=false; this.sceneTop.add(this.shadowCone);

    // —— 地球视角：月球（从地球看）+ 淡地球前景 ——
    this.earthViewMoon = makeSphere(R_MOON_EV, '#aaaaaa'); this.sceneEarth.add(this.earthViewMoon);
    this.earthViewEarth = makeSphere(R_EARTH*0.5, '#4f8fe0'); this.sceneEarth.add(this.earthViewEarth);

    // 灯光（每帧按太阳方向更新；右视图靠它得到正确月相）
    this.light = new THREE.DirectionalLight(0xffffff, 2.4);
    this.sceneTop.add(this.light); this.sceneEarth.add(this.light);
    this.sceneTop.add(this.light.target); this.sceneEarth.add(this.light.target);
    this.amb = new THREE.AmbientLight(0x334, 0.3); this.sceneTop.add(this.amb); this.sceneEarth.add(this.amb);

    this._buildOverlay();
    textureStore.surface('moon').then(t=>{ assignMap(this.earthViewMoon,t); if(this.moonMesh.userData.mat) this.moonMesh.userData.mat.uniforms.uMap.value = t; });
    textureStore.surface('earth').then(t=>{ assignMap(this.earthMesh,t); assignMap(this.earthViewEarth,t); });
    textureStore.surface('sun').then(t=>{ this.sunMesh.material.map = t; this.sunMesh.material.needsUpdate = true; });
    this.update(0);
  }
  _buildOverlay(){
    const host = document.getElementById('module-overlay');
    host.innerHTML = `
      <div class="module-ctx open" id="moon-ctx">
        <div class="viewlabel" style="top:60px;left:50%;transform:translateX(-50%);font-size:16px;padding:8px 16px" id="phaseLabel">—</div>
        <div class="viewlabel top-left">俯视：太阳→平行光→月球（永远只亮朝太阳那一半）</div>
        <div class="viewlabel top-right">从地球看月球<br><span style="font-size:12px">（沿左图白色虚线箭头的视线看去）</span></div>
        <div style="position:absolute;top:120px;left:14px;background:var(--panel-solid);border-radius:var(--radius);max-width:230px;overflow:hidden">
          <button id="mp-why-toggle" style="display:block;width:100%;text-align:left;background:none;border:none;color:var(--accent);font-size:13px;padding:8px 10px;cursor:pointer">▸ 为什么月相会变？</button>
          <div id="mp-why-body" style="display:none;padding:0 10px 10px;font-size:12.5px;line-height:1.6;color:var(--text)">
          月球绕地球<b>公转</b>(29.5天) → 「太阳-地球-月球」<b style="color:#ffd54a">夹角</b>不断变化 → 我们看到的亮面比例变化。<br>
          <span style="color:var(--muted)">夹角 0°=朔 · 90°=上弦 · 180°=望 · 270°=下弦（轨道上四个蓝点）。</span><br>
          <span style="color:var(--muted)">月相不是地球影子（那是月食）；月球<b>自转与公转同步</b>，永远同一面朝地球。</span>
          </div>
        </div>
        <div style="position:absolute;bottom:70px;left:14px;display:flex;gap:8px;flex-wrap:wrap;max-width:70vw">
          <button class="tc-btn" data-preset="0">朔</button><button class="tc-btn" data-preset="90">上弦</button>
          <button class="tc-btn" data-preset="180">望</button><button class="tc-btn" data-preset="270">下弦</button>
          <button class="tc-btn" id="moon-ff">一个月快放</button>
        </div>
        <div style="position:absolute;bottom:70px;right:14px;display:flex;gap:8px">
          <button class="tc-btn" id="moon-ray">光线</button>
          <button class="tc-btn" id="moon-shadow">地球影子</button>
          <button class="tc-btn" id="moon-quiz">猜一猜</button>
          <button class="tc-btn" id="moon-back">返回全景</button>
        </div>
        <div id="quiz-box" style="position:absolute;top:30%;left:50%;transform:translateX(-50%);display:none;background:var(--panel-solid);padding:20px;border-radius:var(--radius);text-align:center">
          <p style="margin-bottom:12px">此时从地球看，月球是？</p>
          <div style="display:flex;gap:8px" id="quiz-opts"></div>
          <p id="quiz-result" style="margin-top:10px"></p>
          <button class="tc-btn" id="quiz-reveal" style="margin-top:10px">揭晓</button>
        </div>
      </div>`;
    const q = id => host.querySelector('#'+id);
    host.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>this.goPreset(+b.getAttribute('data-preset'))));
    q('moon-ff')?.addEventListener('click',()=>this.fastForward());
    q('moon-ray')?.addEventListener('click',()=>this.toggleRays(q('moon-ray')));
    q('moon-shadow')?.addEventListener('click',()=>this.toggleShadow(q('moon-shadow')));
    q('moon-quiz')?.addEventListener('click',()=>this.quiz());
    q('moon-back')?.addEventListener('click',()=>this.ctx.bus.emit('module.switch',{moduleId:'orbit-view'}));
    q('quiz-reveal')?.addEventListener('click',()=>this.reveal());
    // 说明卡折叠开关
    q('mp-why-toggle')?.addEventListener('click',()=>{
      const body=q('mp-why-body'), open=body.style.display!=='block';
      body.style.display = open?'block':'none';
      q('mp-why-toggle').textContent = (open?'▾':'▸')+' 为什么月相会变？';
    });
  }
  exit(){
    this.disposeScene(this.sceneTop); this.disposeScene(this.sceneEarth);
  }

  goPreset(angle){
    const jd = searchPhase(angle, this.ctx.clock.jd);
    if(jd!=null){ this.clockJump(jd); const {fraction,angle:a}=getPhase(jd); this.ctx.bus.emit('toast',{text:`已跳到 ${phaseName(fraction,a)}`,level:'info'}); }
  }
  clockJump(jd){ this.ctx.clock.jump(jd); }
  fastForward(){
    if(this._ffActive){ this._ffActive=false; this.ctx.bus.emit('toast',{text:'已停止快放',level:'info'}); return; }
    this._ffActive = true; this._ffT = 0; this.ctx.bus.emit('toast',{text:'快放一个月（28 秒）',level:'info'});
  }
  toggleRays(btn){ const on=!this.rays.visible; this.rays.visible=on; btn.style.background=on?'var(--ok)':''; }
  toggleShadow(btn){ const on=!this.shadowCone.visible; this.shadowCone.visible=on; btn.style.background=on?'var(--ok)':''; }

  quiz(){
    const targets=[0,90,180,270];
    const angle = targets[Math.floor(Math.random()*4)];
    const jd = searchPhase(angle, this.ctx.clock.jd);
    this.quizState = { angle, jd, answered:false, revealing:false };
    this.clockJump(jd);
    this._quizViewOnly = true;
    const names={0:'朔（新月）',90:'上弦月',180:'望（满月）',270:'下弦月'};
    const box = document.getElementById('quiz-box');
    const opts = document.getElementById('quiz-opts');
    opts.innerHTML = ['朔（新月）','上弦月','望（满月）','下弦月'].map(n=>`<button class="tc-btn" data-n="${n}">${n}</button>`).join('');
    opts.querySelectorAll('[data-n]').forEach(b=>b.addEventListener('click',()=>{
      if(this.quizState.answered) return;
      this.quizState.answered=true;
      const correct = b.getAttribute('data-n')===names[angle];
      b.style.background = correct?'var(--ok)':'var(--err)';
      opts.querySelectorAll('[data-n]').forEach(x=>{ if(x===b)return; x.style.opacity='0.4'; });
      document.getElementById('quiz-result').textContent = correct?'回答正确！太阳照亮半球的朝向与我们的视线角度决定了月相。':'再想想：太阳光从哪个方向照亮月球？';
    }));
    box.style.display='block';
    document.getElementById('quiz-result').textContent='';
  }
  reveal(){
    this._quizViewOnly=false; this.quizState.revealing=true;
    document.getElementById('quiz-box').style.display='none';
    document.getElementById('phaseLabel').textContent = '揭晓：'+this.currentPhaseLabel();
    this.ctx.bus.emit('toast',{text:'看好俯视图：月球被照亮的那一半朝向太阳，夹角决定了从地球看到的形状。',level:'info'});
  }

  currentPhaseLabel(){
    const {fraction,angle} = getPhase(this.ctx.clock.jd);
    return `${phaseName(fraction,angle)} · 照亮 ${(fraction*100).toFixed(1)}% · 夹角 ${Math.round(angle)}°`;
  }

  update(dt){
    const jd = this.ctx.clock.jd;
    const g = moonGeoScene(jd);
    const len = Math.hypot(g.x,g.y,g.z)||1;
    const dir = {x:g.x/len,y:g.y/len,z:g.z/len};
    const mp = {x:dir.x*R_ORBIT, y:dir.y*R_ORBIT, z:dir.z*R_ORBIT};
    this.moonMesh.position.set(mp.x,mp.y,mp.z);
    // 太阳方向 = 从地球指向太阳
    const earth = helioScene('earth',jd);
    const sdir = new THREE.Vector3(-earth.x,-earth.y,-earth.z).normalize();
    const mdir = new THREE.Vector3(mp.x,mp.y,mp.z).normalize();

    // 俯视月球：照亮半球朝向太阳
    if(this.moonMesh.userData.mat) this.moonMesh.userData.mat.uniforms.uSunDir.value.copy(sdir);
    // 灯光沿太阳方向（右视图月相由它决定）
    this.light.position.copy(sdir.clone().multiplyScalar(10)); this.light.target.position.set(0,0,0);

    // 太阳及其光晕
    const sunPos = sdir.clone().multiplyScalar(SUN_DIST);
    this.sunMesh.position.copy(sunPos);
    this.sunGlow.position.copy(sunPos);
    // 平行光
    this._drawRays(sdir);
    // 视线箭头（地球→月球）
    this._updateSight(mp);
    // 夹角弧（太阳方向→月球方向，取XZ平面投影的短弧）
    this._updateArc(sdir, mdir);
    // 四个关键相位打点（相对太阳方向 0/90/180/270°）
    this._updateTicks(sdir, mdir);
    // 地球影子示意锥（沿反日方向）
    this.shadowCone.position.set(0,0,0);
    this.shadowCone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), sdir.clone().negate());

    // 地球视角：相机在地球望向月球（月球放真实方向，光照自动给出正确相位）
    const viewDir = mdir.clone();
    const moonDist = 0.5;
    const moonPos = viewDir.clone().multiplyScalar(moonDist);
    this.earthViewMoon.position.copy(moonPos);
    // 自适应距离：让月球盘面在窄分屏方向也完整容纳（含边距），避免横屏右半屏裁切月球
    const cw = this.ctx.renderer.domElement.clientWidth, ch = this.ctx.renderer.domElement.clientHeight;
    const portrait = ch > cw*1.05;
    const aspect = portrait ? (cw/(ch/2)) : ((cw/2)/ch);
    const fovTan = Math.tan((this.camEarth.fov*Math.PI)/360);
    const halfW = R_MOON_EV*1.3;
    const camDist = Math.max(halfW/(fovTan*Math.max(isNaN(aspect)||aspect<=0 ? 0.1 : aspect, 0.05)), R_MOON_EV*2.8);
    this.camEarth.position.copy(moonPos.clone().sub(viewDir.clone().multiplyScalar(camDist)));
    this.camEarth.lookAt(moonPos);
    this.earthViewEarth.position.copy(viewDir.clone().multiplyScalar(0.02));

    // 相位标签（含夹角）
    const label = document.getElementById('phaseLabel');
    if(label && !this.quizState?.active) label.textContent = this.currentPhaseLabel();
    // 快放
    if(this._ffActive){ this._ffT+=dt; this.ctx.clock.jd += (29.53/28)*dt; if(this._ffT>=28){ this._ffActive=false; this.ctx.bus.emit('toast',{text:'一个月演示完成',level:'ok'}); } }
    // 自转
    this.earthViewMoon.rotation.y=jd;
  }
  _drawRays(sdir){
    this.rays.clear();
    const perp = new THREE.Vector3(-sdir.z, 0, sdir.x).normalize();   // 平面内垂直于光线方向
    const N=7, span=0.16, half=0.22;
    for(let i=0;i<N;i++){
      const off = (i-(N-1)/2) * (span/(N-1));
      const mid = perp.clone().multiplyScalar(off);
      const p0 = mid.clone().addScaledVector(sdir, -half);
      const p1 = mid.clone().addScaledVector(sdir, half);
      const g2=new THREE.BufferGeometry().setFromPoints([p0,p1]);
      this.rays.add(new THREE.Line(g2, new THREE.LineBasicMaterial({color:0xffd54a, transparent:true, opacity:0.35})));
    }
  }
  _updateSight(mp){
    const pts=[new THREE.Vector3(0,0,0), new THREE.Vector3(mp.x,mp.y,mp.z)];
    this.sightLine.geometry.dispose();
    this.sightLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    this.sightLine.computeLineDistances();
    this.sightArrow.position.copy(new THREE.Vector3(mp.x,mp.y,mp.z));
    this.sightArrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), new THREE.Vector3(mp.x,mp.y,mp.z).normalize());
  }
  _updateArc(sdir, mdir){
    // XZ 平面投影的短弧（从太阳方向转到月球方向）
    const s2=new THREE.Vector2(sdir.x,sdir.z), m2=new THREE.Vector2(mdir.x,mdir.z);
    const cross=s2.x*m2.y - s2.y*m2.x;
    const dot=Math.max(-1,Math.min(1,(s2.x*m2.x+s2.y*m2.y)/(Math.max(1e-6,(s2.length()*m2.length())))));
    const a=Math.acos(dot);
    const signed = cross>=0 ? a : -a;
    const pts=[];
    for(let i=0;i<=26;i++){
      const th=signed*(i/26);
      const v=s2.clone().normalize().multiplyScalar(0.038);
      v.rotateAround(new THREE.Vector2(0,0), th);
      pts.push(new THREE.Vector3(v.x,0,v.y));
    }
    this.arcLine.geometry.dispose();
    this.arcLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  }
  _updateTicks(sdir, mdir){
    const {angle} = getPhase(this.ctx.clock.jd);   // 月球距太阳的经度角 0..360
    const base = new THREE.Vector2(sdir.x, sdir.z).normalize();
    [0,90,180,270].forEach((deg,i)=>{
      const v = base.clone().multiplyScalar(R_ORBIT);
      v.rotateAround(new THREE.Vector2(0,0), deg*Math.PI/180);
      const d = this.tickDots[i];
      d.position.set(v.x, 0, v.y);
      // 当前夹角与关键角接近时高亮
      const diff = Math.min(Math.abs(angle-deg), 360-Math.abs(angle-deg));
      d.material.opacity = diff<10 ? 1.0 : 0.45;
      d.scale.setScalar(diff<10 ? 2.0 : 1.0);
    });
  }
  render(){
    const w=this.ctx.renderer.domElement.clientWidth, h=this.ctx.renderer.domElement.clientHeight;
    const r=this.ctx.renderer; r.setScissorTest(true);
    const portrait = h > w*1.05;
    const renderHalf = (cam, scene, vx, vy, vw, vh)=>{ cam.aspect=vw/vh; cam.updateProjectionMatrix(); r.setViewport(vx,vy,vw,vh); r.setScissor(vx,vy,vw,vh); r.render(scene,cam); };
    if(portrait){
      const hh=h/2;
      if(!this._quizViewOnly) renderHalf(this.camTop, this.sceneTop, 0, hh, w, hh);
      else { r.setViewport(0,hh,w,hh); r.setScissor(0,hh,w,hh); r.clear(); }
      renderHalf(this.camEarth, this.sceneEarth, 0, 0, w, hh);
    } else {
      const hw=w/2;
      if(!this._quizViewOnly) renderHalf(this.camTop, this.sceneTop, 0, 0, hw, h);
      else { r.setViewport(0,0,hw,h); r.setScissor(0,0,hw,h); r.clear(); }
      renderHalf(this.camEarth, this.sceneEarth, hw, 0, hw, h);
    }
    r.setScissorTest(false);
  }
}

function makeSphere(radius, color){
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 48), new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.9 }));
}
function assignMap(mesh, texture){ if(mesh&&texture){ mesh.material.map=texture; mesh.material.color.set(0xffffff); mesh.material.needsUpdate=true; } }
// 俯视月球：带月貌纹理，受光半边亮、背光半边暗、晨昏线柔化
function makeLitMoon(radius){
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSunDir:{value:new THREE.Vector3(1,0,0)}, uMap:{value:null} },
    vertexShader: `varying vec2 vUv; varying vec3 vWN;
      void main(){ vUv=uv; vWN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uSunDir; uniform sampler2D uMap; varying vec2 vUv; varying vec3 vWN;
      void main(){
        vec3 base = texture2D(uMap, vUv).rgb;
        float lit = smoothstep(-0.25, 0.30, dot(normalize(vWN), normalize(uSunDir)));
        vec3 col = mix(base*0.08, base*(1.0+0.15*lit), lit);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 64), mat);
  m.userData.mat = mat;
  return m;
}
// 太阳光晕（BackSide 加法菲涅尔壳）
function makeSunGlow(radius){
  const geo = new THREE.SphereGeometry(radius*2.2, 32, 32);
  const mat = new THREE.ShaderMaterial({
    vertexShader:`varying vec3 vN; varying vec3 vView;
      void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader:`varying vec3 vN; varying vec3 vView;
      void main(){ float f=pow(1.0-abs(dot(normalize(vN),normalize(vView))),2.0);
        gl_FragColor=vec4(vec3(1.0,0.6,0.2)*0.7, f*0.5); }`,
    side: THREE.BackSide, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
  });
  return new THREE.Mesh(geo, mat);
}
function makeShadowCone(){
  const geo=new THREE.ConeGeometry(0.05, 0.5, 32);
  const mat=new THREE.MeshBasicMaterial({color:0x777777, transparent:true, opacity:0.22, depthWrite:false});
  const m=new THREE.Mesh(geo,mat); m.name='shadowCone'; return m;
}
