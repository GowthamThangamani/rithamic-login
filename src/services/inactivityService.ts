import { CONFIG } from '../config/index.ts';
import * as authService from '../services/authService.ts';
import { router } from '../services/routerService.ts';
import { trackEvent } from './telemetryService.ts';

export class InactivityService {
  private static instance: InactivityService | null = null;
  private readonly INACTIVITY_LIMIT_MS: number = 60 * 1000; // 1 minute (60,000 ms)
  private readonly WARNING_THRESHOLD_MS: number = 15 * 1000; // 15 seconds warning modal
  private readonly CHECK_INTERVAL_MS: number = 1000; // Heartbeat check every 1s

  private lastActivityTimestamp: number = Date.now();
  private checkIntervalTimer: number | null = null;
  private isWarningModalShown: boolean = false;
  private isLoggingOut: boolean = false;

  // Modal DOM elements
  private modalEl: HTMLElement | null = null;
  private countdownEl: HTMLElement | null = null;
  private btnStayLoggedIn: HTMLButtonElement | null = null;
  private btnLogoutNow: HTMLButtonElement | null = null;

  // Track event listeners to allow clean detachment
  private boundOnUserActivity: () => void;

  private constructor() {
    this.boundOnUserActivity = () => this.recordActivity();
  }

  public static getInstance(): InactivityService {
    if (!InactivityService.instance) {
      InactivityService.instance = new InactivityService();
    }
    return InactivityService.instance;
  }

  /**
   * Initializes inactivity tracking and sets up event listeners.
   */
  public init(): void {
    this.createWarningModal();
    this.bindActivityListeners();
    this.startHeartbeat();
  }

  /**
   * Resets activity timestamp whenever user interacts with the page.
   */
  public recordActivity(): void {
    this.lastActivityTimestamp = Date.now();

    // If warning modal is open, user interaction can dismiss it and reset
    if (this.isWarningModalShown) {
      this.hideWarningModal();
    }
  }

  /**
   * Returns whether a user session currently exists in storage.
   */
  private hasActiveSession(): boolean {
    const token = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
    const userJson = localStorage.getItem(CONFIG.USER_STORAGE_KEY);
    return Boolean(token || userJson);
  }

  private bindActivityListeners(): void {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(eventName => {
      window.addEventListener(eventName, this.boundOnUserActivity, { passive: true });
    });

    // Also handle visibility changes (e.g., user returns to tab)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.recordActivity();
      }
    });
  }

  private startHeartbeat(): void {
    if (this.checkIntervalTimer !== null) {
      window.clearInterval(this.checkIntervalTimer);
    }

    this.checkIntervalTimer = window.setInterval(() => {
      this.checkInactivity();
    }, this.CHECK_INTERVAL_MS);
  }

  private checkInactivity(): void {
    // Only check and trigger autologout if a user is currently authenticated
    if (!this.hasActiveSession() || this.isLoggingOut) {
      if (this.isWarningModalShown) {
        this.hideWarningModal();
      }
      return;
    }

    const elapsed = Date.now() - this.lastActivityTimestamp;
    const remainingMs = this.INACTIVITY_LIMIT_MS - elapsed;

    if (remainingMs <= 0) {
      this.triggerAutoLogout();
    } else if (remainingMs <= this.WARNING_THRESHOLD_MS) {
      const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
      this.showWarningModal(remainingSeconds);
    } else {
      if (this.isWarningModalShown) {
        this.hideWarningModal();
      }
    }
  }

  private createWarningModal(): void {
    if (document.getElementById('inactivityModal')) {
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'inactivityModal';
    modal.className = 'modal-overlay hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'inactivityTitle');
    modal.innerHTML = `
      <div class="modal-card inactivity-modal-card">
        <div class="modal-header" style="margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="inactivity-icon-badge">⏱️</div>
            <div>
              <h3 id="inactivityTitle" style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0;">Session Timeout Warning</h3>
              <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Inactivity security safeguard</p>
            </div>
          </div>
        </div>
        <div class="modal-body" style="padding: 6px 0 16px 0;">
          <p style="font-size: 14px; color: var(--text-primary); line-height: 1.5; margin-bottom: 14px;">
            You have been inactive. For your security, your session will automatically log out in:
          </p>
          <div class="inactivity-timer-box">
            <span id="inactivityCountdown" class="inactivity-countdown-number">15</span>
            <span class="inactivity-countdown-label">seconds</span>
          </div>
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px; padding-top: 14px; border-top: 1px solid var(--border-color); margin-top: 0;">
          <button type="button" class="btn btn-secondary" id="btnInactivityLogoutNow" style="width: auto; margin: 0; padding: 8px 16px; font-size: 13px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">
            Log Out Now
          </button>
          <button type="button" class="btn btn-primary" id="btnStayLoggedIn" style="width: auto; margin: 0; padding: 8px 18px; font-size: 13px;">
            Stay Logged In
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    this.modalEl = modal;
    this.countdownEl = document.getElementById('inactivityCountdown');
    this.btnStayLoggedIn = document.getElementById('btnStayLoggedIn') as HTMLButtonElement | null;
    this.btnLogoutNow = document.getElementById('btnInactivityLogoutNow') as HTMLButtonElement | null;

    if (this.btnStayLoggedIn) {
      this.btnStayLoggedIn.addEventListener('click', () => {
        this.recordActivity();
      });
    }

    if (this.btnLogoutNow) {
      this.btnLogoutNow.addEventListener('click', () => {
        this.triggerAutoLogout();
      });
    }
  }

  private showWarningModal(remainingSeconds: number): void {
    if (!this.modalEl) return;
    this.isWarningModalShown = true;
    this.modalEl.classList.remove('hidden');

    if (this.countdownEl) {
      this.countdownEl.textContent = remainingSeconds.toString();
    }
  }

  private hideWarningModal(): void {
    if (!this.modalEl) return;
    this.isWarningModalShown = false;
    this.modalEl.classList.add('hidden');
  }

  /**
   * Executes logout due to 1 minute inactivity timeout.
   */
  public async triggerAutoLogout(): Promise<void> {
    if (this.isLoggingOut) return;
    this.isLoggingOut = true;
    this.hideWarningModal();

    trackEvent('auth', 'auto_logout_inactivity', {
      timeoutSeconds: 60,
      timestamp: new Date().toISOString()
    });

    const refreshToken = localStorage.getItem(CONFIG.REFRESH_TOKEN_KEY);
    const token = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);

    try {
      if (refreshToken || token) {
        await authService.logoutSession(refreshToken, token);
      }
    } catch {
      // Ignore network errors during silent logout
    }

    // Clear client authentication storage
    localStorage.removeItem(CONFIG.SESSION_STORAGE_KEY);
    localStorage.removeItem(CONFIG.REFRESH_TOKEN_KEY);
    localStorage.removeItem(CONFIG.SESSION_ID_KEY);
    localStorage.removeItem(CONFIG.USER_STORAGE_KEY);

    // Set an alert flag for the login screen to notify the user
    sessionStorage.setItem('inactivity_logout_notice', 'You have been logged out due to 1 minute of inactivity.');

    // Route to login screen
    router.navigate({ view: 'auth', authTab: 'password' }, true);
    window.location.reload();
  }
}

export const inactivityService = InactivityService.getInstance();
