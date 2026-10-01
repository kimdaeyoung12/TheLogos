import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const read = (name) => readFile(new URL('../static/retreat-prayer/assets/' + name, import.meta.url), 'utf8');
const uri = (text) => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const syncSource = await read('live-sync.js');
const { createLiveSync, isCompleteLiveSession } = await import(uri(syncSource));
const coreUri = uri(await read('core.js'));
const { deriveLiveView } = await import(coreUri);
const backend = (await read('backend.js')).replace('./core.js?v=20260829-4', coreUri).replace('./live-sync.js?v=20260917-3', uri(syncSource));
const { SupabaseService } = await import(uri(backend));
const flush = () => new Promise(resolve => setImmediate(resolve));
const row = (version = 1) => ({ id: 1, status: 'live', mode: 'manual', version, stage_index: 1,
  program_snapshot: { steps: Array.from({ length: 7 }, (_, index) => ({ label: `기도 ${index + 1}`, content: '긴 기도문 '.repeat(120), duration_seconds: 180 })) } });

function harness(fetchSession) {
  const delivered = [], statuses = [], timers = new Map(); let timerId = 0;
  const sync = createLiveSync({ fetchSession, onSession: data => delivered.push(data), onStatus: status => statuses.push(status),
    setTimer: fn => { timers.set(++timerId, fn); return timerId; }, clearTimer: id => timers.delete(id) });
  return { sync, delivered, statuses, timers, retry() { const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); } };
}

test('missing replication snapshot reproduces preparation view, full read retains seven stages', () => {
  assert.equal(deriveLiveView(row()).steps.length, 7);
  const incomplete = { ...row(2), program_snapshot: undefined };
  assert.equal(deriveLiveView(incomplete).step, null);
  assert.equal(isCompleteLiveSession(incomplete), false);
});

test('invalid snapshots, empty content and out-of-range index are rejected; completed is allowed', () => {
  for (const snapshot of [undefined, null, {}, { steps: [] }, 'unchanged-toast-datum']) assert.equal(isCompleteLiveSession({ ...row(), program_snapshot: snapshot }), false);
  assert.equal(isCompleteLiveSession({ ...row(), stage_index: 9 }), false);
  assert.equal(isCompleteLiveSession({ ...row(), program_snapshot: { steps: [{content:''}] } }), false);
  assert.equal(isCompleteLiveSession({ status: 'completed', version: 5 }), true);
});

test('failed or incomplete full read keeps last valid content and retries without another event', async () => {
  let current = row(); const h = harness(async () => current);
  h.sync.request(1); await flush();
  current = { ...row(2), program_snapshot: null }; h.sync.request(2); await flush();
  assert.equal(h.delivered.length, 1); assert.equal(h.timers.size, 1);
  current = row(2); h.retry(); await flush();
  assert.equal(h.delivered.at(-1).version, 2); h.sync.stop();
});

test('network error retries and stop cancels timer', async () => {
  const h = harness(async () => { throw new Error('offline'); });
  h.sync.request(2); await flush(); assert.equal(h.delivered.length, 0); assert.equal(h.timers.size, 1);
  assert.equal(h.statuses.at(-1), 'reconnecting'); h.sync.stop(); assert.equal(h.timers.size, 0);
});

test('complete realtime events render immediately without an HTTP request', () => {
  let reads=0;const h=harness(async()=>{reads++;return row(1);});
  h.sync.receive(row(2));h.sync.receive(row(1));
  assert.equal(reads,0);assert.equal(h.delivered.length,1);assert.equal(h.delivered[0].version,2);h.sync.stop();
});

test('complete new event supersedes an in-flight older read without rollback or retry', async () => {
  let resolve;const h=harness(()=>new Promise(r=>{resolve=r;}));
  h.sync.receive({status:'live',version:2});h.sync.receive(row(3));resolve(row(2));await flush();
  assert.equal(h.delivered.length,1);assert.equal(h.delivered[0].version,3);assert.equal(h.timers.size,0);h.sync.stop();
});

test('late failed read does not restart retries after a newer complete event', async () => {
  let reject;const h=harness(()=>new Promise((_,r)=>{reject=r;}));
  h.sync.receive({status:'live',version:2});h.sync.receive(row(3));reject(new Error('late network failure'));await flush();
  assert.equal(h.delivered.length,1);assert.equal(h.statuses.at(-1),'connected');assert.equal(h.timers.size,0);h.sync.stop();
});

test('rapid events coalesce and stale fetch cannot flash an older stage', async () => {
  let resolve; let calls = 0;
  const h = harness(() => { calls++; return new Promise(r => { resolve = r; }); });
  h.sync.request(2); for (let i = 3; i <= 50; i++) h.sync.request(i);
  assert.equal(calls, 1); resolve(row(2)); await flush(); assert.equal(h.delivered.length, 0);
  h.retry(); resolve(row(50)); await flush(); assert.equal(h.delivered[0].version, 50); assert.equal(calls, 2); h.sync.stop();
});

test('late response after unsubscribe is ignored', async () => {
  let resolve; const h = harness(() => new Promise(r => { resolve = r; }));
  h.sync.request(2); h.sync.stop(); resolve(row(2)); await flush();
  assert.equal(h.delivered.length, 0); assert.equal(h.statuses.length, 0);
});

test('unversioned event during a read schedules another full read', async () => {
  const resolvers = []; const h = harness(() => new Promise(r => resolvers.push(r)));
  h.sync.request(); h.sync.request(); resolvers.shift()(row(1)); await flush();
  assert.equal(resolvers.length, 1); resolvers.shift()(row(2)); await flush();
  assert.equal(h.delivered.at(-1).version, 2); h.sync.stop();
});

test('50 simulated clients receive complete latest content with at most one concurrent read each', async () => {
  let reads = 0; let inFlight = 0; let maxInFlight = 0;
  const clients = Array.from({ length: 50 }, () => harness(async () => {
    reads++; inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    await flush(); inFlight--; return row(10);
  }));
  for (const client of clients) for (let version = 2; version <= 10; version++) client.sync.request(version);
  await flush(); await flush();
  assert.equal(reads, 50); assert.equal(maxInFlight, 50);
  for (const client of clients) { assert.equal(client.delivered.length, 1); assert.equal(client.delivered[0].version, 10); client.sync.stop(); }
});

test('participant renderer refuses incomplete newer state instead of destroying existing content', async () => {
  const app = await read('app.js');
  const state = { data: { liveSession: row() }, announcedMilestones: new Set() };
  let renders = 0;
  const ctx = vm.createContext({ state, isCompleteLiveSession, renderHome(){}, renderLive(){renders++;}, renderParticipantAnnouncement(){}, announce(){} });
  vm.runInContext(app.slice(app.indexOf('function receiveLiveSession('), app.indexOf('\nfunction handleLiveRealtimeStatus(')), ctx);
  ctx.receiveLiveSession({ status: 'live', version: 2, stage_index: 2 });
  assert.equal(state.data.liveSession.version, 1); assert.equal(renders, 0);
  ctx.receiveLiveSession(row(2)); assert.equal(renders, 1);
});

test('connection fallback is single-flight and periodically checks even a healthy socket', async () => {
  const app=await read('app.js');let reads=0,resolve;
  const service={fetchLiveSession:()=>{reads++;return new Promise(r=>{resolve=r;});}};
  const state={data:{},view:'live',service,realtimeReady:false,realtimeLiveHealthy:false,liveFallbackService:null,lastLiveValidatedAt:Date.now()};
  const received=[];const ctx=vm.createContext({state,document:{hidden:false},getRealtimeStaggerDelay:()=>0,receiveLiveSession:r=>{received.push(r);state.lastLiveValidatedAt=Date.now();}});
  vm.runInContext(app.slice(app.indexOf('async function pollLiveWhileConnecting('),app.indexOf('\nfunction handleContentRealtimeStatus(')),ctx);
  const pending=ctx.pollLiveWhileConnecting();await ctx.pollLiveWhileConnecting();assert.equal(reads,1);
  resolve(row(3));await pending;assert.equal(received.length,1);
  state.realtimeReady=true;state.realtimeLiveHealthy=true;await ctx.pollLiveWhileConnecting();assert.equal(reads,1);
  state.lastLiveValidatedAt=Date.now()-20000;
  const recheck=ctx.pollLiveWhileConnecting();assert.equal(reads,2);resolve(row(4));await recheck;
  const forced=ctx.pollLiveWhileConnecting(true);assert.equal(reads,3);resolve(row(5));await forced;
  state.realtimeLiveHealthy=false;ctx.document.hidden=true;await ctx.pollLiveWhileConnecting();assert.equal(reads,3);
  ctx.document.hidden=false;const stale=ctx.pollLiveWhileConnecting();state.service={};resolve(row(6));await stale;assert.equal(received.length,3);
});

test('initial Presence failure retries without restarting live subscription and stale retry is ignored', async () => {
  const app=await read('app.js');let attempts=0;const timers=new Map();let id=0;
  const state={service:{connectPresence:async()=>{attempts++;if(attempts===1)throw Error('timeout');return async()=>{};}},
    presenceGeneration:0,presenceUpdateInFlight:0,presenceSnapshots:new Map(),sessionId:'test',tabId:'test'};
  const ctx=vm.createContext({state,renderPresence(){},showConnection(){},handleError(){},
    waitForRealtimeStagger:async()=>{},PRESENCE_STAGGER_MAX_MS:16000,
    setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:key=>timers.delete(key)});
  vm.runInContext(app.slice(app.indexOf('async function setPresenceContext('),app.indexOf('\nfunction showView(')),ctx);
  await assert.rejects(ctx.setPresenceContext('live',{stagger:false}));assert.equal(timers.size,1);
  const retry=[...timers.values()][0];timers.clear();retry();await flush();
  assert.equal(attempts,2);assert.equal(state.presenceContext,'live');assert.equal(state.presenceUpdateInFlight,0);
  state.presenceGeneration++;retry();await flush();assert.equal(attempts,2);
});

test('same-context navigation preserves the active presence listener', async () => {
  const app=await read('app.js');let listener,connects=0;
  const state={service:{connectPresence:async(_,cb)=>{connects++;listener=cb;cb({synced:true,count:1,status:'connected'});return async()=>{};}},
    presenceGeneration:0,presenceUpdateInFlight:0,presenceSnapshots:new Map(),sessionId:'test',tabId:'test'};
  const ctx=vm.createContext({state,renderPresence(){},showConnection(){},handleError(){},waitForRealtimeStagger:async()=>{},PRESENCE_STAGGER_MAX_MS:6000,setTimeout,clearTimeout});
  vm.runInContext(app.slice(app.indexOf('async function setPresenceContext('),app.indexOf('\nfunction showView(')),ctx);
  await ctx.setPresenceContext('space',{stagger:false});const generation=state.presenceGeneration;
  await ctx.setPresenceContext('space',{stagger:false});listener({synced:true,count:2,status:'connected'});
  assert.equal(state.presenceCount,2);assert.equal(state.presenceGeneration,generation);assert.equal(connects,1);
});

test('returning to space cancels a delayed live presence transition', async () => {
  const app=await read('app.js');let release,updates=0;
  const state={service:{updatePresenceContext:async(_,cb)=>{updates++;cb({synced:true,count:3,status:'connected'});}},
    presenceContext:'space',presenceDesiredContext:'space',presenceDisconnect:async()=>{},presenceGeneration:1,presenceUpdateInFlight:0,presenceSnapshots:new Map(),sessionId:'test'};
  const ctx=vm.createContext({state,renderPresence(){},showConnection(){},handleError(){},waitForRealtimeStagger:()=>new Promise(r=>{release=r;}),PRESENCE_STAGGER_MAX_MS:6000,setTimeout,clearTimeout});
  vm.runInContext(app.slice(app.indexOf('async function setPresenceContext('),app.indexOf('\nfunction showView(')),ctx);
  const pending=ctx.setPresenceContext('live');await ctx.setPresenceContext('space',{stagger:false});release();await pending;
  assert.equal(state.presenceContext,'space');assert.equal(state.presenceDesiredContext,'space');assert.equal(state.presenceCount,3);assert.equal(updates,1);
});

for (const participant of [true, false]) test(`${participant ? 'participant' : 'admin'} subscription uses full reads, never partial event rows`, async () => {
  const handlers = []; let statusHandler;
  const channel = { on(type, filter, fn) { handlers.push({type, filter, fn}); return this; }, subscribe(fn) { statusHandler = fn; return this; } };
  const service = new SupabaseService({}, { channel: () => channel, removeChannel: async () => {} });
  let fetches = 0; service.fetchLiveSession = async () => { fetches++; return row(12); };
  const delivered = [];
  let stop;
  if (participant) {
    const pending = service.subscribeParticipantUpdates(r => delivered.push(r), () => {});
    handlers.find(h => h.type === 'system').fn({ extension: 'postgres_changes', status: 'ok' }); stop = await pending;
  } else { stop = service.subscribeLive(r => delivered.push(r)); }
  const handler = handlers.find(h => h.filter.table === 'live_sessions');
  handler.fn({ new: { id: 1, status: 'live', version: 12, stage_index: 1 } });
  await flush(); assert.equal(fetches, participant ? 2 : 1); assert.equal(delivered[0].program_snapshot.steps.length, 7);
  await stop(); handler.fn({ new: { version: 13 } }); await flush(); assert.equal(fetches, participant ? 2 : 1);
});

test('announcement publish, replace and clear never replace prayer content with preparation state', async () => {
  const handlers = [];
  const channel = { on(type, filter, fn) { handlers.push({type, filter, fn}); return this; }, subscribe() { return this; } };
  const service = new SupabaseService({}, { channel: () => channel, removeChannel: async () => {} });
  let current = row(20); let received = current;
  service.fetchLiveSession = async () => structuredClone(current);
  const ready = service.subscribeParticipantUpdates(value => { received = value; }, () => {});
  handlers.find(h => h.type === 'system').fn({ extension: 'postgres_changes', status: 'ok' });
  const stop = await ready;
  const update = handlers.find(h => h.filter.table === 'live_sessions').fn;
  const initialContent = deriveLiveView(current).step.content;
  for (const [index, message] of ['첫 공지', '바뀐 공지', ''].entries()) {
    current = { ...current, version: 21 + index, announcement: message, announcement_id: message ? `notice-${index}` : null };
    const { program_snapshot, ...replicationFields } = current;
    // This is exactly the old raw-event replacement failure condition.
    assert.equal(deriveLiveView(replicationFields).step, null);
    update({ new: replicationFields });
    assert.equal(deriveLiveView(received).step.content, initialContent);
    await flush();
    assert.equal(received.announcement, message);
    assert.equal(received.announcement_id, current.announcement_id);
    assert.equal(deriveLiveView(received).stageIndex, 1);
    assert.equal(deriveLiveView(received).step.content, initialContent);
    assert.equal(deriveLiveView(received).steps.length, 7);
  }
  await stop();
});

test('initial subscribe reconciles the startup gap and a data response cannot mark a broken socket healthy', async () => {
  const handlers=[];let socketStatus;const statuses=[];const received=[];
  const channel={on(type,filter,fn){handlers.push({type,filter,fn});return this;},subscribe(fn){socketStatus=fn;return this;}};
  const service=new SupabaseService({}, {channel:()=>channel,removeChannel:async()=>{}});
  service.fetchLiveSession=async()=>row(4);
  const pending=service.subscribeParticipantUpdates(r=>received.push(r),()=>{},s=>statuses.push(s));
  handlers.find(h=>h.type==='system').fn({extension:'postgres_changes',status:'ok'});
  const stop=await pending;await flush();assert.equal(received.at(-1).version,4);
  socketStatus('CHANNEL_ERROR');
  handlers.find(h=>h.filter.table==='live_sessions').fn({new:row(5)});
  assert.equal(received.at(-1).version,5);assert.equal(statuses.at(-1),'reconnecting');await stop();
});
