const firstSounds = new Set([
  'pathogenic:gun', 'pathogenic:hit', 'pathogenic:hit2', 'pathogenic:hit3', 'pathogenic:hit4',
  'pathogenic:enemyShot', 'pathogenic:playerHit', 'pathogenic:death', 'pathogenic:pickup',
  'project:flight-roll', 'feedback:choice', 'feedback:upgrade',
]);

// Aliases share an immutable decoded buffer. Keep different loop transforms
// separate, and bound both downloads and decodes instead of bursting the full
// sound catalog on the first touch inside combat.
export async function preloadBattleAudio({manifest, context, fetchResource = fetch, baseURL = typeof document === 'undefined' ? undefined : document.baseURI, signal, onBuffer, onError}) {
  const groups = new Map();
  for (const [key, entry] of Object.entries(manifest)) {
    const url = typeof entry === 'string' ? entry : entry?.url;
    if (!url || /BGM/i.test(key) || entry?.music) continue;
    const loop = entry?.pingPong;
    let address = String(url);
    try { address = new URL(address, baseURL).href; } catch { /* A test or detached host may not have a base URL. */ }
    const identity = JSON.stringify([address, loop ? [loop.begin, loop.end, loop.sampleRate] : null]);
    let group = groups.get(identity);
    if (!group) { group = {url, loop, keys: [], first: false}; groups.set(identity, group); }
    group.keys.push(key); group.first ||= firstSounds.has(key);
  }
  const all = [...groups.values()], queue = [...all.filter(row => row.first), ...all.filter(row => !row.first)];
  let cursor = 0;
  async function worker() {
    while (!signal?.aborted && cursor < queue.length) {
      const {url, loop, keys} = queue[cursor++];
      try {
        const response = await fetchResource(url, {signal});
        if (signal?.aborted) return;
        if (!response.ok) throw Error(`Audio HTTP ${response.status}: ${url}`);
        const bytes = await response.arrayBuffer();
        if (signal?.aborted) return;
        let buffer = await context.decodeAudioData(bytes);
        if (signal?.aborted) return;
        if (loop) {
          const a = Math.round(loop.begin / loop.sampleRate * buffer.sampleRate);
          const b = Math.min(buffer.length, Math.round(loop.end / loop.sampleRate * buffer.sampleRate)), n = b - a;
          const pingPong = context.createBuffer(buffer.numberOfChannels, n * 2, buffer.sampleRate);
          for (let c = 0; c < buffer.numberOfChannels; c++) {
            const input = buffer.getChannelData(c), output = pingPong.getChannelData(c);
            for (let i = 0; i < n; i++) { output[i] = input[a + i]; output[n + i] = input[b - 1 - i]; }
          }
          buffer = pingPong;
        }
        for (const key of keys) onBuffer(key, buffer);
      } catch (error) {
        if (!signal?.aborted) onError?.(keys[0], error);
      }
    }
  }
  await Promise.all(Array.from({length: Math.min(4, queue.length)}, () => worker()));
}
