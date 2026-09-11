import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardWebGL } from '../src/ui/gl-guard.js';

test('guardWebGL 对缺失的 renderer / canvas 静默返回', ()=>{
  assert.doesNotThrow(()=>guardWebGL(null));
  assert.doesNotThrow(()=>guardWebGL({}));
  assert.doesNotThrow(()=>guardWebGL({ domElement:null }));
});

test('guardWebGL 对同一 canvas 只绑定一次', ()=>{
  let n=0;
  const cv={ addEventListener:()=>n++ };
  guardWebGL({ domElement:cv });
  guardWebGL({ domElement:cv });
  assert.equal(n, 1);
});

test('上下文丢失时阻止默认行为并弹出恢复浮层', ()=>{
  const handlers={};
  const cv={ addEventListener:(t,fn)=>{ handlers[t]=fn; } };
  const added=[];
  const prevDoc=globalThis.document, prevSS=globalThis.sessionStorage;
  const el={ style:{} };
  globalThis.document={ body:{ appendChild:e=>added.push(e) }, createElement:()=>el, getElementById:()=>({ addEventListener(){} }) };
  globalThis.sessionStorage={ getItem:()=>'2', setItem(){} };
  try{
    guardWebGL({ domElement:cv });
    assert.equal(typeof handlers.webglcontextlost, 'function');
    let prevented=false;
    handlers.webglcontextlost({ preventDefault(){ prevented=true; } });
    assert.ok(prevented, '必须 preventDefault，否则不会收到 restored 事件');
    assert.equal(added.length, 1);
    assert.match(added[0].innerHTML, /画面中断了/);
    assert.match(added[0].innerHTML, /重新开始/);
  } finally {
    globalThis.document=prevDoc; globalThis.sessionStorage=prevSS;
  }
});
