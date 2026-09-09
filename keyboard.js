import { keyboardGeometry, noteName, pretty, mod } from './theory.js';
export class PianoKeyboard extends HTMLElement {
  connectedCallback() {
    this.pointers = new Map();
    this.addEventListener('pointerdown',e => {
      const key = e.target.closest('[data-midi]'); if (!key || e.button > 0) return;
      e.preventDefault(); key.focus({preventScroll:true}); key.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId,Number(key.dataset.midi)); this.emit('note-on',Number(key.dataset.midi),`pointer:${e.pointerId}`);
    });
    const release = e => {
      if (!this.pointers.has(e.pointerId)) return;
      this.emit('note-off',this.pointers.get(e.pointerId),`pointer:${e.pointerId}`); this.pointers.delete(e.pointerId);
    };
    this.addEventListener('pointerup',release); this.addEventListener('pointercancel',release); this.addEventListener('lostpointercapture',release);
    this.addEventListener('keydown',e => {
      const key = e.target.closest('[data-midi]'); if (!key) return;
      const n = Number(key.dataset.midi);
      if (['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) {
        e.preventDefault(); const target = e.key==='Home' ? this.data.start : e.key==='End' ? this.data.end : n+(e.key==='ArrowLeft'?-1:1);
        this.querySelector(`[data-midi="${target}"]`)?.focus();
      }
      if ([' ','Enter'].includes(e.key)) { e.preventDefault(); if (!e.repeat) this.emit('note-on',n,'computer'); }
    });
    this.addEventListener('keyup',e => { if ([' ','Enter'].includes(e.key) && e.target.dataset.midi) { e.preventDefault(); this.emit('note-off',Number(e.target.dataset.midi),'computer'); } });
    this.addEventListener('focusout',e => { if (e.target.dataset.midi) this.emit('note-off',Number(e.target.dataset.midi),'computer'); });
  }
  emit(type,pitch,source) { this.dispatchEvent(new CustomEvent('piano-input',{bubbles:true,detail:{type,pitch,source,velocity:0.75,timestamp:performance.now()}})); }
  configure(data) {
    this.data = data;
    const signature = `${data.start}:${data.end}`;
    if (this.signature !== signature) {
      this.signature = signature;
      const {keys,whites} = keyboardGeometry(data.start,data.end);
      this.innerHTML = `<div class="piano-scroll"><div class="piano-bed" role="group" aria-label="Playable piano keyboard" style="--whites:${whites}">${keys.map(k=>`<button type="button" data-midi="${k.midi}" class="piano-key ${k.black?'black':'white'}" style="left:${100*k.left/whites}%;width:${100*k.width/whites}%" aria-label="${noteName(k.midi,'sharps',true)}"><span class="key-dot"></span><span class="key-label"></span></button>`).join('')}</div></div>`;
    }
    this.paint();
  }
  paint() {
    if (!this.data) return;
    const d = this.data;
    for (const key of this.querySelectorAll('[data-midi]')) {
      const n = Number(key.dataset.midi), active = d.targets?.includes(n), selected = d.selected?.includes(n);
      key.classList.toggle('target',Boolean(active)); key.classList.toggle('root',Boolean(active && mod(n)===d.root));
      key.classList.toggle('selected',Boolean(selected)); key.classList.toggle('sounding',Boolean(d.sounding?.includes(n)));
      key.classList.toggle('middle-c',n===60);
      key.setAttribute('aria-pressed',String(Boolean(selected || d.held?.includes(n))));
      const label = d.fingers?.[n] || (d.labels==='none' ? '' : d.labels==='intervals' ? (active ? d.intervals?.[mod(n)] || '' : '') : d.spellings?.[mod(n)] || noteName(n,d.accidental));
      key.querySelector('.key-label').textContent = pretty(label) + (d.labels==='notes' && mod(n)===0 && !d.fingers?.[n] ? Math.floor(n/12)-1 : '');
      key.setAttribute('aria-label',`${pretty(d.spellings?.[mod(n)] || noteName(n,d.accidental))}, octave ${Math.floor(n/12)-1}${n===60?', middle C':''}${active?', target':''}`);
    }
  }
}
customElements.define('piano-keyboard',PianoKeyboard);
