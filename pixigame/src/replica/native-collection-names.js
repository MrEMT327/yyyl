import { nativeWeaponDisplayName } from './native-weapon-display.js';
import { nativeItemDisplayName } from './native-item-names.js';
import { AIRCRAFTS } from '../pilots.js';
import { PUBLIC_ARSENAL } from '../fixed-parts/airframe-arsenal.js';
import { NATIVE_AIRCRAFT_SKINS } from './native-aircraft-skins.js';
import { nativePilotDisplayName } from './native-pilot-names.js';

// Presentation only. Unmapped weapons retain their existing names; never infer
// a gameplay identity from a similar-looking model or rename skill definitions.
const aircraftNames=new Map(AIRCRAFTS.map(row=>[row.id,row.aircraft]));
export const nativeCollectionDisplayName=id=>nativePilotDisplayName(id)||aircraftNames.get(NATIVE_AIRCRAFT_SKINS[id])||nativeWeaponDisplayName(id)||PUBLIC_ARSENAL[id]?.name||nativeItemDisplayName(id);
