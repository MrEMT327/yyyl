const clamp = n => Math.max(0, Math.min(1, n));
const progress = (time, start, duration) => clamp((time - start) / duration);
const out = t => 1 - (1 - t) ** 3;

export function defeatMotionFrame(seconds, reduced = false) {
  const time = reduced ? 2 : Math.max(0, seconds);
  const panel = out(progress(time, 0, .32));
  const title = progress(time, .12, .48);
  const titleEase = out(title), content = out(progress(time, .18, .34));
  const buttons = out(progress(time, .48, .34));
  return {
    panelAlpha: panel, panelScale: .96 + .04 * panel, panelY: 22 * (1 - panel),
    titleAlpha: titleEase, titleScale: .84 + .16 * titleEase + .07 * Math.sin(Math.PI * title),
    titleX: .85 + .15 * titleEase, titleY: -10 * (1 - titleEase),
    badgeY: -18 * (1 - panel), badgeAngle: Math.sin(progress(time, 0, .70) * Math.PI * 3) * .065 * (1 - progress(time, 0, .70)),
    contentAlpha: content, contentY: 12 * (1 - content),
    buttonsAlpha: buttons, buttonsY: 14 * (1 - buttons), buttonsReady: time >= .48,
  };
}

export function createDefeatMotion(panel, layers, state, receipt, now = performance.now()) {
  // Rebuilding for a reward receipt/page keeps the same timeline. A new run
  // gets a new reveal, without retaining old display trees or scheduling RAFs.
  if (state.defeatRevealKey !== receipt || !Number.isFinite(state.defeatRevealAt)) {
    state.defeatRevealKey = receipt;
    state.defeatRevealAt = now;
  }
  panel.pivot.set(300, 650);
  const controls = layers.buttons.children.map(node => [node, node.enabled]);
  return (time, reduced = false) => {
    if (panel.destroyed || !panel.parent) return;
    const f = defeatMotionFrame((time - state.defeatRevealAt) / 1000, reduced);
    panel.alpha = f.panelAlpha; panel.scale.set(f.panelScale);
    panel.position.set(300, 650 + f.panelY);
    layers.title.alpha = f.titleAlpha;
    layers.title.scale.set(f.titleScale * f.titleX, f.titleScale);
    layers.title.position.set(300, 243 + f.titleY);
    layers.badge.position.set(300, 138 + f.badgeY); layers.badge.rotation = f.badgeAngle;
    layers.content.alpha = f.contentAlpha; layers.content.position.y = f.contentY;
    layers.buttons.alpha = f.buttonsAlpha; layers.buttons.position.y = f.buttonsY;
    for (const [control, enabled] of controls) control.enabled = enabled && f.buttonsReady;
  };
}

export function updateReviveCountdown(node, remaining, now, reduced = false) {
  const value = Math.max(0, Math.ceil(remaining || 0));
  if (node.reviveValue !== value) {
    node.reviveValue = value; node.revivePulseAt = now; node.text = String(value);
  }
  const t = reduced ? 1 : progress(now - node.revivePulseAt, 0, 250);
  node.scale.set(1 + .5 * (1 - out(t)));
}
