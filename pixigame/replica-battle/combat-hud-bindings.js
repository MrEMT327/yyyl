import {syncBossHud} from '../src/ui/boss-encounter-hud.js';
import { nativeWeaponDisplayText } from '../src/replica/native-weapon-display.js';
import {createBattleUiFrame} from './battle-ui-frame.js';
import { bindCloudPointerInput } from './cloud-pointer-input.js';
import {resizeCombatViewport,resizeCloudCombatViewport} from './cloud-combat-viewport.js';
import { createUpgradeSelectionLayer } from '../src/ui/upgrade-selection-layer.js';
import { Container } from '../src/three/display.js';
import { createPixiCombatUi } from '../src/ui/pixi-lobby.js';
import {loadCombatUiTexture} from '../src/ui/combat-art.js';
import { battleCardIconUrl } from '../src/replica/battle-card-art.js';
import { battleSkillDescription as description } from './battle-hud-flow';
import { assessReplicaBattle } from '../src/replica/native-battle-rating.js';
import { battleSkillPresentation } from '../src/replica/native-quality.js';
import { battleChoiceElement } from '../src/replica/battle-weapon-element.js';
import { battleChoiceProgress } from '../src/ui/battle-choice-progress.js';
import { nativeResultRows, nativeResultRecommendations } from './result-presentation.js';
import { aircraftUiImage } from '../src/aircraft-ui-images.js';
import { cloudAssetBase } from '../src/ui/cloud-asset-base.js';
import { BATTLE_REVIVE_DIAMONDS } from '../src/replica/battle-revive-purchase.js';
import { readWeaponAppearances } from './weapon-appearance';

export function bindCombatHud({stage,ui,sim,audio,signal,requestReviveAd,requestDiamondRevive,aircraftId,hudHost,reducedMotion},
  {canvas,renderer,pixelRatio,nativeHudTiles,mount,draw,setPhase,disposeRenderer}){
  if(signal?.aborted){disposeRenderer();throw new DOMException('Battle closed during UI loading','AbortError');}
  const scene=new Container(),textures=new Map();
  const selectionLayer=createUpgradeSelectionLayer(scene);
  const warmPanelTexture=hudHost?.warmPanelTexture??hudHost?.warmSupplyTexture;
  const keyFor=card=>{
    const url=battleCardIconUrl(card),key=url;
    if(url&&!textures.has(key)){
      const texture=loadCombatUiTexture(url,true,undefined,art=>{if(!disposed)warmPanelTexture?.(art);});
      texture.userData.inventoryIcon=true;
      texture.userData.skillIconUrl=url;
      textures.set(key,texture);
    }
    return key;
  };
  const currentWeapons=()=>ui.equippedWeapons().map(weapon=>{
    const family=Object.values(sim.content.combat.families).find(f=>f.entityId===weapon.entityId);
    const state=weapon.entityId===sim.content.chapter.player.weaponEntityId?sim.cannon:sim.secondary.get(weapon.entityId);
    const card={id:state?.stageId,star:weapon.star,group:family?.id,icon:weapon.icon};
    const stage=family?.stages.find(row=>row.skillId===state?.stageId);
    return {id:String(weapon.entityId),itemId:keyFor(card),name:nativeWeaponDisplayText(weapon.name),level:weapon.star,
      quality:stage?.raw?.Quality??stage?.quality,
      description:description(stage||{})||family?.description||'',slots:[]};
  });
  const currentPassives=()=>{
    // learned is history; one slot per passive family, showing its current tier.
    const latest=new Map();
    for(const card of sim.learned)if(card.id>=11000000)latest.set(card.group,card);
    return [...latest.values()].map(card=>({id:String(card.group),itemId:keyFor(card),
      name:nativeWeaponDisplayText(card.name),icon:card.icon,level:card.star,owner:'被动强化',description:description(card)}));
  };
  const presentation={art:textures,fullStageResultBackdrop:true,fullStagePauseBackdrop:true,fullStageUpgradeBackdrop:true,fullStageSupplyBackdrop:true,exitCopy:'结束战斗，返回航母',grade:'—',hudCoins:0,reroll:false,choices:[],weapons:[],upgrades:[],
    // Only the pause and result screens read this table.
    get damage(){return this.weapons.map(weapon=>({...weapon,damage:sim.damageByWeapon.get(Number(weapon.id))||0})).sort((a,b)=>b.damage-a.damage);},
  };
  const game={state:'ready',stageIndex:sim.content.chapter.chapter.id-1,
    fixedGrowth:{state:{nodes:{},pendingLevels:1,rerolls:0}},fixedLoadout:{weapons:[]},pauseMode:'pause'};
  const bridge={game,presentation,scene,selectionLayer,nativeHudTiles,app:{renderer},ui:{},runStats:{},reducedMotion,
    loadImageSurface:hudHost?.loadImageSurface,warmPanelTexture,preparePanelTextures:hudHost?.preparePanelTextures,
    queueResultWarmup:hudHost?.queueResultWarmup,resultRaysUrl:hudHost?.resultRaysUrl,
    resultRecommendations:()=>resultRecommendations??=nativeResultRecommendations(sim.content.chapter.chapter,sim.content.combat),
    showPauseMenu(){
      if(sim.phase!=='playing'&&sim.phase!=='paused')return;
      game.pauseMode='pause';
      if(sim.phase==='playing')ui.togglePause();
    },
    showExitConfirm(){if(sim.phase==='playing'){ui.togglePause();game.pauseMode='pause';}else game.pauseMode='exit';},
    resumeGame(){game.pauseMode='pause';if(sim.phase==='paused')ui.togglePause();},
    getCombatAudioSettings(){return {...audio.preferences};},
    setCombatAudioSetting(key,enabled){
      if(!['music','effects'].includes(key))return false;
      return audio.setPreference(key,enabled);
    },
    requestAdRevive(){requestReviveAd?.();},
    requestDiamondRevive(){requestDiamondRevive?.();},
    declineRevive(){sim.declineRevive();ui.update();},
    confirmExitRun(){ui.leaveBattle();},finishBattleResult(){ui.leaveBattle();},
    chooseSkill(skill,onStart){
      return ui.chooseFromHud(skill.id,onStart);
    },
    rerollFixedUpgrade(){if(!ui.selecting&&sim.rerollUpgrade())ui.update();},
    startBattleSupply(){ui.advanceBattleSupply();},skipBattleSupply(){ui.advanceBattleSupply();},claimBattleSupply(){ui.advanceBattleSupply();},
    finishSupplyWithoutArtwork(pickup){
      // The treasure has already applied its rewards; only close its presentation.
      Promise.resolve().then(()=>{
        if(disposed||sim.phase!=='treasure'||game.battleSupply!==pickup)return;
        sim.closeTreasure();
        sim.announce(pickup.rewards.length?'战斗补给已领取':'当前武器已无可用强化');
        audio.resume();ui.update();
      });
    },
  };
  let lastSupply='',supply={},lastPhase='',displayPhase='',disposed=false,settlement=null;
  let receiptRun,resultReceipt;
  let resultRecommendations, equipmentRevision=-1, offeredChoices, offeredIds='', supplyWeapons=[];
  let offerRemaining, offerRun, offerBuild;
  function sync(){
    const showingResult=sim.phase==='won'||sim.phase==='lost';
    const phaseChanged=lastPhase!==sim.phase;
    if(settlement&&receiptRun!==sim.runId)settlement=null;
    if(showingResult&&phaseChanged)hudHost?.resultTrace?.start(sim.runId,sim.phase);
    if(lastPhase!==sim.phase){
      game.state=({ready:'ready',playing:'playing',paused:'paused',upgrade:'levelup',treasure:'battle-supply',revive:'revive-prompt',won:'victory_result',lost:'fixed_result'})[sim.phase]||'playing';
      if(sim.phase==='paused')game.pauseMode='pause';
      if(sim.phase==='revive'||sim.phase==='lost')audio.pause();
      if(sim.phase==='lost')audio.effect('project:defeat',.32,1);
      lastPhase=sim.phase;
    }
    // Presentation timestamp survives HUD rebuilds and freezes with sim.clock.
    if(game.runId!==sim.runId||game.waveIndex!==sim.wave)game.waveStartedAt=sim.clock;
    Object.assign(game,{runId:sim.runId,elapsed:sim.clock,stageElapsed:sim.clock,kills:sim.kills,hp:sim.player.hp,level:sim.level,waveIndex:sim.wave,
      waveStatus:{total:sim.content.chapter.chapter.waveCount,completed:Math.max(0,sim.wave-1)},victory:sim.phase==='won'});
    bridge.runStats.maxHp=sim.player.maxHp;
    presentation.hudCoins=sim.gold;
    game.reviveAdPending=sim.revivePending;game.reviveCountdown=sim.reviveCountdown;game.revivesUsed=sim.revivesUsed;
    presentation.fullStageReviveBackdrop=true;
    presentation.reviveDiamondCost=BATTLE_REVIVE_DIAMONDS;
    presentation.canDiamondRevive=sim.canDiamondRevive;
    presentation.canAdRevive=sim.canAdRevive;
    presentation.reviveCopy='恢复全部生命 · 广告复活仅限 1 次';
    // The in-battle grade shows the projected victory rating.
    const assessment=assessReplicaBattle({chapterId:sim.content.chapter.chapter.id,won:sim.phase!=='lost',
      hp:sim.player.hp,maxHp:sim.player.maxHp,revivesUsed:sim.revivesUsed});
    presentation.grade=`${assessment?.stars??0}星`;
    presentation.progress=sim.expProgress;
    bridge.boss=syncBossHud(bridge.boss,sim.boss);
    presentation.bossWarning=ui.bossWarningPresentation;
    // Victory is presented by the result panel; suppress the extra field notice.
    game.battleNotice=sim.notice!=='战斗胜利'&&sim.noticeUntil>sim.clock?{text:sim.notice,at:sim.clock,duration:1}:null;
    const equipmentChanged=equipmentRevision!==sim.equipmentRevision;
    if(equipmentChanged){
      presentation.weapons=currentWeapons();
      presentation.upgrades=currentPassives();
      game.fixedGrowth.state.nodes=Object.fromEntries(presentation.weapons.map(w=>[w.id,Array(Math.max(0,w.level-1)).fill('native')]));
      equipmentRevision=sim.equipmentRevision;
    }
    game.fixedLoadout.weapons=presentation.weapons;
    bridge.currentUpgradeChoices=sim.choices;
    if(sim.phase==='upgrade'){
      const choicesChanged=offeredChoices!==sim.choices, remaining=sim.rerollsRemaining, build=sim.learned.length;
      const growth=game.fixedGrowth.state;
      growth.totalRerolls=sim.rerollsTotal;
      presentation.reroll=growth.totalRerolls>0;
      growth.rerolls=sim.canRerollUpgrade?remaining:0;
      if(choicesChanged||equipmentChanged||phaseChanged){
        offeredChoices=sim.choices;
        offeredIds=offeredChoices.map(c=>c.id).join(',');
        presentation.choices=offeredChoices.map(card=>({skill:card,summary:description(card),slots:[],model:{
          itemId:keyFor(card),ownerId:String(card.group),name:nativeWeaponDisplayText(card.name),...battleSkillPresentation(card),
          element:battleChoiceElement(card,sim.content.combat),progress:battleChoiceProgress(card,sim.content.combat.families[card.group]),
          terminal:false,stat:{label:'强化效果',after:''},change:{label:'强化效果',value:''},
        }}));
      }
      if(choicesChanged||phaseChanged||offerRemaining!==remaining||offerRun!==sim.runId||offerBuild!==build){
        growth.offer={runId:sim.runId,offerId:`${offeredIds}:reroll:${remaining}`,buildVersion:build};
        offerRemaining=remaining;offerRun=sim.runId;offerBuild=build;
      }
    }else if(offeredChoices){
      offeredChoices=undefined;presentation.choices=[];
      // The detached outgoing choice card still uses the offer's run identity
      // during its handoff. Clear the contents but keep that run until reset.
      game.fixedGrowth.state.offer={runId:sim.runId,offerId:'',buildVersion:sim.learned.length};
    }
    if(game.fixedGrowth.state.offer?.runId!==sim.runId)
      game.fixedGrowth.state.offer={runId:sim.runId,offerId:'',buildVersion:sim.learned.length};
    if(showingResult&&(phaseChanged||presentation.result?.runId!==sim.runId||resultReceipt!==settlement)){
      resultRecommendations ??= nativeResultRecommendations(sim.content.chapter.chapter,sim.content.combat);
      resultReceipt=settlement;
      presentation.resultRevision=(presentation.resultRevision??0)+1;
      presentation.result={runId:sim.runId,chapterId:sim.content.chapter.chapter.id,wave:sim.wave,kills:sim.kills,pending:!settlement,trial:Boolean(settlement?.trial),
        aircraftImage:aircraftUiImage(aircraftId || 'pilot-01','default')?.replace(/^.*?art\//,`${cloudAssetBase}art/`),
        recommendations:resultRecommendations,
        stageName:sim.content.chapter.chapter.name,grade:presentation.grade,stars:assessment?.stars??0,
        stats:[['用时',`${String(Math.floor(sim.clock/60)).padStart(2,'0')}:${String(Math.floor(sim.clock%60)).padStart(2,'0')}`],['击破',String(sim.kills)],['等级',String(sim.level)],['造成伤害',String(Math.round(sim.damageDealt))]],
        progress:sim.phase==='won'?'通关星级':`抵达第 ${sim.wave}/${sim.content.chapter.chapter.waveCount} 波`,
        rows:nativeResultRows(settlement), pilotAffection:settlement?.pilotAffection,
        note:settlement?(settlement.trial?'研究战斗，不计入正式库存':'奖励已存入库存'):'正在保存战斗奖励'};
    } else if(!showingResult)presentation.result=null;
    const board=sim.phase==='treasure'?ui.battleSupplyPresentation:null;
    if(board){
      const key=`${sim.runId}:${board.started}:${board.stage}`;
      const supplyChanged=key!==lastSupply;
      if(supplyChanged){
        lastSupply=key;
        const rewards=sim.treasureRewards,reward=rewards[0]||{icon:'',name:'当前武器已无可用强化'};
        const rewardNames=rewards.map(c=>nativeWeaponDisplayText(c.name)).join('、');
        const weapons=readWeaponAppearances(sim);
        const wrap=(card,index)=>({...card,nativeSkillId:card.id,weaponName:nativeWeaponDisplayText(sim.content.combat.families[card.group]?.name||card.name),name:nativeWeaponDisplayText(card.name),description:description(card),id:`supply:${index}`,ownerId:`supply:${index}`,itemId:keyFor(card),ownerName:rewardNames,key:''});
        supply={chestId:key,phase:board.stage==='result'?'ready':board.stage==='rolling'?'rolling':'idle',
          slots:board.slots.map(wrap),reward:wrap(reward,16),
          rewards:rewards.map((card,index)=>({...wrap(card,16+index),
            breakthroughs:weapons.find(weapon=>weapon.familyId===card.group)?.breakthroughs??0})),
          pickupAt:board.started,revealedAt:board.phaseStarted,
          subtitle:'本局武装强化',rewardNames};
      }
      supply.presentationMotion=board.motion;
      supply.disabled=board.disabled;
      if(supplyChanged||equipmentChanged)supplyWeapons=[...presentation.weapons,...supply.slots,supply.reward];
      game.fixedLoadout.weapons=supplyWeapons;game.battleSupply=supply;
    } else { lastSupply=''; game.battleSupply=null; }
  }
  sync();const cloud=createPixiCombatUi({bridge,parent:scene});bridge.pixiCombatUi=cloud;
  hudHost?.bindResultPanel?.(()=>cloud.resultPanel);
  stage?.classList.add('cloud-ui-mode');mount?.();
  const resize=()=>{
    if(!hudHost)return resizeCloudCombatViewport(stage,canvas,renderer,scene,pixelRatio);
    const {width,height}=hudHost.bounds(),insets=hudHost.safeInsets?.();
    if(!resizeCombatViewport(width,height,renderer,scene,pixelRatio,insets))return false;
    bridge.hudViewport=insets?.menuButton?{width,height,safeTop:insets.top,menuButton:insets.menuButton}:null;
    return true;
  };
  const inputOptions={handlePointer:cloud.handlePointer,getScreen:()=>renderer.screen};
  const input=hudHost?hudHost.bindInput(inputOptions):bindCloudPointerInput({surface:stage,canvas,...inputOptions});
  const stopResize=hudHost?hudHost.watchResize(resize):(()=>{const observer=new ResizeObserver(resize);observer.observe(stage);return ()=>observer.disconnect();})();
  resize();
  const frame=createBattleUiFrame(()=>{
    sync();cloud.update();
    const waitingForPanel=(sim.phase==='won'||sim.phase==='lost')&&!cloud.resultPanel;
    const phase=waitingForPanel?displayPhase||'playing':sim.phase==='treasure'&&!cloud.battleSupplyVisible?'playing':sim.phase;
    if(displayPhase!==phase){
      displayPhase=phase;setPhase(phase,phase==='won'||phase==='lost');
    }
    draw(scene,cloud,selectionLayer);
    if(hudHost?.draws)hudHost.draws.hud++;
  },{
    interval:hudHost?.playingHudInterval,now:hudHost?.now,
    canDefer:()=>sim.phase==='playing'&&lastPhase===sim.phase&&game.runId===sim.runId&&game.waveIndex===sim.wave&&
      game.hp===sim.player.hp&&game.level===sim.level&&equipmentRevision===sim.equipmentRevision&&
      presentation.bossWarning===ui.bossWarningPresentation,
  });
  const update=()=>{if(!disposed)frame.request();};
  const nativeUpdate=ui.update.bind(ui);ui.update=()=>{nativeUpdate();update();};
  const destroy=()=>{if(disposed)return;disposed=true;hudHost?.bindResultPanel?.(null);frame.destroy();if(!hudHost)window.removeEventListener('pagehide',destroy);ui.update=nativeUpdate;stopResize();input.destroy();selectionLayer.destroy();cloud.destroy();for(const texture of textures.values())texture.dispose();textures.clear();disposeRenderer();};
  if(!hudHost)window.addEventListener('pagehide',destroy,{once:true});update();
  return {update,destroy,frame:frame.run,setSettlement(receipt){
    receiptRun=sim.runId;settlement=receipt;
    hudHost?.resultTrace?.receipt(sim.runId,sim.phase);
    update();
  }};
}
