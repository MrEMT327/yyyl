// Explain only current, connected sources. This view never grants rewards or
// treats dormant original item tables as live drop channels.
import { RANDOM_AIRCRAFT } from '../replica/native-aircraft-grants.js';

export function backpackItemSources(item,s,rule,h,go) {
  const id=item.nativeId,e=h.escape,n=h.number,links=[],lines=[];
  const link=(label,kind)=>links.push(go(label,kind));
  const p=s.pilotSupply;
  if(rule?.kind==='pilotBox'){
    lines.push('碎片合成；新手十连保底1箱。');
    const chance=p?.pool?.probabilities?.[925];
    if(typeof chance==='number')lines.push(`驾驶员补给也可获得角色箱。`);
    link('任务与活跃','supplyTasks');link('驾驶员补给','supply');
  }else if(rule?.kind==='pilotCompose'){
    const daily=p?.tasks.reduce((sum,row)=>sum+row.fragments,0);
    if(daily!==undefined)lines.push(`每日：任务 ${daily} ＋ 满活跃 ${p.activity.fragments}；每周：满活跃 ${p.week.fragments}`);
    if(p)lines.push(`广告：${p.ad.fragments}／次，每日 ${p.ad.limit} 次`);
    link('任务与活跃','supplyTasks');
  }else if(rule?.kind==='equipmentKey'){
    if(id===112){
      lines.push('普通箱累计20次：高级箱券 ×1。');
      if(p)lines.push(`${p.creditCost}积分 → 高级箱券 ×1。`);
    }
    lines.push('其他来源：驾驶员补给、章节奖励、每日商店。');
    lines.push('巡逻与快速巡逻：箱券产出以当前章节预览为准。');
    link('查看巡逻收益','patrol');
    link('商城与奖励','shop');link('查看章节奖励','materials');
    if(id===112&&p)link('积分兑换','supplyBoxes');
  }else if(id===135){
    lines.push('常规觉醒15次 → 星核 ×1；王牌觉醒消耗1枚。');
    lines.push('星级：18／36／54／72／99／126／153／180星，各1枚。');
    lines.push('通关：第5、10、15……50章，各1枚。');
    lines.push('每日成长补给：通关10章后1枚；满活跃后另行领取。');
    const week=p?.growth?.week,core=week?.extraRewards?.find(reward=>reward.id===135);
    if(core)lines.push(`${week.requirement}，另得星核 ×${core.count}。`);
    link('前往天赋','talent');link('领取星级奖励','nativeStars');link('查看章节星核','chapterCores');
    if(p?.growth?.daily)link('每日成长补给','growthDaily');
    if(core)link('每周成长补给','growthWeek');
  }else if(id>=105&&id<=109||id>=801&&id<=811){
    lines.push(id>=801?'巡逻与快速巡逻：十一类科研图纸轮换产出。':'巡逻与快速巡逻：五类装备图纸轮换产出。');
    lines.push('章节奖励：达标后前往领取。');
    if(id>=801&&id<=811){lines.push('每日商店：查看本期图纸商品。');link('查看每日商店','shop');}
    link('查看巡逻收益','patrol');link('查看章节奖励','materials');
  }else if(rule?.kind==='compose'){
    const daily=p?.growth?.daily,week=p?.growth?.week;
    if(daily)lines.push(`每日成长：${daily.fragments}个指定碎片。${daily.requirement}。`);
    if(week)lines.push(`每周成长：${week.fragments}个指定碎片。${week.requirement}。`);
    lines.push('普通模式仅可选已拥有、未满星且缺材料的驾驶员。');
    link('每日成长补给','growthDaily');link('每周成长补给','growthWeek');
    lines.push('角色箱：重复得同名卡；3积分可指定解锁或换卡。');
    link('角色箱与积分','supplyBoxes');
  }else if(rule?.kind==='pilotCard'){
    const inRoleBox=p?.candidates.some(row=>row.id===id);
    lines.push(inRoleBox?'驾驶员招募／角色箱可出。':'新手奖励、签到或积分兑换；角色箱不含此驾驶员。');
    if(inRoleBox)link('驾驶员招募','supply');
    lines.push('3积分：指定解锁或兑换未满星同名卡。');
    link('角色箱与积分','supplyBoxes');
  }else if(RANDOM_AIRCRAFT.some(row=>row.id===id)){
    lines.push('高级装备箱：随机获得飞机，重复获得同名卡用于升星。');
    link('高级装备箱','shop');
  }else if(rule?.kind==='choice'){
    const period=id===903?'daily':'week',view=p?.growth?.[period];
    if(view){lines.push(view.requirement+'；每期1箱，自选1项。');link(view.name,period==='daily'?'growthDaily':'growthWeek');}
  }
  if(!lines.length)return '';
  return `<details class="bag-item-sources"><summary>获取途径</summary>${lines.map(line=>`<p>${e(line)}</p>`).join('')}${links.length?`<div class="bag-use-actions">${links.join('')}</div>`:''}</details>`;
}
