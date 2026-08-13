# Rizvi Diagnostic Center — Management System

A full-stack web application for managing patients, radiology procedures, invoices (with thermal & simple print formats), referrals, radiology reports, analytics, and user accounts.

**Clinic:** Rizvi Diagnostic Center
**Address:** 547-A Jinnah Colony Faisalabad
**Phone:** 0320-2616216 · 041-2616216

---

## Tech Stack

- **Backend:** Node.js, Express, JWT authentication, bcrypt password hashing
- **Database:** Simple JSON-file storage (no native modules to compile — works anywhere Node runs). Easy to later migrate to MySQL/PostgreSQL/MongoDB.
- **Frontend:** React (Vite), React Router, Tailwind CSS, Recharts

## File Structure

```
RizviDiagnosticCenter/
├── backend/
│   ├── .env                      # Environment config (PORT, JWT secret)
│   ├── package.json
│   └── src/
│       ├── server.js             # Express app entry point
│       ├── db.js                 # JSON file-based data layer
│       ├── seed.js               # Seeds admin/staff users, procedures, settings
│       ├── middleware/
│       │   └── auth.js           # JWT auth + role guard
│       ├── routes/
│       │   ├── auth.routes.js
│       │   ├── users.routes.js       # admin-only: manage staff/admin accounts
│       │   ├── patients.routes.js
│       │   ├── procedures.routes.js  # radiology test/procedure list
│       │   ├── referrals.routes.js   # referring doctors
│       │   ├── invoices.routes.js
│       │   ├── reports.routes.js     # dashboard + analytics + radiology reports
│       │   └── settings.routes.js    # practice/clinic settings
│       └── data/                 # auto-created JSON "database" files
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js            # proxies /api to backend on port 5000
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx                # all routes
        ├── api/axios.js           # axios instance with auth token
        ├── context/AuthContext.jsx
        ├── components/
        │   ├── Layout.jsx, Sidebar.jsx, Navbar.jsx, Modal.jsx
        │   ├── ProtectedRoute.jsx
        │   ├── StatCard.jsx
        │   ├── PrintThermalInvoice.jsx   # 80mm receipt printer format
        │   └── PrintSimpleInvoice.jsx    # A4 simple invoice format
        └── pages/
            ├── Login.jsx
            ├── Dashboard.jsx
            ├── Patients.jsx, PatientDetail.jsx
            ├── CreateInvoice.jsx, Invoices.jsx, InvoicePrint.jsx
            ├── RadiologyReports.jsx, Analytics.jsx
            ├── Referrals.jsx, Procedures.jsx
            ├── Users.jsx           (admin only)
            └── Settings.jsx        (admin only)
```

## Roles

- **Admin** — full access: manage users (create/edit/deactivate/delete staff & admin accounts), manage procedures & pricing, manage referrals, manage practice settings, view/delete any patient or invoice, all reports & analytics.
- **Staff** — front-desk operations: register patients, create & print invoices, view radiology reports, view analytics, view procedures/referrals (read-only).

## Getting Started

### 1. Backend

```bash
cd backend
npm install
npm run seed     # creates default admin/staff logins, procedure list, and clinic settings
npm run dev       # starts on http://localhost:5000 (or: npm start)
```

2. Frontend

```bash
cd frontend
npm install
npm run dev       # starts on http://localhost:5173
```

Open **http://localhost:5173** in your browser. The Vite dev server proxies `/api/*` requests to the backend automatically.

### 3. Production Build

```bash
cd frontend
npm run build     # outputs static files to frontend/dist
```

Serve `frontend/dist` with any static host (Nginx, Apache, or `serve`), and run the backend with a process manager like PM2.

## Key Features

- **Invoice Creation:** select patient → add radiology procedures (rate/qty auto-priced from the Procedure List) → apply discount → choose referral doctor → choose payment mode → save.
- **Two Print Formats:** every invoice can be printed as a **Thermal 80mm receipt** (for thermal printers) or a **Simple A4 invoice** — toggle between them on the invoice print screen, then click Print.
- **Radiology Reports:** date-filterable transaction log of all invoices with revenue, discount, dues, and payment mode; export to CSV/Excel or print.
- **Analytics:** most-performed tests chart, pending payments list, revenue trend on the dashboard.
- **Patient Profiles:** registration with auto-generated MR number, full invoice history, billed/paid/due totals.
- **Practice Settings:** clinic name, address, phone numbers, invoice prefix, footer note, default print format — all editable by Admin and reflected on every invoice print.

## Notes on the Data Layer

Data is stored as JSON files under `backend/src/data/` **and** synced to MongoDB Atlas (your live/cloud database) whenever this PC has internet access — see "Live Database (MongoDB Atlas)" below. The JSON files always stay the local, offline-first cache, so the app keeps working with zero internet even if Atlas is unreachable.

## Live Database (MongoDB Atlas)

`backend/.env` already contains a working `MONGODB_URI` for your Atlas cluster (`rizvidiagnosticcenter.ipuffsq.mongodb.net`). No code changes are needed — `db.js` connects automatically at startup.

**Before it will actually connect, do this once in Atlas:**
1. Log in to [MongoDB Atlas](https://cloud.mongodb.com) → your project → **Network Access** → **Add IP Address** → add the IP of every PC that will run this app (or `0.0.0.0/0` to allow any IP — simpler, but less secure).
2. Confirm the database user `stalkermianone10_db_user` (in Database Access) has **Read and write to any database** permission.

**How the sync works:**
- On startup, the server pulls the latest copy of every table (patients, invoices, settings, etc.) down from Atlas into memory + the local JSON cache.
- Every save (new patient, new invoice, settings change, etc.) is written to the local JSON file immediately, then queued up to Atlas in the background.
- If Atlas can't be reached (no internet, IP not whitelisted yet, etc.), the app logs a warning and keeps running perfectly on the local JSON cache — nothing breaks or blocks.
- Run the app on two different PCs against the same Atlas cluster and they'll share the same live data, syncing whenever each one is online.

**Security:** `backend/.env` now contains real database credentials. Don't commit it to a public repo or share the project zip with anyone you don't want to have access to your clinic's data — treat it like a password.

## Running as a Desktop (Windows) App — No Live/Hosted Site Needed

The `electron/` folder wraps the existing backend + built frontend into a single native desktop app. The backend already serves both the API and the UI on one port (see `backend/src/server.js`), so Electron just opens that in a plain window — no separate site or hosting required. The local JSON cache means it also works fully offline; MongoDB Atlas sync (above) is optional and only needs internet when available.

**One-time setup** (needs Node.js installed — [nodejs.org](https://nodejs.org)):
```bash
cd backend  && npm install
cd ../frontend && npm install && npm run build   # builds frontend/dist, which the backend serves
cd ../electron && npm install
```

**Run it as a desktop app on this PC:**
```bash
cd electron
npm start
```
This opens a normal desktop window running the whole clinic system — no browser tab, no separate terminal for the backend.

**Build a Windows installer (.exe) to run on other PCs, without Node.js installed there:**
```bash
cd electron
npm run dist
```
This produces an installer under `electron/dist-installer/` (e.g. `Rizvi Diagnostic Center Setup 1.0.0.exe`). Copy that single file to any Windows PC and double-click it — it installs a normal Windows application with a Start Menu / Desktop shortcut, bundling its own copy of Node.js so nothing else needs to be installed. Best run directly on a Windows machine (electron-builder can cross-build from Linux/Mac with extra setup, but building on Windows itself is simplest and most reliable).

Each installed copy keeps its own local JSON data by default; if you also configure MongoDB Atlas (above) on each PC, they'll share live data automatically.


## Security Notes Before Going Live

1. Change `JWT_SECRET` in `backend/.env` to a long random string.
2. Change the default admin/staff passwords immediately after first login (Users page → Edit → set new password).
3. Serve the app over HTTPS in production.
4. Take regular backups of the `backend/src/data/` folder.
