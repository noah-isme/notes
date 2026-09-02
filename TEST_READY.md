# Test Suite Documentation: SvelteKit 2 + Svelte 5 Notes Application

## Overview & Philosophy
The test infrastructure is constructed following an **opaque-box, requirement-driven, 4-tier test architecture** in accordance with `PROJECT.md` and `ORIGINAL_REQUEST.md`.
Testing is strictly isolated, deterministic, and self-contained with automatic database cleanup and per-test isolation.

## Test Runner & Infrastructure
- **Test Framework**: Vitest v2.1+
- **Environment**: Node.js test environment with path aliases (`$lib` -> `./src/lib`, `$app` mock harnesses)
- **Database**: PostgreSQL with Drizzle ORM serverless connection pooling
- **Test Setup**: `tests/setup.ts` & `tests/helpers/db.ts` for database cleanup and fixture factories

## Test Scripts (`package.json`)
```bash
# Run all automated test suites
pnpm test

# Run Unit tests only
pnpm test:unit

# Run Integration tests only
pnpm test:integration

# Run 4-Tier E2E test suites
pnpm test:e2e

# Run Vitest in interactive watch mode
pnpm test:watch
```

---

## Test Suite Inventory & Coverage Matrix

### 1. Unit Tests (`tests/unit/`)
| Test File | Target Module | Coverage Summary | Test Count |
|-----------|---------------|------------------|:----------:|
| `password.test.ts` | `$lib/server/auth` | Cryptographic scrypt hashing, per-user salt randomness, password verification, unicode passwords, 128-char passwords, corrupted hash handling | 9 |
| `markdown.test.ts` | `$lib/utils/markdown` | Headings, bold/italic formatting, lists, code blocks, blockquotes, links, and adversarial XSS sanitization (`<script>`, `onerror`, `onload`, `javascript:`, data URIs, SVGs, iframes) | 13 |
| `validation.test.ts` | `$lib/utils/validation` | Email RFC compliance, password minimum length, note title limits (1-200 chars), note content handling, tag naming rules | 13 |

### 2. Integration Tests (`tests/integration/`)
| Test File | Target Module | Coverage Summary | Test Count |
|-----------|---------------|------------------|:----------:|
| `db-schema.test.ts` | `$lib/server/db` | Table definitions, unique email constraints, foreign key cascades (`users` -> `sessions`/`notes`/`tags`), compound uniqueness `(userId, tag name)`, junction table `note_tags` cascade integrity | 7 |
| `auth-service.test.ts` | `$lib/server/auth` | Session creation, token validation, 30-day expiration, sliding window extension, single session invalidation, multi-device global logout | 5 |
| `notes-service.test.ts` | `$lib/server/notes` | Note creation with tags, single note lookup, user note listing, search by title/content, tag filtering, pin filtering, update note & tag sync, delete note & junction cleanup, strict user isolation | 8 |

### 3. E2E 4-Tier Test Suites (`tests/e2e/`)

#### Tier 1: Feature Coverage (`tier1-feature-coverage.test.ts`)
*Threshold requirement: ≥ 14 test cases covering every feature in isolation.*
*Delivered: 17 test cases.*
- **F1**: User registration with salted password hashing.
- **F2**: User login and session creation with 30-day token.
- **F3**: Session validation and identity resolution.
- **F4**: User logout and session destruction.
- **F5**: Note creation with title and markdown content.
- **F6**: Note retrieval by ID with attached tags.
- **F7**: User notes listing.
- **F8**: Note update for title, content, and `updatedAt` timestamp.
- **F9**: Note deletion.
- **F10**: Note pinning (`isPinned = true`).
- **F11**: Note unpinning (`isPinned = false`).
- **F12**: Multiple tag assignment upon creation.
- **F13**: Tag modification and synchronization on existing note.
- **F14**: Note search by title keywords.
- **F15**: Note search by content keywords.
- **F16**: Note filtering by tag ID.
- **F17**: User unique tags retrieval.

#### Tier 2: Boundary & Corner Cases (`tier2-boundary-corner.test.ts`)
*Threshold requirement: ≥ 12 test cases covering edge conditions, security & adversarial inputs.*
*Delivered: 16 test cases.*
- **B1**: Duplicate email registration rejection.
- **B2**: Invalid email format rejection (suite of malformed emails).
- **B3**: Short (< 6/8 chars) and empty password rejection.
- **B4**: Login with invalid password rejection.
- **B5**: Login with non-existent user email handling.
- **B6**: Note creation with empty/whitespace-only title rejection.
- **B7**: Title max length boundary (200 chars allowed, 201 chars rejected).
- **B8**: Large note markdown content payload handling (~50KB).
- **B9**: Aggressive XSS attack vectors sanitization.
- **B10**: SQL injection payloads in search query safely parameterized.
- **B11**: IDOR Read attempt blocked: User B cannot read User A's private note.
- **B12**: IDOR Update attempt blocked: User B cannot update User A's note.
- **B13**: IDOR Delete attempt blocked: User B cannot delete User A's note.
- **B14**: Cascading delete integrity: Deleting a note cascades `note_tags` without deleting tags.
- **B15**: Cascading delete user: Deleting user deletes all notes, tags, and sessions.
- **B16**: Unicode & special character preservation (Emojis, CJK, Arabic, Cyrillic).

#### Tier 3: Cross-Feature & Isolation (`tier3-cross-feature.test.ts`)
*Threshold requirement: ≥ 8 test cases covering compound features and multi-tenant isolation.*
*Delivered: 8 test cases.*
- **CF1**: Full multi-tenant isolation with identical note titles and tag names across users.
- **CF2**: Combined multi-facet filtering (Tag filter + Keyword Search Query + Pinned status).
- **CF3**: Deterministic sort ordering (Pinned notes first, then timestamp descending).
- **CF4**: Tag lifecycle & multi-note association integrity.
- **CF5**: Sliding session expiration renewal.
- **CF6**: Expired session token rejection and automatic DB cleanup.
- **CF7**: Cross-tenant tag ID query barrier (no cross-user note disclosure).
- **CF8**: Multi-device concurrent sessions & granular session invalidation.

#### Tier 4: Real-World Workflows (`tier4-real-world.test.ts`)
*Threshold requirement: ≥ 4 end-to-end multi-step application scenarios.*
*Delivered: 4 comprehensive scenarios.*
- **RW1 (Onboarding & First Note Lifecycle)**: User signup -> login -> create first note with `#onboarding` -> edit with markdown checklist -> pin note -> search note -> logout -> session invalidation verification.
- **RW2 (Knowledge Worker Productivity Workflow)**: User logs in -> creates Standup note, Architecture RFC (pinned), and Scratchpad note -> updates RFC with markdown code/table -> lists notes (pinned first) -> filters by `#work` tag -> searches for "PostgreSQL" -> deletes scratchpad -> verifies remaining notes.
- **RW3 (Multi-Tenant Security & Isolation Audit)**: Alice & Bob register -> both create notes with identical titles and tags -> Alice searches "Confidential" -> Bob searches "Confidential" -> Alice attempts IDOR read/update/delete on Bob's note -> all blocked -> Bob deletes his note -> Alice's data remains 100% intact.
- **RW4 (Tag Restructuring & Multi-Facet Query Workflow)**: User creates 5 notes across domains -> reorganizes tags -> executes multi-facet searches -> filters pinned notes -> deletes selected notes -> verifies junction cascade integrity and remaining notes.

---

## Total Test Metrics
- **Unit Tests**: 35 test cases
- **Integration Tests**: 20 test cases
- **Tier 1 Feature Coverage Tests**: 17 test cases
- **Tier 2 Boundary & Corner Cases Tests**: 16 test cases
- **Tier 3 Cross-Feature & Isolation Tests**: 8 test cases
- **Tier 4 Real-World Workflows**: 4 test cases
- **Total Test Cases**: 100 test cases across 10 test files.
- **Target Coverage**: 100% feature coverage of all functional, security, and multi-tenant isolation requirements from `PROJECT.md` and `ORIGINAL_REQUEST.md`.
