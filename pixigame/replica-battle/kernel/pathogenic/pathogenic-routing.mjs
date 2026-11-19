// Visual migration choices, not an assertion that the two games share weapon IDs.
// Every binding names a complete source scene. Original gameplay still owns hits.
const projectile = name => `res://scn/player/projectiles/${name}.tscn`;
const particle = name => `res://scn/particles/${name}.tscn`;
export const SOURCE_FAMILIES = Object.freeze({
  200151: {name:'速射机炮', body:projectile('machine_gun_bullet'), impact:particle('hit_particle')},
  200001: {name:'电弧枪', body:projectile('lightning_beam'), impact:particle('laser_spark_particle')},
  200011: {name:'磁暴枪', body:projectile('electric_harpoon_bullet'), impact:particle('laser_spark_particle')},
  200031: {name:'冰刃弹', body:projectile('concussive_slash'), impact:particle('freeze_effect_particle')},
  200041: {name:'爆燃导弹', body:projectile('rocket'), impact:'res://scn/environ/explosion.tscn'},
  200061: {name:'酸液枪', body:projectile('assault_bullet'), impact:projectile('green_explosion')},
  200091: {name:'酸性黑洞', body:projectile('orb'), impact:particle('particle_pull_bullet')},
  200101: {name:'能量光剑', body:projectile('dual_blades_attack'), impact:particle('hit_particle')},
  200121: {name:'高能激光', body:projectile('continuous_laser_beam'), impact:particle('laser_spark_particle')},
  200141: {name:'冰冻锯盘', body:projectile('pizza_cutter_attack'), impact:particle('freeze_effect_particle')},
  200171: {name:'灼热射线', body:projectile('staurolaser_beam'), impact:particle('burn_status_effect')},
});

// Model overrides cover upgraded projectile branches before the family choice.
export const SOURCE_MODELS = Object.freeze(Object.fromEntries([
  // Explicit migration choices for the cannon's normal / narrow / round shots.
  [[1000000],projectile('machine_gun_bullet')],
  [[1000049],projectile('sniper_bullet')],
  [[1000050],projectile('cannon_bullet')],
  // Serialized upgrade branches must not silently inherit the basic family art.
  [[1000023,1000052],projectile('electric_harpoon_bullet')],
  [[1000030],projectile('orb')],
  [[1000031],projectile('assault_bullet')],
  [[1000036],projectile('plasma_whip_bullet')],
  [[1000040],projectile('dual_blades_attack')],
  [[1000041],projectile('dual_blades_attack_last_hit')],
  [[1000010],particle('freeze_effect_particle')],
  [[1000063],projectile('side_bullet')],
  [[1000064],projectile('shrapnel_bullet')],
  [[120187],projectile('enemy_flail_single')],
  [[210006],projectile('operculum_shield')],
  [[419001],projectile('electric_harpoon_bullet')],
  [[1200001,1200005],projectile('stomp_wave')],
  [[1400007],'res://scn/environ/explosion.tscn'],
  // Enemy bullet Model_model IDs, not enemy body IDs. Names/shapes come from
  // chapter 1-60 model paths; destination scenes are deliberate visual migration.
  [[1100001,1100002,1100016,1100023],projectile('orb')],
  [[1100003,1100015],projectile('concussive_slash')],
  [[1100004,1100017],projectile('assault_bullet')],
  [[1100005],projectile('cannon_bullet')],
  [[1100007,1100008,1100012,1100018],projectile('shrapnel_bullet')],
  [[1100013],projectile('hammer_attack')],
  [[1100014],projectile('enemy_flail_increasing')],
  [[1100019],projectile('operculum_shield')],
  [[1300002],projectile('dagger_attack')],
  [[1000012,1000013,1000014,1000059,200234],projectile('rocket')],
  // These stationary/straight-moving electric bodies have no ray endpoints.
  [[1000048,1000065,419005,1000062],projectile('plasma_whip_bullet')],
  [[200037,200139,419004],projectile('lightning_beam')],
  [[200249,1000067],projectile('operculum_shield')],
  // Acid rain is a persistent circular fog area, not an assault projectile.
  [[1000034],projectile('player_toxin')],
  [[1000054],projectile('burn_trail')],
  [[1000032,1000006],projectile('concussive_slash')],
  [[1000043],projectile('spear_active')],
  [[1000051,1000060,1000018,1300001],projectile('slash')],
  [[1000009],projectile('pizza_cutter_attack')],
  [[1000029],projectile('orb')],
  [[220009,419006],projectile('continuous_laser_beam')],
  [[221001],projectile('staurolaser_beam')],
  [[200011,220006,220010,1000061,1200002],projectile('laser_beam')],
].flatMap(([ids,scene])=>ids.map(id=>[id,scene]))));

export const SOURCE_EFFECTS = Object.freeze(Object.fromEntries([
  // Effect_effect IDs are a separate namespace from SOURCE_MODELS (notably
  // 220006/220010). These complete the source table's hit/death/charge events.
  [[100001,110011,120001,210059],particle('hit_particle')],
  [[210060],particle('laser_spark_particle')],
  [[140003],particle('particle_light_large')],
  [[210002],'res://scn/environ/explosion.tscn'],
  [[210004],particle('particle_explosion')],
  [[220008],particle('particle_light_fast')],
  [[220014],particle('particle_attack_charging_simplified_bosses')],
  [[220022],particle('freeze_effect_particle')],
  // MonsterSkillRuntime action 159 / skill 300025 applies poison pulse buff 300025.
  [[210039],particle('particle_test2(poisoned)')],
  [[220006,220010,220016,180002],particle('particle_light_fast')],
  [[180001,120005,120007],particle('particle_attack_charging_simplified')],
  [[110001,110008,210001,210012,210013,210014,210047,210050,210062],particle('hit_particle')],
  [[110030,110039,120006,210048,220029],particle('laser_spark_particle')],
  [[210049,210065],projectile('green_explosion')],
  [[210051,210035],particle('freeze_effect_particle')],
  [[140005,210003,210008,210009,210011,210016,210017,210061,1400007], 'res://scn/environ/explosion.tscn'],
  [[210043],projectile('green_explosion')],
  [[210006,210021,160006],projectile('operculum_shield')],
  [[170001,170012],particle('freeze_effect_particle')],
  [[170002],projectile('player_toxin')],
  [[170004],particle('burn_status_effect')],
  [[170000,170013,210031],particle('particle_confusion')],
  [[170007,160001,140014],particle('particle_organelle_sparkle')],
  [[180101,180201],projectile('player_toxin')],
  [[180102,180202],projectile('flame')],
  [[180103,180203],projectile('freeze_ray_beam')],
  [[180104,180204,419001],projectile('lightning_beam')],
  [[180105,180205,180106,180206],projectile('machine_gun_bullet')],
  [[181000],projectile('grenade')],
  [[220005,220012,220017],projectile('slash')],
  [[140024,140026,140028],particle('particle_light_large')],
  [[140025,140027,140029],particle('particle_light_exit')],
  [[1200005],projectile('stomp_wave')],
].flatMap(([ids,scene])=>ids.map(id=>[id,scene]))));

// World-space warning migration, not original shared effect IDs. The source
// graph has no dedicated red telegraph scene; the adapter selects staurolaser's
// explicit prefire animation and charging scenes for point warnings. Gameplay owns
// the warning endpoints/duration. GameHover model 53 and UI warnings stay UI.
export const SOURCE_WARNINGS = Object.freeze({
  150003:projectile('staurolaser_beam'),
  220010:particle('particle_light_fast'),
  220014:particle('particle_attack_charging_simplified_bosses'),
  220016:particle('particle_light_fast'),
  'beam-warmup':projectile('staurolaser_beam'),
});

// Status IDs have their own lifetime contract, separate from transient events.
// This is a functional migration: Pathogenic has no persistent poison debuff.
// Its toxin scene exposes `lifetime`; the host binds that public parameter to
// the actual buff duration (8/10 seconds in the shipped target tables). Never
// loop or repeatedly restart its spawn animation to manufacture persistence.
export const SOURCE_STATUSES = Object.freeze({
  160006:projectile('operculum_shield'),
  170000:particle('particle_confusion'),
  170001:particle('freeze_effect_particle'),
  170002:projectile('player_toxin'),
  170004:particle('burn_status_effect'),
  170012:particle('freeze_effect_particle'),
  170013:particle('particle_confusion'),
  210021:projectile('operculum_shield'),
  210031:particle('particle_confusion'),
  220022:particle('freeze_effect_particle'),
});

export class MissingSourceEffect extends Error {
  constructor(kind,id){super(`No Pathogenic scene binding for ${kind} ${id}`);this.name='MissingSourceEffect';}
}
export const ENEMY_ROUND_BULLET_SCENE='res://scn/enemies/shots/macrophage_bullet.tscn';
const ROUND_ENEMY_MODELS=new Set([1100001,1100002,1100016,1100023]);
export function projectileScene(b, extraModels={}) {
  if(b.visualHidden || !b.modelId || !(b.scale>0)) return null;
  if(['Thunder','FlashChain','FollowFlashChain'].includes(b.trajectory)&&!b.segments?.length)return null;
  if(b.owner==='player'&&b.familyId===200011&&b.trajectory==='SectorSpreadMod')return projectile('lightning_beam');
  if(b.owner==='enemy'&&!b.beam&&ROUND_ENEMY_MODELS.has(b.modelId))return ENEMY_ROUND_BULLET_SCENE;
  const source=SOURCE_MODELS[b.modelId] ?? SOURCE_FAMILIES[b.familyId]?.body ?? extraModels[b.modelId];
  if(!source)throw new MissingSourceEffect('projectile',b.modelId);
  return source;
}
export function effectScene(fx) {
  // These mapped weapons already own their source spawn animation. The broad,
  // continuous light emitter is not a gun muzzle or the slash enemy's prefire.
  if(fx.kind==='text'||(fx.kind==='muzzle'&&(!fx.modelId||[100001,220006,220008,220010,220016,180002].includes(fx.modelId))))return null;
  if(fx.modelId){
    const scene=SOURCE_EFFECTS[fx.modelId] ?? SOURCE_MODELS[fx.modelId];
    if(!scene)throw new MissingSourceEffect('event',fx.modelId);
    return scene;
  }
  return {hit:particle('hit_particle'),explosion:'res://scn/environ/explosion.tscn',
    muzzle:particle('particle_light_fast'),level:particle('particle_organelle_sparkle'),
    heal:particle('particle_organelle_sparkle')}[fx.kind] ?? null;
}
export function statusScene(modelId){
  const scene=SOURCE_STATUSES[modelId];if(!scene)throw new MissingSourceEffect('status',modelId);return scene;
}
export function warningScene(id){
  const scene=SOURCE_WARNINGS[id];if(!scene)throw new MissingSourceEffect('warning',id);return scene;
}
export function validateSceneBindings(graph,extraModels={}) {
  const required=new Set([ENEMY_ROUND_BULLET_SCENE,...Object.values(SOURCE_FAMILIES).flatMap(f=>[f.body,f.impact]),
    ...Object.values(SOURCE_MODELS),...Object.values(SOURCE_EFFECTS),...Object.values(SOURCE_STATUSES),...Object.values(SOURCE_WARNINGS),...Object.values(extraModels)]);
  return [...required].filter(path=>!graph.scenes[path]).map(path=>({type:'missing-scene',path}));
}
