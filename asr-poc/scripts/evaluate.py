#!/bin/env python3
"""
医录 · 医疗问诊场景 ASR 批量评测工具

用途：在同一份评测集上横向对比多个离线 ASR 模型，输出
      - CER（字错率，中文按字符计算）
      - RTF（实时率 = 处理耗时 / 音频时长，越小越快；<1 表示快于实时）
      - 峰值内存增量
      - 医疗术语命中率（可选，需提供术语表）

用法：
    python evaluate.py --manifest eval_set/manifest.jsonl --models sense-voice paraformer
    python evaluate.py --manifest eval_set/manifest.jsonl --models sense-voice --threads 4
    python evaluate.py --manifest eval_set/manifest.jsonl --models sense-voice --punct
    python evaluate.py --manifest eval_set/manifest.jsonl --models sense-voice --medical-terms eval_set/medical_terms.txt
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import wave
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Sequence

try:
    import sherpa_onnx
except ImportError:  # pragma: no cover
    sys.exit("缺少依赖，请先执行: pip install -r requirements.txt")

try:
    import psutil  # 可选，用于内存统计
except ImportError:  # pragma: no cover
    psutil = None


ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = ROOT / "models"

# ---------------------------------------------------------------- 模型注册表
# 新增模型只需在此登记：下载脚本会自动拉取，评测会自动覆盖。
MODEL_REGISTRY: Dict[str, dict] = {
    "sense-voice": {
        "type": "sense_voice",
        "dir": "sense-voice",
        "model": "model.int8.onnx",
        "tokens": "tokens.txt",
        "desc": "SenseVoice-Small int8（中文/粤语/英日韩，非流式）",
        "size_mb": 230,
    },
    "paraformer": {
        "type": "paraformer",
        "dir": "paraformer",
        "model": "model.int8.onnx",
        "tokens": "tokens.txt",
        "desc": "Paraformer 中文 int8（阿里 DAMO 开源）",
        "size_mb": 230,
    },
}


# ---------------------------------------------------------------- 工具函数
def read_wav(path: str) -> tuple:
    """读取 16kHz 单声道 16bit PCM wav，返回 (samples_float, sample_rate)。"""
    with wave.open(path, "rb") as f:
        if f.getsampwidth() != 2:
            raise ValueError(f"{path}: 仅支持 16bit PCM，请先转为 16k/16bit/mono")
        sample_rate = f.getframerate()
        n = f.getnframes()
        raw = f.readframes(n)
    import array

    samples = array.array("h")
    samples.frombytes(raw)
    if sys.byteorder == "big":  # pragma: no cover
        samples.byteswap()
    return [s / 32768.0 for s in samples], sample_rate


def normalize_text(text: str) -> str:
    """文本归一：去空白、全角转半角、统一标点，避免格式差异干扰 CER。"""
    text = text.strip()
    # 全角 -> 半角
    out = []
    for ch in text:
        code = ord(ch)
        if code == 0x3000:
            out.append(" ")
        elif 0xFF01 <= code <= 0xFF5E:
            out.append(chr(code - 0xFEE0))
        else:
            out.append(ch)
    text = "".join(out)
    # 去除所有空白与标点（中文 ASR 评测惯例：只比字）
    text = re.sub(r"[\s]+", "", text)
    text = re.sub(
        r"[，。、；：？！“”‘’（）《》【】,.!?;:'\"()\[\]{}~\-—…·]", "", text
    )
    return text


def levenshtein(ref: Sequence, hyp: Sequence) -> int:
    """编辑距离（中文按字符）。使用滚动数组，内存 O(n)。"""
    if ref == hyp:
        return 0
    if not ref:
        return len(hyp)
    if not hyp:
        return len(ref)
    prev = list(range(len(hyp) + 1))
    for i, r in enumerate(ref, start=1):
        cur = [i]
        for j, h in enumerate(hyp, start=1):
            cur.append(
                min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (r != h))
            )
        prev = cur
    return prev[-1]


def cer(ref: str, hyp: str) -> float:
    ref_n, hyp_n = normalize_text(ref), normalize_text(hyp)
    if not ref_n:
        return 0.0 if not hyp_n else 1.0
    return levenshtein(list(ref_n), list(hyp_n)) / len(ref_n)


def term_hit_rate(hyps: List[str], terms: List[str]) -> float:
    """医疗术语召回率：术语表里被正确识别出的比例。"""
    if not terms:
        return float("nan")
    joined = "".join(normalize_text(h) for h in hyps)
    hit = sum(1 for t in terms if normalize_text(t) in joined)
    return hit / len(terms)


# ---------------------------------------------------------------- 识别器构建
def build_recognizer(name: str, threads: int, provider: str, punct: bool):
    cfg = MODEL_REGISTRY[name]
    mdir = MODELS_DIR / cfg["dir"]
    model_path = mdir / cfg["model"]
    tokens_path = mdir / cfg["tokens"]
    if not model_path.exists():
        raise FileNotFoundError(
            f"模型缺失: {model_path}\n请先执行: bash scripts/download_models.sh {name}"
        )

    if cfg["type"] == "sense_voice":
        recognizer = sherpa_onnx.OfflineRecognizer.from_sense_voice(
            model=str(model_path),
            tokens=str(tokens_path),
            num_threads=threads,
            use_itn=True,  # 数字/日期逆文本归一化，医嘱里"一次5毫升"很重要
            language="zh",
            provider=provider,
            debug=False,
        )
    elif cfg["type"] == "paraformer":
        recognizer = sherpa_onnx.OfflineRecognizer.from_paraformer(
            paraformer=str(model_path),
            tokens=str(tokens_path),
            num_threads=threads,
            provider=provider,
            debug=False,
        )
    else:  # pragma: no cover
        raise ValueError(f"未知模型类型: {cfg['type']}")

    punctuation = None
    if punct:
        # 标点恢复模型（可选）：sherpa-onnx 的 CT Transformer 中文标点模型
        punct_dir = MODELS_DIR / "punct-ct-transformer-zh"
        punct_model = punct_dir / "model.onnx"
        if punct_model.exists():
            punctuation = sherpa_onnx.OfflinePunctuation.from_transducer(
                model=str(punct_model),
                tokens=str(punct_dir / "tokens.txt"),
                num_threads=threads,
                provider=provider,
            )
        else:
            print("  [warn] 未找到标点模型，跳过标点恢复", file=sys.stderr)

    return recognizer, punctuation


# ---------------------------------------------------------------- 评测主流程
@dataclass
class ItemResult:
    audio: str
    duration: float
    ref: str
    hyp: str
    cer: float
    elapsed: float
    rtf: float


@dataclass
class ModelResult:
    model: str
    threads: int
    items: List[ItemResult] = field(default_factory=list)
    load_time: float = 0.0
    mem_delta_mb: float = float("nan")

    @property
    def avg_cer(self) -> float:
        return sum(i.cer for i in self.items) / max(len(self.items), 1)

    @property
    def avg_rtf(self) -> float:
        return sum(i.rtf for i in self.items) / max(len(self.items), 1)

    @property
    def total_audio(self) -> float:
        return sum(i.duration for i in self.items)

    @property
    def total_elapsed(self) -> float:
        return sum(i.elapsed for i in self.items)


def load_manifest(path: Path) -> List[dict]:
    items = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("//"):
                continue
            items.append(json.loads(line))
    return items


def current_rss_mb() -> float:
    if psutil is None:
        return float("nan")
    return psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024


def run_model(
    model_name: str,
    items: List[dict],
    audio_dir: Path,
    threads: int,
    provider: str,
    punct: bool,
    medical_terms: List[str],
) -> ModelResult:
    print(f"\n=== 模型: {model_name} ({MODEL_REGISTRY[model_name]['desc']}) ===")
    t0 = time.time()
    mem_before = current_rss_mb()
    recognizer, punctuation = build_recognizer(model_name, threads, provider, punct)
    load_time = time.time() - t0

    result = ModelResult(model=model_name, threads=threads, load_time=load_time)

    for idx, item in enumerate(items, start=1):
        audio_path = audio_dir / item["audio"]
        if not audio_path.exists():
            print(f"  [skip] 音频缺失: {audio_path}", file=sys.stderr)
            continue
        samples, sample_rate = read_wav(str(audio_path))
        duration = len(samples) / sample_rate

        t0 = time.time()
        stream = recognizer.create_stream()
        stream.accept_waveform(sample_rate, samples)
        recognizer.decode_stream(stream)
        text = stream.result.text.strip()
        if punctuation is not None and text:
            text = punctuation.add_punctuation(text)
        elapsed = time.time() - t0

        item_cer = cer(item["text"], text)
        result.items.append(
            ItemResult(
                audio=item["audio"],
                duration=duration,
                ref=item["text"],
                hyp=text,
                cer=item_cer,
                elapsed=elapsed,
                rtf=elapsed / duration if duration > 0 else float("nan"),
            )
        )
        flag = "OK " if item_cer < 0.15 else ("~~ " if item_cer < 0.35 else "!! ")
        print(
            f"  [{idx:02d}] {flag}CER={item_cer*100:5.1f}%  RTF={elapsed/duration:.3f}  "
            f"{duration:5.2f}s  {item['audio']}"
        )

    mem_after = current_rss_mb()
    result.mem_delta_mb = mem_after - mem_before
    result.term_recall = term_hit_rate([i.hyp for i in result.items], medical_terms)
    return result


def main() -> int:
    ap = argparse.ArgumentParser(description="医录 ASR 离线模型评测")
    ap.add_argument(
        "--manifest",
        type=Path,
        default=ROOT / "eval_set" / "manifest.jsonl",
        help="评测集清单（jsonl，每行 {audio, text}）",
    )
    ap.add_argument(
        "--audio-dir", type=Path, default=ROOT / "audio", help="音频目录"
    )
    ap.add_argument(
        "--models",
        nargs="+",
        default=["sense-voice"],
        choices=list(MODEL_REGISTRY),
        help="要评测的模型",
    )
    ap.add_argument("--threads", type=int, default=2, help="推理线程数（移动端建议 2-4）")
    ap.add_argument("--provider", default="cpu", help="推理后端，Mac 可用 coreml")
    ap.add_argument("--punct", action="store_true", help="启用标点恢复")
    ap.add_argument(
        "--medical-terms",
        type=Path,
        default=ROOT / "eval_set" / "medical_terms.txt",
        help="医疗术语表，用于计算术语召回率",
    )
    ap.add_argument(
        "--out", type=Path, default=ROOT / "results", help="结果输出目录"
    )
    ap.add_argument("--dump-hyp", action="store_true", help="导出每条识别结果")
    args = ap.parse_args()

    if not args.manifest.exists():
        sys.exit(f"评测集不存在: {args.manifest}\n请先按 eval_set/README.md 准备音频与标注")

    items = load_manifest(args.manifest)
    print(f"评测集: {len(items)} 条  ({args.manifest})")

    terms: List[str] = []
    if args.medical_terms.exists():
        terms = [
            l.strip()
            for l in args.medical_terms.read_text(encoding="utf-8").splitlines()
            if l.strip() and not l.startswith("#")
        ]
        print(f"医疗术语: {len(terms)} 条")

    results = []
    for name in args.models:
        try:
            results.append(
                run_model(
                    name, items, args.audio_dir, args.threads,
                    args.provider, args.punct, terms,
                )
            )
        except FileNotFoundError as e:
            print(f"  [skip] {e}", file=sys.stderr)

    if not results:
        sys.exit("没有可评测的模型")

    # -------- 汇总表 --------
    print("\n" + "=" * 84)
    print(f"{'模型':<14}{'线程':<6}{'CER':<10}{'RTF':<10}{'加载(s)':<10}{'内存(MB)':<12}{'术语召回':<10}")
    print("-" * 84)
    for r in results:
        tr = getattr(r, "term_recall", float("nan"))
        print(
            f"{r.model:<14}{r.threads:<6}"
            f"{r.avg_cer*100:>6.2f}%   "
            f"{r.avg_rtf:>7.3f}  "
            f"{r.load_time:>7.2f}  "
            f"{r.mem_delta_mb:>9.1f}  "
            f"{(tr*100 if tr==tr else 0):>7.1f}%"
        )
    print("=" * 84)
    print("CER 越低越好；RTF < 1.0 表示快于实时（手机上不卡顿）")

    # -------- 落盘 --------
    args.out.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    summary = {
        "timestamp": stamp,
        "manifest": str(args.manifest),
        "threads": args.threads,
        "provider": args.provider,
        "models": [
            {
                "model": r.model,
                "threads": r.threads,
                "avg_cer": round(r.avg_cer, 4),
                "avg_rtf": round(r.avg_rtf, 4),
                "load_time_s": round(r.load_time, 2),
                "mem_delta_mb": None if r.mem_delta_mb != r.mem_delta_mb else round(r.mem_delta_mb, 1),
                "term_recall": None
                if getattr(r, "term_recall", float("nan")) != getattr(r, "term_recall", float("nan"))
                else round(getattr(r, "term_recall", 0), 4),
                "total_audio_s": round(r.total_audio, 2),
                "total_elapsed_s": round(r.total_elapsed, 2),
            }
            for r in results
        ],
    }
    out_json = args.out / f"eval-{stamp}.json"
    out_json.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    out_csv = args.out / f"eval-{stamp}.csv"
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["model", "audio", "duration_s", "cer", "rtf", "elapsed_s", "ref", "hyp"])
        for r in results:
            for i in r.items:
                w.writerow([
                    r.model, i.audio, round(i.duration, 2),
                    round(i.cer, 4), round(i.rtf, 4), round(i.elapsed, 3),
                    i.ref, i.hyp,
                ])
    print(f"\n结果已保存:\n  {out_json}\n  {out_csv}")

    # -------- 差样本快速定位 --------
    worst = sorted(
        ((i, r.model) for r in results for i in r.items),
        key=lambda x: -x[0].cer,
    )[:5]
    if worst:
        print("\n最差 5 条（优先分析这些，通常暴露系统性错误）:")
        for i, m in worst:
            print(f"  [{m}] CER={i.cer*100:.0f}% {i.audio}")
            print(f"      标注: {i.ref}")
            print(f"      识别: {i.hyp}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
