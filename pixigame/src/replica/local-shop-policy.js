// Native ShopDto owns the total remaining allowance; it is not in the APK config.
// Preserve the existing local paid-refresh fallback, without inventing a 10 cap.
// null means UNKNOWN, not a recovered unlimited native allowance.
export const LOCAL_SHOP_POLICY = Object.freeze({
 version:3,
 dailyRefreshLimit:null,
 paidRefreshMode:'configured-cost-unbounded-local-fallback',
 adRefreshMode:'one-completed-ad-one-refresh-after-free',
 purchaseReset:'daily',
 note:'原配置：每日3次免费，之后500金币；原服总次数和限购重置回执未知。本地付费刷新暂不设总上限。用户确认：免费次数用完后，每次完整观看广告可额外刷新一次；同一商品限购沿用每日重置。',
});
