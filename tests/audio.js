import {PianoAudio} from '../audio-service.js';
import {pianoSample,SampleBank,GrandPiano} from '../instruments/piano.js';
import {createInstrument} from '../instruments/registry.js';

const tick = () => new Promise(resolve => setTimeout(resolve,0));
class Context {
  constructor() { this.state='running'; this.currentTime=0; this.destination={}; }
  createGain() { return {gain:{value:0,setTargetAtTime(){}},connect(){}}; }
  createDynamicsCompressor() { return {connect(){}}; }
}
function instrument(prepare = async()=>({})) {
  const handles=[];
  return {handles,prepare,start(context,output,pitch,velocity,sample,ended) {
    const handle={pitch,releases:[],release(force){this.releases.push(force);},dispose(){ended();}};
    handles.push(handle); return handle;
  }};
}
export function registerAudioTests(test,assert,equal) {
  test('Piano samples cover 88 keys with at most one semitone transposition and 16 velocities',()=>{
    for(let pitch=21;pitch<=108;pitch++)for(let v=1;v<=127;v++){
      const s=pianoSample(pitch,v/127);assert(Math.abs(s.root-pitch)<=1);assert(s.layer>=1&&s.layer<=16);
      assert(Math.abs(12*Math.log2(s.rate)-(pitch-s.root))<1e-10);
    }
    equal(pianoSample(60,1).layer,16);equal(pianoSample(60,1/127).layer,1);
    assert(pianoSample(63,.5).path.includes('D%23'));
    assert(createInstrument('grand-piano') instanceof GrandPiano);
    let failed=false;try{createInstrument('missing');}catch{failed=true;}assert(failed);
  });
  test('Sample loading deduplicates, evicts decoded buffers and retries failures',async()=>{
    let requests=0,fail=true;
    const bank=new SampleBank(async()=>{requests++;return {ok:!fail,status:404,arrayBuffer:async()=>new ArrayBuffer(0)};},16);
    const context={decodeAudioData:async()=>({length:4,numberOfChannels:1})};
    try{await bank.load(context,'a');}catch{}equal(bank.pending.size,0);fail=false;
    const [a,b]=await Promise.all([bank.load(context,'a'),bank.load(context,'a')]);equal(requests,2);assert(a===b);
    await bank.load(context,'b');equal(bank.bytes,16);assert(!bank.buffers.has('a'));
  });
  test('Delayed notes cancel on release/stop/retrigger; pending sustain survives until pedal up',async()=>{
    const resolvers=[],piano=instrument(()=>new Promise(resolve=>resolvers.push(resolve))),audio=new PianoAudio(Context,piano);
    const first=audio.on(60);await tick();audio.off(60,'pointer');resolvers.shift()({});await first;equal(piano.handles.length,0);
    const stopped=audio.on(60);await tick();audio.stop();resolvers.shift()({});await stopped;equal(piano.handles.length,0);
    const old=audio.on(60);await tick();const fresh=audio.on(60);await tick();resolvers.shift()({});resolvers.shift()({});await Promise.all([old,fresh]);equal(piano.handles.length,1);
    audio.sustain('midi',true);const pedalled=audio.on(64,.7,'midi');await tick();audio.off(64,'midi');resolvers.shift()({});await pedalled;
    equal(piano.handles.at(-1).releases,[]);audio.sustain('midi',false);equal(piano.handles.at(-1).releases,[false]);
  });
  test('Source-specific sustain, tail polyphony limits, mute and panic cover every active voice',async()=>{
    const piano=instrument(),audio=new PianoAudio(Context,piano);audio.maxVoices=3;
    audio.sustain('a',true);await audio.on(60,.7,'a');await audio.on(60,.7,'b');audio.off(60,'a');audio.off(60,'b');
    equal(piano.handles[0].releases,[]);equal(piano.handles[1].releases,[false]);
    for(let n=61;n<70;n++){await audio.on(n);audio.off(n,'pointer');assert(audio.active.size<=3);}
    audio.settings(100,true);assert(audio.muted);audio.stop();equal(audio.voices.size,0);equal(audio.pedals.size,0);
    for(const voice of audio.active)assert(voice.handle.releases.includes(true));
  });
  test('Failed preparation removes pending notes; stop cancels sequence warmup',async()=>{
    const bad=new PianoAudio(Context,instrument(async()=>{throw Error('load failed');}));
    let failed=false;try{await bad.on(60);}catch{failed=true;}assert(failed);equal(bad.voices.size,0);
    let resolve;const audio=new PianoAudio(Context,instrument(()=>new Promise(r=>resolve=r)));
    const sequence=audio.sequence([{notes:[60]}]);await tick();audio.stop();resolve({});await sequence;equal(audio.timers.length,0);
  });
  test('Repeated strikes overlap under sustain and all old tails damp on pedal release',async()=>{
    const piano=instrument(),audio=new PianoAudio(Context,piano);
    audio.sustain('midi',true);await audio.on(60,.7,'midi');audio.off(60,'midi');await audio.on(60,.8,'midi');
    equal(audio.active.size,2);equal(piano.handles[0].releases,[]);
    audio.sustain('midi',false);equal(piano.handles[0].releases,[false]);equal(piano.handles[1].releases,[]);
    audio.off(60,'midi');equal(piano.handles[1].releases,[false]);
  });
}
