import {FEEDBACK_SOUNDS,feedbackAudioManifest} from '../../src/ui/feedback-sounds.js';
// Browser audio is unlocked exclusively by a player gesture. No remote resources.
export class GameAudio {
  private context?: AudioContext;
  private buffers = new Map<string, AudioBuffer>();
  private master?: GainNode;
  private compressor?: DynamicsCompressorNode;
  private effectVoices = new Map<string,Map<AudioBufferSourceNode,GainNode>>();
  private hitVariant = 0;
  private voices = new Map<string, number>();
  private music?: HTMLAudioElement;
  private musicKey = '';
  private loops = new Map<string,{source:AudioBufferSourceNode;gain:GainNode;volume:number}>();
  private charges=new Map<string,{source:AudioBufferSourceNode;gain:GainNode;token:string}>();
  private chargeTokens=new Set<string>();
  private loading?: Promise<void>;
  private disposed = false;
  private paused = false;
  private sources = new Set<AudioBufferSourceNode>();
  private feedbackVoice?: {source:AudioBufferSourceNode;gain:GainNode};
  private feedbackTimes=new Map<string,number>();
  enabled = true;
  constructor(private manifest: Record<string, any>) {
    this.manifest={...manifest,...feedbackAudioManifest};
    try { this.enabled = localStorage.getItem('danke-audio') !== 'off'; } catch { /* private storage */ }
  }
  async unlock() {
    if (this.disposed) return;
    // Retry blocked HTML music inside this gesture, before WebAudio resume or
    // sound decoding can yield. A paused run must stay silent during unlock.
    this.playMusic();
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? 0.55 : 0;
      this.compressor=this.context.createDynamicsCompressor();
      this.compressor.threshold.value=-10;this.compressor.knee.value=12;this.compressor.ratio.value=6;
      this.compressor.attack.value=.003;this.compressor.release.value=.12;
      this.master.connect(this.compressor);this.compressor.connect(this.context.destination);
      this.loading = Promise.all(Object.entries(this.manifest).map(async ([key, entry]) => {
        const url = typeof entry === 'string' ? entry : entry.url;
        if (!url || /BGM/i.test(key) || entry.music) return;
        try {
          const response=await fetch(url); if(!response.ok)throw Error(`Audio HTTP ${response.status}: ${url}`);
          let buffer=await this.context!.decodeAudioData(await response.arrayBuffer());
          if(this.disposed)return;
          // Godot loopMode 2 is ping-pong. AudioBuffer may be resampled by the context.
          if(entry.pingPong){
            const m=entry.pingPong,a=Math.round(m.begin/m.sampleRate*buffer.sampleRate),b=Math.min(buffer.length,Math.round(m.end/m.sampleRate*buffer.sampleRate)),n=b-a;
            const loop=this.context!.createBuffer(buffer.numberOfChannels,n*2,buffer.sampleRate);
            for(let c=0;c<buffer.numberOfChannels;c++){const input=buffer.getChannelData(c),output=loop.getChannelData(c);for(let i=0;i<n;i++){output[i]=input[a+i];output[n+i]=input[b-1-i];}}
            buffer=loop;
          }
          this.buffers.set(key,buffer);
        } catch(error) { if(!this.disposed)console.warn('[battle audio]',key,error); }
      })).then(()=>{});
    }
    if (this.disposed)return;
    if (this.context.state === 'suspended') await this.context.resume();
    await this.loading;
  }
  private playMusic() {
    if (this.disposed || this.paused || !this.enabled || !this.music || !this.music.paused) return;
    // A rejected play remains retryable on the next gesture/explicit resume.
    // Reuse the same element and position; never poll or create duplicate BGM.
    this.music.play().catch(() => {});
  }
  startMusic(key?: string) {
    if (this.disposed) return;
    const entries = Object.entries(this.manifest);
    const selected = key && this.manifest[key] ? [key, this.manifest[key]] : entries.find(([name]) => /BGM_Battle|fightforthefuture/i.test(name)) || entries.find(([name]) => /BGM/i.test(name));
    if (!selected) return;
    const entry = selected[1];
    const url = typeof entry === 'string' ? entry : entry.url;
    if (this.musicKey !== selected[0]) { this.music?.pause(); this.music = new Audio(url); this.music.loop = true; this.music.volume = 0.2; this.musicKey = selected[0]; }
    this.playMusic();
  }
  effect(key: string, volume = 0.3, interval = 0.08) {
    if (this.disposed || !this.enabled || !this.context || !this.master) return;
    if(this.loops.has(key))return; // The live electric/laser voice already covers this sample.
    const voiceKey = key;
    const now = this.context.currentTime;
    if (now - (this.voices.get(voiceKey) ?? -10) < interval || this.sources.size >= 16) return;
    // Cosmetic rotation only after admission; all hit samples share one limiter and tail budget.
    if(key==='pathogenic:hit')key=['pathogenic:hit','pathogenic:hit2','pathogenic:hit3','pathogenic:hit4'][this.hitVariant % 4];
    const buffer = this.buffers.get(key);
    if (!buffer) return;
    if(voiceKey==='pathogenic:hit')this.hitVariant++;
    this.voices.set(voiceKey, now);
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain); gain.connect(this.master);
    const group=this.effectVoices.get(voiceKey)||new Map<AudioBufferSourceNode,GainNode>();
    this.effectVoices.set(voiceKey,group);
    // Keep newest feedback; the long explosion tail has a single-voice budget.
    if(group.size>=(voiceKey==='pathogenic:explosion'?1:2)){const [old,oldGain]=group.entries().next().value!;group.delete(old);
      oldGain.gain.cancelScheduledValues(now);oldGain.gain.setValueAtTime(oldGain.gain.value,now);
      oldGain.gain.linearRampToValueAtTime(0,now+.015);try{old.stop(now+.02);}catch{}}
    group.set(source,gain);this.sources.add(source);
    source.onended = () => { group.delete(source); if(!group.size&&this.effectVoices.get(voiceKey)===group)this.effectVoices.delete(voiceKey); this.sources.delete(source); source.disconnect(); gain.disconnect(); };
    source.start();
  }
  stopFeedback() {
    const voice=this.feedbackVoice;this.feedbackVoice=undefined;if(!voice||!this.context)return;
    const now=this.context.currentTime;voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value,now);voice.gain.gain.linearRampToValueAtTime(0,now+.015);
    try{voice.source.stop(now+.02);}catch{}
  }
  feedback(key: keyof typeof FEEDBACK_SOUNDS) {
    const ctx=this.context,cue=FEEDBACK_SOUNDS[key],buffer=this.buffers.get(`feedback:${key}`);
    if(!cue||!this.enabled||this.disposed||document.hidden)return true;
    if(!buffer||!ctx||!this.master||ctx.state!=='running')return false;
    if(ctx.currentTime-(this.feedbackTimes.get(key)??-Infinity)<cue.interval)return true;
    this.feedbackTimes.set(key,ctx.currentTime);this.stopFeedback();
    const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;source.loop=false;
    gain.gain.value=cue.gain/.55;source.connect(gain);gain.connect(this.master);
    const voice={source,gain};this.feedbackVoice=voice;
    source.onended=()=>{if(this.feedbackVoice===voice)this.feedbackVoice=undefined;source.disconnect();gain.disconnect();};source.start();return true;
  }
  // Finite charge clips are cancellable, never looped. A token is one native warning phase.
  syncCharges(cues: {key:string;token:string;volume:number}[]) {
    const active=this.enabled&&!this.paused&&!this.disposed?cues:[];
    const desired=new Map(active.map(c=>[c.token,c]));
    for(const [key,voice] of this.charges)if(!desired.has(voice.token)){
      this.charges.delete(key);const now=this.context!.currentTime;
      voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setValueAtTime(voice.gain.gain.value,now);
      voice.gain.gain.linearRampToValueAtTime(0,now+.025);try{voice.source.stop(now+.03);}catch{}
    }
    if(!this.context||!this.master)return;
    for(const cue of active){
      if(this.chargeTokens.has(cue.token))continue;
      const key=cue.key,buffer=this.buffers.get(key);if(!buffer)continue;
      this.chargeTokens.add(cue.token);
      if(this.chargeTokens.size>512)this.chargeTokens.delete(this.chargeTokens.values().next().value!);
      if(this.charges.has(key)||this.sources.size>=16)continue; // Coalesce simultaneous enemies.
      const source=this.context.createBufferSource(),gain=this.context.createGain();
      source.buffer=buffer;source.loop=false;gain.gain.value=cue.volume;
      source.connect(gain);gain.connect(this.master);const voice={source,gain,token:cue.token};
      this.charges.set(key,voice);this.sources.add(source);
      source.onended=()=>{if(this.charges.get(key)===voice)this.charges.delete(key);this.sources.delete(source);source.disconnect();gain.disconnect();};source.start();
    }
  }
  syncContinuous(cues: {key:string;volume:number;pulse?:boolean}[]) {
    const desired=new Map((this.enabled&&!this.paused&&!this.disposed?cues:[]).map(c=>[c.key,c]));
    for(const[key,voice]of this.loops)if(!desired.has(key)){
      this.loops.delete(key); const now=this.context!.currentTime;
      voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setValueAtTime(voice.gain.gain.value,now);voice.gain.gain.linearRampToValueAtTime(0,now+.035);
      try{voice.source.stop(now+.04);}catch{}
    }
    if(!this.context||!this.master)return;
    for(const[key,cue]of desired){
      const buffer=this.buffers.get(key),existing=this.loops.get(key);
      if(existing){
        if(existing.volume!==cue.volume){existing.gain.gain.cancelScheduledValues(this.context.currentTime);existing.gain.gain.setValueAtTime(existing.gain.gain.value,this.context.currentTime);existing.gain.gain.linearRampToValueAtTime(cue.volume,this.context.currentTime+.035);existing.volume=cue.volume;}
        continue;
      }
      if(!buffer)continue;
      // A continuous voice replaces any matching transient tail instead of stacking.
      const tails=this.effectVoices.get(key);if(tails){for(const[source,gain]of tails){gain.gain.cancelScheduledValues(this.context.currentTime);gain.gain.setValueAtTime(gain.gain.value,this.context.currentTime);gain.gain.linearRampToValueAtTime(0,this.context.currentTime+.015);try{source.stop(this.context.currentTime+.02);}catch{}}tails.clear();this.effectVoices.delete(key);}
      const source=this.context.createBufferSource(),gain=this.context.createGain(),voice={source,gain,volume:cue.volume};
      source.buffer=buffer;source.loop=!cue.pulse;
      gain.gain.setValueAtTime(0,this.context.currentTime);gain.gain.linearRampToValueAtTime(cue.volume,this.context.currentTime+.025);
      source.connect(gain);gain.connect(this.master);this.loops.set(key,voice);this.sources.add(source);
      source.onended=()=>{if(this.loops.get(key)===voice)this.loops.delete(key);this.sources.delete(source);source.disconnect();gain.disconnect();};source.start();
    }
  }
  pause(stopFeedback=true,keepMusic=false) { if(stopFeedback)this.stopFeedback();this.paused=!keepMusic; if(keepMusic)this.playMusic();else this.music?.pause(); this.loops.clear(); this.charges.clear(); for (const source of this.sources) { try { source.stop(); } catch {} } this.sources.clear(); this.effectVoices.clear(); }
  dispose() { this.disposed=true;this.pause();this.buffers.clear();this.compressor?.disconnect(); }
  resume() { if (this.disposed) return; this.paused=false; this.playMusic(); }
  restart() { this.pause(); this.chargeTokens.clear(); this.voices.clear();this.feedbackTimes.clear(); if (this.music) this.music.currentTime = 0; this.resume(); }
  toggle() {
    this.enabled = !this.enabled;
    if (this.master) this.master.gain.value = this.enabled ? 0.55 : 0;
    if (this.enabled) this.resume(); else this.pause();
    try { localStorage.setItem('danke-audio', this.enabled ? 'on' : 'off'); } catch {}
    return this.enabled;
  }
}
