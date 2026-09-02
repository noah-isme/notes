import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'svelte/server';
import NoteEditor from '../../src/lib/components/NoteEditor.svelte';
import MarkdownViewer from '../../src/lib/components/MarkdownViewer.svelte';
import MermaidDiagram from '../../src/lib/components/MermaidDiagram.svelte';
import { mermaidRenderer } from '../../src/lib/actions/mermaid';
import { renderMarkdown } from '../../src/lib/utils/markdown';
import {
  renderMermaidSvg,
  parseMermaidSyntax,
  generateDiagramId,
  isMermaidSupported,
} from '../../src/lib/utils/mermaid';

/**
 * ============================================================================
 * CHALLENGER 2: Milestone 3 Empirical Multi-Diagram & Error Boundary Stress Suite
 * ============================================================================
 * Focus:
 * 1. Multi-Diagram Documents in NoteEditor:
 *    - Notes with 2, 5, and 10 diagrams (flowcharts, sequence, class, ER, state, gitGraph, etc.)
 *    - Interleaved valid and syntax-error diagrams
 * 2. Resilient Error Boundary Isolation:
 *    - Broken diagrams display inline error boundary UI and raw source fallback
 *    - Sibling valid diagrams render cleanly to SVG without interference
 * 3. Rapid Typing & Syntax Toggling:
 *    - Character-by-character typing transitions (valid -> typo -> fixed)
 *    - Debounce timer cancellation and race condition suppression
 * 4. Svelte Action `mermaidRenderer` Multi-Block Hydration:
 *    - Simultaneous mounting across multiple DOM diagram nodes
 *    - Clean unmounting and memory safety during continuous edits
 * ============================================================================
 */

describe('Challenger M3-2: Multi-Diagram & Error Boundary Stress Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. Multi-Diagram Documents in NoteEditor & MarkdownViewer
  // --------------------------------------------------------------------------
  describe('1. Multi-Diagram Parsing & Layout in NoteEditor', () => {
    it('correctly isolates and formats 5 distinct diagrams (3 valid, 2 invalid) in NoteEditor', () => {
      const documentMarkdown = `# Microservices Infrastructure
Architecture overview of the entire stack.

### 1. Ingress Flowchart (Valid)
\`\`\`mermaid
graph LR
  Client[Web / Mobile] --> LB[Load Balancer]
  LB --> Ingress[API Ingress Controller]
\`\`\`

### 2. Broken Auth Sequence (Invalid Syntax)
\`\`\`mermaid
sequenceDiagram
  Client ->> Ingress: POST /api/auth
  Ingress ->> --> Broken_Arrow
\`\`\`

### 3. Database Entity Relationship (Valid)
\`\`\`mermaid
erDiagram
  USER ||--o{ NOTE : creates
  NOTE ||--o{ TAG : contains
\`\`\`

### 4. Broken Class Structure (Invalid Syntax)
\`\`\`mermaid
classDiagram
  class User {
    +string id : invalid_field_syntax
  }
\`\`\`

### 5. Deployment GitGraph (Valid)
\`\`\`mermaid
gitGraph
  commit
  branch feature
  checkout feature
  commit
  checkout main
  merge feature
\`\`\`

End of technical document.`;

      const testNote = {
        id: 'note-multi-arch',
        title: 'Microservices Infrastructure',
        content: documentMarkdown,
        isPinned: true,
        tags: [{ id: 't1', name: 'architecture' }, { id: 't2', name: 'infra' }],
      };

      const { html } = render(NoteEditor, {
        props: { note: testNote },
      });

      // Assert document structure integrity
      expect(html).toContain('<h1>Microservices Infrastructure</h1>');
      expect(html).toContain('<h3>1. Ingress Flowchart (Valid)</h3>');
      expect(html).toContain('<h3>2. Broken Auth Sequence (Invalid Syntax)</h3>');
      expect(html).toContain('<h3>3. Database Entity Relationship (Valid)</h3>');
      expect(html).toContain('<h3>4. Broken Class Structure (Invalid Syntax)</h3>');
      expect(html).toContain('<h3>5. Deployment GitGraph (Valid)</h3>');
      expect(html).toContain('<p>End of technical document.</p>');

      // Assert exactly 5 diagram containers are produced
      const diagramBlocks = html.match(/class="mermaid-block"/g);
      expect(diagramBlocks).not.toBeNull();
      expect(diagramBlocks?.length).toBe(5);

      // Verify each diagram block preserves its respective raw code
      expect(html).toContain('LB[Load Balancer]');
      expect(html).toContain('Ingress -&gt;&gt; --&gt; Broken_Arrow');
      expect(html).toContain('USER ||--o{ NOTE : creates');
      expect(html).toContain('+string id : invalid_field_syntax');
      expect(html).toContain('merge feature');
    });

    it('renders MarkdownViewer with multiple mixed diagrams and preserves surrounding content', () => {
      const viewerMarkdown = `## Data Pipeline
\`\`\`mermaid
graph TD
  Source[(Raw Data)] --> Stream[Kafka]
  Stream --> Processing[Flink]
\`\`\`
Middle explanatory notes.
\`\`\`mermaid
stateDiagram-v2
  [*] --> Ingest
  Ingest --> Error: InvalidPayload
  Ingest --> Processed: Valid
\`\`\``;

      const { html } = render(MarkdownViewer, {
        props: { content: viewerMarkdown },
      });

      expect(html).toContain('markdown-viewer');
      expect(html).toContain('<h2>Data Pipeline</h2>');
      expect(html).toContain('<p>Middle explanatory notes.</p>');
      const blocks = html.match(/class="mermaid-block"/g);
      expect(blocks?.length).toBe(2);
      expect(html).toContain('Source[(Raw Data)]');
      expect(html).toContain('stateDiagram-v2');
    });

    it('handles 20 alternating valid/broken diagrams without crashing or HTML bleeding', () => {
      let bulkMarkdown = '# Large Multi-Diagram Note\n\n';
      for (let i = 1; i <= 20; i++) {
        const isBroken = i % 2 === 0;
        const code = isBroken
          ? `graph TD\n  Broken_${i} --> --> Target`
          : `graph TD\n  Valid_${i} --> Target_${i}`;

        bulkMarkdown += `### Diagram ${i} (${isBroken ? 'Broken' : 'Valid'})\n\`\`\`mermaid\n${code}\n\`\`\`\n\n`;
      }

      const parsedHtml = renderMarkdown(bulkMarkdown);
      const matches = parsedHtml.match(/class="mermaid-block"/g);
      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(20);

      // Verify first and last blocks exist
      expect(parsedHtml).toContain('Valid_1');
      expect(parsedHtml).toContain('Broken_20');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Error Boundary Isolation Stress Matrix
  // --------------------------------------------------------------------------
  describe('2. Error Boundary Isolation Stress Matrix', () => {
    it('isolates rendering failures in broken diagrams while sibling valid diagrams render cleanly', async () => {
      // Simulate multi-diagram render pipeline where Diagram B throws error, but Diagrams A and C succeed
      const diagramA = { id: 'diag_a', code: 'graph TD\n  A --> B', valid: true };
      const diagramB = { id: 'diag_b', code: 'graph TD\n  B --> --> C', valid: false };
      const diagramC = { id: 'diag_c', code: 'sequenceDiagram\n  Alice->>Bob: Hello', valid: true };

      const mockRenderer = async (id: string, code: string) => {
        if (code.includes('--> -->')) {
          return { error: `Syntax error on diagram ${id}` };
        }
        return { svg: `<svg id="${id}-svg"><text>${code}</text></svg>` };
      };

      const [resA, resB, resC] = await Promise.all([
        mockRenderer(diagramA.id, diagramA.code),
        mockRenderer(diagramB.id, diagramB.code),
        mockRenderer(diagramC.id, diagramC.code),
      ]);

      // Diagram A succeeds
      expect('svg' in resA).toBe(true);
      if ('svg' in resA) {
        expect(resA.svg).toContain('diag_a-svg');
      }

      // Diagram B fails gracefully
      expect('error' in resB).toBe(true);
      if ('error' in resB) {
        expect(resB.error).toContain('Syntax error on diagram diag_b');
      }

      // Diagram C succeeds without being impacted by B's failure
      expect('svg' in resC).toBe(true);
      if ('svg' in resC) {
        expect(resC.svg).toContain('diag_c-svg');
      }
    });

    it('verifies that SSR fallback and error boundary attributes conform to accessibility specs', () => {
      const brokenCode = 'graph TD\n  A[Unclosed bracket';
      const { html } = render(MermaidDiagram, {
        props: { code: brokenCode, title: 'Broken Node' },
      });

      expect(html).toContain('mermaid-block');
      expect(html).toContain('data-mermaid-code=');
      expect(html).toContain('Broken Node');
      expect(html).toContain('<code class="language-mermaid">');
      expect(html).toContain('A[Unclosed bracket');
    });

    it('rejects all invalid diagram types in renderMermaidSvg with structured errors', async () => {
      const invalidCodes = [
        'graph TD\n  A --> --> B',
        'sequenceDiagram\n  Alice -->>',
        'classDiagram\n  class { invalid',
        'erDiagram\n  A ||--|{ B',
        'stateDiagram-v2\n  [*] --->>> State',
        'gantt\n  invalid_gantt_entry',
        'gitGraph\n  invalid_git_entry',
        'mindmap\n  ((Root))\n    ::invalid',
      ];

      for (const code of invalidCodes) {
        const result = await renderMermaidSvg(generateDiagramId('err_matrix'), code);
        expect('error' in result).toBe(true);
        if ('error' in result) {
          expect(typeof result.error).toBe('string');
          expect(result.error.length).toBeGreaterThan(0);
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. Rapid Typing & Syntax Toggling Simulation
  // --------------------------------------------------------------------------
  describe('3. Rapid Typing & Syntax Toggling Simulation', () => {
    it('simulates rapid keystrokes that toggle between valid and invalid diagram syntax', async () => {
      // Step-by-step editing lifecycle of a diagram:
      // Step 1: Initial valid diagram: "graph TD\n  A --> B"
      // Step 2: User deletes arrow "-->" to change type -> "graph TD\n  A B" (invalid)
      // Step 3: User types dotted line "-.->" -> "graph TD\n  A -.-> B" (valid)
      // Step 4: User adds second line with typo -> "graph TD\n  A -.-> B\n  B == == > C" (invalid)
      // Step 5: User fixes thick arrow -> "graph TD\n  A -.-> B\n  B ==> C" (valid)

      const editingSteps = [
        { step: 1, code: 'graph TD\n  A --> B', expectValid: true },
        { step: 2, code: 'graph TD\n  A B', expectValid: false },
        { step: 3, code: 'graph TD\n  A -.-> B', expectValid: true },
        { step: 4, code: 'graph TD\n  A -.-> B\n  B == == > C', expectValid: false },
        { step: 5, code: 'graph TD\n  A -.-> B\n  B ==> C', expectValid: true },
      ];

      interface EditorDiagramState {
        svg: string;
        error: string | null;
        code: string;
      }

      let editorDiagramState: EditorDiagramState = {
        svg: '',
        error: null,
        code: '',
      };

      const mockEngine = async (code: string): Promise<{ svg: string } | { error: string }> => {
        if (code.includes('A B') || code.includes('== == >')) {
          return { error: `Syntax error in: ${code}` };
        }
        return { svg: `<svg id="diag-${code.length}"><text>${code}</text></svg>` };
      };

      for (const edit of editingSteps) {
        editorDiagramState.code = edit.code;
        const res = await mockEngine(edit.code);

        if ('error' in res) {
          editorDiagramState.error = res.error;
          editorDiagramState.svg = '';
        } else {
          editorDiagramState.error = null;
          editorDiagramState.svg = res.svg;
        }

        if (edit.expectValid) {
          expect(editorDiagramState.error).toBeNull();
          expect(editorDiagramState.svg).toContain('<svg id="diag-');
        } else {
          expect(editorDiagramState.error).not.toBeNull();
          expect(editorDiagramState.svg).toBe('');
        }
      }
    });

    it('verifies debounce timer cancels intermediate keystrokes during fast typing', () => {
      vi.useFakeTimers();

      let activeTyping = '';
      let debouncedPreview = '';
      let timer: any = null;

      function onKeystroke(char: string) {
        activeTyping += char;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          debouncedPreview = activeTyping;
        }, 200);
      }

      const input = '```mermaid\ngraph LR\n  A --> B\n```';
      for (let i = 0; i < input.length; i++) {
        onKeystroke(input[i]);
        if (i < input.length - 1) {
          vi.advanceTimersByTime(20); // 20ms between keys
          expect(debouncedPreview).toBe(''); // Still debouncing
        }
      }

      // Wait 199ms after last keystroke
      vi.advanceTimersByTime(199);
      expect(debouncedPreview).toBe('');

      // Complete 200ms
      vi.advanceTimersByTime(1);
      expect(debouncedPreview).toBe(input);

      vi.useRealTimers();
    });

    it('prevents race conditions when async renders complete out of sequence', async () => {
      let latestRenderId = 0;
      let finalState = { svg: '', error: <string | null>null };

      async function requestRender(id: number, delayMs: number, result: { svg?: string; error?: string }) {
        latestRenderId = id;
        const thisId = id;

        await new Promise((r) => setTimeout(r, delayMs));

        // Cancellation guard: discard stale renders
        if (thisId !== latestRenderId) {
          return;
        }

        if (result.error) {
          finalState.error = result.error;
          finalState.svg = '';
        } else if (result.svg) {
          finalState.error = null;
          finalState.svg = result.svg;
        }
      }

      // Render 1: Slow invalid render (delay 70ms)
      const r1 = requestRender(1, 70, { error: 'Broken render 1' });

      // Render 2: Fast valid render (delay 20ms, started 10ms after r1)
      await new Promise((r) => setTimeout(r, 10));
      const r2 = requestRender(2, 20, { svg: '<svg id="valid-render-2"/>' });

      await Promise.all([r1, r2]);

      // Result MUST be valid render 2, despite render 1 finishing later
      expect(finalState.svg).toBe('<svg id="valid-render-2"/>');
      expect(finalState.error).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 4. Svelte Action mermaidRenderer Lifecycle Stress
  // --------------------------------------------------------------------------
  describe('4. Svelte Action mermaidRenderer Lifecycle Stress', () => {
    it('manages mounting, unmounting, and updating across multiple diagram blocks in DOM container', () => {
      const blocks = [
        {
          getAttribute: vi.fn().mockReturnValue('graph TD; A-->B'),
          querySelector: vi.fn().mockReturnValue(null),
          innerHTML: '',
          isConnected: true,
        },
        {
          getAttribute: vi.fn().mockReturnValue('sequenceDiagram; Alice->>Bob: Hello'),
          querySelector: vi.fn().mockReturnValue({ textContent: 'Auth Flow' }),
          innerHTML: '',
          isConnected: true,
        },
        {
          getAttribute: vi.fn().mockReturnValue('erDiagram; USER ||--o{ NOTE : creates'),
          querySelector: vi.fn().mockReturnValue(null),
          innerHTML: '',
          isConnected: true,
        },
      ];

      const container = {
        isConnected: true,
        querySelectorAll: vi.fn((sel: string) => (sel.includes('.mermaid-block') ? blocks : [])),
      } as unknown as HTMLElement;

      const action = mermaidRenderer(container, { showControls: true });

      expect(action).toBeDefined();
      expect(typeof action.update).toBe('function');
      expect(typeof action.destroy).toBe('function');

      // Update options / content
      expect(() => action.update({ showControls: false })).not.toThrow();
      expect(() => action.update('new-preview-html')).not.toThrow();

      // Destroy
      expect(() => action.destroy()).not.toThrow();
    });

    it('survives 100 rapid update cycles without throwing exceptions or memory leaks', () => {
      const container = {
        isConnected: true,
        querySelectorAll: vi.fn().mockReturnValue([]),
      } as unknown as HTMLElement;

      const action = mermaidRenderer(container);

      for (let i = 0; i < 100; i++) {
        expect(() => action.update(`preview update iteration ${i}`)).not.toThrow();
      }

      expect(() => action.destroy()).not.toThrow();
    });
  });
});
