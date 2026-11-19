'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
module.exports=(C,test)=>{
  const P=C.Patch;
  test('WOOF calls browser timers with their proper window receiver',()=>{
    let cleared=0;const globals={StudioDSP:C.S,CollisionAudio:C.Collision,AmpTone:require('./dsp/amp-tone.js'),EffectsDSP:C.FX,timerBoundary:true,setTimeout:function(){assert.equal(this.timerBoundary,true);return 1;},clearTimeout:function(){assert.equal(this.timerBoundary,true);cleared++;}};
    vm.createContext(globals);vm.runInContext(fs.readFileSync(path.join(__dirname,'dsp/patch-tone.js'),'utf8'),globals);new globals.PatchTone.Wander({next(){},hear(){},stopAudio(){}}).stop();assert.equal(cleared,2);
  });
  test('Original patch and WOOF switchboard files retain their recipes and keyboard tuning',()=>{
    const patch=C.blank().patch,board={kind:'dot-patch-switchboard',version:1,patch,root:true,shift:-1,octaves:3},opened=P.importFile(board);assert.equal(opened.recipe.rootMode,'captured');assert.equal(opened.shift,-1);assert.equal(opened.octaves,3);assert.deepEqual(opened.recipe.patch,patch);assert.deepEqual(P.importFile(patch).recipe.patch,patch);assert.throws(()=>P.importFile({...board,root:'yes'}));
    const p=C.blank(),before=p.library.length;assert.throws(()=>C.savePatchTone(p,'Invalid','wrong'));assert.equal(p.library.length,before);
  });
  test('WOOF restores all twelve phone pairs and the original dial-tone frequencies',()=>{
    const expected=[[697,1209],[697,1336],[697,1477],[770,1209],[770,1336],[770,1477],[852,1209],[852,1336],[852,1477],[941,1209],[941,1336],[941,1477]];
    P.KEYS.forEach((key,i)=>assert.deepEqual(P.phonePair(key),{a:expected[i][0],b:expected[i][1]}));assert.deepEqual(P.dialPair(),{a:350,b:440});assert.throws(()=>P.phonePair('A'));
  });
  test('WOOF ranges honor the audio device limit and wandering keeps two distinct in-range tones',()=>{
    assert.deepEqual(P.range(134,20000,8000),{low:134,high:3600});assert.throws(()=>P.range(500,400));assert.throws(()=>P.range(4000,8000,8000));
    for(const bounds of [P.range(20,21),P.range(134,1200)])for(const value of [0,.5,1]){const pair=P.randomPair(bounds,{a:bounds.low,b:bounds.high},()=>value);assert.notEqual(pair.a,pair.b);assert.ok(Object.values(pair).every(n=>n>=bounds.low&&n<=bounds.high));}
    assert.equal(P.safeLevel(-18,{a:134,b:9000}),-42);assert.equal(P.safeLevel(-10,{a:134,b:268}),-18);
  });
  test('A wandering patch changes pitches and optional outlines while retaining warmth and effects',()=>{
    const p=C.blank();p.patch.project.a.pins=[8];p.patch.project.effects=C.FX.validate([{type:'echo'}]);p.patch.project.amp.drive=3;p.patch.project.amp.enabled=true;const before=C.clone(p.patch);
    const kept=P.randomPatch(p.patch,{low:200,high:900,shapes:false},()=>.5);assert.deepEqual(kept.project,before.project);assert.deepEqual(p.patch,before);assert.ok(kept.freePair.a>=200);
    const changed=P.randomPatch(p.patch,{low:200,high:900,shapes:true},()=>.5);assert.notEqual(changed.project.a.shape,p.patch.project.a.shape);assert.deepEqual(changed.project.effects,before.project.effects);assert.equal(changed.project.amp.drive,3);assert.deepEqual(changed.project.a.pins,[]);
  });
  test('Patch keyboard concert and captured tuning transpose both tones by the same interval',()=>{
    const patch=P.setPair(C.blank().patch,{a:220,b:330});const concert=P.recipe(patch),captured=P.recipe(patch,'captured');
    assert.deepEqual(P.notePair(concert,69),{a:440,b:660});assert.deepEqual(P.notePair(captured,60),{a:220,b:330});assert.deepEqual(P.notePair(captured,72),{a:440,b:660});assert.equal(P.playable({a:440,b:9000},8000),false);assert.throws(()=>P.notePair(concert,128));
  });
  test('Kept patch tones round-trip complete recipes and load both sources without changing music',()=>{
    const p=C.starter();p.patch=P.setPair(p.patch,{a:220,b:330});p.patch.project.a.smoothness=.73;p.patch.project.a.pins=[3,8];p.patch.project.mode='multiply';p.patch.project.amount=.6;p.patch.project.effects=C.FX.validate([{type:'echo',mix:.22}]);p.patch.inverted=true;
    const before=C.clone(p.patch),song=C.clone(p.song),tone=C.savePatchTone(p,'Copper crickets','captured'),opened=C.open(JSON.parse(C.serialize(p)));
    assert.deepEqual(opened.library.at(-1).patchTone.patch,before);assert.equal(opened.library.at(-1).patchTone.rootMode,'captured');p.patch=C.blank().patch;C.loadPatchTone(p,tone.id);assert.deepEqual(p.patch,before);assert.deepEqual(p.song,song);p.patch.freePair.a=250;assert.equal(tone.patchTone.patch.freePair.a,220);assert.throws(()=>C.legacy(opened),/patch tones/);
  });
  test('Saved patch previews retain the actual two-pitch sound rather than the repeating thumbnail',()=>{
    const p=C.blank();p.patch=P.setPair(p.patch,{a:220,b:337});const tone=C.savePatchTone(p,'Uneven stars');const actual=C.renderSoundPreview(tone,{rate:8000}),expected=C.renderPatchPreview(p.patch,'result',{rate:8000});assert.deepEqual(actual.left,expected.left);assert.equal(actual.left.length,24000);assert.ok(actual.left.at(-1)===0);
  });
  test('Patch instruments render the two concert pitches in melody notes and keep their ratio',()=>{
    const patch=P.setPair(C.blank().patch,{a:220,b:330}),signal={patchTone:P.recipe(patch)},note={start:0,duration:1,midi:69,velocity:1};const audio=C.Song.renderNote('test-patch',signal,note,{rate:8000,bpm:60});
    const amp=f=>{let x=0,y=0;for(let i=800;i<6400;i++){x+=audio[i]*Math.cos(2*Math.PI*f*i/8000);y+=audio[i]*Math.sin(2*Math.PI*f*i/8000);}return Math.hypot(x,y)/5600;};assert.ok(amp(440)>.08);assert.ok(amp(660)>.08);assert.ok(amp(880)<.01);assert.equal(audio[0],0);assert.equal(audio.at(-1),0);
    const silent=C.Song.renderNote('high',{patchTone:P.recipe(P.setPair(patch,{a:20,b:20000}))},note,{rate:8000,bpm:60});assert.ok(silent.every(x=>x===0));
  });
  test('Saved patch instruments stay identical through melody placements and song export',()=>{
    const p=C.blank();p.patch=P.setPair(p.patch,{a:220,b:331});const tone=C.savePatchTone(p,'Velvet oddness');p.melody.tracks[0].instrument=tone.id;p.melody.tracks[0].notes=[{start:0,duration:1,midi:60,velocity:.7}];const pattern=C.patternFromPart(p,'melody',null,'Patch phrase');C.addPattern(p,pattern,0);
    const before=C.render(p,'song',8000),opened=C.open(JSON.parse(C.serialize(p))),after=C.render(opened,'song',8000);assert.deepEqual(after.left,before.left);assert.ok(before.left.some(x=>Math.abs(x)>.001));assert.equal(opened.patterns.length,p.patterns.length);
  });
  test('Library import distinguishes a full patch recipe from an otherwise matching wave snapshot',()=>{
    const p=C.blank(),tone=C.savePatchTone(p,'Tone'),flat=C.clone(tone);delete flat.patchTone;const merge=C.W.prepareImport([flat],[tone],()=>C.id('copy'));assert.equal(merge.waves.length,2);assert.ok(merge.waves[1].patchTone);assert.notEqual(merge.waves[0].id,merge.waves[1].id);const invalid=C.clone(tone);invalid.patchTone=null;assert.throws(()=>C.W.validateWave(invalid));
  });
  test('Discovery history accepts original WOOF recipes and rejects damaged entries without leaking into songs',()=>{
    const p=C.blank(),item={id:'wander-one',created:1,patch:p.patch,level:-36,liked:true};const values=P.history({kind:'dot-woof-history',version:1,items:[item]});assert.equal(values[0].liked,true);assert.deepEqual(values[0].patch,p.patch);assert.throws(()=>P.history({kind:'dot-woof-history',version:1,items:[item,item]}));assert.throws(()=>P.history({kind:'dot-woof-history',version:1,items:[{...item,level:0}]}));assert.ok(!C.serialize(p).includes('dot-woof-history'));
  });
};

module.exports.asyncChecks=async C=>{
  const passed=[],jobs=new Map();let serial=0,changes=0,hears=0,resolveHear;
  const timers={setTimeout:(fn,ms)=>{const id=++serial;jobs.set(id,{fn,ms});return id;},clearTimeout:id=>jobs.delete(id)};
  const wander=new C.Patch.Wander({next:()=>{changes++;return C.blank().patch;},hear:()=>{hears++;return new Promise(resolve=>resolveHear=resolve);},stopAudio(){},timers});
  const pending=wander.start(.5);assert.equal(changes,1);wander.stop();resolveHear();await pending;assert.equal(jobs.size,0);assert.equal(wander.running,false);passed.push('Stop cancels a WOOF start while audio is still preparing');
  const active=new C.Patch.Wander({next:()=>{changes++;return C.blank().patch;},hear:async()=>{hears++;},stopAudio(){},timers});await active.start(2);const cycle=[...jobs.values()].find(j=>j.ms===2000),limit=[...jobs.values()].find(j=>j.ms===60000);assert.ok(cycle&&limit);active.stop();const before=changes;await cycle.fn();assert.equal(changes,before);assert.equal(jobs.size,0);passed.push('A stopped wandering callback cannot change the patch or restart sound');
  await active.start(1);[...jobs.values()].find(j=>j.ms===60000).fn();assert.equal(active.running,false);assert.equal(jobs.size,0);passed.push('WOOF wandering has a deterministic sixty-second session limit');
  class Param{constructor(value=1){this.value=value;}setValueAtTime(v){this.value=v;}linearRampToValueAtTime(v){this.value=v;}setTargetAtTime(v){this.value=v;}cancelScheduledValues(){}}
  class Node{constructor(){for(const key of ['gain','frequency','Q','threshold','knee','ratio','attack','release','delayTime','detune'])this[key]=new Param();}connect(){}disconnect(){this.disconnected=true;}start(){this.started=true;}stop(){this.stopped=true;}setPeriodicWave(){}}
  let blockResume=false,releaseResume;
  class Context{constructor(){this.currentTime=0;this.sampleRate=8000;this.destination=new Node();}resume(){return blockResume?new Promise(resolve=>releaseResume=resolve):Promise.resolve();}createGain(){return new Node();}createBiquadFilter(){return new Node();}createDynamicsCompressor(){return new Node();}createWaveShaper(){return new Node();}createAnalyser(){return new Node();}createOscillator(){return new Node();}createPeriodicWave(){return {};}createDelay(){return new Node();}createBufferSource(){return new Node();}createBuffer(channels,length,rate){return {copyToChannel(){},duration:length/rate,length};}}
  const globals={window:{AudioContext:Context},DotWave:C,setTimeout,clearTimeout,Float32Array,structuredClone,URL,Blob};vm.createContext(globals);vm.runInContext(fs.readFileSync(path.join(__dirname,'audio.js'),'utf8'),globals);const audio=new globals.window.DotAudio(()=>{}),recipe=C.Patch.recipe(C.blank().patch);
  blockResume=true;const late=audio.startPatch('late',recipe);audio.releasePatch('late');releaseResume();await late;assert.equal(audio.patchVoices.size,0);blockResume=false;passed.push('Releasing a patch key before audio permission resolves prevents a late note');
  audio.render=async(project,scope,options={})=>C.render(project,scope,options.rate||8000);await audio.play(C.starter(),'song');const backing=audio.current,origin=audio.origin;
  for(let n=0;n<9;n++)await audio.startPatch('key-'+n,recipe,{midi:60+n});assert.equal(audio.patchVoices.size,8);assert.ok(!audio.patchVoices.has('key-0'));assert.equal(audio.current,backing);assert.equal(audio.origin,origin);assert.equal(audio.playing,true);passed.push('Patch keys are polyphonic and bounded while preserving background song playback');
  await audio.previewSound(C.blank().library[0]);assert.equal(audio.patchVoices.size,0);assert.ok(audio.mini);await audio.startPatch('key-last',recipe);assert.equal(audio.mini,null);audio.stop();assert.equal(audio.patchVoices.size,0);assert.equal(audio.patchPending.size,0);assert.equal(audio.patchTails.size,0);passed.push('Patch keys and three-second previews switch cleanly and Stop all clears every voice');
  return passed;
};
