# NeoOps — Neoskills Sales Command Center

Internal operations platform for **NeoSkills**: sales pipeline, enrollments, payments & approvals, receipts, GST invoices, attendance, HR, training batches, tasks (Kanban) and reports — with a React PWA front end and a single Express API.

| | |
|---|---|
| **Repository** | `jeet4747/neoskills-ops` (branch `main`) |
| **Live app** | https://ops.neoskills.co.in |
| **Front end** | React 19 + Vite 8 + Tailwind 3 (PWA) |
| **Back end** | Node + Express 5 monolith (`server/index.cjs`, ~121 API routes) |
| **Database** | Supabase PostgreSQL (27 tables), accessed via `pg` |
| **Node** | v24.x (tested), npm 11.x |

---

## Table of contents

1. [What it does](#what-it-does)
2. [Prerequisites](#prerequisites)
3. [Quick start (local)](#quick-start-local)
4. [Environment variables](#environment-variables)
5. [Scripts](#scripts)
6. [Project structure](#project-structure)
7. [How it fits together](#how-it-fits-together)
8. [Roles & permissions](#roles--permissions)
9. [Feature modules](#feature-modules)
10. [API overview](#api-overview)
11. [Database](#database)
12. [PDFs (receipts, invoices, GST)](#pdfs-receipts-invoices-gst)
13. [Deployment](#deployment)
14. [Testing & conventions](#testing--conventions)
15. [Gotchas](#gotchas-read-this-before-complaining-about-a-bug)
16. [Troubleshooting](#troubleshooting)

---

## What it does

- **Sales**: students, enrollments (deals), payments, installment tracking, salesperson performance.
- **Approvals**: non-admin payments arrive as `pending_approval`; managers/admins/ops review them (amount, date, mode, bank, txn id, POC) and mark *Received* / *Not Received*.
- **Receipts & invoices**: PDF receipts, invoices, and **GST tax invoices** (CGST/SGST vs IGST, export/zero-rated, fiscal-year numbering `NS-26-27/0001`).
- **Attendance**: punch in/out with breaks, late-login detection, IST-safe Excel export.
- **HR / ops**: hiring pipeline, teams & roles, broadcast notifications, batches & training calendar, Kanban tasks, reports.

## Prerequisites

- **Node.js ≥ 20** (v24 is what's used here) and npm 11+
- A **PostgreSQL** connection string (Supabase). Without one the server starts in *mock mode* and every query fails — so you need a real database to exercise the app.
- A terminal, and `git clone` access to this repo.

## Quick start (local)

```bash
git clone https://github.com/jeet4747/neoskills-ops.git
cd neoskills-ops

# 1. install dependencies
npm install

# 2. create your env file (see table below)
cp .env.example .env     # then fill in the real values
```

You normally run **two processes** — the API and the Vite dev server:

```bash
# terminal 1 — API on http://localhost:4000
npm start
# (equivalent: node server/index.cjs)

# terminal 2 — front end on http://localhost:5173 (proxies /api → :4000)
npm run dev
```

Open **http://localhost:5173** and log in.

**First run:** the server auto-creates all missing tables on boot and, if no admin exists, seeds one:

```
Default admin created: admin@neoskills.co.in / admin123
```

> ⚠️ Change that password immediately (Users → profile, or the users API). Don't commit real credentials — `.env` is git-ignored.

**Production-style run** (one process, Express serves the built front end):

```bash
npm run build     # writes dist/
npm start         # serves dist/ + API on :4000
```

## Environment variables

Create `.env` in the project root (copy from `.env.example`):

| Variable | Required | Used for |
|---|---|---|
| `PORT` | no | API port. Defaults to `4000` (`server/index.cjs`). |
| `DATABASE_URL` | **yes** | PostgreSQL connection string (Supabase, `ssl rejectUnauthorized:false`). If missing → mock mode, all queries fail. |
| `JWT_SECRET` | **yes** | Signing/verifying auth tokens. Falls back to `neosecret2026` in code — **never** use the fallback in production. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | no | Web Push (browser notifications). Generate with `npx web-push generate-vapid-keys`. Without them push silently does nothing. |
| `ADMIN_PASSWORD` | no | Currently **unused** by the code — safe to omit. |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start Vite dev server (hot reload), proxies `/api` and `/uploads` → `http://localhost:4000`. |
| `npm run build` | Production build to `dist/` (code-split: vendor/charts/icons/animation). |
| `npm start` | Run the API (`node server/index.cjs`), which also serves `dist/`. |
| `npm run lint` | `oxlint` across `src/` + `server/`. Expect **0 errors** and a handful of baseline warnings. |
| `npm run preview` | Preview the built `dist/` (no API). |
| `npm run seed` | Create the default admin if none exists. |

## Project structure

```
.
├── index.html               # Vite entry
├── vite.config.js           # React + PWA plugin + /api proxy + chunking
├── tailwind.config.js
├── public/
│   ├── icons/               # PWA icons (192/512/maskable/180)
│   └── logo/                # brand logos used in PDFs (nsl-logo-cropped.png)
├── src/                     # React front end
│   ├── App.jsx              # all routes + ProtectedRoute role gates
│   ├── main.jsx
│   ├── sw.js                # service worker (custom manifest injection)
│   ├── pages/               # one file per screen (Login, Dashboard, Enrollments,
│   │                        #   Payments, Approvals, Receipts, GSTInvoices, GSTSettings,
│   │                        #   Attendance, Tasks, Reports, Team, Users, Hiring, Batches,
│   │                        #   TrainingCalendar, Broadcast, BankAccounts, …)
│   ├── components/
│   │   ├── Layout/          # AppLayout, Sidebar, NotificationsBell, PushPrompt, popup
│   │   ├── ui/              # Modal, Card, Table, Badge, StatsCard
│   │   └── Attendance/      # PunchButton
│   ├── services/api.js      # single fetch wrapper + every endpoint grouped by module
│   ├── context/             # AuthContext, ToastContext
│   ├── hooks/usePushSubscription.js
│   ├── config/constants.js  # CATEGORIES, PAYMENT_MODES, …
│   ├── constants/states.js  # INDIAN_STATES (GST forms)
│   └── utils/               # ist.js (IST date helpers), receipts.js, imageCompress.js
└── server/                  # Express API (CommonJS)
    ├── index.cjs            # THE server: schema init, auth, ~121 routes, static SPA
    ├── db.cjs               # pg Pool + query() + withTransaction()
    ├── gst.cjs              # GST math (splitInclusive, CGST/SGST vs IGST, toWords)
    ├── gst_invoice.cjs      # GST tax-invoice PDF (pdfkit)
    ├── invoice.cjs          # regular invoice PDF (formatINR, toWords)
    ├── receipt.cjs          # receipt PDF
    ├── attendance_export.cjs# attendance Excel (exceljs, IST)
    ├── brands.cjs           # neoskills / careervue / frolics prefixes
    ├── assets/fonts/        # DejaVuSans.ttf, DejaVuSans-Bold.ttf (required by PDFs)
    ├── scripts/             # one-off maintenance scripts
    └── seed.cjs             # default admin
```

## How it fits together

```
Browser (React PWA)
   │  fetch('/api/...')
   ▼
Vite dev proxy  ──►  Express API  ──►  Supabase PostgreSQL
   :5173                :4000              (pg Pool)
```

- **Dev**: Vite on `:5173` proxies `/api` and `/uploads` to the API on `:4000`.
- **Prod**: Express serves `dist/` statically and returns `dist/index.html` for any non-`/api` path (SPA fallback, `server/index.cjs:3223-3228`), so one process serves everything.
- **Auth**: `POST /api/auth/login` → JWT. Every protected route uses `auth(['roles…'])`, which decodes the token and enforces role allow-lists server-side (`server/index.cjs:70-84`). The front end additionally gates routes in `src/App.jsx` and nav in `src/components/Layout/Sidebar.jsx` — **server-side checks are the real security**; UI hiding is a convenience.
- **API client**: one `request()` wrapper in `src/services/api.js` handles the bearer token, JSON, 401 → logout redirect, and error surfacing. Add new endpoints there.

## Roles & permissions

Five roles exist in `users.role`:

| Role | Can see / do |
|---|---|
| **sales** | Own dashboard, enrollments, payments, attendance, tasks, batches. Sees only their own records. |
| **manager** | Team overview, approvals (amount/date/mode/bank/txn), enrollments, reports, pending users. |
| **ops** | Like manager, plus **can change the Sale POC when approving**; approval list hides admin-recorded payments. |
| **admin** | Everything — settings, POC changes, broadcast, deletion requests, no team-data hiding. |
| **hr** | Hiring, HR dashboards, attendance review (and a `can_sell` flag lets an HR user act like sales). |

Role gates appear in `auth([...])` on the server, `ProtectedRoute roles={[…]}` in `src/App.jsx`, and `roles: […]` on each Sidebar item.

> Some features are also gated by hard-coded **user id** (e.g. broadcast → id 14, hiring → id 19, attendance exclusions) in `server/index.cjs`. That's intentional business logic, not a mistake.

## Feature modules

| Module | Front end | API notes |
|---|---|---|
| Dashboard | `pages/Dashboard.jsx` | `/api/dashboard/*`, role-specific summaries |
| Enrollments & students | `pages/Enrollments.jsx`, `EnrollmentDetail.jsx` | `/api/enrollments`, deletion requests flow |
| Payments | `pages/Payments.jsx` | `/api/payments`; non-admin entries start `pending_approval` |
| Approvals | `pages/Approvals.jsx` | `/api/approvals/pending|count|:id/approve|:id/reject` |
| Receipts | `pages/Receipts.jsx` | `/api/receipts`, `/api/receipts/:id/pdf` |
| **GST billing** | `pages/GSTInvoices.jsx`, `GSTSettings.jsx` | `/api/gst-invoices`, `/api/gst-settings` (admin/manager/ops) |
| Attendance | `pages/Attendance.jsx` | punch in/out, breaks, Excel export |
| Kanban tasks | `pages/Tasks.jsx` | `/api/tasks` — statuses `todo` / `in_progress` / `done` |
| Batches & calendar | `pages/Batches.jsx`, `TrainingCalendar.jsx` | `/api/batches`, sessions, nominations |
| Reports | `pages/Reports.jsx` | `/api/reports/*` |
| Team / users | `pages/Team.jsx`, `Users.jsx` | `/api/users`, approval of pending sign-ups |
| Hiring | `pages/Hiring.jsx` | `/api/hiring/*` (restricted user ids) |
| Broadcast | `pages/Broadcast.jsx` | push + notifications (admin only) |

## API overview

- **121 routes** all mounted under `/api`, all JSON.
- Auth style: `app.<verb>('/api/x', auth(['admin','manager']), handler)`.
- Common shapes: lists return an array (or `{ invoices, total, page, limit }`), single objects return the row, errors return `{ error: 'message' }` with an appropriate status.
- File uploads use `multer` (memory storage, images only, 15 MB), and `express.json({ limit: '20mb' })` because **payment screenshots are stored as base64 in the DB** (see [Gotchas](#gotchas-read-this-before-complaining-about-a-bug)).
- Web Push subscribes to `/api/push/subscribe` and pushes via `VAPID_*`.

## Database

27 tables (schema is created automatically on boot by `init()` in `server/index.cjs`):

```
users, students, enrollments, payments, receipts, receipt_templates, gst_invoices,
gst_settings, bank_accounts, attendance, batches, batch_members, training_sessions,
session_enrollments, session_nominations, tasks, task_comments, task_activities,
task_labels, task_task_labels, sales_targets, notifications, push_subscriptions,
hiring_companies, job_openings, hiring_candidates, enrollment_deletion_requests
```

Notable columns/behaviours:

- `enrollments.sales_user_id` = who owns the sale; `payments.sales_user_id` = who recorded/collects that instalment (**these can differ**).
- `payments.collection_month` is derived from when money was **actually received in IST**, never from the server timezone or the batch's training month.
- `attendance.punch_in / punch_out` are `timestamptz`; **always read/write them in IST** (`Asia/Kolkata`).
- `gst_settings` is a single row (`id = 1`); `gst_invoices` carries `prefix`, `sequence`, `fiscal_year`.

Migrations happen automatically at boot (column adds, status check constraints, default bank accounts).

## PDFs (receipts, invoices, GST)

Generated server-side with **pdfkit**:

| Generator | File | Notes |
|---|---|---|
| Receipt | `server/receipt.cjs` | `/api/receipts/:id/pdf`, `/api/enrollments/:id/receipt` |
| Invoice | `server/invoice.cjs` | `formatINR`, `toWords` |
| GST tax invoice | `server/gst_invoice.cjs` | `/api/gst-invoices/:id/pdf` |

Hard-coded asset paths you must keep in place (relative to the repo root):

- Fonts: `server/assets/fonts/DejaVuSans.ttf` and `DejaVuSans-Bold.ttf`
- Logo: `public/logo/nsl-logo-cropped.png` (optional — the PDF skips it if absent)

If a font file is missing, PDF routes throw and return 500.

## Deployment

Hosted on **Render** (free, Singapore), repo `jeet4747/neoskills-ops`:

- **Build command:** `npm install; npm run build`
- **Start command:** `node server/index.cjs`
- **Auto-Deploy: On Commit** → pushing to `main` triggers a build/deploy automatically.
- Database is Supabase (kept running independently of the Render service).

Workflow: `git add …` → `git commit …` → `git push` → Render rebuilds → **hard refresh** the app.

> **PWA caching:** the service worker caches assets aggressively, so after a deploy users must hard-refresh (`Cmd+Shift+R`) or they'll keep seeing the old bundle. This is a known source of "it's not live yet" confusion.

Note: Render runs in **UTC** while all business logic expects **IST**. Anything date/month related must go through the IST helpers (`istMonthStr()` on the server, `src/utils/ist.js` on the client) — see commit `e4560e9`.

## Testing & conventions

There's no test framework installed. Existing practice for verifying API behaviour locally:

1. Start the API locally (`npm start` on `:4000`).
2. Write a throwaway script that signs a token directly and hits the API:

```js
const jwt = require('jsonwebtoken');
const token = jwt.sign({ id: 4, name: 'Meenakshi', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const res = await fetch('http://localhost:4000/api/gst-settings', {
  headers: { Authorization: `Bearer ${token}` },
});
```

3. Create any synthetic rows needed and **delete them before finishing** — the local server talks to the real database.
4. Keep `npm run lint` at **0 errors** and `npm run build` clean before pushing.

Conventions:

- Dates/times that reach reports must be IST-aware.
- New screens need **three** touches to go live: page in `src/pages/`, route in `src/App.jsx` (with a `ProtectedRoute` role gate), nav item in `src/components/Layout/Sidebar.jsx`.
- New API endpoints: add to the matching group in `src/services/api.js` and gate them with `auth([...])`.

## Gotchas (read this before complaining about a bug)

1. **Payments are huge.** `payments.receipt_url` / `receipt_urls` store screenshots as **base64 in the DB**, and `GET /api/payments` selects `p.*`, so it streams images on every load — this caused a multi-GB egress overage. Prefer excluding blobs from list queries when working on payments.
2. **`terms` from `/api/gst-settings` arrives as an already-parsed JSON array** (pg parses `jsonb`). Don't `JSON.parse()` it — that throws. The front end handles both shapes now.
3. **Two POCs exist** (enrollment owner vs payment recorder). Changing the POC during approval updates **both** (admin/ops only).
4. **Dates drift.** The DB may hold a date row written in another session's timezone — always confirm with `TZ=Asia/Kolkata date` before acting on "today".
5. **Native-binding build failure** on Apple Silicon when the shell runs x64 under Rosetta: `Cannot find module '@rolldown/binding-darwin-x64'`. Fix by installing the x64 binaries for your current arch:
   ```bash
   npm install --no-save --no-package-lock @rolldown/binding-darwin-x64 @oxlint/binding-darwin-x64
   ```
   (`npm ci` from a clean `node_modules` is the "proper" fix.) Render/Linux is unaffected.
6. **Don't chain shell commands with `echo ====`,** use `printf` (zsh quirk in this repo's tooling).

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `No database configured` / everything 500s | `DATABASE_URL` missing or empty in `.env` (mock mode). |
| `EADDRINUSE: 4000` | A previous `node server/index.cjs` is still running — kill it (`pkill -f "node server/index.cjs"`), then start again. |
| Vite can't reach the API | The API isn't running on `:4000`, or you're not going through the Vite dev server (the proxy only exists in dev). |
| Login always "Invalid credentials" | User's `status` isn't `active`, or the password hash differs — check `users` and reset via the users API. |
| Deployed but the app still looks old | Service-worker cache → hard refresh (`Cmd+Shift+R`). |
| PDF download fails/500 | Missing font or logo under `server/assets/fonts/` / `public/logo/`. |
| Lint/build fails on `@rolldown/binding…` | Arch mismatch — see Gotcha 5. |
| `ops.neoskills.co.in` returns 503 | The Render service is suspended/stopped → press **Resume** in the Render dashboard. |
| Push notifications never arrive | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` unset, or no `push_subscriptions` row for the user. |
