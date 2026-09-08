# 医录 iOS 端技术方案规划

> 目标：以 **iOS 为首发端** 打造原生 App；录音识别替换为 **Sherpa-ONNX 本地离线 ASR**；架构预留 **可私有化部署的移动端 OCR** 接入位。
> 版本：v1.1 ｜ 日期：2026-09-07（v1.0 创建于 2026-09-07 同日）

---

## 0. 一句话结论

采用 **「Swift 原生壳 + 统一 ONNX Runtime 推理底座 + WebView 复用现有 UI」** 的混合架构。

语音识别用 Sherpa-ONNX 做**全本地离线**转写，未来 OCR 直接复用同一套 ONNX Runtime 底座接入 PP-OCR ONNX 模型（RapidOCR 路线），**不再引入 Paddle-Lite**，避免双引擎带来的体积与维护成本翻倍。

---

## 1. 现状盘点与约束

### 1.1 现有资产

| 资产 | 现状 | 可复用性 |
|---|---|---|
| `index.html` + `css/` + `js/` | 约 6500 行纯前端 SPA（无框架） | **高**，UI 层可直接放进 WKWebView |
| `store.js` | localStorage 持久化 | **低**，需改造（见 1.2） |
| `recorder.js` | MediaRecorder 录音 | 中，iOS 需替换为 AVAudioEngine 原生实现 |
| `ai-processor.js` | **场景模拟模块**（预置场景库 + 5 步动画），无真实 ASR/LLM 调用 | 低，仅保留"处理中"的交互流程 |
| 9 大分类数据模型 | 病因/症状/用药/护理/饮食/注意事项/观察症状/预防/复诊 | **高**，数据结构可直接沿用 |

**关键发现**：`ai-processor.js` 目前是模拟实现，接入 Sherpa-ONNX 是本项目**第一次落地真实 AI 能力**，不是"替换"，而是"首次实现"。

### 1.2 必须改造的点

1. **存储层必须原生化**
   WKWebView 的 localStorage 在 iOS 上**不可靠**（系统可能在磁盘紧张时清理 WebKit 数据目录）。病历数据属于高价值不可丢失数据，必须迁移到原生存储（SQLite / 文件 + Core Data）。Web 层通过 JSBridge 读写。

2. **录音必须原生化**
   WKWebView 的 MediaRecorder 在 iOS 上兼容性差、无法与本地模型高效协同。改用 `AVAudioEngine` 采集 16kHz 单声道 PCM，直接送本地 ASR，避免文件落地与格式转换。

3. **结构化层缺失**
   转写文本 → 9 大分类的结构化抽取，目前无实现，需新设计（见第 4 节）。

### 1.3 硬约束

- **隐私**：医疗数据（儿童病历）敏感度极高，本地处理是核心卖点，也是合规优势
- **离线**：医院环境网络差，核心链路（录音→转写→归档）必须无网可用
- **包体积**：App Store 蜂窝网络下载限制 200MB → **模型必须按需下载，不打包进 IPA**
- **性能**：3-5 分钟问诊音频，转写耗时应控制在可接受范围（目标 < 60s）

---

## 2. 目标架构

### 2.1 分层设计

```
┌─────────────────────────────────────────────┐
│  展示层  UI Layer                            │
│  现有 Web UI（WKWebView）  →  逐步原生化      │
│  首页 / 日历 / 提醒 / 我的 / 详情页           │
└──────────────────┬──────────────────────────┘
                   │ JSBridge（双向）
┌──────────────────┴──────────────────────────┐
│  能力层  Native Capability Layer（Swift）     │
│  ┌─────────┐ ┌─────────┐ ┌───────────────┐  │
│  │ 录音    │ │ 存储    │ │ 推理服务       │  │
│  │ AudioEngine│ SQLite │ │ InferenceService│  │
│  └─────────┘ └─────────┘ └───────┬───────┘  │
└──────────────────────────────────┼──────────┘
                                   │
┌──────────────────────────────────┴──────────┐
│  推理底座  Unified ONNX Runtime Layer         │
│  ┌────────────────┐  ┌────────────────────┐ │
│  │ sherpa-onnx    │  │ RapidOCR（未来）    │ │
│  │ ASR / VAD      │  │ det + cls + rec     │ │
│  └────────────────┘  └────────────────────┘ │
│  共用：ORT Session 池 / 模型管理器 / 线程策略  │
└─────────────────────────────────────────────┘
```

### 2.2 为什么"统一 ONNX Runtime"是适配性的关键

这是本方案最重要的架构决策：

| 方案 | 引擎数量 | 体积代价 | 维护代价 |
|---|---|---|---|
| sherpa-onnx + Paddle-Lite | 2 套 | ORT + Paddle-Lite 双份 | 双份适配、双份升级 |
| **sherpa-onnx + RapidOCR（推荐）** | **1 套** | 仅 ORT | 单一底座 |

- Sherpa-ONNX 基于 ONNX Runtime
- RapidOCR 是 PP-OCR 的 **ONNX 移植版**（RapidAI 开源，Apache-2.0），同样基于 ONNX Runtime，不依赖 Paddle 框架，模型约 20MB（INT8 量化后约 10MB），已支持 PP-OCRv4/v5 mobile 模型
- 两者共用同一 ORT 底座 → **模型管理、线程调度、内存策略、模型热更新全部复用一套代码**

### 2.3 核心协议设计（预留 OCR 位）

```swift
// 未来 ASR 与 OCR 都实现此协议，上层无感知
protocol InferenceEngine {
    associatedtype Input
    associatedtype Output
    var isReady: Bool { get }
    func load(modelSet: ModelSet) async throws
    func infer(_ input: Input) async throws -> Output
    func unload()
}

// 模型统一由 ModelManager 管理：下载/校验/版本/存储路径
final class ModelManager {
    func ensureInstalled(_ spec: ModelSpec) async throws -> URL
    // spec: 名称、版本、URL、SHA256、体积、目标目录
}
```

这样未来接入 OCR 时，**只需新增一个实现 `InferenceEngine` 的 `OCREngine`，不改动任何上层代码**。

---

## 3. 语音识别方案：Sherpa-ONNX

### 3.1 选型理由

| 维度 | 说明 |
|---|---|
| 离线 | 全本地推理，无需联网，契合医疗隐私诉求 |
| 许可 | Apache-2.0，可商用 |
| 平台 | iOS / Android / macOS / Linux / WebAssembly / HarmonyOS，**Swift 官方绑定** |
| 依赖 | 仅需 ONNX Runtime，**不依赖 PyTorch**，包体可控 |
| 生态 | 支持 SenseVoice / Paraformer / Zipformer / Whisper / FireRedASR / Dolphin 等 |
| 配套 | 内置 **Silero VAD**、标点恢复，可与 ASR 自由组合 |
| 可替换 | 模型与框架解耦，未来换模型不改代码 |

### 3.2 模型选型（医疗问诊场景）

场景特征：中文为主、医生口音/方言可能、专业术语密集（药名、诊断名、剂量）、录完整段后转写（**非流式优先，精度优先**）。

| 优先级 | 模型 | 特点 | 适配判断 |
|---|---|---|---|
| **首选** | SenseVoice-Small（int8） | 中文/英文/粤语/日韩 + 多方言，非流式 | 方言覆盖好，非流式精度高，适合"录完转写" |
| 备选 A | FireRedASR v2 | 中英文 + 20+ 方言，精度强 | 若 SenseVoice 术语准确率不足，作为升级项 |
| 备选 B | Paraformer 离线版 | 中文 + 多方言，成熟稳定 | 生态成熟，作为回退方案 |
| 二期 | 流式 Paraformer / Zipformer | 实时出字 | 若要做"边录边看字幕"再引入 |

> ⚠️ **模型体积与 RTF（实时率）必须在真机实测后定稿**，社区评测数据仅供参考。建议 M1 阶段用同一批测试音频横评 2-3 个模型。

### 3.3 医疗术语准确率增强（关键环节）

通用 ASR 对"阿莫西林克拉维酸钾""布洛芬混悬液"这类词的识别率天然偏低，必须做专项增强：

1. **热词偏置（Hotword Boosting）**：Sherpa-ONNX 支持热词机制，预置**儿科常用药名、诊断名、检查项**词表（POC 阶段验证支持程度与效果）
2. **后处理词典纠错**：转写结果用药名词典做编辑距离匹配纠正（如"阿莫西林"被识别为"阿莫西灵"）
3. **结构化反向校验**：抽取出的药名若不在词典中，标记为"待确认"并高亮，让用户快速修正
4. **词典可扩展**：内置基础词库 + 允许用户手动添加家人常用药

### 3.4 音频链路

```
AVAudioEngine 采集（16kHz / 单声道 / Float32 PCM）
   ↓
内存环形缓冲（同时写入本地 m4a 存档，便于回听）
   ↓
[可选] Silero VAD 分段（长音频切分，降低单次推理内存峰值）
   ↓
Sherpa-ONNX OfflineRecognizer（int8 模型，多线程）
   ↓
原始转写文本 + 时间戳
   ↓
术语纠错（药名/诊断名词典）
   ↓
结构化抽取（见第 4 节）
```

---

## 4. 结构化层：从转写文本到 9 大分类

`ai-processor.js` 目前是模拟实现，需真实落地。三条路线：

| 路线 | 方案 | 优点 | 缺点 |
|---|---|---|---|
| **A（推荐一期）** | **本地规则 + 词典抽取** | 完全离线、零成本、可解释、响应快 | 覆盖率有限，长尾表达处理弱 |
| B（二期） | 端侧小模型（1-3B 量化 LLM） | 离线且泛化好 | 体积 1GB+，当前手机端不现实 |
| C（可选开关） | 云端 LLM（用户显式授权后） | 准确率最高 | 数据出设备，需隐私授权与脱敏 |

**一期的本地规则抽取设计**：

- **用药**：正则匹配「药名 + 剂量 + 频次 + 疗程」模式，配合药名词典
  - 例：`每次1.5袋（约150mg）` → dosage；`每日2次，早晚各一次` → frequency；`吃满7天` → durationDays
- **复诊**：时间表达式解析（`三天后复查` / `一周后` / `下周一`）→ 自动生成复诊提醒
- **体温/观察指标**：数字 + 单位 + 阈值提取，自动进入体温监测模块
- **其余分类**：关键词 + 句式模板归类（如"建议…""注意…""避免…"）

**兜底机制**：无法归类的句子统一进入「完整对话记录」，用户可手动拖拽归类。这保证了**信息不丢失**，即使抽取不准也不影响核心体验。

---

## 5. 未来 OCR 集成规划

### 5.1 技术选型：RapidOCR（PP-OCR ONNX 版）

| 候选 | 引擎 | 体积 | 结论 |
|---|---|---|---|
| **RapidOCR** | ONNX Runtime | 约 20MB（INT8 约 10MB） | ✅ **推荐**，与 ASR 共用底座 |
| PaddleOCR + Paddle-Lite | Paddle-Lite | 模型 30MB 起 + 引擎 | ❌ 双引擎，维护已趋缓 |
| Apple Vision | 系统内置 | 0 | ✅ 作为**零成本兜底与快速方案** |

**分两步走**：

1. **近期（低成本验证）**：直接用 **Apple Vision**（`VNRecognizeTextRequest`，支持简体中文，iOS 13+，零体积）做病例图片文字提取，验证"OCR 到底能给用户带来多少价值"
2. **正式（隐私/精度增强）**：接入 RapidOCR + PP-OCRv4/v5 mobile ONNX 模型，与 ASR 共用 ONNX Runtime

> 这样安排的理由：先用零成本方案验证产品价值，避免一上来就投入高集成成本却发现自己做的 OCR 用户并不买账。

### 5.2 接入位预留（现在就要做）

即使一期不做 OCR，M1 阶段就应完成以下抽象，避免未来返工：

- `InferenceEngine` 协议（ASR 已实现）
- `ModelManager`：统一的模型下载 / 校验 / 版本管理 / 存储
- 模型**按需下载**机制（不进 IPA，首次使用或设置页触发）
- `RecognitionService` 门面：上层只调 `recognizeSpeech()` / `recognizeText()`，不感知底层引擎

### 5.3 包体积预算

| 项目 | 预估 | 是否进 IPA |
|---|---|---|
| App 本体 + Web 资产 | ~10-15MB | 是 |
| ONNX Runtime（iOS） | ~5-10MB | 是 |
| ASR 模型（int8） | **~228MB**（v1.1 实测） | **否，必须按需下载** |
| OCR 模型（INT8，未来） | ~10-20MB | **否，按需下载** |
| VAD 模型 | ~1MB | 是 |

> 模型走按需下载，也便于后续**模型热更新**——用户无需升级 App 即可获得更准的模型。

---

## 6. 工程结构建议

```
medical-record-app/
├── docs/                          # 方案文档
├── web/                           # 现有 Web 资产（原根目录文件移入）
│   ├── index.html
│   ├── css/
│   └── js/
├── ios/                           # iOS 原生工程
│   ├── MedicalRecord/
│   │   ├── App/                   # App 生命周期、入口
│   │   ├── UI/                    # 原生页面（逐步替换 WebView）
│   │   │   └── WebHost/           # WKWebView 容器 + JSBridge
│   │   ├── Core/
│   │   │   ├── Audio/             # AVAudioEngine 录音、VAD
│   │   │   ├── Storage/           # SQLite、文件、数据迁移
│   │   │   ├── Inference/         # ★ 推理底座
│   │   │   │   ├── InferenceEngine.swift    # 协议
│   │   │   │   ├── ModelManager.swift       # 模型下载/版本/校验
│   │   │   │   ├── ASREngine.swift          # sherpa-onnx 实现
│   │   │   │   └── OCREngine.swift          # 未来：RapidOCR 实现
│   │   │   ├── Structuring/       # 转写文本 → 9 大分类
│   │   │   └── Bridge/            # JSBridge 消息定义
│   │   └── Resources/
│   └── Podfile / Package.swift
└── scripts/
```

---

## 7. 里程碑

| 阶段 | 目标 | 关键产出 | 验收标准 |
|---|---|---|---|
| **M0 · POC 验证** | 跑通"录音→本地转写"最小闭环 | 一个裸 iOS Demo：AVAudioEngine 录音 + sherpa-onnx 转写 | 真机上 3 分钟中文音频可离线转写，记录 RTF/内存/发热 |
| **M1 · 底座搭建** | 原生壳 + 推理底座 + 存储 | WKWebView 加载现有 UI；JSBridge 打通；SQLite 存储 + 数据迁移 | 现有 App 功能在 iOS 上完整可用，数据不丢 |
| **M2 · ASR 落地** | 替换模拟 AI，真实转写 | ASREngine + 术语纠错 + 本地规则结构化 | 真实问诊录音可生成 9 大分类记录 |
| **M3 · 体验打磨** | 性能与交互优化 | 转写进度、模型下载管理、离线提示、错误兜底 | 3-5 分钟音频转写 < 60s，无崩溃 |
| **M4 · OCR 接入** | 病例图片本地识别 | 先用 Vision，再接 RapidOCR | 化验单/处方文字可提取并关联到就诊记录 |

---

## 8. 风险与 POC 待验证清单

| # | 风险 | 影响 | 验证方式 |
|---|---|---|---|
| 1 | **模型体积/RTF 不达标** | 体验差、下载慢 | M0 阶段真机横评 2-3 个模型（iPhone 12 及以上机型） |
| 2 | **医疗术语识别率低** | 核心功能不可用 | 录制 20 段真实问诊音频建评测集，对比加/不加热词的字错率（CER） |
| 3 | **sherpa-onnx 与 ORT 共用可行性** | 若官方预编译包静态链接 ORT，可能无法共用 | 检查官方 iOS 包形态；必要时自行编译链接统一 ORT |
| 4 | **iOS 后台/长时间录音** | 锁屏后被中断 | 验证后台音频模式、锁屏录音、来电打断处理 |
| 5 | **WebView 混合包审核风险** | App Store 4.2 拒审风险 | 保证核心能力原生实现、离线可用，逐步提高原生页面占比 |
| 6 | **内存峰值** | 长音频推理 OOM | 用 VAD 分段 + 流式写入，监控 Memory Graph |
| 7 | 模型分发合规 | 模型许可与分发条款 | 确认所选模型的 License 允许商业分发 |

---

## 9. 立即行动项

1. **克隆并编译 Sherpa-ONNX**，跑通官方 iOS 示例（`git clone https://github.com/k2-fsa/sherpa-onnx.git`）
2. **下载候选模型**（SenseVoice-Small int8、FireRedASR v2），在真机上跑同一批测试音频，记录 RTF / 内存 / 字错率
3. **建立评测集**：录制 20 段真实（或模拟）儿科问诊音频 + 人工标注转写文本，作为后续所有模型迭代的基线
4. **验证热词机制**：确认 Sherpa-ONNX 在所选模型上是否支持 hotword boosting，以及药名词表能带来多少提升
5. **确定 iOS 包形态**：官方是否提供 xcframework；ONNX Runtime 能否统一（风险 #3）

> 建议 M0 控制在 **3-5 天内完成验证**，拿到真实数据后再投入正式开发。

---

## 附：为什么不直接上"一套全搞定"

- **不用云端 ASR**：医疗隐私是核心卖点，且医院网络不可靠
- **不用 Paddle-Lite 做 OCR**：与 ONNX 底座重复，双引擎维护成本高，且 Paddle-Lite 更新趋缓
- **不一开始重写原生 UI**：6500 行 Web 资产复用价值高，先验证产品价值再决定是否投入重写
- **不一上来就做 OCR**：先用零成本的 Apple Vision 验证用户价值，避免高投入低回报

---

## 9. v1.1 实际进展（2026-09-07 同日补）

### 9.1 M0 阶段成果

完成全部 M0 关键产物，可在本机直接验证：

| 产物 | 路径 | 状态 |
|---|---|---|
| sherpa-onnx Python 评测工具 | `asr-poc/scripts/{evaluate,transcribe}.py` | ✅ 跑通 |
| 模型下载脚本（HF 镜像加速） | `asr-poc/scripts/download_models.sh` | ✅ 跑通 |
| 儿科医疗术语词典 | `asr-poc/eval_set/medical_terms.txt` | ✅ 37 条 |
| iOS Swift 工程骨架 | `ios/Yilu/{App,Bridge,ASR,Inference,Data}/` | ✅ 14 个 Swift 文件，编译路径需完整 Xcode 验证 |
| Web 端原生桥接层 | `js/native-bridge.js` | ✅ 浏览器降级 OK |
| Web 端规则结构化 | `js/ai-processor.js` `structureTranscript` | ✅ 实测：诊断/用药/复诊分类都可用 |

### 9.2 关键实测数据（macOS arm64 2 线程示例音频）

| 模型 | 加载耗时 | CER(示例) | RTF | 备注 |
|---|---|---|---|---|
| SenseVoice-Small int8 | 0.54s | 3.85% | 0.018 | `use_itn=True` 让「9点」保留为阿拉伯数字 |
| Paraformer int8 | 0.45s | 9.48% | 0.016 | 数字转中文（「9点」→「九点」），用药场景慎用 |

> Python 进程内存 800+MB 含 ORT 静态数据，**不代表 iOS 静态链接 ARMv8 上的真实开销**，真机请用 Instruments 复测

### 9.3 重要发现（v1.0 编写时未掌握）

1. **模型体积严重低估**：v1.0 估算 SenseVoice 「23MB 级」，实测 `model.int8.onnx` 单文件 **228MB**。**必须按需下载，绝对不能内置 IPA**
2. **iOS 集成更简单**：v1.0 假设需 `build-ios.sh` 源码编译，**实际上官方提供 SPM 包** + 预编译 xcframework（`https://github.com/k2-fsa/sherpa-onnx/releases/download/xcframework/...`），Xcode 添加 SPM 依赖即可，无需本地编译 C++
3. **SPM 依赖要求**：iOS 15+（本方案已满足）
4. **ONNX Runtime 复用问题**：sherpa-onnx 静态链接了 ORT；未来 OCR 接入时需另引 `onnxruntime-objc`。上层 `InferenceEngine` 协议抽象仍可保证上层无感
5. **HF 镜像可达**：国内 `hf-mirror.com` 下载模型很稳（240MB 约 30s）；官方 `huggingface.co` 部分网络不通

### 9.4 本机环境限制

实测开发环境：**macOS 26.6.2 / Apple Silicon / 仅 CommandLineTools（无完整 Xcode）**

影响：
- ❌ 无法编译/运行 iOS App（M0 阶段仅能产出代码与文档）
- ✅ 模型推理、规则结构化、Web 端桥接全部可在浏览器与 macOS 上验证
- 完整 Xcode 必须从 App Store 安装后才可继续 M1 阶段

> **影响 M0 → M1 衔接**：跨人协作时，需在有完整 Xcode 的机器上先跑 `bash ios/scripts/setup.sh --xcodegen` 验证工程能打开、能下载 SPM、能解析桥接协议。本机只能保证代码正确性。

---

## 10. v1.2 进展：Xcode 环境打通与首次编译（2026-09-08）

### 10.1 环境

| 项 | 值 |
|---|---|
| Xcode | 26.6 (Build 17F113) |
| iOS SDK | 26.5 |
| 部署目标 | iOS 15.0（sherpa-onnx SPM 包最低要求也是 15） |
| 芯片 | Apple Silicon（arm64） |

### 10.2 首次编译结果

用 `project.nospm.yml`（不含 SPM）完成**从零到产物**的验证：

```
bash ios/scripts/build.sh nospm
→ ** BUILD SUCCEEDED **
→ Yilu.app（可执行文件 510K，内置 7 个 Web 资源文件，保留 css/js 目录层级）
```

编译期发现并修复的真实缺陷（说明骨架代码此前从未被编译器检验过）：

| 文件 | 问题 | 修复 |
|---|---|---|
| `AudioRecorder.swift:42` | `private(set)` 用于只读计算属性，非法 | 改为 `public var isRecording` |
| `AudioRecorder.swift:53` | 用了 iOS 17 才有的 `AVAudioApplication` | 加 `#available(iOS 17.0, *)` 分支，回退 `AVAudioSession.requestRecordPermission` |
| `BridgeMessage.swift` | `success/failure` 第二参是带标签的 `requestId:`，但 10+ 处调用写成了位置参数 | 改定义为位置参数（内部辅助函数） |
| `WebViewContainer.swift` | `Bundle.url(forResource: "web/index")` 不支持路径分隔符，必定找不到 | 改用 `subdirectory:` 并按 `Resources/web` → `web` → 根 三级兜底 |

工程配置层面修复：

- `PRODUCT_NAME` 未显式指定导致产物名为空（`Multiple commands produce '.../.app'`）
- `minVersion` 改为 `from:`（XcodeGen 约束写法）
- `Info.plist` 的手写键会被 XcodeGen 覆盖 → 全部迁入 `info.properties`
- `sources` 的 `excludes: Resources/**` 会把后续资源条目一并过滤 → 改为显式列出源码目录

### 10.3 未验证项与原因

**sherpa-onnx 实际推理未验证**，两个独立的环境限制：

1. **git 协议被代理拦截**：`git ls-remote https://github.com/...` 返回 `CONNECT tunnel failed, response 502`。
   已绕过：用 `codeload.github.com`（HTTP 通道可用）拉取源码，建本地镜像仓库，
   再用 `git config url."file://...".insteadOf` 重定向，克隆可在 14 秒内完成。
   二进制 xcframework 走 `releases/download`（HTTPS 直连）不受影响。

2. **嵌套沙箱被禁**：SwiftPM 编译 Package.swift 时调用 `sandbox-exec` 报
   `sandbox_apply: Operation not permitted`。已验证**连最简测试包也失败**，
   属运行环境限制，与本项目无关；在普通终端或 Xcode GUI 中不会出现。

   绕过思路：`project.nospm.yml` + `#if canImport` 降级，先验证 App 主体。

> 结论：在有正常网络的普通终端执行 `bash ios/scripts/setup.sh --xcodegen && open Yilu.xcodeproj`，
> SPM 解析应当能正常完成（官方提供 SPM 包 + 预编译 xcframework，无需本地编译 C++）。

### 10.4 下一步（M1 收尾）

1. 在普通终端跑通 SPM 解析，确认 `SherpaOnnxOfflineRecognizer` 可用
2. 安装 iOS 模拟器运行时（Xcode → Settings → Components）或直接用真机
3. 真机录音 → 离线转写 → 结构化，与 `asr-poc` 的 CER 数据交叉验证
