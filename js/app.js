/**
 * App.js - 主应用逻辑
 * 路由导航、视图渲染、事件处理
 */

const App = {
  state: {
    route: 'home',
    selectedPatientId: null,
    currentVisitId: null,
    editingSection: null,
    searchQuery: '',
    audioUrl: null,
    processingResult: null,
    calendarYear: new Date().getFullYear(),
    calendarMonth: new Date().getMonth(),
    calendarSelectedDate: todayISO(),
    tempPatientId: null,
    tempFilterVisitId: null,
    pendingIdentity: null,
  },

  icons: {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l9-9 9 9M5 10v10h14V10"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
    chevronRight: '<svg class="icon-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>',
    chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    hospital: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h6M12 6v6"/></svg>',
    pill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.5 20.5l-7-7a5 5 0 010-7l0 0a5 5 0 017 0l7 7a5 5 0 01-7 7z"/><path d="M8.5 8.5l7 7"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>',
    stethoscope: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6 6 6 0 006-6V4a2 2 0 00-2-2h-1a.2.2 0 10.3.3M8 15v1a6 6 0 006 6 6 6 0 006-6v-4"/><circle cx="20" cy="10" r="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    thermometer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z"/></svg>',
    trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>',
  },

  categoryConfig: {
    cause: { title: '病因分析', icon: 'search', color: '#3B82F6', bg: '#DBEAFE', iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>' },
    symptoms: { title: '症状记录', icon: 'alert', color: '#F59E0B', bg: '#FEF3C7', iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>' },
    medications: { title: '用药指导', icon: 'pill', color: '#8B5CF6', bg: '#EDE9FE', iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.5 20.5l-7-7a5 5 0 010-7l0 0a5 5 0 017 0l7 7a5 5 0 01-7 7z"/><path d="M8.5 8.5l7 7"/></svg>' },
    care: { title: '护理要点', icon: 'heart', color: '#14B8A6', bg: '#CCFBF1', iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg>' },
    recovery: { title: '饮食调理', icon: 'refresh', color: '#22C55E', bg: '#DCFCE7', iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>' },
    precautions: { title: '注意事项', icon: 'shield', color: '#F59E0B', bg: '#FEF3C7', iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' },
    observeSymptoms: { title: '观察症状', icon: 'eye', color: '#EC4899', bg: '#FCE7F3', iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' },
    prevention: { title: '预防建议', icon: 'shield', color: '#06B6D4', bg: '#CFFAFE', iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' },
    followUp: { title: '复诊安排', icon: 'refresh', color: '#EF4444', bg: '#FEE2E2', iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>' },
  },

  init() {
    // Seed demo data on first run
    Store.seedDemoData();

    // Apply saved theme & show first-launch theme picker
    this.applyTheme(Store.getSettings().theme);
    if (!Store.getSettings().themeChosen) {
      const welcome = document.getElementById('theme-welcome');
      if (welcome) welcome.classList.remove('hidden');
    }

    // Set up navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const route = item.dataset.route;
        if (route) this.navigate(route);
      });
    });

    // 点击切换器以外的区域时关闭就诊人下拉
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#patient-switcher')) {
        this.closePatientDropdown();
      }
    });

    // Navigate to initial route
    this.navigate('home');
  },

  // ========== THEME ==========
  applyTheme(theme) {
    const valid = ['warm', 'pink'];
    const t = valid.includes(theme) ? theme : 'pink';
    document.body.dataset.theme = t;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'warm' ? '#D85A30' : '#D4537E');
  },

  setIdentity(identity) {
    const current = Store.getSettings().identity;
    // 再次点击已选中的身份 = 取消选择
    const next = current === identity ? '' : identity;
    Store.updateSettings({ identity: next });
    this.toast(next === 'dad' ? '身份已设为宝爸' : next === 'mom' ? '身份已设为宝妈' : '已取消身份设置');
    this.renderProfile();
  },

  chooseTheme(theme) {
    // 首次选择时一并保存欢迎页上选的身份
    const pending = this.state.pendingIdentity;
    Store.updateSettings({ theme, themeChosen: true, ...(pending ? { identity: pending } : {}) });
    this.applyTheme(theme);
    const welcome = document.getElementById('theme-welcome');
    if (welcome) welcome.classList.add('hidden');
    const names = { warm: '暖阳奶油', pink: '樱粉温柔' };
    this.toast(`已选择「${names[theme] || theme}」主题`);
    this.state.pendingIdentity = null;
  },

  skipTheme() {
    const pending = this.state.pendingIdentity;
    Store.updateSettings({ theme: 'pink', themeChosen: true, ...(pending ? { identity: pending } : {}) });
    this.applyTheme('pink');
    const welcome = document.getElementById('theme-welcome');
    if (welcome) welcome.classList.add('hidden');
    this.state.pendingIdentity = null;
  },

  selectWelcomeIdentity(identity) {
    this.state.pendingIdentity = identity;
    document.querySelectorAll('.welcome-identity-option').forEach(el => {
      el.classList.toggle('active', el.dataset.identity === identity);
    });
  },

  setTheme(theme) {
    Store.updateSettings({ theme, themeChosen: true });
    this.applyTheme(theme);
    const names = { warm: '暖阳奶油', pink: '樱粉温柔' };
    this.toast(`已切换为「${names[theme] || theme}」`);
    this.renderProfile();
  },

  navigate(route, params = {}) {
    this.state.route = route;

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.route === route);
    });

    // Close any open patient dropdown
    this.closePatientDropdown();

    // Scroll to top
    const content = document.getElementById('content');
    content.scrollTop = 0;

    // Update global patient switcher (shown only when 2+ patients)
    this.renderPatientSwitcher();

    // Render the appropriate view
    switch (route) {
      case 'home': this.renderHome(); break;
      case 'calendar': this.renderCalendar(); break;
      case 'record': this.renderRecord(); break;
      case 'reminders': this.renderReminders(); break;
      case 'profile': this.renderProfile(); break;
      case 'detail': this.renderDetail(params.visitId); break;
      case 'temperature': this.renderTemperature(params.patientId); break;
      case 'processing': this.renderProcessing(params); break;
      case 'result': this.renderResult(params.result, params.duration); break;
      default: this.renderHome();
    }
  },

  // 重新渲染当前路由（切换就诊人后调用）
  refresh() {
    this.renderPatientSwitcher();
    switch (this.state.route) {
      case 'home': this.renderHome(); break;
      case 'calendar': this.renderCalendar(); break;
      case 'reminders': this.renderReminders(); break;
      case 'profile': this.renderProfile(); break;
      case 'temperature': this.renderTemperature(); break;
      case 'detail':
        if (this.state.currentVisitId) this.renderDetail(this.state.currentVisitId);
        break;
    }
  },

  // ========== 全局就诊人切换器 ==========
  renderPatientSwitcher() {
    const bar = document.getElementById('patient-switcher');
    if (!bar) return;

    // “我的”页不显示切换入口（页面内已有所属信息，避免重复）
    if (this.state.route === 'profile') {
      bar.classList.add('hidden');
      return;
    }

    const patients = Store.getPatients();
    if (patients.length < 2) {
      bar.classList.add('hidden');
      return;
    }
    bar.classList.remove('hidden');

    // 首页/我的页顶部是 hero 渐变，切换条融入其中
    bar.classList.toggle('ps-in-hero', this.state.route === 'home' || this.state.route === 'profile');

    const currentId = Store.getCurrentPatientId();
    const current = patients.find(p => p.id === currentId);

    // 头像
    const avatarEl = document.getElementById('ps-avatar');
    if (current) {
      avatarEl.className = `ps-avatar avatar avatar-c${current.avatarColor}`;
      avatarEl.textContent = current.name.charAt(0);
    } else {
      avatarEl.className = 'ps-avatar ps-avatar-all';
      avatarEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>';
    }

    // 名称
    document.getElementById('ps-name').textContent = current ? current.name : '全部';

    // 右侧提示：当前范围内待办提醒数
    const hintEl = document.getElementById('ps-hint');
    const pending = Store.getActiveReminders().filter(r => {
      const r0 = r.status !== 'done';
      return r0 && (currentId === 'all' || r.patientId === currentId);
    }).length;
    hintEl.textContent = pending > 0 ? `${pending} 条待办` : '';
  },

  togglePatientDropdown() {
    const dd = document.getElementById('patient-dropdown');
    if (!dd) return;
    if (dd.classList.contains('hidden')) {
      this.openPatientDropdown();
    } else {
      this.closePatientDropdown();
    }
  },

  openPatientDropdown() {
    const dd = document.getElementById('patient-dropdown');
    if (!dd) return;
    const patients = Store.getPatients();
    const currentId = Store.getCurrentPatientId();

    const allPending = Store.getActiveReminders().filter(r => r.status !== 'done').length;

    dd.innerHTML = `
      <div class="pd-item ${currentId === 'all' ? 'active' : ''}" onclick="App.selectCurrentPatient('all')">
        <span class="pd-avatar pd-avatar-all">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
        </span>
        <span class="pd-info">
          <span class="pd-name">全部</span>
          <span class="pd-meta">${patients.length} 位就诊人 · ${allPending} 条待办</span>
        </span>
        ${currentId === 'all' ? `<span class="pd-check">${this.icons.check}</span>` : ''}
      </div>
      ${patients.map(p => {
        const visits = Store.getVisitsByPatient(p.id).length;
        const pend = Store.getActiveReminders().filter(r => r.status !== 'done' && r.patientId === p.id).length;
        const active = p.id === currentId;
        return `
          <div class="pd-item ${active ? 'active' : ''}" onclick="App.selectCurrentPatient('${p.id}')">
            <span class="pd-avatar avatar avatar-c${p.avatarColor}">${this.escape(p.name.charAt(0))}</span>
            <span class="pd-info">
              <span class="pd-name">${this.escape(p.name)}</span>
              <span class="pd-meta">${this.calcAge(p.birthDate)} · ${visits} 次就诊${pend > 0 ? ` · ${pend} 条待办` : ''}</span>
            </span>
            ${active ? `<span class="pd-check">${this.icons.check}</span>` : ''}
          </div>
        `;
      }).join('')}
    `;
    dd.classList.remove('hidden');
  },

  closePatientDropdown() {
    const dd = document.getElementById('patient-dropdown');
    if (dd) dd.classList.add('hidden');
  },

  selectCurrentPatient(id) {
    Store.setCurrentPatientId(id);
    this.closePatientDropdown();

    // 体温页的患者选择跟随全局切换
    if (id === 'all') {
      this.state.tempPatientId = null;
    } else {
      this.state.tempPatientId = id;
    }

    const patient = Store.getPatient(id);
    this.toast(patient ? `已切换到「${patient.name}」` : '已切换为「全部」');
    this.refresh();
  },

  // ========== HOME VIEW ==========
  getIdentityLabel() {
    const identity = Store.getSettings().identity;
    if (identity === 'dad') return '宝爸';
    if (identity === 'mom') return '宝妈';
    return '';
  },

  getGreeting() {
    const h = new Date().getHours();
    const patients = Store.getPatients();
    const name = patients.length > 0 ? patients[0].name : '';
    let greet = '晚上好';
    if (h >= 5 && h < 9) greet = '早上好';
    else if (h >= 9 && h < 12) greet = '上午好';
    else if (h >= 12 && h < 14) greet = '中午好';
    else if (h >= 14 && h < 18) greet = '下午好';

    const role = this.getIdentityLabel();
    if (name && role) return `${greet}，${name}${role}`;
    if (name) return `${greet}，${name}的家长`;
    return role ? `${greet}，${role}` : greet;
  },

  renderHome() {
    const visits = Store.filterByCurrentPatient(Store.getAllVisitsSorted());
    const patients = Store.getPatients();
    const todayReminders = Store.filterByCurrentPatient(Store.getTodayReminders());

    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="home-hero">
        <div class="home-hero-inner">
          <div>
            <div class="home-hero-greeting">${this.getGreeting()}</div>
            <div class="home-hero-title">医录</div>
            <div class="home-hero-subtitle">看病录音 · AI整理医嘱</div>
          </div>
          <div class="home-hero-actions">
            <button class="btn btn-secondary btn-sm" onclick="App.navigate('temperature')">
              ${this.icons.thermometer}
              <span>体温</span>
            </button>
            <button class="btn btn-secondary btn-sm" onclick="App.navigate('record')">
              ${this.icons.mic}
              <span>录音</span>
            </button>
          </div>
        </div>
      </div>

      <div class="search-bar">
        <div class="search-input-wrap">
          ${this.icons.search}
          <input class="search-input" placeholder="搜索就诊记录..." 
            value="${this.state.searchQuery}" 
            oninput="App.state.searchQuery=this.value; App.renderHome()">
        </div>
      </div>

      ${todayReminders.length > 0 ? `
        <div class="section">
          <div class="section-title" style="display:flex;align-items:center;justify-content:space-between;">
            <span>今日提醒 <span class="count">${todayReminders.length}条</span></span>
            <span class="section-more" onclick="App.navigate('reminders')">
              更多${this.icons.chevronRight}
            </span>
          </div>
          ${todayReminders.slice(0, 3).map(r => this.renderReminderCard(r)).join('')}
        </div>
      ` : ''}

      ${this.renderTempQuickCard()}

      <div class="section">
        <div class="section-title">就诊记录 <span class="count">${visits.length}条</span></div>
        ${visits.length === 0 ? this.renderEmptyState() : this.renderVisitList(visits)}
      </div>
    `;

    // Re-focus search if needed
    if (this.state.searchQuery) {
      const input = content.querySelector('.search-input');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  },

  renderVisitList(visits) {
    let filtered = visits;
    if (this.state.searchQuery) {
      const q = this.state.searchQuery.toLowerCase();
      filtered = visits.filter(v => {
        const patient = Store.getPatient(v.patientId);
        const patientName = patient ? patient.name : '';
        return (v.diagnosis || '').toLowerCase().includes(q) ||
          (v.hospital || '').toLowerCase().includes(q) ||
          (v.doctorName || '').toLowerCase().includes(q) ||
          patientName.toLowerCase().includes(q) ||
          (v.cause || '').toLowerCase().includes(q);
      });
    }

    if (filtered.length === 0) {
      return `<div class="empty-state">
        <div class="empty-state-desc">没有找到匹配的记录</div>
      </div>`;
    }

    return filtered.map(v => this.renderVisitCard(v)).join('');
  },

  renderVisitCard(visit) {
    const patient = Store.getPatient(visit.patientId);
    const patientName = patient ? patient.name : '未知';
    const date = this.formatDate(visit.visitDate);
    const medCount = (visit.medications || []).length;

    return `
      <div class="visit-card" onclick="App.navigate('detail', {visitId: '${visit.id}'})">
        <div class="visit-card-header">
          <div>
            <div class="visit-card-title">${this.escape(visit.diagnosis || '未记录诊断')}</div>
            <div style="font-size:12px;color:var(--text-3);margin-top:2px;">${this.escape(patientName)}</div>
          </div>
          <div class="visit-card-date">${date}</div>
        </div>
        <div class="visit-card-info">
          <span class="tag tag-teal">${this.escape(visit.department || '儿科')}</span>
          ${medCount > 0 ? `<span class="tag tag-purple">${medCount}种药</span>` : ''}
          ${visit.followUp && visit.followUp.timing ? `<span class="tag tag-red">需复诊</span>` : ''}
        </div>
        <div class="visit-card-footer">
          <div class="visit-card-doctor">
            ${this.icons.stethoscope}
            <span>${this.escape(visit.doctorName || '未知医生')} · ${this.escape(visit.hospital || '')}</span>
          </div>
          <span class="visit-card-arrow">${this.icons.chevronRight}</span>
        </div>
      </div>
    `;
  },

  renderEmptyState() {
    return `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
          <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
        </svg>
        <div class="empty-state-title">还没有就诊记录</div>
        <div class="empty-state-desc">点击底部录音按钮<br>记录第一次看病吧</div>
      </div>
    `;
  },

  // ========== RECORD VIEW ==========
  renderRecord() {
    const patients = Store.getPatients();

    if (patients.length === 0) {
      const content = document.getElementById('content');
      content.innerHTML = `
        <div class="page-header">
          <div class="page-title">录音</div>
        </div>
        <div class="empty-state">
          <div class="empty-state-title">请先添加孩子信息</div>
          <div class="empty-state-desc mb-16">添加后才能关联就诊记录</div>
          <button class="btn btn-primary mt-16" onclick="App.showPatientForm()">添加孩子</button>
        </div>
      `;
      return;
    }

    // Default select first patient
    if (!this.state.selectedPatientId) {
      this.state.selectedPatientId = patients[0].id;
    }

    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-header">
        <div class="page-title">开始录音</div>
        <div class="page-subtitle">选择孩子后，点击录音按钮开始记录</div>
      </div>

      <div class="record-view">
        <div class="record-patient-select">
          <label>选择就诊孩子</label>
          <div class="patient-chips">
            ${patients.map(p => `
              <div class="patient-chip ${p.id === this.state.selectedPatientId ? 'selected' : ''}"
                onclick="App.selectPatient('${p.id}')">
                <span class="avatar avatar-c${p.avatarColor}">${p.name.charAt(0)}</span>
                <span>${this.escape(p.name)}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="waveform" id="waveform-container" style="display:none;">
          <div id="waveform-bars" style="display:flex;gap:3px;align-items:center;height:40px;"></div>
        </div>

        <div class="record-timer" id="record-timer">00:00</div>
        <div class="record-hint" id="record-hint">点击下方按钮开始录音</div>

        <div class="record-actions">
          <button class="record-btn-action record-btn-secondary" id="cancel-btn" style="display:none;" onclick="App.cancelRecording()">
            ${this.icons.close}
          </button>
          <button class="record-btn-action record-btn-main" id="record-btn" onclick="App.toggleRecording()">
            ${this.icons.mic}
          </button>
          <button class="record-btn-action record-btn-secondary" id="finish-btn" style="display:none;" onclick="App.finishRecording()">
            ${this.icons.check}
          </button>
        </div>

        <button class="btn btn-ghost btn-sm mt-24" id="demo-btn" onclick="App.startDemo()" style="color:var(--text-3);">
          没有麦克风？点击体验Demo模拟
        </button>
      </div>
    `;
  },

  selectPatient(id) {
    this.state.selectedPatientId = id;
    this.renderRecord();
  },

  async toggleRecording() {
    if (Recorder.isRecording) {
      return;
    }

    // Check if MediaRecorder is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.toast('当前环境不支持录音，请使用Demo模式');
      setTimeout(() => this.startDemo(), 1000);
      return;
    }

    try {
      const waveformContainer = document.getElementById('waveform-container');
      if (waveformContainer) waveformContainer.style.display = 'flex';

      const visual = document.getElementById('record-visual');
      const inner = document.getElementById('record-visual-inner');
      const btn = document.getElementById('record-btn');
      const hint = document.getElementById('record-hint');
      const cancelBtn = document.getElementById('cancel-btn');
      const finishBtn = document.getElementById('finish-btn');
      const demoBtn = document.getElementById('demo-btn');

      if (visual) visual.classList.add('recording');
      if (inner) {
        inner.classList.add('recording');
        inner.innerHTML = this.icons.stop;
      }
      btn.classList.add('recording');
      hint.textContent = '正在录音... 听清医生说的每句话';
      cancelBtn.style.display = 'flex';
      finishBtn.style.display = 'flex';
      if (demoBtn) demoBtn.style.display = 'none';

      await Recorder.start();
    } catch (e) {
      this.toast('无法访问麦克风，切换到Demo模式');
      setTimeout(() => this.startDemo(), 1000);
    }
  },

  startDemo() {
    // Simulate a recording session and go straight to AI processing
    const demoDuration = 120 + Math.floor(Math.random() * 180); // 2-5 minutes
    this.state.audioUrl = null;
    this.navigate('processing', { duration: demoDuration });
  },

  cancelRecording() {
    Recorder.cancel();
    this.renderRecord();
    this.toast('已取消录音');
  },

  async finishRecording() {
    const result = await Recorder.stop();

    if (!result || result.duration < 1) {
      this.toast('录音时间太短，请重新录制');
      this.renderRecord();
      return;
    }

    this.state.audioUrl = result.url;
    this.navigate('processing', { duration: result.duration });
  },

  // ========== PROCESSING VIEW ==========
  renderProcessing(params) {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="processing-view">
        <div class="processing-animation">
          <div class="processing-spinner"></div>
        </div>
        <div class="processing-title">AI智能分析中</div>
        <div style="font-size:14px;color:var(--text-3);">正在整理医嘱信息...</div>

        <div class="processing-steps" id="processing-steps">
          ${AIProcessor.STEPS.map((step, i) => `
            <div class="processing-step pending" id="step-${i}">
              <div class="processing-step-icon">${i + 1}</div>
              <div class="processing-step-text">${step.text}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Start processing
    AIProcessor.process((stepIndex, status) => {
      const stepEl = document.getElementById(`step-${stepIndex}`);
      if (stepEl) {
        stepEl.classList.remove('pending', 'active', 'done');
        stepEl.classList.add(status);
        if (status === 'done') {
          stepEl.querySelector('.processing-step-icon').innerHTML = this.icons.check;
        }
        if (status === 'active') {
          stepEl.querySelector('.processing-step-icon').innerHTML = '<div class="loading-dots"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div></div>';
        }
      }
    }).then(result => {
      // Save the visit
      const patientId = this.state.selectedPatientId;
      const visit = Store.addVisit({
        ...result,
        patientId: patientId,
        recordingDuration: params.duration || 0,
        visitDate: new Date().toISOString(),
      });

      this.state.currentVisitId = visit.id;
      const linked = Store.lastLinkedTempCount || 0;
      this.toast(linked > 0
        ? `医嘱已生成，并补关联了 ${linked} 条此前的体温记录`
        : '医嘱记录已生成');
      setTimeout(() => {
        this.navigate('detail', { visitId: visit.id });
      }, 500);
    });
  },

  // ========== DETAIL VIEW ==========
  renderDetail(visitId) {
    const visit = Store.getVisit(visitId);
    if (!visit) {
      this.navigate('home');
      return;
    }

    this.state.currentVisitId = visitId;
    const patient = Store.getPatient(visit.patientId);
    const patientName = patient ? patient.name : '未知';
    const date = this.formatDateTime(visit.visitDate);

    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="detail-header">
        <div class="detail-header-top">
          <button class="back-btn" onclick="App.navigate('home')">${this.icons.chevronLeft}</button>
          <div class="detail-header-actions">
            <button class="back-btn detail-import-btn" onclick="App.uploadImage('${visit.id}')" title="导入病例">
              ${this.icons.camera}
              <span class="detail-import-label">导入病例</span>
            </button>
            <button class="back-btn" onclick="App.shareVisit('${visit.id}')" title="分享">${this.icons.share}</button>
          </div>
        </div>
        <div class="detail-diagnosis">${this.escape(visit.diagnosis || '未记录诊断')}</div>
        <div class="detail-meta">
          <span class="detail-meta-item">${this.icons.calendar} ${date}</span>
          <span class="detail-meta-item">${this.icons.hospital} ${this.escape(visit.hospital || '')}</span>
        </div>
        <div class="detail-meta" style="margin-top:4px;">
          <span class="detail-meta-item">${this.icons.stethoscope} ${this.escape(visit.doctorName || '')}</span>
          <span class="detail-meta-item">${this.icons.doc} ${this.escape(visit.department || '')}</span>
        </div>
        <div class="detail-patient-badge">
          <span class="avatar">${patientName.charAt(0)}</span>
          <span>${this.escape(patientName)}</span>
        </div>
      </div>

      ${visit.recordingDuration > 0 ? `
        <div class="audio-player" id="audio-player">
          <button class="play-btn" id="play-btn" onclick="App.togglePlayAudio()">
            ${this.icons.play}
          </button>
          <div class="audio-info">
            <div class="audio-duration">录音 · ${Recorder.formatDuration(visit.recordingDuration)}</div>
            <div class="audio-bar"><div class="audio-bar-fill" id="audio-bar-fill"></div></div>
          </div>
        </div>
      ` : ''}

      ${this.renderCategorySection(visit, 'cause')}
      ${this.renderCategorySection(visit, 'symptoms')}
      ${this.renderCategorySection(visit, 'medications')}
      ${this.renderCategorySection(visit, 'care')}
      ${this.renderCategorySection(visit, 'recovery')}
      ${this.renderCategorySection(visit, 'precautions')}
      ${this.renderCategorySection(visit, 'observeSymptoms')}
      ${this.renderCategorySection(visit, 'prevention')}
      ${this.renderCategorySection(visit, 'followUp')}

      ${this.renderTempSection(visit)}

      ${this.renderImagesSection(visit)}

      ${visit.transcript ? `
        <div class="transcript-section">
          <div class="transcript-toggle" onclick="App.toggleTranscript()">
            ${this.icons.doc}
            <span>查看完整对话记录</span>
            ${this.icons.chevronDown}
          </div>
          <div class="transcript-content" id="transcript-content">
            ${this.escape(visit.transcript).replace(/\n/g, '<br>')}
          </div>
        </div>
      ` : ''}

      <div class="action-bar">
        <button class="btn btn-secondary" onclick="App.deleteVisit('${visit.id}')">
          ${this.icons.trash}
          <span>删除</span>
        </button>
        <button class="btn btn-primary" onclick="App.navigate('home')">
          ${this.icons.check}
          <span>完成</span>
        </button>
      </div>
    `;
  },

  renderCategorySection(visit, key) {
    const config = this.categoryConfig[key];
    const value = visit[key];
    if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === 'object' && !Array.isArray(value) && !value.timing && !value.conditions?.length)) {
      return '';
    }

    let body = '';
    if (key === 'cause') {
      body = `<p>${this.escape(value)}</p>`;
    } else if (key === 'medications') {
      body = value.map(med => `
        <div class="med-item">
          <div class="med-icon">${this.icons.pill}</div>
          <div class="med-info">
            <div class="med-name">${this.escape(med.name)}</div>
            <div class="med-dose">${this.escape(med.dosage)} · ${this.escape(med.frequency)}</div>
            ${med.durationDays ? `<div class="med-dose">疗程: ${med.durationDays >= 999 ? '长期' : med.durationDays + '天'}</div>` : ''}
            ${med.notes ? `<div class="med-note">${this.escape(med.notes)}</div>` : ''}
          </div>
        </div>
      `).join('');
    } else if (key === 'followUp') {
      body = `
        <div class="followup-card">
          <div class="followup-when">${this.icons.clock} ${this.escape(value.timing || '遵医嘱复诊')}</div>
          ${value.conditions && value.conditions.length > 0 ? `
            <div class="followup-conditions">
              <div style="font-size:13px;font-weight:600;color:var(--danger);margin-bottom:4px;">出现以下情况需立即就诊:</div>
              <ul class="cat-list">
                ${value.conditions.map(c => `<li>${this.escape(c)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `;
    } else if (Array.isArray(value)) {
      body = `<ul class="cat-list">${value.map(item => `<li>${this.escape(item)}</li>`).join('')}</ul>`;
    } else {
      body = `<p>${this.escape(value)}</p>`;
    }

    return `
      <div class="category-section">
        <div class="category-header">
          <div class="category-icon" style="background:${config.bg};color:${config.color};">
            ${config.iconSvg}
          </div>
          <div class="category-title">${config.title}</div>
          <div class="category-edit" onclick="App.editSection('${visit.id}', '${key}')">
            ${this.icons.edit}
          </div>
        </div>
        <div class="category-body">
          ${body}
        </div>
      </div>
    `;
  },

  toggleTranscript() {
    const el = document.getElementById('transcript-content');
    if (el) el.classList.toggle('show');
  },

  // ========== IMAGES (Medical Records Upload) ==========
  renderImagesSection(visit) {
    const images = visit.images || [];
    return `
      <div class="images-section">
        <div class="images-header">
          <div class="category-icon" style="background:var(--info-light);color:var(--info);">
            ${this.icons.image}
          </div>
          <div class="category-title">病例资料</div>
          <div class="category-edit" style="color:var(--text-3);font-size:12px;">${images.length}张</div>
        </div>
        <div class="images-grid">
          ${images.map(img => `
            <div class="image-thumb" onclick="App.viewImage('${visit.id}', '${img.id}')">
              <img src="${img.data}" alt="${this.escape(img.label || '病例图片')}">
              <button class="image-thumb-delete" onclick="event.stopPropagation(); App.removeImage('${visit.id}', '${img.id}')">
                ${this.icons.close}
              </button>
            </div>
          `).join('')}
          <div class="image-upload-btn" onclick="App.uploadImage('${visit.id}')">
            ${this.icons.camera}
            <span>添加</span>
          </div>
        </div>
      </div>
    `;
  },

  uploadImage(visitId) {
    // Create a hidden file input and trigger it
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Prefer camera on mobile
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Check file size (max 5MB before compression)
      if (file.size > 10 * 1024 * 1024) {
        this.toast('图片太大，请选择小于10MB的图片');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        // Compress the image
        this._compressImage(dataUrl, 1200, 0.7).then(compressed => {
          const label = file.name.replace(/\.[^/.]+$/, '').substring(0, 30) || '病例图片';
          Store.addVisitImage(visitId, compressed, label);
          this.toast('已上传');
          this.renderDetail(visitId);
        }).catch(() => {
          // Fallback: use original
          const label = file.name.replace(/\.[^/.]+$/, '').substring(0, 30) || '病例图片';
          Store.addVisitImage(visitId, dataUrl, label);
          this.toast('已上传');
          this.renderDetail(visitId);
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  },

  _compressImage(dataUrl, maxSize, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round(height * maxSize / width);
            width = maxSize;
          } else {
            width = Math.round(width * maxSize / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  },

  removeImage(visitId, imageId) {
    this.showConfirm('删除图片', '确定删除这张病例图片吗？', () => {
      Store.removeVisitImage(visitId, imageId);
      this.toast('已删除');
      this.renderDetail(visitId);
    });
  },

  viewImage(visitId, imageId) {
    const visit = Store.getVisit(visitId);
    if (!visit || !visit.images) return;
    const img = visit.images.find(i => i.id === imageId);
    if (!img) return;

    // Create lightbox
    const lightbox = document.createElement('div');
    lightbox.className = 'image-lightbox';
    lightbox.innerHTML = `
      <button class="image-lightbox-close" onclick="this.parentElement.remove()">
        ${this.icons.close}
      </button>
      <img src="${img.data}" alt="${this.escape(img.label || '')}">
      <div class="image-lightbox-label">${this.escape(img.label || '病例图片')}</div>
    `;
    lightbox.onclick = (e) => {
      if (e.target === lightbox) lightbox.remove();
    };
    document.body.appendChild(lightbox);
  },

  // ========== TEMPERATURE MONITORING ==========
  tempZone(temp) {
    if (temp >= 39.1) return { name: '高热', color: '#EF4444', bg: '#FEE2E2' };
    if (temp >= 38.1) return { name: '中度发热', color: '#F97316', bg: '#FFEDD5' };
    if (temp >= 37.3) return { name: '低热', color: '#F59E0B', bg: '#FEF3C7' };
    return { name: '正常', color: '#22C55E', bg: '#DCFCE7' };
  },

  renderTempQuickCard() {
    const patients = Store.getPatients();
    if (patients.length === 0) return '';

    // 优先显示当前切换器选中的就诊人；"全部"时取第一个有记录的
    const currentId = Store.getCurrentPatientId();
    let candidates = patients;
    if (currentId !== 'all') {
      candidates = patients.filter(p => p.id === currentId);
      if (candidates.length === 0) return '';
    }

    // Find first patient with temp records
    for (const p of candidates) {
      const records = Store.getTempRecordsByPatient(p.id);
      if (records.length > 0) {
        const latest = records[records.length - 1];
        const zone = this.tempZone(latest.temperature);
        const cycle = Store.getActiveIllnessCycle(p.id);
        const sparkline = this.renderTempSparkline(records);

        return `
          <div class="section">
            <div class="section-title">体温监测 <span class="count">${records.length}条</span></div>
            <div class="temp-quick-card" onclick="App.navigate('temperature', {patientId: '${p.id}'})">
              <div class="temp-quick-info">
                <div class="temp-quick-patient">${this.escape(p.name)}${cycle ? ' · ' + this.escape(cycle.diagnosis || '') : ''}</div>
                <div class="temp-quick-latest">
                  <span class="temp-quick-value" style="color:${zone.color};">${latest.temperature}°C</span>
                  <span class="temp-quick-zone" style="background:${zone.bg};color:${zone.color};">${zone.name}</span>
                </div>
                <div class="temp-quick-time">${this.formatDateTime(latest.measuredAt)}</div>
              </div>
              <div class="temp-quick-spark">${sparkline}</div>
              <div style="color:var(--text-3);">${this.icons.chevronRight}</div>
            </div>
          </div>
        `;
      }
    }
    return '';
  },

  renderTempSparkline(records) {
    if (records.length === 0) return '';
    const sorted = [...records].sort((a, b) => new Date(a.measuredAt) - new Date(b.measuredAt));
    const W = 100, H = 40;
    const temps = sorted.map(r => r.temperature);
    const minT = Math.min(...temps, 36);
    const maxT = Math.max(...temps, 40);
    const range = maxT - minT || 1;
    const times = sorted.map(r => new Date(r.measuredAt).getTime());
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const timeRange = maxTime - minTime || 1;

    const pts = sorted.map(r => {
      const t = new Date(r.measuredAt).getTime();
      const x = (t - minTime) / timeRange * (W - 10) + 5;
      const y = H - 5 - (r.temperature - minT) / range * (H - 10);
      return { x, y, temp: r.temperature };
    });

    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const lastZone = this.tempZone(pts[pts.length - 1].temp);

    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      <path d="${path}" fill="none" stroke="${lastZone.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="${this.tempZone(p.temp).color}"/>`).join('')}
    </svg>`;
  },

  renderTempSection(visit) {
    const records = Store.getTempRecordsByVisit(visit.id);
    const latest = records.length > 0 ? records[records.length - 1] : null;
    const orphans = Store.getOrphanTempRecords(visit.patientId);

    return `
      <div class="temp-section">
        <div class="category-header">
          <div class="category-icon" style="background:#FEE2E2;color:#EF4444;">
            ${this.icons.thermometer}
          </div>
          <div class="category-title">体温监测</div>
          <div class="category-edit" style="color:var(--text-3);font-size:12px;">${records.length}条</div>
        </div>
        <div class="category-body">
          ${records.length > 0 ? `
            <div class="temp-section-latest">
              <div class="temp-section-value" style="color:${this.tempZone(latest.temperature).color};">
                ${latest.temperature}°C
              </div>
              <div>
                <span class="tag" style="background:${this.tempZone(latest.temperature).bg};color:${this.tempZone(latest.temperature).color};">${this.tempZone(latest.temperature).name}</span>
                <span style="font-size:12px;color:var(--text-3);margin-left:6px;">${this.formatDateTime(latest.measuredAt)}</span>
              </div>
              ${latest.note ? `<div style="font-size:13px;color:var(--text-2);margin-top:4px;">${this.escape(latest.note)}</div>` : ''}
            </div>
            <div class="temp-chart-wrap">${this.renderTempChart(records)}</div>
          ` : `
            <div style="text-align:center;padding:16px 0;color:var(--text-3);font-size:13px;">
              暂无体温记录
            </div>
          `}
          ${orphans.length > 0 ? `
            <div class="temp-orphan-card">
              <div class="temp-orphan-text">
                还有 ${orphans.length} 条未关联的体温记录<br>
                <span style="font-size:11px;opacity:0.8;">在家观察期间录入，时间 ${this.formatDateTime(orphans[0].measuredAt)} 起</span>
              </div>
              <button class="btn btn-sm btn-primary" onclick="App.linkOrphanTemps('${visit.id}')">
                ${this.icons.link}
                <span>补关联</span>
              </button>
            </div>
          ` : ''}
          <button class="btn btn-primary btn-sm mt-12" style="width:100%;" onclick="App.showTempForm('${visit.id}')">
            ${this.icons.thermometer}
            <span>记录体温</span>
          </button>
        </div>
      </div>
    `;
  },

  renderTemperature(patientId = null) {
    const patients = Store.getPatients();
    const content = document.getElementById('content');

    if (patients.length === 0) {
      content.innerHTML = `
        <div class="page-header"><div class="page-title">体温监测</div></div>
        <div class="empty-state">
          <div class="empty-state-title">请先添加孩子信息</div>
          <button class="btn btn-primary mt-16" onclick="App.showPatientForm()">添加孩子</button>
        </div>
      `;
      return;
    }

    // 优先用显式传入的，其次用全局切换器选中的，最后回退第一个就诊人
    if (!patientId) {
      const currentId = Store.getCurrentPatientId();
      patientId = this.state.tempPatientId
        || (currentId !== 'all' ? currentId : patients[0].id);
    }
    this.state.tempPatientId = patientId;

    const records = Store.getTempRecordsByPatient(patientId);
    const cycle = Store.getActiveIllnessCycle(patientId);
    const cycleRecords = cycle ? Store.getTempRecordsByVisit(cycle.id) : [];
    const showCycleChart = cycleRecords.length > 0;
    const latest = records.length > 0 ? records[records.length - 1] : null;
    const orphans = Store.getOrphanTempRecords(patientId);

    content.innerHTML = `
      <div class="page-header">
        <div class="page-title">体温监测</div>
        <div class="page-subtitle">记录体温 · 查看趋势</div>
      </div>

      <div class="patient-chips" style="margin-bottom:16px;">
        ${patients.map(p => `
          <div class="patient-chip ${p.id === patientId ? 'selected' : ''}"
            onclick="App.navigate('temperature', {patientId: '${p.id}'})">
            <span class="avatar avatar-c${p.avatarColor}">${p.name.charAt(0)}</span>
            <span>${this.escape(p.name)}</span>
          </div>
        `).join('')}
      </div>

      ${orphans.length > 0 ? `
        <div class="temp-orphan-banner">
          <div class="temp-orphan-head">
            ${this.icons.info}
            <span>有 ${orphans.length} 条体温未关联就诊记录</span>
          </div>
          <div class="temp-orphan-desc">
            这些是还没有对应就诊时录入的（在家观察期间）。补关联后会并入该次生病周期的趋势图。
          </div>
          <button class="btn btn-sm btn-primary" style="width:100%;" onclick="App.showLinkTempModal('${patientId}')">
            ${this.icons.link}
            <span>关联到就诊记录</span>
          </button>
        </div>
      ` : ''}

      ${latest ? `
        <div class="temp-latest-card">
          <div class="temp-latest-label">最新体温</div>
          <div class="temp-latest-row">
            <div class="temp-latest-value" style="color:${this.tempZone(latest.temperature).color};">
              ${latest.temperature}<span style="font-size:18px;">°C</span>
            </div>
            <span class="tag" style="background:${this.tempZone(latest.temperature).bg};color:${this.tempZone(latest.temperature).color};">
              ${this.tempZone(latest.temperature).name}
            </span>
          </div>
          <div class="temp-latest-time">${this.formatDateTime(latest.measuredAt)}</div>
          ${latest.note ? `<div style="font-size:13px;color:var(--text-2);margin-top:4px;">${this.escape(latest.note)}</div>` : ''}
        </div>
      ` : ''}

      ${cycle ? `
        <div class="temp-cycle-card">
          <div class="temp-cycle-label">当前生病周期</div>
          <div class="temp-cycle-diagnosis">${this.escape(cycle.diagnosis || '就诊记录')}</div>
          <div class="temp-cycle-meta">
            ${this.icons.calendar} ${this.formatDateTime(cycle.visitDate)}
            ${cycle.hospital ? ' · ' + this.escape(cycle.hospital) : ''}
          </div>
          <div class="temp-cycle-stats">
            <span>体温记录 ${cycleRecords.length} 条</span>
            ${cycleRecords.length > 1 ? `<span>最高 ${Math.max(...cycleRecords.map(r => r.temperature)).toFixed(1)}°C</span>` : ''}
            ${cycleRecords.length > 1 ? `<span>最低 ${Math.min(...cycleRecords.map(r => r.temperature)).toFixed(1)}°C</span>` : ''}
          </div>
        </div>
      ` : ''}

      <button class="btn btn-primary btn-lg" style="width:100%;margin-bottom:16px;" onclick="App.showTempForm('${cycle ? cycle.id : ''}')">
        ${this.icons.thermometer}
        <span>记录体温</span>
      </button>

      ${showCycleChart ? `
        <div class="section">
          <div class="section-title">体温趋势 <span class="count">${cycleRecords.length}条</span></div>
          <div class="temp-chart-card">
            ${this.renderTempChart(cycleRecords)}
            <div class="temp-chart-legend">
              <div class="legend-item"><div class="legend-dot" style="background:#22C55E;"></div>正常</div>
              <div class="legend-item"><div class="legend-dot" style="background:#F59E0B;"></div>低热</div>
              <div class="legend-item"><div class="legend-dot" style="background:#F97316;"></div>中热</div>
              <div class="legend-item"><div class="legend-dot" style="background:#EF4444;"></div>高热</div>
            </div>
          </div>
        </div>
      ` : records.length > 0 ? `
        <div class="section">
          <div class="section-title">体温趋势 <span class="count">${records.length}条</span></div>
          <div class="temp-chart-card">
            ${this.renderTempChart(records)}
          </div>
        </div>
      ` : `
        <div class="empty-state">
          ${this.icons.thermometer}
          <div class="empty-state-title">暂无体温记录</div>
          <div class="empty-state-desc">孩子生病时<br>记录体温可查看趋势变化</div>
        </div>
      `}

      ${records.length > 0 ? `
        <div class="section">
          <div class="section-title">记录列表</div>
          ${records.slice().reverse().map(r => {
            const zone = this.tempZone(r.temperature);
            const visit = r.visitId ? Store.getVisit(r.visitId) : null;
            return `
              <div class="temp-record-item">
                <div class="temp-record-temp" style="color:${zone.color};background:${zone.bg};">
                  ${r.temperature}°
                </div>
                <div class="temp-record-info">
                  <div class="temp-record-time">${this.formatDateTime(r.measuredAt)}</div>
                  ${r.note ? `<div class="temp-record-note">${this.escape(r.note)}</div>` : ''}
                  ${visit ? `<div style="font-size:11px;color:var(--text-3);margin-top:2px;">${this.escape(visit.diagnosis || '')}</div>` : `<button class="temp-record-link" onclick="App.showLinkTempModal('${patientId}', '${r.id}')">未关联 · 点击补关联</button>`}
                </div>
                <div class="temp-record-tag" style="background:${zone.bg};color:${zone.color};">${zone.name}</div>
                <button class="temp-record-delete" onclick="App.confirmDeleteTemp('${r.id}', '${patientId}')">
                  ${this.icons.trash}
                </button>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}
    `;
  },

  // ========== 孤立体温补关联 ==========
  _orphansInWindow(visit, orphans) {
    const visitTime = new Date(visit.visitDate).getTime();
    const start = visitTime - 7 * 24 * 60 * 60 * 1000;
    const end = visitTime + 14 * 24 * 60 * 60 * 1000;
    return orphans.filter(o => {
      const t = new Date(o.measuredAt).getTime();
      return t >= start && t <= end;
    });
  },

  showLinkTempModal(patientId, recordId = null) {
    const visits = Store.getVisitsByPatient(patientId);
    const orphans = Store.getOrphanTempRecords(patientId);

    if (visits.length === 0) {
      this.showModal(`
        <div class="modal-header">
          <div class="modal-title">补关联体温</div>
          <button class="modal-close" onclick="App.closeModal()">${this.icons.close}</button>
        </div>
        <div style="text-align:center;padding:24px 8px;">
          <div style="font-size:14px;color:var(--text-2);line-height:1.7;">
            还没有就诊记录可关联<br>
            <span style="font-size:12px;color:var(--text-3);">先录制一次就诊，系统会自动把此前的体温并入该生病周期</span>
          </div>
          <button class="btn btn-primary mt-16" onclick="App.closeModal(); App.navigate('record')">
            ${this.icons.mic}
            <span>去录音</span>
          </button>
        </div>
      `);
      return;
    }

    const rows = visits.slice().reverse().map(v => {
      const matched = recordId ? 1 : this._orphansInWindow(v, orphans).length;
      return `
        <div class="link-visit-row ${matched > 0 ? '' : 'disabled'}"
          onclick="App.doLinkTemps('${v.id}', ${recordId ? `'${recordId}'` : 'null'}, '${patientId}', ${matched})">
          <div class="link-visit-info">
            <div class="link-visit-title">${this.escape(v.diagnosis || '就诊记录')}</div>
            <div class="link-visit-meta">${this.formatDateTime(v.visitDate)}${v.hospital ? ' · ' + this.escape(v.hospital) : ''}</div>
          </div>
          <div class="link-visit-count ${matched > 0 ? 'active' : ''}">
            ${matched > 0 ? `可关联 ${matched} 条` : '无匹配'}
          </div>
        </div>
      `;
    }).join('');

    this.showModal(`
      <div class="modal-header">
        <div class="modal-title">${recordId ? '关联这条体温' : '补关联体温记录'}</div>
        <button class="modal-close" onclick="App.closeModal()">${this.icons.close}</button>
      </div>
      <div style="padding:4px 0 8px;">
        <div style="font-size:12px;color:var(--text-3);line-height:1.6;margin-bottom:12px;">
          ${recordId
            ? '选择要归入的就诊记录：'
            : '选择就诊记录，系统会把该次就诊前 7 天至后 14 天内、尚未关联的体温并入这个生病周期。'}
        </div>
        ${rows}
      </div>
    `);
  },

  doLinkTemps(visitId, recordId, patientId, matched) {
    if (!matched || matched === 0) {
      this.toast('该就诊前后没有匹配的体温记录');
      return;
    }
    const count = recordId
      ? Store.linkTempRecordsToVisit([recordId], visitId)
      : Store.linkOrphanTempsToVisit(visitId);

    this.closeModal();
    if (count > 0) {
      this.toast(`已补关联 ${count} 条体温记录`);
    } else {
      this.toast('没有可关联的记录');
    }

    if (this.state.route === 'detail' && this.state.currentVisitId) {
      this.renderDetail(this.state.currentVisitId);
    } else {
      this.renderTemperature(patientId);
    }
  },

  linkOrphanTemps(visitId) {
    const count = Store.linkOrphanTempsToVisit(visitId);
    if (count > 0) {
      this.toast(`已补关联 ${count} 条体温记录`);
      this.renderDetail(visitId);
    } else {
      this.toast('该就诊前后 7/14 天内没有未关联的体温');
    }
  },

  renderTempChart(records) {
    if (!records || records.length === 0) return '';
    const sorted = [...records].sort((a, b) => new Date(a.measuredAt) - new Date(b.measuredAt));
    const W = 640, H = 260;
    const P = { top: 28, right: 20, bottom: 40, left: 44 };
    const cw = W - P.left - P.right;
    const ch = H - P.top - P.bottom;
    const yMin = 35.5, yMax = 41;

    const yScale = (t) => P.top + ch * (1 - (t - yMin) / (yMax - yMin));
    const times = sorted.map(r => new Date(r.measuredAt).getTime());
    const xMin = Math.min(...times);
    const xMax = Math.max(...times);
    const xRange = (xMax - xMin) || 3600000;
    const xScale = (t) => P.left + cw * (t - xMin) / xRange;

    // Color zones
    const zones = [
      { from: 39.1, to: 41, color: '#FEE2E2' },
      { from: 38.1, to: 39.1, color: '#FFEDD5' },
      { from: 37.3, to: 38.1, color: '#FEF3C7' },
      { from: 35.5, to: 37.3, color: '#DCFCE7' },
    ];

    // Grid lines
    const gridLines = [];
    for (let t = 36; t <= 41; t++) gridLines.push({ temp: t, y: yScale(t) });

    // Data points
    const pts = sorted.map(r => {
      const t = new Date(r.measuredAt).getTime();
      return { x: xScale(t), y: yScale(r.temperature), temp: r.temperature, time: r.measuredAt };
    });

    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

    // X-axis labels
    const labelCount = Math.min(5, sorted.length);
    const xLabels = [];
    if (sorted.length === 1) {
      const d = new Date(sorted[0].measuredAt);
      xLabels.push({ x: xScale(times[0]), label: `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` });
    } else {
      for (let i = 0; i < labelCount; i++) {
        const idx = Math.floor(i * (sorted.length - 1) / (labelCount - 1 || 1));
        const d = new Date(sorted[idx].measuredAt);
        xLabels.push({ x: xScale(new Date(sorted[idx].measuredAt).getTime()), label: `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` });
      }
    }

    const pColor = (t) => this.tempZone(t).color;

    return `<svg viewBox="0 0 ${W} ${H}" class="temp-chart-svg" preserveAspectRatio="xMidYMid meet">
      ${zones.map(z => `<rect x="${P.left}" y="${yScale(z.to).toFixed(1)}" width="${cw}" height="${(yScale(z.from) - yScale(z.to)).toFixed(1)}" fill="${z.color}" opacity="0.6"/>`).join('')}
      ${gridLines.map(g => `<line x1="${P.left}" y1="${g.y.toFixed(1)}" x2="${W-P.right}" y2="${g.y.toFixed(1)}" stroke="#E5E7EB" stroke-width="0.5" stroke-dasharray="2,3"/>`).join('')}
      ${gridLines.map(g => `<text x="${P.left-6}" y="${(g.y+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#9CA3AF">${g.temp}</text>`).join('')}
      <line x1="${P.left}" y1="${yScale(37.3).toFixed(1)}" x2="${W-P.right}" y2="${yScale(37.3).toFixed(1)}" stroke="#EF4444" stroke-width="1" stroke-dasharray="4,4" opacity="0.5"/>
      <text x="${W-P.right-4}" y="${(yScale(37.3)-5).toFixed(1)}" text-anchor="end" font-size="9" fill="#EF4444">发热线 37.3</text>
      <path d="${linePath}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="${pColor(p.temp)}" stroke="white" stroke-width="2"/>`).join('')}
      ${pts.map(p => `<text x="${p.x.toFixed(1)}" y="${(p.y-11).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="${pColor(p.temp)}">${p.temp}</text>`).join('')}
      ${xLabels.map(l => `<text x="${l.x.toFixed(1)}" y="${H-8}" text-anchor="middle" font-size="9" fill="#9CA3AF">${l.label}</text>`).join('')}
    </svg>`;
  },

  showTempForm(visitId) {
    const patientId = this.state.tempPatientId || this.state.selectedPatientId;
    const patients = Store.getPatients();
    if (patients.length === 0) {
      this.toast('请先添加孩子');
      return;
    }

    const activePatientId = patientId || patients[0].id;
    const cycle = Store.getActiveIllnessCycle(activePatientId);
    const effectiveVisitId = visitId || (cycle ? cycle.id : '');
    const now = new Date();
    const localDT = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    this.showModal(`
      <div class="modal-header">
        <div class="modal-title">记录体温</div>
        <button class="modal-close" onclick="App.closeModal()">${this.icons.close}</button>
      </div>
      <form id="temp-form" onsubmit="event.preventDefault(); App.saveTempRecord()">
        <div class="form-group">
          <label class="form-label">选择孩子</label>
          <div class="patient-chips">
            ${patients.map(p => `
              <div class="patient-chip ${p.id === activePatientId ? 'selected' : ''}"
                onclick="App.selectTempPatient('${p.id}', this)">
                <span class="avatar avatar-c${p.avatarColor}">${p.name.charAt(0)}</span>
                <span>${this.escape(p.name)}</span>
              </div>
            `).join('')}
          </div>
          <input type="hidden" name="patientId" value="${activePatientId}">
          <input type="hidden" name="visitId" value="${effectiveVisitId}">
        </div>
        ${effectiveVisitId ? `
          <div class="temp-form-cycle">
            ${this.icons.link}
            <span>自动关联：${this.escape(Store.getVisit(effectiveVisitId)?.diagnosis || '当前生病周期')}</span>
          </div>
        ` : `
          <div class="temp-form-cycle" style="color:var(--text-3);">
            ${this.icons.info}
            <span>暂无近期就诊记录，将独立保存</span>
          </div>
        `}
        <div class="form-group">
          <label class="form-label">体温 (°C)</label>
          <div class="temp-input-row">
            <input class="form-input temp-input" type="number" name="temperature" step="0.1" min="34" max="42" placeholder="如 38.5" required autocomplete="off">
            <div class="temp-quick-buttons">
              <button type="button" class="temp-quick-btn" onclick="App._setTempVal(37.0)">37.0</button>
              <button type="button" class="temp-quick-btn" onclick="App._setTempVal(37.5)">37.5</button>
              <button type="button" class="temp-quick-btn" onclick="App._setTempVal(38.0)">38.0</button>
              <button type="button" class="temp-quick-btn" onclick="App._setTempVal(38.5)">38.5</button>
              <button type="button" class="temp-quick-btn" onclick="App._setTempVal(39.0)">39.0</button>
              <button type="button" class="temp-quick-btn" onclick="App._setTempVal(39.5)">39.5</button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">测量时间</label>
          <input class="form-input" type="datetime-local" name="measuredAt" value="${localDT}">
        </div>
        <div class="form-group">
          <label class="form-label">备注 (可选)</label>
          <input class="form-input" name="note" placeholder="如：吃了退烧药后、早晨测量等" autocomplete="off">
        </div>
        <button type="submit" class="btn btn-primary btn-lg mt-16" style="width:100%;">
          ${this.icons.check}
          <span>保存记录</span>
        </button>
      </form>
    `);
  },

  selectTempPatient(id, el) {
    const hidden = document.querySelector('input[name="patientId"]');
    if (hidden) hidden.value = id;
    // Update cycle association
    const cycle = Store.getActiveIllnessCycle(id);
    const visitHidden = document.querySelector('input[name="visitId"]');
    if (visitHidden) visitHidden.value = cycle ? cycle.id : '';
    // Update cycle display
    const cycleEl = document.querySelector('.temp-form-cycle span');
    if (cycleEl) {
      cycleEl.textContent = cycle ? `自动关联：${cycle.diagnosis || '当前生病周期'}` : '暂无近期就诊记录，将独立保存';
    }
    // Update chip selection
    document.querySelectorAll('#temp-form .patient-chip').forEach(c => c.classList.remove('selected'));
    if (el) el.classList.add('selected');
    this.state.tempPatientId = id;
  },

  _setTempVal(val) {
    const input = document.querySelector('input[name="temperature"]');
    if (input) {
      input.value = val;
      input.focus();
    }
  },

  saveTempRecord() {
    const form = document.getElementById('temp-form');
    const formData = new FormData(form);
    const patientId = formData.get('patientId');
    const visitId = formData.get('visitId') || '';
    const temperature = parseFloat(formData.get('temperature'));
    const measuredAt = formData.get('measuredAt') ? new Date(formData.get('measuredAt')).toISOString() : new Date().toISOString();
    const note = formData.get('note') || '';

    if (!temperature || temperature < 34 || temperature > 42) {
      this.toast('请输入有效的体温值');
      return;
    }

    Store.addTempRecord({ patientId, visitId, temperature, measuredAt, note });
    this.closeModal();
    this.toast('体温已记录');

    // Navigate to temperature view or re-render detail
    if (this.state.route === 'detail' && this.state.currentVisitId === visitId) {
      this.renderDetail(visitId);
    } else if (this.state.route === 'temperature') {
      this.renderTemperature(patientId);
    } else {
      this.navigate('temperature', { patientId });
    }
  },

  confirmDeleteTemp(recordId, patientId) {
    this.showConfirm('删除体温记录', '确定删除这条体温记录吗？', () => {
      Store.deleteTempRecord(recordId);
      this.toast('已删除');
      this.renderTemperature(patientId);
    });
  },

  // Audio playback
  audioElement: null,
  togglePlayAudio() {
    if (!this.state.audioUrl && !this.state.currentVisitId) return;

    const visit = Store.getVisit(this.state.currentVisitId);
    if (!visit || !this.state.audioUrl) {
      this.toast('录音文件不可用');
      return;
    }

    if (this.audioElement) {
      if (this.audioElement.paused) {
        this.audioElement.play();
      } else {
        this.audioElement.pause();
      }
      return;
    }

    this.audioElement = new Audio(this.state.audioUrl);
    const playBtn = document.getElementById('play-btn');
    const barFill = document.getElementById('audio-bar-fill');

    this.audioElement.addEventListener('play', () => {
      playBtn.innerHTML = this.icons.pause;
    });

    this.audioElement.addEventListener('pause', () => {
      playBtn.innerHTML = this.icons.play;
    });

    this.audioElement.addEventListener('ended', () => {
      playBtn.innerHTML = this.icons.play;
      if (barFill) barFill.style.width = '0%';
    });

    this.audioElement.addEventListener('timeupdate', () => {
      if (barFill && this.audioElement.duration) {
        const pct = (this.audioElement.currentTime / this.audioElement.duration) * 100;
        barFill.style.width = pct + '%';
      }
    });

    this.audioElement.play();
  },

  // ========== REMINDERS VIEW ==========
  renderReminders() {
    const todayReminders = Store.filterByCurrentPatient(Store.getTodayReminders());
    const upcomingReminders = Store.filterByCurrentPatient(
      Store.getActiveReminders().filter(r => r.date !== todayISO())
    );
    const allReminders = Store.filterByCurrentPatient(Store.getReminders());
    const doneToday = allReminders.filter(r => r.date === todayISO() && r.status === 'done');

    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page-header">
        <div class="page-title">提醒</div>
        <div class="page-subtitle">用药提醒 · 复诊提醒</div>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-number">${todayReminders.filter(r => r.status === 'pending').length}</div>
          <div class="stat-label">今日待办</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${doneToday.length}</div>
          <div class="stat-label">今日已完成</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${upcomingReminders.length}</div>
          <div class="stat-label">未来提醒</div>
        </div>
      </div>

      ${todayReminders.length > 0 ? `
        <div class="section">
          <div class="section-title">今日 <span class="count">${todayReminders.length}条</span></div>
          ${todayReminders.map(r => this.renderReminderCard(r)).join('')}
        </div>
      ` : ''}

      ${upcomingReminders.length > 0 ? `
        <div class="section">
          <div class="section-title">即将到来 <span class="count">${upcomingReminders.length}条</span></div>
          ${upcomingReminders.slice(0, 10).map(r => this.renderReminderCard(r)).join('')}
        </div>
      ` : ''}

      ${todayReminders.length === 0 && upcomingReminders.length === 0 ? `
        <div class="empty-state">
          ${this.icons.bell}
          <div class="empty-state-title">暂无提醒</div>
          <div class="empty-state-desc">录音就诊后<br>会自动生成用药和复诊提醒</div>
        </div>
      ` : ''}
    `;
  },

  renderReminderCard(reminder) {
    const patient = Store.getPatient(reminder.patientId);
    const patientName = patient ? patient.name : '';
    const isDone = reminder.status === 'done';
    const timeLabel = reminder.date === todayISO() ? '今天' : this.formatDate(reminder.date);
    const typeTag = reminder.type === 'medication'
      ? '<span class="tag tag-purple">用药</span>'
      : reminder.type === 'followup'
        ? '<span class="tag tag-red">复诊</span>'
        : '<span class="tag tag-pink">观察</span>';

    return `
      <div class="reminder-card ${isDone ? 'done' : ''}">
        <div class="reminder-time">
          <div class="reminder-time-hour">${reminder.time.slice(0, 2)}</div>
          <div class="reminder-time-label">${this.escape(timeLabel)} ${reminder.time.slice(0, 5)}</div>
        </div>
        <div class="reminder-content">
          <div class="reminder-title">${this.escape(reminder.title)}</div>
          <div class="reminder-desc">${this.escape(reminder.description || '')}</div>
          ${patientName ? `<div style="margin-top:4px;">${typeTag} <span class="tag tag-gray">${this.escape(patientName)}</span></div>` : ''}
        </div>
        <div class="reminder-check ${isDone ? 'done' : ''}" onclick="App.toggleReminder('${reminder.id}')">
          ${this.icons.check}
        </div>
      </div>
    `;
  },

  toggleReminder(id) {
    Store.toggleReminder(id);
    this.renderReminders();
  },

  // ========== CALENDAR VIEW ==========
  renderCalendar() {
    const year = this.state.calendarYear;
    const month = this.state.calendarMonth;
    const today = todayISO();
    const selectedDate = this.state.calendarSelectedDate;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekday = firstDay.getDay(); // 0=Sunday

    // Previous month trailing days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const trailingDays = [];
    for (let i = startWeekday - 1; i >= 0; i--) {
      trailingDays.push(prevMonthLastDay - i);
    }

    // Current month days
    const monthDays = [];
    for (let d = 1; d <= daysInMonth; d++) {
      monthDays.push(d);
    }

    // Next month leading days to fill the grid
    const totalCells = trailingDays.length + monthDays.length;
    const leadingCount = (7 - (totalCells % 7)) % 7;
    const leadingDays = [];
    for (let d = 1; d <= leadingCount; d++) {
      leadingDays.push(d);
    }

    // Get events for this month（按当前切换器选中的就诊人过滤）
    const { visitDates, reminderDates, followupDates } =
      Store.getDatesWithEvents(year, month, Store.getCurrentPatientId());

    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];

    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="calendar-header">
        <button class="calendar-nav-btn" onclick="App.prevMonth()">${this.icons.chevronLeft}</button>
        <div class="calendar-month-title">${year}年 ${monthNames[month]}</div>
        <button class="calendar-nav-btn" onclick="App.nextMonth()">${this.icons.chevronRight}</button>
      </div>

      <div class="calendar-weekdays">
        ${weekdayNames.map((w, i) => `
          <div class="calendar-weekday ${i === 0 || i === 6 ? 'weekend' : ''}">${w}</div>
        `).join('')}
      </div>

      <div class="calendar-grid">
        ${trailingDays.map(d => `
          <div class="calendar-day other-month">${d}</div>
        `).join('')}
        ${monthDays.map(d => {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          const weekday = new Date(year, month, d).getDay();
          const isWeekend = weekday === 0 || weekday === 6;
          const hasVisit = visitDates.has(dateStr);
          const hasReminder = reminderDates.has(dateStr);
          const hasFollowup = followupDates.has(dateStr);

          return `
            <div class="calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${isWeekend ? 'weekend' : ''}"
              onclick="App.selectCalendarDate('${dateStr}')">
              <span>${d}</span>
              ${(hasVisit || hasReminder || hasFollowup) ? `
                <div class="day-dots">
                  ${hasVisit ? '<div class="day-dot visit"></div>' : ''}
                  ${hasReminder ? '<div class="day-dot reminder"></div>' : ''}
                  ${hasFollowup ? '<div class="day-dot followup"></div>' : ''}
                </div>
              ` : '<div class="day-dots"></div>'}
            </div>
          `;
        }).join('')}
        ${leadingDays.map(d => `
          <div class="calendar-day other-month">${d}</div>
        `).join('')}
      </div>

      <div class="calendar-legend">
        <div class="legend-item"><div class="legend-dot" style="background:var(--primary);"></div>就诊</div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--warning);"></div>用药</div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--danger);"></div>复诊</div>
        <div style="flex:1;"></div>
        <button class="calendar-today-btn" onclick="App.goToToday()">今天</button>
      </div>

      <div class="calendar-events" id="calendar-events">
        ${this.renderCalendarEvents(selectedDate)}
      </div>
    `;
  },

  renderCalendarEvents(dateStr) {
    const raw = Store.getEventsByDate(dateStr);
    const visits = Store.filterByCurrentPatient(raw.visits);
    const reminders = Store.filterByCurrentPatient(raw.reminders);
    const dateLabel = this.formatDate(dateStr);

    if (visits.length === 0 && reminders.length === 0) {
      return `
        <div class="calendar-events-title">${dateLabel}</div>
        <div class="empty-state" style="padding:30px 20px;">
          <div class="empty-state-desc">这天没有就诊或提醒</div>
        </div>
      `;
    }

    return `
      <div class="calendar-events-title">${dateLabel}</div>
      ${visits.map(v => {
        const patient = Store.getPatient(v.patientId);
        const patientName = patient ? patient.name : '';
        return `
          <div class="calendar-event-card" onclick="App.navigate('detail', {visitId: '${v.id}'})">
            <div class="calendar-event-badge" style="background:var(--primary-light);color:var(--primary);">
              ${this.icons.stethoscope}
            </div>
            <div class="calendar-event-info">
              <div class="calendar-event-title">${this.escape(v.diagnosis || '就诊记录')}</div>
              <div class="calendar-event-desc">${this.escape(patientName)} · ${this.escape(v.hospital || '')} ${this.escape(v.department || '')}</div>
              <div class="calendar-event-time">${this.escape(v.doctorName || '')}</div>
            </div>
            ${this.icons.chevronRight}
          </div>
        `;
      }).join('')}
      ${reminders.map(r => {
        const patient = Store.getPatient(r.patientId);
        const isFollowup = r.type === 'followup';
        const badgeColor = isFollowup ? 'var(--danger-light)' : 'var(--warning-light)';
        const badgeIconColor = isFollowup ? 'var(--danger)' : 'var(--warning)';
        return `
          <div class="calendar-event-card" onclick="App.toggleReminder('${r.id}')">
            <div class="calendar-event-badge" style="background:${badgeColor};color:${badgeIconColor};">
              ${isFollowup ? this.icons.refresh : this.icons.pill}
            </div>
            <div class="calendar-event-info">
              <div class="calendar-event-title">${this.escape(r.title)}</div>
              <div class="calendar-event-desc">${this.escape(r.description || '')}</div>
              <div class="calendar-event-time">${r.time.slice(0, 5)} ${patient ? '· ' + this.escape(patient.name) : ''} ${r.status === 'done' ? '· 已完成' : ''}</div>
            </div>
            <div class="reminder-check ${r.status === 'done' ? 'done' : ''}">
              ${this.icons.check}
            </div>
          </div>
        `;
      }).join('')}
    `;
  },

  selectCalendarDate(dateStr) {
    this.state.calendarSelectedDate = dateStr;
    // Re-render just the events section
    const eventsEl = document.getElementById('calendar-events');
    if (eventsEl) {
      eventsEl.innerHTML = this.renderCalendarEvents(dateStr);
    }
    // Update selected highlight
    document.querySelectorAll('.calendar-day').forEach(el => {
      el.classList.remove('selected');
    });
    // Find the day element and add selected class
    const [y, m, d] = dateStr.split('-').map(Number);
    if (y === this.state.calendarYear && (m - 1) === this.state.calendarMonth) {
      const days = document.querySelectorAll('.calendar-grid .calendar-day:not(.other-month)');
      if (days[d - 1]) days[d - 1].classList.add('selected');
    }
  },

  prevMonth() {
    this.state.calendarMonth--;
    if (this.state.calendarMonth < 0) {
      this.state.calendarMonth = 11;
      this.state.calendarYear--;
    }
    this.renderCalendar();
  },

  nextMonth() {
    this.state.calendarMonth++;
    if (this.state.calendarMonth > 11) {
      this.state.calendarMonth = 0;
      this.state.calendarYear++;
    }
    this.renderCalendar();
  },

  goToToday() {
    const now = new Date();
    this.state.calendarYear = now.getFullYear();
    this.state.calendarMonth = now.getMonth();
    this.state.calendarSelectedDate = todayISO();
    this.renderCalendar();
  },

  // ========== PROFILE VIEW ==========
  renderProfile() {
    const patients = Store.getPatients();
    const visits = Store.getVisits();
    const settings = Store.getSettings();
    const currentTheme = Store.getSettings().theme || 'pink';
    const currentIdentity = Store.getSettings().identity || '';

    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar">${this.icons.heart}</div>
        <div class="profile-name">医录助手</div>
        <div class="profile-sub">守护家人的健康记录</div>
      </div>

      <div class="stats-row stats-overlap">
        <div class="stat-card">
          <div class="stat-number">${patients.length}</div>
          <div class="stat-label">就诊人</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${visits.length}</div>
          <div class="stat-label">就诊记录</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${Store.getReminders().length}</div>
          <div class="stat-label">提醒总数</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">账号</div>
        <div class="card" style="padding:0;overflow:hidden;">
          <div style="padding:14px 16px 6px;">
            <div style="font-size:13px;font-weight:600;color:var(--text-2);margin-bottom:2px;">我的身份</div>
            <div style="font-size:11px;color:var(--text-3);">用于首页问候语与称呼</div>
          </div>
          <div class="identity-options">
            <div class="identity-option ${currentIdentity === 'dad' ? 'active' : ''}" onclick="App.setIdentity('dad')">
              <div class="identity-avatar" style="background:#DBEAFE;color:#185FA5;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div class="identity-name">宝爸</div>
              <div class="identity-check">${currentIdentity === 'dad' ? this.icons.check : ''}</div>
            </div>
            <div class="identity-option ${currentIdentity === 'mom' ? 'active' : ''}" onclick="App.setIdentity('mom')">
              <div class="identity-avatar" style="background:#FCE7F3;color:#A32D6A;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div class="identity-name">宝妈</div>
              <div class="identity-check">${currentIdentity === 'mom' ? this.icons.check : ''}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">就诊人管理</div>
        ${patients.map(p => {
          const visitCount = Store.getVisitsByPatient(p.id).length;
          const age = this.calcAge(p.birthDate);
          return `
            <div class="patient-list-item" onclick="App.showPatientForm('${p.id}')">
              <div class="avatar-lg avatar-c${p.avatarColor}">${p.name.charAt(0)}</div>
              <div class="patient-list-info">
                <div class="patient-list-name">${this.escape(p.name)}</div>
                <div class="patient-list-detail">${p.gender === 'male' ? '男' : p.gender === 'female' ? '女' : ''} ${age ? '· ' + age : ''} · ${visitCount}次就诊</div>
              </div>
              ${this.icons.chevronRight}
            </div>
          `;
        }).join('')}
        <button class="btn btn-secondary btn-lg mt-16" onclick="App.showPatientForm()">
          ${this.icons.plus}
          <span>添加就诊人</span>
        </button>
      </div>

      <div class="section">
        <div class="section-title">健康工具</div>
        <div class="card" style="padding:0;overflow:hidden;">
          <div class="menu-item" onclick="App.navigate('temperature')">
            <div class="menu-icon" style="background:#FEE2E2;color:#EF4444;">${this.icons.thermometer}</div>
            <div class="menu-label">体温监测</div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:13px;color:var(--text-3);">${Store.getTempRecords().length}条记录</span>
              ${this.icons.chevronRight}
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">设置</div>
        <div class="card" style="padding:0;overflow:hidden;">
          <div style="padding:14px 16px 6px;font-size:13px;font-weight:600;color:var(--text-2);">界面主题</div>
          <div class="theme-option ${currentTheme === 'warm' ? 'active' : ''}" onclick="App.setTheme('warm')">
            <div class="theme-option-swatch" style="background:#D85A30;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
            </div>
            <div class="theme-option-info">
              <div class="theme-option-name">暖阳奶油</div>
              <div class="theme-option-desc">奶油底色 · 蜜橘橙 · 温暖有活力</div>
            </div>
            <div class="theme-option-check">${currentTheme === 'warm' ? this.icons.check : ''}</div>
          </div>
          <div class="theme-option ${currentTheme === 'pink' ? 'active' : ''}" onclick="App.setTheme('pink')">
            <div class="theme-option-swatch" style="background:#D4537E;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 11c0 5.5-7 10-7 10z"/></svg>
            </div>
            <div class="theme-option-info">
              <div class="theme-option-name">樱粉温柔</div>
              <div class="theme-option-desc">淡樱粉底 · 玫瑰粉 · 软糯可爱</div>
            </div>
            <div class="theme-option-check">${currentTheme === 'pink' ? this.icons.check : ''}</div>
          </div>
          <div style="height:8px;"></div>
          <div class="menu-item" onclick="App.toggleSetting('reminderEnabled')">
            <div class="menu-icon" style="background:var(--primary-light);color:var(--primary);">${this.icons.bell}</div>
            <div class="menu-label">提醒通知</div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:13px;color:${settings.reminderEnabled ? 'var(--success)' : 'var(--text-3)'};">
                ${settings.reminderEnabled ? '已开启' : '已关闭'}
              </span>
              ${this.icons.chevronRight}
            </div>
          </div>
          <div class="menu-item" onclick="App.showAbout()">
            <div class="menu-icon" style="background:var(--info-light);color:var(--info);">${this.icons.info}</div>
            <div class="menu-label">关于医录</div>
            ${this.icons.chevronRight}
          </div>
        </div>
      </div>

      <div class="section" style="padding-bottom:20px;">
        <div style="text-align:center;color:var(--text-3);font-size:12px;padding:16px;">
          医录 v1.0 · 看病录音助手<br>
          用AI帮你记住医生说的每一句重要的话
        </div>
      </div>
    `;
  },

  toggleSetting(key) {
    const settings = Store.getSettings();
    Store.updateSettings({ [key]: !settings[key] });
    this.renderProfile();
    this.toast(settings[key] ? '已关闭' : '已开启');
  },

  showAbout() {
    this.showModal(`
      <div class="modal-header">
        <div class="modal-title">关于医录</div>
        <button class="modal-close" onclick="App.closeModal()">${this.icons.close}</button>
      </div>
      <div style="padding:8px 0;">
        <p style="font-size:14px;color:var(--text-2);line-height:1.8;margin-bottom:12px;">
          <strong>医录</strong>是一款专为带孩子看病的家长设计的就医录音助手。
        </p>
        <p style="font-size:14px;color:var(--text-2);line-height:1.8;margin-bottom:12px;">
          带孩子看病时，手忙脚乱来不及记录医生说的每句话。医录帮你一键录音，AI自动将医嘱整理为：
        </p>
        <ul style="font-size:14px;color:var(--text-2);line-height:2;padding-left:20px;margin-bottom:12px;">
          <li>病因分析 — 为什么生病</li>
          <li>用药指导 — 怎么吃药</li>
          <li>护理要点 — 怎么照顾</li>
          <li>饮食调理 — 怎么调理</li>
          <li>注意事项 — 需要注意什么</li>
          <li>观察症状 — 该观察什么</li>
          <li>预防建议 — 怎么预防</li>
          <li>复诊安排 — 什么时候再来</li>
        </ul>
        <p style="font-size:14px;color:var(--text-2);line-height:1.8;">
          从预防、护理、治疗到复诊，把要点信息全部记录下来，再也不怕忘记医嘱。
        </p>
      </div>
    `);
  },

  // ========== PATIENT FORM ==========
  showPatientForm(patientId = null) {
    const patient = patientId ? Store.getPatient(patientId) : null;
    const isEdit = !!patient;

    this.showModal(`
      <div class="modal-header">
        <div class="modal-title">${isEdit ? '编辑就诊人' : '添加就诊人'}</div>
        <button class="modal-close" onclick="App.closeModal()">${this.icons.close}</button>
      </div>
      <form id="patient-form" onsubmit="event.preventDefault(); App.savePatient('${patientId || ''}')">
        <div class="form-group">
          <label class="form-label">姓名</label>
          <input class="form-input" name="name" placeholder="如: 小宝" value="${patient ? this.escape(patient.name) : ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">性别</label>
          <div class="gender-toggle">
            <div class="gender-option ${patient?.gender === 'male' ? 'selected' : ''}" onclick="App.selectGender(this, 'male')">男孩</div>
            <div class="gender-option ${patient?.gender === 'female' ? 'selected' : ''}" onclick="App.selectGender(this, 'female')">女孩</div>
          </div>
          <input type="hidden" name="gender" value="${patient?.gender || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">出生日期</label>
          <input class="form-input" type="date" name="birthDate" value="${patient?.birthDate || ''}">
          <div class="form-hint">用于自动计算年龄</div>
        </div>
        ${isEdit ? `
          <button type="button" class="btn btn-danger btn-lg mt-16" onclick="App.deletePatient('${patientId}')">
            ${this.icons.trash}
            <span>删除就诊人</span>
          </button>
        ` : ''}
        <button type="submit" class="btn btn-primary btn-lg mt-16">
          ${isEdit ? '保存修改' : '添加'}
        </button>
      </form>
    `);
  },

  selectGender(el, gender) {
    document.querySelectorAll('.gender-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    const hidden = document.querySelector('input[name="gender"]');
    if (hidden) hidden.value = gender;
  },

  savePatient(patientId) {
    const form = document.getElementById('patient-form');
    const formData = new FormData(form);
    const data = {
      name: formData.get('name'),
      gender: formData.get('gender') || 'unknown',
      birthDate: formData.get('birthDate') || '',
    };

    if (patientId) {
      Store.updatePatient(patientId, data);
      this.toast('已保存修改');
    } else {
      const patient = Store.addPatient(data);
      this.state.selectedPatientId = patient.id;
      this.toast('已添加就诊人');
    }

    this.closeModal();
    this.renderProfile();
    // 就诊人数量变化可能影响切换器显隐
    this.renderPatientSwitcher();
  },

  deletePatient(patientId) {
    this.showConfirm('删除就诊人', '删除后将同时删除该就诊人的所有就诊记录和提醒，且无法恢复。确定删除吗？', () => {
      Store.deletePatient(patientId);
      // 若删除的正是当前选中的就诊人，回退到"全部"
      if (Store.getCurrentPatientId() === patientId) {
        Store.setCurrentPatientId('all');
      }
      this.closeModal();
      this.renderProfile();
      this.renderPatientSwitcher();
      this.toast('已删除');
    });
  },

  // ========== EDIT SECTION ==========
  editSection(visitId, section) {
    const visit = Store.getVisit(visitId);
    if (!visit) return;
    const config = this.categoryConfig[section];
    const value = visit[section];

    let formHTML = '';

    if (section === 'cause') {
      formHTML = `
        <div class="form-group">
          <label class="form-label">${config.title}</label>
          <textarea class="form-textarea" name="value" rows="6">${this.escape(value || '')}</textarea>
        </div>
      `;
    } else if (section === 'medications') {
      formHTML = `
        <div class="form-group">
          <label class="form-label">用药列表（每行一条：药名 | 剂量 | 频率 | 天数 | 注意事项）</label>
          <textarea class="form-textarea" name="medications" rows="8" style="font-size:13px;">${(value || []).map(m => 
            `${m.name} | ${m.dosage} | ${m.frequency} | ${m.durationDays || ''} | ${m.notes || ''}`
          ).join('\n')}</textarea>
          <div class="form-hint">每行一条，用 | 分隔字段，注意事项可留空</div>
        </div>
      `;
    } else if (section === 'followUp') {
      formHTML = `
        <div class="form-group">
          <label class="form-label">复诊时间</label>
          <input class="form-input" name="timing" value="${this.escape(value?.timing || '')}" placeholder="如: 3天后复诊">
        </div>
        <div class="form-group">
          <label class="form-label">需要立即就诊的情况（每行一条）</label>
          <textarea class="form-textarea" name="conditions" rows="6">${(value?.conditions || []).join('\n')}</textarea>
        </div>
      `;
    } else {
      // Array type: symptoms, care, recovery, precautions, observeSymptoms, prevention
      formHTML = `
        <div class="form-group">
          <label class="form-label">${config.title}（每行一条）</label>
          <textarea class="form-textarea" name="items" rows="8">${(value || []).join('\n')}</textarea>
        </div>
      `;
    }

    this.showModal(`
      <div class="modal-header">
        <div class="modal-title">编辑 · ${config.title}</div>
        <button class="modal-close" onclick="App.closeModal()">${this.icons.close}</button>
      </div>
      <form onsubmit="event.preventDefault(); App.saveSection('${visitId}', '${section}')">
        ${formHTML}
        <button type="submit" class="btn btn-primary btn-lg mt-16">保存</button>
      </form>
    `);
  },

  saveSection(visitId, section) {
    const visit = Store.getVisit(visitId);
    if (!visit) return;

    const form = document.querySelector('.modal-sheet form');
    const formData = new FormData(form);
    let update = {};

    if (section === 'cause') {
      update[section] = formData.get('value');
    } else if (section === 'medications') {
      const raw = formData.get('medications');
      const lines = raw.split('\n').filter(l => l.trim());
      update[section] = lines.map(line => {
        const parts = line.split('|').map(s => s.trim());
        return {
          name: parts[0] || '',
          dosage: parts[1] || '',
          frequency: parts[2] || '',
          durationDays: parts[3] ? parseInt(parts[3]) || 7 : 7,
          notes: parts[4] || '',
        };
      });
    } else if (section === 'followUp') {
      const timing = formData.get('timing');
      const conditions = (formData.get('conditions') || '').split('\n').filter(l => l.trim());
      update[section] = { timing, conditions };
    } else {
      const items = (formData.get('items') || '').split('\n').filter(l => l.trim());
      update[section] = items;
    }

    Store.updateVisit(visitId, update);
    this.closeModal();
    this.toast('已保存');
    this.renderDetail(visitId);
  },

  // ========== DELETE VISIT ==========
  deleteVisit(visitId) {
    this.showConfirm('删除就诊记录', '删除后无法恢复，确定删除这条就诊记录吗？', () => {
      Store.deleteVisit(visitId);
      this.toast('已删除');
      this.navigate('home');
    });
  },

  // ========== SHARE ==========
  shareVisit(visitId) {
    const visit = Store.getVisit(visitId);
    if (!visit) return;
    const patient = Store.getPatient(visit.patientId);

    let text = `【就诊记录】\n`;
    text += `诊断: ${visit.diagnosis}\n`;
    text += `患者: ${patient?.name || ''}\n`;
    text += `日期: ${this.formatDateTime(visit.visitDate)}\n`;
    text += `医院: ${visit.hospital} ${visit.department}\n`;
    text += `医生: ${visit.doctorName}\n\n`;

    if (visit.cause) text += `【病因】\n${visit.cause}\n\n`;
    if (visit.medications?.length) {
      text += `【用药】\n`;
      visit.medications.forEach(m => {
        text += `• ${m.name}: ${m.dosage}, ${m.frequency}\n`;
        if (m.notes) text += `  注意: ${m.notes}\n`;
      });
      text += '\n';
    }
    if (visit.care?.length) {
      text += `【护理】\n`;
      visit.care.forEach(c => text += `• ${c}\n`);
      text += '\n';
    }
    if (visit.precautions?.length) {
      text += `【注意事项】\n`;
      visit.precautions.forEach(c => text += `• ${c}\n`);
      text += '\n';
    }
    if (visit.followUp?.timing) {
      text += `【复诊】${visit.followUp.timing}\n`;
      if (visit.followUp.conditions?.length) {
        text += `如出现以下情况立即就诊:\n`;
        visit.followUp.conditions.forEach(c => text += `• ${c}\n`);
      }
    }

    if (navigator.share) {
      navigator.share({ title: '就诊记录', text }).catch(() => {});
    } else {
      // Copy to clipboard
      navigator.clipboard.writeText(text).then(() => {
        this.toast('已复制到剪贴板');
      }).catch(() => {
        this.toast('分享功能不可用');
      });
    }
  },

  // ========== MODAL ==========
  showModal(html) {
    const overlay = document.getElementById('modal-overlay');
    overlay.innerHTML = `<div class="modal-sheet">${html}</div>`;
    overlay.classList.remove('hidden');
    overlay.onclick = (e) => {
      if (e.target === overlay) this.closeModal();
    };
  },

  closeModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.add('hidden');
    overlay.innerHTML = '';
  },

  showConfirm(title, message, onConfirm) {
    this.state._confirmCallback = onConfirm;
    this.showModal(`
      <div style="text-align:center;padding:16px 0;">
        <div style="font-size:18px;font-weight:700;margin-bottom:12px;">${this.escape(title)}</div>
        <div style="font-size:14px;color:var(--text-2);line-height:1.6;margin-bottom:20px;">${this.escape(message)}</div>
        <div style="display:flex;gap:12px;">
          <button class="btn btn-secondary" style="flex:1;" onclick="App.closeModal()">取消</button>
          <button class="btn btn-danger" style="flex:1;" onclick="App.confirmAction()">确定删除</button>
        </div>
      </div>
    `);
  },

  confirmAction() {
    if (this.state._confirmCallback) {
      this.state._confirmCallback();
      this.state._confirmCallback = null;
    }
    this.closeModal();
  },

  // ========== TOAST ==========
  toast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  },

  // ========== UTILITIES ==========
  formatDate(isoDate) {
    const date = new Date(isoDate);
    const today = new Date();
    const diff = today - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days === 2) return '前天';
    if (days < 7) return `${days}天前`;

    return `${date.getMonth() + 1}月${date.getDate()}日`;
  },

  formatDateTime(isoDate) {
    const date = new Date(isoDate);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  },

  calcAge(birthDate) {
    if (!birthDate) return '';
    const birth = new Date(birthDate);
    const now = new Date();
    const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (months < 1) return '新生儿';
    if (months < 12) return `${months}个月`;
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    return remMonths > 0 ? `${years}岁${remMonths}个月` : `${years}岁`;
  },

  escape(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },
};

// Initialize app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
