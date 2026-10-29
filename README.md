# 少女航线

网页游戏工程。主要应用、运行素材和构建配置位于 `pixigame/`。

## 获取工程

章节资源使用 Git LFS。先安装 [Git LFS](https://git-lfs.com/)，再克隆仓库：

```bash
git lfs install
git clone https://github.com/MrEMT327/yyyl.git
cd yyyl/pixigame
npm ci
npm run dev
```

建议使用 Node.js 24 LTS。若克隆时跳过了大文件下载，在仓库根目录执行 `git lfs pull`。

## 构建

```bash
cd pixigame
npm run build
npm run preview
```

构建产物位于 `pixigame/dist/`。本地存档、环境配置、依赖目录、制作原件和验证工具不随仓库上传。
