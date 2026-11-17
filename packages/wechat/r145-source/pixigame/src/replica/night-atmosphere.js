import {createCityWindowStamps} from './city-window-stamps.js';
import {createLavaEmissionStamps} from './lava-emission-stamps.js';
import {createLavaMotion} from './lava-motion-renderer.js';

// Small cached additive stamps; no full-screen blur, new fog, simulation RNG
// or independent clock. Lamps and combat light stay below actors and HUD.
export function sampleNightCombatLights(effects,projectPoint,reducedMotion=false){
  if(reducedMotion||!projectPoint)return [];
  const lights=[];
  for(const fx of effects??[]){
    if(fx.kind!=='muzzle'&&fx.kind!=='explosion')continue;
    if(!Number.isFinite(fx.duration)||fx.duration>2)continue; // held beams / warning markers
    const duration=fx.kind==='muzzle'?.065:.18;
    if(!(fx.age>=0&&fx.age<duration))continue;
    const p=projectPoint(fx.x,fx.z);if(!Number.isFinite(p.x+p.y))continue;
    const blast=fx.kind==='explosion',fade=(1-fx.age/duration)**2;
    lights.push({x:p.x,y:p.y,size:blast?Math.min(140,58+Math.max(0,fx.size)*9):66,
      strength:(blast?.20:.105)*fade,color:blast?0xffb16a:0xffdc9b});
    if(lights.length>=8)break;
  }
  return lights;
}

export function createNightAtmosphere(scene,key){
  let canvas,windowCanvas,streetCanvas,pool=[];
  const buildingStamps=createCityWindowStamps(scene,`${key}-city`);
  const lavaStamps=createLavaEmissionStamps(scene,`${key}-lava`);
  const lavaMotion=createLavaMotion(scene,`${key}-lava-flow`);
  function prepare(){
    if(canvas)return;
    canvas=document.createElement('canvas');canvas.width=canvas.height=64;
    const ctx=canvas.getContext('2d'),glow=ctx.createRadialGradient(32,32,0,32,32,32);
    glow.addColorStop(0,'rgba(255,255,255,1)');glow.addColorStop(.10,'rgba(255,255,255,.88)');
    glow.addColorStop(.24,'rgba(255,255,255,.47)');glow.addColorStop(.46,'rgba(255,255,255,.18)');
    glow.addColorStop(.70,'rgba(255,255,255,.045)');
    glow.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,64,64);
    scene.textures.addCanvas(key,canvas);
  }
  function prepareStreet(){
    if(streetCanvas)return;
    // A broad, soft pool of reflected light is separate from the tiny lamp.
    // The flat central falloff lights the paving instead of reading as a spark.
    streetCanvas=document.createElement('canvas');streetCanvas.width=streetCanvas.height=96;
    const ctx=streetCanvas.getContext('2d'),glow=ctx.createRadialGradient(48,48,0,48,48,48);
    for(const [stop,alpha]of [[0,.66],[.2,.58],[.45,.31],[.7,.10],[.9,.018],[1,0]])
      glow.addColorStop(stop,'rgba(255,255,255,'+alpha+')');
    ctx.fillStyle=glow;ctx.fillRect(0,0,96,96);scene.textures.addCanvas(`${key}-street-ground`,streetCanvas);
  }
  function prepareWindow(){
    if(windowCanvas)return;
    windowCanvas=document.createElement('canvas');windowCanvas.width=64;windowCanvas.height=32;
    const ctx=windowCanvas.getContext('2d');ctx.fillStyle='rgba(255,255,255,.96)';ctx.fillRect(2,2,60,28);
    scene.textures.addCanvas(`${key}-window`,windowCanvas);
  }
  return {
    update(enabled,landmarks=[],flashes=[],emissionStrength=1,reducedMotion=false){
      lavaMotion.begin(reducedMotion);
      const selected=enabled?landmarks:landmarks.filter(light=>light.shape==='lava-surface');
      const lights=[...selected.slice(0,24),...(enabled?flashes.slice(0,8):[])];
      if(!lights.length){for(const pair of pool)for(const image of pair)image.setVisible(false);return;}
      prepare();
      while(pool.length<lights.length)pool.push([0,1].map(()=>scene.add.image(0,0,key).setBlendMode('ADD').setDepth(18).setScrollFactor(0).setName('project-night-local-light')));
      for(let i=0;i<pool.length;i++){
        const light=lights[i],[halo,core]=pool[i];
        halo.setVisible(Boolean(light));core.setVisible(Boolean(light));if(!light)continue;
        halo.setRotation?.(0);core.setRotation?.(0);
        if(light.shape==='lava-surface'){
          const stamps=lavaStamps.get(light.emissionAsset,light.sourceImage);
          if(!stamps){halo.setVisible(false);core.setVisible(false);continue;}
          halo.setTexture(stamps.haloKey);core.setTexture(stamps.coreKey);
          for(const image of [halo,core])image.setPosition(light.x,light.y).setDisplaySize(light.coreWidth,light.coreHeight)
            .setRotation(light.angle??0).setTint(0xffffff);
          halo.setAlpha(light.strength*emissionStrength*.70);core.setAlpha(light.strength*emissionStrength*.88);
          lavaMotion.bindCore(core,light,stamps);continue;
        }
        lavaMotion.resetCore(core);
        if(light.shape==='building-windows'){
          const stamps=buildingStamps.get(light.windowAsset);if(!stamps){halo.setVisible(false);core.setVisible(false);continue;}
          halo.setTexture(stamps.haloKey);core.setTexture(stamps.coreKey);
          for(const image of [halo,core]){
            image.setPosition(light.x,light.y).setDisplaySize(light.coreWidth,light.coreHeight).setTint(light.color);
            image.setRotation?.(light.angle??0);
          }
          halo.setAlpha(light.strength*.72);core.setAlpha(light.strength*.80);continue;
        }
        if(light.shape==='streetlamp'){
          prepareStreet();halo.setTexture(`${key}-street-ground`);
          halo.setPosition(light.poolX??light.x,light.poolY??light.y)
            .setDisplaySize(light.poolWidth??88,light.poolHeight??62).setTint(light.color)
            .setAlpha(Math.min(.82,light.strength*.80));
          halo.setRotation?.(light.poolAngle??0);
          core.setTexture?.(key);core.setPosition(light.x,light.y).setDisplaySize(11,9)
            .setTint(0xffedc7).setAlpha(.98);continue;
        }
        halo.setTexture?.(key);
        // A broad colored bloom stays separate from the small, warm-white hot
        // core. Combat flashes keep a tighter footprint than fixed lamps.
        const spread=light.size>45?1.65:2.6;
        halo.setPosition(light.x,light.y).setDisplaySize(light.size*spread,light.size*spread*.82)
          .setTint(light.color).setAlpha(Math.min(.72,light.strength*.72));
        if(light.shape==='window'){
          prepareWindow();core.setTexture(`${key}-window`);
          core.setPosition(light.x,light.y).setDisplaySize(Math.max(1.2,light.coreWidth),Math.max(1.2,light.coreHeight))
            .setTint(0xffce78).setAlpha(Math.min(.95,light.strength*.9));
        }else{
          core.setTexture?.(key);
          core.setPosition(light.x,light.y).setDisplaySize(light.size*.62,light.size*.48)
            .setTint(0xfff0d4).setAlpha(Math.min(1,light.strength*1.15));
        }
      }
    },
    dispose(){
      lavaMotion.dispose();for(const pair of pool)for(const image of pair)image.destroy();pool=[];buildingStamps.dispose();lavaStamps.dispose();
      if(canvas){if(scene.textures?.exists(key))scene.textures.remove(key);canvas.width=canvas.height=0;canvas=null;}
      if(windowCanvas){if(scene.textures?.exists(`${key}-window`))scene.textures.remove(`${key}-window`);windowCanvas.width=windowCanvas.height=0;windowCanvas=null;}
      if(streetCanvas){if(scene.textures?.exists(`${key}-street-ground`))scene.textures.remove(`${key}-street-ground`);streetCanvas.width=streetCanvas.height=0;streetCanvas=null;}
    },
  };
}
