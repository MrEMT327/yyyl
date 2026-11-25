import * as T from 'three';
import {createBattleGlow} from './three-battle-glow.js';
import {createBattleColorTargets} from './battle-color-targets.js';
import {flightLights} from './three-flight-lights.js';
import {authoredBattleFrame,battleWidth as width,battleHeight as height} from './battle-frame-layout.js';

const vertex = `precision highp float;
  in vec3 position;
  in vec2 uv;
  uniform mat4 modelViewMatrix, projectionMatrix;
  uniform vec4 region;
  uniform vec2 size, pivot;
  uniform float invert;
  out vec2 coords;
  void main(){
  #ifdef GLYPH_RUN
    coords=uv;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
  #else
    vec2 xy=vec2(uv.x,1.0-uv.y);
    coords=region.xy+vec2(xy.x,mix(xy.y,1.0-xy.y,invert))*region.zw;
    gl_Position=projectionMatrix*modelViewMatrix*vec4((xy-pivot)*size,0.,1.);
  #endif
  }`;
const fragment = `precision highp float;
  uniform sampler2D art;
  uniform vec3 tint;
  uniform vec4 statusTint;
  uniform float opacity,fill,premult;
  in vec2 coords;
  out vec4 color;
  #ifdef ENEMY_MINIFICATION
    uniform vec4 region;

    vec4 enemyTap(vec2 uv,vec2 lo,vec2 hi){
      vec4 tex=textureLod(art,clamp(uv,lo,hi),0.);
      tex.rgb*=mix(tex.a,1.,premult);
      return tex;
    }

    vec4 sampleArt(){
      vec2 pixels=vec2(textureSize(art,0));
      vec2 dx=dFdx(coords),dy=dFdy(coords);
      vec2 xPixels=dx*pixels,yPixels=dy*pixels;
      // Keep every tap within this atlas frame, including the bilinear footprint.
      vec2 inset=.5/pixels,lo=region.xy+inset,hi=max(lo,region.xy+region.zw-inset);
      if(max(dot(xPixels,xPixels),dot(yPixels,yPixels))>2.25){
        vec2 a=(dx+dy)*.25,b=(dx-dy)*.25;
        return .25*(enemyTap(coords+a,lo,hi)+enemyTap(coords-a,lo,hi)
          +enemyTap(coords+b,lo,hi)+enemyTap(coords-b,lo,hi));
      }
      return enemyTap(coords,lo,hi);
    }
  #else
    vec4 sampleArt(){
      #ifdef HULL_MIP_LOD_BIAS
        vec4 tex=texture(art,coords,HULL_MIP_LOD_BIAS);
      #else
        vec4 tex=texture(art,coords);
      #endif
      tex.rgb*=mix(tex.a,1.,premult);
      return tex;
    }
  #endif
  void main(){
    vec4 tex=sampleArt();
    vec3 rgb=mix(tex.rgb*tint,tex.a*tint,fill);
    rgb=mix(rgb,tex.a*statusTint.rgb,statusTint.a);
    color=vec4(rgb,tex.a)*opacity;
  }`;

export function createBattleStage(renderer,{smoothEnemyMinification=false,compactGlow=false,outputScale=1,terrainScale=1,renderBudget}={}) {
  const scene=new T.Scene(),camera=new T.OrthographicCamera(0,width,0,height,-10,10);
  const quad=new T.PlaneGeometry(1,1),spriteMeshes=new Set(),glow=createBattleGlow(renderer,width,height,outputScale,compactGlow);
  const white=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);
  white.needsUpdate=true;
  const whiteBinding={texture:white,width:1,height:1};
  const terrainPixels=n=>Math.max(1,Math.round(n*terrainScale));
  const colorTargets=createBattleColorTargets(renderer,terrainPixels(width),terrainPixels(height),256,{multisampleGround:terrainScale>=1});
  const spareLabels=[];
  function makeSprite(binding,layer,parent=scene,reuse) {
    const material=reuse?.material??new T.RawShaderMaterial({
      vertexShader:vertex,fragmentShader:fragment,glslVersion:T.GLSL3,transparent:true,depthWrite:false,depthTest:false,
      side:T.DoubleSide,forceSinglePass:true,blending:T.CustomBlending,
      blendSrc:T.OneFactor,blendDst:T.OneMinusSrcAlphaFactor,
      uniforms:{art:{value:binding.texture},size:{value:new T.Vector2(binding.width,binding.height)},
        pivot:{value:new T.Vector2(.5,.5)},region:{value:new T.Vector4(0,0,1,1)},
        tint:{value:new T.Vector3(1,1,1)},statusTint:{value:new T.Vector4(1,1,1,0)},opacity:{value:1},fill:{value:0},
        invert:{value:Number(!!binding.framebuffer)},premult:{value:Number(!!binding.premultiplied)}},
    });
    if(reuse){
      material.uniforms.art.value=binding.texture;
      material.uniforms.premult.value=Number(!!binding.premultiplied);
    }
    const node=new T.Mesh(reuse?.geometry??quad,material);
    node.frustumCulled=false;node.renderOrder=layer;
    node.userData.binding=binding;parent.add(node);spriteMeshes.add(node);
    return node;
  }
  function makeLabelSprite(binding,layer,parent){
    const reuse=spareLabels.pop(),mesh=makeSprite(binding,layer,parent,reuse);
    if(!reuse){mesh.geometry=new T.BufferGeometry();mesh.material.defines.GLYPH_RUN=1;}
    mesh.userData.ownsGeometry=true;
    return mesh;
  }
  function tint(mesh,color,fill=false) {
    mesh.material.uniforms.tint.value.set((color>>16&255)/255,(color>>8&255)/255,(color&255)/255);
    mesh.material.uniforms.fill.value=Number(fill);
  }
  function remove(mesh){
    if(!mesh)return;
    mesh.removeFromParent();mesh.traverse(n=>{
      if(n.material){
        spriteMeshes.delete(n);
        if(n.material.defines?.GLYPH_RUN&&spareLabels.length<24&&(n.geometry.getAttribute('position')?.count??0)<=128){
          n.material.uniforms.art.value=null;
          spareLabels.push({geometry:n.geometry,material:n.material});
          return;
        }
        n.material.dispose();
      }
      if(n.userData.ownsGeometry)n.geometry.dispose();
    });
  }
  const ground=makeSprite({texture:colorTargets.ground,width,height,framebuffer:true,premultiplied:true},-1000);
  ground.material.uniforms.pivot.value.set(0,0);ground.visible=false;
  const hull=makeSprite({texture:colorTargets.hull,width:256,height:256,framebuffer:true,premultiplied:true},25);
  // Preserve panel detail while keeping trilinear filtering for the moving hull.
  hull.material.defines.HULL_MIP_LOD_BIAS=-.5;
  hull.visible=false;
  const stage={scene,camera,renderer,glow,white: whiteBinding,makeSprite,makeLabelSprite,remove,tint,ground,hull,width,height,viewport:authoredBattleFrame,
    smoothEnemySprite:smoothEnemyMinification?mesh=>{mesh.material.defines.ENEMY_MINIFICATION=1;}:undefined,
    setViewport(frame){
      const previous=this.viewport;
      if(!frame||frame.width===previous.width&&frame.height===previous.height)return;
      this.viewport=frame;
      camera.left=frame.left;camera.right=frame.left+frame.width;
      camera.top=frame.top;camera.bottom=frame.top+frame.height;camera.updateProjectionMatrix();
      colorTargets.resizeGround(terrainPixels(frame.width),terrainPixels(frame.height));glow.resize(frame);
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
      return [...glow.warmupJobs(),()=>{
        if(!renderer.compile)return;
        const label=makeLabelSprite(whiteBinding,52,scene);
        try{renderer.compile(scene,camera);}finally{remove(label);}
      }];
    },
    render(profile){
      this.placeWake();
      renderer.setScissorTest(false);
      const output=this.outputTarget?.()??null;
      const clear=renderer.autoClear;renderer.autoClear=false;
      let worldDraw=0,uiDraw=0;
      try{
        let hasForeground=false;
        scene.traverseVisible(node=>{
          if(node.isMesh)node.layers.set(node.renderOrder>=49.9?2:node.renderOrder>=29?1:0);
          if(node.layers.mask&4)hasForeground=true;
        });
        const start=profile?.();
        glow.paint(scene,camera,output,this.beginOutput,hasForeground,renderBudget?.underLoad);
        const overlay=profile?.();
        this.drawBackdrop?.();this.drawBreakthrough?.('rear');this.drawHud?.();
        this.drawBreakthrough?.('front');this.drawMovementGuide?.();this.drawNotice?.();this.drawDeveloperSkills?.();
        if(profile){worldDraw=overlay-start;uiDraw=profile()-overlay;}
      }finally{renderer.autoClear=clear;if(output)renderer.setRenderTarget(null);}
      this.afterFrame?.();
      if(profile)return {worldDraw,uiDraw};
    },
    dispose(){this.disposeLights();for (const mesh of spriteMeshes){mesh.material.dispose();if(mesh.userData.ownsGeometry)mesh.geometry.dispose();}spriteMeshes.clear();
      for(const {geometry,material} of spareLabels){geometry.dispose();material.dispose();}spareLabels.length=0;
      colorTargets.dispose();glow.dispose();quad.dispose();white.dispose();scene.clear();}
  };
  return Object.assign(stage,flightLights(stage));
}
