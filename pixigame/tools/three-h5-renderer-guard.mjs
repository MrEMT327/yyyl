// Validate the formal game's reachable output after Rollup has tree-shaken it.
const foreignEngine=/\/node_modules\/(?:phaser|pixi\.js|@pixi\/[^/]+|canvg|yoga-layout)\//;
const legacyUI=/\/src\/ui\/(?:performance-panel|peripheral-lobby|lobby-onboarding|sortie-loading|sortie-hangar(?:\.worker)?|breakthrough-screen-frame)\.js(?:\?|$)/;
const retiredBattleCss=/\/replica-battle\/kernel\/(?:style|original-ui)\.css\?inline(?:&|$)/;
const retiredSkillDialog=/\/replica-battle\/(?:developer-skills-ui\.ts|developer-skills\.css)(?:\?|$)/;

export function assertThreeH5Bundle(bundle,home){
  const path=id=>String(id).replaceAll('\\','/');
  const entry=Object.values(bundle).find(c=>c.type==='chunk'&&c.isEntry&&path(c.facadeModuleId)===path(home));
  if(!entry)throw Error('Missing H5 entry '+home);
  const visited=new Set(),pending=[entry.fileName];
  while(pending.length){
    const name=pending.pop();if(visited.has(name))continue;visited.add(name);
    const c=bundle[name];if(c?.type!=='chunk')continue;
    for(const id of Object.keys(c.modules).map(path)){
      if(foreignEngine.test(id)||id.includes('/replica-battle/cloud-combat.js')||id.includes('/src/weapon-preview/page.js')||id.includes('/wechat/src/full/')||legacyUI.test(id)||retiredBattleCss.test(id)||retiredSkillDialog.test(id))
        throw Error('H5 rendering dependency '+id+' is included by '+name);
    }
    pending.push(...c.imports,...c.dynamicImports);
  }
  return visited;
}
export function threeH5RendererGuard(home){
  return {name:'three-h5-renderer',apply:'build',generateBundle(_options,bundle){assertThreeH5Bundle(bundle,home);}};
}
