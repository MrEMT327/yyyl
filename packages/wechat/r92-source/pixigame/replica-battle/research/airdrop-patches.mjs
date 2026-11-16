export default [
  {path:'content.ts',kind:'gameplay-repair',reason:'Source-backed maintenance/shockwave airdrop dependencies and narrow card admission; see research/airdrop-integration.md.',replacements:[
    ["import { loadLoadoutRuntime, loadPlayerAppearances } from './loadout-resources';","import { loadLoadoutRuntime, loadPlayerAppearances } from './loadout-resources';\nimport { installNativeAirdropContent } from './native-airdrop-content';"],
    ["  for (const key of ['sprites', 'prefabs', 'effects']) assets[key] = { ...loadoutRuntime.assets?.[key], ...assets[key] };","  for (const key of ['sprites', 'prefabs', 'effects']) assets[key] = { ...loadoutRuntime.assets?.[key], ...assets[key] };\n  installNativeAirdropContent(combat);"],
  ]},
  {path:'renderer.ts',kind:'presentation',reason:'Original procedural shockwave pickup badge for missing model1300007; does not change gameplay.',replacements:[
    ["import Phaser from 'phaser';","import Phaser from 'phaser';\nimport { createShockwavePickup, shockwavePickupModelId } from './airdrop-visual';"],
    ['    const container = this.add.container(0, 0);','    if (modelId === shockwavePickupModelId) return createShockwavePickup(this, this.px);\n    const container = this.add.container(0, 0);'],
  ]},
];
