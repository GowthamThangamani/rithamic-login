# Rithamic Login Hub (`rithamic-login`) — Comprehensive Architectural Report

---

## 1. Executive Summary & Overview

**`rithamic-login`** serves as the **Centralized Authentication & Identity Gateway** for the entire Rithamic product ecosystem. It provides single sign-on (SSO), multi-factor verification, password recovery, active device management, and workspace application switching.

- **Stack**: Pure **Vite 6.4 + TypeScript 5.7 + Vanilla CSS 3** (zero-dependency UI architecture for sub-second page loads).
- **Backend Service**: Directly integrated with the .NET 8 LTS Core Service (`rithamic-core-service`) via standard RESTful `/api/v1/*` contracts.
- **Security Posture**: 15-minute JWT access tokens, SHA-256 refresh tokens, multi-device revocation, Content Security Policy (CSP), and single-use 60-second cross-app SSO exchange tickets.

---

## 2. Authentication Modalities Implemented

### A. Password Authentication & Recovery
1. **Interactive Password Login**:
   - Captures user email and secret password with inline validation.
   - Dispatches to `POST /api/v1/auth/{projectKey}/login`.
   - On success, stores the JWT `token`, `refreshToken`, `sessionId`, and `user` profile in secure local state.
2. **Self-Service Forgot Password**:
   - User triggers "Forgot password?", entering their registered email.
   - Dispatches to `POST /api/v1/auth/{projectKey}/password/forgot` to trigger time-limited reset tokens.
3. **URL Token Password Reset View**:
   - Detects `?token=xyz&email=abc` in the URL query string.
   - Automatically renders the dedicated **Set New Password** interface with password matching verification.
   - Dispatches to `POST /api/v1/auth/{projectKey}/password/reset`, then auto-authenticates the user upon confirmation.

### B. 6-Digit Email OTP Passcode Flow
1. **Request Passcode (Step 1)**:
   - Validates email and requests a secure code via `POST /api/v1/auth/{projectKey}/otp/request`.
   - Automatically activates a **60-second resend cooldown timer**.
2. **Digit Input & Verification (Step 2)**:
   - Features **6 distinct digit input boxes** with automatic focus progression, backspace handling, and full 6-digit clipboard paste support.
   - Submits to `POST /api/v1/auth/{projectKey}/otp/verify`.
   - Allows users to change their target email address without restarting the application flow.

### C. Passwordless Magic Link Flow
- Dispatches a single-click sign-in link to the user's inbox via `POST /api/v1/auth/{projectKey}/magic-link/request`.
- Detects `?magicToken=xyz` from incoming email links, automatically calling `POST /api/v1/auth/{projectKey}/magic-link/verify` on startup.

### D. Google OAuth2 Single-Tap Sign-In
- Integrates Google Identity Services, sending Google ID tokens to `POST /api/v1/auth/oauth/google` for automated zero-friction account provisioning and sign-in.

---

## 3. Session Security & Device Management

```
┌─────────────────────────────────────────────────────────────┐
│                    Rithamic Login Hub                       │
│                                                             │
│  ┌───────────────────────┐       ┌────────────────────────┐ │
│  │   Active Devices      │       │   Workspace Switcher   │ │
│  │   (IP, User Agent)    │       │   (Single Sign-On)     │ │
│  └───────────┬───────────┘       └───────────┬────────────┘ │
└──────────────┼───────────────────────────────┼──────────────┘
               ▼                               ▼
      GET /api/v1/auth/sessions     POST /api/v1/auth/sso/generate-ticket
      DELETE /sessions/{id}         Exchange ticket on target app
      POST /sessions/revoke-all
```

1. **Active Devices Drawer Modal**:
   - Users can click **"🛡️ Devices"** in the top hub bar to inspect every browser or mobile session attached to their identity.
   - Queries `GET /api/v1/auth/sessions` with IP address, user agent, last active time, and marks the **Current Session**.
2. **Granular Device Revocation**:
   - Allows terminating any specific stale or suspicious session via `DELETE /api/v1/auth/sessions/{sessionId}`.
3. **Emergency Global Revocation**:
   - **"Revoke All Other Devices"** triggers `POST /api/v1/auth/sessions/revoke-all`, incrementing the database `token_version` to invalidate all active JWTs simultaneously.
4. **Soft-Auth Logout**:
   - Clicking **"Log out"** dispatches `POST /api/v1/auth/logout` with the stored `refreshToken`, revoking active tokens even if the access token has expired.

---

## 4. Post-Login Workspace Hub & Cross-App SSO

Once authenticated, the Login Hub shifts into the **Workspace Application Switcher**:
1. **Dynamic Workspace Discovery**:
   - Queries `GET /api/v1/auth/sso/workspaces` to fetch all applications the user has permissions to access (e.g. POS, CoirFlow ERP, Inventory, Family Tree).
2. **Instant Single Sign-On Ticket Generation**:
   - Clicking on any workspace card triggers `POST /api/v1/auth/sso/generate-ticket` to obtain a single-use 60-second SSO ticket (`sso_...`).
   - Instantly redirects the browser to the target product (`https://app.rithamic.co.in/auth/sso/callback?ticket=sso_...`) for automatic cross-login without re-prompting credentials.

---

## 5. UI/UX Design System & Aesthetics

- **Typography**: Primary font `Inter` for legibility + display font `Outfit` for headings.
- **Glassmorphism & Depth**: Multi-layer dark slate backdrop (`#090d16`), blurred ambient glow orbs (`radial-gradient`), 24px backdrop blur cards, and subtle inset border highlights.
- **Micro-Animations**: Smooth tab transitions, button hover lift (`translateY(-1px)`), alert banners slide-in, and CSS-only loading spinners.
- **Dynamic Multi-Tenant Branding**:
  - Automatically parses `?project={projectKey}` from the URL.
  - Dynamically customizes page titles and badges (e.g., `?project=rithamic_pos` renders *"Sign in to POS"* with custom subtitle context).

---

## 6. File Structure & Component Breakdown

```
rithamic-login/
├── index.html                  # Root HTML entrypoint with all auth views, hub & modal
├── vite.config.ts              # Vite config (runs on port 3000, host: true)
├── tsconfig.json               # Strict TypeScript 5.7 configuration
├── package.json                # Lightweight dependencies (Vite + TypeScript)
├── .gitignore                  # Sanitized: excludes dist/, node_modules/, .env, *.log
├── README.md                   # Repository overview
├── LOGIN_PROJECT_REPORT.md     # Full architectural and implementation report
└── src/
    ├── app.ts                  # Core DOM controller, tab router, form handlers & state
    ├── style.css               # Design system tokens, glassmorphism, animations & drawer
    ├── config/
    │   └── index.ts            # Dynamic environment configuration (localhost:5000 / api.rithamic.co.in)
    ├── services/
    │   ├── authService.ts      # Pure Fetch client for all backend Auth API v1 endpoints
    │   └── telemetryService.ts # Asynchronous metrics event streaming (POST /api/v1/metrics/events)
    └── types/
        └── index.ts            # Master TypeScript interfaces (AuthResponseDto, User, Session, App)
```

---

## 7. Build & Runtime Performance

- **Production Bundle**:
  - `dist/index.html`: `13.39 kB` (Gzip: `3.60 kB`)
  - `dist/assets/index.css`: `9.06 kB` (Gzip: `2.54 kB`)
  - `dist/assets/index.js`: `15.99 kB` (Gzip: `4.81 kB`)
- **Build Time**: **323 ms**
- **Repository Link**: `https://github.com/GowthamThangamani/rithamic-login`
