#!/bin/env python3
"""
单文件离线转写（调试 / 快速验证用）

用法:
    python transcribe.py --model sense-voice --audio audio/demo.wav
    python transcribe.py --model paraformer  --audio audio/demo.wav --threads 4
    python transcribe.py --model sense-voice --audio audio/demo.wav --punct --json
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from evaluate import (  # noqa: E402
    MODEL_REGISTRY,
    build_recognizer,
    read_wav,
)

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    ap = argparse.ArgumentParser(description="sherpa-onnx 单文件离线转写")
    ap.add_argument("--model", default="sense-voice", choices=list(MODEL_REGISTRY))
    ap.add_argument("--audio", required=True, help="wav 路径（16k/16bit/mono 最佳）")
    ap.add_argument("--threads", type=int, default=2)
    ap.add_argument("--provider", default="cpu")
    ap.add_argument("--punct", action="store_true", help="标点恢复")
    ap.add_argument("--json", action="store_true", help="以 JSON 输出，便于管道调用")
    args = ap.parse_args()

    audio_path = Path(args.audio)
    if not audio_path.is_absolute():
        audio_path = ROOT / audio_path
    if not audio_path.exists():
        sys.exit(f"音频不存在: {audio_path}")

    samples, sample_rate = read_wav(str(audio_path))
    duration = len(samples) / sample_rate

    t0 = time.time()
    recognizer, punctuation = build_recognizer(
        args.model, args.threads, args.provider, args.punct
    )
    load_time = time.time() - t0

    t0 = time.time()
    stream = recognizer.create_stream()
    stream.accept_waveform(sample_rate, samples)
    recognizer.decode_stream(stream)
    text = stream.result.text.strip()
    if punctuation is not None and text:
        text = punctuation.add_punctuation(text)
    elapsed = time.time() - t0

    if args.json:
        print(json.dumps({
            "model": args.model,
            "audio": str(audio_path),
            "duration_s": round(duration, 2),
            "rtf": round(elapsed / duration, 4),
            "load_time_s": round(load_time, 2),
            "text": text,
        }, ensure_ascii=False, indent=2))
    else:
        print(f"模型: {args.model}   加载 {load_time:.2f}s   音频 {duration:.2f}s")
        print(f"耗时: {elapsed:.2f}s   RTF: {elapsed/duration:.3f}")
        print("-" * 60)
        print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
