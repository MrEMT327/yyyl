import './player-info-showcase.css';
import { equipmentArtPath } from '../replica/equipment-art.js';
import { nativeCollectionArt } from '../replica/native-collection-art.js';
import { aircraftUiImage } from '../aircraft-ui-images.js';
import { rewardDisplayQuality } from '../replica/item-display-quality.js';
import { supplyWeaponArt } from './supply-visuals.js';
import { playerAvatar } from './player-avatar.js';
import { playerInfoModel } from './player-info-model.js';
import { emptySlotMark } from './psd-empty-slot.js';
import { itemInspectAttributes } from './item-description-model.js';
import { gearTypeBadge } from './airframe-equipment-page.js';

const base = import.meta.env?.BASE_URL ?? '/';

export function playerInfoPanel(snapshot, modal, helpers, callsign = '') {
  const { escape, number, img, thumbnail } = helpers;
  const profile = playerInfoModel(snapshot, callsign);
  const empty = emptySlotMark();
  const gearArt = item => img(base + equipmentArtPath(item.art), item.name || '', 'pi-item-art');
  const weaponArt = item => item.nativeRow
    ? img(nativeCollectionArt(item.nativeRow), item.name, 'pi-item-art')
    : supplyWeaponArt(item, thumbnail);
  const aircraftName = profile.aircraft?.aircraftName || profile.aircraft?.name;
  const aircraftArt = img(aircraftUiImage(profile.aircraft?.id, 'equipment'), aircraftName || '当前战机', 'pi-plane');

  function slot(item, art, part) {
    const quality = rewardDisplayQuality({ ...item, type: item?.nativeRow ? 'weapon' : 'gear' });
    const attributes = item ? itemInspectAttributes(item.nativeId ?? item.nativeRow?.id, escape) : '';
    const gearDetails = part
      ? `<span class="pi-slot-level">${item ? `Lv.${number(item.level || 1)}` : '未装配'}</span>
        ${gearTypeBadge(part, helpers, 'pi-equipment-type')}`
      : '';
    return `<div class="pi-slot ${item ? '' : 'is-empty'}" data-psd-quality="${quality.qualityRank}" data-quality-known="${Boolean(item && quality.qualityKnown)}" ${attributes}>
      ${item ? art(item) : empty}
      ${gearDetails}
    </div>`;
  }

  const rename = snapshot.playerRename;
  const renameReady = Boolean(rename && Number.isSafeInteger(rename.cost) && Number.isSafeInteger(rename.revision));
  const renameLabel = renameReady ? (rename.free ? '免费保存' : `保存${number(rename.cost)}钻`) : '改名费用待同步';
  const renameHint = renameReady
    ? (rename.free ? `首次改名免费；之后每次${number(rename.paidCost)}钻石。` : `本次改名消耗 ${number(rename.cost)} 钻石。`)
    : '改名费用待同步，请重新打开。';
  const identityName = modal.editingName
    ? `<div class="pi-rename">
        <label for="player-name">玩家名字</label>
        <input id="player-name" data-player-name value="${escape(modal.nameDraft ?? profile.name)}" maxlength="24" autocomplete="off" spellcheck="false" enterkeyhint="done" aria-describedby="player-name-hint" ${modal.nameError ? 'aria-invalid="true"' : ''}>
        <small id="player-name-hint">${escape(modal.nameError || `2–12 个字符。${renameHint}`)}</small>
        <div>
          <button type="button" class="wc-button" data-action="playerRenameCancel">取消</button>
          <button type="button" class="wc-button" data-action="playerRenameSave" data-rename-revision="${renameReady ? rename.revision : ''}" data-rename-cost="${renameReady ? rename.cost : ''}" data-rename-name="${escape(snapshot.playerName || profile.name)}" ${!renameReady || !rename.canRename ? 'disabled' : ''}>${renameLabel}</button>
        </div>
      </div>`
    : `<h3>${escape(profile.name)}</h3><button type="button" class="wc-button pi-rename-button" data-action="playerRename" aria-label="修改玩家名字">改名</button>`;

  return {
    title: '名片',
    content: `<div class="pi-profile pi-card-layout pi-strict-layout">
      <header class="pi-identity">
        <div class="pi-avatar">${playerAvatar(snapshot, helpers)}</div>
        <div class="pi-identity-copy">
          <small>指挥官${profile.native ? ` · Lv.${number(profile.accountLevel)}` : ''}</small>
          <div class="pi-name-row">${identityName}</div>
          <div class="pi-summary">
            <div class="pi-power"><span>战力</span><b>${Number.isFinite(profile.power) ? number(profile.power) : '—'}</b></div>
            <div class="pi-progress"><small>最高通关</small><strong>${escape(profile.progress)}</strong></div>
          </div>
        </div>
      </header>
      <div class="pi-content">
        <section class="pi-showcase" aria-label="当前装备">
          <img class="pi-showcase-platform" src="${base}art/project-fleet-stage-v2/platform.png" alt="" aria-hidden="true" draggable="false">
          <div class="pi-showcase-plane">${aircraftArt}</div>
          <strong class="pi-showcase-name">${escape(aircraftName || '未选择战机')}</strong>
          <div class="pi-showcase-weapon">${slot(profile.main, weaponArt)}</div>
          <div class="pi-gear-rail" aria-label="已装配装备">${profile.gear.map(({ item, label, type }) => `<div class="pi-gear-position">${slot(item, gearArt, { type, part: label })}</div>`).join('')}</div>
        </section>
      </div>
    </div>`,
  };
}
