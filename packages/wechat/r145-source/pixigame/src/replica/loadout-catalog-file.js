/** The compressed copy contains the exact source JSON. Direct source runs and
 * browsers without native gzip support keep reading the plain file. */
export async function readLoadoutCatalogFile(url, missingMessage, fetchResource = fetch) {
  if (import.meta.env?.PROD && typeof DecompressionStream === 'function') {
    try {
      const source = new URL(url, document.baseURI);
      const compressedUrl = new URL('sorties-v1/loadout-catalog.json.gz', source);
      const response = await fetchResource(compressedUrl, {cache:'no-cache'});
      if (response.ok && response.body) {
        return await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
      }
    } catch { /* The plain file also covers an unavailable or broken compressed copy. */ }
  }
  const response = await fetchResource(url, {cache:'no-store'});
  if (!response.ok) throw new Error(missingMessage);
  return await response.json();
}
