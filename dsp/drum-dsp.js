(function(root){
 'use strict';
 const FX=typeof module!=='undefined'&&module.exports?require('./effects-dsp.js'):root.EffectsDSP;
 const Studio=typeof module!=='undefined'&&module.exports?require('./studio-dsp.js'):root.StudioDSP;
 if(!Studio)throw new Error('DrumDSP needs StudioDSP.');
 const MODIFIERS=['','up','down','soft','short','long','double','triple','flam','accent'];
 function validateModifiers(value,length){if(value===undefined)return undefined;if(!Array.isArray(value)||value.length!==length||!value.every(v=>MODIFIERS.includes(v)))throw new Error('Invalid hit modifiers.');return [...value];}
 function modifiedTrack(track,step){const m=track.modifiers?.[step]||'';if(!m)return track;return {...track,pitch:clamp(track.pitch*2**((m==='up'?1:m==='down'?-1:0)/12),30,2000),decay:clamp(track.decay*(m==='short'?.65:m==='long'?1.35:1),.03,1.5),level:clamp(track.level*(m==='soft'?.65:m==='accent'?1.25:1),0,1)};}
 function hitEvents(track,step,span=1){const m=track.modifiers?.[step],hits=m==='double'?[[0,1],[.5,.7]]:m==='triple'?[[0,1],[1/3,.8],[2/3,.65]]:m==='flam'?[[0,.45],[.12,1]]:[[0,1]];return hits.map(([at,v],i)=>({offset:at*span,gate:((hits[i+1]?.[0]??1)-at)*span*.85,velocity:track.steps[step]*v,track:modifiedTrack(track,step)}));}
 function resizeModifiers(track,bars,oldCount,newCount){if(!track.modifiers)return {};const modifiers=Array(bars*newCount).fill('');for(let b=0;b<Math.min(bars,track.steps.length/oldCount);b++)for(let i=0;i<Math.min(oldCount,newCount);i++)modifiers[b*newCount+i]=track.modifiers[b*oldCount+i];return {modifiers};}
 const STEPS=16,MAX_TRACKS=8;
 const PAD_MAP={1:{name:'Kick',track:0},2:{name:'Snare',track:1},3:{name:'Hat',track:2},4:{name:'Low tom',track:3,pitch:.65},5:{name:'Perc',track:3},6:{name:'Open hat',track:2,decay:2.5},7:{name:'Soft kick',track:0,velocity:.5},8:{name:'Rim',track:1,decay:.4,pitch:1.5},9:{name:'High perc',track:3,pitch:1.7}};
 function defaultPads(length=16){return Array.from({length:9},(_,i)=>({number:i+1,waveId:null,steps:Array(length).fill(0)}));}
 function validatePads(pads,length){if(pads===undefined)return undefined;if(!Array.isArray(pads)||pads.length!==9)throw new Error('A pad kit needs nine pads.');const seen=new Set();return Array.from(pads,p=>{if(!p||!Number.isInteger(p.number)||p.number<1||p.number>9||seen.has(p.number)||p.waveId!==null&&(typeof p.waveId!=='string'||!/^[a-zA-Z0-9_-]{1,90}$/.test(p.waveId))||!Array.isArray(p.steps)||p.steps.length!==length||!Array.from(p.steps).every(v=>[0,.5,1].includes(v)))throw new Error('Invalid recorded pad.');seen.add(p.number);return {number:p.number,waveId:p.waveId,steps:[...p.steps],...(p.modifiers!==undefined?{modifiers:validateModifiers(p.modifiers,length)}:{})};}).sort((a,b)=>a.number-b.number);}
 function padTrack(pattern,pad){const map=PAD_MAP[pad.number],voice=pattern.tracks[map.track];return {...voice,id:'pad-'+pad.number,name:map.name,waveId:pad.waveId||voice.waveId,pitch:clamp(voice.pitch*(map.pitch||1),30,2000),decay:clamp(voice.decay*(map.decay||1),.03,1.5),noise:pad.waveId?0:voice.noise,steps:pad.steps,modifiers:pad.modifiers};}
 function allTracks(pattern){return [...pattern.tracks,...(pattern.pads||[]).map(p=>padTrack(pattern,p))];}
 function nearestStep(seconds,bpm,swing,length){const stepLength=60/bpm/4,cycle=length*stepLength,local=((seconds%cycle)+cycle)%cycle;let at=0,best=0,distance=Infinity;for(let i=0;i<length;i++){const d=Math.min(Math.abs(local-at),cycle-Math.abs(local-at));if(d<distance){distance=d;best=i;}at+=stepSeconds(bpm,swing,i);}return best;}
 const METERS=[[3,4],[4,4],[5,4],[6,8],[7,8]];
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function number(x,min,max,name){if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)throw new Error(`Invalid ${name}.`);return x;}
 function rateValue(rate){number(rate,8000,192000,'sample rate');if(!Number.isInteger(rate))throw new Error('Sample rate must be an integer.');return rate;}
 function numericArray(value){return (Array.isArray(value)||ArrayBuffer.isView(value))&&Number.isInteger(value.length);}
 function text(value,max,name){if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(`Invalid ${name}.`);return value.trim();}
 function validateMeter(meter={numerator:4,denominator:4}){if(!meter||!METERS.some(([n,d])=>meter.numerator===n&&meter.denominator===d))throw new Error('Choose 3/4, 4/4, 5/4, 6/8, or 7/8 time.');return {numerator:meter.numerator,denominator:meter.denominator};}
 function stepsPerBar(meter){const m=validateMeter(meter);return m.numerator*16/m.denominator;}
 function patternLength(pattern){const count=stepsPerBar(pattern.meter),storedLength=pattern.tracks?.[0]?.steps?.length,bars=pattern.bars??(storedLength===undefined?1:storedLength/count);if(!Number.isInteger(bars)||bars<1||bars>8)throw new Error('A beat needs one to eight measures.');return count*bars;}
 function voiceSettings(track){
  if(!track||typeof track!=='object')throw new Error('Invalid drum voice.');
  return {pitch:number(track.pitch,30,2000,'drum pitch'),decay:number(track.decay,.03,1.5,'drum decay'),sweep:number(track.sweep,0,36,'pitch sweep'),noise:number(track.noise,0,1,'noise amount'),tone:number(track.tone,200,18000,'tone cutoff'),level:number(track.level,0,1,'drum level')};
 }
 function validateTrack(track){
  const voice=voiceSettings(track);
  const id=text(track.id,64,'track id'),name=text(track.name,40,'track name'),waveId=text(track.waveId,100,'waveform id');
  if(typeof track.mute!=='boolean')throw new Error('Invalid track mute.');
  if(!Array.isArray(track.steps)||track.steps.length<12||track.steps.length>160||!Array.from(track.steps).every(v=>v===0||v===.5||v===1))throw new Error('Each track needs valid measure steps with velocities 0, 0.5, or 1.');
  return {id,name,waveId,...voice,mute:track.mute,steps:[...track.steps],...(track.modifiers!==undefined?{modifiers:validateModifiers(track.modifiers,track.steps.length)}:{})};
 }
 function validateBeat(beat){
  if(!beat||!Array.isArray(beat.tracks)||beat.tracks.length<1||beat.tracks.length>MAX_TRACKS)throw new Error('A beat needs one to eight tracks.');
  const tracks=beat.tracks.map(validateTrack);
  if(new Set(tracks.map(t=>t.id)).size!==tracks.length)throw new Error('Track ids must be unique.');
  const meter=validateMeter(beat.meter),length=patternLength({...beat,meter}),bars=length/stepsPerBar(meter);
  if(tracks.some(t=>t.steps.length!==length))throw new Error('Every drum lane must match the measure count and time signature.');
  const pads=validatePads(beat.pads,length);return {bpm:number(beat.bpm,40,240,'tempo'),swing:number(beat.swing,0,.45,'swing'),bars,meter,tracks,...(pads?{pads}:{})};
 }
 function validatePattern(data){
  const beat=validateBeat(data),names={kick:'Kick',snare:'Snare',hat:'Hat',perc:'Perc'};
  if(beat.tracks.length!==4||beat.tracks.some(t=>!Object.hasOwn(names,t.id)||t.name!==names[t.id]))throw new Error('A drum machine pattern needs Kick, Snare, Hat, and Perc tracks.');
  // Always restore the same lane order, even if a JSON file reordered its tracks.
  return {...beat,tracks:Object.keys(names).map(id=>beat.tracks.find(t=>t.id===id))};
 }
 function defaultTracks(){
  const steps=(hits,soft=[])=>Array.from({length:STEPS},(_,i)=>hits.includes(i)?1:soft.includes(i)?.5:0);
  return [
   {id:'kick',name:'Kick',waveId:'stock-sine',pitch:52,decay:.42,sweep:28,noise:0,tone:2200,level:.85,mute:false,steps:steps([0,8],[6,14])},
   {id:'snare',name:'Snare',waveId:'stock-triangle',pitch:185,decay:.2,sweep:5,noise:.7,tone:8500,level:.55,mute:false,steps:steps([4,12])},
   {id:'hat',name:'Hat',waveId:'stock-square',pitch:1200,decay:.065,sweep:0,noise:.95,tone:16000,level:.3,mute:false,steps:steps([2,6,10,14],[0,4,8,12])},
   {id:'perc',name:'Perc',waveId:'stock-triangle',pitch:350,decay:.16,sweep:8,noise:.12,tone:6500,level:.4,mute:false,steps:steps([11],[3,15])}
  ];
 }
 function resizePattern(pattern,options={}){
  const current=validatePattern(pattern),bars=options.bars===undefined?current.bars:options.bars,nextMeter=validateMeter(options.meter===undefined?current.meter:options.meter);if(!Number.isInteger(bars)||bars<1||bars>8)throw new Error('Choose one to eight measures.');
  const oldCount=stepsPerBar(current.meter),newCount=stepsPerBar(nextMeter);
  const tracks=current.tracks.map(track=>{const steps=Array(bars*newCount).fill(0);for(let bar=0;bar<Math.min(bars,current.bars);bar++)for(let step=0;step<Math.min(oldCount,newCount);step++)steps[bar*newCount+step]=track.steps[bar*oldCount+step];return {...track,steps,...resizeModifiers(track,bars,oldCount,newCount)};});
  const pads=current.pads?.map(p=>{const steps=Array(bars*newCount).fill(0);for(let bar=0;bar<Math.min(bars,current.bars);bar++)for(let i=0;i<Math.min(oldCount,newCount);i++)steps[bar*newCount+i]=p.steps[bar*oldCount+i];return {...p,steps,...resizeModifiers(p,bars,oldCount,newCount)};});return {...current,bars,meter:nextMeter,tracks,...(pads?{pads}:{})};
 }
 function signalCoefficients(signal){
  if(!signal||typeof signal!=='object')throw new Error('Choose a saved waveform for this drum.');
  if(signal.real!==undefined||signal.imag!==undefined){
   const a=signal.real,b=signal.imag;
   if(!numericArray(a)||!numericArray(b)||a.length!==b.length||a.length<2||a.length>Studio.HARMONICS)throw new Error('Invalid waveform coefficients.');
   if(!Array.from(a).every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=16)||!Array.from(b).every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=16))throw new Error('Invalid waveform coefficient value.');
   const real=Float32Array.from(a),imag=Float32Array.from(b);real[0]=0;imag[0]=0;return {real,imag};
  }
  const table=signal.table;
  if(!numericArray(table)||table.length<16||table.length>4096||!Array.from(table).every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=16))throw new Error('Invalid waveform table.');
  const resampled=Float64Array.from({length:Studio.SIZE},(_,i)=>Studio.sample(table,i/Studio.SIZE));
  return Studio.coefficients(Studio.centered(resampled));
 }
 function seedFor(track){
  const key=String(track.id||'drum')+'|'+String(track.waveId||'wave');let seed=2166136261;
  for(let i=0;i<key.length;i++){seed^=key.charCodeAt(i);seed=Math.imul(seed,16777619);}
  return seed>>>0||1;
 }
 function renderHit(signal,track,sampleRate=48000){
  const rate=rateValue(sampleRate),voice=voiceSettings(track),frames=Math.max(2,Math.round(voice.decay*rate));
  if(track.mute!==undefined&&typeof track.mute!=='boolean')throw new Error('Invalid track mute.');
  const {real,imag}=signalCoefficients(signal);
  const output=new Float32Array(frames);
  if(track.mute||voice.level===0)return output;
  // The table is limited for the highest point of the pitch sweep, so corners
  // in a custom shape cannot fold back into audible aliases at the attack.
  const highestPitch=voice.pitch*2**(voice.sweep/12);
  const maxHarmonic=Math.max(0,Math.floor(rate*.45/highestPitch));
  const table=Studio.reconstruct(real,imag,maxHarmonic);
  const sourceScale=1/Math.max(1,Studio.peakOf(table));
  // Noise-rich hits need more time to open than tonal kicks. Ease both edges
  // so the first few random samples do not read as an isolated digital crack.
  const attack=Math.min(.006+voice.noise*.006,voice.decay*.18),tail=Math.min(.016,voice.decay*.2),pitchTime=Math.max(.006,voice.decay*.17);
  const cutoff=Math.min(voice.tone,rate*.45),alpha=1-Math.exp(-2*Math.PI*cutoff/rate);
  let phase=0,filtered=0,filteredNoise=0,seed=seedFor(track);
  for(let i=0;i<frames;i++){
   const t=i/rate;
   const pitched=Studio.sample(table,phase)*sourceScale;
   phase=(phase+voice.pitch*2**(voice.sweep*Math.exp(-t/pitchTime)/12)/rate)%1;
   seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
   const noise=(seed>>>0)/4294967295*2-1;
   // A second low-pass pole on noise suppresses the sample-to-sample spikes
   // measured in brush/snare exports, while leaving the tonal wave unchanged.
   filteredNoise+=alpha*(noise-filteredNoise);
   const raw=pitched*(1-voice.noise)+filteredNoise*voice.noise;
   filtered+=alpha*(raw-filtered);
   const ease=x=>.5-.5*Math.cos(Math.PI*Math.min(1,Math.max(0,x)));
   const envelope=ease(t/attack)*Math.exp(-5.5*t/voice.decay)*ease((frames-1-i)/(tail*rate));
   output[i]=clamp(filtered*envelope*voice.level,-1,1);
  }
  output[0]=0;output[frames-1]=0;
  return FX.process(output,rate,signal.effects,{tail:true});
 }
 function stepSeconds(bpm,swing,stepIndex){
  number(bpm,40,240,'tempo');number(swing,0,.45,'swing');
  if(!Number.isInteger(stepIndex)||stepIndex<0)throw new Error('Invalid step index.');
  return 60/bpm/4*(stepIndex%2===0?1+swing:1-swing);
 }
 function renderPattern(signalsById,tracks,{bpm=110,swing=0,bars=2,meter={numerator:4,denominator:4},rate=48000,gain=.5,loop=false,pads}={}){
  const beat=validateBeat({bpm,swing,meter,tracks,pads});rateValue(rate);number(gain,0,1,'render gain');if(typeof loop!=='boolean')throw new Error('Invalid loop export setting.');const voices=allTracks(beat);
  if(!Number.isInteger(bars)||bars<1||bars>8)throw new Error('Render one to eight bars.');
  if(!signalsById||typeof signalsById!=='object')throw new Error('Missing waveform library.');
  const getSignal=id=>signalsById instanceof Map?signalsById.get(id):Object.hasOwn(signalsById,id)?signalsById[id]:undefined;
  const hits=new Map();
  for(const track of voices){
   const signal=getSignal(track.waveId);if(!signal)throw new Error(`Missing waveform for ${track.name}.`);
   hits.set(track.id+':',renderHit(signal,track,rate));
  }
  const events=[];let time=0,lastEnd=0;
  const count=stepsPerBar(beat.meter),patternSteps=patternLength(beat);
  for(let step=0;step<count*bars;step++){
   const frame=Math.round(time*rate);
   for(const track of voices){const velocity=track.steps[step%patternSteps];if(!track.mute&&velocity>0){const variant=track.modifiers?.[step%patternSteps]||'',key=track.id+':'+variant;if(!hits.has(key))hits.set(key,renderHit(getSignal(track.waveId),modifiedTrack(track,step%patternSteps),rate));const hit=hits.get(key);for(const event of hitEvents(track,step%patternSteps,stepSeconds(bpm,swing,step))){const at=frame+Math.round(event.offset*rate);events.push({frame:at,hit,velocity:event.velocity});lastEnd=Math.max(lastEnd,at+hit.length);}}}
   time+=stepSeconds(bpm,swing,step);
  }
  const loopFrames=Math.round(time*rate),samples=new Float32Array(loop?loopFrames:Math.max(loopFrames,lastEnd));
  for(const event of events)for(let i=0;i<event.hit.length;i++)samples[loop?(event.frame+i)%loopFrames:event.frame+i]+=event.hit[i]*event.velocity*gain;
  // Apply one uniform reduction only when a dense pattern needs headroom.
  // This preserves the relative dynamics, and never amplifies quiet material.
  const peak=Studio.peakOf(samples),scale=peak>.98?.98/peak:1;
  if(scale!==1)for(let i=0;i<samples.length;i++)samples[i]*=scale;
  return {samples,rate};
 }
 function encodeWav(samples,rate=48000){
  rateValue(rate);
  if(!numericArray(samples)||samples.length<1||samples.length>rate*120)throw new Error('Invalid WAV sample length.');
  const buffer=new ArrayBuffer(44+samples.length*2),view=new DataView(buffer);
  const write=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
  write(0,'RIFF');view.setUint32(4,36+samples.length*2,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++){if(typeof samples[i]!=='number'||!Number.isFinite(samples[i]))throw new Error('Invalid WAV sample.');view.setInt16(44+i*2,Math.round(clamp(samples[i],-1,1)*32767),true);}
  return buffer;
 }
 const api={MODIFIERS,validateModifiers,modifiedTrack,hitEvents,STEPS,MAX_TRACKS,METERS,PAD_MAP,defaultPads,validatePads,padTrack,allTracks,nearestStep,validateMeter,stepsPerBar,patternLength,resizePattern,defaultTracks,validateTrack,validateBeat,validatePattern,renderHit,stepSeconds,renderPattern,encodeWav};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DrumDSP=api;
})(typeof globalThis!=='undefined'?globalThis:this);
