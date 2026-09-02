# Project: SvelteKit 2 + Svelte 5 Notes UX Polish Pass

## Architecture
- **Framework**: SvelteKit 2.50+ with Svelte 5.50+ runes (`$state`, `$derived`, `$props`, `$effect`, `$derived.by`).
- **Database & Backend**: Drizzle ORM + PostgreSQL + SvelteKit server actions (`+page.server.ts`).
- **Layout Architecture**: 3-pane responsive layout (`src/routes/(app)/+page.svelte`):
  1. `pane-sidebar`: Tag navigation & system views.
  2. `pane-master-list`: Note search, active tag header, and note cards list (`NoteList.svelte`, `NoteCard.svelte`).
  3. `pane-detail-editor`: Note editor, toolbar, segmented view controls, and markdown/mermaid preview (`NoteEditor.svelte`, `MarkdownViewer.svelte`, `MermaidDiagram.svelte`).
- **Notification Subsystem**: Reactive Toast store (`src/lib/stores/toast.svelte.ts`) with interactive action handlers (`[Undo]`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1.1 | Editor Prose Wrapping | Editor textarea standard prose wraps cleanly (`white-space: pre-wrap; overflow-wrap: break-word; tab-size: 2;`) | M1 | R1 |
| F1.2 | Code Block Horizontal Scrolling | Fenced code blocks & diagrams preserve whitespace (`white-space: pre; overflow-x: auto; word-break: normal;`) without mangling formatting | M1 | R1 |
| F1.3 | Monospace Typography | High-legibility font stack (`ui-monospace, "JetBrains Mono", "IBM Plex Mono", Menlo, Consolas, monospace`), ~14px font size, 1.6 line height | M1 | R1 |
| F1.4 | Reactive Dirty State Indicator | Reactive dirty tracking displaying `● Unsaved changes` badge and visual highlight on Save button | M1 | R1 |
| F1.5 | Unsaved Changes Navigation Guard | Confirmation dialog with `[Stay]`, `[Discard]`, `[Save]` guarding note switching, route navigation, and tab unload | M1 | R1 |
| F2.1 | Segmented View Mode Controls | Accessible segmented control for `[ Edit | Split | Preview ]` with clear active indicator and ARIA roles | M2 | R2 |
| F2.2 | Editor Focus / Fullscreen Mode | Focus mode (`⛶`) collapsing sidebars into distraction-free canvas, escapable via button or `Esc` | M2 | R2 |
| F2.3 | Soft-Delete with Undo Toast | Immediate soft-delete with 6-second deferred timer and interactive Toast `[Undo]` button | M2 | R2 |
| F3.1 | Note Card Hitboxes & Elevation | Expand action icon hitboxes to ≥32×32px, subtle hover elevations and smooth transitions | M3 | R3 |
| F3.2 | Card Actions Overflow Protection | Flex layout overflow safety (`min-width: 0` on title) and clean action grouping | M3 | R3 |
| F3.3 | Tag Filters & Input Polish | High-contrast active tag chip, clear placeholder, and keyboard tag chip management (Enter/Backspace/Delete) | M3 | R3 |
| F3.4 | Illustrated Empty States | 3 dedicated empty states: No notes yet (`+ New Note`), No search results (`Try another search term`), and No notes tagged with `#tag` | M3 | R3 |
| F4.1 | Global Keyboard Shortcuts & Tooltips | `Cmd/Ctrl+K` (Search), `Cmd/Ctrl+N` (New note), `Cmd/Ctrl+S` (Save), `Esc` (Exit focus/modal), `Cmd/Ctrl+Shift+P/E/S` (View modes) with tooltips | M4 | R4 |
| F4.2 | Subtle Diagram Hover Toolbar | Mermaid action toolbar made subtle / hover-activated during preview mode | M4 | R4 |
| F4.3 | Navigation vs Document State Decoupling | Decouple search/tag list filtering from active editor note selection to prevent losing active note context | M4 | R4 |
| F5.1 | E2E Test Suite (Tiers 1-4) | Comprehensive opaque-box test suite verifying all UX features across all tiers | M5 | E2E Track |
| F5.2 | Adversarial Hardening (Tier 5) | White-box edge-case and stress tests | M5 | E2E Track |
| F5.3 | Final Quality Verification | `pnpm check` (0 errors/warnings), `pnpm test` (100% pass), `pnpm build` clean bundle | M5 | Verification |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Editor Ergonomics & Dirty State | F1.1, F1.2, F1.3, F1.4, F1.5 (`NoteEditor.svelte`, `MarkdownViewer.svelte`, `+page.svelte`) | none | DONE |
| M2 | View Modes, Focus Mode & Undo UX | F2.1, F2.2, F2.3 (`NoteEditor.svelte`, `Toast.svelte`, `toast.svelte.ts`, `+page.svelte`, `+page.server.ts`) | M1 | DONE |
| M3 | Cards, Tags & Illustrated Empty States | F3.1, F3.2, F3.3, F3.4 (`NoteCard.svelte`, `TagFilter.svelte`, `NoteList.svelte`, `+page.svelte`) | M2 | PLANNED |
| M4 | Keyboard Shortcuts, Diagram Polish & Context State | F4.1, F4.2, F4.3 (`+page.svelte`, `MermaidDiagram.svelte`, `NoteEditor.svelte`) | M3 | PLANNED |
| M5 | E2E Integration & Quality Gates | F5.1, F5.2, F5.3 (Tiers 1-4 100% pass, Tier 5 hardening, pnpm check/test/build) | M1, M2, M3, M4 | PLANNED |

## Interface Contracts
### NoteEditor ↔ Dashboard Navigation (+page.svelte)
- `isDirty`: boolean exposed or managed with confirmation interceptor when switching `activeNoteId`.
- `focusMode`: boolean state toggled in `NoteEditor` and bound to layout container class `.master-detail-layout.focus-mode`.
- `onSave`: async function returning boolean or resolving on successful persistence.
- `onDelete`: triggers soft-delete flow with toast action undo.

### Toast Store (toast.svelte.ts)
- `show(message: string, type: 'info' | 'success' | 'warning' | 'error', options?: { duration?: number, action?: { label: string, onClick: () => void } }): string`
- `dismiss(id: string): void`

## Code Layout
- `src/lib/components/NoteEditor.svelte`: Note editor, view controls, dirty indicator, focus mode toggle, markdown textarea.
- `src/lib/components/MarkdownViewer.svelte`: Rendered markdown viewer with code block horizontal scroll and font styles.
- `src/lib/components/MermaidDiagram.svelte`: Mermaid diagram renderer and hover-activated toolbar.
- `src/lib/components/NoteCard.svelte`: Note card item with expanded interactive hitboxes, hover elevation, and overflow handling.
- `src/lib/components/NoteList.svelte`: Master notes list with dedicated illustrated empty states.
- `src/lib/components/TagFilter.svelte`: Tag list sidebar with active highlight and tag input keyboard management.
- `src/lib/components/Toast.svelte`: Toast container with interactive action button.
- `src/lib/stores/toast.svelte.ts`: Toast reactive state with action support.
- `src/routes/(app)/+page.svelte`: Root dashboard layout, keyboard shortcuts, navigation guards, focus mode layout class, and state decoupling.
- `tests/unit/`: Unit test suite (Vitest).
- `tests/e2e/`: E2E test suite.
