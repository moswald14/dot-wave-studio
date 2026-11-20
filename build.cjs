'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = __dirname, output = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'dist');
const modules = ['hum-dsp','hum-phrase','effects-dsp','amp-tone','studio-dsp','collision-audio','patch-tone','drum-dsp','clip-dsp','instrument-data','sampler-dsp','voice-dsp','vocal-dsp','song-dsp','melody-dsp','wave-library','midi-io'];
const dsp = modules.map(name => fs.readFileSync(path.join(root, 'dsp', name + '.js'), 'utf8')).join('\n');
const lexicon = fs.readFileSync(path.join(root,'dsp/vocal-lexicon.js'),'utf8');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const ideas = ['dsp/doodle-jazz.js','studio-ideas.js','market-wave.js','ideas-ui.js','market-ui.js'].map(read).join('\n');
const core = fs.readFileSync(path.join(root, 'core.js'), 'utf8');
const capture=fs.readFileSync(path.join(root,'capture-tools.js'),'utf8');
const shaping = fs.readFileSync(path.join(root,'shaping.js'),'utf8');
const arrangement=fs.readFileSync(path.join(root,'arrangement.js'),'utf8');
const worker = dsp + '\n' + capture + '\n' + shaping + '\n' + arrangement + '\n' + core + `\nself.onmessage = e => { const {id, project, scope, options} = e.data; try { if(e.data.operation==='capture'){self.postMessage({id,audio:CaptureTools.analyse(e.data.samples,e.data.rate)});return;} const a = DotWave.render(project, scope, options.rate || 44100, options); const audio = {left:a.left,right:a.right,rate:a.rate,duration:a.duration,peak:a.peak,scale:a.scale}; self.postMessage({id,audio}, [audio.left.buffer,audio.right.buffer]); } catch(error) { self.postMessage({id,error:error.message}); } };`;
const inline = text => text.replace(/<\/script/gi, '<\\/script');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace('/* STUDIO_STYLE */', () => fs.readFileSync(path.join(root, 'studio.css'), 'utf8')+'\n'+fs.readFileSync(path.join(root,'wave-editor.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'woof.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'vocals.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'capture.css'),'utf8')+'\n'+read('ideas.css'))
  .replace('/* STUDIO_SCRIPTS */', () => inline(lexicon + '\n' + dsp + '\n' + capture + '\n' + shaping + '\n' + arrangement + '\n' + core + '\nwindow.DOT_WORKER_SOURCE=' + JSON.stringify(worker) + ';\n' + fs.readFileSync(path.join(root,'audio.js'),'utf8') + '\n' + fs.readFileSync(path.join(root,'storage.js'),'utf8') + '\n' + fs.readFileSync(path.join(root,'woof-ui.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'vocals-ui.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'capture-ui.js'),'utf8')+'\n'+ideas+'\n'+read('app.js')));
fs.mkdirSync(output, {recursive: true});
for (const filename of ['Dot-Wave-Classic.html','Third-party-notices.txt']) {
  const source = path.join(root, filename); if (fs.existsSync(source)) fs.copyFileSync(source, path.join(output,filename));
}
if(fs.existsSync(path.join(root,'sample-credits')))fs.cpSync(path.join(root,'sample-credits'),path.join(output,'Sample-credits'),{recursive:true});
const version=require('./package.json').version;
fs.writeFileSync(path.join(output, `Dot-Wave-Studio-${version}.html`), html);
console.log('Built Dot Wave Studio '+version+' ('+Buffer.byteLength(html)+' bytes).');
