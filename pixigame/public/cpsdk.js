/**
 * 通用 SDK 开发版（cpsdk.js）
 *
 * 游戏本地开发/无平台环境使用的 CpSDK 实现：全部能力本地 Mock 降级
 * （未接入平台广告直接免费领取、排行榜/存档用 localStorage、无登录）。
 * 发布到平台时由平台适配器替换（cpsdk_poki.js / cpsdk_4399.js 等，接口完全一致）。
 *
 * 使用方式（与平台适配器相同）：
 *   const sdk = new CpSDK({ gameId: '...', rankId: 0 });
 *   await sdk.ready();
 *   const result = await sdk.ads.rewarded();
 *   if (result.status === 'completed') grantReward();
 */

// ─── 统一返回状态 ───────────────────────────────────────
const AD_STATUS = {
  COMPLETED: 'completed',
  CLOSED: 'closed',
  NO_FILL: 'no-fill',
  ERROR: 'error',
};

// ─── Mock UI（广告遮罩 + Toast） ────────────────────────
let _toastTimer = null;

function _mockUsesEnglish() {
  try {
    const queryLang = new URLSearchParams(window.location.search || '').get('lang');
    if (queryLang) return String(queryLang).toLowerCase().startsWith('en');
  } catch (e) {}
  try {
    const saved = localStorage.getItem('game_lang') || localStorage.getItem('__cp_lang');
    if (saved) return String(saved).toLowerCase().startsWith('en');
  } catch (e) {}
  return String(navigator.language || '').toLowerCase().startsWith('en');
}

function _mockCopy(zh, en) {
  return _mockUsesEnglish() ? en : zh;
}

function _mockToast(text, type) {
  if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
  let el = document.getElementById('__mock_toast');
  if (!el) {
    el = document.createElement('div');
    el.id = '__mock_toast';
    el.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999999;padding:12px 20px;border-radius:8px;color:#fff;font-size:14px;font-family:sans-serif;opacity:0;transition:opacity 0.3s;pointer-events:none;max-width:360px;';
    document.body.appendChild(el);
  }
  el.style.background = type === 'success' ? 'rgba(76,175,80,0.95)' : 'rgba(244,67,54,0.9)';
  el.textContent = text;
  el.style.opacity = '1';
  _toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2500);
}

// ═══════════════════════════════════════════════════════
//  CpSDK — 通用 SDK（开发版，全部本地 Mock）
// ═══════════════════════════════════════════════════════

class CpSDK {
  /**
   * @param {Object} options
   * @param {string}  options.gameId   - 游戏 ID
   * @param {number}  [options.rankId=0] - 排行榜 ID（本地模拟）
   * @param {boolean} [options.debug=false] - 调试日志
   */
  constructor(options = {}) {
    this._opt = { gameId: '', rankId: 0, debug: false, ...options };
    this._ready = false;
    this._langListeners = [];
  }

  _log(...args) { if (this._opt.debug) console.log('[CpSDK/Dev]', ...args); }

  // ─── 生命周期 ───
  ready() {
    if (this._ready) return Promise.resolve();
    this._ready = true;
    this._log('ready（开发版，直接就绪）');
    return Promise.resolve();
  }
  /** 游戏加载完成（平台规范：加载完毕后上报；开发/Mock 直接通过） */
  gameLoadingFinished() { this._log('gameLoadingFinished'); }

  /** 玩法开始（平台规范：玩法开始时上报；开发/Mock 空实现） */
  gameplayStart() { this._log('gameplayStart'); }

  /** 玩法停止（平台规范：玩法结束/展示广告前上报；开发/Mock 空实现） */
  gameplayStop() { this._log('gameplayStop'); }


  // ─── 登录（本地无 → 未登录） ───
  isLogin() { return false; }
  login() { this._log('login（开发版无登录系统）'); return Promise.resolve(null); }

  // ─── 分享（本地无 → 复制当前地址提示） ───
  share(options) {
    this._log('share', options);
    try { if (navigator.clipboard && options && options.text) navigator.clipboard.writeText(String(options.text)); } catch (e) {}
    _mockToast(_mockCopy('📤 分享（开发版，无分享面板）', '📤 Share preview copied'), 'success');
    return Promise.resolve({ ok: false, data: null });
  }

  // ─── 语言 ───
  getLanguage() {
    try {
      const saved = localStorage.getItem('__cp_lang');
      if (saved) return saved;
    } catch (e) {}
    if (typeof window.__PLATFORM_LANG !== 'undefined' && window.__PLATFORM_LANG) return window.__PLATFORM_LANG;
    const nav = String(navigator.language || '').toLowerCase();
    if (nav.startsWith('zh')) return 'zh';
    if (nav.startsWith('ru')) return 'ru';
    if (nav.startsWith('hi')) return 'hi';
    if (nav.startsWith('en')) return 'en';
    return 'zh';
  }

  setLanguage(lang) {
    const value = String(lang);
    try { localStorage.setItem('__cp_lang', value); } catch (e) {}
    this._langListeners.forEach((fn) => { try { fn(value); } catch (e) {} });
    return value;
  }

  onLanguageChange(cb) {
    if (typeof cb === 'function') this._langListeners.push(cb);
    return () => { this._langListeners = this._langListeners.filter((fn) => fn !== cb); };
  }

  // ─── 排行榜（本地模拟） ───
  rank = {
    submit: (board, score) => {
      const value = Math.trunc(Number(score));
      if (!Number.isFinite(value) || value < 0 || value > 2147483647) {
        return Promise.reject(new Error(_mockCopy(
          '分数必须是 0~2147483647 之间的整数',
          'Score must be an integer from 0 to 2147483647',
        )));
      }
      try {
        const key = '__local_rank_' + (board || 'default');
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        list.push({ score: value, ts: Date.now() });
        list.sort((a, b) => b.score - a.score);
        localStorage.setItem(key, JSON.stringify(list.slice(0, 100)));
      } catch (e) {}
      _mockToast(_mockCopy('🏆 本地排行榜已记录：', '🏆 Local score saved: ') + value, 'success');
      return Promise.resolve({ ok: true });
    },
    show: (board) => {
      try {
        const key = '__local_rank_' + (board || 'default');
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        _mockToast(_mockCopy('📊 本地排行 Top5：', '📊 Local Top 5: ') + list.slice(0, 5).map((x) => x.score).join(' / '), 'success');
      } catch (e) {}
    },
  };

  // Unintegrated development SDK: grant immediately, with no ad overlay.
  static localDevelopment = true;
  ads = {
    rewarded: () => Promise.resolve({ status: AD_STATUS.COMPLETED, completed: true, free: true }),
    interstitial: () => Promise.resolve({ status: AD_STATUS.COMPLETED, free: true }),
  };
  // ─── 存档（localStorage） ───
  storage = {
    save: (key, data) => {
      try { localStorage.setItem('__local_save_' + key, String(data)); } catch (e) {}
      return Promise.resolve({ ok: true });
    },
    load: (key) => {
      try {
        const v = localStorage.getItem('__local_save_' + key);
        return Promise.resolve({ ok: v != null, data: v });
      } catch (e) { return Promise.resolve({ ok: false, data: null }); }
    },
  };
}

// ═══════════════════════════════════════════════════════
//  全局导出
// ═══════════════════════════════════════════════════════

window.CpSDK = CpSDK;
