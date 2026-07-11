import { Injectable } from '@nestjs/common';
import { startOfLocalCalendarDay } from '../../checkins/aggregator/daily-aggregator.engine';
import { DailyCheckinRepository } from '../../checkins/repositories/daily-checkin.repository';

@Injectable()
export class ComplianceRepository {
  constructor(private readonly dailyCheckins: DailyCheckinRepository) {}

  findRecent(userId: string, days = 60) {
    const end = startOfLocalCalendarDay();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    return this.dailyCheckins.findInRange(userId, start, end);
  }
}
