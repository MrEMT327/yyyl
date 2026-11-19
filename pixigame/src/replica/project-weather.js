import {createBattleWeather,weatherNoise} from './battle-weather.js';
import {cloudAssetBase} from '../ui/cloud-asset-base.js';
import {createNightAtmosphere,sampleNightCombatLights} from './night-atmosphere.js';

// Short, quiet rain strokes; presentation values only. The weather model,
// drop count and wind trajectory are presentation-only values.
const RAIN_STREAKS=Object.freeze([
  Object.freeze({width:.65,opacity:.11,length:9,variation:4}),
  Object.freeze({width:.9,opacity:.19,length:14,variation:6}),
  Object.freeze({width:1.15,opacity:.3,length:21,variation:8}),
]);
let serial=0;
const wrap=(value,period)=>(value%period+period)%period;
const mixColor=(from,to,t)=>{
  let value=0;for(const shift of [16,8,0])value|=Math.round(((from>>shift)&255)*(1-t)+((to>>shift)&255)*t)<<shift;
  return value;
};

// Terrain/cloud grading is behind actors; a few near raindrops sit above the
// player. Brief lightning wash stays below health bars and HUD.
export function createProjectWeather({width=540,height=960,random}={}){
  const model=createBattleWeather({random}),id=++serial;
  const reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const ownedKeys=[`project-weather-atmosphere-${id}`,`project-weather-flash-${id}`,
    `project-weather-bank-${id}`,`project-weather-cloud-${id}`];
  let scene,background,atmosphere,cloudFlash,rain,nearRain,lightning,screenFlash,canvas,flashCanvas,texture;
  let last=null,particles=[],clouds=[],disposed=false;
  let nightLighting,nightLandmarks=[],nightFrame=null;
  function paintAtmosphere(profile){
    const w=canvas.width,h=canvas.height,ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);
    const wash=ctx.createLinearGradient(0,0,0,h);
    const colors=profile.id==='day'?['rgba(255,227,167,.10)','rgba(226,244,255,0)','rgba(88,153,209,.035)']:
      profile.id==='night'?['rgba(11,20,57,.23)','rgba(17,39,78,.055)','rgba(4,13,40,.20)']:
      profile.id==='rain'?['rgba(66,91,119,.18)','rgba(166,191,210,.025)','rgba(71,102,132,.10)']:
      ['rgba(10,19,37,.32)','rgba(43,60,85,.09)','rgba(12,25,46,.22)'];
    colors.forEach((color,i)=>wash.addColorStop(i/2,color));ctx.fillStyle=wash;ctx.fillRect(0,0,w,h);
    if(profile.id!=='night'){
      const light=ctx.createRadialGradient(w*.85,h*.07,0,w*.85,h*.07,w*.95);
      light.addColorStop(0,'rgba(219,235,248,.055)');light.addColorStop(1,'rgba(180,215,255,0)');
      ctx.fillStyle=light;ctx.fillRect(0,0,w,h);
    }
    const edge=ctx.createRadialGradient(w*.5,h*.45,w*.27,w*.5,h*.45,h*.65);
    edge.addColorStop(0,'rgba(1,12,35,0)');edge.addColorStop(1,`rgba(1,12,35,${profile.id==='day' ? .07 : profile.id==='night' ? .22 : .28})`);
    ctx.fillStyle=edge;ctx.fillRect(0,0,w,h);texture.refresh();
  }
  function seedRain(seed,count){
    particles=Array.from({length:count},(_,i)=>{
      const z=i%3,n=seed+i*17;
      return {x:weatherNoise(n+1)*(width+180),y:weatherNoise(n+2)*(height+180),z,
        speed:330+z*210+weatherNoise(n+3)*150,length:RAIN_STREAKS[z].length+weatherNoise(n+4)*RAIN_STREAKS[z].variation};
    });
  }
  function drawRain(state){
    rain.clear();nearRain.clear();if(!state.profile.rain)return;
    const {time,profile}=state,phase=time*.43,slope=(profile.wind+Math.sin(phase)*24)/650;
    // Integrate the changing wind instead of multiplying its current value by
    // all elapsed time. The derivative stays aligned with the streak's slope,
    // and absolute battle time keeps pause, skipped frames and rewind exact.
    const drift=(profile.wind*time+(1-Math.cos(phase))*24/.43)/650;
    // Far/middle strokes remain behind aircraft; the nearest strokes are
    // above them. Two batched passes give a faint tail and a short bright head.
    for(let z=0;z<3;z++){
      const layer=z===2?nearRain:rain,style=RAIN_STREAKS[z];
      for(let pass=0;pass<2;pass++){
        const lengthScale=pass===0?1:.45,opacityScale=pass===0?.5:.6;
        layer.lineStyle(style.width,0xc9e7ff,style.opacity*opacityScale);layer.beginPath();
        for(const p of particles){
          if(p.z!==z)continue;
          const x=wrap(p.x+p.speed*drift,width+180)-90,y=wrap(p.y+p.speed*time,height+180)-90;
          const length=p.length*lengthScale;
          layer.moveTo(x,y);layer.lineTo(x-slope*length,y-length);
        }
        layer.strokePath();
      }
    }
  }
  function updateClouds(state){
    const storm=state.profile.id==='storm',opacity=storm ? .84 : state.profile.id==='rain' ? .16 : 0;
    const selected=weatherNoise(state.seed+state.cycle*73+4)<.5?0:1;
    for(const [i,cloud]of clouds.entries()){
      cloud.x=width*(cloud.baseX+Math.sin(state.time*.045+i)*.075);
      cloud.y=height*cloud.baseY+Math.sin(state.time*.06+i*1.3)*42;
      const illumination=storm?state.flash*(i===selected?2.6:.65):0;
      cloud.image.setPosition(cloud.x,cloud.y).setAlpha(opacity*(i<2?1:.64))
        .setTint(mixColor(storm?0x273347:0x7a8ba1,0xd3deed,Math.min(.8,illumination)));
      cloud.veil?.setPosition(cloud.x,cloud.y).setTint(0x34435b).setAlpha(opacity*.12);
    }
    return clouds[selected];
  }
  function drawLightning(state,cloud){
    lightning.clear();if(!state.bolt||!cloud)return;
    const n=state.seed+state.cycle*73,direction=cloud.baseX<.5?1:-1;
    let x=cloud.x-direction*width*.16,y=cloud.y-22;
    const points=[[x,y]];
    // Crawl sideways within the cloud's core, rather than dropping an exposed
    // bolt through the play corridor. A translucent cloud face covers the line.
    for(let i=0;i<9;i++){
      x+=direction*(13+weatherNoise(n+i*23+9)*16);y+=(weatherNoise(n+i*23+10)-.44)*30;
      points.push([x,y]);
    }
    for(const [size,color,alpha] of [[9,0x83a9df,.10],[2.5,0xb5d9ff,.36],[.8,0xecf5ff,.62]]){
      lightning.lineStyle(size,color,alpha).beginPath();lightning.moveTo(...points[0]);
      for(let i=1;i<points.length;i++)lightning.lineTo(...points[i]);
      lightning.moveTo(...points[4]);lightning.lineTo(points[4][0]+direction*20,points[4][1]+21);
      lightning.lineTo(points[4][0]+direction*37,points[4][1]+15);lightning.strokePath();
    }
  }
  return {
    get profile(){return last?.profile;},
    preload(target){
      target.load.image(ownedKeys[2],`${cloudAssetBase}art/stage1-anime-v8/cloud-bank.png`);
      target.load.image(ownedKeys[3],`${cloudAssetBase}art/stage1-anime-v8/cloud-large-b.png`);
    },
    create(target,worldImage){
      scene=target;background=worldImage;
      nightLighting=createNightAtmosphere(scene,`${ownedKeys[0]}-night-light`);
      canvas=document.createElement('canvas');canvas.width=270;canvas.height=480;
      flashCanvas=document.createElement('canvas');flashCanvas.width=270;flashCanvas.height=480;
      const ctx=flashCanvas.getContext('2d'),glow=ctx.createRadialGradient(135,70,0,135,70,250);
      glow.addColorStop(0,'rgba(220,234,255,.9)');glow.addColorStop(.45,'rgba(151,188,239,.45)');glow.addColorStop(1,'rgba(108,149,217,0)');
      ctx.fillStyle=glow;ctx.fillRect(0,0,270,480);
      texture=scene.textures.addCanvas(ownedKeys[0],canvas);scene.textures.addCanvas(ownedKeys[1],flashCanvas);
      atmosphere=scene.add.image(0,0,ownedKeys[0]).setOrigin(0).setDisplaySize(width,height).setDepth(-999).setScrollFactor(0);
      clouds=[[.14,.14,1.6],[.97,.35,1.5],[-.15,.69,1.3],[.86,1.02,1.65]].map(([baseX,baseY,scale],i)=>{
        const image=scene.add.image(0,0,ownedKeys[2+i%2]).setDisplaySize(width*scale,width*scale).setDepth(-998).setScrollFactor(0).setAlpha(0);
        const veil=i<2?scene.add.image(0,0,ownedKeys[2+i%2]).setDisplaySize(width*scale,width*scale).setDepth(-995).setScrollFactor(0).setAlpha(0):null;
        return {baseX,baseY,image,veil};
      });
      cloudFlash=scene.add.image(0,0,ownedKeys[1]).setOrigin(0).setDisplaySize(width,height).setDepth(-997).setScrollFactor(0).setAlpha(0);
      rain=scene.add.graphics().setDepth(-994).setScrollFactor(0).setName('project-weather-rain');
      lightning=scene.add.graphics().setDepth(-996).setScrollFactor(0).setName('project-weather-lightning');
      nearRain=scene.add.graphics().setDepth(26).setScrollFactor(0).setName('project-weather-near-rain');
      screenFlash=scene.add.graphics().setDepth(45).setScrollFactor(0).setName('project-weather-screen-flash');
    },
    update(frame){
      if(disposed||!scene)return;
      nightFrame=frame;
      const state=model.update(frame,reducedMotion?.matches??false);if(state===last)return;
      if(!last||state.revision!==last.revision){
        paintAtmosphere(state.profile);seedRain(state.seed,state.profile.rain);
      }
      background?.setTint(mixColor(state.profile.groundTint,0xcbd8eb,state.flash*.65));
      atmosphere.setAlpha(state.profile.rain ? .92+Math.sin(state.time*.23)*.06 : 1);
      const cloud=updateClouds(state);
      if(cloud)cloudFlash.setPosition(cloud.x-width/2,cloud.y-height*.14);
      cloudFlash.setAlpha(state.flash*.8);drawLightning(state,cloud);drawRain(state);
      screenFlash.clear();if(state.flash>0)screenFlash.fillStyle(0xe1edff,state.flash*.68).fillRect(0,0,width,height);
      last=state;
      nightLighting.update(state.profile.id==='night',nightLandmarks,sampleNightCombatLights(frame.lightingEffects,frame.projectPoint,state.reducedMotion));
    },
    setNightLandmarks(points){
      nightLandmarks=points;
      if(last?.profile.id==='night')nightLighting?.update(true,nightLandmarks,sampleNightCombatLights(nightFrame?.lightingEffects,nightFrame?.projectPoint,last.reducedMotion));
    },
    dispose(){
      if(disposed)return;disposed=true;
      nightLighting?.dispose();nightLandmarks=[];nightFrame=null;
      for(const node of [atmosphere,cloudFlash,rain,nearRain,lightning,screenFlash,...clouds.flatMap(c=>[c.image,c.veil])])node?.destroy();
      // Game teardown may have already destroyed the shared TextureManager.
      // Remove only still-live owned keys, after their display objects.
      const textures=scene?.textures;
      if(textures)for(const key of ownedKeys)if(textures.exists(key))textures.remove(key);
      if(canvas)canvas.width=canvas.height=0;if(flashCanvas)flashCanvas.width=flashCanvas.height=0;
      particles.length=clouds.length=0;last=null;scene=background=texture=null;
    },
  };
}
