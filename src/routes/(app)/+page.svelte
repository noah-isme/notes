<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { toast } from '$lib/stores/toast.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import SearchBar from '$lib/components/SearchBar.svelte';
  import TagFilter from '$lib/components/TagFilter.svelte';
  import NoteList from '$lib/components/NoteList.svelte';
  import NoteEditor from '$lib/components/NoteEditor.svelte';
  import type { NoteCardData } from '$lib/components/NoteCard.svelte';

  let { data, form }: { data: PageData; form?: ActionData } = $props();

  // Active UI states
  let selectedNoteId = $state<string | null>(null);
  let isCreatingNew = $state(false);
  let mobileView = $state<'list' | 'editor'>('list');
  let isTagFilterOpenMobile = $state(false);

  // Derived selected note object
  let selectedNote = $derived(
    selectedNoteId ? data.notes.find((n) => n.id === selectedNoteId) ?? null : null
  );

  // If no note selected and we have notes, auto-select the first note on desktop
  $effect(() => {
    if (!selectedNoteId && !isCreatingNew && data.notes.length > 0) {
      // If we are not on mobile, select first note
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        selectedNoteId = data.notes[0].id;
      }
    }
  });

  // Handle toast notifications from form action responses
  $effect(() => {
    if (form?.error) {
      toast.error(form.error);
    } else if (form?.success) {
      if (form.note) {
        toast.success(`Note "${form.note.title}" saved successfully`);
        selectedNoteId = form.note.id;
        isCreatingNew = false;
      } else {
        toast.success('Action completed successfully');
      }
    }
  });

  // Selected tag object helper
  let selectedTag = $derived(
    data.filters?.tagId ? data.tags.find((t) => t.id === data.filters.tagId) : null
  );

  // Tag counts helper
  let tagsWithCounts = $derived(
    data.tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      count: data.notes.filter((n) => n.tags.some((t) => t.id === tag.id)).length,
    }))
  );

  // Handlers
  function handleSelectNote(note: NoteCardData) {
    selectedNoteId = note.id;
    isCreatingNew = false;
    mobileView = 'editor';
  }

  function handleCreateNew() {
    selectedNoteId = null;
    isCreatingNew = true;
    mobileView = 'editor';
  }

  function handleBackToList() {
    mobileView = 'list';
  }

  function handleCancelEditor() {
    isCreatingNew = false;
    if (data.notes.length > 0 && !selectedNoteId) {
      selectedNoteId = data.notes[0].id;
    }
    mobileView = 'list';
  }

  function handleSearch(query: string) {
    const url = new URL(window.location.href);
    if (query.trim()) {
      url.searchParams.set('search', query.trim());
    } else {
      url.searchParams.delete('search');
    }
    goto(url.toString(), { keepFocus: true, noScroll: true });
  }

  function handleSelectTag(tagId: string) {
    const url = new URL(window.location.href);
    url.searchParams.set('tagId', tagId);
    isTagFilterOpenMobile = false;
    goto(url.toString(), { keepFocus: true, noScroll: true });
  }

  function handleClearTag() {
    const url = new URL(window.location.href);
    url.searchParams.delete('tagId');
    isTagFilterOpenMobile = false;
    goto(url.toString(), { keepFocus: true, noScroll: true });
  }

  function handleClearAllFilters() {
    const url = new URL(window.location.href);
    url.searchParams.delete('search');
    url.searchParams.delete('tagId');
    url.searchParams.delete('isPinned');
    isTagFilterOpenMobile = false;
    goto(url.pathname, { keepFocus: true, noScroll: true });
  }

  function handleTagClickFromCard(tagName: string) {
    const matchingTag = data.tags.find(
      (t) => t.name.toLowerCase() === tagName.toLowerCase()
    );
    if (matchingTag) {
      handleSelectTag(matchingTag.id);
    }
  }

  async function handleTogglePin(noteId: string, isPinned: boolean) {
    const formData = new FormData();
    formData.append('id', noteId);
    formData.append('isPinned', isPinned ? 'true' : 'false');

    try {
      const response = await fetch('?/togglePin', {
        method: 'POST',
        body: formData,
      });
      if (response.ok) {
        toast.info(isPinned ? 'Note pinned to top' : 'Note unpinned');
        // Refresh page data
        goto(window.location.href, { invalidateAll: true });
      }
    } catch {
      toast.error('Failed to update pin state');
    }
  }

  async function handleDeleteNote(noteId: string) {
    const formData = new FormData();
    formData.append('id', noteId);

    try {
      const response = await fetch('?/delete', {
        method: 'POST',
        body: formData,
      });
      if (response.ok) {
        toast.success('Note deleted');
        if (selectedNoteId === noteId) {
          selectedNoteId = null;
        }
        mobileView = 'list';
        goto(window.location.href, { invalidateAll: true });
      }
    } catch {
      toast.error('Failed to delete note');
    }
  }
</script>

<svelte:head>
  <title>Notes | Markdown Workspace</title>
</svelte:head>

<Toast />

<div class="app-dashboard-container">
  <!-- Mobile Navigation Toolbar (Shown only on small viewports) -->
  <div class="mobile-nav-bar">
    {#if mobileView === 'editor'}
      <button type="button" class="btn-back-nav" onclick={handleBackToList}>
        ← Back to Notes
      </button>
      <span class="mobile-nav-title">
        {isCreatingNew ? 'New Note' : selectedNote?.title || 'Edit Note'}
      </span>
    {:else}
      <button
        type="button"
        class="btn-tag-drawer-toggle"
        onclick={() => (isTagFilterOpenMobile = !isTagFilterOpenMobile)}
      >
        🏷️ {selectedTag ? `#${selectedTag.name}` : 'All Tags'}
      </button>
      <button type="button" class="btn-mobile-new-note" onclick={handleCreateNew}>
        + New Note
      </button>
    {/if}
  </div>

  <!-- Mobile Collapsible Tag Drawer -->
  {#if isTagFilterOpenMobile && mobileView === 'list'}
    <div class="mobile-tags-drawer">
      <TagFilter
        tags={tagsWithCounts}
        selectedTagId={data.filters?.tagId}
        totalNotesCount={data.notes.length}
        onSelectTag={handleSelectTag}
        onClearTag={handleClearTag}
      />
    </div>
  {/if}

  <div class="master-detail-layout {mobileView === 'editor' ? 'show-editor-mobile' : 'show-list-mobile'}">
    <!-- PANE 1: Desktop Left Sidebar (Filters, Tags, Stats) -->
    <aside class="pane-sidebar" aria-label="Filters and Tags">
      <div class="sidebar-block">
        <TagFilter
          tags={tagsWithCounts}
          selectedTagId={data.filters?.tagId}
          totalNotesCount={data.notes.length}
          onSelectTag={handleSelectTag}
          onClearTag={handleClearTag}
        />
      </div>

      {#if data.filters?.search || data.filters?.tagId}
        <div class="sidebar-block active-filters-summary">
          <div class="active-filter-header">
            <span class="filter-badge-label">Active Filters</span>
            <button type="button" class="btn-reset-filters" onclick={handleClearAllFilters}>
              Reset All
            </button>
          </div>
          {#if data.filters?.search}
            <div class="filter-pill-item">
              <span>Query: "{data.filters.search}"</span>
            </div>
          {/if}
          {#if selectedTag}
            <div class="filter-pill-item">
              <span>Tag: #{selectedTag.name}</span>
            </div>
          {/if}
        </div>
      {/if}
    </aside>

    <!-- PANE 2: Middle Master List Pane (Search, New Button, Note Cards) -->
    <section class="pane-master-list" aria-label="Notes List">
      <div class="master-list-header">
        <SearchBar
          value={data.filters?.search}
          placeholder="Search title & content..."
          onSearch={handleSearch}
          onClear={() => handleSearch('')}
        />
        <button type="button" class="btn-create-header" onclick={handleCreateNew}>
          + New Note
        </button>
      </div>

      <div class="master-list-scrollable">
        <NoteList
          notes={data.notes}
          {selectedNoteId}
          searchQuery={data.filters?.search}
          selectedTagId={data.filters?.tagId}
          selectedTagName={selectedTag?.name}
          onSelectNote={handleSelectNote}
          onEditNote={handleSelectNote}
          onDeleteNote={handleDeleteNote}
          onTogglePin={handleTogglePin}
          onTagClick={handleTagClickFromCard}
          onCreateNew={handleCreateNew}
          onClearFilters={handleClearAllFilters}
        />
      </div>
    </section>

    <!-- PANE 3: Right Detail Workspace (Markdown Editor & Live Preview) -->
    <main class="pane-detail-workspace" aria-label="Note Editor Workspace">
      {#if isCreatingNew || selectedNote}
        <NoteEditor
          note={isCreatingNew ? null : selectedNote}
          isNew={isCreatingNew}
          formError={form?.error}
          onCancel={handleCancelEditor}
          onDelete={handleDeleteNote}
        />
      {:else}
        <div class="no-selection-workspace">
          <div class="no-selection-card">
            <span class="no-selection-icon">📝</span>
            <h3 class="no-selection-title">Select a Note</h3>
            <p class="no-selection-desc">
              Choose a note from the list on the left to view or edit, or create a new note to begin writing.
            </p>
            <button type="button" class="btn-create-starter" onclick={handleCreateNew}>
              + Create New Note
            </button>
          </div>
        </div>
      {/if}
    </main>
  </div>
</div>

<style>
  .app-dashboard-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: calc(100vh - 120px);
  }

  /* Mobile Top Navigation */
  .mobile-nav-bar {
    display: none;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    margin-bottom: 0.75rem;
    gap: 0.5rem;
  }

  .btn-back-nav {
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    color: #1e293b;
    font-size: 0.8125rem;
    font-weight: 600;
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
  }

  .mobile-nav-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #0f172a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 180px;
  }

  .btn-tag-drawer-toggle {
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    color: #334155;
    font-size: 0.8125rem;
    font-weight: 500;
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
  }

  .btn-mobile-new-note {
    background: #2563eb;
    color: #ffffff;
    border: none;
    font-size: 0.8125rem;
    font-weight: 600;
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
  }

  .mobile-tags-drawer {
    display: none;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 0.75rem;
  }

  /* Desktop 3-Pane Layout */
  .master-detail-layout {
    display: grid;
    grid-template-columns: 240px 360px 1fr;
    gap: 1.25rem;
    align-items: stretch;
    height: calc(100vh - 120px);
    min-height: 550px;
  }

  /* Left Sidebar Pane */
  .pane-sidebar {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    overflow-y: auto;
  }

  .sidebar-block {
    display: flex;
    flex-direction: column;
  }

  .active-filters-summary {
    padding-top: 1rem;
    border-top: 1px solid #f1f5f9;
    gap: 0.5rem;
  }

  .active-filter-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .filter-badge-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
  }

  .btn-reset-filters {
    background: none;
    border: none;
    color: #ef4444;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
  }

  .btn-reset-filters:hover {
    text-decoration: underline;
  }

  .filter-pill-item {
    font-size: 0.75rem;
    background: #f8fafc;
    color: #334155;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
  }

  /* Middle Master List Pane */
  .pane-master-list {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow: hidden;
  }

  .master-list-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .btn-create-header {
    background: #2563eb;
    color: #ffffff;
    border: none;
    font-size: 0.8125rem;
    font-weight: 600;
    padding: 0.625rem 0.875rem;
    border-radius: 8px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s ease;
    flex-shrink: 0;
  }

  .btn-create-header:hover {
    background: #1d4ed8;
  }

  .master-list-scrollable {
    flex: 1;
    overflow-y: auto;
    padding-right: 0.25rem;
  }

  /* Right Detail Workspace Pane */
  .pane-detail-workspace {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .no-selection-workspace {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    background: #ffffff;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    padding: 2rem;
  }

  .no-selection-card {
    text-align: center;
    max-width: 320px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .no-selection-icon {
    font-size: 3rem;
  }

  .no-selection-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
  }

  .no-selection-desc {
    margin: 0;
    font-size: 0.875rem;
    color: #64748b;
    line-height: 1.5;
  }

  .btn-create-starter {
    margin-top: 0.5rem;
    background: #2563eb;
    color: #ffffff;
    border: none;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.625rem 1.25rem;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-create-starter:hover {
    background: #1d4ed8;
  }

  /* Responsive Breakpoints */

  /* Tablet (768px - 1023px): 2-Pane Layout */
  @media (max-width: 1023px) and (min-width: 768px) {
    .master-detail-layout {
      grid-template-columns: 320px 1fr;
    }

    .pane-sidebar {
      display: none;
    }

    .mobile-nav-bar {
      display: flex;
    }

    .mobile-tags-drawer {
      display: block;
    }
  }

  /* Mobile (<768px): Single-Pane Flow */
  @media (max-width: 767px) {
    .mobile-nav-bar {
      display: flex;
    }

    .mobile-tags-drawer {
      display: block;
    }

    .master-detail-layout {
      grid-template-columns: 1fr;
      height: auto;
      min-height: auto;
    }

    .pane-sidebar {
      display: none;
    }

    .show-list-mobile .pane-master-list {
      display: flex;
    }

    .show-list-mobile .pane-detail-workspace {
      display: none;
    }

    .show-editor-mobile .pane-master-list {
      display: none;
    }

    .show-editor-mobile .pane-detail-workspace {
      display: flex;
    }
  }
</style>
