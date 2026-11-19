(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const S=node?require('./studio-dsp.js'):root.StudioDSP;
  const Collision=node?require('./collision-audio.js'):root.CollisionAudio;
  const Tone=node?require('./amp-tone.js'):root.AmpTone;
  const FX=node?require('./effects-dsp.js'):root.EffectsDSP;
  const KEYS=['1','2','3','4','5','6','7','8','9','*','0','#'];
  const LOW=[697,770,852,941],HIGH=[1209,1336,1477];
  const clone=value=>JSON.parse(JSON.stringify(value));
  const finite=(value,low,high,label)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<low||value>high)throw new Error('Invalid '+label+'.');return value;};
  function pair(patch){return patch.freePair?{...patch.freePair}:{a:patch.pitch*patch.project.a.ratio,b:patch.pitch*patch.project.b.ratio};}
  function phonePair(key){const index=KEYS.indexOf(String(key));if(index<0)throw new Error('Choose a phone key from 0–9, * or #.');return {a:LOW[Math.floor(index/3)],b:HIGH[index%3]};}
  const dialPair=()=>({a:350,b:440});
  function range(low,high,rate=48000){
    finite(low,20,19999,'minimum pitch');finite(high,21,20000,'maximum pitch');finite(rate,8000,192000,'sample rate');
    const bounds={low:Math.ceil(low),high:Math.floor(Math.min(high,rate*.45))};
    if(bounds.high<=bounds.low)throw new Error('Choose a higher maximum within this audio device’s pitch range.');
    return bounds;
  }
  function randomPair(bounds,previous={},random=Math.random){
    const count=bounds.high-bounds.low+1;
    if(!Number.isInteger(count)||count<2)throw new Error('Choose a range with at least two pitches.');
    const choose=old=>{const value=finite(random(),0,1,'random value');let next=bounds.low+Math.min(count-1,Math.floor(value*count));if(next===old)next=bounds.low+(next-bounds.low+1)%count;return next;};
    const a=choose(previous.a);let b=choose(previous.b);
    for(let i=0;i<count&&(b===a||b===previous.b);i++)b=b===bounds.high?bounds.low:b+1;
    if(a===b)b=b===bounds.high?bounds.low:b+1;
    return {a,b};
  }
  function setPair(value,tones,{phone=false}={}){
    const patch=S.validatePatch(value);Collision.validatePair(tones,48000);patch.freePair={a:tones.a,b:tones.b};patch.pitch=tones.a;
    if(phone){patch.project.a=S.source('sine');patch.project.b=S.source('sine');patch.project.mode='blend';patch.project.amount=.5;patch.project.normalize=true;}
    return patch;
  }
  function randomPatch(value,settings,random=Math.random){
    const patch=setPair(value,randomPair(range(settings.low,settings.high,settings.rate||48000),pair(value),random));
    if(settings.shapes){for(const side of ['a','b']){const choices=S.TYPES.filter(shape=>shape!==patch.project[side].shape),shape=choices[Math.min(choices.length-1,Math.floor(finite(random(),0,1,'random value')*choices.length))];patch.project[side]={...patch.project[side],shape,points:S.source(shape).points,pins:[]};}}
    return patch;
  }
  function safeLevel(value,tones){return Math.max(-60,Math.min(Math.max(tones.a,tones.b)>=8000?-42:-18,Number.isFinite(value)?value:-30));}
  function validateRecipe(value){
    if(!value||value.kind!=='dot-patch-tone'||value.version!==1||!['concert','captured'].includes(value.rootMode))throw new Error('Choose a saved patch tone.');
    return {kind:'dot-patch-tone',version:1,rootMode:value.rootMode,patch:S.validatePatch(value.patch)};
  }
  function recipe(patch,rootMode='concert'){return validateRecipe({kind:'dot-patch-tone',version:1,rootMode,patch});}
  function importFile(value){
    if(value?.recipe)return {name:typeof value.name==='string'?value.name.trim().slice(0,48):'',recipe:validateRecipe(value.recipe)};
    if(value?.kind==='dot-wave-studio')return {name:'',recipe:recipe(value)};
    if(value?.kind==='dot-patch-switchboard'&&value.version===1){
      if(![1,2,3,88].includes(value.octaves)||![-2,-1,0,1,2].includes(value.shift)||typeof value.root!=='boolean')throw new Error('Invalid Classic switchboard settings.');
      return {name:'',recipe:recipe(value.patch,value.root?'captured':'concert'),shift:value.shift,octaves:value.octaves===88?3:value.octaves};
    }
    throw new Error('Choose a patch tone, Classic patch or WOOF switchboard file.');
  }
  function notePair(value,midi){
    const checked=validateRecipe(value),original=pair(checked.patch);finite(midi,0,127,'keyboard note');
    const a=checked.rootMode==='captured'?original.a*2**((midi-60)/12):440*2**((midi-69)/12);
    return {a,b:a*original.b/original.a};
  }
  function playable(tones,rate=48000){try{Collision.validatePair(tones,rate);return true;}catch{return false;}}
  function renderNote(value,note,{rate=44100,bpm=110,pitch=0}={}){
    const saved=validateRecipe(value),patch=saved.patch,tones=notePair(saved,finite(note.midi,0,127,'keyboard note'));
    finite(rate,8000,192000,'sample rate');finite(bpm,40,240,'tempo');finite(note.velocity,0,1,'note velocity');finite(note.duration,1/960,1024,'note duration');finite(pitch,-24,24,'pitch shift');
    const factor=2**(pitch/12);tones.a*=factor;tones.b*=factor;
    const hold=note.duration*60/bpm,release=.08,duration=Math.min(300,hold+release),frames=Math.max(2,Math.round(duration*rate)),raw=new Float32Array(frames);
    if(!note.velocity||!playable(tones,rate))return raw;
    const prepared=Collision.prepare(patch.project,tones,rate),tone=Tone.processor(rate,patch.project.amp),ease=x=>.5-.5*Math.cos(Math.PI*Math.max(0,Math.min(1,x)));
    for(let i=0;i<frames;i++){
      const t=i/rate,a=S.sample(prepared.a.table,t*tones.a),b=S.sample(prepared.b.table,t*tones.b);
      const sample=tone(S.ampSample(Collision.mix(a,b,patch.project)*prepared.scale,patch.project.amp));
      raw[i]=Math.max(-1,Math.min(1,sample))*(patch.inverted?-1:1)*ease(t/.01)*(t<=hold?1:ease(1-(t-hold)/release))*(.72+.28*Math.exp(-12*t))*note.velocity*.65;
    }
    raw[0]=0;raw[frames-1]=0;return FX.process(raw,rate,patch.project.effects,{tail:true});
  }
  function history(value){
    if(!value||value.kind!=='dot-woof-history'||value.version!==1||!Array.isArray(value.items)||value.items.length>100)throw new Error('Choose a WOOF discovery history with up to 100 tones.');
    const ids=new Set();return value.items.map(item=>{
      if(!item||typeof item.id!=='string'||!/^[a-zA-Z0-9_-]{1,90}$/.test(item.id)||ids.has(item.id)||!Number.isSafeInteger(item.created)||item.created<0||item.created>8640000000000000)throw new Error('A WOOF discovery is invalid.');
      ids.add(item.id);return {id:item.id,created:item.created,patch:S.validatePatch(item.patch),level:finite(item.level,-60,-18,'discovery level'),liked:item.liked===true};
    });
  }
  class Wander {
    constructor({next,hear,stopAudio,changed=()=>{},failed=()=>{},timers={setTimeout:(fn,ms)=>root.setTimeout(fn,ms),clearTimeout:id=>root.clearTimeout(id)}}){Object.assign(this,{next,hear,stopAudio,changed,failed,timers});this.intent=0;this.running=false;this.timer=null;this.limit=null;}
    async start(interval=2){
      if(![.5,1,2,4,8].includes(interval))throw new Error('Choose a wandering interval.');
      this.stop();const ticket=++this.intent;this.running=true;this.changed();
      this.limit=this.timers.setTimeout(()=>this.stop(),60000);
      const turn=async()=>{if(ticket!==this.intent||!this.running)return;try{const patch=this.next();if(ticket!==this.intent)return;await this.hear(patch);if(ticket!==this.intent)return;this.timer=this.timers.setTimeout(turn,interval*1000);}catch(error){if(ticket===this.intent){this.stop();this.failed(error);}}};
      await turn();
    }
    stop(){this.intent++;this.running=false;this.timers.clearTimeout(this.timer);this.timers.clearTimeout(this.limit);this.timer=this.limit=null;this.stopAudio();this.changed();}
  }
  const api={KEYS,pair,phonePair,dialPair,range,randomPair,setPair,randomPatch,safeLevel,recipe,validateRecipe,importFile,notePair,playable,renderNote,history,Wander,clone};
  if(node)module.exports=api;else root.PatchTone=api;
})(typeof globalThis!=='undefined'?globalThis:this);
