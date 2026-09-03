<script lang="ts">
  import NoteCard, { type NoteCardData } from './NoteCard.svelte';
  import { IconPin, IconNote, IconSearch, IconPlus, IconTag } from './icons';

  export type BatchExportFormat = 'docx' | 'doc' | 'html';

  interface NoteListProps {
    notes: NoteCardData[];
    selectedNoteId?: string | null;
    searchQuery?: string;
    selectedTagId?: string;
    selectedTagName?: string;
    onSelectNote?: (note: NoteCardData) => void;
    onEditNote?: (note: NoteCardData) => void;
    onDeleteNote?: (noteId: string) => void;
    onTogglePin?: (noteId: string, isPinned: boolean) => void;
    onTagClick?: (tagName: string) => void;
    onCreateNew?: () => void;
    onClearFilters?: () => void;
    selectionMode?: boolean;
    selectedIds?: string[];
    onToggleSelect?: (noteId: string) => void;
    onToggleSelectionMode?: () => void;
    onSelectAll?: (noteIds: string[]) => void;
    onClearSelection?: () => void;
    onBatchExport?: (format: BatchExportFormat) => void | Promise<void>;
    visibleNoteIds?: string[];
  }

  let {
    notes = [],
    selectedNoteId = null,
    searchQuery = '',
    selectedTagId = '',
    selectedTagName = '',
    onSelectNote,
    onEditNote,
    onDeleteNote,
    onTogglePin,
    onTagClick,
    onCreateNew,
    onClearFilters,
    selectionMode = false,
    selectedIds = [],
    onToggleSelect,
    onToggleSelectionMode,
    onSelectAll,
    onClearSelection,
    onBatchExport,
    visibleNoteIds = [],
  }: NoteListProps = $props();

  let pinnedNotes = $derived(notes.filter((n) => n.isPinned));
  let otherNotes = $derived(notes.filter((n) => !n.isPinned));
  let isFiltered = $derived(Boolean((searchQuery && searchQuery.trim()) || selectedTagId));
  let hasSelection = $derived(selectedIds.length > 0);

  // Escape exits selection mode; listener only attached while active
  $effect(() => {
    if (!selectionMode) return;
    function handleBatchKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onToggleSelectionMode?.();
      }
    }
    window.addEventListener('keydown', handleBatchKeyDown);
    return () => window.removeEventListener('keydown', handleBatchKeyDown);
  });
</script>

<div class="note-list-container">
  {#if notes.length === 0}
    <div class="empty-state">
      {#if isFiltered}
        <div class="empty-icon-wrapper">
          {#if searchQuery}
            <IconSearch size={28} />
          {:else}
            <IconTag size={28} />
          {/if}
        </div>
        <h4 class="empty-title">No notes found</h4>
        <p class="empty-desc">
          No notes match
          {#if searchQuery && selectedTagName}
            "{searchQuery}" and #{selectedTagName}
          {:else if searchQuery}
            "{searchQuery}"
          {:else if selectedTagName}
            #{selectedTagName}
          {:else}
            the current filters
          {/if}.
        </p>
        {#if onClearFilters}
          <button type="button" class="btn-clear-empty" onclick={onClearFilters}>
            Clear Filters
          </button>
        {/if}
      {:else}
        <div class="empty-icon-wrapper">
          <IconNote size={28} />
        </div>
        <h4 class="empty-title">No notes yet</h4>
        <p class="empty-desc">Create your first note to get started organizing your thoughts.</p>
        {#if onCreateNew}
          <button
            type="button"
            class="btn-create-empty"
            onclick={onCreateNew}
            title="New note (Cmd/Ctrl+N)"
            aria-label="Create New Note"
          >
            <IconPlus size={14} />
            <span>Create New Note</span>
          </button>
        {/if}
      {/if}
    </div>
  {:else}
    <div class="note-sections-wrapper">
      {#if onToggleSelectionMode}
        <div class="batch-controls">
          <div class="batch-header-row">
            <button
              type="button"
              class="batch-select-toggle {selectionMode ? 'active' : ''}"
              onclick={onToggleSelectionMode}
              aria-pressed={selectionMode}
              title={selectionMode ? 'Exit selection mode (Escape)' : 'Select notes for batch export'}
              aria-label={selectionMode ? 'Exit selection mode' : 'Select notes for batch export'}
              data-testid="batch-select-toggle"
            >
              {selectionMode ? 'Done' : 'Select'}
            </button>
          </div>

          {#if selectionMode}
            <div
              class="batch-toolbar"
              role="toolbar"
              aria-label="Batch select and export notes"
              data-testid="batch-toolbar"
            >
              <span class="batch-count">{selectedIds.length} selected</span>
              <button
                type="button"
                class="batch-btn"
                onclick={() => onSelectAll?.(visibleNoteIds)}
                data-testid="batch-select-all"
              >
                Select all
              </button>
              <button
                type="button"
                class="batch-btn"
                onclick={onClearSelection}
                data-testid="batch-clear"
              >
                Clear
              </button>
              <div class="batch-divider" role="separator" aria-hidden="true"></div>
              <button
                type="button"
                class="batch-btn"
                onclick={() => onBatchExport?.('docx')}
                disabled={!hasSelection}
                data-testid="batch-export-docx"
              >
                Word (.docx)
              </button>
              <button
                type="button"
                class="batch-btn"
                onclick={() => onBatchExport?.('doc')}
                disabled={!hasSelection}
                data-testid="batch-export-doc"
              >
                Word 97 (.doc)
              </button>
              <button
                type="button"
                class="batch-btn"
                onclick={() => onBatchExport?.('html')}
                disabled={!hasSelection}
                data-testid="batch-export-html"
              >
                HTML (.html)
              </button>
            </div>
          {/if}
        </div>
      {/if}

      {#if pinnedNotes.length > 0}
        <div class="section-group">
          <div class="section-header">
            <span class="section-title">
              <IconPin size={12} filled={true} class="section-pin-icon" />
              Pinned ({pinnedNotes.length})
            </span>
          </div>
          <div class="cards-stack">
            {#each pinnedNotes as note (note.id)}
              <NoteCard
                {note}
                isSelected={selectionMode ? selectedIds.includes(note.id) : selectedNoteId === note.id}
                onSelect={onSelectNote}
                onEdit={onEditNote}
                onDelete={onDeleteNote}
                {onTogglePin}
                {onTagClick}
                {selectionMode}
                {onToggleSelect}
              />
            {/each}
          </div>
        </div>
      {/if}

      {#if otherNotes.length > 0}
        <div class="section-group">
          {#if pinnedNotes.length > 0}
            <div class="section-header">
              <span class="section-title">Other Notes ({otherNotes.length})</span>
            </div>
          {/if}
          <div class="cards-stack">
            {#each otherNotes as note (note.id)}
              <NoteCard
                {note}
                isSelected={selectionMode ? selectedIds.includes(note.id) : selectedNoteId === note.id}
                onSelect={onSelectNote}
                onEdit={onEditNote}
                onDelete={onDeleteNote}
                {onTogglePin}
                {onTagClick}
                {selectionMode}
                {onToggleSelect}
              />
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .note-list-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }

  .note-sections-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .section-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-header {
    display: flex;
    align-items: center;
    padding: 0.35rem 0.375rem;
    position: sticky;
    top: 0;
    z-index: 5;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    background: rgba(248, 250, 252, 0.92);
    border-radius: 4px;
  }

  .section-title {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
  }

  .cards-stack {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .batch-controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .batch-header-row {
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .batch-select-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #f8fafc;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .batch-select-toggle:hover {
    background: #f1f5f9;
    color: #0f172a;
    border-color: #94a3b8;
  }

  .batch-select-toggle.active {
    background: #eff6ff;
    border-color: #93c5fd;
    color: #1d4ed8;
    font-weight: 600;
  }

  .batch-select-toggle:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 1px;
  }

  .batch-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.375rem;
    padding: 0.375rem 0.5rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
  }

  .batch-count {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #0f172a;
    padding: 0 0.25rem;
    white-space: nowrap;
  }

  .batch-btn {
    display: inline-flex;
    align-items: center;
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #ffffff;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .batch-btn:hover:not(:disabled) {
    background: #f1f5f9;
    color: #0f172a;
    border-color: #94a3b8;
  }

  .batch-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .batch-btn:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 1px;
  }

  .batch-divider {
    width: 1px;
    height: 1.25rem;
    background: #cbd5e1;
    margin: 0 0.25rem;
    flex-shrink: 0;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 3rem 1.5rem;
    background: #ffffff;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    gap: 0.75rem;
  }

  .empty-icon-wrapper {
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    background: #f8fafc;
    border-radius: 50%;
  }

  .empty-title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: #0f172a;
  }

  .empty-desc {
    margin: 0;
    font-size: 0.8125rem;
    color: #64748b;
    max-width: 280px;
    line-height: 1.4;
  }

  .btn-create-empty {
    margin-top: 0.5rem;
    background: #2563eb;
    color: #ffffff;
    border: none;
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    transition: background 0.15s ease;
  }

  .btn-create-empty:hover {
    background: #1d4ed8;
  }

  .btn-clear-empty {
    margin-top: 0.5rem;
    background: #f8fafc;
    color: #475569;
    border: 1px solid #cbd5e1;
    padding: 0.4rem 0.875rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-clear-empty:hover {
    background: #f1f5f9;
    color: #0f172a;
  }
</style>
