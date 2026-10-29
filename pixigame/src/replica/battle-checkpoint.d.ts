export function installBattleCheckpoint<T>(read: () => T, host?: Window): { freeze(): void };
export function captureBattleCheckpoint(host?: Window | null): unknown;
