import source from '../skill-fallback-source.json';
import type { Choice, RecordData } from './model';

const rows = source.skills as Record<number, RecordData>;
const weights = new Map(source.pool.map(row => [row.GetID, row.Weight]));
const plain = (value: string) => value.replace(/<[^>]*>/g, '');

export function nativeFallbackReward(id: number, chapter: RecordData):
  { kind: 'heal'; percent: number } | { kind: 'gold'; amount: number } | undefined {
  const row = rows[id];
  if (!row) return undefined;
  const healing = row.AddAttributes.find((value: string) => value.startsWith('RecoverHP%='));
  if (healing) return { kind: 'heal', percent: Number(healing.split('=')[1]) };
  const param = JSON.parse(source.goldTrigger.ActionParam);
  // DoAddGoldByPercent@6ba099c: Type 1 uses the chapter's passive-selection
  // gold base; its configured Gold is multiplied directly, without /100.
  return { kind: 'gold', amount: Math.imul(param.Gold, Number(chapter.skillSelectPassiveGold)) };
}

function card(id: number, chapter: RecordData): Choice {
  const raw = rows[id], reward = nativeFallbackReward(id, chapter)!;
  const language = source.language as Record<string, string>;
  const amount = reward.kind === 'heal' ? `${reward.percent}%` : String(reward.amount);
  return { id, group: raw.BattleSkillGroup, star: 0, raw,
    name: language[raw.LanguageNameId],
    description: plain(language[raw.LanguageInfoId].replace('{0}', amount)),
    icon: raw.IconName, effects: [] };
}

/** GetInginiteSkill@6cab2d8 clears its temporary result for EACH draw.
 * Duplicates are allowed. GetRandomCount mutates the persistent pool order:
 * the chosen item swaps with the last eligible item, even for a one-item draw.
 * Battle RNG is supplied by the host, as for the other reconstructed pools.
 */
export class NativeSkillFallbackPool {
  private order = source.pool.map(row => row.GetID);

  reset() { this.order = source.pool.map(row => row.GetID); }

  supplement(choices: Choice[], canStudy: (id: number) => boolean,
    random: () => number, chapter: RecordData): Choice[] {
    if (choices.length > 1) return choices;
    const result = choices.slice();
    while (result.length < 2) {
      const eligible = this.order.filter(id => canStudy(id) && weights.get(id)! > 0);
      const total = eligible.reduce((sum, id) => sum + weights.get(id)!, 0);
      if (!eligible.length || total <= 0) break;
      // XXRandom.Next(1,total): inclusive lower, exclusive upper. The native
      // accumulator selects on <=0, rather than the ordinary pool's FP ticket.
      let ticket = total > 1 ? 1 + Math.floor(Math.max(0, Math.min(1 - Number.EPSILON, random())) * (total - 1)) : 1;
      const selected = eligible.find(id => (ticket -= weights.get(id)!) <= 0)!;
      const index = this.order.indexOf(selected), last = this.order.indexOf(eligible.at(-1)!);
      [this.order[index], this.order[last]] = [this.order[last], this.order[index]];
      result.push(card(selected, chapter));
    }
    return result;
  }
}
