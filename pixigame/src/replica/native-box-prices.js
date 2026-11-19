import source from './native-acquisition-catalog.json' with {type:'json'};
// Shared original price projection. Do not derive Ten from Single: the source
// owns both prices, and a future single-price array needs an actual DTO index.
export function nativeEquipmentBoxPrices(pool){
 const id=pool==='basic'?4:pool==='advanced'?3:Number(pool);
 if(![3,4].includes(id))throw Error('未知装备宝箱');
 const row=source.boxes.find(row=>row.ID===id);
 return {id,keyId:row.Key_ID,single:row.Single.length===1?row.Single[0]:null,ten:row.Ten};
}
