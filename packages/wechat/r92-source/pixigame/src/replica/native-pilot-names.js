import { AIRCRAFTS } from '../pilots.js';
import { NATIVE_PILOT_SKINS } from './native-pilot-roster.js';

// Presentation only: keep native ownership IDs, costs and skills unchanged.
const names=new Map(AIRCRAFTS.map(row=>[row.id,row.name]));
export const nativePilotDisplayName=id=>names.get(NATIVE_PILOT_SKINS[id]);
