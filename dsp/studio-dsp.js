(function(root){
 'use strict';
 const FX=typeof module!=='undefined'&&module.exports?require('./effects-dsp.js'):root.EffectsDSP;
 const Tone=typeof module!=='undefined'&&module.exports?require('./amp-tone.js'):root.AmpTone;
 const SIZE=512,STEPS=32,HARMONICS=128;
 const TYPES=['sine','triangle','square','sawtooth','pulse','organ','softsquare','staircase','pluck','hollow','spike'];
 const MODES=['blend','subtract','multiply','fold'];
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const wrap=x=>((x%1)+1)%1;
 const cos=new Float64Array(SIZE*HARMONICS),sin=new Float64Array(SIZE*HARMONICS);
 for(let n=1;n<HARMONICS;n++)for(let i=0;i<SIZE;i++){const phase=2*Math.PI*n*i/SIZE;cos[n*SIZE+i]=Math.cos(phase);sin[n*SIZE+i]=Math.sin(phase);}
 function sample(table,phase){const at=wrap(phase)*table.length,j=Math.floor(at),t=at-j;return table[j]*(1-t)+table[(j+1)%table.length]*t;}
 function preset(type){
  if(!TYPES.includes(type))throw new Error('Unknown waveform shape.');
  return Array.from({length:STEPS},(_,i)=>{const p=i/STEPS,s=Math.sin(2*Math.PI*p);switch(type){
   case 'triangle':return 2/Math.PI*Math.asin(s);
   case 'square':return p<.5?1:-1;
   case 'sawtooth':return 2*(p-Math.floor(p+.5));
   case 'pulse':return p<.25?1:-1/3;
   case 'organ':return (s+.45*Math.sin(4*Math.PI*p)+.18*Math.sin(6*Math.PI*p)+.12*Math.sin(8*Math.PI*p))/1.35;
   case 'softsquare':return Math.tanh(2.5*s)/Math.tanh(2.5);
   case 'staircase':return Math.round(2*(p-Math.floor(p+.5))*4)/4;
   case 'pluck':return s*Math.exp(-3*p);
   case 'hollow':return (s+.5*Math.sin(6*Math.PI*p)+.25*Math.sin(10*Math.PI*p))/1.5;
   case 'spike':return p<.125?1:-1/7;
   default:return s;
  }});
 }
 function source(type='sine'){return {points:preset(type),shape:type,smoothness:0,pins:[],level:1,phase:0,ratio:1,inverted:false};}
 function defaultProject(){return {version:1,a:source('sine'),b:{...source('triangle'),ratio:2},mode:'blend',amount:.5,normalize:false,amp:ampSettings(),effects:[]};}
 function centered(table){const mean=table.reduce((s,v)=>s+v,0)/table.length;return Float64Array.from(table,x=>x-mean);}
 function peakOf(table){let peak=0;for(const x of table)peak=Math.max(peak,Math.abs(x));return peak;}
 function shapePoints(voice){
  const amount=voice.smoothness??0;
  if(typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>1)throw new Error('Smoothness must be between zero and one.');
  let points=Array.from(voice.points),passes=amount*8;
  for(let i=0;i<Math.floor(passes);i++)points=smoothPoints(points);
  const fraction=passes-Math.floor(passes);
  if(fraction){const next=smoothPoints(points);points=points.map((v,i)=>v+(next[i]-v)*fraction);}
  return points;
 }
 function shapeSample(points,phase,amount=0){
  if(amount===0)return sample(points,phase);
  const n=points.length,at=wrap(phase)*n,j=Math.floor(at),t=at-j,a=points[j],b=points[(j+1)%n];
  const before=a-points[(j+n-1)%n],delta=b-a,after=points[(j+2)%n]-b;
  const slope=(x,y)=>x*y>0?2*x*y/(x+y):0,m0=slope(before,delta),m1=slope(delta,after),t2=t*t,t3=t2*t;
  const curved=(2*t3-3*t2+1)*a+(t3-2*t2+t)*m0+(-2*t3+3*t2)*b+(t3-t2)*m1;
  return a+(b-a)*t+(curved-(a+(b-a)*t))*amount;
 }
 function sourceOutline(voice){const points=shapePoints(voice);return Float64Array.from({length:SIZE},(_,i)=>shapeSample(points,i/SIZE,voice.smoothness??0));}
 function renderSource(voice){
  const points=centered(shapePoints(voice)),scale=Math.max(1,peakOf(points));
  const gain=voice.level*(voice.inverted?-1:1)/scale;
  return Float64Array.from({length:SIZE},(_,i)=>shapeSample(points,i/SIZE*voice.ratio+voice.phase/360,voice.smoothness??0)*gain);
 }
 function coefficients(table){
  const real=new Float32Array(HARMONICS),imag=new Float32Array(HARMONICS);
  for(let n=1;n<HARMONICS;n++){let a=0,b=0;for(let i=0;i<SIZE;i++){a+=table[i]*cos[n*SIZE+i];b+=table[i]*sin[n*SIZE+i];}real[n]=Math.abs(a)<1e-9?0:2*a/SIZE;imag[n]=Math.abs(b)<1e-9?0:2*b/SIZE;}
  return {real,imag};
 }
 function reconstruct(real,imag,maxHarmonic=HARMONICS-1){
  const table=new Float64Array(SIZE);
  for(let n=1;n<=Math.min(maxHarmonic,real.length-1);n++)if(real[n]||imag[n])for(let i=0;i<SIZE;i++)table[i]+=real[n]*cos[n*SIZE+i]+imag[n]*sin[n*SIZE+i];
  return table;
 }
 function analyse(input,normalize=false){
  const {real,imag}=coefficients(centered(input));let table=reconstruct(real,imag),peak=peakOf(table);
  const scale=peak>1?1/peak:normalize&&peak>1e-6?1/peak:1;
  if(scale!==1){for(let i=1;i<real.length;i++){real[i]*=scale;imag[i]*=scale;}table=reconstruct(real,imag);peak=peakOf(table);}
  let sum=0;for(const x of table)sum+=x*x;
  return {table,real,imag,peak,rms:Math.sqrt(sum/SIZE)};
 }
 function fold(x){return 1-Math.abs(((x+1)%4+4)%4-2);}
 function combine(a,b,mode,amount){
  return Float64Array.from(a,(x,i)=>{const y=b[i];switch(mode){
   case 'subtract':return x*(1-amount)-y*amount;
   case 'multiply':return x*(1-amount)+x*y*amount;
   case 'fold':return fold((x+y)*.5*(1+amount*3));
   default:return x*(1-amount)+y*amount;
  }});
 }
 function ampSettings(a={}){const n=(v,d,min,max)=>{v=v??d;if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error('Invalid amp setting.');return v;};if(a.enabled!==undefined&&typeof a.enabled!=='boolean')throw new Error('Invalid amp switch.');return {enabled:a.enabled??false,drive:n(a.drive,2,1,12),color:n(a.color,.25,0,1),mix:n(a.mix,.7,0,1),output:n(a.output,.7,0,1),low:n(a.low,0,-12,12),high:n(a.high,0,-12,12)};}
 function ampSample(x,value){const a=value;if(!a?.enabled)return x;const soft=Math.tanh(x*a.drive)/Math.tanh(a.drive),hard=clamp(x*a.drive,-1,1),wet=soft*(1-a.color)+hard*a.color;return (x*(1-a.mix)+wet*a.mix)*a.output;}
 function compile(project,{frequency=134}={}){
  const a=analyse(renderSource(project.a)),b=analyse(renderSource(project.b));
  const result=analyse(combine(a.table,b.table,project.mode,project.amount),project.normalize);
  return {a,b,result:project.amp?.enabled?analyse(Tone.cycle(Float64Array.from(result.table,x=>ampSample(x,project.amp)),frequency,project.amp)):result};
 }
 function smoothPoints(points){return points.map((v,i)=>(points[(i+STEPS-1)%STEPS]+v*2+points[(i+1)%STEPS])/4);}
 function drawSegment(points,from,to){
  const low=Math.min(from.index,to.index),high=Math.max(from.index,to.index);
  for(let i=low;i<=high;i++){const t=from.index===to.index?1:(i-from.index)/(to.index-from.index);points[i]=clamp(from.value+(to.value-from.value)*t,-1,1);}
  return points;
 }
 function capture(table){return Array.from({length:STEPS},(_,i)=>clamp(sample(table,i/STEPS),-1,1));}
 function validatePatch(data){
  const number=(x,min,max,name)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)throw new Error(`Invalid ${name}.`);return x;};
  const boolean=(x,name)=>{if(typeof x!=='boolean')throw new Error(`Invalid ${name}.`);return x;};
  if(!data||data.kind!=='dot-wave-studio'||!data.project||data.project.version!==1)throw new Error('Choose a Dot Wave Studio patch file.');
  const p=data.project;
  function voice(x){if(!x||!Array.isArray(x.points)||x.points.length!==STEPS)throw new Error('Each wave needs 32 points.');if(![1,2,3,4,8].includes(x.ratio))throw new Error('Invalid wave ratio.');const pins=x.pins??[];if(!Array.isArray(pins)||pins.some(i=>!Number.isInteger(i)||i<0||i>=STEPS))throw new Error('Pin existing waveform dots.');return {points:x.points.map(v=>number(v,-1,1,'wave point')),shape:TYPES.includes(x.shape)?x.shape:'custom',smoothness:number(x.smoothness??0,0,1,'wave smoothness'),pins:[...new Set(pins)].sort((a,b)=>a-b),level:number(x.level,0,1,'wave level'),phase:number(x.phase,0,360,'wave phase'),ratio:x.ratio,inverted:boolean(x.inverted,'polarity')};}
  if(!MODES.includes(p.mode))throw new Error('Unknown battle mode.');
  const eq=data.eq??{gains:Array(10).fill(0),bypass:false},channel=data.channel??0;
  if(!eq||!Array.isArray(eq.gains)||eq.gains.length!==10)throw new Error('Invalid equalizer settings.');
  if(![-1,0,1].includes(channel))throw new Error('Invalid output channel.');
  const freePair=data.freePair==null?null:{a:number(data.freePair.a,20,20000,'Wave A pitch'),b:number(data.freePair.b,20,20000,'Wave B pitch')};
  return {kind:'dot-wave-studio',freePair,project:{version:1,a:voice(p.a),b:voice(p.b),mode:p.mode,amount:number(p.amount,0,1,'battle amount'),normalize:boolean(p.normalize,'normalization'),amp:ampSettings(p.amp),effects:FX.validate(p.effects)},pitch:number(data.pitch,20,20000,'pitch'),level:number(data.level,-60,0,'tone level'),volume:number(data.volume,0,1,'output volume'),inverted:boolean(data.inverted,'output polarity'),eq:{gains:eq.gains.map(v=>number(v,-12,12,'EQ gain')),bypass:boolean(eq.bypass,'EQ bypass')},throughEQ:boolean(data.throughEQ??false,'EQ routing'),channel};
 }
 function encodeWav(signal,{frequency=440,gain=.05,inverted=false,duration=2,rate=48000}={}){
  if(!Number.isFinite(frequency)||frequency<20||frequency>20000)throw new Error('Invalid export frequency.');
  if(!Number.isFinite(gain)||gain<0||gain>1)throw new Error('Invalid export level.');
  const frames=Math.round(rate*duration),buffer=new ArrayBuffer(44+frames*2),view=new DataView(buffer);
  const text=(at,str)=>{for(let i=0;i<str.length;i++)view.setUint8(at+i,str.charCodeAt(i));};
  text(0,'RIFF');view.setUint32(4,36+frames*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,frames*2,true);
  // Match the oscillator's harmonic cutoff, instead of aliasing the drawn corners.
  const table=reconstruct(signal.real,signal.imag,Math.floor(rate*.49/frequency));
  for(let i=0;i<frames;i++){const envelope=Math.min(1,i/(rate*.015),(frames-1-i)/(rate*.015));const value=sample(table,i*frequency/rate)*gain*envelope*(inverted?-1:1);view.setInt16(44+i*2,Math.round(clamp(value,-1,1)*32767),true);}
  return buffer;
 }
 const api={SIZE,STEPS,HARMONICS,TYPES,MODES,ampSettings,ampSample,sample,preset,source,defaultProject,centered,peakOf,shapePoints,shapeSample,sourceOutline,renderSource,coefficients,reconstruct,analyse,fold,combine,compile,smoothPoints,drawSegment,capture,validatePatch,encodeWav};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StudioDSP=api;
})(typeof globalThis!=='undefined'?globalThis:this);
