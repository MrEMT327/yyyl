import { createPsdCombatHud } from './psd-combat-hud.js';
import { renderCombatPause } from './combat-pause-ui.js';
import { renderDefeatResult } from './defeat-result-ui.js';
import { addChildren } from './pixi-display.js';
import { resumeDodgeTutorialPointer } from '../dodge-tutorial.js';
import { edgeThreats } from './threat-feedback.js';
import { revealChoiceCards } from './status-feedback.js';
import { revealResult } from './result-feedback.js';
import {renderBattleSupply, updateBattleSupply} from './battle-supply-ui.js';
import { fixedPartName } from '../fixed-parts/parts.js';
import {
  Container,
  ColorMatrixFilter,
  Graphics,
  Point,
  Rectangle,
  Sprite,
  Text,
  Texture,
} from '../three/display.js';
import { CAMPAIGN as SOURCE_CAMPAIGN, stageWaveTime } from '../campaign.js';
import { tuneMainlineCampaign } from '../peripheral/balance-tuning.js';
import {
  ROUTE_MAP,
  SKILL_MAP,
  getSkillDescription,
  getUltimateProgress,
} from '../roguelite.js';
import {
  DIFFICULTIES,
  DIFFICULTY_MAP,
  estimateStagePower,
  ratePowerReadiness,
} from '../balance.js';
import { resonanceDamageBonus, SSR_PILOTS } from '../pilots.js';
import { createBossPortrait } from '../boss-visual.js';
import { createAssemblyPage } from './assembly-page.js';
import { createSortiePage } from './sortie-page.js';
import { createLoadoutPage } from './loadout-page.js';
import { createUpgradePage } from './upgrade-page.js';
import { createSupplyPage } from './supply-page.js';
import { createPilotSkillCutIn } from './pilot-skill-cutin.js';
import { renderFixedUpgradeUi } from './fixed-upgrade-ui.js';
import { COMBAT_UI, COMBAT_HUD, COMBAT_TYPE, combatButtonStyle } from './combat-theme.js';
import { resultRewards } from './result-rewards.js';
import { resultRewardStatus } from './result-reward-status.js';
import { victoryAdReward } from '../sortie-rewards.js';
import { paintCombatArt, setCombatArt } from './combat-art.js';
import { paintPsdPopup } from './psd-popup-art.js';
import { acquireFixedPartThumbnails } from './fixed-part-thumbnails.js';
import { upgradeIconLayout } from './upgrade-icon-layout.js';
import { createThreeSurface } from './three-surface.js';
import { drawUiSymbol, drawRank } from './ui-symbols.js';

const CAMPAIGN = tuneMainlineCampaign(SOURCE_CAMPAIGN);

function addVisualSurface(parent,draw){const s=createThreeSurface(),node=new Container();draw(s);node.object3D.add(s.group);node._disposeVisuals=()=>s.destroy();parent.addChild(node);return node;}
function addSymbol(parent,key,x,y,size=24,tint='#bdd4e2'){return addVisualSurface(parent,s=>drawUiSymbol(s,key,x,y,size,tint));}
function makeResourceIcon(name,size=24){
  const node=new Container();
  node.label='resource-icon-'+name;
  addSymbol(node,name,0,0,size);
  node._bounds=new Rectangle(0,0,size,size);
  return node;
}

const DESIGN_WIDTH = 600;
const DESIGN_HEIGHT = 1300;
// Mobile Safari's visible viewport is often wider than the 600:1300 content
// safe area because its browser chrome changes the usable height. Full-screen
// surfaces bleed horizontally so procedural world graphics cannot show around
// lobby pages, modals or cinematics; interactive content stays in the safe area.
const FULL_BLEED_X = DESIGN_WIDTH;
const HEADER_HEIGHT = 98;
const NAV_HEIGHT = 104;
// Keep only the lobby stack below the physical notch. The scene itself stays
// at the normal scale so combat and modal surfaces are not resized.
const WECHAT_LOBBY_TOP_INSET = 48;
const WECHAT_DAILY_LOGIN_TOP_INSET = 48;
// Temporary testing hook: keep the WeChat debug console hidden in normal builds.
const TEMP_WECHAT_DEBUG_TOOLS_ENABLED = false;

const COLORS = Object.freeze({
  page: 0x0c1425,
  pageDeep: 0x09111e,
  header: 0x182345,
  panel: 0x12283b,
  panelBright: 0x211a4c,
  card: 0x18263d,
  cardDeep: 0x111c31,
  art: 0x15233a,
  line: 0x5d5688,
  cyan: 0xb7a3ff,
  cyanBright: 0xe1d9ff,
  white: 0xf4f1ff,
  muted: 0xa7a1b6,
  amber: 0xe7ff78,
  purple: 0xb7a3ff,
  green: 0x71f6cb,
  red: 0xff9a83,
  ink: 0x17152b,
});

const FLIGHT_GRADE_META = Object.freeze([
  { id: 'C', min: 0, color: 0xa7c3c5 },
  { id: 'B', min: 600, color: 0x78f1e5 },
  { id: 'A', min: 1600, color: 0x5ec8ff },
  { id: 'S', min: 3200, color: 0xffcc58 },
  { id: 'SS', min: 6000, color: 0xff78c8 },
]);

function flightGradeMeta(score = 0) {
  return [...FLIGHT_GRADE_META].reverse()
    .find((grade) => Number(score) >= grade.min) || FLIGHT_GRADE_META[0];
}

const TAB_DEFINITIONS = [
  ['loadout', '机', '战姬'],
  ['assembly', '件', '固定件'],
  ['battle', '战', '出击'],
  ['upgrade', '升', '升级'],
  ['supply', '招', '招募'],
];

const MENU_STATES = new Set(['menu', 'gameover', 'victory', 'defeat']);
const FONT_FAMILY = COMBAT_TYPE.family;
const TEXT_RESOLUTION = 2;
const UI_FONT_SCALE = 1.08;
const preparedPilotTextures = new WeakSet();

function scaledFontSize(size) {
  return Math.max(1, Math.ceil((Number(size) || 1) * UI_FONT_SCALE));
}

function preparePilotTexture(texture) {
  if (!texture || texture === Texture.EMPTY || preparedPilotTextures.has(texture)) return texture;
  const source = texture.source;
  if (source) {
    // Keep the original 1024×1536 web portrait as the source for every lobby
    // surface. Generating mipmaps here picked a much smaller intermediate
    // image for the roster/gacha cards and made faces look visibly soft.
    source.autoGenerateMipmaps = false;
    source.scaleMode = 'linear';
    // Keep a little anisotropic headroom for the angled card crops while
    // still avoiding mipmap downsampling of the portrait source.
    source.maxAnisotropy = 4;
    source.update();
  }
  preparedPilotTextures.add(texture);
  return texture;
}

function preparePilotSprite(sprite) {
  // Most portrait focus offsets and the responsive scene scale are fractional.
  // Snap the final quad to physical pixels instead of blending across them.
  sprite.roundPixels = true;
  return sprite;
}

function createPilotLightFilter() {
  const filter = new ColorMatrixFilter();
  // The source portraits are already high-key. Tone them down slightly so
  // white hangar backgrounds retain detail instead of washing out the card.
  // This affects pilot art only; the lobby canvas and its UI accents keep
  // their original contrast.
  // Pixi filters default to resolution 1 even when the main renderer is
  // Retina-sized. Inheriting the renderer resolution prevents this pass from
  // softening otherwise high-resolution portrait edges.
  filter.resolution = 'inherit';
  filter.brightness(0.9, false);
  filter.contrast(0.08, true);
  return filter;
}

class UiSignal {
  connect(handler) {
    this.handler = handler;
  }

  emit(...args) {
    this.handler?.(...args);
  }
}

class ButtonContainer extends Container {
  constructor() {
    super();
    this.onDown = new UiSignal();
    this.onUp = new UiSignal();
    this.onUpOut = new UiSignal();
    this._enabled = true;
    this.eventMode = 'static';
    this.cursor = 'pointer';
  }

  set enabled(value) {
    this._enabled = Boolean(value);
    this.eventMode = this._enabled ? 'static' : 'auto';
    this.cursor = this._enabled ? 'pointer' : 'default';
  }

  get enabled() {
    return this._enabled;
  }
}

const pilotTextureLoads = new Map();
export async function loadPixiLobbyPilotTextures(documentRef, { pilotIds, textures = new Map() } = {}) {
  const sources = SSR_PILOTS.filter(pilot => !pilotIds || pilotIds.includes(pilot.id)).flatMap(pilot => [
    [pilot.id, pilot.image],
    ...(pilot.avatar ? [[`${pilot.id}:avatar`, pilot.avatar]] : []),
  ]);
  const entries = await Promise.all(sources.map(([id, path]) => {
    if (textures.has(id)) return [id, textures.get(id)];
    let pending = pilotTextureLoads.get(path);
    if (!pending) {
      pending = new Promise((resolve) => {
        const image = documentRef.createElement('img');
        const finish = texture => { clearTimeout(timeout); image.onload = image.onerror = null; resolve(texture); };
        const timeout = setTimeout(() => finish(Texture.EMPTY), 15000);
        image.onload = () => {
          try { finish(preparePilotTexture(Texture.from(image))); }
          catch { finish(Texture.EMPTY); }
        };
        image.onerror = () => finish(Texture.EMPTY);
        image.src = path;
      }).then(texture => { if (texture === Texture.EMPTY) pilotTextureLoads.delete(path); return texture; });
      pilotTextureLoads.set(path, pending);
    }
    return pending.then(texture => [id, texture]);
  }));
  for (const [id, texture] of entries) if (texture !== Texture.EMPTY) textures.set(id, texture);
  return textures;
}

export function loadPixiLobbyDailyLoginTexture(documentRef) {
  return new Promise((resolve) => {
    const image = documentRef.createElement('img');
    image.onload = () => resolve(preparePilotTexture(Texture.from(image)));
    image.onerror = () => resolve(Texture.EMPTY);
    image.src = './assets/ui/daily-login-icon.png';
  });
}

function number(value) {
  return String(Math.max(0, Math.round(Number(value) || 0)));
}

function color(value, fallback = COLORS.white) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) {
    return Number.parseInt(value.slice(1), 16);
  }
  return fallback;
}

function makeText(value, {
  size = 18,
  fill = COLORS.white,
  weight = '700',
  align = 'left',
  letterSpacing = 0,
  lineHeight = 0,
  maxWidth = 0,
  layout = {},
} = {}) {
  const renderedSize = scaledFontSize(size);
  const view = new Text({
    text: String(value),
    // The complete scene is scaled to the phone viewport. Rasterizing text at
    // a stable high resolution keeps small HUD labels crisp after that scale.
    resolution: TEXT_RESOLUTION,
    roundPixels: true,
    style: {
      fontFamily: FONT_FAMILY,
      fontSize: renderedSize,
      fontWeight: weight,
      fill,
      align,
      letterSpacing,
      lineHeight: lineHeight
        ? Math.ceil(lineHeight * UI_FONT_SCALE)
        : Math.ceil(renderedSize * 1.25),
      wordWrap: maxWidth > 0,
      wordWrapWidth: maxWidth || 1000,
      breakWords: true,
    },
  });
  view.layout = {
    width: maxWidth || Math.ceil(view.width),
    height: Math.ceil(view.height),
    flexShrink: 0,
    isLeaf: true,
    objectFit: 'contain',
    objectPosition: align === 'center' ? 'center' : align === 'right' ? 'right' : 'left',
    ...layout,
  };
  return view;
}

function makeBox(layout, {
  fill = null,
  fillAlpha = 1,
  stroke = null,
  strokeAlpha = 1,
  strokeWidth = 1,
  radius = 0,
  cut = 0,
} = {}) {
  const root = new Container();
  const background = new Graphics();
  root.addChild(background);
  root.layout = layout;
  const redraw = (width, height) => {
    background.clear();
    if (cut > 0) {
      background.poly([
        cut, 0,
        width, 0,
        width, height - cut,
        width - cut, height,
        0, height,
        0, cut,
      ]);
    } else {
      background.roundRect(0, 0, width, height, radius);
    }
    if (fill !== null) background.fill({ color: fill, alpha: fillAlpha });
    else background.fill({ color: 0xffffff, alpha: 0 });
    if (stroke !== null && strokeWidth > 0) {
      background.stroke({ color: stroke, alpha: strokeAlpha, width: strokeWidth });
    }
  };
  if (Number.isFinite(layout.width) && Number.isFinite(layout.height)) {
    redraw(layout.width, layout.height);
  }
  root.on('layout', (computed) => {
    const { width, height } = computed.computedLayout;
    redraw(width, height);
  });
  return root;
}

function makeRawText(value, {
  size = 18,
  fill = COLORS.white,
  weight = '700',
  family = FONT_FAMILY,
  align = 'left',
  letterSpacing = 0,
  lineHeight = 0,
  maxWidth = 0,
  anchorX = 0,
  anchorY = 0,
} = {}) {
  const renderedSize = scaledFontSize(size);
  const view = new Text({
    text: String(value),
    resolution: TEXT_RESOLUTION,
    roundPixels: true,
    style: {
      fontFamily: family,
      fontSize: renderedSize,
      fontWeight: weight,
      fill,
      align,
      letterSpacing,
      lineHeight: lineHeight
        ? Math.ceil(lineHeight * UI_FONT_SCALE)
        : Math.ceil(renderedSize * 1.25),
      wordWrap: maxWidth > 0,
      wordWrapWidth: maxWidth || 1000,
      breakWords: true,
    },
  });
  view.anchor.set(anchorX, anchorY);
  return view;
}

function makeSingleLineRawText(value, options = {}, maxWidth = 0) {
  const naturalSize = Number(options.size) || 18;
  const { minSize = Math.max(9, Math.floor(naturalSize * 0.62)), ...rawOptions } = options;
  const view = makeRawText(value, {
    ...rawOptions,
    maxWidth: 0,
  });
  // Fit with a real font-size change so glyphs keep their original aspect
  // ratio. Horizontal scale made English labels look squeezed and distorted.
  if (maxWidth > 0 && view.width > maxWidth) {
    const minimum = scaledFontSize(minSize);
    let fitted = Math.max(
      minimum,
      Math.floor(scaledFontSize(naturalSize) * (maxWidth / view.width)),
    );
    view.style.fontSize = fitted;
    view.style.lineHeight = Math.ceil(fitted * 1.25);
    while (view.width > maxWidth && fitted > minimum) {
      fitted -= 1;
      view.style.fontSize = fitted;
      view.style.lineHeight = Math.ceil(fitted * 1.25);
    }
  }
  return view;
}

function place(parent, view, x, y) {
  view.position.set(x, y);
  parent.addChild(view);
  return view;
}

function addAdBadge(button, width, { small = false, offsetX = 0 } = {}) {
  // This is deliberately native Pixi graphics rather than an image texture: UI
  // buttons can appear before image assets are decoded, which made the badge
  // intermittently invisible in the combat/lobby canvas.
  const size = small ? 21 : 31;
  const scale = size / 50;
  const badge = new Container();
  const icon = new Graphics()
    .roundRect(2, 4, 34, 34, 3)
    .fill({ color: 0x090b09, alpha: 0.98 })
    .stroke({ color: 0xf2f7d7, alpha: 0.96, width: 2 })
    .poly([13, 11, 13, 31, 29, 21])
    .fill({ color: 0xf2f7d7 })
    // Film strip at the right edge, matching the supplied ad icon.
    .roundRect(37, 12, 9, 20, 2)
    .fill({ color: 0x090b09, alpha: 0.98 })
    .rect(38, 15, 3, 5)
    .rect(38, 25, 3, 5)
    .fill({ color: 0xf2f7d7 });
  badge.addChild(icon);
  badge.scale.set(scale);
  badge.position.set(
    width - size + (small ? 2 : 4) + offsetX,
    small ? -4 : -6,
  );
  badge.eventMode = 'none';
  button.addChild(badge);
  return badge;
}

function makeManualButton({
  x = 0,
  y = 0,
  width,
  height,
  text = '',
  subtext = '',
  fill = 0x0b0a25,
  pressedFill = 0x241b58,
  fillAlpha = 0.98,
  stroke = COLORS.line,
  strokeAlpha = 0.75,
  textColor = COLORS.white,
  subtextColor = COLORS.muted,
  fontSize = 18,
  subSize = 15,
  radius = 0,
  adBadge = false,
  disabled = false,
  disabledFill = 0x080817,
  disabledTextColor = 0x625f70,
  disabledSubtextColor = 0x514e5e,
  disabledAlpha = 0.48,
  onPress = null,
}) {
  const button = new ButtonContainer();
  button.position.set(x, y);
  button.enabled = !disabled;
  button.cursor = disabled ? 'default' : 'pointer';
  button.hitArea = new Rectangle(0, 0, width, height);
  const background = new Graphics();
  const redraw = (pressed = false) => {
    background
      .clear()
      .roundRect(0, 0, width, height, radius)
      .fill({
        color: disabled ? disabledFill : pressed ? pressedFill : fill,
        alpha: disabled ? disabledAlpha : fillAlpha,
      })
      .stroke({
        color: stroke,
        alpha: disabled ? 0.22 : strokeAlpha,
        width: 1.5,
      });
  };
  redraw();
  button.addChild(background);
  if (text) {
    place(button, makeSingleLineRawText(text, {
      size: fontSize,
      fill: disabled ? disabledTextColor : textColor,
      weight: '900',
      align: 'center',
      anchorX: 0.5,
      anchorY: 0.5,
    }, Math.max(1, width - (adBadge ? 34 : 16))), width / 2, subtext ? height * 0.37 : height / 2);
  }
  if (subtext) {
    place(button, makeSingleLineRawText(subtext, {
      size: subSize,
      fill: disabled ? disabledSubtextColor : subtextColor,
      weight: '800',
      align: 'center',
      anchorX: 0.5,
      anchorY: 0.5,
    }, Math.max(1, width - 16)), width / 2, height * 0.73);
  }
  if (adBadge) addAdBadge(button, width);
  button.onDown.connect(() => redraw(true));
  button.onUp.connect(() => redraw(false));
  button.onUpOut.connect(() => redraw(false));
  button.__pixiUiAction = !disabled && onPress ? onPress : null;
  return button;
}

function makeBottomCloseButton(onPress, {
  fill = 0x0b0a25,
  pressedFill = 0x241b58,
  stroke = COLORS.line,
  strokeAlpha = 0.75,
  textColor = COLORS.white,
} = {}) {
  return makeManualButton({
    x: 210,
    y: DESIGN_HEIGHT - 84,
    width: 180,
    height: 58,
    text: '关闭',
    fill,
    pressedFill,
    stroke,
    strokeAlpha,
    textColor,
    fontSize: 18,
    radius: 8,
    onPress,
  });
}

function clipButtonActions(node, clip) {
  if (
    node.__pixiUiAction
    || node.__pixiUiAssemblyDrag
    || node.__pixiUiAssemblySlotId
    || node.__pixiUiAssemblyInventory
  ) node.__pixiUiClip = clip;
  for (const child of node.children || []) clipButtonActions(child, clip);
}

function stabilizeManualPage(page, width, height) {
  const bounds = new Graphics()
    .rect(0, 0, width, height)
    .fill({ color: 0x000000, alpha: 0.001 });
  bounds.eventMode = 'none';
  page.addChild(bounds);
  return page;
}

function destroyPixiUiResources(node) {
  for (const child of [...(node.children || [])]) destroyPixiUiResources(child);
  node.__pixiUiDestroy?.();
}

function makeReliableScrollView({
  width,
  height,
  items,
  gap = 0,
  contentHeight = 0,
  scrollKey,
  scrollY = 0,
}) {
  const scrollView = new Container();
  scrollView.eventMode = 'static';
  scrollView.hitArea = new Rectangle(0, 0, width, height);
  const content = new Container();
  content.isRenderGroup = true;
  const measuredContentHeight = Math.max(
    contentHeight,
    items.reduce((sum, item) => sum + item.height, 0)
      + Math.max(0, items.length - 1) * gap,
  );
  const minY = Math.min(0, height - measuredContentHeight);
  const initialY = Math.max(minY, Math.min(0, Number(scrollY) || 0));
  let cursorY = 0;
  items.forEach((item, index) => {
    item.position.set(0, cursorY);
    content.addChild(item);
    cursorY += item.height + (index < items.length - 1 ? gap : 0);
  });
  content.position.set(0, initialY);
  const mask = new Graphics()
    .rect(0, 0, width, height)
    .fill({ color: 0xffffff });
  mask.eventMode = 'none';
  scrollView.addChild(content, mask);
  scrollView.mask = mask;
  scrollView.__pixiUiReliableScroll = true;
  scrollView.__pixiUiScrollKey = scrollKey;
  scrollView.__pixiUiScrollMinY = minY;
  scrollView.__pixiUiScrollY = initialY;
  scrollView.__pixiUiScrollContent = content;
  return scrollView;
}

function clampReliableScrollY(scrollView, value) {
  return Math.max(
    scrollView.__pixiUiScrollMinY,
    Math.min(0, Number(value) || 0),
  );
}

function setReliableScrollY(scrollView, value) {
  const next = clampReliableScrollY(scrollView, value);
  scrollView.__pixiUiScrollY = next;
  const content = scrollView.__pixiUiScrollContent;
  content.position.set(content.position.x, next);
  return next;
}

function makeButton({
  text,
  subtext = '',
  onPress,
  disabled = false,
  selected = false,
  fill = COLORS.panelBright,
  pressedFill = COLORS.cyan,
  stroke = COLORS.line,
  textColor = COLORS.white,
  disabledColor = 0x596b70,
  radius = 4,
  cut = 0,
  fontSize = 17,
  subSize = 12,
  titleRatio = null,
  subtextRatio = 0.7,
  layout = {},
}) {
  const button = new ButtonContainer();
  const background = new Graphics();
  const title = makeText(text, {
    size: fontSize,
    fill: disabled ? disabledColor : textColor,
    weight: '900',
    align: 'center',
  });
  title.layout = null;
  const detail = subtext
    ? makeText(subtext, {
      size: subSize,
      fill: disabled ? 0x53666b : selected ? COLORS.ink : COLORS.muted,
      weight: '700',
      align: 'center',
    })
    : null;
  if (detail) detail.layout = null;
  button.addChild(background, title);
  if (detail) button.addChild(detail);
  button.layout = {
    flexShrink: 0,
    ...layout,
  };
  button.enabled = !disabled;
  button.cursor = disabled ? 'default' : 'pointer';

  let pressed = false;
  const redraw = (layoutData = button.layout) => {
    const computed = layoutData?.computedLayout || {};
    const width = computed.width || Number(layout.width) || 100;
    const height = computed.height || Number(layout.height) || 50;
    const activeFill = disabled ? 0x0a171d : pressed ? pressedFill : fill;
    const activeStroke = selected ? COLORS.cyanBright : stroke;
    background.clear();
    if (cut > 0) {
      background.poly([
        cut, 0,
        width, 0,
        width, height - cut,
        width - cut, height,
        0, height,
        0, cut,
      ]);
    } else {
      background.roundRect(0, 0, width, height, radius);
    }
    background
      .fill({ color: activeFill, alpha: disabled ? 0.52 : 0.98 })
      .stroke({
        color: activeStroke,
        alpha: disabled ? 0.28 : selected ? 0.92 : 0.7,
        width: selected ? 2 : 1,
      });
    title.position.set(
      width / 2,
      height * (titleRatio ?? (detail ? 0.34 : 0.5)),
    );
    title.anchor.set(0.5);
    if (detail) {
      detail.position.set(width / 2, height * subtextRatio);
      detail.anchor.set(0.5);
    }
    button.hitArea = new Rectangle(0, 0, width, height);
  };
  button.on('layout', redraw);
  button.onDown.connect(() => {
    pressed = true;
    redraw();
  });
  const release = () => {
    pressed = false;
    redraw();
  };
  button.onUp.connect(release);
  button.onUpOut.connect(release);
  button.__pixiUiAction = !disabled && onPress ? onPress : null;
  return button;
}

function makeHeading(eyebrow, title, aside = '') {
  const root = makeBox({
    width: '100%',
    height: 78,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingBottom: 12,
    borderBottomWidth: 1,
  });
  const copy = new Container({
    children: [
      makeText(eyebrow, {
        size: 13,
        fill: COLORS.cyan,
        weight: '900',
        letterSpacing: 2,
      }),
      makeText(title, {
        size: 30,
        fill: COLORS.white,
        weight: '900',
        letterSpacing: 1,
      }),
    ],
  });
  copy.layout = {
    flexDirection: 'column',
    gap: 5,
    flexGrow: 1,
  };
  addChildren(root, copy);
  if (aside) {
    const asideView = makeText(aside, {
      size: 15,
      fill: COLORS.amber,
      weight: '900',
      align: 'right',
    });
    asideView.layout = { marginLeft: 12, flexShrink: 0 };
    addChildren(root, asideView);
  }
  return root;
}

function makeHeader(bridge, topInset = 0) {
  const compactWechatHeader = bridge.platformKind === 'wechat';
  const header = makeBox({
    width: DESIGN_WIDTH,
    height: HEADER_HEIGHT,
    flexShrink: 0,
    marginTop: topInset,
    flexDirection: 'row',
    alignItems: compactWechatHeader ? 'flex-end' : 'center',
    justifyContent: compactWechatHeader ? 'flex-start' : 'flex-end',
    paddingLeft: compactWechatHeader ? 10 : 27,
    paddingRight: 27,
    paddingBottom: compactWechatHeader ? 12 : 0,
  }, {
    // On WeChat the notch-safe lobby area should blend into the page instead
    // of forming a separate dark strip above the main interface.
    fill: compactWechatHeader ? COLORS.page : COLORS.header,
    stroke: compactWechatHeader ? null : COLORS.cyan,
    strokeAlpha: compactWechatHeader ? 0 : 0.22,
  });
  header.addChild(
    new Graphics()
      .circle(455, 40, 155)
      .fill({ color: COLORS.cyan, alpha: 0.055 }),
  );

  const wallet = new Container();
  wallet.layout = compactWechatHeader
    ? {
      flexDirection: 'row',
      gap: 6,
      width: 270,
      height: 36,
      justifyContent: 'flex-start',
    }
    : {
      flexDirection: 'row',
      gap: 8,
      width: 294,
      justifyContent: 'flex-end',
    };
  const money = (symbol, value, tint, onPress = null, actionLabel = '') => {
    const itemWidth = compactWechatHeader ? 132 : 143;
    const itemHeight = compactWechatHeader ? 36 : 56;
    const item = makeBox({
      width: itemWidth,
      height: itemHeight,
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: compactWechatHeader ? 7 : 10,
      marginLeft: compactWechatHeader && symbol === '●' ? 10 : 0,
    }, {
      fill: 0x09081f,
      fillAlpha: 0.9,
      stroke: 0x62578a,
      strokeAlpha: 0.36,
    });
    const divider = new Graphics()
      .rect(compactWechatHeader ? 100 : 112, 0, 1, itemHeight)
      .fill({ color: 0x8d80b8, alpha: 0.25 });
    addChildren(
      item,
      divider,
      Object.assign(makeResourceIcon(symbol==='●'?'coins':'diamonds',compactWechatHeader?22:28),{layout:{width:compactWechatHeader?22:28,height:compactWechatHeader?22:28}}),
      makeText(number(value), {
        size: compactWechatHeader ? 15 : 20,
        fill: COLORS.white,
        weight: '900',
        align: 'right',
        layout: { width: compactWechatHeader ? 66 : 70 },
      }),
      actionLabel
        ? makeText(actionLabel, {
          size: compactWechatHeader ? 12 : actionLabel.length > 1 ? 17 : 22,
          fill: 0xa59db7,
          weight: '700',
          align: 'center',
          layout: {
            width: compactWechatHeader ? 24 : 28,
            marginLeft: compactWechatHeader ? 10 : 0,
          },
        })
        : null,
    );
    if (onPress) {
      item.enabled = true;
      item.eventMode = 'static';
      item.cursor = 'pointer';
      item.hitArea = new Rectangle(0, 0, itemWidth, itemHeight);
      item.__pixiUiAction = onPress;
      addAdBadge(item, itemWidth, {
        small: true,
        offsetX: compactWechatHeader ? 10 : 0,
      });
    }
    return item;
  };
  addChildren(
    wallet,
    money('◆', bridge.profileState.diamonds, 0x76eaff, () => bridge.requestAdDiamonds(), '+20'),
    money('●', bridge.profileState.coins, COLORS.amber),
  );
  addChildren(header, wallet);
  return header;
}

function makeDailyLoginIcon(bridge, width, height) {
  const root = new Container();
  root.addChild(
    new Graphics()
      .ellipse(width / 2, height * 0.72, width * 0.4, height * 0.2)
      .fill({ color: 0x7c5cff, alpha: 0.13 }),
  );
  const texture = preparePilotTexture(bridge.resolveDailyLoginTexture?.() || Texture.EMPTY);
  if (texture !== Texture.EMPTY) {
    const sprite = preparePilotSprite(new Sprite(texture));
    const textureWidth = Math.max(1, texture.orig?.width || texture.width || 1);
    const textureHeight = Math.max(1, texture.orig?.height || texture.height || 1);
    const scale = Math.min(width / textureWidth, height / textureHeight);
    sprite.anchor.set(0.5);
    sprite.scale.set(scale);
    sprite.position.set(width / 2, height / 2);
    root.addChild(sprite);
  } else {
    root.addChild(
      new Graphics()
        .roundRect(width * 0.16, height * 0.16, width * 0.68, height * 0.68, 7)
        .fill({ color: 0x21164f })
        .stroke({ color: COLORS.cyan, alpha: 0.9, width: 2 }),
    );
    place(root, makeRawText('7', {
      size: Math.min(width, height) * 0.5,
      fill: COLORS.amber,
      weight: '900',
      anchorX: 0.5,
      anchorY: 0.5,
    }), width / 2, height / 2);
  }
  return root;
}

function drawNavigationIcon(graphics, id, tint, active, cx, cy) {
  graphics.clear();
  const alpha = active ? 1 : 0.62;
  const width = active ? 3 : 2;
  if (id === 'loadout') {
    graphics
      .poly([cx, cy - 14, cx + 13, cy + 11, cx - 13, cy + 11])
      .stroke({ color: tint, alpha, width });
  } else if (id === 'assembly') {
    graphics
      .poly([cx, cy - 13, cx + 13, cy + 11, cx - 13, cy + 11])
      .stroke({ color: tint, alpha, width })
      .circle(cx, cy + 3, 3)
      .fill({ color: tint, alpha });
  } else if (id === 'battle') {
    graphics
      .poly([
        cx + 3, cy - 16,
        cx - 8, cy + 2,
        cx - 1, cy + 2,
        cx - 5, cy + 17,
        cx + 10, cy - 5,
        cx + 2, cy - 5,
      ])
      .fill({ color: tint, alpha });
  } else if (id === 'upgrade') {
    graphics
      .poly([cx, cy - 14, cx + 10, cy - 3, cx + 4, cy - 3, cx + 4, cy + 12, cx - 4, cy + 12, cx - 4, cy - 3, cx - 10, cy - 3])
      .fill({ color: tint, alpha });
  } else {
    graphics
      .poly([cx, cy - 13, cx + 13, cy, cx, cy + 13, cx - 13, cy])
      .stroke({ color: tint, alpha, width })
      .circle(cx, cy, 3)
      .fill({ color: tint, alpha });
  }
}

function makeNavigationItem({ id, label, active, onPress }) {
  const button = new ButtonContainer();
  const background = new Graphics();
  const icon = new Graphics();
  const labelView = makeText(label, {
    size: 18,
    fill: active ? COLORS.white : 0x77728a,
    weight: '900',
    align: 'center',
  });
  labelView.layout = null;
  button.addChild(background, icon, labelView);
  button.layout = { flexGrow: 1, height: 91 };
  button.__pixiUiAction = onPress;
  const redraw = (layoutData = button.layout) => {
    const computed = layoutData?.computedLayout || {};
    const width = computed.width || 108;
    const height = computed.height || 91;
    background
      .clear()
      .poly([5, 0, width, 0, width, height - 5, width - 5, height, 0, height, 0, 5])
      .fill({ color: active ? 0x21164f : 0x09081e, alpha: active ? 0.98 : 0.88 })
      .stroke({
        color: active ? 0xb7a3ff : 0x322b50,
        alpha: active ? 0.96 : 0.34,
        width: active ? 2 : 1,
      });
    if (active) {
      background
        .rect(12, 0, Math.max(0, width - 24), 3)
        .fill({ color: 0xe1d9ff, alpha: 1 })
        .poly([width / 2 - 6, 3, width / 2 + 6, 3, width / 2, 9])
        .fill({ color: 0xe1d9ff, alpha: 0.95 });
    }
    drawNavigationIcon(
      icon,
      id,
      active ? 0xf4f1ff : 0x827d98,
      active,
      width / 2,
      29,
    );
    labelView.position.set(width / 2, 69);
    labelView.anchor.set(0.5);
    button.hitArea = new Rectangle(0, 0, width, height);
  };
  button.on('layout', redraw);
  return button;
}

function makeNavigation(bridge, rerender) {
  const nav = makeBox({
    width: DESIGN_WIDTH,
    height: NAV_HEIGHT,
    flexShrink: 0,
    flexDirection: 'row',
    gap: 5,
    paddingLeft: 11,
    paddingRight: 11,
    paddingTop: 5,
    paddingBottom: 8,
  }, {
    fill: COLORS.pageDeep,
    stroke: COLORS.cyan,
    strokeAlpha: 0.2,
  });
  TAB_DEFINITIONS.forEach(([id, , label]) => {
    const active = bridge.activeLobbyTab === id;
    addChildren(nav, makeNavigationItem({
      id,
      label,
      active,
      onPress: () => {
        bridge.switchLobbyTab(id);
        rerender();
      },
    }));
  });
  return nav;
}

function makeStarRating(stars, selected = false, {
  radius = 9,
  gap = 23,
} = {}) {
  const rating = new Container();
  const earned = Math.max(0, Math.min(3, Math.floor(Number(stars) || 0)));
  for (let index = 0; index < 3; index += 1) {
    const mark = new Graphics();
    const points = [];
    for (let point = 0; point < 10; point += 1) {
      const angle = -Math.PI / 2 + point * Math.PI / 5;
      const pointRadius = point % 2 === 0 ? radius : radius * (4.2 / 9);
      points.push(Math.cos(angle) * pointRadius, Math.sin(angle) * pointRadius);
    }
    const filled = index < earned;
    mark
      .poly(points)
      .fill({ color: filled ? 0xffe174 : selected ? 0x2b7776 : 0x172536, alpha: filled ? 1 : 0.42 })
      .stroke({ color: filled ? 0xfff3ad : selected ? 0x0d4d50 : 0x607082, alpha: filled ? 0.92 : 0.76, width: 1.2 });
    mark.position.set((index - 1) * gap, 0);
    rating.addChild(mark);
  }
  return rating;
}

function makeStageDetailCard(bridge, stage, index, {
  x = 0,
  width,
  height,
  onSelect,
}) {
  const unlocked = bridge.isStageUnlocked(index);
  const selected = index === bridge.selectedStageIndex;
  const stars = bridge.bestStageStars(index);
  const estimate = estimateStagePower(stage, bridge.selectedDifficultyId);
  const readiness = ratePowerReadiness(bridge.profilePower(), estimate.recommendedPower);
  const tint = stage.color;
  const button = new ButtonContainer();
  button.position.set(x, 0);
  button.enabled = unlocked;
  button.cursor = unlocked ? 'pointer' : 'default';
  button.hitArea = new Rectangle(0, 0, width, height);
  button.addChild(
    new Graphics()
      .roundRect(0, 0, width, height, 5)
      .fill({ color: unlocked ? 0x0b1327 : 0x080817, alpha: unlocked ? 0.98 : 0.72 })
      .stroke({
        color: selected ? 0xffffff : tint,
        alpha: selected ? 0.94 : unlocked ? 0.42 : 0.15,
        width: selected ? 2.5 : 1.5,
      })
      .rect(0, 0, 5, height)
      .fill({ color: tint, alpha: unlocked ? 0.9 : 0.22 }),
  );
  const bossPortrait = createBossPortrait(stage, {
    width: 68,
    height: 54,
    alpha: unlocked ? 1 : 0.28,
  });
  bossPortrait.position.set(40, height / 2);
  button.addChild(bossPortrait);
  const textMaxWidth = Math.max(1, width - 94);
  place(button, makeSingleLineRawText(`${String(index + 1).padStart(2, '0')} · ${stage.name}`, {
    size: 20,
    fill: unlocked ? COLORS.white : 0x625f70,
    weight: '900',
  }, textMaxWidth), 78, 18);
  const rating=makeStarRating(stars,selected,{radius:7,gap:20});rating.position.set(108,64);button.addChild(rating);
  addSymbol(button,'power',78,85,18,unlocked?'#a99e84':'#504e59');
  place(button, makeSingleLineRawText(number(estimate.recommendedPower), {
    size: 14,
    fill: unlocked ? 0x8e899f : 0x504e59,
    weight: '700',
  }, textMaxWidth-24), 103, 86);
  const status = unlocked ? '' : '尚未解锁';
  if (status) {
    addSymbol(button,'lock',width-30,88,19,'#77748a');
  }
  button.__pixiUiAction = unlocked ? () => onSelect(index) : null;
  return button;
}

function makeStageDetailsModal(bridge, onClose, onSelect, scrollY = 0) {
  const modal = new Container();
  modal.zIndex = 100;
  modal.eventMode = 'static';
  modal.hitArea = new Rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

  const shield = new ButtonContainer();
  shield.enabled = true;
  shield.hitArea = new Rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  shield.addChild(
    new Graphics()
      .rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT)
      .fill({ color: COLORS.pageDeep, alpha: 0.995 })
      .circle(480, 155, 240)
      .fill({ color: COLORS.cyan, alpha: 0.07 }),
  );
  // The dimmed background is intentionally non-interactive here. The shared
  // modal router closes it only when the tap did not start in the scroll list.
  shield.__pixiUiAction = null;
  modal.addChild(shield);

  addSymbol(modal,'grid',29,69,32,'#b7a3ff');
  place(modal, makeRawText('关卡', {
    size: 34,
    fill: COLORS.white,
    weight: '900',
    letterSpacing: 2,
  }), 78, 66);
  place(modal,makeRawText(`${bridge.selectedStageIndex+1} / ${CAMPAIGN.length}`,{size:19,fill:0x928ca4,anchorX:1}),568,151);
  modal.addChild(
    new Graphics()
      .rect(26, 129, DESIGN_WIDTH - 52, 1)
      .fill({ color: COLORS.cyan, alpha: 0.22 }),
  );
  modal.addChild(makeBottomCloseButton(onClose, {
    fill: 0x14102f,
    pressedFill: 0x2a2054,
    stroke: COLORS.cyan,
    textColor: COLORS.white,
  }));

  const listWidth = 540;
  const listHeight = DESIGN_HEIGHT - 288;
  const gap = 15;
  const cardWidth = Math.floor((listWidth - gap) / 2);
  const cardHeight = 126;
  const rows = [];
  for (let index = 0; index < CAMPAIGN.length; index += 2) {
    const row = new Container();
    row.addChild(
      new Graphics()
        .rect(0, 0, listWidth, cardHeight)
        .fill({ color: 0x000000, alpha: 0.001 }),
    );
    const first = makeStageDetailCard(bridge, CAMPAIGN[index], index, {
      width: index === CAMPAIGN.length - 1 ? listWidth : cardWidth,
      height: cardHeight,
      onSelect,
    });
    row.addChild(first);
    if (CAMPAIGN[index + 1]) {
      row.addChild(makeStageDetailCard(bridge, CAMPAIGN[index + 1], index + 1, {
        x: cardWidth + gap,
        width: cardWidth,
        height: cardHeight,
        onSelect,
      }));
    }
    rows.push(row);
  }

  const scrollBox = makeReliableScrollView({
    width: listWidth,
    height: listHeight,
    items: rows,
    gap: 12,
    contentHeight: rows.length * cardHeight + Math.max(0, rows.length - 1) * 12,
    scrollKey: 'stage-details',
    scrollY,
  });
  scrollBox.position.set(30, 194);
  rows.forEach((row) => clipButtonActions(row, scrollBox));
  modal.addChild(scrollBox);
  return modal;
}

function makeDailyLoginRewardCard(bridge, reward, index, snapshot, {
  x,
  y,
  width,
  height,
}) {
  const claimed = index < snapshot.claimedCount;
  const claimable = index === snapshot.claimedCount && snapshot.canClaimToday;
  const isNext = index === snapshot.claimedCount && !snapshot.completed;
  const isFinal = reward.day === 7;
  const tint = claimed
    ? COLORS.green
    : claimable
      ? COLORS.amber
      : isFinal
        ? 0x55e7a8
        : color(reward.color, COLORS.purple);
  const card = new Container();
  card.position.set(x, y);
  card.addChild(
    new Graphics()
      .roundRect(0, 0, width, height, 8)
      .fill({ color: claimable ? 0x241a49 : isFinal ? 0x0b2427 : 0x09081e, alpha: 0.98 })
      .stroke({ color: tint, alpha: claimable ? 1 : claimed ? 0.62 : 0.35, width: claimable ? 2.5 : 1.5 })
      .rect(0, 0, width, 4)
      .fill({ color: tint, alpha: claimable ? 1 : 0.55 }),
  );
  place(card, makeRawText(String(reward.day).padStart(2,'0'), {
    size: 14,
    fill: claimed ? COLORS.green : claimable ? COLORS.amber : 0x9993a8,
    weight: '900',
    anchorX: 0.5,
  }), width / 2, 16);

  if (isFinal) {
    const qinglan = SSR_PILOTS.find((pilot) => pilot.id === 'pilot-02');
    if (qinglan) {
      const portrait = makePortraitWindow(bridge, qinglan, Math.min(94, width - 24), 82, {
        avatar: true,
        zoom: 3.5,
        focusX: (qinglan.portraitFocus?.x ?? 50) / 100,
        focusY: (qinglan.portraitFocus?.y ?? 8) / 100,
        targetY: 0.18,
        // The reward preview stays fully visible even before it is claimed.
        // Claim state is communicated by the card label, not an image veil.
        alpha: 1,
      });
      portrait.position.set((width - Math.min(94, width - 24)) / 2, 43);
      card.addChild(portrait);
    }
  } else {
    card.addChild(
      new Graphics()
        .circle(width / 2, 84, 31)
        .fill({ color: tint, alpha: claimed || claimable ? 0.14 : 0.07 })
        .stroke({ color: tint, alpha: claimed || claimable ? 0.8 : 0.28, width: 2 }),
    );
    addSymbol(card,reward.type==='coins'?'coin':reward.day===2?'cadence':reward.day===4?'arrow':'target',width/2-23,61,46,claimed||claimable?'#dfc68a':'#91819e');
  }

  place(card, makeSingleLineRawText(reward.type==='coins'?`×${reward.amount}`:reward.shortTitle, {
    size: isFinal ? 16 : 14,
    fill: claimed || claimable ? COLORS.white : 0x777184,
    weight: '900',
    anchorX: 0.5,
  }, width - 14), width / 2, 139);
  const status = claimed
    ? '✓ 已领取'
    : claimable
      ? '● 可领取'
      : isNext
        ? '明日可领'
        : '待领取';
  addSymbol(card,claimed?'check':claimable?'up':'lock',width/2-10,height-31,20,claimed?'#8eeab5':claimable?'#ffdc71':'#888196');
  if (claimable) {
    card.addChild(
      new Graphics()
        .circle(width - 9, 9, 12)
        .fill({ color: COLORS.red, alpha: 0.2 })
        .circle(width - 9, 9, 6)
        .fill({ color: 0xff4f63 })
        .stroke({ color: 0xffffff, alpha: 0.92, width: 1.5 }),
    );
  }
  return card;
}

function makeDailyLoginModal(bridge, { onClose, onClaim }) {
  const snapshot = bridge.getDailyLoginSnapshot();
  const modal = new Container();
  modal.zIndex = 220;
  modal.eventMode = 'static';
  modal.hitArea = new Rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  modal.addChild(
    new Graphics()
      .rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT)
      .fill({ color: COLORS.pageDeep, alpha: 0.995 })
      .circle(470, 100, 260)
      .fill({ color: 0x7d5cff, alpha: 0.08 })
      .circle(90, 760, 250)
      .fill({ color: 0x55e7a8, alpha: 0.035 }),
  );
  // Keep the overlay full-screen, but move only the sign-in panel contents
  // below the notch on WeChat. The bottom close button stays in its safe
  // position and the lobby/combat layers are untouched.
  const content = new Container();
  content.position.y = bridge.platformKind === 'wechat'
    ? WECHAT_DAILY_LOGIN_TOP_INSET
    : 0;
  modal.addChild(content);
  const heroIcon = makeDailyLoginIcon(bridge, 104, 86);
  heroIcon.position.set(26, 38);
  content.addChild(heroIcon);
  place(content, makeRawText('七日签到', {
    size: 34,
    fill: COLORS.white,
    weight: '900',
    letterSpacing: 3,
  }), 146, 48);
  place(content, makeSingleLineRawText('累计7天 · SSR青岚', {
    size: 16,
    fill: COLORS.cyan,
    weight: '900',
  }, DESIGN_WIDTH - 170), 146, 93);
  content.addChild(
    new Graphics()
      .rect(28, 144, 544, 1)
      .fill({ color: COLORS.cyan, alpha: 0.24 }),
  );

  const progress = new Graphics();
  for (let index = 0; index < 7; index += 1) {
    const x = 78 + index * 74;
    const claimed = index < snapshot.claimedCount;
    if (index < 6) {
      progress
        .rect(x + 10, 183, 54, 2)
        .fill({ color: claimed && index + 1 < snapshot.claimedCount ? COLORS.green : 0x3e3852, alpha: 0.8 });
    }
    progress
      .circle(x, 184, 10)
      .fill({ color: claimed ? COLORS.green : 0x16122f })
      .stroke({ color: claimed ? 0xd8fff1 : 0x625b78, alpha: 0.85, width: 1.5 });
  }
  content.addChild(progress);

  snapshot.rewards.forEach((reward, index) => {
    const firstRow = index < 4;
    const width = firstRow ? 126 : 172;
    const x = firstRow ? 28 + index * 136 : 29 + (index - 4) * 181;
    const y = firstRow ? 220 : 448;
    content.addChild(makeDailyLoginRewardCard(bridge, reward, index, snapshot, {
      x,
      y,
      width,
      height: 208,
    }));
  });

  const actionText = snapshot.completed
    ? '已领完'
    : snapshot.canClaimToday
      ? '领取'
      : '明日再来';
  content.addChild(makeManualButton({
    x: 130,
    y: 704,
    width: 340,
    height: 70,
    text: actionText,
    subtext: '',
    disabled: !snapshot.canClaimToday,
    fill: 0xe7ff78,
    pressedFill: 0xffffff,
    stroke: 0xf4ffbc,
    textColor: COLORS.ink,
    subtextColor: 0x514c5d,
    fontSize: 18,
    subSize: 14,
    onPress: onClaim,
  }));
  place(content, makeSingleLineRawText('无需连续登录', {
    size: 14,
    fill: 0x8f899e,
    weight: '700',
    anchorX: 0.5,
  }, DESIGN_WIDTH - 48), DESIGN_WIDTH / 2, 806);
  place(content, makeRawText('赠送不计入招募保底', {
    size: 14,
    fill: 0x736d82,
    weight: '700',
    anchorX: 0.5,
  }), DESIGN_WIDTH / 2, 834);
  modal.addChild(makeBottomCloseButton(onClose, {
    fill: 0x14102f,
    pressedFill: 0x2a2054,
    stroke: COLORS.cyan,
    textColor: COLORS.white,
  }));
  return modal;
}

function makeDebugActionCard({
  x,
  y,
  width,
  height,
  tint,
  icon,
  title,
  detail,
  onPress,
}) {
  const button = new ButtonContainer();
  button.position.set(x, y);
  button.enabled = true;
  button.cursor = 'pointer';
  button.hitArea = new Rectangle(0, 0, width, height);
  button.addChild(
    new Graphics()
      .rect(0, 0, width, height)
      .fill({ color: 0x061727, alpha: 0.94 })
      .stroke({ color: tint, alpha: 0.48, width: 1.5 })
      .rect(0, 0, 3, height)
      .fill({ color: tint, alpha: 0.96 })
      .circle(44, height / 2, 35)
      .fill({ color: tint, alpha: 0.12 }),
  );
  place(button, makeRawText(icon, {
    size: 24,
    fill: tint,
    weight: '900',
    anchorX: 0.5,
    anchorY: 0.5,
  }), 44, height / 2);
  place(button, makeRawText(title, {
    size: 17,
    fill: COLORS.white,
    weight: '900',
    letterSpacing: 1,
  }), 82, 23);
  place(button, makeRawText(detail, {
    size: 14,
    fill: tint,
    weight: '800',
  }), 82, 55);
  button.__pixiUiAction = onPress;
  return button;
}

function makeDebugModal(bridge, {
  clearArmed = false,
  onClose,
  onToggle,
  onAdd,
  onGrantWeapons,
  onCompleteRun,
  onPreviewEvolution,
  onClear,
}) {
  const modal = new Container();
  modal.zIndex = 200;
  modal.eventMode = 'static';
  modal.hitArea = new Rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  const tint = bridge.debugUnlockAll ? 0xffca62 : 0x78f1e5;
  modal.addChild(
    new Graphics()
      .rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT)
      .fill({ color: 0x0a081f, alpha: 0.995 }),
  );

  addSymbol(modal,'grid',28,75,31,'#78f1e5');
  place(modal, makeRawText('调试', {
    size: 31,
    fill: 0xeffffc,
    weight: '900',
    letterSpacing: 4,
  }), 78, 70);
  modal.addChild(
    new Graphics()
      .rect(28, 129, 544, 1)
      .fill({ color: 0x78f1e5, alpha: 0.18 }),
  );
  modal.addChild(makeBottomCloseButton(onClose, {
    fill: 0x021218,
    pressedFill: 0x133039,
    stroke: 0x78f1e5,
    strokeAlpha: 0.22,
    textColor: 0xc7e8e3,
  }));
  place(modal, makeRawText('仅本机 · 全开模式不保存战斗进度', {
    size: 15,
    fill: 0x78908f,
    weight: '700',
    letterSpacing: 1,
    maxWidth: 544,
  }), 28, 152);

  const unlock = new ButtonContainer();
  unlock.position.set(28, 191);
  unlock.enabled = true;
  unlock.cursor = 'pointer';
  unlock.hitArea = new Rectangle(0, 0, 544, 107);
  unlock.addChild(
    new Graphics()
      .rect(0, 0, 544, 107)
      .fill({ color: bridge.debugUnlockAll ? 0x302b1a : 0x06242b, alpha: 0.96 })
      .stroke({ color: tint, alpha: bridge.debugUnlockAll ? 0.64 : 0.22, width: 1.5 })
      .rect(0, 0, 3, 107)
      .fill({ color: tint, alpha: 0.9 }),
  );
  place(unlock, makeRawText('开放所有关卡', {
    size: 18,
    fill: 0xeffffc,
    weight: '900',
    letterSpacing: 1,
  }), 22, 25);
  place(unlock, makeRawText('含全部难度、装备与技能', {
    size: 14,
    fill: 0x7b9693,
    weight: '700',
  }), 22, 63);
  unlock.addChild(
    new Graphics()
      .roundRect(472, 38, 54, 30, 15)
      .fill({ color: bridge.debugUnlockAll ? 0xffca62 : 0x000000, alpha: bridge.debugUnlockAll ? 0.25 : 0.32 })
      .stroke({ color: bridge.debugUnlockAll ? 0xffca62 : 0xffffff, alpha: bridge.debugUnlockAll ? 0.8 : 0.18, width: 1.5 })
      .circle(bridge.debugUnlockAll ? 511 : 487, 53, 10)
      .fill({ color: bridge.debugUnlockAll ? 0xffca62 : 0xffffff, alpha: bridge.debugUnlockAll ? 1 : 0.38 }),
  );
  unlock.__pixiUiAction = onToggle;
  modal.addChild(unlock);

  modal.addChild(makeDebugActionCard({
    x: 28,
    y: 313,
    width: 268,
    height: 91,
    tint: 0xffd451,
    icon: '●',
    title: '金币 +1000',
    detail: number(bridge.profileState.coins),
    onPress: () => onAdd('coins'),
  }));
  modal.addChild(makeDebugActionCard({
    x: 304,
    y: 313,
    width: 268,
    height: 91,
    tint: 0x76eaff,
    icon: '◆',
    title: '钻石 +1000',
    detail: number(bridge.profileState.diamonds),
    onPress: () => onAdd('diamonds'),
  }));

  modal.addChild(
    new Graphics()
      .rect(28, 420, 544, 100)
      .fill({ color: 0x021218, alpha: 0.72 })
      .stroke({ color: 0xffffff, alpha: 0.08, width: 1 }),
  );
  place(modal, makeRawText('本机存档', {
    size: 14,
    fill: 0x6a7c7d,
    weight: '800',
    letterSpacing: 3,
  }), 50, 441);
  ['grid','coin','up','plane','star'].forEach((icon,i)=>addSymbol(modal,icon,51+i*49,478,24,'#a6b5b4'));

  modal.addChild(makeManualButton({
    x: 28,
    y: 536,
    width: 544,
    height: 89,
    text: '结算预览',
    subtext: '不保存',
    fill: 0x3b3215,
    pressedFill: 0x68531e,
    stroke: 0xffca62,
    strokeAlpha: 0.72,
    textColor: 0xfff1bd,
    subtextColor: 0xc8a86c,
    fontSize: 19,
    subSize: 13,
    onPress: onCompleteRun,
  }));

  modal.addChild(makeManualButton({
    x: 28,
    y: 641,
    width: 544,
    height: 89,
    text: '进化预览',
    subtext: '深海奇点 · 不保存',
    fill: 0x101c4a,
    pressedFill: 0x244f9a,
    stroke: 0x4778ff,
    strokeAlpha: 0.72,
    textColor: 0xe8efff,
    subtextColor: 0x8eaeff,
    fontSize: 19,
    subSize: 13,
    onPress: onPreviewEvolution,
  }));

  modal.addChild(makeManualButton({
    x: 28,
    y: 746,
    width: 544,
    height: 89,
    text: clearArmed ? '再次点击确认清空' : '清空存档并重启',
    subtext: clearArmed ? '此操作无法撤销 · 完成后自动重启' : '恢复全新飞行员状态',
    fill: clearArmed ? 0xff765f : 0x53171c,
    pressedFill: 0xff9a83,
    stroke: 0xff5e4d,
    strokeAlpha: 0.48,
    textColor: clearArmed ? 0x071416 : 0xffd9d4,
    subtextColor: clearArmed ? 0x35211d : 0xd49b98,
    fontSize: 17,
    subSize: 13,
    onPress: onClear,
  }));
  modal.addChild(makeManualButton({
    x: 28,
    y: 852,
    width: 544,
    height: 89,
    text: '获得所有武器',
    subtext: '解锁新 20 把武器 · 保留现有养成',
    fill: 0x06333b,
    pressedFill: 0x16616b,
    stroke: 0x78f1e5,
    strokeAlpha: 0.7,
    textColor: 0xddfffa,
    subtextColor: 0x90bcb7,
    fontSize: 19,
    subSize: 13,
    onPress: onGrantWeapons,
  }));
  return modal;
}

function formatRunTime(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function formatWorldLeaderboardError(error) {
  const message = String(error?.message || error || '').trim();
  if (/502005|world_leaderboards.*(?:not exist|不存在)|collection.*(?:not exist|不存在)/i.test(message)) {
    return '排行榜暂不可用，请稍后重试';
  }
  if (!message) return '排行榜暂不可用，请稍后重试';
  return '排行榜加载失败，请稍后重试';
}

function makeLeaderboardModal(bridge, onClose, scrollY = 0, {
  worldMode = false,
  worldBoard = 'HYFSB',
  worldRows = [],
  worldLoading = false,
  worldError = '',
  onSelectWorldBoard = null,
  onOpenFriendLeaderboard = null,
  onRefreshWorldLeaderboard = null,
} = {}) {
  const modal = new Container();
  modal.zIndex = 200;
  modal.eventMode = 'static';
  modal.hitArea = new Rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  modal.addChild(
    new Graphics()
      .rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT)
      .fill({ color: 0x020e13, alpha: 0.995 })
      .circle(300, 205, 260)
      .fill({ color: 0x278b8f, alpha: 0.09 }),
  );
  place(modal, makeRawText(worldMode ? '世界榜' : '本机榜', {
    size: 31,
    fill: COLORS.white,
    weight: '900',
    letterSpacing: 2,
  }), 82, 76);
  modal.addChild(
    new Graphics()
      .rect(82, 127, 476, 1)
      .fill({ color: 0xffffff, alpha: 0.11 }),
  );
  modal.addChild(makeBottomCloseButton(onClose, {
    fill: 0x0a1921,
    stroke: 0xffffff,
    strokeAlpha: 0.2,
    textColor: COLORS.white,
  }));

  if (worldMode) {
    const boardButton = (x, text, selected, onPress) => makeManualButton({
      x,
      y: 148,
      width: 160,
      height: 38,
      text,
      fill: selected ? 0x2a2458 : 0x0a1921,
      pressedFill: 0x3e3474,
      stroke: selected ? COLORS.cyanBright : 0xffffff,
      strokeAlpha: selected ? 0.85 : 0.18,
      textColor: selected ? COLORS.white : 0x9b96a8,
      fontSize: 14,
      onPress,
    });
    modal.addChild(
      boardButton(42, '世界分数榜', worldBoard === 'HYFSB', () => onSelectWorldBoard?.('HYFSB')),
      boardButton(216, '世界关卡榜', worldBoard === 'HYGQB', () => onSelectWorldBoard?.('HYGQB')),
      makeManualButton({
        x: 390,
        y: 148,
        width: 126,
        height: 38,
        text: '好友榜',
        fill: 0x0a1921,
        pressedFill: 0x241b58,
        stroke: 0xffffff,
        strokeAlpha: 0.18,
        textColor: 0x9b96a8,
        fontSize: 14,
        onPress: onOpenFriendLeaderboard,
      }),
    );
  }

  const entries = worldMode ? worldRows : bridge.getLeaderboardEntries?.() || [];
  const listTop = worldMode ? 204 : 184;
  if (!worldMode) {
    place(modal, makeSingleLineRawText(
      entries.length ? `${entries.length}` : '',
      {
        size: 15,
        fill: 0x6d7179,
        weight: '700',
        letterSpacing: 1,
      },
    476), 82, 148);
  }
  const items = entries.map((entry, index) => {
    const tint = index === 0 ? 0xffe177 : index === 1 ? 0xbfe8ef : index === 2 ? 0xd89168 : 0x78f1e5;
    const row = new Container();
    row.addChild(
      new Graphics()
        .rect(0, 0, 516, 80)
        .fill({ color: index === 0 ? 0x211d20 : 0xffffff, alpha: index === 0 ? 0.5 : 0.035 })
        .rect(0, 0, 4, 80)
        .fill({ color: tint, alpha: 0.8 }),
    );
    place(row, makeRawText(String(index + 1).padStart(2, '0'), {
      size: 16,
      fill: 0x73747e,
      weight: '900',
    }), 15, 29);
    place(row, makeRawText(entry.name || '飞行员', {
      size: 17,
      fill: COLORS.white,
      weight: '900',
    }), 66, 14);
    if (worldMode) {
      const chapter = Math.max(0, Number(entry.chapter) || 0);
      place(row, makeRawText(worldBoard === 'HYGQB'
        ? `第${String(chapter).padStart(2, '0')}章`
        : number(entry.score), {
        size: 14,
        fill: 0x777b85,
        weight: '700',
      }), 66, 46);
      place(row, makeRawText(`#${Number(entry.rank) || index + 1}`, {
        size: 15,
        fill: COLORS.green,
        weight: '900',
        align: 'right',
        anchorX: 1,
      }), 500, 28);
      return row;
    }
    const stageIndex = Number(entry.stageIndex) || 0;
    const difficultyLabel = DIFFICULTY_MAP.get(entry.difficulty)?.label || '简单';
    const stars = Math.max(0, Math.min(3, Number(entry.stars) || 0));
    place(row, makeRawText(entry.victory
      ? `${String(stageIndex+1).padStart(2,'0')} · ${difficultyLabel} · ${stars}星`
      : `${String(stageIndex+1).padStart(2,'0')} · ${difficultyLabel}`, {
      size: 14,
      fill: 0x777b85,
      weight: '700',
    }), 66, 46);
    place(row, makeRawText(`${String(Math.floor(Number(entry.score) || 0)).padStart(6, '0')}\n${formatRunTime(entry.time)}`, {
      size: 15,
      fill: COLORS.green,
      weight: '900',
      align: 'right',
      lineHeight: 23,
      anchorX: 1,
    }), 500, 16);
    return row;
  });
  if (worldLoading) {
    place(modal, makeRawText('云端排行榜加载中', {
      size: 18,
      fill: 0x8fa6aa,
      weight: '700',
      anchorX: 0.5,
    }), DESIGN_WIDTH / 2, 480);
  } else if (items.length) {
    const list = makeReliableScrollView({
      width: 516,
      height: 1000,
      items,
      gap: 8,
      contentHeight: items.length * 80 + Math.max(0, items.length - 1) * 8,
      scrollKey: 'leaderboard',
      scrollY,
    });
    list.position.set(42, listTop);
    modal.addChild(list);
  } else {
    addSymbol(modal,worldError?'refresh':'plane',260,316,80,'#506b7b');
    place(modal, makeSingleLineRawText(worldError?'暂不可用，稍后重试':'暂无战绩', {
      size: 17,
      fill: 0x747985,
      weight: '700',
      anchorX: 0.5,
    }, 500), DESIGN_WIDTH / 2, worldMode ? 480 : 430);
  }
  if (worldMode) {
    modal.addChild(makeManualButton({
      x: 42,
      y: 1139,
      width: 516,
      height: 52,
      text: '刷新世界榜',
      fill: 0x0a1921,
      pressedFill: 0x133039,
      stroke: COLORS.cyan,
      strokeAlpha: 0.38,
      textColor: 0xc7e8e3,
      fontSize: 15,
      onPress: onRefreshWorldLeaderboard,
    }));
  }
  if (!worldMode) {
    place(modal, makeSingleLineRawText('通关 ＞ 时间 ＞ 得分', {
      size: 13,
      fill: 0x565963,
      weight: '700',
      letterSpacing: 2,
      anchorX: 0.5,
    }, 260), DESIGN_WIDTH / 2, 1182);
  }
  return modal;
}

function makePilotArtModal(bridge, pilot, onClose) {
  const modal = new Container();
  modal.zIndex = 220;
  modal.eventMode = 'static';
  modal.hitArea = new Rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  const tint = color(pilot.color, COLORS.cyan);
  const pilotState = bridge.getPilotState();
  const owned = pilotState.owned.includes(pilot.id);
  const selected = pilotState.selected === pilot.id;
  const resonance = pilotState.resonance[pilot.id] || 0;
  modal.addChild(
    new Graphics()
      .rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT)
      .fill({ color: 0x03030f, alpha: 0.995 })
      .circle(300, 500, 320)
      .fill({ color: tint, alpha: 0.12 }),
  );
  const frameX = 38;
  const frameY = 80;
  const frameWidth = 524;
  const frameHeight = 1090;
  modal.addChild(
    new Graphics()
      .rect(frameX, frameY, frameWidth, frameHeight)
      .fill({ color: 0x07051a, alpha: 0.95 })
      .stroke({ color: tint, alpha: 0.86, width: 2 }),
  );
  const texture = preparePilotTexture(bridge.resolvePilotTexture?.(pilot.id) || Texture.EMPTY);
  if (texture !== Texture.EMPTY) {
    const art = preparePilotSprite(new Sprite(texture));
    const tw = Math.max(1, texture.orig?.width || texture.width || 1);
    const th = Math.max(1, texture.orig?.height || texture.height || 1);
    const artScale = Math.min(frameWidth / tw, frameHeight / th);
    art.scale.set(artScale);
    art.position.set(
      frameX + (frameWidth - tw * artScale) / 2,
      frameY + (frameHeight - th * artScale) / 2,
    );
    const mask = new Graphics()
      .rect(frameX, frameY, frameWidth, frameHeight)
      .fill({ color: 0xffffff });
    modal.addChild(art, mask);
    art.mask = mask;
  }
  modal.addChild(
    new Graphics()
      .poly([
        frameX, 760,
        frameX + frameWidth, 650,
        frameX + frameWidth, frameY + frameHeight,
        frameX, frameY + frameHeight,
      ])
      .fill({ color: 0x050414, alpha: 0.93 }),
  );
  place(modal, makeRawText(`${pilot.rarity} 飞行员 · ${pilot.aircraft}`, {
    size: 16,
    fill: tint,
    weight: '900',
    letterSpacing: 3,
  }), 66, 825);
  place(modal, makeRawText(pilot.name, {
    size: 43,
    fill: COLORS.white,
    weight: '900',
    letterSpacing: 4,
  }), 66, 865);
  place(modal, makeRawText(`${pilot.aircraft} · 机甲少女档案`, {
    size: 18,
    fill: 0xaaa6b7,
    weight: '700',
  }), 66, 925);
  modal.addChild(
    new Graphics()
      .rect(66, 974, 468, 132)
      .fill({ color: 0x0e0b2c, alpha: 0.92 })
      .stroke({ color: tint, alpha: 0.45, width: 2 }),
  );
  place(modal, makeRawText(pilot.icon || '◒', {
    size: 42,
    fill: tint,
    weight: '900',
    anchorX: 0.5,
    anchorY: 0.5,
  }), 112, 1040);
  place(modal, makeRawText('专属技能', {
    size: 14,
    fill: 0x938da5,
    weight: '800',
  }), 158, 992);
  place(modal, makeRawText(pilot.skillName, {
    size: 22,
    fill: COLORS.white,
    weight: '900',
  }), 158, 1019);
  place(modal, makeRawText(pilot.description, {
    size: 15,
    fill: 0xaaa6b7,
    weight: '700',
    lineHeight: 22,
    maxWidth: 350,
  }), 158, 1052);
  place(modal, makeRawText(
    selected
      ? `● 当前出战 · 共鸣 ${resonance}`
      : owned
        ? `● 已获得 · 共鸣 ${resonance}`
        : '○ 尚未获得 · 可在永久补给中招募',
    {
      size: 14,
      fill: selected ? COLORS.amber : owned ? COLORS.green : 0x918a9f,
      weight: '900',
      letterSpacing: 0.8,
    },
  ), 66, 1126);
  modal.addChild(makeBottomCloseButton(onClose, {
    fill: 0x09071d,
    stroke: 0xffffff,
    strokeAlpha: 0.32,
    textColor: COLORS.white,
  }));
  return modal;
}

function makePilotPortrait(bridge, pilot, {
  width,
  height,
  alpha = 1,
} = {}) {
  const texture = preparePilotTexture(bridge.resolvePilotTexture?.(pilot.id) || Texture.EMPTY);
  const portrait = preparePilotSprite(new Sprite(texture));
  portrait.alpha = alpha;
  portrait.layout = {
    width,
    height,
    isLeaf: true,
    objectFit: 'cover',
    objectPosition: 'center top',
    flexShrink: 0,
  };
  return portrait;
}

function makePortraitWindow(bridge, pilot, width, height, {
  zoom = 1,
  focusX = 0.5,
  focusY = 0.18,
  targetY = 0.5,
  alpha = 1,
  avatar = false,
  backgroundAlpha = 1,
} = {}) {
  const root = new Container();
  const background = new Graphics()
    .rect(0, 0, width, height)
    .fill({ color: COLORS.art, alpha: backgroundAlpha });
  root.addChild(background);
  const avatarTexture = avatar && bridge.resolvePilotAvatarTexture?.(pilot.id);
  const usesAvatar = avatarTexture && avatarTexture !== Texture.EMPTY;
  const texture = preparePilotTexture(usesAvatar ? avatarTexture : bridge.resolvePilotTexture?.(pilot.id) || Texture.EMPTY);
  if (texture !== Texture.EMPTY) {
    const sprite = preparePilotSprite(new Sprite(texture));
    const textureWidth = Math.max(1, texture.orig?.width || texture.width || 1);
    const textureHeight = Math.max(1, texture.orig?.height || texture.height || 1);
    const spriteScale = Math.max(width / textureWidth, height / textureHeight) * (usesAvatar ? 1 : zoom);
    sprite.scale.set(spriteScale);
    sprite.position.set(
      width * 0.5 - textureWidth * spriteScale * (usesAvatar ? .5 : focusX),
      height * (usesAvatar ? .5 : targetY) - textureHeight * spriteScale * (usesAvatar ? .5 : focusY),
    );
    sprite.alpha = alpha;
    // All pilot art remains in its original color. The status label below the
    // card carries ownership state, so locked portraits are never gray-tinted.
    if (!usesAvatar) sprite.filters = [createPilotLightFilter()];
    const clip = new Graphics()
      .rect(0, 0, width, height)
      .fill({ color: 0xffffff });
    root.addChild(sprite, clip);
    sprite.mask = clip;
  }
  return root;
}

function makeAirframeBlueprint(width, height, tint) {
  const root = new Container();
  const cx = width / 2;
  const cy = height * 0.47;
  const line = new Graphics()
    .circle(cx, cy, Math.min(width, height) * 0.34)
    .stroke({ color: tint, alpha: 0.22, width: 1 })
    .circle(cx, cy, Math.min(width, height) * 0.23)
    .stroke({ color: 0x7deaff, alpha: 0.22, width: 1 })
    .poly([
      cx, cy - 68,
      cx + 22, cy - 22,
      cx + 58, cy + 42,
      cx + 18, cy + 20,
      cx, cy + 71,
      cx - 18, cy + 20,
      cx - 58, cy + 42,
      cx - 22, cy - 22,
    ])
    .fill({ color: tint, alpha: 0.17 })
    .stroke({ color: tint, alpha: 0.82, width: 2 })
    .poly([
      cx, cy - 54,
      cx + 12, cy - 10,
      cx, cy + 50,
      cx - 12, cy - 10,
    ])
    .stroke({ color: 0xded8ff, alpha: 0.78, width: 2 })
    .circle(cx - 42, cy + 12, 8)
    .stroke({ color: 0x71f6cb, alpha: 0.72, width: 2 })
    .circle(cx + 42, cy + 12, 8)
    .stroke({ color: 0x71f6cb, alpha: 0.72, width: 2 });
  root.addChild(line);
  place(root, makeRawText('相位差', {
    size: 16,
    fill: 0xd6cdf9,
    weight: '900',
    letterSpacing: 2,
    anchorX: 0.5,
  }), cx, height - 22);
  return root;
}

function makePilotRosterCard(bridge, pilot, {
  x,
  y,
  width,
  height,
  owned,
  selected,
  onPress,
}) {
  const button = new ButtonContainer();
  button.position.set(x, y);
  button.enabled = owned;
  button.cursor = owned ? 'pointer' : 'default';
  button.hitArea = new Rectangle(0, 0, width, height);
  const tint = color(pilot.color, COLORS.cyan);
  const resonance = bridge.getPilotState?.().resonance?.[pilot.id] || 0;
  const portraitFocusX = (pilot.portraitFocus?.x ?? 50) / 100;
  const portraitFocusY = (pilot.portraitFocus?.y ?? 13) / 100;
  const background = new Graphics()
    .roundRect(0, 0, width, height, 6)
    .fill({ color: COLORS.cardDeep })
    .stroke({
      color: selected ? 0xffffff : tint,
      alpha: selected ? 1 : owned ? 0.54 : 0.2,
      width: selected ? 2.5 : 1.5,
    });
  button.addChild(background);
  const portrait = makePortraitWindow(bridge, pilot, width - 4, height - 4, {
    avatar: true,
    zoom: (pilot.portraitFocus?.zoom || 4.2) * 0.84,
    focusX: portraitFocusX,
    focusY: portraitFocusY,
    // CSS 版以同一个百分比作为 transform-origin。让焦点留在
    // 原位置，才能保留原卡片里“头肩特写”的构图。
    targetY: portraitFocusY,
    // Ownership is shown by the status tag; keep every portrait fully visible.
    alpha: 1,
  });
  portrait.position.set(2, 2);
  button.addChild(portrait);
  if (owned) {
    button.addChild(
      new Graphics()
        .roundRect(width - 49, 27, 45, 17, 3)
        .fill({ color: COLORS.cardDeep, alpha: 0.86 })
        .stroke({ color: color(pilot.accent, tint), alpha: 0.68, width: 1 }),
    );
    place(button, makeRawText(`R${resonance}`, {
      size: 8,
      fill: 0xfff1a6,
      weight: '900',
      anchorX: 0.5,
      anchorY: 0.5,
    }), width - 26.5, 35.5);
  }
  place(button, makeRawText(pilot.rarity, {
    size: 13,
    fill: 0x090721,
    weight: '900',
  }), 7, 7);
  const rarityWidth = Math.max(28, button.children.at(-1).width + 9);
  button.addChildAt(
    new Graphics()
      .roundRect(4, 4, rarityWidth, 20, 2)
      .fill({ color: color(pilot.accent, tint), alpha: 0.95 }),
    button.children.length - 1,
  );
  const statusLabel = selected ? '出战中' : owned ? '已获得' : '未获得';
  const statusFill = selected ? COLORS.amber : owned ? COLORS.green : 0xb8bfd2;
  const statusText = makeRawText(statusLabel, {
    size: 14,
    fill: COLORS.ink,
    weight: '900',
    anchorX: 0.5,
    anchorY: 0.5,
  });
  const statusWidth = Math.min(width - 14, Math.max(50, statusText.width + 16));
  button.addChild(
    new Graphics()
      .roundRect(7, height - 30, statusWidth, 22, 4)
      .fill({ color: statusFill, alpha: 0.94 })
      .stroke({ color: statusFill, alpha: 1, width: 1 }),
  );
  place(button, statusText, 7 + statusWidth / 2, height - 19);
  if (selected) {
    button.addChild(
      new Graphics()
        .circle(width - 15, 15, 11)
        .fill({ color: 0xffffff }),
    );
    place(button, makeRawText('✓', {
      size: 15,
      fill: 0x101022,
      weight: '900',
      anchorX: 0.5,
      anchorY: 0.5,
    }), width - 15, 15);
  }
  button.__pixiUiAction = owned ? onPress : null;
  return button;
}

function makeWeaponHangar(bridge, width, height, snapshot, active) {
  const root = new Container();
  const background = new Graphics()
    .rect(0, 0, width, height)
    .fill({ color: 0x06131d, alpha: 0.98 })
    .stroke({ color: color(active.color), alpha: 0.38, width: 2 });
  for (let x = 0; x <= width; x += 42) {
    background
      .moveTo(x, 0)
      .lineTo(x, height)
      .stroke({ color: 0x78f1e5, alpha: 0.035, width: 1 });
  }
  for (let y = 0; y <= height; y += 42) {
    background
      .moveTo(0, y)
      .lineTo(width, y)
      .stroke({ color: 0x78f1e5, alpha: 0.035, width: 1 });
  }
  root.addChild(background);
  place(root, makeRawText('武器挂载舱', {
    size: 20,
    fill: COLORS.white,
    weight: '900',
  }), 14, 14);
  place(root, makeRawText(`装配 ${number(snapshot.summary.power)}`, {
    size: 16,
    fill: COLORS.amber,
    weight: '900',
    anchorX: 1,
  }), width - 14, 17);

  const shipLayer = new Container();
  const aircraft = bridge.createAssemblyAircraftVisual?.();
  if (aircraft?.root) {
    aircraft.root.position.set(width / 2, 235);
    aircraft.root.scale.set(0.76);
    shipLayer.addChild(aircraft.root);
    let orbitTime = 0;
    const updateHangarAnimation = (deltaMs = 16.67) => {
      orbitTime += Math.min(0.05, Math.max(0, Number(deltaMs || 16.67) / 1000));
      bridge.updateAssemblyAircraftVisual?.(aircraft, orbitTime);
    };
    updateHangarAnimation(0);
    let animationFrame = 0;
    let lastAnimationTime = 0;
    const animateHangar = (timestamp) => {
      if (root.destroyed) return;
      if (!lastAnimationTime) lastAnimationTime = timestamp;
      const elapsed = timestamp - lastAnimationTime;
      if (elapsed >= 30) {
        updateHangarAnimation(elapsed);
        lastAnimationTime = timestamp;
        bridge.app.renderer.render({ container: bridge.app.stage });
      }
      animationFrame = globalThis.requestAnimationFrame(animateHangar);
    };
    animationFrame = globalThis.requestAnimationFrame(animateHangar);
    root.__pixiUiDestroy = () => {
      if (animationFrame) globalThis.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };
  } else {
    const fallback = makeAirframeBlueprint(260, 320, color(active.color));
    fallback.position.set((width - 260) / 2, 70);
    shipLayer.addChild(fallback);
  }
  root.addChild(shipLayer);

  const weapons = snapshot.slots.filter((slot) => slot.role === 'weapon').slice(0, 3);
  const statsY = 398;
  const slotY = 470;
  const cardWidth = 158;
  weapons.forEach((slot, index) => {
    const x = 10 + index * (cardWidth + 12);
    root.addChild(makeWeaponMountSlotCard({
      slot,
      index,
      x,
      y: slotY,
      width: cardWidth,
      height: 112,
    }));
  });
  const passive = weapons.filter((slot) => slot.module).length;
  const totalLevel = weapons.reduce((sum, slot) => sum + (slot.module?.level || 0), 0);
  const damage = Math.round((snapshot.summary.bonuses.damageMultiplier - 1) * 100);
  const stats = [
    ['被动挂载', `${passive}/3`, COLORS.red],
    ['养成总级', `等级${totalLevel}`, 0x7deaff],
    ['综合增伤', `+${damage}%`, COLORS.amber],
  ];
  stats.forEach(([label, value, tint], index) => {
    const x = index * (width / 3);
    place(root, makeRawText(label, {
      size: 16,
      fill: 0x817f8e,
      weight: '800',
      anchorX: 0.5,
    }), x + width / 6, statsY);
    place(root, makeRawText(value, {
      size: 18,
      fill: tint,
      weight: '900',
      anchorX: 0.5,
    }), x + width / 6, statsY + 25);
  });
  return root;
}

function makeWeaponMountSlotCard({ slot, index, x, y, width, height }) {
  const moduleTint = color(slot.module?.color, 0x596476);
  const mounted = Boolean(slot.module);
  const card = new Container();
  card.position.set(x, y);
  card.addChild(
    new Graphics()
      .rect(0, 0, width, height)
      .fill({ color: 0x081923, alpha: 0.98 })
      .stroke({ color: moduleTint, alpha: mounted ? 0.68 : 0.24, width: 1.5 }),
  );
  place(card, makeRawText(`挂点 ${String(index + 1).padStart(2, '0')}`, {
    size: 11,
    fill: mounted ? moduleTint : 0x596476,
    weight: '900',
    letterSpacing: 1,
  }), 12, 12);
  place(card, makeSingleLineRawText(slot.module?.shortName || '空槽位', {
    size: 15,
    minSize: 10,
    fill: mounted ? COLORS.white : 0x727787,
    weight: '900',
    anchorX: 0.5,
  }, width - 24), width / 2, 41);
  place(card, makeSingleLineRawText(
    mounted ? `等级${slot.module.level}` : '空',
    {
      size: 11,
      minSize: 9,
      fill: mounted ? moduleTint : 0x555b67,
      weight: '800',
      anchorX: 0.5,
    },
    width - 16,
  ), width / 2, 78);
  return card;
}

const FIXED_SLOT_META = Object.freeze({
  wing: { name: '机翼', orbit: '外层刃环', color: 0x78f1e5, mark: 'W' },
  engine: { name: '推进', orbit: '中层核环', color: 0x5ec8ff, mark: 'E' },
  tail: { name: '机尾', orbit: '内层稳环', color: 0x8dffca, mark: 'T' },
});

function fixedModuleStats(module) {
  const stats = module?.stats || {};
  const values = [
    ['伤害', stats.damageMultiplier, false],
    ['移速', stats.moveSpeedMultiplier, false],
    ['射速', stats.fireRateMultiplier, false],
    ['承伤', stats.damageTakenMultiplier, true],
    ['敌弹', stats.enemyBulletSpeedMultiplier, true],
    ['挂载间隔', stats.activeCooldownMultiplier, true],
    ['Boss伤害', stats.bossDamageMultiplier, false],
    ['经验', stats.xpMultiplier, false],
    ['维修', stats.healingMultiplier, false],
  ].filter(([, value]) => Number.isFinite(value) && value !== 1);
  if (Number.isFinite(stats.critChance) && stats.critChance) {
    values.push(['暴击', 1 + stats.critChance, false]);
  }
  if (Number.isFinite(stats.maxHp) && stats.maxHp) {
    values.push(['耐久', stats.maxHp, 'flat']);
  }
  return values.slice(0, 3).map(([label, value, inverse]) => {
    if (inverse === 'flat') return `${label} +${Math.round(value)}`;
    const delta = Math.round(Math.abs(value - 1) * 100);
    const positive = inverse ? value < 1 : value > 1;
    return `${label} ${positive ? '+' : '-'}${delta}%`;
  }).join(' · ');
}

function makeAssemblySlotButton({
  slot,
  selected,
  x,
  y,
  width,
  height,
  onPress,
}) {
  const meta = FIXED_SLOT_META[slot.id];
  const tint = color(slot.module?.color, meta.color);
  const button = makeManualButton({
    x,
    y,
    width,
    height,
    text: slot.module?.shortName || `未装 ${meta.name}`,
    subtext: `${meta.orbit} · ${slot.module?.passive?.name || '空槽位'}`,
    fill: selected ? 0x122c35 : 0x071921,
    pressedFill: 0x173d47,
    stroke: selected ? meta.color : tint,
    strokeAlpha: selected ? 0.95 : 0.48,
    textColor: COLORS.white,
    subtextColor: selected ? meta.color : 0x718a90,
    fontSize: 17,
    subSize: 12,
    radius: 5,
    onPress,
  });
  place(button, makeRawText(slot.module?.icon || meta.mark, {
    size: 23,
    fill: tint,
    weight: '900',
    anchorX: 0.5,
    anchorY: 0.5,
  }), 24, 23);
  const dropHighlight = new Graphics()
    .roundRect(-4, -4, width + 8, height + 8, 8)
    .fill({ color: meta.color, alpha: 0.1 })
    .stroke({ color: meta.color, alpha: 0.98, width: 3 });
  dropHighlight.visible = false;
  dropHighlight.eventMode = 'none';
  button.addChild(dropHighlight);
  button.__pixiUiAssemblySlotId = slot.id;
  button.__pixiUiAssemblyDropHighlight = dropHighlight;
  if (slot.module) {
    button.__pixiUiAssemblyDrag = {
      moduleId: slot.module.id,
      fromSlot: slot.id,
      compatibleSlot: slot.id,
      color: tint,
      icon: slot.module.icon || meta.mark,
      name: slot.module.name,
    };
  }
  return button;
}

function makeFixedModuleCard({
  module,
  installed,
  x,
  y,
  width,
  height,
  onPress,
}) {
  const tint = color(module.color, COLORS.cyan);
  const card = makeManualButton({
    x,
    y,
    width,
    height,
    fill: installed ? 0x102a31 : 0x091821,
    pressedFill: 0x16333d,
    stroke: tint,
    strokeAlpha: installed ? 0.92 : 0.42,
    radius: 5,
    onPress,
  });
  card.addChild(
    new Graphics()
      .rect(0, 0, 4, height)
      .fill({ color: tint, alpha: installed ? 0.98 : 0.7 }),
  );
  place(card, makeRawText(module.icon || '◇', {
    size: 31,
    fill: tint,
    weight: '900',
    anchorX: 0.5,
    anchorY: 0.5,
  }), 29, 35);
  place(card, makeRawText(module.name, {
    size: 17,
    fill: installed ? 0xeafffb : COLORS.white,
    weight: '900',
    maxWidth: width - 82,
  }), 56, 12);
  place(card, makeRawText(module.passive?.name || '通用固定件', {
    size: 13,
    fill: tint,
    weight: '800',
    maxWidth: width - 70,
  }), 56, 42);
  place(card, makeRawText(fixedModuleStats(module) || '标准机体强化', {
    size: 12,
    fill: 0x858191,
    weight: '700',
    maxWidth: width - 24,
  }), 12, 75);
  if (installed) {
    place(card, makeRawText('已装配', {
      size: 12,
      fill: COLORS.ink,
      weight: '900',
      anchorX: 0.5,
      anchorY: 0.5,
    }), width - 36, 19);
    card.addChildAt(
      new Graphics()
        .roundRect(width - 67, 7, 61, 25, 3)
        .fill({ color: tint }),
      card.children.length - 1,
    );
  }
  card.__pixiUiAssemblyDrag = {
    moduleId: module.id,
    fromSlot: installed ? module.fixedSlot : null,
    compatibleSlot: module.fixedSlot,
    color: tint,
    icon: module.icon || '◇',
    name: module.name,
  };
  return card;
}

function weaponModuleStats(module) {
  const stats = module?.stats || {};
  const values = [
    ['伤害', stats.damageMultiplier, false],
    ['射速', stats.fireRateMultiplier, false],
    ['Boss', stats.bossDamageMultiplier, false],
    ['弹速', stats.projectileSpeedMultiplier, false],
    ['移速', stats.moveSpeedMultiplier, false],
  ].filter(([, value]) => Number.isFinite(value) && value !== 1);
  if (Number.isFinite(stats.critChance) && stats.critChance) values.push(['暴击', 1 + stats.critChance, false]);
  const labels = values.slice(0, 2).map(([label, value, inverse]) => {
    const delta = Math.round(Math.abs(value - 1) * 100);
    const positive = inverse ? value < 1 : value > 1;
    return `${label} ${positive ? '+' : '-'}${delta}%`;
  });
  if (Number.isFinite(stats.enemyBulletSpeedMultiplier) && stats.enemyBulletSpeedMultiplier !== 1) {
    labels.push(`敌弹 ${stats.enemyBulletSpeedMultiplier < 1 ? '-' : '+'}${Math.round(Math.abs(stats.enemyBulletSpeedMultiplier - 1) * 100)}%`);
  }
  if (Number.isFinite(stats.damageTakenMultiplier) && stats.damageTakenMultiplier !== 1) {
    labels.push(`减伤 ${stats.damageTakenMultiplier < 1 ? '+' : '-'}${Math.round(Math.abs(stats.damageTakenMultiplier - 1) * 100)}%`);
  }
  if (Number.isFinite(stats.activeDamageMultiplier) && stats.activeDamageMultiplier !== 1) {
    labels.push(`技能 ${stats.activeDamageMultiplier > 1 ? '+' : '-'}${Math.round(Math.abs(stats.activeDamageMultiplier - 1) * 100)}%`);
  }
  return labels.slice(0, 2).join(' · ');
}

function weaponModuleSubhead(module) {
  return '自动触发';
}

function makeWeaponModuleCard({
  module,
  installedSlotId,
  selected,
  x,
  y,
  width,
  height,
  onPress,
}) {
  const tint = color(module.color, COLORS.cyan);
  const installed = Boolean(installedSlotId);
  const card = makeManualButton({
    x,
    y,
    width,
    height,
    fill: selected ? 0x142837 : installed ? 0x101d27 : 0x091821,
    pressedFill: 0x193443,
    stroke: selected ? COLORS.amber : tint,
    strokeAlpha: selected ? 0.95 : installed ? 0.72 : 0.42,
    radius: 5,
    onPress,
  });
  card.addChild(
    new Graphics()
      .rect(0, 0, 4, height)
      .fill({ color: selected ? COLORS.amber : tint, alpha: installed ? 0.98 : 0.7 }),
  );
  place(card, makeRawText(module.icon || '◇', {
    size: 31,
    fill: tint,
    weight: '900',
    anchorX: 0.5,
    anchorY: 0.5,
  }), 29, 35);
  place(card, makeSingleLineRawText(module.name, {
    size: 15,
    fill: selected || installed ? 0xeafffb : COLORS.white,
    weight: '900',
    minSize: 11,
  }, width - 82), 56, 16);
  place(card, makeSingleLineRawText(weaponModuleSubhead(module), {
    size: 11,
    fill: selected ? COLORS.amber : tint,
    weight: '800',
    minSize: 10,
  }, installed ? width - 150 : width - 70), 56, 47);
  place(card, makeSingleLineRawText(
    weaponModuleStats(module) || '自动触发',
    {
      size: 10,
      minSize: 8,
      fill: 0x858191,
      weight: '700',
    },
    width - 24,
  ), 12, 81);
  if (installed) {
    place(card, makeRawText(`挂点${installedSlotId.replace('hp', '')}`, {
      size: 12,
      fill: COLORS.ink,
      weight: '900',
      anchorX: 0.5,
      anchorY: 0.5,
    }), width - 44, 49);
    card.addChildAt(
      new Graphics()
        .roundRect(width - 82, 37, 76, 24, 3)
        .fill({ color: selected ? COLORS.amber : tint }),
      card.children.length - 1,
    );
  }
  return card;
}

function makeAssemblyPagePrototype(bridge, rerender, {
  focusSlot = 'wing',
  scrollY = 0,
  onFocusSlot,
} = {}) {
  const snapshot = bridge.getAssemblySnapshot();
  const fixedSlots = snapshot.slots.filter((slot) => FIXED_SLOT_META[slot.id]);
  const activeSlot = FIXED_SLOT_META[focusSlot] ? focusSlot : 'wing';
  const activeMeta = FIXED_SLOT_META[activeSlot];
  const availableModules = snapshot.ownedModules
    .map((moduleId) => bridge.getAssemblyModuleInfo?.(moduleId))
    .filter((module) => module?.family === 'fixed' && module.fixedSlot === activeSlot)
    .sort((a, b) => (
      Number(snapshot.mounts[activeSlot] === b.id)
      - Number(snapshot.mounts[activeSlot] === a.id)
    ));
  const width = 556;
  const viewportHeight = 980;
  const moduleCardWidth = 257;
  const moduleCardHeight = 116;
  const moduleGap = 10;
  const moduleRows = Math.max(1, Math.ceil(availableModules.length / 2));
  const bayHeight = 668;
  const inventoryHeight = 142 + moduleRows * (moduleCardHeight + moduleGap) + 42;
  const contentHeight = bayHeight + 18 + inventoryHeight;

  const page = new Container();
  page.layout = {
    width: '100%',
    height: '100%',
    isLeaf: true,
  };
  place(page, makeSingleLineRawText('固定件装配', {
    size: 26,
    minSize: 20,
    fill: COLORS.white,
    weight: '900',
    letterSpacing: 2,
  }, width - 155), 0, 16);
  const pagePowerText = place(page, makeRawText(`装配战力 +${number(snapshot.summary.power)}`, {
    size: 15,
    fill: COLORS.amber,
    weight: '900',
    anchorX: 1,
  }), width, 25);
  page.addChild(
    new Graphics()
      .rect(0, 50, width, 1)
      .fill({ color: COLORS.cyan, alpha: 0.22 }),
  );

  const bay = new Container();
  const bayBackground = new Graphics()
    .rect(0, 0, width, bayHeight)
    .fill({ color: 0x06141d, alpha: 0.99 })
    .stroke({ color: COLORS.cyan, alpha: 0.42, width: 2 });
  for (let gridX = 0; gridX <= width; gridX += 38) {
    bayBackground
      .moveTo(gridX, 0)
      .lineTo(gridX, bayHeight)
      .stroke({ color: 0x78f1e5, alpha: 0.035, width: 1 });
  }
  for (let gridY = 0; gridY <= bayHeight; gridY += 38) {
    bayBackground
      .moveTo(0, gridY)
      .lineTo(width, gridY)
      .stroke({ color: 0x78f1e5, alpha: 0.035, width: 1 });
  }
  bay.addChild(bayBackground);
  place(bay, makeRawText('机体装配', {
    size: 16,
    fill: COLORS.cyan,
    weight: '900',
    letterSpacing: 3,
  }), 16, 14);
  place(bay, makeRawText('雷隼 NX-07 · 机体平台', {
    size: 22,
    fill: COLORS.white,
    weight: '900',
  }), 16, 40);

  const stage = new Container();
  stage.position.set(0, 88);
  stage.addChild(
    new Graphics()
      .ellipse(width / 2, 205, 232, 171)
      .fill({ color: activeMeta.color, alpha: 0.035 })
      .ellipse(width / 2, 205, 216, 154)
      .stroke({ color: 0x78f1e5, alpha: 0.12, width: 1 })
      .ellipse(width / 2, 205, 168, 119)
      .stroke({ color: 0x5ec8ff, alpha: 0.1, width: 1 })
      .ellipse(width / 2, 205, 122, 87)
      .stroke({ color: 0x8dffca, alpha: 0.09, width: 1 })
      .moveTo(82, 120).lineTo(202, 164)
      .moveTo(474, 205).lineTo(350, 217)
      .moveTo(82, 314).lineTo(213, 260)
      .stroke({ color: activeMeta.color, alpha: 0.18, width: 1.5 }),
  );
  const aircraft = bridge.createAssemblyAircraftVisual?.();
  if (aircraft?.root) {
    aircraft.root.position.set(width / 2, 205);
    aircraft.root.scale.set(0.66);
    stage.addChild(aircraft.root);
  } else {
    const fallback = makeAirframeBlueprint(230, 300, activeMeta.color);
    fallback.position.set((width - 230) / 2, 55);
    stage.addChild(fallback);
  }
  fixedSlots.forEach((slot, index) => {
    const positions = [
      { x: 14, y: 68 },
      { x: width - 174, y: 160 },
      { x: 14, y: 262 },
    ];
    stage.addChild(makeAssemblySlotButton({
      slot,
      selected: slot.id === activeSlot,
      ...positions[index],
      width: 160,
      height: 82,
      onPress: () => {
        onFocusSlot?.(slot.id);
        rerender();
      },
    }));
  });
  bay.addChild(stage);

  const selectedSlot = fixedSlots.find((slot) => slot.id === activeSlot);
  const detailTint = color(selectedSlot?.module?.color, activeMeta.color);
  bay.addChild(
    new Graphics()
      .roundRect(16, 472, width - 32, 78, 5)
      .fill({ color: detailTint, alpha: 0.075 })
      .stroke({ color: detailTint, alpha: 0.38, width: 1.5 })
      .rect(16, 472, 4, 78)
      .fill({ color: detailTint, alpha: 0.88 }),
  );
  place(bay, makeRawText(`${activeMeta.orbit} / ${selectedSlot?.module?.name || '未安装固定件'}`, {
    size: 18,
    fill: COLORS.white,
    weight: '900',
  }), 32, 484);
  place(bay, makeRawText(
    selectedSlot?.module?.passive?.description || '从下方模块库选择一个已获得的固定件进行装配。',
    {
      size: 14,
      fill: 0x9a95a6,
      weight: '700',
      maxWidth: width - 64,
    },
  ), 32, 514);

  const stats = [
    ['固定件', `${snapshot.summary.fixedCount}/3`, COLORS.red],
    ['综合增伤', `+${Math.round((snapshot.summary.bonuses.damageMultiplier - 1) * 100)}%`, 0x7deaff],
    ['装配战力', `+${number(snapshot.summary.power)}`, COLORS.amber],
  ];
  stats.forEach(([label, value, tint], index) => {
    const statX = 16 + index * 174;
    bay.addChild(
      new Graphics()
        .roundRect(statX, 568, 164, 78, 3)
        .fill({ color: 0x091c25, alpha: 0.94 })
        .stroke({ color: 0x405259, alpha: 0.45, width: 1 }),
    );
    place(bay, makeRawText(label, {
      size: 13,
      fill: 0x777486,
      weight: '800',
      anchorX: 0.5,
    }), statX + 82, 580);
    place(bay, makeRawText(value, {
      size: 22,
      fill: tint,
      weight: '900',
      anchorX: 0.5,
    }), statX + 82, 606);
  });

  const inventory = new Container();
  inventory.addChild(
    new Graphics()
      .rect(0, 0, width, inventoryHeight)
      .fill({ color: 0x0b1024, alpha: 0.99 })
      .stroke({ color: activeMeta.color, alpha: 0.35, width: 2 }),
  );
  place(inventory, makeRawText('模块档案', {
    size: 15,
    fill: activeMeta.color,
    weight: '900',
    letterSpacing: 3,
  }), 16, 15);
  place(inventory, makeRawText(`${activeMeta.name}模块库`, {
    size: 23,
    fill: COLORS.white,
    weight: '900',
  }), 16, 40);
  place(inventory, makeRawText(`已获得 ${availableModules.length} 件 · 按住卡片拖入上方对应槽位`, {
    size: 14,
    fill: 0x8c8799,
    weight: '700',
    anchorX: 1,
  }), width - 16, 47);
  inventory.eventMode = 'static';
  inventory.hitArea = new Rectangle(0, 0, width, inventoryHeight);
  inventory.__pixiUiAssemblyInventory = true;
  const inventoryDropHighlight = new Graphics()
    .rect(3, 3, width - 6, inventoryHeight - 6)
    .fill({ color: COLORS.red, alpha: 0.045 })
    .stroke({ color: COLORS.red, alpha: 0.9, width: 3 });
  inventoryDropHighlight.visible = false;
  inventoryDropHighlight.eventMode = 'none';
  inventory.addChild(inventoryDropHighlight);
  inventory.__pixiUiAssemblyDropHighlight = inventoryDropHighlight;
  Object.entries(FIXED_SLOT_META).forEach(([slotId, meta], index) => {
    inventory.addChild(makeManualButton({
      x: 16 + index * 177,
      y: 80,
      width: 167,
      height: 46,
      text: `${meta.name} · ${snapshot.ownedModules
        .map((moduleId) => bridge.getAssemblyModuleInfo?.(moduleId))
        .filter((module) => module?.fixedSlot === slotId).length}`,
      fill: slotId === activeSlot ? 0x1b2440 : 0x0a1222,
      stroke: meta.color,
      strokeAlpha: slotId === activeSlot ? 0.92 : 0.3,
      textColor: slotId === activeSlot ? meta.color : 0x807b8f,
      fontSize: 15,
      radius: 4,
      onPress: () => {
        onFocusSlot?.(slotId);
        rerender();
      },
    }));
  });
  if (availableModules.length) {
    availableModules.forEach((module, index) => {
      inventory.addChild(makeFixedModuleCard({
        module,
        installed: snapshot.mounts[activeSlot] === module.id,
        x: 16 + (index % 2) * (moduleCardWidth + moduleGap),
        y: 142 + Math.floor(index / 2) * (moduleCardHeight + moduleGap),
        width: moduleCardWidth,
        height: moduleCardHeight,
        onPress: () => {
          bridge.setAssemblySlot?.(activeSlot, module.id);
          rerender();
        },
      }));
    });
  } else {
    place(inventory, makeRawText('该槽位暂无已获得模块', {
      size: 20,
      fill: 0x6f6a7c,
      weight: '900',
      anchorX: 0.5,
    }), width / 2, 205);
    place(inventory, makeRawText('可通过主线奖励与固定件招募获得', {
      size: 14,
      fill: 0x565263,
      weight: '700',
      anchorX: 0.5,
    }), width / 2, 238);
  }

  const scrollBox = makeReliableScrollView({
    width,
    height: viewportHeight,
    items: [bay, inventory],
    gap: 18,
    contentHeight,
    scrollKey: 'assembly',
    scrollY,
  });
  scrollBox.position.set(0, 72);
  clipButtonActions(bay, scrollBox);
  clipButtonActions(inventory, scrollBox);
  page.addChild(scrollBox);
  return page;
}

function makeAssemblyPage(bridge, rerender, { requestRender, showroom } = {}) {
  if (showroom) {
    const page = new Container();
    page.layout = { width: '100%', height: '100%', isLeaf: true };
    showroom.refresh();
    return page;
  }
  const snapshot = bridge.getAssemblySnapshot();
  const width = 556;
  const page = new Container();
  page.layout = {
    width: '100%',
    height: '100%',
    isLeaf: true,
  };
  stabilizeManualPage(page, width, 1080);

  place(page, makeSingleLineRawText('固定件装配', {
    size: 36,
    minSize: 26,
    fill: COLORS.white,
    weight: '900',
    letterSpacing: 2,
  }, width - 190), 0, 16);
  const pagePowerText = place(page, makeRawText(`装配战力 +${number(snapshot.summary.power)}`, {
    size: 19,
    fill: COLORS.amber,
    weight: '900',
    anchorX: 1,
  }), width, 25);
  page.addChild(
    new Graphics()
      .rect(0, 91, width, 1)
      .fill({ color: COLORS.cyan, alpha: 0.22 }),
  );

  place(page, makeSingleLineRawText('雷隼 NX-07 · 机体平台', {
    size: 16,
    minSize: 13,
    fill: COLORS.white,
    weight: '900',
    letterSpacing: 1,
  }, width - 12), 0, 66);

  let latestSummary = snapshot.summary;
  const summaryValueTexts = [];
  const refreshSummary = (summary = latestSummary) => {
    latestSummary = summary;
    pagePowerText.text = `装配战力 +${number(summary.power)}`;
    if (summaryValueTexts.length === 3) {
      summaryValueTexts[0].text = `${summary.fixedCount}/3`;
      summaryValueTexts[1].text = `+${Math.round((summary.bonuses.damageMultiplier - 1) * 100)}%`;
      summaryValueTexts[2].text = `+${number(summary.power)}`;
    }
    requestRender?.();
  };
  const embedded = bridge.createEmbeddedAssemblyBay?.({
    inventoryCategory: 'fixed',
    requestRender,
    onChange: refreshSummary,
  });
  if (embedded?.root) {
    const bayScale = 0.96;
    embedded.root.scale.set(bayScale);
    embedded.root.position.set((width - 560 * bayScale) / 2, 106);
    // On WeChat, raw touch events do not automatically become Pixi events for
    // this nested assembly bay. The lobby touch router forwards them through
    // this bridge; desktop keeps its native Pixi event path.
    embedded.root.__pixiUiNativeInput = true;
    embedded.root.__pixiUiEmbeddedInput = embedded.handlePointer;
    page.addChild(embedded.root);
    page.__pixiUiDestroy = () => {
      embedded.root.removeFromParent();
      embedded.destroy();
    };
  }

  const summaryY = 960;
  page.addChild(
    new Graphics()
      .rect(0, summaryY, width, 72)
      .fill({ color: 0x07171f, alpha: 0.98 })
      .stroke({ color: 0x78f1e5, alpha: 0.2, width: 1.5 }),
  );
  [
    ['固定件', COLORS.red],
    ['综合增伤', 0x7deaff],
    ['装配战力', COLORS.amber],
  ].forEach(([label, tint], index) => {
    const centerX = (index + 0.5) * (width / 3);
    place(page, makeRawText(label, {
      size: 14,
      fill: 0x777486,
      weight: '800',
      anchorX: 0.5,
    }), centerX, summaryY + 12);
    const valueText = place(page, makeRawText('', {
      size: 21,
      fill: tint,
      weight: '900',
      anchorX: 0.5,
    }), centerX, summaryY + 36);
    summaryValueTexts.push(valueText);
  });
  refreshSummary(latestSummary);
  return page;
}

function lobbyStateKey(bridge) {
  const pilotState = bridge.getPilotState();
  const assembly = bridge.getAssemblySnapshot();
  const gacha = bridge.getGachaState();
  const dailyLogin = bridge.getDailyLoginSnapshot();
  return JSON.stringify({
    state: bridge.game.state,
    tab: bridge.activeLobbyTab,
    stage: bridge.selectedStageIndex,
    difficulty: bridge.selectedDifficultyId,
    coins: bridge.profileState.coins,
    diamonds: bridge.profileState.diamonds,
    fighter: bridge.profileState.fighterLevel,
    gear: bridge.profileState.gearLevel,
    tech: bridge.profileState.techLevel,
    pilot: pilotState.selected,
    owned: pilotState.owned.length,
    assembly: assembly.mounts,
    power: assembly.summary.power,
    pool: bridge.selectedGachaPoolId,
    pulls: gacha.pools[bridge.selectedGachaPoolId]?.totalPulls,
    debug: bridge.debugUnlockAll,
    adPending: bridge.rewardedAdPending,
    dailyLogin: dailyLogin.stateKey,
  });
}

export function createPixiLobby({ bridge, parent = bridge.scene }) {
  const root = new Container();
  root.addChild(
    new Graphics()
      .rect(-FULL_BLEED_X, 0, DESIGN_WIDTH + FULL_BLEED_X * 2, DESIGN_HEIGHT)
      .fill({ color: COLORS.page }),
  );
  root.label = 'shared-pixi-lobby';
  root.eventMode = 'static';
  root.hitArea = new Rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  root.zIndex = 10000;
  const backdrop = new Graphics();
  backdrop
    .circle(445, 300, 270)
    .fill({ color: 0x6946cf, alpha: 0.11 })
    .circle(85, 560, 230)
    .fill({ color: COLORS.red, alpha: 0.035 });
  for (let y = 0; y <= DESIGN_HEIGHT; y += 34) {
    backdrop
      .moveTo(0, y)
      .lineTo(DESIGN_WIDTH, y)
      .stroke({ color: 0xcac0ff, alpha: 0.028, width: 1 });
  }
  for (let x = 0; x <= DESIGN_WIDTH; x += 34) {
    backdrop
      .moveTo(x, 0)
      .lineTo(x, 820)
      .stroke({ color: 0xcac0ff, alpha: 0.022, width: 1 });
  }
  root.addChild(backdrop);
  // The new page owns a native Three group. This single mounting boundary
  // keeps the remaining tabs and their existing modal lifecycle independent.
  const nativeMount = new Container();
  nativeMount.label = 'native-lobby-mount';
  root.addChild(nativeMount);
  parent.sortableChildren = true;
  parent.addChild(root);

  let content = null;
  let lastStateKey = '';
  let buttons = [];
  let activeModal = bridge.previewLobbyModal || null;
  let dismissActiveModalOnOutside = null;
  let detailPilot = null;
  let worldLeaderboardBoard = 'HYFSB';
  let worldLeaderboardRows = [];
  let worldLeaderboardLoading = false;
  let worldLeaderboardError = '';
  let worldLeaderboardRequest = 0;
  let debugClearArmed = false;
  let debugClearTimer = 0;
  let scrollViews = [];
  let activeScrollGesture = null;
  let assemblyDragSources = [];
  let assemblySlotTargets = [];
  let assemblyInventoryTargets = [];
  let nativeInputRegions = [];
  let embeddedInputRegions = [];
  let activeEmbeddedInputRegion = null;
  let activePageUpdate = null;
  let assemblyPage = null;
  let loadoutPage = null;
  let upgradePage = null;
  let supplyPage = null;
  const getNativePage = () => bridge.activeLobbyTab === 'supply' ? supplyPage : bridge.activeLobbyTab === 'upgrade' ? upgradePage : bridge.activeLobbyTab === 'loadout' ? loadoutPage : bridge.activeLobbyTab === 'assembly' ? assemblyPage : bridge.activeLobbyTab === 'battle' ? sortiePage : null;
  const mobileHost = bridge.app.canvas?.closest?.('.game-shell');
  const syncMobileSurface = () => {
    const visible = root.visible && Boolean(getNativePage());
    mobileHost?.classList.toggle('sortie-mobile-active', visible);
    if (bridge.app.canvas?.dataset) bridge.app.canvas.dataset.multiPointer = visible && bridge.activeLobbyTab === 'assembly' && !activeModal ? 'assembly' : '';
  };
  let sortiePage = null;
  let nativePagePress = false;
  let activeAssemblyDrag = null;
  let suppressNextTap = false;
  let scrollRenderFrame = 0;
  let assemblyCommitRenderFrame = 0;
  const scrollPositions = {
    loadout: 0,
    assembly: 0,
    supply: 0,
    'stage-details': 0,
    leaderboard: 0,
  };
  let assemblyFocusSlot = 'wing';
  const requestScrollRender = () => {
    if (scrollRenderFrame) return;
    scrollRenderFrame = globalThis.requestAnimationFrame(() => {
      scrollRenderFrame = 0;
      if (!root.destroyed && root.visible) {
        bridge.app.renderer.render({ container: bridge.app.stage });
      }
    });
  };

  const loadWorldLeaderboard = (board = worldLeaderboardBoard) => {
    if (typeof bridge.getWorldLeaderboard !== 'function') return;
    worldLeaderboardBoard = board === 'HYGQB' ? 'HYGQB' : 'HYFSB';
    worldLeaderboardRows = [];
    worldLeaderboardError = '';
    worldLeaderboardLoading = true;
    const requestId = ++worldLeaderboardRequest;
    render();
    Promise.resolve(bridge.getWorldLeaderboard(worldLeaderboardBoard))
      .then((result) => {
        if (requestId !== worldLeaderboardRequest || root.destroyed) return;
        worldLeaderboardLoading = false;
        worldLeaderboardRows = Array.isArray(result?.rows) ? result.rows : [];
        worldLeaderboardError = result?.error
          ? formatWorldLeaderboardError(result.error)
          : (result?.available === false ? '排行榜暂不可用，请稍后重试' : '');
        render();
      })
      .catch((error) => {
        if (requestId !== worldLeaderboardRequest || root.destroyed) return;
        worldLeaderboardLoading = false;
        worldLeaderboardRows = [];
        worldLeaderboardError = formatWorldLeaderboardError(error || '世界排行榜读取失败');
        render();
      });
  };

  const openWorldLeaderboard = () => {
    if (typeof bridge.getWorldLeaderboard !== 'function') return false;
    activeModal = 'leaderboard';
    const profileRequest = bridge.requestLeaderboardProfile?.();
    if (profileRequest && typeof profileRequest.then === 'function') {
      worldLeaderboardRows = [];
      worldLeaderboardError = '';
      worldLeaderboardLoading = true;
      render();
      Promise.resolve(profileRequest)
        .catch(() => null)
        .then(() => {
          if (activeModal === 'leaderboard' && !root.destroyed) {
            loadWorldLeaderboard(worldLeaderboardBoard);
          }
        });
    } else {
      loadWorldLeaderboard(worldLeaderboardBoard);
    }
    return true;
  };

  const render = () => {
    const previousContent = content;
    const nextContent = new Container();
    dismissActiveModalOnOutside = null;
    const active = bridge.activeLobbyTab || 'battle';
    const native = active === 'battle' || active === 'assembly' || active === 'loadout' || active === 'upgrade' || active === 'supply';
    backdrop.visible = !native;

    if (active === 'battle' && !sortiePage) {
      const modal = id => { activeModal = id; render(); };
      sortiePage = createSortiePage({ bridge, actions: {
        update: ticker => update(ticker),
        stage: index => { bridge.selectCampaignStage(index, Math.sign(index-bridge.selectedStageIndex)); render(); },
        difficulty: id => { bridge.selectDifficulty(id); render(); },
        tab: id => { bridge.switchLobbyTab(id); render(); },
        stageDetails: () => modal('stage-details'),
        dailyLogin: () => modal('daily-login'),
        debug: () => { debugClearArmed = false; modal('debug'); },
        leaderboard: () => {
          if (openWorldLeaderboard() || bridge.openLeaderboard?.()) return;
          modal('leaderboard');
        },
      } });
      nativeMount.object3D.add(sortiePage.group);
    }
    nativeMount.visible = native;
    if (active === 'battle') sortiePage.refresh();
    sortiePage?.setVisible(active === 'battle' && root.visible, active === 'battle' && root.visible && !activeModal);
    if (active === 'assembly' && !assemblyPage) {
      assemblyPage = createAssemblyPage({ bridge, actions: {
        update: ticker => update(ticker),
        tab: id => { bridge.switchLobbyTab(id); render(); },
      } });
      nativeMount.object3D.add(assemblyPage.group);
    }
    if (active === 'assembly') assemblyPage.refresh();
    assemblyPage?.setVisible(active === 'assembly' && root.visible, active === 'assembly' && root.visible && !activeModal);
    if (active === 'loadout' && !loadoutPage) {
      loadoutPage = createLoadoutPage({ bridge, actions: {
        update: ticker => update(ticker),
        tab: id => { bridge.switchLobbyTab(id); render(); },
        changed: () => render(),
      } });
      nativeMount.object3D.add(loadoutPage.group);
    }
    if (active === 'loadout') loadoutPage.refresh();
    loadoutPage?.setVisible(active === 'loadout' && root.visible, active === 'loadout' && root.visible && !activeModal);
    if (active === 'upgrade' && !upgradePage) {
      upgradePage = createUpgradePage({ bridge, actions: {
        update: ticker => update(ticker),
        tab: id => { bridge.switchLobbyTab(id); render(); },
        changed: () => render(),
      } });
      nativeMount.object3D.add(upgradePage.group);
    }
    if (active === 'upgrade') upgradePage.refresh();
    upgradePage?.setVisible(active === 'upgrade' && root.visible, active === 'upgrade' && root.visible && !activeModal);
    if (active === 'supply' && !supplyPage) {
      supplyPage = createSupplyPage({ bridge, actions: {
        update: ticker => update(ticker),
        tab: id => { bridge.switchLobbyTab(id); render(); },
        changed: () => render(),
      } });
      nativeMount.object3D.add(supplyPage.group);
    }
    if (active === 'supply') supplyPage.refresh();
    supplyPage?.setVisible(active === 'supply' && root.visible, active === 'supply' && root.visible && !activeModal);
    syncMobileSurface();
    const pagePaddingX = active === 'loadout'
      ? 15
      : active === 'assembly'
        || active === 'upgrade'
        ? 22
      : active === 'supply'
        ? 0
        : 24;
    const pagePaddingTop = active === 'loadout' || active === 'assembly' ? 0 : 18;
    nextContent.layout = {
      width: DESIGN_WIDTH,
      height: DESIGN_HEIGHT,
      flexDirection: 'column',
    };
    const main = new Container();
    main.layout = {
      width: DESIGN_WIDTH,
      flexGrow: 1,
      minHeight: 0,
      flexDirection: 'column',
      paddingLeft: pagePaddingX,
      paddingRight: pagePaddingX,
      paddingTop: pagePaddingTop,
      paddingBottom: 0,
    };
    const page = new Container();
    addChildren(main, page);
    const header = native ? null : makeHeader(
      bridge,
      bridge.platformKind === 'wechat' ? WECHAT_LOBBY_TOP_INSET : 0,
    );
    if (!native) addChildren(
      nextContent,
      header,
      main,
      makeNavigation(bridge, render),
    );
    if (activeModal === 'daily-login') {
      nextContent.sortableChildren = true;
      const closeDailyLogin = () => {
        activeModal = null;
        render();
      };
      dismissActiveModalOnOutside = closeDailyLogin;
      nextContent.addChild(makeDailyLoginModal(bridge, {
        onClose: closeDailyLogin,
        onClaim: () => {
          const result = bridge.claimDailyLoginReward();
          if (result?.ok) render();
        },
      }));
    } else if (activeModal === 'debug') {
      nextContent.sortableChildren = true;
      const closeDebug = () => {
        if (debugClearTimer) globalThis.clearTimeout(debugClearTimer);
        debugClearTimer = 0;
        debugClearArmed = false;
        activeModal = null;
        render();
      };
      dismissActiveModalOnOutside = closeDebug;
      nextContent.addChild(makeDebugModal(bridge, {
        clearArmed: debugClearArmed,
        onClose: closeDebug,
        onToggle: () => {
          bridge.toggleDebugUnlockAll();
          render();
        },
        onAdd: (type) => {
          bridge.addDebugCurrency(type);
          render();
        },
        onGrantWeapons: () => {
          bridge.grantDebugWeapons();
          render();
        },
        onCompleteRun: () => {
          activeModal = null;
          render();
          bridge.debugCompleteCurrentRun?.();
        },
        onPreviewEvolution: () => {
          activeModal = null;
          render();
          bridge.previewUltimateEvolution?.('blue');
        },
        onClear: () => {
          if (debugClearArmed) {
            bridge.clearGameSaveAndRestart();
            return;
          }
          debugClearArmed = true;
          if (debugClearTimer) globalThis.clearTimeout(debugClearTimer);
          debugClearTimer = globalThis.setTimeout(() => {
            debugClearTimer = 0;
            debugClearArmed = false;
            if (activeModal === 'debug') render();
          }, 4500);
          render();
        },
      }));
    } else if (activeModal === 'stage-details') {
      nextContent.sortableChildren = true;
      const closeStageDetails = () => {
        activeModal = null;
        render();
      };
      dismissActiveModalOnOutside = closeStageDetails;
      nextContent.addChild(makeStageDetailsModal(
        bridge,
        closeStageDetails,
        (stageIndex) => {
          bridge.selectCampaignStage(stageIndex);
          activeModal = null;
          render();
        },
        scrollPositions['stage-details'],
      ));
    } else if (activeModal === 'leaderboard') {
      nextContent.sortableChildren = true;
      const closeLeaderboard = () => {
        activeModal = null;
        render();
      };
      dismissActiveModalOnOutside = closeLeaderboard;
      nextContent.addChild(makeLeaderboardModal(
        bridge,
        closeLeaderboard,
        scrollPositions.leaderboard,
        typeof bridge.getWorldLeaderboard === 'function'
          ? {
            worldMode: true,
            worldBoard: worldLeaderboardBoard,
            worldRows: worldLeaderboardRows,
            worldLoading: worldLeaderboardLoading,
            worldError: worldLeaderboardError,
            onSelectWorldBoard: (board) => loadWorldLeaderboard(board),
            onOpenFriendLeaderboard: () => {
              if (bridge.openLeaderboard?.(bridge.getLeaderboardSubmission?.())) return;
              worldLeaderboardError = '微信好友榜组件暂不可用';
              render();
            },
            onRefreshWorldLeaderboard: () => loadWorldLeaderboard(worldLeaderboardBoard),
          }
          : undefined,
      ));
    } else if (activeModal === 'pilot-art') {
      nextContent.sortableChildren = true;
      const closePilotArt = () => {
        activeModal = null;
        detailPilot = null;
        render();
      };
      dismissActiveModalOnOutside = closePilotArt;
      nextContent.addChild(makePilotArtModal(
        bridge,
        detailPilot || bridge.getActivePilot(),
        closePilotArt,
      ));
    }
    if (previousContent) {
      destroyPixiUiResources(previousContent);
      root.removeChild(previousContent);
      previousContent.destroy({ children: true });
    }
    root.addChild(nextContent);
    content = nextContent;
    activePageUpdate = native ? getNativePage().update : page.__pixiUiUpdate || null;
    lastStateKey = lobbyStateKey(bridge);
    bridge.app.renderer.render({ container: bridge.app.stage });
    buttons = [];
    scrollViews = [];
    assemblyDragSources = [];
    assemblySlotTargets = [];
    assemblyInventoryTargets = [];
    nativeInputRegions = [];
    embeddedInputRegions = [];
    activeEmbeddedInputRegion = null;
    const collectButtons = (node) => {
      if (node.__pixiUiAction) buttons.push(node);
      if (node.__pixiUiReliableScroll) scrollViews.push(node);
      if (node.__pixiUiAssemblyDrag) assemblyDragSources.push(node);
      if (node.__pixiUiAssemblySlotId) assemblySlotTargets.push(node);
      if (node.__pixiUiAssemblyInventory) assemblyInventoryTargets.push(node);
      if (node.__pixiUiNativeInput) nativeInputRegions.push(node);
      if (node.__pixiUiEmbeddedInput) embeddedInputRegions.push(node);
      for (const child of node.children || []) collectButtons(child);
    };
    collectButtons(nextContent);
  };

  const containsGlobalPoint = (node, global) => {
    if (!node.visible || !node.renderable || !node.hitArea) return false;
    if (node.__pixiUiClip) {
      const clipPoint = node.__pixiUiClip.toLocal(global);
      if (!node.__pixiUiClip.hitArea?.contains(clipPoint.x, clipPoint.y)) return false;
    }
    const local = node.toLocal(global);
    return node.hitArea.contains(local.x, local.y);
  };

  const isActionButtonAt = (button, global) => Boolean(
    button?.__pixiUiAction
      && button.enabled
      && containsGlobalPoint(button, global),
  );

  const findActionButton = (global) => {
    for (let index = buttons.length - 1; index >= 0; index -= 1) {
      const button = buttons[index];
      if (isActionButtonAt(button, global)) return button;
    }
    return null;
  };

  const findScrollView = (global) => {
    for (let index = scrollViews.length - 1; index >= 0; index -= 1) {
      const scrollView = scrollViews[index];
      if (!scrollView.visible || !scrollView.renderable || !scrollView.hitArea) continue;
      const local = scrollView.toLocal(global);
      if (scrollView.hitArea.contains(local.x, local.y)) return scrollView;
    }
    return null;
  };

  const findAssemblyDragSource = (global) => {
    for (let index = assemblyDragSources.length - 1; index >= 0; index -= 1) {
      const source = assemblyDragSources[index];
      if (containsGlobalPoint(source, global)) return source;
    }
    return null;
  };

  const findAssemblySlotTarget = (global, compatibleSlot) => {
    for (let index = assemblySlotTargets.length - 1; index >= 0; index -= 1) {
      const target = assemblySlotTargets[index];
      if (
        target.__pixiUiAssemblySlotId === compatibleSlot
        && containsGlobalPoint(target, global)
      ) return target;
    }
    return null;
  };

  const findAssemblyInventoryTarget = (global) => {
    for (let index = assemblyInventoryTargets.length - 1; index >= 0; index -= 1) {
      const target = assemblyInventoryTargets[index];
      if (containsGlobalPoint(target, global)) return target;
    }
    return null;
  };

  const findNativeInputRegion = (global) => {
    for (let index = nativeInputRegions.length - 1; index >= 0; index -= 1) {
      const region = nativeInputRegions[index];
      if (containsGlobalPoint(region, global)) return region;
    }
    return null;
  };

  const findEmbeddedInputRegion = (global) => {
    for (let index = embeddedInputRegions.length - 1; index >= 0; index -= 1) {
      const region = embeddedInputRegions[index];
      if (containsGlobalPoint(region, global)) return region;
    }
    return null;
  };

  const setAssemblyDropHighlights = (drag, visible) => {
    assemblySlotTargets.forEach((target) => {
      const compatible = target.__pixiUiAssemblySlotId === drag?.compatibleSlot;
      if (target.__pixiUiAssemblyDropHighlight) {
        target.__pixiUiAssemblyDropHighlight.visible = Boolean(visible && compatible);
      }
    });
    assemblyInventoryTargets.forEach((target) => {
      if (target.__pixiUiAssemblyDropHighlight) {
        target.__pixiUiAssemblyDropHighlight.visible = Boolean(
          visible && drag?.fromSlot,
        );
      }
    });
  };

  const makeAssemblyDragGhost = (drag) => {
    const ghost = new Container();
    ghost.zIndex = 30000;
    ghost.eventMode = 'none';
    ghost.visible = false;
    ghost.addChild(
      new Graphics()
        .circle(0, 0, 39)
        .fill({ color: 0x050817, alpha: 0.94 })
        .circle(0, 0, 37)
        .stroke({ color: drag.color, alpha: 0.98, width: 3 })
        .circle(0, 0, 28)
        .fill({ color: drag.color, alpha: 0.14 }),
    );
    place(ghost, makeRawText(drag.icon, {
      size: 28,
      fill: drag.color,
      weight: '900',
      anchorX: 0.5,
      anchorY: 0.5,
    }), 0, -2);
    place(ghost, makeRawText(drag.fromSlot ? '拖回模块库卸下' : '拖入高亮槽位', {
      size: 12,
      fill: COLORS.white,
      weight: '900',
      anchorX: 0.5,
      anchorY: 0.5,
    }), 0, 54);
    root.addChild(ghost);
    return ghost;
  };

  const beginAssemblyDrag = (global, pointerId = null) => {
    if (bridge.activeLobbyTab !== 'assembly' || activeAssemblyDrag) {
      return activeAssemblyDrag;
    }
    const source = findAssemblyDragSource(global);
    if (!source) return null;
    const drag = source.__pixiUiAssemblyDrag;
    activeAssemblyDrag = {
      ...drag,
      pointerId,
      startGlobal: global.clone(),
      currentGlobal: global.clone(),
      started: false,
      ghost: makeAssemblyDragGhost(drag),
    };
    return activeAssemblyDrag;
  };

  const moveAssemblyDrag = (global) => {
    if (!activeAssemblyDrag) return false;
    activeAssemblyDrag.currentGlobal.copyFrom(global);
    if (!activeAssemblyDrag.started) {
      const distance = Math.hypot(
        global.x - activeAssemblyDrag.startGlobal.x,
        global.y - activeAssemblyDrag.startGlobal.y,
      );
      if (distance < 10) return true;
      activeAssemblyDrag.started = true;
      pressDragged = true;
      activeScrollGesture = null;
      setAssemblyDropHighlights(activeAssemblyDrag, true);
      activeAssemblyDrag.ghost.visible = true;
    }
    activeAssemblyDrag.ghost.position.copyFrom(root.toLocal(global));
    requestScrollRender();
    return true;
  };

  const finishAssemblyDrag = (global, cancelled = false) => {
    if (!activeAssemblyDrag) return false;
    const drag = activeAssemblyDrag;
    activeAssemblyDrag = null;
    setAssemblyDropHighlights(drag, false);
    drag.ghost.removeFromParent();
    drag.ghost.destroy({ children: true });
    if (!drag.started) {
      pressOrigin = null;
      pressTarget = null;
      pressDragged = false;
      return false;
    }
    suppressNextTap = true;
    let changed = false;
    if (!cancelled) {
      const slotTarget = findAssemblySlotTarget(global, drag.compatibleSlot);
      if (slotTarget) {
        changed = Boolean(bridge.setAssemblySlot?.(
          slotTarget.__pixiUiAssemblySlotId,
          drag.moduleId,
        ));
      } else if (drag.fromSlot && findAssemblyInventoryTarget(global)) {
        changed = Boolean(bridge.setAssemblySlot?.(drag.fromSlot, null));
      }
    }
    pressOrigin = null;
    pressTarget = null;
    pressDragged = false;
    if (changed) {
      if (assemblyCommitRenderFrame) {
        globalThis.cancelAnimationFrame(assemblyCommitRenderFrame);
      }
      assemblyCommitRenderFrame = globalThis.requestAnimationFrame(() => {
        assemblyCommitRenderFrame = 0;
        if (root.destroyed) return;
        try {
          render();
          requestScrollRender();
        } catch (error) {
          console.error('[pixi-assembly-render]', error);
        }
      });
    } else requestScrollRender();
    return true;
  };

  const dispatchPress = (global, expectedButton = null) => {
    if (!expectedButton && getNativePage() && !activeModal) {
      const local = root.toLocal(global);
      return getNativePage()?.activateAt(local.x, local.y) || false;
    }
    const button = expectedButton || findActionButton(global);
    if (!isActionButtonAt(button, global)) return false;
    queueMicrotask(() => {
      try {
        button.__pixiUiAction();
      } catch (error) {
        console.error('[pixi-lobby-action]', error?.message, error?.stack);
      }
    });
    return true;
  };
  const dismissModalFromBackground = (global) => {
    if (!activeModal || !dismissActiveModalOnOutside || findScrollView(global)) return false;
    dismissActiveModalOnOutside();
    return true;
  };
  let pressOrigin = null;
  let pressTarget = null;
  let pressDragged = false;
  let pressStartedInScrollView = false;

  const beginScrollGesture = (global, pointerId = null) => {
    const scrollView = findScrollView(global);
    activeScrollGesture = scrollView
      ? {
        scrollView,
        pointerId,
        key: scrollView.__pixiUiScrollKey,
        startLocalY: scrollView.toLocal(global).y,
        startScrollY: scrollView.__pixiUiScrollY,
      }
      : null;
    return activeScrollGesture;
  };

  const moveScrollGesture = (global) => {
    if (!activeScrollGesture) return false;
    const currentLocalY = activeScrollGesture.scrollView.toLocal(global).y;
    const next = setReliableScrollY(
      activeScrollGesture.scrollView,
      activeScrollGesture.startScrollY
        + currentLocalY
        - activeScrollGesture.startLocalY,
    );
    if (Math.abs(next - scrollPositions[activeScrollGesture.key]) > 0.01) {
      scrollPositions[activeScrollGesture.key] = next;
      requestScrollRender();
    }
    return true;
  };

  const routeNativePointer = (global, phase, pointerId = 1) => {
    if (!root.visible || activeModal || !getNativePage()) return false;
    const local = root.toLocal(global);
    return getNativePage()?.handlePointer({ x: local.x, y: local.y, phase, pointerId }) || false;
  };
  root.on('pointerdown', (event) => {
    nativePagePress = routeNativePointer(event.global, 'start', event.pointerId);
    if (nativePagePress) return;
    if (findNativeInputRegion(event.global)) {
      pressOrigin = null;
      pressTarget = null;
      pressDragged = false;
      activeScrollGesture = null;
      return;
    }
    pressOrigin = event.global.clone();
    pressTarget = findActionButton(event.global);
    pressDragged = false;
    if (activeAssemblyDrag || beginAssemblyDrag(event.global, event.pointerId)) return;
    if (!activeScrollGesture) beginScrollGesture(event.global, event.pointerId);
    pressStartedInScrollView = Boolean(activeScrollGesture);
  });
  root.on('globalpointermove', (event) => {
    if (routeNativePointer(event.global, 'move', event.pointerId)) return;
    if (activeAssemblyDrag) {
      moveAssemblyDrag(event.global);
      return;
    }
    moveScrollGesture(event.global);
    if (!pressOrigin || pressDragged) return;
    const dx = event.global.x - pressOrigin.x;
    const dy = event.global.y - pressOrigin.y;
    if (Math.hypot(dx, dy) > 12) pressDragged = true;
  });
  root.on('pointertap', (event) => {
    if (nativePagePress) { nativePagePress = false; return; }
    if (suppressNextTap) {
      suppressNextTap = false;
      pressOrigin = null;
      pressTarget = null;
      pressDragged = false;
      activeScrollGesture = null;
      return;
    }
    const target = pressTarget;
    const pressed = !pressDragged && target && dispatchPress(event.global, target);
    if (!pressed && !pressDragged && !target && !pressStartedInScrollView) {
      dismissModalFromBackground(event.global);
    }
    pressOrigin = null;
    pressTarget = null;
    pressDragged = false;
    pressStartedInScrollView = false;
    activeScrollGesture = null;
  });
  root.on('pointerup', (event) => {
    if (routeNativePointer(event.global, 'end', event.pointerId)) return;
    if (activeAssemblyDrag) {
      finishAssemblyDrag(event.global);
      return;
    }
    activeScrollGesture = null;
  });
  root.on('pointerupoutside', (event) => {
    routeNativePointer(event.global, 'cancel', event.pointerId);
    nativePagePress = false;
    if (activeAssemblyDrag) finishAssemblyDrag(event.global, true);
    pressOrigin = null;
    pressTarget = null;
    pressDragged = false;
    pressStartedInScrollView = false;
    activeScrollGesture = null;
  });

  const canvas = bridge.app.canvas;
  const mapClientPoint = (clientX, clientY) => {
    const global = new Point();
    if (bridge.app.renderer.events?.mapPositionToPoint) {
      bridge.app.renderer.events.mapPositionToPoint(global, clientX, clientY);
      return global;
    }
    const bounds = canvas.getBoundingClientRect?.() || {
      left: 0,
      top: 0,
      width: bridge.app.screen.width,
      height: bridge.app.screen.height,
    };
    global.set(
      (clientX - bounds.left) / Math.max(1, bounds.width) * bridge.app.screen.width,
      (clientY - bounds.top) / Math.max(1, bounds.height) * bridge.app.screen.height,
    );
    return global;
  };
  const routeAssemblyCanvasPointer = (event, phase) => {
    if (!root.visible || activeModal || bridge.activeLobbyTab !== 'assembly' || !assemblyPage) return false;
    routeNativePointer(mapClientPoint(event.clientX, event.clientY), phase, event.pointerId);
    event.preventDefault?.(); event.stopImmediatePropagation?.();
    try {
      if (phase === 'start') canvas.setPointerCapture?.(event.pointerId);
      else if (phase === 'end' || phase === 'cancel') canvas.releasePointerCapture?.(event.pointerId);
    } catch { /* Capture can already be released by the browser. */ }
    return true;
  };
  const onCanvasPointerDown = (event) => {
    if (routeAssemblyCanvasPointer(event, 'start')) return;
    if (!root.visible) return;
    const global = mapClientPoint(event.clientX, event.clientY);
    if (findNativeInputRegion(global)) {
      pressOrigin = null;
      pressDragged = false;
      activeScrollGesture = null;
      return;
    }
    if (beginAssemblyDrag(global, event.pointerId)) {
      pressOrigin = global.clone();
      pressDragged = false;
      canvas.setPointerCapture?.(event.pointerId);
      event.preventDefault?.();
      return;
    }
    if (!beginScrollGesture(global, event.pointerId)) return;
    pressOrigin = global.clone();
    pressDragged = false;
    pressStartedInScrollView = Boolean(activeScrollGesture);
    canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault?.();
  };
  const onCanvasPointerMove = (event) => {
    if (routeAssemblyCanvasPointer(event, 'move')) return;
    if (
      activeAssemblyDrag
      && (
        activeAssemblyDrag.pointerId === null
        || event.pointerId === activeAssemblyDrag.pointerId
      )
    ) {
      const global = mapClientPoint(event.clientX, event.clientY);
      moveAssemblyDrag(global);
      event.preventDefault?.();
      return;
    }
    if (
      !activeScrollGesture
      || (
        activeScrollGesture.pointerId !== null
        && event.pointerId !== activeScrollGesture.pointerId
      )
    ) return;
    const global = mapClientPoint(event.clientX, event.clientY);
    moveScrollGesture(global);
    if (pressOrigin && !pressDragged) {
      const dx = global.x - pressOrigin.x;
      const dy = global.y - pressOrigin.y;
      if (Math.hypot(dx, dy) > 12) pressDragged = true;
    }
    event.preventDefault?.();
  };
  const onCanvasPointerEnd = (event) => {
    if (routeAssemblyCanvasPointer(event, event.type === 'pointercancel' ? 'cancel' : 'end')) return;
    if (
      activeAssemblyDrag
      && (
        activeAssemblyDrag.pointerId === null
        || event.pointerId === activeAssemblyDrag.pointerId
      )
    ) {
      const global = mapClientPoint(event.clientX, event.clientY);
      canvas.releasePointerCapture?.(event.pointerId);
      finishAssemblyDrag(global, event.type === 'pointercancel');
      return;
    }
    if (
      !activeScrollGesture
      || (
        activeScrollGesture.pointerId !== null
        && event.pointerId !== activeScrollGesture.pointerId
      )
    ) return;
    canvas.releasePointerCapture?.(event.pointerId);
    activeScrollGesture = null;
  };
  canvas.addEventListener?.('pointerdown', onCanvasPointerDown, {
    capture: true,
    passive: false,
  });
  canvas.addEventListener?.('pointermove', onCanvasPointerMove, {
    capture: true,
    passive: false,
  });
  canvas.addEventListener?.('pointerup', onCanvasPointerEnd, { capture: true });
  canvas.addEventListener?.('pointercancel', onCanvasPointerEnd, { capture: true });

  const onWheel = (event) => {
    if (!root.visible) return;
    const global = mapClientPoint(event.clientX, event.clientY);
    if (bridge.activeLobbyTab === 'assembly' && !activeModal) {
      const local = root.toLocal(global);
      if (assemblyPage?.wheel(local.x, local.y, event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 600 : 1))) event.preventDefault();
      return;
    }
    if (!scrollViews.length) return;
    const scrollView = findScrollView(global);
    if (!scrollView) return;
    const deltaScale = event.deltaMode === 1
      ? 16
      : event.deltaMode === 2
        ? bridge.app.screen.height
        : 1;
    const endGlobal = mapClientPoint(
      event.clientX,
      event.clientY + event.deltaY * deltaScale,
    );
    const localY = scrollView.toLocal(global).y;
    const endLocalY = scrollView.toLocal(endGlobal).y;
    const next = clampReliableScrollY(
      scrollView,
      scrollView.__pixiUiScrollY - (endLocalY - localY),
    );
    if (Math.abs(next - scrollView.__pixiUiScrollY) > 0.01) {
      scrollPositions[scrollView.__pixiUiScrollKey] = setReliableScrollY(scrollView, next);
      requestScrollRender();
      event.preventDefault();
    }
  };
  canvas.addEventListener?.('wheel', onWheel, { capture: true, passive: false });

  const update = (ticker) => {
    const visible = MENU_STATES.has(bridge.game.state);
    root.visible = visible;
    sortiePage?.setVisible(visible && bridge.activeLobbyTab === 'battle', visible && bridge.activeLobbyTab === 'battle' && !activeModal);
    assemblyPage?.setVisible(visible && bridge.activeLobbyTab === 'assembly', visible && bridge.activeLobbyTab === 'assembly' && !activeModal);
    loadoutPage?.setVisible(visible && bridge.activeLobbyTab === 'loadout', visible && bridge.activeLobbyTab === 'loadout' && !activeModal);
    upgradePage?.setVisible(visible && bridge.activeLobbyTab === 'upgrade', visible && bridge.activeLobbyTab === 'upgrade' && !activeModal);
    supplyPage?.setVisible(visible && bridge.activeLobbyTab === 'supply', visible && bridge.activeLobbyTab === 'supply' && !activeModal);
    syncMobileSurface();
    if (!visible) return;
    activePageUpdate?.(ticker);
    const key = lobbyStateKey(bridge);
    if (key !== lastStateKey) render();
  };

  const handlePointer = ({ x, y, phase = 'move', pointerId = 1 }) => {
    if (!root.visible) return false;
    const global = new Point(Number(x) || 0, Number(y) || 0);
    if (routeNativePointer(global, phase, pointerId)) return true;
    if (bridge.platformKind === 'wechat') {
      if (phase === 'start') activeEmbeddedInputRegion = findEmbeddedInputRegion(global);
      const embeddedRegion = activeEmbeddedInputRegion || findEmbeddedInputRegion(global);
      if (embeddedRegion?.__pixiUiEmbeddedInput?.(global, phase, pointerId)) {
        if (phase === 'end' || phase === 'cancel') activeEmbeddedInputRegion = null;
        return true;
      }
      if (phase === 'end' || phase === 'cancel') activeEmbeddedInputRegion = null;
    }
    if (phase === 'start') {
      pressOrigin = global.clone();
      pressTarget = findActionButton(global);
      pressDragged = false;
      pressStartedInScrollView = false;
      if (activeAssemblyDrag || beginAssemblyDrag(global, pointerId)) return true;
      beginScrollGesture(global, pointerId);
      pressStartedInScrollView = Boolean(activeScrollGesture);
      return true;
    }
    if (phase === 'move') {
      if (activeAssemblyDrag) return moveAssemblyDrag(global);
      moveScrollGesture(global);
      if (pressOrigin && !pressDragged) {
        const dx = global.x - pressOrigin.x;
        const dy = global.y - pressOrigin.y;
        if (Math.hypot(dx, dy) > 12) pressDragged = true;
      }
      return true;
    }
    if (activeAssemblyDrag) {
      finishAssemblyDrag(global, phase === 'cancel');
      return true;
    }
    const startedInScrollView = pressStartedInScrollView;
    const target = pressTarget;
    const pressed = phase !== 'cancel'
      && !pressDragged
      && target
      && dispatchPress(global, target);
    if (!pressed && phase !== 'cancel' && !pressDragged && !target && !startedInScrollView) {
      dismissModalFromBackground(pressOrigin || global);
    }
    pressOrigin = null;
    pressTarget = null;
    pressDragged = false;
    pressStartedInScrollView = false;
    activeScrollGesture = null;
    return true;
  };

  render();
  return {
    root,
    get sortiePage() { return sortiePage; },
    get assemblyPage() { return assemblyPage; },
    get loadoutPage() { return loadoutPage; },
    get upgradePage() { return upgradePage; },
    get supplyPage() { return supplyPage; },
    render,
    dispatchPress,
    handlePointer,
    update,
    destroy() {
      sortiePage?.destroy();
      assemblyPage?.destroy();
      loadoutPage?.destroy();
      upgradePage?.destroy();
      supplyPage?.destroy();
      mobileHost?.classList.remove('sortie-mobile-active');
      if (canvas.dataset) delete canvas.dataset.multiPointer;
      if (debugClearTimer) globalThis.clearTimeout(debugClearTimer);
      if (scrollRenderFrame) globalThis.cancelAnimationFrame(scrollRenderFrame);
      if (assemblyCommitRenderFrame) {
        globalThis.cancelAnimationFrame(assemblyCommitRenderFrame);
      }
      canvas.removeEventListener?.('pointerdown', onCanvasPointerDown, { capture: true });
      canvas.removeEventListener?.('pointermove', onCanvasPointerMove, { capture: true });
      canvas.removeEventListener?.('pointerup', onCanvasPointerEnd, { capture: true });
      canvas.removeEventListener?.('pointercancel', onCanvasPointerEnd, { capture: true });
      canvas.removeEventListener?.('wheel', onWheel, { capture: true });
      if (content) destroyPixiUiResources(content);
      root.removeFromParent();
      root.destroy({ children: true });
    },
  };
}

const COMBAT_VISIBLE_STATES = new Set([
  'playing', 'paused', 'dodge-tutorial', 'levelup', 'battle-supply', 'revive-prompt',
  'evolving', 'victory_cinematic', 'victory_result', 'fixed_result', 'defeat_result',
]);

function makeCombatButton(options) {
  const button = makeManualButton({
    ...combatButtonStyle('secondary'),
    subtextColor: COMBAT_UI.muted,
    radius: 5,
    strokeAlpha: 1,
    disabledFill: 0x203344,
    disabledTextColor: COMBAT_UI.muted,
    disabledSubtextColor: COMBAT_UI.muted,
    disabledAlpha: 1,
    ...options,
    ...combatButtonStyle(options.variant),
  });
  button.__combatLabel = options.text || '';
  const buttonArt = options.art || (options.text ? (options.variant === 'primary' ? 'primary' : 'secondary') : null);
  if (buttonArt) {
    const background = button.children[0];
    let artwork;
    const skin = addVisualSurface(button,s=>{
      artwork = paintCombatArt(s,options.disabled?'disabled':buttonArt,0,0,options.width,options.height);
    });
    button.setChildIndex(skin,1);
    if (!options.disabled) {
      button.onDown.connect(()=>setCombatArt(artwork,'pressed'));
      button.onUp.connect(()=>setCombatArt(artwork,buttonArt));
      button.onUpOut.connect(()=>setCombatArt(artwork,buttonArt));
    }
    // Keep a readable fallback until the asynchronously loaded skin is ready.
    artwork.onBeforeRender = () => { background.visible = !artwork.material.map?.image?.width; };
    background.visible = !artwork.material.map?.image?.width;
  }
  return button;
}

function gradeColor(id) {
  return id === 'S' || id === 'SS' ? COMBAT_UI.gold : id === 'A' ? COMBAT_UI.blue : COMBAT_UI.text;
}

function makeCombatText(value, role = 'number', options = {}) {
  return makeRawText(value,{...COMBAT_TYPE[role],family:COMBAT_TYPE.family,letterSpacing:0,...options});
}

function addCombatBackdrop(root, tint = COMBAT_UI.ink, alpha = 0.88) {
  if (root.externalStageBackdrop) {
    // Retain the backdrop slot so pause-panel entrance motion and hit testing
    // still include every foreground control; the stage paints the dimming.
    root.addChild(new Container());
    return;
  }
  root.addChild(new Graphics()
    .rect(-FULL_BLEED_X, 0, DESIGN_WIDTH + FULL_BLEED_X * 2, DESIGN_HEIGHT)
    .fill({ color: tint, alpha }));
}

function addDodgeTutorialUi(root, bridge, refs) {
  addCombatBackdrop(root, 0x030817, 0.82);

  addVisualSurface(root,s=>paintPsdPopup(s,'primary',42,300,516,640));
  place(root, makeSingleLineRawText('滑动闪避', {
    size: 46, fill: COLORS.white, weight: '900', letterSpacing: 5, anchorX: 0.5,
  }, 444), 300, 334);
  addSymbol(root,'shield',272,441,56,'#23415a');

  addVisualSurface(root,s=>paintCombatArt(s,'card',78,535,444,300));
  root.addChild(new Graphics()
    .moveTo(112, 685)
    .lineTo(488, 685)
    .stroke({ color: 0x78f1e5, alpha: 0.22, width: 2 }));
  place(root, makeRawText('‹', {
    size: 82, fill: 0x78f1e5, weight: '700', anchorX: 0.5, anchorY: 0.5,
  }), 128, 685);
  place(root, makeRawText('›', {
    size: 82, fill: 0x78f1e5, weight: '700', anchorX: 0.5, anchorY: 0.5,
  }), 472, 685);

  const demoShip = new Container();
  demoShip.position.set(300, 685);
  demoShip.addChild(new Graphics()
    .circle(0, 0, 52)
    .fill({ color: 0x78f1e5, alpha: 0.07 })
    .circle(0, 0, 46)
    .stroke({ color: 0x78f1e5, alpha: 0.18, width: 2 }));
  const currentAircraft = bridge.createAssemblyAircraftVisual?.();
  if (currentAircraft?.root) {
    currentAircraft.root.scale.set(0.45);
    bridge.updateAssemblyAircraftVisual?.(currentAircraft, 0);
    demoShip.addChild(currentAircraft.root);
    refs.dodgeTutorialAircraft = currentAircraft;
  } else {
    const fallbackAircraft = new Graphics()
      .poly([0, -72, 38, 31, 14, 18, 0, 62, -14, 18, -38, 31])
      .fill({ color: 0xe9fbff, alpha: 0.98 })
      .stroke({ color: 0x78f1e5, alpha: 0.92, width: 3 })
      .poly([-9, 56, 0, 92, 9, 56])
      .fill({ color: 0xffd766, alpha: 0.9 });
    fallbackAircraft.scale.set(0.5);
    demoShip.addChild(fallbackAircraft);
  }
  root.addChild(demoShip);
  refs.dodgeTutorialDemo = demoShip;

  const gestureSurface = new Container();
  gestureSurface.eventMode = 'static';
  gestureSurface.cursor = 'grab';
  gestureSurface.hitArea = new Rectangle(
    -FULL_BLEED_X,
    0,
    DESIGN_WIDTH + FULL_BLEED_X * 2,
    DESIGN_HEIGHT,
  );
  gestureSurface.addChild(new Graphics()
    .rect(-FULL_BLEED_X, 0, DESIGN_WIDTH + FULL_BLEED_X * 2, DESIGN_HEIGHT)
    .fill({ color: 0xffffff, alpha: 0.001 }));
  let startX = null;
  let startGlobal = null;
  let completed = false;
  const resetDemo = () => {
    startX = null;
    startGlobal = null;
    demoShip.__tutorialDragging = false;
    gestureSurface.cursor = 'grab';
  };
  const handleTouch = (global, phase, nativeEvent = null) => {
    if (completed) return true;
    const touchX = gestureSurface.toLocal(global).x;
    if (phase === 'start') {
      startX = touchX;
      startGlobal = global.clone();
      demoShip.__tutorialDragging = true;
      return true;
    }
    if (phase === 'move' && startX !== null) {
      const deltaX = touchX - startX;
      demoShip.position.x = 300 + Math.max(-105, Math.min(105, deltaX));
      demoShip.rotation = Math.max(-0.22, Math.min(0.22, deltaX * 0.002));
      if (Math.abs(deltaX) >= 72) {
        completed = true;
        const didComplete = bridge.completeDodgeTutorial(Math.sign(deltaX));
        if (didComplete && startGlobal) {
          resumeDodgeTutorialPointer(bridge, startGlobal, global, nativeEvent);
        }
      }
      return true;
    }
    if (phase === 'end' || phase === 'cancel') {
      resetDemo();
      return true;
    }
    return true;
  };
  refs.handleDodgeTutorialTouch = handleTouch;
  gestureSurface.on('pointerdown', (event) => {
    event.stopPropagation();
    handleTouch(event.global, 'start', event.nativeEvent);
    gestureSurface.cursor = 'grabbing';
  });
  gestureSurface.on('pointermove', (event) => {
    if (startX === null || completed) return;
    event.stopPropagation();
    handleTouch(event.global, 'move', event.nativeEvent);
  });
  gestureSurface.on('pointerup', (event) => {
    event.stopPropagation();
    handleTouch(event.global, 'end', event.nativeEvent);
  });
  gestureSurface.on('pointerupoutside', () => resetDemo());
  gestureSurface.on('pointercancel', () => resetDemo());
  root.addChild(gestureSurface);
}

function addSharedCombatHud(root, bridge, refs, art) {
  refs.psdHud = createPsdCombatHud(root, bridge, flightGradeMeta, () => stageWaveTime(CAMPAIGN[bridge.game.stageIndex] || CAMPAIGN[0]));
}

export function addCenteredCombatCard(root, {
  eyebrow, title, copy, tint = 0x78f1e5, danger = false,
  secondaryText, primaryText, onSecondary, onPrimary,
  bridge, art,
}) {
  // Exit confirmation needs only the consequence and two clear choices.
  // Keep the richer loadout summary exclusive to the pause screen.
  if (danger) {
    const height = 264;
    const top = (DESIGN_HEIGHT - height) / 2;
    addCombatBackdrop(root, COMBAT_UI.ink, .78);
    addVisualSurface(root, s => paintPsdPopup(s, 'secondary', 54, top, 492, height));
    place(root, makeCombatText(title, 'number', {size:30,fill:0x1b3048,anchorX:.5}), 300, top+28);
    place(root, makeCombatText(copy, 'label', {size:20,fill:0x30465c,anchorX:.5}), 300, top+91);
    root.addChild(makeCombatButton({
      x:78,y:top+158,width:216,height:80,text:secondaryText,
      variant:'secondary',art:'secondary',fontSize:24,onPress:onSecondary,
    }));
    root.addChild(makeCombatButton({
      x:306,y:top+158,width:216,height:80,text:primaryText,
      variant:'primary',art:'primary',fontSize:24,onPress:onPrimary,
    }));
    return;
  }
  const weaponCount = !danger && bridge?.game.fixedPartsMode ? bridge.game.fixedLoadout.weapons.length : 0;
  const height = weaponCount ? 360 + weaponCount * 94 : 352;
  const top = Math.max(150, (DESIGN_HEIGHT - height) / 2);
  const buttonsY = top + height - 124;
  addCombatBackdrop(root, COMBAT_UI.ink, .84);
  addVisualSurface(root,s=>paintPsdPopup(s,'primary',38,top,524,height));
  // Use the authored PSD title tab instead of a separate yellow banner.
  place(root, makeRawText(eyebrow || title, {
    size: 34, fill: COLORS.white, weight: '900',
  }), 92, top+36);
  addSymbol(root,'pause',486,top+40,26,'#d5e8ef');
  if(danger)root.addChild(new Graphics().roundRect(72,top+140,456,60,3)
    .fill({color:0x4a2533,alpha:.8}).rect(72,top+140,4,60).fill({color:COMBAT_UI.danger}));
  if(copy)place(root, makeRawText(copy, {
    size: 20, fill: 0x30465c, weight: '700', anchorX: 0.5,
  }), 300, top+158);
  if(weaponCount) addFixedBuildSummary(root,bridge,top+146,art);
  root.addChild(makeCombatButton({
    x: 70, y: buttonsY, width: danger?224:174, height: 90, text: secondaryText, variant: danger?'primary':'secondary', art:danger?'primary':'secondary',
    fill:0x23394b,pressedFill:0x344f65,
    stroke: 0x718b9c, strokeAlpha: 1, textColor: 0xd5e1e8,
    fontSize: 22, onPress: onSecondary,
  }));
  root.addChild(makeCombatButton({
    x: danger?306:256, y: buttonsY, width: danger?224:274, height: 90, text: primaryText, variant: danger ? 'secondary' : 'primary', art:danger?'secondary':'primary',
    fill: danger ? 0xb3313e : 0xffd642,pressedFill:danger?0xd24b55:0xffe682,
    stroke: danger?0xff8d85:0xffed9c, textColor: danger ? COLORS.white : 0x152635,
    fontSize: 24, onPress: onPrimary,
  }));
}

function addFixedLevelUpUi(root, bridge, art) {
  renderFixedUpgradeUi({ root, bridge, art, makeText: makeRawText, place,
    makeButton: makeCombatButton, backdrop: addCombatBackdrop });
}

function addFixedBuildSummary(root, bridge, y=765,art) {
  const state=bridge.game.fixedGrowth.state;
  place(root,makeRawText('本局武装',{size:23,fill:0x23415a,weight:'900'}),66,y);
  const weapons=bridge.game.fixedLoadout.weapons;
  place(root,makeRawText(`${weapons.length} 件装备`,{size:17,fill:0x38576a,anchorX:1}),534,y+4);
  weapons.forEach((w,i)=>{
    const level=1+(state.nodes[w.id]?.length||0),focused=state.focus===w.id;
    const card=makeCombatButton({x:64,y:y+43+i*94,width:472,height:82,art:'secondary',fill:focused?0x20394c:0x142a3b,pressedFill:0x2b465b,stroke:focused?0xdab95d:0x425d70,strokeAlpha:1,onPress:()=>bridge.focusFixedWeapon(w.id)});
    addVisualSurface(card,s=>{
      paintCombatArt(s,'slot',8,8,92,66);
      const texture=art?.get(w.itemId);
      if(texture){const fit=upgradeIconLayout(texture,{x:12,y:12,width:84,height:58});s.image(texture,fit.x,fit.y,fit.width,fit.height,fit.crop).material.toneMapped=!texture.userData.inventoryIcon;}
      s.text(bridge.presentation?w.name:fixedPartName(w.itemId),112,26,{size:21,weight:800,maxWidth:236});
      if(focused)s.text('优先强化',112,57,{size:16,color:'#ffdb77',maxWidth:238});
      s.text(`Lv.${level}`,455,27,{size:22,color:'#ffe199',align:'right',weight:800});
      drawUiSymbol(s,focused?'target':'grid',431,48,23,focused?'#ffdb77':'#6c879a');
    });root.addChild(card);
  });
}

function addCombatPanel(root, x, y, width, height, kind = 'primary') {
  addVisualSurface(root, surface => paintPsdPopup(surface, kind, x, y, width, height));
}

function addLevelUpCombatUi(root, bridge, fixedPartArt) {
  if (bridge.game.fixedPartsMode) return addFixedLevelUpUi(root, bridge, fixedPartArt);
  addCombatBackdrop(root, 0x020d12, 0.92);
  const choices = bridge.currentUpgradeChoices || [];
  const upgradeAdAction = bridge.game.upgradeAdAction || '';
  const upgradeAdPending = Boolean(upgradeAdAction || bridge.rewardedAdPending);
  place(root, makeRawText(bridge.game.primarySkillPath ? '本局路线强化' : '本局构筑 · 主武器协议', {
    size: 15, fill: 0x78f1e5, weight: '900', letterSpacing: 4, anchorX: 0.5,
  }), 300, 194);
  place(root, makeSingleLineRawText(bridge.game.primarySkillPath ? '选择一项升级' : '锁定一条主武器路线', {
    size: 34, fill: COLORS.white, weight: '900', anchorX: 0.5,
  }, 540), 300, 232);
  choices.slice(0, 3).forEach((skill, index) => {
    const cardWidth = 174;
    const x = 27 + index * 186;
    const tint = color(ROUTE_MAP.get(skill.path)?.color, 0x78f1e5);
    const capLevel = Number(bridge.game.skills?.[`${skill.path}_cap`]) || 0;
    const ultimateProgress = bridge.game.primarySkillPath === skill.path
      ? getUltimateProgress(
        bridge.game.skills || {},
        skill.path,
        bridge.game.ultimateStageTwoTasks?.[skill.path],
      )
      : null;
    // Before the first evolution, only recipe ingredients are task cards.
    // Afterwards every non-capstone upgrade from the main route advances the
    // second-stage task counter.
    const isMainWeaponTask = Boolean(ultimateProgress && !ultimateProgress.crafted && (
      capLevel === 1
        ? !skill.id.endsWith('_cap')
        : ultimateProgress.requirements.some((requirement) => (
          requirement.skillId === skill.id && !requirement.complete
        ))
    ));
    const card = new ButtonContainer();
    card.position.set(x, 335);
    card.hitArea = new Rectangle(0, 0, cardWidth, 420);
    card.__pixiUiAction = () => bridge.chooseSkill(skill);
    card.addChild(new Graphics()
      .poly([10, 0, cardWidth, 0, cardWidth, 410, cardWidth - 10, 420, 0, 420, 0, 10])
      .fill({ color: 0x071920, alpha: 0.98 })
      .stroke({ color: tint, alpha: 0.68, width: 2 })
      .rect(0, 0, cardWidth, 4)
      .fill({ color: tint, alpha: 0.9 })
      .circle(cardWidth / 2, 122, 46)
      .fill({ color: tint, alpha: 0.08 })
      .stroke({ color: tint, alpha: 0.52, width: 2 }));
    if (isMainWeaponTask) {
      card.addChild(new Graphics()
        .roundRect(cardWidth - 48, 5, 43, 43, 4)
        .fill({ color: 0xffd65a, alpha: 0.96 })
        .stroke({ color: 0xffffff, alpha: 0.64, width: 1.2 }));
      place(card, makeSingleLineRawText('任务', {
        size: 11, fill: 0x251b05, weight: '1000', letterSpacing: 0,
        anchorX: 0.5,
      }, 36), cardWidth - 26, 26.5);
    }
    place(card, makeSingleLineRawText(skill.starter ? '新技能激活' : '技能强化', {
      size: 13, fill: tint, weight: '900', anchorX: 0,
    }, cardWidth - 64), 14, 26);
    place(card, makeRawText(skill.icon || '✦', {
      size: 42, fill: tint, weight: '900', anchorX: 0.5, anchorY: 0.5,
    }), cardWidth / 2, 122);
    place(card, makeSingleLineRawText(skill.name, {
      size: 20, fill: COLORS.white, weight: '900', align: 'center',
      anchorX: 0.5,
    }, cardWidth - 20), cardWidth / 2, 190);
    // The route buff is shared by every card in the same route. Showing it
    // here hid the unique, player-relevant effect of each upgrade.
    place(card, makeRawText(
      getSkillDescription(skill, (bridge.game.skills?.[skill.id] || 0) + 1).split('；')[0],
      {
      size: 14, fill: 0x9da4aa, weight: '700', align: 'center',
      lineHeight: 21, maxWidth: cardWidth - 22, anchorX: 0.5,
      },
    ), cardWidth / 2, 248);
    place(card, makeRawText(`等级 ${(bridge.game.skills?.[skill.id] || 0) + 1} / ${skill.maxLevel}`, {
      size: 15, fill: tint, weight: '900', anchorX: 0.5,
    }), cardWidth / 2, 382);
    root.addChild(card);
  });
  root.addChild(makeCombatButton({
    x: 27,
    y: 790,
    width: 267,
    height: 76,
    text: upgradeAdAction === 'reroll' ? '广告播放中…' : '看广告 · 重选',
    subtext: '完整观看后刷新本轮选项',
    fill: 0x17213c,
    pressedFill: 0x263d69,
    stroke: 0x78f1e5,
    textColor: 0xdffcff,
    subtextColor: 0x87aeb8,
    fontSize: 18,
    subSize: 12,
    adBadge: true,
    disabled: upgradeAdPending,
    onPress: () => bridge.requestAdReroll(),
  }));
  const canTakeAll = choices.length > 1;
  root.addChild(makeCombatButton({
    x: 306,
    y: 790,
    width: 267,
    height: 76,
    text: upgradeAdAction === 'take-all'
      ? '广告播放中…'
      : '看广告 · 我全要',
    subtext: '完整观看后获得本轮全部升级',
    fill: 0x3a3114,
    pressedFill: 0x594a1d,
    stroke: 0xe7ff78,
    textColor: 0xf6ffbf,
    subtextColor: 0xb3b88a,
    fontSize: 18,
    subSize: 12,
    adBadge: true,
    disabled: upgradeAdPending || !canTakeAll,
    onPress: () => bridge.requestAdTakeAll(),
  }));
}

function addReviveCombatUi(root, bridge, refs) {
  addCombatBackdrop(root, COMBAT_UI.ink, 0.86);
  addCombatPanel(root,72,386,456,428);
  root.addChild(new Graphics()
    .circle(293, 520, 65)
    .fill({ color: COMBAT_UI.panel })
    .stroke({ color: COMBAT_UI.gold, alpha: 0.7, width: 2 }));
  addSymbol(root,'heart',278,414,30,'#a9e8bc');
  refs.revive = place(root, makeRawText('10', {
    size: 48, fill: COLORS.white, weight: '900', anchorX: 0.5, anchorY: 0.5,
  }), 293, 514);
  place(root, makeRawText('是否复活？', {
    size: 33, fill: COLORS.white, weight: '900', anchorX: 0.5,
  }), 293, 591);
  const wave = bridge.game.bossSpawned
    ? '旗舰战'
    : `第 ${Math.max(1, bridge.game.waveIndex || 1)} 波`;
  place(root, makeRawText(`${wave} · 倒计时结束后结算`, {
    size: 16, fill: 0x30465c, weight: '700', anchorX: 0.5,
  }), 293, 641);
  place(root, makeRawText(bridge.presentation?.reviveCopy || '恢复 50% 生命 · 仅限 1 次', {
    size: 16, fill: 0x30465c, weight: '700', anchorX: 0.5,
  }), 293, 668);
  root.addChild(makeCombatButton({
    x: 96, y: 698, width: 145, height: 90, text: '放弃', variant: 'secondary',
    stroke: 0xffffff, strokeAlpha: 0.18, textColor: 0xaeb5bc,
    fontSize: 18, disabled: bridge.game.reviveAdPending, onPress: () => bridge.declineRevive(),
  }));
  root.addChild(makeCombatButton({
    x: 251, y: 698, width: 239, height: 90, variant: 'primary',
    text: bridge.game.reviveAdPending ? '广告播放中…' : '看广告复活',
    fill: 0x91eee7, textColor: 0x062128,
    fontSize: 18,
    adBadge: true,
    disabled: bridge.game.reviveAdPending,
    onPress: () => bridge.requestAdRevive(),
  }));
}

function evolutionCinematicCopy(evolution) {
  const stage = Math.max(1, Number(evolution.stage) || 1);
  if (stage >= 2) {
    if (evolution.path === 'sword') {
      return '第二段 · 万剑齐鸣，制导、穿心与终结齐射全功率展开';
    }
    if (evolution.path === 'red') {
      return '第二段 · 全场索敌，三击爆破与标记连锁全面接管战场';
    }
    const effect = evolution.skill
      ? getSkillDescription(evolution.skill, stage).replace(/^二段：?\s*/, '')
      : '终阶武装参数全数解锁';
    return `第二段 · ${effect}`;
  }
  const effect = evolution.skill
    ? getSkillDescription(evolution.skill, stage).replace(/^一段：?\s*/, '')
    : '终极弹道协议已完成重构';
  return `第一段 · ${effect}`;
}

function addUltimateEvolutionCinematic(root, bridge, refs) {
  const evolution = bridge.game.evolutionCurrent || {};
  const route = ROUTE_MAP.get(evolution.path);
  const activePilot = bridge.getActivePilot?.();
  const tint = color(route?.color, 0xe7ff78);
  const stage = Math.max(1, Number(evolution.stage) || 1);
  const stageTwo = stage >= 2;

  addCombatBackdrop(root, 0x02030d, 1);

  refs.evolutionBackdropRays = new Container();
  for (let index = 0; index < 9; index += 1) {
    const ray = new Graphics()
      .poly([0, 0, 42 + index * 6, 0, 270 + index * 13, 1300, 160 + index * 8, 1300])
      .fill({ color: tint, alpha: index % 2 ? 0.025 : 0.052 });
    ray.position.x = -210 + index * 92;
    refs.evolutionBackdropRays.addChild(ray);
  }
  root.addChild(refs.evolutionBackdropRays);

  refs.evolutionGlyph = place(root, makeRawText(evolution.icon || route?.icon || '✦', {
    size: 270,
    fill: tint,
    weight: '900',
    anchorX: 0.5,
    anchorY: 0.5,
  }), 480, 305);
  refs.evolutionGlyph.alpha = 0.09;

  if (activePilot) {
    const focusX = (activePilot.portraitFocus?.x ?? 50) / 100;
    refs.evolutionPortrait = makePortraitWindow(bridge, activePilot, 520, 900, {
      backgroundAlpha: 0,
      zoom: 1.02,
      focusX,
      focusY: 0,
      targetY: 0,
    });
    refs.evolutionPortrait.pivot.set(260, 450);
    refs.evolutionPortrait.position.set(390, 545);
    root.addChild(refs.evolutionPortrait);
    refs.evolutionPortraitTint = new Graphics()
      .rect(0, 0, 520, 900)
      .fill({ color: tint, alpha: 0.09 });
    refs.evolutionPortraitTint.position.set(130, 95);
    root.addChild(refs.evolutionPortraitTint);
  }

  root.addChild(new Graphics()
    .poly([0, 0, 340, 0, 230, 1300, 0, 1300])
    .fill({ color: 0x02030d, alpha: 0.91 })
    .poly([0, 620, 600, 760, 600, 1300, 0, 1300])
    .fill({ color: 0x02030d, alpha: 0.82 })
    .rect(0, 714, 600, 4)
    .fill({ color: tint, alpha: 0.22 }));

  refs.evolutionScanLines = [];
  for (let index = 0; index < 5; index += 1) {
    const scan = new Graphics()
      .rect(0, 0, DESIGN_WIDTH, index === 2 ? 4 : 2)
      .fill({ color: index === 2 ? 0xffffff : tint, alpha: index === 2 ? 0.55 : 0.22 });
    scan.position.y = 180 + index * 172;
    refs.evolutionScanLines.push(scan);
    root.addChild(scan);
  }

  refs.evolutionPilotLabel = new Container();
  refs.evolutionPilotLabel.position.set(34, 164);
  refs.evolutionPilotLabel.addChild(new Graphics()
    .rect(0, 0, 5, 98)
    .fill({ color: tint, alpha: 0.92 })
    .rect(15, 0, 210, 1)
    .fill({ color: tint, alpha: 0.38 }));
  place(refs.evolutionPilotLabel, makeRawText(
    stageTwo ? '超限共鸣' : '觉醒',
    {
    size: 12, fill: tint, weight: '900', letterSpacing: 2.2,
    },
  ), 18, 12);
  place(refs.evolutionPilotLabel, makeRawText(activePilot?.name || '作战单元', {
    size: 28, fill: COLORS.white, weight: '900', letterSpacing: 1,
  }), 18, 39);
  place(refs.evolutionPilotLabel, makeRawText(
    activePilot?.aircraft || '',
    {
    size: 12, fill: 0xa7a9bd, weight: '800', letterSpacing: 1.3,
    },
  ), 18, 76);
  root.addChild(refs.evolutionPilotLabel);

  refs.evolutionFlare = new Graphics()
    .rect(0, 0, DESIGN_WIDTH, 7)
    .fill({ color: 0xffffff, alpha: 0.88 })
    .rect(0, -16, DESIGN_WIDTH, 39)
    .fill({ color: tint, alpha: 0.14 });
  refs.evolutionFlare.pivot.set(DESIGN_WIDTH / 2, 3.5);
  refs.evolutionFlare.position.set(DESIGN_WIDTH / 2, 715);
  root.addChild(refs.evolutionFlare);

  refs.evolutionTitleGroup = new Container();
  refs.evolutionTitleGroup.position.set(300, 760);
  place(refs.evolutionTitleGroup, makeRawText(stageTwo ? '终阶解放' : '终极进化', {
    size: 17, fill: tint, weight: '900', letterSpacing: 6, anchorX: 0.5,
  }), 0, 0);
  refs.evolutionTitle = place(refs.evolutionTitleGroup, makeSingleLineRawText(
    evolution.name || '终极武装完成',
    {
      size: 58,
      fill: COLORS.white,
      weight: '1000',
      family: '"Arial Black", "PingFang SC", sans-serif',
      letterSpacing: 6,
      anchorX: 0.5,
    },
    480,
  ), 0, 48);
  addSymbol(refs.evolutionTitleGroup,'star',-20,143,40,'#d7d9e8');
  root.addChild(refs.evolutionTitleGroup);

  refs.evolutionCornerMarks = new Graphics()
    .moveTo(20, 78).lineTo(20, 30).lineTo(68, 30)
    .moveTo(532, 30).lineTo(580, 30).lineTo(580, 78)
    .moveTo(20, 1222).lineTo(20, 1270).lineTo(68, 1270)
    .moveTo(532, 1270).lineTo(580, 1270).lineTo(580, 1222)
    .stroke({ color: tint, alpha: 0.58, width: 2 });
  root.addChild(refs.evolutionCornerMarks);
}

function addCinematicCombatUi(root, bridge, refs) {
  const state = bridge.game.state;
  const victory = state === 'victory_cinematic';
  if (victory && !bridge.game.victoryReveal) return;
  const evolution = state === 'evolving';
  if (evolution) {
    addUltimateEvolutionCinematic(root, bridge, refs);
    return;
  }
  const tint = victory ? 0xffdf73 : evolution ? 0xe7ff78 : 0xff5a72;
  addCombatBackdrop(root, state === 'dying' ? 0x1d030b : 0x020d12, 0.74);
  root.addChild(new Graphics()
    .circle(300, 610, 125)
    .stroke({ color: tint, alpha: 0.48, width: 2 })
    .circle(300, 610, 84)
    .stroke({ color: tint, alpha: 0.26, width: 2 }));
  addSymbol(root,victory?'star':'plane',280,535,40,victory?'#ffdf73':'#ff5a72');
  place(root, makeRawText(victory ? '旗舰击破' : evolution ? (bridge.game.evolutionCurrent?.name || '终极武装完成') : '机体失控', {
    size: 48, fill: COLORS.white, weight: '900', letterSpacing: 5, anchorX: 0.5,
  }), 300, 592);
  if (!victory && !evolution) {
    place(root, makeSingleLineRawText(
      bridge.game.lastDamageSummary || '最后受击 · 来源记录中',
      { size: 14, fill: 0xffd7d2, weight: '900', anchorX: 0.5 },
      500,
    ), 300, 718);
  }
}

function updateUltimateEvolutionCinematic(refs, game) {
  if (!refs.evolutionTitleGroup) return;
  const clamp01 = (value) => Math.min(1, Math.max(0, value));
  const easeOut = (value) => 1 - (1 - clamp01(value)) ** 3;
  const duration = Math.max(0.2, Number(game.evolutionDuration) || 2.35);
  const progress = clamp01((Number(game.evolutionTimer) || 0) / duration);
  const exitAlpha = 1 - easeOut((progress - 0.82) / 0.18);
  const portraitIn = easeOut(progress / 0.2);
  const pilotLabelIn = easeOut((progress - 0.08) / 0.18);
  const flareIn = easeOut((progress - 0.1) / 0.16);
  const titleIn = easeOut((progress - 0.2) / 0.22);
  const copyIn = easeOut((progress - 0.4) / 0.18);

  if (refs.evolutionPortrait) {
    refs.evolutionPortrait.position.x = 710 - 320 * portraitIn;
    refs.evolutionPortrait.position.y = 545 - 18 * Math.sin(progress * Math.PI);
    const portraitScale = 1.12 - portraitIn * 0.12;
    refs.evolutionPortrait.scale.set(portraitScale);
    refs.evolutionPortrait.alpha = portraitIn * exitAlpha;
  }
  if (refs.evolutionPortraitTint) {
    refs.evolutionPortraitTint.position.x = 450 - 320 * portraitIn;
    refs.evolutionPortraitTint.alpha = portraitIn * exitAlpha;
  }
  if (refs.evolutionPilotLabel) {
    refs.evolutionPilotLabel.position.x = 34 - (1 - pilotLabelIn) * 80;
    refs.evolutionPilotLabel.alpha = pilotLabelIn * exitAlpha;
  }
  if (refs.evolutionGlyph) {
    refs.evolutionGlyph.rotation = -0.18 + progress * 0.36;
    const glyphPulse = 1 + Math.sin(progress * Math.PI * 5) * 0.04;
    refs.evolutionGlyph.scale.set(glyphPulse);
    refs.evolutionGlyph.alpha = (0.04 + portraitIn * 0.08) * exitAlpha;
  }
  if (refs.evolutionBackdropRays) {
    refs.evolutionBackdropRays.position.x = -70 + progress * 120;
    refs.evolutionBackdropRays.alpha = (0.35 + portraitIn * 0.65) * exitAlpha;
  }
  for (let index = 0; index < (refs.evolutionScanLines || []).length; index += 1) {
    const scan = refs.evolutionScanLines[index];
    scan.position.y = 150 + index * 172 + ((progress * 520 + index * 29) % 104);
    scan.alpha = (0.15 + Math.sin(progress * Math.PI * 12 + index) * 0.12) * exitAlpha;
  }
  if (refs.evolutionFlare) {
    refs.evolutionFlare.scale.set(Math.max(0.02, flareIn), 1);
    refs.evolutionFlare.alpha = flareIn * (1 - clamp01((progress - 0.42) / 0.25)) * exitAlpha;
  }
  refs.evolutionTitleGroup.position.y = 760 + (1 - titleIn) * 72;
  refs.evolutionTitleGroup.alpha = titleIn * exitAlpha;
  if (refs.evolutionTitle) {
    const settle = titleIn < 0.72
      ? 0.8 + titleIn * 0.36
      : 1.06 - (titleIn - 0.72) / 0.28 * 0.06;
    refs.evolutionTitle.scale.set(settle);
  }
  if (refs.evolutionTitleGroup.children[2]) {
    refs.evolutionTitleGroup.children[2].alpha = copyIn;
  }
  if (refs.evolutionTitleGroup.children[3]) {
    refs.evolutionTitleGroup.children[3].alpha = copyIn;
  }
  if (refs.evolutionCornerMarks) {
    refs.evolutionCornerMarks.alpha = Math.min(1, portraitIn * 1.6) * exitAlpha;
  }
}

function addVictoryRewardDoubleDialog(root, bridge) {
  const { coins, diamonds } = victoryAdReward(bridge.game.completionSummary);

  // Block the settlement buttons behind the dialog. The player must
  // acknowledge the reward before the result page returns to the carrier.
  addCombatBackdrop(root, 0x020612, 0.74);
  const blocker = new ButtonContainer();
  blocker.enabled = true;
  blocker.cursor = 'default';
  blocker.hitArea = new Rectangle(
    -FULL_BLEED_X,
    0,
    DESIGN_WIDTH + FULL_BLEED_X * 2,
    DESIGN_HEIGHT,
  );
  blocker.__pixiUiAction = () => {};
  root.addChild(blocker);

  addCombatPanel(root,48,404,504,384,'secondary');
  place(root, makeRawText('奖励已到账', {
    size: 15, fill: 0x78f1e5, weight: '900', letterSpacing: 4, anchorX: 0.5,
  }), 300, 446);
  place(root, makeRawText('额外货币已领取', {
    size: 34, fill: COLORS.white, weight: '900', anchorX: 0.5,
  }), 300, 490);
  place(root, makeSingleLineRawText(
    bridge.game.debugRun ? '调试预览 · 不写入正常进度' : '通关、首通货币翻倍 · 材料不翻倍',
    { size: 16, fill: 0x30465c, weight: '700', anchorX: 0.5 },
    440,
  ), 300, 535);
  if (coins > 0) {
    const label=makeRawText(`金币 +${coins}`,{size:24,fill:0xfff28a,weight:'900',anchorY:0.5});
    const left=300-(label.width+36)/2;
    addSymbol(root,'coins',left,578,28);place(root,label,left+36,590);
  }
  if (diamonds > 0) {
    const label=makeRawText(`钻石 +${diamonds}`,{size:24,fill:0x76eaff,weight:'900',anchorY:0.5});
    const left=300-(label.width+36)/2,y=coins>0?630:590;
    addSymbol(root,'diamonds',left,y-12,28);place(root,label,left+36,y);
  }
  root.addChild(makeCombatButton({
    x: 108,
    y: 674,
    width: 384,
    height: 90,
    text: '确定 · 返回航母',
    variant: 'primary',
    fill: 0x9bf3ec,
    pressedFill: 0xc2fff7,
    stroke: 0xd1fffa,
    textColor: 0x062128,
    fontSize: 21,
    onPress: () => bridge.confirmVictoryRewardDouble?.(),
  }));
}

function addResultCombatUi(root, bridge, art) {
  const game = bridge.game;
  // The embedded battle owns a stage-wide backdrop; painting another one in
  // this fitted UI canvas would darken only the middle for a second time.
  const resultBackdrop = (target) => {
    if (!bridge.presentation?.fullStageResultBackdrop) addCombatBackdrop(target, 0x12161c, .68);
  };
  const defeated = game.state === 'defeat_result' || game.state === 'fixed_result';
  if (defeated) return renderDefeatResult(root, bridge, {
    surface:addVisualSurface, button:makeCombatButton, backdrop:resultBackdrop, stars:makeStarRating,
  });
  const completion = game.completionSummary || {};
  const accent = defeated ? 0x8d2937 : 0x243d59;
  const stage = CAMPAIGN[game.stageIndex] || CAMPAIGN[0];
  const doubled = Boolean(game.victoryRewardDoubled);
  const pending = Boolean(game.victoryRewardDoublePending || bridge.rewardedAdPending);
  const nativeResult=bridge.presentation?.result;
  const rewardStatus=resultRewardStatus(nativeResult,completion.debugRun);
  const receipt = nativeResult?{rows:nativeResult.rows,canDouble:false}:resultRewards(completion, doubled);
  const rows = nativeResult ? nativeResult.rows : defeated
    ? Object.entries(game.defeatReward || {}).filter(([key, n]) => ['aircraftShards', 'weaponParts'].includes(key) && n > 0)
      .map(([key, n]) => ({ label: key === 'weaponParts' ? '通用零件' : '飞机碎片', amount: '+' + n }))
    : receipt.rows;
  if (!defeated && completion.unlockedSkillPath) rows.push({
    label: ROUTE_MAP.get(completion.unlockedSkillPath)?.name || completion.unlockedSkillPath, amount: '已解锁',
  });
  const showAd = !defeated && receipt.canDouble && !doubled;
  const rewardY = 334;
  const rowHeight = 36;
  const rewardHeight = 88 + Math.max(1, rows.length) * rowHeight;
  const buttonY = rewardY + rewardHeight + 22;
  const height = buttonY + (showAd ? 154 : 78) + 24;
  resultBackdrop(root);
  const panel = new Container();
  panel.label = 'battle-result-panel';
  panel.position.set(46, Math.max(70, (DESIGN_HEIGHT - height) / 2));
  root.addChild(panel);
  addCombatPanel(panel, 0, 0, 508, height);
  const text = (value, x, y, size = 20, fill = 0x1b3048, extra = {}) =>
    place(panel, makeCombatText(value, 'label', { size, fill, ...extra }), x, y);
  text(defeated ? '作战结束' : '任务完成', 26, 28, 32, accent);
  text(nativeResult?.stageName || stage.name, 26, 76, 23);
  const grade = nativeResult?{id:nativeResult.grade}:flightGradeMeta(game.flightQuality);
  text('战斗评级', 434, 40, 16, 0x30465c, { anchorX: .5 });
  text(grade.id, 434, 63, 48, gradeColor(grade.id), { anchorX: .5 });
  panel.addChild(new Graphics().rect(26, 122, 456, 1).fill({ color: COMBAT_UI.edge, alpha: .5 }));
  let resultStars;
  if(nativeResult){
    text(nativeResult.progress,26,140,20,0x30465c);
    if(!defeated){
      const stars=makeStarRating(nativeResult.stars,true,{radius:15,gap:44});
      stars.position.set(412,152);panel.addChild(stars);resultStars=stars;
    }
  }
  else if (defeated) {
    text(game.bossSpawned ? '抵达旗舰战' : '抵达第 ' + Math.max(1, game.waveIndex || 1) + ' 波', 26, 140, 20, 0x30465c);
  } else {
    text('通关星级', 26, 140, 20, 0x30465c);
    const stars = makeStarRating(Math.max(0, Math.min(3, Number(completion.stars) || 0)), true, { radius: 15, gap: 44 });
    stars.position.set(412, 152);
    panel.addChild(stars);
    resultStars = stars;
  }
  const stats = nativeResult?.stats || [
    ['用时', formatRunTime(game.elapsed)], ['击破', String(game.kills || 0)],
    ['等级', String(game.level || 1)], ['得分', String(Math.floor(game.score || 0))],
  ];
  stats.forEach(([label, value], index) => {
    const x = 26 + index % 2 * 234, y = 190 + Math.floor(index / 2) * 64;
    text(label, x, y, 18, 0x30465c);
    text(value, x + 214, y - 2, 24, 0x1b3048, { anchorX: 1 });
    panel.addChild(new Graphics().rect(x, y + 39, 214, 1).fill({ color: COMBAT_UI.edge, alpha: .25 }));
  });
  const rewardStart = panel.children.length;
  panel.addChild(new Graphics().rect(26,rewardY,456,1).fill({color:COMBAT_UI.edge,alpha:.5}));
  text(rewardStatus.heading, 36, rewardY + 16, 20, 0x1b3048);
  if (rows.length) rows.forEach((row, i) => {
    place(panel, makeSingleLineRawText(row.label, { size: 20, fill: 0x1b3048, weight: '800' }, 330), 36, rewardY + 52 + i * rowHeight);
    text(row.amount, 472, rewardY + 52 + i * rowHeight, 21, 0x1b3048, { anchorX: 1 });
  });
  else text(rewardStatus.empty, 36, rewardY + 52, 21, 0x30465c);
  const note = nativeResult?.note || (completion.debugRun ? '预览数据 · 不保存'
    : defeated ? '本局战斗数据已记录'
    : rows.length ? (doubled ? '已到账 · 货币奖励已翻倍' : '奖励已自动到账')
    : '累计星级奖励请返回关卡页领取');
  text(note, 36, rewardY + rewardHeight - 27, 17, 0x30465c);
  const rewardNodes = panel.children.slice(rewardStart);
  if (showAd) panel.addChild(makeCombatButton({
    x: 26, y: buttonY, width: 456, height: 66, text: pending ? '广告播放中…' : '看广告 · 货币奖励翻倍',
    variant: 'secondary', art: 'secondary', fontSize: 21,
    disabled: pending, onPress: () => bridge.requestAdVictoryDouble?.(),
  }));
  panel.addChild(makeCombatButton({
    x: 26, y: buttonY + (showAd ? 80 : 0), width: 456, height: 74,
    text: rewardStatus.returnLabel, variant: 'primary', art: 'primary', fontSize: 24,
    disabled: pending, onPress: () => bridge.finishBattleResult(),
  }));
  if (!defeated && game.victoryRewardDoubleNotice) addVictoryRewardDoubleDialog(root, bridge);
  revealResult(panel, defeated ? game.defeatReward : game.completionSummary, resultStars, rewardNodes);
}

export function createPixiCombatUi({ bridge, parent = bridge.scene }) {
  const fixedPartArt = bridge.presentation?.art ? {textures:bridge.presentation.art,release(){}} : acquireFixedPartThumbnails(bridge.app.renderer);
  const root = new Container();
  root.label = 'shared-pixi-combat-ui';
  root.eventMode = 'static';
  root.hitArea = new Rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  root.zIndex = 20000;
  parent.sortableChildren = true;
  parent.addChild(root);
  const skillCutIn = createPilotSkillCutIn(bridge);
  const skillCutInMount = new Container();
  skillCutInMount.label = 'pilot-skill-cutin-mount';
  skillCutInMount.eventMode = 'none';
  skillCutInMount.object3D.add(skillCutIn.group);
  const refs = {};
  let buttons = [];
  let structureKey = '';
  let lastOfferKey = '';
  let offerRevealAt = 0;
  let menuMotionKey = '';
  let menuRevealAt = 0;
  const collectButtons = (node) => {
    if (node.__pixiUiAction) buttons.push(node);
    for (const child of node.children || []) collectButtons(child);
  };
  const render = () => {
    if(bridge.game.state==='battle-supply')bridge.game.battleSupply?.pickupView?.removeFromParent();
    root.externalStageBackdrop = Boolean(
      bridge.presentation?.fullStagePauseBackdrop && bridge.game.state === 'paused' ||
      bridge.presentation?.fullStageUpgradeBackdrop && bridge.game.state === 'levelup');
    root.removeChildren().forEach((child) => { if (child !== skillCutInMount) child.destroy({ children: true }); });
    buttons = [];
    Object.keys(refs).forEach((key) => delete refs[key]);
    addSharedCombatHud(root, bridge, refs, fixedPartArt.textures);
    if (root.externalStageBackdrop || bridge.presentation?.fullStageResultBackdrop && ['victory_result','fixed_result','defeat_result'].includes(bridge.game.state))
      for (const child of root.children) child.alpha *= .32;
    root.addChild(skillCutInMount);
    const state = bridge.game.state;
    const menuStart = root.children.length;
    // display is immediate; visibility/opacity would inherit the toast's fade.
    if(bridge.ui.toast?.style)bridge.ui.toast.style.display=state==='playing'?'':'none';
    if(state!=='playing'){
      bridge.ui.stageBanner?.classList.remove('visible');
      bridge.ui.toast?.classList.remove('visible');
    }
    if (state === 'dodge-tutorial') {
      addDodgeTutorialUi(root, bridge, refs);
    } else if (state === 'paused') {
      const exiting = bridge.game.pauseMode === 'exit';
      if (!exiting) renderCombatPause(root,bridge,fixedPartArt.textures,{
        surface:addVisualSurface,button:makeCombatButton,backdrop:addCombatBackdrop,
      });
      else addCenteredCombatCard(root, {
        eyebrow: '确认操作',
        title: '退出本局？',
        copy: bridge.presentation?.exitCopy || '本局进度不会保存',
        tint: 0xff6e61,
        danger: true,
        secondaryText: '取消',
        primaryText: '确认退出',
        onSecondary: () => bridge.showPauseMenu(),
        onPrimary: () => bridge.confirmExitRun(),
        bridge, art: fixedPartArt.textures,
      });
    } else if (state === 'revive-prompt') addReviveCombatUi(root, bridge, refs);
    else if (state === 'levelup') addLevelUpCombatUi(root, bridge, fixedPartArt.textures);
    else if (state === 'battle-supply') renderBattleSupply({root,bridge,refs,art:fixedPartArt.textures,
      place,text:makeRawText,button:makeCombatButton,backdrop:addCombatBackdrop,surface:addVisualSurface,symbol:addSymbol});
    else if (['evolving', 'victory_cinematic'].includes(state)) addCinematicCombatUi(root, bridge, refs);
    else if (['victory_result','fixed_result','defeat_result'].includes(state)) addResultCombatUi(root, bridge, fixedPartArt.textures);
    if (state === 'paused') {
      const key = `${state}:${bridge.game.pauseMode}`;
      if (key !== menuMotionKey) menuRevealAt = performance.now();
      menuMotionKey = key;
      // Keep the full-screen backdrop fixed; move the authored PSD surface and
      // controls together so hit testing follows their actual visual position.
      const foreground = root.children.slice(menuStart + 1);
      const mount = new Container();
      mount.label = 'combat-menu-motion';
      mount.alpha = 0;
      for (const child of foreground) mount.addChild(child);
      root.addChild(mount);
      refs.menuMotion = mount;
    } else menuMotionKey = '';
    collectButtons(root);
    if(state==='levelup'){
      const offer=bridge.game.fixedGrowth?.state.offer;
      const key=offer?`${offer.runId}:${offer.offerId}:${offer.buildVersion}`:'';
      if(key&&key!==lastOfferKey){lastOfferKey=key;offerRevealAt=performance.now();}
      if(key)revealChoiceCards(root,offerRevealAt);
    }else lastOfferKey='';
    // The main ticker owns scene rendering; rebuilding HUD must not submit
    // another full world/bloom pass during the same frame.
  };
  const stateKey = () => [
    bridge.game.state,
    bridge.game.victoryReveal ? 'victory-reveal' : '',
    bridge.game.fixedPartsMode ? 'fixed-basic' : 'legacy',
    bridge.game.fixedGrowth?.state.offer?.offerId || '',
    bridge.game.fixedGrowth?.state.focus || '',
    bridge.game.battleSupply?.chestId || '',
    bridge.game.battleSupply?.phase || '',
    bridge.game.pauseMode,
    (bridge.currentUpgradeChoices || []).map((skill) => skill.id).join(','),
    Object.entries(bridge.game.skills || {}).map(([id, level]) => `${id}:${level}`).join(','),
    (bridge.game.activeWeapons || []).map((weapon) => `${weapon.id}:${weapon.level}`).join(','),
    bridge.game.evolutionCurrent?.skill?.id || '',
    bridge.game.completionSummary?.stars || 0,
    bridge.game.victoryRewardDoublePending ? 'victory-ad' : '',
    bridge.game.victoryRewardDoubled ? 'victory-double' : '',
    bridge.game.victoryRewardDoubleNotice ? 'victory-double-notice' : '',
    bridge.game.reviveAdPending ? 'ad' : '',
    ['victory_result','fixed_result','defeat_result'].includes(bridge.game.state) && bridge.presentation?.result
      ? JSON.stringify(bridge.presentation.result) : '',
    bridge.game.upgradeAdAction || '',
  ].join('|');
  const updateDynamic = () => {
    const game = bridge.game;
    const stats = bridge.runStats || {};
    const now = globalThis.performance?.now?.() ?? Date.now();
    if (refs.menuMotion) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const t = reduced ? 1 : Math.min(1, Math.max(0, (now - menuRevealAt) / 260));
      const ease = 1 - (1 - t) ** 3;
      refs.menuMotion.alpha = ease;
      refs.menuMotion.position.y = 10 * (1 - ease);
    }
    updateBattleSupply(refs,game.battleSupply,now,bridge.battleSupplyTick);
    if(!refs.edgeThreatLight){refs.edgeThreatLight=new Graphics();refs.edgeThreatLight.eventMode='none';refs.edgeThreatLight.label='edge-threat-feedback';root.addChild(refs.edgeThreatLight);}
    refs.edgeThreatLight.clear();
    for(const p of edgeThreats(bridge.incomingThreats||[])){
      const dx=Math.cos(p.angle),dy=Math.sin(p.angle),nx=-dy,ny=dx;
      refs.edgeThreatLight.poly([p.x+dx*9,p.y+dy*9,p.x-dx*7+nx*7,p.y-dy*7+ny*7,p.x-dx*7-nx*7,p.y-dy*7-ny*7])
        .fill({color:0xffcc73,alpha:.95}).stroke({color:0x172435,width:2});
    }
    if (refs.dodgeTutorialDemo && !refs.dodgeTutorialDemo.__tutorialDragging) {
      const phase = now / 620;
      refs.dodgeTutorialDemo.position.x = 300 + Math.sin(phase) * 74;
      refs.dodgeTutorialDemo.rotation = Math.cos(phase) * 0.14;
    }
    if (refs.dodgeTutorialAircraft) {
      bridge.updateAssemblyAircraftVisual?.(refs.dodgeTutorialAircraft, now / 1000);
    }
    if (game.state === 'evolving') updateUltimateEvolutionCinematic(refs, game);
    refs.psdHud?.update(now);
    if (refs.revive) refs.revive.text = String(Math.max(0, Math.ceil(game.reviveCountdown || 0)));
  };
  const isActionButtonAt = (button, global) => {
    if (!button?.visible || !button.enabled || !button.__pixiUiAction || !button.hitArea) {
      return false;
    }
    const local = button.toLocal(global);
    return button.hitArea.contains(local.x, local.y);
  };
  const findActionButton = (global) => {
    for (let index = buttons.length - 1; index >= 0; index -= 1) {
      const button = buttons[index];
      if (isActionButtonAt(button, global)) return button;
    }
    return null;
  };
  const dispatchPress = (global, expectedButton = null) => {
    const button = expectedButton || findActionButton(global);
    if (!isActionButtonAt(button, global)) return false;
    button.__pixiUiAction();
    return true;
  };
  let pressOrigin = null;
  let pressTarget = null;
  let pressDragged = false;
  const resetPress = () => {
    pressOrigin = null;
    pressTarget = null;
    pressDragged = false;
  };
  root.on('pointerdown', (event) => {
    pressOrigin = event.global.clone();
    pressTarget = findActionButton(event.global);
    pressDragged = false;
  });
  root.on('globalpointermove', (event) => {
    if (!pressOrigin || pressDragged) return;
    const dx = event.global.x - pressOrigin.x;
    const dy = event.global.y - pressOrigin.y;
    if (Math.hypot(dx, dy) > 12) pressDragged = true;
  });
  root.on('pointertap', (event) => {
    const target = pressTarget;
    if (!pressDragged && target) dispatchPress(event.global, target);
    resetPress();
  });
  root.on('pointerupoutside', resetPress);
  const update = () => {
    root.visible = COMBAT_VISIBLE_STATES.has(bridge.game.state);
    skillCutIn.update();
    if(!root.visible&&bridge.ui.toast?.style)bridge.ui.toast.style.display='';
    if (!root.visible) return;
    const nextKey = stateKey();
    if (nextKey !== structureKey) {
      structureKey = nextKey;
      render();
    }
    updateDynamic();
  };
  const handlePointer = ({ x, y, phase = 'move' }) => {
    if (!root.visible) return false;
    const global = new Point(Number(x) || 0, Number(y) || 0);
    if (bridge.game.state === 'dodge-tutorial') {
      return refs.handleDodgeTutorialTouch?.(global, phase) ?? true;
    }
    const state = bridge.game.state;
    if (phase === 'start') {
      pressOrigin = global.clone();
      pressTarget = findActionButton(global);
      pressDragged = false;
      // A HUD button owns the gesture from the initial touch. This prevents a
      // touch that starts on a button from becoming flight steering.
      return Boolean(pressTarget) || state !== 'playing';
    }
    if (phase === 'move') {
      if (pressOrigin && !pressDragged) {
        const dx = global.x - pressOrigin.x;
        const dy = global.y - pressOrigin.y;
        if (Math.hypot(dx, dy) > 12) pressDragged = true;
      }
      return Boolean(pressTarget) || state !== 'playing';
    }
    const target = pressTarget;
    const pressed = phase !== 'cancel'
      && !pressDragged
      && target
      && dispatchPress(global, target);
    resetPress();
    if (pressed) return true;
    // Modal combat states must never leak their touch to flight steering.
    return state !== 'playing';
  };
  update();
  return {
    root, render, update, dispatchPress, handlePointer,
    flySupplyReward(target) {
      const hero=refs.battleSupplyBoard?.hero;
      if(!hero||hero.destroyed||!root.parent||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
      const mount=root.parent,point=mount.toLocal(hero.toGlobal({x:108,y:108}));
      mount.addChild(hero);hero.pivot.set(108,108);hero.position.set(point.x,point.y);hero.eventMode='none';hero.zIndex=21000;
      hero.label='supply-reward-flight';
      const start=performance.now();
      const frame=now=>{
        if(hero.destroyed)return;
        if(root.destroyed||!['playing','levelup'].includes(bridge.game.state)){hero.destroy({children:true});return;}
        const t=Math.min(1,(now-start)/320),ease=1-(1-t)**3;
        hero.position.set(point.x+(target.x-point.x)*ease,point.y+(target.y-point.y)*ease);
        hero.scale.set(1-.9*ease);hero.alpha=1-t;
        if(t<1)requestAnimationFrame(frame);else hero.destroy({children:true});
      };requestAnimationFrame(frame);
    },
    blocksFlightPointer: (global) => bridge.game.state !== 'playing' || Boolean(findActionButton(global)),
    showPilotSkillCutIn: skillCutIn.show,
    get skillCutInState() { return skillCutIn.state; },
    setScreenShakeCompensation(x = 0, y = 0) {
      root.position.set(Number(x) || 0, Number(y) || 0);
    },
    destroy() {
      skillCutIn.destroy();
      fixedPartArt.release();
      root.removeFromParent();
      root.destroy({ children: true });
    },
  };
}
