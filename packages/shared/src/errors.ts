/**
 * Consistent error shape. Source of truth: docs/API_CONTRACT.md § Error shape.
 *
 *   { "error": { "code": "string_code", "message": "human readable", "details": {} } }
 */

export type ErrorCode =
  | 'validation_error' // 400
  | 'unauthorized' // 401
  | 'forbidden' // 403
  | 'not_found' // 404
  | 'conflict' // 409
  | 'unprocessable' // 422
  | 'rate_limited' // 429
  | 'internal_error' // 500
  | 'ai_unavailable'; // 503

export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** Maps each error code to its canonical HTTP status. */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  validation_error: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  unprocessable: 422,
  rate_limited: 429,
  internal_error: 500,
  ai_unavailable: 503,
};
