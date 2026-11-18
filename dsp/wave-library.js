(function(root){
 'use strict';
 const FX=typeof module!=='undefined'&&module.exports?require('./effects-dsp.js'):root.EffectsDSP;
 const D=typeof module!=='undefined'&&module.exports?require('./studio-dsp.js'):root.StudioDSP;
 const MAX_WAVES=64;
 function cleanName(name){if(typeof name!=='string')throw new Error('Each waveform needs a name.');const value=name.trim().slice(0,48);if(!value)throw new Error('Give the waveform a name.');return value;}
 function validateWave(wave){
  if(!wave||typeof wave.id!=='string'||!/^[a-zA-Z0-9_-]{1,90}$/.test(wave.id))throw new Error('Invalid waveform ID.');
  function terms(values){if(!Array.isArray(values)||values.length!==128||Array.from(values).some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>2))throw new Error('Waveform coefficients are invalid.');if(values[0]!==0)throw new Error('Waveforms must have zero DC offset.');return Float32Array.from(values);}
  const real=terms(wave.real),imag=terms(wave.imag),signal=D.analyse(D.reconstruct(real,imag));
  if(wave.frequency!==undefined&&(typeof wave.frequency!=='number'||!Number.isFinite(wave.frequency)||wave.frequency<20||wave.frequency>20000))throw new Error('Invalid saved waveform pitch.');
  return {...(wave.frequency!==undefined?{frequency:wave.frequency}:{}),effects:FX.validate(wave.effects),id:wave.id,name:cleanName(wave.name),real:Array.from(signal.real),imag:Array.from(signal.imag)};
 }
 // Keep the six reserved library slots stable for older, full 64-wave libraries.
 // Additional presets live in the input/shape menus and can be saved normally.
 function stockWaves(){return D.TYPES.slice(0,6).map(type=>{const p=D.defaultProject();p.a=D.source(type);p.amount=0;const s=D.compile(p).result;return {id:`stock-${type}`,name:type[0].toUpperCase()+type.slice(1),real:Array.from(s.real),imag:Array.from(s.imag)};});}
 function snapshot(signal,name,id,inverted=false){const sign=inverted?-1:1;return validateWave({id,name,effects:signal.effects,real:Array.from(signal.real,v=>v*sign),imag:Array.from(signal.imag,v=>v*sign)});}
 function signal(wave){return {effects:FX.validate(wave.effects),real:Float32Array.from(wave.real),imag:Float32Array.from(wave.imag),table:D.reconstruct(wave.real,wave.imag)};}
 function validateBundle(data){
  if(!data||data.kind!=='dot-wave-library'||data.version!==1||!Array.isArray(data.waves)||data.waves.length>MAX_WAVES)throw new Error('Choose a Dot Wave Studio library file with at most 64 waves.');
  const seen=new Set();return Array.from(data.waves,wave=>{const checked=validateWave(wave);if(seen.has(checked.id))throw new Error('Duplicate waveform IDs in this library.');seen.add(checked.id);return checked;});
 }
 function merge(existing,incoming){const map=new Map(existing.map(w=>[w.id,w]));for(const wave of incoming)if(!map.has(wave.id))map.set(wave.id,wave);if(map.size>MAX_WAVES)throw new Error('The library is full (64 waves). Export a backup and remove a saved wave first.');return [...map.values()];}
 function prepareImport(existing,incoming,newId){
  const occupied=new Map(existing.map(w=>[w.id,w])),remap=new Map(),additions=[];
  const equivalent=(a,b)=>a.name===b.name&&JSON.stringify(FX.validate(a.effects))===JSON.stringify(FX.validate(b.effects))&&(a.frequency??134)===(b.frequency??134)&&['real','imag'].every(key=>a[key].every((v,i)=>Math.abs(v-b[key][i])<.000001));
  for(const original of incoming){
   let wave=original;const local=occupied.get(wave.id);
   if(local&&!equivalent(local,wave)){
    // An earlier import may already have resolved this same ID conflict.
    // Reuse its equivalent record instead of filling the bank with copies.
    const previous=[...occupied.values()].find(candidate=>equivalent(candidate,wave));
    if(previous){wave=previous;remap.set(original.id,previous.id);}
    else{
     let id=newId(),suffix=0;const base=id;
     while(occupied.has(id)||incoming.some(w=>w.id===id))id=base+'-'+(++suffix);
     wave={...wave,id};remap.set(original.id,id);
    }
   }
   if(!occupied.has(wave.id)){occupied.set(wave.id,wave);additions.push(wave);}
  }
  return {waves:merge(existing,additions),remap};
 }
 const api={MAX_WAVES,cleanName,validateWave,stockWaves,snapshot,signal,validateBundle,merge,prepareImport};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WaveLibrary=api;
})(typeof globalThis!=='undefined'?globalThis:this);
