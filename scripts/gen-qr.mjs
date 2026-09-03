// 部署用：为手机版地址生成二维码 PNG。用法：node scripts/gen-qr.mjs <url> <out.png>
import QRCode from 'qrcode';
import { writeFile } from 'fs/promises';

const url = process.argv[2];
const out = process.argv[3] || 'mobile-qr.png';
if(!url){ console.error('用法：node scripts/gen-qr.mjs <url> <out.png>  （url 如 http://192.168.1.10:8000/mobile.html）'); process.exit(1); }
const dataUrl = await QRCode.toDataURL(url, { width: 480, margin: 2, color:{ dark:'#000000', light:'#ffffff' } });
const b64 = dataUrl.split(',')[1];
await writeFile(out, Buffer.from(b64, 'base64'));
console.log('二维码已生成：', out, ' → ', url);
