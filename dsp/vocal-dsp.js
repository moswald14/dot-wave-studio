(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const Voice=node?require('./voice-dsp.js'):root.VoiceDSP;
  const Sample=node?require('./sampler-dsp.js'):root.SamplerDSP;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=x=>.5-.5*Math.cos(Math.PI*clamp(x,0,1));
  const phoneSet=new Set(Voice.phones.map(p=>p.id)),vowels=new Set(Voice.phones.filter(p=>p.vowel).map(p=>p.id));
  const presets=[
    {id:'vocal-soft',name:'Soft singer',description:'Warm, close and a little breathy.',tilt:1.35,shift:.96,air:.035},
    {id:'vocal-clear',name:'Clear singer',description:'A bright voice for distinct syllables.',tilt:1.05,shift:1.07,air:.012},
    {id:'vocal-choir',name:'Dream choir',description:'Three gently drifting voices.',tilt:1.25,shift:1,air:.025},
    {id:'vocal-recorded',name:'Your voice kit',description:'Your kept sounds, with built-in sounds filling the gaps.',tilt:1.25,shift:1,air:.025}
  ];
  // Artist-tuned resonances, in Hz. These are synthesis parameters rather than
  // measurements of a person. The note pitch and vowel resonances stay separate.
  const formants={AA:[730,1090,2440],AE:[660,1720,2410],AH:[640,1190,2390],AO:[570,840,2410],EH:[530,1840,2480],ER:[490,1350,1690],IH:[390,1990,2550],IY:[270,2290,3010],UH:[440,1020,2240],UW:[300,870,2240],
    M:[250,1100,2200],N:[300,1500,2500],NG:[260,1900,2600],L:[370,1300,2600],R:[360,1300,1700],W:[300,800,2100],Y:[280,2200,2900],V:[430,1200,2500],Z:[380,1800,2700],ZH:[400,1600,2500],B:[400,1000,2400],D:[400,1700,2600],G:[400,1400,2500]};
  const diphthongs={AW:['AA','UW'],AY:['AA','IY'],EY:['EH','IY'],OW:['AO','UW'],OY:['AO','IY']};
  const voiced=new Set([...Object.keys(formants),...Object.keys(diphthongs)]);
  const aliases={ah:['AA'],aah:['AA'],ooh:['UW'],oo:['UW'],ee:['IY'],oh:['OW'],la:['L','AA'],na:['N','AA'],doo:['D','UW'],mm:['M'],hmm:['M']};
  const tables=new Map();
  function number(v,min,max,label){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error('Choose a valid '+label+'.');return v;}
  function phones(value){if(typeof value==='string')value=value.trim().toUpperCase().split(/\s+/);if(!Array.isArray(value)||!value.length||value.length>32||value.some(p=>typeof p!=='string'||!phoneSet.has(p)))throw new Error('Use up to 32 speech-sound codes, such as HH EH L OW.');return [...value];}
  function note(value){
    if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.lyric!=='string'||!value.lyric.trim()||value.lyric.length>64||/[\u0000-\u001f\u007f]/.test(value.lyric))throw new Error('Keep a note lyric to 1–64 characters.');
    return {lyric:value.lyric.trim(),phones:phones(value.phones),vibrato:number(value.vibrato??.3,0,1,'vibrato amount'),breath:number(value.breath??.12,0,1,'breath amount'),formant:number(value.formant??0,-12,12,'voice color')};
  }
  function words(text){
    if(typeof text!=='string'||text.length>1024)throw new Error('Keep a lyric line under 1,024 characters.');
    const tokens=text.normalize('NFKC').replace(/[’‘]/g,"'").match(/\[[^\]]+\]|_|[a-zA-Z]+(?:'[a-zA-Z]+)?/g)||[];
    if(!tokens.length||tokens.length>64)throw new Error('Write 1–64 words or syllables. Use _ to hold the last vowel.');
    const lexicon=node?require('./vocal-lexicon.js'):root.DotVocalLexicon;
    let lastVowel;return tokens.map(token=>{
      if(token==='_'){if(!lastVowel)throw new Error('Put a word with a vowel before _.');return {lyric:'_',phones:[lastVowel]};}
      const lower=token.toLowerCase(),found=token.startsWith('[')?token.slice(1,-1):(Object.hasOwn(aliases,lower)?aliases[lower]:lexicon?.lookup(lower));
      if(!found)throw new Error('No pronunciation for “'+token+'”. Split it into known syllables, or use speech codes in brackets, such as [M UW N].');
      const codes=phones(found);lastVowel=[...codes].reverse().find(p=>vowels.has(p))||lastVowel;
      return {lyric:token.startsWith('[')?codes.join(' '):token,phones:codes};
    });
  }
  const key=n=>n.start+':'+n.midi;
  function assign(notes,selected,text){
    const units=words(text),chosen=notes.filter(n=>!selected?.length||selected.includes(key(n))).sort((a,b)=>a.start-b.start||a.midi-b.midi);
    if(!chosen.length)throw new Error('Paint or select some notes first.');
    if(units.length>chosen.length)throw new Error('This line has '+units.length+' words or syllables, but only '+chosen.length+' notes. Add notes or shorten the line.');
    const changes=new Map(units.map((unit,i)=>[key(chosen[i]),note({...chosen[i].vocal,...unit})]));
    return notes.map(n=>({...n,...(changes.has(key(n))?{vocal:changes.get(key(n))}:n.vocal?{vocal:note(n.vocal)}:{})}));
  }
  function catalog(){return presets.map(({id,name,description})=>({id,name,description}));}
  function signals(bank){return Object.fromEntries(presets.map(p=>[p.id,{kind:'singing-instrument',vocal:{id:p.id,bank}}]));}
  function table(code,frequency,rate,profile,color){
    const cacheKey=JSON.stringify([code,frequency,rate,profile.id,color]);if(tables.has(cacheKey))return tables.get(cacheKey);
    const resonances=formants[code]||formants.AH,shift=profile.shift*2**(color/12),size=2048,result=new Float32Array(size),harmonics=Math.min(96,Math.floor(rate*.43/frequency));
    const nasal=['M','N','NG'].includes(code),gain=nasal?.27:1;
    for(let h=1;h<=harmonics;h++){
      const hz=h*frequency;let amp=.12/h**profile.tilt;
      for(let j=0;j<3;j++){const center=resonances[j]*shift,width=[95,135,200][j]*shift; amp+=[1,.55,.22][j]*Math.exp(-.5*((hz-center)/width)**2)/h**.65;}
      if(nasal)amp*=Math.exp(-hz/1800);
      for(let i=0;i<size;i++)result[i]+=amp*Math.sin(2*Math.PI*h*i/size);
    }
    let peak=0;for(const v of result)peak=Math.max(peak,Math.abs(v));if(peak)for(let i=0;i<size;i++)result[i]*=.52*gain/peak;
    if(tables.size>=192)tables.delete(tables.keys().next().value);tables.set(cacheKey,result);return result;
  }
  function at(data,phase){const pos=(phase%1+1)%1*data.length,i=Math.floor(pos),f=pos-i;return data[i]*(1-f)+data[(i+1)%data.length]*f;}
  function schedule(codes,hold){
    const count=codes.filter(p=>vowels.has(p)).length;
    if(!count){const span=hold/codes.length;return codes.map((code,i)=>({code,start:i*span,duration:span}));}
    const consonants=codes.length-count,cspan=consonants?Math.min(.055,hold*.4/consonants):0,vspan=(hold-cspan*consonants)/count;
    let start=0;return codes.map(code=>{const duration=vowels.has(code)?vspan:cspan,item={code,start,duration};start+=duration;return item;});
  }
  function render(id,n,{rate=44100,bpm=96,pitch=0,bank}={}){
    const profile=presets.find(p=>p.id===id);if(!profile)throw new Error('Choose a singing voice.');
    number(rate,8000,192000,'singing sample rate');if(!Number.isInteger(rate))throw new Error('Use a whole sample rate.');number(bpm,40,240,'singing tempo');number(pitch,-24,24,'singing pitch');
    const hold=number(n.duration,1/960,64,'sung note length')*60/bpm,midi=number(n.midi,0,127,'sung pitch'),velocity=number(n.velocity,0,1,'sung level'),v=note(n.vocal||{lyric:'ah',phones:['AA']});
    const release=.10,frames=Math.max(2,Math.round((hold+release)*rate)),out=new Float32Array(frames),frequency=440*2**((midi+pitch-69)/12);
    if(!Number.isInteger(midi))throw new Error('Use a whole MIDI note for singing.');
    if(!velocity||frequency>rate*.43)return out;
    const segments=schedule(v.phones,hold),fade=Math.min(.010,hold*.12);let seed=23063+Math.round(midi*73),previousNoise=0;
    let phase=0,phase2=.23,phase3=.61;
    for(let index=0;index<segments.length;index++){
      const seg=segments[index],code=seg.code,isVowel=vowels.has(code),pair=diphthongs[code]||[code,code],isVoiced=voiced.has(code);
      const first=Math.max(0,Math.round((seg.start-(index?fade:0))*rate)),last=Math.min(frames,Math.round((seg.start+seg.duration+(index===segments.length-1?release:fade))*rate));
      let recording;
      if(id==='vocal-recorded'&&bank?.takes?.[code])recording=Sample.render({regions:[bank.takes[code]],sustain:isVowel,unpitched:!isVowel,release},{duration:Math.min(96,(last-first)/rate)*bpm/60,midi,velocity:1},{rate,bpm,pitch});
      const a=!recording&&isVoiced?table(pair[0],frequency,rate,profile,v.formant):null,b=!recording&&isVoiced?table(pair[1],frequency,rate,profile,v.formant):null;
      for(let i=first;i<last;i++){
        const t=i/rate,local=t-seg.start,progress=clamp(local/seg.duration,0,1),vib=v.vibrato*32*ease((t-.12)/.22)*Math.sin(2*Math.PI*5.2*t),f=frequency*2**(vib/1200),step=f/rate;
        seed=(Math.imul(seed,1664525)+1013904223)|0;const noise=(seed>>>0)/2147483648-1,high=noise-previousNoise;previousNoise=noise;
        let sample=0;
        if(recording)sample=recording[i-first]*.75;
        else if(isVoiced){const morph=ease((progress-.55)/.4),read=p=>at(a,p)*(1-morph)+at(b,p)*morph;sample=read(phase);
          if(id==='vocal-choir')sample=(sample+read(phase2)+read(phase3))/2.1;
          sample+=noise*(profile.air+v.breath*.09)*(isVowel?1:.2);
          if(['V','Z','ZH'].includes(code))sample=sample*.55+high*.075;
        }else{
          const fricative=['S','SH','F','TH','HH'].includes(code),burst=fricative?1:Math.exp(-30*Math.max(0,progress-.22))*ease(progress/.13);
          sample=(code==='HH'?noise*.13:high*(['S','SH','CH','JH'].includes(code)?.24:.12))*burst;
        }
        const overlapOn=index?ease((local+fade)/(fade*2)):1,overlapOff=index<segments.length-1?ease((seg.duration+fade-local)/(fade*2)):1;
        const gate=ease(t/.018)*(t<=hold?1:ease((hold+release-t)/release));
        out[i]+=sample*overlapOn*overlapOff*gate*velocity*.8;
        phase=(phase+step)%1;phase2=(phase2+step*2**(-7/1200))%1;phase3=(phase3+step*2**(8/1200))%1;
      }
    }
    // A small DC blocker also removes mean offsets in imported voice pieces.
    let prior=0,dc=0;const pole=Math.exp(-2*Math.PI*20/rate);let peak=0;
    for(let i=0;i<out.length;i++){const x=out[i];dc=x-prior+pole*dc;prior=x;out[i]=dc;peak=Math.max(peak,Math.abs(dc));}
    const scale=peak>.9?.9/peak:1;for(let i=0;i<out.length;i++)out[i]*=scale;out[0]=0;out[out.length-1]=0;return out;
  }
  const api={catalog,signals,phones,note,words,assign,render,schedule};if(node)module.exports=api;else root.VocalDSP=api;
})(typeof globalThis!=='undefined'?globalThis:this);
