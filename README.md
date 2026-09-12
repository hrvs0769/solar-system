# 璀璨太阳系

面向中学课堂的浏览器 3D 天文/物理教学演示系统：用真实历表（astronomy-engine）驱动太阳系运转，包含**全景、月相实验室、日月食、卫星**四个教学模块，以及一段约 78 秒的完整**嫦娥奔月**任务电影（12 个阶段：发射 → 入轨 → 出舱展开 → 地月转移 → 绕月 → 着陆）。

- 在线：https://hrvs0769.github.io/solar-system/ （手机版 `/mobile.html`）
- 离线：`npm run build:offline` → `dist-offline/index.html`，教室电脑双击即用
- 手机：顶栏「📱」生成二维码，同一 WiFi 扫码直达

**完整说明请看 [`docs/项目说明书.md`](docs/项目说明书.md)**（功能、架构、目录索引、怎么改、测试与自检台、已知限制）。

```bash
npm install
npm run dev            # 开发
npm run test:all       # 构建 + 单元 + e2e + 手机端自检
npm run test:vision    # 视觉自检台：12 阶段 × 7 机位截图 + 接触表
```
