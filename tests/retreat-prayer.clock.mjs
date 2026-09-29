import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = name => readFile(new URL('../static/retreat-prayer/assets/' + name, import.meta.url), 'utf8');
const uri = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const backendSource = (await read('backend.js'))
  .replace('./core.js?v=20260829-4', uri(await read('core.js')))
  .replace('./live-sync.js?v=20260917-3', uri(await read('live-sync.js')));
const { SupabaseService } = await import(uri(backendSource));
const base = Date.parse('2026-09-29T10:00:00Z');
const flush = () => new Promise(resolve => setImmediate(resolve));

function harness(t, { revisions = [1], holdLive = false } = {}) {
  let elapsed = 0;
  let rpcCalls = 0;
  let revisionReads = 0;
  let releaseLive;
  t.mock.method(performance, 'now', () => elapsed);
  const client = {
    async rpc(name) {
      assert.equal(name, 'server_now');
      rpcCalls++;
      elapsed += 200;
      // Symmetric 100 ms outbound / inbound latency around the server sample.
      return { data: new Date(base + elapsed - 100).toISOString(), error: null };
    },
    from(table) {
      const query = {
        select() { return this; }, eq() { return this; }, order() { return this; }, maybeSingle() { return this; },
        then(resolve, reject) {
          if (table === 'live_sessions' && holdLive) {
            return new Promise(done => { releaseLive = () => { elapsed += 5000; done({ data: { id: 1 }, error: null }); }; }).then(resolve, reject);
          }
          elapsed += 750;
          const data = table === 'app_settings' ? { time_zone: 'Asia/Seoul' }
            : table === 'content_revisions' ? { revision: revisions[Math.min(revisionReads++, revisions.length - 1)] }
            : table === 'prayer_requests' || table === 'media_assets' ? [] : null;
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return {
    service: new SupabaseService({ timeZone: 'Asia/Seoul' }, client),
    advance(ms) { elapsed += ms; },
    expected() { return base + elapsed; },
    rpcCalls() { return rpcCalls; },
    releaseLive() { releaseLive(); },
  };
}

test('public content timestamp includes all delayed query rounds and half-RTT correction once', async t => {
  const h = harness(t);
  const content = await h.service.fetchPublicContent();
  assert.equal(Date.parse(content.serverNow), h.expected());
  assert.equal(h.rpcCalls(), 1);
  assert.equal(content.contentRevision, 1);
});

test('initial supplied server time preserves elapsed time before content loading without another RPC', async t => {
  const h = harness(t);
  const serverNow = await h.service.getServerTime();
  assert.equal(Date.parse(serverNow), h.expected());
  h.advance(2100);
  const content = await h.service.loadPublicData(serverNow);
  assert.equal(Date.parse(content.serverNow), h.expected());
  assert.equal(h.rpcCalls(), 1);
});

test('slow parallel live read advances the already completed public-content timestamp', async t => {
  const h = harness(t, { holdLive: true });
  const pending = h.service.loadPublicData();
  await flush();
  h.releaseLive();
  const content = await pending;
  assert.equal(Date.parse(content.serverNow), h.expected());
});

test('device wall-clock changes do not contaminate measured query latency', async t => {
  const h = harness(t);
  const serverNow = await h.service.getServerTime();
  t.mock.method(Date, 'now', () => base + 86_400_000);
  h.advance(1800);
  const content = await h.service.fetchPublicContent(serverNow);
  assert.equal(Date.parse(content.serverNow), h.expected());
});

test('revision retry uses its new sample without accumulating latency compensation twice', async t => {
  const h = harness(t, { revisions: [1, 2, 2, 2] });
  const content = await h.service.fetchPublicContent();
  assert.equal(content.contentRevision, 2);
  assert.equal(Date.parse(content.serverNow), h.expected());
  assert.equal(h.rpcCalls(), 2);
});
