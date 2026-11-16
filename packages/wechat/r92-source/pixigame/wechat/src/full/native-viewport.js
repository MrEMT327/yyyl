// The native screen is already the game viewport. Insets protect controls,
// not the outer scene: a desktop aspect-ratio frame creates black gutters.
export function installNativeViewport(host, info) {
  const width=host.width,height=host.height,safe=info.safeArea;
  let menu;try{menu=host.api.getMenuButtonBoundingClientRect?.();}catch{}
  const number=value=>Number.isFinite(value)?Math.max(0,value):0;
  const top=Math.min(height/3,Math.max(number(safe?.top),menu?.width>0&&menu?.height>0?number(menu.bottom)+8:0));
  const bottom=Math.min(height/3,number(height-(safe?.bottom??height)));
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
html.wechat-fullscreen #gameShell #gui-casual-lobby .psd-main-page{
 top:${top}px!important;bottom:${bottom}px!important;height:auto!important;overflow:visible!important;
}
html.wechat-fullscreen #gameShell #gui-casual-lobby .psd-main-composite{
 top:${-top}px!important;height:${height}px!important;
}
html.wechat-fullscreen #gameShell #gui-casual-lobby .psd-hit-start,
html.wechat-fullscreen #gameShell #gui-casual-lobby .psd-hit-patrol,
html.wechat-fullscreen #gameShell #gui-casual-lobby .psd-hit-backpack{
 top:auto!important;bottom:calc(20.133333cqw + 8px)!important;
}
html.wechat-fullscreen #gameShell #gui-casual-lobby .psd-hit-start{height:15.6cqw!important}
html.wechat-fullscreen #gameShell #gui-casual-lobby .psd-hit-patrol{height:14.8cqw!important}
html.wechat-fullscreen #gameShell #gui-casual-lobby .psd-hit-backpack{height:12.266667cqw!important}
`;
  doc.head.append(style);
  return environment;
}
