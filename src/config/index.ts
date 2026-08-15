const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const CONFIG = {
  API_BASE_URL: isLocalhost ? 'http://localhost:5000' : 'https://api.rithamic.co.in',
  DEFAULT_PROJECT_KEY: 'rithamic_login',
  SESSION_STORAGE_KEY: 'rithamic_auth_token',
  REFRESH_TOKEN_KEY: 'rithamic_refresh_token',
  SESSION_ID_KEY: 'rithamic_session_id',
  USER_STORAGE_KEY: 'rithamic_auth_user',
  GOOGLE_CLIENT_ID: '792496087713-1io8sp27hk950iktafssgtnle66hpp6l.apps.googleusercontent.com'
} as const;
