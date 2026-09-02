# Original User Request

## 2026-09-02T05:49:36Z

Implement rich, interactive diagram rendering using Mermaid.js in the SvelteKit 2 (Svelte 5) Notes application, supporting flowcharts, sequence diagrams, class diagrams, ER diagrams, state diagrams, and mindmaps with live preview, resilient error handling, and diagram controls.

Working directory: /home/noah/project/notes
Integrity mode: development

## Requirements

### R1. Markdown Diagram Parsing & Mermaid Engine Integration
- Support fenced code blocks with language `mermaid` (e.g., ` ```mermaid \n flowchart TD \n A-->B \n ``` `) in the markdown parser and note renderer.
- Asynchronously load and initialize Mermaid.js on the client side to maintain fast initial page loads and full compatibility with serverless SSR (Vercel runtime).
- Render flowcharts, sequence diagrams, class diagrams, state diagrams, ER diagrams, Gantt charts, mindmaps, and git graphs into clean, responsive SVG elements.

### R2. Live Preview & Resilient Error Boundaries
- Automatically render diagrams in real-time inside `NoteEditor.svelte` (preview and split views) and note detail view.
- Implement robust error boundaries for diagram syntax errors during live typing: display an informative inline syntax error alert while gracefully falling back to formatted raw code, preventing editor crashes or preview blanking.
- Debounce rendering appropriately so typing in the editor remains buttery smooth with zero UI lag.

### R3. Diagram UI Controls & Anti-Vibecoded Styling
- Provide unobtrusive toolbar actions for rendered diagrams: Copy Diagram Source, Copy/Download SVG, and Fullscreen/Zoom preview modal.
- Style diagrams with crisp, high-contrast aesthetics matching the app's clean slate design system (readable typography, crisp strokes, professional palette).

### R4. Performance & Test Coverage
- Comprehensive unit and integration test suites testing diagram detection in markdown, SVG container generation, syntax error resilience, and component lifecycle.
- Zero type errors on `pnpm check` and clean production build with `pnpm build`.

## Acceptance Criteria

### Diagram Rendering & Types
- [ ] Valid ` ```mermaid ` code blocks render as interactive SVG diagrams across flowcharts, sequence, class, state, and ER diagrams.
- [ ] Non-mermaid code blocks (`typescript`, `bash`, `json`, etc.) continue to render as syntax-highlighted code blocks without interference.

### Error Handling & Live Editing
- [ ] Malformed or incomplete Mermaid syntax renders an inline warning banner with fallback code display without throwing unhandled exceptions or breaking the preview pane.
- [ ] Real-time updates in the editor trigger reactive diagram re-rendering with proper debouncing and memory leak prevention (cleaning up previous SVG elements).

### UI Controls & Accessibility
- [ ] Diagram containers include action buttons (Copy Source, Copy SVG, Fullscreen view) with accessible ARIA labels and clean SVG icons.
- [ ] Responsive design functions seamlessly across desktop and mobile viewports.

### Quality Gates
- [ ] Automated Vitest test suite covering diagram parsing and rendering helpers.
- [ ] `pnpm check` completes with 0 errors and 0 warnings.
- [ ] `pnpm test` passes 100% of test suites.
- [ ] `pnpm build` creates a production build successfully with `@sveltejs/adapter-vercel`.
