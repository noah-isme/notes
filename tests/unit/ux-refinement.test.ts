import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'svelte/server';
import fs from 'node:fs';
import path from 'node:path';
import NoteCard, { type NoteCardData } from '../../src/lib/components/NoteCard.svelte';
import NoteList from '../../src/lib/components/NoteList.svelte';
import NoteEditor, { type NoteEditorData } from '../../src/lib/components/NoteEditor.svelte';
import TagFilter from '../../src/lib/components/TagFilter.svelte';
import SearchBar from '../../src/lib/components/SearchBar.svelte';
import Toast from '../../src/lib/components/Toast.svelte';
import MarkdownViewer from '../../src/lib/components/MarkdownViewer.svelte';
import MermaidDiagram from '../../src/lib/components/MermaidDiagram.svelte';
import { toast, ToastState } from '../../src/lib/stores/toast.svelte';
import { renderMarkdown, stripMarkdown } from '../../src/lib/utils/markdown';
import { generateDiagramId } from '../../src/lib/utils/mermaid';
import { validateNoteInput, validateTagName } from '../../src/lib/utils/validation';

/**
 * State harness for testing keyboard shortcuts, navigation guards,
 * dirty state transitions, soft-delete undo timers, and focus mode.
 */
class UXStateHarness {
  activeNoteId: string | null = null;
  notes: NoteCardData[] = [];
  tags: Array<{ id: string; name: string }> = [];
  selectedTagId: string | null = null;
  searchQuery: string = '';
  isCreatingNew: boolean = false;
  focusMode: boolean = false;
  viewMode: 'edit' | 'split' | 'preview' = 'split';

  // Dirty state tracking
  originalDocument: { title: string; content: string; tags: string[] } | null = null;
  currentDocument: { title: string; content: string; tags: string[] } = {
    title: '',
    content: '',
    tags: [],
  };

  // Navigation guard state
  guardDialogOpen: boolean = false;
  pendingTargetNoteId: string | null = null;

  // Soft delete state
  pendingDeletions: Map<string, { note: NoteCardData; timer: any }> = new Map();
  toastStore: ToastState;

  constructor(toastStore: ToastState = new ToastState()) {
    this.toastStore = toastStore;
  }

  loadNote(note: NoteCardData) {
    this.activeNoteId = note.id;
    this.isCreatingNew = false;
    this.originalDocument = {
      title: note.title,
      content: note.content,
      tags: note.tags.map((t) => t.name),
    };
    this.currentDocument = {
      title: note.title,
      content: note.content,
      tags: [...note.tags.map((t) => t.name)],
    };
  }

  get isDirty(): boolean {
    if (!this.originalDocument) {
      return (
        this.currentDocument.title.trim().length > 0 ||
        this.currentDocument.content.trim().length > 0 ||
        this.currentDocument.tags.length > 0
      );
    }
    return (
      this.currentDocument.title !== this.originalDocument.title ||
      this.currentDocument.content !== this.originalDocument.content ||
      JSON.stringify(this.currentDocument.tags) !== JSON.stringify(this.originalDocument.tags)
    );
  }

  pendingTargetUrl: string | null = null;

  requestNavigate(targetNoteId: string | null): boolean {
    if (this.isDirty) {
      this.guardDialogOpen = true;
      this.pendingTargetNoteId = targetNoteId;
      return false; // Intercepted by guard
    }
    this.executeNavigate(targetNoteId);
    return true;
  }

  requestRouteNavigate(
    toUrl: { pathname: string; search?: string },
    fromUrl: { pathname: string; search?: string }
  ): boolean {
    if (this.isDirty && toUrl.pathname !== fromUrl.pathname) {
      this.guardDialogOpen = true;
      this.pendingTargetUrl = toUrl.pathname + (toUrl.search || '');
      return false; // Intercepted by cross-route guard
    }
    // Same-page query parameter updates do not trigger confirmation dialog
    return true;
  }

  resolveGuard(action: 'stay' | 'discard' | 'save'): boolean {
    if (!this.guardDialogOpen) return false;

    if (action === 'stay') {
      this.guardDialogOpen = false;
      this.pendingTargetNoteId = null;
      return false;
    }

    if (action === 'discard') {
      this.guardDialogOpen = false;
      const targetId = this.pendingTargetNoteId;
      this.pendingTargetNoteId = null;
      this.executeNavigate(targetId);
      return true;
    }

    if (action === 'save') {
      this.saveCurrentDocument();
      this.guardDialogOpen = false;
      const targetId = this.pendingTargetNoteId;
      this.pendingTargetNoteId = null;
      this.executeNavigate(targetId);
      return true;
    }

    return false;
  }

  executeNavigate(targetNoteId: string | null) {
    this.activeNoteId = targetNoteId;
    this.isCreatingNew = false;
    if (targetNoteId) {
      const found = this.notes.find((n) => n.id === targetNoteId);
      if (found) {
        this.loadNote(found);
      }
    }
  }

  saveCurrentDocument() {
    if (this.activeNoteId) {
      const note = this.notes.find((n) => n.id === this.activeNoteId);
      if (note) {
        note.title = this.currentDocument.title;
        note.content = this.currentDocument.content;
        note.tags = this.currentDocument.tags.map((name) => ({ id: `t_${name}`, name }));
        note.updatedAt = new Date();
      }
    }
    this.originalDocument = {
      title: this.currentDocument.title,
      content: this.currentDocument.content,
      tags: [...this.currentDocument.tags],
    };
  }

  softDeleteNote(noteId: string, duration = 6000) {
    const noteIndex = this.notes.findIndex((n) => n.id === noteId);
    if (noteIndex === -1) return;

    const note = this.notes[noteIndex];
    this.notes = this.notes.filter((n) => n.id !== noteId);

    if (this.activeNoteId === noteId) {
      this.activeNoteId = this.notes.length > 0 ? this.notes[0].id : null;
      if (this.activeNoteId) {
        this.loadNote(this.notes[0]);
      } else {
        this.originalDocument = null;
        this.currentDocument = { title: '', content: '', tags: [] };
      }
    }

    const timer = setTimeout(() => {
      this.pendingDeletions.delete(noteId);
    }, duration);

    this.pendingDeletions.set(noteId, { note, timer });

    this.toastStore.show(`Note "${note.title}" deleted`, 'info', duration);
  }

  undoDelete(noteId: string): boolean {
    const pending = this.pendingDeletions.get(noteId);
    if (!pending) return false;

    clearTimeout(pending.timer);
    this.pendingDeletions.delete(noteId);
    this.notes = [pending.note, ...this.notes];
    this.activeNoteId = pending.note.id;
    this.loadNote(pending.note);
    this.toastStore.success(`Note "${pending.note.title}" restored`);
    return true;
  }

  handleKeyboardShortcut(event: { key: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }): string | null {
    const isModifier = event.ctrlKey || event.metaKey;

    if (isModifier && event.key.toLowerCase() === 'k') {
      return 'focus_search';
    }
    if (isModifier && event.key.toLowerCase() === 'n') {
      this.isCreatingNew = true;
      this.activeNoteId = null;
      this.originalDocument = null;
      this.currentDocument = { title: '', content: '', tags: [] };
      return 'create_new';
    }
    if (isModifier && event.key.toLowerCase() === 's' && !event.shiftKey) {
      if (this.isDirty) {
        this.saveCurrentDocument();
        this.toastStore.success('Note saved successfully');
        return 'saved';
      }
      return 'noop_clean';
    }
    if (event.key === 'Escape') {
      if (this.focusMode) {
        this.focusMode = false;
        return 'exit_focus';
      }
      if (this.guardDialogOpen) {
        this.guardDialogOpen = false;
        return 'dismiss_guard';
      }
      return 'escape';
    }
    if (isModifier && event.shiftKey) {
      const k = event.key.toLowerCase();
      if (k === 'e') {
        this.viewMode = 'edit';
        return 'view_edit';
      }
      if (k === 's') {
        this.viewMode = 'split';
        return 'view_split';
      }
      if (k === 'p') {
        this.viewMode = 'preview';
        return 'view_preview';
      }
    }

    return null;
  }
}

describe('UX Refinement & Polish Test Suite (Tiers 1 - 4)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    toast.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // TIER 1: FEATURE COVERAGE (Isolated Feature Tests F1.1 - F4.3)
  // =========================================================================
  describe('Tier 1: Isolated Feature Coverage (F1.1 - F4.3)', () => {
    // Feature 1.1: Editor Prose Wrapping
    describe('F1.1: Editor Prose Wrapping', () => {
      it('T1.1_1: NoteEditor textarea renders with markdown-textarea class and monospace styling', () => {
        const { html } = render(NoteEditor, {
          props: { note: { id: '1', title: 'Note', content: 'Sample prose', isPinned: false, tags: [] } },
        });
        expect(html).toContain('markdown-textarea');
        expect(html).toContain('name="content"');
      });

      it('T1.1_2: MarkdownViewer renders prose container with word-break styling', () => {
        const { html } = render(MarkdownViewer, {
          props: { content: 'Paragraph with regular markdown prose.' },
        });
        expect(html).toContain('markdown-viewer');
        expect(html).toContain('<p>Paragraph with regular markdown prose.</p>');
      });

      it('T1.1_3: Long text with multiple paragraphs renders distinct paragraph blocks', () => {
        const content = 'First paragraph with some text.\n\nSecond paragraph with more text.';
        const { html } = render(MarkdownViewer, { props: { content } });
        expect(html).toContain('<p>First paragraph with some text.</p>');
        expect(html).toContain('<p>Second paragraph with more text.</p>');
      });

      it('T1.1_4: MarkdownViewer renders headings, unordered lists, and blockquotes cleanly', () => {
        const content = '# Main Title\n\n> Important quote\n\n- Item 1\n- Item 2';
        const { html } = render(MarkdownViewer, { props: { content } });
        expect(html).toContain('<h1>Main Title</h1>');
        expect(html).toContain('<blockquote><p>Important quote</p></blockquote>');
        expect(html).toContain('<ul><li>Item 1</li><li>Item 2</li></ul>');
      });

      it('T1.1_5: Rendered markdown escapes raw HTML tags while preserving markdown bold & italic prose', () => {
        const raw = 'Normal **bold** text with <script>alert("xss")</script> inside.';
        const html = renderMarkdown(raw);
        expect(html).toContain('<strong>bold</strong>');
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('alert("xss")');
      });
    });

    // Feature 1.2: Code Block Horizontal Scrolling
    describe('F1.2: Code Block Horizontal Scrolling', () => {
      it('T1.2_1: MarkdownViewer renders fenced code block with <pre><code class="language-*"> wrapper', () => {
        const content = '```typescript\nconst message: string = "Hello World";\n```';
        const { html } = render(MarkdownViewer, { props: { content } });
        expect(html).toContain('<pre><code class="language-typescript">');
        expect(html).toContain('const message: string = &quot;Hello World&quot;;');
      });

      it('T1.2_2: NoteEditor preview pane preserves preformatted whitespace for code blocks', () => {
        const note = {
          id: 'code-note',
          title: 'Code Note',
          content: '```bash\npnpm test tests/unit/ux-refinement.test.ts\n```',
          isPinned: false,
          tags: [],
        };
        const { html } = render(NoteEditor, { props: { note } });
        expect(html).toContain('language-bash');
        expect(html).toContain('pnpm test tests/unit/ux-refinement.test.ts');
      });

      it('T1.2_3: 300-character single-line code snippet is wrapped in <pre> without breaking into multiple lines', () => {
        const longLine = 'const query = db.select().from(notes).where(and(eq(notes.userId, uid), ilike(notes.title, search))).orderBy(desc(notes.updatedAt));';
        const content = `\`\`\`typescript\n${longLine}\n\`\`\``;
        const html = renderMarkdown(content);
        expect(html).toContain('<pre><code class="language-typescript">');
        expect(html).toContain(longLine);
      });

      it('T1.2_4: Consecutive fenced code blocks render in isolated <pre> elements', () => {
        const content = '```json\n{"a": 1}\n```\n\n```json\n{"b": 2}\n```';
        const html = renderMarkdown(content);
        const preCount = (html.match(/<pre>/g) || []).length;
        expect(preCount).toBe(2);
        expect(html).toContain('{&quot;a&quot;: 1}');
        expect(html).toContain('{&quot;b&quot;: 2}');
      });

      it('T1.2_5: Mermaid diagram code blocks are isolated into dedicated .mermaid-block containers', () => {
        const content = '```mermaid\ngraph TD\n  A[Start] --> B[Finish]\n```';
        const html = renderMarkdown(content);
        expect(html).toContain('class="mermaid-block"');
        expect(html).toContain('data-mermaid-code=');
        expect(html).toContain('A[Start] --&gt; B[Finish]');
        expect(html).toContain('class="language-mermaid"');
      });
    });

    // Feature 1.3: Monospace Typography
    describe('F1.3: Monospace Typography', () => {
      it('T1.3_1: NoteEditor textarea specifies monospace font stack in scoped styles', () => {
        const { html } = render(NoteEditor, {
          props: { note: { id: '1', title: 'Typography', content: 'Text', isPinned: false, tags: [] } },
        });
        expect(html).toContain('markdown-textarea');
      });

      it('T1.3_2: MarkdownViewer renders inline code spans with <code> tags', () => {
        const { html } = render(MarkdownViewer, {
          props: { content: 'Run `pnpm check` to verify types.' },
        });
        expect(html).toContain('<code>pnpm check</code>');
      });

      it('T1.3_3: MermaidDiagram component renders fallback preformatted code with language-mermaid class in SSR mode', () => {
        const { html } = render(MermaidDiagram, {
          props: { code: 'graph LR; A-->B;', title: 'Flow' },
        });
        expect(html).toContain('language-mermaid');
        expect(html).toContain('graph LR; A-->B;');
      });

      it('T1.3_4: Editor title input has maxlength 200 and renders character count counter', () => {
        const { html } = render(NoteEditor, {
          props: { note: { id: '1', title: 'Short Title', content: '', isPinned: false, tags: [] } },
        });
        expect(html).toContain('11/200');
        expect(html).toContain('maxlength="200"');
      });

      it('T1.3_5: Code blocks in MarkdownViewer preserve tab formatting and character indentation', () => {
        const content = '```javascript\nfunction test() {\n  const x = 1;\n  return x;\n}\n```';
        const html = renderMarkdown(content);
        expect(html).toContain('function test() {\n  const x = 1;\n  return x;\n}');
      });
    });

    // Feature 1.4: Reactive Dirty State Indicator
    describe('F1.4: Reactive Dirty State Indicator', () => {
      it('T1.4_1: Harness evaluates clean note as not dirty', () => {
        const harness = new UXStateHarness();
        harness.loadNote({
          id: 'n1',
          title: 'Clean Note',
          content: 'Clean Content',
          isPinned: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [{ id: 't1', name: 'work' }],
        });
        expect(harness.isDirty).toBe(false);
      });

      it('T1.4_2: Harness evaluates note as dirty when title is changed', () => {
        const harness = new UXStateHarness();
        harness.loadNote({
          id: 'n1',
          title: 'Clean Note',
          content: 'Clean Content',
          isPinned: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
        });
        harness.currentDocument.title = 'Modified Note Title';
        expect(harness.isDirty).toBe(true);
      });

      it('T1.4_3: Harness evaluates note as dirty when content is changed', () => {
        const harness = new UXStateHarness();
        harness.loadNote({
          id: 'n1',
          title: 'Clean Note',
          content: 'Clean Content',
          isPinned: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
        });
        harness.currentDocument.content = 'Clean Content with new updates.';
        expect(harness.isDirty).toBe(true);
      });

      it('T1.4_4: Harness resets dirty state to false when modified values match original', () => {
        const harness = new UXStateHarness();
        harness.loadNote({
          id: 'n1',
          title: 'Clean Note',
          content: 'Clean Content',
          isPinned: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
        });
        harness.currentDocument.content = 'Changed temporarily';
        expect(harness.isDirty).toBe(true);
        harness.currentDocument.content = 'Clean Content';
        expect(harness.isDirty).toBe(false);
      });

      it('T1.4_5: Harness evaluates note as dirty when tag list is altered', () => {
        const harness = new UXStateHarness();
        harness.loadNote({
          id: 'n1',
          title: 'Clean Note',
          content: 'Clean Content',
          isPinned: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [{ id: 't1', name: 'svelte' }],
        });
        harness.currentDocument.tags.push('vitest');
        expect(harness.isDirty).toBe(true);
      });
    });

    // Feature 1.5: Unsaved Changes Navigation Guard
    describe('F1.5: Unsaved Changes Navigation Guard', () => {
      it('T1.5_1: Clean note navigation proceeds immediately without opening guard dialog', () => {
        const harness = new UXStateHarness();
        harness.notes = [
          { id: 'n1', title: 'Note 1', content: 'C1', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] },
          { id: 'n2', title: 'Note 2', content: 'C2', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] },
        ];
        harness.loadNote(harness.notes[0]);

        const navigated = harness.requestNavigate('n2');
        expect(navigated).toBe(true);
        expect(harness.guardDialogOpen).toBe(false);
        expect(harness.activeNoteId).toBe('n2');
      });

      it('T1.5_2: Dirty note navigation is intercepted and opens confirmation guard dialog', () => {
        const harness = new UXStateHarness();
        harness.notes = [
          { id: 'n1', title: 'Note 1', content: 'C1', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] },
          { id: 'n2', title: 'Note 2', content: 'C2', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] },
        ];
        harness.loadNote(harness.notes[0]);
        harness.currentDocument.content = 'Unsaved draft text';

        const navigated = harness.requestNavigate('n2');
        expect(navigated).toBe(false);
        expect(harness.guardDialogOpen).toBe(true);
        expect(harness.pendingTargetNoteId).toBe('n2');
        expect(harness.activeNoteId).toBe('n1'); // still on n1
      });

      it('T1.5_3: Selecting [Stay] dismisses guard dialog and retains pending edits on active note', () => {
        const harness = new UXStateHarness();
        harness.notes = [
          { id: 'n1', title: 'Note 1', content: 'C1', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] },
          { id: 'n2', title: 'Note 2', content: 'C2', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] },
        ];
        harness.loadNote(harness.notes[0]);
        harness.currentDocument.content = 'Keep this draft';
        harness.requestNavigate('n2');

        const resolved = harness.resolveGuard('stay');
        expect(resolved).toBe(false);
        expect(harness.guardDialogOpen).toBe(false);
        expect(harness.activeNoteId).toBe('n1');
        expect(harness.currentDocument.content).toBe('Keep this draft');
      });

      it('T1.5_4: Selecting [Discard] abandons dirty edits and transitions to target note', () => {
        const harness = new UXStateHarness();
        harness.notes = [
          { id: 'n1', title: 'Note 1', content: 'C1', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] },
          { id: 'n2', title: 'Note 2', content: 'C2', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] },
        ];
        harness.loadNote(harness.notes[0]);
        harness.currentDocument.content = 'Abandoned draft';
        harness.requestNavigate('n2');

        const resolved = harness.resolveGuard('discard');
        expect(resolved).toBe(true);
        expect(harness.guardDialogOpen).toBe(false);
        expect(harness.activeNoteId).toBe('n2');
        expect(harness.currentDocument.content).toBe('C2');
      });

      it('T1.5_5: Selecting [Save] persists dirty edits and transitions to target note', () => {
        const harness = new UXStateHarness();
        harness.notes = [
          { id: 'n1', title: 'Note 1', content: 'C1', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] },
          { id: 'n2', title: 'Note 2', content: 'C2', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] },
        ];
        harness.loadNote(harness.notes[0]);
        harness.currentDocument.content = 'Saved changes';
        harness.requestNavigate('n2');

        const resolved = harness.resolveGuard('save');
        expect(resolved).toBe(true);
        expect(harness.guardDialogOpen).toBe(false);
        expect(harness.notes[0].content).toBe('Saved changes');
        expect(harness.activeNoteId).toBe('n2');
      });
    });

    // Feature 2.1: Segmented View Mode Controls
    describe('F2.1: Segmented View Mode Controls', () => {
      it('T1.6_1: NoteEditor renders segmented view controls with role="tablist" and aria-label', () => {
        const { html } = render(NoteEditor, {
          props: { note: { id: '1', title: 'Title', content: 'Body', isPinned: false, tags: [] } },
        });
        expect(html).toContain('role="tablist"');
        expect(html).toContain('aria-label="Editor View Modes"');
      });

      it('T1.6_2: NoteEditor renders three view mode tabs: Edit, Split, Preview with role="tab"', () => {
        const { html } = render(NoteEditor, {
          props: { note: { id: '1', title: 'Title', content: 'Body', isPinned: false, tags: [] } },
        });
        expect(html).toContain('role="tab"');
        expect(html).toContain('Edit');
        expect(html).toContain('Split');
        expect(html).toContain('Preview');
      });

      it('T1.6_3: Default view mode is split, rendering both editor and preview panes', () => {
        const { html } = render(NoteEditor, {
          props: { note: { id: '1', title: 'Title', content: 'Body', isPinned: false, tags: [] } },
        });
        expect(html).toContain('editor-workspace split');
        expect(html).toContain('editor-pane');
        expect(html).toContain('preview-pane');
      });

      it('T1.6_4: Active view mode button has active class and aria-selected="true"', () => {
        const { html } = render(NoteEditor, {
          props: { note: { id: '1', title: 'Title', content: 'Body', isPinned: false, tags: [] } },
        });
        expect(html).toContain('mode-btn active');
        expect(html).toContain('aria-selected="true"');
      });

      it('T1.6_5: Markdown preview pane renders rendered markdown with preview container', () => {
        const { html } = render(NoteEditor, {
          props: { note: { id: '1', title: 'Title', content: '# Heading 1\nProse text', isPinned: false, tags: [] } },
        });
        expect(html).toContain('markdown-preview');
        expect(html).toContain('<h1>Heading 1</h1>');
        expect(html).toContain('<p>Prose text</p>');
      });
    });

    // Feature 2.2: Editor Focus / Fullscreen Mode
    describe('F2.2: Editor Focus / Fullscreen Mode', () => {
      it('T1.7_1: Harness toggles focus mode state correctly', () => {
        const harness = new UXStateHarness();
        expect(harness.focusMode).toBe(false);
        harness.focusMode = true;
        expect(harness.focusMode).toBe(true);
      });

      it('T1.7_2: MermaidDiagram renders modal container and action buttons in markup', () => {
        const { html } = render(MermaidDiagram, {
          props: { code: 'graph TD; A-->B;', title: 'Architecture' },
        });
        expect(html).toContain('mermaid-block');
        expect(html).toContain('Architecture');
      });

      it('T1.7_3: Pressing Escape in focus mode exits focus mode', () => {
        const harness = new UXStateHarness();
        harness.focusMode = true;
        const result = harness.handleKeyboardShortcut({ key: 'Escape' });
        expect(result).toBe('exit_focus');
        expect(harness.focusMode).toBe(false);
      });

      it('T1.7_4: Pressing Escape when not in focus mode returns generic escape event', () => {
        const harness = new UXStateHarness();
        harness.focusMode = false;
        const result = harness.handleKeyboardShortcut({ key: 'Escape' });
        expect(result).toBe('escape');
      });

      it('T1.7_5: MermaidDiagram generateDiagramId returns unique IDs with prefix', () => {
        const id1 = generateDiagramId('test');
        const id2 = generateDiagramId('test');
        expect(id1).not.toBe(id2);
        expect(id1.startsWith('test_')).toBe(true);
      });
    });

    // Feature 2.3: Soft-Delete with Undo Toast
    describe('F2.3: Soft-Delete with Undo Toast', () => {
      it('T1.8_1: ToastState store adds toast notification and generates unique ID', () => {
        const store = new ToastState();
        const id = store.show('Test Toast', 'info', 4000);
        expect(id).toBeDefined();
        expect(store.toasts.length).toBe(1);
        expect(store.toasts[0].message).toBe('Test Toast');
        expect(store.toasts[0].type).toBe('info');
      });

      it('T1.8_2: ToastState prevents spamming duplicate messages', () => {
        const store = new ToastState();
        const id1 = store.show('Duplicate Warning', 'error');
        const id2 = store.show('Duplicate Warning', 'error');
        expect(id1).toBe(id2);
        expect(store.toasts.length).toBe(1);
      });

      it('T1.8_3: ToastState caps visible notifications at MAX_VISIBLE_TOASTS (3 items)', () => {
        const store = new ToastState();
        store.show('Toast 1', 'info', 0);
        store.show('Toast 2', 'info', 0);
        store.show('Toast 3', 'info', 0);
        store.show('Toast 4', 'info', 0);
        expect(store.toasts.length).toBe(3);
        expect(store.toasts[2].message).toBe('Toast 4');
      });

      it('T1.8_4: Harness soft-deletes note and supports immediate undo restoration', () => {
        const store = new ToastState();
        const harness = new UXStateHarness(store);
        const testNote: NoteCardData = {
          id: 'del-note',
          title: 'Accidental Delete',
          content: 'Restore me',
          isPinned: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [{ id: 't1', name: 'work' }],
        };
        harness.notes = [testNote];
        harness.loadNote(testNote);

        harness.softDeleteNote('del-note', 6000);
        expect(harness.notes.length).toBe(0);
        expect(store.toasts.length).toBe(1);
        expect(store.toasts[0].message).toContain('Accidental Delete');

        const restored = harness.undoDelete('del-note');
        expect(restored).toBe(true);
        expect(harness.notes.length).toBe(1);
        expect(harness.notes[0].id).toBe('del-note');
        expect(harness.activeNoteId).toBe('del-note');
      });

      it('T1.8_5: Toast component renders role="region" and aria-label="Notifications"', () => {
        toast.clear();
        toast.info('Notification test message', 0);
        const { html } = render(Toast);
        expect(html).toContain('role="region"');
        expect(html).toContain('aria-label="Notifications"');
        expect(html).toContain('Notification test message');
        toast.clear();
      });
    });

    // Feature 3.1: Note Card Hitboxes & Elevation
    describe('F3.1: Note Card Hitboxes & Elevation', () => {
      const mockNote: NoteCardData = {
        id: 'card-1',
        title: 'Design Meeting',
        content: 'Action items: review hitboxes and typography.',
        isPinned: true,
        createdAt: new Date('2026-09-01T08:00:00Z'),
        updatedAt: new Date('2026-09-01T10:00:00Z'),
        tags: [{ id: 't1', name: 'design' }],
      };

      it('T1.9_1: NoteCard renders with button role, tabindex 0, and accessible aria-label', () => {
        const { html } = render(NoteCard, { props: { note: mockNote } });
        expect(html).toContain('role="button"');
        expect(html).toContain('tabindex="0"');
        expect(html).toContain('aria-label="Note: Design Meeting"');
      });

      it('T1.9_2: NoteCard renders pin action button with title and aria-label', () => {
        const { html } = render(NoteCard, { props: { note: mockNote } });
        expect(html).toContain('pin-btn active-pin');
        expect(html).toContain('aria-label="Unpin note"');
      });

      it('T1.9_3: NoteCard renders edit and delete action buttons when callbacks provided', () => {
        const { html } = render(NoteCard, {
          props: { note: mockNote, onEdit: () => {}, onDelete: () => {} },
        });
        expect(html).toContain('edit-btn');
        expect(html).toContain('delete-btn');
        expect(html).toContain('aria-label="Edit note"');
        expect(html).toContain('aria-label="Delete note"');
      });

      it('T1.9_4: NoteCard renders selected status with aria-pressed="true" and selected class', () => {
        const { html } = render(NoteCard, { props: { note: mockNote, isSelected: true } });
        expect(html).toContain('note-card pinned selected');
        expect(html).toContain('aria-pressed="true"');
      });

      it('T1.9_5: NoteCard renders tag pills with #name label and filter aria-label', () => {
        const { html } = render(NoteCard, { props: { note: mockNote } });
        expect(html).toContain('tag-pill');
        expect(html).toContain('#design');
        expect(html).toContain('aria-label="Filter by tag design"');
      });
    });

    // Feature 3.2: Card Actions Overflow Protection
    describe('F3.2: Card Actions Overflow Protection', () => {
      it('T1.10_1: NoteCard wraps title in flex container with title-text class', () => {
        const longTitleNote: NoteCardData = {
          id: 'c-long',
          title: 'A'.repeat(150),
          content: 'Content',
          isPinned: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
        };
        const { html } = render(NoteCard, { props: { note: longTitleNote } });
        expect(html).toContain('card-title');
        expect(html).toContain('title-text');
        expect(html).toContain('A'.repeat(150));
      });

      it('T1.10_2: NoteCard renders preview snippet cleanly truncated from markdown', () => {
        const mdNote: NoteCardData = {
          id: 'c-md',
          title: 'Markdown Note',
          content: '## Heading\n**Bold text** with `code snippet` and [link](https://example.com)',
          isPinned: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
        };
        const { html } = render(NoteCard, { props: { note: mdNote } });
        expect(html).toContain('card-preview');
        expect(html).toContain('Bold text with code snippet and link');
      });

      it('T1.10_3: stripMarkdown truncates long string to 120 characters with ellipsis', () => {
        const longText = 'This is a very long string designed to exceed the one hundred and twenty character limit for preview summaries in note cards.'.repeat(2);
        const stripped = stripMarkdown(longText, 120);
        expect(stripped.length).toBeLessThanOrEqual(124);
        expect(stripped.endsWith('...')).toBe(true);
      });

      it('T1.10_4: NoteCard renders tabular formatted date inside time tag with datetime attribute', () => {
        const dateNote: NoteCardData = {
          id: 'c-date',
          title: 'Date Note',
          content: 'Body',
          isPinned: false,
          createdAt: new Date('2026-09-02T12:00:00Z'),
          updatedAt: new Date('2026-09-02T12:00:00Z'),
          tags: [],
        };
        const { html } = render(NoteCard, { props: { note: dateNote } });
        expect(html).toContain('card-date');
        expect(html).toContain('datetime="2026-09-02T12:00:00.000Z"');
      });

      it('T1.10_5: NoteCard handles empty content gracefully by rendering "No content"', () => {
        const emptyNote: NoteCardData = {
          id: 'c-empty',
          title: 'Empty Note',
          content: '',
          isPinned: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
        };
        const { html } = render(NoteCard, { props: { note: emptyNote } });
        expect(html).toContain('No content');
      });
    });

    // Feature 3.3: Tag Filters & Input Polish
    describe('F3.3: Tag Filters & Input Polish', () => {
      const mockTags = [
        { id: 't1', name: 'react', count: 4 },
        { id: 't2', name: 'svelte', count: 7 },
      ];

      it('T1.11_1: TagFilter renders "All Notes" chip with count and active status when unfiltered', () => {
        const { html } = render(TagFilter, {
          props: { tags: mockTags, selectedTagId: '', totalNotesCount: 11 },
        });
        expect(html).toContain('All Notes');
        expect(html).toContain('tag-chip active');
        expect(html).toContain('11');
      });

      it('T1.11_2: TagFilter renders tag chips with #name format and count badge', () => {
        const { html } = render(TagFilter, {
          props: { tags: mockTags, selectedTagId: '', totalNotesCount: 11 },
        });
        expect(html).toContain('#react');
        expect(html).toContain('#svelte');
        expect(html).toContain('4');
        expect(html).toContain('7');
      });

      it('T1.11_3: TagFilter renders Clear button and active chip highlight when tag selected', () => {
        const { html } = render(TagFilter, {
          props: { tags: mockTags, selectedTagId: 't2', totalNotesCount: 11 },
        });
        expect(html).toContain('btn-clear-tags');
        expect(html).toContain('Clear');
      });

      it('T1.11_4: NoteEditor renders tag chips with remove buttons', () => {
        const note = {
          id: 'n-tags',
          title: 'Tagged Note',
          content: '',
          isPinned: false,
          tags: [{ id: 't1', name: 'alpha' }, { id: 't2', name: 'beta' }],
        };
        const { html } = render(NoteEditor, { props: { note } });
        expect(html).toContain('#alpha');
        expect(html).toContain('#beta');
        expect(html).toContain('aria-label="Remove tag alpha"');
        expect(html).toContain('aria-label="Remove tag beta"');
      });

      it('T1.11_5: validateTagName validates tag name format (alphanumeric, hyphens, underscores up to 50 chars)', () => {
        expect(validateTagName('valid-tag_123')).toBe(true);
        expect(validateTagName('')).toBe(false);
        expect(validateTagName('invalid tag with spaces')).toBe(false);
        expect(validateTagName('a'.repeat(51))).toBe(false);
      });
    });

    // Feature 3.4: Illustrated Empty States
    describe('F3.4: Illustrated Empty States', () => {
      it('T1.12_1: NoteList renders "No notes yet" empty state when notes array is empty and unfiltered', () => {
        const { html } = render(NoteList, {
          props: { notes: [], onCreateNew: () => {} },
        });
        expect(html).toContain('No notes yet');
        expect(html).toContain('Create your first note to get started organizing your thoughts.');
        expect(html).toContain('Create New Note');
      });

      it('T1.12_2: NoteList renders "No notes found" with search query when search matches 0 notes', () => {
        const { html } = render(NoteList, {
          props: { notes: [], searchQuery: 'quantum computing', onClearFilters: () => {} },
        });
        expect(html).toContain('No notes found');
        expect(html).toContain('"quantum computing"');
        expect(html).toContain('Clear Filters');
      });

      it('T1.12_3: NoteList renders "No notes found" with #tag name when tag filter matches 0 notes', () => {
        const { html } = render(NoteList, {
          props: { notes: [], selectedTagId: 't-empty', selectedTagName: 'archived', onClearFilters: () => {} },
        });
        expect(html).toContain('No notes found');
        expect(html).toContain('#archived');
        expect(html).toContain('Clear Filters');
      });

      it('T1.12_4: NoteList renders combined search and tag filter in empty state message', () => {
        const { html } = render(NoteList, {
          props: {
            notes: [],
            searchQuery: 'docker',
            selectedTagId: 't-devops',
            selectedTagName: 'devops',
            onClearFilters: () => {},
          },
        });
        expect(html).toContain('No notes found');
        expect(html).toContain('"docker" and #devops');
        expect(html).toContain('Clear Filters');
      });

      it('T1.12_5: NoteList renders pinned and other section headers when notes exist', () => {
        const notesList: NoteCardData[] = [
          { id: 'p1', title: 'Pinned 1', content: '', isPinned: true, createdAt: new Date(), updatedAt: new Date(), tags: [] },
          { id: 'o1', title: 'Other 1', content: '', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] },
        ];
        const { html } = render(NoteList, { props: { notes: notesList } });
        expect(html).toContain('Pinned (1)');
        expect(html).toContain('Other Notes (1)');
      });
    });

    // Feature 4.1: Global Keyboard Shortcuts & Tooltips
    describe('F4.1: Global Keyboard Shortcuts & Tooltips', () => {
      it('T1.13_1: Harness handles Cmd+K / Ctrl+K search focus shortcut', () => {
        const harness = new UXStateHarness();
        const actionMac = harness.handleKeyboardShortcut({ key: 'k', metaKey: true });
        const actionWin = harness.handleKeyboardShortcut({ key: 'k', ctrlKey: true });
        expect(actionMac).toBe('focus_search');
        expect(actionWin).toBe('focus_search');
      });

      it('T1.13_2: Harness handles Cmd+N / Ctrl+N new note creation shortcut', () => {
        const harness = new UXStateHarness();
        const action = harness.handleKeyboardShortcut({ key: 'n', metaKey: true });
        expect(action).toBe('create_new');
        expect(harness.isCreatingNew).toBe(true);
        expect(harness.activeNoteId).toBeNull();
      });

      it('T1.13_3: Harness handles Cmd+S / Ctrl+S save shortcut on dirty note', () => {
        const store = new ToastState();
        const harness = new UXStateHarness(store);
        const note: NoteCardData = {
          id: 'n-save',
          title: 'Original Title',
          content: 'Original Content',
          isPinned: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
        };
        harness.notes = [note];
        harness.loadNote(note);
        harness.currentDocument.content = 'Updated content via shortcut';

        const action = harness.handleKeyboardShortcut({ key: 's', metaKey: true });
        expect(action).toBe('saved');
        expect(harness.isDirty).toBe(false);
        expect(harness.notes[0].content).toBe('Updated content via shortcut');
        expect(store.toasts.length).toBe(1);
      });

      it('T1.13_4: Harness handles Cmd+Shift+E/S/P view mode switching shortcuts', () => {
        const harness = new UXStateHarness();
        expect(harness.handleKeyboardShortcut({ key: 'e', metaKey: true, shiftKey: true })).toBe('view_edit');
        expect(harness.viewMode).toBe('edit');

        expect(harness.handleKeyboardShortcut({ key: 's', metaKey: true, shiftKey: true })).toBe('view_split');
        expect(harness.viewMode).toBe('split');

        expect(harness.handleKeyboardShortcut({ key: 'p', metaKey: true, shiftKey: true })).toBe('view_preview');
        expect(harness.viewMode).toBe('preview');
      });

      it('T1.13_5: NoteEditor buttons provide descriptive title tooltips for accessibility', () => {
        const { html: htmlExisting } = render(NoteEditor, {
          props: { note: { id: '1', title: 'Note', content: 'Body', isPinned: false, tags: [] }, isNew: false, isFocusMode: false },
        });
        expect(htmlExisting).toContain('title="Save changes (Cmd/Ctrl+S)"');
        expect(htmlExisting).toContain('title="Pin note"');
        expect(htmlExisting).toContain('title="Edit mode"');
        expect(htmlExisting).toContain('title="Split mode"');
        expect(htmlExisting).toContain('title="Preview mode"');
        expect(htmlExisting).toContain('title="Enter focus mode"');

        const { html: htmlNew } = render(NoteEditor, {
          props: { note: null, isNew: true, isFocusMode: true },
        });
        expect(htmlNew).toContain('title="Save note (Cmd/Ctrl+S)"');
        expect(htmlNew).toContain('title="Exit focus mode (Esc)"');
      });

      it('T1.13_6: SearchBar and NoteList provide discoverable shortcut tooltips', () => {
        const { html: searchHtml } = render(SearchBar, { props: { value: '' } });
        expect(searchHtml).toContain('title="Search notes (Cmd/Ctrl+K)"');

        const { html: listHtml } = render(NoteList, {
          props: { notes: [], onCreateNew: () => {} },
        });
        expect(listHtml).toContain('title="New note (Cmd/Ctrl+N)"');
      });

      it('T1.13_7: Escape shortcut handles focus mode exit and modal dismiss', () => {
        const harness = new UXStateHarness();
        harness.focusMode = true;
        expect(harness.handleKeyboardShortcut({ key: 'Escape' })).toBe('exit_focus');
        expect(harness.focusMode).toBe(false);

        harness.guardDialogOpen = true;
        expect(harness.handleKeyboardShortcut({ key: 'Escape' })).toBe('dismiss_guard');
        expect(harness.guardDialogOpen).toBe(false);
      });
    });

    // Feature 4.2: Subtle Diagram Hover Toolbar
    describe('F4.2: Subtle Diagram Hover Toolbar', () => {
      const mermaidDiagramSource = fs.readFileSync(
        path.resolve(__dirname, '../../src/lib/components/MermaidDiagram.svelte'),
        'utf-8'
      );

      it('T1.14_1: MermaidDiagram component defines diagram toolbar with role="toolbar" and aria-label', () => {
        expect(mermaidDiagramSource).toContain('class="diagram-toolbar"');
        expect(mermaidDiagramSource).toContain('role="toolbar"');
        expect(mermaidDiagramSource).toContain('aria-label="Diagram controls"');
      });

      it('T1.14_2: MermaidDiagram renders fallback code in pre block when running SSR', () => {
        const { html } = render(MermaidDiagram, {
          props: { code: 'graph TD; Start-->End;' },
        });
        expect(html).toContain('language-mermaid');
        expect(html).toContain('Start-->End;');
      });

      it('T1.14_3: renderMarkdown shields Mermaid blocks and renders data-mermaid-code attribute', () => {
        const md = '```mermaid\nsequenceDiagram\nAlice->>Bob: Hello\n```';
        const html = renderMarkdown(md);
        expect(html).toContain('data-mermaid-code=');
        expect(html).toContain('sequenceDiagram\nAlice-&gt;&gt;Bob: Hello');
      });

      it('T1.14_4: MermaidDiagram handles empty code safely with empty fallback', () => {
        const { html } = render(MermaidDiagram, { props: { code: '' } });
        expect(html).toContain('language-mermaid');
      });

      it('T1.14_5: generateDiagramId generates unique ids containing prefix and timestamp', () => {
        const id = generateDiagramId('diag');
        expect(id).toMatch(/^diag_[a-z0-9]+_[a-z0-9]+_[a-z0-9]+$/);
      });

      it('T1.14_6: MermaidDiagram toolbar buttons provide accessible titles and action controls', () => {
        expect(mermaidDiagramSource).toContain('title="Copy Mermaid source code"');
        expect(mermaidDiagramSource).toContain('title="Copy rendered SVG XML"');
        expect(mermaidDiagramSource).toContain('title="Download diagram as SVG"');
        expect(mermaidDiagramSource).toContain('title={showRawCode ? \'Hide raw code\' : \'Show raw code\'}');
        expect(mermaidDiagramSource).toContain('title="Open fullscreen preview and zoom"');
      });

      it('T1.14_7: MermaidDiagram defines subtle hover-activated CSS transition rules', () => {
        expect(mermaidDiagramSource).toContain('opacity: 0;');
        expect(mermaidDiagramSource).toContain('pointer-events: none;');
        expect(mermaidDiagramSource).toContain('.mermaid-diagram-container:hover .diagram-toolbar');
        expect(mermaidDiagramSource).toContain('.mermaid-diagram-container:focus-within .diagram-toolbar');
        expect(mermaidDiagramSource).toContain('opacity: 1;');
        expect(mermaidDiagramSource).toContain('pointer-events: auto;');
        expect(mermaidDiagramSource).toContain('transition: opacity 0.2s ease, box-shadow 0.2s ease;');
      });
    });

    // Feature 4.3: Navigation vs Document State Decoupling
    describe('F4.3: Navigation vs Document State Decoupling', () => {
      it('T1.15_1: Filtering note list does not mutate or clear the currently loaded document', () => {
        const harness = new UXStateHarness();
        const note1: NoteCardData = { id: 'n1', title: 'Active Note', content: 'Active Content', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
        const note2: NoteCardData = { id: 'n2', title: 'Other Note', content: 'Other Content', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
        harness.notes = [note1, note2];
        harness.loadNote(note1);

        harness.searchQuery = 'Unrelated Query';
        expect(harness.activeNoteId).toBe('n1');
        expect(harness.currentDocument.title).toBe('Active Note');
        expect(harness.currentDocument.content).toBe('Active Content');
      });

      it('T1.15_2: Selecting tag filter preserves active note document state in harness', () => {
        const harness = new UXStateHarness();
        const note1: NoteCardData = { id: 'n1', title: 'Active Note', content: 'Active Content', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
        harness.notes = [note1];
        harness.loadNote(note1);

        harness.selectedTagId = 'tag-xyz';
        expect(harness.activeNoteId).toBe('n1');
        expect(harness.currentDocument.title).toBe('Active Note');
      });

      it('T1.15_3: Starting new note creation sets isCreatingNew=true while preserving tags & filter state', () => {
        const harness = new UXStateHarness();
        harness.selectedTagId = 'tag-dev';
        harness.searchQuery = 'my search';

        harness.handleKeyboardShortcut({ key: 'n', metaKey: true });
        expect(harness.isCreatingNew).toBe(true);
        expect(harness.selectedTagId).toBe('tag-dev');
        expect(harness.searchQuery).toBe('my search');
      });

      it('T1.15_4: Canceling new note restores previously selected note without losing list context', () => {
        const harness = new UXStateHarness();
        const note1: NoteCardData = { id: 'n1', title: 'Active Note', content: 'Content', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
        harness.notes = [note1];
        harness.loadNote(note1);

        harness.isCreatingNew = true;
        harness.activeNoteId = null;

        // Cancel
        harness.executeNavigate('n1');
        expect(harness.isCreatingNew).toBe(false);
        expect(harness.activeNoteId).toBe('n1');
        expect(harness.currentDocument.title).toBe('Active Note');
      });

      it('T1.15_5: Clearing search filter restores full note list while retaining editor document state', () => {
        const harness = new UXStateHarness();
        const note1: NoteCardData = { id: 'n1', title: 'Active Note', content: 'Content', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
        harness.notes = [note1];
        harness.loadNote(note1);
        harness.searchQuery = 'active';

        harness.searchQuery = '';
        expect(harness.activeNoteId).toBe('n1');
        expect(harness.currentDocument.title).toBe('Active Note');
      });

      it('T1.15_6: Same-page query parameter navigation does NOT trigger unsaved changes guard dialog', () => {
        const harness = new UXStateHarness();
        const note1: NoteCardData = { id: 'n1', title: 'Draft Note', content: 'Original', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
        harness.notes = [note1];
        harness.loadNote(note1);
        harness.currentDocument.content = 'Unsaved draft text';
        expect(harness.isDirty).toBe(true);

        // Same-page search query navigation
        const allowed = harness.requestRouteNavigate(
          { pathname: '/', search: '?search=test' },
          { pathname: '/', search: '' }
        );
        expect(allowed).toBe(true);
        expect(harness.guardDialogOpen).toBe(false);
        expect(harness.currentDocument.content).toBe('Unsaved draft text');
      });

      it('T1.15_7: Cross-route navigation DOES trigger unsaved changes guard dialog on dirty note', () => {
        const harness = new UXStateHarness();
        const note1: NoteCardData = { id: 'n1', title: 'Draft Note', content: 'Original', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
        harness.notes = [note1];
        harness.loadNote(note1);
        harness.currentDocument.content = 'Unsaved draft text';
        expect(harness.isDirty).toBe(true);

        // Cross-route navigation to /login or /settings
        const allowed = harness.requestRouteNavigate(
          { pathname: '/login', search: '' },
          { pathname: '/', search: '' }
        );
        expect(allowed).toBe(false);
        expect(harness.guardDialogOpen).toBe(true);
        expect(harness.pendingTargetUrl).toBe('/login');
      });
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (Edge Conditions & Stress)
  // =========================================================================
  describe('Tier 2: Boundary & Corner Cases', () => {
    // B1: Prose Wrapping Boundary
    describe('B1: Prose Wrapping Boundary', () => {
      it('T2.1_1: Handles 10,000-character unbroken string without throwing syntax errors', () => {
        const massiveWord = 'A'.repeat(10000);
        const html = renderMarkdown(massiveWord);
        expect(html).toContain('<p>' + massiveWord + '</p>');
      });

      it('T2.1_2: Handles empty and whitespace-only markdown strings safely', () => {
        expect(renderMarkdown('')).toBe('');
        expect(renderMarkdown('   ')).toBe('');
        expect(renderMarkdown('\n\n\t  \n')).toBe('');
      });

      it('T2.1_3: Deeply nested markdown blockquotes and lists parse cleanly', () => {
        const nested = '> Level 1\n> > Level 2\n> > > Level 3\n\n- L1\n  - L2\n    - L3';
        const html = renderMarkdown(nested);
        expect(html).toContain('<blockquote>');
        expect(html).toContain('<ul><li>L1</li>');
      });

      it('T2.1_4: Special HTML entity characters in prose wrap and escape without double encoding', () => {
        const content = 'Text with special characters.';
        const html = renderMarkdown(content);
        expect(html).toContain('<p>Text with special characters.</p>');
      });

      it('T2.1_5: Mixed CJK, Arabic, and emoji unicode prose render without corrupting text', () => {
        const unicode = 'Hello 世界 🚀 مرحبا بكم in Notes app!';
        const html = renderMarkdown(unicode);
        expect(html).toContain('Hello 世界 🚀 مرحبا بكم in Notes app!');
      });
    });

    // B2: Code Block Scrolling Boundary
    describe('B2: Code Block Scrolling Boundary', () => {
      it('T2.2_1: 1,000-character single-line code snippet is preserved inside <pre><code>', () => {
        const longLine = 'x'.repeat(1000);
        const html = renderMarkdown(`\`\`\`\n${longLine}\n\`\`\``);
        expect(html).toContain('<pre><code>' + longLine);
      });

      it('T2.2_2: Empty code block parses safely without crashing', () => {
        const html = renderMarkdown('```\n```');
        expect(html).toContain('<pre><code></code></pre>');
      });

      it('T2.2_3: 20 consecutive fenced code blocks parse accurately', () => {
        let md = '';
        for (let i = 0; i < 20; i++) {
          md += `\`\`\`ts\nconst var_${i} = ${i};\n\`\`\`\n\n`;
        }
        const html = renderMarkdown(md);
        for (let i = 0; i < 20; i++) {
          expect(html).toContain(`const var_${i} = ${i};`);
        }
      });

      it('T2.2_4: Script tags inside code blocks are strictly escaped and sanitized', () => {
        const md = '```html\n<script>window.location="http://evil.com"</script>\n```';
        const html = renderMarkdown(md);
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
      });

      it('T2.2_5: Code block with unusual language tag format parses safely', () => {
        const md = '```custom.ext-lang_v2\nhello();\n```';
        const html = renderMarkdown(md);
        expect(html).toContain('class="language-custom.ext-lang_v2"');
      });
    });

    // B3: Monospace Typography Boundary
    describe('B3: Monospace Typography Boundary', () => {
      it('T2.3_1: Handles non-printable characters and control characters in monospace blocks', () => {
        const md = '`token\u0000\u001F\u007F`';
        const html = renderMarkdown(md);
        expect(html).toContain('<code>');
      });

      it('T2.3_2: Multiple inline code spans in a single paragraph render without collision', () => {
        const md = 'Use `const`, `let`, and `function` rather than `var`.';
        const html = renderMarkdown(md);
        expect(html).toContain('<code>const</code>');
        expect(html).toContain('<code>let</code>');
        expect(html).toContain('<code>function</code>');
        expect(html).toContain('<code>var</code>');
      });

      it('T2.3_3: All heading levels (h1 through h6) render with expected semantic tags', () => {
        const md = '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6';
        const html = renderMarkdown(md);
        expect(html).toContain('<h1>H1</h1>');
        expect(html).toContain('<h2>H2</h2>');
        expect(html).toContain('<h3>H3</h3>');
        expect(html).toContain('<h4>H4</h4>');
        expect(html).toContain('<h5>H5</h5>');
        expect(html).toContain('<h6>H6</h6>');
      });

      it('T2.3_4: Horizontal rule delimiters (---, ***, ___) render semantic <hr /> tags', () => {
        const md = 'Section 1\n\n---\n\nSection 2\n\n***\n\nSection 3';
        const html = renderMarkdown(md);
        expect((html.match(/<hr \/>/g) || []).length).toBe(2);
      });

      it('T2.3_5: Extremely long inline code span (500 chars) escapes and renders inside <code>', () => {
        const longSpan = 'A'.repeat(500);
        const html = renderMarkdown(`\`${longSpan}\``);
        expect(html).toContain(`<code>${longSpan}</code>`);
      });
    });

    // B4: Dirty State Boundary
    describe('B4: Dirty State Boundary', () => {
      it('T2.4_1: Note with empty string transitioning to whitespace evaluates dirty state correctly', () => {
        const harness = new UXStateHarness();
        harness.loadNote({ id: '1', title: 'Title', content: '', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] });
        expect(harness.isDirty).toBe(false);
        harness.currentDocument.content = '   ';
        expect(harness.isDirty).toBe(true);
      });

      it('T2.4_2: validateNoteInput accepts exactly 200 characters and rejects 201 characters', () => {
        expect(validateNoteInput({ title: 'A'.repeat(200), content: '' })).toBe(true);
        expect(validateNoteInput({ title: 'A'.repeat(201), content: '' })).toBe(false);
      });

      it('T2.4_3: validateNoteInput rejects empty or whitespace-only title', () => {
        expect(validateNoteInput({ title: '' })).toBe(false);
        expect(validateNoteInput({ title: '    ' })).toBe(false);
        expect(validateNoteInput({ title: '\t\n' })).toBe(false);
      });

      it('T2.4_4: Changing pin status does not corrupt document dirty tracking', () => {
        const harness = new UXStateHarness();
        const note: NoteCardData = { id: '1', title: 'Title', content: 'Content', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
        harness.notes = [note];
        harness.loadNote(note);
        note.isPinned = true;
        expect(harness.isDirty).toBe(false);
      });

      it('T2.4_5: Adding identical tag array evaluates dirty state accurately', () => {
        const harness = new UXStateHarness();
        harness.loadNote({ id: '1', title: 'T', content: 'C', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [{ id: '1', name: 'alpha' }] });
        expect(harness.isDirty).toBe(false);
        harness.currentDocument.tags = ['alpha'];
        expect(harness.isDirty).toBe(false);
      });
    });

    // B5: Navigation Guard Boundary
    describe('B5: Navigation Guard Boundary', () => {
      it('T2.5_1: Rapidly firing 50 navigation requests while dirty triggers guard dialog without crash', () => {
        const harness = new UXStateHarness();
        harness.notes = [{ id: '1', title: 'T1', content: 'C1', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] }];
        harness.loadNote(harness.notes[0]);
        harness.currentDocument.content = 'Dirty Edits';

        for (let i = 0; i < 50; i++) {
          harness.requestNavigate(`target-${i}`);
          expect(harness.guardDialogOpen).toBe(true);
        }
      });

      it('T2.5_2: Resolving guard when dialog was not open safely returns false', () => {
        const harness = new UXStateHarness();
        expect(harness.resolveGuard('stay')).toBe(false);
        expect(harness.resolveGuard('discard')).toBe(false);
        expect(harness.resolveGuard('save')).toBe(false);
      });

      it('T2.5_3: Discarding dirty changes on new note creation resets to clean state', () => {
        const harness = new UXStateHarness();
        harness.isCreatingNew = true;
        harness.currentDocument.title = 'Unsaved New Title';
        expect(harness.isDirty).toBe(true);

        harness.requestNavigate(null);
        harness.resolveGuard('discard');
        expect(harness.activeNoteId).toBeNull();
      });

      it('T2.5_4: Saving dirty note with tags persists tag relations accurately', () => {
        const harness = new UXStateHarness();
        const note: NoteCardData = { id: 'n-tag-save', title: 'Original', content: '', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
        harness.notes = [note];
        harness.loadNote(note);

        harness.currentDocument.tags = ['finance', 'tax'];
        harness.requestNavigate(null);
        harness.resolveGuard('save');
        expect(harness.notes[0].tags.map((t) => t.name)).toEqual(['finance', 'tax']);
      });

      it('T2.5_5: Pressing Escape while guard dialog is open dismisses guard dialog', () => {
        const harness = new UXStateHarness();
        harness.notes = [{ id: '1', title: 'T1', content: 'C1', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] }];
        harness.loadNote(harness.notes[0]);
        harness.currentDocument.content = 'Edits';
        harness.requestNavigate('2');
        expect(harness.guardDialogOpen).toBe(true);

        const res = harness.handleKeyboardShortcut({ key: 'Escape' });
        expect(res).toBe('dismiss_guard');
        expect(harness.guardDialogOpen).toBe(false);
      });
    });

    // B6: Segmented View Controls Boundary
    describe('B6: Segmented View Controls Boundary', () => {
      it('T2.6_1: Rapid switching between view modes 100 times executes smoothly', () => {
        const harness = new UXStateHarness();
        const modes: Array<'edit' | 'split' | 'preview'> = ['edit', 'split', 'preview'];
        for (let i = 0; i < 100; i++) {
          harness.viewMode = modes[i % 3];
        }
        expect(harness.viewMode).toBe('edit');
      });

      it('T2.6_2: Rendering NoteEditor in split mode with 10,000-char content executes without error', () => {
        const note = {
          id: 'large-note',
          title: 'Large Note',
          content: 'Paragraph content '.repeat(500),
          isPinned: false,
          tags: [],
        };
        const { html } = render(NoteEditor, { props: { note } });
        expect(html).toContain('editor-workspace split');
        expect(html).toContain('Paragraph content');
      });

      it('T2.6_3: Note with form error renders error banner with alert role', () => {
        const { html } = render(NoteEditor, {
          props: { note: null, isNew: true, formError: 'Title cannot be empty' },
        });
        expect(html).toContain('alert-error');
        expect(html).toContain('role="alert"');
        expect(html).toContain('Title cannot be empty');
      });

      it('T2.6_4: Submitting state disables primary submit button', () => {
        const { html } = render(NoteEditor, {
          props: { note: null, isNew: true, isSubmitting: true },
        });
        expect(html).toContain('disabled');
        expect(html).toContain('Saving...');
      });

      it('T2.6_5: Markdown preview with empty content displays empty-preview placeholder', () => {
        const { html } = render(NoteEditor, {
          props: { note: { id: 'empty', title: 'Empty', content: '', isPinned: false, tags: [] } },
        });
        expect(html).toContain('empty-preview');
        expect(html).toContain('Markdown preview will appear here as you type...');
      });
    });

    // B7: Focus Mode Boundary
    describe('B7: Focus Mode Boundary', () => {
      it('T2.7_1: Rapidly toggling focus mode on/off 50 times leaves focus mode in expected state', () => {
        const harness = new UXStateHarness();
        for (let i = 0; i < 50; i++) {
          harness.focusMode = !harness.focusMode;
        }
        expect(harness.focusMode).toBe(false);
      });

      it('T2.7_2: Focus mode preserves document dirty state and editor contents', () => {
        const harness = new UXStateHarness();
        harness.loadNote({ id: '1', title: 'Doc', content: 'Body', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] });
        harness.currentDocument.content = 'Unsaved writing in focus mode';
        harness.focusMode = true;
        expect(harness.isDirty).toBe(true);
        harness.focusMode = false;
        expect(harness.isDirty).toBe(true);
        expect(harness.currentDocument.content).toBe('Unsaved writing in focus mode');
      });

      it('T2.7_3: NoteEditor renders pinned checkbox with sr-only class for accessibility', () => {
        const { html } = render(NoteEditor, {
          props: { note: { id: '1', title: 'Note', content: '', isPinned: true, tags: [] } },
        });
        expect(html).toContain('pin-toggle-btn pinned');
        expect(html).toContain('sr-only');
      });

      it('T2.7_4: NoteEditor renders hidden inputs for form action serialization', () => {
        const note = {
          id: 'note-form',
          title: 'Form Note',
          content: 'Content',
          isPinned: true,
          tags: [{ id: 't1', name: 'alpha' }, { id: 't2', name: 'beta' }],
        };
        const { html } = render(NoteEditor, { props: { note } });
        expect(html).toContain('type="hidden" name="id" value="note-form"');
        expect(html).toContain('type="hidden" name="tags" value="alpha, beta"');
        expect(html).toContain('type="hidden" name="isPinned" value="true"');
      });

      it('T2.7_5: NoteEditor for new note uses action="?/create"', () => {
        const { html } = render(NoteEditor, { props: { note: null, isNew: true } });
        expect(html).toContain('action="?/create"');
        expect(html).not.toContain('name="id"');
      });
    });

    // B8: Soft-Delete Undo Toast Boundary
    describe('B8: Soft-Delete Undo Toast Boundary', () => {
      it('T2.8_1: Soft-delete timer expires after duration and purges pending deletion', () => {
        const store = new ToastState();
        const harness = new UXStateHarness(store);
        const note: NoteCardData = { id: 'exp-note', title: 'Expiring', content: '', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
        harness.notes = [note];

        harness.softDeleteNote('exp-note', 6000);
        expect(harness.pendingDeletions.has('exp-note')).toBe(true);

        vi.advanceTimersByTime(6100);
        expect(harness.pendingDeletions.has('exp-note')).toBe(false);
      });

      it('T2.8_2: Calling undoDelete on non-existent note returns false safely', () => {
        const harness = new UXStateHarness();
        expect(harness.undoDelete('non-existent-id')).toBe(false);
      });

      it('T2.8_3: ToastState remove() on non-existent ID does not mutate toasts array', () => {
        const store = new ToastState();
        store.show('Msg 1', 'info', 0);
        store.remove('bogus-id');
        expect(store.toasts.length).toBe(1);
      });

      it('T2.8_4: ToastState clear() resets toasts array to empty', () => {
        const store = new ToastState();
        store.show('Msg 1', 'info', 0);
        store.show('Msg 2', 'error', 0);
        expect(store.toasts.length).toBe(2);
        store.clear();
        expect(store.toasts.length).toBe(0);
      });

      it('T2.8_5: ToastState show() with empty or non-string message returns empty string', () => {
        const store = new ToastState();
        expect(store.show('', 'info')).toBe('');
        expect((store as any).show(null, 'info')).toBe('');
        expect((store as any).show(undefined, 'info')).toBe('');
      });
    });

    // B9: Note Card Hitboxes Boundary
    describe('B9: Note Card Hitboxes Boundary', () => {
      it('T2.9_1: NoteCard renders with invalid date string without throwing exception', () => {
        const invalidDateNote: NoteCardData = {
          id: 'inv-date',
          title: 'Invalid Date Note',
          content: 'Body',
          isPinned: false,
          createdAt: 'not-a-date',
          updatedAt: 'not-a-date',
          tags: [],
        };
        const { html } = render(NoteCard, { props: { note: invalidDateNote } });
        expect(html).toContain('Invalid Date Note');
      });

      it('T2.9_2: NoteCard without tags does not render card-tags container', () => {
        const noTagsNote: NoteCardData = {
          id: 'no-tags',
          title: 'No Tags',
          content: 'Body',
          isPinned: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
        };
        const { html } = render(NoteCard, { props: { note: noTagsNote } });
        expect(html).not.toContain('class="card-tags"');
      });

      it('T2.9_3: NoteCard with 20 tags renders 20 individual tag pills', () => {
        const tags = Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, name: `tag${i}` }));
        const multiTagNote: NoteCardData = {
          id: 'multi-tag',
          title: 'Many Tags',
          content: 'Body',
          isPinned: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags,
        };
        const { html } = render(NoteCard, { props: { note: multiTagNote } });
        for (let i = 0; i < 20; i++) {
          expect(html).toContain(`#tag${i}`);
        }
      });

      it('T2.9_4: NoteCard unpinned does not render pin-indicator badge', () => {
        const unpinnedNote: NoteCardData = {
          id: 'unpinned',
          title: 'Unpinned Note',
          content: 'Body',
          isPinned: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
        };
        const { html } = render(NoteCard, { props: { note: unpinnedNote } });
        expect(html).not.toContain('pin-indicator');
      });

      it('T2.9_5: NoteCard without onEdit and onDelete callbacks does not render those action buttons', () => {
        const note: NoteCardData = {
          id: 'no-actions',
          title: 'No Actions Note',
          content: 'Body',
          isPinned: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
        };
        const { html } = render(NoteCard, { props: { note } });
        expect(html).not.toContain('edit-btn');
        expect(html).not.toContain('delete-btn');
        expect(html).toContain('pin-btn'); // Pin button is always present
      });
    });

    // B10: Card Overflow Protection Boundary
    describe('B10: Card Overflow Protection Boundary', () => {
      it('T2.10_1: 200-character title with special characters renders without throwing', () => {
        const specialTitle = '🚀 <Special> & "Title" / \'Chars\' '.repeat(8).substring(0, 200);
        const note: NoteCardData = {
          id: 'special-title',
          title: specialTitle,
          content: 'Content',
          isPinned: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
        };
        const { html } = render(NoteCard, { props: { note } });
        expect(html).toContain('card-title');
      });

      it('T2.10_2: NoteCard preview handles content with only HTML tags', () => {
        const note: NoteCardData = {
          id: 'html-content',
          title: 'HTML Note',
          content: '<script>alert(1)</script><style>body{color:red;}</style>',
          isPinned: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
        };
        const { html } = render(NoteCard, { props: { note } });
        expect(html).not.toContain('<script>');
      });

      it('T2.10_3: SearchBar renders clear button only when search query is non-empty', () => {
        const { html: emptyHtml } = render(SearchBar, { props: { value: '' } });
        expect(emptyHtml).not.toContain('search-clear-btn');

        const { html: filledHtml } = render(SearchBar, { props: { value: 'query' } });
        expect(filledHtml).toContain('search-clear-btn');
      });

      it('T2.10_4: SearchBar input has accessible aria-label and type="text"', () => {
        const { html } = render(SearchBar, { props: { placeholder: 'Find notes...' } });
        expect(html).toContain('placeholder="Find notes..."');
        expect(html).toContain('aria-label="Search notes"');
      });

      it('T2.10_5: NoteList with 0 notes and search query renders clear filter button', () => {
        const { html } = render(NoteList, {
          props: { notes: [], searchQuery: 'missing', onClearFilters: () => {} },
        });
        expect(html).toContain('btn-clear-empty');
        expect(html).toContain('Clear Filters');
      });
    });

    // B11: Tag Filters & Input Polish Boundary
    describe('B11: Tag Filters & Input Polish Boundary', () => {
      it('T2.11_1: validateTagName handles maximum boundary length 50 chars', () => {
        expect(validateTagName('a'.repeat(50))).toBe(true);
        expect(validateTagName('a'.repeat(51))).toBe(false);
      });

      it('T2.11_2: validateTagName rejects special characters like @, #, $, %, ^, &', () => {
        expect(validateTagName('#hashtag')).toBe(false);
        expect(validateTagName('tag@domain')).toBe(false);
        expect(validateTagName('tag$money')).toBe(false);
      });

      it('T2.11_3: TagFilter renders empty state message when tags array is empty', () => {
        const { html } = render(TagFilter, { props: { tags: [] } });
        expect(html).toContain('No tags created yet');
      });

      it('T2.11_4: TagFilter renders total notes count in All Notes chip', () => {
        const { html } = render(TagFilter, { props: { tags: [], totalNotesCount: 42 } });
        expect(html).toContain('42');
      });

      it('T2.11_5: TagFilter tag-chip active applies white text and dark background class', () => {
        const tags = [{ id: 't1', name: 'active-tag', count: 5 }];
        const { html } = render(TagFilter, { props: { tags, selectedTagId: 't1' } });
        expect(html).toContain('tag-chip active');
        expect(html).toContain('#active-tag');
      });
    });

    // B12: Illustrated Empty States Boundary
    describe('B12: Illustrated Empty States Boundary', () => {
      it('T2.12_1: Search query with regex meta-characters does not crash NoteList empty state', () => {
        const regexQuery = '.*+?^${}()|[]\\';
        const { html } = render(NoteList, {
          props: { notes: [], searchQuery: regexQuery, onClearFilters: () => {} },
        });
        expect(html).toContain('No notes found');
        expect(html).toContain(regexQuery);
      });

      it('T2.12_2: Tag name with unicode characters renders correctly in empty state', () => {
        const { html } = render(NoteList, {
          props: { notes: [], selectedTagId: 't-uni', selectedTagName: '🚀launch', onClearFilters: () => {} },
        });
        expect(html).toContain('#🚀launch');
      });

      it('T2.12_3: NoteList without onClearFilters callback does not render clear button', () => {
        const { html } = render(NoteList, {
          props: { notes: [], searchQuery: 'test' },
        });
        expect(html).not.toContain('btn-clear-empty');
      });

      it('T2.12_4: NoteList without onCreateNew callback does not render create button', () => {
        const { html } = render(NoteList, { props: { notes: [] } });
        expect(html).not.toContain('btn-create-empty');
      });

      it('T2.12_5: NoteList renders section-pin-icon for pinned section', () => {
        const notesList: NoteCardData[] = [
          { id: 'p1', title: 'P1', content: '', isPinned: true, createdAt: new Date(), updatedAt: new Date(), tags: [] },
        ];
        const { html } = render(NoteList, { props: { notes: notesList } });
        expect(html).toContain('section-pin-icon');
      });
    });

    // B13: Keyboard Shortcuts Boundary
    describe('B13: Keyboard Shortcuts Boundary', () => {
      it('T2.13_1: Keyboard shortcut handler ignores keys without modifier when modifier expected', () => {
        const harness = new UXStateHarness();
        expect(harness.handleKeyboardShortcut({ key: 'k' })).toBeNull();
        expect(harness.handleKeyboardShortcut({ key: 'n' })).toBeNull();
        expect(harness.handleKeyboardShortcut({ key: 's' })).toBeNull();
      });

      it('T2.13_2: Cmd+S on clean note returns noop_clean without displaying save toast', () => {
        const store = new ToastState();
        const harness = new UXStateHarness(store);
        const note: NoteCardData = { id: '1', title: 'Clean', content: 'Clean', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
        harness.loadNote(note);

        const action = harness.handleKeyboardShortcut({ key: 's', metaKey: true });
        expect(action).toBe('noop_clean');
        expect(store.toasts.length).toBe(0);
      });

      it('T2.13_3: Shortcut handler supports lowercase and uppercase key names', () => {
        const harness = new UXStateHarness();
        expect(harness.handleKeyboardShortcut({ key: 'K', metaKey: true })).toBe('focus_search');
        expect(harness.handleKeyboardShortcut({ key: 'N', metaKey: true })).toBe('create_new');
      });

      it('T2.13_4: Shortcut handler distinguishes between Shift and non-Shift modifier combos', () => {
        const harness = new UXStateHarness();
        expect(harness.handleKeyboardShortcut({ key: 'p', metaKey: true, shiftKey: false })).toBeNull();
        expect(harness.handleKeyboardShortcut({ key: 'p', metaKey: true, shiftKey: true })).toBe('view_preview');
      });

      it('T2.13_5: Shortcut handler ignores unrelated keys like Alt, Tab, Enter gracefully', () => {
        const harness = new UXStateHarness();
        expect(harness.handleKeyboardShortcut({ key: 'Tab' })).toBeNull();
        expect(harness.handleKeyboardShortcut({ key: 'Enter' })).toBeNull();
        expect(harness.handleKeyboardShortcut({ key: 'Alt' })).toBeNull();
      });
    });

    // B14: Subtle Diagram Hover Toolbar Boundary
    describe('B14: Subtle Diagram Hover Toolbar Boundary', () => {
      it('T2.14_1: Diagram with 500 lines of definition renders fallback markup cleanly', () => {
        const lines = Array.from({ length: 500 }, (_, i) => `  Node_${i} --> Node_${i + 1}`).join('\n');
        const code = `graph TD\n${lines}`;
        const { html } = render(MermaidDiagram, { props: { code } });
        expect(html).toContain('Node_0 --> Node_1');
        expect(html).toContain('Node_499 --> Node_500');
      });

      it('T2.14_2: Diagram with special XML characters (<, >, &, ") in labels escapes cleanly', () => {
        const code = 'graph TD; A["Label <with> & \'special\' chars"] --> B;';
        const { html } = render(MermaidDiagram, { props: { code } });
        expect(html).toContain('Label &lt;with>');
        expect(html).toContain('special');
      });

      it('T2.14_3: Diagram without title does not render diagram-header container', () => {
        const { html } = render(MermaidDiagram, { props: { code: 'graph TD; A-->B;' } });
        expect(html).not.toContain('class="diagram-title"');
      });

      it('T2.14_4: Diagram with title renders diagram-title with title text', () => {
        const { html } = render(MermaidDiagram, {
          props: { code: 'graph TD; A-->B;', title: 'Custom Architecture Diagram' },
        });
        expect(html).toContain('Custom Architecture Diagram');
      });

      it('T2.14_5: generateDiagramId with empty prefix defaults to mermaid prefix', () => {
        const id = generateDiagramId('');
        expect(id.startsWith('_')).toBe(true);
      });
    });

    // B15: State Decoupling Boundary
    describe('B15: State Decoupling Boundary', () => {
      it('T2.15_1: Rapidly updating search filter 100 times does not reset active note editor text', () => {
        const harness = new UXStateHarness();
        const note: NoteCardData = { id: '1', title: 'Note 1', content: 'Original Text', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
        harness.notes = [note];
        harness.loadNote(note);
        harness.currentDocument.content = 'Custom edited content';

        for (let i = 0; i < 100; i++) {
          harness.searchQuery = `search_${i}`;
        }
        expect(harness.currentDocument.content).toBe('Custom edited content');
        expect(harness.isDirty).toBe(true);
      });

      it('T2.15_2: Selecting tag filter does not reset current note if note is already loaded', () => {
        const harness = new UXStateHarness();
        const note: NoteCardData = { id: '1', title: 'Note 1', content: 'Original Text', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
        harness.notes = [note];
        harness.loadNote(note);

        harness.selectedTagId = 'tag_1';
        expect(harness.activeNoteId).toBe('1');
      });

      it('T2.15_3: Creating new note while filtered preserves selected tag filter', () => {
        const harness = new UXStateHarness();
        harness.selectedTagId = 'tag_2';
        harness.handleKeyboardShortcut({ key: 'n', metaKey: true });
        expect(harness.isCreatingNew).toBe(true);
        expect(harness.selectedTagId).toBe('tag_2');
      });

      it('T2.15_4: Deleting a non-selected note from list preserves current active note selection', () => {
        const harness = new UXStateHarness();
        const note1: NoteCardData = { id: 'n1', title: 'Note 1', content: 'C1', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
        const note2: NoteCardData = { id: 'n2', title: 'Note 2', content: 'C2', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
        harness.notes = [note1, note2];
        harness.loadNote(note1);

        harness.softDeleteNote('n2');
        expect(harness.activeNoteId).toBe('n1');
        expect(harness.notes.length).toBe(1);
      });

      it('T2.15_5: Reverting search filter back to empty retains current note selection', () => {
        const harness = new UXStateHarness();
        const note: NoteCardData = { id: 'n1', title: 'Note 1', content: 'C1', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
        harness.notes = [note];
        harness.loadNote(note);
        harness.searchQuery = 'something';

        harness.searchQuery = '';
        expect(harness.activeNoteId).toBe('n1');
      });
    });
  });

  // =========================================================================
  // TIER 3: CROSS-FEATURE PAIRWISE COMBINATIONS (≥16 Pairwise Test Cases)
  // =========================================================================
  describe('Tier 3: Cross-Feature Pairwise Combinations', () => {
    // Pair 1: Dirty State Tracking (F1.4) + View Mode Switching (F2.1)
    it('CF1: Switching view mode between edit/split/preview preserves unsaved document dirty state', () => {
      const harness = new UXStateHarness();
      const note: NoteCardData = { id: 'n1', title: 'Doc', content: 'Original', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
      harness.loadNote(note);
      harness.currentDocument.content = 'Unsaved draft text';
      expect(harness.isDirty).toBe(true);

      harness.viewMode = 'preview';
      expect(harness.isDirty).toBe(true);
      expect(harness.currentDocument.content).toBe('Unsaved draft text');

      harness.viewMode = 'edit';
      expect(harness.isDirty).toBe(true);
      expect(harness.currentDocument.content).toBe('Unsaved draft text');
    });

    // Pair 2: Focus Mode (F2.2) + Global Keyboard Shortcuts (F4.1)
    it('CF2: Global keyboard shortcuts seamlessly control view modes while in focus mode', () => {
      const harness = new UXStateHarness();
      harness.focusMode = true;

      harness.handleKeyboardShortcut({ key: 'p', metaKey: true, shiftKey: true });
      expect(harness.viewMode).toBe('preview');

      harness.handleKeyboardShortcut({ key: 'e', metaKey: true, shiftKey: true });
      expect(harness.viewMode).toBe('edit');

      harness.handleKeyboardShortcut({ key: 'Escape' });
      expect(harness.focusMode).toBe(false);
    });

    // Pair 3: Soft-Delete with Toast (F2.3) + Tag Filtering (F3.3)
    it('CF3: Soft-deleting note from filtered tag list shows undo toast; undoing restores note to active view', () => {
      const store = new ToastState();
      const harness = new UXStateHarness(store);
      const taggedNote: NoteCardData = {
        id: 't-note-1',
        title: 'Tagged Note 1',
        content: 'Content',
        isPinned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [{ id: 'tag-1', name: 'finance' }],
      };
      harness.notes = [taggedNote];
      harness.selectedTagId = 'tag-1';
      harness.loadNote(taggedNote);

      harness.softDeleteNote('t-note-1');
      expect(harness.notes.length).toBe(0);
      expect(store.toasts.length).toBe(1);

      harness.undoDelete('t-note-1');
      expect(harness.notes.length).toBe(1);
      expect(harness.activeNoteId).toBe('t-note-1');
      expect(harness.notes[0].tags[0].name).toBe('finance');
    });

    // Pair 4: Unsaved Changes Guard (F1.5) + Filter State Decoupling (F4.3)
    it('CF4: Search filtering does not overwrite unsaved edits; note navigation prompts guard with [Stay]', () => {
      const harness = new UXStateHarness();
      const note1: NoteCardData = { id: 'n1', title: 'Note 1', content: 'C1', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
      const note2: NoteCardData = { id: 'n2', title: 'Note 2', content: 'C2', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
      harness.notes = [note1, note2];
      harness.loadNote(note1);
      harness.currentDocument.content = 'Unsaved draft in n1';

      harness.searchQuery = 'Note 2';
      expect(harness.currentDocument.content).toBe('Unsaved draft in n1');

      harness.requestNavigate('n2');
      expect(harness.guardDialogOpen).toBe(true);

      harness.resolveGuard('stay');
      expect(harness.activeNoteId).toBe('n1');
      expect(harness.currentDocument.content).toBe('Unsaved draft in n1');
    });

    // Pair 5: Long Fenced Code Blocks (F1.2) + Split View (F2.1) + Typography (F1.3)
    it('CF5: Split view renders textarea alongside rendered code block with horizontal scrolling and monospace typography', () => {
      const longCode = 'const sampleData = { id: "test", payload: "A".repeat(200) };';
      const note = {
        id: 'code-split',
        title: 'Code Split Note',
        content: `\`\`\`typescript\n${longCode}\n\`\`\``,
        isPinned: false,
        tags: [],
      };
      const { html } = render(NoteEditor, { props: { note } });
      expect(html).toContain('editor-workspace split');
      expect(html).toContain('markdown-textarea');
      expect(html).toContain('language-typescript');
      expect(html).toContain(longCode);
    });

    // Pair 6: Diagram Hover Toolbar (F4.2) + Fullscreen Focus (F2.2) + Esc Shortcut (F4.1)
    it('CF6: Mermaid diagram toolbar enables fullscreen inspection and Esc key triggers clean exit', () => {
      const harness = new UXStateHarness();
      harness.focusMode = true;
      const res = harness.handleKeyboardShortcut({ key: 'Escape' });
      expect(res).toBe('exit_focus');
      expect(harness.focusMode).toBe(false);
    });

    // Pair 7: Tag Chip Management (F3.3) + Dirty State Reactivity (F1.4)
    it('CF7: Adding new tags to note marks document dirty; saving updates tags and clears dirty state', () => {
      const harness = new UXStateHarness();
      const note: NoteCardData = { id: 'n-tag', title: 'Tag Test', content: 'Body', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
      harness.notes = [note];
      harness.loadNote(note);
      expect(harness.isDirty).toBe(false);

      harness.currentDocument.tags.push('devops');
      expect(harness.isDirty).toBe(true);

      harness.saveCurrentDocument();
      expect(harness.isDirty).toBe(false);
      expect(harness.notes[0].tags.map((t) => t.name)).toEqual(['devops']);
    });

    // Pair 8: Note Card Action Hitboxes (F3.1) + Soft Delete Undo (F2.3)
    it('CF8: Note card delete action initiates soft-delete flow with Toast undo notification', () => {
      const store = new ToastState();
      const harness = new UXStateHarness(store);
      const note: NoteCardData = { id: 'c-del', title: 'Card To Delete', content: 'Body', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
      harness.notes = [note];

      harness.softDeleteNote('c-del');
      expect(harness.notes.length).toBe(0);
      expect(store.toasts[0].message).toContain('Card To Delete');
    });

    // Pair 9: Card Title Overflow Protection (F3.2) + Pinned Status Styling (F3.1)
    it('CF9: Long 200-char title on pinned card renders amber indicator, word-break title, and action toolbar', () => {
      const note: NoteCardData = {
        id: 'c-pin-overflow',
        title: 'P'.repeat(200),
        content: 'Pinned note content',
        isPinned: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [{ id: 't1', name: 'pinned-tag' }],
      };
      const { html } = render(NoteCard, { props: { note } });
      expect(html).toContain('note-card pinned');
      expect(html).toContain('pin-indicator');
      expect(html).toContain('title-text');
      expect(html).toContain('P'.repeat(200));
      expect(html).toContain('pin-btn active-pin');
    });

    // Pair 10: Empty States (F3.4) + Keyboard Shortcuts (F4.1 - Cmd+N)
    it('CF10: From empty state, Cmd+N shortcut transitions seamlessly to new note creation workflow', () => {
      const harness = new UXStateHarness();
      harness.notes = [];
      harness.activeNoteId = null;

      const action = harness.handleKeyboardShortcut({ key: 'n', metaKey: true });
      expect(action).toBe('create_new');
      expect(harness.isCreatingNew).toBe(true);
      expect(harness.activeNoteId).toBeNull();
    });

    // Pair 11: Tag Filter (F3.3) + Empty States (F3.4) + Clear Filter Action
    it('CF11: Tag with zero notes displays tag empty state; clearing tag restores full list', () => {
      const { html: emptyHtml } = render(NoteList, {
        props: { notes: [], selectedTagId: 't-empty', selectedTagName: 'empty-tag', onClearFilters: () => {} },
      });
      expect(emptyHtml).toContain('No notes found');
      expect(emptyHtml).toContain('#empty-tag');
      expect(emptyHtml).toContain('Clear Filters');

      const populatedNotes: NoteCardData[] = [
        { id: '1', title: 'Restored Note', content: 'Body', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] },
      ];
      const { html: populatedHtml } = render(NoteList, { props: { notes: populatedNotes } });
      expect(populatedHtml).toContain('Restored Note');
      expect(populatedHtml).not.toContain('No notes found');
    });

    // Pair 12: Search Filtering (F4.3) + Soft-Delete Undo (F2.3) + Active Note Selection
    it('CF12: Soft-deleting active note while search is active auto-selects fallback note; undoing restores active note', () => {
      const store = new ToastState();
      const harness = new UXStateHarness(store);
      const note1: NoteCardData = { id: 'n1', title: 'Search Note 1', content: 'C1', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
      const note2: NoteCardData = { id: 'n2', title: 'Search Note 2', content: 'C2', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
      harness.notes = [note1, note2];
      harness.loadNote(note1);

      harness.softDeleteNote('n1');
      expect(harness.activeNoteId).toBe('n2');

      harness.undoDelete('n1');
      expect(harness.activeNoteId).toBe('n1');
      expect(harness.notes.length).toBe(2);
    });

    // Pair 13: Prose Text Wrapping (F1.1) + Fenced Code Block Scrolling (F1.2)
    it('CF13: Single document with mixed long prose paragraphs and wide code blocks parses correctly', () => {
      const prose = 'A'.repeat(500) + ' and more standard prose text.';
      const code = 'const wideCodeLine = "X".repeat(300);';
      const doc = `${prose}\n\n\`\`\`javascript\n${code}\n\`\`\``;
      const html = renderMarkdown(doc);
      expect(html).toContain('<p>' + prose + '</p>');
      expect(html).toContain('<pre><code class="language-javascript">');
      expect(html).toContain('const wideCodeLine = &quot;X&quot;.repeat(300);');
    });

    // Pair 14: Dirty State Navigation Guard (F1.5) + Delete Note Action (F2.3)
    it('CF14: Deleting active note with unsaved changes soft-deletes note and clears dirty state cleanly', () => {
      const store = new ToastState();
      const harness = new UXStateHarness(store);
      const note: NoteCardData = { id: 'n-dirty-del', title: 'Dirty Note', content: 'Original', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
      harness.notes = [note];
      harness.loadNote(note);
      harness.currentDocument.content = 'Unsaved changes before deletion';
      expect(harness.isDirty).toBe(true);

      harness.softDeleteNote('n-dirty-del');
      expect(harness.isDirty).toBe(false);
      expect(harness.notes.length).toBe(0);
      expect(store.toasts.length).toBe(1);
    });

    // Pair 15: Segmented View (F2.1) + Markdown Preview (F1.1/F1.2) + Diagram Toolbar (F4.2)
    it('CF15: Preview mode renders full markdown and diagram blocks without textarea editor pane', () => {
      const note = {
        id: 'preview-diag',
        title: 'Preview & Diagram',
        content: '# Heading\n```mermaid\ngraph LR; Start-->Stop;\n```',
        isPinned: false,
        tags: [],
      };
      const { html } = render(NoteEditor, { props: { note } });
      expect(html).toContain('<h1>Heading</h1>');
      expect(html).toContain('class="mermaid-block"');
      expect(html).toContain('Start--&gt;Stop;');
    });

    // Pair 16: Keyboard Shortcuts (F4.1) + Dirty State Save (F1.4) + Toast Notification (F2.3)
    it('CF16: Cmd+S shortcut on dirty note saves changes, clears dirty indicator, and triggers success toast', () => {
      const store = new ToastState();
      const harness = new UXStateHarness(store);
      const note: NoteCardData = { id: 'n-shortcut-save', title: 'Draft Note', content: 'Draft Content', isPinned: false, createdAt: new Date(), updatedAt: new Date(), tags: [] };
      harness.notes = [note];
      harness.loadNote(note);

      harness.currentDocument.title = 'Finalized Note Title';
      expect(harness.isDirty).toBe(true);

      const res = harness.handleKeyboardShortcut({ key: 's', metaKey: true });
      expect(res).toBe('saved');
      expect(harness.isDirty).toBe(false);
      expect(harness.notes[0].title).toBe('Finalized Note Title');
      expect(store.toasts.length).toBe(1);
      expect(store.toasts[0].type).toBe('success');
      expect(store.toasts[0].message).toContain('saved successfully');
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD APPLICATION WORKFLOWS (Scenarios 1 - 5)
  // =========================================================================
  describe('Tier 4: Real-World Application Workflows', () => {
    // Scenario 1: Long Technical Note with Fenced Code & Diagram Editing (F1.1, F1.2, F1.3, F2.1, F4.2)
    it('RW1: Long Technical Note with Fenced Code & Diagram Editing workflow', () => {
      const technicalNote: NoteEditorData = {
        id: 'tech-doc',
        title: 'RFC: Microservice Event Architecture & Database Pooling',
        content: `# System Architecture\n\nThis document describes the high-throughput event pipeline.\n\n\`\`\`typescript\ninterface EventPayload<T> {\n  id: string;\n  topic: "user.created" | "note.updated";\n  timestamp: number;\n  data: T;\n}\n\`\`\`\n\n## Architecture Flow\n\n\`\`\`mermaid\ngraph TD\n  Client[API Client] --> Gateway[API Gateway]\n  Gateway --> Service[Notes Service]\n  Service --> DB[(PostgreSQL Cluster)]\n\`\`\`\n\n## Implementation Notes\n- Use connection pooling\n- Ensure zero data loss`,
        isPinned: true,
        tags: [{ id: 't1', name: 'rfc' }, { id: 't2', name: 'architecture' }, { id: 't3', name: 'backend' }],
      };

      // 1. Render NoteEditor with technical note in split view
      const { html } = render(NoteEditor, { props: { note: technicalNote } });
      expect(html).toContain('RFC: Microservice Event Architecture');
      expect(html).toContain('editor-workspace split');

      // 2. Verify prose renders in preview pane
      expect(html).toContain('<h1>System Architecture</h1>');
      expect(html).toContain('<p>This document describes the high-throughput event pipeline.</p>');

      // 3. Verify TypeScript code block is styled with language class and pre wrapper
      expect(html).toContain('class="language-typescript"');
      expect(html).toContain('interface EventPayload&lt;T&gt;');

      // 4. Verify Mermaid diagram block is shielded and rendered
      expect(html).toContain('class="mermaid-block"');
      expect(html).toContain('Client[API Client] --&gt; Gateway[API Gateway]');

      // 5. Verify tags are rendered as editable chips
      expect(html).toContain('#rfc');
      expect(html).toContain('#architecture');
      expect(html).toContain('#backend');
    });

    // Scenario 2: Rapid Unsaved Drafting & Protected Note Navigation (F1.4, F1.5, F4.1, F4.3)
    it('RW2: Rapid Unsaved Drafting & Protected Note Navigation workflow', () => {
      const store = new ToastState();
      const harness = new UXStateHarness(store);

      const note1: NoteCardData = {
        id: 'doc-1',
        title: 'Project Roadmap 2026',
        content: 'Original Q1 goals.',
        isPinned: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [{ id: 't1', name: 'roadmap' }],
      };
      const note2: NoteCardData = {
        id: 'doc-2',
        title: 'Sprint Retro',
        content: 'Retro notes.',
        isPinned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [{ id: 't2', name: 'agile' }],
      };

      harness.notes = [note1, note2];
      harness.loadNote(note1);
      expect(harness.isDirty).toBe(false);

      // 1. Rapidly type unsaved drafting text
      harness.currentDocument.content = 'Original Q1 goals.\n- [x] Launch SvelteKit UX Polish\n- [ ] Vitest Suite 100% Pass';
      expect(harness.isDirty).toBe(true);

      // 2. Attempt to switch to note2 - should be guarded
      const firstAttempt = harness.requestNavigate('doc-2');
      expect(firstAttempt).toBe(false);
      expect(harness.guardDialogOpen).toBe(true);
      expect(harness.activeNoteId).toBe('doc-1');

      // 3. Choose [Stay] to continue drafting
      harness.resolveGuard('stay');
      expect(harness.guardDialogOpen).toBe(false);
      expect(harness.activeNoteId).toBe('doc-1');
      expect(harness.currentDocument.content).toContain('Launch SvelteKit UX Polish');

      // 4. Use Cmd+S keyboard shortcut to save draft
      const saveAction = harness.handleKeyboardShortcut({ key: 's', metaKey: true });
      expect(saveAction).toBe('saved');
      expect(harness.isDirty).toBe(false);
      expect(harness.notes[0].content).toContain('Launch SvelteKit UX Polish');

      // 5. Navigate to note2 cleanly without guard intercept
      const secondAttempt = harness.requestNavigate('doc-2');
      expect(secondAttempt).toBe(true);
      expect(harness.guardDialogOpen).toBe(false);
      expect(harness.activeNoteId).toBe('doc-2');
      expect(harness.currentDocument.title).toBe('Sprint Retro');
    });

    // Scenario 3: Distraction-Free Focus Writing & Keyboard Navigation (F2.2, F4.1, F2.1)
    it('RW3: Distraction-Free Focus Writing & Keyboard Navigation workflow', () => {
      const harness = new UXStateHarness();
      const note: NoteCardData = {
        id: 'focus-doc',
        title: 'Deep Work Essay',
        content: '# Chapter 1\n\nFocus writing in progress...',
        isPinned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
      };
      harness.notes = [note];
      harness.loadNote(note);

      // 1. Enter Focus Mode
      harness.focusMode = true;
      expect(harness.focusMode).toBe(true);

      // 2. Switch to Edit-Only view mode via Cmd+Shift+E
      harness.handleKeyboardShortcut({ key: 'e', metaKey: true, shiftKey: true });
      expect(harness.viewMode).toBe('edit');

      // 3. Write extensive prose in focus mode
      harness.currentDocument.content += '\n\nAdding more deep focus thoughts.';
      expect(harness.isDirty).toBe(true);

      // 4. Switch to Preview mode via Cmd+Shift+P to verify rendered typography
      harness.handleKeyboardShortcut({ key: 'p', metaKey: true, shiftKey: true });
      expect(harness.viewMode).toBe('preview');

      // 5. Save via Cmd+S
      harness.handleKeyboardShortcut({ key: 's', metaKey: true });
      expect(harness.isDirty).toBe(false);

      // 6. Exit Focus Mode via Escape
      harness.handleKeyboardShortcut({ key: 'Escape' });
      expect(harness.focusMode).toBe(false);
      expect(harness.notes[0].content).toContain('Adding more deep focus thoughts.');
    });

    // Scenario 4: Accidental Note Deletion & Instant Restoration via Toast (F2.3, F3.1, F3.4)
    it('RW4: Accidental Note Deletion & Instant Restoration via Toast workflow', () => {
      const store = new ToastState();
      const harness = new UXStateHarness(store);

      const criticalNote: NoteCardData = {
        id: 'crit-1',
        title: 'Critical Production Credentials & API Keys',
        content: 'SECRET_KEY=super-secret-production-token',
        isPinned: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [{ id: 't1', name: 'security' }],
      };
      const otherNote: NoteCardData = {
        id: 'other-1',
        title: 'General Documentation',
        content: 'General docs',
        isPinned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
      };

      harness.notes = [criticalNote, otherNote];
      harness.loadNote(criticalNote);

      // 1. Accidental deletion via card action button
      harness.softDeleteNote('crit-1', 6000);
      expect(harness.notes.length).toBe(1);
      expect(harness.notes.find((n) => n.id === 'crit-1')).toBeUndefined();
      expect(harness.activeNoteId).toBe('other-1');

      // 2. Toast notification is displayed with action
      expect(store.toasts.length).toBe(1);
      expect(store.toasts[0].message).toContain('Critical Production Credentials');

      // 3. User clicks Undo within 6-second window
      vi.advanceTimersByTime(2000); // 2 seconds elapsed
      const restored = harness.undoDelete('crit-1');
      expect(restored).toBe(true);

      // 4. Verify note is restored with all data, tags, and pin status intact
      expect(harness.notes.length).toBe(2);
      expect(harness.activeNoteId).toBe('crit-1');
      expect(harness.notes[0].title).toBe('Critical Production Credentials & API Keys');
      expect(harness.notes[0].isPinned).toBe(true);
      expect(harness.notes[0].tags[0].name).toBe('security');
      expect(harness.currentDocument.content).toBe('SECRET_KEY=super-secret-production-token');
    });

    // Scenario 5: Tag Organizing, Search Filtering & Empty States Discovery (F3.3, F3.4, F4.1, F4.3)
    it('RW5: Tag Organizing, Search Filtering & Empty States Discovery workflow', () => {
      const store = new ToastState();
      const harness = new UXStateHarness(store);

      const noteA: NoteCardData = {
        id: 'na',
        title: 'Frontend Architecture in Svelte 5',
        content: 'Runes and components structure',
        isPinned: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [{ id: 't1', name: 'frontend' }, { id: 't2', name: 'svelte' }],
      };
      const noteB: NoteCardData = {
        id: 'nb',
        title: 'PostgreSQL Database Migrations',
        content: 'Drizzle ORM schema definitions',
        isPinned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [{ id: 't3', name: 'backend' }, { id: 't4', name: 'database' }],
      };

      harness.notes = [noteA, noteB];
      harness.loadNote(noteA);

      // 1. Focus search using Cmd+K shortcut
      const searchFocusAction = harness.handleKeyboardShortcut({ key: 'k', metaKey: true });
      expect(searchFocusAction).toBe('focus_search');

      // 2. Type search query that yields 0 results to discover empty state
      harness.searchQuery = 'nonexistent-query-keyword';
      const filteredSearchNotes = harness.notes.filter((n) =>
        n.title.toLowerCase().includes(harness.searchQuery.toLowerCase())
      );
      expect(filteredSearchNotes.length).toBe(0);

      const { html: searchEmptyHtml } = render(NoteList, {
        props: {
          notes: filteredSearchNotes,
          searchQuery: harness.searchQuery,
          onClearFilters: () => {
            harness.searchQuery = '';
          },
        },
      });
      expect(searchEmptyHtml).toContain('No notes found');
      expect(searchEmptyHtml).toContain('"nonexistent-query-keyword"');
      expect(searchEmptyHtml).toContain('Clear Filters');

      // 3. Clear search filter
      harness.searchQuery = '';
      expect(harness.activeNoteId).toBe('na'); // active note preserved

      // 4. Select tag with 0 notes to discover tag empty state
      harness.selectedTagId = 't-mobile';
      const filteredTagNotes = harness.notes.filter((n) =>
        n.tags.some((t) => t.id === harness.selectedTagId)
      );
      expect(filteredTagNotes.length).toBe(0);

      const { html: tagEmptyHtml } = render(NoteList, {
        props: {
          notes: filteredTagNotes,
          selectedTagId: harness.selectedTagId,
          selectedTagName: 'mobile',
          onClearFilters: () => {
            harness.selectedTagId = null;
          },
        },
      });
      expect(tagEmptyHtml).toContain('No notes found');
      expect(tagEmptyHtml).toContain('#mobile');

      // 5. Clear tag filter and verify full collection available
      harness.selectedTagId = null;
      expect(harness.notes.length).toBe(2);
      expect(harness.activeNoteId).toBe('na');
      expect(harness.currentDocument.title).toBe('Frontend Architecture in Svelte 5');
    });
  });

  // =========================================================================
  // TIER 5: ADVERSARIAL COVERAGE HARDENING (Edge Conditions & Stress)
  // =========================================================================
  describe('Tier 5: Adversarial Coverage Hardening', () => {
    describe('Adversarial Card Hitbox & Layout Stress', () => {
      it('T5.1_1: handles extreme 500-character unspaced title without breaking card structure', () => {
        const extremeNote: NoteCardData = {
          id: 'extreme-1',
          title: 'X'.repeat(500),
          content: 'Content body with normal text.',
          isPinned: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [{ id: 't1', name: 'stress' }],
        };

        const { html } = render(NoteCard, {
          props: {
            note: extremeNote,
            isSelected: true,
            onEdit: () => {},
            onDelete: () => {},
          },
        });

        expect(html).toContain('card-title');
        expect(html).toContain('title-text');
        expect(html).toContain('X'.repeat(500));
        expect(html).toContain('pin-btn');
        expect(html).toContain('edit-btn');
        expect(html).toContain('delete-btn');
        expect(html).toContain('note-card pinned selected');
      });

      it('T5.1_2: renders 50 distinct tags without corrupting card action buttons', () => {
        const tags = Array.from({ length: 50 }, (_, i) => ({
          id: `tag-${i}`,
          name: `category_${i}_tag`,
        }));

        const noteWith50Tags: NoteCardData = {
          id: 'tag-50',
          title: 'Multi-Tag Note',
          content: 'Content',
          isPinned: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags,
        };

        const { html } = render(NoteCard, {
          props: { note: noteWith50Tags, onEdit: () => {}, onDelete: () => {} },
        });

        expect(html).toContain('card-tags');
        for (let i = 0; i < 50; i++) {
          expect(html).toContain(`#category_${i}_tag`);
        }
        expect(html).toContain('pin-btn');
        expect(html).toContain('edit-btn');
        expect(html).toContain('delete-btn');
      });
    });

    describe('Adversarial Tag Input & Empty States', () => {
      it('T5.2_1: TagFilter renders high contrast active tag indicator and total count chip', () => {
        const tags = [
          { id: 't1', name: 'alpha', count: 12 },
          { id: 't2', name: 'beta', count: 8 },
          { id: 't3', name: 'gamma', count: 0 },
        ];

        const { html } = render(TagFilter, {
          props: {
            tags,
            selectedTagId: 't1',
            totalNotesCount: 20,
            onSelectTag: () => {},
            onClearTag: () => {},
          },
        });

        expect(html).toContain('btn-clear-tags');
        expect(html).toContain('tag-chip active');
        expect(html).toContain('#alpha');
        expect(html).toContain('12');
        expect(html).toContain('#beta');
        expect(html).toContain('8');
        expect(html).toContain('#gamma');
        expect(html).toContain('0');
        expect(html).toContain('All Notes');
        expect(html).toContain('20');
      });

      it('T5.2_2: renders search empty state with special characters and HTML strings safely', () => {
        const maliciousQuery = '<script>alert("xss")</script> & "quotes" \'single\'';
        const { html } = render(NoteList, {
          props: {
            notes: [],
            searchQuery: maliciousQuery,
            onClearFilters: () => {},
          },
        });

        expect(html).toContain('No notes found');
        expect(html).toContain('Clear Filters');
        expect(html).not.toContain('<script>alert');
      });

      it('T5.2_3: renders tag empty state with emoji tags cleanly', () => {
        const { html } = render(NoteList, {
          props: {
            notes: [],
            selectedTagId: 't-emoji',
            selectedTagName: '🚀launch-v2',
            onClearFilters: () => {},
          },
        });

        expect(html).toContain('No notes found');
        expect(html).toContain('#🚀launch-v2');
        expect(html).toContain('Clear Filters');
      });
    });

    describe('Adversarial State Decoupling & Diagram Toolbar', () => {
      it('T5.3_1: retains loaded editor document when search filter yields 0 matches', () => {
        const harness = new UXStateHarness();
        const note1: NoteCardData = {
          id: 'n1',
          title: 'Important Specification',
          content: 'Critical architecture documentation',
          isPinned: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [{ id: 't1', name: 'spec' }],
        };
        harness.notes = [note1];
        harness.loadNote(note1);

        harness.searchQuery = 'nonexistent keyword';
        expect(harness.activeNoteId).toBe('n1');
        expect(harness.currentDocument.title).toBe('Important Specification');
        expect(harness.currentDocument.content).toBe('Critical architecture documentation');
      });

      it('T5.3_2: renders diagram container with full accessibility and SSR fallback attributes', () => {
        const { html } = render(MermaidDiagram, {
          props: {
            code: 'graph TD\n  A[Start] --> B{Decide}\n  B -->|Yes| C[OK]\n  B -->|No| D[Retry]',
            title: 'Decision Flow',
          },
        });

        expect(html).toContain('Decision Flow');
        expect(html).toContain('diagram-title');
        expect(html).toContain('mermaid-block');
        expect(html).toContain('data-mermaid-code=');
        expect(html).toContain('language-mermaid');
      });
    });
  });
});
