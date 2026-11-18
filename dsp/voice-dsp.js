(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports,Sample=node?require('./sampler-dsp.js'):root.SamplerDSP;
  const entries=[
    ['AA','ɑ','father'],['AE','æ','cat'],['AH','ʌ','cup'],['AO','ɔ','thought'],['AW','aʊ','now'],['AY','aɪ','eye'],['EH','ɛ','bed'],['ER','ɝ','bird'],['EY','eɪ','day'],['IH','ɪ','sit'],['IY','i','see'],['OW','oʊ','go'],['OY','ɔɪ','boy'],['UH','ʊ','book'],['UW','u','blue'],
    ['B','b','bat'],['CH','tʃ','cheese'],['D','d','dog'],['DH','ð','this'],['F','f','fish'],['G','ɡ','go'],['HH','h','hat'],['JH','dʒ','jam'],['K','k','cat'],['L','l','leaf'],['M','m','moon'],['N','n','no'],['NG','ŋ','sing'],['P','p','pen'],['R','ɹ','red'],['S','s','sun'],['SH','ʃ','ship'],['T','t','tea'],['TH','θ','thin'],['V','v','van'],['W','w','we'],['Y','j','yes'],['Z','z','zoo'],['ZH','ʒ','vision']
  ];
  const phones=entries.map(([id,ipa,word],i)=>({id,ipa,word,vowel:i<15,sustain:i<15||['L','M','N','NG','R','V','Z','ZH'].includes(id)}));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function blank(){return {kind:'dot-voice-bank',version:1,name:'My recorded voice',language:'en-US',takes:{}};}
  function validate(value){
    if(!value||value.kind!=='dot-voice-bank'||value.version!==1||typeof value.name!=='string'||!value.name.trim()||value.name.length>48||value.language!=='en-US'||!value.takes||typeof value.takes!=='object'||Array.isArray(value.takes)||Object.keys(value.takes).length>39)throw new Error('Choose a Dot Wave voice-bank file.');
    const takes={};let frames=0;
    for(const [code,take] of Object.entries(value.takes)){
      if(!phones.some(p=>p.id===code))throw new Error('This voice bank contains an unknown speech sound.');
      const r=Sample.region(take,{maxSeconds:2.5});if(r.frames/r.rate<.045)throw new Error('A speech-sound recording is too short.');frames+=r.frames/r.rate;if(frames>98)throw new Error('The voice bank is too long.');
      takes[code]={...r,pitchHz:typeof take.pitchHz==='number'&&Number.isFinite(take.pitchHz)?clamp(take.pitchHz,0,1200):0};
    }
    return {...blank(),name:value.name.trim(),takes};
  }
  function signals(bank){if(!bank)return {};return Object.fromEntries(phones.filter(p=>bank.takes[p.id]).map(p=>['voice-'+p.id,{kind:'sampled-instrument',sampled:{id:'voice-'+p.id,name:bank.name+' · '+p.id,regions:[bank.takes[p.id]],sustain:p.sustain,unpitched:!p.vowel,release:p.vowel?.10:.035}}]));}
  function resample(samples,rate,target=22050){
    if(!Number.isInteger(rate)||rate<8000||rate>192000||!samples||samples.length<32||samples.length>rate*15||Array.from(samples).some(v=>!Number.isFinite(v)||Math.abs(v)>4))throw new Error('Choose a short, readable recording.');
    const out=new Float32Array(Math.min(Math.ceil(samples.length*target/rate),target*2.5)),step=rate/target;
    for(let i=0;i<out.length;i++){const index=i*step,j=Math.floor(index),t=index-j;out[i]=samples[j]*(1-t)+(samples[Math.min(j+1,samples.length-1)]||0)*t;}return out;
  }
  function pitch(samples,rate){
    const length=Math.min(samples.length,4096);if(length<512)return 0;const start=Math.max(0,Math.floor((samples.length-length)/2)),min=Math.floor(rate/600),max=Math.min(Math.floor(rate/65),Math.floor(length/2));
    let best=0,lagAt=0;for(let lag=min;lag<=max;lag++){let cross=0,a=0,b=0;for(let i=0;i<length-max;i+=2){const x=samples[start+i],y=samples[start+i+lag];cross+=x*y;a+=x*x;b+=y*y;}const score=cross/Math.sqrt(a*b||1);if(score>best){best=score;lagAt=lag;}}
    return best>.55?rate/lagAt:0;
  }
  function analyse(input,rate,code){
    const phone=phones.find(p=>p.id===code);if(!phone)throw new Error('Choose a speech sound first.');
    const samples=resample(input,rate),target=22050,peak=Math.max(...samples.map(Math.abs));
    let energy=0,clipped=0;for(const v of samples){energy+=v*v;if(Math.abs(v)>.985)clipped++;}
    const rms=Math.sqrt(energy/samples.length);if(peak<.012||rms<.002)throw new Error('That take is too quiet. Move closer, then record again.');
    const threshold=Math.max(.003,peak*.025),window=110;let first=-1,last=-1;
    for(let at=0;at<samples.length;at+=window){let sum=0;for(let i=at;i<Math.min(at+window,samples.length);i++)sum+=samples[i]*samples[i];if(Math.sqrt(sum/window)>threshold){if(first<0)first=at;last=at+window;}}
    if(first<0||last-first<target*.045)throw new Error('The sound was too short to keep. Try it once more.');
    first=Math.max(0,first-220);last=Math.min(samples.length,last+330);const trimmed=samples.slice(first,last),mean=trimmed.reduce((a,b)=>a+b,0)/trimmed.length,gain=Math.min(4,.8/peak);
    for(let i=0;i<trimmed.length;i++){const edge=Math.min(1,i/22,(trimmed.length-1-i)/66);trimmed[i]=clamp((trimmed[i]-mean)*gain*edge,-.95,.95);}
    const hz=phone.vowel?pitch(trimmed,target):0,root=hz?clamp(Math.round(69+12*Math.log2(hz/440)),24,96):60;
    return {take:{root,rate:target,frames:trimmed.length,pcm:Sample.encode(trimmed),pitchHz:hz},samples:trimmed,quality:clipped/samples.length>.003?'The mic clipped. Try a little farther away.':rms<.012?'Usable, but quiet. A closer take may sound clearer.':phone.vowel&&!hz?'Captured. Set the root note if the pitch sounds wrong.':'Clear take. Listen before keeping it.',clipped:clipped/samples.length,duration:trimmed.length/target};
  }
  function tokens(value){if(typeof value!=='string'||value.length>512)throw new Error('Keep the phrase short.');const codes=value.trim().toUpperCase().split(/[\s,;]+/).filter(Boolean);if(!codes.length||codes.length>64||codes.some(code=>!phones.some(p=>p.id===code)))throw new Error('Use speech-sound codes from the cards, separated by spaces (up to 64).');return codes;}
  function sequence(bank,text,{rate=22050,speed=1}={}){
    bank=validate(bank);if(!Number.isInteger(rate)||rate<8000||rate>96000||!Number.isFinite(speed)||speed<.5||speed>2)throw new Error('Choose a supported phrase speed.');const codes=tokens(text),missing=[...new Set(codes.filter(code=>!bank.takes[code]))];if(missing.length)throw new Error('Record these sounds first: '+missing.join(', '));
    const chunks=codes.map(code=>{const take=bank.takes[code],source=Sample.pcm(take),length=Math.round(source.length*rate/take.rate/speed);return Float32Array.from({length},(_,i)=>{const at=i*take.rate/rate*speed,j=Math.floor(at),t=at-j;return (source[j]||0)*(1-t)+(source[Math.min(j+1,source.length-1)]||0)*t;});});
    const overlap=Math.round(rate*.003),total=chunks.reduce((s,c)=>s+c.length,0)-overlap*(chunks.length-1);if(total>rate*30)throw new Error('Keep a phrase under 30 seconds.');const out=new Float32Array(Math.max(1,total));let at=0;
    for(const chunk of chunks){for(let i=0;i<chunk.length;i++){const fade=i<overlap&&at?i/overlap:1;out[at+i]=out[at+i]*(1-fade)+chunk[i]*fade;}at+=chunk.length-overlap;}return {samples:out,rate,duration:out.length/rate};
  }
  const api={phones,blank,validate,signals,resample,pitch,analyse,tokens,sequence};if(node)module.exports=api;else root.VoiceDSP=api;
})(typeof globalThis!=='undefined'?globalThis:this);
