(function(root){
 'use strict';
 // RBJ shelving filters. Shared by drawn cycles, collision PCM and the live amp.
 // This input/output processor can also accept a future guitar voice.
 function shelf(rate,hz,db,high=false){
  const A=10**(db/40),w=2*Math.PI*Math.min(hz,rate*.45)/rate,c=Math.cos(w),s=Math.sin(w),alpha=s/2*Math.SQRT2,beta=2*Math.sqrt(A)*alpha;
  const b=high?[A*((A+1)+(A-1)*c+beta),-2*A*((A-1)+(A+1)*c),A*((A+1)+(A-1)*c-beta)]:[A*((A+1)-(A-1)*c+beta),2*A*((A-1)-(A+1)*c),A*((A+1)-(A-1)*c-beta)];
  const a=high?[(A+1)-(A-1)*c+beta,2*((A-1)-(A+1)*c),(A+1)-(A-1)*c-beta]:[(A+1)+(A-1)*c+beta,-2*((A-1)+(A+1)*c),(A+1)+(A-1)*c-beta];
  let x1=0,x2=0,y1=0,y2=0;return x=>{const y=(b[0]*x+b[1]*x1+b[2]*x2-a[1]*y1-a[2]*y2)/a[0];x2=x1;x1=x;y2=y1;y1=y;return y;};
 }
 function processor(rate,amp){if(!amp?.enabled||!(amp.low||amp.high))return x=>x;const low=shelf(rate,250,amp.low||0),high=shelf(rate,2500,amp.high||0,true);return x=>high(low(x));}
 function cycle(table,frequency,amp){const process=processor(table.length*frequency,amp),out=new Float64Array(table.length);for(let pass=0;pass<16;pass++)for(let i=0;i<table.length;i++)out[i]=process(table[i]);return out;}
 function connect(context,input,destination,amp){const nodes=[];let node=input;for(const [type,hz,db]of [['lowshelf',250,amp.low||0],['highshelf',2500,amp.high||0]]){if(!db)continue;const filter=context.createBiquadFilter();filter.type=type;filter.frequency.value=Math.min(hz,context.sampleRate*.45);filter.gain.value=db;node.connect(filter);node=filter;nodes.push(filter);}node.connect(destination);return nodes;}
 const api={processor,cycle,connect};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AmpTone=api;
})(typeof globalThis!=='undefined'?globalThis:this);
