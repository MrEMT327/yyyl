#!/bin/zsh
set -eu

project_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
node_bin=""
for candidate in "$(command -v node 2>/dev/null || true)" /usr/local/bin/node /opt/homebrew/bin/node; do
  if [[ -n "$candidate" && -x "$candidate" ]] && "$candidate" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=12)||(a===20&&b>=19)?0:1)' 2>/dev/null; then
    node_bin="$candidate"
    break
  fi
done

if [[ -z "$node_bin" ]]; then
  print '未找到可用的 Node.js，请安装 Node.js 22.12 或更新版本。'
  read -r '?按回车关闭…'
  exit 1
fi

if ! "$node_bin" "$project_dir/pixigame/server/open-latest.mjs" "$@"; then
  read -r '?启动未完成，按回车关闭…'
  exit 1
fi
