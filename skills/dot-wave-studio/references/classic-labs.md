# The original Studio's useful tools

These workflows were checked against the bundled `Dot-Wave-Classic.html` and the original Hum → Melody and YouTube guides. Use **More studio tools → Open Classic Studio** or the direct Classic link in SKILL.md. Inspect the current controls before operating an edition that differs. Back up the working session first; use [legacy-files.md](legacy-files.md) when moving files between editions.

Studio 2.8 also offers **Sound → Capture / hum** for reviewed single-voice notes, repeating cycle-to-patch outlines, and keeping the original audio. Classic retains manual waveform snipping, live retuning and synchronized karaoke. These are separate workflows; choose the edition by its actual controls.

## Choose the tool by its output

| The user wants | Original tool | Keep afterward |
| --- | --- | --- |
| A distinctive two-voice instrument | waveLAB + WOOFpad + Patch-tone switchboard | Full patch/switchboard recipe and kept wave |
| A voice or recording turned into a synth tone | Capture a Wave | Named repeating waveform; original recording separately |
| Humming turned into editable pitches and timing | melodyLAB → Hum → Melody | Added notes, voice waveform if chosen, and raw take WAV separately |
| An actual sung performance over the backing | continuityLAB → Karaoke | Separate vocal audio clip in the saved song |
| Programmable beat order and live pad hits | beatMAP → Loop program / pad assignments | beatMAP file, program MIDI and exact-sound WAV as needed |
| Playable harmony or a guitar voicing | melodyLAB → Chord pocket | Stamped editable notes in the Chords part |
| A growing glitch texture | waveLAB → Mushroom Garden | Separate mushroom recipe and four-second audio texture |
| A name encoded as a sound or a shareable wave image | waveLAB → Waveprint + Name tones | Kept waveform, editable tone and encoded picture as appropriate |
| A console sample as a new synth source | ROM & SoundFont sounds | Auditioned, snipped waveform and original input file separately |
| Spoken text on this device | voiceLAB | Text / voice preset; native speech is not a song-audio export |
| Listening correction at the speakers | Room tune / Equalizer | Listening profile; music exports remain unchanged |

## Patch discovery, identity and textures

**waveLAB** edits A/B outlines and their pitches, phase and level, then collides them. The Pocket Amp and FX stack add character; saved result waves carry effects, while solo inputs remain dry. Preserve the original source drawing when making variants. Use load → edit → save and Undo consistently with the other labs.

**WOOFpad** is revealed by its button or typing WOOF outside fields. Wander through collisions, catch one, play it and keep it. The phone keypad seeds real two-frequency musical pairs; it is separate from the Landline calling beta. Capture current patch locks the Patch-tone switchboard while the main editor keeps changing. Concert tuning and captured-root tuning transpose the pair together. Save the switchboard to retain its recipe. New Studio 2 already exposes WOOFpad directly in Sound and supplies finite mini previews.

The original **Name the Mash** game pauses wandering while the user names a discovery and explains why the name fits. Keep discoveries private until saved/exported. Its checks encourage varied names and descriptions; they do not judge artistic quality. A WV1 code fingerprints a recipe at six-decimal precision; it is not an exhaustive numbering of every possible sound.

**Name → Wave** deterministically turns a name into a musical code. Treat it as a creative sound seed, not a personality analysis. **Wave ↔ Dithered Picture** encodes a selected wave or collision into a picture and can recover its sound through its own importer. Preserve the encoded image as produced; resizing, cropping or lossy recompression can change the data. An arbitrary image is not necessarily an encoded Studio wave.

**Mushroom Garden** starts from static or a captured copy of the collision. Growth, Static, Glitch and Strength shape the texture; Auto-wander, speed and travel animate those settings. Dragging takes control, and Pause holds the result. Save recipe keeps settings, the captured source and motion preferences. WAV export or Add to continuityLAB freezes one four-second texture, not the whole moving performance. The recipe is a separate file from Save project. Stop/hide releases sound and motion.

## Capture, hum and record a performance

**Capture a Wave:** open local audio, select an imported recording or record one second. Choose the window, audition the snip, and use Find one cycle or drag a repeating cycle. Save snip as waveform yields an editable repeating source. This does not preserve a whole word, melody or voice recording. Keep the original audio separately. Hot capture and an existing selected recording are alternative sources when the controls expose them.

**Hum → Melody:** enter from melodyLAB or Capture a Wave. Choose the input and Start humming, one note at a time; Finish take or the 30-second limit ends capture. Review detected notes before adding them. Choose chromatic/major/minor/pentatonic pitch snapping, a key and a timing grid or Keep my timing. Use melody key copies the current key. Choose a part and starting measure, then Add editable notes; it grows to fit within sixteen measures or rejects an overflow without replacing existing notes.

Use my voice waveform captures a stable repeating cycle as the part's instrument, changing the sound of that part's existing notes too. Save voice waveform, Send cycle to Base and Open in wave capture preserve different useful forms of the take. Save take WAV keeps the actual recording; raw humming takes are temporary and are not included in Save project. A selected capture recording can be analyzed without starting the mic. Detection works best with a clear single voice around 65–1,000 Hz. Inspect and edit missed pauses, unstable notes or quick slides rather than claiming automatic transcription is exact.

Backing playback may continue during hum capture, but this is phrase capture placed at the chosen measure, not automatically aligned overdubbing. Use headphones when recording against backing audio. The mic is not monitored live through the speakers.

**Karaoke** records one pass of continuityLAB's selected loop into a separate vocal audio clip, with backing and mic started together. Finish or cancel through its controls; keep existing music intact. Align last vocal adjusts that take by up to ±1,000 ms for latency. The song permits eight audio clips and sixty seconds of total imported/vocal audio. For a real sung performance use this path; for editable synthetic lyrics use Studio 2 Vocals; for inferred melody notes use Hum → Melody.

## Beats, harmony and arrangements

**beatMAP** combines editable measures, four main drum voices and nine assignable numbered pads. Pad recordings remain separate from the underlying main-voice steps. Check the selected measure and pad sound before recording. Per-hit modifiers include pitch up/down, soft/accent, short/long and double/triple/flam. Rhythm numbers stamp evenly spaced patterns such as 3 over 8 or 5 over 16; rotation changes their position. Audition and Undo a stamp without rewriting unrelated measures.

**Set measure order** moves or removes measures, or accepts an order using each existing measure number once. Loop-program references follow their original measures. Use **Check loop** before playing a program. The syntax is:

```text
LABEL "groove"
PLAY 1 x2
GOTO "groove" x1
END
```

GOTO's count means extra returns, counted across the entire run; it is not reset on every visit. Programs expand to at most 64 measures. Keep the beatMAP file for editable measures, program and sounds. Program MIDI preserves hit notes, timing and repeats; 8-bit WAV preserves the actual sound. **To continuityLAB** hands the program to the song workflow. Studio 2's normal beat draft does not itself execute this Classic language.

**Chord pocket & circle of fifths** connect key choice, chord selection and stamping. The outer circle gives major keys, the inner circle their relative minors; clockwise moves by a fifth. Use actual sounding pitches when entering notes. **Guitar chord pocket** offers sixteen standard-tuning shapes, low E → high E, with mute/open strings, finger numbers and barres. Hear voicing before stamping. It stamps the guitar's actual pitches using the Chords part's current instrument, not a generic same-root piano chord.

**melodyLAB → pattern shelf → continuityLAB** keeps the useful creative loop: select/group notes, drag bodies to move, pull the right edge to resize, duplicate, keep a reusable pattern and place independent copies. Open one placement for editing and update only that copy when asked. For a sound change, retain the original recipe and reuse its saved instrument rather than flattening all notes to WAV unnecessarily. Both editions provide editable notes; do not abandon the current Studio 2 song merely because Classic has an extra capture or harmony tool.

## Console samples, controllers and linked playback

**ROM & SoundFont sounds** opens local SNES `.sfc`/`.smc`, `.spc`, uncompressed `.sf2` and ZIP inputs. Ordinary files are capped at 64 MB and ZIPs at 128 MB. Preview a candidate, choose the useful cycle and keep it as a waveform. Direct ROM scanning finds candidate uncompressed BRR blocks and can return false matches or miss compressed banks. SPC snapshots provide a sound directory; game-specific mappings/envelopes are not inferred automatically. Do not promise full game-song or instrument-bank reconstruction from a raw ROM scan.

**SNES DJ** has controller audio enablement, a mapping setup and a visible guide. Map a USB adapter rather than assuming its button order. Select cycles DJ → Keys → YouTube → Navigate. DJ provides pads/effects; Keys plays patch tones; Navigate controls Studio pages. Physical controller connection and sound output require actual device checks. Existing saved mappings are browser-specific.

**YouTube Music links** plays a shared video/playlist through a visible embedded player. It does not connect the user's full library, import audio into the song or synchronize playback to the Studio clock. Use HTTPS or the original local launcher rather than a file URL when embedding requires a web origin. If embedding is blocked, use Open in YouTube Music and return to Studio afterward. Player volume is independent of Master, Room tune and the Studio output guard. Embedded audio is not included in waveform capture or WAV exports. In YouTube controller mode, A/Start play/pause, B pauses, X mutes, Y restarts, L/R change playlist items and the D-pad seeks/adjusts volume; Select+Start stops YouTube and Studio sounds. This link player does not publish a video.

## Speech, listening tools and connected features

**voiceLAB** is browser text-to-speech, with local voices, language, speed, pitch, voice level, speaking copy and text/preset saves. It differs from both the new singing engine and a recorded voice bank. Presets hold the text, selected voice and settings; they do not start speaking or enable online voices automatically. Online voices can send text to a provider and are hidden by default. Native speech has its own audio path: its level includes Master, but Studio effects, the output limiter and music WAV exports do not include it. It cannot be inserted as a recorded song stem by simply exporting a music project.

**Room tune** pauses music for a seven-second sweep/tail test at the listening spot. Start at low device volume, choose the mic and inspect the suggested cuts before applying. Save the profile separately; bypass and strength compare it with the original. It estimates the combined speaker/mic/room response, not a calibrated measurement, and does not remove wall reflections. The correction changes Studio listening before the limiter, not the saved song or exports. Speech and YouTube use separate paths. The Equalizer and Pitch & listening tools also serve auditioning/audio-file work; verify the selected audio target before processing a file.

**Landline beta** makes real calls through configured hardware/services; WOOF phone tones alone do not. Use it only for an explicit calling task with an existing setup. Home Assistant integrations likewise need their actual installed edition and configuration. Skill use or a request to improve music does not by itself request calls, account changes, publication or hardware setup. Keep private connection details out of portable skill files and public projects.
