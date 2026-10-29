import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import JavaScriptObfuscator from 'javascript-obfuscator';
import JSZip from 'jszip';

const root = resolve(process.cwd());
const distDir = join(root, 'dist');
const outputRoot = join(root, 'outputs');
const fixedZipDate = new Date('1980-01-01T00:00:00.000Z');

function timestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function archivePathFor(absolute) {
  return relative(distDir, absolute).split('\\').join('/');
}

const indexHtml = await readFile(join(distDir, 'index.html'), 'utf8');
if (!indexHtml.includes('<html lang="zh-CN">')) {
  throw new Error('中文构建校验失败：dist/index.html 未声明 zh-CN。');
}
if (indexHtml.includes('h.api.4399.com')) {
  throw new Error('CDN 构建校验失败：通用中文包不应加载 4399 平台脚本。');
}

const entryReferences = [...indexHtml.matchAll(/\b(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1]);
const rootRelativeReferences = entryReferences.filter((reference) => /^\/(?!\/)/.test(reference));
if (rootRelativeReferences.length) {
  throw new Error(`CDN 构建校验失败：入口仍含根路径资源 ${rootRelativeReferences.join(', ')}`);
}

const files = await collectFiles(distDir);
const archivePaths = new Set(files.map(archivePathFor));
const missingEntryAssets = entryReferences
  .filter((reference) => !/^(?:[a-z]+:)?\/\//i.test(reference) && !reference.startsWith('data:') && !reference.startsWith('#'))
  .map((reference) => reference.replace(/^\.\//, '').split(/[?#]/, 1)[0])
  .filter((reference) => reference && !archivePaths.has(reference));
if (missingEntryAssets.length) {
  throw new Error(`CDN 构建校验失败：入口引用的文件不存在 ${missingEntryAssets.join(', ')}`);
}

const textAssets = files.filter((absolute) => /\.(?:css|js)$/i.test(absolute));
for (const absolute of textAssets) {
  const content = await readFile(absolute, 'utf8');
  if (/url\(\s*(['"]?)\/(?!\/)/i.test(content)) {
    throw new Error(`CDN 构建校验失败：${archivePathFor(absolute)} 含根路径 CSS 资源。`);
  }
}

const appBundlePaths = files.filter((absolute) => /^assets\/index-[^/]+\.js$/.test(archivePathFor(absolute)));
if (appBundlePaths.length !== 1) {
  throw new Error(`加固构建校验失败：预期一个主业务 JS，实际找到 ${appBundlePaths.length} 个。`);
}

const appBundlePath = appBundlePaths[0];
const appBundleSource = await readFile(appBundlePath, 'utf8');
if (!/forcedLanguage:"zh"/.test(appBundleSource)) {
  throw new Error('中文构建校验失败：编译后的游戏未锁定中文。');
}

// Only obfuscate the application bundle. SDK adapters and third-party/public API
// names must stay untouched so platform integration remains stable.
const obfuscatedBundle = JavaScriptObfuscator.obfuscate(appBundleSource, {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  identifiersPrefix: '_0xg',
  renameGlobals: false,
  renameProperties: false,
  seed: 20260819,
  selfDefending: false,
  simplify: true,
  sourceMap: false,
  splitStrings: false,
  stringArray: true,
  stringArrayCallsTransform: false,
  stringArrayEncoding: ['base64'],
  stringArrayIndexesType: ['hexadecimal-number'],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 0.4,
  target: 'browser',
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
}).getObfuscatedCode();

if (obfuscatedBundle === appBundleSource || !obfuscatedBundle.includes('_0xg')) {
  throw new Error('加固构建校验失败：主业务 JS 未产生有效混淆。');
}

const zip = new JSZip();
for (const absolute of files) {
  const archivePath = archivePathFor(absolute);
  if (archivePath === 'cpsdk_4399.js') continue;
  const content = absolute === appBundlePath
    ? Buffer.from(obfuscatedBundle, 'utf8')
    : await readFile(absolute);
  zip.file(archivePath, content, {
    binary: true,
    date: fixedZipDate,
    createFolders: true,
  });
}

const archive = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
  platform: 'UNIX',
});
const releaseDir = join(outputRoot, `release-zh-obfuscated-${timestamp()}`);
await mkdir(releaseDir, { recursive: true });
const archivePath = join(releaseDir, '少女航线-中文CDN加固包.zip');
await writeFile(archivePath, archive);

const verified = await JSZip.loadAsync(await readFile(archivePath));
if (!verified.file('index.html') || !verified.file('cpsdk.js')) {
  throw new Error('中文加固包校验失败：压缩包根目录缺少 index.html 或 cpsdk.js。');
}
if (verified.file('cpsdk_4399.js')) {
  throw new Error('CDN 加固包校验失败：压缩包不应包含 4399 平台适配器。');
}
const verifiedBundle = await verified.file(archivePathFor(appBundlePath)).async('string');
if (verifiedBundle !== obfuscatedBundle || !verifiedBundle.includes('_0xg')) {
  throw new Error('中文加固包校验失败：压缩包中的主业务 JS 未正确混淆。');
}

const digest = createHash('sha256').update(archive).digest('hex');
process.stdout.write(`${JSON.stringify({
  ok: true,
  archivePath,
  files: Object.values(verified.files).filter((entry) => !entry.dir).length,
  bytes: archive.length,
  sha256: digest,
  language: 'zh-CN',
  cdnReady: true,
  relativeAssetPaths: true,
  thirdPartyPlatformSdk: false,
  obfuscation: {
    scope: archivePathFor(appBundlePath),
    profile: 'conservative-browser',
    originalBytes: Buffer.byteLength(appBundleSource),
    obfuscatedBytes: Buffer.byteLength(obfuscatedBundle),
    propertyRenaming: false,
    controlFlowFlattening: false,
  },
}, null, 2)}\n`);
