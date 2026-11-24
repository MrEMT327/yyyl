import { createRequire } from 'node:module';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

const root=fileURLToPath(new URL('../',import.meta.url));
const source=fileURLToPath(new URL('../../../pixigame/',pathToFileURL(root)));
const game=join(root,'pixigame');
const {build}=createRequire(join(source,'package.json'))('esbuild');
const {assertNativeScript}=await import(pathToFileURL(join(game,'wechat/tools/native-syntax.mjs')));
const slash=path=>path.replaceAll('\\','/');
const excluded=/(?:^|\/)(?:phaser|pixi\.js|@pixi|canvg|yoga-layout)(?:\/|$)|\/wechat\/src\/full\/(?:dom-[^/]+|css-[^/]+|yoga-[^/]+|bootstrap|battle-frame(?:-presenter)?|phaser-runtime)\.js$|\/replica-battle\/(?:entry\.ts|kernel\/renderer\.ts)$|\.(?:css|html)$/i;

async function deployedAudioPaths(){
  const audioDir=join(source,'assets/audio');
  const {entries,three}=JSON.parse(await readFile(join(root,'build-inputs/cdn-manifest.json'),'utf8'));
  const audioByHash=new Map([...entries,...(three?.entries??[]),...(three?.uploads??[])]
    .filter(({path})=>/^assets\/[^/]+\.(?:mp3|ogg|wav)$/.test(path))
    .map(({path,sha256})=>[extname(path)+':'+sha256,path]));
  const paths=new Map();
  for(const file of await readdir(audioDir,{recursive:true,withFileTypes:true})){
    if(!file.isFile()||!/\.(?:mp3|ogg|wav)$/.test(file.name))continue;
    const input=join(file.parentPath,file.name);
    const hash=createHash('sha256').update(await readFile(input)).digest('hex');
    const path=audioByHash.get(extname(file.name)+':'+hash);
    if(path)paths.set(slash(relative(source,input)),path);
  }
  return paths;
}

export async function compileWechatThreeRuntime({origin,entry=join(game,'wechat/src/three/runtime.js'),split=false}){
  const url=new URL(origin);
  if(url.protocol!=='https:')throw Error('小游戏资源入口需要使用 HTTPS');
  const assetOrigin=url.origin;
  const audioPaths=await deployedAudioPaths();
  const imagePaths=new Set(),dataModules=new Map();
  const threeRoot=join(source,'node_modules/three');
  const urlImports={
    name:'three-native-asset-urls',
    setup(plugin){
      plugin.onResolve({filter:/^three(?:\/|$)/},request=>{
        const name=request.path;
        if(name==='three')return split?{path:'@native/game-three',external:true}:{path:join(threeRoot,'build/three.module.js')};
        const libraryPath=name.replace(/^three\/addons\//,'examples/jsm/').replace(/^three\//,'');
        return {path:join(threeRoot,libraryPath)};
      });
      if(split)plugin.onResolve({filter:/\.json$/},async args=>{
        if(!args.path.startsWith('.'))return;
        const path=resolve(args.resolveDir,args.path),key=slash(relative(source,path));
        if(key.startsWith('../')||key.startsWith('node_modules/'))return;
        const bytes=await readFile(path);
        if(bytes.byteLength<16000)return;
        const id=createHash('sha256').update(key).digest('hex').slice(0,16),name='@native/data-'+id;
        if(!dataModules.has(name))dataModules.set(name,'module.exports='+JSON.stringify(JSON.parse(bytes.toString('utf8')))+';\n');
        return {path:name,external:true};
      });
      plugin.onLoad({filter:/\.[cm]?[jt]s$/},async info=>{
        const path=slash(relative(source,info.path));
        if(path.startsWith('../')||path.startsWith('node_modules/'))return;
        let text=await readFile(info.path,'utf8');
        if(!text.includes('import.meta.url'))return;
        // Vite emits imported audio at content-hashed paths recorded by the CDN manifest.
        text=text.replace(/new URL\((['"])([^'"\n]+)\1,\s*import\.meta\.url\)\.href/g,(_match,_quote,value)=>{
          const key=slash(relative(source,resolve(dirname(info.path),value))).replace(/^public\//,'');
          if(key.startsWith('../'))throw Error('素材路径超出 H5 工程 '+key);
          const assetPath=audioPaths.get(key)??key;
          imagePaths.add(assetPath);
          return JSON.stringify(assetOrigin+'/'+assetPath.split('/').map(encodeURIComponent).join('/'));
        }).replaceAll('import.meta.url',JSON.stringify(assetOrigin+'/'+path));
        return {contents:text,loader:info.path.endsWith('.ts')?'ts':'js',resolveDir:dirname(info.path)};
      });
    },
  };
  const compiled=await build({
    absWorkingDir:source,entryPoints:[resolve(entry)],nodePaths:[join(game,'node_modules')],
    inject:[join(game,'wechat/src/three/platform-builtins.js'),join(game,'wechat/src/full/native-base64.js')],
    bundle:true,write:false,metafile:true,minify:true,platform:'browser',format:'cjs',target:['es2018'],
    define:{'import.meta.env':JSON.stringify({BASE_URL:assetOrigin+'/',MODE:'production',DEV:false,PROD:true}),
      'import.meta.hot':'undefined',__WECHAT_THREE_NATIVE__:'true',__THUNDER_RELEASE_MODE__:JSON.stringify('production')},
    loader:{'.glsl':'text'},plugins:[urlImports],logLevel:'silent',
  });
  const modules=Object.keys(compiled.metafile.inputs).map(slash);
  const incompatible=modules.filter(path=>excluded.test(path));
  if(incompatible.length)throw Error('微信 Three.js 构建含旧渲染或浏览器界面模块：'+incompatible.join('，'));
  const three=modules.filter(path=>path.includes('/three/build/three.module.js')||path==='node_modules/three/build/three.module.js');
  if(three.length!==Number(!split))throw Error('微信版必须使用同一份 Three.js');
  const [bundle]=compiled.outputFiles;
  if(compiled.outputFiles.length!==1)throw Error('微信 Three.js 构建出现额外的独立产物');
  if(!split){assertNativeScript(bundle.text,'three-runtime.js');return {bytes:bundle.contents,modules,imagePaths:[...imagePaths]};}
  const vendor=await build({entryPoints:[join(threeRoot,'build/three.module.js')],bundle:true,write:false,minify:true,
    target:'es2018',platform:'browser',format:'cjs',logLevel:'silent'});
  const [threeJS]=vendor.outputFiles;
  const script=bundle.text.replace(/\brequire\((['"])(@native\/[\w-]+)\1\)/g,(_match,_quote,name)=>'GameGlobal.__shnhReadModule('+JSON.stringify(name)+')');
  if(/\brequire\(['"]@native\//.test(script))throw Error('微信分包链接未完成');
  const parts=new Map([['runtime',script],['@native/game-three',threeJS.text],...dataModules]);
  for(const [name,text] of parts)assertNativeScript(text,name);
  return {bytes:Buffer.from(script),parts,modules,imagePaths:[...imagePaths]};
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const {bytes,modules,imagePaths}=await compileWechatThreeRuntime({origin:process.argv[2],split:process.argv.includes('--split')});
  console.log(JSON.stringify({bytes:bytes.byteLength,modules:modules.length,assetURLs:imagePaths.length}));
}
