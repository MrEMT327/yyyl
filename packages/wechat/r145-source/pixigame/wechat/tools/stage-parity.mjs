import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { compileSharedCss } from './compile-shared-css.mjs';
import { resolve } from 'node:path';

const [input, destination, baseURL] = process.argv.slice(2);
if (!input || !destination || !baseURL) throw new Error('需要编译目录、对照页目录和素材服务地址');
const source = resolve(input), output = resolve(destination);
const sheet = compileSharedCss(await readFile(resolve(source, 'preview.css'), 'utf8'), { baseURL });
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'shared-style.json'), JSON.stringify(sheet));
await copyFile(resolve(source, 'preview.js'), resolve(output, 'preview.js'));
await writeFile(resolve(output, 'index.html'), `<!doctype html><meta charset="utf-8"><title>微信完整适配 · 界面对照检查</title>
<style>body{margin:0;background:#18202a;color:white;display:flex;gap:20px}canvas{width:393px;height:852px;touch-action:none}pre{white-space:pre-wrap;font:13px monospace;max-width:600px}</style>
<canvas></canvas><pre>正在初始化对照检查…</pre>
<script type="module">import{startPreview}from'./preview.js';const report=document.querySelector('pre');window.addEventListener('error',e=>{report.textContent=e.error?.stack||e.message;});window.addEventListener('unhandledrejection',e=>{report.textContent=e.reason?.stack||e.reason;});startPreview().catch(e=>{report.textContent=e.stack;});</script>`);
console.log(JSON.stringify({ output, rules: sheet.rules.length }));
