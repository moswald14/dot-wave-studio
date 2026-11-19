# Singing in Dot Wave Studio

Open **Sound → Vocals**, try the little three-second players, and choose **Write vocals →**.

**Soft singer**, **Clear singer** and **Dream choir** are built-in synthetic voices. They work offline. **Your voice kit** uses the vowels and consonants you have recorded, with built-in sounds filling any gaps. It plays recorded pieces rather than cloning a voice; large pitch changes also change the character of a sample.

## Notes, then words

Paint some notes in Melody, or use **Try a vocal phrase** on an empty part. Each word goes onto the next note, ordered from left to right. Words can contain several vowel sounds; split a word with hyphens when you want its syllables on separate notes. Select notes first to put words only on that selection. Extra notes keep their previous words, or sing ah when none were set.

For example, `dream _ drift slow` fills four notes. The underscore sings the final vowel of “dream” again at the next note's pitch. It adds no consonants. To change that pronunciation or carry another vowel, open **Note lyrics & pronunciation**.

The English pronunciation lookup works locally. An unknown spelling is rejected before any notes change. Use familiar syllables, or write speech-sound codes in brackets: `[M UW N]` sings moon. Individual note rows also accept those codes without brackets.

## Shape the voice

- **Vibrato** adds a gentle pitch movement after the note begins.
- **Breath** adds air to the built-in voice.
- **Voice color** moves vowel resonances without changing the note pitch.

These controls affect selected notes, or the whole part when no notes are selected. Your recorded pieces retain their own breath and color; these controls shape synthetic sounds filling missing pieces. Pitch and note length still come from the piano grid. Undo restores words and expression along with the rest of the edit.

Use the note-row play buttons to check a word, then the main Melody player to hear the phrase. You can edit while it plays. Dragging, resizing and duplicating notes keeps their lyrics attached.

## Keep the performance editable

Keep vocal patterns in the pattern box and place them into the song. Each placement has its own notes and lyrics. **Edit this clip →** opens one copy; **Update this song clip →** changes that copy. A duplicate keeps its previous words.

WAV exports contain the actual sung sound. MIDI exports contain notes and timed lyric events using a generic voice program; another music app will provide its own sound. Save a Studio project to keep exact pronunciation, voice choice, expression and recordings. Classic project files cannot represent this new vocal tool.

The included [Singing Drift example](examples/Singing-Drift.studio.json) has an editable vocal line and quiet recorded piano. Download the project and use Open in Studio. Your existing session can be saved separately first.

English pronunciations derive from [CMUdict](https://github.com/cmusphinx/cmudict); pinned provenance and its complete license are in `vocal-credits/`, the standalone HTML and the third-party notices. The synth uses artist-tuned vowel resonances, band-limited harmonic tables, short consonants, vowel transitions and a finite release. It has a synthetic character, especially on complex words and extreme pitches.
