import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const moduleEntry = process.env.SUPABASE_JS_ENTRY;
if (!moduleEntry) throw new Error("SUPABASE_JS_ENTRY is required.");

const { createClient } = await import(pathToFileURL(moduleEntry).href);
const configSource = await readFile(new URL("../static/retreat-prayer/config.js", import.meta.url), "utf8");
const matchConfig = (name) => configSource.match(new RegExp(`${name}:\\s*"([^"]+)"`))?.[1];
const supabaseUrl = matchConfig("supabaseUrl");
const publishableKey = matchConfig("supabasePublishableKey");
const presenceTopic = matchConfig("presenceTopic") || "retreat-prayer:presence";
const timeZone = matchConfig("timeZone") || "Asia/Seoul";
const clientCount = Math.max(1, Number(process.env.LOAD_CLIENTS || 60));
const convergenceTargetMs = Math.max(1000, Number(process.env.LOAD_CONVERGENCE_MS || 10_000));
const operationTimeoutMs = Math.max(convergenceTargetMs, Number(process.env.LOAD_OPERATION_TIMEOUT_MS || 25_000));
const staggerMaxMs = Math.max(0, Number(process.env.LOAD_STAGGER_MS || 0));
const presenceStaggerMaxMs = Math.max(staggerMaxMs, Number(process.env.LOAD_PRESENCE_STAGGER_MS || staggerMaxMs));
const authSessionCount = Math.min(clientCount, Math.max(1, Number(process.env.LOAD_AUTH_SESSIONS || 1)));
const bootBurstEnabled = process.env.LOAD_BOOT_BURST !== "false";
const runId = `codex-load-${Date.now().toString(36)}`;
const sessionPrefix = `${runId}-session-`;
const clients = [];
const expectedClosures = new WeakSet();
const errors = [];

function reportPhase(message) {
  console.error(`[retreat-prayer-load] ${message}`);
}

if (!supabaseUrl || !publishableKey) throw new Error("Retreat prayer Supabase configuration is incomplete.");

function createLoadClient() {
  return createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
}

function dateKey(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function assertResult(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message || result.error.code || "request failed"}`);
  return result.data;
}

async function measurePublicBoot(record) {
  const startedAt = performance.now();
  const serverNow = assertResult(await record.client.rpc("server_now"), `server-now-${record.index}`);
  const fetchPublicContent = async () => {
    const settings = assertResult(await record.client
      .from("app_settings")
      .select("id, app_name, church_name, retreat_date, retreat_end_date, time_zone, daily_prayer_time, emergency_notice, updated_at")
      .eq("id", 1)
      .maybeSingle(), `settings-${record.index}`);
    const today = dateKey(serverNow);
    const revisionBefore = assertResult(await record.client
      .from("content_revisions")
      .select("revision")
      .eq("id", 1)
      .maybeSingle(), `revision-before-${record.index}`);
    const [dailyResult, requestsResult] = await Promise.all([
      record.client
        .from("daily_prayers")
        .select("id, prayer_date, scripture_reference, scripture_text, prayer_topic, published, created_at, updated_at")
        .eq("prayer_date", today)
        .eq("published", true)
        .maybeSingle(),
      record.client
        .from("prayer_requests")
        .select("id, display_name, is_anonymous, body, approved_at, created_at, status")
        .eq("status", "approved")
        .order("approved_at", { ascending: false }),
    ]);
    assertResult(dailyResult, `daily-${record.index}`);
    assertResult(requestsResult, `requests-${record.index}`);
    const revisionAfter = assertResult(await record.client
      .from("content_revisions")
      .select("revision")
      .eq("id", 1)
      .maybeSingle(), `revision-after-${record.index}`);
    if (Number(revisionBefore?.revision) !== Number(revisionAfter?.revision)) {
      throw new Error(`content revision changed during boot-${record.index}`);
    }
    return settings;
  };
  const [publicContent, liveResult, mediaResult] = await Promise.all([
    fetchPublicContent(),
    record.client
      .from("live_sessions")
      .select("id, status, mode, scheduled_for, program_id, program_snapshot, stage_index, started_at, stage_started_at, paused_at, accumulated_pause_seconds, paused_remaining_seconds, announcement, media, version, updated_at")
      .eq("id", 1)
      .maybeSingle(),
    record.client
      .from("media_assets")
      .select("id, kind, label, source_url, storage_path, start_seconds, active, created_at")
      .eq("active", true),
  ]);
  void publicContent;
  assertResult(liveResult, `live-${record.index}`);
  assertResult(mediaResult, `media-${record.index}`);
  return Math.round(performance.now() - startedAt);
}

function summarizeDurations(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (ratio) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] || 0;
  return {
    minimumMs: sorted[0] || 0,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    maximumMs: sorted.at(-1) || 0,
  };
}

function withTimeout(promise, label, timeoutMs = operationTimeoutMs) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

function stagger(index, phase) {
  const maximumDelayMs = phase === "home" || phase === "transition" ? presenceStaggerMaxMs : staggerMaxMs;
  if (!maximumDelayMs) return Promise.resolve();
  const phaseOffset = phase === "transition" ? 0.5 : 0;
  const fraction = ((Number(index) + phaseOffset) % clientCount) / clientCount;
  const minimumDelayMs = phase === "home" ? staggerMaxMs : 0;
  return new Promise((resolve) => setTimeout(resolve, minimumDelayMs + Math.round(fraction * maximumDelayMs)));
}

function subscribe(channel, label, { waitForPostgres = false } = {}) {
  return withTimeout(new Promise((resolve, reject) => {
    let settled = false;
    if (waitForPostgres) {
      channel.on("system", {}, (payload) => {
        if (payload?.extension !== "postgres_changes" || settled) return;
        if (payload.status === "ok") {
          settled = true;
          resolve();
          return;
        }
        const status = `POSTGRES_CHANGES_${String(payload.status || "ERROR").toUpperCase()}`;
        errors.push({ label, status, message: payload?.message || null });
        settled = true;
        reject(new Error(`${label} failed with ${status}${payload?.message ? `: ${payload.message}` : ""}`));
      });
    }
    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED" && !waitForPostgres && !settled) {
        settled = true;
        resolve();
        return;
      }
      if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
        errors.push({ label, status, message: error?.message || null });
      }
      if (status === "CLOSED" && !expectedClosures.has(channel)) {
        errors.push({ label, status, message: error?.message || null });
      }
      if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status) && !settled) {
        settled = true;
        reject(new Error(`${label} failed with ${status}${error?.message ? `: ${error.message}` : ""}`));
      }
    });
  }), label);
}

function countRunSessions(channel, expectedContext = null) {
  const sessions = new Set();
  for (const entries of Object.values(channel.presenceState() || {})) {
    for (const entry of Array.isArray(entries) ? entries : [entries]) {
      if (expectedContext && entry?.context !== expectedContext) continue;
      if (typeof entry?.session_id === "string" && entry.session_id.startsWith(sessionPrefix)) {
        sessions.add(entry.session_id);
      }
    }
  }
  return sessions.size;
}

async function waitForConvergence(records, property, expected, label, timeoutMs = operationTimeoutMs, expectedContext = null) {
  const startedAt = performance.now();
  let minimum = 0;
  while (performance.now() - startedAt < timeoutMs) {
    const counts = records.map((record) => countRunSessions(record[property], expectedContext)).filter(Number.isFinite);
    minimum = counts.length ? Math.min(...counts) : 0;
    const converged = expected === 0 ? counts.every((count) => count === 0) : minimum >= expected;
    if (counts.length === records.length && converged) {
      return { durationMs: Math.round(performance.now() - startedAt), minimum };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${label} did not converge: minimum ${minimum}/${expected}`);
}

function createStableChannel(client) {
  return client
    .channel("retreat-prayer:live-state", { config: { private: true } })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_sessions", filter: "id=eq.1" }, () => {})
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "content_revisions", filter: "id=eq.1" }, () => {});
}

async function createPresenceChannel(record, topic, suffix, sessionId) {
  const channel = record.client.channel(topic, {
    config: { private: true, presence: { key: `${runId}-${suffix}-${record.index}` } },
  });
  await subscribe(channel, `${suffix}-presence-${record.index}`);
  await withTimeout(channel.track({ session_id: sessionId, context: suffix, load_test: true }), `${suffix}-track-${record.index}`);
  return channel;
}

async function closeChannel(record, property) {
  const channel = record[property];
  if (!channel) return;
  expectedClosures.add(channel);
  await withTimeout(record.client.removeChannel(channel), `${property}-close-${record.index}`, 15_000);
  record[property] = null;
}

const bootstraps = [];
let observer = null;
let result;
let bootDurations = [];

try {
  reportPhase(`starting ${clientCount} clients`);
  for (let index = 0; index < clientCount; index += 1) {
    clients.push({ client: createLoadClient(), index, home: null, live: null, stable: [] });
  }
  bootDurations = bootBurstEnabled
    ? await Promise.all(clients.map((record) => withTimeout(
      measurePublicBoot(record),
      `public-boot-${record.index}`,
      operationTimeoutMs,
    )))
    : [];
  reportPhase(`public boot complete: p95 ${summarizeDurations(bootDurations).p95Ms}ms`);

  const accessTokens = [];
  for (let index = 0; index < authSessionCount; index += 1) {
    const bootstrap = createLoadClient();
    bootstraps.push(bootstrap);
    const { data: authData, error: authError } = await bootstrap.auth.signInAnonymously();
    if (authError || !authData.session?.access_token) throw authError || new Error("Anonymous load-test session was not issued.");
    accessTokens.push(authData.session.access_token);
  }
  reportPhase(`anonymous auth ready: ${accessTokens.length} session(s)`);

  for (const record of clients) {
    await record.client.realtime.setAuth(accessTokens[record.index % accessTokens.length]);
  }

  const connectStartedAt = performance.now();
  await Promise.all(clients.map(async (record) => {
    await stagger(record.index, "startup");
    const participantUpdates = createStableChannel(record.client);
    record.stable = [participantUpdates];
    await subscribe(participantUpdates, `participant-updates-${record.index}`, { waitForPostgres: true });
    await stagger(record.index, "home");
    record.home = await createPresenceChannel(
      record,
      presenceTopic,
      "home",
      `${sessionPrefix}${record.index}`,
    );
  }));
  const connectDurationMs = Math.round(performance.now() - connectStartedAt);
  reportPhase(`participant channels and home presence joined in ${connectDurationMs}ms`);
  const homeConvergence = await waitForConvergence(clients, "home", clientCount, "home presence", operationTimeoutMs, "home");
  reportPhase(`home presence converged in ${homeConvergence.durationMs}ms`);

  const transitionStartedAt = performance.now();
  await Promise.all(clients.map(async (record) => {
    await stagger(record.index, "transition");
    await withTimeout(
      record.home.track({
        session_id: `${sessionPrefix}${record.index}`,
        context: "live",
        load_test: true,
      }),
      `live-track-${record.index}`,
    );
    record.live = record.home;
    record.home = null;
  }));
  const liveConvergence = await waitForConvergence(clients, "live", clientCount, "live presence", operationTimeoutMs, "live");
  const transitionDurationMs = Math.round(performance.now() - transitionStartedAt);
  reportPhase(`live transition complete in ${transitionDurationMs}ms`);

  const observerClient = createLoadClient();
  await observerClient.realtime.setAuth(accessTokens[0]);
  observer = { client: observerClient, index: "observer", live: null };
  observer.live = await createPresenceChannel(observer, presenceTopic, "observer", `${runId}-observer`);

  const cleanupStartedAt = performance.now();
  await Promise.all(clients.map(async (record) => {
    await closeChannel(record, "live");
    for (const channel of record.stable) {
      expectedClosures.add(channel);
      await withTimeout(record.client.removeChannel(channel), `stable-close-${record.index}`, 15_000);
    }
    await withTimeout(record.client.removeAllChannels(), `all-close-${record.index}`, 15_000);
  }));
  const cleanupConvergence = await waitForConvergence([observer], "live", 0, "presence cleanup");
  const cleanupDurationMs = Math.round(performance.now() - cleanupStartedAt);

  const unexpectedErrors = errors.filter((error) => !["CLOSED"].includes(error.status));
  const pass = unexpectedErrors.length === 0
    && homeConvergence.durationMs <= convergenceTargetMs
    && transitionDurationMs <= convergenceTargetMs
    && cleanupDurationMs <= convergenceTargetMs;

  result = {
    runId,
    clients: clientCount,
    authSessions: authSessionCount,
    pass,
    contract: {
      unexpectedErrors: 0,
      homeConvergenceWithinMs: convergenceTargetMs,
      liveTransitionWithinMs: convergenceTargetMs,
      cleanupWithinMs: convergenceTargetMs,
      staggerMaxMs,
      presenceStaggerMaxMs,
      bootBurstEnabled,
    },
    measurements: {
      connectDurationMs,
      publicBoot: summarizeDurations(bootDurations),
      homeConvergenceMs: homeConvergence.durationMs,
      liveTransitionMs: transitionDurationMs,
      liveConvergenceAfterJoinMs: liveConvergence.durationMs,
      cleanupDurationMs,
      cleanupConvergenceAfterLeaveMs: cleanupConvergence.durationMs,
      unexpectedErrorCount: unexpectedErrors.length,
      errors: unexpectedErrors.slice(0, 20),
    },
  };
} catch (error) {
  result = {
    runId,
    clients: clientCount,
    authSessions: authSessionCount,
    pass: false,
    measurements: {
      publicBoot: summarizeDurations(bootDurations),
    },
    fatal: error?.stack || error?.message || String(error),
    errors: errors.slice(0, 20),
  };
} finally {
  reportPhase("cleaning up load-test channels");
  if (observer?.live) {
    expectedClosures.add(observer.live);
    await Promise.allSettled([
      observer.live.untrack(),
      withTimeout(observer.client.removeAllChannels(), "observer-cleanup", 15_000),
    ]);
  }
  await Promise.allSettled(clients.map((record) => withTimeout(
    record.client.removeAllChannels(),
    `final-client-cleanup-${record.index}`,
    15_000,
  )));
  await Promise.allSettled(bootstraps.map((bootstrap, index) => withTimeout(
    bootstrap.removeAllChannels(),
    `bootstrap-cleanup-${index}`,
    15_000,
  )));
}

console.log(JSON.stringify(result, null, 2));
if (!result.pass) process.exitCode = 1;
