import { copyFile, mkdir, readdir, readFile, realpath, rm } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import {removeRetiredRuntimeAssets} from './runtime-asset-retirement.mjs';

export async function removeRetiredPortraitDirectories(output, entries) {
  const base = await realpath(output);
  for (const entry of entries) {
    if (!/^art\/[a-z0-9-]+$/.test(entry)) throw new Error(`Invalid retired portrait directory: ${entry}`);
    const target = resolve(base, entry);
    let actual;
    try { actual = await realpath(target); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const path = relative(base, actual);
    if (!path || path.startsWith('..') || isAbsolute(path)) throw new Error('Retired portrait escapes build output');
    await rm(target, { recursive:true, force:false });
  }
}

// Public QA mounts can point to recordings and temporary builds on another
// drive. Keep them available to the dev server without copying them to releases.
export function copyShippingPublic() {
  let source, destination;
  return {
    name: 'thunder-shipping-public',
    apply: 'build',
    configResolved(config) {
      source = config.publicDir;
      destination = resolve(config.root, config.build.outDir);
    },
    async writeBundle() {
      if (!source) return;
      async function copyDirectory(from, to) {
        await mkdir(to, { recursive: true });
        for (const entry of await readdir(from, { withFileTypes: true })) {
          if (entry.name.startsWith('__') || entry.isSymbolicLink()) continue;
          const input = resolve(from, entry.name), output = resolve(to, entry.name);
          if (entry.isDirectory()) await copyDirectory(input, output);
          else if (entry.isFile()) await copyFile(input, output);
        }
      }
      await copyDirectory(source, destination);
      // emptyOutDir is intentionally false: retire explicitly named assets so
      // incremental builds cannot keep a removed portrait's old files alive.
      const contract = JSON.parse(await readFile(new URL('../doc/portrait-resources.json', import.meta.url), 'utf8'));
      await removeRetiredPortraitDirectories(destination, contract.retiredPublicDirectories || []);
    },
    // Other writeBundle hooks may emit imported assets in parallel. Retire
    // their stale files only after every writer has finished.
    async closeBundle() {
      if(!destination)return;
      const retired=JSON.parse(await readFile(new URL('./retired-runtime-assets.json',import.meta.url),'utf8'));
      await removeRetiredRuntimeAssets(destination,retired.assets);
    },
  };
}
