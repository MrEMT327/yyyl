# 少女航线微信小游戏 r145 源码

基线构建号为 `r145-perf-startup-art-2026-11-17T01:20:53.690Z`，包含 r144 的局内渲染调度和 r145 的启动图更新。H5 工程在仓库根目录的 [pixigame](../../../pixigame/)。

- `pixigame/wechat/src/` 是微信入口与平台适配。
- `pixigame/replica-battle/` 是战斗源码，`pixigame/src/` 包含大厅和共用逻辑。
- `build-inputs/` 保存小游戏配置、包内素材、CDN 映射和本版使用的大厅、战斗构建输入。其余运行资源由 CDN 提供。

## 构建和测试

在本目录使用 Node.js 24.18.0 运行以下命令。

```sh
npm --prefix pixigame ci
npm --prefix pixigame run build:wechat
npm --prefix pixigame test
```

用微信开发者工具的「小游戏」模式导入 `wechat-build/`。真机预览使用有项目权限的微信账号。如需再次构建，可运行 `node tools/build-wechat.mjs wechat-build-02` 指定新目录。
