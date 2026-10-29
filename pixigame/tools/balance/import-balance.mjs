import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolDir, '../..');
const defaultWorkbook = path.join(projectRoot, 'outputs/balance-20260726/雷霆航线_关卡数值配置.xlsx');
const outputPath = path.join(projectRoot, 'src/generated/balance-config.json');
const backupPath = path.join(projectRoot, 'outputs/balance-20260726/balance-config.last-good.json');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const inputPath = path.resolve(args.find((arg) => !arg.startsWith('--')) || defaultWorkbook);

const REQUIRED_STAGE_IDS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio',
  'sagittarius', 'capricorn', 'aquarius', 'pisces', 'ares', 'athena', 'hades',
  'poseidon', 'zeus',
];
const REQUIRED_DIFFICULTIES = ['easy', 'hard', 'hell'];
const REQUIRED_ENEMIES = ['scout', 'dart', 'turret', 'heavy'];
const REQUIRED_BOSS_PATTERNS = [
  'charge', 'walls', 'twins', 'claws', 'solar', 'lances', 'balance', 'venom',
  'arrows', 'mountain', 'streams', 'spiral', 'war', 'aegis', 'underworld',
  'tsunami', 'thunder',
];

function cellValue(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('result' in value) return cellValue(value.result);
    if ('text' in value) return String(value.text).trim();
    if (Array.isArray(value.richText)) return value.richText.map((entry) => entry.text).join('').trim();
  }
  return typeof value === 'string' ? value.trim() : value;
}

function readTable(workbook, sheetName) {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error(`缺少工作表：${sheetName}`);
  const headers = [];
  sheet.getRow(4).eachCell({ includeEmpty: true }, (cell, column) => {
    headers[column - 1] = String(cellValue(cell.value) ?? '').trim();
  });
  if (!headers.some(Boolean)) throw new Error(`${sheetName} 第 4 行没有字段名`);
  const rows = [];
  for (let rowNumber = 5; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const record = {};
    let hasValue = false;
    headers.forEach((header, index) => {
      if (!header) return;
      const value = cellValue(row.getCell(index + 1).value);
      record[header] = value;
      if (value !== null && value !== '') hasValue = true;
    });
    if (hasValue) rows.push(record);
  }
  return rows;
}

function fail(message) {
  throw new Error(`配置校验失败：${message}`);
}

function assertUnique(rows, label) {
  const seen = new Set();
  for (const row of rows) {
    const id = String(row.id || row.key || '').trim();
    if (!id) fail(`${label} 存在空 ID/key`);
    if (seen.has(id)) fail(`${label} ID/key 重复：${id}`);
    seen.add(id);
  }
}

function assertExactIds(rows, expected, label) {
  const actual = rows.map((row) => String(row.id));
  if (actual.length !== expected.length) fail(`${label} 应为 ${expected.length} 行，实际 ${actual.length} 行`);
  for (let index = 0; index < expected.length; index += 1) {
    if (actual[index] !== expected[index]) {
      fail(`${label} 第 ${index + 1} 行应为 ${expected[index]}，实际为 ${actual[index] || '空'}`);
    }
  }
}

function asNumber(value, label, min = -Infinity, max = Infinity) {
  const number = Number(value);
  if (!Number.isFinite(number)) fail(`${label} 必须是数字，实际为 ${String(value)}`);
  if (number < min || number > max) fail(`${label} 超出范围 ${min}–${max}，实际为 ${number}`);
  return number;
}

function pickNumbers(record, keys, label, ranges = {}) {
  const result = {};
  for (const key of keys) {
    const [min, max] = ranges[key] || [0, 100000];
    result[key] = asNumber(record[key], `${label}.${key}`, min, max);
  }
  return result;
}

async function loadCompatibleWorkbook(filePath) {
  const bytes = await fs.readFile(filePath);
  const zip = await JSZip.loadAsync(bytes);
  const contentTypesFile = zip.file('[Content_Types].xml');
  if (!contentTypesFile) throw new Error('Excel 文件缺少 [Content_Types].xml');
  let contentTypes = await contentTypesFile.async('string');
  const workbookContentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml';
  if (
    contentTypes.includes(`Extension="xml" ContentType="${workbookContentType}"`)
    && !contentTypes.includes('PartName="/xl/workbook.xml"')
  ) {
    contentTypes = contentTypes
      .replace(
        `Extension="xml" ContentType="${workbookContentType}"`,
        'Extension="xml" ContentType="application/xml"',
      )
      .replace(
        '</Types>',
        `<Override PartName="/xl/workbook.xml" ContentType="${workbookContentType}" /></Types>`,
      );
    zip.file('[Content_Types].xml', contentTypes);
  }
  const spreadsheetNamespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const spreadsheetXmlNames = Object.keys(zip.files).filter((name) => (
    name === 'xl/workbook.xml'
    || name === 'xl/styles.xml'
    || name === 'xl/sharedStrings.xml'
    || /^xl\/worksheets\/sheet\d+\.xml$/.test(name)
    || /^xl\/tables\/table\d+\.xml$/.test(name)
  ));
  for (const name of spreadsheetXmlNames) {
    const file = zip.file(name);
    if (!file) continue;
    let xml = await file.async('string');
    if (!xml.includes(`xmlns:x="${spreadsheetNamespace}"`)) continue;
    xml = xml
      .replace(new RegExp(`xmlns:x="${spreadsheetNamespace}"`, 'g'), `xmlns="${spreadsheetNamespace}"`)
      .replace(/(<\/?)x:/g, '$1');
    zip.file(name, xml);
  }
  const compatibleBytes = await zip.generateAsync({ type: 'nodebuffer' });
  const parsed = new ExcelJS.Workbook();
  await parsed.xlsx.load(compatibleBytes);
  return parsed;
}

const workbook = await loadCompatibleWorkbook(inputPath);

const metaRows = readTable(workbook, '元数据');
const globalRows = readTable(workbook, '全局参数');
const difficultyRows = readTable(workbook, '难度模式');
const enemyRows = readTable(workbook, '敌机类型');
const stageRows = readTable(workbook, '关卡数值');
const weightRows = readTable(workbook, '波次权重');
const waveRows = readTable(workbook, '波次字典');
const bossRows = readTable(workbook, 'Boss弹幕');

for (const [rows, label] of [
  [metaRows, '元数据'],
  [globalRows, '全局参数'],
  [difficultyRows, '难度模式'],
  [enemyRows, '敌机类型'],
  [stageRows, '关卡数值'],
  [weightRows, '波次权重'],
  [waveRows, '波次字典'],
  [bossRows, 'Boss弹幕'],
]) assertUnique(rows, label);

assertExactIds(difficultyRows, REQUIRED_DIFFICULTIES, '难度模式');
assertExactIds(enemyRows, REQUIRED_ENEMIES, '敌机类型');
assertExactIds(stageRows, REQUIRED_STAGE_IDS, '关卡数值');
assertExactIds(weightRows, REQUIRED_STAGE_IDS, '波次权重');
assertExactIds(bossRows, REQUIRED_BOSS_PATTERNS, 'Boss弹幕');

const meta = Object.fromEntries(metaRows.map((row) => [row.key, String(row.value ?? '')]));
for (const key of ['version', 'name', 'updatedAt', 'notes']) {
  if (!meta[key]) fail(`元数据缺少 ${key}`);
}

const global = {};
for (const row of globalRows) global[row.key] = asNumber(row.value, `全局参数.${row.key}`);
const requiredGlobal = [
  'baseBossHp', 'timeHpPerSecond', 'timeHpMax', 'waveHpPerWave', 'waveHpMax',
  'timeSpeedPerSecond', 'timeSpeedMax', 'powerRatioCap', 'powerHpExponent',
  'powerBossHpExponent', 'powerDamageExponent', 'powerBossDamageExponent',
  'powerSpeedExponent', 'powerBulletSpeedExponent', 'powerSpawnExponent',
  'powerCooldownExponent', 'waveBaseCount', 'waveCountPerTier', 'waveMaxCount',
  'waveTierSeconds', 'firstStageTierSeconds', 'bossWarningSeconds',
  'minWaveInterval', 'minEnemyCooldown', 'minBossCooldown',
];
for (const key of requiredGlobal) if (!(key in global)) fail(`全局参数缺少 ${key}`);
asNumber(global.baseBossHp, 'global.baseBossHp', 500, 100000);
asNumber(global.powerRatioCap, 'global.powerRatioCap', 1, 5);
for (const key of ['timeHpMax', 'waveHpMax', 'timeSpeedMax']) asNumber(global[key], `global.${key}`, 1, 5);
for (const key of requiredGlobal.filter((entry) => entry.includes('Exponent'))) asNumber(global[key], `global.${key}`, 0, 2);

const difficultyNumberKeys = [
  'enemyHp', 'enemySpeed', 'enemyDamage', 'bulletSpeed', 'spawnInterval',
  'enemyCooldown', 'bossHp', 'bossDamage', 'bossSpeed', 'bossCooldown',
  'eliteChance', 'rewardScale', 'lifePenalty', 'powerPressureScale',
];
const difficulties = difficultyRows.map((row) => ({
  id: String(row.id),
  label: String(row.label),
  short: String(row.short),
  color: String(row.color),
  ...pickNumbers(row, difficultyNumberKeys, `difficulty.${row.id}`, {
    eliteChance: [0, 0.75],
    lifePenalty: [0, 10],
    powerPressureScale: [0, 1.5],
  }),
}));

const enemyNumberKeys = [
  'baseHp', 'radius', 'baseSpeed', 'score', 'xp', 'fireChance',
  'fireUnlockSeconds', 'fireCooldown', 'bulletDamage', 'bulletCount', 'spread',
  'bulletScale', 'eliteBulletCountAdd', 'eliteCooldown', 'bulletSpeed',
  'collisionDamage',
];
const enemyTypes = enemyRows.map((row) => ({
  id: String(row.id),
  label: String(row.label),
  ...pickNumbers(row, enemyNumberKeys, `enemy.${row.id}`, {
    fireChance: [0, 1],
    bulletCount: [1, 30],
    spread: [0, 3.2],
    bulletScale: [0.1, 3],
    eliteBulletCountAdd: [0, 20],
    eliteCooldown: [0.1, 3],
  }),
}));

const waveNumberKeys = ['minStageIndex', 'minStageSeconds', 'countMultiplier', 'eliteChanceMultiplier'];
const wavePatterns = waveRows.map((row) => ({
  id: String(row.id),
  label: String(row.label),
  ...pickNumbers(row, waveNumberKeys, `wave.${row.id}`, {
    minStageIndex: [0, 16],
    minStageSeconds: [0, 1000],
    countMultiplier: [0.1, 5],
    eliteChanceMultiplier: [0, 5],
  }),
}));
const waveIds = wavePatterns.map((row) => row.id);

const weightMap = new Map(weightRows.map((row) => {
  const weights = {};
  let sum = 0;
  for (const id of waveIds) {
    const value = asNumber(row[id], `waveWeights.${row.id}.${id}`, 0, 10000);
    weights[id] = value;
    sum += value;
  }
  if (sum <= 0) fail(`waveWeights.${row.id} 权重总和必须大于 0`);
  return [String(row.id), weights];
}));

const stageNumberKeys = [
  'recommendedPower', 'waveTime', 'targetTime', 'timeLimit', 'enemyHp',
  'enemySpeed', 'enemyDamage', 'bulletSpeed', 'spawnInterval', 'enemyCooldown',
  'waveSize', 'eliteStart', 'eliteChance', 'eliteEvery', 'eliteHp', 'bossHp',
  'bossDamage', 'bossSpeed', 'bossCooldown', 'rewardScale', 'openingSafeSeconds',
  'openingHpStart', 'openingRampSeconds',
];
const stages = stageRows.map((row) => {
  const values = pickNumbers(row, stageNumberKeys, `stage.${row.id}`, {
    recommendedPower: [1, 1000000],
    waveTime: [30, 3600],
    targetTime: [30, 3600],
    timeLimit: [30, 3600],
    eliteChance: [0, 0.75],
    eliteEvery: [1, 100],
    openingHpStart: [0.1, 2],
  });
  if (values.targetTime <= values.waveTime) fail(`stage.${row.id}.targetTime 必须大于 waveTime`);
  if (values.timeLimit <= values.targetTime) fail(`stage.${row.id}.timeLimit 必须大于 targetTime`);
  return {
    id: String(row.id),
    ...values,
    waveWeights: weightMap.get(String(row.id)),
  };
});

const bossNumberKeys = ['bulletDamage', 'bulletCount', 'bulletSpeed', 'spread', 'cooldown', 'movement'];
const bossPatterns = bossRows.map((row) => ({
  id: String(row.id),
  label: String(row.label),
  ...pickNumbers(row, bossNumberKeys, `bossPattern.${row.id}`, {
    bulletDamage: [1, 500],
    bulletCount: [0.2, 5],
    bulletSpeed: [0.2, 5],
    spread: [0.2, 3],
    cooldown: [0.2, 3],
    movement: [0.2, 3],
  }),
}));

const output = {
  meta,
  global,
  difficulties,
  enemyTypes,
  wavePatterns,
  bossPatterns,
  stages,
};
const serialized = `${JSON.stringify(output, null, 2)}\n`;

if (!checkOnly) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.mkdir(path.dirname(backupPath), { recursive: true });
  try {
    await fs.copyFile(outputPath, backupPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const tempPath = `${outputPath}.tmp`;
  await fs.writeFile(tempPath, serialized, 'utf8');
  await fs.rename(tempPath, outputPath);
}

console.log([
  checkOnly ? '配置检查通过（未写入）' : '配置导入成功',
  `来源：${inputPath}`,
  `版本：${meta.version}`,
  `关卡：${stages.length}`,
  `敌机：${enemyTypes.length}`,
  `难度：${difficulties.length}`,
  `波次：${wavePatterns.length}`,
  `Boss弹幕：${bossPatterns.length}`,
  checkOnly ? '' : `输出：${outputPath}`,
].filter(Boolean).join('\n'));
