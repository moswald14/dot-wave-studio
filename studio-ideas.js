(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const { DJComposer, DJ_STYLES, DJRandom } = node ? require('./dsp/doodle-jazz.js') : root.DoodleJazzComposer;
  const genres = Object.freeze(Object.entries(DJ_STYLES).map(([id, genre]) =>
    Object.freeze({ id, name: genre.name, tempo: genre.tempo, tonic: genre.tonic, mode: genre.mode })));
  const pitchedParts = ['melody', 'chords', 'bass'];
  const tracksByRole = { melody: 'melody', piano: 'chords', bass: 'bass', drums: 'rhythm' };
  const jazzInstruments = { melody: 'real-piano', chords: 'real-piano', bass: 'real-bass-electric', rhythm: 'drums' };
  const jazzLevels = { melody: .82, chords: .6, bass: .49, rhythm: .44 };
  const drumNotes = { kick: 36, hat: 42, brush: 38, stick: 37, ride: 51 };
  const major = [0, 2, 4, 5, 7, 9, 11];
  const minor = [0, 2, 3, 5, 7, 8, 10];
  const round = value => Math.round(value * 1e6) / 1e6;
  const randomSeed = () => Math.floor(Math.random() * 0xffffffff) + 1;

  function jazz({ genre = 'swing', bars = 4, root: key = 'auto', bpm, seed = randomSeed() } = {}) {
    if (!Object.hasOwn(DJ_STYLES, genre)) throw Error('Choose a Doodle Jazz genre.');
    const style = DJ_STYLES[genre];
    const tempo = bpm ?? style.tempo;
    if (![4, 8, 16].includes(bars)) throw Error('Choose 4, 8, or 16 Jazz measures.');
    if (!Number.isFinite(tempo) || tempo < 40 || tempo > 240) throw Error('Choose 40 to 240 BPM.');
    if (key !== 'auto' && (!Number.isInteger(key) || key < 0 || key > 11)) throw Error('Choose a Jazz key from 0 to 11, or auto.');
    if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) throw Error('Choose a positive 32-bit Jazz seed.');
    const composer = new DJComposer({ style: genre, tempo, swing: style.swing,
      seed, beatsPerBar: 4, phraseBars: bars, keyRoot: key, favorLikes: false });
    const notes = { melody: [], chords: [], bass: [], rhythm: [] };
    const measures = [];
    const secondsPerBeat = 60 / tempo;
    for (let bar = 0; bar < bars; bar++) {
      const { events, info } = composer.nextBar();
      measures.push(info.chords.map(chord => chord.text));
      for (const event of events) {
        const start = round(bar * 4 + event.time / secondsPerBeat);
        const duration = Math.min(round(event.duration / secondsPerBeat), (bar + 1) * 4 - start);
        notes[tracksByRole[event.role]].push({
          start, duration, midi: event.role === 'drums' ? drumNotes[event.instrument] : event.note,
          velocity: round(event.velocity)
        });
      }
    }
    for (const part of Object.values(notes)) part.sort((a, b) => a.start - b.start || a.midi - b.midi);
    return { name: style.name, genre, bars, bpm: tempo, root: composer.tonic, mode: style.mode, seed, measures, notes };
  }

  function randomMelody({ root: key, mode, grid, part = 'melody', seed = randomSeed() }) {
    const rng = new DJRandom(seed);
    const scale = mode === 'minor' ? minor : major;
    const octave = part === 'bass' ? 36 : part === 'chords' ? 48 : 60;
    const shift = rng.pick([0, 2, 4]);
    const degrees = [shift, shift + rng.pick([1, 2]), shift + rng.pick([2, 3]), 4];
    const rhythm = rng.pick([[0, .75, 1.5, 2.5], [0, .5, 1.5, 3], [.5, 1, 2, 3]]);
    const notes = [];
    for (let bar = 0; bar < 2; bar++) {
      const starts = rhythm.map(beat => Math.round(beat / grid) * grid);
      starts.forEach((beat, i) => {
        if (beat >= 4 || (i && beat === starts[i - 1])) return;
        const ending = bar === 1 && i === starts.length - 1;
        const degree = ending ? 0 : bar === 0 ? degrees[i] : degrees[[1, 2, 0, 3][i]];
        const next = starts.find(value => value > beat) ?? 4;
        const duration = Math.min(next - beat, (ending ? 2 : i % 2 ? 1 : 2) * grid);
        notes.push({ start: bar * 4 + beat, duration, midi: octave + key + scale[degree % 7] + 12 * Math.floor(degree / 7),
          velocity: i % 2 === 0 ? .72 : .55 });
      });
    }
    return { name: 'Random melody', bars: 2, notes };
  }

  function randomBeat(Drum, pattern, measure, seed = randomSeed()) {
    const next = Drum.validatePattern(pattern);
    if (!Number.isInteger(measure) || measure < 0 || measure >= next.bars) throw Error('Choose a beat measure.');
    const rng = new DJRandom(seed);
    const length = Drum.stepsPerBar(next.meter);
    const start = measure * length;
    const pulse = next.meter.denominator === 8 ? 2 : 4;
    const [kick, snare, hat, perc] = next.tracks;
    for (const track of next.tracks) {
      track.steps.fill(0, start, start + length);
      track.modifiers?.fill('', start, start + length);
    }
    kick.steps[start] = 1;
    kick.steps[start + rng.pick([pulse, pulse * 2 - 1, pulse * 2])] = 1;
    snare.steps[start + pulse] = 1;
    if (pulse * 3 < length) snare.steps[start + pulse * 3] = 1;
    for (let i = 0; i < length; i += 2) {
      if (i === 0 || i % (pulse * 2) === 0 || rng.next() < .76) hat.steps[start + i] = i % pulse === 0 ? 1 : .5;
    }
    const pickup = start + length - rng.pick([1, 2, 3]);
    (rng.next() < .5 ? kick : perc).steps[pickup] = .5;
    if (rng.next() < .4) snare.steps[start + length - 1] = .5;
    return next;
  }

  function addNotes(C, project, bars, parts, cursor = 0, useJazzSounds = false) {
    C.assert(Number.isInteger(bars) && bars > 0 && bars <= C.M.MAX_BARS, 'Use up to sixteen measures.');
    const length = bars * 4;
    const melody = structuredClone(project.melody);
    const tracks = melody.tracks.filter(track => Object.hasOwn(parts, track.id));
    C.assert(tracks.length && tracks.every(track => parts[track.id]?.length), 'Choose a part with notes.');
    const first = Math.max(0, Math.floor(cursor / 4)) * 4;
    let start = first;
    for (; start + length <= C.M.MAX_BARS * 4; start += 4) {
      const end = start + length;
      const occupied = tracks.some(track => track.notes.some(note => note.start < end && note.start + note.duration > start + 1e-9));
      if (!occupied) break;
    }
    C.assert(start + length <= C.M.MAX_BARS * 4, 'There is no room from this measure. Choose an earlier empty span or a shorter idea.');
    const defaults = C.M.defaultProject().tracks;
    const inserted = {};
    for (const track of tracks) {
      const original = defaults.find(item => item.id === track.id);
      if (useJazzSounds && !track.notes.length && track.instrument === original.instrument) {
        track.instrument = jazzInstruments[track.id];
        if (track.volume === original.volume) track.volume = jazzLevels[track.id];
      }
      const added = parts[track.id].map(note => ({ ...note, start: note.start + start }));
      inserted[track.id] = added;
      track.notes.push(...added);
    }
    melody.bars = Math.max(melody.bars, (start + length) / 4);
    return { melody: C.M.validate(melody, C.signals(project.library, project.voiceBank)), inserted, start };
  }

  function parseAI(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 48_000) throw Error('Paste an AI sketch of up to 48,000 characters.');
    const text = value.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1');
    let idea;
    try { idea = JSON.parse(text); } catch { throw Error('Paste the JSON block from the AI reply.'); }
    if (idea?.kind !== 'dot-studio-idea' || idea.version !== 1) throw Error('Use the Dot Wave Studio AI sketch format from the prompt.');
    const { name, bars, notes } = idea;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 48 || /[\x00-\x1f]/.test(name)
      || !Number.isInteger(bars) || bars < 1 || bars > 8 || !Array.isArray(notes) || notes.length < 1 || notes.length > 128) {
      throw Error('A sketch needs a short name, 1–8 measures, and 1–128 notes.');
    }
    const seen = new Set();
    const cleaned = notes.map(note => {
      const { start, duration, midi, velocity } = note || {};
      if (!Number.isFinite(start) || start < 0 || !Number.isFinite(duration) || duration < 1 / 960
        || start + duration > bars * 4 + 1e-9 || !Number.isInteger(midi) || midi < 0 || midi > 127
        || !Number.isFinite(velocity) || velocity <= 0 || velocity > 1) throw Error('A sketch note is outside its time, MIDI pitch, or velocity range.');
      const key = start + ':' + midi;
      if (seen.has(key)) throw Error('Two notes have the same pitch and time.');
      seen.add(key);
      return { start, duration: Math.min(duration, bars * 4 - start), midi, velocity };
    });
    return { name: name.trim(), bars, notes: cleaned.sort((a, b) => a.start - b.start || a.midi - b.midi) };
  }

  function aiPrompt({ brief, bpm, key, part }) {
    return [
      'Write an original editable ' + part.toLowerCase() + ' phrase for Dot Wave Studio in 4/4.',
      'Use ' + bpm + ' BPM and the key of ' + key + '.',
      'My musical idea: ' + brief.trim(),
      'Return only valid JSON with kind "dot-studio-idea", version 1, a name up to 48 characters, bars (1–8), and notes (1–128).',
      'Each note has start (zero-based quarter-note beats), duration (positive beats), midi (integer, C4 is 60), and velocity (greater than 0 and at most 1).',
      'Keep notes within bars × 4 beats. Never repeat a MIDI pitch at the same onset. Use phrasing, rests and dynamics.',
      'Shape of the JSON: {"kind":"dot-studio-idea","version":1,"name":"Evening sketch","bars":2,"notes":[{"start":0,"duration":0.75,"midi":60,"velocity":0.7}]}'
    ].join('\n');
  }

  const api = { genres, pitchedParts, jazz, randomMelody, randomBeat, addNotes, parseAI, aiPrompt };
  if (node) module.exports = api;
  else root.StudioIdeas = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
