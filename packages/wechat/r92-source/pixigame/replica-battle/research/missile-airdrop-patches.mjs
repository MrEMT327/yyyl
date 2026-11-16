import fs from 'node:fs';
const code=fs.readFileSync(new URL('../kernel/simulation.ts',import.meta.url),'utf8');
const dropMethod=code.slice(code.indexOf('  private getDropMissiles() {'),code.indexOf('  private getPlaneSpecials() {'));
if(!dropMethod || !dropMethod.endsWith('  }\n'))throw Error('Missing exact drop missile host');
export default [
  {path:'simulation.ts',kind:'gameplay-repair',reason:'Independent default DropItemMissile110001 queue, action39/40 and native release lifecycle; research/missile-airdrop-integration.md.',replacements:[
    ["import { NativeMissileRuntime, nativeSplitMissilePlan } from './native-missile';","import { NativeMissileRuntime, nativeSplitMissilePlan } from './native-missile';\nimport { NativeDropMissileRuntime } from './native-drop-missile';"],
    ['  private heroMissiles?: NativeMissileRuntime;','  private heroMissiles?: NativeMissileRuntime;\n  private dropMissiles?: NativeDropMissileRuntime;'],
    ['    this.unreal = undefined; this.heroMissiles = undefined; this.loadoutSpecials?.clear(); this.loadoutSpecials = undefined;','    this.unreal = undefined; this.heroMissiles = undefined; this.dropMissiles = undefined; this.loadoutSpecials?.clear(); this.loadoutSpecials = undefined;'],
    ['    this.heroMissiles?.update(dt, this.clock);','    this.heroMissiles?.update(dt, this.clock);\n    this.dropMissiles?.update(dt, this.clock);'],
    ['  private getPlaneSpecials() {',dropMethod+'  private getPlaneSpecials() {'],
    ['    if (command.action === 95) {',`    if (command.action === 39) {
      this.getDropMissiles().configure(Number(args.MissileWeaponId || 0), Number(args.Count || 0)); return;
    }
    if (command.action === 40) { this.getDropMissiles().collect(); return; }
    if (command.action === 95) {`],
  ]},
  {path:'weapon-skill-runtime.ts',kind:'gameplay-repair',reason:'Route airdrop setup/collect actions39/40 to explicit host; no global admission of unverified variants.',replacements:[
    ['      case 1: case 95: case 124: case 211: case 243:','      case 1: case 39: case 40: case 95: case 124: case 211: case 243:'],
  ]},
  {path:'renderer.ts',kind:'presentation',reason:'DropItemMissile waiting/preparing bullets suppress active trail/effect until released.',replacements:[
    ['      if (this.content.assets.originalEffects.effects[bullet.modelId]) {','      if (this.content.assets.originalEffects.effects[bullet.modelId] && !(bullet.weaponId === 110001 && bullet.held)) {'],
  ]},
];
