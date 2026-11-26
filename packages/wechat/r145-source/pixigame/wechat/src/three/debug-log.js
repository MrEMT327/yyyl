const menuSampleMs = 14000;
const menuQuietMs = 1500;
const maxLateBatches = 4;
const maxLoggedAssets = 6;
const slowArtworkMs = 150;
const battleSampleMs = 5000;
const ms = value => Math.round(Math.max(0, value));

const memoryWarningKey = 'shnh.wechat.lastMemoryWarning';
export function rememberMemoryWarning(api, warning) {
  try { api.setStorageSync(memoryWarningKey,warning); } catch { /* The system may already be low on memory. */ }
}
export function reportPreviousMemoryWarning(api) {
  try {
    const warning=api.getStorageSync(memoryWarningKey);
    if(!warning?.buildId)return;
    console.warn('[Three 上次内存告警]',JSON.stringify(warning));
    api.removeStorageSync(memoryWarningKey);
  } catch { /* Storage availability must not gate startup. */ }
}

function countArtwork(initial, frame) {
  const counts = { ready: 0, pending: 0, failed: 0, skipped: 0 };
  for (const texture of initial) counts[frame.get(texture) ?? 'skipped']++;
  return counts;
}

function assetName(path) {
  return String(path || '').split(/[?#]/, 1)[0].replace(/^[a-z]+:\/\/[^/]+\//i, '')
    .split('/').slice(-3).join('/').slice(0, 140);
}

function assetNames(textures) {
  const names = [];
  for (const texture of textures) {
    const name = assetName(texture.userData.assetPath);
    if (name && !names.includes(name)) names.push(name);
    if (names.length === maxLoggedAssets) break;
  }
  return names.length ? names : undefined;
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

  let traceNumber = 0, activeMenu = null, visibleMenu;
  function markMenuVisible(page, section) { visibleMenu = { page, section }; }

  function beginMenu(now, page, retained, startedAt = now(), { section, prepared } = {}) {
    activeMenu?.stop('切页');
    const entry = ++traceNumber, fromPage = visibleMenu?.page, fromSection = visibleMenu?.section;
    const context = { entry, fromPage, fromSection, page, section, retained, prepared };
    info('页面切换', context);
    let firstPaintMs = null, artworkMs = null, modelMs = null, usesModel = false;
    let initialArtwork, artwork, prepareCpuMs = 0, maxPaintCpuMs = 0, finished = false, slowLogs = 0;
    let lateBatches = 0, lateAssets = 0, lastLateMs, quietTimer, waitingFor, waitingArtwork, hadArtworkFailure = false;
    const seen = new Set();
    const timer = setTimeout(() => stop('超时'), menuSampleMs);

    function stop(status) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);clearTimeout(quietTimer);
      if (activeMenu === trace) activeMenu = null;
      const blocked = firstPaintMs === null && waitingArtwork
        ? [...waitingArtwork].filter(texture => !texture.image) : null;
      info('页面首进结果', { ...context, status, elapsedMs: ms(now() - startedAt), firstPaintMs, artworkMs,
        modelMs: usesModel ? modelMs : undefined, artwork, maxPaintCpuMs: ms(maxPaintCpuMs),
        lateBatches, lateAssets, lastLateMs, waitingFor: blocked ? waitingFor : undefined,
        waitingAssets: blocked ? assetNames(blocked) : undefined });
      initialArtwork = waitingArtwork = null;seen.clear();
    }

    const trace = {
      prepare(duration) { if (!finished && firstPaintMs === null) prepareCpuMs += duration; },
      wait(reason, textures) {
        if (!finished && firstPaintMs === null) { waitingFor = reason; waitingArtwork = textures; }
      },
      paint(frame, previewReady, paintCpuMs) {
        if (finished) return false;
        const elapsed = ms(now() - startedAt), first = firstPaintMs === null;
        const newlyVisible = [];
        let pending = false;
        for (const [texture, state] of frame) {
          pending ||= state === 'pending';hadArtworkFailure ||= state === 'failed';
          if (state !== 'ready') continue;
          const key = texture.userData.assetPath || texture;
          if (seen.has(key)) continue;
          seen.add(key);
          if (!first) newlyVisible.push(texture);
        }
        if (first) {
          initialArtwork = [...frame.keys()];firstPaintMs = elapsed;waitingArtwork = null;
          usesModel = typeof previewReady === 'boolean';
          markMenuVisible(page, section);
        }
        maxPaintCpuMs = Math.max(maxPaintCpuMs, paintCpuMs);
        if (artworkMs === null) {
          artwork = countArtwork(initialArtwork, frame);
          if (!artwork.pending) { artworkMs = elapsed;initialArtwork = null; }
        }
        if (previewReady) modelMs ??= elapsed;
        if (first) {
          const missing = [...frame].filter(([, status]) => status !== 'ready').map(([texture]) => texture);
          info('页面首帧', { ...context, firstPaintMs, paintCpuMs: ms(paintCpuMs), prepareCpuMs: ms(prepareCpuMs),
            artwork, missingAssets: assetNames(missing), modelReady: usesModel ? previewReady : undefined });
        } else if (newlyVisible.length) {
          lateBatches++;lateAssets += newlyVisible.length;lastLateMs = elapsed - firstPaintMs;
          if (lateBatches <= maxLateBatches) info('切页补图', { ...context, batch: lateBatches,
            afterFirstPaintMs: lastLateMs, count: newlyVisible.length, assets: assetNames(newlyVisible) });
        }
        if (pending || usesModel && modelMs === null || newlyVisible.length) {
          clearTimeout(quietTimer);quietTimer = undefined;
        }
        if (!pending && (!usesModel || modelMs !== null) && quietTimer === undefined) {
          quietTimer = setTimeout(() => stop(hadArtworkFailure ? '有贴图失败' : '完成'), menuQuietMs);
        }
        return true;
      },
      slowArtwork(path, source, fileMs, decodeMs) {
        if (finished || slowLogs >= maxLoggedAssets || fileMs + decodeMs < slowArtworkMs) return;
        slowLogs++;
        info('慢贴图', { entry, page, asset: assetName(path), source, fileMs: ms(fileMs), decodeMs: ms(decodeMs) });
      },
      stop,
    };
    activeMenu = trace;
    return trace;
  }

  function beginBattle(chapter,draws,readRenderPixels,readMemory) {
    if(readRenderPixels)info('战斗渲染配置',{buildId,chapter,renderPixels:readRenderPixels()});
    let frames=0,elapsed=0,over33ms=0,over50ms=0,maxGap=0,cpuMs=0,cpuFrames=0;
    let runId,runFrames=0,runElapsed=0,active=false,reported=false;
    let aircraftMs=0,projectilesMs=0,finishEffectsMs=0,detailFrames=0;
    let logicMs=0,worldDrawMs=0,uiDrawMs=0,passFrames=0;
    let terrainDrawCount=0,terrainDrawCpuMs=0,maxTerrainDrawCpuMs=0;
    let labelBatchFrames=0,labelDrawsSaved=0;
    let previous,previousWave,gapFrame,gapWave,gapDelivery;
    let deliveryCount=0,callbackTime=0,waitTime=0,waitOver50ms=0;
    let terrain=draws?.terrain,aircraft=draws?.aircraft,hud=draws?.hud;
    function resetWindow(){
      frames=elapsed=over33ms=over50ms=maxGap=cpuMs=cpuFrames=0;gapFrame=gapWave=gapDelivery=undefined;
      deliveryCount=callbackTime=waitTime=waitOver50ms=0;
      aircraftMs=projectilesMs=finishEffectsMs=detailFrames=0;
      logicMs=worldDrawMs=uiDrawMs=passFrames=0;
      terrainDrawCount=terrainDrawCpuMs=maxTerrainDrawCpuMs=0;
      labelBatchFrames=labelDrawsSaved=0;
      if(draws){terrain=draws.terrain;aircraft=draws.aircraft;hud=draws.hud;}
    }
    const runFps=()=>runElapsed?Math.round(10000*runFrames/runElapsed)/10:undefined;
    function reset(){resetWindow();previous=previousWave=undefined;active=false;}
    return {reset,finish(id){
      if(id!==runId||reported||!runElapsed)return;
      reported=true;info('战斗平均帧率',{chapter,run:runId,activeFrames:runFrames,activeMs:ms(runElapsed),
        avgFps:runFps(),targetFps:50,renderPixels:readRenderPixels?.(),memory:readMemory?.()});
    },sample(interval,wave,stats,id,delivery){
      if(!(interval>0&&Number.isFinite(interval)))return;
      if(runId!==id){reset();runId=id;runElapsed=runFrames=0;reported=false;}
      // An interval belongs to active play only when both ends are active.
      if(active&&id!==undefined){runFrames++;runElapsed+=interval;}active=true;
      frames++;elapsed+=interval;
      if(interval>maxGap){
        // The interval starts before this frame. Keep the previous frame's timings.
        maxGap=interval;gapFrame=previous;gapWave=previousWave;
        gapDelivery=previous&&delivery?{...delivery}:undefined;
      }
      if(previous&&delivery){
        deliveryCount++;callbackTime+=delivery.callbackMs;waitTime+=delivery.waitMs;
        if(delivery.waitMs>=50)waitOver50ms++;
      }
      previous=stats;previousWave=wave;
      if(interval>=1000/30)over33ms++;
      if(interval>=50)over50ms++;
      if(stats){
        const cpu=stats.logic+stats.terrainAndPlane+stats.entitiesAndEffects+stats.draw;
        if(Number.isFinite(cpu)){cpuMs+=cpu;cpuFrames++;}
        if(stats.labelDrawsSaved>0){labelBatchFrames++;labelDrawsSaved+=stats.labelDrawsSaved;}
        if(Number.isFinite(stats.terrainDrawCpuMs)){
          terrainDrawCount++;terrainDrawCpuMs+=stats.terrainDrawCpuMs;
          maxTerrainDrawCpuMs=Math.max(maxTerrainDrawCpuMs,stats.terrainDrawCpuMs);
        }
        if(Number.isFinite(stats.logic)&&Number.isFinite(stats.worldDraw)&&Number.isFinite(stats.uiDraw)){
          logicMs+=stats.logic;worldDrawMs+=stats.worldDraw;uiDrawMs+=stats.uiDraw;passFrames++;
        }
        if(Number.isFinite(stats.aircraftMs)&&Number.isFinite(stats.projectilesMs)&&Number.isFinite(stats.effectCleanupMs)){
          aircraftMs+=stats.aircraftMs;projectilesMs+=stats.projectilesMs;finishEffectsMs+=stats.effectCleanupMs;detailFrames++;
        }
      }
      if(elapsed<battleSampleMs)return;
      const frameBeforeMaxGap=gapFrame&&{wave:gapWave,logic:ms(gapFrame.logic),terrainAndPlane:ms(gapFrame.terrainAndPlane),
        entitiesAndEffects:ms(gapFrame.entitiesAndEffects),draw:ms(gapFrame.draw),worldDraw:ms(gapFrame.worldDraw),uiDraw:ms(gapFrame.uiDraw)};
      if(Number.isFinite(gapFrame?.aircraftMs)){
        for(const key of ['terrainMs','aircraftMs','enemiesMs','projectilesMs','pickupsAndEffectsMs'])
          frameBeforeMaxGap[key]=ms(gapFrame[key]);
        // The remainder includes host scheduling and work outside this view update.
        frameBeforeMaxGap.outsideUpdateMs=ms(Math.max(0,maxGap-gapFrame.logic-gapFrame.terrainAndPlane-gapFrame.entitiesAndEffects-gapFrame.draw));
      }
      if(Number.isFinite(gapFrame?.terrainDrawCpuMs)){
        frameBeforeMaxGap.terrainDrawCpuMs=+gapFrame.terrainDrawCpuMs.toFixed(2);
      }
      if(Number.isFinite(gapFrame?.drawCalls)){
        for(const key of ['drawCalls','triangles','textures','geometries','enemies','projectiles','pickups'])frameBeforeMaxGap[key]=gapFrame[key];
      }
      if(Number.isFinite(gapFrame?.pickupMs)){
        for(const key of ['pickupMs','statusAndEffectsMs','effectCleanupMs'])frameBeforeMaxGap[key]=ms(gapFrame[key]);
        frameBeforeMaxGap.textEffects=gapFrame.textEffects;
        frameBeforeMaxGap.labelDrawsSaved=gapFrame.labelDrawsSaved;
      }
      const perSecond=count=>Math.round(10000*count/elapsed)/10;
      const visualHz=draws?{terrain:perSecond(draws.terrain-terrain),aircraft:perSecond(draws.aircraft-aircraft),
        hud:perSecond(draws.hud-hud)}:undefined;
      info('局内帧率',{chapter,wave,frames,elapsedMs:ms(elapsed),fps:perSecond(frames),
        renderPixels:readRenderPixels?.(),
        terrainDrawCpu:terrainDrawCount?{count:terrainDrawCount,meanMs:+(terrainDrawCpuMs/terrainDrawCount).toFixed(2),
          maxMs:+maxTerrainDrawCpuMs.toFixed(2)}:undefined,
        labelBatch:labelBatchFrames?{frames:labelBatchFrames,drawsSaved:labelDrawsSaved}:undefined,
        runAvgFps:runFps(),activeMs:id===undefined?undefined:ms(runElapsed),
        meanStageMs:detailFrames?{aircraft:+(aircraftMs/detailFrames).toFixed(1),projectiles:+(projectilesMs/detailFrames).toFixed(1),
          effectFinish:+(finishEffectsMs/detailFrames).toFixed(1),
          ...(passFrames?{logic:+(logicMs/passFrames).toFixed(1),worldDraw:+(worldDrawMs/passFrames).toFixed(1),
            uiDraw:+(uiDrawMs/passFrames).toFixed(1)}:{})}:undefined,
        framesOver33ms:over33ms,framesOver50ms:over50ms,meanUpdateMs:cpuFrames?Math.round(10*cpuMs/cpuFrames)/10:undefined,
        frameDelivery:deliveryCount?{count:deliveryCount,meanCallbackMs:+(callbackTime/deliveryCount).toFixed(1),
          meanWaitMs:+(waitTime/deliveryCount).toFixed(1),waitOver50ms,
          beforeMaxGap:gapDelivery&&{callbackMs:ms(gapDelivery.callbackMs),afterPaintMs:ms(gapDelivery.afterPaintMs),waitMs:ms(gapDelivery.waitMs)}}:undefined,
        maxGapMs:ms(maxGap),frameBeforeMaxGap,visualHz,memory:readMemory?.()});
      resetWindow();
    }};
  }

  function beginResult(chapter,now){
    let run,outcome,started,flightRun,flightAt,receiptMs,firstPaintMs,waitLogged,complete=false;
    function start(id,phase){
      if((phase!=='won'&&phase!=='lost')||(run===id&&outcome===phase))return;
      run=id;outcome=phase;started=now();receiptMs=firstPaintMs=undefined;waitLogged=complete=false;
    }
    function details(elapsedMs){return {chapter,run,outcome:outcome==='won'?'胜利':'失败',elapsedMs,firstPaintMs,receiptMs,
      departureMs:outcome==='won'&&flightRun===run?ms(started-flightAt):undefined};}
    return {start,departure(id){if(flightRun!==id){flightRun=id;flightAt=now();}},
      receipt(id,phase){start(id,phase);if(run===id&&outcome===phase)receiptMs??=ms(now()-started);},
      painted(panel){
        if(!outcome||complete||!panel)return;
        const elapsed=ms(now()-started),first=firstPaintMs===undefined;
        if(!first&&!panel.motion.ready&&elapsed<2000)return;
        const textures=panel.resultTextures;
        let pending=0,failed=0;
        for(const texture of textures??[])if(!texture.image?.width){
          if(texture.userData.artworkFailed)failed++;else pending++;
        }
        const status=()=>{
          const pendingAssets=[],failedAssets=[];
          for(const texture of textures??[])if(!texture.image?.width){
            const names=texture.userData.artworkFailed?failedAssets:pendingAssets;
            if(names.length<4)names.push(String(texture.userData.artworkUrl??'').split(/[?#]/,1)[0].split('/').slice(-2).join('/'));
          }
          return {...details(elapsed),textures:textures?.size??0,pending,failed,pendingAssets,failedAssets,
            rewards:panel.resultSnapshot.rewards.length,receiptPending:panel.resultSnapshot.pending,controlsReady:panel.motion.ready};
        };
        if(first){firstPaintMs=elapsed;info('结算首帧',status());}
        if(!pending&&!panel.resultSnapshot.pending&&panel.motion.ready){
          complete=true;info('结算就绪',status());
        }else if(!waitLogged&&elapsed>=2000){waitLogged=true;info('结算仍在等待',status());}
      },
      close(){if(outcome&&!complete)info('结算离开',details(ms(now()-started)));complete=true;},
    };
  }
  return { info, beginMenu, markMenuVisible, beginBattle,beginResult, get activeMenu() { return activeMenu; } };
}
