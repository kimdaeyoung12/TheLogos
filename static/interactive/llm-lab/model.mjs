// A deterministic, untrained, one-head educational Transformer.
export const vocab=['나는','오늘','바다','를','본다','.'];
export const E=[[.8,-.2,.1,.4],[.1,.7,-.3,.2],[-.2,.3,.9,.1],[.2,-.4,.3,.8],[.5,.1,-.2,.6],[-.3,.4,.2,-.5]];
export const WQ=[[.5,-.2],[.1,.6],[-.3,.4],[.7,.1]];
export const WK=[[.4,.3],[-.2,.5],[.6,-.1],[.1,.7]];
export const WV=[[.6,.1,-.2,.3],[.2,.5,.1,-.4],[-.1,.3,.7,.2],[.4,-.2,.2,.6]];
export const W1=[[.2,-.3,.4,.1,.5,-.2],[.6,.1,-.2,.3,-.1,.4],[-.4,.5,.2,-.1,.3,.6],[.3,.2,-.5,.6,.1,-.3]];
export const W2=[[.3,-.1,.2,.4],[-.2,.5,.1,.3],[.4,.2,-.3,.1],[.1,-.4,.6,.2],[.5,.1,.2,-.2],[-.1,.3,.4,.5]];
export const Wout=[[.2,-.3,.1,.5,-.2,.4],[-.1,.4,.2,-.3,.6,.1],[.3,.1,-.4,.7,.2,-.2],[.1,-.2,.5,.3,.4,.6]];
export const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export const project=(x,w)=>w[0].map((_,j)=>dot(x,w.map(row=>row[j])));
export const softmax=a=>{const m=Math.max(...a), e=a.map(x=>Math.exp(x-m)),sum=e.reduce((a,b)=>a+b,0);return e.map(x=>x/sum)};
export const position=t=>[Math.sin(t),Math.cos(t),Math.sin(t/10),Math.cos(t/10)].map(x=>x*.1);
export const embed=(id,t)=>E[id].map((x,j)=>x+position(t)[j]);
function finish(x,q,keys,values){
 const scores=keys.map(k=>dot(q,k)/Math.sqrt(2));
 const a=softmax(scores),o=values[0].map((_,d)=>values.reduce((s,v,j)=>s+a[j]*v[d],0));
 const r=x.map((v,d)=>v+o[d]),hidden=project(r,W1).map(v=>Math.max(0,v));
 const f=project(hidden,W2),z=r.map((v,d)=>v+f[d]);
 const logits=project(z,Wout),p=softmax(logits);
 return {scores,a,o,r,hidden,f,z,logits,p};
}
export function forward(ids){
 const x=ids.map(embed),q=x.map(v=>project(v,WQ)),k=x.map(v=>project(v,WK)),v=x.map(v=>project(v,WV));
 const rows=x.map((row,t)=>finish(row,q[t],k.slice(0,t+1),v.slice(0,t+1)));
 return {ids,x,q,k,v,rows};
}
export function decodeCached(cache,id){
 const t=cache.ids.length,x=embed(id,t),q=project(x,WQ),k=project(x,WK),v=project(x,WV);
 return {id,x,q,k,v,...finish(x,q,[...cache.k,k],[...cache.v,v])};
}
export const argmax=p=>p.indexOf(Math.max(...p));
