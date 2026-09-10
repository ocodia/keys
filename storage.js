import { FEATURES } from './feature-registry.js';
import { ROOTS, SCALES, CHORDS, MODES, PROGRESSIONS } from './theory.js';
export const STORAGE_KEY = 'keys:v1';
export const DEFAULTS = Object.freeze({navCollapsed:true,mode:'notes',root:'C',scale:'major',quality:'major',inversion:0,anchor:60,
  viewStart:48,keyCount:25,theme:'dark',accidental:'sharps',labels:'notes',volume:65,muted:false,monitor:true,lastMidiInput:null,
  tempo:90,octaves:1,direction:'up',split:false,chordView:'voicing',hand:'right',positionQuality:'major',
  paletteMode:'major',family:'triad',progression:'pop',quizType:'find',filter:[],saved:[],stats:{sessions:0,correct:0,total:0}});
const choice = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;
const number = (v, min, max, fallback) => Number.isFinite(v) ? Math.max(min,Math.min(max,Math.round(v))) : fallback;
export function sanitize(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const s = {...DEFAULTS};
  const choices = {mode:FEATURES.map(f=>f.id),root:ROOTS,scale:Object.keys(SCALES),quality:Object.keys(CHORDS),
    theme:['dark','light'],accidental:['sharps','flats'],labels:['notes','intervals','none'],direction:['up','down'],
    hand:['left','right'],positionQuality:['major','minor'],paletteMode:MODES,family:['triad','sus2','sus4','seventh'],
    progression:PROGRESSIONS.map(p=>p.id),quizType:['find','name','chord','inversion'],chordView:['voicing','tones']};
  for (const [key, allowed] of Object.entries(choices)) s[key] = choice(r[key],allowed,s[key]);
  for (const key of ['muted','monitor','split','navCollapsed']) s[key] = typeof r[key] === 'boolean' ? r[key] : s[key];
  for (const [key,min,max] of [['volume',0,100],['tempo',40,180],['octaves',1,2],['inversion',0,CHORDS[s.quality].intervals.length-1]]) s[key] = number(r[key],min,max,s[key]);
  s.anchor = choice(r.anchor,[36,48,60,72],60);
  s.keyCount = choice(r.keyCount,[25,49,61,88],r.overview===true?88:25);
  s.viewStart = Math.min(choice(r.viewStart,[24,36,48,60,72,84],48),s.keyCount===88?84:109-s.keyCount);
  s.filter = Array.isArray(r.filter) ? [...new Set(r.filter.filter(n=>Number.isInteger(n)&&n>=0&&n<12))] : [];
  s.saved = Array.isArray(r.saved) ? r.saved.filter(p=>p && ROOTS.includes(p.root) && PROGRESSIONS.some(d=>d.id===p.id)).slice(0,30).map(p=>({root:p.root,id:p.id})) : [];
  s.stats = Object.fromEntries(['sessions','correct','total'].map(k=>[k,number(r.stats?.[k],0,10000000,0)]));
  if(r.lastMidiInput && typeof r.lastMidiInput.id==='string' && typeof r.lastMidiInput.name==='string') {
    s.lastMidiInput={id:r.lastMidiInput.id.slice(0,512),name:r.lastMidiInput.name.slice(0,256),manufacturer:typeof r.lastMidiInput.manufacturer==='string'?r.lastMidiInput.manufacturer.slice(0,256):''};
  }
  return s;
}
export class Store extends EventTarget {
  constructor(storage) {
    super(); this.storage = storage; this.available = true;
    try { this.storage ??= globalThis.localStorage; this.state = sanitize(JSON.parse(this.storage?.getItem(STORAGE_KEY) || '{}')); }
    catch { this.state = sanitize(); this.available = false; }
  }
  update(patch) {
    this.state = sanitize({...this.state,...patch});
    try { this.storage?.setItem(STORAGE_KEY,JSON.stringify(this.state)); }
    catch { this.available = false; }
    this.dispatchEvent(new Event('change'));
    return this.state;
  }
}
