import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { compileSharedCss } from './compile-shared-css.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const [destination, origin = 'http://192.168.23.227:4173'] = process.argv.slice(2);
if (!destination) throw new Error('需要独立的对照页输出目录');
const output = resolve(destination);
await mkdir(output, { recursive: true });
const globals = ['window', 'document', 'self', 'navigator', 'location', 'localStorage', 'sessionStorage', 'Image', 'getComputedStyle', 'ResizeObserver', 'MutationObserver', 'HTMLElement', 'Element', 'HTMLCanvasElement', 'HTMLImageElement', 'HTMLVideoElement', 'Node', 'DOMParser', 'Event', 'CustomEvent', 'EventTarget', 'devicePixelRatio', 'innerWidth', 'innerHeight'];
await build({ absWorkingDir: root, entryPoints: ['wechat/src/full/preview.js'], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', outfile: resolve(output, 'preview.js'),
  external: ['/art/*', '/replica-battle/assets/*', '/audio/*', '/assets/*', 'canvas'],
  banner: { js: 'const __browserGlobal = window; const globalThis = new Proxy(Object.create(null), {get:(target,key)=>Object.hasOwn(target,key)?target[key]:Reflect.get(__browserGlobal,key,__browserGlobal)});' },
  define: { ...Object.fromEntries(globals.map(name => [name, `globalThis.${name}`])),
    'import.meta.env.BASE_URL': '"/"', 'import.meta.env.DEV': 'true', 'import.meta.env.PROD': 'false', 'import.meta.env': '{}', __THUNDER_RELEASE_MODE__: '"development"' },
});
const sheet = compileSharedCss(await readFile(resolve(output, 'preview.css'), 'utf8'), { baseURL: `${origin}/` });
await writeFile(resolve(output, 'shared-style.json'), JSON.stringify(sheet));
await writeFile(resolve(output, 'index.html'), `<!doctype html><meta charset="utf-8"><title>微信完整适配 · 界面对照检查</title>
<style>body{margin:0;background:#18202a;color:white;display:flex;gap:20px}canvas{width:393px;height:852px;touch-action:none}pre{white-space:pre-wrap;font:13px monospace;max-width:600px}</style><canvas></canvas><pre>正在初始化对照检查…</pre>
<script type="module">import{startPreview}from'./preview.js';const report=document.querySelector('pre');window.addEventListener('error',e=>{report.textContent=e.error?.stack||e.message;});window.addEventListener('unhandledrejection',e=>{report.textContent=e.reason?.stack||e.reason;});startPreview().catch(e=>{report.textContent=e.stack;});</script>`);
console.log(JSON.stringify({ output, rules: sheet.rules.length }));
