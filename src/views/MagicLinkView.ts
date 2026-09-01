import { AuthResponseDto } from '../types/index.ts';
import { AlertBanner } from '../components/AlertBanner.ts';
import * as authService from '../services/authService.ts';

export class MagicLinkView {
  private container: HTMLElement;
  private form: HTMLFormElement;
  private emailInput: HTMLInputElement;
  private submitBtn: HTMLButtonElement;
  private alertBanner: AlertBanner;
  private projectKey: string;
  private onAuthSuccess: (auth: AuthResponseDto) => void;

  constructor(
    projectKey: string,
    alertBanner: AlertBanner,
    onAuthSuccess: (auth: AuthResponseDto) => void
  ) {
    this.projectKey = projectKey;
    this.alertBanner = alertBanner;
    this.onAuthSuccess = onAuthSuccess;

    this.container = document.getElementById('magicLinkView') as HTMLElement;
    this.form = document.getElementById('magicLinkForm') as HTMLFormElement;
    this.emailInput = document.getElementById('magicEmailInput') as HTMLInputElement;
    this.submitBtn = document.getElementById('btnSendMagicLink') as HTMLButtonElement;

    this.bindEvents();
  }

  public show(): void {
    this.container.classList.remove('hidden');
    this.emailInput.focus();
  }

  public hide(): void {
    this.container.classList.add('hidden');
  }

  public async verifyToken(token: string): Promise<void> {
    try {
      this.alertBanner.show('Validating magic sign-in link...', 'info');
      const auth = await authService.verifyMagicLink(this.projectKey, token);
      this.onAuthSuccess(auth);
    } catch (err: any) {
      this.alertBanner.show(err.message || 'Magic link is invalid or has expired.', 'error');
    }
  }

  private setButtonLoading(btn: HTMLButtonElement | null, isLoading: boolean, text: string): void {
    if (!btn) return;
    btn.disabled = isLoading;
    if (isLoading) {
      btn.innerHTML = `<span class="btn-spinner"></span><span>${text}</span>`;
    } else {
      btn.innerHTML = `<span>${text}</span>`;
    }
  }

  private bindEvents(): void {
    this.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      this.alertBanner.clear();
      const email = this.emailInput.value.trim();

      if (!email) {
        this.alertBanner.show('Please enter your email address.', 'error');
        return;
      }

      this.setButtonLoading(this.submitBtn, true, 'Sending Link...');

      try {
        await authService.requestMagicLink(this.projectKey, email);
        this.alertBanner.show('Magic sign-in link sent! Please check your email inbox.', 'success');
      } catch (err: any) {
        this.alertBanner.show(err.message || 'Failed to dispatch magic link.', 'error');
      } finally {
        this.setButtonLoading(this.submitBtn, false, 'Send Magic Sign-In Link');
      }
    });
  }
}
