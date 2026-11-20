# Dot Wave Studio 2.8.0 source

No package installation is required. Use Node.js 24 or a compatible current Node release.

```
npm test
node build.cjs
node serve.cjs
```

The build writes a self-contained HTML file in `dist`. The preview serves that folder at `http://127.0.0.1:17862/`. Both scripts accept an explicit output/serve directory as their first argument. `verify.cjs` accepts an explicit report path.

`node check-release.cjs` builds into a new temporary folder, compares the versioned HTML against `releases/`, checks Classic and sample credits, and removes only its own temporary build. A mismatch fails with an instruction to update the download. `npm run check:release` is an equivalent shortcut. The GitHub workflow runs this check after the existing suite on pushes to `main`, pull requests and manual runs. It uses Node.js 24 and fixed revisions of GitHub's checkout/setup actions, with no package installation or dependency cache.

`node build-pages.cjs` packages the verified versioned HTML as `pages-site/index.html`, together with Classic, third-party notices, sample credits and `.nojekyll`. It accepts a different empty output folder as its first argument and refuses to merge with pre-existing files. Only these website assets are staged. `node pages-verify.cjs` checks entry-file parity, the exact eight-file publication list and refusal to overwrite an occupied folder. GitHub Pages uses the **GitHub Actions** publishing source. After all checks pass, only main-branch pushes/manual runs upload and deploy the site; pull requests do not deploy. The deploy job alone receives `pages: write` and `id-token: write`, scoped to the `github-pages` environment.

`core.js` owns validated version 2 project data, Classic migration, library operations, note and clip edits, and rendering adapters. `shaping.js` owns cyclic landmark detection, contour brushes, directed arc selection, and bounded transforms. `app.js` owns the guided interface and history/recovery. `audio.js` owns the worker, output guard, shared playback, previews, cancellation, and live replacement. `studio.css` owns responsive layouts. `build.cjs` embeds the audio worker and every script/style so the result works without a network.

The `dsp` folder reuses the established Dot Wave audio and file-format modules. `classic-harness.cjs` runs the actual Classic page in a test DOM to verify the Classic export interface; browser checks separately verify the real new UI and downloads. Fixtures include older published example music for migration coverage.

The browser source and the worker use the same render adapter. A live edit replaces audio with a short crossfade while retaining the musical cursor. Stop invalidates pending starts. Master and ten-band listening EQ do not change exported audio. Exports use stereo PCM with downward-only peak scaling; stems document their individual scaling.

Audio API references: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext and https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers

The shared sound collection uses `dot-wave-v2-library`, separate from project recovery. Fresh sessions, starter songs, recovery, and opened projects retain it through collision-safe merging; existing project instrument IDs stay intact. Sound deletion remains undoable and is saved with the collection.

Each saved sound and each live A/B/result preview has a finite three-second player, independent of the main transport. Mini players share the listening chain, cancel each other, and cannot restart after Stop cancels an in-flight render. Previewing does not load a sound or alter project history. The recovered 49-sound fixture covers every imported waveform and its effects.

Wave editors display 32 unique cyclic samples and a repeated copy of point zero at the right edge. Pointer slots run from 0 through 32 and map modulo 32; closed drawing and displayed arc selection preserve locality across the right-hand seam. The project retains the existing 32-point representation without resampling old drawings.

Each source has an optional `smoothness` value from 0 to 1, defaulting to zero for older files. `studio-dsp.js` applies up to eight cyclic rounding passes with fractional blending, followed by periodic monotone cubic interpolation blended by the same factor. The waveform display, audio worker, independent-pitch rendering, previews, and kept instruments share that source renderer. Original control points remain unchanged; full smoothing shares a derivative across the seam. Zero smoothing preserves the previous renderer.

`dsp/instrument-data.js` contains 39 curated mono PCM16 recordings at 22,050 Hz; `sampler-dsp.js` handles nearest-note selection, pitch, finite releases and crossfaded sustain loops. The catalogue includes ten CC BY 3.0 instrument sets; provenance, attribution, upstream commit and license links are in `sample-credits/`. To regenerate the media only, install miniaudio 1.73 and run `prepare-instruments.py`; ordinary builds use the included data without downloading anything.

`dsp/voice-dsp.js` validates a portable 39-phoneme English bank, trims and analyses takes, estimates a vowel root pitch, and joins phoneme sequences. It does not classify pronunciation or train a voice model. `app.js` captures one MediaRecorder take at a time, releases microphone tracks on stop/cancel/error, and keeps a take only after review. `recorder-harness.cjs` exercises the actual capture controller with deterministic device and decoder doubles, including denied and late-granted permissions and the automatic stop limit. Real microphone quality remains a physical-device check.

`storage.js` saves drafts and voice banks to IndexedDB, retaining the previous small-project/localStorage fallback and shared waveform collection. New Studio projects serialize the recorded bank; bundled instruments are referenced by stable IDs. Classic export explicitly rejects recorded voices/instruments that the older application cannot represent.

`arrangement.js` validates up to sixteen non-overlapping named sections, derives meter-aware listening ranges, calculates fit/zoom layouts, and makes an immutable solo audition mix. `sections` is an optional version-2 project extension. The section renderer clips to the selected range, retains notes and effects that started earlier, and applies a short fade at the range edges. It does not wrap the end back into the first frame.

A note track and saved melody pattern may have `room` from 0 to 0.6, default 0. Room uses the existing reverb with explicit tail accounting and cache keys; zero bypasses processing entirely. Listening-only solo IDs never enter project serialization or normal export requests. Classic exports reject nonzero Room rather than dropping the effect. The sample data, old waveform data and original first song remain unchanged.

The arrangement checks include section persistence/validation, meter and layout calculations, solo/export separation, room decay and round trips, and the pending-render edit race. Browser checks cover real controls, live playback, section loops, keyboard measure navigation, follow/fit, mixer Undo/Redo and byte-identical WAV export while listening solo is active. See the packaged verification reports for the scope of physical-device testing.

The Wave Shaper 2.5 view uses a single active canvas, A/B source tabs and Point/Arc/Wave inspector panes. `wave-editor.css` supplies the focused layout. Pin indices are optional source metadata (`pins`, 0–31) validated by `studio-dsp.js`; compilation ignores them, so existing sounds retain identical audio. New presets clear pins while retaining the other source settings. Copy and swap move only outline metadata, leaving pitch/phase/level in place.

`shaping.js` adds exact single-point edits, protected strength blending, drawing snap, constrained group movement, anchored arc bends and mirror operations. Drag strokes keep an unmodified baseline and a raw stroke separately so strength is applied once, independently of pointer-event density. Move uses pointer displacement, avoids jumps on pointer-down, honors pins and constrains the group before any dot clips. Keyboard nudges that cannot move a pinned point do not add an Undo entry.

The earlier 64 automated checks include the actual keyboard controller, pin save/open and audio equivalence, exact editing locality, constrained group movement, strength, snap and seam-crossing bends. Browser checks separately exercise downloaded project contents, an actual 25-percent snapped drawing stroke, copy/pitch preservation, zoom, previews and a 390-pixel responsive layout. Actual touch hardware and physical speaker/microphone quality are outside these checks.

Version 2.5.1 coalesces repeated waveform arrow-key events using the current Undo entry and explicit selection as the gesture identity. Key release, pointer input, blur, selection changes and other edits reset that identity. Exact-entry validation catches errors before changing the project; no-op entries and zeroing leave history alone. Waveform Undo/Redo restores graph focus. The four new regression cases use the actual controller, commit and history functions.

WOOFpad 2.6 uses `dsp/patch-tone.js` for original phone pairs, range limits, interval-preserving transposition, recipe/history validation, patch note rendering and the cancellable wandering controller. `woof-ui.js` owns the visible panel, held keyboard, discovery history and original-file import. `woof.css` supplies its layout. The 82 checks include 18 new cases for recipes, real pair spectra, melody/export round trips, browser timer receiver binding, native audio controller cancellation and bounded polyphony.

A kept waveform may contain optional `patchTone` metadata. Existing wave data without it keeps its original rendering. The library retains, validates and collision-safely imports recipes; SongDSP uses the same collision preparation and mixing for their pitched notes. Patch previews render the original pair, not the repeating graph thumbnail. Live patch keys use the existing master/effects path and retain background playback. History is local under the original WOOF key and does not enter projects. Classic export explicitly rejects patch recipes instead of dropping them.

## Singing and reusable skill (2.7)

`dsp/vocal-dsp.js` supplies three synthetic voices and a recorded-kit voice. Pitched harmonic tables keep note frequency separate from vowel resonances; consonant timing, vowel transitions, vibrato, breath, gentle edges and a DC blocker share the same renderer in Node and the audio worker. The recorded option uses the existing validated PCM pieces with local synthetic fallback. It does not classify speech or clone a person.

Notes may contain optional `vocal` metadata (`lyric`, `phones`, `vibrato`, `breath`, `formant`). Melody, song and pattern validation retain it; note-cache keys include it so equal pitches with different words cannot reuse the wrong audio. Existing notes without metadata keep their old representation and rendering. Vocal instruments without metadata sing ah. Classic export rejects singing and lyric data instead of silently dropping it.

`dsp/vocal-lexicon.js` contains 124,082 first-pronunciation spellings from a pinned CMUdict revision. Its source hash and license are in `vocal-credits/`. `prepare-vocal-lexicon.py` verifies that source hash before generating the module and embeds the license into the HTML. The lookup is lazy and UI-only; saved notes contain explicit phones, so the worker does not need to parse or carry the dictionary. Normal builds have no new dependencies or network requests.

`vocals-ui.js` owns the vocal room, lyric assignment, note pronunciation and expression controls. Lyrics apply atomically to selected notes or the part, and excess words reject before mutation. Details stay closed until requested, preserving space for the note editor. MIDI exports include type-5 lyric events and program 54 for singing; MIDI decoding reports lyric events separately from notes. WAV and Studio projects preserve the complete sound and editable recipe respectively.

The nine added vocal checks exercise pronunciation, unknown-word and count failures, melismas, parameter validation, pitch, all 39 phones at sample-rate boundaries, recorded fallback, persistence, independent placements, audio-cache separation and MIDI lyrics. Browser checks separately exercise live word changes, expression Undo, recovery, independent clip edits and actual WAV/MIDI downloads. A browser-rendered 20-second sung song matched the Node WAV byte for byte. Physical speakers, microphones and touch devices were not tested for this release.

`skills/dot-wave-studio/` is a standalone Codex skill. Its instructions route browser and core-API work, preserve user sessions and identify the actual source checkout. The helper is read-only except for an explicitly requested new WAV path; it validates with the real core, refuses existing outputs and performs no network actions. Its inspection, round trip, real render and overwrite refusal were run against the synthetic Singing Drift example.

`capture-tools.js` shares single-voice pitch analysis between the browser and worker. Original Hum DSP supplies stable pitch frames and cycle extraction; HumPhrase supplies median-filtered phrase conversion. Insertions validate a complete cloned project before commit. `capture-ui.js` owns temporary reviewed takes and microphone/analysis generation tokens; stale device permission, decode and worker responses cannot replace newer takes. The original PCM stays separate from derived notes and outlines. Six capture integration checks and five controller lifecycle checks accompany the original 91 checks.

`python package-release.py --out <new.zip>` creates a deterministic offline download using an explicit source allowlist, complete source, Classic, credits, examples and the reusable skill. Every entry is hashed and read back after packaging. Existing outputs are refused.
