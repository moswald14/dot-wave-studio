#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');

function parse(args){
  const options={},pos=[];
  for(let i=0;i<args.length;i++){
    if(!args[i].startsWith('--')){pos.push(args[i]);continue;}
    const key=args[i].slice(2);if(!['repo','out','scope','rate'].includes(key)||!args[i+1]||args[i+1].startsWith('--'))throw new Error('Use --repo, --out, --scope or --rate followed by a value.');
    if(Object.hasOwn(options,key))throw new Error('Use each option once.');options[key]=args[++i];
  }
  if(pos.length!==2||!['inspect','validate','render'].includes(pos[0]))throw new Error('Usage: studio.cjs inspect|validate|render project.studio.json [--repo checkout] [--out file.wav] [--scope song|melody|beat|sound] [--rate 44100]');
  return {command:pos[0],file:path.resolve(pos[1]),...options};
}
function resolveRepo(explicit){
  const candidates=explicit?[explicit]:[process.env.DOT_WAVE_STUDIO_REPO,process.cwd(),path.join(process.cwd(),'work/github-dot-wave-studio'),path.resolve(__dirname,'../../..')].filter(Boolean);
  for(const dir of candidates){const root=path.resolve(dir);try{const pack=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));if(pack.name==='dot-wave-studio'&&fs.existsSync(path.join(root,'core.js')))return root;}catch{}}
  throw new Error('Pass --repo with the current Dot Wave Studio source checkout.');
}
function run(args){
  const o=parse(args),repo=resolveRepo(o.repo),C=require(path.join(repo,'core.js'));
  if(fs.statSync(o.file).size>64*1024*1024)throw new Error('Choose a Studio project under 64 MB.');
  const p=C.open(JSON.parse(fs.readFileSync(o.file,'utf8'))),round=C.open(JSON.parse(C.serialize(p)));
  const summary={name:round.song.name,bpm:round.song.bpm,bars:round.song.bars,sounds:round.library.length,recordedSpeechSounds:Object.keys(round.voiceBank.takes).length,patterns:round.patterns.length,
    melodyParts:round.melody.tracks.map(t=>({name:t.name,instrument:t.instrument,notes:t.notes.length,sungNotes:t.notes.filter(n=>n.vocal).length})),
    songTracks:round.song.tracks.map(t=>({name:t.name,instrument:t.instrument,notes:t.notes.length,clips:(t.phrases||[]).length,sungNotes:t.notes.concat((t.phrases||[]).flatMap(c=>c.notes)).filter(n=>n.vocal).length}))};
  if(o.command==='render'){
    if(!o.out)throw new Error('Choose a new WAV path with --out.');
    const output=path.resolve(o.out);if(path.extname(output).toLowerCase()!=='.wav')throw new Error('Use a .wav output file.');if(fs.existsSync(output))throw new Error('The output already exists. Choose a new path.');
    const scope=o.scope||'song',rate=Number(o.rate||44100);if(!['song','melody','beat','sound'].includes(scope)||![8000,16000,22050,44100,48000,96000].includes(rate))throw new Error('Choose a supported scope and sample rate.');
    const audio=C.render(round,scope,rate,{loopTails:false});
    if(!audio.left.every(Number.isFinite)||!audio.right.every(Number.isFinite))throw new Error('The render contains invalid audio.');
    fs.writeFileSync(output,Buffer.from(C.IO.encodeWav(audio,rate)),{flag:'wx'});
    return {valid:true,...summary,render:{output,scope,rate,seconds:audio.duration,peak:Math.max(C.S.peakOf(audio.left),C.S.peakOf(audio.right))}};
  }
  if(o.out||o.scope||o.rate)throw new Error('Render options apply only to the render command.');
  return o.command==='validate'?{valid:true,name:summary.name}:{valid:true,...summary};
}
module.exports={run,parse,resolveRepo};
if(require.main===module){try{console.log(JSON.stringify(run(process.argv.slice(2)),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
