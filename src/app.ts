import { CONFIG } from './config/index.ts';
import { AuthResponseDto, AuthUser } from './types/index.ts';
import { AlertBanner } from './components/AlertBanner.ts';
import { DeviceDrawer } from './components/DeviceDrawer.ts';
import { PasswordView } from './views/PasswordView.ts';
import { OtpView } from './views/OtpView.ts';
import { MagicLinkView } from './views/MagicLinkView.ts';
import { WorkspaceView } from './views/WorkspaceView.ts';
import { AdminConsoleView } from './views/AdminConsoleView.ts';
import { projectService } from './services/projectService.ts';
import * as authService from './services/authService.ts';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

class RithamicAuthApp {
  private alertBanner: AlertBanner;
  private deviceDrawer: DeviceDrawer;
  private passwordView!: PasswordView;
  private otpView!: OtpView;
  private magicLinkView!: MagicLinkView;
  private workspaceView!: WorkspaceView;
  private adminConsoleView!: AdminConsoleView;

  private targetProjectKey: string;
  private returnUrl: string | null;
  private resetToken: string | null;
  private resetEmail: string | null;
  private magicToken: string | null;

  // DOM Elements
  private appContainerEl: HTMLElement;
  private authCardEl: HTMLElement;
  private workspaceHubCardEl: HTMLElement;
  private adminConsoleContainerEl: HTMLElement;
  private brandHeaderEl: HTMLElement;
  private brandSuiteBadgeEl: HTMLElement;
  private brandTitleEl: HTMLElement;
  private brandSubtitleEl: HTMLElement;
  private tabPasswordBtn: HTMLButtonElement;
  private tabOtpBtn: HTMLButtonElement;
  private tabMagicBtn: HTMLButtonElement;
  private btnGoogleLogin: HTMLButtonElement;

  private authenticatedUser: AuthUser | null = null;

  constructor() {
    this.alertBanner = new AlertBanner('alertBox');
    this.deviceDrawer = new DeviceDrawer();

    const params = new URLSearchParams(window.location.search);
    const rawProject = params.get('project') || params.get('client_id') || CONFIG.DEFAULT_PROJECT_KEY;
    this.targetProjectKey = this.sanitizeProjectKey(rawProject);

    this.returnUrl = params.get('returnUrl') || params.get('redirect_uri') || params.get('relayState');
    this.resetToken = params.get('token') || params.get('resetToken');
    this.resetEmail = params.get('email');
    this.magicToken = params.get('magicToken');

    this.appContainerEl = document.getElementById('appContainer') as HTMLElement;
    this.authCardEl = document.getElementById('authCard') as HTMLElement;
    this.workspaceHubCardEl = document.getElementById('workspaceHubCard') as HTMLElement;
    this.adminConsoleContainerEl = document.getElementById('adminConsoleContainer') as HTMLElement;
    this.brandHeaderEl = document.querySelector('.brand-header') as HTMLElement;
    this.brandSuiteBadgeEl = document.getElementById('brandSuiteBadge') as HTMLElement;
    this.brandTitleEl = document.getElementById('brandTitle') as HTMLElement;
    this.brandSubtitleEl = document.getElementById('brandSubtitle') as HTMLElement;
    this.tabPasswordBtn = document.getElementById('tabPassword') as HTMLButtonElement;
    this.tabOtpBtn = document.getElementById('tabOtp') as HTMLButtonElement;
    this.tabMagicBtn = document.getElementById('tabMagic') as HTMLButtonElement;
    this.btnGoogleLogin = document.getElementById('btnGoogleLogin') as HTMLButtonElement;
  }

  public async init(): Promise<void> {
    await this.setupDynamicBranding();
    this.initViews();
    this.setupTabs();
    this.setupGoogleOAuthFallback();

    // Check if directly navigating to admin mode
    const params = new URLSearchParams(window.location.search);
    const wantsAdmin = params.get('view') === 'admin' || window.location.pathname.startsWith('/admin');

    // 1. If URL has reset password token -> open reset password flow
    if (this.resetToken && this.resetEmail) {
      this.passwordView.showResetFlow(this.resetEmail, this.resetToken);
      return;
    }

    // 2. If URL has magic token -> verify magic link
    if (this.magicToken) {
      await this.magicLinkView.verifyToken(this.magicToken);
      return;
    }

    // 3. Silent Token Bootstrap Cycle on page reload
    await this.performSilentBootstrap(wantsAdmin);
  }

  private sanitizeProjectKey(raw: string): string {
    const clean = raw.trim().toLowerCase();
    if (/^[a-z0-9_]{3,40}$/.test(clean)) {
      return clean;
    }
    return CONFIG.DEFAULT_PROJECT_KEY;
  }

  /**
   * Azure AD B2C Style Dynamic Tenant Branding
   * Dynamically queries Core Service for tenant title, logo, and welcome instructions
   */
  private async setupDynamicBranding(): Promise<void> {
    if (this.targetProjectKey === CONFIG.DEFAULT_PROJECT_KEY) {
      this.brandTitleEl.textContent = 'Sign in to Rithamic B2C';
      this.brandSubtitleEl.textContent = 'Centralized Zero-Trust Identity Gateway';
      return;
    }

    try {
      const project = await projectService.getProjectByKey(this.targetProjectKey);
      this.brandTitleEl.textContent = `Sign in to ${project.projectName}`;
      document.title = `${project.projectName} — Rithamic B2C Identity`;

      if (project.companyName) {
        this.brandSubtitleEl.textContent = `${project.companyName} • Secure Single Sign-On`;
      } else {
        this.brandSubtitleEl.textContent = `Zero-Trust SSO Authentication for ${project.projectName}`;
      }

      if (project.productSuite) {
        this.brandSuiteBadgeEl.textContent = project.productSuite.replace(/_/g, ' ').toUpperCase();
      }
    } catch {
      // Fallback if backend temporarily unavailable
      const formatted = this.targetProjectKey
        .replace(/^rithamic_/, '')
        .replace(/_/g, ' ')
        .toUpperCase();
      this.brandTitleEl.textContent = `Sign in to ${formatted}`;
      this.brandSubtitleEl.textContent = `Centralized SSO Access for ${this.targetProjectKey}`;
    }
  }

  private initViews(): void {
    const handleAuthSuccess = (auth: AuthResponseDto) => this.onAuthenticated(auth);

    this.passwordView = new PasswordView(this.targetProjectKey, this.alertBanner, handleAuthSuccess);
    this.otpView = new OtpView(this.targetProjectKey, this.alertBanner, handleAuthSuccess);
    this.magicLinkView = new MagicLinkView(this.targetProjectKey, this.alertBanner, handleAuthSuccess);
    this.workspaceView = new WorkspaceView(
      this.alertBanner,
      this.deviceDrawer,
      this.returnUrl,
      () => this.openAdminConsole()
    );
    this.adminConsoleView = new AdminConsoleView(
      this.adminConsoleContainerEl,
      () => this.closeAdminConsole()
    );
  }

  private openAdminConsole(): void {
    if (!this.authenticatedUser) return;
    this.authCardEl.classList.add('hidden');
    this.workspaceHubCardEl.classList.add('hidden');
    this.brandHeaderEl.classList.add('hidden');
    this.appContainerEl.classList.add('admin-mode-container');
    this.adminConsoleContainerEl.classList.remove('hidden');

    this.adminConsoleView.render(this.authenticatedUser);
  }

  private closeAdminConsole(): void {
    this.adminConsoleContainerEl.classList.add('hidden');
    this.appContainerEl.classList.remove('admin-mode-container');
    this.brandHeaderEl.classList.remove('hidden');
    if (this.authenticatedUser) {
      this.workspaceView.render(this.authenticatedUser);
    } else {
      this.authCardEl.classList.remove('hidden');
    }
  }

  private setupTabs(): void {
    this.tabPasswordBtn.addEventListener('click', () => this.switchTab('password'));
    this.tabOtpBtn.addEventListener('click', () => this.switchTab('otp'));
    this.tabMagicBtn.addEventListener('click', () => this.switchTab('magic'));
  }

  private switchTab(tab: 'password' | 'otp' | 'magic'): void {
    this.alertBanner.clear();
    [this.tabPasswordBtn, this.tabOtpBtn, this.tabMagicBtn].forEach(b => b.classList.remove('active'));
    this.passwordView.hide();
    this.otpView.hide();
    this.magicLinkView.hide();

    if (tab === 'password') {
      this.tabPasswordBtn.classList.add('active');
      this.passwordView.show();
    } else if (tab === 'otp') {
      this.tabOtpBtn.classList.add('active');
      this.otpView.show();
    } else if (tab === 'magic') {
      this.tabMagicBtn.classList.add('active');
      this.magicLinkView.show();
    }
  }

  private async performSilentBootstrap(wantsAdmin: boolean = false): Promise<void> {
    const refreshToken = localStorage.getItem(CONFIG.REFRESH_TOKEN_KEY);
    const storedUserJson = localStorage.getItem(CONFIG.USER_STORAGE_KEY);

    if (!refreshToken) {
      this.passwordView.show();
      return;
    }

    try {
      const auth = await authService.refreshSession(refreshToken);
      this.onAuthenticated(auth, wantsAdmin);
    } catch {
      if (storedUserJson) {
        try {
          const user: AuthUser = JSON.parse(storedUserJson);
          this.authenticatedUser = user;
          if (wantsAdmin && (user.role === 'admin' || user.role === 'super_admin')) {
            this.openAdminConsole();
          } else {
            this.workspaceView.render(user);
          }
          return;
        } catch {}
      }
      localStorage.clear();
      this.passwordView.show();
    }
  }

  private async onAuthenticated(auth: AuthResponseDto, wantsAdmin: boolean = false): Promise<void> {
    this.authenticatedUser = auth.user;
    localStorage.setItem(CONFIG.SESSION_STORAGE_KEY, auth.token);
    localStorage.setItem(CONFIG.REFRESH_TOKEN_KEY, auth.refreshToken);
    localStorage.setItem(CONFIG.SESSION_ID_KEY, auth.sessionId);
    localStorage.setItem(CONFIG.USER_STORAGE_KEY, JSON.stringify(auth.user));

    if (this.returnUrl) {
      try {
        this.alertBanner.show('Authorizing single sign-on redirect...', 'info');
        const sso = await authService.generateSsoTicket(auth.token, this.targetProjectKey, this.returnUrl);
        window.location.href = sso.targetUrl;
        return;
      } catch (err: any) {
        console.warn('Direct SSO ticket generation fallback:', err);
        const redirectUrl = new URL(this.returnUrl, window.location.origin);
        window.location.href = redirectUrl.toString();
        return;
      }
    }

    if (wantsAdmin && (auth.user.role === 'admin' || auth.user.role === 'super_admin')) {
      this.openAdminConsole();
    } else {
      this.workspaceView.render(auth.user);
    }
  }

  private setupGoogleOAuthFallback(): void {
    this.btnGoogleLogin.addEventListener('click', async () => {
      try {
        this.alertBanner.show('Connecting with Google...', 'info');
        const auth = await authService.loginWithGoogle(this.targetProjectKey, 'mock_google_id_token_2026');
        this.onAuthenticated(auth);
      } catch (err: any) {
        this.alertBanner.show(err.message || 'Google authentication failed.');
      }
    });

    setTimeout(() => {
      if (!window.google && !this.btnGoogleLogin.classList.contains('hidden')) {
        // Fallback for adblockers
      }
    }, 2000);
  }
}

// Bootstrap Application
document.addEventListener('DOMContentLoaded', () => {
  const app = new RithamicAuthApp();
  app.init().catch(err => {
    console.error('App initialization error:', err);
  });
});
