<script lang="ts">
  import { stripMarkdown } from '$lib/utils/markdown';
  import { IconPin, IconEdit, IconTrash } from './icons';

  export interface NoteCardData {
    id: string;
    title: string;
    content: string;
    isPinned: boolean;
    isPublic?: boolean;
    shareToken?: string | null;
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
    selectionMode?: boolean;
    onToggleSelect?: (noteId: string) => void;
  }

  let {
    note,
    isSelected = false,
    onSelect,
    onEdit,
    onDelete,
    onTogglePin,
    onTagClick,
    selectionMode = false,
    onToggleSelect,
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
    if (selectionMode) {
      onToggleSelect?.(note.id);
      return;
    }
    onSelect?.(note);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (selectionMode) {
        onToggleSelect?.(note.id);
      } else {
        onSelect?.(note);
      }
    }
  }

  function handleToggleSelect(e: Event) {
    e.stopPropagation();
    onToggleSelect?.(note.id);
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
    onDelete?.(note.id);
  }

  function handleTagClick(e: MouseEvent, tagName: string) {
    e.stopPropagation();
    onTagClick?.(tagName);
  }
</script>

<div
  class="note-card {note.isPinned ? 'pinned' : ''} {isSelected ? 'selected' : ''} {selectionMode ? 'selection-mode' : ''} {selectionMode && isSelected ? 'batch-selected' : ''}"
  onclick={handleCardClick}
  onkeydown={handleKeyDown}
  tabindex="0"
  role="button"
  aria-pressed={isSelected}
  aria-label={`Note: ${note.title}`}
>
  {#if selectionMode}
    <div class="select-checkbox-wrap">
      <input
        type="checkbox"
        class="note-select-checkbox"
        data-testid="note-select-checkbox"
        aria-label={`Select note ${note.title}`}
        checked={isSelected}
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
        }}
        onchange={handleToggleSelect}
      />
    </div>
  {/if}

  <div class="card-top-row">
    <h3 class="card-title">
      {#if note.isPinned}
        <span class="pin-indicator" title="Pinned note" aria-label="Pinned">
          <IconPin size={12} filled={true} class="pin-icon-badge" />
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
        <IconPin size={13} filled={note.isPinned} />
      </button>

      {#if onEdit}
        <button
          type="button"
          class="action-btn edit-btn"
          onclick={handleEdit}
          title="Edit note"
          aria-label="Edit note"
        >
          <IconEdit size={13} />
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
          <IconTrash size={13} />
        </button>
      {/if}
    </div>
  </div>

  <p class="card-preview">
    {previewSnippet || 'No content'}
  </p>

  <div class="card-bottom-row">
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
</div>

<style>
  .note-card {
    background: #ffffff;
    border: 1px solid #f1f5f9;
    border-radius: 6px;
    padding: 0.75rem 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
    user-select: none;
    box-sizing: border-box;
    position: relative;
    margin-bottom: 0.375rem;
  }

  .note-card:hover {
    background: #f8fafc;
    border-color: #e2e8f0;
  }

  .note-card:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 1px;
  }

  .note-card.selected {
    background: #eff6ff;
    border-color: #bfdbfe;
    box-shadow: inset 3px 0 0 #2563eb;
  }

  .note-card.pinned {
    background: #ffffff;
  }

  .note-card.pinned.selected {
    background: #eff6ff;
    border-color: #bfdbfe;
    box-shadow: inset 3px 0 0 #2563eb;
  }

  .note-card.selection-mode {
    padding-left: 2.5rem;
  }

  .select-checkbox-wrap {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
  }

  .note-select-checkbox {
    width: 15px;
    height: 15px;
    accent-color: #2563eb;
    cursor: pointer;
    margin: 0;
  }

  .note-select-checkbox:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 1px;
  }

  .note-card.batch-selected,
  .note-card.batch-selected:hover {
    background: #eff6ff;
    border-color: #93c5fd;
  }

  .card-top-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
    min-width: 0;
  }

  .card-title {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 0.3125rem;
    line-height: 1.35;
    word-break: break-word;
    overflow-wrap: break-word;
    min-width: 0;
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
    min-width: 0;
    word-break: break-word;
    overflow-wrap: break-word;
  }

  /* Progressive Disclosure: Quick actions revealed on hover/focus */
  .card-actions {
    display: flex;
    align-items: center;
    gap: 0.125rem;
    flex-shrink: 0;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease;
  }

  .note-card:hover .card-actions,
  .note-card:focus-within .card-actions,
  .note-card.selected .card-actions {
    opacity: 1;
    pointer-events: auto;
  }

  .action-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    background: #e2e8f0;
    color: #0f172a;
  }

  .action-btn:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 1px;
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
    font-size: 0.78125rem;
    color: #64748b;
    line-height: 1.45;
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-bottom-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-top: 0.125rem;
  }

  .card-tags {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.25rem;
    min-width: 0;
    overflow: hidden;
  }

  .tag-pill {
    background: #f8fafc;
    color: #64748b;
    font-size: 0.6875rem;
    font-weight: 500;
    padding: 0.0625rem 0.375rem;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
    white-space: nowrap;
  }

  .tag-pill:hover {
    background: #e2e8f0;
    color: #0f172a;
    border-color: #cbd5e1;
  }

  .card-footer {
    display: flex;
    align-items: center;
    font-size: 0.6875rem;
    color: #94a3b8;
    margin-left: auto;
    flex-shrink: 0;
  }

  .card-date {
    font-variant-numeric: tabular-nums;
  }
</style>
