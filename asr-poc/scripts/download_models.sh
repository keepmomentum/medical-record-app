#!/usr/bin/env bash
# 下载离线 ASR 模型（用于 POC 评测）
#
# 用法:
#   bash scripts/download_models.sh              # 下载全部
#   bash scripts/download_models.sh sense-voice  # 只下载指定模型
#
# 说明:
#   - 默认走 HF 镜像(hf-mirror.com)，国内速度快；可通过 MIRROR 环境变量切换
#   - 模型较大，首次下载约需数分钟
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODELS_DIR="$ROOT/models"
MIRROR="${MIRROR:-https://hf-mirror.com}"
mkdir -p "$MODELS_DIR"

# repo 与文件清单
SENSE_VOICE_REPO="csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17"
SENSE_VOICE_FILES=("model.int8.onnx" "tokens.txt")
PARAFORMER_REPO="csukuangfj/sherpa-onnx-paraformer-zh-2023-09-14"
PARAFORMER_FILES=("model.int8.onnx" "tokens.txt")
PUNCT_REPO="csukuangfj/sherpa-onnx-punct-ct-transformer-zh-en-vocab272727-2024-04-12"
PUNCT_FILES=("model.onnx" "tokens.txt")

fetch() {
  local repo="$1" file="$2" dest="$3"
  if [[ -f "$dest" ]]; then
    echo "  [skip] $(basename "$dest") 已存在"
    return 0
  fi
  echo "  [get ] $file"
  mkdir -p "$(dirname "$dest")"
  if ! curl -fL --max-time 1800 -o "$dest" "$MIRROR/$repo/resolve/main/$file"; then
    echo "  [warn] 镜像下载失败，回退官方源 huggingface.co"
    curl -fL --max-time 1800 -o "$dest" "https://huggingface.co/$repo/resolve/main/$file"
  fi
}

download_group() {
  local name="$1" repo="$2" dir="$3"; shift 3
  echo "=== $name ==="
  mkdir -p "$MODELS_DIR/$dir"
  for f in "$@"; do
    fetch "$repo" "$f" "$MODELS_DIR/$dir/$f"
  done
}

TARGET="${1:-all}"
case "$TARGET" in
  sense-voice) download_group "SenseVoice-Small" "$SENSE_VOICE_REPO" sense-voice "${SENSE_VOICE_FILES[@]}" ;;
  paraformer)  download_group "Paraformer-zh"    "$PARAFORMER_REPO"  paraformer  "${PARAFORMER_FILES[@]}" ;;
  punct)       download_group "Punct-CT"         "$PUNCT_REPO"       punct-ct-transformer-zh "${PUNCT_FILES[@]}" ;;
  all)
    download_group "SenseVoice-Small" "$SENSE_VOICE_REPO" sense-voice "${SENSE_VOICE_FILES[@]}"
    download_group "Paraformer-zh"    "$PARAFORMER_REPO"  paraformer  "${PARAFORMER_FILES[@]}"
    download_group "Punct-CT"         "$PUNCT_REPO"       punct-ct-transformer-zh "${PUNCT_FILES[@]}"
    ;;
  *) echo "未知模型: $TARGET（可选: sense-voice / paraformer / punct / all）" >&2; exit 1 ;;
esac

echo
echo "完成。模型目录: $MODELS_DIR"
du -sh "$MODELS_DIR"/* 2>/dev/null || true
