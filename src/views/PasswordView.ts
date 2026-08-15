import { AuthResponseDto } from '../types/index.ts';
import { AlertBanner } from '../components/AlertBanner.ts';
import * as authService from '../services/authService.ts';

export class PasswordView {
  private container: HTMLElement;
  private forgotContainer: HTMLElement;
  private resetContainer: HTMLElement;
  private authTabs: HTMLElement;
  private alertBanner: AlertBanner;
  private projectKey: string;
  private onAuthSuccess: (auth: AuthResponseDto) => void;

  // Form Elements
  private loginForm: HTMLFormElement;
  private emailInput: HTMLInputElement;
  private passwordInput: HTMLInputElement;
  private btnTriggerForgot: HTMLAnchorElement;
  private forgotForm: HTMLFormElement;
  private forgotEmailInput: HTMLInputElement;
  private btnBackToLogin: HTMLAnchorElement;
  private resetForm: HTMLFormElement;
  private resetEmailInput: HTMLInputElement;
  private newPasswordInput: HTMLInputElement;
  private confirmPasswordInput: HTMLInputElement;

  constructor(
    projectKey: string,
    alertBanner: AlertBanner,
    onAuthSuccess: (auth: AuthResponseDto) => void
  ) {
    this.projectKey = projectKey;
    this.alertBanner = alertBanner;
    this.onAuthSuccess = onAuthSuccess;

    this.container = document.getElementById('passwordView') as HTMLElement;
    this.forgotContainer = document.getElementById('forgotPasswordView') as HTMLElement;
    this.resetContainer = document.getElementById('resetPasswordView') as HTMLElement;
    this.authTabs = document.getElementById('authTabs') as HTMLElement;

    this.loginForm = document.getElementById('passwordLoginForm') as HTMLFormElement;
    this.emailInput = document.getElementById('passwordEmailInput') as HTMLInputElement;
    this.passwordInput = document.getElementById('passwordInput') as HTMLInputElement;
    this.btnTriggerForgot = document.getElementById('btnTriggerForgot') as HTMLAnchorElement;

    this.forgotForm = document.getElementById('forgotPasswordForm') as HTMLFormElement;
    this.forgotEmailInput = document.getElementById('forgotEmailInput') as HTMLInputElement;
    this.btnBackToLogin = document.getElementById('btnBackToLogin') as HTMLAnchorElement;

    this.resetForm = document.getElementById('resetPasswordForm') as HTMLFormElement;
    this.resetEmailInput = document.getElementById('resetEmailInput') as HTMLInputElement;
    this.newPasswordInput = document.getElementById('newPasswordInput') as HTMLInputElement;
    this.confirmPasswordInput = document.getElementById('confirmPasswordInput') as HTMLInputElement;

    this.bindEvents();
  }

  public show(): void {
    this.container.classList.remove('hidden');
    this.forgotContainer.classList.add('hidden');
    this.resetContainer.classList.add('hidden');
    this.emailInput.focus();
  }

  public hide(): void {
    this.container.classList.add('hidden');
    this.forgotContainer.classList.add('hidden');
    this.resetContainer.classList.add('hidden');
  }

  public showResetFlow(email: string, token: string): void {
    this.authTabs.classList.add('hidden');
    this.container.classList.add('hidden');
    this.forgotContainer.classList.add('hidden');
    this.resetContainer.classList.remove('hidden');

    this.resetEmailInput.value = email;
    this.newPasswordInput.focus();

    this.resetForm.onsubmit = async (e) => {
      e.preventDefault();
      this.alertBanner.clear();

      const newPass = this.newPasswordInput.value;
      const confirmPass = this.confirmPasswordInput.value;

      if (newPass !== confirmPass) {
        this.alertBanner.show('Passwords do not match.', 'error');
        return;
      }

      try {
        this.alertBanner.show('Updating password...', 'info');
        await authService.resetPassword(this.projectKey, email, token, newPass);
        this.alertBanner.show('Password updated! Signing in...', 'success');
        const auth = await authService.loginWithPassword(this.projectKey, email, newPass);
        this.onAuthSuccess(auth);
      } catch (err: any) {
        this.alertBanner.show(err.message || 'Password reset failed.');
      }
    };
  }

  private bindEvents(): void {
    this.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      this.alertBanner.clear();

      const email = this.emailInput.value.trim();
      const pass = this.passwordInput.value;

      try {
        this.alertBanner.show('Signing in...', 'info');
        const auth = await authService.loginWithPassword(this.projectKey, email, pass);
        this.onAuthSuccess(auth);
      } catch (err: any) {
        this.alertBanner.show(err.message || 'Invalid email or password.');
      }
    });

    this.btnTriggerForgot.addEventListener('click', (e) => {
      e.preventDefault();
      this.alertBanner.clear();
      this.authTabs.classList.add('hidden');
      this.container.classList.add('hidden');
      this.forgotContainer.classList.remove('hidden');
      this.forgotEmailInput.value = this.emailInput.value;
      this.forgotEmailInput.focus();
    });

    this.btnBackToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      this.alertBanner.clear();
      this.authTabs.classList.remove('hidden');
      this.forgotContainer.classList.add('hidden');
      this.show();
    });

    this.forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      this.alertBanner.clear();
      const email = this.forgotEmailInput.value.trim();

      try {
        this.alertBanner.show('Dispatching recovery instructions...', 'info');
        await authService.forgotPassword(this.projectKey, email);
        this.alertBanner.show('If an account exists, a recovery link has been dispatched to your email.', 'success');
      } catch (err: any) {
        this.alertBanner.show(err.message || 'Failed to dispatch reset email.');
      }
    });
  }
}
