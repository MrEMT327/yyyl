import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [manifest,lock,boot,controller,battle,hull,main]=await Promise.all(['package.json','package-lock.json','src/boot.js','src/ui/three-peripheral-lobby.js',
 'src/three/game-screen/three-battle-stage.js','src/replica/h5-project-presentation.js','src/three/game-screen/h5-runtime.js'].map(read));
const pkg=JSON.parse(manifest),installed=JSON.parse(lock).packages;
for(const name of ['phaser','pixi.js','yoga-layout','canvg']){
 assert(!pkg.dependencies?.[name]&&!pkg.devDependencies?.[name],'H5 package contains '+name);
 assert(!installed['node_modules/'+name],'H5 lock contains '+name);
}
assert.deepEqual(Object.keys(pkg.dependencies),['three']);
assert.match(boot,/import\('\.\/three\/game-screen\/h5-runtime\.js'\)/);
assert.match(main,/mountLobby:mountThreeLobby/);assert.doesNotMatch(controller,/innerHTML|setUiMarkup\(|createUiMotion\(|createItemDescriptionLayer\(|renderHeader\(/);
assert.doesNotMatch(hull+'\n'+battle,/copyFramebufferToTexture|readPixels\(|texSubImage2D\(/);
assert.match(battle,/createBattleColorTargets\(renderer/);assert.match(hull,/battle\.drawGround\(/);
const [hud,diagnostics]=await Promise.all(['src/three/game-screen/battle-hud-scene.js','src/three/game-screen/page-diagnostics.js'].map(read));
assert.doesNotMatch(hud,/new (?:THREE\.)?WebGLRenderer|nativeDocument|innerHTML/);
assert.doesNotMatch(diagnostics,/innerHTML|getContext\('2d'\)/);assert.match(boot,/game-screen\/page-diagnostics\.js/);
const project=fileURLToPath(new URL('../',import.meta.url));
const capture=JSON.parse(await read('replica-battle/source-manifest.json'));
const assets=[...capture.publicFiles,...capture.originalAssetAdditions];
const shippingRoot=resolve(project,'public/replica-battle');
const archiveRoot=resolve(project,'art/research-reference-archive/replica-battle');
async function exists(path){
  try{await stat(path);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}
}
const hasReferenceArchive=await exists(archiveRoot);
let shipped=0,archived=0;
for(const asset of assets){
  const reference=asset.path.startsWith('assets/loadout-ui/')||asset.path==='data/loadout-ui.json';
  if(reference){
    assert(!(await exists(resolve(shippingRoot,asset.path))),'Reference-only art in public: '+asset.path);
    // Original comparison material is kept locally, outside Git and the H5 package.
    if(!hasReferenceArchive)continue;
    archived++;
  }else{shipped++;}
  const bytes=await readFile(resolve(reference?archiveRoot:shippingRoot,asset.path));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,'Captured battle asset '+asset.path);
}
console.log('Matched '+shipped+' H5 combat assets and data files, and '+archived+' local comparison files.');
console.log('Formal H5 uses Three.js, the native lobby controller and shared combat textures.');

