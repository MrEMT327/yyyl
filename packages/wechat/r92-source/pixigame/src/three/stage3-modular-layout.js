// Chapter 3: reusable bare terrain with separately occupied facility sites.
// Coordinates are authored once; scenery never consumes combat randomness.
const base=import.meta.env?.BASE_URL||'/';
const art=name=>`${base}art/stage3-modular-v2/${name}.png`;
export const STAGE3_MODULE_URLS=Object.freeze({
  river:art('lava-river'),cascade:art('lava-cascade'),arch:art('basalt-arch'),sulfur:art('sulfur-bank'),
  pool:art('magma-pool'),fissures:art('cooled-fissures'),columns:art('basalt-columns'),vent:art('fumarole'),
  ground:art('basalt-ground'),shelf:art('basalt-shelf'),geothermal:art('geothermal-station-v2'),extraction:art('extraction-works-v2'),
});
// Match the basalt floor in linear color space. Medians and the 15–85%
// rock-tone range come from opaque non-lava pixels, preserving painted relief.
// Rock corrections match the floor; already matched artwork uses identity.
// Neutral facility entries also avoid the generic blue-gray sprite tint.
export const STAGE3_ROCK_GRADES=Object.freeze({
  river:Object.freeze({gain:[1,1,1],offset:[0,0,0]}),
  geothermal:Object.freeze({gain:[1,1,1],offset:[0,0,0]}),
  extraction:Object.freeze({gain:[1,1,1],offset:[0,0,0]}),
  cascade:Object.freeze({gain:[1,1,1],offset:[0,0,0]}),
  arch:Object.freeze({gain:[1,1,1],offset:[0,0,0]}),
  sulfur:Object.freeze({gain:[1,1,1],offset:[0,0,0]}),
  pool:Object.freeze({gain:[1,1,1],offset:[0,0,0]}),
  columns:Object.freeze({gain:[1,1,1],offset:[0,0,0]}),
  vent:Object.freeze({gain:[1,1,1],offset:[0,0,0]}),
  fissures:Object.freeze({gain:[1,1,1],offset:[0,0,0]}),
  a:Object.freeze({gain:[.7098,.6256,.7873],offset:[.04889,.02911,.03125]}),
  b:Object.freeze({gain:[.5519,.4735,.6152],offset:[.06330,.04459,.06684]}),
  shelf:Object.freeze({gain:[.9579,.8840,1.1810],offset:[-.03865,-.02982,-.08804]}),
  connector:Object.freeze({gain:[.9270,.8359,.9838],offset:[.00765,-.00233,-.02079]}),
});
export const STAGE3_LOOP_UNITS=324;

// Unequal gaps, widths and setbacks deliberately avoid paired rows/banks.
// All rock textures retain their painted lighting, without mirrored buildings.
export const STAGE3_REGIONS=Object.freeze([
  {id:'west-entry',asset:'a',x:-12.2,z:-4,width:28},
  {id:'east-spur',asset:'fissures',x:15.4,z:17,width:32},
  {id:'west-caldera',asset:'b',x:-9.2,z:43,width:25},
  {id:'east-works',asset:'a',x:12.6,z:66,width:26},
  {id:'west-broken',asset:'shelf',x:-13.8,z:92,width:30},
  {id:'center-bench',asset:'a',x:1.6,z:108,width:19.5},
  {id:'west-plant',asset:'fissures',x:-11.8,z:128,width:27},
  {id:'east-crater',asset:'b',x:10.2,z:151,width:28},
  {id:'east-reach',asset:'shelf',x:14.7,z:180,width:31},
  {id:'west-recess',asset:'a',x:-17,z:195,width:29},
  {id:'east-outpost',asset:'a',x:12,z:221,width:25},
  {id:'west-vent',asset:'b',x:-9.8,z:245,width:24},
  {id:'center-ash',asset:'fissures',x:-1.4,z:266,width:28},
  {id:'west-hook',asset:'shelf',x:-15,z:278,width:32},
  {id:'east-rim',asset:'a',x:16,z:303,width:28},
  {id:'center-step',asset:'fissures',x:-1.3,z:316,width:22},
].map(row=>Object.freeze({...row,kind:'terrain'})));

// u/v locate the reserved site inside its host, in fractions of host width.
// Empty sites are usable flat land, not visible pads or editor placeholders.
// A site is an authored usable patch, not an automatic spawn. Blank patches
// remain natural rock. Adjacent choices need not all be occupied together.
export const STAGE3_SITES=Object.freeze([
  {id:'entry-lake',host:'west-entry',u:.18,v:-.035,width:.40,kind:'natural',asset:'pool'},
  {id:'entry-upper-ledge',host:'west-entry',u:.14,v:.25,width:.23,kind:'natural',asset:'sulfur'},
  {id:'spur-fractures',host:'east-spur',u:-.20,v:-.08,width:.26},
  {id:'spur-toe',host:'east-spur',u:-.24,v:.20,width:.29,kind:'natural',asset:'columns'},
  {id:'caldera-rim',host:'west-caldera',u:.20,v:.18,width:.40,kind:'natural',asset:'arch'},
  {id:'drilling-works',host:'east-works',u:-.17,v:-.025,width:.29,asset:'extraction'},
  {id:'works-upper-ledge',host:'east-works',u:-.16,v:.24,width:.19},
  {id:'broken-toe',host:'west-broken',u:.24,v:.18,width:.31,kind:'natural',asset:'vent'},
  {id:'bench-lake',host:'center-bench',u:-.06,v:-.025,width:.56,kind:'natural',asset:'pool'},
  {id:'bench-east-ledge',host:'center-bench',u:.28,v:.23,width:.16},
  {id:'plant-vent',host:'west-plant',u:.20,v:-.03,width:.44,kind:'natural',asset:'cascade'},
  {id:'plant-upper-ledge',host:'west-plant',u:.12,v:.24,width:.18},
  {id:'crater-ledge',host:'east-crater',u:-.22,v:.20,width:.19},
  {id:'reach-lake',host:'east-reach',u:-.19,v:-.09,width:.25,kind:'natural',asset:'pool'},
  {id:'reach-tip',host:'east-reach',u:.16,v:.24,width:.16},
  {id:'recess-inner',host:'west-recess',u:.27,v:-.02,width:.29,kind:'natural',asset:'columns'},
  {id:'outpost-power',host:'east-outpost',u:-.12,v:-.025,width:.26,asset:'geothermal'},
  {id:'outpost-upper-ledge',host:'east-outpost',u:-.12,v:.24,width:.20},
  {id:'vent-rim',host:'west-vent',u:.21,v:.18,width:.28,kind:'natural',asset:'sulfur'},
  {id:'ash-west-ledge',host:'center-ash',u:-.23,v:.03,width:.22},
  {id:'ash-east-ledge',host:'center-ash',u:.19,v:-.17,width:.33,kind:'natural',asset:'vent'},
  {id:'hook-toe',host:'west-hook',u:.15,v:.23,width:.16},
  {id:'rim-inner',host:'east-rim',u:-.27,v:-.02,width:.30,kind:'natural',asset:'columns'},
  {id:'step-vent',host:'center-step',u:.02,v:-.02,width:.55},
  {id:'step-upper-ledge',host:'center-step',u:-.12,v:.24,width:.19},
].map(Object.freeze));

// A few short ridges join nearby terraces. Longer intervals stay open.
const links=[['west-broken','west-plant',18],['east-reach','east-outpost',17],['east-rim','east-spur',20]];
const connections=links.map(([fromId,toId,width],i)=>{
  const from=STAGE3_REGIONS.find(row=>row.id===fromId),to=STAGE3_REGIONS.find(row=>row.id===toId);
  const dz=(to.z-from.z+STAGE3_LOOP_UNITS)%STAGE3_LOOP_UNITS,dx=to.x-from.x;
  return Object.freeze({id:`ridge-${i}`,kind:'connection',asset:'connector',from:fromId,to:toId,
    x:(from.x+to.x)/2,z:from.z+dz/2,width,height:Math.hypot(dx,dz)+6,
    angle:Math.atan2(dx,dz),feather:.16,order:.5});
});
const facilities=STAGE3_SITES.filter(site=>site.asset).map(site=>{
  const host=STAGE3_REGIONS.find(row=>row.id===site.host);
  return Object.freeze({id:site.id,kind:site.kind??'facility',host:host.id,asset:site.asset,
    x:host.x+site.u*host.width,z:host.z+site.v*host.width,width:site.width*host.width,order:3});
});
// A single shallow river crosses the staggered gap between the works and
// broken western shelf. Its natural rock lips close both ends; no tiled seam.
export const STAGE3_RIVER=Object.freeze({id:'winding-lava-river',kind:'natural',asset:'river',x:.8,z:78,width:21,height:44,order:2});
export const STAGE3_PLACEMENTS=Object.freeze([...connections,...STAGE3_REGIONS,STAGE3_RIVER,...facilities]);
