# E2E Test Infra: SvelteKit 2 + Svelte 5 Notes Application

## Test Philosophy
- Opaque-box, requirement-driven testing based on `ORIGINAL_REQUEST.md`.
- No dependency on internal module shortcuts — all interactions test public APIs, form actions, authentication guards, and database state.
- Methodology: Category-Partition, Boundary Value Analysis (BVA), Pairwise Feature Interactions, and Real-World Workflows.

## Test Architecture
- **Test Runner**: Vitest (`pnpm test` / `pnpm vitest run`).
- **Test Database**: PostgreSQL instance (configured via `DATABASE_URL`, e.g. `postgres://moonday:moonday@localhost:5433/moonday` or dedicated test database), with automatic schema initialization via Drizzle migrations.
- **Directory Layout**:
  - `tests/unit/`: Pure functions (password hashing, markdown rendering, input validators).
  - `tests/integration/`: Service-layer and database-level integration tests (auth lifecycle, note CRUD with user isolation, cascading deletes).
  - `tests/e2e/tier1-feature-coverage.test.ts`: Tier 1 Feature Coverage (14+ tests).
  - `tests/e2e/tier2-boundary-corner.test.ts`: Tier 2 Boundary & Corner Cases (12+ tests).
  - `tests/e2e/tier3-cross-feature.test.ts`: Tier 3 Cross-Feature & Isolation (8+ tests).
  - `tests/e2e/tier4-real-world.test.ts`: Tier 4 Real-World Application Scenarios (4+ complex workflows).

## Feature Inventory & Test Coverage Mapping
| # | Feature | Source | Tier 1 Tests | Tier 2 Boundaries | Tier 3 Combinations | Tier 4 Workflows |
|---|---------|--------|:------------:|:-----------------:|:-------------------:|:----------------:|
| 1 | User Registration | ORIGINAL_REQUEST §R1 | Valid signup, unique email | Duplicate email, short password, empty email | Register -> auto login -> isolation | Onboarding flow |
| 2 | User Login & Session | ORIGINAL_REQUEST §R1 | Valid credentials, session cookie | Invalid password, non-existent user, expired session | Sliding session renewal, cross-client session | Multi-session workflow |
| 3 | User Logout | ORIGINAL_REQUEST §R1 | Logout invalidates session | Clear invalid cookie, double logout | Protected route redirect after logout | Session cleanup |
| 4 | Note Creation | ORIGINAL_REQUEST §R2 | Create note with title & content | Max title length, empty content, special characters | Create with multiple tags + pinned | Daily note-taking |
| 5 | Note Read & List | ORIGINAL_REQUEST §R2 | List own notes, read single note | Non-existent note ID, invalid UUID | List ordered by pinned then updated timestamp | Dashboard retrieval |
| 6 | Note Update | ORIGINAL_REQUEST §R2 | Update title, update content | Partial update, clear tags | Pin toggle + tag update + timestamp refresh | Note editing workflow |
| 7 | Note Delete | ORIGINAL_REQUEST §R2 | Delete note | Delete non-existent, double delete | Cascade delete of note_tags links | Cleanup workflow |
| 8 | Multi-User Isolation | ORIGINAL_REQUEST §R1 | User A cannot see User B's notes | IDOR attempt on note update/delete | Cross-user tag isolation barrier | Multi-tenant audit |
| 9 | Tags & Note-Tags | ORIGINAL_REQUEST §R2 | Add tags, list tags, filter by tag | Duplicate tags on note, empty tag name | Tag deletion, re-tagging notes | Organization workflow |
| 10 | Note Pinning | ORIGINAL_REQUEST §R2 | Pin note, unpin note | Pin multiple notes | Pinned notes sort to top in search/filter | Priority dashboard |
| 11 | Search & Filter | ORIGINAL_REQUEST §R2 | Search by title, search by content | Special regex characters, no-match search | Combined tag filter + search query + pin | Complex query workflow |
| 12 | Markdown Rendering | ORIGINAL_REQUEST §R2 | Headings, lists, code blocks, bold | Malicious script tags (XSS sanitization) | Markdown preview in note cards | Rich content workflow |
| 13 | Vercel & Deploy Config | ORIGINAL_REQUEST §R4 | Clean build output | Missing env var error handling | Adapter loading and SSR exports | Production build pass |

## Coverage Thresholds
- **Tier 1**: ≥ 14 test cases covering every functional feature.
- **Tier 2**: ≥ 12 boundary, error handling, and security test cases.
- **Tier 3**: ≥ 8 cross-feature integration and tenant-isolation test cases.
- **Tier 4**: ≥ 4 realistic end-to-end user application scenarios.
- **Total**: ≥ 38 test cases.
