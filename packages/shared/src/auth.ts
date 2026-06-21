import type { ISODateTime, UUID } from './common.js';

/**
 * Auth + account. Source: docs/API_CONTRACT.md § Auth.
 */

/** POST /auth/magic-link */
export interface MagicLinkRequest {
  email: string;
}
export interface MagicLinkResponse {
  sent: true;
}

/** POST /auth/verify */
export interface VerifyRequest {
  token: string;
}
export interface VerifyResponse {
  access_token: string;
  refresh_token: string;
  user: { id: UUID; email: string };
}

/** GET /auth/me */
export interface MeResponse {
  id: UUID;
  email: string;
  created_at: ISODateTime;
  display_name: string | null;
}

/** DELETE /account */
export interface DeleteAccountResponse {
  deleted: true;
}
