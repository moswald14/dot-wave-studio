'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),C=require('./core.js');
const pending=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const flush=()=>new Promise(setImmediate);
function fixture(){
  const events={},rootEvents={},requests=[],analyses=[],errors=[];let renders=0,stops=0;
  const stream={getTracks:()=>[{stop:()=>stops++}]},doc={getElementById:()=>null,addEventListener:(name,fn)=>events[name]=fn};
  class Recorder{static isTypeSupported(){return false;}constructor(){this.state='inactive';}start(){this.state='recording';}stop(){this.state='inactive';this.onstop?.();}}
  const context=vm.createContext({document:doc,navigator:{mediaDevices:{getUserMedia:()=>{const req=pending();requests.push(req);return req.promise;}}},MediaRecorder:Recorder,Blob,Float32Array,setTimeout,clearTimeout,setInterval,clearInterval,addEventListener:(name,fn)=>rootEvents[name]=fn});
  vm.runInContext(fs.readFileSync('capture-ui.js','utf8'),context);
  const panel=context.CapturePanel({C,ui:{},audio:{init:async()=>({}),analyseTake:()=>{const req=pending();analyses.push(req);return req.promise;}},prepare(){},render(){renders++;},notify:error=>errors.push(error),getProject:()=>C.blank()});
  const click=action=>events.click({target:{closest:()=>({dataset:{captureAction:action},disabled:false})}});
  return {panel,click,requests,analyses,stream,events,rootEvents,errors,get stops(){return stops;},get renders(){return renders;}};
}
async function run(){
  const f=fixture(),job=f.click('record');await flush();assert.equal(f.requests.length,1);assert(f.panel.state.entry);f.panel.cancel();f.requests[0].resolve(f.stream);await job;assert.equal(f.stops,1);assert.equal(f.panel.state.entry,null);assert.equal(f.errors.length,0);console.log('PASS Cancelling while microphone permission is pending releases the late stream');
  const g=fixture(),take={samples:new Float32Array(8000),rate:8000};const first=g.panel.accept(take,'First');assert.equal(g.analyses.length,1);g.panel.cancel();g.analyses[0].resolve({cycle:null,frames:[],duration:1});await first;assert.equal(g.panel.state.take,null);assert.equal(g.panel.state.busy,false);console.log('PASS Cancelled capture analysis cannot replace a reviewed take or alter music');
  const a=g.panel.accept(take,'Older'),b=g.panel.accept(take,'Newest');g.analyses[2].resolve({cycle:null,frames:[],duration:1});await b;g.analyses[1].resolve({cycle:null,frames:[],duration:1});await a;assert.equal(g.panel.state.take.title,'Newest');assert.equal(g.panel.state.busy,false);console.log('PASS A late older analysis cannot overwrite the newest imported take');
  await g.panel.accept({samples:new Float32Array(8000*31),rate:8000},'Too long');assert.equal(g.panel.state.take.title,'Newest');assert.equal(g.analyses.length,3);assert.equal(g.errors.length,1);console.log('PASS Invalid audio leaves the previous reviewed take available');
  const h=fixture(),record=h.click('record');await flush();h.requests[0].resolve(h.stream);await record;assert(h.panel.state.entry);h.events.visibilitychange({});assert(h.panel.state.entry);h.rootEvents.pagehide();assert.equal(h.panel.state.entry,null);assert(h.stops>=1);assert.equal(h.panel.state.busy,false);console.log('PASS Closing the page stops the active microphone and its timers');
  console.log('5 capture lifecycle checks passed.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
