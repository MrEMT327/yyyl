import { createItemDescriptionLayer } from './item-description-layer.js';
import './scroll-surfaces.css';
import { aircraftActivationDialog } from './aircraft-activation.js';
import {committedFeedbackRecords,collectionFeedbackRecords,progressionFeedbackRecords} from './process-feedback-model.js';
import {processFeedbackDialog,boxOpeningDialog,boxResultActions,createProcessFeedbackMotion} from './process-feedback.js';
import {attachRecruitStripDrag} from './recruit-strip-drag.js';
import { isResourceShortage, shortageToast } from './resource-availability.js';
import './interface-clarity.css';
import { developerSkillsEnabled, setDeveloperSkillsEnabled } from '../developer-battle-settings.js';
import { researchArt } from './research-art.js';
import {createLobbyOnboarding} from './lobby-onboarding.js';
import {qualityDisplayLabel} from './quality-display-label.js';
import {rewardItemModel} from './reward-item-model.js';
import {rewardItemSlot} from './reward-item-slot.js';
import { copyDiagnosticReport, diagnosticReport } from '../diagnostic-log.js';
import { developerToolsDialog } from './developer-tools-panel.js';
import './developer-tools.css';
import {commonRewardsDialog,isCommonReward} from './common-rewards.js';
import {isRetainedModalLayer,modalIdentity,mountRewardLayers,labelRewardLayer,captureModalScroll,restoreModalScroll} from './reward-modal-stack.js';
import {updateWeaponShowcase} from './weapon-showcase-update.js';
import './reward-modal-stack.css';
import {shopBoxRewards} from './shop-box-result-cards.js';
import {playerName} from '../player-identity.js';
import './psd-empty-slot.css';
import { lobbyNavigation } from './lobby-navigation.js';
import { chapterPresentationForStage, chapterPreviewBackground } from '../replica/chapter-presentation.js';
import {chapterDetails} from './chapter-details.js';
import { weaponIconUrl } from './weapon-icon-source.js';
import './peripheral-lobby.css';
import { AIRCRAFTS } from '../pilots.js';
import { COMMON_WEAPONS } from '../fixed-parts/common-weapons.js';
import { createPeripheralModels } from './peripheral-models.js';
import { aircraftUiImage, aircraftPreview } from './aircraft-preview.js';
import { performanceMonitor } from '../performance-monitor.js';
import { setUiMarkup, clearUiMarkupCache } from './ui-markup.js';
import { flattenDisclosureMarkup } from './flat-sections.js';
import { optimizeUiAssetUrls } from './ui-image-source.js';
import { pilotHoloCard, bindPilotHoloCards } from './pilot-holo-card.js';
import './pilot-holo-card.css';
import './peripheral-polish.css';
import {
  cloudNativeCatalog, cloudNativeCollectionOperation, cloudNativeRecruitSnapshot,
  cloudNativeRecruit, cloudNativeCollectionDetail, cloudNativeSkillPreview, cloudNativeWeaponPreview,
} from '../replica/cloud-native-pages.js';
import { weaponCatalogSkillDetail, weaponCatalogGrowthDetail } from './weapon-catalog-page.js';
import { fleetAircraftDetail, fleetPilotDetail, fleetSkillPreview, fleetOperationModal } from './fleet-catalog-page.js';
import { workshopReferencePage, workshopFilterDialog, WORKSHOP_FILTERS } from './workshop-reference-page.js';
import './reference-shell-pages.css';
import { recruitModal, recruitItems, recruitFeatured } from './recruit-page.js';
import { growthSupplyDialog } from './growth-supply-panel.js';
import { chapterRewardsDialog } from './chapter-rewards-panel.js';
import { nativeStarRewardsDialog } from './native-star-rewards-panel.js';
import { pilotSupplyPanel } from './pilot-supply-panel.js';
import { isRecruitResult, recruitResultsDialog, recruitRewardsDialog, pilotRecruitResults } from './recruit-results.js';
import './peripheral-unified.css';
import { nativeEquipmentBoxDetail } from './native-equipment-box-detail.js';
import { isNativeEconomyActionPending, NATIVE_PENDING_ECONOMY_MESSAGE } from '../replica/native-economy-availability.js';
import { researchUnlockMessage } from './research-tabs.js';
import { nativeLabPage, nativeLabDetail, nativeStatsDetail } from './native-lab-page.js';
import { researchPage, researchModal, researchHeader } from './research-page.js';
import './research-page.css';
import { shopPage, shopHeader, shopModal, shopSectionId, shopPurchaseMax, shopOfferQuote, reconcileShopReview, refreshShopClocks } from './shop-page.js';
import { hasLobbyGrowthFeedback, showLobbyGrowthFeedback } from './lobby-growth-feedback.js';
import { createActionFeedback } from './action-feedback.js';
import { actionRewards, rewardReturnModal } from './reward-feedback-policy.js';
import { createLobbyStateFeedback } from './lobby-state-feedback.js';
import { createUiMotion } from './ui-motion.js';
import './shop-page.css';
import { equipmentPage, equipmentHeader } from './equipment-page.js';
import { bindEquipmentChoices } from './equipment-toolbar.js';
import { lobbyResources } from './lobby-resources.js';
import './equipment-page.css';
import './recruit-page.css';
import './peripheral-quality.css';
import { battlePage, battleHeader, battleChapterIndex, battleSupplementalModal, pilotAffectionDialog } from './battle-page.js';
import { PILOT_AFFECTION_MAX, isHiddenPilotAffectionAction, pilotAffectionVideo } from '../peripheral/pilot-affection.js';
import { mountPilotVideoControls } from './pilot-video-controls.js';
import { releaseOwnedVideo } from './release-owned-video.js';
import './battle-supplemental.css';
import './psd-main-v1.css';
import { portraitPresentation } from './character-portraits.js';
import { createCharacterPortraits } from './character-portrait-controller.js';
import './character-portraits.css';
import { resourceIcon } from './resource-icons.js';
import { lobbyCommandPanel, COMMAND_PANELS } from './lobby-command-panels.js';
import './lobby-command-panels.css';
import { illustratedGlyph } from './illustrated-icons.js';
import { projectIcon } from './project-ui-art.js';
import './resource-icons.css';
import './peripheral-layout.css';
import './lobby-subpages.css';
import './workshop-scene.css';
import './hangar-subpages.css';
import './card-selection.css';
import './lobby-theme.css';
import './subpage-controls.css';
import './secondary-surfaces.css';
import './lobby-command-skin.css';
import { WEAPON_EQUIP_SLOTS } from './weapon-equip-controls.js';
import { equipmentWeaponDetail, equipmentWeaponDialog } from './equipment-weapon-detail.js';
import './weapon-equip-controls.css';
import './lobby-chrome.css';
import './lobby-secondary-controls.css';
import './gui-casual-pages.css';
import './gui-casual.css';
import { isItemUseBatchCount } from '../replica/item-use-batches.js';
import { backpackUseRule } from '../replica/native-backpack-use.js';
import { backpackDialog, backpackItems, BACKPACK_TABS } from './backpack-panel.js';
import './backpack-panel.css';
import { PAPER_MODAL_TYPES } from './lobby-paper-panels.js';
import { patrolPanel, quickPatrolPanel, patrolRewardsPanel } from './patrol-center.js';
import { patrolRenderSignature, refreshPatrolClocks } from './patrol-clock.js';
import './lobby-paper-panels.css';
import { captureFocus, restoreFocus, trapModalTab } from './peripheral-focus.js';
import './psd-global-navigation.css';
import { popupLevel } from './psd-popup.js';
import './psd-popup.css';
import './equipment-reference.css';
import { dailyCenter, dailyActivities, formationPanel, DAILY_TABS } from './daily-center.js';
import {taskChestModel} from './task-chest-model.js';
import {taskChestPreview,taskChestPreviewDialog,positionTaskChestPreview} from './task-chest-preview.js';
import './original-environments.css';
import {gearModal} from './airframe-equipment-page.js';
import {emptyGearMerge,gearMergeDraft,pickGearMergeItem,removeGearMergeMaterial} from './gear-merge-selection.js';
import './psd-equipment-v1.css';
import './psd-quality-frames.css';
import './psd-controls.css';
import './psd-surface-fixes.css';
import './ui-polish.css';
import './flat-sections.css';
import {dockGearActions} from './modal-action-layout.js';
import {playerInfoPanel} from './player-info.js';
import './player-info.css';
import './aircraft-catalog-refresh.css';
import './psd-titles.css';
import './control-roles.css';
import './psd-page-chrome.css';
import './psd-card-selection.css';
import './small-text.css';

const TABS = [{ id: 'shop', title: '商城', icon: 'shop' }, { id: 'assembly', title: '装备', icon: 'weapon' }, { id: 'battle', title: '战役', icon: 'plane' }, { id: 'research', title: '科技研究', icon: 'research' }, { id: 'supply', title: '招募', icon: 'crate' }];
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const number = value => value == null ? '—' : Number(value).toLocaleString('zh-CN', {useGrouping:false, maximumFractionDigits: 1 });
const clearNativeTooltips = root => root.querySelectorAll('[title]').forEach(node => node.removeAttribute('title'));
// Custom-property URLs are consumed by CSS under assets/ in production. Resolve them against the page first.
const asset = name => new URL(`${import.meta.env.BASE_URL}art/peripheral-v1/${name}.webp`, document.baseURI).href;
const entryIcon = name => `${import.meta.env.BASE_URL}art/peripheral-v2/icons/entry-${name === 'pilot' ? 'pilot-silhouette' : name}.png`;
const weaponIcon = weaponIconUrl;
const img = (url, alt, cls = '', extra = '') => url ? `<img class="${cls}" src="${escape(optimizeUiAssetUrls(url))}" alt="${escape(alt)}" decoding="async" draggable="false" ${extra}>` : '';
const glyphs = {
  upgrade: '<path d="m12 2 10 9h-6v11H8V11H2Z" fill="#92e379"/><path d="M5 17H2m20 0h-3M5 21H2m20 0h-3"/>',
  crate: '<path d="M3 8h18v13H3Z" fill="#f6c766"/><path d="M2 5h20v5H2Z" fill="#ffe396"/><path d="M10 5h4v16h-4Z" fill="#78b6ec"/><path d="M12 5Q2 5 5 1q3-2 7 4Zm0 0q10 0 7-4-3-2-7 4Z" fill="#a0d6fb"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="3" fill="#f6faff"/><path d="M3 9h18M7 2v5m10-5v5m-9 8 3 3 6-7"/>',
  mission: '<path d="M6 2h12v20H4V4h2" fill="#edf7ff"/><path d="M9 2h6v4H9Zm0 9h6m-6 4h6M6 11h.1M6 15h.1"/>',
  medal: '<path d="m6 14-2 8 8-4 8 4-2-8" fill="#5bb5eb"/><circle cx="12" cy="9" r="8" fill="#ffde6c"/><path d="m12 4 1.5 3 3.5.5-2.5 2.5.5 3.5-3-1.5-3 1.5.5-3.5L7 7.5l3.5-.5Z" fill="#fff3b1"/>',
  parts: '<path d="m10 2 4 0 1 4 4 1 3 4-3 3v5l-5 1-3 2-3-4-5-1-1-5 4-3V4Z" fill="#a3d8ef"/><circle cx="12" cy="12" r="4" fill="#f0faff"/>',
  shard: '<path d="m8 2 10 4 3 11-12 5-7-8Z" fill="#c58cff"/><path d="m8 2 1 20 9-16-16 8 19 3"/>',
  lock: '<rect x="5" y="10" width="14" height="12" rx="3" fill="#c0cbd7"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 6v2"/>',
  arrow: '<path d="m8 4 8 8-8 8" fill="none"/>',
  close: '<path d="m6 6 12 12M18 6 6 18" fill="none"/>',
  check: '<path d="m4 12 5 5L20 5" fill="none"/>',
  star: '<path d="m12 1 3.3 6.7 7.4 1.1-5.4 5.2 1.3 7.4-6.6-3.5-6.6 3.5 1.3-7.4-5.4-5.2 7.4-1.1Z" fill="#ffdb58"/>',
  heart: '<path d="M12 21 3.5 12.2C-2 5.2 6.3-.8 12 5.3 17.7-.8 26 5.2 20.5 12.2Z" fill="#ff6c84"/>',
};
function icon(name, cls = '') {
  if (name === 'check') return `<svg class="pl-icon ui-status-check ${cls}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const resource = resourceIcon(name, `pl-icon ${cls}`);
  if (resource) return resource;
  const originalSymbol = {research:'nav-research',crate:'chest-closed',gift:'chest-closed',mission:'task-log',medal:'activity-medal',mail:'mail',map:'chapter-map',lock:'lock',arrow:'chevron-right',check:'check',star:'star'}[name];
  if (originalSymbol) return projectIcon(originalSymbol,`pl-icon ${cls}`);
  if (name === 'weapon' || name === 'pilot' || name === 'plane') return `<img class="pl-icon pl-illustrated-icon ${cls}" src="${entryIcon(name)}" alt="" aria-hidden="true" draggable="false">`;
  return illustratedGlyph(glyphs[name] || glyphs.parts, cls);
}
function button(action, label, cls = '', data = '', disabled = false) { return `<button type="button" class="pl-button ${cls}" data-action="${action}" ${data} ${disabled ? 'disabled' : ''}>${label}</button>`; }

export function mountPeripheralLobby({ bridge, parent = document.body, system, deferPortraits = false } = {}) {
  if (!bridge) throw new TypeError('mountPeripheralLobby requires a bridge');
  const root = document.createElement('section'); root.className = 'peripheral-lobby psd-nav-global'; root.id = 'gui-casual-lobby'; root.setAttribute('aria-label', '少女航线指挥部');
  root.innerHTML = '<div class="pl-shell"><header class="pl-header"></header><div class="pl-resource-host"></div><main class="pl-body"></main><nav class="pl-nav lobby-nav" data-button-bar aria-label="主导航"></nav><div class="pl-modal-host"></div><div class="pl-toast" role="status" aria-live="polite"></div></div>';
  parent.append(root);
  const header = root.querySelector('.pl-header'), resourceHost = root.querySelector('.pl-resource-host'), body = root.querySelector('.pl-body'), nav = root.querySelector('.pl-nav'), modalRoot = root.querySelector('.pl-modal-host');
  let modalHost=modalRoot,rewardLayer=null;
  const initializedShopScrollports=new WeakSet();
  const nativeTabCache = bridge.platformKind === 'wechat';
  const screen=bridge.app?.renderer;
  let homeView=null,menuView=null;
  const usesMenuCanvas=()=>screen?.supportsMenu?.(tab,subpage);
  const usesHomeCanvas=()=>Boolean(screen?.mountHome)&&tab==='battle'&&!subpage;
  const uiMotion = createUiMotion(root,{immediateTabs:nativeTabCache});
  const pageMarkup = new Map();
  let markupSnapshot;
  const releaseInactiveTabs = () => {
    pageMarkup.clear(); markupSnapshot=undefined;
    clearUiMarkupCache(body,{keepCurrent:true});
    clearUiMarkupCache(header,{keepCurrent:true});
    if(!models.attached)models.release();
  };
  let tab = TABS.some(t => t.id === bridge.activeLobbyTab) ? bridge.activeLobbyTab : 'battle';
  let snapshot, signature = '', visible = true, destroyed = false, busy = false, elapsed = 0, toastTimer, debugClearTimer = 0, modal = null;
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
  let modalOpener = null, renderedModalKey = '', renderedModalContent = '', recruitScroll = 0;
  let pendingModalBackgroundRefresh = false;
  let processSequence=0,pendingProcessRecords=[];
  const polishedTab = () => ['shop','assembly','battle','research','supply'].includes(tab);
  let weaponSkillSlot=-1;
  let subpage = '', catalogSkillTab = false, catalogFilter = 'all', workshopId = null, workshopFilter = 'all', workshopMode = 'level';
  const catalogScrollPositions = new Map();
  const fleetUi={aircraft:{selectedSkillSlot:null,pendingSkillId:null,selectedSkillId:null},pilot:{selectedSkillSlot:null,pendingSkillId:null,selectedSkillId:null}};
  let fleetSupplyReturn=null;
  const fleetItem=(kind,id)=>(kind==='aircraft'?snapshot.aircraft:snapshot.pilots).find(item=>item.id===id);
  const workshopScrollPositions = new Map();
  const dailyScrollPositions = new Map();
  const patrolScrollPositions = new Map();
  let workshopRevealSelection = false;
  let catalogWorkshopReturn = null;
  const releaseHoloCards = bindPilotHoloCards(root);
  const releaseEquipmentChoices = bindEquipmentChoices(root);
  const portraitPlayer = createCharacterPortraits(bridge.app?.renderer);
  const models = createPeripheralModels({warmShaders:nativeTabCache,screen:bridge.app?.renderer?.previewLease?bridge.app.renderer:null});

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
  const itemDescriptions=screen?.inspectItems?screen.inspectItems(parent,read):createItemDescriptionLayer({container:parent,getSnapshot:read});
  bridge.showItemDescription=itemDescriptions.open;
  const weaponFor = id => snapshot.weapons.find(w => w.id === (typeof id === 'object' ? id?.itemId || id?.id : id));
  // Weapon inventory emblems depict the equipped hardware; model-pool weapon
  // thumbnails depict its projectile and belong to combat attack previews.
  const thumbnail = (id, cls = '') => {
    return img(COMMON_WEAPONS[id] ? weaponIcon(id) : aircraftUiImage(id,'thumbnail'), '', `pl-model-thumb ${COMMON_WEAPONS[id] ? `pl-weapon-emblem pl-weapon-icon-${id.slice(4)}` : ''} ${cls}`);
  };
  const preview=(id,options={})=>aircraftPreview(id,options);
  const referenceContext = () => ({ snapshot, helpers: { escape, number, icon, img, thumbnail, preview, button, asset, researchArt }, workshopKind,gearWorkshop,workshopId, workshopFilter, workshopMode, workshopBackLabel:catalogWorkshopReturn ? '返回武器目录' : '返回装备' });

  const onboarding=createLobbyOnboarding({root,home:()=>homeView||menuView,
    context:()=>({snapshot,tab,subpage,modal,researchSection,shopSection,gearFilter,visible,busy,chapterIndex:battleChapterIndex(snapshot||{},battleChapter)}),
    mark:async(group,uid)=>{const handler=bridge.peripheralAction||system?.action;const result=await handler?.call(system||bridge,'onboardingComplete',{group,uid});render(true);return result;}
  });
  function toast(message) {
    if(isResourceShortage(message))message=shortageToast(message);
    if(bridge.app?.renderer?.toast){bridge.app.renderer.toast.show(message);return;}
    const node = root.querySelector('.pl-toast'); node.classList.remove('is-visible'); node.textContent = message; void node.offsetWidth; node.classList.add('is-visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('is-visible'), 2667);
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
    if (busy) return null; busy = true; root.classList.add('is-busy');
    const growthBefore = hasLobbyGrowthFeedback(action) ? snapshot : null;
    const walletBefore = { ...snapshot.wallet };
    const motionBefore=snapshot,motionMaterials=uiMotion.capture();
    const resourceReturn=action==='shopBuy'?(modal?.type==='stamina'?{...modal,childOpener:captureFocus(modalHost)}:modal?.returnTo?.type==='stamina'?modal.returnTo:null):null;
    const patrolReturn = ['patrol','quickPatrol'].includes(modal?.type)
      ? {...modal,childOpener:captureFocus(modalHost)} : null;
    const materials=action==='synthesizeWeapon'||action==='synthesizeAll'?stateFeedback.captureMaterials():null;
    if (polishedTab()) root.setAttribute('aria-busy','true');
    try {
      let powerBefore=motionBefore.power;
      if(action==='researchDraw'&&motionBefore.replicaCollection&&!Number.isFinite(powerBefore)) {
        powerBefore=await refreshLoadoutPower();
      }
      const handler = bridge.peripheralAction || system?.action;
      const result = handler ? await handler.call(system || bridge, action, payload) : { ok: false, message: '当前功能尚未开放' };
      if(result?.ok&&result.recruitToken)await handler.call(system||bridge,'fleetRecruitSeen',{token:result.recruitToken});
      if (result?.message && !(result.ok && growthBefore)) toast(action==='replicaCollection'&&['skins','pilots'].includes(payload.kind)&&['unlock','star'].includes(payload.action)&&isResourceShortage(result.message)?'道具不足':action==='shopBuy'&&result.message==='商品状态已更新，请重新选择'?'商品已更新':result.message);
      if (result?.ok === false && !result.message) toast('暂时无法进行此操作');
      const committedSnapshot=result?.ok?read():snapshot;
      const feedbackRecords=committedFeedbackRecords({before:motionBefore,after:committedSnapshot,action,payload,result});
      if(result?.ok)result.uiFeedbackRecords=feedbackRecords;
      const rewards = actionRewards(result,motionBefore,committedSnapshot);
      if (result?.ok && action==='claimActivity' && modal?.type==='tasks') delete modal.milestoneId;
      const completedShopOrder=result?.ok&&action==='shopBuy'&&modal?.type==='shopConfirm';
      const rewardParent=rewardReturnModal(modal);
      const rewardReturn=rewardParent?{...rewardParent,childOpener:captureFocus(modalHost),rewardReturnScroll:modalHost.querySelector('.pl-modal-content')?.scrollTop||0}:null;
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
      if(feedbackRecords.length&&['replicaCollection','gearMerge','gearBatch','fleetActivate','fleetStarUp'].includes(action)){
        // Freeze the existing page through the result. The committed state is
        // used by the overlay; source controls refresh only after it closes.
        snapshot=committedSnapshot;signature=patrolRenderSignature(snapshot);pendingModalBackgroundRefresh=true;
      }else render(true);
      if (result?.ok) {
        const credited = actionFeedback.wallet(walletBefore, snapshot.wallet);
        // A receipt already says what arrived; don't stack a second success toast.
        const powerChanged=Number.isFinite(motionBefore.power)&&Number.isFinite(snapshot.power)&&Math.round(motionBefore.power)!==Math.round(snapshot.power);
        if (credited || rewards.length || powerChanged || result.researchResult || result.gearResult?.operation==='supply') { bridge.app?.renderer?.toast?.clear(); clearTimeout(toastTimer); root.querySelector('.pl-toast').classList.remove('is-visible'); }
      }
      if (result?.ok && subpage === 'workshop' && !modal && !root.contains(document.activeElement)) {
        (body.querySelector('.ws-grid .eq-card.is-selected') || body.querySelector('.ws-slot:not(.is-result)'))?.focus({preventScroll:true});
      }
      if (result?.ok) {
        if(!result.researchResult&&Number.isFinite(motionBefore.power)&&Number.isFinite(snapshot.power))actionFeedback.power(motionBefore.power,snapshot.power);
        stateFeedback.complete(action,payload,result,materials,growthBefore,snapshot);
        uiMotion.complete(action,result,motionBefore,snapshot,payload,motionMaterials);
      }
      if (result?.ok===false) actionFeedback.failure();
      if (result?.ok && growthBefore) showLobbyGrowthFeedback(root, growthBefore, snapshot, action, payload);
      onboarding.result(action,payload,result);
      return result;
    } catch (error) { console.error('[peripheral action]', action, error); toast('操作失败，请稍后重试'); actionFeedback.failure(); return { ok: false }; }
    finally {
      busy = false; root.classList.remove('is-busy'); root.removeAttribute('aria-busy');
      const status = root.querySelector('.pl-toast');
      if (status.textContent === '正在处理，请稍候…') status.classList.remove('is-visible');
    }
  }
  async function openShopBox(review, freeOnly = false) {
    const source=['shopBoxConfirm','shopBoxResult'].includes(modal?.type)?modal.returnTo||null:modal;
    const returnTo=source?{...source,childOpener:captureFocus(modalHost),rewardReturnScroll:modalHost.querySelector('.pl-modal-content')?.scrollTop||0,rewardReturnScrollState:captureModalScroll(modalHost)}:null;
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
    clearTimeout(toastTimer);root.querySelector('.pl-toast').classList.remove('is-visible');
    renderModal();return true;
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
  const tabMarkupOptions = () => ({pageKey:subpage?null:tab,...(nativeTabCache?{maxCachedPages:TABS.length-1}:{})});
  function renderHeader() {
    if(usesHomeCanvas()||usesMenuCanvas()){setUiMarkup(header,'');return;}
    const options=nativeTabCache?tabMarkupOptions():undefined;
    if (tab === 'assembly' && !subpage) { setUiMarkup(header,equipmentHeader(referenceContext()),options); return; }
    if (tab === 'battle' && !subpage) { setUiMarkup(header,battleHeader(referenceContext(), snapshot.playerName),options); return; }
    if (tab === 'shop' || tab === 'supply') {
      let markup=shopHeader(referenceContext(), snapshot.playerName, tab === 'shop' ? '商城' : '招募');
      if(tab==='supply'&&fleetSupplyReturn){
        const template=document.createElement('template');template.innerHTML=markup;
        const heading=template.content.querySelector('.lobby-page-heading');
        if(heading)heading.innerHTML=`<button type="button" class="fleet-supply-back" data-action="fleetSupplyBack">← 返回${fleetSupplyReturn.kind==='aircraft'?'战机':'驾驶员'}</button>`;
        markup=template.innerHTML;
      }
      setUiMarkup(header,markup,options);
      return;
    }
    if (tab === 'research') {
      setUiMarkup(header,researchHeader(referenceContext()),options);
      return;
    }
    const title = TABS.find(t => t.id === tab)?.title || '装备';
    setUiMarkup(header,`<strong class="ref-header-title">${title}</strong>${bridge.debugToolsEnabled ? button('debug', '开发', 'pl-debug-entry', 'aria-label="打开开发工具"') : ''}${lobbyResources(referenceContext(), tab === 'assembly' ? 'equipmentShop' : 'shopSection')}`,options);
  }
  let activeNavTab;
  function renderNav() {
    if(usesHomeCanvas()||usesMenuCanvas()){setUiMarkup(nav,'');activeNavTab=null;return;}
    if (activeNavTab===tab) return;
    if (!activeNavTab) setUiMarkup(nav,lobbyNavigation(tab));
    else {
      const previous=nav.querySelector('.is-active');
      previous?.classList.remove('is-active');
      previous?.setAttribute('aria-current','false');
      const current=nav.querySelector(`[data-tab="${tab}"]`);
      current?.classList.add('is-active');
      current?.setAttribute('aria-current','page');
    }
    activeNavTab=tab;
  }

  function pilotRewardsHtml(rewards) {
    const view=cloudNativeRecruitSnapshot(snapshot);
    return pilotRecruitResults(rewards,view.pilots,{number,renderReward:rewardItemHtml,grid:modal?.recruitGrid===true});
  }
  function rewardItemHtml(r,projectAssets=false) {
    const model=rewardItemModel(r,snapshot,projectAssets);
    const {name,type,qualityRank:rank}=model;
    {
      const quality=model,interactive=model.gearUid;
      const artwork=model.icon?icon(model.icon):img(model.image,'',model.artClass);
      const tag=interactive?'button':'div',action=interactive?`type="button" data-action="gearDetail" data-id="${escape(r.gearUid)}" aria-label="${escape([name,qualityDisplayLabel(quality.qualityName,quality.qualityKnown),'查看当前装备'].filter(Boolean).join('，'))}"`:'';
      const slot=rewardItemSlot({...model,artwork},{escape});
      return `<${tag} class="pl-reward-item" data-reward-resource="${escape(type)}" data-reward-rank="${rank}" ${action}>${slot}<b>${escape(name)}</b>${r.receiptStatus?`<small>${escape(r.receiptStatus)}</small>`:''}</${tag}>`;
    }
  }
  function rewardsHtml(rewards,projectAssets=false) {
    return `<div class="pl-rewards-grid">${rewards.map(r=>rewardItemHtml(r,projectAssets)).join('')}</div>`;
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
    if (!restoreFocus(root,opener)) body.querySelector('.ag-catalog [data-action="equipmentWeapons"]')?.focus({preventScroll:true});
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
  function releaseAffectionVideo() {
    if(!renderedModalKey.startsWith('pilotAffectionVideo:'))return;
    const video=modalHost.querySelector('.bc-affection-video');
    if(video)releaseOwnedVideo(video);
  }
  function returnToParentModal() {
    if(!modal?.returnTo)return false;
    const parent=modal.returnTo,opener=parent.childOpener,scroll=parent.rewardReturnScroll,positions=parent.rewardReturnScrollState;delete parent.childOpener;delete parent.rewardReturnScroll;delete parent.rewardReturnScrollState;
    if(['gearDetail','gearSources','gearMergeList'].includes(parent.type))parent.revision=snapshot.equipment.revision;
    modal=parent;renderModal();if(scroll!=null){const content=modalHost.querySelector('.pl-modal-content');if(content)content.scrollTop=scroll;}
    restoreModalScroll(modalHost,positions);
    if(!restoreFocus(modalHost,opener))(modalHost.querySelector('.dc-tab[aria-selected="true"]')||modalHost.querySelector('.pl-close,.bag-close,.chapter-reward-back,[role=dialog][tabindex]'))?.focus({preventScroll:true});return true;
  }
  function renderModal() {
    if(!modal&&!rewardLayer&&!renderedModalKey&&!modalOpener&&!modalHost.firstChild
      &&!pendingModalBackgroundRefresh&&!pendingAwakeningFeedback&&!pendingProcessRecords.length)return;
    if(modal?.type!=='backpack'&&!(isRetainedModalLayer(modal)&&modal?.returnTo?.type==='backpack'))releaseNativeBackpack();
    const receiptParent=modal?.returnTo?.type;
    const nativeParent=(usesHomeCanvas()||usesMenuCanvas())&&(!receiptParent||receiptParent==='backpack'||screen?.lobbyPanelKind?.(receiptParent,snapshot));
    const useReceipt=screen?.openRewardReceipt&&isCommonReward(modal)&&nativeParent;
    const useOpening=screen?.openBoxOpening&&modal?.type==='boxOpening'&&nativeParent;
    const useProcess=screen?.openProcessFeedback&&modal?.type==='processFeedback'&&(nativeParent||receiptParent==='shopBoxResult');
    const useRecruit=screen?.openRecruitResults&&isRecruitResult(modal)&&nativeParent;
    const useTaskTip=screen?.openTaskChestPreview&&modal?.type==='taskChestPreview'&&receiptParent==='tasks'&&(usesHomeCanvas()||usesMenuCanvas());
    const usePatrolReceipt=screen?.openPatrolReceipt&&modal?.type==='rewards'&&modal.patrol&&['patrol','quickPatrol'].includes(receiptParent);
    if(!useReceipt&&!useOpening&&!useProcess&&!useRecruit&&!useTaskTip&&!usePatrolReceipt)releaseNativeReceipt();
    const panelKind=screen?.lobbyPanelKind?.(modal?.type,snapshot);
    const overlayDialog=Boolean(panelKind&&isRetainedModalLayer(modal)&&modal?.returnTo);
    if(nativeOverlayDialog&&(!overlayDialog||nativeOverlayDialog.kind!==panelKind))releaseOverlayDialog();
    if(nativeDialog&&nativeDialog.kind!==panelKind
      &&!(isRetainedModalLayer(modal)&&nativeDialog.kind===screen?.lobbyPanelKind?.(modal?.returnTo?.type,snapshot)))releaseNativeDialog();
    if(modal?.type!=='pilotAffectionVideo')releaseAffectionVideo();
    if(rewardLayer&&!isRetainedModalLayer(modal)){
      stateFeedback.clearResult();
      const previous=rewardLayer;rewardLayer=null;previous.layers.restore();modalHost=modalRoot;
      renderedModalKey=previous.key;renderedModalContent=previous.content;
    }
    if(isRetainedModalLayer(modal)&&!rewardLayer){
      const receipt=modal,parent=receipt.returnTo;
      // Refresh the source in place after its transaction, before making it
      // inert. It remains visible throughout the reward presentation.
      if(parent){modal=parent;renderModal();restoreModalScroll(modalHost,parent.rewardReturnScrollState);modal=receipt;}
      else {
        stateFeedback.clearResult();
        if(!modalOpener)modalOpener=receipt.opener||captureFocus(root);
        modalRoot.replaceChildren();renderedModalKey='';renderedModalContent='';
      }
      rewardLayer={key:renderedModalKey,content:renderedModalContent,layers:mountRewardLayers(modalRoot)};
      modalHost=rewardLayer.layers.overlay;renderedModalKey='';renderedModalContent='';
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
    if(!useReceipt&&!useOpening&&!useProcess&&['processFeedback','boxOpening','shopBoxResult'].includes(modal?.type)&&renderedModalKey===modalKey){processMotion.play(modalHost,modal);return;}
    const stableType = modal && (isCommonReward(modal) || isRecruitResult(modal) || modal.type==='recruitRewards' || COMMAND_PANELS.has(modal.type) || ['chapterDetails','developerDiagnostics','pilotAffection','pilotAffectionVideo','taskChestPreview','chapterRewards','chapterCoreRewards','nativeStarRewards','nativeMaterials','nativeStats','nativeEquipmentBoxes','pilotSupplyTasks','pilotSupplyBoxes','nativeRecruitInfo','playerInfo','formation','chapterChest','patrol','quickPatrol','nativeLab','nativeCollectionDetail','nativeSkillPreview','nativeWeaponPreview','growthSupplyChoice','weapon','weaponSkill','weaponSkillGroup','aircraftInfo','pilotInfo','fleetSkill','fleetOperation','workshopBatch','workshopFilter'].includes(modal.type) || modal.type.startsWith('research') || modal.type.startsWith('gear'));
    if (!stableType || renderedModalKey !== modalKey) stateFeedback.clearResult();
    const focused = captureFocus(modalHost);
    const modalScrollSelector = modal?.type==='weapon' ? '.equipment-weapon-detail__scroll' : ['nativeCollectionDetail','nativeSkillPreview'].includes(modal?.type) ? '.cd-scroll,.pl-modal-content:not(:has(.cd-scroll))' : modal?.type?.startsWith('gear') ? '.ag-modal-scroll,.pl-modal-content:not(:has(.ag-modal-scroll))' : '.pl-modal-content';
    const previousScroll = modalHost.querySelector(modalScrollSelector)?.scrollTop || 0;
    modalHost.querySelectorAll('[data-daily-scroll]').forEach(node=>dailyScrollPositions.set(node.dataset.dailyScroll,node.scrollTop));
    modalHost.querySelectorAll('[data-patrol-scroll]').forEach(node=>patrolScrollPositions.set(node.dataset.patrolScroll,node.scrollTop));
    if (!modal) {
      const restoreModelHost=renderedModalKey.startsWith('patrol:');
      const returnFocus=modalOpener;
      processMotion.clear();
      if(visible&&pendingProcessRecords.length){const records=pendingProcessRecords;pendingProcessRecords=[];showProcessRecords(records);return;}
      uiMotion.modal('');
      // Remove the dialog in its host: reparenting an exit clone loses the
      // host-scoped frame/animation styles and leaves a full-size ghost.
      modalHost.innerHTML = '';
      if(restoreModelHost){
        const preview=body.querySelector('[data-model-aircraft]');
        models.attach(preview || null);
        if(preview)models.showAircraft(preview.dataset.modelAircraft,snapshot);
      }
      [header,body,nav].forEach(el => { el.inert = false; });
      if (polishedTab()) restoreFocus(root, modalOpener);
      modalOpener = null; renderedModalKey = ''; renderedModalContent = '';
      if (pendingModalBackgroundRefresh) {
        pendingModalBackgroundRefresh = false;
        render(true);
        restoreFocus(root,returnFocus);
      }
      if (pendingAwakeningFeedback) {
        const {cardId,powerBefore,powerAfter}=pendingAwakeningFeedback;
        pendingAwakeningFeedback=null;
        if(visible&&tab==='research') {
          if(cardId)stateFeedback.research(cardId);
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
      for(const node of [header,body,nav])node.inert=true;
      renderedModalKey=modalKey;renderedModalContent='';return;
    }
    if(screen?.repaintHome&&panelKind){
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
      for(const node of [header,body,nav])node.inert=true;
      renderedModalKey=modalKey;renderedModalContent='';return;
    }
    if (modal.type === 'backpack') {
      // Preserve the grid and its focus while a live wallet snapshot updates.
      if (modal.bagItem && !backpackItems(snapshot).some(item => item.id === modal.bagItem)) modal.bagItem = null;
      const screen=bridge.app?.renderer;
      if(screen?.repaintHome&&screen.openBackpack){
        nativeBackpack??=screen.openBackpack(modalHost,nativeBagAction);
        nativeBackpack.update(backpackItems(snapshot),snapshot,modal);
        for(const node of [header,body,nav])node.inert=true;
        renderedModalKey=modalKey;renderedModalContent='';
        return;
      }
      const markup = optimizeUiAssetUrls(flattenDisclosureMarkup(backpackDialog(snapshot, modal, referenceContext().helpers)));
      if (renderedModalKey === modalKey && renderedModalContent === markup) return;
      const scroll = modalHost.querySelector('.bag-grid')?.scrollTop ?? 0;
      const detailScroll = modalHost.querySelector('.bag-detail')?.scrollTop ?? 0;
      const wasDetailOpen = Boolean(modalHost.querySelector('.bag-detail'));
      const wasBackpackOpen = renderedModalKey === modalKey;
      modalHost.innerHTML = markup;
      const grid = modalHost.querySelector('.bag-grid');
      grid.scrollTop = modal.bagResetScroll ? 0 : scroll;
      const detail = modalHost.querySelector('.bag-detail');
      if (detail && wasDetailOpen) {
        detail.scrollTop = detailScroll;
      }
      modal.bagResetScroll = false;
      if (wasBackpackOpen) modalHost.querySelector('.bag-modal').style.animation = 'none';
      [header,body,nav].forEach(el => { el.inert = true; });
      const activeDialog = modalHost.querySelector('.bag-detail') || modalHost.querySelector('.bag-modal');
      if (Boolean(modal.bagItem) !== wasDetailOpen || !restoreFocus(activeDialog, focused)) activeDialog.querySelector('.bag-close')?.focus({preventScroll:true});
      renderedModalKey = modalKey; renderedModalContent = markup;
      clearNativeTooltips(root);
      uiMotion.modal(`${modalKey}:${modal.bagItem||''}`);
      return;
    }
    let title = '', content = '';
    const commandPanel = modal.type==='tasks' ? dailyCenter(snapshot,modal,referenceContext().helpers)
      : modal.type==='activities' ? dailyActivities(snapshot,referenceContext().helpers)
      : lobbyCommandPanel(modal.type, snapshot, referenceContext().helpers, modal.period || 'daily');
    const battleSupplement = commandPanel || (tab === 'battle'
      ? modal.type==='chapterChest'&&snapshot.nativeAcquisition
        ? chapterRewardsDialog(snapshot)
        : battleSupplementalModal(modal.type,snapshot,battleChapter)
      : null);
    if(modal.type==='processFeedback'){
      content=processFeedbackDialog(modal,snapshot,referenceContext().helpers);
    }else if(modal.type==='boxOpening'){
      content=boxOpeningDialog(modal,referenceContext().helpers);
    }else if (modal.type==='taskChestPreview') {
      ({title,content}=taskChestPreview(snapshot,modal,referenceContext().helpers));
    } else if (battleSupplement) {
      ({title,content} = battleSupplement);
    } else if (modal.type === 'chapterDetails') {
      ({title,content}=chapterDetails(snapshot,modal.stageIndex,referenceContext().helpers));
    } else if (modal.type === 'pilotAffection' || modal.type === 'pilotAffectionVideo') {
      ({title,content}=pilotAffectionDialog(snapshot,modal.pilotId,referenceContext().helpers,{playing:modal.type==='pilotAffectionVideo'}));
    } else if (modal.type === 'playerInfo') {
      ({title,content}=playerInfoPanel(snapshot,modal,referenceContext().helpers,snapshot.playerName));
    } else if (modal.type === 'recruitRewards') {
      ({title,content}=recruitModal(modal.type,cloudNativeRecruitSnapshot(snapshot),referenceContext().helpers));
    } else if (modal.type === 'shopBoxResult') {
      const result=shopBoxRewards(modal,snapshot);
      title=modal.history?'上次开箱结果':'获得奖励';
      content=rewardsHtml(result.rewards,true)+boxResultActions(modal,snapshot,referenceContext().helpers);
    } else if (modal.type.startsWith('shop')) {
      ({ title, content } = shopModal(modal, snapshot, referenceContext().helpers));
    } else if (modal.type.startsWith('research')) {
      ({ title, content } = researchModal(modal, snapshot, referenceContext().helpers));
    } else if (modal.type === 'developerDiagnostics') {
      title = '诊断日志';
      content = `<div class="pl-developer-panel">
        <button type="button" class="wc-button" data-action="copyDeveloperDiagnostics">复制诊断</button>
        <textarea class="pl-diagnostic-report" aria-label="诊断日志内容" readonly>${escape(modal.report)}</textarea>
        <p class="pl-diagnostic-status" role="status"></p>
      </div>`;
    } else if (modal.type === 'debug') {
      ({ title, content } = developerToolsDialog(snapshot, modal, referenceContext().helpers));
    } else if (modal.type === 'patrol') {
      title = '巡逻收益';
      content = patrolPanel(snapshot, referenceContext().helpers);
    } else if (modal.type === 'quickPatrol') {
      title = '快速巡逻';
      content = quickPatrolPanel(snapshot, referenceContext().helpers);
    } else if (modal.type === 'workshopFilter') {
      ({title,content}=workshopFilterDialog(workshopFilter,workshopKind==='gear'?'gear':workshopMode,snapshot.equipment));
    } else if (modal.type === 'workshopBatch') {
      title = '一键升星'; const plan = modal.plan;
      content = `<article class="ws-batch-confirm"><p>全仓库 ${plan.steps.length} 件武器各升 1 星</p><p>专属碎片 ${number(plan.totalSpecific)} · 通用零件 ${number(plan.totalUniversal)}</p><div class="ref-batch-list">${plan.steps.map(step => `<p>${escape(step.name)}：${step.fromQuality} 星 → ${step.toQuality} 星</p>`).join('')}</div><button type="button" class="wc-button ws-batch-submit" data-action="workshopConfirmBatch">确认升星</button></article>`;
    } else if (modal.type === 'nativeSkillPreview') {
      ({title,content}=cloudNativeSkillPreview(modal.kind,modal.id,snapshot,referenceContext().helpers));
    } else if (modal.type === 'nativeWeaponPreview') {
      ({title,content}=cloudNativeWeaponPreview(modal.id,modal.mode,snapshot,referenceContext().helpers));
    } else if (modal.type === 'nativeCollectionOperation') {
      ({title,content}=cloudNativeCollectionOperation(modal,snapshot,referenceContext().helpers));
    } else if (modal.type === 'aircraftActivation') {
      title='激活成功';
      const row=snapshot.replicaCollection.skins.find(row=>row.id===modal.id);
      content=aircraftActivationDialog(row,modal.receipt,snapshot,referenceContext().helpers);
    } else if (modal.type === 'nativeCollectionDetail') {
      ({title,content}=cloudNativeCollectionDetail(modal.kind,modal.id,snapshot,referenceContext().helpers));
    } else if (modal.type==='nativeStarRewards') {
      ({title,content}=nativeStarRewardsDialog(snapshot));
    } else if (['chapterRewards','chapterCoreRewards'].includes(modal.type)) {
      ({title,content}=chapterRewardsDialog(snapshot));
    } else if (modal.type==='growthSupplyChoice') {
      ({title,content}=growthSupplyDialog(snapshot,modal,referenceContext().helpers));
    } else if (['nativeRecruitInfo','pilotSupplyBoxes','pilotSupplyTasks'].includes(modal.type)) {
      ({title,content}=pilotSupplyPanel(modal.type==='pilotSupplyTasks'?'tasks':'boxes',snapshot,referenceContext().helpers,{period:modal.period}));
    } else if (modal.type === 'nativeStats') {
      ({title,content}=nativeStatsDetail(modal.result,referenceContext().helpers));
    } else if (modal.type === 'nativeEquipmentBoxes') {
      ({title,content}=nativeEquipmentBoxDetail(snapshot,referenceContext().helpers));

    } else if (modal.type === 'nativeLab') {
      ({title,content}=nativeLabDetail(modal.id,snapshot,referenceContext().helpers));
    } else if (modal.type === 'weapon') {
      const w = weaponFor(modal.id); if (!w) { modal = null; renderModal(); return; }
      title = w.name || '武器详情';
      content = equipmentWeaponDetail({snapshot,weapon:w,selectedSlot:modal.requireSlotSelection?modal.targetSlot:modal.targetSlot || selectedSlot,requireSlotSelection:modal.requireSlotSelection,helpers:referenceContext().helpers,readonly:modal.readonly});
    } else if (modal.type === 'weaponSkillGroup') {
      const panel = weaponCatalogGrowthDetail({weapon:weaponFor(modal.id),helpers:referenceContext().helpers});
      if (!panel) { modal = null; renderModal(); return; }
      ({title,content} = panel);
    } else if (modal.type === 'weaponSkill') {
      const panel = weaponCatalogSkillDetail({weapon:weaponFor(modal.id),key:modal.skillKey,helpers:referenceContext().helpers});
      if (!panel) { modal = null; renderModal(); return; }
      ({title,content} = panel);
    } else if (modal.type === 'stages' || modal.type === 'chapters') {
      title = modal.type === 'chapters' ? '航线进度' : '选择关卡';
      content = `<div class="pl-stage-list">${snapshot.stages.map((s, i) => `<button type="button" class="pl-stage-option ${s.index === snapshot.selectedStageIndex ? 'is-selected' : ''}" data-action="stage" data-index="${s.index}" ${s.unlocked === false ? 'disabled' : ''}><div class="pl-stage-art" style="background-image:${escape(chapterPreviewBackground(s.index))}">${s.unlocked === false ? icon('lock') : `<b>${s.index + 1}</b>`}</div><div><strong>${escape(s.name)}</strong><small>第 ${i + 1} 章${snapshot.replicaCollection?"":` · 参考战力 ${number(s.recommendedPower)}`}</small><span class="pl-mini-stars">${[1, 2, 3].map(n => `<span class="${(s.stars || 0) >= n ? 'is-earned' : ''}">${icon('star')}</span>`).join('')}</span></div>${icon('arrow')}</button>`).join('')}</div>`;
    } else if (modal.type === 'formation') {
      title = '出战阵容'; content = formationPanel(snapshot,referenceContext().helpers);
    } else if (modal.type === 'rewards') { title = modal.title || '获得奖励'; content = modal.patrol ? patrolRewardsPanel(modal.rewards,referenceContext().helpers) : `${modal.recruit ? pilotRewardsHtml(modal.rewards) : rewardsHtml(modal.rewards,isCommonReward(modal))}${isRecruitResult(modal)||isCommonReward(modal) ? '' : button('close', '收下奖励', 'pl-primary pl-wide')}`; }
    else if (modal.type.startsWith('gear')) { const view=gearModal(modal,referenceContext());title=view.title;content=view.content; }
    else if (modal.type === 'pilotInfo') {
      const p = snapshot.pilots.find(p => p.id === modal.id);
      title = p?.name || '驾驶员';
      content = `<div class="pl-pilot-card-detail">${pilotHoloCard(p, {interactive: true, status:p?.temporaryUnlocked?'试玩':p?.owned?'已激活':p?.copies?'待激活':'未激活'})}</div>${fleetPilotDetail({pilot:p,snapshot,helpers:referenceContext().helpers})}`;
    }
    else if (modal.type === 'stamina') { const view=shopModal({type:'shopStamina'},snapshot,referenceContext().helpers);title=view.title;content=view.content; }
    else if(modal.type==='fleetSkill'){
      const preview=fleetSkillPreview({kind:modal.kind,item:fleetItem(modal.kind,modal.id),helpers:referenceContext().helpers});
      title=preview?.title||'技能预览';content=preview?.content||'';
    }
    else if(modal.type==='fleetOperation'){
      const view=fleetOperationModal({kind:modal.kind,item:fleetItem(modal.kind,modal.id),snapshot,operation:modal.operation,result:modal.result,error:modal.error,helpers:referenceContext().helpers});
      title=view.title;content=view.content;
    }
    else if (modal.type === 'aircraftInfo') { const a = snapshot.aircraft.find(a => a.id === modal.id); title = a?.aircraftName || a?.aircraft || a?.name || '战机'; content = fleetAircraftDetail({aircraft:a,snapshot,helpers:referenceContext().helpers}); }
    if(snapshot.nativeEconomyPending&&['tasks','activities','patrol','quickPatrol'].includes(modal.type)) {
      const template=document.createElement('template');template.innerHTML=content;
      for(const node of template.content.querySelectorAll('[data-action]'))if(isNativeEconomyActionPending(node.dataset.action)&&!(snapshot.flightRewards&&node.dataset.action==='claimSignIn')) {
        node.disabled=true;node.setAttribute('aria-label',['patrol','quickPatrol'].includes(modal.type)?(!snapshot.patrol.unlocked?snapshot.patrol.lockReason:snapshot.patrol.settlementReason):NATIVE_PENDING_ECONOMY_MESSAGE);
      }
      content=template.innerHTML;
    }
    if(snapshot.rewardPending||snapshot.rewardBusy) {
      const template=document.createElement('template');template.innerHTML=content;
      const actions=new Set(['claimSignIn','claimTask','claimActivity','claimAchievement','claimStarReward',
        'flightReward','pilotSupply','growthSupplyOpen','growthSupplyClaim','nativeChapterReward','nativeChapterCoreReward','nativeComposePilotBox','shopOffer','shopConfirm','shopBoxOpen','shopRefreshPreview',
        'shopClaimBoxReward','claimPatrol','quickPatrol','quickPatrolAd','devPatrolSample']);
      for(const node of template.content.querySelectorAll('[data-action]'))if(actions.has(node.dataset.action)) {
        node.disabled=true;node.setAttribute('aria-description',snapshot.rewardPending?'已有奖励待保存，请先重试保存':'奖励正在处理，请稍候');
      }
      if(!template.content.querySelector('[data-action="recoverDailyRewards"]')) {
        const notice=document.createElement('div');notice.className='dc-pending';notice.setAttribute('role','status');
        notice.innerHTML=snapshot.rewardPending?'<span>已有奖励待保存</span><button type="button" class="wc-button" data-action="recoverDailyRewards">重试保存</button>':'<span>奖励正在处理，请稍候</span>';
        template.content.prepend(notice);
      }
      for(const node of template.content.querySelectorAll('[data-action="recoverDailyRewards"]'))node.disabled=Boolean(snapshot.rewardBusy);
      content=template.innerHTML;
    }
    if(snapshot.pilotSupply&&modal.type==='activities')content=`<div class="pilot-supply-shortcuts"><button class="wc-button" data-action="pilotSupplyBoxes">积分兑换</button></div>`+content;
    content=optimizeUiAssetUrls(flattenDisclosureMarkup(content));
    const chapterRewardPage = ['chapterRewards','chapterCoreRewards'].includes(modal.type)
      || (modal.type==='chapterChest'&&Boolean(snapshot.nativeAcquisition));
    const chapterRewardResources = chapterRewardPage ? lobbyResources(referenceContext()) : '';
    const existingStableModal = stableType
      && renderedModalKey === modalKey && modalHost.querySelector(modal.type==='weapon'?'.pl-modal[data-detail-layout="equipment-reference-psd"]':'.pl-modal, .bc-affection-player');
    if (existingStableModal) {
      const heading=existingStableModal.querySelector('#lobby-modal-title');
      if(heading)heading.textContent=title;
      const resources=existingStableModal.querySelector('.chapter-reward-page-resources');
      if(resources)setUiMarkup(resources,chapterRewardResources);
      // Do not replay entry animations, reset focus or reload art on polling.
      if (renderedModalContent === content) {
        if(modal.type==='taskChestPreview')positionTaskChestPreview(modalHost,modalRoot,modal);
        if (modal.type === 'patrol') models.showAircraft(snapshot.aircraftId, snapshot);
        return;
      }
      stateFeedback.clearResult();
      const patrolScene = modal.type === 'patrol' && existingStableModal.querySelector('.pt-scene');
      if (patrolScene) {
        // Reward/time polling must not restart the scrolling sky or detach the aircraft.
        const next = document.createElement('template'); next.innerHTML = content;
        const nextScene = next.content.querySelector('.pt-scene');
        const nextPanel=next.content.querySelector('.pt-panel'), currentPanel=existingStableModal.querySelector('.pt-panel');
        currentPanel.className=nextPanel.className;currentPanel.dataset.patrolState=nextPanel.dataset.patrolState;
        patrolScene.querySelector('.pt-route').textContent = nextScene.querySelector('.pt-route').textContent;
        const currentAircraft=patrolScene.querySelector('[data-model-aircraft]'), nextAircraft=nextScene.querySelector('[data-model-aircraft]');
        currentAircraft.dataset.modelAircraft=nextAircraft.dataset.modelAircraft;currentAircraft.setAttribute('aria-label',nextAircraft.getAttribute('aria-label'));
        const currentStill=patrolScene.querySelector('.pt-aircraft-still'),nextStill=nextScene.querySelector('.pt-aircraft-still');
        if(currentStill&&nextStill)currentStill.src=nextStill.src;
        nextScene.remove();
        const scroll = patrolScene.parentElement;
        for (const child of [...scroll.children]) if (child !== patrolScene) child.remove();
        scroll.append(...next.content.querySelector('.pt-scroll').children);
        existingStableModal.querySelector('.pt-footer').replaceWith(next.content.querySelector('.pt-footer'));
      } else {
        const host=existingStableModal.querySelector('.pl-modal-content');
        if(!previewWeapon||!updateWeaponShowcase(host,content)){releaseAffectionVideo();host.innerHTML=content;}
      }
    } else if (modal.type === 'pilotAffectionVideo') {
      modalHost.innerHTML=`<section class="bc-affection-player" data-modal-type="pilotAffectionVideo" role="dialog" aria-modal="true" aria-label="${escape(title)}"><div class="pl-modal-content">${content}</div><button type="button" class="pl-close bc-affection-player-close" data-action="close" aria-label="关闭视频"></button></section>`;
    } else if (chapterRewardPage) {
      modalHost.innerHTML=`<section class="pl-modal chapter-reward-page" data-modal-type="${escape(modal.type)}" role="region" aria-labelledby="lobby-modal-title" tabindex="-1"><header class="chapter-reward-page-header"><h2 id="lobby-modal-title">${escape(title)}</h2><div class="chapter-reward-page-resources">${chapterRewardResources}</div></header><div class="pl-modal-content">${content}</div><footer class="chapter-reward-page-bottom"><button type="button" class="subpage-back chapter-reward-back" data-action="close" aria-label="返回"></button></footer></section>`;
    } else if (['processFeedback','boxOpening'].includes(modal.type)) {
      modalHost.innerHTML=content;
    } else if (modal.type==='aircraftActivation') {
      modalHost.innerHTML=content;
    } else if (modal.type==='taskChestPreview') {
      modalHost.innerHTML=taskChestPreviewDialog(content);
    } else if (isRecruitResult(modal)) {
      modalHost.innerHTML = recruitResultsDialog({title,content,count:modal.rewards.length,pilot:modal.recruitGrid===true},referenceContext().helpers);
    } else if (isCommonReward(modal)) {
      modalHost.innerHTML = commonRewardsDialog({title,content},referenceContext().helpers);
      if(modal.type==='shopBoxResult'&&!modal.history){modalHost.querySelector('.common-reward-dialog')?.classList.add('pf-box-result');}
    } else if (modal.type==='recruitRewards') {
      modalHost.innerHTML = recruitRewardsDialog({title,content},referenceContext().helpers);
    } else if (modal.type==='weapon') {
      modalHost.innerHTML = equipmentWeaponDialog({title,content,quality:modal.type==='weapon'?weaponFor(modal.id)?.qualityRank:snapshot.replicaCollection.guns.find(row=>row.id===Number(modal.id))?.star},referenceContext().helpers);
    } else {
      const paper = PAPER_MODAL_TYPES.has(modal.type);
      modalHost.innerHTML = `<div class="pl-modal-backdrop ${paper ? 'lobby-paper-backdrop' : ''}" data-action="dismiss"><section class="pl-modal ${paper ? 'lobby-paper-modal' : ''} ${COMMAND_PANELS.has(modal.type) ? 'lc-modal' : ''} ${modal.type === 'weapon' ? 'weapon-detail-modal' : (modal.type === 'weaponSkill' || modal.type === 'weaponSkillGroup' || modal.type === 'nativeWeaponPreview') ? 'weapon-skill-modal' : ''}" data-psd-popup="${popupLevel(modal.type==='nativeCollectionDetail'?(modal.kind==='skins'?'aircraftInfo':'pilotInfo'):modal.type==='nativeWeaponPreview'?'weaponSkillGroup':modal.type)}" data-modal-type="${escape(modal.type)}" data-modal-kind="${escape(modal.type)}" role="dialog" aria-modal="true" aria-labelledby="lobby-modal-title" tabindex="-1"><div class="pl-modal-heading"><h2 id="lobby-modal-title">${escape(title)}</h2><button type="button" class="pl-close" data-action="close" aria-label="关闭">${icon('close')}</button></div><div class="pl-modal-content">${content}</div></section></div>`;
    }
    if(modal.type==='pilotAffectionVideo')mountPilotVideoControls(modalHost);
    dockGearActions(modalHost);
    if(modal.type==='taskChestPreview')positionTaskChestPreview(modalHost,modalRoot,modal);
    if(rewardLayer)labelRewardLayer(modalHost);
    const patrolAircraftHost = modalHost.querySelector('[data-model-view="patrol"]');
    if (patrolAircraftHost) { models.attach(patrolAircraftHost); models.showAircraft(patrolAircraftHost.dataset.modelAircraft, snapshot); }
    renderedModalContent = content;
    if(modal.type==='recruitRewards' && renderedModalKey!==modalKey) modalHost.querySelector('.pl-modal-content').scrollTop=modal.scroll||0;
    if(modal.type==='nativeStarRewards' && renderedModalKey!==modalKey){
      const scroller=modalHost.querySelector('.pl-modal-content'),next=modalHost.querySelector('[data-star-next]');
      if(scroller&&next)scroller.scrollTop=Math.max(0,next.getBoundingClientRect().top-scroller.getBoundingClientRect().top-60);
    }
    const closeButton = modalHost.querySelector('.pl-close');
    if (closeButton) closeButton.disabled = modal.type === 'quickPatrol' && Boolean(snapshot.patrol?.adBusy);
    modalHost.querySelectorAll('[data-daily-scroll]').forEach(node=>{node.scrollTop=dailyScrollPositions.get(node.dataset.dailyScroll)||0;});
    modalHost.querySelectorAll('[data-patrol-scroll]').forEach(node=>{node.scrollTop=patrolScrollPositions.get(node.dataset.patrolScroll)||0;});
    if (polishedTab()) {
      [header,body,nav].forEach(el => { el.inert = true; });
      if (renderedModalKey === modalKey) {const scroller=modalHost.querySelector(modalScrollSelector);if(scroller)scroller.scrollTop=previousScroll;}
      if (renderedModalKey !== modalKey || !restoreFocus(modalHost, focused)) modalHost.querySelector('.pl-close,.chapter-reward-back,.common-reward-dismiss,.task-chest-popover,.pf-dismiss,.pf-submit button,.pf-skip')?.focus({preventScroll:true});
    }
    renderedModalKey = modalKey;
    processMotion.play(modalHost,modal);
    clearNativeTooltips(root);
    stateFeedback.ready();
    stateFeedback.progressionFeedback(snapshot);
    if (modal.type === 'researchResult' || modal.type === 'rewards' || modal.type === 'shopBoxResult') stateFeedback.result(modal, snapshot);
    uiMotion.modal(modalKey);
  }
  const stateFeedback = createLobbyStateFeedback(root,key=>bridge.playUiFeedback?.(key));
  const processMotion=createProcessFeedbackMotion(root,{sound:key=>bridge.playUiFeedback?.(key),finishBox:finishBoxPresentation});
  let pendingAwakeningFeedback = null;
  let pendingScrollRender = false;
  function cachedMainPage(key, variant, build) {
    if (!nativeTabCache) return build();
    if (markupSnapshot!==snapshot) { pageMarkup.clear(); markupSnapshot=snapshot; }
    const saved=pageMarkup.get(key);
    if(saved?.variant===variant) return saved.markup;
    const markup=build();
    pageMarkup.set(key,{variant,markup});
    return markup;
  }
  function render(force = false, currentSnapshot = null) {
    return performanceMonitor.measure('ui-render',()=>renderContent(force,currentSnapshot));
  }
  function renderContent(force = false, currentSnapshot = null) {
    // Keep the live scrollport and its captured pointer through drag/inertia.
    if (root.querySelector('.drag-scroll-active')) { pendingScrollRender ||= force; return; }
    force ||= pendingScrollRender; pendingScrollRender = false;
    if (destroyed) return;
    const next = currentSnapshot || read();
    if(tab==='battle'&&!subpage)bridge.app?.renderer?.publishHome?.(next,battleChapterIndex(next,battleChapter),bridge.debugToolsEnabled);
    // Switching tabs reuses the current data; skip serializing the whole economy.
    const nextSignature=next===snapshot ? signature : patrolRenderSignature(next);
    if(!busy&&snapshot&&snapshot!==next)pendingProcessRecords.push(...collectionFeedbackRecords(snapshot,next,{stars:false}),...progressionFeedbackRecords(snapshot,next));
    refreshPatrolClocks(root,next);nativeDialog?.clock?.(next.patrol);
    if (!force && nextSignature === signature) { snapshot=next;if(visible&&!modal&&pendingProcessRecords.length){const records=pendingProcessRecords;pendingProcessRecords=[];showProcessRecords(records);}return; }
    if(isRetainedModalLayer(modal)&&rewardLayer){
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
    // The bottom navigation is never replaced; it keeps its own focus.
    const activeControl=document.activeElement;
    const previousFocus = polishedTab() && !modal && !nav.contains(activeControl) ? captureFocus(root,activeControl) : null;
    pendingModalBackgroundRefresh = false;
    signature = nextSignature; snapshot = next;
    const oldScroll = body.scrollTop, oldShopScroll = body.querySelector('.shop-scroll')?.scrollTop || 0;
    const previousEquipment = body.querySelector('.eq-inventory');
    if (previousEquipment && pendingEquipmentScroll===null) equipmentScroll = previousEquipment.scrollTop;
    const previousCatalogScroll = body.querySelector('[data-catalog-scroll]');
    if (previousCatalogScroll) catalogScrollPositions.set(previousCatalogScroll.dataset.catalogScroll,previousCatalogScroll.scrollTop);
    const previousResearch = body.querySelector('.research-scroll');
    if (previousResearch) researchScrollPositions[body.querySelector('.native-lab-page')?'lab':'talent'] = previousResearch.scrollTop;
    const previousWorkshop = body.querySelector('[data-workshop-scroll]');
    if (previousWorkshop) workshopScrollPositions.set(previousWorkshop.dataset.workshopScroll,previousWorkshop.scrollTop);
    const oldRecruitScroll=body.querySelector('.rc-preview-strip')?.scrollLeft||0;
    const recruitBrowse = body.querySelector('.rc-browse');
    if (recruitBrowse) recruitScroll = recruitBrowse.scrollTop;
    // Each remodeled landing page opts in; catalogs and untouched tabs retain their UI.
    root.classList.add('reference-layout', 'lobby-theme');
    root.classList.toggle('peripheral-quality', polishedTab());
    root.classList.toggle('equipment-comic', tab === 'assembly' && !subpage);
    root.classList.toggle('equipment-reference', tab === 'assembly' && !subpage);
    root.classList.toggle('battle-psd-main', tab === 'battle' && !subpage);
    const nativeHome=usesHomeCanvas(),nativeMenu=usesMenuCanvas();
    root.classList.toggle('three-menu-active',Boolean(nativeMenu));
    if(!nativeMenu&&menuView){menuView.close();menuView=null;}
    root.classList.toggle('three-home-active',nativeHome);
    if(!nativeHome&&homeView){homeView.close();homeView=null;}
    renderHeader(); renderNav(); root.dataset.tab = tab; root.dataset.subpage = subpage;
    if(tab==='research'&&researchSection==='lab'&&researchUnlockMessage(snapshot.replicaCampaign))researchSection='talent';
    const ctx = referenceContext();
    setUiMarkup(resourceHost,subpage&&!nativeMenu ? lobbyResources(ctx, tab === 'assembly' ? 'equipmentShop' : tab === 'research' ? 'researchShop' : 'shopSection') : '');
    const bodyChanged=setUiMarkup(body, nativeMenu ? '<section class="three-menu-viewport" data-three-menu aria-label="功能页"></section>' : ['weapon','aircraft','pilot'].includes(subpage)
      ? cloudNativeCatalog({ ...ctx, kind:subpage, selectedId:subpage==='weapon'?selectedWeapon:subpage==='aircraft'?browseAircraft:browsePilot, skillTab:catalogSkillTab, selectedSkillSlot:subpage==='weapon'?weaponSkillSlot:undefined, filter:catalogFilter, ...(fleetUi[subpage]||{}) })
      : subpage === 'workshop' ? workshopReferencePage(ctx)
      : nativeHome ? '<section class="bc-page psd-main-page" data-three-home-viewport aria-label="主界面"></section>'
      : tab === 'battle' ? battlePage(ctx,battleChapter)
      : tab === 'assembly' ? cachedMainPage('assembly',gearSort+':'+gearFilter,()=>equipmentPage(ctx,{gearSort,gearFilter}))
      : tab === 'shop' ? cachedMainPage('shop','boxes',()=>shopPage(ctx,nativeTabCache?'boxes':shopSection,{decorations:!nativeTabCache}))
      : tab === 'research' ? (researchSection==='lab'?nativeLabPage(ctx):researchPage(ctx))
      : cloudNativeRecruit({...ctx,selected:selectedRecruitPilot}),tabMarkupOptions());
    if(nativeMenu){
      const page=body.firstElementChild;
      if(menuView?.page!==page){
        menuView?.close();
        menuView=screen.mountMenu(page,(action,data,opener)=>runLobbyCommand(action,data,opener),()=>visible&&!busy&&!modal,
          section=>{shopSection=section;});
      }
      const catalog=subpage?{id:subpage==='weapon'?selectedWeapon:subpage==='aircraft'?browseAircraft:browsePilot,skillTab:catalogSkillTab,
        selectedSkillSlot:subpage==='weapon'?weaponSkillSlot:undefined,...(fleetUi[subpage]||{})}:null;
      const workshop=subpage==='workshop'?{kind:workshopKind,id:workshopId,filter:workshopFilter,mode:workshopMode,draft:gearWorkshop,backLabel:ctx.workshopBackLabel}:null;
      menuView.update({tab:subpage||tab,snapshot,catalog,workshop,section:researchSection,shopSection,selected:selectedRecruitPilot,
        gearSort,gearFilter,fleetReturnKind:fleetSupplyReturn?.kind,time:bridge.getPeripheralClock?.()?.time},signature);
    }
    let pilotChanged=Boolean(nativeMenu&&menuView?.portraitChanged());
    if(nativeHome){
      const page=body.firstElementChild;
      if(homeView?.page!==page){
        homeView?.close();
        homeView=screen.mountHome(page,(action,data,opener)=>runLobbyCommand(action,data,opener),()=>visible&&!busy&&!modal);
        pilotChanged=true;
      }else pilotChanged=homeView.selectPilot(snapshot.pilotId);
    }
    portraitPlayer.setVisible(visible&&!modal);
    if((bodyChanged||pilotChanged)&&portraitsEnabled)portraitPlayer.sync(body);
    body.scrollTop = oldScroll; renderModal();
    if(pendingEquipmentScroll!==null){equipmentScroll=pendingEquipmentScroll;pendingEquipmentScroll=null;}
    const equipmentScroller = body.querySelector('.eq-inventory');
    if (equipmentScroller) equipmentScroller.scrollTop = equipmentScroll;
    const catalogScroller = body.querySelector('[data-catalog-scroll]');
    if (catalogScroller) catalogScroller.scrollTop = catalogScrollPositions.get(catalogScroller.dataset.catalogScroll) || 0;
    const researchScroller = body.querySelector('.research-scroll');
    if (researchScroller) researchScroller.scrollTop = researchScrollPositions[researchSection];
    const workshopScroller = body.querySelector('[data-workshop-scroll]');
    if (workshopScroller) {
      workshopScroller.scrollTop = workshopScrollPositions.get(workshopScroller.dataset.workshopScroll) || 0;
      if (workshopRevealSelection) {
        workshopRevealSelection=false;
        const selected=workshopScroller.querySelector('.eq-card.is-selected');
        if(selected){const card=selected.getBoundingClientRect(),viewport=workshopScroller.getBoundingClientRect();if(card.top<viewport.top)workshopScroller.scrollTop+=card.top-viewport.top;else if(card.bottom>viewport.bottom)workshopScroller.scrollTop+=card.bottom-viewport.bottom;}
      }
    }
    const recruitScroller=body.querySelector('.rc-preview-strip');
    if(recruitScroller){recruitScroller.scrollLeft=oldRecruitScroll;attachRecruitStripDrag(recruitScroller);}
    const nextRecruitBrowse = body.querySelector('.rc-browse');
    if (nextRecruitBrowse) nextRecruitBrowse.scrollTop = recruitScroll;
    const shopScroll = body.querySelector('.shop-scroll');
    if(shopScroll){
      syncShopSection(shopScroll);
      if(currentSnapshot)refreshShopClocks(body,snapshot,bridge.getPeripheralClock?.()?.time);
    }
    if (shopScroll && bodyChanged && !initializedShopScrollports.has(shopScroll)) {
      initializedShopScrollports.add(shopScroll);
      shopScroll.scrollTop = oldShopScroll;
      shopScroll.addEventListener('scroll', () => {
        const sections = [...shopScroll.querySelectorAll('[data-shop-section]')];
        const atEnd = shopScroll.scrollHeight > shopScroll.clientHeight + 2 && shopScroll.scrollTop + shopScroll.clientHeight >= shopScroll.scrollHeight - 2;
        shopSection = shopSectionId((atEnd ? sections.at(-1) : sections.filter(section => section.offsetTop <= shopScroll.scrollTop + 24).at(-1))?.dataset.shopSection);
        syncShopSection(shopScroll);
      }, {passive:true});
    }
    const host = modalHost.querySelector('[data-model-view="patrol"]') || body.querySelector('[data-model-aircraft]');
    models.attach(host || null);
    if (host) models.showAircraft(host.dataset.modelAircraft, snapshot);
    if (!modal && polishedTab()) restoreFocus(root, previousFocus);
    clearNativeTooltips(root);
    stateFeedback.counters(snapshot);
    stateFeedback.progressionFeedback(snapshot);
    uiMotion.page(`${tab}:${subpage}:${catalogSkillTab}:${workshopMode}:${gearFilter}`,body);
  }
  function syncShopSection(scroller) {
    const page=scroller.closest('[data-shop-active]');
    const section=shopSection==='stamina'?'coins':shopSection;
    if(!page||page.dataset.shopActive===section)return;
    page.dataset.shopActive=section;
    for(const button of page.querySelectorAll('.store-category')){
      const active=button.dataset.section===section;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-current',String(active));
    }
  }
  function scrollShopSection(value) {
    shopSection = shopSectionId(value);
    if(menuView&&tab==='shop'){menuView.section(shopSection);return;}
    const scroller = body.querySelector('.shop-scroll');
    const section = scroller?.querySelector(`[data-shop-section="${shopSection === 'stamina' ? 'coins' : shopSection}"]`);
    if (section) {
      syncShopSection(scroller);
      // The native shop's first section starts at the top unless there is a
      // notice above it. Reading its offset here forces layout during the tap.
      scroller.scrollTop=nativeTabCache&&!section.previousElementSibling ? 0 : section.offsetTop;
    }
  }
  function switchTab(value, requestedShopSection) {
    const previousTab = tab, previousSubpage = subpage;
    if (value === 'missions') { modal = {type:'tasks',period:'daily'}; renderModal(); return; }
    if (value === 'loadout') { openCatalog('pilot'); return; }
    if (value === 'upgrade') { openGearWorkshop(); return; }
    if (!TABS.some(t => t.id === value && !t.locked)) return;
    if(value===tab&&!subpage&&!modal&&(value!=='shop'||requestedShopSection===undefined||shopSectionId(requestedShopSection)===shopSection))return;
    if (value === 'shop') {
      if (requestedShopSection !== undefined) shopSection = shopSectionId(requestedShopSection);
      else if (tab !== 'shop') shopSection = 'boxes';
    }
    tabScroll[tab] = body.scrollTop; tab = value; modal = null; browseAircraft = null;
    subpage = ''; catalogSkillTab = false; catalogWorkshopReturn = null;
    if(previousTab==='battle'&&value!=='battle')onboarding.hideWeakHint();
    // Navigation changes presentation only. Actions and the regular refresh
    // own state reads; do not rebuild the full economic snapshot on every tap.
    bridge.switchLobbyTab?.(value); render(true,snapshot); body.scrollTop = tabScroll[value] || 0;
    if (value === 'shop') scrollShopSection(shopSection);
    if (value==='assembly' && previousSubpage) { focusEquipmentSource(equipmentReturnFocus); equipmentReturnFocus=null; }
    if(previousTab !== tab) stateFeedback.selection('.lobby-nav-tab.is-active .lobby-nav-icon');
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
    (body.querySelector('.fc-hero-actions button:not(:disabled)')||body.querySelector('.fc-item[aria-pressed="true"]')||body.querySelector('.wc-back'))?.focus({preventScroll:true});
    return true;
  }
  function openGearWorkshop(id=null,opener=document.activeElement){
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
    if(fleetUi[kind])Object.assign(fleetUi[kind],{selectedSkillSlot:null,pendingSkillId:null,selectedSkillId:null});
    if (kind === 'aircraft') browseAircraft = snapshot.aircraftId;
    if (kind === 'pilot') browsePilot = snapshot.pilotId;
    if (kind === 'weapon') selectedWeapon ||= weaponFor(snapshot.loadout[selectedSlot])?.id || snapshot.weapons.find(w=>w.owned)?.id;
    render(true); body.scrollTop = 0;
  }
  function openGrowthSupply(period,target) {
    const view=snapshot.pilotSupply?.growth?.[period];if(!view)return;
    modal={type:'growthSupplyChoice',period,opener:captureFocus(root,target),...(modal?{returnTo:{...modal}}:{})};renderModal();
  }
  function updateBagQuantity() {
    const input=modalHost.querySelector('[data-bag-quantity]');
    if(!input)return;
    const count=Number(input.value),max=Number(input.max),valid=input.validity.valid&&isItemUseBatchCount(count)&&count<=max;
    const blocked=snapshot.rewardPending||snapshot.rewardBusy;
    modalHost.querySelector('[data-bag-use-selected]').disabled=blocked||!valid;
    modalHost.querySelectorAll('[data-action="bagQuantity"]').forEach(node=>{
      node.disabled=blocked||max<1||valid&&(node.dataset.max?count===max:Number(node.dataset.step)<0?count<=1:count>=max);
    });
    modalHost.querySelector('[data-bag-quantity-hint]').textContent=valid?'':`请输入 1～${max} 的整数`;
  }
  root.addEventListener('input', event => {
    if(modal?.type==='backpack'&&event.target.matches('[data-bag-quantity]')&&!busy){
      modal.bagCount=event.target.value;updateBagQuantity();return;
    }
    if (modal?.type==='playerInfo' && event.target.matches('[data-player-name]')) modal.nameDraft=event.target.value;
  });
  root.addEventListener('pointerdown', event => {
    const select=event.target.closest?.('[data-gear-select]');
    if(select){gearSelectInput='pointer';select.dataset.gearInput=gearSelectInput;}
  });
  root.addEventListener('focusin', event => {
    const select=event.target.closest?.('[data-gear-select]');
    if(select)select.dataset.gearInput=gearSelectInput;
  });
  root.addEventListener('change', event => {

    if(modal?.type==='backpack'&&event.target.matches('[data-bag-choice]')&&!busy){
      modal.bagChoice=Number(event.target.value);return;
    }
    const gearSelect=event.target.closest('[data-gear-select]');
    if(gearSelect&&tab==='assembly'&&!subpage&&!busy){
      if(gearSelect.dataset.gearSelect==='sort'&&['quality','part','level'].includes(gearSelect.value))gearSort=gearSelect.value;
      else if(gearSelect.dataset.gearSelect==='filter'&&['all','1','2','3','4','5'].includes(gearSelect.value))gearFilter=gearSelect.value;
      else return;
      equipmentScroll=0;pendingEquipmentScroll=0;render(true);
      body.querySelector(`[data-gear-select="${gearSelect.dataset.gearSelect}"]`)?.focus({preventScroll:true});return;
    }
  });
  const actionFeedback = createActionFeedback(root);
  root.addEventListener('click', async event => {
    const target = event.target.closest('[data-action]'); if (!target || !root.contains(target) || target.disabled || busy) return;
    if(target.dataset.resourceShort){event.preventDefault();if(!snapshot.rewardPending&&!snapshot.rewardBusy)toast(shortageToast(target.dataset.resourceShort));return;}
    actionFeedback.capture(target);
    await runLobbyCommand(target.dataset.action,target.dataset,target,event.target===target);
  });
  async function runLobbyCommand(action,data,target,direct=true){
    if(busy||!visible||isHiddenPilotAffectionAction(action))return;
    if(data.resourceShort){if(!snapshot.rewardPending&&!snapshot.rewardBusy)toast(shortageToast(data.resourceShort));return;}
    if(action==='inspect'){itemDescriptions.open(data,target);return;}
    if(action==='gearSort'&&['quality','part','level'].includes(data.value)){gearSort=data.value;render(true);return;}
    if(action!=='dismiss')bridge.playUiClick?.();
    const id=data.id;
    if(action==='researchSection'){
      if(tab!=='research'||subpage||!['talent','lab'].includes(data.section))return;
      const lock=data.section==='lab'&&researchUnlockMessage(snapshot.replicaCampaign);
      if(lock){toast(lock);return;}
      researchSection=data.section;modal=null;render(true);
      body.querySelector(`[data-action="researchSection"][data-section="${researchSection}"]`)?.focus({preventScroll:true});return;
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
      modal.period=data.period;renderModal();const scroll=modalHost.querySelector('.pl-modal-content');if(scroll)scroll.scrollTop=0;return;
    }
    if(action==='flightReward'){await act('flightReward',{action:data.operation,revision:Number(data.revision)});return;}
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
      render(true);if(previousSlot>=0)body.querySelector(`.wg-skill-slot[data-slot="${previousSlot}"]`)?.focus({preventScroll:true});return;
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
      if(state&&row?.owned&&row.stage.skills.length){state.selectedSkillId=String(row.id);render(true);body.querySelector(`.pcs-choice[data-id="${row.id}"]`)?.focus({preventScroll:true});}return;
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
      const select = modalHost.querySelector('[data-native-lab-level]');
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
        body.querySelector(`.fc-skill-group [data-slot="${slot}"]`)?.focus({preventScroll:true});
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
      if(action==='bagQuantity'){
        const input=modalHost.querySelector('[data-bag-quantity]');if(!input||input.disabled)return;
        const max=Number(input.max),current=Number(input.value);
        if(max<1)return;
        const count=data.max?max:Math.max(1,Math.min(max,(isItemUseBatchCount(current)?current:1)+Number(data.step)));
        modal.bagCount=String(count);input.value=String(count);updateBagQuantity();return;
      }
      if(action==='bagUse') {
        const item=backpackItems(snapshot).find(row=>row.id===modal.bagItem);
        if(!item||item.nativeId!==Number(id))return;
        const targetId=Number(modalHost.querySelector('[data-bag-choice]')?.value);
        const input=modalHost.querySelector('[data-bag-quantity]'),selected=target.hasAttribute('data-bag-use-selected');
        if(selected&&(!input||!input.validity.valid||!isItemUseBatchCount(Number(input.value)))){toast('请输入有效的使用数量');return;}
        const count=selected?Number(input.value):Number(data.count);
        await useBackpackItem(item,count,targetId,data.useOperation,Number(data.revision),Number(data.gearRevision));
        return;
      }
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
        else if(kind==='supplyTasks')modal={type:'tasks',period:'daily',returnTo:origin};
        else if(kind==='signin')modal={type:'tasks',period:'signin',returnTo:origin};
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
        modalHost.querySelector(`.bag-tab[data-tab="${modal.bagTab}"]`)?.focus({preventScroll:true}); return;
      }
      return;
    }
    if (action === 'debug' && bridge.debugToolsEnabled) { modal = { type: 'debug' }; renderModal(); return; }
    if (action === 'copyDeveloperDiagnostics' && modal?.type === 'developerDiagnostics') {
      const field = modalHost.querySelector('.pl-diagnostic-report');
      const status = modalHost.querySelector('.pl-diagnostic-status');
      status.textContent = await copyDiagnosticReport(field) ? '已复制' : '请手动复制已选中的日志';
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
        try { setDeveloperSkillsEnabled(!developerSkillsEnabled()); modal.error = ''; }
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
      if(next.id!==current?.id)stateFeedback.selection('.rc-preview-card.is-selected');
      const card=body.querySelector('.rc-preview-card.is-selected');
      card?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
      card?.focus({preventScroll:true});
      return;
    }
    if (action === 'researchDraw') { await act('researchDraw', { pool: data.pool, expectedRevision: Number(data.revision) }); return; }
    if(action==='researchCard'&&!snapshot.research?.cards?.some(c=>String(c.id)===String(id)&&c.owned))return;
    if (['researchCard', 'researchSummary'].includes(action)) { modal = { type: action, id }; renderModal(); return; }
    if (['tasks','pilotSupplyTasks','signin','achievements'].includes(action)) { modal = {type:'tasks',period:['tasks','pilotSupplyTasks'].includes(action)?'daily':action,...(modal?.type==='activities'?{returnTo:{...modal,childOpener:captureFocus(modalHost,target)}}:{})}; renderModal(); return; }
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
      if(modal?.type==='tasks' && DAILY_TABS.some(t=>t.id===data.period) && modal.period!==data.period) {
        modal.period=data.period;delete modal.milestoneId;renderModal();stateFeedback.taskPage();
        modalHost.querySelector(`.dc-tab[data-period="${modal.period}"]`)?.focus({preventScroll:true});
      }
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
    if (action === 'claimActivity') {const result=await act('claimActivity',{id,period:data.period});if(result?.ok)modalHost.querySelector(`.dc-chest[data-id="${id}"]`)?.focus({preventScroll:true});return;}
    if (action === 'claimAchievement') {const result=await act('claimAchievement',{id});if(result?.ok)modalHost.querySelector(`[data-achievement-id="${id}"]`)?.focus({preventScroll:true});return;}
    if (action === 'recoverDailyRewards') {await act(action);return;}
    if (action === 'dailyGo') {
      const destination=data.destination;
      if(destination==='signin'){modal.period='signin';renderModal();return;}
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
      if(target.tagName==='BUTTON'){target.disabled=true;target.setAttribute('aria-busy','true');}
      const label=target.querySelector('.shop-button-label');
      if(label)label.textContent=item.cost.type==='ad'?'广告加载中…':'领取中…';
      try { await act('shopBuy',{id,token:snapshot.shop.token}); }
      finally { render(true); }
      return;
    }
    if (action === 'shopConfirm') {const review=modal,token=review?.type==='shopConfirm'?review.token:null;if(token){const result=await act('shopBuy',{id,token,quantity:review.quantity||1});if(!result?.ok&&modal?.type==='shopConfirm')renderModal();}return;}
    if (action === 'playerInfo') { modal = {type:'playerInfo'}; renderModal(); return; }
    if (action === 'playerRename' && modal?.type === 'playerInfo') {
      modal.editingName=true;modal.nameDraft=snapshot.playerName;modal.nameError='';renderModal();
      const input=modalHost.querySelector('[data-player-name]');input?.focus();input?.select();return;
    }
    if (action === 'playerRenameCancel' && modal?.type === 'playerInfo') {
      modal.editingName=false;modal.nameError='';renderModal();modalHost.querySelector('[data-action="playerRename"]')?.focus();return;
    }
    if (action === 'playerRenameSave' && modal?.type === 'playerInfo') {
      const result=await act('renamePlayer',{name:modal.nameDraft,expectedRevision:Number(data.renameRevision),
        expectedCost:Number(data.renameCost),expectedName:data.renameName});
      if(result?.ok){modal.editingName=false;modal.nameError='';pendingModalBackgroundRefresh=true;}
      else modal.nameError=result?.message||'名字未保存，请重试';
      renderModal();modalHost.querySelector(result?.ok?'[data-action="playerRename"]':'[data-player-name]')?.focus();return;
    }
    if (action === 'catalog') { openCatalog(data.kind); return; }
    if (action === 'catalogBack') { returnFromCatalog(); return; }
    if (action === 'catalogGrowth') {
      if (!weaponFor(id)) return;
      modal={type:'weaponSkillGroup',id,opener:captureFocus(root,target)}; renderModal(); return;
    }
    if (action === 'catalogSkill') {
      if (!weaponCatalogSkillDetail({weapon:weaponFor(id),key:data.skill,helpers:referenceContext().helpers})) return;
      modal={type:'weaponSkill',id,skillKey:data.skill,opener:captureFocus(root,target)}; renderModal(); return;
    }
    if (action === 'catalogSelect') { if (subpage === 'weapon') selectedWeapon = id; else if (subpage === 'aircraft') browseAircraft = id; else browsePilot = id; render(true); return; }
    if (action === 'catalogMode') { weaponSkillSlot=-1;catalogSkillTab = data.mode === 'skills'; if(fleetUi[subpage])Object.assign(fleetUi[subpage],{selectedSkillSlot:null,pendingSkillId:null,selectedSkillId:null});render(true); return; }
    if(action==='fleetSkillCancel'){const slot=fleetUi[subpage]?.selectedSkillSlot;if(fleetUi[subpage])Object.assign(fleetUi[subpage],{selectedSkillSlot:null,pendingSkillId:null,selectedSkillId:null});render(true);body.querySelector(`.fc-skill-group [data-slot="${slot??0}"]`)?.focus({preventScroll:true});return;}
    if(action==='fleetSkillSlot') {
      const kind=data.kind,slot=Number(data.slot),ui=fleetUi[kind];if(!ui)return;
      if(ui.pendingSkillId){const result=await act('fleetSkillEquip',{kind,id:ui.pendingSkillId,slot,expectedRevision:snapshot.fleet?.revision});if(result?.ok)Object.assign(ui,{pendingSkillId:null,selectedSkillSlot:null});}
      else ui.selectedSkillSlot=catalogSkillTab&&ui.selectedSkillSlot===slot?null:slot;
      catalogSkillTab=true;render(true);body.querySelector(`.fc-skill-group [data-slot="${slot}"]`)?.focus({preventScroll:true});return;
    }
    if(action==='fleetSkillEquip') {
      const kind=data.kind,ui=fleetUi[kind],slots=snapshot.fleet?.[kind]?.slots||[];if(!ui)return;
      const slot=ui.selectedSkillSlot??slots.indexOf(null);
      if(slot<0){ui.pendingSkillId=id;render(true);body.querySelector('.fc-skill-group button')?.focus({preventScroll:true});return;}
      const result=await act('fleetSkillEquip',{kind,id,slot,expectedRevision:Number(data.revision)});
      if(result?.ok){Object.assign(ui,{selectedSkillSlot:null,pendingSkillId:null,selectedSkillId:null});render(true);body.querySelector(`.fc-skill-group [data-slot="${slot}"]`)?.focus({preventScroll:true});}return;
    }
    if(action==='fleetSkillRemove') {const kind=data.kind,slot=Number(data.slot),result=await act('fleetSkillRemove',{kind,id,slot,expectedRevision:Number(data.revision)});if(result?.ok){Object.assign(fleetUi[kind],{selectedSkillSlot:null,pendingSkillId:null,selectedSkillId:null});render(true);body.querySelector(`.fc-skill-group [data-slot="${slot}"]`)?.focus({preventScroll:true});}return;}
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
      render(true);body.querySelector('.fc-hero-actions button:not(:disabled)')?.focus({preventScroll:true});return;
    }
    if (action === 'catalogAcquire') { if(data.kind==='weapon'){switchTab('shop');return;} if(snapshot.pilots.some(p=>p.id===id))selectedRecruitPilot=id;switchTab('supply');return; }
    if (action === 'openWorkshop') { if(!id){openGearWorkshop(null,target);return;}workshopKind='weapon';workshopMode=data.mode==='quality'?'quality':'level';catalogWorkshopReturn=subpage==='weapon'?{skillTab:catalogSkillTab,weaponId:selectedWeapon,opener:captureFocus(root,target)}:null;if(tab==='assembly'&&!subpage)equipmentReturnFocus=captureFocus(root,target);tab = 'assembly'; subpage = 'workshop'; workshopId = id || null; workshopRevealSelection=Boolean(id); workshopFilter = 'all'; modal = null; render(true); return; }
    if (action === 'workshopSelect') { workshopId = id; render(true); return; }
    if (action === 'workshopMode') { workshopMode = data.mode === 'quality' ? 'quality' : 'level'; workshopFilter = 'all'; render(true); body.querySelector(`.ws-modes [data-mode="${workshopMode}"]`)?.focus({preventScroll:true}); return; }
    if (action === 'workshopChoose') { body.querySelector('.ref-warehouse')?.scrollTo({top:0,behavior:'smooth'}); body.querySelector('.ref-warehouse :is(.eq-card,.ag-card)')?.focus({preventScroll:true}); return; }
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
    if (action === 'claimTask') { const result=await act('claimTask', { id });if(result?.ok)modalHost.querySelector(`[data-task-id="${id}"]`)?.focus({preventScroll:true});return; }
    if (['claimPatrol','quickPatrol','quickPatrolAd','devPatrolSample'].includes(action)) { await act(action,{expectedRevision:Number(data.revision)}); return; }
    if (action === 'start') {
      const index = battleChapterIndex(snapshot, battleChapter);
      const result = await act('start', { index, stageIndex: index });
      if (result?.ok && !result.started) bridge.startGame?.();
    }
  }
  function keydown(event) {
    if (!visible) return;
    gearSelectInput='keyboard';
    if(event.target.matches?.('[data-gear-select]'))event.target.dataset.gearInput=gearSelectInput;
    if(modal?.type==='playerInfo'&&modal.editingName&&event.target.matches?.('[data-player-name]')&&!event.isComposing&&event.key==='Enter'){
      event.preventDefault();modalHost.querySelector('[data-action="playerRenameSave"]')?.click();return;
    }
    if(modal?.type==='playerInfo'&&modal.editingName&&event.key==='Escape'){
      event.preventDefault();modalHost.querySelector('[data-action="playerRenameCancel"]')?.click();return;
    }
    if (event.target.closest?.('[data-action="portraitFeedback"]') && ['Enter',' '].includes(event.key)) {
      event.preventDefault();event.target.closest('[data-action="portraitFeedback"]').click();return;
    }
    if (modal && polishedTab()) trapModalTab(event, modalHost.querySelector('.bag-detail') || modalHost.querySelector('.pl-modal, .bc-affection-player'));
    if(modal?.type==='tasks' && event.target.closest?.('.dc-tabs') && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
      event.preventDefault();const current=DAILY_TABS.findIndex(t=>t.id===modal.period);
      const index=event.key==='Home'?0:event.key==='End'?DAILY_TABS.length-1:(current+(event.key==='ArrowLeft'?-1:1)+DAILY_TABS.length)%DAILY_TABS.length;
      modalHost.querySelector(`.dc-tab[data-period="${DAILY_TABS[index].id}"]`)?.click();return;
    }
    if (modal?.type === 'backpack' && !modal.bagItem && event.target.closest?.('.bag-tab') && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
      event.preventDefault();
      const current = BACKPACK_TABS.findIndex(item => item.id === (modal.bagTab || 'all'));
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? BACKPACK_TABS.length - 1 : (current + (event.key === 'ArrowLeft' ? -1 : 1) + BACKPACK_TABS.length) % BACKPACK_TABS.length;
      modalHost.querySelector(`.bag-tab[data-tab="${BACKPACK_TABS[index].id}"]`)?.click();
      return;
    }
    if(!modal&&tab==='research'&&!subpage&&event.target.closest?.('.research-tabs')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      event.preventDefault();const tabs=[...body.querySelectorAll('.research-tabs>[role="tab"]')],current=tabs.findIndex(node=>node.getAttribute('aria-selected')==='true');
      const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(event.key==='ArrowLeft'?-1:1)+tabs.length)%tabs.length;
      tabs[index]?.click();return;
    }
    const fleetState=fleetUi[subpage];
    if (event.key !== 'Escape') return;
    if(modal?.type==='pilotAffectionVideo')event.preventDefault();
    if(!modal&&subpage==='weapon'&&catalogSkillTab&&weaponSkillSlot>=0){const slot=weaponSkillSlot;weaponSkillSlot=-1;render(true);body.querySelector(`.wg-skill-slot[data-slot="${slot}"]`)?.focus({preventScroll:true});return;}
    if(!modal&&fleetState&&(fleetState.selectedSkillSlot!=null||fleetState.pendingSkillId)){const slot=fleetState.selectedSkillSlot;Object.assign(fleetState,{selectedSkillSlot:null,pendingSkillId:null,selectedSkillId:null});render(true);body.querySelector(`.fc-skill-group [data-slot="${slot??0}"]`)?.focus({preventScroll:true});return;}
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
  window.addEventListener('keydown', keydown);
  if(nativeTabCache)window.addEventListener('shnh-memory-warning',releaseInactiveTabs);
  const chestPreviewResize=new ResizeObserver(()=>{if(modal?.type==='taskChestPreview')positionTaskChestPreview(modalHost,modalRoot,modal);});
  chestPreviewResize.observe(root);
  render(true);
  return {
    root,
    get tab() { return tab; }, get snapshot() { return snapshot; },
    get state() { return { tab, subpage, catalogSkillTab, catalogFilter, visible, modal: modal?.type || null, selectedSlot, selectedWeapon, pool:'pilot', workshopId }; },
    switchTab, render() { render(true); }, refresh() { render(true); },
    startPortraits() {
      if(destroyed||portraitsEnabled||portraitStartFrame!==null)return;
      // Let the interactive lobby and its still portrait paint first.
      portraitStartFrame=window.requestAnimationFrame(()=>{
        portraitStartFrame=window.requestAnimationFrame(()=>{
          portraitStartFrame=null;
          if(destroyed)return;
          portraitsEnabled=true;
          portraitPlayer.sync(body);
        });
      });
    },
    setVisible(value) {
      visible = Boolean(value);root.hidden = !visible;root.setAttribute('aria-hidden', String(!visible));
      if(!visible&&modal?.type==='pilotAffectionVideo')returnToParentModal();
      portraitPlayer.setVisible(visible&&!modal,{suspendLoading:nativeTabCache&&!visible});models.update(0, visible);
      if(!visible){
        // The hidden preview renderer has no consumer during a sortie. Keep
        // the selected model identity so it can be recreated if needed.
        if(nativeTabCache){models.release();releaseInactiveTabs();}
        onboarding.hide();actionFeedback.clear();stateFeedback.clear();processMotion.clear();uiMotion.clear();
      }else render();
    },
    update(ticker) { if (destroyed || !visible || document.hidden) return; performanceMonitor.frame('lobby'); return performanceMonitor.measure('ui',()=>{const dt = typeof ticker === 'number' ? ticker : (ticker?.deltaMS || 16.67) / 1000; elapsed += dt; onboarding.tick(dt);homeView?.tick();menuView?.tick();nativeDialog?.tick?.(dt);
      // Retain the last aircraft frame while its whole hangar is being scrolled.
      if (models.attached&&!root.querySelector('.drag-scroll-active .pl-model-canvas'))
        models.update(dt,!modal||Boolean(modalHost.querySelector('[data-model-aircraft],.pl-model-canvas')));
      if (elapsed >= 1) {
        elapsed %= 1;
        const clock = snapshot && !modal && !busy && !pendingScrollRender && !pendingModalBackgroundRefresh
          ? bridge.getPeripheralClock?.() : null;
        if (clock) {
          const {time, ...patrolClock} = clock;
          const saved=snapshot;
          snapshot = { ...snapshot, patrol: { ...snapshot.patrol, ...patrolClock } };
          // Only the patrol clock changed; neither equipment nor shop markup uses it.
          if(markupSnapshot===saved)markupSnapshot=snapshot;
          refreshPatrolClocks(root, snapshot);
          if(tab==='battle'&&!subpage)bridge.app?.renderer?.publishHome?.(snapshot,battleChapterIndex(snapshot,battleChapter),bridge.debugToolsEnabled);
          if(tab==='shop'){if(menuView)menuView.clock(time);else refreshShopClocks(body,snapshot,time);}
        } else render();
      } }); },
    destroy() {
      destroyed = true;releaseNativeReceipt();releaseNativeBackpack();releaseOverlayDialog();releaseNativeDialog();homeView?.close();homeView=null;menuView?.close();menuView=null;
      if(portraitStartFrame!==null)window.cancelAnimationFrame(portraitStartFrame);
      releaseAffectionVideo(); itemDescriptions.destroy(); if(bridge.showItemDescription===itemDescriptions.open)delete bridge.showItemDescription;
      chestPreviewResize.disconnect(); onboarding.destroy(); actionFeedback.destroy(); stateFeedback.clear(); processMotion.destroy(); uiMotion.destroy(); clearTimeout(toastTimer); clearTimeout(debugClearTimer); window.removeEventListener('keydown', keydown); window.removeEventListener('shnh-memory-warning',releaseInactiveTabs); releaseHoloCards(); releaseEquipmentChoices(); portraitPlayer.destroy(); models.destroy(); clearUiMarkupCache(body); clearUiMarkupCache(header); root.remove();
    },
  };
}
