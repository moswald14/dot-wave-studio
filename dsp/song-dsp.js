(function(root){
 'use strict';
 const FX=typeof module!=='undefined'&&module.exports?require('./effects-dsp.js'):root.EffectsDSP;
 const S=typeof module!=='undefined'&&module.exports?require('./studio-dsp.js'):root.StudioDSP;
 const D=typeof module!=='undefined'&&module.exports?require('./drum-dsp.js'):root.DrumDSP;
 const Sample=typeof module!=='undefined'&&module.exports?require('./sampler-dsp.js'):root.SamplerDSP;
 if(!S||!D)throw new Error('SongDSP needs StudioDSP and DrumDSP.');
 const C=typeof module!=='undefined'&&module.exports?require('./clip-dsp.js'):root.ClipDSP;
 const MAX_NOTES=10000,MAX_BEATS=320,DRUM_NOTES={kick:36,snare:38,hat:42,perc:75};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function number(v,a,b,label){if(typeof v!=='number'||!Number.isFinite(v)||v<a||v>b)throw new Error(`Invalid ${label}.`);return v;}
 function integer(v,a,b,label){number(v,a,b,label);if(!Number.isInteger(v))throw new Error(`Invalid ${label}.`);return v;}
 function text(v,max,label){if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error(`Invalid ${label}.`);return v.trim();}
 function id(v,label){if(typeof v!=='string'||!/^[a-zA-Z0-9_-]{1,90}$/.test(v))throw new Error(`Invalid ${label}.`);return v;}
 function flag(v,label){if(typeof v!=='boolean')throw new Error(`Invalid ${label}.`);return v;}
 function list(v,max,label){if(!Array.isArray(v)||v.length>max)throw new Error(`Invalid ${label}.`);return Array.from(v);}
 function meter(value={numerator:4,denominator:4}){
  if(!value||!Number.isInteger(value.numerator)||!Number.isInteger(value.denominator)||!['3/4','4/4','5/4','6/8','7/8'].includes(`${value.numerator}/${value.denominator}`))throw new Error('Choose 3/4, 4/4, 5/4, 6/8, or 7/8.');
  return {numerator:value.numerator,denominator:value.denominator};
 }
 function beatsPerBar(value){const m=meter(value);return m.numerator*4/m.denominator;}
 function midiFrequency(note){integer(note,0,127,'MIDI note');return 440*2**((note-69)/12);}
 function noteName(note){integer(note,0,127,'MIDI note');return ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][note%12]+(Math.floor(note/12)-1);}
 function defaultSong(){return {name:'My pixel song',bpm:110,bars:16,meter:{numerator:4,denominator:4},loop:{start:0,end:16},tracks:[{id:'lead',name:'Lead',instrument:'piano',...C.controls({volume:.7}),notes:[]},{id:'bass',name:'Bass',instrument:'stock-sine',...C.controls({volume:.65}),notes:[]},{id:'pad',name:'Pad',instrument:'stock-triangle',...C.controls({volume:.5}),notes:[]}],beats:[],clips:[],audio:[],waves:[]};}
 function signalAt(signals,key){return signals instanceof Map?signals.get(key):signals&&Object.hasOwn(signals,key)?signals[key]:undefined;}
 function unique(values,label){if(new Set(values.map(v=>v.id)).size!==values.length)throw new Error(`Duplicate ${label} IDs.`);}
 function checkedNote(note){if(!note||typeof note!=='object')throw new Error('Invalid piano note.');return {start:number(note.start,0,MAX_BEATS,'note start'),duration:number(note.duration,1/960,64,'note length'),midi:integer(note.midi,0,127,'MIDI note'),velocity:number(note.velocity,0,1,'note velocity')};}
 function validateSong(value,signals){
  if(!value||typeof value!=='object')throw new Error('Choose a continuityLAB song.');
  const bars=integer(value.bars,1,64,'song measures'),m=meter(value.meter),loop=value.loop;
  if(!loop||!Number.isInteger(loop.start)||!Number.isInteger(loop.end)||loop.start<0||loop.end>bars||loop.start>=loop.end)throw new Error('The loop needs a start measure before its end measure.');
  let count=0,phraseCount=0;const phraseIds=new Set();
  const tracks=list(value.tracks,8,'song tracks').map(track=>{
   if(!track||typeof track!=='object')throw new Error('Invalid song track.');
   const notes=list(track.notes,MAX_NOTES,'piano notes').map(checkedNote);count+=notes.length;if(count>MAX_NOTES)throw new Error('A song can hold at most 10,000 notes.');
   const instrument=['piano','drums'].includes(track.instrument)?track.instrument:id(track.instrument,'waveform instrument');
   if(signals&&!['piano','drums'].includes(instrument)&&!signalAt(signals,instrument))throw new Error(`Missing waveform for ${track.name||'a song track'}.`);
   if(signals&&instrument==='drums')for(const key of ['stock-sine','stock-triangle','stock-square'])if(!signalAt(signals,key))throw new Error('The pocket drums need the built-in waveform library.');
   const phrases=list(track.phrases??[],128,'melody pattern clips').map(c=>{
    if(!c||typeof c!=='object')throw Error('Invalid melody pattern clip.');
    const clipId=id(c.id,'pattern clip ID'),duration=number(c.duration,1/64,64,'pattern length'),repeats=integer(c.repeats,1,64,'pattern repeats'),start=number(c.start,0,MAX_BEATS,'pattern start'),local=list(c.notes,2048,'pattern notes').map(checkedNote);
    if(!local.length||local.some(n=>n.start+n.duration>duration+1e-8)||start+duration*repeats>MAX_BEATS+1e-8)throw Error('Pattern notes or repeats exceed the allowed length.');
    if(phraseIds.has(clipId)||++phraseCount>128)throw Error('Keep unique pattern clips within the 128-clip limit.');phraseIds.add(clipId);count+=local.length*repeats;if(count>MAX_NOTES)throw Error('A song can hold at most 10,000 notes, including pattern repeats.');
    return {id:clipId,name:text(c.name,48,'pattern name'),sourceId:id(c.sourceId||clipId,'pattern source ID'),start,duration,repeats,notes:local,...C.controls(c)};
   });
   return {id:id(track.id,'track ID'),name:text(track.name,48,'track name'),instrument,...C.controls(track),room:number(track.room??0,0,.6,'track room'),notes,...(phrases.length?{phrases}:{})};
  });unique(tracks,'track');
  const beats=list(value.beats??[],16,'saved beats').map(beat=>{
   if(!beat||typeof beat!=='object')throw new Error('Invalid saved beat.');
   const pattern=D.validatePattern(beat.pattern);
   // Older beatMAP projects had no meter/bars fields and exactly16 steps.
   pattern.meter=meter(pattern.meter);pattern.bars=pattern.bars??1;
   if(signals)for(const track of D.allTracks(pattern))if(!signalAt(signals,track.waveId))throw new Error(`Missing waveform for ${track.name}.`);
   return {id:id(beat.id,'beat ID'),name:text(beat.name,48,'beat name'),pattern,volume:number(beat.volume??1,0,1,'beat volume')};
  });unique(beats,'beat');
  const clips=list(value.clips??[],128,'beat placements').map(clip=>{if(!clip||typeof clip!=='object')throw new Error('Invalid beat placement.');const beatId=id(clip.beatId,'saved beat ID');if(!beats.some(b=>b.id===beatId))throw new Error('A placed beat is missing from the saved beats.');return {id:id(clip.id,'placement ID'),beatId,start:number(clip.start,0,MAX_BEATS,'beat position'),...C.controls(clip)};});unique(clips,'placement');
  let audioSeconds=0;
  const audio=list(value.audio??[],8,'audio clips').map(clip=>{
   if(!clip||typeof clip!=='object')throw new Error('Invalid audio clip.');
   const rate=integer(clip.rate,8000,192000,'audio sample rate'),samples=clip.samples;
   if(!(Array.isArray(samples)||ArrayBuffer.isView(samples))||!Number.isInteger(samples.length)||samples.length<1||samples.length>rate*60)throw new Error('Each imported audio clip must be at most 60 seconds.');
   audioSeconds+=samples.length/rate;if(audioSeconds>60.00001)throw new Error('Imported audio can total at most 60 seconds.');
   const copy=new Float32Array(samples.length);for(let i=0;i<samples.length;i++)copy[i]=number(samples[i],-1,1,'audio sample');
   return {id:id(clip.id,'audio ID'),name:text(clip.name,64,'audio clip name'),start:number(clip.start,0,MAX_BEATS,'audio position'),...C.controls(clip),rate,samples:copy};
  });unique(audio,'audio');
  const waves=list(value.waves??[],128,'waveform clips').map(v=>({...C.wave(v),id:id(v.id,'wave clip ID'),name:text(v.name,64,'wave clip name')}));unique(waves,'wave clip');
  return {name:text(value.name,64,'song name'),bpm:number(value.bpm,40,240,'song tempo'),bars,meter:m,loop:{start:loop.start,end:loop.end},tracks,beats,clips,audio,waves};
 }
 function checkedRate(rate){return integer(rate,8000,192000,'render sample rate');}
 function drumVoice(midi){const index=[35,36].includes(midi)?0:[38,40].includes(midi)?1:[42,44,46].includes(midi)?2:3;return D.defaultTracks()[index];}
 function sourceTable(signal,frequency,rate){
  if(!signal||!signal.real||!signal.imag||signal.real.length!==signal.imag.length||signal.real.length<2||signal.real.length>S.HARMONICS)throw new Error('This instrument needs a saved waveform.');
  const real=Float32Array.from(signal.real),imag=Float32Array.from(signal.imag);
  for(const terms of [real,imag])for(const value of terms)number(value,-16,16,'waveform coefficient');real[0]=0;imag[0]=0;
  const table=S.reconstruct(real,imag,Math.floor(rate*.45/frequency)),peak=S.peakOf(table);
  if(peak>1)for(let i=0;i<table.length;i++)table[i]/=peak;
  return table;
 }
 function roomEffects(room=0){number(room,0,.6,'room amount');return room?[{type:'reverb',mix:room,size:1.7,decay:.7}]:[];}
 function roomAudio(samples,rate,room){return room?FX.process(samples,rate,roomEffects(room),{tail:true}):samples;}
 function renderNote(instrument,signal,note,{rate=44100,bpm=110,pitch=0,room=0}={}){
  checkedRate(rate);number(bpm,40,240,'note tempo');const n=checkedNote({start:0,...note}),frequency=midiFrequency(n.midi)*2**(number(pitch,-24,24,'pitch')/12);
  roomEffects(room);
  if(signal?.kind==='sampled-instrument')return roomAudio(Sample.render(signal,n,{rate,bpm,pitch}),rate,room);
  if(signal?.patchTone&&instrument!=='drums'){const Patch=typeof module!=='undefined'&&module.exports?require('./patch-tone.js'):root.PatchTone;return roomAudio(Patch.renderNote(signal.patchTone,n,{rate,bpm,pitch}),rate,room);}
  if(instrument==='drums'){const voice=drumVoice(n.midi);voice.pitch=clamp(voice.pitch*2**(pitch/12),30,2000);const hit=D.renderHit(signal,voice,rate);if(n.velocity!==1)for(let i=0;i<hit.length;i++)hit[i]*=n.velocity;return roomAudio(hit,rate,room);}
  const hold=n.duration*60/bpm,release=instrument==='piano'?.12:.08,frames=Math.max(2,Math.round((hold+release)*rate)),output=new Float32Array(frames);
  if(n.velocity===0||frequency>rate*.45)return output;
  let table,bright;
  if(instrument==='piano'){
   const real=new Float32Array(S.HARMONICS),imag=new Float32Array(S.HARMONICS);imag[1]=.8;table=S.reconstruct(real,imag,Math.floor(rate*.45/frequency));imag[1]=0;imag[2]=.22;imag[3]=.1;imag[5]=.04;bright=S.reconstruct(real,imag,Math.floor(rate*.45/frequency));
  }else table=sourceTable(signal,frequency,rate);
  // Raised-cosine edges have zero slope at both ends. The old 4 ms linear
  // attack made low notes and stacked piano voices start with an audible tick.
  // Keep note times/durations unchanged; only soften the amplitude transition.
  const attack=instrument==='piano'?.012:.01,ease=x=>.5-.5*Math.cos(Math.PI*clamp(x,0,1));let phase=0;
  for(let i=0;i<frames;i++){
   const t=i/rate,gate=t<=hold?1:ease(1-(t-hold)/release),onset=ease(t/attack);
   const sustain=instrument==='piano'?Math.exp(-1.8*t):.72+.28*Math.exp(-12*t);
   const sample=S.sample(table,phase)+(bright?S.sample(bright,phase)*Math.exp(-4*t):0);
   output[i]=sample*onset*gate*sustain*n.velocity*.65;
   phase=(phase+frequency/rate)%1;
  }
  output[0]=0;output[frames-1]=0;return roomAudio(FX.process(output,rate,signal?.effects,{tail:true}),rate,room);
 }
 function patternEvents(beat,clipStart){
  const pattern=beat.pattern,steps=pattern.tracks[0].steps.length,stepsInBar=beatsPerBar(pattern.meter)*4,result=[];let at=clipStart;
  for(let i=0;i<steps;i++){
   for(const track of D.allTracks(pattern))if(!track.mute&&track.steps[i]>0)for(const event of D.hitEvents(track,i,.25*(i%2===0?1+pattern.swing:1-pattern.swing)))result.push({track:event.track,start:at+event.offset,velocity:event.velocity,gate:event.gate,volume:beat.volume});
   const local=i%stepsInBar;at+=.25*(local%2===0?1+pattern.swing:1-pattern.swing);
  }
  return result;
 }
 function expandedTracks(song){return song.tracks.flatMap((t,channel)=>[{...t,channel},...(t.phrases||[]).map(c=>({...t,...C.controls(c),volume:t.volume*c.volume,mute:t.mute||c.mute,pitch:clamp(t.pitch+c.pitch,-24,24),pan:clamp(t.pan+c.pan,-1,1),id:c.id,parentId:t.id,name:c.name,channel,range:{start:c.start,duration:c.duration*c.repeats},notes:Array.from({length:c.repeats},(_,i)=>c.notes.map(n=>({...n,start:c.start+i*c.duration+n.start}))).flat()}))]);}
 function render(value,signals,{rate=44100,loopOnly=false,stem=null,gain=.7,loopTails=true,normalize=false}={}){
  checkedRate(rate);number(gain,0,1,'song render gain');flag(loopOnly,'loop selection');flag(loopTails,'loop tails');flag(normalize,'normalization');
  const song=validateSong(value,signals),barBeats=beatsPerBar(song.meter),from=loopOnly?song.loop.start*barBeats:0,to=loopOnly?song.loop.end*barBeats:song.bars*barBeats,secondsPerBeat=60/song.bpm,duration=(to-from)*secondsPerBeat;
  if(duration>300)throw new Error('Render at most five minutes at a time. Shorten the song or select a smaller loop.');
  if(stem&&(!['notes','drums','audio','wave'].includes(stem.type)||(stem.type==='notes'&&!song.tracks.some(t=>t.id===stem.id))||(stem.type==='audio'&&!song.audio.some(t=>t.id===stem.id))||(stem.type==='wave'&&!song.waves.some(t=>t.id===stem.id))))throw new Error('Choose an existing song track to export.');
  const frames=Math.max(1,Math.round(duration*rate)),samples=new Float32Array(frames),left=new Float32Array(frames),right=new Float32Array(frames),noteCache=new Map(),hitCache=new Map();let cachedNoteFrames=0,workFrames=0;
  function add(buffer,start,level,wrap=true,fx={},range=null){
   const at=Math.round((start-from)*secondsPerBeat*rate),first=Math.max(0,-at);
   if(at>=frames||first>=buffer.length)return;
   const limit=wrap&&loopTails&&at>=0?buffer.length:Math.min(buffer.length,frames-at);
   workFrames+=Math.max(0,limit-first);if(workFrames>rate*3600)throw new Error('Too many overlapping sounds for one render. Shorten the selected loop or simplify the arrangement.');
   const [l,r]=C.balance(fx.pan||0),control=C.controls(fx);
   for(let i=first;i<limit;i++){const pos=(at+i)%frames,local=start+i/rate/secondsPerBeat-(range?.start??start),fade=range&&(control.fadeIn>0||control.fadeOut>0)?Math.max(0,Math.min(1,control.fadeIn?local/control.fadeIn:1,control.fadeOut?(range.duration-local)/control.fadeOut:1)):1,v=buffer[i]*level*gain*fade;left[pos]+=v*l;right[pos]+=v*r;}

  }
  if(!stem||stem.type==='notes')for(const track of expandedTracks(song)){
   if(track.mute||track.volume===0||stem&&stem.id!==(track.parentId||track.id))continue;
   const fromNote=Math.min(...track.notes.map(x=>x.start)),toNote=Math.max(...track.notes.map(x=>x.start+x.duration));
   for(const n of track.notes){
    const effectWave=signalAt(signals,track.instrument==='drums'?drumVoice(n.midi).waveId:track.instrument),effectTail=(FX.tail(effectWave?.effects)+FX.tail(roomEffects(track.room)))/secondsPerBeat;
    const audibleBeats=(track.instrument==='drums'?drumVoice(n.midi).decay/secondsPerBeat:n.duration+(effectWave?.sampled?.release??.12)/secondsPerBeat)+effectTail;
    if(n.start>=to||n.start+audibleBeats<=from||n.velocity===0)continue;
    const durationBeats=Math.max(1/960,Math.min(n.duration,to-n.start)),key=JSON.stringify([track.instrument,n.midi,durationBeats,n.velocity,track.pitch,track.room]);
    let buffer=noteCache.get(key);if(!buffer){const waveId=track.instrument==='drums'?drumVoice(n.midi).waveId:track.instrument;buffer=renderNote(track.instrument,signalAt(signals,waveId),{...n,duration:durationBeats},{rate,bpm:song.bpm,pitch:track.pitch,room:track.room});if(noteCache.size<64&&cachedNoteFrames+buffer.length<=rate*30){noteCache.set(key,buffer);cachedNoteFrames+=buffer.length;}}
    add(buffer,n.start,track.volume,true,track,track.range||{start:fromNote,duration:toNote-fromNote+.12/secondsPerBeat});
   }
  }
  if(!stem||stem.type==='drums')for(const clip of song.clips){
   if(clip.start>=to||clip.mute)continue;const beat=song.beats.find(b=>b.id===clip.beatId);
   for(const event of patternEvents(beat,clip.start)){
    if(event.start>=to||event.start+(event.track.decay+FX.tail(signalAt(signals,event.track.waveId)?.effects))/secondsPerBeat<=from)continue;
    const track={...event.track,pitch:Math.max(30,Math.min(2000,event.track.pitch*2**(clip.pitch/12)))},key=JSON.stringify([track.id,track.waveId,track.pitch,track.decay,track.sweep,track.noise,track.tone,track.level]);
    let buffer=hitCache.get(key);if(!buffer){buffer=D.renderHit(signalAt(signals,track.waveId),track,rate);hitCache.set(key,buffer);}
    add(buffer,event.start,event.velocity*event.volume*clip.volume,true,clip,{start:clip.start,duration:beat.pattern.bars*beatsPerBar(beat.pattern.meter)});
   }
  }
  if(!stem||stem.type==='audio')for(const clip of song.audio){
   if(clip.mute||clip.volume===0||stem&&stem.id!==clip.id)continue;
   const at=(clip.start-from)*secondsPerBeat*rate,speed=2**(clip.pitch/12),length=clip.samples.length/clip.rate*rate/speed,start=Math.max(0,Math.ceil(at)),end=Math.min(frames,Math.ceil(at+length)),edge=Math.max(1,Math.round(rate*.003));
   for(let i=start;i<end;i++){
    const source=(i-at)*clip.rate/rate*speed,index=Math.floor(source),fraction=source-index;
    const value=clip.samples[index]*(1-fraction)+(clip.samples[Math.min(index+1,clip.samples.length-1)]||0)*fraction;
    const fade=Math.min(1,(i-start)/edge,(end-1-i)/edge);
    const e=C.envelope((i-at)/rate/secondsPerBeat,length/rate/secondsPerBeat,clip,rate,song.bpm),[l,r]=C.balance(clip.pan),v=value*clip.volume*gain*fade*e;left[i]+=v*l;right[i]+=v*r;
   }
  }
  if(!stem||stem.type==='wave')for(const c of song.waves){if(c.mute||c.volume===0||c.start>=to||c.start+c.duration<=from||stem&&stem.id!==c.id)continue;add(C.renderWave(c,{rate,bpm:song.bpm}),c.start,c.volume,false,c);}
  // A finite export may end while a held note/FX tail is still nonzero. Apply
  // a five-millisecond boundary taper instead of cutting straight to silence.
  // Exact loops keep their wrapped tails; fading them would create a gap.
  if(!loopTails){const edge=Math.min(Math.ceil(rate*.005),Math.floor(frames/2));for(let i=0;i<edge;i++){const level=.5-.5*Math.cos(Math.PI*i/edge);left[i]*=level;right[i]*=level;left[frames-1-i]*=level;right[frames-1-i]*=level;}}
  for(let i=0;i<frames;i++)samples[i]=(left[i]+right[i])/2;
  const peak=Math.max(S.peakOf(left),S.peakOf(right)),scale=peak>.98?.98/peak:1;
  if(normalize&&scale!==1)for(let i=0;i<samples.length;i++){samples[i]*=scale;left[i]*=scale;right[i]*=scale;}
  return {samples,left,right,rate,duration:frames/rate,peak,scale,normalized:normalize,startBeat:from,endBeat:to};
 }
 function toMidi(value,{loopOnly=false}={}){
  const song=validateSong(value),bar=beatsPerBar(song.meter),from=loopOnly?song.loop.start*bar:0,to=loopOnly?song.loop.end*bar:song.bars*bar,tracks=[],noteTracks=new Map();
  for(const track of expandedTracks(song)){
   if(track.mute)continue;
   const notes=[];for(const note of track.notes){const start=Math.max(from,note.start),end=Math.min(to,note.start+note.duration);if(end>start&&note.velocity*track.volume>0)notes.push({...note,midi:clamp(Math.round(note.midi+track.pitch),0,127),start:start-from,duration:end-start,velocity:note.velocity*track.volume});}
   const key=track.parentId||track.id;if(noteTracks.has(key))noteTracks.get(key).notes.push(...notes);else{const out={name:track.name,channel:track.instrument==='drums'?9:track.channel,program:track.instrument==='drums'?undefined:track.instrument==='piano'?0:Sample.program(track.instrument)??80,notes};noteTracks.set(key,out);tracks.push(out);}
  }
  const drums=[];for(const clip of song.clips){if(clip.start>=to||clip.mute)continue;const beat=song.beats.find(b=>b.id===clip.beatId);for(const event of patternEvents(beat,clip.start))if(event.start>=from&&event.start<to&&event.velocity*event.volume*event.track.level*clip.volume>0)drums.push({start:event.start-from,duration:Math.min(.125,event.gate??.125,to-event.start),midi:DRUM_NOTES[event.track.id]??DRUM_NOTES[["kick","snare","hat","perc"][D.PAD_MAP[+event.track.id.slice(4)]?.track]]??75,velocity:event.velocity*event.volume*event.track.level*clip.volume});}
  if(drums.length)tracks.push({name:'Drums',channel:9,notes:drums});
  for(const t of tracks)t.notes.sort((a,b)=>a.start-b.start||a.midi-b.midi);return {bpm:song.bpm,meter:{...song.meter},duration:to-from,tracks};
 }
 const api={MAX_NOTES,MAX_BEATS,DRUM_NOTES,defaultSong,validateSong,beatsPerBar,midiFrequency,noteName,drumVoice,renderNote,render,toMidi};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SongDSP=api;
})(typeof globalThis!=='undefined'?globalThis:this);
