// Presentation follows an already committed receipt; it never rolls or pays.
// ShowCard / TweenEnd / Thunder event times from the five UI_CardDraw clips.
// Art is original; these timings are source evidence, not a runtime recording.
export const RESEARCH_DRAW_TIMINGS = Object.freeze([
  {reveal:1950,settle:567,pulses:[]},
  {reveal:2067,settle:500,pulses:[]},
  {reveal:2867,settle:650,pulses:[1417]},
  {reveal:3333,settle:550,pulses:[1433,1817]},
  {reveal:3717,settle:533,pulses:[1433,1817,2183]},
]);
export function drawPresentationPlan(receipt, snapshot) {
  if (receipt?.type === 'researchResult' && receipt.result?.cardId) {
    const card=snapshot.research?.cards.find(c=>c.id===receipt.result.cardId);
    if (!card) return null;
    return {kind:'research',title:receipt.result.previousLevel?'科技升级':'科技觉醒',entries:[{index:0,rank:Math.max(0,card.quality-2),isNew:!receipt.result.previousLevel}],featured:[0]};
  }
  if (receipt?.type !== 'rewards' || !(receipt.recruit || ['pilot','weapon'].includes(receipt.recruitPool))) return null;
  const entries=(receipt.rewards||[]).map((reward,index)=>{
    const pilot=snapshot.pilots?.find(p=>p.id===(reward.pilotId||reward.id));
    // A converted weapon reward's current inventory rank is not its draw rank.
    const rank=pilot?({R:1,SR:2,SSR:3,UR:4}[pilot.rarity]||1):({white:0,green:1,blue:2,purple:3,gold:4}[reward.drawQuality]??Number(reward.qualityRank??reward.rank??0));
    return {index,rank,isNew:Boolean(reward.isNew),converted:Boolean(reward.convertedFragment)};
  });
  // Direct pilot recruitment presents the complete receipt without a gate.
  // Weapon recruitment and legacy boxes retain their individual sequences.
  const pilot=receipt.recruitGrid===true;
  return {kind:'recruit',title:'招募',grid:pilot,entries,featured:pilot?[]:entries.length===1?[0]:entries.filter(e=>e.isNew||e.rank>=3).map(e=>e.index)};
}

export function initialDrawPresentation(plan,reduced=false) {
  return {phase:plan.grid?'summary':reduced?(plan.kind==='research'?'spotlight':'summary'):'opening',cursor:0,review:false,instant:reduced};
}

export function advanceDrawPresentation(flow, action, plan) {
  // A technology draw has one result. Jump lands on that result rather than
  // showing a second copy of it in the underlying summary dialog.
  if (action==='skip' && plan.kind==='research' && flow.phase==='opening') return {...flow,phase:'spotlight',cursor:0,instant:true};
  if (action==='skip') return {...flow,phase:'summary'};
  if (action==='review') return {phase:'spotlight',cursor:0,review:true};
  if (flow.phase==='opening') return {...flow,phase:plan.featured.length?'spotlight':'summary',cursor:0};
  if (flow.phase==='spotlight') {
    const count=flow.review?plan.entries.length:plan.featured.length;
    return flow.cursor+1<count?{...flow,cursor:flow.cursor+1}:{...flow,phase:'summary'};
  }
  return flow;
}
