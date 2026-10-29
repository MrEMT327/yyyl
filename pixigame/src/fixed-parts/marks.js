// A root reads old marks before HP settlement. Writes are committed only after
// settlement, and another projectile of that same root cannot consume them.
export function createFixedMarks() {
  const marks=new Map(), transactions=new Map();
  return {
    begin(key, source, targetId, time, eligible=()=>true) {
      if(transactions.has(key))return [];
      const taken=[];
      for(const [id,mark] of marks)if(mark.targetId===targetId&&mark.until>=time&&mark.groupId!==source.groupId&&eligible(mark)){
        taken.push(mark);marks.delete(id);
      }
      transactions.set(key,taken);return taken;
    },
    finish(key){const result=transactions.get(key);transactions.delete(key);return result||[];},
    put(id,mark){marks.set(id,mark);},
    expire(time){for(const [id,m] of marks)if(m.until<time)marks.delete(id);},
    forget(targetId){for(const [id,m] of marks)if(m.targetId===targetId)marks.delete(id);},
    clear(){marks.clear();transactions.clear();},
  };
}
