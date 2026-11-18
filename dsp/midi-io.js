(function(root){
 'use strict';
 // MIDI 1.0 Standard MIDI Files (MMA RP-001), RIFF WAVE PCM, and store-only ZIP.
 // All timing in this public API is in quarter-note beats, not seconds.
 const MAX_MIDI=4*1024*1024,MAX_NOTES=30000,MAX_WAV=100*1024*1024;
 function fail(message){throw new Error(message);}
 function number(value,min,max,label,integer=false){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))fail(`Invalid ${label}.`);return value;}
 function bytes(value){if(value instanceof ArrayBuffer)return new Uint8Array(value);if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);fail('Expected binary file data.');}
 function ascii(text){return Uint8Array.from(text,c=>c.charCodeAt(0));}
 function utf8(text){
  const out=[];for(const letter of String(text)){let code=letter.codePointAt(0);if(code>=0xd800&&code<=0xdfff)code=0xfffd;if(code<128)out.push(code);else if(code<2048)out.push(192|(code>>6),128|(code&63));else if(code<65536)out.push(224|(code>>12),128|((code>>6)&63),128|(code&63));else out.push(240|(code>>18),128|((code>>12)&63),128|((code>>6)&63),128|(code&63));}return Uint8Array.from(out);
 }
 function text(bytes){
  // New exports are UTF-8; old SMF names commonly use a single-byte encoding.
  let result='';for(let i=0;i<bytes.length;){const first=bytes[i++];if(first<128){result+=String.fromCharCode(first);continue;}let count=first>=0xc2&&first<=0xdf?1:first>=0xe0&&first<=0xef?2:first>=0xf0&&first<=0xf4?3:0,code=first&([0,31,15,7][count]);if(!count||i+count>bytes.length||Array.from(bytes.subarray(i,i+count)).some(x=>(x&0xc0)!==0x80)){result+=String.fromCharCode(first);continue;}for(let j=0;j<count;j++)code=(code<<6)|(bytes[i++]&63);result+=code<=0x10ffff?String.fromCodePoint(code):'�';}return result;
 }
 function join(parts){const length=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(length);let at=0;for(const part of parts){out.set(part,at);at+=part.length;}return out;}
 function be16(value){return Uint8Array.of(value>>8&255,value&255);}
 function be32(value){return Uint8Array.of(value>>>24,value>>>16&255,value>>>8&255,value&255);}
 function variable(value){number(value,0,0x0fffffff,'MIDI delta time',true);const out=[value&127];while(value=Math.floor(value/128))out.unshift((value&127)|128);return Uint8Array.from(out);}
 function meter(value){const m=value??{numerator:4,denominator:4};number(m.numerator,1,32,'meter numerator',true);if(![1,2,4,8,16,32].includes(m.denominator))fail('Invalid meter denominator.');return {numerator:m.numerator,denominator:m.denominator};}
 function meta(type,data){return join([Uint8Array.of(255,type),variable(data.length),data]);}
 function chunk(name,data){return join([ascii(name),be32(data.length),data]);}
 function encode(song,{format=1,ppq=480}={}){
  if(!song||typeof song!=='object')fail('Choose a song to export.');if(![0,1].includes(format))fail('Choose MIDI format 0 or 1.');number(ppq,1,32767,'MIDI resolution',true);
  const bpm=number(song.bpm,4,1000,'MIDI tempo'),m=meter(song.meter);
  if(!Array.isArray(song.tracks)||song.tracks.length>127)fail('A MIDI song can contain at most 127 tracks.');
  const duration=number(song.duration??0,0,1e6,'MIDI duration'),durationTick=Math.round(duration*ppq);number(durationTick,0,0x0fffffff,'MIDI duration ticks',true);
  const tempo=Math.max(1,Math.min(0xffffff,Math.round(60000000/bpm)));
  const conductor=[{tick:0,priority:0,data:meta(81,Uint8Array.of(tempo>>16&255,tempo>>8&255,tempo&255))},{tick:0,priority:0,data:meta(88,Uint8Array.of(m.numerator,Math.log2(m.denominator),24,8))}];
  let count=0,end=durationTick;
  const groups=song.tracks.map((track,index)=>{
   if(!track||!Array.isArray(track.notes))fail('Each MIDI track needs a note list.');number(track.channel,0,15,'MIDI channel',true);
   const name=String(track.name||`Track ${index+1}`).slice(0,120),events=[{tick:0,priority:0,data:meta(3,utf8(name))}];
   if(track.program!==undefined){number(track.program,0,127,'MIDI program',true);events.push({tick:0,priority:1,data:Uint8Array.of(0xc0|track.channel,track.program)});}
   for(const note of track.notes){
    if(++count>MAX_NOTES)fail('MIDI export is limited to 30,000 notes.');if(!note)fail('Invalid MIDI note.');
    number(note.start,0,1e6,'note position');number(note.duration,0.000001,1e6,'note duration');number(note.midi,0,127,'note number',true);number(note.velocity,0,1,'note velocity');
    if(note.velocity===0)continue;
    const start=Math.round(note.start*ppq),finish=Math.max(start+1,Math.round((note.start+note.duration)*ppq));number(finish,0,0x0fffffff,'note end tick',true);end=Math.max(end,finish);
    events.push({tick:start,priority:3,data:Uint8Array.of(0x90|track.channel,note.midi,Math.max(1,Math.round(note.velocity*127)))});
    events.push({tick:finish,priority:2,data:Uint8Array.of(0x80|track.channel,note.midi,0)});
   }
   return events;
  });
  function trackChunk(events){const sorted=events.slice().sort((a,b)=>a.tick-b.tick||a.priority-b.priority),parts=[];let previous=0;for(const event of sorted){parts.push(variable(event.tick-previous),event.data);previous=event.tick;}parts.push(variable(end-previous),Uint8Array.of(255,47,0));return chunk('MTrk',join(parts));}
  const tracks=format===0?[trackChunk([...conductor,...groups.flat()])]:[trackChunk(conductor),...groups.map(trackChunk)];
  const out=join([chunk('MThd',join([be16(format),be16(tracks.length),be16(ppq)])),...tracks]);if(out.length>MAX_MIDI)fail('Exported MIDI exceeds the 4 MB limit.');return out.buffer;
 }
 function decode(input){
  const data=bytes(input);if(data.length>MAX_MIDI)fail('Choose a MIDI file no larger than 4 MB.');if(data.length<14)fail('The MIDI file is incomplete.');
  const view=new DataView(data.buffer,data.byteOffset,data.byteLength),warnings=new Set(),tempoEvents=[],meterEvents=[],tracks=[];let offset=0,noteCount=0,order=0,maxTick=0;
  const tag=at=>String.fromCharCode(...data.subarray(at,at+4));
  if(tag(0)!=='MThd')fail('Choose a Standard MIDI File (.mid).');const headerSize=view.getUint32(4);if(headerSize<6||headerSize+8>data.length)fail('Invalid MIDI header length.');
  const format=view.getUint16(8),declared=view.getUint16(10),division=view.getUint16(12);
  if(format===2)fail('MIDI format 2 contains separate sequences. Export format 0 or 1 instead.');if(format!==0&&format!==1)fail('Unsupported MIDI file format.');if(division&0x8000)fail('SMPTE-timed MIDI is unsupported. Export a beat-timed MIDI file instead.');if(!division||!declared||declared>128||(format===0&&declared!==1))fail('Invalid MIDI track count or time division.');offset=8+headerSize;
  for(let trackIndex=0;trackIndex<declared;trackIndex++){
   if(offset+8>data.length||tag(offset)!=='MTrk')fail('A MIDI track chunk is missing.');const size=view.getUint32(offset+4),end=offset+8+size;if(end>data.length)fail('The MIDI track is truncated.');let pos=offset+8,tick=0,running=0,name='',ended=false;const channels=new Map(),programs=new Map(),pending=new Map();
   function read(){if(pos>=end)fail('The MIDI event is truncated.');return data[pos++];}
   function vlq(){let value=0;for(let i=0;i<4;i++){const valueByte=read();value=value*128+(valueByte&127);if(!(valueByte&128))return value;}fail('Invalid MIDI variable-length number.');}
   function take(length){if(length<0||pos+length>end)fail('The MIDI event data is truncated.');const result=data.subarray(pos,pos+length);pos+=length;return result;}
   function lane(channel){if(!channels.has(channel))channels.set(channel,{name:'',channel,program:programs.get(channel)??0,notes:[]});return channels.get(channel);}
   function close(channel,midi,at){const key=channel+':'+midi,queue=pending.get(key);if(!queue?.length){warnings.add('Unmatched note-off events were ignored.');return;}const item=queue.shift();if(!queue.length)pending.delete(key);const length=Math.max(1,at-item.tick);item.track.notes.push({start:item.tick/division,duration:length/division,midi,velocity:item.velocity/127});}
   while(pos<end){
    tick+=vlq();if(!Number.isSafeInteger(tick)||tick>0x7fffffff)fail('The MIDI timeline is too long.');let status=read();
    if(status<128){if(!running)fail('MIDI running status appears without a previous channel event.');pos--;status=running;}
    else if(status<240)running=status;else running=0;
    if(status===255){
     const type=read(),length=vlq(),payload=take(length);
     if(type===47){if(length!==0)fail('Invalid MIDI end-of-track event.');ended=true;break;}
     if(type===3){if(!name)name=text(payload).replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,120);}
     else if(type===81){if(length!==3)fail('Invalid MIDI tempo event.');const tempo=payload[0]*65536+payload[1]*256+payload[2];if(!tempo)fail('MIDI tempo cannot be zero.');tempoEvents.push({tick,order:order++,tempo});}
     else if(type===88){if(length!==4||!payload[0]||payload[1]>5)fail('Invalid MIDI time signature.');meterEvents.push({tick,order:order++,numerator:payload[0],denominator:2**payload[1]});}
     continue;
    }
    if(status===240||status===247){take(vlq());warnings.add('System-exclusive instrument data was skipped.');continue;}
    if(status>=240)fail('Unsupported system message inside a MIDI file.');
    const kind=status>>4,channel=status&15,a=read(),b=kind===12||kind===13?null:read();if(a>=128||(b!==null&&b>=128))fail('Invalid MIDI channel data byte.');
    if(kind===9&&b>0){
     if(++noteCount>MAX_NOTES)fail('MIDI import is limited to 30,000 notes.');const key=channel+':'+a,queue=pending.get(key)||[];queue.push({tick,velocity:b,track:lane(channel)});pending.set(key,queue);
    }else if(kind===8||(kind===9&&b===0))close(channel,a,tick);
    else if(kind===12){if(programs.has(channel)&&programs.get(channel)!==a)warnings.add('Program changes within a track were reduced to its first instrument.');if(!programs.has(channel)){programs.set(channel,a);if(channels.has(channel)){if(channels.get(channel).notes.length||[...pending.values()].some(q=>q.some(n=>n.track.channel===channel)))warnings.add('Program changes after notes began were reduced to one instrument.');else channels.get(channel).program=a;}}}
    else warnings.add('Controller, pitch-bend and pressure data were skipped; note timing and velocity were kept.');
   }
   if(!ended)warnings.add('A track had no end marker; its chunk boundary was used.');
   if(pending.size){warnings.add('Notes without note-off events were ended at their track boundary.');for(const [key,queue]of pending){const [channel,midi]=key.split(':').map(Number);while(queue.length)close(channel,midi,Math.max(tick,queue[0].tick+1));}}
   maxTick=Math.max(maxTick,tick);for(const record of channels.values()){record.name=(name||`Track ${trackIndex+1}`)+(channels.size>1?` · Ch ${record.channel+1}`:'');record.notes.sort((a,b)=>a.start-b.start||a.midi-b.midi);for(const note of record.notes)maxTick=Math.max(maxTick,Math.round((note.start+note.duration)*division));if(record.notes.length)tracks.push(record);}
   offset=end;
  }
  tempoEvents.sort((a,b)=>a.tick-b.tick||a.order-b.order);meterEvents.sort((a,b)=>a.tick-b.tick||a.order-b.order);
  const firstTempo=tempoEvents[0]?.tempo??500000,firstMeter=meterEvents[0]??{numerator:4,denominator:4};
  if(tempoEvents.some(event=>event.tempo!==firstTempo)||tempoEvents[0]?.tick>0)warnings.add('Tempo changes were reduced to the first tempo; note positions remain in beats.');
  if(meterEvents.some(event=>event.numerator!==firstMeter.numerator||event.denominator!==firstMeter.denominator)||meterEvents[0]?.tick>0)warnings.add('Time-signature changes were reduced to the first meter.');
  return {bpm:60000000/firstTempo,meter:{numerator:firstMeter.numerator,denominator:firstMeter.denominator},tracks,duration:maxTick/division,warnings:[...warnings]};
 }
 function encodeWav(input,rate=48000){
  number(rate,8000,192000,'WAV sample rate',true);const left=ArrayBuffer.isView(input)||Array.isArray(input)?input:input?.left,right=input?.right;
  if(!left||!Number.isInteger(left.length)||left.length<1||left.length>rate*600||(right&&right.length!==left.length))fail('Invalid WAV audio channels.');const channels=right?2:1,dataSize=left.length*channels*2,buffer=new ArrayBuffer(44+dataSize),view=new DataView(buffer);
  const write=(at,str)=>{for(let i=0;i<str.length;i++)view.setUint8(at+i,str.charCodeAt(i));};write(0,'RIFF');view.setUint32(4,36+dataSize,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,rate,true);view.setUint32(28,rate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,dataSize,true);
  let at=44;for(let i=0;i<left.length;i++)for(const data of right?[left,right]:[left]){if(typeof data[i]!=='number'||!Number.isFinite(data[i]))fail('Audio contains an invalid sample.');const sample=Math.max(-1,Math.min(1,data[i]));view.setInt16(at,Math.round(sample*(sample<0?32768:32767)),true);at+=2;}return buffer;
 }
 function decodeWav(input){
  const data=bytes(input);if(data.length>MAX_WAV)fail('Choose a WAV file no larger than 100 MB.');if(data.length<12)fail('The WAV file is incomplete.');const view=new DataView(data.buffer,data.byteOffset,data.byteLength),tag=at=>String.fromCharCode(...data.subarray(at,at+4));
  if(tag(0)!=='RIFF'||tag(8)!=='WAVE')fail('Choose an uncompressed RIFF WAV file.');const end=view.getUint32(4,true)+8;if(end>data.length||end<12)fail('The WAV file is truncated.');let fmt=null,audio=null;
  for(let pos=12;pos+8<=end;){const type=tag(pos),length=view.getUint32(pos+4,true),start=pos+8,next=start+length;if(next>end)fail('A WAV chunk is truncated.');if(type==='fmt '){if(fmt)fail('The WAV file contains conflicting format chunks.');if(length<16)fail('The WAV format chunk is incomplete.');let format=view.getUint16(start,true);const channels=view.getUint16(start+2,true),rate=view.getUint32(start+4,true),align=view.getUint16(start+12,true),bits=view.getUint16(start+14,true);if(format===0xfffe){if(length<40||view.getUint16(start+16,true)<22)fail('The extended WAV format is incomplete.');const suffix=[0,0,0,0,16,0,128,0,0,170,0,56,155,113];if(!suffix.every((v,i)=>data[start+26+i]===v))fail('Unsupported extended WAV codec.');format=view.getUint16(start+24,true);}fmt={format,channels,rate,align,bits};}else if(type==='data'){if(audio)fail('Multiple WAV data chunks are unsupported.');audio={start,length};}pos=next+(length&1);}
  if(!fmt||!audio)fail('The WAV file needs format and audio-data chunks.');const {format,channels,rate,align,bits}=fmt;number(channels,1,8,'WAV channel count',true);number(rate,8000,192000,'WAV sample rate',true);
  if(!((format===1&&[8,16,24,32].includes(bits))||(format===3&&bits===32)))fail('Import PCM 8/16/24/32-bit or 32-bit float WAV audio.');if(align!==channels*bits/8||audio.length%align)fail('Invalid WAV frame alignment.');const frames=audio.length/align;if(frames<1||frames>rate*60)fail('Import WAV clips of up to 60 seconds.');const samples=new Float32Array(frames),width=bits/8;
  for(let frame=0;frame<frames;frame++){let sum=0;for(let ch=0;ch<channels;ch++){const at=audio.start+frame*align+ch*width;let sample;if(format===3)sample=view.getFloat32(at,true);else if(bits===8)sample=(view.getUint8(at)-128)/128;else if(bits===16)sample=view.getInt16(at,true)/32768;else if(bits===24){let n=data[at]|data[at+1]<<8|data[at+2]<<16;if(n&0x800000)n-=0x1000000;sample=n/8388608;}else sample=view.getInt32(at,true)/2147483648;if(!Number.isFinite(sample))fail('The WAV file contains invalid floating-point samples.');sum+=Math.max(-1,Math.min(1,sample));}samples[frame]=sum/channels;}
  return {samples,rate,channels,duration:frames/rate};
 }
 const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
 function crc32(data){let crc=0xffffffff;for(const n of bytes(data))crc=crcTable[(crc^n)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
 function zipStore(files){
  if(!Array.isArray(files)||files.length<1||files.length>256)fail('A handoff ZIP needs one to 256 files.');const local=[],central=[],names=new Set();let offset=0,centralSize=0;
  for(const file of files){
   if(!file||typeof file.name!=='string'||!file.name||file.name.startsWith('/')||file.name.includes('\\')||file.name.includes('\0')||file.name.split('/').some(p=>p==='..'||p==='.'||!p)||names.has(file.name))fail('Invalid or duplicate ZIP filename.');names.add(file.name);const name=utf8(file.name);if(name.length>512)fail('ZIP filenames must be short.');const data=typeof file.data==='string'?utf8(file.data):bytes(file.data);if(data.length>512*1024*1024||offset+data.length>1024*1024*1024)fail('The handoff ZIP is too large.');const crc=crc32(data),head=new Uint8Array(30+name.length),v=new DataView(head.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);head.set(name,30);local.push(head,data);
   const record=new Uint8Array(46+name.length),c=new DataView(record.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);record.set(name,46);central.push(record);centralSize+=record.length;offset+=head.length+data.length;
  }
  const end=new Uint8Array(22),view=new DataView(end.buffer);view.setUint32(0,0x06054b50,true);view.setUint16(8,files.length,true);view.setUint16(10,files.length,true);view.setUint32(12,centralSize,true);view.setUint32(16,offset,true);return join([...local,...central,end]);
 }
 const api={encode,decode,encodeWav,decodeWav,zipStore,crc32};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MidiIO=api;
})(typeof globalThis!=='undefined'?globalThis:this);
