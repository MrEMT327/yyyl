// Each root owns a bounded set of derived effects. Derived effects never enter
// this factory again, and only this whitelist of source fields is inherited.
export function createDerivedBudget(runId) {
  const used=new Map();
  return {
    create(source,module,targetId,damage,maxDamage,time) {
      const allowed=['perforation','pincer','rail-hole','aftershock','trail','lock-trail','rail-boss','focus-weak','focus-beam','bridge-mark'].includes(module)
        || ['energy-prism-refract','energy-prism-solitary','energy-tesla-chain','energy-tesla-return','energy-tesla-discharge','energy-tesla-burst','energy-tesla-trail','energy-tesla-circuit'].includes(module)
        || /^energy-prism-fan\/W[1-6]\/[0-3]$/.test(module)
        || /^(rocket-echo|rocket-second)\/W[1-6]$/.test(module)
        || /^bridge-(mark-blast|echo)\/pilot-\d{2}\/bridge$/.test(module);
      if(source?.runId!==runId||source.kind!=='root'||(source.depth||0)>0||!allowed||!(damage>0))return null;
      for(const [key,at] of used)if(time-at>5)used.delete(key);
      const key=`${source.groupId}/${module}/${targetId}`;
      if(used.has(key))return null;used.set(key,time);
      return {damage:Math.min(damage,maxDamage),source:{runId,groupId:source.groupId,weaponId:source.weaponId,projectileId:key,kind:'derived',depth:1,module}};
    },
    clear(){used.clear();},
  };
}
