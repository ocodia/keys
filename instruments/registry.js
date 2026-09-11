import {GrandPiano} from './piano.js';

// Instruments own timbre, loading and release; the service owns input/transport.
export const INSTRUMENTS = Object.freeze({
  'grand-piano': {name:'Grand piano', create:() => new GrandPiano()}
});
export function createInstrument(id) {
  const entry = INSTRUMENTS[id];
  if (!entry) throw new Error(`Unknown instrument: ${id}`);
  return entry.create();
}
