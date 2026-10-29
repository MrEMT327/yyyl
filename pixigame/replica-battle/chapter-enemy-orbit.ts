import type { Enemy, GameContent, Point, Projectile, RecordData } from './kernel/model';
import { NativeOrbitWeaponRuntime, type NativeOrbitSettings } from './kernel/native-orbit-weapon';
import source from './public/data/monster-abilities.json';

export const CHAPTER_ENEMY_ORBIT_WEAPON = 70053;
// CreateBullet adds 0x80440; CreateWeaponAndFire also ORs its standard 0x88.
// The bullet table subsequently contributes HitBullet32 -> final0x804e8.
export const CHAPTER_ENEMY_ORBIT_FLAGS = 0x804c8;
const settings: NativeOrbitSettings = {
  group0Weapons: [70053, 70053, 70053, 70053],
  extraBallCount: 0, angularSpeed: 180, angularSpeedPercent: 0,
  extraRadius: -4.5, dynamicScalePercent: 0,
};

/** This is a follower controller, never a wave enemy or a kill/drop target.
 * Only the recovered 400001 -> 320071 -> four 70053 configuration is admitted. */
export function chapterEnemyOrbitTraitSupported(content: GameContent, entityId: number, trait: unknown): boolean {
  if (![320070, 320074, 310023].includes(entityId) || String(trait).trim() !== '400001') return false;
  const data: RecordData = source;
  const skill = data.skills[400001], trigger = data.triggers[400001];
  if (skill?.Triggers?.length !== 1 || skill.Triggers[0] !== 400001 ||
      trigger?.TriggerType !== 0 || trigger.TriggerAction !== 27 || trigger.TriggerAction2 !== 0) return false;
  let parameters: Record<string, unknown>;
  try { parameters = JSON.parse(trigger.ActionParam); } catch { return false; }
  if (parameters.SecondWeaponEntityId !== 320071 ||
      JSON.stringify(parameters.BallWeaponIds) !== '[70053,70053,70053,70053]' ||
      Object.keys(parameters).some(key => !['SecondWeaponEntityId', 'BallWeaponIds'].includes(key))) return false;
  const follower = content.chapter.entities[320071], weapon = content.chapter.weapons[70053];
  const bullet = content.chapter.bullets[70053]?.parameters;
  return follower?.raw.Type === 12 && follower.raw.SecondWeapenType === 8
    && follower.ai?.type === 'AISecondWeapon' && follower.ai.parameters?.FireType === 2
    && follower.stats.attack === 0
    && JSON.stringify(follower.raw.attributes) === '["RotateBallRadius=-4.5","RotateBallSpeed=180"]'
    && weapon?.trajectory === 'FixedPos' && weapon.bulletId === 70053
    && bullet?.ModelId === 120187 && bullet.Flag === 32 && bullet.BulletTrait === 5
    && bullet.LifeTime === 0 && JSON.stringify(bullet.hurtAttributes) === '["Attack=1*100%"]';
}

export interface ChapterEnemyOrbitHost {
  create(owner: Enemy, weaponId: number, position: Point, flags: number): Projectile | undefined;
  bullet(uid: number): Projectile | undefined;
}

/** AI trait installation is synchronous, but the action0 trigger executes on
 * the first component tick, before its PlayState gate (including Born).
 * Evidence: AIStateController.OnSetEntity 0x68dd430, Trigger.OnUpdate 0x6afe6c8.
 * Advance after projectile old-position capture and before collision tests. */
export class ChapterEnemyOrbits {
  private entries = new Map<number, { owner: Enemy; runtime?: NativeOrbitWeaponRuntime }>();

  constructor(private readonly host: ChapterEnemyOrbitHost) {}

  add(owner: Enemy): void { this.entries.set(owner.uid, { owner }); }

  clear(): void {
    for (const entry of this.entries.values()) entry.runtime?.clear();
    this.entries.clear();
  }

  remove(uid: number): void {
    this.entries.get(uid)?.runtime?.clear();
    this.entries.delete(uid);
  }

  step(dt: number): void {
    for (const entry of this.entries.values()) {
      const owner = entry.owner;
      // EntitySecondWeaponFollower.OnUpdate/OnLateUpdate return when parent HP
      // is zero. Actual disposal is driven separately by the parent lifetime.
      if (owner.dead || owner.hp <= 0) continue;
      if (!entry.runtime) {
        entry.runtime = new NativeOrbitWeaponRuntime({
          owner: () => owner,
          create: (weaponId, position) => {
            const bullet = this.host.create(owner, weaponId, position, CHAPTER_ENEMY_ORBIT_FLAGS);
            if (!bullet) throw new Error(`Enemy orbit projectile ${weaponId} could not be created`);
            bullet.held = true;
            bullet.repeatHits = true;
            bullet.critChance = 0;
            return bullet.uid;
          },
          alive: uid => { const bullet = this.host.bullet(uid); return Boolean(bullet && !bullet.dead); },
          pose: (uid, position, yaw) => {
            const bullet = this.host.bullet(uid);
            if (bullet) { bullet.x = position.x; bullet.z = position.z; bullet.angle = yaw * Math.PI / 180; }
          },
          remove: uid => { const bullet = this.host.bullet(uid); if (bullet) bullet.dead = true; },
          refresh: uid => {
            const bullet = this.host.bullet(uid);
            if (bullet) {
              // SyncAllParentAttributes inherits Attack/AttackMission/Attack%,
              // not ScalePercent%. This follower has no attack contribution.
              // Action27 passes attackAdjust=0; RotateBallAttack is also zero.
              // Existing enemy.attack is immutable after spawn. Preserve any
              // projectile-side modifiers if a future parent update is added.
              if (bullet.attackSnapshot !== owner.attack) {
                bullet.damage = bullet.attackSnapshot ? bullet.damage * owner.attack / bullet.attackSnapshot : owner.attack;
                bullet.attackSnapshot = owner.attack;
              }
            }
          },
        });
        entry.runtime.reconcile(settings);
      }
      entry.runtime.refreshAttributes(settings);
      entry.runtime.step(dt, settings);
    }
  }
}
