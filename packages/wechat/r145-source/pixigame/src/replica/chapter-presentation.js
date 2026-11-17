import {campaignMapForStage,campaignChapterNameForStage} from '../three/campaign-map-catalog.js';

/** Resolve the chapter's own title and the shared map used in battle and previews. */
export function chapterPresentationForStage(index) {
  const scene = campaignMapForStage(index);
  const name = campaignChapterNameForStage(index) ?? scene.name;
  return {name, chapterName: `第 ${index + 1} 章 · ${name}`, mapSceneId: scene.id};
}

/** Preview the actual wall/island/depth assets, including reused map groups.
 * Absolute URLs also work in CSS custom properties consumed by stylesheets. */
export function chapterPreviewBackground(index) {
  const scene=campaignMapForStage(index);
  const layers=scene.previewUrl?[scene.previewUrl,scene.artUrl]:[scene.artUrl,scene.depthUrl].filter(Boolean);
  return [...new Set(layers)].map(path=>`url('${new URL(path,document.baseURI).href}')`).join(',');
}
