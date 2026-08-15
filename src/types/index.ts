export type UserRole = 'admin' | 'super_admin' | 'editor' | 'viewer';

export interface AuthUser {
  id: number;
  email: string;
  phone: string | null;
  fullName: string;
  avatarUrl?: string | null;
  role: UserRole;
  projectKey: string;
}

export interface AuthResponseDto {
  sessionId: string;
  token: string;
  refreshToken: string;
  expiresIn: number; // 900 seconds
  user: AuthUser;
}

export interface SessionItemDto {
  sessionId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  lastActiveAt: string;
  isCurrentSession: boolean;
}

export interface WorkspaceApp {
  projectKey: string;
  projectName: string;
  productSuite?: string | null;
  appIconUrl?: string | null;
  appLaunchUrl?: string | null;
  role: UserRole;
}

export interface SsoTicketResponseDto {
  ticket: string;
  expiresAt: string;
  targetUrl: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errorCode?: string;
  correlationId?: string;
  errors?: Record<string, string[]>;
}
