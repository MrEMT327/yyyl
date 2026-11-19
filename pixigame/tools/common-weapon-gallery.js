import { mountWeaponPreview } from '../src/weapon-preview/page.js';

try {
  const base=document.createElement('base');base.href=new URL('../',location.href).href;document.head.append(base);
  await mountWeaponPreview();
  document.querySelector('#loading')?.remove();
} catch (error) {
  console.error('Weapon preview failed', error);
  document.querySelector('#loading').textContent = '加载失败，请检查网络后刷新重试。';
}
