(function(root){
 'use strict';
 // Single-voice hum tracking for editable notes and a reusable voice waveform.
 // Audio remains the original mic input; this module does not synthesize notes.
 const scales={chromatic:[0,1,2,3,4,5,6,7,8,9,10,11],major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],pentatonic:[0,2,4,7,9]};
 const defaults={root:0,scale:'chromatic',gateDb:-48,minHz:65,maxHz:1000};
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mod=(x,n)=>((x%n)+n)%n;
 function rateOK(rate){if(!Number.isFinite(rate)||rate<8000||rate>192000)throw Error('Choose a sample rate between 8 and 192 kHz.');return rate;}
 function settings(value={},previous=defaults){const o={...previous};for(const [key,a,b]of [['gateDb',-80,-12],['minHz',40,500],['maxHz',100,1800]])if(Number.isFinite(value[key]))o[key]=clamp(value[key],a,b);if(Number.isInteger(value.root))o.root=mod(value.root,12);if(Object.hasOwn(scales,value.scale))o.scale=value.scale;o.maxHz=Math.max(o.minHz+20,o.maxHz);return o;}
 function targetMidi(midi,options={}){
  if(!Number.isFinite(midi))return null;midi=clamp(midi,0,127);const o=settings(options),allowed=scales[o.scale];let best=0,distance=Infinity;
  for(let n=Math.max(0,Math.floor(midi)-12);n<=Math.min(127,Math.ceil(midi)+12);n++)if(allowed.includes(mod(n-o.root,12))){const d=Math.abs(n-midi);if(d<distance){distance=d;best=n;}}
  return best;
 }
 function detect(input,rate,options={}){
  rateOK(rate);const o=settings(options),count=Math.min(input?.length||0,Math.ceil(rate*.09)),from=(input?.length||0)-count,stride=Math.max(1,Math.floor(rate/12000)),n=Math.floor(count/stride),sr=rate/stride;
  const empty={frequency:0,midi:null,confidence:0,rms:0,voiced:false};if(n<16)return empty;
  const data=new Float64Array(n);let mean=0;
  for(let i=0;i<n;i++){let sum=0;for(let j=0;j<stride;j++){const x=input[from+i*stride+j];sum+=Number.isFinite(x)?clamp(x,-1,1):0;}data[i]=sum/stride;mean+=data[i]/n;}
  let energy=0;for(let i=0;i<n;i++){data[i]-=mean;energy+=data[i]*data[i];}const rms=Math.sqrt(energy/n);empty.rms=rms;if(rms<Math.pow(10,o.gateDb/20))return empty;
  const minimum=Math.max(2,Math.floor(sr/o.maxHz)),maximum=Math.min(Math.ceil(sr/o.minHz),Math.floor(n*.45)),window=n-maximum;
  if(maximum<=minimum+2||window<minimum)return empty;
  const normalized=new Float64Array(maximum+1);normalized[0]=1;let sum=0;
  for(let lag=1;lag<=maximum;lag++){let d=0;for(let i=0;i<window;i++){const v=data[i]-data[i+lag];d+=v*v;}sum+=d;normalized[lag]=sum>1e-16?d*lag/sum:1;}
  let lag=0,best=Infinity;
  for(let at=minimum;at<maximum;at++){if(normalized[at]<best){best=normalized[at];lag=at;}if(normalized[at]<.15){while(at+1<=maximum&&normalized[at+1]<normalized[at])at++;lag=at;best=normalized[at];break;}}
  // A weak fundamental under a loud second harmonic can cross the threshold
  // half a cycle early. Prefer the full cycle only with a material score gain.
  if(lag*2<=maximum){let twice=lag*2;for(let at=Math.max(minimum,twice-2);at<=Math.min(maximum,twice+2);at++)if(normalized[at]<normalized[twice])twice=at;if(normalized[twice]<best*.45&&best-normalized[twice]>.012){lag=twice;best=normalized[twice];}}
  const confidence=clamp(1-best,0,1);if(!lag||confidence<.82)return {...empty,confidence};
  let delta=0;if(lag>1&&lag<maximum){const a=normalized[lag-1],b=normalized[lag],c=normalized[lag+1],den=a-2*b+c;if(Math.abs(den)>1e-12)delta=clamp(.5*(a-c)/den,-.5,.5);}
  const frequency=sr/(lag+delta);if(!Number.isFinite(frequency)||frequency<o.minHz*.98||frequency>o.maxHz*1.02)return {...empty,confidence};
  return {frequency,midi:69+12*Math.log2(frequency/440),confidence,rms,voiced:true};
 }
 function extractCycle(input,rate,frequency,size=512){
  rateOK(rate);if(!input?.length||!Number.isFinite(frequency)||frequency<30||frequency>2000||!Number.isInteger(size)||size<32||size>2048)return null;
  const period=rate/frequency;if(input.length<period*2+3)return null;
  // The last pulse may be a fading breath or partially silent. Choose a strong
  // complete cycle from the recent 60 ms instead of normalizing that tail.
  const first=Math.max(1,Math.floor(input.length-Math.max(period*3,rate*.06))),last=input.length-period-2;let start=first,bestEnergy=-1;
  for(let i=first;i<last;i++){const a=input[i],b=input[i+1];if(Number.isFinite(a)&&Number.isFinite(b)&&a<=0&&b>0){
   const at=i-a/(b-a);let energy=0;for(let n=0;n<32;n++){const pos=Math.floor(at+(n+.5)*period/32),value=input[pos];energy+=Number.isFinite(value)?value*value:0;}
   if(energy>bestEnergy){bestEnergy=energy;start=at;}
  }}
  const cycle=new Float32Array(size);let mean=0;for(let i=0;i<size;i++){const x=start+i*period/size,a=Math.floor(x),f=x-a,value=(input[a]||0)*(1-f)+(input[a+1]||0)*f;if(!Number.isFinite(value))return null;cycle[i]=value;mean+=value/size;}
  let peak=0;for(let i=0;i<size;i++){cycle[i]-=mean;peak=Math.max(peak,Math.abs(cycle[i]));}if(peak<1e-5)return null;for(let i=0;i<size;i++)cycle[i]/=peak;return cycle;
 }
 function createProcessor(rate,options={}){
  rateOK(rate);let o=settings(options);const analysisFrames=Math.ceil(rate*.085),hop=Math.max(128,Math.round(rate*.02));let size=1;while(size<analysisFrames)size*=2;
  const ring=new Float32Array(size),mask=size-1,analysis=new Float32Array(analysisFrames);let total=0,nextAnalysis=analysisFrames,currentTarget=null,previousMidi=null,stableFrames=0;
  function update(value){o=settings(value,o);return {...o};}
  function reset(){ring.fill(0);analysis.fill(0);total=0;nextAnalysis=analysisFrames;currentTarget=null;previousMidi=null;stableFrames=0;}
  function process(input){
   if(!input||!Number.isInteger(input.length)||input.length>rate*2)throw Error('Process at most two seconds of voice samples at a time.');
   const output=new Float32Array(input.length),frames=[];let cycle=null;
   for(let i=0;i<input.length;i++){
    const value=Number.isFinite(input[i])?clamp(input[i],-1,1):0;ring[total&mask]=value;output[i]=value;
    if(total+1>=nextAnalysis){
     for(let j=0;j<analysisFrames;j++)analysis[j]=ring[(total+1-analysisFrames+j)&mask];
     const found=detect(analysis,rate,o);let selected=null;
     if(found.voiced){
      selected=targetMidi(found.midi,o);if(currentTarget!==null&&scales[o.scale].includes(mod(currentTarget-o.root,12))&&Math.abs(found.midi-currentTarget)<=Math.abs(found.midi-selected)+.12)selected=currentTarget;currentTarget=selected;
      stableFrames=previousMidi!==null&&Math.abs(found.midi-previousMidi)<.6?stableFrames+1:1;previousMidi=found.midi;
      if(found.confidence>=.86&&stableFrames>=3)cycle=extractCycle(analysis,rate,found.frequency,512);
     }else{currentTarget=null;previousMidi=null;stableFrames=0;}
     frames.push({...found,targetMidi:selected,time:Math.max(0,(total+1-analysisFrames/2)/rate)});nextAnalysis+=hop;
    }
    total++;
   }
   return {output,frames,cycle};
  }
  return {process,update,reset,latencyFrames:0,get settings(){return {...o};}};
 }
 const api={detect,targetMidi,extractCycle,createProcessor,scales};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HumDSP=api;
})(typeof globalThis!=='undefined'?globalThis:this);
