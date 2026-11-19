const plain=value=>String(value??'').replace(/<[^>]*>/g,'');
export function collectionDetailModel(row,attributeNames={}){
  const commonIds=new Set(row.stage.skills.filter(skill=>row.stages.every(stage=>stage.skills.some(candidate=>candidate.id===skill.id))).map(skill=>skill.id));
  const attributes=stage=>(stage.attributes||[]).map(value=>{
    const separator=value.indexOf('='),key=value.slice(0,separator),amount=value.slice(separator+1);
    return {key,label:attributeNames[key]||key,amount:`${Number(amount)>=0?'+':''}${amount}${key.endsWith('%')?'%':''}`};
  });
  return {
    maxStar:Math.max(row.star,...row.stages.map(stage=>stage.star)),
    attributes:attributes(row.stage),
    skills:row.stage.skills.map(skill=>({id:skill.id,text:plain(skill.description)})),
    stages:row.stages.map(stage=>({star:stage.star,unlocked:row.owned&&row.star>=stage.star,current:row.owned&&row.star===stage.star,
      attributes:attributes(stage),skills:stage.skills.filter(skill=>!commonIds.has(skill.id)).map(skill=>({id:skill.id,text:plain(skill.description)}))})),
  };
}

