import crypto from 'crypto';
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

export function isValidMac(mac: string): boolean {
  if (!mac || typeof mac !== 'string') return false;
  const cleaned = mac.trim().replace(/[:.-]/g, '');
  return cleaned.length === 12 && /^[0-9a-fA-F]{12}$/.test(cleaned);
}

export function normalizeMac(mac: string): string {
  if (!isValidMac(mac)) {
    throw new Error(`Invalid MAC address: ${mac}`);
  }
  const cleaned = mac.trim().toLowerCase().replace(/[:.-]/g, '');
  return cleaned.match(/.{1,2}/g)!.join(':');
}

export interface CooldownRemaining {
  remainingMs: number;
  remainingSeconds: number;
  remainingHours: number;
  remainingMinutes: number;
}

export function calculateCooldownRemaining(remainingMs: number): CooldownRemaining {
  const safeMs = Math.max(0, remainingMs);
  return {
    remainingMs: safeMs,
    remainingSeconds: Math.ceil(safeMs / 1000),
    remainingHours: Math.floor(safeMs / (1000 * 60 * 60)),
    remainingMinutes: Math.floor((safeMs % (1000 * 60 * 60)) / (1000 * 60)),
  };
}

export class TrialCooldownError extends Error {
  public readonly inCooldown = true;
  public readonly remainingMs: number;
  public readonly remainingHours: number;
  public readonly remainingMinutes: number;
  public readonly remainingSeconds: number;
  public readonly cooldownEndsAt: Date;

  constructor(cooldownEndsAt: Date) {
    const remainingMs = cooldownEndsAt.getTime() - Date.now();
    const { remainingHours, remainingMinutes, remainingSeconds, remainingMs: safeMs } =
      calculateCooldownRemaining(remainingMs);

    super(
      `Trial cooldown active. Another free trial will be available in ${remainingHours}h ${remainingMinutes}m.`
    );
    this.name = 'TrialCooldownError';
    this.remainingMs = safeMs;
    this.remainingHours = remainingHours;
    this.remainingMinutes = remainingMinutes;
    this.remainingSeconds = remainingSeconds;
    this.cooldownEndsAt = cooldownEndsAt;
  }
}

export interface StartTrialParams {
  routerId: string;
  macAddress: string;
  ipAddress?: string;
  phone?: string;
  email?: string;
}

export interface TrialStatusResult {
  status: 'ACTIVE' | 'COOLDOWN' | 'ELIGIBLE';
  isEligible: boolean;
  inCooldown: boolean;
  remainingSeconds?: number;
  remainingHours?: number;
  remainingMinutes?: number;
  cooldownEndsAt?: string;
  session?: {
    id: string;
    sessionToken: string;
    startTime: Date;
    endTime: Date | null;
    routerId: string | null;
  };
}

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

  async createSession(userId: string, planId: string, sessionToken: string, phone?: string, email?: string): Promise<any> {
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

      let resolvedPhone = phone || null;
      let resolvedEmail = email || null;
      if ((!resolvedPhone || !resolvedEmail) && userId) {
        try {
          const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { phone: true, email: true },
          });
          if (user) {
            resolvedPhone = resolvedPhone || user.phone || null;
            resolvedEmail = resolvedEmail || user.email || null;
          }
        } catch {
          // ignore lookup error
        }
      }

      const session = await this.prisma.session.create({
        data: {
          userId,
          planId,
          routerId: plan.router.id,
          sessionToken,
          phone: resolvedPhone,
          email: resolvedEmail,
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

  async getTrialStatus(macAddress: string): Promise<TrialStatusResult> {
    const normalizedMac = normalizeMac(macAddress);
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentTrial = await this.prisma.session.findFirst({
      where: {
        macAddress: normalizedMac,
        OR: [{ isTrial: true }, { wasTrial: true }],
        startTime: {
          gte: twentyFourHoursAgo,
        },
      },
      orderBy: {
        startTime: 'desc',
      },
    });

    if (!recentTrial) {
      return {
        status: 'ELIGIBLE',
        isEligible: true,
        inCooldown: false,
      };
    }

    // If currently active unpaid free trial
    if (recentTrial.isTrial && recentTrial.status === 'ACTIVE' && recentTrial.endTime && recentTrial.endTime > now) {
      const remainingSeconds = Math.max(0, Math.floor((recentTrial.endTime.getTime() - now.getTime()) / 1000));
      const cooldownEndsAt = new Date(recentTrial.startTime.getTime() + 24 * 60 * 60 * 1000);
      return {
        status: 'ACTIVE',
        isEligible: false,
        inCooldown: false,
        remainingSeconds,
        cooldownEndsAt: cooldownEndsAt.toISOString(),
        session: {
          id: recentTrial.id,
          sessionToken: recentTrial.sessionToken,
          startTime: recentTrial.startTime,
          endTime: recentTrial.endTime,
          routerId: recentTrial.routerId,
        },
      };
    }

    // Trial used within past 24 hours but no longer active
    const cooldownEndsAt = new Date(recentTrial.startTime.getTime() + 24 * 60 * 60 * 1000);
    if (cooldownEndsAt > now) {
      const { remainingHours, remainingMinutes, remainingSeconds } = calculateCooldownRemaining(
        cooldownEndsAt.getTime() - now.getTime()
      );

      return {
        status: 'COOLDOWN',
        isEligible: false,
        inCooldown: true,
        remainingHours,
        remainingMinutes,
        remainingSeconds,
        cooldownEndsAt: cooldownEndsAt.toISOString(),
      };
    }

    return {
      status: 'ELIGIBLE',
      isEligible: true,
      inCooldown: false,
    };
  }

  async startTrialSession(params: StartTrialParams): Promise<{ session: any; message: string }> {
    const { routerId, macAddress, ipAddress, phone, email } = params;
    const normalizedMac = normalizeMac(macAddress);

    // Validate router
    const router = await this.prisma.router.findUnique({
      where: { id: routerId },
    });

    if (!router || !router.isActive) {
      throw new Error('Router not found or inactive');
    }

    // Check trial status/cooldown
    const trialStatus = await this.getTrialStatus(normalizedMac);

    if (trialStatus.status === 'ACTIVE' || trialStatus.status === 'COOLDOWN') {
      const cooldownEndsAt = trialStatus.cooldownEndsAt
        ? new Date(trialStatus.cooldownEndsAt)
        : trialStatus.session
        ? new Date(trialStatus.session.startTime.getTime() + 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 24 * 60 * 60 * 1000);
      throw new TrialCooldownError(cooldownEndsAt);
    }

    const startTime = new Date();
    const durationMinutes = 10;
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    const sessionToken = `trial_${crypto.randomBytes(4).toString('hex')}`;

    // Provision MikroTik profile & hotspot user
    const mikrotik = this.mikrotikFactory(router);
    const profileName = 'trial_10m';

    try {
      await mikrotik.createUserProfile(profileName, '2M/1M', '10m');
    } catch (profileError) {
      console.log('Trial profile might already exist, continuing...');
    }

    await mikrotik.createHotspotUser(sessionToken, sessionToken, profileName);

    // Create session record in database
    const session = await this.prisma.session.create({
      data: {
        routerId: router.id,
        macAddress: normalizedMac,
        ipAddress: ipAddress || null,
        phone: phone || null,
        email: email || null,
        sessionToken,
        startTime,
        endTime,
        status: 'ACTIVE',
        isTrial: true,
        wasTrial: true,
      },
    });

    return {
      session,
      message: '10-minute trial activated successfully',
    };
  }

  async upgradeTrialSession(sessionId: string, planId: string, userId?: string, phone?: string, email?: string): Promise<any> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { router: true },
    });

    if (!session) {
      throw new Error('Trial session not found');
    }

    if (!session.isTrial || session.status !== 'ACTIVE') {
      throw new Error('Session is not an active trial session');
    }

    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: { router: true },
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    let routerRecord: MikrotikRouterRecord | null =
      (plan.router as MikrotikRouterRecord) ||
      (session.router as MikrotikRouterRecord) ||
      null;

    if (!routerRecord && (plan.routerId || session.routerId)) {
      routerRecord = await this.prisma.router.findUnique({
        where: { id: (plan.routerId || session.routerId) as string },
      });
    }

    if (!routerRecord) {
      throw new Error('No router associated with plan or session');
    }

    const upgradedAt = new Date();
    const endTime = new Date(upgradedAt.getTime() + plan.duration * 3600 * 1000);

    // Update MikroTik router user profile to match purchased plan without disconnecting
    const mikrotik = this.mikrotikFactory(routerRecord);
    const profileName = `plan_${plan.id}`;
    const speedLimit = this.parseSpeedLimit(plan.speedLimit);
    const sessionTimeout = mikrotik.formatSessionTimeout(plan.duration);

    try {
      await mikrotik.createUserProfile(profileName, speedLimit, sessionTimeout);
    } catch (profileError) {
      console.log('Profile might already exist, continuing...');
    }

    await mikrotik.updateUserProfile(session.sessionToken, profileName);
    await mikrotik.updateActiveUserRateLimit(session.sessionToken, speedLimit);

    let resolvedPhone = phone || (session as any).phone || null;
    let resolvedEmail = email || (session as any).email || null;
    if ((!resolvedPhone || !resolvedEmail) && (userId || session.userId)) {
      try {
        const u = await this.prisma.user.findUnique({
          where: { id: (userId || session.userId)! },
          select: { phone: true, email: true },
        });
        if (u) {
          resolvedPhone = resolvedPhone || u.phone || null;
          resolvedEmail = resolvedEmail || u.email || null;
        }
      } catch {
        // ignore
      }
    }

    // Update session record in DB
    const updatedSession = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        planId: plan.id,
        userId: userId || session.userId,
        routerId: (routerRecord as any).id,
        isTrial: false,
        wasTrial: true,
        startTime: upgradedAt,
        endTime,
        status: 'ACTIVE',
        phone: resolvedPhone,
        email: resolvedEmail,
      },
      include: {
        user: true,
        plan: true,
      },
    });

    return updatedSession;
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
      const sessions = await this.prisma.session.findMany({
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
      return sessions.map((s: any) => ({
        ...s,
        dataUsed: Number(s.dataUsed),
      }));
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
        if (session.userId) {
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
