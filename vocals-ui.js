(function(root){
  'use strict';
  root.VocalsPanel=function(api){
    const {C,audio,ui}=api,V=C.Vocal;
    const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const state={lines:{},page:0,details:false},project=()=>api.getProject(),track=()=>project().melody.tracks.find(t=>t.id===ui.part);
    const isVocal=id=>V.catalog().some(v=>v.id===id),name=id=>V.catalog().find(v=>v.id===id)?.name||id;
    const chosen=t=>t.notes.filter(n=>!ui.selected.length||ui.selected.includes(C.noteKey(n)));
    function view(){
      const count=Object.keys(project().voiceBank.takes).length;
      return `<section class="panel vocals-room"><div class="panel-head"><h2>A VOICE FOR YOUR NOTES</h2><span class="chip">Sing offline</span></div><p class="vocal-intro">Write words onto notes. Hold the vowels, shape the color, and give the phrase a little life. The built-in voices have a synthetic character.</p><div class="vocal-cards">${V.catalog().map((voice,i)=>`<article class="vocal-card"><div class="vocal-glyph" aria-hidden="true">${['aah','ee','ooh','you'][i]}</div><h3>${esc(voice.name)}</h3><p>${esc(voice.description)}${i===3?' '+count+' / 39 sounds recorded.':''}</p><div class="vocal-card-actions"><button class="mini-play" data-action="preview-instrument" data-id="instrument-${voice.id}" data-instrument="${voice.id}" data-name="${esc(voice.name)}" aria-label="Play ${esc(voice.name)} for 3 seconds" aria-pressed="false"><span class="mini-icon">▶</span><span class="mini-time">3s</span><span class="mini-pitch">ah · C4</span></button><button class="secondary" data-vocal-action="use" data-instrument="${voice.id}">Write vocals →</button></div></article>`).join('')}</div><div class="vocal-room-foot"><p>Your voice kit uses kept speech sounds. Missing sounds use the built-in voice. Record a steady vowel for held notes; sampled voices change character as their pitch moves.</p><button data-action="sound-mode" data-mode="voice">Capture your vowels & consonants →</button></div></section>`;
    }
    function melody(t){
      if(!isVocal(t.instrument))return `<div class="vocal-invite"><span>Words can be music, too.</span><button data-vocal-action="use" data-instrument="vocal-soft">＋ Give this part a voice</button></div>`;
      const notes=chosen(t).sort((a,b)=>a.start-b.start||a.midi-b.midi),pageSize=12,pages=Math.max(1,Math.ceil(notes.length/pageSize));state.page=Math.min(state.page,pages-1);
      const shown=notes.slice(state.page*pageSize,(state.page+1)*pageSize),style=notes[0]?.vocal||V.note({lyric:'ah',phones:['AA']}),focus=ui.selected.length?'selected notes':'this part';
      return `<section class="panel vocal-workshop"><div class="panel-head"><h2>GIVE IT WORDS</h2><span class="chip">${esc(name(t.instrument))}</span></div><div class="vocal-writing"><label class="field">Lyric line<input id="vocal-line" data-vocal-input="line" maxlength="1024" value="${esc(state.lines[ui.part]||'')}" placeholder="dream _ drift slow" aria-label="Vocal lyric line"></label><div class="control-row"><button class="primary" data-vocal-action="apply">Put words on ${ui.selected.length?'selected':'part'} notes</button><button data-vocal-action="demo" ${t.notes.length?'disabled':''}>Try a vocal phrase</button><button data-vocal-action="clear" ${notes.some(n=>n.vocal)?'':'disabled'}>Clear words from ${ui.selected.length?'selection':'part'}</button></div><p class="subtle">One word per note, from left to right. Hyphens separate syllables. Use _ to carry the last vowel to another note. For an unusual word, write speech codes such as [M UW N]. Notes without words sing “ah”.</p><div class="vocal-expression"><span>SHAPE ${ui.selected.length?'SELECTED NOTES':'THIS PART'}</span>${[['vibrato','Vibrato',0,100,Math.round(style.vibrato*100),'%'],['breath','Breath',0,100,Math.round(style.breath*100),'%'],['formant','Voice color',-12,12,style.formant,' st']].map(([key,label,min,max,value,suffix])=>`<label>${label}<input type="range" data-vocal-change="style" data-key="${key}" min="${min}" max="${max}" step="1" value="${value}" aria-label="Singing ${label.toLowerCase()} for ${focus}"><output>${value}${suffix}</output></label>`).join('')}</div>${t.instrument==='vocal-recorded'?'<p class="tiny">Your recorded pieces keep their own breath and color. These controls shape any built-in sounds filling the gaps.</p>':''}<details class="vocal-note-details" ${state.details?'open':''}><summary>Note lyrics & pronunciation <span>${notes.length} ${ui.selected.length?'selected':'notes'}</span></summary>${shown.length?`<div class="vocal-notes-table"><div class="vocal-note-head"><span>Note / beat</span><span>Word</span><span>Speech sounds</span><span>Listen</span></div>${shown.map(n=>`<div class="vocal-note-row"><span>${C.Song.noteName(n.midi)} <small>· ${Number((n.start+1).toFixed(3))}</small></span><input data-vocal-change="lyric" data-note-key="${C.noteKey(n)}" value="${esc(n.vocal?.lyric||'')}" maxlength="64" placeholder="ah" aria-label="Lyric for ${C.Song.noteName(n.midi)} at beat ${n.start+1}"><input data-vocal-change="phones" data-note-key="${C.noteKey(n)}" value="${esc((n.vocal?.phones||['AA']).join(' '))}" maxlength="120" spellcheck="false" aria-label="Pronunciation for ${C.Song.noteName(n.midi)} at beat ${n.start+1}"><button data-vocal-action="hear" data-note-key="${C.noteKey(n)}" aria-label="Hear sung ${esc(n.vocal?.lyric||'ah')} at beat ${n.start+1}">▶</button></div>`).join('')}</div><div class="vocal-pagination"><button data-vocal-action="page" data-delta="-1" ${state.page?'':'disabled'}>← Earlier</button><span>${state.page+1} / ${pages}</span><button data-vocal-action="page" data-delta="1" ${state.page<pages-1?'':'disabled'}>Later →</button></div>`:'<p class="subtle">Paint notes below, or try the phrase to start. Your lyrics will stay attached when you move or duplicate a note.</p>'}</details></div></section>`;
    }
    function use(id){
      C.assert(isVocal(id),'Choose a singing voice.');api.commit(()=>track().instrument=id,'Singing voice assigned. Add words to your notes.');state.page=0;api.setStep('melody');
    }
    function demo(){
      const t=track();C.assert(!t.notes.length,'Use an empty part for the example phrase.');
      const notes=[60,64,67,69,67,64,62,60].map((midi,i)=>({start:i,duration:.9,midi,velocity:.65})),words='dream _ drift slow under _ silver skies';
      const mapped=V.assign(notes,null,words);api.commit(()=>{t.notes=mapped;project().melody.bars=Math.max(2,project().melody.bars);},'A small vocal phrase is ready. Play Melody to hear it.');state.lines[ui.part]=words;api.render();
    }
    const actions={
      use:b=>use(b.dataset.instrument),
      apply:()=>{const t=track(),line=document.getElementById('vocal-line').value,mapped=V.assign(t.notes,ui.selected,line);state.lines[ui.part]=line;api.commit(()=>t.notes=mapped,'Words attached to your notes. Move them, hold them, or keep a pattern.');},
      demo,
      clear:()=>{const t=track(),keys=new Set(chosen(t).map(C.noteKey));api.commit(()=>t.notes=t.notes.map(n=>{if(!keys.has(C.noteKey(n)))return n;const {vocal,...rest}=n;return rest;}),'Words cleared. These notes now sing ah.');},
      page:b=>{state.page+=+b.dataset.delta;api.render();},
      hear:b=>{const t=track(),n=t.notes.find(n=>C.noteKey(n)===b.dataset.noteKey);C.assert(n,'Choose a current note.');return audio.preview(project(),n.midi,t.instrument,n.velocity,t.room,n.vocal);}
    };
    document.addEventListener('click',event=>{const b=event.target.closest('[data-vocal-action]');if(!b)return;Promise.resolve().then(()=>actions[b.dataset.vocalAction]?.(b)).catch(error=>api.notify(error.message,true));});
    document.addEventListener('input',event=>{const el=event.target;if(el.dataset.vocalInput==='line')state.lines[ui.part]=el.value;if(el.dataset.vocalChange==='style')el.nextElementSibling.textContent=el.value+(el.dataset.key==='formant'?' st':'%');});
    document.addEventListener('change',event=>{
      const el=event.target,mode=el.dataset.vocalChange;if(!mode)return;
      try{
        const t=track();
        if(mode==='style'){
          const keys=new Set(chosen(t).map(C.noteKey));C.assert(keys.size,'Paint some notes to shape their voice.');
          const key=el.dataset.key,value=Number(el.value)/(key==='formant'?1:100);
          const notes=t.notes.map(n=>keys.has(C.noteKey(n))?{...n,vocal:V.note({...V.note(n.vocal||{lyric:'ah',phones:['AA']}),[key]:value})}:n);
          api.commit(()=>t.notes=notes,'Vocal expression updated.');
        }else{
          const n=t.notes.find(n=>C.noteKey(n)===el.dataset.noteKey);C.assert(n,'Choose a current note.');
          let next=V.note(n.vocal||{lyric:'ah',phones:['AA']});
          if(mode==='phones')next=V.note({...next,phones:V.phones(el.value)});
          else if(!el.value.trim()){api.commit(()=>{delete n.vocal;},'This note now sings ah.');return;}
          else if(el.value.trim()==='_')next=V.note({...next,lyric:'_'});
          else {const units=V.words(el.value);C.assert(units.length===1,'Keep one word or syllable on this note. Use the lyric line for several words.');next=V.note({...next,...units[0]});}
          api.commit(()=>n.vocal=next,'Sung note updated.');
        }
      }catch(error){api.render();api.notify(error.message,true);}
    });
    document.addEventListener('toggle',event=>{if(event.target.matches?.('.vocal-note-details'))state.details=event.target.open;},true);
    return {view,melody,isVocal,name,state};
  };
})(typeof globalThis!=='undefined'?globalThis:this);
