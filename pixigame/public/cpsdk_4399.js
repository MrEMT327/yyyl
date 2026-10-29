/**
 * 4399 H5 小游戏 — 通用 SDK 封装
 *
 * 实现 CpSDK 通用接口，底层封装 4399 原生 h5api。
 * 游戏代码只调通用接口，不关心平台实现。
 *
 * 使用方式：
 *   const sdk = new CpSDK({ gameId: '...', rankId: 0 });
 *   await sdk.ready();
 *   const user = await sdk.login();
 *   await sdk.rank.submit('default', score);
 *   sdk.ads.interstitial();
 *   const result = await sdk.ads.rewarded();
 *   if (result.status === 'completed') grantReward();
 */

// ─── 广告状态码 ─────────────────────────────────────────
const AD_CODE = {
  START: 10000,
  COMPLETE: 10001,
  ERROR: 10002,
};

// ─── 存档状态码 ─────────────────────────────────────────
const ARCHIVE_CODE = {
  SUCCESS: 1000,
  NOT_EXIST: 2001,
  SAVE_FAILED: 2002,
  PARAM_ERROR: 2003,
  NOT_OPEN: 2004,
  TOO_FREQUENT: 2999,
};

// ─── 统一返回状态 ───────────────────────────────────────
const AD_STATUS = {
  COMPLETED: 'completed',
  CLOSED: 'closed',
  NO_FILL: 'no-fill',
  ERROR: 'error',
};

// ─── Mock 模式 ──────────────────────────────────────────
const MOCK_MODE = { ACTIVE: false, FORCED: false };

function _shouldMock() {
  if (MOCK_MODE.FORCED) return true;
  if (typeof window.h5api === 'undefined') return true;
  if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) return true;
  if (window.location.search.includes('__mock=1')) return true;
  return false;
}

// ─── Mock UI ────────────────────────────────────────────
let _toastTimer = null;

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

// ─── Mock 广告遮罩 ──────────────────────────────────────
let _rewardCb = null;

function _removeMockOverlay() {
  const ov = document.getElementById('__mock_ad_overlay');
  if (ov) ov.remove();
}

function _createMockAdOverlay(type) {
  _removeMockOverlay();
  const isReward = type === 'reward';
  const totalSec = isReward ? 10 : 5;
  const title = isReward ? '模拟激励视频播放中…' : '模拟插屏广告展示中…';

  const overlay = document.createElement('div');
  overlay.id = '__mock_ad_overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:999990;display:flex;align-items:center;justify-content:center;';

  const box = document.createElement('div');
  box.style.cssText = 'position:relative;width:800px;max-width:90vw;height:600px;max-height:80vh;background:#fff;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 8px 40px rgba(0,0,0,0.3);';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'position:absolute;top:10px;right:14px;background:none;border:none;font-size:24px;cursor:pointer;color:#666;padding:4px 10px;z-index:1;';
  closeBtn.onclick = () => {
    if (isReward && _rewardCb) { _rewardCb({ code: AD_CODE.ERROR, message: '用户中途关闭' }); _rewardCb = null; }
    _removeMockOverlay();
  };
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
    forceBtn.textContent = '🔥 强制成功';
    forceBtn.style.cssText = 'margin-top:30px;padding:10px 30px;font-size:16px;font-weight:bold;background:#f44336;color:#fff;border:none;border-radius:8px;cursor:pointer;box-shadow:0 4px 15px rgba(244,67,54,0.4);';
    forceBtn.onclick = () => {
      if (_rewardCb) { _rewardCb({ code: AD_CODE.COMPLETE, message: '播放完成' }); _rewardCb = null; }
      _removeMockOverlay();
    };
    box.appendChild(forceBtn);
  }

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  let sec = totalSec;
  countdown.textContent = String(sec).padStart(2, '0');
  const timer = setInterval(() => {
    sec--;
    countdown.textContent = String(sec).padStart(2, '0');
    if (sec <= 0) {
      clearInterval(timer);
      if (isReward && _rewardCb) { _rewardCb({ code: AD_CODE.COMPLETE, message: '播放完成' }); _rewardCb = null; }
      _removeMockOverlay();
    }
  }, 1000);
}

// ─── Mock API 实现 ──────────────────────────────────────
const MockApi = {
  // 广告
  playAd(cb) { _rewardCb = cb; _createMockAdOverlay('reward'); },
  canPlayAd(cb) { setTimeout(() => cb({ canPlayAd: true, remain: 999 }), 200); },
  playInterstitialAd() { _createMockAdOverlay('interstitial'); },
  // 登录
  login(cb) {
    setTimeout(() => cb({ uId: 'mock_user_001', uid: 'mock_user_001', userName: '模拟玩家', nick: '模拟玩家', token: 'mock_token_' + Date.now() }), 300);
  },
  isLogin() { return false; },
  // 头像（PNG data URI 占位，避免外链检测；如需真实头像可在适配器层接入平台头像接口）
  _avatarDataUri() { return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAPUlEQVR4nO3RQQ0AMAgEwSOpitqoD/zLqYTlw29HwJEsdftl01ldjwcG/AEyETIRMhEyETIRMhEyETJRyAdepwEZw9e39QAAAABJRU5ErkJggg=='; },
  getUserAvatar(uid, size) { return this._avatarDataUri(); },
  getUserSmallAvatar(uid) { return this._avatarDataUri(); },
  getUserBigAvatar(uid) { return this._avatarDataUri(); },
  getUserLargeAvatar(uid) { return this._avatarDataUri(); },
  // 排行榜
  submitRankScore(rankId, score, cb) {
    _mockToast('🏆 排行榜提交成功！(' + score + ')', 'success');
    setTimeout(() => cb({ code: 1, msg: '提交成功', data: { score, rank: 1 } }), 500);
  },
  submitRanking(score, cb) { return this.submitRankScore(0, score, cb); },
  showRankList() { _mockToast('📊 排行榜面板已打开（Mock）', 'success'); },
  showRanking() { _mockToast('📊 排行榜面板已打开（Mock）', 'success'); },
  getRanking(cb, page, step) { setTimeout(() => cb({ list: [], total: 0, page: page || 1 }), 500); },
  getMyRanking(cb) { setTimeout(() => cb({ rank: -1, score: 0 }), 500); },
  getNearRanking(cb, step) { setTimeout(() => cb({ list: [] }), 500); },
  // 存档
  save(params) {
    const { type, data, callback } = params;
    if (type === 'write') {
      try { localStorage.setItem('__mock_save__', data); } catch (e) {}
      setTimeout(() => callback({ code: 1, msg: '保存成功', data: null }), 300);
    } else {
      const saved = localStorage.getItem('__mock_save__');
      setTimeout(() => callback({ code: saved ? 1 : 0, msg: saved ? '读取成功' : '无存档', data: saved }), 300);
    }
  },
  share() { _mockToast('📤 分享面板已打开（Mock）', 'success'); },
  showRecommend() { _mockToast('📢 推荐面板已打开（Mock）', 'success'); },
  progress(num) {},
  checkWord(word, cb) { setTimeout(() => cb({ code: 1, msg: '通过' }), 300); },
  showGuide(cb, index) { setTimeout(() => { if (cb) cb({}); }, 300); },
  gameMode(mode) {},
};

// ═══════════════════════════════════════════════════════
//  CpSDK — 通用 SDK 接口
// ═══════════════════════════════════════════════════════

class CpSDK {
  /**
   * @param {Object} options
   * @param {string}  options.gameId       - 游戏 ID
   * @param {number}  [options.rankId=0]   - 排行榜 ID
   * @param {boolean} [options.debug=false] - 调试日志
   * @param {boolean} [options.mockFallback=true] - Mock 降级
   * @param {number}  [options.loadTimeout=10000] - SDK 加载超时
   */
  constructor(options = {}) {
    this._opt = {
      gameId: '',
      rankId: 0,
      debug: false,
      mockFallback: true,
      loadTimeout: 10000,
      sdkUrl: 'https://h.api.4399.com/h5mini-2.0/h5api-interface.php',
      ...options,
    };

    this._ready = false;
    this._readyPromise = null;
    this._langListeners = [];

    if (window.__forceMock) {
      MOCK_MODE.FORCED = true;
      MOCK_MODE.ACTIVE = true;
    }
  }

  // ─── 日志 ───
  _log(...args) { if (this._opt.debug) console.log('[CpSDK/4399]', ...args); }
  _warn(...args) { if (this._opt.debug) console.warn('[CpSDK/4399]', ...args); }
  _error(...args) { console.error('[CpSDK/4399]', ...args); }

  // ─── 获取底层 API ───
  _getApi() {
    if (MOCK_MODE.ACTIVE) return MockApi;
    return window.h5api;
  }

  // ═════════════════════════════════════════════════════
  //  生命周期
  // ═════════════════════════════════════════════════════

  /** 等待 SDK 就绪 */
  ready() {
    if (this._ready) return Promise.resolve();
    if (this._readyPromise) return this._readyPromise;

    this._readyPromise = new Promise((resolve) => {
      if (this._isReady()) {
        this._ready = true;
        resolve();
        return;
      }

      this._log('加载 SDK...');
      const script = document.createElement('script');
      script.src = this._opt.sdkUrl;
      script.async = true;

      const onDone = () => {
        this._ready = true;
        resolve();
      };

      const onFallback = () => {
        if (this._opt.mockFallback) {
          this._warn('进入 Mock 降级模式');
          MOCK_MODE.ACTIVE = true;
          onDone();
        }
      };

      script.onload = () => {
        this._log('SDK 加载完成');
        // onload 后 h5api 可能还未就绪，轮询等待
        let waited = 0;
        const poll = setInterval(() => {
          waited += 250;
          if (typeof window.h5api !== 'undefined' && window.h5api) {
            clearInterval(poll);
            onDone();
          } else if (waited >= 20000) {
            clearInterval(poll);
            this._warn('h5api 未就绪');
            onFallback();
          }
        }, 250);
      };

      script.onerror = () => {
        this._error('SDK 加载失败');
        onFallback();
      };

      document.body.appendChild(script);

      if (this._opt.loadTimeout > 0) {
        setTimeout(() => {
          if (!this._ready) {
            this._warn('SDK 加载超时');
            onFallback();
          }
        }, this._opt.loadTimeout);
      }
    });

    return this._readyPromise;
  }
  /** 游戏加载完成（平台规范：加载完毕后上报；开发/Mock 直接通过） */
  gameLoadingFinished() { this._log('gameLoadingFinished'); }

  /** 玩法开始（平台规范：玩法开始时上报；开发/Mock 空实现） */
  gameplayStart() { this._log('gameplayStart'); }

  /** 玩法停止（平台规范：玩法结束/展示广告前上报；开发/Mock 空实现） */
  gameplayStop() { this._log('gameplayStop'); }


  _isReady() {
    if (MOCK_MODE.ACTIVE) return true;
    return !!(typeof window !== 'undefined' && window.h5api);
  }

  _ensureReady() {
    if (!this._ready && !MOCK_MODE.ACTIVE) throw new Error('SDK 未就绪，请先调用 await sdk.ready()');
  }

  // ═════════════════════════════════════════════════════
  //  登录
  // ═════════════════════════════════════════════════════

  /** 是否已登录 */
  isLogin() {
    this._ensureReady();
    return this._getApi().isLogin();
  }

  /** 打开登录面板 */
  login() {
    this._ensureReady();
    return new Promise((resolve) => {
      this._log('login');
      this._getApi().login((data) => {
        resolve({
          id: data && (data.uId || data.uid || ''),
          name: data && (data.userName || data.nick || ''),
          avatar: data && this._getApi().getUserAvatar(data.uId || data.uid, 'middle'),
          raw: data || null,
        });
      });
    });
  }

  // ═════════════════════════════════════════════════════
  //  分享
  // ═════════════════════════════════════════════════════

  share(options) {
    this._ensureReady();
    this._log('share', options);
    this._getApi().share();
    return Promise.resolve();
  }

  // ═════════════════════════════════════════════════════
  //  语言
  // ═════════════════════════════════════════════════════

  /**
   * 获取当前语言
   * 解析顺序：用户选择（setLanguage 持久化）> 原生接口 > 平台注入 __PLATFORM_LANG > 浏览器语言 > zh
   * @returns {string} 'zh' | 'en' | 'ru' | 'hi'
   */
  getLanguage() {
    try {
      const saved = localStorage.getItem('__cp_lang');
      if (saved) return saved;
    } catch (e) {}
    const api = this._getApi();
    if (api && typeof api.getLanguage === 'function') {
      try { const l = api.getLanguage(); if (l) return l; } catch (e) {}
    }
    if (typeof window.__PLATFORM_LANG !== 'undefined' && window.__PLATFORM_LANG) return window.__PLATFORM_LANG;
    const nav = String(navigator.language || '').toLowerCase();
    if (nav.startsWith('zh')) return 'zh';
    if (nav.startsWith('ru')) return 'ru';
    if (nav.startsWith('hi')) return 'hi';
    if (nav.startsWith('en')) return 'en';
    return 'zh';
  }

  /**
   * 切换语言并持久化（本地存储；原生接口存在时同步调用）
   * @param {string} lang - 'zh' | 'en' | 'ru' | 'hi'
   */
  setLanguage(lang) {    const value = String(lang);
    try { localStorage.setItem('__cp_lang', value); } catch (e) {}
    const api = this._getApi();
    if (api && typeof api.setLanguage === 'function') {
      try { api.setLanguage(value); } catch (e) {}
    }
    this._langListeners.forEach(fn => { try { fn(value); } catch (e) {} });
    return value;
  }

  /**
   * 监听语言切换（切换并广播）
   * @param {Function} cb - (lang) => void
   * @returns {Function} 取消订阅函数
   */
  onLanguageChange(cb) {
    if (typeof cb === 'function') this._langListeners.push(cb);
    return () => { this._langListeners = this._langListeners.filter(fn => fn !== cb); };
  }

  // ═════════════════════════════════════════════════════
  //  排行榜
  // ═════════════════════════════════════════════════════

  rank = {
    /**
     * 提交分数
     * @param {string} board  - 排行榜名称（映射到 rankId）
     * @param {number} score  - 整数分数
     */
    submit: (board, score) => {
      this._ensureReady();
      const value = Math.trunc(Number(score));
      if (!Number.isFinite(value) || value < 0 || value > 2147483647) {
        return Promise.reject(new Error('分数必须是 0~2147483647 之间的整数'));
      }
      const rankId = board && board !== 'default' ? board : this._opt.rankId;
      if (!rankId && rankId !== 0) return Promise.reject(new Error('未配置 rankId'));
      return new Promise((resolve) => {
        this._log('rank.submit', { board, score: value, rankId });
        this._getApi().submitRankScore(Number(rankId), value, (res) => {
          resolve({ ok: !!(res && res.code === 1), data: (res && res.data) || null });
        });
      });
    },

    /**
     * 显示排行榜面板
     * @param {string} board - 排行榜名称
     */
    show: (board) => {
      this._ensureReady();
      this._log('rank.show', { board });
      this._getApi().showRankList();
    },
  };

  // ═════════════════════════════════════════════════════
  //  广告
  // ═════════════════════════════════════════════════════

  ads = {
    /**
     * 播放激励广告
     * @returns {Promise<{status: string}>}
     *   status = 'completed' → 完整播放，发奖
     *   status = 'closed'    → 中途关闭，不发奖
     *   status = 'error'     → 异常/无填充，不发奖
     */
    rewarded: () => {
      this._ensureReady();
      return new Promise((resolve) => {
        this._log('ads.rewarded');
        this._getApi().playAd((res) => {
          if (!res || res.code === AD_CODE.ERROR) {
            resolve({ status: AD_STATUS.ERROR });
          } else if (res.code === AD_CODE.COMPLETE) {
            resolve({ status: AD_STATUS.COMPLETED });
          } else if (res.code === AD_CODE.START) {
            // 开始播放，等待下一个回调
          } else {
            resolve({ status: AD_STATUS.CLOSED });
          }
        });
      });
    },

    /**
     * 播放插屏广告（不阻塞）
     */
    interstitial: () => {
      this._ensureReady();
      this._log('ads.interstitial');
      try { this._getApi().playInterstitialAd(); } catch (e) { /* 静默失败 */ }
    },
  };

  // ═════════════════════════════════════════════════════
  //  存档
  // ═════════════════════════════════════════════════════

  storage = {
    /**
     * 写档
     * @param {string} key  - 存档键名
     * @param {string} data - 存档数据
     */
    save: (key, data) => {
      this._ensureReady();
      return new Promise((resolve) => {
        this._log('storage.save', { key });
        this._getApi().save({ type: 'write', more: false, title: key, data: String(data), callback: (res) => resolve() });
      });
    },

    /**
     * 读档
     * @param {string} key - 存档键名
     * @returns {Promise<{ok: boolean, data: string|null}>}
     */
    load: (key) => {
      this._ensureReady();
      return new Promise((resolve) => {
        this._log('storage.load', { key });
        this._getApi().save({ type: 'read', more: false, callback: (res) => {
          resolve({ ok: !!(res && res.code === 1 && res.data), data: (res && res.data) || null });
        }});
      });
    },
  };
}

// ═══════════════════════════════════════════════════════
//  全局导出
// ═══════════════════════════════════════════════════════

window.CpSDK = CpSDK;
window.__h5apiMock = false;

// 监听 Mock 模式切换
Object.defineProperty(window, '__h5apiMock', {
  get() { return MOCK_MODE.ACTIVE; },
  set(v) { MOCK_MODE.ACTIVE = !!v; },
});

