---
name: dot-wave-studio
description: Create and edit music, WOOFpad patches, singing vocals, and editable song arrangements in Dot Wave Studio. Use for Studio sessions, sound design, composing, project recovery, and requested Studio development.
---

# Dot Wave Studio

Help the user make music in their existing studio. Deliver editable music as well as a listenable result when composing.

- Online studio: https://moswald14.github.io/dot-wave-studio/
- Source: https://github.com/moswald14/dot-wave-studio
- Core flow: **Sound → Beat → Melody → Arrange → Export**. The user can enter at any step.

## Choose the working surface

Reuse the existing Studio browser tab when available. Inspect its draft and playback before changing it. Browser recovery is specific to the website origin; an online tab, a localhost preview and a downloaded HTML file can have different drafts. Use **Recover draft** for the site's saved session or **Open** for a downloaded project. Save a private project backup before replacing a session.

Use the connected browser's supported UI tools for visible work. Use the local JavaScript model for substantial composition, file validation and rendering. Locate a current source checkout by its `package.json` name `dot-wave-studio`, `core.js` and build commands. An existing task may keep it at `work/github-dot-wave-studio`; `work/dot-wave-v2` can be an earlier prototype. Check the actual version and changes before editing source.

Read [music-projects.md](references/music-projects.md) when composing through the core API or editing Studio files. Read [development.md](references/development.md) for requested program changes or publication.

The included `scripts/studio.cjs` validates, inspects and renders saved projects with the real Studio engine. It uses Node.js 24+, no installed dependencies, and an existing source checkout:

```text
node <skill>/scripts/studio.cjs inspect <song.studio.json> --repo <checkout>
node <skill>/scripts/studio.cjs validate <song.studio.json> --repo <checkout>
node <skill>/scripts/studio.cjs render <song.studio.json> --repo <checkout> --out <song.wav>
node <skill>/scripts/studio.cjs render <song.studio.json> --repo <checkout> --scope melody --out <phrase.wav>
```

The helper also discovers a checkout in the current directory, its `work/github-dot-wave-studio` child, or `DOT_WAVE_STUDIO_REPO`. It refuses to overwrite an existing output.

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
