import type { NativeScrollCameraBounds } from './native-scroll-camera';
import { clampNativePlayerTarget } from './native-camera-projection';

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
  constructor(private surface: HTMLElement, private canMove: () => boolean, private pause: () => void) {
    surface.addEventListener('pointerdown', event => {
      if (!canMove() || (event.target as HTMLElement).closest('button, .overlay')) return;
      if (this.pointer !== null) return;
      this.pointer = event.pointerId;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.held = true;
      this.target = this.rawTarget = this.lastDragCamera = null; this.dx = this.dy = 0;
      surface.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    surface.addEventListener('pointermove', event => {
      if (this.pointer !== event.pointerId) return;
      const rect = surface.getBoundingClientRect();
      if (canMove()) {
        this.dx += (event.clientX - this.lastX) / rect.width;
        this.dy += (event.clientY - this.lastY) / rect.height;
      }
      this.lastX = event.clientX;
      this.lastY = event.clientY;
    });
    const release = (event: PointerEvent) => {
      if (event.pointerId === this.pointer) { this.pointer = null; this.held = false; this.target = this.rawTarget = this.lastDragCamera = null; this.dx = this.dy = 0; }
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
    surface.addEventListener('contextmenu', event => event.preventDefault());
  }
  read(dt: number, width: number, height: number, speed: number, position: { x: number; y: number },
    bounds: NativeScrollCameraBounds, camera: { x: number; y: number }) {
    let x = Number(this.keys.has('d') || this.keys.has('arrowright')) - Number(this.keys.has('a') || this.keys.has('arrowleft'));
    let y = Number(this.keys.has('s') || this.keys.has('arrowdown')) - Number(this.keys.has('w') || this.keys.has('arrowup'));
    if (this.held) {
      // Native drag world positions use the CURRENT displayed camera and a
      // drag-start offset. Keep the unclipped request; clamp only on input,
      // not on idle frames as the camera moves around a stationary finger.
      this.rawTarget ??= { ...position };
      this.lastDragCamera ??= { ...camera };
      if (!this.target || this.dx !== 0 || this.dy !== 0) {
        this.rawTarget.x += this.dx * width + camera.x - this.lastDragCamera.x;
        this.rawTarget.y += this.dy * height + camera.y - this.lastDragCamera.y;
        this.lastDragCamera = { ...camera };
        const target = clampNativePlayerTarget({ x: this.rawTarget.x, z: -this.rawTarget.y }, bounds);
        this.target = { x: target.x, y: -target.z };
      }
      const dx = this.target.x - position.x, dy = this.target.y - position.y;
      const distance = Math.hypot(dx, dy), step = Math.min(distance, speed * dt);
      this.dx = this.dy = 0;
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
  clear() { this.dx = this.dy = 0; this.keys.clear(); this.pointer = null; this.held = false; this.target = this.rawTarget = this.lastDragCamera = null; }
}
