import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import defaultPrisma, { prisma, disconnectDb } from './db';

describe('Database Client Singleton (db.ts)', () => {
  test('exports shared prisma instance as named and default export', () => {
    assert.ok(prisma, 'named export prisma should be defined');
    assert.ok(defaultPrisma, 'default export prisma should be defined');
    assert.strictEqual(prisma, defaultPrisma, 'named and default export must reference identical instance');
    assert.strictEqual(typeof prisma.$connect, 'function', 'prisma should have $connect method');
    assert.strictEqual(typeof prisma.$disconnect, 'function', 'prisma should have $disconnect method');
  });

  test('exports disconnectDb lifecycle function', () => {
    assert.strictEqual(typeof disconnectDb, 'function', 'disconnectDb should be a function');
  });

  test('caches prisma on globalThis in non-production environments', () => {
    const globalObj = globalThis as unknown as { prisma?: unknown };
    assert.strictEqual(globalObj.prisma, prisma, 'globalThis.prisma should match singleton instance in test/dev');
  });

  test('disconnectDb calls $disconnect without throwing', async () => {
    await assert.doesNotReject(async () => {
      await disconnectDb();
    });
  });
});
