import { AuthResponseDto } from '../types/index.ts';
import { AlertBanner } from '../components/AlertBanner.ts';
import * as authService from '../services/authService.ts';

export class MagicLinkView {
  private container: HTMLElement;
  private form: HTMLFormElement;
  private emailInput: HTMLInputElement;
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
      this.alertBanner.show('Validating magic link token...', 'info');
      const auth = await authService.verifyMagicLink(this.projectKey, token);
      this.onAuthSuccess(auth);
    } catch (err: any) {
      this.alertBanner.show(err.message || 'Magic link is invalid or has expired.');
    }
  }

  private bindEvents(): void {
    this.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      this.alertBanner.clear();
      const email = this.emailInput.value.trim();

      try {
        this.alertBanner.show('Dispatching magic sign-in link...', 'info');
        await authService.requestMagicLink(this.projectKey, email);
        this.alertBanner.show('Magic link sent! Check your email inbox.', 'success');
      } catch (err: any) {
        this.alertBanner.show(err.message || 'Failed to dispatch magic link.');
      }
    });
  }
}
