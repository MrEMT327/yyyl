import {FEEDBACK_SOUNDS,feedbackAudioManifest} from '../../src/ui/feedback-sounds.js';
import {AUDIO_PREFERENCES_KEY,readAudioPreferences,saveAudioPreferences} from '../../src/audio-preferences.js';
import {isOpeningBattleSound,preloadBattleAudio} from '../battle-audio-preload.js';
// Browser audio is unlocked exclusively by a player gesture. No remote resources.
interface BattleMusicTrack { paused:boolean;loop:boolean;volume:number;currentTime:number;play():Promise<void>;pause():void;destroy?():void; }
type BattleAudioHost={
  storage?:Pick<Storage,'getItem'|'setItem'>;hidden?:()=>boolean;baseURL?:string;
  fetchResource?:typeof fetch;makeAbort?:()=>AbortController;createContext?:()=>AudioContext;
  createTrack?:(url:string)=>BattleMusicTrack;
  audioDiagnostic?:(state:string,detail?:unknown)=>void;
};

export class GameAudio {
  private context?: AudioContext;
  private buffers = new Map<string, AudioBuffer>();
  private master?: GainNode;
  private compressor?: DynamicsCompressorNode;
  private effectVoices = new Map<string,Map<AudioBufferSourceNode,GainNode>>();
  private hitVariant = 0;
  private voices = new Map<string, number>();
  private music?: BattleMusicTrack;
  private musicKey = '';
  private loops = new Map<string,{source:AudioBufferSourceNode;gain:GainNode;volume:number}>();
  private charges=new Map<string,{source:AudioBufferSourceNode;gain:GainNode;token:string}>();
  private chargeTokens=new Set<string>();
  private loading?: Promise<void>;
  private loadingController?: AbortController;
  private loadedEffects: 'none'|'opening'|'all' = 'none';
  private resumePending?: Promise<void>;
  private reportedEffect=false;
  private disposed = false;
  private paused = false;
  private sources = new Set<AudioBufferSourceNode>();
  private feedbackVoice?: {source:AudioBufferSourceNode;gain:GainNode};
  private feedbackTimes=new Map<string,number>();
  preferences = {music:true,effects:true};
  private active = true;
  get enabled() {return this.active&&(this.preferences.music||this.preferences.effects);}
  set enabled(value:boolean) {this.active=value;}
  get needsCombatCues() {return this.enabled&&this.preferences.effects&&!this.paused&&!this.disposed&&Boolean(this.context&&this.master);}
  constructor(private manifest: Record<string, any>,private host:BattleAudioHost={}) {
    this.manifest={...manifest,...feedbackAudioManifest};
    try {
      const storage=this.host.storage??localStorage;
      if(storage.getItem(AUDIO_PREFERENCES_KEY)!==null)this.preferences=readAudioPreferences(storage);
      else {const enabled=storage.getItem('danke-audio')!=='off';this.preferences={music:enabled,effects:enabled};}
    } catch { /* private storage */ }
  }
  readPcmStats() {
    const buffers = new Set(this.buffers.values());
    let bytes = 0;
    for (const {length, numberOfChannels} of buffers) {
      if (!Number.isFinite(length) || !Number.isFinite(numberOfChannels)) return {buffers:buffers.size, bytes:null};
      bytes += length * numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
    }
    return {buffers:buffers.size, bytes};
  }
  async unlock(openingOnly=false) {
    if (this.disposed||this.host.hidden?.()) return;
    // Retry blocked HTML music inside this gesture, before WebAudio resume or
    // sound decoding can yield. A paused run must stay silent during unlock.
    this.playMusic();
    if(!this.preferences.effects){this.host.audioDiagnostic?.('disabled');return;}
    if (!this.context) {
      let context:AudioContext|undefined;
      try{
        context=this.host.createContext?.() ?? new AudioContext();
        const master=context.createGain();master.gain.value=this.enabled?0.55:0;
        let compressor:DynamicsCompressorNode|undefined;
        try{
          compressor=context.createDynamicsCompressor();
          compressor.threshold.value=-10;compressor.knee.value=12;compressor.ratio.value=6;
          compressor.attack.value=.003;compressor.release.value=.12;
          compressor.connect(context.destination);master.connect(compressor);
        }catch{
          try{compressor?.disconnect();}catch{}
          compressor=undefined;master.connect(context.destination);
          this.host.audioDiagnostic?.('direct-gain');
        }
        this.context=context;this.master=master;this.compressor=compressor;
        this.loadingController=this.host.makeAbort?.()??new AbortController();
      }catch(error){
        try{void context?.close()?.catch(()=>{});}catch{}
        this.host.audioDiagnostic?.('init-failed',error);return;
      }
    }
    const context=this.context,signal=this.loadingController!.signal;
    if(this.loadedEffects!=='all'&&!(openingOnly&&this.loadedEffects==='opening')){
      const selection=this.loadedEffects==='none'&&!openingOnly?this.manifest:Object.fromEntries(Object.entries(this.manifest)
        .filter(([key])=>openingOnly?isOpeningBattleSound(key):!isOpeningBattleSound(key)));
      this.loadedEffects=openingOnly?'opening':'all';
      const preload=()=>preloadBattleAudio({manifest:selection,context,signal,maxWorkers:openingOnly?2:4,
        fetchResource:this.host.fetchResource,baseURL:this.host.baseURL,
        onBuffer:(key,buffer)=>{if(!this.disposed&&context===this.context)this.buffers.set(key,buffer);},
        onError:(key,error)=>{if(!this.disposed)console.warn('[battle audio]',key,error);},
      });
      this.loading=(this.loading?this.loading.then(preload):preload()).then(()=>{
        if(!signal.aborted)this.host.audioDiagnostic?.('buffers',this.buffers.size);
      });
    }
    if(context.state==='suspended'){
      try{
        const pending=this.resumePending??=context.resume();
        await pending;
        if(this.resumePending===pending)this.resumePending=undefined;
      }catch(error){this.resumePending=undefined;this.host.audioDiagnostic?.('resume-failed',error);}
    }
    await this.loading;
  }
  private playMusic() {
    if (this.disposed || this.host.hidden?.() || this.paused || !this.enabled || !this.preferences.music || !this.music || !this.music.paused) return;
    // A rejected play remains retryable on the next gesture/explicit resume.
    // Reuse the same element and position; never poll or create duplicate BGM.
    this.music.play().catch(() => {});
  }
  startMusic(key?: string, restart = false) {
    if (this.disposed) return;
    const entries = Object.entries(this.manifest);
    const selected = key && this.manifest[key] ? [key, this.manifest[key]] : entries.find(([name]) => /BGM_Battle|fightforthefuture/i.test(name)) || entries.find(([name]) => /BGM/i.test(name));
    if (!selected) return;
    const entry = selected[1];
    const url = typeof entry === 'string' ? entry : entry.url;
    if (this.musicKey !== selected[0]) { this.music?.pause();this.music?.destroy?.(); this.music = this.host.createTrack?.(url) ?? new Audio(url); this.music.loop = true; this.music.volume = 0.2; this.musicKey = selected[0]; }
    if (restart) { this.restart(); return; }
    this.playMusic();
  }
  effect(key: string, volume = 0.3, interval = 0.08) {
    if (this.disposed || !this.enabled || !this.preferences.effects || !this.context || !this.master) return;
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
    if(!this.reportedEffect){this.reportedEffect=true;this.host.audioDiagnostic?.('first-effect',key);}
  }
  stopFeedback() {
    const voice=this.feedbackVoice;this.feedbackVoice=undefined;if(!voice||!this.context)return;
    const now=this.context.currentTime;voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value,now);voice.gain.gain.linearRampToValueAtTime(0,now+.015);
    try{voice.source.stop(now+.02);}catch{}
  }
  feedback(key: keyof typeof FEEDBACK_SOUNDS) {
    const ctx=this.context,cue=FEEDBACK_SOUNDS[key],buffer=this.buffers.get(`feedback:${key}`);
    if(!cue||!this.enabled||!this.preferences.effects||this.disposed||(this.host.hidden?.()??document.hidden))return true;
    if(!buffer||!ctx||!this.master||ctx.state!=='running')return false;
    if(ctx.currentTime-(this.feedbackTimes.get(key)??-Infinity)<cue.interval)return true;
    this.feedbackTimes.set(key,ctx.currentTime);this.stopFeedback();
    const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;source.loop=false;
    gain.gain.value=cue.gain/.55;source.connect(gain);gain.connect(this.master);
    const voice={source,gain};this.feedbackVoice=voice;
    source.onended=()=>{if(this.feedbackVoice===voice)this.feedbackVoice=undefined;source.disconnect();gain.disconnect();};source.start();return true;
  }
  // Finite charge clips are cancellable, never looped. A token is one native warning phase.
  syncCharges(cues: {key:string;token:string;volume:number}[] = []) {
    const active=this.needsCombatCues?cues:[];
    if(!active.length&&!this.charges.size)return;
    const desired=active.length?new Set(active.map(c=>c.token)):null;
    for(const [key,voice] of this.charges)if(!desired?.has(voice.token)){
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
  syncContinuous(cues: {key:string;volume:number;pulse?:boolean}[] = []) {
    const active=this.needsCombatCues?cues:[];
    if(!active.length&&!this.loops.size)return;
    const desired=active.length?new Map(active.map(c=>[c.key,c])):null;
    for(const[key,voice]of this.loops)if(!desired?.has(key)){
      this.loops.delete(key); const now=this.context!.currentTime;
      voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setValueAtTime(voice.gain.gain.value,now);voice.gain.gain.linearRampToValueAtTime(0,now+.035);
      try{voice.source.stop(now+.04);}catch{}
    }
    if(!desired||!this.context||!this.master)return;
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
  resetEffectsContext() {
    this.loadingController?.abort();this.loadingController=undefined;this.loading=undefined;this.loadedEffects='none';this.resumePending=undefined;
    this.stopFeedback();for(const source of this.sources)try{source.stop();}catch{}
    this.sources.clear();this.effectVoices.clear();this.loops.clear();this.charges.clear();this.buffers.clear();this.voices.clear();this.feedbackTimes.clear();
    const previous=this.context;this.context=undefined;
    try{this.compressor?.disconnect();}catch{}
    try{this.master?.disconnect();}catch{}
    this.compressor=undefined;this.master=undefined;
    try{if(previous&&previous.state!=='closed')void previous.close().catch(()=>{});}catch{/* Native may already be retired. */}
  }
  dispose() {
    if(this.disposed)return;
    this.disposed=true;this.pause();this.resetEffectsContext();
    const track=this.music;this.music=undefined;
    if(track?.destroy)track.destroy();else if(track&&typeof HTMLAudioElement==='function'&&track instanceof HTMLAudioElement){track.removeAttribute('src');track.load();}
  }
  resume() { if (this.disposed) return; this.paused=false; this.playMusic(); }
  restart() { this.pause(); this.chargeTokens.clear(); this.voices.clear();this.feedbackTimes.clear(); if (this.music) this.music.currentTime = 0; this.resume(); }
  setPreference(key:'music'|'effects',enabled:boolean) {
    if(this.disposed||!['music','effects'].includes(key))return false;
    this.preferences[key]=Boolean(enabled);
    if(this.master)this.master.gain.value=this.enabled&&this.preferences.effects ? .55 : 0;
    if(key==='music') {if(enabled)this.playMusic();else this.music?.pause();}
    if(key==='effects'&&!enabled) {
      this.stopFeedback();this.loops.clear();this.charges.clear();
      for(const source of this.sources){try{source.stop();}catch{}}
      this.sources.clear();this.effectVoices.clear();
    }
    if(key==='effects'&&enabled)void this.unlock().catch(error=>this.host.audioDiagnostic?.('enable-failed',error));
    try {saveAudioPreferences(this.host.storage??localStorage,this.preferences);}catch{ /* private storage */ }
    return true;
  }
  toggle() {
    const enabled=!this.enabled;
    this.setPreference('music',enabled);this.setPreference('effects',enabled);
    try { (this.host.storage??localStorage).setItem('danke-audio', this.enabled ? 'on' : 'off'); } catch {}
    return this.enabled;
  }
}
