import * as T from 'three';
import {createBattleEffectPass} from './three-battle-effect.js';
import {gradientPixels} from '../../../replica-battle/kernel/pathogenic/pathogenic-textures.mjs';

const plain={path:'pathogenic-source-canvas',code:'shader_type canvas_item; void fragment() {}'};
const modes=['mix','add','sub','mul','premul_alpha'];

export class BattleEffectsView {
  constructor(host,graph,source) {
    this.host=host;this.graph=graph;this.source=source;
    this.pass=createBattleEffectPass(host.stage.renderer,540,960,host.stage.scene);
    this.views=new Map();this.players=new Map();this.histories=new Map();this.live=new Set();
    this.livePlayers=new Set();this.liveHistories=new Set();this.cameraOffset=[0,0];this.clock=0;
    this.gradients=new Map();this.diagnostics=[];
  }
  setCameraOffset(x,y){this.cameraOffset=[x,y];}
  dimensionCut(cut){this.host.stage.glow.addCut(cut);}
  beginFrame(time){
    if(time<this.clock)this.reset();
    this.clock=time;this.live.clear();this.livePlayers.clear();this.liveHistories.clear();
    const stage=this.host.stage,viewport=stage.viewport;
    if(this.viewport!==viewport){
      this.viewport=viewport;this.pass.resize(viewport.width,viewport.height,viewport.left,viewport.top);
    }
    stage.glow.begin();this.pass.begin();
  }
  texture(ref){
    const bindingData=this.source.channels(this.graph,ref),desc=bindingData.diffuse;
    if(!desc)return this.host.stage.white;
    if(!desc.resource?.startsWith('GradientTexture'))return this.host.art.get(desc.key);
    let binding=this.gradients.get(desc.key);
    if(binding)return binding;
    const p=gradientPixels(this.graph,desc);
    const data=p.hdr?p.data:Uint8Array.from(p.data,v=>Math.round(v*255));
    const tex=new T.DataTexture(data,p.width,p.height,T.RGBAFormat,p.hdr?T.FloatType:T.UnsignedByteType);
    const manual=!!p.hdr&&!this.host.stage.renderer.extensions.has('OES_texture_float_linear');
    tex.minFilter=tex.magFilter=manual?T.NearestFilter:T.LinearFilter;tex.needsUpdate=true;
    binding={texture:tex,width:p.width,height:p.height,manualLinear:manual};this.gradients.set(desc.key,binding);
    return binding;
  }
  resolve(ref,overrides={}){
    const material=this.source.resource(this.graph,ref),props=material?.properties||{};
    let shader=plain;
    if(material?.type==='ShaderMaterial'){
      const path=props.shader.$external;shader={path,...this.graph.shaders[path]};
    }else if(material?.type==='CanvasItemMaterial'){
      const mode=modes[props.blend_mode||0];
      shader={path:'canvas-'+mode,code:'shader_type canvas_item; render_mode blend_'+mode+(props.light_mode===1?', unshaded':'')+'; void fragment() {}'};
    }
    const uniforms={},textures={};
    for(const decl of this.pass.compile(shader,true).uniforms){
      const key='shader_parameter/'+decl.name,value=overrides[decl.name]??overrides[key]??props[key]??decl.defaultValue;
      if(decl.type==='sampler2D'){
        if(/hint_screen_texture/.test(decl.hints)){
          this.host.stage.glow.needsBackground=true;textures[decl.name]=this.host.stage.glow.binding;
        }else textures[decl.name]=this.texture(value);
      }else uniforms[decl.name]=decl.type==='vec3'&&Array.isArray(value)&&value.length===4?value.slice(0,3):value;
    }
    return {shader,uniforms,textures};
  }
  mesh(id,item,geometry,time,line=false,palette,presentation={},shared){
    if(!geometry.indices.length)return;
    const m=item.matrix;
    if(m&&Math.abs(m[0]*m[3]-m[1]*m[2])<1e-12)return;
    const main=this.texture(item.texture);if(!main)return;
    const resolved=shared?.material??this.resolve(item.material,item.materialUniformOverrides);
    if(shared)shared.material=resolved;
    if(Object.values(resolved.textures).some(binding=>!binding))return;
    let entry=this.views.get(id);
    if(!entry){entry={data:this.source.createData()};this.views.set(id,entry);}
    let gain=1;
    if(line)for(const v of geometry.vertices)gain=Math.max(gain,v.color[0],v.color[1],v.color[2]);
    this.source.updateData(entry.data,item,main,time,line,gain,presentation.presentationOpacity??1,palette,{binding:main},resolved);
    const depth=(presentation.presentationDepth??30)+Math.max(-500,Math.min(500,item.z??0))*.001;
    this.pass.submit(id,{source:resolved.shader,geometry,main,draw:entry.data,depth,line});
    if(!line)entry.spriteShape=geometry;this.live.add(id);
  }
  drawMeshes(id,meshes,palette,presentation){
    for(const mesh of meshes)this.mesh(id+':'+mesh.key,mesh,mesh,this.clock,true,palette,presentation);
  }
  endFrame(){
    this.pass.finish();
    for(const id of this.views.keys())if(!this.live.has(id))this.views.delete(id);
    for(const [id,p] of this.players)if(!this.livePlayers.has(id)){p.reset();this.players.delete(id);}
    for(const id of this.histories.keys())if(!this.liveHistories.has(id))this.histories.delete(id);
  }
  reset(){for(const p of this.players.values())p.reset();this.players.clear();this.histories.clear();this.views.clear();}
  destroy(){this.reset();this.pass.dispose();for(const b of this.gradients.values())b.texture.dispose();this.gradients.clear();}
}
