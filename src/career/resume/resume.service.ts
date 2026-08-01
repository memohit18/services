import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { R2StorageService } from '../../fitforge/media/uploads/services/r2-storage.service';
import { UploadResumeDto } from './dto/upload-resume.dto';
import { ResumeParserService } from './parser.service';

@Injectable()
export class ResumeService {
  private readonly logger = new Logger(ResumeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2StorageService,
    private readonly parser: ResumeParserService,
  ) {}

  async upload(userId: string, file: Express.Multer.File, dto: UploadResumeDto) {
    this.parser.assertSupportedFile(file);

    const safeName = (file.originalname || 'resume.pdf').replace(
      /[^a-zA-Z0-9._-]/g,
      '_',
    );
    const fileKey = `uploads/${userId}/resumes/${randomUUID()}-${safeName}`;
    const contentType = file.mimetype || 'application/pdf';

    const uploaded = await this.r2.putObject(fileKey, file.buffer, contentType);

    const existingCount = await this.prisma.resume.count({ where: { userId } });
    const version = existingCount + 1;
    const isDefault = existingCount === 0;
    const title = dto.title?.trim() || safeName;

    // Persist first so the resume exists even if AI parse fails.
    let resume = await this.prisma.resume.create({
      data: {
        userId,
        title,
        fileUrl: uploaded.url,
        fileKey: uploaded.key,
        version,
        isDefault,
      },
    });

    try {
      const text = await this.parser.extractText(file);
      const parsed = await this.parser.parseResumeText(text);
      resume = await this.prisma.resume.update({
        where: { id: resume.id },
        data: {
          parsedSkills: parsed.skills as unknown as Prisma.InputJsonValue,
          parsedExperience:
            parsed.experience as unknown as Prisma.InputJsonValue,
          parsedEducation:
            parsed.education as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Resume AI parse skipped for ${resume.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return {
      resumeId: resume.id,
      title: resume.title,
      version: resume.version,
      isDefault: resume.isDefault,
      fileUrl: resume.fileUrl,
      parsed: {
        skills: resume.parsedSkills,
        experience: resume.parsedExperience,
        education: resume.parsedEducation,
      },
    };
  }

  async list(userId: string) {
    return this.prisma.resume.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { version: 'desc' }],
      select: {
        id: true,
        title: true,
        fileUrl: true,
        version: true,
        isDefault: true,
        parsedSkills: true,
        parsedExperience: true,
        parsedEducation: true,
        createdAt: true,
      },
    });
  }

  async remove(userId: string, resumeId: string) {
    const resume = await this.prisma.resume.findFirst({
      where: { id: resumeId, userId },
    });
    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    try {
      await this.r2.deleteObject(resume.fileKey);
    } catch (error) {
      this.logger.warn(
        `Best-effort R2 delete failed for ${resume.fileKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    await this.prisma.resume.delete({ where: { id: resume.id } });

    if (resume.isDefault) {
      const next = await this.prisma.resume.findFirst({
        where: { userId },
        orderBy: { version: 'desc' },
      });
      if (next) {
        await this.prisma.resume.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    return { resumeId: resume.id };
  }

  async setDefault(userId: string, resumeId: string) {
    const resume = await this.prisma.resume.findFirst({
      where: { id: resumeId, userId },
    });
    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    await this.prisma.$transaction([
      this.prisma.resume.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.resume.update({
        where: { id: resume.id },
        data: { isDefault: true },
      }),
    ]);

    return this.prisma.resume.findUniqueOrThrow({ where: { id: resume.id } });
  }
}
