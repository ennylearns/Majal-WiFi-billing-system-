import { PrismaClient } from '@prisma/client';
import { MikrotikService } from './mikrotikService';
import smsService from './smsService';
import { prisma as defaultPrisma } from '../database/db';

export type MikrotikRouterRecord = {
  host: string;
  port: number;
  username: string;
  password: string;
};

/** Build a MikrotikService from a Router DB record. */
function mikrotikServiceForRouter(router: MikrotikRouterRecord): MikrotikService {
  return new MikrotikService({
    host: router.host,
    port: router.port,
    username: router.username,
    password: router.password,
  });
}

export class SessionService {
  private prisma: PrismaClient;
  private mikrotikFactory: (router: MikrotikRouterRecord) => MikrotikService;

  constructor(
    prismaClient: PrismaClient = defaultPrisma,
    mikrotikFactory: (router: MikrotikRouterRecord) => MikrotikService = mikrotikServiceForRouter
  ) {
    this.prisma = prismaClient;
    this.mikrotikFactory = mikrotikFactory;
  }

  async createSession(userId: string, planId: string, sessionToken: string): Promise<any> {
    try {
      const plan = await this.prisma.plan.findUnique({
        where: { id: planId },
        include: { router: true },
      });

      if (!plan) {
        throw new Error('Plan not found');
      }

      if (!plan.router) {
        throw new Error(`Plan ${planId} has no router assigned`);
      }

      const endTime = new Date();
      endTime.setHours(endTime.getHours() + plan.duration);

      const session = await this.prisma.session.create({
        data: {
          userId,
          planId,
          routerId: plan.router.id,
          sessionToken,
          endTime,
          status: 'ACTIVE',
        },
        include: {
          user: true,
          plan: true,
        },
      });

      // Create MikroTik user profile and hotspot user on the plan's router
      const mikrotik = this.mikrotikFactory(plan.router);
      const profileName = `plan_${plan.id}`;
      const speedLimit = this.parseSpeedLimit(plan.speedLimit);
      const sessionTimeout = mikrotik.formatSessionTimeout(plan.duration);

      try {
        await mikrotik.createUserProfile(profileName, speedLimit, sessionTimeout);
      } catch (error) {
        console.log('Profile might already exist, continuing...');
      }

      await mikrotik.createHotspotUser(sessionToken, sessionToken, profileName);

      return session;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  async terminateSession(sessionId: string): Promise<void> {
    try {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          user: true,
          plan: {
            include: { router: true },
          },
        },
      });

      if (!session) {
        throw new Error('Session not found');
      }

      // Resolve the router to use: prefer routerId stored on session,
      // fall back to the plan's current router (handles legacy rows).
      let router: MikrotikRouterRecord | null = null;

      if (session.routerId) {
        router = await this.prisma.router.findUnique({ where: { id: session.routerId } });
      }

      if (!router && session.plan?.router) {
        router = session.plan.router;
      }

      // Update session status in DB
      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'TERMINATED',
          endTime: new Date(),
        },
      });

      if (router) {
        try {
          const mikrotik = this.mikrotikFactory(router);
          await mikrotik.removeHotspotUser(session.sessionToken);
        } catch (routerError) {
          console.warn(`⚠️ Failed to remove hotspot user ${session.sessionToken} on router ${router.host}:`, routerError);
        }
      } else {
        console.warn(`Session ${sessionId} has no router reference; skipping MikroTik cleanup`);
      }

      console.log(`✅ Session terminated: ${sessionId}`);
    } catch (error) {
      console.error('Error terminating session:', error);
      throw error;
    }
  }

  async getActiveSession(sessionToken: string): Promise<any> {
    try {
      const session = await this.prisma.session.findUnique({
        where: { sessionToken },
        include: {
          user: true,
          plan: true,
        },
      });

      if (!session || session.status !== 'ACTIVE') {
        return null;
      }

      // Check if session has expired
      if (session.endTime && new Date() > session.endTime) {
        await this.terminateSession(session.id);
        return null;
      }

      return session;
    } catch (error) {
      console.error('Error getting active session:', error);
      return null;
    }
  }

  async getUserActiveSessions(userId: string): Promise<any[]> {
    try {
      return await this.prisma.session.findMany({
        where: {
          userId,
          status: 'ACTIVE',
          endTime: {
            gt: new Date(),
          },
        },
        include: {
          plan: true,
        },
        orderBy: {
          startTime: 'desc',
        },
      });
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }
  }

  async updateSessionUsage(sessionToken: string, dataUsed: number): Promise<void> {
    try {
      await this.prisma.session.update({
        where: { sessionToken },
        data: { dataUsed },
      });
    } catch (error) {
      console.error('Error updating session usage:', error);
    }
  }

  private parseSpeedLimit(speedLimit: string): string {
    // Convert "10Mbps" to "10M/10M" format for MikroTik
    const speed = speedLimit.replace(/[^\d]/g, '');
    const unit = speedLimit.includes('Gbps') ? 'G' : 'M';
    return `${speed}${unit}/${speed}${unit}`;
  }
}

// Cleanup expired sessions - each session uses its own per-router MikrotikService
export const sessionCleanup = async (
  sessionServiceInstance?: SessionService,
  prismaClient: PrismaClient = defaultPrisma
): Promise<void> => {
  const service = sessionServiceInstance ?? defaultSessionService;
  try {
    const expiredSessions = await prismaClient.session.findMany({
      where: {
        status: 'ACTIVE',
        endTime: {
          lt: new Date(),
        },
      },
    });

    let cleanedCount = 0;
    for (const session of expiredSessions) {
      try {
        await service.terminateSession(session.id);

        // Send expiry notification
        const user = await prismaClient.user.findUnique({
          where: { id: session.userId },
        });

        if (user) {
          try {
            await smsService.sendSMS(
              user.phone,
              'Your internet session has expired. Purchase a new plan to continue browsing. - COLLOSPOT'
            );
          } catch (smsError) {
            console.warn(`Failed to send expiration SMS for session ${session.id}:`, smsError);
          }
        }
        cleanedCount++;
      } catch (sessionError) {
        console.error(`Failed to cleanup expired session ${session.id}:`, sessionError);
      }
    }

    if (expiredSessions.length > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount}/${expiredSessions.length} expired sessions`);
    }
  } catch (error) {
    console.error('Error during session cleanup:', error);
  }
};

const defaultSessionService = new SessionService();
export default defaultSessionService;
