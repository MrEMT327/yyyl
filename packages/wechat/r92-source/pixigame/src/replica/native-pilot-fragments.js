import acquisition from './native-acquisition-catalog.json' with {type:'json'};
import catalog from './native-economy-catalog.json' with {type:'json'};
import { isRosterPilot } from './native-pilot-roster.js';
import { nativePilotDisplayName } from './native-pilot-names.js';

const pilots=new Map(catalog.pilots.filter(row=>!row.closed&&isRosterPilot(row.id)).map(row=>[row.id,row]));
export const PILOT_FRAGMENT_ITEMS=Object.freeze(acquisition.items.filter(row=>{
  const pair=row.itemTypeParam?.[0];
  return row.itemSubType===12&&pair?.length===2&&pilots.has(pair[0])&&Number.isSafeInteger(pair[1])&&pair[1]>0;
}).map(row=>Object.freeze({id:row.id,pilotId:row.itemTypeParam[0][0],cost:row.itemTypeParam[0][1]})));
const byItem=new Map(PILOT_FRAGMENT_ITEMS.map(row=>[row.id,row]));
const byPilot=new Map(PILOT_FRAGMENT_ITEMS.map(row=>[row.pilotId,row]));
if(byPilot.size!==pilots.size||byItem.size!==PILOT_FRAGMENT_ITEMS.length)throw Error('驾驶员碎片配置缺失或重复');
export const nativePilotFragment=id=>byItem.get(Number(id));
export const pilotFragmentForPilot=id=>byPilot.get(Number(id));
export const nativePilotFragmentName=id=>{
  const fragment=nativePilotFragment(id);
  return fragment?(nativePilotDisplayName(fragment.pilotId)||pilots.get(fragment.pilotId).name)+'碎片':undefined;
};
