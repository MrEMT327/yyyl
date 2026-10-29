import { CAMPAIGN as SOURCE_CAMPAIGN } from '../campaign.js';
import { tuneMainlineCampaign } from '../peripheral/balance-tuning.js';
import { DIFFICULTIES, estimateStagePower, ratePowerReadiness } from '../balance.js';
import { createMobileUI, renderMobileHeader, renderMobileNav } from './mobile-lobby-chrome.js';
import { renderAircraftBackdrop } from './aircraft-backdrop.js';

const GOLD = '#ffcb70', WHITE = '#f7f7f3', INK = '#25313e';
const CAMPAIGN = tuneMainlineCampaign(SOURCE_CAMPAIGN);
const fmt = value => Math.max(0,Math.round(Number(value)||0)).toLocaleString('en-US');

// Mobile game composition: a full-screen hangar, floating utility entries,
// compact chapter controls and a single dominant launch action.
export function renderSortieLayout({ surface, bridge, art, fighter, actions, launch }) {
  const { text, quad, panel, polygon, image, button } = surface;
  const pilot = bridge.getActivePilot(), index = bridge.selectedStageIndex, stage = CAMPAIGN[index];
  const difficulty = DIFFICULTIES.find(d=>d.id===bridge.selectedDifficultyId)||DIFFICULTIES[0];
  const result = bridge.getDifficultyResult(index,difficulty.id), power = bridge.profilePower();
  const estimate = estimateStagePower(stage,difficulty.id), readiness = ratePowerReadiness(power,estimate.recommendedPower);
  const unlocked = bridge.isStageUnlocked(index) && bridge.isDifficultyUnlocked(index,difficulty.id);
  const texture = id => art.get(id);
  const ui=createMobileUI(surface,bridge,art,actions);
  const {action,plate,gameIcon,coin,diamond,symbol}=ui;
  function star(x,y,earned,size=9) {
    polygon(Array.from({length:10},(_,i)=>{const a=i*Math.PI/5-Math.PI/2,r=i%2?size*.44:size;return [x+Math.cos(a)*r,y+Math.sin(a)*r];}),earned?GOLD:'#62707f');
  }
  function arrow(x,y,direction,color=INK,size=8) {
    polygon([[x-direction*size*.6,y-size],[x+direction*size*.6,y],[x-direction*size*.6,y+size]],color);
  }

  renderAircraftBackdrop(surface,texture('background'));
  plate(0,0,600,128,'#111a29','#253045',0,.68);
  // Fade the deck into the controls without a rectangular content frame.
  for(let i=0;i<12;i++)quad(0,640+i*47,600,48,'#101a2a',.03+i*.071);

  renderMobileHeader(ui,bridge,art,actions);
  action('fighter-orbit','拖动旋转战机',0,245,600,453,()=>{});

  // Illustrated utilities sit on the scene; they do not each need a card.
  if(texture('daily'))image(texture('daily'),19,147,90,72);
  plate(20,209,90,28,'#18263a','#101b2b',5,.91);
  text('签到',65,223,{size:17,weight:700,align:'center'});
  if(bridge.getDailyLoginSnapshot().canClaimToday)plate(97,150,12,12,'#ff9b68','#f0523e',6);
  action('daily-login','七日签到',16,140,98,104,actions.dailyLogin);
  if(bridge.leaderboardEnabled!==false) {
    gameIcon('rank',24,270,80,80);
    plate(20,346,90,28,'#18263a','#101b2b',5,.91);
    text('排行榜',65,360,{size:17,weight:700,align:'center'});
    action('leaderboard','排行榜',16,265,98,116,actions.leaderboard);
  }
  if(bridge.debugToolsEnabled) {
    action('debug','调试页面',515,134,65,48,actions.debug,{fill:'#19283b',radius:22,opacity:.65});
    text('调试',548,158,{size:16,color:'#ccd4de',align:'center'});
  }

  // The aircraft is the main illustration, not a thumbnail inside a card.
  image(fighter.texture,-78,215,780,546).material.toneMapped=true;
  symbol('rotate',27,672,25,'#aec0ce');
  action('fighter-home','战机视角复位',463,663,113,38,()=>fighter.resetView(),{fill:'#304559',bottomColor:'#203346',opacity:.95,radius:7});
  symbol('rotate',507,669,26,'#d9e5ec');
  plate(26,710,47,25,'#e8c883','#b99455',3);
  text(pilot.rarity,50,723,{size:14,color:INK,weight:800,align:'center'});
  symbol('check',85,713,20,'#e8c883');
  text(pilot.aircraft||pilot.name,26,762,{size:29,weight:800,maxWidth:403});
  symbol('power',551,706,23,'#ffcb70');
  text(fmt(power),575,752,{size:32,weight:800,color:WHITE,align:'right'});

  // A single compact chapter selector, visually distinct from the action.
  plate(24,806,552,112,'#f4f4ef','#ccd6dc',10);
  plate(85,824,2,74,'#b9c4cd');
  text(String(index+1).padStart(2,'0'),127,854,{size:41,color:'#6a7c8b',weight:800,align:'center'});
  text(stage.name,173,840,{size:30,color:INK,weight:800,maxWidth:320});
  text(stage.title,174,882,{size:19,color:'#667785',maxWidth:290});
  text(`${index+1}/${CAMPAIGN.length}`,502,844,{size:15,color:'#7a8996',align:'right'});
  symbol('grid',478,871,23,'#5e7388');
  arrow(53,863,-1,index===0?'#a4b0bb':INK,10);arrow(547,863,1,index===CAMPAIGN.length-1?'#a4b0bb':INK,10);
  action('stage-prev','上一章',24,806,61,112,()=>actions.stage(index-1),{disabled:index===0});
  action('stage-details','全部关卡',86,806,429,112,actions.stageDetails);
  action('stage-next','下一章',516,806,60,112,()=>actions.stage(index+1),{disabled:index===CAMPAIGN.length-1});

  plate(24,934,552,55,'#152031','#152031',7);
  DIFFICULTIES.forEach((mode,i)=>{
    const x=24+i*184,selected=difficulty.id===mode.id,available=bridge.isDifficultyUnlocked(index,mode.id);
    action(`difficulty-${mode.id}`,mode.label,x+2,936,180,51,()=>actions.difficulty(mode.id),{
      disabled:!available,fill:selected?'#d9e2e6':'#182539',bottomColor:selected?'#adbdc9':'#182539',radius:6,opacity:1,
    });
    text(mode.label,x+92,961,{size:22,color:selected?INK:available?'#dce8f1':'#8797aa',weight:800,align:'center'});
    if(!available)symbol('lock',x+144,950,21,'#8797aa');
  });
  bridge.starGoalDefinitions(difficulty.id).forEach((goal,i)=>{
    const x=26+i*185,earned=Number.isInteger(result.starMask)&&Boolean(result.starMask&(1<<i));
    star(x+11,1017,earned);
    text(goal.short,x+30,1017,{size:17,color:'#b8c8d7'});
    text(earned?'已达成':'通关时判定',x+29,1042,{size:17,color:earned?GOLD:'#8fb0c2'});
  });

  plate(24,1080,552,103,unlocked?'#a45122':'#273443',undefined,11);
  action('launch','开始出击',24,1073,552,103,launch,{
    disabled:!unlocked,fill:unlocked?'#ffe0a0':'#657585',bottomColor:unlocked?'#f5a64b':'#465565',opacity:1,radius:10,
  });
  text(unlocked?'出击':'未解锁',280,1111,{size:43,color:unlocked?'#57351f':'#c9d3dc',weight:900,align:'center'});
  if(unlocked){symbol('power',212,1142,19,'#986338');text(`建议 ${fmt(estimate.recommendedPower)}`,242,1152,{size:16,color:'#986338'});}
  else symbol('lock',263,1138,27,'#a7b7c6');
  arrow(527,1123,1,unlocked?'#98602b':'#9cabb9',12);

  renderMobileNav(ui,actions,'battle');
}
