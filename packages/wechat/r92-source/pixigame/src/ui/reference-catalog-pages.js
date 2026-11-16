// Pure catalog views; navigation and economy mutations stay in the lobby.
import { cloudNativeCatalog } from '../replica/cloud-native-pages.js';
import { weaponCatalogPage } from './weapon-catalog-page.js';
import { fleetCatalogPage } from './fleet-catalog-page.js';

export function referenceCatalogPage(options) {
  if (options.snapshot?.replicaCollection) return cloudNativeCatalog(options);
  return options.kind === 'aircraft' || options.kind === 'pilot'
    ? fleetCatalogPage(options)
    : weaponCatalogPage(options);
}
