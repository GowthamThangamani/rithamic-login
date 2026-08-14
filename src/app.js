import { CONFIG } from './config.js';

// DOM Elements
const appContainer = document.getElementById('appContainer');
const authCard = document.getElementById('authCard');
const workspaceHubCard = document.getElementById('workspaceHubCard');
const alertBox = document.getElementById('alertBox');
const brandTitle = document.getElementById('brandTitle');
const brandSubtitle = document.getElementById('brandSubtitle');

// Tabs
const authTabs = document.getElementById('authTabs');
const tabOtp = document.getElementById('tabOtp');
const tabMagic = document.getElementById('tabMagic');

// Views
const otpStep1View = document.getElementById('otpStep1View');
const otpStep2View = document.getElementById('otpStep2View');
const magicLinkView = document.getElementById('magicLinkView');

// Inputs & Forms
const otpRequestForm = document.getElementById('otpRequestForm');
const otpEmailInput = document.getElementById('otpEmailInput');
const btnSendOtp = document.getElementById('btnSendOtp');
const otpVerifyForm = document.getElementById('otpVerifyForm');
const otpDigitInputs = document.querySelectorAll('.otp-digit');
const sentEmailDisplay = document.getElementById('sentEmailDisplay');
const resendOtpLink = document.getElementById('resendOtpLink');
const cooldownTimer = document.getElementById('cooldownTimer');
const btnChangeEmail = document.getElementById('btnChangeEmail');
const magicLinkForm = document.getElementById('magicLinkForm');
const magicEmailInput = document.getElementById('magicEmailInput');
const btnGoogleLogin = document.getElementById('btnGoogleLogin');
const btnLogout = document.getElementById('btnLogout');

// State
const urlParams = new URLSearchParams(window.location.search);
const targetProjectKey = urlParams.get('project') || CONFIG.DEFAULT_PROJECT_KEY;
const returnUrl = urlParams.get('returnUrl');
const magicTokenFromUrl = urlParams.get('magicToken');

let currentEmail = '';
let cooldownInterval = null;

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
      const user = JSON.parse(storedUser);
      // If returnUrl is present, transition via SSO immediately!
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

// Setup Project Title & Context
function setupProjectBranding() {
  if (targetProjectKey && targetProjectKey !== CONFIG.DEFAULT_PROJECT_KEY) {
    const formattedName = targetProjectKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    brandTitle.textContent = `Sign in to ${formattedName}`;
    brandSubtitle.textContent = `You will be redirected back to ${formattedName} upon authentication.`;
  }
}

// Event Listeners
function setupEventListeners() {
  // Tabs
  tabOtp.addEventListener('click', () => switchTab('otp'));
  tabMagic.addEventListener('click', () => switchTab('magic'));

  // OTP Step 1: Request Code
  otpRequestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = otpEmailInput.value.trim().toLowerCase();
    if (!email) return;
    await requestOtpCode(email);
  });

  // OTP Step 2: Verify Code
  otpVerifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const otp = getEnteredOtp();
    if (otp.length !== 6) {
      showAlert('Please enter all 6 digits of the verification code.', 'error');
      return;
    }
    await verifyOtpCode(currentEmail, otp);
  });

  // Change Email Button
  btnChangeEmail.addEventListener('click', () => {
    otpStep2View.classList.add('hidden');
    otpStep1View.classList.remove('hidden');
    otpEmailInput.focus();
    clearInterval(cooldownInterval);
  });

  // Resend Link
  resendOtpLink.addEventListener('click', async (e) => {
    e.preventDefault();
    if (resendOtpLink.classList.contains('disabled')) return;
    await requestOtpCode(currentEmail);
  });

  // Magic Link Form
  magicLinkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = magicEmailInput.value.trim().toLowerCase();
    if (!email) return;
    await requestMagicLink(email);
  });

  // Google Login Button (Demo / Real OAuth ID Token)
  btnGoogleLogin.addEventListener('click', async () => {
    showAlert('Connecting to Google identity service...', 'success');
    // Prompt or use mock ID token for seamless testing
    const mockEmail = prompt("Enter your Google Account email for testing:", currentEmail || "gowtham@rithamic.co.in");
    if (!mockEmail) return;

    // Simulate Google Sign-In
    const dummyIdToken = btoa(JSON.stringify({ email: mockEmail, name: mockEmail.split('@')[0] }));
    await authenticateWithGoogle(dummyIdToken, mockEmail);
  });

  // Logout
  btnLogout.addEventListener('click', async () => {
    const token = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
    if (token) {
      try {
        await fetch(`${CONFIG.API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch {}
    }
    localStorage.removeItem(CONFIG.SESSION_STORAGE_KEY);
    localStorage.removeItem(CONFIG.USER_STORAGE_KEY);
    window.location.reload();
  });
}

// Switch Auth Tabs
function switchTab(tab) {
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

// Setup 6 discrete OTP boxes
function setupOtpDigitInputs() {
  otpDigitInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val.length === 1 && index < otpDigitInputs.length - 1) {
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
      const pastedData = (e.clipboardData || window.clipboardData).getData('text').trim();
      if (/^\d{6}$/.test(pastedData)) {
        pastedData.split('').forEach((char, i) => {
          if (otpDigitInputs[i]) otpDigitInputs[i].value = char;
        });
        otpDigitInputs[5].focus();
      }
    });
  });
}

function getEnteredOtp() {
  let otp = '';
  otpDigitInputs.forEach(input => otp += input.value.trim());
  return otp;
}

function clearOtpInputs() {
  otpDigitInputs.forEach(input => input.value = '');
  if (otpDigitInputs[0]) otpDigitInputs[0].focus();
}

// Request OTP API Call
async function requestOtpCode(email) {
  btnSendOtp.disabled = true;
  btnSendOtp.innerHTML = '<span>Sending code...</span>';

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/auth/${targetProjectKey}/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: email, channel: 'email', purpose: 'login' })
    });

    const data = await res.json();

    if (!res.ok) {
      showAlert(data.error || 'Failed to send OTP code.', 'error');
      btnSendOtp.disabled = false;
      btnSendOtp.innerHTML = '<span>Continue with Email</span>';
      return;
    }

    currentEmail = email;
    sentEmailDisplay.textContent = email;
    otpStep1View.classList.add('hidden');
    otpStep2View.classList.remove('hidden');
    clearOtpInputs();
    startCooldownTimer(data.cooldownSeconds || 60);
    showAlert(`Verification code sent to ${email}`, 'success');
  } catch (err) {
    showAlert('Could not connect to backend server. Make sure API is running on localhost:3000.', 'error');
  } finally {
    btnSendOtp.disabled = false;
    btnSendOtp.innerHTML = '<span>Continue with Email</span>';
  }
}

// Verify OTP API Call
async function verifyOtpCode(email, otp) {
  const btnVerify = document.getElementById('btnVerifyOtp');
  btnVerify.disabled = true;
  btnVerify.innerHTML = '<span>Verifying...</span>';

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/auth/${targetProjectKey}/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: email, otp })
    });

    const data = await res.json();

    if (!res.ok) {
      showAlert(data.error || 'Invalid verification code.', 'error');
      clearOtpInputs();
      return;
    }

    // Save Session
    localStorage.setItem(CONFIG.SESSION_STORAGE_KEY, data.token);
    localStorage.setItem(CONFIG.USER_STORAGE_KEY, JSON.stringify(data.user));

    showAlert('Verification successful! Authenticating...', 'success');

    // Handle return URL redirect with SSO ticket OR switch to Hub
    if (returnUrl) {
      await handleSsoRedirect(data.token, data.user);
    } else {
      setTimeout(() => showWorkspaceHub(data.user), 600);
    }
  } catch (err) {
    showAlert('Error verifying OTP code.', 'error');
  } finally {
    btnVerify.disabled = false;
    btnVerify.innerHTML = '<span>Verify & Sign In</span>';
  }
}

// Authenticate via Google
async function authenticateWithGoogle(idToken, email) {
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/auth/oauth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectKey: targetProjectKey, idToken })
    });
    const data = await res.json();

    if (!res.ok) {
      showAlert(data.error || 'Google authentication failed.', 'error');
      return;
    }

    localStorage.setItem(CONFIG.SESSION_STORAGE_KEY, data.token);
    localStorage.setItem(CONFIG.USER_STORAGE_KEY, JSON.stringify(data.user));

    if (returnUrl) {
      await handleSsoRedirect(data.token, data.user);
    } else {
      showWorkspaceHub(data.user);
    }
  } catch (err) {
    showAlert('Failed to connect to Google OAuth service.', 'error');
  }
}

// Request Magic Link
async function requestMagicLink(email) {
  const btn = document.getElementById('btnSendMagicLink');
  btn.disabled = true;
  btn.innerHTML = '<span>Sending link...</span>';

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/auth/${targetProjectKey}/magic-link/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: email, returnUrl: returnUrl || window.location.href })
    });
    const data = await res.json();

    if (!res.ok) {
      showAlert(data.error || 'Failed to send magic link.', 'error');
      return;
    }

    showAlert(`Magic link dispatched to ${email}! Check your inbox.`, 'success');
  } catch (err) {
    showAlert('Error requesting magic login link.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Send Magic Sign-In Link</span>';
  }
}

// Verify Magic Token
async function handleMagicTokenVerification(token) {
  showAlert('Verifying magic login link...', 'success');
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/auth/${targetProjectKey}/magic-link/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();

    if (!res.ok) {
      showAlert(data.error || 'Magic link is invalid or expired.', 'error');
      return;
    }

    localStorage.setItem(CONFIG.SESSION_STORAGE_KEY, data.token);
    localStorage.setItem(CONFIG.USER_STORAGE_KEY, JSON.stringify(data.user));

    if (data.returnUrl && data.returnUrl !== window.location.href) {
      window.location.href = data.returnUrl;
    } else {
      showWorkspaceHub(data.user);
    }
  } catch (err) {
    showAlert('Failed to verify magic link.', 'error');
  }
}

// SSO Ticket Exchange & Return Redirect
async function handleSsoRedirect(userToken, user) {
  try {
    // Generate 60-second SSO Ticket for the target project
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/auth/sso/generate-ticket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({ targetProjectKey })
    });

    const data = await res.json();

    if (res.ok && data.ticket) {
      const redirectSeparator = returnUrl.includes('?') ? '&' : '?';
      const destination = `${returnUrl}${redirectSeparator}ticket=${encodeURIComponent(data.ticket)}&token=${encodeURIComponent(userToken)}`;
      showAlert(`Redirecting to ${targetProjectKey}...`, 'success');
      setTimeout(() => {
        window.location.href = destination;
      }, 500);
    } else {
      // Fallback directly with token
      const redirectSeparator = returnUrl.includes('?') ? '&' : '?';
      window.location.href = `${returnUrl}${redirectSeparator}token=${encodeURIComponent(userToken)}`;
    }
  } catch (err) {
    window.location.href = `${returnUrl}?token=${encodeURIComponent(userToken)}`;
  }
}

// Workspace Hub View (App Switcher)
async function showWorkspaceHub(user) {
  authCard.classList.add('hidden');
  workspaceHubCard.classList.remove('hidden');
  appContainer.classList.add('wide');

  document.getElementById('userName').textContent = user.fullName || user.email.split('@')[0];
  document.getElementById('userEmail').textContent = user.email;
  document.getElementById('userAvatar').textContent = (user.fullName || user.email)[0].toUpperCase();

  const token = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
  if (!token) return;

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/auth/hub/workspaces`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    renderWorkspaces(data);
  } catch (err) {
    showAlert('Failed to load workspaces.', 'error');
  }
}

function renderWorkspaces(data) {
  const suitesContainer = document.getElementById('suitesContainer');
  const standaloneContainer = document.getElementById('standaloneContainer');
  suitesContainer.innerHTML = '';
  standaloneContainer.innerHTML = '';

  // Render Product Suites
  if (data.suites && data.suites.length > 0) {
    data.suites.forEach(suite => {
      const suiteSection = document.createElement('div');
      suiteSection.innerHTML = `
        <div class="hub-section-title">
          <span>📦 ${suite.suiteName}</span>
          <span class="suite-badge">Product Suite</span>
        </div>
        <div class="app-grid" id="suite_${suite.suiteKey}"></div>
      `;
      suitesContainer.appendChild(suiteSection);

      const grid = suiteSection.querySelector(`#suite_${suite.suiteKey}`);
      suite.apps.forEach(app => {
        const card = createAppCard(app);
        grid.appendChild(card);
      });
    });
  }

  // Render Standalone Portals
  if (data.standalone && data.standalone.length > 0) {
    const standaloneSection = document.createElement('div');
    standaloneSection.innerHTML = `
      <div class="hub-section-title">
        <span>🔒 Standalone Portals</span>
      </div>
      <div class="app-grid" id="standaloneGrid"></div>
    `;
    standaloneContainer.appendChild(standaloneSection);

    const grid = standaloneSection.querySelector('#standaloneGrid');
    data.standalone.forEach(app => {
      const card = createAppCard(app);
      grid.appendChild(card);
    });
  }
}

function createAppCard(app) {
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

  card.querySelector('.btn-launch').addEventListener('click', async () => {
    const token = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
    const user = JSON.parse(localStorage.getItem(CONFIG.USER_STORAGE_KEY) || '{}');
    const launchUrl = app.launchUrl || `http://localhost:5173`;

    // Launch with SSO ticket
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/api/auth/sso/generate-ticket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetProjectKey: app.projectKey })
      });
      const ticketData = await res.json();
      if (res.ok && ticketData.ticket) {
        const sep = launchUrl.includes('?') ? '&' : '?';
        window.location.href = `${launchUrl}${sep}ticket=${encodeURIComponent(ticketData.ticket)}`;
      } else {
        window.location.href = launchUrl;
      }
    } catch {
      window.location.href = launchUrl;
    }
  });

  return card;
}

// Cooldown Timer
function startCooldownTimer(seconds) {
  let remaining = seconds;
  resendOtpLink.classList.add('disabled');
  cooldownTimer.textContent = remaining;

  clearInterval(cooldownInterval);
  cooldownInterval = setInterval(() => {
    remaining -= 1;
    cooldownTimer.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(cooldownInterval);
      resendOtpLink.classList.remove('disabled');
      resendOtpLink.textContent = 'Resend code now';
    }
  }, 1000);
}

// Alert Helper
function showAlert(message, type = 'error') {
  alertBox.textContent = message;
  alertBox.className = `alert alert-${type}`;
  alertBox.classList.remove('hidden');

  if (type === 'success') {
    setTimeout(() => alertBox.classList.add('hidden'), 5000);
  }
}
