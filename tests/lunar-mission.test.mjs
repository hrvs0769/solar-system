import test from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { LunarMission } from '../src/modules/lunar-mission.js';

// constructor 依赖 renderer/camera 等浏览器上下文，用原型构造最小实例
function fakeMission(phase){
  const m = Object.create(LunarMission.prototype);
  m.active = true; m.phase = phase; m.pt = 0;
  m._site = new THREE.Vector3(0,0,0);
  m.rocket = new THREE.Object3D();
  m.boosters = null; m.wenchang = null; m.skyMat = null;
  m.plumeR = { visible:true, userData:{ cone:new THREE.Object3D() } };
  m.steamTicks = 0;
  m._updateSteam = function(){ m.steamTicks++; };
  m._updateCamera = function(){};
  m._updateHud = function(){};
  return m;
}

test('点火之后的阶段仍在推进蒸汽粒子（旧实现只在 IGNITION 调用，残余粒子会冻结在半空）', () => {
  for(const phase of ['IGNITION','LIFTOFF','SPHERE']){
    const m = fakeMission(phase);
    m.update(1/60);
    assert.ok(m.steamTicks > 0, `「${phase}」阶段未推进蒸汽粒子`);
  }
});

test('蒸汽粒子寿命耗尽后自行隐藏，不留下静止残点', () => {
  const m = Object.create(LunarMission.prototype);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  m.steam = new THREE.Points(geo, new THREE.PointsMaterial());
  m.steam.visible = true;
  m.steam.userData.parts = [{ x:0, y:1, z:0, vx:0, vy:0.1, vz:0, life:0.1, s:1 }];
  m._updateSteam(0.5);
  assert.equal(m.steam.visible, false);
});

test('着陆成功文案用「登陆」而非「登录」', async () => {
  const src = await readFile(new URL('../src/modules/lunar-mission.js', import.meta.url), 'utf8');
  assert.ok(!/登录/.test(src), '界面文案不应出现「登录」');
});

function withFakeDom(fn){
  const prev = globalThis.document;
  globalThis.document = { body:{ classList:{ add(){}, remove(){} } }, getElementById:()=>null };
  try{ fn(); } finally { globalThis.document = prev; }
}

function fakeTeardownMission(){
  const m = Object.create(LunarMission.prototype);
  m.ctx = {
    clock:{ rateIndex:1, running:true, setRate(){} },
    camera:new THREE.PerspectiveCamera(),
    cameraRig:null, orbitView:null, labelRenderer:null, missionActive:false,
  };
  m.active = true; m.phase = 'LANDING'; m.pt = 5;
  m._saved = { rate:-1, running:true, labelsOn:false, controlsOn:true };
  m._inMoon = true; m._transSepT = 3.4; m._freeCam = true;
  m._dustPts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial());
  m._dustArr = new Float32Array(9); m._dustN = 3;
  m._scene = new THREE.Scene();
  return m;
}

test('退出任务会重置残留状态，第二次进入的表现与第一次一致', () => {
  withFakeDom(()=>{
    const m = fakeTeardownMission();
    m._teardown();
    assert.equal(m._inMoon, false, '「已抵达月球」标记应复位');
    assert.equal(m._transSepT, undefined, '上面级分离计时应复位');
    assert.equal(m._dustPts, null, '落月尘埃应释放引用，否则第二次落月复用已销毁的几何体');
  });
});

test('退出任务不销毁 texture-store 缓存的共享贴图', () => {
  withFakeDom(()=>{
    const m = fakeTeardownMission();
    const shared = new THREE.Texture();
    let disposed = false;
    shared.addEventListener('dispose', ()=>{ disposed = true; });
    m._scene.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshBasicMaterial({ map:shared })));
    m._teardown();
    assert.equal(disposed, false, '共享贴图被销毁后，全景与其他模块会重新上传或直接变黑');
  });
});
