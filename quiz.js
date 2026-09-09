import { CHORDS, noteName, pretty, mod, voicing, inversionName } from './theory.js';
export function makeQuestions(type='find',random=Math.random,count=10){
  const naturalPcs=[0,2,4,5,7,9,11];
  const pick=items=>items[Math.min(items.length-1,Math.floor(random()*items.length))];
  return Array.from({length:count},()=>{
    const pc=pick(type==='find'||type==='name'?naturalPcs:Array.from({length:12},(_,i)=>i)),root=noteName(pc);
    if(type==='find')return {type,root,expected:[pc],prompt:`Find ${pretty(root)} on the keyboard.`,answer:pretty(root)};
    if(type==='name')return {type,root,expected:[pc],target:60+pc,prompt:'What is the name of the highlighted note?',answer:pretty(root)};
    const quality=pick(['major','minor']),inversion=type==='inversion'?pick([0,1,2]):0;
    const notes=voicing(root,quality,inversion,48);
    return {type,root,quality,inversion,expected:type==='inversion'?notes:CHORDS[quality].intervals.map(i=>mod(pc+i)),
      prompt:type==='inversion'?`Play ${pretty(root)} ${quality}, ${inversionName(inversion).toLowerCase()}, with ${noteName(notes[0],'sharps',true)} in the bass.`:`Build a ${pretty(root)} ${quality} chord.`,
      answer:notes.map(n=>pretty(noteName(n,'sharps',type==='inversion'))).join(' · ')};
  });
}
export function evaluate(question,notes){
  const actual=[...new Set(notes.map(n=>question.type==='inversion'?n:mod(n)))].sort((a,b)=>a-b);
  return actual.join() === [...question.expected].sort((a,b)=>a-b).join();
}
export class QuizSession {
  constructor(type,questions=makeQuestions(type)){this.type=type;this.questions=questions;this.index=0;this.results=[];this.feedback='';this.answered=false;}
  get current(){return this.questions[this.index];}
  get complete(){return this.index>=this.questions.length;}
  submit(notes,reveal=false){
    if(this.answered||this.complete)return null;
    const correct=!reveal&&evaluate(this.current,notes);
    this.results.push({question:this.current,correct,revealed:reveal});this.answered=true;
    this.feedback=reveal?`Answer: ${this.current.answer}`:correct?'That’s right. Nicely played.':`Not quite. The answer is ${this.current.answer}.`;
    return correct;
  }
  next(){if(!this.answered)return;this.index++;this.answered=false;this.feedback='';}
  get score(){return this.results.filter(r=>r.correct).length;}
}
