# 少女航线微信小游戏 r145 源码

基线构建号为 `r145-perf-startup-art-2026-11-17T01:20:53.690Z`，包含 r144 的局内渲染调度和 r145 的启动图更新。H5 工程在仓库根目录的 [pixigame](../../../pixigame/)。

后续微信小游戏的优化、修复和构建都在本目录迭代。固定导入路径、构建方法和真机性能基线见 [微信小游戏开发纪要](../README.md)。

- `pixigame/wechat/src/` 是微信入口与平台适配。
- `pixigame/replica-battle/` 是战斗源码，`pixigame/src/` 包含大厅和共用逻辑。
- `build-inputs/` 保存小游戏配置、包内素材、CDN 映射和本版使用的大厅、战斗构建输入。其余运行资源由 CDN 提供。
