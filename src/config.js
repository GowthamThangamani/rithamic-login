// Configuration for Rithamic Central Login
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const CONFIG = {
  API_BASE_URL: isLocalhost ? 'http://localhost:3000' : 'https://api.rithamic.co.in',
  DEFAULT_PROJECT_KEY: 'rithamic_login',
  SESSION_STORAGE_KEY: 'rithamic_auth_token',
  USER_STORAGE_KEY: 'rithamic_auth_user'
};
