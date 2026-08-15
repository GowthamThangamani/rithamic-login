import { CONFIG } from '../config/index.ts';
import { ApiResponse, AuthResponseDto, SessionItemDto, SsoTicketResponseDto, WorkspaceApp } from '../types/index.ts';
import { trackEvent } from './telemetryService.ts';

const handleResponse = async <T>(res: Response): Promise<T> => {
  const json: ApiResponse<T> = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || json.errorCode || 'Operation failed.');
  }
  return json.data as T;
};

export const requestOtp = async (projectKey: string, recipient: string) => {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/auth/${projectKey}/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient, channel: 'email', purpose: 'login' })
  });
  const data = await handleResponse<{ requested: boolean }>(res);
  trackEvent('auth', 'otp_requested', { projectKey, recipient });
  return data;
};

export const verifyOtp = async (projectKey: string, recipient: string, otp: string): Promise<AuthResponseDto> => {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/auth/${projectKey}/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient, otp })
  });
  const data = await handleResponse<AuthResponseDto>(res);
  trackEvent('auth', 'otp_verified', { projectKey, email: recipient });
  return data;
};

export const loginWithPassword = async (projectKey: string, email: string, password: string): Promise<AuthResponseDto> => {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/auth/${projectKey}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await handleResponse<AuthResponseDto>(res);
  trackEvent('auth', 'password_login_success', { projectKey, email });
  return data;
};

export const forgotPassword = async (projectKey: string, email: string) => {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/auth/${projectKey}/password/forgot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  const data = await handleResponse<{ dispatched: boolean }>(res);
  trackEvent('auth', 'password_forgot_requested', { projectKey, email });
  return data;
};

export const resetPassword = async (projectKey: string, email: string, resetToken: string, newPassword: string) => {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/auth/${projectKey}/password/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, resetToken, newPassword })
  });
  const data = await handleResponse<{ reset: boolean }>(res);
  trackEvent('auth', 'password_reset_success', { projectKey, email });
  return data;
};

export const loginWithGoogle = async (projectKey: string, idToken: string): Promise<AuthResponseDto> => {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/auth/oauth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectKey, idToken })
  });
  const data = await handleResponse<AuthResponseDto>(res);
  trackEvent('auth', 'google_login_success', { projectKey });
  return data;
};

export const requestMagicLink = async (projectKey: string, email: string) => {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/auth/${projectKey}/magic-link/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  const data = await handleResponse<{ sent: boolean }>(res);
  trackEvent('auth', 'magic_link_requested', { projectKey, email });
  return data;
};

export const verifyMagicLink = async (projectKey: string, token: string): Promise<AuthResponseDto> => {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/auth/${projectKey}/magic-link/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  const data = await handleResponse<AuthResponseDto>(res);
  trackEvent('auth', 'magic_link_verified', { projectKey });
  return data;
};

export const refreshSession = async (refreshToken: string): Promise<AuthResponseDto> => {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  return await handleResponse<AuthResponseDto>(res);
};

export const logoutSession = async (refreshToken?: string | null, token?: string | null): Promise<void> => {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    await fetch(`${CONFIG.API_BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ refreshToken: refreshToken || null })
    });
  } catch {}
  trackEvent('auth', 'logout');
};

export const getActiveSessions = async (token: string): Promise<SessionItemDto[]> => {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/auth/sessions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return await handleResponse<SessionItemDto[]>(res);
};

export const revokeSession = async (token: string, sessionId: string): Promise<boolean> => {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/auth/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await handleResponse<{ revoked: boolean }>(res);
  return data.revoked;
};

export const revokeAllSessions = async (token: string): Promise<boolean> => {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/auth/sessions/revoke-all`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await handleResponse<{ revokedAll: boolean }>(res);
  return data.revokedAll;
};

export const fetchWorkspaces = async (token: string): Promise<WorkspaceApp[]> => {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/auth/sso/workspaces`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return await handleResponse<WorkspaceApp[]>(res);
};

export const generateSsoTicket = async (token: string, targetProject: string): Promise<SsoTicketResponseDto> => {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/auth/sso/generate-ticket`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ targetProject })
  });
  const data = await handleResponse<SsoTicketResponseDto>(res);
  trackEvent('sso', 'ticket_generated', { targetProject });
  return data;
};
