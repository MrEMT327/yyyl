import './action-feedback.css';
import { createPowerNotice } from './power-notice.js';
import { walletGains } from './reward-feedback-policy.js';
export { walletGains } from './reward-feedback-policy.js';

// Presentation only: never grants currency, blocks input, or delays an action.
export function createActionFeedback(root) {
  const effects = new Set();
  const powerFrames = new Set();
  let origin = null;
  let sourceBounds = null;
  const powerNotice = createPowerNotice(root);
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const add = (node, duration) => {
    while (effects.size >= 28) effects.values().next().value();
    root.appendChild(node);
    const cleanup = () => { clearTimeout(timer); node.getAnimations().forEach(a=>a.cancel()); node.remove(); effects.delete(cleanup); };
    const timer = setTimeout(cleanup, duration);
    effects.add(cleanup);
    return node;
  };
  return {
    mount(point) {
      if(!point||root.hidden)return;
      const bounds=root.getBoundingClientRect(),node=document.createElement('span');
      node.className='action-equip-glow';node.setAttribute('aria-hidden','true');
      Object.assign(node.style,{left:`${point.x-bounds.left-16}px`,top:`${point.y-bounds.top-16}px`,width:'32px',height:'32px',borderRadius:'50%'});
      add(node,650);
      if(!reduced())node.animate([{scale:'.7',opacity:0},{scale:'1',opacity:1,offset:.3},{scale:'1.2',opacity:0}],{duration:600});
    },
    capture(target) {
      sourceBounds=target.getBoundingClientRect();
      const source = target.dataset.action === 'equipWeapon' ? target.closest('.pl-modal')?.querySelector('img.pl-model-thumb') : null;
      const r = (source || target).getBoundingClientRect();
      origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    wallet(before, after) {
      if (!root.isConnected || root.hidden) return false;
      const gains = walletGains(before, after);
      if (!gains.length) return false;
      // The persistent counter gets one restrained acknowledgement, without
      // flying sprites across a dialog or repeating the receipt at its origin.
      if (!reduced() && !root.querySelector('.pl-modal-host [role="dialog"]')) {
        for (const {type} of gains) root.querySelector(`.lobby-resource.is-${type}`)?.animate(
          [{filter:'brightness(1)'},{filter:'brightness(1.25)',offset:.35},{filter:'brightness(1)'}], {duration:300});
      }
      return true;
    },
    equip(slot) {
      const target = [...root.querySelectorAll('.eq-mount[data-slot], .pl-slot[data-slot]')].find(n => n.dataset.slot === slot);
      if (!target || root.hidden) return;
      const r = target.getBoundingClientRect();
      if (!r.width) return;
      const bounds = root.getBoundingClientRect();
      const art = target.querySelector('img.pl-model-thumb');
      const flight = !reduced() && origin && art;
      if (flight) {
        const sprite = document.createElement('img');
        sprite.src = art.currentSrc || art.src;
        sprite.className = 'action-equipment-flight'; sprite.alt = '';
        sprite.setAttribute('aria-hidden','true');
        const x = r.left + r.width/2, y = r.top + r.height/2;
        sprite.style.left = `${x - bounds.left - 32}px`; sprite.style.top = `${y - bounds.top - 32}px`;
        add(sprite,450);
        sprite.animate([{transform:`translate(${origin.x-x}px,${origin.y-y}px) scale(1.15)`,opacity:1},
          {transform:'translate(0,0) scale(.75)',opacity:1,offset:.85},
          {transform:'translate(0,0) scale(.75)',opacity:0}],{duration:380,easing:'cubic-bezier(.3,.05,.45,1)',fill:'both'});
      }
      const glow = document.createElement('span');
      glow.className = 'action-equip-glow';
      Object.assign(glow.style,{left:`${r.left - bounds.left}px`,top:`${r.top - bounds.top}px`,width:`${r.width}px`,height:`${r.height}px`});
      add(glow,1050);
      glow.animate([{opacity:0},{opacity:1,offset:.2},{opacity:0}],{duration:600,delay:flight?330:0,fill:'both'});
      if (!reduced()) target.animate([{transform:'scale(.97)'},{transform:'scale(1.035)',offset:.45},{transform:'scale(1)'}],{duration:300,delay:flight?330:0});
    },
    failure() {
      if(!sourceBounds||root.hidden||!root.isConnected)return;
      const bounds=root.getBoundingClientRect(),r=sourceBounds,node=document.createElement('span');
      node.className='action-equip-glow';node.setAttribute('aria-hidden','true');
      Object.assign(node.style,{left:`${r.left-bounds.left}px`,top:`${r.top-bounds.top}px`,width:`${r.width}px`,height:`${r.height}px`,borderColor:'#ff967f',boxShadow:'inset 0 0 12px #ff725433'});
      add(node,550);node.animate([{opacity:0},{opacity:1,offset:.2},{opacity:0}],{duration:500});
    },
    // Equip/select handlers finish their navigation after awaiting act(). Show
    // the change on that final surface, not on a dialog about to be removed.
    power(before,after){const frame=requestAnimationFrame(()=>{powerFrames.delete(frame);powerNotice.show(before,after);});powerFrames.add(frame);},
    clear() { for(const frame of powerFrames)cancelAnimationFrame(frame);powerFrames.clear();powerNotice.clear(); for (const cleanup of effects) cleanup(); },
    destroy() { for(const frame of powerFrames)cancelAnimationFrame(frame);powerFrames.clear();powerNotice.destroy(); for (const cleanup of effects) cleanup(); },
  };
}
