const KEY='thunder-audio-preferences-v1';
export function readAudioPreferences(storage) {
  try {const value=JSON.parse(storage?.getItem(KEY)||'{}');return {music:value?.music!==false,effects:value?.effects!==false};}
  catch {return {music:true,effects:true};}
}
export function saveAudioPreferences(storage,value) {
  try {storage?.setItem(KEY,JSON.stringify({music:value.music!==false,effects:value.effects!==false}));return true;}
  catch {return false;}
}
