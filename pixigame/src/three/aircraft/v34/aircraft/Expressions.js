import {Color} from 'three';
const OPS=new Set(['config','global','time','+','*','if','>','floor','sin','cos','exp','mod','colorMix']);
/** A deliberately tiny typed expression tree, never eval / new Function. */
export function compileExpression(expr){
 if(!Array.isArray(expr))return ()=>expr;
 const [op,...args]=expr;if(!OPS.has(op))throw new Error('未知动画操作符：'+op);
 if(op==='time')return ctx=>ctx.time;
 if(op==='config'||op==='global'){
  const key=args[0];if(typeof key!=='string'||['__proto__','prototype','constructor'].includes(key))throw new Error('非法参数引用');
  return ctx=>{const v=ctx[op][key];if(v===undefined)throw new Error('缺少动画参数 '+key);return v;};
 }
 const a=args.map(compileExpression);
 if(op==='if')return ctx=>a[0](ctx)?a[1](ctx):a[2](ctx);
 if(op==='+')return ctx=>a.reduce((n,f)=>n+f(ctx),0);
 if(op==='*')return ctx=>a.reduce((n,f)=>n*f(ctx),1);
 if(op==='>')return ctx=>a[0](ctx)>a[1](ctx);
 if(op==='mod')return ctx=>a[0](ctx)%a[1](ctx);
 if(op==='colorMix'){const x=new Color(),y=new Color();return ctx=>x.set(a[0](ctx)).lerp(y.set(a[1](ctx)),a[2](ctx));}
 return ctx=>Math[op](a[0](ctx));
}
export function makeBindings(definitions,nodes,materials){
 return definitions.map(b=>{
  const root=b.target.node?nodes.get(b.target.node):materials.get(b.target.material);
  if(!root)throw new Error('动画目标不存在：'+JSON.stringify(b.target));
  const path=b.property.split('.');if(path.some(p=>['__proto__','prototype','constructor'].includes(p)))throw new Error('非法属性路径');
  let parent=root;for(const p of path.slice(0,-1)){parent=parent[p];if(parent===undefined)throw new Error('动画属性不存在：'+b.property);}
  const key=path.at(-1),evalValue=compileExpression(b.value);
  if(parent[key]===undefined)throw new Error('动画字段不存在：'+b.property);
  const destination=parent[key];
  return ctx=>{
   const v=evalValue(ctx);
   if(typeof v==='number'&&!Number.isFinite(v))throw new Error('动画产生非有限数：'+b.property);
   if(destination?.isColor){if(v?.isColor)destination.copy(v);else destination.set(v);}
   else if(destination?.isVector3||destination?.isVector2)destination.fromArray(v);
   else parent[key]=v;
  };
 });
}
