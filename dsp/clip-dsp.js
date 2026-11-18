(function(root){
 'use strict';
 const FX=typeof module!=='undefined'&&module.exports?require('./effects-dsp.js'):root.EffectsDSP;
 const S=typeof module!=='undefined'&&module.exports?require('./studio-dsp.js'):root.StudioDSP;
 const num=(v,a,b,name)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<a||v>b)throw new Error('Invalid '+name+'.');return v;};
 function controls(v={}){return {volume:num(v.volume??1,0,1,'clip volume'),pan:num(v.pan??0,-1,1,'balance'),pitch:num(v.pitch??0,-24,24,'pitch'),fadeIn:num(v.fadeIn??0,0,320,'fade in'),fadeOut:num(v.fadeOut??0,0,320,'fade out'),mute:v.mute===undefined?false:typeof v.mute==='boolean'?v.mute:(()=>{throw new Error('Invalid mute.');})()};}
 function wave(v){
  if(!v||!v.wave||!Number.isFinite(v.start)||v.start<0||v.start>320)throw new Error('Invalid waveform clip.');
  const terms=a=>{if(!Array.isArray(a)||a.length!==128||a[0]!==0)throw new Error('Invalid clip waveform.');return a.map(x=>num(x,-2,2,'wave coefficient'));};
  const sourceBeats=num(v.sourceBeats??4,.0625,320,'source length'),trimStart=num(v.trimStart??0,0,sourceBeats,'trim start'),trimEnd=num(v.trimEnd??sourceBeats,0,sourceBeats,'trim end');
  if(trimEnd-trimStart<1/64)throw new Error('Keep at least 1/64 beat of the source.');
  const duration=num(v.duration,1/64,320,'clip length'),stretch=num(v.stretch??1,.125,64,'stretch');
  if(typeof v.loop!=='boolean'||typeof (v.reverse??false)!=='boolean')throw new Error('Invalid clip loop or reverse.');
  return {...v,...controls(v),sourceBeats,trimStart,trimEnd,duration,stretch,frequency:num(v.frequency??134,20,20000,'wave pitch'),reverse:v.reverse??false,wave:{real:terms(v.wave.real),imag:terms(v.wave.imag),effects:FX.validate(v.wave.effects)}};
 }
 // Minimum fade is three milliseconds, not three samples. Trimmed/custom
 // waves can begin at a peak, so a three-sample ramp was effectively a click.
 function envelope(local,duration,fx,rate,bpm){const edge=.003*bpm/60;return Math.max(0,Math.min(1,local/Math.max(edge,fx.fadeIn),(duration-local)/Math.max(edge,fx.fadeOut)));}
 function balance(pan){return [pan>0?1-pan:1,pan<0?1+pan:1];}
 function renderWave(value,{rate=44100,bpm=110}={}){
  const c=wave(value),seconds=60/bpm,length=Math.max(1,Math.round(c.duration*seconds*rate)),out=new Float32Array(length),freq=c.frequency*2**(c.pitch/12);
  if(c.mute||freq>rate*.45)return out;
  const table=S.reconstruct(c.wave.real,c.wave.imag,Math.floor(rate*.45/freq)),peak=S.peakOf(table),scale=1/Math.max(1,peak),span=c.trimEnd-c.trimStart,cycle=span*c.stretch;
  for(let i=0;i<length;i++){
   const local=i/rate/seconds;if(!c.loop&&local>=cycle)break;
   const source=c.trimStart+(local%cycle)/c.stretch;
   const gate=Math.max(0,Math.min(1,source*seconds/.004,(c.sourceBeats-source)*seconds/.03));
   const phase=(c.trimStart*c.stretch*seconds+i/rate)*(c.reverse?-freq:freq);
   out[i]=S.sample(table,phase)*scale*gate;
  }
  const effected=FX.process(out,rate,c.wave.effects);
  for(let i=0;i<effected.length;i++)effected[i]*=envelope(i/rate/seconds,c.duration,c,rate,bpm)*Math.min(1,(effected.length-1-i)/(rate*.003));
  return effected;
 }
 const api={controls,wave,envelope,balance,renderWave};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ClipDSP=api;
})(typeof globalThis!=='undefined'?globalThis:this);
