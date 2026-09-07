//
//  AudioRecorder.swift
//  医录 Yilu
//
//  录音：AVAudioEngine 采集 → 16kHz 单声道 Float32 → 内存中累积样本 + 落盘 wav。
//
//  为什么不用 Web 的 MediaRecorder：
//    iOS WKWebView 的录音权限与格式支持不稳定，且无法直接拿到 PCM 供本地模型消费。
//    原生采集可保证 16k/单声道/PCM，与 sherpa-onnx 的输入要求完全对齐。
//

import AVFoundation
import Foundation

// MARK: - 录音错误

public enum RecorderError: LocalizedError {
    case permissionDenied
    case engineFailure(String)
    case notRecording

    public var errorDescription: String? {
        switch self {
        case .permissionDenied: return "麦克风权限被拒绝，请到系统设置中开启"
        case .engineFailure(let msg): return "录音启动失败：\(msg)"
        case .notRecording: return "当前没有正在进行的录音"
        }
    }
}

// MARK: - 录音器

public final class AudioRecorder: @unchecked Sendable {

    public static let sampleRate: Double = 16000

    private var engine: AVAudioEngine?
    private var samples: [Float] = []
    private let sampleLock = NSLock()

    private var startedAt: Date?
    private(set) var isRecording: Bool { engine != nil }

    /// 实时音量回调（0...1），供 UI 画波形
    public var onLevel: ((Float) -> Void)?

    public init() {}

    // MARK: 权限

    public static func requestPermission() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioApplication.requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }

    // MARK: 控制

    public func start() async throws {
        guard await Self.requestPermission() else {
            throw RecorderError.permissionDenied
        }

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement, options: [.duckOthers])
        try session.setActive(true, options: .notifyOthersOnDeactivation)

        let engine = AVAudioEngine()
        let input = engine.inputNode
        let inputFormat = input.outputFormat(forBus: 0)

        guard let outputFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: Self.sampleRate,
            channels: 1,
            interleaved: false
        ) else {
            throw RecorderError.engineFailure("无法构造目标音频格式")
        }

        guard let converter = AVAudioConverter(from: inputFormat, to: outputFormat) else {
            throw RecorderError.engineFailure("无法创建采样率转换器")
        }

        sampleLock.withLock { samples.removeAll(keepingCapacity: true) }
        startedAt = Date()

        input.installTap(onBus: 0, bufferSize: 4096, format: inputFormat) { [weak self] buffer, _ in
            guard let self else { return }
            let ratio = outputFormat.sampleRate / inputFormat.sampleRate
            let capacity = AVAudioFrameCount((Double(buffer.frameLength) * ratio).rounded(.up))
            guard let converted = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: capacity) else { return }

            var error: NSError?
            let status = converter.convert(to: converted, error: &error) { _, outStatus in
                outStatus.pointee = .haveData
                return buffer
            }
            guard status != .error, let channelData = converted.floatChannelData else { return }

            let frameCount = Int(converted.frameLength)
            let pointer = UnsafeBufferPointer(start: channelData[0], count: frameCount)
            let chunk = Array(pointer)
            self.sampleLock.withLock { self.samples.append(contentsOf: chunk) }

            if let onLevel = self.onLevel {
                let rms = sqrt(chunk.reduce(0) { $0 + $1 * $1 } / Float(max(frameCount, 1)))
                DispatchQueue.main.async { onLevel(min(rms * 5, 1.0)) }
            }
        }

        do {
            engine.prepare()
            try engine.start()
        } catch {
            throw RecorderError.engineFailure(error.localizedDescription)
        }
        self.engine = engine
    }

    /// 停止录音，返回内存中的样本
    public func stop() throws -> [Float] {
        guard let engine else { throw RecorderError.notRecording }
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        self.engine = nil
        try? AVAudioSession.sharedInstance().setActive(false)
        return sampleLock.withLock { samples }
    }

    /// 停止录音并写入 wav 文件
    @discardableResult
    public func stopAndSave(to url: URL) throws -> URL {
        let data = try stop()
        try WaveFileWriter.write(samples: data, sampleRate: Int(Self.sampleRate), to: url)
        return url
    }

    /// 当前已录制时长（秒）
    public var currentDuration: TimeInterval {
        guard let startedAt, isRecording else { return 0 }
        return Date().timeIntervalSince(startedAt)
    }
}

// MARK: - WAV 读写

public enum WaveFileWriter {

    /// 写入 16bit 单声道 PCM wav
    public static func write(samples: [Float], sampleRate: Int, to url: URL) throws {
        var data = Data()
        let bytesPerSample = 2
        let dataSize = samples.count * bytesPerSample

        // RIFF header
        data.append(contentsOf: Array("RIFF".utf8))
        data.append(contentsOf: UInt32(36 + dataSize).littleEndianBytes)
        data.append(contentsOf: Array("WAVE".utf8))
        // fmt chunk
        data.append(contentsOf: Array("fmt ".utf8))
        data.append(contentsOf: UInt32(16).littleEndianBytes)          // chunk size
        data.append(contentsOf: UInt16(1).littleEndianBytes)           // PCM
        data.append(contentsOf: UInt16(1).littleEndianBytes)           // mono
        data.append(contentsOf: UInt32(sampleRate).littleEndianBytes)
        data.append(contentsOf: UInt32(sampleRate * bytesPerSample).littleEndianBytes)  // byte rate
        data.append(contentsOf: UInt16(bytesPerSample).littleEndianBytes)               // block align
        data.append(contentsOf: UInt16(16).littleEndianBytes)          // bits per sample
        // data chunk
        data.append(contentsOf: Array("data".utf8))
        data.append(contentsOf: UInt32(dataSize).littleEndianBytes)

        var pcm = [Int16]()
        pcm.reserveCapacity(samples.count)
        for s in samples {
            let clamped = max(-1.0, min(1.0, s))
            pcm.append(Int16(clamped * 32767))
        }
        for value in pcm { data.append(contentsOf: value.littleEndianBytes) }

        try data.write(to: url)
    }
}

public enum WaveFileReader {

    /// 读取 16bit PCM wav，返回归一化样本与采样率
    public static func read(url: URL) throws -> ([Float], Int) {
        let data = try Data(contentsOf: url)
        guard data.count > 44,
              String(data: data[0..<4], encoding: .ascii) == "RIFF",
              String(data: data[8..<12], encoding: .ascii) == "WAVE" else {
            throw RecorderError.engineFailure("不是有效的 wav 文件")
        }

        var offset = 12
        var sampleRate = 16000
        var pcmData: Data?

        while offset + 8 <= data.count {
            let id = String(data: data[offset..<(offset + 4)], encoding: .ascii) ?? ""
            let size = Int(data.withUnsafeBytes { $0.loadUnaligned(fromByteOffset: offset + 4, as: UInt32.self).littleEndian })
            let bodyStart = offset + 8
            if id == "fmt " {
                sampleRate = Int(data.withUnsafeBytes {
                    $0.loadUnaligned(fromByteOffset: bodyStart + 4, as: UInt32.self).littleEndian
                })
            } else if id == "data" {
                pcmData = data.subdata(in: bodyStart..<min(bodyStart + size, data.count))
            }
            offset = bodyStart + size + (size % 2)
        }

        guard let pcm = pcmData else { throw RecorderError.engineFailure("wav 缺少 data 段") }

        var samples = [Float]()
        samples.reserveCapacity(pcm.count / 2)
        pcm.withUnsafeBytes { raw in
            let buffer = raw.bindMemory(to: Int16.self)
            for v in buffer { samples.append(Float(Int16(littleEndian: v)) / 32768.0) }
        }
        return (samples, sampleRate)
    }
}

private extension FixedWidthInteger {
    var littleEndianBytes: [UInt8] {
        withUnsafeBytes(of: littleEndian) { Array($0) }
    }
}
