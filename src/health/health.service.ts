import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { PrismaService } from '../prisma/prisma.service';

export type HealthStatus = 'ok' | 'error';

export interface HealthCheckResponse {
  status: HealthStatus;
  api: { status: HealthStatus };
  db: {
    postgres: { status: HealthStatus };
    mongodb: { status: HealthStatus };
  };
  uptime: {
    seconds: number;
    formatted: string;
  };
}

@Injectable()
export class HealthService implements OnModuleInit {
  private startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    @InjectConnection() private readonly mongoConnection: Connection,
  ) {}

  onModuleInit() {
    this.startedAt = Date.now();
  }

  async check(): Promise<HealthCheckResponse> {
    const [postgres, mongodb] = await Promise.all([
      this.checkPostgres(),
      this.checkMongo(),
    ]);

    const dbHealthy = postgres === 'ok' && mongodb === 'ok';

    return {
      status: dbHealthy ? 'ok' : 'error',
      api: { status: 'ok' },
      db: {
        postgres: { status: postgres },
        mongodb: { status: mongodb },
      },
      uptime: this.getUptime(),
    };
  }

  private async checkPostgres(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkMongo(): Promise<HealthStatus> {
    try {
      if (this.mongoConnection.readyState !== 1) {
        return 'error';
      }

      const db = this.mongoConnection.db;
      if (!db) {
        return 'error';
      }

      await db.listCollections().toArray();
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private getUptime() {
    const seconds = (Date.now() - this.startedAt) / 1000;
    return {
      seconds: Math.round(seconds * 100) / 100,
      formatted: formatUptime(seconds),
    };
  }
}

function formatUptime(totalSeconds: number): string {
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor(totalSeconds / 3600);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
}
