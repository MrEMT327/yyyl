import {openBackpack} from './backpack-scene.js';
import {openGearPanel,supportsGearPanel} from './gear-panel.js';
import {openCollectionPanel,supportsCollectionPanel} from './collection-panel.js';
import {openSupplyPanel,supportsSupplyPanel} from './supply-panel.js';
import {openUtilityPanel,supportsUtilityPanel} from './utility-panel.js';
import {openFleetPanel,supportsFleetPanel} from './fleet-panels.js';
import {createItemInspection} from './item-inspection.js';
import {openChapterPanel,supportsChapterPanel} from './chapter-panel.js';
import {openRewardReceipt} from './reward-receipt.js';
import {openBoxOpening} from './box-opening.js';
import {openProcessFeedback} from './process-feedback.js';
import {openRecruitPreview} from './recruit-preview.js';
import {openRecruitResults} from './recruit-results.js';
import {openAffection} from './affection.js';
import {PILOT_AFFECTION_VISIBLE} from '../../peripheral/pilot-affection.js';
import {openResearchPanel} from './research-panel.js';
import {openLabPanel} from './lab-panel.js';
import {openProfilePanel} from './profile-panel.js';
import {openTaskPanel} from './task-panel.js';
import {openCarnivalPanel} from './carnival-panel.js';
import {openPatrolPanel} from './patrol-panel.js';
import {openShopPanel,supportsShopPanel} from './shop-panels.js';

const lobbyPanelTypes=['tasks','carnival','patrol','quickPatrol','playerInfo','recruitRewards',
  'researchSummary','researchCard','researchResult','nativeLab','nativeStats',
  ...(PILOT_AFFECTION_VISIBLE?['pilotAffection','pilotAffectionVideo']:[])];

export function lobbyPanels(device, {openVideo, preparePanelArtwork, inspectItems = (container,read)=>createItemInspection(device,container,read)}={}){
  return {
    openBackpack:(host,action)=>openBackpack(device,host,action),
    inspectItems,
    lobbyPanelKind:(type,snapshot)=>supportsFleetPanel(type)?'fleet':supportsUtilityPanel(type)?'utility':supportsSupplyPanel(type)?'supply':supportsCollectionPanel(type)?'collection':type==='gearDetail'?type:supportsGearPanel(type)?'gear':lobbyPanelTypes.includes(type)||supportsShopPanel(type)||supportsChapterPanel(type,snapshot)?type:null,
    openLobbyPanel(kind,host,send,scrollPositions,sound,options){
      if(kind==='fleet')return openFleetPanel(device,host,send);
      if(kind==='utility')return openUtilityPanel(device,host,send);
      if(kind==='supply')return openSupplyPanel(device,host,send);
      if(kind==='collection')return openCollectionPanel(device,host,send);
      if(['researchSummary','researchCard','researchResult'].includes(kind))return openResearchPanel(device,host,send,sound);
      if(kind==='nativeLab'||kind==='nativeStats')return openLabPanel(device,host,send);
      if(kind==='gear')return openGearPanel(device,host,send);
      if(kind==='playerInfo')return openProfilePanel(device,host,send);
      if(kind==='recruitRewards')return openRecruitPreview(device,host,send);
      if(kind==='pilotAffection')return PILOT_AFFECTION_VISIBLE?openAffection(device,host,send):null;
      if(kind==='pilotAffectionVideo')return PILOT_AFFECTION_VISIBLE?openVideo(host,send):null;
      if(supportsShopPanel(kind))return openShopPanel(device,host,send,kind);
      if(kind==='tasks'||kind==='carnival'||kind==='gearDetail'){
        const activate=Boolean(preparePanelArtwork&&!options?.prepareArtwork);
        const config=activate?{prepareArtwork:preparePanelArtwork,completeEntry:true}:options;
        const panel=kind==='gearDetail'?openGearPanel(device,host,send,{allowMissingArtwork:true,...config}):
          kind==='tasks'?openTaskPanel(device,host,send,kind,scrollPositions,config):openCarnivalPanel(device,host,send,config);
        if(activate)panel.activate();
        return panel;
      }
      if(kind==='patrol'||kind==='quickPatrol')return openPatrolPanel(device,host,send,kind,scrollPositions);
      return openChapterPanel(device,host,send,kind);
    },
    openRewardReceipt:(host,send,sound)=>openRewardReceipt(device,host,send,sound),
    openBoxOpening:(host,send,sound)=>openBoxOpening(device,host,send,sound),
    openProcessFeedback:(host,send,sound)=>openProcessFeedback(device,host,send,sound),
    openRecruitResults:(host,send,sound)=>openRecruitResults(device,host,send,sound),
    openTaskChestPreview:(host,send)=>openTaskPanel(device,host,send,'taskChestPreview'),
    openPatrolReceipt:(host,send)=>openPatrolPanel(device,host,send,'patrolReceipt'),
  };
}
