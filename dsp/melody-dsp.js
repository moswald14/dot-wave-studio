(function(root){
 'use strict';
 // Pure composer model: all edits return independent validated projects.
 // Times and lengths are quarter-note beats. Resize trims/drops notes past
 // the new end; callers should retain an undo snapshot before shortening.
 const Song=typeof module!=='undefined'&&module.exports?require('./song-dsp.js'):root.SongDSP;
 const Vocal=typeof module!=='undefined'&&module.exports?require('./vocal-dsp.js'):root.VocalDSP;
 const MAX_NOTES=2048,MAX_BARS=16,MIN_DURATION=1/960;
 const TRACKS=[['melody','Melody','piano',.65],['chords','Chords','stock-triangle',.45],['bass','Bass','stock-sine',.6],['rhythm','Rhythm','drums',.5]];
 function number(value,min,max,label){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error('Invalid '+label+'.');return value;}
 function integer(value,min,max,label){number(value,min,max,label);if(!Number.isInteger(value))throw new Error('Invalid '+label+'.');return value;}
 function text(value,max,label){if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw new Error('Invalid '+label+'.');return value.trim();}
 function defaultProject(){return {kind:'dot-melody-lab',version:1,name:'My melody',bpm:110,bars:4,root:0,mode:'major',tracks:TRACKS.map(([id,name,instrument,volume])=>({id,name,instrument,volume,room:0,mute:false,notes:[]}))};}
 function songObject(p){return {name:p.name,bpm:p.bpm,bars:p.bars,meter:{numerator:4,denominator:4},loop:{start:0,end:p.bars},tracks:p.tracks.map(t=>({...t,notes:t.notes.map(n=>({...n})),pan:0,pitch:0,fadeIn:0,fadeOut:0})),beats:[],clips:[],audio:[],waves:[]};}
 function checkedNote(n,end){
  if(!n||typeof n!=='object')throw new Error('Invalid composer note.');const start=number(n.start,0,end-MIN_DURATION,'note position'),duration=number(n.duration,MIN_DURATION,64,'note length');
  if(start+duration>end+1e-9)throw new Error('A note extends beyond the melody.');
  return {start,duration:Math.min(duration,end-start),midi:integer(n.midi,0,127,'note pitch'),velocity:number(n.velocity,0,1,'note velocity'),...(n.vocal!==undefined?{vocal:Vocal.note(n.vocal)}:{})};
 }
 function validate(value,signals){
  if(!value||value.kind!=='dot-melody-lab'||value.version!==1)throw new Error('Choose a melody & rhythm LAB project.');
  const bars=integer(value.bars,1,MAX_BARS,'measure count'),end=bars*4;
  if(!['major','minor'].includes(value.mode))throw new Error('Choose a major or minor key.');
  if(!Array.isArray(value.tracks)||value.tracks.length!==4)throw new Error('The composer needs its four instrument lanes.');
  const seen=new Set();let count=0;
  const tracks=value.tracks.map(t=>{
   if(!t||!TRACKS.some(([id])=>id===t.id)||seen.has(t.id))throw new Error('Invalid or repeated composer lane.');seen.add(t.id);
   if(typeof t.instrument!=='string'||!(/^[a-zA-Z0-9_-]{1,90}$/).test(t.instrument))throw new Error('Invalid composer instrument.');
   if(typeof t.mute!=='boolean')throw new Error('Invalid lane mute setting.');
   if(!Array.isArray(t.notes)||t.notes.length>MAX_NOTES)throw new Error('Keep the composer to 2,048 notes.');count+=t.notes.length;if(count>MAX_NOTES)throw new Error('Keep the composer to 2,048 notes.');
   const notes=Array.from(t.notes,n=>checkedNote(n,end)),positions=new Set();
   for(const n of notes){const key=n.start+':'+n.midi;if(positions.has(key))throw new Error('A lane has repeated notes at the same position.');positions.add(key);}
   notes.sort((a,b)=>a.start-b.start||a.midi-b.midi);
   return {id:t.id,name:text(t.name,48,'lane name'),instrument:t.instrument,volume:number(t.volume,0,1,'lane volume'),room:number(t.room??0,0,.6,'room amount'),mute:t.mute,notes};
  });
  tracks.sort((a,b)=>TRACKS.findIndex(([id])=>id===a.id)-TRACKS.findIndex(([id])=>id===b.id));
  const result={kind:'dot-melody-lab',version:1,name:text(value.name,64,'melody name'),bpm:number(value.bpm,40,240,'tempo'),bars,root:integer(value.root,0,11,'key root'),mode:value.mode,tracks};
  // Also enforce the existing audio engine's instrument availability rules.
  if(signals)Song.validateSong(songObject(result),signals);
  return result;
 }
 function toSong(value,signals){return Song.validateSong(songObject(validate(value,signals)),signals);}
 function resize(value,bars){const p=validate(value);integer(bars,1,MAX_BARS,'measure count');const end=bars*4;p.bars=bars;for(const t of p.tracks)t.notes=t.notes.filter(n=>n.start<=end-MIN_DURATION).map(n=>({...n,duration:Math.min(n.duration,end-n.start)}));return validate(p);}
 function lane(p,id){const t=p.tracks.find(t=>t.id===id);if(!t)throw new Error('Choose a composer lane.');return t;}
 function stamp(value,trackId,note,erase=false){
  const p=validate(value),t=lane(p,trackId);if(typeof erase!=='boolean')throw new Error('Invalid eraser mode.');if(!note||typeof note!=='object')throw new Error('Choose a note position.');
  const start=number(note.start,0,p.bars*4-MIN_DURATION,'note position'),midi=integer(note.midi,0,127,'note pitch'),at=t.notes.findIndex(n=>n.start===start&&n.midi===midi);
  if(at>=0)t.notes.splice(at,1);else if(!erase){number(note.duration,MIN_DURATION,64,'note length');t.notes.push(checkedNote({...note,start,midi,duration:Math.min(note.duration,p.bars*4-start)},p.bars*4));}
  return validate(p);
 }
 function transpose(value,trackId,semitones){const p=validate(value),t=lane(p,trackId);integer(semitones,-127,127,'transpose interval');if(t.notes.some(n=>n.midi+semitones<0||n.midi+semitones>127))throw new Error('Transposing would move a note beyond MIDI 0–127.');t.notes=t.notes.map(n=>({...n,midi:n.midi+semitones}));return validate(p);}
 const api={MAX_NOTES,MAX_BARS,MIN_DURATION,defaultProject,validate,toSong,resize,stamp,transpose};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MelodyDSP=api;
})(typeof globalThis!=='undefined'?globalThis:this);
