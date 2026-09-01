import { projectService } from '../services/projectService.ts';
import { AuthUser, ClientProjectDto } from '../types/index.ts';
import { router } from '../services/routerService.ts';

export class AdminConsoleView {
  private container: HTMLElement;
  private currentUser: AuthUser | null = null;
  private projects: ClientProjectDto[] = [];
  private activeProjectKey: string = 'rithamic_familytree';
  private currentTab: 'projects' | 'apikeys' | 'comms' = 'projects';
  private onNavigateBack: () => void;

  constructor(container: HTMLElement, onNavigateBack: () => void) {
    this.container = container;
    this.onNavigateBack = onNavigateBack;
  }

  async render(user: AuthUser, initialTab?: 'projects' | 'apikeys' | 'comms'): Promise<void> {
    this.currentUser = user;
    
    // Read from URL if available
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('tab') as 'projects' | 'apikeys' | 'comms';
    const urlKey = params.get('activeKey');

    if (urlTab && ['projects', 'apikeys', 'comms'].includes(urlTab)) {
      this.currentTab = urlTab;
    } else if (initialTab) {
      this.currentTab = initialTab;
    }

    if (urlKey) {
      this.activeProjectKey = urlKey;
    }

    this.container.innerHTML = `
      <div class="admin-dashboard-layout">
        <!-- Traditional Left Sidebar Navigation -->
        <aside class="admin-sidebar">
          <div class="admin-sidebar-header">
            <div class="admin-sidebar-brand">
              <div class="admin-sidebar-logo">🛡️</div>
              <div class="admin-sidebar-brand-text">
                <h2>Rithamic B2C</h2>
                <span>Developer Console</span>
              </div>
            </div>
          </div>

          <nav class="admin-sidebar-menu">
            <div class="menu-section-label">IDENTITY & APPS</div>
            <a href="?view=admin&tab=projects" class="sidebar-menu-item ${this.currentTab === 'projects' ? 'active' : ''}" data-tab="projects">
              <span class="menu-icon">🏢</span>
              <span class="menu-label">Applications</span>
              <span id="sidebar-projects-count" class="menu-badge">...</span>
            </a>
            <a href="?view=admin&tab=apikeys" class="sidebar-menu-item ${this.currentTab === 'apikeys' ? 'active' : ''}" data-tab="apikeys">
              <span class="menu-icon">🔑</span>
              <span class="menu-label">Server API Keys</span>
            </a>
            <a href="?view=admin&tab=comms" class="sidebar-menu-item ${this.currentTab === 'comms' ? 'active' : ''}" data-tab="comms">
              <span class="menu-icon">📊</span>
              <span class="menu-label">Communications</span>
            </a>
          </nav>

          <div class="admin-sidebar-footer">
            <div class="admin-user-profile">
              <div class="admin-user-avatar">👑</div>
              <div class="admin-user-meta">
                <span class="admin-user-name" title="${this.currentUser.fullName}">${this.currentUser.fullName}</span>
                <span class="admin-user-role">${this.currentUser.role}</span>
              </div>
            </div>
            <div class="sidebar-btn-group">
              <button id="btn-back-to-workspace" class="btn-sidebar-secondary">🚀 Workspace Hub</button>
              <button id="btn-admin-logout" class="btn-sidebar-danger">Logout</button>
            </div>
          </div>
        </aside>

        <!-- Right Content Main Frame (Consistent Fixed Layout) -->
        <div class="admin-main-viewport">
          <header class="admin-top-navbar">
            <div class="admin-breadcrumb">
              <span class="breadcrumb-root">Console</span>
              <span class="breadcrumb-sep">/</span>
              <span id="breadcrumb-current-tab" class="breadcrumb-active">${this.getTabLabel(this.currentTab)}</span>
            </div>
            <div class="admin-topbar-actions" id="admin-topbar-actions">
              <!-- Dynamically populated per tab -->
            </div>
          </header>

          <main id="admin-tab-content" class="admin-viewport-content">
            <div class="admin-loading-spinner">Loading console data...</div>
          </main>
        </div>

        <!-- Dynamic Modal Root -->
        <div id="admin-modal-root"></div>
      </div>
    `;

    this.bindEvents();
    await this.loadDataAndRenderTab();
  }

  private getTabLabel(tab: 'projects' | 'apikeys' | 'comms'): string {
    switch (tab) {
      case 'projects': return 'Registered Applications';
      case 'apikeys': return 'Server API Keys';
      case 'comms': return 'Communications & Usage Accounting';
    }
  }

  private bindEvents(): void {
    document.getElementById('btn-back-to-workspace')?.addEventListener('click', () => {
      this.onNavigateBack();
    });

    document.getElementById('btn-admin-logout')?.addEventListener('click', () => {
      localStorage.clear();
      window.location.href = window.location.pathname;
    });

    this.container.querySelectorAll('.sidebar-menu-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = (e.currentTarget as HTMLElement).dataset.tab as 'projects' | 'apikeys' | 'comms';
        this.switchTab(tab, true);
      });
    });
  }

  public switchTab(tab: 'projects' | 'apikeys' | 'comms', updateUrl: boolean = true): void {
    this.setTabInternal(tab, updateUrl);
  }

  private setTabInternal(tab: 'projects' | 'apikeys' | 'comms', updateUrl: boolean): void {
    this.currentTab = tab;
    
    // Update active sidebar item
    this.container.querySelectorAll('.sidebar-menu-item').forEach(b => {
      if ((b as HTMLElement).dataset.tab === tab) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    // Update breadcrumb
    const breadcrumb = document.getElementById('breadcrumb-current-tab');
    if (breadcrumb) breadcrumb.textContent = this.getTabLabel(tab);

    if (updateUrl) {
      router.navigate({ view: 'admin', adminTab: tab, activeKey: this.activeProjectKey });
    }

    this.renderCurrentTab();
  }

  private async loadDataAndRenderTab(): Promise<void> {
    try {
      this.projects = await projectService.getAllProjects();
      
      const countPill = document.getElementById('sidebar-projects-count');
      if (countPill) countPill.textContent = this.projects.length.toString();

      if (this.projects.length > 0 && !this.projects.some(p => p.projectKey === this.activeProjectKey)) {
        this.activeProjectKey = this.projects[0].projectKey;
      }
      this.renderCurrentTab();
    } catch (err: any) {
      const content = document.getElementById('admin-tab-content');
      if (content) {
        content.innerHTML = `<div class="admin-error-box">Failed to load console data: ${err.message}</div>`;
      }
    }
  }

  private renderCurrentTab(): void {
    const content = document.getElementById('admin-tab-content');
    const topbarActions = document.getElementById('admin-topbar-actions');
    if (!content) return;

    if (topbarActions) topbarActions.innerHTML = '';

    switch (this.currentTab) {
      case 'projects':
        this.renderProjectsTab(content, topbarActions);
        break;
      case 'apikeys':
        this.renderApiKeysTab(content, topbarActions);
        break;
      case 'comms':
        this.renderCommsTab(content, topbarActions);
        break;
    }
  }

  // ============================================================================
  // TAB 1: Projects & App Registrations
  // ============================================================================

  private getProjectGradient(key: string): { bg: string; color: string; initials: string } {
    switch (key) {
      case 'rithamic_login':
        return { bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#ffffff', initials: 'ID' };
      case 'rithamic_familytree':
        return { bg: 'linear-gradient(135deg, #10b981, #047857)', color: '#ffffff', initials: 'FT' };
      case 'rithamic_harish_hotel':
        return { bg: 'linear-gradient(135deg, #f59e0b, #b45309)', color: '#ffffff', initials: 'HH' };
      case 'rithamic_harish_engineering':
        return { bg: 'linear-gradient(135deg, #06b6d4, #0e7490)', color: '#ffffff', initials: 'HE' };
      case 'rithamic_harish_chip_unit':
        return { bg: 'linear-gradient(135deg, #84cc16, #4d7c0f)', color: '#ffffff', initials: 'CF' };
      case 'rithamic_website':
        return { bg: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#ffffff', initials: 'RW' };
      default:
        return { bg: 'linear-gradient(135deg, #64748b, #334155)', color: '#ffffff', initials: key.slice(0, 2).toUpperCase() };
    }
  }

  private renderProjectBadge(p: ClientProjectDto): string {
    const meta = this.getProjectGradient(p.projectKey);
    const hasIcon = p.appIconUrl && p.appIconUrl.trim() !== '';

    return `
      <div class="project-badge-wrapper">
        ${hasIcon ? `
          <img 
            src="${p.appIconUrl}" 
            alt="" 
            class="project-img-icon" 
            onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';" 
          />
        ` : ''}
        <div class="project-monogram-badge" style="background: ${meta.bg}; color: ${meta.color}; ${hasIcon ? 'display: none;' : 'display: flex;'}">
          ${meta.initials}
        </div>
      </div>
    `;
  }

  private renderProjectsTab(container: HTMLElement, topbarActions: HTMLElement | null): void {
    if (topbarActions) {
      topbarActions.innerHTML = `
        <button id="btn-register-app" class="btn-primary-sm">➕ Register New Application</button>
      `;
      document.getElementById('btn-register-app')?.addEventListener('click', () => this.showRegisterProjectModal());
    }

    container.innerHTML = `
      <div class="tab-view-header">
        <div>
          <h2 class="view-title">Registered Applications (${this.projects.length})</h2>
          <p class="view-desc">Multi-tenant client registries, single sign-on parameters, and CORS configurations.</p>
        </div>
      </div>

      <div class="projects-grid">
        ${this.projects.map(p => {
          const originCount = p.allowedOrigins?.length || 0;
          return `
          <div class="project-card ${p.isActive ? 'active' : 'inactive'}">
            <div class="project-card-header">
              ${this.renderProjectBadge(p)}
              <div class="project-info">
                <div class="project-title-row">
                  <h3 title="${p.projectName}">${p.projectName}</h3>
                  <span class="status-badge ${p.isActive ? 'badge-success' : 'badge-danger'}">
                    ${p.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <code class="project-key-pill">${p.projectKey}</code>
              </div>
            </div>

            <div class="project-card-body">
              <div class="meta-row">
                <span class="meta-icon">🏢</span>
                <span class="meta-text" title="${p.companyName || 'Rithamic Studio'}">${p.companyName || 'Rithamic Studio'}</span>
              </div>
              
              <div class="meta-row">
                <span class="meta-icon">🌐</span>
                <span class="meta-text">
                  ${p.appLaunchUrl 
                    ? `<a href="${p.appLaunchUrl}" target="_blank" class="launch-link">${p.appLaunchUrl.replace(/^https?:\/\//, '')}</a>` 
                    : '<span class="text-dim">No launch URL</span>'}
                </span>
              </div>

              <div class="meta-row">
                <span class="meta-icon">🛡️</span>
                <span class="meta-text origins-summary">
                  ${originCount > 0 
                    ? `<span class="origin-count-badge">${originCount} Allowed Origin${originCount > 1 ? 's' : ''}</span>`
                    : '<span class="text-dim">Default CORS rules</span>'}
                </span>
              </div>

              <div class="meta-row">
                <span class="meta-icon">⚡</span>
                <span class="meta-text">${p.rateLimitMax} req / ${p.rateLimitWindowMs / 1000}s rate limit</span>
              </div>
            </div>

            <div class="project-card-footer">
              <button class="btn-outline-sm btn-edit-project" data-key="${p.projectKey}">⚙️ Settings</button>
              <button class="btn-outline-sm btn-manage-keys" data-key="${p.projectKey}">🔑 API Keys</button>
            </div>
          </div>
        `;
        }).join('')}
      </div>
    `;

    container.querySelectorAll('.btn-edit-project').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = (e.currentTarget as HTMLElement).dataset.key!;
        const proj = this.projects.find(p => p.projectKey === key);
        if (proj) this.showEditProjectModal(proj);
      });
    });

    container.querySelectorAll('.btn-manage-keys').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = (e.currentTarget as HTMLElement).dataset.key!;
        this.activeProjectKey = key;
        this.switchTab('apikeys', true);
      });
    });
  }

  // ============================================================================
  // TAB 2: Server API Keys Management
  // ============================================================================

  private async renderApiKeysTab(container: HTMLElement, topbarActions: HTMLElement | null): Promise<void> {
    if (topbarActions) {
      topbarActions.innerHTML = `
        <div class="tab-header-controls">
          <select id="select-active-project" class="admin-select">
            ${this.projects.map(p => `<option value="${p.projectKey}" ${p.projectKey === this.activeProjectKey ? 'selected' : ''}>${p.projectName} (${p.projectKey})</option>`).join('')}
          </select>
          <button id="btn-create-key" class="btn-primary-sm">➕ Generate API Key</button>
        </div>
      `;

      document.getElementById('select-active-project')?.addEventListener('change', async (e) => {
        this.activeProjectKey = (e.target as HTMLSelectElement).value;
        const url = new URL(window.location.href);
        url.searchParams.set('activeKey', this.activeProjectKey);
        window.history.pushState({}, '', url.toString());
        await this.loadAndRenderKeysTable();
      });

      document.getElementById('btn-create-key')?.addEventListener('click', () => this.showCreateApiKeyModal());
    }

    container.innerHTML = `
      <div class="tab-view-header">
        <div>
          <h2 class="view-title">Server-to-Server API Keys</h2>
          <p class="view-desc">Generate cryptographically secure hashed API keys (<code>rk_live_...</code> / <code>rk_test_...</code>) for automated server integrations.</p>
        </div>
      </div>

      <div id="apikeys-table-container" class="admin-table-wrapper">
        <div class="admin-loading-spinner">Loading API keys...</div>
      </div>
    `;

    await this.loadAndRenderKeysTable();
  }

  private async loadAndRenderKeysTable(): Promise<void> {
    const container = document.getElementById('apikeys-table-container');
    if (!container) return;

    try {
      const keys = await projectService.getProjectApiKeys(this.activeProjectKey);
      if (keys.length === 0) {
        container.innerHTML = `
          <div class="empty-state-card">
            <div class="empty-icon">🔑</div>
            <h4>No Active API Keys for <code>${this.activeProjectKey}</code></h4>
            <p>Generate a private API key to allow server daemons, POS backends, and background workers to authenticate with Core Service.</p>
            <button id="btn-empty-create-key" class="btn-primary-sm" style="margin-top: 14px;">➕ Generate Key Now</button>
          </div>
        `;
        document.getElementById('btn-empty-create-key')?.addEventListener('click', () => this.showCreateApiKeyModal());
        return;
      }

      container.innerHTML = `
        <table class="admin-table">
          <thead>
            <tr>
              <th>Key Name</th>
              <th>Prefix</th>
              <th>Allowed Scopes</th>
              <th>Rate Limit</th>
              <th>Last Used</th>
              <th>Created Date</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${keys.map(k => `
              <tr class="${k.isActive ? '' : 'row-inactive'}">
                <td><strong>${k.keyName}</strong></td>
                <td><code class="key-prefix-pill">${k.keyPrefix}...</code></td>
                <td>
                  <div class="scopes-tag-list">
                    ${k.scopes.map(s => `<span class="scope-tag">${s}</span>`).join('')}
                  </div>
                </td>
                <td>${k.rateLimitPerMinute} req/min</td>
                <td>${k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : '<span class="text-dim">Never</span>'}</td>
                <td>${new Date(k.createdAt).toLocaleDateString()}</td>
                <td style="text-align: right;">
                  ${k.isActive
                    ? `<button class="btn-danger-xs btn-revoke-key" data-id="${k.id}">Revoke</button>`
                    : `<span class="badge-revoked">Revoked</span>`
                  }
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      container.querySelectorAll('.btn-revoke-key').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = parseInt((e.currentTarget as HTMLElement).dataset.id!, 10);
          if (confirm('Are you sure you want to revoke this API key? Any backend service using it will immediately lose access.')) {
            await projectService.revokeApiKey(this.activeProjectKey, id);
            await this.loadAndRenderKeysTable();
          }
        });
      });
    } catch (err: any) {
      container.innerHTML = `<div class="admin-error-box">Failed to load API keys: ${err.message}</div>`;
    }
  }

  // ============================================================================
  // TAB 3: Communications & Accounting Logs
  // ============================================================================

  private async renderCommsTab(container: HTMLElement, topbarActions: HTMLElement | null): Promise<void> {
    if (topbarActions) {
      topbarActions.innerHTML = `
        <div class="tab-header-controls">
          <select id="select-comms-project" class="admin-select">
            ${this.projects.map(p => `<option value="${p.projectKey}" ${p.projectKey === this.activeProjectKey ? 'selected' : ''}>${p.projectName} (${p.projectKey})</option>`).join('')}
          </select>
        </div>
      `;

      document.getElementById('select-comms-project')?.addEventListener('change', async (e) => {
        this.activeProjectKey = (e.target as HTMLSelectElement).value;
        const url = new URL(window.location.href);
        url.searchParams.set('activeKey', this.activeProjectKey);
        window.history.pushState({}, '', url.toString());
        await this.loadAndRenderCommsData();
      });
    }

    container.innerHTML = `
      <div class="tab-view-header">
        <div>
          <h2 class="view-title">Communications & Quota Accounting</h2>
          <p class="view-desc">Monitor email & SMS delivery logs, delivery success rates, and monthly accounting meters.</p>
        </div>
      </div>

      <div id="accounting-summary-cards" class="accounting-cards-grid">
        <div class="admin-loading-spinner">Loading accounting metrics...</div>
      </div>

      <div class="comms-logs-section">
        <h3 class="section-title">Recent Delivery Activity (Last 50 Events)</h3>
        <div id="comms-logs-table-container" class="admin-table-wrapper">
          <div class="admin-loading-spinner">Loading delivery logs...</div>
        </div>
      </div>
    `;

    await this.loadAndRenderCommsData();
  }

  private async loadAndRenderCommsData(): Promise<void> {
    const cardsContainer = document.getElementById('accounting-summary-cards');
    const logsContainer = document.getElementById('comms-logs-table-container');

    try {
      const [accounting, logs] = await Promise.all([
        projectService.getProjectAccounting(this.activeProjectKey),
        projectService.getRecentCommsLogs(this.activeProjectKey, 50)
      ]);

      if (cardsContainer) {
        const emailPct = Math.min(100, Math.round((accounting.totalEmailsSent / Math.max(1, accounting.monthlyQuotaEmails)) * 100));
        const smsPct = Math.min(100, Math.round((accounting.totalSmsSent / Math.max(1, accounting.monthlyQuotaSms)) * 100));

        cardsContainer.innerHTML = `
          <div class="accounting-card">
            <div class="accounting-card-header">
              <h4>📧 Monthly Emails</h4>
              <span class="quota-pill">${accounting.totalEmailsSent} / ${accounting.monthlyQuotaEmails}</span>
            </div>
            <div class="quota-progress-bar"><div class="progress-fill" style="width: ${emailPct}%"></div></div>
            <span class="quota-subtext">${emailPct}% quota consumed this billing cycle</span>
          </div>

          <div class="accounting-card">
            <div class="accounting-card-header">
              <h4>📱 Monthly SMS Passcodes</h4>
              <span class="quota-pill">${accounting.totalSmsSent} / ${accounting.monthlyQuotaSms}</span>
            </div>
            <div class="quota-progress-bar"><div class="progress-fill green" style="width: ${smsPct}%"></div></div>
            <span class="quota-subtext">${smsPct}% quota consumed this billing cycle</span>
          </div>

          <div class="accounting-card">
            <div class="accounting-card-header">
              <h4>✅ Delivery Success</h4>
              <span class="quota-pill success">${accounting.totalSuccess} Sent</span>
            </div>
            <div class="health-indicator ${accounting.totalFailed === 0 ? 'good' : 'warning'}">
              ${accounting.totalFailed === 0 ? '100% Delivery Health' : `${Math.round((accounting.totalSuccess / Math.max(1, accounting.totalSuccess + accounting.totalFailed)) * 100)}% Success (${accounting.totalFailed} Failed)`}
            </div>
            <span class="quota-subtext">Zero bounce rate recorded</span>
          </div>
        `;
      }

      if (logsContainer) {
        if (logs.length === 0) {
          logsContainer.innerHTML = `
            <div class="empty-state-card">
              <div class="empty-icon">📫</div>
              <h4>No Delivery Logs Recorded</h4>
              <p>When OTP codes, welcome emails, or SMS dispatches are sent by <code>${this.activeProjectKey}</code>, records will stream here in real-time.</p>
            </div>
          `;
          return;
        }

        logsContainer.innerHTML = `
          <table class="admin-table">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Recipient</th>
                <th>Message Type</th>
                <th>Provider</th>
                <th>Status</th>
                <th style="text-align: right;">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(l => `
                <tr>
                  <td><span class="channel-pill channel-${l.channel}">${l.channel.toUpperCase()}</span></td>
                  <td><code>${l.recipient}</code></td>
                  <td>${l.messageType}</td>
                  <td>${l.provider}</td>
                  <td>
                    <span class="status-badge ${l.status === 'sent' || l.status === 'delivered' ? 'badge-success' : 'badge-danger'}">
                      ${l.status}
                    </span>
                  </td>
                  <td style="text-align: right;">${new Date(l.createdAt).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
    } catch (err: any) {
      if (cardsContainer) cardsContainer.innerHTML = `<div class="admin-error-box">Failed to load data: ${err.message}</div>`;
    }
  }

  // ============================================================================
  // Modals & Dialogs
  // ============================================================================

  private showRegisterProjectModal(): void {
    const modalRoot = document.getElementById('admin-modal-root');
    if (!modalRoot) return;

    modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3>Register New Application / Project</h3>
            <button class="modal-close-btn">&times;</button>
          </div>
          <form id="form-register-project" class="modal-body">
            <div class="form-group">
              <label>Project Key (Unique ID, e.g. rithamic_pos)</label>
              <input type="text" id="new-proj-key" class="form-input" placeholder="rithamic_pos" required pattern="[a-z0-9_]+" />
            </div>
            <div class="form-group">
              <label>Application Name</label>
              <input type="text" id="new-proj-name" class="form-input" placeholder="Rithamic POS & Billing" required />
            </div>
            <div class="form-group">
              <label>Company / Organization Name</label>
              <input type="text" id="new-proj-company" class="form-input" placeholder="Rithamic Retail Solutions Ltd" />
            </div>
            <div class="form-group">
              <label>Launch URL (Redirect Destination)</label>
              <input type="url" id="new-proj-url" class="form-input" placeholder="https://pos.rithamic.co.in" />
            </div>
            <div class="form-group">
              <label>Allowed CORS Origins (Comma-separated)</label>
              <textarea id="new-proj-origins" class="form-input" rows="2" placeholder="http://localhost:5177, https://pos.rithamic.co.in"></textarea>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary-sm modal-close-btn">Cancel</button>
              <button type="submit" class="btn-primary-sm">Register Application</button>
            </div>
          </form>
        </div>
      </div>
    `;

    modalRoot.querySelectorAll('.modal-close-btn').forEach(b => b.addEventListener('click', () => { modalRoot.innerHTML = ''; }));

    document.getElementById('form-register-project')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const key = (document.getElementById('new-proj-key') as HTMLInputElement).value.trim();
      const name = (document.getElementById('new-proj-name') as HTMLInputElement).value.trim();
      const company = (document.getElementById('new-proj-company') as HTMLInputElement).value.trim();
      const launchUrl = (document.getElementById('new-proj-url') as HTMLInputElement).value.trim();
      const rawOrigins = (document.getElementById('new-proj-origins') as HTMLTextAreaElement).value.trim();

      const origins = rawOrigins ? rawOrigins.split(',').map(s => s.trim()).filter(Boolean) : [];

      try {
        await projectService.createProject({
          projectKey: key,
          projectName: name,
          companyName: company || name,
          appLaunchUrl: launchUrl || undefined,
          allowedOrigins: origins
        });
        modalRoot.innerHTML = '';
        await this.loadDataAndRenderTab();
      } catch (err: any) {
        alert(`Failed to register project: ${err.message}`);
      }
    });
  }

  private showEditProjectModal(project: ClientProjectDto): void {
    const modalRoot = document.getElementById('admin-modal-root');
    if (!modalRoot) return;

    modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3>Edit Application: ${project.projectName}</h3>
            <button class="modal-close-btn">&times;</button>
          </div>
          <form id="form-edit-project" class="modal-body">
            <div class="form-group">
              <label>Application Name</label>
              <input type="text" id="edit-proj-name" class="form-input" value="${project.projectName}" required />
            </div>
            <div class="form-group">
              <label>Company / Organization Name</label>
              <input type="text" id="edit-proj-company" class="form-input" value="${project.companyName || ''}" />
            </div>
            <div class="form-group">
              <label>Contact Email</label>
              <input type="email" id="edit-proj-email" class="form-input" value="${project.contactEmail || ''}" />
            </div>
            <div class="form-group">
              <label>Launch URL</label>
              <input type="url" id="edit-proj-url" class="form-input" value="${project.appLaunchUrl || ''}" />
            </div>
            <div class="form-group">
              <label>Allowed CORS Origins (Comma-separated)</label>
              <textarea id="edit-proj-origins" class="form-input" rows="2">${(project.allowedOrigins || []).join(', ')}</textarea>
            </div>
            <div class="form-row">
              <div class="form-group col-half">
                <label>Monthly Email Quota</label>
                <input type="number" id="edit-proj-quota-email" class="form-input" value="${project.monthlyQuotaEmails}" min="0" />
              </div>
              <div class="form-group col-half">
                <label>Monthly SMS Quota</label>
                <input type="number" id="edit-proj-quota-sms" class="form-input" value="${project.monthlyQuotaSms}" min="0" />
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary-sm modal-close-btn">Cancel</button>
              <button type="submit" class="btn-primary-sm">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    `;

    modalRoot.querySelectorAll('.modal-close-btn').forEach(b => b.addEventListener('click', () => { modalRoot.innerHTML = ''; }));

    document.getElementById('form-edit-project')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = (document.getElementById('edit-proj-name') as HTMLInputElement).value.trim();
      const company = (document.getElementById('edit-proj-company') as HTMLInputElement).value.trim();
      const contactEmail = (document.getElementById('edit-proj-email') as HTMLInputElement).value.trim();
      const launchUrl = (document.getElementById('edit-proj-url') as HTMLInputElement).value.trim();
      const rawOrigins = (document.getElementById('edit-proj-origins') as HTMLTextAreaElement).value.trim();
      const quotaEmail = parseInt((document.getElementById('edit-proj-quota-email') as HTMLInputElement).value, 10) || 5000;
      const quotaSms = parseInt((document.getElementById('edit-proj-quota-sms') as HTMLInputElement).value, 10) || 1000;

      const origins = rawOrigins ? rawOrigins.split(',').map(s => s.trim()).filter(Boolean) : [];

      try {
        await projectService.updateProject(project.projectKey, {
          projectName: name,
          companyName: company,
          contactEmail: contactEmail,
          appLaunchUrl: launchUrl,
          allowedOrigins: origins,
          monthlyQuotaEmails: quotaEmail,
          monthlyQuotaSms: quotaSms
        });
        modalRoot.innerHTML = '';
        await this.loadDataAndRenderTab();
      } catch (err: any) {
        alert(`Failed to update project: ${err.message}`);
      }
    });
  }

  private showCreateApiKeyModal(): void {
    const modalRoot = document.getElementById('admin-modal-root');
    if (!modalRoot) return;

    modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3>Generate Server API Key for <code>${this.activeProjectKey}</code></h3>
            <button class="modal-close-btn">&times;</button>
          </div>
          <form id="form-create-key" class="modal-body">
            <div class="form-group">
              <label>Key Name / Purpose</label>
              <input type="text" id="new-key-name" class="form-input" placeholder="e.g. Production Backend Service" required />
            </div>
            <div class="form-group">
              <label>Key Environment Type</label>
              <select id="new-key-env" class="form-input">
                <option value="rk_live">Live Production (rk_live_...)</option>
                <option value="rk_test">Test / Staging (rk_test_...)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Allowed Scopes</label>
              <div class="scopes-checkbox-group">
                <label><input type="checkbox" name="scopes" value="metrics:write" checked /> <code>metrics:write</code> (Ingest telemetry events)</label>
                <label><input type="checkbox" name="scopes" value="leads:write" checked /> <code>leads:write</code> (Ingest lead submissions)</label>
                <label><input type="checkbox" name="scopes" value="comms:send" checked /> <code>comms:send</code> (Dispatch OTP & transactional emails)</label>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary-sm modal-close-btn">Cancel</button>
              <button type="submit" class="btn-primary-sm">Generate Key</button>
            </div>
          </form>
        </div>
      </div>
    `;

    modalRoot.querySelectorAll('.modal-close-btn').forEach(b => b.addEventListener('click', () => { modalRoot.innerHTML = ''; }));

    document.getElementById('form-create-key')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const keyName = (document.getElementById('new-key-name') as HTMLInputElement).value.trim();
      const keyEnv = (document.getElementById('new-key-env') as HTMLSelectElement).value;

      const checkedScopes = Array.from(modalRoot.querySelectorAll('input[name="scopes"]:checked'))
        .map(el => (el as HTMLInputElement).value);

      try {
        const result = await projectService.createApiKey(this.activeProjectKey, {
          keyName: `${keyName} (${keyEnv === 'rk_live' ? 'Live' : 'Test'})`,
          scopes: checkedScopes.length > 0 ? checkedScopes : ['metrics:write']
        });

        modalRoot.innerHTML = '';
        this.showNewApiKeyRevealModal(result.apiKey || '');
        await this.loadAndRenderKeysTable();
      } catch (err: any) {
        alert(`Failed to create API key: ${err.message}`);
      }
    });
  }

  private showNewApiKeyRevealModal(rawSecretKey: string): void {
    const modalRoot = document.getElementById('admin-modal-root');
    if (!modalRoot) return;

    modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3>🔑 API Key Generated Successfully</h3>
            <button class="modal-close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <p class="text-warning-box">
              ⚠️ <strong>Save this key immediately!</strong> For security reasons, you will never be able to see this secret key again.
            </p>
            <div class="form-group">
              <label>Private Secret Key</label>
              <div class="key-copy-row">
                <input type="text" id="reveal-secret-key" class="form-input font-mono" value="${rawSecretKey}" readonly />
                <button type="button" id="btn-copy-secret-key" class="btn-primary-sm">📋 Copy</button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-primary-sm modal-close-btn">Done</button>
          </div>
        </div>
      </div>
    `;

    modalRoot.querySelectorAll('.modal-close-btn').forEach(b => b.addEventListener('click', () => { modalRoot.innerHTML = ''; }));

    document.getElementById('btn-copy-secret-key')?.addEventListener('click', () => {
      navigator.clipboard.writeText(rawSecretKey);
      const btn = document.getElementById('btn-copy-secret-key');
      if (btn) btn.textContent = '✅ Copied!';
    });
  }
}
