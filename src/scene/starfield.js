// 程序化星场：种子确定性；银河带权重 + 色温 LUT；加法混合圆点精灵
import * as THREE from 'three';
import { SEED } from '../config.js';

const LUT = (() => {         // B-V 色温 LUT（低饱和，偏白；暖→冷）
  const l=[]; for(let i=0;i<64;i++){ l.push(new THREE.Color().setHSL(0.61 - (i/64)*0.61, 0.10, 0.55 + (i/64)*0.35)); }
  return l;
})();
const STAR_DIST = 400;       // 星场半径（AU），远大于海王星轨道，作为远景背景

function mulberry(seed){ let a=seed>>>0; return ()=>{ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }

export function createStarfield(count){
  const r = mulberry(SEED);
  const positions = new Float32Array(count*3);
  const colors = new Float32Array(count*3);
  const sizes = new Float32Array(count);
  let i=0;
  while(i < count){
    // 银河带权重
    const gauss = (r()+r()+r()+r()-2)/2;          // ~N(0,0.55)
    const lat = (r()<0.42 ? gauss*0.22 : (r()*1.0-0.5)*Math.PI); // 42% 往银河带集中
    const lon = r()*Math.PI*2;
    const ra = Math.acos(2*r()-1) - Math.PI/2;     // y 均匀
    const x = Math.cos(lon)*Math.cos(lat);
    const y = lat;                                 // 纬度近似投影（够用）
    const z = Math.sin(lon)*Math.cos(lat);
    // 归一化
    const len = Math.hypot(x,y,z)||1;
    positions[i*3]=x/len*STAR_DIST; positions[i*3+1]=y/len*STAR_DIST; positions[i*3+2]=z/len*STAR_DIST;
    const bv = r()*2.1 - 0.3;
    const li = Math.max(0,Math.min(63,(bv+0.3)/2.1*63|0));
    colors[i*3]=LUT[li].r; colors[i*3+1]=LUT[li].g; colors[i*3+2]=LUT[li].b;
    sizes[i] = 0.5 + Math.pow(r(),3)*1.8;          // 大部分小星 + 少数亮星
    i++;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors,3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes,1));

  const sprite = makeSprite();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSprite:{value:sprite} },
    vertexShader: `attribute vec3 aColor; attribute float aSize; varying vec3 vColor;
      void main(){ vColor=aColor; vec4 mv=modelViewMatrix*vec4(position,1.0);
        gl_PointSize = aSize * 620.0 / -mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D uSprite; varying vec3 vColor;
      void main(){ vec4 c=texture2D(uSprite, gl_PointCoord); gl_FragColor = vec4(vColor*c.rgb, c.a*0.65); }`,
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

function makeSprite(){
  const c=document.createElement('canvas'); c.width=64; c.height=64;
  const g=c.getContext('2d');
  const grad=g.createRadialGradient(32,32,0,32,32,32);
  grad.addColorStop(0,'rgba(255,255,255,1)'); grad.addColorStop(0.3,'rgba(255,255,255,0.6)'); grad.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=grad; g.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(c);
}
