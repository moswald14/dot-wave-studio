'use strict';
const assert=require('node:assert/strict');
module.exports=function(C,test){
  const V=C.Vocal;
  test('Offline singing voices and an English pronunciation lookup are available',()=>{
    assert.deepEqual(V.catalog().map(v=>v.id),['vocal-soft','vocal-clear','vocal-choir','vocal-recorded']);
    assert.deepEqual(V.words('dream blue').map(v=>v.phones),[['D','R','IY','M'],['B','L','UW']]);
    assert.deepEqual(V.words('AH ooh ee').map(v=>v.phones),[['AA'],['UW'],['IY']]);
    assert.throws(()=>V.words('thiswordisnotinthedictionary'));
  });
  test('Lyrics attach to selected notes atomically and melismas keep the prior vowel',()=>{
    const notes=[60,62,64,65].map((midi,i)=>({start:i,duration:1,midi,velocity:.7})),copy=C.clone(notes);
    const out=V.assign(notes,notes.slice(0,3).map(C.noteKey),'dream _ blue');
    assert.deepEqual(out.map(n=>n.vocal?.phones),[['D','R','IY','M'],['IY'],['B','L','UW'],undefined]);
    assert.deepEqual(notes,copy);assert.throws(()=>V.assign(notes,[C.noteKey(notes[0])],'too many'));
    assert.throws(()=>V.assign(notes,notes.map(C.noteKey),'_ dream'));assert.deepEqual(notes,copy);
  });
  test('Sung note metadata rejects damaged phones and unsafe parameter values',()=>{
    const clean=V.note({lyric:'moon',phones:['M','UW','N'],vibrato:.3,breath:.1,formant:2});
    assert.equal(clean.formant,2);assert.throws(()=>V.note({...clean,phones:['NOPE']}));
    assert.throws(()=>V.note({...clean,vibrato:NaN}));assert.throws(()=>V.note({...clean,breath:2}));
    assert.throws(()=>V.note({...clean,lyric:'a'.repeat(65)}));assert.throws(()=>V.note({...clean,formant:13}));
    assert.throws(()=>V.note({...clean,phones:[]}));
  });
  test('Synthetic singing follows note pitch with finite, softened boundaries',()=>{
    const n={start:0,duration:1,midi:69,velocity:.7,vocal:{lyric:'ah',phones:['AA'],vibrato:0,breath:0,formant:0}};
    for(const id of ['vocal-soft','vocal-clear','vocal-choir']){
      const a=C.Song.renderNote(id,C.signals(C.blank().library,C.blank().voiceBank)[id],n,{rate:8000,bpm:60});
      assert.equal(a[0],0);assert.equal(a.at(-1),0);assert.ok(a.every(Number.isFinite));assert.ok(C.S.peakOf(a)>.03&&C.S.peakOf(a)<.96);
    }
    const a=V.render('vocal-clear',n,{rate:16000,bpm:60}),amp=f=>{let re=0,im=0;for(let i=3200;i<9600;i++){re+=a[i]*Math.cos(2*Math.PI*f*i/16000);im+=a[i]*Math.sin(2*Math.PI*f*i/16000);}return Math.hypot(re,im);};
    assert.ok(amp(440)>amp(220)*8);assert.ok(amp(440)>amp(466)*8);
    assert.ok(V.render('vocal-clear',{...n,velocity:0},{rate:8000}).every(v=>v===0));
    assert.ok(V.render('vocal-clear',{...n,midi:127},{rate:8000}).every(v=>v===0));
  });
  test('Every English phone and diphthong renders safely at supported sample-rate edges',()=>{
    for(const phone of C.Voice.phones)for(const rate of [8000,48000]){
      const a=V.render('vocal-clear',{duration:.2,midi:60,velocity:.6,vocal:{lyric:phone.id,phones:[phone.id]}},{rate,bpm:120});
      assert.ok(a.every(Number.isFinite));assert.ok(C.S.peakOf(a)>0&&C.S.peakOf(a)<1);assert.equal(a.at(-1),0);
    }
  });
  test('Recorded singing uses kept speech sounds and falls back locally for missing sounds',()=>{
    const bank=C.Voice.blank(),rate=22050,samples=Float32Array.from({length:rate/2},(_,i)=>Math.sin(2*Math.PI*220*i/rate)*.6);
    bank.takes.AA={root:57,rate,frames:samples.length,pcm:C.Sample.encode(samples),pitchHz:220};
    const n={duration:.75,midi:60,velocity:.7,vocal:{lyric:'ah',phones:['AA']}};
    const recorded=V.render('vocal-recorded',n,{rate:8000,bpm:60,bank});
    const fallback=V.render('vocal-recorded',n,{rate:8000,bpm:60,bank:C.Voice.blank()});
    assert.ok(recorded.every(Number.isFinite));assert.ok(C.S.peakOf(recorded)>.02);assert.notDeepEqual(recorded,fallback);
    assert.ok(V.render('vocal-recorded',{...n,vocal:{lyric:'ship',phones:['SH','IH','P']}},{rate:8000,bank}).every(Number.isFinite));
    const longest=V.render('vocal-recorded',{...n,duration:64},{rate:8000,bpm:40,bank});assert.equal(longest.length,Math.round(96.1*8000));assert.equal(longest.at(-1),0);assert.ok(longest.every(Number.isFinite));
  });
  test('Lyrics and singing settings survive save, independent patterns and melody edits',()=>{
    const p=C.blank(),track=p.melody.tracks[0];track.instrument='vocal-soft';
    track.notes=V.assign([{start:0,duration:2,midi:64,velocity:.7},{start:2,duration:2,midi:67,velocity:.7}],null,'dream _');
    track.notes[0].vocal.formant=-2;
    const pattern=C.patternFromPart(p,'melody',null,'Dream voice');p.patterns.push(pattern);
    const first=C.addPattern(p,pattern,0),second=C.addPattern(p,pattern,4);
    const round=C.open(JSON.parse(C.serialize(p)));assert.deepEqual(round.melody.tracks[0].notes,track.notes);
    assert.deepEqual(round.patterns[0].notes,pattern.notes);
    C.findClip(p,first).notes[0].vocal.lyric='changed';assert.equal(C.findClip(p,second).notes[0].vocal.lyric,'dream');
    const keys=C.transformNotes(track,track.notes.map(C.noteKey),.25,1,0,8);assert.equal(keys.length,2);assert.equal(track.notes[0].vocal.lyric,'dream');
    assert.throws(()=>C.legacy(round));
  });
  test('The song renderer distinguishes different lyrics at the same pitch and duration',()=>{
    const p=C.blank();p.song.bars=1;p.song.loop.end=1;
    p.song.tracks=[{id:'vocal',name:'Singing',instrument:'vocal-clear',volume:.7,mute:false,notes:[
      {start:0,duration:1,midi:60,velocity:.7,vocal:{lyric:'ah',phones:['AA'],vibrato:0,breath:0}},
      {start:2,duration:1,midi:60,velocity:.7,vocal:{lyric:'ee',phones:['IY'],vibrato:0,breath:0}}
    ]}];
    const rendered=C.render(p,'song',8000,{loopTails:false}),offset=Math.round(2*60/p.song.bpm*8000);
    assert.notDeepEqual(rendered.left.slice(200,2000),rendered.left.slice(offset+200,offset+2000));
    assert.deepEqual(C.render(C.open(JSON.parse(C.serialize(p))),'song',8000,{loopTails:false}).left,rendered.left);
  });
  test('Singing MIDI includes timed lyric events and a General MIDI voice program',()=>{
    const p=C.blank();p.song.tracks=[{id:'singer',name:'Voice',instrument:'vocal-clear',volume:1,mute:false,notes:V.assign([{start:0,duration:1,midi:60,velocity:.7},{start:1,duration:2,midi:64,velocity:.7}],null,'moon _')}];
    const midi=C.IO.decode(C.IO.encode(C.Song.toMidi(p.song)));
    assert.equal(midi.tracks[0].program,54);assert.equal(midi.tracks[0].notes.length,2);
    assert.deepEqual(midi.tracks[0].lyrics,[{start:0,text:'moon'},{start:1,text:'_'}]);
  });
};
if(require.main===module){let count=0;module.exports(require('./core.js'),(name,fn)=>{fn();count++;console.log('PASS '+name);});console.log(count+' vocal checks passed.');}
