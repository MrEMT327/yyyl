import { readFile, readdir, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Static file/JSON/source comparison only. Never imports or executes gameplay,
// geometry, numerical calculations, a browser, test code or combat simulation.
const project = fileURLToPath(new URL('../', import.meta.url));
const root = resolve(project, 'replica-battle'), publicRoot = resolve(project, 'public/replica-battle');
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const manifest = await json(resolve(root, 'source-manifest.json'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const overrides = new Map(manifest.integrationOverrides.map(row => [row.path, row]));
const violations = [];
let reversiblePatches = 0;
for (const row of manifest.files) {
  const bytes = await readFile(resolve(root, row.path)), override = overrides.get(row.path);
  if (sha(bytes) !== (override?.sha256 || row.sha256)) violations.push(row.path);
  if (!override) continue;
  // Prove that only the declared display/home edits separate this file from
  // the captured original; animation/selection programs are not substituted.
  let original = bytes.toString('utf8');
  for (const patch of [...override.patches].reverse()) {
    if (original.split(patch.after).length !== 2) violations.push(`patch-anchor/${row.path}`);
    original = original.replace(patch.after, patch.before);
  }
  if (sha(original) !== override.originalNormalizedSha256) violations.push(`patch-reversal/${row.path}`);
  else reversiblePatches++;
}
for (const row of [...manifest.publicFiles, ...(manifest.originalAssetAdditions || [])]) {
  if (sha(await readFile(resolve(publicRoot, row.path))) !== row.sha256) violations.push(`public/${row.path}`);
}
const localize = value => {
  if (typeof value === 'string') return value.replace(/^\/assets\//, 'assets/');
  if (Array.isArray(value)) return value.map(localize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,localize(v)]));
  return value;
};
const mirror = resolve(root, 'public/data'), tables = await readdir(mirror);
for (const name of tables) {
  if (JSON.stringify(localize(await json(resolve(publicRoot, 'data', name)))) !== JSON.stringify(await json(resolve(mirror, name))))
    violations.push(`table/${name}`);
}
for (const name of ['style.css', 'original-ui.css']) {
  const original = await readFile(resolve(root, 'kernel', name), 'utf8');
  const served = await readFile(resolve(publicRoot, name), 'utf8');
  if (original.replaceAll('\r\n','\n').replaceAll('/assets/', './assets/') !== served.replaceAll('\r\n','\n')) violations.push(`css/${name}`);
}

const mapFile = resolve(root, 'weapon-skin-correspondence.json'), mapping = await json(mapFile);
if (sha(await readFile(mapFile)) !== manifest.appearanceRevision.weapons.correspondenceSha256) violations.push('weapon-map/hash');
if (mapping.snapshotRevision !== manifest.sourceRevision) violations.push('weapon-map/source-revision');
const combat = await json(resolve(publicRoot,'data/combat.json'));
const selection = await json(resolve(publicRoot,'data/skill-selection.json'));
const assets = await json(resolve(publicRoot,'data/assets.json'));
const kinds = new Map(), sourceIcons = new Set();
let stageCount = 0;
for (const family of Object.values(combat.families)) {
  const skin = mapping.families[family.id];
  if (!skin || skin.entityId !== family.entityId) { violations.push(`weapon-family/${family.id}`); continue; }
  if (skin.kind === 'replica' && skin.itemId !== null) violations.push(`fabricated-fallback/${family.id}`);
  sourceIcons.add(family.icon);
  for (const stage of family.stages) {
    stageCount++;
    const row = mapping.stages[stage.skillId];
    const kind = ({1:'breakthrough',2:'minor'})[selection.skills[stage.skillId].IsUpgrade] || 'acquire';
    if (!row || row.familyId !== family.id || row.star !== stage.star || row.kind !== kind
      || JSON.stringify(row.childIds) !== JSON.stringify(stage.optionIds)) violations.push(`weapon-stage/${stage.skillId}`);
    for (const id of stage.optionIds) {
      const card = combat.cards[id], branch = mapping.branches[id]; kinds.set(id, kind);
      if (!branch || branch.familyId !== family.id || branch.name !== card.name || branch.kind !== kind
        || branch.icon !== card.icon || !branch.parentStageIds.includes(stage.skillId)
        || branch.artSource !== 'replica' || branch.dedicatedCloudAsset !== null) violations.push(`weapon-branch/${id}`);
      if (branch) sourceIcons.add(branch.icon);
    }
  }
}
if (Object.keys(mapping.stages).length !== stageCount || Object.keys(mapping.branches).length !== kinds.size)
  violations.push('weapon-map/orphan-or-missing-ids');
for (const key of sourceIcons) {
  const url = assets.sprites[key]?.url;
  if (!url || !/^\/?assets\//.test(url)) { violations.push(`original-weapon-icon/${key}`); continue; }
  try { await access(resolve(publicRoot,url.replace(/^\//,'').split('?')[0])); }
  catch { violations.push(`original-weapon-image/${url}`); }
}
const skinSource = await readFile(resolve(project,'src/replica/weapon-skins.js'),'utf8');
if (skinSource.includes('const FORMS') || skinSource.includes('const REINFORCEMENTS') || skinSource.includes('trimId'))
  violations.push('composed-weapon-form');
for (const file of manifest.appearanceRevision.weapons.sourceFiles) {
  if (sha(await readFile(resolve(project,file.path))) !== file.sha256) violations.push(`cloud-model/${file.path}`);
}
const host = await json(resolve(project,'package.json')), original = manifest.dependencySnapshot;
for (const [name, version] of Object.entries(original.dependencies)) if (host.dependencies[name] !== version)
  violations.push(`dependency/${name}`);
if (host.devDependencies.typescript !== original.devDependencies.typescript) violations.push('dependency/typescript');

// Compare the adapter's ID index and cloud gear records to this exact capture.
// This reads data only: no battle execution or gameplay tests.
const loadoutCatalog = await json(resolve(publicRoot,'data/loadout-catalog.json'));
const equipmentReference = await json(resolve(project,'src/peripheral/equipment-reference-data.json'));
const equipmentIndex = await json(resolve(project,'src/replica/loadout-equipment-index.json'));
const expectedEquipment = loadoutCatalog.equipment.map(row => ({id:Number(row.id),slot:Number(row.slot),maxLevel:Number(row.maxLevel)}));
const expectedSlots = [...new Set(expectedEquipment.map(row=>row.slot))].sort((a,b)=>a-b);
if (equipmentIndex.version !== 1 || equipmentIndex.sourceRevision !== manifest.sourceRevision
  || JSON.stringify(equipmentIndex.equipment) !== JSON.stringify(expectedEquipment)
  || JSON.stringify(equipmentIndex.slots) !== JSON.stringify(expectedSlots)) violations.push('loadout-equipment-index');
for (const row of equipmentReference.equip) {
  const originalRow = loadoutCatalog.equipment.find(item=>item.id===row.ID);
  if (!originalRow) { violations.push('loadout-equipment-missing/'+row.ID); continue; }
  for (const key of ['baseAttribute','AttributeOnLevelUp','FeatureJson','NextID','equipType'])
    if (JSON.stringify(row[key]) !== JSON.stringify(originalRow.raw[key])) violations.push('loadout-equipment-rule/'+row.ID+'/'+key);
}

const progressionIndex = await json(resolve(project,'src/replica/loadout-progression-index.json'));
const collectionIndex = rows => rows.map(row=>({id:row.id,stars:(row.stars?.length ? row.stars : loadoutCatalog.guns.find(base=>base.id===row.baseGunId)?.stars || []).map(star=>Number(star.Star??star.star))}));
const expectedProgression = {version:1,sourceRevision:manifest.sourceRevision,
  skins:collectionIndex(loadoutCatalog.planes.filter(row=>row.kind!=='base')),
  guns:collectionIndex(loadoutCatalog.guns),pilots:collectionIndex(loadoutCatalog.pilots),
  labs:loadoutCatalog.labs.map(row=>({id:row.id,levels:row.levels.map(level=>Number(level.Level))}))};
if (JSON.stringify(progressionIndex)!==JSON.stringify(expectedProgression)) violations.push('native-progression-index');
const nativeChapters = await json(resolve(publicRoot,'data/chapters.json'));
const chapterIndex = await json(resolve(project,'src/replica/chapter-correspondence.json'));
if (chapterIndex.sourceRevision!==manifest.sourceRevision || chapterIndex.chapters.length!==nativeChapters.chapters.length) violations.push('chapter-correspondence');
for (const native of nativeChapters.chapters) {
  const entry = chapterIndex.chapters.find(row=>row.id===native.id);
  if (!entry || entry.stageIndex!==native.id-1 || entry.name!==native.name || entry.waveCount!==native.waveCount
    || !['cloud','replica'].includes(entry.terrain)) violations.push('chapter-correspondence/'+native.id);
  for (const file of [native.chapterFile,native.geometryFile]) try { await access(resolve(publicRoot,'data',file+'.json')); }
    catch { violations.push('chapter-dependency/'+file); }
}

// Optional live source parity check. Normal builds use the immutable capture,
// remaining independent of the research project's later in-progress edits.
let currentSourceDifferences;
if (process.argv.includes('--compare-source')) {
  currentSourceDifferences = [];
  for (const row of manifest.files) {
    if (sha(await readFile(resolve(manifest.source,'src',row.path.replace(/^kernel\//,'')))) !== row.sha256) currentSourceDifferences.push(row.path);
  }
  for (const row of manifest.publicFiles) {
    if (sha(await readFile(resolve(manifest.source,'public',row.path))) !== row.sha256) currentSourceDifferences.push(`public/${row.path}`);
  }
  if (currentSourceDifferences.length) violations.push('current-source-changed-after-capture');
}
const report = { kind:'static-file-and-correspondence-comparison', engine:manifest.engine,
  sourceRevision:manifest.sourceRevision, sourceCapturedAt:manifest.sourceCapturedAt,
  sourceFiles:manifest.files.length, byteIdenticalSourceFiles:manifest.files.length-overrides.size,
  presentationOverrides:[...overrides.values()].filter(row=>row.kind!=='gameplay-repair').map(row=>row.path),
  gameplayRepairs:[...overrides.values()].filter(row=>row.kind==='gameplay-repair').map(row=>({path:row.path,reason:row.reason})),
  reversibleIntegrationPatches:reversiblePatches,
  publicFiles:manifest.publicFiles.length, mirroredTables:tables.length,
  weaponSkins:{ families:Object.keys(mapping.families).length, originalStages:stageCount,
    minorBranches:[...kinds.values()].filter(kind=>kind==='minor').length,
    breakthroughBranches:[...kinds.values()].filter(kind=>kind==='breakthrough').length,
    cloudBaseModels:Object.values(mapping.families).filter(row=>row.kind==='cloud-model').length,
    replicaBaseFallbacks:Object.values(mapping.families).filter(row=>row.kind==='replica').length,
    composedForms:0, branchArtwork:'native source sprites retained for evidence; UI uses project-battle-skills-v1 via battle-skill-art.js',
    originalIconFiles:sourceIcons.size },
  dependencies:{phaser:host.dependencies.phaser,typescript:host.devDependencies.typescript,vite:host.devDependencies.vite},
  loadoutEquipment:{ mappedIds:expectedEquipment.length, cloudRecords:equipmentReference.equip.length, calculationSource:"unchanged kernel/loadout-state.ts" },
  nativeProgression:{planes:progressionIndex.skins.length,pilots:progressionIndex.pilots.length,
    guns:progressionIndex.guns.length,labs:progressionIndex.labs.length},
  connectedChapters:chapterIndex.chapters.map(row=>({id:row.id,waves:row.waveCount,terrain:row.terrain})),
  currentSourceDifferences, violations, ok:violations.length===0 };
console.log(JSON.stringify(report,null,2));
if (process.argv.includes('--write-report')) await writeFile(resolve(root,'static-audit.json'),JSON.stringify(report,null,2)+'\n');
if (!report.ok) process.exitCode = 1;
