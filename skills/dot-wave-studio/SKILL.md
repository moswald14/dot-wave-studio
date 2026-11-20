---
name: dot-wave-studio
description: Make and recover editable music in Dot Wave Studio or its original Classic labs, including Doodle Jazz, patches, beats, melodies, vocals and arrangements. Use for Studio sessions, old project files and requested Studio development.
---

# Dot Wave Studio

Help the user make music in their existing studio. Deliver editable music as well as a listenable result when composing.

- Online studio: https://moswald14.github.io/dot-wave-studio/
- Original Classic labs: https://moswald14.github.io/dot-wave-studio/Dot-Wave-Classic.html
- Source: https://github.com/moswald14/dot-wave-studio
- Core flow: **Capture → Patch → Beat → Melody / Vocals → Arrange → Export**. The user can enter at any step.

## Choose the working surface

Reuse the existing Studio browser tab when available. Inspect its draft and playback before changing it. Browser recovery is specific to the website origin; an online tab, a localhost preview and a downloaded HTML file can have different drafts. Use **Recover draft** for the site's saved session or **Open** for a downloaded project. Save a private project backup before replacing a session.

Use the connected browser's supported UI tools for visible work. Use the local JavaScript model for substantial composition, file validation and rendering. Locate a current source checkout by its `package.json` name `dot-wave-studio`, `core.js` and build commands. An existing task may keep it at `work/github-dot-wave-studio`; `work/dot-wave-v2` can be an earlier prototype. Check the actual version and changes before editing source.

Read [music-projects.md](references/music-projects.md) when composing through the core API or editing Studio files. Read [development.md](references/development.md) for requested program changes or publication.

Use Studio 2 for the guided workflow, saved patch recipes and singing. Use Sound → Capture / hum in Studio 2 for reviewed takes, editable single-voice melody extraction and cycle-to-patch shaping. Use the actual Classic page for its specialized tools: synchronized karaoke, manual waveform snipping, Mushroom Garden, name tones and wave pictures, beat loop programs, richer harmony tools, browser speech, room tuning, controller assignments and ROM/SoundFont sampling. Read [classic-labs.md](references/classic-labs.md) for the relevant workflow and what it produces. These are available through Classic; do not imply they were all added to Studio 2.

Read [legacy-files.md](references/legacy-files.md) for old saves, sound recovery, switchboards or moving work between editions. Preserve the full original before converting. New singing, recorded instruments and complete patch tones cannot be exported to Classic as editable projects; keep both editions' source files and use a suitable audio or note handoff.

The included `scripts/studio.cjs` validates, inspects and renders saved projects with the real Studio engine. It uses Node.js 24+, no installed dependencies, and an existing source checkout:

```text
node <skill>/scripts/studio.cjs inspect <song.studio.json> --repo <checkout>
node <skill>/scripts/studio.cjs validate <song.studio.json> --repo <checkout>
node <skill>/scripts/studio.cjs render <song.studio.json> --repo <checkout> --out <song.wav>
node <skill>/scripts/studio.cjs render <song.studio.json> --repo <checkout> --scope melody --out <phrase.wav>
```

The helper also discovers a checkout in the current directory, its `work/github-dot-wave-studio` child, or `DOT_WAVE_STUDIO_REPO`. It refuses to overwrite an existing output.

`scripts/classic.cjs` adds useful bridges from the first Studio. It uses the same checkout discovery and writes only an explicitly named, new output:

```text
node <skill>/scripts/classic.cjs migrate <old.studio.json> --repo <checkout> --out <new.studio.json>
node <skill>/scripts/classic.cjs recover-sounds <library-or-old-save.json> [more-saves.json] --repo <checkout> --out <recovered.library.json>
node <skill>/scripts/classic.cjs preview-patch <patch-or-switchboard.json> --repo <checkout> --out <patch.wav>
```

Recovery merges matching sounds, retains effects and full patch recipes, and renames conflicting IDs. It extracts the sound libraries only; it does not replace the source songs or recover a raw mic take from a repeating waveform. Previewing produces a finite three-second WAV of the actual patch pair.

## Start with Doodle Jazz

Use **Melody → Doodle Jazz** in Studio 2.9 or newer. Choose a style and length, then add the lead or add all four parts. Keep and arrange the parts you want as independent clips. To generate a repeatable band directly into an editable project, use the same composer through the included helper:

```text
node <skill>/scripts/jazz.cjs --repo <2.9-or-newer-checkout> --out <new.studio.json> --genre cool --bars 8 --bpm 94 --root 3 --seed 57196
```

The command creates lead, chords, bass and rhythm in Melody, with four reusable patterns and their placements at the start of Arrange. It needs no microphone. Keep the reported genre, tempo, root, bar count and seed to repeat a take. Choose a fresh output path, inspect the result with `studio.cjs`, and render or open it to edit. See [music-projects.md](references/music-projects.md) for the API and adding to an existing song.

**Random melody** fits the current key and grid. **Random beat** fills the active drum measure. **AI sketch** prepares a prompt to share manually and reviews pasted note JSON. In **Sound → Coin wave**, load a 24-hour coin chart or a price CSV, preview the loop, then add it to wave A or B and keep the resulting patch tone if desired.

## Capture and hum

Studio 2.8 adds **Sound → Capture / hum**. Record or import a WAV up to 30 seconds, review its original three-second preview, then choose one of three independent handoffs: editable melody notes, a 32-dot repeating outline for wave A/B, or the original recording as a song audio clip. Tune to nearest notes or the Melody key/scale, retain timing or select a grid, and choose a part and insertion measure. Existing notes stay; overflow rejects the whole insertion. Cycle shaping keeps pitch, smoothness, effects and the other wave. Save the full patch recipe afterward.

The reviewed take is temporary until saved as a WAV or placed in the song. Notes and wave outlines do not retain the original recording. Pitch extraction works for a single clear voice, not chords or lyric transcription. On HTTP Home Assistant, use WAV import or the existing trusted HTTPS address. Cancel, Stop or leaving Capture releases the microphone and invalidates pending work. Keeper uses the same editor with a Telephone handoff; shared-match scores keep their existing private sample restrictions.

## Sound and patch tones

Keep patch tones central. WOOFpad's useful loop is **wander → catch → play → keep**. Tune both voices, their ratio, outlines and collision; retain the full recipe rather than only a repeating waveform thumbnail. Both displayed waveform ends share point zero. Smoothness changes the curve without destroying the original dots; pins protect selected heights.

Each sound has a finite three-second mini preview. These previews and patch keys are separate from background song playback. Use Stop or Escape to end auditions. Saved patch tones transpose both voices together. Use concert tuning for ordinary notes and captured-root tuning when the original pair is the desired root. WOOF discovery history stays in that browser until exported or kept as a tone; it is separate from project files.

## Singing and recorded voice

In **Sound → Vocals**, choose Soft singer, Clear singer, Dream choir, or Your voice kit, then write vocals in Melody. Add one word or hyphen-separated syllable per note, ordered by time and pitch. `_` carries the last vowel onto the next note. `[M UW N]` supplies explicit pronunciation. Inspect and adjust individual note lyrics and speech-sound codes when a word is unclear. The English lookup is local; an unknown word needs a known syllable or explicit codes.

Built-in singing is synthetic. Your voice kit uses the user's kept vowel/consonant pieces, with synthetic sounds filling missing pieces; sampled voices change character with large pitch changes. Do not describe this as voice cloning or promise a natural human performance. Recording happens only through the mic controls, followed by review and Keep. A bank has 15 vowels and 24 consonants. Preserve personal takes in private projects or voice-bank exports.

Sung words, pronunciation and expression stay on the notes through editing, duplication, patterns and arrangements. WAV carries the actual vocal sound. MIDI carries notes and timed lyrics with a generic voice program; the Studio project preserves the complete vocal recipe.

## Compose, edit and deliver

Preserve the current song and reusable sounds unless replacement is requested. Start a distinct composition from a new project or a copy. Make melody notes, beats and arrangements editable. Saved patterns and independent song placements must stay independent when one copy changes.

Follow the user's musical direction and unusual ideas. For an open brief, pick a coherent key, tempo, a small sound palette and a clear musical shape, then listen or inspect the result before expanding it. Favor meaningful phrases, space, dynamics and transitions over adding tracks merely to make the project larger. WOOFpad can supply the sonic identity; recorded instruments and vocals can provide contrast.

Keep the compact, playful Studio identity and consistent selection, movement, right-edge resizing, duplication, looping and Undo behavior when changing the program. Preserve synchronized playback while editing where supported.

Return a direct Studio link plus the editable project and relevant audio exports. After composition or related media work, return to the Studio tab when possible, preserving the user's session. When asked to show the work, keep the meaningful editing stages visible. State exactly what was tested: rendered audio, visible playback and physical speaker/mic quality are different evidence.
