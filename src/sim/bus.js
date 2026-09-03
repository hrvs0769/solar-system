// 极简事件总线（UI ↔ 模拟 ↔ 场景 解耦）
const listeners = new Map();
export const bus = {
  on(topic, fn){
    if(!listeners.has(topic)) listeners.set(topic, new Set());
    listeners.get(topic).add(fn);
    return () => bus.off(topic, fn);
  },
  off(topic, fn){ listeners.get(topic)?.delete(fn); },
  emit(topic, payload){
    listeners.get(topic)?.forEach(fn => { try{ fn(payload); }catch(e){ console.error(`[bus:${topic}]`, e); } });
  },
};
