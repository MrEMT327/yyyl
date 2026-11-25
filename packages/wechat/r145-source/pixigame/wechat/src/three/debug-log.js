const menuSampleMs = 6000;
const slowArtworkMs = 150;
const battleSampleMs = 5000;
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

  function beginBattle(chapter,draws) {
    let frames=0,elapsed=0,over33ms=0,maxGap=0;
    let previous,previousWave,gapFrame,gapWave;
    let terrain=draws?.terrain,aircraft=draws?.aircraft,hud=draws?.hud;
    function resetWindow(){
      frames=elapsed=over33ms=maxGap=0;gapFrame=gapWave=undefined;
      if(draws){terrain=draws.terrain;aircraft=draws.aircraft;hud=draws.hud;}
    }
    return {reset(){resetWindow();previous=previousWave=undefined;},sample(interval,wave,stats){
      if(!(interval>0&&Number.isFinite(interval)))return;
      frames++;elapsed+=interval;
      if(interval>maxGap){
        // The interval starts before this frame. Keep the previous frame's timings.
        maxGap=interval;gapFrame=previous;gapWave=previousWave;
      }
      previous=stats;previousWave=wave;
      if(interval>=1000/30)over33ms++;
      if(elapsed<battleSampleMs)return;
      const frameBeforeMaxGap=gapFrame&&{wave:gapWave,logic:ms(gapFrame.logic),terrainAndPlane:ms(gapFrame.terrainAndPlane),
        entitiesAndEffects:ms(gapFrame.entitiesAndEffects),draw:ms(gapFrame.draw),worldDraw:ms(gapFrame.worldDraw),uiDraw:ms(gapFrame.uiDraw)};
      const perSecond=count=>Math.round(10000*count/elapsed)/10;
      const visualHz=draws?{terrain:perSecond(draws.terrain-terrain),aircraft:perSecond(draws.aircraft-aircraft),
        hud:perSecond(draws.hud-hud)}:undefined;
      info('局内帧率',{chapter,wave,frames,elapsedMs:ms(elapsed),fps:perSecond(frames),
        framesOver33ms:over33ms,maxGapMs:ms(maxGap),frameBeforeMaxGap,visualHz});
      resetWindow();
    }};
  }

  return { info, beginMenu, beginBattle, get activeMenu() { return activeMenu; } };
}
