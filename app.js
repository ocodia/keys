import {Store} from './storage.js';
import {FEATURES} from './feature-registry.js';
import {SCALES,CHORDS,ROOTS,mod,pitchClass,noteName,pretty,rootAt,patternNames,intervalLabel,voicing,scaleNotes,arpeggio,palette,progressionChords,voiceLead} from './theory.js';
import {PianoAudio} from './audio-service.js';
import {InputRouter,MidiInput,isControlPort} from './input-service.js';
import {QuizSession} from './quiz.js';
import {details,escape} from './panels.js';
import './keyboard.js';
export class KeysApp extends HTMLElement {
  connectedCallback(){
    this.store=new Store();this.audio=new PianoAudio();this.input=new InputRouter();this.midi=new MidiInput(this.input,navigator,this.store.state.lastMidiInput);
    this.selection=new Set();this.playing=[];this.quiz=null;this.focusChord=null;this.answerSource='onscreen';
    this.innerHTML=`<aside class="sidebar"><a class="brand" href="./" aria-label="Keys home"><span class="brand-icon" aria-hidden="true">▥</span>keys<span class="brand-dot">.</span></a><span class="brand-caption">YOUR PIANO COMPANION</span><nav aria-label="Learning tools">${['Explore','Harmony','Practise'].map(g=>`<p class="nav-group">${g}</p>${FEATURES.filter(f=>f.group===g).map(f=>`<button class="nav-item" data-action="mode" data-value="${f.id}"><span aria-hidden="true">${f.icon}</span>${f.label}</button>`).join('')}`).join('')}</nav><div class="sidebar-foot"><span class="status-dot"></span> A little practice, every day.</div></aside>
    <main><header class="topbar"><span>YOUR PRACTICE SPACE</span><div class="topbar-actions"><button data-action="install" hidden>Install Keys</button><button data-action="theme" aria-label="Toggle light and dark theme">☼ <span id="theme-label">Light</span></button><button data-action="enable-sound" id="enable-midi-sound" hidden>Enable sound</button><button data-action="midi-settings" id="connect-midi" aria-haspopup="dialog" aria-label="MIDI settings">♧ MIDI</button></div></header>
    <dialog class="midi-panel" aria-labelledby="midi-title"><div class="modal-heading"><div><p class="eyebrow">YOUR KEYBOARD</p><h2 id="midi-title">MIDI settings</h2></div><button data-action="close-midi" aria-label="Close MIDI settings" autofocus>×</button></div><div id="midi-status" role="status">Connect your keyboard to play.</div><label class="field" style="margin-top:18px"><span>MIDI input</span><select id="midi-device" aria-label="MIDI input"><option value="">Choose an input</option></select></label><p class="small" id="midi-port-hint"></p><button data-action="connect" class="primary">Connect keyboard</button><label class="check"><input type="checkbox" data-field="monitor" id="midi-monitor">Play MIDI notes through Keys</label><p class="small">Turn this off if your piano already makes sound.</p><div class="button-row"><button data-action="test-sound">▶ Test sound</button><span id="midi-activity" class="small" role="status">Waiting for a note…</span></div><p class="small" id="audio-status" role="status"></p><p class="small modal-footnote">Keys remembers this input and reconnects automatically when browser permission allows.</p><button data-action="close-midi" class="primary modal-done">Done</button></dialog>
    <div id="update-notice" class="notice" hidden>A new version is ready.<button data-action="update">Update when ready</button></div>
    <div id="message" class="notice" role="status" hidden></div><section class="page-heading"><p class="eyebrow" id="breadcrumb"></p><h1></h1><p id="description"></p></section>
    <div class="workspace"><section class="controls-card" id="controls" aria-label="Tool settings"></section><div class="instrument-column"><section class="instrument-card"><div class="instrument-head"><div><p class="eyebrow">THE KEYBOARD</p><h2 id="keyboard-title">A little room to explore</h2></div><span class="badge" id="range-badge">2 OCTAVES</span></div>
    <div class="instrument-tools"><button data-action="octave-down" aria-label="View lower octave">←</button><button data-action="octave-up" aria-label="View higher octave">→</button><button data-action="overview" id="overview">88 keys</button><label>Labels <select data-field="labels" aria-label="Key labels"><option value="notes">Notes</option><option value="intervals">Intervals</option><option value="none">Hidden</option></select></label><label><select data-field="accidental" aria-label="Accidental display"><option value="sharps">♯ Sharps</option><option value="flats">♭ Flats</option></select></label></div>
    <piano-keyboard></piano-keyboard><div class="keyboard-footer"><span><span style="color:var(--accent)">●</span> Root / target &nbsp; <span style="color:var(--gold)">●</span> Your notes</span><span id="keyboard-hint">Click a key to play · Arrow keys to move</span></div>
    <div class="instrument-tools transport"><button data-action="stop">■ Stop</button><button data-action="mute" id="mute" aria-label="Mute sound">Sound on</button><label>Volume <input data-field="volume" type="range" min="0" max="100" aria-label="Volume"></label><label>Tempo <input data-field="tempo" type="number" min="40" max="180" step="1" aria-label="Tempo in beats per minute" class="tempo-input"> BPM</label><span class="keyboard-meta" id="visible-range"></span></div></section>
    <div class="below-keyboard"><section class="detail-card" id="details"></section></div></div></div><footer class="footer"><span>KEYS · A SPACE TO LEARN</span><span id="offline-status">Local first. Just you and the piano.</span></footer></main>`;
    this.keyboard=this.querySelector('piano-keyboard');
    this.midiDialog=this.querySelector('dialog');
    this.midiDialog.addEventListener('click',e=>{if(e.target!==this.midiDialog)return;const r=this.midiDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)this.midiDialog.close();});
    this.addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(button&&!button.disabled)this.action(button.dataset.action,button.dataset).catch(error=>this.message(error.message));});
    this.addEventListener('change',e=>{
      if(e.target.id==='midi-device'){if(this.state.monitor)this.unlockAudio();this.midi.select(e.target.value);return;}
      const field=e.target.dataset.field;if(!field)return;
      const value=e.target.type==='checkbox'?e.target.checked:['anchor','inversion','octaves','volume','tempo'].includes(field)?Number(e.target.value):e.target.value;
      if(field==='monitor'&&value)this.unlockAudio();
      this.update({[field]:value});
    });
    this.addEventListener('piano-input',e=>this.input.accept(e.detail));
    this.store.addEventListener('change',()=>this.render());
    this.input.addEventListener('input',e=>this.onInput(e.detail));
    this.midi.addEventListener('change',()=>{
      if(JSON.stringify(this.state.lastMidiInput)!==JSON.stringify(this.midi.lastInput))this.store.update({lastMidiInput:this.midi.lastInput});
      this.renderMidi();
    });
    this.audio.onHighlight=notes=>{this.playing=notes;this.refreshKeyboard();};
    this.audio.onError=e=>this.message(e.message);
    this.onVisibility=()=>{if(document.hidden)this.input.stop();};this.onBlur=()=>this.input.stop();
    document.addEventListener('visibilitychange',this.onVisibility);window.addEventListener('blur',this.onBlur);
    this.onInstall=e=>{e.preventDefault();this.installPrompt=e;this.querySelector('[data-action=install]').hidden=false;};
    window.addEventListener('beforeinstallprompt',this.onInstall);
    this.onAudioGesture=()=>{if(this.midi.port&&this.state.monitor&&this.audio.context?.state!=='running')this.unlockAudio();};
    document.addEventListener('pointerdown',this.onAudioGesture);document.addEventListener('keydown',this.onAudioGesture);
    this.render();this.setupOffline();this.registerTools();this.midi.autoConnect();
  }
  disconnectedCallback(){this.input.stop();document.removeEventListener('visibilitychange',this.onVisibility);document.removeEventListener('pointerdown',this.onAudioGesture);document.removeEventListener('keydown',this.onAudioGesture);window.removeEventListener('blur',this.onBlur);window.removeEventListener('beforeinstallprompt',this.onInstall);if(this.midi.port)this.midi.port.onmidimessage=null;if(this.midi.access)this.midi.access.onstatechange=null;this.toolLifecycle?.abort();}
  get state(){return this.store.state;}
  get selected(){return this.answerSource==='midi'?this.input.held:[...this.selection].sort((a,b)=>a-b);}
  update(patch){
    if(!Object.keys(patch).every(k=>['volume','muted','theme'].includes(k))){this.input.stop();this.focusChord=null;}
    if(patch.mode||patch.quizType){this.selection.clear();this.quiz=null;this.answerSource='onscreen';}
    if((patch.mode==='positions'||this.state.mode==='positions')&&!['C','G','D','A','E','F'].includes(patch.root||this.state.root))patch.root='C';
    if(patch.anchor!==undefined)patch.viewStart=Math.max(24,Math.min(84,patch.anchor-12));
    this.store.update(patch);
  }
  render(){
    const focusedField=document.activeElement?.dataset?.field;
    const s=this.state,f=FEATURES.find(f=>f.id===s.mode);
    document.documentElement.dataset.theme=s.theme;document.querySelector('meta[name=theme-color]').content=s.theme==='dark'?'#141917':'#f4f6f1';
    this.querySelector('#theme-label').textContent=s.theme==='dark'?'Light':'Dark';
    for(const b of this.querySelectorAll('.nav-item')){b.classList.toggle('active',b.dataset.value===s.mode);b.setAttribute('aria-current',b.dataset.value===s.mode?'page':'false');}
    this.querySelector('#breadcrumb').textContent=`${f.group.toUpperCase()} / ${f.label.toUpperCase()}`;
    this.querySelector('h1').innerHTML=`${escape(f.title)}<span>.</span>`;this.querySelector('#description').textContent=f.description;
    const controls=this.querySelector('#controls');if(controls.firstElementChild?.tagName.toLowerCase()!==f.tag)controls.innerHTML=`<${f.tag}></${f.tag}>`;
    controls.firstElementChild.configure(s,{quiz:this.quiz});
    for(const field of ['labels','accidental','volume','tempo'])this.querySelector(`.instrument-card [data-field=${field}]`).value=s[field];
    this.querySelector('#midi-monitor').checked=s.monitor;
    this.querySelector('#mute').textContent=s.muted?'Sound off':'Sound on';this.querySelector('#mute').setAttribute('aria-pressed',String(s.muted));
    this.querySelector('#overview').textContent=s.overview?'2 octaves':'88 keys';
    this.querySelector('[data-action=octave-down]').disabled=s.overview||s.viewStart<=24;
    this.querySelector('[data-action=octave-up]').disabled=s.overview||s.viewStart>=84;
    this.audio.settings(s.volume,s.muted);this.refreshKeyboard();this.renderDetails();
    this.renderAudioPrompt();
    if(focusedField)this.querySelector(`[data-field="${focusedField}"]`)?.focus({preventScroll:true});
    if(!this.store.available)this.message('Browser storage is unavailable. You can keep practising, but changes may not be saved.');
  }
  musicalContext(){
    const s=this.state,pc=pitchClass(s.root);let notes=[],pattern=null,fingers={},all=false;
    if(s.mode==='notes')notes=s.filter.length?Array.from({length:88},(_,i)=>i+21).filter(n=>s.filter.includes(mod(n))):[];
    if(s.mode==='scales'){notes=scaleNotes(s.root,s.scale,s.anchor,s.octaves,s.direction==='down');pattern=SCALES[s.scale==='melodic'&&s.direction==='down'?'minor':s.scale];all=true;}
    if(s.mode==='chords'){notes=voicing(s.root,s.quality,s.inversion,s.anchor,s.split);pattern=CHORDS[s.quality];all=s.chordView==='tones';}
    if(s.mode==='arpeggios'){notes=arpeggio(s.root,s.quality,s.inversion,s.anchor,s.octaves,s.direction==='down');pattern=CHORDS[s.quality];}
    if(s.mode==='positions'){pattern={intervals:s.positionQuality==='major'?[0,2,4,5,7]:[0,2,3,5,7]};notes=pattern.intervals.map(i=>rootAt(s.root,s.anchor)+i);notes.forEach((n,i)=>fingers[n]=s.hand==='right'?i+1:5-i);}
    if(s.mode==='palette'){notes=this.focusChord?.notes||[];pattern=SCALES[s.paletteMode];}
    if(s.mode==='circle'){pattern=SCALES.major;all=true;}
    if(s.mode==='progressions')notes=this.focusChord?.notes||this.progressionVoicings()[0];
    if(s.mode==='identifier')notes=this.selected;
    if(s.mode==='quiz'&&this.quiz&&!this.quiz.complete){const q=this.quiz.current;notes=q.type==='name'?[q.target]:this.quiz.answered?q.type==='inversion'?q.expected:q.expected.map(n=>60+n):[];}
    const spellings={},intervals={};if(pattern)patternNames(s.root,pattern).forEach((name,i)=>{spellings[mod(pc+pattern.intervals[i])]=name;intervals[mod(pc+pattern.intervals[i])]=intervalLabel(pattern.intervals[i],pattern.degrees?.[i] ?? (pattern.intervals.length===7 ? i : undefined));});
    const targets=all&&pattern?Array.from({length:88},(_,i)=>i+21).filter(n=>pattern.intervals.includes(mod(n-pc))):notes;
    return {notes,targets,spellings,intervals,fingers,root:s.mode==='notes'?-1:pc};
  }
  refreshKeyboard(){
    if(!this.keyboard)return;const s=this.state,context=this.musicalContext();
    const start=s.overview?21:s.viewStart,end=s.overview?108:Math.min(108,start+24);
    const hide=s.mode==='quiz'&&this.quiz&&!this.quiz.complete&&!this.quiz.answered;
    this.keyboard.configure({...context,start,end,labels:hide?'none':s.labels,accidental:s.accidental,selected:this.selected,sounding:[...this.input.sounding,...this.playing],held:this.input.held});
    this.querySelector('#visible-range').textContent=`${noteName(start,s.accidental,true)} – ${noteName(end,s.accidental,true)}`;
    this.querySelector('#range-badge').textContent=s.overview?'88 KEYS':'2 OCTAVES';
    const outside=context.notes.filter(n=>n<start||n>end).length;
    this.querySelector('#keyboard-title').textContent=s.mode==='notes'?'A little room to explore':s.mode==='quiz'?'Your turn at the keyboard':s.mode==='identifier'?'Follow your ear':`${pretty(s.root)} · ${FEATURES.find(f=>f.id===s.mode).label}`;
    this.querySelector('#keyboard-hint').textContent=outside?`${outside} target notes outside view · use arrows or 88 keys`:(s.mode==='identifier'||s.mode==='quiz')?'Tap keys to select · Clear to start again':'Click a key to play · Arrow keys to move';
  }
  renderDetails(){this.querySelector('#details').innerHTML=details(this.state,{...this.musicalContext(),selected:this.selected,quiz:this.quiz,focusChord:this.focusChord});}
  onInput(e){
    if(e.type==='all-notes-off'){this.audio.stop();this.playing=[];}
    else {
      const isMidi=e.source.startsWith('midi:');
      if(isMidi&&(e.type==='note-on'||e.type==='note-off'))this.answerSource='midi';
      if(e.type==='note-on'){
        if(isMidi){this.querySelector('#midi-activity').textContent=`Receiving ${pretty(noteName(e.pitch,this.state.accidental,true))} · velocity ${Math.round(e.velocity*127)}`;}
        if(!isMidi||this.state.monitor)this.audio.on(e.pitch,e.velocity,e.source).catch(error=>this.message(error.message));
        if(!isMidi&&(this.state.mode==='identifier'||this.state.mode==='quiz')){
          this.answerSource='onscreen';
          if(!(this.state.mode==='quiz'&&this.quiz?.answered)){
            if(this.state.mode==='quiz'&&this.quiz?.current?.type==='find')this.selection=new Set([e.pitch]);
            else if(this.selection.has(e.pitch))this.selection.delete(e.pitch);else this.selection.add(e.pitch);
          }
        }
      }
      if(e.type==='note-off')this.audio.off(e.pitch,e.source);
      if(e.type==='sustain')this.audio.sustain(e.source,e.down);
    }
    this.refreshKeyboard();
    if(this.state.mode==='identifier')this.renderDetails();
    if(this.state.mode==='quiz'){const el=this.querySelector('#quiz-selection');if(el)el.textContent=this.selected.map(n=>pretty(noteName(n,this.state.accidental,true))).join(' · ')||'No notes selected';}
  }
  progressionVoicings(){
    const s=this.state,chords=progressionChords(s.root,s.progression),upper=voiceLead(chords,s.anchor,Math.min(108,s.anchor+24));
    return upper.map((notes,i)=>s.split?[rootAt(chords[i].root,Math.max(24,s.anchor-12)),...notes]:notes);
  }
  async play(notes){
    const s=this.state,sequence=notes||(s.mode==='identifier'?this.selected:this.musicalContext().notes);
    this.input.stop();
    if(notes)return this.audio.sequence([{notes,beats:2}],s.tempo);
    if(s.mode==='progressions')return this.audio.sequence(this.progressionVoicings().map(notes=>({notes,beats:4})),s.tempo);
    if(!sequence.length){this.message('Choose some notes first.');return;}
    if(['scales','arpeggios','positions'].includes(s.mode))return this.audio.sequence(sequence.map(n=>({notes:[n],beats:.5})),s.tempo);
    return this.audio.sequence([{notes:sequence,beats:2}],s.tempo);
  }
  async action(action,d={}){
    const s=this.state;
    switch(action){
      case 'mode':this.update({mode:d.value});break;
      case 'theme':this.update({theme:s.theme==='dark'?'light':'dark'});break;
      case 'mute':this.update({muted:!s.muted});break;
      case 'midi-settings':this.midiDialog.showModal();break;
      case 'close-midi':this.midiDialog.close();break;
      case 'connect':this.unlockAudio();await this.midi.connect();break;
      case 'enable-sound':await this.unlockAudio();break;
      case 'test-sound':this.store.update({muted:false,volume:s.volume||65});await this.unlockAudio();await this.play([60,64,67]);break;
      case 'overview':this.update({overview:!s.overview});break;
      case 'octave-down':this.update({viewStart:s.viewStart-12});break;
      case 'octave-up':this.update({viewStart:s.viewStart+12});break;
      case 'filter':{const n=Number(d.value);this.update({filter:s.filter.includes(n)?s.filter.filter(v=>v!==n):[...s.filter,n]});break;}
      case 'clear-filter':this.update({filter:[]});break;
      case 'play':await this.play();break;
      case 'stop':this.input.stop();break;
      case 'clear-selection':this.input.stop();this.selection.clear();this.answerSource='onscreen';this.refreshKeyboard();this.renderDetails();break;
      case 'circle-root':this.update({root:d.value});break;
      case 'circle-scale':this.update({mode:'scales',scale:'major'});break;
      case 'circle-chords':this.update({mode:'palette',paletteMode:'major',family:'triad'});break;
      case 'diatonic':{const chord=palette(s.root)[Number(d.index)];this.update({mode:'chords',root:ROOTS.includes(chord.root)?chord.root:noteName(pitchClass(chord.root),s.accidental),quality:chord.quality,inversion:0});await this.play();break;}
      case 'palette-chord':{const chord=palette(s.root,s.paletteMode,s.family)[Number(d.index)];this.focusChord={index:Number(d.index),notes:chord.intervals.map(i=>rootAt(chord.root,s.anchor)+i)};this.refreshKeyboard();this.renderDetails();await this.play(this.focusChord.notes);break;}
      case 'progression-chord':{const notes=this.progressionVoicings()[Number(d.index)];this.focusChord={notes};this.refreshKeyboard();await this.play(notes);break;}
      case 'save':if(!s.saved.some(p=>p.root===s.root&&p.id===s.progression)){this.store.update({saved:[...s.saved,{root:s.root,id:s.progression}]});this.message('Progression saved on this device.');}else this.message('This progression is already saved.');break;
      case 'load-saved':{const p=s.saved[Number(d.index)];this.update({root:p.root,progression:p.id});break;}
      case 'delete-saved':this.store.update({saved:s.saved.filter((_,i)=>i!==Number(d.index))});break;
      case 'start-quiz':this.startQuiz();break;
      case 'retry-quiz':this.startQuiz(this.quiz.results.filter(r=>!r.correct).map(r=>r.question));break;
      case 'check-answer':this.submitQuiz(this.selected);break;
      case 'answer-name':this.submitQuiz([Number(d.value)]);break;
      case 'reveal':this.submitQuiz([],true);break;
      case 'next-question':this.input.stop();this.quiz.next();this.selection.clear();this.answerSource='onscreen';if(this.quiz.complete)this.store.update({stats:{...s.stats,sessions:s.stats.sessions+1}});else this.store.update({viewStart:this.quizViewStart()});break;
      case 'install':if(this.installPrompt){await this.installPrompt.prompt();this.installPrompt=null;this.querySelector('[data-action=install]').hidden=true;}break;
      case 'update':this.input.stop();this.waitingWorker?.postMessage({type:'SKIP_WAITING'});break;
    }
  }
  quizViewStart(){const q=this.quiz?.current;return q?.type==='inversion'?Math.max(24,Math.min(84,Math.floor(q.expected[0]/12)*12)):48;}
  startQuiz(questions){this.input.stop();this.quiz=new QuizSession(this.state.quizType,questions);this.selection.clear();this.answerSource='onscreen';this.store.update({viewStart:this.quizViewStart(),overview:false});}
  submitQuiz(notes,reveal=false){
    if(!this.quiz||this.quiz.complete||this.quiz.answered)return;
    const result=this.quiz.submit(notes,reveal),stats=this.state.stats;
    this.store.update({stats:{...stats,total:stats.total+1,correct:stats.correct+(result?1:0)}});
  }
  renderMidi(){
    this.querySelector('#midi-status').textContent=this.midi.status;
    this.querySelector('#connect-midi').textContent=this.midi.port?'● MIDI':'♧ MIDI';
    this.querySelector('#connect-midi').classList.toggle('midi-connected',Boolean(this.midi.port));
    this.querySelector('#connect-midi').setAttribute('aria-label',this.midi.port?'MIDI settings, connected':'MIDI settings');
    const select=this.querySelector('#midi-device');select.innerHTML='<option value="">Choose an input</option>';
    for(const port of this.midi.devices){const option=document.createElement('option');option.value=port.id;option.textContent=port.name||'MIDI keyboard';select.append(option);}
    select.value=this.midi.port?.id||'';
    this.querySelector('#midi-port-hint').textContent=isControlPort(this.midi.port?.name)?'This looks like a control-surface port. For piano keys, choose the main MIDI port instead of MCU/HUI, DAW, ALV or DIN THRU.':'';
    this.querySelector('#midi-activity').textContent='Waiting for a note…';
    this.renderAudioPrompt();
  }
  renderAudioPrompt(){this.querySelector('#enable-midi-sound').hidden=!(this.midi.port&&this.state.monitor&&this.audio.context?.state!=='running');}
  async unlockAudio(){
    const status=this.querySelector('#audio-status');
    status.textContent='Starting sound…';
    try{await this.audio.ready();status.textContent='Sound ready. MIDI notes play when monitoring is enabled.';this.renderAudioPrompt();}
    catch(error){status.textContent=error.message;}
  }
  message(text){const el=this.querySelector('#message');el.textContent=text;el.hidden=!text;}
  async setupOffline(){
    if(!('serviceWorker' in navigator))return;
    try {
      const registration=await navigator.serviceWorker.register('./service-worker.js');
      const ready=()=>{if(registration.waiting&&navigator.serviceWorker.controller){this.waitingWorker=registration.waiting;this.querySelector('#update-notice').hidden=false;}};
      ready();registration.addEventListener('updatefound',()=>{registration.installing?.addEventListener('statechange',ready);});
      let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(this.waitingWorker&&!reloading){reloading=true;location.reload();}});
      await navigator.serviceWorker.ready;this.querySelector('#offline-status').textContent='Ready for offline practice · Saved on this device';
    }catch{this.querySelector('#offline-status').textContent='Offline setup unavailable · Open over localhost or HTTPS';}
  }
  registerTools(){
    if(!document.modelContext?.registerTool)return;
    this.toolLifecycle=new AbortController();
    const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:this.toolLifecycle.signal})).catch(()=>{});}catch{}};
    register({name:'configure_keys_explorer',description:'Choose a Keys learning tool and root note. Changes visible explorer settings; does not play sound or start a quiz.',inputSchema:{type:'object',properties:{mode:{type:'string',enum:FEATURES.map(f=>f.id)},root:{type:'string',enum:ROOTS}},required:['mode','root'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!input||!FEATURES.some(f=>f.id===input.mode)||!ROOTS.includes(input.root))throw new Error('Choose a supported mode and root');this.update({mode:input.mode,root:input.root});return {mode:this.state.mode,root:this.state.root};}});
    register({name:'read_keys_state',description:'Read the current Keys learning mode, root and held notes.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({mode:this.state.mode,root:this.state.root,held:this.input.held})});
  }
}
customElements.define('keys-app',KeysApp);
