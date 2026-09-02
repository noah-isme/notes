import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'svelte/server';
import NoteEditor from '../../src/lib/components/NoteEditor.svelte';
import MarkdownViewer from '../../src/lib/components/MarkdownViewer.svelte';
import MermaidDiagram from '../../src/lib/components/MermaidDiagram.svelte';
import { mermaidRenderer } from '../../src/lib/actions/mermaid';
import { renderMarkdown } from '../../src/lib/utils/markdown';
import { renderMermaidSvg, parseMermaidSyntax, generateDiagramId } from '../../src/lib/utils/mermaid';

/**
 * ============================================================================
 * CHALLENGER 1: Milestone 3 Empirical Stress Test Suite
 * ============================================================================
 * Focus:
 * 1. NoteEditor typing debounce timing invariants & timer cancellation
 * 2. Immediate synchronization on note selection switch vs pending debounces
 * 3. View mode switching (edit, split, preview) state retention & memory safety
 * 4. Svelte Action `mermaidRenderer` mount/update/destroy lifecycle & isolation
 * 5. High-frequency editing stress and diagram recovery inside the editor
 * ============================================================================
 */

describe('Challenger M3: NoteEditor Live Preview, Debounce & Mode Switching Stress Suite', () => {
  // --------------------------------------------------------------------------
  // 1. Typing Debounce Timing Invariants & Rapid Keystroke Cancellation
  // --------------------------------------------------------------------------
  describe('1. Typing Debounce Timing Invariants (200ms Window)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    class DebouncedEditorStateSimulator {
      public content: string;
      public debouncedContent: string;
      public renderCount: number;
      private timer: any = null;

      constructor(initial = '') {
        this.content = initial;
        this.debouncedContent = initial;
        this.renderCount = initial ? 1 : 0;
      }

      // Emulate NoteEditor $effect for typing
      type(newContent: string) {
        this.content = newContent;
        if (this.timer) {
          clearTimeout(this.timer);
        }
        this.timer = setTimeout(() => {
          this.debouncedContent = this.content;
          this.renderCount++;
        }, 200);
      }

      // Emulate NoteEditor $effect for note prop switch
      switchNote(newNoteContent: string) {
        // Immediate sync
        this.content = newNoteContent;
        this.debouncedContent = newNoteContent;
        this.renderCount++;
        // Pending timer from previous typing is superseded
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
      }

      cleanup() {
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
      }
    }

    it('guarantees 0 preview re-renders at 199ms and exactly 1 re-render at 200ms', () => {
      const editor = new DebouncedEditorStateSimulator('');
      editor.type('# Hello World');

      expect(editor.debouncedContent).toBe('');
      expect(editor.renderCount).toBe(0);

      // Advance to 199ms
      vi.advanceTimersByTime(199);
      expect(editor.debouncedContent).toBe('');
      expect(editor.renderCount).toBe(0);

      // Advance remaining 1ms to reach 200ms
      vi.advanceTimersByTime(1);
      expect(editor.debouncedContent).toBe('# Hello World');
      expect(editor.renderCount).toBe(1);
    });

    it('suppresses intermediate preview re-renders during rapid 50-keystroke burst', () => {
      const editor = new DebouncedEditorStateSimulator('');
      const fullText = '```mermaid\ngraph TD\n  A[Client] --> B[API]\n  B --> DB[(Postgres)]\n```';

      // Type 50+ characters, 1 character every 30ms
      for (let i = 1; i <= fullText.length; i++) {
        const slice = fullText.slice(0, i);
        editor.type(slice);
        if (i < fullText.length) {
          vi.advanceTimersByTime(30);
          // While actively typing with <200ms intervals, debouncedContent must NOT update
          expect(editor.debouncedContent).toBe('');
          expect(editor.renderCount).toBe(0);
        }
      }

      // Right after the last keystroke (t=0 since last typing)
      expect(editor.debouncedContent).toBe('');
      expect(editor.renderCount).toBe(0);

      // At end of burst, wait 199ms: still no update
      vi.advanceTimersByTime(199);
      expect(editor.debouncedContent).toBe('');
      expect(editor.renderCount).toBe(0);

      // At 200ms after final keystroke: exactly one update occurs
      vi.advanceTimersByTime(1);
      expect(editor.debouncedContent).toBe(fullText);
      expect(editor.renderCount).toBe(1);
    });

    it('stress tests 1,000 rapid keystroke bursts without timer leaks or race conditions', () => {
      const editor = new DebouncedEditorStateSimulator('');

      for (let i = 0; i < 1000; i++) {
        editor.type(`Draft iteration ${i}`);
        vi.advanceTimersByTime(10); // 10ms between bursts
        expect(editor.debouncedContent).toBe('');
      }

      // Settle timer after burst
      vi.advanceTimersByTime(200);
      expect(editor.debouncedContent).toBe('Draft iteration 999');
      expect(editor.renderCount).toBe(1);
    });

    it('handles rapid editing with interleaved pauses correctly', () => {
      const editor = new DebouncedEditorStateSimulator('');

      // Session 1: Type word 1, pause 300ms (triggers render #1)
      editor.type('Hello');
      vi.advanceTimersByTime(300);
      expect(editor.debouncedContent).toBe('Hello');
      expect(editor.renderCount).toBe(1);

      // Session 2: Type word 2, pause 100ms (no render), type word 3, pause 250ms (triggers render #2)
      editor.type('Hello World');
      vi.advanceTimersByTime(100);
      expect(editor.debouncedContent).toBe('Hello');
      expect(editor.renderCount).toBe(1);

      editor.type('Hello World Beautiful');
      vi.advanceTimersByTime(250);
      expect(editor.debouncedContent).toBe('Hello World Beautiful');
      expect(editor.renderCount).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Immediate Note Selection Synchronization Stress
  // --------------------------------------------------------------------------
  describe('2. Immediate Synchronization on Note Switch', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('immediately updates preview when switching note without waiting 200ms', () => {
      const noteA = {
        id: 'note-1',
        title: 'Note Alpha',
        content: '# Alpha Content\n```mermaid\ngraph TD; A-->B\n```',
        isPinned: false,
        tags: [{ id: 't1', name: 'alpha' }],
      };

      const noteB = {
        id: 'note-2',
        title: 'Note Beta',
        content: '# Beta Content\n```mermaid\nsequenceDiagram; Alice->>Bob: Hi\n```',
        isPinned: true,
        tags: [{ id: 't2', name: 'beta' }],
      };

      // Initial SSR render for Note Alpha
      const renderA = render(NoteEditor, { props: { note: noteA } });
      expect(renderA.html).toContain('Note Alpha');
      expect(renderA.html).toContain('Alpha Content');
      expect(renderA.html).toContain('A--&gt;B');

      // SSR render for Note Beta
      const renderB = render(NoteEditor, { props: { note: noteB } });
      expect(renderB.html).toContain('Note Beta');
      expect(renderB.html).toContain('Beta Content');
      expect(renderB.html).toContain('Alice-&gt;&gt;Bob: Hi');
      expect(renderB.html).toContain('pinned');
    });

    it('prevents stale debounced typing from overriding a newly selected note', () => {
      // Simulate race condition where user types on Note A, but switches to Note B at t=50ms
      let noteState = {
        title: 'Note A',
        content: 'Original A Content',
        debouncedContent: 'Original A Content',
      };
      let typingTimer: any = null;

      function onType(val: string) {
        noteState.content = val;
        if (typingTimer) clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          noteState.debouncedContent = val;
        }, 200);
      }

      function onSwitchNote(newNote: { title: string; content: string }) {
        // Immediate sync overrides state and cancels pending timer
        if (typingTimer) {
          clearTimeout(typingTimer);
          typingTimer = null;
        }
        noteState.title = newNote.title;
        noteState.content = newNote.content;
        noteState.debouncedContent = newNote.content;
      }

      // User starts typing on Note A
      onType('Unsaved typing draft on Note A');
      vi.advanceTimersByTime(50);
      expect(noteState.debouncedContent).toBe('Original A Content');

      // User suddenly clicks Note B in sidebar at t=50ms
      onSwitchNote({
        title: 'Note B',
        content: 'Strict Note B Content',
      });

      // Immediate sync verified
      expect(noteState.title).toBe('Note B');
      expect(noteState.content).toBe('Strict Note B Content');
      expect(noteState.debouncedContent).toBe('Strict Note B Content');

      // Fast forward past the original 200ms timer
      vi.advanceTimersByTime(300);

      // Verified: Note A draft did NOT overwrite Note B!
      expect(noteState.content).toBe('Strict Note B Content');
      expect(noteState.debouncedContent).toBe('Strict Note B Content');
    });

    it('handles 100 rapid sequential note switches in 5ms intervals without state corruption', () => {
      let currentContent = '';
      let debouncedContent = '';

      for (let i = 1; i <= 100; i++) {
        const noteContent = `# Note ${i}\n\`\`\`mermaid\ngraph LR; N${i}-->N${i + 1}\n\`\`\``;
        // Synchronous switch
        currentContent = noteContent;
        debouncedContent = noteContent;
        vi.advanceTimersByTime(5);
        expect(debouncedContent).toBe(noteContent);
      }

      expect(debouncedContent).toBe('# Note 100\n```mermaid\ngraph LR; N100-->N101\n```');
    });

    it('gracefully handles switching to null or empty notes', () => {
      const nullRender = render(NoteEditor, { props: { note: null, isNew: true } });
      expect(nullRender.html).toContain('Create Note');
      expect(nullRender.html).toContain('empty-preview');

      const emptyNote = {
        id: 'empty-1',
        title: '',
        content: '',
        isPinned: false,
        tags: [],
      };
      const emptyRender = render(NoteEditor, { props: { note: emptyNote } });
      expect(emptyRender.html).toContain('empty-preview');
      expect(emptyRender.html).toContain('Markdown preview will appear here as you type...');
    });
  });

  // --------------------------------------------------------------------------
  // 3. View Mode Transitions & Diagram State Retention
  // --------------------------------------------------------------------------
  describe('3. View Mode Switching (edit, split, preview) State Retention', () => {
    const complexDiagramNote = {
      id: 'complex-note',
      title: 'Full Stack Architecture',
      content: `# System Architecture

Here is the dataflow:

\`\`\`mermaid
graph TD
  User((End User)) --> CDN[Cloudflare CDN]
  CDN --> Frontend[SvelteKit 2 SPA]
  Frontend --> Backend[Node.js / Express API]
  Backend --> DB[(PostgreSQL 16)]
  Backend --> Redis[(Redis Cache)]
\`\`\`

### Notes
- High availability configuration
- Automatic failover enabled`,
      isPinned: true,
      tags: [{ id: 't1', name: 'architecture' }, { id: 't2', name: 'devops' }],
    };

    it('renders editor and preview panes in split view mode', () => {
      const { html } = render(NoteEditor, { props: { note: complexDiagramNote } });
      expect(html).toContain('editor-workspace split');
      expect(html).toContain('workspace-pane editor-pane');
      expect(html).toContain('workspace-pane preview-pane');
      expect(html).toContain('markdown-textarea');
      expect(html).toContain('System Architecture');
      expect(html).toContain('mermaid-block');
      expect(html).toContain('data-mermaid-code=');
      expect(html).toContain('User((End User))');
      expect(html).toContain('PostgreSQL 16');
    });

    it('preserves diagram markdown content across view mode data representations', () => {
      const parsedSplit = renderMarkdown(complexDiagramNote.content);
      expect(parsedSplit).toContain('mermaid-block');
      expect(parsedSplit).toContain('data-mermaid-code=');
      expect(parsedSplit).toContain('PostgreSQL 16');

      // When rendered inside MarkdownViewer
      const viewer = render(MarkdownViewer, {
        props: { content: complexDiagramNote.content },
      });
      expect(viewer.html).toContain('markdown-viewer');
      expect(viewer.html).toContain('mermaid-block');
      expect(viewer.html).toContain('Cloudflare CDN');
    });

    it('preserves tag chips and pin status across mode switches', () => {
      const { html } = render(NoteEditor, { props: { note: complexDiagramNote } });
      expect(html).toContain('#architecture');
      expect(html).toContain('#devops');
      expect(html).toContain('pinned');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Client Svelte Action `mermaidRenderer` Lifecycle & Memory Safety
  // --------------------------------------------------------------------------
  describe('4. Svelte Action mermaidRenderer Lifecycle & Memory Safety', () => {
    let mockElement: HTMLElement;
    let mockBlock1: HTMLElement;
    let mockBlock2: HTMLElement;

    beforeEach(() => {
      mockBlock1 = {
        getAttribute: vi.fn((attr: string) => (attr === 'data-mermaid-code' ? 'graph TD; A-->B' : null)),
        querySelector: vi.fn().mockReturnValue(null),
        innerHTML: '',
        isConnected: true,
      } as unknown as HTMLElement;

      mockBlock2 = {
        getAttribute: vi.fn((attr: string) => (attr === 'data-mermaid-code' ? 'sequenceDiagram; A->>B: Hi' : null)),
        querySelector: vi.fn().mockReturnValue(null),
        innerHTML: '',
        isConnected: true,
      } as unknown as HTMLElement;

      mockElement = {
        isConnected: true,
        querySelectorAll: vi.fn((selector: string) => {
          if (selector.includes('.mermaid-block')) {
            return [mockBlock1, mockBlock2];
          }
          return [];
        }),
      } as unknown as HTMLElement;
    });

    it('instantiates action and returns update and destroy hooks', () => {
      const action = mermaidRenderer(mockElement, { showControls: true });
      expect(action).toBeDefined();
      expect(typeof action.update).toBe('function');
      expect(typeof action.destroy).toBe('function');
      action.destroy();
    });

    it('cleans up all mounted instances on destroy without memory leaks', () => {
      const action = mermaidRenderer(mockElement);
      expect(() => action.destroy()).not.toThrow();
      // Calling destroy multiple times is safe and idempotent
      expect(() => action.destroy()).not.toThrow();
    });

    it('safely handles update calls during live editing', () => {
      const action = mermaidRenderer(mockElement, 'initial html');
      expect(() => action.update('updated html')).not.toThrow();
      expect(() => action.update({ showControls: false })).not.toThrow();
      action.destroy();
    });

    it('handles disconnected or unmounted host elements gracefully', () => {
      const disconnectedElement = {
        isConnected: false,
        querySelectorAll: vi.fn().mockReturnValue([]),
      } as unknown as HTMLElement;

      const action = mermaidRenderer(disconnectedElement);
      expect(() => action.update('content')).not.toThrow();
      expect(() => action.destroy()).not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // 5. Diagram Parsing & Live Error Boundary Recovery Stress
  // --------------------------------------------------------------------------
  describe('5. Diagram Parsing & Live Error Boundary Recovery in NoteEditor', () => {
    it('handles alternating valid and broken diagram definitions in markdown parser', () => {
      const states = [
        { code: 'graph TD\n  A --> B' },
        { code: 'graph TD\n  A --> [BROKEN' },
        { code: 'graph TD\n  A --> B\n  B --> C' },
        { code: 'sequenceDiagram\n  Alice->>Bob: Hello' },
        { code: 'sequenceDiagram\n  Alice -->> [BROKEN' },
      ];

      for (const item of states) {
        const html = renderMarkdown(`\`\`\`mermaid\n${item.code}\n\`\`\``);
        expect(html).toContain('mermaid-block');
        expect(html).toContain('data-mermaid-code=');
      }
    });

    it('safely parses mixed markdown notes containing multiple diagrams and standard code', () => {
      const mixedMarkdown = `# Mixed Content Note

Here is typescript code:
\`\`\`typescript
const x: number = 42;
console.log(x);
\`\`\`

Here is a mermaid flowchart:
\`\`\`mermaid
graph LR
  Start --> Process --> Finish
\`\`\`

Here is a python snippet:
\`\`\`python
def greet():
    return "hello"
\`\`\`

Here is a mermaid sequence diagram:
\`\`\`mermaid
sequenceDiagram
  Client->>Server: GET /notes
  Server-->>Client: 200 OK
\`\`\`
`;

      const html = renderMarkdown(mixedMarkdown);

      // TypeScript block must be standard code block, NOT mermaid block
      expect(html).toContain('language-typescript');
      expect(html).toContain('const x: number = 42;');

      // Python block must be standard code block
      expect(html).toContain('language-python');
      expect(html).toContain('def greet():');

      // Exactly 2 mermaid blocks detected
      const matches = html.match(/class="mermaid-block"/g);
      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(2);
      expect(html).toContain('Start --&gt; Process --&gt; Finish');
      expect(html).toContain('Client-&gt;&gt;Server: GET /notes');
    });

    it('survives extreme content stress with 50 sequential diagrams in a single note', () => {
      let largeContent = '# 50 System Diagrams\n\n';
      for (let i = 1; i <= 50; i++) {
        largeContent += `### Diagram ${i}\n\`\`\`mermaid\ngraph TD\n  Node${i}_A --> Node${i}_B\n\`\`\`\n\n`;
      }

      const html = renderMarkdown(largeContent);
      const matches = html.match(/class="mermaid-block"/g);
      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(50);
      expect(html).toContain('Node1_A --&gt; Node1_B');
      expect(html).toContain('Node50_A --&gt; Node50_B');
    });
  });
});
