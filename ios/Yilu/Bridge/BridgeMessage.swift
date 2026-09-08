//
//  BridgeMessage.swift
//  医录 Yilu
//
//  Web <-> Native 消息协议。
//
//  JS 侧统一调用：
//    window.webkit.messageHandlers.yilu.postMessage({ type: "asr.stop", requestId: "1", payload: {...} })
//  Native 侧统一回调：
//    window.YiluNative.receive('{"type":"asr.result","requestId":"1","payload":{...}}')
//

import Foundation

// MARK: - 入站（JS -> Native）

public struct BridgeRequest: Codable, Sendable {
    public let type: String
    public let requestId: String?
    public let payload: [String: AnyCodable]?

    public init(type: String, requestId: String? = nil, payload: [String: AnyCodable]? = nil) {
        self.type = type
        self.requestId = requestId
        self.payload = payload
    }
}

// MARK: - 出站（Native -> JS）

public struct BridgeResponse: Codable, Sendable {
    public let type: String
    public let requestId: String?
    public let ok: Bool
    public let payload: [String: AnyCodable]?
    public let error: String?

    public init(type: String, requestId: String? = nil, ok: Bool, payload: [String: AnyCodable]? = nil, error: String? = nil) {
        self.type = type
        self.requestId = requestId
        self.ok = ok
        self.payload = payload
        self.error = error
    }

    // 注意：两个参数都是无标签的位置参数，调用处统一写 success(type, requestId, payload)
    public static func success(_ type: String, _ requestId: String?, _ payload: [String: AnyCodable]? = nil) -> BridgeResponse {
        BridgeResponse(type: type, requestId: requestId, ok: true, payload: payload)
    }

    public static func failure(_ type: String, _ requestId: String?, _ error: Error) -> BridgeResponse {
        BridgeResponse(type: type, requestId: requestId, ok: false, error: error.localizedDescription)
    }
}

// MARK: - 消息类型常量

public enum BridgeMethod: String, CaseIterable {
    // 引擎
    case enginePrepare = "engine.prepare"
    case engineStatus = "engine.status"
    // 语音识别
    case asrStart = "asr.start"
    case asrStop = "asr.stop"
    case asrCancel = "asr.cancel"
    case asrTranscribeFile = "asr.transcribeFile"
    // 存储
    case storeGet = "store.get"
    case storeSet = "store.set"
    case storeRemove = "store.remove"
    case storeExport = "store.export"
    // 设备与权限
    case permissionMic = "permission.mic"
    case appInfo = "app.info"
    // OCR（预留，M4 阶段实现）
    case ocrRecognize = "ocr.recognize"
}

// MARK: - 事件（Native 主动推送）

public enum BridgeEvent: String {
    case asrPartial = "asr.partial"       // 录音音量/时长
    case asrResult = "asr.result"         // 识别完成
    case engineProgress = "engine.progress"
    case error = "error"
}

// MARK: - 动态值包装（避免为每种消息定义结构体）

public struct AnyCodable: Codable, @unchecked Sendable {
    public let value: Any

    public init(_ value: Any) { self.value = value }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let bool = try? container.decode(Bool.self) { value = bool }
        else if let int = try? container.decode(Int.self) { value = int }
        else if let double = try? container.decode(Double.self) { value = double }
        else if let string = try? container.decode(String.self) { value = string }
        else if let array = try? container.decode([AnyCodable].self) { value = array.map { $0.value } }
        else if let dict = try? container.decode([String: AnyCodable].self) { value = dict.mapValues { $0.value } }
        else { value = NSNull() }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case let bool as Bool: try container.encode(bool)
        case let int as Int: try container.encode(int)
        case let double as Double: try container.encode(double)
        case let string as String: try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            try container.encodeNil()
        }
    }
}
