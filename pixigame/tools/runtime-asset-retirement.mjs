import {lstat,realpath,rm} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';

// Incremental builds retain their output directory. Explicit retirement must
// remove only the declared obsolete files, never a sibling asset or a link.
export async function removeRetiredRuntimeAssets(output,entries){
  const base=await realpath(output);
  for(const entry of entries){
    const publicPath=entry.publicPath||`art/${entry.path}`;
    if(!/^[a-zA-Z0-9_./-]+$/.test(publicPath)||publicPath.split('/').some(part=>!part||part==='.'||part==='..'))throw Error(`Invalid retired asset path: ${publicPath}`);
    const target=resolve(base,publicPath),local=relative(base,target);
    if(!local||local.startsWith('..')||isAbsolute(local))throw Error('Retired asset escapes build output');
    let info;
    try{info=await lstat(target);}catch(error){if(error.code==='ENOENT')continue;throw error;}
    if(info.isSymbolicLink())throw Error('Retired asset must not be a link');
    const actual=relative(base,await realpath(target));
    if(!actual||actual.startsWith('..')||isAbsolute(actual))throw Error('Retired asset resolves outside build output');
    if(entry.kind==='file'?!info.isFile():!info.isDirectory())throw Error(`Retired asset kind changed: ${publicPath}`);
    await rm(target,{recursive:entry.kind!=='file',force:false});
  }
}
