import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getPagination } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse } from '../../../../common/utils/api-response';
import { R2StorageService } from '../../../media/uploads/services/r2-storage.service';
import { computeProgressAnalytics } from '../analytics/progress-analytics.engine';
import { CreateProgressDto } from '../dto/create-progress.dto';
import { CreateProgressPhotosDto } from '../dto/create-progress-photos.dto';
import {
  ProgressAnalyticsQueryDto,
  ProgressHistoryQueryDto,
  ProgressPhotosQueryDto,
} from '../dto/progress-query.dto';
import { UpdateProgressDto } from '../dto/update-progress.dto';
import {
  toProgressLogResponse,
  toProgressPhotoResponse,
} from '../mappers/progress.mapper';
import { DailyAggregatorService } from '../../checkins/services/daily-aggregator.service';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import { PhotoRepository } from '../repositories/photo.repository';
import { ProgressRepository } from '../repositories/progress.repository';

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseDayStart(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function parseDayEndExclusive(isoDate: string) {
  const start = parseDayStart(isoDate);
  start.setUTCDate(start.getUTCDate() + 1);
  return start;
}

@Injectable()
export class ProgressService {
  constructor(
    private readonly progressRepository: ProgressRepository,
    private readonly photoRepository: PhotoRepository,
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly r2: R2StorageService,
    private readonly dailyAggregator: DailyAggregatorService,
  ) {}

  /** One progress entry per UTC day — upserts today's row. */
  async create(userId: string, dto: CreateProgressDto) {
    this.assertHasMeasurement(dto);
    const dayStart = startOfUtcDay();
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const existing = await this.progressRepository.findForDay(
      userId,
      dayStart,
      dayEnd,
    );

    if (existing) {
      const updated = await this.progressRepository.update(existing.id, {
        ...(dto.weightKg !== undefined ? { weightKg: dto.weightKg } : {}),
        ...(dto.bodyFatPercentage !== undefined
          ? { bodyFatPercentage: dto.bodyFatPercentage }
          : {}),
        ...(dto.waistCm !== undefined ? { waistCm: dto.waistCm } : {}),
        ...(dto.chestCm !== undefined ? { chestCm: dto.chestCm } : {}),
        ...(dto.armCm !== undefined ? { armCm: dto.armCm } : {}),
        ...(dto.thighCm !== undefined ? { thighCm: dto.thighCm } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      });
      await this.dailyAggregator.rebuildForDate(userId, dayStart);
      return toProgressLogResponse(updated);
    }

    const created = await this.progressRepository.create({
      user: { connect: { id: userId } },
      weightKg: dto.weightKg,
      bodyFatPercentage: dto.bodyFatPercentage,
      waistCm: dto.waistCm,
      chestCm: dto.chestCm,
      armCm: dto.armCm,
      thighCm: dto.thighCm,
      notes: dto.notes,
    });
    await this.dailyAggregator.rebuildForDate(userId, dayStart);
    return toProgressLogResponse(created);
  }

  async update(userId: string, id: string, dto: UpdateProgressDto) {
    const log = await this.progressRepository.findById(id, userId);
    if (!log) {
      throw new NotFoundException('Progress log not found');
    }
    const updated = await this.progressRepository.update(id, dto);
    await this.dailyAggregator.rebuildForDate(userId, startOfUtcDay(log.createdAt));
    return toProgressLogResponse(updated);
  }

  async getLatest(userId: string) {
    const log = await this.progressRepository.findLatest(userId);
    return log ? toProgressLogResponse(log) : null;
  }

  async getHistory(userId: string, query: ProgressHistoryQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const from = query.from ? parseDayStart(query.from) : undefined;
    const to = query.to ? parseDayEndExclusive(query.to) : undefined;
    const [items, total] = await this.progressRepository.findHistory({
      userId,
      skip,
      take: limit,
      from,
      to,
    });
    return paginatedResponse(
      items.map(toProgressLogResponse),
      total,
      page,
      limit,
    );
  }

  /** Legacy list alias → history without date filters. */
  async findAll(userId: string, query: ProgressHistoryQueryDto) {
    return this.getHistory(userId, query);
  }

  async getAnalytics(userId: string, query: ProgressAnalyticsQueryDto = {}) {
    const from = query.from ? parseDayStart(query.from) : undefined;
    const to = query.to ? parseDayEndExclusive(query.to) : undefined;
    const ctx = await this.analyticsRepository.loadAnalyticsContext(
      userId,
      from,
      to,
    );
    return computeProgressAnalytics(ctx);
  }

  /**
   * Progress dashboard — latest entry + full analytics/insights for the UI.
   */
  async getDashboard(userId: string, query: ProgressAnalyticsQueryDto = {}) {
    const analytics = await this.getAnalytics(userId, query);
    const latest = await this.progressRepository.findLatest(userId);
    const photoCount = await this.photoRepository.count(userId);

    return {
      latest: latest ? toProgressLogResponse(latest) : null,
      photoCount,
      analytics,
      insights: analytics.insights,
      transformation: {
        goalCompletionPercent: analytics.goalCompletionPercent,
        transformationPercent: analytics.transformationPercent,
        estimatedCompletionDate: analytics.estimatedCompletionDate,
        etaWeeks: analytics.etaWeeks,
        weeksAheadOfPlan: analytics.weeksAheadOfPlan,
        plannedEtaWeeks: analytics.plannedEtaWeeks,
        startWeightKg: analytics.startWeightKg,
        latestWeightKg: analytics.latestWeightKg,
        targetWeightKg: analytics.targetWeightKg,
      },
    };
  }

  async createPhotos(userId: string, dto: CreateProgressPhotosDto) {
    if (!dto.frontImageUrl && !dto.sideImageUrl && !dto.backImageUrl) {
      throw new BadRequestException(
        'At least one of frontImageUrl, sideImageUrl, backImageUrl is required',
      );
    }

    const photo = await this.photoRepository.create({
      user: { connect: { id: userId } },
      frontImageUrl: dto.frontImageUrl,
      sideImageUrl: dto.sideImageUrl,
      backImageUrl: dto.backImageUrl,
    });
    return toProgressPhotoResponse(photo);
  }

  async listPhotos(userId: string, query: ProgressPhotosQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const [items, total] = await this.photoRepository.findTimeline(
      userId,
      skip,
      limit,
    );
    return paginatedResponse(
      items.map(toProgressPhotoResponse),
      total,
      page,
      limit,
    );
  }

  async deletePhoto(userId: string, id: string) {
    const photo = await this.photoRepository.findById(id, userId);
    if (!photo) {
      throw new NotFoundException('Progress photo not found');
    }

    const urls = [
      photo.frontImageUrl,
      photo.sideImageUrl,
      photo.backImageUrl,
    ].filter((u): u is string => Boolean(u));

    if (this.r2.isConfigured()) {
      for (const url of urls) {
        const key = this.extractR2Key(url);
        if (key) {
          try {
            await this.r2.deleteObject(key);
          } catch {
            // Best-effort R2 cleanup — still delete DB row
          }
        }
      }
    }

    await this.photoRepository.delete(id);
    return { id };
  }

  private assertHasMeasurement(dto: CreateProgressDto) {
    if (
      dto.weightKg == null &&
      dto.bodyFatPercentage == null &&
      dto.waistCm == null &&
      dto.chestCm == null &&
      dto.armCm == null &&
      dto.thighCm == null
    ) {
      throw new BadRequestException(
        'Provide at least one measurement (weight, body fat, or circumference)',
      );
    }
  }

  private extractR2Key(fileUrl: string): string | null {
    try {
      const pathname = new URL(fileUrl).pathname.replace(/^\//, '');
      return pathname.startsWith('uploads/') ? pathname : null;
    } catch {
      return fileUrl.startsWith('uploads/') ? fileUrl : null;
    }
  }
}
