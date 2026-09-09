#!/usr/bin/env bash
#
# 把本地已下载的 ASR 模型直接推进 iPhone 上 App 的数据容器，
# 免去手机端首次启动时下载 230MB 模型的等待（家里网络可能要十几分钟）。
#
# 用法：
#   bash scripts/push_models.sh                    # 推 SenseVoice（默认）
#   bash scripts/push_models.sh paraformer         # 推 Paraformer
#   bash scripts/push_models.sh all                # 两个都推（约 460MB）
#   bash scripts/push_models.sh sense-voice --dry-run   # 只打印命令不执行
#
# 可选环境变量：
#   DEVICE_UDID=xxxx         指定设备（默认自动发现第一台 iPhone）
#   BUNDLE_ID=com.yilu.asr   指定 App（默认从已构建的 .app 里读真实值）
#
# 原理：
#   ModelManager 从 Application Support/models/<id>-v<version> 读模型，
#   目录里存在 .yilu_ready 标记且每个文件大小与 ASRModels.swift 声明一致时视为就绪。
#   本脚本会先校验本地文件大小，再整理成该目录结构整体推过去。
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJ_ROOT="$(cd "$ROOT/.." && pwd)"
cd "$ROOT"

TARGET="${1:-sense-voice}"
DRY_RUN=0
for arg in "$@"; do
  [[ "$arg" == "--dry-run" ]] && DRY_RUN=1
done

MODELS_DIR="$PROJ_ROOT/asr-poc/models"
CATALOG="$ROOT/Yilu/ASR/ASRModels.swift"

# ---------------------------------------------------------- 1. 解析模型规格
# 从 Swift 源码读 id / version / 每个文件的声明大小，保证与 App 端永远一致
SPECS="$(python3 - "$CATALOG" <<'PY'
import re, sys
src = open(sys.argv[1], encoding='utf-8').read()
out = []
for m in re.finditer(r'static let (\w+) = ModelSpec\((.*?)\n    \)', src, re.S):
    name, body = m.group(1), m.group(2)
    mid = re.search(r'id:\s*"([^"]+)"', body)
    ver = re.search(r'version:\s*(\d+)', body)
    if not mid:
        continue
    files = []
    for fm in re.finditer(r'ModelFile\((.*?)\n            \)', body, re.S):
        fb = fm.group(1)
        rp = re.search(r'relativePath:\s*"([^"]+)"', fb)
        sz = re.search(r'size:\s*([\d_]+)', fb)
        if rp:
            files.append("%s:%s" % (rp.group(1), sz.group(1).replace('_', '') if sz else '0'))
    out.append("%s|%s|%s|%s" % (name, mid.group(1), ver.group(1) if ver else 1, ",".join(files)))
print("\n".join(out))
PY
)"

if [[ -z "$SPECS" ]]; then
  echo "❌ 无法从 Yilu/ASR/ASRModels.swift 解析模型规格"
  exit 1
fi

# 本地目录名 -> Swift 里的常量名
case "$TARGET" in
  sense-voice|sensevoice|sv) WANT=(senseVoice:sense-voice) ;;
  paraformer|pf)             WANT=(paraformer:paraformer) ;;
  all)                       WANT=(senseVoice:sense-voice paraformer:paraformer) ;;
  *)
    echo "用法: bash scripts/push_models.sh [sense-voice|paraformer|all] [--dry-run]"
    exit 1 ;;
esac

declare -a JOBS=()
for pair in "${WANT[@]}"; do
  swift_name="${pair%%:*}"
  local_dir="${pair##*:}"
  line="$(echo "$SPECS" | awk -F'|' -v n="$swift_name" '$1==n {print; exit}')"
  if [[ -z "$line" ]]; then
    echo "❌ ASRModels.swift 里没有 $swift_name 规格"
    exit 1
  fi
  # line 格式：swift常量名|specId|version|文件定义，去掉常量名后拼上本地目录名
  JOBS+=("$local_dir|${line#*|}")
done

# ---------------------------------------------------------- 2. 发现设备
UDID="${DEVICE_UDID:-}"
if [[ -z "$UDID" ]]; then
  UDID="$(xcrun devicectl list devices --json-output /tmp/devicectl_list.json >/dev/null 2>&1 \
    && python3 -c "
import json
d = json.load(open('/tmp/devicectl_list.json'))
for dev in d.get('result', {}).get('devices', []):
    hw = dev.get('hardwareProperties', {}) or {}
    if 'iPhone' in (hw.get('modelCode') or hw.get('productType') or ''):
        print(dev['identifier']); break
" 2>/dev/null | head -1 || true)"
fi

if [[ -z "$UDID" ]]; then
  echo "❌ 没找到 iPhone。请确认数据线已连、手机已解锁并信任此电脑。"
  echo "   也可用 DEVICE_UDID=xxxx bash scripts/push_models.sh 指定。"
  exit 1
fi

# ---------------------------------------------------------- 3. 推断 Bundle ID
if [[ -z "${BUNDLE_ID:-}" ]]; then
  for dd in build-device-asr build-device build-device-spm; do
    APP="$ROOT/$dd/Build/Products/Debug-iphoneos/Yilu.app"
    if [[ -d "$APP" ]]; then
      BUNDLE_ID="$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$APP/Info.plist" 2>/dev/null || true)"
      break
    fi
  done
fi
BUNDLE_ID="${BUNDLE_ID:-com.yilu.asr}"

echo "==> 设备    : $UDID"
echo "==> App     : $BUNDLE_ID"
echo "==> 目标容器 : Library/Application Support/models"
echo

# ---------------------------------------------------------- 4. 校验 + 整理 + 推送
TMPROOT="$(mktemp -d)"
trap 'rm -rf "$TMPROOT"' EXIT
EXIT_CODE=0

for job in "${JOBS[@]}"; do
  IFS='|' read -r local_dir spec_id version files <<<"$job"
  remote_dir="$spec_id-v$version"
  SRC="$MODELS_DIR/$local_dir"

  if [[ ! -d "$SRC" ]]; then
    echo "⚠️  跳过 $remote_dir：本地没有 $SRC"
    echo "    先跑 bash asr-poc/scripts/download_models.sh 下载"
    EXIT_CODE=1
    continue
  fi

  STAGE="$TMPROOT/$remote_dir"
  mkdir -p "$STAGE"

  # 4a. 逐个文件校验大小（App 端也按声明大小判定是否就绪，不一致会白推）
  SIZE_MISMATCH=0
  IFS=',' read -ra FILE_DEFS <<<"$files"
  for def in "${FILE_DEFS[@]}"; do
    fname="${def%%:*}"
    fsize="${def##*:}"
    fsrc="$SRC/$fname"
    if [[ ! -f "$fsrc" ]]; then
      echo "❌ $remote_dir/$fname 本地缺失"
      SIZE_MISMATCH=1
      continue
    fi
    cp "$fsrc" "$STAGE/$fname"
    if [[ "$fsize" != "0" ]]; then
      actual="$(stat -f%z "$fsrc" 2>/dev/null || echo 0)"
      if [[ "$actual" != "$fsize" ]]; then
        echo "❌ $remote_dir/$fname 大小不符：本地 $actual ≠ 代码声明 $fsize"
        echo "   模型更新过的话，请同步改 Yilu/ASR/ASRModels.swift 里的 size，否则 App 会判定未就绪"
        SIZE_MISMATCH=1
      fi
    fi
  done
  if [[ $SIZE_MISMATCH -eq 1 ]]; then
    EXIT_CODE=1
    continue
  fi

  # 4b. 就绪标记：内容写版本号，与 ModelManager.ensure 的行为一致
  printf '%s' "$version" > "$STAGE/.yilu_ready"

  # 4c. 收集待推文件（含标记文件）
  #     必须逐文件推送 + 写全目标目录：实测直接推目录会把内容平铺到 destination，
  #     不会保留 sense-voice-zh-v1 这层目录名，App 端就找不到了。
  SOURCES=("$STAGE/.yilu_ready")
  for def in "${FILE_DEFS[@]}"; do
    SOURCES+=("$STAGE/${def%%:*}")
  done

  SIZE="$(du -sh "$STAGE" 2>/dev/null | awk '{print $1}')"
  echo "==> 推送 $remote_dir（$SIZE，${#SOURCES[@]} 个文件）"

  # 目标路径含空格，两种写法都试：先原样，再 URL 编码
  DESTS=("Library/Application Support/models/$remote_dir" "Library/Application%20Support/models/$remote_dir")
  OK=0
  for dest in "${DESTS[@]}"; do
    CMD=(xcrun devicectl device copy to --device "$UDID")
    for s in "${SOURCES[@]}"; do
      CMD+=(--source "$s")
    done
    CMD+=(--domain-type appDataContainer
          --domain-identifier "$BUNDLE_ID"
          --destination "$dest"
          --timeout 900)
    if [[ $DRY_RUN -eq 1 ]]; then
      printf '    [dry-run] '; printf '%q ' "${CMD[@]}"; echo
      OK=1
      break
    fi

    if "${CMD[@]}" >/tmp/push_models.log 2>&1; then
      echo "    ✅ 完成"
      OK=1
      break
    fi

    # 容器不存在 = App 没装，再试别的写法也没意义
    if grep -q "ContainerLookupError" /tmp/push_models.log 2>/dev/null; then
      echo "    ❌ 找不到 App 数据容器（$BUNDLE_ID）"
      echo "       App 还没装到手机上 —— 先跑 bash scripts/device_run.sh"
      echo "       若已装但 Bundle ID 不同，用 BUNDLE_ID=com.xxx bash scripts/push_models.sh 覆盖"
      EXIT_CODE=1
      OK=2
      break
    fi

    # 某些系统版本要求显式指定 mobile 用户
    if "${CMD[@]}" --user mobile >/tmp/push_models.log 2>&1; then
      echo "    ✅ 完成（--user mobile）"
      OK=1
      break
    fi
  done

  if [[ $OK -eq 0 ]]; then
    echo "    ❌ 推送失败："
    sed 's/^/       /' /tmp/push_models.log | head -8
    EXIT_CODE=1
  fi
done

echo
if [[ $EXIT_CODE -eq 0 ]]; then
  echo "✅ 完成。现在打开 App 录音，应直接进入转写，不再下载模型。"
else
  echo "⚠️  有模型未推送成功，请看上面提示。"
fi
exit $EXIT_CODE
