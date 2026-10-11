/**
 * Bearer token bug ka regression test.
 *
 * Bug: `api.bookings.list()` / `api.bookings.byId()` `auth: false` ke saath
 * bani thi, isliye request par `Authorization: Bearer <token>` header hi
 * nahi jata tha. Backend in dono routes ko `protect()` ke peeche rakhta hai
 * (GET /bookings, GET /bookings/:id) → 401 "Access denied. Bearer token
 * missing." — Appointments screen par yahi raw error dikhta tha.
 *
 * Ye test pakka karta hai ki booking reads token ke saath jaati hain.
 *
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN = 'test.jwt.token';

const envelope = <T,>(data: T) => ({
  success: true,
  statusCode: 200,
  message: 'ok',
  data,
  timestamp: new Date().toISOString(),
});

/** fetch mock — har call ka URL + headers capture karta hai. */
const calls: { url: string; headers: Record<string, string> }[] = [];
const okResponse = (data: unknown) => ({
  ok: true,
  status: 200,
  json: async () => envelope(data),
});

const mockFetch = jest.fn(async (url: string, init: { headers: Record<string, string> }) => {
  calls.push({ url: String(url), headers: init.headers });
  return okResponse([]);
});
// @ts-expect-error — global fetch ko test ke liye mock kar rahe hain
global.fetch = mockFetch;

describe('bookings reads — Bearer token', () => {
  beforeEach(async () => {
    calls.length = 0;
    mockFetch.mockClear();
    await AsyncStorage.setItem('slovecare_user_token', TOKEN);
  });

  it('list() Authorization header ke saath GET /bookings karta hai', async () => {
    const api = require('../src/api/api').default;

    const list = await api.bookings.list({ userId: 'usr-1', status: 'confirmed' });

    expect(list).toEqual([]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('/api/v1/bookings');
    expect(calls[0].url).toContain('userId=usr-1');
    expect(calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('byId() Authorization header ke saath GET /bookings/:id karta hai', async () => {
    const api = require('../src/api/api').default;

    await api.bookings.byId('bk-123');

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('/api/v1/bookings/bk-123');
    expect(calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });
});
