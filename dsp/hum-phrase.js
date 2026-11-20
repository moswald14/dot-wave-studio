(function(root){
 'use strict';
 // Captured pitch frames become one editable phrase. Microphone processing
 // never mutates the composer; add() commits only the completed take.
 const SCALES={chromatic:[0,1,2,3,4,5,6,7,8,9,10,11],major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],pentatonic:[0,2,4,7,9]};
 const finite=Number.isFinite,round=n=>Math.round(n*1e9)/1e9,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function number(value,fallback,min,max,label){const n=value===undefined?fallback:value;if(typeof n!=='number'||!finite(n)||n<min||n>max)throw Error('Invalid '+label+'.');return n;}
 function median(values){const a=values.slice().sort((a,b)=>a-b);return a.length?a[Math.floor(a.length/2)]:0;}
 function settings(options={}){
  const root=number(options.root,0,0,11,'hum key');if(!Number.isInteger(root))throw Error('Choose a whole-note hum key.');
  const scale=options.scale===undefined?'chromatic':options.scale;if(!Object.hasOwn(SCALES,scale))throw Error('Choose chromatic, major, minor, or pentatonic tuning.');
  return {bpm:number(options.bpm,110,40,240,'hum tempo'),root,scale,quantize:number(options.quantize,.25,0,4,'hum note grid'),minDuration:number(options.minDuration,.08,.08,1,'minimum hum note length'),confidence:number(options.confidence,.7,0,1,'hum confidence'),gate:number(options.gate,.004,0,1,'hum input gate'),duration:options.durationSeconds===undefined?Infinity:number(options.durationSeconds,0,0,120,'hum take length'),useTarget:options.useTarget!==false};
 }
 function snap(midi,o){
  let chosen=0,distance=Infinity;
  for(let n=0;n<=127;n++)if(SCALES[o.scale].includes(((n-o.root)%12+12)%12)){const d=Math.abs(n-midi);if(d<distance){chosen=n;distance=d;}}
  return chosen;
 }
 function convert(frames,options={}){
  const o=settings(options);if(!Array.isArray(frames)||frames.length>20000)throw Error('Choose a captured hum take with at most 20,000 pitch frames.');
  if(!frames.length||!o.duration)return [];
  const hops=[];let last=-1;
  for(const f of frames){if(!f||typeof f!=='object'||!finite(f.time)||f.time<0||f.time<=last)throw Error('Hum pitch frames need increasing, valid times.');if(last>=0)hops.push(f.time-last);last=f.time;}
  const hop=clamp(median(hops)||.02,.002,.1),restGap=.06,stableTime=o.minDuration;
  const prepared=frames.filter(f=>f.time-hop/2<o.duration).map(f=>{
   const midi=finite(f.midi)?f.midi:finite(f.frequency)&&f.frequency>0?69+12*Math.log2(f.frequency/440):NaN;
   const voiced=f.voiced!==false&&finite(midi)&&midi>=0&&midi<=127&&finite(f.confidence)&&f.confidence>=o.confidence&&finite(f.rms)&&f.rms>=o.gate;
   const chosen=o.useTarget&&finite(f.targetMidi)?clamp(Math.round(f.targetMidi),0,127):snap(midi,o);
   return {start:Math.max(0,f.time-hop/2),end:Math.min(o.duration,f.time+hop/2),midi,chosen,voiced,rms:clamp(f.rms||0,0,1)};
  });
  // A small median removes isolated octave/pitch glitches without bridging a rest.
  const original=prepared.map(f=>({...f}));
  for(let i=0;i<prepared.length;i++)if(prepared[i].voiced){
   const group=original.slice(Math.max(0,i-1),Math.min(original.length,i+2));
   if(group.length===3&&group.every(f=>f.voiced)&&group[2].start-group[0].start<hop*3){
    prepared[i].smooth=median(group.map(f=>f.midi));
    prepared[i].chosen=median(group.map(f=>f.chosen));
   }else prepared[i].smooth=prepared[i].midi;
  }
  const segments=[];let active=null,pending=null,silence=null,lastEnd=null;
  const finish=end=>{if(active){active.end=Math.max(active.start,end);if(active.end-active.start>=o.minDuration-1e-8)segments.push(active);}active=null;pending=null;silence=null;};
  const begin=f=>({midi:f.chosen,start:f.start,end:f.end,power:[f.rms]});
  for(const f of prepared){
   if(lastEnd!==null&&f.start-lastEnd>=restGap)finish(lastEnd);lastEnd=f.end;
   if(!f.voiced){if(active){if(silence===null)silence=f.start;if(f.end-silence>=restGap-1e-8)finish(silence);}continue;}
   if(!active){active=begin(f);continue;}
   silence=null;
   // Require a distinct pitch to be appreciably closer before switching: small
   // vibrato around a tuning boundary should not chatter between two notes.
   const hold=f.chosen===active.midi||Math.abs(f.smooth-active.midi)-Math.abs(f.smooth-f.chosen)<.18;
   if(hold){active.end=f.end;active.power.push(f.rms);pending=null;continue;}
   if(!pending||pending.midi!==f.chosen)pending=begin(f);else{pending.end=f.end;pending.power.push(f.rms);}
   active.end=f.end;
   if(pending.end-pending.start>=stableTime-1e-8){const next=pending;finish(next.start);active=next;}
  }
  finish(silence===null?(active?.end||0):silence);
  const beatScale=o.bpm/60,q=o.quantize,notes=[];
  for(const s of segments){
   const start=round(q?Math.round(s.start*beatScale/q)*q:s.start*beatScale),end=round(q?Math.round(s.end*beatScale/q)*q:s.end*beatScale);
   const duration=round(Math.max(q||1/960,end-start));
   const n={start,duration,midi:s.midi,velocity:round(clamp(.35+Math.sqrt(median(s.power))*.9,.35,.95))};
   const previous=notes.at(-1);
   if(previous&&previous.start===start){if(previous.midi===n.midi)previous.duration=Math.max(previous.duration,n.duration);continue;}
   if(previous&&previous.start+previous.duration>start)previous.duration=round(start-previous.start);
   notes.push(n);
  }
  return notes;
 }
 const api={convert};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HumPhrase=api;
})(typeof globalThis!=='undefined'?globalThis:this);
