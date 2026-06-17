import { apiRequest } from './client';

/** A user as returned by the backend (no password hash). */
export interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  fullName: string;
  role: string;
  xp: number;
  sparks: number;
  emailVerified: boolean;
  avatarUrl: string | null;
  level: string | null;
  englishName: string | null;
}

export interface AuthResult {
  accessToken: string;
  user: AuthUser;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  fullName: string;
  level?: string;
  englishName?: string;
  province?: string;
  district?: string;
}

/** POST /api/auth/register — creates an unverified account + emails an OTP. */
export function register(
  payload: RegisterPayload,
): Promise<{ pendingVerification: true; email: string }> {
  return apiRequest('/auth/register', { method: 'POST', body: payload });
}

/** POST /api/auth/verify-otp — confirm the email → returns a session. */
export function verifyOtp(email: string, code: string): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/verify-otp', {
    method: 'POST',
    body: { email, code },
  });
}

/** POST /api/auth/resend-otp — re-send the verification code. */
export function resendOtp(email: string): Promise<{ ok: true }> {
  return apiRequest('/auth/resend-otp', { method: 'POST', body: { email } });
}

/** POST /api/auth/login — username (or email) + password. */
export function login(identifier: string, password: string): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/login', {
    method: 'POST',
    body: { identifier, password },
  });
}

/** POST /api/auth/forgot-password — email a reset code. */
export function forgotPassword(email: string): Promise<{ ok: true }> {
  return apiRequest('/auth/forgot-password', { method: 'POST', body: { email } });
}

/** POST /api/auth/reset-password — set a new password with the emailed code. */
export function resetPassword(
  email: string,
  code: string,
  password: string,
): Promise<{ ok: true }> {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    body: { email, code, password },
  });
}

/** GET /api/auth/me — used to restore the session from a saved token. */
export function getMe(token: string): Promise<AuthUser> {
  return apiRequest<AuthUser>('/auth/me', { token });
}
