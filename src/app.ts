import { CONFIG } from './config/index.ts';
import { AuthResponseDto, AuthUser } from './types/index.ts';
import { AlertBanner } from './components/AlertBanner.ts';
import { DeviceDrawer } from './components/DeviceDrawer.ts';
import { PasswordView } from './views/PasswordView.ts';
import { OtpView } from './views/OtpView.ts';
import { MagicLinkView } from './views/MagicLinkView.ts';
import { WorkspaceView } from './views/WorkspaceView.ts';
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

  private targetProjectKey: string;
  private returnUrl: string | null;
  private resetToken: string | null;
  private resetEmail: string | null;
  private magicToken: string | null;

  // DOM Elements
  private tabPasswordBtn: HTMLButtonElement;
  private tabOtpBtn: HTMLButtonElement;
  private tabMagicBtn: HTMLButtonElement;
  private brandTitleEl: HTMLElement;
  private brandSubtitleEl: HTMLElement;
  private btnGoogleLogin: HTMLButtonElement;

  constructor() {
    this.alertBanner = new AlertBanner('alertBox');
    this.deviceDrawer = new DeviceDrawer();

    const params = new URLSearchParams(window.location.search);
    const rawProject = params.get('project') || CONFIG.DEFAULT_PROJECT_KEY;
    this.targetProjectKey = this.sanitizeProjectKey(rawProject);

    this.returnUrl = params.get('returnUrl') || params.get('relayState');
    this.resetToken = params.get('token') || params.get('resetToken');
    this.resetEmail = params.get('email');
    this.magicToken = params.get('magicToken');

    this.tabPasswordBtn = document.getElementById('tabPassword') as HTMLButtonElement;
    this.tabOtpBtn = document.getElementById('tabOtp') as HTMLButtonElement;
    this.tabMagicBtn = document.getElementById('tabMagic') as HTMLButtonElement;
    this.brandTitleEl = document.getElementById('brandTitle') as HTMLElement;
    this.brandSubtitleEl = document.getElementById('brandSubtitle') as HTMLElement;
    this.btnGoogleLogin = document.getElementById('btnGoogleLogin') as HTMLButtonElement;
  }

  public async init(): Promise<void> {
    this.setupBranding();
    this.initViews();
    this.setupTabs();
    this.setupGoogleOAuthFallback();

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
    await this.performSilentBootstrap();
  }

  private sanitizeProjectKey(raw: string): string {
    const clean = raw.trim().toLowerCase();
    // Validate project key naming convention
    if (/^[a-z0-9_]{3,40}$/.test(clean)) {
      return clean;
    }
    return CONFIG.DEFAULT_PROJECT_KEY;
  }

  private setupBranding(): void {
    if (this.targetProjectKey !== CONFIG.DEFAULT_PROJECT_KEY) {
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
    this.workspaceView = new WorkspaceView(this.alertBanner, this.deviceDrawer, this.returnUrl);
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

  private async performSilentBootstrap(): Promise<void> {
    const refreshToken = localStorage.getItem(CONFIG.REFRESH_TOKEN_KEY);
    const storedUserJson = localStorage.getItem(CONFIG.USER_STORAGE_KEY);

    if (!refreshToken) {
      this.passwordView.show();
      return;
    }

    try {
      // Attempt silent refresh to validate and rotate session token
      const auth = await authService.refreshSession(refreshToken);
      this.onAuthenticated(auth);
    } catch {
      // If silent refresh fails, check if we have offline user state or reset
      if (storedUserJson) {
        try {
          const user: AuthUser = JSON.parse(storedUserJson);
          this.workspaceView.render(user);
          return;
        } catch {}
      }
      localStorage.clear();
      this.passwordView.show();
    }
  }

  private onAuthenticated(auth: AuthResponseDto): void {
    localStorage.setItem(CONFIG.SESSION_STORAGE_KEY, auth.token);
    localStorage.setItem(CONFIG.REFRESH_TOKEN_KEY, auth.refreshToken);
    localStorage.setItem(CONFIG.SESSION_ID_KEY, auth.sessionId);
    localStorage.setItem(CONFIG.USER_STORAGE_KEY, JSON.stringify(auth.user));

    if (this.returnUrl) {
      window.location.href = this.returnUrl;
      return;
    }

    this.workspaceView.render(auth.user);
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

    // Check if Google SDK loaded without crashing UI
    setTimeout(() => {
      if (!window.google && !this.btnGoogleLogin.classList.contains('hidden')) {
        // External SDK blocked by AdBlocker / Network; keep fallback button active
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
