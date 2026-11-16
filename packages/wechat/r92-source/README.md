# 少女航线微信小游戏 r92 源码

这是微信小游戏的 r92 联调源码，基线构建号为 `r92-2026-11-16T00:02:04.799Z`。H5 工程入口在仓库根目录的 [pixigame](../../../pixigame/)。

- `pixigame/wechat/src/` 包含微信运行时和平台适配。
- `pixigame/src/` 包含大厅和共用逻辑，`pixigame/replica-battle/` 包含战斗源码。
- `build-inputs/` 保存 r92 所需的小游戏配置、包内素材和 CDN 清单。游戏运行时通过 CDN 加载其余资源。

## 构建和测试

在本目录运行以下命令。验收环境使用 Node.js 24.18.0。

```sh
npm --prefix pixigame ci
npm --prefix pixigame run build:wechat
npm --prefix pixigame test
```

构建完成后，用微信开发者工具的「小游戏」模式导入 `wechat-build/`。真机预览请使用有该小游戏权限的微信账号。重建时可在本目录运行 `node tools/build-wechat.mjs wechat-build-02` 指定新的输出目录。
