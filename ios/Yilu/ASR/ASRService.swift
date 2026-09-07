//
//  ASRService.swift
//  医录 Yilu
//
//  基于 sherpa-onnx 的离线语音识别服务（非流式整句识别）。
//
//  依赖：Swift Package Manager 添加 https://github.com/k2-fsa/sherpa-onnx
//        （官方提供 iOS 预编译 xcframework，无需本地编译 C++）
//
//  若未添加该依赖，本文件会退化为「不可用」桩实现，工程仍可编译运行，
//  录音功能自动回落为「只存音频不转写」，便于分阶段开发。
//

import Foundation

#if canImport(SherpaOnnx)
import SherpaOnnx
#elseif canImport(SherpaOnnxShared)
import SherpaOnnxShared
#endif

// MARK: - 识别结果

public struct ASRResult: Sendable {
    public let text: String
    /// 音频时长（秒）
    public let duration: TimeInterval
    /// 识别耗时（秒）
    public let elapsed: TimeInterval
    /// 实时率 = 识别耗时 / 音频时长，<1 表示快于实时
    public var rtf: Double { duration > 0 ? elapsed / duration : 0 }
    /// 是否经过了医疗术语纠错
    public let corrected: Bool

    public init(text: String, duration: TimeInterval, elapsed: TimeInterval, corrected: Bool) {
        self.text = text
        self.duration = duration
        self.elapsed = elapsed
        self.corrected = corrected
    }
}

// MARK: - 服务实现

public final class ASRService: InferenceEngine, @unchecked Sendable {

    // MARK: InferenceEngine

    public let kind: EngineKind = .asr
    public let modelSpec: ModelSpec
    public var modelSpecs: [ModelSpec] { [modelSpec] }

    public var displayName: String { modelSpec.name }

    private let lock = NSLock()
    private var _state: EngineState = .idle
    public var state: EngineState {
        get { lock.withLock { _state } }
        set { lock.withLock { _state = newValue } }
    }

    // MARK: 内部

    private let inferenceQueue = DispatchQueue(label: "com.yilu.asr.inference", qos: .userInitiated)
    private let corrector = MedicalTermCorrector.shared

    /// 推理线程数：iOS 上 2 是性价比最优点（再高性能增益有限，耗电明显）
    private let numThreads: Int

    /// 是否启用医疗术语纠错（识别后处理）
    public var enableMedicalCorrection: Bool = true

    #if canImport(SherpaOnnx) || canImport(SherpaOnnxShared)
    private var recognizer: SherpaOnnxOfflineRecognizer?
    #endif

    public init(modelSpec: ModelSpec = ASRModelCatalog.default, numThreads: Int = 2) {
        self.modelSpec = modelSpec
        self.numThreads = numThreads
    }

    // MARK: 准备

    public func prepare(progress: @escaping @Sendable (Float) -> Void) async throws {
        if case .ready = state { return }
        state = .loading(progress: 0)

        do {
            let dir = try await ModelManager.shared.ensure(modelSpec) { p in
                // 下载阶段占 90%，加载占 10%
                progress(p * 0.9)
            }

            #if canImport(SherpaOnnx) || canImport(SherpaOnnxShared)
            let recognizer = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<SherpaOnnxOfflineRecognizer, Error>) in
                inferenceQueue.async {
                    do {
                        let rec = try Self.makeRecognizer(modelDir: dir, spec: self.modelSpec, threads: self.numThreads)
                        continuation.resume(returning: rec)
                    } catch {
                        continuation.resume(throwing: error)
                    }
                }
            }
            self.recognizer = recognizer
            progress(1.0)
            state = .ready
            #else
            // 未链接 sherpa-onnx：标记为失败，但给出清晰原因
            state = .failed(InferenceError.notPrepared)
            throw InferenceError.notPrepared
            #endif
        } catch {
            state = .failed(error)
            throw error
        }
    }

    #if canImport(SherpaOnnx) || canImport(SherpaOnnxShared)
    private static func makeRecognizer(
        modelDir: URL,
        spec: ModelSpec,
        threads: Int
    ) throws -> SherpaOnnxOfflineRecognizer {
        let modelPath = modelDir.appendingPathComponent("model.int8.onnx").path
        let tokensPath = modelDir.appendingPathComponent("tokens.txt").path
        guard FileManager.default.fileExists(atPath: modelPath),
              FileManager.default.fileExists(atPath: tokensPath) else {
            throw InferenceError.modelMissing(spec.name)
        }

        let featConfig = sherpaOnnxFeatureConfig(sampleRate: 16000, featureDim: 80)

        var modelConfig: sherpaOnnxOfflineModelConfig
        switch spec.id {
        case "paraformer-zh":
            let pf = sherpaOnnxOfflineParaformerModelConfig(model: modelPath)
            modelConfig = sherpaOnnxOfflineModelConfig(
                tokens: tokensPath,
                numThreads: Int32(threads),
                debug: 0,
                provider: "cpu",
                modelType: "paraformer",
                paraformer: pf
            )
        default:
            // SenseVoice：开启 ITN，让「一次五毫升」不被转成「一次五毫升」以外的写法
            let sv = sherpaOnnxOfflineSenseVoiceModelConfig(
                model: modelPath,
                language: "zh",
                useInverseTextNormalization: true
            )
            modelConfig = sherpaOnnxOfflineModelConfig(
                tokens: tokensPath,
                numThreads: Int32(threads),
                debug: 0,
                provider: "cpu",
                modelType: "sense_voice",
                senseVoice: sv
            )
        }

        // 医疗术语同音字替换（可选）：目录下存在 lexicon.txt 与 replace.fst 时启用
        var hrConfig = sherpaOnnxHomophoneReplacerConfig()
        let lexicon = modelDir.appendingPathComponent("lexicon.txt")
        let ruleFsts = modelDir.appendingPathComponent("replace.fst")
        if FileManager.default.fileExists(atPath: lexicon.path),
           FileManager.default.fileExists(atPath: ruleFsts.path) {
            hrConfig = sherpaOnnxHomophoneReplacerConfig(
                lexicon: lexicon.path,
                ruleFsts: ruleFsts.path
            )
        }

        var config = sherpaOnnxOfflineRecognizerConfig(
            featConfig: featConfig,
            modelConfig: modelConfig,
            decodingMethod: "greedy_search",
            maxActivePaths: 4,
            hr: hrConfig
        )
        return SherpaOnnxOfflineRecognizer(config: &config)
    }
    #endif

    // MARK: 识别

    /// 整段音频识别（16kHz 单声道）
    /// - Parameters:
    ///   - samples: 归一化到 [-1, 1] 的浮点样本
    ///   - sampleRate: 采样率，建议 16000
    public func transcribe(samples: [Float], sampleRate: Int = 16000) async throws -> ASRResult {
        guard case .ready = state else { throw InferenceError.notPrepared }

        let duration = Double(samples.count) / Double(sampleRate)
        let started = Date()

        #if canImport(SherpaOnnx) || canImport(SherpaOnnxShared)
        guard let recognizer else { throw InferenceError.notPrepared }

        let rawText: String = await withCheckedContinuation { continuation in
            inferenceQueue.async {
                let result = recognizer.decode(samples: samples, sampleRate: sampleRate)
                continuation.resume(returning: result.text)
            }
        }
        #else
        let rawText = ""
        #endif

        let elapsed = Date().timeIntervalSince(started)

        var finalText = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
        var corrected = false
        if enableMedicalCorrection, !finalText.isEmpty {
            let (fixed, changed) = corrector.correct(finalText)
            finalText = fixed
            corrected = changed
        }

        return ASRResult(
            text: finalText,
            duration: duration,
            elapsed: elapsed,
            corrected: corrected
        )
    }

    /// 从 wav 文件识别（调试与批量回放用）
    public func transcribe(wavURL: URL) async throws -> ASRResult {
        let (samples, sampleRate) = try WaveFileReader.read(url: wavURL)
        return try await transcribe(samples: samples, sampleRate: sampleRate)
    }

    // MARK: 生命周期

    public func unload() {
        #if canImport(SherpaOnnx) || canImport(SherpaOnnxShared)
        recognizer = nil
        #endif
        state = .idle
    }
}
