# Rithamic Login Hub (`rithamic-login`) — Comprehensive Architectural Report

---

## 1. Executive Summary & Overview

**`rithamic-login`** serves as the **Centralized Authentication & Identity Gateway** for the entire Rithamic product ecosystem. It provides single sign-on (SSO), multi-factor verification, password recovery, active device management, deep-linked application switching, and silent token bootstrapping.

- **Stack**: Pure **Vite 6.4 + TypeScript 5.7 + Vanilla CSS 3** (zero third-party UI framework bloat for instantaneous sub-second page loads).
- **Backend Service**: Directly integrated with the .NET 8 LTS Core Service (`rithamic-core-service`) via standard RESTful `/api/v1/*` contracts.
- **Security Posture**: 15-minute JWT access tokens, SHA-256 refresh tokens, multi-device revocation, Content Security Policy (CSP), ARIA accessibility, and single-use 60-second cross-app SSO exchange tickets with RelayState.

---

## 2. Modular Architecture & View Controllers

To eliminate monolithic controller anti-patterns, the frontend logic is decomposed into dedicated view controllers and reusable components:

```
src/
├── components/
│   ├── AlertBanner.ts          # ARIA live region (role="status" aria-live="polite") alert coordinator
│   └── DeviceDrawer.ts         # Active sessions modal with keyboard trapping & scroll locking
├── views/
│   ├── PasswordView.ts         # Password login, forgot password modal & token reset flow
│   ├── OtpView.ts              # 6-digit OTP engine with mobile autofill & timestamp cooldown
│   ├── MagicLinkView.ts        # Passwordless magic link request & URL token verification
│   └── WorkspaceView.ts        # Workspace discovery & SSO launcher with RelayState/deep-linking
├── services/
│   ├── authService.ts          # Strongly typed client for all 14 backend Auth API v1 endpoints
│   └── telemetryService.ts     # Asynchronous metrics event streaming (POST /api/v1/metrics/events)
├── config/
│   └── index.ts                # Environment configuration (localhost:5000 / api.rithamic.co.in)
├── types/
│   └── index.ts                # TypeScript DTOs (AuthResponseDto, User, Session, App)
└── app.ts                      # Central orchestrator & silent bootstrap lifecycle manager
```

---

## 3. Critical Security & State-Management Safeguards

### A. Silent Token Bootstrapping on Page Load
- **The Problem**: Relying purely on volatile JavaScript state causes hard page refreshes (F5) to log users out, while storing raw long-lived tokens in browser storage exposes them to XSS attacks.
- **The Solution**: On startup, `app.ts` executes `performSilentBootstrap()`:
  - If a `refreshToken` exists, it triggers `POST /api/v1/auth/refresh` to obtain a fresh 15-minute access token and updated user claims.
  - If the refresh token is invalid or expired, storage is cleanly flushed and the user is presented with the sign-in form.

### B. SSO Deep Linking & RelayState Preservation
- **The Problem**: Standard SSO redirects drop target URL parameters and deep nested routes.
- **The Solution**: Both `WorkspaceView.ts` and the backend `SsoService.cs` accept and forward a `returnUrl` / `relayState` parameter:
  ```json
  POST /api/v1/auth/sso/generate-ticket
  { "targetProject": "rithamic_pos", "returnUrl": "/billing/table-4" }
  ```
  The resulting redirect URL contains `https://pos.rithamic.co.in/sso-callback?ticket=sso_...&returnUrl=%2Fbilling%2Ftable-4`, ensuring zero loss of navigation intent.

### C. Mobile Keyboard OTP Autofill Synchronization
- **The Problem**: Mobile OS autofill (iOS QuickType / Android SMS Autofill) injects the full 6-digit passcode into the first focused input box without firing a paste event.
- **The Solution**: `OtpView.ts` listens for `input` events: when `e.target.value.length > 1`, it slices `val.replace(/\D/g, '').slice(0, 6)`, distributes digits 0–5 across all inputs, and focuses the final digit box. Inputs include `autocomplete="one-time-code"`.

### D. Absolute Timestamp Cooldown Timer
- **The Problem**: In-memory `setInterval` timers pause or reset when users switch browser tabs or reload the page.
- **The Solution**: `OtpView.ts` stores the expiration timestamp in `sessionStorage` (`Date.now() + 60000`). When returning to the tab or upon page reload, the remaining seconds are calculated accurately from wall-clock time.

### E. Active Devices Drawer & Accessibility Safeguards
- **Keyboard Trapping**: Tab navigation is constrained within `DeviceDrawer.ts` when open.
- **Escape Key & Scroll Lock**: Pressing Escape closes the drawer, restores focus to the trigger button, and disables background body scrolling (`document.body.style.overflow = 'hidden'`).
- **ARIA Live Regions**: Error and success banners are rendered inside `<div role="status" aria-live="polite">` so screen readers announce server messages.

---

## 4. Authentication Modalities Implemented

| Modality | Endpoint(s) | Features & Safeguards |
| :--- | :--- | :--- |
| **Password Auth** | `POST /api/v1/auth/{projectKey}/login` | Standard login with `autocomplete="current-password"`. |
| **Forgot Password** | `POST /api/v1/auth/{projectKey}/password/forgot` | Self-service recovery dispatching signed reset tokens. |
| **Reset Password** | `POST /api/v1/auth/{projectKey}/password/reset` | Reads `?token=` and `?email=` from URL query string. |
| **6-Digit OTP** | `POST /api/v1/auth/{projectKey}/otp/request` & `verify` | Mobile SMS autofill, auto-advance, backspace navigation, paste support. |
| **Magic Link** | `POST /api/v1/auth/{projectKey}/magic-link/request` & `verify` | Passwordless sign-in with automatic token consumption. |
| **Google OAuth2** | `POST /api/v1/auth/oauth/google` | Single-tap Google sign-in with network blocker fallback. |

---

## 5. Build & Runtime Performance

- **Production Bundle**:
  - `dist/index.html`: `13.92 kB` (Gzip: `3.77 kB`)
  - `dist/assets/index.css`: `9.06 kB` (Gzip: `2.54 kB`)
  - `dist/assets/index.js`: `25.88 kB` (Gzip: `6.53 kB`)
- **Build Time**: **932 ms**
- **Repository Link**: `https://github.com/GowthamThangamani/rithamic-login`
