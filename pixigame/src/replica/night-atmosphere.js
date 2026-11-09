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
  let canvas,windowCanvas,pool=[];
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
  function prepareWindow(){
    if(windowCanvas)return;
    windowCanvas=document.createElement('canvas');windowCanvas.width=64;windowCanvas.height=32;
    const ctx=windowCanvas.getContext('2d');ctx.fillStyle='rgba(255,255,255,.96)';ctx.fillRect(2,2,60,28);
    scene.textures.addCanvas(`${key}-window`,windowCanvas);
  }
  return {
    update(enabled,landmarks=[],flashes=[]){
      if(!enabled){for(const pair of pool)for(const image of pair)image.setVisible(false);return;}
      prepare();
      const lights=[...landmarks.slice(0,24),...flashes.slice(0,8)];
      while(pool.length<lights.length)pool.push([0,1].map(()=>scene.add.image(0,0,key).setBlendMode('ADD').setDepth(18).setScrollFactor(0).setName('project-night-local-light')));
      for(let i=0;i<pool.length;i++){
        const light=lights[i],[halo,core]=pool[i];
        halo.setVisible(Boolean(light));core.setVisible(Boolean(light));if(!light)continue;
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
      for(const pair of pool)for(const image of pair)image.destroy();pool=[];
      if(canvas){if(scene.textures?.exists(key))scene.textures.remove(key);canvas.width=canvas.height=0;canvas=null;}
      if(windowCanvas){if(scene.textures?.exists(`${key}-window`))scene.textures.remove(`${key}-window`);windowCanvas.width=windowCanvas.height=0;windowCanvas=null;}
    },
  };
}
