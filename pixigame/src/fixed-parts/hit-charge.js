import { hitChargeGain, hitChargeDecay } from './pathogenic-rules.js';

// hit_charge: each confirmed projectile contact supplies all connected owners.
// Root attribution/de-duplication remains the combat runtime's responsibility.
export function createHitCharge(connectors) {
  const state=Object.fromEntries(connectors.map(c=>[c.id,{value:0,capacity:1,gain:hitChargeGain(0),decay:hitChargeDecay(0),active:c.active,lastHit:-Infinity,hold:0,combo:false,combos:0}]));
  const rounds=new Map();
  let disposed=false;
  return {
    state,
    configure(nodes){for(const c of connectors){const has=k=>(nodes[c.id]||[]).includes(`FP-C02-${k}`),s=state[c.id];
      s.gain=has('A1')?.3:.1;s.decay=(has('S')?.5:1)*(has('B2')?.25:1);s.hold=has('B1')?.6:0;s.combo=has('A2');
    }},
    tick(start,end){if(disposed)return;for(const s of Object.values(state)){const decayTime=Math.max(0,end-Math.max(start,s.lastHit+s.hold));s.value=Math.max(0,s.value-s.decay*decayTime);}
      for(const [key,r] of rounds)if(end-r.time>4)rounds.delete(key);
    },
    credit(source,time,gainMultiplier=()=>1){if(disposed)return;for(const c of connectors){if(!c.active||!c.beneficiaries.includes(source.weaponId))continue;
      const s=state[c.id];s.lastHit=time;s.value=Math.min(s.capacity,s.value+s.gain*gainMultiplier(c));
      if(s.combo){const key=`${c.id}/${source.groupId}`,r=rounds.get(key)||{hits:0,time};rounds.set(key,r);if(++r.hits===3){s.value=s.capacity;s.combos++;}}
    }},
    chargeFor(weaponId){return disposed?0:connectors.reduce((v,c)=>v+(c.active&&c.beneficiaries.includes(weaponId)?state[c.id].value:0),0);},
    dispose(){disposed=true;rounds.clear();for(const s of Object.values(state))s.value=0;},
  };
}
