import project from '../package.json' with { type: 'json' };

const storageKey = 'shnh-diagnostic-log-v1';
const maxEntries = 80;
const localTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'medium', hour12: false,
});
const startedAt = localTime.format(Date.now());
let recent = [];

function readEntries() {
  try {
    const entries = JSON.parse(globalThis.localStorage?.getItem(storageKey) ?? 'null');
    if (Array.isArray(entries) && (entries.at(-1)?.at ?? 0) >= (recent.at(-1)?.at ?? 0)) {
      return entries.slice(-maxEntries);
    }
  } catch { /* Use the current session when local storage is unavailable. */ }
  return recent;
}

function cleanDetail(value) {
  return String(value ?? '')
    .slice(0, 1200)
    .replace(/https?:\/\/[^\s"'<>]+/gi, url => {
      try { return new URL(url).pathname; } catch { return '[链接]'; }
    })
    .replace(/[?&][^\s"'<>]*/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 300);
}

export function recordDiagnostic(event, detail) {
  const now = Date.now();
  const entry = { at: now, event, detail: cleanDetail(detail) };
  const entries = readEntries();
  const previous = entries.at(-1);
  if (previous?.event === event && previous.detail === entry.detail && now - previous.at < 2000) return;
  recent = [...entries.slice(1 - maxEntries), entry];
  try { globalThis.localStorage?.setItem(storageKey, JSON.stringify(recent)); }
  catch { /* A logging failure must not stop the game. */ }
}

export function installBrowserDiagnostics(windowRef = globalThis.window) {
  const doc = windowRef?.document;
  if (!doc?.addEventListener || !windowRef.addEventListener) return;
  let resourceErrors = 0;
  windowRef.addEventListener('error', event => {
    if (event.target === windowRef) {
      const source = event.filename ? ` (${event.filename}:${event.lineno || 0})` : '';
      recordDiagnostic('脚本异常', `${event.message || '未知错误'}${source}`);
      return;
    }
    const asset = event.target?.currentSrc || event.target?.src || event.target?.href;
    if (asset && resourceErrors++ < 12) recordDiagnostic('资源加载失败', asset);
  }, true);
  windowRef.addEventListener('unhandledrejection', event => {
    recordDiagnostic('异步异常', event.reason?.message || (typeof event.reason === 'string' ? event.reason : '未知错误'));
  });
  doc.addEventListener('visibilitychange', () => recordDiagnostic(doc.hidden ? '切到后台' : '返回前台'));
}

export function diagnosticReport() {
  const navigator = globalThis.navigator;
  const wx = globalThis.wx;
  let environment = navigator?.userAgent || '未知设备';
  try {
    const device = wx?.getDeviceInfo?.();
    if (device) {
      const base = wx.getAppBaseInfo?.();
      environment = [device.model, device.system, base?.SDKVersion && `微信基础库 ${base.SDKVersion}`].filter(Boolean).join(' ');
    }
  } catch { /* Browser information is available as a fallback. */ }
  const entries = readEntries().filter(row => Number.isFinite(row?.at) && typeof row.event === 'string');
  const history = entries.map(row => {
    const time = new Date(row.at);
    const date = Number.isFinite(time.getTime()) ? localTime.format(time) : '';
    return `[${date}] ${row.event}${row.detail ? ' · ' + cleanDetail(row.detail) : ''}`;
  });
  let nativePerformance;
  try{nativePerformance=globalThis.__THUNDER_RUNTIME_GLOBALS__?.performanceStats?.();}catch{/* Startup may not have mounted the native painter yet. */}
  return [
    '少女航线 · 诊断日志',
    `版本 v${project.version} · 本次启动 ${startedAt}`,
    `环境 ${environment}`,
    ...(nativePerformance?[`原生界面统计 ${JSON.stringify(nativePerformance)}`]:[]),
    ...history,
  ].join('\n');
}

export async function copyDiagnosticReport(field) {
  const clipboard = globalThis.navigator?.clipboard;
  if (clipboard?.writeText) {
    try { await clipboard.writeText(field.value); return true; }
    catch { /* Local HTTP and embedded browsers may deny clipboard access. */ }
  }
  const doc = field.ownerDocument;
  const previous = doc.activeElement;
  field.focus();
  field.select();
  field.setSelectionRange(0, field.value.length);
  try {
    if (doc.execCommand?.('copy')) {
      previous?.focus();
      return true;
    }
  } catch { /* Leave the text selected for manual copy. */ }
  return false;
}
