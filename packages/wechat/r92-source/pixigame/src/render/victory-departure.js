// A render-only formation: never steps weapons, moves colliders, or grants rewards.
export function createVictoryDeparture(player, followers, energy, width, height, started = performance.now()) {
  const origin = {x:player.x, y:player.y};
  const units = followers.map(unit => ({unit,x:unit.x,y:unit.y}));
  const drones = energy.filter(v => v.shape === 'drone' || v.model === 'drone');
  const smooth = value => { const t=Math.max(0,Math.min(1,value)); return t*t*(3-2*t); };
  return {
    frame(now = performance.now()) {
      const age = Math.max(0,now-started);
      const gather = smooth(age/400), flight = Math.max(0,Math.min(1,(age-350)/1300));
      const hero = {x:origin.x+(width*.5-origin.x)*gather*.4, y:origin.y-(origin.y+height*.45)*flight*flight};
      const place = (point,index) => {
        const row=Math.floor(index/2),side=index%2 ? 1 : -1;
        const dx=side*Math.min(width*.22,45+row*10),dy=Math.min(height*.22,48+row*17);
        return {x:hero.x+(point.x-origin.x)*(1-gather)+dx*gather,
          y:hero.y+(point.y-origin.y)*(1-gather)+dy*gather};
      };
      return {hero, followers:new Map(units.map((entry,i)=>[entry.unit,place(entry,i)])),
        energy:drones.map((visual,i)=>{
          const point=place(visual,i+units.length);
          return {...visual,...point,points:[point],angle:(Number(visual.angle)||0)*(1-gather)};
        })};
    },
  };
}
