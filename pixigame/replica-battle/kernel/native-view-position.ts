import type { Point } from './model';

/** EntityView.UpdatePosition@6488590 uses this float render interval,
 * independently of the world's FP delta2184/65536. */
export const nativeViewPositionInterval = 0.03333333507180214;
const nativeViewMoveFinishedDistanceSquared = 0.00009999999747378752;

/** Display-only EntityView position. Collision and movement keep their native
 * logic positions. Evidence: research/native-view-interpolation-contract.md. */
export class NativeViewPosition {
  private start: Point;
  private target: Point;
  private elapsed = 0;
  private moving = false;
  private current: Point;

  constructor(position: Point, private readonly float32 = false) {
    this.current = this.point(position); this.start = this.point(position); this.target = this.point(position);
  }
  get position(): Readonly<Point> { return this.current; }
  private round(value: number) { return this.float32 ? Math.fround(value) : value; }
  private point(position: Point): Point { return { x: this.round(position.x), z: this.round(position.z) }; }

  /** LoadRootGameObject / EntitySetPosProcessor: no interpolation from origin
   * or across the playfield when spawning or explicitly restarting a loop. */
  setPosition(position: Point) {
    this.current = this.point(position); this.start = this.point(position); this.target = this.point(position);
    this.elapsed = 0; this.moving = false;
  }
  /** SetTargetPosition captures the CURRENT rendered transform, not the prior
   * fixed-step snapshot. Bridge position events are handled before update(). */
  setTargetPosition(position: Point, completeImmediately = false) {
    this.start = { ...this.current }; this.target = this.point(position); this.elapsed = 0;
    this.moving = !this.moveFinished();
    if (completeImmediately) this.setPosition(position);
  }
  private moveFinished() {
    const x = this.round(this.current.x - this.target.x), z = this.round(this.current.z - this.target.z);
    return this.round(this.round(x * x) + this.round(z * z)) < nativeViewMoveFinishedDistanceSquared;
  }
  update(renderDelta: number): Readonly<Point> {
    if (!this.moving) return this.current;
    this.elapsed = this.round(this.elapsed + this.round(Math.max(0, renderDelta)));
    const t = Math.min(1, Math.max(0, this.round(this.elapsed / nativeViewPositionInterval)));
    this.current = { x: this.round(this.start.x + this.round(this.round(this.target.x - this.start.x) * t)),
      z: this.round(this.start.z + this.round(this.round(this.target.z - this.start.z) * t)) };
    if (this.moveFinished()) { this.current = { ...this.target }; this.moving = false; }
    return this.current;
  }
}
