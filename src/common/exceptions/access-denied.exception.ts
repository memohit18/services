import { HttpException, HttpStatus } from '@nestjs/common';

export class AccessDeniedException extends HttpException {
  constructor(message = 'Access denied') {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        error: 'Forbidden',
        message,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
