import { PrismaClient, Router } from '@prisma/client';
import wireguardService from './wireguardService';

export interface SeedRouterEnv {
  MIKROTIK_HOST?: string;
  MIKROTIK_PORT?: string;
  MIKROTIK_USERNAME?: string;
  MIKROTIK_USER?: string;
  MIKROTIK_PASSWORD?: string;
  [key: string]: string | undefined;
}

const defaultPrisma = new PrismaClient();

export async function seedDefaultRouter(
  prismaClient: any = defaultPrisma,
  env: SeedRouterEnv = process.env
): Promise<Router | null> {
  const host = env.MIKROTIK_HOST?.trim();
  if (!host) {
    return null;
  }

  const existingCount = await prismaClient.router.count();
  if (existingCount > 0) {
    return null;
  }

  const port = env.MIKROTIK_PORT ? parseInt(env.MIKROTIK_PORT, 10) : 8728;
  const username = env.MIKROTIK_USERNAME || env.MIKROTIK_USER || 'admin';
  const password = env.MIKROTIK_PASSWORD || '';

  // Generate WireGuard keypair and allocate a tunnel IP for the seeded router
  let wgPublicKey: string | undefined;
  let wgPrivateKey: string | undefined;
  let wgTunnelIp: string | undefined;
  let routerHost = host;

  try {
    const keyPair = wireguardService.generateKeyPair();
    const tunnelIp = wireguardService.allocateTunnelIp([]);
    wgPublicKey = keyPair.publicKey;
    wgPrivateKey = keyPair.privateKey;
    wgTunnelIp = tunnelIp;
    routerHost = tunnelIp;

    // Register peer asynchronously; failure is non-fatal for seeding
    wireguardService.addPeer(keyPair.publicKey, tunnelIp).catch((err: unknown) => {
      console.warn('[routerSeedService] WireGuard peer registration failed (non-fatal):', err);
    });
  } catch (err) {
    console.warn('[routerSeedService] WireGuard provisioning skipped (non-fatal):', err);
  }

  const router = await prismaClient.router.create({
    data: {
      name: 'Default Router',
      location: 'Main Location',
      host: routerHost,
      port,
      username,
      password,
      isActive: true,
      wgPublicKey: wgPublicKey ?? null,
      wgPrivateKey: wgPrivateKey ?? null,
      wgTunnelIp: wgTunnelIp ?? null
    }
  });

  await prismaClient.plan.updateMany({
    where: {
      routerId: null
    },
    data: {
      routerId: router.id
    }
  });

  console.log(`✅ Default router seeded (${router.name} @ ${router.host}) and existing plans backfilled`);
  return router;
}
