import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCareerProfileDto } from './dto/create-career-profile.dto';
import { UpdateCareerProfileDto } from './dto/update-career-profile.dto';
import { toCareerProfileView } from './mapper/career-profile.mapper';

@Injectable()
export class CareerProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCareerProfileDto) {
    const existing = await this.prisma.careerProfile.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException('Career profile already exists');
    }

    this.validateCtcRange(dto.expectedMinCtc, dto.expectedMaxCtc);

    const profile = await this.prisma.careerProfile.create({
      data: {
        userId,
        currentCompany: dto.currentCompany,
        currentRole: dto.currentRole,
        totalExperience: dto.totalExperience,
        currentCtc: dto.currentCtc,
        expectedMinCtc: dto.expectedMinCtc,
        expectedMaxCtc: dto.expectedMaxCtc,
        noticePeriod: dto.noticePeriod,
        linkedinUrl: dto.linkedinUrl,
        githubUrl: dto.githubUrl,
        portfolioUrl: dto.portfolioUrl,
        summary: dto.summary,
        isActive: dto.isActive ?? true,
      },
    });

    return toCareerProfileView(profile);
  }

  async get(userId: string) {
    const profile = await this.prisma.careerProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Career profile not found');
    }
    return toCareerProfileView(profile);
  }

  async update(userId: string, dto: UpdateCareerProfileDto) {
    const existing = await this.prisma.careerProfile.findUnique({
      where: { userId },
    });
    if (!existing) {
      throw new NotFoundException('Career profile not found');
    }

    this.validateCtcRange(
      dto.expectedMinCtc ?? existing.expectedMinCtc ?? undefined,
      dto.expectedMaxCtc ?? existing.expectedMaxCtc ?? undefined,
    );

    const profile = await this.prisma.careerProfile.update({
      where: { userId },
      data: {
        ...(dto.currentCompany !== undefined && {
          currentCompany: dto.currentCompany,
        }),
        ...(dto.currentRole !== undefined && { currentRole: dto.currentRole }),
        ...(dto.totalExperience !== undefined && {
          totalExperience: dto.totalExperience,
        }),
        ...(dto.currentCtc !== undefined && { currentCtc: dto.currentCtc }),
        ...(dto.expectedMinCtc !== undefined && {
          expectedMinCtc: dto.expectedMinCtc,
        }),
        ...(dto.expectedMaxCtc !== undefined && {
          expectedMaxCtc: dto.expectedMaxCtc,
        }),
        ...(dto.noticePeriod !== undefined && {
          noticePeriod: dto.noticePeriod,
        }),
        ...(dto.linkedinUrl !== undefined && { linkedinUrl: dto.linkedinUrl }),
        ...(dto.githubUrl !== undefined && { githubUrl: dto.githubUrl }),
        ...(dto.portfolioUrl !== undefined && {
          portfolioUrl: dto.portfolioUrl,
        }),
        ...(dto.summary !== undefined && { summary: dto.summary }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return toCareerProfileView(profile);
  }

  private validateCtcRange(min?: number | null, max?: number | null) {
    if (min != null && max != null && min > max) {
      throw new BadRequestException(
        'expectedMinCtc cannot be greater than expectedMaxCtc',
      );
    }
  }
}
