import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseRpcExceptionFilter, RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';
import { DomainException } from '../exceptions';
import { ERROR_CODES } from '../constants';

/**
 * Exception filter for microservices (TCP, RabbitMQ, etc.).
 * Converts any thrown exception into a safe RpcException that won't leak stack traces.
 *
 * Three layers:
 * 1. RpcException - pass through as-is
 * 2. DomainException - convert to RpcException with code + status
 * 3. HttpException - convert to RpcException derived from status
 * 4. Anything else - wrap as internal error
 */
@Catch()
export class RpcExceptionFilter extends BaseRpcExceptionFilter {
  private readonly logger = new Logger(RpcExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): Observable<never> {
    // If it's already an RpcException, let the base handler deal with it
    if (exception instanceof RpcException) {
      return super.catch(exception, host);
    }

    if (exception instanceof DomainException) {
      // Domain exception - extract code and status
      const status = exception.getStatus();
      const payload = {
        code: exception.code,
        message: exception.message,
        status,
        details: exception.details,
        timestamp: new Date().toISOString(),
      };
      this.logger.warn(
        `Domain Exception in RPC: ${exception.code} - ${exception.message}`,
      );
      return throwError(() => new RpcException(payload));
    }

    if (exception instanceof HttpException) {
      // HTTP exception - derive code from status
      const status = exception.getStatus();
      const response = exception.getResponse();

      let message = exception.message;
      let code = this.statusToErrorCode(status);
      let details: any = undefined;

      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        const body = response as any;
        message = body.message || exception.message;
        code = body.code || code;
        details = body.details || body.errors;
      }

      const payload = {
        code,
        message,
        status,
        details,
        timestamp: new Date().toISOString(),
      };

      this.logger.warn(
        `HTTP Exception in RPC: ${status} - ${code}: ${message}`,
      );
      return throwError(() => new RpcException(payload));
    }

    if (exception instanceof Error) {
      // Known error types
      this.logger.error(
        `Unhandled Error in RPC: ${exception.message}`,
        exception.stack,
      );
      return throwError(
        () =>
          new RpcException({
            code: ERROR_CODES.INTERNAL_ERROR,
            message: 'Internal microservice error',
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            timestamp: new Date().toISOString(),
          }),
      );
    }

    // Unknown error type
    this.logger.error(
      `Unknown Exception Type in RPC`,
      JSON.stringify(exception),
    );
    return throwError(
      () =>
        new RpcException({
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Internal microservice error',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date().toISOString(),
        }),
    );
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
}
