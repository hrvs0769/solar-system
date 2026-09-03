// 一键局域网服务：托管 dist（含 index.html + mobile.html + textures），供手机访问
// 用法：npm run serve   （或 node scripts/serve.js [目录] ）
import http from 'http';
import { readFile, stat } from 'fs/promises';
import { extname, join, resolve } from 'path';
import os from 'os';

const ROOT = resolve(process.argv[2] || 'dist');
const PORT = parseInt(process.env.PORT || '8000', 10);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.jpg':'image/jpeg', '.png':'image/png', '.json':'application/json', '.webp':'image/webp' };

const srv = http.createServer(async (req,res)=>{
  let p = (req.url||'/').split('?')[0];
  if(p==='/') p='/index.html';
  let f = resolve(join(ROOT, p));
  try{
    const st = await stat(f);
    if(st.isDirectory()) f = join(f, 'index.html');
    const d = await readFile(f);
    res.setHeader('Content-Type', MIME[extname(f)]||'application/octet-stream');
    res.end(d);
  }catch(e){ res.statusCode=404; res.end('404'); }
});

srv.listen(PORT, '0.0.0.0', ()=>{
  const ips = lanIPs();
  console.log('\n✅ 已启动，手机与电脑连到【同一 WiFi】后：');
  ips.forEach(ip=>console.log(`   📱 手机访问/扫码 → http://${ip}:${PORT}/mobile.html`));
  console.log(`   🖥 电脑打开 → http://localhost:${PORT}/index.html`);
});
function lanIPs(){
  const out=[]; const ifs=os.networkInterfaces();
  for(const name of Object.keys(ifs)) for(const i of (ifs[name]||[])) if(i.family==='IPv4' && !i.internal) out.push(i.address);
  return out.length? out : ['<你的局域网IP>'];
}
