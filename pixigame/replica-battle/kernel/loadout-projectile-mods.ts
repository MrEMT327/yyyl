export interface NativeColliderScaleParameters { StartScale?: number; TargetScale?: number; ScaleTime?: number; WaitTime?: number; Trigger?: number }

/** ScaleOnlyColliderModProcessor@6d3ea3c/6d3eb8c/6d3ed60/6d3edf0.
 * ForceSetScale(scale,false) changes the logic shape without a view-scale
 * notification. Return the absolute shape scale, never an image multiplier.
 * All omitted numeric fields are zero in the original parameter constructor. */
export class NativeColliderScale {
  private elapsed = 0;
  private enabled: boolean;
  private waitFinished: boolean;
  scale: number;
  constructor(private readonly parameters: NativeColliderScaleParameters) {
    this.scale = Number(parameters.StartScale || 0);
    this.enabled = Number(parameters.Trigger || 0) !== 1;
    this.waitFinished = Number(parameters.WaitTime || 0) < 1 / 65536;
  }
  event(id: number): void {
    // EntityComponentEventId 28 resets/enables even an already started mod.
    if (id === 28) { this.elapsed = 0; this.enabled = true; }
  }
  step(deltaTime: number): number {
    if (!this.enabled) return this.scale;
    this.elapsed += deltaTime;
    if (!this.waitFinished) {
      if (this.elapsed >= Number(this.parameters.WaitTime || 0)) { this.waitFinished = true; this.elapsed = 0; }
      return this.scale;
    }
    const duration = Number(this.parameters.ScaleTime || 0);
    let fraction = duration ? Math.trunc(this.elapsed / duration * 65536) / 65536 : 0;
    if (this.elapsed >= duration) { fraction = 1; this.enabled = false; }
    const start = Number(this.parameters.StartScale || 0), end = Number(this.parameters.TargetScale || 0);
    this.scale = start + Math.floor((end - start) * fraction * 65536) / 65536;
    return this.scale;
  }
}
