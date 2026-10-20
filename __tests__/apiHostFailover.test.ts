/**
 * Host failover ka regression test.
 *
 * Background: `API_HOSTS` me ek waqt dono entries ek hi host thi
 * (`slovecarebackend.slovecare.in` × 2) — failover marr gaya aur ek dead host
 * par app 2 × 20s = 40s latka rehta tha ("Request timed out").
 *
 * Ye test pakka karta hai ki:
 *   1. pehla host network-level fail ho to agla host try hota hai aur data
 *      aata hai (user ko 20s wait nahi karna padta),
 *   2. server 4xx/5xx ka error caller tak pahunchta hai — request HANG nahi
 *      hoti aur error swallow bhi nahi hota,
 *   3. saare hosts fail hone par ek clear "Unable to reach" error aata hai.
 *
 * @format
 */

const calls: string[] = [];

/** Har host ka behaviour test me decide karta hai. */
let handler: (url: string) => Promise<unknown> = async () => {
  throw new Error('handler not set');
};

const okResponse = (data: unknown) => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true, statusCode: 200, message: 'ok', data, timestamp: '' }),
});

const errorResponse = (status: number, message: string) => ({
  ok: false,
  status,
  json: async () => ({ success: false, statusCode: status, message, data: null, timestamp: '' }),
});

const mockFetch = jest.fn(async (url: string) => {
  const target = String(url);
  calls.push(target);
  return handler(target);
});
// @ts-expect-error — global fetch ko test ke liye mock kar rahe hain
global.fetch = mockFetch;

const HOST_PRIMARY = 'https://slovecarebackend.slovecare.in';
const HOST_FALLBACK = 'https://api.slovecare.in';

/** Ek real (non-seeded) vendor — demo filter ise nahi hatata. */
const VENDOR = { id: 'ven-doct-261275', name: 'Dr sharda', type: 'doctor' };

function loadApi() {
  jest.resetModules();
  return require('../src/api/api').default;
}

describe('API host failover', () => {
  beforeEach(() => {
    calls.length = 0;
    mockFetch.mockClear();
  });

  it('pehla host network fail ho to agle host se data aa jaata hai', async () => {
    handler = async url => {
      if (url.startsWith(HOST_PRIMARY)) {
        throw new TypeError('Network request failed');
      }
      return okResponse([VENDOR]);
    };

    const api = loadApi();
    const result = await api.doctors.list();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Dr sharda');
    /* Dono hosts try hue — aur pehla fail hone par agla turant chala. */
    expect(calls.some(u => u.startsWith(HOST_PRIMARY))).toBe(true);
    expect(calls.some(u => u.startsWith(HOST_FALLBACK))).toBe(true);
  });

  it('server ka 4xx error caller tak pahunchta hai (request hang nahi hoti)', async () => {
    handler = async () => errorResponse(404, 'User profile not found.');

    const api = loadApi();

    /* Agar error swallow ho jaye ya promise pending rahe to ye test timeout
       hoga — yahi bug (unhandled rejection + hanging request) tha. */
    await expect(api.auth.me()).rejects.toThrow('User profile not found.');
  });

  it('saare hosts fail hone par clear "Unable to reach" error aata hai', async () => {
    handler = async () => {
      throw new TypeError('Network request failed');
    };

    const api = loadApi();

    await expect(api.doctors.list()).rejects.toThrow(/Unable to reach SloveCare server/);
  });

  it('healthy host par sirf ek request jati hai (extra load nahi)', async () => {
    handler = async () => okResponse([VENDOR]);

    const api = loadApi();
    await api.doctors.list();

    expect(calls).toHaveLength(1);
    expect(calls[0].startsWith(HOST_PRIMARY)).toBe(true);
  });
});
