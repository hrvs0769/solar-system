import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'],defaultViewport:{width:412,height:915}});
const p=await b.newPage();
await p.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36');
await p.setViewport({width:412,height:915,isMobile:true,hasTouch:true,deviceScaleFactor:2});
try{ await p.evaluateOnNewDocument(()=>{ try{ localStorage.setItem('ss-guide-done','1'); }catch(e){} }); }catch(e){}
await p.goto('https://hrvs0769.github.io/solar-system/',{waitUntil:'load',timeout:60000}); await new Promise(r=>setTimeout(r,6000));
console.log('公众首页用手机UA打开 → 最终URL:', p.url());
const m=await p.evaluate(()=>({ mui:!!document.getElementById('m-ui'), tabs:!!document.querySelector('#m-tabs'), topbar:!!document.querySelector('#topbar') }));
console.log('手机版(m-ui)=',m.mui,'底部tab=',m.tabs,'桌面topbar=',m.topbar,'(应为false)');
const boot=await p.evaluate(()=>({ has:!!window.__SS, draw:window.__SS?.renderer?.info?.render?.calls }));
console.log('小程序启动=',boot.has,'渲染调用=',boot.draw);
await p.screenshot({path:'/tmp/pub-mobile.png'});
await b.close();
