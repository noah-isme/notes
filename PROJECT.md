# Project: SvelteKit 2 + Svelte 5 Multi-User Notes Application

## Architecture
- **Framework & Frontend**: SvelteKit 2 with Svelte 5 Runes (`$state`, `$derived`, `$props`, `$effect`), responsive CSS styling (modern, clean, desktop 3-pane / mobile adaptive layout), markdown renderer and live preview.
- **Backend & Routing**: SvelteKit Server Routing (`+page.server.ts`, `+server.ts`), request lifecycle interception in `src/hooks.server.ts` for session authentication and user context injection (`event.locals.user`).
- **Database & ORM**: PostgreSQL (tested locally via `localhost:5433` / postgres container and configurable via `DATABASE_URL`), Drizzle ORM (`drizzle-orm/postgres-js`), Drizzle Kit for schema migrations (`drizzle.config.ts`).
- **Connection Pooling**: Serverless-compatible connection pooling with `postgres` (postgres.js) using `prepare: false`, `max: 10`, idle connection termination suitable for Vercel Serverless Functions.
- **Authentication & Security**: Strong cryptographic password hashing using Node `crypto.scrypt` with per-user cryptographic salt, database-backed `sessions` table, cryptographically secure 32-byte session tokens stored in `httpOnly`, `sameSite: 'lax'`, `secure` cookies with 30-day sliding expiry.
- **Tenant Isolation**: Strict compound query predicates across all database operations (`and(eq(notes.id, noteId), eq(notes.userId, locals.user.id))`) ensuring zero cross-tenant data leakage or IDOR vulnerability.
- **Deployment**: Configured with `@sveltejs/adapter-vercel` (`runtime: 'nodejs20.x'`), complete `.env.example`.

## Code Layout
```
/home/noah/project/notes/
├── drizzle/                    # Generated SQL migration files
├── src/
│   ├── app.d.ts                # SvelteKit App namespace & locals typing
│   ├── app.html                # Base HTML template
│   ├── hooks.server.ts         # Authentication hook & session resolution
│   ├── lib/
│   │   ├── components/         # Svelte 5 UI components
│   │   │   ├── AuthForm.svelte
│   │   │   ├── NoteEditor.svelte
│   │   │   ├── NoteList.svelte
│   │   │   ├── NoteCard.svelte
│   │   │   ├── TagFilter.svelte
│   │   │   ├── SearchBar.svelte
│   │   │   └── Toast.svelte
│   │   ├── server/             # Server-only modules
│   │   │   ├── db/
│   │   │   │   ├── index.ts    # Drizzle client with serverless pool
│   │   │   │   └── schema.ts   # Database tables, relations, indexes
│   │   │   ├── auth.ts         # Auth helpers (hashing, session create/validate/delete)
│   │   │   └── notes.ts        # Note & Tag CRUD service with user isolation
│   │   └── utils/
│   │       ├── markdown.ts     # Markdown parser & XSS sanitizer
│   │       └── validation.ts   # Input validation schemas/helpers
│   └── routes/
│       ├── +layout.svelte      # Root layout
│       ├── +layout.server.ts   # Root layout server load (user state)
│       ├── +page.svelte        # Home / Landing / Notes dashboard redirect
│       ├── (auth)/
│       │   ├── login/
│       │   │   ├── +page.svelte
│       │   │   └── +page.server.ts
│       │   ├── register/
│       │   │   ├── +page.svelte
│       │   │   └── +page.server.ts
│       │   └── logout/
│       │       └── +page.server.ts
│       ├── (app)/
│       │   ├── +layout.svelte  # Authenticated app shell (nav, sidebar)
│       │   ├── +layout.server.ts # Auth guard
│       │   ├── +page.svelte    # Notes dashboard (list, filter, editor)
│       │   └── +page.server.ts # Load notes, tags; note actions
│       └── api/
│           ├── notes/
│           │   ├── +server.ts  # REST endpoints for notes CRUD
│           │   └── [id]/
│           │       └── +server.ts
│           └── tags/
│               └── +server.ts
├── tests/                      # Automated test suite
│   ├── unit/                   # Unit tests (auth hashing, markdown, validation)
│   ├── integration/            # DB integration tests (schema, auth, isolation)
│   └── e2e/                    # Opaque-box E2E test scenarios (Tiers 1-4)
├── drizzle.config.ts           # Drizzle Kit configuration
├── svelte.config.js            # SvelteKit config with @sveltejs/adapter-vercel
├── vite.config.ts              # Vite + Vitest config
├── tsconfig.json               # TypeScript configuration
├── package.json                # Dependencies & scripts
└── .env.example                # Documented environment variables
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | DB Schema & Tables | PostgreSQL schema for users, sessions, notes, tags, note_tags with relations | M1 | ORIGINAL_REQUEST §R3 |
| 2 | Serverless Connection Pool | Postgres connection pooling with `prepare: false`, idle timeout for Vercel | M1 | ORIGINAL_REQUEST §R3 |
| 3 | Migration Engine | Drizzle Kit migration runner and clean schema setup scripts | M1 | ORIGINAL_REQUEST §R3, Acceptance §35 |
| 4 | User Registration | Create user account with unique email and cryptographically hashed password | M2 | ORIGINAL_REQUEST §R1 |
| 5 | User Login | Authenticate credentials and issue cryptographically secure session cookie | M2 | ORIGINAL_REQUEST §R1 |
| 6 | Session Management | Server-side session verification, 30-day sliding expiration, cookie security | M2 | ORIGINAL_REQUEST §R1 |
| 7 | User Logout | Invalidate active session in DB and clear session cookie | M2 | ORIGINAL_REQUEST §R1 |
| 8 | Server Route Guards | SvelteKit `hooks.server.ts` enforcing authentication on protected routes | M2 | ORIGINAL_REQUEST §R1, Acceptance §37 |
| 9 | Strict User Isolation | Compound SQL query predicates preventing cross-tenant data access | M2 | ORIGINAL_REQUEST §R1 |
| 10 | Note Create | Create note with title, content, tags, pinned status assigned to authenticated user | M3 | ORIGINAL_REQUEST §R2 |
| 11 | Note Read & List | Retrieve user's notes with timestamps and associated tags | M3 | ORIGINAL_REQUEST §R2 |
| 12 | Note Update | Edit note title, content, tags, pinned status with updated timestamp | M3 | ORIGINAL_REQUEST §R2 |
| 13 | Note Delete | Remove note and cascade delete note_tags relationships | M3 | ORIGINAL_REQUEST §R2 |
| 14 | Note Pinning | Toggle note pinned status with pinned notes ordered first | M3 | ORIGINAL_REQUEST §R2 |
| 15 | Tags Management | Create tags, assign multiple tags to notes, filter notes by tag | M3 | ORIGINAL_REQUEST §R2 |
| 16 | Multi-Facet Search | Search notes by title, content, and combined tag filters | M3 | ORIGINAL_REQUEST §R2 |
| 17 | Server-side Validation | Validate inputs (email format, password length, title length, content) | M3 | ORIGINAL_REQUEST §R3 |
| 18 | Markdown Parsing & XSS Sanitization | Render markdown formatted notes with safe HTML output | M4 | ORIGINAL_REQUEST §R2 |
| 19 | Svelte 5 Reactive UI | Modern UI using Svelte 5 Runes (`$state`, `$derived`, `$props`, `$effect`) | M4 | ORIGINAL_REQUEST §R2 |
| 20 | Responsive Desktop/Mobile Layout | 3-pane layout on desktop, responsive drawer/views on mobile viewports | M4 | ORIGINAL_REQUEST §R2, Acceptance §38 |
| 21 | Vercel Adapter Setup | `@sveltejs/adapter-vercel` configured with Node.js 20.x runtime | M5 | ORIGINAL_REQUEST §R4 |
| 22 | Environment Config | Complete `.env.example` documenting all configuration keys | M5 | ORIGINAL_REQUEST §R4 |
| 23 | Build & Typecheck Zero-Error | Zero errors on `pnpm build` and TypeScript check (`svelte-check`) | M5 | ORIGINAL_REQUEST §R4, Acceptance §36 |
| 24 | E2E Tier 1 Feature Coverage | Automated tests verifying all individual features in isolation | M6 / E2E Track | ORIGINAL_REQUEST Acceptance §34 |
| 25 | E2E Tier 2 Boundary & Corner Cases | Automated tests for edge cases, invalid inputs, duplicate data, XSS | M6 / E2E Track | ORIGINAL_REQUEST Acceptance §34 |
| 26 | E2E Tier 3 Cross-Feature & Isolation | Automated tests for IDOR prevention, combined search+tag+pin, auth transitions | M6 / E2E Track | ORIGINAL_REQUEST Acceptance §34, §37 |
| 27 | E2E Tier 4 Real-World Workflows | Automated end-to-end multi-step user scenarios and stress tests | M6 / E2E Track | ORIGINAL_REQUEST Acceptance §34 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Suite Track | Design test harness, runner, and 4-tier test suites (Tier 1-4); publish `TEST_READY.md` | none | DONE |
| 1 | DB Schema & Infrastructure | SvelteKit project initialization, Drizzle ORM schema, serverless pooling, migrations | none | DONE |
| 2 | Auth & User Isolation | Registration, login, logout, session lifecycle, hooks, compound query isolation | M1 | DONE |
| 3 | Notes Service & API | Notes CRUD, tags, pinning, search/filter, validation, API endpoints | M1, M2 | DONE |
| 4 | Svelte 5 UI & Markdown Editor | Svelte 5 runes components, responsive layout, markdown editor & preview | M2, M3 | DONE |
| 5 | Vercel Adapter & Build Config | `@sveltejs/adapter-vercel`, `.env.example`, typecheck & build validation | M1, M2, M3, M4 | IN_PROGRESS |
| 6 | Final E2E Pass & Coverage Hardening | Phase 1: 100% pass on E2E tests (Tiers 1-4). Phase 2: Adversarial coverage hardening (Tier 5) | E2E, M5 | PLANNED |

## Interface Contracts

### 1. Database & Auth Service Contract
```typescript
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tag {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
}

export interface NoteWithTags extends Note {
  tags: Tag[];
}
```

### 2. SvelteKit Server Locals & Request Hook Contract
```typescript
// src/app.d.ts
declare global {
  namespace App {
    interface Locals {
      user: { id: string; email: string } | null;
      session: { id: string; userId: string; expiresAt: Date } | null;
    }
    // interface PageData {}
  }
}
```

### 3. Notes CRUD Service Contract (`src/lib/server/notes.ts`)
```typescript
export function getNotes(userId: string, options?: { search?: string; tagId?: string; isPinned?: boolean }): Promise<NoteWithTags[]>;
export function getNoteById(userId: string, noteId: string): Promise<NoteWithTags | null>;
export function createNote(userId: string, data: { title: string; content?: string; isPinned?: boolean; tagNames?: string[] }): Promise<NoteWithTags>;
export function updateNote(userId: string, noteId: string, data: { title?: string; content?: string; isPinned?: boolean; tagNames?: string[] }): Promise<NoteWithTags | null>;
export function deleteNote(userId: string, noteId: string): Promise<boolean>;
export function getUserTags(userId: string): Promise<Tag[]>;
```
