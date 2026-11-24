import './scroll-surfaces.css';
import './interface-clarity.css';
import './developer-tools.css';
import './reward-modal-stack.css';
import './psd-empty-slot.css';
import './peripheral-lobby.css';
import './pilot-holo-card.css';
import './peripheral-polish.css';
import './reference-shell-pages.css';
import './peripheral-unified.css';
import './research-page.css';
import './shop-page.css';
import './equipment-page.css';
import './recruit-page.css';
import './peripheral-quality.css';
import './battle-supplemental.css';
import './psd-main-v1.css';
import './character-portraits.css';
import './lobby-command-panels.css';
import './resource-icons.css';
import './peripheral-layout.css';
import './lobby-subpages.css';
import './workshop-scene.css';
import './hangar-subpages.css';
import './card-selection.css';
import './lobby-theme.css';
import './subpage-controls.css';
import './secondary-surfaces.css';
import './lobby-command-skin.css';
import './weapon-equip-controls.css';
import './lobby-chrome.css';
import './lobby-secondary-controls.css';
import './gui-casual-pages.css';
import './gui-casual.css';
import './backpack-panel.css';
import './lobby-paper-panels.css';
import './psd-global-navigation.css';
import './psd-popup.css';
import './equipment-reference.css';
import './original-environments.css';
import './psd-equipment-v1.css';
import './psd-quality-frames.css';
import './psd-controls.css';
import './psd-surface-fixes.css';
import './ui-polish.css';
import './flat-sections.css';
import './player-info.css';
import './aircraft-catalog-refresh.css';
import './psd-titles.css';
import './control-roles.css';
import './psd-page-chrome.css';
import './psd-card-selection.css';
import './small-text.css';

import { createThreeLobbyController } from './three-lobby-controller.js';
import { createCharacterPortraits } from './character-portrait-controller.js';
import { copyDiagnosticReport } from '../diagnostic-log.js';
import { captureFocus, restoreFocus } from './peripheral-focus.js';
import { mountRewardLayers, captureModalScroll, restoreModalScroll } from './reward-modal-stack.js';

export function mountThreeLobby({bridge,parent=document.body,system,deferPortraits=false}={}) {
  if(!bridge)throw new TypeError('mountThreeLobby requires a bridge');
  const root = document.createElement('section'); root.className = 'peripheral-lobby psd-nav-global'; root.id = 'gui-casual-lobby'; root.setAttribute('aria-label', '少女航线指挥部');
  const element=(tag,classes,parent)=>{const node=document.createElement(tag);node.className=classes;parent.append(node);return node;};
  const shell=element('div','pl-shell',root),header=element('header','pl-header',shell),body=element('main','pl-body',shell);
  const nav=element('nav','pl-nav lobby-nav',shell),modalRoot=element('div','pl-modal-host',shell);
  parent.append(root);
  const portraits=createCharacterPortraits(bridge.app.renderer);
  let page=null;
  const presentation={root,modalRoot,inspection:parent,
    portraitPlayer:{...portraits,sync:()=>portraits.sync(body)},
    focus:{capture:captureFocus,restore:restoreFocus,captureScroll:captureModalScroll,restoreScroll:restoreModalScroll,
      body:selector=>body.querySelector(selector),modal:(region,selector)=>region.querySelector(selector),
      active:()=>document.activeElement,hasFocus:()=>root.contains(document.activeElement),
      pageScroll(value){if(value===undefined)return body.scrollTop;body.scrollTop=value;},
      scrollTop(region,value){const content=region.querySelector('.pl-modal-content');if(value===undefined)return content?.scrollTop;if(content)content.scrollTop=value;},
      offerPending(target,text){
        if(target?.tagName==='BUTTON'){target.disabled=true;target.setAttribute('aria-busy','true');}
        const label=target?.querySelector?.('.shop-button-label');if(label)label.textContent=text;
      },
    },
    requestFrame:callback=>window.requestAnimationFrame(callback),cancelFrame:id=>window.cancelAnimationFrame(id),
    hidden:()=>root.hidden||document.hidden,
    retainModal:()=>mountRewardLayers(modalRoot),
    clearModal(region){region.replaceChildren();},
    blockPage(value){for(const node of [header,body,nav])node.inert=value;},
    busy(value,aria){root.classList.toggle('is-busy',value);if(value&&aria)root.setAttribute('aria-busy','true');else root.removeAttribute('aria-busy');},
    setVisible(value){root.hidden=!value;root.setAttribute('aria-hidden',String(!value));},
    bindBack(handler){window.addEventListener('keydown',handler);return ()=>window.removeEventListener('keydown',handler);},
    async copyReport(region){
      const field=region.querySelector('.pl-diagnostic-report'),status=region.querySelector('.pl-diagnostic-status');
      const copied=await copyDiagnosticReport(field);if(status)status.textContent=copied?'已复制':'请手动复制已选中的日志';
    },
    showPage({tab,subpage,nativeHome,nativeMenu,polished}){
      root.classList.add('reference-layout','lobby-theme');
      root.classList.toggle('peripheral-quality',polished);
      root.classList.toggle('equipment-comic',tab==='assembly'&&!subpage);
      root.classList.toggle('equipment-reference',tab==='assembly'&&!subpage);
      root.classList.toggle('battle-psd-main',nativeHome);
      root.classList.toggle('three-menu-active',Boolean(nativeMenu));
      root.classList.toggle('three-home-active',nativeHome);
      root.dataset.tab=tab;root.dataset.subpage=subpage;
      const kind=nativeHome?'home':'menu';
      if(page?.dataset.threePage===kind)return page;
      page=document.createElement('section');page.dataset.threePage=kind;
      page.className=nativeHome?'bc-page psd-main-page':'three-menu-viewport';
      page.setAttribute(nativeHome?'data-three-home-viewport':'data-three-menu','');
      page.setAttribute('aria-label',nativeHome?'主界面':'功能页');body.replaceChildren(page);
      return page;
    },
    close(){root.remove();},
  };
  return createThreeLobbyController({bridge,system,presentation,deferPortraits});
}
