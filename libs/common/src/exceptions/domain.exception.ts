import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants';

/**
 * Custom domain exception for application-level errors.
 * Carries a stable error code so clients can handle errors programmatically.
 * The HTTP status is informational; clients should branch on `code`, not status.
 */
export class DomainException extends HttpException {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, any>;

  constructor(
    code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, any>,
  ) {
    super(
      {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
      },
      status,
    );
    this.code = code;
    this.details = details;
  }
}
