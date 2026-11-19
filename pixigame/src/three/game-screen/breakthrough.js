import {AdditiveBlending,BufferAttribute,BufferGeometry,DoubleSide,DynamicDrawUsage,LinearFilter,Mesh,NormalBlending,OrthographicCamera,Scene,ShaderMaterial,TextureLoader} from 'three';
import {breakthroughBackdropPose,sampleBreakthroughFrame} from '../../ui/breakthrough-backdrop.js';
import profile from '../../ui/breakthrough-native-particles.json';
import art from './breakthrough-art.json';

const corners=[[0,0],[0,1],[1,0],[1,0],[0,1],[1,1]];
function batch(texture,blend,order){
  const geometry=new BufferGeometry();
  const material=new ShaderMaterial({uniforms:{atlas:{value:texture}},depthTest:false,depthWrite:false,transparent:true,toneMapped:false,
    blending:blend==='add'?AdditiveBlending:NormalBlending,side:DoubleSide,forceSinglePass:true,
    vertexShader:`attribute vec4 ink;varying vec4 dye;varying vec2 optical;
      void main(){dye=ink;optical=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D atlas;varying vec4 dye;varying vec2 optical;
      void main(){gl_FragColor=vec4(dye.rgb,dye.a*texture2D(atlas,optical).a);}`});
  const mesh=new Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=order;
  let capacity=0,count=0,pos,uv,colors;
  function reserve(required){
    if(capacity>=required)return;
    capacity=Math.max(8,2**Math.ceil(Math.log2(required)));
    pos=new Float32Array(capacity*18);uv=new Float32Array(capacity*12);colors=new Float32Array(capacity*24);
    // Dispose the old GPU allocation before replacing its attributes. The mesh can keep the geometry.
    geometry.dispose();
    for(const [key,data,size] of [['position',pos,3],['uv',uv,2],['ink',colors,4]])
      geometry.setAttribute(key,new BufferAttribute(data,size).setUsage(DynamicDrawUsage));
  }
  return {mesh,fill(draws,cx,cy,unit){
    count=0;
    const repeats=draws.reduce((sum,{sprite:s})=>sum+Math.ceil(s.blend==='add'?(s.tintGain||1):1),0);
    reserve(repeats);mesh.visible=repeats>0;
    for(const {sprite:s,material} of draws){
      const tex=profile.data.textures[s.key],tile=art.tiles[s.key];if(!tex||!tile||!s.width||!s.height)continue;
      const main=material.textures.find(t=>t.slot==='_MainTex');
      const crop=s.crop,ux=(crop?.x||0)/tex.width,uy=(crop?.y||0)/tex.height;
      const uw=(crop?.width??tex.width)/tex.width,uh=(crop?.height??tex.height)/tex.height;
      const sx=main?.scale?.x??1,sy=main?.scale?.y??1,ox=main?.offset?.x||0,oy=main?.offset?.y||0;
      const sn=Math.sin(s.rotation),cs=Math.cos(s.rotation),gain=s.tintGain||1,add=s.blend==='add';
      const channel=shift=>Math.min(255,Math.round(((s.tint>>shift)&255)*(add?1:gain)))/255;
      const red=channel(16),green=channel(8),blue=channel(0);
      for(let left=add?gain:1;left>1e-6;left-=1){
        const alpha=Math.max(0,Math.min(1,s.alpha*Math.min(1,left)));
        for(const [u,v] of corners){
          const dx=(u-s.originX)*s.width,dy=(v-s.originY)*s.height;
          const i3=count*3,i2=count*2,i4=count*4;
          pos[i3]=cx+(s.x+cs*dx-sn*dy)*unit;pos[i3+1]=cy+(-s.z+sn*dx+cs*dy)*unit;
          uv[i2]=tile[0]+((ux+uw*u)*sx+ox)*tile[2];uv[i2+1]=1-tile[1]-((uy+uh*v)*sy+oy)*tile[3];
          colors[i4]=red;colors[i4+1]=green;colors[i4+2]=blue;colors[i4+3]=alpha;count++;
        }
      }
    }
    geometry.setDrawRange(0,count);
    if(count)for(const a of Object.values(geometry.attributes)){a.clearUpdateRanges();a.addUpdateRange(0,count*a.itemSize);a.needsUpdate=true;}
    mesh.visible=count>0;
  },dispose(){geometry.dispose();material.dispose();mesh.removeFromParent();}};
}

export function createThreeBreakthrough(renderer,region=renderer.domElement){
  const camera=new OrthographicCamera(0,1,0,1,-2,2),scenes={front:new Scene(),rear:new Scene()},owners=new Map();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let atlas=null;
  function prepare(){
    if(atlas)return;
    atlas=new TextureLoader().load(art.image);atlas.generateMipmaps=false;atlas.minFilter=atlas.magFilter=LinearFilter;
  }
  function remove(owner){const v=owners.get(owner);if(v){for(const b of v.batches)b.dispose();owners.delete(owner);}}
  function draw(owner,stage,tier,seconds){
    if(!stage?.isConnected||!breakthroughBackdropPose(seconds).visible){remove(owner);return false;}
    prepare();const frame=sampleBreakthroughFrame(seconds,tier,reduced.matches,performance.now()/1000);
    let view=owners.get(owner);
    if(view&&view.tier!==tier){remove(owner);view=null;}
    if(!view){
      const batches=frame.surfaces.map((s,i)=>{const b=batch(atlas,s.blend,i);scenes[s.side].add(b.mesh);return b;});
      view={tier,batches};owners.set(owner,view);
    }
    view.frame=frame;return true;
  }
  function paint(side){
    if(!owners.size||!atlas?.image?.width)return;
    const {width:w,height:h}=region.getBoundingClientRect();if(!w||!h)return;
    const unit=Math.min(w/600,h/1300)*(179.2/328)*1.2;
    if(camera.right!==w||camera.bottom!==h){camera.right=w;camera.bottom=h;camera.updateProjectionMatrix();}
    for(const row of owners.values()){
      const f=row.frame;if(row.last===f&&row.w===w&&row.h===h)continue;
      const x=w/2+f.offset.x*unit,y=h/2-f.offset.y*unit;
      f.surfaces.forEach((s,i)=>row.batches[i].fill(s.draws,x,y,unit));
      row.last=f;row.w=w;row.h=h;
    }
    if(scenes[side].children.some(m=>m.visible))renderer.render(scenes[side],camera);
  }
  return {prepare,remove,draw,paint,clear(){
    for(const owner of owners.keys())remove(owner);
    atlas?.dispose();atlas=null;
  }};
}

