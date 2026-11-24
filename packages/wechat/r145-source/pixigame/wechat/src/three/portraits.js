import { createPilotPortraitPlayer } from '../../../../../../../pixigame/src/ui/portrait-player-factory.js';
import { PILOT_PORTRAITS } from '../../../../../../../pixigame/src/ui/character-portraits.js';
import { createPortraitSurface } from '../../../../../../../pixigame/src/three/game-screen/three-portrait-surface.js';
import { createBluePortraitForOutput } from '../../../../../../../pixigame/src/three/game-screen/blue-portrait.js';
import { createModelSurface } from '../../../../../../../pixigame/src/three/game-screen/cubism-surface.js';
import { catalogPortrait } from '../../../../../../../pixigame/src/three/game-screen/catalog-portrait.js';
import { loadArtwork } from '../../../../../../../pixigame/src/three/game-screen/image-loading.js';
import { createWechatVideoPortrait } from './video.js';

function rendererOutput(device,token,model){
  let w=1,h=1,frame=null,closed=false;
  function submit(){
    if(closed||!frame)return;
    const owner=device.homeView?.owns(token)?device.homeView:device.menuView?.owns(token)?device.menuView:null;
    if(!owner)return;
    const pose=frame;
    owner.setPose(token,w,h,()=>model.draw(...pose,w,h),true);
  }
  return {
    draw(...pose){frame=pose;submit();},
    resize(width,height){
      const changed=w!==width||h!==height;
      w=width;h=height;
      if(changed)submit();
      return changed;
    },
    destroy(){
      if(closed)return;
      closed=true;frame=null;
      device.homeView?.forget(token);device.menuView?.forget(token);model.dispose();
    },
  };
}

export function createWechatPortraits(api,platform,services,device,baseURL,loadCore){
  let allowed=true,active=null;
  function open(id){
    const surface=Symbol(id),watchers=new Set();
    let rect={width:0,height:0},closed=false,player=null,pendingFeedback=false,enabled=allowed;
    const portraitHost={
      baseURL,hidden:()=>!platform.visible,
      makeAbort:services.makeAbort,loadCore,fetchResource:services.fetchResource,loadImage:loadArtwork,
      bounds:()=>rect,requestFrame:platform.requestFrame,cancelFrame:platform.cancelFrame,
      watchVisibility(fn){
        let before=platform.visible;
        return platform.onViewport((_window,visible)=>{if(before!==visible){before=visible;fn();}});
      },
      watchBounds(fn){watchers.add(fn);return ()=>watchers.delete(fn);},
      renderSize(w,h,density=2){
        const factor=Math.min(density,Math.sqrt(840000/Math.max(1,w*h)));
        return [Math.max(1,Math.round(w*factor)),Math.max(1,Math.round(h*factor))];
      },
      createMesh:(manifest,textures)=>rendererOutput(device,surface,createPortraitSurface(device.three,manifest,textures)),
      createCubism:(model,images,mipmaps)=>{
        const output=rendererOutput(device,surface,createModelSurface(device.three,model,images,mipmaps));
        return {...output,dispose:output.destroy};
      },
      render:model=>rendererOutput(device,surface,model),
      createBlue:options=>createBluePortraitForOutput(device.three,options,portraitHost),
    };
    function sync(){
      if(closed||!enabled||!rect.width||!rect.height||!PILOT_PORTRAITS[id])return;
      if(!player){
        try{
          player=id==='pilot-02'||id==='pilot-08'
            ?createWechatVideoPortrait(api,services,device,portraitHost,id)
            :createPilotPortraitPlayer(id,{assetBase:baseURL,output:portraitHost});
          Promise.resolve(player.attach(surface)).catch(error=>{
            if(!closed&&error?.name!=='AbortError')console.warn('[Three 立绘]',error);
          });
        }catch(error){console.warn('[Three 立绘]',error);}
      }
      player?.setVisible(enabled);
    }
    const handle={
      id,surface,sync,get closed(){return closed;},
      layout(bounds){rect=bounds;for(const resize of watchers)resize();sync();},
      setVisible(value){enabled=value;player?.setVisible(value);if(value)sync();},
      feedback(){
        const name=PILOT_PORTRAITS[id]?.feedback;
        if(!player||!name||pendingFeedback||!enabled||player.playing&&player.motionName===name)return false;
        pendingFeedback=true;
        return Promise.resolve(player.playMotion(name,{returnToIdle:true})).finally(()=>{pendingFeedback=false;});
      },
      close(){
        if(closed)return;closed=true;
        if(active===handle)active=null;
        player?.destroy();player=null;watchers.clear();
      },
    };
    active?.close();active=handle;
    return handle;
  }
  return {
    openHome:open,
    openCatalog(_device,bounds,refresh,paint){return catalogPortrait(device,null,refresh,paint,{bounds,open});},
    sync(){active?.sync();},
    feedback(id){return active?.id===id?active.feedback():false;},
    setVisible(next){allowed=Boolean(next);active?.setVisible(allowed);},
    destroy(){active?.close();active=null;},
  };
}
