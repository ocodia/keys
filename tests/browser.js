import {runCore,assert,equal} from './core.js';
import {FEATURES} from '../feature-registry.js';
const list=document.querySelector('#results');let failures=0,total=0;
function report(t){total++;if(!t.passed)failures++;const li=document.createElement('li');li.className=t.passed?'pass':'fail';li.textContent=`${t.passed?'PASS':'FAIL'} ${t.name}${t.error?' — '+t.error:''}`;list.append(li);}
await runCore(report);
const iframe=document.querySelector('iframe');
if(!iframe.contentDocument.querySelector('keys-app')?.store)await new Promise(resolve=>iframe.addEventListener('load',resolve,{once:true}));
const app=iframe.contentDocument.querySelector('keys-app'),doc=iframe.contentDocument;
const snapshot=JSON.stringify(app.state);
const savedStorage=app.store.storage;app.store.storage={getItem:()=>snapshot,setItem:()=>{}};
// Browser automation must not depend on an audio permission gesture. The real
// synthesiser is exercised separately by manual playback and core lifecycle tests.
app.audio.sequence=async()=>{};app.audio.on=async()=>{};
const test=async(name,run)=>{try{await run();report({name,passed:true});}catch(e){report({name,passed:false,error:e.message});}};
await test('Navigation toggles without changing practice state or narrowing the keyboard with controls',async()=>{
  app.store.update({navCollapsed:true});const mode=app.state.mode;
  assert(app.querySelector('#navigation').hidden);equal(app.querySelector('#nav-toggle').getAttribute('aria-expanded'),'false');
  const full=app.keyboard.getBoundingClientRect().width;
  await app.action('toggle-nav');assert(!app.querySelector('#navigation').hidden);equal(app.querySelector('#nav-toggle').getAttribute('aria-expanded'),'true');
  assert(app.keyboard.getBoundingClientRect().width<full);equal(app.state.mode,mode);
  await app.action('toggle-nav');equal(app.keyboard.getBoundingClientRect().width,full);
  assert(!app.querySelector('.footer'));assert(!app.querySelector('#offline-status'));
});
await test('MIDI settings are hidden until opened and do not occupy practice space',async()=>{
  const dialog=app.querySelector('dialog.midi-panel');assert(!dialog.open);equal(dialog.getBoundingClientRect().height,0);
  await app.action('midi-settings');assert(dialog.open);equal(dialog.getAttribute('aria-labelledby'),'midi-title');assert(dialog.contains(doc.activeElement));
  await app.action('close-midi');assert(!dialog.open);equal(dialog.getBoundingClientRect().height,0);
});
await test('Every registered feature renders its controls and meaningful content',async()=>{
  for(const f of FEATURES){await app.action('mode',{value:f.id});assert(app.querySelector(f.tag));const panel=app.querySelector('#details');if(['notes','positions','identifier','quiz'].includes(f.id))assert(panel.hidden);else assert(panel.textContent.trim().length>0);equal(app.querySelectorAll('.nav-item.active').length,1);}
});
await test('Every page keeps relevant practice content before the keyboard',async()=>{
  for(const f of FEATURES){
    app.update({mode:f.id});const panel=app.querySelector('#details'),instrument=app.querySelector('.instrument-column');
    assert(Boolean(panel.compareDocumentPosition(instrument)&Node.DOCUMENT_POSITION_FOLLOWING));
    assert(instrument===app.querySelector('.workspace').lastElementChild);
    assert(!app.querySelector('.below-keyboard'));
    if(!panel.hidden)assert(panel.getBoundingClientRect().bottom<=instrument.getBoundingClientRect().top+1);
  }
});
await test('Connecting MIDI and enabling monitoring unlock audio within the gesture handler',async()=>{
  const ready=app.audio.ready,connect=app.midi.connect;const calls=[];
  app.audio.ready=async()=>{calls.push('audio');};app.midi.connect=async()=>{calls.push('midi');};
  await app.action('connect');equal(calls,['audio','midi']);
  calls.length=0;const monitor=app.querySelector('#midi-monitor');monitor.checked=true;monitor.dispatchEvent(new Event('change',{bubbles:true}));equal(calls,['audio']);
  app.audio.ready=ready;app.midi.connect=connect;
});
await test('Onscreen pointer selection identifies C major and E-bass inversion',async()=>{
  await app.action('mode',{value:'identifier'});
  for(const pitch of [60,64,67]){app.input.accept({type:'note-on',pitch,source:'pointer:1'});app.input.accept({type:'note-off',pitch,source:'pointer:1'});}
  assert(app.querySelector('#identifier-result').textContent.includes('Root position'));
  app.selection=new Set([64,67,72]);app.renderDetails();assert(app.querySelector('#identifier-result').textContent.includes('C/E'));await app.action('clear-selection');equal(app.selected,[]);
});
await test('Scales, hand fingers, palette selection and circle navigation',async()=>{
  app.update({mode:'scales',root:'F#',scale:'major'});assert(app.querySelector('#details').textContent.includes('E♯'));
  app.update({mode:'positions',root:'C',hand:'left'});equal(app.keyboard.querySelector('[data-midi="60"] .key-label').textContent,'5');
  app.update({mode:'palette',root:'C'});await app.action('palette-chord',{index:'1'});equal(app.focusChord.notes,[62,65,69]);await app.action('stop');
  app.update({mode:'circle'});await app.action('circle-root',{value:'G'});await app.action('circle-scale');equal(app.state.mode,'scales');equal(app.state.root,'G');
});
await test('Quiz Check, Reveal, Next and retry summary with held MIDI notes',async()=>{
  app.update({mode:'quiz',quizType:'chord'});app.startQuiz([{type:'chord',expected:[0,4,7],prompt:'Build C major',answer:'C · E · G'}]);
  for(const pitch of [60,64,67])app.input.accept({type:'note-on',pitch,source:'midi:test:0'});
  await app.action('check-answer');equal(app.quiz.score,1);await app.action('check-answer');equal(app.quiz.results.length,1);
  await app.action('next-question');assert(app.querySelector('#details').textContent.includes('SESSION COMPLETE'));
  app.startQuiz([{type:'find',expected:[0],prompt:'Find C',answer:'C'}]);await app.action('reveal');equal(app.quiz.score,0);await app.action('next-question');assert(app.querySelector('[data-action="retry-quiz"]'));
});
await test('Arrow-key focus and full 88-key geometry',async()=>{
  app.update({mode:'notes',viewStart:48,keyCount:25});const key=app.keyboard.querySelector('[data-midi="60"]');key.focus();key.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));equal(doc.activeElement.dataset.midi,'61');
  app.update({keyCount:88});equal(app.keyboard.querySelectorAll('[data-midi]').length,88);app.update({keyCount:25});
});
await test('Keyboard view selector shows exact 49/61-key ranges and clamps octave navigation',async()=>{
  const control=app.querySelector('#overview');equal(control.tagName,'SELECT');equal([...control.options].map(o=>o.value),['25','49','61','88']);
  for(const [count,end] of [[49,84],[61,96]]){
    const select=app.querySelector('[data-field=keyCount]');select.value=String(count);select.dispatchEvent(new Event('change',{bubbles:true}));
    equal(app.state.keyCount,count);equal(app.keyboard.querySelectorAll('[data-midi]').length,count);
    equal(app.keyboard.data.start,36);equal(app.keyboard.data.end,end);
    for(let i=0;i<6;i++)await app.action('octave-up');
    equal(app.keyboard.data.end,108);equal(app.keyboard.querySelectorAll('[data-midi]').length,count);assert(app.querySelector('[data-action=octave-up]').disabled);
  }
  app.update({keyCount:25});
});
await test('Mobile layout contains page overflow while keyboard scrolls',async()=>{
  iframe.style.width='390px';await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  app.update({mode:'notes'});assert(doc.documentElement.scrollWidth<=doc.documentElement.clientWidth+1,'Page overflows the mobile viewport');
  const scroller=app.querySelector('.piano-scroll');assert(scroller.scrollWidth>scroller.clientWidth,'Keyboard should scroll at mobile width');iframe.style.width='1200px';
});
await test('Service worker caches the complete installable app shell',async()=>{
  await iframe.contentWindow.navigator.serviceWorker.ready;const keys=await caches.keys();const name=keys.find(k=>k.startsWith('keys-')&&k.includes(location.origin)&&!k.endsWith('salamander-v1'));assert(name,'App cache absent');
  const cache=await caches.open(name);for(const path of ['index.html','app.js','theory.js','panels.js','input-service.js','icons/keys-192.png','icons/keys-512.png'])assert(await cache.match(new URL('../'+path,location.href)),`Missing ${path}`);
});
app.input.stop();app.selection.clear();app.quiz=null;app.focusChord=null;app.answerSource='onscreen';app.store.update(JSON.parse(snapshot));
app.store.storage=savedStorage;
document.querySelector('#summary').textContent=`${total-failures} / ${total} test groups passed${failures?' — failures need attention':''}`;
document.title=failures?`FAIL: ${failures} Keys tests`:`PASS: ${total} Keys tests`;
document.querySelector('#desktop').onclick=()=>{iframe.style.width='1200px';};document.querySelector('#mobile').onclick=()=>{iframe.style.width='390px';};
