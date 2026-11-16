import type { StudyLoadoutState } from '../../replica-battle/kernel/loadout-state';
export interface ReplicaConfiguration {
  version: 2;
  progression: StudyLoadoutState;
  weaponChapterProgress: { clearedChapterIds: number[] };
  sourceRevision: string;
  equipment: { id: number; slot: number; level: number }[];
}
export function createReplicaConfiguration(gear: unknown, progression: unknown, campaign?: unknown): ReplicaConfiguration;
export function validateReplicaConfiguration(value: unknown): ReplicaConfiguration;
export function replicaConfigurationKey(value: unknown): string;
