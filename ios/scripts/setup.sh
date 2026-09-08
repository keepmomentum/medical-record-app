#!/usr/bin/env bash
#
# 医录 iOS 工程准备脚本
#
# 做什么：
#   1. 把仓库根目录的 Web 应用（index.html / css / js）同步到 Xcode 资源目录
#   2. 把医疗术语词典拷贝进资源目录
#   3. （可选）用 XcodeGen 生成 Yilu.xcodeproj
#
# 用法：
#   bash scripts/setup.sh            # 只同步资源
#   bash scripts/setup.sh --xcodegen # 同步资源并生成 Xcode 工程
#
set -euo pipefail

# 某些执行环境（CI / 沙箱 / AppleScript 调用）里 USER 为空，
# XcodeGen 会因取不到用户名而报 "Couldn't find current username" 并终止
export USER="${USER:-$(id -un)}"
export LOGNAME="${LOGNAME:-$(id -un)}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/.." && pwd)"
RESOURCES="$ROOT/Yilu/Resources"
WEB_DIR="$RESOURCES/web"

echo "==> 同步 Web 资源"
mkdir -p "$WEB_DIR"
rm -rf "${WEB_DIR:?}"/*
cp "$REPO_ROOT/index.html" "$WEB_DIR/"
cp -R "$REPO_ROOT/css" "$WEB_DIR/" 2>/dev/null || true
cp -R "$REPO_ROOT/js" "$WEB_DIR/" 2>/dev/null || true
rm -rf "$WEB_DIR/js"/*.bak 2>/dev/null || true

echo "==> 拷贝医疗术语词典"
if [[ -f "$REPO_ROOT/asr-poc/eval_set/medical_terms.txt" ]]; then
  cp "$REPO_ROOT/asr-poc/eval_set/medical_terms.txt" "$RESOURCES/medical_terms.txt"
  echo "    medical_terms.txt ($(wc -l < "$RESOURCES/medical_terms.txt" | tr -d ' ') 行)"
else
  echo "    [warn] 未找到 asr-poc/eval_set/medical_terms.txt，将使用内置兜底词典"
fi

echo "==> 资源清单"
find "$WEB_DIR" -type f | sed "s|$WEB_DIR/|    web/|" | head -20

if [[ "${1:-}" == "--xcodegen" ]]; then
  echo "==> 生成 Xcode 工程"
  XGEN="$(command -v xcodegen || echo "$HOME/.local/bin/xcodegen")"
  if [[ ! -x "$XGEN" ]]; then
    echo "    [error] 未找到 xcodegen。安装方式："
    echo "      brew install xcodegen"
    echo "      或: curl -sL https://github.com/yonaskolb/XcodeGen/releases/download/2.46.0/xcodegen.zip -o /tmp/xg.zip \\"
    echo "          && unzip -q /tmp/xg.zip -d /tmp/xg && mkdir -p ~/.local/bin \\"
    echo "          && cp /tmp/xg/xcodegen/bin/xcodegen ~/.local/bin/ && xattr -cr ~/.local/bin/xcodegen"
    echo "    也可以手动创建 iOS App 工程，再把 Yilu/ 目录拖入。"
    exit 1
  fi
  (cd "$ROOT" && "$XGEN" generate)
  echo "    已生成 $ROOT/Yilu.xcodeproj"
fi

echo
echo "完成。接下来："
echo "  1. open $ROOT/Yilu.xcodeproj"
echo "  2. Xcode 自动解析 SPM 依赖（首次较慢，需下载 sherpa-onnx xcframework）"
echo "  3. 选择真机（模拟器无法录音），Cmd+R 运行"
