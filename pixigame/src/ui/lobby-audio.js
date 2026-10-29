import {FEEDBACK_SOUNDS} from './feedback-sounds.js';
import {actionRewards} from './reward-feedback-policy.js';
// Semantic UI feedback: one committed operation produces at most one sound.
export const LOBBY_SOUNDS = Object.freeze({
  ...Object.fromEntries(Object.entries(FEEDBACK_SOUNDS).map(([key,cue])=>[key,{...cue,file:`../${cue.file}`} ])),
  error: {file:'stamina_depleted.wav',gain:0.055,interval:0.35},
  click: {file:'button_click.wav',gain:0.14},
  confirm: {file:'confirm_sound.wav',gain:0.075},
  buy: {file:'buy_sound.wav',gain:0.13},
  equip: {file:'attach_sound.wav',gain:0.15},
  combine: {file:'combine_sound.wav',gain:0.28},
  unlock: {file:'unlock_sound.wav',gain:0.14},
});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const rewardActions=new Set(['claimSignIn','claimTask','claimActivity','claimAchievement','claimPatrol','quickPatrol','quickPatrolAd','claimStarReward','gearClaimBasicReward','backpackUse','recoverDailyRewards']);
const supported=new Set(['researchDraw','gearSupply','pilotSupply','recruit',...rewardActions,'renamePlayer','shopBuy','shopRefresh','gearEquip','gearUnequip','gearLock','gearUpgrade','gearUpgradeAll','gearDowngrade','gearMerge','gearBatch','fleetActivate','fleetStarUp','fleetSkillEquip','fleetSkillRemove','selectPilot','selectAircraft','equipWeapon','selectReplicaLoadout']);
export function hasLobbyFeedback(action,payload={}) {
  return supported.has(action)||(action==='replicaCollection'&&['select','slot','unlock','star','activate','upgrade'].includes(payload.action));
}
const selection=s=>({pilot:s.pilotId,aircraft:s.aircraftId,loadout:s.loadout,gear:s.equipment?.slots,
  guns:s.replicaLoadout?.guns?.filter(r=>r.equipped).map(r=>r.id),
  pilots:s.replicaLoadout?.pilots?.filter(r=>r.equipped).map(r=>r.id),skin:s.replicaLoadout?.role?.skinId,
  slots:s.replicaLoadout?.skinSkillSlots,pilotSlots:s.fleet?.pilot?.slots,aircraftSlots:s.fleet?.aircraft?.slots});
export function lobbyResultCue(action,payload,result,before,after) {
  // Only explicit rejection of an implemented gesture; cancellations and background recovery stay quiet.
  if(result?.ok===false && hasLobbyFeedback(action,payload) && action!=='recoverDailyRewards'
    && typeof result.message==='string' && result.message.trim()
    && !/广告|取消|进行中|稍候|待保存|待恢复|已记录/.test(result.message))return 'error';
  if(!result?.ok||!before||!after)return null;
  // Animation presenters own these receipts; a success click would double-play.
  if(action==='researchDraw'||action==='pilotSupply'||action==='recruit')return null;
  if(result.gearResult?.operation==='supply')return result.gearResult.drawn?.length?'boxReveal':null;
  if(rewardActions.has(action))return actionRewards(result,before,after).length?'reward':null;
  if(action==='replicaCollection') {
    const a=before.replicaCollection?.[payload.kind]?.find(r=>r.id===payload.id);
    const b=after.replicaCollection?.[payload.kind]?.find(r=>r.id===payload.id);
    if(!a||!b)return null;
    if(['unlock','activate'].includes(payload.action))return !(a.owned??a.active)&&(b.owned??b.active)?'unlock':null;
    if(payload.action==='star')return b.star>a.star?'combine':null;
    if(payload.action==='upgrade')return b.level>a.level?'confirm':null;
    if(['select','slot'].includes(payload.action))return !same(selection(before),selection(after))?'equip':null;
    return null;
  }
  if(action==='fleetActivate') {
    const rows=payload.kind==='pilot'?'pilots':'aircraft',a=before[rows]?.find(r=>r.id===payload.id),b=after[rows]?.find(r=>r.id===payload.id);
    return a&&b&&!(a.activated??a.owned)&&(b.activated??b.owned)?'unlock':null;
  }
  if(action==='fleetStarUp')return result.stars>result.previousStars?'combine':null;
  if(action==='shopBuy') {
    const item=before.shop?.items?.find(r=>r.id===payload.id);
    return item&&before.shop.token!==after.shop?.token?(item.cost?.amount>0&&item.cost?.type!=='ad'?'buy':'confirm'):null;
  }
  if(action==='shopRefresh')return after.shop?.refresh?.count>before.shop?.refresh?.count?'confirm':null;
  if(action==='renamePlayer')return before.playerName!==after.playerName?'confirm':null;
  if(['gearMerge','gearBatch'].includes(action))return !same(before.equipment?.items,after.equipment?.items)?'combine':null;
  if(['gearLock','gearUpgrade','gearUpgradeAll','gearDowngrade'].includes(action))return !same(before.equipment?.items,after.equipment?.items)||!same(before.equipment?.levels,after.equipment?.levels)?'confirm':null;
  if(supported.has(action))return !same(selection(before),selection(after))?'equip':null;
  return null;
}

export function createLobbyFeedback({play,stop=()=>{},prepare=()=>{},enabled=()=>true,schedule=setTimeout,cancel=clearTimeout}) {
  let timer=null,generation=0;
  const clear=()=>{if(timer!==null)cancel(timer);timer=null;};
  return {
    click(){clear();const turn=++generation;prepare();if(!enabled())return;
      // Operation handlers run in this same event; their success replaces the click.
      timer=schedule(()=>{timer=null;if(turn===generation&&enabled())play('click');},40);
    },
    run(action,payload,operation,snapshot){
      if(!hasLobbyFeedback(action,payload))return operation();
      clear();const turn=++generation,before=snapshot();prepare();let completed=false;
      const finish=result=>{if(completed)return result;completed=true;
        if(turn===generation&&enabled()){const cue=lobbyResultCue(action,payload,result,before,snapshot());if(cue)play(cue);}
        return result;
      };
      const result=operation();return result?.then?result.then(finish):finish(result);
    },
    present(key){clear();generation++;prepare();if(key&&enabled())play(key);else stop();},
    stop(){clear();generation++;stop();},
  };
}

export function createLobbySoundPlayer({context,enabled,fetchAudio=globalThis.fetch,now=()=>performance.now()}) {
  const buffers=new Map(),lastPlayed=new Map();let serial=0,voice=null;
  async function load(key){
    const ctx=context();if(!ctx)return null;
    if(!buffers.has(key))buffers.set(key,(async()=>{
      const response=await fetchAudio(`/audio/pathogenic/ui/${LOBBY_SOUNDS[key].file}`);
      if(!response.ok)throw new Error(`UI audio ${response.status}`);
      return ctx.decodeAudioData(await response.arrayBuffer());
    })().catch(error=>{buffers.delete(key);console.warn('[lobby audio]',error.message);return null;}));
    return buffers.get(key);
  }
  function stopVoice(){if(!voice)return;const {source,gain,ctx}=voice;voice=null;
    try{gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setValueAtTime(gain.gain.value,ctx.currentTime);gain.gain.linearRampToValueAtTime(0,ctx.currentTime+.015);source.stop(ctx.currentTime+.02);}catch{}
  }
  return {
    prepare(){if(!enabled())return;const ctx=context();if(!ctx)return;ctx.resume().catch(()=>{});for(const key of Object.keys(LOBBY_SOUNDS))void load(key);},
    async play(key){if(!LOBBY_SOUNDS[key]||!enabled())return;const request=++serial,at=now(),buffer=await load(key);
      if(!buffer||request!==serial||!enabled()||now()-at>300)return;
      const ctx=context();if(!ctx||ctx.state!=='running')return;
      const interval=(LOBBY_SOUNDS[key].interval||0)*1000;if(now()-(lastPlayed.get(key)??-Infinity)<interval)return;
      lastPlayed.set(key,now());stopVoice();
      const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;source.loop=false;
      gain.gain.value=LOBBY_SOUNDS[key].gain;source.connect(gain);gain.connect(ctx.destination);
      const current={source,gain,ctx};voice=current;source.onended=()=>{source.disconnect();gain.disconnect();if(voice===current)voice=null;};source.start();
    },
    stop(){serial++;stopVoice();},
  };
}
