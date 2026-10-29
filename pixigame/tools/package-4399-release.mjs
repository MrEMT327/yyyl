import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import JSZip from 'jszip';

const root = resolve(process.cwd());
const distDir = join(root, 'dist');
const platformSdkPath = join(root, 'public', 'cpsdk_4399.js');
const outputRoot = join(root, 'outputs', '4399');
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
const platformSdk = await readFile(platformSdkPath);
const platformSdkText = platformSdk.toString('utf8');
const files = await collectFiles(distDir);
const appBundlePaths = files.filter((absolute) => (
  relative(distDir, absolute).split('\\').join('/').match(/^assets\/index-[^/]+\.js$/)
));
const appBundleText = (await Promise.all(appBundlePaths.map((absolute) => readFile(absolute, 'utf8')))).join('\n');

if (!indexHtml.includes('<html lang="zh-CN">')) {
  throw new Error('4399 构建校验失败：dist/index.html 未声明 zh-CN。');
}
if (!indexHtml.includes('h.api.4399.com/h5mini-2.0/h5api-interface.php')) {
  throw new Error('4399 构建校验失败：入口未加载 4399 H5 API。');
}
if (!platformSdkText.includes('4399 H5 小游戏')
  || !platformSdkText.includes('submitRankScore')
  || !platformSdkText.includes('gameplayStart()')
  || !platformSdkText.includes('gameplayStop()')) {
  throw new Error('4399 构建校验失败：平台 SDK 缺少排行榜或生命周期能力。');
}
if (!appBundleText.includes('.leaderboardEnabled!==!1')
  || /leaderboardEnabled:!1/.test(appBundleText)) {
  throw new Error('4399 构建校验失败：编译后的游戏未开启排行榜入口。');
}
if (!/forcedLanguage:"zh"/.test(appBundleText)) {
  throw new Error('4399 构建校验失败：编译后的游戏未锁定中文。');
}

const zip = new JSZip();
for (const absolute of files) {
  const archivePath = relative(distDir, absolute).split('\\').join('/');
  if (archivePath === 'cpsdk_4399.js') continue;
  zip.file(archivePath, archivePath === 'cpsdk.js' ? platformSdk : await readFile(absolute), {
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
const releaseDir = join(outputRoot, `release-${timestamp()}`);
await mkdir(releaseDir, { recursive: true });
const archivePath = join(releaseDir, '少女航线-4399发布包.zip');
await writeFile(archivePath, archive);

const verified = await JSZip.loadAsync(await readFile(archivePath));
const verifiedSdk = await verified.file('cpsdk.js')?.async('string');
if (!verified.file('index.html') || !verifiedSdk) {
  throw new Error('4399 包校验失败：压缩包根目录缺少 index.html 或 cpsdk.js。');
}
if (!verifiedSdk.includes('4399 H5 小游戏') || verified.file('cpsdk_4399.js')) {
  throw new Error('4399 包校验失败：cpsdk.js 未替换为 4399 适配器。');
}

const digest = createHash('sha256').update(archive).digest('hex');
process.stdout.write(`${JSON.stringify({
  ok: true,
  archivePath,
  files: Object.values(verified.files).filter((entry) => !entry.dir).length,
  bytes: archive.length,
  sha256: digest,
  rankId: 1307,
  language: 'zh-CN',
  debugTools: false,
  languageToggle: false,
  leaderboard: true,
}, null, 2)}\n`);
