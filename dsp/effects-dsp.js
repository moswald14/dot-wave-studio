(function(root){
 'use strict';
 const specs={
  echo:{label:'Echo',icon:'▥',mix:[.28,0,.8],time:[.24,.05,.75],feedback:[.35,0,.65]},
  chorus:{label:'Chorus',icon:'≈',mix:[.4,0,.8],rate:[.8,.1,5],depth:[.003,.0005,.006]},
  wah:{label:'Wah-wah',icon:'∿',mix:[.6,0,1],rate:[1.2,.1,4],frequency:[1100,400,3000]},
  reverb:{label:'Reverb',icon:'▦',mix:[.35,0,.8],size:[1,.5,2],decay:[.65,.25,.8]}
 };
 function validate(stack=[]){if(!Array.isArray(stack)||stack.length>6)throw new Error('Use up to six effects.');return Array.from(stack,v=>{if(!v||!Object.hasOwn(specs,v.type)||v.enabled!==undefined&&typeof v.enabled!=='boolean')throw new Error('Invalid effect module.');const out={type:v.type,enabled:v.enabled??true};for(const [k,limits]of Object.entries(specs[v.type]))if(Array.isArray(limits)){const x=v[k]??limits[0];if(typeof x!=='number'||!Number.isFinite(x)||x<limits[1]||x>limits[2])throw new Error('Invalid '+v.type+' '+k+'.');out[k]=x;}return out;});}
 function tail(stack=[]){return Math.min(6,validate(stack).filter(e=>e.enabled&&e.mix>0).reduce((s,e)=>s+(e.type==='echo'?e.time*(1+Math.ceil(Math.log(.001)/Math.log(Math.max(.01,e.feedback)))):e.type==='reverb'?.0437*e.size*(1+Math.ceil(Math.log(.001)/Math.log(e.decay))):e.type==='chorus'?.022:0),0));}
 function process(input,rate,stack=[],options={}){
  const list=validate(stack);if(!Number.isInteger(rate)||rate<8000||rate>192000||!input||input.length>rate*480)throw new Error('Invalid effect audio.');
  let data=new Float32Array(input.length+(options.tail?Math.ceil(tail(list)*rate):0));for(let i=0;i<input.length;i++){if(!Number.isFinite(input[i]))throw new Error('Invalid effect sample.');data[i]=input[i];}
  for(const e of list){if(!e.enabled||e.mix===0)continue;const out=new Float32Array(data.length);
   if(e.type==='echo'||e.type==='reverb'){
    const delays=e.type==='echo'?[e.time]:[.0297,.0371,.0411,.0437].map(t=>t*e.size),feedback=e.type==='echo'?e.feedback:e.decay;
    for(const seconds of delays){const n=Math.max(1,Math.round(seconds*rate)),ring=new Float32Array(n);for(let i=0;i<data.length;i++){const j=i%n,wet=ring[j];ring[j]=data[i]+wet*feedback;out[i]+=wet*(1-feedback)/delays.length;}}
    for(let i=0;i<data.length;i++)out[i]=data[i]*(1-e.mix)+out[i]*e.mix;
   }else if(e.type==='chorus'){
    for(let i=0;i<data.length;i++){const at=i-(.014+e.depth*Math.sin(2*Math.PI*e.rate*i/rate))*rate,j=Math.floor(at),f=at-j,wet=j<0?0:data[j]*(1-f)+(data[j+1]||0)*f;out[i]=data[i]*(1-e.mix)+wet*e.mix;}
   }else{
    let x1=0,x2=0,y1=0,y2=0,b0=0,b2=0,a1=0,a2=0;
    for(let i=0;i<data.length;i++){if(i%16===0){const frequency=Math.min(rate*.4,e.frequency*2**(.9*Math.sin(2*Math.PI*e.rate*i/rate))),w=2*Math.PI*frequency/rate,alpha=Math.sin(w)/5,a0=1+alpha;b0=alpha/a0;b2=-b0;a1=-2*Math.cos(w)/a0;a2=(1-alpha)/a0;}const x=data[i],y=b0*x+b2*x2-a1*y1-a2*y2;x2=x1;x1=x;y2=y1;y1=y;out[i]=x*(1-e.mix)+y*e.mix;}
   }
   data=out;
  }
  return data;
 }
 // The live graph uses the same delay, modulation and feedback settings as export.
 function create(context,stack,destination){
  const list=validate(stack),nodes=[],oscillators=[];const gain=value=>{const n=context.createGain();n.gain.value=value;nodes.push(n);return n;};const input=gain(1);let previous=input;
  for(const e of list){if(!e.enabled||e.mix===0)continue;const sum=gain(1),dry=gain(1-e.mix),wet=gain(e.mix);previous.connect(dry);dry.connect(sum);wet.connect(sum);
   if(e.type==='echo'||e.type==='reverb'){
    const delays=e.type==='echo'?[e.time]:[.0297,.0371,.0411,.0437].map(t=>t*e.size),feedback=e.type==='echo'?e.feedback:e.decay;
    for(const seconds of delays){const d=context.createDelay(2),fb=gain(feedback),level=gain((1-feedback)/delays.length);nodes.push(d);d.delayTime.value=seconds;previous.connect(d);d.connect(fb);fb.connect(d);d.connect(level);level.connect(wet);}
   }else if(e.type==='chorus'){
    const d=context.createDelay(.1),lfo=context.createOscillator(),depth=gain(e.depth);nodes.push(d,lfo);d.delayTime.value=.014;lfo.frequency.value=e.rate;lfo.connect(depth);depth.connect(d.delayTime);previous.connect(d);d.connect(wet);lfo.start();oscillators.push(lfo);
   }else{
    const f=context.createBiquadFilter(),lfo=context.createOscillator(),depth=gain(1080);nodes.push(f,lfo);f.type='bandpass';f.frequency.value=e.frequency;f.Q.value=2.5;lfo.frequency.value=e.rate;lfo.connect(depth);depth.connect(f.detune);previous.connect(f);f.connect(wet);lfo.start();oscillators.push(lfo);
   }previous=sum;
  }
  previous.connect(destination);let disposed=false;return {input,dispose(){if(disposed)return;disposed=true;for(const o of oscillators){try{o.stop();}catch{}}for(const n of nodes)n.disconnect();}};
 }
 const api={specs,validate,tail,process,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EffectsDSP=api;
})(typeof globalThis!=='undefined'?globalThis:this);
