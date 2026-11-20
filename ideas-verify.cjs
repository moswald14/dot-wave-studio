'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const C = require('./core.js');
const Ideas = require('./studio-ideas.js');
const Market = require('./market-wave.js');
const { makeProject } = require('./skills/dot-wave-studio/scripts/jazz.cjs');

test('The Doodle Jazz band is repeatable in every genre and uses four editable Studio parts', () => {
  const signatures = new Set();
  for (const { id } of Ideas.genres) {
    const options = { genre: id, bars: 4, seed: 9161341, bpm: 89, root: 4 };
    const first = Ideas.jazz(options);
    assert.deepEqual(first, Ideas.jazz(options));
    assert.equal(first.root, 4);
    assert.equal(first.measures.length, 4);
    assert.ok(Object.values(first.notes).every(notes => notes.length));
    assert.ok(Object.values(first.notes).flat().every(note => note.start + note.duration <= 16 + 1e-9));
    const { project } = makeProject(C, Ideas, options);
    const reopened = C.open(JSON.parse(C.serialize(project)));
    assert.equal(reopened.song.bpm, 89);
    assert.equal(reopened.song.tracks.length, 4);
    assert.equal(reopened.patterns.length, 4);
    for (const track of reopened.melody.tracks) {
      assert.deepEqual(track.notes, first.notes[track.id]);
    }
    signatures.add(JSON.stringify(first.notes));
  }
  assert.equal(signatures.size, 8);
  const { project } = makeProject(C, Ideas, { genre: 'cool', bars: 4, seed: 2819, bpm: 96 });
  const track = project.song.tracks[0];
  const pattern = project.patterns[0];
  track.phrases[0].notes[0].midi += 1;
  assert.notEqual(track.phrases[0].notes[0].midi, pattern.notes[0].midi);
  const audio = C.render(project, 'song', 8000, { loopTails: false });
  assert.equal(audio.duration, 10);
  assert.ok(audio.left.every(Number.isFinite) && C.S.peakOf(audio.left) > .03);
});

test('Jazz hands its swing timing to Studio and appends around occupied spans', () => {
  const p = C.blank();
  p.melody.tracks[0].notes = [{ start: 4, duration: 2, midi: 66, velocity: .7 }];
  p.melody.tracks[0].instrument = 'real-flute';
  const source = Ideas.jazz({ genre: 'swing', bars: 4, seed: 7 });
  const snapshot = C.serialize(p);
  assert.ok(source.notes.melody.some(note => Math.abs(note.start * 4 - Math.round(note.start * 4)) > .02));
  const inserted = Ideas.addNotes(C, p, 4, source.notes, 0, true);
  assert.equal(inserted.start, 8);
  assert.equal(C.serialize(p), snapshot);
  assert.equal(inserted.melody.tracks[0].instrument, 'real-flute');
  assert.equal(inserted.melody.tracks[0].notes[0].midi, 66);
  assert.equal(inserted.inserted.chords[0].start, 8 + source.notes.chords[0].start);
  assert.throws(() => Ideas.addNotes(C, p, 4, source.notes, 56, true), /no room/);
});

test('Random beat modifies only one measure of the four drum lanes and keeps pads', () => {
  for (const [numerator, denominator] of [[3,4], [4,4], [5,4], [6,8], [7,8]]) {
    const p = C.blank();
    const pattern = C.D.resizePattern(p.beat.pattern, { bars: 3, meter: {numerator, denominator} });
    const length = C.D.stepsPerBar(pattern.meter);
    pattern.pads = C.D.defaultPads(3 * length);
    pattern.pads[0].steps[length+2] = 1;
    const snapshot = structuredClone(pattern);
    const next = Ideas.randomBeat(C.D, pattern, 1, 938107);
    assert.deepEqual(pattern, snapshot);
    assert.deepEqual(next.pads, pattern.pads);
    assert.notDeepEqual(next, Ideas.randomBeat(C.D, pattern, 1, 12235768));
    for (let i = 0; i < 4; i++) {
      assert.deepEqual(next.tracks[i].steps.slice(0, length), pattern.tracks[i].steps.slice(0, length));
      assert.deepEqual(next.tracks[i].steps.slice(2 * length), pattern.tracks[i].steps.slice(2 * length));
      assert.equal(next.tracks[i].waveId, pattern.tracks[i].waveId);
    }
    assert.ok(next.tracks[0].steps[length] && next.tracks[1].steps.slice(length, 2 * length).some(Boolean));
    C.D.validatePattern(next);
  }
});

test('Random melody stays in the selected key, follows the grid and leaves existing parts intact', () => {
  const p = C.blank();
  p.melody.root = 4;
  p.melody.mode = 'minor';
  p.melody.tracks[0].notes = [{ start: 0, duration: 2, midi: 64, velocity: .7 }];
  const phrase = Ideas.randomMelody({ root: 4, mode: 'minor', grid: .5, part: 'bass', seed: 20362435 });
  assert.ok(phrase.notes.every(note => [0, 2, 3, 5, 7, 8, 10].includes((note.midi - 4) % 12)));
  assert.ok(phrase.notes.every(note => Number.isInteger(note.start * 2)));
  const added = Ideas.addNotes(C, p, phrase.bars, { bass: phrase.notes }, 0);
  assert.equal(added.start, 0);
  assert.deepEqual(added.melody.tracks[0], p.melody.tracks[0]);
});

test('AI review accepts fenced JSON, rejects unsafe note data and retains the original phrase', () => {
  const idea = {kind:'dot-studio-idea', version:1, name:'A blue idea', bars:2,
    notes:[{start:0, duration:.66, midi:61, velocity:.7}, {start:1.5, duration:.5, midi:64, velocity:.5}]};
  const parsed = Ideas.parseAI('```json\n' + JSON.stringify(idea) + '\n```');
  assert.deepEqual(parsed.notes, idea.notes);
  assert.throws(() => Ideas.parseAI(JSON.stringify({...idea, notes:[idea.notes[0], idea.notes[0]]})), /same pitch/);
  assert.throws(() => Ideas.parseAI(JSON.stringify({...idea, notes:[{...idea.notes[0], duration:10}]})), /outside/);
  assert.throws(() => Ideas.parseAI('Here is a song: <script>'), /JSON block/);
  const p = C.blank();
  const text = C.serialize(p);
  const result = Ideas.addNotes(C, p, parsed.bars, { melody: parsed.notes }, 4);
  assert.equal(result.melody.tracks[0].notes[0].start, 4);
  assert.equal(C.serialize(p), text);
});

test('Coinbase candles become one chronological day and a seamless 32-point wave', () => {
  const query = Market.coinbaseRequest('btc', Date.UTC(2026, 10, 20, 18, 42));
  assert.equal(query.pair, 'BTC-USD');
  const rows = Array.from({length:97}, (_, i) => [(query.from + i * 900000) / 1000, 9, 120, 10 + i, 11 + i]).reverse();
  const chart = Market.coinbaseSeries(rows, query);
  assert.equal(chart.from, query.from);
  assert.equal(chart.through, query.through);
  assert.equal(chart.pointCount, 97);
  assert.equal(chart.wave.length, 32);
  assert.ok(chart.wave[0] < chart.wave[10] && chart.wave[10] < chart.wave[27] && chart.wave[27] > chart.wave[31]);
  assert.ok(chart.wave[31] > chart.wave[0] && Math.abs(chart.wave[31] - chart.wave[0]) < .2);
  assert.throws(() => Market.coinbaseRequest('BTC/../ETH'), /market/);
  const p = C.blank();
  p.patch.project.b.smoothness = .71;
  const patch = Market.patch(C, p.patch, chart, 'b');
  assert.deepEqual(patch.project.a, p.patch.project.a);
  assert.equal(patch.project.b.smoothness, .71);
  assert.deepEqual(patch.project.b.points, chart.wave);
  const heard = C.renderPatchPreview(patch, 'b', { rate: 8000 });
  assert.equal(heard.left.length, 24_000);
  assert.ok(C.S.peakOf(heard.left) > .01);
});

test('Price CSV works for a custom coin and rejects an incomplete or flat trace', () => {
  const start = Date.UTC(2026, 10, 19, 14);
  const data = Array.from({length:25}, (_, i) => new Date(start + i * 3_600_000).toISOString() + ',' + (1.2 + i % 8 / 10));
  const chart = Market.csv('timestamp,close\n' + data.join('\n'), 'DVC');
  assert.equal(chart.label, 'DVC');
  assert.equal(chart.through - chart.from, 24 * 3_600_000);
  assert.throws(() => Market.csv('time,price\n' + data.slice(0,9).join('\n')), /less than a day/);
  const flat = data.map(row => row.split(',')[0]+',12');
  assert.throws(() => Market.csv('time,price\n' + flat.join('\n')), /flat/);
});
