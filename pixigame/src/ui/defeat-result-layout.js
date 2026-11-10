// UI_BattleResultMain RectTransforms, APK 1.1.6. Source canvas 1080 x 2340.
// Measurements only: all runtime artwork remains original project artwork.
const scale=600/1080;
const rect=(x,y,w,h)=>({x:300+(x-w/2)*scale,y:650-(y+h/2)*scale,width:w*scale,height:h*scale});
export const DEFEAT_REFERENCE = Object.freeze({
  body:rect(.28,-23.57,1056.07,1326.34),
  kills:rect(.29,-53,987.68,90),
  rewards:rect(.265,-297.6,987.7,375.1),
  // FailBg + obj_recommendSkills + Image, including their parent offsets.
  recommendations:rect(2.22,-623.44,1031.6,158.96),
  confirm:rect(0,-800,489,178),
  stats:rect(-389.3,-801.9,162,149),
});
export function defeatResultLayout(model) {
  const rows=Math.max(1,Math.ceil(Math.min(10,model.total??model.rewards.length)/5));
  const extra=(rows-1)*104, paging=model.pageCount>1?48:0;
  const rewards={...DEFEAT_REFERENCE.rewards,height:DEFEAT_REFERENCE.rewards.height+extra};
  const rewardHeaderHeight=43,border=3,rewardSize=88,rewardStride=104;
  const rewardContent={x:rewards.x+border,y:rewards.y+rewardHeaderHeight+border,
    width:rewards.width-2*border,height:rewards.height-rewardHeaderHeight-2*border};
  // The frame stays the same height across pages, but the visible group is
  // centered independently (the last page may contain just one reward).
  const visibleRows=Math.max(1,Math.ceil(model.rewards.length/5));
  const groupHeight=rewardSize+(visibleRows-1)*rewardStride;
  const rewardTop=rewardContent.y+(rewardContent.height-groupHeight)/2;
  const recommendationRows=Math.ceil(model.recommendations.length/4);
  const recommendationTop=DEFEAT_REFERENCE.recommendations.y+extra+paging;
  // The project's PSD outer frame has wider metal corners than the reference.
  // Keep the reference height; fit the visible inner rectangle to the shared
  // content edges so the recommendation border cannot cover those corners.
  const recommendations={...DEFEAT_REFERENCE.recommendations,x:rewards.x,width:rewards.width,
    y:recommendationTop,height:DEFEAT_REFERENCE.recommendations.height*Math.max(1,recommendationRows)+(model.unlocks?.length||0)*32};
  const bottom=Math.max(DEFEAT_REFERENCE.body.y+DEFEAT_REFERENCE.body.height+extra+paging,
    recommendationRows||model.stats?.length||model.unlocks?.length?recommendationTop+recommendations.height+24:0);
  const buttonTop=Math.max(DEFEAT_REFERENCE.confirm.y+extra+paging,bottom+20);
  return {...DEFEAT_REFERENCE.body,height:bottom-DEFEAT_REFERENCE.body.y,
    kills:DEFEAT_REFERENCE.kills,rewards,recommendations,
    rewardTop,rewardSize,rewardStride,rewardContent,rewardHeaderHeight,
    pagerTop:rewards.y+rewards.height+3,recommendationTop,recommendationRows,
    buttonTop,confirm:{...DEFEAT_REFERENCE.confirm,y:buttonTop},
    stats:{x:DEFEAT_REFERENCE.stats.x+(DEFEAT_REFERENCE.stats.width-96)/2,
      y:buttonTop+(DEFEAT_REFERENCE.confirm.height-96)/2,width:96,height:96}};
}
