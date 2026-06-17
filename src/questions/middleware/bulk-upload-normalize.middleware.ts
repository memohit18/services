import {
  BadRequestException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class BulkUploadNormalizeMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    if (!Array.isArray(req.body)) {
      next();
      return;
    }

    if (req.body.length === 0) {
      throw new BadRequestException(
        'Bulk upload array must not be empty. Use { "testcases": [...] } or { "questions": [...] }.',
      );
    }

    const firstItem = req.body[0] as Record<string, unknown>;

    if ('input' in firstItem && 'expectedOutput' in firstItem) {
      req.body = { testcases: req.body };
      next();
      return;
    }

    if ('title' in firstItem && 'problemStatement' in firstItem) {
      req.body = { questions: req.body };
      next();
      return;
    }

    throw new BadRequestException(
      'Unrecognized bulk upload array. Use { "testcases": [...] } or { "questions": [...] }.',
    );
  }
}
