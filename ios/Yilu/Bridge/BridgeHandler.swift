//
//  BridgeHandler.swift
//  医录 Yilu
//
//  JS 消息分发中心：把来自 WebView 的请求路由到对应原生能力。
//

import Foundation
import WebKit

public final class BridgeHandler: NSObject, @unchecked Sendable {

    /// 向 JS 发送响应的回调（由 WebViewContainer 注入）
    public var send: ((String) -> Void)?

    private let asr: ASRService
    private let recorder = AudioRecorder()

    /// 最近一次录音文件（调试用，可在"我的"页导出）
    private var lastRecordingURL: URL?

    public init(asr: ASRService) {
        self.asr = asr
        super.init()
    }

    // MARK: 入口

    public func handle(_ body: Any) {
        guard let dict = body as? [String: Any],
              let type = dict["type"] as? String else {
            emit(BridgeResponse.failure("unknown", nil, BridgeError.badRequest))
            return
        }
        let requestId = dict["requestId"] as? String
        let payload = dict["payload"] as? [String: Any] ?? [:]

        switch type {
        case BridgeMethod.appInfo.rawValue:
            handleAppInfo(requestId)

        case BridgeMethod.enginePrepare.rawValue:
            handleEnginePrepare(requestId)

        case BridgeMethod.engineStatus.rawValue:
            handleEngineStatus(requestId)

        case BridgeMethod.asrStart.rawValue:
            handleASRStart(requestId)

        case BridgeMethod.asrStop.rawValue:
            handleASRStop(requestId)

        case BridgeMethod.asrCancel.rawValue:
            handleASRCancel(requestId)

        case BridgeMethod.permissionMic.rawValue:
            handleMicPermission(requestId)

        case BridgeMethod.storeGet.rawValue:
            handleStoreGet(requestId, payload)

        case BridgeMethod.storeSet.rawValue:
            handleStoreSet(requestId, payload)

        case BridgeMethod.storeExport.rawValue:
            handleStoreExport(requestId)

        case BridgeMethod.ocrRecognize.rawValue:
            emit(BridgeResponse.failure(type, requestId, BridgeError.notImplemented("OCR 将在 M4 阶段实现")))

        default:
            emit(BridgeResponse.failure(type, requestId, BridgeError.unknownMethod(type)))
        }
    }

    // MARK: 具体处理

    private func handleAppInfo(_ requestId: String?) {
        let info: [String: Any] = [
            "platform": "ios",
            "version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.1.0",
            "build": Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1",
            "engine": asr.displayName,
            "engineReady": asr.state == .ready,
            "medicalTerms": MedicalTermCorrector.shared.termCount,
        ]
        emit(.success(BridgeMethod.appInfo.rawValue, requestId, info.mapValues { AnyCodable($0) }))
    }

    private func handleEnginePrepare(_ requestId: String?) {
        Task { @MainActor in
            do {
                try await asr.prepare { [weak self] progress in
                    let payload: [String: Any] = ["progress": progress, "stage": "download"]
                    self?.emitEvent(.engineProgress, payload: payload)
                }
                emit(.success(BridgeMethod.enginePrepare.rawValue, requestId, ["ready": AnyCodable(true)]))
            } catch {
                emit(BridgeResponse.failure(BridgeMethod.enginePrepare.rawValue, requestId, error))
            }
        }
    }

    private func handleEngineStatus(_ requestId: String?) {
        let ready = asr.state == .ready
        let payload: [String: Any] = [
            "ready": ready,
            "name": asr.displayName,
            "ready_anyway": ready,
        ]
        emit(.success(BridgeMethod.engineStatus.rawValue, requestId, payload.mapValues { AnyCodable($0) }))
    }

    private func handleASRStart(_ requestId: String?) {
        Task { @MainActor in
            do {
                try await asr.prepare { _ in }
                try await recorder.start()
                emit(.success(BridgeMethod.asrStart.rawValue, requestId))
            } catch {
                emit(BridgeResponse.failure(BridgeMethod.asrStart.rawValue, requestId, error))
            }
        }
    }

    private func handleASRStop(_ requestId: String?) {
        Task { @MainActor in
            do {
                let samples = try recorder.stop()

                // 落盘，便于后续复听与重新识别
                let fileURL = Database.attachmentsDirectory
                    .appendingPathComponent("rec-\(Int(Date().timeIntervalSince1970)).wav")
                try WaveFileWriter.write(samples: samples, sampleRate: 16000, to: fileURL)
                lastRecordingURL = fileURL

                guard !samples.isEmpty else {
                    emit(BridgeResponse.failure(
                        BridgeMethod.asrStop.rawValue, requestId, BridgeError.emptyAudio))
                    return
                }

                let result = try await asr.transcribe(samples: samples, sampleRate: 16000)
                let payload: [String: Any] = [
                    "text": result.text,
                    "duration": result.duration,
                    "elapsed": result.elapsed,
                    "rtf": result.rtf,
                    "corrected": result.corrected,
                    "audioPath": fileURL.path,
                ]
                emit(.success(BridgeMethod.asrStop.rawValue, requestId, payload.mapValues { AnyCodable($0) }))
            } catch {
                emit(BridgeResponse.failure(BridgeMethod.asrStop.rawValue, requestId, error))
            }
        }
    }

    private func handleASRCancel(_ requestId: String?) {
        do {
            _ = try recorder.stop()
            emit(.success(BridgeMethod.asrCancel.rawValue, requestId))
        } catch {
            emit(BridgeResponse.failure(BridgeMethod.asrCancel.rawValue, requestId, error))
        }
    }

    private func handleMicPermission(_ requestId: String?) {
        Task {
            let granted = await AudioRecorder.requestPermission()
            emit(.success(BridgeMethod.permissionMic.rawValue, requestId, ["granted": AnyCodable(granted)]))
        }
    }

    private func handleStoreGet(_ requestId: String?, _ payload: [String: Any]) {
        guard let key = payload["key"] as? String else {
            emit(BridgeResponse.failure(BridgeMethod.storeGet.rawValue, requestId, BridgeError.badRequest))
            return
        }
        do {
            let value = try Database.shared.value(for: key)
            emit(.success(BridgeMethod.storeGet.rawValue, requestId,
                          ["value": AnyCodable(value ?? "")]))
        } catch {
            emit(BridgeResponse.failure(BridgeMethod.storeGet.rawValue, requestId, error))
        }
    }

    private func handleStoreSet(_ requestId: String?, _ payload: [String: Any]) {
        guard let key = payload["key"] as? String, let value = payload["value"] as? String else {
            emit(BridgeResponse.failure(BridgeMethod.storeSet.rawValue, requestId, BridgeError.badRequest))
            return
        }
        do {
            try Database.shared.setValue(value, for: key)
            emit(.success(BridgeMethod.storeSet.rawValue, requestId))
        } catch {
            emit(BridgeResponse.failure(BridgeMethod.storeSet.rawValue, requestId, error))
        }
    }

    private func handleStoreExport(_ requestId: String?) {
        do {
            let collections = ["patients", "visits", "reminders", "tempRecords"]
            var export: [String: Any] = [:]
            for collection in collections {
                export[collection] = try Database.shared.all(collection: collection)
            }
            let data = try JSONSerialization.data(withJSONObject: export, options: [.prettyPrinted])
            emit(.success(BridgeMethod.storeExport.rawValue, requestId,
                          ["json": AnyCodable(String(data: data, encoding: .utf8) ?? "")]))
        } catch {
            emit(BridgeResponse.failure(BridgeMethod.storeExport.rawValue, requestId, error))
        }
    }

    // MARK: 发送

    private func emit(_ response: BridgeResponse) {
        guard let data = try? JSONEncoder().encode(response),
              let json = String(data: data, encoding: .utf8) else { return }
        send?(json)
    }

    private func emitEvent(_ event: BridgeEvent, payload: [String: Any]) {
        let dict: [String: Any] = [
            "type": event.rawValue,
            "ok": true,
            "payload": payload,
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let json = String(data: data, encoding: .utf8) else { return }
        send?(json)
    }
}

// MARK: - 桥错误

private enum BridgeError: LocalizedError {
    case badRequest
    case unknownMethod(String)
    case notImplemented(String)
    case emptyAudio

    var errorDescription: String? {
        switch self {
        case .badRequest: return "请求格式不正确"
        case .unknownMethod(let m): return "未知方法：\(m)"
        case .notImplemented(let m): return "尚未实现：\(m)"
        case .emptyAudio: return "没有录到声音"
        }
    }
}
