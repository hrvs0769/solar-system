// 天体名称标签：CSS2DRenderer 投影，可开关
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export function createLabelRenderer(){
  const renderer = new CSS2DRenderer();
  renderer.domElement.style.position='absolute';
  renderer.domElement.style.inset='0';
  renderer.domElement.style.pointerEvents='none';
  renderer.domElement.style.zIndex='2';
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('app')?.appendChild(renderer.domElement);
  return renderer;
}

export function addLabel(parent, textZh, textEn, color){
  const el = document.createElement('div');
  el.className = 'body-label';
  el.style.borderColor = color;
  el.innerHTML = `<span class="lz">${textZh}</span><span class="le">${textEn}</span>`;
  const obj = new CSS2DObject(el);
  obj.name='label';
  el.userData = obj;
  parent.add(obj);
  return obj;
}
