import policy from './local-equipment-box-pool-policy.json' with {type:'json'};
import catalog from './native-economy-catalog.json' with {type:'json'};
import {RANDOM_WEAPONS,availableWeaponVariants} from './native-weapon-grants.js';
import {RANDOM_AIRCRAFT} from './native-aircraft-grants.js';

export const LOCAL_BOX_POOL_POLICY=policy;
// Local category token, never saved as a native item ID or awarded to inventory.
export const VARIANT_WEAPON_POOL='local/weapon-variants';
export const BASIC_BOX_AIRCRAFT=Object.freeze(policy.basic.aircraftIds.map(id=>{
 const row=RANDOM_AIRCRAFT.find(row=>row.id===id);
 if(!row||catalog.skins.find(row=>row.id===id)?.quality!==40)throw Error('普通箱飞机候选配置无效');
 return row;
}));

export function equipmentBoxCollectionPools(id,progression){
 const config=id===4?policy.basic:id===3?policy.advanced:null;
 if(!config)throw Error('未知装备宝箱');
 const variants=id===3?availableWeaponVariants(progression):[];
 const variantWeight=variants.length?config.variantWeight:0;
 return {base:RANDOM_WEAPONS,variants,aircraft:id===4?BASIC_BOX_AIRCRAFT:RANDOM_AIRCRAFT,
   baseWeight:config.baseWeaponWeight+config.variantWeight-variantWeight,variantWeight,aircraftWeight:config.aircraftWeight,
   equipmentWeights:config.equipmentWeights};
}

/** One conditional sample per category: preview fractions are display-only.
 * The actual sampler uses integer category tickets, then a uniform integer index. */
export function equipmentBoxCollectionRates(pools){
 const rate=(id,name,rows,weight)=>({id,name,weight,denominator:policy.denominator,
   items:rows.map(row=>({id:row.id,count:1,name:row.name,weight:weight/rows.length}))});
 return [rate('weapons','基础武器',pools.base,pools.baseWeight),
   ...(pools.variantWeight||pools.variants.length?[rate('variants','武器变体',pools.variants,pools.variantWeight)]:[]),
   rate('aircraft','随机飞机',pools.aircraft,pools.aircraftWeight)];
}
