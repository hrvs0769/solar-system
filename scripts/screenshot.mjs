// 无头截图脚本：用 puppeteer-core 连接系统 Chrome，等待渲染后截图（用于开发自检）
import puppeteer from 'puppeteer-core';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.URL || 'http://localhost:8080/index.html';
const OUT = process.argv[2] || '/tmp/solar-shot.png';
const WAIT = parseInt(process.env.WAIT || '5000', 10);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox','--disable-gpu-sandbox','--disable-crash-reporter','--enable-unsafe-swiftshader','--use-angle=swiftshader'],
  defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
try{ await page.evaluateOnNewDocument(()=>{ try{ localStorage.setItem('ss-guide-done','1'); }catch(e){} }); }catch(e){}

const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await new Promise(r => setTimeout(r, WAIT));
const MODULE = process.env.MODULE;
if(MODULE){ await page.evaluate(id => { const b=document.querySelector(`#tabs .tab[data-mod="${id}"]`); if(b) b.click(); }, MODULE); await new Promise(r=>setTimeout(r,1200)); }
const FOCUS = process.env.FOCUS;
if(FOCUS){ await page.evaluate(id => { if(window.__SS && window.__SS.cameraRig && window.__SS.orbitView) window.__SS.cameraRig.focus(id); }, FOCUS); await new Promise(r=>setTimeout(r,1500)); }
const info = await page.evaluate(() => {
  const SS = window.__SS; if(!SS) return { note: 'no __SS' };
  const r = SS.renderer, sc = SS.scene, cam = SS.camera;
  const sample = (x,y) => { const p=new Uint8Array(4); if(r && r.getContext && r.getContext().drawingBufferWidth){ r.getContext().readPixels(r.getContext().drawingBufferWidth*x|0, r.getContext().drawingBufferHeight*y|0,1,1,r.getContext().RGBA, r.getContext().UNSIGNED_BYTE, p); return Array.from(p);} return null; };
  if(r && sc && cam) r.render(sc, cam);
  const pts = {};
  pts.center_stars = sample(0.5,0.5);
  pts.corner_stars = sample(0.02,0.05);
  if(SS.starfield){ SS.starfield.visible=false; if(r&&sc&&cam) r.render(sc,cam); }
  pts.center_noStars = sample(0.5,0.5);
  pts.corner_noStars = sample(0.02,0.05);
  if(SS.starfield) SS.starfield.visible=true;
  // 隔离：保持原背景，隐藏全部对象 → 判断米色来自背景还是物体
  const saved = [];
  sc.children.forEach(o=>{ saved.push([o, o.visible]); o.visible=false; });
  if(r&&sc&&cam) r.render(sc,cam);
  pts.onlyBg_original = sample(0.02,0.05);
  saved.forEach(([o,v])=>o.visible=v);
  // 分类隐藏：逐类判断哪个物体产生米色
  const cat = {};
  const hideBy = pred => { let n=0; sc.traverse(o=>{ if(pred(o)){ cat['hidden'+n]=[o,o.isSprite||o.isMesh||o.isLine||o.isPoints||o.isLight]; o.userData._h=o.visible; o.visible=false; n++; } }); return n; };
  const restore = () => sc.traverse(o=>{ if(o.userData._h!==undefined){ o.visible=o.userData._h; delete o.userData._h; } });
  // no sprites (sun corona)
  sc.traverse(o=>{ if(o.isSprite){ o.userData._h=o.visible; o.visible=false; } });
  if(r&&sc&&cam) r.render(sc,cam); pts.noSprites = sample(0.02,0.05);
  sc.traverse(o=>{ if(o.isSprite){ o.visible=o.userData._h; o.userData._h=undefined; } });
  // no lines (orbit lines)
  sc.traverse(o=>{ if(o.isLine){ o.userData._h=o.visible; o.visible=false; } });
  if(r&&sc&&cam) r.render(sc,cam); pts.noLines = sample(0.02,0.05);
  sc.traverse(o=>{ if(o.isLine){ o.visible=o.userData._h; o.userData._h=undefined; } });
  // no meshes
  sc.traverse(o=>{ if(o.isMesh){ o.userData._h=o.visible; o.visible=false; } });
  if(r&&sc&&cam) r.render(sc,cam); pts.noMeshes = sample(0.02,0.05);
  sc.traverse(o=>{ if(o.isMesh){ o.visible=o.userData._h; o.userData._h=undefined; } });
  // 精灵屏幕信息
  const sprites=[];
  sc.traverse(o=>{ if(o.isSprite){ const p=o.position.clone(); o.getWorldPosition(p); const ndc=p.clone().project(cam); sprites.push({ scale:[Number(o.scale.x.toFixed(3)),Number(o.scale.y.toFixed(3)),Number(o.scale.z.toFixed(3))], worldPos:[Number(p.x.toFixed(3)),Number(p.y.toFixed(3)),Number(p.z.toFixed(3))], ndc:[Number(ndc.x.toFixed(2)),Number(ndc.y.toFixed(2)),Number(ndc.z.toFixed(3))], visible:o.visible }); } });
  pts.spriteInfo = sprites;
  const lbls=[...document.querySelectorAll('.body-label')];
  return {
    labelCount: lbls.length,
    firstLabel: lbls[0] ? { text:lbls[0].textContent.slice(0,10), disp:getComputedStyle(lbls[0]).display, x:Math.round(lbls[0].getBoundingClientRect().x), y:Math.round(lbls[0].getBoundingClientRect().y) } : null,
    clearColor: (sc.background && sc.background.clone && r.getClearColor) ? r.getClearColor(sc.background.clone()).getHexString() : null,
    sceneBg: sc.background ? sc.background.getHexString() : null,
    pixels: pts, canvasAlpha: r.getContext().getContextAttributes().alpha,
    drawCalls: r.info.render.calls, triangles: r.info.render.triangles, points: r.info.render.points,
  };
});
await page.screenshot({ path: OUT });
await browser.close();
console.log('SCREENSHOT_SAVED', OUT);
console.log('--- diagnostic ---'); console.log(JSON.stringify(info, null, 2));
console.log('--- console ---'); console.log(logs.slice(-30).join('\n'));
