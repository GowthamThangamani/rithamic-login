# Rithamic Login (Central Auth & Developer Console) 🛡️

The centralized multi-tenant identity gateway, single sign-on (SSO) portal (`auth.rithamic.co.in`), and Developer Console for all applications across the Rithamic ecosystem.

---

## 🌟 Key Features

- **Multi-Tenant Authentication**:
  - Email + Password authentication with PBKDF2 hashing.
  - 6-digit OTP code login with auto-distribution and resend countdown.
  - Passwordless Magic Sign-in Link.
  - Google OAuth2 authentication.
- **Dynamic Tenant Branding**:
  - Dynamically customizes branding, titles, logos, and product suites based on `?project=<project_key>`.
- **Synchronized Reactive Router**:
  - 100% URL reflection (`?tab=password`, `?tab=otp`, `?tab=magic`, `?tab=forgot`, `?view=workspaces`, `?view=admin&tab=...`).
  - Full browser history navigation (`popstate` / Back / Forward support).
- **Authorized Workspace Hub**:
  - Displays user profile and accessible client applications with single-click SSO cross-launching.
- **Developer & Admin Console**:
  - Manage client application registrations, CORS domains, and rate limits.
  - Generate and revoke cryptographically secure Server API Keys (`rk_live_...` / `rk_test_...`) for automated backend communications (`comms:send`, `metrics:write`, `leads:write`).
  - View real-time ecosystem communications and usage quotas.
- **Device & Session Management**:
  - Inspect active browser sessions, IP addresses, and revoke individual or all active sessions.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v18+ (or v20+ LTS recommended)
- Running instance of `rithamic-core-service` backend on `http://localhost:5000`

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
The app will start at `http://localhost:5174` (or `http://localhost:5173`).

---

## 📦 Production Native Build & Deployment (No Docker)

### 1. Build Static Production Bundle
```bash
npm run build
```
The compiled, minified static distribution will be generated in the `dist/` directory.

### 2. Deploy to Web Server (`/var/www/rithamic-login`)
```bash
sudo mkdir -p /var/www/rithamic-login
sudo cp -r dist/* /var/www/rithamic-login/
sudo chown -R www-data:www-data /var/www/rithamic-login
```

### 3. Nginx Server Configuration
Configure Nginx at `/etc/nginx/sites-available/auth.rithamic.co.in`:

```nginx
server {
    listen 80;
    server_name auth.rithamic.co.in;
    root /var/www/rithamic-login;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # SPA History Routing Fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static Cache
    location ~* \.(?:ico|css|js|gif|jpe?g|png|svg|woff2?|eot|ttf|otf)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }
}
```

Enable and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/auth.rithamic.co.in /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔗 Single Sign-On (SSO) Integration Guide

To integrate another Rithamic project (e.g. `rithamic-pos`, `rithamic-familytree`, `coirflow-erp`) with Rithamic Login:

### 1. Redirect to Login
Redirect unauthenticated users to the central login portal:
```javascript
const projectKey = 'rithamic_familytree';
const returnUrl = encodeURIComponent(window.location.href);
window.location.href = `https://auth.rithamic.co.in/?project=${projectKey}&returnUrl=${returnUrl}`;
```

### 2. Handle SSO Return & Exchange Ticket
After successful login, `rithamic-login` redirects back to your `returnUrl` with a single-use 60-second SSO ticket:
```
https://familytree.rithamic.co.in/auth/callback?ticket=sso_tk_1a2b3c4d5e...
```

Exchange the ticket in your application backend with `rithamic-core-service`:
```http
POST https://api.rithamic.co.in/api/v1/auth/sso/exchange
Content-Type: application/json

{
  "ticket": "sso_tk_1a2b3c4d5e...",
  "targetProject": "rithamic_familytree"
}
```
Response:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOi...",
    "refreshToken": "rt_...",
    "user": {
      "id": 1,
      "email": "admin@rithamic.co.in",
      "fullName": "Administrator",
      "role": "super_admin"
    }
  }
}
```

---

## 📁 Repository Structure

```text
rithamic-login/
├── index.html                      # Main HTML Template & Dialog Containers
├── package.json                    # Dependencies & Scripts
├── tsconfig.json                   # TypeScript Compiler Configuration
├── vite.config.ts                  # Vite Bundler Configuration
├── dist/                           # Production Output
└── src/
    ├── app.ts                      # Central Application Lifecycle & Routing Orchestrator
    ├── style.css                   # Design Tokens, Glassmorphism & Layout CSS
    ├── components/
    │   ├── AlertBanner.ts          # ARIA Polite Feedback Banner
    │   └── DeviceDrawer.ts         # Active Sessions & Multi-Device Revocation Drawer
    ├── config/
    │   └── index.ts                # API Base URLs & Storage Keys
    ├── services/
    │   ├── authService.ts          # API Client for Authentication, SSO, & Sessions
    │   ├── projectService.ts       # API Client for Developer Console Applications
    │   ├── routerService.ts        # Centralized Reactive URL & History Router
    │   └── telemetryService.ts     # Telemetry & Event Streaming Client
    ├── types/
    │   └── index.ts                # TypeScript DTOs & Domain Interfaces
    └── views/
        ├── AdminConsoleView.ts     # Developer Console (Apps, API Keys, Communications)
        ├── MagicLinkView.ts        # Passwordless Magic Link Form
        ├── OtpView.ts              # 6-Digit Verification Code Form & Cooldown
        ├── PasswordView.ts         # Email/Password & Password Reset View
        └── WorkspaceView.ts        # Authorized Apps Hub & Launchpad
```

---

## 🔒 Security Standards

- **Zero Hardcoded Secrets**: Client secrets and master keys are never bundled in frontend code.
- **Client-Side Sanitization**: Input parameters are sanitized before state dispatch.
- **Session Protection**: Tokens are validated during startup via silent token bootstrap.
- **Cross-Origin Security**: Dynamic CORS origin headers enforced centrally by `rithamic-core-service`.
