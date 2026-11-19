import manifest from '../../public/art/ui-images-v1/manifest.json' with {type:'json'};
// CSS custom properties may resolve their URLs in the consuming stylesheet.
export function resolveUiAssetUrl(path) {
  const pageUrl = globalThis.document?.baseURI;
  return pageUrl ? new URL(path, pageUrl).href : path;
}

// PSD originals remain intact. Full-size artwork may use lossless WebP while
// rendered UI continues to use its bounded delivery copies.
export function optimizeUiAssetUrls(markup){
  return String(markup??'').replace(/\bart\/([\w./-]+\.(?:png|webp))\b/g,(url,path)=>{
    const entry=manifest.entries[path];
    return entry?`art/ui-images-v1/${entry.file}`:url;
  });
}
