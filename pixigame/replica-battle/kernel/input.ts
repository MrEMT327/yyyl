import type { NativeScrollCameraBounds } from './native-scroll-camera';
import { clampNativePlayerTarget } from './native-camera-projection';

// Keep at most 60ms of future drag travel. Overflow is consumed, never saved
// as an invisible offset; small relative corrections retain their full distance.
const MAX_DRAG_LEAD_SECONDS = .06;

export class Controls {
  dx = 0;
  dy = 0;
  held = false;
  private pointer: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private keys = new Set<string>();
  private target: { x: number; y: number } | null = null;
  private rawTarget: { x: number; y: number } | null = null;
  private lastDragCamera: { x: number; y: number } | null = null;
  private reverseX = false;
  private reverseY = false;
  private dragAxes = {
    x: { direction: 0, opposed: 0, unreadOpposed: 0, threshold: 0 },
    y: { direction: 0, opposed: 0, unreadOpposed: 0, threshold: 0 },
  };
  constructor(private surface: HTMLElement, private canMove: () => boolean, private pause: () => void) {
    surface.addEventListener('pointerdown', event => {
      if (!canMove() || (event.pointerType === 'mouse' && event.button !== 0) || (event.target as HTMLElement)?.closest('button, .overlay')) return;
      if (this.pointer !== null) return;
      this.pointer = event.pointerId;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.held = true;
      this.target = this.rawTarget = this.lastDragCamera = null; this.dx = this.dy = 0;
      this.reverseX = this.reverseY = false;
      this.resetDragStrokes();
      try { surface.setPointerCapture(event.pointerId); } catch { this.clear(); return; }
      event.preventDefault();
    });
    surface.addEventListener('pointermove', event => {
      if (this.pointer !== event.pointerId) return;
      if (!canMove() || (event.pointerType === 'mouse' && event.buttons === 0)) { this.clear(); return; }
      const rect = surface.getBoundingClientRect();
      if (!(rect.width > 0 && rect.height > 0)) { this.clear(); return; }
      // Browsers may deliver a whole touch curve in one event. The newest
      // intentional stroke still owns a turn, even if its net endpoint is
      // ahead of the starting point. Bound work on unusually long batches.
      const samples = event.getCoalescedEvents?.();
      if (samples) for (let i = Math.max(0, samples.length - 32); i < samples.length; i++) {
        if (samples[i].pointerId === event.pointerId) this.recordPointerPosition(samples[i], rect);
      }
      this.recordPointerPosition(event, rect);
    });
    const release = (event: PointerEvent) => {
      if (event.pointerId === this.pointer) this.clearPointer();
    };
    surface.addEventListener('pointerup', release);
    surface.addEventListener('pointercancel', release);
    surface.addEventListener('lostpointercapture', release);
    window.addEventListener('keydown', event => {
      if ((event.target as HTMLElement)?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Escape'].includes(event.key)) event.preventDefault();
      this.keys.add(event.key.toLowerCase());
      if (!event.repeat && ['Escape', ' '].includes(event.key)) pause();
    });
    window.addEventListener('keyup', event => this.keys.delete(event.key.toLowerCase()));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });
    surface.addEventListener('contextmenu', event => event.preventDefault());
  }
  private recordPointerPosition(point: { clientX: number; clientY: number }, rect: { width: number; height: number }) {
    if (!Number.isFinite(point.clientX) || !Number.isFinite(point.clientY)) return;
    this.appendDragStroke('x', (point.clientX - this.lastX) / rect.width, 1 / rect.width);
    this.appendDragStroke('y', (point.clientY - this.lastY) / rect.height, 1 / rect.height);
    this.lastX = point.clientX; this.lastY = point.clientY;
  }
  private appendDragStroke(axis: 'x' | 'y', delta: number, threshold: number) {
    const stroke = this.dragAxes[axis], amount = axis === 'x' ? 'dx' : 'dy';
    stroke.threshold = threshold;
    if (!delta) return;
    if (stroke.direction && delta * stroke.direction < 0) {
      stroke.opposed += delta; stroke.unreadOpposed += delta;
      // A subpixel wobble adjusts the target but cannot erase a queued drag.
      // Confirmation is cumulative, so a slow deliberate turn still responds.
      if (Math.abs(stroke.opposed) + Number.EPSILON >= threshold) {
        // Confirmation may span reads; never replay displacement that a
        // previous read has already consumed during a precise correction.
        this[amount] = stroke.unreadOpposed;
        if (axis === 'x') this.reverseX = true; else this.reverseY = true;
        stroke.direction = Math.sign(delta); stroke.opposed = stroke.unreadOpposed = 0;
      } else this[amount] += delta;
    } else {
      stroke.opposed = stroke.unreadOpposed = 0; stroke.direction = Math.sign(delta); this[amount] += delta;
    }
  }
  private resetDragStrokes() {
    for (const axis of [this.dragAxes.x, this.dragAxes.y]) axis.direction = axis.opposed = axis.unreadOpposed = axis.threshold = 0;
  }
  read(dt: number, width: number, height: number, speed: number, position: { x: number; y: number },
    bounds: NativeScrollCameraBounds, camera: { x: number; y: number }) {
    let x = Number(this.keys.has('d') || this.keys.has('arrowright')) - Number(this.keys.has('a') || this.keys.has('arrowleft'));
    let y = Number(this.keys.has('s') || this.keys.has('arrowdown')) - Number(this.keys.has('w') || this.keys.has('arrowup'));
    if (this.held) {
      // Preserve relative drag and the displayed-camera conversion. Consume
      // boundary overflow so reversing never has to repay an invisible offset.
      // Idle fingers keep their accepted target while the camera moves.
      this.rawTarget ??= { ...position };
      this.lastDragCamera ??= { ...camera };
      if (!this.target || this.dx !== 0 || this.dy !== 0) {
        const reverseX = this.reverseX || this.dx * (this.rawTarget.x - position.x) < 0 && Math.abs(this.dx) + Number.EPSILON >= this.dragAxes.x.threshold;
        const reverseY = this.reverseY || this.dy * (this.rawTarget.y - position.y) < 0 && Math.abs(this.dy) + Number.EPSILON >= this.dragAxes.y.threshold;
        // Rebase only the reversed axis: preserve perpendicular travel and
        // honour the same speed cap, even when the old target was not reached.
        this.rawTarget.x = (reverseX ? position.x : this.rawTarget.x + camera.x - this.lastDragCamera.x) + this.dx * width;
        this.rawTarget.y = (reverseY ? position.y : this.rawTarget.y + camera.y - this.lastDragCamera.y) + this.dy * height;
        this.lastDragCamera = { ...camera };
        const target = clampNativePlayerTarget({ x: this.rawTarget.x, z: -this.rawTarget.y }, bounds);
        const tx = target.x - position.x, ty = -target.z - position.y;
        const distance = Math.hypot(tx, ty), lead = Math.max(0, speed) * Math.max(dt, MAX_DRAG_LEAD_SECONDS);
        const ratio = distance > lead ? lead / distance : 1;
        this.target = { x: position.x + tx * ratio, y: position.y + ty * ratio };
        this.rawTarget = { ...this.target };
      }
      const dx = this.target.x - position.x, dy = this.target.y - position.y;
      const distance = Math.hypot(dx, dy), step = Math.min(distance, speed * dt);
      this.dx = this.dy = 0; this.reverseX = this.reverseY = false;
      this.dragAxes.x.unreadOpposed = this.dragAxes.y.unreadOpposed = 0;
      return { x: distance ? dx / distance * step : 0, y: distance ? dy / distance * step : 0, dirX: dx, dirZ: -dy, rawX: dx };
    }
    const length = Math.hypot(x, y) || 1;
    const dirX = x / length, dirZ = -y / length;
    if (!dirX && !dirZ) { this.dx = this.dy = 0; return { x: 0, y: 0, dirX: 0, dirZ: 0, rawX: 0 }; }
    const target = clampNativePlayerTarget({ x: position.x + dirX * speed * dt, z: -position.y + dirZ * speed * dt }, bounds);
    x = target.x - position.x;
    y = -target.z - position.y;
    this.dx = this.dy = 0;
    return { x, y, dirX, dirZ, rawX: dirX };
  }
  clear() { this.keys.clear(); this.clearPointer(); }
  private clearPointer() {
    const pointer = this.pointer;
    this.dx = this.dy = 0; this.pointer = null; this.held = false;
    this.target = this.rawTarget = this.lastDragCamera = null;
    this.reverseX = this.reverseY = false;
    this.resetDragStrokes();
    if (pointer !== null) try { this.surface.releasePointerCapture(pointer); } catch { /* Already released by the browser. */ }
  }
}
