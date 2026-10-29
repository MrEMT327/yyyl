// Canvas counterpart of lobby-theme.css. Keep semantic colors independent of
// weapon rarity, projectile tint and game balance.
export const COMBAT_UI = Object.freeze({
  ink: 0x06121e, panel: 0x10263b, deep: 0x0b1c2d, edge: 0x547e9e,
  text: 0xf8fbff, muted: 0xb7cddd, gold: 0xffdc2d, blue: 0x16b5f6,
  success: 0xa9e8bc, danger: 0xef6676,
});
// Neutral battle surfaces; menus keep their existing blue palette.
export const COMBAT_HUD = Object.freeze({
  panel: 0x18191b, pressed: 0x303236, edge: 0x777a7d, track: 0x303234,
  text: 0xf7f6f2, muted: 0xc7c6c2, shadow: 0x080808, gold: 0xf1cf76,
  bossFill: 0xc65353, bossCritical: 0xcb444a, bossTrail: 0xd99d82, bossHighlight: 0xf19a8b,
  surfaceAlpha: 0.85, edgeAlpha: 0.45, radius: 3,
});
// Same upright family/weights as the lobby. Roles, not individual widgets,
// determine the hierarchy of combat labels and live numbers.
export const COMBAT_TYPE = Object.freeze({
  family: '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif',
  label: Object.freeze({size:16,weight:'800',fill:COMBAT_UI.muted}),
  number: Object.freeze({size:20,weight:'900',fill:COMBAT_UI.text}),
  emphasis: Object.freeze({size:30,weight:'900',fill:COMBAT_UI.gold}),
});
export const combatButtonStyle = variant => ({
  secondary: { fill: COMBAT_UI.panel, pressedFill: 0x29445b, stroke: COMBAT_UI.edge, textColor: COMBAT_UI.text },
  primary: { fill: 0x284956, pressedFill: 0x1a3542, stroke: 0x86c5d9, textColor: COMBAT_UI.text },
  danger: { fill: 0x8b3042, pressedFill: 0xa94050, stroke: COMBAT_UI.danger, textColor: COMBAT_UI.text },
}[variant] || {});
