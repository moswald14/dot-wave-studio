(function(root){
  'use strict';
  function sections(value=[],bars){
    if(!Number.isInteger(bars)||bars<1||bars>64||!Array.isArray(value)||value.length>16)throw new Error('Use up to sixteen song sections.');
    const result=value.map(v=>{if(!v||typeof v.id!=='string'||!/^[a-zA-Z0-9_-]{1,90}$/.test(v.id)||typeof v.name!=='string'||!v.name.trim()||v.name.trim().length>32||!Number.isInteger(v.from)||!Number.isInteger(v.to)||v.from<0||v.to<=v.from||v.to>bars)throw new Error('Give each section a name and a valid first and last measure.');return {id:v.id,name:v.name.trim(),from:v.from,to:v.to};}).sort((a,b)=>a.from-b.from);
    if(new Set(result.map(s=>s.id)).size!==result.length||result.some((s,i)=>i&&s.from<result[i-1].to))throw new Error('Keep section names in separate, non-overlapping measure ranges.');return result;
  }
  function range(project,id){const s=sections(project.sections,project.song.bars).find(s=>s.id===id);if(!s)throw new Error('Choose an existing song section.');const beats=project.song.meter.numerator*4/project.song.meter.denominator;return {...s,fromBeat:s.from*beats,toBeat:s.to*beats,beats:(s.to-s.from)*beats};}
  function suggestions(project){
    const bars=project.song.bars,beats=project.song.meter.numerator*4/project.song.meter.denominator,groups=new Map();
    for(const track of project.song.tracks)for(const clip of track.phrases||[]){const from=Math.floor(clip.start/beats+1e-8);if(from<bars&&!groups.has(from))groups.set(from,clip.name.split(' · ').at(-1).trim().slice(0,32));}
    if(!groups.size)return [];if(!groups.has(0))groups.set(0,'Opening');const points=[...groups.keys()].sort((a,b)=>a-b);if(points.length>16)throw new Error('There are many clip boundaries. Add the main sections by hand.');return sections(points.map((from,i)=>({id:'section-'+from,name:groups.get(from)||'Part '+(i+1),from,to:points[i+1]??bars})),bars);
  }
  function layout(width,bars,beats=4,zoom=1,fit=true){
    if(!Number.isFinite(width)||width<140||!Number.isInteger(bars)||bars<1||bars>64||!Number.isFinite(beats)||beats<=0)throw new Error('The timeline needs a valid size.');
    const barWidth=fit?(width-132)/bars:78*zoom;return {barWidth,beatWidth:barWidth/beats,width:130+barWidth*bars,labelEvery:Math.max(1,Math.ceil(23/barWidth))};
  }
  function soloSong(song,ids=[]){
    if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'||!song.tracks.some(t=>t.id===id)))throw new Error('Choose existing tracks to solo.');
    if(!ids.length)return song;return {...song,tracks:song.tracks.map(t=>({...t,mute:t.mute||!ids.includes(t.id)})),clips:song.clips.map(c=>({...c,mute:true})),audio:song.audio.map(c=>({...c,mute:true})),waves:song.waves.map(c=>({...c,mute:true}))};
  }
  const api={sections,range,suggestions,layout,soloSong};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ArrangementTools=api;
})(typeof globalThis!=='undefined'?globalThis:this);
