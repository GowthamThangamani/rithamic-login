import { CONFIG } from './config/index.ts';
import { AuthResponseDto, AuthUser, SessionItemDto } from './types/index.ts';
import * as authService from './services/authService.ts';

// State
const urlParams = new URLSearchParams(window.location.search);
const targetProjectKey = urlParams.get('project') || CONFIG.DEFAULT_PROJECT_KEY;
const returnUrl = urlParams.get('returnUrl');
const resetTokenParam = urlParams.get('token') || urlParams.get('resetToken');
const emailParam = urlParams.get('email');
const magicTokenFromUrl = urlParams.get('magicToken');

let currentEmail = '';
let cooldownInterval: number | null = null;

// DOM Elements
const authCard = document.getElementById('authCard') as HTMLElement;
const workspaceHubCard = document.getElementById('workspaceHubCard') as HTMLElement;
const alertBox = document.getElementById('alertBox') as HTMLElement;
const brandTitle = document.getElementById('brandTitle') as HTMLElement;
const brandSubtitle = document.getElementById('brandSubtitle') as HTMLElement;

// Tabs
const authTabs = document.getElementById('authTabs') as HTMLElement;
const tabPassword = document.getElementById('tabPassword') as HTMLButtonElement;
const tabOtp = document.getElementById('tabOtp') as HTMLButtonElement;
const tabMagic = document.getElementById('tabMagic') as HTMLButtonElement;

// Views
const passwordView = document.getElementById('passwordView') as HTMLElement;
const otpStep1View = document.getElementById('otpStep1View') as HTMLElement;
const otpStep2View = document.getElementById('otpStep2View') as HTMLElement;
const magicLinkView = document.getElementById('magicLinkView') as HTMLElement;
const forgotPasswordView = document.getElementById('forgotPasswordView') as HTMLElement;
const resetPasswordView = document.getElementById('resetPasswordView') as HTMLElement;

// Password Forms
const passwordLoginForm = document.getElementById('passwordLoginForm') as HTMLFormElement;
const passwordEmailInput = document.getElementById('passwordEmailInput') as HTMLInputElement;
const passwordInput = document.getElementById('passwordInput') as HTMLInputElement;
const btnTriggerForgot = document.getElementById('btnTriggerForgot') as HTMLAnchorElement;
const forgotPasswordForm = document.getElementById('forgotPasswordForm') as HTMLFormElement;
const forgotEmailInput = document.getElementById('forgotEmailInput') as HTMLInputElement;
const btnBackToLogin = document.getElementById('btnBackToLogin') as HTMLAnchorElement;
const resetPasswordForm = document.getElementById('resetPasswordForm') as HTMLFormElement;
const resetEmailInput = document.getElementById('resetEmailInput') as HTMLInputElement;
const newPasswordInput = document.getElementById('newPasswordInput') as HTMLInputElement;
const confirmPasswordInput = document.getElementById('confirmPasswordInput') as HTMLInputElement;

// OTP Forms
const otpRequestForm = document.getElementById('otpRequestForm') as HTMLFormElement;
const otpEmailInput = document.getElementById('otpEmailInput') as HTMLInputElement;
const otpVerifyForm = document.getElementById('otpVerifyForm') as HTMLFormElement;
const otpDigitInputs = document.querySelectorAll<HTMLInputElement>('.otp-digit');
const sentEmailDisplay = document.getElementById('sentEmailDisplay') as HTMLElement;
const resendOtpLink = document.getElementById('resendOtpLink') as HTMLAnchorElement;
const cooldownTimer = document.getElementById('cooldownTimer') as HTMLElement;
const btnChangeEmail = document.getElementById('btnChangeEmail') as HTMLButtonElement;

// Magic Link & Google
const magicLinkForm = document.getElementById('magicLinkForm') as HTMLFormElement;
const magicEmailInput = document.getElementById('magicEmailInput') as HTMLInputElement;
const btnGoogleLogin = document.getElementById('btnGoogleLogin') as HTMLButtonElement;

// Hub & Sessions
const userName = document.getElementById('userName') as HTMLElement;
const userEmail = document.getElementById('userEmail') as HTMLElement;
const userAvatar = document.getElementById('userAvatar') as HTMLElement;
const suitesContainer = document.getElementById('suitesContainer') as HTMLElement;
const btnLogout = document.getElementById('btnLogout') as HTMLButtonElement;
const btnOpenSessions = document.getElementById('btnOpenSessions') as HTMLButtonElement;
const sessionsModal = document.getElementById('sessionsModal') as HTMLElement;
const sessionsList = document.getElementById('sessionsList') as HTMLElement;
const btnCloseSessions = document.getElementById('btnCloseSessions') as HTMLButtonElement;
const btnCloseSessionsModal = document.getElementById('btnCloseSessionsModal') as HTMLButtonElement;
const btnRevokeAllSessions = document.getElementById('btnRevokeAllSessions') as HTMLButtonElement;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  setupProjectBranding();
  setupOtpDigitInputs();
  setupEventListeners();

  // 1. Check if URL contains a Reset Password Token
  if (resetTokenParam) {
    showResetPasswordView(emailParam || '', resetTokenParam);
    return;
  }

  // 2. Check Magic Token in URL
  if (magicTokenFromUrl) {
    await handleMagicTokenVerification(magicTokenFromUrl);
    return;
  }

  // 3. Check existing active session
  const storedToken = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
  const storedUserJson = localStorage.getItem(CONFIG.USER_STORAGE_KEY);

  if (storedToken && storedUserJson) {
    try {
      const user: AuthUser = JSON.parse(storedUserJson);
      renderWorkspaceHub(user);
    } catch {
      localStorage.clear();
    }
  }
});

function showAlert(message: string, type: 'error' | 'success' | 'info' = 'error') {
  alertBox.className = `alert ${type}`;
  alertBox.textContent = message;
  alertBox.classList.remove('hidden');
}

function clearAlert() {
  alertBox.classList.add('hidden');
  alertBox.textContent = '';
}

function setupProjectBranding() {
  if (targetProjectKey && targetProjectKey !== 'rithamic_login') {
    const formatted = targetProjectKey.replace(/^rithamic_/, '').replace(/_/g, ' ').toUpperCase();
    brandTitle.textContent = `Sign in to ${formatted}`;
    brandSubtitle.textContent = `Centralized SSO Authentication for ${targetProjectKey}`;
  }
}

function switchTab(tab: 'password' | 'otp' | 'magic') {
  clearAlert();

  [tabPassword, tabOtp, tabMagic].forEach(btn => btn.classList.remove('active'));
  [passwordView, otpStep1View, otpStep2View, magicLinkView, forgotPasswordView, resetPasswordView].forEach(v => v.classList.add('hidden'));

  if (tab === 'password') {
    tabPassword.classList.add('active');
    passwordView.classList.remove('hidden');
    passwordEmailInput.focus();
  } else if (tab === 'otp') {
    tabOtp.classList.add('active');
    otpStep1View.classList.remove('hidden');
    otpEmailInput.focus();
  } else if (tab === 'magic') {
    tabMagic.classList.add('active');
    magicLinkView.classList.remove('hidden');
    magicEmailInput.focus();
  }
}

function showResetPasswordView(email: string, _token: string) {
  authTabs.classList.add('hidden');
  [passwordView, otpStep1View, otpStep2View, magicLinkView, forgotPasswordView].forEach(v => v.classList.add('hidden'));
  resetPasswordView.classList.remove('hidden');
  resetEmailInput.value = email;
  newPasswordInput.focus();
}

function setupOtpDigitInputs() {
  otpDigitInputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.value && idx < otpDigitInputs.length - 1) {
        otpDigitInputs[idx + 1].focus();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && idx > 0) {
        otpDigitInputs[idx - 1].focus();
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = e.clipboardData?.getData('text').trim() || '';
      if (/^\d{6}$/.test(pasteData)) {
        pasteData.split('').forEach((char, i) => {
          if (otpDigitInputs[i]) otpDigitInputs[i].value = char;
        });
        otpDigitInputs[5].focus();
      }
    });
  });
}

function setupEventListeners() {
  // Tab switching
  tabPassword.addEventListener('click', () => switchTab('password'));
  tabOtp.addEventListener('click', () => switchTab('otp'));
  tabMagic.addEventListener('click', () => switchTab('magic'));

  // Password Form Submit
  passwordLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();
    const email = passwordEmailInput.value.trim();
    const password = passwordInput.value;

    try {
      showAlert('Signing in...', 'info');
      const auth = await authService.loginWithPassword(targetProjectKey, email, password);
      handleSuccessfulAuth(auth);
    } catch (err: any) {
      showAlert(err.message || 'Login failed. Check your credentials.');
    }
  });

  // Forgot Password Trigger & Form
  btnTriggerForgot.addEventListener('click', (e) => {
    e.preventDefault();
    clearAlert();
    authTabs.classList.add('hidden');
    passwordView.classList.add('hidden');
    forgotPasswordView.classList.remove('hidden');
    forgotEmailInput.value = passwordEmailInput.value;
    forgotEmailInput.focus();
  });

  btnBackToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    authTabs.classList.remove('hidden');
    forgotPasswordView.classList.add('hidden');
    switchTab('password');
  });

  forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();
    const email = forgotEmailInput.value.trim();

    try {
      showAlert('Dispatching reset instructions...', 'info');
      await authService.forgotPassword(targetProjectKey, email);
      showAlert('If an account exists, a recovery link has been dispatched to your email.', 'success');
    } catch (err: any) {
      showAlert(err.message || 'Failed to dispatch reset email.');
    }
  });

  // Reset Password Form Submit
  resetPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();
    const email = resetEmailInput.value.trim();
    const newPass = newPasswordInput.value;
    const confirmPass = confirmPasswordInput.value;

    if (newPass !== confirmPass) {
      showAlert('Passwords do not match.');
      return;
    }

    try {
      showAlert('Updating password...', 'info');
      await authService.resetPassword(targetProjectKey, email, resetTokenParam || '', newPass);
      showAlert('Password updated successfully! Logging you in...', 'success');
      const auth = await authService.loginWithPassword(targetProjectKey, email, newPass);
      handleSuccessfulAuth(auth);
    } catch (err: any) {
      showAlert(err.message || 'Password reset token is invalid or expired.');
    }
  });

  // OTP Step 1 Form
  otpRequestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();
    currentEmail = otpEmailInput.value.trim();

    try {
      showAlert('Dispatching OTP code...', 'info');
      await authService.requestOtp(targetProjectKey, currentEmail);
      clearAlert();

      otpStep1View.classList.add('hidden');
      otpStep2View.classList.remove('hidden');
      sentEmailDisplay.textContent = currentEmail;
      startCooldownTimer(60);
      otpDigitInputs[0].focus();
    } catch (err: any) {
      showAlert(err.message || 'Failed to send OTP.');
    }
  });

  // OTP Step 2 Form
  otpVerifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();
    const otp = Array.from(otpDigitInputs).map(input => input.value).join('');

    if (otp.length !== 6) {
      showAlert('Please enter the complete 6-digit verification code.');
      return;
    }

    try {
      showAlert('Verifying passcode...', 'info');
      const auth = await authService.verifyOtp(targetProjectKey, currentEmail, otp);
      handleSuccessfulAuth(auth);
    } catch (err: any) {
      showAlert(err.message || 'Invalid or expired OTP passcode.');
    }
  });

  btnChangeEmail.addEventListener('click', () => {
    otpStep2View.classList.add('hidden');
    otpStep1View.classList.remove('hidden');
    otpEmailInput.focus();
    clearAlert();
  });

  resendOtpLink.addEventListener('click', async () => {
    if (resendOtpLink.classList.contains('disabled')) return;
    try {
      showAlert('Resending passcode...', 'info');
      await authService.requestOtp(targetProjectKey, currentEmail);
      showAlert('A fresh passcode has been sent.', 'success');
      startCooldownTimer(60);
    } catch (err: any) {
      showAlert(err.message || 'Failed to resend code.');
    }
  });

  // Magic Link Form
  magicLinkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();
    const email = magicEmailInput.value.trim();
    try {
      showAlert('Dispatching magic sign-in link...', 'info');
      await authService.requestMagicLink(targetProjectKey, email);
      showAlert('Magic link sent! Check your email inbox.', 'success');
    } catch (err: any) {
      showAlert(err.message || 'Failed to send magic link.');
    }
  });

  // Google OAuth
  btnGoogleLogin.addEventListener('click', async () => {
    try {
      showAlert('Connecting with Google...', 'info');
      const auth = await authService.loginWithGoogle(targetProjectKey, 'mock_google_id_token_2026');
      handleSuccessfulAuth(auth);
    } catch (err: any) {
      showAlert(err.message || 'Google authentication failed.');
    }
  });

  // Log out
  btnLogout.addEventListener('click', async () => {
    const refresh = localStorage.getItem(CONFIG.REFRESH_TOKEN_KEY);
    const token = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
    await authService.logoutSession(refresh, token);
    localStorage.clear();
    location.reload();
  });

  // Sessions Drawer
  btnOpenSessions.addEventListener('click', async () => {
    sessionsModal.classList.remove('hidden');
    await loadActiveSessions();
  });

  btnCloseSessions.addEventListener('click', () => sessionsModal.classList.add('hidden'));
  btnCloseSessionsModal.addEventListener('click', () => sessionsModal.classList.add('hidden'));

  btnRevokeAllSessions.addEventListener('click', async () => {
    const token = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
    if (!token) return;
    if (confirm('Terminate all other device logins?')) {
      await authService.revokeAllSessions(token);
      await loadActiveSessions();
    }
  });
}

function startCooldownTimer(seconds: number) {
  if (cooldownInterval) clearInterval(cooldownInterval);
  let remaining = seconds;
  resendOtpLink.classList.add('disabled');
  cooldownTimer.textContent = remaining.toString();

  cooldownInterval = window.setInterval(() => {
    remaining--;
    cooldownTimer.textContent = remaining.toString();
    if (remaining <= 0) {
      clearInterval(cooldownInterval!);
      resendOtpLink.classList.remove('disabled');
      resendOtpLink.textContent = 'Resend code now';
    }
  }, 1000);
}

function handleSuccessfulAuth(auth: AuthResponseDto) {
  localStorage.setItem(CONFIG.SESSION_STORAGE_KEY, auth.token);
  localStorage.setItem(CONFIG.REFRESH_TOKEN_KEY, auth.refreshToken);
  localStorage.setItem(CONFIG.SESSION_ID_KEY, auth.sessionId);
  localStorage.setItem(CONFIG.USER_STORAGE_KEY, JSON.stringify(auth.user));

  if (returnUrl) {
    window.location.href = returnUrl;
    return;
  }

  renderWorkspaceHub(auth.user);
}

async function handleMagicTokenVerification(token: string) {
  try {
    showAlert('Validating magic link...', 'info');
    const auth = await authService.verifyMagicLink(targetProjectKey, token);
    handleSuccessfulAuth(auth);
  } catch (err: any) {
    showAlert(err.message || 'Magic link verification failed.');
  }
}

async function renderWorkspaceHub(user: AuthUser) {
  authCard.classList.add('hidden');
  workspaceHubCard.classList.remove('hidden');

  userName.textContent = user.fullName || user.email;
  userEmail.textContent = user.email;
  userAvatar.textContent = (user.fullName || user.email).charAt(0).toUpperCase();

  const token = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
  if (!token) return;

  try {
    const apps = await authService.fetchWorkspaces(token);
    suitesContainer.innerHTML = '';

    if (apps.length === 0) {
      suitesContainer.innerHTML = `<p style="color: var(--text-dim); font-size: 13px;">No authorized applications found.</p>`;
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
          showAlert(`Generating SSO ticket for ${app.projectName}...`, 'info');
          const sso = await authService.generateSsoTicket(token, app.projectKey);
          window.location.href = sso.targetUrl;
        } catch (err: any) {
          showAlert(err.message || 'Failed to cross-launch project.');
        }
      });

      suitesContainer.appendChild(card);
    });
  } catch (err: any) {
    suitesContainer.innerHTML = `<p style="color: var(--danger); font-size: 13px;">${err.message}</p>`;
  }
}

async function loadActiveSessions() {
  const token = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
  if (!token) return;

  sessionsList.innerHTML = `<div class="loading-spinner"></div>`;

  try {
    const sessions: SessionItemDto[] = await authService.getActiveSessions(token);
    sessionsList.innerHTML = '';

    if (sessions.length === 0) {
      sessionsList.innerHTML = `<p style="color: var(--text-dim); font-size: 13px;">No active sessions found.</p>`;
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
          await authService.revokeSession(token, sess.sessionId);
          await loadActiveSessions();
        });
      }

      sessionsList.appendChild(item);
    });
  } catch (err: any) {
    sessionsList.innerHTML = `<p style="color: var(--danger); font-size: 13px;">${err.message}</p>`;
  }
}
