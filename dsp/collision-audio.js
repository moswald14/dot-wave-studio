(function(root){
 'use strict';
 const D=typeof module!=='undefined'&&module.exports?require('./studio-dsp.js'):root.StudioDSP;
 const Tone=typeof module!=='undefined'&&module.exports?require('./amp-tone.js'):root.AmpTone;
 if(!D)throw new Error('CollisionAudio needs StudioDSP.');
 const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
 function finite(value,low,high,label){if(typeof value!=='number'||!Number.isFinite(value)||value<low||value>high)throw new Error(`Invalid ${label}.`);return value;}
 function validatePair(pair,rate=48000){
  finite(rate,8000,192000,'audio sample rate');
  if(!pair||typeof pair!=='object')throw new Error('Choose two waveform pitches.');
  const max=Math.min(20000,rate*.45);
  return {a:finite(pair.a,20,max,'Wave A pitch'),b:finite(pair.b,20,max,'Wave B pitch')};
 }
 function checkProject(project){
  if(!project||!D.MODES.includes(project.mode))throw new Error('Invalid collision mode.');
  finite(project.amount,0,1,'collision amount');
  if(typeof project.normalize!=='boolean')throw new Error('Invalid normalization setting.');
  for(const id of ['a','b']){
   const voice=project[id];
   if(!voice||!Array.isArray(voice.points)||voice.points.length!==D.STEPS||Array.from(voice.points).some(v=>typeof v!=='number'||!Number.isFinite(v)||v< -1||v>1))throw new Error(`Wave ${id.toUpperCase()} needs 32 finite points.`);
   finite(voice.level,0,1,'wave level');finite(voice.phase,0,360,'wave phase');
   if(typeof voice.inverted!=='boolean')throw new Error('Invalid waveform inversion.');
  }
 }
 function source(voice,frequency,rate){
  const original=D.analyse(D.renderSource({...voice,ratio:1}));
  const real=Float32Array.from(original.real),imag=Float32Array.from(original.imag);
  const limit=Math.floor(rate*.45/frequency);
  for(let n=limit+1;n<real.length;n++){real[n]=0;imag[n]=0;}
  let table=D.reconstruct(real,imag),peak=D.peakOf(table);
  // Truncating a sharp spectrum can slightly increase its peak. Keep both the
  // real oscillator and the PCM renderer inside the same unit source bound.
  if(peak>1){for(let n=1;n<real.length;n++){real[n]/=peak;imag[n]/=peak;}table=D.reconstruct(real,imag);peak=D.peakOf(table);}
  return {real,imag,table,peak};
 }
 function bound(project,a,b){
  const mix=project.amount;
  if(project.mode==='multiply')return a*(1-mix)+a*b*mix;
  if(project.mode==='fold')return Math.min(1,(a+b)*.5*(1+3*mix));
  return a*(1-mix)+b*mix;
 }
 function prepare(project,pair,rate){
  checkProject(project);pair=validatePair(pair,rate);
  const a=source(project.a,pair.a,rate),b=source(project.b,pair.b,rate),peakBound=bound(project,a.peak,b.peak);
  // Different pitches need not share a short period. Normalize against a
  // conservative bound, not a short observation that could miss later peaks.
  const scale=project.normalize&&peakBound>1e-6?1/peakBound:1;
  return {a,b,pair,scale,peakBound};
 }
 function mixed(a,b,project){
  const m=project.amount;
  if(project.mode==='subtract')return a*(1-m)-b*m;
  if(project.mode==='multiply')return a*(1-m)+a*b*m;
  if(project.mode==='fold')return D.fold((a+b)*.5*(1+3*m));
  return a*(1-m)+b*m;
 }
 function targetValue(a,b,project,prepared,target){return target==='a'?a:target==='b'?b:D.ampSample(mixed(a,b,project)*prepared.scale,project.amp);}
 function selectedTarget(value){if(!['result','a','b'].includes(value))throw new Error('Invalid listening target.');return value;}
 function preview(project,pair,{rate=48000,offset=0}={}){
  finite(offset,0,1e9,'preview time');
  const p=prepare(project,pair,rate),duration=Math.min(2/Math.min(p.pair.a,p.pair.b),64/Math.max(p.pair.a,p.pair.b));
  const raw={a:new Float64Array(D.SIZE),b:new Float64Array(D.SIZE),result:new Float64Array(D.SIZE)};
  for(let i=0;i<D.SIZE;i++){
   const time=offset+i/D.SIZE*duration;
   raw.a[i]=D.sample(p.a.table,time*p.pair.a);raw.b[i]=D.sample(p.b.table,time*p.pair.b);
   raw.result[i]=D.ampSample(mixed(raw.a[i],raw.b[i],project)*p.scale,project.amp);
  }
  function signal(table){
   // Coefficients describe a centered, repeating snapshot for the wave library;
   // the graph's table is the actual time window, including any nonzero mean.
   const snapshot=D.analyse(table);let energy=0;for(const value of table)energy+=value*value;
   return {...snapshot,table,peak:D.peakOf(table),rms:Math.sqrt(energy/table.length)};
  }
  return {a:signal(raw.a),b:signal(raw.b),result:signal(Tone.cycle(raw.result,1/duration,project.amp)),duration,frequency:1/duration,scale:p.scale};
 }
 function render(project,pair,{rate=48000,duration=2,gain=1,inverted=false,target='result',fade=.015}={}){
  finite(duration,.001,30,'render duration');finite(gain,0,1,'render gain');finite(fade,0,1,'fade length');
  if(typeof inverted!=='boolean')throw new Error('Invalid output inversion.');
  target=selectedTarget(target);const p=prepare(project,pair,rate),frames=Math.max(1,Math.round(rate*duration)),result=new Float32Array(frames),tone=Tone.processor(rate,target==='result'?project.amp:null);
  for(let i=0;i<frames;i++){
   const time=i/rate,a=D.sample(p.a.table,time*p.pair.a),b=D.sample(p.b.table,time*p.pair.b);
   const envelope=fade===0?1:Math.min(1,i/(rate*fade),(frames-1-i)/(rate*fade));
   result[i]=clamp(tone(targetValue(a,b,project,p,target))*gain*(inverted?-1:1)*envelope,-1,1);
  }
  return result;
 }
 function encodeWav(samples,rate=48000){
  finite(rate,8000,192000,'WAV sample rate');
  if(!Number.isInteger(rate)||!samples||!Number.isInteger(samples.length)||samples.length<1||samples.length>rate*30)throw new Error('Invalid WAV samples.');
  const buffer=new ArrayBuffer(44+samples.length*2),view=new DataView(buffer);
  const write=(at,text)=>{for(let i=0;i<text.length;i++)view.setUint8(at+i,text.charCodeAt(i));};
  write(0,'RIFF');view.setUint32(4,buffer.byteLength-8,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++){finite(samples[i],-1,1,'WAV sample');view.setInt16(44+i*2,Math.round(samples[i]*32767),true);}
  return buffer;
 }
 function create(context,project,pair,destination,{target='result',at=context.currentTime}={}){
  target=selectedTarget(target);finite(at,0,1e12,'oscillator start time');
  const p=prepare(project,pair,context.sampleRate),nodes=[],oscs=[];
  const gain=value=>{const node=context.createGain();node.gain.value=value;nodes.push(node);return node;};
  let ended=0,stopped=false,disconnected=false;
  function disconnect(){if(disconnected)return;disconnected=true;for(const node of nodes){try{node.disconnect();}catch(error){/* Node already detached. */}}}
  function stop(time=context.currentTime){if(stopped)return;stopped=true;for(const osc of oscs){try{osc.stop(time);}catch(error){/* Oscillator already ended. */}}}
  try{
   for(const id of ['a','b']){
    const osc=context.createOscillator();nodes.push(osc);oscs.push(osc);
    osc.setPeriodicWave(context.createPeriodicWave(p[id].real,p[id].imag,{disableNormalization:true}));osc.frequency.value=p.pair[id];
    osc.onended=()=>{if(++ended===oscs.length)disconnect();};
   }
   const [a,b]=oscs,output=gain(target==='result'?p.scale:1);if(target==='result'&&project.amp?.enabled){const amp=context.createWaveShaper(),curve=new Float32Array(4097);nodes.push(amp);for(let i=0;i<curve.length;i++)curve[i]=D.ampSample(i/(curve.length-1)*2-1,project.amp);amp.curve=curve;amp.oversample='4x';output.connect(amp);nodes.push(...Tone.connect(context,amp,destination,project.amp));}else output.connect(destination);
   if(target==='a')a.connect(output);
   else if(target==='b')b.connect(output);
   else if(project.mode==='multiply'){
    const dry=gain(1-project.amount),multiply=gain(0),wet=gain(project.amount);
    a.connect(dry);dry.connect(output);a.connect(multiply);b.connect(multiply.gain);multiply.connect(wet);wet.connect(output);
   }else if(project.mode==='fold'){
    const sum=gain(.5),fold=context.createWaveShaper(),curve=new Float32Array(4097);nodes.push(fold);
    const drive=1+3*project.amount;
    for(let i=0;i<curve.length;i++)curve[i]=D.fold((i/(curve.length-1)*2-1)*drive);
    fold.curve=curve;fold.oversample='4x';a.connect(sum);b.connect(sum);sum.connect(fold);fold.connect(output);
   }else{
    const ga=gain(1-project.amount),gb=gain(project.amount*(project.mode==='subtract'?-1:1));
    a.connect(ga);b.connect(gb);ga.connect(output);gb.connect(output);
   }
   a.start(at);b.start(at);
   return {stop,disconnect,nodes,oscs,scale:p.scale,startTime:at};
  }catch(error){stop(context.currentTime);disconnect();throw error;}
 }
 const api={validatePair,prepare,preview,render,encodeWav,create,mix:mixed};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CollisionAudio=api;
})(typeof globalThis!=='undefined'?globalThis:this);
