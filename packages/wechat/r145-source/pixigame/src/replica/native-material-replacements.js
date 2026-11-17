// Local replacement policy for systems that are not ported. Existing stock
// stays intact until the player exchanges it explicitly in the backpack.
export const MATERIAL_REPLACEMENTS = Object.freeze({3:1,110:113,111:112,129:105,151:112,152:105,154:112,30001:20301});
export function replaceUnavailableMaterials(pairs) {
  const totals=new Map();
  for(const [id,count] of pairs){
    const target=MATERIAL_REPLACEMENTS[id]??id;
    totals.set(target,(totals.get(target)||0)+count);
  }
  return [...totals];
}
