import {createInstrument} from './instruments/registry.js';
export const midiToFrequency = midi => 440 * 2 ** ((midi-69)/12);
export class PianoAudio {
  constructor(Context = globalThis.AudioContext || globalThis.webkitAudioContext, instrument = createInstrument('grand-piano')) {
    this.Context = Context; this.instrument = instrument;
    this.voices = new Map(); this.active = new Set(); this.pedals = new Map(); this.timers = [];
    this.volume = .65; this.muted = false; this.generation = 0; this.maxVoices = 96;
  }
  async ready() {
    if (!this.Context) throw new Error('Audio is unavailable in this browser. You can still explore and practise.');
    if (!this.context) {
      this.context = new this.Context({latencyHint:'interactive'}); this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume * .8;
      const compressor = this.context.createDynamicsCompressor();
      if (compressor.threshold) {
        compressor.threshold.value = -6; compressor.knee.value = 6;
        compressor.ratio.value = 12; compressor.attack.value = .003; compressor.release.value = .18;
      }
      this.master.connect(compressor); compressor.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  settings(volume, muted) {
    this.volume = Math.max(0, Math.min(100, volume))/100; this.muted = muted;
    if(this.master) this.master.gain.setTargetAtTime(muted ? 0 : this.volume * .8, this.context.currentTime, .02);
  }
  setInstrument(id) { const instrument = createInstrument(id); this.stop(); this.instrument = instrument; }
  async prepareNote(instrument, pitch, velocity) {
    this.loading = (this.loading || 0) + 1; this.onLoadStatus?.(true);
    try { return await instrument.prepare(this.context, pitch, velocity); }
    finally { this.loading--; this.onLoadStatus?.(this.loading > 0); }
  }
  async prepare(notes, velocity = .7) {
    await this.ready();
    const instrument = this.instrument, queue = [...new Set(notes)];
    await Promise.all(Array.from({length:Math.min(4, queue.length)}, async () => {
      while(queue.length) await this.prepareNote(instrument, queue.shift(), velocity);
    }));
  }
  async on(pitch, velocity = .7, source = 'pointer') {
    if (!Number.isInteger(pitch) || pitch < 21 || pitch > 108 || !Number.isFinite(velocity)) return;
    if (velocity <= 0) { this.off(pitch, source); return; }
    velocity = Math.min(1, velocity);
    const generation = this.generation, instrument = this.instrument, key = `${source}:${pitch}`;
    const previous = this.voices.get(key);
    if (previous && !previous.pending && this.pedals.get(source)) {
      // Re-striking with the pedal down adds a new hammer attack while the
      // previous vibration continues; both tails are damped on pedal release.
      previous.held = false; this.voices.delete(key);
    } else this.off(pitch, source, true);
    const ticket = {pending:true, released:false, source, held:true};
    this.voices.set(key, ticket);
    const valid = () => generation === this.generation && this.voices.get(key) === ticket && !ticket.released;
    try {
      await this.ready(); if (!valid()) return;
      const prepared = await this.prepareNote(instrument, pitch, velocity);
      if (!valid()) return;
      while (this.active.size >= this.maxVoices) {
        const oldest = [...this.active].find(v => !v.held) || this.active.values().next().value;
        oldest.handle.dispose();
      }
      const voice = {source, held:ticket.held};
      voice.handle = instrument.start(this.context, this.master, pitch, velocity, prepared, () => {
        this.active.delete(voice); if (this.voices.get(key) === voice) this.voices.delete(key);
      });
      this.active.add(voice); this.voices.set(key, voice);
    } catch (error) {
      if (this.voices.get(key) === ticket) this.voices.delete(key);
      if (generation === this.generation && !ticket.released) throw error;
    }
  }
  release(voice, force = false) {
    if (voice.pending) { voice.released = true; return; }
    voice.handle.release(force);
  }
  off(pitch, source, force = false) {
    const key = `${source}:${pitch}`, voice = this.voices.get(key); if (!voice) return;
    voice.held = false;
    if (!force && this.pedals.get(source)) return;
    this.release(voice, force); this.voices.delete(key);
  }
  sustain(source, down) {
    this.pedals.set(source, down);
    if (!down) {
      for (const voice of this.active) if (voice.source === source && !voice.held) this.release(voice);
      for (const [key, voice] of this.voices) if (voice.source === source && !voice.held) {
        if (voice.pending) this.release(voice);
        this.voices.delete(key);
      }
    }
  }
  stop() {
    this.generation++; for (const timer of this.timers) clearTimeout(timer); this.timers = [];
    for (const voice of this.voices.values()) if (voice.pending) this.release(voice, true);
    for (const voice of this.active) this.release(voice, true);
    this.voices.clear(); this.pedals.clear(); this.onHighlight?.([]);
  }
  async sequence(steps, tempo = 90) {
    this.stop(); const generation = this.generation;
    await this.prepare(steps.flatMap(step => Array.isArray(step.notes) ? step.notes : [step.notes]), .65);
    if (generation !== this.generation) return;
    let offset = 0;
    for (const step of steps) {
      const notes = Array.isArray(step.notes) ? step.notes : [step.notes], duration = (step.beats ?? .5) * 60000 / tempo;
      const start = offset;
      this.timers.push(setTimeout(() => {
        if (generation !== this.generation) return;
        this.onHighlight?.(notes); for (const n of notes) this.on(n, .65, 'playback').catch(e => this.onError?.(e));
      }, start));
      this.timers.push(setTimeout(() => {
        if (generation !== this.generation) return;
        for (const n of notes) this.off(n, 'playback');
      }, start + duration * .88));
      offset += duration;
    }
    this.timers.push(setTimeout(() => { this.onHighlight?.([]); this.timers = []; }, offset));
  }
}
