import { PrismaClient, Router } from '@prisma/client';

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

  const router = await prismaClient.router.create({
    data: {
      name: 'Default Router',
      location: 'Main Location',
      host,
      port,
      username,
      password,
      isActive: true
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
