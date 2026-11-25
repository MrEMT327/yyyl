import { createPsdCombatHud } from './psd-combat-hud.js';
import { renderCombatPause } from './combat-pause-ui.js';
import { updateReviveCountdown } from './defeat-result-motion.js';
import { renderDefeatResult, updateDefeatResult } from './defeat-result-ui.js';
import { REVIVE_ART } from './revive-panel-art.js';
import { renderRevivePanel, updateReviveTouchTargets, clearRevivePanel } from './revive-panel.js';
import { prefersReducedMotion, revealChoiceCards } from './status-feedback.js';
import { createBattleSupplyArtwork, renderBattleSupply, updateBattleSupply } from './battle-supply-ui.js';
import { Container, Graphics, Point, Rectangle, Text } from '../three/display.js';
import { renderFixedUpgradeUi } from './fixed-upgrade-ui.js';
import { COMBAT_UI, COMBAT_TYPE, combatButtonStyle } from './combat-theme.js';
import { bindCombatButtonArt, paintCombatArt, prepareCombatButtonArt, setCombatArt } from './combat-art.js';
import { paintPsdPopup, preparePsdPopupArt } from './psd-popup-art.js';
import { paintPsdPopupTitle } from './psd-popup-title.js';
import { acquireFixedPartThumbnails } from './fixed-part-thumbnails.js';
import { createThreeSurface } from './three-surface.js';
import { drawUiSymbol } from './ui-symbols.js';
import { createCanvasButtonPress } from './button-press-motion.js';

function addVisualSurface(parent,draw,options){const s=createThreeSurface(options),node=new Container();draw(s);node.object3D.add(s.group);node._disposeVisuals=()=>s.destroy();parent.addChild(node);return node;}
function addSymbol(parent,key,x,y,size=24,tint='#bdd4e2'){return addVisualSurface(parent,s=>drawUiSymbol(s,key,x,y,size,tint));}

const DESIGN_WIDTH = 600;
const DESIGN_HEIGHT = 1300;
// Mobile Safari's visible viewport is often wider than the 600:1300 content
// safe area because its browser chrome changes the usable height. Full-screen
// surfaces bleed horizontally so procedural world graphics cannot show around
// lobby pages, modals or cinematics; interactive content stays in the safe area.
const FULL_BLEED_X = DESIGN_WIDTH;

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
const FONT_FAMILY = COMBAT_TYPE.family;
const TEXT_RESOLUTION = 2;
const UI_FONT_SCALE = 1.08;

function scaledFontSize(size) {
  return Math.max(1, Math.ceil((Number(size) || 1) * UI_FONT_SCALE));
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

function makeRawText(value, {
  size = 18,
  fill = COLORS.white,
  weight = '700',
  family = FONT_FAMILY,
  align = 'left',
  letterSpacing = 0,
  lineHeight = 0,
  maxWidth = 0,
  mipmaps = false,
  anchorX = 0,
  anchorY = 0,
} = {}) {
  const renderedSize = scaledFontSize(size);
  const view = new Text({
    text: String(value),
    resolution: renderedSize <= 24 ? 3 : TEXT_RESOLUTION,
    mipmaps,
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
  button.buttonFaceBounds = button.hitArea;
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

const COMBAT_VISIBLE_STATES = new Set([
  'playing', 'paused', 'levelup', 'battle-supply', 'revive-prompt',
  'victory_result', 'fixed_result', 'defeat_result',
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
  const buttonArt = options.art ?? (options.text ? (options.variant === 'primary' ? 'primary' : 'secondary') : null);
  if (buttonArt) {
    let artwork;
    const skin = addVisualSurface(button,s=>{
      artwork = paintCombatArt(s,options.disabled&&!options.preserveArtOnDisable?'disabled':buttonArt,0,0,options.width,options.height,{corner:options.artCorner});
      if(options.disabled&&options.preserveArtOnDisable)setCombatArt(artwork,'disabled');
    });
    button.setChildIndex(skin,1);
    if (!options.disabled) {
      button.onDown.connect(()=>setCombatArt(artwork,'pressed'));
      button.onUp.connect(()=>setCombatArt(artwork,buttonArt));
      button.onUpOut.connect(()=>setCombatArt(artwork,buttonArt));
    }
    bindCombatButtonArt(button, skin, artwork.material.map);
  }
  return button;
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

export function addCenteredCombatCard(root, {
  eyebrow, title, copy, danger = false,
  secondaryText, primaryText, onSecondary, onPrimary,
}) {
  // Exit confirmation needs only the consequence and two clear choices.
  // Keep the richer loadout summary exclusive to the pause screen.
  if (danger) {
    const height = 264;
    const top = (DESIGN_HEIGHT - height) / 2;
    addCombatBackdrop(root, COMBAT_UI.ink, .78);
    addVisualSurface(root, surface => {
      paintPsdPopup(surface, 'secondary', 54, top, 492, height);
      paintPsdPopupTitle(surface, 'secondary', title, 54, top, 492, height);
    });
    place(root, makeCombatText(copy, 'label', {size:20,fill:0x30465c,anchorX:.5}), 300, top+91);
    const cancel = makeCombatButton({
      x:78,y:top+158,width:216,height:80,text:secondaryText,
      variant:'secondary',art:'secondary',fontSize:24,onPress:onSecondary,
    });
    const confirm = makeCombatButton({
      x:306,y:top+158,width:216,height:80,text:primaryText,
      variant:'primary',art:'primary',fontSize:24,onPress:onPrimary,
    });
    for (const button of [cancel, confirm]) {
      button.prepareButtonArt?.();
      root.addChild(button);
    }
    return;
  }
  const height = 352;
  const top = Math.max(150, (DESIGN_HEIGHT - height) / 2);
  const buttonsY = top + height - 124;
  addCombatBackdrop(root, COMBAT_UI.ink, .84);
  addVisualSurface(root,s=>paintPsdPopup(s,'primary',38,top,524,height));
  // Use the authored PSD title tab instead of a separate yellow banner.
  addVisualSurface(root,s=>paintPsdPopupTitle(s,'primary',eyebrow||title,38,top,524,height));
  addSymbol(root,'pause',486,top+40,26,'#d5e8ef');
  if(copy)place(root, makeRawText(copy, {
    size: 20, fill: 0x30465c, weight: '700', anchorX: 0.5,
  }), 300, top+158);
  root.addChild(makeCombatButton({
    x: 70, y: buttonsY, width: 174, height: 90, text: secondaryText, variant: 'secondary', art: 'secondary',
    fill:0x23394b,pressedFill:0x344f65,
    stroke: 0x718b9c, strokeAlpha: 1, textColor: 0xd5e1e8,
    fontSize: 22, onPress: onSecondary,
  }));
  root.addChild(makeCombatButton({
    x: 256, y: buttonsY, width: 274, height: 90, text: primaryText, variant: 'primary', art: 'primary',
    fill: 0xffd642,pressedFill:0xffe682,
    stroke: 0xffed9c, textColor: 0x152635,
    fontSize: 24, onPress: onPrimary,
  }));
}

function addFixedLevelUpUi(root, bridge, art) {
  renderFixedUpgradeUi({ root, bridge, art, makeText: makeRawText, place,
    makeButton: makeCombatButton, backdrop: addCombatBackdrop });
}

function addReviveCombatUi(root, bridge, refs) {
  renderRevivePanel(root,bridge,refs,{surface:addVisualSurface,button:makeCombatButton,
    text:makeRawText,place,backdrop:addCombatBackdrop});
}

function addResultCombatUi(root, bridge) {
  const victory = bridge.game.state === 'victory_result';
  return renderDefeatResult(root, bridge, {
    surface: addVisualSurface, button: makeCombatButton, victory,
    backdrop(target) {
      if (!bridge.presentation?.fullStageResultBackdrop) addCombatBackdrop(target, 0x12161c, .68);
    },
  });
}
export function createPixiCombatUi({ bridge, parent = bridge.scene }) {
  const reducedMotion=bridge.reducedMotion??prefersReducedMotion;
  // Result and repair artwork load when their screen opens, after sortie assets.
  const fixedPartArt = bridge.presentation?.art ? {textures:bridge.presentation.art,release(){}} : acquireFixedPartThumbnails(bridge.app.renderer);
  const supplyArt = createBattleSupplyArtwork(fixedPartArt.textures, bridge.warmSupplyTexture);
  const root = new Container();
  root.label = 'shared-pixi-combat-ui';
  root.eventMode = 'static';
  root.hitArea = new Rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  root.zIndex = 20000;
  parent.sortableChildren = true;
  parent.addChild(root);
  const refs = {};
  const buttonPress = createCanvasButtonPress();
  let buttons = [];
  const pendingButtonArt = [];
  let structureKey = '';
  let lastOfferKey = '';
  let offerRevealAt = 0;
  let menuMotionKey = '';
  let menuRevealAt = 0;
  let exitArtReady = false;
  const prepareExitArt = () => {
    if (exitArtReady) return true;
    const frame = preparePsdPopupArt('secondary');
    const cancel = prepareCombatButtonArt('secondary');
    const confirm = prepareCombatButtonArt('primary');
    exitArtReady = frame && cancel && confirm;
    return exitArtReady;
  };
  const collectButtons = (node, actionRoot, interactive = false) => {
    if (!node.visible) return;
    if (node.prepareButtonArt) pendingButtonArt.push(node);
    interactive = (interactive || node === actionRoot) && node.eventMode !== 'none';
    if (interactive && node.__pixiUiAction) buttons.push(node);
    for (const child of node.children || []) collectButtons(child, actionRoot, interactive);
  };
  const render = () => {
    const state = bridge.game.state;
    const exiting = state === 'paused' && bridge.game.pauseMode === 'exit';
    // Keep the pause menu usable while the complete exit dialog is prepared.
    if (exiting && !prepareExitArt()) return false;
    let supplyArtwork;
    if(state==='battle-supply'){
      supplyArtwork=supplyArt.open(bridge.game.battleSupply,bridge.game.fixedLoadout?.weapons,performance.now());
      if(!supplyArtwork||supplyArtwork.failed){
        buttonPress.clear();buttons=[];resetPress();
        if(supplyArtwork?.failed)bridge.finishSupplyWithoutArtwork?.(bridge.game.battleSupply);
        return false;
      }
    }else supplyArt.reset();
    buttonPress.clear();
    if(bridge.game.state==='battle-supply')bridge.game.battleSupply?.pickupView?.removeFromParent();
    root.externalStageBackdrop = Boolean(
      bridge.presentation?.fullStagePauseBackdrop && bridge.game.state === 'paused' ||
      bridge.presentation?.fullStageUpgradeBackdrop && bridge.game.state === 'levelup' ||
      bridge.presentation?.fullStageReviveBackdrop && bridge.game.state === 'revive-prompt' ||
      bridge.presentation?.fullStageSupplyBackdrop && bridge.game.state === 'battle-supply');
    root.removeChildren().forEach(child => child.destroy({ children: true }));
    buttons = [];
    pendingButtonArt.length = 0;
    Object.keys(refs).forEach((key) => delete refs[key]);
    refs.psdHud = createPsdCombatHud(root, bridge, flightGradeMeta);
    if (root.externalStageBackdrop || bridge.presentation?.fullStageResultBackdrop && ['victory_result','fixed_result','defeat_result'].includes(bridge.game.state))
      for (const child of root.children) child.alpha *= .32;
    const menuStart = root.children.length;
    if (state === 'paused') {
      if (bridge.game.pauseMode === 'pause') prepareExitArt();
      if (!exiting) renderCombatPause(root,bridge,fixedPartArt.textures,{
        surface:addVisualSurface,button:makeCombatButton,backdrop:addCombatBackdrop,
      });
      else addCenteredCombatCard(root, {
        eyebrow: '确认操作',
        title: '退出本局？',
        copy: bridge.presentation?.exitCopy || '本局进度不会保存',
        danger: true,
        secondaryText: '取消',
        primaryText: '确认退出',
        onSecondary: () => bridge.showPauseMenu(),
        onPrimary: () => bridge.confirmExitRun(),
      });
    } else if (state === 'revive-prompt') addReviveCombatUi(root, bridge, refs);
    else if (state === 'levelup') addFixedLevelUpUi(root, bridge, fixedPartArt.textures);
    else if (state === 'battle-supply') renderBattleSupply({root,bridge,refs,artwork:supplyArtwork,
      place,text:makeRawText,button:makeCombatButton,backdrop:addCombatBackdrop,surface:addVisualSurface});
    else if (['victory_result','fixed_result','defeat_result'].includes(state)) refs.defeatPanel=addResultCombatUi(root, bridge);
    if (state === 'paused') {
      const key = `${state}:${bridge.game.pauseMode}`;
      const secondary = ['detail','settings','stats'].includes(bridge.game.pauseMode);
      const returning = menuMotionKey && key !== menuMotionKey && bridge.game.pauseMode === 'pause';
      const showImmediately = exiting || returning;
      if (key !== menuMotionKey) menuRevealAt = performance.now() - (showImmediately ? 260 : 0);
      menuMotionKey = key;
      // Keep the full-screen backdrop fixed; move the authored PSD surface and
      // controls together so hit testing follows their actual visual position.
      const foreground = root.children.slice(menuStart + 1)
        .filter(child => !secondary || child.label !== 'combat-pause');
      const mount = new Container();
      mount.label = 'combat-menu-motion';
      mount.alpha = showImmediately ? 1 : 0;
      for (const child of foreground) mount.addChild(child);
      root.addChild(mount);
      refs.menuMotion = mount;
    } else menuMotionKey = '';
    const pauseModal = state === 'paused'
      ? refs.menuMotion?.children.find(child => child.label === 'combat-pause-modal') : null;
    collectButtons(root, pauseModal || root);
    if(state==='levelup'){
      const offer=bridge.game.fixedGrowth?.state.offer;
      const key=offer?`${offer.runId}:${offer.offerId}:${offer.buildVersion}`:'';
      if(key&&key!==lastOfferKey){lastOfferKey=key;offerRevealAt=performance.now();}
      if(key)revealChoiceCards(root,offerRevealAt,reducedMotion());
    }else lastOfferKey='';
    // The main ticker owns scene rendering; rebuilding HUD must not submit
    // another full world/bloom pass during the same frame.
    return true;
  };
  const stateKey = () => {
    const { game, presentation } = bridge;
    if (game.state === 'playing') return game.state;
    const growth = game.fixedGrowth?.state;
    const choiceKey = game.state === 'levelup'
      ? growth?.offer?.offerId || (bridge.currentUpgradeChoices || []).map(skill => skill.id).join(',')
      : '';
    return [
      game.state, choiceKey, growth?.focus || '', game.battleSupply?.chestId || '',
      game.battleSupply?.phase || '', game.pauseMode, game.completionSummary?.stars || 0,
      game.reviveAdPending ? 'ad' : '', game.reviveDiamondPending ? 'diamond' : '',
      ['victory_result', 'fixed_result', 'defeat_result'].includes(game.state) && presentation?.result
        ? JSON.stringify(presentation.result) : '',
    ].join('|');
  };
  const updateDynamic = () => {
    const game = bridge.game;
    const now = globalThis.performance?.now?.() ?? Date.now();
    if (refs.menuMotion) {
      const reduced = reducedMotion();
      const t = reduced ? 1 : Math.min(1, Math.max(0, (now - menuRevealAt) / 260));
      const ease = 1 - (1 - t) ** 3;
      refs.menuMotion.alpha = ease;
      refs.menuMotion.position.y = 10 * (1 - ease);
    }
    updateBattleSupply(refs,game.battleSupply,now,bridge.battleSupplyTick);
    updateDefeatResult(refs.defeatPanel,now,bridge);
    if(refs.reviveMotion){
      updateReviveTouchTargets(refs,bridge.app?.renderer?.canvas?.getBoundingClientRect?.().width||600);
      const {panel,start}=refs.reviveMotion;
      const t=reducedMotion()?1:Math.min(1,(now-start)/260);
      const ease=1-(1-t)**3;panel.alpha=ease;panel.position.y=18*(1-ease);
    }
    refs.psdHud?.update(now);
    if(refs.revive)updateReviveCountdown(refs.revive,game.reviveCountdown,now,reducedMotion());
    if(refs.reviveRing){
      const ring=refs.reviveRing;ring.clear();
      const remaining=Math.max(0,Math.min(1,(game.reviveCountdown||0)/5));
      const {countdownX:x,countdownY:y,countdownRadius:r}=REVIVE_ART;
      if(remaining>0)ring.arc(x,y,r,-Math.PI/2,-Math.PI/2+Math.PI*2*remaining).stroke({color:remaining<=.4?0xffbf60:0x80edff,alpha:.8,width:2});
      refs.revive.tint=remaining<=.4?0xffd399:0xffffff;
    }
  };
  const isActionButtonAt = (button, global) => {
    if (!button?.visible || !button.renderable || button.destroyed || !button.parent || button.eventMode==='none' || performance.now()<(button.__choiceReadyAt||0) || !button.enabled || !button.__pixiUiAction || !button.hitArea) {
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
    buttonPress.cancel(pressTarget);
    pressOrigin = event.global.clone();
    pressTarget = findActionButton(event.global);
    pressDragged = false;
    buttonPress.start(pressTarget);
  });
  root.on('globalpointermove', (event) => {
    if (!pressOrigin || pressDragged) return;
    const dx = event.global.x - pressOrigin.x;
    const dy = event.global.y - pressOrigin.y;
    if (Math.hypot(dx, dy) > 12) {
      pressDragged = true;
      buttonPress.cancel(pressTarget);
    }
  });
  root.on('pointertap', (event) => {
    const target = pressTarget;
    if (!pressDragged && target) dispatchPress(event.global, target);
    resetPress();
  });
  root.on('pointerup', event => {
    if (!pressDragged && isActionButtonAt(pressTarget, event.global)) buttonPress.release(pressTarget);
    else buttonPress.cancel(pressTarget);
  });
  root.on('pointerupoutside', () => {
    buttonPress.cancel(pressTarget);
    resetPress();
  });
  const update = () => {
    root.visible = COMBAT_VISIBLE_STATES.has(bridge.game.state);
    if(bridge.game.state!=='revive-prompt')clearRevivePanel(refs);
    if (!root.visible) {supplyArt.reset();buttonPress.clear();structureKey='';return;}
    if(bridge.game.state==='playing'&&bridge.game.elapsed>=1)supplyArt.prewarm();
    const nextKey = stateKey();
    if (nextKey !== structureKey && render()) structureKey = nextKey;
    for (let i = pendingButtonArt.length - 1; i >= 0; i--) {
      if (!pendingButtonArt[i].prepareButtonArt()) continue;
      pendingButtonArt[i] = pendingButtonArt.at(-1);
      pendingButtonArt.pop();
    }
    updateDynamic();
  };
  const handlePointer = ({ x, y, phase = 'move' }) => {
    if (!root.visible) return false;
    const global = new Point(Number(x) || 0, Number(y) || 0);
    const state = bridge.game.state;
    if (phase === 'start') {
      buttonPress.cancel(pressTarget);
      pressOrigin = global.clone();
      pressTarget = findActionButton(global);
      pressDragged = false;
      buttonPress.start(pressTarget);
      // A HUD button owns the gesture from the initial touch. This prevents a
      // touch that starts on a button from becoming flight steering.
      return Boolean(pressTarget) || state !== 'playing';
    }
    if (phase === 'move') {
      if (pressOrigin && !pressDragged) {
        const dx = global.x - pressOrigin.x;
        const dy = global.y - pressOrigin.y;
        if (Math.hypot(dx, dy) > 12) {
          pressDragged = true;
          buttonPress.cancel(pressTarget);
        }
      }
      return Boolean(pressTarget) || state !== 'playing';
    }
    const target = pressTarget;
    if (phase !== 'cancel' && !pressDragged && isActionButtonAt(target, global)) buttonPress.release(target);
    else buttonPress.cancel(target);
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
  // Canvas text is rasterized once. Rebuild a first-open menu after the PSD font
  // arrives so its title cannot remain in the fallback family for that session.
  if(globalThis.document?.fonts&&!document.fonts.check('20px PsdPopup'))
    document.fonts.load('20px PsdPopup').then(()=>{if(!root.destroyed)render();}).catch(()=>{});
  return {
    root, render, update, dispatchPress, handlePointer,
    get battleSupplyVisible(){return Boolean(refs.battleSupplyBoard);},
    showNativeHud(){
      const hud=refs.psdHud;
      return bridge.game.state==='playing'&&root.visible&&root.children.length===1&&root.children[0]===hud?.mount&&hud.showNativeTiles();
    },
    flySupplyReward(target) {
      const hero=refs.battleSupplyBoard?.hero;
      if(!hero||hero.destroyed||!root.parent||reducedMotion())return;
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
    setScreenShakeCompensation(x = 0, y = 0) {
      root.position.set(Number(x) || 0, Number(y) || 0);
    },
    destroy() {
      buttonPress.clear();
      supplyArt.reset();
      fixedPartArt.release();
      root.removeFromParent();
      root.destroy({ children: true });
    },
  };
}
