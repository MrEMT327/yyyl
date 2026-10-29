// Conduit passes neighboring modifiers once. A modifier owns its charge and
// growth even when its effect reaches a weapon through a bridge.
export function resolveFixedConnections(instances, graph) {
 const weapons=instances.filter(x=>x.kind==='weapon'),connectors=instances.filter(x=>x.kind==='connector');
 const direct=c=>weapons.filter(w=>w.slots.some(s=>graph[c.slots[0]].has(s))).map(w=>w.id);
 const bridges=connectors.filter(c=>c.itemId==='bridge');
 const modifiers=connectors.filter(c=>c.itemId!=='bridge').map(c=>{
  const directBeneficiaries=direct(c),routes=bridges.filter(b=>graph[b.slots[0]].has(c.slots[0]))
   .flatMap(b=>direct(b).filter(id=>!directBeneficiaries.includes(id)).map(weaponId=>({bridgeId:b.id,weaponId})));
  const beneficiaries=[...new Set([...directBeneficiaries,...routes.map(r=>r.weaponId)])];
  return {...c,directBeneficiaries,routes,beneficiaries,active:!!beneficiaries.length,inactiveReason:beneficiaries.length?'':'没有可受益武器'};
 });
 return connectors.map(c=>{
  if(c.itemId!=='bridge')return modifiers.find(m=>m.id===c.id);
  const sources=modifiers.filter(m=>m.routes.some(r=>r.bridgeId===c.id)).map(m=>m.id);
  const beneficiaries=sources.length?direct(c):[];
  return {...c,sources,beneficiaries,active:!!beneficiaries.length,inactiveReason:beneficiaries.length?'':direct(c).length?'旁边需要储能或聚焦连接器':'本段没有武器'};
 });
}
