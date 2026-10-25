import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  WireguardService,
  wireguardService,
  generateWireguardKeyPair,
  deriveWireguardPublicKey
} from './wireguardService';

describe('WireguardService - Keypair Generation', () => {
  test('generates valid 32-byte base64 curve25519 keypair', () => {
    const keyPair = generateWireguardKeyPair();
    assert.ok(keyPair.publicKey, 'publicKey should be present');
    assert.ok(keyPair.privateKey, 'privateKey should be present');

    const pubBuffer = Buffer.from(keyPair.publicKey, 'base64');
    const privBuffer = Buffer.from(keyPair.privateKey, 'base64');

    assert.equal(pubBuffer.length, 32, 'public key must be 32 bytes raw');
    assert.equal(privBuffer.length, 32, 'private key must be 32 bytes raw');
    assert.equal(keyPair.publicKey.length, 44, 'base64 wireguard key is 44 characters');
    assert.equal(keyPair.privateKey.length, 44, 'base64 wireguard key is 44 characters');
  });

  test('generates unique keypairs on successive calls', () => {
    const kp1 = generateWireguardKeyPair();
    const kp2 = generateWireguardKeyPair();
    assert.notEqual(kp1.publicKey, kp2.publicKey);
    assert.notEqual(kp1.privateKey, kp2.privateKey);
  });

  test('derives correct public key from private key', () => {
    const keyPair = generateWireguardKeyPair();
    const derivedPub = deriveWireguardPublicKey(keyPair.privateKey);
    assert.equal(derivedPub, keyPair.publicKey);
  });

  test('service instance generates keypair matching helper function', () => {
    const service = new WireguardService();
    const keyPair = service.generateKeyPair();
    assert.equal(Buffer.from(keyPair.publicKey, 'base64').length, 32);
    assert.equal(Buffer.from(keyPair.privateKey, 'base64').length, 32);
    assert.equal(service.derivePublicKey(keyPair.privateKey), keyPair.publicKey);
  });
});

describe('WireguardService - Subnet and IP Allocation', () => {
  let service: WireguardService;

  beforeEach(() => {
    service = new WireguardService({
      subnet: '10.250.0.0/24'
    });
  });

  test('reserves .1 for server and identifies server IP correctly', () => {
    assert.equal(service.getServerIp(), '10.250.0.1');
  });

  test('allocates first router IP starting at .2 when no IPs used', () => {
    const ip = service.allocateTunnelIp();
    assert.equal(ip, '10.250.0.2');
  });

  test('allocates next sequential IP when existing IPs are provided', () => {
    const ip = service.allocateTunnelIp(['10.250.0.2', '10.250.0.3']);
    assert.equal(ip, '10.250.0.4');
  });

  test('fills gaps from freed/deleted IPs', () => {
    const ip = service.allocateTunnelIp(['10.250.0.2', '10.250.0.4']);
    assert.equal(ip, '10.250.0.3');
  });

  test('takes registered peers into account during allocation', async () => {
    const kp1 = generateWireguardKeyPair();
    await service.addPeer(kp1.publicKey, '10.250.0.2');

    const nextIp = service.allocateTunnelIp();
    assert.equal(nextIp, '10.250.0.3');
  });

  test('never allocates server IP .1 even if omitted from used list', () => {
    const ip = service.allocateTunnelIp([]);
    assert.notEqual(ip, '10.250.0.1');
    assert.equal(ip, '10.250.0.2');
  });

  test('throws error when subnet pool is completely exhausted', () => {
    // /30 has 4 IPs: .0 net, .1 server, .2 router, .3 broadcast
    const smallSubnetService = new WireguardService({ subnet: '10.250.0.0/30' });
    const ip = smallSubnetService.allocateTunnelIp();
    assert.equal(ip, '10.250.0.2');

    assert.throws(
      () => smallSubnetService.allocateTunnelIp(['10.250.0.2']),
      /No available IP addresses/
    );
  });
});

describe('WireguardService - Peer Management and CLI execution', () => {
  test('executes wg set add peer with correct arguments', async () => {
    const executedCommands: string[] = [];
    const service = new WireguardService({
      interfaceName: 'wg0',
      execFn: async (cmd) => {
        executedCommands.push(cmd);
        return { stdout: '', stderr: '' };
      }
    });

    const kp = generateWireguardKeyPair();
    await service.addPeer(kp.publicKey, '10.250.0.2');

    assert.equal(executedCommands.length, 1);
    assert.equal(
      executedCommands[0],
      `wg set wg0 peer "${kp.publicKey}" allowed-ips "10.250.0.2/32"`
    );
  });

  test('normalizes allowed-ips when passed with or without /32', async () => {
    const executedCommands: string[] = [];
    const service = new WireguardService({
      interfaceName: 'wg-test',
      execFn: async (cmd) => {
        executedCommands.push(cmd);
        return { stdout: '', stderr: '' };
      }
    });

    const kp = generateWireguardKeyPair();
    await service.addPeer(kp.publicKey, '10.250.0.5/32');

    assert.equal(
      executedCommands[0],
      `wg set wg-test peer "${kp.publicKey}" allowed-ips "10.250.0.5/32"`
    );
  });

  test('executes wg set remove peer with correct arguments', async () => {
    const executedCommands: string[] = [];
    const service = new WireguardService({
      interfaceName: 'wg0',
      execFn: async (cmd) => {
        executedCommands.push(cmd);
        return { stdout: '', stderr: '' };
      }
    });

    const kp = generateWireguardKeyPair();
    await service.addPeer(kp.publicKey, '10.250.0.2');
    await service.removePeer(kp.publicKey);

    assert.equal(executedCommands.length, 2);
    assert.equal(
      executedCommands[1],
      `wg set wg0 peer "${kp.publicKey}" remove`
    );
  });

  test('falls back gracefully without throwing when wg CLI is missing (ENOENT / not found)', async () => {
    const service = new WireguardService({
      interfaceName: 'wg0',
      execFn: async () => {
        const err = new Error('spawn wg ENOENT');
        (err as any).code = 'ENOENT';
        throw err;
      }
    });

    const kp = generateWireguardKeyPair();
    // Should not throw
    await assert.doesNotReject(async () => {
      await service.addPeer(kp.publicKey, '10.250.0.2');
    });

    await assert.doesNotReject(async () => {
      await service.removePeer(kp.publicKey);
    });
  });

  test('falls back gracefully when wg CLI fails with command not found', async () => {
    const service = new WireguardService({
      interfaceName: 'wg0',
      execFn: async () => {
        const err = new Error("'wg' is not recognized as an internal or external command");
        throw err;
      }
    });

    const kp = generateWireguardKeyPair();
    await assert.doesNotReject(async () => {
      await service.addPeer(kp.publicKey, '10.250.0.2');
    });
  });
});

describe('WireguardService - Peer Handshake Inspection', () => {
  test('parses wg show latest-handshakes output for connected peer (< 3 minutes)', async () => {
    const kp = generateWireguardKeyPair();
    const recentEpochSeconds = Math.floor((Date.now() - 60 * 1000) / 1000); // 1 minute ago

    const service = new WireguardService({
      interfaceName: 'wg0',
      execFn: async (cmd) => {
        if (cmd.includes('latest-handshakes')) {
          return {
            stdout: `${kp.publicKey}\t${recentEpochSeconds}\nOTHERKEY=\t1700000000\n`,
            stderr: ''
          };
        }
        return { stdout: '', stderr: '' };
      }
    });

    const status = await service.getPeerHandshake(kp.publicKey);
    assert.equal(status.isConnected, true);
    assert.ok(status.lastHandshakeTime instanceof Date);
    assert.equal(status.lastHandshakeTime.getTime(), recentEpochSeconds * 1000);
  });

  test('reports disconnected when handshake is older than 3 minutes', async () => {
    const kp = generateWireguardKeyPair();
    const oldEpochSeconds = Math.floor((Date.now() - 4 * 60 * 1000) / 1000); // 4 minutes ago

    const service = new WireguardService({
      interfaceName: 'wg0',
      execFn: async () => ({
        stdout: `${kp.publicKey}\t${oldEpochSeconds}\n`,
        stderr: ''
      })
    });

    const status = await service.getPeerHandshake(kp.publicKey);
    assert.equal(status.isConnected, false);
    assert.ok(status.lastHandshakeTime instanceof Date);
    assert.equal(status.lastHandshakeTime.getTime(), oldEpochSeconds * 1000);
  });

  test('reports disconnected and null date when peer has never handshaked (epoch 0)', async () => {
    const kp = generateWireguardKeyPair();

    const service = new WireguardService({
      interfaceName: 'wg0',
      execFn: async () => ({
        stdout: `${kp.publicKey}\t0\n`,
        stderr: ''
      })
    });

    const status = await service.getPeerHandshake(kp.publicKey);
    assert.equal(status.isConnected, false);
    assert.equal(status.lastHandshakeTime, null);
  });

  test('falls back to mock state when wg show fails', async () => {
    const service = new WireguardService({
      interfaceName: 'wg0',
      execFn: async () => {
        throw new Error('wg command not available');
      }
    });

    const kp = generateWireguardKeyPair();
    await service.addPeer(kp.publicKey, '10.250.0.2');

    // Freshly added peer in mock state
    const status = await service.getPeerHandshake(kp.publicKey);
    assert.equal(status.isConnected, true);
    assert.ok(status.lastHandshakeTime instanceof Date);

    // Explicitly set mock handshake to 5 minutes ago
    service.setMockHandshake(kp.publicKey, new Date(Date.now() - 5 * 60 * 1000));
    const expiredStatus = await service.getPeerHandshake(kp.publicKey);
    assert.equal(expiredStatus.isConnected, false);

    // Unregistered peer
    const unknownStatus = await service.getPeerHandshake('unknown-key-12345');
    assert.equal(unknownStatus.isConnected, false);
    assert.equal(unknownStatus.lastHandshakeTime, null);
  });
});

describe('WireguardService - Environment Configuration & Singleton', () => {
  test('reads defaults and env variables correctly', () => {
    const customService = new WireguardService({
      interfaceName: 'wg-custom',
      serverEndpoint: 'vpn.test.org:51820',
      serverPublicKey: 'server-pub-key-123=',
      subnet: '10.200.0.0/24'
    });

    assert.equal(customService.getInterfaceName(), 'wg-custom');
    assert.equal(customService.getServerEndpoint(), 'vpn.test.org:51820');
    assert.equal(customService.getServerPublicKey(), 'server-pub-key-123=');
    assert.equal(customService.getSubnet(), '10.200.0.0/24');
    assert.equal(customService.getServerIp(), '10.200.0.1');
  });

  test('exports singleton wireguardService', () => {
    assert.ok(wireguardService instanceof WireguardService);
    assert.equal(typeof wireguardService.generateKeyPair, 'function');
    assert.equal(typeof wireguardService.allocateTunnelIp, 'function');
    assert.equal(typeof wireguardService.addPeer, 'function');
    assert.equal(typeof wireguardService.removePeer, 'function');
    assert.equal(typeof wireguardService.getPeerHandshake, 'function');
  });
});
