// Local 1.1.6 Chapter_MainChapter.mapStyle -> Chapter_MapStyle.tilePrefab.
// This controls only which ORIGINAL artwork package is shared, not gameplay.
// A group does not imply that its chapters are ready/playable.
export const CHAPTER_MAP_GROUPS = Object.freeze([
  ['s_map0017_2', [1,14]],
  ['s_map0021_1', [2]],
  ['s_map0018_1', [3,10,15]],
  ['s_map0019_1', [4,16]],
  ['s_map0021_2', [5,11,17,20,27]],
  ['s_map0014_1', [6]],
  ['s_map0022_1', [7,19]],
  ['s_map0011_1', [8]],
  ['s_map0024_1', [9,13]],
  ['s_map0025_1', [12]],
  ['s_map0025_2', [18,36]],
  ['s_map0006_1', [21,29,38]],
  ['s_map0006_3', [22,31,40]],
  ['s_map0006_2', [23,32]],
  ['s_map0020_1', [24,28,33,37]],
  ['s_map0016_1', [25,30,34,39]],
  ['s_map0023_1', [26,35,41,51]],
  ['s_map0004_4', [42,45,48,52,55,58]],
  ['s_map0004_2', [43,46,49,53,56,59]],
  ['s_map0004_3', [44,47,50,54,57,60]],
].map(([prefab, chapterIds]) => Object.freeze({prefab, chapterIds:Object.freeze(chapterIds), firstChapter:chapterIds[0]})));
const byChapter = new Map(CHAPTER_MAP_GROUPS.flatMap(group => group.chapterIds.map(id => [id, group])));
export function chapterMapGroup(chapterId) { return byChapter.get(chapterId); }
export function chapterMapRepresentativeStage(stageIndex) {
  const group = byChapter.get(stageIndex + 1);
  return group ? group.firstChapter - 1 : stageIndex;
}
