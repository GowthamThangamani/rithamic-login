import { CONFIG } from '../config/index.ts';

export type AuthTab = 'password' | 'otp' | 'magic' | 'forgot' | 'reset';
export type AdminTab = 'projects' | 'apikeys' | 'comms';
export type AppView = 'auth' | 'workspaces' | 'admin';

export interface RouteState {
  project: string;
  view: AppView;
  authTab: AuthTab;
  adminTab: AdminTab;
  returnUrl: string | null;
  resetToken: string | null;
  resetEmail: string | null;
  magicToken: string | null;
  activeKey: string | null;
}

type RouteChangeListener = (state: RouteState) => void;

class RouterService {
  private listeners: RouteChangeListener[] = [];

  constructor() {
    window.addEventListener('popstate', () => {
      this.notifyListeners();
    });
  }

  public getRouteState(): RouteState {
    const params = new URLSearchParams(window.location.search);
    const rawProject = params.get('project') || params.get('client_id') || CONFIG.DEFAULT_PROJECT_KEY;
    const project = this.sanitizeProjectKey(rawProject);

    // View detection
    let view: AppView = 'auth';
    const rawView = params.get('view');
    if (rawView === 'admin' || window.location.pathname.startsWith('/admin')) {
      view = 'admin';
    } else if (rawView === 'workspaces' || rawView === 'hub') {
      view = 'workspaces';
    }

    // Auth Tab detection
    let authTab: AuthTab = 'password';
    const rawTab = params.get('tab');
    if (rawTab && ['password', 'otp', 'magic', 'forgot', 'reset'].includes(rawTab)) {
      authTab = rawTab as AuthTab;
    } else if (params.get('token') || params.get('resetToken')) {
      authTab = 'reset';
    }

    // Admin Tab detection
    let adminTab: AdminTab = 'projects';
    if (rawTab && ['projects', 'apikeys', 'comms'].includes(rawTab)) {
      adminTab = rawTab as AdminTab;
    }

    const returnUrl = params.get('returnUrl') || params.get('redirect_uri') || params.get('relayState');
    const resetToken = params.get('token') || params.get('resetToken');
    const resetEmail = params.get('email');
    const magicToken = params.get('magicToken');
    const activeKey = params.get('activeKey');

    return {
      project,
      view,
      authTab,
      adminTab,
      returnUrl,
      resetToken,
      resetEmail,
      magicToken,
      activeKey
    };
  }

  public navigate(partialState: Partial<RouteState>, replace: boolean = false): void {
    const currentState = this.getRouteState();
    const nextState: RouteState = { ...currentState, ...partialState };

    const params = new URLSearchParams();

    // Preserve project if non-default
    if (nextState.project && nextState.project !== CONFIG.DEFAULT_PROJECT_KEY) {
      params.set('project', nextState.project);
    }

    // View state
    if (nextState.view !== 'auth') {
      params.set('view', nextState.view);
    }

    // Tab state
    if (nextState.view === 'auth') {
      if (nextState.authTab !== 'password') {
        params.set('tab', nextState.authTab);
      }
    } else if (nextState.view === 'admin') {
      if (nextState.adminTab) {
        params.set('tab', nextState.adminTab);
      }
      if (nextState.activeKey) {
        params.set('activeKey', nextState.activeKey);
      }
    }

    // Return URL
    if (nextState.returnUrl) {
      params.set('returnUrl', nextState.returnUrl);
    }

    // Reset Token / Magic Token
    if (nextState.resetToken) params.set('token', nextState.resetToken);
    if (nextState.resetEmail) params.set('email', nextState.resetEmail);
    if (nextState.magicToken) params.set('magicToken', nextState.magicToken);

    const queryString = params.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;

    if (replace) {
      window.history.replaceState({}, '', newUrl);
    } else {
      window.history.pushState({}, '', newUrl);
    }

    this.notifyListeners();
  }

  public subscribe(listener: RouteChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    const state = this.getRouteState();
    this.listeners.forEach(fn => {
      try {
        fn(state);
      } catch (err) {
        console.error('[RouterService] Error in listener callback:', err);
      }
    });
  }

  private sanitizeProjectKey(raw: string): string {
    const clean = raw.trim().toLowerCase();
    if (/^[a-z0-9_]{3,40}$/.test(clean)) {
      return clean;
    }
    return CONFIG.DEFAULT_PROJECT_KEY;
  }
}

export const router = new RouterService();
