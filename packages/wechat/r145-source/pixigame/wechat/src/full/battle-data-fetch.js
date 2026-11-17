// H5 deliberately reloads editable JSON. A native package pins these exact
// data files to a CDN manifest version, so its battle reader can reuse them.
// Leave the general fetch implementation and explicit reload requests intact.
export function createBattleDataFetch(fetchResource, resources, baseURL) {
  return (input, options = {}) => {
    if ((typeof input === 'string' || input instanceof URL)
      && options.cache === 'no-store' && (options.method || 'GET').toUpperCase() === 'GET'
      && options.body == null && !options.headers && options.credentials == null
      && resources.isVersionedBattleData?.(String(input), baseURL)) {
      return fetchResource(input, {...options, cache: 'default'});
    }
    return fetchResource(input, options);
  };
}
