// Track all three GPU surfaces, including the detached aircraft/map canvas.
// Poll the native lost flag as well: it changes before the lost event is delivered.
export function createBattleGraphics({onChange = () => {}, signal} = {}) {
  const surfaces = new Map(); let disposed = false;
  const watch = (canvas, context) => {
    if (disposed || !context || surfaces.has(canvas)) return;
    const item = {context, lost: context.isContextLost()};
    item.lose = event => { event.preventDefault(); item.lost = true; onChange(); };
    item.restore = () => { item.lost = false; onChange(); };
    canvas.addEventListener('webglcontextlost', item.lose);
    canvas.addEventListener('webglcontextrestored', item.restore);
    surfaces.set(canvas, item);
  };
  const blocked = () => {
    if(disposed)return true;
    for(const item of surfaces.values())if(item.lost || item.context.isContextLost())return true;
    return false;
  };
  const destroy = () => {
    if (disposed) return; disposed = true;
    for (const [canvas, item] of surfaces) {
      canvas.removeEventListener('webglcontextlost', item.lose);
      canvas.removeEventListener('webglcontextrestored', item.restore);
    }
    surfaces.clear(); signal?.removeEventListener('abort', destroy);
  };
  signal?.addEventListener('abort', destroy, {once:true});
  if (signal?.aborted) destroy();
  return {watch, blocked, destroy};
}
