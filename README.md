# 🛡️ Org Guardian — Salesforce Security Dashboard

A full-featured, **no-backend** React dashboard for monitoring the security posture of any Salesforce organization in real time. Connects directly to the Salesforce REST API from the browser — no server, no database, no infrastructure required.

![Org Guardian Dashboard](https://img.shields.io/badge/React-18-blue?logo=react) ![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3-06B6D4?logo=tailwindcss) ![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite) ![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **OAuth 2.0 + Direct Login** | Authenticate via Salesforce OAuth or username/password flow |
| 📊 **19-Metric Health Engine** | Weighted scoring across 4 security domains (max 121 pts) |
| 🧭 **Security Domains** | Identity & Access · Auditability & Monitoring · Governance & Utilization · Network & Integrations |
| 🔍 **Security Findings** | Filterable, categorized list of all detected risks with severity levels |
| 👤 **Access Explorer** | Live user list with drill-down permission set view and risk flags |
| 🌓 **Light / Dark Mode** | Toggle between polished light and dark themes |
| 📤 **Excel Export** | Download drill-down data for any metric as `.xlsx` |
| ⚡ **No Backend Needed** | Pure client-side React SPA — deploy anywhere static files are served |

---

## 🖥️ Screenshots

> Light mode overview with domain scores and individual KPI cards

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- A Salesforce org (Production, Sandbox, or Dev Edition)
- A **Connected App** in Salesforce

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/sf-guardian.git
cd sf-guardian
npm install
npm run dev
```

Open your browser at `http://localhost:5173` (or the port shown in your terminal).

---

## ⚙️ Salesforce Setup (Required)

### Step 1 — Create a Connected App

1. In Salesforce Setup, search for **App Manager** → click **New Connected App**
2. Fill in the basic info (name, email)
3. Check **Enable OAuth Settings**
4. Set **Callback URL** to: `http://localhost:5173/callback` (and your production URL if deploying)
5. Add these **OAuth Scopes**:
   - `Full access (full)` — OR — `Access and manage your data (api)` + `Perform requests on your behalf at any time (refresh_token)`
6. Save and **wait 2–10 minutes** for it to propagate
7. Copy the **Consumer Key (Client ID)** and **Consumer Secret**

### Step 2 — Whitelist CORS Origin

1. Go to **Setup → Security → CORS**
2. Click **New** and add `http://localhost:5173`
3. Also add your production domain if deploying

### Step 3 — Run the App

```bash
npm run dev
```

Enter your **Client ID**, **Client Secret**, and **Redirect URI** (`http://localhost:5173/callback`) in the login screen, then click **Direct Connect** or **Authenticate with OAuth**.

---

## 📐 Scoring Model

The Health Score is a normalized 0–100 score:

```
Overall Score = (Total Points Earned / 121) × 100
```

| Domain | Max Points | Metrics |
|---|---|---|
| Identity & Access | 45 | 6 metrics |
| Auditability & Monitoring | 20 | 3 metrics |
| Governance & Utilization | 30 | 6 metrics |
| Network & Integrations | 26 | 4 metrics |

| Score | Status |
|---|---|
| 90–100 | 🟢 Excellent |
| 75–89 | 🟡 Good |
| Below 75 | 🔴 At Risk |

Full scoring breakdown is documented in the source at `src/hooks/useSalesforceMetrics.js`.

---

## 🗂️ Project Structure

```
sf-guardian/
├── src/
│   ├── App.jsx                    # Root app, routing, theme, auth
│   ├── AccessExplorer.jsx         # User list + detail drill-down
│   ├── SecurityFindings.jsx       # Categorized findings view
│   ├── MetricCard.jsx             # Individual KPI card component
│   ├── SalesforceClient.jsx       # Salesforce REST API client
│   ├── components/
│   │   └── LoginView.jsx          # Login / auth screen
│   ├── hooks/
│   │   └── useSalesforceMetrics.js # All 19 metric queries & scoring
│   └── utils/
│       └── formatters.jsx         # Shared helpers (colors, icons, formatters)
├── index.html
├── tailwind.config.js
└── vite.config.js
```

---

## 🛠️ Tech Stack

- **React 18** — UI framework
- **Vite 5** — Build tool and dev server
- **Tailwind CSS 3** — Utility-first styling
- **Lucide React** — Icon library
- **xlsx** — Excel export
- **Salesforce REST API** — Data source (SOQL queries via browser fetch)

---

## 🚢 Deployment

Since this is a pure static SPA, you can deploy for free to:

| Platform | Command |
|---|---|
| **Vercel** | `npx vercel` |
| **Netlify** | Drag & drop the `dist/` folder after `npm run build` |
| **GitHub Pages** | Use `gh-pages` package with `npm run build` |

> ⚠️ **Important:** After deploying, add your production URL to both:
> - Salesforce **CORS** whitelist
> - Your Connected App **Callback URL** list

---

## 🔒 Security & Privacy

- **No credentials are stored** — Client ID and Secret are kept in `sessionStorage` only for the session duration
- **No backend server** — All API calls go directly from your browser to Salesforce
- **No data leaves your browser** — This tool only reads from your org; it does not write any data

---

## 🤝 Contributing

Pull requests are welcome! To add a new metric:

1. Open `src/hooks/useSalesforceMetrics.js`
2. Add a `tryFetch(...)` call to the `Promise.all` array
3. Follow the existing pattern: `id`, `group`, `title`, `description`, `maxPoints`, fetch function, transform function
4. Update `currentMax` constant at the bottom

---

## 📄 License

MIT — free to use, modify, and distribute.

---

*Built with ❤️ for the Salesforce community*
