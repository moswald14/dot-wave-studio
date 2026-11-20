(function(root){
  'use strict';
  root.CapturePanel=function(api){
    const {C,audio,ui}=api,$=id=>document.getElementById(id);
    const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const state={take:null,analysis:null,busy:false,entry:null,notice:'Your microphone stays off until you press Record.',scale:'chromatic',grid:.25,measure:1,part:'melody'};
    let ticket=0;
    function message(text){state.notice=text;const el=$('capture-status');if(el)el.textContent=text;}
    function cancel(){
      ticket++;const entry=state.entry;state.entry=null;state.busy=false;
      if(entry){entry.cancelled=true;clearTimeout(entry.timeout);clearInterval(entry.timer);entry.stream?.getTracks().forEach(t=>t.stop());if(entry.recorder?.state==='recording')entry.recorder.stop();message('Microphone released. Your kept music is here.');}
    }
    async function accept(decoded,title){
      cancel();const own=++ticket;state.busy=true;message('Finding the notes and a repeating wave…');api.render();
      try{
        C.assert(decoded.samples.length<=decoded.rate*30,'Choose a WAV no longer than 30 seconds.');
        const analysis=await audio.analyseTake(decoded.samples,decoded.rate);if(own!==ticket)return;
        state.take={samples:decoded.samples,rate:decoded.rate,duration:decoded.samples.length/decoded.rate,title:String(title||'Little captured idea').replace(/\.[^.]+$/,'').slice(0,48)};state.analysis=analysis;
        message(analysis.cycle?'Take ready. Listen, then choose notes, a patch outline, or the original recording.':'Take ready. No clear single pitch was found. You can still keep the original recording.');
      }catch(error){if(own===ticket){message(error.message);api.notify(error.message,true);}}
      finally{if(own===ticket){state.busy=false;api.render();}}
    }
    function release(entry){clearTimeout(entry.timeout);clearInterval(entry.timer);entry.stream?.getTracks().forEach(t=>t.stop());}
    async function record(){
      C.assert(navigator.mediaDevices?.getUserMedia&&root.MediaRecorder,'Microphone capture needs HTTPS or localhost. Import a WAV on this connection.');
      api.prepare();cancel();const own=++ticket,entry={stream:null,recorder:null,chunks:[],cancelled:false};state.entry=entry;message('Waiting for microphone access…');api.render();
      try{
        const context=await audio.init();if(own!==ticket)return;
        entry.stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
        if(own!==ticket){release(entry);return;}
        const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type)),recorder=new MediaRecorder(entry.stream,mime?{mimeType:mime}:undefined);entry.recorder=recorder;
        recorder.ondataavailable=e=>{if(e.data.size)entry.chunks.push(e.data);};
        recorder.onstop=async()=>{
          release(entry);if(own!==ticket||entry.cancelled)return;state.entry=null;state.busy=true;message('Opening your take…');api.render();
          try{
            const buffer=await context.decodeAudioData(await new Blob(entry.chunks,{type:recorder.mimeType}).arrayBuffer());if(own!==ticket)return;
            const samples=new Float32Array(Math.min(buffer.length,Math.floor(buffer.sampleRate*30)));
            for(let c=0;c<buffer.numberOfChannels;c++){const channel=buffer.getChannelData(c);for(let i=0;i<samples.length;i++)samples[i]+=channel[i]/buffer.numberOfChannels;}
            await accept({samples,rate:buffer.sampleRate},'My captured voice');
          }catch(error){if(own===ticket){state.busy=false;message(error.message);api.render();api.notify(error.message,true);}}
        };
        recorder.onerror=()=>{if(own!==ticket)return;cancel();message('Recording stopped unexpectedly. Try again or import a WAV.');api.render();};
        recorder.start();const started=Date.now();message('Recording · 0 / 30 seconds');api.render();
        entry.timer=setInterval(()=>message('Recording · '+Math.min(30,Math.floor((Date.now()-started)/1000))+' / 30 seconds'),200);
        entry.timeout=setTimeout(finish,30000);
      }catch(error){release(entry);if(own!==ticket)return;state.entry=null;message(error.name==='NotAllowedError'?'Microphone access was denied. Allow it in your browser, or import a WAV.':error.name==='NotFoundError'?'No microphone was found. Connect one or import a WAV.':error.message);api.render();api.notify(state.notice,true);}
    }
    function finish(){if(state.entry?.recorder?.state==='recording'){state.entry.recorder.stop();message('Opening your take…');}else{cancel();api.render();}}
    function converted(){return state.analysis?C.Capture.notes(state.analysis,{bpm:api.getProject().melody.bpm,root:api.getProject().melody.root,scale:state.scale,quantize:state.grid}):[];}
    function view(){
      const busy=state.busy||!!state.entry,p=api.getProject(),notes=converted(),take=state.take;
      return `<section class="panel capture-room"><div class="panel-head"><h2>CATCH AN IDEA</h2><span class="chip">Microphone or WAV · 30s</span></div><div class="capture-intro"><p>Hum a tune, hold a vowel, or play one instrument note. Hear it, then choose what it becomes.</p><div class="control-row"><button class="primary" data-capture-action="record" ${busy?'disabled':''}>● Record a take</button><button data-capture-action="finish" ${state.entry?'':'disabled'}>■ Review take</button><button data-capture-action="import" ${busy?'disabled':''}>Open WAV</button>${busy?'<button class="quiet" data-capture-action="cancel">Cancel</button>':''}</div><p id="capture-status" class="capture-status" role="status">${esc(state.notice)}</p><p class="tiny">Hum one voice at a time, roughly C2–B5. Nothing is uploaded. Original audio, repeating waves and editable notes are different things.</p></div>${take?`<div class="capture-review"><div class="capture-take-heading"><label class="field">Take name<input data-capture-change="name" aria-label="Captured take name" value="${esc(take.title)}" maxlength="48"></label><button class="mini-play" data-capture-action="hear" data-id="captured-take" data-name="Captured take" aria-label="Play captured take for 3 seconds" aria-pressed="false"><span class="mini-icon">▶</span><span class="mini-time">3s</span><span class="mini-pitch">Original</span></button><span class="chip">${take.duration.toFixed(1)} s · ${state.analysis.cycle?Math.round(state.analysis.frequency)+' Hz':'no steady pitch'}</span></div><canvas id="capture-wave" aria-label="Captured recording waveform"></canvas><div class="capture-choices"><article><span class="caption">01 / SHAPE A PATCH</span><h3>Keep the character.</h3><p>Use a repeating cycle as 32 editable dots. Pitch, smoothness and the other voice keep their settings.</p><div class="control-row"><button data-capture-action="cycle" data-side="a" ${busy||!state.analysis.cycle?'disabled':''}>Cycle → wave A</button><button data-capture-action="cycle" data-side="b" ${busy||!state.analysis.cycle?'disabled':''}>Cycle → wave B</button></div></article><article><span class="caption">02 / HUM → MELODY</span><h3>Keep the tune.</h3><div class="capture-note-settings"><label>Part<select data-capture-change="part">${[['melody','Melody'],['chords','Chords'],['bass','Bass']].map(([id,name])=>`<option value="${id}" ${state.part===id?'selected':''}>${name}</option>`).join('')}</select></label><label>Start measure<input type="number" data-capture-change="measure" aria-label="Hum insertion measure" min="1" max="16" value="${state.measure}"></label><label>Tuning<select data-capture-change="scale">${[['chromatic','Nearest note'],['major','Major'],['minor','Minor'],['pentatonic','Pentatonic']].map(([id,name])=>`<option value="${id}" ${state.scale===id?'selected':''}>${name}</option>`).join('')}</select></label><label>Timing<select data-capture-change="grid">${[[0,'Keep my timing'],[.25,'1/16 notes'],[.5,'1/8 notes'],[1,'Quarter notes']].map(([id,name])=>`<option value="${id}" ${state.grid===id?'selected':''}>${name}</option>`).join('')}</select></label></div><p class="capture-note-list">${notes.length?notes.slice(0,16).map(n=>C.Song.noteName(n.midi)).join(' · ')+(notes.length>16?' …':''):'No clear notes yet.'}</p><button class="secondary" data-capture-action="notes" ${busy||!notes.length?'disabled':''}>Add ${notes.length} editable notes →</button><p class="tiny">Uses this part’s current sound and the Melody key (${C.Song.noteName(p.melody.root+60).replace(/\d/g,'')}). Existing notes stay in place.</p></article><article><span class="caption">03 / KEEP THE PERFORMANCE</span><h3>Keep the original.</h3><p>The full take stays an audio clip. It keeps your timing and voice, ready to move in Arrange.</p><button data-capture-action="audio" ${busy?'disabled':''}>Recording → song cursor</button><button class="quiet" data-capture-action="save">Save original WAV ↗</button></article></div><p class="capture-foot">This reviewed take stays here until replaced or the page closes. Keep a WAV or add it to the song to save the recording in a project.</p></div>`:''}</section>`;
    }
    function paint(){
      const canvas=$('capture-wave');if(!canvas||!state.take)return;const rect=canvas.getBoundingClientRect(),ratio=Math.min(root.devicePixelRatio||1,2),width=Math.max(1,rect.width),height=85;canvas.width=width*ratio;canvas.height=height*ratio;const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);ctx.strokeStyle='#405342';ctx.beginPath();ctx.moveTo(0,height/2);ctx.lineTo(width,height/2);ctx.stroke();ctx.strokeStyle='#b8f58b';const data=state.take.samples;for(let x=0;x<width;x++){let high=0,low=0;const from=Math.floor(x*data.length/width),to=Math.floor((x+1)*data.length/width);for(let i=from;i<to;i++){high=Math.max(high,data[i]);low=Math.min(low,data[i]);}ctx.beginPath();ctx.moveTo(x,height/2-high*height*.47);ctx.lineTo(x,height/2-low*height*.47);ctx.stroke();}
    }
    document.addEventListener('click',async event=>{
      const button=event.target.closest('[data-capture-action]');if(!button||button.disabled)return;
      try{switch(button.dataset.captureAction){
        case 'record':await record();break;
        case 'finish':finish();break;
        case 'import':api.chooseFile('capture');break;
        case 'cancel':cancel();message('Capture cancelled. Your music is here.');api.render();break;
        case 'hear':await audio.previewSound({id:'captured-take'},{scope:'capture-preview',project:state.take});break;
        case 'cycle':{C.assert(state.analysis,'Record or open a take first.');const side=button.dataset.side,patch=C.Capture.patch(C,api.getProject().patch,state.analysis,side);if(api.commit(()=>api.getProject().patch=patch,'Captured outline is ready to shape. Pitch and smoothness kept their settings.')){ui.shaper.side=side;ui.soundMode='wave';api.render();}break;}
        case 'notes':{const result=C.Capture.insert(C,api.getProject(),state.analysis,{part:state.part,startBeat:(state.measure-1)*4,scale:state.scale,quantize:state.grid});if(api.commit(()=>api.replaceProject(result.project),'Hum kept as '+result.inserted.length+' editable notes. Drag or stretch them; Undo restores the previous melody.')){ui.part=state.part;api.setStep('melody');ui.selected=result.inserted.map(C.noteKey);ui.noteBase=C.clamp(Math.floor(Math.min(...result.inserted.map(n=>n.midi))/12)*12,12,96);api.render();}break;}
        case 'audio':api.addAudio(state.take,state.take.title);break;
        case 'save':api.download(C.IO.encodeWav(state.take.samples,state.take.rate),'audio/wav','captured-take.wav');break;
      }}catch(error){api.notify(error.message,true);}
    });
    document.addEventListener('change',event=>{const el=event.target,key=el.dataset?.captureChange;if(!key)return;if(key==='name'){state.take.title=el.value.trim()||'Little captured idea';el.value=state.take.title;}else{state[key]=['grid','measure'].includes(key)?Math.max(0,+el.value):el.value;if(key==='measure')state.measure=C.clamp(Math.round(state.measure)||1,1,16);api.render();}});
    root.addEventListener('pagehide',cancel);
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.entry){cancel();api.render();}});
    return {state,view,paint,accept,cancel};
  };
})(typeof globalThis!=='undefined'?globalThis:this);
