// Decorative maritime objects only: no collisions, pickups or reward signals.
// The middle water corridor stays clear of land across all three ground images.
export const STAGE1_FLOAT_SPRITES = Object.freeze({
  buoy:Object.freeze({width:192,height:256,wakeWidth:1.05,wakeLength:.5,contactOffset:.2}),
  cargo:Object.freeze({width:256,height:256,wakeWidth:1.08,wakeLength:1.05,contactOffset:.04}),
  skiff:Object.freeze({width:192,height:320,wakeWidth:.88,wakeLength:1.25,contactOffset:.02}),
});
// [texture, native X, native Z, width, yaw radians]. Uneven gaps and mixed
// arrangements form a 340-unit cycle, independent of the 6-section coast cycle.
export const STAGE1_FLOATING_PROPS = Object.freeze([
  ['buoy',-4.2,13,1.05,0],['cargo',3.6,-1,1.9,.12],['skiff',-3.5,-18,1.65,-.16],
  ['buoy',4.4,34,1.1,.03],['cargo',-4,48,1.65,-.32],
  ['skiff',3.8,72,1.6,.24],['buoy',-4.5,89,.95,0],['cargo',-2.9,95,1.5,.4],
  ['cargo',4.2,117,1.8,-.18],['buoy',-3.5,138,1.1,.05],['skiff',4.4,157,1.55,-.26],
  ['cargo',-4.1,-43,1.7,.3],['buoy',3.9,-58,1.05,0],['skiff',-3.8,-80,1.7,.2],
  ['buoy',4.1,-103,1,0],['cargo',2.8,-112,1.6,-.23],
  ['cargo',-4.3,-135,1.85,.14],['skiff',3.2,-158,1.6,-.12],
].map(([source,x,z,width,yaw])=>Object.freeze([source,x*.42,z,width,yaw])));
