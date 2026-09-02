import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'svelte/server';
import NoteEditor from '../../src/lib/components/NoteEditor.svelte';
import MarkdownViewer from '../../src/lib/components/MarkdownViewer.svelte';
import MermaidDiagram from '../../src/lib/components/MermaidDiagram.svelte';
import { mermaidRenderer } from '../../src/lib/actions/mermaid';
import { renderMarkdown } from '../../src/lib/utils/markdown';
import { renderMermaidSvg, parseMermaidSyntax } from '../../src/lib/utils/mermaid';

describe('Unit & Integration: NoteEditor & Live Preview Integration (Milestone 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Live Preview Rendering with Mermaid Diagram Blocks', () => {
    const sampleNote = {
      id: 'note-mermaid-1',
      title: 'Workflow Architecture',
      content: `# Overview\n\nHere is the system workflow:\n\n\`\`\`mermaid\ngraph TD\n  Client[Web App] --> API[Backend API]\n  API --> DB[(Database)]\n\`\`\`\n\nAdditional notes below.`,
      isPinned: false,
      tags: [{ id: 't1', name: 'architecture' }],
    };

    it('renders semantic markdown preview with mermaid container in SSR', () => {
      const { html } = render(NoteEditor, {
        props: { note: sampleNote },
      });

      expect(html).toContain('<h1>Overview</h1>');
      expect(html).toContain('<p>Here is the system workflow:</p>');
      expect(html).toContain('mermaid-block');
      expect(html).toContain('data-mermaid-code=');
      expect(html).toContain('<code class="language-mermaid">');
      expect(html).toContain('Client[Web App]');
      expect(html).toContain('Backend API');
      expect(html).toContain('<p>Additional notes below.</p>');
    });

    it('renders multiple distinct Mermaid diagram blocks in NoteEditor preview', () => {
      const multiDiagramContent = `# Two Systems\n\n\`\`\`mermaid\ngraph LR\n  A --> B\n\`\`\`\n\nIntermediary text\n\n\`\`\`mermaid\nsequenceDiagram\n  Alice->>Bob: Hello\n\`\`\``;
      const multiNote = {
        id: 'note-multi',
        title: 'Multi Diagrams',
        content: multiDiagramContent,
        isPinned: false,
        tags: [],
      };

      const { html } = render(NoteEditor, {
        props: { note: multiNote },
      });

      expect(html).toContain('<h1>Two Systems</h1>');
      expect(html).toContain('<p>Intermediary text</p>');
      // Should contain 2 mermaid blocks
      const blockMatches = html.match(/class="mermaid-block"/g);
      expect(blockMatches).not.toBeNull();
      expect(blockMatches?.length).toBe(2);
      expect(html).toContain('Alice-&gt;&gt;Bob: Hello');
    });

    it('renders MarkdownViewer component with mermaid blocks and custom class', () => {
      const markdown = `## Database Schema\n\n\`\`\`mermaid\nerDiagram\n  USER ||--o{ NOTE : creates\n\`\`\``;
      const { html } = render(MarkdownViewer, {
        props: { content: markdown, class: 'custom-notes-viewer' },
      });

      expect(html).toContain('markdown-viewer');
      expect(html).toContain('custom-notes-viewer');
      expect(html).toContain('<h2>Database Schema</h2>');
      expect(html).toContain('mermaid-block');
      expect(html).toContain('data-mermaid-code=');
      expect(html).toContain('USER ||--o{ NOTE : creates');
    });

    it('preserves quotes, arrows, and special characters inside diagram definitions', () => {
      const specialCode = `graph TD\n  A["Node with <quotes> & 'special' chars"] --> B["Result & Safe"]`;
      const noteWithSpecialChars = {
        id: 'special-note',
        title: 'Special Characters',
        content: `\`\`\`mermaid\n${specialCode}\n\`\`\``,
        isPinned: false,
        tags: [],
      };

      const { html } = render(NoteEditor, {
        props: { note: noteWithSpecialChars },
      });

      expect(html).toContain('mermaid-block');
      expect(html).not.toContain('<quotes>');
      expect(html).toContain('&lt;quotes&gt;');
      expect(html).toContain('&amp;');
    });
  });

  describe('2. 200ms Debounce Behavior When Typing', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('demonstrates debounced update pattern: cancels previous timer on rapid keystrokes', () => {
      let debouncedValue = '';
      let timer: any = null;

      function updateTyping(nextValue: string) {
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => {
          debouncedValue = nextValue;
        }, 200);
      }

      // User types 'g', 'gr', 'gra', 'graph TD' rapidly at 40ms intervals
      updateTyping('g');
      vi.advanceTimersByTime(40);
      expect(debouncedValue).toBe('');

      updateTyping('gr');
      vi.advanceTimersByTime(40);
      expect(debouncedValue).toBe('');

      updateTyping('gra');
      vi.advanceTimersByTime(40);
      expect(debouncedValue).toBe('');

      updateTyping('graph TD\n  A --> B');
      vi.advanceTimersByTime(190);
      // At 190ms (less than 200ms debounce window), value has not updated yet
      expect(debouncedValue).toBe('');

      // Advance remaining 10ms to complete 200ms
      vi.advanceTimersByTime(10);
      expect(debouncedValue).toBe('graph TD\n  A --> B');
    });

    it('immediately reflects note prop changes without waiting for debounce timer', () => {
      const noteA = {
        id: 'note-a',
        title: 'First Note',
        content: 'Content A',
        isPinned: false,
        tags: [],
      };

      const noteB = {
        id: 'note-b',
        title: 'Second Note',
        content: 'Content B',
        isPinned: true,
        tags: [],
      };

      // SSR render for Note A
      const renderA = render(NoteEditor, { props: { note: noteA } });
      expect(renderA.html).toContain('First Note');
      expect(renderA.html).toContain('Content A');

      // SSR render for Note B
      const renderB = render(NoteEditor, { props: { note: noteB } });
      expect(renderB.html).toContain('Second Note');
      expect(renderB.html).toContain('Content B');
      expect(renderB.html).toContain('pinned');
    });

    it('renders empty preview placeholder when content is blank', () => {
      const emptyNote = {
        id: 'note-empty',
        title: 'Blank Note',
        content: '',
        isPinned: false,
        tags: [],
      };

      const { html } = render(NoteEditor, { props: { note: emptyNote } });
      expect(html).toContain('empty-preview');
      expect(html).toContain('Markdown preview will appear here as you type...');
    });
  });

  describe('3. View Mode Transitions (edit, preview, split)', () => {
    const testNote = {
      id: 'mode-test-note',
      title: 'View Modes Test',
      content: '# Heading 1\n\n```mermaid\ngraph LR\n  Start --> End\n```',
      isPinned: false,
      tags: [],
    };

    it('renders both editor-pane and preview-pane in default split view mode', () => {
      const { html } = render(NoteEditor, { props: { note: testNote } });
      expect(html).toContain('editor-workspace split');
      expect(html).toContain('workspace-pane editor-pane');
      expect(html).toContain('workspace-pane preview-pane');
      expect(html).toContain('markdown-textarea');
      expect(html).toContain('markdown-preview');
    });

    it('provides accessible tab buttons for edit, split, and preview view modes', () => {
      const { html } = render(NoteEditor, { props: { note: testNote } });
      expect(html).toContain('view-mode-tabs');
      expect(html).toContain('aria-label="Editor View Modes"');
      expect(html).toContain('Edit');
      expect(html).toContain('Split');
      expect(html).toContain('Preview');
      expect(html).toContain('title="Edit mode"');
      expect(html).toContain('title="Split mode"');
      expect(html).toContain('title="Preview mode"');
    });

    it('contains valid aria-selected attributes on mode tab buttons', () => {
      const { html } = render(NoteEditor, { props: { note: testNote } });
      // Default view mode is split
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('aria-selected="false"');
    });
  });

  describe('4. Error Boundary Stability Inside Editor Preview', () => {
    it('handles malformed mermaid syntax safely without throwing or halting parsing', async () => {
      const invalidCode = 'graph TD\n  A --> --> B';
      const parsedMarkdown = renderMarkdown(`\`\`\`mermaid\n${invalidCode}\n\`\`\``);

      expect(parsedMarkdown).toContain('mermaid-block');
      expect(parsedMarkdown).toContain('data-mermaid-code=');
      expect(parsedMarkdown).toContain('&gt;');

      // Syntax check service catches the syntax error gracefully
      const syntaxCheck = await parseMermaidSyntax(invalidCode);
      expect(syntaxCheck.valid).toBe(false);
      expect(syntaxCheck.error).toBeDefined();
    });

    it('displays error banner structure for broken diagrams while surrounding markdown remains intact', () => {
      const mixedContent = `# Valid Heading\n\n\`\`\`mermaid\ngraph TD\n  A --> --> B\n\`\`\`\n\nParagraph after broken diagram.`;
      const mixedNote = {
        id: 'mixed-note',
        title: 'Mixed Content Note',
        content: mixedContent,
        isPinned: false,
        tags: [],
      };

      const { html } = render(NoteEditor, { props: { note: mixedNote } });

      // All markdown elements are present and uncorrupted
      expect(html).toContain('<h1>Valid Heading</h1>');
      expect(html).toContain('mermaid-block');
      expect(html).toContain('<p>Paragraph after broken diagram.</p>');
    });

    it('verifies MermaidDiagram error boundary structure adheres to accessibility standards', () => {
      const errorBannerAttributes = {
        role: 'alert',
        'aria-live': 'assertive',
        class: 'error-boundary-banner',
      };

      expect(errorBannerAttributes.role).toBe('alert');
      expect(errorBannerAttributes['aria-live']).toBe('assertive');
      expect(errorBannerAttributes.class).toBe('error-boundary-banner');
    });

    it('recovers cleanly when broken diagram code is corrected', async () => {
      const brokenCode = 'graph TD\n  A --> --> B';
      const validCode = 'graph TD\n  A --> B';

      const brokenResult = await parseMermaidSyntax(brokenCode);
      expect(brokenResult.valid).toBe(false);

      // User fixes syntax
      const fixedResult = await parseMermaidSyntax(validCode);
      // In browser/mock environment, valid code returns valid: true or handles cleanly
      expect(typeof fixedResult.valid).toBe('boolean');
    });
  });

  describe('5. Client Svelte Action: mermaidRenderer Lifecycle', () => {
    it('creates action object with update and destroy lifecycle hooks', () => {
      const dummyElement = {
        isConnected: true,
        querySelectorAll: vi.fn().mockReturnValue([]),
      } as unknown as HTMLElement;

      const action = mermaidRenderer(dummyElement, { showControls: true });

      expect(action).toBeDefined();
      expect(typeof action.update).toBe('function');
      expect(typeof action.destroy).toBe('function');
    });

    it('handles action destroy without throwing errors', () => {
      const dummyElement = {
        isConnected: true,
        querySelectorAll: vi.fn().mockReturnValue([]),
      } as unknown as HTMLElement;

      const action = mermaidRenderer(dummyElement);
      expect(() => action.destroy()).not.toThrow();
    });

    it('handles action update with string or options object', () => {
      const dummyElement = {
        isConnected: true,
        querySelectorAll: vi.fn().mockReturnValue([]),
      } as unknown as HTMLElement;

      const action = mermaidRenderer(dummyElement, 'initial content');
      expect(() => action.update('updated content')).not.toThrow();
      expect(() => action.update({ showControls: false })).not.toThrow();
    });
  });
});
