#!/usr/bin/env bash
#
# 拉取 sherpa-onnx iOS 预编译依赖（本地 xcframework 方案，绕开 SwiftPM）
#
# 背景：本机沙箱环境下 SwiftPM 无法解析远程包（sandbox_apply: Operation not permitted），
#       且 GitHub 网页下载通道常被代理拦截（CONNECT tunnel failed 502）。
#       本脚本改用 GitHub **API 通道**下载 release 资产，稳定可用。
#
# 用法：
#   bash scripts/fetch_vendor.sh
#
# 产物：
#   Vendor/sherpa-onnx-ios-static.xcframework/
#   Vendor/onnxruntime-ios-static.xcframework/
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
mkdir -p Vendor
cd Vendor

API="https://api.github.com/repos"

# asset: <repo> <asset文件名> <输出zip名>
fetch() {
  local repo="$1" asset_name="$2" out="$3"
  local tag="$4"

  if [[ -d "${out%.zip}" ]]; then
    echo "==> 已存在 ${out%.zip}，跳过（删除该目录可强制重下）"
    return 0
  fi

  echo "==> 查询 $asset_name"
  local info
  info="$(curl -s --max-time 30 "$API/$repo/releases/tags/$tag" | python3 -c "
import sys, json
name = '''$asset_name'''
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(1)
for a in d.get('assets', []):
    if a['name'] == name:
        print(a['id'], a['size']); break
")"
  if [[ -z "$info" ]]; then
    echo "❌ 找不到资产 $asset_name"
    return 1
  fi

  local id size
  id="$(echo "$info" | awk '{print $1}')"
  size="$(echo "$info" | awk '{print $2}')"
  echo "    asset=$id  大小=$((size/1048576))MB"

  for try in 1 2 3; do
    # 通道优先级：gh-proxy 镜像（5-7MB/s）→ 直连 → GitHub API（约 20KB/s，兜底）
    for base in "https://gh-proxy.com/https://github.com/$repo/releases/download/$tag/$asset_name" \
                "https://github.com/$repo/releases/download/$tag/$asset_name" \
                "$API/$repo/releases/assets/$id"; do
      echo "    尝试：${base:0:52}..."
      if [[ "$base" == *api.github.com* ]]; then
        curl -sL --max-time 2400 -H "Accept: application/octet-stream" -o "$out" "$base"
      else
        curl -sL --max-time 900 -o "$out" "$base"
      fi
      local sz
      sz="$(stat -f%z "$out" 2>/dev/null || echo 0)"
      if [[ "$sz" == "$size" ]]; then
        echo "    ✅ 下载完成（$((size/1048576))MB）"
        break 2
      fi
      echo "    ⟳ 不完整：${sz}/${size}"
    done
  done

  local sz
  sz="$(stat -f%z "$out" 2>/dev/null || echo 0)"
  if [[ "$sz" != "$size" ]]; then
    echo "❌ $out 下载失败（${sz}/${size}）"
    return 1
  fi

  echo "    解压..."
  unzip -q -o "$out"
  rm -f "$out"
  echo "    ✅ 解压完成"
}

fetch "k2-fsa/sherpa-onnx" \
  "sherpa-onnx-v1.13.7-ios-static.xcframework.zip" \
  "sherpa-onnx-ios-static.xcframework.zip" "xcframework"

fetch "csukuangfj/onnxruntime-libs" \
  "onnxruntime-ios-static-xcframework-1.28.1.xcframework.zip" \
  "onnxruntime-ios-static.xcframework.zip" "v1.28.1"

echo
echo "Vendor 目录："
ls -d */ 2>/dev/null

# ---------------------------------------------------------------------------
# Swift 封装层（官方 Apache-2.0 代码，已随仓库提交；缺失时自动补回）
# ---------------------------------------------------------------------------
WRAPPER_DIR="../Yilu/SherpaOnnx"
if [[ ! -f "$WRAPPER_DIR/SherpaOnnx.swift" ]]; then
  echo
  echo "==> Swift 封装缺失，尝试从官方仓库补回"
  mkdir -p "$WRAPPER_DIR"
  for ref in v1.13.7 master; do
    for prefix in "https://gh-proxy.com/" ""; do
      URL="${prefix}https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/$ref/swift-api-examples/SherpaOnnx.swift"
      if curl -sL --max-time 60 -o "$WRAPPER_DIR/SherpaOnnx.swift" "$URL" \
         && grep -q "SherpaOnnxOfflineRecognizer" "$WRAPPER_DIR/SherpaOnnx.swift"; then
        echo "    ✅ 已获取（$ref）"
        break 2
      fi
    done
  done
  if [[ ! -f "$WRAPPER_DIR/SherpaOnnx.swift" ]]; then
    echo "    ❌ 获取失败，请手动从 sherpa-onnx 仓库复制 swift-api-examples/ 下的两个文件"
  fi
fi
