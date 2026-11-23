export function createWechatPanelInput(api, platform, region) {
  let stopTouches=null;
  return {
    bounds:()=>region.bounds(),
    frameBounds:()=>region.frameBounds(),
    overlay:Boolean(region.overlay),
    now:platform.now,requestFrame:platform.requestFrame,cancelFrame:platform.cancelFrame,
    watch:platform.onViewport,
    bind(actions){
      stopTouches=platform.bindTouches(({phase,x,y,pointerId})=>{
        if(phase==='start')actions.begin(x,y,pointerId);
        else if(phase==='move')actions.move(x,y,pointerId);
        else if(phase==='end'){actions.end(x,y,pointerId);actions.commit();}
        else actions.cancel();
      },region.priority,region.accepts);
    },
    editNumber(action,update){
      let open=true;
      function stop(hide=false) {
        if(!open)return;
        open=false;
        api.offKeyboardInput(input);
        api.offKeyboardComplete(complete);
        if(hide)api.hideKeyboard({fail(){}});
      }
      function input(result) { if(open)update(result.value); }
      function complete(result) { input(result);stop(); }
      api.onKeyboardInput(input);
      api.onKeyboardComplete(complete);
      api.showKeyboard({defaultValue:String(action.value),maxLength:10,multiple:false,
        confirmHold:false,confirmType:'done',fail:()=>stop()});
      return ()=>stop(true);
    },
    close(){stopTouches?.();stopTouches=null;},
  };
}

