// Presentation only. Rarity and draw probabilities still come from the roster.
export const PILOT_CARD_QUALITY=Object.freeze({
 '未标注':Object.freeze({frame:'frame-gray.png',choiceFrame:'card-blue.png',frameFilter:'grayscale(1)',color:'#8899a2',light:'#d8e2e7',ink:'#1c2a32',foil:.01,foilActive:.04,glitter:0,engraving:0,marks:0}),
 普通:Object.freeze({frame:'frame-gray.png',choiceFrame:'card-blue.png',frameFilter:'grayscale(1)',color:'#8899a2',light:'#d8e2e7',ink:'#1c2a32',foil:.01,foilActive:.04,glitter:0,engraving:0,marks:0}),
 优秀:Object.freeze({frame:'frame-green.png',choiceFrame:'card-blue.png',frameFilter:'hue-rotate(280deg) saturate(1.2)',color:'#55a572',light:'#d5ffdf',ink:'#153320',foil:.012,foilActive:.05,glitter:0,engraving:.08,marks:0}),
 R:Object.freeze({frame:'frame-blue.png',choiceFrame:'card-blue.png',frameFilter:'none',color:'#65afe0',light:'#c8eaff',ink:'#0b2033',foil:.015,foilActive:.06,glitter:0,engraving:.16,marks:0}),
 SR:Object.freeze({frame:'frame-purple.png',choiceFrame:'card-blue.png',frameFilter:'hue-rotate(76deg)',color:'#b38aef',light:'#ecd8ff',ink:'#241739',foil:.06,foilActive:.16,glitter:.035,engraving:.34,marks:1}),
 SSR:Object.freeze({frame:'frame-gold.png',choiceFrame:'card-blue.png',frameFilter:'hue-rotate(208deg) saturate(.8)',color:'#efbd55',light:'#fff0b5',ink:'#392710',foil:.13,foilActive:.3,glitter:.12,engraving:.62,marks:2}),
});
const NATIVE_FRAMES=Object.freeze([
 PILOT_CARD_QUALITY.普通,PILOT_CARD_QUALITY.优秀,PILOT_CARD_QUALITY.R,
 PILOT_CARD_QUALITY.SR,PILOT_CARD_QUALITY.SSR,
]);
export function pilotCardQuality(rarity,qualityRank,qualityKnown) {
 if(qualityKnown===false)return PILOT_CARD_QUALITY['未标注'];
 if(Number.isInteger(qualityRank))return NATIVE_FRAMES[qualityRank]||PILOT_CARD_QUALITY['未标注'];
 if(rarity==='UR')return PILOT_CARD_QUALITY.SSR;
 return Object.hasOwn(PILOT_CARD_QUALITY,rarity)?PILOT_CARD_QUALITY[rarity]:PILOT_CARD_QUALITY['未标注'];
}
