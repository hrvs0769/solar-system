// 大气边缘辉光：菲涅尔光环（BackSide 壳，加法混合）
import * as THREE from 'three';

export function createAtmosphere(radius, colorHex, intensity=0.8){
  const geo = new THREE.SphereGeometry(radius*1.03, 48, 48);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor:{value:new THREE.Color(colorHex)}, uIntensity:{value:intensity} },
    vertexShader: `varying vec3 vNormal; varying vec3 vView;
      void main(){ vNormal=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0);
        vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uIntensity; varying vec3 vNormal; varying vec3 vView;
      void main(){ float f=pow(1.0-abs(dot(vNormal,vView)),3.0); gl_FragColor=vec4(uColor*f*uIntensity, f); }`,
    side: THREE.BackSide, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
  });
  return new THREE.Mesh(geo, mat);
}
