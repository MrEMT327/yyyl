// Native ShopDto owns the total remaining allowance; it is not in the APK config.
// Preserve the existing local paid-refresh fallback, without inventing a 10 cap.
// null means UNKNOWN, not a recovered unlimited native allowance.
export const LOCAL_SHOP_POLICY = Object.freeze({
 version:4,
 dailyCatalogSlots:6,
 dailyFreeCoinGoodsId:51001,
 dailyRefreshLimit:null,
 paidRefreshMode:'configured-cost-unbounded-local-fallback',
 adRefreshMode:'one-completed-ad-one-refresh-after-free',
 purchaseReset:'daily',
 note:'用户确认：每日商店六格，免费金币每天领取一次，领取后下次刷新替换为付费商品；其余格沿用原商品价格与数量。每日3次免费刷新，用完后通过完整观看广告刷新。同一商品限购沿用每日重置，兼容保留原500金币刷新接口。',
});
