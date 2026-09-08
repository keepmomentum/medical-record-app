#!/usr/bin/env bash
#
# 编译医录 iOS App（命令行，无需打开 Xcode）
#
# 用法：
#   bash scripts/build.sh              # 编译到 iOS 模拟器（arm64）
#   bash scripts/build.sh device       # 编译到真机（不签名，仅验证能否编译）
#   bash scripts/build.sh nospm        # 用 project.nospm.yml 编译（无 SPM 依赖，离线可用）
#
# 说明：
#   - 真机运行请用 Xcode 打开工程后 Cmd+R（需要开发者账号签名）
#   - 模拟器无法录音，ASR 相关功能必须在真机验证
#
set -euo pipefail

export USER="${USER:-$(id -un)}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="${1:-simulator}"
XGEN="$(command -v xcodegen || echo "$HOME/.local/bin/xcodegen")"

case "$MODE" in
  nospm)
    SPEC="project.nospm.yml"
    PROJ="YiluNoSPM.xcodeproj"
    SCHEME="Yilu"
    DD="build-nospm"
    ;;
  *)
    SPEC="project.yml"
    PROJ="Yilu.xcodeproj"
    SCHEME="Yilu"
    DD="build"
    ;;
esac

if [[ ! -d "$PROJ" ]]; then
  echo "==> 生成工程 ($SPEC)"
  "$XGEN" generate --spec "$SPEC"
fi

if [[ "$MODE" == "device" ]]; then
  echo "==> 编译目标：真机 (arm64)"
  xcodebuild -project "$PROJ" -scheme "$SCHEME" \
    -sdk iphoneos -destination 'generic/platform=iOS' \
    -derivedDataPath "$DD" CODE_SIGNING_ALLOWED=NO build
else
  echo "==> 编译目标：模拟器 (arm64)"
  xcodebuild -project "$PROJ" -scheme "$SCHEME" \
    -sdk iphonesimulator -arch arm64 \
    -derivedDataPath "$DD" CODE_SIGNING_ALLOWED=NO build
fi

APP=$(find "$DD" -name "Yilu.app" -maxdepth 5 | head -1)
echo
echo "✅ 编译成功"
echo "   产物：$APP"
if [[ -n "$APP" && -d "$APP/Resources/web" ]]; then
  echo "   内置 Web 资源：$(find "$APP/Resources/web" -type f | wc -l | tr -d ' ') 个文件"
fi
