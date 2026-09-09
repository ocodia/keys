// Pure music theory. Sounding pitches and written spellings are deliberately separate.
export const SHARPS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const FLATS = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
export const ROOTS = ['C','C#','Db','D','Eb','E','F','F#','Gb','G','Ab','A','Bb','B'];
const LETTERS = ['C','D','E','F','G','A','B'];
const NATURALS = [0,2,4,5,7,9,11];
export const mod = (n, d = 12) => ((n % d) + d) % d;
export function pitchClass(name) {
  if (Number.isInteger(name)) return mod(name);
  const match = /^([A-G])([#b]*)$/.exec(name);
  if (!match) throw new Error('Unknown note');
  return mod(NATURALS[LETTERS.indexOf(match[1])] + [...match[2]].reduce((n, c) => n + (c === '#' ? 1 : -1), 0));
}
export const noteName = (midi, accidental = 'sharps', octave = false) =>
  (accidental === 'flats' ? FLATS : SHARPS)[mod(midi)] + (octave ? Math.floor(midi / 12) - 1 : '');
export const pretty = (name) => String(name).replaceAll('#','♯').replaceAll('b','♭');
export const intervalLabel = (i, degree) => {
  if(degree===undefined)return ['R','♭2','2','♭3','3','4','♯4','5','♭6','6','♭7','7'][mod(i)];
  const alteration=i-NATURALS[mod(degree,7)];
  return degree===0&&i===0?'R':`${alteration>=0?'♯'.repeat(alteration):'♭'.repeat(-alteration)}${degree+1}`;
};
export const SCALES = Object.freeze({
  major: { label:'Major', intervals:[0,2,4,5,7,9,11] },
  minor: { label:'Natural minor', intervals:[0,2,3,5,7,8,10] },
  harmonic: { label:'Harmonic minor', intervals:[0,2,3,5,7,8,11] },
  melodic: { label:'Melodic minor', intervals:[0,2,3,5,7,9,11] },
  majorPent: { label:'Major pentatonic', intervals:[0,2,4,7,9], degrees:[0,1,2,4,5] },
  minorPent: { label:'Minor pentatonic', intervals:[0,3,5,7,10], degrees:[0,2,3,4,6] },
  blues: { label:'Blues', intervals:[0,3,5,6,7,10], degrees:[0,2,3,3,4,6] },
  chromatic: { label:'Chromatic', intervals:[0,1,2,3,4,5,6,7,8,9,10,11] },
  dorian: { label:'Dorian', intervals:[0,2,3,5,7,9,10] },
  phrygian: { label:'Phrygian', intervals:[0,1,3,5,7,8,10] },
  lydian: { label:'Lydian', intervals:[0,2,4,6,7,9,11] },
  mixolydian: { label:'Mixolydian', intervals:[0,2,4,5,7,9,10] },
  locrian: { label:'Locrian', intervals:[0,1,3,5,6,8,10] },
});
export const CHORDS = Object.freeze({
  major:{ label:'Major', suffix:'', intervals:[0,4,7], degrees:[0,2,4] },
  minor:{ label:'Minor', suffix:'m', intervals:[0,3,7], degrees:[0,2,4] },
  dim:{ label:'Diminished', suffix:'dim', intervals:[0,3,6], degrees:[0,2,4] },
  aug:{ label:'Augmented', suffix:'aug', intervals:[0,4,8], degrees:[0,2,4] },
  sus2:{ label:'Suspended 2nd', suffix:'sus2', intervals:[0,2,7], degrees:[0,1,4] },
  sus4:{ label:'Suspended 4th', suffix:'sus4', intervals:[0,5,7], degrees:[0,3,4] },
  seventh:{ label:'Dominant 7th', suffix:'7', intervals:[0,4,7,10], degrees:[0,2,4,6] },
  maj7:{ label:'Major 7th', suffix:'maj7', intervals:[0,4,7,11], degrees:[0,2,4,6] },
  min7:{ label:'Minor 7th', suffix:'m7', intervals:[0,3,7,10], degrees:[0,2,4,6] },
  halfDim:{ label:'Half-diminished 7th', suffix:'m7♭5', intervals:[0,3,6,10], degrees:[0,2,4,6] },
  dim7:{ label:'Diminished 7th', suffix:'dim7', intervals:[0,3,6,9], degrees:[0,2,4,6] },
  minMaj7:{ label:'Minor major 7th', suffix:'m(maj7)', intervals:[0,3,7,11], degrees:[0,2,4,6] },
});
export function spell(root, interval, degree) {
  const letter = mod(LETTERS.indexOf(root[0]) + degree, 7);
  let alteration = mod(pitchClass(root) + interval - NATURALS[letter]);
  if (alteration > 6) alteration -= 12;
  return LETTERS[letter] + (alteration >= 0 ? '#'.repeat(alteration) : 'b'.repeat(-alteration));
}
export function patternNames(root, pattern) {
  return pattern.intervals.map((i, index) => pattern.intervals.length === 12
    ? noteName(pitchClass(root) + i, root.includes('b') ? 'flats' : 'sharps')
    : spell(root, i, pattern.degrees?.[index] ?? index));
}
export function rootAt(root, anchor = 60) { return anchor + mod(pitchClass(root) - anchor); }
export function voicing(root, quality = 'major', inversion = 0, anchor = 60, split = false) {
  const pattern = CHORDS[quality].intervals;
  const base = rootAt(root, anchor);
  const notes = pattern.map(i => base + i);
  for (let i = 0; i < mod(inversion, notes.length); i++) notes.push(notes.shift() + 12);
  return (split ? [base - 12, ...notes] : notes).filter(n => n >= 21 && n <= 108);
}
export const inversionName = (i) => ['Root position','1st inversion','2nd inversion','3rd inversion'][i];
export function scaleNotes(root, scale, anchor = 60, octaves = 1, descending = false) {
  const base = rootAt(root, anchor);
  const intervals = scale === 'melodic' && descending ? SCALES.minor.intervals : SCALES[scale].intervals;
  const notes = Array.from({length:octaves}, (_, o) => intervals.map(i => base + o * 12 + i)).flat();
  notes.push(base + octaves * 12);
  return (descending ? notes.reverse() : notes).filter(n => n >= 21 && n <= 108);
}
export function arpeggio(root, quality, inversion, anchor, octaves, descending) {
  const one = voicing(root, quality, inversion, anchor);
  const notes = Array.from({length:octaves}, (_, i) => one.map(n => n + i * 12)).flat();
  notes.push(one[0] + octaves * 12);
  return (descending ? notes.reverse() : notes).filter(n => n >= 21 && n <= 108);
}
export function identify(notes, accidental = 'sharps') {
  const sorted = [...new Set(notes)].sort((a,b) => a-b);
  if (!sorted.length) return [];
  const pcs = [...new Set(sorted.map(n => mod(n)))];
  const results = [];
  for (const root of pcs) for (const [quality, chord] of Object.entries(CHORDS)) {
    if (chord.intervals.length !== pcs.length || !chord.intervals.every(i => pcs.includes(mod(root+i)))) continue;
    const name = noteName(root, accidental);
    const inversion = chord.intervals.indexOf(mod(sorted[0]-root));
    const written = patternNames(name, chord);
    results.push({ root:name, quality, inversion, bass:written[inversion], label:pretty(name)+chord.suffix+(inversion ? '/'+pretty(written[inversion]) : '') });
  }
  return results.sort((a,b) => a.inversion-b.inversion || a.label.localeCompare(b.label));
}
export const MODES = ['major','dorian','phrygian','lydian','mixolydian','minor','locrian'];
export function palette(root, mode = 'major', family = 'triad') {
  const scale = SCALES[mode].intervals;
  const names = patternNames(root,SCALES[mode]);
  return scale.map((degree, index) => {
    const steps = family === 'seventh' ? [0,2,4,6] : family === 'sus2' ? [0,1,4] : family === 'sus4' ? [0,3,4] : [0,2,4];
    const intervals = steps.map(s => mod(scale[(index+s)%7]-degree));
    const quality = Object.keys(CHORDS).find(k => CHORDS[k].intervals.join() === intervals.join());
    return {root:names[index], quality:quality || null, degree:index+1, intervals,
      label:pretty(names[index])+(quality ? CHORDS[quality].suffix : ' (altered)')};
  });
}
export const CIRCLE = [
  ['C','Am','No sharps or flats'],['G','Em','1 sharp'],['D','Bm','2 sharps'],['A','F#m','3 sharps'],
  ['E','C#m','4 sharps'],['B','G#m','5 sharps'],['F#','D#m','6 sharps'],['Db','Bbm','5 flats'],
  ['Ab','Fm','4 flats'],['Eb','Cm','3 flats'],['Bb','Gm','2 flats'],['F','Dm','1 flat'],
];
export const PROGRESSIONS = [
  {id:'pop',name:'The familiar four',mood:'Uplifting',degrees:[0,4,5,3],roman:['I','V','vi','IV'],description:'Home → tension → a minor turn → a warm return.'},
  {id:'jazz',name:'A little jazz',mood:'Smooth',degrees:[1,4,0],roman:['ii⁷','V⁷','Imaj⁷'],sevenths:true,description:'Preparation → tension → resolution. A foundation of jazz harmony.'},
  {id:'classic',name:'Back to home',mood:'Simple',degrees:[0,3,4,0],roman:['I','IV','V','I'],description:'Tonic → subdominant → dominant → tonic.'},
  {id:'gentle',name:'The gentle way',mood:'Reflective',degrees:[0,5,3,4],roman:['I','vi','IV','V'],description:'A softer departure from home, followed by a clear resolution on repeat.'},
];
export function progressionChords(root, id) {
  const p = PROGRESSIONS.find(p => p.id === id) || PROGRESSIONS[0];
  const chords = palette(root,'major',p.sevenths ? 'seventh':'triad');
  return p.degrees.map((d,i) => ({...chords[d],roman:p.roman[i],function:['Tonic','Subdominant','Tonic','Subdominant','Dominant','Tonic','Dominant'][d]}));
}
export function voiceLead(chords, low = 48, high = 84) {
  let previous = null;
  return chords.map(({root, quality}) => {
    const candidates = [];
    for (let anchor = low; anchor <= high; anchor += 12) for (let inv = 0; inv < CHORDS[quality].intervals.length; inv++) {
      const v = voicing(root,quality,inv,anchor);
      if (v.length === CHORDS[quality].intervals.length && v.every(n => n >= low && n <= high)) candidates.push(v);
    }
    if (!candidates.length) throw new Error('Register is too small for this chord');
    const cost = v => previous ? v.reduce((sum,n,i) => sum+Math.abs(n-previous[Math.min(i,previous.length-1)]),0) : Math.abs(v[0]-60);
    candidates.sort((a,b) => cost(a)-cost(b) || a.reduce((d,n,i) => d || n-b[i],0));
    previous = candidates[0]; return previous;
  });
}
export function keyboardGeometry(start = 48, end = 72) {
  let whites = 0;
  const keys = [];
  for (let midi = start; midi <= end; midi++) {
    const black = [1,3,6,8,10].includes(mod(midi));
    keys.push({midi,black,left:black ? whites-0.32 : whites,width:black ? 0.64 : 1});
    if (!black) whites++;
  }
  return { keys, whites };
}
