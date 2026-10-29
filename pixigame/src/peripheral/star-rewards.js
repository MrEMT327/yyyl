// Thresholds and diamonds come from ChapterReward_StarReward rows 1–5.
// Non-currency items are explicitly adapted to the existing local economy.
export const STAR_REWARDS = Object.freeze([
  {id:1,stars:3,easy:{diamonds:10,weaponParts:100}},
  {id:2,stars:6,easy:{diamonds:20,weaponParts:50}},
  {id:3,stars:9,easy:{diamonds:30,aircraftShards:10}},
  {id:4,stars:12,easy:{diamonds:10,weaponParts:50}},
  {id:5,stars:15,easy:{diamonds:20,aircraftShards:10}},
  {id:6,stars:18,easy:{diamonds:20,weaponParts:60}},
  {id:7,stars:21,easy:{diamonds:20,aircraftShards:12}},
  {id:8,stars:24,easy:{diamonds:30,weaponParts:80}},
  {id:9,stars:27,easy:{diamonds:30,aircraftShards:15}},
  {id:10,stars:30,easy:{diamonds:40,weaponParts:100}},
  {id:11,stars:33,easy:{diamonds:30,weaponParts:110}},
  {id:12,stars:36,easy:{diamonds:30,aircraftShards:18}},
  {id:13,stars:39,easy:{diamonds:40,weaponParts:120}},
  {id:14,stars:42,easy:{diamonds:40,aircraftShards:20}},
  {id:15,stars:45,easy:{diamonds:50,weaponParts:150}},
  {id:16,stars:48,easy:{diamonds:40,weaponParts:160}},
  {id:17,stars:51,easy:{diamonds:40,aircraftShards:22}},
  {id:18,stars:54,easy:{diamonds:50,weaponParts:180}},
  {id:19,stars:57,easy:{diamonds:50,aircraftShards:25}},
  {id:20,stars:60,easy:{diamonds:60,weaponParts:200}},
  {id:21,stars:63,easy:{diamonds:50,weaponParts:210}},
  {id:22,stars:66,easy:{diamonds:50,aircraftShards:28}},
  {id:23,stars:69,easy:{diamonds:60,weaponParts:230}},
  {id:24,stars:72,easy:{diamonds:60,aircraftShards:30}},
  {id:25,stars:75,easy:{diamonds:70,weaponParts:250}},
  {id:26,stars:78,easy:{diamonds:60,weaponParts:260}},
  {id:27,stars:81,easy:{diamonds:60,aircraftShards:32}},
  {id:28,stars:84,easy:{diamonds:70,weaponParts:280}},
  {id:29,stars:87,easy:{diamonds:70,aircraftShards:35}},
  {id:30,stars:90,easy:{diamonds:80,weaponParts:300}},
  {id:31,stars:93,easy:{diamonds:70,weaponParts:310}},
  {id:32,stars:96,easy:{diamonds:70,aircraftShards:38}},
  {id:33,stars:99,easy:{diamonds:80,weaponParts:330}},
  {id:34,stars:102,easy:{diamonds:80,aircraftShards:40}},
  {id:35,stars:105,easy:{diamonds:90,weaponParts:350}},
  {id:36,stars:108,easy:{diamonds:80,weaponParts:360}},
  {id:37,stars:111,easy:{diamonds:80,aircraftShards:42}},
  {id:38,stars:114,easy:{diamonds:90,weaponParts:380}},
  {id:39,stars:117,easy:{diamonds:90,aircraftShards:45}},
  {id:40,stars:120,easy:{diamonds:100,weaponParts:400}},
  {id:41,stars:123,easy:{diamonds:90,weaponParts:410}},
  {id:42,stars:126,easy:{diamonds:90,aircraftShards:48}},
  {id:43,stars:129,easy:{diamonds:100,weaponParts:430}},
  {id:44,stars:132,easy:{diamonds:100,aircraftShards:50}},
  {id:45,stars:135,easy:{diamonds:110,weaponParts:450}},
  {id:46,stars:138,easy:{diamonds:100,weaponParts:460}},
  {id:47,stars:141,easy:{diamonds:100,aircraftShards:52}},
  {id:48,stars:144,easy:{diamonds:110,weaponParts:480}},
  {id:49,stars:147,easy:{diamonds:110,aircraftShards:55}},
  {id:50,stars:150,easy:{diamonds:120,weaponParts:500}},
].map(row => Object.freeze({...row,easy:Object.freeze(row.easy)})));
export const STAR_RESOURCE_NAMES = Object.freeze({diamonds:'钻石',weaponParts:'通用零件',aircraftShards:'飞机碎片',cores:'科技星核'});
// Only the playable mainline has a reward track. Legacy hard saves stay intact.
const modes = ['easy'];
const fail = message => ({ok:false,message});
export function campaignStarTotals(campaign, stages) {
  return Object.fromEntries(modes.map(mode => [mode, stages.reduce((sum, stage) => {
    const result = campaign?.results?.[`${stage.id}:${mode}`];
    return sum + (result?.cleared ? Math.max(0,Math.min(3,Math.floor(Number(result.stars)||0))) : 0);
  },0)]));
}
export function starRewardSnapshot(state = {}, totals = {}, maxStars = 15) {
  return {pending:Boolean(state.pending),modes:modes.map(mode => ({id:mode,label:'主线',
    total:totals[mode]||0,maxStars,items:STAR_REWARDS.filter(row=>row.stars<=maxStars).map(row=>{
      const claimed = (state.claimed?.[mode]||[]).includes(row.id);
      return {id:row.id,stars:row.stars,reward:row[mode],claimed,
        claimable:!state.pending && !claimed && (totals[mode]||0)>=row.stars};
    })}))};
}
export function planStarClaim(state = {}, wallet, totals, {mode,id}, maxStars = 15) {
  if (!modes.includes(mode)) return fail('仅支持主线星级奖励');
  const row = STAR_REWARDS.find(row=>row.id===Number(id) && row.stars<=maxStars);
  if (!row) return fail('奖励档位不存在');
  if (state.pending) return fail('奖励存档待恢复');
  if ((state.claimed?.[mode]||[]).includes(row.id)) return fail('此档奖励已领取');
  if ((totals[mode]||0)<row.stars) return fail('累计星数不足');
  const before = {}, after = {};
  for (const [key,amount] of Object.entries(row[mode])) {
    if (!Number.isFinite(wallet[key]) || wallet[key]<0) return fail('资源数据异常');
    before[key]=wallet[key]; after[key]=wallet[key]+amount;
  }
  const next = {...state,version:1,claimed:{...state.claimed,easy:[...(state.claimed?.easy||[])]}};
  next.claimed[mode].push(row.id);
  next.pending={before,after};
  return {ok:true,state:next,rewards:Object.entries(row[mode]).map(([type,amount])=>({type,amount,name:STAR_RESOURCE_NAMES[type]}))};
}

/** Persist the claim and receipt BEFORE granting; replay absolute balances. */
export function createStarRewardService({getState,getWallet,getTotals,maxStars=15,saveState,applyWallet,canUse=()=>true,onChange=()=>{}}) {
  function recover() {
    const pending = getState()?.pending;
    if (!pending) return true;
    try {
      if (!applyWallet(pending)) return false;
      const next={...getState()}; delete next.pending;
      return saveState(next);
    } catch { return false; }
  }
  function claim(payload) {
    if (!canUse()) return fail('请先完成当前出击');
    if (!recover()) return fail('奖励已记录，存档待恢复，请重新进入');
    const plan = planStarClaim(getState(),getWallet(),getTotals(),payload,maxStars);
    if (!plan.ok) return plan;
    if (!saveState(plan.state)) return fail('无法保存领取记录，本次未发放');
    if (!recover()) return fail('奖励已记录，资源存档待恢复，请重新进入');
    onChange();
    return {ok:true,message:'星级奖励已领取',rewards:plan.rewards};
  }
  return {claim,recover,snapshot:()=>starRewardSnapshot(getState(),getTotals(),maxStars)};
}
