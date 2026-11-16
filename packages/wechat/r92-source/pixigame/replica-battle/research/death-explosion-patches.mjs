import fs from 'node:fs';
const code=fs.readFileSync(new URL('../kernel/simulation.ts',import.meta.url),'utf8');
const method=code.slice(code.indexOf('  private explodeDropMissile('),code.indexOf('  private finalizeProjectileDeaths() {'));
const birth=code.slice(code.indexOf("    if (shot.owner === 'player' && shot.weaponId === 110001)"),code.indexOf('    projectile.originalThroughCount = projectile.pierce;'));
if(!method.endsWith('  }\n')||!birth.includes('deathExplosionScales'))throw Error('Missing scoped death explosion additions');
export default [{path:'simulation.ts',kind:'gameplay-repair',reason:'Default missile ExplosionUponDeath preserves logical scale, same-bullet damage/hit cooldown and native death gates; research/death-explosion-contract.md.',replacements:[
  ["import { NativeDropMissileRuntime } from './native-drop-missile';","import { NativeDropMissileRuntime } from './native-drop-missile';\nimport { nativeDeathExplosionPlan } from './native-death-explosion';"],
  ['  private dropMissiles?: NativeDropMissileRuntime;','  private dropMissiles?: NativeDropMissileRuntime;\n  private readonly deathExplosionScales = new WeakMap<Projectile, number>();'],
  ['    projectile.originalThroughCount = projectile.pierce;',birth+'    projectile.originalThroughCount = projectile.pierce;'],
  ['  private finalizeProjectileDeaths() {',method+'  private finalizeProjectileDeaths() {'],
  ['      bullet.deathHandled = true;','      bullet.deathHandled = true;\n      this.explodeDropMissile(bullet);'],
  ['  private collisions(onlyBullet?: Projectile, directTarget = false) {','  private collisions(onlyBullet?: Projectile, directTarget = false, deathExplosion?: { radius: number; multiplier: number }) {'],
  ['      if (b.dead || b.collisionDisabled || this.arcChains.get(b)?.waiting || this.ejections.get(b)?.waiting || b.age < b.warmup) continue;','      if ((b.dead && !deathExplosion) || b.collisionDisabled || this.arcChains.get(b)?.waiting || this.ejections.get(b)?.waiting || b.age < b.warmup) continue;'],
  ['      const segments = b.beam || b.fixedSegments ? b.segments : [{ from: a, to: end }];','      const segments = deathExplosion ? [{ from: b, to: b }] : b.beam || b.fixedSegments ? b.segments : [{ from: a, to: end }];'],
  ['        this.killEnemyBullets(b);\n        if (b.dead) continue;','        if (!deathExplosion) this.killEnemyBullets(b);\n        if (b.dead && !deathExplosion) continue;'],
  ['          if (e.dead || (!b.repeatHits && !b.beam && b.hit.has(e.uid))) continue;','          if (e.dead || (!deathExplosion && !b.repeatHits && !b.beam && b.hit.has(e.uid))) continue;'],
  ['            const at = sweep(collider, e);','            const at = sweep(deathExplosion ? { ...b, oldX: b.x, oldZ: b.z, box: false, radiusX: deathExplosion.radius, radiusZ: deathExplosion.radius, offsetX: 0, offsetZ: 0 } : collider, e);'],
  ['          if (b.beam || b.repeatHits) {','          if (b.beam || b.repeatHits || b.weaponId === 110001) {'],
  ['          const damage = b.damage * (critical ? critValue : 1) * (b.ray ? rayMultiplier : b.throughScale)','          const damage = b.damage * (deathExplosion?.multiplier ?? 1) * (critical ? critValue : 1) * (b.ray ? rayMultiplier : b.throughScale)'],
  ['          const eject = this.ejections.get(b);','          if (deathExplosion) continue;\n          const eject = this.ejections.get(b);'],
]}];
