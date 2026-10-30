import {equipmentArtPath} from '../replica/equipment-art.js';
import * as THREE from 'three';
import { createCanvasAssets, createCanvasSurface } from './canvas-surface.js';
import { aircraftUiImage } from '../aircraft-ui-images.js';
import { portraitPresentation } from './character-portraits.js';
import { weaponIconUrl } from './weapon-icon-source.js';
import { RESOURCE_ICONS } from './resource-icons.js';
import { projectIconUrl } from './project-ui-art.js';
import { researchArt } from './research-art.js';
import { playerInfoModel } from './player-info-model.js';
import { EMPTY_SLOT_ART } from './psd-empty-slot.js';
import { backpackItems } from './backpack-panel.js';
import { BUILD_IDENTITY } from '../build-info.js';
import { loadFighterPackages } from '../three/aircraft/fighter-packages.js';

const W = 750, H = 1624;
const NAV = [['shop','商城'],['assembly','装备'],['battle','战役'],['research','天赋'],['supply','招募']];
const quality = ['gray','green','blue','purple','gold','red'];
const count = value => Number(value || 0).toLocaleString('zh-CN');
const resourceNames = {coins:'金币',diamonds:'钻石',stamina:'体力',aircraftShards:'飞机碎片',weaponParts:'武器零件',cores:'星核'};

// Mini-game UI: cached 2D canvas -> one GPU quad, with a separate inspection
// quad for the real 3D aircraft. Browser HTML/CSS is never parsed or rendered.
export function mountCanvasLobby({ bridge, system, createCanvas = () => globalThis.wx.createCanvas(),
  createImage = () => globalThis.wx.createImage(), resolveAsset = path => path.replace(/^\.?\//, '') } = {}) {
  const renderer = bridge.app.renderer, gpu = renderer.three;
  const canvas = createCanvas(); canvas.width = W; canvas.height = H;
  const hud = createCanvas(); hud.width = 480; hud.height = 210;
  let dirty = true, disposed = false, visible = true, modal = null, subpage = null, tab = 'battle';
  let scroll = 0, maxScroll = 0, lastSnapshot = null, pending = false, gesture = null;
  let toast = '', toastUntil = 0, fighter = null, fighterRequest = 0, inspection = null;
  let lastSample = 0, frames = 0, elapsed = 0, lastTime = 0, fps = 0, calls = 0, triangles = 0;
  let peakCalls = 0, windowCalls = 0, windowTriangles = 0, draws = 0, rasterizations = 0, rasterMs = 0, perfOpen = true, perfDetails = false, viewport = null, layoutKey = '', clockAt = 0;
  const assets = createCanvasAssets({ createImage, resolve: resolveAsset, invalidate: () => { dirty = true; } });
  const surface = createCanvasSurface(canvas, assets), p = surface;
  const scene = new THREE.Scene(), hudScene = new THREE.Scene(), camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
  function quad(source, transparent = false) {
    const texture = source.isTexture ? source : new THREE.CanvasTexture(source);
    texture.colorSpace = THREE.SRGBColorSpace; texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map:texture, transparent,
      toneMapped:false, depthTest:false, depthWrite:false, side:THREE.DoubleSide, forceSinglePass:true }));
    mesh.frustumCulled = false; scene.add(mesh); return mesh;
  }
  const pageQuad = quad(canvas), hudQuad = quad(hud), modelQuad = quad(new THREE.Texture(), true);
  hudScene.add(hudQuad);
  modelQuad.visible = false; modelQuad.renderOrder = 1; hudQuad.renderOrder = 2;
  const snapshot = () => bridge.getPeripheralSnapshot?.() || system.snapshot();
  const open = (type, data = {}) => { modal = { type, ...data }; scroll = 0; stopInspection(); dirty = true; };
  const close = () => { const token=modal?.recruitToken;if (modal?.parent) modal = modal.parent; else modal = null; scroll = 0; dirty = true;if(token)act('fleetRecruitSeen',{token}); };
  function stopInspection() { fighterRequest++; fighter?.setVisible(false); inspection = null; modelQuad.visible = false; }
  function notify(message) { toast = message || ''; toastUntil = performance.now() + 2600; dirty = true; }
  async function act(type, payload = {}) {
    if (pending) return;
    pending = true;
    try {
      const result = await bridge.peripheralAction(type, payload);
      if (result?.ok) {
        if (result.rewards?.length) open('rewards', { rewards:result.rewards, recruitToken:result.recruitToken, parent:modal });
        else if (result.gearResult?.drawn?.length) open('rewards', { rewards:result.gearResult.drawn.map(item => ({ name:item.name || item.part, amount:1 })), parent:modal });
        else if (result.researchResult) open('message', { title:'觉醒结果', message:result.message || '觉醒完成', parent:modal });
      }
      notify(result?.message); lastSnapshot = snapshot();
      return result;
    } catch (error) { console.error('[canvas-ui] action failed', type, error); notify(error.message || '操作失败'); }
    finally { pending = false; dirty = true; }
  }
  function switchTab(id) { stopInspection(); tab = id; subpage = null; modal = null; scroll = 0; dirty = true; }
  function visit(id) { stopInspection(); subpage = id; modal = null; scroll = 0; dirty = true; }
  function resource(type, amount, x, y, size = 31) {
    if (RESOURCE_ICONS[type]) p.image(RESOURCE_ICONS[type].url, x, y - size / 2, size, size);
    p.text(count(amount), x + size + 6, y, 24);
  }
  function button(id, label, x, y, w, action, disabled = false, primary = false, height = 64) {
    p.button(id, label, x, y, w, height, action, disabled || pending, primary);
  }
  function card(item, x, y, width, height, art, select, label = item.name) {
    const rank = Math.min(5, item.qualityRank ?? ({ R:2, SR:3, SSR:4, UR:5 }[item.rarity] || 0));
    p.nine(`art/psd-equipment-v1/frame-${quality[rank]}.png`, x, y, width, height, 24, .65);
    if (!item.owned && item.owned !== undefined) p.ctx.globalAlpha = .55;
    p.image(art, x + 7, y + 8, width - 14, height - 53);
    p.ctx.globalAlpha = 1; p.text(label, x + width / 2, y + height - 29, 21, '#e3eff7', 'center', width - 10);
    if (item.level) p.text(`Lv.${item.level}`, x + 10, y + 23, 20);
    p.hit(`item:${item.uid || item.id}`, x, y, width, height, select);
  }
  function heading(title) { p.rect(0, 100, W, 70, '#294556'); p.text(title, W / 2, 135, 34, '#fff', 'center'); }
  function list(items, draw, columns = 1, rowHeight = 130, top = 205, bottom = 1455) {
    const rows = Math.ceil(items.length / columns); maxScroll = Math.max(0, rows * rowHeight - (bottom - top));
    scroll = Math.max(0, Math.min(scroll, maxScroll));
    p.clipped({x:18,y:top,width:714,height:bottom-top}, () => items.forEach((item, index) => {
      const row = Math.floor(index / columns), y = top + row * rowHeight - scroll;
      if (y + rowHeight < top || y > bottom) return;
      draw(item, index, 22 + index % columns * (710 / columns), y, 710 / columns - 10);
    }));
    if (maxScroll > 0) { p.rect(737, top, 4, bottom - top, '#18313d'); p.rect(737, top + (bottom-top-65)*scroll/maxScroll, 4, 65, '#80bfce'); }
  }
  function header(s) {
    const pilot = portraitPresentation(s.pilots.find(item => item.id === s.pilotId) || {});
    // The home foreground has baked sample identity text. Cover only that
    // sample area before painting the current profile and power.
    p.rect(106,15,173,85,'#263947');
    p.image(pilot.avatar || pilot.image, 22, 24, 78, 78, 'cover');
    p.text(bridge.profileState?.playerName || '指挥官', 112, 43, 25);
    p.text(`战力 ${count(s.power)}`, 112, 78, 21, '#ffe489');
    p.hit('profile', 18, 15, 250, 85, () => open('profile'));
    ['stamina','coins','diamonds'].forEach((key, i) => {
      const x = 285 + i * 153;
      p.nine(`art/psd-main-v1/resources/${key}-background.png`, x, 36, 143, 46, 12, .5);
      p.image(`art/psd-main-v1/resources/${key}-icon.png`, x+3, 38, 32, 40);
      p.text(s.wallet.unlimited ? '9999' : count(s.wallet[key]), x+38, 59, 21);
      p.hit(`wallet:${key}`, x, 30, 142, 55, () => open('wallet', { key }));
    });
  }
  function navigation() {
    NAV.forEach(([id, label], i) => {
      const x = i * 150; p.rect(x, 1474, 150, 150, id === tab ? '#1e3d4b' : '#10232d');
      p.image(`art/psd-main-v1/navigation/${id}.png`, x+35, 1490, 80, 80);
      p.text(label, x+75, 1590, 25, id === tab ? '#fff' : '#abc0cd', 'center');
      p.hit(`tab:${id}`, x, 1474, 150, 150, () => switchTab(id));
    });
  }
  function home(s) {
    p.image('art/psd-main-v1/main-background.png', 0, 0, W, H, 'cover');
    const pilot = portraitPresentation(s.pilots.find(item => item.id === s.pilotId) || {});
    p.image(pilot.image, 86, 234, 598, 1122, 'cover');
    // Omit the baked mail, chapter and activity icons while keeping the scenery beneath them.
    for(const box of [
      {x:0,y:0,width:W,height:239},
      {x:0,y:239,width:635,height:H*.21-239},
      {x:736,y:239,width:W-736,height:H*.21-239},
      {x:W*.16,y:H*.21,width:W*.84,height:347-H*.21},
      {x:W*.16,y:347,width:635-W*.16,height:102},
      {x:736,y:347,width:W-736,height:102},
      {x:W*.16,y:449,width:W*.84,height:H*.28-449},
      {x:0,y:H*.28,width:W,height:H*.72},
    ])
      p.clipped(box,()=>p.image('art/psd-main-v1/main-foreground-current-live-wallet.png',0,0,W,H,'cover'));
    header(s);
    const stage = s.stages[s.selectedStageIndex] || s.stages[0];
    p.text(stage?.chapterName || stage?.name || '蔚蓝海岸', 375, 164, 30, '#fff', 'center', 390);
    p.text(`${stage?.waveCount || 15} 波 · ${stage?.bestCleared ? '已通关' : '待挑战'}`, 375, 204, 23, '#8fe8f8', 'center');
    const targets = [
      ['chapter-prev',136,159,36,55,()=>act('selectStage',{index:Math.max(0,s.selectedStageIndex-1)})],
      ['chapter-next',585,159,36,55,()=>act('selectStage',{index:Math.min(s.stages.length-1,s.selectedStageIndex+1)})],
      ['chapters',175,138,405,80,()=>open('chapters')], ['tasks',6,232,101,102,()=>open('tasks')],
      ['stars',240,239,289,45,()=>open('stars')],
      ['pilot',597,1187,145,147,()=>visit('pilot')], ['patrol',26,1345,182,111,()=>open('patrol')],
      ['backpack',545,1364,182,92,()=>open('backpack')], ['start',224,1341,301,117,()=>act('start')],
    ];
    targets.forEach(([id,x,y,w,h,run])=>p.hit(id,x,y,w,h,run));
  }
  function equipment(s) {
    heading('装备');
    p.image('art/psd-equipment-v1/hangar-scenery.webp', 0, 175, W, 610, 'cover');
    p.image(aircraftUiImage(s.aircraftId,'equipment'), 160, 210, 430, 470);
    [[1,35,245],[2,575,245],[3,35,435],[4,575,435],[5,305,680]].forEach(([type,x,y])=>{
      const item=s.equipment.items.find(row=>row.uid===s.equipment.slots[type]);
      if(item) card(item,x,y,140,152,equipmentArtPath(item.art),()=>open('gear',{id:item.uid}),'Lv.'+item.level);
      else {p.nine('art/psd-equipment-v1/frame-empty.png',x,y,140,152,24,.7);p.image(EMPTY_SLOT_ART,x+52,y+50,36,36);p.hit('slot:'+type,x,y,140,152,()=>open('gearList',{part:type}));}
    });
    [['aircraft','战机'],['pilot','驾驶员'],['weapon','武器'],['workshop','改装间']].forEach(([id,label],i)=>button('catalog:'+id,label,22+i*181,980,164,()=>visit(id)));
    p.text('驾驶员装备',28,1120,29); list(s.equipment.items,(item,i,x,y,w)=>card(item,x,y,w,190,equipmentArtPath(item.art),()=>open('gear',{id:item.uid})),4,200,1160,1455);
  }
  function catalog(s, kind) {
    heading({aircraft:'战机',pilot:'驾驶员',weapon:'武器',workshop:'改装间'}[kind]);
    button('catalog-back','返回装备',24,185,190,()=>visit(null));
    const items = kind==='aircraft'?s.aircraft:kind==='pilot'?s.pilots:kind==='workshop'?s.workshop.items:s.weapons;
    list(items,(item,i,x,y,w)=>{
      const art=kind==='aircraft'?aircraftUiImage(item.id,'thumbnail'):kind==='pilot'?portraitPresentation(item).image:weaponIconUrl(item.id);
      card(item,x,y,w,244,art,()=>open(kind==='workshop'?'weapon':kind,{id:item.id}));
      if(item.stars!==undefined)p.text('★'.repeat(item.stars||0)||'☆',x+10,y+205,22,'#ffd66f');
    },kind==='pilot'?3:4,258,270);
  }
  function shop(s) {
    heading('商城');
    ['basic','advanced'].forEach((pool,i)=>{
      const x=28+i*363;p.nine('art/psd-equipment-v1/frame-blue.png',x,200,332,370,24,.7);
      p.text(pool==='basic'?'基础装备箱':'高级装备箱',x+166,240,29,'#fff','center');
      p.image(projectIconUrl('chest-closed'),x+96,280,140,140);
      const price=pool==='basic'?60:300;
      button('box:'+pool,'开启 ×1',x+18,440,140,()=>act('gearSupply',{pool,count:1,expectedRevision:s.equipment.revision}));
      button('box10:'+pool,'开启 ×10',x+172,440,140,()=>act('gearSupply',{pool,count:10,expectedRevision:s.equipment.revision}));
      p.text(`券 ${s.equipment.keys?.[pool]||0} · ${price} 钻 / 次`,x+166,540,21,'#9dbcca','center');
    });
    if(s.equipment.basicRewardAvailable)button('box-reward','领取累计补给奖励',160,595,430,()=>act('gearClaimBasicReward',{expectedRevision:s.equipment.revision,expectedInventoryRevision:s.nativeAcquisition.revision}),false,true);
    list(s.shop.items,(item,i,x,y,w)=>{
      p.nine('art/psd-equipment-v1/frame-gray.png',x,y,w,238,24,.6);p.text(item.name,x+w/2,y+40,23,'#fff','center',w-20);
      p.text(`剩余 ${item.remaining}`,x+w/2,y+100,22,'#a5bfce','center');
      const price=item.cost.type==='ad'?'观看广告':item.cost.amount?`${count(item.cost.amount)} ${resourceNames[item.cost.type]||''}`:'免费领取';
      button('offer:'+item.id,price,x+12,y+150,w-24,()=>act('shopBuy',{id:item.id,quantity:1}),!item.available);
    },3,250,700);
  }
  function research(s) {
    heading('天赋'); const r=s.research;
    p.text(`星核 ${r.cores}   ·   再觉醒 ${r.untilCore} 次获得星核`,375,230,28,'#b2e7ed','center');
    button('research:normal',r.refineReady?'领取星核':`常规觉醒 · ${count(r.normalCost)} 金币`,38,280,380,()=>act('researchDraw',{pool:'normal',expectedRevision:r.revision}),!r.canNormal);
    button('research:ace','王牌觉醒 · 1 星核',440,280,270,()=>act('researchDraw',{pool:'ace',expectedRevision:r.revision}),!r.canAce,true);
    list(r.cards,(item,i,x,y,w)=>{
      p.nine(`art/psd-equipment-v1/frame-${quality[Math.min(5,item.quality-2)]}.png`,x,y,w,230,24,.6);
      p.image(researchArt(item.icon),x+45,y+30,w-90,115);
      p.text(item.name,x+w/2,y+175,26,'#fff','center');p.text(`Lv.${item.level}/${item.maxLevel}`,x+w/2,y+209,23,'#a6c9d7','center');
      p.hit('tech:'+item.id,x,y,w,230,()=>open('message',{title:item.name,message:[...item.effects,...item.nextEffects].join('\n')}));
    },3,245,405);
  }
  function recruit(s) {
    heading('招募'); const pool=s.pools.find(item=>item.id==='pilot');
    const pilot=portraitPresentation(s.pilots.find(item=>item.id===s.pilotId)||{});
    p.image(pilot.image,80,195,590,850,'cover');p.rect(0,1000,W,450,'#132b38');
    p.text('驾驶员补给',375,1060,38,'#fff','center');p.wrap(pool.guaranteeText,40,1130,670,25);
    button('recruit1',`招募一次 · ${pool.singleCost} 钻`,30,1280,330,()=>act('recruit',{pool:'pilot',count:1}),false,true,92);
    button('recruit10',`招募十次 · ${pool.tenCost} 钻`,390,1280,330,()=>act('recruit',{pool:'pilot',count:10}),false,true,92);
    button('recruit-rules','概率与保底',245,1395,260,()=>open('message',{title:'招募规则',message:pool.rules.join('\n')}));
  }
  function modalList(items, draw, columns=1, rowHeight=125) { list(items,draw,columns,rowHeight,360,1250); }
  function dialog(s) {
    const m=modal;stopInspection();p.rect(0,0,W,H,'rgba(0,6,13,.78)');
    p.nine('art/psd-popup-v1/primary.png',18,220,714,1125,[110,44,55,255],.75);
    const names={tasks:'航线任务',mail:'邮件',activities:'活动',stars:'星级奖励',backpack:'背包',patrol:'航线巡逻',profile:'个人信息',chapters:'章节地图',signin:'每日签到',gear:'装备详情',gearList:'选择装备',weapon:'武器详情',aircraft:'战机',pilot:'驾驶员',skills:'装配技能',rewards:'获得奖励',wallet:'资源补给',inspect:'战机预览'};
    p.text(m.title||names[m.type]||'详情',375,280,34,'#fff','center');button('close','返回',270,1260,210,close);
    if(m.type==='mail')p.text('当前没有邮件',375,610,29,'#b1c8d4','center');
    else if(m.type==='message') { maxScroll=Math.max(0,Math.ceil(String(m.message||'').length/23)*36-830);p.clipped({x:55,y:360,width:640,height:865},()=>p.wrap(m.message,60,390-scroll,625,24,'#c2d5df',100)); }
    else if(m.type==='activities') ['signin','tasks','patrol'].forEach((type,i)=>button('activity:'+type,names[type],130,420+i*150,490,()=>open(type)));
    else if(m.type==='rewards')modalList(m.rewards,(item,i,x,y)=>{p.text(item.name||resourceNames[item.type]||item.type,x+35,y+45,27);p.text('×'+count(item.amount||1),625,y+45,28,'#ffdd81','right');});
    else if(m.type==='chapters')modalList(s.stages,(item,i,x,y,w)=>{p.text(item.chapterName||item.name,x+20,y+35,26,'#fff','left',500);button('stage:'+i,item.bestCleared?'已通关':item.unlocked?'选择':'未解锁',x+w-155,y+50,150,async()=>{const r=await act('selectStage',{index:i});if(r?.ok)close();},!item.unlocked);},1,145);
    else if(m.type==='tasks')modalList(s.tasks,(item,i,x,y,w)=>{p.text(item.name||item.title,x+25,y+30,26);p.wrap(item.description,x+25,y+70,w-190,20,'#a8bfcd',2);button('task:'+item.id,item.claimed?'已领取':'领取',x+w-160,y+45,150,()=>act('claimTask',{id:item.id}),!item.claimable);},1,160);
    else if(m.type==='signin')modalList(s.signIn.days,(item,i,x,y,w)=>{p.text(`第 ${item.day} 天 · ${item.title}`,x+22,y+40,26);button('signin:'+i,item.claimed?'已领取':item.active?'领取':'未到达',x+w-160,y+35,150,()=>act('claimSignIn'),!item.active||!s.signIn.canClaim);});
    else if(m.type==='patrol'){
      p.text(s.patrol.unlocked?`已巡逻 ${s.patrol.storedMinutes} 分钟 / ${s.patrol.capHours} 小时`:'通关第 1 章后开启',375,430,29,'#fff','center');
      p.wrap(Object.entries(s.patrol.rewards).map(([key,value])=>`${resourceNames[key]||key} ×${count(value)}`).join('\n'),100,540,570,27);
      button('claim-patrol','领取巡逻收益',150,850,450,()=>act('claimPatrol'),!s.patrol.unlocked);
      button('quick-patrol',`快速巡逻 · ${s.patrol.quickStamina} 体力`,150,960,450,()=>act('quickPatrol'),!s.patrol.unlocked||!s.patrol.quickLeft);
      button('ad-patrol','观看广告快速巡逻',150,1070,450,()=>act('quickPatrolAd'),!s.patrol.unlocked||!s.patrol.quickAdLeft||!s.patrol.adAvailable);
    } else if(m.type==='backpack')modalList(backpackItems(s),(item,i,x,y,w)=>{if(item.weaponId)p.image(weaponIconUrl(item.weaponId),x+20,y+10,75,90);else if(RESOURCE_ICONS[item.id])p.image(RESOURCE_ICONS[item.id].url,x+20,y+10,75,90);p.text(item.name,x+110,y+35,25);p.text('×'+count(item.count),x+w-30,y+70,27,'#d7edf6','right');p.hit('bag:'+item.id,x,y,w,120,()=>open('message',{title:item.name,message:`数量 ${count(item.count)}\n${item.description}`,parent:m}));});
    else if(m.type==='stars')modalList(s.starRewards.modes.flatMap(mode=>mode.items.map(item=>({...item,mode:mode.id}))),(item,i,x,y,w)=>{p.text(`★ ${item.stars}`,x+25,y+42,29,'#ffdb76');button('stars:'+item.id,item.claimed?'已领取':'领取',x+w-170,y+25,160,()=>act('claimStarReward',{mode:item.mode,id:item.id,expectedRevision:s.starRewards.revision}),!item.claimable);});
    else if(m.type==='profile'){
      const info=playerInfoModel(s,bridge.profileState?.playerName);p.text(info.name,375,405,35,'#fff','center');
      p.wrap(`战力 ${count(info.power)}\n攻击 ${count(info.attack)}\n耐久 ${count(info.hp)}\n航线进度：${info.progress}\n战机：${info.aircraft?.name}\n驾驶员：${info.pilot?.name}`,85,510,600,29);
    } else if(m.type==='wallet')modalList(s.shop.items.filter(item=>item.section===m.key||item.reward[m.key]),(item,i,x,y,w)=>{p.text(item.name,x+25,y+35,27);button('buy:'+item.id,item.cost.type==='ad'?'观看广告':item.cost.amount?`${item.cost.amount} 钻`:'免费领取',x+w-200,y+30,190,()=>act('shopBuy',{id:item.id,quantity:1}),!item.available);});
    else if(m.type==='gearList')modalList(s.equipment.items.filter(item=>item.type===m.part),(item,i,x,y,w)=>card(item,x,y,w,220,equipmentArtPath(item.art),()=>open('gear',{id:item.uid})),3,240);
    else if(m.type==='gear')gearDialog(s,m);
    else if(m.type==='aircraft'||m.type==='pilot')fleetDialog(s,m);
    else if(m.type==='weapon')weaponDialog(s,m);
    else if(m.type==='skills')modalList(s.fleet[m.kind].skills,(item,i,x,y,w)=>{p.text(item.name,x+22,y+30,28);p.wrap(item.description,x+22,y+75,w-210,21,'#b1cbd8',2);button('skill:'+item.id,item.slot>=0?'卸下':'装配',x+w-170,y+50,160,()=>act(item.slot>=0?'fleetSkillRemove':'fleetSkillEquip',{kind:m.kind,id:item.id,slot:item.slot>=0?item.slot:m.slot,expectedRevision:s.fleet.revision}),!item.owned);},1,180);
  }
  function gearDialog(s,m) {
    const item=s.equipment.items.find(row=>row.uid===m.id);if(!item){p.text('装备已变化，请返回',375,550,28,'#fff','center');return;}
    p.image(equipmentArtPath(item.art),265,360,220,220);p.text(item.name,375,625,32,'#fff','center');
    p.text(`${item.qualityName} · Lv.${item.level} · 可强化至${item.maxLevel}`,375,680,27,'#ffd67a','center');
    p.text(`${item.attributeName} ${count(item.attribute)}${item.nextAttribute!=null?' → '+count(item.nextAttribute):''}`,375,745,28,'#bce4e7','center');
    const args={id:item.uid,expectedRevision:s.equipment.revision};
    button('gear-equip',item.equipped?'卸下':'装备',70,840,280,()=>act(item.equipped?'gearUnequip':'gearEquip',args));
    button('gear-upgrade','强化',400,840,280,()=>act('gearUpgrade',args),!item.canUpgrade,true);
    button('gear-lock',item.locked?'解锁装备':'锁定装备',70,945,280,()=>act('gearLock',args));
    button('gear-merge',item.merge.available&&item.merge.autoAvailable===false?'需手动选材':'合成',400,945,280,()=>act('gearMerge',{...args,materialIds:item.merge.defaultIds,tokens:item.merge.defaultTokens}),!(item.merge.autoAvailable??item.merge.available));
    if(item.canDowngrade)button('gear-downgrade','预览降阶',200,1060,350,async()=>{const r=await act('gearPreview',{...args,operation:'downgrade'});if(r?.ok)open('confirm',{title:'确认降阶',message:'降阶将按配方返还材料。',run:()=>act('gearDowngrade',args),parent:m});});
  }
  function fleetDialog(s,m) {
    const item=(m.type==='pilot'?s.pilots:s.aircraft).find(row=>row.id===m.id);if(!item)return;
    p.image(m.type==='pilot'?portraitPresentation(item).image:aircraftUiImage(item.id),130,350,490,470);
    p.text(item.name,375,860,35,'#fff','center');p.text(`★ ${item.stars||0}/5 · 同名卡 ${item.copies||0}`,375,915,25,'#ffdc8d','center');
    const args={kind:m.type,id:item.id,expectedRevision:s.fleet.revision};
    button('fleet-select',item.owned?'出战':'激活',60,990,280,()=>act(item.owned?(m.type==='pilot'?'selectPilot':'selectAircraft'):'fleetActivate',item.owned?{id:item.id}:args),!item.owned&&!item.copies,true);
    button('fleet-star','升星',410,990,280,()=>act('fleetStarUp',args),!item.owned||!item.copies||item.stars>=5);
    button('fleet-skill','装配技能',60,1100,280,()=>open('skills',{kind:m.type,slot:Math.max(0,s.fleet[m.type].slots.findIndex(id=>!id))}));
    if(m.type==='aircraft')button('fleet-upgrade','基础强化',410,1100,280,()=>act('upgradeAircraft',{id:item.id}),!item.canUpgrade);
  }
  function weaponDialog(s,m) {
    const item=s.weapons.find(row=>row.id===m.id);if(!item)return;
    p.image(weaponIconUrl(item.id),245,360,260,250);p.text(item.name,375,660,35,'#fff','center');p.wrap(item.description,65,730,620,24);
    button('weapon-upgrade','强化',65,930,280,()=>act('upgradeWeapon',{id:item.id}),!item.canUpgrade,true);
    const craft=s.workshop.items.find(row=>row.id===item.id);
    button('weapon-synthesize','升品',405,930,280,()=>act('synthesizeWeapon',{id:item.id}),!craft?.canSynthesize);
    ['W3','W4','W5','W6'].forEach((slot,i)=>button('weapon-slot:'+slot,`${slot} ${s.loadout[slot]===item.id?'卸下':'装配'}`,55+i*175,1060,165,()=>act('equipWeapon',{slot,weaponId:s.loadout[slot]===item.id?null:item.id,expectedToken:s.loadoutToken}),!item.owned));
  }
  function rasterize() {
    const started=performance.now();
    const s=lastSnapshot=snapshot();
    if(!modal&&s.fleet.recruitPresentation){const receipt=s.fleet.recruitPresentation;modal={type:'rewards',rewards:receipt.rewards||[],recruitToken:receipt.token};}
    p.clear();p.rect(0,0,W,H,'#102632');maxScroll=0;
    if(tab==='battle'&&!subpage)home(s);else {header(s);if(subpage)catalog(s,subpage);else if(tab==='assembly')equipment(s);else if(tab==='shop')shop(s);else if(tab==='research')research(s);else recruit(s);}
    navigation();if(modal)dialog(s);
    if(modal?.type==='confirm'){p.wrap(modal.message,70,450,610,28);button('confirm','确认',225,900,300,modal.run,false,true);}
    if(toast){p.rect(40,1385,670,63,'rgba(4,14,22,.96)');p.text(toast,375,1416,23,'#e9f5fc','center',640);}
    p.text(`v${BUILD_IDENTITY.version} · ${BUILD_IDENTITY.label}`,W/2,1460,20,'#a7bdc7','center');
    pageQuad.material.map.needsUpdate=true;rasterizations++;rasterMs=performance.now()-started;dirty=false;
  }
  async function inspect(id) {
    stopInspection();modal=null;inspection={id,x:90,y:200,width:570,height:650};dirty=true;
    const request=++fighterRequest;
    try {
      await loadFighterPackages({pilotIds:[id]});const {createSortieFighter}=await import('./sortie-fighter.js');
      if(disposed||request!==fighterRequest)return;
      if(!fighter)fighter=createSortieFighter({renderer,pilotId:id,appearance:bridge.getAssemblyAppearance?.()});
      else fighter.setPilot(id,bridge.getAssemblyAppearance?.());
      modelQuad.material.map=fighter.texture;modelQuad.visible=true;fighter.setVisible(true);dirty=true;
    } catch(error){stopInspection();notify(error.message||'战机资源加载失败');}
  }
  function layout() {
    const width=renderer.screen.width,height=renderer.screen.height;
    const side=perfOpen&&width>=height*.72, gutter=perfOpen?(side?Math.min(265,width*.29):Math.min(perfDetails?140:90,height*.19)):0;
    const safe=globalThis.wx?.getWindowInfo?.().safeArea;
    const top=Math.max(side?0:gutter,safe?.top||0),bottom=Math.max(0,height-(safe?.bottom??height));
    const area={x:0,y:top,width:width-(side?gutter:0),height:height-top-bottom};
    const scale=Math.min(area.width/W,area.height/H);viewport={x:area.x+(area.width-W*scale)/2,y:area.y+(area.height-H*scale)/2,width:W*scale,height:H*scale,scale};
    camera.left=0;camera.right=width;camera.top=0;camera.bottom=height;camera.updateProjectionMatrix();
    function place(mesh,x,y,w,h){mesh.position.set(x+w/2,y+h/2,0);mesh.scale.set(w,-h,1);}
    place(pageQuad,viewport.x,viewport.y,viewport.width,viewport.height);
    hudQuad.visible=perfOpen;if(perfOpen){const hw=side?gutter:width,hh=side?gutter*210/480:gutter;place(hudQuad,side?width-gutter:0,0,hw,hh);
      const pixelWidth=Math.max(1,Math.round(hw*2)),pixelHeight=Math.max(1,Math.round(hh*2));if(hud.width!==pixelWidth||hud.height!==pixelHeight){hud.width=pixelWidth;hud.height=pixelHeight;lastSample=-Infinity;}}
    if(inspection&&fighter){place(modelQuad,viewport.x+inspection.x*scale,viewport.y+inspection.y*scale,inspection.width*scale,inspection.height*scale);}
    const key=[width,height,top,bottom,side?gutter:0].join(':');
    if(key!==layoutKey){layoutKey=key;renderer.nativeUiInsets={top,bottom,right:side?gutter:0};bridge.resizeScene?.();}
  }
  function paintMetrics(time) {
    const ctx=hud.getContext('2d'),w=hud.width/2,h=hud.height/2;ctx.setTransform(2,0,0,2,0,0);ctx.fillStyle='#0c202d';ctx.fillRect(0,0,w,h);ctx.textBaseline='middle';ctx.textAlign='left';
    ctx.fillStyle='#8de6f5';ctx.font='600 12px sans-serif';ctx.fillText('性能 · Canvas',10,13);
    ctx.fillStyle='#fff';ctx.font='600 16px monospace';ctx.fillText(`FPS ${fps}`,10,h*.38);ctx.fillText(`Draw Call ${windowCalls}`,w/2,h*.38);
    ctx.fillText(`三角面 ${count(windowTriangles)}`,10,h*.65);ctx.fillText(`${fps?(1000/fps).toFixed(1):'—'} ms`,w/2,h*.65);
    ctx.font='10px sans-serif';ctx.fillStyle='#a9c4d4';ctx.fillText(perfDetails?`UI ${rasterMs.toFixed(2)} ms · 缓存 ${assets.size} 图`:'绘制数为最近 0.5 秒内的帧峰值',10,h-10);
    windowCalls=windowTriangles=0;
    hudQuad.material.map.needsUpdate=true;lastSample=time;
  }
  const previousMenuPass=renderer.menuPass;
  function sampleFrame(time){draws++;if(lastTime){frames++;elapsed+=time-lastTime;}lastTime=time;
    if(elapsed>=500){fps=Math.round(frames*1000/elapsed);frames=0;elapsed=0;}
    calls=gpu.info.render.calls;triangles=gpu.info.render.triangles;peakCalls=Math.max(peakCalls,calls);windowCalls=Math.max(windowCalls,calls);windowTriangles=Math.max(windowTriangles,triangles);
  }
  function drawHud(time){if(time-lastSample>=500)paintMetrics(time);if(perfOpen)gpu.render(hudScene,camera);}
  function renderMenu() {
    if(!visible||disposed)return false;
    const time=performance.now();if(toast&&time>toastUntil){toast='';dirty=true;}
    if(dirty)rasterize();layout();
    gpu.info.reset();gpu.setRenderTarget(null);gpu.setScissorTest(false);gpu.setViewport(0,0,renderer.screen.width,renderer.screen.height);gpu.setClearColor(0x040d13,1);gpu.clear();
    if(inspection&&fighter){fighter.update(lastTime?Math.min(.05,(time-lastTime)/1000):1/60);for(const pass of renderer.screenPasses)pass(gpu);}
    gpu.render(scene,camera);drawHud(time);sampleFrame(time);return true;
  }
  renderer.menuPass=renderMenu;
  function combatOverlay(){if(visible||disposed)return;const time=performance.now();layout();drawHud(time);sampleFrame(time);}
  renderer.screenOverlays.add(combatOverlay);
  function handlePointer({x,y,phase='move',pointerId=1}) {
    if(disposed)return false;layout();
    const point={x:(x-viewport.x)/viewport.scale,y:(y-viewport.y)/viewport.scale};
    if(perfOpen&&(point.x<0||point.y<0||point.x>W||point.y>H)) {if(phase==='start'){perfDetails=!perfDetails;lastSample=-Infinity;dirty=true;}return true;}
    if(!visible)return false;
    if(phase==='start'){
      gesture={pointerId,start:point,previous:point,target:p.find(point.x,point.y),dragged:false,inspection:inspection&&point.x>=inspection.x&&point.x<=inspection.x+inspection.width&&point.y>=inspection.y&&point.y<=inspection.y+inspection.height};
    }else if(gesture?.pointerId===pointerId){
      if(phase==='move'){
        const dy=point.y-gesture.previous.y,dx=point.x-gesture.previous.x;gesture.dragged||=Math.hypot(point.x-gesture.start.x,point.y-gesture.start.y)>12;
        if(gesture.inspection)fighter?.rotate(dx,dy);else if(gesture.dragged&&maxScroll>0){scroll=Math.max(0,Math.min(maxScroll,scroll-dy));dirty=true;}
        gesture.previous=point;
      }else if(phase==='end'||phase==='cancel'){
        const press=gesture;gesture=null;if(phase==='end'&&!press.dragged&&press.target?.onPress&&press.target.id===p.find(point.x,point.y)?.id){bridge.playUiClick?.();press.target.onPress();}
      }
    }
    return true;
  }
  const events={pointerdown:'start',pointermove:'move',pointerup:'end',pointercancel:'cancel'};
  function onPointer(event){const bounds=bridge.app.canvas.getBoundingClientRect();handlePointer({x:(event.clientX-bounds.left)*renderer.screen.width/bounds.width,y:(event.clientY-bounds.top)*renderer.screen.height/bounds.height,phase:events[event.type],pointerId:event.pointerId});}
  if(bridge.platformKind!=='wechat')for(const type of Object.keys(events))bridge.app.canvas.addEventListener?.(type,onPointer);
  return {render(){dirty=true;},refresh(){dirty=true;},switchTab,visit,open,close,inspect,handlePointer,
    setVisible(value){visible=Boolean(value);if(!visible){gesture=null;fighter?.setVisible(false);lastTime=0;}else{dirty=true;fighter?.setVisible(Boolean(inspection));}},
    update(){const next=['menu','gameover','victory'].includes(bridge.game.state);if(next!==visible){visible=next;dirty=true;if(!visible)stopInspection();}
      const time=performance.now();if(visible&&time-clockAt>30000){clockAt=time;dirty=true;}},
    get state(){return {visible,tab,subpage,modal:modal?.type||null,pending,renderer:'canvas',rasterizations,assetCount:assets.size,viewport,inspection:inspection?{id:inspection.id,ready:Boolean(fighter&&modelQuad.visible)}:null};},
    get controls(){return p.controls.map(({id,x,y,width,height,disabled})=>({id,x,y,width,height,disabled}));},
    get stats(){return {fps,calls,triangles,peakCalls,draws,rasterizations,rasterMs,textures:gpu.info.memory.textures};},
    exportPerformance(){const report={identity:BUILD_IDENTITY,platform:bridge.platformKind,ui:this.state,rendering:this.stats};console.info('[performance]',JSON.stringify(report));return report;},
    destroy(){disposed=true;stopInspection();fighter?.destroy();assets.destroy();renderer.screenOverlays.delete(combatOverlay);delete renderer.nativeUiInsets;bridge.resizeScene?.();if(renderer.menuPass===renderMenu)renderer.menuPass=previousMenuPass;
      for(const type of Object.keys(events))bridge.app.canvas.removeEventListener?.(type,onPointer);
      for(const mesh of [pageQuad,hudQuad,modelQuad]){mesh.geometry.dispose();if(mesh!==modelQuad)mesh.material.map.dispose();mesh.material.dispose();}scene.clear();},
  };
}
