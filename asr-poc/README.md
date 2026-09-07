# 医录 ASR POC 评测工具

> macOS / Linux 上一键评测离线中文语音识别模型选型。基于 [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)。

## 为什么需要这个目录

iOS 端必须**本地推理**（孩子医院场景没信号、隐私合规、响应即时性）。在投入工程实现之前，需要回答一个关键问题：

> **哪个模型在我们的真实问诊音频上字错率足够低、体积能装下、CPU 能跑得动？**

这个目录就是用来回答这个问题的。包含 4 个模型候选的注册表、批量评测脚本、20+ 词条的儿科医疗术语表。

## 当前已覆盖的模型

| 模型 id | 类型 | 体积 | 特点 |
|---|---|---|---|
| `sense-voice` | 非流式 CTC | ~228 MB | 多语种（中日韩英粤），**开启 ITN 让数字保留阿拉伯形态**，综合最优 |
| `paraformer` | 非流式 | ~232 MB | 阿里 DAMO 经典方案，字错率更稳但**数字会转中文**（"9 点"→"九点"） |

> 实测体积在 2026-09 测得；iOS 上不能内置进 App 包（超过 App Store 蜂窝网络下载阈值 200MB），必须**首次启动按需下载**。

## 快速开始

### 0. 环境

```bash
# 推荐 Python 3.10+（已通过 CPython 3.13.12 / macOS arm64 验证）
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

### 1. 准备模型

```bash
bash scripts/download_models.sh              # 下载全部
bash scripts/download_models.sh sense-voice  # 或只下载一个
```

下载源走 HF 镜像（`hf-mirror.com`），国内约 30 秒；官方 huggingface.co 失败时自动回退。

### 2. 准备评测集

`eval_set/manifest.jsonl` 默认是 sherpa-onnx 官方测试 wav，**仅用于连通性冒烟**。要得到有业务参考价值的 CER，请按以下流程：

1. 录制约 20 段真实问诊音频（手机录音即可，每段 30s-2min）
2. 人工转写成文本，作为 `text` 字段
3. 放入 `audio/` 目录
4. 更新 `manifest.jsonl`：

```json
{"audio": "real-001.wav", "text": "孩子是急性扁桃体炎，细菌感染引起的。阿莫西林克拉维酸钾干混悬剂每次一袋，每日两次，饭后服用，要吃满七天。", "scene": "real", "verified": true}
{"audio": "real-002.wav", "text": "宝宝咳嗽有痰，肺里听着还好。先做三天雾化。", "scene": "real", "verified": true}
```

`scene` 字段用于分组统计；`verified: true` 表明这条标注已经过人工复核。

### 3. 跑评测

```bash
# 对比两个模型
python scripts/evaluate.py --models sense-voice paraformer

# 只看一个
python scripts/evaluate.py --models sense-voice

# 启用标点恢复（需要先下载 punct 模型）
python scripts/evaluate.py --models sense-voice --punct

# 调整线程数（移动端 2，i7 8 之类服务器可更多）
python scripts/evaluate.py --models sense-voice --threads 2
```

输出：

```
模型            线程    CER       RTF       加载(s)     内存(MB)      术语召回
------------------------------------------------------------------------------------
sense-voice   2       3.85%     0.018     0.54      856.8       0.0%
paraformer    2       9.48%     0.016     0.45      207.5       0.0%
```

- **CER** 越低越好（中文按字符计算）
- **RTF** < 1.0 表示快于实时，移动端要 < 0.5
- **内存** 含 psutil 进程内存峰值，仅供参考
- **术语召回** 来自 `eval_set/medical_terms.txt`，**比整体 CER 更能反映"能不能用"** —— 药名错一个，医嘱就错

每次跑会同时落盘到 `results/eval-YYYYMMDD-HHMMSS.json`（汇总指标）和 `.csv`（逐条结果），方便后续画趋势图或跨次对比。

### 4. 单文件转写（调试用）

```bash
python scripts/transcribe.py --model sense-voice --audio audio/real-001.wav
python scripts/transcribe.py --model sense-voice --audio audio/real-001.wav --json
```

JSON 模式便于管道调用（脚本里 import 时直接用 `python -c` 同样可行）。

## 评测指标说明

- **CER（Character Error Rate）** 中文按字符级编辑距离计算；已去除标点/空白
- **RTF（Real-Time Factor）** = 转写耗时 / 音频时长；< 1 表示快于实时
- **术语召回** = `medical_terms.txt` 中被正确识别的比例
- **加载耗时** 从冷启动到第一次可用的时间（包含 ORT 初始化）

## 已知问题

- **内存数字偏大**（800+MB）是 Python 进程的整体内存，含 ORT 静态数据，**不代表 iOS 上同样开销**。iOS 静态链接 + ARMv8 上会显著下降
- **示例音频 CER 数字**没有业务参考价值（来自 sherpa 官方测试集，非医疗场景）
- **Punct 模型**默认未下载；如需标点恢复，执行 `bash scripts/download_models.sh punct`
