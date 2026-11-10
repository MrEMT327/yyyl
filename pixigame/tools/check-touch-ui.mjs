import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import postcss from 'postcss';
import ts from 'typescript';

const root=fileURLToPath(new URL('../',import.meta.url));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const files=['src','replica-battle'].flatMap(dir=>walk(path.join(root,dir)))
  .concat(fs.readdirSync(root).filter(name=>name.endsWith('.html')).map(name=>path.join(root,name)))
  .filter(file=>/\.(?:css|[cm]?[jt]sx?|html)$/.test(file));
const violations=[];
for(const file of files){
  const source=fs.readFileSync(file,'utf8'),name=path.relative(root,file).replaceAll('\\','/');
  const fail=(pos,message)=>violations.push(`${name}:${source.slice(0,pos).split('\n').length}: ${message}`);
  if(file.endsWith('.css')){
    postcss.parse(source,{from:file}).walkRules(rule=>{
      if(/:hover\b/i.test(rule.selector))fail(rule.source.start.offset,'Hover state is unavailable on touch; use press/selection feedback.');
    });
    continue;
  }
  if(file.endsWith('.html')){
    for(const m of source.matchAll(/\s+title\s*=\s*["']/g))fail(m.index,'Native title tooltip; provide a tap detail or accessible description.');
    continue;
  }
  const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
  function visit(node){
    if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||ts.isTemplateHead(node)||ts.isTemplateMiddle(node)||ts.isTemplateTail(node)){
      const start=node.getStart(tree),literal=source.slice(start,node.end);
      for(const m of literal.matchAll(/\s+title(?=\s*=\s*\\?["'])/g))fail(start+m.index,'Native title tooltip; provide a tap detail or accessible description.');
    }
    if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.EqualsToken&&ts.isPropertyAccessExpression(node.left)&&node.left.name.text==='title'){
      // Document titles identify a page/tab; element titles create hover tips.
      if(!['document','documentRef'].includes(node.left.expression.getText(tree)))fail(node.getStart(tree),'Element .title creates a hover tooltip.');
    }
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='setAttribute'&&ts.isStringLiteral(node.arguments[0])&&node.arguments[0].text.toLowerCase()==='title')fail(node.getStart(tree),'Element title creates a hover tooltip.');
    ts.forEachChild(node,visit);
  }
  visit(tree);
}
if(violations.length){console.error(violations.join('\n'));process.exitCode=1;}
else console.log(`Touch UI check passed (${files.length} source files): no CSS hover states or native title tooltips.`);
