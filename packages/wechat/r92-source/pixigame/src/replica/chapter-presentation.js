import { peripheralSceneForStage, FIVE_LAYER_SCENES } from '../three/peripheral-scenes.js';
import { campaignChapterNameForStage } from '../three/campaign-theme-layouts.js';

/** Resolve the chapter's own title and the shared map used in battle and previews. */
export function chapterPresentationForStage(index) {
  const scene = peripheralSceneForStage(index);
  const name = campaignChapterNameForStage(index) ?? scene.name;
  return {name, chapterName: `第 ${index + 1} 章 · ${name}`, mapSceneId: scene.id};
}

/** Preview the actual wall/island/depth assets, including reused map groups.
 * Absolute URLs also work in CSS custom properties consumed by stylesheets. */
export function chapterPreviewBackground(index) {
  const scene=peripheralSceneForStage(index);
  const layers=scene.previewUrl?[scene.previewUrl,scene.artUrl]:[scene.artUrl,FIVE_LAYER_SCENES[scene.id]?.urls.islands,scene.depthUrl].filter(Boolean);
  return [...new Set(layers)].map(path=>`url('${new URL(path,document.baseURI).href}')`).join(',');
}
