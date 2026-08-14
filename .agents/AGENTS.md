# Rithamic Login (Central Auth Portal) - AI Agent Guidelines

All AI agents working on `rithamic-login` must follow these repository rules:

---

## 1. Project Role & Scope
* **Identity Hub**: Central authentication authority (`auth.rithamic.co.in`) for all Rithamic applications.
* **Authentication Options**: 6-digit OTP, Passwordless Magic Link, Google OAuth2.
* **Redirection Flow**:
  - When `returnUrl` is provided in URL query parameters (`?project=...&returnUrl=...`), authenticate user, generate a 60-second single-use SSO ticket via `POST /api/auth/sso/generate-ticket`, and redirect back to `${returnUrl}?ticket=${ssoTicket}`.
  - When no `returnUrl` is present, display the **Workspace Hub** (`GET /api/auth/hub/workspaces`).

---

## 2. API & Security Conventions
* **Central API**: `http://localhost:3000` (Dev) / `https://api.rithamic.co.in` (Prod).
* **Zero Database Queries**: `rithamic-login` NEVER talks to databases directly; 100% of actions go through `rithamic-backend-api`.
