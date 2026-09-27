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
import { router, RouteState } from './services/routerService.ts';
import { inactivityService } from './services/inactivityService.ts';

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

  // DOM Elements
  private appContainerEl: HTMLElement;
  private authCardEl: HTMLElement;
  private adminConsoleContainerEl: HTMLElement;
  private brandSuiteBadgeEl: HTMLElement;
  private brandTitleEl: HTMLElement;
  private brandSubtitleEl: HTMLElement;
  private authTabsEl: HTMLElement;
  private tabPasswordBtn: HTMLButtonElement;
  private tabOtpBtn: HTMLButtonElement;
  private tabMagicBtn: HTMLButtonElement;
  private btnGoogleLogin: HTMLButtonElement;

  private authenticatedUser: AuthUser | null = null;
  private targetProjectKey: string = CONFIG.DEFAULT_PROJECT_KEY;

  constructor() {
    this.alertBanner = new AlertBanner('alertBox');
    this.deviceDrawer = new DeviceDrawer();

    this.appContainerEl = document.getElementById('appContainer') as HTMLElement;
    this.authCardEl = document.getElementById('authCard') as HTMLElement;
    this.adminConsoleContainerEl = document.getElementById('adminConsoleContainer') as HTMLElement;
    this.brandSuiteBadgeEl = document.getElementById('brandSuiteBadge') as HTMLElement;
    this.brandTitleEl = document.getElementById('brandTitle') as HTMLElement;
    this.brandSubtitleEl = document.getElementById('brandSubtitle') as HTMLElement;
    this.authTabsEl = document.getElementById('authTabs') as HTMLElement;
    this.tabPasswordBtn = document.getElementById('tabPassword') as HTMLButtonElement;
    this.tabOtpBtn = document.getElementById('tabOtp') as HTMLButtonElement;
    this.tabMagicBtn = document.getElementById('tabMagic') as HTMLButtonElement;
    this.btnGoogleLogin = document.getElementById('btnGoogleLogin') as HTMLButtonElement;
  }

  public async init(): Promise<void> {
    const initialState = router.getRouteState();
    this.targetProjectKey = initialState.project;

    // Check for prior inactivity logout notice
    const inactivityNotice = sessionStorage.getItem('inactivity_logout_notice');
    if (inactivityNotice) {
      sessionStorage.removeItem('inactivity_logout_notice');
      this.alertBanner.show(inactivityNotice, 'error');
    }

    // Initialize 1-minute inactivity guard
    inactivityService.init();

    await this.setupDynamicBranding();
    this.initViews();
    this.setupTabs();
    this.setupGoogleOAuthFallback();

    // Subscribe to URL & browser navigation state changes
    router.subscribe((state) => {
      this.applyRouteState(state);
    });

    // Handle silent authentication bootstrap or direct route rendering
    await this.bootstrap(initialState);
  }

  private async bootstrap(initialState: RouteState): Promise<void> {
    // 1. Password reset flow with token in URL
    if (initialState.resetToken && initialState.resetEmail) {
      this.passwordView.showResetFlow(initialState.resetEmail, initialState.resetToken);
      return;
    }

    // 2. Magic link verification flow with token in URL
    if (initialState.magicToken) {
      await this.magicLinkView.verifyToken(initialState.magicToken);
      return;
    }

    // 3. Silent Token Bootstrap Cycle
    const refreshToken = localStorage.getItem(CONFIG.REFRESH_TOKEN_KEY);
    const storedUserJson = localStorage.getItem(CONFIG.USER_STORAGE_KEY);

    if (refreshToken) {
      try {
        const auth = await authService.refreshSession(refreshToken);
        this.authenticatedUser = auth.user;
        localStorage.setItem(CONFIG.SESSION_STORAGE_KEY, auth.token);
        localStorage.setItem(CONFIG.REFRESH_TOKEN_KEY, auth.refreshToken);
        localStorage.setItem(CONFIG.SESSION_ID_KEY, auth.sessionId);
        localStorage.setItem(CONFIG.USER_STORAGE_KEY, JSON.stringify(auth.user));
      } catch {
        if (storedUserJson) {
          try {
            this.authenticatedUser = JSON.parse(storedUserJson);
          } catch {}
        }
      }
    }

    // If user is already authenticated and on the root/default auth page without specific query params,
    // route to workspaces or admin
    if (this.authenticatedUser && initialState.view === 'auth' && !initialState.returnUrl) {
      const isAdmin = this.authenticatedUser.role === 'admin' || this.authenticatedUser.role === 'super_admin';
      if (isAdmin && (initialState.project === CONFIG.DEFAULT_PROJECT_KEY || initialState.project === 'rithamic_login')) {
        router.navigate({ view: 'admin', adminTab: 'projects' }, true);
        return;
      } else {
        router.navigate({ view: 'workspaces' }, true);
        return;
      }
    }

    // Apply the active route state
    this.applyRouteState(initialState);
  }

  private applyRouteState(state: RouteState): void {
    this.alertBanner.clear();

    if (state.view === 'admin') {
      if (!this.authenticatedUser) {
        // Not logged in -> show login view
        this.showAuthView(state);
        return;
      }

      const isAdmin = this.authenticatedUser.role === 'admin' || this.authenticatedUser.role === 'super_admin';
      if (!isAdmin) {
        // Not an admin -> fallback to workspace hub
        router.navigate({ view: 'workspaces' }, true);
        return;
      }

      this.appContainerEl.classList.add('hidden');
      this.adminConsoleContainerEl.classList.remove('hidden');
      this.adminConsoleView.render(this.authenticatedUser, state.adminTab);
      return;
    }

    if (state.view === 'workspaces') {
      if (!this.authenticatedUser) {
        this.showAuthView(state);
        return;
      }

      this.adminConsoleContainerEl.classList.add('hidden');
      this.appContainerEl.classList.remove('hidden');
      this.workspaceView.render(this.authenticatedUser);
      return;
    }

    // Default 'auth' view
    this.showAuthView(state);
  }

  private showAuthView(state: RouteState): void {
    this.adminConsoleContainerEl.classList.add('hidden');
    this.appContainerEl.classList.remove('hidden');
    this.workspaceView.hide();
    this.authCardEl.classList.remove('hidden');

    // Reset tabs active status
    [this.tabPasswordBtn, this.tabOtpBtn, this.tabMagicBtn].forEach(b => b.classList.remove('active'));
    this.passwordView.hide();
    this.otpView.hide();
    this.magicLinkView.hide();

    if (state.resetToken && state.resetEmail) {
      this.passwordView.showResetFlow(state.resetEmail, state.resetToken);
      return;
    }

    if (state.authTab === 'forgot') {
      this.passwordView.showForgot();
      return;
    }

    this.authTabsEl.classList.remove('hidden');

    if (state.authTab === 'otp') {
      this.tabOtpBtn.classList.add('active');
      this.otpView.show();
    } else if (state.authTab === 'magic') {
      this.tabMagicBtn.classList.add('active');
      this.magicLinkView.show();
    } else {
      this.tabPasswordBtn.classList.add('active');
      this.passwordView.show();
    }
  }

  private setupTabs(): void {
    this.tabPasswordBtn.addEventListener('click', () => {
      router.navigate({ view: 'auth', authTab: 'password' });
    });
    this.tabOtpBtn.addEventListener('click', () => {
      router.navigate({ view: 'auth', authTab: 'otp' });
    });
    this.tabMagicBtn.addEventListener('click', () => {
      router.navigate({ view: 'auth', authTab: 'magic' });
    });
  }

  private initViews(): void {
    const handleAuthSuccess = (auth: AuthResponseDto) => this.onAuthenticated(auth);

    this.passwordView = new PasswordView(this.targetProjectKey, this.alertBanner, handleAuthSuccess);
    this.otpView = new OtpView(this.targetProjectKey, this.alertBanner, handleAuthSuccess);
    this.magicLinkView = new MagicLinkView(this.targetProjectKey, this.alertBanner, handleAuthSuccess);
    this.workspaceView = new WorkspaceView(
      this.alertBanner,
      this.deviceDrawer,
      router.getRouteState().returnUrl,
      () => router.navigate({ view: 'admin', adminTab: 'projects' })
    );
    this.adminConsoleView = new AdminConsoleView(
      this.adminConsoleContainerEl,
      () => router.navigate({ view: 'workspaces' })
    );
  }

  private async onAuthenticated(auth: AuthResponseDto): Promise<void> {
    this.authenticatedUser = auth.user;
    localStorage.setItem(CONFIG.SESSION_STORAGE_KEY, auth.token);
    localStorage.setItem(CONFIG.REFRESH_TOKEN_KEY, auth.refreshToken);
    localStorage.setItem(CONFIG.SESSION_ID_KEY, auth.sessionId);
    localStorage.setItem(CONFIG.USER_STORAGE_KEY, JSON.stringify(auth.user));
    inactivityService.recordActivity();

    const currentState = router.getRouteState();

    if (currentState.returnUrl) {
      try {
        this.alertBanner.show('Authentication verified! Generating single sign-on redirect...', 'info');
        const sso = await authService.generateSsoTicket(auth.token, this.targetProjectKey, currentState.returnUrl);
        this.alertBanner.show('Redirecting...', 'success');
        window.location.href = sso.targetUrl;
        return;
      } catch (err: any) {
        console.warn('SSO ticket fallback redirect:', err);
        const redirectUrl = new URL(currentState.returnUrl, window.location.origin);
        window.location.href = redirectUrl.toString();
        return;
      }
    }

    const isAdmin = auth.user.role === 'admin' || auth.user.role === 'super_admin';
    const isCoreAppLogin = (this.targetProjectKey === CONFIG.DEFAULT_PROJECT_KEY || this.targetProjectKey === 'rithamic_login');

    if (isAdmin && (currentState.view === 'admin' || isCoreAppLogin)) {
      router.navigate({ view: 'admin', adminTab: 'projects' });
    } else {
      router.navigate({ view: 'workspaces' });
    }
  }

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
      const formatted = this.targetProjectKey
        .replace(/^rithamic_/, '')
        .replace(/_/g, ' ')
        .toUpperCase();
      this.brandTitleEl.textContent = `Sign in to ${formatted}`;
      this.brandSubtitleEl.textContent = `Centralized SSO Access for ${this.targetProjectKey}`;
    }
  }

  private setupGoogleOAuthFallback(): void {
    this.btnGoogleLogin.addEventListener('click', async () => {
      try {
        this.alertBanner.show('Connecting with Google...', 'info');
        const auth = await authService.loginWithGoogle(this.targetProjectKey, 'mock_google_id_token_2026');
        this.onAuthenticated(auth);
      } catch (err: any) {
        this.alertBanner.show(err.message || 'Google authentication failed.', 'error');
      }
    });
  }
}

// Bootstrap Application
document.addEventListener('DOMContentLoaded', () => {
  const app = new RithamicAuthApp();
  app.init().catch(err => {
    console.error('App initialization error:', err);
  });
});
