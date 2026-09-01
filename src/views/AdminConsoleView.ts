import { projectService } from '../services/projectService.ts';
import { AuthUser, ClientProjectDto, ApiKeyDto } from '../types/index.ts';

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

  async render(user: AuthUser): Promise<void> {
    this.currentUser = user;
    this.container.innerHTML = `
      <div class="admin-console-layout">
        <!-- Top Admin Header -->
        <header class="admin-header">
          <div class="admin-brand">
            <div class="admin-logo-shield">🛡️</div>
            <div>
              <h1 class="admin-title">Rithamic B2C Console</h1>
              <p class="admin-subtitle">Central Identity, App Registrations & Developer Hub</p>
            </div>
          </div>
          <div class="admin-header-actions">
            <span class="admin-user-badge">👑 ${this.currentUser.fullName} (${this.currentUser.role})</span>
            <button id="btn-back-to-workspace" class="btn-secondary-sm">🚀 Workspace Hub</button>
            <button id="btn-admin-logout" class="btn-outline-danger-sm">Logout</button>
          </div>
        </header>

        <!-- Admin Navigation Tabs -->
        <nav class="admin-nav-tabs">
          <button class="admin-tab-btn ${this.currentTab === 'projects' ? 'active' : ''}" data-tab="projects">
            🏢 App Registrations & Projects
          </button>
          <button class="admin-tab-btn ${this.currentTab === 'apikeys' ? 'active' : ''}" data-tab="apikeys">
            🔑 Server API Keys
          </button>
          <button class="admin-tab-btn ${this.currentTab === 'comms' ? 'active' : ''}" data-tab="comms">
            📊 Communications & Usage Logs
          </button>
        </nav>

        <!-- Dynamic Admin Content Pane -->
        <main id="admin-tab-content" class="admin-tab-content">
          <div class="admin-loading-spinner">Loading console data...</div>
        </main>

        <!-- Dynamic Modal Container -->
        <div id="admin-modal-root"></div>
      </div>
    `;

    this.bindEvents();
    await this.loadDataAndRenderTab();
  }

  private bindEvents(): void {
    document.getElementById('btn-back-to-workspace')?.addEventListener('click', () => {
      this.onNavigateBack();
    });

    document.getElementById('btn-admin-logout')?.addEventListener('click', () => {
      localStorage.clear();
      window.location.reload();
    });

    this.container.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = (e.currentTarget as HTMLElement).dataset.tab as 'projects' | 'apikeys' | 'comms';
        this.currentTab = tab;
        this.container.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');
        this.renderCurrentTab();
      });
    });
  }

  private async loadDataAndRenderTab(): Promise<void> {
    try {
      this.projects = await projectService.getAllProjects();
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
    if (!content) return;

    switch (this.currentTab) {
      case 'projects':
        this.renderProjectsTab(content);
        break;
      case 'apikeys':
        this.renderApiKeysTab(content);
        break;
      case 'comms':
        this.renderCommsTab(content);
        break;
    }
  }

  // ============================================================================
  // TAB 1: Projects & App Registrations
  // ============================================================================

  private renderProjectsTab(container: HTMLElement): void {
    container.innerHTML = `
      <div class="tab-pane-header">
        <div>
          <h2>Registered Applications (${this.projects.length})</h2>
          <p class="text-muted">Manage multi-tenant applications, CORS origins, and rate limits.</p>
        </div>
        <button id="btn-register-app" class="btn-primary-sm">➕ Register New Application</button>
      </div>

      <div class="projects-grid">
        ${this.projects.map(p => `
          <div class="project-card ${p.isActive ? 'active' : 'inactive'}">
            <div class="project-card-header">
              <div class="project-icon-badge">${p.appIconUrl ? `<img src="${p.appIconUrl}" alt="${p.projectName}" onerror="this.innerHTML='📦'" />` : '📦'}</div>
              <div class="project-info">
                <h3>${p.projectName}</h3>
                <code>${p.projectKey}</code>
              </div>
              <span class="status-badge ${p.isActive ? 'badge-success' : 'badge-danger'}">
                ${p.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div class="project-card-body">
              <div class="meta-field">
                <span class="meta-label">Company:</span>
                <span class="meta-value">${p.companyName || '—'}</span>
              </div>
              <div class="meta-field">
                <span class="meta-label">Launch URL:</span>
                <span class="meta-value">${p.appLaunchUrl ? `<a href="${p.appLaunchUrl}" target="_blank">${p.appLaunchUrl}</a>` : '—'}</span>
              </div>
              <div class="meta-field">
                <span class="meta-label">Allowed CORS Origins:</span>
                <div class="origins-tag-list">
                  ${p.allowedOrigins && p.allowedOrigins.length > 0
                    ? p.allowedOrigins.map(o => `<span class="origin-tag">${o}</span>`).join('')
                    : '<span class="origin-tag muted">Default (localhost/*.rithamic.co.in)</span>'
                  }
                </div>
              </div>
              <div class="meta-field">
                <span class="meta-label">Rate Quotas:</span>
                <span class="meta-value">${p.rateLimitMax} req / ${p.rateLimitWindowMs / 1000}s</span>
              </div>
            </div>

            <div class="project-card-footer">
              <button class="btn-outline-sm btn-edit-project" data-key="${p.projectKey}">⚙️ Settings</button>
              <button class="btn-outline-sm btn-manage-keys" data-key="${p.projectKey}">🔑 API Keys</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('btn-register-app')?.addEventListener('click', () => this.showRegisterProjectModal());

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
        this.currentTab = 'apikeys';
        this.container.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
        this.container.querySelector('[data-tab="apikeys"]')?.classList.add('active');
        this.renderCurrentTab();
      });
    });
  }

  // ============================================================================
  // TAB 2: Server API Keys Management
  // ============================================================================

  private async renderApiKeysTab(container: HTMLElement): Promise<void> {
    container.innerHTML = `
      <div class="tab-pane-header">
        <div>
          <h2>Server API Keys</h2>
          <p class="text-muted">Generate Stripe-like hashed API keys (<code>rk_live_...</code>) for server-to-server calls.</p>
        </div>
        <div class="tab-header-controls">
          <select id="select-active-project" class="admin-select">
            ${this.projects.map(p => `<option value="${p.projectKey}" ${p.projectKey === this.activeProjectKey ? 'selected' : ''}>${p.projectName} (${p.projectKey})</option>`).join('')}
          </select>
          <button id="btn-create-key" class="btn-primary-sm">➕ Generate New API Key</button>
        </div>
      </div>

      <div id="apikeys-table-container">
        <div class="admin-loading-spinner">Loading API keys...</div>
      </div>
    `;

    document.getElementById('select-active-project')?.addEventListener('change', async (e) => {
      this.activeProjectKey = (e.target as HTMLSelectElement).value;
      await this.loadAndRenderKeysTable();
    });

    document.getElementById('btn-create-key')?.addEventListener('click', () => this.showCreateApiKeyModal());

    await this.loadAndRenderKeysTable();
  }

  private async loadAndRenderKeysTable(): Promise<void> {
    const container = document.getElementById('apikeys-table-container');
    if (!container) return;

    try {
      const keys = await projectService.getProjectApiKeys(this.activeProjectKey);
      if (keys.length === 0) {
        container.innerHTML = `
          <div class="empty-state-box">
            <p>No active API keys found for project <strong>${this.activeProjectKey}</strong>.</p>
            <p class="text-muted">Generate an API key to allow backend services to dispatch emails, SMS, and ingest telemetry.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <table class="admin-table">
          <thead>
            <tr>
              <th>Key Name</th>
              <th>Prefix</th>
              <th>Scopes</th>
              <th>Rate Limit</th>
              <th>Last Used</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${keys.map(k => `
              <tr class="${k.isActive ? '' : 'row-inactive'}">
                <td><strong>${k.keyName}</strong></td>
                <td><code>${k.keyPrefix}...</code></td>
                <td>
                  <div class="scopes-tag-list">
                    ${k.scopes.map(s => `<span class="scope-tag">${s}</span>`).join('')}
                  </div>
                </td>
                <td>${k.rateLimitPerMinute} req/min</td>
                <td>${k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}</td>
                <td>${new Date(k.createdAt).toLocaleDateString()}</td>
                <td>
                  ${k.isActive
                    ? `<button class="btn-danger-xs btn-revoke-key" data-id="${k.id}">Revoke</button>`
                    : `<span class="text-muted">Revoked</span>`
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

  private async renderCommsTab(container: HTMLElement): Promise<void> {
    container.innerHTML = `
      <div class="tab-pane-header">
        <div>
          <h2>Communications & Usage Accounting</h2>
          <p class="text-muted">Monitor email & SMS delivery logs, success ratios, and monthly quota usage.</p>
        </div>
        <div class="tab-header-controls">
          <select id="select-comms-project" class="admin-select">
            ${this.projects.map(p => `<option value="${p.projectKey}" ${p.projectKey === this.activeProjectKey ? 'selected' : ''}>${p.projectName} (${p.projectKey})</option>`).join('')}
          </select>
        </div>
      </div>

      <div id="accounting-summary-cards" class="accounting-cards-grid">
        <div class="admin-loading-spinner">Loading accounting metrics...</div>
      </div>

      <div class="comms-logs-section">
        <h3>Recent Delivery Logs (Last 50)</h3>
        <div id="comms-logs-table-container">
          <div class="admin-loading-spinner">Loading delivery logs...</div>
        </div>
      </div>
    `;

    document.getElementById('select-comms-project')?.addEventListener('change', async (e) => {
      this.activeProjectKey = (e.target as HTMLSelectElement).value;
      await this.loadAndRenderCommsData();
    });

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
            <h4>📧 Monthly Emails</h4>
            <div class="quota-number">${accounting.totalEmailsSent} <span class="quota-total">/ ${accounting.monthlyQuotaEmails}</span></div>
            <div class="quota-progress-bar"><div class="progress-fill" style="width: ${emailPct}%"></div></div>
            <span class="quota-subtext">${emailPct}% quota consumed this month</span>
          </div>

          <div class="accounting-card">
            <h4>📱 Monthly SMS Passcodes</h4>
            <div class="quota-number">${accounting.totalSmsSent} <span class="quota-total">/ ${accounting.monthlyQuotaSms}</span></div>
            <div class="quota-progress-bar"><div class="progress-fill green" style="width: ${smsPct}%"></div></div>
            <span class="quota-subtext">${smsPct}% quota consumed this month</span>
          </div>

          <div class="accounting-card">
            <h4>✅ Delivery Health</h4>
            <div class="quota-number">${accounting.totalSuccess} <span class="quota-total">Success (${accounting.totalFailed} Failed)</span></div>
            <div class="health-pill ${accounting.totalFailed === 0 ? 'good' : 'warning'}">
              ${accounting.totalFailed === 0 ? '100% Delivery Rate' : `${Math.round((accounting.totalSuccess / Math.max(1, accounting.totalSuccess + accounting.totalFailed)) * 100)}% Success`}
            </div>
          </div>
        `;
      }

      if (logsContainer) {
        if (logs.length === 0) {
          logsContainer.innerHTML = `<div class="empty-state-box"><p>No email or SMS logs recorded for this project yet.</p></div>`;
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
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(l => `
                <tr>
                  <td><span class="channel-pill ${l.channel}">${l.channel.toUpperCase()}</span></td>
                  <td><code>${l.recipient}</code></td>
                  <td>${l.messageType}</td>
                  <td>${l.provider}</td>
                  <td>
                    <span class="status-pill ${l.status}">${l.status}</span>
                    ${l.errorMessage ? `<div class="log-error-tooltip">${l.errorMessage}</div>` : ''}
                  </td>
                  <td>${new Date(l.createdAt).toLocaleString()}</td>
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
              <textarea id="edit-proj-origins" class="form-input" rows="3">${project.allowedOrigins.join(', ')}</textarea>
            </div>
            <div class="form-group">
              <label>Monthly Email Quota</label>
              <input type="number" id="edit-proj-quota-email" class="form-input" value="${project.monthlyQuotaEmails}" />
            </div>
            <div class="form-group">
              <label>Monthly SMS Quota</label>
              <input type="number" id="edit-proj-quota-sms" class="form-input" value="${project.monthlyQuotaSms}" />
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
      const quotaEmails = parseInt((document.getElementById('edit-proj-quota-email') as HTMLInputElement).value, 10);
      const quotaSms = parseInt((document.getElementById('edit-proj-quota-sms') as HTMLInputElement).value, 10);

      const origins = rawOrigins ? rawOrigins.split(',').map(s => s.trim()).filter(Boolean) : [];

      try {
        await projectService.updateProject(project.projectKey, {
          projectName: name,
          companyName: company || name,
          contactEmail: contactEmail || undefined,
          appLaunchUrl: launchUrl || undefined,
          allowedOrigins: origins,
          monthlyQuotaEmails: quotaEmails || 5000,
          monthlyQuotaSms: quotaSms || 1000
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
            <h3>Generate Server API Key</h3>
            <button class="modal-close-btn">&times;</button>
          </div>
          <form id="form-create-key" class="modal-body">
            <div class="form-group">
              <label>Target Application</label>
              <input type="text" class="form-input" value="${this.activeProjectKey}" disabled />
            </div>
            <div class="form-group">
              <label>Key Name (e.g. Production Backend Worker)</label>
              <input type="text" id="new-key-name" class="form-input" placeholder="e.g. Production API Gateway" required />
            </div>
            <div class="form-group">
              <label>Permission Scopes</label>
              <div class="checkbox-group">
                <label><input type="checkbox" name="scopes" value="metrics:write" checked /> <code>metrics:write</code> (Ingest telemetry)</label>
                <label><input type="checkbox" name="scopes" value="leads:write" checked /> <code>leads:write</code> (Ingest customer leads)</label>
                <label><input type="checkbox" name="scopes" value="comms:send" checked /> <code>comms:send</code> (Dispatch Email & SMS)</label>
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
      const scopeCheckboxes = modalRoot.querySelectorAll<HTMLInputElement>('input[name="scopes"]:checked');
      const scopes = Array.from(scopeCheckboxes).map(cb => cb.value);

      try {
        const createdKey = await projectService.createApiKey(this.activeProjectKey, {
          keyName,
          scopes: scopes.length > 0 ? scopes : ['metrics:write']
        });
        this.showKeyRevealedModal(createdKey);
      } catch (err: any) {
        alert(`Failed to create API key: ${err.message}`);
      }
    });
  }

  private showKeyRevealedModal(key: ApiKeyDto): void {
    const modalRoot = document.getElementById('admin-modal-root');
    if (!modalRoot) return;

    modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3>🎉 API Key Generated</h3>
          </div>
          <div class="modal-body">
            <div class="warning-banner">
              ⚠️ <strong>Save this key now!</strong> It will never be shown again.
            </div>
            <div class="key-reveal-box">
              <input type="text" id="revealed-key-input" class="form-input key-display" value="${key.apiKey || ''}" readonly />
              <button id="btn-copy-key" class="btn-primary-sm">📋 Copy</button>
            </div>
            <p class="text-muted" style="margin-top: 12px; font-size: 12px;">
              Pass this key in your backend requests via the <code>X-API-Key</code> header:
              <br/><code>X-API-Key: ${key.apiKey}</code>
            </p>
          </div>
          <div class="modal-footer">
            <button id="btn-done-key" class="btn-primary-sm">I have saved my key</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-copy-key')?.addEventListener('click', () => {
      const input = document.getElementById('revealed-key-input') as HTMLInputElement;
      input.select();
      navigator.clipboard.writeText(input.value);
      alert('API key copied to clipboard!');
    });

    document.getElementById('btn-done-key')?.addEventListener('click', async () => {
      modalRoot.innerHTML = '';
      await this.loadAndRenderKeysTable();
    });
  }
}
