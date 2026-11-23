const menuSampleMs = 6000;
const slowArtworkMs = 150;
const ms = value => Math.round(Math.max(0, value));

function countArtwork(initial, visible) {
  const counts = { ready: 0, pending: 0, failed: 0, skipped: 0 };
  for (const texture of initial) {
    if (!visible.has(texture)) counts.skipped++;
    else if (texture.image) counts.ready++;
    else if (texture.userData.failed) counts.failed++;
    else counts.pending++;
  }
  return counts;
}

export function createWechatDebugLog(api, buildId) {
  let platform, base, manager;
  try { platform = api.getDeviceInfo?.()?.platform; } catch { /* Older clients may omit this API. */ }
  try { base = api.getAppBaseInfo?.(); } catch { /* The development tools can still log. */ }
  if (platform !== 'devtools' && base?.enableDebug !== true) return null;
  try { manager = api.getLogManager?.({ level: 1 }); } catch { /* Console output is still available. */ }

  function info(event, details) {
    const message = '[Three 调试] ' + event + ' ' + JSON.stringify(details);
    try { console.info(message); } catch { /* Diagnostics must not interrupt a frame. */ }
    try { manager?.info?.(message); } catch { /* Keep the console copy if the log manager fails. */ }
  }
  info('环境', { buildId, platform, sdk: base?.SDKVersion });

  let traceNumber = 0, activeMenu = null;
  function beginMenu(now, page, retained, startedAt = now()) {
    activeMenu?.stop('切页');
    const entry = ++traceNumber;
    let firstPaintMs = null, artworkMs = null, modelMs = null, usesModel = false;
    let initialArtwork, artwork, section, prepareCpuMs = 0, maxPaintCpuMs = 0, finished = false, slowLogs = 0;
    const timer = setTimeout(() => stop('超时'), menuSampleMs);

    function stop(status) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (activeMenu === trace) activeMenu = null;
      initialArtwork = null;
      info('页面首进结果', { entry, page, retained, section, status, elapsedMs: ms(now() - startedAt), firstPaintMs, artworkMs,
        modelMs: usesModel ? modelMs : undefined, artwork, maxPaintCpuMs: ms(maxPaintCpuMs) });
    }

    const trace = {
      prepare(duration) { if (!finished && firstPaintMs === null) prepareCpuMs += duration; },
      paint(textures, previewReady, shopSection, paintCpuMs) {
        if (finished) return false;
        const elapsed = ms(now() - startedAt), first = firstPaintMs === null;
        if (first) {
          initialArtwork = [...textures];
          firstPaintMs = elapsed;
          usesModel = typeof previewReady === 'boolean';
          section = shopSection;
        }
        maxPaintCpuMs = Math.max(maxPaintCpuMs, paintCpuMs);
        if (artworkMs === null) {
          artwork = countArtwork(initialArtwork, textures);
          if (!artwork.pending) {
            artworkMs = elapsed;
            initialArtwork = null;
          }
        }
        if (previewReady) modelMs ??= elapsed;
        if (first) info('页面首帧', { entry, page, retained, section, firstPaintMs, paintCpuMs: ms(paintCpuMs),
          prepareCpuMs: ms(prepareCpuMs), artwork, modelReady: usesModel ? previewReady : undefined });
        if (artworkMs !== null && (!usesModel || modelMs !== null)) stop(artwork.failed ? '有贴图失败' : '完成');
        return !finished;
      },
      slowArtwork(path, source, fileMs, decodeMs) {
        if (finished || slowLogs >= 6 || fileMs + decodeMs < slowArtworkMs) return;
        slowLogs++;
        const asset = String(path).split(/[?#]/, 1)[0].replace(/^[a-z]+:\/\/[^/]+\//i, '').split('/').slice(-3).join('/');
        info('慢贴图', { entry, page, asset, source, fileMs: ms(fileMs), decodeMs: ms(decodeMs) });
      },
      stop,
    };
    activeMenu = trace;
    return trace;
  }

  return { info, beginMenu, get activeMenu() { return activeMenu; } };
}
