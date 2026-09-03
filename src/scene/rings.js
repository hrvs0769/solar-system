// 土星环：RingGeometry + 径向 UV shader（含卡西尼缝，双面受光）
import * as THREE from 'three';

export function createRings(planetRadius, ringTexture){
  const inner = 1.24, outer = 2.27;
  const geo = new THREE.RingGeometry(planetRadius*inner, planetRadius*outer, 128, 1);
  // 重算 UV：径向为 u
  const pos = geo.attributes.position; const uv = geo.attributes.uv;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), y=pos.getY(i); const rad=Math.hypot(x,y);
    const u=(rad - planetRadius*inner)/(planetRadius*outer - planetRadius*inner);
    uv.setXY(i, u, 0.5);
  }
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap:{value:ringTexture} },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D uMap; varying vec2 vUv;
      void main(){ vec4 t=texture2D(uMap, vec2(vUv.x,0.5));
        float a=t.a<0.01?0.0:t.a*0.85;   // 卡西尼缝由 alpha 体现
        vec3 col=t.rgb*(0.9); gl_FragColor=vec4(col, a); }`,
    side: THREE.DoubleSide, transparent:true, depthWrite:false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI/2;      // 置于土星赤道面（与倾角一起用）
  return mesh;
}
