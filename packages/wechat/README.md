# 微信小游戏开发纪要

2026-11-17 确定以 `r145-source/` 为持续维护的微信小游戏源码。今后的微信优化、功能修复和构建都在这份目录里迭代。目录名沿用 `r145-source`，各次出包用 Git 提交和构建号追溯。

## 工程位置

| 目录 | 用途 |
| --- | --- |
| [`r145-source/`](r145-source/) | 微信小游戏的维护和构建入口。`pixigame/wechat/src/` 是平台适配，`pixigame/src/` 和 `pixigame/replica-battle/` 包含大厅、共用逻辑和战斗。 |
| [`r92-source/`](r92-source/) 和 [`shnh-wechat-r92.zip`](shnh-wechat-r92.zip) | 历史微信源码和测试包，用于复现 r92。 |
| [外层 `pixigame/`](../../pixigame/) | 日常 H5 工程。H5 与微信副本里的同名文件各自独立，共用改动按任务范围同步。 |
| `out/game/` | 本地微信成品和微信开发者工具的固定导入目录，由 Git 忽略。每次构建都用校验后的新包替换这里的旧成品。 |

r92 测试包由 `a4c9b8d` 加入，对应源码由 `42e24c5` 加入。`503bff6` 引入 r145 源码与构建输入，基线构建号是 `r145-perf-startup-art-2026-11-17T01:20:53.690Z`。2026-11-17 核对的工作区中，`out/game/` 的构建号为 `r92-2026-11-16T00:02:04.799Z`。各开发者按本机成品的构建号确认真机版本。

## 构建与导入

1. 在 `r145-source/` 维护源码。已有兼容的依赖和缓存可直接复用。需要安装时运行 `npm --prefix pixigame ci`，源码测试用 `npm --prefix pixigame test`。该基线的验收环境为 Node.js 24.18.0。
2. 从 `r145-source/` 运行 `npm --prefix pixigame run build:wechat`。[构建脚本](r145-source/tools/build-wechat.mjs) 在 Git 忽略的临时目录中生成并校验新包，再完整替换 `packages/wechat/out/game/`，清理旧包与本次的临时文件。构建或校验失败时可以继续使用已有成品。
3. 在微信开发者工具的「小游戏」模式下复用 `out/game/` 项目。预览时核对成品的 `BUILD-INFO.json` 中的 `buildIdentity.buildId`，并记录对应 Git 提交。当前脚本按运行模块摘要决定是否沿用基线构建号，涉及启动图等包内素材时也核对实际产物。

当前构建会从 `r145-source/build-inputs/` 读取小游戏配置、包内素材、CDN 清单和三个源码覆盖文件。大厅包使用 `lobby-overrides/src/replica/project-aircraft-render.js`，战斗包使用 `battle-overrides/src/replica/native-client-rules.js` 和 `battle-overrides/src/replica/native-equipment-boxes.js`。修改这些模块时以对应包的实际输入为准。

## 性能优化基线

- r92 的真机反馈是 iPhone 13 Pro 开高性能模式，默认飞机、第一关刚开战就约 10 FPS。代码分析优先关注战机像素读回与纹理上传、场景纹理上传以及 Phaser、战斗界面与屏幕之间的画布合成。面数和 Draw Call 的贡献要用真机采样区分。
- r145 已包含 r144 的渲染调度与 r145 的启动图更新。手机档背景缓冲为 `450 × 800`，普通滚动目标为 20 Hz，镜头移动时可提高。战机和背景的纹理更新尽量错开，并支持设备通过检测后直接复制战机纹理。
- 优化前先用 `out/game/` 的 r145 成品在同一台手机、同一关卡和同一模式采一份基线。战斗就绪后可用「查看日志」里的「开始录制」，记录实际呈现 FPS、战斗更新耗时、纹理传递耗时，以及可取得的 Draw Call 和三角面统计。r92 的 10 FPS 是历史对照，r145 的实际表现以这次真机记录为准。
- 普通模式也要验收资源显示。复现调试模式开关影响缺图时，先核对当前小游戏 AppID 对应的 CDN 下载和请求合法域名，再根据失败请求排查 HTTPS 或资源状态。
