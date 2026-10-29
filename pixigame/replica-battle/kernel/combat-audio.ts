import type { Projectile, Enemy } from './model';

// Presentation choices only. Negative IDs are local audio events, never native IDs.
const files: Record<string,string> = {
  gun:'shots/gun_shot.wav', sniper:'shots/sniper_shot.wav', cannon:'shots/cannon_shot.wav',
  grenade:'shots/grenade_launcher.wav', shotgun:'shots/shotgun.wav', sword:'shots/sword_slash.wav',
  lightning:'shots/lightning.wav', laser:'shots/laser_shot.wav', laserLoop:'shots/wall_spider_laser_looped.wav',
  impact:'shot_hit.wav', hit:'enemy_hit1.wav', playerHit:'player_hit2.wav', death:'enemy_death_normal.wav', heavyDeath:'enemy_death_long.wav',
  hit2:'enemy_hit2.wav', hit3:'enemy_hit3.wav', hit4:'enemy_hit4.wav', enemyShot:'shots/macrophage_shot.wav', deflect:'shots/deflect_shot.wav',
  charge:'shots/noise_charge.wav', laserCharge:'shots/beholder_laser_charge.wav', swordHit:'shots/sword_impact_gore2.wav',
  explosion:'shots/Explosion.wav',
  pickup:'pickup_sound.wav', heal:'heal_sfx2.wav', upgrade:'upgrade_sound.wav',
  bossArrival:'beholder_spawn.wav', eliteArrival:'scolex_spawn.wav', specialPickup:'plasmid_pickup.wav',
  burn:'shots/flamethrower.wav', revive:'heal_effect.wav',
};
export const pathogenicAudioManifest = { ...Object.fromEntries(Object.entries(files).map(([key,file])=>[
  `pathogenic:${key}`, {url:`/audio/pathogenic/${file}`, ...(key==='laserLoop'?{pingPong:{begin:10000,end:110000,sampleRate:44100}}:{})}
])),
  'mixkit:ice':{url:'/audio/mixkit/ice-sparkle-2350.wav'},
  'mixkit:acid':{url:'/audio/mixkit/acid-bubble-3000.wav'},
  'mixkit:shield':{url:'/audio/mixkit/shield-power-1679.wav'},
  'mixkit:bossDeath':{url:'/audio/mixkit/boss-explosion-2759.wav'},
  'mixkit:victory':{url:'/audio/mixkit/victory-2063.wav'},
  'mixkit:defeat':{url:'/audio/mixkit/defeat-2042.wav'},
};
type Cue = {key:string;volume:number;interval:number};
const cue=(key:string,volume:number,interval:number):Cue=>({key:`pathogenic:${key}`,volume,interval});
export const combatCues: Record<number,Cue> = {
  [-1]:cue('gun',.18,.075), [-2]:cue('sniper',.22,.14), [-3]:cue('cannon',.25,.18),
  [-4]:cue('grenade',.23,.18), [-5]:cue('sword',.20,.18), [-6]:cue('lightning',.16,.18),
  [-7]:cue('laser',.12,.28), [-8]:cue('shotgun',.22,.14), [-9]:cue('hit',.075,.12), [-10]:cue('impact',.24,.18), [-11]:cue('heavyDeath',.21,.25), [-12]:cue('death',.15,.14),
  [-13]:cue('enemyShot',.065,.18), [-14]:cue('deflect',.085,.18),
  [-15]:cue('gun',.10,.12), [-16]:cue('lightning',.10,.20),
  [-17]:cue('sniper',.10,.14), [-18]:cue('swordHit',.075,.16),
  [-19]:cue('sword',.085,.18), [-20]:cue('explosion',.09,.45),
  [-21]:cue('laser',.075,.24),
  [-22]:{key:'mixkit:acid',volume:.07,interval:.24},
  [-23]:{key:'mixkit:shield',volume:.055,interval:.8},
  [-25]:{key:'mixkit:ice',volume:.08,interval:.7},
  [-26]:{key:'mixkit:bossDeath',volume:.18,interval:.5},
  [-24]:cue('eliteArrival',.14,3),
  100007:cue('bossArrival',.14,3),
  270001:cue('revive',.24,.5), 270012:cue('burn',.065,.3), 270015:cue('specialPickup',.16,.25),
  260002:cue('pickup',.24,.07), 260003:cue('heal',.36,.3), 410001:cue('upgrade',.38,.4),
  330001:cue('playerHit',.38,.20), 330002:cue('hit',.075,.12),330003:cue('hit',.075,.12),330004:cue('hit',.075,.12),
  330005:cue('death',.15,.14),330006:cue('death',.15,.14),330007:cue('heavyDeath',.21,.25),
  330008:cue('heavyDeath',.21,.25),210001:cue('heavyDeath',.21,.25),
};
// Verified skill projectiles, not a global replacement of original sound IDs.
// Mixkit trials are scoped to identified ice blade, acid projectiles, and shields. Managed missiles sound only at release.
const skillGuns = new Set([200151,200152,200156]);
const skillLightning = new Set([350001,350003,360014,360015,400033,400041]);
// Existing dimension slash and Iaijutsu (including the upgraded travelling slash).
const skillSlashes = new Set([360011,400006,400007,400019]);
// Guangmang and Phantom are projectile ray volleys.
const skillRays = new Set([400002,400010]);
const skillLasers = new Set([360017,400027]);
type AudioProjectile = Pick<Projectile,'owner'|'familyId'|'beam'|'trajectory'> & Partial<Pick<Projectile,'weaponId'>>;
export function continuousCue(b: AudioProjectile) {
  if(b.owner!=='player')return b.beam && /laser|reflectionray/i.test(b.trajectory||'') ? 'laserLoop' : undefined;
  if(skillLasers.has(b.weaponId||0)&&b.beam)return 'laserLoop';
  if([200121,200171].includes(b.familyId)&&b.beam)return 'laserLoop';
  if((b.familyId===200001&&b.beam)||(b.familyId===200011&&(b.beam||b.trajectory==='SectorSpreadMod')))return 'lightning';
  return undefined;
}
export function projectileSound(b: AudioProjectile & Pick<Projectile,'modelId'>, original:number, primaryFamily=200151) {
  if(b.owner!=='player')return !b.beam && b.trajectory==='MoveStraight' ? -13 : 0;
  if(skillRays.has(b.weaponId||0))return -21;
  if([200061,400020,400021].includes(b.weaponId||0))return -22; // Acid gun and bubble volley.
  if([400035,400036,400037].includes(b.weaponId||0))return -23; // Shield launch.
  if(b.weaponId===200031)return -25; // Ice blade launch.
  if(skillSlashes.has(b.weaponId||0))return -19;
  if(b.weaponId===10001)return -20; // Verified shockwave pickup; the actual blast owns its sound.
  const family=b.familyId||primaryFamily;
  const continuous=continuousCue({...b,familyId:family});
  if(continuous)return 0; // Audible lifetime, including warmup, is handled by live projectiles.
  if(family!==200151 && skillGuns.has(b.weaponId||0))return -15;
  if(skillLightning.has(b.weaponId||0))return -16;
  if(family===200151&&original===300010)return -8;
  if(family===200151)return b.modelId===1000049?-2:b.modelId===1000050?-3:-1;
  if(family===200041)return b.trajectory==='OverLapShapeAndStay'?-10:-4;
  if(family===200101)return -5;
  if(family===200011||family===200001)return -6;
  if(family===200121||family===200171)return -7;
  return original; // Other ice, poison, black hole and unknown branches retain their existing sound.
}
export function activeCombatSounds(projectiles:Projectile[], playing:boolean, enemies:Enemy[]=[] ) {
  if(!playing)return [];
  const keys=new Map<string,number>();
  for(const b of projectiles){
    if(b.dead||b.held||b.collisionDisabled||b.damageDisabled||b.age<b.warmup)continue;
    if(['Thunder','FlashChain','FollowFlashChain','SectorSpreadMod'].includes(b.trajectory||'')&&!b.segments?.length)continue;
    if(b.owner==='enemy'&&!enemies.some(e=>e.uid===b.ownerUid&&!e.dead&&e.hp>0))continue;
    const key=continuousCue(b);if(key){
      const volume=b.owner==='enemy'?.065:skillLasers.has(b.weaponId)?.075:key==='laserLoop'?.12:.16;
      keys.set(key,Math.max(keys.get(key)||0,volume));
    }
  }
  return [...keys].map(([key,volume])=>({key:`pathogenic:${key}`,volume,pulse:key==='lightning'}));
}
