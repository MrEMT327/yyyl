import { createPeripheralSystem } from '../../src/peripheral/system.js';
import { CAMPAIGN } from '../../src/campaign.js';
import { tuneMainlineCampaign } from '../../src/peripheral/balance-tuning.js';
import { DEFAULT_PLAYER_NAME } from '../../src/player-identity.js';
import { mountCanvasLobby } from '../../src/ui/canvas-lobby.js';
import { battleOnboarding } from '../../src/peripheral/onboarding.js';
import { pilotAffectionVideo, PILOT_AFFECTION_MAX } from '../../src/peripheral/pilot-affection.js';

const profileKey = 'thunder-profile-v1';
const selectionKey = 'shnh-wechat-selected-stage';

export function createWechatLobby({ api, screen, storage, resolveAsset, start, openDiagnostics, openAffection, onChange }) {
  let selected = 0;
  const profile = { playerName: DEFAULT_PLAYER_NAME, coins: 600, diamonds: 0,
    fighterLevel: 1, gearLevel: 1, techLevel: 1, supplyOpened: 0, lastFreeSupply: '' };
  try {
    Object.assign(profile, JSON.parse(storage.getItem(profileKey) || 'null'));
    selected = Math.max(0, Math.min(CAMPAIGN.length - 1, Number(storage.getItem(selectionKey)) || 0));
  } catch { /* A new device starts with the default pilot and chapter. */ }
  const stages = tuneMainlineCampaign(CAMPAIGN);
  let lobby;
  const system = createPeripheralSystem({ storage, profile, stages,
    getCampaign: () => ({ results: {} }),
    saveProfile: () => storage.setItem(profileKey, JSON.stringify(profile)),
    getSelectedStage: () => selected,
    selectStage(index) {
      selected = index;
      storage.setItem(selectionKey, String(index));
    },
    onChange() { lobby?.refresh(); onChange?.(); },
  });
  const snapshot = () => system.snapshot();
  if (!snapshot().stages[selected]?.unlocked) selected = 0;
  const bridge = {
    platformKind: 'wechat', profileState: profile, game: { state: 'menu' },
    openDiagnostics, openAffection,
    getPeripheralSnapshot: snapshot,
    async peripheralAction(action, payload = {}) {
      if (action === 'start') return start();
      if (action === 'developerAffectionMax') payload = { pilotId: snapshot().pilotId };
      if (['developerChaptersUnlock', 'developerResearchUnlock', 'developerCurrency'].includes(action)) {
        payload = { ...payload, currency: payload.type, expectedRevision: snapshot().nativeAcquisition.revision };
      }
      return system.action(action, payload);
    },
  };
  lobby = mountCanvasLobby({ bridge, system, direct2D: true, resolveAsset,
    createCanvas: () => api.createOffscreenCanvas?.({ type: '2d', width: 750, height: 1624 }) ?? api.createCanvas(),
    createImage: () => screen.createImage?.() ?? api.createImage(),
  });
  return { ...lobby, system, snapshot,
    get chapter() { return snapshot().stages[selected]?.replicaChapterId ?? 1; },
    get onboarding() { return battleOnboarding(snapshot(), this.chapter); },
    get affection() {
      const { pilotId, pilots } = snapshot();
      const pilot = pilots.find(entry => entry.id === pilotId);
      const points = pilot?.affection || 0;
      return { name: pilot?.name, points, max: PILOT_AFFECTION_MAX,
        video: points === PILOT_AFFECTION_MAX ? pilotAffectionVideo(pilotId) : null };
    },
  };
}
