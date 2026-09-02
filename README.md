# 📝 Full-Stack SvelteKit 2 (Svelte 5) Notes Application

A modern, responsive, multi-user markdown notes web application built with **SvelteKit 2**, **Svelte 5 Runes**, **pnpm**, and **PostgreSQL** via **Drizzle ORM**, configured for serverless deployment on **Vercel**.

---

## 🌟 Key Features

- **🔐 Multi-User Authentication & Data Isolation**:
  - Salted `scrypt` password hashing with cryptographic salt and constant-time validation.
  - Database-backed 32-byte session tokens with SHA-256 storage and 30-day sliding expiry.
  - Strict tenant isolation (`and(eq(notes.id, id), eq(notes.userId, userId))`).
- **📝 Rich Markdown Notes Management**:
  - Full CRUD operations with instant server actions & REST API.
  - Multi-tag classification and filter chips.
  - Pin important notes to the top.
  - Multi-facet keyword search across titles and markdown contents.
  - Zero-dependency isomorphic Markdown parser with live preview and XSS protection.
- **🎨 Modern Svelte 5 UI**:
  - Responsive desktop 3-pane layout & mobile drawer view.
  - Powered by Svelte 5 runes (`$state`, `$derived`, `$props`, `$effect`).
- **☁️ Vercel & PostgreSQL Deployment Ready**:
  - Configured with `@sveltejs/adapter-vercel` (`nodejs20.x`).
  - Serverless-compatible connection pooling with `postgres.js` (`prepare: false`).

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure `DATABASE_URL` points to your PostgreSQL instance (e.g., Neon, Supabase, Vercel Postgres, or local Docker).

### 3. Run Database Migrations & Seed Data
```bash
# Push / apply schema migrations
pnpm db:push
# or
pnpm db:migrate

# Seed sample users and rich markdown notes
pnpm db:seed
```

### 4. Start Development Server
```bash
pnpm dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔑 Demo Login Accounts

After running `pnpm db:seed`, you can log in with:

| Email | Password | Included Notes & Tags |
|---|---|---|
| `demo@example.com` | `DemoPassword123!` | 4 notes (Welcome guide, Architecture specs, Feature ideas, Markdown cheatsheet) with `#welcome`, `#markdown`, `#svelte`, `#postgres`, `#work`, `#ideas` |
| `jane.developer@example.com` | `NotesPassword2026!` | 2 notes (Q4 sprint goals, Research reading list) with `#work`, `#ideas`, `#personal` |

---

## 🛠️ Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start local Vite development server |
| `pnpm build` | Build production bundle for Vercel |
| `pnpm preview` | Preview production build locally |
| `pnpm check` | Run `svelte-check` and TypeScript type validation |
| `pnpm test` | Run all 16 test suites (Unit, Integration, E2E) |
| `pnpm test:unit` | Run unit tests |
| `pnpm test:integration` | Run PostgreSQL integration tests |
| `pnpm test:e2e` | Run end-to-end multi-tier test suites |
| `pnpm db:seed` | Seed database with demo accounts and rich notes |
| `pnpm db:push` | Synchronize Drizzle schema to PostgreSQL |
| `pnpm db:migrate` | Apply versioned SQL migration files |
| `pnpm db:studio` | Launch Drizzle Studio database UI |

---

## ☁️ Deploying to Vercel

1. Push this repository to GitHub / GitLab / Bitbucket.
2. Import project into [Vercel](https://vercel.com).
3. Set Environment Variables in Vercel project settings:
   - `DATABASE_URL`: Your PostgreSQL connection string.
   - `SESSION_SECRET`: A secure random 32+ character string.
   - `NODE_ENV`: `production`
4. Deploy! Vercel automatically builds using `@sveltejs/adapter-vercel`.
