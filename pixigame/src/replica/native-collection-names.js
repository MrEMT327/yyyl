import { nativeItemDisplayName } from './native-item-names.js';
import { AIRCRAFTS } from '../pilots.js';
import { PUBLIC_ARSENAL } from '../fixed-parts/airframe-arsenal.js';
import catalog from './native-economy-catalog.json' with {type:'json'};
import { NATIVE_AIRCRAFT_SKINS } from './native-aircraft-skins.js';
import { nativePilotDisplayName } from './native-pilot-names.js';

// Presentation only. Unmapped weapons retain their existing names; never infer
// a gameplay identity from a similar-looking model or rename skill definitions.
const aircraftNames=new Map(AIRCRAFTS.map(row=>[row.id,row.aircraft]));
const weaponNames=new Map(catalog.guns.filter(row=>PUBLIC_ARSENAL[row.appearance]).map(row=>[row.id,PUBLIC_ARSENAL[row.appearance].name]));
export const nativeCollectionDisplayName=id=>nativePilotDisplayName(id)||aircraftNames.get(NATIVE_AIRCRAFT_SKINS[id])||weaponNames.get(Number(id))||PUBLIC_ARSENAL[id]?.name||nativeItemDisplayName(id);
