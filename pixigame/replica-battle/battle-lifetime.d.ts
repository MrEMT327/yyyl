export const DISPOSE_BATTLE_EVENT: string;
export function createBattleLifetime(events?: Pick<EventTarget,'addEventListener'>): {add(cleanup:()=>void):void;dispose():void;readonly disposed:boolean;signal:AbortSignal};
export function disposeNativeAudio(audio:unknown):void;
export function disposeNativeGame(game:unknown,releaseVisuals?:()=>void):void;
