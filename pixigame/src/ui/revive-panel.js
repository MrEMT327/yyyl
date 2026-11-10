import {Container,Graphics,Rectangle} from '../three/display.js';
import {COMBAT_UI} from './combat-theme.js';
import {paintPsdPopup} from './psd-popup-art.js';
import {paintPsdPopupTitle} from './psd-popup-title.js';
import {REVIVE_ART,paintReviveArt,paintReviveSymbol} from './revive-panel-art.js';
import {REVIVE_PANEL,revivePanelState,reviveTouchBounds} from './revive-panel-model.js';

export function updateReviveTouchTargets(refs,canvasWidth=600){
  if(refs.reviveTouchWidth===canvasWidth)return;
  refs.reviveTouchWidth=canvasWidth;
  for(const [control,rect] of refs.reviveControls||[]){
    const area=reviveTouchBounds(rect,canvasWidth);
    control.hitArea=new Rectangle(area.x,area.y,area.width,area.height);
  }
}
export function clearRevivePanel(refs){
  refs.reviveMotion?.panel.destroy({children:true});
  for(const key of ['reviveMotion','reviveControls','reviveTouchWidth','revive','reviveRing'])delete refs[key];
}

export function renderRevivePanel(root,bridge,refs,{surface,button,text,place,backdrop}){
  const state=revivePanelState(bridge);
  if(!state.visible)return;
  const panel=new Container();panel.label='combat-revive-panel';root.addChild(panel);
  const key=`${bridge.game.runId}:${bridge.game.revivesUsed||0}`;
  if(bridge.ui.reviveMotionKey!==key){bridge.ui.reviveMotionKey=key;bridge.ui.reviveStartedAt=performance.now();}
  refs.reviveMotion={panel,start:bridge.ui.reviveStartedAt};
  if(!bridge.presentation?.fullStageReviveBackdrop)backdrop(panel,COMBAT_UI.ink,.78);
  const {x,y,width,height}=REVIVE_PANEL.frame;
  surface(panel,s=>{
    paintPsdPopup(s,'primary',x,y,width,height);
    paintReviveArt(s);
    paintPsdPopupTitle(s,'primary','复活',x,y,width,height);
  });
  refs.reviveRing=new Graphics();panel.addChild(refs.reviveRing);
  refs.revive=place(panel,text(String(state.countdown),{
    size:72,fill:0xf0fbff,weight:'900',anchorX:.5,anchorY:.5,
  }),REVIVE_ART.countdownX,REVIVE_ART.countdownY+17);
  const close=button({...REVIVE_PANEL.close,text:'',disabled:state.pending,
    onPress:()=>{const current=revivePanelState(bridge);if(current.visible&&!current.pending)bridge.declineRevive();}});
  close.label=close.__combatLabel='关闭复活';
  refs.reviveControls=[[close,REVIVE_PANEL.close]];
  // A close pictogram is an image control, never a blue operation button.
  close.children[0].visible=false;
  surface(close,s=>{paintReviveSymbol(s,'close',0,0,68).material.opacity=state.pending ? .55 : 1;});
  panel.addChild(close);
  for(const free of [false,true]){
    const enabled=free?state.freeEnabled:state.diamondEnabled;
    const action=button({...REVIVE_PANEL[free?'free':'diamond'],text:'',
      art:free?'secondary':'primary',preserveArtOnDisable:true,hideFallback:true,disabled:!enabled,
      onPress:()=>{
        const current=revivePanelState(bridge);
        if(current.visible&&(free?current.freeEnabled:current.diamondEnabled))
          free?bridge.requestAdRevive():bridge.requestDiamondRevive();
      }});
    action.label=action.__combatLabel=free?'免费复活':`${state.cost.toLocaleString('zh-CN',{useGrouping:false})}钻石复活`;
    refs.reviveControls.push([action,REVIVE_PANEL[free?'free':'diamond']]);
    surface(action,s=>{
      if(free)paintReviveSymbol(s,'ad-play',39,11,52);
      else s.resourceIcon('diamonds',66,19,36);
      s.text(free?'免费':state.cost.toLocaleString('zh-CN',{useGrouping:false}),free?139:142,37,
        {size:30,align:'center',weight:700,color:enabled?'#fff7e4':'#bbcbd5',maxWidth:110});
    });
    panel.addChild(action);
  }
  updateReviveTouchTargets(refs,bridge.app?.renderer?.canvas?.getBoundingClientRect?.().width||600);
}
