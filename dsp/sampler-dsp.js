(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports,data=node?require('./instrument-data.js'):root.DotInstrumentData;
  const cache=new Map(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function pcm(region){
    if(cache.has(region.pcm))return cache.get(region.pcm);
    const bytes=node?Buffer.from(region.pcm,'base64'):Uint8Array.from(atob(region.pcm),c=>c.charCodeAt(0));
    if(bytes.length!==region.frames*2)throw new Error('This recording has damaged audio data.');
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),result=Float32Array.from({length:region.frames},(_,i)=>view.getInt16(i*2,true)/32768);
    if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(region.pcm,result);return result;
  }
  function encode(samples){
    const bytes=new Uint8Array(samples.length*2),view=new DataView(bytes.buffer);
    for(let i=0;i<samples.length;i++){if(!Number.isFinite(samples[i]))throw new Error('The recording contains invalid audio.');view.setInt16(i*2,Math.round(clamp(samples[i],-1,1)*32767),true);}
    if(node)return Buffer.from(bytes).toString('base64');let value='';for(let i=0;i<bytes.length;i+=16384)value+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(value);
  }
  function region(value,{maxSeconds=5}={}){
    if(!value||!Number.isInteger(value.root)||value.root<0||value.root>127||!Number.isInteger(value.rate)||value.rate<8000||value.rate>96000||!Number.isInteger(value.frames)||value.frames<32||value.frames>value.rate*maxSeconds||typeof value.pcm!=='string'||value.pcm.length!==4*Math.ceil(value.frames*2/3)||!/^[A-Za-z0-9+/]*={0,2}$/.test(value.pcm))throw new Error('Choose a complete, short recorded sample.');
    const padding=value.pcm.endsWith('==')?2:value.pcm.endsWith('=')?1:0;if(value.pcm.length/4*3-padding!==value.frames*2)throw new Error('The recording length does not match its audio data.');
    return {root:value.root,rate:value.rate,frames:value.frames,pcm:value.pcm};
  }
  function signals(){return Object.fromEntries(data.map(item=>[item.id,{kind:'sampled-instrument',sampled:item}]));}
  function catalog(){return data.map(({regions,...item})=>({...item,notes:regions.map(r=>r.root),sampleCount:regions.length}));}
  function at(samples,index){if(index<0||index>=samples.length-1)return 0;const i=Math.floor(index),t=index-i;return samples[i]*(1-t)+samples[i+1]*t;}
  function render(instrument,note,{rate=44100,bpm=96,pitch=0}={}){
    const pack=instrument.sampled||instrument,hold=note.duration*60/bpm;
    if(!Number.isInteger(rate)||rate<8000||rate>192000||!Number.isFinite(hold)||hold<=0||hold>96||!Number.isFinite(note.velocity)||note.velocity<0||note.velocity>1||!Number.isFinite(note.midi)||note.midi<0||note.midi>127||!Number.isFinite(pitch)||Math.abs(pitch)>24)throw new Error('Choose a valid recorded-instrument note.');
    const midi=note.midi+pitch,chosen=pack.regions.reduce((a,b)=>Math.abs(a.root-midi)<=Math.abs(b.root-midi)?a:b),samples=pcm(chosen),speed=pack.unpitched?chosen.rate/rate:2**((midi-chosen.root)/12)*chosen.rate/rate;
    const release=pack.release??.18,frames=Math.max(2,Math.round((hold+release)*rate)),output=new Float32Array(frames),ease=x=>.5-.5*Math.cos(Math.PI*clamp(x,0,1));
    const loopStart=Math.floor(samples.length*.35),loopEnd=Math.floor(samples.length*.88),cross=Math.min(Math.round(chosen.rate*.035),Math.floor((loopEnd-loopStart)/4)),span=loopEnd-loopStart-cross;
    const canLoop=pack.sustain&&samples.length>chosen.rate*.16&&span>cross*2;
    for(let i=0;i<frames;i++){
      let pos=i*speed;if(canLoop&&pos>=loopEnd)pos=loopStart+cross+(pos-loopEnd)%span;
      let value=at(samples,pos);
      if(canLoop&&pos>loopEnd-cross&&pos<loopEnd){const t=(pos-(loopEnd-cross))/cross;value=value*(1-ease(t))+at(samples,loopStart+pos-(loopEnd-cross))*ease(t);}
      const time=i/rate,gate=time<=hold?1:ease(1-(time-hold)/release),onset=ease(time/(pack.unpitched?.001:.004));
      output[i]=value*onset*gate*note.velocity*.74;
    }
    output[0]=0;output[frames-1]=0;return output;
  }
  function program(id){return data.find(item=>item.id===id)?.program;}
  const api={pcm,encode,region,signals,catalog,render,program};if(node)module.exports=api;else root.SamplerDSP=api;
})(typeof globalThis!=='undefined'?globalThis:this);
