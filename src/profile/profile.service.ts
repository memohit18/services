import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
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
      select: {
        id: true,
        isDeleted: true,
        password: true,
        phone: true,
      },
    });
    if (!existing || existing.isDeleted) {
      throw new UnauthorizedException('Unauthorized');
    }

    const hasProfileField =
      dto.name !== undefined ||
      dto.phone !== undefined ||
      dto.imageUrl !== undefined ||
      dto.avatar !== undefined ||
      dto.newPassword !== undefined;

    if (!hasProfileField) {
      throw new BadRequestException(
        'Provide at least one of: name, phone, avatar/imageUrl, newPassword',
      );
    }

    if (dto.currentPassword !== undefined && dto.newPassword === undefined) {
      throw new BadRequestException(
        'newPassword is required when currentPassword is provided',
      );
    }

    const data: {
      name?: string;
      phone?: string | null;
      avatar?: string | null;
      password?: string;
    } = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (dto.phone !== undefined) {
      const nextPhone =
        dto.phone === null || dto.phone === '' ? null : dto.phone.trim();
      if (nextPhone && nextPhone !== existing.phone) {
        const phoneTaken = await this.prisma.user.findUnique({
          where: { phone: nextPhone },
          select: { id: true },
        });
        if (phoneTaken && phoneTaken.id !== userId) {
          throw new ConflictException('Phone number already in use');
        }
      }
      data.phone = nextPhone;
    }

    // Prefer explicit imageUrl; fall back to avatar
    const image =
      dto.imageUrl !== undefined
        ? dto.imageUrl
        : dto.avatar !== undefined
          ? dto.avatar
          : undefined;
    if (image !== undefined) {
      data.avatar = image === null || image === '' ? null : image.trim();
    }

    if (dto.newPassword !== undefined) {
      data.password = await this.resolvePasswordUpdate(existing, dto);
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

  private async resolvePasswordUpdate(
    existing: {
      password: string | null;
    },
    dto: UpdateProfileDto,
  ): Promise<string> {
    const newPassword = dto.newPassword!;

    if (existing.password) {
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'currentPassword is required to change password',
        );
      }

      const valid = await argon2.verify(existing.password, dto.currentPassword);
      if (!valid) {
        throw new UnauthorizedException('Current password is incorrect');
      }
    } else if (dto.currentPassword) {
      throw new BadRequestException(
        'This account has no password set yet. Omit currentPassword and send newPassword only.',
      );
    }

    if (dto.currentPassword && dto.currentPassword === newPassword) {
      throw new BadRequestException(
        'newPassword must be different from currentPassword',
      );
    }

    return argon2.hash(newPassword);
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
