import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import NoteCard from '../../src/lib/components/NoteCard.svelte';
import NoteList from '../../src/lib/components/NoteList.svelte';
import NoteEditor from '../../src/lib/components/NoteEditor.svelte';
import TagFilter from '../../src/lib/components/TagFilter.svelte';
import SearchBar from '../../src/lib/components/SearchBar.svelte';
import Toast from '../../src/lib/components/Toast.svelte';
import { toast, ToastState } from '../../src/lib/stores/toast.svelte';

describe('Challenger M4: Svelte 5 Runes & Components Empirical Verification', () => {
  describe('1. NoteCard Component', () => {
    const mockNote = {
      id: 'note-1',
      title: 'Meeting Notes',
      content: 'Discussing **Q4 targets** and `deployment` plan.',
      isPinned: false,
      createdAt: new Date('2026-08-15T10:00:00Z'),
      updatedAt: new Date('2026-08-15T12:00:00Z'),
      tags: [
        { id: 't1', name: 'work' },
        { id: 't2', name: 'q4' },
      ],
    };

    it('renders note title, stripped preview snippet, and tag pills', () => {
      const { html } = render(NoteCard, { props: { note: mockNote } });
      expect(html).toContain('Meeting Notes');
      // stripMarkdown strips bold and backticks
      expect(html).toContain('Discussing Q4 targets and deployment plan.');
      expect(html).toContain('#work');
      expect(html).toContain('#q4');
      expect(html).not.toContain('pinned');
    });

    it('renders pinned indicator and pin styling when isPinned is true', () => {
      const pinnedNote = { ...mockNote, isPinned: true };
      const { html } = render(NoteCard, { props: { note: pinnedNote } });
      expect(html).toContain('pinned');
      expect(html).toContain('pin-indicator');
      expect(html).toContain('Unpin note');
    });

    it('renders selected styling when isSelected is true', () => {
      const { html } = render(NoteCard, { props: { note: mockNote, isSelected: true } });
      expect(html).toContain('selected');
      expect(html).toContain('aria-pressed="true"');
    });
  });

  describe('2. NoteList Component & Prop Forwarding', () => {
    const notesList = [
      {
        id: 'note-pinned',
        title: 'Pinned Note',
        content: 'Important info',
        isPinned: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
      },
      {
        id: 'note-other',
        title: 'Regular Note',
        content: 'Regular info',
        isPinned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
      },
    ];

    it('renders pinned and other sections appropriately', () => {
      const { html } = render(NoteList, { props: { notes: notesList } });
      expect(html).toContain('Pinned (1)');
      expect(html).toContain('Other Notes (1)');
      expect(html).toContain('Pinned Note');
      expect(html).toContain('Regular Note');
    });

    it('forwards onEditNote and onDeleteNote callback props to NoteCard actions', () => {
      const onEdit = () => {};
      const onDelete = () => {};
      const { html } = render(NoteList, {
        props: {
          notes: notesList,
          onEditNote: onEdit,
          onDeleteNote: onDelete,
        },
      });
      expect(html).toContain('Edit note');
      expect(html).toContain('Delete note');
      expect(html).toContain('edit-btn');
      expect(html).toContain('delete-btn');
    });

    it('does not render edit/delete action buttons when onEditNote/onDeleteNote are omitted', () => {
      const { html } = render(NoteList, {
        props: {
          notes: notesList,
        },
      });
      expect(html).not.toContain('Edit note');
      expect(html).not.toContain('Delete note');
      expect(html).not.toContain('edit-btn');
      expect(html).not.toContain('delete-btn');
    });

    it('highlights selected note card when selectedNoteId matches', () => {
      const { html } = render(NoteList, {
        props: {
          notes: notesList,
          selectedNoteId: 'note-pinned',
        },
      });
      expect(html).toContain('selected');
      expect(html).toContain('aria-pressed="true"');
    });

    it('renders empty state when notes array is empty and unfiltered', () => {
      const { html } = render(NoteList, { props: { notes: [], onCreateNew: () => {} } });
      expect(html).toContain('No notes yet');
      expect(html).toContain('Create New Note');
    });

    it('renders filter empty state when searchQuery or tag is active with 0 results', () => {
      const { html } = render(NoteList, {
        props: {
          notes: [],
          searchQuery: 'missing keyword',
          selectedTagId: 'tag-1',
          selectedTagName: 'dev',
          onClearFilters: () => {},
        },
      });
      expect(html).toContain('No notes found');
      expect(html).toContain('"missing keyword" and #dev');
      expect(html).toContain('Clear Filters');
    });
  });

  describe('3. NoteEditor Component & Reactivity', () => {
    const editNote = {
      id: 'note-123',
      title: 'Architecture Blueprint',
      content: '# System Design\n\n- Svelte 5 runes\n- Drizzle ORM',
      isPinned: true,
      tags: [{ id: 't1', name: 'architecture' }, { id: 't2', name: 'svelte' }],
    };

    it('renders form inputs populated with existing note data', () => {
      const { html } = render(NoteEditor, { props: { note: editNote, isNew: false } });
      expect(html).toContain('Architecture Blueprint');
      expect(html).toContain('value="architecture, svelte"');
      expect(html).toContain('#architecture');
      expect(html).toContain('#svelte');
      expect(html).toContain('action="?/update"');
      expect(html).toContain('value="note-123"');
    });

    it('renders character count with 200 character limit', () => {
      const { html } = render(NoteEditor, { props: { note: editNote } });
      const expectedCount = `${editNote.title.length}/200`;
      expect(html).toContain(expectedCount);
    });

    it('renders new note form with ?/create action and empty inputs when isNew=true', () => {
      const { html } = render(NoteEditor, { props: { note: null, isNew: true } });
      expect(html).toContain('action="?/create"');
      expect(html).toContain('0/200');
      expect(html).toContain('Create Note');
    });

    it('renders live markdown preview in split mode', () => {
      const { html } = render(NoteEditor, { props: { note: editNote } });
      expect(html).toContain('<h1>System Design</h1>');
      expect(html).toContain('<li>Svelte 5 runes</li>');
      expect(html).toContain('<li>Drizzle ORM</li>');
    });
  });

  describe('4. TagFilter Component', () => {
    const mockTags = [
      { id: 't1', name: 'typescript', count: 5 },
      { id: 't2', name: 'svelte', count: 3 },
    ];

    it('renders all notes chip as active when selectedTagId is empty', () => {
      const { html } = render(TagFilter, {
        props: { tags: mockTags, selectedTagId: '', totalNotesCount: 8 },
      });
      expect(html).toContain('All Notes');
      expect(html).toContain('active');
      expect(html).toContain('#typescript');
      expect(html).toContain('#svelte');
      expect(html).not.toContain('btn-clear-tags');
    });

    it('highlights active tag chip and renders Clear button when selectedTagId is set', () => {
      const { html } = render(TagFilter, {
        props: { tags: mockTags, selectedTagId: 't2', totalNotesCount: 8 },
      });
      expect(html).toContain('btn-clear-tags');
      expect(html).toContain('Clear');
      expect(html).toContain('#svelte');
    });
  });

  describe('5. SearchBar Component', () => {
    it('renders input with placeholder and value', () => {
      const { html } = render(SearchBar, {
        props: { value: 'initial search', placeholder: 'Custom placeholder' },
      });
      expect(html).toContain('value="initial search"');
      expect(html).toContain('placeholder="Custom placeholder"');
      expect(html).toContain('search-clear-btn');
    });

    it('does not render clear button when value is empty', () => {
      const { html } = render(SearchBar, { props: { value: '' } });
      expect(html).not.toContain('search-clear-btn');
    });
  });

  describe('6. Toast Store & Toast Component', () => {
    it('manages toasts in ToastState store correctly', () => {
      const customToast = new ToastState();
      expect(customToast.toasts.length).toBe(0);

      const id1 = customToast.success('Saved successfully', 0);
      expect(customToast.toasts.length).toBe(1);
      expect(customToast.toasts[0].type).toBe('success');
      expect(customToast.toasts[0].message).toBe('Saved successfully');

      const id2 = customToast.error('Network error', 0);
      expect(customToast.toasts.length).toBe(2);

      customToast.remove(id1);
      expect(customToast.toasts.length).toBe(1);
      expect(customToast.toasts[0].id).toBe(id2);

      customToast.clear();
      expect(customToast.toasts.length).toBe(0);
    });

    it('renders active toasts from global toast store in Toast.svelte', () => {
      toast.clear();
      toast.info('Info notification test', 0);
      const { html } = render(Toast);
      expect(html).toContain('toast-container');
      expect(html).toContain('Info notification test');
      expect(html).toContain('toast-card info');
      toast.clear();
    });
  });
});
