# 环球大富翁

基于 React 和 Vite 的本地多人桌面棋盘游戏。游戏状态保存在当前浏览器的 `localStorage` 中，不提供远程联机或跨设备同步。

## 开发

```sh
npm ci
npm run dev
```

## 验证与构建

```sh
npm test
npm run build
```

生产构建输出到 `dist/`，可用 `npm run preview` 本地预览。

## 项目结构

- `src/App.jsx`：游戏流程、动画和本地存档。
- `src/components/`：棋盘、操作面板、玩家信息和反馈组件。
- `src/game/`：棋盘与国家数据、卡牌、规则引擎及规则测试。
- `assets/`：实体游戏照片与规则转录资料。
- `.github/workflows/`：Cloudflare Pages 自动部署。

推送到 `main` 会触发 Cloudflare Pages 部署。GitHub Actions 需要配置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` Secrets，Pages 项目名为 `richman`。