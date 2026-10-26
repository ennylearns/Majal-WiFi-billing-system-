import crypto from 'crypto';
import { PrismaClient, Router } from '@prisma/client';
import wireguardService, { WireguardService } from './wireguardService';
import { MikrotikService, MikrotikCredentials, UserSession } from './mikrotikService';
import {
  generateProvisioningScript,
  ProvisioningRouterInfo,
  ProvisioningScriptOptions,
} from './provisioningScriptService';
import { prisma as defaultPrisma } from '../database/db';

export { ProvisioningScriptOptions };

export type DeleteRouterResult =
  | { outcome: 'deactivated'; router: Router }
  | { outcome: 'deleted' };

export type TestConnectionStatus = 'online' | 'tunnel_offline' | 'auth_failed' | 'unreachable';

export interface TestConnectionResult {
  success: boolean;
  status: TestConnectionStatus;
  message?: string;
  error?: string;
}

export interface RouterStatusResult {
  activeUsers: number;
  users: UserSession[];
}

export type MikrotikServiceFactory = (credentials: MikrotikCredentials) => MikrotikService;

export type ProvisioningScriptGenerator = (
  router: ProvisioningRouterInfo,
  options?: ProvisioningScriptOptions
) => string;

export interface CreateRouterInput {
  name: string;
  location: string;
  port?: number;
  username?: string;
  password?: string;
  host?: string;
}

export interface UpdateRouterInput {
  name?: string;
  location?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  isActive?: boolean;
}

const defaultMikrotikFactory: MikrotikServiceFactory = (creds) => new MikrotikService(creds);

export class RouterService {
  private prisma: PrismaClient;
  private wireguard: WireguardService;
  private mikrotikFactory: MikrotikServiceFactory;
  private provisioningScriptGenerator: ProvisioningScriptGenerator;

  constructor(
    prismaClient: PrismaClient = defaultPrisma,
    wireguardServiceInstance: WireguardService = wireguardService,
    mikrotikFactory: MikrotikServiceFactory = defaultMikrotikFactory,
    provisioningScriptGenerator: ProvisioningScriptGenerator = generateProvisioningScript
  ) {
    this.prisma = prismaClient;
    this.wireguard = wireguardServiceInstance;
    this.mikrotikFactory = mikrotikFactory;
    this.provisioningScriptGenerator = provisioningScriptGenerator;
  }


  /**
   * Retrieve all routers ordered by creation date descending.
   */
  async listRouters(): Promise<Router[]> {
    return await this.prisma.router.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieve a single router by its unique identifier.
   */
  async getRouterById(id: string): Promise<Router | null> {
    return await this.prisma.router.findUnique({
      where: { id },
    });
  }

  /**
   * Create a router with auto-generated credentials, WireGuard keypair,
   * allocated tunnel IP, and WireGuard peer registration.
   */
  async createRouter(data: CreateRouterInput): Promise<Router> {
    const username: string =
      data.username || `router_${crypto.randomBytes(4).toString('hex')}`;
    const password: string =
      data.password || crypto.randomBytes(16).toString('hex');

    const keyPair = this.wireguard.generateKeyPair();

    const existingRouters = await this.prisma.router.findMany({
      select: { wgTunnelIp: true },
    });
    const usedIps = existingRouters
      .map((r) => r.wgTunnelIp)
      .filter((ip): ip is string => ip !== null);

    const tunnelIp = this.wireguard.allocateTunnelIp(usedIps);
    const host = data.host || tunnelIp;
    const port = data.port !== undefined ? Number(data.port) : 8728;

    const routerRecord = await this.prisma.router.create({
      data: {
        name: data.name,
        location: data.location,
        host,
        port,
        username,
        password,
        wgPublicKey: keyPair.publicKey,
        wgPrivateKey: keyPair.privateKey,
        wgTunnelIp: tunnelIp,
      },
    });

    try {
      await this.wireguard.addPeer(keyPair.publicKey, tunnelIp);
    } catch (wgErr) {
      await this.prisma.router.delete({ where: { id: routerRecord.id } });
      throw wgErr;
    }

    return routerRecord;
  }

  /**
   * Update router fields by router ID. Throws if router not found.
   */
  async updateRouter(id: string, data: UpdateRouterInput): Promise<Router> {
    const existingRouter = await this.prisma.router.findUnique({ where: { id } });
    if (!existingRouter) {
      throw new Error('Router not found');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.host !== undefined) updateData.host = data.host;
    if (data.port !== undefined) updateData.port = Number(data.port);
    if (data.username !== undefined) updateData.username = data.username;
    if (data.password !== undefined) updateData.password = data.password;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return await this.prisma.router.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a router safely.
   * - If the router does not exist, throws a descriptive not-found error.
   * - If there are active sessions referencing this router, the router is
   *   deactivated (isActive → false) and the DB record is preserved.
   * - If no active sessions exist, the WireGuard peer is unregistered (when
   *   a public key is set) and the DB record is hard-deleted.
   */
  async deleteRouter(id: string): Promise<DeleteRouterResult> {
    const existingRouter = await this.prisma.router.findUnique({ where: { id } });
    if (!existingRouter) {
      throw new Error(`Router not found: ${id}`);
    }

    const activeSessionsCount = await this.prisma.session.count({
      where: { routerId: id, status: 'ACTIVE' },
    });

    if (activeSessionsCount > 0) {
      const router = await this.prisma.router.update({
        where: { id },
        data: { isActive: false },
      });
      return { outcome: 'deactivated', router };
    }

    if (existingRouter.wgPublicKey) {
      await this.wireguard.removePeer(existingRouter.wgPublicKey);
    }

    await this.prisma.router.delete({ where: { id } });
    return { outcome: 'deleted' };
  }

  /**
   * Test router connection with granular diagnostics:
   * 1. Checks WireGuard tunnel handshake status if WireGuard public key configured.
   *    If inactive, returns tunnel_offline immediately without stalling on downstream timeouts.
   * 2. Attempts RouterOS API connect and disconnect cleanly.
   * 3. Categorizes connection failures into auth_failed or unreachable.
   */
  async testConnection(id: string): Promise<TestConnectionResult> {
    const routerRecord = await this.prisma.router.findUnique({ where: { id } });
    if (!routerRecord) {
      throw new Error('Router not found');
    }

    if (routerRecord.wgPublicKey) {
      const handshake = await this.wireguard.getPeerHandshake(routerRecord.wgPublicKey);
      if (!handshake.isConnected) {
        return {
          success: false,
          status: 'tunnel_offline',
          error: 'WireGuard tunnel offline (no recent handshake from router)',
        };
      }
    }

    const mikrotik = this.mikrotikFactory({
      host: routerRecord.host,
      port: routerRecord.port,
      username: routerRecord.username,
      password: routerRecord.password,
    });

    try {
      await mikrotik.connect();
      await mikrotik.disconnect();
      return {
        success: true,
        status: 'online',
        message: 'Router connected successfully',
      };
    } catch (connErr: any) {
      const message = connErr?.message || '';
      const isAuthError =
        message.toLowerCase().includes('cannot log in') ||
        message.toLowerCase().includes('invalid user') ||
        message.toLowerCase().includes('auth') ||
        message.toLowerCase().includes('login') ||
        message.toLowerCase().includes('wrong password') ||
        message.toLowerCase().includes('access denied');

      return {
        success: false,
        status: isAuthError ? 'auth_failed' : 'unreachable',
        error: message || (isAuthError ? 'Authentication failed' : 'Router unreachable'),
      };
    }
  }

  /**
   * Query currently active hotspot users on a router.
   */
  async getActiveUsers(id: string): Promise<UserSession[]> {
    const routerRecord = await this.prisma.router.findUnique({ where: { id } });
    if (!routerRecord) {
      throw new Error('Router not found');
    }

    const mikrotik = this.mikrotikFactory({
      host: routerRecord.host,
      port: routerRecord.port,
      username: routerRecord.username,
      password: routerRecord.password,
    });

    return await mikrotik.getActiveUsers();
  }

  /**
   * Get router active user count and user list details.
   */
  async getRouterStatus(id: string): Promise<RouterStatusResult> {
    const users = await this.getActiveUsers(id);
    return {
      activeUsers: users.length,
      users,
    };
  }

  /**
   * Generate RouterOS provisioning script for a registered router.
   * Throws descriptive error if router not found.
   */
  async generateProvisioningScript(
    id: string,
    options?: ProvisioningScriptOptions
  ): Promise<string> {
    const routerRecord = await this.prisma.router.findUnique({ where: { id } });
    if (!routerRecord) {
      throw new Error('Router not found');
    }

    return this.provisioningScriptGenerator(routerRecord, options);
  }
}

export const defaultRouterService = new RouterService(
  defaultPrisma,
  wireguardService,
  defaultMikrotikFactory,
  generateProvisioningScript
);
export default defaultRouterService;


