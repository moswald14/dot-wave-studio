(function (root) {
  'use strict';
  root.IdeasPanel = function ({ C, ui, getProject, replaceMelody, commit, showModal, notify, esc }) {
    const Ideas = root.StudioIdeas;
    const $ = id => document.getElementById(id);
    let jazzIdea = null;
    let reviewedAI = null;
    let jazzGenre = 'swing';
    let jazzBars = 4;
    const partId = () => Ideas.pitchedParts.includes(ui.part) ? ui.part : 'melody';
    const partName = () => getProject().melody.tracks.find(track => track.id === partId()).name;
    const sessionKey = () => C.Song.noteName(60 + getProject().melody.root).replace(/\d+$/, '');

    function add(idea, parts, focusPart, jazzSounds = false) {
      const result = Ideas.addNotes(C, getProject(), idea.bars, parts, ui.noteCursor, jazzSounds);
      const selected = result.inserted[focusPart];
      const count = Object.values(result.inserted).reduce((sum, notes) => sum + notes.length, 0);
      const message = idea.name + ' added at measure ' + (1 + result.start / 4) + ' · ' + count + ' editable notes.';
      if (!commit(() => {
        replaceMelody(result.melody);
        ui.part = focusPart;
        ui.selected = selected.map(C.noteKey);
        ui.noteCursor = result.start;
        ui.noteBase = C.clamp(Math.floor(Math.min(...selected.map(note => note.midi)) / 12) * 12, 12, 96);
        ui.patternNames[focusPart] = idea.name;
      }, message)) return;
      if ($('modal').open) $('modal').close();
      document.querySelector('.note.selected')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    function randomMelody() {
      const { root, mode } = getProject().melody;
      const target = partId();
      const idea = Ideas.randomMelody({ root, mode, grid: ui.grid, part: target });
      add(idea, { [target]: idea.notes }, target);
    }

    function randomBeat() {
      const project = getProject();
      const pattern = Ideas.randomBeat(C.D, project.beat.pattern, ui.beatBar);
      commit(() => { project.beat.pattern = pattern; }, 'Random beat in measure ' + (ui.beatBar + 1) + '. Undo brings back the previous groove.');
    }

    function rollJazz() {
      const { root, bpm } = getProject().melody;
      jazzGenre = $('jazz-idea-genre').value;
      jazzBars = +$('jazz-idea-length').value;
      jazzIdea = Ideas.jazz({ genre: jazzGenre, bars: jazzBars, root, bpm });
      const chordLine = jazzIdea.measures.map(bar => bar.join(' / ')).join(' | ');
      $('jazz-idea-chords').textContent = chordLine;
      $('jazz-idea-status').textContent = jazzIdea.name + ' · ' + sessionKey() + ' · ' + bpm + ' BPM · ' + jazzBars + ' measures';
    }

    function jazzDialog() {
      showModal('Doodle Jazz', `
        <p>Generate a phrase with the Doodle Jazz band, then edit its notes in Melody. It uses this session’s starting note and tempo.</p>
        <div class="idea-fields">
          <label class="field">Jazz style<select id="jazz-idea-genre">${Ideas.genres.map(genre =>
            `<option value="${genre.id}" ${genre.id === jazzGenre ? 'selected' : ''}>${esc(genre.name)}</option>`).join('')}</select></label>
          <label class="field">Phrase length<select id="jazz-idea-length">${[4, 8, 16].map(bars =>
            `<option value="${bars}" ${bars === jazzBars ? 'selected' : ''}>${bars} measures</option>`).join('')}</select></label>
        </div>
        <p id="jazz-idea-status" role="status"></p>
        <p id="jazz-idea-chords" class="jazz-chord-line" aria-label="Chord progression"></p>
        <p class="subtle">Add the lead to ${esc(partName())}, or add all four parts. Both start at the next open span from the melody cursor.</p>`,
        `<button data-idea-action="jazz-reroll">New phrase</button>
        <button data-idea-action="jazz-lead">Add lead</button>
        <button class="primary" data-idea-action="jazz-band" ${ui.editTarget?.type === 'phrase' || ui.editTarget?.type === 'notes' ? 'disabled' : ''}>Add band</button>`);
      rollJazz();
    }

    function aiDialog() {
      reviewedAI = null;
      showModal('AI sketch', `
        <p>Describe a phrase. Copy the prompt into ChatGPT or another AI, then paste its JSON reply. The prompt includes these words, your key and tempo.</p>
        <label class="field">Musical idea<textarea id="ai-idea-brief" rows="2" maxlength="400"
          placeholder="A soft phrase that feels like rain against glass"></textarea></label>
        <div class="control-row idea-chat-actions"><button data-idea-action="ai-copy">Copy AI prompt</button>
          <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Open ChatGPT ↗</a></div>
        <label class="field" id="ai-prompt-field" hidden>Prompt<textarea id="ai-idea-prompt" rows="5" readonly></textarea></label>
        <label class="field">AI reply (JSON)<textarea id="ai-idea-reply" rows="5" maxlength="48000"
          placeholder="Paste the JSON reply here"></textarea></label>
        <p id="ai-idea-status" role="status">Review the reply before adding notes to ${esc(partName())}.</p>`,
        '<button data-idea-action="ai-review">Review notes</button><button class="primary" id="ai-add" data-idea-action="ai-add" disabled>Add notes</button>');
    }

    async function copyPrompt() {
      const brief = $('ai-idea-brief').value.trim();
      C.assert(brief, 'Describe the phrase you want first.');
      const { bpm, mode } = getProject().melody;
      const field = $('ai-idea-prompt');
      const status = $('ai-idea-status');
      $('ai-prompt-field').hidden = false;
      field.value = Ideas.aiPrompt({ brief, bpm, key: sessionKey() + ' ' + mode, part: partName() });
      try {
        await navigator.clipboard.writeText(field.value);
        status.textContent = 'Prompt copied. Paste it into the AI chat.';
      } catch {
        field.focus();
        field.select();
        status.textContent = 'Press Ctrl+C or use Copy, then paste the prompt into the AI chat.';
      }
    }

    function reviewAI() {
      const reply = $('ai-idea-reply').value;
      const idea = Ideas.parseAI(reply);
      reviewedAI = { reply, idea };
      $('ai-add').disabled = false;
      $('ai-idea-status').textContent = idea.name + ' · ' + idea.bars + ' measures · ' + idea.notes.length +
        ' notes ready for ' + partName() + '.';
    }

    document.addEventListener('change', event => {
      if (['jazz-idea-genre', 'jazz-idea-length'].includes(event.target.id)) rollJazz();
    });
    document.addEventListener('input', event => {
      if (event.target.id === 'ai-idea-reply') {
        reviewedAI = null;
        $('ai-add').disabled = true;
        $('ai-idea-status').textContent = 'Review the updated reply.';
      }
    });
    document.addEventListener('click', async event => {
      const button = event.target.closest('[data-idea-action]');
      if (!button || button.disabled) return;
      try {
        switch (button.dataset.ideaAction) {
          case 'jazz-reroll': rollJazz(); break;
          case 'jazz-lead': add(jazzIdea, { [partId()]: jazzIdea.notes.melody }, partId()); break;
          case 'jazz-band': add(jazzIdea, jazzIdea.notes, 'melody', true); break;
          case 'ai-copy': await copyPrompt(); break;
          case 'ai-review': reviewAI(); break;
          case 'ai-add': {
            C.assert(reviewedAI?.reply === $('ai-idea-reply').value, 'Review the sketch first.');
            add(reviewedAI.idea, { [partId()]: reviewedAI.idea.notes }, partId());
            break;
          }
        }
      } catch (error) {
        const status = $('ai-idea-status') || $('jazz-idea-status');
        if (status) status.textContent = error.message;
        notify(error.message, true);
      }
    });
    return { randomMelody, randomBeat, jazzDialog, aiDialog };
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
