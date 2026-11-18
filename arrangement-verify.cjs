'use strict';
const assert=require('node:assert/strict');
module.exports=(C,test)=>{
  test('Named sections round-trip with projects and reject overlaps, duplicate IDs and invalid measures',()=>{
    const p=C.starter();p.sections=[{id:'opening',name:'Opening',from:0,to:2},{id:'return',name:'Return',from:2,to:p.song.bars}];
    assert.deepEqual(C.open(JSON.parse(C.serialize(p))).sections,p.sections);
    for(const bad of [[{...p.sections[0],to:p.song.bars+1}],[p.sections[0],{...p.sections[1],from:1}],[p.sections[0],{...p.sections[1],id:'opening'}],[{...p.sections[0],from:.5}]])assert.throws(()=>C.validate({...p,sections:bad}));
    const classic=C.legacy(p);assert.deepEqual(C.open(classic).sections,p.sections);
  });
  test('Section ranges follow the meter and clip-boundary suggestions keep the musical form',()=>{
    const p=C.starter();p.song.meter={numerator:3,denominator:4};p.sections=[{id:'middle',name:'A lift',from:2,to:4}];
    assert.deepEqual(C.Arrangement.range(p,'middle'),{id:'middle',name:'A lift',from:2,to:4,fromBeat:6,toBeat:12,beats:6});
    p.song.tracks=[{phrases:[{name:'Piano · Opening',start:0},{name:'Piano · Return',start:12}]}];
    assert.deepEqual(C.Arrangement.suggestions(p).map(s=>[s.name,s.from,s.to]),[['Opening',0,4],['Return',4,p.song.bars]]);
  });
  test('Fit song keeps all measures inside narrow and wide timelines while zoom preserves editing scale',()=>{
    for(const width of [260,480,1200])for(const bars of [1,33,64]){const l=C.Arrangement.layout(width,bars);assert.ok(l.width<=width);assert.ok(Math.abs(130+l.beatWidth*bars*4-l.width)<1e-8);assert.ok(l.barWidth*l.labelEvery>=23);}
    assert.equal(C.Arrangement.layout(480,33,4,2,false).beatWidth,39);
  });
  test('Solo isolates listening tracks and other sources without changing the saved mix or MIDI',()=>{
    const p=C.starter(),raw=C.serialize(p),midi=C.IO.encode(C.Song.toMidi(p.song)),ids=[p.song.tracks[0].id],song=C.Arrangement.soloSong(p.song,ids);
    assert.equal(song.tracks[0].mute,p.song.tracks[0].mute);assert.ok(song.tracks.slice(1).every(t=>t.mute));assert.ok(song.clips.every(c=>c.mute));
    assert.equal(C.serialize(p),raw);assert.deepEqual(C.IO.encode(C.Song.toMidi(p.song)),midi);assert.equal(C.Arrangement.soloSong(p.song),p.song);assert.throws(()=>C.Arrangement.soloSong(p.song,['absent']));
    assert.notDeepEqual(C.render(p,'song',8000,{audition:{soloIds:ids}}).left,C.render(p,'song',8000).left);
  });
  test('Section audition renders exactly the selected measures, including earlier sustained notes and clean edges',()=>{
    const p=C.blank();C.syncTempo(p,60);p.song.bars=4;p.song.loop={start:0,end:4};p.sections=[{id:'middle',name:'Middle',from:1,to:2}];p.song.tracks=[{id:'piano',name:'Piano',instrument:'real-piano',volume:.7,pan:0,pitch:0,mute:false,notes:[{start:3,duration:2,midi:60,velocity:.7},{start:9,duration:1,midi:84,velocity:.7}]}];
    const a=C.render(p,'section',8000,{audition:{sectionId:'middle'}});assert.equal(a.duration,4);assert.equal(a.left.length,32000);assert.ok(C.S.peakOf(a.left)>.005);assert.equal(Math.abs(a.left[0]),0);assert.equal(Math.abs(a.left.at(-1)),0);assert.throws(()=>C.render(p,'section',8000,{audition:{sectionId:'absent'}}));
  });
  test('Room zero preserves sampled notes exactly while room ambience adds a finite decay',()=>{
    const signal=C.Sample.signals()['real-piano'],note={start:0,duration:.6,midi:60,velocity:.6},dry=C.Song.renderNote('real-piano',signal,note,{rate:8000,bpm:60,room:0});
    assert.deepEqual(dry,C.Sample.render(signal,note,{rate:8000,bpm:60}));const wet=C.Song.renderNote('real-piano',signal,note,{rate:8000,bpm:60,room:.3});assert.ok(wet.length>dry.length);assert.ok(wet.every(Number.isFinite));assert.ok(C.S.peakOf(wet.subarray(dry.length))>0);assert.throws(()=>C.Song.renderNote('real-piano',signal,note,{rate:8000,room:2}));
  });
  test('Track room survives melody patterns, independent song placements and saved projects',()=>{
    const p=C.starter();p.melody.tracks[0].room=.24;const pattern=C.patternFromPart(p,p.melody.tracks[0].id,null,'Roomy idea');assert.equal(pattern.room,.24);const clip=C.addPattern(p,pattern,0),track=p.song.tracks.find(t=>t.id===clip.trackId);assert.equal(track.room,.24);const round=C.open(JSON.parse(C.serialize(p)));assert.equal(round.song.tracks.find(t=>t.id===track.id).room,.24);assert.equal(round.melody.tracks[0].room,.24);assert.throws(()=>C.legacy(round));
  });
};
