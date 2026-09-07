//
//  ASRModels.swift
//  医录 Yilu
//
//  离线语音识别模型规格。
//  下载地址同时给出官方源与镜像源，ModelManager 会按顺序尝试。
//
//  体积说明（实测 2026-09）：
//    SenseVoice-Small int8 : ~228 MB
//    Paraformer-zh int8    : ~232 MB
//  两者都超过 App Store「蜂窝网络下载」阈值，务必走按需下载 + 明确的用户提示。
//

import Foundation

public enum ASRModelCatalog {

    private static func urls(_ repo: String, _ file: String) -> [URL] {
        // 国内镜像优先（实测 HuggingFace 官方源在部分网络下不可达）
        [
            URL(string: "https://hf-mirror.com/\(repo)/resolve/main/\(file)")!,
            URL(string: "https://huggingface.co/\(repo)/resolve/main/\(file)")!,
        ]
    }

    // MARK: - SenseVoice-Small（首选）

    public static let senseVoice = ModelSpec(
        id: "sense-voice-zh",
        name: "SenseVoice-Small（中文，int8）",
        version: 1,
        files: [
            ModelFile(
                relativePath: "model.int8.onnx",
                urls: urls("csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17", "model.int8.onnx"),
                sha256: nil,
                size: 239_233_841
            ),
            ModelFile(
                relativePath: "tokens.txt",
                urls: urls("csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17", "tokens.txt"),
                sha256: nil,
                size: 315_894
            ),
        ],
        estimatedSize: 239_549_735
    )

    // MARK: - Paraformer（备选，字错率更稳但无 ITN，数字会转成中文）

    public static let paraformer = ModelSpec(
        id: "paraformer-zh",
        name: "Paraformer 中文（int8）",
        version: 1,
        files: [
            ModelFile(
                relativePath: "model.int8.onnx",
                urls: urls("csukuangfj/sherpa-onnx-paraformer-zh-2023-09-14", "model.int8.onnx"),
                sha256: nil,
                size: 243_371_218
            ),
            ModelFile(
                relativePath: "tokens.txt",
                urls: urls("csukuangfj/sherpa-onnx-paraformer-zh-2023-09-14", "tokens.txt"),
                sha256: nil,
                size: 75_756
            ),
        ],
        estimatedSize: 243_446_974
    )

    /// 默认模型
    public static var `default`: ModelSpec { senseVoice }

    /// 全部可选模型
    public static var all: [ModelSpec] { [senseVoice, paraformer] }

    /// 同音字替换词典（医疗术语增强，可选）
    /// 文件不存在时自动跳过，不影响主流程。
    public static let homophoneReplacer = ModelSpec(
        id: "medical-hr",
        name: "医疗术语同音字替换词典",
        version: 1,
        files: [
            ModelFile(
                relativePath: "lexicon.txt",
                urls: [],   // 随 App 内置，无需下载
                sha256: nil,
                size: 0
            )
        ],
        estimatedSize: 0,
        required: false
    )
}
