import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig({
  base: './',
  publicDir: 'public',              // textures/ 保持外部文件（file:// 兼容）
  plugins: [ viteSingleFile() ],
  build: {
    outDir: 'dist-offline',
    assetsInlineLimit: 100000000,
    // 离线版保留桌面单页（课堂大屏双击即用）；手机版走在线/局域网部署（dist/mobile.html）
  },
});
