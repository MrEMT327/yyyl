import { applyPortraitFraming } from '../ui/portrait-framing.js';
import { createPilotPortraitPlayer } from '../ui/portrait-player-factory.js';
import { PILOT_PORTRAITS } from '../ui/character-portraits.js';
import '../ui/character-portraits.css';
import './style.css';

const base = new URL('../', location.href).href;
const labels = new Map([
  ['idle','待机'],['touch_head','点击互动'],['touch_core','点击互动'],
]);
const titles = {'pilot-07':'07 号 · 双子·露娜（女仆）','pilot-04':'04 号 · 苍弦·伊织','pilot-09':'09 号 · 四象·凛','pilot-01':'01 号 · 夜莺·零','pilot-03':'03 号 · 指挥官','pilot-02':'02 号 · 工程师','pilot-05':'05 号 · 星矛·卡莲','pilot-06':'06 号驾驶员','pilot-08':'08 号 · 三曜·诺娅','pilot-10':'白金 · R13','commander-silver':'银发指挥官'};
const queryPilot = new URLSearchParams(location.search).get('pilot');
let selectedId = titles[queryPilot] ? queryPilot : 'pilot-06';
let player = null, requested = 'idle', closed = false;
const motionLabel = name => selectedId==='pilot-07'&&name==='touch_head' ? '点击互动' : selectedId==='pilot-06'&&name==='touch_head' ? '摆臂互动' : ['commander-silver','pilot-01','pilot-03','pilot-05','pilot-08'].includes(selectedId) && name==='touch_head' ? '点击反馈' : labels.get(name) || name;

document.querySelector('#gm-panel').innerHTML = `
  <header class="preview-header"><a class="back-link" href="${base}?lobby-tab=battle">← 返回主界面</a><span>GM 面板 / 角色动作</span></header>
  <main class="preview-layout">
    <section class="preview-stage" aria-label="角色动作舞台">
      <div class="stage-glow" aria-hidden="true"></div>
      <div class="stage-portrait character-portrait" data-preview-portrait role="button" tabindex="0"></div>
      <div class="stage-caption"><span class="status-dot"></span><span id="stage-status" role="status">正在载入角色…</span></div>
    </section>
    <aside class="preview-panel">
      <label class="gm-portrait-picker">预览角色<select id="pilot-select" aria-label="预览角色"><option value="pilot-06">06 号驾驶员</option><option value="pilot-01">01 号 · 夜莺·零</option><option value="pilot-03">03 号 · 指挥官</option><option value="pilot-02">02 号 · 工程师 ee76</option><option value="pilot-04">04 号 · 苍弦·伊织（蓝马尾）</option><option value="pilot-05">05 号 · 星矛·卡莲</option><option value="pilot-07">07 号 · 双子·露娜（女仆）</option><option value="pilot-08">08 号 · 三曜·诺娅</option><option value="pilot-10">10 号 · 白金 R13</option><option value="pilot-09">09 号 · 四象·凛（紫发医生）</option><option value="commander-silver">银发指挥官 · 候选</option></select></label>
      <div class="panel-heading"><p class="eyebrow">GM · CHARACTER MOTIONS</p><h1><span id="pilot-title"></span><span>动作预览</span></h1><p>点击角色播放反馈，结束后自动返回待机。</p></div>
      <div class="gm-options"><label><input id="show-scene" type="checkbox" checked>显示车辆</label><label><input id="geometry-check" type="checkbox">详细变形检查</label></div>
      <section class="playback" aria-label="播放控制"><div class="playback-title"><strong id="motion-title">待机</strong><span id="motion-time">—</span></div><div class="playback-track"><span id="motion-progress"></span></div><div class="playback-buttons"><button id="pause" class="wc-button" disabled>暂停</button><button id="restart" class="wc-button" disabled>重新播放</button><button id="capture" class="wc-button" disabled>保存静帧</button><a id="capture-download" hidden></a></div></section>
      <div class="motion-heading"><h2>动作</h2><span id="motion-count">载入中</span></div>
      <div class="motion-grid" aria-label="动作列表"></div>
      <p class="preview-note">此处仅显示当前资源包中可播放的动作。游戏内使用待机与摸头反馈。</p>
    </aside>
  </main>`;

document.querySelector('#gm-panel').style.setProperty('--gm-button-image',`url("${base}art/psd-buttons-v1/button-gray.png")`);
const host = document.querySelector('[data-preview-portrait]');
const pause = document.querySelector('#pause');
const picker = document.querySelector('#pilot-select');
const sceneToggle = document.querySelector('#show-scene');
const diagnostics = document.querySelector('#geometry-check');
const grid = document.querySelector('.motion-grid');
const controls = [...document.querySelectorAll('.playback-buttons button')];
const url = path => new URL(path,base).href;
picker.value = selectedId;

function update() {
  if (closed || !player) return;
  const current = player.motionName;
  const name = motionLabel(current);
  document.querySelector('#motion-title').textContent = name;
  document.querySelector('#motion-time').textContent = player.duration ? `${player.currentTime.toFixed(1)} / ${player.duration.toFixed(1)} 秒` : '—';
  document.querySelector('#motion-progress').style.width = `${player.duration ? Math.min(100,player.currentTime/player.duration*100) : 0}%`;
  pause.textContent = player.paused ? '继续' : '暂停';
  document.querySelector('#stage-status').textContent = player.state === 'error' ? '角色载入失败，请重新选择角色重试' : player.ready ? `${name} · ${player.paused?'已暂停':current==='idle'?'循环播放':'单次播放'}` : '正在载入角色…';
  grid.querySelectorAll('button[data-motion]').forEach(button=>{const active=button.dataset.motion===current;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active));});
}

async function selectPilot(id) {
  player?.destroy();
  selectedId=id;requested='idle';
  const config=PILOT_PORTRAITS[id];
  controls.forEach(button=>button.disabled=true);grid.replaceChildren();
  document.querySelector('#motion-count').textContent='载入中';
  document.querySelector('#pilot-title').textContent=id==='pilot-07'?'双子·露娜':id==='pilot-04'?'苍弦·伊织':id==='pilot-09'?'四象·凛':id==='pilot-01'?'夜莺·零':id==='pilot-03'?'指挥官':id==='pilot-08'?'三曜·诺娅':id==='pilot-02'?'工程师':id==='pilot-05'?'卡莲':id==='pilot-10'?'白金':id==='pilot-06'?'06':'银发指挥官';
  document.querySelector('.panel-heading>p:last-child').textContent=id==='pilot-02'?'原待机循环与点击核心独立预览，点击核心结束后停在末帧。':'点击角色播放反馈，结束后自动返回待机。';
  host.setAttribute('aria-label',`${titles[id]}，点击互动`);
  host.dataset.characterPortrait=id;
  applyPortraitFraming(host,id);
  document.querySelector('.preview-stage').classList.toggle('is-transparent-preview',['pilot-07','pilot-09','commander-silver','pilot-01','pilot-03','pilot-02','pilot-04','pilot-05','pilot-06','pilot-08'].includes(id));
  host.innerHTML=`${config.scene?`<img class="character-portrait-scene" src="${url(config.scene)}" alt="" draggable="false" aria-hidden="true">`:''}<img class="character-portrait-fallback" src="${url(config.image)}" alt="" draggable="false" aria-hidden="true">`;
  sceneToggle.disabled=!config.scene;
  sceneToggle.closest('label').hidden=!config.scene;
  diagnostics.disabled=id!=='pilot-10';
  diagnostics.closest('label').hidden=id!=='pilot-10';
  document.querySelector('.preview-note').textContent=id==='pilot-07'?'粉发女仆：保留原版待机和点击时序，点击包含抬手、切换手势、靠近脸部及回落，结束后自动待机。':id==='pilot-04'?'蓝马尾 V15：已按原型网格校准颈部图集；待机与摸头反馈结束后返回待机。':id==='pilot-09'?'紫发医生：已整理额发、帽沿和颈口，保留待机与点击反馈。':id==='pilot-03'?'指挥官原生 Live2D：6 秒待机循环，点击播放 6.167 秒反馈后返回待机。':id==='pilot-02'?'游戏内点击工程师可播放反馈，结束后返回待机。此处独立预览会停在末帧，便于检查动作。':id==='pilot-06'?'待机与摆臂互动，播放结束后返回待机。':id==='pilot-05'?'卡莲 V12：腕部与双肘局部修形、腋下固定材质修复；支持待机、持杯互动及返回待机。':id==='pilot-08'?'当前紫罗兰：脚踝接缝已补齐，保留当前脚型和脚趾；支持待机及点击反馈。':id==='commander-silver'?'角色资源为透明背景，仅提供待机和点击反馈。':'此处仅显示当前资源包中可播放的动作。游戏内使用待机与摸头反馈。';
  const scene=host.querySelector('.character-portrait-scene');if(scene)scene.hidden=!sceneToggle.checked;
  const next=createPilotPortraitPlayer(id,{assetBase:base,geometryDiagnostics:id==='pilot-10'&&diagnostics.checked});
  player=next;update();
  await next.attach(host);
  if(closed||player!==next)return;
  if(next.ready){
    controls.forEach(button=>button.disabled=false);
    const names=['idle',config.feedback].filter((name,index,list)=>name&&list.indexOf(name)===index&&next.availableMotions.includes(name));
    grid.innerHTML=names.map(name=>`<button class="motion-button wc-button" data-motion="${name}" aria-pressed="false"><strong>${motionLabel(name)}</strong><small>${name==='idle'?'待机循环':name==='touch_core'?'播放至末帧':name===config.feedback?'点击反馈':'单次播放'}</small></button>`).join('');
    document.querySelector('#motion-count').textContent=`${names.length} 项`;
  }else document.querySelector('#motion-count').textContent='载入失败';
  update();
}

async function play(name) { if(!player?.ready)return;requested=name;player.setPaused(false);await player.playMotion(name,{returnToIdle:['pilot-07','pilot-09','pilot-01','pilot-03','pilot-04','pilot-05','pilot-08'].includes(selectedId)});update(); }
function feedback() {const motion=PILOT_PORTRAITS[selectedId]?.feedback||PILOT_PORTRAITS[selectedId]?.previewFeedback;if(motion&&player?.ready&&!(player.playing&&player.motionName===motion))void play(motion);}
grid.addEventListener('click',event=>{const button=event.target.closest('button[data-motion]');if(button)void play(button.dataset.motion);});
host.addEventListener('click',feedback);
host.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();feedback();}});
picker.addEventListener('change',()=>void selectPilot(picker.value));
sceneToggle.addEventListener('change',()=>{const scene=host.querySelector('.character-portrait-scene');if(scene)scene.hidden=!sceneToggle.checked;});
diagnostics.addEventListener('change',()=>void selectPilot(selectedId));
pause.addEventListener('click',()=>{player.setPaused(!player.paused);update();});
document.querySelector('#restart').addEventListener('click',()=>void play(requested));

const decodedImage = async src => { const image=new Image();image.src=src;await image.decode();return image; };
document.querySelector('#capture').addEventListener('click',async()=>{
  if(!player?.ready)return;
  const id=selectedId, motion=player.motionName;
  const person=player.captureFrame(2048);
  const scene=host.querySelector('.character-portrait-scene');
  const sceneUrl=scene&&!scene.hidden?scene.src:null;
  try{
    const [portrait,car]=await Promise.all([decodedImage(person),sceneUrl?decodedImage(sceneUrl):null]);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=2048;
    const context=canvas.getContext('2d');if(car)context.drawImage(car,0,0,2048,2048);context.drawImage(portrait,0,0,2048,2048);
    const link=document.querySelector('#capture-download');link.download=`${id}-${motion}.png`;link.href=canvas.toDataURL('image/png');link.click();
  }catch(error){console.warn('静帧导出失败',error);document.querySelector('#stage-status').textContent='静帧导出失败，请重试';}
});

void selectPilot(selectedId);
const timer=setInterval(update,100);
window.addEventListener('pagehide',event=>{if(event.persisted){player?.setVisible(false);return;}closed=true;clearInterval(timer);player?.destroy();});
window.addEventListener('pageshow',()=>player?.setVisible(true));
