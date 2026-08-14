export type UserRole = 'admin' | 'editor' | 'viewer';

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  projectKey: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: AuthUser;
  returnUrl?: string;
  error?: string;
}

export interface WorkspaceApp {
  projectKey: string;
  name: string;
  role: UserRole;
  iconUrl?: string | null;
  launchUrl?: string | null;
}

export interface ProductSuite {
  suiteKey: string;
  suiteName: string;
  apps: WorkspaceApp[];
}

export interface WorkspacesResponse {
  success: boolean;
  email: string;
  totalWorkspaces: number;
  suites: ProductSuite[];
  standalone: WorkspaceApp[];
}

export interface SsoTicketResponse {
  success: boolean;
  ticket: string;
  targetProjectKey: string;
  targetProjectName: string;
  expiresInSeconds: number;
  redirectUrl: string;
}
