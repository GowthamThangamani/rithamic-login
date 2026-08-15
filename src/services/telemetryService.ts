import { CONFIG } from '../config/index.ts';

let sessionId = localStorage.getItem('login_session_id');
if (!sessionId) {
  sessionId = 'sess_' + Math.random().toString(36).substring(2, 11);
  localStorage.setItem('login_session_id', sessionId);
}

export const trackEvent = (eventType: string, eventName: string, metadata: Record<string, any> = {}): void => {
  const userJson = localStorage.getItem(CONFIG.USER_STORAGE_KEY);
  const user = userJson ? JSON.parse(userJson) : null;

  fetch(`${CONFIG.API_BASE_URL}/api/v1/metrics/${CONFIG.DEFAULT_PROJECT_KEY}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Id': sessionId || 'anonymous'
    },
    body: JSON.stringify({
      events: [
        {
          eventType,
          eventName,
          metadata,
          sessionId,
          userIdentifier: user ? user.email : 'anonymous_visitor'
        }
      ]
    })
  }).catch(() => {});
};
