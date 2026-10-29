import { createPilotPortraitPlayer } from './portrait-player-factory.js';
import { PILOT_PORTRAITS } from './character-portraits.js';

/** Reuses each character's canvas when snapshots replace the lobby markup. */
export function createCharacterPortraits() {
  const players = new Map();
  const pendingFeedback = new Set();
  let hosts = new Map();
  let visible = true;
  let destroyed = false;
  function sync(root) {
    if (destroyed) return;
    hosts = new Map([...root.querySelectorAll('[data-character-portrait]')].map(host=>[host.dataset.characterPortrait,host]));
    for (const id of hosts.keys()) {
      if (!players.has(id)) players.set(id,createPilotPortraitPlayer(id));
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
      pendingFeedback.add(id);
      return Promise.resolve(player.playMotion(motion,{returnToIdle:true})).finally(()=>pendingFeedback.delete(id));
    },
    setVisible(value) {
      if(destroyed)return;
      visible=Boolean(value);
      // Returning from a modal resumes only portraits mounted on this page.
      // Cached catalog/recruitment players must stay asleep until mounted again.
      for(const [id,player] of players)player.setVisible(visible && hosts.has(id));
    },
    destroy() { destroyed=true;for(const player of players.values())player.destroy();players.clear();hosts.clear();pendingFeedback.clear(); },
  };
}
