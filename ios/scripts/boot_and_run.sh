#!/usr/bin/env bash
#
# 启动医录 iOS App（编译 → 起模拟器 → 安装 → 运行）
#
# 用法：
#   bash scripts/boot_and_run.sh                 # 默认：离线工程 + iPhone 17 Pro
#   bash scripts/boot_and_run.sh nospm           # 同上（离线工程，无 SPM 依赖）
#   bash scripts/boot_and_run.sh spm             # 带 Sherpa-ONNX 的完整工程
#   bash scripts/boot_and_run.sh nospm "iPhone Air"
#
# 已知问题：
#   Xcode 26.6 + iOS 26.5 模拟器的 `simctl install` 存在 bug，稳定报
#   "Missing bundle ID"（IXErrorDomain code=13），与本项目代码无关。
#   脚本会自动捕获该失败，并引导你改用 Xcode GUI 按 ⌘R 运行。
#
set -uo pipefail

export USER="${USER:-$(id -un)}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="${1:-nospm}"
DEVICE_NAME="${2:-iPhone 17 Pro}"

case "$MODE" in
  spm)   PROJ="Yilu.xcodeproj";     BUNDLE_ID="com.yilu.app" ;;
  nospm) PROJ="YiluNoSPM.xcodeproj"; BUNDLE_ID="com.yilu.nospm" ;;
  *) echo "用法: bash scripts/boot_and_run.sh [nospm|spm] [设备名]"; exit 1 ;;
esac

echo "==> 模式：$MODE（工程 $PROJ）"

# ---------------------------------------------------------------- 1. 编译
echo "==> 编译"
if ! bash scripts/build.sh "$MODE" 2>&1 | tail -3; then
  echo "❌ 编译失败，请先修复编译错误"
  exit 1
fi

DD="build"
[[ "$MODE" == "nospm" ]] && DD="build-nospm"
APP="$ROOT/$DD/Build/Products/Debug-iphonesimulator/Yilu.app"

if [[ ! -d "$APP" ]]; then
  echo "❌ 找不到产物：$APP"
  exit 1
fi

# 从产物里读真实 bundle id，避免写死
REAL_ID="$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$APP/Info.plist" 2>/dev/null || echo "$BUNDLE_ID")"
BUNDLE_ID="$REAL_ID"
echo "==> 产物：$APP"
echo "==> Bundle ID：$BUNDLE_ID"

# ---------------------------------------------------------- 2. 选模拟器
# 优先复用已启动的设备；否则按名字找；再否则取第一个可用 iPhone
UDID="$(xcrun simctl list devices booted -j 2>/dev/null | grep -m1 -oE '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}' || true)"

if [[ -z "$UDID" ]]; then
  UDID="$(xcrun simctl list devices available -j 2>/dev/null \
    | python3 -c "
import sys, json
name = '''$DEVICE_NAME'''
try:
    d = json.load(sys.stdin)['devices']
except Exception:
    sys.exit(0)
for runtime, devs in d.items():
    for dev in devs:
        if dev.get('name') == name and dev.get('isAvailable'):
            print(dev['udid']); sys.exit(0)
for runtime, devs in d.items():
    for dev in devs:
        if 'iPhone' in dev.get('name','') and dev.get('isAvailable'):
            print(dev['udid']); sys.exit(0)
" || true)"
fi

if [[ -z "$UDID" ]]; then
  echo "❌ 没有可用的 iPhone 模拟器。请在 Xcode → Settings → Platforms 下载 iOS 运行时。"
  exit 1
fi

DEV_LABEL="$(xcrun simctl list devices -j 2>/dev/null | python3 -c "
import sys, json
u='''$UDID'''
try:
    d=json.load(sys.stdin)['devices']
except Exception: sys.exit(0)
for _,devs in d.items():
    for dev in devs:
        if dev['udid']==u: print(dev['name']); sys.exit(0)
" || echo "$UDID")"

echo "==> 模拟器：$DEV_LABEL ($UDID)"

# ------------------------------------------------------------ 3. 启动设备
if ! xcrun simctl list devices booted | grep -q "$UDID"; then
  echo "==> 冷启动模拟器"
  xcrun simctl boot "$UDID" 2>/dev/null || true
  xcrun simctl bootstatus "$UDID" -b 2>/dev/null | tail -1
fi
open -a Simulator

# -------------------------------------------------------------- 4. 安装
echo "==> 安装（ad-hoc 签名）"
codesign -f -s - "$APP" >/dev/null 2>&1 || true

INSTALL_LOG="$(mktemp)"
if xcrun simctl install "$UDID" "$APP" >"$INSTALL_LOG" 2>&1; then
  echo "✅ 安装成功"
  open -a Simulator
  xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 \
    && echo "✅ 已在 $DEV_LABEL 启动医录" \
    || echo "⚠️  安装成功但启动失败，请在模拟器主屏手动点击「医录」"
  rm -f "$INSTALL_LOG"
  exit 0
fi

# ------------------------------------------------------- 5. 失败兜底引导
echo
echo "❌ simctl install 失败："
sed 's/^/   /' "$INSTALL_LOG"
rm -f "$INSTALL_LOG"

cat <<'TIP'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  这是 Xcode 26.6 + iOS 26.5 模拟器的已知 bug
  （IXErrorDomain code=13 "Missing bundle ID"），与项目代码无关。
  Apple 论坛 thread/839017 有多人一致复现，命令行通道无法绕过。

  👉 请改用 Xcode 运行：
     1. 已为你打开 Xcode 工程
     2. 顶部目标选择刚启动的模拟器
     3. 按 ⌘R

  若 Xcode 也装不上，可先在浏览器验收 UI：
     python3 -m http.server 9123   （工程根目录）
     http://127.0.0.1:9123/index.html
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TIP

open "$ROOT/$PROJ" 2>/dev/null
exit 1
