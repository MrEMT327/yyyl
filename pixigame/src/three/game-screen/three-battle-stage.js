import * as T from 'three';
import {createBattleGlow} from './three-battle-glow.js';
import {createBattleColorTargets} from './battle-color-targets.js';
import {flightLights} from './three-flight-lights.js';
import {authoredBattleFrame,battleWidth as width,battleHeight as height} from './battle-frame-layout.js';

const vertex = `precision highp float;
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 modelViewMatrix, projectionMatrix;
  uniform vec4 region;
  uniform vec2 size, pivot;
  uniform float invert;
  varying vec2 coords;
  void main(){
    vec2 xy=vec2(uv.x,1.0-uv.y);
    coords=region.xy+vec2(xy.x,mix(xy.y,1.0-xy.y,invert))*region.zw;
    gl_Position=projectionMatrix*modelViewMatrix*vec4((xy-pivot)*size,0.,1.);
  }`;
const fragment = `precision highp float;
  uniform sampler2D art;
  uniform vec3 tint;
  uniform vec4 statusTint;
  uniform float opacity,fill,premult;
  varying vec2 coords;
  void main(){
    vec4 tex=texture2D(art,coords);
    vec3 rgb=mix(tex.rgb*mix(tex.a,1.,premult)*tint,tex.a*tint,fill);
    rgb=mix(rgb,tex.a*statusTint.rgb,statusTint.a);
    gl_FragColor=vec4(rgb,tex.a)*opacity;
  }`;

export function createBattleStage(renderer) {
  const scene=new T.Scene(),camera=new T.OrthographicCamera(0,width,0,height,-10,10);
  const quad=new T.PlaneGeometry(1,1),spriteMeshes=new Set(),glow=createBattleGlow(renderer,width,height);
  const white=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);
  white.needsUpdate=true;
  const whiteBinding={texture:white,width:1,height:1};
  const colorTargets=createBattleColorTargets(renderer,width,height,256);
  function makeSprite(binding,layer,parent=scene) {
    const material=new T.RawShaderMaterial({
      vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,depthTest:false,
      side:T.DoubleSide,forceSinglePass:true,blending:T.CustomBlending,
      blendSrc:T.OneFactor,blendDst:T.OneMinusSrcAlphaFactor,
      uniforms:{art:{value:binding.texture},size:{value:new T.Vector2(binding.width,binding.height)},
        pivot:{value:new T.Vector2(.5,.5)},region:{value:new T.Vector4(0,0,1,1)},
        tint:{value:new T.Vector3(1,1,1)},statusTint:{value:new T.Vector4(1,1,1,0)},opacity:{value:1},fill:{value:0},
        invert:{value:Number(!!binding.framebuffer)},premult:{value:Number(!!binding.premultiplied)}},
    });
    const node=new T.Mesh(quad,material);
    node.frustumCulled=false;node.renderOrder=layer;
    node.userData.binding=binding;parent.add(node);spriteMeshes.add(node);
    return node;
  }
  function tint(mesh,color,fill=false) {
    mesh.material.uniforms.tint.value.set((color>>16&255)/255,(color>>8&255)/255,(color&255)/255);
    mesh.material.uniforms.fill.value=Number(fill);
  }
  function remove(mesh){
    if(!mesh)return;
    mesh.removeFromParent();mesh.traverse(n=>{
      if(n.material){n.material.dispose();spriteMeshes.delete(n);}
      if(n.userData.ownsGeometry)n.geometry.dispose();
    });
  }
  const ground=makeSprite({texture:colorTargets.ground,width,height,framebuffer:true,premultiplied:true},-1000);
  ground.material.uniforms.pivot.value.set(0,0);ground.visible=false;
  const hull=makeSprite({texture:colorTargets.hull,width:256,height:256,framebuffer:true,premultiplied:true},25);
  hull.visible=false;
  const stage={scene,camera,renderer,glow,white: whiteBinding,makeSprite,remove,tint,ground,hull,width,height,viewport:authoredBattleFrame,
    setViewport(frame){
      const previous=this.viewport;
      if(!frame||frame.width===previous.width&&frame.height===previous.height)return;
      this.viewport=frame;
      camera.left=frame.left;camera.right=frame.left+frame.width;
      camera.top=frame.top;camera.bottom=frame.top+frame.height;camera.updateProjectionMatrix();
      colorTargets.resizeGround(frame.width,frame.height);glow.resize(frame);
      ground.position.set(frame.left,frame.top,0);
      ground.material.uniforms.size.value.set(frame.width,frame.height);
    },
    warmGround:colorTargets.warmGround,
    drawGround(scene,camera,backdrop){colorTargets.drawGround(scene,camera,backdrop);ground.visible=true;},
    drawHull:colorTargets.drawHull,
    hullPose(pose){
      hull.position.set(pose.x,pose.y,0);const size=Math.max(pose.width,pose.height);
      hull.material.uniforms.size.value.set(size*pose.scaleX,size*pose.scaleY);
      hull.material.uniforms.opacity.value=pose.alpha;hull.visible=pose.visible;
    },
    warmupJobs(){
      this.refreshViewport?.();
      return [...glow.warmupJobs(),()=>renderer.compile?.(scene,camera)];
    },
    render(profile){
      this.placeWake();
      renderer.setScissorTest(false);
      const output=this.outputTarget?.()??null;
      const clear=renderer.autoClear;renderer.autoClear=false;
      let worldDraw=0,uiDraw=0;
      try{
        scene.traverse(n=>{if(n.isMesh)n.layers.set(n.renderOrder>=49.9?2:n.renderOrder>=29?1:0);});
        const start=profile?.();
        glow.paint(scene,camera,output,this.beginOutput);
        const overlay=profile?.();
        this.drawBackdrop?.();this.drawBreakthrough?.('rear');this.drawHud?.();
        this.drawBreakthrough?.('front');this.drawMovementGuide?.();this.drawNotice?.();this.drawDeveloperSkills?.();
        if(profile){worldDraw=overlay-start;uiDraw=profile()-overlay;}
      }finally{renderer.autoClear=clear;if(output)renderer.setRenderTarget(null);}
      this.afterFrame?.();
      if(profile)return {worldDraw,uiDraw};
    },
    dispose(){this.disposeLights();for (const mesh of spriteMeshes)mesh.material.dispose();spriteMeshes.clear();
      colorTargets.dispose();glow.dispose();quad.dispose();white.dispose();scene.clear();}
  };
  return Object.assign(stage,flightLights(stage));
}
