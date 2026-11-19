import {patrolClockState} from '../../ui/patrol-clock.js';
import {playerAvatarArt} from '../../ui/player-avatar.js';
import {optimizeUiAssetUrls} from '../../ui/ui-image-source.js';

export function homePresentation(snapshot,chapter,developer){
  const stage=snapshot.stages?.[chapter],rewards=snapshot.nativeAcquisition?.rewards?.filter(r=>r.missionId===stage?.replicaChapterId);
  const stars=snapshot.starRewards?.modes?.find(r=>r.id==='easy'),clock=patrolClockState(snapshot.patrol);
  const identity=playerAvatarArt(snapshot);
  return {chapter,stage,pilotId:snapshot.pilotId,pilotImage:snapshot.pilots?.find(p=>p.id===snapshot.pilotId)?.image,
    name:snapshot.playerName||'指挥官',power:Number.isFinite(snapshot.power)?snapshot.power.toLocaleString('zh-CN'):'—',
    total:rewards?rewards.filter(r=>r.claimed).length:stars?.total??0,maximum:rewards?rewards.length:stars?.maxStars||snapshot.stages?.length*3||0,
    wallet:snapshot.wallet,avatar:optimizeUiAssetUrls(identity.source.src),frame:identity.frameArt,developer,
    patrol:clock.status==='locked'?'':clock.home,patrolLocked:clock.status==='locked'};
}

