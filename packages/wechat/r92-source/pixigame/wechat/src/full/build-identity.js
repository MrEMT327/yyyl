/** Attach the build and actually loaded runtime identities to native diagnostics.
 * A mismatched preview package is rejected before its game code executes. */
export function createBuildIdentity(manifest){
  const buildId=manifest?.buildId||'unversioned',modules=manifest?.modules||{},loaded={};
  const expected=Object.fromEntries(Object.entries(modules).map(([name,module])=>[name,module.sha256]));
  function describe(){return {buildId,expected:{...expected},loaded:{...loaded}};}
  function verify(name,factory){
    const actual=factory?.__wechatRuntimeHash;
    if(manifest&&(!expected[name]||actual!==expected[name])){
      const error=new Error(`游戏代码版本不一致（${buildId}/${name}），请退出游戏并重新扫描最新预览码。`);
      error.code='WECHAT_RUNTIME_VERSION_MISMATCH';
      throw error;
    }
    if(typeof factory!=='function')throw new TypeError('Invalid native runtime factory: '+name);
    loaded[name]=actual||'unversioned';return factory;
  }
  function diagnose(error){return {...describe(),message:String(error?.message??error),stack:String(error?.stack||'')};}
  return {describe,verify,diagnose};
}
