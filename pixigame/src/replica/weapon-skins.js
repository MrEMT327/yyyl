import { battleSkillIconUrl } from '../ui/battle-skill-art.js';
import { createModuleGeometry } from '../slot-demo/module-geometry.js';
import { ITEM_BY_ID } from '../slot-demo/catalog.js';
import mapping from '../../replica-battle/weapon-skin-correspondence.json';

export const WEAPON_SKINS = Object.freeze(mapping.families);

/** State identity includes every real child ID and parent stage. Repeated minor
 * skills remain repeated; equal stars do not collapse different builds. */
export function weaponAppearanceKey(weapon) {
  return [weapon.familyId, weapon.stageId, weapon.sourceSkillId || 0,
    ...weapon.skills.map(skill => `${skill.skillId}@${skill.parentStageId}`)].join('/');
}

export function validateWeaponSkins(content) {
  if (content.combat.mode !== mapping.mode) throw new Error('武器皮肤对应表与当前复刻模式不一致');
  for (const family of Object.values(content.combat.families)) {
    const skin = WEAPON_SKINS[family.id];
    if (!skin || (skin.kind === 'cloud-model' && !ITEM_BY_ID.has(skin.itemId)))
      throw new Error(`缺少武器原始素材对应：${family.id}`);
    for (const stage of family.stages) if (!mapping.stages[stage.skillId])
      throw new Error(`缺少武器阶段ID对应：${stage.skillId}`);
  }
  for (const branch of Object.values(mapping.branches)) if (!content.assets.sprites[branch.icon])
    throw new Error(`缺少复刻强化/突破原图：${branch.skillId}/${branch.icon}`);
}

/** An unmodified, complete cloud model. No recoloring, resized jackets,
 * duplicated guns, fabricated reinforcements or stat-dependent geometry. */
export function createWeaponForm(weapon) {
  const skin = WEAPON_SKINS[weapon.familyId];
  if (skin?.kind !== 'cloud-model') throw new Error(`该武器使用复刻原始素材：${weapon.familyId}`);
  const kit = createModuleGeometry(ITEM_BY_ID.get(skin.itemId));
  kit.userData.weaponAppearance = weapon;
  return kit;
}

export function weaponSkinLoadout(pilotId, weapons) {
  return { pilotId, weapons: weapons.flatMap((skin, index) => {
    const resource = WEAPON_SKINS[skin.familyId];
    // Unmatched weapons retain native projectiles/entities and original art.
    // They do not gain a fabricated aircraft attachment.
    if (resource?.kind !== 'cloud-model') return [];
    // Development can activate more weapons than the six physical skin seats.
    // Only omit the extra attachment; its simulation, shots and HUD stay active.
    if (index > 4) return [];
    return [{ itemId: resource.itemId, slots: index ? [`W${index + 2}`] : ['W1', 'W2'], skin }];
  }), connectors: [] };
}

export function createWeaponIcons(_renderer, _lightingScene, content) {
  return {
    get(weapon) {
      const identity=weaponAppearanceKey(weapon),skin=WEAPON_SKINS[weapon.familyId];
      const selected=weapon.sourceSkillId||weapon.skills.at(-1)?.skillId||weapon.stageId;
      const record=mapping.branches[selected]||mapping.stages[selected];
      const original=record?.icon||skin.icon;
      const url=battleSkillIconUrl(original);
      if(!url)throw new Error('缺少原创武器图标：'+selected+'/'+original);
      return {key:'project-weapon/'+identity,url};
    },
    dispose() {},
  };
}
