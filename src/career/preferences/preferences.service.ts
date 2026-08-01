import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCareerPreferencesDto } from './dto/create-career-preferences.dto';
import { UpdateCareerPreferencesDto } from './dto/update-career-preferences.dto';

@Injectable()
export class CareerPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCareerPreferencesDto) {
    const existing = await this.prisma.careerPreference.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException('Career preferences already exist');
    }

    this.validateSalaryRange(dto.minSalary, dto.maxSalary);

    return this.prisma.careerPreference.create({
      data: {
        userId,
        preferredRoles: dto.preferredRoles,
        preferredLocations: dto.preferredLocations,
        employmentTypes: dto.employmentTypes,
        workModes: dto.workModes,
        preferredSkills: dto.preferredSkills,
        preferredCompanies: dto.preferredCompanies ?? undefined,
        blockedCompanies: dto.blockedCompanies ?? undefined,
        minSalary: dto.minSalary,
        maxSalary: dto.maxSalary,
        searchKeywords: dto.searchKeywords ?? undefined,
        autoApply: dto.autoApply ?? false,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async get(userId: string) {
    const preference = await this.prisma.careerPreference.findUnique({
      where: { userId },
    });
    if (!preference) {
      throw new NotFoundException('Career preferences not found');
    }
    return preference;
  }

  async update(userId: string, dto: UpdateCareerPreferencesDto) {
    const existing = await this.prisma.careerPreference.findUnique({
      where: { userId },
    });
    if (!existing) {
      throw new NotFoundException('Career preferences not found');
    }

    this.validateSalaryRange(
      dto.minSalary ?? existing.minSalary ?? undefined,
      dto.maxSalary ?? existing.maxSalary ?? undefined,
    );

    const data: Prisma.CareerPreferenceUpdateInput = {};
    if (dto.preferredRoles !== undefined) data.preferredRoles = dto.preferredRoles;
    if (dto.preferredLocations !== undefined) {
      data.preferredLocations = dto.preferredLocations;
    }
    if (dto.employmentTypes !== undefined) {
      data.employmentTypes = dto.employmentTypes;
    }
    if (dto.workModes !== undefined) data.workModes = dto.workModes;
    if (dto.preferredSkills !== undefined) {
      data.preferredSkills = dto.preferredSkills;
    }
    if (dto.preferredCompanies !== undefined) {
      data.preferredCompanies = dto.preferredCompanies;
    }
    if (dto.blockedCompanies !== undefined) {
      data.blockedCompanies = dto.blockedCompanies;
    }
    if (dto.minSalary !== undefined) data.minSalary = dto.minSalary;
    if (dto.maxSalary !== undefined) data.maxSalary = dto.maxSalary;
    if (dto.searchKeywords !== undefined) {
      data.searchKeywords = dto.searchKeywords;
    }
    if (dto.autoApply !== undefined) data.autoApply = dto.autoApply;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.careerPreference.update({
      where: { userId },
      data,
    });
  }

  private validateSalaryRange(min?: number | null, max?: number | null) {
    if (min != null && max != null && min > max) {
      throw new BadRequestException(
        'minSalary cannot be greater than maxSalary',
      );
    }
  }
}
