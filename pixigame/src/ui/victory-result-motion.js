const clamp = value => Math.max(0, Math.min(1, value));
const easeOut = value => 1-(1-clamp(value))**3;
export function victoryMotion(elapsed, reduced = false) {
  const t = reduced ? 10 : Math.max(0, elapsed);
  const enter = clamp(t/.65);
  return {
    ready: reduced || t >= 1.65,
    heroY: reduced ? 0 : 46*(1-easeOut(enter)),
    heroScale: reduced ? 1 : .82+.18*easeOut(enter)+.055*Math.sin(enter*Math.PI),
    bannerScale: reduced ? 1 : 1+.08*Math.exp(-Math.max(0,t-.2)*7)*Math.sin(Math.max(0,t-.2)*16),
    reveal: delay => reduced ? 1 : easeOut((t-delay)/.3),
    star: index => {
      const p = reduced ? 1 : clamp((t-.62-index*.18)/.32);
      return {alpha:p,scale:.55+.45*p+.25*Math.sin(p*Math.PI)};
    },
    glowAlpha: reduced ? .12 : .12+.08*Math.exp(-Math.max(0,t-.2)*2)+.025*Math.sin(t*1.8),
    glowRotation: reduced ? 0 : t*.055,
    sparkTime: reduced ? -1 : t-.3,
  };
}
