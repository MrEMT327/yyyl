import {createHash} from 'node:crypto';

/** The require path changes with the code, so an old compiled module cannot
 * silently satisfy a new native build's dependency. Keep code inside packages. */
export function fingerprintNativeRuntime(source,legacyPath){
  if(!/^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*\.js$/.test(legacyPath))throw Error('Invalid native runtime path: '+legacyPath);
  const sha256=createHash('sha256').update(source).digest('hex');
  const path=legacyPath.replace(/\.js$/,`-${sha256.slice(0,16)}.js`);
  return {sha256,path,legacyPath,source:source+`\nmodule.exports.__wechatRuntimeHash=${JSON.stringify(sha256)};\n`};
}

export function rewriteNativeRuntimeRequires(source,modules){
  for(const module of Object.values(modules)){
    const before=`require('./${module.legacyPath}')`;
    if(source.split(before).length!==2)throw Error('Native runtime require must occur once: '+module.legacyPath);
    source=source.replace(before,()=>`require('./${module.path}')`);
  }
  return source;
}
