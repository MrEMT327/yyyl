import { bindCloudPointerInput } from './cloud-pointer-input.js';
import { Container, WebGLRenderer } from '../src/three/display.js';
import { createPixiCombatUi } from '../src/ui/pixi-lobby.js';
import { TextureLoader, SRGBColorSpace } from 'three';
import { battleCardIconUrl } from '../src/replica/battle-card-art.js';
import { effectDescription } from './kernel/ui';
import './cloud-combat.css';
import { assessReplicaBattle } from '../src/replica/native-battle-rating.js';
import { battleSkillPresentation } from '../src/replica/native-quality.js';
import { nativeResultRows, nativeResultRecommendations } from './result-presentation.js';

// The cloud UI is a read-only view of the original simulation. The hidden
// original Interface remains the sole owner of choose/punchboard event timing.
export async function mountCloudCombat({stage,ui,sim,audio,signal,requestReviveAd,onGraphicsContext}) {
  const canvas=document.createElement('canvas');canvas.className='cloud-combat-canvas';
  canvas.setAttribute('aria-label','战斗界面');
  const context=canvas.getContext('webgl2',{alpha:true,antialias:true});
  if(!context)throw new Error('无法初始化云端战斗界面');
  const renderer=new WebGLRenderer();
  await renderer.init({canvas,context,uiOnly:true,width:600,height:1300,resolution:Math.min(devicePixelRatio||1,2)});
  if(signal?.aborted){renderer.destroy(true);renderer.three.forceContextLoss();throw new DOMException('Battle closed during UI loading','AbortError');}
  onGraphicsContext?.(canvas,context);
  renderer.three.setClearColor(0,0);renderer.setBloomEnabled(false);
  const scene=new Container(),textures=new Map(),loader=new TextureLoader();
  const keyFor=card=>{
    const url=battleCardIconUrl(card),key=url||`native:${card.icon}`;
    if(url&&!textures.has(key)){const texture=loader.load(url);texture.colorSpace=SRGBColorSpace;texture.userData.inventoryIcon=true;textures.set(key,texture);}
    return key;
  };
  const description=card=>card.description||String(card.descriptionSource||'').replace(/\{(\d+)\}/g,(match,index)=>card.descriptionArgsSource?.[Number(index)]??match)||effectDescription(card.effects||[]);
  const currentWeapons=()=>ui.equippedWeapons().map(weapon=>{
    const family=Object.values(sim.content.combat.families).find(f=>f.entityId===weapon.entityId);
    const state=weapon.entityId===sim.content.chapter.player.weaponEntityId?sim.cannon:sim.secondary.get(weapon.entityId);
    const card={id:state?.stageId,star:weapon.star,group:family?.id,icon:weapon.icon};
    return {id:String(weapon.entityId),itemId:keyFor(card),name:weapon.name,level:weapon.star,slots:[]};
  });
  const currentPassives=()=>{
    // learned is history; one slot per passive family, showing its current tier.
    const latest=new Map();
    for(const card of sim.learned)if(card.id>=11000000)latest.set(card.group,card);
    return [...latest.values()].map(card=>({id:String(card.group),itemId:keyFor(card),
      name:card.name,icon:card.icon,level:card.star,owner:'被动强化',description:description(card)}));
  };
  const presentation={art:textures,fullStageResultBackdrop:true,fullStagePauseBackdrop:true,fullStageUpgradeBackdrop:true,exitCopy:'结束战斗，返回航母',grade:'—',score:'—',reroll:false,choices:[],weapons:[],upgrades:[]};
  const game={state:'ready',stageIndex:sim.content.chapter.chapter.id-1,skills:{},activeWeapons:[],fixedPartsMode:true,
    fixedGrowth:{state:{nodes:{},pendingLevels:1,rerolls:0}},fixedLoadout:{weapons:[]},pauseMode:'pause'};
  const clickNative=action=>ui.overlay.querySelector(`button[data-action="${action}"]`)?.click();
  const bridge={game,presentation,scene,app:{renderer},ui:{},runStats:{},
    showPauseMenu(){
      if(sim.phase!=='playing'&&sim.phase!=='paused')return;
      game.pauseMode='pause';
      if(sim.phase==='playing')ui.togglePause();
    },
    showExitConfirm(){if(sim.phase==='playing'){ui.togglePause();game.pauseMode='pause';}else game.pauseMode='exit';},
    resumeGame(){game.pauseMode='pause';if(sim.phase==='paused')ui.togglePause();},
    getCombatAudioSettings(){return {sound:audio.enabled};},
    setCombatAudioSetting(key,enabled){
      if(key!=='sound')return false;
      if(audio.enabled!==enabled)audio.toggle();
      if(sim.phase==='paused')audio.pause();
      return true;
    },
    requestAdRevive(){requestReviveAd?.();},
    declineRevive(){sim.declineRevive();ui.update();},
    confirmExitRun(){clickNative('home');},finishBattleResult(){clickNative('home');},
    chooseSkill(skill){const button=ui.overlay.querySelector(`button[data-action="choose"][data-id="${skill.id}"]`);if(button)ui.selectCard(button);},
    rerollFixedUpgrade(){if(!ui.selecting&&sim.rerollUpgrade())ui.update();},
    startBattleSupply(){clickNative('punchboard');},skipBattleSupply(){clickNative('punchboard');},claimBattleSupply(){clickNative('punchboard');},
  };
  let lastSupply='',supply={},lastPhase='',disposed=false,settlement=null;
  function sync(){
    game.state=({ready:'ready',playing:'playing',paused:'paused',upgrade:'levelup',treasure:'battle-supply',revive:'revive-prompt',won:'victory_result',lost:'fixed_result'})[sim.phase]||'playing';
    stage.classList.toggle('cloud-result-visible',sim.phase==='won'||sim.phase==='lost');
    stage.classList.toggle('cloud-pause-visible',sim.phase==='paused');
    stage.classList.toggle('cloud-upgrade-visible',sim.phase==='upgrade');
    if(lastPhase!==sim.phase){if(sim.phase==='paused')game.pauseMode='pause';lastPhase=sim.phase;}
    Object.assign(game,{elapsed:sim.clock,stageElapsed:sim.clock,kills:sim.kills,hp:sim.player.hp,level:sim.level,waveIndex:sim.wave,
      waveStatus:{total:sim.content.chapter.chapter.waveCount,completed:Math.max(0,sim.wave-1)},victory:sim.phase==='won'});
    bridge.runStats.maxHp=sim.player.maxHp;
    game.reviveAdPending=sim.reviveAdPending;game.reviveCountdown=sim.reviveCountdown;
    presentation.reviveCopy='恢复全部生命 · 广告复活仅限 1 次';
    const assessment=assessReplicaBattle({chapterId:sim.content.chapter.chapter.id,won:sim.phase==='won',
      hp:sim.player.hp,maxHp:sim.player.maxHp,revivesUsed:sim.revivesUsed});
    const potential=assessReplicaBattle({chapterId:sim.content.chapter.chapter.id,won:true,
      hp:sim.player.hp,maxHp:sim.player.maxHp,revivesUsed:sim.revivesUsed});
    presentation.grade=`${(sim.phase==='won'||sim.phase==='lost'?assessment:potential)?.stars??0}星`;
    presentation.progress=sim.expProgress;
    bridge.boss=sim.boss?{hp:sim.boss.hp,maxHp:sim.boss.maxHp,visualSpec:{name:sim.boss.name||'旗舰'}}:null;
    game.battleNotice=sim.noticeUntil>sim.clock?{text:sim.notice,at:sim.clock,duration:1}:null;
    presentation.weapons=currentWeapons();game.fixedLoadout.weapons=presentation.weapons;
    presentation.upgrades=currentPassives();
    presentation.damage=presentation.weapons.map(weapon=>({...weapon,damage:sim.damageByWeapon.get(Number(weapon.id))||0})).sort((a,b)=>b.damage-a.damage);
    game.fixedGrowth.state.nodes=Object.fromEntries(presentation.weapons.map(w=>[w.id,Array(Math.max(0,w.level-1)).fill('native')]));
    bridge.currentUpgradeChoices=sim.choices;
    presentation.reroll=sim.rerollsTotal>0;
    game.fixedGrowth.state.rerolls=sim.canRerollUpgrade?sim.rerollsRemaining:0;
    game.fixedGrowth.state.totalRerolls=sim.rerollsTotal;
    presentation.choices=sim.choices.map(card=>({skill:card,summary:description(card),slots:[],model:{
      itemId:keyFor(card),ownerId:String(card.group),name:card.name,...battleSkillPresentation(card),
      terminal:false,stat:{label:'强化效果',after:''},change:{label:'强化效果',value:''},
    }}));
    game.fixedGrowth.state.offer={runId:sim.runId,offerId:`${sim.choices.map(c=>c.id).join(',')}:reroll:${sim.rerollsRemaining}`,buildVersion:sim.learned.length};
    presentation.result={runId:sim.runId,chapterId:sim.content.chapter.chapter.id,wave:sim.wave,kills:sim.kills,pending:!settlement,trial:Boolean(settlement?.trial),
      recommendations:nativeResultRecommendations(sim.content.chapter.chapter,sim.content.combat),
      stageName:sim.content.chapter.chapter.name,grade:`${assessment?.stars??0}星`,stars:assessment?.stars??0,
      stats:[['用时',`${String(Math.floor(sim.clock/60)).padStart(2,'0')}:${String(Math.floor(sim.clock%60)).padStart(2,'0')}`],['击破',String(sim.kills)],['等级',String(sim.level)],['造成伤害',String(Math.round(sim.damageDealt))]],
      progress:sim.phase==='won'?'通关星级':`抵达第 ${sim.wave}/${sim.content.chapter.chapter.waveCount} 波`,
      rows:nativeResultRows(settlement),
      note:settlement?(settlement.trial?'研究战斗，不计入正式库存':'奖励已存入库存'):'正在保存战斗奖励'};
    if(sim.phase==='treasure'){
      const board=ui.punchboard,key=`${sim.runId}:${board.started}:${board.stage}`;
      const rewards=sim.treasureRewards,slots=board.slots||[],reward=rewards[0]||{icon:'',name:'当前武器已无可用强化'};
      const wrap=(card,index)=>({...card,id:`supply:${index}`,ownerId:`supply:${index}`,itemId:keyFor(card),ownerName:rewards.map(c=>c.name).join('、'),key:''});
      if(key!==lastSupply){lastSupply=key;supply={chestId:key,phase:board.stage==='result'?'ready':board.stage==='rolling'?'rolling':'idle',
        slots:slots.map(wrap),reward:wrap(reward,16),pickupAt:board.started,revealedAt:board.phaseStarted,
        subtitle:'本局武装强化',rewardNames:rewards.map(c=>c.name).join('、')};}
      const elapsed=(performance.now()-board.phaseStarted)/1000,steps=board.steps||[],index=steps.findLastIndex(s=>s.at<=elapsed);
      supply.presentationMotion={index:board.stage==='result'?(board.stops?.[0]??-1):steps[index]?.slot??-1,step:index};
      supply.disabled=Boolean(board.button?.disabled||board.button?.hidden);
      game.fixedLoadout.weapons=[...presentation.weapons,...slots.map(wrap),wrap(reward,16)];game.battleSupply=supply;
    } else game.battleSupply=null;
  }
  sync();const cloud=createPixiCombatUi({bridge,parent:scene});bridge.pixiCombatUi=cloud;
  stage.append(canvas);stage.classList.add('cloud-ui-mode');
  const resize=()=>{const width=Math.min(stage.clientWidth,stage.clientHeight*600/1300);canvas.style.width=`${width}px`;canvas.style.height=`${width*1300/600}px`;};
  const observer=new ResizeObserver(resize);observer.observe(stage);resize();
  const input=bindCloudPointerInput({surface:stage,canvas,handlePointer:cloud.handlePointer});
  const update=()=>{if(disposed)return;sync();cloud.update();renderer.render({container:scene});};
  const nativeUpdate=ui.update.bind(ui);ui.update=()=>{nativeUpdate();update();};
  const destroy=()=>{if(disposed)return;disposed=true;stage.classList.remove('cloud-result-visible','cloud-pause-visible','cloud-upgrade-visible');window.removeEventListener('pagehide',destroy);ui.update=nativeUpdate;observer.disconnect();input.destroy();cloud.destroy();for(const texture of textures.values())texture.dispose();textures.clear();renderer.destroy(true);renderer.three.forceContextLoss();};
  window.addEventListener('pagehide',destroy,{once:true});update();
  return {update,destroy,setSettlement(receipt){settlement=receipt;update();}};
}
