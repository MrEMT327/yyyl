import { Container } from '../three/display.js';
import { TextureLoader, SRGBColorSpace, LinearFilter } from 'three';
import { paintPsdPopup } from './psd-popup-art.js';
import { paintCombatArt } from './combat-art.js';
import { projectIconUrl } from './project-ui-art.js';
import { drawUiSymbol } from './ui-symbols.js';
import { defeatResultModel } from './defeat-result-model.js';
import { upgradeIconLayout } from './upgrade-icon-layout.js';

const textures = new Map();
function icon(surface, url, x, y, width, height) {
  if (!textures.has(url)) {
    const texture = new TextureLoader().load(url);
    texture.colorSpace = SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    texture.userData.inventoryIcon = true;
    textures.set(url, texture);
  }
  const texture = textures.get(url);
  const mesh = surface.image(texture, x, y, width, height);
  let fittedImage;
  mesh.onBeforeRender = () => {
    const image = texture.image;
    if (!image?.width || !image?.height || fittedImage === image) return;
    fittedImage = image;
    const fit = upgradeIconLayout(texture, {x,y,width,height});
    mesh.position.set(fit.x + fit.width / 2, fit.y + fit.height / 2, 0);
    mesh.scale.set(fit.width, -fit.height, 1);
    if (fit.crop) {
      const coordinates = mesh.geometry.attributes.uv, crop = fit.crop;
      for (let index = 0; index < coordinates.count; index++) coordinates.setXY(index,
        crop.x + coordinates.getX(index) * crop.width, 1 - crop.y - (1 - coordinates.getY(index)) * crop.height);
      coordinates.needsUpdate = true;
    }
  };
}

export function renderDefeatResult(root, bridge, {surface, button, backdrop, stars}) {
  const receiptKey = bridge.presentation?.result?.runId || bridge.game.defeatReward;
  if (bridge.ui.defeatReceiptKey !== receiptKey) {
    bridge.ui.defeatReceiptKey = receiptKey;
    bridge.ui.defeatRewardPage = 0;
  }
  const model = defeatResultModel(bridge, bridge.ui.defeatRewardPage);
  backdrop(root, 0x030b13, .9);
  const panel = new Container();
  panel.label = 'battle-defeat-panel';
  panel.resultSnapshot = model;
  root.addChild(panel);
  surface(panel, canvas => {
    paintPsdPopup(canvas, 'primary', 28, 50, 544, 1200);
    icon(canvas, projectIconUrl('nav-battle'), 244, 82, 112, 112);
    paintCombatArt(canvas, 'secondary', 70, 202, 460, 80);
    canvas.text('战斗失败', 300, 243, {size:44, weight:900, align:'center'});
    canvas.text(`第 ${model.chapter} 章`, 300, 331, {size:32, color:'#173449', weight:800, align:'center'});
    paintCombatArt(canvas, 'slot', 234, 364, 132, 132);
    canvas.text(String(model.wave), 300, 420, {size:72, color:'#ffe6a1', weight:900, align:'center'});
    canvas.text('波次', 300, 476, {size:23, color:'#f4faff', weight:800, align:'center'});
    paintCombatArt(canvas, 'card', 62, 566, 476, 62);
    drawUiSymbol(canvas, 'target', 89, 582, 30, '#d8efff');
    canvas.text('击败敌人', 135, 598, {size:27, weight:800});
    canvas.text(String(model.kills), 506, 598, {size:32, weight:900, align:'right', maxWidth:180});
    canvas.text(model.heading, 300, 665, {size:29, color:'#173449', weight:800, align:'center'});
    if (!model.rewards.length) canvas.text(model.empty, 300, 803,
      {size:24, color:'#29465c', align:'center'});
    model.rewards.forEach((row, index) => {
      const columns = Math.min(4, model.rewards.length - Math.floor(index / 4) * 4);
      const left = (600 - (columns * 104 + (columns - 1) * 12)) / 2 + index % 4 * 116;
      const top = 700 + Math.floor(index / 4) * 146;
      paintCombatArt(canvas, 'slot', left, top, 104, 104);
      icon(canvas, row.image, left + 18, top + 9, 68, 64);
      canvas.text(String(row.amount), left + 94, top + 85, {size:26, weight:900, align:'right', maxWidth:88});
      canvas.text(row.label.replace(/图纸$/, ''), left + 52, top + 121, {size:22, color:'#173449', weight:800, align:'center', maxWidth:110});
    });
    if (model.pageCount > 1) canvas.text(`${model.page + 1} / ${model.pageCount}`, 300, 1018,
      {size:21, color:'#173449', align:'center'});
    else if (model.rewards.length) canvas.text(model.note, 300, 965, {size:20, color:'#29465c', align:'center', maxWidth:450});
    if (model.recommendations.length) {
      paintCombatArt(canvas, 'card', 62, 1051, 476, 80);
      canvas.text(model.recommendationTitle, 80, 1091, {size:24, weight:800});
      const spacing = Math.min(110, 300 / model.recommendations.length);
      model.recommendations.forEach((row, index) => {
        const left = 224 + index * spacing;
        icon(canvas, row.image, left, 1054, 60, 52);
        canvas.text(row.name, left + 30, 1116, {size:19, weight:700, align:'center', maxWidth:spacing - 4});
      });
    }
  });
  const rating = stars(model.stars, false, {radius:23, gap:62});
  rating.position.set(300, 531);
  panel.addChild(rating);
  if (model.pageCount > 1) for (const [label, direction, left] of [['‹',-1,164],['›',1,366]]) {
    panel.addChild(button({x:left, y:991, width:70, height:50, text:label, fontSize:30, variant:'secondary',
      disabled: model.page + direction < 0 || model.page + direction >= model.pageCount,
      onPress:() => {bridge.ui.defeatRewardPage = model.page + direction; bridge.pixiCombatUi?.render();}}));
  }
  panel.addChild(button({x:76, y:1154, width:448, height:70, text:model.returnLabel, fontSize:27, variant:'primary',
    onPress:() => {bridge.ui.defeatRewardPage = 0; bridge.finishBattleResult();}}));
}
