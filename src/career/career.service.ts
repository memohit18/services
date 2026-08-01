import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CareerService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(userId: string) {
    const [profile, preference, resumeCount, defaultResume] = await Promise.all([
      this.prisma.careerProfile.findUnique({ where: { userId } }),
      this.prisma.careerPreference.findUnique({ where: { userId } }),
      this.prisma.resume.count({ where: { userId } }),
      this.prisma.resume.findFirst({
        where: { userId, isDefault: true },
        select: { id: true, title: true, version: true, fileUrl: true },
      }),
    ]);

    return {
      hasProfile: Boolean(profile),
      hasPreferences: Boolean(preference),
      resumeCount,
      defaultResume,
    };
  }
}
