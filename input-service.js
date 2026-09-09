// One boundary for real-time input; held keys remain independent of the sustain pedal.
export class InputRouter extends EventTarget {
  constructor(){super();this.sources=new Map();this.sustained=new Map();this.pedals=new Map();}
  get held(){return [...new Set([...this.sources.values()].flatMap(set=>[...set]))].sort((a,b)=>a-b);}
  get sounding(){return [...new Set([...this.held,...[...this.sustained.values()].flatMap(set=>[...set])])];}
  accept(event){
    const e={velocity:.7,timestamp:performance.now(),...event};
    if(e.type==='all-notes-off'){
      this.sources.clear();this.sustained.clear();this.pedals.clear();
    } else {
      const held=this.sources.get(e.source)||new Set(),tail=this.sustained.get(e.source)||new Set();
      if(e.type==='note-on'||e.type==='note-off'){
        if(!Number.isInteger(e.pitch)||e.pitch<21||e.pitch>108)return;
        if(e.type==='note-on' && e.velocity===0)e.type='note-off';
        if(e.type==='note-on'){held.add(e.pitch);tail.delete(e.pitch);}
        else {held.delete(e.pitch);if(this.pedals.get(e.source))tail.add(e.pitch);else tail.delete(e.pitch);}
      } else if(e.type==='sustain'){this.pedals.set(e.source,Boolean(e.down));if(!e.down)tail.clear();}
      else return;
      this.sources.set(e.source,held);this.sustained.set(e.source,tail);
    }
    this.dispatchEvent(new CustomEvent('input',{detail:e}));
  }
  stop(){this.accept({type:'all-notes-off',source:'system'});}
}
export function decodeMidi(data,source='midi',timestamp=performance.now()){
  if(!data||data.length<3||!Number.isInteger(data[0])||data[0]<128||![data[1],data[2]].every(n=>Number.isInteger(n)&&n>=0&&n<128))return null;
  const [status,n,value]=data,command=status&0xf0,channel=status&0x0f;
  if(command===0x90||command===0x80)return {type:command===0x80||value===0?'note-off':'note-on',pitch:n,velocity:value/127,source:`${source}:${channel}`,timestamp};
  if(command===0xb0&&n===64)return {type:'sustain',down:value>=64,source:`${source}:${channel}`,timestamp};
  if(command===0xb0&&(n===120||n===123))return {type:'all-notes-off',source:`${source}:${channel}`,timestamp};
  return null;
}
export const isControlPort = name => /MCU|HUI|DAW|ALV|DIN[\s_-]*THRU/i.test(name||'');
export function preferredMidiPort(ports){
  return ports.find(port=>!isControlPort(port.name)&&/MIDI/i.test(port.name||'')) || ports.find(port=>!isControlPort(port.name)) || ports[0];
}
export class MidiInput extends EventTarget {
  constructor(router,navigatorObject=globalThis.navigator){super();this.router=router;this.navigator=navigatorObject;this.status='disconnected';}
  notify(){this.dispatchEvent(new Event('change'));}
  get devices(){return this.access?[...this.access.inputs.values()].filter(p=>p.state==='connected'):[];}
  async connect(){
    if(!this.navigator?.requestMIDIAccess){this.status='Web MIDI is unavailable here. Use Chrome or Edge on Windows, or play onscreen.';this.notify();return;}
    try {
      this.access=await this.navigator.requestMIDIAccess({sysex:false});
      this.access.onstatechange=()=>{if(this.port?.state==='disconnected'){this.select('');this.status='Keyboard disconnected. Reconnect, then choose an input.';}this.notify();};
      if(this.devices.length)this.select(preferredMidiPort(this.devices).id);else this.status='No MIDI keyboard found. Connect a USB keyboard, then choose an input.';
    }catch {this.status='MIDI access was not granted. Check browser permissions and try Connect MIDI again.';}
    this.notify();
  }
  select(id){
    this.router.stop();if(this.port)this.port.onmidimessage=null;
    this.port=this.access?.inputs.get(id);
    if(this.port){this.port.onmidimessage=e=>{const message=decodeMidi(e.data,`midi:${id}`,e.timeStamp);if(message)this.router.accept(message);};this.status=`Connected to ${this.port.name||'MIDI keyboard'}`;}
    else this.status='disconnected';
    this.notify();
  }
}
