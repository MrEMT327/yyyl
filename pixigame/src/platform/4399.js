const REWARDED_AD_START_CODE = 10000;
const REWARDED_AD_SUCCESS_CODE = 10001;
const REWARDED_AD_TIMEOUT_MS = 180_000;
const RANKING_TIMEOUT_MS = 15_000;

function platformMessage(zh, en, scope = globalThis) {
  try {
    const queryLang = new URLSearchParams(scope?.location?.search || '').get('lang');
    if (queryLang) return String(queryLang).toLowerCase().startsWith('en') ? en : zh;
  } catch {
    // Continue with persisted and browser language hints.
  }
  try {
    const saved = scope?.localStorage?.getItem?.('game_lang');
    if (saved) return String(saved).toLowerCase().startsWith('en') ? en : zh;
  } catch {
    // Storage may be unavailable in an embedded platform shell.
  }
  return String(scope?.navigator?.language || '').toLowerCase().startsWith('en') ? en : zh;
}

export class RewardedAdError extends Error {
  constructor(message, code = 'AD_ERROR') {
    super(message);
    this.name = 'RewardedAdError';
    this.code = code;
  }
}

export function get4399Api(scope = globalThis) {
  try {
    if (scope?.h5api) return scope.h5api;
  } catch {
    // Some embedded pages deny access to global properties.
  }

  try {
    if (scope?.parent && scope.parent !== scope && scope.parent.h5api) {
      return scope.parent.h5api;
    }
  } catch {
    // Cross-origin iframe access may be denied until the official SDK is ready.
  }

  return null;
}

export function play4399RewardedAd(api = get4399Api()) {
  return new Promise((resolve, reject) => {
    if (!api || typeof api.canPlayAd !== 'function' || typeof api.playAd !== 'function') {
      reject(new RewardedAdError(platformMessage(
        '广告服务暂未就绪，请稍后再试',
        'Ads are not ready. Try again shortly.',
      ), 'SDK_UNAVAILABLE'));
      return;
    }

    let settled = false;
    let timeoutId = 0;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      callback(value);
    };

    try {
      api.canPlayAd((status) => {
        if (!status?.canPlayAd) {
          finish(
            reject,
            new RewardedAdError(platformMessage(
              '暂无可用广告或今日次数已用完',
              'No ad is available, or today\'s limit is reached.',
            ), 'AD_UNAVAILABLE'),
          );
          return;
        }

        try {
          timeoutId = setTimeout(() => {
            finish(
              reject,
              new RewardedAdError(platformMessage(
                '广告播放超时，未发放奖励',
                'Ad playback timed out. No reward was granted.',
              ), 'AD_TIMEOUT'),
            );
          }, REWARDED_AD_TIMEOUT_MS);
          timeoutId.unref?.();

          api.playAd((result) => {
            const code = Number(result?.code);

            // The current 4399 shell emits 10000 when playback starts and
            // invokes the same callback again with 10001 after playback ends.
            if (code === REWARDED_AD_START_CODE) return;

            if (code === REWARDED_AD_SUCCESS_CODE) {
              finish(resolve, result);
              return;
            }

            finish(
              reject,
              new RewardedAdError(
                platformMessage(
                  '需完整观看广告才能获得奖励',
                  'Watch the full ad to receive the reward.',
                ),
                code || 'AD_PLAY_FAILED',
              ),
            );
          });
        } catch {
          finish(reject, new RewardedAdError(platformMessage(
            '广告播放失败，请稍后再试',
            'Ad playback failed. Try again shortly.',
          ), 'AD_PLAY_FAILED'));
        }
      });
    } catch {
      finish(reject, new RewardedAdError(platformMessage(
        '广告服务暂不可用，请稍后再试',
        'Ads are unavailable. Try again shortly.',
      ), 'AD_CHECK_FAILED'));
    }
  });
}

export function canSubmit4399Ranking(api = get4399Api(), rankId = '') {
  if (!api) return false;
  return Boolean(
    (rankId && typeof api.submitRankScore === 'function')
    || typeof api.submitRanking === 'function',
  );
}

export function show4399Ranking(api = get4399Api()) {
  if (!api) return false;
  try {
    if (typeof api.showRankList === 'function') {
      api.showRankList();
      return true;
    }
    if (typeof api.showRanking === 'function') {
      api.showRanking();
      return true;
    }
  } catch {
    // Fall back to the in-game leaderboard when the platform panel cannot open.
  }
  return false;
}

export function submit4399Ranking(score, { api = get4399Api(), rankId = '' } = {}) {
  return new Promise((resolve, reject) => {
    const value = Math.max(0, Math.floor(Number(score) || 0));
    const useRankId = String(rankId || '').trim();
    const submit = useRankId && typeof api?.submitRankScore === 'function'
      ? (callback) => api.submitRankScore(useRankId, value, callback)
      : typeof api?.submitRanking === 'function'
        ? (callback) => api.submitRanking(value, callback)
        : null;
    if (!submit) {
      reject(new Error(platformMessage(
        '4399 排行榜服务暂未就绪',
        'The 4399 leaderboard is not ready.',
      )));
      return;
    }

    let settled = false;
    const finish = (callback, valueToReturn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      callback(valueToReturn);
    };
    const timeoutId = setTimeout(() => {
      finish(reject, new Error(platformMessage(
        '4399 排行榜提交超时',
        'Leaderboard submission timed out.',
      )));
    }, RANKING_TIMEOUT_MS);
    timeoutId.unref?.();

    try {
      submit((result) => {
        if (result?.success === false || Number(result?.code) < 0) {
          finish(reject, new Error(result?.message || platformMessage(
            '4399 排行榜提交失败',
            'Leaderboard submission failed.',
          )));
          return;
        }
        finish(resolve, result);
      });
    } catch {
      finish(reject, new Error(platformMessage(
        '4399 排行榜提交失败',
        'Leaderboard submission failed.',
      )));
    }
  });
}

export {
  REWARDED_AD_START_CODE,
  REWARDED_AD_SUCCESS_CODE,
};
