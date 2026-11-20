'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const C = require('./core.js'), passed = [];
function test(title, fn) { fn(); passed.push(title); console.log('PASS ' + title); }
const legacyPath = path.join(__dirname, 'legacy-example.studio.json');
const legacyFile = JSON.parse(fs.readFileSync(legacyPath,'utf8'));
function syntheticTake(code='AA',frequency=220){const rate=22050,samples=Float32Array.from({length:rate*.55},(_,i)=>i<rate*.08||i>rate*.46?0:(Math.sin(2*Math.PI*frequency*i/rate)+.3*Math.sin(4*Math.PI*frequency*i/rate))*.23);return C.Voice.analyse(samples,rate,code);}

test('Ten recorded instruments ship 39 valid, distinct source recordings',()=>{
  const catalog=C.Sample.catalog(),bank=C.Sample.signals();assert.equal(catalog.length,10);assert.equal(catalog.reduce((s,v)=>s+v.sampleCount,0),39);
  for(const item of catalog){assert.ok(item.notes.length>=3);for(const region of bank[item.id].sampled.regions){const samples=C.Sample.pcm(C.Sample.region(region));assert.equal(samples.length,region.frames);assert.ok(samples.every(Number.isFinite));assert.ok(C.S.peakOf(samples)>.02);assert.ok(C.S.peakOf(samples)<1);}}
});

test('Every real instrument renders finite three-second previews and editable melody notes',()=>{
  const p=C.blank();for(const item of C.Sample.catalog()){p.melody.tracks[0].instrument=item.id;p.melody.tracks[0].notes=[{start:0,duration:1,midi:item.notes[1],velocity:.7}];C.validate(p);const audio=C.render({project:p,instrument:item.id},'instrument-preview',8000);assert.equal(audio.duration,3);assert.equal(audio.left.length,24000);assert.ok(audio.left.every(Number.isFinite));assert.ok(C.S.peakOf(audio.left)>.001);assert.equal(audio.left.at(-1),0);const notes=C.render(p,'melody',8000);assert.ok(C.S.peakOf(notes.left)>.001);}
});

test('Recorded sample pitch follows MIDI while consonants keep their original pitch',()=>{
  const rate=22050,pcm=C.Sample.encode(Float32Array.from({length:rate},(_,i)=>Math.sin(2*Math.PI*220*i/rate)*.6)),pack={regions:[{root:57,rate,frames:rate,pcm}],release:.1};
  const note={start:0,duration:1,midi:69,velocity:1},pitched=C.Sample.render(pack,note,{rate:8000,bpm:60});
  const amp=f=>{let a=0,b=0;for(let i=800;i<3200;i++){a+=pitched[i]*Math.cos(2*Math.PI*f*i/8000);b+=pitched[i]*Math.sin(2*Math.PI*f*i/8000);}return Math.hypot(a,b)/2400;};assert.ok(amp(440)>.15);assert.ok(amp(220)<.01);
  pack.unpitched=true;assert.deepEqual(C.Sample.render(pack,{...note,midi:48},{rate:8000,bpm:60}),C.Sample.render(pack,{...note,midi:84},{rate:8000,bpm:60}));
});

test('Real instrument choices survive saved arrangements and export their MIDI programs',()=>{
  const p=C.starter();p.song.tracks[0].instrument='real-violin';p.melody.tracks[0].instrument='real-guitar-acoustic';const round=C.open(JSON.parse(C.serialize(p)));assert.equal(round.song.tracks[0].instrument,'real-violin');assert.equal(round.melody.tracks[0].instrument,'real-guitar-acoustic');const midi=C.Song.toMidi(round.song);assert.equal(midi.tracks.find(t=>t.name===p.song.tracks[0].name).program,40);assert.throws(()=>C.legacy(round));
});

test('The guided voice set contains the 15 vowels and 24 consonants of CMU English',()=>{
  assert.equal(C.Voice.phones.length,39);assert.equal(C.Voice.phones.filter(p=>p.vowel).length,15);assert.equal(new Set(C.Voice.phones.map(p=>p.id)).size,39);assert.ok(C.Voice.phones.every(p=>p.word&&p.ipa));assert.ok(C.Voice.phones.some(p=>p.id==='DH'));assert.ok(C.Voice.phones.some(p=>p.id==='TH'));assert.ok(C.Voice.phones.some(p=>p.id==='ZH'));
});

test('Voice analysis trims silence, detects vowel pitch and leaves clean finite boundaries',()=>{
  const take=syntheticTake();assert.ok(take.duration>.30&&take.duration<.45);assert.ok(Math.abs(take.take.root-57)<=1);assert.ok(Math.abs(take.take.pitchHz-220)<4);assert.equal(take.samples[0],0);assert.equal(take.samples.at(-1),0);assert.ok(take.samples.every(Number.isFinite));assert.ok(C.S.peakOf(take.samples)<=.951);assert.throws(()=>C.Voice.analyse(new Float32Array(22050),22050,'AA'));assert.throws(()=>C.Voice.analyse([NaN],22050,'AA'));
});

test('Voice recordings survive project and standalone-bank round trips without altering old sounds',()=>{
  const p=C.blank();p.library=C.W.validateBundle(JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/Recovered-Old-Sounds.library.json'),'utf8')));const before=C.clone(p.library);p.voiceBank.takes.AA=syntheticTake().take;p.voiceBank.takes.SH=syntheticTake('SH').take;p.melody.tracks[0].instrument='voice-AA';
  const file=C.serialize(p),round=C.open(JSON.parse(file));assert.deepEqual(round.voiceBank,p.voiceBank);assert.deepEqual(round.library,before);assert.deepEqual(C.Voice.validate(JSON.parse(JSON.stringify(round.voiceBank))),p.voiceBank);assert.equal(round.library.length,49);assert.throws(()=>C.legacy(round));
});

test('Recorded voice sounds play as notes and phrases join with finite, bounded audio',()=>{
  const p=C.blank();for(const code of ['HH','EH','L','OW'])p.voiceBank.takes[code]=syntheticTake(code).take;const phrase=C.Voice.sequence(p.voiceBank,'HH EH L OW',{rate:8000});assert.ok(phrase.duration>1&&phrase.duration<2);assert.ok(phrase.samples.every(Number.isFinite));assert.ok(C.S.peakOf(phrase.samples)<=1);assert.throws(()=>C.Voice.sequence(p.voiceBank,'AA'));assert.throws(()=>C.Voice.sequence(p.voiceBank,'<script>'));p.melody.tracks[0].instrument='voice-EH';p.melody.tracks[0].notes=[{start:0,duration:2,midi:57,velocity:.7}];const audio=C.render(p,'melody',8000);assert.ok(C.S.peakOf(audio.left)>.001);
});

test('Damaged voice banks and missing recorded instruments reject before replacing a project',()=>{
  const p=C.blank(),before=C.serialize(p);p.voiceBank.takes.AA=syntheticTake().take;const bad=C.clone(p);bad.voiceBank.takes.AA.frames++;assert.throws(()=>C.validate(bad));const missing=C.blank();missing.melody.tracks[0].instrument='voice-AA';assert.throws(()=>C.validate(missing));const root=C.clone(p);root.voiceBank.takes.AA.root=128;assert.throws(()=>C.validate(root));assert.equal(C.serialize(C.blank()),before);
});

test('Both displayed ends share one editable point and seam strokes leave unrelated dots intact',()=>{
  const points=C.S.preset('sine'),copy=[...points],drawn=C.Shape.drawClosed(points,{slot:31,value:.2},{slot:32,value:.6});
  assert.equal(drawn[0],.6);assert.equal(drawn[31],.2);assert.deepEqual(drawn.slice(1,31),points.slice(1,31));assert.deepEqual(points,copy);
  const reverse=C.Shape.drawClosed(points,{slot:32,value:-.2},{slot:30,value:-.6});assert.equal(reverse[0],-.2);assert.equal(reverse[30],-.6);assert.ok(Math.abs(reverse[31]+.4)<1e-12);assert.deepEqual(reverse.slice(1,30),points.slice(1,30));
  assert.deepEqual(C.Shape.displayArc(30,32),[30,31,0]);assert.equal(C.Shape.displayArc(0,32).length,32);assert.throws(()=>C.Shape.displayArc(31,33));
});

test('Zero smoothness keeps existing sounds identical at every phase and pitch multiple',()=>{
  for(const shape of ['sine','square','sawtooth'])for(const ratio of [1,3,8]){
    const voice={...C.S.source(shape),phase:71.3,ratio,level:.63,inverted:true},points=C.S.centered(voice.points),scale=Math.max(1,C.S.peakOf(points));
    const expected=Float64Array.from({length:C.S.SIZE},(_,i)=>C.S.sample(points,i/C.S.SIZE*ratio+voice.phase/360)*voice.level*-1/scale);
    const actual=C.S.renderSource(voice);for(let i=0;i<actual.length;i++)assert.ok(Math.abs(actual[i]-expected[i])<1e-14);
  }
});

test('Smoothness rounds the periodic curve continuously without overshoot or destroying its dots',()=>{
  const voice=C.S.source('square'),original=[...voice.points],rough=table=>table.reduce((sum,v,i)=>sum+(v-table[(i+table.length-1)%table.length])**2,0);
  let previous=Infinity;for(const amount of [0,.125,.5,1]){voice.smoothness=amount;const outline=C.S.sourceOutline(voice),value=rough(outline);assert.ok(value<previous);previous=value;assert.ok(outline.every(v=>Number.isFinite(v)&&Math.abs(v)<=1));assert.equal(C.S.sample(outline,0),C.S.sample(outline,1));}
  assert.deepEqual(voice.points,original);
  const points=Array.from({length:32},(_,i)=>Math.sin(i*.7)*.5+Math.cos(i*1.3)*.25),rounded=C.S.shapePoints({...voice,points,smoothness:1}),sample=t=>C.S.shapeSample(rounded,t,1),epsilon=1e-7;
  assert.equal(sample(0),sample(1));const left=(sample(0)-sample(-epsilon))/epsilon,right=(sample(epsilon)-sample(0))/epsilon;assert.ok(Math.abs(left-right)<.001);
  const a=C.S.sourceOutline({...voice,smoothness:.5-1e-6}),b=C.S.sourceOutline({...voice,smoothness:.5+1e-6});assert.ok(Math.max(...a.map((v,i)=>Math.abs(v-b[i])))<.0001);
});

test('Independent smoothness survives save/open and reaches previews and kept sounds',()=>{
  const p=C.blank();p.patch.project.a=C.S.source('square');p.patch.project.b=C.S.source('sawtooth');const points=C.clone(p.patch.project),dry=C.renderPatchPreview(p.patch,'result',{rate:8000});
  p.patch.project.a.smoothness=.27;p.patch.project.b.smoothness=.81;const round=C.open(JSON.parse(C.serialize(p)));assert.equal(round.patch.project.a.smoothness,.27);assert.equal(round.patch.project.b.smoothness,.81);assert.deepEqual(round.patch.project.a.points,points.a.points);assert.deepEqual(round.patch.project.b.points,points.b.points);
  assert.notDeepEqual(C.renderPatchPreview(round.patch,'result',{rate:8000}).left,dry.left);const kept=C.saveSound(round,'Rounded seam');assert.equal(kept.frequency,round.patch.pitch);assert.ok(kept.real.every(Number.isFinite));
  const old=C.clone(p);delete old.patch.project.a.smoothness;assert.equal(C.validate(old).patch.project.a.smoothness,0);
  for(const bad of [-.01,1.01,NaN,'0.5']){const invalid=C.clone(p);invalid.patch.project.a.smoothness=bad;assert.throws(()=>C.validate(invalid));}
});
test('Cyclic landmarks find isolated peaks, flat tops, troughs and seam crossings',()=>{
  const sine=C.Shape.landmarks(C.S.preset('sine'));assert.deepEqual(sine.peaks,[8]);assert.deepEqual(sine.troughs,[24]);assert.equal(sine.crossings.length,2);
  const square=C.Shape.landmarks(C.S.preset('square'));assert.deepEqual(square.peaks,[7]);assert.deepEqual(square.troughs,[23]);assert.equal(square.crossings.length,2);assert.ok(square.crossings.some(c=>c.at>31));
  const flat=C.Shape.landmarks(Array(32).fill(0));assert.deepEqual(flat.peaks,[]);assert.deepEqual(flat.troughs,[]);assert.deepEqual(flat.edges,[]);
});
test('Peak and trough levels change independently without rewriting the source drawing',()=>{
  const source=C.S.preset('sine'),copy=[...source],peak=C.Shape.levels(source,{peak:.4}),both=C.Shape.levels(peak,{trough:.7});
  assert.deepEqual(source,copy);assert.ok(Math.abs(Math.max(...peak)-.4)<1e-8);assert.equal(Math.min(...peak),-1);
  assert.ok(Math.abs(Math.max(...both)-.4)<1e-8);assert.ok(Math.abs(Math.min(...both)+.7)<1e-8);assert.ok(both.every(v=>v>=-1&&v<=1));
  assert.ok(Math.max(...C.Shape.levels(Array(32).fill(0),{peak:.6}))>.59);
});
test('Sculpting brushes wrap across the cycle seam and leave distant dots untouched',()=>{
  const source=Array(32).fill(0),bump=C.Shape.bump(source,0,1,2);assert.equal(bump[0],1);assert.equal(bump[31],bump[1]);assert.ok(bump[31]>0);assert.equal(bump[16],0);
  const grab=C.Shape.grab(bump,[0],-.4,2);assert.ok(Math.abs(grab[0]-.6)<1e-8);assert.equal(grab[16],0);assert.ok(grab.every(v=>v>=-1&&v<=1));assert.deepEqual(source,Array(32).fill(0));
  const edge=C.Shape.edge(C.S.preset('sine'),0,2);assert.equal(edge[0],0);assert.equal(edge[3],C.S.preset('sine')[3]);assert.equal(edge[29],C.S.preset('sine')[29]);
});
test('Arc tools preserve their endpoints and reject disconnected selections',()=>{
  const source=C.S.preset('sine'),selection=C.Shape.arc(0,8),line=C.Shape.transform(source,selection,'line'),curve=C.Shape.transform(source,selection,'curve');
  assert.equal(line[0],source[0]);assert.equal(line[8],source[8]);assert.equal(curve[0],source[0]);assert.equal(curve[8],source[8]);assert.equal(line[20],source[20]);assert.equal(curve[20],source[20]);assert.ok(curve[2]<line[2]);
  assert.throws(()=>C.Shape.transform(source,[0,4,8],'line'));assert.throws(()=>C.Shape.check(Array(32).fill(NaN)));
  assert.deepEqual(C.Shape.arcBetween(30,2),[30,31,0,1,2]);const joined=C.Shape.transform(source,C.Shape.arcBetween(30,2),'curve');assert.equal(joined[30],source[30]);assert.equal(joined[2],source[2]);assert.equal(joined[16],source[16]);
  const moved=C.Shape.shift(source,1);assert.equal(moved[0],source[31]);assert.equal(moved[9],source[8]);
});
test('Rounding and sharpening change the contour while staying within editable bounds',()=>{
  const square=C.S.preset('square'),round=C.Shape.transform(square,[],'round');assert.ok(C.Shape.landmarks(round).maxEdge<C.Shape.landmarks(square).maxEdge);
  const sine=C.S.preset('sine'),sharp=C.Shape.transform(sine,[],'sharpen');assert.ok(C.Shape.landmarks(sharp).maxEdge>C.Shape.landmarks(sine).maxEdge);assert.ok(sharp.every(v=>Math.abs(v)<=1));
  const centered=C.Shape.transform(Array.from({length:32},(_,i)=>.4+Math.sin(i/32*Math.PI*2)*.3),[],'center');assert.ok(Math.abs(centered.reduce((a,b)=>a+b,0))<1e-8);
});
test('Mini previews contain exactly three seconds at the saved pitch with click-free edges',()=>{
  const wave={...C.W.stockWaves()[0],frequency:220};const before=JSON.stringify(wave);
  for(const rate of [8000,44100,48000]){const a=C.renderSoundPreview(wave,{rate});assert.equal(a.duration,3);assert.equal(a.left.length,rate*3);assert.equal(a.right.length,rate*3);assert.equal(Math.abs(a.left[0]),0);assert.equal(Math.abs(a.left.at(-1)),0);assert.ok(a.left.every(Number.isFinite));}
  const a=C.renderSoundPreview(wave,{rate:8000}),amplitude=f=>{let x=0,y=0;for(let i=0;i<a.left.length;i++){x+=a.left[i]*Math.cos(2*Math.PI*f*i/a.rate);y+=a.left[i]*Math.sin(2*Math.PI*f*i/a.rate);}return 2*Math.hypot(x,y)/a.left.length;};assert.ok(amplitude(220)>.5);assert.ok(amplitude(440)<.01);assert.equal(JSON.stringify(wave),before);
});
test('Preview effects end at three seconds and every recovered sound produces finite audio',()=>{
  const waves=C.W.validateBundle(JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/Recovered-Old-Sounds.library.json'),'utf8')));assert.equal(waves.length,49);
  for(const wave of waves){const a=C.renderSoundPreview(wave,{rate:8000});assert.equal(a.left.length,24000);assert.ok(a.left.every(Number.isFinite));assert.ok(C.S.peakOf(a.left)<=.951);}
  const wet={...waves[0],effects:C.FX.validate([{type:'echo',mix:.4}])};assert.notDeepEqual(C.renderSoundPreview(wet,{rate:8000}).left,C.renderSoundPreview({...wet,effects:[]},{rate:8000}).left);
});
test('Wave A, Wave B and the live result have independent three-second previews',()=>{
  const p=C.blank(),before=JSON.stringify(p.patch);p.patch.project.b.ratio=2;
  for(const target of ['a','b','result']){const a=C.renderPatchPreview(p.patch,target,{rate:8000});assert.equal(a.left.length,24000);assert.equal(a.duration,3);assert.ok(a.left.every(Number.isFinite));assert.ok(Math.abs(a.left.at(-1))<1e-8);}
  const a=C.renderPatchPreview(p.patch,'a',{rate:8000}),b=C.renderPatchPreview(p.patch,'b',{rate:8000});assert.notDeepEqual(a.left,b.left);assert.equal(JSON.stringify(p.patch),before);
  p.patch.freePair={a:220,b:330};assert.equal(C.renderPatchPreview(p.patch,'result',{rate:8000}).duration,3);
});
test('Classic starter migrates with all sounds, notes, phrases, beat placements and settings', () => {
  const migrated = C.open(legacyFile);
  assert.equal(migrated.song.name, legacyFile.song.song.name);
  assert.equal(migrated.library.length, legacyFile.song.library.length);
  assert.deepEqual(migrated.song.tracks.map(t=>t.phrases), legacyFile.song.song.tracks.map(t=>t.phrases));
  assert.equal(migrated.song.clips.length, legacyFile.song.song.clips.length);
  assert.equal(migrated.patch.pitch, legacyFile.patch.pitch);
  assert.deepEqual(migrated.melody, C.M.validate(legacyFile.melody));
});
test('Version 2 files round-trip and remain playable', () => {
  const starter = C.starter(), reopened=C.open(JSON.parse(C.serialize(starter)));
  assert.deepEqual(reopened, starter);
  const audio=C.render(reopened,'song',8000); assert.equal(audio.duration,20);
  assert.ok(audio.left.some(x=>Math.abs(x)>.01)); assert.ok(audio.left.every(Number.isFinite));
  assert.ok(C.S.peakOf(audio.left)<=.981);
});
test('Saved patterns and independent song copies do not change one another', () => {
  const p=C.starter(), pattern=p.patterns[0], selection=C.addPattern(p,pattern,0), clip=C.findClip(p,selection);
  const pitch=pattern.notes[0].midi;clip.notes[0].midi+=1;
  assert.equal(pattern.notes[0].midi,pitch);assert.equal(p.song.tracks[0].phrases[0].notes[0].midi,pitch);
  assert.notEqual(clip.notes,pattern.notes);
});
test('Group note moves and resizes are atomic and reject collisions or boundaries', () => {
  const track={notes:[{start:0,midi:60,duration:.5,velocity:.6},{start:1,midi:64,duration:.5,velocity:.6},{start:2,midi:62,duration:.5,velocity:.6}]};
  const keys=C.transformNotes(track,['0:60','1:64'],.25,2,.25,8);assert.deepEqual(keys,['0.25:62','1.25:66']);
  const before=JSON.stringify(track);assert.throws(()=>C.transformNotes(track,keys,-.5,0,0,8));assert.equal(JSON.stringify(track),before);
  assert.throws(()=>C.transformNotes(track,['0.25:62'],1.75,0,0,8));assert.equal(JSON.stringify(track),before);
});
test('Sound effects travel through the sound box into the rendered song', () => {
  const p=C.blank();p.patch.project.effects=C.FX.validate([{type:'echo',mix:.3}]);
  const wave=C.saveSound(p,'Echo dot');p.melody.tracks[0].instrument=wave.id;p.melody.tracks[0].notes=[{start:0,midi:60,duration:.5,velocity:.8}];
  const pattern=C.patternFromPart(p,'melody',null,'Echo idea');C.addPattern(p,pattern,0);
  const wet=C.render(p,'song',8000);wave.effects=[];const dry=C.render(p,'song',8000);
  assert.notDeepEqual(wet.left,dry.left);assert.equal(pattern.instrument,wave.id);
});
test('Independent pitches produce the actual two-frequency collision', () => {
  const p=C.blank();p.patch.freePair={a:220,b:330};p.patch.project.a=C.S.source('sine');p.patch.project.b=C.S.source('sine');
  const a=C.render(p,'sound',8000), amplitude=f=>{let x=0,y=0;for(let i=0;i<a.left.length;i++){x+=a.left[i]*Math.cos(2*Math.PI*f*i/a.rate);y+=a.left[i]*Math.sin(2*Math.PI*f*i/a.rate);}return 2*Math.hypot(x,y)/a.left.length;};
  assert.ok(amplitude(220)>.2);assert.ok(amplitude(330)>.2);assert.ok(amplitude(440)<.02);
});
test('Stereo WAV, note MIDI, and handoff ZIP have valid file bytes and useful content', () => {
  const p=C.starter();p.song.tracks[0].pan=-.7;const audio=C.render(p,'song',8000),wav=C.encodeStereo(audio),v=new DataView(wav);
  assert.equal(Buffer.from(wav).subarray(0,4).toString(),'RIFF');assert.equal(v.getUint16(22,true),2);assert.equal(v.getUint32(24,true),8000);
  assert.equal(v.getUint32(40,true),audio.left.length*4);assert.notDeepEqual(audio.left,audio.right);
  const midi=C.IO.encode(C.Song.toMidi(p.song)),decoded=C.IO.decode(midi);assert.equal(Math.round(decoded.bpm),96);assert.ok(decoded.tracks.some(t=>t.channel===9&&t.notes.length));
  const zip=C.IO.zipStore([{name:'Listen.wav',data:wav},{name:'Notes.mid',data:midi},{name:'Editable.studio.json',data:C.serialize(p)}]);assert.equal(new DataView(zip.buffer,zip.byteOffset,zip.byteLength).getUint32(0,true),0x04034b50);
});
test('Recorded PCM and waveform clips survive new and classic project round-trips', () => {
  const p=C.starter();p.song.audio.push({id:'recording',name:'Test recording',start:0,rate:8000,volume:.3,mute:false,samples:Float32Array.from({length:800},(_,i)=>Math.sin(i/7)*.3)});
  const wave=p.library[0];p.song.waves.push({id:'wave-clip',name:'Wave',start:8,duration:4,sourceBeats:4,trimStart:0,trimEnd:4,stretch:1,frequency:134,loop:true,wave:{real:wave.real,imag:wave.imag},volume:.2});
  const file=C.serialize(p),round=C.open(JSON.parse(file)),back=C.open(C.legacy(round));
  assert.equal(back.song.audio[0].samples.length,800);assert.equal(back.song.waves.length,1);assert.ok(Math.abs(back.song.audio[0].samples[10]-p.song.audio[0].samples[10])<1/16000);
  C.render(back,'song',8000);
});
test('Damaged files, missing instruments and oversized note edits reject without mutating the original', () => {
  const p=C.starter(),before=C.serialize(p),bad=JSON.parse(before);bad.melody.tracks[0].instrument='missing';assert.throws(()=>C.open(bad));assert.equal(C.serialize(p),before);
  const broken=JSON.parse(before);broken.song.tracks[0].phrases[0].repeats=1000;assert.throws(()=>C.open(broken));
  const last=JSON.parse(before);last.library[0].real[1]=Infinity;assert.throws(()=>C.open(last));
});
test('The actual Classic application opens newly exported projects and their default drum program', () => {
  const harness=require('./classic-harness.cjs');harness.globals.fromNew=C.legacy(C.starter());harness.run('openStudioProject(fromNew)');
  assert.equal(harness.run('mix.song.name'),'Windowlight');assert.equal(harness.run('melody.project.tracks[0].notes.length'),24);assert.equal(harness.run('mix.playing'),false);
});
test('Actual 64-measure music projects migrate with all their custom sounds and notes', () => {
  const oldRoot=path.join(__dirname,'fixtures');
  const files=['After-Hours.studio.json','Rest-Here-Traveler.studio.json'];
  for(const filename of files){const raw=JSON.parse(fs.readFileSync(path.join(oldRoot,filename),'utf8')),p=C.open(raw),back=C.open(JSON.parse(C.serialize(p)));assert.equal(back.song.bars,64);assert.equal(back.library.length,raw.song.library.length);assert.deepEqual(back.song.tracks.map(t=>t.notes),raw.song.song.tracks.map(t=>t.notes));}
});
require('./arrangement-verify.cjs')(C,test);
require('./shaper-verify.cjs')(C,test);
require('./woof-verify.cjs')(C,test);
require('./vocal-verify.cjs')(C,test);
async function transportTests(){
  passed.push(...await require('./woof-verify.cjs').asyncChecks(C));
  passed.push(...await require('./recorder-harness.cjs')());
  class Param{constructor(value=1){this.value=value;}setValueAtTime(v){this.value=v;}linearRampToValueAtTime(v){this.value=v;}setTargetAtTime(v){this.value=v;}cancelScheduledValues(){}}
  class Node{constructor(){this.gain=new Param();this.frequency=new Param();this.Q=new Param();this.threshold=new Param();this.knee=new Param();this.ratio=new Param();this.attack=new Param();this.release=new Param();this.starts=[];}connect(){}disconnect(){}start(...args){this.starts.push(args);}stop(at){this.stopped=true;this.stopTime=at;}}
  class Context{constructor(){this.currentTime=10;this.sampleRate=8000;this.destination=new Node();}async resume(){}createGain(){return new Node();}createBiquadFilter(){return new Node();}createDynamicsCompressor(){return new Node();}createWaveShaper(){return new Node();}createAnalyser(){return new Node();}createBufferSource(){return new Node();}createBuffer(channels,length,rate){return {copyToChannel(){},duration:length/rate,length};}}
  const globals={window:{AudioContext:Context},DotWave:C,setTimeout,clearTimeout,Float32Array,structuredClone,URL,Blob};vm.createContext(globals);vm.runInContext(fs.readFileSync(path.join(__dirname,'audio.js'),'utf8'),globals);const Audio=globals.window.DotAudio;
  const p=C.starter(),audio=new Audio(()=>{}),data=C.render(p,'song',8000);
  let resolve;audio.render=()=>new Promise(r=>resolve=r);const start=audio.play(p,'song');for(let i=0;i<10&&!resolve;i++)await Promise.resolve();assert.equal(typeof resolve,'function');audio.stop();resolve(data);await start;assert.equal(audio.playing,false);assert.equal(audio.sources.size,0);passed.push('Stop cancels a queued render before it can start sound');
  audio.render=async()=>data;await audio.play(p,'song');const original=audio.origin;audio.context.currentTime+=1;audio.install(data,audio.position(),true);assert.ok(Math.abs(audio.origin-original)<1e-8);passed.push('Live audio replacement keeps the existing musical clock');
  audio.context.currentTime+=1;const position=audio.position();audio.pause();assert.equal(audio.playing,false);assert.ok(Math.abs(audio.position()-position)<1e-8);audio.stop();assert.equal(audio.position(),0);passed.push('Pause keeps the cursor and Stop resets it');
  await audio.preview(p,36,'drums');assert.equal(audio.sources.size,1);assert.ok([...audio.sources][0].source.starts.length);audio.stop();passed.push('Pocket drum previews resolve the correct saved waveform');
  audio.render=async(project,scope,options={})=>C.render(project,scope,options.rate||8000);await audio.play(p,'song');const backing=audio.current.source;
  await audio.previewSound(p.library[0]);const first=audio.mini.entry;assert.equal(audio.mini.id,p.library[0].id);assert.equal(first.source.buffer.length,24000);assert.equal(first.source.loop,false);assert.equal(first.source.stopTime-first.source.starts[0][0],3);assert.equal(audio.current.source,backing);assert.equal(audio.playing,true);
  await audio.previewSound(p.library[1]);assert.equal(audio.mini.id,p.library[1].id);assert.equal(audio.sources.size,2);assert.ok(!audio.sources.has(first));assert.equal(audio.current.source,backing);passed.push('Mini previews are exclusive, finite and independent of background playback');
  const last=audio.mini.entry;last.source.onended();assert.equal(audio.mini,null);assert.equal(audio.sources.size,1);assert.equal(audio.playing,true);passed.push('A completed mini preview clears only its own player');
  let previewResolve;audio.render=()=>new Promise(r=>previewResolve=r);const waiting=audio.previewSound(p.library[0]);for(let i=0;i<10&&!previewResolve;i++)await Promise.resolve();assert.equal(typeof previewResolve,'function');audio.stop();previewResolve(C.renderSoundPreview(p.library[0],{rate:8000}));await waiting;assert.equal(audio.mini,null);assert.equal(audio.miniPending,null);assert.equal(audio.sources.size,0);assert.equal(audio.playing,false);passed.push('Stop cancels a mini preview that is still preparing');
  const pendingRenders=[];audio.render=()=>new Promise(resolve=>pendingRenders.push(resolve));const queued=audio.play(p,'song');for(let i=0;i<10&&!pendingRenders.length;i++)await Promise.resolve();audio.refresh(p);await new Promise(r=>setTimeout(r,140));assert.equal(pendingRenders.length,2);pendingRenders[0](data);await queued;assert.equal(audio.playing,false);assert.equal(audio.pending,true);pendingRenders[1](data);await new Promise(r=>setTimeout(r,10));assert.equal(audio.playing,true);assert.equal(audio.pending,false);audio.stop();passed.push('An edit during playback preparation replaces the old render without clearing the pending state');
  const withSections=C.clone(p);withSections.sections=[{id:'return',name:'Return',from:2,to:4}];let heard;audio.render=async(project,scope,options)=>{heard={scope,options};return data;};await audio.play(withSections,'section',0,{sectionId:'return',soloIds:[p.song.tracks[0].id]});assert.equal(audio.startBeat,8);assert.equal(heard.scope,'section');assert.equal(heard.options.audition.sectionId,'return');assert.equal(heard.options.audition.soloIds[0],p.song.tracks[0].id);audio.stop();passed.push('Section playback carries its start measure and listening-only solos to the renderer');
  console.log('PASS playback cancellation, live clock and pause');
}
transportTests().then(()=>{const report={version:require('./package.json').version,checkedAt:new Date().toISOString(),passed:passed.length,checks:passed};fs.writeFileSync(process.argv[2]?path.resolve(process.argv[2]):path.join(__dirname,'verification.json'),JSON.stringify(report,null,2));console.log(passed.length+' checks passed.');}).catch(error=>{console.error(error);process.exitCode=1;});
