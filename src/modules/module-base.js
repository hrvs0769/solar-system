// 模块生命周期基类
export class ModuleBase {
  constructor(ctx){ this.ctx = ctx; this._disposables = []; }
  enter(){}
  exit(){}
  update(dt){}
  render(){}
  // 记录待释放资源
  track(obj){ if(obj) this._disposables.push(obj); return obj; }
  disposeResources(){
    this._disposables.forEach(o=>{ if(o&&o.dispose) { try{o.dispose();}catch(e){} } });
    this._disposables = [];
  }
  // 释放场景的几何/材质（贴图由 texture-store 缓存统一持有，不在此释放）
  disposeScene(scene){
    if(!scene) return;
    scene.traverse(o=>{
      if(o.geometry) o.geometry.dispose();
      if(o.material){
        if(Array.isArray(o.material)) o.material.forEach(m=>m.dispose());
        else o.material.dispose();
      }
    });
  }
}
