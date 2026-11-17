import type { Enemy, Projectile } from './model';
import { SCATTER_GUNBOAT_MODEL } from '../scatter-gunboat-art';
import { PATROL_DRONE_MODEL } from '../patrol-drone-art';
import { HEAVY_SCATTER_MODEL } from '../heavy-scatter-art';
import { ELITE_SCATTER_MODEL } from '../elite-scatter-art';

const recoilModels = new Set([SCATTER_GUNBOAT_MODEL, PATROL_DRONE_MODEL, HEAVY_SCATTER_MODEL, ELITE_SCATTER_MODEL]);

// The recoil animations share the same rule: the latest fired projectile from
// a live model's uid. Build the index while counting bullets for the VFX.
export class BattleShotPresentation {
  private readonly recoilOwners = new Set<number>();
  readonly recoilTimes = new Map<number, number>();

  update(enemies: readonly Enemy[], projectiles: readonly Projectile[], clock: number) {
    const owners = this.recoilOwners, times = this.recoilTimes;
    owners.clear(); times.clear();
    for (const enemy of enemies) if (recoilModels.has(enemy.modelId)) owners.add(enemy.uid);
    let playerBulletCount = 0;
    for (const shot of projectiles) {
      if (shot.owner === 'player') {
        if (!shot.dead) playerBulletCount++;
      } else if (shot.owner === 'enemy' && owners.has(shot.ownerUid) && !shot.held && !(shot.age < shot.warmup)) {
        const time = clock - shot.age + shot.warmup;
        if (time > (times.get(shot.ownerUid) ?? -Infinity)) times.set(shot.ownerUid, time);
      }
    }
    return playerBulletCount;
  }
}
