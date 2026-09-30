<script lang="ts">
  import {
    IconNote,
    IconStar,
    IconClock,
    IconTag,
    IconChevronDown,
    IconChevronUp,
    IconTrash,
  } from './icons';

  export interface NavTagItem {
    id: string;
    name: string;
    count?: number;
  }

  export type NavSection = 'all' | 'favorites' | 'recent' | 'trash';

  interface SidebarNavProps {
    activeSection?: NavSection;
    selectedTagId?: string | null;
    totalNotesCount?: number;
    favoritesCount?: number;
    recentCount?: number;
    tags?: NavTagItem[];
    onSelectSection?: (section: NavSection) => void;
    onSelectTag?: (tagId: string) => void;
    onClearTag?: () => void;
  }

  let {
    activeSection = 'all',
    selectedTagId = null,
    totalNotesCount = 0,
    favoritesCount = 0,
    recentCount = 0,
    tags = [],
    onSelectSection,
    onSelectTag,
    onClearTag,
  }: SidebarNavProps = $props();

  let isTagsExpanded = $state(false);

  // Show top 7 tags initially, expand on demand
  const VISIBLE_TAG_LIMIT = 7;
  let displayedTags = $derived.by(() => {
    if (isTagsExpanded || tags.length <= VISIBLE_TAG_LIMIT) {
      return tags;
    }
    // Always include selected tag even when collapsed
    const topTags = tags.slice(0, VISIBLE_TAG_LIMIT);
    if (selectedTagId && !topTags.some((t) => t.id === selectedTagId)) {
      const activeTag = tags.find((t) => t.id === selectedTagId);
      if (activeTag) {
        return [...topTags.slice(0, VISIBLE_TAG_LIMIT - 1), activeTag];
      }
    }
    return topTags;
  });

  let hiddenTagsCount = $derived(Math.max(0, tags.length - VISIBLE_TAG_LIMIT));

  function handleSectionClick(section: NavSection) {
    if (selectedTagId) {
      onClearTag?.();
    }
    onSelectSection?.(section);
  }

  function handleTagClick(tagId: string) {
    if (selectedTagId === tagId) {
      onClearTag?.();
    } else {
      onSelectTag?.(tagId);
    }
  }
</script>

<nav class="sidebar-nav" aria-label="Main Navigation">
  <!-- Section: NOTES -->
  <div class="nav-group">
    <div class="nav-group-header">
      <span class="group-title">Notes</span>
    </div>
    <ul class="nav-list" role="list">
      <li class="nav-list-item">
        <button
          type="button"
          class="nav-item-btn {!selectedTagId && activeSection === 'all' ? 'active' : ''}"
          onclick={() => handleSectionClick('all')}
          aria-current={!selectedTagId && activeSection === 'all' ? 'page' : undefined}
        >
          <span class="nav-item-icon">
            <IconNote size={15} />
          </span>
          <span class="nav-item-label">All Notes</span>
          <span class="nav-item-count">{totalNotesCount}</span>
        </button>
      </li>

      <li class="nav-list-item">
        <button
          type="button"
          class="nav-item-btn {!selectedTagId && activeSection === 'favorites' ? 'active' : ''}"
          onclick={() => handleSectionClick('favorites')}
          aria-current={!selectedTagId && activeSection === 'favorites' ? 'page' : undefined}
        >
          <span class="nav-item-icon star-icon">
            <IconStar size={15} filled={!selectedTagId && activeSection === 'favorites'} />
          </span>
          <span class="nav-item-label">Favorites</span>
          {#if favoritesCount > 0}
            <span class="nav-item-count">{favoritesCount}</span>
          {/if}
        </button>
      </li>

      <li class="nav-list-item">
        <button
          type="button"
          class="nav-item-btn {!selectedTagId && activeSection === 'recent' ? 'active' : ''}"
          onclick={() => handleSectionClick('recent')}
          aria-current={!selectedTagId && activeSection === 'recent' ? 'page' : undefined}
        >
          <span class="nav-item-icon clock-icon">
            <IconClock size={15} />
          </span>
          <span class="nav-item-label">Recent</span>
          {#if recentCount > 0}
            <span class="nav-item-count">{recentCount}</span>
          {/if}
        </button>
      </li>
    </ul>
  </div>

  <div class="nav-divider" role="separator" aria-hidden="true"></div>

  <!-- Section: TAGS -->
  <div class="nav-group">
    <div class="nav-group-header">
      <span class="group-title">Tags</span>
      {#if selectedTagId}
        <button
          type="button"
          class="btn-clear-tag"
          onclick={() => onClearTag?.()}
          title="Clear selected tag"
        >
          Clear
        </button>
      {/if}
    </div>

    {#if tags.length === 0}
      <div class="nav-empty-state">
        <span>No tags yet</span>
      </div>
    {:else}
      <ul class="nav-list tags-list" role="list">
        {#each displayedTags as tag (tag.id)}
          <li class="nav-list-item">
            <button
              type="button"
              class="nav-item-btn tag-btn {selectedTagId === tag.id ? 'active' : ''}"
              onclick={() => handleTagClick(tag.id)}
              aria-pressed={selectedTagId === tag.id}
            >
              <span class="tag-hash">#</span>
              <span class="nav-item-label tag-name">{tag.name}</span>
              {#if tag.count !== undefined}
                <span class="nav-item-count">{tag.count}</span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>

      {#if tags.length > VISIBLE_TAG_LIMIT}
        <button
          type="button"
          class="btn-toggle-tags"
          onclick={() => (isTagsExpanded = !isTagsExpanded)}
          aria-expanded={isTagsExpanded}
        >
          {#if isTagsExpanded}
            <IconChevronUp size={12} />
            <span>Show fewer</span>
          {:else}
            <IconChevronDown size={12} />
            <span>Show {hiddenTagsCount} more</span>
          {/if}
        </button>
      {/if}
    {/if}
  </div>
</nav>

<style>
  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem 0.75rem;
    height: 100%;
    box-sizing: border-box;
    overflow-y: auto;
    overscroll-behavior: contain;
    user-select: none;
  }

  .nav-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .nav-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.25rem 0.5rem;
    min-height: 24px;
  }

  .group-title {
    font-size: 0.6875rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .btn-clear-tag {
    background: transparent;
    border: none;
    font-size: 0.6875rem;
    font-weight: 600;
    color: #2563eb;
    cursor: pointer;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    transition: background 0.15s ease;
  }

  .btn-clear-tag:hover {
    background: #eff6ff;
  }

  .nav-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .nav-list-item {
    margin: 0;
    padding: 0;
  }

  .nav-item-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.4375rem 0.625rem;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: #475569;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
    font-family: inherit;
    box-sizing: border-box;
  }

  .nav-item-btn:hover {
    background: #f1f5f9;
    color: #0f172a;
  }

  .nav-item-btn:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 1px;
  }

  .nav-item-btn.active {
    background: #eff6ff;
    color: #1d4ed8;
    font-weight: 600;
  }

  .nav-item-btn.active .nav-item-icon {
    color: #2563eb;
  }

  .nav-item-btn.active .nav-item-count {
    background: #dbeafe;
    color: #1e40af;
  }

  .nav-item-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    flex-shrink: 0;
    width: 16px;
  }

  .star-icon {
    color: #f59e0b;
  }

  .nav-item-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tag-hash {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #94a3b8;
    flex-shrink: 0;
    width: 12px;
    text-align: center;
  }

  .nav-item-btn.active .tag-hash {
    color: #3b82f6;
  }

  .tag-name {
    font-size: 0.8125rem;
  }

  .nav-item-count {
    font-size: 0.6875rem;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: #94a3b8;
    background: #f1f5f9;
    padding: 0.0625rem 0.375rem;
    border-radius: 9999px;
    flex-shrink: 0;
  }

  .nav-divider {
    height: 1px;
    background: #e2e8f0;
    margin: 0.25rem 0.5rem;
  }

  .nav-empty-state {
    padding: 0.75rem 0.5rem;
    font-size: 0.75rem;
    color: #94a3b8;
    font-style: italic;
  }

  .btn-toggle-tags {
    margin-top: 0.25rem;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.3125rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #64748b;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
    width: fit-content;
  }

  .btn-toggle-tags:hover {
    color: #0f172a;
    background: #f1f5f9;
  }

  .btn-toggle-tags:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 1px;
  }
</style>
