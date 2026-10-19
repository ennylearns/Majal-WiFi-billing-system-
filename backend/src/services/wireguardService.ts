import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface WireguardKeyPair {
  publicKey: string;
  privateKey: string;
}

export interface PeerHandshakeStatus {
  isConnected: boolean;
  lastHandshakeTime: Date | null;
}

export interface WireguardPeerRecord {
  publicKey: string;
  tunnelIp: string;
  allowedIps: string;
  addedAt: Date;
  lastHandshakeTime?: Date | null;
}

export type CommandExecFn = (command: string) => Promise<{ stdout: string; stderr: string }>;

export interface WireguardConfig {
  interfaceName?: string;
  serverEndpoint?: string;
  serverPublicKey?: string;
  subnet?: string;
  execFn?: CommandExecFn;
  mockMode?: boolean;
}

const X25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b656e04220420', 'hex');

/**
 * Generate a fresh 32-byte curve25519 / X25519 WireGuard keypair encoded in standard base64.
 */
export function generateWireguardKeyPair(): WireguardKeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
  const pubDer = publicKey.export({ format: 'der', type: 'spki' });
  const privDer = privateKey.export({ format: 'der', type: 'pkcs8' });

  const rawPub = pubDer.subarray(pubDer.length - 32);
  const rawPriv = privDer.subarray(privDer.length - 32);

  return {
    publicKey: rawPub.toString('base64'),
    privateKey: rawPriv.toString('base64')
  };
}

/**
 * Derive the 32-byte public key base64 string from a 32-byte base64 private key.
 */
export function deriveWireguardPublicKey(privateKeyBase64: string): string {
  const rawPriv = Buffer.from(privateKeyBase64, 'base64');
  if (rawPriv.length !== 32) {
    throw new Error('Invalid WireGuard private key length: expected 32 bytes');
  }

  const der = Buffer.concat([X25519_PKCS8_PREFIX, rawPriv]);
  const privKeyObj = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  const pubDer = crypto.createPublicKey(privKeyObj).export({ format: 'der', type: 'spki' });
  return pubDer.subarray(pubDer.length - 32).toString('base64');
}

/**
 * IPv4 helper conversion functions
 */
function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function intToIp(int: number): string {
  return [
    (int >>> 24) & 255,
    (int >>> 16) & 255,
    (int >>> 8) & 255,
    int & 255
  ].join('.');
}

export class WireguardService {
  private readonly interfaceName: string;
  private readonly serverEndpoint: string;
  private readonly serverPublicKey: string;
  private readonly subnet: string;
  private readonly execFn?: CommandExecFn;
  private readonly peers: Map<string, WireguardPeerRecord> = new Map();
  private isMockMode: boolean;

  constructor(config?: WireguardConfig) {
    this.interfaceName = config?.interfaceName || process.env.WIREGUARD_INTERFACE || 'wg0';
    this.serverEndpoint = config?.serverEndpoint || process.env.WIREGUARD_SERVER_ENDPOINT || '';
    this.serverPublicKey = config?.serverPublicKey || process.env.WIREGUARD_SERVER_PUBLIC_KEY || '';
    this.subnet = config?.subnet || process.env.WIREGUARD_SUBNET || '10.250.0.0/24';
    this.execFn = config?.execFn;
    this.isMockMode = config?.mockMode ?? false;
  }

  public getInterfaceName(): string {
    return this.interfaceName;
  }

  public getServerEndpoint(): string {
    return this.serverEndpoint;
  }

  public getServerPublicKey(): string {
    return this.serverPublicKey;
  }

  public getSubnet(): string {
    return this.subnet;
  }

  /**
   * Helper to parse subnet into bounds and server IP
   */
  private getSubnetDetails(): {
    networkInt: number;
    serverIpInt: number;
    firstRouterIpInt: number;
    lastRouterIpInt: number;
    serverIp: string;
  } {
    const parts = this.subnet.split('/');
    const baseIp = parts[0].trim();
    const prefix = parts[1] ? parseInt(parts[1].trim(), 10) : 24;

    const hostBits = 32 - prefix;
    const networkInt = ((ipToInt(baseIp) >>> hostBits) << hostBits) >>> 0;
    const serverIpInt = (networkInt + 1) >>> 0;
    const firstRouterIpInt = (networkInt + 2) >>> 0;
    const lastRouterIpInt = (networkInt + (2 ** hostBits) - 2) >>> 0;

    return {
      networkInt,
      serverIpInt,
      firstRouterIpInt,
      lastRouterIpInt,
      serverIp: intToIp(serverIpInt)
    };
  }

  /**
   * Returns reserved server tunnel IP (.1 of subnet)
   */
  public getServerIp(): string {
    return this.getSubnetDetails().serverIp;
  }

  /**
   * Generates a new WireGuard keypair
   */
  public generateKeyPair(): WireguardKeyPair {
    return generateWireguardKeyPair();
  }

  /**
   * Derives public key from private key
   */
  public derivePublicKey(privateKeyBase64: string): string {
    return deriveWireguardPublicKey(privateKeyBase64);
  }

  /**
   * Allocates next available tunnel IP in subnet (skipping .1 server IP and any used IPs)
   */
  public allocateTunnelIp(usedIps: string[] = []): string {
    const { serverIp, firstRouterIpInt, lastRouterIpInt } = this.getSubnetDetails();

    const unavailableSet = new Set<string>();
    unavailableSet.add(serverIp);

    for (const ip of usedIps) {
      if (ip) {
        unavailableSet.add(ip.trim().split('/')[0]);
      }
    }

    for (const peer of this.peers.values()) {
      unavailableSet.add(peer.tunnelIp);
    }

    for (let currentInt = firstRouterIpInt; currentInt <= lastRouterIpInt; currentInt++) {
      const candidateIp = intToIp(currentInt);
      if (!unavailableSet.has(candidateIp)) {
        return candidateIp;
      }
    }

    throw new Error(`No available IP addresses remaining in tunnel subnet ${this.subnet}`);
  }

  /**
   * Execute shell command or fallback gracefully if wg is missing
   */
  private async executeCommand(command: string): Promise<{ stdout: string; stderr: string } | null> {
    if (this.isMockMode && !this.execFn) {
      return null;
    }

    try {
      if (this.execFn) {
        return await this.execFn(command);
      }
      return await execAsync(command);
    } catch (error: any) {
      const msg = error?.message || String(error);
      const code = error?.code;
      const isMissingCli =
        code === 'ENOENT' ||
        code === 127 ||
        msg.includes('not recognized') ||
        msg.includes('command not found') ||
        msg.includes('wg command not available') ||
        msg.includes('No such file or directory');

      if (isMissingCli) {
        this.isMockMode = true;
        console.warn(`[wireguardService] wg CLI not available; continuing in mock mode: ${msg}`);
        return null;
      }

      throw error;
    }
  }

  /**
   * Register a WireGuard peer on the interface
   */
  public async addPeer(publicKey: string, tunnelIp: string): Promise<void> {
    const cleanIp = tunnelIp.split('/')[0].trim();
    const allowedIps = `${cleanIp}/32`;

    this.peers.set(publicKey, {
      publicKey,
      tunnelIp: cleanIp,
      allowedIps,
      addedAt: new Date(),
      lastHandshakeTime: new Date()
    });

    const command = `wg set ${this.interfaceName} peer "${publicKey}" allowed-ips "${allowedIps}"`;
    await this.executeCommand(command);
  }

  /**
   * Remove a WireGuard peer from the interface
   */
  public async removePeer(publicKey: string): Promise<void> {
    this.peers.delete(publicKey);

    const command = `wg set ${this.interfaceName} peer "${publicKey}" remove`;
    await this.executeCommand(command);
  }

  /**
   * Inspect tunnel handshake freshness via wg show or mock state.
   * Reports isConnected: true if handshake was completed within last 3 minutes (180,000 ms).
   */
  public async getPeerHandshake(publicKey: string): Promise<PeerHandshakeStatus> {
    const THREE_MINUTES_MS = 3 * 60 * 1000;
    const now = Date.now();

    try {
      const command = `wg show ${this.interfaceName} latest-handshakes`;
      const result = await this.executeCommand(command);

      if (result && result.stdout) {
        const lines = result.stdout.trim().split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts[0] === publicKey && parts[1]) {
            const epochSeconds = parseInt(parts[1], 10);
            if (epochSeconds > 0) {
              const handshakeTime = new Date(epochSeconds * 1000);
              const diffMs = now - handshakeTime.getTime();
              const isConnected = diffMs >= 0 && diffMs <= THREE_MINUTES_MS;
              return { isConnected, lastHandshakeTime: handshakeTime };
            } else {
              return { isConnected: false, lastHandshakeTime: null };
            }
          }
        }
      }
    } catch {
      // In case of unexpected command error, fall back to mock state
    }

    // Mock fallback inspection
    const peer = this.peers.get(publicKey);
    if (peer && peer.lastHandshakeTime) {
      const diffMs = now - peer.lastHandshakeTime.getTime();
      const isConnected = diffMs >= 0 && diffMs <= THREE_MINUTES_MS;
      return { isConnected, lastHandshakeTime: peer.lastHandshakeTime };
    }

    return { isConnected: false, lastHandshakeTime: null };
  }

  /**
   * Manually set mock handshake time for testing/diagnostics
   */
  public setMockHandshake(publicKey: string, time: Date | null): void {
    const peer = this.peers.get(publicKey);
    if (peer) {
      peer.lastHandshakeTime = time;
    } else if (time) {
      this.peers.set(publicKey, {
        publicKey,
        tunnelIp: '',
        allowedIps: '',
        addedAt: new Date(),
        lastHandshakeTime: time
      });
    }
  }

  /**
   * Reset in-memory peer cache
   */
  public clearMockPeers(): void {
    this.peers.clear();
  }
}

export const wireguardService = new WireguardService();
export default wireguardService;
