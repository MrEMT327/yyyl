import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { optimizeUiAssetUrls } from './src/ui/ui-image-source.js';

export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    // The local preview serves dist while rebuilding. Keep its existing public
    // files and hashed chunks available until new output is written; open tabs
    // can still request a chunk from the preceding build.
    emptyOutDir: false,
    rollupOptions: { input: {
      index: fileURLToPath(new URL('./index.html', import.meta.url)),
      replicaBattle: fileURLToPath(new URL('./replica-battle/index.html', import.meta.url)),
      pathogenicRange: fileURLToPath(new URL('./pathogenic-range.html', import.meta.url)),
      gm: fileURLToPath(new URL('./tools/gm.html', import.meta.url)),
    } },
  },
  plugins: [
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
