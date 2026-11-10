import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { optimizeUiAssetUrls } from './src/ui/ui-image-source.js';
import { copyShippingPublic } from './tools/copy-shipping-public.mjs';

export default defineConfig(({ mode }) => ({
  root: fileURLToPath(new URL('./', import.meta.url)),
  base: './',
  server: {
    host: '127.0.0.1', port: 5211, strictPort: true,
    // Source art is not served at runtime and can be locked while being saved.
    // Keep watching public/art and application code for preview updates.
    watch: { followSymlinks:false, ignored: [
      ...['art', 'design'].map(dir => fileURLToPath(new URL(`./${dir}/**`, import.meta.url)).replaceAll('\\', '/')),
      // QA junctions contain builds and recordings that may be locked mid-write.
      /[\\/]public[\\/]__[^\\/]+(?:[\\/]|$)/,
    ] },
  },
  preview: { host: '127.0.0.1', port: 5211, strictPort: true },
  build: {
    // The local preview serves dist while rebuilding. Keep its existing public
    // files and hashed chunks available until new output is written; open tabs
    // can still request a chunk from the preceding build.
    emptyOutDir: false,
    copyPublicDir: false,
    rollupOptions: { input: {
      index: fileURLToPath(new URL('./index.html', import.meta.url)),
      replicaBattle: fileURLToPath(new URL('./replica-battle/index.html', import.meta.url)),
      pathogenicRange: fileURLToPath(new URL('./pathogenic-range.html', import.meta.url)),
      gm: fileURLToPath(new URL('./tools/gm.html', import.meta.url)),
    } },
  },
  plugins: [
    copyShippingPublic(),
    {
      name:'thunder-ui-delivery-images',enforce:'pre',
      transform(source,id){
        if(id.replaceAll('\\','/').endsWith('/replica-battle/kernel/loadout.css')) {
          return {code:source.replaceAll('/assets/','/replica-battle/assets/'),map:null};
        }
        if(id.replaceAll('\\','/').includes('/src/ui/')&&id.split('?')[0].endsWith('.css')){
          return {code:optimizeUiAssetUrls(source),map:null};
        }
      },
    },
    {
      name: 'thunder-platform-html',
      transformIndexHtml(html) {
        if (mode === '4399') return html;
        if (mode === 'economy') html = html.replace(/<title>(.*?)<\/title>/, '<title>正常资源验证 · $1</title>');
        return html.replace(
          /\s*<script src="https:\/\/h\.api\.4399\.com\/h5mini-2\.0\/h5api-interface\.php"><\/script>/,
          '',
        );
      },
    },
  ],
  define: {
    // A dedicated build + port allow normal-resource checks without touching
    // the existing unlimited-resource save on port 4173.
    ...(mode === 'economy' ? { 'import.meta.env.VITE_UNLIMITED_RESOURCES': JSON.stringify('false') } : {}),
    // Vite 7 can surface an all-numeric CLI mode as a number. Inject a stable
    // string so platform feature gates are deterministic in production.
    __THUNDER_RELEASE_MODE__: JSON.stringify(String(mode)),
  },
}));
