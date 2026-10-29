function projection(ray,target) {
  const dx=target.x-ray.x,dy=target.y-ray.y,along=dx*ray.dx+dy*ray.dy;
  const lateral=Math.abs(dx*ray.dy-dy*ray.dx);
  return {along,inside:along>=-(target.radius||0)&&along<=ray.length+(target.radius||0)&&lateral<=ray.width+(target.radius||0)};
}

// Pure world effects: no HP writes and no root callbacks. The caller applies
// returned derived events to live targets and records actual HP loss.
export function createFixedRays(derived) {
  let rays=[], delayed=[], flashes=[];
  const flights=new Map();
  return {
    launch(shot,muzzle,angle,height,time,targets) {
      const ray={id:shot.source.projectileId,source:shot.source,slotId:shot.slotId,
        x:muzzle.x,y:muzzle.y,dx:Math.sin(angle),dy:-Math.cos(angle),length:0,maxLength:shot.speedRatio*height*shot.life,
        width:shot.radius,at:time,life:shot.life,hit:new Set(),seen:new Set(),initial:new Set(),previous:new Map(),
        lock:shot.lock,damage:shot.baseDamage*shot.slots*.35,slots:shot.slots,ended:false};
      flights.set(ray.id,ray);
      if(shot.aftershock)delayed.push({...ray,length:ray.maxLength,at:time+.4,module:'aftershock',limit:5,attenuation:.8,damage:shot.baseDamage*shot.slots*.35});
      if(shot.trail){
        ray.until=time+shot.life+(shot.lock?1.2:.45);
        for(const t of targets)if(projection({...ray,length:ray.maxLength},t).inside)ray.initial.add(t.id);
        rays.push(ray);
        if(shot.lock){const same=rays.filter(r=>r.slotId===ray.slotId&&r.source.weaponId===ray.source.weaponId);
          const keep=[...new Set(same.map(r=>r.id))].slice(-2);
          rays=rays.filter(r=>!same.includes(r)||keep.includes(r.id));}
      }
    },
    advance(source,x,y,hitIds,ended,time){const r=flights.get(source.projectileId);if(!r)return;
      r.length=Math.min(r.maxLength,Math.max(0,(x-r.x)*r.dx+(y-r.y)*r.dy));
      for(const id of hitIds)r.hit.add(id);
      if(ended&&!r.ended){r.ended=true;if(r.until)r.until=time+(r.lock?1.2:.45);flights.delete(r.id);}
    },
    bounce(source,x,y,angle,time,targets){
      const old=flights.get(source.projectileId);if(!old)return;
      old.length=Math.min(old.maxLength,Math.max(0,(x-old.x)*old.dx+(y-old.y)*old.dy));
      old.ended=true;if(old.until)old.until=time+(old.lock?1.2:.45);
      const ray={...old,x,y,dx:Math.sin(angle),dy:-Math.cos(angle),length:0,
        maxLength:Math.max(0,old.maxLength-old.length),at:time,life:Math.max(0,old.life-(time-old.at)),
        previous:new Map(),initial:new Set(),ended:false};
      if(old.until&&rays.includes(old)){
        ray.until=time+ray.life+(ray.lock?1.2:.45);
        for(const t of targets)if(projection({...ray,length:ray.maxLength},t).inside)ray.initial.add(t.id);
        rays.push(ray);
      }
      flights.set(ray.id,ray);
    },
    beam(source,point,angle,height,damage,time){delayed.push({source,x:point.x,y:point.y,dx:Math.sin(angle),dy:-Math.cos(angle),length:height*.1,width:6,damage,at:time,module:'focus-beam',limit:3,attenuation:1});},
    boss(source,targetId,damage,time){delayed.push({source,targetId,damage,at:time+.2,module:'rail-boss'});},
    step(time,targets){
      const events=[];
      for(const ray of delayed.filter(r=>r.at<=time+1e-9)){
        const contacts=ray.targetId!==undefined?targets.filter(t=>t.id===ray.targetId):targets.filter(t=>projection(ray,t).inside).sort((a,b)=>projection(ray,a).along-projection(ray,b).along).slice(0,ray.limit);
        contacts.forEach((t,i)=>{const damage=ray.damage*(ray.attenuation??1)**i;
          const event=derived.create(ray.source,ray.module,t.id,damage,ray.damage,time);if(event)events.push({...event,targetId:t.id});});
        if(ray.length)flashes.push({...ray,until:time+.16});
      }
      delayed=delayed.filter(r=>r.at>time+1e-9);
      for(const ray of rays){
        for(const t of targets){
          const p=projection(ray,t),prev=ray.previous.get(t.id);
          // A fast enemy can cross a thin line entirely between frames.
          const side=(t.x-ray.x)*ray.dy-(t.y-ray.y)*ray.dx;
          const crossing=prev&&prev.side*side<0&&Math.min(prev.along,p.along)<=ray.length&&Math.max(prev.along,p.along)>=0;
          ray.previous.set(t.id,{side,along:p.along});
          if(!(p.inside||crossing)||ray.seen.has(t.id)||time>ray.until)continue;
          if(ray.lock&&ray.initial.has(t.id)&&time-ray.at<.2)continue;
          if(!ray.lock&&(ray.initial.has(t.id)||ray.hit.has(t.id)))continue;
          const damage=ray.lock?ray.damage:6*ray.slots;
          const event=derived.create(ray.source,ray.lock?'lock-trail':'trail',t.id,damage,damage,time);
          ray.seen.add(t.id);if(event)events.push({...event,targetId:t.id});
        }
      }
      rays=rays.filter(r=>time<=r.until);flashes=flashes.filter(r=>time<=r.until);
      for(const [id,r] of flights)if(time-r.at>r.life+.1)flights.delete(id);
      return events;
    },
    visuals(time){return [...rays,...flashes].map(r=>({x:r.x,y:r.y,x2:r.x+r.dx*r.length,y2:r.y+r.dy*r.length,
      width:r.module==='focus-beam'?4:r.module==='aftershock'?5:r.lock?3:1.5,
      alpha:r.module?.includes('shock')?.65:r.module==='focus-beam'?.85:r.lock?.38:.2,
      color:r.module==='focus-beam'?0x9bf8a2:0x6ae8ef}));},
    clear(){rays=[];delayed=[];flashes=[];flights.clear();},
  };
}
