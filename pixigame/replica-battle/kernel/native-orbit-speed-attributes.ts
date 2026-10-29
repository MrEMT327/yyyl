import { nativeFixedFromString } from './native-pending-bullet-attributes';

const unit = 65536n;
const minimum = -(1n << 63n);
const maximum = (1n << 63n) - 1n;

function saturate(raw: bigint): bigint { return raw < minimum ? minimum : raw > maximum ? maximum : raw; }
function toRaw(value: number): bigint { return saturate(BigInt(Math.round(value * 65536))); }
function multiply(left: bigint, right: bigint): bigint { return saturate((left * right) >> 16n); }

export function nativeOrbitSpeed(base: number, percent: number): number {
  return Number(multiply(toRaw(base), unit + toRaw(percent))) / 65536;
}

export class NativeOrbitSpeedAttributes {
  private origin = 0n;
  private current = 0n;

  get originSpeed(): number { return Number(this.origin) / 65536; }
  get currentSpeed(): number { return Number(this.current) / 65536; }

  observe(speed: number): void {
    this.current = toRaw(speed);
    if (!this.origin && this.current) this.origin = this.current;
  }

  attributes(args: Record<string, unknown>): Record<string, number> {
    const result: Record<string, number> = {};
    if (!Array.isArray(args.Attrs)) return result;
    const delta = this.current > this.origin ? this.current - this.origin : 0n;
    const growth = this.origin ? saturate(delta * unit / this.origin) : 0n;
    const scale = toRaw(Number(args.ImproveDamageScale || 0));
    for (const entry of args.Attrs) {
      if (typeof entry !== 'string') continue;
      const parts = entry.split('|');
      if (parts.length < 3 || !parts[0].trim()) continue;
      const change = nativeFixedFromString(parts[1]), cap = nativeFixedFromString(parts[2]);
      if (change === undefined || cap === undefined) continue;
      let value = multiply(multiply(toRaw(change), growth), scale);
      const limit = toRaw(Math.abs(cap));
      if (limit && value > limit) value = limit;
      else if (limit && value < -limit) value = -limit;
      const name = parts[0].trim();
      result[name] = (result[name] || 0) + Number(value) / 65536;
    }
    return result;
  }

  clear(): void { this.origin = 0n; this.current = 0n; }
}
