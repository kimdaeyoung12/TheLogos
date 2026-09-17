// Bounded production READ / realtime test. No admin writes, no prayer submissions.
// Presence uses the pre-authorized legacy topic, not the visible production room.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { SupabaseService } from '../static/retreat-prayer/assets/backend.js';
import { RealtimeSetupCoordinator } from '../static/retreat-prayer/assets/realtime-setup.js';

const sdk = process.env.SUPABASE_JS_ENTRY;
if (!sdk) throw new Error('Set SUPABASE_JS_ENTRY to the installed SDK entry.');
const { createClient } = await import(pathToFileURL(sdk).href);
const sandbox = { window: {} };
vm.runInNewContext(await readFile(new URL('../static/retreat-prayer/config.js', import.meta.url), 'utf8'), sandbox);
const config = { ...sandbox.window.RETREAT_PRAYER_CONFIG, presenceTopic: 'retreat-prayer:presence:live' };
const count = Math.min(50, Math.max(1, Number(process.env.CAPACITY_CLIENTS || 50)));
const joinSpreadMs = Number(process.env.CAPACITY_JOIN_SPREAD_MS || 16000);
const clients = [], services = [], sessions = [], cleanups = [];
const liveStates = Array(count).fill(null);
let cleaningUp=false;
const cachePath = '.omx/tmp/prayer-capacity-sessions.dpapi';
function protect(input, decrypt=false) {
  const operation=decrypt?'Unprotect':'Protect';
  const script=`Add-Type -AssemblyName System.Security; $bytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $out=[Security.Cryptography.ProtectedData]::${operation}($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Write([Convert]::ToBase64String($out))`;
  return Buffer.from(execFileSync('powershell',['-NoProfile','-Command',script],{input:Buffer.from(input).toString('base64'),windowsHide:true,encoding:'utf8'}).trim(),'base64');
}
const deadline = setTimeout(() => { console.error('CAPACITY TEST exceeded six-minute deadline'); process.exit(2); }, 360000);
const report = { clients: count, joinSpreadMs, adminWrites: false, createsAnonymousUsers: true, presenceTopic: config.presenceTopic, phases: {}, errors: [] };
const delay = ms => new Promise(r => setTimeout(r, ms));
const percentile = values => {
  const s = [...values].sort((a,b) => a-b);
  return { p50: Math.round(s[Math.floor(s.length / 2)]), p95: Math.round(s[Math.ceil(s.length * .95)-1]), max: Math.round(s.at(-1)) };
};
async function timed(operation) { const start = performance.now(); await operation(); return performance.now()-start; }
async function until(check, timeout=20000) {
  const start = performance.now();
  while (!check()) { if (performance.now()-start > timeout) throw new Error('Convergence timeout'); await delay(100); }
  return performance.now()-start;
}
async function phase(name, operation) {
  console.error('PHASE '+name);
  const start = performance.now(); report.phases[name] = await operation();
  report.phases[name].totalMs = Math.round(performance.now()-start);
  console.error(JSON.stringify({ phase: name, ...report.phases[name] }));
}

try {
  await phase('unique-anonymous-auth', async () => {
    let cached=[];
    try {cached=JSON.parse(protect(await readFile(cachePath),true).toString('utf8')).filter(s=>s.user?.is_anonymous&&s.access_token&&s.refresh_token);}catch{}
    // Issue users gently; their subsequent page/realtime requests are simultaneous.
    for (let i=0;i<count;i++) {
      // Expired cached JWTs may refresh here; do not burst token refreshes.
      if(i>0)await delay(1000);
      const client = createClient(config.supabaseUrl, config.supabasePublishableKey, { auth:{persistSession:false,autoRefreshToken:false} });
      clients.push(client);
      const isNewSession=!cached[i];
      if(!cached[i]&&process.env.CAPACITY_ALLOW_SIGNUP!=='1')throw new Error('No cached test session: explicitly authorize signup with CAPACITY_ALLOW_SIGNUP=1.');
      const { data, error } = cached[i]
        ? await client.auth.setSession(cached[i])
        : await client.auth.signInAnonymously();
      if (error) throw new Error(`Auth ${i+1}/50: ${error.status} ${error.code || error.message}`);
      sessions.push(data.session); services.push(new SupabaseService(config, client));
      if (!cached[i] || cached[i].access_token!==data.session.access_token) {
        cached[i]=data.session;
        await writeFile(cachePath,protect(Buffer.from(JSON.stringify(cached))));
      }
      if (isNewSession) {
        report.newAnonymousUsers=(report.newAnonymousUsers||0)+1;
        await delay(550);
      }
    }
    return { uniqueUsers: new Set(sessions.map(s=>s.user.id)).size };
  });
  let snapshot;
  await phase('50-public-boots', async () => {
    const durations = await Promise.all(services.map(service => timed(async()=> {
      const now = await service.getServerTime(); const data = await service.loadPublicData(now);
      assert.ok(data.liveSession.program_snapshot.steps.length); snapshot = data;
    })));
    return percentile(durations);
  });
  await phase('50-live-subscriptions', async () => {
    const durations = await Promise.all(services.map((service,index)=>timed(async()=>{
      await delay(index * joinSpreadMs / count);
      await service.prepareRealtime();
      const coordinator=new RealtimeSetupCoordinator({
        delays:[2000,5000,15000],
        install:async()=>{
          const stop=await service.subscribeParticipantUpdates(()=>{},()=>{},(status,error)=>{
            if (cleaningUp) return;
            liveStates[index]=status;
            if(status==='failed')report.errors.push({phase:'live',index,status,error:error?.message});
          });
          cleanups.push(stop);
        },
        onFailure:()=>{report.subscriptionRetries=(report.subscriptionRetries||0)+1;},
      });
      cleanups.push(()=>coordinator.stop());
      await coordinator.start();
      await until(()=>coordinator.ready,60000);
    })));
    return percentile(durations);
  });
  const presence = Array(count).fill(null);
  const runId = crypto.randomUUID();
  const ids = Array.from({length:count},()=>crypto.randomUUID());
  const states = Array(count).fill(null);
  await phase('50-presence-joins', async () => {
    const joined = await Promise.allSettled(services.map((service,index)=>timed(async()=>{
      await delay(index * joinSpreadMs / count);
      for(let attempt=0;attempt<3;attempt++) {
        try {
          presence[index] = await service.connectPresence({sessionId:ids[index],tabId:`${runId}-${index}`,context:'space'}, s=>{states[index]=s;});
          break;
        } catch(error) {
          report.presenceRetries=(report.presenceRetries||0)+1;
          if(attempt===2)throw error;
          await delay(5000 + index * joinSpreadMs / count);
        }
      }
      cleanups.push(presence[index]);
    })));
    const failures=joined.flatMap((r,index)=>r.status==='rejected'?[{index,error:r.reason.message}]:[]);
    report.presenceJoined=joined.length-failures.length;
    if(failures.length){report.errors.push(...failures);throw new Error(`${failures.length}/${count} Presence joins failed`);}
    const durations=joined.map(r=>r.value);
    const convergenceMs = await until(()=>states.every(s=>s?.synced && s.count===count));
    return {...percentile(durations),convergenceMs:Math.round(convergenceMs)};
  });
  await phase('50-home-to-live', async () => {
    const durations=await Promise.all(services.map((service,index)=>timed(async()=>{
      await delay(index * joinSpreadMs / count);
      await service.updatePresenceContext({sessionId:ids[index],context:'live'},s=>{states[index]=s;});
    })));
    const convergenceMs=await until(()=>states.every(s=>s?.synced&&s.count===count));
    return {...percentile(durations),convergenceMs:Math.round(convergenceMs)};
  });
  await phase('50-state-reads-with-100-channels', async()=>percentile(await Promise.all(services.map(s=>timed(()=>s.fetchLiveSession())))));
  const media = snapshot.media.find(m=>m.kind==='audio'&&m.source_url);
  await phase('50-audio-range-requests', async()=>{
    if (!media) return { skipped:'No uploaded media' };
    let bytes=0;
    const durations=await Promise.all(Array.from({length:count},()=>timed(async()=>{
      const r=await fetch(media.source_url,{headers:{Range:'bytes=0-65535'},signal:AbortSignal.timeout(15000)});
      assert.equal(r.status,206,'Range request must not download whole audio');
      const length=(await r.arrayBuffer()).byteLength;
      assert.equal(length,65536,'Audio range must contain the requested bytes');
      bytes+=length;
    })));
    return {...percentile(durations),bytes};
  });
  await phase('10-disconnect-reconnect', async()=>{
    const reconnectCount=Math.min(10,count);
    for(let i=0;i<reconnectCount;i++){states[i]=null;liveStates[i]=null;}
    await Promise.all(services.slice(0,10).map(s=>s.supabase.realtime.disconnect()));
    await delay(1000);
    services.slice(0,10).forEach(s=>s.supabase.realtime.connect());
    await until(()=>states.every(s=>s?.synced&&s.count===count)&&liveStates.every(s=>s==='connected'),30000);
    return {clients:reconnectCount};
  });
  await phase('30-second-soak',async()=>{await delay(30000); assert.ok(states.every(s=>s?.synced&&s.count===count)); return {synced:states.length,errors:report.errors.length};});
  report.pass = report.errors.length===0;
} catch(error) { report.pass=false; report.failure=error.message; }
finally {
  cleaningUp=true;
  report.issuedUniqueUsers=new Set(sessions.map(s=>s.user.id)).size;
  console.error('PHASE cleanup');
  await Promise.allSettled(cleanups.map(stop=>stop()));
  await Promise.allSettled(clients.map(c=>c.removeAllChannels()));
  // Keep only DPAPI-encrypted, test-created sessions for bounded reruns. No
  // user/Admin credentials are stored. The local cache is ignored by Git.
  clearTimeout(deadline);
}
console.log(JSON.stringify(report,null,2));
if (!report.pass) process.exitCode=1;
