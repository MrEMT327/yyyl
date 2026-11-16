import fs from 'node:fs';
const reason='Native first-target event34 and LaserPrism/Reaction lifecycle; see research/prism-first-hit.md. No changes to raw skill tables.';
const text=fs.readFileSync(new URL('../kernel/simulation.ts',import.meta.url),'utf8');
const block=(start,end)=>{
  const a=text.indexOf(start),b=text.indexOf(end,a+start.length);
  if(a<0||b<0||text.indexOf(start,a+1)>=0)throw Error('Nonunique reviewed block '+start);
  return text.slice(a,b);
};
const host=block('  private installPrism(', '  private dispatchWeaponEvent(');
const side=block('    const prismSide = this.prismSides.get(b);','    const symmetric = this.symmetricLasers.get(b);');
const latch=block('          if (!this.firstBulletTargets.has(b)) {','          // Character.OnHitByBullet');
export default [
  {path:'simulation.ts',kind:'gameplay-repair',reason,replacements:[
    ["import { applyCriticalThrough } from './critical-through';","import { applyCriticalThrough } from './critical-through';\nimport { NativePrismRuntime, nativePrismProbeSegments, type NativePrismParams } from './native-prism';"],
    ['  private firstBulletTargets = new WeakMap<Projectile, number>();','  private firstBulletTargets = new WeakMap<Projectile, number>();\n  private prisms = new Map<Projectile, NativePrismRuntime>();\n  private prismSides = new WeakMap<Projectile, { parent: Projectile; offset: Point }>();'],
    ["'PersistentMod', 'CriticalThroughMod'], trajectories:","'PersistentMod', 'CriticalThroughMod', 'LaserPrismMod', 'LaserPrismMainLaserReactionMod'], trajectories:"],
    ['    this.firstBulletTargets = new WeakMap(); this.dynamicBulletAttributes = new WeakMap();','    for (const prism of this.prisms.values()) prism.dispose();\n    this.prisms.clear(); this.prismSides = new WeakMap();\n    this.firstBulletTargets = new WeakMap(); this.dynamicBulletAttributes = new WeakMap();'],
    ['    for (const bullet of this.projectiles) this.moveProjectile(bullet, dt);','    for (const bullet of this.projectiles) this.moveProjectile(bullet, dt);\n    for (const prism of this.prisms.values()) prism.update(this.clock);\n    this.updatePrismReactions();'],
    ['          if (!this.firstBulletTargets.has(b)) this.firstBulletTargets.set(b, hit.enemy.uid);\n',latch],
    ['  private dispatchWeaponEvent(',host+'  private dispatchWeaponEvent('],
    ['    projectile.originalThroughCount = projectile.pierce;','    projectile.originalThroughCount = projectile.pierce;\n    projectile.suppressFirstTargetEvent = speed !== 0 && Number(state?.nativeAttributes?.BulletRangeAttack || 0) > 0 && [1, 3].includes(Number(b.Type));'],
    ["    if (shot.owner === 'player') { this.planeSpecials?.onBulletCreate(shot.familyId || 0, projectile.uid, shot.weaponId); this.dispatchWeaponEvent(7, shot.familyId || 0, { weaponId: shot.weaponId, bullet: projectile, point: origin }); }",
     "    if (shot.owner === 'player') { this.planeSpecials?.onBulletCreate(shot.familyId || 0, projectile.uid, shot.weaponId); this.dispatchWeaponEvent(7, shot.familyId || 0, { weaponId: shot.weaponId, bullet: projectile, point: origin }); }\n    const prism = w.mods.find((mod: RecordData) => mod.type === 'LaserPrismMod');\n    if (prism) this.installPrism(projectile, prism.parameters);"],
    ['    const symmetric = this.symmetricLasers.get(b);',side+'    const symmetric = this.symmetricLasers.get(b);'],
    ['  private finalizeProjectileDeaths() {','  private finalizeProjectileDeaths() {\n    for (const [bullet, prism] of this.prisms) if (bullet.dead) { prism.dispose(); this.prisms.delete(bullet); }'],
  ]},
  {path:'model.ts',kind:'gameplay-repair',reason,replacements:[
    ['  originalThroughCount?: number;','  originalThroughCount?: number;\n  suppressFirstTargetEvent?: boolean;'],
  ]},
  {path:'weapon-skill-runtime.ts',kind:'gameplay-repair',reason,replacements:[
    ["31: ['WeaponIds', 'BuffFlags', 'TargetEntityTypes'], 35:","31: ['WeaponIds', 'BuffFlags', 'TargetEntityTypes'], 34: ['WeaponIds', 'BuffFlags'], 35:"],
  ]},
  {path:'loadout-dependencies.ts',kind:'gameplay-repair',reason,replacements:[
    ['      for (const [key, item] of Object.entries(value)) scan(item, owner, key);',
`      for (const [key, item] of Object.entries(value)) {
        // Prism main lasers are accepted collision sources, not spawned children.
        // Still require their records, but do not pretend this skill fires them.
        if (key === 'MainLaserWeaponIds') {
          for (const id of Array.isArray(item) ? item : []) if (!tables.weapons?.[id]) reasons.add(\`缺少武器 \${id}\`);
        } else scan(item, owner, key);
      }`],
  ]},
];
