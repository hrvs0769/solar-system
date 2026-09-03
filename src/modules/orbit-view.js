// 全景主模块：太阳系运转、自由观察、锁定、比例模式、月球三态、信息面板
import * as THREE from 'three';
import { ModuleBase } from './module-base.js';
import { BODIES, LUNA, ORBIT_A_AU, KM_PER_AU, MOON_ORBIT_SCHEMATIC, MOON_RADIUS_SCHEMATIC, REAL_SIZE_RATIO, MIN_SUN_PX, MIN_PLANET_PX } from '../config.js';

const JD0 = 2451545.0;

export class OrbitView extends ModuleBase {
  constructor(ctx){
    super(ctx);
    this.pos = {};            // bodyId -> {x,y,z} 显示位置（double）
    this.proportion = 'teaching';   // 'teaching' | 'real'
    this.moonMode = 'schematic';    // 'schematic' | 'real' | 'hidden'
    this.labelsVisible = true;
    this.selected = null;
    this.kepler = false;
    this.pickables = [];
    this._keplerRes = [];
    this.keplerGroup = new THREE.Group(); this.keplerGroup.name='kepler'; this.keplerGroup.visible=false;
    this.ctx.system.root.add(this.keplerGroup);
    this._buildPickables();
    this._initPositions();
    this._bindPointer();
  }
  _bodyDef(id){ return BODIES.find(b=>b.id===id) || LUNA; }
  _buildPickables(){
    const g = this.ctx.system.bodyGroups;
    g.forEach((group, id)=>{
      const mesh = group.getObjectByName('body');
      if(mesh){ mesh.userData.bodyId=id; this.pickables.push(mesh); }
    });
  }
  _initPositions(){
    const a = this.ctx.astro, jd = this.ctx.clock.jd;
    a.helioScene('sun', jd); // prime cache
    BODIES.forEach(b=>{ this.pos[b.id]=a.helioScene(b.id, jd); });
    this.pos['moon']=this._moonPos(jd);
  }
  _moonPos(jd){
    const earth=this.pos.earth || this.ctx.astro.helioScene('earth', jd);
    const g=this.ctx.astro.moonGeoScene(jd);
    const len=Math.hypot(g.x,g.y,g.z)||1;
    // 统一用"示意轨道距离"（0.16 AU）：若用真实距离(0.00257)，月球会被放大后的地球吞没而不可见，
    // 反而像"月亮消失了"。月球"更小/更远"的真实感受由尺寸比例与轨道线传达。
    const vec = { x:(g.x/len)*MOON_ORBIT_SCHEMATIC, y:(g.y/len)*MOON_ORBIT_SCHEMATIC, z:(g.z/len)*MOON_ORBIT_SCHEMATIC };
    return { x:earth.x+vec.x, y:earth.y+vec.y, z:earth.z+vec.z };
  }
  getPos(id){ return this.pos[id] || {x:0,y:0,z:0}; }

  enter(){
    const { system } = this.ctx;
    system.scene.visible = true;
    if(this.ctx.labelRenderer) this.ctx.labelRenderer.domElement.style.display='';
    if(this._updateLabels) this._updateLabels();
    this._syncViewBtns();
    this.ctx.bus.emit('module.ready', { id:'orbit-view' });
  }
  exit(){ this.ctx.system.scene.visible=false; if(this.ctx.labelRenderer) this.ctx.labelRenderer.domElement.style.display='none'; }

  update(dt){
    const a=this.ctx.astro, jd=this.ctx.clock.jd;
    const g=this.ctx.system.bodyGroups;
    // 行星 + 太阳
    g.forEach((group, id)=>{
      if(id==='moon') return;
      const p = a.helioScene(id, jd); this.pos[id]=p;
      group.position.set(p.x,p.y,p.z);
      const def = group.userData.body;
      const sf = def.sizeFactor;
      let scale;
      if(this.proportion==='real'){
        // 「真实比例」：轨道距离真实；天体大小用 REAL_SIZE_RATIO 轻度放大（可见但小），
        // 并给一个最小屏幕尺寸兜底，避免任何天体（尤其最远/最小的）消失。
        const cam=this.ctx.camera, r=this.ctx.renderer;
        const h=r.domElement.clientHeight, fovV=cam.fov*Math.PI/180;
        const pxPerRad=(h/2)/Math.tan(fovV/2);
        const dist=Math.max(cam.position.distanceTo(group.position), 1e-6);
        const minPx = id==='sun' ? MIN_SUN_PX : MIN_PLANET_PX;
        const teachR = def.radiusKm/KM_PER_AU * sf;
        const minScale = ((minPx/2)/pxPerRad*dist) / teachR;
        scale = Math.max(REAL_SIZE_RATIO, minScale);
      } else {
        scale = 1;
      }
      group.scale.setScalar(scale);
      if(id==='sun'){
        // 太阳自转：赤道约 25.38 天一圈（较差自转，演示用均匀近似）
        group.rotation.y = ((jd - JD0)/25.38) * Math.PI*2;
      } else {
        group.userData.update && group.userData.update(jd - JD0);
      }
    });
    // 月球：大小始终以"地球当前显示半径"为基准（月球永远比地球小），避免真实比例下月球反比地球大
    const moon = g.get('moon'); if(moon){
      const p = this._moonPos(jd); this.pos['moon']=p; moon.position.set(p.x,p.y,p.z);
      const baseR = moon.userData.radiusAU;
      const earthG = g.get('earth');
      const earthBase = (earthG && earthG.userData && earthG.userData.radiusAU) || 0.0511;
      const earthR = (earthG ? earthG.scale.x : 1) * earthBase;   // 地球当前显示半径
      // 示意：月球约为地球显示半径的 44%（清晰可见、仍比地球小）；真实：约 29%（真实地月半径比≈0.27）
      let targetR = this.moonMode==='schematic' ? earthR*0.44 : (this.moonMode==='real' ? earthR*0.29 : 0);
      // 最小屏幕尺寸兜底，且上限确保月球始终小于地球
      const cam=this.ctx.camera, r=this.ctx.renderer;
      const h=r.domElement.clientHeight, fovV=cam.fov*Math.PI/180;
      const pxPerRad=(h/2)/Math.tan(fovV/2);
      const dist=Math.max(cam.position.distanceTo(new THREE.Vector3(p.x,p.y,p.z)), 1e-6);
      const minVisible=(1.5)/pxPerRad*dist;   // 目标直径约 3px（确保月球可见，又不至于反超地球）
      targetR = Math.min(Math.max(targetR, minVisible), earthR*0.9);
      moon.visible = this.moonMode!=='hidden';
      moon.scale.setScalar(baseR>0 ? targetR/baseR : 0);
      moon.userData.update(jd - JD0);
    }
    this._updateLabels();
    if(this.kepler) this._updateKepler(jd);
  }
  _updateKepler(jd){
    const a=this.ctx.astro;
    const id = (this.selected && BODIES.some(b=>b.id===this.selected)) ? this.selected : 'earth';
    const def = this._bodyDef(id);
    const period = def.periodDays || 365.25;
    const seg = period/14, N=26;
    this._keplerRes.forEach(o=>o.dispose()); this._keplerRes=[];
    this.keplerGroup.clear();
    [0, 0.5].forEach((phase,pi)=>{
      const t0 = jd + phase*period;
      const pos=[0,0,0];
      for(let k=0;k<=N;k++){ const p=a.helioScene(id, t0 + seg*(k/N)); pos.push(p.x,p.y,p.z); }
      const idx=[]; for(let k=1;k<=N;k++) idx.push(0,k,k+1);
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
      geo.setIndex(idx);
      const mat=new THREE.MeshBasicMaterial({ color:new THREE.Color(def.color), transparent:true, opacity: pi===0?0.30:0.16, side:THREE.DoubleSide, depthWrite:false });
      const m=new THREE.Mesh(geo,mat); this._keplerRes.push(geo,mat);
      this.keplerGroup.add(m);
    });
  }
  _updateLabels(){
    const s=this.ctx.system;
    const hidden = this.ctx.hiddenUI || document.body.classList.contains('hidden-ui');
    const show = this.labelsVisible && !hidden;
    // CSS2DRenderer 每帧会按 object.visible 重置 element 的 display，
    // 所以必须切换 object.visible 才能真正隐藏标签（改 style.display 会被覆盖）。
    s.labelObjects.forEach((obj)=>{ obj.visible = show; });
    const b=document.getElementById('vt-label');
    if(b){ b.textContent = show ? '标签·开' : '标签·关'; b.classList.toggle('off', !show); }
  }
  _bindPointer(){
    const dom = this.ctx.renderer.domElement;
    let sx=0,sy=0,st=0,down=false;
    dom.addEventListener('pointerdown', e=>{ down=true; sx=e.clientX; sy=e.clientY; st=performance.now(); });
    dom.addEventListener('pointerup', e=>{
      if(!down) return; down=false;
      if(Math.hypot(e.clientX-sx,e.clientY-sy)>6 || performance.now()-st>400) return;
      this._raycast(e.clientX,e.clientY);
    });
  }
  _raycast(cx,cy){
    const rc = new THREE.Raycaster(); const ndc=new THREE.Vector2();
    ndc.x=(cx/window.innerWidth)*2-1; ndc.y=-(cy/window.innerHeight)*2+1;
    rc.setFromCamera(ndc, this.ctx.camera);
    const hits = rc.intersectObjects(this.pickables, false);
    if(hits.length){
      const id = hits[0].object.userData.bodyId;
      this.selected=id;
      this.ctx.bus.emit('body.select',{ bodyId:id });
      this.ctx.cameraRig.focus(id);
    }
  }

  // 供 UI 调用
  toggleProportion(){ this.setProportion(this.proportion==='teaching'?'real':'teaching'); }
  cycleMoonMode(){ const order=['schematic','real','hidden']; const i=order.indexOf(this.moonMode); this.setMoonMode(order[(i+1)%3]); }
  toggleKepler(){
    this.kepler = !this.kepler; this.keplerGroup.visible = this.kepler;
    if(this.kepler) this.ctx.bus.emit('toast',{text:'面积定律：相等时间扫过相等面积——近日点弧更长、走得更快',level:'info'});
  }
  setProportion(mode){
    this.proportion=mode;
    const b=document.getElementById('scale-badge');
    if(b) b.textContent = mode==='real'
      ? '真实距离比例 · 轨道距离真实，天体大小轻度放大以便观察'
      : '教学比例 · 行星大小放大示意（非等比）';
    this.ctx.bus.emit('toast',{text: mode==='real'?'已切换真实距离比例：轨道距离真实，请体会"天体相对距离之远"':'已切换教学比例',level:'info'});
    this._syncViewBtns();
  }
  setMoonMode(mode){
    this.moonMode=mode;
    this.ctx.bus.emit('toast',{text: mode==='schematic'?'月球距离与大小已放大（示意，便于看清）':(mode==='real'?'月球真实大小只有地球的约1/4（距离为示意，便于看清）':'月球已隐藏'),level:'info'});
    this._syncViewBtns();
  }
  toggleLabels(){ this.labelsVisible=!this.labelsVisible; this._updateLabels(); }
  // 同步视图工具条按钮的三态/状态标示（比例/月地）
  _syncViewBtns(){
    const p=document.getElementById('vt-prop');
    if(p) p.textContent = this.proportion==='real' ? '比例·真实' : '比例·教学';
    const m=document.getElementById('vt-moon');
    if(m){ m.textContent = this.moonMode==='schematic' ? '月地·示意' : (this.moonMode==='real' ? '月地·真实' : '月地·隐藏'); m.classList.toggle('off', this.moonMode==='hidden'); }
  }

  render(){
    const { system, camera, renderer, labelRenderer } = this.ctx;
    // 星场作为远景背景，始终以相机为中心（避免远景漂移）
    if(system.starfield) system.starfield.position.copy(camera.position);
    // 身体保持在真实日心坐标（大尺度放大后 float32 精度足够）；日志深度缓冲已开启
    // 重置为整屏视口/剪刀（防止月相双视口遗留的半屏视口导致黑边+变形）
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    renderer.setViewport(0, 0, w, h);
    renderer.setScissorTest(false); renderer.autoClear = true;
    renderer.render(system.scene, camera);
    if(labelRenderer) labelRenderer.render(system.scene, camera);
  }
}
