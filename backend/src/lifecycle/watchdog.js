import { terminateService } from './aivenClient.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function teardownAll({ token, project, services, terminateImpl = terminateService, retries = 3, delayMs = 2000 }) {
  const succeeded = [];
  const failed = [];
  for (const service of services) {
    let ok = false;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await terminateImpl({ token, project, service });
        ok = true;
        break;
      } catch (err) {
        if (attempt < retries) await sleep(delayMs);
      }
    }
    (ok ? succeeded : failed).push(service);
  }
  return { succeeded, failed };
}

export function startWatchdog({ token, project, services, ttlMs = 60 * 60 * 1000 }) {
  console.log(`watchdog armed: teardown in ${ttlMs / 60000} min`);
  return setTimeout(async () => {
    console.log('watchdog firing: tearing down services', services);
    const summary = await teardownAll({ token, project, services });
    console.log('watchdog teardown summary', JSON.stringify(summary));
  }, ttlMs);
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
  startWatchdog({ token, project, services });
  setInterval(() => {}, 1 << 30); // keep process alive
}
