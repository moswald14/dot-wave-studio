(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const Hum=node?require('./dsp/hum-dsp.js'):root.HumDSP;
  const Phrase=node?require('./dsp/hum-phrase.js'):root.HumPhrase;
  function check(samples,rate){
    if(!Number.isInteger(rate)||rate<8000||rate>192000)throw Error('Use audio between 8 and 192 kHz.');
    if(!samples?.length||samples.length>rate*30)throw Error('Choose a take between one sample and 30 seconds.');
    for(const sample of samples)if(!Number.isFinite(sample)||Math.abs(sample)>1.001)throw Error('The take contains an invalid audio sample.');
  }
  function analyse(samples,rate){
    check(samples,rate);
    const processor=Hum.createProcessor(rate),frames=[],hop=Math.round(rate*.25);
    let cycle=null,frequency=0,score=0;
    for(let at=0;at<samples.length;at+=hop){
      const found=processor.process(samples.subarray? samples.subarray(at,at+hop):samples.slice(at,at+hop));frames.push(...found.frames);
      const last=found.frames.findLast(f=>f.voiced),strength=last?last.rms*last.confidence:0;
      if(found.cycle&&last&&strength>score){cycle=Array.from(found.cycle);frequency=last.frequency;score=strength;}
    }
    return {frames,cycle,frequency,duration:samples.length/rate,voicedSeconds:frames.filter(f=>f.voiced).length*.02};
  }
  function notes(analysis,options={}){
    return Phrase.convert(analysis.frames,{...options,useTarget:false,durationSeconds:analysis.duration});
  }
  function insert(C,project,analysis,options={}){
    const part=options.part||'melody',start=options.startBeat??0;
    C.assert(['melody','chords','bass'].includes(part),'Choose Melody, Chords or Bass for your hum.');
    C.assert(Number.isFinite(start)&&start>=0&&start<64,'Place the phrase before measure 16 ends.');
    const converted=notes(analysis,{...options,bpm:project.melody.bpm,root:project.melody.root,scale:options.scale||project.melody.mode});
    C.assert(converted.length,'No clear notes yet. Hum one steady voice, or try a different take.');
    const next=structuredClone(project),track=next.melody.tracks.find(t=>t.id===part),occupied=new Set(track.notes.map(C.noteKey)),inserted=[];
    for(const note of converted){const n={...note,start:Math.round((note.start+start)*1e9)/1e9},key=C.noteKey(n);if(!occupied.has(key)){inserted.push(n);occupied.add(key);}}
    C.assert(inserted.length,'These notes are already here. Move the insertion measure to keep another copy.');
    const end=Math.max(...inserted.map(n=>n.start+n.duration));
    C.assert(end<=64+1e-8,'This phrase extends beyond measure 16. Choose an earlier measure or a shorter take.');
    C.assert(track.notes.length+inserted.length<=2048,'This part can keep up to 2,048 notes.');
    next.melody.bars=Math.max(next.melody.bars,Math.ceil(end/4));track.notes.push(...inserted);
    return {project:C.validate(next),inserted,skipped:converted.length-inserted.length};
  }
  function patch(C,original,analysis,side){
    C.assert(side==='a'||side==='b','Choose wave A or B.');
    C.assert(analysis.cycle?.length===512,'No steady repeating pitch yet. Try a held vowel or a single instrument note.');
    const next=structuredClone(original),voice=next.project[side];
    voice.points=Array.from({length:32},(_,i)=>C.clamp(analysis.cycle[i*16],-1,1));voice.shape='custom';voice.pins=[];
    return C.S.validatePatch(next);
  }
  function preview(samples,sourceRate,rate){
    check(samples,sourceRate);const left=new Float32Array(rate*3);
    const length=Math.min(left.length,Math.floor(samples.length*rate/sourceRate));
    for(let i=0;i<length;i++){const pos=i*sourceRate/rate,a=Math.floor(pos),f=pos-a,fade=Math.min(1,i/(rate*.008),(length-1-i)/(rate*.02));left[i]=((samples[a]||0)*(1-f)+(samples[a+1]||0)*f)*(.5-.5*Math.cos(Math.PI*fade));}
    let peak=0;for(const value of left)peak=Math.max(peak,Math.abs(value));
    return {left,right:left.slice(),rate,duration:3,peak,scale:1};
  }
  const api={analyse,notes,insert,patch,preview};if(node)module.exports=api;else root.CaptureTools=api;
})(typeof globalThis!=='undefined'?globalThis:this);
