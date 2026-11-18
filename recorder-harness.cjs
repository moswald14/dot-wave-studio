'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),C=require('./core.js');
function harness(mode='normal'){
  const source=fs.readFileSync(path.join(__dirname,'app.js'),'utf8'),start=source.indexOf('  let voiceRecording=null,voiceTicket=0;'),end=source.indexOf('  function soundView()',start);
  assert.ok(start>0&&end>start);const tracks=[{stopped:false,stop(){this.stopped=true;}}],stream={getTracks:()=>tracks},timers=[];
  const pcm=Float32Array.from({length:22050*.6},(_,i)=>i<1000||i>11000?0:Math.sin(2*Math.PI*220*i/22050)*.3);
  const context={createMediaStreamSource:()=>({connect(){},disconnect(){}}),createAnalyser:()=>({getFloatTimeDomainData(a){a.fill(.1);},disconnect(){}}),decodeAudioData:async()=>({sampleRate:22050,length:pcm.length,numberOfChannels:1,getChannelData:()=>pcm})};
  let resolvePermission;
  class Recorder{constructor(){this.state='inactive';this.mimeType='audio/webm';}static isTypeSupported(){return true;}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['recorded bytes'])});this.completion=this.onstop?.();}}
  const ui={phone:'AA',voicePending:{},voiceProcessing:false,voiceNotice:''},globals={C,ui,window:{MediaRecorder:Recorder},MediaRecorder:Recorder,navigator:{mediaDevices:{getUserMedia:()=>mode==='denied'?Promise.reject(Object.assign(new Error('denied'),{name:'NotAllowedError'})):mode==='pending'?new Promise(resolve=>resolvePermission=resolve):Promise.resolve(stream)}},audio:{stop(){},async init(){return context;},context},render(){},notify(){},$:()=>null,Blob,Float32Array,Date,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},setInterval:()=>1,clearInterval(){}};
  vm.createContext(globals);vm.runInContext(source.slice(start,end),globals);
  return {globals,ui,tracks,timers,run:code=>vm.runInContext(code,globals),resolvePermission:()=>resolvePermission(stream)};
}
module.exports=async()=>{
  const done=[];
  const normal=harness();await normal.run('startVoiceCapture()');assert.equal(normal.run('voiceRecording.recorder.state'),'recording');normal.run('stopVoiceCapture()');for(let i=0;i<12;i++)await Promise.resolve();assert.ok(normal.ui.voicePending.AA);assert.equal(normal.ui.voiceProcessing,false);assert.ok(normal.tracks.every(t=>t.stopped));done.push('Actual microphone controller decodes, analyses and releases a completed take');
  const denied=harness('denied');await denied.run('startVoiceCapture()');assert.match(denied.ui.voiceNotice,/denied/);assert.equal(denied.run('voiceRecording'),null);assert.equal(Object.keys(denied.ui.voicePending).length,0);done.push('Denied microphone permission leaves the recorder ready for another attempt');
  const pending=harness('pending'),waiting=pending.run('startVoiceCapture()');for(let i=0;i<4;i++)await Promise.resolve();pending.run('cancelVoiceCapture()');pending.resolvePermission();await waiting;assert.ok(pending.tracks.every(t=>t.stopped));assert.equal(Object.keys(pending.ui.voicePending).length,0);done.push('Cancelling a microphone request releases a stream granted later');
  const timeout=harness();await timeout.run('startVoiceCapture()');assert.equal(timeout.timers.length,1);timeout.timers[0]();for(let i=0;i<12;i++)await Promise.resolve();assert.ok(timeout.ui.voicePending.AA);assert.ok(timeout.tracks.every(t=>t.stopped));done.push('The automatic take limit stops capture and keeps a reviewable recording');
  return done;
};
