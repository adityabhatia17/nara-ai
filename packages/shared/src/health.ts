/**
 * GET /health. Source: docs/API_CONTRACT.md § Health.
 */
export interface HealthResponse {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
  queue: 'up' | 'down';
}
