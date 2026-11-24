export function recruitItems(s){return s.pilots||[];}
// Show the actual recruitment candidates, excluding the two base pilots.
export function recruitBoxItems(s){
  if(!s.pilotSupply)return recruitItems(s);
  const ids=new Set(s.pilotSupply.candidates.map(row=>row.skinId));
  return recruitItems(s).filter(row=>ids.has(row.id));
}
export function recruitFeatured(s,selected){const items=recruitItems(s);return items.find(x=>x.id===selected)||items.find(x=>x.id==='pilot-01')||items[0];}
