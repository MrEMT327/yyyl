export default [
  {path:'simulation.ts',kind:'gameplay-repair',reason:'Frenzy100211 owner scale, collision and additive global bullet speed; see research/frenzy-integration.md.',replacements:[
    ['  get mainWeaponEquipped() { return this.cannonOwned; }',`  get mainWeaponEquipped() { return this.cannonOwned; }
  /** Player attributes are contributions, unlike weapon snapshots with defaults. */
  get playerScale() {
    const definition = this.content.combat.attributeDefinitions['ScalePercent%'];
    return nativeAttributeValue(definition, definition.defaultValue) + (this.playerCombatAttributes()['ScalePercent%'] || 0);
  }`],
    ['    const radius = nativeShapeRadii(this.content.chapter.entities[this.content.chapter.player.entityId].stats.shape).radius;','    const radius = nativeShapeRadii(this.content.chapter.entities[this.content.chapter.player.entityId].stats.shape).radius * this.playerScale;'],
    ['        const radius = this.content.chapter.entities[this.content.chapter.player.entityId].stats.shape[0];','        const radius = this.content.chapter.entities[this.content.chapter.player.entityId].stats.shape[0] * this.playerScale;'],
    ['\n      const radius = this.content.chapter.entities[this.content.chapter.player.entityId].stats.shape[0];','\n      const radius = this.content.chapter.entities[this.content.chapter.player.entityId].stats.shape[0] * this.playerScale;'],
    ["    const speedFactor = fraction('BulletSpeed%'), previousSpeedFactor = this.bulletSpeedFactors.get(bullet) ?? 1;",`    // Ordinary frenzy buffs affect the emitting owner; keep AllBulletSpeed at
    // birth unless an explicit bullet-attribute action changes this projectile.
    const allSpeed = (base.attributes['AllBulletSpeed%'] || 0) + (attrs['AllBulletSpeed%'] || 0);
    const speedFactor = (1 + merged('BulletSpeed%') + allSpeed) / (1 + (base.attributes['BulletSpeed%'] || 0) + (base.attributes['AllBulletSpeed%'] || 0)), previousSpeedFactor = this.bulletSpeedFactors.get(bullet) ?? 1;`],
    ['    const speed = (b.MoveSpeed + (state?.nativeAttributes?.BulletSpeed || 0)) * (1 + (state?.speedBonus || 0));',"    const speed = (b.MoveSpeed + (state?.nativeAttributes?.BulletSpeed || 0)) * (1 + (state?.speedBonus || 0) + (state?.nativeAttributes?.['AllBulletSpeed%'] || 0));"],
    ["        speedPercent: () => (this.weaponAttributes(projectile.familyId)['BulletSpeed%'] || 0) + (this.bulletAttributes.get(projectile)?.['BulletSpeed%'] || 0),","        speedPercent: () => (this.weaponAttributes(projectile.familyId)['BulletSpeed%'] || 0) + (this.bulletAttributes.get(projectile)?.['BulletSpeed%'] || 0) + (this.bulletBase.get(projectile)?.attributes['AllBulletSpeed%'] || 0) + (this.bulletAttributes.get(projectile)?.['AllBulletSpeed%'] || 0),"],
  ]},
  {path:'renderer.ts',kind:'presentation',reason:'Frenzy original pickup badge and state-driven player scale.',replacements:[
    ["import { createShockwavePickup, shockwavePickupModelId } from './airdrop-visual';","import { createShockwavePickup, shockwavePickupModelId, createFrenzyPickup, frenzyPickupModelId } from './airdrop-visual';"],
    ['    if (modelId === shockwavePickupModelId) return createShockwavePickup(this, this.px);','    if (modelId === shockwavePickupModelId) return createShockwavePickup(this, this.px);\n    if (modelId === frenzyPickupModelId) return createFrenzyPickup(this, this.px);'],
    ['    if (this.playerSpine) this.playerSpine.update(s.clock, pp.x, pp.y, this.px, Number(appearance.plane?.modelScale ?? playerEntity.modelScale), s.player.hp > 0, alpha, s.playerMotion);','    if (this.playerSpine) this.playerSpine.update(s.clock, pp.x, pp.y, this.px, Number(appearance.plane?.modelScale ?? playerEntity.modelScale) * s.playerScale, s.player.hp > 0, alpha, s.playerMotion);'],
    ['      player.setPosition(pp.x, pp.y).setScale(playerEntity.modelScale).setVisible(s.player.hp > 0).setAlpha(alpha);','      player.setPosition(pp.x, pp.y).setScale(playerEntity.modelScale * s.playerScale).setVisible(s.player.hp > 0).setAlpha(alpha);'],
  ]},
];
