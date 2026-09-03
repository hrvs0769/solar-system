// 摄像机：OrbitControls 封装 + 定位/跟随/复位/机位预设/距离钳制
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bus } from './bus.js';

// 缩放映射纯函数（v∈[0,1]，1=最近）：便于测试与复用
export const zoomDist = (v, minDist, maxDist) => maxDist - (maxDist-minDist)*v;
export const zoomV = (d, minDist, maxDist) => Math.max(0, Math.min(1, (maxDist-d)/(maxDist-minDist)));

const easeInOut = t => t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;

export class CameraRig {
  constructor(camera, dom, opts={}){
    this.camera = camera;
    this.controls = new OrbitControls(camera, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.0015;
    this.controls.maxDistance = 60;
    this.bodyPosFn = opts.bodyPosFn || (()=>({x:0,y:0,z:0}));
    this.presets = opts.presets || {};
    this.followId = null;
    this._fly = null;
  }
  setPreset(name){
    const p = this.presets[name]; if(!p) return;
    this.camera.position.set(...p.pos);
    this.controls.target.set(...p.target);
    this.controls.update();
    this._fly = null; this.followId = null;
  }
  // 飞到某天体，并开始跟随
  focus(bodyId, dist){
    const pos = this.bodyPosFn(bodyId);
    const arr = [pos.x, pos.y, pos.z];
    this.controls.target.set(...arr);
    const d = dist || this.distanceFor(bodyId);
    const dir = new THREE.Vector3(0.6, 0.35, 0.72).normalize();
    const goal = new THREE.Vector3(...arr).add(dir.multiplyScalar(d));
    this._fly = { cp:this.camera.position.clone(), ct:this.controls.target.clone(), gp:goal, gt:new THREE.Vector3(...arr), t:0, dur:1.0, followId:bodyId };
    this.controls.enabled = false;
  }
  distanceFor(bodyId){
    const scale = { mercury:0.7, venus:0.9, earth:0.9, mars:0.8, jupiter:3.0, saturn:4.6, uranus:1.8, neptune:1.8, sun:3.0, moon:0.06 };
    return scale[bodyId] || 0.9;
  }
  reset(){ this.setPreset('overview'); bus.emit('camera.reset'); }
  distToTarget(){ return this.camera.position.distanceTo(this.controls.target); }
  // 以 target 为锚点按比例缩放相机距离（钳制在 min/max 内）
  dolly(factor){
    const c=this.camera, t=this.controls.target;
    const off = c.position.clone().sub(t);
    let len = off.length()*factor;
    len = Math.min(Math.max(len, this.controls.minDistance), this.controls.maxDistance);
    c.position.copy(t).add(off.normalize().multiplyScalar(len));
  }
  // 缩放滑块映射：v∈[0,1]，v=1 最近(放大)，v=0 最远(缩小)
  setZoom(v, minDist, maxDist){
    const target = zoomDist(v, minDist, maxDist);
    const cur = this.distToTarget();
    if(cur>1e-6) this.dolly(target/cur);
  }
  update(dt){
    if(this._fly){
      const f=this._fly; f.t += dt/f.dur;
      const k = easeInOut(Math.min(1,f.t));
      this.camera.position.lerpVectors(f.cp, f.gp, k);
      this.controls.target.lerpVectors(f.ct, f.gt, k);
      if(f.t>=1){ this._fly=null; this.controls.enabled=true; this.followId=f.followId; }
    } else {
      if(this.followId){
        const pos=this.bodyPosFn(this.followId);
        const delta = new THREE.Vector3(pos.x,pos.y,pos.z).sub(this.controls.target);
        this.controls.target.add(delta);
        this.camera.position.add(delta);
      }
    }
    this.controls.update();
  }
}
