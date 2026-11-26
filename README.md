# CloudPOS v2

A full-stack, multi-tenant **Point of Sale (POS), Inventory, Accounting, and Van-Sales / Delivery Management** web application built with **React**, **Express**, **Prisma**, and **PostgreSQL**.

<img width="1905" height="988" alt="image" src="https://github.com/user-attachments/assets/f0cc161e-259c-4c2a-a604-df80aa148303" />
<img width="1367" height="900" alt="image" src="https://github.com/user-attachments/assets/64295ddb-ca83-4293-a5f9-8bb068f3122d" />
<img width="1912" height="983" alt="image" src="https://github.com/user-attachments/assets/50b8d277-d2af-4f2b-bf4d-50bb0a57147c" />
<img width="1919" height="947" alt="image" src="https://github.com/user-attachments/assets/0d63e036-f4b3-44ec-ae3c-189a6caee6cd" />

<img width="1916" height="944" alt="image" src="https://github.com/user-attachments/assets/b1799956-0465-406b-afc2-b222090ac920" />
<img width="1914" height="942" alt="image" src="https://github.com/user-attachments/assets/5bae311e-8b7c-4284-9f18-ad53ebe23d94" />
<img width="1915" height="945" alt="image" src="https://github.com/user-attachments/assets/8936db21-b41b-43ef-aa5a-1698c4c8327e" />
<img width="1915" height="939" alt="image" src="https://github.com/user-attachments/assets/c708bddd-9f57-429d-b7b2-7e0327950d9b" />
<img width="1919" height="944" alt="image" src="https://github.com/user-attachments/assets/e793f96d-55bc-47ed-9948-78c48561fc2c" />
<img width="1914" height="945" alt="image" src="https://github.com/user-attachments/assets/55965b13-c70d-431c-bfd7-2dbdcadadd54" />
<img width="1919" height="944" alt="image" src="https://github.com/user-attachments/assets/baf4f24c-3007-44d9-8f86-fda1a1677a70" />

---

## Tech Stack

### Frontend (`/frontend`)
- **Framework:** React 18 + Vite 5
- **Styling:** Tailwind CSS 3 + Lucide React icons
- **Routing:** React Router DOM v6
- **State Management:** Zustand
- **HTTP Client:** Axios
- **Charts & Utilities:** Recharts, JsBarcode, date-fns, react-hot-toast

### Backend (`/backend`)
- **Runtime:** Node.js (`>= 18.0.0`, ES Modules)
- **Framework:** Express 4
- **Database & ORM:** PostgreSQL + Prisma ORM v5
- **Authentication & Security:** JWT (`jsonwebtoken`), `bcryptjs`, `express-rate-limit`, `express-validator`, CORS
- **Email:** Nodemailer (optional SMTP verification)
- **Logging:** Morgan

---

## Key Features

- **Multi-Role Authentication:** Separate login flows for **Shop Owners**, **Staff**, **Salesmen**, and **Delivery Drivers**.
- **Point of Sale (POS) & Billing:** Fast counter billing (`/sale`), invoice/bill history (`/bill-history`), and barcode generation/scanning (`/barcodes`).
- **Inventory & Catalog Management:** Products, categories, brands, stock tracking, stock updates, and multi-branch stock transfers (`/products`, `/categories`, `/stock`).
- **Purchases & Suppliers:** Purchase entry, supplier management, and purchase payment tracking (`/purchase`, `/suppliers`).
- **Customers & Khata / Ledger:** Customer profiles with credit/debit ledger tracking (`/customers`, `/ledger`).
- **Van Sales & Driver POS:** Dedicated mobile-friendly Driver POS (`/driver-pos`), vehicle stock loading, trip tracking, vehicle dashboard (`/drivers/dashboard`), and driver settlement (`/drivers/:driverId/settlement`).
- **Expenses & Cash Closing:** Expense categorization/tracking (`/expenses`) and daily cash register closing (`/cash-closing`).
- **Analytics & Reports:** Sales reports, dead stock analysis (`/reports/dead-stock`), and best-selling product reports (`/reports/best-selling`).
- **Multi-Branch & Settings:** Shop profile, settings, staff/salesmen management, and branch/franchise management (`/settings`, `/franchise`, `/salesmen`).

---

## Project Structure

```text
cloudpos_v2/
├── backend/
│   ├── prisma/
│   │   ├── migrations/          # Prisma database migrations
│   │   └── schema.prisma        # PostgreSQL schema (Shop, Branch, Product, Sale, Driver, etc.)
│   ├── src/
│   │   ├── config/              # Prisma client setup
│   │   ├── controllers/         # Route business logic
│   │   ├── middleware/          # Auth & request validation middleware
│   │   ├── routes/              # Express API route definitions
│   │   ├── utils/               # Email & stock utilities
│   │   └── index.js             # Express server entry point
│   ├── .env.example             # Sample environment variables
│   ├── nodemon.json
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/          # Shared UI & layout components
│   │   ├── pages/               # Application pages (POS, Reports, Drivers, etc.)
│   │   ├── store/               # Zustand stores (auth, privacy)
│   │   ├── utils/               # Axios API client & endpoint wrappers
│   │   ├── App.jsx              # Client-side router configuration
│   │   └── main.jsx             # React entry point
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js           # Vite config (proxies /api -> localhost:5001)
│   └── package.json
├── .gitignore
└── README.md
```

---

## Prerequisites

Make sure you have the following installed:
- **Node.js** `>= 18.0.0` and **npm**
- **PostgreSQL** (local instance or hosted PostgreSQL database)

---

## Getting Started (App Start Guideline)

### 1. Clone the Repository
```bash
git clone <your-github-repo-url>
cd cloudpos_v2
```

### 2. Backend Setup

1. Navigate to the backend directory and install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Create your environment file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
   *(On Windows PowerShell: `Copy-Item .env.example .env`)*

3. Configure `backend/.env` with your PostgreSQL credentials and secrets:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/cloudpos"
   JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
   JWT_EXPIRES_IN="7d"
   PORT=5001
   NODE_ENV=development
   FRONTEND_URL="http://localhost:5173"

   # Optional SMTP settings
   EMAIL_HOST="smtp.gmail.com"
   EMAIL_PORT=587
   EMAIL_USER="your@gmail.com"
   EMAIL_PASS="your-app-password"
   EMAIL_FROM="CloudPOS <your@gmail.com>"
   ```
   > **Note:** `frontend/vite.config.js` proxies `/api` requests to `http://localhost:5001`, and `backend/src/index.js` defaults to port `5001`. Keep `PORT=5001` in `.env` during local development so the frontend proxy connects seamlessly.

4. Generate Prisma client and apply the database schema:
   ```bash
   npm run db:generate
   npm run db:migrate
   ```
   *(For quick schema sync in development without migration history, you can use `npm run db:push`.)*

5. Start the backend development server:
   ```bash
   npm run dev
   ```
   The API will start on `http://localhost:5001` (health check available at `GET /health`).

---

### 3. Frontend Setup

Open a **new terminal** window/tab:

1. Navigate to the frontend directory and install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```

3. Open your browser and visit:
   ```
   http://localhost:5173
   ```

---

## Available Scripts

### Backend (`/backend`)
| Script | Command | Description |
| :--- | :--- | :--- |
| `npm run dev` | `nodemon src/index.js` | Start API server with hot-reload |
| `npm start` | `node src/index.js` | Start API server for production |
| `npm run db:generate` | `prisma generate` | Generate Prisma Client |
| `npm run db:migrate` | `prisma migrate deploy` | Apply pending Prisma migrations |
| `npm run db:push` | `prisma db push` | Push Prisma schema directly to DB |
| `npm run db:studio` | `prisma studio` | Open Prisma Studio GUI |

### Frontend (`/frontend`)
| Script | Command | Description |
| :--- | :--- | :--- |
| `npm run dev` | `vite` | Start Vite dev server on port `5173` |
| `npm run build` | `vite build` | Build production bundle into `frontend/dist` |
| `npm run preview` | `vite preview` | Preview the production build locally |
| `npm run lint` | `eslint src --ext js,jsx` | Run ESLint on `src/` |

---

## API Modules Overview

All backend routes are mounted under `/api`:

- `/api/auth` — Owner/staff registration, login, current user, password change
- `/api/shop` — Shop details
- `/api/products`, `/api/categories`, `/api/brands` — Catalog management
- `/api/sales` — POS sales & daily summaries
- `/api/purchases` — Supplier purchases & payments
- `/api/stock` — Inventory levels, updates, and branch transfers
- `/api/customers`, `/api/suppliers`, `/api/ledger` — Party management & accounting ledgers
- `/api/drivers` — Driver auth, vehicle stock, loads, trips, and settlements
- `/api/salesmen`, `/api/staff`, `/api/branches` — Team & branch management
- `/api/expenses`, `/api/cash-closing` — Expenses and daily cash closing
- `/api/reports`, `/api/settings` — Business reports & shop settings

---

## Production Build

To build the frontend for production:
```bash
cd frontend
npm run build
```
The static bundle will be output to `frontend/dist/`. On the backend, set `NODE_ENV=production`, configure your production `DATABASE_URL` and `FRONTEND_URL`, run `npm run db:migrate`, and start the server with `npm start`.
