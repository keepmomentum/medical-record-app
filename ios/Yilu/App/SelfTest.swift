//
//  SelfTest.swift
//  医录 Yilu
//
//  DEBUG 专用的端到端自检：启动后自动验证真机上最关键、模拟器测不了的链路——
//    1. 模型文件就绪（Application Support/models，devicectl 推送的 228MB）
//    2. sherpa-onnx 识别器创建（真实加载 228MB 模型进内存）
//    3. 离线转写（解码内置 selftest.wav，打印识别文本与 RTF）
//    4. 医疗术语纠错器
//    5. SQLite 键值存储读写
//
//  结果通过 NSLog 输出，可用以下命令观察：
//    xcrun devicectl device process launch --device <UDID> --console com.yilu.asr
//
//  Release 编译时整个文件为空实现，零开销。
//

import Foundation

enum SelfTest {

    private static let tag = "[SelfTest]"

    /// 结果同时写 NSLog 与 Documents/selftest_result.txt
    /// （devicectl --console 抓不到统一日志，文件可用 devicectl copy from 回读）
    private static var reportFile: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("selftest_result.txt")
    }

    private static func log(_ message: String) {
        #if DEBUG
        NSLog("%@ %@", tag, message)
        let line = "\(message)\n"
        if let data = line.data(using: .utf8) {
            if let handle = try? FileHandle(forWritingTo: reportFile) {
                handle.seekToEndOfFile()
                handle.write(data)
                try? handle.close()
            } else {
                try? data.write(to: reportFile)
            }
        }
        #endif
    }

    /// 供其他模块（如 WebView 加载回调）追加报告行
    static func note(_ message: String) {
        log(message)
    }

    /// 清空上一轮报告（App 启动时调用一次）
    static func reset() {
        #if DEBUG
        try? FileManager.default.removeItem(at: reportFile)
        #endif
    }

    /// 在引擎 prepare 完成后调用。全部异步执行，不阻塞 UI。
    static func run(asr: ASRService) {
        #if DEBUG
        Task {
            log("===== 开始 =====")

            // 1. 模型就绪
            let ready = ModelManager.shared.isReady(asr.modelSpec)
            let dir = ModelManager.shared.directory(for: asr.modelSpec)
            log("1/5 模型就绪: \(ready ? "✅" : "❌")  目录: \(dir.lastPathComponent)")

            // 2. 识别器状态（prepare 已由 AppState 完成）
            let stateOK = asr.state == .ready
            log("2/5 识别器加载: \(stateOK ? "✅" : "❌ state=\(asr.state)")")
            guard stateOK else {
                log("===== 中止：引擎未就绪 =====")
                return
            }

            // 3. 离线转写
            guard let wavURL = Bundle.main.url(forResource: "selftest", withExtension: "wav") else {
                log("3/5 转写: ❌ 找不到内置 selftest.wav")
                return
            }
            do {
                let result = try await asr.transcribe(wavURL: wavURL)
                log(String(format: "3/5 转写: ✅ 耗时 %.2fs / 音频 %.2fs / RTF %.3f / 纠错 %@",
                           result.elapsed, result.duration, result.rtf,
                           result.corrected ? "已触发" : "未触发"))
                log("    识别文本: \(result.text.isEmpty ? "（空）" : result.text)")
            } catch {
                log("3/5 转写: ❌ \(error.localizedDescription)")
            }

            // 4. 术语纠错器
            let (fixed, _) = MedicalTermCorrector.shared.correct("头胞克肟")
            log("4/5 术语纠错: \(MedicalTermCorrector.shared.termCount > 0 ? "✅" : "❌") 词表 \(MedicalTermCorrector.shared.termCount) 条（头胞克肟 -> \(fixed)）")

            // 5. SQLite 读写
            do {
                let probe = "selftest-\(Int(Date().timeIntervalSince1970))"
                try Database.shared.setValue(probe, for: "_selftest")
                let readBack = try Database.shared.value(for: "_selftest")
                try Database.shared.setValue("", for: "_selftest")
                log("5/5 SQLite 读写: \(readBack == probe ? "✅" : "❌ 回读不符")")
            } catch {
                log("5/5 SQLite 读写: ❌ \(error.localizedDescription)")
            }

            log("===== 结束 =====")
        }
        #endif
    }
}
