/**
 * 原生桥接层
 *
 * 作用：让同一套 Web 代码在「浏览器」和「iOS 原生壳」里都能跑。
 *   - 浏览器（含 PWA）：走降级路径，使用 MediaRecorder 录音 + 现有模拟处理器
 *   - iOS App（WKWebView）：调用原生能力，录音走 AVAudioEngine、识别走 sherpa-onnx
 *
 * 通信协议：
 *   JS  -> Native: window.webkit.messageHandlers.yilu.postMessage({ type, requestId, payload })
 *   Native -> JS : window.YiluNative.receive('{"type","ok","payload","error"}')
 */

(function (global) {
  'use strict';

  var pending = {};      // requestId -> { resolve, reject }
  var listeners = {};    // eventName -> [handler]
  var seq = 0;

  function isNative() {
    return !!(
      global.webkit &&
      global.webkit.messageHandlers &&
      global.webkit.messageHandlers.yilu
    );
  }

  function nextId() {
    seq += 1;
    return 'req_' + Date.now() + '_' + seq;
  }

  /**
   * 调用原生方法
   * @param {string} type 方法名，见 BridgeMethod
   * @param {object} payload 参数
   * @param {number} timeout 超时毫秒
   * @returns {Promise<object>} payload
   */
  function call(type, payload, timeout) {
    if (!isNative()) {
      return Promise.reject(new Error('NOT_NATIVE'));
    }
    var requestId = nextId();
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        delete pending[requestId];
        reject(new Error('TIMEOUT: ' + type));
      }, timeout || 30000);

      pending[requestId] = {
        resolve: function (data) {
          clearTimeout(timer);
          resolve(data || {});
        },
        reject: function (err) {
          clearTimeout(timer);
          reject(new Error(err || 'NATIVE_ERROR'));
        }
      };

      try {
        global.webkit.messageHandlers.yilu.postMessage({
          type: type,
          requestId: requestId,
          payload: payload || {}
        });
      } catch (e) {
        clearTimeout(timer);
        delete pending[requestId];
        reject(e);
      }
    });
  }

  /** 分发原生回调 */
  function receive(jsonString) {
    var msg;
    try {
      msg = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    } catch (e) {
      console.error('[NativeBridge] 解析失败', e);
      return;
    }

    var requestId = msg.requestId;
    if (requestId && pending[requestId]) {
      var entry = pending[requestId];
      delete pending[requestId];
      if (msg.ok) {
        entry.resolve(msg.payload);
      } else {
        entry.reject(msg.error);
      }
      return;
    }

    // 无 requestId 的主动推送事件
    var handlers = listeners[msg.type] || [];
    handlers.forEach(function (fn) {
      try {
        fn(msg.payload, msg);
      } catch (e) {
        console.error('[NativeBridge] 事件处理异常', e);
      }
    });
  }

  /** 监听原生推送事件（如识别进度） */
  function on(event, handler) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(handler);
    return function () {
      listeners[event] = (listeners[event] || []).filter(function (f) {
        return f !== handler;
      });
    };
  }

  // ---- 语义化封装 ----

  var NativeBridge = {
    isNative: isNative,
    call: call,
    on: on,
    receive: receive,

    /** App 信息（平台、引擎是否就绪） */
    appInfo: function () {
      return call('app.info', {}, 5000);
    },

    /** 确保离线识别模型已就绪；progress: 0~1 */
    prepareEngine: function () {
      return call('engine.prepare', {}, 600000);
    },

    engineStatus: function () {
      return call('engine.status', {}, 5000);
    },

    /** 开始录音（原生） */
    startRecording: function () {
      return call('asr.start', {}, 10000);
    },

    /**
     * 停止录音并转写
     * @returns {Promise<{text:string, duration:number, rtf:number, corrected:boolean}>}
     */
    stopAndTranscribe: function () {
      return call('asr.stop', {}, 180000);
    },

    cancelRecording: function () {
      return call('asr.cancel', {}, 10000);
    },

    micPermission: function () {
      return call('permission.mic', {}, 10000);
    },

    /** 键值存储（原生 SQLite 后端） */
    storeGet: function (key) {
      return call('store.get', { key: key }, 5000).then(function (r) {
        return r.value;
      });
    },

    storeSet: function (key, value) {
      return call('store.set', { key: key, value: value }, 5000);
    },

    /** 导出全部数据（调试/迁移用） */
    storeExport: function () {
      return call('store.export', {}, 15000);
    }
  };

  global.NativeBridge = NativeBridge;

  // 供原生调用的入口
  global.YiluNative = global.YiluNative || {};
  global.YiluNative.receive = receive;

  if (isNative()) {
    console.log('[NativeBridge] 原生环境已就绪');
  }
})(window);
