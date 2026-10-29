// A native lobby must never fall through to the host's archived daily-login
// wallet. All entry points share the same ledger and transactional grant.
export function hostSignInSnapshot(system){
 const signIn=system.snapshot().signIn;
 return {...signIn,canClaimToday:signIn.canClaim,rewards:signIn.days,
  nextReward:signIn.days.find(day=>day.active)||null,
  stateKey:[signIn.today,signIn.claimedCount,signIn.lastClaimDay,signIn.canClaim?1:0].join(':')};
}
export function claimHostSignIn(system){return system.action('claimSignIn');}
