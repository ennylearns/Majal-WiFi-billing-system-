import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { HealthService } from '../healthService';

describe('HealthService Unit Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('PostgreSQL Check', () => {
    test('returns ok with message when prisma $queryRaw succeeds', async () => {
      const stubPrisma = {
        $queryRaw: async () => [{ '?column?': 1 }]
      };
      const service = new HealthService(stubPrisma);
      const result = await service.checkPostgres();

      assert.equal(result.status, 'ok');
      assert.equal(result.message, 'Connected');
    });

    test('returns error with error message when prisma $queryRaw throws', async () => {
      const stubPrisma = {
        $queryRaw: async () => {
          throw new Error('Connection refused');
        }
      };
      const service = new HealthService(stubPrisma);
      const result = await service.checkPostgres();

      assert.equal(result.status, 'error');
      assert.equal(result.message, 'Connection refused');
    });
  });

  describe('Paystack Check', () => {
    test('returns ok when PAYSTACK_SECRET_KEY is defined', () => {
      process.env.PAYSTACK_SECRET_KEY = 'sk_test_1234567890';
      const service = new HealthService({});
      const result = service.checkPaystack();

      assert.equal(result.status, 'ok');
      assert.equal(result.message, 'Configured');
    });

    test('returns error when PAYSTACK_SECRET_KEY is missing or empty', () => {
      delete process.env.PAYSTACK_SECRET_KEY;
      const service = new HealthService({});
      const result = service.checkPaystack();

      assert.equal(result.status, 'error');
      assert.equal(result.message, 'PAYSTACK_SECRET_KEY is not set');
    });
  });

  describe('WireGuard Check', () => {
    test('returns ok when wg show exits with code 0', async () => {
      const stubExec = async (cmd: string) => {
        assert.equal(cmd, 'wg show');
        return { stdout: 'interface: wg0', stderr: '' };
      };
      const service = new HealthService({}, stubExec);
      const result = await service.checkWireguard();

      assert.equal(result.status, 'ok');
      assert.equal(result.message, 'Interface active');
    });

    test('returns error when wg show throws / fails', async () => {
      const stubExec = async () => {
        throw new Error('Command failed: wg show\nwg: command not found');
      };
      const service = new HealthService({}, stubExec);
      const result = await service.checkWireguard();

      assert.equal(result.status, 'error');
      assert.ok(result.message?.includes('Command failed'));
    });
  });

  describe('Aggregated checkHealth()', () => {
    test('aggregates postgres, paystack, and wireguard statuses', async () => {
      process.env.PAYSTACK_SECRET_KEY = 'sk_live_abc';
      const stubPrisma = {
        $queryRaw: async () => [{ '?column?': 1 }]
      };
      const stubExec = async () => ({ stdout: 'interface: wg0', stderr: '' });

      const service = new HealthService(stubPrisma, stubExec);
      const result = await service.checkHealth();

      assert.deepEqual(result, {
        postgres: { status: 'ok', message: 'Connected' },
        paystack: { status: 'ok', message: 'Configured' },
        wireguard: { status: 'ok', message: 'Interface active' }
      });
    });
  });
});
