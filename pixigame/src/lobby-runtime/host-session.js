import {createPeripheralSystem} from '../peripheral/system.js';
import {createFrameLoop} from '../frame-loop.js';
import {createLobbyAudio} from './audio.js';
import {CAMPAIGN_STORAGE_KEY,PROFILE_STORAGE_KEY,loadCampaignState,loadProfileState} from './save-state.js';
import {CAMPAIGN as SOURCE_CAMPAIGN} from '../campaign.js';
import {DIFFICULTIES} from '../balance.js';
import {tuneMainlineCampaign} from '../peripheral/balance-tuning.js';
import {replicaChapter,replicaChapterForStage,replicaStageAccessible} from '../replica/chapter-contract.js';
import {preserveReplicaStars,countStars} from '../replica/native-battle-rating.js';
import {getActivePilot} from '../pilots.js';
import {clearLocalGameSave} from '../developer-tools.js';
import {isGameSessionCurrent} from '../platform/game-session-runtime.js';
import {playFreeRewardedAd} from '../platform/local-rewarded-ad-runtime.js';
import {BUILD_IDENTITY} from '../build-info.js';

function browserLobbyHost(scope){
  const runtime=scope.__THUNDER_RUNTIME_GLOBALS__||{};
  const documentRef=runtime.document||scope.document,windowRef=runtime.window||scope.window;
  const shell=documentRef.querySelector('#gameShell');
  if(!shell)throw Error('主界面容器不存在');
  let toastTimer;
  return {
    parent:shell,isCurrent:isGameSessionCurrent,storage:runtime.localStorage||scope.localStorage,
    sessionStorage:runtime.sessionStorage||scope.sessionStorage,
    audio:{windowRef,documentRef,disabled:runtime.audioDisabled===true||new URLSearchParams(windowRef.location.search).get('mute')==='1'},
    frames:{documentRef,requestFrame:callback=>windowRef.requestAnimationFrame(callback),cancelFrame:frame=>windowRef.cancelAnimationFrame(frame)},
    readSharedLoadoutJSON:runtime.readSharedLoadoutJSON,
    setTimeout:windowRef.setTimeout.bind(windowRef),clearTimeout:windowRef.clearTimeout.bind(windowRef),
    playAd:context=>typeof runtime.playRewardedAd==='function'?runtime.playRewardedAd(context):playFreeRewardedAd(),
    restart:()=>windowRef.location.reload(),
    showLobby:()=>shell.classList.add('pixi-lobby-active','peripheral-lobby-active'),
    showToast(message,lobby){
      const node=lobby?.root.querySelector('.pl-toast');if(!node)return;
      node.textContent=message;node.classList.add('is-visible');windowRef.clearTimeout(toastTimer);
      toastTimer=windowRef.setTimeout(()=>node.classList.remove('is-visible'),2667);
    },
    dispose:()=>windowRef.clearTimeout(toastTimer),
  };
}

// This is the sole game host. Combat runs in the existing battle runtime;
// no hidden world, host WebGL renderer, projectile arrays or legacy HUD exists.
export async function startLobbySession({
  scope=globalThis,platformKind='wechat',app,mountLobby,createSystem=createPeripheralSystem,deferPortraits=false,sessionHost=null,
  createBattle,createAudio=createLobbyAudio,frameLoop=createFrameLoop,
  loadDetails=async (configuration, readShared)=>(await import('../replica/native-loadout-details.js')).replicaLoadoutDetails(configuration, readShared),
}={}){
  const host=sessionHost||browserLobbyHost(scope);
  const {storage,sessionStorage}=host;
  const deferFirstSortieLobby=Boolean(host.showFirstSortieRetry);
  if(!host.isCurrent())throw Error('当前页面已停止运行，请重新进入游戏');
  const stages=tuneMainlineCampaign(SOURCE_CAMPAIGN);
  const profile=loadProfileState(storage),campaign=loadCampaignState(storage,stages,DIFFICULTIES);
  const game={state:'menu',callsign:profile.playerName,stageIndex:campaign.selected};
  let selectedStage=campaign.selected,activeTab='battle',closed=false,closing=false,adPending=false,lobby,battle,frames,detailsTimer;
  let detailsPending,detailsPendingKey='',detailsResolvedKey='',detailsFailedKey='';
  let stateRevision = 0, observedRevision = -1;
  const canWrite=()=>!closed&&host.isCurrent();
  const saveProfile=()=>{if(canWrite())storage.setItem(PROFILE_STORAGE_KEY,JSON.stringify(profile));};
  const saveCampaign=()=>{
    if(!canWrite())return;
    Object.assign(campaign,{selected:selectedStage,selectedDifficulty:'easy',version:4});
    try{storage.setItem(CAMPAIGN_STORAGE_KEY,JSON.stringify(campaign));}catch{/* Existing storage failure semantics. */}
  };
  const selectStage=index=>{selectedStage=Math.max(0,Math.min(stages.length-1,Math.floor(Number(index)||0)));game.stageIndex=selectedStage;saveCampaign();};
  const toast=message=>{
    if(app?.renderer?.toast)app.renderer.toast.show(message);
    else host.showToast?.(message,lobby);
  };
  async function playAd(context){
    if(closed)throw Error('当前页面已停止运行');
    if(adPending)throw Error('广告正在播放，请稍候');adPending=true;
    try{
      const result=await host.playAd(context);
      if(result===false||result?.completed===false||result?.success===false||(result?.status&&result.status!=='completed')||(result?.code!=null&&Number(result.code)!==10001))throw Error('需完整观看广告才能获得奖励');
      if(closed)throw Error('当前页面已停止运行');
      return {completed:true};
    }finally{adPending=false;}
  }
  const system=createSystem({storage,profile,stages,canWrite,getCampaign:()=>({...campaign}),saveProfile,
    onChange:()=>{stateRevision++;},
    selectStage,getSelectedStage:()=>selectedStage,playShopAd:playAd,playPatrolAd:playAd});
  const audio=createAudio({game,storage,...host.audio});
  function recordProgress(result){
    if(closed||!result.won||result.abandoned||result.trial)return;
    const chapter=replicaChapter(result.chapterId??1);if(!chapter||!stages[chapter.stageIndex])return;
    const key=`${stages[chapter.stageIndex].id}:easy`,starMask=preserveReplicaStars(system.state.replicaCampaign.starMasks?.[chapter.id],result);
    campaign.results[key]={...campaign.results[key],cleared:true,stars:countStars(starMask),starMask,
      replica:{engine:'danke-replica-v1',runId:result.runId,clock:result.clock,kills:result.kills,wave:result.wave,gold:result.gold,damageDealt:result.damageDealt}};
    campaign.highestCleared=Math.max(campaign.highestCleared,chapter.stageIndex);
    const next=replicaChapterForStage(chapter.stageIndex+1);if(next)campaign.highestUnlocked=Math.max(campaign.highestUnlocked,next.stageIndex);
    saveCampaign();
  }
  for(const result of system.replicaResults)recordProgress(result);
  if(!replicaStageAccessible(selectedStage,system.state.replicaCampaign.highestUnlocked))selectStage(system.state.replicaCampaign.highestUnlocked);
  async function getLoadoutDetails(){
    if(closed)throw Error('当前页面已停止运行');
    const configuration=system.replicaConfiguration(),key=JSON.stringify(configuration);
    if(detailsPendingKey===key&&detailsPending)return detailsPending;
    const pending=Promise.resolve().then(()=>loadDetails(configuration, host.readSharedLoadoutJSON)).then(result=>{
      if(closed||JSON.stringify(system.replicaConfiguration())!==key)throw Error('装备已变化，请重新读取属性');
      if(system.acceptReplicaLoadoutDetails(result))stateRevision++;
      detailsResolvedKey=key;detailsFailedKey='';return result;
    }).catch(error=>{detailsFailedKey=key;throw error;}).finally(()=>{if(detailsPending===pending){detailsPending=null;detailsPendingKey='';}});
    detailsPending=pending;detailsPendingKey=key;return pending;
  }
  function scheduleDetails(){
    if(closed||detailsTimer!=null)return;
    const key=JSON.stringify(system.replicaConfiguration());
    if([detailsPendingKey,detailsResolvedKey,detailsFailedKey].includes(key))return;
    // Render the interactive lobby before parsing the optional attribute catalog.
    detailsTimer=host.setTimeout(()=>{detailsTimer=null;if(!closed)void getLoadoutDetails().catch(()=>{});},200);
  }
  const startGame=options=>closed?Promise.resolve(false):battle.start({trial:options?.trial===true,chapterId:selectedStage+1});
  const bridge={buildIdentity:BUILD_IDENTITY,gameplayVersion:sessionHost?'three-wechat':platformKind==='h5'?'three-h5':'wechat-lobby-v2',platformKind,app,game,profileState:profile,campaignState:campaign,
    debugToolsEnabled:true,getActivePilot,get activeLobbyTab(){return activeTab;},get selectedStageIndex(){return selectedStage;},
    getPeripheralSnapshot(){
      const value=system.snapshot();observedRevision=stateRevision;
      if(!deferFirstSortieLobby||game.state==='menu'&&!value.firstSortieRequired)scheduleDetails();
      return value;
    },
    getPeripheralClock(){return observedRevision===stateRevision ? system.lobbyClock?.() : null;},
    getReplicaLoadoutDetails:getLoadoutDetails,
    switchLobbyTab(value){activeTab=value;},startGame,
    peripheralAction(action,payload={}){
      if(closing||!canWrite()||game.state!=='menu')return {ok:false,message:'请先完成当前出击'};
      if(action==='start'){
        const selection=system.action('selectStage',{index:Number(payload.index??payload.stageIndex??selectedStage)});if(!selection.ok)return selection;
        return startGame().then(started=>({ok:Boolean(started),started:Boolean(started),message:started?'':'出击未开始，请检查体力或资源加载状态'}));
      }
      // The mounted action controller renders its committed receipt once.
      // Do not render an intermediate full page from this service as well.
      const commit=()=>{
        if(closing||!canWrite()||game.state!=='menu')return {ok:false,message:'请先完成当前出击'};
        const result=audio.feedback.run(action,payload,()=>system.action(action,payload),()=>system.snapshot());
        const finish=receipt=>{if(receipt?.ok&&action==='renamePlayer')game.callsign=receipt.playerName;return receipt;};
        return result?.then?result.then(finish):finish(result);
      };
      const preparation=host.prepareAction?.(action,payload);
      return preparation ? preparation.then(commit,error=>{
        console.warn('[peripheral action preparation]',action,error?.message||error);
        return {ok:false,message:'随机数暂不可用，本次未消耗资源，请重试'};
      }) : commit();
    },
    unlockAudio:()=>audio.unlock(),playUiClick:()=>audio.click(),playUiFeedback:key=>audio.feedback.present(key),
    getCombatAudioSettings:()=>audio.getSettings(),setCombatAudioSetting:(key,value)=>audio.setSetting(key,value),
    clearGameSaveAndRestart(){
      if(closed||game.state!=='menu'||adPending)return {ok:false,message:'请先结束战斗或广告，再清空存档'};
      const access=system.developerToolsAccess({reset:true});if(!access.ok)return access;
      try{clearLocalGameSave(storage,sessionStorage);}catch(error){return {ok:false,message:error.message};}
      host.restart();return {ok:true};
    },
    closeGameSession({save=true}={}){
      if(closed||closing)return;closing=true;
      try{if(save)battle?.leavePage();}finally{
        closed=true;
        battle?.dispose();frames?.destroy();lobby?.destroy();audio.destroy();
        host.clearTimeout(detailsTimer);host.dispose?.();game.state='session-stopped';
      }
    },
  };
  battle=createBattle({peripheral:()=>system,requestReviveAd:playAd,onProgress:recordProgress,onState(){},
    onEnter(){if(closed)return;audio.feedback.stop();game.state='replica-battle';frames?.stop();lobby?.setVisible(false);audio.sync();},
    onLeave(){
      if(closed||closing)return;
      game.state='menu';
      const firstSortie=deferFirstSortieLobby&&lobby?.snapshot?.firstSortieRequired;
      if(firstSortie&&system.snapshot().firstSortieRequired){
        host.showFirstSortieRetry();
        return;
      }
      activeTab='battle';lobby?.switchTab('battle');lobby?.setVisible(true);frames?.start();
      if(firstSortie){audio.unlock();lobby?.startPortraits?.();}
      audio.sync();
    },
    onError(message){console.error('[replica battle]',message);toast(message);},
  });
  try{
    host.showLobby?.();
    lobby=mountLobby({bridge,parent:host.parent,system,deferPortraits,deferFirstSortieLobby});bridge.pixiLobby=lobby;
    frames=frameLoop((_time,delta)=>lobby.update(delta/1000),host.frames);
    frames.start();scope.__THUNDER_ORIGINAL_GAME__=bridge;return bridge;
  }catch(error){bridge.closeGameSession({save:false});throw error;}
}
