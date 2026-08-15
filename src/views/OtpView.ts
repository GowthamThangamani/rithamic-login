import { AuthResponseDto } from '../types/index.ts';
import { AlertBanner } from '../components/AlertBanner.ts';
import * as authService from '../services/authService.ts';

export class OtpView {
  private step1Container: HTMLElement;
  private step2Container: HTMLElement;
  private alertBanner: AlertBanner;
  private projectKey: string;
  private onAuthSuccess: (auth: AuthResponseDto) => void;

  private requestForm: HTMLFormElement;
  private emailInput: HTMLInputElement;
  private verifyForm: HTMLFormElement;
  private digitInputs: NodeListOf<HTMLInputElement>;
  private sentEmailDisplay: HTMLElement;
  private resendLink: HTMLAnchorElement;
  private btnChangeEmail: HTMLButtonElement;

  private currentEmail: string = '';
  private cooldownTimerId: number | null = null;
  private readonly COOLDOWN_STORAGE_KEY = 'rithamic_otp_cooldown_expiry';

  constructor(
    projectKey: string,
    alertBanner: AlertBanner,
    onAuthSuccess: (auth: AuthResponseDto) => void
  ) {
    this.projectKey = projectKey;
    this.alertBanner = alertBanner;
    this.onAuthSuccess = onAuthSuccess;

    this.step1Container = document.getElementById('otpStep1View') as HTMLElement;
    this.step2Container = document.getElementById('otpStep2View') as HTMLElement;

    this.requestForm = document.getElementById('otpRequestForm') as HTMLFormElement;
    this.emailInput = document.getElementById('otpEmailInput') as HTMLInputElement;
    this.verifyForm = document.getElementById('otpVerifyForm') as HTMLFormElement;
    this.digitInputs = document.querySelectorAll<HTMLInputElement>('.otp-digit');
    this.sentEmailDisplay = document.getElementById('sentEmailDisplay') as HTMLElement;
    this.resendLink = document.getElementById('resendOtpLink') as HTMLAnchorElement;
    this.btnChangeEmail = document.getElementById('btnChangeEmail') as HTMLButtonElement;

    this.bindEvents();
    this.checkExistingCooldown();
  }

  public show(): void {
    if (this.currentEmail) {
      this.step2Container.classList.remove('hidden');
      this.step1Container.classList.add('hidden');
      this.digitInputs[0].focus();
    } else {
      this.step1Container.classList.remove('hidden');
      this.step2Container.classList.add('hidden');
      this.emailInput.focus();
    }
  }

  public hide(): void {
    this.step1Container.classList.add('hidden');
    this.step2Container.classList.add('hidden');
  }

  private bindEvents(): void {
    // Step 1: Request OTP
    this.requestForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      this.alertBanner.clear();
      this.currentEmail = this.emailInput.value.trim();

      try {
        this.alertBanner.show('Dispatching passcode...', 'info');
        await authService.requestOtp(this.projectKey, this.currentEmail);
        this.alertBanner.clear();

        this.step1Container.classList.add('hidden');
        this.step2Container.classList.remove('hidden');
        this.sentEmailDisplay.textContent = this.currentEmail;
        this.startCooldown(60);
        this.digitInputs[0].focus();
      } catch (err: any) {
        this.alertBanner.show(err.message || 'Failed to send OTP passcode.');
      }
    });

    // Mobile Autofill & Multi-digit distribution handler
    this.digitInputs.forEach((input, idx) => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const val = target.value;

        // Handle Mobile OS SMS Autofill (injects multiple characters at once)
        if (val.length > 1) {
          const cleanDigits = val.replace(/\D/g, '').slice(0, 6);
          cleanDigits.split('').forEach((char, i) => {
            if (this.digitInputs[i]) {
              this.digitInputs[i].value = char;
            }
          });
          const focusIndex = Math.min(cleanDigits.length, 5);
          this.digitInputs[focusIndex].focus();
          return;
        }

        // Single digit regular typing auto-advance
        if (val && idx < this.digitInputs.length - 1) {
          this.digitInputs[idx + 1].focus();
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && idx > 0) {
          this.digitInputs[idx - 1].focus();
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = e.clipboardData?.getData('text').trim() || '';
        const digits = pasteData.replace(/\D/g, '').slice(0, 6);
        if (digits) {
          digits.split('').forEach((char, i) => {
            if (this.digitInputs[i]) this.digitInputs[i].value = char;
          });
          const focusIdx = Math.min(digits.length, 5);
          this.digitInputs[focusIdx].focus();
        }
      });
    });

    // Step 2: Verify OTP Submit
    this.verifyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      this.alertBanner.clear();

      const otp = Array.from(this.digitInputs).map(d => d.value).join('');
      if (otp.length !== 6) {
        this.alertBanner.show('Please enter all 6 digits of the verification code.');
        return;
      }

      try {
        this.alertBanner.show('Verifying passcode...', 'info');
        const auth = await authService.verifyOtp(this.projectKey, this.currentEmail, otp);
        sessionStorage.removeItem(this.COOLDOWN_STORAGE_KEY);
        this.onAuthSuccess(auth);
      } catch (err: any) {
        this.alertBanner.show(err.message || 'Invalid or expired verification passcode.');
      }
    });

    this.btnChangeEmail.addEventListener('click', () => {
      this.step2Container.classList.add('hidden');
      this.step1Container.classList.remove('hidden');
      this.emailInput.focus();
      this.alertBanner.clear();
    });

    this.resendLink.addEventListener('click', async () => {
      if (this.resendLink.classList.contains('disabled')) return;
      try {
        this.alertBanner.show('Resending passcode...', 'info');
        await authService.requestOtp(this.projectKey, this.currentEmail);
        this.alertBanner.show('A fresh verification code has been dispatched.', 'success');
        this.startCooldown(60);
      } catch (err: any) {
        this.alertBanner.show(err.message || 'Failed to resend code.');
      }
    });
  }

  private startCooldown(seconds: number): void {
    const expiry = Date.now() + seconds * 1000;
    sessionStorage.setItem(this.COOLDOWN_STORAGE_KEY, expiry.toString());
    this.runCooldownTick(expiry);
  }

  private checkExistingCooldown(): void {
    const expiryStr = sessionStorage.getItem(this.COOLDOWN_STORAGE_KEY);
    if (expiryStr) {
      const expiry = parseInt(expiryStr, 10);
      if (expiry > Date.now()) {
        this.runCooldownTick(expiry);
      }
    }
  }

  private runCooldownTick(expiryTimestamp: number): void {
    if (this.cooldownTimerId) clearInterval(this.cooldownTimerId);

    const update = () => {
      const remainingMs = expiryTimestamp - Date.now();
      const remainingSec = Math.ceil(remainingMs / 1000);

      if (remainingSec <= 0) {
        if (this.cooldownTimerId) clearInterval(this.cooldownTimerId);
        this.resendLink.classList.remove('disabled');
        this.resendLink.textContent = 'Resend code now';
        sessionStorage.removeItem(this.COOLDOWN_STORAGE_KEY);
      } else {
        this.resendLink.classList.add('disabled');
        this.resendLink.innerHTML = `Resend in <span id="cooldownTimer">${remainingSec}</span>s`;
      }
    };

    update();
    this.cooldownTimerId = window.setInterval(update, 1000);
  }
}
