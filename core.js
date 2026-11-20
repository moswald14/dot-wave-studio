(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const dep = (name, globalName) => node ? require('./dsp/' + name + '.js') : root[globalName];
  const S = dep('studio-dsp', 'StudioDSP'), D = dep('drum-dsp', 'DrumDSP');
  const Song = dep('song-dsp', 'SongDSP'), M = dep('melody-dsp', 'MelodyDSP');
  const W = dep('wave-library', 'WaveLibrary'), IO = dep('midi-io', 'MidiIO');
  const FX = dep('effects-dsp', 'EffectsDSP');
  const Collision = dep('collision-audio', 'CollisionAudio');
  const Patch = dep('patch-tone','PatchTone');
  const Shape = node ? require('./shaping.js') : root.WaveShape;
  const Arrangement=node?require('./arrangement.js'):root.ArrangementTools;
  const Sample=dep('sampler-dsp','SamplerDSP'),Voice=dep('voice-dsp','VoiceDSP');
  const Vocal=dep('vocal-dsp','VocalDSP');
  const Capture=node?require('./capture-tools.js'):root.CaptureTools;
  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  let sequence = 0;
  const id = prefix => prefix + '-' + Date.now().toString(36) + '-' + (++sequence).toString(36);
  const assert = (ok, text) => { if (!ok) throw new Error(text); };
  const name = (value, max = 64) => { assert(typeof value === 'string' && value.trim() && value.length <= max, 'Use a name of 1–' + max + ' characters.'); return value.trim(); };
  function signals(library,voiceBank) { return {...Sample.signals(),...Voice.signals(voiceBank),...Vocal.signals(voiceBank),...Object.fromEntries(library.map(w => [w.id, W.signal(w)]))}; }
  function patchDefault() {
    return {kind: 'dot-wave-studio', project: S.defaultProject(), freePair: null, pitch: 134,
      level: 0, volume: .5, inverted: false, eq: {gains: Array(10).fill(0), bypass: false}, throughEQ: false, channel: 0};
  }
  function blank() {
    const melody = M.defaultProject(), song = Song.defaultSong();
    melody.name = 'Little idea'; melody.bars = 2; melody.bpm = 96;
    song.name = 'Untitled session'; song.bpm = 96; song.bars = 8; song.loop = {start: 0, end: 8}; song.tracks = [];
    const pattern = D.validatePattern({bpm: 96, swing: 0, bars: 1, meter: {numerator: 4, denominator: 4}, tracks: D.defaultTracks()});
    return {kind: 'dot-studio-project', version: 2, library: W.stockWaves(), patch: patchDefault(),
      melody, beat: {name: 'Pocket groove', volume: .55, pattern}, song, patterns: [], beatShelf: [], sections:[],voiceBank:Voice.blank(),compatibility: {}};
  }
  function syncTempo(p, bpm) {
    assert(Number.isFinite(bpm) && bpm >= 40 && bpm <= 240, 'Choose a tempo from 40 to 240 BPM.');
    p.song.bpm = p.melody.bpm = p.beat.pattern.bpm = bpm;
  }
  function checkedPattern(p, librarySignals) {
    assert(p && p.kind === 'dot-melody-pattern' && p.version === 1, 'Choose an editable melody pattern.');
    assert(typeof p.id === 'string' && /^[a-zA-Z0-9_-]{1,90}$/.test(p.id), 'Invalid pattern ID.');
    assert(Number.isFinite(p.duration) && p.duration > 0 && p.duration <= 64, 'A pattern needs 1/64–64 beats.');
    const test = Song.defaultSong(); test.bars = 16; test.loop = {start: 0, end: 16};
    test.tracks = [{id: 'check', name: name(p.name, 48), instrument: p.instrument, volume: p.volume ?? .65,room:p.room??0,mute: false,
      notes: [], phrases: [{id: 'check-clip', name: p.name, sourceId: p.id, start: 0, duration: p.duration, repeats: 1, notes: p.notes}]}];
    const track = Song.validateSong(test, librarySignals).tracks[0];
    return {kind: p.kind, version: 1, id: p.id, name: track.name, bpm: p.bpm || 96, root: p.root || 0,
      mode: p.mode === 'minor' ? 'minor' : 'major', partId: ['melody', 'chords', 'bass', 'rhythm'].includes(p.partId) ? p.partId : 'melody',
      duration: p.duration, instrument: p.instrument, volume: track.volume,room:track.room,notes: track.phrases[0].notes,
      waves: clone(p.waves || [])};
  }
  function fromBase64(text) {
    assert(typeof text === 'string' && text.length < 32000000 && /^[A-Za-z0-9+/]*={0,2}$/.test(text), 'Invalid saved audio.');
    const binary = node ? Buffer.from(text, 'base64') : Uint8Array.from(atob(text), c => c.charCodeAt(0));
    return binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength);
  }
  function toBase64(buffer) {
    if (node) return Buffer.from(buffer).toString('base64');
    const bytes = new Uint8Array(buffer); let text = '';
    for (let i = 0; i < bytes.length; i += 16384) text += String.fromCharCode(...bytes.subarray(i, i + 16384));
    return btoa(text);
  }
  function encodeSong(song) {
    return {...song, audio: song.audio.map(({samples, ...c}) => ({...c, wav: toBase64(IO.encodeWav(samples, c.rate))}))};
  }
  function decodeSong(song) {
    assert(song && Array.isArray(song.audio) && song.audio.length <= 8, 'The song audio list is invalid.');
    let duration = 0;
    return {...song, audio: song.audio.map(c => {
      if (!c.wav) { duration += c.samples?.length / c.rate; assert(duration <= 60.0001, 'Keep imported audio under one minute in total.'); return c; }
      const decoded = IO.decodeWav(fromBase64(c.wav)); duration += decoded.duration;
      assert(duration <= 60.0001, 'Keep imported audio under one minute in total.');
      const {wav, ...rest} = c; return {...rest, rate: decoded.rate, samples: decoded.samples};
    })};
  }
  function validate(value) {
    assert(value && value.kind === 'dot-studio-project' && value.version === 2, 'Choose a Dot Wave Studio 2 project.');
    const library = W.validateBundle({kind: 'dot-wave-library', version: 1, waves: value.library});
    const voiceBank=Voice.validate(value.voiceBank||Voice.blank()),bank = signals(library,voiceBank), patch = S.validatePatch(value.patch), melody = M.validate(value.melody, bank);
    const beat = {name: name(value.beat?.name, 48), volume: value.beat?.volume, pattern: D.validatePattern(value.beat?.pattern)};
    assert(Number.isFinite(beat.volume) && beat.volume >= 0 && beat.volume <= 1, 'Invalid beat volume.');
    assert(D.allTracks(beat.pattern).every(t => bank[t.waveId]), 'A drum sound is missing.');
    const song = Song.validateSong(decodeSong(value.song), bank);
    assert(Array.isArray(value.patterns) && value.patterns.length <= 32, 'Keep up to 32 melody patterns.');
    const patterns = value.patterns.map(p => checkedPattern(p, bank));
    assert(new Set(patterns.map(p => p.id)).size === patterns.length, 'Pattern IDs must be unique.');
    const beatShelf = value.beatShelf || []; assert(Array.isArray(beatShelf) && beatShelf.length <= 16, 'Keep up to 16 beats.');
    const beats = beatShelf.map(b => {
      assert(b && typeof b.id === 'string' && /^[a-zA-Z0-9_-]{1,90}$/.test(b.id), 'Invalid saved beat.');
      const pattern = D.validatePattern(b.pattern); assert(D.allTracks(pattern).every(t => bank[t.waveId]), 'A saved beat sound is missing.');
      return {id: b.id, name: name(b.name, 48), pattern, volume: clamp(Number.isFinite(b.volume) ? b.volume : .55, 0, 1)};
    });
    const result = {kind: value.kind, version: 2, library, patch, melody, beat, song, patterns, beatShelf: beats,voiceBank,sections:Arrangement.sections(value.sections||[],song.bars),
      compatibility: value.compatibility && typeof value.compatibility === 'object' ? clone(value.compatibility) : {}};
    syncTempo(result, song.bpm); return result;
  }
  function importLegacy(data) {
    assert(data && data.kind === 'dot-studio-project' && data.version === 1, 'Choose a .studio.json project.');
    assert(data.song && data.song.kind === 'dot-midi-mix' && [1, 2, 3].includes(data.song.version), 'Invalid classic song.');
    const p = blank(); p.library = data.song.library; p.patch = data.patch; p.melody = data.melody;
    p.song = data.song.song; p.beat = {name: data.beat?.name, pattern: data.beat?.pattern, volume: data.beat?.drumVolume};
    p.sections=data.sections||[];
    p.patterns = data.patterns || []; p.beatShelf = (data.song.song.beats || []).slice(0, 16);
    p.compatibility = {bindings: data.song.bindings || {}, songLevel: data.song.level, program: data.beat.program,
      beatEditor: data.beat.editor, sourceVersion: 1};
    return validate(p);
  }
  function open(data) { return data?.version === 1 ? importLegacy(data) : validate(data); }
  function serialize(p) { const v = validate(p); return JSON.stringify({...v, song: encodeSong(v.song)}, null, 2); }
  function legacy(p) {
    const v = validate(p), c = v.compatibility;
    assert(!v.melody.tracks.concat(v.song.tracks).some(t=>t.instrument.startsWith('vocal-')||t.notes.some(n=>n.vocal)||(t.phrases||[]).some(c=>c.notes.some(n=>n.vocal)))&&!v.patterns.some(t=>t.instrument.startsWith('vocal-')||t.notes.some(n=>n.vocal)),'Singing voices and lyrics need a Studio 2 project. Export WAV to keep the sound, or save a Studio project to keep editing.');
    assert(!v.library.some(w=>w.patchTone),'Editable patch tones need a Studio 2 project. Export WAV for Classic listening, or keep the Studio project for editing.');
    assert(!v.melody.tracks.concat(v.song.tracks).some(t=>t.room>0),'Room ambience needs a new Studio project, or export WAV to keep its sound.');
    assert(!Object.keys(v.voiceBank.takes).length&&!v.melody.tracks.concat(v.song.tracks).some(t=>t.instrument.startsWith('real-')),'Recorded instruments and voice banks need a Studio project file. Export WAV for a rendered copy, or save this Studio project to keep editing.');
    return {kind: 'dot-studio-project', version: 1,sections:v.sections,
      song: {kind: 'dot-midi-mix', version: 3, bindings: c.bindings || {}, level: c.songLevel ?? .8, library: v.library, song: encodeSong(v.song)},
      melody: v.melody, patterns: v.patterns, patch: v.patch,
      beat: {kind: 'dot-drum-machine', version: 3, name: v.beat.name, pattern: v.beat.pattern, drumVolume: v.beat.volume,
        program: c.program || {source: 'PLAY 1\nEND', loop: true}, editor: {...(c.beatEditor || {}), measure: 0, voice: 0, pad: 1, follow: true, chip: true}}};
  }
  function saveSound(p, title) {
    assert(p.library.length < 64, 'The sound library has 64 sounds. Export it or remove an unused sound first.');
    const signal = p.patch.freePair ? Collision.preview(p.patch.project, p.patch.freePair).result : S.compile(p.patch.project, {frequency: p.patch.pitch}).result;
    signal.effects = p.patch.project.effects;
    const wave = W.snapshot(signal, name(title, 48), id('sound'), p.patch.inverted);
    wave.frequency = p.patch.pitch; p.library.push(wave); return wave;
  }
  function setSoundFromWave(p, waveId, side = 'a') {
    const wave = p.library.find(w => w.id === waveId); assert(wave, 'Choose a sound.');
    p.patch.project[side] = {...S.source('sine'), points: S.capture(W.signal(wave).table), shape: 'custom'};
    p.patch.project.effects = clone(wave.effects || []); p.patch.project.amount = side === 'a' ? 0 : 1;
  }
  function savePatchTone(p,title,rootMode='concert'){
    const recipe=Patch.recipe(p.patch,rootMode),wave=saveSound(p,title);wave.patchTone=recipe;return wave;
  }
  function loadPatchTone(p,id){const wave=p.library.find(w=>w.id===id);assert(wave?.patchTone,'Choose a kept patch tone.');p.patch=clone(Patch.validateRecipe(wave.patchTone).patch);return wave;}
  function patternFromPart(p, partId, selectedIds, title) {
    const track = p.melody.tracks.find(t => t.id === partId); assert(track, 'Choose a melody part.');
    const selected = selectedIds?.length ? track.notes.filter(n => selectedIds.includes(noteKey(n))) : track.notes;
    assert(selected.length, 'Paint a few notes first.');
    const first = Math.floor(Math.min(...selected.map(n => n.start)) / 4) * 4;
    const end = Math.ceil(Math.max(...selected.map(n => n.start + n.duration)) / 4) * 4;
    return checkedPattern({kind: 'dot-melody-pattern', version: 1, id: id('pattern'), name: name(title || track.name, 48),
      bpm: p.song.bpm, root: p.melody.root, mode: p.melody.mode, partId, duration: end - first, instrument: track.instrument,
      volume: track.volume,room:track.room??0,notes: selected.map(n => ({...n, start: n.start - first})), waves: p.library.filter(w => w.id === track.instrument)}, signals(p.library,p.voiceBank));
  }
  function extend(p, endBeat) {
    const barBeats = Song.beatsPerBar(p.song.meter), bars = Math.ceil(endBeat / barBeats);
    assert(bars <= 64 && endBeat <= 320, 'That placement runs past the 64-measure song limit.');
    p.song.bars = Math.max(p.song.bars, bars); p.song.loop.end = p.song.bars;
  }
  function addPattern(p, pattern, at, targetId) {
    const checked = checkedPattern(pattern, signals(p.library,p.voiceBank)); assert(at >= 0, 'Place music at or after the start.');
    let track = p.song.tracks.find(t => t.id === targetId && t.instrument === checked.instrument);
    if (!track) track = p.song.tracks.find(t => t.instrument === checked.instrument && t.name === checked.name);
    if (!track) { assert(p.song.tracks.length < 8, 'A song holds eight note tracks. Remove an unused track first.');
      track = {id: id('track'), name: checked.name, instrument: checked.instrument, volume: checked.volume,room:checked.room,pan: 0, pitch: 0, mute: false, notes: [], phrases: []}; p.song.tracks.push(track); }
    assert(p.song.tracks.reduce((n, t) => n + (t.phrases?.length || 0), 0) < 128, 'Keep up to 128 melody clips.');
    extend(p, at + checked.duration);
    const clip = {id: id('clip'), sourceId: checked.id, name: checked.name, start: at, duration: checked.duration,
      repeats: 1, volume: 1, pan: 0, pitch: 0, fadeIn: 0, fadeOut: 0, mute: false, notes: clone(checked.notes)};
    (track.phrases ||= []).push(clip); return {type: 'phrase', trackId: track.id, id: clip.id};
  }
  function addBeat(p, beat, at) {
    assert(p.song.clips.length < 128, 'Keep up to 128 beat placements.');
    assert(p.song.beats.length < 16, 'This song holds 16 beat variations. Reuse a placed beat or remove an unused beat first.');
    const b = {id: id('beat'), name: name(beat.name, 48), pattern: D.validatePattern(beat.pattern), volume: beat.volume};
    const span = b.pattern.bars * Song.beatsPerBar(b.pattern.meter); extend(p, at + span); p.song.beats.push(b);
    const c = {id: id('beatclip'), beatId: b.id, start: at, volume: 1, pan: 0, pitch: 0, fadeIn: 0, fadeOut: 0, mute: false}; p.song.clips.push(c);
    return {type: 'beat', id: c.id};
  }
  function findClip(p, selection) {
    if (!selection) return null;
    if (selection.type === 'phrase') return p.song.tracks.find(t => t.id === selection.trackId)?.phrases?.find(c => c.id === selection.id);
    if (selection.type === 'notes') return p.song.tracks.find(t => t.id === selection.id);
    return (selection.type === 'beat' ? p.song.clips : selection.type === 'audio' ? p.song.audio : p.song.waves).find(c => c.id === selection.id);
  }
  function clipLength(p, selection) {
    const c = findClip(p, selection); if (!c) return 0;
    if (selection.type === 'phrase') return c.duration * c.repeats;
    if (selection.type === 'beat') { const b = p.song.beats.find(b => b.id === c.beatId); return b.pattern.bars * Song.beatsPerBar(b.pattern.meter); }
    if (selection.type === 'audio') return c.samples.length / c.rate * p.song.bpm / 60 / 2 ** ((c.pitch || 0) / 12);
    if (selection.type === 'notes') return c.notes.length ? Math.max(...c.notes.map(n => n.start + n.duration)) - Math.min(...c.notes.map(n => n.start)) : 0;
    return c.duration;
  }
  const noteKey = n => n.start + ':' + n.midi;
  function transformNotes(track, keys, deltaBeat, deltaPitch, deltaLength, end) {
    const moving = track.notes.filter(n => keys.includes(noteKey(n)));
    assert(moving.length, 'Select notes first.');
    const occupied = new Set(track.notes.filter(n => !keys.includes(noteKey(n))).map(noteKey));
    const changed = moving.map(n => ({...n, start: n.start + deltaBeat, midi: n.midi + deltaPitch, duration: n.duration + deltaLength}));
    assert(changed.every(n => n.start >= 0 && n.duration >= 1 / 64 && n.start + n.duration <= end + 1e-8 && n.midi >= 0 && n.midi <= 127), 'Those notes would leave the phrase.');
    assert(changed.every(n => !occupied.has(noteKey(n))), 'There is already a note at that position.');
    track.notes = [...track.notes.filter(n => !keys.includes(noteKey(n))), ...changed].sort((a, b) => a.start - b.start || a.midi - b.midi);
    return changed.map(noteKey);
  }
  function scopeSong(p, scope) {
    if (scope === 'song') return p.song;
    if (scope === 'melody') return M.toSong({...p.melody, bpm: p.song.bpm}, signals(p.library,p.voiceBank));
    const s = Song.defaultSong(); s.bpm = p.song.bpm; s.tracks = [];
    if (scope === 'beat') { s.bars = p.beat.pattern.bars; s.meter = p.beat.pattern.meter; s.loop = {start: 0, end: s.bars};
      s.beats = [{id: 'draft-beat', ...p.beat}]; s.clips = [{id: 'draft-clip', beatId: 'draft-beat', start: 0}];
    } else {
      const result = S.compile(p.patch.project, {frequency: p.patch.pitch}).result;
      s.bars = 1; s.loop = {start: 0, end: 1};
      s.waves = [{id: 'draft-sound', name: 'Current sound', start: 0, sourceBeats: 4, duration: 4, trimStart: 0, trimEnd: 4, stretch: 1,
        loop: true, frequency: p.patch.pitch, volume: .7, wave: {real: Array.from(result.real, x => p.patch.inverted ? -x : x), imag: Array.from(result.imag, x => p.patch.inverted ? -x : x), effects: p.patch.project.effects}}];
    }
    return s;
  }
  function render(p, scope, rate = 44100, options = {}) {
    if(scope==='capture-preview')return Capture.preview(p.samples,p.rate,rate);
    if (scope === 'preview') return renderSoundPreview(p.wave,{rate});
    if (scope === 'patch-preview') return renderPatchPreview(p.patch,p.target,{rate});
    if(scope==='instrument-preview'){
      const signal=signals(p.project.library,p.project.voiceBank)[p.instrument];assert(signal,'Choose an available instrument.');
      const meta=Sample.catalog().find(item=>item.id===p.instrument),midi=p.midi??(meta?meta.notes[Math.floor(meta.notes.length/2)]:signal.sampled?.regions[0]?.root??60);
      const raw=Song.renderNote(p.instrument,signal,{start:0,duration:2.6,midi,velocity:.75},{rate,bpm:60}),samples=new Float32Array(rate*3);samples.set(raw.subarray(0,samples.length));
      const edge=Math.round(rate*.025);for(let i=0;i<edge;i++)samples[samples.length-1-i]*=i/edge;
      return {left:Float32Array.from(samples),right:Float32Array.from(samples),samples,rate,duration:3,peak:S.peakOf(samples),scale:1};
    }
    if(scope==='voice-phrase'){const audio=Voice.sequence(p.voiceBank,p.text,{rate,speed:p.speed||1});return {...audio,left:Float32Array.from(audio.samples),right:Float32Array.from(audio.samples),peak:S.peakOf(audio.samples),scale:1};}
    if (scope === 'sound' && p.patch.freePair) {
      const duration = 4 * 60 / p.song.bpm;
      const raw = Collision.render(p.patch.project, p.patch.freePair, {rate, duration: duration * 2, gain: .7, inverted: p.patch.inverted, fade: 0});
      const effected = FX.process(raw, rate, p.patch.project.effects), samples = effected.slice(Math.round(duration * rate));
      const edge = Math.min(Math.round(rate * .008), Math.floor(samples.length / 2));
      for (let i = 0; i < edge; i++) {const f = i / edge; samples[samples.length - edge + i] = samples[samples.length - edge + i] * (1 - f) + samples[i] * f;}
      const peak = S.peakOf(samples), scale = peak > .98 ? .98 / peak : 1;
      if (scale !== 1) for (let i = 0; i < samples.length; i++) samples[i] *= scale;
      return {samples, left: Float32Array.from(samples), right: Float32Array.from(samples), rate, duration: samples.length / rate, peak, scale};
    }
    let song=scopeSong(p,scope==='section'?'song':scope);
    if(['song','section'].includes(scope))song=Arrangement.soloSong(song,options.audition?.soloIds||[]);
    if(scope==='section'){const section=Arrangement.range(p,options.audition?.sectionId);song={...song,loop:{start:section.from,end:section.to}};}
    return Song.render(song, signals(p.library,p.voiceBank), {rate, gain: .7, normalize: true, loopTails: true, ...options,...(scope==='section'?{loopOnly:true,loopTails:false}:{})});
  }
  function encodeStereo(audio) {
    const frames = audio.left.length, buffer = new ArrayBuffer(44 + frames * 4), v = new DataView(buffer);
    const text = (at, value) => [...value].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
    text(0, 'RIFF'); v.setUint32(4, 36 + frames * 4, true); text(8, 'WAVE'); text(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, audio.rate, true); v.setUint32(28, audio.rate * 4, true);
    v.setUint16(32, 4, true); v.setUint16(34, 16, true); text(36, 'data'); v.setUint32(40, frames * 4, true);
    for (let i = 0; i < frames; i++) { v.setInt16(44 + i * 4, Math.round(clamp(audio.left[i], -1, 1) * 32767), true); v.setInt16(46 + i * 4, Math.round(clamp(audio.right[i], -1, 1) * 32767), true); }
    return buffer;
  }
  function renderSoundPreview(wave,{rate=44100}={}) {
    const w=W.validateWave(wave);if(w.patchTone)return renderPatchPreview(w.patchTone.patch,'result',{rate});assert(Number.isInteger(rate)&&rate>=8000&&rate<=192000,'Choose a supported audio sample rate.');
    const frequency=w.frequency??134,table=S.reconstruct(w.real,w.imag,Math.floor(rate*.45/frequency));
    const warm=Math.min(2,FX.tail(w.effects)),pre=Math.ceil(warm*rate),frames=rate*3;
    const raw=Float32Array.from({length:pre+frames},(_,i)=>S.sample(table,i*frequency/rate)*.65);
    const processed=FX.process(raw,rate,w.effects),samples=processed.slice(pre,pre+frames);
    const peak=S.peakOf(samples),scale=peak>.95?.95/peak:1;
    for(let i=0;i<frames;i++){const on=Math.min(1,i/(rate*.012)),off=Math.min(1,(frames-1-i)/(rate*.03));const edge=.5-.5*Math.cos(Math.PI*Math.min(on,off));samples[i]*=edge*scale;}
    return {samples,left:Float32Array.from(samples),right:Float32Array.from(samples),rate,duration:3,peak,scale};
  }
  function renderPatchPreview(value,target='result',{rate=44100}={}) {
    const patch=S.validatePatch(value);assert(['a','b','result'].includes(target),'Choose Wave A, Wave B, or the result.');
    if(target!=='result'){
      const voice={...patch.project[target],ratio:patch.freePair?1:patch.project[target].ratio},signal=S.analyse(S.renderSource(voice));
      const wave=W.snapshot(signal,'Wave '+target.toUpperCase(),'draft-'+target,patch.inverted);wave.frequency=patch.freePair?.[target]??patch.pitch;
      return renderSoundPreview(wave,{rate});
    }
    const audio=render({patch,library:[],song:{bpm:80}},'sound',rate);
    for(let i=0;i<audio.left.length;i++){const f=Math.min(1,i/(rate*.012),(audio.left.length-1-i)/(rate*.03)),gain=.5-.5*Math.cos(Math.PI*f);audio.left[i]*=gain;audio.right[i]*=gain;if(audio.samples)audio.samples[i]*=gain;}
    return audio;
  }
  function starter() {
    const p = blank(); p.song.name = 'Windowlight'; p.melody.name = 'Windowlight'; p.melody.bars = 4;
    const root = [0, 9, 5, 7];
    for (let b = 0; b < 4; b++) {
      const base = root[b], third = b === 1 ? 3 : 4;
      [0, third, 7, 12, 7, third].forEach((n, i) => p.melody.tracks[0].notes.push({start: b * 4 + i * .5, midi: 60 + base + n, duration: .4, velocity: .56}));
      [0, third, 7].forEach(n => p.melody.tracks[1].notes.push({start: b * 4, midi: 48 + base + n, duration: 3.5, velocity: .4}));
      [0, 2].forEach(at => p.melody.tracks[2].notes.push({start: b * 4 + at, midi: 36 + base, duration: 1.5, velocity: .6}));
    }
    for (const part of ['melody', 'chords', 'bass']) {
      const pattern = patternFromPart(p, part, null, part === 'melody' ? 'Window melody' : part === 'chords' ? 'Warm chords' : 'Round bass');
      p.patterns.push(pattern); const sel = addPattern(p, pattern, 0); findClip(p, sel).repeats = 2;
    }
    p.beat.pattern.tracks[3].steps.fill(0); p.beatShelf.push({...clone(p.beat), id: id('saved-beat')});
    const selection = addBeat(p, p.beat, 0), first = findClip(p, selection);
    for (let b = 1; b < 8; b++) p.song.clips.push({...clone(first), id: id('beatclip'), start: b * 4});
    return validate(p);
  }
  const api = {S, D, Song, M, W, IO, FX, Collision, Patch,savePatchTone,loadPatchTone,Shape,Sample,Voice,Vocal,Capture,Arrangement,renderSoundPreview, renderPatchPreview, clone, clamp, id, assert, blank, starter, validate, open, serialize, legacy,
    signals, syncTempo, saveSound, setSoundFromWave, patternFromPart, checkedPattern, extend, addPattern, addBeat,
    findClip, clipLength, noteKey, transformNotes, scopeSong, render, encodeStereo, encodeSong};
  if (node) module.exports = api; else root.DotWave = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
