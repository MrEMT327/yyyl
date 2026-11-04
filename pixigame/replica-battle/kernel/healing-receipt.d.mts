type Owner={runId:number;clock:number;player:{x:number;z:number;hp:number}};
export function recordHealingReceipt(owner:Owner,amount:number):void;
export function recordMedicalPickupReceipt(owner:Owner):void;
export function sampleHealingReceipt(owner:Owner):{uid:number;kind:'heal';x:number;z:number;age:number;duration:number;size:number}|null;
