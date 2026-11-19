import { createPilotPortraitPlayer } from './portrait-player-factory.js';
import { PILOT_PORTRAITS } from './character-portraits.js';

/** Reuses recent portraits across markup changes without retaining every GPU player. */
export function createCharacterPortraits({maxCachedPlayers=2,videoSurface,cubismSurface,blueSurface}={}) {
  const players = new Map();
  const pendingFeedback = new Map();
  const cacheLimit=Number.isInteger(maxCachedPlayers)&&maxCachedPlayers>0?maxCachedPlayers:2;
  let hosts = new Map();
  let visible = true;
  let loadingSuspended = false;
  let destroyed = false;
  function discardPlayer(id,player) {
    player.destroy();
    players.delete(id);
    pendingFeedback.delete(id);
  }
  function sync(root) {
    if (destroyed) return;
    hosts = new Map([...root.querySelectorAll('[data-character-portrait]')].map(host=>[host.dataset.characterPortrait,host]));
    if (!loadingSuspended) syncPlayers();
  }
  function syncPlayers() {
    for(const [id,player] of players){
      if(!hosts.has(id)&&player.state==='loading')discardPlayer(id,player);
    }
    const missing=[...hosts.keys()].filter(id=>!players.has(id)).length;
    // Release the least recently mounted hidden players before allocating new
    // WebGL contexts. All portraits present on this page remain alive.
    const limit=Math.max(cacheLimit,hosts.size);
    for(const [id,player] of players){
      if(players.size+missing<=limit)break;
      if(hosts.has(id))continue;
      discardPlayer(id,player);
    }
    for (const id of hosts.keys()) {
      const player=players.get(id)||createPilotPortraitPlayer(id,{videoSurface,cubismSurface,blueSurface});
      players.delete(id);players.set(id,player);
    }
    for (const [id,player] of players) {
      player.setVisible(visible && hosts.has(id));
      player.attach(hosts.get(id) || null);
    }
  }
  return {
    sync,
    feedback(id) {
      const player=players.get(id), motion=PILOT_PORTRAITS[id]?.feedback;
      if(destroyed || !visible || !hosts.has(id) || !player || !motion || pendingFeedback.has(id) || (player.playing && player.motionName===motion)) return false;
      const ticket={};pendingFeedback.set(id,ticket);
      return Promise.resolve(player.playMotion(motion,{returnToIdle:true})).finally(()=>{
        if(pendingFeedback.get(id)===ticket)pendingFeedback.delete(id);
      });
    },
    setVisible(value, { suspendLoading = false } = {}) {
      if(destroyed)return;
      const next=Boolean(value);
      if (!next && suspendLoading) {
        loadingSuspended = true;
        for (const [id,player] of players) {
          if (player.state === 'loading') discardPlayer(id,player);
        }
      } else if (next && loadingSuspended) {
        loadingSuspended = false;
        visible = true;
        syncPlayers();
        return;
      }
      if(next===visible)return;
      visible=next;
      // Returning from a modal resumes only portraits mounted on this page.
      // Cached catalog/recruitment players must stay asleep until mounted again.
      for(const [id,player] of players)player.setVisible(visible && hosts.has(id));
    },
    destroy() { destroyed=true;for(const player of players.values())player.destroy();players.clear();hosts.clear();pendingFeedback.clear(); },
  };
}
