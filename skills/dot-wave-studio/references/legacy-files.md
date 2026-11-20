# Old saves, recovery and edition handoffs

File type comes from its validated `kind`/`version`, not its extension or filename. Inspect the file without rewriting it. Use the actual Classic page for its own specialized presets; a speech preset, listening profile or picture is not a song.

| File contents | What it holds | Useful path |
| --- | --- | --- |
| `dot-studio-project`, version 1 | Original full Studio save: `song.library`, song, melody, beat/program, patch and patterns | Open in Studio 2 or use `classic.cjs migrate`; retain the original |
| `dot-studio-project`, version 2 | Current full project with optional voice banks, patch recipes and sung-note data | `studio.cjs inspect/validate/render`; use Studio 2 for editing |
| `dot-wave-library`, version 1 | `waves` | Sound box Import; `classic.cjs recover-sounds` |
| `dot-midi-mix`, versions 1–3 | Classic continuityLAB song with `library`, audio and bindings | Classic song load; recover its library separately if needed |
| `dot-drum-machine`, versions 1–3 | beatMAP kit/measures with `library`; newer saves include a loop program | Classic beatMAP load; recover its library separately |
| `dot-melody-file`, version 1 | Classic melody `project` and `library` | Classic melodyLAB load; recover sounds from `library` |
| `dot-melody-pattern`, version 1 | Reusable notes, instrument and `waves` | Pattern-box Import; recover its embedded waves |
| `dot-wave-studio` | Single A/B patch recipe | Studio 2 WOOFpad Open patch file; patch preview helper |
| `dot-patch-switchboard`, version 1 | Captured patch, octave span/shift and concert/captured-root tuning | WOOFpad Open patch file; patch preview helper |
| `dot-patch-tone`, version 1, or a saved `{recipe: ...}` wrapper | New complete kept patch recipe | Validate/import through `C.Patch`; patch preview helper |
| `dot-voice`, version 1 | Original voiceLAB speech text/voice/settings | Classic voiceLAB Open text / preset; plain `.txt` also works there |
| `dot-room-profile`, version 1 | Speaker listening correction/measurement summary | Classic Room tune Open profile |
| `dot-mushroom`, version 1 | Captured texture, glitch settings and motion preferences | Classic Mushroom Garden Open recipe |
| `dot-voice-bank`, version 1 | The new Studio's recorded vowels/consonants | Studio 2 Capture your voice → Open voice bank |
| Encoded Waveprint picture | A wave stored in image pixels | Classic Waveprint image importer; retain the unmodified original |

## Recover reusable sounds

Old sounds can live inside several saves even when the current browser shows only six stock waves. Search task/project backups and user-identified download locations, then inspect promising file kinds. A fresh page or a different origin does not prove the old collection was deleted.

Use the companion helper with explicitly selected files:

```text
node <skill>/scripts/classic.cjs recover-sounds <old-library.json> <old-song.studio.json> <pattern.json> --repo <checkout> --out <new-library.json>
```

It supports the library-bearing kinds in the table, validates each waveform/effect/recipe, merges equivalent sounds even when IDs differ, and gives a different sound a fresh ID when an old ID collides. Name, saved pitch, effects and full patch recipe all matter to equivalence. The six reserved stock identities stay intact when importing into the current Studio. Recovery refuses the 64-wave bank limit instead of silently dropping later sounds. Its report lists duplicates and remapped IDs; source files are never edited.

The output contains sound data only. It does not rewrite source-song references or collect microphone takes, standalone room/speech/glitch presets, MIDI-only timbres or raw ROM banks. For existing songs, import through Studio's collision-safe workflows so references stay correct. Never replace a project's library array with an unrelated recovered bank and assume its instruments will still resolve.

Import the recovered library through the current Sound box and verify its count after reload/recovery. Keep both a portable library and the complete working project. Previewing a sound should not load it, edit notes or interrupt the main song. Local browser storage is specific to its origin; WOOF history is separate and remains outside a song until a tone is kept.

## Convert a full project

```text
node <skill>/scripts/classic.cjs migrate <old.studio.json> --repo <checkout> --out <studio2.studio.json>
node <skill>/scripts/studio.cjs inspect <studio2.studio.json> --repo <checkout>
```

The helper uses `C.open` and `C.serialize`, then reopens the result before writing a new file. Existing encoded WAVs are retained without another audio conversion; raw sample arrays receive the normal PCM16 encoding. It checks metadata and sample preservation before writing. It preserves supported compatibility metadata but does not emulate every Classic UI feature. Check library IDs, notes, clips, beat steps, effects, tempo and named sections. Keep the original full save and separate lab files too.

A saved Classic beat program can remain in compatibility metadata without the new Beat view executing it. If the performance depends on the program, use Classic's Check loop and program-specific MIDI/WAV exports or its To continuityLAB handoff. MIDI carries editable repeated hits and timing; WAV preserves the exact sound; the original beatMAP retains the editable program. Do not call a migrated plain measure pattern an equivalent rendered loop program without checking it.

Studio 2's Classic export deliberately rejects data that Classic cannot represent, including complete new patch tones, singing/lyrics, recorded voices/instruments and Room ambience. Do not strip those fields or replace instruments to force export. Open a separate Classic session for the specialized task, then bring the resulting waveform, notes or audio into the current song through its supported import controls. Save both editable sources when one format cannot hold the whole workflow.

## Audition a saved patch

```text
node <skill>/scripts/classic.cjs preview-patch <switchboard-or-patch.json> --repo <checkout> --out <tone.wav>
```

The preview keeps the source pair, outlines, collision and effects and creates a three-second WAV with softened boundaries. Captured/concert tuning settings remain in the original switchboard; this preview auditions the actual captured pair rather than replacing it with a generic equal-pitch oscillator.

All helper outputs must be new paths with an existing parent folder. Existing outputs are refused. The helpers do not open the browser, start audio, request a microphone, contact external services or change the current draft.
