import './player-avatar.css';
import {pilotAvatarIcon,compactPilotAvatar} from '../pilot-avatar-icons.js';
import {PLAYER_FRAMES} from '../player-appearance.js';
const base=import.meta.env?.BASE_URL??'/';
const frameIds=new Set(PLAYER_FRAMES.map(row=>row.id));

// Cosmetic identity is independent of the pilot used for combat and Live2D.
export function playerAvatar(snapshot,h,{avatar,frame,className=''}={}){
  const appearance=snapshot.playerAppearance||{};
  const id=avatar==='auto'?snapshot.pilotId:avatar||appearance.currentPilotId||snapshot.pilotId;
  const pilot=snapshot.pilots?.find(row=>row.id===id);
  const source=compactPilotAvatar(pilotAvatarIcon(id)||pilot?.avatar||pilot?.image||'');
  const frameId=frameIds.has(frame)?frame:frameIds.has(appearance.frame)?appearance.frame:'blue';
  return `<span class="player-avatar ${className}" data-player-avatar="${h.escape(id||'')}" data-player-frame="${frameId}" style="--player-frame-art:url('${base}art/player-avatar-frames-v1/${frameId}.png')"><img src="${h.escape(source.src)}" ${source.srcset?`srcset="${h.escape(source.srcset)}" sizes="120px"`:''} alt="${h.escape(pilot?.name||'玩家头像')}" draggable="false"><span class="player-avatar-frame" aria-hidden="true"></span></span>`;
}
