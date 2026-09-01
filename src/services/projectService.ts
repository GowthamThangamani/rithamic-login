import { CONFIG } from '../config/index.ts';
import { ApiResponse, ClientProjectDto, ApiKeyDto, CommunicationsLogDto, ProjectAccountingDto } from '../types/index.ts';

class ProjectService {
  private getHeaders(token?: string): HeadersInit {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const authToken = token || localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    return headers;
  }

  // --- Project / App Registrations CRUD ---

  async getAllProjects(token?: string): Promise<ClientProjectDto[]> {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/projects`, {
      headers: this.getHeaders(token)
    });
    const data: ApiResponse<ClientProjectDto[]> = await res.json();
    if (!res.ok || !data.success || !data.data) {
      throw new Error(data.message || 'Failed to retrieve projects');
    }
    return data.data;
  }

  async getProjectByKey(projectKey: string): Promise<ClientProjectDto> {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/projects/${projectKey}`);
    const data: ApiResponse<ClientProjectDto> = await res.json();
    if (!res.ok || !data.success || !data.data) {
      throw new Error(data.message || `Project '${projectKey}' not found`);
    }
    return data.data;
  }

  async createProject(dto: Partial<ClientProjectDto>, token?: string): Promise<ClientProjectDto> {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/projects`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(dto)
    });
    const data: ApiResponse<ClientProjectDto> = await res.json();
    if (!res.ok || !data.success || !data.data) {
      throw new Error(data.message || 'Failed to create project');
    }
    return data.data;
  }

  async updateProject(projectKey: string, dto: Partial<ClientProjectDto>, token?: string): Promise<ClientProjectDto> {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/projects/${projectKey}`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify(dto)
    });
    const data: ApiResponse<ClientProjectDto> = await res.json();
    if (!res.ok || !data.success || !data.data) {
      throw new Error(data.message || 'Failed to update project');
    }
    return data.data;
  }

  async deactivateProject(projectKey: string, token?: string): Promise<boolean> {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/projects/${projectKey}`, {
      method: 'DELETE',
      headers: this.getHeaders(token)
    });
    const data: ApiResponse<any> = await res.json();
    return res.ok && data.success;
  }

  // --- API Key Lifecycle ---

  async createApiKey(projectKey: string, dto: { keyName: string; scopes: string[]; rateLimitPerMinute?: number }, token?: string): Promise<ApiKeyDto> {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/projects/${projectKey}/keys`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(dto)
    });
    const data: ApiResponse<ApiKeyDto> = await res.json();
    if (!res.ok || !data.success || !data.data) {
      throw new Error(data.message || 'Failed to generate API key');
    }
    return data.data;
  }

  async getProjectApiKeys(projectKey: string, token?: string): Promise<ApiKeyDto[]> {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/projects/${projectKey}/keys`, {
      headers: this.getHeaders(token)
    });
    const data: ApiResponse<ApiKeyDto[]> = await res.json();
    if (!res.ok || !data.success || !data.data) {
      throw new Error(data.message || 'Failed to retrieve API keys');
    }
    return data.data;
  }

  async revokeApiKey(projectKey: string, keyId: number, token?: string): Promise<boolean> {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/projects/${projectKey}/keys/${keyId}`, {
      method: 'DELETE',
      headers: this.getHeaders(token)
    });
    const data: ApiResponse<any> = await res.json();
    return res.ok && data.success;
  }

  // --- Communications & Accounting ---

  async getProjectAccounting(projectKey: string, year?: number, month?: number, token?: string): Promise<ProjectAccountingDto> {
    const query = new URLSearchParams();
    if (year) query.append('year', year.toString());
    if (month) query.append('month', month.toString());

    const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/projects/${projectKey}/accounting?${query.toString()}`, {
      headers: this.getHeaders(token)
    });
    const data: ApiResponse<ProjectAccountingDto> = await res.json();
    if (!res.ok || !data.success || !data.data) {
      throw new Error(data.message || 'Failed to retrieve accounting summary');
    }
    return data.data;
  }

  async getRecentCommsLogs(projectKey: string, limit: number = 50, token?: string): Promise<CommunicationsLogDto[]> {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/v1/communications/${projectKey}/logs?limit=${limit}`, {
      headers: this.getHeaders(token)
    });
    const data: ApiResponse<CommunicationsLogDto[]> = await res.json();
    if (!res.ok || !data.success || !data.data) {
      throw new Error(data.message || 'Failed to retrieve delivery logs');
    }
    return data.data;
  }
}

export const projectService = new ProjectService();
