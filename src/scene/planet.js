// 行星/月球 视觉工厂：网格 + 云层 + 土星环 + 大气辉光；按时钟自转
import * as THREE from 'three';
import { KM_PER_AU } from '../config.js';
import { createAtmosphere } from './atmosphere.js';
import { createRings } from './rings.js';
import { textureStore } from './texture-store.js';

export async function createBodyVisual(body, radiusAU, tier){
  const group = new THREE.Group();
  const axis = new THREE.Group();               // 轴倾角节点
  group.add(axis);
  axis.rotation.z = -(body.obliquityDeg||0) * Math.PI/180;

  const surface = await textureStore.surface(body.id);
  const mat = new THREE.MeshStandardMaterial({ map: surface, roughness: body.id==='earth'?0.55:0.9, metalness: 0.0 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radiusAU, 64, 64), mat);
  mesh.name='body';
  axis.add(mesh);

  let clouds=null, atmo=null, ring=null;

  if(body.clouds){
    // 云层用 alphaMap 驱动且很淡（亮=云、暗=透明），让彩色地表始终清晰可见
    const cloudTex = await textureStore.clouds();
    const cm = new THREE.MeshStandardMaterial({
      alphaMap: cloudTex, color: 0xeaf2fb, transparent:true, depthWrite:false, roughness:1, opacity:0.38,
    });
    clouds = new THREE.Mesh(new THREE.SphereGeometry(radiusAU*1.012, 48, 48), cm);
    axis.add(clouds);
  }
  if(body.atmosphere){
    atmo = createAtmosphere(radiusAU, body.atmosphere, body.id==='earth'?0.9:0.5);
    axis.add(atmo);
  }
  if(body.rings){
    const ringTex = await textureStore.ring();
    if(ringTex){ ring = createRings(radiusAU, ringTex); ring.rotation.x = -Math.PI/2; axis.add(ring); }
  }

  // 自转（含云层独立转速）
  const msr = body.siderealDays>0 ? body.siderealDays : -body.siderealDays; // 绝对值用于转速；方向由符号
  const spinSign = body.siderealDays>=0 ? 1 : -1;
  const cloudRate = body.clouds ? 1.08 : 1;

  group.userData.update = (jdDaysElapsed)=>{ // 传入 (当前jd - jd0) 天
    const rot = spinSign * (jdDaysElapsed/msr) * Math.PI*2;
    mesh.rotation.y = rot;
    if(clouds) clouds.rotation.y = rot*cloudRate;
    if(ring) group.userData.ring = ring;
  };
  group.userData.body = body;
  group.userData.radiusAU = radiusAU;
  group.userData.setTier = (t)=>{
    // 档位：贴图分辨率已定；此处仅控制显隐（低档关大气）
    if(atmo) atmo.visible = t.atmosphere!==false;
  };
  group.userData.setTier(tier);
  return group;
}
