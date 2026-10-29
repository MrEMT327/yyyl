import { MISSILE_BRIDGE_NODES } from './missile-bridge-nodes.js';
import { ENERGY_NODES } from './energy-nodes.js';
import { FIXED_PARTS } from './parts.js';
const node = (part, key, name, description) => Object.freeze({ id: `FP-${part}-${key}`, part, key, name, description,
  temporary: key.startsWith('T'), terminal: /^[ABC]2$/.test(key), branch: /^[ABC]/.test(key) ? key[0] : null });
export const FIXED_NODES = Object.freeze([
  ...ENERGY_NODES.map(([part,key,name,lines])=>node(part,key,name,lines.map(line=>line.map(r=>typeof r==='string'?r:r.text).join('')).join(' '))),
  ...MISSILE_BRIDGE_NODES.map(([part,key,name,lines])=>node(part,key,name,lines.map(line=>line.map(r=>typeof r==='string'?r:r.text).join('')).join(' '))),
  node('W01','S1','供弹整流','三连点射间隔 1.30 → 1.14 秒，轮内仍每 0.06 秒发射一发。'),
  node('W01','S2','稳定短轨','弹速提高 20%，寿命同步缩短，射程不变。'),
  node('W01','A1','连续校准','连续三轮命中后，下一轮首弹穿透一敌；后续伤害 65%。'),
  node('W01','A2','纵线穿孔','校准轮每发各穿透两敌，留下 1.6 秒穿孔，后续轮命中追加伤害。'),
  node('W01','B1','交叉射界','两管向前方共同点交叉，过交点后展开。横移寻找交点。'),
  node('W01','B2','双线夹击','同轮两管在 0.18 秒内命中同敌，追加一次夹击伤害。'),
  node('W01','T1','快轮低单发','30 秒：轮间隔 ×0.8，单发伤害 ×0.85。'),
  node('W01','T2','宽线低穿透附伤','30 秒：两管外张 5°；穿透附伤 ×0.7，无穿透或单 Boss 时首敌伤害 ×0.9。'),
  node('W01','T3','收束低覆盖','30 秒：两管向更近交点有限收束，弹体判定缩小 20%。'),
  node('W01','T4','尾弹重击低前弹','30 秒：首弹伤害 ×0.7，最后一发 ×1.4，中间弹不变；过载增加连发后同样生效。'),
  node('C02','S','缓释供能','过载每秒衰减 100% → 50%，更容易保留到下一轮。'),
  node('C02','A1','快速回能','每次命中提供的过载 10% → 30%。'),
  node('C02','A2','连中满载','同一轮累计三次有效命中，立即充满过载；每轮触发一次。'),
  node('C02','B1','余能保留','每次命中后，过载暂停衰减 0.6 秒；再次命中刷新时间。'),
  node('C02','B2','长效过载','过载衰减速度再降低 75%，与缓释供能叠加后每秒只减少 12.5%。'),
  node('W02','S1','快速装填','发射间隔 2.50 → 2.20 秒，到点立即发射。'),
  node('W02','S2','宽轨稳定','弹体与命中宽度增加 20%。'),
  node('W02','A1','穿孔标记','留下 3 秒穿孔，同段下一轮命中每门炮追加 5 点伤害。'),
  node('W02','A2','贯通余震','先穿过 4 敌，再进入重弹碰撞；0.4 秒后沿发射方向追加 35% 伤害，余震最多击中 5 敌。'),
  node('W02','C1','电磁余痕','弹体经过后留痕 0.45 秒，新穿过的敌人受到伤害。'),
  node('W02','C2','轨迹封锁','保留最近两条轨迹 1.2 秒，敌人首次进入受到 35% 弹伤。'),
  node('W02','T1','速射校准','30 秒：立刻准备下一发，发射间隔减少 25%，弹伤降低 20%。'),
  node('W02','T2','宽轨校准','30 秒：弹宽增加 50%，远处伤害降低 20%。'),
  node('W02','T3','首击校准','30 秒：首敌伤害增加 25%，后续敌人伤害降低 25%。'),
  node('W02','T4','重弹续航','30 秒：可继续飞行的碰撞次数 1 → 2，首敌伤害降低 20%；对 Boss 追加弱击。'),
  node('C03','S','稳定透镜','子弹追踪力度提高 25%，转弯更快。'),
  node('C03','A1','定点校准','两轮命中同一敌人，留下 3 秒弱点，下轮命中追加 10% 弹伤。'),
  node('C03','A2','持续追猎','触发弱点后，对该敌人的追踪力度提高 40%，持续 0.8 秒；每第三次弱点附伤提高到 25%。'),
  node('C03','B1','远距聚焦','子弹距离目标超过屏高 40% 时，追踪力度提高 50%。'),
  node('C03','B2','远端集中','远处首次命中，向前追加一束 20% 弹伤的短激光。'),
]);
export const FIXED_NODE_BY_ID = new Map(FIXED_NODES.map(n => [n.id,n]));
export const fixedXpForLevel = level => Math.round((5 + Math.floor((level - 1) * 5.2) + Math.floor((level - 1) / 8) ** 2 * 8) * 1.2);

export function createFixedGrowth(loadout, runId, seed = 0x71ac35, checkpoint = null) {
  const research=loadout.statModifiers?.researchModifiers||{};
  const owners = [...loadout.weapons, ...loadout.connectors.filter(c=>c.active)].map(o=>({...o,part:FIXED_PARTS[o.itemId].part}));
  let state = { runId, buildVersion:0, level:1, xp:0, xpNext:fixedXpForLevel(1), pendingLevels:research.openingChoices||0,
    selections:0, nodes:{}, tactics:{}, focus:loadout.weapons[0].id, rng:seed >>> 0 || 1,
    offer:null, offerSerial:0, display:0, rerolls:2+(research.extraRerolls||0), lastShown:{}, terminalRotation:{}, recent:{}, history:[], ended:false };
  if(checkpoint){
    if(checkpoint.version!==1||checkpoint.state?.runId!==runId||JSON.stringify(checkpoint.loadout)!==JSON.stringify(loadout))throw Error('构筑快照不属于本局装配');
    const saved=checkpoint.state;
    if(!Number.isInteger(saved.level)||saved.level<1||!Number.isInteger(saved.pendingLevels)||saved.pendingLevels<0||saved.xp<0||saved.xp>=saved.xpNext||saved.xpNext!==fixedXpForLevel(saved.level)||saved.selections!==saved.history.length)throw Error('构筑快照计数无效');
    for(const [ownerId,nodes] of Object.entries(saved.nodes)){
      const owner=owners.find(o=>o.id===ownerId);
      if(!owner||new Set(nodes).size!==nodes.length||nodes.some(id=>!FIXED_NODE_BY_ID.has(id)||FIXED_NODE_BY_ID.get(id).part!==owner.part||FIXED_NODE_BY_ID.get(id).temporary))throw Error('构筑快照节点无效');
      if(nodes.filter(id=>FIXED_NODE_BY_ID.get(id).terminal).length>1)throw Error('构筑快照终局冲突');
      if(owner.kind==='connector'&&nodes.includes(`FP-${owner.part}-A1`)&&nodes.includes(`FP-${owner.part}-B1`))throw Error('构筑快照路线冲突');
    }
    state=structuredClone(saved);
  }
  const has = (owner, key) => (state.nodes[owner.id] || []).includes(`FP-${owner.part}-${key}`);
  function candidates(includeTactics = false) {
    return owners.flatMap(owner => FIXED_NODES.filter(n=>n.part===owner.part).filter(n=>{
      if(n.temporary) return includeTactics && state.tactics[owner.id]?.id !== n.id;
      if(has(owner,n.key))return false;
      if(owner.kind==='connector') {
        if(n.branch && has(owner,`${n.branch==='A'?'B':'A'}1`))return false;
        return !n.terminal || (has(owner,'S') && has(owner,`${n.branch}1`) && state.selections>=4);
      }
      if(n.terminal)return !['A2','B2','C2'].some(k=>has(owner,k))&&has(owner,`${n.branch}1`)&&(state.nodes[owner.id]?.length||0)>=3&&state.selections>=6;
      return !n.branch || ['A1','B1','C1'].filter(k=>has(owner,k)).length<2;
    }).map(n=>({...n, ownerId:owner.id, slots:owner.slots, ownerName:FIXED_PARTS[owner.itemId].name,
      sourceItems:owner.sources?.map(id=>id.split('/')[1])||[],
      targetLabel:owner.kind==='connector'?`作用于 ${owner.beneficiaries.map(id=>loadout.weapons.find(w=>w.id===id)?.slots.join('/')||'').join('、')}`:'跟随当前武器',
      restriction:n.temporary?'替换当前调校；仅有敌人时计时':n.terminal?'本件只能选一个终局':owner.kind==='connector'&&n.branch?`选择后关闭 ${n.branch==='A'?'B':'A'} 路线`:'一次性升级；保留其他已选效果'})));
  }
  function random() { state.rng ^= state.rng << 13; state.rng ^= state.rng >>> 17; state.rng ^= state.rng << 5; state.rng >>>=0;return state.rng/4294967296; }
  function makeOffer(reroll = false) {
    if(state.ended || !state.pendingLevels)return null;
    const permanent=candidates(), all=permanent.length>=3?permanent:candidates(true);
    const old=state.offer?.cards.map(c=>`${c.ownerId}/${c.id}`)||[], chosen=[];
    const selected = c=>chosen.some(x=>x.id===c.id&&x.ownerId===c.ownerId);
    const add = c=>{if(c&&chosen.length<3&&!selected(c))chosen.push(c);};
    if(permanent.length<3)permanent.forEach(add);
    if(!reroll)state.display++;
    // Terminal owners enter the front of the queue. Rotate alternatives only
    // on a new earned level; rerolls do not advance fairness debt.
    for(const owner of [...owners].sort((a,b)=>(state.lastShown[a.id]||0)-(state.lastShown[b.id]||0))) {
      const ready=permanent.filter(c=>c.ownerId===owner.id&&c.terminal);
      if(ready.length) { const index=state.terminalRotation[owner.id]||0;add(ready[index%ready.length]);if(!reroll)state.terminalRotation[owner.id]=index+1; }
    }
    const pick=list=>list.filter(c=>!selected(c)).map(c=>({c,w:random()*(c.key.endsWith('2')?1+Math.min(.6,research.highTierChoiceChance||0):1)/(1+(state.recent[`${c.ownerId}/${c.id}`]||0)+(reroll&&old.includes(`${c.ownerId}/${c.id}`)?5:0))})).sort((a,b)=>b.w-a.w)[0]?.c;
    for(const owner of owners.filter(o=>state.display-(state.lastShown[o.id]||0)>=4)) add(pick(permanent.filter(c=>c.ownerId===owner.id)));
    add(pick(permanent.filter(c=>c.ownerId===state.focus&&(!state.selections?/^[ABC]1$/.test(c.key):true))));
    if(chosen.length<3) add(pick(permanent.filter(c=>!chosen.some(x=>x.ownerId===c.ownerId))));
    while(chosen.length<3) { const c=pick(all);if(!c)throw Error('固定件候选不足，待选等级已保留');add(c); }
    // Three permanent options must not be replaced by a tactical card.
    if(reroll&&all.length>3&&chosen.every(c=>old.includes(`${c.ownerId}/${c.id}`))){
      const replacement=all.find(c=>!selected(c));
      const index=chosen.findLastIndex(c=>!c.terminal&&(permanent.length>=3||c.temporary));
      if(index>=0&&replacement)chosen[index]=replacement;
    }
    for(let i=chosen.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[chosen[i],chosen[j]]=[chosen[j],chosen[i]];}
    if(!reroll)for(const c of chosen){state.lastShown[c.ownerId]=state.display;const k=`${c.ownerId}/${c.id}`;state.recent[k]=(state.recent[k]||0)+1;}
    state.offer={runId,offerId:++state.offerSerial,buildVersion:state.buildVersion,cards:chosen,
      limited:all.length<=3, display:state.display};
    return state.offer;
  }
  const api = {
    get state(){return state;}, candidates,
    gainXp(amount) {
      if(state.ended||!Number.isFinite(amount)||amount<=0)return 0;
      state.xp+=amount;let levels=0;
      while(state.xp>=state.xpNext){state.xp-=state.xpNext;state.level++;state.xpNext=fixedXpForLevel(state.level);state.pendingLevels++;levels++;}
      return levels;
    },
    offer(){return state.offer || makeOffer();},
    choose(token, id, ownerId) {
      const offer=state.offer;
      if(state.ended||!offer||!state.pendingLevels||token.runId!==runId||token.offerId!==offer.offerId||token.buildVersion!==state.buildVersion)return false;
      const card=offer.cards.find(c=>c.id===id&&c.ownerId===ownerId);
      if(!card||!candidates(true).some(c=>c.id===id&&c.ownerId===ownerId))return false;
      if(card.temporary)state.tactics[ownerId]={id,remaining:30};
      else (state.nodes[ownerId] ||= []).push(id);
      state.selections++;state.buildVersion++;state.pendingLevels--;state.offer=null;
      state.history.push({id,ownerId,selection:state.selections,level:state.level});
      return true;
    },
    reroll(token) {
      if(state.ended||!state.offer||!state.rerolls||token?.offerId!==state.offer.offerId||token.runId!==runId||token.buildVersion!==state.buildVersion)return false;
      state.rerolls--;makeOffer(true);return true;
    },
    tick(dt,hasTargets){if(state.ended||!hasTargets||state.offer)return;for(const [id,t] of Object.entries(state.tactics)){t.remaining-=dt;if(t.remaining<=0)delete state.tactics[id];}},
    focus(ownerId){if(!loadout.weapons.some(w=>w.id===ownerId)||state.offer)return false;state.focus=ownerId;return true;},
    snapshot(){return structuredClone({version:1,loadout,state});},
    restore(snapshot){
      if(snapshot.version!==1||snapshot.state?.runId!==runId||JSON.stringify(snapshot.loadout)!==JSON.stringify(loadout)||snapshot.state.buildVersion!==state.buildVersion||snapshot.state.selections!==state.selections||snapshot.state.offerSerial!==state.offerSerial||snapshot.state.ended!==state.ended||snapshot.state.xp!==state.xp||snapshot.state.pendingLevels!==state.pendingLevels||JSON.stringify(snapshot.state.tactics)!==JSON.stringify(state.tactics))return false;
      state=structuredClone(snapshot.state);return true;
    },
    end(){state.ended=true;state.offer=null;},
  };
  return api;
}
