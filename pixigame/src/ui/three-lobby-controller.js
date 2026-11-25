import {createThreeLobbyGuide} from './three-lobby-guide.js';
import {nextLobbyGuide} from '../peripheral/onboarding.js';
import {weaponCatalogSkills} from './weapon-catalog-skills.js';

import {committedFeedbackRecords,collectionFeedbackRecords,progressionFeedbackRecords} from './process-feedback-model.js';

import { isResourceShortage, shortageToast } from './resource-availability.js';
import { developerSkillsEnabled, setDeveloperSkillsEnabled } from '../developer-battle-settings.js';

import { diagnosticReport } from '../diagnostic-log.js';

import {isCommonReward} from './reward-modal-model.js';
import {isRetainedModalLayer,modalIdentity} from './reward-modal-model.js';

import {playerName} from '../player-identity.js';

import {chapterPresentationForStage} from '../replica/chapter-presentation.js';

import { AIRCRAFTS } from '../pilots.js';
import { COMMON_WEAPONS } from '../fixed-parts/common-weapons.js';

import { performanceMonitor } from '../performance-monitor.js';

import {cloudNativeRecruitSnapshot} from '../replica/recruit-snapshot.js';

import {WORKSHOP_FILTERS} from './workshop-filters.js';
import {recruitItems,recruitFeatured} from './recruit-selection.js';

import {isRecruitResult} from './reward-modal-model.js';

import { researchUnlockMessage } from './research-tabs.js';

import {shopSectionId,shopPurchaseMax,shopOfferQuote,reconcileShopReview} from './shop-offer-model.js';
import {hasLobbyGrowthFeedback} from './lobby-growth-actions.js';

import { actionRewards, rewardReturnModal } from './reward-feedback-policy.js';

import {battleChapterIndex} from './battle-chapter-index.js';
import { PILOT_AFFECTION_MAX, isHiddenPilotAffectionAction, pilotAffectionVideo } from '../peripheral/pilot-affection.js';

import { portraitPresentation } from './character-portraits.js';

import {COMMAND_PANELS} from './lobby-command-kinds.js';

import { WEAPON_EQUIP_SLOTS } from './equipment-labels.js';

import { backpackUseRule } from '../replica/native-backpack-use.js';
import {backpackItems,BACKPACK_TABS} from './backpack-model.js';

import {patrolRenderSignature} from './patrol-clock.js';

import {dailyTabUnlockMessage,isDailyTabAvailable,resolveDailyPeriod} from './daily-tabs.js';
import {taskChestModel} from './task-chest-model.js';

import {emptyGearMerge,gearMergeDraft,pickGearMergeItem,removeGearMergeMaterial} from './gear-merge-selection.js';

const TABS = [{ id: 'shop', title: '商城', icon: 'shop' }, { id: 'assembly', title: '装备', icon: 'weapon' }, { id: 'battle', title: '战役', icon: 'plane' }, { id: 'research', title: '科技研究', icon: 'research' }, { id: 'supply', title: '招募', icon: 'crate' }];
export function createThreeLobbyController({bridge,system,presentation,deferPortraits=false,deferFirstSortieLobby=false}) {
  if (!bridge) throw new TypeError('mountPeripheralLobby requires a bridge');
  const { root, modalRoot, portraitPlayer, focus } = presentation;
  const captureFocus=(region,target)=>focus?.capture(region,target);
  const restoreFocus=(region,opener)=>focus?.restore(region,opener);
  const captureModalScroll=region=>focus?.captureScroll(region);
  const restoreModalScroll=(region,position)=>focus?.restoreScroll(region,position);
  const selectBody=selector=>focus?.body(selector);
  const selectModal=(region,selector)=>focus?.modal(region,selector);
  let modalHost=modalRoot,rewardLayer=null;
  const screen=bridge.app.renderer,actionFeedback=screen.feedback;
  let homeView=null,menuView=null;
  const usesHomeCanvas=()=>tab==='battle'&&!subpage;
  const usesMenuCanvas=()=>screen.supportsMenu(tab,subpage);
  let tab = TABS.some(t => t.id === bridge.activeLobbyTab) ? bridge.activeLobbyTab : 'battle';
  let snapshot, signature = '', visible = true, destroyed = false, busy = false, elapsed = 0, debugClearTimer = 0, modal = null;
  let portraitsEnabled = !deferPortraits, portraitStartFrame = null;
  let browsePilot, browseAircraft, selectedWeapon, selectedSlot = 'W3', tabScroll = {};
  let shopSection = 'boxes';
  let equipmentScroll = 0;
  let gearSort='quality',gearFilter='all',workshopKind='gear',gearWorkshop=null,gearWorkshopOrigin=null;
  let gearSelectInput='keyboard';
  let equipmentReturnFocus = null, pendingEquipmentScroll = null;
  let researchSection = 'talent';
  const researchScrollPositions={talent:0,lab:0};
  let battleChapter = null;
  let selectedRecruitPilot = null;
  let modalOpener = null, renderedModalKey = '', recruitScroll = 0;
  let pendingModalBackgroundRefresh = false, researchDrawPending = false;
  let processSequence=0,pendingProcessRecords=[];
  const polishedTab = () => ['shop','assembly','battle','research','supply'].includes(tab);
  let weaponSkillSlot=-1;
  let subpage = '', catalogSkillTab = false, catalogFilter = 'all', workshopId = null, workshopFilter = 'all', workshopMode = 'level';
  const catalogScrollPositions = new Map();
  const emptyFleetSelection=()=>({selectedSkillSlot:null,pendingSkillId:null,selectedSkillId:null});
  const fleetUi={aircraft:emptyFleetSelection(),pilot:emptyFleetSelection()};
  let fleetSupplyReturn=null;
  const fleetItem=(kind,id)=>(kind==='aircraft'?snapshot.aircraft:snapshot.pilots).find(item=>item.id===id);
  const workshopScrollPositions = new Map();
  const dailyScrollPositions = new Map();
  const patrolScrollPositions = new Map();
  let workshopRevealSelection = false;
  let catalogWorkshopReturn = null;
  function read() {
    const raw = bridge.getPeripheralSnapshot?.() || system?.snapshot?.() || {};
    const pilotId = raw.pilotId || raw.selectedPilotId || bridge.getActivePilot?.().id || 'pilot-01';
    const aircraftId = raw.aircraftId || raw.selectedAircraftId || pilotId;
    const wallet = raw.wallet || raw.resources || bridge.profileState || {};
    const pilots = (raw.pilots || AIRCRAFTS).map(p => portraitPresentation({ ...AIRCRAFTS.find(a => a.id === p.id), ...p, owned: p.owned ?? p.unlocked ?? (p.id === pilotId) }));
    const aircraft = (raw.aircraft || raw.aircrafts || AIRCRAFTS).map(a => ({ ...AIRCRAFTS.find(p => p.id === a.id), ...a, name: a.aircraftName || a.name || a.aircraft, owned: a.owned ?? a.unlocked ?? (a.id === aircraftId) }));
    const weapons = (raw.weapons || []).map(w => ({ ...COMMON_WEAPONS[w.id || w.itemId], ...w, id: w.id || w.itemId, owned: w.owned ?? true }));
    const stages = (raw.stages || []).map(s => ({ ...s, ...chapterPresentationForStage(s.index), scene: `canyon-${s.scene || ['coast','ruins','volcano','sewer','space'][s.index]}-walls-v2` }));
    const pools = Array.isArray(raw.pools) ? Object.fromEntries(raw.pools.map(p => [p.id, p])) : raw.pools;
    const signIn = { ...raw.signIn, claimable: raw.signIn?.claimable ?? raw.signIn?.canClaim, day: raw.signIn?.claimedCount ?? raw.signIn?.day };
    for (const item of [...aircraft, ...weapons]) item.maxLevel ??= raw.growth?.maxLevel;
    return { ...raw, playerName:playerName(raw.playerName || bridge.profileState?.playerName || bridge.game?.callsign), pools, signIn, pilotId, aircraftId, pilots, aircraft, weapons, stages, wallet, loadout: raw.loadout || {}, selectedStageIndex: raw.selectedStageIndex ?? bridge.selectedStageIndex ?? 0, power: raw.replicaCollection ? raw.power : raw.power ?? bridge.profilePower?.() };
  }
  const itemDescriptions=screen.inspectItems(presentation.inspection,read);
  bridge.showItemDescription=itemDescriptions.open;
  const weaponFor = id => snapshot.weapons.find(w => w.id === (typeof id === 'object' ? id?.itemId || id?.id : id));
  const onboarding=createThreeLobbyGuide({hidden:presentation.hidden,home:()=>homeView||menuView,
    context:()=>({snapshot,tab,subpage,modal,researchSection,shopSection,gearFilter,visible,busy,chapterIndex:battleChapterIndex(snapshot||{},battleChapter)}),
    mark:async(group,uid)=>{const handler=bridge.peripheralAction||system?.action;const result=await handler?.call(system||bridge,'onboardingComplete',{group,uid});render(true);return result;}
  });
  function toast(message, action, shortage = isResourceShortage(message)) {
    if(shortage)message=shortageToast(message,action);
    screen.toast.show(message);
  }
  function patrolUnlockMessage() {
    return snapshot.patrol?.unlocked===false ? (snapshot.patrol.lockReason||'通关第1章开启巡逻') : '';
  }
  async function refreshLoadoutPower() {
    try {
      return (await bridge.getReplicaLoadoutDetails?.())?.power;
    } catch {
      return null;
    }
  }
  async function act(action, payload = {}) {
    if (busy) return null;
    busy = true;
    researchDrawPending = action === 'researchDraw';
    presentation.busy(true,polishedTab());
    const growthBefore = hasLobbyGrowthFeedback(action) ? snapshot : null;
    const walletBefore = { ...snapshot.wallet };
    const motionBefore=snapshot;
    const resourceReturn=action==='shopBuy'?(modal?.type==='stamina'?{...modal,childOpener:captureFocus(modalHost)}:modal?.returnTo?.type==='stamina'?modal.returnTo:null):null;
    const patrolReturn = ['patrol','quickPatrol'].includes(modal?.type)
      ? {...modal,childOpener:captureFocus(modalHost)} : null;
    try {
      let powerBefore=motionBefore.power;
      if(action==='researchDraw'&&motionBefore.replicaCollection&&!Number.isFinite(powerBefore)) {
        powerBefore=await refreshLoadoutPower();
      }
      const handler = bridge.peripheralAction || system?.action;
      const result = handler ? await handler.call(system || bridge, action, payload) : { ok: false, message: '当前功能尚未开放' };
      if(result?.ok&&result.recruitToken)await handler.call(system||bridge,'fleetRecruitSeen',{token:result.recruitToken});
      if (result?.message && !(result.ok && growthBefore)) toast(action==='replicaCollection'&&['skins','pilots'].includes(payload.kind)&&['unlock','star'].includes(payload.action)&&isResourceShortage(result.message)?'道具不足':action==='shopBuy'&&result.message==='商品状态已更新，请重新选择'?'商品已更新':result.message,action);
      if (result?.ok === false && !result.message) toast('暂时无法进行此操作');
      const committedSnapshot=result?.ok?read():snapshot;
      const feedbackRecords=committedFeedbackRecords({before:motionBefore,after:committedSnapshot,action,payload,result});
      if(result?.ok)result.uiFeedbackRecords=feedbackRecords;
      const rewards = actionRewards(result,motionBefore,committedSnapshot);
      if (result?.ok && action==='claimActivity' && modal?.type==='tasks') delete modal.milestoneId;
      const completedShopOrder=result?.ok&&action==='shopBuy'&&modal?.type==='shopConfirm';
      const rewardParent=rewardReturnModal(modal);
      const rewardReturn=rewardParent?{...rewardParent,childOpener:captureFocus(modalHost),rewardReturnScroll:focus?.scrollTop(modalHost)||0}:null;
      const rewardOrigin=resourceReturn||patrolReturn||rewardReturn;
      if(rewards.length&&rewardOrigin)rewardOrigin.rewardReturnScrollState=captureModalScroll(modalHost);
      if (rewards.length) {
        const legacyPool = action==='recruit' ? payload.poolId || 'pilot' : null;
        modal = { type: 'rewards', title: result.title || (action==='recruit'||result.recruitPool ? '招募结果' : '获得奖励'),
          rewards:rewards.map(r=>({...r,isNew:r.isNew ?? ((r.type||r.kind)==='weapon' && !snapshot.weapons.some(w=>w.id===(r.id||r.itemId)&&w.owned))})),
          recruit:result.recruitPool==='pilot'||legacyPool==='pilot', recruitPool:result.recruitPool||legacyPool,
          recruitGrid:result.directRecruit===true||legacyPool==='pilot',
          ...(resourceReturn?{returnTo:resourceReturn}:patrolReturn ? {returnTo:patrolReturn,patrol:true} : rewardReturn?{returnTo:rewardReturn}:{}) };
      }
      else if(completedShopOrder)modal=resourceReturn||null;
      if(rewards.length&&feedbackRecords.length)modal.feedbackRecords=feedbackRecords;
      if (result?.ok && result.researchResult) {
        let powerAfter=committedSnapshot.power;
        if(committedSnapshot.replicaCollection&&!Number.isFinite(powerAfter)) {
          powerAfter=await refreshLoadoutPower();
        }
        pendingAwakeningFeedback={cardId:result.cardId,powerBefore,powerAfter};
        modal = { type: 'researchResult', result,...(rewardReturn?{returnTo:rewardReturn}:{}) };
      }
      if(result?.ok&&snapshot.replicaCollection&&['replicaCollection','selectReplicaLoadout','gearEquip','gearUnequip','gearUpgrade','gearUpgradeAll','gearDowngrade','gearMerge','gearBatch'].includes(action)) {
        await refreshLoadoutPower();
      }
      researchDrawPending = false;
      if(feedbackRecords.length&&['replicaCollection','gearMerge','gearBatch','fleetActivate','fleetStarUp'].includes(action)){
        // Freeze the existing page through the result. The committed state is
        // used by the overlay; source controls refresh only after it closes.
        snapshot=committedSnapshot;signature=patrolRenderSignature(snapshot);pendingModalBackgroundRefresh=true;
      }else render(true);
      if (result?.ok) {
        const credited = actionFeedback.wallet(walletBefore, snapshot.wallet);
        // A receipt already says what arrived; don't stack a second success toast.
        const powerChanged=Number.isFinite(motionBefore.power)&&Number.isFinite(snapshot.power)&&Math.round(motionBefore.power)!==Math.round(snapshot.power);
        if (credited || rewards.length || powerChanged || result.researchResult || result.gearResult?.operation==='supply') { screen.toast.clear(); }
      }
      if (result?.ok && subpage === 'workshop' && !modal && focus&&!focus.hasFocus()) {
        (selectBody('.ws-grid .eq-card.is-selected') || selectBody('.ws-slot:not(.is-result)'))?.focus({preventScroll:true});
      }
      if (result?.ok) {
        if(!result.researchResult&&Number.isFinite(motionBefore.power)&&Number.isFinite(snapshot.power))actionFeedback.power(motionBefore.power,snapshot.power);
        if(action==='claimTask')actionFeedback.pulse('task-'+payload.id);
        if(growthBefore)actionFeedback.pulse('workshop-target',action.startsWith('synthesize')?480:0);
      }
      onboarding.result(action,payload,result);
      return result;
    } catch (error) { console.error('[peripheral action]', action, error); toast('操作失败，请稍后重试'); return { ok: false }; }
    finally {
      busy = false; researchDrawPending = false; presentation.busy(false);
      if(screen.toast.message==='正在处理，请稍候…')screen.toast.clear();
    }
  }
  async function openShopBox(review, freeOnly = false) {
    const source=['shopBoxConfirm','shopBoxResult'].includes(modal?.type)?modal.returnTo||null:modal;
    const returnTo=source?{...source,childOpener:captureFocus(modalHost),rewardReturnScroll:focus?.scrollTop(modalHost)||0,rewardReturnScrollState:captureModalScroll(modalHost)}:null;
    const result=await act('gearSupply',{pool:review.pool,count:review.count,expectedRevision:review.revision,
      expectedInventoryRevision:review.inventoryRevision,...(freeOnly?{freeOnly:true}:{})});
    if(!result)return;
    if(result.ok){presentBoxReceipt(result,review.pool,review.count,returnTo);return;}
    else if(!freeOnly)modal={...review,error:result.message};
    else return;
    renderModal();
  }
  function showProcessRecords(records,returnTo=null){
    if(!records?.length)return false;
    modal={type:'processFeedback',id:`process-${++processSequence}`,records,index:0,view:'0',opener:captureFocus(root),...(returnTo?{returnTo}:{})};
    screen.toast.clear();
    renderModal();return true;
  }
  function showPendingProcessRecords(){
    if(!visible||modal||!pendingProcessRecords.length||nextLobbyGuide(snapshot)?.group===9)return false;
    const records=pendingProcessRecords;pendingProcessRecords=[];
    return showProcessRecords(records);
  }
  function presentBoxReceipt(result,pool,count,returnTo=null){
    const gear=result.gearResult;
    const resultModal={type:'shopBoxResult',id:`box-${++processSequence}`,pool,count:Number(count)||gear.receipt?.count||1,drawn:gear.drawn.map(row=>row.uid),receipt:gear.receipt,
      pilots:gear.pilotRewards||[],weapons:gear.weaponRewards||[],aircraft:gear.aircraftRewards||[],...(returnTo?{returnTo}:{}),feedbackRecords:result.uiFeedbackRecords||[]};
    modal={type:'boxOpening',id:resultModal.id,pool,resultModal,...(returnTo?{returnTo}:{})};renderModal();
  }
  function finishBoxPresentation(){
    if(modal?.type!=='boxOpening')return;
    const result=modal.resultModal,records=result.feedbackRecords;delete result.feedbackRecords;
    if(!showProcessRecords(records,result)){modal=result;renderModal();}
  }
  function advanceProcessFeedback(){
    if(modal?.type==='boxOpening'){finishBoxPresentation();return true;}
    if(modal?.type==='processFeedback'){
      if(modal.index+1<modal.records.length){modal.index++;modal.view=String(modal.index);renderModal();}
      else if(!returnToParentModal()){modal=null;renderModal();}
      return true;
    }
    if(modal?.feedbackRecords?.length){const records=modal.feedbackRecords;delete modal.feedbackRecords;showProcessRecords(records,modal.returnTo);return true;}
    return false;
  }
  let nativeBackpack=null,nativeDialog=null,nativeReceipt=null;
  function releaseNativeReceipt(){nativeReceipt?.close();nativeReceipt=null;}
  let nativeOverlayDialog=null;
  function releaseOverlayDialog(){nativeOverlayDialog?.close();nativeOverlayDialog=null;}
  function releaseNativeDialog(){nativeDialog?.close();nativeDialog=null;}
  function releaseNativeBackpack(){
    nativeBackpack?.close();nativeBackpack=null;
  }
  async function useBackpackItem(item,count,targetId,operation,revision,gearRevision){
    const origin={...modal},rule=backpackUseRule(item.nativeId);
    const result=await act('backpackUse',{id:item.nativeId,count,targetId,...(operation?{action:operation}:{}),
      expectedRevision:revision,expectedGearRevision:gearRevision});
    if(result?.ok&&rule?.kind==='equipmentKey')presentBoxReceipt(result,rule.pool,count,origin);
  }
  async function nativeBagAction(command){
    if(modal?.type!=='backpack'||busy)return;
    if(command.type==='close'){
      if(modal.bagSelectOpen){modal.bagSelectOpen=false;renderModal();return;}
      if(!closeBackpackDetail()&&!returnToParentModal()){modal=null;renderModal();}
      return;
    }
    if(command.type==='select'){
      if(modal.bagItem||!backpackItems(snapshot).some(i=>i.id===command.id))return;
      modal.bagItem=command.id;modal.bagChoice=null;modal.bagCount=1;renderModal();return;
    }
    const item=backpackItems(snapshot).find(i=>i.id===modal.bagItem);
    if(!item)return;
    if(command.type==='quantity'){modal.bagCount=String(command.value);renderModal();return;}
    if(command.type==='openChoices'){modal.bagSelectOpen=true;renderModal();return;}
    if(command.type==='choose'){modal.bagChoice=command.id;modal.bagSelectOpen=false;renderModal();return;}
    if(command.type==='recover'){await act('recoverDailyRewards');return;}
    if(command.type==='use'&&!command.disabled){
      const rule=backpackUseRule(item.nativeId),target=rule?.choices?.find(c=>c.id===modal.bagChoice)||rule?.choices?.[0];
      await useBackpackItem(item,command.count,Number(target?.id||0),command.operation,command.revision,command.gearRevision);
    }
  }
  function closeBackpackDetail() {
    if (modal?.type !== 'backpack' || !modal.bagItem) return false;
    modal.bagItem = null;
    renderModal();
    restoreFocus(modalHost, modal.bagOpener);
    return true;
  }
  function focusEquipmentSource(opener) {
    if (!restoreFocus(root,opener)) selectBody('.ag-catalog [data-action="equipmentWeapons"]')?.focus({preventScroll:true});
  }
  function openWeaponDetails(id, opener, readonly = false, requireSlotSelection = false) {
    if (!weaponFor(id)) return;
    const targetSlot=WEAPON_EQUIP_SLOTS.find(slot=>!snapshot.loadout[slot]) || selectedSlot;
    selectedWeapon=id;
    modal={type:'weapon',id,readonly,targetSlot:requireSlotSelection?null:targetSlot,requireSlotSelection,loadoutToken:snapshot.loadoutToken,opener:captureFocus(root,opener)};
    render(true);
  }
  function closeWeaponDetails(completedSlot) {
    const opener=modal?.opener || modalOpener;
    if (completedSlot) { selectedSlot=completedSlot; selectedWeapon=modal?.id; }
    modal=null; render(true);
    focusEquipmentSource(opener);
  }
  function carnivalEntry(){
    const activity=snapshot.carnival;
    if(!activity||activity.expired)return null;
    return {type:'carnival',day:activity.day};
  }
  function openTasks(period,returnTo){
    if(!isDailyTabAvailable(snapshot,period??'signin')){
      if(period)toast(dailyTabUnlockMessage(period));
      return;
    }
    modal={type:'tasks',period:resolveDailyPeriod(snapshot,period),returnTo};
    renderModal();
  }
  function returnToParentModal() {
    if(!modal?.returnTo)return false;
    const parent=modal.returnTo,opener=parent.childOpener,scroll=parent.rewardReturnScroll,positions=parent.rewardReturnScrollState;delete parent.childOpener;delete parent.rewardReturnScroll;delete parent.rewardReturnScrollState;
    if(['gearDetail','gearSources','gearMergeList'].includes(parent.type))parent.revision=snapshot.equipment.revision;
    modal=parent;renderModal();if(scroll!=null)focus?.scrollTop(modalHost,scroll);
    restoreModalScroll(modalHost,positions);
    if(!restoreFocus(modalHost,opener))(selectModal(modalHost,'.dc-tab[aria-selected="true"]')||selectModal(modalHost,'.pl-close,.bag-close,.chapter-reward-back,[role=dialog][tabindex]'))?.focus({preventScroll:true});return true;
  }
  function renderModal() {
    if(modal?.type==='tasks'){
      const period=resolveDailyPeriod(snapshot,modal.period);
      if(period)modal.period=period;
      else modal=modal.returnTo??null;
    }
    if(!modal&&!rewardLayer&&!renderedModalKey&&!modalOpener
      &&!pendingModalBackgroundRefresh&&!pendingAwakeningFeedback&&!pendingProcessRecords.length)return;
    if(modal?.type!=='backpack'&&!(isRetainedModalLayer(modal)&&modal?.returnTo?.type==='backpack'))releaseNativeBackpack();
    const receiptParent=modal?.returnTo?.type;
    const useReceipt=isCommonReward(modal);
    const useOpening=modal?.type==='boxOpening',useProcess=modal?.type==='processFeedback';
    const useRecruit=isRecruitResult(modal),useTaskTip=modal?.type==='taskChestPreview';
    const usePatrolReceipt=modal?.type==='rewards'&&modal.patrol;
    if(!useReceipt&&!useOpening&&!useProcess&&!useRecruit&&!useTaskTip&&!usePatrolReceipt)releaseNativeReceipt();
    const panelKind=screen?.lobbyPanelKind?.(modal?.type,snapshot);
    const overlayDialog=Boolean(panelKind&&isRetainedModalLayer(modal)&&modal?.returnTo);
    if(nativeOverlayDialog&&(!overlayDialog||nativeOverlayDialog.kind!==panelKind))releaseOverlayDialog();
    if(nativeDialog&&nativeDialog.kind!==panelKind
      &&!(isRetainedModalLayer(modal)&&nativeDialog.kind===screen?.lobbyPanelKind?.(modal?.returnTo?.type,snapshot)))releaseNativeDialog();
    if(rewardLayer&&!isRetainedModalLayer(modal)){
      const previous=rewardLayer;rewardLayer=null;previous.layers.restore();modalHost=modalRoot;
      renderedModalKey=previous.key;
    }
    if(isRetainedModalLayer(modal)&&!rewardLayer){
      const receipt=modal,parent=receipt.returnTo;
      // Refresh the source in place after its transaction, before making it
      // inert. It remains visible throughout the reward presentation.
      if(parent){modal=parent;renderModal();restoreModalScroll(modalHost,parent.rewardReturnScrollState);modal=receipt;}
      else {
        if(!modalOpener)modalOpener=receipt.opener||captureFocus(root);
        presentation.clearModal(modalRoot);renderedModalKey='';
      }
      rewardLayer={key:renderedModalKey,layers:presentation.retainModal()};
      modalHost=rewardLayer.layers.overlay;renderedModalKey='';
    }
    if(modal?.type==='collectionSupplyChoice')modal=null;
    if(modal&&isResourceShortage(modal.error))modal={...modal,error:''};
    if(modal?.type==='shopConfirm'){
      const result=reconcileShopReview(modal,snapshot);
      if(result.invalidated){modal=modal.returnTo?{...modal.returnTo}:null;toast('商品已更新');}
      else modal=result.review;
    }
    // Keep the last portrait image behind a modal without rendering both UI layers.
    portraitPlayer.setVisible(visible&&!modal);
    const previewWeapon=modal?.type==='nativeCollectionDetail'&&modal.kind==='guns'
      ?snapshot.replicaCollection?.guns.find(row=>row.id===Number(modal.id)):null;
    const modalKey = modalIdentity(previewWeapon?{...modal,id:previewWeapon.baseGunId||previewWeapon.id}:modal);
    if (!modal) {
      const returnFocus=modalOpener;
      if(showPendingProcessRecords())return;
      presentation.clearModal(modalHost);
      presentation.blockPage(false);
      if (polishedTab()) restoreFocus(root, modalOpener);
      modalOpener = null; renderedModalKey = '';
      if (pendingModalBackgroundRefresh) {
        pendingModalBackgroundRefresh = false;
        render(true);
        restoreFocus(root,returnFocus);
      }
      if (pendingAwakeningFeedback) {
        const {cardId,powerBefore,powerAfter}=pendingAwakeningFeedback;
        pendingAwakeningFeedback=null;
        if(visible&&tab==='research') {
          if(cardId)actionFeedback.pulse('research-'+cardId);
          if(Number.isFinite(powerBefore)&&Number.isFinite(powerAfter)&&Math.round(powerAfter)>Math.round(powerBefore)) {
            actionFeedback.power(powerBefore,powerAfter);
          }
        }
      }
      return;
    }
    if (polishedTab() && !renderedModalKey && !rewardLayer) modalOpener = modal.opener || captureFocus(root);
    if(useReceipt||useOpening||useProcess||useRecruit||useTaskTip||usePatrolReceipt){
      const kind=useRecruit?'recruitResult':usePatrolReceipt?'patrolReceipt':modal.type;
      if(nativeReceipt?.host!==modalHost||nativeReceipt?.kind!==kind){
        releaseNativeReceipt();
        const open=useRecruit?screen.openRecruitResults:useProcess?screen.openProcessFeedback:useOpening?screen.openBoxOpening:useTaskTip?screen.openTaskChestPreview:usePatrolReceipt?screen.openPatrolReceipt:screen.openRewardReceipt;
        nativeReceipt=open(modalHost,runLobbyCommand,key=>bridge.playUiFeedback?.(key));
        nativeReceipt.kind=kind;
      }
      nativeReceipt.update(snapshot,modal,signature);
      presentation.blockPage(true);
      renderedModalKey=modalKey;return;
    }
    if(panelKind){
      let presenter=overlayDialog?nativeOverlayDialog:nativeDialog;
      if(presenter?.host!==modalHost||presenter.kind!==panelKind){
        const scroll=panelKind==='tasks'?dailyScrollPositions:patrolScrollPositions;
        if(overlayDialog)releaseOverlayDialog();else releaseNativeDialog();
        presenter=screen.openLobbyPanel(panelKind,modalHost,runLobbyCommand,scroll,k=>bridge.playUiFeedback?.(k));presenter.kind=panelKind;
        if(overlayDialog)nativeOverlayDialog=presenter;else nativeDialog=presenter;
      }
      const panelModal=modal.type==='workshopFilter'?{...modal,filter:workshopFilter,mode:workshopKind==='gear'?'gear':workshopMode}:
        modal.type==='weapon'&&!modal.requireSlotSelection?{...modal,targetSlot:modal.targetSlot||selectedSlot}:modal;
      presenter.update(snapshot,panelModal,signature);
      presentation.blockPage(true);
      renderedModalKey=modalKey;return;
    }
    if (modal.type === 'backpack') {
      // Preserve the grid and its focus while a live wallet snapshot updates.
      if (modal.bagItem && !backpackItems(snapshot).some(item => item.id === modal.bagItem)) modal.bagItem = null;
      nativeBackpack??=screen.openBackpack(modalHost,nativeBagAction);
      nativeBackpack.update(backpackItems(snapshot),snapshot,modal);
      presentation.blockPage(true);
      renderedModalKey=modalKey;return;
    }
    throw new Error('缺少 Three 界面 '+modal.type);
  }
  let pendingAwakeningFeedback=null;
  const sendMenuAction=(action,data,opener)=>runLobbyCommand(action,data,opener);
  const menuInteractive=()=>visible&&!busy&&!modal;
  const selectShopSection=section=>{shopSection=section;};
  function firstCatalogId(kind){
    if(kind==='aircraft')return snapshot.aircraftId;
    if(kind==='pilot')return snapshot.pilotId;
    return selectedWeapon||weaponFor(snapshot.loadout[selectedSlot])?.id||snapshot.weapons.find(w=>w.owned)?.id;
  }
  function menuCatalog(kind,entering=false){
    const id=entering?firstCatalogId(kind):kind==='weapon'?selectedWeapon:kind==='aircraft'?browseAircraft:browsePilot;
    const selection=fleetUi[kind]&&(entering?emptyFleetSelection():fleetUi[kind]);
    return {id,skillTab:!entering&&catalogSkillTab,selectedSkillSlot:kind==='weapon'?weaponSkillSlot:undefined,...selection};
  }
  function menuData(page,catalog=null,workshop=null){
    const data={tab:page,snapshot,catalog,workshop};
    if(catalog&&!workshop)return data;
    return {...data,section:researchSection,shopSection,selected:selectedRecruitPilot,
      gearSort,gearFilter,fleetReturnKind:fleetSupplyReturn?.kind,time:bridge.getPeripheralClock?.()?.time};
  }
  function render(force = false, currentSnapshot = null) {
    return performanceMonitor.measure('ui-render',()=>renderContent(force,currentSnapshot));
  }
  function renderContent(force = false, currentSnapshot = null) {
    if (destroyed || researchDrawPending) return;
    const next = currentSnapshot || read();
    if(next.firstSortieRequired){
      tab='battle';subpage='';if(modal?.type!=='firstSortie')modal={type:'firstSortie'};
    }else if(modal?.type==='firstSortie')modal=null;
    if(tab==='battle'&&!subpage)bridge.app?.renderer?.publishHome?.(next,battleChapterIndex(next,battleChapter),bridge.debugToolsEnabled);
    // Switching tabs reuses the current data; skip serializing the whole economy.
    const nextSignature=next===snapshot ? signature : patrolRenderSignature(next);
    if(!busy&&snapshot&&snapshot!==next)pendingProcessRecords.push(...collectionFeedbackRecords(snapshot,next,{stars:false}),...progressionFeedbackRecords(snapshot,next));
    nativeDialog?.clock?.(next.patrol);
    if (!force && nextSignature === signature) { snapshot=next;showPendingProcessRecords();return; }
    // Awakening uses the committed snapshot in the reveal while the talent page keeps its previous frame.
    if(modal?.type==='researchResult'||(isRetainedModalLayer(modal)&&rewardLayer)){
      pendingModalBackgroundRefresh=true;signature=nextSignature;snapshot=next;
      renderModal();return;
    }
    // Model-thumbnail readiness can force refreshes without changing rewards.
    // Keep the dialog and its blurred background mounted until it closes.
    if ((modal?.type==='playerInfo'&&renderedModalKey==='playerInfo:') || ['chapterChest','backpack','patrol','quickPatrol'].includes(modal?.type)) {
      pendingModalBackgroundRefresh = true;
      signature=nextSignature;snapshot = next;
      renderModal();
      return;
    }
    // While a command panel is open, background timers must not rebuild the
    // hangar canvas underneath its translucent backdrop. Refresh on close.
    if (!force && modal && COMMAND_PANELS.has(modal.type)) {
      snapshot = next;
      renderModal();
      return;
    }
    pendingModalBackgroundRefresh=false;signature=nextSignature;snapshot=next;
    const nativeHome=usesHomeCanvas(),nativeMenu=usesMenuCanvas();
    if(!nativeMenu&&menuView){menuView.close();menuView=null;}
    if(!nativeHome&&homeView){homeView.close();homeView=null;}
    if(tab==='research'&&researchSection==='lab'&&researchUnlockMessage(snapshot.replicaCampaign))researchSection='talent';
    const page=presentation.showPage({tab,subpage,nativeHome,nativeMenu,workshopKind,polished:polishedTab()});
    const bodyChanged=(nativeHome?homeView:menuView)?.page!==page;
    if(nativeMenu){
      if(menuView?.page!==page){
        menuView?.close();
        menuView=screen.mountMenu(page,sendMenuAction,menuInteractive,selectShopSection);
      }
      const catalog=subpage&&subpage!=='workshop'?menuCatalog(subpage):null;
      const gear=workshopKind==='gear';
      const workshop=subpage==='workshop'?{kind:workshopKind,id:gear?null:workshopId,filter:workshopFilter,mode:gear?'level':workshopMode,
        draft:gear?gearWorkshop:null,backLabel:catalogWorkshopReturn?'返回武器目录':'返回装备'}:null;
      menuView.update(menuData(subpage||tab,catalog,workshop),signature);
    }
    let pilotChanged=Boolean(nativeMenu&&menuView?.portraitChanged());
    if(nativeHome){
      if(homeView?.page!==page){
        homeView?.close();
        homeView=screen.mountHome(page,(action,data,opener)=>runLobbyCommand(action,data,opener),()=>visible&&!busy&&!modal);
        pilotChanged=true;
      }else pilotChanged=homeView.selectPilot(snapshot.pilotId);
    }
    portraitPlayer.setVisible(visible&&!modal);
    if((bodyChanged||pilotChanged)&&portraitsEnabled)portraitPlayer.sync();
    renderModal();
  }
  function scrollShopSection(value){shopSection=shopSectionId(value);if(tab==='shop')menuView?.section(shopSection);}
  function switchTab(value, requestedShopSection) {
    if(snapshot?.firstSortieRequired)return;
    const previousTab = tab, previousSubpage = subpage;
    if (value === 'missions') { openTasks(); return; }
    if (value === 'loadout') { openCatalog('pilot'); return; }
    if (value === 'upgrade') { openGearWorkshop(); return; }
    if (!TABS.some(t => t.id === value && !t.locked)) return;
    if(value===tab&&!subpage&&!modal&&(value!=='shop'||requestedShopSection===undefined||shopSectionId(requestedShopSection)===shopSection))return;
    if (value === 'shop') {
      if (requestedShopSection !== undefined) shopSection = shopSectionId(requestedShopSection);
      else if (tab !== 'shop') shopSection = 'boxes';
    }
    tabScroll[tab] = focus?.pageScroll()||0; tab = value; modal = null; browseAircraft = null;
    subpage = ''; catalogSkillTab = false; catalogWorkshopReturn = null;
    if(previousTab==='battle'&&value!=='battle')onboarding.hideWeakHint();
    // Navigation changes presentation only. Actions and the regular refresh
    // own state reads; do not rebuild the full economic snapshot on every tap.
    bridge.switchLobbyTab?.(value); render(true,snapshot); focus?.pageScroll(tabScroll[value]||0);
    if (value === 'shop') scrollShopSection(shopSection);
    if (value==='assembly' && previousSubpage) { focusEquipmentSource(equipmentReturnFocus); equipmentReturnFocus=null; }
    if(previousTab!==tab)actionFeedback.pulse('nav-'+value);
  }
  function returnFromCatalog() {
    if(subpage==='workshop'&&workshopKind==='gear'&&gearWorkshopOrigin){
      const previous=gearWorkshopOrigin;gearWorkshopOrigin=null;gearWorkshop=null;
      tab=previous.tab;subpage=previous.subpage;modal=previous.modal;
      if(modal)modal.revision=snapshot.equipment.revision;
      render(true);restoreFocus(modal?modalHost:root,previous.opener);return;
    }
    if (subpage === 'workshop' && catalogWorkshopReturn) {
      const previous = catalogWorkshopReturn; catalogWorkshopReturn = null;
      subpage = 'weapon'; catalogSkillTab = previous.skillTab; selectedWeapon = previous.weaponId; modal = null;
      render(true); restoreFocus(root,previous.opener); return;
    }
    switchTab('assembly');
  }
  function closeFleetOperation() {
    if(modal?.type!=='fleetOperation'||modal.returnTo)return false;
    modal=null;render(true);
    (selectBody('.fc-hero-actions button:not(:disabled)')||selectBody('.fc-item[aria-pressed="true"]')||selectBody('.wc-back'))?.focus({preventScroll:true});
    return true;
  }
  function openGearWorkshop(id=null,opener=focus?.active()){
    gearWorkshopOrigin={tab,subpage:subpage==='workshop'?'':subpage,
      modal:modal?.type?.startsWith('gear')||modal?.type==='shopBoxResult'?structuredClone(modal):null,
      opener:captureFocus(root,opener)};
    gearWorkshop={...emptyGearMerge(snapshot.equipment.revision),targetId:id};
    workshopKind='gear';workshopFilter='all';catalogWorkshopReturn=null;
    tab='assembly';subpage='workshop';modal=null;render(true);
  }
  function openCatalog(kind) {
    if (!['weapon','aircraft','pilot'].includes(kind)) return;
    if (tab==='assembly' && !subpage) equipmentReturnFocus=captureFocus(root);
    tab = 'assembly'; subpage = kind; modal = null; catalogSkillTab = false; catalogFilter = 'all';
    if(fleetUi[kind])Object.assign(fleetUi[kind],emptyFleetSelection());
    if (kind === 'aircraft') browseAircraft = firstCatalogId(kind);
    if (kind === 'pilot') browsePilot = firstCatalogId(kind);
    if (kind === 'weapon') selectedWeapon = firstCatalogId(kind);
    render(true); focus?.pageScroll(0);
  }
  function openGrowthSupply(period,target) {
    const view=snapshot.pilotSupply?.growth?.[period];if(!view)return;
    modal={type:'growthSupplyChoice',period,opener:captureFocus(root,target),...(modal?{returnTo:{...modal}}:{})};renderModal();
  }
  async function runLobbyCommand(action,data,target,direct=true){
    if(busy||!visible||isHiddenPilotAffectionAction(action)||snapshot.firstSortieRequired&&action!=='start')return;
    if(data.resourceShort){if(!snapshot.rewardPending&&!snapshot.rewardBusy)toast(data.resourceShort,action,true);return;}
    if(action==='inspect'){itemDescriptions.open(data,target);return;}
    if(action==='gearSort'&&['quality','part','level'].includes(data.value)){gearSort=data.value;render(true);return;}
    if(action!=='dismiss')bridge.playUiClick?.();
    const id=data.id;
    if(action==='carnival'){
      const entry=carnivalEntry();
      if(!entry)return;
      modal={...entry,opener:captureFocus(root,target)};
      renderModal();return;
    }
    if(action==='carnivalDay'){
      const day=Number(id);
      if(modal?.type!=='carnival'||!snapshot.carnival?.days.some(row=>row.day===day&&row.unlocked))return;
      modal={...modal,day};renderModal();return;
    }
    if(action==='carnivalClaim'){
      if(modal?.type==='carnival')await act(action,data);
      return;
    }
    if(action==='carnivalGo'){
      const activity=snapshot.carnival;
      if(modal?.type!=='carnival'||!activity||activity.expired||activity.clockRollback)return;
      const day=activity.days.find(row=>row.day===modal.day&&row.unlocked),task=day?.tasks.find(row=>row.id===id&&!row.claimed&&!row.canClaim);
      if(!task)return;
      const returnTo={...modal,childOpener:captureFocus(modalHost,target)};
      switch(task.destination){
        case 'signin':openTasks('signin',returnTo);break;
        case 'chapters':modal={type:'chapterChest',returnTo};renderModal();break;
        case 'patrol':{
          const lock=patrolUnlockMessage();
          if(lock){toast(lock);break;}
          patrolScrollPositions.clear();modal={type:'patrol',returnTo};renderModal();break;
        }
        case 'boxes':switchTab('shop','boxes');break;
        case 'shop':switchTab('shop','daily');break;
        case 'equipment':switchTab('assembly');break;
        case 'research':{
          const lab=task.metric==='labUpgrades',lock=lab&&researchUnlockMessage(snapshot.replicaCampaign);
          if(lock){toast(lock);break;}
          researchSection=lab?'lab':'talent';switchTab('research');break;
        }
        case 'battle':switchTab('battle');break;
      }
      return;
    }
    if(action==='researchSection'){
      if(tab!=='research'||subpage||!['talent','lab'].includes(data.section))return;
      const lock=data.section==='lab'&&researchUnlockMessage(snapshot.replicaCampaign);
      if(lock){toast(lock);return;}
      researchSection=data.section;modal=null;render(true);
      selectBody(`[data-action="researchSection"][data-section="${researchSection}"]`)?.focus({preventScroll:true});return;
    }
    if(action==='nativeCollectionOperation'){
      modal={type:action,kind:data.kind,id:Number(id),operation:data.operation,opener:captureFocus(root,target),...(modal?{returnTo:modal}:{})};renderModal();return;
    }
    if(action==='growthSupplyOpen'){openGrowthSupply(data.period,target);return;}
    if(action==='growthSupplyClaim'){
      if(modal?.type!=='growthSupplyChoice')return;
      await act('pilotSupply',{action:'growth',period:modal.period,id:Number(id),expectedRevision:Number(data.revision)});return;
    }
    if(action==='bagOpen'){
      const item=backpackItems(snapshot).find(row=>row.nativeId===Number(id));if(!item)return;
      modal={type:'backpack',bagItem:item.id,bagChoice:null,bagCount:1,opener:captureFocus(root,target),...(modal?{returnTo:{...modal}}:{})};renderModal();return;
    }
    if(action==='pilotSupplyBoxes'){modal={type:action,opener:captureFocus(root,target)};renderModal();return;}
    if(action==='pilotSupplyTab'){
      if(modal?.type!=='pilotSupplyTasks'||!['daily','week'].includes(data.period))return;
      modal.period=data.period;renderModal();focus?.scrollTop(modalHost,0);return;
    }
    if(action==='shopSpecials'){
      modal={type:action,period:'daily',opener:captureFocus(root,target)};renderModal();return;
    }
    if(action==='shopSpecialPeriod'){
      if(modal?.type==='shopSpecials'&&Object.hasOwn(snapshot.flightRewards?.adOffers||{},data.period)){
        modal.period=data.period;renderModal();
      }
      return;
    }
    if(action==='flightReward'){await act('flightReward',{action:data.operation,period:data.period,revision:Number(data.revision)});return;}
    if(action==='pilotSupply'){
      await act('pilotSupply',{action:data.operation,count:data.count===undefined?undefined:Number(data.count),
        id:['task','weeklyTask'].includes(data.operation)?id:Number(id),expectedRevision:Number(data.revision)});return;
    }
    if(action==='nativeWeaponSkinSelect'){
      const rows=snapshot.replicaCollection?.guns||[],current=rows.find(row=>row.id===Number(modal?.id)),next=rows.find(row=>row.id===Number(id));
      if(modal?.type==='nativeCollectionDetail'&&modal.kind==='guns'&&current&&next&&(current.baseGunId||current.id)===(next.baseGunId||next.id)){
        modal={...modal,id:next.id};renderModal();
      }
      return;
    }
    if(action==='nativeCollectionDetail'||action==='nativeSkillPreview'||action==='nativeRecruitInfo'){modal={type:action,kind:data.kind,id:Number(id),...(modal?.type==='nativeCollectionDetail'?{returnTo:{...modal,childOpener:captureFocus(modalHost,target)}}:{}),opener:captureFocus(root,target)};renderModal();return;}
    if(action==='nativeWeaponPreview'){modal={type:action,id:Number(id),mode:data.mode,...(['nativeCollectionDetail','nativeSkillPreview'].includes(modal?.type)?{returnTo:{...modal}}:{}),opener:captureFocus(root,target)};renderModal();return;}
    if(action==='nativeWeaponSkillBrowse'){
      const previousSlot=weaponSkillSlot;
      selectedWeapon=id;weaponSkillSlot=-1;
      render(true);if(previousSlot>=0)selectBody(`.wg-skill-slot[data-slot="${previousSlot}"]`)?.focus({preventScroll:true});return;
    }
    if(action==='nativeWeaponSkillSlot'){
      const slot=Number(data.slot);
      if(subpage==='weapon'&&[0,1].includes(slot)&&snapshot.replicaCollection?.guns.some(row=>row.id===Number(id))){weaponSkillSlot=catalogSkillTab&&weaponSkillSlot===slot&&String(selectedWeapon)===String(id)?-1:slot;catalogSkillTab=true;selectedWeapon=id;render(true);}
      return;
    }
    if(action==='nativeWeaponSkillEquip'){
      const slot=Number(data.slot);
      if(subpage!=='weapon'||!catalogSkillTab||![0,1].includes(slot))return;
      if(Number(id)&&!snapshot.replicaCollection?.guns.find(row=>row.id===Number(id))?.owned){toast('技能未激活');return;}
      await act('replicaCollection',{kind:'guns',action:'slot',id:Number(id),slot,weaponType:Number(data.weaponType),expectedRevision:Number(data.revision)});return;
    }
    if(action==='fleetSkillChoose'){
      const group={pilot:'pilots',aircraft:'skins'}[subpage],state=fleetUi[subpage];
      const row=group&&snapshot.replicaCollection?.[group]?.find(row=>row.id===Number(id));
      if(state&&row?.owned&&row.stage.skills.length){state.selectedSkillId=String(row.id);render(true);selectBody(`.pcs-choice[data-id="${row.id}"]`)?.focus({preventScroll:true});}return;
    }
    if(action==='nativeSlotPick'){const state=fleetUi[subpage];if(state){state.selectedSkillSlot=Number(data.slot);catalogSkillTab=true;render(true);}return;}
    if(action==='nativeEquipmentBoxes'){modal={type:'nativeEquipmentBoxes',opener:captureFocus(root,target),...(modal?{returnTo:{...modal}}:{})};renderModal();return;}
    if(action==='nativeMaterials'){modal={type:'backpack',opener:captureFocus(root,target),...(modal?{returnTo:{...modal}}:{})};renderModal();return;}
    if(action==='nativeStarRewards'){modal={type:'nativeStarRewards',opener:captureFocus(root,target),...(modal?{returnTo:{...modal}}:{})};renderModal();return;}
    if(['chapterRewards','chapterCoreRewards','flightChapters'].includes(action)){
      modal={type:'chapterRewards',chapter:Number(data.chapter)||undefined,opener:captureFocus(root,target),...(modal?{returnTo:{...modal}}:{})};renderModal();return;
    }
    if(action==='nativeChapterCoreReward'){
      await act('nativeAcquisition',{action:'chapterCoreReward',id:Number(id),expectedRevision:Number(data.revision)});return;
    }
    if(action==='nativeChapterReward'||action==='nativeComposePilotBox'){
      const result=await act('nativeAcquisition',{action:action==='nativeChapterReward'?'chapterReward':'composePilotBox',count:data.count===undefined?1:Number(data.count),id:Number(id),expectedRevision:Number(data.revision)});
      if(result?.ok&&action==='nativeChapterReward'){renderModal();}
      return;
    }
    if (action === 'nativeLab') {
      const row=snapshot.replicaCollection?.labs?.find(row=>row.id===Number(id));
      const lock=researchUnlockMessage(snapshot.replicaCampaign,row);
      if(lock){toast(lock);return;}
      modal={type:'nativeLab',id:Number(id),opener:captureFocus(root,target)};renderModal();return;
    }
    if (action === 'nativeLabUpgrade' || action === 'nativeLabActivate') {
      await act('replicaCollection', {kind:'labs',id:Number(id),action:action==='nativeLabUpgrade'?'upgrade':'activate',
        expectedRevision:Number(data.revision)});
      renderModal(); return;
    }
    if (action === 'nativeLabLevel') {
      const select = selectModal(modalHost,'[data-native-lab-level]');
      const level=Number(data.level??(Number(select?.dataset.nativeLabLevel)===Number(id)?select.value:NaN));
      if(!Number.isSafeInteger(level))return;
      await act('replicaCollection', { kind: 'labs', id: Number(id), action: 'preview-level',
        level, expectedRevision: Number(data.revision) });
      renderModal(); return;
    }
    if (action === 'nativeStats') {
      const requested={type:'nativeStats',opener:captureFocus(root,target)};
      modal=requested;renderModal();
      try {const result=await bridge.getReplicaLoadoutDetails();if(modal===requested){modal.result=result;renderModal();}}
      catch(error){if(modal===requested){modal.result={error:error.message};renderModal();}}
      return;
    }
    if (action === 'nativeOperation') {
      const operation=data.operation,slot=data.slot===undefined?undefined:Number(data.slot);
      const origin=modal?{...modal}:null;
      const preview=modal?.type==='nativeCollectionOperation'?{...modal}:null;
      const kind=data.kind,before=snapshot.replicaCollection[kind]?.find(row=>row.id===Number(id));
      const previousStars=before?.star;
      const result=await act('replicaCollection', { action: operation, kind: data.kind,
        id: Number(id), slot, expectedRevision: Number(data.revision) });
      if(!showProcessRecords(result?.uiFeedbackRecords,preview?.returnTo||origin)&&preview){modal={...preview,result:result?.ok?{previousStars}:undefined,error:result?.ok?'':result?.message||'操作未完成'};renderModal();}
      if(result?.ok&&operation==='slot'&&fleetUi[subpage]){
        Object.assign(fleetUi[subpage],{selectedSkillSlot:slot,pendingSkillId:null,selectedSkillId:Number(id)?String(id):null});
        render(true);
        selectBody(`.fc-skill-group [data-slot="${slot}"]`)?.focus({preventScroll:true});
      }
      return;
    }
    if(action.startsWith('workshopGear')){
      const gear=snapshot.equipment,draft=gearMergeDraft(gear,gearWorkshop);
      if(action==='workshopGearPick'){
        const result=pickGearMergeItem(gear,gearWorkshop,id);gearWorkshop=result.selection;
        if(result.message)toast(result.message);render(true);return;
      }
      if(action==='workshopGearRemove'){
        gearWorkshop=removeGearMergeMaterial(gear,gearWorkshop,Number(data.index));render(true);return;
      }
      if(action==='workshopGearToken'){
        if(!draft.stale&&draft.option?.tokenKey===data.key&&draft.tokens<draft.option.tokens&&draft.tokens+draft.materialIds.length<draft.option.required){gearWorkshop.tokens++;render(true);}return;
      }
      if(action==='workshopGearBatch'){
        const result=await act('gearPreview',{operation:'batch',expectedRevision:gear.revision});
        if(result?.ok){modal={type:'gearBatch',plan:result.gearPreview,revision:gear.revision};renderModal();}return;
      }
      if(action==='workshopGearCompose'){
        if(!draft.ready)return;
        const result=await act('gearMerge',{id:gearWorkshop.targetId,materialIds:[...draft.materialIds],tokens:draft.tokens,expectedRevision:gearWorkshop.revision});
        if(result?.ok){gearWorkshop=emptyGearMerge(snapshot.equipment.revision);if(!showProcessRecords(result.uiFeedbackRecords))render(true);}return;
      }
      return;
    }
    if(action.startsWith('gear')){
      const current=modal,itemId=id||modal?.id;
      const item=snapshot.equipment?.items.find(item=>item.uid===itemId);
      const open=(type,extra={})=>{
        modal={type,id:itemId,revision:snapshot.equipment.revision,...(current?.type?.startsWith('gear')||current?.type==='shopBoxResult'?{returnTo:{...current,childOpener:captureFocus(modalHost,target)}}:{}),...extra};renderModal();
      };
      if(action==='gearDetail'){open('gearDetail',{detailOrigin:data.gearOrigin==='slot'?'slot':'warehouse'});return;}
      if(action==='gearReplace'){if(item){gearFilter=String(item.type);pendingEquipmentScroll=0;switchTab('assembly');}return;}
      if(action==='gearMaterialInfo'){open('gearMaterialInfo',{id:undefined,part:Number(data.part),quality:Number(data.quality)});return;}
      if(action==='gearAttributes'||action==='gearSources'||action==='gearMergeList'){open(action,{id:undefined});return;}
      if(action==='gearClearFilter'){gearFilter='all';pendingEquipmentScroll=0;render(true);return;}
      if(action==='gearChoosePart'){gearFilter=data.part;pendingEquipmentScroll=0;render(true);return;}
      if(action==='gearBack'){if(!returnToParentModal()){modal=null;renderModal();}return;}
      if(action==='gearMerge'){openGearWorkshop(itemId,target);return;}
      if(action==='gearMaterial'){
        const selected=modal.materialIds||[],source=snapshot.equipment.items.find(item=>item.uid===modal.id);
        modal.materialIds=selected.includes(id)?selected.filter(uid=>uid!==id):selected.length+(modal.tokens||0)<source.merge.required?[...selected,id]:selected;
        delete modal.error;renderModal();return;
      }
      if(action==='gearAutoFill'){
        modal.materialIds=[...(item?.merge.defaultIds||[])];modal.tokens=item?.merge.defaultTokens||0;delete modal.error;renderModal();return;
      }
      if(action==='gearToggleTokens'){
        const option=item.merge;modal.tokens=modal.tokens?0:Math.min(option.tokens,option.required-(modal.materialIds?.length||0));delete modal.error;renderModal();return;
      }
      if(action==='gearBatchPreview'||action==='gearDowngradePreview'){
        const result=await act('gearPreview',{operation:action==='gearBatchPreview'?'batch':'downgrade',id:itemId,expectedRevision:snapshot.equipment.revision});
        if(result?.ok)open(action==='gearBatchPreview'?'gearBatch':'gearDowngrade',{plan:result.gearPreview});
        return;
      }
      const operation={gearConfirmMerge:'gearMerge',gearConfirmBatch:'gearBatch'}[action]||action;
      if(!['gearEquip','gearUnequip','gearUpgrade','gearUpgradeAll','gearLock','gearDowngrade','gearMerge','gearBatch','gearSupply'].includes(operation))return;
      const result=await act(operation,{id:itemId,expectedRevision:current?.revision??snapshot.equipment.revision,
        materialIds:current?.materialIds||[],tokens:current?.tokens||0,count:Number(data.count)||1});
      if(!result?.ok){if(modal){modal.error=result?.message;renderModal();}return;}
      if(operation==='gearEquip'||operation==='gearUnequip'){if(!returnToParentModal()){modal=null;render(true);}return;}
      if(operation==='gearBatch'&&subpage==='workshop'&&workshopKind==='gear'){gearWorkshop=emptyGearMerge(snapshot.equipment.revision);modal=null;if(!showProcessRecords(result.uiFeedbackRecords))render(true);return;}
      if(['gearMerge','gearBatch'].includes(operation)&&result.uiFeedbackRecords?.length){showProcessRecords(result.uiFeedbackRecords,current?.returnTo);return;}
      if(operation==='gearSupply')modal={...current,type:'gearSources',drawn:result.gearResult.drawn.map(item=>item.uid),revision:snapshot.equipment.revision};
      else if(operation==='gearBatch')modal={type:'gearMergeList',steps:result.gearResult.steps.length,revision:snapshot.equipment.revision};
      else modal={type:'gearDetail',id:itemId,detailOrigin:current?.detailOrigin||'warehouse',revision:snapshot.equipment.revision,
        upgradeAt:result.gearResult?.toLevel>result.gearResult?.fromLevel?performance.now()/1000:undefined,
        ...(current?.type==='gearDetail'&&current.returnTo?{returnTo:current.returnTo}:current?.returnTo?.type==='gearMergeList'?{returnTo:current.returnTo}:{})};
      renderModal();return;
    }
    if (action === 'portraitFeedback') { portraitPlayer.feedback(data.characterPortrait); return; }
    if(action==='processSkipBox'){finishBoxPresentation();return;}
    if(action==='processFeatureGo'){
      const returnTo=modal?.returnTo;
      advanceProcessFeedback();
      modal={type:'patrol',...(returnTo?{returnTo}:{})};renderModal();return;
    }
    if(action==='processBoxAgain'){
      const pool=data.pool,count=Number(data.count),box=snapshot.nativeAcquisition?.equipmentBoxes?.find(row=>row.id===(pool==='advanced'?3:4));
      const quote=box?.quotes.find(row=>row.count===count);if(!quote?.canDraw)return;
      await openShopBox({pool,count,revision:snapshot.equipment.revision,inventoryRevision:snapshot.nativeAcquisition.revision},quote.payment==='free');return;
    }
    if (action === 'dismiss') { if (direct && !advanceProcessFeedback() && !closeBackpackDetail() && !returnToParentModal() && !closeFleetOperation()) { if(modal?.type==='weapon')closeWeaponDetails();else{modal=null;renderModal();} } return; }
    if (action === 'close') { if(advanceProcessFeedback()||closeFleetOperation())return; if (!closeBackpackDetail() && !returnToParentModal()) { if(modal?.type==='weapon')closeWeaponDetails();else{modal=null;renderModal();} } return; }
    if (modal?.type === 'backpack') {
      if(action==='recoverDailyRewards'){await act(action);return;}
      if(action==='bagGo') {
        const kind=data.kind,origin={...modal};
        if(kind==='lab'){
          const row=snapshot.replicaCollection?.labs?.find(row=>row.id===Number(id));
          const lock=researchUnlockMessage(snapshot.replicaCampaign,row);
          if(lock){toast(lock);return;}
          modal={type:'nativeLab',id:Number(id),returnTo:origin};
        }
        else if(['guns','skins','pilots'].includes(kind))modal={type:'nativeCollectionDetail',kind,id:Number(id),returnTo:origin};
        else if(kind==='growthDaily'||kind==='growthWeek'){openGrowthSupply(kind==='growthDaily'?'daily':'week',target);return;}
        else if(kind==='supplyTasks'||kind==='signin'){openTasks(kind==='signin'?'signin':'daily',origin);return;}
        else if(kind==='supplyBoxes')modal={type:'pilotSupplyBoxes',returnTo:origin};
        else if(kind==='patrol'){const lock=patrolUnlockMessage();if(lock){toast(lock);return;}patrolScrollPositions.clear();modal={type:'patrol',returnTo:origin};}
        else if(kind==='nativeStars')modal={type:'nativeStarRewards',returnTo:origin};
        else if(kind==='materials'||kind==='chapterCores')modal={type:'chapterRewards',returnTo:origin};
        else if(kind==='equipment'){gearFilter=['1','2','3','4','5'].includes(id)?id:'all';switchTab('assembly');return;}
        else if(kind==='talent'){researchSection='talent';switchTab('research');return;}
        else if(kind==='shop'||kind==='supply'){switchTab(kind);return;}
        renderModal();return;
      }
      if (action === 'bagDetailClose' || (action === 'bagDetailDismiss' && direct)) { closeBackpackDetail(); return; }
      if (action === 'bagItem' && !modal.bagItem && backpackItems(snapshot).some(item => item.id === id)) {
        modal.bagOpener = captureFocus(modalHost, target); modal.bagItem = id; modal.bagChoice=null; modal.bagCount=1; renderModal(); return;
      }
      if (action === 'bagTab' && !modal.bagItem && BACKPACK_TABS.some(item => item.id === data.tab)) {
        if ((modal.bagTab || 'all') === data.tab) return;
        modal.bagTab = data.tab; modal.bagResetScroll = true; renderModal();
        selectModal(modalHost,`.bag-tab[data-tab="${modal.bagTab}"]`)?.focus({preventScroll:true}); return;
      }
      return;
    }
    if (action === 'debug' && bridge.debugToolsEnabled) { modal = { type: 'debug' }; renderModal(); return; }
    if (action === 'copyDeveloperDiagnostics' && modal?.type === 'developerDiagnostics') {
      await presentation.copyReport(modalHost,modal.report);
      return;
    }
    if (modal?.type === 'debug' && bridge.debugToolsEnabled) {
      if (action === 'developerDiagnostics') {
        modal = { type: 'developerDiagnostics', report: diagnosticReport(),
          returnTo: { ...modal, childOpener: captureFocus(modalHost,target) } };
        renderModal();
        return;
      }
      if (action === 'developerSkills') {
        try { setDeveloperSkillsEnabled(!developerSkillsEnabled(presentation.settingsStorage,presentation.settingsStorage)); modal.error = ''; }
        catch (error) { modal.error = error.message || '开发设置保存失败'; }
        renderModal(); return;
      }
      if (action === 'developerChaptersUnlock') {
        await act('developerChaptersUnlock', { expectedRevision: Number(data.revision) });
        return;
      }
      if (action === 'developerResearchUnlock') {
        await act('developerResearchUnlock', { expectedRevision: Number(data.revision) });
        return;
      }
      if (action === 'developerAffectionMax') {
        await act('developerAffectionMax', { pilotId: data.pilot });
        return;
      }
      if (action === 'developerCurrency') {
        await act('developerCurrency', { currency: data.currency, expectedRevision: Number(data.revision) });
        return;
      }
      if (action === 'debugClear') {
        if (modal.clearArmed) {
          clearTimeout(debugClearTimer);
          const result = bridge.clearGameSaveAndRestart?.();
          if (!result?.ok) { modal.error = result?.message || '清档未完成，请重试'; modal.clearArmed = false; renderModal(); }
          return;
        }
        modal.clearArmed = true;
        clearTimeout(debugClearTimer);
        const confirmingModal = modal;
        debugClearTimer = setTimeout(() => { if (modal === confirmingModal) { modal.clearArmed = false; renderModal(); } }, 4500);
        renderModal(); return;
      }
    }
    if (action === 'tab') { if(data.tab!==tab)fleetSupplyReturn=null;switchTab(data.tab); return; }
    if (action === 'equipmentShop' || action === 'researchShop' || (action === 'shopSection' && tab !== 'shop')) {
      switchTab('shop',data.section);
      return;
    }
    if (action === 'equipmentWeapons') { openCatalog('weapon');return; }
    if (action === 'recruitRewards') {modal={type:action};renderModal();return;}
    if (action === 'recruitPreview') {
      const recruitView=cloudNativeRecruitSnapshot(snapshot);
      const next=recruitItems(recruitView).find(item=>item.id===id);
      if(!next)return;
      const current=recruitFeatured(recruitView,selectedRecruitPilot);
      selectedRecruitPilot=next.id;render(true);
      if(next.id!==current?.id)actionFeedback.pulse('pilot-'+next.id);
      const card=selectBody('.rc-preview-card.is-selected');
      card?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
      card?.focus({preventScroll:true});
      return;
    }
    if (action === 'researchDraw') { await act('researchDraw', { pool: data.pool, expectedRevision: Number(data.revision) }); return; }
    if(action==='researchCard'&&!snapshot.research?.cards?.some(c=>String(c.id)===String(id)&&c.owned))return;
    if (['researchCard', 'researchSummary'].includes(action)) { modal = { type: action, id }; renderModal(); return; }
    if (['tasks','pilotSupplyTasks','signin','achievements'].includes(action)) {
      const period=action==='tasks'?undefined:action==='pilotSupplyTasks'?'daily':action;
      const returnTo=modal?.type==='activities'?{...modal,childOpener:captureFocus(modalHost,target)}:undefined;
      openTasks(period,returnTo);return;
    }
    if (action === 'pilotAffection') {
      modal = {type:'pilotAffection',pilotId:snapshot.pilotId};
      renderModal(); return;
    }
    if (action === 'playAffectionVideo') {
      const pilot=snapshot.pilots.find(row=>row.id===id&&(row.owned||row.id===snapshot.pilotId));
      if(modal?.type==='pilotAffection'&&modal.pilotId===id&&pilot?.affection===PILOT_AFFECTION_MAX&&pilotAffectionVideo(id)){
        modal={type:'pilotAffectionVideo',pilotId:id,returnTo:{...modal,childOpener:captureFocus(modalHost,target)}};
        renderModal();
      }
      return;
    }
    if (action === 'browseAffectionPilot') {
      if(modal?.type==='pilotAffection'&&snapshot.pilots.some(p=>p.id===id&&(p.owned||p.id===snapshot.pilotId))){
        modal.pilotId=id;
        renderModal();
      }
      return;
    }
    if (action === 'chapterPrev' || action === 'chapterNext') {
      battleChapter = battleChapterIndex(snapshot,battleChapter) + (action === 'chapterPrev' ? -1 : 1);
      battleChapter = battleChapterIndex(snapshot,battleChapter);
      // Browsing an available chapter must also select a playable stage;
      // otherwise Start remains disabled against the previous chapter's selection.
      const route = snapshot.stages.slice(battleChapter, battleChapter + 1);
      const selected = route.find(stage => stage.index === snapshot.selectedStageIndex && stage.unlocked !== false);
      const entry = selected || route.find(stage => stage.unlocked !== false && !stage.bestCleared)
        || route.find(stage => stage.unlocked !== false);
      if (entry && entry.index !== snapshot.selectedStageIndex) {
        await act('selectStage', { index: entry.index, stageIndex: entry.index });
      }
      render(true); return;
    }
    if (['chapterChest','activities'].includes(action)) { modal={type:action}; renderModal(); return; }
    if (action === 'claimStarReward') { await act('claimStarReward',{mode:data.mode,id:Number(id),expectedRevision:Number(data.revision)});return; }
    if (action === 'taskPeriod') {
      const {period}=data;
      if(modal?.type!=='tasks'||modal.period===period||!isDailyTabAvailable(snapshot,period))return;
      modal.period=period;delete modal.milestoneId;renderModal();actionFeedback.pulse('period-'+period);
      selectModal(modalHost,`.dc-tab[data-period="${period}"]`)?.focus({preventScroll:true});
      return;
    }
    if(action==='taskChest') {
      if(modal?.type!=='tasks')return;
      const period=modal.period||'daily',item=taskChestModel(snapshot,period,id);
      if(data.period!==period||!item)return;
      if(item.canClaim){
        const payload={...item.claim.payload};
        if(data.revision!=null)payload.expectedRevision=Number(data.revision);
        await act(item.claim.action,payload);return;
      }
      modal={type:'taskChestPreview',period,id,returnTo:{...modal,childOpener:captureFocus(modalHost,target),rewardReturnScrollState:captureModalScroll(modalHost)}};
      renderModal();return;
    }
    if (action === 'dailyMilestone') {
      if(modal?.type!=='tasks' || snapshot.rewardPending)return;
      const period=modal.period||'daily',item=snapshot.activity?.[period]?.items.find(row=>row.id===id);
      if(!item || item.claimed || item.pending)return;
      if(item.claimable){await act('claimActivity',{id,period});return;}
      modal.milestoneId=modal.milestoneId===id?null:id;renderModal();return;
    }
    if (action === 'dailyMilestoneClose') {if(modal?.type==='tasks'){delete modal.milestoneId;renderModal();}return;}
    if (action === 'claimActivity') {const result=await act('claimActivity',{id,period:data.period});if(result?.ok)selectModal(modalHost,`.dc-chest[data-id="${id}"]`)?.focus({preventScroll:true});return;}
    if (action === 'claimAchievement') {const result=await act('claimAchievement',{id});if(result?.ok)selectModal(modalHost,`[data-achievement-id="${id}"]`)?.focus({preventScroll:true});return;}
    if (action === 'recoverDailyRewards') {await act(action);return;}
    if (action === 'dailyGo') {
      const destination=data.destination;
      if(destination==='signin'){
        if(modal?.type==='tasks'&&isDailyTabAvailable(snapshot,'signin')){modal.period='signin';renderModal();}
        return;
      }
      if(destination==='shopBoxes'){shopSection='boxes';switchTab('shop');return;}
      if(destination==='patrol'){modal={type:'patrol',returnTo:{...modal,childOpener:captureFocus(modalHost,target)}};renderModal();return;}
      if(destination==='chapters'){modal={type:'chapters',returnTo:{...modal,childOpener:captureFocus(modalHost,target)}};renderModal();return;}
      if(destination==='equipment'){switchTab('assembly');return;}
      if(['shop','boxes'].includes(destination)){switchTab('shop');return;}
      if(destination==='patrol'){const lock=patrolUnlockMessage();if(lock){toast(lock);return;}patrolScrollPositions.clear();modal={type:'patrol',returnTo:{...modal,childOpener:captureFocus(modalHost,target)}};renderModal();return;}
      if(destination==='workshop'){openGearWorkshop(null,target);return;}
      if(['weapon','aircraft'].includes(destination)){modal=null;openCatalog(destination);return;}
      if(['battle','supply'].includes(destination)){switchTab(destination);return;}
      return;
    }
    if(action==='nativeEquipmentBoxLast'){
      const receipt=snapshot.equipmentBoxReceipt;
      if(receipt){modal={type:'shopBoxResult',history:true,receipt,drawn:receipt.uids,pilots:receipt.pilotRewards||[],weapons:receipt.weaponRewards||[],aircraft:receipt.aircraftRewards||[],...(modal?{returnTo:{...modal,childOpener:captureFocus(modalHost,target)}}:{})};renderModal();}
      return;
    }
    if(action==='shopBoxConfirm'||action==='shopBoxRates'){
      const review={type:action,pool:data.pool==='advanced'?'advanced':'basic',count:Number(data.count)===10?10:1,revision:snapshot.equipment.revision,inventoryRevision:snapshot.nativeAcquisition?.revision};
      if(action==='shopBoxConfirm'){
        const box=snapshot.nativeAcquisition?.equipmentBoxes.find(box=>box.id===(review.pool==='advanced'?3:4));
        const quote=box?.quotes.find(quote=>quote.count===review.count);
        if(quote?.canDraw&&(quote.payment==='free'||quote.payment==='key')){
          await openShopBox(review,quote.payment==='free');return;
        }
      }
      modal=review;renderModal();return;
    }
    if(action==='shopBoxOpen'){
      await openShopBox(modal);return;
    }
    if(action==='shopClaimBoxReward'){await act('gearClaimBasicReward',{expectedRevision:snapshot.equipment.revision,expectedInventoryRevision:snapshot.nativeAcquisition.revision});return;}
    if(action==='shopRefreshPreview'){
      await act('shopRefresh',{token:snapshot.shop.token,...(snapshot.shop.refresh.freeRemaining>0?{}:{refreshWithAd:true})});return;
    }
    if(action==='shopQuantity'){
      const offer=snapshot.shop.items.find(item=>item.id===modal?.id);if(!offer)return;
      const max=shopPurchaseMax(offer,snapshot.wallet),next=data.step==='max'?max:(modal.quantity||1)+Number(data.step);
      modal.quantity=Math.max(1,Math.min(Math.max(1,max),next));renderModal();return;
    }
    if (action === 'shopSection') {
      scrollShopSection(data.section);
      return;
    }
    if (action === 'shopOffer') {
      const item=snapshot.shop.items.find(o=>o.id===id);if(!item?.available)return;
      if(item.cost.amount){modal={type:'shopConfirm',id,token:snapshot.shop.token,quoteKey:shopOfferQuote(item),quantity:1,...(modal?.type==='stamina'?{returnTo:{...modal,childOpener:captureFocus(modalHost,target)}}:{})};renderModal();return;}
      if(item.cost.type==='ad')toast('正在请求广告，完整观看后领取');
      focus?.offerPending(target,item.cost.type==='ad'?'广告加载中…':'领取中…');
      try { await act('shopBuy',{id,token:snapshot.shop.token}); }
      finally { render(true); }
      return;
    }
    if (action === 'shopConfirm') {const review=modal,token=review?.type==='shopConfirm'?review.token:null;if(token){const result=await act('shopBuy',{id,token,quantity:review.quantity||1});if(!result?.ok&&modal?.type==='shopConfirm')renderModal();}return;}
    if (action === 'playerInfo') { modal = {type:'playerInfo'}; renderModal(); return; }
    if (action === 'playerRename' && modal?.type === 'playerInfo') {
      modal.editingName=true;modal.nameDraft=snapshot.playerName;modal.nameError='';renderModal();
      const input=selectModal(modalHost,'[data-player-name]');input?.focus();input?.select();return;
    }
    if (action === 'playerRenameCancel' && modal?.type === 'playerInfo') {
      modal.editingName=false;modal.nameError='';renderModal();selectModal(modalHost,'[data-action="playerRename"]')?.focus();return;
    }
    if (action === 'playerRenameSave' && modal?.type === 'playerInfo') {
      const result=await act('renamePlayer',{name:data.name ?? modal.nameDraft,expectedRevision:Number(data.renameRevision),
        expectedCost:Number(data.renameCost),expectedName:data.renameName});
      if(result?.ok){modal.editingName=false;modal.nameError='';pendingModalBackgroundRefresh=true;}
      else modal.nameError=result?.message||'名字未保存，请重试';
      renderModal();selectModal(modalHost,result?.ok?'[data-action="playerRename"]':'[data-player-name]')?.focus();return;
    }
    if (action === 'catalog') { openCatalog(data.kind); return; }
    if (action === 'catalogBack') { returnFromCatalog(); return; }
    if (action === 'catalogGrowth') {
      if (!weaponFor(id)) return;
      modal={type:'weaponSkillGroup',id,opener:captureFocus(root,target)}; renderModal(); return;
    }
    if (action === 'catalogSkill') {
      if (!weaponCatalogSkills(weaponFor(id)).some(row=>row.key===data.skill)) return;
      modal={type:'weaponSkill',id,skillKey:data.skill,opener:captureFocus(root,target)}; renderModal(); return;
    }
    if (action === 'catalogSelect') { if (subpage === 'weapon') selectedWeapon = id; else if (subpage === 'aircraft') browseAircraft = id; else browsePilot = id; render(true); return; }
    if (action === 'catalogMode') { weaponSkillSlot=-1;catalogSkillTab = data.mode === 'skills'; if(fleetUi[subpage])Object.assign(fleetUi[subpage],{selectedSkillSlot:null,pendingSkillId:null,selectedSkillId:null});render(true); return; }
    if(action==='fleetSkillCancel'){const slot=fleetUi[subpage]?.selectedSkillSlot;if(fleetUi[subpage])Object.assign(fleetUi[subpage],{selectedSkillSlot:null,pendingSkillId:null,selectedSkillId:null});render(true);selectBody(`.fc-skill-group [data-slot="${slot??0}"]`)?.focus({preventScroll:true});return;}
    if(action==='fleetSkillSlot') {
      const kind=data.kind,slot=Number(data.slot),ui=fleetUi[kind];if(!ui)return;
      if(ui.pendingSkillId){const result=await act('fleetSkillEquip',{kind,id:ui.pendingSkillId,slot,expectedRevision:snapshot.fleet?.revision});if(result?.ok)Object.assign(ui,{pendingSkillId:null,selectedSkillSlot:null});}
      else ui.selectedSkillSlot=catalogSkillTab&&ui.selectedSkillSlot===slot?null:slot;
      catalogSkillTab=true;render(true);selectBody(`.fc-skill-group [data-slot="${slot}"]`)?.focus({preventScroll:true});return;
    }
    if(action==='fleetSkillEquip') {
      const kind=data.kind,ui=fleetUi[kind],slots=snapshot.fleet?.[kind]?.slots||[];if(!ui)return;
      const slot=ui.selectedSkillSlot??slots.indexOf(null);
      if(slot<0){ui.pendingSkillId=id;render(true);selectBody('.fc-skill-group button')?.focus({preventScroll:true});return;}
      const result=await act('fleetSkillEquip',{kind,id,slot,expectedRevision:Number(data.revision)});
      if(result?.ok){Object.assign(ui,{selectedSkillSlot:null,pendingSkillId:null,selectedSkillId:null});render(true);selectBody(`.fc-skill-group [data-slot="${slot}"]`)?.focus({preventScroll:true});}return;
    }
    if(action==='fleetSkillRemove') {const kind=data.kind,slot=Number(data.slot),result=await act('fleetSkillRemove',{kind,id,slot,expectedRevision:Number(data.revision)});if(result?.ok){Object.assign(fleetUi[kind],{selectedSkillSlot:null,pendingSkillId:null,selectedSkillId:null});render(true);selectBody(`.fc-skill-group [data-slot="${slot}"]`)?.focus({preventScroll:true});}return;}
    if(action==='fleetSkillPreview') {modal={type:'fleetSkill',kind:data.kind,id,opener:captureFocus(root,target)};renderModal();return;}
    if(action==='fleetUnlock'||action==='fleetStar') {
      const parent=modal?{...modal,childOpener:captureFocus(modalHost,target)}:null;
      modal={type:'fleetOperation',kind:data.kind,id,operation:action==='fleetUnlock'?'activate':'starUp',opener:captureFocus(root,target),...(parent?{returnTo:parent}:{})};renderModal();return;
    }
    if(action==='fleetConfirm') {
      if(modal?.type!=='fleetOperation')return;
      const operation={...modal},result=await act(modal.operation==='activate'?'fleetActivate':'fleetStarUp',{kind:modal.kind,id:modal.id,expectedRevision:Number(data.revision)});
      if(showProcessRecords(result?.uiFeedbackRecords,operation.returnTo))return;
      modal={...operation,result:result?.ok?result:undefined,error:result?.ok?'':result?.message||'操作未完成'};renderModal();return;
    }
    if(action==='fleetAcquire') {
      const kind=data.kind,chosen=fleetItem(kind,id);if(!chosen)return;
      fleetSupplyReturn={kind,id,skillTab:catalogSkillTab,filter:catalogFilter};
      selectedRecruitPilot=id;modal=null;switchTab('supply');return;
    }
    if(action==='fleetSupplyBack') {
      if(!fleetSupplyReturn)return;const previous=fleetSupplyReturn;fleetSupplyReturn=null;
      tab='assembly';subpage=previous.kind;catalogSkillTab=previous.skillTab;catalogFilter=previous.filter;modal=null;
      if(subpage==='aircraft')browseAircraft=previous.id;else browsePilot=previous.id;
      render(true);selectBody('.fc-hero-actions button:not(:disabled)')?.focus({preventScroll:true});return;
    }
    if (action === 'catalogAcquire') { if(data.kind==='weapon'){switchTab('shop');return;} if(snapshot.pilots.some(p=>p.id===id))selectedRecruitPilot=id;switchTab('supply');return; }
    if (action === 'openWorkshop') { if(!id){openGearWorkshop(null,target);return;}workshopKind='weapon';workshopMode=data.mode==='quality'?'quality':'level';catalogWorkshopReturn=subpage==='weapon'?{skillTab:catalogSkillTab,weaponId:selectedWeapon,opener:captureFocus(root,target)}:null;if(tab==='assembly'&&!subpage)equipmentReturnFocus=captureFocus(root,target);tab = 'assembly'; subpage = 'workshop'; workshopId = id || null; workshopRevealSelection=Boolean(id); workshopFilter = 'all'; modal = null; render(true); return; }
    if (action === 'workshopSelect') { workshopId = id; render(true); return; }
    if (action === 'workshopMode') { workshopMode = data.mode === 'quality' ? 'quality' : 'level'; workshopFilter = 'all'; render(true); selectBody(`.ws-modes [data-mode="${workshopMode}"]`)?.focus({preventScroll:true}); return; }
    if (action === 'workshopChoose') { selectBody('.ref-warehouse')?.scrollTo({top:0,behavior:'smooth'}); selectBody('.ref-warehouse :is(.eq-card,.ag-card)')?.focus({preventScroll:true}); return; }
    if (action === 'workshopFilter') { modal={type:'workshopFilter',opener:captureFocus(root,target)};renderModal();return; }
    if (action === 'workshopFilterSelect') { if(!(workshopKind==='gear'?['all','1','2','3','4','5']:WORKSHOP_FILTERS).includes(data.filter))return;workshopFilter=data.filter;modal=null;render(true);return; }
    if (action === 'workshopSynthesize') { await act('synthesizeWeapon', {id,expectedQualityRank:Number(data.rank)}); return; }
    if (action === 'workshopBatch') { const plan = snapshot.workshop?.batch; if (plan?.steps?.length) { modal = {type:'workshopBatch',plan:structuredClone(plan)}; renderModal(); } return; }
    if (action === 'workshopConfirmBatch') { const token = modal?.plan?.token; if (token) { modal = null; await act('synthesizeAll',{token}); } return; }
    if (action === 'patrolQuick' && modal?.type === 'patrol') {modal={type:'quickPatrol',returnTo:{...modal,childOpener:captureFocus(modalHost,target)}};renderModal();return;}
    if (action === 'patrol') {const lock=patrolUnlockMessage();if(lock){toast(lock);return;}patrolScrollPositions.clear();modal={type:'patrol',...(['activities','nativeLab'].includes(modal?.type)?{returnTo:{...modal,childOpener:captureFocus(modalHost,target)}}:{})};renderModal();return;}
    if (action==='stamina'&&['chapterChest','chapterRewards','chapterCoreRewards'].includes(modal?.type)) {
      modal={type:'stamina',returnTo:{...modal,childOpener:captureFocus(modalHost,target)}};renderModal();return;
    }
    if (['stages', 'chapters', 'formation', 'stamina', 'backpack'].includes(action)) { modal = { type: action }; renderModal(); return; }
    if (action === 'pilotInfo') { modal = { type: action, id }; renderModal(); return; }
    if (action === 'aircraftInfo') { modal = { type: action, id }; renderModal(); return; }
    if (action === 'weapon' || action === 'weaponInfo') { openWeaponDetails(id,target,action==='weaponInfo'); return; }
    if (action === 'pickSlot') { if (WEAPON_EQUIP_SLOTS.includes(data.slot)) {if(modal?.type==='weapon')modal.targetSlot=data.slot;else selectedSlot=data.slot;} renderModal(); return; }
    if (action === 'selectPilot') { await act('selectPilot', { id, pilotId: id }); return; }
    if (action === 'selectAircraft') { const a = snapshot.aircraft.find(a => a.id === id); if (!a?.owned) { switchTab('supply'); return; } await act('selectAircraft', { id, aircraftId: id }); return; }
    if (action === 'catalogEquipWeapon') {
      const w=weaponFor(id);if(!w?.owned){switchTab('shop');return;}
      const free=WEAPON_EQUIP_SLOTS.find(slot=>!snapshot.loadout[slot]);
      if(!free){openWeaponDetails(id,target,false,true);return;}
      await act('equipWeapon',{id,weaponId:id,slot:free,expectedToken:snapshot.loadoutToken});return;
    }
    if (action === 'equipWeapon') { const w = weaponFor(id); if (!w?.owned) { switchTab('shop'); return; } const slot = modal?.requireSlotSelection?modal.targetSlot:modal?.targetSlot || selectedSlot;if(!slot){toast('选择要替换的位置');return;} const result = await act('equipWeapon', { id, weaponId: id, slot, slotId: slot,expectedToken:modal?.loadoutToken??snapshot.loadoutToken }); if(result?.ok){closeWeaponDetails(slot);actionFeedback.equip(slot);}return; }
    if (action === 'unequipWeapon') { const slot=data.slot;const result=await act('equipWeapon', { id:null,weaponId:null,slot,slotId:slot,expectedToken:modal?.loadoutToken??snapshot.loadoutToken });if(result?.ok)closeWeaponDetails(slot);return; }
    if (action === 'chapterDetails') {modal={type:'chapterDetails',stageIndex:battleChapterIndex(snapshot,battleChapter)};render(true);return;}
    if (action === 'chapterDetailsStart') {
      const index=modal?.type==='chapterDetails'?modal.stageIndex:null;
      if(index===null||snapshot.stages[index]?.unlocked===false)return;
      const result=await act('start',{index,stageIndex:index});
      if(result?.ok){modal=null;render(true);if(!result.started)bridge.startGame?.();}
      return;
    }
    if (action === 'stage') { const index=Number(data.index); await act('selectStage', { index, stageIndex: index }); battleChapter=index; modal = null; render(true); return; }
    if (action === 'upgrade' && snapshot.replicaCollection) {
      modal=null;subpage=data.kind==='aircraft'?'aircraft':'weapon';catalogSkillTab=false;render(true);return;
    }
    if (action === 'upgrade') { await act(data.kind === 'aircraft' ? 'upgradeAircraft' : 'upgradeWeapon', { id }); return; }
    if (action === 'recruit') { await act('pilotSupply', { action:'draw', count:Number(data.count), expectedRevision:snapshot.pilotSupply?.revision }); return; }
    if (action === 'claimSignIn') { await act('claimSignIn'); return; }
    if (action === 'claimTask') { const result=await act('claimTask', { id });if(result?.ok)selectModal(modalHost,`[data-task-id="${id}"]`)?.focus({preventScroll:true});return; }
    if (['claimPatrol','quickPatrol','quickPatrolAd','devPatrolSample'].includes(action)) { await act(action,{expectedRevision:Number(data.revision)}); return; }
    if (action === 'start') {
      const index = snapshot.firstSortieRequired ? 0 : battleChapterIndex(snapshot, battleChapter);
      const result = await act('start', { index, stageIndex: index });
      if (result?.ok && !result.started) bridge.startGame?.();
    }
  }
  function keydown(event) {
    if (!visible||snapshot?.firstSortieRequired) return;
    if(event.defaultPrevented||event.target?.matches?.('input,textarea'))return;
    const fleetState=fleetUi[subpage];
    if (event.key !== 'Escape') return;
    if(modal?.type==='pilotAffectionVideo')event.preventDefault();
    if(!modal&&subpage==='weapon'&&catalogSkillTab&&weaponSkillSlot>=0){const slot=weaponSkillSlot;weaponSkillSlot=-1;render(true);selectBody(`.wg-skill-slot[data-slot="${slot}"]`)?.focus({preventScroll:true});return;}
    if(!modal&&fleetState&&(fleetState.selectedSkillSlot!=null||fleetState.pendingSkillId)){const slot=fleetState.selectedSkillSlot;Object.assign(fleetState,{selectedSkillSlot:null,pendingSkillId:null,selectedSkillId:null});render(true);selectBody(`.fc-skill-group [data-slot="${slot??0}"]`)?.focus({preventScroll:true});return;}
    if (busy && polishedTab()) return;
    if(advanceProcessFeedback())return;
    if (closeBackpackDetail()) return;
    if(modal?.type==='tasks' && modal.milestoneId){delete modal.milestoneId;renderModal();return;}
    if(returnToParentModal())return;
    if(closeFleetOperation())return;
    if (modal?.type==='weapon') closeWeaponDetails();
    else if (modal) { modal = null; renderModal(); }
    else if (subpage) returnFromCatalog();
  }
  const removeKeyboard=presentation.bindBack?.(keydown);
  const initial=read();
  if(deferFirstSortieLobby&&initial.firstSortieRequired){
    snapshot=initial;tab='battle';visible=false;
    presentation.setVisible(false);
    portraitPlayer.setVisible(false,{suspendLoading:true});
  }else render(true,initial);
  return {
    root,
    get tab() { return tab; }, get snapshot() { return snapshot; },
    get state() { return { tab, subpage, catalogSkillTab, catalogFilter, visible, modal: modal?.type || null, selectedSlot, selectedWeapon, pool:'pilot', workshopId }; },
    switchTab, render() { render(true); }, refresh() { render(true); },
    prepareMenus(){
      if(!destroyed&&snapshot){
        return screen.prepareMenus?.((page,afterSettlement=false)=>{
          const data=menuData(page);
          if(!afterSettlement)return {data,key:signature};
          const next=read();
          return {data:{...data,snapshot:next},key:patrolRenderSignature(next)};
        },sendMenuAction,menuInteractive,selectShopSection,{firstSortieRequired:snapshot.firstSortieRequired});
      }
    },
    prepareCatalogs(){
      if(!destroyed&&snapshot?.replicaCollection){
        screen.prepareCatalogs?.(page=>({data:menuData(page,menuCatalog(page,true)),key:signature}),
          sendMenuAction,menuInteractive,selectShopSection);
      }
    },
    prepareActivityPanels(){
      if(destroyed||!snapshot)return;
      screen.prepareActivityPanels?.(kind=>{
        if(kind==='tasks'&&!isDailyTabAvailable(snapshot,'signin'))return null;
        const modal=kind==='tasks'?{type:'tasks',period:resolveDailyPeriod(snapshot)}:carnivalEntry();
        return modal?{snapshot,modal,signature}:null;
      },runLobbyCommand,dailyScrollPositions);
    },
    prepareWorkshops(){
      if(destroyed||!snapshot)return;
      screen.prepareWorkshops?.(kind=>{
        const gear=kind==='gear',workshop={kind,id:gear?null:firstCatalogId('weapon')??null,filter:'all',mode:'level',
          draft:gear?emptyGearMerge(snapshot.equipment.revision):null,backLabel:'返回装备'};
        return {data:menuData('workshop',null,workshop),key:signature};
      },sendMenuAction,menuInteractive,selectShopSection);
    },
    startPortraits() {
      if(destroyed||portraitsEnabled||portraitStartFrame!==null)return;
      // Let the interactive lobby and its still portrait paint first.
      portraitStartFrame=presentation.requestFrame(()=>{
        portraitStartFrame=presentation.requestFrame(()=>{
          portraitStartFrame=null;
          if(destroyed)return;
          portraitsEnabled=true;
          portraitPlayer.sync();
        });
      });
    },
    setVisible(value) {
      const returningFromFirstSortie=value&&!visible&&snapshot?.firstSortieRequired;
      visible = Boolean(value);presentation.setVisible(visible);
      if(!visible&&modal?.type==='pilotAffectionVideo')returnToParentModal();
      portraitPlayer.setVisible(visible&&!modal,{suspendLoading:!visible});
      if(!visible){
        onboarding.hide();actionFeedback.clear();screen.toast.clear();itemDescriptions.close();
      }else if(returningFromFirstSortie){
        render(true);
        onboarding.tick(0);
      }else render();
    },
    update(ticker) { if (destroyed || !visible || presentation.hidden()) return; performanceMonitor.frame('lobby'); return performanceMonitor.measure('ui',()=>{const dt = typeof ticker === 'number' ? ticker : (ticker?.deltaMS || 16.67) / 1000; elapsed += dt; onboarding.tick(dt);homeView?.tick();menuView?.tick();nativeDialog?.tick?.(dt);
      if (elapsed >= 1) {
        elapsed %= 1;
        const clock = snapshot && (!modal||modal.type==='carnival') && !busy && !pendingModalBackgroundRefresh
          ? bridge.getPeripheralClock?.() : null;
        if (clock) {
          const {time, ...patrolClock} = clock;
          snapshot = { ...snapshot, patrol: { ...snapshot.patrol, ...patrolClock } };
          nativeDialog?.clock?.(snapshot.patrol);
          nativeDialog?.activityClock?.(time);
          if(tab==='battle'&&!subpage)bridge.app?.renderer?.publishHome?.(snapshot,battleChapterIndex(snapshot,battleChapter),bridge.debugToolsEnabled);
          if(tab==='shop')menuView?.clock(time);
        } else render();
      } }); },
    destroy() {
      destroyed = true;releaseNativeReceipt();releaseNativeBackpack();releaseOverlayDialog();releaseNativeDialog();homeView?.close();homeView=null;menuView?.close();menuView=null;
      if(portraitStartFrame!==null)presentation.cancelFrame(portraitStartFrame);
      itemDescriptions.destroy(); if(bridge.showItemDescription===itemDescriptions.open)delete bridge.showItemDescription;
      onboarding.destroy();actionFeedback.clear();clearTimeout(debugClearTimer);removeKeyboard?.();portraitPlayer.destroy();presentation.close();
    },
  };
}
