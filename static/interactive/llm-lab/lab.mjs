import {vocab,E,WQ,WK,WV,W1,W2,Wout,forward,decodeCached,argmax,position,dot} from './model.mjs';
const $=id=>document.getElementById(id);
let ids=[0,1,2],selected=2,stage=0,view='model',mode='prefill',timer=null,matrices={};
const names=['토큰 ID','임베딩','Q · K · V','Attention','FFN · 잔차','다음 토큰'];
const gpuNames=['가중치 읽기','QKV 계산','캐시 저장','캐시 참조','연산 · 재사용','출력'];
const fmt=x=>Number.isFinite(x)?x.toFixed(3):'−∞';
const vec=a=>'['+a.map(fmt).join(', ')+']';
const arrow='<div class="arrow" aria-hidden="true">→</div>';
function matrix(title,data,{chosen=selected,labels,cols,mask=false,detail}={}){
 const key='m'+Object.keys(matrices).length;matrices[key]={title,data,detail};
 return `<div class="tensor"><h3>${title}<span>${data.length} × ${data[0].length}</span></h3><div class="matrix-wrap"><table class="matrix" aria-label="${title}"><thead><tr><th scope="col">행 / 열</th>${data[0].map((_,j)=>`<th scope="col">${cols?.[j]??'d'+j}</th>`).join('')}</tr></thead><tbody>${data.map((row,i)=>`<tr class="${i===chosen?'chosen':''}"><th scope="row" class="rowname">${labels?.[i]??'t'+i}</th>${row.map((x,j)=>`<td><button data-matrix="${key}" data-row="${i}" data-col="${j}" class="${mask&&j>i?'masked':x<0?'negative':''}" style="--heat:${.10+Math.min(1,Math.abs(x))*.5}" aria-label="${title} 행 ${i} 열 ${j}: ${mask&&j>i?'차단, 확률 0':fmt(x)}">${mask&&j>i?'× 0':fmt(x)}</button></td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}
function weights(title,data){return `<details class="weights"><summary>${title} · 고정 가중치 펼치기</summary>${matrix(title,data,{chosen:-1,labels:data.map((_,i)=>'d'+i)})}</details>`}
function stop(){if(timer)clearInterval(timer);timer=null;$('play').textContent='▶ 재생'}
function tokenLabels(a=ids){return a.map((id,t)=>`${t} ${vocab[id]}`)}
function explanation(label,title,formula,why){$('step-label').textContent=label;$('step-title').textContent=title;$('formula').textContent=formula;$('why').textContent=why}
function render(){
 matrices={};const m=forward(ids),t=Math.min(selected,ids.length-1),r=m.rows[t];
 const newId=argmax(m.rows.at(-1).p),dec=decodeCached(m,newId);
 const shown=view==='gpu'&&mode==='decode'?[...ids,newId]:ids;
 $('shape').textContent=`S=${shown.length}${view==='gpu'&&mode==='decode'?' (기존 '+ids.length+' + 새 1)':''} · d=4 · Q/K=2 · V=4`;
 $('tokens').innerHTML=shown.map((id,i)=>`<button data-token="${i}" aria-pressed="${i===selected}"><span>${vocab[id]}</span><small>${i===ids.length?'새 ':''}t=${i} · ID ${id}</small></button>`).join('');
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===view));
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===mode));
 $('gpu-controls').hidden=view!=='gpu';
 $('steps').innerHTML=(view==='model'?names:gpuNames).map((name,i)=>`<button data-step="${i}" aria-pressed="${i===stage}" ${i===stage?'aria-current="step"':''}><small>0${i+1}</small>${name}</button>`).join('');
 $('prev').disabled=stage===0;$('next').disabled=stage===5;
 $('progress').textContent=`${stage+1} / 6 · ${view==='model'?names[stage]:gpuNames[stage]}`;
 $('next-token').hidden=!(view==='model'&&stage===5);
 $('generate').disabled=ids.length>=8;
 $('cell-detail').textContent='숫자 셀을 누르면 행·열·계산값을 자세히 볼 수 있습니다.';
 if(view==='gpu'){renderGPU(m,dec,newId);return}
 const labels=tokenLabels();
 if(stage===0){
  explanation('01 / LOOKUP','토큰 ID는 임베딩 행의 주소입니다.','token_id[t] → E[token_id[t]]',`선택한 위치 t=${t}의 “${vocab[ids[t]]}”는 ID ${ids[t]}입니다. ID는 중요도나 순서가 아닙니다. 어휘 표에서 ${ids[t]}번 행을 읽습니다. 서로 같은 토큰은 같은 임베딩 행을 사용합니다.`);
  $('canvas').innerHTML=`<div class="flow">${matrix('입력 ID',ids.map(x=>[x]),{labels,cols:['ID']})}${arrow}${matrix('임베딩 표 E',E,{chosen:ids[t],labels:vocab.map((v,i)=>`${i} ${v}`),detail:(i,j)=>`E[ID ${i}, d${j}] = ${fmt(E[i][j])}. 고정된 교육용 가중치입니다.`})}</div>`;
 }else if(stage===1){
  explanation('02 / REPRESENTATION','같은 토큰도 위치 정보를 더하면 달라집니다.','X[t] = E[id[t]] + P[t]',`4개 차원은 고정된 단어 뜻의 이름이 아닙니다. 선택한 행의 임베딩과 작은 sinusoidal 위치 벡터를 원소별로 더합니다. 이 덧셈은 RoPE가 아닙니다.`);
  $('canvas').innerHTML=`<div class="flow">${matrix('토큰 임베딩',ids.map(id=>E[id]),{labels})}<div class="arrow">+</div>${matrix('위치 벡터 P',ids.map((_,i)=>position(i)),{labels})}<div class="arrow">=</div>${matrix('계층 입력 X',m.x,{labels,detail:(i,j)=>`${fmt(E[ids[i]][j])} + ${fmt(position(i)[j])} = ${fmt(m.x[i][j])}`})}</div><p class="row-equation">선택 행 X[${t}] = ${vec(m.x[t])}</p>`;
 }else if(stage===2){
  explanation('03 / PROJECTION','같은 입력에서 세 가지 투영을 만듭니다.','Q = XW_Q (S×2)   K = XW_K (S×2)   V = XW_V (S×4)',`Q와 K는 다음 단계의 점수 계산에, V는 정보를 섞는 가중합에 쓰입니다. Q/K의 차원은 2로 맞추고 V는 4차원을 유지합니다. 셀을 누르면 실제 내적을 볼 수 있습니다.`);
  const projectionDetail=w=>(i,j)=>`${vec(m.x[i])} · ${vec(w.map(row=>row[j]))} = ${fmt(dot(m.x[i],w.map(row=>row[j])))}`;
  $('canvas').innerHTML=matrix('입력 X',m.x,{labels})+`<div class="flow">${matrix('Query Q',m.q,{labels,detail:projectionDetail(WQ)})}${matrix('Key K',m.k,{labels,detail:projectionDetail(WK)})}${matrix('Value V',m.v,{labels,detail:projectionDetail(WV)})}</div>`+weights('W_Q',WQ)+weights('W_K',WK)+weights('W_V',WV);
 }else if(stage===3){
  const scores=m.q.map(q=>m.k.map(k=>dot(q,k)/Math.sqrt(2)));
  const a=m.rows.map(row=>ids.map((_,j)=>row.a[j]??0));
  explanation('04 / CONTEXT MIXING','미래를 막고, 허용된 V만 섞습니다.','S = QKᵀ / √2   →   A = softmax(S + causal mask)   →   O = AV',`행은 정보를 받는 위치, 열은 참조할 위치입니다. t=${t}는 자기 자신을 포함한 0…${t}만 볼 수 있습니다. 미래 점수에 −∞를 더하므로 확률은 정확히 0입니다. 허용된 가중치의 합은 ${r.a.reduce((a,b)=>a+b,0).toFixed(6)}입니다. 이 가중치를 모델 사고의 확정적인 원인 설명으로 해석하지 않습니다.`);
  $('canvas').innerHTML=`<div class="flow">${matrix('점수 S · 확률 아님',scores,{labels,cols:ids.map((_,i)=>'t'+i),detail:(i,j)=>`Q[${i}] · K[${j}] / √2 = ${fmt(scores[i][j])}${j>i?' → 미래 위치: 마스크로 −∞, softmax 뒤 0':''}`})}${arrow}${matrix('Attention A · 인과 마스크',a,{labels,cols:ids.map((_,i)=>'t'+i),mask:true,detail:(i,j)=>j>i?'미래 위치: 마스크 −∞ → exp(−∞)=0 → 확률 0':`위치 ${i} → 위치 ${j}: 가중치 ${a[i][j].toFixed(6)}. 이 행의 허용 가중치 합은 1입니다.`})}</div><div class="tensor active"><h3>선택한 Query t=${t} → 참조하는 위치</h3><div class="connections">${ids.map((id,j)=>`<div class="connection ${j>t?'blocked':''}"><span>${j} ${vocab[id]} ${j===t?'(자기)':''}</span><div class="bartrack"><div class="bar" style="width:${(a[t][j]*100).toFixed(3)}%"></div></div><span>${j>t?'× 0%':(a[t][j]*100).toFixed(1)+'%'}</span></div>`).join('')}</div></div><div class="flow">${matrix('가중합 대상 V',m.v,{labels})}${arrow}${matrix('Attention 출력 O',m.rows.map(row=>row.o),{labels,detail:(i,d)=>m.rows[i].a.map((v,j)=>`${fmt(v)}×${fmt(m.v[j][d])}`).join(' + ')+' = '+fmt(m.rows[i].o[d])})}</div>`;
 }else if(stage===4){
  explanation('05 / POSITION-WISE FFN','문맥을 섞은 뒤, 각 위치의 특징을 변환합니다.','R = X + O   →   H = ReLU(RW₁)   →   Z = R + HW₂',`첫 잔차에서 원래 X를 더하고, FFN은 다른 토큰을 직접 참조하지 않고 각 행을 독립적으로 처리합니다. 4→6→4차원으로 변환한 결과를 다시 더합니다. 이 교육용 모델은 bias·정규화·W_O를 생략했습니다.`);
  $('canvas').innerHTML=`<div class="flow">${matrix('첫 잔차 R = X + O',m.rows.map(row=>row.r),{labels,detail:(i,j)=>`${fmt(m.x[i][j])} + ${fmt(m.rows[i].o[j])} = ${fmt(m.rows[i].r[j])}`})}${arrow}${matrix('중간 H · ReLU',m.rows.map(row=>row.hidden),{labels,detail:(i,j)=>`max(0, R[${i}] · W₁[:,${j}]) = ${fmt(m.rows[i].hidden[j])}`})}</div><div class="flow">${matrix('FFN 출력 F = HW₂',m.rows.map(row=>row.f),{labels})}<div class="arrow">+ R →</div>${matrix('두 번째 잔차 Z',m.rows.map(row=>row.z),{labels})}</div>`+weights('W₁',W1)+weights('W₂',W2);
 }else{
  const winner=argmax(r.p);
  explanation('06 / NEXT TOKEN',`t=${t}의 표현은 그 다음 위치를 예측합니다.`,'logits = ZW_vocab   →   p = softmax(logits)   →   argmax(p)',`Logit은 정규화되지 않은 점수이고 확률과 다릅니다. 여기서는 탐욕적 선택(argmax)을 사용하며 샘플링하지 않습니다. 아래는 선택 위치 t=${t}의 분포입니다. 실제 토큰 추가에는 마지막 위치 t=${ids.length-1}의 분포를 사용합니다.`);
  $('canvas').innerHTML=matrix('어휘별 logits',m.rows.map(row=>row.logits),{labels,cols:vocab,detail:(i,j)=>`Z[${i}] · W_vocab[:,${j}] = ${fmt(m.rows[i].logits[j])}; softmax 확률 ${(m.rows[i].p[j]*100).toFixed(3)}%`})+`<div class="tensor active"><h3>t=${t} 다음 토큰 확률 · 합 100%</h3>${vocab.map((word,i)=>`<div class="probability ${i===winner?'winner':''}"><span>${word} ${i===winner?'←':''}</span><div class="bartrack"><div class="bar" style="width:${r.p[i]*100}%"></div></div><span>${(r.p[i]*100).toFixed(2)}%</span></div>`).join('')}<p class="sub">← argmax: “${vocab[winner]}”. 높은 생성 확률은 사실의 정확도나 언어 품질 점수가 아닙니다.</p></div>`+weights('W_vocab',Wout);
  $('generation-note').textContent=ids.length>=8?'최대 8개 토큰입니다. 처음부터 버튼으로 다시 탐색하세요.':`마지막 위치의 선택은 “${vocab[newId]}”(ID ${newId})입니다. 누르면 입력에 붙이고 새 위치를 처음부터 따라갑니다.`;
 }
 height();
}
function renderGPU(m,dec,newId){
 const decode=mode==='decode',n=ids.length,count=decode?1:n,total=decode?n+1:n;
 const phase=[['가중치와 입력을 읽습니다.','HBM → 온칩 작업 타일','가중치는 모든 생성 단계에서 계속 필요합니다. 캐시를 써도 가중치 읽기 자체가 사라지는 것은 아닙니다.'],['필요한 토큰의 Q/K/V를 계산합니다.','X_new W_Q, X_new W_K, X_new W_V',decode?'기존 토큰의 K/V는 다시 투영하지 않습니다. 새 토큰 한 행만 계산합니다.':'입력의 모든 행을 계산할 수 있습니다. 인과 마스크는 다음 Attention에서 적용됩니다.'],['계층별 K/V를 저장합니다.','cache ← [기존 K/V ; 새 K/V]','캐시는 Q나 Attention 확률이 아닙니다. 이 모델의 한 계층에서 K는 2개, V는 4개 숫자이며 토큰당 FP32 24바이트입니다.'],['캐시에서 문맥을 참조합니다.','Q_new × K_cacheᵀ → causal softmax → A × V_cache','캐시는 연산 재사용을 돕지만 과거 K/V에 접근하는 비용까지 없애지는 않습니다. 길어진 문맥은 저장량과 읽을 데이터에 영향을 줍니다.'],['온칩 타일에서 계산하고 재사용합니다.','R = X + AV → ReLU(RW₁)W₂ → 잔차','공유 메모리·레지스터 등은 커널에 따라 다르게 쓰입니다. 모든 텐서가 한 번에 온칩에 들어간다는 뜻이 아닙니다.'],['점수에서 다음 토큰을 고릅니다.','Z W_vocab → softmax → argmax','출력 ID를 다음 입력에 붙이면 Decode를 반복합니다. 이 그림의 화살표는 데이터 의존성이며 실제 칩 배선이나 측정 시간은 아닙니다.']][stage];
 explanation(`GPU / ${mode.toUpperCase()} / 0${stage+1}`,phase[0],phase[1],phase[2]);
 $('mode-note').textContent=decode?`현재 ${n}개 토큰의 K/V가 있다고 가정하고, 마지막 위치가 선택한 “${vocab[newId]}” 1개를 추가하는 계산입니다. 계산 보기의 입력은 바꾸지 않습니다. 선택 t=${selected}${selected<n?'는 재사용하는 캐시 행입니다.':'는 새로 계산하는 행입니다.'}`:`입력 ${n}개 전체의 K/V를 처음 만드는 과정입니다. 선택 t=${selected}의 행은 강조되어 있으며 현재 단계는 입력 전체에 적용됩니다.`;
 const stored=stage>=2;
 const cacheIds=decode?[...ids,newId]:ids;
 const cacheCount=decode?(stored?n+1:n):(stored?n:0);
 const activeRead=[0,3].includes(stage),activeCompute=[1,4,5].includes(stage);
 const oldLabel=decode?'기존 캐시 · 재사용':'이번 입력 · 새 계산';
 $('canvas').innerHTML=`<div class="gpu-layout"><div class="memory ${activeRead||stage===2?'active':''}"><h3>HBM / GPU 외부 메모리</h3><div class="pill">가중치: E, W_Q, W_K, W_V, W₁, W₂, W_vocab</div><p class="gpu-note">개념적 저장 위치 · 실제 주소·칩 배치 아님</p><h3>이 계층의 KV 캐시</h3><div class="cache-rows">${cacheIds.map((id,i)=>`<div class="cache-row ${(!decode||i===n)?'fresh':''} ${(!decode||i===n)&&!stored?'pending':''}"><span>${i===selected?'▣ ':''}t=${i} ${vocab[id]}</span><span>${decode&&i<n?'재사용':stored?'저장됨':'계산 전'} · K₂ V₄</span></div>`).join('')}</div><p><strong>${cacheCount}행 · ${cacheCount*24} B</strong> 저장 / 완료 시 ${total}행 · ${total*24} B</p><p class="gpu-note">${oldLabel}. Q와 Attention A는 캐시하지 않습니다.</p></div><div class="transfer"><span>${stage===2?'←':'→'}</span><small>${stage===2?'새 K/V 저장':stage===3?'K/V 읽기':stage===0?'가중치 타일 읽기':'계산 의존성'}</small></div><div class="sm ${activeCompute?'active':''}"><h3>SM / 온칩 작업 공간 · 연산</h3><span class="pill">공유 메모리 / 레지스터</span><div class="tile" aria-label="개념적인 연산 타일">${Array(12).fill('<span></span>').join('')}</div><p>이번 투영 대상: <strong>${count}개 토큰</strong></p><p class="gpu-note">${decode?'기존 K/V '+n+'행은 보존하고 새 행만 투영합니다.':'입력 '+n+'행의 Q/K/V를 계산합니다.'}</p><p class="row-equation">${decode?'새 토큰':'선택 토큰'} Q = ${vec(decode?dec.q:m.q[selected])}</p><p class="row-equation">${decode?'새 토큰':'선택 토큰'} K = ${vec(decode?dec.k:m.k[selected])}</p><p class="row-equation">${decode?'새 토큰':'선택 토큰'} V = ${vec(decode?dec.v:m.v[selected])}</p><p class="gpu-note">값은 이 단계의 계산 결과 미리보기입니다. 타일은 실제 스레드 수를 뜻하지 않습니다.</p></div></div>`;
 if(stage>=3){const out=decode?dec:m.rows[selected];$('canvas').innerHTML+=`<div class="tensor"><h3>${decode?'새 Query':'선택 Query'}가 읽는 캐시 가중치</h3><div class="connections">${cacheIds.map((id,j)=>`<div class="connection ${out.a[j]===undefined?'blocked':''}"><span>${j} ${vocab[id]}</span><div class="bartrack"><div class="bar" style="width:${(out.a[j]??0)*100}%"></div></div><span>${out.a[j]===undefined?'× 0%':(out.a[j]*100).toFixed(1)+'%'}</span></div>`).join('')}</div><p class="gpu-note">현재 Query가 볼 수 있는 과거와 자기 자신만 참조합니다. 캐시 행의 재사용과 Attention 가중치는 서로 다른 개념입니다.</p></div>`}
 $('cell-detail').textContent=decode?`수치 검증: 기존 K/V를 재사용한 Decode 결과는 전체 ${total}개 토큰을 다시 계산한 마지막 행과 일치합니다. 새 K=${vec(dec.k)}, V=${vec(dec.v)}.`:'Prefill은 입력 전체를 처리하여 K/V 캐시를 만듭니다. Decode로 전환하면 같은 캐시를 재사용하는 한 토큰 계산을 비교할 수 있습니다.';
 height();
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.token!==undefined){stop();selected=Number(b.dataset.token);render()}
 else if(b.dataset.step!==undefined){stop();stage=Number(b.dataset.step);render()}
 else if(b.dataset.view){stop();view=b.dataset.view;selected=Math.min(selected,ids.length-1);stage=0;render()}
 else if(b.dataset.mode){stop();mode=b.dataset.mode;selected=mode==='decode'?ids.length:ids.length-1;stage=0;render()}
 else if(b.dataset.matrix){const {title,data,detail}=matrices[b.dataset.matrix],i=Number(b.dataset.row),j=Number(b.dataset.col);$('cell-detail').textContent=`${title}[${i}, ${j}] = ${fmt(data[i][j])}. ${detail?detail(i,j):'표시는 소수 셋째 자리까지 반올림하며 계산에는 원래 정밀도를 사용합니다.'}`;height()}
});
$('prev').onclick=()=>{stop();stage=Math.max(0,stage-1);render()};
$('next').onclick=()=>{stop();stage=Math.min(5,stage+1);render()};
$('reset').onclick=()=>{stop();ids=[0,1,2];selected=2;stage=0;mode='prefill';render()};
$('play').onclick=()=>{if(timer){stop();return}if(stage===5)stage=0;render();$('play').textContent='Ⅱ 일시정지';timer=setInterval(()=>{stage++;if(stage>=5){stage=5;stop()}render()},2200)};
$('generate').onclick=()=>{if(ids.length>=8)return;stop();const m=forward(ids);ids.push(argmax(m.rows.at(-1).p));selected=ids.length-1;stage=0;render()};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
function height(){requestAnimationFrame(()=>{if(window.parent!==window)window.parent.postMessage({type:'thelogos-interactive-height',height:Math.ceil(document.querySelector('main').getBoundingClientRect().height)},location.origin)})}
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.data?.type==='thelogos-interactive-height-request')height()});
new ResizeObserver(height).observe(document.body);
render();
