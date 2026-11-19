# Editable music through the Studio core

Use the checkout's actual `core.js`, not a separately invented project schema:

```js
const fs = require('node:fs');
const C = require('/absolute/checkout/core.js');
const p = C.blank();
C.syncTempo(p, 88);
p.song.name = 'A new idea';
p.melody.bars = 4;
const lead = p.melody.tracks.find(t => t.id === 'melody');
lead.instrument = 'vocal-soft';
lead.notes = C.Vocal.assign([
  {start:0, duration:1.8, midi:60, velocity:.65},
  {start:2, duration:1.8, midi:64, velocity:.6},
  {start:4, duration:1.8, midi:67, velocity:.62}
], null, 'dream _ blue');
const pattern = C.patternFromPart(p, lead.id, null, 'A sung idea');
p.patterns.push(pattern);
C.addPattern(p, pattern, 0);
fs.writeFileSync('/new/output/song.studio.json', C.serialize(p), {flag:'wx'});
```

Times and durations are quarter-note beats. MIDI 60 is C4; velocity is 0–1. The four melody parts are `melody`, `chords`, `bass`, `rhythm`, with up to 16 four-beat measures. Songs support up to eight note tracks and 64 measures, using the song meter. Use `C.extend` when adding music; do not silently shorten existing content.

`C.blank()` returns a version-2 project. `C.open(JSON.parse(text))` validates current files and migrates Classic version-1 files. `C.serialize(p)` validates and encodes personal audio into the portable project. Keep private project outputs outside the public repository. `C.validate(p)` returns a validated independent value; it is not an in-place fixer.

## Sounds and voices

- `C.Sample.catalog()` lists included recorded instrument IDs.
- `p.library` holds independent kept waves, including optional complete `patchTone` recipes. `C.savePatchTone(p, name, 'concert')` captures the current A/B recipe; assign the returned wave ID to a melody part.
- `C.signals(p.library, p.voiceBank)` resolves all available instruments.
- `C.Vocal.catalog()` lists singing presets. `C.Vocal.assign(notes, selectedNoteKeysOrNull, text)` returns independent notes with lyrics. It refuses too many words rather than replacing pitches or adding notes implicitly.
- A sung note optionally has `vocal: {lyric, phones, vibrato, breath, formant}`. Validate with `C.Vocal.note`. `phones` uses the same 39-code set as `C.Voice.phones`; vibrato and breath are 0–1, formant color is -12–12 semitones. A vocal-instrument note without metadata sings ah. Existing instrumental notes remain unchanged.
- `C.Voice.validate` validates the portable recorded bank. Do not insert invented personal recordings. Synthetic fixtures are for tests and should remain clearly labeled.

Keep full patch recipes and vocal metadata. Classic exports explicitly reject unsupported singing, recorded voices and new patch recipes; use the current project format for editing and WAV for rendered listening.

## Patterns and arrangement

`C.patternFromPart(p, partId, selectedKeysOrNull, title)` captures notes relative to a complete measure. `C.addPattern(p, pattern, atBeat, optionalTrackId)` creates an independent placement and returns a clip selection. Use `C.findClip(p, selection)` to set repeats or inspect the placement. Do not mutate the saved source pattern when changing one clip.

Ordinary song tracks have `id`, `name`, `instrument`, `volume`, `pan`, `pitch`, `mute`, `notes` and optional `phrases`. Clip controls include fades, balance, level and pitch. Room ambience is 0–0.6. `p.sections` holds non-overlapping named ranges in measures. Listening solo and the master listening volume are not part of the rendered saved mix.

## Rendering and round trips

```js
const a = C.render(p, 'song', 44100, {loopTails:false});
fs.writeFileSync('/new/output/song.wav', Buffer.from(C.IO.encodeWav(a, a.rate)), {flag:'wx'});
fs.writeFileSync('/new/output/song.mid', Buffer.from(C.IO.encode(C.Song.toMidi(p.song))), {flag:'wx'});
const reopened = C.open(JSON.parse(C.serialize(p)));
```

`C.render` scopes include `song`, `melody`, `beat`, `sound`; section rendering uses an existing section ID. Use finite exports for sharing, rather than wrapping the end into the start. Audio is capped at five minutes per render. WAV can be stereo; MIDI is a note/lyric interchange and does not reproduce the included samples or synthesized vocal exactly.

After changes, reopen the serialized file and compare notes, sound references, lyrics and placements. Render at a useful sample rate and check finite samples, non-silent intended parts and bounded peaks. Browser-open the saved project for a visible handoff. An offline render alone does not prove physical playback.
