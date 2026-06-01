/**
 * Standard error response DTO returned by all exception filters.
 * Provides consistent error structure across all services.
 */
export class ErrorResponseDto {
  /**
   * Stable error code for programmatic error handling
   */
  code: string;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * HTTP status code (informational only)
   */
  statusCode: number;

  /**
   * Request path that caused the error
   */
  path?: string;

  /**
   * Timestamp when the error occurred
   */
  timestamp?: string;

  /**
   * Validation errors or additional error details
   */
  errors?: Record<string, any> | string[];

  constructor(
    code: string,
    message: string,
    statusCode: number,
    path?: string,
    errors?: Record<string, any> | string[],
  ) {
    this.code = code;
    this.message = message;
    this.statusCode = statusCode;
    this.path = path;
    this.timestamp = new Date().toISOString();
    this.errors = errors;
  }
}
