import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        isDeleted: true,
      },
    });

    if (!user || user.isDeleted) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.toResponse(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isDeleted: true },
    });
    if (!existing || existing.isDeleted) {
      throw new UnauthorizedException('Unauthorized');
    }

    const data: {
      name?: string;
      phone?: string | null;
      avatar?: string | null;
    } = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.phone !== undefined) {
      data.phone = dto.phone === null || dto.phone === '' ? null : dto.phone;
    }

    // Prefer explicit imageUrl; fall back to avatar
    const image =
      dto.imageUrl !== undefined
        ? dto.imageUrl
        : dto.avatar !== undefined
          ? dto.avatar
          : undefined;
    if (image !== undefined) {
      data.avatar =
        image === null || image === '' ? null : image.trim();
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        name: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
      },
    });

    return this.toResponse(user);
  }

  private toResponse(user: {
    name: string;
    email: string;
    phone: string | null;
    avatar: string | null;
    role: string;
  }) {
    return {
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      /** Alias for FE image display — same value as avatar */
      imageUrl: user.avatar,
      role: user.role,
    };
  }
}
