// 手机版离线缓存：首次打开后，同源资源缓存（Cache-First，网络失败时兜底）
const CACHE='ss-v2';
self.addEventListener('install', ()=>{ self.skipWaiting(); });
self.addEventListener('activate', (e)=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', (e)=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET' || u.origin!==location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async c=>{
      const hit=await c.match(e.request);
      const net = fetch(e.request).then(res=>{ if(res && res.ok) c.put(e.request, res.clone()); return res; }).catch(()=>hit);
      return hit || net;
    })
  );
});
