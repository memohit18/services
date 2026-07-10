import { BadRequestException, Injectable } from '@nestjs/common';
import { HydrationLogRepository } from '../repositories/hydration-log.repository';
import { DailyAggregatorService } from './daily-aggregator.service';
import { startOfLocalCalendarDay } from '../aggregator/daily-aggregator.engine';

const HYDRATION_TARGET_ML = 4000;

@Injectable()
export class HydrationService {
  constructor(
    private readonly hydrationLogRepository: HydrationLogRepository,
    private readonly dailyAggregator: DailyAggregatorService,
  ) {}

  async log(userId: string, amountMl: number, loggedAt?: Date) {
    if (!Number.isFinite(amountMl) || amountMl <= 0) {
      throw new BadRequestException('amountMl must be a positive number');
    }

    const at = loggedAt ?? new Date();
    const log = await this.hydrationLogRepository.create({
      user: { connect: { id: userId } },
      amountMl: Math.round(amountMl),
      loggedAt: at,
    });

    const checkin = await this.dailyAggregator.rebuildForDate(
      userId,
      startOfLocalCalendarDay(at),
    );

    return {
      log,
      checkin,
      hydration: this.formatHydration(checkin.waterIntakeMl ?? 0),
    };
  }

  formatHydration(currentMl: number) {
    return {
      currentMl,
      targetMl: HYDRATION_TARGET_ML,
      currentLiters: Math.round((currentMl / 1000) * 10) / 10,
      targetLiters: HYDRATION_TARGET_ML / 1000,
      percent: Math.min(
        100,
        Math.round((currentMl / HYDRATION_TARGET_ML) * 100),
      ),
    };
  }
}
