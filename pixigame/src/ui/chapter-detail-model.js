import catalog from '../replica/chapter-detail-catalog.json';
import {chapterPresentationForStage} from '../replica/chapter-presentation.js';
import settlement from '../replica/native-settlement-source.json';

export function chapterDetailModel(snapshot,index){
  const stage=snapshot.stages[index],data=catalog.chapters.find(c=>c.id===(stage.replicaChapterId||index+1));
  const title=chapterPresentationForStage(index).name||stage.name;
  // FinishReward is an old display list, not a verified grant table. Present
  // only live collected gold and the same once-only rewards as settlement.
  const drops=[{id:1,firstClear:false},...(settlement.firstRewards[data.id]||[]).map(([id])=>({id,firstClear:true}))];
  return {title,stage,enemies:data.enemies,drops};
}
