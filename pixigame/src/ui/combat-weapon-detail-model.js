const qualityNames=['','普通','优秀','精良','史诗','传说','神话'];
const plain=value=>String(value??'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/\\n/g,'\n').trim();

export function combatWeaponDetail(item={}) {
  const name=plain(item.name)||'武器';
  let description=plain(item.description);
  const prefix=`开启${name}`;
  if(description.startsWith(prefix)) {
    const remaining=description.slice(prefix.length).replace(/^[，,。\s]+/,'');
    if(remaining)description=remaining;
  }
  description=description.replace(/正前方的敌人/g,'正前方敌人');
  const quality=Number(item.quality);
  return {name,description,
    levelLabel:`Lv.${Number.isSafeInteger(item.level)&&item.level>0?item.level:1}`,
    qualityName:Number.isInteger(quality)&&quality>=1&&quality<=6?qualityNames[quality]:'',
  };
}

export function combatDetailLines(value,limit=19) {
  const lines=[];
  for(const paragraph of String(value).split('\n')) {
    let line='',width=0;
    for(const char of paragraph) {
      const advance=char.charCodeAt(0)<128?.55:1;
      if(line&&width+advance>limit){lines.push(line);line='';width=0;}
      line+=char;width+=advance;
    }
    if(line)lines.push(line);
  }
  return lines;
}
