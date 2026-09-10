//
//  WebViewContainer.swift
//  医录 Yilu
//
//  WKWebView 封装：加载本地 Web 资源 + 注册 JS 桥。
//
//  资源加载策略：
//    - App Bundle 内置一份 index.html/css/js（构建脚本从仓库根目录同步）
//    - 通过 loadFileURL 加载，允许跨域读取本地文件
//    - 调试阶段可用 YiluDebug.remoteURL 指向本地开发服务器（http://localhost:9123）
//

import SwiftUI
import WebKit

public struct WebViewContainer: UIViewRepresentable {

    /// 原生桥处理器（持有 ASR 等能力）
    let handler: BridgeHandler

    public init(handler: BridgeHandler) {
        self.handler = handler
    }

    public func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let contentController = WKUserContentController()
        // JS 通过 window.webkit.messageHandlers.yilu 调用原生
        contentController.add(context.coordinator, name: "yilu")
        config.userContentController = contentController

        // 允许通过 file:// 加载本地 js/css
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.bounces = false
        webView.isOpaque = false
        webView.backgroundColor = UIColor.systemBackground

        // 原生 -> JS 的回调入口
        handler.send = { json in
            let escaped = json.replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "'", with: "\\'")
                .replacingOccurrences(of: "\n", with: "\\n")
            let script = "window.YiluNative && window.YiluNative.receive('\(escaped)');"
            DispatchQueue.main.async {
                webView.evaluateJavaScript(script, completionHandler: nil)
            }
        }

        loadContent(into: webView)
        return webView
    }

    public func updateUIView(_ webView: WKWebView, context: Context) {
        // 暂无需增量更新
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator(handler: handler)
    }

    // MARK: 内容加载

    private func loadContent(into webView: WKWebView) {
        #if DEBUG
        if let remote = ProcessInfo.processInfo.environment["YILU_REMOTE_URL"],
           let url = URL(string: remote) {
            webView.load(URLRequest(url: url))
            return
        }
        #endif

        guard let root = Self.locateIndexHTML() else {
            let html = "<h2 style='font-family:-apple-system'>未找到 Web 资源</h2>"
            webView.loadHTMLString(html, baseURL: nil)
            return
        }
        // 允许读取同目录及子目录（css/ js/）资源
        webView.loadFileURL(root, allowingReadAccessTo: root.deletingLastPathComponent())
    }

    /// 定位内置 index.html。
    /// 注意：Bundle.url(forResource:) 的 name 不支持 "web/index" 这种带斜杠的写法，
    /// 必须用 subdirectory 参数。这里按多种资源布局依次尝试，避免工程配置变更时静默失败。
    private static func locateIndexHTML() -> URL? {
        let subdirs = ["Resources/web", "web", nil]
        for subdir in subdirs {
            if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: subdir) {
                return url
            }
        }
        return Bundle.main.url(forResource: "index", withExtension: "html")
    }

    // MARK: 协调器

    public final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        private let handler: BridgeHandler

        init(handler: BridgeHandler) {
            self.handler = handler
        }

        public func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            handler.handle(message.body)
        }

        public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // 通知 Web 端：原生环境已就绪
            handler.send?("{\"type\":\"app.ready\",\"ok\":true,\"payload\":{\"platform\":\"ios\"}}")
            #if DEBUG
            webView.evaluateJavaScript("document.title + '|' + (window.NativeBridge ? 'bridge-ok' : 'bridge-missing') + '|' + location.href") { result, error in
                SelfTest.note("0/5 WebView 加载: \(result as? String ?? "?") error=\(error?.localizedDescription ?? "无")")
            }
            #endif
        }
    }
}
