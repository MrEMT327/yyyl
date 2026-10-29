export const DISPOSE_BATTLE_EVENT: string;
export function createBattleLifetime(): {add(cleanup:()=>void):void;dispose():void;readonly disposed:boolean;signal:AbortSignal};
export function disposeNativeUi(ui:unknown):void;
export function disposeNativeAudio(audio:unknown):void;
export function disposeNativeGame(game:unknown):void;
