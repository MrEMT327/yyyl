import {createBattleWeather,weatherNoise} from '../../replica/battle-weather.js';
import {weatherCloudLayout,selectLightningCloud,sampleWeatherCloudPose} from '../../replica/weather-cloud-motion.js';
import {BattleGeometry} from './three-battle-geometry.js';
import {createWeatherArt} from './weather-art.js';
import {createNightLights} from './night-lights.js';

const drops=[{w:.65,a:.11,length:9,spread:4},{w:.9,a:.19,length:14,spread:6},{w:1.15,a:.3,length:21,spread:8}];
const wrap=(value,period)=>(value%period+period)%period;
function mixColor(from,to,t){
  let v=0;for(const shift of [16,8,0])v|=Math.round(((from>>shift)&255)*(1-t)+((to>>shift)&255)*t)<<shift;return v;
}
function particlesFor(state,w,h){
  const count=state.profile.rain||state.profile.snow||0;
  return Array.from({length:count},(_,i)=>{
    const z=i%3,n=state.seed+i*17;
    return {i,z,x:weatherNoise(n+1)*(w+180),y:weatherNoise(n+2)*(h+180),speed:330+z*210+weatherNoise(n+3)*150,length:drops[z].length+weatherNoise(n+4)*drops[z].spread};
  });
}
function precipitation(state,rows,w,h,far,near){
  far.clear();near.clear();
  const {time,profile}=state,slope=(profile.wind+Math.sin(time*.43)*24)/650;
  const drift=(profile.wind*time+(1-Math.cos(time*.43))*24/.43)/650;
  for(const p of rows){
    const {i,z}=p,g=z===2?near:far;
    if(profile.snow){
      if(i%3!==Math.floor(i/3)%3)continue;
      const x=wrap(p.x+profile.wind*.018*time+Math.sin(i*.71+time*(.32+z*.04))*(7+z*3),w+180)-90;
      const y=wrap(p.y+(22+z*18+p.speed*.025)*time,h+180)-90,r=.65+z*.4,halo=r*2.4;
      if(x<-halo||x>w+halo||y<-halo||y>h+halo)continue;
      g.ellipse(x,y,halo,halo,0xdcecf7,.07+z*.025);g.ellipse(x,y,r,r,0xeaf5ff,.28+z*.08);
    }else{
      const style=drops[z],x=wrap(p.x+p.speed*drift,w+180)-90,y=wrap(p.y+p.speed*time,h+180)-90;
      const tailX=x-slope*p.length,tailY=y-p.length,pad=style.w/2+1;
      if(y<-pad||tailY>h+pad||Math.max(x,tailX)<-pad||Math.min(x,tailX)>w+pad)continue;
      g.line(x,y,tailX,tailY,style.w,0xc9e7ff,style.a*.5);
      g.line(x,y,x-slope*p.length*.45,y-p.length*.45,style.w,0xc9e7ff,style.a*.6);
    }
  }
  far.flush();near.flush();
}
function bolt(g,state,cloud,w){
  g.clear();
  if(state.bolt&&cloud){
    const n=state.seed+state.cycle*73,dir=cloud.baseX<.5?1:-1;
    let x=cloud.x-dir*w*.16,y=cloud.y-22;const points=[[x,y]];
    for(let i=0;i<9;i++){x+=dir*(13+weatherNoise(n+i*23+9)*16);y+=(weatherNoise(n+i*23+10)-.44)*30;points.push([x,y]);}
    const a=points[4],b=[a[0]+dir*20,a[1]+21],c=[a[0]+dir*37,a[1]+15];
    for(const [size,color,alpha] of [[9,0x83a9df,.10],[2.5,0xb5d9ff,.36],[.8,0xecf5ff,.62]]){
      for(let i=1;i<points.length;i++)g.line(...points[i-1],...points[i],size,color,alpha);
      g.line(...a,...b,size,color,alpha);g.line(...b,...c,size,color,alpha);
    }
  }
  g.flush();
}
export function nativeWeather(stage,options){
  const model=createBattleWeather(options),art=createWeatherArt(stage,options.theme);
  const wash=art.sprite(-999),flash=art.sprite(-997),lightning=new BattleGeometry(stage.scene,-996);
  const far=new BattleGeometry(stage.scene,-994),near=new BattleGeometry(stage.scene,26),screenFlash=new BattleGeometry(stage.scene,45);
  const lights=createNightLights(stage,art),motion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const clouds=weatherCloudLayout('day',0).map((_,i)=>({image:art.sprite(-998),veil:art.sprite(-995),key:i%2?'cloud':'bank'}));
  let last=null,lastFrame=null,rows=[],cloudIndex=-1,viewport;
  function update(frame){
    const state=model.update(frame,motion?.matches??false);lastFrame=frame;
    const view=stage.viewport,changed=viewport!==view;
    if(state===last&&!changed)return;
    viewport=view;
    const {left:x,top:y,width:w,height:h}=view;
    for(const mesh of [lightning,far,near,screenFlash])mesh.position.set(x,y,0);
    const {profile,time}=state;
    if(!last||changed||state.revision!==last.revision){
      rows=particlesFor(state,w,h);
      const positions=weatherCloudLayout(profile.id,state.seed);clouds.forEach((c,i)=>Object.assign(c,positions[i]));
    }
    const tint=profile.id==='night'&&options.nightGradeInWorld?0xffffff:profile.groundTint;
    stage.tint(stage.ground,mixColor(tint,0xcbd8eb,state.flash*.65));
    art.place(wash,'wash-'+profile.id,x+w/2,y+h/2,w,h,0xffffff,profile.rain?.92+Math.sin(time*.23)*.06:1);
    const storm=profile.id==='storm'||profile.lightning===true,alpha=storm?.84:profile.id==='rain'?.16:0;
    clouds.forEach((c,i)=>Object.assign(c,sampleWeatherCloudPose(c,i,state,w,h)));
    cloudIndex=selectLightningCloud(clouds,weatherNoise(state.seed+state.cycle*73+4)<.5?0:1,w,h);
    clouds.forEach((c,i)=>{
      const light=storm?state.flash*(i===cloudIndex?2.6:.65):0,size=w*c.scale;
      art.place(c.image,c.key,x+c.x,y+c.y,size,size,mixColor(storm?0x273347:0x7a8ba1,0xd3deed,Math.min(.8,light)),alpha*(i<2?1:.64));
      art.place(c.veil,c.key,x+c.x,y+c.y,size,size,0x34435b,alpha*.12);
    });
    const c=clouds[cloudIndex];if(c)art.place(flash,'flash',x+c.x,y+c.y+h*.36,w,h,0xffffff,state.flash*.8);
    bolt(lightning,state,c,w);precipitation(state,rows,w,h,far,near);
    screenFlash.clear();if(state.flash>0)screenFlash.quad(0,0,w,0,w,h,0,h,0xe1edff,state.flash*.68);screenFlash.flush();
    last=state;
  }
  return {ready:art.ready,update,get profile(){return last?.profile;},
    setNightLandmarks(points){lights.update(points,last,lastFrame);},
    dispose(){art.dispose();lights.dispose();for(const g of [lightning,far,near,screenFlash])stage.remove(g);rows=[];}
  };
}
