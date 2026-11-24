export function installBattleCheckpoint<T>(read: () => T, host?: EventTarget): { freeze(): void };
export function captureBattleCheckpoint(host?: EventTarget | null): unknown;
