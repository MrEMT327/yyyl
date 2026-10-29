import iconRegions from './sortie-icons-v2.json' with { type: 'json' };
import { drawUiSymbol, drawRank } from './ui-symbols.js';
const NAV = [['loadout','战姬'],['assembly','武器'],['battle','出击'],['upgrade','升级'],['supply','招募']];
const INK='#25313e';
const fmt=value=>Math.max(0,Math.round(Number(value)||0)).toLocaleString('en-US');

export function createMobileUI(surface,bridge,art,actions) {
  const {text,quad,panel,polygon,image,button}=surface;
  const texture=id=>art.get(id);
  const action = (id,label,x,y,w,h,onPress,style={}) => button(id,label,x,y,w,h,()=>{bridge.unlockAudio?.();onPress();},{stroke:null,cut:0,opacity:0,...style});
  const plate = (x,y,w,h,fill,bottomColor=fill,radius=8,opacity=1) => panel(x,y,w,h,{fill,bottomColor,stroke:null,cut:0,radius,opacity});
  function gameIcon(id,x,y,w,h,opacity=1) {
    const source=texture('icons'),crop=iconRegions[id];if(!source||!crop)return;
    const ratio=crop.width/crop.height,drawWidth=Math.min(w,h*ratio),drawHeight=drawWidth/ratio;
    const mesh=image(source,x+(w-drawWidth)/2,y+(h-drawHeight)/2,drawWidth,drawHeight,crop);
    mesh.material.opacity=opacity;
  }
  function coin(x,y,size=17) { surface.resourceIcon('coins',x-size/2,y-size/2,size); }
  function diamond(x,y,size=15) { surface.resourceIcon('diamonds',x-size/2,y-size/2,size); }
  const symbol=(key,x,y,size,color)=>drawUiSymbol(surface,key,x,y,size,color);
  const rank=(level,x,y,options)=>drawRank(surface,level,x,y,options);
  return {...surface,action,plate,gameIcon,coin,diamond,symbol,rank};
}

export function renderMobileHeader(ui,bridge,art,actions) {
  const {plate,image,action,text,coin,diamond}=ui;
  const pilot=bridge.getActivePilot(),texture=id=>art.get(id);
  plate(19,22,82,82,'#a8b8cb','#526179',14);
  plate(22,25,76,76,'#202b3b','#202b3b',12);
  if(texture('pilot')) {
    const focus=pilot.portraitFocus||{},width=1/(focus.zoom||3.6);
    image(texture('pilot'),25,28,70,70,pilot.avatar ? null : {x:Math.max(0,Math.min(1-width,(focus.x||50)/100-width/2)),y:(focus.y||0)/100,width,height:width*2/3});
  }
  action('pilot-change','切换战姬',17,19,270,88,()=>actions.tab('loadout'));
  text(pilot.name,113,44,{size:24,weight:800,maxWidth:175});
  text(`Lv.${bridge.profileState.fighterLevel}`,115,78,{size:16,color:'#c0cfdb',weight:700});
  plate(169,68,91,20,'#d1b375','#917349',3);text(pilot.rarity,215,78,{size:14,color:'#202a39',weight:800,align:'center'});
  plate(303,30,121,40,'#131e2d','#263547',20,.9);coin(320,50,20);
  text(fmt(bridge.profileState.coins),409,50,{size:22,weight:700,align:'right',maxWidth:76});
  plate(442,30,139,40,'#131e2d','#263547',20,.9);diamond(454,49,19);
  text(fmt(bridge.profileState.diamonds),533,50,{size:22,weight:700,align:'right',maxWidth:60});
  plate(543,29,39,42,'#f4f1df','#bbc7ca',9);text('+',563,49,{size:29,color:INK,weight:700,align:'center'});
  action('diamonds','观看广告获得20钻石',439,25,146,69,()=>bridge.requestAdDiamonds(),{disabled:bridge.rewardedAdPending});
  ui.symbol('video',483,78,19,'#c1d6e4');
  text('+20',551,87,{size:15,color:'#c1d6e4',align:'right'});diamond(566,87,12);

}

export function renderMobileNav(ui,actions,active) {
  const {plate,action,gameIcon,text}=ui;
  plate(0,1213,600,87,'#273548','#172437',0);
  NAV.forEach(([id,label],i)=>{
    const selected=id===active,x=i*120;
    if(selected)plate(x+8,1195,104,105,'#f5f2e9','#bccbd4',10);
    action(`nav-${id}`,label,x+4,selected?1195:1209,112,selected?105:91,()=>actions.tab(id));
    gameIcon(id,x+29,selected?1200:1217,62,selected?59:45,selected?1:.8);
    text(label,x+60,1281,{size:20,color:selected?INK:'#c6d0dc',weight:800,align:'center'});
  });
}
