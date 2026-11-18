'use strict';
class DotAudio {
  constructor(changed) {
    this.changed = changed; this.context = null; this.worker = null; this.jobs = new Map(); this.serial = 0;
    this.intent = 0; this.playing = false; this.pending = false; this.scope = 'song'; this.origin = 0;
    this.length = 0; this.sources = new Set(); this.loop = true; this.volume = .45; this.eqGains = Array(10).fill(0);
    this.positionWhenStopped = 0; this.refreshTimer = null; this.refreshRevision = 0; this.workerURL = null;
    this.bpm = 96;
    this.mini = null; this.miniPending = null; this.miniTicket = 0;
    this.audition={};this.startBeat=0;
  }
  async init() {
    if (!this.context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('This browser does not support studio audio. Try a current desktop browser.');
      this.context = new Audio({latencyHint: 'interactive'});
      this.master = this.context.createGain(); this.master.gain.value = this.volume;
      this.filters = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000].map((frequency, i) => {
        const filter = this.context.createBiquadFilter(); filter.type = i === 0 ? 'lowshelf' : i === 9 ? 'highshelf' : 'peaking';
        filter.frequency.value = frequency; filter.Q.value = 1; filter.gain.value = this.eqGains[i]; return filter;
      });
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -18; this.compressor.knee.value = 6; this.compressor.ratio.value = 16;
      this.compressor.attack.value = .003; this.compressor.release.value = .12;
      this.ceiling = this.context.createWaveShaper();
      this.ceiling.curve = Float32Array.from({length: 8193}, (_, i) => Math.max(-.25, Math.min(.25, i / 4096 - 1)));
      this.analyser = this.context.createAnalyser(); this.analyser.fftSize = 256;
      const graph = [this.master, ...this.filters, this.compressor, this.ceiling, this.analyser, this.context.destination];
      for (let i = 0; i < graph.length - 1; i++) graph[i].connect(graph[i + 1]);
    }
    await this.context.resume(); return this.context;
  }
  makeWorker() {
    if (this.worker) return;
    if (!window.Worker || !window.DOT_WORKER_SOURCE) return;
    try {
      this.workerURL = URL.createObjectURL(new Blob([window.DOT_WORKER_SOURCE], {type: 'text/javascript'}));
      this.worker = new Worker(this.workerURL);
      this.worker.onmessage = event => {
        const job = this.jobs.get(event.data.id); if (!job) return;
        this.jobs.delete(event.data.id); clearTimeout(job.timer);
        if (event.data.error) job.reject(new Error(event.data.error)); else job.resolve(event.data.audio);
      };
      this.worker.onerror = () => {
        for (const job of this.jobs.values()) { clearTimeout(job.timer); job.reject(new Error('The audio renderer stopped. Save your project and reload to continue.')); }
        this.jobs.clear(); this.worker?.terminate(); this.worker = null;
      };
    } catch { this.worker = null; }
  }
  render(project, scope, options = {}) {
    this.makeWorker();
    if (!this.worker) return new Promise((resolve, reject) => setTimeout(() => {
      try { resolve(DotWave.render(project, scope, options.rate || 44100, options)); } catch (e) { reject(e); }
    }, 15));
    return new Promise((resolve, reject) => {
      const id = ++this.serial;
      const timer = setTimeout(() => { this.jobs.delete(id); reject(new Error('Rendering is taking too long. Try a shorter arrangement.')); }, 90000);
      this.jobs.set(id, {resolve, reject, timer});
      this.worker.postMessage({id, project, scope, options});
    });
  }
  position() {
    if (!this.playing || !this.context) return this.positionWhenStopped;
    const elapsed = Math.max(0, this.context.currentTime - this.origin);
    return this.loop && this.length ? elapsed % this.length : Math.min(elapsed, this.length);
  }
  install(audio, offset, fade = false) {
    const context = this.context, source = context.createBufferSource(), gain = context.createGain();
    const buffer = context.createBuffer(2, audio.left.length, audio.rate);
    buffer.copyToChannel(audio.left, 0); buffer.copyToChannel(audio.right, 1);
    source.buffer = buffer; source.loop = this.loop; source.connect(gain); gain.connect(this.master);
    const start = context.currentTime + .035, old = this.current, advanced = offset + (fade && old ? .035 : 0);
    const safeOffset = this.loop ? advanced % audio.duration : Math.min(advanced, Math.max(0, audio.duration - .002));
    gain.gain.setValueAtTime(fade ? 0 : 1, start); if (fade) gain.gain.linearRampToValueAtTime(1, start + .035);
    if (old) { old.gain.gain.cancelScheduledValues(start); old.gain.gain.setValueAtTime(old.gain.gain.value, start); old.gain.gain.linearRampToValueAtTime(0, start + .035); try { old.source.stop(start + .04); } catch {} }
    const entry = {source, gain}; this.current = entry; this.sources.add(entry);
    source.onended = () => {
      source.disconnect(); gain.disconnect(); this.sources.delete(entry);
      if (this.current === entry && this.playing && !this.loop) { this.current = null; this.playing = false; this.positionWhenStopped = 0; this.changed(); }
    };
    this.length = audio.duration; this.origin = start - safeOffset; this.playing = true;
    source.start(start, safeOffset); return entry;
  }
  async play(project, scope, fromBeat = 0, audition = {}) {
    const startBeat=scope==='section'?DotWave.Arrangement.range(project,audition.sectionId).fromBeat:0;
    this.stop(); const ticket = this.intent; this.pending = true; this.scope = scope; this.changed();
    const revision=++this.refreshRevision;this.audition=structuredClone(audition);this.startBeat=startBeat;
    try {
      await this.init(); if (ticket !== this.intent) return;
      const audio = await this.render(project, scope,{audition:this.audition});
      if (ticket !== this.intent||revision!==this.refreshRevision) return;
      this.install(audio, fromBeat * 60 / project.song.bpm); this.bpm = project.song.bpm; this.positionWhenStopped = 0;
    } finally { if (ticket === this.intent&&revision===this.refreshRevision) { this.pending = false; this.changed(); } }
  }
  refresh(project) {
    if(this.scope==='voice-phrase')return;
    clearTimeout(this.refreshTimer); const revision = ++this.refreshRevision;
    if (!this.playing && !this.pending) return;
    const snapshot = structuredClone(project), ticket = this.intent, scope = this.scope;
    this.refreshTimer = setTimeout(async () => {
      try {
        const audio = await this.render(snapshot, scope,{audition:this.audition});
        if (ticket !== this.intent || revision !== this.refreshRevision || (!this.playing && !this.pending)) return;
        const seconds = this.position() * this.bpm / snapshot.song.bpm; await this.init(); if (ticket !== this.intent) return;
        if(scope==='section')this.startBeat=DotWave.Arrangement.range(snapshot,this.audition.sectionId).fromBeat;
        this.install(audio, seconds, true); this.bpm = snapshot.song.bpm; this.pending = false; this.changed();
      } catch (e) { if(ticket===this.intent&&revision===this.refreshRevision){this.pending=false;this.changed(e);} }
    }, 110);
  }
  stop() {
    this.intent++; this.refreshRevision++; clearTimeout(this.refreshTimer); this.playing = false; this.pending = false;
    this.stopMiniPreview();
    for (const entry of this.sources) { try { entry.source.stop(); } catch {} entry.source.disconnect(); entry.gain.disconnect(); }
    this.sources.clear(); this.current = null; this.positionWhenStopped = 0; this.changed();
  }
  pause() { const position = this.position(); this.stop(); this.positionWhenStopped = position; this.changed(); }
  stopMiniPreview() {
    this.miniTicket++; this.miniPending=null;
    const current=this.mini;this.mini=null;
    if(current){try{current.entry.source.stop();}catch{}current.entry.source.disconnect();current.entry.gain.disconnect();this.sources.delete(current.entry);}
    this.changed();
  }
  miniRemaining() { return this.mini&&this.context?Math.max(0,Math.min(3,this.mini.end-this.context.currentTime)):0; }
  async previewSound(wave,patchRequest=null) {
    if(this.mini?.id===wave.id||this.miniPending===wave.id){this.stopMiniPreview();return;}
    this.stopMiniPreview();const ticket=++this.miniTicket;
    this.miniPending=wave.id;this.changed();
    try{
      await this.init();if(ticket!==this.miniTicket)return;
      const rendered=await this.render(patchRequest?structuredClone(patchRequest.project||patchRequest):{wave:structuredClone(wave)},patchRequest?(patchRequest.scope||'patch-preview'):'preview',{rate:this.context.sampleRate});
      if(ticket!==this.miniTicket)return;
      const source=this.context.createBufferSource(),gain=this.context.createGain();
      const buffer=this.context.createBuffer(2,rendered.left.length,rendered.rate);buffer.copyToChannel(rendered.left,0);buffer.copyToChannel(rendered.right,1);
      source.buffer=buffer;source.loop=false;gain.gain.value=1;source.connect(gain);gain.connect(this.master);
      const entry={source,gain},start=this.context.currentTime+.01;this.sources.add(entry);
      this.mini={id:wave.id,ticket,entry,start,end:start+3};this.miniPending=null;
      source.onended=()=>{source.disconnect();gain.disconnect();this.sources.delete(entry);if(this.mini?.ticket===ticket){this.mini=null;this.changed();}};
      source.start(start);source.stop(start+3);this.changed();
    }catch(error){if(ticket===this.miniTicket){this.miniPending=null;this.changed();throw error;}}
  }
  async preview(project, midi, instrument = 'piano', velocity = .6,room=0) {
    const ticket = this.intent; await this.init(); if (ticket !== this.intent) return;
    const waveId = instrument === 'drums' ? DotWave.Song.drumVoice(midi).waveId : instrument;
    const signal = DotWave.signals(project.library,project.voiceBank)[waveId];
    const samples = DotWave.Song.renderNote(instrument, signal, {start: 0, duration: .65, midi, velocity}, {rate: this.context.sampleRate, bpm: project.song.bpm,room});
    if (ticket !== this.intent) return;
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    const buffer = this.context.createBuffer(1, samples.length, this.context.sampleRate); buffer.copyToChannel(samples, 0);
    source.buffer = buffer; gain.gain.value = .6; source.connect(gain); gain.connect(this.master);
    const entry = {source, gain}; this.sources.add(entry);
    source.onended = () => { source.disconnect(); gain.disconnect(); this.sources.delete(entry); };
    source.start();
  }
  setVolume(value) { this.volume = value; if (this.master) this.master.gain.setTargetAtTime(value, this.context.currentTime, .02); }
  setEQ(index, value) { this.eqGains[index] = value; if (this.filters) this.filters[index].gain.setTargetAtTime(value, this.context.currentTime, .02); }
  setLoop(loop) { this.loop = loop; if (this.current) this.current.source.loop = loop; }
  destroy() {
    this.stop(); this.worker?.terminate(); if (this.workerURL) URL.revokeObjectURL(this.workerURL);
    for (const job of this.jobs.values()) { clearTimeout(job.timer); job.reject(new Error('Studio closed.')); }
    this.jobs.clear(); this.context?.close();
  }
}
window.DotAudio = DotAudio;
