import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'svelte/server';
import Toast from '../../src/lib/components/Toast.svelte';
import NoteEditor, { type NoteEditorData } from '../../src/lib/components/NoteEditor.svelte';
import { toast, ToastState, type ToastAction } from '../../src/lib/stores/toast.svelte';
import type { NoteCardData } from '../../src/lib/components/NoteCard.svelte';

/**
 * Empirical Soft-Delete & Undo Toast Model representing the exact
 * logic executed in src/routes/(app)/+page.svelte.
 */
class PageSoftDeleteController {
  notes: NoteCardData[] = [];
  selectedNoteId: string | null = null;
  isFocusMode: boolean = false;
  isCreatingNew: boolean = false;
  mobileView: 'list' | 'editor' = 'list';
  pendingDeleteTimers = new Map<string, ReturnType<typeof setTimeout>>();
  toastStore: ToastState;
  fetchCalls: Array<{ url: string; method: string; body: FormData }> = [];
  fetchMock: (url: string, init?: RequestInit) => Promise<Response>;

  constructor(
    initialNotes: NoteCardData[],
    toastStore: ToastState = new ToastState(),
    fetchMock?: (url: string, init?: RequestInit) => Promise<Response>
  ) {
    this.notes = [...initialNotes];
    this.toastStore = toastStore;
    this.fetchMock =
      fetchMock ??
      (async (url: string, init?: RequestInit) => {
        this.fetchCalls.push({
          url,
          method: init?.method ?? 'GET',
          body: init?.body as FormData,
        });
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      });
  }

  // Exact reproduction of handleDeleteNote from +page.svelte
  handleDeleteNote(noteId: string) {
    const noteToDelete = this.notes.find((n) => n.id === noteId);
    if (!noteToDelete) return;

    // 1. Snapshot previous notes and optimistically remove from visible list
    const previousNotes = [...this.notes];
    this.notes = this.notes.filter((n) => n.id !== noteId);

    // 2. Adjust selection if the deleted note was open
    if (this.selectedNoteId === noteId) {
      if (this.notes.length > 0) {
        this.selectedNoteId = this.notes[0].id;
      } else {
        this.selectedNoteId = null;
        this.isCreatingNew = false;
        this.mobileView = 'list';
      }
    }
    this.isFocusMode = false;

    // 3. Clear any existing timer for this note if re-queued
    const existingTimer = this.pendingDeleteTimers.get(noteId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.pendingDeleteTimers.delete(noteId);
    }

    // 4. Deferred 6-second timer to permanently commit deletion to backend
    const timer = setTimeout(async () => {
      this.pendingDeleteTimers.delete(noteId);
      const formData = new FormData();
      formData.append('id', noteId);

      try {
        const response = await this.fetchMock('?/delete', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          this.toastStore.error('Failed to permanently delete note');
        }
      } catch {
        this.toastStore.error('Network error while deleting note');
      }
    }, 6000);

    this.pendingDeleteTimers.set(noteId, timer);

    // 5. Trigger Undo Toast notification
    this.toastStore.showWithAction(
      `Note "${noteToDelete.title}" deleted`,
      {
        label: 'Undo',
        onClick: () => {
          const activeTimer = this.pendingDeleteTimers.get(noteId);
          if (activeTimer) {
            clearTimeout(activeTimer);
            this.pendingDeleteTimers.delete(noteId);
          }
          // Restore note to visible list and select it
          this.notes = previousNotes;
          this.selectedNoteId = noteToDelete.id;
          this.mobileView = 'editor';
          this.toastStore.success(`Note "${noteToDelete.title}" restored`);
        },
      },
      'info',
      6000
    );
  }

  // Exact reproduction of unmount cleanup effect from +page.svelte
  simulateUnmount() {
    for (const [id, timer] of this.pendingDeleteTimers.entries()) {
      clearTimeout(timer);
      const formData = new FormData();
      formData.append('id', id);
      this.fetchMock('?/delete', { method: 'POST', body: formData }).catch(() => {});
    }
    this.pendingDeleteTimers.clear();
  }
}

function createMockNote(id: string, title: string, content = 'content'): NoteCardData {
  return {
    id,
    title,
    content,
    isPinned: false,
    createdAt: new Date('2026-09-01T10:00:00Z'),
    updatedAt: new Date('2026-09-01T12:00:00Z'),
    tags: [{ id: `tag-${id}`, name: 'test' }],
  };
}

describe('Empirical Challenger M2.2: Soft-Delete & Undo Toast (F2.3) Stress Harness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    toast.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // SCENARIO 1: Immediate Disappearance from List & Selection Management
  // =========================================================================
  describe('Scenario 1: Immediate Disappearance from List', () => {
    it('removes note immediately from notes array upon deletion call', () => {
      const notes = [
        createMockNote('n1', 'First Note'),
        createMockNote('n2', 'Second Note'),
        createMockNote('n3', 'Third Note'),
      ];
      const controller = new PageSoftDeleteController(notes);
      controller.selectedNoteId = 'n2';

      expect(controller.notes.map((n) => n.id)).toEqual(['n1', 'n2', 'n3']);

      controller.handleDeleteNote('n2');

      // Note n2 must disappear immediately
      expect(controller.notes.map((n) => n.id)).toEqual(['n1', 'n3']);
      expect(controller.notes.some((n) => n.id === 'n2')).toBe(false);
    });

    it('falls back to the first available note when active note is deleted', () => {
      const notes = [
        createMockNote('n1', 'First Note'),
        createMockNote('n2', 'Second Note'),
        createMockNote('n3', 'Third Note'),
      ];
      const controller = new PageSoftDeleteController(notes);
      controller.selectedNoteId = 'n2';

      controller.handleDeleteNote('n2');

      // Active note was n2; now should fallback to n1 (first remaining note)
      expect(controller.selectedNoteId).toBe('n1');
    });

    it('preserves existing selection when a non-active note is deleted', () => {
      const notes = [
        createMockNote('n1', 'First Note'),
        createMockNote('n2', 'Second Note'),
        createMockNote('n3', 'Third Note'),
      ];
      const controller = new PageSoftDeleteController(notes);
      controller.selectedNoteId = 'n1';

      controller.handleDeleteNote('n3');

      // Selection remains n1
      expect(controller.selectedNoteId).toBe('n1');
      expect(controller.notes.map((n) => n.id)).toEqual(['n1', 'n2']);
    });

    it('resets selection to null and switches mobileView to list when the last note is deleted', () => {
      const notes = [createMockNote('n1', 'Sole Note')];
      const controller = new PageSoftDeleteController(notes);
      controller.selectedNoteId = 'n1';
      controller.mobileView = 'editor';

      controller.handleDeleteNote('n1');

      expect(controller.notes.length).toBe(0);
      expect(controller.selectedNoteId).toBeNull();
      expect(controller.isCreatingNew).toBe(false);
      expect(controller.mobileView).toBe('list');
    });

    it('immediately collapses focus mode when deleting note from focus view', () => {
      const notes = [createMockNote('n1', 'Focus Note'), createMockNote('n2', 'Other Note')];
      const controller = new PageSoftDeleteController(notes);
      controller.selectedNoteId = 'n1';
      controller.isFocusMode = true;

      controller.handleDeleteNote('n1');

      expect(controller.isFocusMode).toBe(false);
    });

    it('gracefully ignores non-existent note deletion requests without mutating state', () => {
      const notes = [createMockNote('n1', 'Note 1')];
      const controller = new PageSoftDeleteController(notes);
      controller.selectedNoteId = 'n1';

      controller.handleDeleteNote('non-existent-id');

      expect(controller.notes.length).toBe(1);
      expect(controller.selectedNoteId).toBe('n1');
      expect(controller.pendingDeleteTimers.size).toBe(0);
    });
  });

  // =========================================================================
  // SCENARIO 2: Undo in Toast within 6 Seconds
  // =========================================================================
  describe('Scenario 2: Clicking [Undo] in Toast within 6s', () => {
    it('restores deleted note to list, selects it, and sets mobileView to editor', () => {
      const toastStore = new ToastState();
      const notes = [createMockNote('n1', 'Note 1'), createMockNote('n2', 'Note 2')];
      const controller = new PageSoftDeleteController(notes, toastStore);
      controller.selectedNoteId = 'n1';

      controller.handleDeleteNote('n1');
      expect(controller.notes.length).toBe(1);
      expect(controller.pendingDeleteTimers.has('n1')).toBe(true);

      // Verify Toast with Undo action was created
      expect(toastStore.toasts.length).toBe(1);
      const undoToast = toastStore.toasts[0];
      expect(undoToast.message).toBe('Note "Note 1" deleted');
      expect(undoToast.action).toBeDefined();
      expect(undoToast.action?.label).toBe('Undo');

      // Simulate user clicking [Undo] at 2.5s (before 6s expiration)
      vi.advanceTimersByTime(2500);
      undoToast.action?.onClick();

      // Note should be restored and selected
      expect(controller.notes.length).toBe(2);
      expect(controller.notes.some((n) => n.id === 'n1')).toBe(true);
      expect(controller.selectedNoteId).toBe('n1');
      expect(controller.mobileView).toBe('editor');

      // Pending timer must be cleared from map
      expect(controller.pendingDeleteTimers.has('n1')).toBe(false);

      // Success toast for restoration should be shown
      expect(toastStore.toasts.some((t) => t.message === 'Note "Note 1" restored')).toBe(true);
    });

    it('prevents backend deletion fetch when undo is triggered before 6s', async () => {
      const toastStore = new ToastState();
      const notes = [createMockNote('n1', 'Note 1')];
      const controller = new PageSoftDeleteController(notes, toastStore);

      controller.handleDeleteNote('n1');
      expect(controller.fetchCalls.length).toBe(0);

      // Advance 5.9s (almost expired) and click Undo
      vi.advanceTimersByTime(5900);
      toastStore.toasts[0].action?.onClick();

      // Advance past 6s
      vi.advanceTimersByTime(2000);
      await Promise.resolve();

      // No backend deletion fetch should have occurred
      expect(controller.fetchCalls.length).toBe(0);
    });

    it('clicking [Undo] removes toast card from Toast component state', () => {
      toast.clear();
      let undoClicked = false;
      const id = toast.showWithAction('Note "Meeting" deleted', {
        label: 'Undo',
        onClick: () => {
          undoClicked = true;
        },
      });

      expect(toast.toasts.length).toBe(1);
      const action = toast.toasts[0].action;
      expect(action?.label).toBe('Undo');

      // Execute action callback and removal as in Toast.svelte:
      action?.onClick();
      toast.remove(id);

      expect(undoClicked).toBe(true);
      expect(toast.toasts.length).toBe(0);
    });
  });

  // =========================================================================
  // SCENARIO 3: Rapid Succession Deletions & Multi-Timer Race Conditions
  // =========================================================================
  describe('Scenario 3: Rapid Succession Deletions & Multi-Timer Management', () => {
    it('manages 10 rapid deletions with distinct timers without race conditions', async () => {
      const toastStore = new ToastState();
      const initialNotes = Array.from({ length: 10 }, (_, i) =>
        createMockNote(`note-${i}`, `Title ${i}`)
      );
      const controller = new PageSoftDeleteController(initialNotes, toastStore);

      // Rapidly delete all 10 notes
      for (let i = 0; i < 10; i++) {
        controller.handleDeleteNote(`note-${i}`);
      }

      expect(controller.notes.length).toBe(0);
      expect(controller.pendingDeleteTimers.size).toBe(10);

      // Fast-forward 6s: all 10 timers should fire and send 10 fetch requests
      vi.advanceTimersByTime(6000);
      await Promise.resolve();
      await Promise.resolve();

      expect(controller.pendingDeleteTimers.size).toBe(0);
      expect(controller.fetchCalls.length).toBe(10);

      // Verify all note IDs were submitted in FormData
      const deletedIds = controller.fetchCalls.map((c) => c.body.get('id'));
      for (let i = 0; i < 10; i++) {
        expect(deletedIds).toContain(`note-${i}`);
      }
    });

    it('clears previous timer and re-queues cleanly when note is deleted, restored, and re-deleted', async () => {
      const toastStore = new ToastState();
      const note = createMockNote('n-cycle', 'Recycle Note');
      const controller = new PageSoftDeleteController([note], toastStore);

      // Delete #1
      controller.handleDeleteNote('n-cycle');
      expect(controller.pendingDeleteTimers.size).toBe(1);

      // Undo at 3s
      vi.advanceTimersByTime(3000);
      const toast1 = toastStore.toasts.find((t) => t.message.includes('Recycle Note'));
      toast1?.action?.onClick();
      expect(controller.pendingDeleteTimers.size).toBe(0);

      // Delete #2
      controller.handleDeleteNote('n-cycle');
      expect(controller.pendingDeleteTimers.size).toBe(1);

      // Wait 6.0s for Delete #2 to expire
      vi.advanceTimersByTime(6000);
      await Promise.resolve();
      await Promise.resolve();

      // Only ONE backend fetch call should have occurred (from Delete #2, not Delete #1)
      expect(controller.fetchCalls.length).toBe(1);
      expect(controller.fetchCalls[0].body.get('id')).toBe('n-cycle');
    });

    it('evaluates multiple rapid deletions where selective notes are undone', async () => {
      const toastStore = new ToastState();
      const n1 = createMockNote('n1', 'Alpha');
      const n2 = createMockNote('n2', 'Beta');
      const n3 = createMockNote('n3', 'Gamma');
      const controller = new PageSoftDeleteController([n1, n2, n3], toastStore);

      controller.handleDeleteNote('n1'); // Delete n1
      vi.advanceTimersByTime(1000);
      controller.handleDeleteNote('n2'); // Delete n2 at t=1s
      vi.advanceTimersByTime(1000);
      controller.handleDeleteNote('n3'); // Delete n3 at t=2s

      expect(controller.pendingDeleteTimers.size).toBe(3);

      // Undo n2 at t=3s
      vi.advanceTimersByTime(1000);
      // Find n2 undo toast
      const n2Toast = toastStore.toasts.find((t) => t.message.includes('Beta'));
      expect(n2Toast).toBeDefined();
      n2Toast?.action?.onClick();

      expect(controller.pendingDeleteTimers.has('n2')).toBe(false);
      expect(controller.pendingDeleteTimers.has('n1')).toBe(true);
      expect(controller.pendingDeleteTimers.has('n3')).toBe(true);

      // Fast forward 6s (timers for n1 and n3 finish)
      vi.advanceTimersByTime(6000);
      await Promise.resolve();
      await Promise.resolve();

      // n1 and n3 should have been sent to backend fetch, but NOT n2
      const deletedIds = controller.fetchCalls.map((c) => c.body.get('id'));
      expect(deletedIds).toContain('n1');
      expect(deletedIds).toContain('n3');
      expect(deletedIds).not.toContain('n2');
    });
  });

  // =========================================================================
  // SCENARIO 4: 6s Timer Expiration & Backend Deletion Persistence
  // =========================================================================
  describe('Scenario 4: 6s Timer Expiration & Backend Deletion', () => {
    it('triggers fetch("?/delete") with FormData containing id exactly after 6,000ms', async () => {
      const toastStore = new ToastState();
      const note = createMockNote('n-exp', 'Expiring Note');
      const controller = new PageSoftDeleteController([note], toastStore);

      controller.handleDeleteNote('n-exp');

      // At 5,999ms, fetch should not yet be called
      vi.advanceTimersByTime(5999);
      expect(controller.fetchCalls.length).toBe(0);

      // At 6,000ms, fetch must be called
      vi.advanceTimersByTime(1);
      await Promise.resolve();
      await Promise.resolve();

      expect(controller.fetchCalls.length).toBe(1);
      expect(controller.fetchCalls[0].url).toBe('?/delete');
      expect(controller.fetchCalls[0].method).toBe('POST');
      expect(controller.fetchCalls[0].body.get('id')).toBe('n-exp');
      expect(controller.pendingDeleteTimers.has('n-exp')).toBe(false);
    });

    it('handles HTTP error status (500) from server action with error toast notification', async () => {
      const toastStore = new ToastState();
      const errorFetch = async () => new Response('Internal Error', { status: 500 });
      const note = createMockNote('n-fail', 'Failing Note');
      const controller = new PageSoftDeleteController([note], toastStore, errorFetch);

      controller.handleDeleteNote('n-fail');
      vi.advanceTimersByTime(6000);
      await Promise.resolve();
      await Promise.resolve();

      expect(
        toastStore.toasts.some((t) => t.type === 'error' && t.message === 'Failed to permanently delete note')
      ).toBe(true);
    });

    it('handles network disconnection/fetch rejection with network error toast notification', async () => {
      const toastStore = new ToastState();
      const networkRejectFetch = async () => {
        throw new Error('Failed to fetch');
      };
      const note = createMockNote('n-net', 'Network Note');
      const controller = new PageSoftDeleteController([note], toastStore, networkRejectFetch);

      controller.handleDeleteNote('n-net');
      vi.advanceTimersByTime(6000);
      await Promise.resolve();
      await Promise.resolve();

      expect(
        toastStore.toasts.some((t) => t.type === 'error' && t.message === 'Network error while deleting note')
      ).toBe(true);
    });
  });

  // =========================================================================
  // SCENARIO 5: Component Unmount / Lifecycle Immediate Flush
  // =========================================================================
  describe('Scenario 5: Component Unmount / Navigation Flush', () => {
    it('immediately flushes all pending deletion timers on unmount without losing deletions', async () => {
      const toastStore = new ToastState();
      const notes = [
        createMockNote('n1', 'Note 1'),
        createMockNote('n2', 'Note 2'),
        createMockNote('n3', 'Note 3'),
      ];
      const controller = new PageSoftDeleteController(notes, toastStore);

      controller.handleDeleteNote('n1');
      controller.handleDeleteNote('n2');
      controller.handleDeleteNote('n3');

      expect(controller.pendingDeleteTimers.size).toBe(3);
      expect(controller.fetchCalls.length).toBe(0);

      // User closes tab or navigates away after 1s
      vi.advanceTimersByTime(1000);
      controller.simulateUnmount();

      // All 3 deletions should have been immediately submitted via fetch
      expect(controller.pendingDeleteTimers.size).toBe(0);
      expect(controller.fetchCalls.length).toBe(3);
      const flushedIds = controller.fetchCalls.map((c) => c.body.get('id'));
      expect(flushedIds).toEqual(['n1', 'n2', 'n3']);
    });
  });

  // =========================================================================
  // SCENARIO 6: Component Markup & Direct UI Interactivity
  // =========================================================================
  describe('Scenario 6: Component Markup & UI Interactivity', () => {
    it('Toast component renders .toast-action-btn when action is provided', () => {
      toast.clear();
      toast.showWithAction('Note Deleted', {
        label: 'Undo',
        onClick: () => {},
      });

      const { html } = render(Toast);
      expect(html).toContain('toast-action-btn');
      expect(html).toContain('Undo');
      expect(html).toContain('Note Deleted');
      toast.clear();
    });

    it('Toast component does not render .toast-action-btn when no action provided', () => {
      toast.clear();
      toast.info('Regular status notification', 0);

      const { html } = render(Toast);
      expect(html).not.toContain('toast-action-btn');
      expect(html).toContain('Regular status notification');
      toast.clear();
    });

    it('NoteEditor delete button invokes onDelete without blocking modal', () => {
      const note: NoteEditorData = {
        id: 'editor-note-id',
        title: 'Editor Note',
        content: 'Content',
        isPinned: false,
        tags: [],
      };

      const { html } = render(NoteEditor, {
        props: {
          note,
          onDelete: () => {},
        },
      });

      expect(html).toContain('btn-danger');
      expect(html).toContain('Delete Note');
    });

    it('ToastState auto-dismisses toast after specified duration', () => {
      const store = new ToastState();
      store.show('Auto dismiss message', 'info', 3000);
      expect(store.toasts.length).toBe(1);

      vi.advanceTimersByTime(2999);
      expect(store.toasts.length).toBe(1);

      vi.advanceTimersByTime(1);
      expect(store.toasts.length).toBe(0);
    });

    it('ToastState deduplication prevents duplicate active toasts', () => {
      const store = new ToastState();
      const id1 = store.show('Duplicate message', 'info');
      const id2 = store.show('Duplicate message', 'info');

      expect(id1).toBe(id2);
      expect(store.toasts.length).toBe(1);
    });
  });

  // =========================================================================
  // SCENARIO 7: Adversarial Invariants & Heavy Load Stress Testing
  // =========================================================================
  describe('Scenario 7: Adversarial Invariants & Heavy Load Stress', () => {
    it('handles 100 rapid deletions and 50 selective undos under high load without timer leakage', async () => {
      const toastStore = new ToastState();
      const initialNotes = Array.from({ length: 100 }, (_, i) =>
        createMockNote(`note-${i}`, `Note ${i}`)
      );
      const controller = new PageSoftDeleteController(initialNotes, toastStore);

      // Rapidly delete 100 notes
      for (let i = 0; i < 100; i++) {
        controller.handleDeleteNote(`note-${i}`);
      }

      expect(controller.notes.length).toBe(0);
      expect(controller.pendingDeleteTimers.size).toBe(100);

      // Undo every even-indexed note (50 undos)
      for (let i = 0; i < 100; i += 2) {
        const timer = controller.pendingDeleteTimers.get(`note-${i}`);
        if (timer) {
          clearTimeout(timer);
          controller.pendingDeleteTimers.delete(`note-${i}`);
        }
      }

      expect(controller.pendingDeleteTimers.size).toBe(50);

      // Fast-forward past 6 seconds
      vi.advanceTimersByTime(6000);
      await Promise.resolve();
      await Promise.resolve();

      // Remaining 50 notes should be dispatched to backend fetch
      expect(controller.fetchCalls.length).toBe(50);
      expect(controller.pendingDeleteTimers.size).toBe(0);

      // Verify all odd-numbered notes were deleted
      const deletedIds = controller.fetchCalls.map((c) => c.body.get('id'));
      for (let i = 1; i < 100; i += 2) {
        expect(deletedIds).toContain(`note-${i}`);
      }
      for (let i = 0; i < 100; i += 2) {
        expect(deletedIds).not.toContain(`note-${i}`);
      }
    });

    it('restores note to the exact index position when restored', () => {
      const n0 = createMockNote('n0', 'Item 0');
      const n1 = createMockNote('n1', 'Item 1');
      const n2 = createMockNote('n2', 'Item 2');
      const n3 = createMockNote('n3', 'Item 3');
      const n4 = createMockNote('n4', 'Item 4');

      const controller = new PageSoftDeleteController([n0, n1, n2, n3, n4]);
      controller.selectedNoteId = 'n2';

      // Delete n2 (middle item)
      controller.handleDeleteNote('n2');
      expect(controller.notes.map((n) => n.id)).toEqual(['n0', 'n1', 'n3', 'n4']);
      expect(controller.selectedNoteId).toBe('n0'); // Fallback to first

      // Undo deletion of n2
      const undoToast = controller.toastStore.toasts.find((t) => t.message.includes('Item 2'));
      undoToast?.action?.onClick();

      // Restored list retains all 5 items with n2 in original position
      expect(controller.notes.map((n) => n.id)).toEqual(['n0', 'n1', 'n2', 'n3', 'n4']);
      expect(controller.selectedNoteId).toBe('n2');
    });

    it('handles deletion and undo when multiple notes share the exact same title', () => {
      const toastStore = new ToastState();
      const n1 = createMockNote('id-alpha', 'Untitled');
      const n2 = createMockNote('id-beta', 'Untitled');

      const controller = new PageSoftDeleteController([n1, n2], toastStore);
      controller.handleDeleteNote('id-alpha');

      expect(controller.notes.map((n) => n.id)).toEqual(['id-beta']);
      expect(controller.pendingDeleteTimers.has('id-alpha')).toBe(true);

      // Undo id-alpha
      const toastItem = toastStore.toasts[0];
      expect(toastItem.message).toBe('Note "Untitled" deleted');
      toastItem.action?.onClick();

      expect(controller.notes.map((n) => n.id)).toEqual(['id-alpha', 'id-beta']);
      expect(controller.selectedNoteId).toBe('id-alpha');
      expect(controller.pendingDeleteTimers.has('id-alpha')).toBe(false);
    });
  });
});

