/**
 * 通用 SDK 开发版（cpsdk.js）
 *
 * 游戏本地开发/无平台环境使用的 CpSDK 实现：全部能力本地 Mock 降级
 * （广告用模拟遮罩、排行榜/存档用 localStorage、无登录）。
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

let _mockAdCleanup = null;

function _removeMockOverlay() {
  const cleanup = _mockAdCleanup;
  _mockAdCleanup = null;
  cleanup?.();
  document.getElementById('__mock_ad_overlay')?.remove();
}

function _createMockAdOverlay(type, onComplete = null) {
  _removeMockOverlay();
  const isReward = type === 'reward';
  const totalSec = isReward ? 10 : 5;
  const title = isReward
    ? _mockCopy('模拟广告占位', 'Simulated rewarded ad placeholder')
    : _mockCopy('模拟插屏广告展示中…', 'Simulated interstitial ad…');

  const overlay = document.createElement('div');
  let settled = false, timer = null;
  const finish = completed => {
    if (settled) return;
    settled = true;
    if (timer !== null) clearInterval(timer);
    if (_mockAdCleanup === cancel) _mockAdCleanup = null;
    overlay.remove();
    onComplete?.(completed);
  };
  const cancel = () => finish(false);
  _mockAdCleanup = cancel;
  overlay.id = '__mock_ad_overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:999990;display:flex;align-items:center;justify-content:center;';

  const box = document.createElement('div');
  box.style.cssText = 'position:relative;width:800px;max-width:90vw;height:600px;max-height:80vh;background:#fff;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 8px 40px rgba(0,0,0,0.3);';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'position:absolute;top:10px;right:14px;background:none;border:none;font-size:24px;cursor:pointer;color:#666;padding:4px 10px;z-index:1;';
  closeBtn.setAttribute('aria-label', _mockCopy('关闭模拟广告', 'Close simulated ad'));
  closeBtn.onclick = cancel;
  box.appendChild(closeBtn);

  const countdown = document.createElement('div');
  countdown.style.cssText = 'font-size:64px;font-weight:bold;color:#333;font-variant-numeric:tabular-nums;';
  box.appendChild(countdown);
  const desc = document.createElement('div');
  desc.textContent = title;
  desc.style.cssText = 'margin-top:12px;font-size:16px;color:#888;';
  box.appendChild(desc);

  if (isReward) {
    const forceBtn = document.createElement('button');
    forceBtn.textContent = _mockCopy('模拟播放完成', 'Complete simulation');
    forceBtn.style.cssText = 'margin-top:30px;padding:10px 30px;font-size:16px;font-weight:bold;background:#f44336;color:#fff;border:none;border-radius:8px;cursor:pointer;box-shadow:0 4px 15px rgba(244,67,54,0.4);';
    forceBtn.onclick = () => finish(true);
    box.appendChild(forceBtn);
  }

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  let sec = totalSec;
  countdown.textContent = String(sec).padStart(2, '0');
  timer = setInterval(() => {
    sec--;
    countdown.textContent = String(sec).padStart(2, '0');
    if (sec <= 0) {
      finish(true);
    }
  }, 1000);
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

  // ─── 广告（模拟遮罩） ───
  ads = {
    rewarded: () => {
      this._log('ads.rewarded（开发版模拟）');
      return new Promise((resolve) => {
        _createMockAdOverlay('reward', ok => resolve({ status: ok ? AD_STATUS.COMPLETED : AD_STATUS.CLOSED }));
      });
    },
    interstitial: () => {
      this._log('ads.interstitial（开发版模拟）');
      _createMockAdOverlay('interstitial');
      return Promise.resolve({ status: AD_STATUS.COMPLETED });
    },
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
