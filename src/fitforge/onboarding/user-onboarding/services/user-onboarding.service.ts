import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UserOnboarding } from '@prisma/client';
import { ONBOARDING_STEP_MAX } from '../../../../../db-schema/postgres/constants/fitforge-values';
import { PrismaService } from '../../../../prisma/prisma.service';
import { UpdateOnboardingDto } from '../dto/update-onboarding.dto';

@Injectable()
export class UserOnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(userId: string): Promise<UserOnboarding> {
    const existing = await this.prisma.userOnboarding.findUnique({
      where: { userId },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.userOnboarding.create({ data: { userId } });
  }

  async updateStep(userId: string, dto: UpdateOnboardingDto) {
    const onboarding = await this.getOrCreate(userId);
    if (onboarding.isCompleted) {
      throw new BadRequestException('Onboarding already completed');
    }
    if (dto.currentStep < onboarding.currentStep) {
      throw new BadRequestException(
        'Cannot move onboarding step backwards',
      );
    }
    return this.prisma.userOnboarding.update({
      where: { userId },
      data: { currentStep: dto.currentStep },
    });
  }

  async advanceToStep(userId: string, step: number) {
    const onboarding = await this.getOrCreate(userId);
    if (onboarding.isCompleted || step <= onboarding.currentStep) {
      return onboarding;
    }
    const nextStep = Math.min(step, ONBOARDING_STEP_MAX);
    return this.prisma.userOnboarding.update({
      where: { userId },
      data: { currentStep: nextStep },
    });
  }

  async complete(userId: string) {
    const onboarding = await this.getOrCreate(userId);
    if (onboarding.isCompleted) {
      return onboarding;
    }
    return this.prisma.userOnboarding.update({
      where: { userId },
      data: {
        isCompleted: true,
        completedAt: new Date(),
        currentStep: ONBOARDING_STEP_MAX,
      },
    });
  }

  async requireNotCompleted(userId: string) {
    const onboarding = await this.getOrCreate(userId);
    if (onboarding.isCompleted) {
      throw new BadRequestException('Onboarding already completed');
    }
    return onboarding;
  }

  async findOne(userId: string) {
    const onboarding = await this.prisma.userOnboarding.findUnique({
      where: { userId },
    });
    if (!onboarding) {
      throw new NotFoundException('Onboarding record not found');
    }
    return onboarding;
  }
}
