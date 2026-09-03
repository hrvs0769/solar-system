// 太阳：光球颗粒噪声 shader（自发光）+ 菲涅尔日冕辉光壳（BackSide 加法）
import * as THREE from 'three';

export function createSun(radius, sunTexture){
  const group = new THREE.Group();
  // 光球层（自发光 + 视线方向做球面明暗，中心亮边缘暗，呈立体球）
  const geo = new THREE.SphereGeometry(radius, 96, 96);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap:{value:sunTexture}, uTime:{value:0} },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv=uv; vN=normalize(normalMatrix*normal);
        vec4 mv=modelViewMatrix*vec4(position,1.0); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform float uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
        float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
        return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
      float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
      void main(){
        vec3 base=texture2D(uMap, vUv).rgb;
        // 细米粒组织（高频）
        float gran = 0.7*fbm(vUv*95.0 + uTime*0.02) + 0.3*fbm(vUv*190.0 - uTime*0.03);
        vec3 col = base * (0.90 + 0.40*gran);
        // 黑子（轻微暗斑，避免整体发黑）
        float spot = smoothstep(0.82, 0.97, fbm(vUv*17.0 - uTime*0.0012));
        col *= (1.0 - 0.30*spot);
        // 白热核心 + 偏暖边缘（主序星）
        col = mix(col, vec3(1.0,0.95,0.82), 0.30);
        // 临边昏暗：中心亮、边缘略暗但整体明亮
        float mu = abs(dot(normalize(vN), normalize(vV)));
        col *= (0.58 + 0.72*pow(mu, 0.6));
        col *= 1.35;
        gl_FragColor = vec4(min(col, 1.2), 1.0);   // 亮但不至于全白
      }`,
  });
  const photosphere = new THREE.Mesh(geo, mat);
  photosphere.name='sun';
  // 光球表面米粒组织随真实时间缓慢流动（不冻结）
  photosphere.onBeforeRender = ()=>{ mat.uniforms.uTime.value = performance.now()/1000; };
  group.add(photosphere);

  // 柔和日冕底色：BackSide 菲涅尔加法壳（很淡）
  const glowGeo = new THREE.SphereGeometry(radius*1.22, 48, 48);
  const glowMat = new THREE.ShaderMaterial({
    vertexShader: `varying vec3 vN; varying vec3 vView;
      void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vView;
      void main(){ float f=pow(1.0-abs(dot(normalize(vN),normalize(vView))),2.0);
        vec3 c=mix(vec3(1.0,0.5,0.15), vec3(1.0,0.85,0.5), f);
        gl_FragColor=vec4(c*0.4, f*0.35); }`,
    side: THREE.BackSide, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
  });
  group.add(new THREE.Mesh(glowGeo, glowMat));

  // —— 动态日冕（纯 shader 生成，逐帧朝向相机；无额外库）——
  const corona = makeCorona(radius);
  group.add(corona);
  corona.onBeforeRender = (r2, s2, cam)=>{ corona.quaternion.copy(cam.quaternion); corona.material.uniforms.uTime.value = performance.now()/1000; };

  // 太阳点光源（照亮全系）
  const light = new THREE.PointLight(0xffffff, 3.2, 0, 0);
  group.add(light);

  return group;
}
// 动态日冕：贴近日面的细薄白色羽状光晕，随时间轻缓流动（真实日全食日冕风格）
function makeCorona(radius){
  const size = radius*4.2;           // 直径约 4.2 个太阳半径（只超出日面约 1 个半径）
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,          // 太阳自转时避免背面剔除
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{ uTime:{value:0}, uCol:{value:new THREE.Color(0xfff2e0)} },
    vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`
      uniform float uTime; uniform vec3 uCol; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
        float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
        return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
      void main(){
        vec2 q = vUv*2.0-1.0;
        float r = length(q);
        if(r>1.0 || r<0.44) discard;               // 只保留贴近日面的窄环带
        float ang = atan(q.y,q.x);
        // 细密流苏（低对比、缓动）
        float s = noise(vec2(ang*6.0 + uTime*0.10, r*9.0 - uTime*0.04))*0.62
                + noise(vec2(ang*18.0 - uTime*0.14, r*18.0 + uTime*0.02))*0.38;
        float halo = smoothstep(1.0, 0.44, r);      // 贴近日面亮，向外快速衰减
        float ray  = smoothstep(0.45, 0.85, s);     // 只取细流苏
        float a = halo*(0.08 + 0.26*ray);           // 很低的不透明 → 很淡
        vec3 col = mix(uCol, vec3(0.99,0.97,0.92), ray);
        gl_FragColor = vec4(col, a);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1,1), mat);
  m.scale.set(size, size, 1);
  m.name='corona';
  return m;
}
