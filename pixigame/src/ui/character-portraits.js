import { portraitFramingStyle } from './portrait-framing.js';
import { pilotAvatarIcon } from '../pilot-avatar-icons.js';
const base = import.meta.env?.BASE_URL ?? '/';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const PILOT_PORTRAITS = Object.freeze({
  'pilot-07': Object.freeze({image:`${base}art/luna-maid-v1/portrait.png`,avatar:pilotAvatarIcon('pilot-07'),label:'双子·露娜',variant:'source-driven-luna-maid-layered-v10',feedback:'touch_head'}),
  'pilot-09': Object.freeze({image:`${base}art/purple-doctor-v1/portrait.png`,avatar:pilotAvatarIcon('pilot-09'),label:'四象·凛',variant:'purple-doctor-layered-mesh-v5',feedback:'touch_head'}),
  'pilot-01': Object.freeze({image:`${base}art/orange-jetboard-v5/portrait.png`,avatar:pilotAvatarIcon('pilot-01'),label:'夜莺·零',variant:'orange-reference-driven-target-mesh-v1',feedback:'touch_head'}),
  'pilot-03': Object.freeze({image:`${base}art/commander-live2d-v1/portrait-style-v9.png`,avatar:pilotAvatarIcon('pilot-03'),label:'指挥官',feedback:'touch_head'}),
  'pilot-04': Object.freeze({image:`${base}art/blue-ponytail-v15/portrait-reference-style-v1.png`,avatar:pilotAvatarIcon('pilot-04'),label:'苍弦·伊织',variant:'native-blue-ponytail-v15-eyes-v7',feedback:'touch_head'}),
  'pilot-02': Object.freeze({image:`${base}art/engineer-ee76/portrait-inner-hem-v5.png`,avatar:pilotAvatarIcon('pilot-02'),label:'工程师',variant:'native-ee76-reference-style-v1',feedback:'touch_core',previewFeedback:'touch_core'}),
  'commander-silver': Object.freeze({image:`${base}art/silver-commander-v1/portrait.png`,avatar:`${base}art/silver-commander-v1/portrait.png`,label:'银发指挥官',feedback:'touch_head',previewOnly:true}),
  'pilot-05': Object.freeze({image:`${base}art/golden-yoga-v12/portrait-reference-style-v1.png`,avatar:pilotAvatarIcon('pilot-05'),label:'卡莲',variant:'native-golden-v12-target-mesh',feedback:'touch_head'}),
  'pilot-06': Object.freeze({image:`${base}art/blue-hand-cannon-v28-socket/portrait-outline-v3.png`,avatar:pilotAvatarIcon('pilot-06'),label:'赤瞳·维拉',variant:'baked-blue-hand-cannon-v28-socket',feedback:'touch_head'}),
  'pilot-08': Object.freeze({image:`${base}art/violet-astra-v31/portrait.png`,avatar:pilotAvatarIcon('pilot-08'),label:'三曜·诺娅',variant:'native-violet-v31-video',feedback:'touch_head'}),
  'pilot-10': Object.freeze({ image:`${base}art/white-gold-luoen-r13/portrait-sportbike-v1.png`, avatar:pilotAvatarIcon('pilot-10'), scene:`${base}art/white-gold-luoen-r13/static-sportbike-v2.png`, label:'白金骑士', variant:'cubism-r13', feedback:'touch_head' }),
});

export function portraitPresentation(pilot) {
  const config = PILOT_PORTRAITS[pilot.id];
  return config ? {...pilot,image:config.image,avatar:config.avatar} : pilot;
}

export function characterPortrait(pilot, className = '') {
  const config = PILOT_PORTRAITS[pilot?.id];
  if (!config) return '';
  const framing = portraitFramingStyle(pilot.id);
  const placement = framing ? ` data-portrait-framed style="${framing}"` : '';
  const click = config.feedback ? ' data-action="portraitFeedback" tabindex="0" role="button"' : ' role="img"';
  return `<div class="character-portrait ${className}" data-character-portrait="${escape(pilot.id)}"${placement}${click} aria-label="${escape(pilot.name || config.label)}${config.feedback?'，点击互动':''}">${config.scene?`<img class="character-portrait-scene" src="${config.scene}" alt="" aria-hidden="true" draggable="false">`:''}<img class="character-portrait-fallback" src="${config.image}" alt="" aria-hidden="true" draggable="false"></div>`;
}

