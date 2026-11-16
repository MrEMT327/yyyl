const reason='Native CriticalThroughMod event35 integration; OnInit 0x6D214BC, AddModRepeat 0x6D2156C, OnEvent 0x6D215F4. See critical-through.md.';
export default [
  {path:'simulation.ts',kind:'gameplay-repair',reason,replacements:[
    ["import { advancePickup, createPickup } from './drop-motion';","import { advancePickup, createPickup } from './drop-motion';\nimport { applyCriticalThrough } from './critical-through';"],
    ["mods: ['ScaleOnlyColliderMod', 'IgnoreNoReboundDieMod', 'LaserLockMod', 'PersistentMod'],","mods: ['ScaleOnlyColliderMod', 'IgnoreNoReboundDieMod', 'LaserLockMod', 'PersistentMod', 'CriticalThroughMod'],"],
    ['    this.projectiles.push(projectile);','    this.projectiles.push(projectile);\n    projectile.originalThroughCount = projectile.pierce;'],
    ['          if (critical) this.dispatchExplosionEvent(b, { id: 35, critPoint: hit.enemy });','          if (critical) {\n            applyCriticalThrough(b, 35);\n            this.dispatchExplosionEvent(b, { id: 35, critPoint: hit.enemy });\n          }'],
  ]},
  {path:'model.ts',kind:'gameplay-repair',reason,replacements:[
    ['export interface Projectile extends Point {','export interface Projectile extends Point {\n  originalThroughCount?: number;'],
  ]},
  {path:'special-skill-runtime.ts',kind:'gameplay-repair',reason,replacements:[
    ["if (mod?.length && !runtimeMods.has(String(mod[0])))","if (mod?.length && !runtimeMods.has(String(mod[0])) && mod[0] !== 'CriticalThroughMod')"],
  ]},
];
