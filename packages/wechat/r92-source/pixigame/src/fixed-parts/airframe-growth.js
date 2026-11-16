import { ARSENAL } from './airframe-arsenal.js';
import { fixedXpForLevel } from './growth.js';
import { zbbyWeaponStats } from './zbby-arsenal.js';
import { commonWeaponStats, WEAPON_QUALITIES } from './common-weapons.js';
import { commonTuning } from './common-tunings.js';

const TUNINGS=[['power','聚能','基础伤害 +18%，强化每次命中'],['cadence','疾速','开火间隔缩短 8%，弹幕更密集'],['coverage','扩域','基础攻击宽度 / 爆破半径 +15%，光轨更宽']];
export function createAirframeGrowth(loadout,runId,seed=0x71ac35,catalog=ARSENAL) {
  let state={runId,buildVersion:0,level:1,xp:0,xpNext:fixedXpForLevel(1),pendingLevels:0,selections:0,nodes:{},tactics:{},focus:loadout.weapons[0].id,rng:seed>>>0||1,offer:null,offerSerial:0,display:0,rerolls:2,lastShown:{},history:[],supplyClaims:[],ended:false};
  const rank=id=>(state.nodes[id]||[]).length;
  const evolutionStage=id=>['evolve-1','evolve-2','evolve-3'].filter(key=>(state.nodes[id]||[]).some(n=>n.endsWith(`-${key}`))).length;
  const random=()=>{state.rng^=state.rng<<13;state.rng^=state.rng>>>17;state.rng^=state.rng<<5;state.rng>>>=0;return state.rng/4294967296;};
  function candidates({supply=false}={}){return loadout.weapons.flatMap(w=>{
    const a=catalog[w.itemId],r=rank(w.id),stage=Math.min(5,r+1);
    const tuning=TUNINGS.map(([key,defaultLabel,baseBonus])=>{
      const profile=a.common?commonTuning(a.mechanic,key):null,label=profile?.label||defaultLabel;
      const capped=key==='cadence'&&(state.nodes[w.id]||[]).filter(n=>n.endsWith('-cadence')).length>=13||key==='coverage'&&(state.nodes[w.id]||[]).filter(n=>n.endsWith('-coverage')).length>=10;
      const bonus=capped?'调校达到上限，本次改为基础伤害 +18%':profile?.bonus||baseBonus;
      return {
      id:`AF-${w.itemId}-${r+1}-${key}`,part:`AF-${w.itemId}`,key,rank:r+1,ownerId:w.id,slots:w.slots,itemId:w.itemId,
      ownerName:`${w.innate?'主武器':'通用武器'} · ${a.name}`,name:a.common?`${label} · 战斗调校 ${r+1}`:`${r<5?a.stages[stage]:`极限共鸣 ${r-4}`} · ${label}`,
      description:a.common?`${bonus}。局外${WEAPON_QUALITIES[w.qualityRank||0]}品质只保留基础数值。`:`${r<5?a.changes[stage-1]:'保持终局形态，继续强化本件武器'}；${bonus}。`,
      evolution:a.common?a.qualityRules[0]:r<5?a.changes[stage-1]:'终局形态保持',bonus,color:a.color,airframe:true,terminal:!a.common&&r===4,temporary:false,
      restriction:'仅强化本件武器 · 其他武器保留各自成长',
    };});
    if(!a.common)return tuning;
    const next=evolutionStage(w.id)+1;
    if(next>3||next===3&&!supply&&state.selections<6)return tuning;
    const effects=next===1?`${a.qualityRules[1]} ${a.qualityRules[2]} ${a.qualityRules[3]}`:a.qualityRules[next===2?4:5];
    const labels=['战术改装','核心增幅','终局解放'];
    return [{
      id:`AF-${w.itemId}-evolve-${next}`,part:`AF-${w.itemId}`,key:`evolve-${next}`,rank:next,
      ownerId:w.id,slots:w.slots,itemId:w.itemId,ownerName:`${w.innate?'本机专武':'通用武器'} · ${a.name}`,
      name:`${a.name} · ${labels[next-1]}`,description:`本局解锁：${effects}`,
      evolution:effects,bonus:'',color:a.color,airframe:true,terminal:next===3,temporary:false,
      restriction:next===3?'本件终局 · 仅本局有效':'仅强化本件武器 · 仅本局有效',
    },...tuning];
  });}
  const sameCard=(a,b)=>a.id===b.id&&a.ownerId===b.ownerId;
  function makeOffer(previousCards=[]){
    if(state.ended||!state.pendingLevels)return null;
    const pool=candidates(),cards=[];state.display++;
    // Start with the innate evolution, then follow the player's last choice.
    // Only an available evolution reserves a seat; completed weapons rotate.
    const focusEvolution=pool.find(c=>c.ownerId===state.focus&&c.key.startsWith('evolve-'));
    if(focusEvolution)cards.push(focusEvolution);
    // Show different owners first; a solo starter still receives three valid plans.
    const owners=[...loadout.weapons].sort((a,b)=>(state.lastShown[a.id]||0)-(state.lastShown[b.id]||0));
    for(const w of owners){if(cards.length===3)break;if(cards.some(c=>c.ownerId===w.id))continue;const options=pool.filter(c=>c.ownerId===w.id);cards.push(options[Math.floor(random()*options.length)]);}
    while(cards.length<3){const rest=pool.filter(c=>!cards.some(x=>x.id===c.id&&x.ownerId===c.ownerId));cards.push(rest[Math.floor(random()*rest.length)]);}
    if(previousCards.length&&cards.every(c=>previousCards.some(old=>sameCard(c,old)))){
      // Guarantee a changed option without replacing the focused evolution or
      // collapsing a three-owner offer into two copies of another weapon.
      const ownerCount=Math.min(3,new Set(pool.map(c=>c.ownerId)).size);
      for(let index=cards.length-1;index>=0;index--){
        const alternatives=pool.filter(c=>!previousCards.some(old=>sameCard(c,old))
          &&new Set(cards.map((card,i)=>i===index?c.ownerId:card.ownerId)).size===ownerCount);
        if(alternatives.length){cards[index]=alternatives[Math.floor(random()*alternatives.length)];break;}
      }
    }
    // Distinct stamps within a display prevent stable-sort ties from keeping
    // the first loadout weapon in every offer when five owners share three seats.
    cards.forEach((card,index)=>{state.lastShown[card.ownerId]=state.display*3+index;});
    state.offer={runId,offerId:++state.offerSerial,buildVersion:state.buildVersion,cards,display:state.display,limited:pool.length===3};return state.offer;
  }
  const valid=token=>token?.runId===runId&&token.offerId===state.offer?.offerId&&token.buildVersion===state.buildVersion;
  return {
    get state(){return state;},rank,candidates,
    gainXp(amount){if(state.ended||!Number.isFinite(amount)||amount<=0)return 0;state.xp+=amount;let levels=0;while(state.xp>=state.xpNext){state.xp-=state.xpNext;state.level++;state.xpNext=fixedXpForLevel(state.level);state.pendingLevels++;levels++;}return levels;},
    offer(){return state.offer||makeOffer();},
    choose(token,id,ownerId){
      if(state.ended||!state.pendingLevels||!valid(token)||!state.offer.cards.some(c=>c.id===id&&c.ownerId===ownerId)||!candidates().some(c=>c.id===id&&c.ownerId===ownerId))return false;
      (state.nodes[ownerId]||=[]).push(id);state.selections++;state.buildVersion++;state.pendingLevels--;state.offer=null;state.focus=ownerId;
      state.history.push({id,ownerId,selection:state.selections,level:state.level});return true;
    },
    claimSupply(chestId,id,ownerId){
      if(state.ended||state.offer||!chestId||state.supplyClaims.includes(chestId))return false;
      const candidatesForSupply=candidates({supply:true});
      const evolutions=candidatesForSupply.filter(c=>c.key.startsWith('evolve-'));
      const card=(evolutions.length?evolutions:candidatesForSupply).find(c=>c.id===id&&c.ownerId===ownerId);
      if(!card)return false;
      (state.nodes[ownerId]||=[]).push(id);state.selections++;state.buildVersion++;state.focus=ownerId;
      state.supplyClaims.push(chestId);
      state.history.push({id,ownerId,selection:state.selections,level:state.level,source:'battle-supply',chestId});
      return card;
    },
    reroll(token){
      if(state.ended||!state.rerolls||!valid(token))return false;
      const old=state.offer.cards;
      if(candidates().every(c=>old.some(o=>sameCard(c,o))))return false;
      state.rerolls--;makeOffer(old);return true;
    },
    tick(){},focus(id){if(state.offer||!loadout.weapons.some(w=>w.id===id))return false;state.focus=id;return true;},
    snapshot(){return structuredClone({version:3,loadout,state});},
    restore(snapshot){
      // A pause checkpoint may restore only the exact current build, never another run or old rewards.
      if(snapshot?.version!==3||JSON.stringify(snapshot.loadout)!==JSON.stringify(loadout)||JSON.stringify(snapshot.state)!==JSON.stringify(state))return false;
      state=structuredClone(snapshot.state);return true;
    },
    end(){state.ended=true;state.offer=null;},
  };
}

export function airframeWeaponStats(weapon,growth,catalog=ARSENAL){
  if(catalog[weapon.itemId]?.common)return commonWeaponStats(weapon,growth.state.nodes[weapon.id]||[]);
  const nodes=growth.state.nodes[weapon.id]||[],rank=Math.min(5,nodes.length),a=catalog[weapon.itemId];
  const count=key=>nodes.filter(n=>n.endsWith(`-${key}`)).length;
  const counts=a.counts||(weapon.itemId==='twin'?[1,1,3,3,5,7]:weapon.itemId==='missile'?[1,2,4,4,6,8]:weapon.itemId==='drone'?[1,2,3,3,5,11]:[1,2,3,3,5,7]);
  const power=count('power')+Math.max(0,count('cadence')-13)+Math.max(0,count('coverage')-10);
  if(a.sourceId){const base=zbbyWeaponStats(a,rank);return {...base,rank,damage:base.damage*(1+.18*power),
    interval:base.interval*Math.max(.35,.92**count('cadence')),width:1+.15*Math.min(10,count('coverage')),color:a.color};}
  return {rank,count:counts[rank],damage:a.damage*(1+rank*.22)*(1+.18*power),
    interval:a.interval*Math.max(.35,.92**count('cadence')),width:(1+(rank>=3?.5:rank*.12))*(1+.15*Math.min(10,count('coverage'))),color:a.color};
}
