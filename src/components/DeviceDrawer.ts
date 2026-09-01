import { SessionItemDto } from '../types/index.ts';
import * as authService from '../services/authService.ts';
import { CONFIG } from '../config/index.ts';

export class DeviceDrawer {
  private modal: HTMLElement | null;
  private listEl: HTMLElement | null;
  private btnClose: HTMLButtonElement | null;
  private btnCloseModal: HTMLButtonElement | null;
  private btnRevokeAll: HTMLButtonElement | null;
  private triggerBtn: HTMLButtonElement | null = null;
  private previouslyFocusedElement: HTMLElement | null = null;

  constructor() {
    this.modal = document.getElementById('sessionsModal');
    this.listEl = document.getElementById('sessionsList');
    this.btnClose = document.getElementById('btnCloseSessions') as HTMLButtonElement | null;
    this.btnCloseModal = document.getElementById('btnCloseSessionsModal') as HTMLButtonElement | null;
    this.btnRevokeAll = document.getElementById('btnRevokeAllSessions') as HTMLButtonElement | null;

    this.bindEvents();
  }

  public attachTrigger(btnId: string = 'btnOpenSessions'): void {
    this.triggerBtn = document.getElementById(btnId) as HTMLButtonElement | null;
    if (this.triggerBtn) {
      this.triggerBtn.addEventListener('click', () => this.open());
    }
  }

  public async open(): Promise<void> {
    if (!this.modal) return;
    this.previouslyFocusedElement = document.activeElement as HTMLElement;
    this.modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Focus close button initially
    if (this.btnClose) {
      this.btnClose.focus();
    }
    await this.loadSessions();
  }

  public close(): void {
    if (!this.modal) return;
    this.modal.classList.add('hidden');
    document.body.style.overflow = '';
    if (this.previouslyFocusedElement) {
      this.previouslyFocusedElement.focus();
    }
  }

  private bindEvents(): void {
    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => this.close());
    }
    if (this.btnCloseModal) {
      this.btnCloseModal.addEventListener('click', () => this.close());
    }

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.close();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (this.modal && !this.modal.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.close();
        } else if (e.key === 'Tab') {
          this.handleKeyboardTrap(e);
        }
      }
    });

    if (this.btnRevokeAll) {
      this.btnRevokeAll.addEventListener('click', async () => {
        const token = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
        if (!token) return;

        if (confirm('Are you sure you want to terminate all other device logins?')) {
          try {
            await authService.revokeAllSessions(token);
            await this.loadSessions();
          } catch (err: any) {
            alert(err.message || 'Failed to revoke sessions.');
          }
        }
      });
    }
  }

  private handleKeyboardTrap(e: KeyboardEvent): void {
    if (!this.modal) return;
    const focusable = this.modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        last.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  }

  public async loadSessions(): Promise<void> {
    if (!this.listEl) return;
    const token = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
    if (!token) return;

    this.listEl.innerHTML = `<div class="loading-spinner"></div>`;

    try {
      const sessions: SessionItemDto[] = await authService.getActiveSessions(token);
      this.listEl.innerHTML = '';

      if (sessions.length === 0) {
        this.listEl.innerHTML = `<p style="color: var(--text-dim); font-size: 13px;">No active sessions found.</p>`;
        return;
      }

      sessions.forEach(sess => {
        const item = document.createElement('div');
        item.className = `session-item ${sess.isCurrentSession ? 'current' : ''}`;
        item.innerHTML = `
          <div>
            <div style="font-size: 14px; font-weight: 600; color: var(--text-primary);">
              ${sess.userAgent || 'Web Browser'} ${sess.isCurrentSession ? '<span style="color: var(--primary-color); font-size: 11px;">(Current)</span>' : ''}
            </div>
            <div style="font-size: 12px; color: var(--text-muted);">
              IP: ${sess.ipAddress || 'Unknown'} • Active: ${new Date(sess.lastActiveAt).toLocaleString()}
            </div>
          </div>
          ${!sess.isCurrentSession ? `
            <button type="button" class="btn btn-danger-outline btn-revoke" data-session="${sess.sessionId}" style="width: auto; padding: 4px 10px; margin: 0;">
              Revoke
            </button>
          ` : ''}
        `;

        const btnRevoke = item.querySelector('.btn-revoke') as HTMLButtonElement;
        if (btnRevoke) {
          btnRevoke.addEventListener('click', async () => {
            try {
              await authService.revokeSession(token, sess.sessionId);
              await this.loadSessions();
            } catch (err: any) {
              alert(err.message || 'Failed to revoke session.');
            }
          });
        }

        this.listEl?.appendChild(item);
      });
    } catch (err: any) {
      if (this.listEl) {
        this.listEl.innerHTML = `<p style="color: var(--danger); font-size: 13px;">${err.message}</p>`;
      }
    }
  }
}
