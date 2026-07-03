import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, error, message } = this.resolveException(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private resolveException(exception: unknown): {
    status: number;
    error: string;
    message: string | string[];
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        return {
          status,
          error: HttpStatus[status] ?? 'Error',
          message: body,
        };
      }

      const payload = body as Record<string, unknown>;
      return {
        status,
        error: String(payload.error ?? HttpStatus[status] ?? 'Error'),
        message: this.normalizeMessage(payload.message),
      };
    }

    if (this.isMongoServerError(exception)) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        message: this.getMongoErrorMessage(exception),
      };
    }

    if (this.isPrismaConnectionError(exception)) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        message:
          'PostgreSQL is unavailable. Check DATABASE_URL and ensure Postgres is running.',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Internal server error',
    };
  }

  private normalizeMessage(message: unknown): string | string[] {
    if (Array.isArray(message)) {
      return message.map(String);
    }
    if (typeof message === 'string') {
      return message;
    }
    return 'An unexpected error occurred';
  }

  private isMongoServerError(
    exception: unknown,
  ): exception is { name: string; message: string } {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'name' in exception &&
      (exception as { name: string }).name === 'MongoServerError'
    );
  }

  private getMongoErrorMessage(exception: {
    name: string;
    message: string;
    code?: number;
  }): string {
    if (exception.message.includes('requires authentication')) {
      return 'MongoDB authentication failed. Check MONGODB_URL credentials in .env';
    }

    if (exception.code === 224) {
      return 'MongoDB upsert query is invalid. Deploy the latest services build.';
    }

    return 'MongoDB operation failed';
  }

  private isPrismaConnectionError(exception: unknown): boolean {
    if (typeof exception !== 'object' || exception === null) {
      return false;
    }

    const error = exception as { code?: string; message?: string };
    const connectionCodes = new Set(['P1000', 'P1001', 'P1008', 'P1017']);
    if (error.code && connectionCodes.has(error.code)) {
      return true;
    }

    const message = error.message ?? '';
    return (
      message.includes('ECONNREFUSED') ||
      message.includes("Can't reach database server") ||
      message.includes('Connection terminated')
    );
  }
}
