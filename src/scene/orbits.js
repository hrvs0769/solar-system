// 轨道线：由实际解算轨迹采样（与行星位置严格一致），LineLoop
import * as THREE from 'three';
import { helioScene, beginFrame } from '../sim/astro.js';

export function createOrbitLine(bodyId, colorHex, periodDays){
  const N = 360;
  const period = Number.isFinite(periodDays) ? periodDays : 365;  // 兜底，防 NaN 崩溃
  const pts = [];
  const jd0 = 2451545.0; // J2000
  for(let i=0;i<=N;i++){
    const jd = jd0 + period * (i/N);
    beginFrame(jd);
    const p = helioScene(bodyId, jd);
    pts.push(new THREE.Vector3(p.x, p.y, p.z));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(colorHex), transparent:true, opacity:0.8 });
  const line = new THREE.LineLoop(geo, mat);
  line.name='orbit-'+bodyId;
  return line;
}
