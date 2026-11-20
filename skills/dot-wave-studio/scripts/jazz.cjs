#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { resolveRepo } = require('./studio.cjs');

function parse(args) {
  const allowed = new Set(['repo', 'out', 'genre', 'bars', 'bpm', 'root', 'seed', 'name']);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const key = flag.startsWith('--') ? flag.slice(2) : '';
    const value = args[i + 1];
    if (!allowed.has(key) || !value || value.startsWith('--') || Object.hasOwn(options, key)) {
      throw Error('Use --out, --repo, --genre, --bars, --bpm, --root, --seed or --name, each followed by a value.');
    }
    options[key] = value;
  }
  if (!options.out?.endsWith('.studio.json')) throw Error('Choose a new .studio.json path with --out.');
  return options;
}

function makeProject(C, Ideas, options) {
  const band = Ideas.jazz(options);
  const project = C.blank();
  C.syncTempo(project, band.bpm);
  const name = options.name === undefined ? 'Doodle Jazz · ' + band.name : options.name.trim();
  C.assert(name.length > 0 && name.length <= 64, 'Give the new song a name of 1–64 characters.');
  project.song.name = name;
  project.melody.name = name;
  project.melody.root = band.root;
  project.melody.mode = band.mode;
  project.melody.bars = band.bars;
  project.song.bars = band.bars;
  project.song.loop.end = band.bars;
  project.melody = Ideas.addNotes(C, project, band.bars, band.notes, 0, true).melody;
  for (const track of project.melody.tracks) {
    const pattern = C.patternFromPart(project, track.id, null, 'Jazz ' + track.name);
    project.patterns.push(pattern);
    C.addPattern(project, pattern, 0);
  }
  return { project, band };
}

function run(args) {
  const options = parse(args);
  const output = path.resolve(options.out);
  if (fs.existsSync(output)) throw Error('That project already exists. Choose a new output path.');
  const repo = resolveRepo(options.repo);
  if (!fs.existsSync(path.join(repo, 'studio-ideas.js'))) throw Error('Use a Dot Wave Studio 2.9 or newer checkout.');
  const C = require(path.join(repo, 'core.js'));
  const Ideas = require(path.join(repo, 'studio-ideas.js'));
  const { project, band } = makeProject(C, Ideas, {
    genre: options.genre,
    bars: Number(options.bars ?? 8),
    bpm: options.bpm === undefined ? undefined : Number(options.bpm),
    root: options.root === undefined || options.root === 'auto' ? 'auto' : Number(options.root),
    seed: options.seed === undefined ? undefined : Number(options.seed),
    name: options.name
  });
  const serialized = C.serialize(project);
  C.open(JSON.parse(serialized));
  fs.writeFileSync(output, serialized, { flag: 'wx' });
  return {
    output, name: project.song.name, seed: band.seed, genre: band.genre, bpm: band.bpm, root: band.root, bars: band.bars,
    parts: project.melody.tracks.map(track => ({ part: track.id, notes: track.notes.length, sound: track.instrument })),
    chords: band.measures
  };
}

module.exports = { makeProject, run };
if (require.main === module) {
  try { console.log(JSON.stringify(run(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
