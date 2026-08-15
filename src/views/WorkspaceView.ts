import { AuthUser, WorkspaceApp } from '../types/index.ts';
import { AlertBanner } from '../components/AlertBanner.ts';
import { DeviceDrawer } from '../components/DeviceDrawer.ts';
import * as authService from '../services/authService.ts';
import { CONFIG } from '../config/index.ts';

export class WorkspaceView {
  private hubCard: HTMLElement;
  private authCard: HTMLElement;
  private userNameEl: HTMLElement;
  private userEmailEl: HTMLElement;
  private userAvatarEl: HTMLElement;
  private suitesContainer: HTMLElement;
  private btnLogout: HTMLButtonElement;
  private alertBanner: AlertBanner;
  private deviceDrawer: DeviceDrawer;
  private returnUrlParam: string | null;

  constructor(
    alertBanner: AlertBanner,
    deviceDrawer: DeviceDrawer,
    returnUrlParam: string | null
  ) {
    this.alertBanner = alertBanner;
    this.deviceDrawer = deviceDrawer;
    this.returnUrlParam = returnUrlParam;

    this.hubCard = document.getElementById('workspaceHubCard') as HTMLElement;
    this.authCard = document.getElementById('authCard') as HTMLElement;
    this.userNameEl = document.getElementById('userName') as HTMLElement;
    this.userEmailEl = document.getElementById('userEmail') as HTMLElement;
    this.userAvatarEl = document.getElementById('userAvatar') as HTMLElement;
    this.suitesContainer = document.getElementById('suitesContainer') as HTMLElement;
    this.btnLogout = document.getElementById('btnLogout') as HTMLButtonElement;

    this.bindEvents();
  }

  public render(user: AuthUser): void {
    this.authCard.classList.add('hidden');
    this.hubCard.classList.remove('hidden');

    this.userNameEl.textContent = user.fullName || user.email;
    this.userEmailEl.textContent = user.email;
    this.userAvatarEl.textContent = (user.fullName || user.email).charAt(0).toUpperCase();

    this.loadWorkspaces();
  }

  private async loadWorkspaces(): Promise<void> {
    const token = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
    if (!token) return;

    try {
      const apps: WorkspaceApp[] = await authService.fetchWorkspaces(token);
      this.suitesContainer.innerHTML = '';

      if (apps.length === 0) {
        this.suitesContainer.innerHTML = `<p style="color: var(--text-dim); font-size: 13px;">No authorized applications found for this account.</p>`;
        return;
      }

      apps.forEach(app => {
        const card = document.createElement('div');
        card.className = 'workspace-card';
        card.innerHTML = `
          <div class="workspace-card-info">
            <div class="workspace-icon">⚡</div>
            <div>
              <h4 style="font-size: 15px; font-weight: 600; color: var(--text-primary);">${app.projectName}</h4>
              <p style="font-size: 12px; color: var(--text-muted);">${app.projectKey}</p>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="workspace-role-badge">${app.role}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--primary-color);">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </div>
        `;

        card.addEventListener('click', async () => {
          try {
            this.alertBanner.show(`Generating Single Sign-On ticket for ${app.projectName}...`, 'info');
            const sso = await authService.generateSsoTicket(token, app.projectKey, this.returnUrlParam);
            window.location.href = sso.targetUrl;
          } catch (err: any) {
            this.alertBanner.show(err.message || 'Failed to cross-launch target application.');
          }
        });

        this.suitesContainer.appendChild(card);
      });
    } catch (err: any) {
      this.suitesContainer.innerHTML = `<p style="color: var(--danger); font-size: 13px;">${err.message}</p>`;
    }
  }

  private bindEvents(): void {
    this.deviceDrawer.attachTrigger('btnOpenSessions');

    this.btnLogout.addEventListener('click', async () => {
      const refresh = localStorage.getItem(CONFIG.REFRESH_TOKEN_KEY);
      const token = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
      await authService.logoutSession(refresh, token);
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    });
  }
}
