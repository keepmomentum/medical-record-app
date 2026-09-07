//
//  InferenceEngine.swift
//  医录 Yilu
//
//  统一推理底座协议。
//
//  设计要点：ASR（sherpa-onnx）与未来的 OCR（RapidOCR / PP-OCR ONNX 版）
//  都基于 ONNX Runtime，因此共用同一套「模型管理 + 引擎生命周期」抽象。
//  接入 OCR 时只需新增一个实现 InferenceEngine 的类型，上层代码零改动。
//

import Foundation

// MARK: - 引擎类型

/// 引擎能力标识。用于在 UI 上展示当前可用能力，也便于灰度开关。
public enum EngineKind: String, CaseIterable, Sendable {
    case asr   // 语音识别
    case ocr   // 文字识别（预留）
}

// MARK: - 引擎状态

public enum EngineState: Equatable, Sendable {
    case idle            // 未初始化
    case loading(progress: Float)
    case ready
    case failed(Error)

    public static func == (lhs: EngineState, rhs: EngineState) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle): return true
        case (.ready, .ready): return true
        case (.loading(let a), .loading(let b)): return abs(a - b) < 0.001
        case (.failed, .failed): return true
        default: return false
        }
    }
}

// MARK: - 引擎协议

public protocol InferenceEngine: AnyObject, Sendable {

    /// 引擎类型
    var kind: EngineKind { get }

    /// 当前状态（主线程观察）
    var state: EngineState { get }

    /// 引擎显示名，用于 UI / 日志
    var displayName: String { get }

    /// 依赖的模型规格
    var modelSpecs: [ModelSpec] { get }

    /// 预热：下载（如需）并加载模型。可重复调用，已 ready 时直接返回。
    /// - Parameter progress: 0...1，UI 进度回调
    func prepare(progress: @escaping @Sendable (Float) -> Void) async throws

    /// 释放模型与内存（收到内存警告时调用）
    func unload()
}

// MARK: - 错误

public enum InferenceError: LocalizedError {
    case modelMissing(String)
    case modelCorrupted(String)
    case downloadFailed(underlying: Error)
    case notPrepared
    case recognitionFailed(String)

    public var errorDescription: String? {
        switch self {
        case .modelMissing(let name):
            return "模型缺失：\(name)"
        case .modelCorrupted(let name):
            return "模型校验失败：\(name)"
        case .downloadFailed(let err):
            return "模型下载失败：\(err.localizedDescription)"
        case .notPrepared:
            return "引擎尚未就绪，请先调用 prepare()"
        case .recognitionFailed(let msg):
            return "识别失败：\(msg)"
        }
    }
}
