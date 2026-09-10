import {ROOTS,SCALES,CHORDS,MODES,PROGRESSIONS,mod,pitchClass,noteName,patternNames,voicing,identify,scaleNotes,arpeggio,palette,progressionChords,voiceLead,keyboardGeometry,intervalLabel} from '../theory.js';
import {Store,sanitize} from '../storage.js';
import {InputRouter,decodeMidi,MidiInput,preferredMidiPort} from '../input-service.js';
import {QuizSession,makeQuestions,evaluate} from '../quiz.js';
import {PianoAudio,midiToFrequency} from '../audio-service.js';
export const assert=(condition,message='Assertion failed')=>{if(!condition)throw new Error(message);};
export const equal=(actual,expected)=>assert(JSON.stringify(actual)===JSON.stringify(expected),`${JSON.stringify(actual)} ≠ ${JSON.stringify(expected)}`);
export async function runCore(report=()=>{}){
  const tests=[];const test=(name,run)=>tests.push({name,run});
  test('Keyboard geometry: 88 keys, 52 whites, 36 blacks, middle C and boundaries',()=>{
    const g=keyboardGeometry(21,108);equal(g.keys.length,88);equal(g.whites,52);equal(g.keys.filter(k=>k.black).length,36);
    equal(g.keys[0].midi,21);equal(g.keys.at(-1).midi,108);equal(noteName(60,'sharps',true),'C4');
    for(const k of g.keys)assert(k.left>=0&&k.left+k.width<=52);
    const c=keyboardGeometry(60,72);assert(Math.abs(c.keys[1].left-.68)<1e-10);equal(c.keys[5].left,3);
  });
  test('All scale spellings sound at the correct pitch in every root',()=>{
    for(const root of ROOTS)for(const scale of Object.values(SCALES)){
      const names=patternNames(root,scale);equal(names.map(pitchClass),scale.intervals.map(i=>mod(pitchClass(root)+i)));
    }
    equal(patternNames('F#',SCALES.major),['F#','G#','A#','B','C#','D#','E#']);
    equal(patternNames('Db',SCALES.major),['Db','Eb','F','Gb','Ab','Bb','C']);
    equal(patternNames('C#',CHORDS.maj7),['C#','E#','G#','B#']);
    equal(patternNames('C',CHORDS.dim7),['C','Eb','Gb','Bbb']);
    equal(intervalLabel(6,4),'♭5');equal(intervalLabel(9,6),'♭♭7');equal(intervalLabel(6,3),'♯4');
  });
  test('Every chord and inversion retains its pitch classes in ascending order',()=>{
    for(const root of ROOTS)for(const [quality,chord] of Object.entries(CHORDS))for(let inv=0;inv<chord.intervals.length;inv++){
      const notes=voicing(root,quality,inv,48);
      equal(notes.length,chord.intervals.length);assert(notes.every((n,i)=>!i||n>notes[i-1]));
      equal(mod(notes[0]-pitchClass(root)),chord.intervals[inv]);
      equal([...notes.map(n=>mod(n))].sort(),chord.intervals.map(i=>mod(pitchClass(root)+i)).sort());
      assert(identify(notes).some(c=>pitchClass(c.root)===pitchClass(root)&&c.quality===quality));
    }
    equal(voicing('C','major',1,60),[64,67,72]);equal(voicing('C','major',1,60,true),[48,64,67,72]);
  });
  test('Chord identifier handles duplicate octaves, inversions and ambiguity',()=>{
    equal(identify([64,67,72,84])[0].label,'C/E');equal(identify([60,61]),[]);
    assert(identify([60,64,68]).length===3);assert(identify([60,63,66,69]).length===4);equal(identify([]),[]);
  });
  test('Melodic minor direction, scale octaves and arpeggio endpoints',()=>{
    equal(scaleNotes('A','melodic',60,1,false),[69,71,72,74,76,78,80,81]);
    equal(scaleNotes('A','melodic',60,1,true),[81,79,77,76,74,72,71,69]);
    equal(arpeggio('C','major',0,60,2,false),[60,64,67,72,76,79,84]);
    equal(scaleNotes('C','major',60,2).length,15);
  });
  test('All mode palettes keep suspended, triad and seventh tones inside the scale',()=>{
    for(const root of ROOTS)for(const mode of MODES)for(const family of ['triad','sus2','sus4','seventh']){
      const pcs=SCALES[mode].intervals.map(i=>mod(pitchClass(root)+i));
      for(const chord of palette(root,mode,family))assert(chord.intervals.every(i=>pcs.includes(mod(pitchClass(chord.root)+i))));
    }
    equal(palette('C').map(c=>c.label),['C','Dm','Em','F','G','Am','Bdim']);
  });
  test('Progression transposition and deterministic minimum-movement inversions',()=>{
    for(const root of ROOTS)for(const p of PROGRESSIONS){const chords=progressionChords(root,p.id),voices=voiceLead(chords,48,84);equal(voices,voiceLead(chords,48,84));assert(voices.flat().every(n=>n>=48&&n<=84));
      for(let i=1;i<voices.length;i++){const prev=voices[i-1],score=v=>v.reduce((sum,n,k)=>sum+Math.abs(n-prev[Math.min(k,prev.length-1)]),0);for(let a=48;a<=84;a+=12)for(let inv=0;inv<CHORDS[chords[i].quality].intervals.length;inv++){const v=voicing(chords[i].root,chords[i].quality,inv,a);if(v.every(n=>n<=84))assert(score(voices[i])<=score(v));}}
    }
    equal(progressionChords('D','pop').map(c=>c.label),['D','A','Bm','G']);
  });
  test('Storage repairs malformed state and survives unavailable persistence',()=>{
    equal(sanitize().monitor,true);equal(sanitize({monitor:false}).monitor,false);equal(sanitize().navCollapsed,true);equal(sanitize({navCollapsed:false}).navCollapsed,false);
    equal(sanitize({overview:true}).keyCount,88);equal(sanitize({keyCount:49,viewStart:84}).viewStart,60);equal(sanitize({keyCount:61,viewStart:84}).viewStart,48);equal(sanitize({keyCount:99}).keyCount,25);
    const s=sanitize({root:'<script>',volume:999,tempo:-4,mode:'tuner',inversion:8,quality:'major',filter:[0,0,99,'C'],saved:[{root:'C',id:'pop'},{root:'bad',id:'pop'}]});
    equal(s.root,'C');equal(s.volume,100);equal(s.tempo,40);equal(s.inversion,2);equal(s.mode,'notes');equal(s.filter,[0]);equal(s.saved.length,1);
    const bad=new Store({getItem:()=>'{oops',setItem:()=>{throw Error();}});equal(bad.state.root,'C');bad.update({root:'D'});equal(bad.state.root,'D');equal(bad.available,false);
    let saved='';const memory={getItem:()=>saved,setItem:(k,v)=>{saved=v;}};const first=new Store(memory);first.update({root:'F',lastMidiInput:{id:'piano',name:'Keys MIDI',manufacturer:'Test'},stats:{correct:4,total:10,sessions:1}});equal(new Store(memory).state.root,'F');equal(new Store(memory).state.stats.correct,4);equal(new Store(memory).state.lastMidiInput.id,'piano');equal(sanitize({lastMidiInput:{id:5}}).lastMidiInput,null);
  });
  test('MIDI normalisation: note-off, velocity zero, sustain and panic',()=>{
    equal(decodeMidi([0x91,60,0]).type,'note-off');equal(decodeMidi([0x80,60,99]).type,'note-off');equal(decodeMidi([0xb0,64,127]).down,true);
    equal(decodeMidi([0xb0,123,0]).type,'all-notes-off');equal(decodeMidi([0xe0,0,0]),null);
  });
  test('Held notes stay independent of sustain, repeated notes and input sources',()=>{
    const r=new InputRouter(),send=(type,pitch,extra={})=>r.accept({type,pitch,source:'midi:0',...extra});
    send('note-on',60);send('note-on',60);send('note-on',64);equal(r.held,[60,64]);
    send('sustain',undefined,{down:true});send('note-off',60);equal(r.held,[64]);assert(r.sounding.includes(60));
    send('sustain',undefined,{down:false});equal(r.sounding,[64]);send('note-on',64,{source:'pointer:1'});send('note-off',64);equal(r.held,[64]);
    send('note-on',3);equal(r.held,[64]);r.stop();equal(r.held,[]);equal(r.sounding,[]);
  });
  test('MIDI permission failure, unsupported API, connection and hot unplug',async()=>{
    const ports=[{id:'control',name:'KL Essential 49 mk3 MCU/HUI'},{id:'alv',name:'KL Essential 49 mk3 ALV'},{id:'notes',name:'KL Essential 49 mk3 MIDI'}];
    equal(preferredMidiPort(ports).id,'notes');equal(preferredMidiPort([ports[0]]).id,'control');
    const r=new InputRouter();const unavailable=new MidiInput(r,{});await unavailable.connect();assert(unavailable.status.includes('unavailable'));
    const denied=new MidiInput(r,{requestMIDIAccess:async()=>{throw Error();}});await denied.connect();assert(denied.status.includes('not granted'));
    const port={id:'test',name:'Test piano',state:'connected'},access={inputs:new Map([['test',port]])};
    const midi=new MidiInput(r,{requestMIDIAccess:async()=>access});await midi.connect();port.onmidimessage({data:[0x90,60,100],timeStamp:1});equal(r.held,[60]);
    port.state='disconnected';access.onstatechange();equal(r.held,[]);assert(midi.status.includes('disconnected'));
  });
  test('Quizzes enforce pitch-class vs exact-register rules and single scoring',()=>{
    const find=makeQuestions('find',()=>0)[0];assert(evaluate(find,[48]));assert(!evaluate(find,[49]));
    const chord=makeQuestions('chord',()=>0)[0];assert(evaluate(chord,[60,64,67,72]));assert(!evaluate(chord,[60,64,67,71]));
    const inversion=makeQuestions('inversion',()=>0)[0];assert(evaluate(inversion,inversion.expected));assert(!evaluate(inversion,inversion.expected.map(n=>n+12)));
    const quiz=new QuizSession('find',[find,find]);quiz.submit([60]);quiz.submit([60]);equal(quiz.results.length,1);quiz.next();quiz.submit([],true);equal(quiz.score,1);quiz.next();assert(quiz.complete);equal(quiz.results[1].revealed,true);
  });
  test('MIDI auto-connect is silent, restores the saved input and handles hot replug',async()=>{
    const remembered={id:'notes',name:'My piano MIDI',manufacturer:'Test'},router=new InputRouter();
    let requests=0;const port={...remembered,state:'connected'},other={id:'other',name:'Other MIDI',state:'connected'};
    const access={inputs:new Map([['other',other],['notes',port]])};
    const nav={permissions:{query:async()=>({state:'granted'})},requestMIDIAccess:async()=>{requests++;return access;}};
    const midi=new MidiInput(router,nav,remembered);assert(await midi.autoConnect());equal(midi.port.id,'notes');equal(requests,1);
    port.onmidimessage({data:[0x90,60,90],timeStamp:1});port.state='disconnected';access.onstatechange();equal(router.held,[]);equal(midi.lastInput,remembered);assert(!midi.port);
    port.state='connected';access.onstatechange();equal(midi.port.id,'notes');
    midi.select('');access.onstatechange();assert(!midi.port);equal(midi.lastInput,null);
    for(const state of ['prompt','denied']){requests=0;const blocked=new MidiInput(router,{...nav,permissions:{query:async()=>({state})}},remembered);assert(!await blocked.autoConnect());equal(requests,0);}
    requests=0;assert(!await new MidiInput(router,nav).autoConnect());equal(requests,0);
  });
  test('MIDI auto-connect waits for the remembered device instead of switching keyboards',async()=>{
    const remembered={id:'old-id',name:'Saved piano',manufacturer:'Test'},r=new InputRouter();
    const access={inputs:new Map([['other',{id:'other',name:'Other MIDI',state:'connected'}]])};
    const nav={permissions:{query:async()=>({state:'granted'})},requestMIDIAccess:async()=>access};
    const midi=new MidiInput(r,nav,remembered);assert(!await midi.autoConnect());assert(!midi.port);
    const returned={...remembered,id:'new-id',state:'connected'};access.inputs.set(returned.id,returned);access.onstatechange();equal(midi.port.id,'new-id');equal(midi.lastInput.id,'new-id');
    const unsupported=new MidiInput(r,{...nav,permissions:{query:async()=>{throw Error('Unsupported permission descriptor');}}},remembered);assert(!await unsupported.autoConnect());
  });
  test('Audio pitch and cancellation before an AudioContext resumes',async()=>{
    equal(midiToFrequency(69),440);let resume;
    class Context{constructor(){this.state='suspended';this.destination={};}createGain(){return {gain:{value:0},connect(){}};}createDynamicsCompressor(){return {connect(){}};}resume(){return new Promise(resolve=>{resume=resolve;});}}
    const audio=new PianoAudio(Context),pending=audio.on(60);audio.stop();resume();await pending;equal(audio.voices.size,0);
    const released=new PianoAudio(Context),note=released.on(60,.7,'test');released.off(60,'test');resume();await note;equal(released.voices.size,0);
  });
  let failed=0;
  for(const t of tests){try{await t.run();report({name:t.name,passed:true});}catch(error){failed++;report({name:t.name,passed:false,error:error.message});}}
  return {total:tests.length,failed};
}
