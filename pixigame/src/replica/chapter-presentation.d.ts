export interface ChapterPresentation {
  name: string;
  chapterName: string;
  mapSceneId: string;
}
export function chapterPresentationForStage(index: number): ChapterPresentation;
export function chapterPreviewBackground(index: number): string;
