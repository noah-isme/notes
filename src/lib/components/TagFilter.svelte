<script lang="ts">
  import { IconTag } from './icons';

  interface TagItem {
    id: string;
    name: string;
    count?: number;
  }

  interface TagFilterProps {
    tags: TagItem[];
    selectedTagId?: string;
    totalNotesCount?: number;
    onSelectTag?: (tagId: string) => void;
    onClearTag?: () => void;
  }

  let {
    tags = [],
    selectedTagId = '',
    totalNotesCount,
    onSelectTag,
    onClearTag,
  }: TagFilterProps = $props();

  let isAllSelected = $derived(!selectedTagId);
</script>

<div class="tag-filter-container">
  <div class="tag-filter-header">
    <span class="tag-filter-title">
      <IconTag size={13} />
      <span>Tags</span>
    </span>
    {#if selectedTagId}
      <button type="button" class="btn-clear-tags" onclick={() => onClearTag?.()}>
        Clear
      </button>
    {/if}
  </div>

  <div class="tag-chips-list" role="group" aria-label="Filter by tag">
    <button
      type="button"
      class="tag-chip {isAllSelected ? 'active' : ''}"
      onclick={() => onClearTag?.()}
      aria-pressed={isAllSelected}
    >
      <span>All Notes</span>
      {#if totalNotesCount !== undefined}
        <span class="tag-count">{totalNotesCount}</span>
      {/if}
    </button>

    {#each tags as tag (tag.id)}
      <button
        type="button"
        class="tag-chip {selectedTagId === tag.id ? 'active' : ''}"
        onclick={() => onSelectTag?.(tag.id)}
        aria-pressed={selectedTagId === tag.id}
      >
        <span>#{tag.name}</span>
        {#if tag.count !== undefined}
          <span class="tag-count">{tag.count}</span>
        {/if}
      </button>
    {/each}

    {#if tags.length === 0}
      <p class="empty-tags">No tags created yet</p>
    {/if}
  </div>
</div>

<style>
  .tag-filter-container {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .tag-filter-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .tag-filter-title {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.6875rem;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .btn-clear-tags {
    background: none;
    border: none;
    font-size: 0.75rem;
    font-weight: 500;
    color: #2563eb;
    cursor: pointer;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    transition: background 0.15s ease;
  }

  .btn-clear-tags:hover {
    background: #eff6ff;
  }

  .tag-chips-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    padding: 0.25rem 0.625rem;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s ease-in-out;
    font-family: inherit;
  }

  .tag-chip:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #0f172a;
  }

  .tag-chip.active {
    background: #0f172a;
    border-color: #0f172a;
    color: #ffffff;
    font-weight: 600;
  }

  .tag-chip.active .tag-count {
    background: rgba(255, 255, 255, 0.2);
    color: #ffffff;
  }

  .tag-count {
    font-size: 0.6875rem;
    background: #f1f5f9;
    color: #64748b;
    padding: 0.0625rem 0.3125rem;
    border-radius: 4px;
    font-weight: 600;
  }

  .empty-tags {
    font-size: 0.75rem;
    color: #94a3b8;
    margin: 0;
    font-style: italic;
  }
</style>
