export const DAILY_LOGIN_STORAGE_KEY = 'thunder-daily-login-v1';
export const DAILY_LOGIN_STATE_VERSION = 1;

export const DAILY_LOGIN_REWARDS = Object.freeze([
  Object.freeze({
    day: 1,
    type: 'coins',
    amount: 300,
    title: '金币 ×300',
    shortTitle: '金币',
    icon: '●',
    color: 0xe7ff78,
  }),
  Object.freeze({
    day: 2,
    type: 'gacha-item',
    itemId: 'weapon:aux_laser',
    title: '脉冲激光炮',
    shortTitle: '脉冲激光',
    icon: 'Ⅱ',
    color: 0xb879ff,
  }),
  Object.freeze({
    day: 3,
    type: 'coins',
    amount: 500,
    title: '金币 ×500',
    shortTitle: '金币',
    icon: '●',
    color: 0xe7ff78,
  }),
  Object.freeze({
    day: 4,
    type: 'gacha-item',
    itemId: 'weapon:aux_rail',
    title: '穿甲磁轨炮',
    shortTitle: '穿甲磁轨',
    icon: '━',
    color: 0xb879ff,
  }),
  Object.freeze({
    day: 5,
    type: 'coins',
    amount: 800,
    title: '金币 ×800',
    shortTitle: '金币',
    icon: '●',
    color: 0xe7ff78,
  }),
  Object.freeze({
    day: 6,
    type: 'gacha-item',
    itemId: 'weapon:aux_rocket',
    title: '集束火箭舱',
    shortTitle: '集束火箭',
    icon: '➤',
    color: 0xb879ff,
  }),
  Object.freeze({
    day: 7,
    type: 'gacha-item',
    itemId: 'aircraft:pilot-02',
    title: 'SSR 青岚·芙蕾雅',
    shortTitle: 'SSR 青岚',
    icon: '✚',
    color: 0x55e7a8,
  }),
]);

export function createInitialDailyLoginState() {
  return {
    version: DAILY_LOGIN_STATE_VERSION,
    claimedCount: 0,
    firstClaimDay: '',
    lastClaimDay: '',
  };
}

function validDayKey(value) {
  const key = String(value || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : '';
}

export function dailyLoginDayKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function sanitizeDailyLoginState(value) {
  const fallback = createInitialDailyLoginState();
  if (!value || typeof value !== 'object') return fallback;
  const claimedCount = Math.max(0, Math.min(
    DAILY_LOGIN_REWARDS.length,
    Math.floor(Number(value.claimedCount) || 0),
  ));
  const firstClaimDay = validDayKey(value.firstClaimDay);
  const lastClaimDay = validDayKey(value.lastClaimDay);
  return {
    version: DAILY_LOGIN_STATE_VERSION,
    claimedCount,
    firstClaimDay: claimedCount > 0 ? firstClaimDay || lastClaimDay : '',
    lastClaimDay: claimedCount > 0 ? lastClaimDay : '',
  };
}

export function loadDailyLoginState(storage = globalThis.localStorage) {
  try {
    return sanitizeDailyLoginState(JSON.parse(storage?.getItem(DAILY_LOGIN_STORAGE_KEY) || 'null'));
  } catch {
    return createInitialDailyLoginState();
  }
}

export function saveDailyLoginState(stateValue, storage = globalThis.localStorage) {
  const state = sanitizeDailyLoginState(stateValue);
  try {
    storage?.setItem(DAILY_LOGIN_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function getDailyLoginStatus(stateValue, date = new Date()) {
  // This is a cumulative seven-day track: any seven distinct local calendar
  // days advance rewards in order. Missing days never reset the count.
  const state = sanitizeDailyLoginState(stateValue);
  const today = dailyLoginDayKey(date);
  const completed = state.claimedCount >= DAILY_LOGIN_REWARDS.length;
  const dateAdvanced = Boolean(today)
    && (!state.lastClaimDay || today > state.lastClaimDay);
  const canClaimToday = !completed && dateAdvanced;
  const nextReward = completed ? null : DAILY_LOGIN_REWARDS[state.claimedCount];
  return {
    ...state,
    today,
    completed,
    canClaimToday,
    nextReward,
    rewards: DAILY_LOGIN_REWARDS,
    stateKey: `${today}:${state.claimedCount}:${state.lastClaimDay}:${canClaimToday ? 1 : 0}`,
  };
}

export function planDailyLoginClaim(stateValue, date = new Date()) {
  // A player can claim one reward on any eligible calendar day; the next
  // reward is selected by cumulative claim count, not by a streak counter.
  const status = getDailyLoginStatus(stateValue, date);
  if (status.completed) return { ok: false, reason: 'completed', status };
  if (!status.today) return { ok: false, reason: 'invalid-date', status };
  if (status.lastClaimDay === status.today) {
    return { ok: false, reason: 'already-claimed', status };
  }
  if (status.lastClaimDay && status.today < status.lastClaimDay) {
    return { ok: false, reason: 'clock-rollback', status };
  }

  const reward = DAILY_LOGIN_REWARDS[status.claimedCount];
  const state = {
    version: DAILY_LOGIN_STATE_VERSION,
    claimedCount: status.claimedCount + 1,
    firstClaimDay: status.firstClaimDay || status.today,
    lastClaimDay: status.today,
  };
  return {
    ok: true,
    reward,
    state,
    status: getDailyLoginStatus(state, date),
  };
}
