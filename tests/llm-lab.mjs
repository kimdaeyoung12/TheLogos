import test from 'node:test';
import assert from 'node:assert/strict';
import {forward,decodeCached,argmax} from '../static/interactive/llm-lab/model.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
test('causal attention includes self, normalizes allowed positions and never accesses future tokens',()=>{
 const m=forward([0,1,2,3]);
 m.rows.forEach((r,t)=>{assert.equal(r.a.length,t+1);close(r.a.reduce((a,b)=>a+b,0),1);assert.ok(r.a[t]>0);close(r.p.reduce((a,b)=>a+b,0),1)});
 const changed=forward([0,1,5,4]);
 for(let t=0;t<2;t++)m.rows[t].z.forEach((v,j)=>close(v,changed.rows[t].z[j]));
});
test('cached one-token decode equals full causal recomputation over multiple sequence lengths',()=>{
 let ids=[0,1,2];
 for(let n=0;n<5;n++){
  const cache=forward(ids),before=JSON.stringify(cache),id=argmax(cache.rows.at(-1).p);
  const d=decodeCached(cache,id),full=forward([...ids,id]);
  for(const key of ['scores','a','o','r','hidden','f','z','logits','p'])d[key].forEach((v,j)=>close(v,full.rows.at(-1)[key][j]));
  assert.equal(JSON.stringify(cache),before);ids.push(id);
 }
});
test('attention output is the weighted sum of V and residual paths preserve dimension',()=>{
 const m=forward([0,1,2]);
 for(const [t,r] of m.rows.entries()){
  assert.equal(m.q[t].length,2);assert.equal(m.k[t].length,2);assert.equal(m.v[t].length,4);assert.equal(r.hidden.length,6);assert.equal(r.z.length,4);
  for(let j=0;j<4;j++){
   close(r.o[j],r.a.reduce((s,a,i)=>s+a*m.v[i][j],0));close(r.r[j],m.x[t][j]+r.o[j]);close(r.z[j],r.r[j]+r.f[j]);
  }
 }
});
