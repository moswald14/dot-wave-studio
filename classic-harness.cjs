// Executes all shipped scripts with a small DOM/audio test double. This checks
// wiring and lifecycle behavior without using the blocked browser UI.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'Dot-Wave-Classic.html'),'utf8');
const byId=new Map();let activeElement=null;
class Element{
 constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.events={};this.dataset={};this.style={};this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.clientWidth=400;this.clientHeight=180;this.paused=true;this.duration=NaN;this.currentTime=0;this._text='';this.className='';this.classList={toggle:(name,force)=>{let set=new Set(this.className.split(' ').filter(Boolean));const add=force===undefined?!set.has(name):force;add?set.add(name):set.delete(name);this.className=[...set].join(' ');},add:name=>this.classList.toggle(name,true),remove:name=>this.classList.toggle(name,false)};}
 setAttribute(k,v){this.attrs[k]=String(v);if(k==='id'){this.id=String(v);byId.set(this.id,this);}if(k==='class')this.className=v;if(k==='value')this.value=v;if(k==='checked')this.checked=true;if(k==='hidden')this.hidden=true;if(k==='disabled')this.disabled=true;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;}
 getAttribute(k){return this.attrs[k]??null;}
 append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n);}}
 prepend(n){n.parentElement=this;this.children.unshift(n);}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);}
 set innerHTML(value){const forget=n=>{if(n.id)byId.delete(n.id);n.children.forEach(forget);};this.children.forEach(forget);this.children=[];parse(value,this);}
 get innerHTML(){return '';}
 set textContent(t){this._text=String(t);this.children=[];}
 get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
 addEventListener(type,fn){(this.events[type]??=[]).push(fn);}
 async emit(type,props={}){const event={target:this,currentTarget:this,preventDefault(){},...props};for(const fn of this.events[type]||[])await fn(event);}
 click(){return this.emit('click');}
 focus(){activeElement=this;}
 blur(){activeElement=null;return this.emit('change');}
 setPointerCapture(){}
 getBoundingClientRect(){return {left:0,top:0,width:400,height:180};}
 querySelectorAll(selector){const result=[];const visit=n=>{for(const c of n.children){if(matches(c,selector))result.push(c);visit(c);}};visit(this);return result;}
 load(){}
 pause(){this.paused=true;return this.emit('pause');}
 async play(){this.paused=false;await this.emit('play');}
}
function matches(el,selector){if(selector.startsWith('.'))return el.className.split(' ').includes(selector.slice(1));const attr=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);if(attr)return Object.hasOwn(el.attrs,attr[1])&&(attr[2]===undefined||el.attrs[attr[1]]===attr[2]);return el.tagName.toLowerCase()===selector;}
function parse(markup,parent){
 const stack=[parent],voids=new Set(['meta','link','input','br','hr','img']);
 for(const match of markup.matchAll(/<\/?([\w-]+)\b([^>]*)>/g)){
  const closing=match[0][1]==='/',tag=match[1].toLowerCase();
  if(closing){for(let i=stack.length-1;i>0;i--)if(stack[i].tagName.toLowerCase()===tag){stack.length=i;break;}continue;}
  const el=new Element(tag);for(const a of match[2].matchAll(/([^\s=/'"]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))el.setAttribute(a[1],a[2]??a[3]??a[4]??'');stack.at(-1).append(el);if(!voids.has(tag)&&!match[0].endsWith('/>'))stack.push(el);
 }
}
const root=new Element('document');parse(html.replace(/<script>[\s\S]*?<\/script>/g,'').replace(/<style>[\s\S]*?<\/style>/g,''),root);
for(const select of root.querySelectorAll('select')){const options=select.querySelectorAll('option');select.value=(options.find(o=>o.getAttribute('selected')!==null)||options[0])?.value||'';}
const document={body:root.querySelectorAll('body')[0],hidden:false,get activeElement(){return activeElement;},getElementById:id=>byId.get(id)||null,querySelectorAll:s=>root.querySelectorAll(s),createElement:t=>new Element(t),createElementNS:(_,t)=>new Element(t),events:{},addEventListener(type,fn){(this.events[type]??=[]).push(fn);}};
class Param{
 constructor(value=0){this.value=value;this.calls=[];}
 cancelAndHoldAtTime(t){this.calls.push(['hold',t]);}
 cancelScheduledValues(t){this.calls.push(['cancel',t]);}
 setValueAtTime(v,t){this.value=v;}
 setTargetAtTime(v,t,c){this.value=v;}
 linearRampToValueAtTime(v,t){this.value=v;}
}
class AudioNode{
 constructor(){this.gain=new Param(1);this.frequency=new Param(440);this.Q=new Param(1);this.delayTime=new Param();this.detune=new Param();this.pan=new Param();this.threshold=new Param();this.knee=new Param();this.ratio=new Param();this.attack=new Param();this.release=new Param();this.outputs=[];this.frequencyBinCount=2048;this.fftSize=4096;}
 connect(n){this.outputs.push(n);return n;}
 disconnect(target){this.outputs=target?this.outputs.filter(n=>n!==target):[];}
 getFrequencyResponse(_,mag,phase){mag.fill(1);phase.fill(0);}
 setPeriodicWave(w){this.wave=w;}
 getByteFrequencyData(a){a.fill(0);}
 getFloatTimeDomainData(a){a.fill(0);}
 start(at,offset=0,duration){this.started=true;this.startTime=at;this.startOffset=offset;this.startDuration=duration;}
 stop(at){this.stopped=true;this.stopTime=at;}
}
class Context{
 constructor(){this.sampleRate=48000;this.currentTime=1;this.state='running';this.destination=new AudioNode();this.events={};}
 createDelay(){return new AudioNode();}createOscillator(){return new AudioNode();}createWaveShaper(){return new AudioNode();}createGain(){return new AudioNode();}createStereoPanner(){return new AudioNode();}createBiquadFilter(){return new AudioNode();}createDynamicsCompressor(){return new AudioNode();}createAnalyser(){return new AudioNode();}createMediaElementSource(){return new AudioNode();}
 createBuffer(channels,length,rate){const data=Array.from({length:channels},()=>new Float32Array(length));return {length,duration:length/rate,sampleRate:rate,numberOfChannels:channels,copyToChannel:(s,ch=0)=>data[ch].set(s),getChannelData:(ch=0)=>data[ch]};}createBufferSource(){return new AudioNode();}
 createPeriodicWave(real,imag,options){return {real,imag,options};}addEventListener(type,fn){(this.events[type]??=[]).push(fn);}async resume(){this.state='running';}
}
let next=0,now=0;const timers=new Map(),frames=new Map(),blobs=[];
const storage=new Map();
const globals={console,TextEncoder,crypto:require('node:crypto').webcrypto,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))},document,Float32Array,Float64Array,Uint8Array,ArrayBuffer,DataView,Blob,AudioContext:Context,OfflineAudioContext:Context,ResizeObserver:class{observe(){}},performance:{now:()=>now},URL:{createObjectURL:b=>{blobs.push(b);return 'blob:test';},revokeObjectURL(){}},setTimeout:(fn,ms)=>{timers.set(++next,{fn,at:now+ms});return next;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id),addEventListener(){}};
globals.window=globals;const ctx=vm.createContext(globals),run=s=>vm.runInContext(s,ctx);
for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))run(m[1]);
function flushFrames(){const jobs=[...frames.values()];frames.clear();jobs.forEach(fn=>fn(now));}
function flushTimers(ms){now+=ms;for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}}
function el(id){const e=byId.get(id);assert.ok(e,`Missing ${id}`);return e;}

module.exports={fs,path,vm,assert,html,ctx,run,el,document,flushFrames,flushTimers,blobs,timers,frames,storage,globals};
