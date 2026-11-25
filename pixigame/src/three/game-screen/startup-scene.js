import {LinearFilter,LinearMipmapLinearFilter,OrthographicCamera,Scene,SRGBColorSpace} from 'three';
import {artworkTexture} from './image-loading.js';
import {createThreeSurface} from '../../ui/three-surface.js';
import {nineSliceGeometry} from '../../ui/nine-slice-geometry.js';

export const startupArtFiles={
  backdrop:'entry-screens-v4/startup.png',
  track:'psd-combat-v1/health-track.png',fill:'psd-combat-v1/health-fill.png',
  start:'psd-buttons-v1/button-orange.png',retry:'psd-equipment-v1/button-gold.png'
};
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
const uiFont='"PingFang SC","Microsoft YaHei",sans-serif';
const buttonFont='PsdPopup,"Microsoft YaHei",sans-serif';

function entryLayout(w,h,safeBottom,mode,report){
  const gap=clamp(w*.02,8,12),bar=clamp(w*.025,8,13),size=clamp(w*.035,12,20);
  const width=w*.72,buttonW=mode==='ready'?Math.min(width,clamp(w*.44,160,192)):width*.76;
  const bottom=h-Math.max(h*.045,safeBottom),buttons=[];
  let y=bottom;
  if(report)y-=118;
  function button(id,label){
    const b={id,label,x:(w-buttonW)/2,y:y-44,w:buttonW,h:44};
    buttons.unshift(b);y=b.y;return b;
  }
  if(mode==='failed'){button('copy','复制诊断');y-=6;button('retry','重新加载');}
  if(mode==='ready')button('start','开始游戏');
  if(buttons.length)y-=clamp(w*.015,5,10);
  y-=gap;
  const track=mode==='failed'?null:{x:w*.14,y:y-bar,w:width,h:bar};
  const status=(track?track.y-gap:y)-size*.7;
  return {buttons,track,status,size,report:{x:w*.14,y:bottom-110,w:width,h:110}};
}

export function createStartupScene(renderer,schedule,{waitForBackdrop=false,backdrop=startupArtFiles.backdrop}={}){
  const camera=new OrthographicCamera(0,1,0,1,-1,1),scene=new Scene(),surface=createThreeSurface();
  scene.add(surface.group);
  let backdropFailed=false,closed=false;
  const images=Object.fromEntries(Object.entries(startupArtFiles).map(([key,path])=>
    [key,loadTexture(key,key==='backdrop'?backdrop:path)]));
  function loadTexture(key,path){
    const texture=artworkTexture((import.meta.env.BASE_URL||'/')+'art/'+path,schedule,()=>{
      if(closed)return;
      if(key==='backdrop'){
        if(path!==startupArtFiles.backdrop){
          texture.dispose();
          images.backdrop=loadTexture(key,startupArtFiles.backdrop);
          return;
        }
        backdropFailed=true;
      }
      schedule();
    });
    texture.colorSpace=SRGBColorSpace;texture.generateMipmaps=key==='backdrop';
    texture.minFilter=texture.generateMipmaps?LinearMipmapLinearFilter:LinearFilter;
    return texture;
  }
  function paintSlice(texture,b,slice,corner){
    if(!texture?.image?.width||b.w<=0||b.h<=0)return;
    const mesh=surface.image(texture,b.x,b.y,b.w,b.h);
    mesh.geometry.dispose();
    mesh.geometry=nineSliceGeometry(b.w,b.h,texture.image.width,texture.image.height,slice,corner);
    return mesh;
  }
  function paint(b,{dpr,bw,bh,safeBottom,mode,message,progress,pressId,focusId,keyboard,copyLabel,drawReport}){
    const w=b.width,h=b.height;
    renderer.setClearColor(0x122b3d,1);renderer.autoClear=false;
    camera.right=w;camera.bottom=h;camera.updateProjectionMatrix();surface.clear();
    if(waitForBackdrop&&mode!=='failed'&&!images.backdrop.image&&!backdropFailed){
      renderer.clear();
      return [];
    }
    const layout=entryLayout(w,h,safeBottom,mode,Boolean(drawReport));
    const buttons=layout.buttons;
    if(images.backdrop.image)surface.image(images.backdrop,0,0,w,h);
    const status=waitForBackdrop&&backdropFailed&&mode==='ready'?'封面加载失败，可继续游戏':message;
    surface.text(status,w/2,layout.status-layout.size*.09,{size:layout.size,family:uiFont,weight:500,align:'center',color:'#fff',maxWidth:w*.72,
      shadow:{color:'#14263e',y:1,blur:3}});
    if(layout.track){
      const t=layout.track;
      function pixels(r){
        const x=v=>(Math.round((b.x+v)*dpr)-Math.round(b.x*dpr))*w/bw;
        const y=v=>(Math.round((b.y+v)*dpr)-Math.round(b.y*dpr))*h/bh;
        return {x:x(r.x),y:y(r.y),w:x(r.x+r.w)-x(r.x),h:y(r.y+r.h)-y(r.y)};
      }
      paintSlice(images.track,pixels(t),[18,8],[6,3]);
      paintSlice(images.fill,pixels({x:t.x+3,y:t.y+2,w:(t.w-6)*progress/3,h:t.h-4}),[18,6],[5,2]);
    }
    for(const b of buttons){
      const down=pressId===b.id,focus=keyboard&&focusId===b.id;
      const plate=paintSlice(b.id==='start'?images.start:images.retry,{...b,y:b.y+Number(down)},18,9);
      if(plate&&(down||focus))plate.material.color.multiplyScalar(down?1.35:1.40);
      if(!plate)surface.panel(b.x,b.y,b.w,b.h,{fill:'#8e4519',stroke:'#efb779',radius:5});
      const size=clamp(w*.048,16,22);
      surface.text(b.id==='copy'?copyLabel:b.label,w/2,b.y+b.h/2+Number(down),{size,weight:400,family:buttonFont,color:'#fff',
        align:'center',tracking:size*.03,maxWidth:b.w-20,shadow:{color:b.id==='start'?'#763609':'#81500a',y:2,blur:3}});
    }
    drawReport?.(layout.report);
    let order=0;for(const child of surface.group.children)child.renderOrder=order++;
    renderer.clear();renderer.render(scene,camera);
    return buttons;
  }
  return {surface,paint,close(){closed=true;surface.clear();for(const texture of Object.values(images))texture.dispose();}};
}
