import { readFileSync } from 'node:fs';
import { terminateService, listIntegrations, connectServicesFrom } from './aivenClient.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Discover services wired to Kafka after deploy (the notebook's dedicated Kafka
// Connect) and merge them into the teardown list, deleting each discovered service
// BEFORE Kafka. The static AIVEN_SERVICES list can't include them because it's set
// at deploy time. Best-effort: if discovery fails, fall back to the original list.
export async function expandServices({ token, project, services, kafkaService, listImpl = listIntegrations, log = console }) {
  if (!kafkaService || !services.includes(kafkaService)) return services;
  let discovered = [];
  try {
    const integrations = await listImpl({ token, project, service: kafkaService });
    discovered = connectServicesFrom(integrations, kafkaService).filter((s) => !services.includes(s));
  } catch (err) {
    log.error(`watchdog: integration discovery failed (using static list): ${err.message}`);
    return services;
  }
  if (!discovered.length) return services;
  log.log(`watchdog: discovered services wired to ${kafkaService}: ${discovered.join(', ')}`);
  // Insert discovered services just before Kafka so they're torn down first.
  const idx = services.indexOf(kafkaService);
  return [...services.slice(0, idx), ...discovered, ...services.slice(idx)];
}

export async function teardownAll({ token, project, services, terminateImpl = terminateService, retries = 3, delayMs = 2000, log = console }) {
  const succeeded = [];
  const failed = [];
  for (const service of services) {
    let ok = false;
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await terminateImpl({ token, project, service });
        ok = true;
        break;
      } catch (err) {
        lastErr = err;
        // Log every failed attempt — silent retries hid the real cause in the
        // first live run (the UI said "tearing down" but nothing was deleted).
        log.error(`watchdog: terminate ${service} attempt ${attempt + 1}/${retries + 1} failed: ${err.message}`);
        if (attempt < retries) await sleep(delayMs);
      }
    }
    if (ok) {
      succeeded.push(service);
      log.log(`watchdog: terminated ${service}`);
    } else {
      failed.push(service);
      log.error(`watchdog: GAVE UP on ${service} after ${retries + 1} attempts: ${lastErr?.message}`);
    }
  }
  return { succeeded, failed };
}

// Read the app's persisted start epoch (seconds) written by the entrypoint, so the
// TTL is anchored to WALL-CLOCK start — not this process's uptime. Without this, a
// watchdog crash+restart (supervisord autorestart) would reset a setTimeout and the
// teardown would never fire, which is what happened in the first live run.
export function readStartedAtMs(path, readImpl = readFileSync) {
  try {
    const secs = parseInt(String(readImpl(path)).trim(), 10);
    if (Number.isFinite(secs) && secs > 0) return secs * 1000;
  } catch {
    // fall through
  }
  return null;
}

export function startWatchdog({
  token, project, services, ttlMs = 60 * 60 * 1000,
  startedAtMs = null, checkIntervalMs = 30 * 1000, now = Date.now, setIntervalImpl = setInterval,
  terminateImpl, kafkaService = null, listImpl,
}) {
  const start = startedAtMs ?? now();
  const deadline = start + ttlMs;
  let fired = false;
  console.log(`watchdog armed: teardown at ${new Date(deadline).toISOString()} (${Math.round((deadline - now()) / 60000)} min from now)`);
  // Poll the deadline instead of a single setTimeout: survives restarts because the
  // deadline is derived from a persisted start time, and re-checks on an interval.
  const id = setIntervalImpl(async () => {
    if (now() < deadline || fired) return;
    fired = true;
    const full = await expandServices({ token, project, services, kafkaService, ...(listImpl ? { listImpl } : {}) });
    console.log('watchdog firing: tearing down services', full);
    const summary = await teardownAll({ token, project, services: full, ...(terminateImpl ? { terminateImpl } : {}) });
    console.log('watchdog teardown summary', JSON.stringify(summary));
    if (summary.failed.length) {
      console.error(`watchdog: ${summary.failed.length} service(s) NOT deleted — manual cleanup required:`, summary.failed);
    }
  }, checkIntervalMs);
  return id;
}

// Run as a standalone process under supervisord.
if (process.argv[1] && process.argv[1].endsWith('watchdog.js')) {
  const token = process.env.AIVEN_TOKEN;
  const project = process.env.AIVEN_PROJECT;
  const services = (process.env.AIVEN_SERVICES || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!token || !project || services.length === 0) {
    console.error('watchdog missing AIVEN_TOKEN / AIVEN_PROJECT / AIVEN_SERVICES');
    process.exit(1);
  }
  const startedAtMs = readStartedAtMs(process.env.STARTED_AT_FILE || '/data/started_at');
  // KAFKA_SERVICE lets the watchdog discover the notebook-created Kafka Connect
  // service via Kafka's integrations and tear it down too (not in AIVEN_SERVICES).
  const kafkaService = process.env.KAFKA_SERVICE || null;
  startWatchdog({ token, project, services, startedAtMs, kafkaService });
  setInterval(() => {}, 1 << 30); // keep process alive
}
