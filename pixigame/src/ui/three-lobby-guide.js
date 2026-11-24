import {nextLobbyGuide,guideFinished,reachedGuideProgress} from '../peripheral/onboarding.js';
export function createThreeLobbyGuide({hidden,context,mark,home}){
  let active=null,idle=0,weakChapter=null,marking=false;
  function hide(){home()?.setGuide(null);}
  function destination(c){
    const g=active.group,m=c.modal;
    if(m){
      if(g===8&&m.type==='shopBoxResult')return ['close','点击空白处关闭'];
      if(g===8&&m.type==='shopBoxConfirm'&&m.pool===active.pool&&m.count===1)return ['open-box','开启宝箱'];
      if((g===9||g===14)&&m.type==='gearDetail'&&m.id===active.uid){
        if(g===14&&m.detailOrigin!=='slot')return ['close','返回装备槽升级'];
        return g===9?['gearEquip','装配这件装备']:['gearUpgrade','升级已装配的装备'];
      }
      return;
    }
    if(c.subpage)return;
    if(g===8){if(c.tab!=='shop')return ['nav-shop','进入商城'];if(c.shopSection!=='boxes')return ['section-boxes','查看装备宝箱'];return ['open-'+active.pool+'-1','开启1次'];}
    if(c.tab!=='assembly')return ['nav-assembly','进入装备页'];if(c.gearFilter!=='all')return ['clear-filter','查看全部装备'];
    return ['gear-'+active.uid,g===9?'查看这件装备':'点击已装配的装备'];
  }
  return {hide,hideWeakHint(){if(!active)hide();},tick(dt){
    const c=context(),s=c.snapshot,v=home();if(!v||!s||!c.visible||c.busy||hidden()){hide();return;}
    if(active&&guideFinished(s,active.group)&&active.group!==14&&!(active.group===8&&c.modal?.type==='shopBoxResult'))active=null;
    if(active&&[9,14].includes(active.group)&&!s.equipment?.items?.some(i=>i.uid===active.uid&&(active.group===9?!i.equipped:i.equipped&&i.canUpgrade)))active=null;
    if(!active&&!c.modal&&!c.subpage)active=nextLobbyGuide(s);
    if(active){const dest=destination(c);if(!dest||c.modal&&!v.canGuidePanel?.(dest[0])){hide();return;}
      v.setGuide({id:dest[0],text:dest[1],strong:true,modal:!!c.modal});
      if(active.group===14&&!guideFinished(s,14)&&!marking){marking=true;Promise.resolve(mark(14,active.uid)).finally(()=>{marking=false;});}return;}
    const chapter=(c.chapterIndex??s.selectedStageIndex??0)+1;
    if(weakChapter!==chapter){weakChapter=chapter;idle=0;}idle+=Math.max(0,dt);
    if(!c.modal&&!c.subpage&&c.tab==='battle'&&chapter<=3&&!reachedGuideProgress(s.replicaCampaign,4)&&(chapter===1&&!guideFinished(s,1)||idle>=60)&&!s.rewardPending&&!s.rewardBusy){v.setGuide({id:'start',text:'点击出战',strong:false,modal:false});return;}hide();
  },result(action,payload,result){if(!result?.ok||!active)return;
    if(active.group===8&&action==='gearSupply'&&Number(payload.count)===1)active={...active,receipt:true};
    if(active.group===14&&action==='gearUpgrade'&&String(payload.id||payload.uid)===active.uid){active=null;hide();}},destroy:hide};
}
