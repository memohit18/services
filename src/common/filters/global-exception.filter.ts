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
  }): string {
    if (exception.message.includes('requires authentication')) {
      return 'MongoDB authentication failed. Check MONGODB_URL credentials in .env';
    }

    return 'MongoDB operation failed';
  }
}
