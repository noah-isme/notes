import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import NoteEditor from '../../src/lib/components/NoteEditor.svelte';
import MarkdownViewer from '../../src/lib/components/MarkdownViewer.svelte';
import UnsavedChangesDialog from '../../src/lib/components/UnsavedChangesDialog.svelte';

describe('Milestone 1 (F1.1 - F1.5): Editor Ergonomics, Typography, Dirty State & Navigation Guard', () => {
  describe('F1.1 & F1.3: Editor Prose Wrapping & Typography', () => {
    it('NoteEditor textarea renders with markdown-textarea class and proper attributes', () => {
      const { html } = render(NoteEditor, {
        props: {
          note: {
            id: 'n1',
            title: 'Test Note',
            content: 'Standard markdown content with prose and code.',
            isPinned: false,
            tags: [{ id: 't1', name: 'svelte' }],
          },
        },
      });

      expect(html).toContain('markdown-textarea');
      expect(html).toContain('name="content"');
      expect(html).toContain('aria-label="Markdown Content"');
      expect(html).toContain('Standard markdown content with prose and code.');
    });

    it('NoteEditor title input has maxlength 200 and character counter', () => {
      const { html } = render(NoteEditor, {
        props: {
          note: {
            id: 'n1',
            title: 'Sample Title Here',
            content: '',
            isPinned: false,
            tags: [],
          },
        },
      });

      expect(html).toContain('maxlength="200"');
      expect(html).toContain('17/200');
    });

    it('NoteEditor renders split view with editor-pane and preview-pane', () => {
      const { html } = render(NoteEditor, {
        props: {
          note: {
            id: 'n1',
            title: 'Split View Test',
            content: '# Heading\n\nSome paragraph text.',
            isPinned: false,
            tags: [],
          },
        },
      });

      expect(html).toContain('editor-workspace');
      expect(html).toContain('split');
      expect(html).toContain('workspace-pane editor-pane');
      expect(html).toContain('workspace-pane preview-pane');
      expect(html).toContain('markdown-preview');
    });
  });

  describe('F1.2: Code Block Horizontal Scrolling & MarkdownViewer', () => {
    it('MarkdownViewer renders standard prose and code blocks cleanly', () => {
      const content = '# Title\n\nProse paragraph.\n\n```typescript\nconst x: number = 42;\n```';
      const { html } = render(MarkdownViewer, {
        props: { content },
      });

      expect(html).toContain('markdown-viewer');
      expect(html).toContain('<h1>Title</h1>');
      expect(html).toContain('<p>Prose paragraph.</p>');
      expect(html).toContain('<pre><code class="language-typescript">');
      expect(html).toContain('const x: number = 42;');
    });

    it('MarkdownViewer renders inline code spans', () => {
      const content = 'Use `pnpm check` to verify.';
      const { html } = render(MarkdownViewer, {
        props: { content },
      });

      expect(html).toContain('<code>pnpm check</code>');
    });
  });

  describe('F1.4: Reactive Dirty State & Indicators', () => {
    it('Renders clean note without unsaved-badge and without is-dirty button class in SSR', () => {
      const { html } = render(NoteEditor, {
        props: {
          note: {
            id: 'n1',
            title: 'Clean Note',
            content: 'Unchanged content',
            isPinned: false,
            tags: [],
          },
          isNew: false,
        },
      });

      expect(html).not.toContain('unsaved-badge');
      expect(html).not.toContain('Unsaved changes');
      expect(html).toContain('btn-primary');
      expect(html).not.toContain('is-dirty');
    });

    it('Renders Create Note for new note form action', () => {
      const { html } = render(NoteEditor, {
        props: {
          note: null,
          isNew: true,
        },
      });

      expect(html).toContain('action="?/create"');
      expect(html).toContain('Create Note');
    });
  });

  describe('F1.5: UnsavedChangesDialog Component', () => {
    it('Renders nothing when isOpen is false', () => {
      const { html } = render(UnsavedChangesDialog, {
        props: {
          isOpen: false,
        },
      });

      expect(html).not.toContain('modal-backdrop');
      expect(html).not.toContain('modal-card');
      expect(html).not.toContain('role="dialog"');
    });

    it('Renders accessible modal dialog when isOpen is true', () => {
      const { html } = render(UnsavedChangesDialog, {
        props: {
          isOpen: true,
          title: 'Unsaved Changes Detected',
          message: 'You have pending modifications.',
        },
      });

      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('id="unsaved-dialog-title"');
      expect(html).toContain('Unsaved Changes Detected');
      expect(html).toContain('id="unsaved-dialog-desc"');
      expect(html).toContain('You have pending modifications.');
      expect(html).toContain('btn-stay');
      expect(html).toContain('btn-discard');
      expect(html).toContain('btn-save');
      expect(html).toContain('Stay');
      expect(html).toContain('Discard');
      expect(html).toContain('Save');
    });

    it('Renders Saving... label on save button when isSaving is true', () => {
      const { html } = render(UnsavedChangesDialog, {
        props: {
          isOpen: true,
          isSaving: true,
        },
      });

      expect(html).toContain('Saving...');
      expect(html).toContain('disabled');
    });
  });
});
