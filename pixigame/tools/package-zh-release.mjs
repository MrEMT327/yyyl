import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
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
const archivePaths = new Set(files.map((absolute) => relative(distDir, absolute).split('\\').join('/')));
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
    throw new Error(`CDN 构建校验失败：${relative(distDir, absolute)} 含根路径 CSS 资源。`);
  }
}

const appBundlePaths = files.filter((absolute) => (
  relative(distDir, absolute).split('\\').join('/').match(/^assets\/index-[^/]+\.js$/)
));
const appBundleText = (await Promise.all(appBundlePaths.map((absolute) => readFile(absolute, 'utf8')))).join('\n');
if (!/forcedLanguage:"zh"/.test(appBundleText)) {
  throw new Error('中文构建校验失败：编译后的游戏未锁定中文。');
}

const zip = new JSZip();
for (const absolute of files) {
  const archivePath = relative(distDir, absolute).split('\\').join('/');
  if (archivePath === 'cpsdk_4399.js') continue;
  zip.file(archivePath, await readFile(absolute), {
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
const releaseDir = join(outputRoot, `release-zh-${timestamp()}`);
await mkdir(releaseDir, { recursive: true });
const archivePath = join(releaseDir, '少女航线-中文CDN包.zip');
await writeFile(archivePath, archive);

const verified = await JSZip.loadAsync(await readFile(archivePath));
if (!verified.file('index.html') || !verified.file('cpsdk.js')) {
  throw new Error('中文包校验失败：压缩包根目录缺少 index.html 或 cpsdk.js。');
}
if (verified.file('cpsdk_4399.js')) {
  throw new Error('CDN 包校验失败：压缩包不应包含 4399 平台适配器。');
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
}, null, 2)}\n`);
