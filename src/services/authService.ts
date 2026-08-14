import { CONFIG } from '../config/index.ts';
import { AuthResponse, SsoTicketResponse, WorkspacesResponse } from '../types/index.ts';
import { trackEvent } from './telemetryService.ts';

export const requestOtp = async (projectKey: string, recipient: string) => {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/auth/${projectKey}/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient, channel: 'email', purpose: 'login' })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to send verification code.');
  trackEvent('auth', 'otp_requested', { projectKey, recipient });
  return data;
};

export const verifyOtp = async (projectKey: string, recipient: string, otp: string): Promise<AuthResponse> => {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/auth/${projectKey}/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient, otp })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Invalid verification code.');
  trackEvent('auth', 'otp_verified', { projectKey, email: recipient });
  return data;
};

export const loginWithGoogle = async (projectKey: string, idToken: string): Promise<AuthResponse> => {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/auth/oauth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectKey, idToken })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Google authentication failed.');
  trackEvent('auth', 'google_login_success', { projectKey });
  return data;
};

export const requestMagicLink = async (projectKey: string, recipient: string, returnUrl?: string) => {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/auth/${projectKey}/magic-link/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient, returnUrl })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to dispatch magic link.');
  trackEvent('auth', 'magic_link_requested', { projectKey, recipient });
  return data;
};

export const verifyMagicLink = async (projectKey: string, token: string): Promise<AuthResponse> => {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/auth/${projectKey}/magic-link/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Magic link is invalid or expired.');
  trackEvent('auth', 'magic_link_verified', { projectKey });
  return data;
};

export const generateSsoTicket = async (token: string, targetProjectKey: string): Promise<SsoTicketResponse> => {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/auth/sso/generate-ticket`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ targetProjectKey })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to generate SSO ticket.');
  trackEvent('sso', 'ticket_generated', { targetProjectKey });
  return data;
};

export const fetchWorkspaces = async (token: string): Promise<WorkspacesResponse> => {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/auth/hub/workspaces`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch user workspaces.');
  return data;
};

export const logoutSession = async (token: string): Promise<void> => {
  try {
    await fetch(`${CONFIG.API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  } catch {}
  trackEvent('auth', 'logout');
};
