/**
 * Recorder.js - 音频录制模块
 * 基于 MediaRecorder API 实现录音功能
 */

const Recorder = {
  mediaRecorder: null,
  audioChunks: [],
  stream: null,
  audioContext: null,
  analyser: null,
  animationId: null,
  startTime: 0,
  timerInterval: null,
  isRecording: false,

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];

      // Try to use a widely supported mimeType
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      this.mediaRecorder = mimeType
        ? new MediaRecorder(this.stream, { mimeType })
        : new MediaRecorder(this.stream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      // Set up audio analyser for waveform visualization
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      this.mediaRecorder.start();
      this.isRecording = true;
      this.startTime = Date.now();

      this._startTimer();
      this._startWaveform();

      return true;
    } catch (e) {
      console.error('Recorder start error:', e);
      throw e;
    }
  },

  stop() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.isRecording) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const duration = Math.floor((Date.now() - this.startTime) / 1000);

        this._cleanup();

        resolve({
          blob: audioBlob,
          duration: duration,
          url: URL.createObjectURL(audioBlob),
        });
      };

      this.mediaRecorder.stop();
      this.isRecording = false;
    });
  },

  cancel() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
    this._cleanup();
  },

  _cleanup() {
    this._stopTimer();
    this._stopWaveform();

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  },

  _startTimer() {
    const update = () => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const secs = String(elapsed % 60).padStart(2, '0');
      const timerEl = document.getElementById('record-timer');
      if (timerEl) {
        timerEl.textContent = `${mins}:${secs}`;
      }
    };
    update();
    this.timerInterval = setInterval(update, 1000);
  },

  _stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  _startWaveform() {
    const container = document.getElementById('waveform-bars');
    if (!container || !this.analyser) return;

    const barCount = 32;
    container.innerHTML = '';
    const bars = [];
    for (let i = 0; i < barCount; i++) {
      const bar = document.createElement('div');
      bar.className = 'waveform-bar';
      bar.style.height = '8px';
      container.appendChild(bar);
      bars.push(bar);
    }

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const animate = () => {
      if (!this.isRecording) return;
      this.analyser.getByteFrequencyData(dataArray);

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i] || 0;
        const height = Math.max(4, (value / 255) * 36);
        bars[i].style.height = height + 'px';
      }

      this.animationId = requestAnimationFrame(animate);
    };
    animate();
  },

  _stopWaveform() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  },

  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  },
};
