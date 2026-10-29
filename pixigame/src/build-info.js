import project from '../package.json' with { type: 'json' };

export const PROJECT_VERSION = project.version;
export function createBuildIdentity(time = Date.now()) {
  const date = new Date(time);
  return Object.freeze({ version: PROJECT_VERSION, startedAt: date.toISOString(),
    label: date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) });
}
export const BUILD_IDENTITY = createBuildIdentity();

export function mountBuildIdentity(documentRef = document) {
  if (documentRef.getElementById('buildIdentity')) return;
  documentRef.title += ` · v${PROJECT_VERSION} · ${BUILD_IDENTITY.label}`;
  const badge = documentRef.createElement('small'); badge.id = 'buildIdentity';
  badge.className = 'build-identity'; badge.dataset.projectVersion = PROJECT_VERSION;
  badge.textContent = `v${PROJECT_VERSION} · ${BUILD_IDENTITY.label}`;
  documentRef.body.append(badge);
}
