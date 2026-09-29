// Isolated 50-browser application test. Real production app/core/sync/media/Canvas
// code; local fixture transport replaces Supabase and never writes production.
import { chromium } from 'file:///C:/Users/wwht1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve('static/retreat-prayer');
const count=Math.min(50,Math.max(1,Number(process.env.BROWSER_CLIENTS||50))), streams=new Set(), contexts=[], pages=[];
const report={environment:'isolated transport; real application in independent Chrome contexts',clients:count,phases:{},errors:[]};
const steps=Array.from({length:7},(_,i)=>({id:`step-${i}`,label:`검증 단계 ${i+1}`,content:`검증 기도문 ${i+1}\n\n• 서로를 위해 기도합니다.\n• 공동체를 위해 기도합니다.`,duration_seconds:180,scripture_reference:'시편 133:1',media_id:'test-audio'}));
let live={id:1,status:'live',mode:'manual',stage_index:0,version:1,stage_started_at:new Date().toISOString(),program_snapshot:{steps},announcement:'',announcement_id:null};
const wav=Buffer.alloc(44+16000*2*10);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
let origin; let browser; let stateReads=0;
const backend=await readFile(path.join(root,'assets/backend.js'),'utf8');
const fixtureFactory=`export async function createPrayerService(){
 const content={settings:{time_zone:'Asia/Seoul',church_name:'검증 공동체',daily_prayer_time:null},dailyPrayer:null,requests:[],serverNow:new Date().toISOString()};
 const service={mode:'production',getServerTime:async()=>new Date().toISOString(),submitPrayerRequest:async()=>({ok:true}),
 fetchPublicContent:async()=>({...content,serverNow:new Date().toISOString()}), fetchLiveSession:async()=>{const r=await fetch('/test-state');if(!r.ok)throw Error('offline');return r.json();},
 loadPublicData:async()=>({...content,liveSession:await service.fetchLiveSession(),media:[{id:'test-audio',kind:'upload',active:true,source_url:location.origin+'/test.wav'},{id:'other-audio',kind:'upload',active:true,source_url:location.origin+'/test.wav?track=2'}]}),
 prepareRealtime:async()=>{},syncLive:async()=>service.fetchLiveSession(),
 connectPresence:async(_,cb)=>{cb({synced:true,count:50,status:'connected'});return()=>{};},
 updatePresenceContext:async(_,cb)=>cb({synced:true,count:50,status:'connected'}),
 subscribeParticipantUpdates:async(listener,contentListener,status)=>{
   const sync=createLiveSync({fetchSession:service.fetchLiveSession,onSession:listener,onStatus:status});
   const events=new EventSource('/test-events');events.onmessage=e=>sync.receive(JSON.parse(e.data));
   globalThis.__testSync=sync;globalThis.__testTransportStatus=status;status('connected');return()=>{sync.stop();events.close();};
 }};return service;
}`;
let stateFailure=false;
const server=http.createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/test-events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});res.write(':ready\n\n');streams.add(res);req.on('close',()=>streams.delete(res));return;}
 if(pathname==='/test-state'){stateReads++;res.writeHead(stateFailure?503:200,{'Content-Type':'application/json'});res.end(JSON.stringify(live));return;}
 if(pathname==='/test.wav'){res.writeHead(200,{'Content-Type':'audio/wav','Content-Length':wav.length});res.end(wav);return;}
 try{
  const relative=pathname.replace(/^\/retreat-prayer\/?/,'')||'index.html';
  const filename=path.resolve(root,relative);if(!filename.startsWith(root+path.sep))throw Error('outside root');
  let body=await readFile(filename);
  if(relative==='assets/backend.js')body=Buffer.from(backend.slice(0,backend.indexOf('export async function createPrayerService('))+fixtureFactory);
  const type=filename.endsWith('.js')?'text/javascript':filename.endsWith('.css')?'text/css':filename.endsWith('.html')?'text/html':'application/octet-stream';
  res.writeHead(200,{'Content-Type':type});res.end(body);
 }catch{res.writeHead(404);res.end();}
});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const stats=values=>{const v=values.sort((a,b)=>a-b);return{p50:Math.round(v[Math.floor(v.length/2)]),p95:Math.round(v[Math.ceil(v.length*.95)-1]),max:Math.round(v.at(-1))};};
async function phase(name,fn){name=name.replace(/^50-/,count+'-');console.error('PHASE '+name);const start=Date.now();report.phases[name]=await fn();report.phases[name].totalMs=Date.now()-start;console.error(JSON.stringify({phase:name,...report.phases[name]}));}
async function send({stage,announcement,partial=false}={}){
 live={...live,version:live.version+1,stage_index:stage??live.stage_index,announcement:announcement??live.announcement,announcement_id:announcement===''?null:`notice-${live.version+1}`};
 const payload=structuredClone(live);if(partial)delete payload.program_snapshot;
 const start=Date.now();for(const res of streams)res.write(`data: ${JSON.stringify(payload)}\n\n`);
 await Promise.all(pages.map(p=>p.waitForFunction(({stage,notice})=>document.querySelector('#live-stage-label')?.textContent===stage && (notice===null || (notice===''?document.querySelector('#participant-announcement').hidden:document.querySelector('#participant-announcement').textContent.includes(notice))),{stage:steps[live.stage_index].label,notice:announcement??null},{timeout:15000})));
 return {allRenderedMs:Date.now()-start,version:live.version};
}
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--mute-audio','--disable-background-timer-throttling']});
 await phase('50-cold-page-loads',async()=>{
  for(let i=0;i<count;i++){
   const context=await browser.newContext({viewport:i%2?{width:390,height:844}:{width:1280,height:800}});contexts.push(context);
   const page=await context.newPage();pages.push(page);page.on('pageerror',e=>report.errors.push(e.message));
   await page.addInitScript(()=>{globalThis.__paintChanges=0;globalThis.__blank=false;new MutationObserver(()=>{const h=document.querySelector('#live-heading');if(h?.textContent.includes('진행자가 기도 내용을 준비'))globalThis.__blank=true;}).observe(document,{childList:true,subtree:true});});
  }
  const values=await Promise.all(pages.map(async p=>{const start=Date.now();await p.goto(origin+'/retreat-prayer/#live',{waitUntil:'domcontentloaded'});await p.locator('#live-stage-label').filter({hasText:'검증 단계 1'}).waitFor({timeout:30000});return Date.now()-start;}));
  return stats(values);
 });
 await phase('50-realtime-ready',async()=>{
  const start=Date.now();while(streams.size<count){if(Date.now()-start>30000)throw Error('Only '+streams.size+' event streams');await sleep(100);}
  return {streams:streams.size,ms:Date.now()-start};
 });
 await phase('complete-stage-event',()=>send({stage:1}));
 await phase('partial-stage-event',()=>send({stage:2,partial:true}));
 await phase('announcement-publish',()=>send({announcement:'공지 검증',partial:true}));
 await phase('announcement-replace',()=>send({announcement:'공지 교체 검증',partial:true}));
 await phase('announcement-clear',()=>send({announcement:'',partial:true}));
 await phase('unchanged-text-and-scroll',async()=>{
  const p=pages[0];await p.evaluate(()=>{const h=document.querySelector('#live-heading');globalThis.__mutations=0;new MutationObserver(()=>globalThis.__mutations++).observe(h,{childList:true,subtree:true});});
  await sleep(3200);const mutations=await p.evaluate(()=>globalThis.__mutations);assert.equal(mutations,0);return {mutationsOver3Seconds:mutations};
 });
 await phase('50-audio-playbacks',async()=>{
  const results=await Promise.all(pages.map(async p=>{
   const audio=p.locator('#audio-toggle');if(await audio.getAttribute('aria-pressed')==='true')await audio.click();await audio.click();
   await p.waitForFunction(()=>{const a=document.querySelector('#prayer-audio');return !a.paused&&a.currentTime>0;},null,{timeout:15000});return true;
  }));return{playing:results.filter(Boolean).length};
 });
 await phase('temporary-fetch-failure',async()=>{
  stateFailure=true;live={...live,version:live.version+1,stage_index:3};const incomplete={...live};delete incomplete.program_snapshot;
  for(const res of streams)res.write(`data: ${JSON.stringify(incomplete)}\n\n`);
  await sleep(800);assert.ok((await Promise.all(pages.map(p=>p.locator('#live-stage-label').textContent()))).every(v=>v===steps[2].label));
  stateFailure=false;await Promise.all(pages.map(p=>p.waitForFunction(()=>document.querySelector('#live-stage-label')?.textContent==='검증 단계 4',null,{timeout:15000})));
  return{retainedAndRecovered:count};
 });
 await phase('transport-loss-http-fallback',async()=>{
  live={...live,version:live.version+1,stage_index:4};
  const start=Date.now();
  await Promise.all(pages.map(p=>p.evaluate(()=>globalThis.__testTransportStatus('reconnecting'))));
  // Deliberately send no realtime event. Only the bounded fallback can recover.
  await Promise.all(pages.map(p=>p.waitForFunction(()=>document.querySelector('#live-stage-label')?.textContent==='검증 단계 5',null,{timeout:10000})));
  const allRenderedMs=Date.now()-start;
  await Promise.all(pages.map(p=>p.evaluate(()=>globalThis.__testTransportStatus('connected'))));
  await send({stage:3});
  return {allRenderedMs,recovered:count};
 });
 await phase('reload-ten-pages',async()=>{
  const durations=await Promise.all(pages.slice(0,10).map(async p=>{const t=Date.now();await p.reload();await p.waitForFunction(()=>document.querySelector('#live-stage-label')?.textContent==='검증 단계 4');return Date.now()-t;}));return stats(durations);
 });
 if(process.env.OPERATIONAL_CHECKS==='1'){
  // Reload may replace the EventSource; wait for subscriptions before sending.
  await Promise.all(pages.map(p=>p.waitForFunction(()=>Boolean(globalThis.__testTransportStatus),null,{timeout:25000})));
  await phase('same-track-keeps-playing',async()=>{
   const p=pages[0],button=p.locator('#audio-toggle');
   if(await button.getAttribute('aria-pressed')==='true')await button.click();await button.click();
   await p.waitForFunction(()=>document.querySelector('#prayer-audio').currentTime>2);
   const before=await p.evaluate(()=>document.querySelector('#prayer-audio').currentTime);
   await send({stage:4});const after=await p.evaluate(()=>document.querySelector('#prayer-audio').currentTime);
   assert.ok(after>=before);return{before,after};
  });
  await phase('music-loops-without-false-on-state',async()=>{
   const p=pages[0];await p.waitForFunction(()=>document.querySelector('#prayer-audio').currentTime>8,null,{timeout:12000});
   await p.waitForFunction(()=>document.querySelector('#prayer-audio').currentTime<2,null,{timeout:7000});
   const result=await p.evaluate(()=>{const a=document.querySelector('#prayer-audio');return{loop:a.loop,ended:a.ended,paused:a.paused};});
   assert.deepEqual(result,{loop:true,ended:false,paused:false});return result;
  });
  await phase('different-track-fades-in',async()=>{
   steps[5].media_id='other-audio';await send({stage:5});const p=pages[0];
   const first=await p.evaluate(()=>document.querySelector('#prayer-audio').volume);
   assert.ok(first<0.3);
   await p.waitForFunction(()=>document.querySelector('#prayer-audio').volume===1,null,{timeout:4000});
   return{firstVolume:first,finalVolume:await p.evaluate(()=>document.querySelector('#prayer-audio').volume)};
  });
  await phase('cancel-fade-and-restart',async()=>{
   await send({stage:4});const p=pages[0];await p.locator('#audio-toggle').click();await sleep(1700);
   assert.equal(await p.evaluate(()=>document.querySelector('#prayer-audio').paused),true);
   await p.locator('#audio-toggle').click();await p.waitForFunction(()=>{const a=document.querySelector('#prayer-audio');return !a.paused&&a.volume===1;});return{recovered:true};
  });
  await phase('healthy-socket-missed-event-recovers',async()=>{
   live={...live,version:live.version+1,stage_index:6};const started=Date.now();
   await Promise.all(pages.map(p=>p.waitForFunction(()=>document.querySelector('#live-stage-label').textContent==='검증 단계 7',null,{timeout:23000})));
   return{recovered:count,ms:Date.now()-started};
  });
  await phase('anonymous-submit-resets-name-field',async()=>{
   const p=pages[0];await p.goto(origin+'/retreat-prayer/#requests');
   await p.locator('#view-requests [data-action="open-submit"]').click();await p.locator('#request-anonymous').check();
   await p.locator('#request-body').fill('격리된 테스트 기도제목입니다.');await p.locator('#request-consent').check();await p.locator('#request-submit-button').click();
   await p.waitForFunction(()=>document.querySelector('#request-form-status').textContent.includes('관리자에게 전달'));
   const result=await p.evaluate(()=>({anonymous:document.querySelector('#request-anonymous').checked,nameDisabled:document.querySelector('#request-name').disabled}));
   assert.deepEqual(result,{anonymous:false,nameDisabled:false});return result;
  });
 }
 report.blankPrayerScreens=(await Promise.all(pages.map(p=>p.evaluate(()=>globalThis.__blank)))).filter(Boolean).length;
 report.horizontalOverflow=(await Promise.all(pages.map(p=>p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)))).filter(Boolean).length;
 report.stateReads=stateReads;report.pass=!report.errors.length&&!report.blankPrayerScreens&&!report.horizontalOverflow;
}catch(error){report.pass=false;report.failure=error.message;}
finally{await browser?.close();for(const res of streams)res.end();await new Promise(r=>server.close(r));}
console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
