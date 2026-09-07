//
//  MedicalTermCorrector.swift
//  医录 Yilu
//
//  医疗术语纠错（术语增强的第三层）。
//
//  通用 ASR 对「阿莫西林克拉维酸钾」「头孢克肟」这类长尾药名天然识别率低，
//  典型错误是同音字替换（如「头孢克洛」→「头包克洛」）。
//  本模块用词典 + 编辑距离做后处理纠错：
//    1. 词典来自 Bundle 内的 medical_terms.txt（与 asr-poc 共用同一份）
//    2. 对识别文本滑动窗口取候选片段，与词典词比较
//    3. 长度 >= 3 且编辑距离 == 1 时视为同音/形近误识，替换为词典词
//
//  注意：只做高置信替换（距离 1、长度 >= 3），宁可漏纠也不错纠——
//  医嘱场景下「纠错改错」的代价远大于「未纠错」。
//

import Foundation

public final class MedicalTermCorrector: @unchecked Sendable {

    public static let shared = MedicalTermCorrector()

    private let lock = NSLock()
    private var terms: [String] = []
    /// 按长度分组，缩小比较范围
    private var grouped: [Int: [String]] = [:]

    private init() {
        load()
    }

    // MARK: 词典加载

    /// 从 App Bundle 加载词典；找不到时使用内置兜底词表
    public func load() {
        var loaded: [String] = []
        if let url = Bundle.main.url(forResource: "medical_terms", withExtension: "txt") {
            let content = (try? String(contentsOf: url, encoding: .utf8)) ?? ""
            loaded = content.split(separator: "\n")
                .map { String($0).trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty && !$0.hasPrefix("#") }
        }
        if loaded.isEmpty {
            loaded = Self.fallbackTerms
        }
        lock.withLock {
            terms = loaded
            grouped = Dictionary(grouping: loaded) { $0.count }
        }
    }

    /// 追加自定义词（如用户常去的医院、孩子常吃的药）
    public func addTerms(_ newTerms: [String]) {
        lock.withLock {
            let existing = Set(terms)
            let unique = newTerms
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty && !existing.contains($0) }
            terms.append(contentsOf: unique)
            grouped = Dictionary(grouping: terms) { $0.count }
        }
    }

    public var termCount: Int { lock.withLock { terms.count } }

    // MARK: 纠错

    /// 纠错主入口
    /// - Returns: (纠错后的文本, 是否发生过替换)
    public func correct(_ text: String) -> (String, Bool) {
        guard !text.isEmpty else { return (text, false) }
        var chars = Array(text)
        var changed = false

        let minLen = 3
        for length in minLen...8 {
            var index = 0
            while index + length <= chars.count {
                let candidate = String(chars[index..<(index + length)])
                if let matched = bestMatch(for: candidate) {
                    let replacement = Array(matched)
                    chars.replaceSubrange(index..<(index + length), with: replacement)
                    changed = true
                    index += replacement.count
                    continue
                }
                index += 1
            }
        }
        return (String(chars), changed)
    }

    /// 在词典中寻找与候选片段最接近的词（编辑距离 <= 1 才采纳）
    private func bestMatch(for candidate: String) -> String? {
        let n = candidate.count
        guard n >= 3 else { return nil }

        let pool = lock.withLock { grouped[n] ?? [] }
        for term in pool where editDistance(candidate, term) == 1 {
            return term
        }
        // 长度相差 1 的情况（多字/漏字），只在长度 >= 4 时处理，避免误伤
        if n >= 4 {
            for delta in [-1, 1] {
                let pool = lock.withLock { grouped[n + delta] ?? [] }
                for term in pool where editDistance(candidate, term) == 1 {
                    return term
                }
            }
        }
        return nil
    }

    /// 编辑距离（字符级，滚动数组）
    private func editDistance(_ a: String, _ b: String) -> Int {
        let s = Array(a), t = Array(b)
        if s == t { return 0 }
        if s.isEmpty { return t.count }
        if t.isEmpty { return s.count }
        var prev = Array(0...t.count)
        for (i, sc) in s.enumerated() {
            var cur = [i + 1]
            for (j, tc) in t.enumerated() {
                let cost = sc == tc ? 0 : 1
                cur.append(min(prev[j] + cost, cur[j] + 1, prev[j + 1] + 1))
            }
            prev = cur
        }
        return prev[t.count]
    }

    // MARK: 兜底词典

    /// 内置兜底：即便忘了拷资源文件，核心儿童用药仍能纠
    private static let fallbackTerms: [String] = [
        "急性扁桃体炎", "急性支气管炎", "支气管肺炎", "手足口病", "疱疹性咽峡炎",
        "过敏性鼻炎", "中耳炎", "热性惊厥", "幼儿急疹",
        "阿莫西林", "阿莫西林克拉维酸钾", "头孢克洛", "头孢克肟", "阿奇霉素",
        "布洛芬", "对乙酰氨基酚", "孟鲁司特钠", "西替利嗪", "氯雷他定",
        "奥司他韦", "蒙脱石散", "口服补液盐", "氨溴特罗",
        "血常规", "雾化吸入", "静脉输液", "皮试", "复诊",
    ]
}
