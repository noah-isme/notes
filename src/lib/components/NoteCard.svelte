<script lang="ts">
  import { stripMarkdown } from '$lib/utils/markdown';
  import { IconPin, IconEdit, IconTrash } from './icons';

  export interface NoteCardData {
    id: string;
    title: string;
    content: string;
    isPinned: boolean;
    createdAt: Date | string;
    updatedAt: Date | string;
    tags: Array<{ id: string; name: string }>;
  }

  interface NoteCardProps {
    note: NoteCardData;
    isSelected?: boolean;
    onSelect?: (note: NoteCardData) => void;
    onEdit?: (note: NoteCardData) => void;
    onDelete?: (noteId: string) => void;
    onTogglePin?: (noteId: string, isPinned: boolean) => void;
    onTagClick?: (tagName: string) => void;
  }

  let {
    note,
    isSelected = false,
    onSelect,
    onEdit,
    onDelete,
    onTogglePin,
    onTagClick,
  }: NoteCardProps = $props();

  let previewSnippet = $derived(stripMarkdown(note.content, 120));

  let formattedDate = $derived.by(() => {
    try {
      const d = new Date(note.updatedAt);
      return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  });

  function handleCardClick() {
    onSelect?.(note);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.(note);
    }
  }

  function handleTogglePin(e: MouseEvent) {
    e.stopPropagation();
    onTogglePin?.(note.id, !note.isPinned);
  }

  function handleEdit(e: MouseEvent) {
    e.stopPropagation();
    onEdit?.(note);
  }

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    if (typeof window !== 'undefined' && window.confirm('Are you sure you want to delete this note?')) {
      onDelete?.(note.id);
    }
  }

  function handleTagClick(e: MouseEvent, tagName: string) {
    e.stopPropagation();
    onTagClick?.(tagName);
  }
</script>

<div
  class="note-card {note.isPinned ? 'pinned' : ''} {isSelected ? 'selected' : ''}"
  onclick={handleCardClick}
  onkeydown={handleKeyDown}
  tabindex="0"
  role="button"
  aria-pressed={isSelected}
  aria-label={`Note: ${note.title}`}
>
  <div class="card-top-row">
    <h3 class="card-title">
      {#if note.isPinned}
        <span class="pin-indicator" title="Pinned note" aria-label="Pinned">
          <IconPin size={13} filled={true} class="pin-icon-badge" />
        </span>
      {/if}
      <span class="title-text">{note.title}</span>
    </h3>

    <div class="card-actions" role="toolbar" aria-label="Note quick actions">
      <button
        type="button"
        class="action-btn pin-btn {note.isPinned ? 'active-pin' : ''}"
        onclick={handleTogglePin}
        title={note.isPinned ? 'Unpin note' : 'Pin note'}
        aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
      >
        <IconPin size={14} filled={note.isPinned} />
      </button>

      {#if onEdit}
        <button
          type="button"
          class="action-btn edit-btn"
          onclick={handleEdit}
          title="Edit note"
          aria-label="Edit note"
        >
          <IconEdit size={14} />
        </button>
      {/if}

      {#if onDelete}
        <button
          type="button"
          class="action-btn delete-btn"
          onclick={handleDelete}
          title="Delete note"
          aria-label="Delete note"
        >
          <IconTrash size={14} />
        </button>
      {/if}
    </div>
  </div>

  <p class="card-preview">
    {previewSnippet || 'No content'}
  </p>

  {#if note.tags && note.tags.length > 0}
    <div class="card-tags">
      {#each note.tags as tag (tag.id)}
        <button
          type="button"
          class="tag-pill"
          onclick={(e) => handleTagClick(e, tag.name)}
          aria-label={`Filter by tag ${tag.name}`}
        >
          #{tag.name}
        </button>
      {/each}
    </div>
  {/if}

  <div class="card-footer">
    {#if formattedDate}
      <time class="card-date" datetime={new Date(note.updatedAt).toISOString()}>
        {formattedDate}
      </time>
    {/if}
  </div>
</div>

<style>
  .note-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.875rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    cursor: pointer;
    text-align: left;
    transition:
      box-shadow 0.15s ease,
      border-color 0.15s ease;
    user-select: none;
    box-sizing: border-box;
    position: relative;
  }

  .note-card:hover {
    border-color: #cbd5e1;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
  }

  .note-card:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }

  .note-card.selected {
    border-color: #2563eb;
    background: #f8faff;
    box-shadow: 0 0 0 1px #2563eb;
  }

  .note-card.pinned {
    border-left: 3px solid #f59e0b;
    background: #ffffff;
  }

  .note-card.pinned.selected {
    background: #f8faff;
    border-left-color: #f59e0b;
    border-color: #2563eb;
  }

  .card-top-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .card-title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    line-height: 1.35;
    word-break: break-word;
    flex: 1;
  }

  .pin-indicator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #d97706;
    flex-shrink: 0;
  }

  .title-text {
    flex: 1;
  }

  .card-actions {
    display: flex;
    align-items: center;
    gap: 0.125rem;
    flex-shrink: 0;
    opacity: 0.7;
    transition: opacity 0.15s ease;
  }

  .note-card:hover .card-actions,
  .note-card.selected .card-actions {
    opacity: 1;
  }

  .action-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.3125rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    background: #f1f5f9;
    color: #0f172a;
  }

  .pin-btn.active-pin {
    color: #d97706;
  }

  .delete-btn:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  .card-preview {
    margin: 0;
    font-size: 0.8125rem;
    color: #475569;
    line-height: 1.45;
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-top: 0.125rem;
  }

  .tag-pill {
    background: #f1f5f9;
    color: #475569;
    font-size: 0.6875rem;
    font-weight: 500;
    padding: 0.125rem 0.4375rem;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
  }

  .tag-pill:hover {
    background: #e2e8f0;
    color: #0f172a;
    border-color: #cbd5e1;
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.6875rem;
    color: #94a3b8;
    margin-top: auto;
    padding-top: 0.25rem;
  }

  .card-date {
    font-variant-numeric: tabular-nums;
  }
</style>
