const LOBBY_STATES = new Set(['menu', 'gameover', 'victory']);
const SILENT_STATES = new Set(['victory_cinematic', 'victory_result', 'defeat_result', 'fixed_result', 'dying', 'replica-battle']);
const DUCKED_STATES = new Set(['paused', 'levelup', 'evolving', 'battle-supply', 'dodge-tutorial', 'revive-prompt']);

// One owner for music intent. Transitions use wall time, including when the
// lobby stops the game ticker. Cached players retain the lobby's playhead.
export class MusicDirector {
  constructor({ lobby, fights, boss, volume = 1, disabled = false, debug = () => {} }) {
    this.sources = { lobby, fights, boss };
    this.volume = volume;
    this.disabled = disabled;
    this.debug = debug;
    this.players = new Map();
    this.unlocked = false;
    this.hidden = false;
    this.key = null;
    this.source = '';
    this.timer = null;
  }

  beginRun() {
    // Combat starts fresh on every sortie; only the lobby resumes its position.
    for (const [source, entry] of this.players) {
      if (source === this.sources.lobby) continue;
      entry.target = 0;
      entry.audio.pause();
      entry.audio.volume = 0;
      try { entry.audio.currentTime = 0; } catch { /* Metadata may still be loading. */ }
    }
    this.key = null;
  }

  setMuted(muted,game,hidden=false) {
    this.muted=!!muted;
    this.key=null;
    this.update(game,hidden);
  }

  update(game, hidden = false) {
    if (this.disabled) return;
    let source = '';
    let gain = 1;
    const lobbyPreview = game.state === 'evolving' && game.evolutionReturnState === 'menu';
    if (game.sortieLoading || LOBBY_STATES.has(game.state) || lobbyPreview) {
      source = this.sources.lobby;
    } else if (!SILENT_STATES.has(game.state)) {
      // Stable chapter mapping: 1–7 use the seven tracks, then repeat.
      const chapter = Math.max(0, Math.floor(Number(game.stageIndex) || 0));
      source = game.bossSpawned ? this.sources.boss
        : this.sources.fights[chapter % this.sources.fights.length];
      if (game.bossWarningShown && !game.bossSpawned) gain = 0.4;
      if (DUCKED_STATES.has(game.state)) gain = Math.min(gain, 0.25);
    }
    source ||= '';
    const key = `${source}|${gain}|${hidden}`;
    if (key === this.key) return;
    this.key = key;
    this.hidden = hidden;
    this.source = source;
    this.debug('battleMusicSource', source);
    this.debug('musicScene', SILENT_STATES.has(game.state) ? 'settlement' : source === this.sources.lobby ? 'lobby' : game.bossSpawned ? 'boss' : 'battle');
    this.debug('battleMusicPlaying', false);
    if (hidden || this.muted) {
      this.stopFade();
      for (const entry of this.players.values()) {
        entry.target = 0;
        entry.audio.pause();
        entry.audio.volume = 0;
      }
      return;
    }
    if (!this.unlocked || typeof Audio !== 'function') return;
    if (source) this.getPlayer(source);
    const now = performance.now();
    for (const [url, entry] of this.players) {
      entry.from = entry.audio.volume;
      entry.target = url === source ? Math.min(1, this.volume * gain) : 0;
      entry.startedAt = now;
      entry.duration = source ? 650 : 900;
      if (entry.target > 0) this.play(entry);
    }
    this.stopFade();
    this.timer = setInterval(() => this.fade(), 32);
    this.fade();
  }

  getPlayer(source) {
    if (this.players.has(source)) return this.players.get(source);
    const audio = new Audio(source);
    audio.preload = 'auto';
    audio.loop = true;
    audio.volume = 0;
    const entry = { audio, source, target: 0, from: 0, pending: false };
    audio.addEventListener('playing', () => {
      if (this.hidden || (entry.target === 0 && audio.volume === 0)) {
        audio.pause();
        return;
      }
      if (this.source === source) {
        this.debug('battleMusicPlaying', true);
        this.debug('battleMusicBlocked', false);
      }
    });
    audio.addEventListener('error', () => {
      if (this.source === source) this.debug('battleMusicError', audio.error?.code || 'media-error');
    });
    this.players.set(source, entry);
    return entry;
  }

  play(entry) {
    if (this.hidden || this.muted || !this.unlocked || entry.target <= 0 || entry.pending) return;
    if (!entry.audio.paused) {
      if (entry.source === this.source) this.debug('battleMusicPlaying', true);
      return;
    }
    this.debug('battleMusicAttempted', true);
    entry.pending = true;
    try {
      Promise.resolve(entry.audio.play()).then(() => {
        if (this.hidden || (entry.target === 0 && entry.audio.volume === 0)) entry.audio.pause();
      }).catch(error => {
        if (entry.target > 0) this.debug('battleMusicBlocked', error?.name || 'play-rejected');
      }).finally(() => { entry.pending = false; });
    } catch (error) {
      entry.pending = false;
      this.debug('battleMusicBlocked', error?.name || 'play-rejected');
    }
  }

  unlock(game, hidden = false) {
    if (this.disabled || hidden) return;
    if (!this.unlocked) {
      this.unlocked = true;
      this.key = null;
    }
    this.update(game, hidden);
    // A gesture retries only the requested track, never a silent settlement
    // or a player that is currently fading out.
    for (const entry of this.players.values()) if (entry.target > 0) this.play(entry);
  }

  fade() {
    const now = performance.now();
    let pending = false;
    for (const entry of this.players.values()) {
      if (entry.audio.volume === entry.target) {
        if (entry.target === 0 && !entry.audio.paused) entry.audio.pause();
        continue;
      }
      const progress = Math.min(1, Math.max(0, (now - entry.startedAt) / entry.duration));
      const eased = progress * progress * (3 - 2 * progress);
      entry.audio.volume = progress === 1 ? entry.target : entry.from + (entry.target - entry.from) * eased;
      if (progress === 1 && entry.target === 0) entry.audio.pause();
      else if (progress < 1) pending = true;
    }
    if (!pending) this.stopFade();
  }

  stopFade() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }
}
