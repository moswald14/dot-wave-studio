(function(root) {
  'use strict';
  const N=32,EPS=1e-8;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),wrap=i=>(i%N+N)%N;
  function check(points){
    if(!Array.isArray(points)||points.length!==N||points.some(v=>!Number.isFinite(v)||v < -1||v > 1))throw new Error('A shape needs 32 finite dots between −1 and +1.');
    return [...points];
  }
  function indices(selection){
    if(!selection?.length)return Array.from({length:N},(_,i)=>i);
    if(!Array.isArray(selection)||selection.some(i=>!Number.isInteger(i)||i<0||i>=N))throw new Error('Select dots inside this cycle.');
    return [...new Set(selection)];
  }
  function landmarks(points){
    const p=check(points),peaks=[],troughs=[],crossings=[],groups=[];
    const start=p.findIndex((v,i)=>Math.abs(v-p[wrap(i-1)])>EPS);
    if(start>=0){
      let used=0;
      while(used<N){let length=1;const at=wrap(start+used),value=p[at];while(used+length<N&&Math.abs(p[wrap(at+length)]-value)<=EPS)length++;
        groups.push({index:wrap(at+Math.floor((length-1)/2)),value});used+=length;}
      groups.forEach((g,i)=>{const before=groups[(i+groups.length-1)%groups.length].value,after=groups[(i+1)%groups.length].value;
        if(g.value>before+EPS&&g.value>after+EPS)peaks.push(g.index);
        if(g.value<before-EPS&&g.value<after-EPS)troughs.push(g.index);
      });
      for(let i=0;i<N;i++){
        const a=p[i],b=p[wrap(i+1)];
        if(a*b < -EPS)crossings.push({at:i-a/(b-a),from:i,to:wrap(i+1)});
        else if(Math.abs(a)<=EPS&&Math.abs(b)>EPS){let j=1;while(j<N&&Math.abs(p[wrap(i-j)])<=EPS)j++;if(p[wrap(i-j)]*b<0)crossings.push({at:i,from:wrap(i-1),to:wrap(i+1)});}
      }
    }
    const gradients=p.map((v,i)=>Math.abs(p[wrap(i+1)]-v)),largest=Math.max(...gradients);
    const steep=gradients.flatMap((v,i)=>v>EPS&&v>=gradients[wrap(i-1)]-EPS&&v>=gradients[wrap(i+1)]-EPS&&v>largest*.7?[i]:[]);
    const edges=[...new Set((crossings.length?crossings.flatMap(c=>[wrap(Math.floor(c.at)-1),wrap(Math.floor(c.at)),wrap(Math.floor(c.at)+1)]):steep.flatMap(i=>[i,wrap(i+1)])))];
    return {peaks,troughs,crossings,edges,high:Math.max(...p),low:Math.min(...p),mean:p.reduce((s,v)=>s+v,0)/N,maxEdge:largest};
  }
  function arc(from,to){const low=Math.min(from,to),high=Math.max(from,to);if(!Number.isInteger(low)||low<0||high>=N)throw new Error('Select an arc within the cycle.');return Array.from({length:high-low+1},(_,i)=>low+i);}
  function arcBetween(from,to){if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||from>=N||to<0||to>=N)throw new Error('Choose arc endpoints from dot one to 32.');return Array.from({length:wrap(to-from)+1},(_,i)=>wrap(from+i));}
  function displayArc(from,to){if(![from,to].every(i=>Number.isInteger(i)&&i>=0&&i<=N))throw new Error('Choose points inside this cycle.');return [...new Set(Array.from({length:Math.abs(to-from)+1},(_,i)=>wrap(Math.min(from,to)+i)))];}
  function drawClosed(points,from,to){
    const out=check(points);displayArc(from.slot,to.slot);
    for(const value of [from.value,to.value])if(!Number.isFinite(value)||Math.abs(value)>1)throw new Error('Keep the height inside this wave.');
    for(let slot=Math.min(from.slot,to.slot);slot<=Math.max(from.slot,to.slot);slot++){const t=from.slot===to.slot?1:(slot-from.slot)/(to.slot-from.slot);out[wrap(slot)]=from.value+(to.value-from.value)*t;}
    return out;
  }
  function brushWeight(index,center,reach){const d=Math.min(wrap(index-center),wrap(center-index));return d<=reach?(1+Math.cos(Math.PI*d/(reach+1)))/2:0;}
  function reachValue(reach){if(!Number.isInteger(reach)||reach<0||reach>8)throw new Error('Choose a brush reach from zero to eight dots.');return reach;}
  function bump(points,center,target,reach=2){const p=check(points);indices([center]);reachValue(reach);if(!Number.isFinite(target)||Math.abs(target)>1)throw new Error('Keep the height between −1 and +1.');return p.map((v,i)=>{const w=brushWeight(i,center,reach);return clamp(v+(target-v)*w,-1,1);});}
  function grab(points,selection,delta,reach=0){const p=check(points),chosen=indices(selection);reachValue(reach);if(!Number.isFinite(delta))throw new Error('Choose a finite height.');return p.map((v,i)=>clamp(v+delta*Math.max(...chosen.map(c=>brushWeight(i,c,reach))),-1,1));}
  function edge(points,center,reach=2){const p=check(points);indices([center]);reachValue(reach);const r=Math.max(1,reach),left=p[wrap(center-r-1)],right=p[wrap(center+r+1)],out=[...p];out[center]=0;
    for(let d=1;d<=r;d++){out[wrap(center-d)]=left*d/(r+1);out[wrap(center+d)]=right*d/(r+1);}return out;}
  function levels(points,{peak,trough}={}){
    let p=check(points);for(const v of [peak,trough])if(v!==undefined&&(!Number.isFinite(v)||v<0||v>1))throw new Error('Peaks and troughs stay between zero and full height.');
    if(peak!==undefined){let high=Math.max(...p,0);if(high<EPS&&peak>0){p=bump(p,8,peak,4);high=Math.max(...p,0);}if(high>EPS)p=p.map(v=>v>0?v/high*peak:v);}
    if(trough!==undefined){let low=Math.max(...p.map(v=>-v),0);if(low<EPS&&trough>0){p=bump(p,24,-trough,4);low=Math.max(...p.map(v=>-v),0);}if(low>EPS)p=p.map(v=>v<0?v/low*trough:v);}
    return p.map(v=>clamp(v,-1,1));
  }
  function transform(points,selection,operation){
    const p=check(points),chosen=indices(selection),out=[...p],mean=chosen.reduce((s,i)=>s+p[i],0)/chosen.length;
    if(['line','curve'].includes(operation)){
      if(chosen.length<2||chosen.length===N||chosen.some((i,k)=>k&&wrap(i-chosen[k-1])!==1))throw new Error('Select a continuous arc of two to 31 dots first.');
      const first=p[chosen[0]],last=p[chosen.at(-1)];chosen.forEach((index,k)=>{if(k===0){out[index]=first;return;}if(k===chosen.length-1){out[index]=last;return;}let t=k/(chosen.length-1);if(operation==='curve')t=(1-Math.cos(Math.PI*t))/2;out[index]=first+(last-first)*t;});
    }else for(const i of chosen){const smooth=(p[wrap(i-1)]+p[i]*2+p[wrap(i+1)])/4;
      if(operation==='round')out[i]=smooth;
      else if(operation==='sharpen')out[i]=clamp(p[i]+(p[i]-smooth)*.9,-1,1);
      else if(operation==='flatten')out[i]=mean;
      else if(operation==='zero')out[i]=0;
      else if(operation==='invert')out[i]=-p[i];
      else if(operation==='center')out[i]=p[i]-mean;
      else throw new Error('Choose a shaping tool.');
    }
    if(operation==='center'){const max=Math.max(1,...out.map(Math.abs));return out.map(v=>v/max);}
    return out.map(v=>clamp(v,-1,1));
  }
  function shift(points,delta){const p=check(points);if(!Number.isInteger(delta))throw new Error('Shift by whole dots.');return p.map((_,i)=>p[wrap(i-delta)]);}
  function pins(value=[]){if(!Array.isArray(value)||value.some(i=>!Number.isInteger(i)||i<0||i>=N))throw new Error('Pin existing waveform dots.');return [...new Set(value)].sort((a,b)=>a-b);}
  function protect(before,after,locked=[],strength=1){const a=check(before),b=check(after),fixed=pins(locked);if(!Number.isFinite(strength)||strength<0||strength>1)throw new Error('Choose a strength between zero and one.');return a.map((v,i)=>fixed.includes(i)?v:clamp(v+(b[i]-v)*strength,-1,1));}
  function setPoint(points,index,value,locked=[]){const p=check(points);indices([index]);if(!Number.isFinite(value)||Math.abs(value)>1)throw new Error('Keep the height between −1 and +1.');if(pins(locked).includes(index))throw new Error('Unpin this point to change its height.');p[index]=value;return p;}
  function snap(value,step=0){if(!Number.isFinite(value)||!Number.isFinite(step)||step<0||step>1)throw new Error('Choose a valid drawing grid.');return clamp(step?Math.round(value/step)*step:value,-1,1);}
  function move(points,selection,delta,reach=0,locked=[]){
    const p=check(points),chosen=indices(selection),fixed=pins(locked);reachValue(reach);if(!Number.isFinite(delta))throw new Error('Choose a finite movement.');
    const weights=p.map((_,i)=>fixed.includes(i)?0:Math.max(...chosen.map(c=>brushWeight(i,c,reach))));let low=-Infinity,high=Infinity;
    weights.forEach((w,i)=>{if(w>EPS){low=Math.max(low,(-1-p[i])/w);high=Math.min(high,(1-p[i])/w);}});const amount=clamp(delta,low,high);return p.map((v,i)=>clamp(v+weights[i]*amount,-1,1));
  }
  function adjust(points,selection,{gain=1,offset=0,bend=0}={},locked=[]){
    const p=check(points),chosen=indices(selection);if(!Number.isFinite(gain)||gain<0||gain>4||!Number.isFinite(offset)||Math.abs(offset)>2||!Number.isFinite(bend)||Math.abs(bend)>1)throw new Error('Choose a bounded height, move or bend amount.');
    if(bend&&(chosen.length<3||chosen.length===N||chosen.some((v,i)=>i&&wrap(v-chosen[i-1])!==1)))throw new Error('Bend a continuous arc of three to 31 dots.');
    const out=[...p];chosen.forEach((i,k)=>{const arc=bend&&k&&k<chosen.length-1?bend*Math.sin(Math.PI*k/(chosen.length-1)):0;out[i]=clamp(p[i]*gain+offset+arc,-1,1);});return protect(p,out,locked);
  }
  function mirror(points,op='same',locked=[]){const p=check(points),out=[...p];if(!['same','opposite','reverse','repeat'].includes(op))throw new Error('Choose a mirror operation.');
    if(op==='reverse')for(let i=0;i<N;i++)out[i]=p[wrap(-i)];
    else if(op==='repeat')for(let i=0;i<N/2;i++)out[i+N/2]=p[i];
    else for(let i=1;i<N/2;i++)out[N-i]=(op==='opposite'?-1:1)*p[i];
    return protect(p,out,locked);
  }
  function toggleSelection(selection,index){indices([index]);if(!Array.isArray(selection))throw new Error('Choose waveform dots.');if(selection.length)indices(selection);const chosen=[...new Set(selection)],next=chosen.includes(index)?chosen.filter(i=>i!==index):[...chosen,index];return next.length?next:[index];}
  const api={N,check,indices,landmarks,arc,arcBetween,displayArc,drawClosed,bump,grab,edge,levels,transform,shift,pins,protect,setPoint,snap,move,adjust,mirror,toggleSelection};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WaveShape=api;
})(typeof globalThis!=='undefined'?globalThis:this);
