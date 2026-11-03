// Compose the engineering sheet with the SAME weapon image used by equipment.
// Keep the approved raster bytes intact; the sheet, fold and grid are vector art.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RESEARCH_BLUEPRINT_ART} from '../src/replica/research-blueprint-art.js';
import {weaponFamilyThemeArt} from '../src/ui/weapon-theme-art.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const directory=resolve(root,'public/art/project-research-blueprints-v2');
const checking=process.argv.includes('--check');
const hash=value=>createHash('sha256').update(value).digest('hex');
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[char]);
const assets=[];
const grid=Array.from({length:9},(_,i)=>88+i*42)
  .map(p=>`M${p} 46V466M46 ${p}H466`).join('');
if(!checking)await mkdir(directory,{recursive:true});
async function output(file,content){
  const path=resolve(directory,file);
  if(checking){if(await readFile(path,'utf8')!==content)throw new Error(`Research blueprint is stale: ${file}. Run node tools/generate-research-blueprint-art.mjs`);}
  else await writeFile(path,content);
}
for(const row of RESEARCH_BLUEPRINT_ART){
  const sourcePath=weaponFamilyThemeArt(row.skillKey)?.replace(/^\//,'');
  if(!sourcePath?.startsWith('art/project-weapon-themes-v1/'))throw new Error(`Missing current weapon artwork for ${row.nativeItemId}`);
  const weapon=await readFile(resolve(root,'public',sourcePath));
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="512" height="512" viewBox="0 0 512 512" role="img" aria-labelledby="name">
<title id="name">${escape(row.name)}</title>
<defs><linearGradient id="paper" x2=".3" y2="1"><stop stop-color="#15508a"/><stop offset="1" stop-color="#092e58"/></linearGradient><clipPath id="sheet"><path d="M62 32H404L480 108V454L454 480H32V62Z"/></clipPath></defs>
<path d="M62 32H404L480 108V454L454 480H32V62Z" fill="url(#paper)" stroke="#102239" stroke-width="12" stroke-linejoin="round"/>
<path d="M62 32H404L480 108V454L454 480H32V62Z" fill="none" stroke="#65c9ef" stroke-width="5" stroke-linejoin="round"/>
<path d="${grid}" clip-path="url(#sheet)" fill="none" stroke="#8bd4f5" stroke-opacity=".13" stroke-width="1.5"/>
<path d="M404 36V108H476Z" fill="#c6f2ff" stroke="#65c9ef" stroke-width="3" stroke-linejoin="round"/>
<path d="M404 108H476L404 128Z" fill="#061f3b" opacity=".45"/>
<image x="58" y="92" width="396" height="356" preserveAspectRatio="xMidYMid meet" xlink:href="data:image/webp;base64,${weapon.toString('base64')}"/>
</svg>
`;
  const file=`${row.nativeItemId}.svg`;
  await output(file,svg);
  assets.push({nativeItemId:row.nativeItemId,labId:row.labId,skillKey:row.skillKey,name:row.name,file,width:512,height:512,sha256:hash(svg),weaponSource:{path:sourcePath,sha256:hash(weapon)}});
}
await output('manifest.json',JSON.stringify({version:2,generator:'tools/generate-research-blueprint-art.mjs',scope:'Vector blueprint sheet with byte-identical current equipment weapon artwork; item IDs, quality, quantities and costs unchanged.',assets},null,2)+'\n');
console.log(`${checking?'Verified':'Generated'} ${assets.length} current-weapon blueprint icons.`);
