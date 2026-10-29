export const DEFAULT_PLAYER_NAME = '逐星旅人';
export const PLAYER_NAME_MAX = 12;

export function validatePlayerName(value) {
  const name = typeof value === 'string' ? value.trim().normalize('NFC') : '';
  if ([...name].length < 2 || [...name].length > PLAYER_NAME_MAX) return {ok:false,message:'名字需要 2–12 个字符'};
  if (!/^[\p{L}\p{N} _·-]+$/u.test(name)) return {ok:false,message:'请使用中文、字母、数字、空格或 · _ -'};
  return {ok:true,name};
}

export function playerName(value) {
  const result = validatePlayerName(value);
  return result.ok ? result.name : DEFAULT_PLAYER_NAME;
}
