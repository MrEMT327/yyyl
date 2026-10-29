// Presentation only. Rarity and draw probabilities still come from the roster.
export const PILOT_CARD_QUALITY=Object.freeze({
 R:Object.freeze({frame:'frame-blue.png',choiceFrame:'card-blue.png',frameFilter:'none',color:'#65afe0',light:'#c8eaff',ink:'#0b2033',foil:.015,foilActive:.06,glitter:0,engraving:.16,marks:0}),
 SR:Object.freeze({frame:'frame-purple.png',choiceFrame:'card-blue.png',frameFilter:'hue-rotate(76deg)',color:'#b38aef',light:'#ecd8ff',ink:'#241739',foil:.06,foilActive:.16,glitter:.035,engraving:.34,marks:1}),
 SSR:Object.freeze({frame:'frame-gold.png',choiceFrame:'card-blue.png',frameFilter:'hue-rotate(208deg) saturate(.8)',color:'#efbd55',light:'#fff0b5',ink:'#392710',foil:.13,foilActive:.3,glitter:.12,engraving:.62,marks:2}),
 UR:Object.freeze({frame:'frame-red.png',choiceFrame:'card-prismatic.png',frameFilter:'none',color:'#ff789a',light:'#ffe3ed',ink:'#3b142b',foil:.25,foilActive:.46,glitter:.23,engraving:.86,marks:3}),
});
export const pilotCardQuality=rarity=>Object.hasOwn(PILOT_CARD_QUALITY,rarity)?PILOT_CARD_QUALITY[rarity]:PILOT_CARD_QUALITY.R;
