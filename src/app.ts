import { CONFIG } from './config/index.ts';
import { AuthUser, ProductSuite, WorkspaceApp } from './types/index.ts';
import * as authService from './services/authService.ts';

// DOM Elements
const appContainer = document.getElementById('appContainer') as HTMLElement;
const authCard = document.getElementById('authCard') as HTMLElement;
const workspaceHubCard = document.getElementById('workspaceHubCard') as HTMLElement;
const alertBox = document.getElementById('alertBox') as HTMLElement;
const brandTitle = document.getElementById('brandTitle') as HTMLElement;
const brandSubtitle = document.getElementById('brandSubtitle') as HTMLElement;

// Tabs
const tabOtp = document.getElementById('tabOtp') as HTMLButtonElement;
const tabMagic = document.getElementById('tabMagic') as HTMLButtonElement;

// Views
const otpStep1View = document.getElementById('otpStep1View') as HTMLElement;
const otpStep2View = document.getElementById('otpStep2View') as HTMLElement;
const magicLinkView = document.getElementById('magicLinkView') as HTMLElement;

// Inputs & Forms
const otpRequestForm = document.getElementById('otpRequestForm') as HTMLFormElement;
const otpEmailInput = document.getElementById('otpEmailInput') as HTMLInputElement;
const btnSendOtp = document.getElementById('btnSendOtp') as HTMLButtonElement;
const otpVerifyForm = document.getElementById('otpVerifyForm') as HTMLFormElement;
const otpDigitInputs = document.querySelectorAll<HTMLInputElement>('.otp-digit');
const sentEmailDisplay = document.getElementById('sentEmailDisplay') as HTMLElement;
const resendOtpLink = document.getElementById('resendOtpLink') as HTMLAnchorElement;
const cooldownTimer = document.getElementById('cooldownTimer') as HTMLElement;
const btnChangeEmail = document.getElementById('btnChangeEmail') as HTMLButtonElement;
const magicLinkForm = document.getElementById('magicLinkForm') as HTMLFormElement;
const magicEmailInput = document.getElementById('magicEmailInput') as HTMLInputElement;
const btnGoogleLogin = document.getElementById('btnGoogleLogin') as HTMLButtonElement;
const btnLogout = document.getElementById('btnLogout') as HTMLButtonElement;

// State
const urlParams = new URLSearchParams(window.location.search);
const targetProjectKey = urlParams.get('project') || CONFIG.DEFAULT_PROJECT_KEY;
const returnUrl = urlParams.get('returnUrl');
const magicTokenFromUrl = urlParams.get('magicToken');

let currentEmail = '';
let cooldownInterval: number | null = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  setupProjectBranding();
  setupOtpDigitInputs();
  setupEventListeners();

  // Check Magic Token in URL
  if (magicTokenFromUrl) {
    await handleMagicTokenVerification(magicTokenFromUrl);
    return;
  }

  // Check existing session
  const storedToken = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
  const storedUser = localStorage.getItem(CONFIG.USER_STORAGE_KEY);

  if (storedToken && storedUser) {
    try {
      const user: AuthUser = JSON.parse(storedUser);
      if (returnUrl) {
        await handleSsoRedirect(storedToken, user);
      } else {
        showWorkspaceHub(user);
      }
    } catch {
      localStorage.removeItem(CONFIG.SESSION_STORAGE_KEY);
      localStorage.removeItem(CONFIG.USER_STORAGE_KEY);
    }
  }
});

function setupProjectBranding() {
  if (targetProjectKey && targetProjectKey !== CONFIG.DEFAULT_PROJECT_KEY) {
    const formattedName = targetProjectKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    brandTitle.textContent = `Sign in to ${formattedName}`;
    brandSubtitle.textContent = `You will be redirected back to ${formattedName} upon authentication.`;
  }
}

function setupEventListeners() {
  tabOtp.addEventListener('click', () => switchTab('otp'));
  tabMagic.addEventListener('click', () => switchTab('magic'));

  otpRequestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = otpEmailInput.value.trim().toLowerCase();
    if (!email) return;
    await handleRequestOtp(email);
  });

  otpVerifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const otp = getEnteredOtp();
    if (otp.length !== 6) {
      showAlert('Please enter all 6 digits of the verification code.', 'error');
      return;
    }
    await handleVerifyOtp(currentEmail, otp);
  });

  btnChangeEmail.addEventListener('click', () => {
    otpStep2View.classList.add('hidden');
    otpStep1View.classList.remove('hidden');
    otpEmailInput.focus();
    if (cooldownInterval) clearInterval(cooldownInterval);
  });

  resendOtpLink.addEventListener('click', async (e) => {
    e.preventDefault();
    if (resendOtpLink.classList.contains('disabled')) return;
    await handleRequestOtp(currentEmail);
  });

  magicLinkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = magicEmailInput.value.trim().toLowerCase();
    if (!email) return;
    await handleMagicLinkRequest(email);
  });

  btnGoogleLogin.addEventListener('click', async () => {
    const mockEmail = prompt("Enter your Google Account email for testing:", currentEmail || "gowtham@rithamic.co.in");
    if (!mockEmail) return;

    try {
      const dummyIdToken = btoa(JSON.stringify({ email: mockEmail, name: mockEmail.split('@')[0] }));
      const authData = await authService.loginWithGoogle(targetProjectKey, dummyIdToken);
      handleSuccessfulAuth(authData.token, authData.user);
    } catch (err: any) {
      showAlert(err.message || 'Google authentication failed.', 'error');
    }
  });

  btnLogout.addEventListener('click', async () => {
    const token = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
    if (token) {
      await authService.logoutSession(token);
    }
    localStorage.removeItem(CONFIG.SESSION_STORAGE_KEY);
    localStorage.removeItem(CONFIG.USER_STORAGE_KEY);
    window.location.reload();
  });
}

function switchTab(tab: 'otp' | 'magic') {
  if (tab === 'otp') {
    tabOtp.classList.add('active');
    tabMagic.classList.remove('active');
    magicLinkView.classList.add('hidden');
    if (currentEmail && !otpStep2View.classList.contains('hidden')) {
      otpStep2View.classList.remove('hidden');
    } else {
      otpStep1View.classList.remove('hidden');
    }
  } else {
    tabMagic.classList.add('active');
    tabOtp.classList.remove('active');
    otpStep1View.classList.add('hidden');
    otpStep2View.classList.add('hidden');
    magicLinkView.classList.remove('hidden');
    magicEmailInput.value = otpEmailInput.value;
  }
}

function setupOtpDigitInputs() {
  otpDigitInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.value.length === 1 && index < otpDigitInputs.length - 1) {
        otpDigitInputs[index + 1].focus();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        otpDigitInputs[index - 1].focus();
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pastedData = (e.clipboardData || (window as any).clipboardData)?.getData('text')?.trim();
      if (pastedData && /^\d{6}$/.test(pastedData)) {
        pastedData.split('').forEach((char: string, i: number) => {
          if (otpDigitInputs[i]) otpDigitInputs[i].value = char;
        });
        otpDigitInputs[5].focus();
      }
    });
  });
}

function getEnteredOtp(): string {
  let otp = '';
  otpDigitInputs.forEach(input => otp += input.value.trim());
  return otp;
}

function clearOtpInputs() {
  otpDigitInputs.forEach(input => input.value = '');
  if (otpDigitInputs[0]) otpDigitInputs[0].focus();
}

async function handleRequestOtp(email: string) {
  btnSendOtp.disabled = true;
  btnSendOtp.innerHTML = '<span>Sending code...</span>';

  try {
    const data = await authService.requestOtp(targetProjectKey, email);
    currentEmail = email;
    sentEmailDisplay.textContent = email;
    otpStep1View.classList.add('hidden');
    otpStep2View.classList.remove('hidden');
    clearOtpInputs();
    startCooldownTimer(data.cooldownSeconds || 60);
    if (data.devOtp) { showAlert(`Verification code: ${data.devOtp} (Local Dev Mode)`, "success"); } else { showAlert(`Verification code sent to ${email}`, "success"); }
  } catch (err: any) {
    showAlert(err.message || 'Failed to send OTP code.', 'error');
  } finally {
    btnSendOtp.disabled = false;
    btnSendOtp.innerHTML = '<span>Continue with Email</span>';
  }
}

async function handleVerifyOtp(email: string, otp: string) {
  const btnVerify = document.getElementById('btnVerifyOtp') as HTMLButtonElement;
  btnVerify.disabled = true;
  btnVerify.innerHTML = '<span>Verifying...</span>';

  try {
    const data = await authService.verifyOtp(targetProjectKey, email, otp);
    handleSuccessfulAuth(data.token, data.user);
  } catch (err: any) {
    showAlert(err.message || 'Invalid verification code.', 'error');
    clearOtpInputs();
  } finally {
    btnVerify.disabled = false;
    btnVerify.innerHTML = '<span>Verify & Sign In</span>';
  }
}

async function handleMagicLinkRequest(email: string) {
  const btn = document.getElementById('btnSendMagicLink') as HTMLButtonElement;
  btn.disabled = true;
  btn.innerHTML = '<span>Sending link...</span>';

  try {
    await authService.requestMagicLink(targetProjectKey, email, returnUrl || window.location.href);
    showAlert(`Magic sign-in link dispatched to ${email}! Check your inbox.`, 'success');
  } catch (err: any) {
    showAlert(err.message || 'Failed to send magic link.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Send Magic Sign-In Link</span>';
  }
}

async function handleMagicTokenVerification(token: string) {
  showAlert('Verifying magic login link...', 'success');
  try {
    const data = await authService.verifyMagicLink(targetProjectKey, token);
    handleSuccessfulAuth(data.token, data.user);
  } catch (err: any) {
    showAlert(err.message || 'Magic link is invalid or expired.', 'error');
  }
}

async function handleSuccessfulAuth(token: string, user: AuthUser) {
  localStorage.setItem(CONFIG.SESSION_STORAGE_KEY, token);
  localStorage.setItem(CONFIG.USER_STORAGE_KEY, JSON.stringify(user));
  showAlert('Authenticated successfully!', 'success');

  if (returnUrl) {
    await handleSsoRedirect(token, user);
  } else {
    setTimeout(() => showWorkspaceHub(user), 600);
  }
}

async function handleSsoRedirect(userToken: string, _user: AuthUser) {
  if (!returnUrl) return;
  try {
    const data = await authService.generateSsoTicket(userToken, targetProjectKey);
    const redirectSeparator = returnUrl.includes('?') ? '&' : '?';
    const destination = `${returnUrl}${redirectSeparator}ticket=${encodeURIComponent(data.ticket)}&token=${encodeURIComponent(userToken)}`;
    showAlert(`Redirecting to ${targetProjectKey}...`, 'success');
    setTimeout(() => {
      window.location.href = destination;
    }, 500);
  } catch {
    const redirectSeparator = returnUrl.includes('?') ? '&' : '?';
    window.location.href = `${returnUrl}${redirectSeparator}token=${encodeURIComponent(userToken)}`;
  }
}

async function showWorkspaceHub(user: AuthUser) {
  authCard.classList.add('hidden');
  workspaceHubCard.classList.remove('hidden');
  appContainer.classList.add('wide');

  (document.getElementById('userName') as HTMLElement).textContent = user.fullName || user.email.split('@')[0];
  (document.getElementById('userEmail') as HTMLElement).textContent = user.email;
  (document.getElementById('userAvatar') as HTMLElement).textContent = (user.fullName || user.email)[0].toUpperCase();

  const token = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
  if (!token) return;

  try {
    const data = await authService.fetchWorkspaces(token);
    renderWorkspaces(data.suites, data.standalone);
  } catch {
    showAlert('Failed to load workspaces.', 'error');
  }
}

function renderWorkspaces(suites: ProductSuite[], standalone: WorkspaceApp[]) {
  const suitesContainer = document.getElementById('suitesContainer') as HTMLElement;
  const standaloneContainer = document.getElementById('standaloneContainer') as HTMLElement;
  suitesContainer.innerHTML = '';
  standaloneContainer.innerHTML = '';

  if (suites && suites.length > 0) {
    suites.forEach(suite => {
      const suiteSection = document.createElement('div');
      suiteSection.innerHTML = `
        <div class="hub-section-title">
          <span>📦 ${suite.suiteName}</span>
          <span class="suite-badge">Product Suite</span>
        </div>
        <div class="app-grid" id="suite_${suite.suiteKey}"></div>
      `;
      suitesContainer.appendChild(suiteSection);

      const grid = suiteSection.querySelector(`#suite_${suite.suiteKey}`) as HTMLElement;
      suite.apps.forEach(app => {
        const card = createAppCard(app);
        grid.appendChild(card);
      });
    });
  }

  if (standalone && standalone.length > 0) {
    const standaloneSection = document.createElement('div');
    standaloneSection.innerHTML = `
      <div class="hub-section-title">
        <span>🔒 Standalone Portals</span>
      </div>
      <div class="app-grid" id="standaloneGrid"></div>
    `;
    standaloneContainer.appendChild(standaloneSection);

    const grid = standaloneSection.querySelector('#standaloneGrid') as HTMLElement;
    standalone.forEach(app => {
      const card = createAppCard(app);
      grid.appendChild(card);
    });
  }
}

function createAppCard(app: WorkspaceApp): HTMLElement {
  const card = document.createElement('div');
  card.className = 'app-card';
  card.innerHTML = `
    <div>
      <div class="app-card-header">
        <div class="app-icon">⚡</div>
        <div>
          <div class="app-name">${app.name}</div>
          <span class="app-role-tag">${app.role}</span>
        </div>
      </div>
      <p style="font-size: 12px; color: #64748b;">Key: ${app.projectKey}</p>
    </div>
    <button class="btn-launch" data-project="${app.projectKey}" data-url="${app.launchUrl || ''}">
      <span>Open Workspace</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="7" y1="17" x2="17" y2="7"></line>
        <polyline points="7 7 17 7 17 17"></polyline>
      </svg>
    </button>
  `;

  card.querySelector('.btn-launch')?.addEventListener('click', async () => {
    const token = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
    const launchUrl = app.launchUrl || `http://localhost:5173`;

    if (token) {
      try {
        const ticketData = await authService.generateSsoTicket(token, app.projectKey);
        const sep = launchUrl.includes('?') ? '&' : '?';
        window.location.href = `${launchUrl}${sep}ticket=${encodeURIComponent(ticketData.ticket)}`;
        return;
      } catch {}
    }
    window.location.href = launchUrl;
  });

  return card;
}

function startCooldownTimer(seconds: number) {
  let remaining = seconds;
  resendOtpLink.classList.add('disabled');
  cooldownTimer.textContent = String(remaining);

  if (cooldownInterval) clearInterval(cooldownInterval);
  cooldownInterval = window.setInterval(() => {
    remaining -= 1;
    cooldownTimer.textContent = String(remaining);
    if (remaining <= 0) {
      if (cooldownInterval) clearInterval(cooldownInterval);
      resendOtpLink.classList.remove('disabled');
      resendOtpLink.textContent = 'Resend code now';
    }
  }, 1000);
}

function showAlert(message: string, type: 'error' | 'success' = 'error') {
  alertBox.textContent = message;
  alertBox.className = `alert alert-${type}`;
  alertBox.classList.remove('hidden');

  if (type === 'success') {
    setTimeout(() => alertBox.classList.add('hidden'), 5000);
  }
}
