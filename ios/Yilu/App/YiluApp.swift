//
//  YiluApp.swift
//  医录 Yilu
//
//  App 入口。
//
//  当前阶段：原生壳 + WebView 复用现有 Web UI，
//  原生只提供「录音 + 离线识别 + 本地数据库」三块能力。
//  UI 逐步原生化时，WebViewContainer 可与 SwiftUI 页面并存切换。
//

import SwiftUI

@main
struct YiluApp: App {

    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.didReceiveMemoryWarningNotification)) { _ in
                    // 内存紧张时释放模型，优先保住 App 不被杀
                    appState.releaseEngineOnMemoryPressure()
                }
        }
    }
}

// MARK: - 根视图

struct RootView: View {

    @EnvironmentObject private var appState: AppState

    var body: some View {
        ZStack(alignment: .top) {
            WebViewContainer(handler: appState.bridgeHandler)
                .ignoresSafeArea(edges: .bottom)

            // 引擎准备状态条（首次下载模型时展示）
            if case .loading(let progress) = appState.engineState {
                ModelLoadingBar(progress: progress, name: appState.asrService.displayName)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.easeInOut, value: appState.progressValue)
        .task {
            // 启动即准备模型：已下载则秒开，未下载则进入下载态
            await appState.prepareEngineIfNeeded()
        }
    }
}

// MARK: - 模型加载进度条

struct ModelLoadingBar: View {
    let progress: Float
    let name: String

    var body: some View {
        VStack(spacing: 6) {
            Text("正在准备离线识别模型")
                .font(.caption)
                .foregroundStyle(.secondary)
            ProgressView(value: progress)
                .progressViewStyle(.linear)
            Text("\(name) · \(Int(progress * 100))%")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal, 16)
    }
}

// MARK: - 应用状态

@MainActor
final class AppState: ObservableObject {

    let asrService: ASRService
    let bridgeHandler: BridgeHandler

    @Published private(set) var engineState: EngineState = .idle

    var progressValue: Double {
        if case .loading(let p) = engineState { return Double(p) }
        return 0
    }

    init() {
        let asr = ASRService(modelSpec: ASRModelCatalog.default, numThreads: 2)
        self.asrService = asr
        self.bridgeHandler = BridgeHandler(asr: asr)
        SelfTest.reset()
    }

    func prepareEngineIfNeeded() async {
        guard engineState == .idle else { return }
        do {
            try await asrService.prepare { [weak self] progress in
                Task { @MainActor in
                    self?.engineState = .loading(progress: progress)
                }
            }
            engineState = .ready
            SelfTest.run(asr: asrService)
        } catch {
            engineState = .failed(error)
        }
    }

    func releaseEngineOnMemoryPressure() {
        asrService.unload()
        engineState = .idle
    }
}
