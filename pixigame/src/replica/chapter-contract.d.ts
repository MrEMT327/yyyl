export interface ReplicaChapter {
  id: number; stageIndex: number; name: string; waveCount: number;
  terrain: 'cloud' | 'replica';
}
export function replicaChapter(chapterId: number): ReplicaChapter | undefined;
export function replicaChapterForStage(stageIndex: number): ReplicaChapter | undefined;
