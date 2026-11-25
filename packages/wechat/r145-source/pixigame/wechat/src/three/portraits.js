import { createPilotPortraitPlayer } from '../../../../../../../pixigame/src/ui/portrait-player-factory.js';
import { trimUnusedNativeCubismCore } from '../../../../../../../pixigame/src/ui/cubism-portrait-player.js';
import { PILOT_PORTRAITS } from '../../../../../../../pixigame/src/ui/character-portraits.js';
import { createPortraitSurface } from '../../../../../../../pixigame/src/three/game-screen/three-portrait-surface.js';
import { createBluePortraitForOutput } from '../../../../../../../pixigame/src/three/game-screen/blue-portrait.js';
import { createModelSurface } from '../../../../../../../pixigame/src/three/game-screen/cubism-surface.js';
import { catalogPortrait } from '../../../../../../../pixigame/src/three/game-screen/catalog-portrait.js';
import { loadArtwork } from '../../../../../../../pixigame/src/three/game-screen/image-loading.js';
import { createWechatVideoPortrait } from './video.js';

function rendererOutput(device,token,model){
  let w=1,h=1,frame=null,owner=null,closed=false;
  function submit(){
    if(closed||!frame)return;
    const view=device.homeView?.owns(token)?device.homeView:device.menuView?.owns(token)?device.menuView:null;
    if(!view)return;
    owner=view;
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
      owner?.forget(token);owner=null;model.dispose();
    },
  };
}

export function createWechatPortraits(api,platform,services,device,baseURL,loadCore){
  let allowed=true,active=null,memoryPressure=false,foreground=platform.visible;
  const unwatch=platform.onViewport((_bounds,visible)=>{
    if(foreground===visible)return;
    foreground=visible;
    if(visible)active?.sync();
    else{active?.releasePlayer();trimUnusedNativeCubismCore();}
  });
  function open(id){
    const surface=Symbol(id),watchers=new Set();
    let rect={width:0,height:0},closed=false,player=null,pendingFeedback=null,enabled=allowed;
    let generation=0,attaching=false;
    const portraitHost={
      baseURL,frameRate:30,hidden:()=>!platform.visible,
      makeAbort:services.makeAbort,loadCore,fetchResource:services.fetchResource,
      cubismMemoryBytes:id==='pilot-01'||id==='pilot-07'?16*1024*1024:undefined,
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
    };
    function sync(){
      if(closed||!enabled||memoryPressure||!platform.visible||!rect.width||!rect.height||!PILOT_PORTRAITS[id])return;
      if(!player){
        try{
          const ticket=++generation;
          const priority=()=>ticket===generation?0:-Infinity;
          const host={...portraitHost,loadImage:url=>loadArtwork(url,priority)};
          host.createBlue=options=>createBluePortraitForOutput(device.three,options,host);
          const next=id==='pilot-02'||id==='pilot-08'
            ?createWechatVideoPortrait(api,services,device,host,id)
            :createPilotPortraitPlayer(id,{assetBase:baseURL,output:host});
          player=next;attaching=true;
          Promise.resolve(next.attach(surface)).catch(error=>{
            if(player===next&&error?.name!=='AbortError')console.warn('[Three 立绘]',id,error);
          }).finally(()=>{if(player===next)attaching=false;});
        }catch(error){releasePlayer();console.warn('[Three 立绘]',id,error);}
      }
      player?.setVisible(enabled);
    }
    function releasePlayer(){
      generation++;attaching=false;
      const previous=player;player=null;pendingFeedback=null;previous?.destroy();
    }
    const handle={
      id,surface,sync,releasePlayer,get closed(){return closed;},
      layout(bounds){rect=bounds;for(const resize of watchers)resize();sync();},
      setVisible(value,leavePage=false){
        enabled=value;
        if(value)sync();
        else if(player&&(attaching||leavePage))releasePlayer();
        else player?.setVisible(false);
      },
      feedback(){
        const name=PILOT_PORTRAITS[id]?.feedback;
        if(!player||!name||pendingFeedback||!enabled||player.playing&&player.motionName===name)return false;
        const ticket={};pendingFeedback=ticket;
        return Promise.resolve(player.playMotion(name,{returnToIdle:true})).finally(()=>{
          if(pendingFeedback===ticket)pendingFeedback=null;
        });
      },
      close(){
        if(closed)return;closed=true;
        if(active===handle)active=null;
        releasePlayer();watchers.clear();
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
    setVisible(next,{leavePage=false,suspendLoading=false}={}){allowed=Boolean(next);active?.setVisible(allowed,leavePage||suspendLoading);},
    get pilotId(){return active?.id??null;},
    trimMemory(){memoryPressure=true;active?.releasePlayer();trimUnusedNativeCubismCore();},
    destroy(){unwatch();active?.close();active=null;},
  };
}
