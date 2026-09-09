#!/usr/bin/env bash
#
# 在真机（iPhone）上编译、安装并运行医录
#
# 用法：
#   bash scripts/device_run.sh              # 默认：asr 工程（本地 xcframework，真 Sherpa-ONNX）
#   bash scripts/device_run.sh nospm        # 离线工程（无 ASR，只验 UI 与录音）
#   bash scripts/device_run.sh spm          # 带 SwiftPM 的完整工程
#   bash scripts/device_run.sh asr reonly   # 只重装，不重新编译
#
# 前置条件（每台机器 / 每台手机只需做一次）：
#   1. iPhone：设置 → 隐私与安全性 → 开发者模式 → 开启（会要求重启）
#   2. 重启解锁后，若弹「信任此电脑」→ 点信任，并保持屏幕解锁
#   3. Mac：Xcode → Settings → Accounts → 登录 Apple ID（免费账号即可）
#      登录后首次运行会生成 Personal Team 证书，签名有效期 7 天
#
# 本脚本会自动完成：发现设备 → 配对 → 编译（自动签名）→ 安装 → 启动
#
set -uo pipefail

export USER="${USER:-$(id -un)}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJ_ROOT="$(cd "$ROOT/.." && pwd)"
cd "$ROOT"

MODE="${1:-asr}"
REBUILD="${2:-build}"

case "$MODE" in
  spm)   PROJ="Yilu.xcodeproj";      DD="build-device-spm" ;;
  nospm) PROJ="YiluNoSPM.xcodeproj"; DD="build-device" ;;
  asr)   PROJ="YiluASR.xcodeproj";   DD="build-device-asr" ;;
  *) echo "用法: bash scripts/device_run.sh [asr|nospm|spm] [reonly]"; exit 1 ;;
esac

echo "==> 模式：$MODE（工程 $PROJ）"

# ------------------------------------------------------------ 1. 发现设备
UDID="$(xcrun devicectl list devices --json-output /tmp/devicectl_list.json >/dev/null 2>&1 \
  && python3 -c "
import json
d = json.load(open('/tmp/devicectl_list.json'))
devs = d.get('result', {}).get('devices', [])
for dev in devs:
    hw = dev.get('hardwareProperties', {}) or {}
    conn = (dev.get('connectionProperties', {}) or {})
    if 'iPhone' in (hw.get('modelCode') or hw.get('productType') or ''):
        print(dev['identifier']); break
for dev in devs:
    print(dev['identifier']); break
" 2>/dev/null | head -1 || true)"

if [[ -z "$UDID" ]]; then
  echo "❌ 没找到连接的 iPhone。请确认：数据线连好、手机已解锁、已点过「信任此电脑」。"
  exit 1
fi

DEV_NAME="$(xcrun devicectl list devices 2>/dev/null | grep "$UDID" | awk '{print $1, $NF}')"
echo "==> 设备：$DEV_NAME ($UDID)"

# -------------------------------------------------------------- 2. 配对
if xcrun devicectl list devices 2>/dev/null | grep "$UDID" | grep -q "unpaired"; then
  echo "==> 首次配对（手机需保持解锁）"
  xcrun devicectl manage pair --device "$UDID" --timeout 60 2>&1 | tail -2
fi

# -------------------------------------------------------------- 3. 编译
APP="$ROOT/$DD/Build/Products/Debug-iphoneos/Yilu.app"

if [[ "$REBUILD" != "reonly" ]]; then
  echo "==> 编译（真机 arm64，自动签名）"
  BUILD_LOG="$(mktemp)"
  if ! xcodebuild -project "$PROJ" -scheme Yilu \
        -sdk iphoneos -destination 'generic/platform=iOS' \
        -derivedDataPath "$DD" -allowProvisioningUpdates build >"$BUILD_LOG" 2>&1; then
    echo "❌ 编译/签名失败："
    grep -E "error:|Signing|Provisioning|requires a development team|No account" "$BUILD_LOG" | head -12 | sed 's/^/   /'
    echo
    echo "   👉 多半是 Xcode 还没登录 Apple ID："
    echo "      Xcode → Settings(⌘,) → Accounts → 左下角 + → 登录 Apple ID"
    echo "      然后回到工程 Signing & Capabilities → Team 选你的 Personal Team"
    rm -f "$BUILD_LOG"
    open "$ROOT/$PROJ" 2>/dev/null
    exit 1
  fi
  rm -f "$BUILD_LOG"
fi

if [[ ! -d "$APP" ]]; then
  echo "❌ 找不到产物：$APP"
  exit 1
fi

BUNDLE_ID="$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$APP/Info.plist" 2>/dev/null || echo com.yilu.nospm)"
echo "==> 产物：$APP"
echo "==> Bundle ID：$BUNDLE_ID"

# -------------------------------------------------------------- 4. 安装
echo "==> 安装到真机"
INSTALL_LOG="$(mktemp)"
if ! xcrun devicectl device install app --device "$UDID" "$APP" >"$INSTALL_LOG" 2>&1; then
  echo "❌ 安装失败："
  sed 's/^/   /' "$INSTALL_LOG" | head -8
  rm -f "$INSTALL_LOG"
  if grep -q "Developer Mode is disabled" "$INSTALL_LOG" 2>/dev/null; then
    cat <<'TIP'

  👉 iPhone 还没开启开发者模式：
     设置 → 隐私与安全性 → 开发者模式 → 打开 → 按提示重启手机
     重启后解锁屏幕，若弹「信任此电脑」点信任，再重跑本脚本。
TIP
  fi
  exit 1
fi
rm -f "$INSTALL_LOG"
echo "✅ 安装成功"

# ------------------------------------------------- 5. 预置模型（仅 asr 模式）
# 在「首次启动」之前把本地模型推进数据容器，App 起来就能直接转写，
# 不用在手机上现下 230MB。设 SKIP_MODELS=1 可跳过。
if [[ "$MODE" == "asr" && "${SKIP_MODELS:-0}" != "1" ]]; then
  if [[ -d "$PROJ_ROOT/asr-poc/models/sense-voice" ]]; then
    echo "==> 预置本地 ASR 模型（免去手机端下载 230MB）"
    DEVICE_UDID="$UDID" BUNDLE_ID="$BUNDLE_ID" \
      bash "$ROOT/scripts/push_models.sh" sense-voice 2>&1 | sed 's/^/    /'
  else
    echo "==> 跳过预置模型：本地没有 asr-poc/models/sense-voice"
    echo "    （需要的话先跑 bash asr-poc/scripts/download_models.sh）"
  fi
fi

# -------------------------------------------------------------- 6. 启动
if xcrun devicectl device process launch --device "$UDID" "$BUNDLE_ID" >/dev/null 2>&1; then
  echo "✅ 医录已在真机启动"
else
  echo "⚠️  安装成功但启动失败，请在手机主屏手动点击「医录」"
fi

echo
echo "提示：免费 Apple ID 签名有效期 7 天，过期后重跑本脚本即可续签。"
