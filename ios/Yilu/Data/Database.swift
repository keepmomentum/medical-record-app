//
//  Database.swift
//  医录 Yilu
//
//  本地数据层（SQLite）。
//
//  为什么必须替换 Web 端的 localStorage：
//    WKWebView 的 localStorage 存放在 WebKit 数据目录，iOS 磁盘紧张时会被系统清理，
//    病历属于不可丢失数据，必须落到 App 自己管理的 SQLite 中。
//
//  表结构设计原则：与 Web 端 Store 的 JSON 结构保持 1:1，
//  payload 列直接存 JSON 字符串，迁移时无需字段映射。
//

import Foundation
import SQLite3

// MARK: - 错误

public enum DatabaseError: LocalizedError {
    case openFailed(String)
    case prepareFailed(String)
    case execFailed(String)

    public var errorDescription: String? {
        switch self {
        case .openFailed(let m): return "数据库打开失败：\(m)"
        case .prepareFailed(let m): return "SQL 预编译失败：\(m)"
        case .execFailed(let m): return "SQL 执行失败：\(m)"
        }
    }
}

// MARK: - 数据库

public final class Database: @unchecked Sendable {

    public static let shared = Database()

    private var db: OpaquePointer?
    private let queue = DispatchQueue(label: "com.yilu.db", qos: .utility)

    /// 数据文件路径（Application Support，参与 iCloud 备份）
    public let fileURL: URL

    private init() {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        self.fileURL = appSupport.appendingPathComponent("yilu.sqlite3")
        do {
            try open()
            try migrate()
        } catch {
            print("[Database] 初始化失败: \(error)")
        }
    }

    deinit {
        if let db { sqlite3_close(db) }
    }

    // MARK: 初始化

    private func open() throws {
        var handle: OpaquePointer?
        let flags = SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX
        guard sqlite3_open_v2(fileURL.path, &handle, flags, nil) == SQLITE_OK, let handle else {
            throw DatabaseError.openFailed(String(cString: sqlite3_errmsg(handle)))
        }
        self.db = handle
        try exec("PRAGMA journal_mode = WAL;")
        try exec("PRAGMA foreign_keys = ON;")
    }

    private func migrate() throws {
        // 记录表：与 Web 端 Store 的五个集合一一对应
        try exec("""
            CREATE TABLE IF NOT EXISTS records (
                id          TEXT NOT NULL,
                collection  TEXT NOT NULL,
                patient_id  TEXT,
                payload     TEXT NOT NULL,
                updated_at  REAL NOT NULL,
                PRIMARY KEY (collection, id)
            );
            """)
        try exec("CREATE INDEX IF NOT EXISTS idx_records_collection ON records(collection);")
        try exec("CREATE INDEX IF NOT EXISTS idx_records_patient ON records(patient_id);")

        // 键值表：存放 settings 等单值数据
        try exec("""
            CREATE TABLE IF NOT EXISTS kv (
                key        TEXT PRIMARY KEY,
                value      TEXT NOT NULL,
                updated_at REAL NOT NULL
            );
            """)

        // 音频 / 病例图片等附件
        try exec("""
            CREATE TABLE IF NOT EXISTS attachments (
                id          TEXT PRIMARY KEY,
                record_id   TEXT,
                kind        TEXT NOT NULL,
                file_path   TEXT NOT NULL,
                created_at  REAL NOT NULL
            );
            """)
    }

    // MARK: 基础执行

    private func exec(_ sql: String) throws {
        guard let db else { throw DatabaseError.openFailed("句柄为空") }
        if sqlite3_exec(db, sql, nil, nil, nil) != SQLITE_OK {
            throw DatabaseError.execFailed(String(cString: sqlite3_errmsg(db)))
        }
    }

    // MARK: 记录操作

    /// 写入或更新一条记录
    public func upsert(collection: String, id: String, patientId: String?, payload: [String: Any]) throws {
        let data = try JSONSerialization.data(withJSONObject: payload)
        let json = String(data: data, encoding: .utf8) ?? "{}"
        let sql = """
            INSERT INTO records (id, collection, patient_id, payload, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(collection, id) DO UPDATE SET
                patient_id = excluded.patient_id,
                payload = excluded.payload,
                updated_at = excluded.updated_at;
            """
        try queue.sync {
            var stmt: OpaquePointer?
            guard let db, sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw DatabaseError.prepareFailed(String(cString: sqlite3_errmsg(db)))
            }
            defer { sqlite3_finalize(stmt) }
            sqlite3_bind_text(stmt, 1, (id as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 2, (collection as NSString).utf8String, -1, nil)
            if let patientId {
                sqlite3_bind_text(stmt, 3, (patientId as NSString).utf8String, -1, nil)
            } else {
                sqlite3_bind_null(stmt, 3)
            }
            sqlite3_bind_text(stmt, 4, (json as NSString).utf8String, -1, nil)
            sqlite3_bind_double(stmt, 5, Date().timeIntervalSince1970)

            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw DatabaseError.execFailed(String(cString: sqlite3_errmsg(db)))
            }
        }
    }

    /// 读取一个集合的全部记录
    public func all(collection: String, patientId: String? = nil) throws -> [[String: Any]] {
        try queue.sync {
            var sql = "SELECT payload FROM records WHERE collection = ?"
            if patientId != nil { sql += " AND patient_id = ?" }
            sql += " ORDER BY updated_at DESC;"

            guard let db else { throw DatabaseError.openFailed("句柄为空") }
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw DatabaseError.prepareFailed(String(cString: sqlite3_errmsg(db)))
            }
            defer { sqlite3_finalize(stmt) }
            sqlite3_bind_text(stmt, 1, (collection as NSString).utf8String, -1, nil)
            if let patientId {
                sqlite3_bind_text(stmt, 2, (patientId as NSString).utf8String, -1, nil)
            }

            var result: [[String: Any]] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                guard let cString = sqlite3_column_text(stmt, 0) else { continue }
                let json = String(cString: cString)
                guard let data = json.data(using: .utf8),
                      let object = try? JSONSerialization.jsonObject(with: data),
                      let dict = object as? [String: Any] else { continue }
                result.append(dict)
            }
            return result
        }
    }

    public func delete(collection: String, id: String) throws {
        let sql = "DELETE FROM records WHERE collection = ? AND id = ?;"
        try queue.sync {
            guard let db else { throw DatabaseError.openFailed("句柄为空") }
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw DatabaseError.prepareFailed(String(cString: sqlite3_errmsg(db)))
            }
            defer { sqlite3_finalize(stmt) }
            sqlite3_bind_text(stmt, 1, (collection as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 2, (id as NSString).utf8String, -1, nil)
            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw DatabaseError.execFailed(String(cString: sqlite3_errmsg(db)))
            }
        }
    }

    // MARK: 键值

    public func setValue(_ value: String, for key: String) throws {
        let sql = """
            INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
            """
        try queue.sync {
            guard let db else { throw DatabaseError.openFailed("句柄为空") }
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw DatabaseError.prepareFailed(String(cString: sqlite3_errmsg(db)))
            }
            defer { sqlite3_finalize(stmt) }
            sqlite3_bind_text(stmt, 1, (key as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 2, (value as NSString).utf8String, -1, nil)
            sqlite3_bind_double(stmt, 3, Date().timeIntervalSince1970)
            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw DatabaseError.execFailed(String(cString: sqlite3_errmsg(db)))
            }
        }
    }

    public func value(for key: String) throws -> String? {
        try queue.sync {
            guard let db else { throw DatabaseError.openFailed("句柄为空") }
            var stmt: OpaquePointer?
            let sql = "SELECT value FROM kv WHERE key = ?;"
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw DatabaseError.prepareFailed(String(cString: sqlite3_errmsg(db)))
            }
            defer { sqlite3_finalize(stmt) }
            sqlite3_bind_text(stmt, 1, (key as NSString).utf8String, -1, nil)
            if sqlite3_step(stmt) == SQLITE_ROW, let cString = sqlite3_column_text(stmt, 0) {
                return String(cString: cString)
            }
            return nil
        }
    }

    // MARK: 附件

    public func saveAttachment(id: String, recordId: String?, kind: String, at path: String) throws {
        let sql = """
            INSERT INTO attachments (id, record_id, kind, file_path, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET file_path = excluded.file_path;
            """
        try queue.sync {
            guard let db else { throw DatabaseError.openFailed("句柄为空") }
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw DatabaseError.prepareFailed(String(cString: sqlite3_errmsg(db)))
            }
            defer { sqlite3_finalize(stmt) }
            sqlite3_bind_text(stmt, 1, (id as NSString).utf8String, -1, nil)
            if let recordId {
                sqlite3_bind_text(stmt, 2, (recordId as NSString).utf8String, -1, nil)
            } else {
                sqlite3_bind_null(stmt, 2)
            }
            sqlite3_bind_text(stmt, 3, (kind as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 4, (path as NSString).utf8String, -1, nil)
            sqlite3_bind_double(stmt, 5, Date().timeIntervalSince1970)
            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw DatabaseError.execFailed(String(cString: sqlite3_errmsg(db)))
            }
        }
    }

    /// 附件目录（音频、病例图片）
    public static var attachmentsDirectory: URL {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = appSupport.appendingPathComponent("attachments", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }
}
