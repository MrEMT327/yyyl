// Nested battle documents opt into the host's public artwork directory.
// Do not change document.baseURI: the native kernel still loads its own assets.
const configuredBase = import.meta.env?.BASE_URL ?? '/';
const documentRef = globalThis.document;
const relativeRoot = documentRef?.querySelector('meta[name="cloud-asset-base"]')?.content;
export const cloudAssetBase = relativeRoot
  ? new URL(configuredBase, new URL(relativeRoot, documentRef.baseURI)).href
  : configuredBase;
