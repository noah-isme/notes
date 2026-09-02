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
  import {
    IconNote,
    IconTag,
    IconPlus,
    IconArrowLeft,
  } from '$lib/components/icons';

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
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        selectedNoteId = data.notes[0].id;
      }
    }
  });

  let lastHandledForm: any = null;

  // Handle toast notifications from form action responses safely once per submission
  $effect(() => {
    if (form && form !== lastHandledForm) {
      lastHandledForm = form;
      if (form.error) {
        toast.error(form.error);
      } else if (form.success) {
        if (form.note) {
          toast.success(`Note "${form.note.title}" saved successfully`);
          selectedNoteId = form.note.id;
          isCreatingNew = false;
        } else {
          toast.success('Action completed successfully');
        }
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
      count: data.notes.filter((n) => n.tags?.some((t) => t.id === tag.id)).length,
    }))
  );

  // Client-side interactions
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

  function handleCancelEditor() {
    isCreatingNew = false;
    if (data.notes.length > 0) {
      selectedNoteId = data.notes[0].id;
    } else {
      selectedNoteId = null;
    }
    mobileView = 'list';
  }

  function handleBackToList() {
    mobileView = 'list';
  }

  // Filter updates
  async function updateQueryParam(key: string, value: string | null) {
    const url = new URL($page.url);
    if (value) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key);
    }
    await goto(url.toString(), { keepFocus: true, noScroll: true });
  }

  function handleSearch(query: string) {
    updateQueryParam('search', query.trim() ? query : null);
  }

  function handleSelectTag(tagId: string) {
    updateQueryParam('tagId', tagId);
    isTagFilterOpenMobile = false;
  }

  function handleClearTag() {
    updateQueryParam('tagId', null);
    isTagFilterOpenMobile = false;
  }

  function handleClearAllFilters() {
    const url = new URL($page.url);
    url.searchParams.delete('search');
    url.searchParams.delete('tagId');
    goto(url.toString(), { keepFocus: true, noScroll: true });
  }

  function handleTagClickFromCard(tagName: string) {
    const matching = data.tags.find((t) => t.name.toLowerCase() === tagName.toLowerCase());
    if (matching) {
      handleSelectTag(matching.id);
    }
  }

  // Action handlers via form POST
  async function handleDeleteNote(noteId: string) {
    const formData = new FormData();
    formData.append('id', noteId);

    try {
      const response = await fetch('?/delete', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        toast.success('Note deleted successfully');
        if (selectedNoteId === noteId) {
          selectedNoteId = null;
          isCreatingNew = false;
          mobileView = 'list';
        }
        await goto($page.url.toString(), { invalidateAll: true });
      } else {
        toast.error('Failed to delete note');
      }
    } catch {
      toast.error('An error occurred while deleting note');
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
        toast.success(isPinned ? 'Note pinned' : 'Note unpinned');
        await goto($page.url.toString(), { invalidateAll: true });
      } else {
        toast.error('Failed to update pin status');
      }
    } catch {
      toast.error('An error occurred while updating pin status');
    }
  }
</script>

<svelte:head>
  <title>Notes Workspace</title>
</svelte:head>

<Toast />

<div class="app-dashboard-container">
  <!-- Mobile Navigation Toolbar (Shown only on small viewports) -->
  <div class="mobile-nav-bar">
    {#if mobileView === 'editor'}
      <button type="button" class="btn-back-nav" onclick={handleBackToList}>
        <IconArrowLeft size={14} />
        <span>Back to Notes</span>
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
        <IconTag size={13} />
        <span>{selectedTag ? `#${selectedTag.name}` : 'All Tags'}</span>
      </button>
      <button type="button" class="btn-mobile-new-note" onclick={handleCreateNew}>
        <IconPlus size={14} />
        <span>New Note</span>
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
          <IconPlus size={14} />
          <span>New Note</span>
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
            <div class="no-selection-icon-wrapper">
              <IconNote size={32} />
            </div>
            <h3 class="no-selection-title">Select a Note</h3>
            <p class="no-selection-desc">
              Choose a note from the list on the left to view or edit, or create a new note to begin writing.
            </p>
            <button type="button" class="btn-create-starter" onclick={handleCreateNew}>
              <IconPlus size={14} />
              <span>Create New Note</span>
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

  .mobile-nav-bar {
    display: none;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0;
    margin-bottom: 0.75rem;
    gap: 0.75rem;
  }

  .btn-back-nav {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    color: #0f172a;
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
  }

  .btn-tag-drawer-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    color: #475569;
    font-size: 0.8125rem;
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
  }

  .btn-mobile-new-note {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: #2563eb;
    color: #ffffff;
    border: none;
    font-size: 0.8125rem;
    font-weight: 600;
    padding: 0.375rem 0.875rem;
    border-radius: 6px;
    cursor: pointer;
  }

  .mobile-tags-drawer {
    display: none;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .master-detail-layout {
    display: grid;
    grid-template-columns: 200px 320px 1fr;
    gap: 1.25rem;
    align-items: start;
    height: calc(100vh - 120px);
  }

  .pane-sidebar {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 100%;
    box-sizing: border-box;
    overflow-y: auto;
  }

  .sidebar-block {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .active-filters-summary {
    border-top: 1px solid #f1f5f9;
    padding-top: 0.75rem;
  }

  .active-filter-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .filter-badge-label {
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
  }

  .btn-reset-filters {
    background: none;
    border: none;
    font-size: 0.6875rem;
    color: #2563eb;
    cursor: pointer;
    padding: 0;
  }

  .btn-reset-filters:hover {
    text-decoration: underline;
  }

  .filter-pill-item {
    font-size: 0.75rem;
    color: #475569;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .pane-master-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    height: 100%;
    box-sizing: border-box;
  }

  .master-list-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-create-header {
    display: inline-flex;
    align-items: center;
    gap: 0.3125rem;
    background: #2563eb;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    padding: 0.5625rem 0.875rem;
    font-size: 0.8125rem;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-create-header:hover {
    background: #1d4ed8;
  }

  .master-list-scrollable {
    flex: 1;
    overflow-y: auto;
    padding-right: 0.125rem;
  }

  .pane-detail-workspace {
    height: 100%;
    box-sizing: border-box;
  }

  .no-selection-workspace {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 2rem;
    box-sizing: border-box;
  }

  .no-selection-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 320px;
    gap: 0.75rem;
  }

  .no-selection-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: #f1f5f9;
    color: #64748b;
    border-radius: 10px;
  }

  .no-selection-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #0f172a;
  }

  .no-selection-desc {
    margin: 0;
    font-size: 0.8125rem;
    color: #64748b;
    line-height: 1.5;
  }

  .btn-create-starter {
    margin-top: 0.5rem;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: #2563eb;
    color: #ffffff;
    border: none;
    padding: 0.5rem 1.125rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-create-starter:hover {
    background: #1d4ed8;
  }

  @media (max-width: 1024px) {
    .master-detail-layout {
      grid-template-columns: 280px 1fr;
    }

    .pane-sidebar {
      display: none;
    }

    .mobile-tags-drawer {
      display: block;
    }
  }

  @media (max-width: 768px) {
    .master-detail-layout {
      grid-template-columns: 1fr;
      height: auto;
    }

    .mobile-nav-bar {
      display: flex;
    }

    .master-detail-layout.show-list-mobile .pane-detail-workspace {
      display: none;
    }

    .master-detail-layout.show-editor-mobile .pane-master-list {
      display: none;
    }

    .master-detail-layout.show-editor-mobile .pane-sidebar {
      display: none;
    }
  }
</style>
