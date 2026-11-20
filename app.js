(function () {
  'use strict';
  const C = DotWave, $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = (value, min, max, fallback = min) => Number.isFinite(+value) ? C.clamp(+value, min, max) : fallback;
  const steps = ['sound', 'beat', 'melody', 'arrange', 'export'];
  const titles = {sound:'Sound', beat:'Beat', melody:'Melody', arrange:'Arrange', export:'Export'};
  const colors = {sound:'#b8f58b', beat:'#ffb783', melody:'#c7b1ff', arrange:'#99d4f8', export:'#b8f58b'};
  const roots = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
  const STORE = 'dot-wave-v2-draft', MASTER = 'dot-wave-v2-master', LIBRARY = 'dot-wave-v2-library';
  let p = C.blank(), undo = [], redo = [], savedVersion = null, revision = 0, fileMode = 'project', fileTicket = 0;
  let saveTimer, toastTimer, gesture = null, lastExportAudio = null;
  let waveNudgeKey=null,woof=null,vocals=null,capture=null;
  const ui = {step:'sound', part:'melody', sound:'stock-sine', drum:0, beatBar:0, grid:.25, length:.5, velocity:.65,
    noteMode:'draw', selected:[], cursor:0, zoom:1, songZoom:1, songFit:true,follow:true,showMixer:false,solo:[],section:null,clip:null, editTarget:null, pattern:null,
    noteBase:48, recover:null, recovered:false, busy:false, exportScope:'song', exportRate:44100, noteCursor:0,
    soundName:'Little green wave', patternNames:{}, backing:false,soundMode:'wave',phone:'AA',voicePending:{},voiceProcessing:false,voiceNotice:'',phrase:'HH EH L OW',
    shaper:{side:'a',tool:'grab',reach:0,strength:1,snap:0,fine:.01,zoom:1,panel:'point',overlay:false,character:false,shelf:false,selection:{a:[8],b:[8]},cursor:{a:8,b:8},markers:true}};
  const audio = new DotAudio(error => { if (error) notify(error.message, true); renderTransport(); renderMiniPlayers(); woof?.update(); });
  try { audio.volume = num(localStorage.getItem(MASTER) ?? 45, 0, 100) / 100; } catch {}
  woof=WoofPanel({C,audio,ui,getProject:()=>p,commit,changed,render,setStep,chooseFile,download,notify,announce,keep:keepPatchTone});
  vocals=VocalsPanel({C,audio,ui,getProject:()=>p,commit,render,setStep,notify,announce});
  capture=CapturePanel({C,audio,ui,getProject:()=>p,replaceProject:value=>{p=value;},commit,render,setStep,chooseFile,download,notify,addAudio,prepare:()=>{woof.stop();cancelVoiceCapture();audio.stop();}});
  function keepPatchTone(go=false){const title=$('sound-name')?.value||ui.soundName;let kept;commit(()=>{kept=C.savePatchTone(p,title,woof.state.rootMode);ui.sound=kept.id;p.melody.tracks.find(t=>t.id===ui.part).instrument=kept.id;},'Patch tone kept with its two editable voices. Ready for your melody.');if(go&&kept)setStep('melody');}
  function notify(text, error = false) {
    $('status').textContent = text; $('status').classList.toggle('busy', error);
    $('toast').textContent = text; $('toast').classList.add('visible'); clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), error ? 6500 : 3600);
  }
  function announce(text) { $('status').textContent = text; $('status').classList.remove('busy'); }
  function estimate(project) { return project.song.audio.reduce((sum, c) => sum + c.samples.length * 4, 0) + JSON.stringify({...project, song:{...project.song,audio:[]}}).length * 2; }
  function checkpoint() { return {project:structuredClone(p), clip:ui.clip && {...ui.clip}, bytes:estimate(p)}; }
  function trimHistory() { while (undo.length > 24 || (undo.length > 1 && undo.reduce((sum, s) => sum + s.bytes, 0) > 64000000)) undo.shift(); }
  function changed(text, paint = true) {
    revision++; lastExportAudio = null; $('save-state').textContent = 'Unsaved changes · keeping a browser draft';
    ui.solo=ui.solo.filter(id=>p.song.tracks.some(t=>t.id===id));audio.audition.soloIds=ui.solo;
    if(audio.scope==='section'&&!p.sections.some(s=>s.id===audio.audition.sectionId))audio.stop();
    audio.refresh(p); clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 900);
    if (paint) render(); else renderTransport(); if (text) announce(text);
  }
  function commit(fn, text, paint = true) {
    resetWaveNudge();if(typeof woof!=='undefined'&&woof)woof.state.grouped=false;
    const before = checkpoint();
    try { fn(); undo.push(before); trimHistory(); redo = []; changed(text, paint); return true; }
    catch (error) { p = before.project; ui.clip = before.clip; render(); notify(error.message, true); return false; }
  }
  function history(direction) {
    if(typeof woof!=='undefined')woof?.stop();resetWaveNudge();const focusedWave=document.activeElement?.dataset?.wave;
    const from = direction === 'undo' ? undo : redo, to = direction === 'undo' ? redo : undo;
    if (!from.length) return;
    to.push(checkpoint()); const previous = from.pop(); p = previous.project; ui.clip = previous.clip; ui.selected = []; ui.editTarget = null;
    ui.beatBar = Math.min(ui.beatBar, p.beat.pattern.bars - 1); changed(direction === 'undo' ? 'Previous edit restored.' : 'Edit restored.');
    if(focusedWave&&ui.step==='sound'&&ui.soundMode==='wave')$('wave-'+ui.shaper.side)?.focus({preventScroll:true});
  }
  let draftWrite=0;
  async function saveDraft() {
    const ticket=++draftWrite;
    try {
      const text=C.serialize(p),voiceBank=structuredClone(p.voiceBank);let kept=false;
      try{await StudioStore.put('draft',text);await StudioStore.put('voiceBank',voiceBank);kept=true;}catch{}
      try{localStorage.setItem(LIBRARY,JSON.stringify({kind:'dot-wave-library',version:1,waves:p.library}));if(text.length<2000000){localStorage.setItem(STORE,text);kept=true;}}catch{}
      if(!kept)throw new Error('Browser storage is unavailable.');
      if(ticket===draftWrite)$('save-state').textContent=savedVersion===revision?'Project file saved · browser draft current':'Draft kept in this browser · save a file to keep it';
    } catch { if(ticket===draftWrite)$('save-state').textContent='Save a project file to keep your work'; }
  }
  function shareSounds(project) {
    project.library=C.W.prepareImport(project.library,p.library,()=>C.id('sound')).waves;if(!Object.keys(project.voiceBank.takes).length)project.voiceBank=structuredClone(p.voiceBank);
    return project;
  }
  function setStep(step) {
    if (!steps.includes(step)) return;if(step!=='sound'){capture?.cancel();cancelVoiceCapture();woof?.stop();} ui.step = step; ui.selected = [];
    document.documentElement.style.setProperty('--accent', colors[step]);
    if (location.hash !== '#' + step) window.history.replaceState(null, '', '#' + step);
    render();
  }
  function renderTransport() {
    const intended=scopeForStep(),scope=intended==='song'&&audio.scope==='section'&&audio.positionWhenStopped&&ui.section?'section':intended; $('play').innerHTML = `${audio.playing || audio.pending ? 'Ⅱ' : '▶'} <span>${audio.pending ? 'Preparing…' : audio.playing ? 'Pause' : 'Play ' + (scope === 'song' ? 'song' : scope)}</span>`;
    if($('bpm')!==document.activeElement)$('bpm').value = p.song.bpm; $('meter').textContent = p.song.meter.numerator + '/' + p.song.meter.denominator;
    $('master').value = Math.round(audio.volume * 100); $('master-value').textContent = Math.round(audio.volume * 100) + '%';
    $('live-dot').classList.toggle('on', audio.playing); $('playing-scope').textContent = audio.pending ? 'RENDERING' : audio.playing ? audio.scope.toUpperCase() : 'STOPPED';
    $('undo').disabled = !undo.length; $('redo').disabled = !redo.length;
    $('loop').checked=audio.loop;
    $('song-play').textContent = audio.playing && audio.scope === 'song' ? '♪ Song playing' : '▶ Hear song';
  }
  function scopeForStep() { return ui.step === 'arrange' || ui.step === 'export' ? 'song' : ui.step; }
  function renderNav() {
    const details = {sound: `${p.library.length} sounds`, beat:`${p.beat.pattern.bars} measure${p.beat.pattern.bars === 1 ? '' : 's'} · ${Math.round(p.beat.pattern.swing * 100)}% swing`,
      melody:`${p.melody.tracks.reduce((s,t) => s+t.notes.length,0)} notes · ${p.melody.bars} measures`, arrange:`${p.song.bars} measures · ${p.song.tracks.length} tracks`, export:'WAV · MIDI · project'};
    $('workflow').innerHTML = '<span class="nav-title">MAKE SOMETHING YOURS</span>' + steps.map((step, i) => `<button data-action="step" data-step="${step}" class="${ui.step === step ? 'active' : ''}" ${ui.step === step ? 'aria-current="step"' : ''}><span class="step-number">0${i+1}</span><span><span class="step-label">${titles[step]}</span><span class="step-detail">${esc(details[step])}</span></span></button>${i<4?'<span class="trail">·</span>':''}`).join('') +
      '<div class="nav-bottom"><button data-action="starter"><span class="nav-star">✦</span> Try a starter</button><button data-action="classic"><span>▦</span> More studio tools</button><button data-action="help"><span>?</span> A little guidance</button><p>Small ideas become<br>whole songs.<br>One step at a time.</p></div>';
  }
  function sessionPath(){
    const tones=p.library.filter(w=>w.patchTone).length,notes=p.melody.tracks.reduce((n,t)=>n+t.notes.length,0),placed=p.song.tracks.reduce((n,t)=>n+(t.phrases?.length||0)+(t.notes.length?1:0),0)+p.song.clips.length+p.song.audio.length,hits=p.beat.pattern.tracks.reduce((n,t)=>n+t.steps.filter(v=>v>0).length,0);
    const cue={sound:['Catch a voice, shape two waves, or wander with WOOFpad. Keep the whole patch before giving it notes.','sound-mode','Capture / hum','capture'],beat:[hits?'Your heartbeat is here. Keep the beat, then give your sound a phrase.':'Place a few hits. Leave room for your patch tone to breathe.','step','Melody & vocals','melody'],melody:[notes?'Your notes stay editable. Keep a pattern or place the parts in your song below.':'Choose a patch, draw a phrase, or hum one in Capture. Put words on a singing part.','step','Arrange the song','arrange'],arrange:[placed?'Give the song a beginning, a change and a return. Each pattern placement can be edited on its own.':'Place a beat or a melody from your pattern box. The timeline holds your independent copies.','step','Hear & export','export'],export:['Save the editable project beside your WAV. MIDI keeps notes and timed lyrics.','save','Save editable project','']}[ui.step];
    return '<aside class="session-path" aria-label="Your making path"><div><span class="caption">CAPTURE → PATCH → BEAT → MELODY / VOCALS → ARRANGE → EXPORT</span><p>'+cue[0]+'</p><p class="path-counts">'+tones+' patch tones · '+hits+' beat hits · '+notes+' phrase notes · '+placed+' song items</p></div><button data-action="'+cue[1]+'" '+(cue[1]==='sound-mode'?'data-mode="': 'data-step="')+cue[3]+'">'+cue[2]+' →</button></aside>';
  }
  const waveDecor = '<svg class="decor-wave" viewBox="0 0 120 42" fill="none" aria-hidden="true"><path d="M0 21h15l4-8 6 18 6-28 6 37 6-28 6 18 6-9h10l5-12 6 24 6-30 6 35 6-26 6 16 6-7h14" stroke="currentColor" stroke-width="2" stroke-linejoin="miter"/></svg>';
  function heading(index, title, description) { return `<div class="stage-heading"><div><span class="eyebrow">0${index} / ${titles[steps[index-1]].toUpperCase()}</span><h1>${title}</h1><p>${description}</p></div>${waveDecor}</div>`; }
  function panel(title, content, right = '', classes = '') { return `<section class="panel ${classes}"><div class="panel-head"><h2>${title}</h2>${right}</div>${content}</section>`; }
  function range(key, label, value, min, max, step = 1, suffix = '', options = '') { return `<div class="range-field"><label for="r-${key.replaceAll('.','-')}">${label}</label><output>${esc(value)}${suffix}</output><input id="r-${key.replaceAll('.','-')}" type="range" data-range="${key}" data-suffix="${suffix}" min="${min}" max="${max}" step="${step}" value="${value}" ${options}></div>`; }
  function fxFactor(key) { return ['mix','feedback','decay'].includes(key)?100:['time','depth'].includes(key)?1000:1; }
  function effectControls() {
    return p.patch.project.effects.map((fx,i)=>`<div class="effect-block"><div class="effect-item"><span>${esc(C.FX.specs[fx.type].label)}</span><input type="checkbox" data-change="fx-enabled" data-index="${i}" aria-label="Enable ${fx.type}" ${fx.enabled?'checked':''}><button data-action="remove-effect" data-index="${i}" aria-label="Remove ${fx.type}">×</button></div><div class="effect-parameters">${Object.entries(C.FX.specs[fx.type]).filter(([,v])=>Array.isArray(v)).map(([key,limits])=>{
      const factor=fxFactor(key),suffix=factor===100?'%':factor===1000?' ms':key==='rate'||key==='frequency'?' Hz':'×';
      return range('fx-'+i+'-'+key,key.charAt(0).toUpperCase()+key.slice(1),Math.round(fx[key]*factor*10)/10,limits[1]*factor,limits[2]*factor,factor===1&&key!=='frequency'?.1:1,suffix);
    }).join('')}</div></div>`).join('')||'<span class="subtle">Start simple. Add a little space.</span>';
  }
  function selectOptions(values, selected) { return values.map(v => { const [value, label] = Array.isArray(v) ? v : [v, v]; return `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(label)}</option>`; }).join(''); }
  function instrumentName(id){return C.Vocal.catalog().find(w=>w.id===id)?.name||C.Sample.catalog().find(w=>w.id===id)?.name||p.library.find(w=>w.id===id)?.name||(id==='piano'?'Pocket piano':id==='drums'?'Pocket drums':id.startsWith('voice-')?p.voiceBank.name+' · '+id.slice(6):id);}
  function soundOptions(selected, drums = false) { return (drums ? '<option value="drums" '+(selected==='drums'?'selected':'')+'>Pocket drums</option>' : '<option value="piano" '+(selected==='piano'?'selected':'')+'>Pocket piano</option>') + '<optgroup label="Singing voices">'+selectOptions(C.Vocal.catalog().map(w=>[w.id,w.name]),selected)+'</optgroup><optgroup label="Recorded instruments">'+selectOptions(C.Sample.catalog().map(w=>[w.id,w.name]),selected)+'</optgroup><optgroup label="Your voice">'+selectOptions(C.Voice.phones.filter(phone=>p.voiceBank.takes[phone.id]).map(phone=>['voice-'+phone.id,p.voiceBank.name+' · '+phone.id+' ('+phone.word+')']),selected)+'</optgroup><optgroup label="Your patch tones">'+selectOptions(p.library.filter(w=>w.patchTone).map(w=>[w.id,w.name]),selected)+'</optgroup><optgroup label="Your waves">'+selectOptions(p.library.filter(w=>!w.patchTone).map(w => [w.id,w.name]), selected)+'</optgroup>'; }
  function next(to, title, text) { return `<div class="stage-next"><p>${text}</p><button class="next-button" data-action="step" data-step="${to}">${title} <span aria-hidden="true">→</span></button></div>`; }
  function smallWave(wave, color = '#b8f58b') {
    const signal = C.W.signal(wave).table, points = Array.from({length:64},(_,i)=>`${i*1.57},${15-C.S.sample(signal,i/63)*12}`).join(' ');
    return `<svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" stroke="${color}" fill="none" stroke-width="1.5"/></svg>`;
  }
  function soundShelf() {
    return `<section class="panel shelf"><div class="shelf-head"><h2>YOUR SOUND BOX <span class="mini-badge">${p.library.length}/64</span></h2><div><button class="quiet" data-action="import-library">Import</button><button class="quiet" data-action="export-library">Export</button><button class="quiet danger" data-action="remove-sound">Remove chosen</button></div></div><p class="shelf-preview-hint">Pick the wave to edit it. Press its little play button for a three-second listen.</p><div class="shelf-tiles">${p.library.map(w => `<article class="sound-tile ${ui.sound===w.id?'selected':''}"><button class="sound-pick" data-action="pick-sound" data-id="${esc(w.id)}" title="Load ${esc(w.name)} into the editor">${smallWave(w)}<strong>${esc(w.name)}</strong><small>${w.patchTone?'PATCH TONE':w.id.startsWith('stock-')?'BUILT-IN':'YOUR SOUND'}</small></button><button class="mini-play" data-action="preview-sound" data-id="${esc(w.id)}" data-name="${esc(w.name)}" aria-label="Play ${esc(w.name)} for 3 seconds" aria-pressed="false"><span class="mini-icon">▶</span><span class="mini-time">3s</span><span class="mini-pitch">${Math.round(w.frequency??134)} Hz</span></button></article>`).join('')}</div></section>`;
  }
  function renderMiniPlayers() {
    if(typeof audio==='undefined')return;
    for(const button of document.querySelectorAll('.mini-play')){
      const active=audio.mini?.id===button.dataset.id,pending=audio.miniPending===button.dataset.id,left=audio.miniRemaining();
      button.classList.toggle('previewing',active);button.classList.toggle('preparing',pending);button.setAttribute('aria-pressed',String(active||pending));
      button.setAttribute('aria-label',`${active?'Stop preview of':pending?'Cancel preview of':'Play'} ${button.dataset.name}${active||pending?'':' for 3 seconds'}`);
      button.querySelector('.mini-icon').textContent=active?'■':pending?'·':'▶';
      button.querySelector('.mini-time').textContent=active?Math.max(.1,Math.ceil(left*10)/10).toFixed(1)+'s':pending?'…':'3s';
      button.style.setProperty('--preview-progress',active?(1-left/3)*100+'%':'0%');
    }
  }
  function patternShelf() {
    return `<section class="panel shelf"><div class="shelf-head"><h2>YOUR PATTERN BOX <span class="mini-badge">${p.patterns.length+p.beatShelf.length}</span></h2><div><button class="quiet" data-action="import-pattern">Import</button><button class="quiet" data-action="export-pattern">Export selected</button><button class="quiet danger" data-action="remove-pattern">Remove</button></div></div><div class="shelf-tiles">${p.patterns.map(item => `<button draggable="true" class="pattern-tile ${ui.pattern===item.id?'selected':''}" data-action="pick-pattern" data-id="${esc(item.id)}" data-kind="pattern"><span class="pattern-icon">▂ ▆ ▃ ▅</span><strong>${esc(item.name)}</strong><small>${item.duration/4} measures · ${item.notes.length} notes</small></button>`).join('')}${p.beatShelf.map(item => `<button draggable="true" class="pattern-tile beat" data-action="pick-pattern" data-id="${esc(item.id)}" data-kind="beat"><span class="pattern-icon">▪ · ▪ · ▪ ▪ · ▪</span><strong>${esc(item.name)}</strong><small>${item.pattern.bars} measures · BEAT</small></button>`).join('')}${!p.patterns.length&&!p.beatShelf.length?'<p class="empty-shelf">Keep a beat or melody, then drag it into your song.</p>':''}</div></section>`;
  }
  function soundModeTabs(){return `<div class="sound-mode-tabs" aria-label="Choose a sound source">${[['capture','Capture / hum'],['wave','Patch tones'],['woof','🐾 WOOFpad'],['vocals','Vocals'],['real','Recorded instruments'],['voice','Capture your voice']].map(([mode,label])=>`<button data-action="sound-mode" data-mode="${mode}" aria-pressed="${ui.soundMode===mode}" class="${ui.soundMode===mode?'active':''}">${label}</button>`).join('')}</div>`;}
  function instrumentPreviewButton(id,name){return `<button class="mini-play" data-action="preview-instrument" data-id="instrument-${esc(id)}" data-instrument="${esc(id)}" data-name="${esc(name)}" aria-label="Play ${esc(name)} for 3 seconds" aria-pressed="false"><span class="mini-icon">▶</span><span class="mini-time">3s</span><span class="mini-pitch">Recorded</span></button>`;}
  function recordedInstrumentsView(){return heading(1,'Play something real.','Recorded attacks, resonances, and decays. Ready offline, ready for your notes.')+soundModeTabs()+`<section class="panel"><div class="panel-head"><h2>THE INSTRUMENT ROOM</h2><span class="chip">10 instruments · 39 recordings</span></div><div class="instrument-room">${C.Sample.catalog().map(item=>`<article class="instrument-card"><div class="instrument-glyph" aria-hidden="true">${({0:'♬',24:'♯',33:'♭',40:'∿',42:'∿',73:'♩',56:'♪',66:'♫',46:'♮',13:'▥'})[item.program]||'♬'}</div><h3>${esc(item.name)}</h3><p>${item.sampleCount} recorded pitches · ${item.sustain?'held notes':'natural decay'}</p>${instrumentPreviewButton(item.id,item.name)}<button class="secondary" data-action="use-instrument" data-instrument="${item.id}">Use in melody →</button></article>`).join('')}</div><div class="sample-credit">Recordings from <a href="https://github.com/nbrosowsky/tonejs-instruments" target="_blank" rel="noopener">tonejs-instruments</a> · CC BY 3.0. Credits and source details are included in the download.</div></section>`+next('melody','Paint a melody','Pick a recorded instrument, then play or draw your notes.');}
  function voiceCaptureView(){
    const phone=C.Voice.phones.find(x=>x.id===ui.phone),pending=ui.voicePending[phone.id],kept=p.voiceBank.takes[phone.id],take=pending?.take||kept,count=Object.keys(p.voiceBank.takes).length,busy=!!voiceRecording||ui.voiceProcessing;
    return heading(1,'A voice, piece by piece.','Record the 15 vowels and 24 consonants in this English set, then play and combine your own sounds.')+soundModeTabs()+`<section class="panel"><div class="panel-head"><h2>YOUR VOICE KIT</h2><span class="chip">${count} / 39 kept</span></div><div class="voice-bank-heading"><label class="field">Voice name<input data-change="voice-name" value="${esc(p.voiceBank.name)}" maxlength="48" aria-label="Voice bank name"></label><div class="control-row"><button data-action="import-voice">Open voice bank</button><button data-action="export-voice" ${count?'':'disabled'}>Save voice bank ↗</button></div></div><div class="voice-progress" aria-label="Voice recording progress"><span style="width:${count/39*100}%"></span></div><div class="voice-layout"><div class="voice-phone-list">${[true,false].map(vowel=>`<h3>${vowel?'VOWELS · 15':'CONSONANTS · 24'}</h3><div class="phone-grid">${C.Voice.phones.filter(x=>x.vowel===vowel).map(x=>`<button class="phone-card ${ui.phone===x.id?'active':''} ${p.voiceBank.takes[x.id]?'kept':''}" data-action="voice-phone" data-code="${x.id}" aria-label="Record ${x.id}, as in ${x.word}" aria-pressed="${ui.phone===x.id}"><strong>${x.id} <span>${p.voiceBank.takes[x.id]?'✓':ui.voicePending[x.id]?'◐':''}</span></strong><small>${x.ipa} · ${x.word}</small></button>`).join('')}</div>`).join('')}</div><div class="voice-recorder"><div class="phone-hero"><span>${phone.ipa}</span><div><b>${phone.id}</b><p>as in <strong>${phone.word}</strong></p></div></div><p class="voice-prompt">${phone.vowel?'Say just the vowel from “'+phone.word+'”, then hold it steadily.':'Say the '+phone.id+' sound in “'+phone.word+'” by itself. Keep any added “uh” as short as you can.'}</p><p class="subtle">A take lasts up to 2½ seconds. Use a quiet room. Nothing is uploaded.</p><div class="voice-input-meter" aria-label="Microphone level"><span id="voice-input-level"></span></div><p id="voice-countdown" class="voice-notice" aria-live="polite">${esc(ui.voiceNotice||'Ready when you are. Your microphone stays off until you press Record.')}</p><div class="control-row"><button class="primary" data-action="voice-record" ${busy?'disabled':''}>● ${take?'Retake':'Record'} ${phone.id}</button><button data-action="voice-stop" ${voiceRecording?'':'disabled'}>■ Stop take</button><button class="quiet" data-action="voice-import-take" ${busy?'disabled':''}>Import WAV take</button></div>${take?`<div class="voice-review"><h3>${pending?'REVIEW THIS TAKE':'KEPT RECORDING'}</h3><canvas id="voice-take-wave" aria-label="Recorded ${phone.id} waveform"></canvas><p>${esc(pending?.quality||'This sound is saved in your voice bank.')} · ${(take.frames/take.rate).toFixed(2)} s</p><label class="field-inline">Root note <input type="number" min="24" max="96" value="${take.root}" data-change="voice-root" aria-label="Voice sample root MIDI note"> <span>${C.Song.noteName(take.root)}</span></label><div class="voice-review-actions">${instrumentPreviewButton('voice-'+phone.id,pending?'This take of '+phone.id:phone.id)}${pending?'<button class="primary" data-action="voice-keep">✓ Keep & next</button>':''}<button data-action="voice-use">Play as instrument →</button><button class="quiet" data-action="voice-append">Add to phrase</button></div></div>`:''}<p class="voice-accent-note">Prompts use a common American English speech-sound set. Your accent is welcome; replay and retake until each sound is clear. These are recorded sound pieces for playing and joining.</p></div></div><div class="voice-phrase"><div><h3>BUILD WITH YOUR RECORDED SOUNDS</h3><p>Choose a card, then “Add to phrase”, or enter codes such as HH EH L OW.</p></div><label class="field">Speech sounds<input id="voice-phrase" value="${esc(ui.phrase)}" maxlength="512" placeholder="HH EH L OW" aria-label="Voice phrase speech sound codes"></label><div class="control-row"><button data-action="voice-hear-phrase">▶ Hear phrase</button><button data-action="voice-add-phrase">Add phrase to song →</button><button data-action="voice-export-phrase">Save phrase WAV ↗</button></div></div></section>`;
  }
  function paintVoiceTake(){const phone=ui.phone,take=ui.voicePending[phone]?.take||p.voiceBank.takes[phone];if(take&&$('voice-take-wave'))drawCanvas($('voice-take-wave'),C.Sample.pcm(take),'#c7b1ff');}
  async function previewInstrument(button){
    const instrument=button.dataset.instrument,project=structuredClone(p);
    if(instrument.startsWith('voice-')){const code=instrument.slice(6),pending=ui.voicePending[code];if(pending)project.voiceBank.takes[code]=pending.take;}
    return audio.previewSound({id:button.dataset.id,name:button.dataset.name},{scope:'instrument-preview',project:{project,instrument}});
  }
  function keepVoiceTake(advance=true){const code=ui.phone,pending=ui.voicePending[code];C.assert(pending,'Record or import a take first.');commit(()=>{p.voiceBank.takes[code]=pending.take;},'Speech sound '+code+' kept in your voice bank.');delete ui.voicePending[code];if(advance){const from=C.Voice.phones.findIndex(x=>x.id===code),next=C.Voice.phones.slice(from+1).find(x=>!p.voiceBank.takes[x.id])||C.Voice.phones.find(x=>!p.voiceBank.takes[x.id]);if(next)ui.phone=next.id;}ui.voiceNotice='Kept '+code+'. Record the next sound when you are ready.';render();}
  function phraseAudio(){return C.Voice.sequence(p.voiceBank,ui.phrase,{rate:22050});}
  let voiceRecording=null,voiceTicket=0;
  async function startVoiceCapture(){
    C.assert(navigator.mediaDevices?.getUserMedia&&window.MediaRecorder,'Microphone capture needs a supported browser at localhost or HTTPS. You can also import WAV takes.');
    C.assert(!voiceRecording&&!ui.voiceProcessing,'A take is already being prepared.');audio.stop();const ticket=++voiceTicket,code=ui.phone,entry={code,ticket,stream:null,chunks:[],cancelled:false};voiceRecording=entry;ui.voiceNotice='Waiting for microphone access…';render();
    try{
      await audio.init();if(ticket!==voiceTicket||entry.cancelled)return;const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false}});entry.stream=stream;
      if(ticket!==voiceTicket||entry.cancelled){stream.getTracks().forEach(t=>t.stop());return;}
      const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
      const recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);entry.recorder=recorder;
      entry.input=audio.context.createMediaStreamSource(stream);entry.analyser=audio.context.createAnalyser();entry.analyser.fftSize=256;entry.input.connect(entry.analyser);
      const values=new Float32Array(256),started=Date.now();
      recorder.ondataavailable=e=>{if(e.data.size)entry.chunks.push(e.data);};
      recorder.onstop=async()=>{
        clearTimeout(entry.timeout);clearInterval(entry.timer);stream.getTracks().forEach(t=>t.stop());entry.input?.disconnect();entry.analyser?.disconnect();if(voiceRecording===entry)voiceRecording=null;
        if(entry.cancelled||ticket!==voiceTicket){render();return;}ui.voiceProcessing=true;ui.voiceNotice='Listening to the take…';render();
        try{const blob=new Blob(entry.chunks,{type:recorder.mimeType}),buffer=await audio.context.decodeAudioData(await blob.arrayBuffer()),samples=new Float32Array(Math.min(buffer.length,Math.floor(buffer.sampleRate*2.5)));for(let c=0;c<buffer.numberOfChannels;c++){const channel=buffer.getChannelData(c);for(let i=0;i<samples.length;i++)samples[i]+=channel[i]/buffer.numberOfChannels;}if(ticket!==voiceTicket)return;ui.voicePending[code]=C.Voice.analyse(samples,buffer.sampleRate,code);ui.voiceNotice='Listen to '+code+', then Keep & next or Retake.';}catch(error){ui.voiceNotice=error.message;notify(error.message,true);}finally{ui.voiceProcessing=false;render();}
      };
      recorder.onerror=()=>{entry.cancelled=true;cancelVoiceCapture();ui.voiceNotice='Recording stopped unexpectedly. Try again or import a WAV take.';render();};
      recorder.start();ui.voiceNotice='Recording '+code+'…';render();
      entry.timer=setInterval(()=>{entry.analyser.getFloatTimeDomainData(values);let energy=0;for(const v of values)energy+=v*v;const level=Math.min(100,Math.sqrt(energy/values.length)*350);if($('voice-input-level'))$('voice-input-level').style.width=level+'%';if($('voice-countdown'))$('voice-countdown').textContent='Recording '+code+' · '+Math.min(2.5,(Date.now()-started)/1000).toFixed(1)+' / 2.5 s';},100);
      entry.timeout=setTimeout(stopVoiceCapture,2500);
    }catch(error){entry.stream?.getTracks().forEach(t=>t.stop());entry.input?.disconnect();entry.analyser?.disconnect();if(voiceRecording===entry)voiceRecording=null;ui.voiceNotice=error.name==='NotAllowedError'?'Microphone access was denied. Allow it in the browser, or import a WAV take.':error.name==='NotFoundError'?'No microphone was found. Connect one, or import a WAV take.':error.name==='NotReadableError'?'The microphone could not be opened. Close other apps using it and try again.':error.message;render();notify(ui.voiceNotice,true);}
  }
  function stopVoiceCapture(){const entry=voiceRecording;if(!entry)return;if(entry.recorder?.state==='recording')entry.recorder.stop();else{entry.cancelled=true;voiceTicket++;voiceRecording=null;entry.stream?.getTracks().forEach(t=>t.stop());render();}}
  function cancelVoiceCapture(){const entry=voiceRecording;voiceTicket++;if(!entry)return;entry.cancelled=true;clearTimeout(entry.timeout);clearInterval(entry.timer);entry.stream?.getTracks().forEach(t=>t.stop());entry.input?.disconnect();entry.analyser?.disconnect();if(entry.recorder?.state==='recording')entry.recorder.stop();voiceRecording=null;}

  function sourceMini(side,label=side==='result'?'Result':'Wave '+side.toUpperCase()) {
    return `<button class="mini-play" data-action="preview-source" data-id="draft-${side}" data-side="${side}" data-name="${esc(label)}" aria-label="Play ${esc(label)} for 3 seconds" aria-pressed="false"><span class="mini-icon">▶</span><span class="mini-time">3s</span><span class="mini-pitch">${esc(label)}</span></button>`;
  }
  function shapeWorkshop() {
    const s=ui.shaper,side=s.side,voice=p.patch.project[side],points=voice.points,pins=voice.pins||[],i=s.cursor[side],selected=s.selection[side],pinned=pins.includes(i);
    const tabs=`<div class="shape-inspector-tabs" role="tablist" aria-label="Wave editing controls">${[['point','Point'],['arc','Arc'],['wave','Wave']].map(([key,label])=>`<button role="tab" aria-selected="${s.panel===key}" data-action="shape-panel" data-panel="${key}">${label}</button>`).join('')}</div>`;
    let body='';
    if(s.panel==='point')body=`<div class="precision-caption">EXACT POINT</div><div class="point-navigation"><button data-action="shape-point-step" data-delta="-1" aria-label="Previous waveform point">←</button><label>Point<input type="number" min="1" max="32" data-change="shape-dot" aria-label="Selected waveform dot" value="${i+1}"></label><button data-action="shape-point-step" data-delta="1" aria-label="Next waveform point">→</button></div><div class="exact-height"><label for="shape-height-input">Height</label> <span>−1 to +1</span><input id="shape-height-input" type="number" min="-1" max="1" step=".001" data-change="shape-height" aria-label="Selected dot height" value="${points[i].toFixed(3)}" ${pinned?'disabled':''}><button data-action="shape-set-height" aria-label="Set exact point height" ${pinned?'disabled':''}>Set</button></div><div class="point-actions"><button data-action="shape-pin" data-scope="point" aria-pressed="${pinned}">${pinned?'Unpin point':'Pin point'}</button><button data-action="shape-zero-point" ${pinned?'disabled':''}>Set zero</button></div><div class="point-grid" aria-label="Choose a waveform point">${points.map((v,k)=>`<button class="${selected.includes(k)?'chosen':''} ${k===i?'cursor-point':''} ${pins.includes(k)?'pinned-point':''}" data-action="shape-point-pick" data-index="${k}" aria-pressed="${selected.includes(k)}" aria-label="Dot ${k+1}, height ${v.toFixed(3)}${pins.includes(k)?', pinned':''}">${k+1}</button>`).join('')}</div><label class="precision-step">Arrow-key step<select data-change="shape-fine" aria-label="Waveform nudge step">${selectOptions([[.001,'0.001'],[.01,'0.01'],[.05,'0.05']],s.fine)}</select></label><p class="precision-help">← → choose a dot<br>↑ ↓ change height · Shift = ×10<br>L pins the chosen point</p>`;
    else if(s.panel==='arc')body=`<div class="precision-caption">EDIT A GROUP OF DOTS</div><div class="arc-endpoints"><label>From<input id="shape-arc-from" type="number" min="1" max="32" value="${selected.length?selected[0]+1:1}" aria-label="Arc start dot"></label><label>To<input id="shape-arc-to" type="number" min="1" max="32" value="${selected.length?selected.at(-1)+1:17}" aria-label="Arc end dot"></label></div><div class="point-actions"><button data-action="shape-select-arc">Select arc</button><button data-action="shape-select" data-kind="all">Whole wave</button></div><p class="precision-help">An arc can wrap past the shared end.</p><div class="arc-adjust"><label>Height %<input id="shape-gain" type="number" min="0" max="200" step="1" value="100" aria-label="Selected arc height percent"></label><button data-action="shape-adjust" data-mode="gain">Scale</button><label>Move ±<input id="shape-offset" type="number" min="-1" max="1" step=".01" value="0" aria-label="Selected arc vertical offset"></label><button data-action="shape-adjust" data-mode="offset">Move</button><label>Bend %<input id="shape-bend" type="number" min="-100" max="100" step="1" value="0" aria-label="Selected arc bend percent"></label><button data-action="shape-adjust" data-mode="bend">Bend</button></div><div class="precision-button-grid">${[['round','Round'],['sharpen','Sharpen'],['line','Straighten'],['curve','Ease ends'],['invert','Flip'],['zero','Zero']].map(([operation,label])=>`<button data-action="shape-transform" data-operation="${operation}">${label}</button>`).join('')}</div><button class="button-full" data-action="shape-pin" data-scope="selection">Pin / unpin selection</button><p class="precision-help">Pins keep their height. Bend keeps the two arc ends in place.</p>`;
    else {const marks=C.Shape.landmarks(points);body=`<div class="precision-caption">THE WHOLE OUTLINE</div>${range('shape-peak','Peak height',Math.round(Math.max(0,marks.high)*100),0,100,1,'%')}${range('shape-trough','Trough depth',Math.round(Math.max(0,-marks.low)*100),0,100,1,'%')}${range('wave-'+side+'-smoothness','Smoothness',Math.round((voice.smoothness||0)*100),0,100,1,'%')}<p class="precision-help">Smoothness rounds the sound while keeping the original dots.</p><div class="precision-button-grid"><button data-action="shape-center">Center</button><button data-action="shape-mirror" data-mode="reverse">Reverse</button><button data-action="shape-mirror" data-mode="same">Mirror half</button><button data-action="shape-mirror" data-mode="opposite">Opposite half</button><button data-action="shape-shift" data-delta="-1">Shift ←</button><button data-action="shape-shift" data-delta="1">Shift →</button></div><div class="point-actions"><button data-action="shape-copy">Copy to ${side==='a'?'B':'A'}</button><button data-action="shape-swap">Swap A / B</button></div><label class="precision-step">Pitch multiple<select data-change="ratio" data-side="${side}" aria-label="Wave ${side.toUpperCase()} pitch multiple">${selectOptions([1,2,3,4,8],voice.ratio)}</select></label>${range('wave-'+side+'-level','Level',Math.round(voice.level*100),0,100,1,'%')}${range('wave-'+side+'-phase','Phase',voice.phase,0,360,1,'°')}<button class="button-full quiet" data-action="shape-clear-pins">Clear ${pins.length} pins</button>`;}
    return `<aside class="precision-inspector">${tabs}<div class="precision-inspector-body">${body}</div></aside>`;
  }
  function soundView() {
    if(ui.soundMode==='capture')return heading(1,'A little sound can go anywhere.','Capture → shape a patch → beat → melody & vocals → arrange → export.')+soundModeTabs()+capture.view();
    if(ui.soundMode==='vocals')return heading(1,'Give the song a voice.','Words, held vowels, and little harmonies. Your notes can sing.')+soundModeTabs()+vocals.view();
    if(ui.soundMode==='real')return recordedInstrumentsView();if(ui.soundMode==='voice')return voiceCaptureView();if(ui.soundMode==='woof')return heading(1,'Wander into a good tone.','Two waves, a little mischief, and a patch worth keeping.')+soundModeTabs()+woof.view()+soundShelf();
    const s=ui.shaper,side=s.side,patch=p.patch.project,voice=patch[side],tools=[['draw','Draw'],['grab','Move'],['select','Select'],['peak','Peak'],['trough','Trough'],['edge','Zero edge']];
    const tabs=`<div class="wave-source-switcher">${['a','b'].map(key=>`<div class="wave-source-card ${side===key?'active':''}"><button class="wave-source-choice" role="tab" aria-selected="${side===key}" data-action="shape-side" data-side="${key}" aria-label="Edit wave ${key.toUpperCase()}"><canvas id="wave-thumb-${key}" aria-hidden="true"></canvas><span><strong>Wave ${key.toUpperCase()}</strong><small data-shape-source="${key}">${esc(patch[key].shape==='custom'?'Your drawing':patch[key].shape)} · ${Math.round(patch[key].smoothness*100)}% smooth</small></span></button>${sourceMini(key)}</div>`).join('')}</div>`;
    const toolbar=`<div class="precision-toolbar"><div class="precision-tools" aria-label="Wave drawing tools">${tools.map(([tool,label])=>`<button data-action="shape-tool" data-tool="${tool}" aria-pressed="${s.tool===tool}">${label}</button>`).join('')}</div><div class="precision-brush"><label>Neighbors<select data-change="shape-reach" aria-label="Shaping brush reach" ${['draw','select'].includes(s.tool)?'disabled':''}>${selectOptions([[0,'Only this dot'],[1,'1 dot'],[2,'2 dots'],[4,'4 dots'],[6,'6 dots'],[8,'8 dots']],s.reach)}</select></label><label>Strength<select data-change="shape-strength" aria-label="Drawing strength" ${s.tool==='select'?'disabled':''}>${selectOptions([[1,'100%'],[.5,'50%'],[.25,'25%'],[.1,'10%']],s.strength)}</select></label><label>Draw snap<select data-change="shape-snap" aria-label="Waveform drawing snap" ${s.tool==='select'?'disabled':''}>${selectOptions([[0,'Off'],[.01,'0.01'],[.05,'0.05'],[.1,'0.10'],[.25,'0.25']],s.snap)}</select></label><label class="marker-control"><input type="checkbox" data-change="shape-markers" ${s.markers?'checked':''}> Markers</label></div></div>`;
    const graph=`<div class="precision-editor"><div class="precision-graph-head"><label>Outline<select data-change="shape" data-side="${side}" aria-label="Wave ${side.toUpperCase()} shape">${selectOptions([...C.S.TYPES.map(t=>[t,t.charAt(0).toUpperCase()+t.slice(1)]),['custom','Your drawing']],voice.shape)}</select></label><div><label>View<select data-change="shape-zoom" aria-label="Waveform zoom">${selectOptions([[1,'Fit cycle'],[2,'Zoom ×2'],[4,'Zoom ×4']],s.zoom)}</select></label><label><input type="checkbox" data-change="shape-overlay" ${s.overlay?'checked':''}> Show ${side==='a'?'B':'A'}</label></div></div><div class="precision-plot-scroll" id="shape-plot-scroll"><canvas id="wave-${side}" data-wave="${side}" tabindex="0" style="width:${s.zoom*100}%" aria-label="Shape wave ${side.toUpperCase()}; arrow keys choose and move points; L pins a point"></canvas></div><div class="precision-plot-meta"><span id="shape-selection-summary"></span><span>START = END</span></div><div class="precision-find"><span>Find</span><button data-action="shape-select" data-kind="peaks">Peaks</button><button data-action="shape-select" data-kind="troughs">Troughs</button><button data-action="shape-select" data-kind="edges">Zero edges</button><button class="quiet" data-action="random-wave" data-side="${side}">Random</button><button class="quiet" data-action="clear-wave" data-side="${side}">Zero free dots</button></div><p class="precision-tool-help" id="shape-help">${shapeToolHelp()}</p></div>`;
    const editor=panel('<span class="dot"></span> Wave Shaper',`${tabs}${toolbar}<div class="wave-workspace">${graph}${shapeWorkshop()}</div>`,'<span class="chip">waveLAB / precise editing</span>','wave-lab');
    const result=panel('Listen & keep',`<div class="compact-sound-mix"><div class="result-mix-controls"><label>Combine<select data-change="collision" aria-label="Combine waves">${selectOptions([['blend','Blend A + B'],['subtract','Subtract A − B'],['multiply','Multiply A × B'],['fold','Wavefold']],patch.mode)}</select></label>${range('blend','A ↔ B',Math.round(patch.amount*100),0,100,1,'%')}<label class="fill-result"><input type="checkbox" data-change="normalize" ${patch.normalize?'checked':''}> Fill result</label></div><div class="compact-result"><canvas id="wave-result" aria-label="Combined sound waveform"></canvas>${sourceMini('result')}</div><div class="sound-keep-row"><label>Listen at<input type="number" data-change="pitch" min="20" max="20000" value="${p.patch.pitch}" aria-label="Sound pitch in Hz"><small>Hz</small></label><label>Sound name<input id="sound-name" maxlength="48" value="${esc(ui.soundName)}" aria-label="Sound name"></label><button class="primary" data-action="save-sound">Keep patch tone</button></div><details class="sound-character" data-shape-details="character" ${s.character?'open':''}><summary>Pitch, warmth & effects <span>${patch.effects.length} effects${p.patch.inverted?' · inverted':''}${p.patch.freePair?' · independent pitches':''}</span></summary><div class="sound-character-body"><div class="character-settings"><label><input type="checkbox" data-change="independent-pitches" ${p.patch.freePair?'checked':''}> Independent A / B pitches</label>${p.patch.freePair?`<div class="free-pitch-fields"><label>A / Hz<input type="number" min="20" max="19000" data-change="free-pitch" data-side="a" value="${p.patch.freePair.a}"></label><label>B / Hz<input type="number" min="20" max="19000" data-change="free-pitch" data-side="b" value="${p.patch.freePair.b}"></label></div>`:''}${range('drive','Warmth',Math.round((patch.amp.enabled?(patch.amp.drive-1)/11:0)*100),0,100,1,'%')}<label><input type="checkbox" data-change="invert" ${p.patch.inverted?'checked':''}> Invert polarity</label></div><div class="character-effects"><div class="effect-list">${effectControls()}</div><label class="field"><select data-change="add-effect" aria-label="Add an effect"><option value="">Add an effect</option>${selectOptions(Object.entries(C.FX.specs).map(([key,v])=>[key,v.label]),'')}</select></label></div></div></details></div>`);
    return heading(1,'Make a patch worth playing.','Tune two voices. Shape their character. Play it, catch it, keep it.')+soundModeTabs()+woof.patchPanel()+editor+result+`<details class="sound-library-drawer" data-shape-details="shelf" ${s.shelf?'open':''}><summary>Your sound box <span>${p.library.length} sounds · each with a 3s preview</span></summary>${soundShelf()}</details>`+next('beat','Build a beat','<b>Keep a sound you like.</b> Give it a heartbeat.');
  }
  function shapeToolHelp() {
    return {draw:'Draw the outline. Strength blends each stroke with the shape underneath.',grab:'Drag vertically to move dots. Ctrl-click adds a dot; hold Shift while dragging for fine movement.',select:'Drag across the dots to select an arc. Use Arc to scale, move, bend or pin it.',peak:'Place a peak at the height you click. Neighbors sets its width.',trough:'Place a trough at the depth you click. Neighbors sets its width.',edge:'Place a zero anchor with a smooth approach from its neighbors.'}[ui.shaper.tool];
  }

  function beatView() {
    const pattern = p.beat.pattern, count=C.D.stepsPerBar(pattern.meter), selected=pattern.tracks[ui.drum];
    const ruler = `<div class="beat-ruler" style="--steps:${count}"><span></span>${Array.from({length:count},(_,i)=>`<span>${i%4===0?i/4+1:'·'}</span>`).join('')}</div>`;
    const rows = pattern.tracks.map((track,row)=>`<div class="beat-row ${track.mute?'visually-muted':''}" style="--steps:${count}"><div class="drum-name ${row===ui.drum?'selected':''}"><button data-action="drum-select" data-row="${row}">${esc(track.name)}</button><button class="mute" data-action="drum-mute" data-row="${row}" aria-label="${track.mute?'Unmute':'Mute'} ${esc(track.name)}">${track.mute?'M':'·'}</button></div>${track.steps.slice(ui.beatBar*count,(ui.beatBar+1)*count).map((velocity,i)=>`<button class="step-pad ${velocity===1?'on':velocity===.5?'soft':''}" data-action="hit" data-row="${row}" data-step="${ui.beatBar*count+i}" data-local-step="${i}" aria-label="${esc(track.name)} step ${i+1}, ${velocity===1?'strong':velocity===.5?'soft':'off'}" aria-pressed="${velocity>0}">${velocity?'<span></span>':''}</button>`).join('')}</div>`).join('');
    const beatPanel = panel('<span class="dot" style="background:var(--orange)"></span> Find your pocket', `<div class="panel-body control-row" style="justify-content:space-between"><div class="segments">${Array.from({length:pattern.bars},(_,i)=>`<button class="${ui.beatBar===i?'active':''}" data-action="beat-bar" data-bar="${i}">M${i+1}</button>`).join('')}</div><label>Measures <select data-change="beat-bars" aria-label="Beat measures">${selectOptions([1,2,3,4,6,8],pattern.bars)}</select></label></div><div class="beat-grid">${ruler}${rows}</div><div class="beat-footer"><span>CLICK a hit · SHIFT + CLICK for a soft hit</span><span>${pattern.meter.numerator}/${pattern.meter.denominator} · ${count} STEPS / MEASURE</span></div><div class="panel-body"><div class="section-title" style="margin-top:0">START WITH A GROOVE</div><div class="control-row"><button data-action="beat-preset" data-preset="pocket">Pocket</button><button data-action="beat-preset" data-preset="four">Four on the floor</button><button data-action="beat-preset" data-preset="half">Half time</button><button data-action="repeat-beat">Copy measure → next</button><button data-action="clear-beat" class="quiet danger">Clear measure</button></div><div style="margin-top:20px">${range('swing','A little swing',Math.round(pattern.swing*100),0,45,1,'%')}</div></div>`, `<span class="chip" style="color:var(--orange);border-color:#755640;background:#362a24">beatMAP / reimagined</span>`);
    const inspector=panel(esc(selected.name)+' / sound', `<div class="panel-body"><div class="caption">SHAPE THIS DRUM</div><label class="field">Wave<select data-change="drum-wave">${selectOptions(p.library.map(w=>[w.id,w.name]),selected.waveId)}</select></label>${range('drum-pitch','Pitch',selected.pitch,30,2000,1,' Hz')}${range('drum-decay','Decay',Math.round(selected.decay*1000),30,1500,1,' ms')}${range('drum-noise','Texture / noise',Math.round(selected.noise*100),0,100,1,'%')}${range('drum-level','Drum level',Math.round(selected.level*100),0,100,1,'%')}<hr><label class="field">Beat name<input id="beat-name" maxlength="48" value="${esc(p.beat.name)}"></label><button class="secondary button-full" data-action="save-beat">＋ Keep beat in box</button><button class="primary button-full" style="margin-top:8px" data-action="beat-to-song">Add beat to song →</button>${ui.editTarget?.type==='beat'?'<button class="secondary button-full" style="margin-top:8px" data-action="apply-beat">Update this song beat →</button>':''}<p class="subtle" style="margin-top:10px">Each placement keeps its own beat. Your other clips stay as you made them.</p></div>`,'','inspector');
    return heading(2,'Give it a heartbeat.','Tap a few steps. Leave a little space. The groove is yours.')+`<div class="stage-content"><div>${beatPanel}${patternShelf()}</div>${inspector}</div>`+next('melody','Paint a melody','<b>Keep a beat going.</b> Audition your notes over it at the shared tempo.');
  }
  function pianoPaper(track) {
    const beatWidth=43*ui.zoom, total=p.melody.bars*4*beatWidth, notes=track.notes, low=ui.noteBase, high=low+24;
    const rows=[]; for(let midi=high;midi>=low;midi--) {
      const pc=midi%12, scale=p.melody.mode==='minor'?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11];
      const inside=scale.includes((pc-p.melody.root+12)%12);
      rows.push(`<div class="piano-row ${[1,3,6,8,10].includes(pc)?'black':''} ${pc===p.melody.root?'root':''}" data-midi="${midi}" data-name="${pc===0||pc===p.melody.root?esc(C.Song.noteName(midi)):''}" style="${inside?'':'opacity:.65'}">${notes.filter(n=>n.midi===midi).map(n=>`<button class="note ${ui.selected.includes(C.noteKey(n))?'selected':''}" data-note="${C.noteKey(n)}" aria-label="${C.Song.noteName(n.midi)} at beat ${n.start+1}, length ${n.duration}${n.vocal?', lyric '+esc(n.vocal.lyric):''}" style="left:${n.start*beatWidth}px;width:${Math.max(7,n.duration*beatWidth)}px">${n.vocal?'<span class="note-lyric">'+esc(n.vocal.lyric)+'</span>':n.duration>=.5?esc(C.Song.noteName(n.midi)):''}<span class="note-grip"></span></button>`).join('')}</div>`);
    }
    const outside=notes.filter(n=>n.midi<low||n.midi>high).length;
    return `<div class="piano-scroll" id="piano-scroll"><div id="piano-paper" class="piano-paper" style="width:${49+total}px;--bar-width:${beatWidth*4}px;--cell-width:${beatWidth*ui.grid}px" data-beat-width="${beatWidth}"><div class="piano-ruler">${Array.from({length:p.melody.bars},(_,b)=>`<span style="width:${beatWidth*4}px" data-action="note-cursor" data-beat="${b*4}">M${b+1}</span>`).join('')}</div>${rows.join('')}<div class="melody-playhead" id="melody-playhead" hidden></div></div></div><div class="editor-hint"><span>Drag to move · right edge to resize · Shift-click to group${outside?` · ${outside} notes outside this octave view`:''}</span><span>${track.notes.length} NOTES · ${ui.selected.length} SELECTED</span></div>`;
  }
  function melodyView() {
    const track=p.melody.tracks.find(t=>t.id===ui.part);
    const editor=panel('<span class="dot" style="background:var(--purple)"></span> A place for your notes', `<div class="part-tabs">${p.melody.tracks.map(t=>`<button class="${t.id===ui.part?'active':''}" data-action="part" data-part="${t.id}">${esc(t.name)}<small>${t.notes.length}</small></button>`).join('')}</div><div class="editor-toolbar">${[['draw','✎ Paint'],['select','▧ Select'],['erase','⌫ Erase']].map(([mode,label])=>`<button data-action="note-mode" data-mode="${mode}" class="${ui.noteMode===mode?'active':''}">${label}</button>`).join('')}<span class="toolbar-divider"></span><label>Grid<select data-change="grid">${selectOptions([[1,'¼'],[.5,'⅛'],[.25,'1/16'],[.125,'1/32']],ui.grid)}</select></label><label>Length<select data-change="note-length">${selectOptions([[.25,'1/16'],[.5,'⅛'],[1,'¼'],[2,'½'],[4,'Whole']],ui.length)}</select></label><button data-action="octave" data-delta="-12">Oct −</button><button data-action="octave" data-delta="12">Oct ＋</button><button data-action="zoom-notes" aria-label="Zoom note grid">${ui.zoom===1?'Zoom ＋':'Zoom −'}</button></div>${pianoPaper(track)}<div class="piano-key-row">${Array.from({length:13},(_,i)=>`<button data-action="key" data-midi="${60+i}" class="${[1,3,6,8,10].includes(i%12)?'black':''}" aria-label="Hear ${C.Song.noteName(60+i)}">${i%12===0?C.Song.noteName(60+i):[1,3,6,8,10].includes(i%12)?'':roots[i%12]}</button>`).join('')}</div><div class="panel-body control-row"><button data-action="select-notes">Select part</button><button data-action="duplicate-notes">Duplicate →</button><button data-action="transpose" data-delta="12">＋ Octave</button><button data-action="transpose" data-delta="-12">− Octave</button><button data-action="delete-notes" class="quiet danger">Delete selected</button><button data-action="clear-part" class="quiet">Clear part</button></div>`, '<span class="chip" style="color:var(--purple);border-color:#605076;background:#30273d">melodyLAB / reimagined</span>');
    const inspector=panel('Notes & possibilities', `<div class="panel-body"><div class="caption">THIS PART</div><label class="field">Sound<select data-change="part-sound">${soundOptions(track.instrument,ui.part==='rhythm')}</select></label>${range('part-level','Part level',Math.round(track.volume*100),0,100,1,'%')}<label class="field-inline"><input type="checkbox" data-change="part-mute" ${track.mute?'checked':''}> Mute this part</label><div class="split" style="margin-top:12px"><label class="field">Key<select data-change="root">${selectOptions(roots.map((n,i)=>[i,n]),p.melody.root)}</select></label><label class="field">Scale<select data-change="mode">${selectOptions([['major','Major'],['minor','Minor']],p.melody.mode)}</select></label></div><label class="field">Measures<select data-change="melody-bars">${selectOptions([1,2,4,8,12,16],p.melody.bars)}</select></label><hr><div class="caption">CHORD POCKET</div><div class="chord-buttons">${chordChoices().map(c=>`<button data-action="stamp-chord" data-degree="${c.degree}" title="Stamp ${c.label} at the note cursor">${esc(c.label)}</button>`).join('')}</div><p class="subtle">Click an M label to place the cursor. A chord stamps editable notes there.</p><hr><label class="field">Pattern name<input id="pattern-name" maxlength="48" value="${esc(ui.patternNames[ui.part]||track.name+' idea')}"></label><button class="secondary button-full" data-action="save-pattern">＋ Keep selected / part</button><button class="primary button-full" style="margin-top:8px" data-action="melody-to-song">Add parts to song →</button>${ui.editTarget?'<button class="primary button-full" style="margin-top:8px" data-action="apply-clip">Update this song clip →</button><p class="subtle">Editing one placement. Your other copies keep their notes.</p>':''}</div>`,'','inspector');
    return heading(3,'Paint what you hear.','A note. A phrase. A happy little accident. There’s no wrong place to start.')+`<div class="stage-content"><div>${vocals.melody(track)}${editor}${patternShelf()}</div>${inspector}</div>`+next('arrange','Arrange your song','<b>Your notes stay editable.</b> Keep a phrase, place it, and make it grow.');
  }
  function chordChoices() {
    const scale=p.melody.mode==='minor'?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11];
    return scale.map((offset,degree)=>({degree,label:roots[(p.melody.root+offset)%12]+((p.melody.mode==='minor'?[false,false,false,true,true,false,false]:[false,true,true,false,false,true,false])[degree]?'m':'')+(degree===(p.melody.mode==='minor'?1:6)?'°':'')}));
  }
  function clipSvg(notes, duration, color = 'currentColor') {
    if (!notes.length) return '<svg viewBox="0 0 100 20"><path d="M0 10h100" stroke="currentColor" stroke-dasharray="2 5"/></svg>';
    const low=Math.min(...notes.map(n=>n.midi)),high=Math.max(...notes.map(n=>n.midi))+1;
    return `<svg viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">${notes.slice(0,150).map(n=>`<rect x="${n.start/duration*100}" y="${17-(n.midi-low)/(high-low)*15}" width="${Math.max(1,n.duration/duration*100)}" height="2.5" fill="${color}"/>`).join('')}</svg>`;
  }
  function arrangementRows() {
    const rows=[];
    for(const t of p.song.tracks) {
      const clips=(t.phrases||[]).map(c=>({selection:{type:'phrase',trackId:t.id,id:c.id},name:c.name,start:c.start,duration:c.duration*c.repeats,notes:c.notes,cycle:c.duration,kind:'phrase',muted:c.mute}));
      if(t.notes.length) { const start=Math.min(...t.notes.map(n=>n.start)),end=Math.max(...t.notes.map(n=>n.start+n.duration)); clips.unshift({selection:{type:'notes',id:t.id},name:t.name,start,duration:end-start,notes:t.notes.map(n=>({...n,start:n.start-start})),cycle:end-start,kind:'notes'}); }
      rows.push({id:t.id,name:t.name,subtitle:instrumentName(t.instrument),clips,mute:t.mute});
    }
    if(p.song.clips.length||!rows.length)rows.push({id:'drums',name:'Beat track',subtitle:'THE POCKET',clips:p.song.clips.map(c=>{const b=p.song.beats.find(b=>b.id===c.beatId);return {selection:{type:'beat',id:c.id},name:b.name,start:c.start,duration:b.pattern.bars*C.Song.beatsPerBar(b.pattern.meter),kind:'beat',muted:c.mute,notes:[]};})});
    if(p.song.audio.length) rows.push({id:'audio',name:'Audio',subtitle:'RECORDINGS / WAV',clips:p.song.audio.map(c=>({selection:{type:'audio',id:c.id},name:c.name,start:c.start,duration:C.clipLength(p,{type:'audio',id:c.id}),kind:'audio',muted:c.mute,notes:[]}))});
    if(p.song.waves.length) rows.push({id:'waves',name:'Wave clips',subtitle:'WAVEFORMS',clips:p.song.waves.map(c=>({selection:{type:'wave',id:c.id},name:c.name,start:c.start,duration:c.duration,kind:'wave',muted:c.mute,notes:[]}))});
    return rows;
  }
  function sameSelection(a,b) { return a && b && a.type===b.type && a.id===b.id; }
  function sectionStrip() {
    return `<div class="song-sections"><div class="section-strip-head"><span>THE SHAPE OF YOUR SONG</span><button class="quiet" data-action="sections">${p.sections.length?'Edit sections':'＋ Name sections'}</button></div>${p.sections.length?`<div class="section-cards">${p.sections.map(s=>`<article class="section-card ${ui.section===s.id?'selected':''}"><button data-action="section-select" data-id="${esc(s.id)}"><strong>${esc(s.name)}</strong><small>M${s.from+1}–${s.to}</small></button><div><button data-action="section-play" data-id="${esc(s.id)}" aria-label="Hear ${esc(s.name)}">▶ Hear</button><button data-action="section-loop" data-id="${esc(s.id)}" aria-label="Loop ${esc(s.name)}">↻</button></div></article>`).join('')}</div>`:'<p>Name an opening, a lift, a return. Hear each part while you shape it.</p>'}</div>`;
  }
  function mixerView() {
    if(!ui.showMixer)return '';
    return panel('Make room for each part',`<div class="track-mixer"><p>Level and balance shape the saved mix. Room adds a gentle reverb. Solo is for listening; exports keep the saved mix.</p>${p.song.tracks.map(t=>`<div class="mixer-row ${t.mute?'visually-muted':''}"><div class="mixer-name"><strong>${esc(t.name)}</strong><small>${esc(instrumentName(t.instrument))}</small><div><button data-action="track-mute" data-id="${esc(t.id)}" aria-label="Mute ${esc(t.name)}" aria-pressed="${t.mute}">M</button><button data-action="track-solo" data-id="${esc(t.id)}" aria-label="Solo ${esc(t.name)}" aria-pressed="${ui.solo.includes(t.id)}">S</button></div></div>${range('track-'+t.id+'-volume','Level',Math.round(t.volume*100),0,100,1,'%')}${range('track-'+t.id+'-pan','Balance',Math.round(t.pan*100),-100,100,1,'%')}${range('track-'+t.id+'-room','Room',Math.round(t.room*100),0,60,1,'%')}</div>`).join('')}${!p.song.tracks.length?'<p>Add a melody part to start mixing. Beat and audio clips have their own placement controls.</p>':''}</div>`,ui.solo.length?'<button data-action="clear-solo" class="quiet">Clear solos</button>':'');
  }
  function arrangementView() {
    const barBeats=C.Song.beatsPerBar(p.song.meter),barWidth=78*ui.songZoom,beatWidth=barWidth/barBeats,rows=arrangementRows();
    const timeline=`<div class="timeline-scroll ${ui.songFit?'fit-song':''}" id="timeline-scroll"><div class="timeline" id="timeline" style="width:${130+p.song.bars*barWidth}px;--bar-width:${barWidth}px" data-beat-width="${beatWidth}"><div class="timeline-ruler">${Array.from({length:p.song.bars},(_,i)=>`<button data-action="song-cursor" data-beat="${i*barBeats}" aria-label="Go to measure ${i+1}" style="width:${barWidth}px">${i+1}</button>`).join('')}</div>${rows.map(row=>`<div class="timeline-row"><div class="track-heading"><strong>${esc(row.name)}</strong><small>${esc(row.subtitle)}</small>${!['drums','audio','waves'].includes(row.id)?`<button data-action="track-mute" data-id="${esc(row.id)}" aria-label="Mute ${esc(row.name)}" aria-pressed="${row.mute}">M</button><button data-action="track-solo" data-id="${esc(row.id)}" aria-label="Solo ${esc(row.name)}" aria-pressed="${ui.solo.includes(row.id)}">S</button>`:''}</div><div class="track-lane ${row.mute||(ui.solo.length&&!ui.solo.includes(row.id))?'visually-muted':''}" data-lane="${esc(row.id)}">${row.clips.map(c=>`<button class="song-clip ${c.kind} ${sameSelection(ui.clip,c.selection)?'selected':''} ${c.muted?'visually-muted':''}" data-clip="${esc(JSON.stringify(c.selection))}" data-at="${c.start}" data-duration="${c.duration}" style="left:${c.start*beatWidth}px;width:${Math.max(3,c.duration*beatWidth)}px" aria-label="${esc(c.name)} at measure ${(c.start/barBeats+1).toFixed(1)}"><strong>${esc(c.name.split(' · ').at(-1))}</strong>${clipSvg(c.notes,c.cycle||c.duration)}${['phrase','wave'].includes(c.kind)?'<span class="clip-grip"></span>':''}</button>`).join('')}</div></div>`).join('')}<div class="song-cursor" id="song-cursor"></div>${rows.every(r=>!r.clips.length)?'<div class="timeline-empty">Your song starts here.<br>Bring in a beat or melody, or try the starter.</div>':''}</div></div>`;
    const lengths=[...new Set([4,8,12,16,24,32,48,64,p.song.bars])].sort((a,b)=>a-b);
    const editor=panel('<span class="dot" style="background:var(--blue)"></span> A little idea, a whole song',`<div class="editor-toolbar"><label>Length<select data-change="song-bars">${selectOptions(lengths,p.song.bars)}</select> measures</label><button data-action="fit-song" aria-pressed="${ui.songFit}">Fit song</button><button data-action="zoom-song">${ui.songFit||ui.songZoom===1?'Zoom ＋':'Zoom −'}</button><label><input type="checkbox" data-change="follow-song" ${ui.follow?'checked':''}> Follow</label><button data-action="show-mixer" aria-pressed="${ui.showMixer}">Mixer</button><button data-action="import-midi">Import MIDI</button><button data-action="import-audio">Import WAV</button><button data-action="recording">Record a sound</button></div>${sectionStrip()}${timeline}<div class="editor-hint"><span>Drag clips to move · right edge to repeat · Zoom for fine edits</span><span>CURSOR M${(ui.cursor/barBeats+1).toFixed(1)}</span></div><div class="panel-body control-row"><button data-action="place-pattern">＋ Place selected pattern</button><button data-action="duplicate-clip">Duplicate after</button><button data-action="edit-clip">Edit notes / beat</button><button data-action="delete-clip" class="quiet danger">Delete clip</button></div>`);
    return heading(4,'Let the idea grow.','A little space. A moment that returns. A song with somewhere to go.')+`<div class="stage-content"><div>${editor}${mixerView()}${patternShelf()}</div>${clipInspector()}</div>`+next('export','Keep & export','<b>All the pieces, in one place.</b> Ready to take it with you?');
  }
  function fitTimeline() {
    const scroll=$('timeline-scroll'),line=$('timeline');if(!scroll||!line)return;
    const layout=C.Arrangement.layout(Math.max(140,scroll.clientWidth),p.song.bars,C.Song.beatsPerBar(p.song.meter),ui.songZoom,ui.songFit);
    line.style.width=layout.width+'px';line.style.setProperty('--bar-width',layout.barWidth+'px');line.dataset.beatWidth=layout.beatWidth;
    for(const [i,span]of [...line.querySelectorAll('[data-action="song-cursor"]')].entries()){span.style.width=layout.barWidth+'px';span.textContent=i%layout.labelEvery===0?i+1:'';}
    for(const clip of line.querySelectorAll('[data-clip]')){clip.style.left=+clip.dataset.at*layout.beatWidth+'px';clip.style.width=Math.max(3,+clip.dataset.duration*layout.beatWidth)+'px';}
    if(ui.songFit)scroll.scrollLeft=0;
    $('song-cursor').style.left=130+ui.cursor*layout.beatWidth+'px';
  }
  function readSectionRows() {
    return [...document.querySelectorAll('[data-section-row]')].map(row=>({id:row.dataset.sectionRow,name:row.querySelector('[data-section-name]').value,from:+row.querySelector('[data-section-from]').value-1,to:+row.querySelector('[data-section-to]').value}));
  }
  function sectionDialog(rows=p.sections) {
    showModal('Give the song a shape.',`<p>Name up to sixteen sections. First and last measures are included. Hear or loop a section from the song view.</p><div class="section-editor">${rows.map((s,i)=>`<div data-section-row="${esc(s.id)}"><label>Name<input data-section-name aria-label="Section ${i+1} name" maxlength="32" value="${esc(s.name)}"></label><label>First<input type="number" data-section-from aria-label="Section ${i+1} first measure" min="1" max="${p.song.bars}" value="${s.from+1}"></label><label>Last<input type="number" data-section-to aria-label="Section ${i+1} last measure" min="1" max="${p.song.bars}" value="${s.to}"></label><button data-action="remove-section" data-id="${esc(s.id)}" aria-label="Remove section ${i+1}">×</button></div>`).join('')}</div><div class="control-row"><button data-action="add-section">＋ Add section</button><button data-action="suggest-sections">Use clip boundaries</button></div>`,'<button class="quiet" data-action="close-modal">Cancel</button><button class="primary" data-action="save-sections">Keep sections</button>');
  }
  async function hearSection(id,loop) {
    const section=C.Arrangement.range(p,id);ui.section=id;ui.cursor=section.fromBeat;audio.setLoop(loop);render();await audio.play(p,'section',0,{sectionId:id,soloIds:ui.solo});announce((loop?'Looping ':'Hearing ')+section.name+'.');
  }
  function changeSolo(id) {
    ui.solo=ui.solo.includes(id)?ui.solo.filter(v=>v!==id):[...ui.solo,id];
    audio.audition={...audio.audition,soloIds:ui.solo};audio.refresh(p);render();announce(ui.solo.length?'Solo is for listening. Your saved mix stays ready to export.':'All parts are back in the listening mix.');
  }

  function clipInspector() {
    const c=C.findClip(p,ui.clip);
    if(!c) return panel('The little details','<div class="panel-body"><div class="inspector-empty">Choose a clip in your song to adjust its level, position, repeats, and feel.</div><hr><div class="caption">A SHARED WORKFLOW</div><p class="subtle">Keep patterns in the box.<br>Drag them into the song.<br>Edit each copy independently.<br>Undo whenever you like.</p></div>','','inspector');
    const type=ui.clip.type, at=type==='notes'?Math.min(...c.notes.map(n=>n.start)):c.start;
    return panel('This placement',`<div class="panel-body"><div class="caption">${esc(type.toUpperCase())} CLIP</div><label class="field">Name<input maxlength="48" data-change="clip-name" value="${esc(c.name||p.song.beats.find(b=>b.id===c.beatId)?.name||'Beat')}"></label><label class="field">At beat<input type="number" min="0" max="316" step="0.25" data-change="clip-start" value="${at}"></label>${type==='phrase'?`<label class="field">Repeats<input type="number" min="1" max="64" data-change="clip-repeats" value="${c.repeats}"></label>`:''}${range('clip-volume','Level',Math.round((c.volume??1)*100),0,100,1,'%')}${range('clip-pan','Balance',Math.round((c.pan||0)*100),-100,100,1,'%')}${range('clip-pitch','Pitch',c.pitch||0,-24,24,1,' st')}<label class="field-inline"><input type="checkbox" data-change="clip-mute" ${c.mute?'checked':''}> Mute this clip</label><hr>${type==='phrase'||type==='beat'||type==='notes'?'<button class="secondary button-full" data-action="edit-clip">Edit this clip →</button>':''}<button class="button-full quiet danger" data-action="delete-clip" style="margin-top:9px">Delete placement</button><p class="subtle" style="margin-top:10px">${type==='phrase'?'Edits affect this copy. Your pattern box and other placements keep their own notes.':'Changes belong to this placement.'}</p></div>`,'','inspector');
  }
  function exportView() {
    const count=p.song.tracks.reduce((sum,t)=>sum+t.notes.length+(t.phrases||[]).reduce((n,c)=>n+c.notes.length*c.repeats,0),0), seconds=p.song.bars*C.Song.beatsPerBar(p.song.meter)*60/p.song.bpm;
    const options=[['wav','WAV','Hear it anywhere.','Stereo audio with your sounds and effects. 16-bit PCM, ready to share.'],['midi','MIDI','Make it a starting point.','Editable notes and drums for another music app. Sounds stay in the project.'],['project','PROJECT','Keep making it yours.','Every sound, pattern, recording, and editable clip in one studio file.'],['pack','HANDOFF ZIP','Take the whole little world.','Your WAV, MIDI, editable project, and a short guide in one download.'],['stems','STEMS ZIP','Mix it your way.','Individual song tracks, drums, and recordings. All start at the same time.'],['classic','CLASSIC PROJECT','Keep the connection.','Open your work in the original studio and use the specialized tools.']];
    const cards=options.map(([type,format,title,description])=>`<article class="export-card ${type==='pack'?'featured':''}"><span class="format">${format}</span><h3>${title}</h3><p>${description}</p><button ${ui.busy?'disabled':''} data-action="export" data-format="${type}">${ui.busy?'Preparing…':'Download '+(type==='project'?'project':type==='classic'?'classic file':format)}</button></article>`).join('');
    return heading(5,'You made a thing. Keep it.','Save the idea. Share the sound. Come back and make something else tomorrow.')+`<div class="stage-content"><div><div class="panel panel-body"><div class="control-row" style="justify-content:space-between"><h2>${esc(p.song.name)}</h2><span class="chip">${ui.exportScope.toUpperCase()}</span></div><div class="stats-row"><div class="stat"><strong>${p.song.bars}</strong><small>MEASURES</small></div><div class="stat"><strong>${p.song.bpm}</strong><small>BPM</small></div><div class="stat"><strong>${Math.floor(seconds/60)}:${String(Math.round(seconds%60)).padStart(2,'0')}</strong><small>SONG LENGTH</small></div><div class="stat"><strong>${count}</strong><small>NOTES</small></div></div><div class="review-wave"><canvas id="export-wave" aria-label="Audio export waveform"></canvas><span id="render-label">A SOUND YOU CAN TAKE WITH YOU</span></div><button data-action="review-export" class="quiet">↻ Preview export waveform</button></div><div class="export-options" style="margin-top:16px">${cards}</div></div>${panel('The finishing touches',`<div class="panel-body"><div class="caption">EXPORT WHAT YOU NEED</div><label class="field">From<select data-change="export-scope">${selectOptions([['song','The whole song'],['melody','Melody draft'],['beat','Beat draft'],['sound','Current sound']],ui.exportScope)}</select></label><label class="field">Sample rate<select data-change="export-rate">${selectOptions([[44100,'44.1 kHz'],[48000,'48 kHz']],ui.exportRate)}</select></label><hr><div class="caption">WHAT GOES WITH IT</div><p class="subtle">WAV keeps the actual sounds, effects, clip levels, and stereo balance.</p><p class="subtle" style="margin-top:12px">Master volume and listening EQ belong to your speakers. They don’t change your exported music.</p><p class="subtle" style="margin-top:12px">Peaks are reduced only when needed to fit the file. Quiet music stays quiet.</p><hr><button class="secondary button-full" data-action="save">Save project first</button></div>`,'','inspector')}</div>`+next('sound','Back to making','<b>The studio is always here.</b> Keep a file so the idea is, too.');
  }
  const scrollMemory = new Map(); let renderedStep = 'sound';
  function render() {
    const previousScroll = $('piano-scroll') || $('timeline-scroll') || $('shape-plot-scroll');
    if (previousScroll) scrollMemory.set(renderedStep, [previousScroll.scrollLeft, previousScroll.scrollTop]);
    if($('project-name')!==document.activeElement) $('project-name').value=p.song.name;
    renderNav(); renderTransport();
    let html=({sound:soundView,beat:beatView,melody:melodyView,arrange:arrangementView,export:exportView})[ui.step]();
    html=sessionPath()+html;
    if(ui.recover&&!ui.recovered) html=`<div class="recovery-banner"><span>A previous studio draft is here when you need it.</span><button data-action="recover">Recover draft</button><button class="quiet" data-action="dismiss-recover">Keep starting fresh</button></div>`+html;
    $('workspace').innerHTML=html;
    renderedStep = ui.step;
    const nextScroll = $('piano-scroll') || $('timeline-scroll') || $('shape-plot-scroll'), savedScroll = scrollMemory.get(ui.step);
    if (nextScroll && savedScroll) { nextScroll.scrollLeft = savedScroll[0]; nextScroll.scrollTop = savedScroll[1]; }
    if(ui.step==='arrange')fitTimeline();
    if(ui.step==='sound'&&ui.soundMode==='wave')paintWaves();if(ui.step==='sound'&&ui.soundMode==='voice')paintVoiceTake(); if(ui.step==='export'&&lastExportAudio) paintExport(lastExportAudio);if(ui.step==='sound'&&ui.soundMode==='capture')capture.paint();renderMiniPlayers();
  }
  function drawCanvas(canvas, table, color, dots=false, side=null) {
    if(!canvas) return;
    const rect=canvas.getBoundingClientRect(), ratio=Math.min(window.devicePixelRatio||1,2), width=Math.max(1,rect.width),height=Math.max(1,rect.height);
    canvas.width=width*ratio; canvas.height=height*ratio;
    const ctx=canvas.getContext('2d'); ctx.scale(ratio,ratio); ctx.clearRect(0,0,width,height);
    ctx.strokeStyle='#293946'; ctx.lineWidth=1;
    for(let i=0;i<=8;i++){ctx.beginPath();ctx.moveTo(i*width/8,0);ctx.lineTo(i*width/8,height);ctx.stroke();}
    for(let i=1;i<=3;i++){ctx.beginPath();ctx.moveTo(0,i*height/4);ctx.lineTo(width,i*height/4);ctx.stroke();}
    const selected=side?ui.shaper.selection[side]:[];
    if(selected.length){ctx.fillStyle=color+'15';for(const i of selected){ctx.fillRect((i-.45)/32*width,0,width/32*.9,height);if(i===0)ctx.fillRect((32-.45)/32*width,0,width/32*.9,height);}}
    const voice=side?p.patch.project[side]:null,outline=voice?C.S.sourceOutline(voice):table;
    if(dots&&voice?.smoothness){ctx.strokeStyle=color+'50';ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.beginPath();for(let i=0;i<=32;i++){const x=i/32*width,y=height/2-table[i%32]*height*.36;if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();ctx.setLineDash([]);}
    if(side&&ui.shaper.overlay){const other=C.S.sourceOutline(p.patch.project[side==='a'?'b':'a']);ctx.strokeStyle=side==='a'?'#c7b1ff70':'#b8f58b70';ctx.lineWidth=1;ctx.setLineDash([5,5]);ctx.beginPath();for(let i=0;i<=Math.ceil(width);i++){const t=i/Math.ceil(width),y=height/2-C.S.sample(other,t)*height*.36;if(!i)ctx.moveTo(i,y);else ctx.lineTo(i,y);}ctx.stroke();ctx.setLineDash([]);}
    if(dots){ctx.font='9px Consolas, monospace';ctx.fillStyle='#7d8f9c';for(const v of [1,0,-1])ctx.fillText(v===1?'+1':String(v),6,height/2-v*height*.36-5);}
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();
    const size=Math.max(2,Math.ceil(width));for(let i=0;i<size;i++){const t=i/(size-1),x=t*width,y=height/2-C.S.sample(outline,t)*height*.36;if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
    if(dots){ctx.fillStyle=color;for(let slot=0;slot<=32;slot++){const i=slot%32,x=slot/32*width,y=height/2-table[i]*height*.36;ctx.fillRect(x-2,y-2,4,4);if(voice?.pins?.includes(i)){ctx.strokeStyle='#ffc78a';ctx.lineWidth=2;ctx.strokeRect(x-5,y-5,10,10);}if(selected.includes(i)||i===0){ctx.strokeStyle=i===0?'#e0f8d0':'#f7f5e7';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.stroke();}}}
    if(side&&ui.shaper.markers){const marks=C.Shape.landmarks(table);
      for(const [list,fill,direction] of [[marks.peaks,'#ffb783',-1],[marks.troughs,'#99d4f8',1]])for(const i of list){const x=i/32*width,y=height/2-table[i]*height*.36+direction*12;ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(x,y+direction*4);ctx.lineTo(x-4,y-direction*3);ctx.lineTo(x+4,y-direction*3);ctx.closePath();ctx.fill();}
      ctx.strokeStyle='#dce5e2';ctx.lineWidth=1;for(const edge of marks.crossings){const x=edge.at/32*width;ctx.beginPath();ctx.moveTo(x,height/2-7);ctx.lineTo(x,height/2+7);ctx.stroke();}
    }
  }
  function paintWaves() {
    const c=p.patch.freePair?C.Collision.preview(p.patch.project,p.patch.freePair):C.S.compile(p.patch.project,{frequency:p.patch.pitch});
    for(const side of ['a','b']){const voice=p.patch.project[side],color=side==='a'?'#b8f58b':'#c7b1ff';drawCanvas($('wave-'+side),voice.points,color,true,side);drawCanvas($('wave-thumb-'+side),C.S.sourceOutline(voice),color);}
    drawCanvas($('wave-result'),c.result.table,'#ffb783');updateShapeReadout();
  }
  function updateShapeReadout() {
    const s=ui.shaper,side=s.side,voice=p.patch.project[side],points=voice.points,selected=s.selection[side],i=s.cursor[side],pins=voice.pins||[],marks=C.Shape.landmarks(points);
    if($('shape-selection-summary'))$('shape-selection-summary').textContent=`Dot ${i+1} · ${points[i].toFixed(3)} · ${selected.length||32} selected${pins.length?' · '+pins.length+' pinned':''}`;
    for(const button of document.querySelectorAll('[data-action="shape-side"]')){button.classList.toggle('active',button.dataset.side===side);button.setAttribute('aria-selected',String(button.dataset.side===side));}
    for(const [key,value]of [['shape-peak',Math.round(Math.max(0,marks.high)*100)],['shape-trough',Math.round(Math.max(0,-marks.low)*100)]]){const input=$('r-'+key);if(input&&input!==document.activeElement){input.value=value;input.previousElementSibling.textContent=value+'%';}}
    const dot=document.querySelector('[data-change="shape-dot"]'),height=document.querySelector('[data-change="shape-height"]');if(dot&&dot!==document.activeElement)dot.value=i+1;if(height){height.disabled=pins.includes(i);if(height!==document.activeElement)height.value=points[i].toFixed(3);}
    for(const button of document.querySelectorAll('[data-action="shape-point-pick"]')){const k=+button.dataset.index;button.classList.toggle('chosen',selected.includes(k));button.classList.toggle('cursor-point',k===i);button.classList.toggle('pinned-point',pins.includes(k));button.setAttribute('aria-pressed',String(selected.includes(k)));button.setAttribute('aria-label',`Dot ${k+1}, height ${points[k].toFixed(3)}${pins.includes(k)?', pinned':''}`);}
    const pin=document.querySelector('[data-action="shape-pin"][data-scope="point"]');if(pin){pin.textContent=pins.includes(i)?'Unpin point':'Pin point';pin.setAttribute('aria-pressed',String(pins.includes(i)));}
    const from=$('shape-arc-from'),to=$('shape-arc-to');if(from&&from!==document.activeElement)from.value=selected.length?selected[0]+1:1;if(to&&to!==document.activeElement)to.value=selected.length?selected.at(-1)+1:17;
    const preset=document.querySelector('[data-change="shape"]');if(preset&&preset!==document.activeElement)preset.value=voice.shape;
    for(const key of ['a','b']){const label=document.querySelector(`[data-shape-source="${key}"]`),v=p.patch.project[key];if(label)label.textContent=(v.shape==='custom'?'Your drawing':v.shape)+' · '+Math.round(v.smoothness*100)+'% smooth';}
  }

  function paintExport(a) {
    const canvas=$('export-wave');if(!canvas)return;
    const rect=canvas.getBoundingClientRect(),r=window.devicePixelRatio||1;canvas.width=rect.width*r;canvas.height=rect.height*r;const ctx=canvas.getContext('2d');ctx.scale(r,r);ctx.strokeStyle='#a9db89';
    for(let x=0;x<rect.width;x+=3){let peak=0;const from=Math.floor(x/rect.width*a.left.length),to=Math.floor((x+3)/rect.width*a.left.length),skip=Math.max(1,Math.floor((to-from)/32));for(let i=from;i<to;i+=skip)peak=Math.max(peak,Math.abs(a.left[i]),Math.abs(a.right[i]));ctx.beginPath();ctx.moveTo(x,rect.height/2-peak*rect.height*.45);ctx.lineTo(x,rect.height/2+peak*rect.height*.45);ctx.stroke();}
    $('render-label').textContent=`${a.rate/1000} kHz · ${a.duration.toFixed(2)} SEC · STEREO`;
  }
  async function togglePlay(scope=scopeForStep()) {
    woof.stop();
    if(scope==='song'&&audio.scope==='section'&&audio.positionWhenStopped&&ui.section)scope='section';
    if(audio.playing||audio.pending){audio.pause();return;}
    const from = audio.scope === scope && audio.positionWhenStopped ? audio.positionWhenStopped * p.song.bpm / 60 : scope==='song'?ui.cursor:0;
    const audition=scope==='section'?audio.audition:{soloIds:ui.solo};await audio.play(p,scope,from,audition);
  }
  function setShapePoints(side,points,base=p.patch.project[side].points,strength=1) {
    const voice=p.patch.project[side];voice.points=C.Shape.protect(base,points,voice.pins||[],strength);voice.shape='custom';
  }
  function resetWaveNudge(){waveNudgeKey=null;}
  function setExactShapeHeight(input){
    const side=ui.shaper.side,voice=p.patch.project[side],index=ui.shaper.cursor[side];let next;
    try{C.assert(String(input.value).trim()!=='','Enter a height between -1 and +1.');next=C.Shape.setPoint(voice.points,index,+input.value,voice.pins);}catch(error){input.value=voice.points[index].toFixed(3);notify(error.message,true);return;}
    if(next.every((v,i)=>v===voice.points[i])){announce('Point is already at that height.');return;}
    commit(()=>setShapePoints(side,next),'Point height set exactly. Neighboring dots kept their heights.');
  }
  function chooseShapePoint(index,extend=false) {
    resetWaveNudge();
    const s=ui.shaper,side=s.side,at=(index+32)%32,previous=s.cursor[side];s.cursor[side]=at;s.selection[side]=extend?C.Shape.arcBetween(s.selection[side][0]??previous,at):[at];paintWaves();revealShapePoint();
  }
  function revealShapePoint() {
    const scroll=$('shape-plot-scroll'),canvas=$('wave-'+ui.shaper.side);if(!scroll||!canvas)return;const x=ui.shaper.cursor[ui.shaper.side]/32*canvas.getBoundingClientRect().width;
    if(x<scroll.scrollLeft+20||x>scroll.scrollLeft+scroll.clientWidth-20)scroll.scrollLeft=Math.max(0,x-scroll.clientWidth/2);
  }
  function toggleShapePins(scope='point') {
    const s=ui.shaper,side=s.side,voice=p.patch.project[side],chosen=scope==='point'?[s.cursor[side]]:C.Shape.indices(s.selection[side]),fixed=voice.pins||[],remove=chosen.every(i=>fixed.includes(i));
    commit(()=>voice.pins=C.Shape.pins(remove?fixed.filter(i=>!chosen.includes(i)):[...fixed,...chosen]),remove?'Points unpinned.':'Pinned points keep their height while you sculpt.');
  }
  function adjustShape(mode) {
    const s=ui.shaper,side=s.side,voice=p.patch.project[side],selection=s.selection[side];let options={};
    if(mode==='gain')options.gain=+$('shape-gain').value/100;
    else if(mode==='offset')options.offset=+$('shape-offset').value;
    else if(mode==='bend')options.bend=+$('shape-bend').value/100;
    else throw new Error('Choose an arc adjustment.');
    commit(()=>{const next=mode==='offset'?C.Shape.move(voice.points,selection,options.offset,0,voice.pins):C.Shape.adjust(voice.points,selection,options,voice.pins);setShapePoints(side,next);},'Selected dots adjusted. Pinned anchors kept their height.');
  }
  function shapeKeyboard(event) {
    const canvas=event.target.closest('canvas[data-wave]');if(!canvas||ui.step!=='sound')return false;
    const s=ui.shaper,side=canvas.dataset.wave;s.side=side;const current=s.cursor[side],voice=p.patch.project[side],mod=event.ctrlKey||event.metaKey;
    if(mod&&event.key.toLowerCase()==='a'){s.selection[side]=Array.from({length:32},(_,i)=>i);paintWaves();return true;}
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){chooseShapePoint(current+(event.key==='ArrowRight'?1:-1),event.shiftKey);return true;}
    if(event.key==='Home'||event.key==='End'){chooseShapePoint(event.key==='Home'?0:31,event.shiftKey);return true;}
    if(event.key==='ArrowUp'||event.key==='ArrowDown'){
      const selected=s.selection[side].length?s.selection[side]:[current],delta=(event.key==='ArrowUp'?1:-1)*s.fine*(event.shiftKey?10:1);
      const next=C.Shape.move(voice.points,selected,delta,0,voice.pins);
      if(next.some((v,i)=>v!==voice.points[i])){
        const key=selected.join(','),same=event.repeat&&waveNudgeKey?.key===event.key&&waveNudgeKey.side===side&&waveNudgeKey.selection===key&&waveNudgeKey.entry===undo.at(-1);
        if(same){setShapePoints(side,next);redo=[];changed('Points nudged precisely.',false);}else commit(()=>setShapePoints(side,next),'Points nudged precisely.',false);
        waveNudgeKey={key:event.key,side,selection:key,entry:undo.at(-1)};
      }
      paintWaves();return true;
    }
    if(event.key.toLowerCase()==='l'&&!mod){toggleShapePins();$('wave-'+side)?.focus({preventScroll:true});return true;}
    if(event.key==='Delete'||event.key==='Backspace'){const next=C.Shape.protect(voice.points,C.Shape.transform(voice.points,s.selection[side].length?s.selection[side]:[current],'zero'),voice.pins);if(next.some((v,i)=>v!==voice.points[i]))commit(()=>setShapePoints(side,next),'Unpinned selected points set to zero.',false);paintWaves();return true;}
    return false;
  }

  const actions={
    step:b=>setStep(b.dataset.step), play:()=>togglePlay(), stop:()=>{capture.cancel();woof.stop();audio.stop();cancelVoiceCapture();cancelRecording();render();announce('All sound stopped. Your work is here.');},
    'song-play':()=>{woof.stop();return audio.playing&&audio.scope==='song'?audio.stop():audio.play(p,'song',ui.cursor,{soloIds:ui.solo});},
    'sound-mode':b=>{capture.cancel();woof.stop();cancelVoiceCapture();ui.soundMode=b.dataset.mode;render();},
    'preview-instrument':b=>previewInstrument(b),
    'use-instrument':b=>{commit(()=>p.melody.tracks.find(t=>t.id===ui.part).instrument=b.dataset.instrument,'Recorded instrument assigned to this melody part.');setStep('melody');},
    'voice-phone':b=>{cancelVoiceCapture();ui.phone=b.dataset.code;ui.voiceNotice='';render();},
    'voice-record':()=>startVoiceCapture(),'voice-stop':()=>stopVoiceCapture(),
    'voice-keep':()=>keepVoiceTake(),
    'voice-import-take':()=>chooseFile('voice-take'),
    'import-voice':()=>chooseFile('voice-bank'),
    'export-voice':()=>download(JSON.stringify(C.Voice.validate(p.voiceBank),null,2),'application/json','voice-bank.json'),
    'voice-use':()=>{if(ui.voicePending[ui.phone])keepVoiceTake(false);C.assert(p.voiceBank.takes[ui.phone],'Keep a take first.');commit(()=>p.melody.tracks.find(t=>t.id===ui.part).instrument='voice-'+ui.phone,'Your recorded speech sound is ready for notes.');setStep('melody');},
    'voice-append':()=>{ui.phrase=(ui.phrase.trim()+' '+ui.phone).trim();render();},
    'voice-hear-phrase':()=>{C.Voice.sequence(p.voiceBank,ui.phrase);return audio.play({...p,text:ui.phrase,speed:1},'voice-phrase');},
    'voice-add-phrase':()=>{const captured=phraseAudio();addAudio(captured,p.voiceBank.name+' phrase');setStep('arrange');},
    'voice-export-phrase':()=>{const captured=phraseAudio();download(C.IO.encodeWav(captured.samples,captured.rate),'audio/wav','voice-phrase.wav');},
    undo:()=>history('undo'),redo:()=>history('redo'),open:()=>chooseFile('project'),save:()=>saveProject(),
    new:()=>newDialog(),starter:()=>{audio.stop();capture.cancel();commit(()=>{p=shareSounds(C.starter());ui.solo=[];ui.section=null;ui.clip=null;ui.editTarget=null;ui.selected=[];ui.cursor=0;ui.noteBase=48;ui.beatBar=0;ui.recovered=true;},'Windowlight is ready. Every note and placement is yours to edit.');setStep('arrange');$('modal').close();},
    recover:()=>{const data=shareSounds(C.open(JSON.parse(ui.recover)));audio.stop();capture.cancel();commit(()=>{p=data;ui.solo=[];ui.section=null;ui.recovered=true;ui.selected=[];ui.clip=null;ui.cursor=0;},'Your previous draft is back. Save a project file to keep it.');},
    'dismiss-recover':()=>{ui.recovered=true;ui.recover=null;render();},
    help:()=>helpDialog(),listen:()=>listenDialog(),classic:()=>classicDialog(),
    'close-modal':()=>$('modal').close(),
    'confirm-new':()=>{audio.stop();capture.cancel();commit(()=>{p=shareSounds(C.blank());ui.solo=[];ui.section=null;Object.assign(ui,{selected:[],clip:null,editTarget:null,cursor:0,beatBar:0,recovered:true});},'A fresh page. Previous work is one Undo away.');$('modal').close();setStep('sound');},
    'random-wave':b=>commit(()=>{setShapePoints(b.dataset.side,C.S.smoothPoints(Array.from({length:32},()=>Math.random()*2-1)));},'A new shape to play with.'),
    'clear-wave':b=>commit(()=>{setShapePoints(b.dataset.side,Array(32).fill(0));},'Wave cleared. Draw a new one.'),
    'remove-effect':b=>commit(()=>p.patch.project.effects.splice(+b.dataset.index,1),'Effect removed.'),
    'save-sound':()=>keepPatchTone(),
    'preview-sound':b=>{const wave=p.library.find(w=>w.id===b.dataset.id);C.assert(wave,'That sound is no longer in the box.');woof.stop();return audio.previewSound(wave);},
    'preview-source':b=>{woof.stop();return audio.previewSound({id:b.dataset.id,name:b.dataset.name},{patch:p.patch,target:b.dataset.side});},
    'shape-side':b=>{ui.shaper.side=b.dataset.side;render();},
    'shape-panel':b=>{ui.shaper.panel=b.dataset.panel;render();},
    'shape-point-pick':(b,e)=>chooseShapePoint(+b.dataset.index,e.shiftKey),
    'shape-point-step':b=>chooseShapePoint(ui.shaper.cursor[ui.shaper.side]+(+b.dataset.delta)),
    'shape-pin':b=>toggleShapePins(b.dataset.scope),
    'shape-clear-pins':()=>commit(()=>p.patch.project[ui.shaper.side].pins=[],'All pins in this wave cleared.'),
    'shape-set-height':()=>changes['shape-height'](document.querySelector('[data-change="shape-height"]')),
    'shape-zero-point':()=>setExactShapeHeight({value:'0'}),
    'shape-adjust':b=>adjustShape(b.dataset.mode),
    'shape-mirror':b=>commit(()=>{const side=ui.shaper.side,v=p.patch.project[side];setShapePoints(side,C.Shape.mirror(v.points,b.dataset.mode,v.pins));},'Outline transformed. Pinned points kept their height.'),
    'shape-copy':()=>commit(()=>{const side=ui.shaper.side,to=side==='a'?'b':'a',v=p.patch.project[side],target=p.patch.project[to];for(const key of ['points','pins','shape','smoothness'])target[key]=structuredClone(v[key]??[]);},'Outline and pins copied to the other wave. Its pitch, phase and level are kept.'),
    'shape-swap':()=>commit(()=>{const a=p.patch.project.a,b=p.patch.project.b;for(const key of ['points','pins','shape','smoothness']){const value=a[key];a[key]=b[key];b[key]=value;}},'A and B outlines swapped. Pitch, phase and level kept their places.'),
    'shape-tool':b=>{ui.shaper.tool=b.dataset.tool;if(b.dataset.tool==='select')ui.shaper.panel='arc';render();},
    'shape-select-arc':()=>{const side=ui.shaper.side,from=Math.round(num($('shape-arc-from').value,1,32,1))-1,to=Math.round(num($('shape-arc-to').value,1,32,17))-1;ui.shaper.selection[side]=C.Shape.arcBetween(from,to);ui.shaper.cursor[side]=to;paintWaves();announce(`Selected the arc from dot ${from+1} to dot ${to+1}.`);},
    'shape-select':b=>{const side=ui.shaper.side,kind=b.dataset.kind,marks=C.Shape.landmarks(p.patch.project[side].points);const chosen=kind==='all'?Array.from({length:32},(_,i)=>i):marks[kind];if(kind!=='all'&&!chosen.length){notify('No '+kind+' yet. Place a peak or trough, or draw a shape first.');return;}ui.shaper.selection[side]=[...chosen];if(chosen.length)ui.shaper.cursor[side]=chosen[0];paintWaves();announce(kind==='all'?'Whole cycle selected.':`Selected ${chosen.length} ${kind==='edges'?'dots around the zero crossings':kind}.`);},
    'shape-transform':b=>commit(()=>{const side=ui.shaper.side;setShapePoints(side,C.Shape.transform(p.patch.project[side].points,ui.shaper.selection[side],b.dataset.operation));},'Shape sculpted. Undo brings the previous contour back.'),
    'shape-center':()=>commit(()=>{const side=ui.shaper.side;setShapePoints(side,C.Shape.transform(p.patch.project[side].points,[],'center'));},'Wave centered around zero.'),
    'shape-shift':b=>commit(()=>{const side=ui.shaper.side,delta=+b.dataset.delta;setShapePoints(side,C.Shape.shift(p.patch.project[side].points,delta));ui.shaper.selection[side]=ui.shaper.selection[side].map(i=>(i+delta+32)%32);ui.shaper.cursor[side]=(ui.shaper.cursor[side]+delta+32)%32;},'Contour shifted one dot around the cycle.'),
    'pick-sound':b=>{ui.sound=b.dataset.id;if(ui.step==='sound'){woof.stop();const wave=p.library.find(w=>w.id===ui.sound);if(wave?.patchTone){woof.loaded(wave.patchTone);commit(()=>C.loadPatchTone(p,ui.sound),'Patch tone recalled with both voices and effects.');}else commit(()=>C.setSoundFromWave(p,ui.sound),'Sound loaded into Wave A.');}else if(ui.step==='melody'){commit(()=>p.melody.tracks.find(t=>t.id===ui.part).instrument=ui.sound,'Sound assigned to this part.');}else render();},
    'import-library':()=>chooseFile('library'),'export-library':()=>download(JSON.stringify({kind:'dot-wave-library',version:1,waves:p.library},null,2),'application/json','sounds.library.json'),
    'remove-sound':()=>commit(()=>{const id=ui.sound;C.assert(!id.startsWith('stock-'),'The built-in sounds stay in the studio. Choose one of your own sounds to remove.');
      const used=p.melody.tracks.some(t=>t.instrument===id)||p.song.tracks.some(t=>t.instrument===id)||p.patterns.some(t=>t.instrument===id)||[p.beat,...p.beatShelf,...p.song.beats].some(b=>C.D.allTracks(b.pattern).some(t=>t.waveId===id));
      C.assert(!used,'This sound is used in your music. Assign another sound to those parts before removing it.');p.library=p.library.filter(w=>w.id!==id);ui.sound='stock-sine';
    },'Sound removed. Undo restores it.'),
    'remove-pattern':()=>commit(()=>{C.assert(ui.pattern,'Choose a saved pattern first.');p.patterns=p.patterns.filter(x=>x.id!==ui.pattern);p.beatShelf=p.beatShelf.filter(x=>x.id!==ui.pattern);ui.pattern=null;},'Pattern removed from the box. Placed clips kept their own music.'),
    'drum-select':b=>{ui.drum=+b.dataset.row;render();},'drum-mute':b=>commit(()=>{const t=p.beat.pattern.tracks[+b.dataset.row];t.mute=!t.mute;},'Drum mute changed.'),
    hit:(b,e)=>{const row=+b.dataset.row,step=+b.dataset.step;commit(()=>{const t=p.beat.pattern.tracks[row];t.steps[step]=e.shiftKey?(t.steps[step]===.5?0:.5):(t.steps[step]?0:1);ui.drum=row;},'Beat updated.');},
    'beat-bar':b=>{ui.beatBar=+b.dataset.bar;render();},
    'clear-beat':()=>commit(()=>{const count=C.D.stepsPerBar(p.beat.pattern.meter);p.beat.pattern.tracks.forEach(t=>t.steps.fill(0,ui.beatBar*count,(ui.beatBar+1)*count));},'This measure cleared.'),
    'repeat-beat':()=>commit(()=>{const count=C.D.stepsPerBar(p.beat.pattern.meter);if(ui.beatBar+1>=p.beat.pattern.bars){C.assert(p.beat.pattern.bars<8,'The beat already has eight measures.');p.beat.pattern=C.D.resizePattern(p.beat.pattern,{bars:p.beat.pattern.bars+1});}for(const t of p.beat.pattern.tracks)t.steps.splice((ui.beatBar+1)*count,count,...t.steps.slice(ui.beatBar*count,(ui.beatBar+1)*count));ui.beatBar++;},'Measure copied to the next one.'),
    'beat-preset':b=>commit(()=>{const count=C.D.stepsPerBar(p.beat.pattern.meter),at=ui.beatBar*count;for(const t of p.beat.pattern.tracks)t.steps.fill(0,at,at+count);const hits=b.dataset.preset==='four'?[[0,4,8,12],[4,12],[2,6,10,14],[]]:b.dataset.preset==='half'?[[0,10],[8],[0,2,4,6,8,10,12,14],[14]]:[[0,6,8],[4,12],[0,2,4,6,8,10,12,14],[]];hits.forEach((lane,r)=>lane.filter(i=>i<count).forEach(i=>p.beat.pattern.tracks[r].steps[at+i]=r===2?.5:1));},'Groove loaded into this measure. Undo brings yours back.'),
    'save-beat':()=>commit(()=>{C.assert(p.beatShelf.length<16,'Keep up to 16 beats. Export a project before starting a new collection.');p.beat.name=$('beat-name').value.trim()||'Little beat';p.beatShelf.push({...C.clone(p.beat),id:C.id('saved-beat')});},'Beat kept in your pattern box.'),
    'beat-to-song':()=>{const title=$('beat-name').value;commit(()=>{p.beat.name=title.trim()||'Little beat';ui.clip=C.addBeat(p,p.beat,ui.cursor);},'Beat placed at your song cursor.');setStep('arrange');},
    'apply-beat':()=>commit(()=>{const clip=C.findClip(p,ui.editTarget);C.assert(clip&&ui.editTarget.type==='beat','The original beat placement is no longer here.');
      const next={id:C.id('beat'),name:p.beat.name,pattern:C.clone(p.beat.pattern),volume:p.beat.volume};
      C.extend(p,clip.start+next.pattern.bars*C.Song.beatsPerBar(next.pattern.meter));
      const other=p.song.clips.filter(c=>c.id!==clip.id);p.song.beats=p.song.beats.filter(b=>other.some(c=>c.beatId===b.id));C.assert(p.song.beats.length<16,'This song holds sixteen beat variations.');p.song.beats.push(next);clip.beatId=next.id;
    },'This beat placement updated. Your other copies kept their original beat.'),
    part:b=>{ui.part=b.dataset.part;ui.selected=[];render();},
    'note-mode':b=>{ui.noteMode=b.dataset.mode;render();},
    octave:b=>{ui.noteBase=C.clamp(ui.noteBase+(+b.dataset.delta),12,96);render();},
    'zoom-notes':()=>{ui.zoom=ui.zoom===1?2:1;render();},
    key:b=>{const t=p.melody.tracks.find(t=>t.id===ui.part);return audio.preview(p,+b.dataset.midi,t.instrument,.6,t.room,t.notes.find(n=>ui.selected.includes(C.noteKey(n)))?.vocal);},
    'select-notes':()=>{ui.selected=p.melody.tracks.find(t=>t.id===ui.part).notes.map(C.noteKey);render();},
    'delete-notes':()=>deleteNotes(),
    transpose:b=>moveNotes(0,+b.dataset.delta,0),
    'duplicate-notes':()=>duplicateNotes(),
    'clear-part':()=>commit(()=>{p.melody.tracks.find(t=>t.id===ui.part).notes=[];ui.selected=[];},'This part is a fresh page.'),
    'note-cursor':b=>{ui.noteCursor=+b.dataset.beat;announce('Note cursor at measure '+(ui.noteCursor/4+1)+'.');},
    'stamp-chord':b=>stampChord(+b.dataset.degree),
    'save-pattern':()=>commit(()=>{C.assert(p.patterns.length<32,'The pattern box holds 32 melodies.');const pattern=C.patternFromPart(p,ui.part,ui.selected,$('pattern-name').value);p.patterns.push(pattern);ui.pattern=pattern.id;},'Editable pattern kept in your box.'),
    'melody-to-song':()=>{commit(()=>{for(const t of p.melody.tracks.filter(t=>t.notes.length&&!t.mute)){const pattern=C.patternFromPart(p,t.id,null,t.name+' idea');ui.clip=C.addPattern(p,pattern,ui.cursor);}C.assert(p.melody.tracks.some(t=>t.notes.length&&!t.mute),'Paint some notes first.');},'Your parts are in the song, still editable.');setStep('arrange');},
    'pick-pattern':b=>{ui.pattern=b.dataset.id;announce('Selected '+(p.patterns.find(x=>x.id===ui.pattern)||p.beatShelf.find(x=>x.id===ui.pattern)).name+'. Drag it to the timeline or choose Place selected pattern.');render();},
    'place-pattern':()=>commit(()=>placePattern(ui.pattern,ui.cursor),'Pattern placed at the song cursor.'),
    'import-pattern':()=>chooseFile('pattern'),'export-pattern':()=>exportPattern(),
    'song-cursor':b=>{ui.cursor=+b.dataset.beat;render();},
    'zoom-song':()=>{ui.songZoom=ui.songFit?1:ui.songZoom===1?2:1;ui.songFit=false;render();},
    'fit-song':()=>{ui.songFit=true;render();},
    'show-mixer':()=>{ui.showMixer=!ui.showMixer;render();},
    'track-solo':b=>changeSolo(b.dataset.id),
    'clear-solo':()=>{ui.solo=[];audio.audition={...audio.audition,soloIds:[]};audio.refresh(p);render();},
    'sections':()=>sectionDialog(),
    'section-select':b=>{ui.section=b.dataset.id;ui.cursor=C.Arrangement.range(p,ui.section).fromBeat;render();},
    'section-play':b=>hearSection(b.dataset.id,false),
    'section-loop':b=>hearSection(b.dataset.id,true),
    'add-section':()=>{const rows=readSectionRows();C.assert(rows.length<16,'Keep up to sixteen sections.');const from=rows.length?rows.at(-1).to:0;C.assert(from<p.song.bars,'The last section reaches the end. Shorten it to make space first.');sectionDialog([...rows,{id:C.id('section'),name:'A new moment',from,to:Math.min(p.song.bars,from+4)}]);},
    'remove-section':b=>sectionDialog(readSectionRows().filter(s=>s.id!==b.dataset.id)),
    'suggest-sections':()=>{const rows=C.Arrangement.suggestions(p);C.assert(rows.length,'Place some melody clips first, or add sections by hand.');sectionDialog(rows);},
    'save-sections':()=>{const next=C.Arrangement.sections(readSectionRows(),p.song.bars);if(audio.scope==='section')audio.stop();commit(()=>{p.sections=next;ui.section=next.some(s=>s.id===ui.section)?ui.section:null;},'Song sections kept. Hear each part from its little play button.');$('modal').close();},
    'track-mute':b=>commit(()=>{const track=p.song.tracks.find(t=>t.id===b.dataset.id);track.mute=!track.mute;},'Track mute changed.'),
    'duplicate-clip':()=>duplicateClip(),'delete-clip':()=>deleteClip(),'edit-clip':()=>editClip(),'apply-clip':()=>applyClip(),
    'import-midi':()=>chooseFile('midi'),'import-audio':()=>chooseFile('audio'),recording:()=>recordDialog(),
    'start-recording':()=>startRecording(),'stop-recording':()=>stopRecording(),
    'export':b=>doExport(b.dataset.format),'review-export':()=>reviewExport(),
    'eq-reset':()=>{for(let i=0;i<10;i++)audio.setEQ(i,0);listenDialog();}
  };
  function placePattern(patternId,at,trackId) {
    const melody=p.patterns.find(x=>x.id===patternId), beat=p.beatShelf.find(x=>x.id===patternId);
    C.assert(melody||beat,'Keep or choose a pattern in your box first.');
    ui.clip=melody?C.addPattern(p,melody,at,trackId):C.addBeat(p,beat,at);
  }
  function moveNotes(time,pitch,length) { commit(()=>{const track=p.melody.tracks.find(t=>t.id===ui.part);ui.selected=C.transformNotes(track,ui.selected,time,pitch,length,p.melody.bars*4);},'Notes updated.'); }
  function deleteNotes() { if(!ui.selected.length)return;commit(()=>{const t=p.melody.tracks.find(t=>t.id===ui.part);t.notes=t.notes.filter(n=>!ui.selected.includes(C.noteKey(n)));ui.selected=[];},'Selected notes removed.'); }
  function duplicateNotes() {
    commit(()=>{const t=p.melody.tracks.find(t=>t.id===ui.part),notes=t.notes.filter(n=>ui.selected.includes(C.noteKey(n)));C.assert(notes.length,'Select notes to repeat.');
      const from=Math.floor(Math.min(...notes.map(n=>n.start))/4)*4,to=Math.ceil(Math.max(...notes.map(n=>n.start+n.duration))/4)*4,delta=to-from;
      const copies=notes.map(n=>({...n,start:n.start+delta})),end=Math.max(...copies.map(n=>n.start+n.duration));
      C.assert(end<=64,'That copy would go past sixteen measures.');C.assert(copies.every(n=>!t.notes.some(existing=>C.noteKey(existing)===C.noteKey(n))),'That destination already has notes.');
      p.melody.bars=Math.max(p.melody.bars,Math.ceil(end/4));t.notes.push(...copies);ui.selected=copies.map(C.noteKey);
    },'Phrase repeated. Each copy is editable.');
  }
  function stampChord(degree) {
    commit(()=>{const scale=p.melody.mode==='minor'?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11], track=p.melody.tracks.find(t=>t.id==='chords');
      const pitches=[degree,degree+2,degree+4].map(i=>48+p.melody.root+scale[i%7]+Math.floor(i/7)*12),start=Math.min(ui.noteCursor,p.melody.bars*4-ui.length);
      const notes=pitches.map(midi=>({midi,start,duration:ui.length,velocity:ui.velocity}));C.assert(notes.every(n=>!track.notes.some(old=>C.noteKey(n)===C.noteKey(old))),'That chord position already has notes.');track.notes.push(...notes);ui.part='chords';ui.selected=notes.map(C.noteKey);
    },'Chord stamped as editable notes.');
  }
  function duplicateClip() {
    commit(()=>{const c=C.findClip(p,ui.clip);C.assert(c,'Choose a clip to duplicate.');const type=ui.clip.type;
      C.assert(type!=='notes','Use Edit notes to make an independent pattern first.');const next=structuredClone(c);next.id=C.id('clip');next.start+=C.clipLength(p,ui.clip);C.extend(p,next.start+C.clipLength(p,ui.clip));
      if(type==='phrase'){C.assert(p.song.tracks.reduce((n,t)=>n+(t.phrases?.length||0),0)<128,'Keep up to 128 melody clips.');p.song.tracks.find(t=>t.id===ui.clip.trackId).phrases.push(next);}
      else if(type==='beat'){C.assert(p.song.clips.length<128,'Keep up to 128 beat placements.');p.song.clips.push(next);}
      else if(type==='audio'){C.assert(p.song.audio.reduce((s,a)=>s+a.samples.length/a.rate,0)+c.samples.length/c.rate<=60,'Keep imported audio under one minute in total.');p.song.audio.push(next);}
      else p.song.waves.push(next);ui.clip={...ui.clip,id:next.id};
    },'Independent copy placed after this clip.');
  }
  function deleteClip() {
    commit(()=>{const c=C.findClip(p,ui.clip);C.assert(c,'Choose a clip first.');const type=ui.clip.type;
      if(type==='phrase'){const t=p.song.tracks.find(t=>t.id===ui.clip.trackId);t.phrases=t.phrases.filter(c=>c.id!==ui.clip.id);}
      else if(type==='notes') c.notes=[];
      else if(type==='beat'){p.song.clips=p.song.clips.filter(c=>c.id!==ui.clip.id);p.song.beats=p.song.beats.filter(b=>p.song.clips.some(c=>c.beatId===b.id));}
      else if(type==='audio')p.song.audio=p.song.audio.filter(c=>c.id!==ui.clip.id);
      else p.song.waves=p.song.waves.filter(c=>c.id!==ui.clip.id);
      p.song.tracks=p.song.tracks.filter(t=>t.notes.length||(t.phrases||[]).length);ui.clip=null;
    },'Placement removed. Your pattern box is still here.');
  }
  function editClip() {
    const c=C.findClip(p,ui.clip);C.assert(c,'Choose a clip first.');
    if(ui.clip.type==='beat') {
      const beat=p.song.beats.find(b=>b.id===c.beatId);ui.editTarget={...ui.clip};
      commit(()=>{p.beat={name:beat.name,pattern:C.clone(beat.pattern),volume:beat.volume};ui.beatBar=0;},'Beat opened as a draft. Add it to the song to make a new independent placement.');setStep('beat');return;
    }
    C.assert(['phrase','notes'].includes(ui.clip.type),'Recordings and wave clips use the placement controls.');
    const track=ui.clip.type==='notes'?c:p.song.tracks.find(t=>t.id===ui.clip.trackId), notes=c.notes;
    const begin=ui.clip.type==='notes'?Math.floor(Math.min(...notes.map(n=>n.start))/4)*4:0;
    const span=ui.clip.type==='notes'?Math.ceil((Math.max(...notes.map(n=>n.start+n.duration))-begin)/4)*4:c.duration;
    C.assert(span<=64,'This phrase is longer than the sixteen-measure note editor. Use Classic for its full-length editing.');
    const target={...ui.clip};
    commit(()=>{p.melody=C.M.defaultProject();p.melody.name=c.name||track.name;p.melody.bpm=p.song.bpm;p.melody.bars=Math.max(1,Math.ceil(span/4));const part=p.melody.tracks[0];part.notes=notes.map(n=>({...n,start:n.start-begin}));part.instrument=track.instrument;part.volume=track.volume;part.room=track.room;ui.part=part.id;ui.editTarget={...target,begin};ui.noteBase=C.clamp(Math.floor(Math.min(...notes.map(n=>n.midi))/12)*12,12,96);},'This copy is open in Melody. Update the song clip when you are ready.');
    setStep('melody');
  }
  function applyClip() {
    commit(()=>{const c=C.findClip(p,ui.editTarget);C.assert(c,'The original clip is no longer here. Add this melody as a new pattern.');const track=p.melody.tracks.find(t=>t.id===ui.part);C.assert(track.notes.length,'Keep at least one note to update this clip.');
      if(ui.editTarget.type==='notes'){c.notes=track.notes.map(n=>({...n,start:n.start+ui.editTarget.begin}));c.instrument=track.instrument;}
      else {const lane=p.song.tracks.find(t=>t.id===ui.editTarget.trackId);C.assert(lane.instrument===track.instrument,'This track uses another sound. Add the edited part as a new song track to use its new sound.');c.notes=C.clone(track.notes);c.duration=p.melody.bars*4;C.extend(p,c.start+c.duration*c.repeats);}
      ui.clip={...ui.editTarget};
    },'This song placement now has your edited notes. Other copies kept their notes.');
  }
  function chooseFile(mode) { fileMode=mode;$('file-input').accept=mode==='midi'?'.mid,.midi':['audio','voice-take','capture'].includes(mode)?'.wav':'.json';$('file-input').value='';$('file-input').click(); }
  function filename() { return p.song.name.replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-|-$/g,'').slice(0,45)||'Dot-Wave'; }
  function download(data,type,suffix) {
    const blob=new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
    const stem=filename(),stamp=new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,17);a.download=stem+'-'+stamp+'-'+suffix;a.href=url;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);return a.download;
  }
  function saveProject() { download(C.serialize(p),'application/json','studio.json');savedVersion=revision;$('save-state').textContent='Project sent to Downloads';saveDraft();clearTimeout(toastTimer);$('toast').classList.remove('visible');announce('Project saved. Keep the downloaded file to edit again.'); }
  async function readFile(file,mode) {
    C.assert(file.size<45*1024*1024,'Choose a file under 45 MB.');const ticket=++fileTicket;
    const buffer=await file.arrayBuffer();if(ticket!==fileTicket)return;
    if(mode==='capture'){const decoded=C.IO.decodeWav(buffer);await capture.accept(decoded,file.name);return;}
    if(mode==='patch-tone'){woof.read(JSON.parse(new TextDecoder().decode(buffer)));return;}
    if(mode==='voice-take'){const code=ui.phone,decoded=C.IO.decodeWav(buffer);ui.voicePending[code]=C.Voice.analyse(decoded.samples,decoded.rate,code);ui.voiceNotice='Imported '+code+'. Listen before keeping it.';render();return;}
    if(mode==='voice-bank'){const bank=C.Voice.validate(JSON.parse(new TextDecoder().decode(buffer)));C.assert(p.melody.tracks.concat(p.song.tracks).filter(t=>t.instrument.startsWith('voice-')).every(t=>bank.takes[t.instrument.slice(6)]),'This bank is missing a speech sound used in your notes. Open it in a fresh project, or record those sounds first.');commit(()=>p.voiceBank=bank,'Voice bank opened with its recorded sounds.');ui.voicePending={};ui.soundMode='voice';setStep('sound');return;}
    if(mode==='project'){
      capture.cancel();woof.stop();const value=shareSounds(C.open(JSON.parse(new TextDecoder().decode(buffer))));audio.stop();commit(()=>{p=value;ui.solo=[];ui.section=null;ui.selected=[];ui.clip=null;ui.editTarget=null;ui.cursor=0;ui.beatBar=0;ui.recovered=true;},'Project opened with its sounds and editable music. Playback is stopped.');setStep('arrange');return;
    }
    if(mode==='midi') { const midi=C.IO.decode(buffer);commit(()=>{
      const tracks=midi.tracks.filter(t=>t.notes.length);C.assert(tracks.length,'This MIDI file has no notes.');C.assert(p.song.tracks.length+tracks.length<=8,'This import would exceed eight note tracks.');
      for(const t of tracks)p.song.tracks.push({id:C.id('midi'),name:(t.name||file.name).slice(0,48),instrument:t.channel===9?'drums':'piano',volume:.65,mute:false,notes:t.notes.map(n=>({...n,start:n.start+ui.cursor}))});C.extend(p,ui.cursor+midi.duration);p.song=C.Song.validateSong(p.song,C.signals(p.library,p.voiceBank));
    },'MIDI imported as editable notes using pocket piano and drums. '+midi.warnings.join(' '));setStep('arrange');return; }
    if(mode==='audio') { const decoded=C.IO.decodeWav(buffer);addAudio(decoded,file.name);return; }
    const data=JSON.parse(new TextDecoder().decode(buffer));
    if(mode==='library'){const waves=C.W.validateBundle(data);commit(()=>{p.library=C.W.prepareImport(p.library,waves,()=>C.id('sound')).waves;},'Sound library imported. Existing sounds kept their names and shapes.');return;}
    if(mode==='pattern'){commit(()=>{
      C.assert(p.patterns.length<32,'The pattern box holds 32 melodies.');const incoming=C.W.validateBundle({kind:'dot-wave-library',version:1,waves:data.waves||[]});const merge=C.W.prepareImport(p.library,incoming,()=>C.id('sound'));p.library=merge.waves;const pattern=C.checkedPattern({...data,id:C.id('pattern'),instrument:merge.remap.get(data.instrument)||data.instrument},C.signals(p.library,p.voiceBank));p.patterns.push(pattern);ui.pattern=pattern.id;
    },'Editable pattern added to your box.');}
  }
  function addAudio(decoded,title) {
    const kept=commit(()=>{C.assert(p.song.audio.length<8,'Keep up to eight recordings.');C.assert(decoded.duration+p.song.audio.reduce((s,c)=>s+c.samples.length/c.rate,0)<=60.0001,'Keep imported recordings under one minute in total.');
      const clip={id:C.id('audio'),name:title.slice(0,64),start:ui.cursor,volume:.7,pan:0,pitch:0,mute:false,rate:decoded.rate,samples:decoded.samples};p.song.audio.push(clip);C.extend(p,ui.cursor+decoded.duration*p.song.bpm/60);ui.clip={type:'audio',id:clip.id};
    },'Recording added to your song. Stereo files are mixed to mono; their original speed is kept.');if(kept)setStep('arrange');return kept;
  }
  function exportPattern() {
    const pattern=p.patterns.find(x=>x.id===ui.pattern);C.assert(pattern,'Choose a melody pattern first.');
    download(JSON.stringify({...pattern,waves:p.library.filter(w=>w.id===pattern.instrument)},null,2),'application/json','pattern.json');
  }
  async function reviewExport() { const data=await audio.render(p,ui.exportScope,{rate:ui.exportRate});lastExportAudio=data;paintExport(data);notify('Real export waveform ready.'); }
  async function doExport(type) {
    if(ui.busy)return;
    if(type==='project'){saveProject();return;}
    if(type==='classic'){download(JSON.stringify(C.legacy(p),null,2),'application/json','classic.studio.json');notify('Classic-compatible project downloaded.');return;}
    ui.busy=true;render();announce('Preparing '+type.toUpperCase()+'… your music can keep playing.');
    const snapshot=structuredClone(p),scope=ui.exportScope,rate=ui.exportRate;
    try{
      const song=C.scopeSong(snapshot,scope),midi=scope==='sound'?null:C.IO.encode(C.Song.toMidi(song));
      if(type==='midi'){C.assert(midi,'A raw waveform has no note events. Choose the melody, beat, or song for MIDI.');download(midi,'audio/midi','notes.mid');}
      else if(type==='stems'){
        C.assert(scope==='song','Choose The whole song to export track stems.');const files=[],stems=[...song.tracks.map(t=>({type:'notes',id:t.id,name:t.name})),...(song.clips.length?[{type:'drums',id:'drums',name:'Drums'}]:[]),...song.audio.map(t=>({type:'audio',id:t.id,name:t.name})),...song.waves.map(t=>({type:'wave',id:t.id,name:t.name}))];
        C.assert(stems.length,'Put some music into your song first.');let i=0;for(const stem of stems){announce(`Rendering stem ${++i}/${stems.length}: ${stem.name}`);const data=await audio.render(snapshot,'song',{rate,stem,normalize:false});const peak=Math.max(C.S.peakOf(data.left),C.S.peakOf(data.right));const scale=peak>.98?.98/peak:1;for(let n=0;n<data.left.length;n++){data.left[n]*=scale;data.right[n]*=scale;}files.push({name:String(i).padStart(2,'0')+'-'+stem.name.replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,40)+'.wav',data:C.encodeStereo(data)});}
        files.push({name:'READ-ME.txt',data:'Dot Wave Studio 2 stems. All files start at song time zero. Muted tracks are silent. Playback Master and listening EQ are excluded. Individual stems reduce peaks only if required to fit PCM; do not assume all stem levels sum exactly to the normalized full mix.'});
        download(C.IO.zipStore(files),'application/zip','stems.zip');
      }else{
        const data=await audio.render(snapshot,scope,{rate});lastExportAudio=data;const wav=C.encodeStereo(data);
        if(type==='wav')download(wav,'audio/wav',scope+'.wav');
        else{const files=[{name:'Listen.wav',data:wav},{name:'Editable.studio.json',data:C.serialize(snapshot)},{name:'READ-ME.txt',data:`Made in Dot Wave Studio 2. Open Editable.studio.json in the studio to edit every sound, note, and placement. Listen.wav exports the ${scope} at ${rate} Hz, stereo 16-bit PCM. Listening Master and EQ are not included. MIDI contains notes, not these custom sounds. No audio was uploaded.`}];if(midi)files.push({name:'Notes.mid',data:midi});download(C.IO.zipStore(files),'application/zip','handoff.zip');}
      }
      notify(type.toUpperCase()+' sent to Downloads. Your project is still open.');
    }finally{ui.busy=false;render();}
  }
  function showModal(title,body,actions='<button class="secondary" data-action="close-modal">Back to studio</button>') {
    $('modal-body').innerHTML=`<div class="modal-head"><h2>${title}</h2><button class="quiet" data-action="close-modal" aria-label="Close dialog">×</button></div><div class="modal-content">${body}</div><div class="modal-actions">${actions}</div>`;
    if(!$('modal').open)$('modal').showModal();
  }
  function newDialog(){showModal('A fresh little idea.','<p>Your current session will be one Undo away. Save a project file first if you want to keep a separate copy.</p>','<button class="quiet" data-action="close-modal">Keep working</button><button class="secondary" data-action="save">Save project</button><button class="primary" data-action="confirm-new">Start fresh</button>');}
  function helpDialog(){showModal('A little guidance.',`<p><b>Capture → Shape a patch → Beat → Melody / Vocals → Arrange → Export.</b> Start anywhere, come back whenever. Switching steps keeps the music playing.</p><ul><li><b>Capture / hum:</b> record or open a WAV up to 30 seconds. Review it, then add its tune as editable notes, send a repeating cycle to wave A/B, or keep the original audio in your song. Nothing changes until you choose. <b>Sound:</b> tune two patch voices, play the patch keyboard, and shape A/B. WOOFpad wanders through collisions, keeps discoveries and offers phone-tone seeds. Catch a tone and Keep patch tone to retain its editable recipe. <b>Vocals</b> offers three built-in singing characters and your recorded voice kit. Choose one, paint notes and put words on them in Melody.</li><li><b>Beat:</b> click a step for a hit. Shift-click makes a soft hit. Keep it in your box.</li><li><b>Melody:</b> paint notes. Drag the body to move, the right edge to resize. Shift-click groups notes; Select draws a selection box.</li><li><b>Arrange:</b> drag a saved pattern onto the timeline. Drag clips to move them; pull a melody clip’s edge to repeat it. Edit a clip, then Update this song clip. Sung lyrics stay attached to their notes; use _ to carry a vowel.</li><li><b>Export:</b> WAV is the sound; MIDI is the notes; project files keep everything editable.</li></ul><div class="shortcut"><span>Play / pause</span><code>Space</code></div><div class="shortcut"><span>Stop every sound</span><code>Escape</code></div><div class="shortcut"><span>Undo / Redo</span><code>Ctrl Z / Ctrl Shift Z</code></div><div class="shortcut"><span>Save / Open project</span><code>Ctrl S / Ctrl O</code></div><div class="shortcut"><span>Move selected notes / change length</span><code>Arrows / Shift + ← →</code></div><div class="shortcut"><span>Duplicate selected notes or clip</span><code>Ctrl D</code></div><p style="margin-top:15px">The studio starts quietly. Keep device volume comfortable. The digital output guard limits peaks; your speakers still control how loud the room is.</p>`,'<button class="secondary" data-action="starter">✦ Try a starter</button><button class="primary" data-action="close-modal">Back to studio</button>');}
  function listenDialog(){showModal('For your ears.',`<p>Listening EQ and Master affect your speakers. Your exported music keeps its own mix.</p><div class="eq-grid">${[32,64,125,250,500,1000,2000,4000,8000,16000].map((hz,i)=>`<label>${hz>=1000?hz/1000+'k':hz} Hz<input type="range" data-eq="${i}" min="-12" max="12" step="1" value="${audio.eqGains[i]}" aria-label="${hz} Hz EQ"><output>${audio.eqGains[i]} dB</output></label>`).join('')}</div><p style="margin-top:15px">Output peaks are guarded at −12 dBFS. This controls digital peaks, not the loudness of your device.</p>`,'<button class="quiet" data-action="eq-reset">Reset EQ</button><button class="primary" data-action="close-modal">Back to studio</button>');}
  function classicDialog(){showModal('The rest of your studio.',`<p>The five main music tools have a new home here. The specialized tools remain available in the included Classic Studio: room tuning, voiceLAB, ROM sound importing, SNES DJ, YouTube, live retuning, karaoke and the landline beta. Capture / hum is now built into this studio.</p><p>Save a <b>Classic project</b> here, then open it in Classic to keep working with those tools. To return, save its project and open that file in this studio.</p><p><a href="Dot-Wave-Classic.html" target="_blank" rel="noopener">Open Classic Studio ↗</a></p><p class="tiny">The Classic file is included in the download ZIP. The Home Assistant bridge still uses the installed edition.</p>`,'<button class="secondary" data-action="export" data-format="classic">Save Classic project</button><button class="primary" data-action="close-modal">Back to studio</button>');}
  let recording=null,recordCancel=0;
  function recordDialog(){showModal('Catch a little sound.','<p>Record up to 30 seconds from this browser’s microphone. It becomes an audio clip at your song cursor. Recording starts only when you press Record; nothing is uploaded.</p><p id="record-status">Ready when you are. Use headphones to avoid recording the studio playback.</p>','<button class="quiet" data-action="close-modal">Cancel</button><button id="record-start" class="primary" data-action="start-recording">● Record</button><button id="record-stop" class="secondary" data-action="stop-recording" disabled>■ Keep recording</button>');}
  async function startRecording(){
    C.assert(navigator.mediaDevices?.getUserMedia&&window.MediaRecorder,'Recording needs microphone support on localhost or HTTPS. Import a WAV instead.');
    C.assert(!recording,'A recording is already in progress.');const ticket=++recordCancel;$('record-start').disabled=true;$('record-status').textContent='Waiting for microphone access…';
    let stream;
    try{stream=await navigator.mediaDevices.getUserMedia({audio:true});if(ticket!==recordCancel||!$('modal').open){stream.getTracks().forEach(t=>t.stop());return;}
      const recorder=new MediaRecorder(stream),chunks=[],started=Date.now();recording={recorder,stream,chunks,timer:null,cancelled:false};
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recorder.onstop=async()=>{const finished=recording;recording=null;clearInterval(finished?.timer);stream.getTracks().forEach(t=>t.stop());if(!finished||finished.cancelled)return;try{const context=await audio.init(),buffer=await context.decodeAudioData(await new Blob(chunks,{type:recorder.mimeType}).arrayBuffer());const samples=new Float32Array(Math.min(buffer.length,buffer.sampleRate*30));for(let c=0;c<buffer.numberOfChannels;c++){const channel=buffer.getChannelData(c);for(let i=0;i<samples.length;i++)samples[i]+=channel[i]/buffer.numberOfChannels;}addAudio({samples,rate:buffer.sampleRate,duration:samples.length/buffer.sampleRate},'My recording');$('modal').close();}catch(e){notify(e.message,true);}};
      recorder.start();$('record-stop').disabled=false;
      recording.timer=setInterval(()=>{const elapsed=(Date.now()-started)/1000;if($('record-status'))$('record-status').textContent='Recording · '+Math.floor(elapsed)+' / 30 seconds';if(elapsed>=30)stopRecording();},200);
    }catch(e){stream?.getTracks().forEach(t=>t.stop());if($('record-status'))$('record-status').textContent='Microphone could not start: '+e.message;if($('record-start'))$('record-start').disabled=false;throw e;}
  }
  function stopRecording(){if(recording?.recorder.state==='recording')recording.recorder.stop();if($('record-stop'))$('record-stop').disabled=true;}
  function cancelRecording(){recordCancel++;if(recording){recording.cancelled=true;clearInterval(recording.timer);recording.stream.getTracks().forEach(t=>t.stop());if(recording.recorder.state==='recording')recording.recorder.stop();}}
  $('modal').addEventListener('close',cancelRecording);
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
    const action=actions[button.dataset.action];if(!action)return;
    try{await action(button,event);}catch(error){notify(error.message,true);}
  });
  $('file-input').addEventListener('change',async e=>{const file=e.target.files[0],mode=fileMode;if(file)try{await readFile(file,mode);}catch(error){notify(error instanceof SyntaxError?'That file is not readable JSON. Your current music is unchanged.':error.message,true);}});
  $('project-name').addEventListener('change',e=>{const value=e.target.value.trim();if(!value){e.target.value=p.song.name;return;}commit(()=>p.song.name=value,'Project renamed.',false);});
  $('bpm').addEventListener('change',e=>commit(()=>C.syncTempo(p,num(e.target.value,40,240,96)),'Tempo shared across the studio.'));
  $('master').addEventListener('input',e=>{audio.setVolume(+e.target.value/100);$('master-value').textContent=e.target.value+'%';try{localStorage.setItem(MASTER,e.target.value);}catch{}});
  $('loop').addEventListener('change',e=>audio.setLoop(e.target.checked));
  const changes={
    'voice-name':e=>commit(()=>{const name=e.value.trim();C.assert(name&&name.length<=48,'Give your voice a short name.');p.voiceBank.name=name;},'Voice bank renamed.'),
    'voice-root':e=>{const root=Math.round(num(e.value,24,96,60)),code=ui.phone;if(ui.voicePending[code])ui.voicePending[code].take.root=root;else commit(()=>p.voiceBank.takes[code].root=root,'Voice root note adjusted.');render();},
    shape:e=>{const side=e.dataset.side;if(e.value!=='custom')commit(()=>{const v=p.patch.project[side];v.points=C.S.source(e.value).points;v.shape=e.value;v.pins=[];},'New outline selected. Source level, phase, smoothness and pitch kept their settings.');},
    ratio:e=>commit(()=>p.patch.project[e.dataset.side].ratio=+e.value,'Pitch multiple updated.'),
    collision:e=>commit(()=>p.patch.project.mode=e.value,'Waves combined with '+e.options[e.selectedIndex].text+'.'),
    normalize:e=>commit(()=>p.patch.project.normalize=e.checked,'Waveform fill updated.'),invert:e=>commit(()=>p.patch.inverted=e.checked,'Output polarity updated.'),
    pitch:e=>commit(()=>{const pitch=num(e.value,20,20000,134),factor=pitch/p.patch.pitch;if(p.patch.freePair)for(const side of ['a','b'])p.patch.freePair[side]=C.clamp(p.patch.freePair[side]*factor,20,19000);p.patch.pitch=pitch;},'Sound pitch updated.'),
    'independent-pitches':e=>commit(()=>{p.patch.freePair=e.checked?{a:Math.min(p.patch.pitch*p.patch.project.a.ratio,19000),b:Math.min(p.patch.pitch*p.patch.project.b.ratio,19000)}:null;},'Wave pitches updated.'),
    'free-pitch':e=>commit(()=>p.patch.freePair[e.dataset.side]=num(e.value,20,19000,134),'Independent pitch updated.'),
    'add-effect':e=>{if(!e.value)return;commit(()=>{C.assert(p.patch.project.effects.length<6,'Use up to six effects.');p.patch.project.effects.push(C.FX.validate([{type:e.value}])[0]);},'Effect added.');},
    'fx-enabled':e=>commit(()=>p.patch.project.effects[+e.dataset.index].enabled=e.checked,'Effect switched.'),
    'shape-reach':e=>{ui.shaper.reach=+e.value;announce('Brush reach updated.');},
    'shape-strength':e=>{ui.shaper.strength=+e.value;},
    'shape-snap':e=>{ui.shaper.snap=+e.value;},
    'shape-fine':e=>{ui.shaper.fine=+e.value;},
    'shape-zoom':e=>{ui.shaper.zoom=+e.value;render();revealShapePoint();},
    'shape-overlay':e=>{ui.shaper.overlay=e.checked;paintWaves();},
    'shape-markers':e=>{ui.shaper.markers=e.checked;paintWaves();},
    'shape-dot':e=>chooseShapePoint(Math.round(num(e.value,1,32,1))-1),
    'shape-height':e=>setExactShapeHeight(e),
    'beat-bars':e=>commit(()=>{const next=+e.value;if(next<p.beat.pattern.bars){const end=C.D.stepsPerBar(p.beat.pattern.meter)*next;C.assert(p.beat.pattern.tracks.every(t=>t.steps.slice(end).every(n=>!n)),'Later measures contain hits. Clear them before shortening the beat.');}p.beat.pattern=C.D.resizePattern(p.beat.pattern,{bars:next});ui.beatBar=Math.min(ui.beatBar,next-1);},'Beat length updated.'),
    'drum-wave':e=>commit(()=>p.beat.pattern.tracks[ui.drum].waveId=e.value,'Drum sound updated.'),
    grid:e=>{ui.grid=+e.value;render();},'note-length':e=>{ui.length=+e.value;},
    'part-sound':e=>commit(()=>p.melody.tracks.find(t=>t.id===ui.part).instrument=e.value,'Part sound updated.'),
    'part-mute':e=>commit(()=>p.melody.tracks.find(t=>t.id===ui.part).mute=e.checked,'Part mute updated.'),
    root:e=>commit(()=>p.melody.root=+e.value,'Key guide updated. Your note pitches are unchanged.'),
    mode:e=>commit(()=>p.melody.mode=e.value,'Scale guide updated. Your note pitches are unchanged.'),
    'melody-bars':e=>commit(()=>{const bars=+e.value;C.assert(p.melody.tracks.every(t=>t.notes.every(n=>n.start+n.duration<=bars*4)),'There are notes in later measures. Move or remove them before shortening.');p.melody.bars=bars;},'Melody length updated.'),
    'follow-song':e=>{ui.follow=e.checked;},
    'song-bars':e=>commit(()=>{const bars=+e.value,end=bars*C.Song.beatsPerBar(p.song.meter);C.assert(arrangementRows().every(r=>r.clips.every(c=>c.start+c.duration<=end+1e-8)),'Later measures contain music. Move those clips before shortening the song.');C.Arrangement.sections(p.sections,bars);p.song.bars=bars;p.song.loop={start:0,end:bars};ui.cursor=Math.min(ui.cursor,end-1);},'Song length updated.'),
    'clip-name':e=>commit(()=>{const c=C.findClip(p,ui.clip);C.assert(c,'Choose a clip.');if(ui.clip.type==='beat'){const source=p.song.beats.find(b=>b.id===c.beatId),copy={...C.clone(source),id:C.id('beat'),name:e.value.trim()||'Little beat'};C.assert(p.song.beats.length<16,'This song has sixteen beat variations.');p.song.beats.push(copy);c.beatId=copy.id;}else c.name=e.value.trim()||'Little idea';},'Clip renamed.'),
    'clip-start':e=>commit(()=>setClipStart(num(e.value,0,316)),'Placement moved.'),
    'clip-repeats':e=>commit(()=>{const c=C.findClip(p,ui.clip);c.repeats=Math.round(num(e.value,1,64,1));C.extend(p,c.start+c.duration*c.repeats);},'Clip repeats updated.'),
    'clip-mute':e=>commit(()=>C.findClip(p,ui.clip).mute=e.checked,'Clip mute updated.'),
    'export-scope':e=>{ui.exportScope=e.value;lastExportAudio=null;render();},'export-rate':e=>{ui.exportRate=+e.value;lastExportAudio=null;}
  };
  document.addEventListener('change',event=>{const el=event.target;if(!el.dataset.change)return;try{changes[el.dataset.change]?.(el);}catch(error){notify(error.message,true);}});
  function setClipStart(start){const c=C.findClip(p,ui.clip);C.assert(c,'Choose a clip first.');if(ui.clip.type==='notes'){const min=Math.min(...c.notes.map(n=>n.start)),delta=start-min;C.extend(p,Math.max(...c.notes.map(n=>n.start+n.duration))+delta);c.notes.forEach(n=>n.start+=delta);}else{C.extend(p,start+C.clipLength(p,ui.clip));c.start=start;}}
  function applyRange(key,value) {
    if(key==='shape-peak'||key==='shape-trough'){const side=ui.shaper.side,original=rangeBefore?.project.patch.project[side].points||p.patch.project[side].points;setShapePoints(side,C.Shape.levels(original,{[key==='shape-peak'?'peak':'trough']:value/100}));}
    else if(key.startsWith('fx-')){const [,index,parameter]=key.split('-');p.patch.project.effects[+index][parameter]=value/fxFactor(parameter);}
    else if(key==='blend')p.patch.project.amount=value/100;
    else if(key.startsWith('wave-')){const [,side,control]=key.split('-');p.patch.project[side][control]=['level','smoothness'].includes(control)?value/100:value;}
    else if(key==='drive'){p.patch.project.amp.enabled=value>0;p.patch.project.amp.drive=1+value/100*11;}
    else if(key==='swing')p.beat.pattern.swing=value/100;
    else if(key.startsWith('drum-')){const control=key.slice(5);p.beat.pattern.tracks[ui.drum][control]=control==='decay'?value/1000:['noise','level'].includes(control)?value/100:value;}
    else if(key==='part-room')p.melody.tracks.find(t=>t.id===ui.part).room=value/100;
    else if(key.startsWith('track-')){const at=key.lastIndexOf('-'),id=key.slice(6,at),control=key.slice(at+1),track=p.song.tracks.find(t=>t.id===id);C.assert(track&&['volume','pan','room'].includes(control),'Choose an existing mixer part.');track[control]=value/100;}
    else if(key==='part-level')p.melody.tracks.find(t=>t.id===ui.part).volume=value/100;
    else if(key.startsWith('clip-')){const c=C.findClip(p,ui.clip);C.assert(c,'Choose a clip first.');c[key.slice(5)]=key==='clip-pitch'?value:value/100;}
  }
  let rangeBefore=null,rangeElement=null;
  document.addEventListener('input',event=>{
    const el=event.target;
    if(el.id==='voice-phrase'){ui.phrase=el.value;return;}
    if(el.id==='sound-name'){ui.soundName=el.value;return;}
    if(el.id==='pattern-name'){ui.patternNames[ui.part]=el.value;return;}
    if(el.dataset.eq!==undefined){audio.setEQ(+el.dataset.eq,+el.value);el.nextElementSibling.textContent=el.value+' dB';return;}
    const key=el.dataset.range;if(!key)return;
    if(!rangeBefore){rangeBefore=checkpoint();rangeElement=el;}
    try{applyRange(key,+el.value);const output=el.previousElementSibling;output.textContent=el.value+(el.dataset.suffix||'');audio.refresh(p);if(ui.step==='sound')paintWaves();}catch(e){notify(e.message,true);}
  });
  document.addEventListener('change',event=>{if(event.target===rangeElement&&rangeBefore){undo.push(rangeBefore);trimHistory();redo=[];rangeBefore=null;rangeElement=null;changed('Sound and mix updated.',false);}});
  document.addEventListener('dragstart',event=>{const tile=event.target.closest('[draggable]');if(!tile)return;ui.pattern=tile.dataset.id;event.dataTransfer.setData('application/x-dot-wave-pattern',tile.dataset.id);event.dataTransfer.effectAllowed='copy';});
  document.addEventListener('dragover',event=>{if(event.target.closest('.track-lane,.timeline-empty')){event.preventDefault();event.dataTransfer.dropEffect='copy';}});
  document.addEventListener('drop',event=>{const lane=event.target.closest('.track-lane'),timeline=$('timeline');if(!timeline)return;const id=event.dataTransfer.getData('application/x-dot-wave-pattern');if(!id)return;event.preventDefault();const rect=timeline.getBoundingClientRect(),beatWidth=+timeline.dataset.beatWidth,at=Math.max(0,Math.floor((event.clientX-rect.left-130)/beatWidth));commit(()=>placePattern(id,at,lane?.dataset.lane),'Pattern placed, with its own editable notes.');});
  // Each drag is a single history entry. The clock keeps running while the worker prepares edits.
  document.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    const wave=event.target.closest('canvas[data-wave]');
    if(wave){
      event.preventDefault();const side=wave.dataset.wave,point=wavePoint(wave,event),tool=ui.shaper.tool;ui.shaper.side=side;ui.shaper.cursor[side]=point.index;wave.focus({preventScroll:true});
      if(tool==='select'){gesture={kind:'wave-select',side,element:wave,from:point.slot,previous:[...ui.shaper.selection[side]],add:event.shiftKey};ui.shaper.selection[side]=[point.index];wave.setPointerCapture(event.pointerId);paintWaves();return;}
      const selection=ui.shaper.selection[side];
      if(tool==='grab'){
        if(event.ctrlKey||event.metaKey){ui.shaper.selection[side]=C.Shape.toggleSelection(selection,point.index);paintWaves();return;}
        if(!selection.includes(point.index))ui.shaper.selection[side]=[point.index];
      }else if(tool!=='draw')ui.shaper.selection[side]=[point.index];
      else ui.shaper.selection[side]=[point.index];
      gesture={kind:'wave',side,before:checkpoint(),element:wave,previous:null,tool,index:point.index,selection:[...ui.shaper.selection[side]],base:[...p.patch.project[side].points],raw:[...p.patch.project[side].points],startValue:point.value,changed:false};wave.setPointerCapture(event.pointerId);drawWaveAt(event);return;
    }
    const note=event.target.closest('[data-note]'),row=event.target.closest('.piano-row');
    if(note){event.preventDefault();const key=note.dataset.note;if(event.shiftKey||event.ctrlKey||event.metaKey){ui.selected=ui.selected.includes(key)?ui.selected.filter(k=>k!==key):[...ui.selected,key];render();return;}
      if(ui.noteMode==='erase'){ui.selected=[key];deleteNotes();return;}
      if(!ui.selected.includes(key))ui.selected=[key];const paper=$('piano-paper'),t=p.melody.tracks.find(t=>t.id===ui.part),keys=[...ui.selected];
      gesture={kind:event.target.closest('.note-grip')?'resize-notes':'move-notes',element:paper,before:checkpoint(),keys,startX:event.clientX,startY:event.clientY,beatWidth:+paper.dataset.beatWidth,track:structuredClone(t),moved:false};paper.setPointerCapture(event.pointerId);
      document.querySelectorAll('[data-note]').forEach(el=>el.classList.toggle('selected',ui.selected.includes(el.dataset.note)));return;
    }
    if(row){event.preventDefault();const paper=$('piano-paper'),rect=paper.getBoundingClientRect(),x=event.clientX-rect.left-49,y=event.clientY-rect.top,beatWidth=+paper.dataset.beatWidth;
      if(ui.noteMode==='select'){gesture={kind:'box',element:paper,startX:x+49,startY:y,currentX:x+49,currentY:y,add:event.shiftKey,previous:[...ui.selected]};paper.setPointerCapture(event.pointerId);const box=document.createElement('div');box.className='selection-box';box.id='selection-box';paper.append(box);return;}
      if(x<0){audio.preview(p,+row.dataset.midi,p.melody.tracks.find(t=>t.id===ui.part).instrument,.6,p.melody.tracks.find(t=>t.id===ui.part).room).catch(e=>notify(e.message,true));return;}
      const start=C.clamp(Math.floor(x/beatWidth/ui.grid)*ui.grid,0,p.melody.bars*4-ui.grid),midi=+row.dataset.midi;ui.noteCursor=start;
      const t=p.melody.tracks.find(t=>t.id===ui.part),key=start+':'+midi;if(ui.noteMode==='erase'){ui.selected=[key];deleteNotes();return;}
      commit(()=>{C.assert(!t.notes.some(n=>C.noteKey(n)===key),'There is already a note here.');C.assert(p.melody.tracks.reduce((s,t)=>s+t.notes.length,0)<2048,'Keep up to 2,048 melody notes.');t.notes.push({start,midi,duration:Math.min(ui.length,p.melody.bars*4-start),velocity:ui.velocity});ui.selected=[key];},'Note painted.');audio.preview(p,midi,t.instrument,.6,t.room).catch(e=>notify(e.message,true));return;
    }
    const clip=event.target.closest('[data-clip]');
    if(clip){event.preventDefault();ui.clip=JSON.parse(clip.dataset.clip);const timeline=$('timeline');gesture={kind:event.target.closest('.clip-grip')?'resize-clip':'move-clip',element:timeline,before:checkpoint(),startX:event.clientX,beatWidth:+timeline.dataset.beatWidth,moved:false,clip:structuredClone(C.findClip(p,ui.clip))};timeline.setPointerCapture(event.pointerId);document.querySelectorAll('[data-clip]').forEach(el=>el.classList.toggle('selected',sameSelection(JSON.parse(el.dataset.clip),ui.clip)));return;}
    const lane=event.target.closest('.track-lane');if(lane){const rect=lane.getBoundingClientRect(),beatWidth=+$('timeline').dataset.beatWidth;ui.cursor=C.clamp(Math.floor((event.clientX-rect.left)/beatWidth),0,p.song.bars*C.Song.beatsPerBar(p.song.meter)-1);ui.clip=null;render();}
  });
  function wavePoint(element,event){const rect=element.getBoundingClientRect(),slot=Math.round(C.clamp((event.clientX-rect.left)/rect.width,0,1)*32);return {index:slot%32,slot,value:C.Shape.snap((rect.height/2-(event.clientY-rect.top))/(rect.height*.36),ui.shaper.snap)};}
  function drawWaveAt(event){
    const g=gesture,point=wavePoint(g.element,event),voice=p.patch.project[g.side],pins=voice.pins||[];
    if(g.tool==='draw')g.raw=C.Shape.drawClosed(g.raw,g.previous||point,point);
    else if(g.tool==='grab')g.raw=C.Shape.move(g.base,g.selection,(point.value-g.startValue)*(event.shiftKey?.1:1),ui.shaper.reach,pins);
    else if(g.tool==='peak'||g.tool==='trough'){g.raw=C.Shape.bump(g.base,point.index,g.tool==='peak'?Math.max(0,point.value):Math.min(0,point.value),ui.shaper.reach);ui.shaper.selection[g.side]=[point.index];}
    else if(g.tool==='edge'){g.raw=C.Shape.edge(g.base,point.index,ui.shaper.reach);ui.shaper.selection[g.side]=[point.index];}
    const next=C.Shape.protect(g.base,g.raw,pins,ui.shaper.strength);
    if(ui.shaper.snap&&g.tool!=='grab')for(let i=0;i<32;i++)if(!pins.includes(i)&&Math.abs(g.raw[i]-g.base[i])>1e-10)next[i]=C.Shape.snap(next[i],ui.shaper.snap);
    voice.points=next;g.changed=next.some((v,i)=>v!==g.base[i]);if(g.changed)voice.shape='custom';
    ui.shaper.cursor[g.side]=g.tool==='grab'?g.index:point.index;g.previous=point;paintWaves();
  }
  document.addEventListener('pointermove',event=>{
    const g=gesture;if(!g)return;
    if(g.kind==='wave'){drawWaveAt(event);return;}
    if(g.kind==='wave-select'){const point=wavePoint(g.element,event),arc=C.Shape.displayArc(g.from,point.slot);ui.shaper.selection[g.side]=g.add?[...new Set([...g.previous,...arc])]:arc;ui.shaper.cursor[g.side]=point.index;paintWaves();return;}
    if(g.kind==='box'){const rect=g.element.getBoundingClientRect();g.currentX=event.clientX-rect.left;g.currentY=event.clientY-rect.top;const box=$('selection-box');Object.assign(box.style,{left:Math.min(g.startX,g.currentX)+'px',top:Math.min(g.startY,g.currentY)+'px',width:Math.abs(g.startX-g.currentX)+'px',height:Math.abs(g.startY-g.currentY)+'px'});return;}
    const dx=event.clientX-g.startX,dy=event.clientY-g.startY;if(Math.abs(dx)+Math.abs(dy||0)>4)g.moved=true;if(!g.moved)return;
    try{
      if(g.kind.endsWith('notes')){
        const track=p.melody.tracks.find(t=>t.id===ui.part);track.notes=structuredClone(g.track.notes);const dt=Math.round(dx/g.beatWidth/ui.grid)*ui.grid,dp=g.kind==='move-notes'?-Math.round(dy/21):0;
        ui.selected=C.transformNotes(track,g.keys,g.kind==='move-notes'?dt:0,dp,g.kind==='resize-notes'?dt:0,p.melody.bars*4);
        const paper=g.element;for(const el of paper.querySelectorAll('[data-note]')){const old=g.track.notes.find(n=>C.noteKey(n)===el.dataset.note);if(!old||!g.keys.includes(el.dataset.note))continue;const n={...old,start:old.start+(g.kind==='move-notes'?dt:0),midi:old.midi+dp,duration:old.duration+(g.kind==='resize-notes'?dt:0)};el.style.left=n.start*g.beatWidth+'px';el.style.width=Math.max(7,n.duration*g.beatWidth)+'px';el.style.transform=`translateY(${-dp*21}px)`;}
      }else{
        const c=C.findClip(p,ui.clip),delta=Math.round(dx/g.beatWidth);Object.assign(c,structuredClone(g.clip));
        if(g.kind==='resize-clip'){if(ui.clip.type==='phrase'){c.repeats=Math.max(1,Math.round((g.clip.duration*g.clip.repeats+delta)/g.clip.duration));C.assert(c.start+c.duration*c.repeats<=p.song.bars*C.Song.beatsPerBar(p.song.meter),'Resize within the song, or add measures first.');}else{c.duration=Math.max(.25,g.clip.duration+delta);C.assert(c.start+c.duration<=p.song.bars*C.Song.beatsPerBar(p.song.meter),'Resize within the song, or add measures first.');}}
        else{const start=ui.clip.type==='notes'?Math.min(...g.clip.notes.map(n=>n.start)):g.clip.start;C.assert(start+delta>=0,'Keep the clip inside the song.');const length=C.clipLength(p,ui.clip);C.assert(start+delta+length<=p.song.bars*C.Song.beatsPerBar(p.song.meter),'Move within the song, or add measures first.');if(ui.clip.type==='notes')c.notes=g.clip.notes.map(n=>({...n,start:n.start+delta}));else c.start=start+delta;}
        const el=[...document.querySelectorAll('[data-clip]')].find(el=>sameSelection(JSON.parse(el.dataset.clip),ui.clip));const start=ui.clip.type==='notes'?Math.min(...c.notes.map(n=>n.start)):c.start;if(el){el.style.left=start*g.beatWidth+'px';el.style.width=Math.max(12,C.clipLength(p,ui.clip)*g.beatWidth)+'px';}
      }
      g.valid=true;
    }catch{g.valid=false;}
  });
  function finishGesture(cancel=false){const g=gesture;if(!g)return;gesture=null;
    if(g.kind==='wave-select'){if(cancel)ui.shaper.selection[g.side]=g.previous;paintWaves();announce(`Wave ${g.side.toUpperCase()} · ${ui.shaper.selection[g.side].length} dots selected.`);return;}
    if(g.kind==='box'){
      const rect=g.element.getBoundingClientRect(),x1=Math.min(g.startX,g.currentX),x2=Math.max(g.startX,g.currentX),y1=Math.min(g.startY,g.currentY),y2=Math.max(g.startY,g.currentY);const selected=[...g.element.querySelectorAll('[data-note]')].filter(el=>{const r=el.getBoundingClientRect();return r.right-rect.left>=x1&&r.left-rect.left<=x2&&r.bottom-rect.top>=y1&&r.top-rect.top<=y2;}).map(el=>el.dataset.note);ui.selected=g.add?[...new Set([...g.previous,...selected])]:selected;render();return;
    }
    if(cancel||((g.moved||g.kind==='wave')&&g.valid===false)){p=g.before.project;ui.clip=g.before.clip;if(g.keys)ui.selected=g.keys;render();if(!cancel)notify('That edit would leave the available space or collide with another note.',true);return;}
    if(g.kind==='wave'&&!g.changed){paintWaves();return;}
    if(g.kind==='wave'||g.moved){undo.push(g.before);trimHistory();redo=[];changed('Edit kept. One Undo brings it back.');}else render();
  }
  document.addEventListener('pointerup',()=>finishGesture());document.addEventListener('pointercancel',()=>finishGesture(true));
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented)return;
    if(!['ArrowUp','ArrowDown'].includes(event.key))resetWaveNudge();
    const editing=event.target.closest('input,textarea,select,[contenteditable]');const mod=event.ctrlKey||event.metaKey;
    if(event.key==='Escape'){capture.cancel();woof.stop();audio.stop();cancelVoiceCapture();cancelRecording();finishGesture(true);return;}
    if(mod&&event.key.toLowerCase()==='s'){event.preventDefault();saveProject();return;}
    if(mod&&event.key.toLowerCase()==='o'){event.preventDefault();chooseFile('project');return;}
    if(event.key==='Enter'&&event.target.matches('[data-change="shape-height"]')){event.preventDefault();changes['shape-height'](event.target);return;}
    if(editing||$('modal').open)return;
    if(mod&&event.key.toLowerCase()==='z'){event.preventDefault();history(event.shiftKey?'redo':'undo');return;}
    if(mod&&event.key.toLowerCase()==='y'){event.preventDefault();history('redo');return;}
    if(shapeKeyboard(event)){event.preventDefault();return;}
    if(event.code==='Space'&&event.target.closest('.mini-play'))return;
    if(event.code==='Space'){event.preventDefault();togglePlay().catch(e=>notify(e.message,true));return;}
    if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();if(ui.step==='melody')deleteNotes();else if(ui.step==='arrange'&&ui.clip)deleteClip();return;}
    if(mod&&event.key.toLowerCase()==='d'){event.preventDefault();if(ui.step==='melody')duplicateNotes();else if(ui.step==='arrange')duplicateClip();return;}
    if(ui.step==='melody'&&ui.selected.length&&event.key.startsWith('Arrow')){event.preventDefault();if(event.key==='ArrowLeft'||event.key==='ArrowRight'){const delta=event.key==='ArrowLeft'?-ui.grid:ui.grid;moveNotes(event.shiftKey?0:delta,0,event.shiftKey?delta:0);}else moveNotes(0,event.key==='ArrowUp'?1:-1,0);}
  });
  document.addEventListener('keyup',resetWaveNudge);document.addEventListener('pointerdown',resetWaveNudge,true);window.addEventListener('blur',resetWaveNudge);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){woof.stop();audio.stop();cancelRecording();}});
  window.addEventListener('beforeunload',event=>{if(revision&&savedVersion!==revision){event.preventDefault();event.returnValue='';}});
  window.addEventListener('pagehide',()=>{woof.stop();audio.stop();cancelRecording();});
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(ui.step==='sound')paintWaves();if(ui.step==='export'&&lastExportAudio)paintExport(lastExportAudio);if(ui.step==='arrange')fitTimeline();capture.paint();},150);});
  window.addEventListener('hashchange',()=>{const step=location.hash.slice(1);if(steps.includes(step))setStep(step);});
  document.addEventListener('toggle',event=>{const key=event.target.dataset?.shapeDetails;if(key)ui.shaper[key]=event.target.open;},true);
  let lastStep=-1,lastMiniPaint=0;
  function tick(now=0){
    if((audio.mini||audio.miniPending)&&now-lastMiniPaint>80){renderMiniPlayers();lastMiniPaint=now;}
    const seconds=audio.position(),beat=seconds*p.song.bpm/60+(audio.scope==='section'&&(audio.playing||audio.positionWhenStopped)?audio.startBeat:0),bar=C.Song.beatsPerBar(p.song.meter);$('clock').innerHTML=`${String(Math.floor(beat/bar)+1).padStart(2,'0')}<span> : </span>${Math.floor(beat%bar)+1}<span> : </span>${String(Math.floor(beat%1*100)).padStart(2,'0')}`;
    if(ui.step==='beat'){const step=Math.floor(beat*4)%C.D.stepsPerBar(p.beat.pattern.meter);if(step!==lastStep||!audio.playing){lastStep=step;document.querySelectorAll('[data-local-step]').forEach(el=>el.classList.toggle('playhead',audio.playing&&audio.scope==='beat'&&+el.dataset.localStep===step));}}
    if(ui.step==='melody'&&$('melody-playhead')){const line=$('melody-playhead');line.hidden=!(audio.playing&&audio.scope==='melody');line.style.left=49+beat*(43*ui.zoom)+'px';}
    if(ui.step==='arrange'&&$('song-cursor')){const bw=+$('timeline').dataset.beatWidth,active=audio.playing&&['song','section'].includes(audio.scope),x=130+(active?beat:ui.cursor)*bw;$('song-cursor').style.left=x+'px';if(active&&ui.follow&&!ui.songFit){const scroll=$('timeline-scroll');if(x>scroll.scrollLeft+scroll.clientWidth-30||x<scroll.scrollLeft+130)scroll.scrollLeft=Math.max(0,x-150);}}
    requestAnimationFrame(tick);
  }
  try{const library=localStorage.getItem(LIBRARY);if(library)p.library=C.W.prepareImport(p.library,C.W.validateBundle(JSON.parse(library)),()=>C.id('sound')).waves;}catch{announce('Your saved sound box could not be opened. Import a library backup to restore it.');}
  try{const recovery=localStorage.getItem(STORE);if(recovery)ui.recover=recovery;}catch{}
  setStep(steps.includes(location.hash.slice(1))?location.hash.slice(1):'sound');requestAnimationFrame(tick);
  const initialRevision=revision;
  Promise.all([StudioStore.get('draft'),StudioStore.get('voiceBank')]).then(([draft,bank])=>{if(revision!==initialRevision||ui.recovered)return;if(draft)ui.recover=draft;if(bank)p.voiceBank=C.Voice.validate(bank);render();}).catch(()=>{});
  window.addEventListener('pagehide',()=>{cancelVoiceCapture();cancelRecording();});
  // Read-only snapshot helpers for a review or a future studio integration.
  window.DotWaveStudio=Object.freeze({version:'2.8.0',snapshot:()=>C.serialize(p),get state(){return {step:ui.step,playing:audio.playing,pending:audio.pending,scope:audio.scope,revision,selected:[...ui.selected]};}});
})();
