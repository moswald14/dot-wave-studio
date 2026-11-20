# Dot Wave Studio 2

A small, playful music studio: **Capture → Patch → Beat → Melody / Vocals → Arrange → Export**.

## Run it

**[Open Dot Wave Studio 2 online](https://moswald14.github.io/dot-wave-studio/)** — the complete studio on GitHub Pages. Projects and voice takes stay in your browser or downloaded project files. Use **Open** to bring a saved project from the local edition; browser drafts are separate for each website.

Download [Dot Wave Studio 2.8.0](releases/Dot-Wave-Studio-2.8.0.html), then open that HTML file in a browser. The guided studio, recorded instrument bank and built-in singing voices work offline.

For development, install Node.js 24 or newer. No dependency installation is needed:

```sh
npm test
node build.cjs
node serve.cjs
```

Open the local URL printed by the server. The build writes self-contained HTML files to `dist/`. `npm test`, `npm run build` and `npm start` are equivalent shortcuts.

## Capture and hum

Record or open a WAV, review its pitch and wave, then choose editable melody notes, an outline for wave A/B, or the original performance as an audio clip. Tuning, timing and insertion controls keep each handoff deliberate. The making path follows the music actually in your session. See the [capture guide](Capture-guide.md).

## WOOFpad and patch tones

WOOFpad is back directly in **Sound**. Wander through two-wave collisions, catch a tone, seed one from the phone keypad, like/recall discoveries and play the full patch on a one-to-three-octave keyboard. Kept patch tones retain their editable recipes and transpose both voices together in melodies and arrangements. Capture a keyboard patch while continuing to explore. Original WOOF switchboards and Classic patch files open here. See the [WOOFpad guide](WOOFpad-guide.md).

## Singing vocals

Choose **Sound → Vocals** for Soft singer, Clear singer, Dream choir or your recorded voice kit. Put words on melody notes, carry a vowel with `_`, edit pronunciation and shape vibrato, breath and voice color. Lyrics stay with notes, reusable patterns and independent song placements. Built-in singing has a synthetic character; no account or external service is needed. See the [vocals guide](Vocals-guide.md) and the editable [Singing Drift example](examples/Singing-Drift.studio.json).

## Codex skill

The reusable [Dot Wave Studio skill](skills/dot-wave-studio/SKILL.md) covers session recovery, WOOFpad patches, singing, composing, editable project files, rendering and requested development. Its helper uses the actual Studio engine to inspect, validate or render a project without uploading it. Copy the `skills/dot-wave-studio` folder into your Codex skills directory to make `$dot-wave-studio` available in a new chat.

## Wave Shaper

One editing graph, Wave A/B tabs, and focused **Point**, **Arc**, and **Wave** controls. Set exact heights, pin anchors, draw with adjustable strength and snapping, zoom into a cycle, bend selected arcs, and compare the two outlines. Both displayed ends share a single point. Each source and every saved sound has a three-second preview.

Version 2.5.1 groups a held arrow-key nudge into one Undo edit, restores graph focus after Undo/Redo, prevents an empty selection from targeting the entire wave, ignores unchanged height entries, and keeps save feedback in the status bar.

![Studio 2.5.1](docs/studio-2.5.1.jpg)

See [Wave Shaper controls](Wave-Shaper-guide.md) and the [studio guide](START-HERE.md).

## Music tools

- Draw and sculpt cyclic waveforms, blend or collide A/B, and keep reusable sounds.
- Use ten recorded instruments, with 39 included pitch anchors.
- Capture and review 15 vowel and 24 consonant samples locally; microphone permission is requested only when recording.
- Sing words on editable notes, with three synthetic vocal characters and a recorded-voice kit.
- Paint editable melodies, keep reusable patterns, and arrange independent clip placements.
- Fit the whole song, name sections, audition or loop a section, and mix level, balance and room ambience.
- Export WAV, MIDI, project files, stems and music handoff ZIPs.

## Verification and source

The original [91 core checks](reports/verification-2.8.0.json) run alongside six capture checks and five microphone/analysis lifecycle checks. It covers audio/file formats, existing-project migration, voice-controller cancellation, waveform editing, pins, section rendering, solo/export separation, live audio replacement, held-key Undo grouping, keyboard focus, vocal pronunciation, pitched rendering, saved lyrics, independent vocal clips and timed MIDI lyrics. Browser checks are recorded separately; passing automated checks does not verify physical microphone, speaker or touch-device quality.

[Studio checks](https://github.com/moswald14/dot-wave-studio/actions/workflows/studio-checks.yml) runs the suite on each push to `main` and pull request. It also rebuilds the downloadable HTML in a temporary folder and checks that it matches the file in `releases/` byte for byte, with Classic and sample credits preserved. Run `node check-release.cjs` locally for the same build check. Three Pages package checks verify the online entry, its credits and the publication file list. Tests have read-only repository access. Successful pushes to `main` deploy the checked website through a separate job with Pages-only publishing permissions.

The source is modular JavaScript/CSS. Audio, UI and validation share the same core models; the browser audio worker uses the same renderer as the tests. See [development notes](DEVELOPMENT.md).

Recorded instrument samples are credited under CC BY 3.0 in [sample credits](sample-credits/README.txt). Original source provenance and license text are included. Other third-party notices are in [Third-party-notices.txt](Third-party-notices.txt).

## Project storage

This public repository contains the program, build tools, migration/test fixtures and example music. Live browser drafts, personal voice banks and working-session exports are kept outside version control. Keep a downloaded Studio project or voice-bank file as a backup of your own work.

This repository is the development home for the downloadable edition. The existing itch.io page and its browser/demo release are managed separately.
