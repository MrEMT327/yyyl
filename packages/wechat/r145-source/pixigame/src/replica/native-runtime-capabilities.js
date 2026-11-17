// Generated from the actual Simulation constructor declarations; no new handlers.
// Used by read-only lobby calculations before a Simulation exists.
import { registerLoadoutAttributeConsumers } from '../../replica-battle/kernel/loadout-attributes';
import { nativeLoadoutDamageAttributeNames, nativeLoadoutSurvivalAttributeNames } from '../../replica-battle/kernel/combat-attributes';
import { loadoutRuntimeActions } from '../../replica-battle/kernel/special-skill-runtime';
import { registerLoadoutDependencyHandlers } from '../../replica-battle/kernel/loadout-dependencies';
export function initializeReplicaLoadoutCapabilities() {
  registerLoadoutAttributeConsumers(['ChooseSkillOnFirst', 'RefreshCount', 'FiveSkillRate%']);
    for (const action of [141, 237]) loadoutRuntimeActions.add(action);
    registerLoadoutAttributeConsumers([...nativeLoadoutDamageAttributeNames, ...nativeLoadoutSurvivalAttributeNames, 'MoveSpeed', 'MoveSpeed%', 'WaveFinishRecoverHP%', 'AddHpTriggerRate%', 'CurveSwordKillBullet2AddHp%', 'ScorchingRayPathHurtRate%', 'AttackSpeed%', 'PickDistanceHp%', 'BulletTraitAreaScale%', 'DiamondResurrection', 'LevelUpRecoverHP', 'LevelUpRecoverHP%', 'BattleGold%', 'TimeShieldExtraDuration']);
    for (const action of [1, 20, 95, 96, 102, 124, 211, 243, 133, 139, 154, 155, 156, 158, 160, 162, 163, 164, 166, 186, 187, 188, 191, 196, 203, 208, 214, 215, 216, 217, 218, 219, 220, 221, 222, 238, 240, 241, 244, 250, 251, 252]) loadoutRuntimeActions.add(action);
    registerLoadoutDependencyHandlers({ mods: ['ScaleOnlyColliderMod', 'IgnoreNoReboundDieMod', 'LaserLockMod', 'PersistentMod', 'CriticalThroughMod', 'LaserPrismMod', 'LaserPrismMainLaserReactionMod'], trajectories: ['SpecialLaserStick', 'LaserSymmetricByOwner'] });
}
