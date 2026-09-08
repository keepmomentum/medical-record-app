# 医录 · iOS 工程

> Swift 原生壳 + WKWebView + 离线 ASR（sherpa-onnx）。iOS 15+ / arm64 / 真机调试。

## 当前状态

**已在本机完成编译验证**（Xcode 26.6 / iOS SDK 26.5 / arm64 模拟器）：

```
bash scripts/build.sh nospm     # ✅ BUILD SUCCEEDED
```

`project.nospm.yml` 是不含 sherpa-onnx SPM 依赖的验证工程，用于确认 App 主体
（SwiftUI 壳 + WKWebView 桥接 + SQLite + 录音）能编译并正确打包，ASR 走桩实现。

| 验证项 | 结果 |
|---|---|
| 11 个 Swift 源文件语法 | ✅ |
| 模拟器 arm64 编译链接 | ✅ |
| Web 资源打进 App 包（7 个文件，保留 css/js 目录结构） | ✅ |
| Info.plist 权限声明与设备能力 | ✅ |

**尚未验证**：真机运行、sherpa-onnx 实际推理（见下方"环境限制"）。

## 架构

```
ios/
├── project.yml                # XcodeGen 工程描述
├── scripts/
│   ├── setup.sh               # 同步 Web 资源 + 拷贝词典 + 可选生成 xcodeproj
│   └── sync_web.sh            # 改完 Web 代码后增量同步
└── Yilu/
    ├── App/                  # SwiftUI 入口
    │   ├── YiluApp.swift     #   @main + 启动时引擎准备
    ├── Bridge/               # Web <-> Native 桥接
    │   ├── WebViewContainer.swift
    │   ├── BridgeHandler.swift
    │   └── BridgeMessage.swift
    ├── ASR/                  # 离线语音识别
    │   ├── ASRService.swift  #   sherpa-onnx 封装（#if 条件编译，未加依赖时降级）
    │   ├── ASRModels.swift   #   模型规格注册表
    │   ├── AudioRecorder.swift#   AVAudioEngine 16k 单声道采集
    │   └── MedicalTermCorrector.swift  #   医疗术语词典纠错
    ├── Inference/            # 统一推理底座（ASR + 未来 OCR）
    │   ├── InferenceEngine.swift
    │   └── ModelManager.swift # 模型下载/校验/版本管理
    ├── Data/                 # 本地数据层
    │   └── Database.swift    #   SQLite（替换 Web 端 localStorage）
    ├── Resources/
    │   ├── web/              #   同步自仓库根目录的 Web UI
    │   └── medical_terms.txt #   医疗术语词典
    └── Info.plist
```

### 关键设计决策

1. **统一 ONNX Runtime 底座**
   ASR（sherpa-onnx）和未来的 OCR（RapidOCR）都基于 ONNX Runtime；通过 `InferenceEngine` 协议统一抽象，上层代码不感知差异
2. **模型不内置，按需下载**
   实测 SenseVoice-Small int8 ≈ 228MB，超过 App Store「蜂窝网络下载」阈值。`ModelManager` 实现按需下载、版本管理、SHA256 校验、断点续传
3. **医疗术语增强三层**
   - **第一层**：sherpa-onnx 自带的 `sherpaOnnxHomophoneReplacerConfig`（同音字替换 FST）
   - **第二层**：医疗术语词典（`medical_terms.txt`，与 `asr-poc` 共享）
   - **第三层**：`MedicalTermCorrector` 在识别后做编辑距离纠错（距离=1 才采纳，宁可漏纠也不错纠）
4. **数据双写兜底**
   Web 端 `localStorage` 在 iOS 上**会被系统清理**。`Store.syncToNative()` 节流把全量快照同步到原生 SQLite，`Store.restoreFromNative()` 启动时检测并恢复
5. **Web 端可降级运行**
   `NativeBridge.isNative()` 判定；浏览器环境完全降级到 `MediaRecorder` + 现有 AI 处理器，零代码差

## 快速开始

### 0. 前置

- macOS 13+
- **完整 Xcode**（从 App Store 安装；`xcode-select` 仅含 CommandLineTools 不够）
- [XcodeGen](https://github.com/yonaskolb/XcodeGen)（可选）：`brew install xcodegen`
- iPhone 真机一台（模拟器无法录音）
- Apple ID 登录 Xcode（仅个人测试用免费证书即可）

### 1. 同步资源 + 生成工程

```bash
cd ios
bash scripts/setup.sh --xcodegen
```

会自动完成：
- 把仓库根目录的 `index.html` / `css/` / `js/` 同步到 `Yilu/Resources/web/`
- 把 `asr-poc/eval_set/medical_terms.txt` 拷贝到 `Yilu/Resources/`
- 用 XcodeGen 生成 `Yilu.xcodeproj`

> 不装 XcodeGen 也可以：手动 File → New → iOS App → 把 `Yilu/` 下的子目录拖入；后续 `bash scripts/sync_web.sh` 就能复用资源同步脚本

### 2. 打开工程

```bash
open Yilu.xcodeproj
```

Xcode 首次打开时会自动解析 `sherpa-onnx` SPM 依赖（需联网下载约 100MB 的 xcframework）。

### 3. 配置签名 + 真机

1. Xcode → Project → Signing & Capabilities → 选自己的 Apple ID
2. 顶部 scheme 选 iPhone 真机（**不是**模拟器）
3. Info.plist 中已配齐麦克风/相册/相机权限说明

### 4. 编译运行

`Cmd + R`。首次启动会自动开始下载 SenseVoice 模型（**约 230MB**），完成后应用顶部出现「模型已就绪」提示，再次录音即走完整离线识别流程。

也可以不打开 Xcode 直接命令行编译：

```bash
bash scripts/build.sh            # 模拟器（含 SPM 依赖，需联网）
bash scripts/build.sh nospm      # 无 SPM 依赖，离线也能编
bash scripts/build.sh device     # 真机（不签名，只验证能否编译）
```

## Web 端桥接协议

JS 侧统一通过：

```js
window.NativeBridge.startRecording();         // 录音
window.NativeBridge.stopAndTranscribe();      // 停止 + 识别
window.NativeBridge.storeSet('key', 'value'); // 写原生存储
```

完整协议见 `js/native-bridge.js`（Web 端）和 `Yilu/Bridge/BridgeMessage.swift`（原生端）。

**Web 端代码已自动接入**：
- `Recorder.start/stop/cancel` 检测原生环境
- `Store.syncToNative/restoreFromNative` 数据双写
- `AIProcessor.structureTranscript` 把真实转写文本规则结构化

修改完 Web 资源后：
```bash
bash ios/scripts/sync_web.sh
```
Xcode 重新跑即可看到效果。

## POC → iOS 迁移路线

1. **M0 阶段**（在 macOS 上完成）
   - `asr-poc/` 跑通 SenseVoice / Paraformer 的真机测试
   - 拿到真机 RTF、内存、字错率数据
2. **M1 阶段**
   - 装 Xcode + `bash setup.sh --xcodegen` 生成工程
   - 模拟器跑通，证明 SPM / WebView / 桥接全部联通
3. **M2 阶段**
   - 真机下载模型 + 完整录音 + 离线识别流程
   - 同时打开 `asr-poc/results/` 找到的最优模型
4. **M3 阶段**
   - 打磨 UI、性能、错误处理
5. **M4 阶段**
   - 接入 OCR（RapidOCR / Apple Vision 验证后选型）

## 已知问题 / 风险

- **首次启动下载 230MB** 需要给用户清晰引导
- **沙箱路径变更**时（iOS 17 → 18）需要验证 Application Support 路径仍然有效
- **App Store 审核**「4.2 混合包」类目近年趋严（强制要求原生价值高于 Web）；MVP 先不上架，走 TestFlight 验证

## 排障手册（都是实际踩过的坑）

### 1. XcodeGen 报 `Couldn't find current username`

某些执行环境（沙箱、CI、被 AppleScript 调起）里 `USER` 环境变量为空，XcodeGen 会直接退出。
`scripts/setup.sh` 已内置兜底；手动执行时先补上：

```bash
export USER="${USER:-$(id -un)}"
```

### 2. `buildPhase: resources` 没生效，资源没进工程

两个原因都可能触发：
- 同一 `sources` 列表里前面的条目用 `excludes: ["Resources/**"]`，会把后面显式声明的资源路径一起过滤掉
  → 改为**显式列出每个源码目录**，不要用 excludes 排除资源目录
- XcodeGen 生成工程后，`Info.plist` 里手写的键会被覆盖
  → 所有 plist 键必须写在 `project.yml` 的 `info.properties` 里（本项目已配好：权限说明、`UILaunchScreen`、方向、设备能力）

### 3. `error: Multiple commands produce '.../.app'`

`PRODUCT_NAME` 解析为空，产物名变成 `.app`。在 target settings 里显式写 `PRODUCT_NAME: Yilu` 即可。

### 4. `project.yml` 里 `minVersion` 报 Unknown package requirement

XcodeGen 的版本约束要用 `from:`（或 `minVersion` + `maxVersion` 成对出现）。

### 5. 代理环境下 SPM 解析失败

在受限网络里会遇到两类报错，处理方式不同：

| 报错 | 原因 | 处理 |
|---|---|---|
| `CONNECT tunnel failed, response 502` / 克隆一直卡住 | 代理拦截了 `github.com` 的 **git** 协议 | 用 `git config url.<local>.insteadOf` 把仓库重定向到本地镜像 |
| `sandbox-exec: sandbox_apply: Operation not permitted` | 运行环境禁止嵌套沙箱，**任何** Swift 包（含最简测试包）都无法编译 manifest | 换在普通终端 / Xcode GUI 里执行 |

本地镜像做法（已验证可用）：

```bash
# 用 codeload（不走 git 协议）拿源码，做成带版本 tag 的本地仓库
git config --global url."file:///绝对路径/sherpa-onnx".insteadOf "https://github.com/k2-fsa/sherpa-onnx"
```

> 二进制 xcframework 是从 `github.com/.../releases/download/` 下载的（走 HTTPS 直连，通常不受影响）。

### 6. 想在没有网络的环境里验证工程

用 `project.nospm.yml`：

```bash
bash scripts/build.sh nospm
```

`ASRService.swift` 全部用 `#if canImport(SherpaOnnx)` 包裹，缺依赖时自动降级为桩实现（能录音、转写为空），工程照样编译运行。

## 相关文档

- [`docs/iOS技术方案规划.md`](../docs/iOS技术方案规划.md) — 整体方案与决策
- [`asr-poc/README.md`](../asr-poc/README.md) — 模型选型评测流程
- [`js/native-bridge.js`](../js/native-bridge.js) — 完整桥接协议
