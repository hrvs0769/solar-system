// 嫦娥奔月 · 独立电影模块：文昌微缩城地面发射 → 平地→球面 → 地球轨道 → 地月转移 → 绕月 → 月面观察着陆
// 自成一体的 missionScene + 电影比例，主线渲染切换，复用相机/贴图/HUD/弹窗。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bus } from '../sim/bus.js';
import { textureStore } from '../scene/texture-store.js';
import { ModuleBase } from './module-base.js';
import { isKidMode } from '../ui/kid-mode.js';

// —— 电影舞台比例（非 AU，自洽）——
const RE=1.0, RM=0.27, MD=15.0, PARK=1.35, LUNAR_R=0.6, LUNAR_ORBITS=2;
const ORDER=['COUNTDOWN','IGNITION','LIFTOFF','SPHERE','STAGE_SEP','EARTH_ORBIT','TRANSFER','LOI','LUNAR_ORBIT','LANDING','LANDED'];
const DUR={ COUNTDOWN:4.0, IGNITION:2.0, LIFTOFF:6.5, SPHERE:9, STAGE_SEP:4, EARTH_ORBIT:9, TRANSFER:18, LOI:3, LUNAR_ORBIT:8, LANDING:11 };
const PHASE_NAME={ COUNTDOWN:'发射倒计时', IGNITION:'点火', LIFTOFF:'升空', SPHERE:'俯瞰地球', STAGE_SEP:'分级脱离', EARTH_ORBIT:'地球轨道', TRANSFER:'地月转移', LOI:'月球制动', LUNAR_ORBIT:'绕月飞行', LANDING:'登月下降', LANDED:'着陆月球' };
const PHASE_NAME_KID={ COUNTDOWN:'倒计时', IGNITION:'点火', LIFTOFF:'升空', SPHERE:'看看地球', STAGE_SEP:'助推器分离', EARTH_ORBIT:'绕地球飞', TRANSFER:'飞向月球', LOI:'踩刹车', LUNAR_ORBIT:'绕月飞行', LANDING:'准备降落', LANDED:'着陆月球' };
const WHY={ COUNTDOWN:'一切就绪，等待点火', IGNITION:'火焰 + 导流槽水雾喷涌', LIFTOFF:'突破大气，逐渐摆脱地球引力',
  SPHERE:'升得更高——你看，地球原来是一个球', STAGE_SEP:'分级脱离：多级更省燃料', EARTH_ORBIT:'火箭绕地球一圈，获得入轨速度',
  TRANSFER:'上面级分离，嫦娥卫星出舱 · 为什么不是直线飞？沿椭圆最省燃料', LOI:'为什么必须制动？不减速会飞过月球', LUNAR_ORBIT:'嫦娥绕月探测，寻找落点',
  LANDING:'反推减速 → 缓缓降落', LANDED:'已在月球表面' };
const WHY_KID={ COUNTDOWN:'数到零，火箭就出发', IGNITION:'点火！屁股后面喷出大火', LIFTOFF:'飞起来啦，越飞越高',
  SPHERE:'看，地球原来是个大圆球', STAGE_SEP:'用完的助推器掉下去，火箭变轻了', EARTH_ORBIT:'绕着地球转一圈，就能跑得更快',
  TRANSFER:'离开地球，向月球飞去 · 走弯路反而更省力', LOI:'快到月球了，要踩刹车，不然会飞过头', LUNAR_ORBIT:'绕着月球转圈圈，找地方降落',
  LANDING:'慢慢往下落，别摔着', LANDED:'稳稳地停在月球上' };

function mkTex(w,h,cb,opt={}){
  const c=document.createElement('canvas'); c.width=w; c.height=h; cb(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);
  if(opt.linear!==true) t.colorSpace=THREE.SRGBColorSpace;
  t.anisotropy=4;
  if(opt.repeat){ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(opt.repeat[0],opt.repeat[1]); }
  return t;
}
const ease=t=>t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
let _softDot=null,_blobTex=null,_flameTex=null,_smokeTex=null,_groundTex=null,_concTex=null,_hullTex=null,_fairTex=null,_panelTex=null,_goldTex=null,_solarTex=null;

// 柔光点（粒子）
function softDot(){ if(_softDot) return _softDot; _softDot=mkTex(64,64,(g)=>{ const gr=g.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.35,'rgba(255,255,255,.55)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr; g.fillRect(0,0,64,64); }); return _softDot; }
// 云团/烟团（不规则软块）
function blobTex(){ if(_blobTex) return _blobTex; _blobTex=mkTex(128,128,(g)=>{
  for(let i=0;i<14;i++){ const x=30+Math.random()*68,y=30+Math.random()*68,r=14+Math.random()*26;
    const gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,'rgba(255,255,255,.55)'); gr.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=gr; g.fillRect(0,0,128,128); }
  const vg=g.createRadialGradient(64,64,10,64,64,62); vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,1)');
  g.globalCompositeOperation='destination-out'; g.fillStyle=vg; g.fillRect(0,0,128,128); g.globalCompositeOperation='source-over'; }); return _blobTex; }
// 尾焰：横向亮芯→暗边，纵向（v=1 喷口处最亮）到尾部渐隐 + 湍流条纹
function flameTex(){ if(_flameTex) return _flameTex; _flameTex=mkTex(256,256,(g,w,h)=>{
  const img=g.createImageData(w,h), d=img.data;
  for(let y=0;y<h;y++){ const v=1-y/h;                       // v: 1=喷口
    for(let x=0;x<w;x++){ const u=(x/w-0.5)*2;               // -1..1
      const core=Math.exp(-Math.pow(u/0.34,2)*2.2);
      const wide=Math.exp(-Math.pow(u/0.92,2)*2.6)*0.5;
      let turb=0.72+0.28*Math.sin(y*0.42+Math.sin(x*0.17)*2.2)*Math.sin(x*0.11+1.3);
      const clip=Math.min(1,(1-Math.abs(u))*5);
      const a=Math.max(0,Math.min(1,(core*1.0+wide*0.55)*turb*clip*(0.35+v*1.0)*(v>0.06?1:0)));
      const t=Math.max(0,Math.min(1,(core*1.25+wide*0.4)*clip));
      d[(y*w+x)*4+0]=255;
      d[(y*w+x)*4+1]=Math.round(150+100*t);
      d[(y*w+x)*4+2]=Math.round(60+180*Math.pow(t,1.5));
      d[(y*w+x)*4+3]=Math.round(a*255);
    } }
  g.putImageData(img,0,0); }); return _flameTex; }
// 尾焰外发光（加色混合用，中心亮、边缘透明）
function glowTex(){ return _smokeTex||(_smokeTex=mkTex(128,256,(g,w,h)=>{
  const img=g.createImageData(w,h), d=img.data;
  for(let y=0;y<h;y++){ const v=1-y/h;
    for(let x=0;x<w;x++){ const u=(x/w-0.5)*2;
      const a=Math.exp(-Math.pow(u/0.75,2)*2.0)*Math.pow(Math.max(0,v),1.3)*0.9;
      d[(y*w+x)*4+0]=255; d[(y*w+x)*4+1]=Math.round(120+70*v); d[(y*w+x)*4+2]=40;
      d[(y*w+x)*4+3]=Math.round(Math.max(0,Math.min(1,a))*255); } }
  g.putImageData(img,0,0); })); }
// 发射场地表（土壤/草地/混凝土/道路 大尺度）
function groundTex(){ if(_groundTex) return _groundTex; _groundTex=mkTex(1024,1024,(g,w,h)=>{
  g.fillStyle='#5c6b4a'; g.fillRect(0,0,w,h);                            // 草地/灌木
  for(let i=0;i<900;i++){ const x=Math.random()*w,y=Math.random()*h,r=8+Math.random()*70;
    const t=Math.random(); g.fillStyle=t<0.42?`rgba(122,116,86,${0.05+Math.random()*0.16})`
      :t<0.72?`rgba(70,88,56,${0.06+Math.random()*0.18})`:`rgba(148,140,112,${0.04+Math.random()*0.12})`;
    g.beginPath(); g.ellipse(x,y,r,r*(0.5+Math.random()),Math.random()*3,0,7); g.fill(); }
  for(let i=0;i<5000;i++){ g.fillStyle=`rgba(${Math.random()<0.5?40:210},${Math.random()<0.5?50:200},40,${Math.random()*0.05})`;
    g.fillRect(Math.random()*w,Math.random()*h,2,2); }
  const vg=g.createRadialGradient(w/2,h/2,w*0.06,w/2,h/2,w*0.5);          // 中心发射区压暗
  vg.addColorStop(0,'rgba(120,116,104,.55)'); vg.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=vg; g.fillRect(0,0,w,h); });
  _groundTex.wrapS=_groundTex.wrapT=THREE.RepeatWrapping; return _groundTex; }
// 混凝土（发射坪/场地）
function concTex(){ if(_concTex) return _concTex; _concTex=mkTex(512,512,(g,w,h)=>{
  g.fillStyle='#9d9e9a'; g.fillRect(0,0,w,h);
  for(let i=0;i<2600;i++){ const v=Math.random()*46-23; g.fillStyle=`rgba(${128+v},${128+v},${126+v},.35)`; g.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*3,1+Math.random()*3); }
  for(let i=0;i<120;i++){ const x=Math.random()*w,y=Math.random()*h,r=6+Math.random()*46;
    const gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,`rgba(${60+Math.random()*40},${58+Math.random()*40},${54+Math.random()*40},.12)`); gr.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=gr; g.fillRect(x-r,y-r,r*2,r*2); }
  g.strokeStyle='rgba(60,60,58,.45)'; g.lineWidth=2;                       // 分格缝
  for(let i=0;i<=8;i++){ g.beginPath(); g.moveTo(i/8*w,0); g.lineTo(i/8*w,h); g.stroke(); g.beginPath(); g.moveTo(0,i/8*h); g.lineTo(w,i/8*h); g.stroke(); }
  g.strokeStyle='rgba(230,230,226,.30)'; g.lineWidth=1;
  for(let i=0;i<=8;i++){ g.beginPath(); g.moveTo(i/8*w+2,0); g.lineTo(i/8*w+2,h); g.stroke(); g.beginPath(); g.moveTo(0,i/8*h+2); g.lineTo(w,i/8*h+2); g.stroke(); } },{repeat:[1,1]});
  return _concTex; }
// 芯级贮箱外壁：米白隔热层 + 拼缝 + 环缝 + 污渍 + 标识
function hullTex(){ if(_hullTex) return _hullTex; _hullTex=mkTex(1024,1024,(g,w,h)=>{
  g.fillStyle='#e8e4da'; g.fillRect(0,0,w,h);
  for(let i=0;i<64;i++){ const x=i/64*w; g.fillStyle='rgba(126,122,112,.30)'; g.fillRect(x,0,1.6,h); }
  for(let i=0;i<64;i++){ const x=(i+.5)/64*w; g.fillStyle='rgba(255,255,255,.42)'; g.fillRect(x,0,1.2,h); }
  for(let i=0;i<26;i++){ const y=i/26*h; g.fillStyle='rgba(112,108,98,.20)'; g.fillRect(0,y,w,1.6); }
  for(let i=0;i<260;i++){ const x=Math.random()*w,y=Math.random()*h,r=4+Math.random()*30;
    const gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,'rgba(96,92,82,.10)'); gr.addColorStop(1,'rgba(96,92,82,0)'); g.fillStyle=gr; g.fillRect(x-r,y-r,r*2,r*2); }
  [0.5,0.15].forEach(u=>{ const cx=u*w, cy=h*0.40;
    g.textAlign='center';
    g.save(); g.translate(cx,cy);
    g.fillStyle='#c8102e'; g.font='bold 62px "PingFang SC",sans-serif'; g.fillText('中国航天',0,0);
    g.fillStyle='#12386e'; g.font='bold 40px sans-serif'; g.fillText('CZ-5',0,54);
    g.fillStyle='#8a1a1a'; g.font='bold 34px "PingFang SC",sans-serif'; g.fillText('嫦娥奔月',0,102);
    g.fillStyle='#de2910'; g.fillRect(-42,124,84,56);                       // 国旗
    g.fillStyle='#ffde00'; g.beginPath(); g.arc(-24,140,7,0,7); g.fill();
    g.fillStyle='#ffde00'; g.beginPath(); g.arc(-6,152,4,0,7); g.fill();
    g.restore(); }); }); return _hullTex; }
// 整流罩：白漆 + 红/蓝带 + 标识
function fairTex(){ if(_fairTex) return _fairTex; _fairTex=mkTex(512,512,(g,w,h)=>{
  g.fillStyle='#f2f1ee'; g.fillRect(0,0,w,h);
  g.fillStyle='#c8102e'; g.fillRect(0,h*0.60,w,10);
  g.fillStyle='#12386e'; g.fillRect(0,h*0.63,w,6);
  for(let i=0;i<700;i++){ const x=Math.random()*w,y=Math.random()*h; g.fillStyle=`rgba(150,148,142,${Math.random()*0.10})`; g.fillRect(x,y,2,2); }
  [0.5,0.15].forEach(u=>{ const cx=u*w; g.textAlign='center'; g.fillStyle='#c8102e'; g.font='bold 54px "PingFang SC",sans-serif'; g.fillText('嫦娥五号',cx,h*0.30);
    g.fillStyle='#12386e'; g.font='bold 30px sans-serif'; g.fillText('CHANG E-5',cx,h*0.38); }); }); return _fairTex; }
// 金属/建筑外墙板
function panelTex(){ if(_panelTex) return _panelTex; _panelTex=mkTex(512,512,(g,w,h)=>{
  g.fillStyle='#cfd3d8'; g.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=16){ g.fillStyle='rgba(120,126,134,.35)'; g.fillRect(0,y,w,1.6); g.fillStyle='rgba(255,255,255,.30)'; g.fillRect(0,y+2,w,1.2); }
  for(let x=0;x<w;x+=64){ g.fillStyle='rgba(120,126,134,.28)'; g.fillRect(x,0,1.6,h); }
  for(let i=0;i<420;i++){ const x=Math.random()*w,y=Math.random()*h,r=3+Math.random()*22;
    const gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,'rgba(96,100,106,.12)'); gr.addColorStop(1,'rgba(96,100,106,0)'); g.fillStyle=gr; g.fillRect(x-r,y-r,r*2,r*2); } },{repeat:[1,1]}); return _panelTex; }
function craterTex(){ return mkTex(1024,1024,(g,w,h)=>{
  g.fillStyle='#a5a199'; g.fillRect(0,0,w,h);
  for(let i=0;i<70;i++){ const x=Math.random()*w,y=Math.random()*h,r=90+Math.random()*260;      // 月海暗斑
    const gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,'rgba(104,101,96,.34)'); gr.addColorStop(1,'rgba(104,101,96,0)');
    g.fillStyle=gr; g.beginPath(); g.arc(x,y,r,0,7); g.fill(); }
  for(let i=0;i<4200;i++){ const v=Math.random()*48-24; g.fillStyle=`rgba(${150+v},${147+v},${140+v},.55)`; g.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*3,1+Math.random()*3); }
  const crater=(x,y,r,deep)=>{
    g.save(); g.translate(x,y); g.scale(1,0.86+Math.random()*0.2); g.rotate(Math.random()*3);
    let gr=g.createRadialGradient(0,0,0,0,0,r);                                                  // 坑底
    gr.addColorStop(0,`rgba(64,62,59,${0.52*deep})`); gr.addColorStop(0.5,`rgba(86,83,79,${0.42*deep})`);
    gr.addColorStop(0.82,`rgba(126,122,116,${0.18*deep})`); gr.addColorStop(1,'rgba(150,146,140,0)');
    g.fillStyle=gr; g.beginPath(); g.arc(0,0,r,0,7); g.fill();
    gr=g.createRadialGradient(0,0,r*0.78,0,0,r*1.08);                                            // 柔和坑缘亮环
    gr.addColorStop(0,'rgba(214,210,202,0)'); gr.addColorStop(0.5,`rgba(216,212,204,${0.26*deep})`); gr.addColorStop(1,'rgba(214,210,202,0)');
    g.fillStyle=gr; g.beginPath(); g.arc(0,0,r*1.08,0,7); g.fill();
    g.restore();
  };
  for(let i=0;i<300;i++) crater(Math.random()*w,Math.random()*h,12+Math.random()*86,0.85+Math.random()*0.35);
  for(let i=0;i<1500;i++) crater(Math.random()*w,Math.random()*h,3+Math.random()*10,0.5+Math.random()*0.5);
},{repeat:[1,1]}); }
// 月面近景：球形帽(撞击坑贴图) + 碎石，落在着陆点正下方
function buildLunarPatch(){
  const g=new THREE.Group();
  const capA=Math.asin(Math.min(0.9,0.30/RM));
  const cap=new THREE.Mesh(new THREE.SphereGeometry(RM*1.003,64,40,0,Math.PI*2,0,capA),
    new THREE.MeshStandardMaterial({map:craterTex(), roughness:.98, metalness:0}));
  cap.receiveShadow=true; g.add(cap);
  const rockMat=new THREE.MeshStandardMaterial({color:0x6e6b65, roughness:.98, metalness:0, flatShading:true});
  for(let i=0;i<9;i++){ const a=Math.random()*Math.PI*2, d=0.06+Math.random()*0.18;
    const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(0.0035+Math.random()*0.006,0), rockMat);
    const r0=Math.sqrt(Math.max(0.0001,RM*RM-d*d))-0.0016;
    rock.position.set(Math.cos(a)*d, r0, Math.sin(a)*d);
    rock.scale.set(1,0.34+Math.random()*0.3,0.8+Math.random()*0.5);
    rock.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);
    rock.castShadow=true; rock.receiveShadow=true; g.add(rock); }
  g.visible=false;
  return g;
}
function goldTex(){ if(_goldTex) return _goldTex; _goldTex=mkTex(128,64,g=>{ g.fillStyle='#8a6a1e'; g.fillRect(0,0,128,64); for(let y=0;y<64;y+=2){ const b=0.72+0.28*((y*31)%9)/9; g.fillStyle=`rgb(${Math.round(190*b)},${Math.round(140*b)},${Math.round(45*b)})`; g.fillRect(0,y,128,2); } }); return _goldTex; }
function solarTex(){ if(_solarTex) return _solarTex; _solarTex=mkTex(128,64,g=>{ g.fillStyle='#06132e'; g.fillRect(0,0,128,64); for(let y=0;y<4;y++)for(let x=0;x<8;x++){ const b=0.26+0.16*((x*7+y*13)%9)/9; g.fillStyle=`rgb(${Math.round(18+b*50)},${Math.round(45+b*70)},${Math.round(110+b*95)})`; g.fillRect(x*16+1,y*16+1,14,14); } for(let x=0;x<=8;x++){ g.strokeStyle='rgba(210,230,255,.3)'; g.beginPath(); g.moveTo(x*16,0); g.lineTo(x*16,64); g.stroke(); } for(let y=0;y<=4;y++){ g.beginPath(); g.moveTo(0,y*16); g.lineTo(128,y*16); g.stroke(); } }); return _solarTex; }

// —— 桁架/构件工具：用「两点一根杆」拼出真实桁架（合并成一个几何体，省 draw call）——
function member(parts, ax,ay,az, bx,by,bz, t){
  const a=new THREE.Vector3(ax,ay,az), b=new THREE.Vector3(bx,by,bz);
  const dir=new THREE.Vector3().subVectors(b,a); const len=dir.length(); if(len<1e-6) return;
  const gg=new THREE.BoxGeometry(t,len,t);
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize());
  const m=new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a,b).multiplyScalar(0.5), q, new THREE.Vector3(1,1,1));
  gg.applyMatrix4(m); parts.push(gg);
}
function trussParts(w,d,h,levels,col=.0016,brace=.0011){
  const p=[], hw=w/2, hd=d/2, lv=h/levels;
  for(let i=0;i<=levels;i++){ const y=i*lv;
    for(const [sx,sz] of [[-hw,-hd],[hw,-hd],[-hw,hd],[hw,hd]]) member(p,sx,y,sz,sx,Math.min(y+lv,h),sz,col);
    member(p,-hw,y,-hd,hw,y,-hd,brace*.9); member(p,-hw,y,hd,hw,y,hd,brace*.9);
    member(p,-hw,y,-hd,-hw,y,hd,brace*.9); member(p,hw,y,-hd,hw,y,hd,brace*.9); }
  for(let i=0;i<levels;i++){ const y0=i*lv,y1=(i+1)*lv, s=(i%2)?1:-1;
    member(p,-hw,y0,-hd, hw,y1,-hd, brace); member(p,hw,y0,-hd, -hw,y1,-hd, brace);
    member(p,-hw,y0,hd, hw,y1,hd, brace); member(p,hw,y0,hd, -hw,y1,hd, brace);
    member(p,-hw,y0,-hd, -hw,y1,hd, brace); member(p,-hw,y0,hd, -hw,y1,-hd, brace);
    member(p,hw,y0,-hd, hw,y1,hd, brace); member(p,hw,y0,hd, hw,y1,-hd, brace); }
  return p;
}
// 圆滑整流罩/头锥母线（冯·卡门近似）
function ogive(r,h,seg=20,cyl=0){ const pts=[]; if(cyl>0) pts.push(new THREE.Vector2(r,0),new THREE.Vector2(r,cyl));
  const n=seg; for(let i=0;i<=n;i++){ const t=i/n; const rr=r*Math.pow(Math.max(0,1-t*t),0.62); pts.push(new THREE.Vector2(rr, cyl+h*t)); }
  return new THREE.LatheGeometry(pts, 24); }
// 钟形喷管
function bellGeo(rt,re,h,seg=18){ const pts=[]; const n=10;
  for(let i=0;i<=n;i++){ const t=i/n; const rr=rt+(re-rt)*Math.pow(t,0.62); pts.push(new THREE.Vector2(rr,t*h)); }
  const g=new THREE.LatheGeometry(pts,seg); return g; }

// —— 发射场：海风草原 + 混凝土发射区 + 导流槽 + 发射台 ——
function buildGround(){
  const g=new THREE.Group();
  const terrainMat=new THREE.MeshStandardMaterial({map:groundTex(), roughness:.98, metalness:0});
  const terrain=new THREE.Mesh(new THREE.CircleGeometry(6.5,96), terrainMat);
  terrain.rotation.x=-Math.PI/2; terrain.receiveShadow=true; g.add(terrain);
  const concMat=new THREE.MeshStandardMaterial({map:concTex(), roughness:.9, metalness:0});
  const concMat2=concMat.clone(); concMat2.map=concTex().clone(); concMat2.map.needsUpdate=true;
  concMat2.map.wrapS=concMat2.map.wrapT=THREE.RepeatWrapping; concMat2.map.repeat.set(6,6);
  const apron=new THREE.Mesh(new THREE.PlaneGeometry(0.78,0.62), concMat2);
  apron.rotation.x=-Math.PI/2; apron.position.set(0.01,0.0006,0.03); apron.receiveShadow=true; g.add(apron);
  // 导流槽（朝 -Z 开口，正对英雄机位）+ 火焰偏导锥
  const trenchMat=new THREE.MeshStandardMaterial({color:0x6a6a66, roughness:.95});
  const trenchInMat=new THREE.MeshStandardMaterial({color:0x2a2926, roughness:1});
  const TL=0.24,TW=0.055,TD=0.022;
  const trenchIn=new THREE.Mesh(new THREE.BoxGeometry(TW,0.004,TL), trenchInMat);      // 槽底
  trenchIn.position.set(0,-TD,0.045+TL/2); g.add(trenchIn);
  [[-1],[1]].forEach(([s2])=>{ const wall=new THREE.Mesh(new THREE.BoxGeometry(0.006,TD,TL), trenchMat);   // 侧壁
    wall.position.set(s2*(TW/2+0.003),-TD/2,0.045+TL/2); wall.castShadow=true; wall.receiveShadow=true; g.add(wall); });
  const endw=new THREE.Mesh(new THREE.BoxGeometry(TW+0.012,TD,0.006), trenchMat);      // 端壁
  endw.position.set(0,-TD/2,0.045+TL); g.add(endw);
  const wedge=new THREE.Mesh(new THREE.CylinderGeometry(0.0,0.026,0.018,4,1), new THREE.MeshStandardMaterial({color:0x6d6a64, roughness:.85}));
  wedge.rotation.y=Math.PI/4; wedge.position.set(0,0.011,0.019); g.add(wedge);
  // 发射台（钢筋混凝土，顶面 y=0.006）
  const base=new THREE.Mesh(new THREE.CylinderGeometry(0.052,0.058,0.013,32), concMat);
  base.position.y=-0.0005; base.castShadow=true; base.receiveShadow=true; g.add(base);
  const deck=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.004,32), new THREE.MeshStandardMaterial({color:0x8e9095, roughness:.8, metalness:.15}));
  deck.position.y=0.005; deck.castShadow=true; deck.receiveShadow=true; g.add(deck);
  const hole=new THREE.Mesh(new THREE.CylinderGeometry(0.021,0.021,0.02,24), new THREE.MeshStandardMaterial({color:0x1c1b1a, roughness:1}));
  hole.position.y=0.0; g.add(hole);
  // 4 个压紧夹具 + 摆杆支座
  for(let i=0;i<4;i++){ const a=i*Math.PI/2+Math.PI/4;
    const clamp=new THREE.Mesh(new THREE.BoxGeometry(0.006,0.008,0.01), new THREE.MeshStandardMaterial({color:0x5a5f66, metalness:.8, roughness:.45}));
    clamp.position.set(Math.cos(a)*0.026,0.01,Math.sin(a)*0.026); clamp.castShadow=true; g.add(clamp); }
  // 道路（总装厂房 → 发射区）
  const roadMat=new THREE.MeshStandardMaterial({color:0x45484d, roughness:.95});
  const lineMat=new THREE.MeshBasicMaterial({color:0xb9bda8});
  const road=(ax,az,bx,bz,w)=>{
    const len=Math.hypot(bx-ax,bz-az), ang=Math.atan2(bz-az,bx-ax);
    const geo=new THREE.PlaneGeometry(len,w); geo.rotateX(-Math.PI/2); geo.rotateY(-ang);
    const m=new THREE.Mesh(geo, roadMat); m.position.set((ax+bx)/2,0.0011,(az+bz)/2); m.receiveShadow=true; g.add(m);
    const line=new THREE.Mesh(new THREE.PlaneGeometry(len*0.96,0.0016), lineMat);
    line.geometry.rotateX(-Math.PI/2); line.geometry.rotateY(-ang);
    line.position.set((ax+bx)/2,0.0013,(az+bz)/2); g.add(line);
  };
  road(0.44,0.10,-0.06,0.02,0.020); road(-0.32,-0.24,0.02,-0.02,0.014); road(0.44,-0.06,0.07,-0.03,0.013);
  return g;
}
// —— 脐带塔（真桁架 + 平台 + 摆杆 + 避雷针）——
function buildTower(){
  const g=new THREE.Group();
  const steel=new THREE.MeshStandardMaterial({color:0x9ba3ad, metalness:.75, roughness:.45});
  const dark=new THREE.MeshStandardMaterial({color:0x5c626b, metalness:.7, roughness:.5});
  const TH=0.20, W=0.020, D=0.018;
  const parts=trussParts(W,D,TH,13,0.0015,0.0011);                  // 主桁架
  for(let i=1;i<=6;i++){ const y=i/6*TH*0.94;                       // 平台
    const p=[]; member(p,-W/2-0.002,y,-D/2-0.002, W/2+0.002,y,-D/2-0.002,0.003);
    member(p,-W/2-0.002,y,-D/2-0.002, -W/2-0.002,y,D/2+0.002,0.003);
    member(p,-W/2-0.002,y,D/2+0.002, W/2+0.002,y,D/2+0.002,0.003);
    member(p,W/2+0.002,y,-D/2-0.002, W/2+0.002,y,D/2+0.002,0.003);
    member(p,-W/2,y,-D/2, W/2,y,D/2,0.0018); member(p,W/2,y,-D/2, -W/2,y,D/2,0.0018);   // 斜撑
    const m=new THREE.Mesh(p[0],dark); m.castShadow=true; g.add(m); }
  // 摆杆（三层，指向火箭）
  [0.055,0.10,0.155].forEach((y,i)=>{ const p=[];
    member(p,0,y,-D/2, 0.030,y,0.004,0.0035); member(p,0.0,y,-D/2, 0.030,y-0.010,0.004,0.0016);
    const m=new THREE.Mesh(p[0], new THREE.MeshStandardMaterial({color:i===0?0xd8b25a:0x8d949e, metalness:.6, roughness:.5}));
    m.castShadow=true; g.add(m); });
  const truss=new THREE.Mesh(mergeGeometries(parts), steel); truss.castShadow=true; truss.receiveShadow=true; g.add(truss);
  // 混凝土基座 + 避雷针
  const base=new THREE.Mesh(new THREE.BoxGeometry(W+0.008,0.012,D+0.008), new THREE.MeshStandardMaterial({map:concTex(), roughness:.92}));
  base.position.y=0.006; base.castShadow=true; base.receiveShadow=true; g.add(base);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.0006,0.0014,0.05,8), steel);
  mast.position.y=TH+0.025; g.add(mast);
  const tip=new THREE.Mesh(new THREE.SphereGeometry(0.0022,10,8), new THREE.MeshBasicMaterial({color:0xff3b30}));
  tip.position.y=TH+0.051; g.add(tip);
  g.position.set(0.002,0,0.048); g.rotation.y=Math.PI/2;
  return g;
}
// —— 地面设施：总装厂房 / 低温贮罐区 / 控制中心 / 水塔 ——
function buildFacilities(){
  const g=new THREE.Group();
  const wallMat=new THREE.MeshStandardMaterial({map:panelTex(), roughness:.7, metalness:.25});
  const roofMat=new THREE.MeshStandardMaterial({color:0x7d848d, roughness:.8, metalness:.3});
  const concMat=new THREE.MeshStandardMaterial({map:concTex(), roughness:.92});
  const glassMat=new THREE.MeshStandardMaterial({color:0x2b4a63, metalness:.5, roughness:.18, emissive:0x0a1622, emissiveIntensity:0.6});
  // 总装厂房(VAB)：主体 + 檐口 + 竖向壁柱 + 玻璃带 + 大门
  const vab=new THREE.Group();
  const bw=0.17,bh=0.135,bd=0.105;
  const body=new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bd), wallMat); body.position.y=bh/2; body.castShadow=true; body.receiveShadow=true; vab.add(body);
  const cornice=new THREE.Mesh(new THREE.BoxGeometry(bw+0.004,0.004,bd+0.004), roofMat); cornice.position.y=bh+0.002; cornice.castShadow=true; vab.add(cornice);
  for(let i=0;i<=10;i++){ const px=-bw/2+i/10*bw; const col=new THREE.Mesh(new THREE.BoxGeometry(0.004,bh,0.004), roofMat);
    col.position.set(px,bh/2,bd/2+0.0006); vab.add(col); }
  const glass=new THREE.Mesh(new THREE.BoxGeometry(bw*0.96,0.010,0.0016), glassMat); glass.position.set(0,bh*0.74,bd/2+0.0012); vab.add(glass);
  const door=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.085,0.0022), new THREE.MeshStandardMaterial({color:0x6f7580, metalness:.6, roughness:.5}));
  door.position.set(0,0.0425,bd/2+0.0012); vab.add(door);
  const doorSeam=new THREE.Mesh(new THREE.BoxGeometry(0.0015,0.085,0.0026), roofMat); doorSeam.position.set(0,0.0425,bd/2+0.0016); vab.add(doorSeam);
  vab.position.set(0.40,0,0.20); vab.rotation.y=-0.42; g.add(vab);
  // 低温贮罐区：球罐 + 立式罐 + 管路
  const tankMat=new THREE.MeshStandardMaterial({color:0xe6e9ec, metalness:.35, roughness:.35});
  const pipeMat=new THREE.MeshStandardMaterial({color:0xa8aeb6, metalness:.7, roughness:.4});
  { const farm=new THREE.Group(); farm.position.set(-0.215,0,0.115);
    // 围堰
    const bund=new THREE.Mesh(new THREE.BoxGeometry(0.062,0.006,0.062), new THREE.MeshStandardMaterial({map:concTex(), roughness:.94}));
    bund.position.y=0.003; bund.castShadow=true; bund.receiveShadow=true; farm.add(bund);
    const bundIn=new THREE.Mesh(new THREE.BoxGeometry(0.052,0.007,0.052), new THREE.MeshStandardMaterial({color:0x8e8b84, roughness:.95}));
    bundIn.position.y=0.0035; farm.add(bundIn);
    const pipeR=[];
    [[-0.017,-0.017],[0.017,0.014]].forEach(([x,z])=>{                                 // 两台立式储罐
      const t=new THREE.Mesh(new THREE.CylinderGeometry(0.0115,0.0115,0.030,20), tankMat); t.position.set(x,0.022,z); t.castShadow=true; farm.add(t);
      const c=new THREE.Mesh(new THREE.SphereGeometry(0.0115,20,12,0,Math.PI*2,0,Math.PI/2), tankMat); c.position.set(x,0.037,z); c.castShadow=true; farm.add(c);
      const r=new THREE.Mesh(new THREE.TorusGeometry(0.0117,0.0008,6,20), pipeMat); r.rotation.x=Math.PI/2; r.position.set(x,0.030,z); farm.add(r);
      member(pipeR, x,0.008,z, 0.0,0.008,0.0, 0.0016); });
    member(pipeR, 0,0.008,0, 0.048,0.008,0.030, 0.0020);                               // 外输管
    member(pipeR, -0.017,0.012,-0.017, 0.017,0.012,0.014, 0.0014);
    farm.add(new THREE.Mesh(mergeGeometries(pipeR), pipeMat));
    g.add(farm); }
  const vt=new THREE.Mesh(new THREE.CylinderGeometry(0.009,0.009,0.026,20), tankMat); vt.position.set(-0.15,0.013,-0.02); vt.castShadow=true; g.add(vt);
  const vcap=new THREE.Mesh(new THREE.SphereGeometry(0.009,20,10,0,Math.PI*2,0,Math.PI/2), tankMat); vcap.position.set(-0.15,0.026,-0.02); g.add(vcap);
  // 控制中心：两层 + 窗带 + 屋顶设备
  const ctl=new THREE.Group();
  const cw=0.05,ch=0.020,cd=0.028;
  const cb=new THREE.Mesh(new THREE.BoxGeometry(cw,ch,cd), wallMat); cb.position.y=ch/2; cb.castShadow=true; cb.receiveShadow=true; ctl.add(cb);
  const win1=new THREE.Mesh(new THREE.BoxGeometry(cw*0.98,0.005,0.0012), glassMat); win1.position.set(0,ch*0.72,cd/2+0.0008); ctl.add(win1);
  const win2=new THREE.Mesh(new THREE.BoxGeometry(0.0012,ch*0.9,cd*0.94), glassMat); win2.position.set(cw/2+0.0008,ch*0.5,0); ctl.add(win2);
  const rf=new THREE.Mesh(new THREE.BoxGeometry(cw*0.98,0.002,cd*0.98), roofMat); rf.position.y=ch+0.001; ctl.add(rf);
  const ac=new THREE.Mesh(new THREE.BoxGeometry(0.008,0.004,0.008), pipeMat); ac.position.set(0.008,ch+0.004,0); ctl.add(ac);
  ctl.position.set(-0.30,0,-0.13); ctl.rotation.y=0.7; g.add(ctl);
  // 水塔（发射降噪喷水）：四腿桁架 + 大水箱 + 降液管
  const wt=new THREE.Group(); { const H=0.052, hw=0.011, pr=[];
    for(const [sx,sz] of [[-hw,-hw],[hw,-hw],[-hw,hw],[hw,hw]]) member(pr,sx,0,sz,sx,H,sz,0.0018);
    for(let i=1;i<=5;i++){ const y=i/5*H;
      member(pr,-hw,y,-hw,hw,y,-hw,0.0012); member(pr,-hw,y,hw,hw,y,hw,0.0012);
      member(pr,-hw,y,-hw,-hw,y,hw,0.0012); member(pr,hw,y,-hw,hw,y,hw,0.0012); }
    for(let i=0;i<5;i++){ const y0=i/5*H, y1=(i+1)/5*H;
      member(pr,i%2?-hw:hw,y0,-hw, i%2?hw:-hw,y1,-hw,0.0011); member(pr,i%2?-hw:hw,y0,hw, i%2?hw:-hw,y1,hw,0.0011); }
    const legs=new THREE.Mesh(mergeGeometries(pr), new THREE.MeshStandardMaterial({color:0x9aa2ae, metalness:.7, roughness:.45}));
    legs.castShadow=true; wt.add(legs);
    const tank=new THREE.Mesh(new THREE.CylinderGeometry(0.019,0.019,0.020,18), new THREE.MeshStandardMaterial({color:0xdfe3e7, metalness:.3, roughness:.45}));
    tank.position.y=H+0.010; tank.castShadow=true; wt.add(tank);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(0.020,0.008,18), roofMat); roof.position.y=H+0.024; wt.add(roof);
    member(pr,0.011,0.006,0.011, 0.011,H,0.011, 0.0001);   // 占位(管路另建)
    const down=new THREE.Mesh(new THREE.CylinderGeometry(0.0022,0.0022,H,10), pipeMat); down.position.set(0.012,H/2,0.012); wt.add(down); }
  wt.position.set(0.20,0,-0.24); g.add(wt);
  // 周界围栏 + 照明灯杆（把空旷场地"围"起来，提供尺度参照）
  { const fence=new THREE.Group(); const R=0.40, step=0.05;
    const posts=[];
    for(let x=-R;x<=R+1e-6;x+=step){ member(posts,x,0,-R,x,0.010,-R,0.0009); member(posts,x,0,R,x,0.010,R,0.0009); }
    for(let z=-R;z<=R+1e-6;z+=step){ member(posts,-R,0,z,-R,0.010,z,0.0009); member(posts,R,0,z,R,0.010,z,0.0009); }
    member(posts,-R,0.0085,-R,R,0.0085,-R,0.0006); member(posts,-R,0.0055,-R,R,0.0055,-R,0.0005);
    member(posts,-R,0.0085,R,R,0.0085,R,0.0006);   member(posts,-R,0.0055,R,R,0.0055,R,0.0005);
    member(posts,-R,0.0085,-R,-R,0.0085,R,0.0006); member(posts,-R,0.0055,-R,-R,0.0055,R,0.0005);
    member(posts,R,0.0085,-R,R,0.0085,R,0.0006);   member(posts,R,0.0055,-R,R,0.0055,R,0.0005);
    const fm=new THREE.Mesh(mergeGeometries(posts), new THREE.MeshStandardMaterial({color:0x8d949c, metalness:.6, roughness:.6}));
    fm.castShadow=true; fence.add(fm); g.add(fence); }
  [[-0.30,-0.30],[0.30,-0.30],[-0.30,0.30],[0.30,0.30]].forEach(([x,z])=>{     // 照明灯杆
    const lp=new THREE.Group();
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.0012,0.0022,0.058,10), new THREE.MeshStandardMaterial({color:0x8d949c, metalness:.65, roughness:.5}));
    mast.position.y=0.029; mast.castShadow=true; lp.add(mast);
    const head=new THREE.Mesh(new THREE.BoxGeometry(0.010,0.0035,0.004), new THREE.MeshStandardMaterial({color:0x3d434b, metalness:.7, roughness:.4}));
    head.position.set(0.004,0.057,0); head.rotation.z=-0.35; lp.add(head);
    lp.position.set(x,0,z); g.add(lp); });
  // 避雷塔三座（远景轮廓）
  [[0.6,-0.6],[-0.75,0.45],[0.85,0.5]].forEach(([x,z])=>{
    const t=new THREE.Mesh(new THREE.CylinderGeometry(0.0015,0.003,0.075,6), new THREE.MeshStandardMaterial({color:0x8b929b, metalness:.6, roughness:.5, transparent:true}));
    t.position.set(x,0.0375,z); g.add(t); });
  return g;
}
// —— 长征五号构型运载火箭（芯级 5m + 4 助推 3.35m，按真实比例）——
const RC=0.0084;                      // 芯级半径（5m 直径）
function buildRocket(){
  const g=new THREE.Group();
  const hull=new THREE.MeshStandardMaterial({map:hullTex(), roughness:.52, metalness:.14});
  const hull2=new THREE.MeshStandardMaterial({color:0xe4e3dd, roughness:.48, metalness:.18});
  const fairMat=new THREE.MeshStandardMaterial({map:fairTex(), roughness:.40, metalness:.10});
  const dark=new THREE.MeshStandardMaterial({color:0x4b5058, metalness:.78, roughness:.42});
  const bell=new THREE.MeshStandardMaterial({color:0x353a41, metalness:.9, roughness:.34, side:THREE.DoubleSide});
  // 一级（含发动机舱）
  const engBay=new THREE.Mesh(new THREE.CylinderGeometry(RC*1.04,RC*1.06,0.012,32), dark); engBay.position.y=0.006; engBay.castShadow=true; g.add(engBay);
  const s1=new THREE.Mesh(new THREE.CylinderGeometry(RC,RC,0.101,40,1), hull); s1.position.y=0.0625; s1.castShadow=true; s1.receiveShadow=true; g.add(s1);
  // 电缆罩
  const race=new THREE.Mesh(new THREE.BoxGeometry(0.0032,0.101,0.0026), hull2); race.position.set(RC+0.0012,0.0625,-0.001); race.castShadow=true; g.add(race);
  // 一级环缝
  [0.030,0.075].forEach(y=>{ const r=new THREE.Mesh(new THREE.CylinderGeometry(RC*1.008,RC*1.008,0.0016,40), dark); r.position.y=y; g.add(r); });
  // 级间段
  const inter=new THREE.Mesh(new THREE.CylinderGeometry(RC*1.01,RC*1.01,0.0055,36), dark); inter.position.y=0.1155; inter.castShadow=true; g.add(inter);
  // 二级
  const s2=new THREE.Mesh(new THREE.CylinderGeometry(RC*0.98,RC*0.98,0.0225,36), hull2); s2.position.y=0.1295; s2.castShadow=true; g.add(s2);
  // 整流罩（等直段 + 冯·卡门头锥）
  const fair=new THREE.Mesh(ogive(RC*1.10,0.030,18,0.016), fairMat); fair.position.y=0.1405; fair.castShadow=true; g.add(fair);
  const fairBase=new THREE.Mesh(new THREE.CylinderGeometry(RC*1.10,RC*1.10,0.004,36,1,true), dark); fairBase.position.y=0.1425; g.add(fairBase);
  // 芯级两台发动机构型（YF-77）
  [[-1],[1]].forEach(([s])=>{ const b=new THREE.Mesh(bellGeo(0.0016,0.0042,0.014,20), bell); b.position.set(s*RC*0.44,-0.007,0); b.castShadow=true; g.add(b);
    const turb=new THREE.Mesh(new THREE.SphereGeometry(0.0022,10,8), dark); turb.position.set(s*RC*0.44,-0.0015,0.0055); g.add(turb); });
  g.userData.height=0.185; g.userData.radius=RC;
  return g;
}
// —— 4 台助推器（3.35m 直径，含头锥、尾裙、喷管）——
function buildBoosters(){
  const g=new THREE.Group();
  const BR=0.0056, BH=0.074, ORB=0.0140;         // 半径 / 柱段长 / 距轴心
  const skin=new THREE.MeshStandardMaterial({color:0xeceae4, roughness:.5, metalness:.16});
  const dark=new THREE.MeshStandardMaterial({color:0x4b5058, metalness:.78, roughness:.42});
  const bell=new THREE.MeshStandardMaterial({color:0x353a41, metalness:.9, roughness:.34, side:THREE.DoubleSide});
  [0,1,2,3].forEach(i=>{ const a=i*Math.PI/2+Math.PI/4, cx=Math.cos(a)*ORB, cz=Math.sin(a)*ORB;
    const body=new THREE.Mesh(new THREE.CylinderGeometry(BR,BR,BH,26), skin); body.position.set(cx,BH/2,cz); body.castShadow=true; body.receiveShadow=true; g.add(body);
    const nose=new THREE.Mesh(ogive(BR,0.0145,14,0.002), skin); nose.position.set(cx,BH,cz); nose.castShadow=true; g.add(nose);
    const skirt=new THREE.Mesh(new THREE.CylinderGeometry(BR*1.08,BR*1.12,0.007,24), dark); skirt.position.set(cx,0.0015,cz); skirt.castShadow=true; g.add(skirt);
    const bn=new THREE.Mesh(bellGeo(0.0014,0.0036,0.012,16), bell); bn.position.set(cx,-0.007,cz); g.add(bn);
    const ring=new THREE.Mesh(new THREE.CylinderGeometry(BR*1.01,BR*1.01,0.0014,24), dark); ring.position.set(cx,BH*0.62,cz); g.add(ring); });
  return g;
}
function buildChange(){
  const g=new THREE.Group();
  const gold=new THREE.MeshStandardMaterial({map:goldTex(), metalness:.72, roughness:.42});
  const metal=new THREE.MeshStandardMaterial({color:0xb9bec7, metalness:.85, roughness:.32});
  const dark=new THREE.MeshStandardMaterial({color:0x53585f, metalness:.8, roughness:.4});
  const solar=new THREE.MeshStandardMaterial({map:solarTex(), metalness:.35, roughness:.55, side:THREE.DoubleSide});
  const svc=new THREE.Mesh(new THREE.BoxGeometry(0.045,0.045,0.05), gold); svc.position.y=0.045; svc.castShadow=true; g.add(svc);
  const dish=new THREE.Mesh(new THREE.SphereGeometry(0.022,20,12,0,Math.PI*2,0,Math.PI*0.4), metal); dish.rotation.x=-Math.PI/2; dish.position.set(0,0.08,0); dish.castShadow=true; g.add(dish);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.0012,0.0012,0.024,8), metal); mast.position.set(0,0.068,0); g.add(mast);
  [[-1],[1]].forEach(([s])=>{ const wing=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.0045,0.03), solar); wing.position.x=s*0.062; wing.position.y=0.045; wing.castShadow=true; g.add(wing);
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(0.0016,0.0016,0.022,8), metal); arm.rotation.z=Math.PI/2; arm.position.set(s*0.033,0.045,0); g.add(arm); });
  for(let i=0;i<4;i++){ const a=i*Math.PI/2+Math.PI/4; const th=new THREE.Mesh(bellGeo(0.0012,0.0032,0.009,12), dark);
    th.position.set(Math.cos(a)*0.016,0.019,Math.sin(a)*0.016); g.add(th); }
  const lander=new THREE.Group(); lander.name='lander'; lander.position.y=-0.045;
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.042,0.034,0.042), gold); body.castShadow=true; body.receiveShadow=true; lander.add(body);
  const deck=new THREE.Mesh(new THREE.BoxGeometry(0.044,0.004,0.044), metal); deck.position.y=0.019; deck.castShadow=true; lander.add(deck);
  const top=new THREE.Mesh(new THREE.ConeGeometry(0.022,0.028,12), gold); top.position.y=0.032; top.castShadow=true; lander.add(top);
  const pane=new THREE.Mesh(new THREE.BoxGeometry(0.026,0.012,0.0018), new THREE.MeshStandardMaterial({color:0x1b2a44, metalness:.5, roughness:.25, emissive:0x101c33, emissiveIntensity:.5}));
  pane.position.set(0,0.004,0.0215); lander.add(pane);
  const ring=new THREE.Mesh(new THREE.CylinderGeometry(0.023,0.023,0.004,16), dark); ring.position.y=0.016; lander.add(ring);
  { const parts=[];
    for(let i=0;i<4;i++){ const a=i*Math.PI/2+Math.PI/4, cx=Math.cos(a), cz=Math.sin(a);
      member(parts, cx*0.019,-0.013,cz*0.019, cx*0.050,-0.052,cz*0.050, 0.0034);          // 主腿
      member(parts, cx*0.008,-0.004,cz*0.008, cx*0.036,-0.040,cz*0.036, 0.0022);          // 斜撑
      member(parts, cx*0.050,-0.052,cz*0.050, cx*0.030,-0.052,cz*0.030, 0.0024); }        // 横拉
    const legs=new THREE.Mesh(mergeGeometries(parts), metal); legs.castShadow=true; lander.add(legs);
    for(let i=0;i<4;i++){ const a=i*Math.PI/2+Math.PI/4;
      const foot=new THREE.Mesh(new THREE.CylinderGeometry(0.0072,0.0062,0.0026,14), metal);
      foot.position.set(Math.cos(a)*0.050,-0.0535,Math.sin(a)*0.050); foot.castShadow=true; lander.add(foot); } }
  const noz=new THREE.Mesh(bellGeo(0.004,0.011,0.02,16), dark); noz.position.y=-0.026; lander.add(noz);
  g.add(lander);
  g.userData.lander=lander; g.userData.svc=svc;
  return g;
}
// —— 尾焰：贴图湍流焰芯（实心可读） + 加色外发光 + 喷口冲击环 ——
function buildPlume(sc=1){
  const g=new THREE.Group();
  const core=new THREE.Mesh(new THREE.ConeGeometry(0.015*sc,0.115,24,1,true),
    new THREE.MeshBasicMaterial({map:flameTex(), transparent:true, depthWrite:false, side:THREE.DoubleSide, blending:THREE.NormalBlending, color:0xffffff}));
  core.position.y=-0.0575;
  const glow=new THREE.Mesh(new THREE.ConeGeometry(0.030*sc,0.14,20,1,true),
    new THREE.MeshBasicMaterial({map:glowTex(), transparent:true, opacity:.55, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, color:0xff9a3c}));
  glow.position.y=-0.062;
  const ring=new THREE.Mesh(new THREE.CylinderGeometry(0.019*sc,0.013*sc,0.012,18,1,true),
    new THREE.MeshBasicMaterial({color:0xffe0b0, transparent:true, opacity:.75, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending}));
  ring.position.y=-0.005;
  g.add(core); g.add(glow); g.add(ring);
  g.userData.core=core; g.userData.glow=glow; g.userData.ring=ring;
  g.traverse(o=>{ o.renderOrder=3; });
  g.visible=false; return g;
}
// —— 发射烟云（软云团粒子，可扩散可淡出）——
function buildSteam(){ const N=800, geo=new THREE.BufferGeometry(), arr=new Float32Array(N*3); geo.setAttribute('position',new THREE.BufferAttribute(arr,3));
  for(let i=0;i<N;i++) arr[i*3+1]=-999;
  const mat=new THREE.PointsMaterial({color:0xf2f5f8, size:0.09, map:blobTex(), transparent:true, opacity:0, depthWrite:false, sizeAttenuation:true, alphaTest:0.01});
  const pts=new THREE.Points(geo,mat); pts.visible=false; pts.userData={parts:[]}; pts.renderOrder=2; return pts; }

export class LunarMission extends ModuleBase {
  constructor(ctx){
    super(ctx);
    this.active=false; this.phase='IDLE'; this.pt=0; this._built=false; this._scene=null;
    this._saved={ rate:-1, running:true, moonMode:null, controlsOn:true, labelsOn:true };
    this._cam={ pos:new THREE.Vector3(), tgt:new THREE.Vector3(), up:new THREE.Vector3(0,1,0) };
    this._closeup=true; this._inMoon=false;
    this._qaLock=false;                      // QA 定格拍摄：暂停推进 + 接管相机
    this._site=new THREE.Vector3(0,RE,0);   // 发射点(+Y 极)，月球在 +X
  }
  get scene(){ if(!this._scene) this._scene=new THREE.Scene(); return this._scene; }

  start(){ if(this.active) return; try{ this._doStart(); }catch(err){ console.error('mission start error', err); try{ this._teardown(); }catch(e){} } }
  _doStart(){
    const ctx=this.ctx;
    this.ctx.missionActive=true; document.body.classList.add('mission-active');
    this._saved.rate=ctx.clock.rateIndex; this._saved.running=ctx.clock.running; ctx.clock.running=false;
    this._saved.controlsOn=ctx.cameraRig.controls.enabled; ctx.cameraRig.controls.enabled=false;
    this._saved.labelsOn=ctx.orbitView.labelsVisible; if(this._saved.labelsOn) ctx.orbitView.toggleLabels();
    if(ctx.labelRenderer) this._labelDisp=ctx.labelRenderer.domElement.style.display, ctx.labelRenderer.domElement.style.display='none';
    ctx.camera.up.set(0,1,0);
    this.active=true;
    this._buildScene();
    this._buildUi();
    this._setPhase('COUNTDOWN');
    bus.emit('mission.start'); this._syncBtn();
  }

  _buildScene(){
    const sc=this.scene, r=this.ctx.renderer;
    // —— 电影级渲染：ACES 色调映射 + 阴影贴图（退出时还原全局设置）——
    this._rset={ toneMapping:r.toneMapping, exposure:r.toneMappingExposure, shadow:r.shadowMap.enabled, type:r.shadowMap.type };
    r.toneMapping=THREE.ACESFilmicToneMapping; r.toneMappingExposure=1.05;
    r.shadowMap.enabled=true; r.shadowMap.type=THREE.PCFSoftShadowMap;

    // —— 太阳：平行光（地面与太空共用同一光源）+ 软阴影 ——
    this.sunDir=new THREE.Vector3(-0.78,0.56,-0.31).normalize();
    this.sun=new THREE.DirectionalLight(0xfff3e0, 2.9);
    this.sun.castShadow=true;
    const SM=((this.ctx.quality&&this.ctx.quality.tier&&this.ctx.quality.tier.id==='low')?1024:2048);
    this.sun.shadow.mapSize.set(SM,SM);
    this.sun.shadow.bias=-0.00035; this.sun.shadow.normalBias=0.0018;
    this.sun.target.position.copy(this._site); sc.add(this.sun.target); sc.add(this.sun);
    this._shadowFit(this._site, 0.58, 60);
    sc.add(new THREE.HemisphereLight(0xbcd8ff, 0x4d4a3e, 0.5));
    sc.add(new THREE.AmbientLight(0xdfe9ff, 0.14));
    this.launchFill=new THREE.PointLight(0xffe9cc, 0.9, 2.4, 2); this.launchFill.position.set(-0.5,1.35,-0.9); sc.add(this.launchFill);
    this.moonFill=new THREE.PointLight(0xf2e8da, 1.6, 8, 2); this.moonFill.position.set(MD-2.5,1.6,1.4); sc.add(this.moonFill);

    // —— 天空：渐变 + 太阳光晕 + 地平线雾霭（升空后淡出为太空黑）——
    this.skyMat=new THREE.ShaderMaterial({
      uniforms:{ uA:{value:1}, uTop:{value:new THREE.Color(0x2f6fc8)}, uHor:{value:new THREE.Color(0xd6e6f2)}, uSun:{value:this.sunDir.clone()} },
      vertexShader:`varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader:`uniform float uA; uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSun; varying vec3 vP;
        void main(){ vec3 d=normalize(vP); float h=clamp(d.y*0.5+0.5,0.0,1.0);
          vec3 c=mix(uHor,uTop,pow(h,1.25));
          float s=max(dot(d,normalize(uSun)),0.0);
          c+=vec3(1.0,0.94,0.80)*pow(s,320.0)*2.2;      // 太阳盘
          c+=vec3(1.0,0.88,0.70)*pow(s,14.0)*0.30;      // 光晕
          c=mix(c,uHor,clamp(1.0-abs(d.y)*7.0,0.0,1.0)*0.55);  // 地平线雾霭
          gl_FragColor=vec4(c, uA); }`,
      side:THREE.BackSide, transparent:true, depthWrite:false });
    const sky=new THREE.Mesh(new THREE.SphereGeometry(70,40,24), this.skyMat); sky.name='sky'; sc.add(sky);

    // —— 地球（贴图 + 云层 + 大气边缘辉光）——
    this.earthGroup=new THREE.Group();
    const earth=new THREE.Mesh(new THREE.SphereGeometry(RE,80,80), new THREE.MeshStandardMaterial({color:0xffffff, roughness:.74, metalness:.02}));
    const clouds=new THREE.Mesh(new THREE.SphereGeometry(RE*1.006,64,64), new THREE.MeshStandardMaterial({color:0xffffff, transparent:true, opacity:.92, depthWrite:false, roughness:1}));
    this._loadTex('earth', t=>{ if(t&&earth.material){ earth.material.map=t; earth.material.needsUpdate=true; } });
    try{ textureStore.clouds().then(t=>{ if(t){ clouds.material.map=t; clouds.material.alphaMap=t; clouds.material.needsUpdate=true; } }).catch(()=>{}); }catch(e){}
    const atmMat=new THREE.ShaderMaterial({
      uniforms:{ uA:{value:1}, uColor:{value:new THREE.Color(0x74b4ff)}, uSun:{value:this.sunDir.clone()} },
      vertexShader:`varying vec3 vN; varying vec3 vE; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vN=normalize(mat3(modelMatrix)*normal); vE=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }`,
      fragmentShader:`uniform float uA; uniform vec3 uColor; uniform vec3 uSun; varying vec3 vN; varying vec3 vE;
        void main(){ float f=pow(1.0-abs(dot(normalize(vN),normalize(vE))),2.4);
          float lit=clamp(dot(normalize(vN),normalize(uSun))*0.5+0.5,0.0,1.0);
          gl_FragColor=vec4(uColor, f*uA*0.62*(0.25+lit*lit*1.5)); }`,
      transparent:true, blending:THREE.AdditiveBlending, side:THREE.BackSide, depthWrite:false });
    const atm=new THREE.Mesh(new THREE.SphereGeometry(RE*1.045,48,32), atmMat);
    this.earthGroup.add(earth); this.earthGroup.add(clouds); this.earthGroup.add(atm);
    this.earthGroup.visible=false; sc.add(this.earthGroup);
    this.earth=earth; this.earthClouds=clouds; this.atmMat=atmMat;

    // —— 月球（贴图 + 以亮度作凹凸，出真实环形山起伏）——
    const moon=new THREE.Mesh(new THREE.SphereGeometry(RM,72,72), new THREE.MeshStandardMaterial({color:0xdedbd3, roughness:.95, metalness:0}));
    moon.name='moon'; moon.position.set(MD,0,0); moon.receiveShadow=true; moon.castShadow=false;
    this._loadTex('moon', t=>{ if(t&&moon.material){ moon.material.map=t; moon.material.bumpMap=t; moon.material.bumpScale=0.02; moon.material.needsUpdate=true; } });
    this.moon=moon; this.moonGroup=new THREE.Group(); this.moonGroup.visible=false; this.moonGroup.add(moon); sc.add(this.moonGroup);
    this.lunarPatch=buildLunarPatch(); sc.add(this.lunarPatch);

    // —— 环境反射（IBL）：程序化 equirect 天空（含阳光下光斑），金属才不会发黑 ——
    this._buildEnvMap(sc);

    // —— 发射场 ——
    this.siteGroup=new THREE.Group(); this.siteGroup.position.copy(this._site);
    this.ground=buildGround(); this.tower=buildTower(); this.facilities=buildFacilities();
    this.siteGroup.add(this.ground); this.siteGroup.add(this.tower); this.siteGroup.add(this.facilities);
    sc.add(this.siteGroup);
    // 地平线雾：地面段制造大气透视(远景融进雾霭)，升空后把 far 推远等于关闭
    this.fog=new THREE.Fog(0xcadcec, 1.0, 6.0); sc.fog=this.fog;

    // —— 星空（飞出海平面后显现，闪烁）——
    { const n=1200, pos=new Float32Array(n*3), ph=new Float32Array(n);
      for(let i=0;i<n;i++){ pos[i*3]=(Math.random()-.5)*90; pos[i*3+1]=(Math.random()-.5)*90; pos[i*3+2]=(Math.random()-.5)*90; ph[i]=Math.random()*6.283; }
      const sg=new THREE.BufferGeometry(); sg.setAttribute('position',new THREE.BufferAttribute(pos,3)); sg.setAttribute('aPhase',new THREE.BufferAttribute(ph,1));
      this.starMat=new THREE.ShaderMaterial({ uniforms:{ uT:{value:0}, uA:{value:0} },
        vertexShader:`attribute float aPhase; uniform float uT; uniform float uA; varying float vB; void main(){ vB=(0.5+0.5*sin(uT*2.2+aPhase))*uA; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=2.4; gl_Position=projectionMatrix*mv; }`,
        fragmentShader:`varying float vB; void main(){ if(vB<=0.001) discard; gl_FragColor=vec4(vec3(0.86+0.14*vB)*vB, 1.0); }`, transparent:true, depthWrite:false });
      const stars=new THREE.Points(sg, this.starMat); stars.onBeforeRender=()=>{ this.starMat.uniforms.uT.value=performance.now()/1000; }; sc.add(stars);
      this.stars=stars; }

    // —— 火箭 / 助推器 / 嫦娥 / 尾焰 / 烟云 ——
    this.rocket=buildRocket(); this.boosters=buildBoosters(); this.change=buildChange();
    this.plumeR=buildPlume(); this.plumeC=buildPlume(1.0); this.steam=buildSteam();
    this.rocket.add(this.plumeR); this.change.add(this.plumeC); this.plumeC.scale.setScalar(2.6);
    [this.rocket,this.boosters,this.change,this.steam].forEach(o=>{ this.scene.add(o); });
    this.linePark=this._mkLine(k=>this._park(k*Math.PI*2), 0x7fd0ff);
    this.lineTransfer=this._mkLine(k=>this._transfer(k*Math.PI), 0xffd54a);
    this.lineLunar=this._mkLine(k=>this._lunar(k*Math.PI*2), 0x8fd0ff);
    // 地月转移"近快远慢"速度箭头（开普勒第二定律）
    this.speedArrows=new THREE.Group(); this.speedArrows.visible=false; this.scene.add(this.speedArrows);
    const a=(PARK+MD)/2;
    for(let i=0;i<7;i++){ const nu=Math.PI*i/6, r=this._transferR(nu);
      const p=this._transfer(nu);
      const dir=this._transfer(nu+0.03).sub(this._transfer(nu-0.03)).normalize();
      const sp=Math.sqrt(Math.max(0, 2/r - 1/a));
      this.speedArrows.add(new THREE.ArrowHelper(dir, p, 0.12+sp*0.42, 0xffb454, 0.045, 0.03));
    }
    this._built=true;
  }
  _buildEnvMap(sc){
    try{
      const r=this.ctx.renderer, W=256, H=128;
      const tex=mkTex(W,H,(g,w,h)=>{
        const sky=g.createLinearGradient(0,0,0,h);
        sky.addColorStop(0,'#04060c'); sky.addColorStop(0.45,'#0d1a33');
        sky.addColorStop(0.52,'#5f86b8'); sky.addColorStop(0.62,'#8fb0d4');
        sky.addColorStop(0.75,'#2c3648'); sky.addColorStop(1,'#0a0c11');
        g.fillStyle=sky; g.fillRect(0,0,w,h);
        const sd=this.sunDir;                                                     // 太阳方向 → equirect 坐标
        const u=Math.atan2(sd.z,sd.x)/(Math.PI*2)+0.5, v=Math.asin(Math.max(-1,Math.min(1,sd.y)))/Math.PI+0.5;
        const sx=u*w, sy=(1-v)*h;
        [[26,1],[10,0.85],[4,0.9]].forEach(([rad,k])=>{ const gr=g.createRadialGradient(sx,sy,0,sx,sy,rad);
          gr.addColorStop(0,`rgba(255,250,240,${k})`); gr.addColorStop(1,'rgba(255,240,220,0)');
          g.fillStyle=gr; g.beginPath(); g.arc(sx,sy,rad,0,7); g.fill(); });
      });
      tex.mapping=THREE.EquirectangularReflectionMapping; tex.colorSpace=THREE.SRGBColorSpace;
      const pm=new THREE.PMREMGenerator(r); pm.compileEquirectangularShader();
      this.envRT=pm.fromEquirectangular(tex);
      sc.environment=this.envRT.texture;
      if('environmentIntensity' in sc) sc.environmentIntensity=0.55;
      pm.dispose(); tex.dispose();
    }catch(e){ console.warn('env map failed', e); }
  }
  // 阴影相机适配：聚焦到某个中心、给定半径
  _shadowFit(center, radius, far=60){
    if(!this.sun) return;
    const c=this.sun.shadow.camera;
    c.left=-radius; c.right=radius; c.top=radius; c.bottom=-radius;
    c.near=0.5; c.far=far*2; c.updateProjectionMatrix();
    this.sun.target.position.copy(center);
    this.sun.position.copy(center).addScaledVector(this.sunDir, far);
    this.sun.target.updateMatrixWorld();
  }
  // 整组淡入淡出（共享材质，逐个 clone 避免互相影响）
  _fadeGroup(group, a){
    if(!group) return;
    group.visible=a>0.002;
    group.traverse(o=>{ if(!o.material) return; if(!o.userData._mt){ o.material=o.material.clone(); o.userData._mt=true; }
      o.material.transparent=true; o.material.opacity=a; o.material.depthWrite=a>0.985; });
  }
  _loadTex(key, cb){ try{ textureStore.surface(key).then(cb).catch(()=>{}); }catch(e){} }
  _stars(n){ const a=[]; for(let i=0;i<n;i++) a.push([(Math.random()-.5)*70,(Math.random()-.5)*70,(Math.random()-.5)*70]); return a; }

  _park(th){ return new THREE.Vector3(PARK*Math.cos(th), PARK*Math.sin(th), 0); }
  _mdApo(){ return MD - LUNAR_R; }   // 转移远地点 = 月球停泊轨道近侧
  _transferR(nu){ const A=(PARK+this._mdApo())/2, e=(this._mdApo()-PARK)/(this._mdApo()+PARK); return A*(1-e*e)/(1+e*Math.cos(nu)); }
  _transfer(nu){ const r=this._transferR(nu); return new THREE.Vector3(-r*Math.cos(nu), -r*Math.sin(nu), 0); }  // 近日点(-X)→远日点(+X,月球停泊轨); Y 取负与停泊轨道方向一致
  _kepler(M,e){ let E=M; for(let i=0;i<12;i++){ const f=E-e*Math.sin(E)-M, fp=1-e*Math.cos(E); if(Math.abs(f)<1e-9) break; E-=f/fp; } return E; }
  _nuFromM(M){ const e=(this._mdApo()-PARK)/(this._mdApo()+PARK); const E=this._kepler(M,e); return 2*Math.atan2(Math.sqrt(1+e)*Math.sin(E/2), Math.sqrt(1-e)*Math.cos(E/2)); }
  _lunar(la){ return new THREE.Vector3(MD,0,0).add(new THREE.Vector3(LUNAR_R*Math.cos(la), LUNAR_R*Math.sin(la), 0)); }
  _tangentPark(th){ return new THREE.Vector3(-Math.sin(th), Math.cos(th), 0).normalize(); }
  _tangentLunar(la){ return new THREE.Vector3(-Math.sin(la), Math.cos(la), 0).normalize(); }
  _mkLine(fn,color){
    const pts=[]; for(let i=0;i<=200;i++) pts.push(fn(i/200));
    const geo=new THREE.BufferGeometry().setFromPoints(pts); geo.setDrawRange(0,0);
    const l=new THREE.Line(geo, new THREE.LineBasicMaterial({color, transparent:true, opacity:0.6}));
    l.visible=false; this.scene.add(l); return l;
  }
  _reveal(line, frac){ if(line&&line.geometry) line.geometry.setDrawRange(0, Math.max(1, Math.floor(frac*201))); }

  _setPhase(p){ this.phase=p; this.pt=0; this._enterPhase(p); }
  _enterPhase(p){
    if(p==='COUNTDOWN'){ this.rocket.visible=true; this.boosters.visible=true; this.change.visible=false; this.steam.visible=false; this.plumeR.visible=false; this.plumeC.visible=false;
      this.rocket.position.copy(this._site).add(new THREE.Vector3(0,0.006,0)); this._pointUp(this.rocket, new THREE.Vector3(0,1,0));
      this.boosters.position.copy(this.rocket.position); this.boosters.quaternion.copy(this.rocket.quaternion); this.boosters.userData.sep=null;
      this._hideLines(); }
    if(p==='IGNITION'){ this.plumeR.visible=true; this.steam.visible=true; this._spawnSteam(); }
    if(p==='LIFTOFF'){ this.plumeR.visible=true; }
    if(p==='SPHERE'){ this.plumeR.visible=true; }
    if(p==='STAGE_SEP'){ this.plumeR.visible=false; this.stageSepT=0; if(this.boosters) this.boosters.userData.sep={t:0}; }
    if(p==='EARTH_ORBIT'){ this.change.visible=false; this.rocket.visible=true; if(this.boosters) this.boosters.visible=false; this.linePark.visible=true;
      // 绕地球时开放用户手动视角(拖动/捏合绕火箭观察)
      const c=this.ctx.cameraRig&&this.ctx.cameraRig.controls;
      if(c){ this._saveMinMax={min:c.minDistance,max:c.maxDistance}; c.minDistance=0.5; c.maxDistance=6; c.target.copy(this.rocket.position); this.ctx.camera.position.copy(this.rocket.position).add(new THREE.Vector3(1.1,0.9,1.5)); c.enabled=true; this._freeCam=true; } }
    if(p==='TRANSFER'){ if(this._freeCam){ const c=this.ctx.cameraRig.controls; if(c){ c.enabled=false; if(this._saveMinMax){ c.minDistance=this._saveMinMax.min; c.maxDistance=this._saveMinMax.max; } } this._freeCam=false; } }
    if(p==='TRANSFER'){ this.change.visible=true; this.lineTransfer.visible=true; this._reveal(this.lineTransfer,0); if(this.speedArrows) this.speedArrows.visible=true; this._transSepT=0; }
    if(p==='LOI'){ this.plumeC.visible=true; this.lineLunar.visible=true; this._reveal(this.lineLunar,0); if(this.speedArrows) this.speedArrows.visible=false; }
    if(p==='LUNAR_ORBIT'){ this.plumeC.visible=false; this._lam=0; this._reveal(this.lineLunar,0); this.lineTransfer.visible=false; }
    if(p==='LANDING'){ this._detachLander(); this.plumeC.visible=true; if(this.plumeC) this.plumeC.scale.setScalar(0.8); this.lineLunar.visible=false; this.linePark.visible=false; }
    if(p==='LANDED'){ this.plumeC.visible=false; this._showSuccess(); }
  }
  _hideLines(){ [this.linePark,this.lineTransfer,this.lineLunar].forEach(l=>{ if(l){ l.visible=false; if(l.geometry) l.geometry.setDrawRange(0,0); } }); if(this.speedArrows) this.speedArrows.visible=false; }
  _fadeWenchang(a){ this._fadeGroup(this.siteGroup, Math.max(0,Math.min(1,a))); }
  _syncBoosters(){ if(!this.boosters||!this.boosters.visible) return; const sep=this.boosters.userData&&this.boosters.userData.sep; if(sep) return; this.boosters.position.copy(this.rocket.position); this.boosters.quaternion.copy(this.rocket.quaternion); }

  _pointUp(obj,dir){ if(!obj||!dir||dir.lengthSq()<1e-10) return; obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize()); }
  _spawnSteam(){
    const pts=this.steam, N=320, arr=pts.geometry.attributes.position.array;
    pts.userData.parts=[];
    for(let i=0;i<N;i++){ const a=Math.random()*Math.PI*2, r=0.01+Math.random()*0.06;
      const x=this._site.x+Math.cos(a)*r, y=RE+0.003+Math.random()*0.02, z=this._site.z+Math.sin(a)*r;
      pts.userData.parts.push({x,y,z,vx:Math.cos(a)*(0.04+Math.random()*0.06), vy:0.015+Math.random()*0.05, vz:Math.sin(a)*(0.04+Math.random()*0.06), life:1, s:0.7+Math.random()*0.8}); }
    pts.userData.parts.forEach((p,i)=>{ arr[i*3]=p.x; arr[i*3+1]=p.y; arr[i*3+2]=p.z; });
    pts.geometry.attributes.position.needsUpdate=true; pts.material.opacity=0.85;
  }
  _updateSteam(dt){
    const pts=this.steam, arr=pts.geometry.attributes.position.array;
    if(!pts.visible || !pts.userData.parts) return; let alive=0;
    pts.userData.parts.forEach((p,i)=>{ p.life-=dt*0.5; p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt; p.vy+=0.05*dt; p.vx*=0.985; p.vz*=0.985;
      if(p.life>0){ alive++; arr[i*3]=p.x; arr[i*3+1]=p.y; arr[i*3+2]=p.z; } else arr[i*3+1]=-999; });
    pts.geometry.attributes.position.needsUpdate=true; pts.material.opacity=Math.max(0, alive/320*0.85);
    if(alive===0) pts.visible=false;
  }
  _dust(pos){ if(!this._dustPts){ const n=60, g=new THREE.BufferGeometry(), a=new Float32Array(n*3); g.setAttribute('position',new THREE.BufferAttribute(a,3));
      this._dustPts=new THREE.Points(g, new THREE.PointsMaterial({color:0xccc4b0, size:0.014, map:softDot(), transparent:true, opacity:0.7, depthWrite:false, sizeAttenuation:true})); this.scene.add(this._dustPts); this._dustArr=a; this._dustN=n; }
    const a=this._dustArr; for(let i=0;i<this._dustN;i++){ a[i*3]=pos.x+(Math.random()-.5)*0.06; a[i*3+1]=pos.y+(Math.random())*0.04; a[i*3+2]=pos.z+(Math.random()-.5)*0.06; }
    this._dustPts.geometry.attributes.position.needsUpdate=true; }

  // —— QA 自检机位（供 scripts/vision-audit.mjs 做多角度定格拍摄；正常演示不触发）——
  qaGoto(phase, frac=0.5){
    if(!this.active) this.start();
    const ti=ORDER.indexOf(phase); if(ti<0) return null;
    this._qaLock=false;
    // 依次"预热"到该阶段末态，保证轨道位置/落点等状态与真实流程一致
    for(let i=0;i<=ti;i++){
      const p=ORDER[i];
      this._setPhase(p);
      const f=(i===ti)?Math.max(0,Math.min(frac,0.995)):0.995;
      this.pt=(DUR[p]||1)*f;
      if(p==='TRANSFER') this._transSepT=this.pt;
      this.update(0);
    }
    const d=this._camDesired();            // 定格在该阶段导演机位
    this._cam.pos.copy(d.pos); this._cam.tgt.copy(d.tgt); this._cam.up.copy(d.up);
    this._updateCamera(0);
    this._qaLock=true;
    return this.phase;
  }
  qaCam(pos, tgt, up){
    if(!this.active) return false;
    this._cam.pos.set(pos[0],pos[1],pos[2]);
    this._cam.tgt.set(tgt[0],tgt[1],tgt[2]);
    if(up) this._cam.up.set(up[0],up[1],up[2]);
    this._updateCamera(0);
    return true;
  }
  qaRelease(){ this._qaLock=false; }

  update(dt){
    if(!this.active) return;
    if(this._qaLock) dt=0;
    this.pt+=dt;
    const dur=DUR[this.phase]||1, k=Math.min(this.pt/dur,1);
    const ke=ease(k);
    const site=this._site, up=new THREE.Vector3(0,1,0);
    this._updateSteam(dt);
    switch(this.phase){
      case 'COUNTDOWN': this._setCountdown(); this._syncBoosters(); break;
      case 'IGNITION': {
        this.rocket.position.copy(this._site).add(new THREE.Vector3(0, 0.006 + ke*0.07, 0));   // 点火即微微离地, 露出尾焰
        this._pointUp(this.rocket, up.clone());
        this._syncBoosters(); break; }
      case 'LIFTOFF': {
        // 先垂直飞起来：从点火结束处继续(不回到台上), 全程朝上, 不倾斜
        const p0=this._site.clone().add(new THREE.Vector3(0,0.076,0));
        const p1=new THREE.Vector3(0,PARK+0.28,0);
        this.rocket.position.copy(p0).lerp(p1, ke);
        this._pointUp(this.rocket, up.clone());
        this._syncBoosters(); break; }
      case 'SPHERE': {
        // 继续垂直(相机升高揭示球面), 快到末段才轻微开始向下转
        const top=new THREE.Vector3(0,PARK+0.28,0);
        this.rocket.position.copy(top).sub(new THREE.Vector3(0, ke*0.28, 0));   // 末段回到停泊轨道高度(衔接连续)
        this._pointUp(this.rocket, up.clone().lerp(new THREE.Vector3(1,0,0), Math.max(0,k-0.55)*0.7));
        this._fadeWenchang(Math.max(0, 1 - Math.min(this.pt/DUR.SPHERE,1)*1.1));   // 升空隐藏平地,只留球面
        this._syncBoosters(); break; }
      case 'STAGE_SEP': {
        this.rocket.position.copy(new THREE.Vector3(0,PARK,0)); this._pointUp(this.rocket, new THREE.Vector3(0.3,1,0).normalize());
        // 助推器分离：向后下翻滚坠落淡出
        const sep=this.boosters&&this.boosters.userData?this.boosters.userData.sep:null;
        if(sep){ sep.t+=dt; const r=this.rocket.position;
          this.boosters.position.copy(r).add(new THREE.Vector3(-sep.t*0.10, -sep.t*0.15, sep.t*0.03));
          this.boosters.rotation.z=sep.t*2.2; this.boosters.rotation.x=sep.t*1.1;
          const f=Math.max(0, 1-Math.max(0,sep.t-1.8)*1.0);
          this.boosters.children.forEach(c=>{ if(c.material){ c.material=c.material.clone(); c.material.transparent=true; c.material.opacity=f; } });
          if(f<=0) this.boosters.visible=false;
        }
        break; }
      case 'EARTH_ORBIT': {
        // 入轨转弯(前段从竖直逐步转向轨道切线) + 绕地球到 TLI 点
        const th=Math.PI/2 + k*(Math.PI/2 + Math.PI*2);
        this.rocket.position.copy(this._park(th));
        const turn=Math.min(k/0.16,1);
        this._pointUp(this.rocket, new THREE.Vector3(0,1,0).lerp(this._tangentPark(th), turn));
        this._reveal(this.linePark, k);
        break; }
      case 'TRANSFER': {
        // TLI 点(-X): 上面级分离, 嫦娥卫星缓缓出舱, 火箭落后淡出, 再沿转移椭圆奔月
        if(this._transSepT===undefined) this._transSepT=0;
        this._transSepT+=dt;
        const f=Math.max(0, 1-this._transSepT/2.6);   // 火箭(上面级)缓缓淡出
        this.rocket.children.forEach(c=>{ if(c.material){ c.material.transparent=true; c.material.opacity=f; } });
        if(f<=0) this.rocket.visible=false;
        this.rocket.position.copy(this._park(Math.PI)).add(new THREE.Vector3(-this._transSepT*0.06, -this._transSepT*0.02, 0));  // 火箭缓缓落后
        const nu=Math.PI*ke;
        this.change.position.copy(this._transfer(nu));
        const nuP=Math.max(nu-0.02,0.001);
        const vel=this._transfer(nu).sub(this._transfer(nuP)).normalize();
        this._pointUp(this.change, vel);
        this._reveal(this.lineTransfer, k);
        break; }
      case 'LOI': {
        // 到达月球停泊轨近侧: 反向制动被月球"抓住", 并沿轨道缓缓滑入(不静止)
        this._lam=Math.PI + ease(k)*0.9;
        this.change.position.copy(this._lunar(this._lam));
        this._pointUp(this.change, this._tangentLunar(this._lam));
        break; }
      case 'LUNAR_ORBIT': {
        this._lam=Math.PI + 0.9 + k*Math.PI*2*LUNAR_ORBITS; this.change.position.copy(this._lunar(this._lam));
        this._pointUp(this.change, this._tangentLunar(this._lam));
        this._reveal(this.lineLunar, k);
        break; }
      case 'LANDING': {
        this._lam+=dt*0.5; this.change.position.copy(this._lunar(this._lam));
        this._pointUp(this.change, this._tangentLunar(this._lam));
        const lander=this.change.userData.lander, to=this._landSite.clone();   // 落点=当前轨道点正下方月面
        const dirDown=to.clone().sub(this._landerStart).normalize();
        const sepPos=this._landerStart.clone().addScaledVector(dirDown, ease(Math.min(this.pt/1.6,1))*0.09);  // 先与轨道器缓缓分离
        lander.position.copy(sepPos).lerp(to, ke);
        this._pointUp(lander, this._landUp.clone());
        if(this.pt%0.08<dt) this._dust(lander.position);
        break; }
      case 'LANDED': {
        this._lam+=dt*0.4; this.change.position.copy(this._lunar(this._lam));
        this._pointUp(this.change, this._tangentLunar(this._lam));
        const lander=this.change.userData.lander;
        lander.position.copy(this._landSite); this._pointUp(lander, this._landUp.clone()); break; }
    }
    const i=ORDER.indexOf(this.phase);
    if(k>=1 && i>=0 && i<ORDER.length-1) this._setPhase(ORDER[i+1]);
    this._updateFlames(dt);
    this._updateEnv();
    this._updateCamera(dt); this._updateHud();
  }

  // 尾焰流动 + 抖动（贴图偏移模拟高速燃气）
  _updateFlames(dt){
    const flick=(p)=>{
      if(!p||!p.visible) return; const ud=p.userData;
      if(ud.core&&ud.core.material&&ud.core.material.map){ const m=ud.core.material.map; m.offset.y=(m.offset.y+dt*2.2)%1; }
      if(ud.glow&&ud.glow.material&&ud.glow.material.map){ const m=ud.glow.material.map; m.offset.y=(m.offset.y+dt*1.3)%1; }
      const f=1+0.05*Math.sin(this.pt*47)+0.03*Math.sin(this.pt*83);
      if(ud.core) ud.core.scale.set(f,1+0.10*Math.sin(this.pt*61),f);
    };
    flick(this.plumeR); flick(this.plumeC);
  }

  // —— 环境：天空/星空/大气雾/地球月球可见性/阴影范围 ——
  _updateEnv(){
    const ph=this.phase;
    const groundPh=(ph==='COUNTDOWN'||ph==='IGNITION'||ph==='LIFTOFF');
    const kS=Math.min(this.pt/DUR.SPHERE,1);
    let skyA=1;
    if(ph==='SPHERE') skyA=Math.max(0, 1-kS/0.80);
    else if(!groundPh) skyA=0;
    if(this.skyMat) this.skyMat.uniforms.uA.value=skyA;
    if(this.starMat) this.starMat.uniforms.uA.value=Math.max(0, 1-skyA*1.1);
    // 地球/月球：地面段隐藏；SPHERE 后半段地球淡入（同时地面淡出）；离开地球后才见月球
    const earthA=(ph==='SPHERE')?Math.max(0,Math.min(1,(kS-0.42)/0.40))
      :(groundPh?0:1);
    if(this.earthGroup){ this.earthGroup.visible=earthA>0.01;
      if(this.earth&&this.earth.material){ this.earth.material.transparent=earthA<0.995; this.earth.material.opacity=earthA; }
      if(this.earthClouds){ this.earthClouds.material.opacity=0.92*earthA; }
      if(this.atmMat) this.atmMat.uniforms.uA.value=earthA; }
    const moonA=(ph==='COUNTDOWN'||ph==='IGNITION'||ph==='LIFTOFF')?0
      :(ph==='SPHERE'?Math.max(0,Math.min(1,(kS-0.62)/0.30)):1);
    if(this.moonGroup) this.moonGroup.visible=moonA>0.01;
    // 地面：SPHERE 中段淡出（让位给地球球面）
    if(this.siteGroup){ const sa=(ph==='SPHERE')?Math.max(0,1-Math.max(0,(kS-0.18))/0.46):(groundPh?1:0);
      if(Math.abs(sa-(this._siteA===undefined?1:this._siteA))>0.002||sa===0||sa===1){ this._siteA=sa; this._fadeGroup(this.siteGroup, sa); } }
    // 大气雾：地面段近，升空推远（等于关闭）
    if(this.fog){ const f=(ph==='SPHERE')?6.0+kS*900 : (groundPh?6.0:1e5);
      this.fog.far=f; this.fog.near=groundPh?1.0:1e5-1; }
    // 阴影范围跟随主体：发射场(小) → 绕地球(中) → 月球着陆(小)
    if(this.sun){ let c=this._site, r=0.58, far=60;
      if(groundPh){ c=this._site; r=0.58; far=60; }
      else if(ph==='SPHERE'||ph==='EARTH_ORBIT'||ph==='STAGE_SEP'){ c=new THREE.Vector3(0,0,0); r=2.6; far=30; }
      else if(ph==='TRANSFER'||ph==='LOI'||ph==='LUNAR_ORBIT'){ c=new THREE.Vector3(MD,0,0); r=1.2; far=30; }
      else if(ph==='LANDING'||ph==='LANDED'){ c=(this._landSite||new THREE.Vector3(MD,0,0)); r=0.55; far=30; }
      if(!this._shKey||this._shKey!==ph){ this._shKey=ph; this._shadowFit(c,r,far); } }
  }

  // —— 分镜导演 ——
  _camDesired(){
    const site=this._site, up=new THREE.Vector3(0,1,0), pos=new THREE.Vector3(), tgt=new THREE.Vector3();
    const lander=this.change && this.change.userData ? this.change.userData.lander : this.change;
    const U=up;   // 统一地平线上方向 (+Y), 避免运镜翻滚
    switch(this.phase){
      case 'COUNTDOWN': case 'IGNITION': {
        // 低角度英雄镜头(拉远看全火箭): 从 -Z 侧仰视火箭+塔架
        pos.set(-0.12, RE+0.05, -0.34); tgt.copy(site).add(new THREE.Vector3(0,0.08,0)); U.set(0,1,0); break; }
      case 'LIFTOFF': {
        // 平视→仰视：相机留台边，随火箭升高而抬升视线
        pos.set(-0.12, RE+0.05, -0.36); tgt.copy(this.rocket.position); U.set(0,1,0); break; }
      case 'SPHERE': {
        // 敬畏段落：相机升高, 地面→球面; 后段(球面出现)停顿2~3秒
        const q=Math.min(this.pt/DUR.SPHERE,1), rq=ease(Math.min(q/0.72,1));
        const h=RE+0.25 + rq*4.2;
        pos.set(1.5, h, -2.6); tgt.set(0, RE*0.55, 0); U.set(0,1,0); break; }
      case 'STAGE_SEP': {
        pos.set(0.85, 1.95, -1.35); tgt.copy(this.rocket.position); U.set(0,1,0); break; }
      case 'EARTH_ORBIT': {
        pos.copy(this.rocket.position).add(new THREE.Vector3(-1.55, 1.05, -1.85)); tgt.copy(this.rocket.position); U.set(0,1,0); break; }
      case 'TRANSFER': {
        // 长推近：开始广(带地球+月球+椭圆参照=空间线), 越近月球越逼近
        const k=Math.min(this.pt/DUR.TRANSFER,1);
        const r=1.05 - k*0.55;   // 广→近(以卫星为主体)
        pos.copy(this.change.position).add(new THREE.Vector3(-0.55*r, 0.42*r, -0.72*r)); tgt.copy(this.change.position); U.set(0,1,0); break; }
      case 'LOI': {
        pos.copy(this.change.position).add(new THREE.Vector3(0.30, 0.52, -0.42)); tgt.copy(this.change.position); U.set(0,1,0); break; }
      case 'LUNAR_ORBIT': {
        // 缓慢环绕：相机沿月球轨道外侧缓慢跟拍, 镜头有"意味"
        pos.copy(this.change.position).add(new THREE.Vector3(0.34, 0.46, -0.56)); tgt.copy(this.change.position); U.set(0,1,0); break; }
      case 'LANDING': case 'LANDED': {
        // 月面水平观察视角(同发射前地面机位): 站在月面低角度仰视登月器缓缓降落
        const site2=this._landSite||new THREE.Vector3(MD-RM-0.045,0,0);
        const upM=this._landUp||new THREE.Vector3(-1,0,0);
        const tan=this._landTangent||new THREE.Vector3(0,0,1);
        const landed=(this.phase==='LANDED');
        pos.copy(site2).addScaledVector(upM, landed?0.035:0.02).addScaledVector(tan, landed?0.22:0.42);   // 站在月面、向阳侧后退
        tgt.copy(lander.position).lerp(site2, landed?0.55:0.50); U.copy(upM); break; }
      default: pos.set(0,2.4,2.0); tgt.set(0,0,0); U.set(0,1,0);
    }
    return {pos,tgt,up};
  }
  _updateCamera(dt){
    const cam=this.ctx.camera;
    if(this._qaLock){ cam.position.copy(this._cam.pos); cam.up.copy(this._cam.up).normalize(); cam.lookAt(this._cam.tgt); return; }
    if(this._freeCam){ const c=this.ctx.cameraRig&&this.ctx.cameraRig.controls; if(c){ c.target.copy(this.rocket.position); c.update(); } return; }   // 用户手动视角
    const d=this._camDesired(), s=Math.min(1, dt*5);
    this._cam.pos.lerp(d.pos,s); this._cam.tgt.lerp(d.tgt,s); this._cam.up.lerp(d.up,s);
    cam.position.copy(this._cam.pos); cam.up.copy(this._cam.up).normalize(); cam.lookAt(this._cam.tgt);
  }
  render(){ const ctx=this.ctx; const w=ctx.renderer.domElement.clientWidth, h=ctx.renderer.domElement.clientHeight; ctx.renderer.setViewport(0,0,w,h); ctx.renderer.setScissor(0,0,w,h); ctx.renderer.render(this.scene, ctx.camera); }

  _buildUi(){
    if(!document.getElementById('mission-hud')){
      const h=document.createElement('div'); h.id='mission-hud';
      h.innerHTML=`<div style="position:fixed;left:12px;top:56px;z-index:60;background:var(--panel-solid,#0c1224);border:1px solid rgba(255,180,84,.35);border-radius:12px;padding:9px 14px;color:#e8ecf5;font-size:13px;text-align:left;pointer-events:auto;min-width:210px">
        <div id="mission-phase" style="font-weight:600;color:#ffb454">🚀 发射倒计时</div>
        <div id="mission-sub" style="font-size:11px;color:#9aa7bd;margin-top:3px;max-width:230px">—</div>
        <div id="mission-count" style="font-size:22px;font-weight:700;color:#ffd54a;margin-top:1px"></div>
        <div id="mission-prog-wrap" style="margin-top:6px">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:#8fa0b8"><span>🌍 地球</span><span>🌕 月球</span></div>
          <div style="position:relative;height:6px;background:rgba(255,255,255,.12);border-radius:3px;margin:2px 0">
            <div id="mission-prog-fill" style="position:absolute;left:0;top:0;height:100%;width:0%;background:linear-gradient(90deg,#7fd0ff,#ffd54a);border-radius:3px"></div>
            <div id="mission-prog-dot" style="position:absolute;top:-3px;left:0%;width:12px;height:12px;border-radius:50%;background:#ffb454;border:2px solid #fff;transform:translateX(-50%)"></div>
          </div>
          <div id="mission-dist" style="font-size:10px;color:#9aa7bd">—</div>
        </div>
        <button id="mission-stop" style="margin-top:5px;padding:5px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#e8ecf5;cursor:pointer">⏹ 停止任务</button>
      </div>`;
      document.body.appendChild(h);
      document.getElementById('mission-stop').addEventListener('click',()=>this.cancel());
    }
    document.getElementById('mission-hud').style.display='block';
  }
  _setCountdown(){ const el=document.getElementById('mission-count'); if(!el) return; const r=Math.ceil(DUR.COUNTDOWN-this.pt); el.textContent=r>0?String(r):'点火!'; }
  _updateHud(){
    const p=document.getElementById('mission-phase'), s=document.getElementById('mission-sub'); if(!p) return;
    const kid=isKidMode();
    p.textContent=(kid?PHASE_NAME_KID:PHASE_NAME)[this.phase]||this.phase; let sub='';
    sub=(kid?WHY_KID:WHY)[this.phase]||'';
    if(this.phase==='TRANSFER'){ const k=Math.min(this.pt/DUR.TRANSFER,1); sub+=`（转移 ${Math.round(k*100)}%）`; }
    else if(this.phase==='LUNAR_ORBIT'){ sub+=`　绕月第 ${Math.floor(Math.min(this.pt/DUR.LUNAR_ORBIT,1)*LUNAR_ORBITS)+1}/${LUNAR_ORBITS} 圈`; }
    else if(this.phase==='LANDING'){ const k=Math.min(this.pt/DUR.LANDING,1); sub+=`（下降 ${Math.round(k*100)}%）`; }
    if(this.phase!=='COUNTDOWN'&&this.phase!=='IGNITION'){ const c=document.getElementById('mission-count'); if(c) c.textContent=''; }
    s.textContent=sub;
    this._updateProgress();
  }
  _updateProgress(){
    // 空间进度条：嫦娥在地球—月球之间的位置（+ 距离）
    const fill=document.getElementById('mission-prog-fill'), dot=document.getElementById('mission-prog-dot'), dist=document.getElementById('mission-dist');
    if(!fill||!dot) return;
    const ch=this.change, cx=ch?ch.position.x:0;
    const frac=Math.max(0, Math.min(1, (cx+PARK)/(MD+PARK)));  // 从地球近处(-PARK)到月球(MD)
    if(!this._inMoon){ if(this.phase==='LANDING'||this.phase==='LANDED'||this.phase==='LUNAR_ORBIT'||this.phase==='LOI') this._inMoon=true; }
    const shown=this._inMoon?1:frac;
    fill.style.width=Math.round(shown*100)+'%'; dot.style.left=Math.round(shown*100)+'%';
    if(dist){ const dM=Math.max(0, MD-cx); const dE=Math.abs(cx);
      if(this._inMoon) dist.textContent = this.phase==='LOI'?'正在月球制动':((this.phase==='LANDING'||this.phase==='LANDED')?'已抵达月球 · 正在着陆':'已抵达月球 · 绕月飞行');
      else dist.textContent=`距月球 ${(dM*3.844).toFixed(1)} 万公里　距地球 ${(dE*3.844).toFixed(1)} 万公里`; }
  }
  _detachLander(){ const ch=this.change, lander=ch.userData.lander; const wp=lander.getWorldPosition(new THREE.Vector3());
    const mc=new THREE.Vector3(MD,0,0);
    this._landUp=wp.clone().sub(mc).normalize();                                 // 月面"上"方向(背离月心)
    this._landSite=mc.clone().addScaledVector(this._landUp, RM+0.045);           // 落点(着陆器原点, 腿刚好触地)
    this._landTangent=this.sunDir.clone().addScaledVector(this._landUp,-this.sunDir.dot(this._landUp)).normalize();  // 向阳侧切向
    ch.remove(lander); this.scene.add(lander); lander.position.copy(wp);
    ch.remove(this.plumeC); lander.add(this.plumeC); this._landerStart=wp.clone();
    if(this.lunarPatch){ const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), this._landUp);
      this.lunarPatch.position.copy(mc); this.lunarPatch.quaternion.copy(q); this.lunarPatch.visible=true; } }
  _showSuccess(){
    if(document.getElementById('mission-success')) return;
    const kid=isKidMode();
    const d=document.createElement('div'); d.id='mission-success';
    d.innerHTML=`<div style="position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:80;display:flex;align-items:center;justify-content:center">
      <div style="background:#0c1224;border:1px solid rgba(255,180,84,.4);border-radius:14px;padding:26px 30px;text-align:center;max-width:88vw">
        <div style="font-size:44px">🌕</div><h3 style="color:#ffb454;margin:10px 0 6px;font-size:20px">${kid?'到月球啦！':'登陆月球成功'}</h3>
        <p style="color:#9aa7bd;font-size:14px;margin-bottom:16px">${kid?'嫦娥稳稳地停在了月球上，我们成功啦。':'嫦娥已安全着陆月球。'}</p>
        <button id="mission-ok" style="padding:10px 26px;border-radius:10px;border:none;background:#ffb454;color:#1a1208;font-size:15px;cursor:pointer;font-weight:600">确定</button>
      </div></div>`;
    document.body.appendChild(d);
    document.getElementById('mission-ok').addEventListener('click',()=>this.finish());
  }
  _syncBtn(){ const b=document.getElementById('vt-mission'); if(b) b.textContent=this.active?'⏹ 停止任务':'🚀 嫦娥奔月'; const mb=document.getElementById('m-mission'); if(mb) mb.textContent=this.active?'⏹':'🚀'; }

  finish(){ this._teardown(); bus.emit('toast',{text:'嫦娥奔月演示完成',level:'ok'}); }
  cancel(){ this._teardown(); }
  _teardown(){
    const ctx=this.ctx, wasActive=this.active;
    if(this._saved.rate>=0) ctx.clock.setRate(this._saved.rate);
    ctx.clock.running=this._saved.running;
    if(this._saved.labelsOn&&ctx.orbitView&&!ctx.orbitView.labelsVisible) ctx.orbitView.toggleLabels();
    if(ctx.labelRenderer) ctx.labelRenderer.domElement.style.display=this._labelDisp==='none'?'none':'';
    if(ctx.cameraRig&&ctx.cameraRig.controls){ ctx.cameraRig.controls.enabled=this._saved.controlsOn!==false; if(this._saveMinMax){ ctx.cameraRig.controls.minDistance=this._saveMinMax.min; ctx.cameraRig.controls.maxDistance=this._saveMinMax.max; } }
    this._freeCam=false;
    ctx.camera.up.set(0,1,0);
    if(wasActive&&ctx.cameraRig&&ctx.cameraRig.reset) ctx.cameraRig.reset();
    this.disposeScene(this._scene); this._scene=null;
    // 还原全局渲染设置（色调映射/阴影），避免影响其它模块
    if(this._rset){ const r=ctx.renderer; r.toneMapping=this._rset.toneMapping; r.toneMappingExposure=this._rset.exposure;
      r.shadowMap.enabled=this._rset.shadow; r.shadowMap.type=this._rset.type; this._rset=null; }
    this._shKey=null; this._siteA=undefined;
    this.rocket=this.change=this.ground=this.tower=this.facilities=this.siteGroup=null;
    this.earthGroup=this.moonGroup=this.earth=this.moon=this.stars=this.sun=this.fog=null;
    if(this.envRT){ try{ this.envRT.dispose(); }catch(e){} this.envRT=null; }
    this.linePark=this.lineTransfer=this.lineLunar=null;
    this.boosters=this.steam=this.plumeR=this.plumeC=this.speedArrows=this.skyMat=null;
    this.launchFill=this.moonFill=null;
    this._dustPts=this._dustArr=null;
    this._transSepT=undefined; this._inMoon=false; this._saveMinMax=null; this._landerStart=null; this._qaLock=false;
    ['mission-hud','mission-success'].forEach(id=>{ const el=document.getElementById(id); if(el) el.remove(); });
    document.body.classList.remove('mission-active'); this.ctx.missionActive=false;
    this.active=false; this.phase='IDLE'; this.pt=0; this._built=false;
    this._syncBtn(); bus.emit('mission.end');
  }
}
