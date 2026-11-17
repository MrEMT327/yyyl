export function createNativeEvents() {
  const listeners = new Map();
  return {
    addEventListener(type, listener, options = {}) {
      if (!listener || options.signal?.aborted) return;
      const entries = listeners.get(type) || new Map(); if (entries.has(listener)) return;
      const remove = () => this.removeEventListener(type, listener);
      entries.set(listener, { once: options.once, signal: options.signal, remove }); listeners.set(type, entries);
      options.signal?.addEventListener('abort', remove, { once: true });
    },
    removeEventListener(type, listener) { const entries = listeners.get(type), entry = entries?.get(listener); entry?.signal?.removeEventListener('abort', entry.remove); entries?.delete(listener); if (!entries?.size) listeners.delete(type); },
    dispatchEvent(event) { for (const [listener, options] of [...(listeners.get(event.type) || [])]) { if (!listeners.get(event.type)?.has(listener)) continue; if (options.once) this.removeEventListener(event.type, listener); if (typeof listener === 'function') listener.call(this, event); else listener.handleEvent(event); } return !event.defaultPrevented; },
  };
}
