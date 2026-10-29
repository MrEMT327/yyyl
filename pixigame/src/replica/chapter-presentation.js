import { peripheralSceneForStage, FIVE_LAYER_SCENES } from '../three/peripheral-scenes.js';

/** The same scene resolver drives combat terrain, chapter labels and previews.
 * Only presentation is returned; source chapter IDs and encounter tables stay intact. */
export function chapterPresentationForStage(index) {
  const scene=peripheralSceneForStage(index);
  return {name:scene.name,chapterName:`第 ${index+1} 章 · ${scene.name}`,mapSceneId:scene.id};
}

/** Preview the actual wall/island/depth assets, including reused map groups.
 * Absolute URLs also work in CSS custom properties consumed by stylesheets. */
export function chapterPreviewBackground(index) {
  const scene=peripheralSceneForStage(index);
  const layers=[scene.artUrl,FIVE_LAYER_SCENES[scene.id]?.urls.islands,scene.depthUrl].filter(Boolean);
  return [...new Set(layers)].map(path=>`url('${new URL(path,document.baseURI).href}')`).join(',');
}
