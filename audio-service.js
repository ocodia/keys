export const midiToFrequency = midi => 440 * 2 ** ((midi-69)/12);
export class PianoAudio {
  constructor(Context = globalThis.AudioContext || globalThis.webkitAudioContext) {
    this.Context = Context; this.voices = new Map(); this.pedals = new Map(); this.timers = [];
    this.volume = .65; this.muted = false; this.generation = 0;
  }
  async ready() {
    if (!this.Context) throw new Error('Audio is unavailable in this browser. You can still explore and practise.');
    if (!this.context) {
      this.context = new this.Context(); this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume * .35;
      const compressor = this.context.createDynamicsCompressor();
      this.master.connect(compressor); compressor.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  settings(volume, muted) { this.volume = volume/100; this.muted = muted; if(this.master) this.master.gain.setTargetAtTime(muted?0:this.volume*.35,this.context.currentTime,.02); }
  async on(pitch, velocity = .7, source = 'pointer') {
    const generation = this.generation;
    const key = `${source}:${pitch}`;
    this.off(pitch,source,true);
    const ticket = {pending:true,released:false}; this.voices.set(key,ticket);
    await this.ready();
    if (generation !== this.generation || this.voices.get(key) !== ticket || ticket.released) return;
    if (this.voices.size>64) { const [oldKey,voice] = this.voices.entries().next().value; this.release(voice); this.voices.delete(oldKey); }
    const t = this.context.currentTime, frequency = midiToFrequency(pitch);
    const gain = this.context.createGain(); gain.connect(this.master);
    const peak = Math.max(.02,Math.min(1,velocity))*.45;
    gain.gain.setValueAtTime(0,t); gain.gain.linearRampToValueAtTime(peak,t+.006);
    gain.gain.exponentialRampToValueAtTime(peak*.23,t+.7); gain.gain.exponentialRampToValueAtTime(.0001,t+12);
    const oscillators = [1,2,3,4].map((harmonic,i) => {
      const osc = this.context.createOscillator(), partial = this.context.createGain();
      osc.frequency.value = frequency*harmonic; osc.type = 'sine';
      partial.gain.setValueAtTime([1,.35,.14,.055][i],t);
      partial.gain.exponentialRampToValueAtTime(.0001,t+[12,2.5,1.2,.5][i]);
      osc.connect(partial); partial.connect(gain); osc.start(t); osc.stop(t+12.1);
      return osc;
    });
    const voice = {gain,oscillators,source,held:true};
    oscillators[0].onended = () => { gain.disconnect(); if(this.voices.get(key)===voice) this.voices.delete(key); };
    this.voices.set(key,voice);
  }
  release(voice) {
    if(voice.pending){voice.released=true;return;}
    const t=this.context.currentTime;
    voice.gain.gain.cancelAndHoldAtTime(t); voice.gain.gain.setTargetAtTime(0,t,.08);
    for(const osc of voice.oscillators) { try {osc.stop(t+.45);}catch{} }
  }
  off(pitch,source,force=false) {
    const key=`${source}:${pitch}`, voice=this.voices.get(key); if(!voice)return;
    voice.held=false;
    if(!force && this.pedals.get(source) && !voice.pending)return;
    this.release(voice);this.voices.delete(key);
  }
  sustain(source,down) {
    this.pedals.set(source,down);
    if(!down) for(const [key,voice] of this.voices) if(voice.source===source&&!voice.held){this.release(voice);this.voices.delete(key);}
  }
  stop() {
    this.generation++;for(const timer of this.timers)clearTimeout(timer);this.timers=[];
    for(const voice of this.voices.values())this.release(voice);
    this.voices.clear();this.pedals.clear(); this.onHighlight?.([]);
  }
  async sequence(steps, tempo=90) {
    this.stop(); const generation=this.generation;await this.ready();if(generation!==this.generation)return;
    let offset=0;
    for(const step of steps){
      const notes=Array.isArray(step.notes)?step.notes:[step.notes],duration=(step.beats??.5)*60000/tempo;
      const start=offset;
      this.timers.push(setTimeout(()=>{ if(generation!==this.generation)return; this.onHighlight?.(notes);for(const n of notes)this.on(n,.65,'playback').catch(e=>this.onError?.(e));},start));
      this.timers.push(setTimeout(()=>{for(const n of notes)this.off(n,'playback',true);},start+duration*.88));
      offset+=duration;
    }
    this.timers.push(setTimeout(()=>this.onHighlight?.([]),offset));
  }
}
