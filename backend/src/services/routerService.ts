import crypto from 'crypto';
import { PrismaClient, Router } from '@prisma/client';
import wireguardService, { WireguardService } from './wireguardService';

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

export class RouterService {
  private prisma: PrismaClient;
  private wireguard: WireguardService;

  constructor(prismaClient?: PrismaClient, wireguardServiceInstance?: WireguardService) {
    this.prisma = prismaClient || new PrismaClient();
    this.wireguard = wireguardServiceInstance || wireguardService;
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
}

export const defaultRouterService = new RouterService();
export default defaultRouterService;

