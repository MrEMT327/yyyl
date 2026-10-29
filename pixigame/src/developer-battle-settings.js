export const DEVELOPER_SKILLS_KEY = 'thunder-developer-battle-skills-v1';

export function developerSkillsEnabled(storage = globalThis.localStorage) {
  try { return storage?.getItem(DEVELOPER_SKILLS_KEY) === '1'; } catch { return false; }
}

export function setDeveloperSkillsEnabled(enabled, storage = globalThis.localStorage) {
  if (!storage?.setItem) throw new Error('浏览器存储不可用');
  storage.setItem(DEVELOPER_SKILLS_KEY, enabled ? '1' : '0');
  if (developerSkillsEnabled(storage) !== enabled) throw new Error('开发设置保存失败，请重试');
}
