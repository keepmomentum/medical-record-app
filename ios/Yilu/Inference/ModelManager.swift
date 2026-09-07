//
//  ModelManager.swift
//  医录 Yilu
//
//  模型下载、校验、版本管理。
//
//  关键决策：模型**不内置进 App 包**。
//  实测 SenseVoice-Small int8 约 230MB、Paraformer int8 约 232MB，
//  内置会导致包体积爆炸且无法通过 App Store 蜂窝网络下载限制。
//  因此采用「首次启动按需下载 + 本地缓存 + 版本校验」策略。
//

import Foundation

// MARK: - 模型规格

public struct ModelSpec: Sendable {
    /// 唯一标识，同时作为本地目录名
    public let id: String
    /// 展示名
    public let name: String
    /// 版本（模型或导出方式变更时必须递增，触发重新下载）
    public let version: Int
    /// 组成文件（相对模型目录的路径 -> 下载源）
    public let files: [ModelFile]
    /// 预计体积（字节），用于下载前提示
    public let estimatedSize: Int64
    /// 是否必须（false 表示可选增强，如标点模型）
    public let required: Bool

    public init(
        id: String,
        name: String,
        version: Int = 1,
        files: [ModelFile],
        estimatedSize: Int64,
        required: Bool = true
    ) {
        self.id = id
        self.name = name
        self.version = version
        self.files = files
        self.estimatedSize = estimatedSize
        self.required = required
    }

    /// 本地目录名（带版本，版本变更自动隔离旧文件）
    var directoryName: String { "\(id)-v\(version)" }
}

public struct ModelFile: Sendable {
    /// 相对模型目录的文件名，如 "model.int8.onnx"
    public let relativePath: String
    /// 下载地址（支持多个镜像，按顺序尝试）
    public let urls: [URL]
    /// SHA256，为空则不校验
    public let sha256: String?
    /// 文件字节数，用于完整性初检；0 表示不校验
    public let size: Int64

    public init(relativePath: String, urls: [URL], sha256: String? = nil, size: Int64 = 0) {
        self.relativePath = relativePath
        self.urls = urls
        self.sha256 = sha256
        self.size = size
    }
}

// MARK: - 模型管理器

public final class ModelManager: @unchecked Sendable {

    public static let shared = ModelManager()

    /// 模型根目录：Application Support/models（会被 iCloud 备份，且不在 Caches 里，避免被系统清理）
    public let rootDirectory: URL

    private let fileManager = FileManager.default
    private let session: URLSession

    /// 已下载模型的版本标记文件
    private let markerName = ".yilu_ready"

    init() {
        let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        self.rootDirectory = appSupport.appendingPathComponent("models", isDirectory: true)
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 60 * 60  // 模型较大，给足时间
        self.session = URLSession(configuration: config)
        try? fileManager.createDirectory(at: rootDirectory, withIntermediateDirectories: true)
    }

    // MARK: 查询

    /// 模型目录（可能尚未创建）
    public func directory(for spec: ModelSpec) -> URL {
        rootDirectory.appendingPathComponent(spec.directoryName, isDirectory: true)
    }

    /// 模型是否就绪（文件齐全 + 有就绪标记）
    public func isReady(_ spec: ModelSpec) -> Bool {
        let dir = directory(for: spec)
        guard fileManager.fileExists(atPath: dir.appendingPathComponent(markerName).path) else {
            return false
        }
        return spec.files.allSatisfy { file in
            let url = dir.appendingPathComponent(file.relativePath)
            guard fileManager.fileExists(atPath: url.path) else { return false }
            if file.size > 0 {
                let attrs = try? fileManager.attributesOfItem(atPath: url.path)
                let actual = (attrs?[.size] as? NSNumber)?.int64Value ?? 0
                // 允许 1% 误差，避免不同源压缩/换行差异造成误判
                return abs(actual - file.size) <= max(Int64(Double(file.size) * 0.01), 1024)
            }
            return true
        }
    }

    /// 已下载文件的本地路径
    public func url(for file: ModelFile, in spec: ModelSpec) -> URL {
        directory(for: spec).appendingPathComponent(file.relativePath)
    }

    // MARK: 下载

    /// 确保模型就绪；已就绪直接返回目录，否则依次尝试各镜像下载。
    /// - Parameter progress: 整体进度 0...1
    @discardableResult
    public func ensure(
        _ spec: ModelSpec,
        progress: @escaping @Sendable (Float) -> Void
    ) async throws -> URL {
        if isReady(spec) {
            progress(1.0)
            return directory(for: spec)
        }

        let dir = directory(for: spec)
        try fileManager.createDirectory(at: dir, withIntermediateDirectories: true)

        // 断点续传：已存在且大小一致的文件跳过
        for (index, file) in spec.files.enumerated() {
            let dest = dir.appendingPathComponent(file.relativePath)
            if fileManager.fileExists(atPath: dest.path),
               let attrs = try? fileManager.attributesOfItem(atPath: dest.path),
               let actual = (attrs[.size] as? NSNumber)?.int64Value,
               file.size == 0 || abs(actual - file.size) <= max(Int64(Double(file.size) * 0.01), 1024) {
                progress(Float(index + 1) / Float(spec.files.count))
                continue
            }

            var lastError: Error?
            var downloaded = false
            for url in file.urls {
                do {
                    try await downloadFile(from: url, to: dest, spec: spec, file: file) { p in
                        progress((Float(index) + p) / Float(spec.files.count))
                    }
                    downloaded = true
                    break
                } catch {
                    lastError = error
                    continue
                }
            }
            guard downloaded else {
                throw InferenceError.downloadFailed(underlying: lastError ?? InferenceError.modelMissing(file.relativePath))
            }
        }

        // 校验
        for file in spec.files where file.sha256 != nil {
            let dest = dir.appendingPathComponent(file.relativePath)
            let actual = try sha256(of: dest)
            guard actual == file.sha256 else {
                throw InferenceError.modelCorrupted(file.relativePath)
            }
        }

        fileManager.createFile(
            atPath: dir.appendingPathComponent(markerName).path,
            contents: Data("\(spec.version)".utf8)
        )
        progress(1.0)
        return dir
    }

    private func downloadFile(
        from url: URL,
        to dest: URL,
        spec: ModelSpec,
        file: ModelFile,
        progress: @escaping @Sendable (Float) -> Void
    ) async throws {
        let tmp = dest.appendingPathExtension("tmp")
        if fileManager.fileExists(atPath: tmp.path) {
            try? fileManager.removeItem(at: tmp)
        }

        let (asyncBytes, response) = try await session.bytes(from: url)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw InferenceError.downloadFailed(underlying: InferenceError.modelMissing(url.lastPathComponent))
        }

        let expected = file.size > 0 ? file.size : http.expectedContentLength
        var received: Int64 = 0
        var buffer = Data(count: 0)
        buffer.reserveCapacity(Int(min(expected, 64 * 1024 * 1024)))

        for try await byte in asyncBytes {
            buffer.append(byte)
            received += 1
            if buffer.count >= 4 * 1024 * 1024 {   // 每 4MB 落盘一次，控制内存
                try append(buffer, to: tmp)
                buffer.removeAll(keepingCapacity: true)
            }
            if expected > 0, received % (1024 * 512) == 0 {
                progress(Float(Double(received) / Double(expected)))
            }
        }
        if !buffer.isEmpty {
            try append(buffer, to: tmp)
        }

        if fileManager.fileExists(atPath: dest.path) {
            try fileManager.removeItem(at: dest)
        }
        try fileManager.moveItem(at: tmp, to: dest)
        progress(1.0)
    }

    private func append(_ data: Data, to url: URL) throws {
        if fileManager.fileExists(atPath: url.path) {
            let handle = try FileHandle(forWritingTo: url)
            defer { try? handle.close() }
            try handle.seekToEnd()
            try handle.write(contentsOf: data)
        } else {
            try data.write(to: url)
        }
    }

    // MARK: 清理

    /// 删除指定模型
    public func remove(_ spec: ModelSpec) throws {
        let dir = directory(for: spec)
        if fileManager.fileExists(atPath: dir.path) {
            try fileManager.removeItem(at: dir)
        }
    }

    /// 已占用的磁盘空间（字节）
    public func totalSize() -> Int64 {
        guard let enumerator = fileManager.enumerator(
            at: rootDirectory, includingPropertiesForKeys: [.fileSizeKey]
        ) else { return 0 }
        var total: Int64 = 0
        for case let url as URL in enumerator {
            let size = (try? url.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0
            total += Int64(size)
        }
        return total
    }

    // MARK: 校验

    private func sha256(of url: URL) throws -> String {
        var hasher = SHA256()
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        while autoreleasepool(invoking: {
            let data = handle.availableData
            if data.isEmpty { return false }
            hasher.update(data: data)
            return true
        }) {}
        return hasher.finalize()
    }
}

// MARK: - 轻量 SHA256 实现（避免引入 CryptoKit 之外的依赖，便于单元测试）

struct SHA256 {
    private var state: [UInt32] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ]
    private var buffer = Data()
    private var length: Int64 = 0

    private static let k: [UInt32] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ]

    mutating func update(data: Data) {
        length += Int64(data.count)
        buffer.append(data)
        processFullBlocks()
    }

    private mutating func processFullBlocks() {
        while buffer.count >= 64 {
            let block = buffer.prefix(64)
            buffer.removeFirst(64)
            compress(Array(block))
        }
    }

    private mutating func compress(_ block: [UInt8]) {
        var w = [UInt32](repeating: 0, count: 64)
        for i in 0..<16 {
            w[i] = UInt32(block[i * 4]) << 24 | UInt32(block[i * 4 + 1]) << 16
                | UInt32(block[i * 4 + 2]) << 8 | UInt32(block[i * 4 + 3])
        }
        for i in 16..<64 {
            let s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >> 3)
            let s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >> 10)
            w[i] = w[i - 16] &+ s0 &+ w[i - 7] &+ s1
        }
        var (a, b, c, d, e, f, g, h) = (state[0], state[1], state[2], state[3], state[4], state[5], state[6], state[7])
        for i in 0..<64 {
            let s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
            let ch = (e & f) ^ (~e & g)
            let temp1 = h &+ s1 &+ ch &+ SHA256.k[i] &+ w[i]
            let s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
            let maj = (a & b) ^ (a & c) ^ (b & c)
            let temp2 = s0 &+ maj
            h = g; g = f; f = e; e = d &+ temp1
            d = c; c = b; b = a; a = temp1 &+ temp2
        }
        state[0] = state[0] &+ a; state[1] = state[1] &+ b
        state[2] = state[2] &+ c; state[3] = state[3] &+ d
        state[4] = state[4] &+ e; state[5] = state[5] &+ f
        state[6] = state[6] &+ g; state[7] = state[7] &+ h
    }

    private func rotr(_ x: UInt32, _ n: UInt32) -> UInt32 {
        (x >> n) | (x << (32 - n))
    }

    mutating func finalize() -> String {
        let bitLength = length * 8
        buffer.append(0x80)
        while buffer.count % 64 != 56 { buffer.append(0) }
        for i in stride(from: 56, through: 0, by: -8) {
            buffer.append(UInt8((bitLength >> i) & 0xff))
        }
        processFullBlocks()
        return state.map { String(format: "%08x", $0) }.joined()
    }
}
