const ENEMY_RED=[1,.045,.055,1];
const FRIENDLY_GOLD=[1,.72,.12,1];
const GREEN_SOURCE_BULLETS=new Set([1000000,1000049,1000050,1000063,1000064,1000031]);
export function projectilePalette(b,element=0){
  // Enemy travelling bullets, including toxin shots, must remain recognizable.
  if(b.owner==='enemy'&&!b.beam)return ENEMY_RED;
  // Aircraft attacks can inherit different weapon-family contexts. Bind their
  // palette to the actual emitted weapon, leaving shared source scenes intact.
  if(b.owner==='player'&&b.weaponId===360017)return [.04,.55,1,1];
  if(b.owner==='player'&&b.weaponId===400002)return [1,.94,.72,1];
  if(b.owner==='player'&&b.weaponId===400004)return [.22,1,.12,1];
  if(b.owner==='player'&&b.familyId===200101)return [.025,.4,1,1];
  // The source sniper/cannon/side sprites are green. Keep confirmed toxic
  // attacks green while making non-toxic solid bullets warm gold.
  if(b.owner==='player'&&element!==3&&![200061,200091].includes(b.familyId)){
    if([1000036,1000048,1000062,1000065].includes(b.modelId))return [.08,.55,1,1];
    if(GREEN_SOURCE_BULLETS.has(b.modelId))return FRIENDLY_GOLD;
  }
  return [0,0,0,0];
}
