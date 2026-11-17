const snapshotArt = 'replica-battle/assets/';
const portraitReferences = [
  'art/luna-maid-v1/source/', 'art/luna-maid-v1/texture_00.png',
  'art/orange-jetboard-v5/reference/', 'art/purple-doctor-v1/source/',
  'art/white-gold-luoen-r13/assets/luoen_4/', 'audio/pathogenic/',
];

export function auditWechatCdn(cdn, index, approvedArt, localFiles) {
  const files = new Map(cdn.entries.map(row => [row.path, row.sha256]));
  const forbidden = [...index.forbiddenRoots, ...portraitReferences];
  const check = (path, hash) => {
    const known = index.hashes.get(hash);
    if (forbidden.some(root => root.endsWith('/') ? path.startsWith(root) : path === root))
      throw new Error('发布清单包含参考素材：' + path);
    if (known?.kind === "original-media") throw new Error("发布清单包含原版素材：" + path);
    const snapshot = path.startsWith(snapshotArt) || known || index.paths.has(path);
    if (snapshot && !path.startsWith('replica-battle/data/') && (!hash || approvedArt[path]?.sha256 !== hash))
      throw new Error('发布清单缺少原创或授权素材依据：' + path);
  };
  for (const [path, hash] of files) check(path, hash);
  for (const [path, { path: file }] of Object.entries(cdn.transfers)) {
    if (!files.has(file)) throw new Error("CDN传输文件未登记：" + file);
    check(path, files.get(file));
  }
  for (const path of Object.keys(localFiles)) check(path, files.get(path));
  return [...files.keys()];
}
