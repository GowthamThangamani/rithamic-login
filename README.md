# Rithamic Login (Central Auth & SSO Hub)

The centralized single sign-on identity portal (`auth.rithamic.co.in`) for all applications across the Rithamic ecosystem.

## 🚀 How to Run Locally

```bash
npm run dev
```

App opens on `http://localhost:5174`.

## 🔗 How to Connect From Another App

To request login from your app:
```javascript
window.location.href = `http://localhost:5174?project=rithamic_familytree&returnUrl=${encodeURIComponent(window.location.href)}`;
```

Once authenticated, `rithamic-login` redirects back to:
`${returnUrl}?ticket=sso_tk_...&token=...`
