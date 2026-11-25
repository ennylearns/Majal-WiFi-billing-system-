import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import defaultPrisma from '../database/db';

const defaultExecAsync = promisify(exec);

export type HealthStatus = 'ok' | 'error';

export interface ServiceHealth {
  status: HealthStatus;
  message?: string;
}

export interface HealthCheckResponse {
  postgres: ServiceHealth;
  bachs: ServiceHealth;
  wireguard: ServiceHealth;
}

export type CommandExecFn = (command: string) => Promise<{ stdout: string; stderr: string }>;

export class HealthService {
  private prisma: any;
  private execFn: CommandExecFn;

  constructor(
    prismaClient: any = defaultPrisma,
    execFn: CommandExecFn = defaultExecAsync
  ) {
    this.prisma = prismaClient;
    this.execFn = execFn;
  }

  public setPrisma(prismaClient: any): void {
    this.prisma = prismaClient;
  }

  public setExecFn(execFn: CommandExecFn): void {
    this.execFn = execFn;
  }

  public async checkPostgres(): Promise<ServiceHealth> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        message: 'Connected'
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: error?.message || 'Database connection error'
      };
    }
  }

  public checkBachs(): ServiceHealth {
    const key = process.env.BACHS_API_KEY;
    if (key && key.trim().length > 0) {
      return {
        status: 'ok',
        message: 'Configured'
      };
    }
    return {
      status: 'error',
      message: 'BACHS_API_KEY is not set'
    };
  }

  public async checkWireguard(): Promise<ServiceHealth> {
    try {
      await this.execFn('wg show');
      return {
        status: 'ok',
        message: 'Interface active'
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: error?.message || 'WireGuard check failed'
      };
    }
  }

  public async checkHealth(): Promise<HealthCheckResponse> {
    const [postgres, wireguard] = await Promise.all([
      this.checkPostgres(),
      this.checkWireguard()
    ]);
    const bachs = this.checkBachs();

    return {
      postgres,
      bachs,
      wireguard
    };
  }
}

export const healthService = new HealthService();
export default healthService;
