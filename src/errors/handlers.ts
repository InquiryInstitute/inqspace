/**
 * Error Handling Module for GitHub Classroom Support
 * Provides consistent error response format and error handling utilities
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER_ERROR = 'SERVER_ERROR',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  TIMEOUT = 'TIMEOUT',
}

/**
 * Error response format
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: {
      field?: string;
      reason?: string;
      [key: string]: any;
    };
    requestId: string;
    timestamp: string;
    retryable?: boolean;
    category?: ErrorCategory;
  };
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public message: string,
    public code: string,
    public category: ErrorCategory = ErrorCategory.SERVER_ERROR,
    public details?: Record<string, any>,
    public retryable: boolean = false,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends ApiError {
  constructor(message: string, field?: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', ErrorCategory.VALIDATION, details, false, 400);
    if (field) {
      this.details = { ...this.details, field };
    }
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', ErrorCategory.AUTHENTICATION, undefined, false, 401);
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends ApiError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', ErrorCategory.AUTHORIZATION, undefined, false, 403);
  }
}

/**
 * Not found error
 */
export class NotFoundError extends ApiError {
  constructor(entity: string, id: string) {
    super(`${entity} with id ${id} not found`, 'NOT_FOUND', ErrorCategory.NOT_FOUND, { entity, id }, false, 404);
  }
}

/**
 * Conflict error
 */
export class ConflictError extends ApiError {
  constructor(message: string = 'Resource conflict') {
    super(message, 'CONFLICT_ERROR', ErrorCategory.CONFLICT, undefined, false, 409);
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends ApiError {
  constructor(
    public resetTime: Date,
    message: string = 'Rate limit exceeded'
  ) {
    super(message, 'RATE_LIMIT_ERROR', ErrorCategory.RATE_LIMIT, { resetTime: resetTime.toISOString() }, true, 429);
  }
}

/**
 * External service error
 */
export class ExternalServiceError extends ApiError {
  constructor(
    public service: string,
    message: string,
    public originalError?: Error
  ) {
    super(message, 'EXTERNAL_SERVICE_ERROR', ErrorCategory.EXTERNAL_SERVICE, { service }, true, 503);
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends ApiError {
  constructor(message: string = 'Request timeout') {
    super(message, 'TIMEOUT_ERROR', ErrorCategory.TIMEOUT, undefined, true, 504);
  }
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Format error response
 */
export function formatErrorResponse(error: ApiError | Error, requestId: string): ErrorResponse {
  const apiError = error instanceof ApiError ? error : new ApiError(
    error.message || 'An internal error occurred',
    'INTERNAL_ERROR',
    ErrorCategory.SERVER_ERROR,
    undefined,
    false,
    500
  );

  return {
    error: {
      code: apiError.code,
      message: apiError.message,
      details: apiError.details,
      requestId,
      timestamp: new Date().toISOString(),
      retryable: apiError.retryable,
      category: apiError.category,
    },
  };
}

/**
 * Error handling middleware
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = generateRequestId();
  console.error(`[${requestId}] Error:`, err);

  // Determine status code and error type
  let apiError: ApiError;

  if (err instanceof ApiError) {
    apiError = err;
  } else if (err.name === 'ValidationError' || err.message.includes('Validation')) {
    apiError = new ValidationError(err.message);
  } else if (err.name === 'NotFoundError' || err.message.includes('not found')) {
    apiError = new NotFoundError('Resource', 'unknown');
  } else if (err.name === 'AuthenticationError' || err.message.includes('Authentication')) {
    apiError = new AuthenticationError(err.message);
  } else if (err.name === 'AuthorizationError' || err.message.includes('Permission')) {
    apiError = new AuthorizationError(err.message);
  } else if (err.name === 'ConflictError' || err.message.includes('Conflict')) {
    apiError = new ConflictError(err.message);
  } else if (err.name === 'RateLimitError' || err.message.includes('Rate limit')) {
    apiError = new RateLimitError(new Date(), err.message);
  } else if (err.name === 'TimeoutError' || err.message.includes('timeout')) {
    apiError = new TimeoutError(err.message);
  } else {
    apiError = new ApiError(
      err.message || 'An internal error occurred',
      'INTERNAL_ERROR',
      ErrorCategory.SERVER_ERROR,
      process.env.NODE_ENV === 'development' ? { stack: err.stack } : undefined,
      false,
      500
    );
  }

  const response = formatErrorResponse(apiError, requestId);

  // Set status code
  res.status(apiError.statusCode);

  // Send response
  res.json(response);
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryableStatusCodes: number[];
}

/**
 * Default retry configuration
 */
export const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  retryableStatusCodes: [429, 502, 503, 504],
};

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoff(retryCount: number, config: RetryConfig = defaultRetryConfig): number {
  const delay = Math.min(
    config.baseDelay * Math.pow(2, retryCount),
    config.maxDelay
  );
  // Add jitter to prevent thundering herd
  return delay * (0.5 + Math.random());
}

/**
 * Retry function for async operations
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = defaultRetryConfig
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < config.maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (error instanceof ApiError && !error.retryable) {
        throw error;
      }

      if (i < config.maxRetries - 1) {
        const delay = calculateBackoff(i, config);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Retry failed');
}
