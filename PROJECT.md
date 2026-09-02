# Project: Mermaid.js Interactive Diagram Rendering in SvelteKit 2 Notes App

## Architecture
- **Framework**: SvelteKit 2.16.1 / Svelte 5.19.7 (Runes: `$state`, `$derived`, `$props`, `$effect`), TypeScript 5.7.3, Vite, Tailwind CSS / Scoped CSS, `@sveltejs/adapter-vercel`.
- **Parsing Strategy**: Isomorphic `src/lib/utils/markdown.ts` extracts ````mermaid` blocks and formats them into structured HTML containers with data attributes (`data-mermaid-code="..."`) and `<pre><code class="language-mermaid">` fallbacks.
- **Engine Singleton**: Client-only dynamic module `src/lib/utils/mermaid.ts` loads `mermaid@^11.17.2` asynchronously when `browser` is true. Configured with `securityLevel: 'strict'`, `suppressErrorRendering: true`, and custom Slate design tokens.
- **Interactive Component**: `src/lib/components/MermaidDiagram.svelte` mounts on diagram containers, performs debounced SVG rendering, renders toolbar actions (Copy Source, Copy SVG, Fullscreen modal trigger, Code toggle), provides an accessible WAI-ARIA zoom/pan modal, and handles syntax errors inline with fallback raw code.
- **Integration Points**: `src/lib/components/NoteEditor.svelte` (edit, split, preview modes) and note detail views (`MarkdownViewer.svelte`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Fenced Code Block Detection | Parse ````mermaid` fenced code blocks in markdown without breaking standard code blocks or existing HTML sanitization | M1 | ORIGINAL_REQUEST R1 |
| 2 | Client-Side Async Loading (SSR Safe) | Dynamically import and initialize Mermaid.js on client side only, preventing SSR / Node crashes on Vercel adapter | M1 | ORIGINAL_REQUEST R1 |
| 3 | Core Diagram Types Support | Render flowcharts, sequence, class, state, ER diagrams, Gantt charts, mindmaps, git graphs to responsive SVG | M1 | ORIGINAL_REQUEST R1 |
| 4 | Clean Slate Design Synchronization | Apply neutral slate theme variables (`#0f172a`, `#f8fafc`, `#e2e8f0`, `#2563eb`) to Mermaid diagrams | M1 | ORIGINAL_REQUEST R3 |
| 5 | Runes Warnings Remediation | Resolve the 6 `state_referenced_locally` warnings in `NoteEditor.svelte` and `SearchBar.svelte` for 0 warnings `pnpm check` | M1 | ORIGINAL_REQUEST R4 |
| 6 | Action Buttons (Copy Source & Copy SVG) | Copy raw mermaid source text or exported SVG XML to clipboard with visual feedback | M2 | ORIGINAL_REQUEST R3 |
| 7 | Fullscreen / Zoom Preview Modal | WAI-ARIA accessible modal dialog with interactive pan/zoom (0.25x-4.0x), reset, and keyboard navigation | M2 | ORIGINAL_REQUEST R3 |
| 8 | Resilient Error Boundary UI | Gracefully catch syntax errors without throwing; display inline error banner + toggleable fallback raw code | M2 | ORIGINAL_REQUEST R2 |
| 9 | Clean SVG Icon Set | Accessible SVG icons for copy, maximize, zoom in, zoom out, reset, code toggle, and download | M2 | ORIGINAL_REQUEST R3 |
| 10 | Live Preview Integration & Debouncing | Real-time preview in `NoteEditor.svelte` (preview/split views) and note detail views with 200ms debounce | M3 | ORIGINAL_REQUEST R2 |
| 11 | Comprehensive Vitest & Build Verification | Unit & integration tests covering all features, Tiers 1-4 passing 100%, 0 warnings on `pnpm check`, clean build | M4 | ORIGINAL_REQUEST R4 |
| 12 | Adversarial Hardening (Tier 5) | Stress test edge cases (malformed syntax, extreme sizes, concurrent re-renders, XSS vectors) | M4 | ORIGINAL_REQUEST R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| T-E2E | E2E Testing Track | Design & implement comprehensive opaque-box E2E test suite (Tiers 1-4) | none | DONE (105 tests) |
| M1 | Engine & Markdown Integration | Install `mermaid`, create `src/lib/utils/mermaid.ts`, update `markdown.ts`, fix runes warnings | none | DONE |
| M2 | UI Controls, Icons & Error Boundary | Create icon set, `src/lib/components/MermaidDiagram.svelte`, zoom modal, copy handlers, error boundary | M1 | DONE |
| M3 | NoteEditor & Live Preview Integration | Wire `MermaidDiagram` into `NoteEditor.svelte` and note views with 200ms debouncing | M2 | DONE |
| M4 | Final Milestone (E2E Pass & Hardening) | Pass 100% E2E tests, Tier 5 adversarial testing, verify 0 errors/warnings `pnpm check`, clean build | T-E2E, M3 | DONE (358 tests) |

## Interface Contracts
### `src/lib/utils/mermaid.ts`
```typescript
export interface MermaidRenderResult {
  svg: string;
  bindFunctions?: (element: Element) => void;
}

export interface MermaidRenderError {
  message: string;
  str?: string;
  hash?: any;
}

export function isMermaidSupported(): boolean;
export function initializeMermaid(theme?: 'slate' | 'default'): Promise<any>;
export function renderMermaidSvg(id: string, code: string): Promise<{ svg: string; bindFunctions?: (element: Element) => void } | { error: string }>;
export function parseMermaidSyntax(code: string): Promise<{ valid: boolean; error?: string }>;
```

### `src/lib/components/MermaidDiagram.svelte`
```typescript
interface Props {
  code: string;
  id?: string;
  title?: string;
  showControls?: boolean;
}
```

## Code Layout
- `src/lib/utils/mermaid.ts`: Mermaid client singleton, configuration, and rendering service.
- `src/lib/utils/markdown.ts`: Isomorphic markdown parser with mermaid block detection.
- `src/lib/actions/mermaid.ts`: Svelte 5 action for mounting and hydrating MermaidDiagram instances.
- `src/lib/components/MermaidDiagram.svelte`: Interactive diagram component with toolbar, error boundary, and zoom modal.
- `src/lib/components/MarkdownViewer.svelte`: Reusable markdown preview component.
- `src/lib/components/icons/`:
  - `IconCopy.svelte`, `IconMaximize.svelte`, `IconZoomIn.svelte`, `IconZoomOut.svelte`, `IconRotateCcw.svelte`, `IconCode.svelte`, `IconDownload.svelte`, `IconCheck.svelte`, `IconAlertCircle.svelte`.
- `src/lib/components/NoteEditor.svelte`: Note editor with debounced live preview and diagram integration.
- `tests/unit/mermaid.test.ts`: Unit tests for engine service, parsing, and error handling.
- `tests/unit/mermaid-components.test.ts`: Component rendering, action buttons, and modal dialog tests.
- `tests/unit/mermaid-editor.test.ts`: NoteEditor live preview, debouncing, and view mode tests.
- `tests/unit/mermaid-e2e.test.ts`: Comprehensive E2E test suite covering Tiers 1-4 (105 tests).
- `tests/unit/mermaid-adversarial.test.ts`: Tier 5 engine adversarial stress and resilience tests (36 tests).
- `tests/unit/mermaid-adversarial-ui.test.ts`: Tier 5 UI interaction and boundary stress tests (30 tests).
