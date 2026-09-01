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

export interface ClientProjectDto {
  id: number;
  projectKey: string;
  projectName: string;
  companyName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  webhookUrl?: string | null;
  productSuite?: string | null;
  appIconUrl?: string | null;
  appLaunchUrl?: string | null;
  allowedOrigins: string[];
  rateLimitMax: number;
  rateLimitWindowMs: number;
  isActive: boolean;
  monthlyQuotaEmails: number;
  monthlyQuotaSms: number;
  createdAt: string;
}

export interface ApiKeyDto {
  id: number;
  projectKey: string;
  keyName: string;
  keyPrefix: string;
  apiKey?: string; // only present upon creation
  scopes: string[];
  rateLimitPerMinute: number;
  isActive: boolean;
  lastUsedAt?: string | null;
  createdAt: string;
}

export interface CommunicationsLogDto {
  id: number;
  projectKey: string;
  recipient: string;
  channel: string;
  messageType: string;
  provider: string;
  status: string;
  errorMessage?: string | null;
  createdAt: string;
}

export interface ProjectAccountingDto {
  projectKey: string;
  projectName: string;
  companyName?: string | null;
  year: number;
  month: number;
  totalEmailsSent: number;
  totalSmsSent: number;
  monthlyQuotaEmails: number;
  monthlyQuotaSms: number;
  totalSuccess: number;
  totalFailed: number;
}
