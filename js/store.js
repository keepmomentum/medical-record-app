/**
 * Store.js - 数据持久化层
 * 基于 localStorage 的本地数据存储
 */

const Store = {
  KEYS: {
    PATIENTS: 'yilu_patients',
    VISITS: 'yilu_visits',
    REMINDERS: 'yilu_reminders',
    SETTINGS: 'yilu_settings',
    TEMP_RECORDS: 'yilu_temp_records',
  },

  _read(key, defaultValue = []) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch (e) {
      console.error('Store read error:', key, e);
      return defaultValue;
    }
  },

  _write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      this._scheduleNativeSync();
      return true;
    } catch (e) {
      console.error('Store write error:', key, e);
      return false;
    }
  },

  // ===== 原生端数据保护 =====
  //
  // iOS 上 WKWebView 的 localStorage 位于 WebKit 数据目录，
  // 系统在磁盘紧张时会清理它——病历属于不可丢失数据。
  // 因此每次写入后节流同步一份全量快照到原生 SQLite 兜底。

  _nativeSyncTimer: null,

  _scheduleNativeSync() {
    if (!window.NativeBridge || !window.NativeBridge.isNative()) return;
    if (this._nativeSyncTimer) clearTimeout(this._nativeSyncTimer);
    this._nativeSyncTimer = setTimeout(() => this.syncToNative(), 2000);
  },

  /** 全量快照写入原生存储 */
  async syncToNative() {
    if (!window.NativeBridge || !window.NativeBridge.isNative()) return false;
    try {
      const snapshot = {
        version: 1,
        syncedAt: new Date().toISOString(),
        patients: this.getPatients(),
        visits: this.getVisits(),
        reminders: this.getReminders(),
        tempRecords: this.getTempRecords(),
        settings: this.getSettings(),
      };
      await window.NativeBridge.storeSet('yilu_snapshot', JSON.stringify(snapshot));
      return true;
    } catch (e) {
      console.error('原生同步失败:', e);
      return false;
    }
  },

  /**
   * 启动恢复：本地无数据而原生存在快照时，从原生恢复
   * @returns {Promise<boolean>} 是否发生了恢复
   */
  async restoreFromNative() {
    if (!window.NativeBridge || !window.NativeBridge.isNative()) return false;
    try {
      const raw = await window.NativeBridge.storeGet('yilu_snapshot');
      if (!raw) return false;

      const hasLocal = localStorage.getItem(this.KEYS.PATIENTS)
        || localStorage.getItem(this.KEYS.VISITS);
      if (hasLocal) return false;

      const snap = JSON.parse(raw);
      if (!snap) return false;

      if (Array.isArray(snap.patients) && snap.patients.length) {
        localStorage.setItem(this.KEYS.PATIENTS, JSON.stringify(snap.patients));
      }
      if (Array.isArray(snap.visits) && snap.visits.length) {
        localStorage.setItem(this.KEYS.VISITS, JSON.stringify(snap.visits));
      }
      if (Array.isArray(snap.reminders)) {
        localStorage.setItem(this.KEYS.REMINDERS, JSON.stringify(snap.reminders));
      }
      if (Array.isArray(snap.tempRecords)) {
        localStorage.setItem(this.KEYS.TEMP_RECORDS, JSON.stringify(snap.tempRecords));
      }
      if (snap.settings) {
        localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(snap.settings));
      }
      return true;
    } catch (e) {
      console.error('原生恢复失败:', e);
      return false;
    }
  },

  _uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  },

  // --- Patients ---
  getPatients() {
    return this._read(this.KEYS.PATIENTS, []);
  },

  getPatient(id) {
    return this.getPatients().find(p => p.id === id);
  },

  addPatient(data) {
    const patients = this.getPatients();
    const patient = {
      id: this._uid(),
      name: data.name,
      gender: data.gender || 'unknown',
      birthDate: data.birthDate || '',
      avatarColor: data.avatarColor || (patients.length % 6) + 1,
      createdAt: new Date().toISOString(),
    };
    patients.push(patient);
    this._write(this.KEYS.PATIENTS, patients);
    return patient;
  },

  updatePatient(id, data) {
    const patients = this.getPatients();
    const idx = patients.findIndex(p => p.id === id);
    if (idx >= 0) {
      patients[idx] = { ...patients[idx], ...data };
      this._write(this.KEYS.PATIENTS, patients);
      return patients[idx];
    }
    return null;
  },

  deletePatient(id) {
    const patients = this.getPatients().filter(p => p.id !== id);
    this._write(this.KEYS.PATIENTS, patients);
    // Also delete related visits and reminders
    const visits = this.getVisits().filter(v => v.patientId !== id);
    this._write(this.KEYS.VISITS, visits);
    const reminders = this.getReminders().filter(r => r.patientId !== id);
    this._write(this.KEYS.REMINDERS, reminders);
  },

  // --- Visits ---
  getVisits() {
    return this._read(this.KEYS.VISITS, []);
  },

  getVisit(id) {
    return this.getVisits().find(v => v.id === id);
  },

  getVisitsByPatient(patientId) {
    return this.getVisits().filter(v => v.patientId === patientId)
      .sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
  },

  getAllVisitsSorted() {
    return this.getVisits().sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
  },

  addVisit(data) {
    const visits = this.getVisits();
    const visit = {
      id: this._uid(),
      patientId: data.patientId,
      visitDate: data.visitDate || new Date().toISOString(),
      hospital: data.hospital || '',
      department: data.department || '',
      doctorName: data.doctorName || '',
      diagnosis: data.diagnosis || '',
      recordingDuration: data.recordingDuration || 0,
      // Structured data
      cause: data.cause || '',
      symptoms: data.symptoms || [],
      medications: data.medications || [],
      care: data.care || [],
      recovery: data.recovery || [],
      precautions: data.precautions || [],
      observeSymptoms: data.observeSymptoms || [],
      prevention: data.prevention || [],
      followUp: data.followUp || { timing: '', conditions: [] },
      rawNotes: Array.isArray(data.rawNotes) ? data.rawNotes : [],
      transcript: data.transcript || '',
      source: data.source || 'demo',
      images: data.images || [],
      createdAt: new Date().toISOString(),
    };
    visits.push(visit);
    this._write(this.KEYS.VISITS, visits);

    // Auto-generate reminders from visit data
    this._generateReminders(visit);

    // 事后补关联：把就诊前在家观察期间录入的孤立体温归入本次生病周期
    this.lastLinkedTempCount = this.linkOrphanTempsToVisit(visit.id, { daysBefore: 7, daysAfter: 3 });

    return visit;
  },

  updateVisit(id, data) {
    const visits = this.getVisits();
    const idx = visits.findIndex(v => v.id === id);
    if (idx >= 0) {
      visits[idx] = { ...visits[idx], ...data, updatedAt: new Date().toISOString() };
      this._write(this.KEYS.VISITS, visits);
      return visits[idx];
    }
    return null;
  },

  deleteVisit(id) {
    const visits = this.getVisits().filter(v => v.id !== id);
    this._write(this.KEYS.VISITS, visits);
    const reminders = this.getReminders().filter(r => r.visitId !== id);
    this._write(this.KEYS.REMINDERS, reminders);
  },

  // --- Visit Images ---
  addVisitImage(visitId, imageData, label = '') {
    const visits = this.getVisits();
    const idx = visits.findIndex(v => v.id === visitId);
    if (idx >= 0) {
      if (!visits[idx].images) visits[idx].images = [];
      visits[idx].images.push({
        id: this._uid(),
        data: imageData,
        label: label,
        uploadedAt: new Date().toISOString(),
      });
      this._write(this.KEYS.VISITS, visits);
      return visits[idx];
    }
    return null;
  },

  removeVisitImage(visitId, imageId) {
    const visits = this.getVisits();
    const idx = visits.findIndex(v => v.id === visitId);
    if (idx >= 0 && visits[idx].images) {
      visits[idx].images = visits[idx].images.filter(img => img.id !== imageId);
      this._write(this.KEYS.VISITS, visits);
      return visits[idx];
    }
    return null;
  },

  // --- Temperature Records ---
  getTempRecords() {
    return this._read(this.KEYS.TEMP_RECORDS, []);
  },

  getTempRecordsByPatient(patientId) {
    return this.getTempRecords()
      .filter(r => r.patientId === patientId)
      .sort((a, b) => new Date(a.measuredAt) - new Date(b.measuredAt));
  },

  getTempRecordsByVisit(visitId) {
    return this.getTempRecords()
      .filter(r => r.visitId === visitId)
      .sort((a, b) => new Date(a.measuredAt) - new Date(b.measuredAt));
  },

  addTempRecord(data) {
    const records = this.getTempRecords();
    const record = {
      id: this._uid(),
      patientId: data.patientId,
      visitId: data.visitId || '',
      temperature: parseFloat(data.temperature),
      measuredAt: data.measuredAt || new Date().toISOString(),
      note: data.note || '',
      createdAt: new Date().toISOString(),
    };
    records.push(record);
    this._write(this.KEYS.TEMP_RECORDS, records);
    return record;
  },

  deleteTempRecord(id) {
    const records = this.getTempRecords().filter(r => r.id !== id);
    this._write(this.KEYS.TEMP_RECORDS, records);
  },

  // --- 孤立体温补关联 ---
  // 在没有就诊记录时（如在家观察期间）录入的体温，visitId 为空，属于"孤立记录"
  getOrphanTempRecords(patientId) {
    return this.getTempRecords()
      .filter(r => !r.visitId && r.patientId === patientId)
      .sort((a, b) => new Date(a.measuredAt) - new Date(b.measuredAt));
  },

  // 把某次就诊前后窗口内的孤立体温补关联到该就诊
  // daysBefore: 就诊前多少天内算同一个生病周期（默认7天）
  // daysAfter:  就诊后多少天内（默认14天，覆盖整个病程）
  linkOrphanTempsToVisit(visitId, { daysBefore = 7, daysAfter = 14 } = {}) {
    const visit = this.getVisit(visitId);
    if (!visit) return 0;

    const records = this.getTempRecords();
    const visitTime = new Date(visit.visitDate).getTime();
    const start = visitTime - daysBefore * 24 * 60 * 60 * 1000;
    const end = visitTime + daysAfter * 24 * 60 * 60 * 1000;
    const DAY = 24 * 60 * 60 * 1000;

    let count = 0;
    records.forEach(r => {
      if (r.visitId || r.patientId !== visit.patientId) return;
      const t = new Date(r.measuredAt).getTime();
      if (t >= start - DAY && t <= end) {
        r.visitId = visitId;
        count++;
      }
    });

    if (count > 0) this._write(this.KEYS.TEMP_RECORDS, records);
    return count;
  },

  // 手动指定：把一批体温记录强制关联到某次就诊
  linkTempRecordsToVisit(recordIds, visitId) {
    const records = this.getTempRecords();
    let count = 0;
    records.forEach(r => {
      if (recordIds.includes(r.id)) {
        r.visitId = visitId;
        count++;
      }
    });
    if (count > 0) this._write(this.KEYS.TEMP_RECORDS, records);
    return count;
  },

  // 取消关联（把某条体温重新变回孤立记录）
  unlinkTempRecord(id) {
    const records = this.getTempRecords();
    const idx = records.findIndex(r => r.id === id);
    if (idx >= 0) {
      records[idx].visitId = '';
      this._write(this.KEYS.TEMP_RECORDS, records);
      return true;
    }
    return false;
  },

  getActiveIllnessCycle(patientId) {
    const visits = this.getVisitsByPatient(patientId);
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    for (const visit of visits) {
      const visitDate = new Date(visit.visitDate);
      if (visitDate >= fourteenDaysAgo && visitDate <= now) {
        return visit;
      }
    }
    return visits[0] || null;
  },

  // --- Calendar queries ---
  getVisitsByDate(dateStr) {
    return this.getVisits().filter(v => {
      return v.visitDate.startsWith(dateStr);
    }).sort((a, b) => new Date(a.visitDate) - new Date(b.visitDate));
  },

  getRemindersByDate(dateStr) {
    return this.getReminders().filter(r => r.date === dateStr)
      .sort((a, b) => r.time.localeCompare(b.time));
  },

  getEventsByDate(dateStr) {
    const visits = this.getVisitsByDate(dateStr);
    const reminders = this.getRemindersByDate(dateStr);
    return { visits, reminders };
  },

  getDatesWithEvents(year, month, patientId) {
    // month is 0-indexed；patientId 为 'all' 或空时不过滤
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const visitDates = new Set();
    const reminderDates = new Set();
    const followupDates = new Set();

    const scope = (patientId && patientId !== 'all') ? patientId : null;
    const inScope = item => !scope || item.patientId === scope;

    this.getVisits().forEach(v => {
      if (v.visitDate.startsWith(prefix) && inScope(v)) {
        visitDates.add(v.visitDate.substring(0, 10));
      }
    });

    this.getReminders().forEach(r => {
      if (r.date.startsWith(prefix) && inScope(r)) {
        if (r.type === 'followup') {
          followupDates.add(r.date);
        } else {
          reminderDates.add(r.date);
        }
      }
    });

    return { visitDates, reminderDates, followupDates };
  },

  // --- Reminders ---
  getReminders() {
    return this._read(this.KEYS.REMINDERS, []);
  },

  getActiveReminders() {
    const today = new Date().toISOString().split('T')[0];
    return this.getReminders()
      .filter(r => r.status === 'pending' && r.date >= today)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  },

  getTodayReminders() {
    const today = new Date().toISOString().split('T')[0];
    return this.getReminders()
      .filter(r => r.date === today)
      .sort((a, b) => {
        // 未完成优先，组内按时间升序
        const aDone = a.status === 'done' ? 1 : 0;
        const bDone = b.status === 'done' ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        return (a.time || '').localeCompare(b.time || '');
      });
  },

  addReminder(data) {
    const reminders = this.getReminders();
    const reminder = {
      id: this._uid(),
      visitId: data.visitId || '',
      patientId: data.patientId || '',
      type: data.type || 'medication', // medication | followup | observation
      title: data.title || '',
      description: data.description || '',
      date: data.date || todayISO(),
      time: data.time || '08:00',
      status: data.status || 'pending', // pending | done | skipped
      createdAt: new Date().toISOString(),
    };
    reminders.push(reminder);
    this._write(this.KEYS.REMINDERS, reminders);
    return reminder;
  },

  toggleReminder(id) {
    const reminders = this.getReminders();
    const idx = reminders.findIndex(r => r.id === id);
    if (idx >= 0) {
      reminders[idx].status = reminders[idx].status === 'done' ? 'pending' : 'done';
      this._write(this.KEYS.REMINDERS, reminders);
      return reminders[idx];
    }
    return null;
  },

  deleteReminder(id) {
    const reminders = this.getReminders().filter(r => r.id !== id);
    this._write(this.KEYS.REMINDERS, reminders);
  },

  _generateReminders(visit) {
    const patient = this.getPatient(visit.patientId);
    const patientName = patient ? patient.name : '孩子';

    // Generate medication reminders
    if (visit.medications && visit.medications.length > 0) {
      visit.medications.forEach(med => {
        // Parse frequency to generate reminder times
        const times = this._parseMedTimes(med.frequency);
        const startDate = new Date(visit.visitDate);
        const endDate = new Date(startDate);
        // Default 7 days of medication
        endDate.setDate(endDate.getDate() + (med.durationDays || 7) - 1);

        times.forEach(time => {
          let currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            this.addReminder({
              visitId: visit.id,
              patientId: visit.patientId,
              type: 'medication',
              title: `吃药: ${med.name}`,
              description: `${med.dosage} - ${med.frequency}${med.notes ? ' | ' + med.notes : ''}`,
              date: currentDate.toISOString().split('T')[0],
              time: time,
            });
            currentDate.setDate(currentDate.getDate() + 1);
          }
        });
      });
    }

    // Generate follow-up reminder
    if (visit.followUp && visit.followUp.timing) {
      const days = this._parseFollowUpDays(visit.followUp.timing);
      const followDate = new Date(visit.visitDate);
      followDate.setDate(followDate.getDate() + days);
      this.addReminder({
        visitId: visit.id,
        patientId: visit.patientId,
        type: 'followup',
        title: `复诊提醒 - ${patientName}`,
        description: visit.followUp.conditions.join('；'),
        date: followDate.toISOString().split('T')[0],
        time: '09:00',
      });
    }
  },

  _parseMedTimes(frequency) {
    if (!frequency) return ['08:00'];
    if (frequency.includes('每日3次') || frequency.includes('一天3次') || frequency.includes('3次/日')) {
      return ['08:00', '14:00', '20:00'];
    }
    if (frequency.includes('每日2次') || frequency.includes('一天2次') || frequency.includes('2次/日')) {
      return ['08:00', '20:00'];
    }
    if (frequency.includes('每日1次') || frequency.includes('一天1次') || frequency.includes('1次/日')) {
      return ['08:00'];
    }
    if (frequency.includes('每6小时') || frequency.includes('6小时一次')) {
      return ['08:00', '14:00', '20:00', '02:00'];
    }
    if (frequency.includes('每8小时') || frequency.includes('8小时一次')) {
      return ['08:00', '16:00', '00:00'];
    }
    return ['08:00'];
  },

  _parseFollowUpDays(timing) {
    if (!timing) return 3;
    const match = timing.match(/(\d+)\s*天/);
    if (match) return parseInt(match[1]);
    const weekMatch = timing.match(/(\d+)\s*周/);
    if (weekMatch) return parseInt(weekMatch[1]) * 7;
    return 3;
  },

  // --- Settings ---
  getSettings() {
    return this._read(this.KEYS.SETTINGS, {
      reminderEnabled: true,
      autoTranscribe: true,
      theme: 'pink',        // 'warm' 暖阳奶油 | 'pink' 樱粉温柔
      themeChosen: false,   // 是否已完成首次主题选择
      identity: '',         // '' 未设置 | 'dad' 宝爸 | 'mom' 宝妈
      currentPatientId: 'all', // 'all' 全部就诊人 | 具体 patientId
    });
  },

  updateSettings(data) {
    const settings = { ...this.getSettings(), ...data };
    this._write(this.KEYS.SETTINGS, settings);
    return settings;
  },

  // --- 当前就诊人（全局切换） ---
  // 返回 'all' 或某个 patientId；若指向的患者已被删除则回退 'all'
  getCurrentPatientId() {
    const id = this.getSettings().currentPatientId || 'all';
    if (id === 'all') return 'all';
    const exists = this.getPatients().some(p => p.id === id);
    return exists ? id : 'all';
  },

  setCurrentPatientId(id) {
    return this.updateSettings({ currentPatientId: id || 'all' });
  },

  // 是否需要显示切换器（就诊人 >= 2）
  needsPatientSwitcher() {
    return this.getPatients().length >= 2;
  },

  // 按当前就诊人过滤一组带 patientId 的数据
  filterByCurrentPatient(items) {
    const id = this.getCurrentPatientId();
    if (id === 'all') return items;
    return items.filter(it => it.patientId === id);
  },

  // --- Seed demo data ---
  seedDemoData() {
    if (this.getPatients().length > 0) return;

    // Add demo patient
    const patient = this.addPatient({
      name: '小宝',
      gender: 'male',
      birthDate: '2022-03-15',
      avatarColor: 1,
    });

    // Add a demo visit
    const demoVisit = AIProcessor.getScenario('fever');
    const visit = this.addVisit({
      ...demoVisit,
      patientId: patient.id,
      visitDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Seed temperature data for the illness cycle
    const tempBaseTime = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const demoTemps = [
      { temp: 38.5, hours: 2, note: '就诊时测量' },
      { temp: 39.1, hours: 10, note: '晚上发烧，吃了退烧药' },
      { temp: 38.8, hours: 24, note: '今早体温' },
      { temp: 38.3, hours: 34, note: '下午体温，有所下降' },
      { temp: 37.8, hours: 48, note: '明显好转' },
      { temp: 37.2, hours: 58, note: '已退烧' },
    ];
    demoTemps.forEach(t => {
      this.addTempRecord({
        patientId: patient.id,
        visitId: visit.id,
        temperature: t.temp,
        measuredAt: new Date(tempBaseTime + t.hours * 60 * 60 * 1000).toISOString(),
        note: t.note,
      });
    });
  },
};

function todayISO() {
  return new Date().toISOString().split('T')[0];
}
