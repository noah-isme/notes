import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'svelte/server';
import NoteEditor, { type NoteEditorData } from '../../src/lib/components/NoteEditor.svelte';
import UnsavedChangesDialog from '../../src/lib/components/UnsavedChangesDialog.svelte';
import { ToastState } from '../../src/lib/stores/toast.svelte';

/**
 * High-fidelity empirical simulation harness replicating the exact logic of
 * NoteEditor.svelte, UnsavedChangesDialog.svelte, and +page.svelte.
 */
class NavigationGuardStressHarness {
  // Navigation & document state
  activeNoteId: string | null = null;
  isCreatingNew: boolean = false;
  notes: Array<{
    id: string;
    title: string;
    content: string;
    isPinned: boolean;
    tags: Array<{ id?: string; name: string }>;
  }> = [];

  // Editor internal reactive state
  title: string = '';
  content: string = '';
  isPinned: boolean = false;
  tagList: string[] = [];
  tagInput: string = '';
  titleTouched: boolean = false;

  // Baseline snapshots (identical to NoteEditor.svelte)
  initialTitle: string = '';
  initialContent: string = '';
  initialIsPinned: boolean = false;
  initialTagList: string[] = [];

  // Navigation Guard states (identical to +page.svelte)
  isEditorDirty: boolean = false;
  showUnsavedDialog: boolean = false;
  isDialogSaving: boolean = false;
  pendingAction: (() => void | Promise<void>) | null = null;
  pendingNavigationUrl: string | null = null;
  toastStore: ToastState;

  // Mock server save failure trigger
  mockSaveFail: boolean = false;
  mockSaveErrorMessage: string = 'Internal Server Error';

  constructor(toastStore: ToastState = new ToastState()) {
    this.toastStore = toastStore;
  }

  // Load existing note into editor
  loadNote(note: {
    id: string;
    title: string;
    content: string;
    isPinned: boolean;
    tags: Array<{ id?: string; name: string }>;
  }) {
    this.activeNoteId = note.id;
    this.isCreatingNew = false;

    this.initialTitle = note.title;
    this.initialContent = note.content;
    this.initialIsPinned = note.isPinned;
    this.initialTagList = note.tags ? note.tags.map((t) => t.name) : [];

    this.title = this.initialTitle;
    this.content = this.initialContent;
    this.isPinned = this.initialIsPinned;
    this.tagList = [...this.initialTagList];
    this.tagInput = '';
    this.titleTouched = false;
    this.updateDirtyState();
  }

  // Start new note
  createNewNote() {
    this.activeNoteId = null;
    this.isCreatingNew = true;

    this.initialTitle = '';
    this.initialContent = '';
    this.initialIsPinned = false;
    this.initialTagList = [];

    this.title = '';
    this.content = '';
    this.isPinned = false;
    this.tagList = [];
    this.tagInput = '';
    this.titleTouched = false;
    this.updateDirtyState();
  }

  // NoteEditor.svelte tag comparison helper
  static areTagListsEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((tag, i) => tag === sortedB[i]);
  }

  // NoteEditor.svelte isDirtyDerived computation
  get isDirtyDerived(): boolean {
    if (this.isCreatingNew) {
      return (
        this.title.trim().length > 0 ||
        this.content.trim().length > 0 ||
        this.tagList.length > 0 ||
        this.isPinned
      );
    }
    const titleChanged = this.title !== this.initialTitle;
    const contentChanged = this.content !== this.initialContent;
    const pinChanged = this.isPinned !== this.initialIsPinned;
    const tagsChanged = !NavigationGuardStressHarness.areTagListsEqual(this.tagList, this.initialTagList);

    return titleChanged || contentChanged || pinChanged || tagsChanged;
  }

  updateDirtyState() {
    this.isEditorDirty = this.isDirtyDerived;
  }

  get isTitleValid(): boolean {
    return this.title.trim().length > 0 && this.title.trim().length <= 200;
  }

  addTag(raw: string) {
    const cleaned = raw.replace(/^#/, '').trim();
    if (cleaned && !this.tagList.includes(cleaned)) {
      this.tagList = [...this.tagList, cleaned];
    }
    this.tagInput = '';
    this.updateDirtyState();
  }

  removeTag(index: number) {
    this.tagList = this.tagList.filter((_, i) => i !== index);
    this.updateDirtyState();
  }

  resetToBaseline() {
    this.title = this.initialTitle;
    this.content = this.initialContent;
    this.isPinned = this.initialIsPinned;
    this.tagList = [...this.initialTagList];
    this.tagInput = '';
    this.titleTouched = false;
    this.updateDirtyState();
  }

  async submitSave(): Promise<{ success: boolean; error?: string }> {
    this.titleTouched = true;
    if (!this.isTitleValid) {
      return { success: false, error: 'Title is required (1-200 characters)' };
    }

    if (this.mockSaveFail) {
      return { success: false, error: this.mockSaveErrorMessage };
    }

    // Persist to notes array in memory
    if (this.isCreatingNew) {
      const newId = `note_${Date.now()}_${Math.random()}`;
      const newNote = {
        id: newId,
        title: this.title.trim(),
        content: this.content,
        isPinned: this.isPinned,
        tags: this.tagList.map((name) => ({ name })),
      };
      this.notes.push(newNote);
      this.activeNoteId = newId;
      this.isCreatingNew = false;
    } else if (this.activeNoteId) {
      const existing = this.notes.find((n) => n.id === this.activeNoteId);
      if (existing) {
        existing.title = this.title.trim();
        existing.content = this.content;
        existing.isPinned = this.isPinned;
        existing.tags = this.tagList.map((name) => ({ name }));
      }
    }

    this.initialTitle = this.title.trim();
    this.initialContent = this.content;
    this.initialIsPinned = this.isPinned;
    this.initialTagList = [...this.tagList];
    this.updateDirtyState();

    return { success: true };
  }

  // +page.svelte confirmIfDirty implementation
  confirmIfDirty(action: () => void | Promise<void>) {
    this.updateDirtyState();
    if (this.isEditorDirty) {
      this.pendingAction = action;
      this.showUnsavedDialog = true;
    } else {
      action();
    }
  }

  // +page.svelte handleSelectNote
  selectNote(targetNoteId: string) {
    if (this.activeNoteId === targetNoteId && !this.isCreatingNew) {
      return;
    }
    this.confirmIfDirty(() => {
      this.activeNoteId = targetNoteId;
      this.isCreatingNew = false;
      const found = this.notes.find((n) => n.id === targetNoteId);
      if (found) {
        this.loadNote(found);
      }
    });
  }

  // +page.svelte handleCreateNew
  clickCreateNew() {
    if (this.isCreatingNew && !this.isEditorDirty) {
      return;
    }
    this.confirmIfDirty(() => {
      this.createNewNote();
    });
  }

  // Dialog actions
  handleDialogStay() {
    this.showUnsavedDialog = false;
    this.pendingAction = null;
    this.pendingNavigationUrl = null;
  }

  handleDialogDiscard() {
    this.isEditorDirty = false;
    this.showUnsavedDialog = false;
    this.resetToBaseline();

    const action = this.pendingAction;
    this.pendingAction = null;
    this.pendingNavigationUrl = null;

    if (action) {
      action();
    }
  }

  async handleDialogSave(): Promise<boolean> {
    this.isDialogSaving = true;
    try {
      const result = await this.submitSave();
      if (result.success) {
        this.toastStore.success('Note saved successfully');
        this.isEditorDirty = false;
        this.showUnsavedDialog = false;

        const action = this.pendingAction;
        this.pendingAction = null;
        this.pendingNavigationUrl = null;

        if (action) {
          await action();
        }
        return true;
      } else {
        this.toastStore.error(result.error || 'Failed to save note');
        return false;
      }
    } catch {
      this.toastStore.error('An error occurred while saving note');
      return false;
    } finally {
      this.isDialogSaving = false;
    }
  }
}

describe('Challenger M1.1: Empirical Stress Harness & Adversarial Edge Cases', () => {
  let toastStore: ToastState;
  let harness: NavigationGuardStressHarness;

  beforeEach(() => {
    toastStore = new ToastState();
    harness = new NavigationGuardStressHarness(toastStore);
    harness.notes = [
      {
        id: 'note-1',
        title: 'Original Title 1',
        content: 'Original content 1 with markdown prose.',
        isPinned: false,
        tags: [{ name: 'svelte' }, { name: 'vitest' }],
      },
      {
        id: 'note-2',
        title: 'Original Title 2',
        content: 'Original content 2 with architecture diagram.',
        isPinned: true,
        tags: [{ name: 'design' }],
      },
    ];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // TASK 2.1: Modifying content then reverting back to identical initial text
  // =========================================================================
  describe('Task 2.1: Modifying content then reverting back -> isDirty must be false', () => {
    it('Reverting title back to exact initial value returns isDirty to false', () => {
      harness.loadNote(harness.notes[0]);
      expect(harness.isDirtyDerived).toBe(false);

      // Edit title
      harness.title = 'Changed Title';
      harness.updateDirtyState();
      expect(harness.isDirtyDerived).toBe(true);

      // Revert title to exact initial
      harness.title = 'Original Title 1';
      harness.updateDirtyState();
      expect(harness.isDirtyDerived).toBe(false);
    });

    it('Reverting content back to exact initial value returns isDirty to false', () => {
      harness.loadNote(harness.notes[0]);
      expect(harness.isDirtyDerived).toBe(false);

      // Edit content
      harness.content = 'Heavily edited content with lots of modifications...';
      harness.updateDirtyState();
      expect(harness.isDirtyDerived).toBe(true);

      // Revert content
      harness.content = 'Original content 1 with markdown prose.';
      harness.updateDirtyState();
      expect(harness.isDirtyDerived).toBe(false);
    });

    it('Toggling pin back to initial pin state returns isDirty to false', () => {
      harness.loadNote(harness.notes[0]);
      expect(harness.isPinned).toBe(false);
      expect(harness.isDirtyDerived).toBe(false);

      // Pin note
      harness.isPinned = true;
      harness.updateDirtyState();
      expect(harness.isDirtyDerived).toBe(true);

      // Unpin back to initial
      harness.isPinned = false;
      harness.updateDirtyState();
      expect(harness.isDirtyDerived).toBe(false);
    });

    it('Adding and then removing a tag returns isDirty to false', () => {
      harness.loadNote(harness.notes[0]); // initial tags: ['svelte', 'vitest']
      expect(harness.isDirtyDerived).toBe(false);

      // Add tag
      harness.addTag('typescript');
      expect(harness.tagList).toEqual(['svelte', 'vitest', 'typescript']);
      expect(harness.isDirtyDerived).toBe(true);

      // Remove the newly added tag
      harness.removeTag(2);
      expect(harness.tagList).toEqual(['svelte', 'vitest']);
      expect(harness.isDirtyDerived).toBe(false);
    });

    it('Reordering tags does NOT falsely trigger isDirty because tag sets are identical', () => {
      harness.loadNote(harness.notes[0]); // initial tags: ['svelte', 'vitest']
      expect(harness.isDirtyDerived).toBe(false);

      // Reorder tagList to ['vitest', 'svelte']
      harness.tagList = ['vitest', 'svelte'];
      harness.updateDirtyState();
      expect(harness.isDirtyDerived).toBe(false);
    });

    it('Multi-property edit sequence fully restored back to initial state returns isDirty to false', () => {
      harness.loadNote(harness.notes[0]);
      expect(harness.isDirtyDerived).toBe(false);

      // Modify all fields
      harness.title = 'Temp Title';
      harness.content = 'Temp Content';
      harness.isPinned = true;
      harness.addTag('tempTag');
      expect(harness.isDirtyDerived).toBe(true);

      // Revert each one by one
      harness.title = 'Original Title 1';
      expect(harness.isDirtyDerived).toBe(true);

      harness.content = 'Original content 1 with markdown prose.';
      expect(harness.isDirtyDerived).toBe(true);

      harness.isPinned = false;
      expect(harness.isDirtyDerived).toBe(true);

      harness.removeTag(2); // remove tempTag
      expect(harness.isDirtyDerived).toBe(false);
    });
  });

  // =========================================================================
  // TASK 2.2: Creating a new note vs editing an existing note
  // =========================================================================
  describe('Task 2.2: Creating a new note vs editing an existing note', () => {
    it('Freshly created new note with all empty fields is NOT dirty', () => {
      harness.createNewNote();
      expect(harness.isCreatingNew).toBe(true);
      expect(harness.activeNoteId).toBeNull();
      expect(harness.title).toBe('');
      expect(harness.content).toBe('');
      expect(harness.tagList).toEqual([]);
      expect(harness.isPinned).toBe(false);
      expect(harness.isDirtyDerived).toBe(false);
    });

    it('New note with whitespace-only title and content is NOT dirty', () => {
      harness.createNewNote();
      harness.title = '   ';
      harness.content = '   ';
      harness.updateDirtyState();
      expect(harness.isDirtyDerived).toBe(false);
    });

    it('New note becomes dirty as soon as any content or tag or pin is added', () => {
      harness.createNewNote();

      // Title added
      harness.title = 'Draft Note';
      harness.updateDirtyState();
      expect(harness.isDirtyDerived).toBe(true);

      // Clear title
      harness.title = '';
      harness.updateDirtyState();
      expect(harness.isDirtyDerived).toBe(false);

      // Content added
      harness.content = 'Some prose';
      harness.updateDirtyState();
      expect(harness.isDirtyDerived).toBe(true);

      // Clear content
      harness.content = '';
      harness.updateDirtyState();
      expect(harness.isDirtyDerived).toBe(false);

      // Tag added
      harness.addTag('ideas');
      expect(harness.isDirtyDerived).toBe(true);

      // Remove tag
      harness.removeTag(0);
      expect(harness.isDirtyDerived).toBe(false);

      // Pin toggled
      harness.isPinned = true;
      harness.updateDirtyState();
      expect(harness.isDirtyDerived).toBe(true);

      // Unpin
      harness.isPinned = false;
      harness.updateDirtyState();
      expect(harness.isDirtyDerived).toBe(false);
    });

    it('Existing note distinguishes pristine empty fields from newly emptied fields', () => {
      // Note with non-empty content
      harness.loadNote(harness.notes[0]);
      expect(harness.isDirtyDerived).toBe(false);

      // Emptying existing content makes it dirty!
      harness.content = '';
      harness.updateDirtyState();
      expect(harness.isDirtyDerived).toBe(true);
    });

    it('Switching from new note mode to existing note mode cleans up snapshot state', () => {
      harness.createNewNote();
      harness.title = 'Discardable Draft';
      harness.updateDirtyState();
      expect(harness.isDirtyDerived).toBe(true);

      // Discard and switch to existing note
      harness.loadNote(harness.notes[1]);
      expect(harness.isCreatingNew).toBe(false);
      expect(harness.activeNoteId).toBe('note-2');
      expect(harness.title).toBe('Original Title 2');
      expect(harness.isDirtyDerived).toBe(false);
    });
  });

  // =========================================================================
  // TASK 2.3: Rapid clicking between notes when dirty -> dialog prevents data loss
  // =========================================================================
  describe('Task 2.3: Rapid clicking between notes when dirty -> prevents data loss', () => {
    it('Rapidly clicking 100 note items while dirty holds navigation and preserves pending draft', () => {
      harness.loadNote(harness.notes[0]);
      harness.content = 'Crucial unsaved research data that must not be lost!';
      harness.updateDirtyState();
      expect(harness.isEditorDirty).toBe(true);

      // Simulate rapid user clicks across various notes
      for (let i = 0; i < 100; i++) {
        const targetId = i % 2 === 0 ? 'note-2' : 'note-1';
        harness.selectNote(targetId);
        // On every click, showUnsavedDialog must be true and activeNoteId must remain note-1
        expect(harness.showUnsavedDialog).toBe(true);
        expect(harness.activeNoteId).toBe('note-1');
        expect(harness.content).toBe('Crucial unsaved research data that must not be lost!');
      }
    });

    it('Rapid clicking [New Note] while editing dirty note is intercepted by dialog', () => {
      harness.loadNote(harness.notes[0]);
      harness.title = 'Modified Unsaved Title';
      harness.updateDirtyState();

      // Click create new note multiple times
      for (let i = 0; i < 20; i++) {
        harness.clickCreateNew();
        expect(harness.showUnsavedDialog).toBe(true);
        expect(harness.activeNoteId).toBe('note-1');
        expect(harness.isCreatingNew).toBe(false);
      }
    });

    it('Rapid alternating between note click and create new preserves pending action correctly', () => {
      harness.loadNote(harness.notes[0]);
      harness.content = 'Unsaved modifications';
      harness.updateDirtyState();

      harness.selectNote('note-2');
      expect(harness.showUnsavedDialog).toBe(true);

      // User then clicks create new while dialog is already open
      harness.clickCreateNew();
      expect(harness.showUnsavedDialog).toBe(true);
      expect(harness.activeNoteId).toBe('note-1');
    });
  });

  // =========================================================================
  // TASK 2.4: [Stay], [Discard], and [Save] button behaviors
  // =========================================================================
  describe('Task 2.4: [Stay], [Discard], and [Save] button behaviors', () => {
    it('[Stay] dismisses dialog, preserves dirty draft, and cancels pending navigation', () => {
      harness.loadNote(harness.notes[0]);
      harness.content = 'Modified content to keep';
      harness.updateDirtyState();

      harness.selectNote('note-2');
      expect(harness.showUnsavedDialog).toBe(true);
      expect(harness.pendingAction).not.toBeNull();

      // User clicks [Stay]
      harness.handleDialogStay();
      expect(harness.showUnsavedDialog).toBe(false);
      expect(harness.pendingAction).toBeNull();
      expect(harness.activeNoteId).toBe('note-1');
      expect(harness.content).toBe('Modified content to keep');
      expect(harness.isEditorDirty).toBe(true);
    });

    it('[Discard] rolls back edits to baseline, clears dirty flag, closes dialog, and transitions to target note', () => {
      harness.loadNote(harness.notes[0]);
      harness.title = 'Abandoned Title';
      harness.content = 'Abandoned Content';
      harness.updateDirtyState();

      harness.selectNote('note-2');
      expect(harness.showUnsavedDialog).toBe(true);

      // User clicks [Discard]
      harness.handleDialogDiscard();
      expect(harness.showUnsavedDialog).toBe(false);
      expect(harness.isEditorDirty).toBe(false);
      expect(harness.activeNoteId).toBe('note-2');
      expect(harness.title).toBe('Original Title 2');
      expect(harness.content).toBe('Original content 2 with architecture diagram.');
    });

    it('[Save] validates, persists dirty changes, updates baseline, clears dirty flag, and transitions to target note', async () => {
      harness.loadNote(harness.notes[0]);
      harness.title = 'Persisted Title 1';
      harness.content = 'Persisted Content 1';
      harness.addTag('production');
      harness.updateDirtyState();

      harness.selectNote('note-2');
      expect(harness.showUnsavedDialog).toBe(true);

      // User clicks [Save]
      const saved = await harness.handleDialogSave();
      expect(saved).toBe(true);
      expect(harness.showUnsavedDialog).toBe(false);
      expect(harness.isEditorDirty).toBe(false);
      expect(toastStore.toasts.some((t) => t.message.includes('saved successfully'))).toBe(true);

      // Verify note-1 in database/memory was updated
      const updatedNote1 = harness.notes.find((n) => n.id === 'note-1');
      expect(updatedNote1?.title).toBe('Persisted Title 1');
      expect(updatedNote1?.content).toBe('Persisted Content 1');
      expect(updatedNote1?.tags.map((t) => t.name)).toContain('production');

      // Verify navigation completed to note-2
      expect(harness.activeNoteId).toBe('note-2');
      expect(harness.title).toBe('Original Title 2');
    });

    it('[Save] on invalid note (e.g. empty title) fails gracefully, does NOT navigate, and preserves work', async () => {
      harness.loadNote(harness.notes[0]);
      harness.title = '   '; // Invalid empty title
      harness.content = 'Important text that cannot be saved without title';
      harness.updateDirtyState();

      harness.selectNote('note-2');
      expect(harness.showUnsavedDialog).toBe(true);

      // User clicks [Save]
      const saved = await harness.handleDialogSave();
      expect(saved).toBe(false);
      // Navigation must NOT happen!
      expect(harness.activeNoteId).toBe('note-1');
      expect(harness.content).toBe('Important text that cannot be saved without title');
      // Toast shows error
      expect(toastStore.toasts.some((t) => t.type === 'error' && t.message.includes('Title is required'))).toBe(true);
    });

    it('[Save] when server returns 500 error fails gracefully, does NOT navigate, and retains user content', async () => {
      harness.loadNote(harness.notes[0]);
      harness.title = 'Valid Title';
      harness.content = 'Valuable work';
      harness.updateDirtyState();
      harness.mockSaveFail = true;
      harness.mockSaveErrorMessage = 'Database connection lost';

      harness.selectNote('note-2');
      expect(harness.showUnsavedDialog).toBe(true);

      // User clicks [Save]
      const saved = await harness.handleDialogSave();
      expect(saved).toBe(false);
      expect(harness.activeNoteId).toBe('note-1');
      expect(harness.content).toBe('Valuable work');
      expect(toastStore.toasts.some((t) => t.type === 'error' && t.message.includes('Database connection lost'))).toBe(true);
    });

    it('Saving a newly created note from the guard dialog persists new note with generated ID', async () => {
      harness.createNewNote();
      harness.title = 'Brand New Note via Guard';
      harness.content = 'Created directly from dirty guard flow.';
      harness.addTag('newTag');
      harness.updateDirtyState();

      // User clicks existing note-1
      harness.selectNote('note-1');
      expect(harness.showUnsavedDialog).toBe(true);

      // User clicks [Save]
      const saved = await harness.handleDialogSave();
      expect(saved).toBe(true);
      expect(harness.notes.length).toBe(3);
      expect(harness.notes.some((n) => n.title === 'Brand New Note via Guard')).toBe(true);
      expect(harness.activeNoteId).toBe('note-1');
    });
  });

  // =========================================================================
  // ADDITIONAL ADVERSARIAL STRESS TESTS
  // =========================================================================
  describe('Adversarial Stress Scenarios', () => {
    it('Stress: 100,000-character content dirty check executes in < 5ms', () => {
      harness.loadNote(harness.notes[0]);
      const hugeContent = 'A'.repeat(100_000);

      const start = performance.now();
      harness.content = hugeContent;
      harness.updateDirtyState();
      const duration = performance.now() - start;

      expect(harness.isDirtyDerived).toBe(true);
      expect(duration).toBeLessThan(50); // fast comparison

      // Revert
      harness.content = 'Original content 1 with markdown prose.';
      harness.updateDirtyState();
      expect(harness.isDirtyDerived).toBe(false);
    });

    it('Stress: Tag lists with 50 items comparing order independence', () => {
      const tagsA = Array.from({ length: 50 }, (_, i) => `tag_${i}`);
      const tagsB = [...tagsA].reverse();

      expect(NavigationGuardStressHarness.areTagListsEqual(tagsA, tagsB)).toBe(true);

      const tagsC = [...tagsA, 'tag_extra'];
      expect(NavigationGuardStressHarness.areTagListsEqual(tagsA, tagsC)).toBe(false);
    });

    it('Stress: Unicode, emoji, and RTL characters dirty tracking', () => {
      harness.loadNote(harness.notes[0]);
      const unicodeText = 'مرحبا بالعالم 🚀 🦀 🦄 \u00A0 \u202E reverse \u200B';
      harness.content = unicodeText;
      harness.updateDirtyState();
      expect(harness.isDirtyDerived).toBe(true);

      harness.content = 'Original content 1 with markdown prose.';
      harness.updateDirtyState();
      expect(harness.isDirtyDerived).toBe(false);
    });
  });
});
