// 构建太阳系系统场景（太阳/行星/月球/星场/轨道线/标签），供桌面与手机端复用
import * as THREE from 'three';
import { BODIES, LUNA, KM_PER_AU, SIZE_FACTOR_SUN, SIZE_FACTOR_PLANET } from '../config.js';
import { createSun } from './sun.js';
import { createBodyVisual } from './planet.js';
import { createStarfield } from './starfield.js';
import { createOrbitLine } from './orbits.js';
import { addLabel } from './labels.js';
import { textureStore } from './texture-store.js';

// 就地填充 system：{ scene, root, bodyGroups, sunGroup, starfield, labelObjects }
export async function buildSystem(system, labelRenderer, tier){
  system.scene = system.scene || new THREE.Scene();
  system.scene.background = new THREE.Color(0x05070d);
  system.root = new THREE.Group(); system.scene.add(system.root);
  system.bodyGroups = new Map();
  system.labelObjects = [];

  const sunDef = BODIES[0];
  const sunRadius = sunDef.radiusKm/KM_PER_AU*SIZE_FACTOR_SUN;
  const sunTex = await textureStore.surface('sun');
  const sunGroup = createSun(sunRadius, sunTex);
  sunGroup.userData.body = sunDef; sunGroup.userData.isSun = true;
  system.bodyGroups.set('sun', sunGroup); system.root.add(sunGroup);
  system.sunGroup = sunGroup;

  for(let i=1;i<BODIES.length;i++){
    const b = BODIES[i];
    const radiusAU = b.radiusKm/KM_PER_AU*b.sizeFactor;
    const group = await createBodyVisual(b, radiusAU, tier);
    system.bodyGroups.set(b.id, group); system.root.add(group);
    const orbit = createOrbitLine(b.id, b.color, b.periodDays);
    orbit.userData.bodyId = b.id; system.root.add(orbit);
    system.labelObjects.push(addLabel(group, b.name_zh, b.name_en, b.color));
  }
  const moonGroup = await createBodyVisual(LUNA, LUNA.radiusKm/KM_PER_AU*LUNA.sizeFactor, tier);
  system.bodyGroups.set('moon', moonGroup); system.root.add(moonGroup);
  system.labelObjects.push(addLabel(moonGroup,'月球','Moon', LUNA.color));
  system.labelObjects.push(addLabel(sunGroup,'太阳','Sun', sunDef.color));

  system.starfield = createStarfield(tier.stars); system.starfield.name='starfield';
  system.root.add(system.starfield);

  return system;
}
