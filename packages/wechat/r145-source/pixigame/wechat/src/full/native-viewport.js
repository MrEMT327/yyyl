// The native screen is already the game viewport. Insets protect controls,
// not the outer scene: a desktop aspect-ratio frame creates black gutters.
export function installNativeViewport(host, info) {
  const width=host.width,height=host.height,safe=info.safeArea;
  let menu;try{menu=host.api.getMenuButtonBoundingClientRect?.();}catch{}
  const number=value=>Number.isFinite(value)?Math.max(0,value):0;
  const menuBottom=menu?.width>0&&menu?.height>0?number(menu.bottom):0;
  const top=Math.min(height/3,Math.max(number(safe?.top),menuBottom?menuBottom+2:0));
  const bottom=Math.min(height/3,number(height-(safe?.bottom??height)));
  const headerHeight=52;
  const equipment='html.wechat-fullscreen #gameShell #gui-casual-lobby.equipment-reference[data-subpage=""]';
  const navigation='html.wechat-fullscreen #gameShell #gui-casual-lobby .pl-nav.lobby-nav';
  const hangarBottom=top+headerHeight+width*1.075;
  const equipmentArtHeight=hangarBottom*1624/900;
  // Give a clipped inventory a single scrollport with the hangar, between the
  // fixed header and navigation. Leave the existing list scroll on tall screens.
  const compactEquipment=height-bottom-width*.2013333333
    <hangarBottom+Math.max(44,width*.1426666667)+width*.18;
  const environment={
    'safe-area-inset-top':top,'safe-area-inset-bottom':bottom,
    'safe-area-inset-left':number(safe?.left),'safe-area-inset-right':number(width-(safe?.right??width)),
  };
  const doc=host.document;doc.documentElement.classList.add('wechat-fullscreen');
  for(const[name,value]of Object.entries(environment))doc.documentElement.style.setProperty('--'+name,`${value}px`);
  doc.documentElement.style.setProperty('--mobile-ui-top-gap','0px');
  const style=doc.createElement('style');style.id='wechat-native-viewport';
  style.textContent=`
html.wechat-fullscreen .arcade{display:block!important;width:100%;height:100%;padding:0!important;gap:0!important}
html.wechat-fullscreen #gameShell,
html.wechat-fullscreen #gameShell #gui-casual-lobby,
html.wechat-fullscreen #gameShell #gui-casual-lobby>.pl-shell{
 width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;
 min-width:0!important;min-height:0!important;aspect-ratio:auto!important;margin:0!important;
 border:0!important;border-radius:0!important;box-shadow:none!important;
}
html.wechat-fullscreen #gameShell #gui-casual-lobby{--lobby-frame-width:${width}px}
html.wechat-fullscreen .performance-tools,html.wechat-fullscreen .performance-hud{display:none!important}

/* The header owns its title and wallet; shell padding only moves grid rows. */
html.wechat-fullscreen #gameShell #gui-casual-lobby:not(.battle-psd-main)>.pl-shell{
 padding-top:env(safe-area-inset-top)!important;
}
html.wechat-fullscreen #gameShell #gui-casual-lobby .pl-header:has(>.lobby-resources){
 position:relative!important;height:${headerHeight}px!important;min-height:${headerHeight}px!important;
}
html.wechat-fullscreen #gameShell #gui-casual-lobby .pl-header>.lobby-page-heading{
 top:4px!important;width:28.2cqw!important;
}
html.wechat-fullscreen #gameShell #gui-casual-lobby .pl-header>.lobby-resources{top:4px!important}
html.wechat-fullscreen #gameShell #gui-casual-lobby .pl-resource-host{top:env(safe-area-inset-top)!important}

/* Extend the equipment backdrop above the hangar to cover the new inset.
   The divider is at row 900 of the 1624-pixel PSD backdrop. */
${equipment}>.pl-shell::before{
 height:${compactEquipment?top+headerHeight:hangarBottom}px;background-size:100% ${equipmentArtHeight}px;
}
${equipment} .pl-header{
 background:none!important;
}
${compactEquipment?`
${equipment} .pl-body{overflow-x:hidden!important;overflow-y:auto!important}
${equipment} .ag-page{height:auto!important}
${equipment} .ag-hangar.eq-hangar{
 background:url('/art/psd-equipment-v1/equipment-background.webp') center ${-top-headerHeight}px / 100% ${equipmentArtHeight}px no-repeat;
}
${equipment} .ag-inventory.eq-inventory{flex:1 0 auto;min-height:18cqw;overflow:visible}
${equipment} .ag-grid{min-height:0}
`:''}

/* Carry the rail texture and its edge through the bottom inset. The tab
   buttons keep their original height above the system gesture area. */
${navigation}{
 background-color:#060d11!important;
 background-size:100% 100%,100% 100%!important;
 background-blend-mode:normal!important;
}
${navigation}>.lobby-nav-tab:not(.is-active) .psd-nav-icon{
 top:1.533333cqw!important;
}
${navigation}>.lobby-nav-tab>span{
 display:block!important;
 inset:auto auto 1.2cqw 50%!important;
 color:#bfdbe7!important;
 font-size:clamp(10px,3.133333cqw,14px)!important;
 font-weight:700!important;
 line-height:1.12!important;
 pointer-events:none;
}
${navigation}>.lobby-nav-tab.is-active>span{
 color:#fff!important;
 font-size:clamp(11px,3.466667cqw,15px)!important;
 font-weight:900!important;
}
/* Page chrome supplies the stationary shop scene. The scrollport is clear. */
html.wechat-fullscreen #gameShell #gui-casual-lobby[data-tab="shop"][data-subpage=""] .shop-native-v2 .store-scroll{
 background-blend-mode:normal!important;
}
/* Keep the thumbnail portrait, rarity and PSD frame without the large card's
   masked lighting passes. Draw and detail cards use their own layouts. */
html.wechat-fullscreen #gameShell #gui-casual-lobby .recruit-collection-strip .rc-preview-card :is(.phc-depth,.phc-radiance,.phc-sparks),
html.wechat-fullscreen #gameShell #gui-casual-lobby .recruit-collection-strip .rc-preview-card .phc-edge-light::after{
 display:none!important;
}
/* The game shell already supplies the fallback behind the opaque home scene. */
html.wechat-fullscreen #gameShell #gui-casual-lobby.battle-psd-main :is(.pl-shell,.pl-body,.psd-main-page){
 background:none!important;
}
html.wechat-fullscreen #gameShell #gui-casual-lobby .psd-main-page{
 top:${top}px!important;bottom:${bottom}px!important;height:auto!important;overflow:visible!important;
}
html.wechat-fullscreen #gameShell #gui-casual-lobby .psd-main-composite{
 top:${-top}px!important;height:${height}px!important;
}
html.wechat-fullscreen #gameShell #gui-casual-lobby .psd-main-composite:not(.psd-main-shades){
 object-fit:cover;
}
/* Center the wallet plates on the profile and keep the row just below the capsule. */
html.wechat-fullscreen #gameShell #gui-casual-lobby .psd-hit-profile{top:2px!important}
html.wechat-fullscreen #gameShell #gui-casual-lobby .psd-main-page>.lobby-resources{
 top:calc(2px + 1.066667cqw)!important;
}
html.wechat-fullscreen #gameShell #gui-casual-lobby .psd-hit-start,
html.wechat-fullscreen #gameShell #gui-casual-lobby .psd-hit-patrol,
html.wechat-fullscreen #gameShell #gui-casual-lobby .psd-hit-backpack{
 top:auto!important;bottom:calc(20.133333cqw + 4px)!important;
}
html.wechat-fullscreen #gameShell #gui-casual-lobby .psd-hit-start{height:15.6cqw!important}
html.wechat-fullscreen #gameShell #gui-casual-lobby .psd-hit-patrol{height:14.8cqw!important}
html.wechat-fullscreen #gameShell #gui-casual-lobby .psd-hit-backpack{height:12.266667cqw!important}
/* The pilot shortcut shares the backpack's column. Anchor it to that row
   so a shorter screen cannot place it over the backpack. */
html.wechat-fullscreen #gameShell #gui-casual-lobby .psd-hit-switch-pilot{
 top:auto!important;bottom:calc(20.133333cqw + 12.266667cqw + 8px)!important;height:19.6cqw!important;
}
`;
  doc.head.append(style);
  return environment;
}
