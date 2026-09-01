import { AuthUser, WorkspaceApp } from '../types/index.ts';
import { AlertBanner } from '../components/AlertBanner.ts';
import { DeviceDrawer } from '../components/DeviceDrawer.ts';
import * as authService from '../services/authService.ts';
import { CONFIG } from '../config/index.ts';
import { router } from '../services/routerService.ts';

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
  private onOpenAdminConsole?: () => void;

  constructor(
    alertBanner: AlertBanner,
    deviceDrawer: DeviceDrawer,
    returnUrlParam: string | null,
    onOpenAdminConsole?: () => void
  ) {
    this.alertBanner = alertBanner;
    this.deviceDrawer = deviceDrawer;
    this.returnUrlParam = returnUrlParam;
    this.onOpenAdminConsole = onOpenAdminConsole;

    this.hubCard = document.getElementById('workspaceHubCard') as HTMLElement;
    this.authCard = document.getElementById('authCard') as HTMLElement;
    this.userNameEl = document.getElementById('userName') as HTMLElement;
    this.userEmailEl = document.getElementById('userEmail') as HTMLElement;
    this.userAvatarEl = document.getElementById('userAvatar') as HTMLElement;
    this.suitesContainer = document.getElementById('suitesContainer') as HTMLElement;
    this.btnLogout = document.getElementById('btnLogout') as HTMLButtonElement;

    this.bindEvents();
  }

  public show(): void {
    this.authCard.classList.add('hidden');
    this.hubCard.classList.remove('hidden');
  }

  public hide(): void {
    this.hubCard.classList.add('hidden');
  }

  public render(user: AuthUser): void {
    this.show();

    this.userNameEl.textContent = user.fullName || user.email;
    this.userEmailEl.textContent = user.email;
    this.userAvatarEl.textContent = (user.fullName || user.email).charAt(0).toUpperCase();

    // Render Admin Console Entry Banner if Admin or Super Admin
    const existingAdminBtn = document.getElementById('btnOpenAdminConsole');
    if (existingAdminBtn) existingAdminBtn.remove();

    if ((user.role === 'admin' || user.role === 'super_admin') && this.onOpenAdminConsole) {
      const adminEntry = document.createElement('div');
      adminEntry.id = 'btnOpenAdminConsole';
      adminEntry.className = 'admin-entry-card';
      adminEntry.innerHTML = `
        <div class="workspace-card-info">
          <div class="workspace-icon" style="background: rgba(99, 102, 241, 0.2); color: #818cf8;">👑</div>
          <div>
            <h4 style="font-size: 15px; font-weight: 600; color: #a5b4fc;">Rithamic Developer & Admin Console</h4>
            <p style="font-size: 12px; color: var(--text-muted);">Manage Client Projects, API Keys & Ecosystem Telemetry</p>
          </div>
        </div>
        <button type="button" class="btn-primary-sm" id="btnLaunchAdminConsole" style="padding: 6px 14px; font-size: 12px; cursor: pointer;">
          Open Console →
        </button>
      `;
      
      adminEntry.addEventListener('click', () => {
        router.navigate({ view: 'admin', adminTab: 'projects' });
      });
      
      this.hubCard.insertBefore(adminEntry, this.suitesContainer);
    }

    this.loadWorkspaces();
  }

  private async loadWorkspaces(): Promise<void> {
    const token = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
    if (!token) return;

    this.suitesContainer.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-muted);">
        <span class="btn-spinner" style="display: inline-block; margin-bottom: 8px;"></span>
        <p style="font-size: 13px;">Loading authorized workspaces...</p>
      </div>
    `;

    try {
      const apps: WorkspaceApp[] = await authService.fetchWorkspaces(token);
      this.suitesContainer.innerHTML = '';

      if (apps.length === 0) {
        this.suitesContainer.innerHTML = `
          <div style="padding: 24px; text-align: center; color: var(--text-dim);">
            <div style="font-size: 28px; margin-bottom: 8px;">🏢</div>
            <p style="font-size: 14px; font-weight: 500; color: var(--text-muted);">No authorized applications assigned yet.</p>
            <p style="font-size: 12px; margin-top: 4px;">Contact your Rithamic administrator for application access.</p>
          </div>
        `;
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
            card.style.opacity = '0.6';
            card.style.pointerEvents = 'none';

            const sso = await authService.generateSsoTicket(token, app.projectKey, this.returnUrlParam);
            this.alertBanner.show(`Redirecting to ${app.projectName}...`, 'success');
            window.location.href = sso.targetUrl;
          } catch (err: any) {
            card.style.opacity = '1';
            card.style.pointerEvents = 'auto';
            this.alertBanner.show(err.message || 'Failed to cross-launch target application.', 'error');
          }
        });

        this.suitesContainer.appendChild(card);
      });
    } catch (err: any) {
      this.suitesContainer.innerHTML = `
        <div style="padding: 16px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; color: #fca5a5; font-size: 13px;">
          Failed to load workspaces: ${err.message}
        </div>
      `;
    }
  }

  private bindEvents(): void {
    this.deviceDrawer.attachTrigger('btnOpenSessions');

    this.btnLogout.addEventListener('click', async () => {
      this.btnLogout.disabled = true;
      this.btnLogout.textContent = 'Logging out...';
      const refresh = localStorage.getItem(CONFIG.REFRESH_TOKEN_KEY);
      const token = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
      await authService.logoutSession(refresh, token);
      localStorage.clear();
      sessionStorage.clear();
      router.navigate({ view: 'auth', authTab: 'password' }, true);
      window.location.reload();
    });
  }
}
