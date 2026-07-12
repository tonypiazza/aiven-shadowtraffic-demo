import { describe, it, expect, vi } from 'vitest';
import { terminateService } from '../src/lifecycle/aivenClient.js';

describe('terminateService', () => {
  it('DELETEs the correct Aiven URL with auth header', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, text: async () => '' }));
    await terminateService({
      token: 'tok', project: 'proj', service: 'svc', fetchImpl,
      baseUrl: 'https://api.aiven.io',
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.aiven.io/v1/project/proj/service/svc');
    expect(opts.method).toBe('DELETE');
    expect(opts.headers.Authorization).toBe('aivenv1 tok');
  });

  it('throws on non-ok response', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500, text: async () => 'boom' }));
    await expect(terminateService({ token: 't', project: 'p', service: 's', fetchImpl }))
      .rejects.toThrow(/500/);
  });
});
