#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),util=require('node:util');
const {resolveRepo}=require('./studio.cjs');
function parse(args){
  const options={},pos=[];
  for(let i=0;i<args.length;i++){
    const token=args[i];if(!token.startsWith('--')){pos.push(token);continue;}
    const key=token.slice(2);if(!['repo','out','rate'].includes(key)||!args[i+1]||args[i+1].startsWith('--')||Object.hasOwn(options,key))throw new Error('Use --repo, --out or --rate once, followed by a value.');options[key]=args[++i];
  }
  const [command,...files]=pos;
  if(!['migrate','recover-sounds','preview-patch'].includes(command)||!files.length||files.length>32||command!=='recover-sounds'&&files.length!==1)throw new Error('Usage: classic.cjs migrate|recover-sounds|preview-patch file.json [more-recovery-files.json] --out new-file [--repo checkout] [--rate 44100]');
  if(!options.out)throw new Error('Choose a new output with --out.');
  const output=path.resolve(options.out);if(fs.existsSync(output))throw new Error('The output already exists. Choose a new path.');
  if(path.extname(output).toLowerCase()!==(command==='preview-patch'?'.wav':'.json'))throw new Error(command==='preview-patch'?'Use a .wav output file.':'Use a .json output file.');
  if(options.rate&&command!=='preview-patch')throw new Error('--rate applies only to preview-patch.');
  const rate=Number(options.rate||44100);if(![8000,16000,22050,44100,48000,96000].includes(rate))throw new Error('Choose a supported preview sample rate.');
  return {command,files:files.map(f=>path.resolve(f)),output,repo:options.repo,rate};
}
function read(file){if(!fs.statSync(file).isFile()||fs.statSync(file).size>64*1024*1024)throw new Error('Choose a saved JSON file under 64 MB.');return JSON.parse(fs.readFileSync(file,'utf8'));}
function embeddedWaves(C,data){
  let waves;
  if(data?.kind==='dot-wave-library'&&data.version===1)waves=data.waves;
  else if(data?.kind==='dot-studio-project'&&[1,2].includes(data.version))waves=data.version===1?data.song?.library:data.library;
  else if(['dot-midi-mix','dot-drum-machine'].includes(data?.kind)&&[1,2,3].includes(data.version)||data?.kind==='dot-melody-file'&&data.version===1)waves=data.library;
  else if(data?.kind==='dot-melody-pattern'&&data.version===1)waves=data.waves;
  else throw new Error('Choose a waveform library, full Studio save, Classic song, beatMAP, melody file or melody pattern.');
  return C.W.validateBundle({kind:'dot-wave-library',version:1,waves});
}
function equivalent(C,a,b){
  return a.name===b.name&&(a.frequency??134)===(b.frequency??134)&&JSON.stringify(C.FX.validate(a.effects))===JSON.stringify(C.FX.validate(b.effects))&&JSON.stringify(a.patchTone||null)===JSON.stringify(b.patchTone||null)&&['real','imag'].every(k=>a[k].every((v,i)=>Math.abs(v-b[k][i])<.000001));
}
function run(args){
  const o=parse(args),repo=resolveRepo(o.repo),C=require(path.join(repo,'core.js'));
  if(o.command==='migrate'){
    const source=read(o.files[0]),p=C.open(source),encoded=JSON.parse(C.serialize(p)),sourceSong=source.version===1?source.song.song:source.song;
    // The core writes PCM16 for new recordings. Existing encoded WAVs already
    // passed C.open; retain them so conversion cannot quantize the take again.
    for(const clip of encoded.song.audio){const original=sourceSong.audio?.find(a=>a.id===clip.id);if(original?.wav)clip.wav=original.wav;}
    const round=C.open(encoded),metadata=v=>({...v,song:{...v.song,audio:v.song.audio.map(({samples,...clip})=>clip)}});
    // Existing WAVs must be exact. Raw floats get PCM16's half-step rounding
    // plus its 32767-to-32768 scale difference, bounded by 1.5 PCM units.
    const audioChanged=p.song.audio.some((clip,i)=>{const tolerance=sourceSong.audio?.find(a=>a.id===clip.id)?.wav?0:1.5/32768;return clip.samples.length!==round.song.audio[i].samples.length||clip.samples.some((v,j)=>Math.abs(v-round.song.audio[i].samples[j])>tolerance);});
    if(!util.isDeepStrictEqual(metadata(p),metadata(round))||audioChanged)throw new Error('The converted project did not preserve its music and audio.');
    const text=JSON.stringify(encoded,null,2);
    fs.writeFileSync(o.output,text,{flag:'wx'});
    return {output:o.output,sourceVersion:source.version,version:2,sounds:round.library.length,songTracks:round.song.tracks.length,patterns:round.patterns.length,originalUnchanged:true};
  }
  if(o.command==='recover-sounds'){
    let waves=[],duplicates=0,sequence=0;const sources=[],renamed=[];
    for(const file of o.files){const incoming=embeddedWaves(C,read(file));let added=0,matched=0;
      for(const wave of incoming){const same=waves.find(saved=>equivalent(C,saved,wave));if(same){duplicates++;matched++;continue;}
        const imported=C.W.prepareImport(waves,[wave],()=> 'recovered-'+(++sequence));waves=imported.waves;added++;
        if(imported.remap.has(wave.id))renamed.push({source:path.basename(file),from:wave.id,to:imported.remap.get(wave.id)});
      }
      sources.push({file,sounds:incoming.length,added,matched});
    }
    const result={kind:'dot-wave-library',version:1,waves:C.W.validateBundle({kind:'dot-wave-library',version:1,waves})};
    fs.writeFileSync(o.output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
    return {output:o.output,sounds:waves.length,duplicates,renamed,sources,originalsUnchanged:true};
  }
  const data=read(o.files[0]),recipe=data?.kind==='dot-patch-tone'?C.Patch.validateRecipe(data):C.Patch.importFile(data).recipe;
  const audio=C.renderPatchPreview(recipe.patch,'result',{rate:o.rate});
  if(audio.left.length!==o.rate*3||!audio.left.every(Number.isFinite)||!audio.right.every(Number.isFinite))throw new Error('The patch preview did not produce finite three-second audio.');
  fs.writeFileSync(o.output,Buffer.from(C.IO.encodeWav(audio,o.rate)),{flag:'wx'});
  return {output:o.output,seconds:3,rate:o.rate,pair:C.Patch.pair(recipe.patch),tuning:recipe.rootMode,originalUnchanged:true};
}
module.exports={parse,embeddedWaves,equivalent,run};
if(require.main===module){try{console.log(JSON.stringify(run(process.argv.slice(2)),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
