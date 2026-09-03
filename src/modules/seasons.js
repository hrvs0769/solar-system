// 四季成因（清晰教学图）：地球自转轴倾斜 23.4° 且方向不变 → 公转 → 南北半球日照不同
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
    this.ctx.clock.setRate(4);  // 1秒=12小时（可见四季变化）
    this.scene=new THREE.Scene(); this.scene.background=new THREE.Color(0x070b16);
    this.cam=new THREE.PerspectiveCamera(50,1,0.001,10);

    // 太阳（中心，明亮）
    this.sun=new THREE.Mesh(new THREE.SphereGeometry(R_SUN,48,48), new THREE.MeshBasicMaterial({color:0xffcf6b}));
    this.scene.add(this.sun);
    const light=new THREE.PointLight(0xffffff,2.6,0,0); this.scene.add(light);
    const amb=new THREE.AmbientLight(0x668, 0.95); this.scene.add(amb);

    // 地球（带自转轴倾斜；方向光来自太阳方向 → 明暗半球清楚）
    this.earthGroup=new THREE.Group(); this.scene.add(this.earthGroup);
    this.earth=new THREE.Mesh(new THREE.SphereGeometry(R_EARTH,48,48), new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.85}));
    this.earthGroup.add(this.earth);
    textureStore.surface('earth').then(t=>{ if(t){ this.earth.material.map=t; this.earth.material.needsUpdate=true; } });
    // 自转轴箭头（方向固定，穿过南北极）
    this.axisLen=R_EARTH*1.9;
    const axisGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-this.axisLen,0), new THREE.Vector3(0,this.axisLen,0)]);
    this.axis=new THREE.Line(axisGeo, new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0.9}));
    this.earthGroup.add(this.axis);
    this.axisCone=new THREE.Mesh(new THREE.ConeGeometry(R_EARTH*0.16,R_EARTH*0.36,12), new THREE.MeshBasicMaterial({color:0xffffff}));
    this.axisCone.position.y=this.axisLen; this.earthGroup.add(this.axisCone);

    // 轨道圈
    const orbit=new THREE.Mesh(new THREE.RingGeometry(R_ORBIT-0.002,R_ORBIT,128), new THREE.MeshBasicMaterial({color:0x3a5b86,side:THREE.DoubleSide,transparent:true,opacity:0.5}));
    orbit.rotation.x=Math.PI/2; this.scene.add(orbit);

    // 四个节气打点（轴朝 +X → 夏至在 +X 方向）
    this.marks=new THREE.Group(); this.scene.add(this.marks);
    this.markMeshes=[];
    const MK=[['夏至',0,'#ffd54a'],['秋分',90,'#66aaff'],['冬至',180,'#ff7b7b'],['春分',270,'#57d38a']];
    MK.forEach(([name,deg,color])=>{
      const r=new THREE.Mesh(new THREE.TorusGeometry(R_EARTH*0.55,0.004,8,32), new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.9}));
      const a=deg*Math.PI/180;
      r.position.set(Math.cos(a)*R_ORBIT,0,Math.sin(a)*R_ORBIT);
      this.marks.add(r); this.markMeshes.push({name,angle:deg,mesh:r});
    });

    // 阳光平行线
    this.rays=new THREE.Group(); this.scene.add(this.rays);

    this._buildOverlay(); this.update(0);
  }
  _buildOverlay(){
    const host=document.getElementById('module-overlay');
    host.innerHTML=`<div class="module-ctx open">
      <div class="viewlabel top-left">四季成因 · 地轴倾斜 23.4° 且方向不变</div>
      <div style="position:absolute;top:96px;left:14px;background:var(--panel-solid);border-radius:var(--radius);max-width:250px;overflow:hidden">
        <button id="se-why-toggle" style="display:block;width:100%;text-align:left;background:none;border:none;color:var(--accent);font-size:13px;padding:8px 10px;cursor:pointer">▸ 为什么有四季？</button>
        <div id="se-why-body" style="display:none;padding:0 10px 10px;font-size:12.5px;line-height:1.6;color:var(--text)">
          地球自转轴<b>倾斜 23.4°</b>，且<b>方向始终不变</b>。绕太阳<b>公转</b>时：<br>
          <b style="color:#ffd54a">夏至</b>北半球倾向太阳（日照多、热），<b style="color:#ff7b7b">冬至</b>北半球背向太阳（日照少、冷），春秋分居中。<br>
          <span style="color:var(--muted)">四季是因为<b>轴倾斜+公转</b>，不是离太阳远近。</span>
        </div>
      </div>
      <div class="viewlabel" id="se-status" style="position:absolute;top:60px;left:50%;transform:translateX(-50%);font-size:15px;padding:8px 16px;border-left-color:var(--accent2)">—</div>
      <div style="position:absolute;bottom:64px;left:14px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="tc-btn" data-se="6-21">夏至</button><button class="tc-btn" data-se="9-23">秋分</button>
        <button class="tc-btn" data-se="12-21">冬至</button><button class="tc-btn" data-se="3-20">春分</button>
      </div>
      <div style="position:absolute;bottom:64px;right:14px;display:flex;gap:8px">
        <button class="tc-btn" id="se-back">返回全景</button>
      </div>
      <div style="position:absolute;bottom:118px;left:14px;display:flex;gap:12px;flex-wrap:wrap;background:var(--panel);padding:8px 12px;border-radius:var(--radius);font-size:12.5px;color:var(--muted);max-width:70vw">
        <span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ffd54a"></i> 夏至</span>
        <span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#66aaff"></i> 秋分</span>
        <span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ff7b7b"></i> 冬至</span>
        <span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#57d38a"></i> 春分</span>
        <span style="color:var(--muted)">＝地球在轨道上的四个位置（环）</span>
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
  exit(){ this.disposeScene(this.scene); }
  update(dt){
    const jd=this.ctx.clock.jd;
    const p=helioScene('earth',jd);
    const len=Math.hypot(p.x,p.y,p.z)||1;
    const dir={x:p.x/len,y:p.y/len,z:p.z/len};
    const ep=new THREE.Vector3(dir.x*R_ORBIT,0,dir.z*R_ORBIT);
    this.earthGroup.position.copy(ep);
    // 自转轴固定（倾斜23.4°，方向不随公转改变；取朝 +X → 夏至时北半球朝太阳）
    this.earthGroup.rotation.set(0,0,0);
    this.earth.rotation.z = TILT;
    const ax=new THREE.Vector3(Math.sin(TILT),Math.cos(TILT),0).normalize();
    this.axis.rotation.set(0,0,0);
    this.axis.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), ax);
    this.axisCone.position.copy(ax.clone().multiplyScalar(this.axisLen));
    this.axisCone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), ax);
    // 阳光平行线（沿 太阳→地球 方向）
    this.rays.clear();
    const sdir=ep.clone().normalize();
    const perp=new THREE.Vector3(-sdir.z,0,sdir.x).normalize();
    for(let i=-2;i<=2;i++){
      const off=perp.clone().multiplyScalar(i*R_EARTH*1.6);
      const a=off.clone().addScaledVector(sdir,-R_ORBIT*1.1), b=off.clone().addScaledVector(sdir,R_ORBIT*0.55);
      const g2=new THREE.BufferGeometry().setFromPoints([a,b]);
      this.rays.add(new THREE.Line(g2, new THREE.LineBasicMaterial({color:0xffd54a,transparent:true,opacity:0.5})));
    }
    // 高亮最近节气
    const ang=Math.atan2(dir.z,dir.x)*180/Math.PI;
    this.markMeshes.forEach(m=>{
      const diff=Math.abs(((ang-m.angle+540)%360)-180);
      m.mesh.material.opacity = diff<12 ? 1.0 : 0.45;
      m.mesh.scale.setScalar(diff<12 ? 1.5 : 1.0);
    });
    // 动态提示：此刻哪半球倾向太阳 → 夏/冬
    const toward = ax.dot(dir);  // 北半球倾向方向 · 太阳方向；>0 → 北半球倾向太阳
    const st=document.getElementById('se-status');
    if(st){
      const tiltMsg = toward>0.01 ? '北半球向太阳倾 → 北半球昼长、为夏' : (toward<-0.01 ? '北半球背向太阳 → 北半球夜长、为冬' : '两半球日照相当 → 春/秋分');
      st.textContent = `此刻：${tiltMsg}`;
    }
  }
  render(){
    const r=this.ctx.renderer; const w=r.domElement.clientWidth, h=r.domElement.clientHeight;
    this.cam.aspect=w/h; this.cam.updateProjectionMatrix();
    // 自适应取景：竖屏窄边拉远，保证太阳+地球+轨道完整入镜
    const aspect = w/h;
    const dir = new THREE.Vector3(0.34, 0.28, 0.5).normalize();
    const baseDist = new THREE.Vector3(0.34, 0.28, 0.5).length();
    const vHalf = (this.cam.fov*Math.PI)/360;
    const hHalf = Math.atan(Math.tan(vHalf)*Math.max(aspect, 0.2));
    const fit = (R_ORBIT + R_SUN)*1.12;
    const dist = Math.max(baseDist, fit/Math.tan(hHalf), fit/Math.tan(vHalf));
    this.cam.position.copy(dir.multiplyScalar(dist));
    this.cam.lookAt(0,0,0);
    r.setViewport(0,0,w,h); r.setScissorTest(false); r.autoClear=true;
    r.render(this.scene, this.cam);
  }
}

function makeSphere(radius,color){ return new THREE.Mesh(new THREE.SphereGeometry(radius,48,48), new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.85})); }
