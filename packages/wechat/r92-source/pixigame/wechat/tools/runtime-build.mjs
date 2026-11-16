import { build } from 'esbuild';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, relative, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileSharedCss } from './compile-shared-css.mjs';
import { NATIVE_JS_TARGET, NATIVE_INJECT, assertNativeScript } from './native-syntax.mjs';

export const root = fileURLToPath(new URL('../../', import.meta.url));
const publicRuntimeImports = {
  'src/ui/blue-hand-cannon-portrait-player.js': [
    ['import(/* @vite-ignore */ moduleUrl)', 'art/blue-hand-cannon-v28-socket/renderer.mjs'],
  ],
  'src/render/enemy-library.js': [
    ["import(/* @vite-ignore */ assetUrl('catalog.js'))", 'art/enemies/catalog.js'],
    ["import(/* @vite-ignore */ assetUrl('poses.js'))", 'art/enemies/poses.js'],
  ],
  'replica-battle/chapter-enemy-art.ts': [
    ["import(/* @vite-ignore */ new URL('catalog.js', base).href)", 'art/enemies/catalog.js'],
    ["import(/* @vite-ignore */ new URL('poses.js', base).href)", 'art/enemies/poses.js'],
  ],
};
// The native battle always supplies an external HUD. Its Interface still
// drives the timings, but never enters these browser-only painting paths.
export const standaloneBattleUiData = Object.freeze([
  'punchboard-ui','ui-animation','ui-animation-assets','ui-tier-animation','ui-tier-assets','skill-popup-animation',
].map(name=>`replica-battle/public/data/${name}.json`));
const globals = ['console','window','document','self','navigator','location','localStorage','sessionStorage','Image','Audio','AudioContext','getComputedStyle','ResizeObserver','MutationObserver','HTMLElement','Element','HTMLCanvasElement','HTMLImageElement','HTMLVideoElement','Node','DOMParser','Event','CustomEvent','EventTarget','devicePixelRatio','innerWidth','innerHeight','parent','top','screen','requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout','setInterval','clearInterval','fetch','XMLHttpRequest','Headers','Response','Request','Blob','DecompressionStream','URL','URLSearchParams','AbortController','DOMException','TextEncoder','TextDecoder','structuredClone','queueMicrotask','atob','btoa','crypto','Live2DCubismCore','WebAssembly'];
globals.push('WebGLRenderingContext','WebGL2RenderingContext');
export async function buildRuntime({ entry, output, origin, native = true, data = {}, separatePhaser = false, assetNames }) {
  await mkdir(resolve(output,'..'), {recursive:true});
  const deployedAssets=assetNames??await readdir(resolve(root,'dist/assets'));
  const sharedPlugin={name:'shared-runtime-data',setup(builder){
    if(separatePhaser){
      builder.onResolve({filter:/^phaser$/},()=>({path:'shared-phaser',namespace:'native-phaser'}));
      builder.onLoad({filter:/.*/,namespace:'native-phaser'},()=>({contents:'module.exports=globalThis.__PHASER_ENGINE__;'}));
    }
    builder.onLoad({filter:/\.json$/},async args=>{
      const key=relative(root,args.path).replaceAll('\\','/');
      if(native&&entry==='replica-battle/entry.ts'&&standaloneBattleUiData.includes(key))
        return{contents:'export default {};',loader:'js'};
      data[key]=JSON.parse(await readFile(args.path,'utf8'));
      return{contents:`export default globalThis.__SHARED_JSON__[${JSON.stringify(key)}];`,loader:'js'};
    });
    builder.onLoad({filter:/\.[cm]?[jt]s$/},async args=>{
      let contents=await readFile(args.path,'utf8');
      const bindings=native?publicRuntimeImports[relative(root,args.path).replaceAll('\\','/')]:null;
      for(const [expression,path] of bindings||[]){
        if(!contents.includes(expression))throw new Error(`Native public module binding changed: ${args.path}: ${expression}`);
        contents=contents.replace(expression,`import(${JSON.stringify(resolve(root,'public',path).replaceAll('\\','/'))})`);
      }
      if(!bindings&&!contents.includes('import.meta'))return;
      contents=contents.replace(/new URL\((['"])([^'"\n]+)\1,\s*import\.meta\.url\)/g,(_whole,_quote,path)=>{
        const original=resolve(args.path,'..',path),name=basename(original,extname(original)),extension=extname(original);
        const deployed=deployedAssets.find(item=>item.startsWith(name+'-')&&item.endsWith(extension));
        const url=deployed?`${origin}/assets/${deployed}`:`${origin}/${relative(root,original).replaceAll('\\','/').replace(/^public\//,'')}`;
        return `new URL(${JSON.stringify(url)})`;
      });
      contents=contents.replaceAll('import.meta.url',JSON.stringify(`${origin}/${relative(root,args.path).replaceAll('\\','/')}`));
      return{contents,loader:args.path.endsWith('.ts')?'ts':'js',resolveDir:resolve(args.path,'..')};
    });
  }};
  const result = await build({ absWorkingDir:root,entryPoints:[entry],bundle:true,format:'iife',globalName:'__runtime',platform:'browser',target:native?NATIVE_JS_TARGET:'es2022',outfile:output,write:false,minify:true,metafile:true,
    inject:native?NATIVE_INJECT:[],
    external:['/art/*','/replica-battle/assets/*','/audio/*','/assets/*','canvas'],
    alias:native?{'yoga-layout/load':resolve(root,'wechat/src/full/yoga-shared.js')}:undefined,
    plugins:[sharedPlugin],
    define:{...Object.fromEntries(globals.map(name=>[name,`globalThis.${name}`])),'import.meta.hot':'undefined','import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'true','import.meta.env.PROD':'false','import.meta.env':'{}',__THUNDER_RELEASE_MODE__:'"development"'},
  });
  let css = '';
  for (const file of result.outputFiles) {
    if (file.path.endsWith('.js')) {
      if(native&&/\bimport\s*\(/.test(file.text))throw new Error(`Unbundled dynamic import in native runtime: ${entry}`);
      const factory = `function createRuntime(globalThis){\n${file.text}\nreturn __runtime;\n}\n`;
      const script = factory + (native ? 'module.exports=createRuntime;\n' : 'export default createRuntime;\n');
      if(native)assertNativeScript(script,output);
      await writeFile(output, script);
    } else if(file.path.endsWith('.css')) css = file.text;
  }
  await writeFile(output+'.meta.json',JSON.stringify(result.metafile));
  return css;
}
export async function buildSharedRuntimeSet(output, {origin='http://192.168.23.227:4173',native=true,assetNames}={}) {
  const lobbyData={},battleData={};
  const lobbyCss = await buildRuntime({entry:'wechat/src/full/lobby-runtime.js',output:resolve(output,'lobby.js'),origin,native,data:lobbyData,assetNames});
  if(native) await buildRuntime({entry:'wechat/src/full/phaser-runtime.js',output:resolve(output,'phaser.js'),origin,native,data:battleData,assetNames});
  const battleCss = await buildRuntime({entry:'replica-battle/entry.ts',output:resolve(output,'battle.js'),origin,native,data:battleData,separatePhaser:native,assetNames});
  // Keep the combined artifact for browser parity and existing builders. Native
  // CDN builds can defer only the entries never imported by the lobby bundle.
  const data={...lobbyData,...battleData};
  for(const key of Object.keys(lobbyData)) {
    if(Object.hasOwn(battleData,key) && JSON.stringify(lobbyData[key])!==JSON.stringify(battleData[key]))
      throw new Error(`Shared JSON changed during runtime build: ${key}`);
    delete battleData[key];
  }
  await writeFile(resolve(output,'runtime-data.json'),JSON.stringify(data));
  await writeFile(resolve(output,'lobby-data.json'),JSON.stringify(lobbyData));
  await writeFile(resolve(output,'battle-data.json'),JSON.stringify(battleData));
  let lobbyMarkup = await readFile(resolve(root,'index.html'),'utf8');
  lobbyMarkup = lobbyMarkup.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
  const inlineStyle=[...lobbyMarkup.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match=>match[1]).join('\n');
  lobbyMarkup=lobbyMarkup.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');
  let battleMarkup=await readFile(resolve(root,'wechat/src/full/battle-markup.html'),'utf8');
  battleMarkup=battleMarkup.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
  const originalBattleStyle=await readFile(resolve(root,'public/replica-battle/style.css'),'utf8');
  const originalUiStyle=await readFile(resolve(root,'public/replica-battle/original-ui.css'),'utf8');
  const battleInline=[...battleMarkup.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match=>match[1]).join('\n');
  battleMarkup=battleMarkup.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');
  const styles={lobby:compileSharedCss(inlineStyle+'\n'+lobbyCss,{baseURL:origin+'/'}),battle:compileSharedCss(originalBattleStyle+'\n'+originalUiStyle+'\n'+battleInline+'\n'+battleCss,{baseURL:origin+'/replica-battle/'})};
  await writeFile(resolve(output,'presentation.json'),JSON.stringify({styles,lobbyMarkup,battleMarkup}));
  return {styles,lobbyMarkup,battleMarkup};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const output=resolve(process.argv[2]);await buildSharedRuntimeSet(output,{native:!process.argv.includes('--browser')});
  console.log(JSON.stringify({output}));
}
