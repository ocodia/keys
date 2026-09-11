export const SAMPLE_ROOTS = Array.from({length:30}, (_, i) => 21 + i * 3);
export const SAMPLE_LAYERS = Array.from({length:16}, (_, i) => i + 1);
const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export function samplePath(root, layer) {
  return `sounds/salamander/${encodeURIComponent(names[root % 12] + (Math.floor(root / 12) - 1) + 'v' + layer)}.ogg`;
}
export function pianoSample(pitch, velocity) {
  const root = Math.max(21, Math.min(108, 21 + Math.round((pitch - 21) / 3) * 3));
  const layer = Math.max(1, Math.min(16, Math.ceil(velocity * 16)));
  return {root, layer, rate:2 ** ((pitch - root) / 12), path:samplePath(root, layer)};
}

// Active sources retain their buffers when the decoded LRU cache evicts them.
export class SampleBank {
  constructor(fetcher = (...args) => globalThis.fetch(...args), budget = 192 * 1024 * 1024) {
    this.fetcher = fetcher; this.budget = budget; this.bytes = 0;
    this.buffers = new Map(); this.pending = new Map();
  }
  async load(context, path) {
    if (this.buffers.has(path)) {
      const buffer = this.buffers.get(path);
      this.buffers.delete(path); this.buffers.set(path, buffer); return buffer;
    }
    if (this.pending.has(path)) return this.pending.get(path);
    const request = (async () => {
      try {
        const response = await this.fetcher(new URL('../' + path, import.meta.url));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(path, buffer); this.bytes += buffer.length * buffer.numberOfChannels * 4;
        while (this.bytes > this.budget && this.buffers.size > 1) {
          const [key, old] = this.buffers.entries().next().value;
          this.bytes -= old.length * old.numberOfChannels * 4; this.buffers.delete(key);
        }
        return buffer;
      } catch (error) {
        throw new Error('The grand piano recording could not load. Reconnect and reload Keys, then try again.', {cause:error});
      } finally { this.pending.delete(path); }
    })();
    this.pending.set(path, request); return request;
  }
}

export class GrandPiano {
  constructor(bank = new SampleBank()) { this.bank = bank; this.id = 'grand-piano'; this.name = 'Grand piano'; }
  async prepare(context, pitch, velocity) {
    const sample = pianoSample(pitch, velocity);
    return {...sample, buffer:await this.bank.load(context, sample.path)};
  }
  start(context, output, pitch, velocity, sample, ended) {
    const t = context.currentTime, source = context.createBufferSource(), gain = context.createGain();
    source.buffer = sample.buffer; source.playbackRate.value = sample.rate;
    // Preserve recorded dynamics; interpolate amplitude within each layer.
    const level = .85 * (Math.max(.015, velocity) / (sample.layer / 16)) ** .7;
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(level, t + .002);
    source.connect(gain); gain.connect(output);
    let disposed = false, released = false;
    const dispose = () => {
      if (disposed) return; disposed = true;
      source.disconnect(); gain.disconnect(); ended();
    };
    source.onended = dispose; source.start(t);
    return {
      release(force = false) {
        if (disposed || (released && !force)) return;
        if (!force && pitch >= 89) return; // A grand's top strings have no dampers.
        released = true;
        const now = context.currentTime;
        const duration = force ? .025 : .12 + .25 * Math.max(0, (89 - pitch) / 68);
        if (gain.gain.cancelAndHoldAtTime) gain.gain.cancelAndHoldAtTime(now);
        else { gain.gain.cancelScheduledValues(now); gain.gain.setValueAtTime(level, now); }
        gain.gain.setTargetAtTime(0, now, duration / 5); source.stop(now + duration);
      },
      dispose() { try { source.stop(); } catch {} dispose(); }
    };
  }
}
