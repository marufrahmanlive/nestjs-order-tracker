import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainException } from '../exceptions';
import { ErrorResponseDto } from '../dto';
import { ERROR_CODES } from '../constants';

/**
 * Global HTTP exception filter for REST APIs.
 * Handles three layers of exceptions:
 * 1. DomainException - application-level exceptions with custom codes
 * 2. HttpException - NestJS built-in exceptions
 * 3. Anything else - internal server errors (stack trace not exposed)
 *
 * Always returns a standardized ErrorResponseDto.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const path = req.url;
    const method = req.method;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = ERROR_CODES.INTERNAL_ERROR;
    let message = 'Internal server error';
    let errors: Record<string, any> | string[] | undefined = undefined;

    if (exception instanceof DomainException) {
      // Application-level domain exception
      statusCode = exception.getStatus();
      code = exception.code;
      message = exception.message;
      errors = exception.details;

      this.logger.warn(
        `Domain Exception: [${method}] ${path} - ${code}: ${message}`,
      );
    } else if (exception instanceof HttpException) {
      // NestJS built-in HTTP exceptions
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const body = exceptionResponse as any;
        message = body.message || exception.message;
        code = body.code || this.statusToErrorCode(statusCode);

        // Handle class-validator validation errors
        if (body.error === 'Bad Request' && Array.isArray(body.message)) {
          errors = this.formatValidationErrors(body.message);
        } else if (typeof body.error === 'string') {
          errors = body.error;
        } else if (body.errors) {
          errors = body.errors;
        }
      } else {
        code = this.statusToErrorCode(statusCode);
      }

      this.logger.warn(
        `HTTP Exception: [${method}] ${path} - ${statusCode} ${code}: ${message}`,
      );
    } else if (exception instanceof Error) {
      // Unhandled errors
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      code = ERROR_CODES.INTERNAL_ERROR;
      message = 'An unexpected error occurred';
      this.logger.error(
        `Unhandled Exception: [${method}] ${path}`,
        exception.stack,
      );
    } else {
      // Unknown error type
      this.logger.error(
        `Unknown Exception Type: [${method}] ${path}`,
        JSON.stringify(exception),
      );
    }

    const errorResponse = new ErrorResponseDto(
      code,
      message,
      statusCode,
      path,
      errors,
    );

    res.status(statusCode).json(errorResponse);
  }

  /**
   * Convert HTTP status code to error code
   */
  private statusToErrorCode(status: number): string {
    const statusToCodeMap: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: ERROR_CODES.VALIDATION_FAILED,
      [HttpStatus.UNAUTHORIZED]: ERROR_CODES.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ERROR_CODES.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ERROR_CODES.NOT_FOUND,
      [HttpStatus.CONFLICT]: ERROR_CODES.CONFLICT,
      [HttpStatus.UNPROCESSABLE_ENTITY]: ERROR_CODES.INVALID_INPUT,
      [HttpStatus.TOO_MANY_REQUESTS]: ERROR_CODES.RATE_LIMITED,
      [HttpStatus.INTERNAL_SERVER_ERROR]: ERROR_CODES.INTERNAL_ERROR,
      [HttpStatus.SERVICE_UNAVAILABLE]: ERROR_CODES.SERVICE_UNAVAILABLE,
      [HttpStatus.GATEWAY_TIMEOUT]: ERROR_CODES.SERVICE_TIMEOUT,
    };

    return statusToCodeMap[status] || ERROR_CODES.INTERNAL_ERROR;
  }

  /**
   * Format class-validator validation errors
   */
  private formatValidationErrors(
    validationErrors: any[],
  ): Record<string, string[]> {
    const formatted: Record<string, string[]> = {};

    validationErrors.forEach((error) => {
      if (error.property) {
        if (!formatted[error.property]) {
          formatted[error.property] = [];
        }
        if (error.constraints) {
          formatted[error.property].push(...Object.values(error.constraints));
        }
        if (error.children && Array.isArray(error.children)) {
          // Handle nested validation errors
          const nestedErrors = this.formatValidationErrors(error.children);
          Object.keys(nestedErrors).forEach((key) => {
            const nestedKey = `${error.property}.${key}`;
            formatted[nestedKey] = nestedErrors[key];
          });
        }
      }
    });

    return formatted;
  }
}
