import {build} from 'esbuild';
import {mkdir,readFile,readdir,writeFile,copyFile,stat} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {brotliCompressSync,constants} from 'node:zlib';
import {root,buildSharedRuntimeSet} from './runtime-build.mjs';
import {wrapNativeCubismCore} from './cubism-native.mjs';
import {fingerprintNativeRuntime,rewriteNativeRuntimeRequires} from './runtime-identity.mjs';
import {NATIVE_JS_TARGET,NATIVE_INJECT,assertNativePackage} from './native-syntax.mjs';

const output=resolve(process.argv[2]||''),origin=new URL(process.argv[3]||'http://192.168.23.227:4173').origin;
if(!process.argv[2])throw new Error('请指定新的输出目录');
await mkdir(output,{recursive:true});if((await readdir(output)).length)throw new Error('输出目录必须为空，保留既有测试包');
const stage=resolve(root,'art/wechat-full-build-stage');await mkdir(stage,{recursive:true});
await buildSharedRuntimeSet(stage,{origin,native:true});
const packs=['lobby-code','battle-code','battle-engine','native-core','shared-data'];
const buildIdentity={buildId:'native-'+new Date().toISOString(),modules:{}};
for(const name of packs){await mkdir(join(output,name));await writeFile(join(output,name,'game.js'),'// Full H5 runtime subpackage.\n');}
for(const [file,pack,name]of [['lobby.js','lobby-code','lobby'],['battle.js','battle-code','battle'],['phaser.js','battle-engine','engine']]){
  const bundle=fingerprintNativeRuntime(await readFile(join(stage,file),'utf8'),pack+'/'+file);
  const {source,...identity}=bundle;buildIdentity.modules[name]=identity;await writeFile(join(output,bundle.path),source);
}
for(const file of ['presentation.json','runtime-data.json'])await writeFile(join(output,'shared-data',file+'.br'),brotliCompressSync(await readFile(join(stage,file)),{params:{[constants.BROTLI_PARAM_QUALITY]:7}}));
const core=await readFile(join(root,'public/art/live2d-runtime/live2dcubismcore.min.js'),'utf8');
await writeFile(join(output,'native-core/cubism.js'),wrapNativeCubismCore(core));
const yoga=await readFile(join(root,'node_modules/yoga-layout/dist/binaries/yoga-wasm-base64-esm.js'),'utf8'),wasm=/data:application\/octet-stream;base64,([A-Za-z0-9+/=]+)/.exec(yoga)?.[1];
if(!wasm)throw new Error('未找到 Yoga WASM');await writeFile(join(output,'native-core/yoga.wasm'),Buffer.from(wasm,'base64'));
await build({absWorkingDir:root,entryPoints:['wechat/src/full/bootstrap.js'],bundle:true,platform:'browser',format:'cjs',target:NATIVE_JS_TARGET,inject:NATIVE_INJECT,minify:true,outfile:join(output,'game.js'),external:['canvas','./native-core/cubism.js',...Object.values(buildIdentity.modules).map(module=>'./'+module.path)],
  plugins:[{name:'native-runtime-identity',setup(builder){builder.onLoad({filter:/[/\\]bootstrap\.js$/},async({path})=>({contents:rewriteNativeRuntimeRequires(await readFile(path,'utf8'),buildIdentity.modules),loader:'js',resolveDir:dirname(path)}));}}],
  define:{__WECHAT_ASSET_ORIGIN__:JSON.stringify(origin),__WECHAT_BUILD_IDENTITY__:JSON.stringify(buildIdentity)}});
await writeFile(join(output,'game.json'),JSON.stringify({deviceOrientation:'portrait',showStatusBar:false,iOSHighPerformance:true,subpackages:packs.map(name=>({name,root:`${name}/`}))},null,2));
await writeFile(join(output,'project.config.json'),JSON.stringify({appid:'wx0b821a6c8d36aed6',compileType:'game',projectname:'少女航线 · 完整适配测试',libVersion:'3.8.0',setting:{urlCheck:false,es6:false,minified:false}},null,2));
const sizes={};for(const pack of ['.',...packs]){let bytes=0;for(const file of await readdir(join(output,pack),{withFileTypes:true}))if(file.isFile())bytes+=(await stat(join(output,pack,file.name))).size;sizes[pack]=bytes;}
for(const [pack,size]of Object.entries(sizes))if(size>=4*1024*1024)throw new Error(`${pack} 超过 4 MiB：${size}`);
const total=Object.values(sizes).reduce((a,b)=>a+b,0);if(total>=20*1024*1024)throw new Error(`总包超限 ${total}`);
const syntax=await assertNativePackage(output);
await writeFile(join(output,'BUILD-INFO.json'),JSON.stringify({builtAt:new Date().toISOString(),buildIdentity,source:'current H5',origin,sizes,total,syntax,chapters:'完整关卡从现有素材服务按需读取',verification:'待微信开发者工具检查'},null,2));
console.log(JSON.stringify({output,sizes,total},null,2));
