// 程序化回退贴图：任何真实贴图缺失时兜底，绝不出现光秃纯色球
import * as THREE from 'three';

// 确定性噪声（值噪声 + 分形）
function rng(seed){ let s=seed>>>0; return ()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }
function makeNoise(seed){
  const r = rng(seed); const size=256; const grid=new Float32Array(size*size);
  for(let i=0;i<grid.length;i++) grid[i]=r();
  const at=(x,y)=>{ x=((x%size)+size)%size; y=((y%size)+size)%size; return grid[y*size+x]; };
  const smooth=t=>t*t*(3-2*t);
  return (u,v)=>{ // u,v in [0,1)
    const x=u*size, y=v*size; const x0=Math.floor(x), y0=Math.floor(y);
    const fx=smooth(x-x0), fy=smooth(y-y0);
    const a=at(x0,y0), b=at(x0+1,y0), c=at(x0,y0+1), d=at(x0+1,y0+1);
    return a*(1-fx)*(1-fy)+b*fx*(1-fy)+c*(1-fx)*fy+d*fx*fy;
  };
}
function fbm(noise,u,v,oct){
  let amp=1,f=1,sum=0,norm=0;
  for(let i=0;i<oct;i++){ sum+=noise(u*f,v*f)*amp; norm+=amp; amp*=0.5; f*=2; }
  return sum/norm;
}

function canvas(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }

function shadeHex(hex, mult){ // 简单调色
  const h=hex.replace('#',''); const n=parseInt(h,16);
  const r=Math.min(255,((n>>16)&255)*mult), g=Math.min(255,((n>>8)&255)*mult), b=Math.min(255,(n&255)*mult);
  return `rgb(${r|0},${g|0},${b|0})`;
}

function drawCraters(ctx,w,h,seed,count,base,multMin=0.75,multMax=1.05,minR=2,maxR=14){
  const r=rng(seed);
  for(let i=0;i<count;i++){
    const x=r()*w, y=r()*h, rad=minR+r()*(maxR-minR);
    const m=multMin+r()*(multMax-multMin);
    ctx.fillStyle=shadeHex(base,m); ctx.beginPath(); ctx.arc(x,y,rad,0,Math.PI*2); ctx.fill();
    // 亮圈（坑缘）
    ctx.strokeStyle=shadeHex(base,m+0.12); ctx.lineWidth=Math.max(1,rad*0.12); ctx.stroke();
  }
}

const BUILT = {};
export function getFallbackTexture(bodyId){
  if(BUILT[bodyId]) return BUILT[bodyId];
  const tex = build(bodyId);
  if(tex){ BUILT[bodyId]=tex; return tex; }
  return plain(bodyId);
}

function plain(bodyId){
  const colors={ mercury:'#9a8b7d', venus:'#e0c890', earth:'#4f8fe0', mars:'#c25a3a', jupiter:'#cdb088',
    saturn:'#e0c89a', uranus:'#a8d4dd', neptune:'#5b7fe0', sun:'#ff8a00', moon:'#aaaaaa' };
  const c=canvas(256,128); const g=c.getContext('2d');
  g.fillStyle=colors[bodyId]||'#888'; g.fillRect(0,0,256,128);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}

function build(bodyId){
  const c=canvas(1024,512); const g=c.getContext('2d');
  const w=c.width, h=c.height;
  let base='#888';
  if(bodyId==='earth') base='#2a5aa0';
  else if(bodyId==='mars') base='#b45a38';
  else if(bodyId==='mercury') base='#8f8272';
  else if(bodyId==='venus') base='#d8c28c';
  else if(bodyId==='moon') base='#9f9f9f';
  else if(bodyId==='jupiter') base='#c8a878';
  else if(bodyId==='saturn') base='#d8c298';
  else if(bodyId==='uranus') base='#9fc9d4';
  else if(bodyId==='neptune') base='#4f6fd0';
  else if(bodyId==='sun') base='#ff7a00';

  if(bodyId==='earth'){
    g.fillStyle=base; g.fillRect(0,0,w,h);
    const n=makeNoise(1);
    // 大陆
    for(let i=0;i<2200;i++){ const x=Math.floor(n(i*0.013,i*0.017)*w), y=Math.floor(n(i*0.021,i*0.011)*h);
      const m=0.9+n(x*0.1,y*0.1)*0.5; g.fillStyle=`rgba(46,120,60,${0.4+m*0.4})`; g.fillRect(x%w,y%h,3,3); }
    // 极冠
    g.fillStyle='rgba(240,245,250,0.95)'; g.fillRect(0,0,w,h*0.05); g.fillRect(0,h*0.95,w,h*0.05);
  }
  else if(bodyId==='jupiter'||bodyId==='saturn'){
    const n=makeNoise(2); const bands = bodyId==='jupiter'?28:18;
    for(let y=0;y<h;y++){
      const t=y/h; const band=Math.sin(t*bands*Math.PI)*0.5+0.5;
      const nz=fbm(n,0.1,t*6,3)*0.5;
      const shade=0.8+band*0.35+nz*0.25;
      const rgb=hexToRgb(base); g.fillStyle=`rgb(${(rgb[0]*shade)|0},${(rgb[1]*shade)|0},${(rgb[2]*shade)|0})`;
      g.fillRect(0,y,w,1);
    }
    if(bodyId==='jupiter'){ // 大红斑
      g.fillStyle='rgba(200,70,50,0.9)'; g.beginPath(); g.ellipse(w*0.32,h*0.62,w*0.07,h*0.035,0,0,Math.PI*2); g.fill();
    }
  }
  else if(bodyId==='sun'){
    const n=makeNoise(3);
    const img=g.createImageData(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){ const i=(y*w+x)*4;
      const v=fbm(n,x/w*4,y/h*4,4)*0.6+0.4; const r=255, gg=140*v+60, b=40*v+10;
      img.data[i]=r; img.data[i+1]=gg; img.data[i+2]=b; img.data[i+3]=255; }
    g.putImageData(img,0,0);
  }
  else {
    // 岩态/月球/天王星/海王星：色 + 噪声明暗 + 环形山
    const n=makeNoise(42);
    const img=g.createImageData(w,h);
    const rgb=hexToRgb(base);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){ const i=(y*w+x)*4;
      const v=0.75+fbm(n,x/w*8,y/h*8,5)*0.5; const m=(bodyId==='uranus'||bodyId==='neptune')?0.7+0.3*v:v;
      img.data[i]=Math.min(255,rgb[0]*m); img.data[i+1]=Math.min(255,rgb[1]*m); img.data[i+2]=Math.min(255,rgb[2]*m); img.data[i+3]=255; }
    g.putImageData(img,0,0);
    if(bodyId==='moon'||bodyId==='mercury') drawCraters(g,w,h,7, bodyId==='moon'?900:350, base);
  }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4;
  return t;
}

function hexToRgb(hex){ const h=hex.replace('#',''); const n=parseInt(h,16); return [(n>>16)&255,(n>>8)&255,n&255]; }

// 云层程序化贴图（地球）
export function getFallbackClouds(){
  if(BUILT['earth_clouds']) return BUILT['earth_clouds'];
  const c=canvas(512,256); const g=c.getContext('2d'); const n=makeNoise(9);
  g.clearRect(0,0,c.width,c.height);
  for(let i=0;i<1600;i++){ const x=n(i*0.03,i*0.05)*c.width, y=n(i*0.07,i*0.02)*c.height;
    const v=n(x*0.2,y*0.2); if(v>0.55){ g.fillStyle=`rgba(255,255,255,${(v-0.5)*1.6})`; g.beginPath(); g.arc(x%c.width,y%c.height,2+v*4,0,Math.PI*2); g.fill(); } }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return BUILT['earth_clouds']=t;
}
