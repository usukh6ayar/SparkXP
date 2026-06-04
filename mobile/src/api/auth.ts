import { apiRequest } from './client';

/** A user as returned by the backend (no password hash). */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  xp: number;
  sparks: number;
}

export interface AuthResult {
  accessToken: string;
  user: AuthUser;
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  province?: string;
  district?: string;
}

/** POST /api/auth/login */
export function login(email: string, password: string): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

/** POST /api/auth/register */
export function register(payload: RegisterPayload): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/register', {
    method: 'POST',
    body: payload,
  });
}

/** GET /api/auth/me — used to restore the session from a saved token. */
export function getMe(token: string): Promise<AuthUser> {
  return apiRequest<AuthUser>('/auth/me', { token });
}
