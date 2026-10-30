import {attachRecruitStripDrag} from './recruit-strip-drag.js';
import { isResourceShortage, shortageToast } from './resource-availability.js';
import './interface-clarity.css';
import { developerSkillsEnabled, setDeveloperSkillsEnabled } from '../developer-battle-settings.js';
import { researchArt } from './research-art.js';
import {createLobbyOnboarding} from './lobby-onboarding.js';
import { nativeRewardPresentation } from '../replica/native-item-presentation.js';
import { developerToolsDialog } from './developer-tools-panel.js';
import './developer-tools.css';
import {commonRewardsDialog,isCommonReward} from './common-rewards.js';
import {shopBoxRewards} from './shop-box-result-cards.js';
import {playerName} from '../player-identity.js';
import { emptySlotMark } from './psd-empty-slot.js';
import { lobbyNavigation } from './lobby-navigation.js';
import { chapterPresentationForStage, chapterPreviewBackground } from '../replica/chapter-presentation.js';
import { weaponIconUrl } from './weapon-icon-source.js';
import './peripheral-lobby.css';
import { AIRCRAFTS } from '../pilots.js';
import { COMMON_WEAPONS } from '../fixed-parts/common-weapons.js';
import { createPeripheralModels } from './peripheral-models.js';
import { aircraftUiImage, aircraftPreview } from './aircraft-preview.js';
import { performanceMonitor } from '../performance-monitor.js';
import { setUiMarkup } from './ui-markup.js';
import { flattenDisclosureMarkup } from './flat-sections.js';
import { optimizeUiAssetUrls } from './ui-image-source.js';
import { pilotHoloCard, bindPilotHoloCards } from './pilot-holo-card.js';
import './pilot-holo-card.css';
import './peripheral-polish.css';
import { referenceCatalogPage } from './reference-catalog-pages.js';
import { weaponCatalogSkillDetail, weaponCatalogGrowthDetail } from './weapon-catalog-page.js';
import { fleetAircraftDetail, fleetPilotDetail, fleetSkillPreview, fleetOperationModal } from './fleet-catalog-page.js';
import { referenceWorkshopPage } from './reference-shell-pages.js';
import { workshopFilterDialog, WORKSHOP_FILTERS } from './workshop-reference-page.js';
import './reference-shell-pages.css';
import { recruitPage, recruitModal, recruitItems, recruitFeatured } from './recruit-page.js';
import { growthSupplyDialog } from './growth-supply-panel.js';
import { chapterRewardsDialog } from './chapter-rewards-panel.js';
import { nativeStarRewardsDialog } from './native-star-rewards-panel.js';
import { pilotSupplyPanel } from './pilot-supply-panel.js';
import { collectionSupplyDialog } from './collection-supply-panel.js';
import { isRecruitResult, recruitResultsDialog, recruitRewardsDialog, pilotRecruitResults } from './recruit-results.js';
import './peripheral-unified.css';
import { slotLabel, equippedSlots } from './equipment-labels.js';
import { cloudNativeCollectionOperation, cloudNativeRecruitSnapshot, cloudNativeRecruit, cloudNativeCollectionDetail, cloudNativeSkillPreview, cloudNativeWeaponPreview } from '../replica/cloud-native-pages.js';
import { nativeEquipmentBoxDetail } from './native-equipment-box-detail.js';
import { NATIVE_PENDING_ECONOMY_ACTIONS, NATIVE_PENDING_ECONOMY_MESSAGE } from '../replica/native-economy-availability.js';
import { researchUnlockMessage } from './research-tabs.js';
import { nativeLabPage, nativeLabDetail, nativeStatsDetail } from './native-lab-page.js';
import { researchPage, researchModal, researchHeader } from './research-page.js';
import './research-page.css';
import { shopPage, shopHeader, shopModal, shopSectionId, shopPurchaseMax, shopOfferQuote, reconcileShopReview } from './shop-page.js';
import { hasLobbyGrowthFeedback, showLobbyGrowthFeedback } from './lobby-growth-feedback.js';
import { createActionFeedback } from './action-feedback.js';
import { actionRewards, rewardReturnModal } from './reward-feedback-policy.js';
import { createLobbyStateFeedback } from './lobby-state-feedback.js';
import { exitModal } from './surface-motion.js';
import { createUiMotion } from './ui-motion.js';
import './shop-page.css';
import { equipmentPage, equipmentHeader } from './equipment-page.js';
import { bindEquipmentChoices } from './equipment-toolbar.js';
import { lobbyResources } from './lobby-resources.js';
import './equipment-page.css';
import './recruit-page.css';
import './peripheral-quality.css';
import { battlePage, battleHeader, battleChapterIndex, battleSupplementalModal } from './battle-page.js';
import './battle-supplemental.css';
import './psd-main-v1.css';
import { portraitPresentation } from './character-portraits.js';
import { createCharacterPortraits } from './character-portrait-controller.js';
import './character-portraits.css';
import { resourceIcon } from './resource-icons.js';
import { lobbyCommandPanel, COMMAND_PANELS } from './lobby-command-panels.js';
import './lobby-command-panels.css';
import { illustratedGlyph } from './illustrated-icons.js';
import { projectIcon, projectIconUrl } from './project-ui-art.js';
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
import { ITEM_USE_BATCH_LIMIT, isItemUseBatchCount } from '../replica/item-use-batches.js';
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
import {playerInfoPanel, PLAYER_INFO_TABS} from './player-info.js';
import './player-info.css';

const TABS = [{ id: 'shop', title: '商城', icon: 'shop' }, { id: 'assembly', title: '装备', icon: 'weapon' }, { id: 'battle', title: '战役', icon: 'plane' }, { id: 'research', title: '科技研究', icon: 'research' }, { id: 'supply', title: '招募', icon: 'crate' }];
const QUALITIES = ['#9baebd', '#66c58d', '#62bdf5', '#b584ed', '#ffc864', '#f4769c'];
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const number = value => value == null ? '—' : Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 1 });
const short = value => Number(value) >= 100000 ? `${(Number(value) / 10000).toFixed(1)}万` : number(value);
const clearNativeTooltips = root => root.querySelectorAll('[title]').forEach(node => node.removeAttribute('title'));
// Custom-property URLs are consumed by CSS under assets/ in production. Resolve them against the page first.
const asset = name => new URL(`${import.meta.env.BASE_URL}art/peripheral-v1/${name}.webp`, document.baseURI).href;
const emblem = name => `${import.meta.env.BASE_URL}art/peripheral-v2/icons/${name}.svg`;
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

export function mountPeripheralLobby({ bridge, parent = document.body, system } = {}) {
  if (!bridge) throw new TypeError('mountPeripheralLobby requires a bridge');
  const root = document.createElement('section'); root.className = 'peripheral-lobby psd-nav-global'; root.id = 'gui-casual-lobby'; root.setAttribute('aria-label', '少女航线指挥部');
  root.innerHTML = '<div class="pl-shell"><header class="pl-header"></header><div class="pl-resource-host"></div><main class="pl-body"></main><nav class="pl-nav lobby-nav" aria-label="主导航"></nav><div class="pl-modal-host"></div><div class="pl-toast" role="status" aria-live="polite"></div></div>';
  parent.append(root);
  const header = root.querySelector('.pl-header'), resourceHost = root.querySelector('.pl-resource-host'), body = root.querySelector('.pl-body'), nav = root.querySelector('.pl-nav'), modalHost = root.querySelector('.pl-modal-host');
  const uiMotion = createUiMotion(root);
  let tab = TABS.some(t => t.id === bridge.activeLobbyTab) ? bridge.activeLobbyTab : 'battle';
  let snapshot, signature = '', visible = true, destroyed = false, busy = false, elapsed = 0, toastTimer, debugClearTimer = 0, modal = null;
  let browsePilot, browseAircraft, selectedWeapon, selectedSlot = 'W3', growthKind = 'aircraft', pool = 'pilot', tabScroll = {};
  let shopSection = 'boxes';
  let equipmentFilter = 'owned', equipmentSort = 'quality', equipmentPickingSlot = false, equipmentScroll = 0;
  let gearSort='quality',gearFilter='all',workshopKind='gear',gearWorkshop=null,gearWorkshopOrigin=null;
  let equipmentPickContext = null, equipmentReturnFocus = null, pendingEquipmentScroll = null;
  let researchSection = 'talent';
  const researchScrollPositions={talent:0,lab:0};
  let battleChapter = null;
  let recruitSelection = {pilot:null,weapon:null};
  let modalOpener = null, renderedModalKey = '', renderedModalContent = '', recruitScroll = 0;
  let pendingModalBackgroundRefresh = false;
  const polishedTab = () => ['shop','assembly','battle','research','supply'].includes(tab);
  let nativeAppearanceOnly = false;
  let subpage = '', catalogSkillTab = false, catalogFilter = 'all', equipmentSortDescending = true, workshopId = null, workshopFilter = 'all', workshopMode = 'level';
  const catalogScrollPositions = new Map();
  const fleetUi={aircraft:{selectedSkillSlot:null,pendingSkillId:null,filterOpen:false},pilot:{selectedSkillSlot:null,pendingSkillId:null,filterOpen:false}};
  let fleetSupplyReturn=null;
  const fleetItem=(kind,id)=>(kind==='aircraft'?snapshot.aircraft:snapshot.pilots).find(item=>item.id===id);
  const workshopScrollPositions = new Map();
  const dailyScrollPositions = new Map();
  const patrolScrollPositions = new Map();
  let workshopRevealSelection = false;
  let catalogWorkshopReturn = null;
  let profileCatalogReturn = null;
  const releaseHoloCards = bindPilotHoloCards(root);
  const releaseEquipmentChoices = bindEquipmentChoices(root);
  const portraitPlayer = createCharacterPortraits();
  const models = createPeripheralModels();

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
  const currentPilot = () => snapshot.pilots.find(p => p.id === snapshot.pilotId) || snapshot.pilots[0];
  const currentAircraft = () => snapshot.aircraft.find(p => p.id === snapshot.aircraftId) || snapshot.aircraft[0];
  const weaponFor = id => snapshot.weapons.find(w => w.id === (typeof id === 'object' ? id?.itemId || id?.id : id));
  // Weapon inventory emblems depict the equipped hardware; model-pool weapon
  // thumbnails depict its projectile and belong to combat attack previews.
  const thumbnail = (id, cls = '') => {
    return img(COMMON_WEAPONS[id] ? weaponIcon(id) : aircraftUiImage(id,'thumbnail'), '', `pl-model-thumb ${COMMON_WEAPONS[id] ? `pl-weapon-emblem pl-weapon-icon-${id.slice(4)}` : ''} ${cls}`);
  };
  const preview=(id,options={})=>aircraftPreview(id,options);
  const referenceContext = () => ({ snapshot, helpers: { escape, number, icon, img, thumbnail, preview, button, asset, researchArt }, sortDescending: equipmentSortDescending, workshopKind,gearWorkshop,workshopId, workshopFilter, workshopMode, workshopBackLabel:catalogWorkshopReturn ? '返回武器目录' : '返回装备' });

  const onboarding=createLobbyOnboarding({root,
    context:()=>({snapshot,tab,subpage,modal,researchSection,shopSection,gearFilter,visible,busy,chapterIndex:battleChapterIndex(snapshot||{},battleChapter)}),
    mark:async(group,uid)=>{const handler=bridge.peripheralAction||system?.action;const result=await handler?.call(system||bridge,'onboardingComplete',{group,uid});render(true);return result;}
  });
  function toast(message) {
    if(isResourceShortage(message))message=shortageToast(message);
    const node = root.querySelector('.pl-toast'); node.classList.remove('is-visible'); node.textContent = message; void node.offsetWidth; node.classList.add('is-visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('is-visible'), 2667);
  }
  function patrolUnlockMessage() {
    return snapshot.patrol?.unlocked===false ? (snapshot.patrol.lockReason||'通关第1章开启巡逻') : '';
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
      const handler = bridge.peripheralAction || system?.action;
      const result = handler ? await handler.call(system || bridge, action, payload) : { ok: false, message: '当前功能尚未开放' };
      if(result?.ok&&result.recruitToken)await handler.call(system||bridge,'fleetRecruitSeen',{token:result.recruitToken});
      if (result?.message && !(result.ok && growthBefore)) toast(action==='shopBuy'&&result.message==='商品状态已更新，请重新选择'?'商品已更新':result.message);
      if (result?.ok === false && !result.message) toast('暂时无法进行此操作');
      const rewards = actionRewards(result,snapshot,result?.ok?read():snapshot);
      if (result?.ok && action==='claimActivity' && modal?.type==='tasks') delete modal.milestoneId;
      const completedShopOrder=result?.ok&&action==='shopBuy'&&modal?.type==='shopConfirm';
      const rewardReturn=modal&&modal.type!=='rewards'&&!completedShopOrder?{...modal,childOpener:captureFocus(modalHost),rewardReturnScroll:modalHost.querySelector('.pl-modal-content')?.scrollTop||0}:null;
      if (rewards.length) modal = { type: 'rewards', title: result.title || (action === 'recruit'||result.recruitPool ? '招募结果' : '获得奖励'), rewards:rewards.map(r=>({...r,isNew:r.isNew ?? ((r.type||r.kind)==='weapon' && !snapshot.weapons.some(w=>w.id===(r.id||r.itemId)&&w.owned))})), recruit: result.recruitPool==='pilot'||action === 'recruit' && (payload.poolId || pool) === 'pilot', recruitPool: result.recruitPool||(action === 'recruit' ? payload.poolId || pool : null), recruitGrid:result.directRecruit===true||action==='recruit'&&(payload.poolId||pool)==='pilot', ...(resourceReturn?{returnTo:resourceReturn}:patrolReturn ? {returnTo:patrolReturn,patrol:true} : rewardReturn?{returnTo:rewardReturn}:{}) };
      else if(completedShopOrder)modal=resourceReturn||null;
      if (result?.ok && result.researchResult) {
        modal = { type: 'researchResult', result };
        pendingResearchFocus = result.cardId || null;
      }
      if(result?.ok&&snapshot.replicaCollection&&['replicaCollection','selectReplicaLoadout','gearEquip','gearUnequip','gearUpgrade','gearUpgradeAll','gearDowngrade','gearMerge','gearBatch'].includes(action)) {
        try {await bridge.getReplicaLoadoutDetails?.();} catch { /* Show pending; never restore archived estimates. */ }
      }
      render(true);
      if (result?.ok) {
        const credited = actionFeedback.wallet(walletBefore, snapshot.wallet);
        // A receipt already says what arrived; don't stack a second success toast.
        if (credited || rewards.length || result.researchResult || result.gearResult?.operation==='supply') { clearTimeout(toastTimer); root.querySelector('.pl-toast').classList.remove('is-visible'); }
      }
      if (result?.ok && subpage === 'workshop' && !modal && !root.contains(document.activeElement)) {
        (body.querySelector('.ws-grid .eq-card.is-selected') || body.querySelector('.ws-slot:not(.is-result)'))?.focus({preventScroll:true});
      }
      if (result?.ok) {
        if(Number.isFinite(motionBefore.power)&&Number.isFinite(snapshot.power))actionFeedback.power(motionBefore.power,snapshot.power);
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
    const result=await act('gearSupply',{pool:review.pool,count:review.count,expectedRevision:review.revision,
      expectedInventoryRevision:review.inventoryRevision,...(freeOnly?{freeOnly:true}:{})});
    if(!result)return;
    if(result.ok)modal={type:'shopBoxResult',drawn:result.gearResult.drawn.map(i=>i.uid),receipt:result.gearResult.receipt,
      pilots:result.gearResult.pilotRewards||[],weapons:result.gearResult.weaponRewards};
    else if(!freeOnly)modal={...review,error:result.message};
    else return;
    renderModal();
  }
  function renderHeader() {
    if (tab === 'assembly' && !subpage) { setUiMarkup(header,equipmentHeader(referenceContext())); return; }
    if (tab === 'battle' && !subpage) { setUiMarkup(header,battleHeader(referenceContext(), snapshot.playerName)); return; }
    if (tab === 'shop' || tab === 'supply') {
      let markup=shopHeader(referenceContext(), snapshot.playerName, tab === 'shop' ? '商城' : '招募');
      if(tab==='supply'&&fleetSupplyReturn){
        const template=document.createElement('template');template.innerHTML=markup;
        const heading=template.content.querySelector('.lobby-page-heading');
        if(heading)heading.innerHTML=`<button type="button" class="fleet-supply-back" data-action="fleetSupplyBack">← 返回${fleetSupplyReturn.kind==='aircraft'?'战机':'驾驶员'}</button>`;
        markup=template.innerHTML;
      }
      setUiMarkup(header,markup);
      return;
    }
    if (tab === 'research') {
      setUiMarkup(header,researchHeader(referenceContext()));
      return;
    }
    const title = TABS.find(t => t.id === tab)?.title || '装备';
    setUiMarkup(header,`<strong class="ref-header-title">${title}</strong>${bridge.debugToolsEnabled ? button('debug', '开发', 'pl-debug-entry', 'aria-label="打开开发工具"') : ''}${lobbyResources(referenceContext(), tab === 'assembly' ? 'equipmentShop' : 'shopSection')}`);
  }
  function renderNav() { setUiMarkup(nav,lobbyNavigation(tab)); }

  function heading(kicker, title, extra = '') { return `<div class="pl-page-heading"><div><small>${kicker}</small><h1>${title}</h1></div>${extra}</div>`; }
  function slots({ compact = false } = {}) {
    return `<div class="pl-slots ${compact ? 'is-compact' : ''}"><div class="pl-slot pl-signature-slot"><span>槽1 · 槽2</span>${thumbnail(currentAircraft()?.weaponId) || img(entryIcon('weapon'), '', 'pl-model-thumb')}<b>本机专武</b></div>${['W3', 'W4', 'W5', 'W6'].map(id => {
      const w = weaponFor(snapshot.loadout[id]);
      return `<button type="button" class="pl-slot ${selectedSlot === id && !compact ? 'is-selected' : ''}" style="--quality:${QUALITIES[w?.qualityRank || 0]}" data-action="slot" data-slot="${id}"><span>${slotLabel(id)}</span>${w ? thumbnail(w.id) || icon('weapon') : emptySlotMark('pl-slot-plus')}<b>${escape(w?.name || '空闲槽位')}</b></button>`;
    }).join('')}</div>`;
  }
  function pilotPage() {
    const p = snapshot.pilots.find(p => p.id === browsePilot) || currentPilot();
    return `<section class="pl-pilot-page">${heading('PILOT ARCHIVE', '战姬', `<span class="pl-count">${snapshot.pilots.filter(p => p.owned).length} / ${snapshot.pilots.length}</span>`)}<div class="pl-pilot-hero" style="--pilot-color:${p?.color || '#a382e5'}"><div class="pl-pilot-orbit"></div><div class="pl-pilot-callsign">${escape(p?.callsign)}</div>${img(p?.image, p?.name, 'pl-pilot-portrait')}<div class="pl-pilot-name"><span>${escape(p?.title || '航线战姬')}</span><h2>${escape(p?.name)}</h2><small>${p?.id === snapshot.pilotId ? '当前出战' : p?.owned ? '已解锁' : '等待加入'}</small></div></div><div class="pl-pilot-skill pl-panel"><div class="pl-skill-emblem">${icon('pilot')}</div><div><small>固定被动</small><h3>${escape(p?.skillName || p?.passiveName || '专属能力')}</h3><p>${escape(p?.passiveDescription || p?.description)}</p></div></div><div class="pl-pilot-selection">${snapshot.pilots.map(x => `<button type="button" class="pl-pilot-card ${p?.id === x.id ? 'is-selected' : ''} ${!x.owned ? 'is-locked' : ''}" style="--quality:${x.color || '#84bdeb'}" data-action="browsePilot" data-id="${escape(x.id)}" aria-label="${escape(x.name)}">${img(x.avatar || x.image, x.name)}${x.id === snapshot.pilotId ? '<i class="pl-equipped">出战</i>' : !x.owned ? icon('lock', 'pl-card-lock') : ''}<span>${escape(x.name.split('·')[0])}</span></button>`).join('')}</div>${button('selectPilot', p?.id === snapshot.pilotId ? `${icon('check')} 当前出战` : p?.owned ? '设为出战战姬' : escape(p?.unlockText || p?.unlockDescription || '推进关卡解锁'), p?.id === snapshot.pilotId ? 'pl-secondary pl-wide' : 'pl-primary pl-wide', `data-id="${escape(p?.id)}"`, !p?.owned || p?.id === snapshot.pilotId)}</section>`;
  }
  function aircraftStrip() { return `<div class="pl-aircraft-strip">${snapshot.aircraft.map(a => `<button type="button" class="pl-aircraft-chip ${a.id === (browseAircraft || snapshot.aircraftId) ? 'is-selected' : ''} ${!a.owned ? 'is-locked' : ''}" data-action="browseAircraft" data-id="${escape(a.id)}">${thumbnail(a.id) || icon('plane')}<span>${escape(a.shortName || a.aircraftName || a.aircraft || a.name)}</span>${!a.owned ? icon('lock', 'pl-card-lock') : a.id === snapshot.aircraftId ? '<i class="pl-equipped">出战</i>' : ''}</button>`).join('')}</div>`; }
  function weaponCard(w, selected = false, action = 'weapon') { return `<button type="button" class="pl-weapon-card ${selected ? 'is-selected' : ''} ${!w.owned ? 'is-locked' : ''}" style="--quality:${QUALITIES[w.qualityRank || 0]}" data-action="${action}" data-id="${escape(w.id)}"><span class="pl-card-level">Lv.${w.level || 1}</span><div class="pl-weapon-picture">${thumbnail(w.id) || icon('weapon')}</div><b>${escape(w.name)}</b>${equippedSlots(snapshot, w.id).length ? '<i class="pl-equipped">已装备</i>' : !w.owned ? icon('lock', 'pl-card-lock') : ''}</button>`; }
  function assemblyPage() {
    const a = snapshot.aircraft.find(a => a.id === browseAircraft) || currentAircraft();
    return `<section class="pl-assembly-page">${heading('AIRCRAFT HANGAR', '机库与武器', `<span class="pl-count">${snapshot.aircraft.filter(a => a.owned).length} 架战机</span>`)}<div class="pl-hangar" style="background-image:url('${asset('hangar')}')"><div class="pl-hangar-meta"><span>Lv.${a?.level || 1}</span><b>${escape(a?.aircraftName || a?.aircraft || a?.name)}</b></div><div class="pl-live-model" data-model-aircraft="${escape(a?.id)}"></div><div class="pl-hangar-platform"></div>${a?.id !== snapshot.aircraftId ? button('selectAircraft', a?.owned ? '驾驶此战机' : '招募获得', 'pl-primary pl-aircraft-equip', `data-id="${escape(a?.id)}"`) : '<span class="pl-hangar-active">✓ 当前出战</span>'}</div>${aircraftStrip()}<div class="pl-section-label"><h2>武器挂载</h2><span>${escape(currentAircraft()?.weaponName || currentAircraft()?.signatureWeaponName || '本机专武')} · 槽1 / 槽2</span></div>${slots()}<div class="pl-section-label"><h2>武器仓库</h2><span>通用${slotLabel(selectedSlot)}</span></div><div class="pl-weapon-grid">${snapshot.weapons.map(w => weaponCard(w, selectedWeapon === w.id)).join('') || '<div class="pl-empty">暂无武器</div>'}</div></section>`;
  }
  function costHtml(cost) { if (!cost) return ''; const names = { coins: '金币', diamonds: '钻石', aircraftShards: '飞机碎片', weaponParts: '武器零件' }; const icons = { coins: 'coin', diamonds: 'diamond', aircraftShards: 'shard', weaponParts: 'parts' }; return Object.entries(cost).filter(([key, value]) => names[key] && value > 0).map(([key, value]) => `<span class="${Number(snapshot.wallet[key]) < value ? 'is-insufficient' : ''}">${icon(icons[key])} ${number(value)}</span>`).join(''); }
  function upgradePage() {
    const a = currentAircraft(), w = weaponFor(selectedWeapon) || snapshot.weapons.find(w => w.owned), item = growthKind === 'aircraft' ? a : w;
    const growth = item?.growth || {}, cost = growth.cost || item?.cost || item?.upgradeCost || snapshot.growth?.[growthKind]?.cost;
    return `<section class="pl-upgrade-page">${heading('BASIC ENHANCEMENT', '基础强化', `<span class="pl-count">战力 ${number(snapshot.power)}</span>`)}<div class="pl-segmented">${button('growthKind', `${icon('plane')} 飞机强化`, growthKind === 'aircraft' ? 'is-active' : '', 'data-kind="aircraft"')}${button('growthKind', `${icon('weapon')} 武器强化`, growthKind === 'weapon' ? 'is-active' : '', 'data-kind="weapon"')}</div><div class="pl-upgrade-hero" style="background-image:url('${asset('hangar')}')"><div class="pl-upgrade-rays"></div>${growthKind === 'aircraft' ? `<div class="pl-live-model" data-model-aircraft="${escape(a?.id)}"></div>` : `<div class="pl-growth-weapon">${thumbnail(w?.id) || icon('weapon')}</div>`}<div class="pl-upgrade-hero-name"><h2>${escape(growthKind === 'aircraft' ? a?.aircraftName || a?.aircraft || a?.name : w?.name || '选择武器')}</h2><span>Lv.${item?.level || 1}</span><i>→</i><strong>Lv.${Math.max(item?.level || 1, Math.min(item?.maxLevel || 999, (item?.level || 1) + 1))}</strong></div></div><div class="pl-growth-stats pl-panel">${growthKind === 'aircraft' ? `<div><span>基础攻击</span><b>${number(item?.attack ?? item?.stats?.attack)}</b><i>→</i><strong>${number(growth.nextAttack ?? item?.nextAttack)}</strong></div><div><span>基础耐久</span><b>${number(item?.hp ?? item?.stats?.hp)}</b><i>→</i><strong>${number(growth.nextHp ?? item?.nextHp)}</strong></div>` : `<div><span>基础伤害</span><b>${number(item?.damage ?? item?.stats?.damage)}</b><i>→</i><strong>${number(growth.nextDamage ?? item?.nextDamage)}</strong></div><p>${escape(item?.description || item?.role || '')}</p>`}</div><div class="pl-materials"><span>${icon('shard')} 飞机碎片 <b>${number(snapshot.wallet.aircraftShards)}</b></span><span>${icon('parts')} 武器零件 <b>${number(snapshot.wallet.weaponParts)}</b></span></div>${button('upgrade', `<strong>${item?.level >= item?.maxLevel ? (growthKind === 'weapon' && item?.qualityRank < 5 ? '请先提升品级' : '已达满级') : growth.breakthrough ? '阶段突破' : '基础强化'}</strong><span class="pl-button-cost">${costHtml(cost)}</span>`, 'pl-primary pl-wide pl-upgrade-button', `data-kind="${growthKind}" data-id="${escape(item?.id)}"`, !item?.owned || item?.level >= item?.maxLevel)}<div class="pl-section-label"><h2>${growthKind === 'aircraft' ? '出战战机' : '选择强化武器'}</h2><span>成长 ${growthKind === 'aircraft' ? '耐久 · 攻击' : '基础伤害'}</span></div>${growthKind === 'aircraft' ? `<div class="pl-growth-identity">${icon('plane')}<span>${escape(a?.aircraftName || a?.aircraft || a?.name)}</span>${button('tab', '前往机库', 'pl-secondary', 'data-tab="assembly"')}</div>` : `<div class="pl-weapon-grid">${snapshot.weapons.filter(w => w.owned).map(x => weaponCard(x, x.id === w?.id, 'growthWeapon')).join('')}</div>`}</section>`;
  }
  function pilotRewardsHtml(rewards) {
    return pilotRecruitResults(rewards,snapshot.pilots,{number,renderReward:rewardItemHtml,grid:modal?.recruitGrid===true});
  }
  function rewardItemHtml(r,projectAssets=false) {
    const id = r.id || r.itemId, type = r.type || r.kind;
    const known = snapshot.weapons.find(w => w.id === id) || snapshot.aircraft.find(a => a.id === id);
    const native = nativeRewardPresentation(r);
    const rank = Math.max(0, Math.min(5, Number(r.qualityRank ?? native.qualityRank ?? known?.qualityRank ?? 0)));
    const ownResource=projectAssets?({coins:'psd-main-v1/resources/coins-icon',diamonds:'psd-main-v1/resources/diamonds-icon',stamina:'psd-main-v1/resources/stamina-icon',aircraftShards:'project-inventory-icons-v1/aircraft-shard',weaponParts:'project-inventory-icons-v1/weapon-parts',cores:'project-inventory-icons-v1/technology-core'})[type]:null;
    const resourceName = ({ coins:'金币', diamonds:'钻石', aircraftShards:'通用飞机碎片', weaponParts:'武器零件', cores:'科技星核', stamina:'体力' })[type];
    const gearImage=type==='pilotCredits'?icon('medal'):native.image?img(native.image,'','pl-icon ag-reward-art'):type==='nativeItem'&&r.image?img(r.image,'','pl-icon ag-reward-art'):['gear','gearBlueprint','gearKey'].includes(type)&&r.image?img(`${import.meta.env.BASE_URL}${r.image}`,'','pl-icon ag-reward-art'):'';
    if (projectAssets) {
      const artwork = gearImage || (ownResource ? img(`${import.meta.env.BASE_URL}art/${ownResource}.png`,'','pl-icon') : '') || thumbnail(id) || icon(({ aircraft:'plane', weapon:'weapon' })[type] || 'crate');
      const name=resourceName || native.name || r.name || known?.aircraftName || known?.name || '补给';
      const tag=r.gearUid?'button':'div',action=r.gearUid?`type="button" data-action="gearDetail" data-id="${escape(r.gearUid)}" aria-label="${escape(name)}${r.qualityName?'，'+escape(r.qualityName):''}，查看当前装备"`:'';
      return `<${tag} class="pl-reward-item" data-reward-resource="${escape(type)}" data-reward-rank="${rank}" ${action}><div class="common-reward-item-frame" data-psd-quality="${rank}">${artwork}<span class="common-reward-quantity">×${number(r.amount ?? r.count ?? 1)}</span></div><b>${escape(name)}</b>${r.receiptStatus?`<small>${escape(r.receiptStatus)}</small>`:''}</${tag}>`;
    }
    return `<div class="pl-reward-item" data-reward-resource="${escape(type)}" data-reward-rank="${rank}" ${['weapon','gear'].includes(type)?`data-psd-quality="${rank}"`:''} style="--quality:${QUALITIES[rank]}">${gearImage || (ownResource?img(`${import.meta.env.BASE_URL}art/${ownResource}.png`,'','pl-icon'):'') || thumbnail(id) || icon(({ coins:'coin', diamonds:'diamond', aircraftShards:'shard', weaponParts:'parts', cores:'core', stamina:'energy', aircraft:'plane', weapon:'weapon' })[type] || 'crate')}<b>${escape(resourceName || native.name || r.name || known?.aircraftName || known?.name || '补给')}</b><span>×${number(r.amount ?? r.count ?? 1)}</span></div>`;
  }
  function rewardsHtml(rewards,projectAssets=false) {
    return `<div class="pl-rewards-grid">${rewards.map(r=>rewardItemHtml(r,projectAssets)).join('')}</div>`;
  }
  function closeBackpackDetail() {
    if (modal?.type !== 'backpack' || !modal.bagItem) return false;
    modal.bagItem = null;
    renderModal();
    restoreFocus(modalHost, modal.bagOpener);
    return true;
  }
  function equipmentContext(opener = document.activeElement) {
    return { filter:equipmentFilter, sort:equipmentSort,
      scroll:body.querySelector('.eq-inventory')?.scrollTop ?? equipmentScroll,
      selectedSlot, selectedWeapon, opener:captureFocus(root,opener) };
  }
  function restoreEquipmentContext(context) {
    if (!context) return;
    equipmentFilter=context.filter; equipmentSort=context.sort; equipmentScroll=context.scroll;
    pendingEquipmentScroll=context.scroll;
    selectedSlot=context.selectedSlot; selectedWeapon=context.selectedWeapon;
    // render() also captures the current scrollport before replacing its DOM.
    const scroller=body.querySelector('.eq-inventory');
    if (scroller) scroller.scrollTop=context.scroll;
  }
  function focusEquipmentSource(opener, slot = selectedSlot) {
    if (restoreFocus(root,opener)) return;
    (body.querySelector(`.eq-mount[data-slot="${slot}"]`) || body.querySelector('[data-equipment-select="filter"]'))?.focus({preventScroll:true});
  }
  function cancelEquipmentPicking() {
    const context=equipmentPickContext;
    restoreEquipmentContext(context);
    equipmentPickingSlot=false; equipmentPickContext=null;
    render(true); focusEquipmentSource(context?.opener);
  }
  function openWeaponDetails(id, opener, readonly = false, requireSlotSelection = false) {
    if (!weaponFor(id)) return;
    const targetSlot=equipmentPickingSlot ? selectedSlot
      : WEAPON_EQUIP_SLOTS.find(slot=>!snapshot.loadout[slot]) || selectedSlot;
    selectedWeapon=id;
    modal={type:'weapon',id,readonly,targetSlot:requireSlotSelection?null:targetSlot,requireSlotSelection,loadoutToken:snapshot.loadoutToken,opener:captureFocus(root,opener)};
    render(true);
  }
  function closeWeaponDetails(completedSlot) {
    const opener=modal?.opener || modalOpener;
    const context=completedSlot ? equipmentPickContext : null;
    const weaponId=modal?.id;
    if (context) restoreEquipmentContext(context);
    if (completedSlot) {
      selectedSlot=completedSlot; selectedWeapon=weaponId;
      equipmentPickingSlot=false; equipmentPickContext=null;
    }
    modal=null; render(true);
    focusEquipmentSource(context ? null : opener,completedSlot || selectedSlot);
  }
  function returnToParentModal() {
    if(!modal?.returnTo)return false;
    const parent=modal.returnTo,opener=parent.childOpener,scroll=parent.rewardReturnScroll;delete parent.childOpener;delete parent.rewardReturnScroll;
    if(['gearDetail','gearSources','gearMergeList'].includes(parent.type))parent.revision=snapshot.equipment.revision;
    modal=parent;renderModal();if(scroll!=null){const content=modalHost.querySelector('.pl-modal-content');if(content)content.scrollTop=scroll;}restoreFocus(modalHost,opener);return true;
  }
  function renderModal() {
    if(modal&&isResourceShortage(modal.error))modal={...modal,error:''};
    if(modal?.type==='shopConfirm'){
      const result=reconcileShopReview(modal,snapshot);
      if(result.invalidated){modal=modal.returnTo?{...modal.returnTo}:null;toast('商品已更新');}
      else modal=result.review;
    }
    // Keep the last portrait image behind a modal without rendering both UI layers.
    portraitPlayer.setVisible(visible&&!modal);
    const modalKey = modal ? `${modal.type}:${modal.id || ''}:${modal.view || ''}` : '';
    const stableType = modal && (isRecruitResult(modal) || modal.type==='recruitRewards' || COMMAND_PANELS.has(modal.type) || ['chapterRewards','chapterCoreRewards','nativeStarRewards','nativeMaterials','nativeStats','nativeEquipmentBoxes','pilotSupplyTasks','pilotSupplyBoxes','nativeRecruitInfo','playerInfo','formation','chapterChest','patrol','quickPatrol','nativeLab','nativeCollectionDetail','nativeSkillPreview','nativeWeaponPreview','collectionSupplyChoice','growthSupplyChoice','weapon','weaponSkill','weaponSkillGroup','aircraftInfo','pilotInfo','fleetSkill','fleetOperation','workshopBatch','workshopFilter'].includes(modal.type) || modal.type.startsWith('research') || modal.type.startsWith('gear'));
    if (!stableType || renderedModalKey !== modalKey) stateFeedback.clearResult();
    const focused = captureFocus(modalHost);
    const modalScrollSelector = modal?.type==='weapon' ? '.equipment-weapon-detail__scroll' : ['nativeCollectionDetail','nativeSkillPreview'].includes(modal?.type) ? '.cd-scroll,.pl-modal-content:not(:has(.cd-scroll))' : modal?.type?.startsWith('gear') ? '.ag-modal-scroll,.pl-modal-content:not(:has(.ag-modal-scroll))' : '.pl-modal-content';
    const previousScroll = modalHost.querySelector(modalScrollSelector)?.scrollTop || 0;
    modalHost.querySelectorAll('[data-daily-scroll]').forEach(node=>dailyScrollPositions.set(node.dataset.dailyScroll,node.scrollTop));
    modalHost.querySelectorAll('[data-patrol-scroll]').forEach(node=>patrolScrollPositions.set(node.dataset.patrolScroll,node.scrollTop));
    if (!modal) {
      uiMotion.modal('');
      exitModal(modalHost, root);
      modalHost.innerHTML = '';
      [header,body,nav].forEach(el => { el.inert = false; });
      if (polishedTab()) restoreFocus(root, modalOpener);
      modalOpener = null; renderedModalKey = ''; renderedModalContent = '';
      if (pendingModalBackgroundRefresh) {
        pendingModalBackgroundRefresh = false;
        render(true);
      }
      if (pendingResearchFocus) {
        const id = pendingResearchFocus; pendingResearchFocus = null;
        stateFeedback.research(id);
      }
      return;
    }
    root.querySelectorAll('.surface-exit-copy').forEach(node => node.remove());
    if (polishedTab() && !renderedModalKey) modalOpener = modal.opener || captureFocus(root);
    if (modal.type === 'backpack') {
      // Preserve the grid and its focus while a live wallet snapshot updates.
      if (modal.bagItem && !backpackItems(snapshot).some(item => item.id === modal.bagItem)) modal.bagItem = null;
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
    const battleSupplement = commandPanel || (tab === 'battle' ? battleSupplementalModal(modal.type,snapshot,battleChapter) : null);
    if (battleSupplement) {
      ({title,content} = battleSupplement);
    } else if (modal.type === 'playerInfo') {
      ({title,content}=playerInfoPanel(snapshot,modal,referenceContext().helpers,snapshot.playerName));
    } else if (modal.type === 'recruitHistory' || modal.type === 'recruitRewards') {
      ({title,content}=recruitModal(modal.type,cloudNativeRecruitSnapshot(snapshot),referenceContext().helpers,modal.view));
    } else if (modal.type === 'shopBoxResult') {
      const result=shopBoxRewards(modal,snapshot);
      title=modal.history?'上次开箱结果':'获得奖励';
      content=rewardsHtml(result.rewards,true)+(result.detailsMissing?'<p class="sn-hint">部分旧记录未保存完整装备关联，已保留可还原的开箱内容。</p>':'');
    } else if (modal.type.startsWith('shop')) {
      ({ title, content } = shopModal(modal, snapshot, referenceContext().helpers));
    } else if (modal.type.startsWith('research')) {
      ({ title, content } = researchModal(modal, snapshot, referenceContext().helpers));
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
    } else if (modal.type === 'innateInfo') {
      const w = weaponFor(modal.id); title = '本机专武';
      content = `<div class="pl-weapon-detail">${thumbnail(w?.id)}</div><h3>${escape(w?.name)}</h3><p class="pl-modal-description">${escape(w?.description)}</p>${button('catalog', '查看战机', 'pl-primary pl-wide', 'data-kind="aircraft"')}`;
    } else if (modal.type === 'nativeSkillPreview') {
      ({title,content}=cloudNativeSkillPreview(modal.kind,modal.id,snapshot,referenceContext().helpers));
    } else if (modal.type === 'nativeWeaponPreview') {
      ({title,content}=cloudNativeWeaponPreview(modal.id,modal.mode,snapshot,referenceContext().helpers));
    } else if (modal.type === 'nativeCollectionOperation') {
      ({title,content}=cloudNativeCollectionOperation(modal,snapshot,referenceContext().helpers));
    } else if (modal.type === 'nativeCollectionDetail') {
      ({title,content}=cloudNativeCollectionDetail(modal.kind,modal.id,snapshot,referenceContext().helpers));
    } else if (modal.type==='nativeStarRewards') {
      ({title,content}=nativeStarRewardsDialog(snapshot));
    } else if (['chapterRewards','chapterCoreRewards'].includes(modal.type)) {
      ({title,content}=chapterRewardsDialog(snapshot,modal.chapter));
    } else if (modal.type==='growthSupplyChoice') {
      ({title,content}=growthSupplyDialog(snapshot,modal,referenceContext().helpers));
    } else if (modal.type==='collectionSupplyChoice') {
      ({title,content}=collectionSupplyDialog(snapshot,modal,referenceContext().helpers));
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
      for(const node of template.content.querySelectorAll('[data-action]'))if(NATIVE_PENDING_ECONOMY_ACTIONS.has(node.dataset.action)&&!(snapshot.flightRewards&&node.dataset.action==='claimSignIn')) {
        node.disabled=true;node.setAttribute('aria-label',['patrol','quickPatrol'].includes(modal.type)?(!snapshot.patrol.unlocked?snapshot.patrol.lockReason:snapshot.patrol.settlementReason):NATIVE_PENDING_ECONOMY_MESSAGE);
      }
      content=template.innerHTML;
    }
    if(snapshot.rewardPending||snapshot.rewardBusy) {
      const template=document.createElement('template');template.innerHTML=content;
      const actions=new Set(['claimSignIn','claimTask','claimActivity','claimAchievement','claimStarReward',
        'flightReward','pilotSupply','collectionSupplyOpen','collectionSupplyClaim','growthSupplyOpen','growthSupplyClaim','nativeChapterReward','nativeChapterCoreReward','nativeComposePilotBox','shopOffer','shopConfirm','shopBoxOpen','shopRefreshPreview','shopRefreshConfirm','shopRefreshAdConfirm',
        'shopClaimBoxReward','claimPatrol','quickPatrol','quickPatrolAd','devPatrolSample']);
      for(const node of template.content.querySelectorAll('[data-action]'))if(actions.has(node.dataset.action)) {
        node.disabled=true;node.title=snapshot.rewardPending?'已有奖励待保存，请先重试保存':'奖励正在处理，请稍候';
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
    const existingStableModal = stableType
      && renderedModalKey === modalKey && modalHost.querySelector(modal.type==='weapon'?'.pl-modal[data-detail-layout="equipment-reference-psd"]':'.pl-modal');
    if (existingStableModal) {
      const heading=existingStableModal.querySelector('#lobby-modal-title');
      if(heading)heading.textContent=title;
      // Do not replay entry animations, reset focus or reload art on polling.
      if (renderedModalContent === content) {
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
      } else existingStableModal.querySelector('.pl-modal-content').innerHTML = content;
    } else if (isRecruitResult(modal)) {
      modalHost.innerHTML = recruitResultsDialog({title,content,count:modal.rewards.length,pilot:modal.recruitGrid===true},referenceContext().helpers);
    } else if (isCommonReward(modal)) {
      modalHost.innerHTML = commonRewardsDialog({title,content},referenceContext().helpers);
    } else if (modal.type==='recruitRewards') {
      modalHost.innerHTML = recruitRewardsDialog({title,content},referenceContext().helpers);
    } else if (modal.type==='weapon') {
      modalHost.innerHTML = equipmentWeaponDialog({title,content,quality:modal.type==='weapon'?weaponFor(modal.id)?.qualityRank:snapshot.replicaCollection.guns.find(row=>row.id===Number(modal.id))?.star},referenceContext().helpers);
    } else {
      const paper = PAPER_MODAL_TYPES.has(modal.type);
      modalHost.innerHTML = `<div class="pl-modal-backdrop ${paper ? 'lobby-paper-backdrop' : ''}" data-action="dismiss"><section class="pl-modal ${paper ? 'lobby-paper-modal' : ''} ${COMMAND_PANELS.has(modal.type) ? 'lc-modal' : ''} ${modal.type === 'weapon' ? 'weapon-detail-modal' : (modal.type === 'weaponSkill' || modal.type === 'weaponSkillGroup' || modal.type === 'nativeWeaponPreview') ? 'weapon-skill-modal' : ''}" data-psd-popup="${popupLevel(modal.type==='nativeCollectionDetail'?(modal.kind==='skins'?'aircraftInfo':'pilotInfo'):modal.type==='nativeWeaponPreview'?'weaponSkillGroup':modal.type)}" data-modal-type="${escape(modal.type)}" data-modal-kind="${escape(modal.type)}" role="dialog" aria-modal="true" aria-labelledby="lobby-modal-title" tabindex="-1"><div class="pl-modal-heading"><h2 id="lobby-modal-title">${escape(title)}</h2><button type="button" class="pl-close" data-action="close" aria-label="关闭">${icon('close')}</button></div><div class="pl-modal-content">${content}</div></section></div>`;
    }
    dockGearActions(modalHost);
    const patrolAircraftHost = modalHost.querySelector('[data-model-view="patrol"]');
    if (patrolAircraftHost) { models.attach(patrolAircraftHost); models.showAircraft(patrolAircraftHost.dataset.modelAircraft, snapshot); }
    renderedModalContent = content;
    if(modal.type==='recruitRewards' && renderedModalKey!==modalKey) modalHost.querySelector('.pl-modal-content').scrollTop=modal.scroll||0;
    const closeButton = modalHost.querySelector('.pl-close');
    if (closeButton) closeButton.disabled = modal.type === 'quickPatrol' && Boolean(snapshot.patrol?.adBusy);
    modalHost.querySelectorAll('[data-daily-scroll]').forEach(node=>{node.scrollTop=dailyScrollPositions.get(node.dataset.dailyScroll)||0;});
    modalHost.querySelectorAll('[data-patrol-scroll]').forEach(node=>{node.scrollTop=patrolScrollPositions.get(node.dataset.patrolScroll)||0;});
    if (polishedTab()) {
      [header,body,nav].forEach(el => { el.inert = true; });
      if (renderedModalKey === modalKey) {const scroller=modalHost.querySelector(modalScrollSelector);if(scroller)scroller.scrollTop=previousScroll;}
      if (renderedModalKey !== modalKey || !restoreFocus(modalHost, focused)) modalHost.querySelector('.pl-close,.common-reward-dismiss')?.focus({preventScroll:true});
    }
    renderedModalKey = modalKey;
    clearNativeTooltips(root);
    stateFeedback.ready();
    stateFeedback.progressionFeedback(snapshot);
    if (modal.type === 'researchResult' || modal.type === 'rewards' || modal.type === 'shopBoxResult') stateFeedback.result(modal, snapshot);
    uiMotion.modal(modalKey);
  }
  const stateFeedback = createLobbyStateFeedback(root,key=>bridge.playUiFeedback?.(key));
  let pendingResearchFocus = null;
  let pendingScrollRender = false;
  function render(force = false) {
    return performanceMonitor.measure('ui-render',()=>renderContent(force));
  }
  function renderContent(force = false) {
    // Keep the live scrollport and its captured pointer through drag/inertia.
    if (root.querySelector('.drag-scroll-active')) { pendingScrollRender ||= force; return; }
    force ||= pendingScrollRender; pendingScrollRender = false;
    if (destroyed) return; const next = read(), nextSignature = patrolRenderSignature(next);
    refreshPatrolClocks(root,next);
    if (!force && nextSignature === signature) { snapshot=next;return; }
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
    const previousFocus = polishedTab() && !modal ? captureFocus(root) : null;
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
    renderHeader(); renderNav(); root.dataset.tab = tab; root.dataset.subpage = subpage;
    const ctx = referenceContext();
    setUiMarkup(resourceHost,subpage ? lobbyResources(ctx, tab === 'assembly' ? 'equipmentShop' : tab === 'research' ? 'researchShop' : 'shopSection') : '');
    const bodyChanged=setUiMarkup(body, ['weapon','aircraft','pilot'].includes(subpage)
      ? referenceCatalogPage({ ...ctx, appearanceOnly:nativeAppearanceOnly, kind:subpage, selectedId:subpage==='weapon'?selectedWeapon:subpage==='aircraft'?browseAircraft:browsePilot, skillTab:catalogSkillTab, filter:catalogFilter, ...(fleetUi[subpage]||{}) })
      : subpage === 'workshop' ? referenceWorkshopPage(ctx)
      : tab === 'battle' ? battlePage(ctx,battleChapter)
      : tab === 'assembly' ? equipmentPage(ctx, {filter:equipmentFilter,sort:equipmentSort,selectedWeapon,selectedSlot,pickingSlot:equipmentPickingSlot,gearSort,gearFilter})
      : tab === 'shop' ? shopPage(ctx, shopSection)
      : tab === 'research' ? (researchSection==='lab'?nativeLabPage(ctx):researchPage(ctx))
      : snapshot.nativeAcquisition ? cloudNativeRecruit({...ctx,selected:recruitSelection[pool]}) : recruitPage({ ...ctx, pool, selected:recruitSelection[pool] }));
    if(profileCatalogReturn&&['weapon','aircraft','pilot'].includes(subpage))body.querySelector('[data-action="catalogBack"]')?.setAttribute('aria-label','返回个人信息');
    portraitPlayer.setVisible(visible&&!modal);
    if(bodyChanged)portraitPlayer.sync(body);
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
    if (shopScroll && bodyChanged) {
      shopScroll.scrollTop = oldShopScroll;
      shopScroll.addEventListener('scroll', () => {
        const sections = [...shopScroll.querySelectorAll('[data-shop-section]')];
        const atEnd = shopScroll.scrollHeight > shopScroll.clientHeight + 2 && shopScroll.scrollTop + shopScroll.clientHeight >= shopScroll.scrollHeight - 2;
        shopSection = shopSectionId((atEnd ? sections.at(-1) : sections.filter(section => section.offsetTop <= shopScroll.scrollTop + 24).at(-1))?.dataset.shopSection);
        body.querySelector('[data-shop-active]').dataset.shopActive = shopSection;
        body.querySelectorAll('.store-category').forEach(button => {
          const active = button.dataset.section === shopSection;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-current', String(active));
        });
      }, {passive:true});
    }
    const host = modalHost.querySelector('[data-model-view="patrol"]') || body.querySelector('[data-model-aircraft]');
    models.attach(host || null);
    if (host) models.showAircraft(host.dataset.modelAircraft, snapshot);
    if (!modal && polishedTab()) restoreFocus(root, previousFocus);
    clearNativeTooltips(root);
    stateFeedback.counters(snapshot);
    stateFeedback.progressionFeedback(snapshot);
    uiMotion.page(`${tab}:${subpage}:${catalogSkillTab}:${workshopMode}:${pool}:${equipmentFilter}:${gearFilter}`,body);
  }
  function scrollShopSection(value) {
    shopSection = shopSectionId(value);
    let scroller = body.querySelector('.shop-scroll');
    const target = shopSection === 'stamina' ? 'coins' : shopSection;
    let section = scroller?.querySelector(`[data-shop-section="${target}"]`);
    if (!section && tab === 'shop') {
      // Only the active section is mounted; switch pages before scrolling.
      render(true);
      scroller = body.querySelector('.shop-scroll');
      section = scroller?.querySelector(`[data-shop-section="${target}"]`);
    }
    if (section) scroller.scrollTop = 0;
  }
  function switchTab(value, requestedShopSection) {
    const previousTab = tab, previousSubpage = subpage;
    if(value==='supply')pool='pilot';
    if (value === 'missions') { modal = {type:'tasks',period:'daily'}; renderModal(); return; }
    if (value === 'loadout') { openCatalog('pilot'); return; }
    if (value === 'upgrade') { openGearWorkshop(); return; }
    if (!TABS.some(t => t.id === value && !t.locked)) return;
    profileCatalogReturn=null;
    if (equipmentPickingSlot) { restoreEquipmentContext(equipmentPickContext); equipmentPickingSlot=false; equipmentPickContext=null; }
    if (value === 'shop') {
      if (requestedShopSection !== undefined) shopSection = shopSectionId(requestedShopSection);
      else if (tab !== 'shop') shopSection = 'boxes';
    }
    tabScroll[tab] = body.scrollTop; tab = value; modal = null; browseAircraft = null;
    subpage = ''; catalogSkillTab = false; catalogWorkshopReturn = null;
    bridge.switchLobbyTab?.(value); render(true); body.scrollTop = tabScroll[value] || 0;
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
    if(profileCatalogReturn){
      const previous=profileCatalogReturn;profileCatalogReturn=null;
      tab=previous.tab;subpage=previous.subpage;modal=previous.modal;
      render(true);restoreFocus(modalHost,previous.opener);return;
    }
    switchTab('assembly');
  }
  function closeFleetOperation() {
    if(modal?.type!=='fleetOperation'||modal.returnTo)return false;
    modal=null;render(true);
    (body.querySelector('.fc-hero-actions button:not(:disabled)')||body.querySelector('.fc-info'))?.focus({preventScroll:true});
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
    if (equipmentPickingSlot) { restoreEquipmentContext(equipmentPickContext); equipmentPickingSlot=false; equipmentPickContext=null; }
    nativeAppearanceOnly = false;
    tab = 'assembly'; subpage = kind; modal = null; catalogSkillTab = false; catalogFilter = 'all';
    if(fleetUi[kind])Object.assign(fleetUi[kind],{selectedSkillSlot:null,pendingSkillId:null,filterOpen:false});
    if (kind === 'aircraft') browseAircraft = snapshot.aircraftId;
    if (kind === 'pilot') browsePilot = snapshot.pilotId;
    if (kind === 'weapon') selectedWeapon ||= weaponFor(snapshot.loadout[selectedSlot])?.id || snapshot.weapons.find(w=>w.owned)?.id;
    render(true); body.scrollTop = 0;
  }
  function openGrowthSupply(period,target) {
    const view=snapshot.pilotSupply?.growth?.[period];if(!view)return;
    const selected=view.claimed?view.candidates.find(row=>row.id===view.claimedId):view.candidates.find(row=>row.selectable);
    modal={type:'growthSupplyChoice',period,choiceId:selected?.id,opener:captureFocus(root,target),...(modal?{returnTo:{...modal}}:{})};renderModal();
  }
  function scrollEquipmentInventory() {
    const scroller = body.querySelector('.eq-inventory');
    equipmentScroll = 0;
    scroller?.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
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
    modalHost.querySelector('[data-bag-quantity-hint]').textContent=valid?`本次使用数量 ${count}，每批最多 ${ITEM_USE_BATCH_LIMIT}`:`请输入 1～${max} 的整数`;
  }
  root.addEventListener('input', event => {
    if(modal?.type==='backpack'&&event.target.matches('[data-bag-quantity]')&&!busy){
      modal.bagCount=event.target.value;updateBagQuantity();return;
    }
    if (modal?.type==='playerInfo' && event.target.matches('[data-player-name]')) modal.nameDraft=event.target.value;
  });
  root.addEventListener('change', event => {
    if(modal?.type==='growthSupplyChoice'&&event.target.matches('[data-growth-choice]')&&!busy){
      modal.choiceId=Number(event.target.value);renderModal();
      modalHost.querySelector('[data-growth-choice]')?.focus({preventScroll:true});return;
    }

    if(modal?.type==='collectionSupplyChoice'&&event.target.matches('[data-collection-choice]')&&!busy){
      modal.choiceId=Number(event.target.value);renderModal();
      modalHost.querySelector('[data-collection-choice]')?.focus({preventScroll:true});return;
    }
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
    const target = event.target.closest('[data-equipment-select]');
    if (!target || tab !== 'assembly' || subpage || busy) return;
    const kind = target.dataset.equipmentSelect, value = target.value;
    if (kind === 'filter' && ['all','owned','equipped','available','locked'].includes(value)) equipmentFilter = value;
    else if (kind === 'sort' && ['quality','level','name'].includes(value)) equipmentSort = value;
    else return;
    render(true);
    const scroller=body.querySelector('.eq-inventory');
    if(scroller){scroller.scrollTop=0;equipmentScroll=0;}
    body.querySelector(`[data-equipment-select="${kind}"]`)?.focus({preventScroll:true});
  });
  const actionFeedback = createActionFeedback(root);
  root.addEventListener('click', async event => {
    const target = event.target.closest('[data-action]'); if (!target || !root.contains(target) || target.disabled || busy) return;
    if(target.dataset.resourceShort){event.preventDefault();if(!snapshot.rewardPending&&!snapshot.rewardBusy)toast(shortageToast(target.dataset.resourceShort));return;}
    actionFeedback.capture(target);
    if (target.dataset.action !== 'dismiss') bridge.playUiClick?.();
    const action = target.dataset.action, id = target.dataset.id;
    if(action==='researchSection'){
      if(tab!=='research'||subpage||!['talent','lab'].includes(target.dataset.section))return;
      const lock=target.dataset.section==='lab'&&researchUnlockMessage(snapshot.replicaCampaign);
      if(lock){toast(lock);return;}
      researchSection=target.dataset.section;modal=null;render(true);
      body.querySelector(`[data-action="researchSection"][data-section="${researchSection}"]`)?.focus({preventScroll:true});return;
    }
    if(action==='nativeCollectionOperation'){
      modal={type:action,kind:target.dataset.kind,id:Number(id),operation:target.dataset.operation,opener:captureFocus(root,target),...(modal?{returnTo:modal}:{})};renderModal();return;
    }
    if(action==='growthSupplyOpen'){openGrowthSupply(target.dataset.period,target);return;}
    if(action==='growthSupplyClaim'){
      if(modal?.type!=='growthSupplyChoice')return;
      await act('pilotSupply',{action:'growth',period:modal.period,id:Number(id),expectedRevision:Number(target.dataset.revision)});return;
    }
    if(action==='collectionSupplyOpen'){
      const kind=target.dataset.kind,view=snapshot.pilotSupply?.collection?.[kind];
      if(!view)return;
      const choice=view.claimed?view.candidates.find(row=>row.id===view.claimedId):view.candidates.find(row=>row.id===Number(id)&&row.selectable)||view.candidates.find(row=>row.selectable);
      modal={type:'collectionSupplyChoice',kind,choiceId:choice?.id,opener:captureFocus(root,target),...(modal?{returnTo:{...modal}}:{})};
      renderModal();return;
    }
    if(action==='collectionSupplyClaim'){
      if(modal?.type!=='collectionSupplyChoice')return;
      await act('pilotSupply',{action:'collection',kind:modal.kind,id:Number(id),expectedRevision:Number(target.dataset.revision)});return;
    }
    if(action==='collectionSupplyDetail'){
      if(!['guns','skins'].includes(target.dataset.kind))return;
      modal={type:'nativeCollectionDetail',kind:target.dataset.kind,id:Number(id),returnTo:{...modal}};renderModal();return;
    }
    if(action==='bagOpen'){
      const item=backpackItems(snapshot).find(row=>row.nativeId===Number(id));if(!item)return;
      modal={type:'backpack',bagItem:item.id,bagChoice:null,bagCount:1,opener:captureFocus(root,target),...(modal?{returnTo:{...modal}}:{})};renderModal();return;
    }
    if(action==='pilotSupplyBoxes'){modal={type:action,opener:captureFocus(root,target)};renderModal();return;}
    if(action==='pilotSupplyTab'){
      if(modal?.type!=='pilotSupplyTasks'||!['daily','week'].includes(target.dataset.period))return;
      modal.period=target.dataset.period;renderModal();const scroll=modalHost.querySelector('.pl-modal-content');if(scroll)scroll.scrollTop=0;return;
    }
    if(action==='flightReward'){await act('flightReward',{action:target.dataset.operation,revision:Number(target.dataset.revision)});return;}
    if(action==='pilotSupply'){
      await act('pilotSupply',{action:target.dataset.operation,count:target.dataset.count===undefined?undefined:Number(target.dataset.count),
        id:target.dataset.operation==='task'?id:Number(id),expectedRevision:Number(target.dataset.revision)});return;
    }
    if(action==='nativeWeaponSkinSelect'){
      const rows=snapshot.replicaCollection?.guns||[],current=rows.find(row=>row.id===Number(modal?.id)),next=rows.find(row=>row.id===Number(id));
      if(modal?.type==='nativeCollectionDetail'&&modal.kind==='guns'&&current&&next&&(current.baseGunId||current.id)===(next.baseGunId||next.id)){
        modal={...modal,id:next.id};renderModal();
      }
      return;
    }
    if(action==='nativeCollectionDetail'||action==='nativeSkillPreview'||action==='nativeRecruitInfo'){modal={type:action,kind:target.dataset.kind,id:Number(id),...(modal?.type==='nativeCollectionDetail'?{returnTo:{...modal}}:{}),opener:captureFocus(root,target)};renderModal();return;}
    if(action==='nativeWeaponPreview'){modal={type:action,id:Number(id),mode:target.dataset.mode,...(modal?.type==='nativeCollectionDetail'?{returnTo:{...modal}}:{}),opener:captureFocus(root,target)};renderModal();return;}
    if(action==='nativeSlotPick'){const state=fleetUi[subpage];if(state){state.selectedSkillSlot=Number(target.dataset.slot);catalogSkillTab=true;render(true);}return;}
    if(action==='nativeEquipmentBoxes'){modal={type:'nativeEquipmentBoxes',opener:captureFocus(root,target),...(modal?{returnTo:{...modal}}:{})};renderModal();return;}
    if(action==='nativeMaterials'){modal={type:'backpack',opener:captureFocus(root,target),...(modal?{returnTo:{...modal}}:{})};renderModal();return;}
    if(action==='nativeStarRewards'){modal={type:'nativeStarRewards',opener:captureFocus(root,target),...(modal?{returnTo:{...modal}}:{})};renderModal();return;}
    if(['chapterRewards','chapterCoreRewards','flightChapters'].includes(action)){
      modal={type:'chapterRewards',chapter:Number(target.dataset.chapter)||undefined,opener:captureFocus(root,target),...(modal?{returnTo:{...modal}}:{})};renderModal();return;
    }
    if(action==='nativeChapterCoreReward'){
      await act('nativeAcquisition',{action:'chapterCoreReward',id:Number(id),expectedRevision:Number(target.dataset.revision)});return;
    }
    if(action==='nativeChapterReward'||action==='nativeComposePilotBox'){
      const result=await act('nativeAcquisition',{action:action==='nativeChapterReward'?'chapterReward':'composePilotBox',count:target.dataset.count===undefined?1:Number(target.dataset.count),id:Number(id),expectedRevision:Number(target.dataset.revision)});
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
        expectedRevision:Number(target.dataset.revision)});
      renderModal(); return;
    }
    if (action === 'nativeLabLevel') {
      const select = modalHost.querySelector('[data-native-lab-level]');
      if (!select || Number(select.dataset.nativeLabLevel) !== Number(id)) return;
      await act('replicaCollection', { kind: 'labs', id: Number(id), action: 'preview-level',
        level: Number(select.value), expectedRevision: Number(target.dataset.revision) });
      renderModal(); return;
    }
    if (action === 'nativeStats') {
      const requested={type:'nativeStats',opener:captureFocus(root,target)};
      modal=requested;renderModal();
      try {const result=await bridge.getReplicaLoadoutDetails();if(modal===requested){modal.result=result;renderModal();}}
      catch(error){if(modal===requested){modal.result={error:error.message};renderModal();}}
      return;
    }
    if (action === 'nativeAppearance') { modal=null; nativeAppearanceOnly = target.dataset.mode === 'appearance'; render(true); return; }
    if (action === 'nativeOperation') {
      const operation=target.dataset.operation,slot=Number(target.dataset.slot);
      const preview=modal?.type==='nativeCollectionOperation'?{...modal}:null;
      const previousStars=snapshot.replicaCollection[target.dataset.kind]?.find(row=>row.id===Number(id))?.star;
      const result=await act('replicaCollection', { action: operation, kind: target.dataset.kind,
        id: Number(id), slot, expectedRevision: Number(target.dataset.revision) });
      if(preview){modal={...preview,result:result?.ok?{previousStars}:undefined,error:result?.ok?'':result?.message||'操作未完成'};renderModal();}
      if(result?.ok&&operation==='slot'&&fleetUi[subpage]){
        Object.assign(fleetUi[subpage],{selectedSkillSlot:null,pendingSkillId:null});
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
        gearWorkshop=removeGearMergeMaterial(gear,gearWorkshop,Number(target.dataset.index));render(true);return;
      }
      if(action==='workshopGearToken'){
        if(!draft.stale&&draft.option?.tokenKey===target.dataset.key&&draft.tokens<draft.option.tokens&&draft.tokens+draft.materialIds.length<draft.option.required){gearWorkshop.tokens++;render(true);}return;
      }
      if(action==='workshopGearBatch'){
        const result=await act('gearPreview',{operation:'batch',expectedRevision:gear.revision});
        if(result?.ok){modal={type:'gearBatch',plan:result.gearPreview,revision:gear.revision};renderModal();}return;
      }
      if(action==='workshopGearCompose'){
        if(!draft.ready)return;
        const result=await act('gearMerge',{id:gearWorkshop.targetId,materialIds:[...draft.materialIds],tokens:draft.tokens,expectedRevision:gearWorkshop.revision});
        if(result?.ok){gearWorkshop=emptyGearMerge(snapshot.equipment.revision);render(true);}return;
      }
      return;
    }
    if(action.startsWith('gear')){
      const current=modal,itemId=id||modal?.id;
      const item=snapshot.equipment?.items.find(item=>item.uid===itemId);
      const open=(type,extra={})=>{
        modal={type,id:itemId,revision:snapshot.equipment.revision,...(current?.type?.startsWith('gear')||current?.type==='shopBoxResult'?{returnTo:{...current,childOpener:captureFocus(modalHost,target)}}:{}),...extra};renderModal();
      };
      if(action==='gearDetail'){open('gearDetail');return;}
      if(action==='gearReplace'){if(item){gearFilter=String(item.type);pendingEquipmentScroll=0;switchTab('assembly');}return;}
      if(action==='gearMaterialInfo'){open('gearMaterialInfo',{id:undefined,part:Number(target.dataset.part),quality:Number(target.dataset.quality)});return;}
      if(action==='gearAttributes'||action==='gearSources'||action==='gearMergeList'){open(action,{id:undefined});return;}
      if(action==='gearClearFilter'){gearFilter='all';pendingEquipmentScroll=0;render(true);return;}
      if(action==='gearChoosePart'){gearFilter=target.dataset.part;pendingEquipmentScroll=0;render(true);return;}
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
        materialIds:current?.materialIds||[],tokens:current?.tokens||0,count:Number(target.dataset.count)||1});
      if(!result?.ok){if(modal){modal.error=result?.message;renderModal();}return;}
      if(operation==='gearEquip'||operation==='gearUnequip'){if(!returnToParentModal()){modal=null;render(true);}return;}
      if(operation==='gearBatch'&&subpage==='workshop'&&workshopKind==='gear'){gearWorkshop=emptyGearMerge(snapshot.equipment.revision);modal=null;render(true);return;}
      if(operation==='gearSupply')modal={...current,type:'gearSources',drawn:result.gearResult.drawn.map(item=>item.uid),revision:snapshot.equipment.revision};
      else if(operation==='gearBatch')modal={type:'gearMergeList',steps:result.gearResult.steps.length,revision:snapshot.equipment.revision};
      else modal={type:'gearDetail',id:itemId,revision:snapshot.equipment.revision,result:result.message,
        ...(current?.type==='gearDetail'&&current.returnTo?{returnTo:current.returnTo}:current?.returnTo?.type==='gearMergeList'?{returnTo:current.returnTo}:{})};
      renderModal();return;
    }
    if (action === 'portraitFeedback') { portraitPlayer.feedback(target.dataset.characterPortrait); return; }
    if (action === 'dismiss') { if (event.target === target && !closeBackpackDetail() && !returnToParentModal() && !closeFleetOperation()) { if(modal?.type==='weapon')closeWeaponDetails();else{modal=null;renderModal();} } return; }
    if (action === 'close') { if(closeFleetOperation())return; if (!closeBackpackDetail() && !returnToParentModal()) { if(modal?.type==='weapon')closeWeaponDetails();else{modal=null;renderModal();} } return; }
    if (modal?.type === 'backpack') {
      if(action==='recoverDailyRewards'){await act(action);return;}
      if(action==='bagQuantity'){
        const input=modalHost.querySelector('[data-bag-quantity]');if(!input||input.disabled)return;
        const max=Number(input.max),current=Number(input.value);
        if(max<1)return;
        const count=target.dataset.max?max:Math.max(1,Math.min(max,(isItemUseBatchCount(current)?current:1)+Number(target.dataset.step)));
        modal.bagCount=String(count);input.value=String(count);updateBagQuantity();return;
      }
      if(action==='bagUse') {
        const origin={...modal},item=backpackItems(snapshot).find(row=>row.id===modal.bagItem);
        if(!item||item.nativeId!==Number(id))return;
        const rule=backpackUseRule(item.nativeId);
        const targetId=Number(modalHost.querySelector('[data-bag-choice]')?.value);
        const input=modalHost.querySelector('[data-bag-quantity]'),selected=target.hasAttribute('data-bag-use-selected');
        if(selected&&(!input||!input.validity.valid||!isItemUseBatchCount(Number(input.value)))){toast('请输入有效的使用数量');return;}
        const count=selected?Number(input.value):Number(target.dataset.count);
        const result=await act('backpackUse',{id:item.nativeId,count,targetId,...(target.dataset.useOperation?{action:target.dataset.useOperation}:{}),
          expectedRevision:Number(target.dataset.revision),expectedGearRevision:Number(target.dataset.gearRevision)});
        if(result?.ok&&rule?.kind==='equipmentKey') {
          modal={type:'shopBoxResult',drawn:result.gearResult.drawn.map(row=>row.uid),receipt:result.gearResult.receipt,pilots:result.gearResult.pilotRewards||[],weapons:[],returnTo:origin};renderModal();
        }
        return;
      }
      if(action==='bagGo') {
        const kind=target.dataset.kind,origin={...modal};
        if(kind==='lab'){
          const row=snapshot.replicaCollection?.labs?.find(row=>row.id===Number(id));
          const lock=researchUnlockMessage(snapshot.replicaCampaign,row);
          if(lock){toast(lock);return;}
          modal={type:'nativeLab',id:Number(id),returnTo:origin};
        }
        else if(['guns','skins','pilots'].includes(kind))modal={type:'nativeCollectionDetail',kind,id:Number(id),returnTo:origin};
        else if(kind==='growthDaily'||kind==='growthWeek'){openGrowthSupply(kind==='growthDaily'?'daily':'week',target);return;}
        else if(kind==='supplyTasks')modal={type:'tasks',period:'daily',returnTo:origin};
        else if(kind==='supplyBoxes')modal={type:'pilotSupplyBoxes',returnTo:origin};
        else if(kind==='patrol'){const lock=patrolUnlockMessage();if(lock){toast(lock);return;}patrolScrollPositions.clear();modal={type:'patrol',returnTo:origin};}
        else if(kind==='nativeStars')modal={type:'nativeStarRewards',returnTo:origin};
        else if(kind==='materials'||kind==='chapterCores')modal={type:'chapterRewards',returnTo:origin};
        else if(kind==='equipment'){gearFilter=['1','2','3','4','5'].includes(id)?id:'all';switchTab('assembly');return;}
        else if(kind==='talent'){researchSection='talent';switchTab('research');return;}
        else if(kind==='shop'||kind==='supply'){switchTab(kind);return;}
        renderModal();return;
      }
      if (action === 'bagDetailClose' || (action === 'bagDetailDismiss' && event.target === target)) { closeBackpackDetail(); return; }
      if (action === 'bagItem' && !modal.bagItem && backpackItems(snapshot).some(item => item.id === id)) {
        modal.bagOpener = captureFocus(modalHost, target); modal.bagItem = id; modal.bagChoice=null; modal.bagCount=1; renderModal(); return;
      }
      if (action === 'bagTab' && !modal.bagItem && BACKPACK_TABS.some(item => item.id === target.dataset.tab)) {
        if ((modal.bagTab || 'all') === target.dataset.tab) return;
        modal.bagTab = target.dataset.tab; modal.bagResetScroll = true; renderModal();
        modalHost.querySelector(`.bag-tab[data-tab="${modal.bagTab}"]`)?.focus({preventScroll:true}); return;
      }
      return;
    }
    if (action === 'debug' && bridge.debugToolsEnabled) { modal = { type: 'debug' }; renderModal(); return; }
    if (modal?.type === 'debug' && bridge.debugToolsEnabled) {
      if (action === 'developerSkills') {
        try { setDeveloperSkillsEnabled(!developerSkillsEnabled()); modal.error = ''; }
        catch (error) { modal.error = error.message || '开发设置保存失败'; }
        renderModal(); return;
      }
      if (action === 'developerCurrency') {
        await act('developerCurrency', { currency: target.dataset.currency, expectedRevision: Number(target.dataset.revision) });
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
    if (action === 'tab') { if(target.dataset.tab!==tab)fleetSupplyReturn=null;switchTab(target.dataset.tab); return; }
    if (action === 'equipmentShop' || action === 'researchShop' || (action === 'shopSection' && tab !== 'shop')) {
      switchTab('shop',target.dataset.section);
      return;
    }
    if (action === 'equipmentWeapons') { openCatalog('weapon');return; }
    if (action === 'recruitRoster') {modal={type:'recruitRewards',view:'roster'};renderModal();return;}
    if (action === 'recruitHistory' || action === 'recruitRewards') {modal={type:action};renderModal();return;}
    if(action==='recruitRewardDetail' && modal?.type==='recruitRewards') {
      const parent={...modal,scroll:modalHost.querySelector('.pl-modal-content').scrollTop,childOpener:captureFocus(modalHost,target)};
      if(target.dataset.kind==='weapon') {
        if(!weaponFor(id))return;
        openWeaponDetails(id,target,true);modal.returnTo=parent;
      }else {
        const pilot=cloudNativeRecruitSnapshot(snapshot).pilots.find(p=>p.id===id);
        modal=pilot?.nativeId?{type:'nativeCollectionDetail',kind:'pilots',id:pilot.nativeId,returnTo:parent}:{type:'pilotInfo',id,returnTo:parent};
        renderModal();
      }
      return;
    }
    if (action === 'recruitPreview' || action === 'recruitCycle') {
      const recruitView=cloudNativeRecruitSnapshot(snapshot),items=recruitItems(recruitView,pool);if(!items.length)return;
      const current=recruitFeatured(recruitView,pool,recruitSelection[pool]);
      const next=action==='recruitPreview'?items.find(item=>item.id===id):items[(items.indexOf(current)+(Number(target.dataset.step)===-1?-1:1)+items.length)%items.length];
      if(!next)return;recruitSelection[pool]=next.id;render(true);
      if(next.id!==current?.id)stateFeedback.selection('.rc-preview-card.is-selected');
      body.querySelector('.rc-preview-card.is-selected')?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
      body.querySelector(action==='recruitPreview'?'.rc-preview-card.is-selected':`.rc-arrow.${Number(target.dataset.step)===-1?'is-prev':'is-next'}`)?.focus({preventScroll:true});
      return;
    }
    if (action === 'equipmentShowAll' || action === 'equipmentCancelPick') {
      if(action==='equipmentCancelPick'){cancelEquipmentPicking();return;}
      equipmentFilter='owned';
      render(true);scrollEquipmentInventory();return;
    }
    if (action === 'equipmentSlot') {
      if(!['W3','W4','W5','W6'].includes(target.dataset.slot))return;
      const context=equipmentContext(target);
      selectedSlot=target.dataset.slot;
      actionFeedback.mount(models.slotPoint?.(selectedSlot));
      const w=weaponFor(snapshot.loadout[selectedSlot]);
      if(w){openWeaponDetails(w.id,target);}
      else{equipmentPickContext ||= context;equipmentPickingSlot=true;equipmentFilter='available';modal=null;render(true);scrollEquipmentInventory();}
      return;
    }
    if (action === 'equipmentWeapon') {
      openWeaponDetails(id,target);return;
    }
    if (action === 'researchDraw') { await act('researchDraw', { pool: target.dataset.pool, expectedRevision: Number(target.dataset.revision) }); return; }
    if(action==='researchCard'&&!snapshot.research?.cards?.some(c=>String(c.id)===String(id)&&c.owned))return;
    if (['researchCard', 'researchSummary'].includes(action)) { modal = { type: action, id }; renderModal(); return; }
    if (['tasks','pilotSupplyTasks','signin','achievements'].includes(action)) { modal = {type:'tasks',period:['tasks','pilotSupplyTasks'].includes(action)?'daily':action,...(modal?.type==='activities'?{returnTo:{...modal,childOpener:captureFocus(modalHost,target)}}:{})}; renderModal(); return; }
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
    if (action === 'claimStarReward') { await act('claimStarReward',{mode:target.dataset.mode,id:Number(id),expectedRevision:Number(target.dataset.revision)});return; }
    if (action === 'taskPeriod') {
      if(modal?.type==='tasks' && DAILY_TABS.some(t=>t.id===target.dataset.period) && modal.period!==target.dataset.period) {
        modal.period=target.dataset.period;delete modal.milestoneId;renderModal();stateFeedback.taskPage();
        modalHost.querySelector(`.dc-tab[data-period="${modal.period}"]`)?.focus({preventScroll:true});
      }
      return;
    }
    if (action === 'achievementCategory') {
      if(modal?.type==='tasks' && snapshot.achievements?.categories.some(c=>c.id===target.dataset.category)) {
        modal.achievementCategory=target.dataset.category;renderModal();stateFeedback.taskPage();
        modalHost.querySelector(`.dc-categories [data-category="${modal.achievementCategory}"]`)?.focus({preventScroll:true});
      }
      return;
    }
    if (action === 'dailyMilestone') {
      if(modal?.type!=='tasks' || snapshot.rewardPending)return;
      const period=modal.period||'daily',item=snapshot.activity?.[period]?.items.find(row=>row.id===id);
      if(!item || item.claimed || item.pending)return;
      if(item.claimable){await act('claimActivity',{id,period});return;}
      modal.milestoneId=modal.milestoneId===id?null:id;renderModal();return;
    }
    if (action === 'dailyMilestoneClose') {if(modal?.type==='tasks'){delete modal.milestoneId;renderModal();}return;}
    if (action === 'claimActivity') {const result=await act('claimActivity',{id,period:target.dataset.period});if(result?.ok)modalHost.querySelector(`.dc-chest[data-id="${id}"]`)?.focus({preventScroll:true});return;}
    if (action === 'claimAchievement') {const result=await act('claimAchievement',{id});if(result?.ok)modalHost.querySelector(`[data-achievement-id="${id}"]`)?.focus({preventScroll:true});return;}
    if (action === 'recoverDailyRewards') {await act(action);return;}
    if (action === 'dailyGo') {
      const destination=target.dataset.destination;
      if(destination==='signin'){modal.period='signin';renderModal();return;}
      if(destination==='chapters'){modal={type:'chapters',returnTo:{...modal,childOpener:captureFocus(modalHost,target)}};renderModal();return;}
      if(destination==='equipment'){switchTab('assembly');return;}
      if(destination==='workshop'){openGearWorkshop(null,target);return;}
      if(['weapon','aircraft'].includes(destination)){modal=null;openCatalog(destination);return;}
      if(['battle','supply'].includes(destination)){switchTab(destination);return;}
      return;
    }
    if (['shopWeaponPreview','shopWeaponOrder','shopWeaponBuy'].includes(action) || action==='shopRecruit'&&target.dataset.pool==='weapon') { switchTab('shop'); return; }
    if (action === 'shopRecruit') {pool='pilot';switchTab('supply');return;}
    if(action==='nativeEquipmentBoxLast'){
      const receipt=snapshot.equipmentBoxReceipt;
      if(receipt){modal={type:'shopBoxResult',history:true,receipt,drawn:receipt.uids,pilots:receipt.pilotRewards||[],weapons:[],...(modal?{returnTo:{...modal,childOpener:captureFocus(modalHost,target)}}:{})};renderModal();}
      return;
    }
    if(action==='shopBoxConfirm'||action==='shopBoxRates'){
      const review={type:action,pool:target.dataset.pool==='advanced'?'advanced':'basic',count:Number(target.dataset.count)===10?10:1,revision:snapshot.equipment.revision,inventoryRevision:snapshot.nativeAcquisition?.revision};
      if(action==='shopBoxConfirm'&&review.count===1&&target.dataset.payment==='free'&&snapshot.equipment?.native){await openShopBox(review,true);return;}
      modal=review;renderModal();return;
    }
    if(action==='shopBoxOpen'){
      await openShopBox(modal);return;
    }
    if(action==='shopClaimBoxReward'){await act('gearClaimBasicReward',{expectedRevision:snapshot.equipment.revision,expectedInventoryRevision:snapshot.nativeAcquisition.revision});return;}
    if(action==='shopRefreshPreview'){
      if(snapshot.shop.refresh.cost){modal={type:'shopRefreshConfirm',token:snapshot.shop.token};renderModal();}
      else await act('shopRefresh',{token:snapshot.shop.token});return;
    }
    if(action==='shopRefreshConfirm'){const token=modal?.token;if(token){modal=null;await act('shopRefresh',{token});}return;}
    if(action==='shopRefreshAdConfirm'){const token=modal?.token;if(token){modal=null;await act('shopRefresh',{token,refreshWithAd:true});}return;}
    if(action==='shopQuantity'){
      const offer=snapshot.shop.items.find(item=>item.id===modal?.id);if(!offer)return;
      const max=shopPurchaseMax(offer,snapshot.wallet),next=target.dataset.step==='max'?max:(modal.quantity||1)+Number(target.dataset.step);
      modal.quantity=Math.max(1,Math.min(Math.max(1,max),next));renderModal();return;
    }
    if (action === 'shopSection') {
      scrollShopSection(target.dataset.section);
      return;
    }
    if (action === 'shopOffer') {
      const item=snapshot.shop.items.find(o=>o.id===id);if(!item?.available)return;
      if(item.cost.amount){modal={type:'shopConfirm',id,token:snapshot.shop.token,quoteKey:shopOfferQuote(item),quantity:1,...(modal?.type==='stamina'?{returnTo:{...modal,childOpener:captureFocus(modalHost,target)}}:{})};renderModal();return;}
      if(item.cost.type==='ad')toast('正在请求广告，完整观看后领取');
      target.disabled=true;target.setAttribute('aria-busy','true');
      const label=target.querySelector('.shop-button-label');
      if(label)label.textContent=item.cost.type==='ad'?'广告加载中…':'领取中…';
      try { await act('shopBuy',{id,token:snapshot.shop.token}); }
      finally { render(true); }
      return;
    }
    if (action === 'shopConfirm') {const review=modal,token=review?.type==='shopConfirm'?review.token:null;if(token){const result=await act('shopBuy',{id,token,quantity:review.quantity||1});if(!result?.ok&&modal?.type==='shopConfirm')renderModal();}return;}
    if (action === 'playerInfo') {modal={type:'playerInfo',profileTab:'equipment'};renderModal();return;}
    if (action === 'playerRename' && modal?.type === 'playerInfo') {
      modal.editingName=true;modal.nameDraft=snapshot.playerName;modal.nameError='';renderModal();
      const input=modalHost.querySelector('[data-player-name]');input?.focus();input?.select();return;
    }
    if (action === 'playerRenameCancel' && modal?.type === 'playerInfo') {
      modal.editingName=false;modal.nameError='';renderModal();modalHost.querySelector('[data-action="playerRename"]')?.focus();return;
    }
    if (action === 'playerRenameSave' && modal?.type === 'playerInfo') {
      const result=await act('renamePlayer',{name:modal.nameDraft,expectedRevision:Number(target.dataset.renameRevision),
        expectedCost:Number(target.dataset.renameCost),expectedName:target.dataset.renameName});
      if(result?.ok){modal.editingName=false;modal.nameError='';pendingModalBackgroundRefresh=true;}
      else modal.nameError=result?.message||'名字未保存，请重试';
      renderModal();modalHost.querySelector(result?.ok?'[data-action="playerRename"]':'[data-player-name]')?.focus();return;
    }
    if(action==='playerInfoTab'&&modal?.type==='playerInfo'){
      if(!PLAYER_INFO_TABS.some(item=>item.id===target.dataset.tab))return;
      modal.profileTab=target.dataset.tab;renderModal();
      modalHost.querySelector('.pl-modal-content')?.scrollTo(0,0);
      modalHost.querySelector(`.pi-tabs [data-tab="${modal.profileTab}"]`)?.focus({preventScroll:true});return;
    }
    if(action==='playerInfoManage'&&modal?.type==='playerInfo'){
      const kind=target.dataset.kind;
      if(kind==='equipment'){switchTab('assembly');return;}
      if(['weapon','aircraft','pilot'].includes(kind)){
        profileCatalogReturn={tab,subpage,modal:{...modal,opener:modalOpener},opener:captureFocus(modalHost,target)};
        openCatalog(kind);
      }
      return;
    }
    if (action === 'catalog') { openCatalog(target.dataset.kind); return; }
    if (action === 'catalogBack') { returnFromCatalog(); return; }
    if (action === 'catalogGrowth') {
      if (!weaponFor(id)) return;
      modal={type:'weaponSkillGroup',id,opener:captureFocus(root,target)}; renderModal(); return;
    }
    if (action === 'catalogSkill') {
      if (!weaponCatalogSkillDetail({weapon:weaponFor(id),key:target.dataset.skill,helpers:referenceContext().helpers})) return;
      modal={type:'weaponSkill',id,skillKey:target.dataset.skill,opener:captureFocus(root,target)}; renderModal(); return;
    }
    if (action === 'catalogSelect') { if (subpage === 'weapon') selectedWeapon = id; else if (subpage === 'aircraft') browseAircraft = id; else browsePilot = id; render(true); return; }
    if (action === 'catalogMode') { catalogSkillTab = target.dataset.mode === 'skills'; if(fleetUi[subpage])Object.assign(fleetUi[subpage],{selectedSkillSlot:null,pendingSkillId:null,filterOpen:false});render(true); return; }
    if(action==='catalogFilter'&&fleetUi[subpage]){fleetUi[subpage].filterOpen=!fleetUi[subpage].filterOpen;render(true);if(fleetUi[subpage].filterOpen)body.querySelector('.fc-filter-options [aria-checked="true"]')?.focus({preventScroll:true});return;}
    if(action==='fleetFilterClose'){if(fleetUi[subpage])fleetUi[subpage].filterOpen=false;render(true);body.querySelector('.fc-filter')?.focus({preventScroll:true});return;}
    if(action==='fleetFilterSet') {catalogFilter=target.dataset.filter;fleetUi[subpage].filterOpen=false;const scroll=body.querySelector('[data-catalog-scroll]');if(scroll)scroll.scrollTop=0;catalogScrollPositions.set(`${subpage}:list`,0);render(true);body.querySelector('.fc-filter')?.focus({preventScroll:true});return;}
    if(action==='fleetSkillCancel'){const slot=fleetUi[subpage]?.selectedSkillSlot;if(fleetUi[subpage])Object.assign(fleetUi[subpage],{selectedSkillSlot:null,pendingSkillId:null});render(true);body.querySelector(`.fc-skill-group [data-slot="${slot??0}"]`)?.focus({preventScroll:true});return;}
    if(action==='fleetSkillSlot') {
      const kind=target.dataset.kind,slot=Number(target.dataset.slot),ui=fleetUi[kind];if(!ui)return;
      if(ui.pendingSkillId){const result=await act('fleetSkillEquip',{kind,id:ui.pendingSkillId,slot,expectedRevision:snapshot.fleet?.revision});if(result?.ok)Object.assign(ui,{pendingSkillId:null,selectedSkillSlot:null});}
      else ui.selectedSkillSlot=catalogSkillTab&&ui.selectedSkillSlot===slot?null:slot;
      catalogSkillTab=true;ui.filterOpen=false;render(true);body.querySelector(`.fc-skill-group [data-slot="${slot}"]`)?.focus({preventScroll:true});return;
    }
    if(action==='fleetSkillEquip') {
      const kind=target.dataset.kind,ui=fleetUi[kind],slots=snapshot.fleet?.[kind]?.slots||[];if(!ui)return;
      const slot=ui.selectedSkillSlot??slots.indexOf(null);
      if(slot<0){ui.pendingSkillId=id;render(true);body.querySelector('.fc-skill-group button')?.focus({preventScroll:true});return;}
      const result=await act('fleetSkillEquip',{kind,id,slot,expectedRevision:Number(target.dataset.revision)});
      if(result?.ok){Object.assign(ui,{selectedSkillSlot:null,pendingSkillId:null});render(true);body.querySelector(`.fc-skill-group [data-slot="${slot}"]`)?.focus({preventScroll:true});}return;
    }
    if(action==='fleetSkillRemove') {const kind=target.dataset.kind,slot=Number(target.dataset.slot),result=await act('fleetSkillRemove',{kind,id,slot,expectedRevision:Number(target.dataset.revision)});if(result?.ok){Object.assign(fleetUi[kind],{selectedSkillSlot:null,pendingSkillId:null});render(true);body.querySelector(`.fc-skill-group [data-slot="${slot}"]`)?.focus({preventScroll:true});}return;}
    if(action==='fleetSkillPreview') {modal={type:'fleetSkill',kind:target.dataset.kind,id,opener:captureFocus(root,target)};renderModal();return;}
    if(action==='fleetUnlock'||action==='fleetStar') {
      const parent=modal?{...modal,childOpener:captureFocus(modalHost,target)}:null;
      modal={type:'fleetOperation',kind:target.dataset.kind,id,operation:action==='fleetUnlock'?'activate':'starUp',opener:captureFocus(root,target),...(parent?{returnTo:parent}:{})};renderModal();return;
    }
    if(action==='fleetConfirm') {
      if(modal?.type!=='fleetOperation')return;
      const operation={...modal},result=await act(modal.operation==='activate'?'fleetActivate':'fleetStarUp',{kind:modal.kind,id:modal.id,expectedRevision:Number(target.dataset.revision)});
      modal={...operation,result:result?.ok?result:undefined,error:result?.ok?'':result?.message||'操作未完成'};renderModal();return;
    }
    if(action==='fleetAcquire') {
      const kind=target.dataset.kind,chosen=fleetItem(kind,id);if(!chosen)return;
      fleetSupplyReturn={kind,id,skillTab:catalogSkillTab,filter:catalogFilter};
      pool='pilot';recruitSelection.pilot=id;modal=null;switchTab('supply');return;
    }
    if(action==='fleetSupplyBack') {
      if(!fleetSupplyReturn)return;const previous=fleetSupplyReturn;fleetSupplyReturn=null;
      tab='assembly';subpage=previous.kind;catalogSkillTab=previous.skillTab;catalogFilter=previous.filter;modal=null;
      if(subpage==='aircraft')browseAircraft=previous.id;else browsePilot=previous.id;
      render(true);body.querySelector('.fc-hero-actions button:not(:disabled)')?.focus({preventScroll:true});return;
    }
    if (action === 'catalogAcquire') { if(target.dataset.kind==='weapon'){switchTab('shop');return;} pool='pilot';if(snapshot.pilots.some(p=>p.id===id))recruitSelection.pilot=id;switchTab('supply');return; }
    if (action === 'sortEquipment') { equipmentSortDescending = !equipmentSortDescending; render(true); return; }
    if (action === 'innateInfo') { modal = {type:'innateInfo',id}; renderModal(); return; }
    if (action === 'openWorkshop') { if(!id){openGearWorkshop(null,target);return;}workshopKind='weapon';workshopMode=target.dataset.mode==='quality'?'quality':'level';catalogWorkshopReturn=subpage==='weapon'?{skillTab:catalogSkillTab,weaponId:selectedWeapon,opener:captureFocus(root,target)}:null;if(tab==='assembly'&&!subpage)equipmentReturnFocus=captureFocus(root,target);if(equipmentPickingSlot){restoreEquipmentContext(equipmentPickContext);equipmentPickingSlot=false;equipmentPickContext=null;}tab = 'assembly'; subpage = 'workshop'; workshopId = id || null; workshopRevealSelection=Boolean(id); workshopFilter = 'all'; modal = null; render(true); return; }
    if (action === 'workshopSelect') { workshopId = id; render(true); return; }
    if (action === 'workshopMode') { workshopMode = target.dataset.mode === 'quality' ? 'quality' : 'level'; workshopFilter = 'all'; render(true); body.querySelector(`.ws-modes [data-mode="${workshopMode}"]`)?.focus({preventScroll:true}); return; }
    if (action === 'workshopChoose') { body.querySelector('.ref-warehouse')?.scrollTo({top:0,behavior:'smooth'}); body.querySelector('.ref-warehouse .eq-card')?.focus({preventScroll:true}); return; }
    if (action === 'workshopFilter') { modal={type:'workshopFilter',opener:captureFocus(root,target)};renderModal();return; }
    if (action === 'workshopFilterSelect') { if(!(workshopKind==='gear'?['all','1','2','3','4','5']:WORKSHOP_FILTERS).includes(target.dataset.filter))return;workshopFilter=target.dataset.filter;modal=null;render(true);return; }
    if (action === 'workshopSynthesize') { await act('synthesizeWeapon', {id,expectedQualityRank:Number(target.dataset.rank)}); return; }
    if (action === 'workshopBatch') { const plan = snapshot.workshop?.batch; if (plan?.steps?.length) { modal = {type:'workshopBatch',plan:structuredClone(plan)}; renderModal(); } return; }
    if (action === 'workshopConfirmBatch') { const token = modal?.plan?.token; if (token) { modal = null; await act('synthesizeAll',{token}); } return; }
    if (action === 'patrolQuick' && modal?.type === 'patrol') {modal={type:'quickPatrol',returnTo:{...modal,childOpener:captureFocus(modalHost,target)}};renderModal();return;}
    if (action === 'patrol') {const lock=patrolUnlockMessage();if(lock){toast(lock);return;}patrolScrollPositions.clear();modal={type:'patrol',...(['activities','nativeLab'].includes(modal?.type)?{returnTo:{...modal,childOpener:captureFocus(modalHost,target)}}:{})};renderModal();return;}
    if (['stages', 'chapters', 'formation', 'stamina', 'backpack'].includes(action)) { modal = { type: action }; renderModal(); return; }
    if (action === 'browsePilot') { browsePilot = id; render(true); return; }
    if (action === 'browseAircraft') { browseAircraft = id; render(true); return; }
    if (action === 'growthWeapon') { selectedWeapon = id; render(true); return; }
    if (action === 'growthKind') { growthKind = target.dataset.kind; render(true); return; }
    if (action === 'pool') {
      if(target.dataset.pool!=='pilot'||pool==='pilot')return;
      pool = target.dataset.pool; render(true);
      // Reveal the selected card horizontally without pulling the portrait or
      // pool toolbar out of view in the outer vertical scrollport.
      const strip=body.querySelector('.rc-preview-strip'), card=strip?.querySelector('.rc-preview-card.is-selected');
      if(strip&&card)strip.scrollLeft+=card.getBoundingClientRect().left-strip.getBoundingClientRect().left-(strip.clientWidth-card.offsetWidth)/2;
      body.querySelector(`.rc-pool-tab[data-pool="${pool}"]`)?.focus({preventScroll:true});
      return;
    }
    if (action === 'pilotInfo') { modal = { type: action, id }; renderModal(); return; }
    if (action === 'featurePilot') { browsePilot = id; recruitSelection.pilot=id;pool = 'pilot'; modal = null; switchTab('supply'); return; }
    if (action === 'aircraftInfo') { modal = { type: action, id }; renderModal(); return; }
    if (action === 'weapon' || action === 'weaponInfo') { openWeaponDetails(id,target,action==='weaponInfo'); return; }
    if (action === 'pickSlot') { if (WEAPON_EQUIP_SLOTS.includes(target.dataset.slot)) {if(modal?.type==='weapon')modal.targetSlot=target.dataset.slot;else selectedSlot=target.dataset.slot;} renderModal(); return; }
    if (action === 'slot') { selectedSlot = target.dataset.slot; const w = weaponFor(snapshot.loadout[selectedSlot]); if (w) { selectedWeapon = w.id; modal = {type:'weapon',id:w.id}; renderModal(); } else openCatalog('weapon'); return; }
    if (action === 'selectPilot') { await act('selectPilot', { id, pilotId: id }); return; }
    if (action === 'selectAircraft') { const a = snapshot.aircraft.find(a => a.id === id); if (!a?.owned) { pool = 'pilot'; switchTab('supply'); return; } await act('selectAircraft', { id, aircraftId: id }); return; }
    if (action === 'catalogEquipWeapon') {
      const w=weaponFor(id);if(!w?.owned){switchTab('shop');return;}
      const free=WEAPON_EQUIP_SLOTS.find(slot=>!snapshot.loadout[slot]);
      if(!free){openWeaponDetails(id,target,false,true);return;}
      await act('equipWeapon',{id,weaponId:id,slot:free,expectedToken:snapshot.loadoutToken});return;
    }
    if (action === 'equipWeapon') { const w = weaponFor(id); if (!w?.owned) { switchTab('shop'); return; } const slot = modal?.requireSlotSelection?modal.targetSlot:modal?.targetSlot || selectedSlot;if(!slot){toast('选择要替换的位置');return;} const result = await act('equipWeapon', { id, weaponId: id, slot, slotId: slot,expectedToken:modal?.loadoutToken??snapshot.loadoutToken }); if(result?.ok){closeWeaponDetails(slot);actionFeedback.equip(slot);}return; }
    if (action === 'unequipWeapon') { const slot=target.dataset.slot;const result=await act('equipWeapon', { id:null,weaponId:null,slot,slotId:slot,expectedToken:modal?.loadoutToken??snapshot.loadoutToken });if(result?.ok)closeWeaponDetails(slot);return; }
    if (action === 'stage') { const index=Number(target.dataset.index); await act('selectStage', { index, stageIndex: index }); battleChapter=index; modal = null; render(true); return; }
    if (action === 'upgrade' && snapshot.replicaCollection) {
      modal=null;subpage=target.dataset.kind==='aircraft'?'aircraft':'weapon';catalogSkillTab=false;nativeAppearanceOnly=false;render(true);return;
    }
    if (action === 'upgrade') { await act(target.dataset.kind === 'aircraft' ? 'upgradeAircraft' : 'upgradeWeapon', { id }); return; }
    if (action === 'recruit') { await act('pilotSupply', { action:'draw', count:Number(target.dataset.count), expectedRevision:snapshot.pilotSupply?.revision }); return; }
    if (action === 'claimSignIn') { await act('claimSignIn'); return; }
    if (action === 'claimTask') { const result=await act('claimTask', { id });if(result?.ok)modalHost.querySelector(`[data-task-id="${id}"]`)?.focus({preventScroll:true});return; }
    if (['claimPatrol','quickPatrol','quickPatrolAd','devPatrolSample'].includes(action)) { await act(action,{expectedRevision:Number(target.dataset.revision)}); return; }
    if (action === 'start') {
      const index = battleChapterIndex(snapshot, battleChapter);
      const result = await act('start', { index, stageIndex: index });
      if (result?.ok && !result.started) bridge.startGame?.();
    }
  });
  function keydown(event) {
    if (!visible) return;
    if(modal?.type==='playerInfo'&&modal.editingName&&event.target.matches?.('[data-player-name]')&&!event.isComposing&&event.key==='Enter'){
      event.preventDefault();modalHost.querySelector('[data-action="playerRenameSave"]')?.click();return;
    }
    if(modal?.type==='playerInfo'&&modal.editingName&&event.key==='Escape'){
      event.preventDefault();modalHost.querySelector('[data-action="playerRenameCancel"]')?.click();return;
    }
    if(modal?.type==='playerInfo'&&event.target.closest?.('.pi-tabs')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      event.preventDefault();const current=PLAYER_INFO_TABS.findIndex(item=>item.id===(modal.profileTab||'equipment'));
      const index=event.key==='Home'?0:event.key==='End'?PLAYER_INFO_TABS.length-1:(current+(event.key==='ArrowLeft'?-1:1)+PLAYER_INFO_TABS.length)%PLAYER_INFO_TABS.length;
      modalHost.querySelector(`.pi-tabs [data-tab="${PLAYER_INFO_TABS[index].id}"]`)?.click();return;
    }
    if (event.target.closest?.('[data-action="portraitFeedback"]') && ['Enter',' '].includes(event.key)) {
      event.preventDefault();event.target.closest('[data-action="portraitFeedback"]').click();return;
    }
    if (modal && polishedTab()) trapModalTab(event, modalHost.querySelector('.bag-detail') || modalHost.querySelector('.pl-modal'));
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
    const fleetState=fleetUi[subpage];
    if(fleetState?.filterOpen&&['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      const options=[...body.querySelectorAll('.fc-filter-options button')],current=options.indexOf(document.activeElement);
      if(options.length){event.preventDefault();const step=event.key==='ArrowDown'?2:event.key==='ArrowUp'?-2:event.key==='ArrowLeft'?-1:1;const next=event.key==='Home'?0:event.key==='End'?options.length-1:(current+step+options.length)%options.length;options[next]?.focus();}return;
    }
    if (event.key !== 'Escape') return;
    if(!modal&&fleetState?.filterOpen){fleetState.filterOpen=false;render(true);body.querySelector('.fc-filter')?.focus({preventScroll:true});return;}
    if(!modal&&fleetState&&(fleetState.selectedSkillSlot!=null||fleetState.pendingSkillId)){const slot=fleetState.selectedSkillSlot;Object.assign(fleetState,{selectedSkillSlot:null,pendingSkillId:null});render(true);body.querySelector(`.fc-skill-group [data-slot="${slot??0}"]`)?.focus({preventScroll:true});return;}
    if (busy && polishedTab()) return;
    if (closeBackpackDetail()) return;
    if(modal?.type==='tasks' && modal.milestoneId){delete modal.milestoneId;renderModal();return;}
    if(returnToParentModal())return;
    if(closeFleetOperation())return;
    if (modal?.type==='weapon') closeWeaponDetails();
    else if (modal) { modal = null; renderModal(); }
    else if (subpage) returnFromCatalog();
    else if (equipmentPickingSlot) cancelEquipmentPicking();
  }
  window.addEventListener('keydown', keydown);
  render(true);
  return {
    root,
    get tab() { return tab; }, get snapshot() { return snapshot; },
    get state() { return { tab, subpage, catalogSkillTab, catalogFilter, visible, modal: modal?.type || null, selectedSlot, selectedWeapon, pool, growthKind, workshopId }; },
    switchTab, render() { render(true); }, refresh() { render(true); },
    setVisible(value) { visible = Boolean(value); root.hidden = !visible; root.setAttribute('aria-hidden', String(!visible)); portraitPlayer.setVisible(visible&&!modal); models.update(0, visible); if (!visible) { onboarding.hide(); actionFeedback.clear(); stateFeedback.clear(); uiMotion.clear(); } if (visible) render(); },
    update(ticker) { if (destroyed || !visible || document.hidden) return; performanceMonitor.frame('lobby'); return performanceMonitor.measure('ui',()=>{const dt = typeof ticker === 'number' ? ticker : (ticker?.deltaMS || 16.67) / 1000; elapsed += dt; onboarding.tick(dt);
      // Retain the last aircraft frame while its whole hangar is being scrolled.
      if (!visible || !root.querySelector('.drag-scroll-active .pl-model-canvas')) models.update(dt, visible && (!modal || Boolean(modalHost.querySelector('[data-model-aircraft],.pl-model-canvas'))));
      if (elapsed >= 1) { elapsed %= 1; render(); } }); },
    destroy() { destroyed = true; onboarding.destroy(); actionFeedback.destroy(); stateFeedback.clear(); uiMotion.destroy(); clearTimeout(toastTimer); clearTimeout(debugClearTimer); window.removeEventListener('keydown', keydown); releaseHoloCards(); releaseEquipmentChoices(); portraitPlayer.destroy(); models.destroy(); root.remove(); },
  };
}
