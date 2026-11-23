import './player-avatar.css';
import {playerAvatarArt} from './player-avatar-art.js';
export {playerAvatarArt} from './player-avatar-art.js';

export function playerAvatar(snapshot,h,{avatar,frame,className=''}={}){
  const {id,pilot,source,frameId,frameArt}=playerAvatarArt(snapshot,{avatar,frame});
  return `<span class="player-avatar ${className}" data-player-avatar="${h.escape(id||'')}" data-player-frame="${frameId}" style="--player-frame-art:url(&quot;${h.escape(frameArt)}&quot;)"><img src="${h.escape(source.src)}" ${source.srcset?`srcset="${h.escape(source.srcset)}" sizes="120px"`:''} alt="${h.escape(pilot?.name||'玩家头像')}" draggable="false"><span class="player-avatar-frame" aria-hidden="true"></span></span>`;
}
