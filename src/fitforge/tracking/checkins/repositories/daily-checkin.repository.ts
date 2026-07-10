import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class DailyCheckinRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserAndDate(userId: string, checkInDate: Date) {
    return this.prisma.dailyCheckin.findUnique({
      where: { userId_checkInDate: { userId, checkInDate } },
    });
  }

  upsert(
    userId: string,
    checkInDate: Date,
    data: Omit<
      Prisma.DailyCheckinUncheckedCreateInput,
      'id' | 'userId' | 'checkInDate' | 'createdAt'
    >,
  ) {
    return this.prisma.dailyCheckin.upsert({
      where: { userId_checkInDate: { userId, checkInDate } },
      create: {
        userId,
        checkInDate,
        ...data,
      },
      update: data,
    });
  }

  findMany(userId: string, opts: { skip: number; take: number }) {
    return this.prisma.dailyCheckin.findMany({
      where: { userId },
      skip: opts.skip,
      take: opts.take,
      orderBy: { checkInDate: 'desc' },
    });
  }

  count(userId: string) {
    return this.prisma.dailyCheckin.count({ where: { userId } });
  }

  findInRange(userId: string, start: Date, end: Date) {
    return this.prisma.dailyCheckin.findMany({
      where: {
        userId,
        checkInDate: { gte: start, lte: end },
      },
    });
  }

  updateNotes(id: string, notes: string | null) {
    return this.prisma.dailyCheckin.update({
      where: { id },
      data: { notes },
    });
  }
}
