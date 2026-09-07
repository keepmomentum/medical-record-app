#!/usr/bin/env bash
#
# 只同步 Web 资源到 Xcode 工程（日常开发高频操作）
# 改完 index.html / css / js 后执行本脚本，再在 Xcode 里 Cmd+R
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/.." && pwd)"
WEB_DIR="$ROOT/Yilu/Resources/web"

mkdir -p "$WEB_DIR"
rm -rf "${WEB_DIR:?}"/*
cp "$REPO_ROOT/index.html" "$WEB_DIR/"
cp -R "$REPO_ROOT/css" "$WEB_DIR/"
cp -R "$REPO_ROOT/js" "$WEB_DIR/"

# iOS 上资源带缓存版本号，同步后自动升级，避免改了没生效
VERSION="v$(date +%s)"
/usr/bin/sed -i '' "s/?v=[0-9]\{1,\}/?v=$VERSION/g" "$WEB_DIR/index.html" 2>/dev/null || true

echo "已同步 Web 资源 -> $WEB_DIR （缓存版本 $VERSION）"
find "$WEB_DIR" -type f | sed "s|$WEB_DIR/|  |" | head -20
