export type AudioPreferences = {music:boolean;effects:boolean};
export const AUDIO_PREFERENCES_KEY:string;
export function readAudioPreferences(storage?: Pick<Storage,'getItem'>):AudioPreferences;
export function saveAudioPreferences(storage:Pick<Storage,'setItem'>,value:AudioPreferences):boolean;
