import {
  Global,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  FitForgeCacheKeys,
  FitForgeCacheTTL,
} from '../../../../db-schema/redis';

@Global()
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const url = this.configService.get<string>('redis.url');
    if (!url) {
      this.logger.warn('REDIS_URL not set — caching disabled');
      return;
    }
    this.client = new Redis(url, { maxRetriesPerRequest: 3 });
    this.client.on('error', (err) => this.logger.error('Redis error', err));
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) {
      return null;
    }
    const raw = await this.client.get(key);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.client) {
      return;
    }
    const payload = typeof value === 'string' ? value : JSON.stringify(value);
    await this.client.set(key, payload, 'EX', ttlSeconds);
  }

  async del(...keys: string[]): Promise<void> {
    if (!this.client || keys.length === 0) {
      return;
    }
    await this.client.del(...keys);
  }

  async clearUserFitForgeCache(userId: string): Promise<void> {
    await this.del(
      FitForgeCacheKeys.fitnessProfile(userId),
      FitForgeCacheKeys.activeTransformation(userId),
      FitForgeCacheKeys.activeDiet(userId),
      FitForgeCacheKeys.activeMealPlan(userId),
      FitForgeCacheKeys.activeWorkout(userId),
    );
  }

  async clearAllFitForgeCache(): Promise<number> {
    if (!this.client) {
      return 0;
    }
    const keys = await this.client.keys('fitforge:*');
    if (keys.length === 0) {
      return 0;
    }
    await this.client.del(...keys);
    return keys.length;
  }
}

export { FitForgeCacheKeys, FitForgeCacheTTL };
