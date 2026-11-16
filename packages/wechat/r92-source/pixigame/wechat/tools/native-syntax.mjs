import { parse } from 'acorn';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Preview packaging parses code separately from the simulator. Keep all native
// bundles on one baseline, even when the desktop runtime accepts newer syntax.
export const NATIVE_ECMA_VERSION = 2018;
export const NATIVE_JS_TARGET = `es${NATIVE_ECMA_VERSION}`;
export const NATIVE_INJECT = [fileURLToPath(new URL('../src/full/native-base64.js', import.meta.url))];

export function assertNativeScript(source, file) {
  try {
    parse(source, { ecmaVersion: NATIVE_ECMA_VERSION, sourceType: 'script' });
  } catch (cause) {
    throw new SyntaxError(`WeChat preview syntax: ${file}: ${cause.message}`, { cause });
  }
  return { file, bytes: Buffer.byteLength(source) };
}

export async function assertNativePackage(directory) {
  const root = resolve(directory), files = [];
  async function visit(folder) {
    const entries = await readdir(folder, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const path = join(folder, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Unexpected package symlink: ${path}`);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(assertNativeScript(await readFile(path, 'utf8'), relative(root, path).replaceAll('\\', '/')));
      }
    }
  }
  await visit(root);
  if (!files.length) throw new Error(`No JavaScript files in native package: ${root}`);
  return { target: NATIVE_JS_TARGET, ecmaVersion: NATIVE_ECMA_VERSION, files };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('Specify a WeChat package directory');
  console.log(JSON.stringify(await assertNativePackage(process.argv[2]), null, 2));
}
