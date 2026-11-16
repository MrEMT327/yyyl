import presentation from '../public/data/wave-presentation.json';
import type { OriginalUpgradeAnimation } from './ui-animation';

export interface WaveUIRequest { id: number; type: 1 | 2 | 4 | 5; previousMissionType?: number }

/** Command 22 is emitted by the original animation event, rather than the
 * end of its transparent tail. HUD type 1's later MoveInFinish/scroll/shine
 * events do not block the mission. This bridges that timing to the H5 HUD. */
export class WaveUIPresentation {
  private generation = -1;
  private requestId = -1;
  private clock = 0;
  private previousTime = performance.now();
  private completeAt = Infinity;
  private completion?: () => void;

  constructor(private animation: OriginalUpgradeAnimation, private root: HTMLElement) {}

  update(request: WaveUIRequest | undefined, generation: number, playing: boolean, complete: (id: number) => void) {
    const now = performance.now();
    if (playing) this.clock += (now - this.previousTime) / 1000;
    this.previousTime = now;
    if (this.generation !== generation) {
      this.generation = generation; this.requestId = -1;
      this.completeAt = Infinity; this.completion = undefined;
      this.animation.clearWarning();
    }
    if (request && request.id !== this.requestId) {
      this.requestId = request.id;
      this.completeAt = Infinity; this.completion = undefined;
      const id = request.id;
      const finish = () => {
        if (generation === this.generation && this.requestId === id) complete(id);
      };
      if (request.type === 1) {
        const delay = request.previousMissionType === 2
          ? presentation.hudProgress.preDelay.previousMissionType2 : presentation.hudProgress.preDelay.normal;
        this.completeAt = this.clock + delay + presentation.hudProgress.finishEvent.time;
        this.completion = finish;
      } else if (request.type === 2 || request.type === 5) {
        this.animation.showWarning(this.root, request.type, finish, () => this.clock);
      }
    }
    if (playing && this.clock >= this.completeAt && this.completion) {
      const finish = this.completion; this.completion = undefined; this.completeAt = Infinity; finish();
    }
  }
}
