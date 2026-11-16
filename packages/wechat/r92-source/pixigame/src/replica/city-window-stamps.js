import {CITY_NIGHT_WINDOWS,CITY_WINDOW_SOURCE_SIZE} from '../three/city-night-lights.js';

/** Cached, transparent emissive masks only; original building art is untouched. */
export function createCityWindowStamps(scene,prefix){
  const cache=new Map();
  return {
    get(asset){
      if(cache.has(asset))return cache.get(asset);
      const panes=CITY_NIGHT_WINDOWS[asset];if(!panes)return null;
      const core=document.createElement('canvas'),halo=document.createElement('canvas');
      core.width=core.height=halo.width=halo.height=256;
      const c=core.getContext('2d'),h=halo.getContext('2d'),scale=256/CITY_WINDOW_SOURCE_SIZE;
      for(const [sx,sy,sw,sh]of panes){
        const x=sx*scale,y=sy*scale,w=sw*scale,height=sh*scale;
        c.fillStyle='rgba(255,255,255,.94)';c.fillRect(x,y,w,height);
        const cx=x+w/2,cy=y+height/2,radius=Math.max(w,height)*1.05+5;
        const glow=h.createRadialGradient(cx,cy,0,cx,cy,radius);
        glow.addColorStop(0,'rgba(255,255,255,.72)');glow.addColorStop(.3,'rgba(255,255,255,.24)');
        glow.addColorStop(.65,'rgba(255,255,255,.055)');glow.addColorStop(1,'rgba(255,255,255,0)');
        h.fillStyle=glow;h.fillRect(cx-radius,cy-radius,radius*2,radius*2);
      }
      const result={coreKey:`${prefix}-${asset}-core`,haloKey:`${prefix}-${asset}-halo`,core,halo};
      scene.textures.addCanvas(result.coreKey,core);scene.textures.addCanvas(result.haloKey,halo);cache.set(asset,result);return result;
    },
    dispose(){
      for(const {coreKey,haloKey,core,halo}of cache.values()){
        for(const key of [coreKey,haloKey])if(scene.textures?.exists(key))scene.textures.remove(key);
        core.width=core.height=halo.width=halo.height=0;
      }
      cache.clear();
    },
  };
}
