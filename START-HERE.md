# Dot Wave Studio 2.7.0

**Open `Dot-Wave-Studio-2.7.0.html` in your browser.** No installation or account is needed. Keep the files together after extracting the ZIP.

The new studio follows **Sound → Beat → Melody → Arrange → Export**. All five steps share your project, tempo, playback controls, Undo, and Redo. Switching steps keeps sequenced playback going. Start silently, then press Play when you want to hear it.

Your sound box is also kept separately in this browser, so it follows you into new sessions, starter songs, and opened projects. `Recovered-Old-Sounds.library.json` is the portable backup of the recovered collection: 43 custom sounds and six built-ins. Import it from the Sound box when moving to another browser. `Dot-Wave-Studio-with-Old-Sounds.studio.json` includes that collection and your current session.

Try **A little guidance → Try a starter**, or open `Windowlight.studio.json` for a complete eight-measure song you can edit. `Windowlight-preview.wav` lets you hear that starter outside the studio.

Open `The-House-That-Floats-After-Midnight.studio.json` for the new two-minute dreamy song: six acoustic/waveform parts, 374 editable notes and six named sections. Its WAV and MIDI are included. The first song, `The-Moon-Keeps-a-Spare-Key`, remains available as its own project and audio file.

The **Wave Shaper** has one focused graph and Wave A/B tabs. **Point** gives exact height entry, a numbered dot grid, pins and keyboard nudges. **Arc** selects groups across the linked edge and lets you scale, move or bend them. **Wave** collects peak/trough levels, smoothness, mirror, reverse, shift and source settings. Drawing strength, height snapping and ×2/×4 zoom give you finer control. Save a project to retain your pinned anchors. See `Wave-Shaper-guide.md` for the controls and shortcuts.

In **Arrange**, **Fit song** shows every measure and compact track rows. **Zoom** gives you room for fine edits; **Follow** keeps the playhead visible during zoomed playback. Use **Edit sections** to name the first and last measures of each part, or start with **Use clip boundaries**. Each section has a **Hear** and **Loop** button. Sections stay in your saved project, and overlap mistakes are caught before changing the song.

Open **Mixer** to adjust each note track's **Level**, **Balance**, and **Room**. Room adds a gentle reverb to recorded instruments and waves; 0% preserves their existing sound. Mute is part of the saved mix. **S** solos a part for listening, and **Clear solos** brings the whole mix back. Solo does not remove parts from WAV, MIDI, project or stems exports. Master and listening EQ also remain listening controls. Changes to the saved mix use Undo and update playing audio while preserving the musical clock.

In **Sound → Recorded instruments**, choose from grand piano, acoustic guitar, electric bass, violin, cello, flute, trumpet, tenor sax, harp, and xylophone. These use 39 actual recorded notes, bundled for offline playback. Press a **▶ 3s** mini player to listen, then **Use in melody**. The same choices appear in the melody Sound menu. Recorded instruments play in arrangements and WAV/stem exports; MIDI carries their General MIDI program choices. Open `Recorded-Instruments-Demo.studio.json`, or listen to `Recorded-Instruments-Demo.wav` for an example.

In **Sound → Capture your voice**, work through the 15 vowel and 24 consonant prompts. Press **Record** and allow microphone access in your browser. Say only the prompted sound; each take stops after 2½ seconds. Replay it, retake if necessary, then **Keep & next**. Takes are trimmed, checked for silence/clipping, and saved in the project. A vowel can become a pitched melody instrument; consonants retain their original pitch and attack. **Save voice bank** creates a separate portable backup. If microphone access is unavailable, **Import WAV take** uses the same review and analysis.

The prompts use a common American English speech-sound set; other accents may combine or split some of these sounds. This is a recorded phoneme sampler and phrase builder. It does not automatically identify the sound you pronounced, learn a natural text-to-speech voice, or verify that every take matches its prompt. Review each take yourself before keeping it.

To build a phrase, select cards and press **Add to phrase**, or enter speech-sound codes such as `HH EH L OW`. Record those sounds first. **Hear phrase** joins your recordings; **Add phrase to song** makes an audio clip, and **Save phrase WAV** downloads it. Full voice kits are kept in browser storage with your draft; keep a project or voice-bank file as your backup. No voice audio is uploaded.

- **Sound:** shape two 32-point waves around their marked peaks, troughs, and zero crossings. Draw, grab, raise a peak, deepen a trough, or place a zero edge with an adjustable brush. Select a whole wave, its landmarks, or an arc to round, sharpen, flatten, flip, or straighten. Blend or collide the two waves, set independent pitches, add warmth and effects, and keep custom instruments in the sound box.
- **Beat:** paint strong or soft hits, shape each drum, add swing, copy measures, and keep reusable beats. Up to eight measures per beat.
- **Melody:** paint, select, drag, resize, transpose, group, and duplicate notes. Stamp editable chords. Four parts and up to sixteen measures per phrase.
- **Arrange:** place saved patterns, move clips, repeat melody clips with their right edge, and edit each placement independently. Open MIDI and WAV files, or record short microphone clips. Up to eight note tracks and 64 song measures.
- **Export:** download stereo WAV, MIDI, editable project files, a complete music handoff ZIP, or separate track stems. Master and listening EQ affect playback only.

Every sound has its own **▶ 3s** button: saved sounds, Wave A, Wave B, and the combined result. A preview stops after three seconds. Press it again to stop early, or another mini player to switch sounds. Previewing a saved sound leaves your editor as it is and lets the main loop keep playing. Use **Stop all** or Escape to stop everything.

In **Wave Shaper**, orange markers mark peaks, blue dots mark troughs, and white ticks mark zero crossings. In the **Wave** pane, **Peak height** and **Trough depth** move the two sides independently. **Select arc** can cross the seam: From 30 to 3 includes the end and beginning of the cycle. Straighten or curve an arc while keeping its endpoints. Use Undo to compare any shaping edit.

The beginning and end share the same point. Draw on either edge to move both together; the curve always returns to its starting height. There are still 32 editable dots, with the first dot repeated at the right edge to close the cycle. Drawing through that edge changes only the nearby dots.

Each wave has its own **Smoothness** slider, from 0% to 100%. It gently rounds the repeating curve, including the join between the end and beginning, and changes what you hear in playback, previews, and saved sounds. The dotted guide keeps your original drawing visible. Lower the slider to 0% to get those original dots back. Smoothness is saved with your project and works with Undo and Redo.

**Save project** downloads a `.studio.json` file. Open it to continue on another computer. Browser recovery is a convenience; keep a file as your backup. Ctrl+S saves, Ctrl+O opens, Space plays or pauses, and Escape stops all sound. Ctrl+Z and Ctrl+Shift+Z undo and redo. On selected notes, arrows move and Shift+left/right changes their length.

Classic `.studio.json` projects open in the new studio. The export page also offers **Classic project** files that open in the original program. The included `Dot-Wave-Classic.html` keeps the specialized tools available through **More studio tools**: room tuning, voiceLAB, ROM sounds, SNES DJ, humming, YouTube and the landline beta. Those specialized tools retain their original interfaces and requirements.

Room ambience, recorded instruments and the new voice bank need the new Studio project format. Classic export refuses these projects instead of silently dropping their recordings or changing their instruments. Use a new Studio project for editing, or WAV for an audio handoff.

Microphone recording depends on browser support and permission. Use the local preview or HTTPS if your browser blocks recording from a file. Imported and recorded audio can total one minute; individual recordings stop after 30 seconds. Songs can render up to five minutes at a time. MIDI preserves notes and timing; custom sound and effect settings travel in the project, not MIDI.

This is a separate local edition. Publishing and Home Assistant installation have not been changed. The original edition remains available for ongoing music work.

The `Source` folder contains the complete modular source, existing audio modules, build tools, and reproducible checks. No external libraries or fonts are needed for the new studio.

Version 2.5.1 keeps a held waveform arrow key in one Undo edit, restores graph keyboard focus after Undo/Redo, keeps the last selected point explicit, and ignores unchanged height entries. Saving reports its result in the status bar so the graph stays clear.

**WOOFpad is back in Sound.** Wander, catch a pair, play it on the patch keyboard and Keep patch tone. Kept tones retain both editable voices and effects when used in melodies and arrangements. Patch tones now leads the Sound step, with direct A/B tuning, linked pitch changes and interval starters. Original patch and WOOF switchboard files can be opened in the panel. See `WOOFpad-guide.md`.

**Sound → Vocals** gives you Soft singer, Clear singer, Dream choir and Your voice kit. Choose a voice, paint notes and put words on them in Melody. `_` carries a vowel into the next note; each note's word, pronunciation, vibrato, breath and color remain editable. Keep vocal patterns and arrange independent copies. Built-in singing has a synthetic character and works offline. WAV keeps the sound, MIDI includes timed lyrics, and a Studio project keeps the complete vocal settings. See `Vocals-guide.md` or open `examples/Singing-Drift.studio.json`.

The reusable Codex skill is in `skills/dot-wave-studio/`. It covers the working studio, WOOFpad patches, vocals, composing and editable projects, with a helper for inspecting and rendering saved music. Install that folder in your Codex skills directory and invoke `$dot-wave-studio` in a new chat.
