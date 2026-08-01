import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { LlmService } from '../../common/ai/llm.service';
import type { ParsedResumeResult } from '../types/career.types';
import {
  buildResumeParsePrompt,
  ParsedResumeSchema,
  type ParsedResumePayload,
} from './resume-parse.schema';

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'text/plain']);

const MAX_RESUME_BYTES = 10 * 1024 * 1024;

@Injectable()
export class ResumeParserService {
  private readonly logger = new Logger(ResumeParserService.name);

  constructor(private readonly llm: LlmService) {}

  assertSupportedFile(file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Resume file is required');
    }
    if (file.size > MAX_RESUME_BYTES) {
      throw new BadRequestException('Resume file must be 10MB or smaller');
    }

    const mime = (file.mimetype || '').toLowerCase();
    const name = (file.originalname || '').toLowerCase();
    const isPdf = mime === 'application/pdf' || name.endsWith('.pdf');
    const isText = mime === 'text/plain' || name.endsWith('.txt');

    if (!isPdf && !isText && !ALLOWED_MIME_TYPES.has(mime)) {
      throw new BadRequestException(
        'Unsupported resume type. Upload a PDF or plain text file.',
      );
    }
  }

  async extractText(file: Express.Multer.File): Promise<string> {
    this.assertSupportedFile(file);

    const mime = (file.mimetype || '').toLowerCase();
    const name = (file.originalname || '').toLowerCase();
    const isText = mime === 'text/plain' || name.endsWith('.txt');

    if (isText) {
      return file.buffer.toString('utf8').trim();
    }

    try {
      const parser = new PDFParse({ data: file.buffer });
      const result = await parser.getText();
      return (result.text || '').trim();
    } catch (error) {
      this.logger.warn(
        `PDF text extraction failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new BadRequestException(
        'Could not read resume PDF. Upload a text-based PDF.',
      );
    }
  }

  async parseResumeText(resumeText: string): Promise<ParsedResumeResult> {
    if (!resumeText || resumeText.length < 40) {
      throw new BadRequestException(
        'Resume text is too short to parse. Upload a clearer PDF or text file.',
      );
    }

    if (!this.llm.isConfigured()) {
      this.logger.warn('LLM not configured; skipping AI resume parse');
      return { skills: [], experience: [], education: [] };
    }

    const prompt = buildResumeParsePrompt(resumeText);
    const raw = await this.llm.generateJson<unknown>(prompt);
    const parsed = ParsedResumeSchema.safeParse(raw);

    if (!parsed.success) {
      this.logger.warn(
        `Resume parse schema validation failed: ${parsed.error.message}`,
      );
      return { skills: [], experience: [], education: [] };
    }

    return this.toResult(parsed.data);
  }

  private toResult(payload: ParsedResumePayload): ParsedResumeResult {
    return {
      skills: payload.skills.map((skill) => ({
        name: skill.name,
        level: skill.level ?? null,
      })),
      experience: payload.experience.map((item) => ({
        company: item.company,
        role: item.role,
        startDate: item.startDate ?? null,
        endDate: item.endDate ?? null,
        description: item.description ?? null,
      })),
      education: payload.education.map((item) => ({
        institution: item.institution,
        degree: item.degree ?? null,
        field: item.field ?? null,
        startDate: item.startDate ?? null,
        endDate: item.endDate ?? null,
      })),
    };
  }
}
