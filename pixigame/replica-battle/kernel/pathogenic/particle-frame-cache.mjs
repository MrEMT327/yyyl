// Only used by the read-only source renderer: graph resources and retained
// node properties cannot be edited in place. History mutations carry a revision.
function equalValue(a,b){
 if(Object.is(a,b))return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 if(Array.isArray(a)&&a.length!==b.length)return false;
 const pa=Object.getPrototypeOf(a),pb=Object.getPrototypeOf(b);
 if(pa!==pb||!Array.isArray(a)&&pa!==Object.prototype&&pa!==null)return false;
 const keys=Object.keys(a);if(keys.length!==Object.keys(b).length)return false;
 for(const key of keys)if(!Object.hasOwn(b,key)||!equalValue(a[key],b[key]))return false;
 return true;
}
export class ParticleFrameCache{
 constructor(){this.frames=new Map();}
 clear(){this.frames.clear();}
 delete(key){this.frames.delete(key);}
 sample(key,graph,node,age,seed,options,compute){
  const revision=options.historyRevision;
  // Without an owner-supplied history revision, use the regular sampler.
  if(!node.properties||!Number.isSafeInteger(revision)||revision<0)return compute();
  const old=this.frames.get(key);
  if(old&&old.graph===graph&&Object.is(old.age,age)&&Object.is(old.seed,seed)&&old.path===node.path&&old.nodePath===node.nodePath
   &&old.history===options.history&&old.revision===revision&&Object.is(old.stopAge,options.stopAge)&&Object.is(old.emitting,options.emitting)
   &&Object.is(old.startAge,options.startAge)&&Object.is(old.timeStep,options.timeStep)&&old.strict===options.strict&&equalValue(old.properties,node.properties))return old.result;
  const result=compute();
  this.frames.set(key,{graph,age,seed,path:node.path,nodePath:node.nodePath,history:options.history,revision,stopAge:options.stopAge,
   emitting:options.emitting,startAge:options.startAge,timeStep:options.timeStep,strict:options.strict,properties:node.properties,result});
  return result;
 }
}
