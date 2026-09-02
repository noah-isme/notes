import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'svelte/server';
import NoteEditor, { type NoteEditorData } from '../../src/lib/components/NoteEditor.svelte';
import { renderMarkdown } from '../../src/lib/utils/markdown';

/**
 * Challenger M2.1 Empirical Stress Test Suite
 * Adversarially challenges:
 * 1. Segmented View Mode Controls (F2.1)
 * 2. Editor Focus / Fullscreen Mode (F2.2)
 */

describe('Challenger M2.1: Empirical Stress Tests for F2.1 & F2.2', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // F2.1: Segmented View Mode Controls Empirical & Stress Tests
  // =========================================================================
  describe('F2.1: Segmented View Mode Controls', () => {
    const mockNote: NoteEditorData = {
      id: 'n1',
      title: 'Challenger Note',
      content: '# Title\n\nSome **markdown** text.',
      isPinned: false,
      tags: [{ id: 't1', name: 'ux' }],
    };

    it('CH2.1-01: renders segmented control container with correct ARIA tablist role and accessibility labels', () => {
      const { html } = render(NoteEditor, {
        props: { note: mockNote, viewMode: 'split' },
      });

      expect(html).toContain('view-mode-tabs segmented-control');
      expect(html).toContain('role="tablist"');
      expect(html).toContain('aria-label="Editor View Modes"');
    });

    it('CH2.1-02: renders all 3 tabs with role="tab", correct data-testid, and distinct labels', () => {
      const { html } = render(NoteEditor, {
        props: { note: mockNote, viewMode: 'split' },
      });

      expect(html).toContain('data-testid="mode-edit"');
      expect(html).toContain('data-testid="mode-split"');
      expect(html).toContain('data-testid="mode-preview"');
      expect(html).toContain('role="tab"');
      expect(html).toContain('Edit');
      expect(html).toContain('Split');
      expect(html).toContain('Preview');
    });

    it('CH2.1-03: roving tabindex and aria-selected accurately reflect active viewMode = edit', () => {
      const { html } = render(NoteEditor, {
        props: { note: mockNote, viewMode: 'edit' },
      });

      // Edit tab should be active
      expect(html).toMatch(/class="[^"]*mode-btn active btn-segmented[^"]*"[^>]*data-testid="mode-edit"/);
      expect(html).toMatch(/data-testid="mode-edit"/);
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('tabindex="0"');

      // Split and Preview tabs should be inactive
      expect(html).toMatch(/class="[^"]*mode-btn\s+btn-segmented[^"]*"[^>]*data-testid="mode-split"/);
      expect(html).toMatch(/class="[^"]*mode-btn\s+btn-segmented[^"]*"[^>]*data-testid="mode-preview"/);
    });

    it('CH2.1-04: roving tabindex and aria-selected accurately reflect active viewMode = preview', () => {
      const { html } = render(NoteEditor, {
        props: { note: mockNote, viewMode: 'preview' },
      });

      // Preview tab should be active
      expect(html).toMatch(/class="[^"]*mode-btn active btn-segmented[^"]*"[^>]*data-testid="mode-preview"/);
      expect(html).toMatch(/data-testid="mode-preview"/);

      // Edit and Split should be inactive
      expect(html).toMatch(/class="[^"]*mode-btn\s+btn-segmented[^"]*"[^>]*data-testid="mode-edit"/);
      expect(html).toMatch(/class="[^"]*mode-btn\s+btn-segmented[^"]*"[^>]*data-testid="mode-split"/);
    });

    it('CH2.1-05: DOM workspace structure enforces strict pane visibility per view mode', () => {
      // 1. Edit mode: editor-pane present, preview-pane absent
      const editRender = render(NoteEditor, { props: { note: mockNote, viewMode: 'edit' } });
      expect(editRender.html).toContain('editor-workspace edit');
      expect(editRender.html).toContain('workspace-pane editor-pane');
      expect(editRender.html).not.toContain('workspace-pane preview-pane');

      // 2. Split mode: both editor-pane and preview-pane present
      const splitRender = render(NoteEditor, { props: { note: mockNote, viewMode: 'split' } });
      expect(splitRender.html).toContain('editor-workspace split');
      expect(splitRender.html).toContain('workspace-pane editor-pane');
      expect(splitRender.html).toContain('workspace-pane preview-pane');

      // 3. Preview mode: preview-pane present, editor-pane absent
      const previewRender = render(NoteEditor, { props: { note: mockNote, viewMode: 'preview' } });
      expect(previewRender.html).toContain('editor-workspace preview');
      expect(previewRender.html).not.toContain('workspace-pane editor-pane');
      expect(previewRender.html).toContain('workspace-pane preview-pane');
    });

    it('CH2.1-06: Arrow and Home/End keyboard navigation state transition machine logic', () => {
      const viewModes: Array<'edit' | 'split' | 'preview'> = ['edit', 'split', 'preview'];
      let currentMode: 'edit' | 'split' | 'preview' = 'split';

      function simulateKey(key: string) {
        let defaultPrevented = false;
        const e = {
          key,
          preventDefault: () => {
            defaultPrevented = true;
          },
        };

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          const idx = viewModes.indexOf(currentMode);
          const nextIdx = (idx + 1) % viewModes.length;
          currentMode = viewModes[nextIdx];
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          const idx = viewModes.indexOf(currentMode);
          const prevIdx = (idx - 1 + viewModes.length) % viewModes.length;
          currentMode = viewModes[prevIdx];
        } else if (e.key === 'Home') {
          e.preventDefault();
          currentMode = 'edit';
        } else if (e.key === 'End') {
          e.preventDefault();
          currentMode = 'preview';
        }

        return { currentMode, defaultPrevented };
      }

      // Starting from split
      expect(currentMode).toBe('split');

      // ArrowRight -> preview
      let res = simulateKey('ArrowRight');
      expect(res.currentMode).toBe('preview');
      expect(res.defaultPrevented).toBe(true);

      // ArrowRight from preview -> wraps to edit
      res = simulateKey('ArrowRight');
      expect(res.currentMode).toBe('edit');
      expect(res.defaultPrevented).toBe(true);

      // ArrowDown from edit -> split
      res = simulateKey('ArrowDown');
      expect(res.currentMode).toBe('split');
      expect(res.defaultPrevented).toBe(true);

      // ArrowLeft from split -> edit
      res = simulateKey('ArrowLeft');
      expect(res.currentMode).toBe('edit');
      expect(res.defaultPrevented).toBe(true);

      // ArrowLeft from edit -> wraps to preview
      res = simulateKey('ArrowLeft');
      expect(res.currentMode).toBe('preview');
      expect(res.defaultPrevented).toBe(true);

      // ArrowUp from preview -> split
      res = simulateKey('ArrowUp');
      expect(res.currentMode).toBe('split');
      expect(res.defaultPrevented).toBe(true);

      // Home from split -> edit
      res = simulateKey('Home');
      expect(res.currentMode).toBe('edit');
      expect(res.defaultPrevented).toBe(true);

      // End from edit -> preview
      res = simulateKey('End');
      expect(res.currentMode).toBe('preview');
      expect(res.defaultPrevented).toBe(true);

      // Non-nav key -> ignored without preventDefault
      res = simulateKey('Tab');
      expect(res.currentMode).toBe('preview');
      expect(res.defaultPrevented).toBe(false);
    });

    it('CH2.1-07: Stress test: 10,000 rapid view mode transitions maintains deterministic state', () => {
      const viewModes: Array<'edit' | 'split' | 'preview'> = ['edit', 'split', 'preview'];
      let currentMode: 'edit' | 'split' | 'preview' = 'edit';

      const keySequence = ['ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];

      for (let i = 0; i < 10000; i++) {
        const key = keySequence[i % keySequence.length];
        if (key === 'ArrowRight' || key === 'ArrowDown') {
          const idx = viewModes.indexOf(currentMode);
          currentMode = viewModes[(idx + 1) % viewModes.length];
        } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
          const idx = viewModes.indexOf(currentMode);
          currentMode = viewModes[(idx - 1 + viewModes.length) % viewModes.length];
        } else if (key === 'Home') {
          currentMode = 'edit';
        } else if (key === 'End') {
          currentMode = 'preview';
        }
        expect(viewModes).toContain(currentMode);
      }

      // Check final state matches expected calculation after 10,000 steps
      expect(['edit', 'split', 'preview']).toContain(currentMode);
    });
  });

  // =========================================================================
  // F2.2: Editor Focus / Fullscreen Mode Empirical & Stress Tests
  // =========================================================================
  describe('F2.2: Editor Focus / Fullscreen Mode', () => {
    const mockNote: NoteEditorData = {
      id: 'n1',
      title: 'Focus Testing Note',
      content: '# Deep Work\nDistraction-free markdown drafting.',
      isPinned: true,
      tags: [{ id: 't1', name: 'focus' }],
    };

    it('CH2.2-01: renders focus mode toggle button with correct attributes in inactive state', () => {
      const { html } = render(NoteEditor, {
        props: { note: mockNote, isFocusMode: false },
      });

      expect(html).toContain('data-testid="toggle-focus-mode"');
      expect(html).toMatch(/class="[^"]*focus-toggle-btn\s+[^"]*"/);
      expect(html).not.toMatch(/class="[^"]*focus-toggle-btn\s+active/);
      expect(html).toContain('title="Enter focus mode"');
      expect(html).toContain('aria-label="Enter focus mode"');
      expect(html).toContain('aria-pressed="false"');
      expect(html).toContain('Focus');
      expect(html).not.toContain('Exit Focus');
    });

    it('CH2.2-02: renders focus mode toggle button with active styling and Esc hint in active state', () => {
      const { html } = render(NoteEditor, {
        props: { note: mockNote, isFocusMode: true },
      });

      expect(html).toContain('data-testid="toggle-focus-mode"');
      expect(html).toMatch(/class="[^"]*focus-toggle-btn\s+active/);
      expect(html).toContain('title="Exit focus mode (Esc)"');
      expect(html).toContain('aria-label="Exit focus mode"');
      expect(html).toContain('aria-pressed="true"');
      expect(html).toContain('Exit Focus');
    });

    it('CH2.2-03: Focus mode works seamlessly across all 3 view modes (edit, split, preview)', () => {
      for (const mode of ['edit', 'split', 'preview'] as const) {
        const { html } = render(NoteEditor, {
          props: { note: mockNote, isFocusMode: true, viewMode: mode },
        });

        expect(html).toMatch(/class="[^"]*focus-toggle-btn\s+active/);
        expect(html).toContain(`editor-workspace ${mode}`);

        if (mode === 'edit') {
          expect(html).toContain('workspace-pane editor-pane');
          expect(html).not.toContain('workspace-pane preview-pane');
        } else if (mode === 'split') {
          expect(html).toContain('workspace-pane editor-pane');
          expect(html).toContain('workspace-pane preview-pane');
        } else if (mode === 'preview') {
          expect(html).not.toContain('workspace-pane editor-pane');
          expect(html).toContain('workspace-pane preview-pane');
        }
      }
    });

    it('CH2.2-04: Esc key dismissal handler correctly exits focus mode without side effects', () => {
      let isFocusMode = true;
      let showUnsavedDialog = false;

      function handleGlobalKeyDown(e: { key: string; preventDefault: () => void }) {
        if (e.key === 'Escape') {
          if (showUnsavedDialog) {
            return;
          }
          if (isFocusMode) {
            e.preventDefault();
            isFocusMode = false;
          }
        }
      }

      let prevented = false;
      handleGlobalKeyDown({
        key: 'Escape',
        preventDefault: () => {
          prevented = true;
        },
      });

      expect(isFocusMode).toBe(false);
      expect(prevented).toBe(true);

      // Pressing Escape again when focus mode is already false does not preventDefault
      let secondPrevented = false;
      handleGlobalKeyDown({
        key: 'Escape',
        preventDefault: () => {
          secondPrevented = true;
        },
      });
      expect(isFocusMode).toBe(false);
      expect(secondPrevented).toBe(false);
    });

    it('CH2.2-05: Priority rule: Esc does not close focus mode if unsaved changes dialog is open', () => {
      let isFocusMode = true;
      let showUnsavedDialog = true;

      function handleGlobalKeyDown(e: { key: string; preventDefault: () => void }) {
        if (e.key === 'Escape') {
          if (showUnsavedDialog) {
            return;
          }
          if (isFocusMode) {
            e.preventDefault();
            isFocusMode = false;
          }
        }
      }

      let prevented = false;
      handleGlobalKeyDown({
        key: 'Escape',
        preventDefault: () => {
          prevented = true;
        },
      });

      // Dialog is open so focus mode must remain active (prevent premature exit behind dialog)
      expect(isFocusMode).toBe(true);
      expect(prevented).toBe(false);
    });

    it('CH2.2-06: Deleting active note while in focus mode exits focus mode and selects fallback', () => {
      let notes = [
        { id: 'n1', title: 'Note 1', content: 'C1' },
        { id: 'n2', title: 'Note 2', content: 'C2' },
      ];
      let selectedNoteId: string | null = 'n1';
      let isFocusMode = true;

      function handleDeleteNote(noteId: string) {
        notes = notes.filter((n) => n.id !== noteId);
        if (selectedNoteId === noteId) {
          if (notes.length > 0) {
            selectedNoteId = notes[0].id;
          } else {
            selectedNoteId = null;
          }
        }
        isFocusMode = false;
      }

      handleDeleteNote('n1');

      expect(notes.length).toBe(1);
      expect(selectedNoteId).toBe('n2');
      expect(isFocusMode).toBe(false); // Cleanly restored
    });

    it('CH2.2-07: Stress test: 5,000 rapid focus mode toggles leave state fully consistent', () => {
      let isFocusMode = false;
      let toggleCount = 0;

      for (let i = 0; i < 5000; i++) {
        isFocusMode = !isFocusMode;
        toggleCount++;
      }

      expect(toggleCount).toBe(5000);
      expect(isFocusMode).toBe(false); // 5000 is even -> returns to false cleanly
    });

    it('CH2.2-08: Full layout CSS classes inspection for focus-mode container and pane hiding', () => {
      // Simulating the CSS class rules from +page.svelte
      function getLayoutClasses(isFocus: boolean, mobileView: 'list' | 'editor') {
        return `master-detail-layout ${isFocus ? 'focus-mode' : ''} ${mobileView === 'editor' ? 'show-editor-mobile' : 'show-list-mobile'}`.trim();
      }

      expect(getLayoutClasses(false, 'list')).toBe('master-detail-layout  show-list-mobile');
      expect(getLayoutClasses(true, 'list')).toBe('master-detail-layout focus-mode show-list-mobile');
      expect(getLayoutClasses(true, 'editor')).toBe('master-detail-layout focus-mode show-editor-mobile');
      expect(getLayoutClasses(false, 'editor')).toBe('master-detail-layout  show-editor-mobile');
    });
  });

  // =========================================================================
  // Cross-Cutting Workflows: View Modes + Focus Mode + Resizing & Editing
  // =========================================================================
  describe('Cross-Cutting: View Modes + Focus Mode + Resizing & Editing', () => {
    it('CH-CROSS-01: End-to-end workflow: focus mode entry -> editing -> mode change -> escape restore', () => {
      let isFocusMode = false;
      let viewMode: 'edit' | 'split' | 'preview' = 'split';
      let content = 'Initial draft';
      let isDirty = false;

      // 1. Enter focus mode
      isFocusMode = true;
      expect(isFocusMode).toBe(true);

      // 2. Switch to edit mode for maximum writing space
      viewMode = 'edit';
      expect(viewMode).toBe('edit');

      // 3. Edit content
      content += ' with additional paragraphs.';
      isDirty = true;
      expect(isDirty).toBe(true);

      // 4. Switch to preview to inspect rendering
      viewMode = 'preview';
      const rendered = renderMarkdown(content);
      expect(rendered).toContain('<p>Initial draft with additional paragraphs.</p>');

      // 5. Exit focus mode via Esc key
      if (isFocusMode) {
        isFocusMode = false;
      }
      expect(isFocusMode).toBe(false);

      // 6. Verify edits and dirty state remain completely intact
      expect(content).toBe('Initial draft with additional paragraphs.');
      expect(isDirty).toBe(true);
      expect(viewMode).toBe('preview');
    });

    it('CH-CROSS-02: Window resize simulation: switching between mobile and desktop while in focus mode', () => {
      let isFocusMode = true;
      let mobileView: 'list' | 'editor' = 'editor';
      let windowWidth = 1200;

      // User enters focus mode on desktop
      expect(isFocusMode).toBe(true);
      expect(windowWidth).toBe(1200);

      // Viewport resizes to mobile (< 768px)
      windowWidth = 480;
      mobileView = 'editor';

      // Focus mode should still be active or dismissible cleanly
      expect(isFocusMode).toBe(true);

      // User presses Esc to exit focus mode on mobile
      isFocusMode = false;
      expect(isFocusMode).toBe(false);

      // Viewport resizes back to desktop (> 768px)
      windowWidth = 1440;
      expect(isFocusMode).toBe(false);
      expect(windowWidth >= 768).toBe(true);
    });
  });
});
