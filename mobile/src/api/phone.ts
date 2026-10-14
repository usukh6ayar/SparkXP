import { apiRequest } from './client';
import type { AuthResult, AuthUser } from './auth';

/** What a verification needs on screen. `verificationId` is ours, not verify.mn's. */
export interface PhoneSession {
  verificationId: string;
  smsUri: string;
  displayInstruction: string;
  expiresAt: string;
}

export type PhoneStatus = 'pending' | 'verified' | 'expired';
export type PublicPurpose = 'register' | 'login' | 'reset';

/** SMS-before check so nobody pays 150₮ to learn their username is taken. */
export function checkAvailability(q: { username?: string; phone?: string; fullName?: string }) {
  const params = new URLSearchParams();
  if (q.username) params.set('username', q.username);
  if (q.phone) params.set('phone', q.phone);
  if (q.fullName) params.set('fullName', q.fullName);
  return apiRequest<{ username?: boolean; phone?: boolean; fullName?: boolean }>(
    `/auth/check-availability?${params}`,
  );
}

export function startPhoneVerification(phone: string, purpose: PublicPurpose) {
  return apiRequest<PhoneSession>('/auth/phone/start', { method: 'POST', body: { phone, purpose } });
}

/** Logged-in variant (purpose = link). */
export function startLinkPhone(phone: string, token: string) {
  return apiRequest<PhoneSession>('/users/me/phone/start', { method: 'POST', body: { phone }, token });
}

export function getPhoneStatus(verificationId: string) {
  return apiRequest<{ status: PhoneStatus }>(`/auth/phone/status/${verificationId}`);
}

export interface RegisterPhonePayload {
  verificationId: string;
  username: string;
  password: string;
  fullName: string;
  email?: string;
  level?: string;
  province?: string;
  district?: string;
  referralCode?: string;
  tasteCompleted?: boolean;
}

export function registerWithPhone(payload: RegisterPhonePayload) {
  return apiRequest<AuthResult>('/auth/register-phone', { method: 'POST', body: payload });
}

export function loginWithPhone(verificationId: string) {
  return apiRequest<AuthResult>('/auth/phone/login', { method: 'POST', body: { verificationId } });
}

export function resetWithPhone(verificationId: string, password: string) {
  return apiRequest<AuthResult>('/auth/phone/reset', { method: 'POST', body: { verificationId, password } });
}

export function linkPhone(verificationId: string, token: string) {
  return apiRequest<AuthUser>('/users/me/phone', { method: 'POST', body: { verificationId }, token });
}
