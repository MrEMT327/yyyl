import {breakthroughBackdropPose,sampleBreakthroughFrame,drawBreakthroughSurface,type BreakthroughSurface} from '../../src/ui/breakthrough-backdrop.js';
type Surface={canvas:HTMLCanvasElement;context:CanvasRenderingContext2D;key:string;side:'front'|'rear';blend:'add'|'normal'};
/** Native numeric layers and order; only the cached geometric artwork is ours. */
export class ProjectUpgradeBurst {
  private views=new Map<HTMLElement,Surface[]>();
  private remove(card:HTMLElement){for(const view of this.views.get(card)||[])view.canvas.remove();this.views.delete(card);}
  prune(cards:HTMLElement[]){for(const card of this.views.keys())if(!cards.includes(card)||!card.isConnected)this.remove(card);}
  draw(card:HTMLElement,seconds:number,_offsetX=0,_offsetY=0){
    const stage=card.closest<HTMLElement>('#stage');if(!stage||!card.isConnected||!breakthroughBackdropPose(seconds).visible){this.remove(card);return;}
    const bounds=stage.getBoundingClientRect();if(bounds.width<=0||bounds.height<=0)return;
    const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
    const frame=sampleBreakthroughFrame(seconds,card.dataset.tier||'y',reducedMotion,performance.now()/1000);
    let views=this.views.get(card);
    if(!views){
      views=[];
      for(const layer of frame.surfaces){
        const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{alpha:true});
        if(!context){for(const view of views)view.canvas.remove();return;}
        canvas.className=layer.side==='rear'?'project-breakthrough-backdrop':'project-breakthrough-foreground';
        canvas.setAttribute('aria-hidden','true');canvas.dataset.effectSource='project-native-parameters-v1';canvas.dataset.layer=layer.key;
        canvas.style.cssText=`position:absolute;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:${layer.blend==='add'?'plus-lighter':'normal'}`;
        stage.append(canvas);views.push({canvas,context,key:layer.key,side:layer.side,blend:layer.blend});
      }
      this.views.set(card,views);
    }
    // All blend runs share the same former two-layer pixel budget. No new GL.
    const ratio=Math.min(window.devicePixelRatio||1,1.5,Math.sqrt(1250000/(bounds.width*bounds.height*Math.max(1,views.length))));
    const width=Math.max(1,Math.floor(bounds.width*ratio)),height=Math.max(1,Math.floor(bounds.height*ratio)),cloud=stage.classList.contains('cloud-ui-mode');
    const layers=new Map<string,BreakthroughSurface>(frame.surfaces.map(l=>[l.key,l]));
    for(const view of views){
      view.canvas.style.zIndex=String(view.side==='rear'?(cloud?19:1):(cloud?21:3));
      if(view.canvas.width!==width||view.canvas.height!==height){view.canvas.width=width;view.canvas.height=height;}
      drawBreakthroughSurface(view.context,{width:bounds.width,height:bounds.height,ratio},layers.get(view.key)!,frame);
    }
  }
}
