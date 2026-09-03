# 项目长期笔记：璀璨太阳系

## 仓库与版本控制

- 2026-09-03 建立 git 仓库（`main` 分支，首提交 `3738e83`）。此前项目**完全无版本控制**，仅靠 `docs/开发日志.md` 手工记录。
- `.gitignore` 已排除：`node_modules/`、`dist/`、`dist-offline/`、`tmp-pup/`、`tmp-qr/`、`.DS_Store`、`*.log`、编辑器目录。
- 贴图（`public/textures/*.jpg`，约 6MB）**纳入**版本控制，属核心交付资产。
- 构建产物不入库，用 `npm run build:web` / `npm run build:offline` 重建。

## 并发会话安全规则

HR 会用多个智能体同时操作本工作区。约定：

- **安全**：`status` / `diff` / `log` / `add` / `commit` —— 只读或只写 `.git/`，不碰工作区。
- **禁止**：`checkout` / `reset --hard` / `stash pop` / `clean -fd` —— 会覆写工作区文件，可能摧毁另一个会话未提交的改动。执行前必须先确认没有其他会话在跑。

## 项目状态速查

- 技术栈：three 0.170（WebGL2）+ astronomy-engine 2.1.19（VSOP87）+ vite 6。
- 五个教学模块：全景 / 月相 / 潮汐 / 日月食 / 四季；双入口 `index.html`（桌面大屏，主战场）与 `mobile.html`（手机）。
- 测试：`npm test`（单测 12）、`npm run test:all`（单测+e2e 47+手机自检，需系统 Chrome）。
- 上线阻断项：`src/data/planet-facts.js` 中 11 处 `reviewStatus:'pending'`，须物理老师审校。
- 长期遗留：太阳真实感未定稿、手机端"原生感"与扫码部署未解决、从未在真实独显机器验证。
- 已知技术禁忌（见 `docs/老大难问题与改进提案.md`）：勿用 THREE.Sprite；用 `setViewport` 的模块退出后须重置整屏视口；JPEG 无 alpha，半透明层走 alphaMap。
