import {GrandPiano,SAMPLE_ROOTS,SAMPLE_LAYERS,samplePath} from '../instruments/piano.js';
import {PianoAudio} from '../audio-service.js';
const results=[];
const assert=(condition,message)=>{if(!condition)throw Error(message);};
const rms=(buffer,start,end)=>{
  const data=buffer.getChannelData(0);let sum=0;
  for(let i=Math.floor(start*buffer.sampleRate);i<Math.floor(end*buffer.sampleRate);i++)sum+=data[i]**2;
  return Math.sqrt(sum/((end-start)*buffer.sampleRate));
};
try {
  const piano=new GrandPiano();
  async function render(pitch,velocity,release=false,force=false) {
    const context=new OfflineAudioContext(2,44100*2,44100);
    const sample=await piano.prepare(context,pitch,velocity);
    const voice=piano.start(context,context.destination,pitch,velocity,sample,()=>{});
    if(release){const suspended=context.suspend(.25);const rendered=context.startRendering();await suspended;voice.release(force);await context.resume();return rendered;}
    return context.startRendering();
  }
  const soft=await render(60,.2),hard=await render(60,1);
  assert(rms(hard,0,1)>rms(soft,0,1)*2,'Velocity should change recorded dynamics');
  results.push('PASS: soft/hard dynamics through real Web Audio rendering');
  const held=await render(48,.75),released=await render(48,.75,true);
  assert(rms(held,1,1.5)>.001&&rms(released,1,1.5)<.00001,'Damper should silence a released bass note');
  const treble=await render(96,.75,true),panic=await render(96,.75,true,true);
  assert(rms(treble,.5,1)>.00001&&rms(panic,.5,1)<.00001,'Undamped treble should ring, but panic must stop it');
  results.push('PASS: bass dampers, undamped treble and panic envelopes');
  const context=new OfflineAudioContext(2,44100,44100);
  let count=0;
  for(const root of SAMPLE_ROOTS)for(const layer of SAMPLE_LAYERS){
    const buffer=await piano.bank.load(context,samplePath(root,layer));
    assert(buffer.numberOfChannels===2&&buffer.duration>1,'Invalid stereo sample');
    assert(buffer.getChannelData(0).some(n=>Math.abs(n)>.0001),'Silent sample');count++;
  }
  assert(piano.bank.bytes<=piano.bank.budget,'Decoded cache exceeded its budget');
  results.push(`PASS: all ${count} bundled samples decode to non-silent stereo; decoded cache stays within budget`);
  // Exercise the live service graph too; silence the master for unattended tests.
  const audio=new PianoAudio();await audio.ready();audio.settings(0,true);
  await audio.on(60,.75,'test');audio.sustain('test',true);audio.off(60,'test');await audio.on(60,.8,'test');
  assert(audio.active.size===2,'Repeated sustained notes should overlap');audio.stop();
  await new Promise(resolve=>setTimeout(resolve,150));assert(audio.active.size===0,'Panic left active nodes');await audio.context.close();
  results.push('PASS: real source nodes overlap under sustain and clean up after Stop');
  document.title='PASS: Keys audio verification';
}catch(error){results.push('FAIL: '+error.message);document.title='FAIL: Keys audio verification';}
document.querySelector('#results').textContent=results.join('\n');
