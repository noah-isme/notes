# Original User Request

## Initial Request — 2026-09-02T08:50:43Z

You are the Project Orchestrator (orchestrator_2).
Your working directory is: /home/noah/project/notes/.agents/orchestrator_2
Project root: /home/noah/project/notes
Original user request file: /home/noah/project/notes/ORIGINAL_REQUEST.md

User Goal:
Execute a comprehensive UX refinement polish pass on the SvelteKit 2 + Svelte 5 Notes workspace across editor ergonomics (typography, code wrapping, dirty state, unsaved navigation guards, focus mode), view mode segmented controls, card and tag interactions, undo/delete workflows, and keyboard shortcuts.

Requirements:
- R1. Editor Ergonomics & Typography (P0):
  * Fix markdown editor width and aggressive text wrapping: ensure standard prose wraps cleanly (`white-space: pre-wrap; overflow-wrap: break-word;`) while fenced code blocks and diagram code preserve whitespace and support smooth horizontal scrolling without mangling formatting.
  * Refine editor typography: high-legibility monospace stack (`ui-monospace, "JetBrains Mono", "IBM Plex Mono", Menlo, Consolas, monospace`), ~14px font size, and 1.6 line height for generous visual breathing room.
  * Implement reactive dirty/unsaved state tracking: display an intuitive `● Unsaved changes` indicator, visually highlight the active Save button when dirty, and guard note selection/navigation with an unsaved changes confirmation dialog (`[Stay]`, `[Discard]`, `[Save]`).
- R2. View Modes, Focus Mode & Toolbar Hierarchy (P1):
  * Redesign `[ Edit | Split | Preview ]` buttons into a crisp, accessible segmented control with unmistakable active state indicator.
  * Add an Editor Focus / Fullscreen Mode (`⛶`) that collapses sidebars into a distraction-free writing canvas, escapable via button or `Esc` key.
  * Enhance note deletion UX with an immediate soft-delete flow featuring a Toast `[Undo]` action to quickly restore mistakenly deleted notes.
- R3. Note Cards, Tag Controls & Empty States (P2):
  * Note cards: expand action icon interactive hitboxes to minimum 32×32px, refine subtle hover elevations, and organize card actions cleanly with overflow protection.
  * Tag sidebar & chips: highlight active tag filter with high-contrast indicator, and refine tag creation input with clear placeholder and keyboard chip management.
  * Provide illustrated, helpful empty states for: No notes yet (`+ New Note`), No search results (`Try another search term`), and No notes tagged with `#tag`.
- R4. Keyboard Shortcuts & Diagram Interaction Polish (P3):
  * Implement global keyboard shortcuts with discoverable tooltips: `Cmd/Ctrl + K` (Focus search), `Cmd/Ctrl + N` (New note), `Cmd/Ctrl + S` (Save current note), `Esc` (Exit focus/modal), `Cmd/Ctrl + Shift + P/E/S` (Switch view modes).
  * Refine diagram reading experience by making the Mermaid diagram action toolbar subtle/hover-activated during preview mode.
  * Maintain navigation state vs document state separation to prevent losing active note context during filtering.

Quality & Verification:
- `pnpm check` passes with 0 errors and 0 warnings.
- `pnpm test` passes 100% of all unit, integration, and E2E test suites against remote PostgreSQL.
- `pnpm build` completes a production bundle successfully with `@sveltejs/adapter-vercel`.

Please decompose the problem into milestones, maintain plan.md, progress.md, and context.md in your working directory, dispatch tasks to specialist subagents (explorers, workers, reviewers, challengers, auditors), verify all quality gates, and notify me when complete.

## 2026-09-02T12:34:03Z

This is a single self-contained feature; keep it small and focused with strict low-resource constraints (max 1 worker at a time, sequential single-fork tests, deferred build).

Implement a secure, public read-only note sharing feature allowing users to generate shareable links (`/share/[token]`), toggle public sharing on/off, copy public links to clipboard, view read-only rendered markdown with Mermaid diagrams and author attribution without requiring an account.

Working directory: /home/noah/project/notes
Integrity mode: development

## Requirements

### R1. Database Schema & Data Access Layer for Public Sharing
- Add support for public note sharing in the database schema: `is_public` boolean (default `false`) and `share_token` (nullable text / varchar with unique index) on the `notes` table or dedicated share relationship.
- Provide backend functions in `src/lib/server/notes.ts`:
  - `enableShare(userId: string, noteId: string)`: generates a cryptographically random, unguessable URL-safe token (e.g. 16-24 bytes hex/base64url) and sets `is_public = true`.
  - `disableShare(userId: string, noteId: string)`: sets `is_public = false` and revokes public access.
  - `regenerateShareToken(userId: string, noteId: string)`: rotates the token immediately, invalidating previous links.
  - `getPublicNoteByToken(token: string)`: retrieves public note, author name/display details, tags, and content if `is_public === true`. Returns `null` if private or token does not exist.
- Ensure strict tenant isolation: only the note owner can toggle sharing or regenerate share tokens.

### R2. Public Note Read-Only Route & UI (`/share/[token]`)
- Create a dedicated public route `src/routes/(public)/share/[token]/+page.svelte` (and `+page.server.ts`) accessible to unauthenticated guests.
- Render full Markdown with interactive Mermaid.js diagram viewer (with zoom modal, download SVG, and copy source), tags list, author display name, and last updated date.
- Present a clean, distraction-free, responsive reading interface matching the app's anti-vibecoded design system, with a subtle header ("Notes" brand + "Sign in / Get Started" link).
- Handle invalid, disabled, or non-existent share tokens gracefully with a clear 404 / "Note is private or not found" page with a return to home button.

### R3. Share Management Controls in Note Workspace
- Add a "Share" action button in the note toolbar in `NoteEditor.svelte` with visual indicator of sharing state.
- Provide an accessible Share Dialog / Popover:
  - Toggle switch for "Public Link Sharing" (Enable / Disable).
  - Share URL display with instant "Copy Link" button and toast notification.
  - "Regenerate Link" action to invalidate previous URLs.
- Ensure state synchronization: updating note content immediately reflects on the public view, while revoking sharing immediately returns 404 to public visitors.

### R4. Security, Performance & Resource Discipline
- Cryptographically secure token generation (`crypto.randomBytes`).
- SSR-rendered public page for instantaneous loading and SEO friendliness, safe from XSS via sanitized markdown.
- Low-resource execution constraints: single active worker, sequential single-fork test runner (`--pool=forks --poolOptions.forks.singleFork=true`), deferred single build at the end.

## Acceptance Criteria

### Security & Sharing Lifecycle
- [ ] Only the note owner can enable, disable, or regenerate the share link for their note; unauthorized users receive 403 Forbidden.
- [ ] Disabled or non-existent share tokens return a semantic 404 Not Found error page.
- [ ] Unauthenticated users can view public notes via `/share/[token]` without logging in or being redirected to `/login`.
- [ ] Public notes cannot be edited, deleted, or pinned by public viewers.
- [ ] Regenerating a share token immediately invalidates the old URL.

### Public View Rendering
- [ ] Public share page renders Markdown formatting, syntax-highlighted code blocks, and interactive Mermaid diagrams seamlessly.
- [ ] Author display name and last updated date are clearly visible on the public page.
- [ ] Responsive layout adapts cleanly to desktop and mobile viewports.

### Quality & Verification
- [ ] Automated integration & unit tests covering token generation, public fetch, access revocation, rotation, and unauthorized attempts.
- [ ] `pnpm check` passes with 0 errors and 0 warnings.
- [ ] `pnpm test` passes 100% of all unit, integration, and E2E test suites against remote PostgreSQL.
- [ ] `pnpm build` creates a production bundle successfully with `@sveltejs/adapter-vercel`.
