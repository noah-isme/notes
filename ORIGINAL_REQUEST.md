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
