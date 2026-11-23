import {pilotAvatarIcon,compactPilotAvatar} from '../pilot-avatar-icons.js';
import {PLAYER_FRAMES} from '../player-appearance.js';
import {resolveUiAssetUrl} from './ui-image-source.js';
const base=import.meta.env?.BASE_URL??'/';
const frameIds=new Set(PLAYER_FRAMES.map(row=>row.id));

// Cosmetic identity is independent of the pilot used for combat and Live2D.
export function playerAvatarArt(snapshot,{avatar,frame}={}){
  const appearance=snapshot.playerAppearance||{};
  const id=avatar==='auto'?snapshot.pilotId:avatar||appearance.currentPilotId||snapshot.pilotId;
  const pilot=snapshot.pilots?.find(row=>row.id===id);
  const source=compactPilotAvatar(pilotAvatarIcon(id)||pilot?.avatar||pilot?.image||'');
  const frameId=frameIds.has(frame)?frame:frameIds.has(appearance.frame)?appearance.frame:'blue';
  const frameArt = resolveUiAssetUrl(`${base}art/player-avatar-frames-v1/${frameId}.png`);
  return {id,pilot,source,frameId,frameArt};
}
