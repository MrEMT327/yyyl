import * as T from 'three';

export const viewportPixel=(position,density)=>Math.round(Math.round(position)*density);

// Art and face boxes are in the source PSD's 750 × 1624 coordinate system.
// The hit rectangles for these commands can be different from their artwork.
export const homePictures=[
  ['background','main-background.png',[0,0,750,1624]],
  ['shade','buttons/scene-shade.png',[0,0,750,1624]],
  ['chapter-title','buttons/chapter-frame.png',[116,132,534,94]],
  ['chapter-prev','buttons/chapter-prev.png',[136,159,36,39]],
  ['chapter-next','buttons/chapter-next.png',[585,159,36,39]],
  ['tasks','buttons/tasks.png',[6,227,101,107],[6,232,101,102]],
  ['star-rewards','buttons/star-rewards.png',[240,239,289,45]],
  ['switch-pilot','buttons/switch-pilot.png',[597,1187,145,147]],
  ['patrol','buttons/patrol.png',[26,1345,182,111]],
  ['backpack','buttons/backpack.png',[545,1364,182,92]],
  ['start','buttons/start.png',[224,1341,301,117]],
  ['profile','profile-live-frame.png',[22,27,199,78],[0,27,221,100]],
];
const wallets=[
  ['stamina',234,[253,47,30,44]],
  ['coins',404,[422,48,34,42]],
  ['diamonds',574,[601,50,20,39]],
];
for(const [key,x,icon] of wallets){
  const bar=[x,46,163,46];
  for(const [part,file,art] of [
    ['background','resources/'+key+'-background.png',bar],
    ['icon','/art/project-resource-icons-v2/'+key+'.png',icon],
    ['plus','resources/'+key+'-plus.png',[x+138,64,13,12]],
  ])homePictures.push([key+'-'+part,file,art,bar,'.lobby-resource.is-'+key+' .lobby-resource-'+part]);
}
const vert=`precision highp float;
in vec3 position; in vec2 uv; uniform vec4 box; uniform bool framebuffer; out vec2 texcoord;
void main(){vec2 p=box.xy+vec2(position.x+.5,.5-position.y)*box.zw;
 gl_Position=vec4(p.x*2./750.-1.,1.-p.y*2./1624.,0.,1.);texcoord=vec2(uv.x,framebuffer?uv.y:1.-uv.y);}`;
const frag=`precision highp float;
in vec2 texcoord;uniform sampler2D art;uniform vec2 grade;out vec4 colour;
// The reference artwork's downscale sits between level-zero bilinear and
// trilinear sampling. Magnification and the un-mipmapped portrait are linear.
void main(){
  colour=texture(art,texcoord,-0.5);
  if(grade.x>0.0)colour.rgb=mix(colour.rgb,vec3(dot(colour.rgb,vec3(.2126,.7152,.0722))),grade.x);
  colour.rgb*=grade.y;
}`;

export function createHomeStage(images) {
  const behind=new T.Scene(),front=new T.Scene(),character=new T.Scene(),camera=new T.Camera();
  const geometry=new T.PlaneGeometry(1,1),items=new Map();
  function createMaterial(texture,box,framebuffer=false){
    return new T.RawShaderMaterial({vertexShader:vert,fragmentShader:frag,glslVersion:T.GLSL3,
      uniforms:{box:{value:box},art:{value:texture},framebuffer:{value:framebuffer},grade:{value:new T.Vector2(0,1)}},transparent:true,depthTest:false,depthWrite:false,
      blending:T.CustomBlending,blendSrc:T.OneFactor,blendDst:T.OneMinusSrcAlphaFactor});
  }
  const personBox=new T.Vector4(),personMat=createMaterial(null,personBox,true),person=new T.Mesh(geometry,personMat);
  person.frustumCulled=false;person.renderOrder=1;character.add(person);
  let scenery=null,still=null;
  function releaseImage(entry){
    if(entry){entry.mesh.removeFromParent();entry.material.dispose();entry.texture.dispose();}
  }
  function portraitImage(image,order){
    if(!image)return null;
    const texture=new T.Texture(image);texture.flipY=false;texture.premultiplyAlpha=true;
    texture.colorSpace=T.NoColorSpace;texture.needsUpdate=true;
    const box=new T.Vector4(),material=createMaterial(texture,box),mesh=new T.Mesh(geometry,material);
    mesh.renderOrder=order;mesh.frustumCulled=false;character.add(mesh);
    return {image,texture,material,box,mesh};
  }
  let view=null;
  function place(item){
    if(!view)return;
    const {left,top,width,height,ratio,wNative,hNative}=view;
    const [x,y,w,h]=item.bounds,[hx,hy,hw,hh]=item.hit;
    const cx=hx+hw/2,cy=hy+hh/2,s=item.scale;
    const pixel=(p,base,length,design)=>viewportPixel(base+length*p/design,ratio)-viewportPixel(base,ratio);
    const x0=pixel(cx+(x-cx)*s,left,width,750),x1=pixel(cx+(x+w-cx)*s,left,width,750);
    const y0=pixel(cy+(y-cy)*s,top,height,1624),y1=pixel(cy+(y+h-cy)*s,top,height,1624);
    item.box.set(x0*750/wNative,y0*1624/hNative,(x1-x0)*750/wNative,(y1-y0)*1624/hNative);
  }
  for(const [i,[id,,bounds,hit=bounds]] of homePictures.entries()){
    const texture=new T.Texture(images.get(id));
    texture.flipY=false;texture.premultiplyAlpha=true;texture.colorSpace=T.NoColorSpace;
    texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
    const box=new T.Vector4(...bounds);
    const material=createMaterial(texture,box);
    const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=i;
    (id==='background'?behind:front).add(mesh);items.set(id,{texture,material,bounds,hit,box,scale:1});
  }
  return {
    drawBehind(renderer){renderer.render(behind,camera);},
    layout(value){view=value;for(const item of items.values())place(item);},
    setPortraitScenery(image){
      releaseImage(scenery);scenery=portraitImage(image,0);
    },
    setPortraitStill(image){
      releaseImage(still);still=portraitImage(image,1);
    },
    drawCharacter(renderer,texture,rect){
      if(still)still.mesh.visible=!texture;
      person.visible=!!texture;
      for(const entry of [scenery,still])if(entry&&view&&entry.mesh.visible){
        const {box,image}=entry;
        const sx=view.width/750,sy=view.height/1624;
        const k=Math.min(rect.z*sx/image.naturalWidth,rect.w*sy/image.naturalHeight);
        const w=image.naturalWidth*k/sx,h=image.naturalHeight*k/sy;
        box.set(rect.x+(rect.z-w)/2,rect.y+(rect.w-h)/2,w,h);
      }
      personMat.uniforms.art.value=texture;personBox.copy(rect);renderer.render(character,camera);
    },
    drawInFront(renderer){renderer.render(front,camera);},
    setButtonScale(id,scale){
      const item=items.get(id);if(!item)return;
      item.scale=scale;place(item);
    },
    setGrade(id,grayscale,brightness){items.get(id)?.material.uniforms.grade.value.set(grayscale,brightness);},
    dispose(){geometry.dispose();personMat.dispose();releaseImage(scenery);releaseImage(still);for(const item of items.values()){item.material.dispose();item.texture.dispose();}items.clear();}
  };
}
