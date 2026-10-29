export const FLIGHT_ACTION_TEXTS = Object.freeze([
  '贴地掠影',
  '弹幕穿针',
  '引擎在笑',
  '擦肩无伤',
  '航迹开花',
  '侧翼漂移',
  '光速切线',
  '星尘甩尾',
  '火线芭蕾',
  '刀尖漫步',
  '极限压弯',
  '雷达失焦',
  '风暴过弯',
  '零距脱锁',
  '航迹反杀',
  '云端滑步',
  '相位擦边',
  '漂亮骗弹',
  '翼尖点火',
  '敌机看懵',
]);

export function flightComboLabel(combo) {
  const value = Math.max(1, Math.floor(Number(combo) || 1));
  return `×${value}`;
}

export function pickFlightActionText(previous = '', random = Math.random) {
  const choices = FLIGHT_ACTION_TEXTS.filter((text) => text !== previous);
  const roll = Math.max(0, Math.min(0.999999, Number(random()) || 0));
  return choices[Math.floor(roll * choices.length)] || FLIGHT_ACTION_TEXTS[0];
}
