export function assessReplicaBattle(result: {chapterId:number;hp:number;maxHp:number;revivesUsed:number;won:boolean;abandoned?:boolean}): {starMask:number;stars:number;starObjectives:{id:number;label:string;index:number;achieved:boolean}[]}|null;
export function preserveReplicaStars(previous:unknown,result:any):number;
export function countStars(mask:number):number;
