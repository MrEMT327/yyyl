import source from './native-acquisition-catalog.json' with {type:'json'};
// Single and ten-draw prices are shared by the quote and the debit.
export function nativeEquipmentBoxPrices(pool){
 const id=pool==='basic'?4:pool==='advanced'?3:Number(pool);
 if(![3,4].includes(id))throw Error('未知装备宝箱');
 const row=source.boxes.find(row=>row.ID===id);
 const wechatAdvanced = id === 3 && globalThis.__THUNDER_RUNTIME_GLOBALS__?.platformKind === 'wechat';
 const ten = wechatAdvanced ? 1000 : row.Ten;
 return {id,keyId:row.Key_ID,single:row.Single.length===1?row.Single[0]:null,ten};
}
