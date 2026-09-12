//
//  AudioSchemeHandler.swift
//  医录 Yilu
//
//  让 WKWebView 能播放原生 AVAudioEngine 落盘的录音 wav。
//
//  背景：原生录音写在 Database.attachmentsDirectory/<name>.wav，而 Web 资源在 App Bundle 内，
//  二者不在同一目录树，WKWebView 的 file:// 读权限（loadFileURL 的 allowingReadAccessTo）
//  无法同时覆盖两边；直接把文件 base64 塞进桥消息又会因录音较长而撑爆 postMessage。
//  因此注册一个自定义 scheme：桥返回 "yilu-local://<name>.wav"，<audio> 加载该地址即触发本
//  handler 从附件目录读文件并以 audio/wav 返回，支持 Range 以便拖动进度。
//

import Foundation
import WebKit

public final class AudioSchemeHandler: NSObject, WKURLSchemeHandler {

    private let allowedDir: URL

    public init(attachmentsDir: URL) {
        self.allowedDir = attachmentsDir
    }

    // MARK: WKURLSchemeHandler

    public func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url, url.scheme == "yilu-local" else {
            urlSchemeTask.didFailWithError(NSError(domain: "AudioScheme", code: 400,
                userInfo: [NSLocalizedDescriptionKey: "非法音频地址"]))
            return
        }

        // yilu-local://rec-123.wav -> host = "rec-123.wav"（path 为空）
        let name: String
        if let host = url.host, !host.isEmpty {
            name = host
        } else {
            name = String(url.path.dropFirst()).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        }
        guard !name.isEmpty, !name.contains("/"), !name.hasPrefix(".") else {
            urlSchemeTask.didFailWithError(NSError(domain: "AudioScheme", code: 400,
                userInfo: [NSLocalizedDescriptionKey: "非法音频文件名"]))
            return
        }

        let fileURL = allowedDir.appendingPathComponent(name)
        // 防目录穿越：最终路径必须仍位于附件目录内
        guard fileURL.resolvingSymlinksInPath().deletingLastPathComponent()
                == allowedDir.resolvingSymlinksInPath(),
              FileManager.default.fileExists(atPath: fileURL.path) else {
            urlSchemeTask.didFailWithError(NSError(domain: "AudioScheme", code: 404,
                userInfo: [NSLocalizedDescriptionKey: "录音文件不存在"]))
            return
        }

        do {
            let data = try Data(contentsOf: fileURL)
            let (status, headers, body) = Self.slice(data: data, request: urlSchemeTask.request)
            if let response = HTTPURLResponse(
                url: url, statusCode: status, httpVersion: nil, headerFields: headers) {
                urlSchemeTask.didReceive(response)
            }
            urlSchemeTask.didReceive(body)
            urlSchemeTask.didFinish()
        } catch {
            urlSchemeTask.didFailWithError(error)
        }
    }

    public func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // 短音频整段返回，忽略取消即可
    }

    // MARK: 支持 Range 请求（Safari 播放常带 bytes=0-）

    private static func slice(data: Data, request: URLRequest) -> (Int, [String: String], Data) {
        let mime = "audio/wav"
        let total = data.count
        var headers: [String: String] = [
            "Content-Type": mime,
            "Accept-Ranges": "bytes",
            "Content-Length": "\(total)",
        ]

        guard let rangeHeader = request.value(forHTTPHeaderField: "Range") else {
            return (200, headers, data)
        }

        let trimmed = rangeHeader.trimmingCharacters(in: .whitespaces)
        let body = trimmed.hasPrefix("bytes=") ? String(trimmed.dropFirst("bytes=".count)) : trimmed
        let parts = body.split(separator: "-", maxSplits: 1).map(String.init)
        guard parts.count >= 1, let start = Int(parts[0]), start < total else {
            return (200, headers, data)
        }

        var end = total - 1
        if parts.count > 1, !parts[1].isEmpty, let e = Int(parts[1]) {
            end = min(e, total - 1)
        }

        let sub = data.subdata(in: start..<(end + 1))
        headers["Content-Length"] = "\(sub.count)"
        headers["Content-Range"] = "bytes \(start)-\(end)/\(total)"
        return (206, headers, sub)
    }
}
