// 四季 · 双视图（对标月相实验室）：左=清晰示意（地轴倾斜+公转→日照角→四季），右=真实感模拟（贴图地球+晨昏线）
import * as THREE from 'three';
import { ModuleBase } from './module-base.js';
import { textureStore } from '../scene/texture-store.js';
import { helioScene } from '../sim/astro.js';
import { dateToJd } from '../sim/timeutil.js';

const R_ORBIT=0.26, R_EARTH=0.055, R_SUN=0.06;
const TILT = 23.4 * Math.PI/180;

export class Seasons extends ModuleBase {
  constructor(ctx){ super(ctx); }
  enter(){
    this.ctx.clock.setRate(4);  // 1秒=12小时
    this.scene=new THREE.Scene(); this.scene.background=new THREE.Color(0x070b16);
    this.cam=new THREE.PerspectiveCamera(50,1,0.001,10);
    // 太阳
    this.sun=new THREE.Mesh(new THREE.SphereGeometry(R_SUN,48,48), new THREE.MeshBasicMaterial({color:0xffcf6b}));
    this.scene.add(this.sun);
    const light=new THREE.PointLight(0xffffff,2.8,0,0); this.scene.add(light);
    const amb=new THREE.AmbientLight(0x668, 1.0); this.scene.add(amb);
    // 地球（倾斜轴）
    this.earthGroup=new THREE.Group(); this.scene.add(this.earthGroup);
    this.earth=new THREE.Mesh(new THREE.SphereGeometry(R_EARTH,48,48), new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.85}));
    this.earthGroup.add(this.earth);
    textureStore.surface('earth').then(t=>{ if(t){ this.earth.material.map=t; this.earth.material.needsUpdate=true; } });
    this.axisLen=R_EARTH*1.9;
    this.axis=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-this.axisLen,0), new THREE.Vector3(0,this.axisLen,0)]), new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0.9}));
    this.earthGroup.add(this.axis);
    this.axisCone=new THREE.Mesh(new THREE.ConeGeometry(R_EARTH*0.16,R_EARTH*0.36,12), new THREE.MeshBasicMaterial({color:0xffffff}));
    this.axisCone.position.y=this.axisLen; this.earthGroup.add(this.axisCone);
    // 轨道 + 四节气环
    const orbit=new THREE.Mesh(new THREE.RingGeometry(R_ORBIT-0.002,R_ORBIT,128), new THREE.MeshBasicMaterial({color:0x3a5b86,side:THREE.DoubleSide,transparent:true,opacity:0.5}));
    orbit.rotation.x=Math.PI/2; this.scene.add(orbit);
    this.marks=new THREE.Group(); this.scene.add(this.marks); this.markMeshes=[];
    const MK=[['夏至',0,'#ffd54a'],['秋分',90,'#66aaff'],['冬至',180,'#ff7b7b'],['春分',270,'#57d38a']];
    MK.forEach(([name,deg,color])=>{ const r=new THREE.Mesh(new THREE.TorusGeometry(R_EARTH*0.55,0.004,8,32), new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.9}));
      const a=deg*Math.PI/180; r.position.set(Math.cos(a)*R_ORBIT,0,Math.sin(a)*R_ORBIT); this.marks.add(r); this.markMeshes.push({name,angle:deg,mesh:r}); });
    // 阳光平行线
    this.rays=new THREE.Group(); this.scene.add(this.rays);

    this._buildOverlay();
    this._buildSchematic();
  }

  _buildSchematic(){
    const host=document.getElementById('module-overlay');
    const cv=document.createElement('canvas'); cv.id='se-schematic'; cv.style.pointerEvents='none';
    this.sc=cv; host.insertBefore(cv, host.firstChild); this.sctx=cv.getContext('2d');
  }

  _buildOverlay(){
    const host=document.getElementById('module-overlay');
    host.innerHTML=`<div class="module-ctx open">
      <div class="viewlabel" id="se-status" style="position:absolute;top:52px;left:50%;transform:translateX(-50%);font-size:15px;padding:8px 16px;border-left-color:var(--accent2)">—</div>
      <div style="position:absolute;top:60px;left:14px;background:var(--panel-solid);border-radius:var(--radius);max-width:250px;overflow:hidden">
        <button id="se-why-toggle" style="display:block;width:100%;text-align:left;background:none;border:none;color:var(--accent);font-size:13px;padding:8px 10px;cursor:pointer">▸ 为什么有四季？</button>
        <div id="se-why-body" style="display:none;padding:0 10px 10px;font-size:12.5px;line-height:1.6;color:var(--text)">
          地球自转轴<b>倾斜 23.4°</b>，且<b>方向始终不变</b>。绕太阳<b>公转</b>时：<br>
          <b style="color:#ffd54a">夏至</b>北半球倾向太阳（日照多、热），<b style="color:#ff7b7b">冬至</b>北半球背向太阳（日照少、冷），春秋分居中。<br>
          <span style="color:var(--muted)">四季是因为<b>轴倾斜+公转</b>，不是离太阳远近。</span>
        </div>
      </div>
      <div style="position:absolute;bottom:64px;left:14px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="tc-btn" data-se="6-21">夏至</button><button class="tc-btn" data-se="9-23">秋分</button>
        <button class="tc-btn" data-se="12-21">冬至</button><button class="tc-btn" data-se="3-20">春分</button>
        <button class="tc-btn" id="se-back">返回全景</button>
      </div>
    </div>`;
    host.querySelectorAll('[data-se]').forEach(b=>b.addEventListener('click',()=>{
      const [m,d]=b.getAttribute('data-se').split('-').map(Number);
      const y=new Date().getUTCFullYear();
      this.ctx.clock.jump(dateToJd(new Date(Date.UTC(y,m-1,d,12))));
      this.ctx.bus.emit('toast',{text:`已跳到${b.textContent}（${y}年）`,level:'info'});
    }));
    host.querySelector('#se-back').addEventListener('click',()=>this.ctx.bus.emit('module.switch',{moduleId:'orbit-view'}));
    host.querySelector('#se-why-toggle').addEventListener('click',()=>{
      const body=host.querySelector('#se-why-body'), open=body.style.display!=='block';
      body.style.display=open?'block':'none';
      host.querySelector('#se-why-toggle').textContent=(open?'▾':'▸')+' 为什么有四季？';
    });
  }
  exit(){ this.disposeScene(this.scene); if(this.sc&&this.sc.parentNode) this.sc.parentNode.removeChild(this.sc); }

  update(dt){
    const jd=this.ctx.clock.jd;
    const p=helioScene('earth',jd);
    const len=Math.hypot(p.x,p.y,p.z)||1;
    const dir={x:p.x/len,y:p.y/len,z:p.z/len};
    const ep=new THREE.Vector3(dir.x*R_ORBIT,0,dir.z*R_ORBIT);
    this.earthGroup.position.copy(ep);
    this.earthGroup.rotation.set(0,0,0);
    this.earth.rotation.z = TILT;
    const ax=new THREE.Vector3(Math.sin(TILT),Math.cos(TILT),0).normalize();
    this.axis.rotation.set(0,0,0);
    this.axis.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), ax);
    this.axisCone.position.copy(ax.clone().multiplyScalar(this.axisLen));
    this.axisCone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), ax);
    // 阳光平行线
    this.rays.clear();
    const sdir=ep.clone().normalize();
    const perp=new THREE.Vector3(-sdir.z,0,sdir.x).normalize();
    for(let i=-2;i<=2;i++){ const off=perp.clone().multiplyScalar(i*R_EARTH*1.6);
      const a=off.clone().addScaledVector(sdir,-R_ORBIT*1.1), b=off.clone().addScaledVector(sdir,R_ORBIT*0.55);
      this.rays.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]), new THREE.LineBasicMaterial({color:0xffd54a,transparent:true,opacity:0.5}))); }
    // 高亮最近节气 + 动态提示
    const ang=Math.atan2(dir.z,dir.x)*180/Math.PI;
    this.markMeshes.forEach(m=>{ const diff=Math.abs(((ang-m.angle+540)%360)-180); m.mesh.material.opacity=diff<12?1.0:0.45; m.mesh.scale.setScalar(diff<12?1.5:1.0); });
    const toward = ax.dot(dir);   // >0 → 北半球倾向太阳
    const st=document.getElementById('se-status');
    if(st){ st.textContent = toward>0.02 ? '北半球向太阳倾 → 北半球昼长、为夏' : (toward<-0.02 ? '北半球背向太阳 → 北半球夜长、为冬' : '两半球日照相当 → 春/秋分；随公转轴向不变、日照角在变'); }
    this._drawSchematic(ax, dir, toward);
  }

  _drawSchematic(ax, dir, toward){
    if(!this.sctx) return;
    const cv=this.sc, w=cv.width, h=cv.height, g=this.sctx;
    g.clearRect(0,0,w,h); g.fillStyle='#0a0f1c'; g.fillRect(0,0,w,h); g.fillStyle='#10182c'; g.fillRect(20,20,w-40,h-40);
    const cx=w*0.5, cy=h*0.5, R=Math.min(w,h)*0.24;
    g.fillStyle='#c8d2e2'; g.font='14px sans-serif'; g.textAlign='left'; g.fillText('示意图 · 地轴倾斜 23.4°，方向不变', 30, 42);
    g.save(); g.translate(cx, cy);
    // 太阳方向（真实方位投影到屏幕；等比例放大示意）
    const sunDx=dir.x, sunDy=dir.z; const sunL=Math.hypot(sunDx,sunDy)||1; const sunNx=sunDx/sunL, sunNy=sunDy/sunL;
    // 阳光（从太阳方向来的平行线，画在右侧）（示意里把太阳固定在屏幕右侧）
    g.strokeStyle='rgba(255,213,74,.6)'; g.lineWidth=1.5;
    for(let i=-2;i<=2;i++){ const off=i*R*0.42; g.beginPath(); g.moveTo(R*3.4, offRoi(off,0)); g.lineTo(R*1.0, offRoi(off,0)); g.stroke(); }
    function offRoi(o,y){ return y+o*0.32; }
    // 太阳（右侧亮球）
    g.beginPath(); g.arc(R*3.7, 0, R*0.5, 0, Math.PI*2); g.fillStyle='#ffcf6b'; g.fill();
    g.fillStyle='#e8ecf5'; g.font='13px sans-serif'; g.textAlign='center'; g.fillText('太阳', R*3.7, R*0.72);
    // 地球
    g.beginPath(); g.arc(0,0,R,0,Math.PI*2); g.fillStyle='#2f6fb0'; g.fill(); g.lineWidth=2; g.strokeStyle='#7fb2ff'; g.stroke();
    // 昼夜分界：阳光从右侧来 → 右半被照亮（亮蓝），左半是夜（暗）
    g.beginPath(); g.arc(0,0,R,-Math.PI/2,Math.PI/2); // 右半（朝太阳，被照亮）
    g.fillStyle='rgba(255,255,255,.22)'; g.fill();
    // 地轴（倾斜 23.4°，固定指向屏幕右上方；canvas y 轴向下，故北端用 -y）
    const axNx=Math.cos(23.4*Math.PI/180), axNy=Math.sin(23.4*Math.PI/180);
    g.strokeStyle='#ffffff'; g.lineWidth=3;
    g.beginPath(); g.moveTo(-axNx*R*1.8, axNy*R*1.8); g.lineTo(axNx*R*1.8, -axNy*R*1.8); g.stroke();
    arrowHead(g, -axNx*R*1.8, axNy*R*1.8, axNx*R*1.8, -axNy*R*1.8);
    g.fillStyle='#fff'; g.font='13px sans-serif'; g.fillText('N（北）', axNx*R*1.8+8, -axNy*R*1.8-8);
    // 阳光直射纬度指示（南北回归线之间）
    g.fillStyle='#ffd54a'; g.font='12px sans-serif';
    const direct = toward>0 ? '阳光直射北半球 → 北半球夏' : (toward<0 ? '阳光直射南半球 → 北半球冬' : '阳光直射赤道 → 春/秋分');
    g.textAlign='center'; g.fillText(direct, 0, R+34);
    g.restore();
  }

  render(){
    const r=this.ctx.renderer, w=r.domElement.clientWidth, h=r.domElement.clientHeight;
    const portrait = h > w*1.05;
    if(this.sc && this.sctx){
      const newW=portrait?w:Math.floor(w*0.5), newH=portrait?Math.floor(h*0.5):h;
      this.sc.style.position='absolute'; this.sc.style.left='0'; this.sc.style.top='0'; this.sc.style.width=newW+'px'; this.sc.style.height=newH+'px';
      if(this.sc.width!==newW||this.sc.height!==newH){ this.sc.width=newW; this.sc.height=newH; }
    }
    r.setScissorTest(true);
    const vpAspect = portrait?w/(h*0.5):(w*0.5)/h;
    this.cam.aspect=vpAspect; this.cam.updateProjectionMatrix();
    const dir=new THREE.Vector3(0.34,0.30,0.5).normalize();
    const baseDist=new THREE.Vector3(0.34,0.30,0.5).length();
    const vHalf=(this.cam.fov*Math.PI)/360, hHalf=Math.atan(Math.tan(vHalf)*Math.max(vpAspect,0.2));
    const fit=(R_ORBIT+R_SUN)*1.12;
    const dist=Math.max(baseDist, fit/Math.tan(hHalf), fit/Math.tan(vHalf));
    this.cam.position.copy(dir.multiplyScalar(dist)); this.cam.lookAt(0,0,0);
    if(portrait){ r.setViewport(0,0,w,h*0.5); r.setScissor(0,0,w,h*0.5); r.render(this.scene,this.cam); }
    else { r.setViewport(w*0.5,0,w*0.5,h); r.setScissor(w*0.5,0,w*0.5,h); r.render(this.scene,this.cam); }
    r.setScissorTest(false);
  }
}

function arrowHead(g,x0,y0,x1,y1){ const a=Math.atan2(y1-y0,x1-x0), L=10; g.beginPath(); g.moveTo(x1,y1); g.lineTo(x1-L*Math.cos(a-0.5),y1-L*Math.sin(a-0.5)); g.moveTo(x1,y1); g.lineTo(x1-L*Math.cos(a+0.5),y1-L*Math.sin(a+0.5)); g.stroke(); }
