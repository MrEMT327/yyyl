import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = process.cwd();
const file = path.join(root, 'public/replica-battle/data/loadout-catalog.json');
const source = fs.readFileSync(file);
const catalog = JSON.parse(source);
const mapping = JSON.parse(fs.readFileSync(path.join(root, 'replica-battle/weapon-skin-correspondence.json')));
const skills = new Map([...Object.values(catalog.allSkills), ...Object.values(catalog.skills)].map(row=>[row.id,row]));
const features = values => (values || []).flatMap(value => {
  const feature = JSON.parse(value);
  return feature.Type === 'Skill' ? String(feature.Args).split(',').map(Number).filter(Number.isSafeInteger) : [];
});
const skill = id => {
  const row = skills.get(id);
  if (!row) throw new Error(`Missing original skill ${id}`);
  return { id, name: row.name, description: row.description, icon: row.icon };
};
const result = { version: 1, sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
  costRule: 'UnlockCost; current-star StarCost. See native-economy-evidence.md.',
  itemNames: {}, attributeNames: Object.fromEntries(Object.entries(catalog.attributeNames).map(([key,row]) => [key,row.name])) };
for (const [kind, rows] of [['guns',catalog.guns],['skins',catalog.planes.filter(row=>row.kind==='skin')],['pilots',catalog.pilots]]) {
  result[kind] = rows.map(row => {
    const stages = row.stars.map(star => ({ star: star.Star ?? star.star, cost: star.StarCost,
      attributes: star.AttrOnStarUp || [],
      skills: [...features(star.FeatureInitSkill),...features(star.FeatureOnStarUp),...(star.SkillId ? [star.SkillId] : [])].map(skill) }));
    const firstId = features(row.stars[0]?.FeatureInitSkill)[0];
    const appearance = !row.variant && mapping.families[firstId]?.kind === 'cloud-model' ? mapping.families[firstId].itemId : null;
    const record = { id: row.id, name: row.name, description: row.description, icon: row.icon,
      appearance, quality: row.quality, qualityName: row.qualityName, closed: row.closed, hidden: row.hidden,
      defaultStar: row.defaultStar, unlockCost: row.raw.UnlockCost, stages };
    if (kind === 'guns') Object.assign(record, { baseGunId: row.baseGunId,
      weaponType: row.raw.SecondWeaponType, skinNumber: row.raw.skinNumber,
      defaultAppearance: row.raw.IsShow === 1, sortOrder: row.raw.Order });
    for (const cost of [record.unlockCost,...stages.map(stage=>stage.cost)]) {
      if (!Array.isArray(cost)) throw new Error(`Missing cost ${row.id}`);
      for (const [id,count] of cost) {
        if (!Number.isSafeInteger(id) || id<=0 || !Number.isSafeInteger(count) || count<=0) throw new Error(`Invalid cost ${row.id}`);
        result.itemNames[id] = catalog.itemNames[id] || `${row.name}（${id}）`;
      }
    }
    return record;
  });
}
result.labs = catalog.labs.map(row=>({id:row.id,name:row.name,icon:row.icon,unlockChapter:row.raw.unlockChapter,
  levels:row.levels.map(level=>({id:level.ID,level:level.Level,nextId:level.NextID,cost:level.Cost,
    attributes:level.SkillAttributes,skills:features(level.FeatureJson ? [level.FeatureJson] : []).map(skill)}))}));
for(const lab of result.labs)for(const level of lab.levels)for(const [id]of level.cost)result.itemNames[id]=catalog.itemNames[id]||String(id);
result.itemNames[1] = catalog.itemNames[1];
const output = JSON.stringify(result, null, 2) + '\n';
const target = path.join(root,'src/replica/native-economy-catalog.json');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target,'utf8') !== output) throw new Error('Native economy catalog differs from captured source');
  console.log('Native economy catalog matches captured source (costs, stars, attributes, skill IDs and text).');
} else { fs.writeFileSync(target,output); console.log('Generated native economy catalog.'); }
