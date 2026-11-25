import {ACESFilmicToneMapping,DirectionalLight,HemisphereLight,OrthographicCamera,Scene} from 'three';
import {FlatBatcher} from '../flat-batcher.js';
import {Rectangle,synchronizeDisplayTree} from '../display.js';
import {bindCombatHud} from '../../../replica-battle/combat-hud-bindings.js';

// The HUD contributes a camera and screen-space meshes to the battle frame.
class BattleHudScene {
  constructor(screen){
    this.three=screen.renderer;this.canvas=screen.canvas;this.screen=new Rectangle(0,0,600,1300);
    this.resolution=1;this.scene=new Scene();this.camera=new OrthographicCamera(0,600,0,1300,.1,10000);
    this.camera.position.z=5000;this.scene.add(new HemisphereLight(0xd9efff,0x263247,2.1));
    const key=new DirectionalLight(0xffffff,2.5);key.position.set(-400,-600,1500);this.scene.add(key);
    this.batcher=new FlatBatcher();this.screenPasses=new Set();this.screenOverlays=new Set();
  }
  resize(w,h){this.screen.width=w;this.screen.height=h;this.camera.right=w;this.camera.bottom=h;this.camera.updateProjectionMatrix();}
  prepare(root){
    this.batcher.restore();synchronizeDisplayTree(this,root);
    root.object3D.updateWorldMatrix(true,true);this.batcher.update([root],false,true,true);
  }
  draw(){
    const r=this.three,tone=r.toneMapping,exposure=r.toneMappingExposure,clip=r.localClippingEnabled;
    try{
      r.toneMapping=ACESFilmicToneMapping;r.toneMappingExposure=.9;r.localClippingEnabled=true;
      r.clearDepth();for(const pass of this.screenPasses)pass(r);
      r.render(this.scene,this.camera);for(const overlay of this.screenOverlays)overlay(r);
    }finally{r.toneMapping=tone;r.toneMappingExposure=exposure;r.localClippingEnabled=clip;}
  }
  destroy(){this.batcher.destroy();this.screenPasses.clear();this.screenOverlays.clear();this.scene.clear();}
}

export function mountThreeCombatHud(options){
  const {screen,onGraphicsContext}=options,renderer=new BattleHudScene(screen),canvas=screen.canvas;
  canvas?.setAttribute?.('aria-label','战斗界面');onGraphicsContext?.(screen.renderer.domElement,screen.renderer.getContext());
  const {stage}=screen;
  stage.drawHud=()=>renderer.draw();
  return bindCombatHud(options,{canvas,renderer,setPhase(value,showingResult){
    stage.showingResult=showingResult;stage.setModalPhase?.(value);
  },draw:scene=>renderer.prepare(scene),disposeRenderer(){stage.drawHud=null;renderer.destroy();}});
}
