import { aioRequestCgminerApiBySock } from '../src/cg-miner-api';
import { startMockCgminerServer } from './mock-cgminer-server';

jest.setTimeout(15000);

describe('CGMiner transport (socket)', () => {
  it('parses chunked, null-terminated JSON responses', async () => {
    const server = await startMockCgminerServer({
      respond: () => {
        const payload =
          JSON.stringify({
            STATUS: [{ STATUS: 'S', When: 1, Code: 0, Msg: 'OK' }],
            SUMMARY: [{ Elapsed: 1, 'MHS 5s': 123.4 }],
            id: 1,
          }) + '\0';

        return {
          chunks: [payload.slice(0, 25), payload.slice(25)],
          delayMs: 10,
        };
      },
    });

    try {
      const result = await aioRequestCgminerApiBySock('127.0.0.1', 'summary', '', {
        port: server.port,
        firstTimeout: 1,
        retry: 0,
        totalTimeout: 5,
      });

      expect(result.isRequestSuccess()).toBe(true);
      expect(result.summaryTyped()?.[0]?.Elapsed).toBe(1);
      expect(result.responseDict().SUMMARY).toBeDefined();
    } finally {
      await server.close();
    }
  });

  it('returns {} on invalid JSON without throwing', async () => {
    const server = await startMockCgminerServer({
      respond: () => 'invalid json\0',
    });

    try {
      const result = await aioRequestCgminerApiBySock('127.0.0.1', 'summary', '', {
        port: server.port,
        firstTimeout: 1,
        retry: 0,
        totalTimeout: 5,
      });

      expect(result.responseDict()).toEqual({});
    } finally {
      await server.close();
    }
  });
});


