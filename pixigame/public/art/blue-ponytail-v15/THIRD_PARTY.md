# 来源与依赖

## 蓝马尾造型与素材

用户明确选用「蓝马尾_定稿制作交接包」的唯一批准主图。SHA256：`bbe2d1be7c7b73cec9f75a4d92a8020c42186217554c7c9af0570f32e65b04fe`。原交接包十项校验记录见 `交接包哈希核验.json`。

前几版的透明素材、闭眼图、衣身补绘、独立扇面和侧脸由内置 image_gen 生成；提示词保存在 `source/image-prompts.json`、`source/v2-image-prompts.json`、`source/v3-image-prompts.json`。V4 没有新生成或修改这些 PNG，通过网格和 UV 使用现有素材。V3b 手图现在仅提供深蓝外扇骨的色块，不再用它的手部轮廓。

## 原版 touch_head 的使用

已有参考模型来自 [Chaoray/AzurLane-Live2D-Viewer](https://github.com/Chaoray/AzurLane-Live2D-Viewer)，固定 revision `88cb6e56a0ad472fe7e546509f096545d2bbc5b9`，目录 `live2d/rangbaer_4/`。角色为 Jean Bart - First Snow Upon Cutlass Edge。文件 URL、大小、SHA256 与原访问记录见 `reference/reference_manifest.json`。

为对应用户要求的同一时间、同一握扇姿势，V4 直接保留原版六块手部网格及每帧位置：`ArtMesh5`、`ArtMesh6`、`ArtMesh8`、`ArtMesh9`、`ArtMesh142`、`ArtMesh222`。它们对应模型中的 HandThumb、Hand、HandFingersBack、HandFingerBack2、HandWristTop、HandWristBottom。原版 `textures/texture_00.png` 原样复制到蓝马尾 `model/textures/texture_06.png`，仅六块手部的 UV 区域用于蓝马尾。

原版 touch_head 长 6.1 秒；采样时关闭循环及自动眨眼，保留原动作与物理输出，按 60 Hz 采集 367 个姿态。蓝马尾衣身、袖子、头发和头部关键形由该轨迹适配；折扇使用蓝马尾贴图。V4 本地对比包包含现有原版资源及取样数据，以便离线对比和重建。这与旧 V3 的独立手部绘画方案不同。

公开可读不等于获得游戏资产再分发或商业许可，本任务没有建立此类授权。原版资产的权利说明不由本项目的源码许可证替代。

## 运行依赖

- Live2D Cubism Core：实际版本 4.2.2；代码头部标明属于 [Live2D Proprietary Software License Agreement](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html) 中的 Redistributable Code。原文件和版权头保留。
- PixiJS 6.5.3：文件头标注 MIT。
- pixi-live2d-display：`reference/vendor/index.min.js`，来自同一固定仓库 revision；文件内没有可靠的嵌入版本标识。
- Live2D 2 兼容运行库 `live2d.min.js`：来自同一固定 revision，供捆绑加载器兼容使用；蓝马尾实际使用 Cubism 4。

## 导出器

`tools/export_moc3.py` 复用参考对话的 Python 导出器，改写自 [Ayatsuri2D](https://github.com/Yoru-KenomoVT/ayatsuri_2d/) 的 `crates/import/src/moc3_export.rs`。上游源码与 GPL-3.0 许可证在 `tools/vendor/ayatsuri/`。V4 使用本地原生 Core 读取运行时网格数据；没有使用 REA 或启动其服务，也没有生成第三方 .cmo3 编辑工程。

Python 导出器与本项目 Python 构建工具按 GPL-3.0 提供源码；新增网页和动作源码以 MIT 提供。这不替代独立素材和第三方运行库的权利说明。

## V5 头肩与袖子修正

V5 继续只处理 touch_head。头部逐帧目标取自原版眼球、鼻部、嘴部、耳缘与下巴网格；只使用其运行时位置作几何配准，蓝马尾头部和衣物继续使用原有 PNG。新增的上臂皮肤层从已存在的蓝马尾 cutout-v2 纹理取样；前发、颈部接缝和袖摆通过独立网格及变形器修正，没有新增 image_gen 素材。原版六块手部网格与图集仍沿用 V4。

## V6 面部修正

V6 只修改原生网格、UV 使用方式、变形器与图层组合。侧脸采用现有 blue-ponytail-profile-v3.png 的原始绘制，开闭眼使用现有两张头部绘图；没有新增或编辑 PNG。正常脸型保留蓝马尾比例，使用原版投影眼线作为姿态参考。原版六块手部与扇轴数据沿用 V5。

## V7 连续转头

V7 重排三个现有头部绘图的原生面部三角形，使用原版转角采样连续插值，并将对应特征点写入逐帧关键形。所有 PNG 复用前版，没有新增或编辑位图。输入控制点与三角形记录在 source/face-turn-v7.json。

## V8 转头与回眸

V8 新增 assets/blue-ponytail-turn-mid-v8.png，由内置 image_gen 以已有闭眼图和侧脸图为参考生成，原样复制到 texture_07.png。仅头部与前发区域参与模型，原批准主图与其他贴图未覆盖。精确提示词与输入记录在 source/v8-image-prompts.json。V8 统一头部姿态基准，增加轮廓对应点，并保留原动作正负转角；前发与颈部的分离通过原生几何完成。原版六块手部与扇轴数据保留。
